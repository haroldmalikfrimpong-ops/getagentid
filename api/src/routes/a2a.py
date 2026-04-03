"""A2A Agent Card generation endpoint.

Generates Google A2A-compatible agent cards from AgentID profiles,
enabling interoperability between AgentID's identity layer and the
A2A agent-to-agent protocol.

Enhanced with:
- Trust level mapping (L1-L4) via extensions.agentid namespace
- ERC-8004 reputation tag surfacing (domain-specific scores)
- Ed25519 challenge-response auth scheme bridging
- Dynamic computation (live Firestore reads, no stale cards)
- DID document cross-referencing
- Last-Modified / ETag headers for smart caching

Spec: https://a2a-protocol.org/latest/specification/
Discussion: https://github.com/a2aproject/A2A/discussions/1631

Authors:
- @haroldmalikfrimpong-ops (AgentID)
- @laplace0x (Agent Laplace — A2A mapping proposal)
"""

from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..services import agent_service

router = APIRouter(tags=["a2a"])

# ---------------------------------------------------------------------------
# Capability → A2A skill mapping
# ---------------------------------------------------------------------------

# Well-known capability-to-skill mappings with richer metadata.
# Falls back to a generic mapping for unknown capabilities.
_SKILL_CATALOG: dict[str, dict] = {
    "market-analysis": {
        "id": "market-analysis",
        "name": "Market Analysis",
        "description": "Real-time and historical market data analysis across crypto assets.",
        "inputModes": ["text", "application/json"],
        "outputModes": ["text", "application/json"],
    },
    "on-chain-investigation": {
        "id": "on-chain-investigation",
        "name": "On-Chain Investigation",
        "description": "On-chain forensics: whale tracking, flow analysis, anomaly detection.",
        "inputModes": ["text"],
        "outputModes": ["text", "application/json"],
    },
    "trading": {
        "id": "trading",
        "name": "Trading",
        "description": "Perpetual futures and spot trading with risk management.",
        "inputModes": ["application/json"],
        "outputModes": ["application/json"],
    },
    "a2a-protocol": {
        "id": "a2a-protocol",
        "name": "A2A Protocol Interaction",
        "description": "Agent-to-agent task negotiation and collaboration via A2A.",
        "inputModes": ["application/json"],
        "outputModes": ["application/json"],
    },
    "data-analysis": {
        "id": "data-analysis",
        "name": "Data Analysis",
        "description": "Statistical and quantitative analysis of structured datasets.",
        "inputModes": ["text", "application/json"],
        "outputModes": ["text", "application/json"],
    },
    "code-review": {
        "id": "code-review",
        "name": "Code Review",
        "description": "Source code review, security audit, and quality assessment.",
        "inputModes": ["text"],
        "outputModes": ["text"],
    },
}


def _map_capabilities_to_skills(capabilities: list[str]) -> list[dict]:
    """Map AgentID capabilities to A2A skill objects.

    Uses the catalog for known capabilities; generates a generic skill
    object for anything not in the catalog so no capability is lost.
    """
    skills = []
    for cap in capabilities:
        key = cap.lower().replace(" ", "-")
        if key in _SKILL_CATALOG:
            skills.append(_SKILL_CATALOG[key])
        else:
            skills.append(
                {
                    "id": key,
                    "name": cap,
                    "description": f"Agent capability: {cap}",
                    "inputModes": ["text"],
                    "outputModes": ["text"],
                }
            )
    return skills


# ---------------------------------------------------------------------------
# Trust & reputation → extensions
# ---------------------------------------------------------------------------

# Map trust level integers to human-readable names per ATL-1 spec.
_TRUST_LEVEL_NAMES: dict[int, str] = {
    1: "REGISTERED",
    2: "VERIFIED",
    3: "SECURED",
    4: "CERTIFIED",
}

# ERC-8004 reputation tags that can be surfaced as domain-specific scores.
_ERC8004_REPUTATION_TAGS = (
    "tradingYield",
    "successRate",
    "responseTime",
    "revenues",
)


