"""AgentID Daemon Agent SDK — identity layer for always-on autonomous agents.

Built for KAIROS-style agents: persistent daemons that act autonomously,
consolidate memory between sessions, and need verifiable identity for every
action they take while the user is away.

Usage:
    import agentid
    from agentid.daemon import DaemonAgent

    # Register a new daemon agent
    daemon = DaemonAgent.register(
        api_key="agentid_sk_...",
        name="My KAIROS Agent",
        capabilities=["monitor", "act", "report"],
        autonomy_level="semi-autonomous",
        heartbeat_interval=300,  # 5 minutes
    )

    # Sign an autonomous action
    receipt = daemon.sign_action("scraped 15 new listings")

    # Report a context epoch shift (e.g., after memory consolidation)
    daemon.report_context_shift(reason="autoDream memory consolidation")

    # Get trust header for outbound HTTP requests
    headers = daemon.trust_headers()
    requests.get("https://api.example.com/data", headers=headers)

    # Heartbeat — call periodically to prove liveness
    daemon.heartbeat()
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from .client import Client, AgentResult
from .ed25519 import Ed25519Identity


BASE_URL = "https://www.getagentid.dev/api/v1"


@dataclass
class DaemonAgent:
    """An always-on autonomous agent with AgentID identity.

    The daemon agent:
    - Registers as agent_type="daemon" on AgentID
    - Binds an Ed25519 key for cryptographic identity
    - Signs actions with Ed25519 for public verifiability
    - Tracks context_epoch for session continuity
    - Provides Agent-Trust-Score headers for outbound requests
    """

    agent_id: str
    name: str
    api_key: str
    identity: Ed25519Identity
    base_url: str = BASE_URL
    context_epoch: int = 0
    _prompt_hash: Optional[str] = None
    _model_version: Optional[str] = None
    _last_heartbeat: float = 0.0

    @classmethod
    def register(
        cls,
        api_key: str,
        name: str,
        description: str = "",
        capabilities: Optional[List[str]] = None,
        autonomy_level: str = "supervised",
        heartbeat_interval: int = 300,
        expected_active_hours: Optional[List[int]] = None,
        model_version: Optional[str] = None,
        prompt_hash: Optional[str] = None,
        base_url: str = BASE_URL,
    ) -> "DaemonAgent":
        """Register a new daemon agent on AgentID and bind an Ed25519 key.

        This is a two-step atomic operation:
          1. Register the agent with agent_type="daemon"
          2. Bind a fresh Ed25519 key (auto-derives Solana wallet)

        Args:
            api_key: AgentID API key (agentid_sk_...).
            name: Agent display name.
            description: What this daemon does.
            capabilities: List of capability strings.
            autonomy_level: "supervised", "semi-autonomous", or "fully-autonomous".
            heartbeat_interval: Expected seconds between heartbeats.
            expected_active_hours: [start_hour, end_hour] in UTC (default [0, 23] = always).
            model_version: LLM model version string.
            prompt_hash: SHA-256 hash of the system prompt.
            base_url: AgentID API base URL.

        Returns:
            DaemonAgent ready to sign actions and report context shifts.
        """
        client = Client(api_key=api_key, base_url=base_url)
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # Step 1: Register as daemon
        reg_data: Dict[str, Any] = {
            "name": name,
            "description": description,
            "capabilities": capabilities or [],
            "agent_type": "daemon",
            "autonomy_level": autonomy_level,
            "heartbeat_interval": heartbeat_interval,
        }
        if expected_active_hours:
            reg_data["expected_active_hours"] = expected_active_hours
        if model_version:
            reg_data["model_version"] = model_version
        if prompt_hash:
            reg_data["prompt_hash"] = prompt_hash

        res = httpx.post(
            f"{base_url}/agents/register",
            json=reg_data,
            headers=headers,
            timeout=15,
            follow_redirects=True,
        )
        if res.status_code >= 400:
            raise Exception(f"Registration failed: {res.json().get('error', 'Unknown')}")

        agent_data = res.json()
        agent_id = agent_data["agent_id"]

        # Step 2: Generate Ed25519 identity and bind it
        identity = Ed25519Identity.generate()

        bind_res = httpx.post(
            f"{base_url}/agents/bind-ed25519",
            json={
                "agent_id": agent_id,
                "ed25519_public_key": identity.ed25519_public_key_hex,
            },
            headers=headers,
            timeout=15,
            follow_redirects=True,
        )
        if bind_res.status_code >= 400:
            raise Exception(f"Ed25519 binding failed: {bind_res.json().get('error', 'Unknown')}")

        return cls(
            agent_id=agent_id,
            name=name,
            api_key=api_key,
            identity=identity,
            base_url=base_url,
            _model_version=model_version,
            _prompt_hash=prompt_hash,
        )

    @classmethod
    def from_existing(
        cls,
        api_key: str,
        agent_id: str,
        ed25519_seed: bytes,
        base_url: str = BASE_URL,
    ) -> "DaemonAgent":
        """Reconnect to an existing daemon agent using a stored Ed25519 seed.

        Args:
            api_key: AgentID API key.
            agent_id: Existing agent_id.
            ed25519_seed: 32-byte Ed25519 private key seed.
            base_url: AgentID API base URL.

        Returns:
            DaemonAgent with restored identity.
        """
        identity = Ed25519Identity.from_seed(ed25519_seed)

        # Verify the agent exists
        res = httpx.post(
            f"{base_url}/agents/verify",
            json={"agent_id": agent_id},
            timeout=10,
            follow_redirects=True,
        )
        data = res.json()
        name = data.get("name", "Unknown")

        return cls(
            agent_id=agent_id,
            name=name,
            api_key=api_key,
            identity=identity,
            base_url=base_url,
        )

    # ── Core Operations ──────────────────────────────────────────────

    def sign_action(self, description: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Sign an autonomous action and create a verifiable receipt.

        Every action the daemon takes gets recorded on AgentID with:
        - HMAC receipt (platform-signed)
        - Ed25519 signature (publicly verifiable)
        - Blockchain anchor (Solana memo, best-effort)
        - Context epoch (session continuity tracking)

        Args:
            description: Human-readable description of what the agent did.
            data: Optional structured data about the action.

        Returns:
            Dict containing the dual receipt.
        """
        # Create a verification with context_epoch to generate a receipt
        payload: Dict[str, Any] = {
            "agent_id": self.agent_id,
            "context_epoch": self.context_epoch,
            "action_ref": f"daemon-action-{self.agent_id}-{int(time.time())}",
        }

        res = httpx.post(
            f"{self.base_url}/agents/verify",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            timeout=15,
            follow_redirects=True,
        )

        result = res.json()

        # Also sign the action description with our Ed25519 key
        action_digest = hashlib.sha256(
            json.dumps({"description": description, "data": data, "timestamp": time.time()}).encode()
        ).hexdigest()
        ed25519_sig = self.identity.sign(action_digest.encode()).hex()

        return {
            "action": description,
            "action_digest": action_digest,
            "ed25519_signature": ed25519_sig,
            "ed25519_public_key": self.identity.ed25519_public_key_hex,
            "context_epoch": self.context_epoch,
            "receipt": result.get("receipt"),
            "agent_id": self.agent_id,
        }

    def report_context_shift(self, reason: str = "memory_consolidation") -> None:
        """Report that the agent's context/memory state has changed.

        Call this after:
        - Memory consolidation (autoDream)
        - Model version update
        - Prompt change
        - Long idle period

        This increments the context_epoch so downstream consumers
        can detect behavioral continuity breaks.

        Args:
            reason: Why the context shifted.
        """
        self.context_epoch += 1

        # If model version or prompt hash changed, update AgentID
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        # Verify with the new context_epoch to create a trail
        httpx.post(
            f"{self.base_url}/agents/verify",
            json={
                "agent_id": self.agent_id,
                "context_epoch": self.context_epoch,
                "context_hash": hashlib.sha256(reason.encode()).hexdigest(),
            },
            headers=headers,
            timeout=10,
            follow_redirects=True,
        )

    def update_model(self, model_version: str, prompt_hash: Optional[str] = None) -> None:
        """Report a model or prompt change. Auto-increments context_epoch.

        Args:
            model_version: New model version string.
            prompt_hash: New prompt hash (optional).
        """
        data: Dict[str, Any] = {
            "agent_id": self.agent_id,
            "model_version": model_version,
        }
        if prompt_hash:
            data["prompt_hash"] = prompt_hash

        httpx.post(
            f"{self.base_url}/agents/update-metadata",
            json=data,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            timeout=10,
            follow_redirects=True,
        )

        self._model_version = model_version
        if prompt_hash:
            self._prompt_hash = prompt_hash

        # Model change = context shift
        self.report_context_shift(reason=f"model_update:{model_version}")

    def heartbeat(self) -> Dict[str, Any]:
        """Send a heartbeat to prove liveness. Call this periodically.

        Returns:
            Verification result including trust level and context continuity.
        """
        self._last_heartbeat = time.time()

        res = httpx.post(
            f"{self.base_url}/agents/verify",
            json={
                "agent_id": self.agent_id,
                "context_epoch": self.context_epoch,
            },
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            timeout=10,
            follow_redirects=True,
        )
        return res.json()

    def trust_headers(self) -> Dict[str, str]:
        """Get HTTP headers for outbound requests with trust score attached.

        Returns a dict with the Agent-Trust-Score JWT header that any
        receiving service can verify without calling AgentID.

        Returns:
            Dict with 'Agent-Trust-Score' header.
        """
        res = httpx.get(
            f"{self.base_url}/agents/trust-header",
            params={"agent_id": self.agent_id},
            timeout=10,
            follow_redirects=True,
        )
        data = res.json()

        return {
            "Agent-Trust-Score": data.get("header", ""),
            "Agent-ID": self.agent_id,
            "Agent-DID": f"did:web:getagentid.dev:agent:{self.agent_id}",
        }

    def credibility_packet(self) -> Dict[str, Any]:
        """Get the signed credibility packet (portable trust resume).

        Returns:
            The full credibility packet including Ed25519 signature.
        """
        res = httpx.get(
            f"{self.base_url}/agents/credibility-packet",
            params={"agent_id": self.agent_id},
            timeout=15,
            follow_redirects=True,
        )
        return res.json()

    # ── Serialization ────────────────────────────────────────────────

    @property
    def seed(self) -> bytes:
        """The 32-byte Ed25519 seed. Store this securely to reconnect later."""
        return self.identity.seed

    def to_dict(self) -> Dict[str, Any]:
        """Export daemon state (no private key material)."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "agent_type": "daemon",
            "ed25519_public_key": self.identity.ed25519_public_key_hex,
            "solana_address": self.identity.solana_address,
            "context_epoch": self.context_epoch,
            "model_version": self._model_version,
            "prompt_hash": self._prompt_hash,
            "did": f"did:web:getagentid.dev:agent:{self.agent_id}",
        }

    def __repr__(self) -> str:
        return (
            f"DaemonAgent(id={self.agent_id}, name={self.name!r}, "
            f"epoch={self.context_epoch}, key={self.identity.ed25519_public_key_hex[:16]}...)"
        )
