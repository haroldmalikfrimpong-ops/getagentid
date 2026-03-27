"""AgentID RuntimeVerifier — Python implementation for WG integration tests.

Drop-in replacement for the stub in aeoess's test harness.
Calls AgentID's verify_agent_full() for DID resolution + entity verification,
then hits the AgentID API for trust score and trust level details.

Usage:
    verifier = RuntimeVerifier(api_key="your-key")
    result = await verifier.verify("did:agentid:agent-007", "abcdef1234...")
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List, Literal, Optional

import httpx

# AgentID SDK imports — resolve DID locally + get trust level info
from agentid.did import verify_agent_full, resolve_did
from agentid.trust_levels import (
    TrustLevel,
    calculate_trust_level,
    PERMISSIONS,
    SPENDING_LIMITS,
)

DEFAULT_BASE_URL = "https://getagentid.dev/api/v1"
_TIMEOUT = 15


@dataclass
class RuntimeVerification:
    """Result of a runtime verification check.

    Matches the RuntimeVerification interface expected by the WG test harness.
    """

    verified: bool = False
    trust_level: int = 1  # 1-4 (minimum L1 in new model)
    trust_score: float = 0.0
    permissions: List[str] = field(default_factory=list)
    spending_limit: int = 0
    did_resolution_status: Literal["live", "cached", "failed"] = "failed"
    entity_verified: bool = False
    # Cryptographic binding fields (WG feedback — desiorac)
    execution_timestamp: str = ""  # ISO 8601 UTC — when verification was performed
    pinned_public_key: str = ""    # Resolved public key at verification time
    scope: Optional[str] = None    # Delegation scope if known

    def to_dict(self) -> dict:
        return asdict(self)


class RuntimeVerifier:
    """Verifies an agent's DID and public key against the AgentID network.

    Implements the RuntimeVerifier interface expected by the WG integration test:
        verify(agent_did: str, agent_public_key: str) -> RuntimeVerification
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    async def verify(
        self,
        agent_did: str,
        agent_public_key: str,
    ) -> RuntimeVerification:
        """Verify an agent's DID and public key.

        1. Resolves the DID locally via verify_agent_full()
        2. Calls the AgentID API for trust score + trust level details
        3. Returns a RuntimeVerification with all fields populated
        """
        result = RuntimeVerification()

        # Bind execution timestamp immediately (ISO 8601 UTC)
        result.execution_timestamp = (
            datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        )

        # --- Step 1: Local DID resolution + entity check ---
        try:
            did_result = verify_agent_full(agent_did)
            did_valid = did_result.get("did_valid", False)

            if did_valid:
                result.did_resolution_status = "live"

                # Cross-check: resolved key must match the provided public key
                resolved_hex = did_result.get("ed25519_public_key", "")
                provided_hex = agent_public_key.lower().replace("0x", "")

                # Pin the resolved public key at verification time
                if resolved_hex:
                    result.pinned_public_key = resolved_hex.lower()

                if resolved_hex and resolved_hex.lower() != provided_hex:
                    # Key mismatch — DID resolved but key doesn't match
                    result.did_resolution_status = "failed"
                    return result
            else:
                result.did_resolution_status = "failed"
                return result

            # Entity verification from the full check
            entity_data = did_result.get("entity")
            if entity_data and isinstance(entity_data, dict) and "error" not in entity_data:
                result.entity_verified = entity_data.get("status") == "active"

        except Exception:
            result.did_resolution_status = "failed"
            # Fall through — try the API as a fallback

        # --- Step 2: Call AgentID API for trust score ---
        # Extract agent_id from the DID for the API call
        agent_id = _extract_agent_id(agent_did)
        if not agent_id:
            return result

        api_verification = await self._api_verify(agent_id)
        api_trust_level = await self._api_trust_level(agent_id)

        # --- Step 3: Merge API results into the verification ---
        if api_verification:
            result.verified = api_verification.get("verified", False)
            result.trust_score = float(api_verification.get("trust_score", 0.0))

            # If local DID check passed but API says not verified, still
            # trust the DID resolution status from step 1
            if not result.verified:
                result.did_resolution_status = "cached"

        if api_trust_level:
            level_int = int(api_trust_level.get("trust_level", 1))
            result.trust_level = max(1, min(4, level_int))
        else:
            # Calculate trust level locally from what we know
            result.trust_level = _calculate_level_from_score(
                result.trust_score,
                result.entity_verified,
            )

        # Set permissions and spending limit based on trust level
        try:
            tl = TrustLevel(result.trust_level)
            result.permissions = list(PERMISSIONS.get(tl, []))
            result.spending_limit = SPENDING_LIMITS.get(tl, 0)
        except ValueError:
            result.permissions = []
            result.spending_limit = 0

        return result

    async def _api_verify(self, agent_id: str) -> Optional[dict]:
        """POST /api/v1/agents/verify — get trust score and basic verification."""
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{self.base_url}/agents/verify",
                    json={"agent_id": agent_id},
                    headers=self._headers(),
                    follow_redirects=True,
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception:
            pass
        return None

    async def _api_trust_level(self, agent_id: str) -> Optional[dict]:
        """GET /api/v1/agents/trust-level?agent_id=xxx — get trust level details."""
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{self.base_url}/agents/trust-level",
                    params={"agent_id": agent_id},
                    headers=self._headers(),
                    follow_redirects=True,
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception:
            pass
        return None


def _extract_agent_id(did: str) -> Optional[str]:
    """Extract the agent_id from a DID string.

    Supports:
        did:agentid:<agent_id>  -> agent_id
        did:aps:<multibase>     -> the multibase string (used as lookup key)
        did:key:<multibase>     -> the multibase string
        did:web:<domain>        -> the domain
    """
    if did.startswith("did:agentid:"):
        return did[len("did:agentid:"):]
    if did.startswith("did:aps:"):
        return did[len("did:aps:"):]
    if did.startswith("did:key:"):
        return did[len("did:key:"):]
    if did.startswith("did:web:"):
        return did[len("did:web:"):]
    return None


def _calculate_level_from_score(trust_score: float, entity_verified: bool) -> int:
    """Rough trust level estimate when API is unavailable (fallback only).

    New model: levels are based on what's set up, not scores. But when the API
    is down and we only have a trust_score + entity_verified, we estimate:
    - L4 if entity_verified (entity verification is the L4 requirement)
    - L3 if score >= 0.7 (likely has wallet bound)
    - L2 if score >= 0.4 (likely has Ed25519 key)
    - L1 default (all registered agents are at least L1)
    """
    if entity_verified:
        return 4
    if trust_score >= 0.7:
        return 3
    if trust_score >= 0.4:
        return 2
    return 1  # minimum is L1 in new model, no L0