def _build_agentid_extension(agent: dict, agent_id: str) -> dict:
    """Build the ``extensions.agentid`` namespace.

    Includes:
    - trust_level (L1-L4) with human-readable name
    - trust_score (0.0-1.0)
    - context_continuity_score (behavioral baseline, 30-day window)
    - scarring_score (lifetime incident history)
    - ERC-8004 reputation tags (domain-specific scores)
    - DID document reference
    - Verification URL
    """
    trust_level = agent.get("trust_level", 1)

    ext: dict = {
        "uri": "https://getagentid.dev/extensions/agentid/v1",
        "required": False,
        "config": {
            "agent_id": agent_id,
            "provider": "agentid",

            # Trust level (capability-based, per ATL-1 spec)
            "trust_level": trust_level,
            "trust_level_name": _TRUST_LEVEL_NAMES.get(trust_level, "UNKNOWN"),

            # Trust score (behavioral, 0.0-1.0)
            "trust_score": agent.get("trust_score", 0.0),

            # Behavioral monitoring scores (30-day baseline)
            "context_continuity_score": agent.get(
                "context_continuity_score"
            ),
            "scarring_score": agent.get("scarring_score"),

            # Verification endpoints
            "verification_url": (
                f"https://getagentid.dev/agent/{agent_id}"
            ),
            "did_document_url": (
                f"https://getagentid.dev/agent/{agent_id}/did.json"
            ),
        },
    }

    # Attach ERC-8004 domain-specific reputation tags if present.
    reputation = {}
    for tag in _ERC8004_REPUTATION_TAGS:
        value = agent.get(f"reputation_{tag}") or agent.get(tag)
        if value is not None:
            reputation[tag] = value
    if reputation:
        ext["config"]["erc8004_reputation"] = reputation

    # Attach wallet bindings if public.
    wallets = agent.get("wallet_bindings") or []
    if wallets:
        ext["config"]["wallet_bindings"] = wallets

    # Strip None values for a cleaner payload.
    ext["config"] = {k: v for k, v in ext["config"].items() if v is not None}

    return ext


def _build_auth_schemes(agent: dict) -> list[dict]:
    """Map AgentID verification methods to A2A authentication schemes.

    Supports:
    - API key authentication (always available for registered agents)
    - Ed25519 challenge-response (available for L2+ agents)
    """
    schemes: list[dict] = [
        {
            "scheme": "apiKey",
            "in": "header",
            "name": "Authorization",
        },
    ]

    if agent.get("ed25519_key"):
        schemes.append(
            {
                "scheme": "ed25519-challenge",
                "description": (
                    "Ed25519 challenge-response authentication. "
                    "Request a challenge via GET /agents/{id}/challenge, "
                    "sign with your Ed25519 private key, "
                    "submit via POST /agents/{id}/verify-challenge."
                ),
                "challengeEndpoint": (
                    f"https://getagentid.dev/agents/"
                    f"{agent.get('agent_id', '')}/challenge"
                ),
                "verifyEndpoint": (
                    f"https://getagentid.dev/agents/"
                    f"{agent.get('agent_id', '')}/verify-challenge"
                ),
                "publicKey": agent["ed25519_key"],
            }
        )

    return schemes


# ---------------------------------------------------------------------------
# Agent card endpoint (per-agent, dynamic)
# ---------------------------------------------------------------------------


