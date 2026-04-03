"""A2A Agent Card generation endpoint.

Generates Google A2A-compatible agent cards from AgentID profiles,
enabling interoperability between AgentID's identity layer and the
A2A agent-to-agent protocol.

Spec: https://a2a-protocol.org/latest/specification/
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from ..services import agent_service

router = APIRouter(tags=["a2a"])


def _map_capabilities_to_skills(capabilities: list[str]) -> list[dict]:
    """Map AgentID capabilities to A2A skill objects."""
    return [
        {
            "id": cap.lower().replace(" ", "-"),
            "name": cap,
            "description": f"Agent capability: {cap}",
        }
        for cap in capabilities
    ]


def _trust_score_to_extensions(trust_score: float, agent_id: str) -> list[dict]:
    """Map AgentID trust score to A2A extensions."""
    return [
        {
            "uri": "https://getagentid.dev/extensions/trust/v1",
            "required": False,
            "config": {
                "trust_score": trust_score,
                "provider": "agentid",
                "agent_id": agent_id,
                "verification_url": f"https://getagentid.dev/agent/{agent_id}",
            },
        }
    ]


@router.get("/agent/{agent_id}/agent-card.json")
async def get_agent_card(agent_id: str):
    """Generate an A2A-compatible agent card from an AgentID profile.

    Maps AgentID fields to A2A Agent Card spec:
    - name → name
    - description → description
    - capabilities → skills[]
    - endpoint → url
    - trust_score → extensions[] (trust extension)
    - agent_id → extensions[] (verification link)

    Returns:
        JSON conforming to A2A Agent Card schema.
    """
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_card = {
        "name": agent.get("name", "Unknown Agent"),
        "description": agent.get("description", ""),
        "url": agent.get("endpoint", f"https://getagentid.dev/agent/{agent_id}"),
        "version": "1.0.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
        },
        "skills": _map_capabilities_to_skills(
            agent.get("capabilities", [])
        ),
        "extensions": _trust_score_to_extensions(
            agent.get("trust_score", 0.0),
            agent_id,
        ),
        "provider": {
            "organization": agent.get("owner", "Unknown"),
            "url": f"https://getagentid.dev/agent/{agent_id}",
        },
    }

    return JSONResponse(
        content=agent_card,
        media_type="application/json",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-AgentID": agent_id,
        },
    )


@router.get("/.well-known/agent-card.json")
async def get_platform_agent_card():
    """Serve AgentID platform's own A2A agent card.

    This describes AgentID itself as an A2A-compatible service —
    other agents can discover and interact with AgentID's capabilities
    (identity verification, trust scoring, agent discovery).
    """
    return JSONResponse(
        content={
            "name": "AgentID",
            "description": (
                "The Identity & Discovery Layer for AI Agents. "
                "Provides agent registration, verification, trust scoring, "
                "and cross-chain identity resolution."
            ),
            "url": "https://getagentid.dev",
            "version": "1.0.0",
            "capabilities": {
                "streaming": False,
                "pushNotifications": False,
            },
            "skills": [
                {
                    "id": "agent-registration",
                    "name": "Agent Registration",
                    "description": (
                        "Register an AI agent with cryptographic identity "
                        "and optional ERC-8004 on-chain binding."
                    ),
                },
                {
                    "id": "identity-verification",
                    "name": "Identity Verification",
                    "description": (
                        "Verify an agent's identity via certificate "
                        "and on-chain registration."
                    ),
                },
                {
                    "id": "trust-scoring",
                    "name": "Trust Scoring",
                    "description": (
                        "Compute and query agent trust scores based on "
                        "behavioral history and security capabilities."
                    ),
                },
                {
                    "id": "agent-discovery",
                    "name": "Agent Discovery",
                    "description": (
                        "Search for agents by capability, owner, "
                        "or trust level."
                    ),
                },
            ],
            "provider": {
                "organization": "AgentID",
                "url": "https://getagentid.dev",
            },
        },
        media_type="application/json",
    )