@router.get("/agent/{agent_id}/agent-card.json")
async def get_agent_card(agent_id: str, request: Request):
    """Generate an A2A-compatible agent card from an AgentID profile.

    The card is computed dynamically on every request (same pattern as
    the DID document endpoint) so trust scores, capabilities, and
    behavioral metrics are always current.

    Field mapping (AgentID → A2A Agent Card):
    ┌──────────────────────────────┬────────────────────────────────────┐
    │ AgentID field                │ A2A agent-card.json field          │
    ├──────────────────────────────┼────────────────────────────────────┤
    │ name                         │ name                               │
    │ description                  │ description                        │
    │ endpoint                     │ url                                │
    │ capabilities[]               │ skills[]                           │
    │ trust_level + trust_score    │ extensions[].config (agentid ns)   │
    │ ed25519_key                  │ authentication.schemes[]           │
    │ erc8004 reputation tags      │ extensions[].config.erc8004_rep    │
    │ wallet_bindings              │ extensions[].config.wallet_bindings│
    └──────────────────────────────┴────────────────────────────────────┘

    Returns:
        JSON conforming to A2A Agent Card schema with AgentID extensions.
    """
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    skills = _map_capabilities_to_skills(agent.get("capabilities", []))
    auth_schemes = _build_auth_schemes(agent)
    agentid_ext = _build_agentid_extension(agent, agent_id)

    agent_card = {
        "name": agent.get("name", "Unknown Agent"),
        "description": agent.get("description", ""),
        "url": agent.get("endpoint") or (
            f"https://getagentid.dev/agent/{agent_id}"
        ),
        "version": "1.0.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
            "stateTransitionHistory": False,
        },
        "authentication": {
            "schemes": auth_schemes,
        },
        "defaultInputModes": ["text", "application/json"],
        "defaultOutputModes": ["text", "application/json"],
        "skills": skills,
        "extensions": [agentid_ext],
        "provider": {
            "organization": agent.get("owner", "Unknown"),
            "url": f"https://getagentid.dev/agent/{agent_id}",
        },
    }

    # Compute ETag from card content for smart caching.
    card_bytes = str(agent_card).encode()
    etag = sha256(card_bytes).hexdigest()[:16]
    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    # Check If-None-Match for conditional requests.
    if_none_match = request.headers.get("if-none-match", "").strip('"')
    if if_none_match == etag:
        return JSONResponse(status_code=304, content=None)

    return JSONResponse(
        content=agent_card,
        media_type="application/json",
        headers={
            # Dynamic card — short cache, but ETag allows conditional revalidation.
            "Cache-Control": "public, max-age=60, must-revalidate",
            "Last-Modified": now,
            "ETag": f'"{etag}"',
            "X-AgentID": agent_id,
            "X-Trust-Level": str(agent.get("trust_level", 1)),
        },
    )


# ---------------------------------------------------------------------------
# Platform agent card (AgentID itself as an A2A service)
# ---------------------------------------------------------------------------


@router.get("/.well-known/agent-card.json")
async def get_platform_agent_card():
    """Serve AgentID platform's own A2A agent card.

    Describes AgentID itself as an A2A-compatible service — other agents
    can discover and interact with AgentID's capabilities (identity
    verification, trust scoring, agent discovery, A2A card generation).
    """
    return JSONResponse(
        content={
            "name": "AgentID",
            "description": (
                "The Identity & Discovery Layer for AI Agents. "
                "Provides agent registration, verification, trust scoring, "
                "cross-chain identity resolution, and A2A agent card "
                "generation from unified agent profiles."
            ),
            "url": "https://getagentid.dev",
            "version": "1.0.0",
            "capabilities": {
                "streaming": False,
                "pushNotifications": False,
            },
            "defaultInputModes": ["application/json"],
            "defaultOutputModes": ["application/json"],
            "skills": [
                {
                    "id": "agent-registration",
                    "name": "Agent Registration",
                    "description": (
                        "Register an AI agent with cryptographic identity "
                        "and optional ERC-8004 on-chain binding."
                    ),
                    "inputModes": ["application/json"],
                    "outputModes": ["application/json"],
                },
                {
                    "id": "identity-verification",
                    "name": "Identity Verification",
                    "description": (
                        "Verify an agent's identity via certificate, "
                        "Ed25519 challenge-response, or on-chain "
                        "registration lookup."
                    ),
                    "inputModes": ["application/json"],
                    "outputModes": ["application/json"],
                },
                {
                    "id": "trust-scoring",
                    "name": "Trust Scoring",
                    "description": (
                        "Compute and query agent trust scores based on "
                        "behavioral history, security capabilities, and "
                        "ERC-8004 on-chain reputation tags."
                    ),
                    "inputModes": ["application/json"],
                    "outputModes": ["application/json"],
                },
                {
                    "id": "agent-discovery",
                    "name": "Agent Discovery",
                    "description": (
                        "Search for agents by capability, owner, trust "
                        "level, or on-chain registration."
                    ),
                    "inputModes": ["text", "application/json"],
                    "outputModes": ["application/json"],
                },
                {
                    "id": "a2a-card-generation",
                    "name": "A2A Agent Card Generation",
                    "description": (
                        "Generate A2A-compatible agent cards from AgentID "
                        "profiles. Dynamic, computed on request with live "
                        "trust scores and behavioral metrics."
                    ),
                    "inputModes": ["application/json"],
                    "outputModes": ["application/json"],
                },
            ],
            "authentication": {
                "schemes": [
                    {
                        "scheme": "apiKey",
                        "in": "header",
                        "name": "Authorization",
                    },
                ],
            },
            "provider": {
                "organization": "AgentID",
                "url": "https://getagentid.dev",
            },
        },
        media_type="application/json",
    )
