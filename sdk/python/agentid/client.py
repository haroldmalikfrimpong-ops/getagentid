"""AgentID Python Client."""

import httpx
from typing import Optional


BASE_URL = "https://www.getagentid.dev/api/v1"


class AgentResult:
    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"AgentResult({self._data})"


class Agents:
    def __init__(self, client: 'Client'):
        self._client = client

    def register(self, name: str, description: str = "", capabilities: list = None,
                 platform: str = None, endpoint: str = None,
                 social_links: dict = None, limitations: list = None) -> AgentResult:
        """Register a new agent and get its certificate.

        Args:
            name: The agent's display name.
            description: Optional description of the agent.
            capabilities: Optional list of capability strings.
            platform: Optional platform identifier.
            endpoint: Optional endpoint URL.
            social_links: Optional dict with github, x, and/or website URLs.
            limitations: Optional list of known limitation strings.

        Returns:
            AgentResult with agent_id, certificate, keys, trust info.
        """
        data = {
            "name": name,
            "description": description,
            "capabilities": capabilities or [],
            "platform": platform,
            "endpoint": endpoint,
        }
        if social_links is not None:
            data["social_links"] = social_links
        if limitations is not None:
            data["limitations"] = limitations
        res = self._client._post("/agents/register", data)
        return AgentResult(res)

    def verify(self, agent_id: str) -> AgentResult:
        """Verify an agent's identity. No API key needed."""
        res = httpx.post(
            f"{self._client._base_url}/agents/verify",
            json={"agent_id": agent_id},
            timeout=10,
            follow_redirects=True,
        ).json()
        return AgentResult(res)

    def connect(self, from_agent: str, to_agent: str, payload: dict, message_type: str = "request") -> AgentResult:
        """Send a message from one agent to another. Both are verified first."""
        res = self._client._post("/agents/connect", {
            "from_agent": from_agent,
            "to_agent": to_agent,
            "message_type": message_type,
            "payload": payload,
        })
        return AgentResult(res)

    def respond(self, message_id: int, response: dict = None) -> AgentResult:
        """Respond to an incoming message."""
        res = self._client._post("/agents/message", {
            "message_id": message_id,
            "response": response or {"acknowledged": True},
        })
        return AgentResult(res)

    def inbox(self, agent_id: str, status: str = "pending") -> list:
        """Get incoming messages for an agent."""
        res = self._client._get(f"/agents/inbox?agent_id={agent_id}&status={status}")
        return [AgentResult(m) for m in res.get("messages", [])]

    def bind_ed25519(self, agent_id: str, ed25519_public_key: str) -> AgentResult:
        """Bind an Ed25519 public key to an agent and receive a signed certificate.

        This also auto-derives a Solana wallet address from the Ed25519 key.
        The response includes solana_address and solana_explorer_url.

        Args:
            agent_id: The agent's unique identifier.
            ed25519_public_key: 64-char hex Ed25519 public key.

        Returns:
            AgentResult with agent_id, ed25519_public_key, solana_address,
            solana_explorer_url, certificate, issued_at, expires_at, receipt.
        """
        res = self._client._post("/agents/bind-ed25519", {
            "agent_id": agent_id,
            "ed25519_public_key": ed25519_public_key,
        })
        return AgentResult(res)

    def get_balance(self, agent_id: str) -> AgentResult:
        """Get SOL and USDC balances for an agent's auto-derived Solana wallet.

        Public endpoint — no API key required.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentResult with agent_id, solana_address, cluster,
            balances (sol, usdc), explorer_url.
        """
        res = httpx.get(
            f"{self._client._base_url}/agents/balance",
            params={"agent_id": agent_id},
            timeout=15,
            follow_redirects=True,
        ).json()
        return AgentResult(res)

    def wallet(self, agent_id: str):
        """Get an AgentWallet instance for the given agent.

        The AgentWallet wraps balance checks, sending, and receiving
        into a clean interface where the agent IS the wallet.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentWallet instance.
        """
        from .agent_wallet import AgentWallet
        return AgentWallet(self._client, agent_id)

    def bind_wallet(self, agent_id: str, wallet_address: str, chain: str, signature: str) -> AgentResult:
        """Bind a crypto wallet to an agent.

        The caller must sign the message "AgentID:bind:{agent_id}:{wallet_address}"
        with their wallet private key and provide the hex signature.

        Args:
            agent_id: The agent's unique identifier.
            wallet_address: Wallet address (0x-prefixed for ETH/Polygon, base58 for Solana).
            chain: Blockchain — "ethereum", "solana", or "polygon".
            signature: Hex-encoded signature of the binding message.

        Returns:
            AgentResult with bound, agent_id, wallet_address, chain.
        """
        res = self._client._post("/agents/bind-wallet", {
            "agent_id": agent_id,
            "wallet_address": wallet_address,
            "chain": chain,
            "signature": signature,
        })
        return AgentResult(res)

    def get_wallet(self, agent_id: str) -> AgentResult:
        """Get the bound wallet for an agent (public, no API key needed).

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentResult with agent_id, wallet_bound. If bound, also
            wallet_address, chain, bound_at.
        """
        res = httpx.get(
            f"{self._client._base_url}/agents/wallet",
            params={"agent_id": agent_id},
            timeout=10,
            follow_redirects=True,
        ).json()
        return AgentResult(res)

    def discover(self, capability: str = None, owner: str = None,
                 credential_type: str = None, is_online: bool = None,
                 limit: int = 20) -> list:
        """Search for agents by capability, owner, credential type, or online status.

        Args:
            capability: Filter by capability string.
            owner: Filter by owner name.
            credential_type: Filter by credential type.
            is_online: If True, only return agents active in the last 24 hours.
            limit: Maximum number of results (default 20, max 100).

        Returns:
            List of AgentResult objects.
        """
        params = {"limit": limit}
        if capability:
            params["capability"] = capability
        if owner:
            params["owner"] = owner
        if credential_type:
            params["credential_type"] = credential_type
        if is_online is not None:
            params["is_online"] = str(is_online).lower()
        res = httpx.get(
            f"{self._client._base_url}/agents/discover",
            params=params,
            timeout=10,
            follow_redirects=True,
        ).json()
        return [AgentResult(a) for a in res.get("agents", [])]

    def attach_credential(self, agent_id: str, credential: dict) -> AgentResult:
        """Attach a verifiable credential to an agent.

        Args:
            agent_id: The agent's unique identifier.
            credential: Dict with type, issuer, issued_at, expires_at, signature.

        Returns:
            AgentResult with agent_id, credential, total_credentials.
        """
        res = self._client._post("/agents/credentials", {
            "agent_id": agent_id,
            "credential": credential,
        })
        return AgentResult(res)

    def list_credentials(self, agent_id: str) -> AgentResult:
        """List credentials for an agent. Public endpoint.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentResult with agent_id, credentials, total, expired.
        """
        res = httpx.get(
            f"{self._client._base_url}/agents/credentials",
            params={"agent_id": agent_id},
            timeout=10,
            follow_redirects=True,
        ).json()
        return AgentResult(res)

    def trust_header(self, agent_id: str) -> AgentResult:
        """Get a signed Agent-Trust-Score JWT header for an agent.

        Public endpoint — returns a short-lived JWT containing trust level,
        risk score, attestation count, and scarring score. Attach the JWT
        as an Agent-Trust-Score HTTP header when calling other services.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentResult with header (JWT string), payload (decoded), expires_in.
        """
        res = httpx.get(
            f"{self._client._base_url}/agents/trust-header",
            params={"agent_id": agent_id},
            timeout=15,
            follow_redirects=True,
        ).json()
        if "error" in res:
            raise Exception(res.get("error", "Failed to get trust header"))
        return AgentResult(res)

    def verify_proof(self, receipt_id: str) -> AgentResult:
        """Verify a receipt proof. Public endpoint — no API key required.

        Args:
            receipt_id: The unique receipt identifier.

        Returns:
            AgentResult with verified, receipt_id, action, agent, hashes,
            blockchain_anchor, attestation_level, verification.
        """
        res = httpx.get(
            f"{self._client._base_url.replace('/api/v1', '')}/proof/{receipt_id}",
            timeout=15,
            follow_redirects=True,
        ).json()
        return AgentResult(res)

    def credibility_packet(self, agent_id: str) -> AgentResult:
        """Get a signed credibility packet (trust resume) for an agent.

        Public endpoint — returns a portable, HMAC-signed bundle containing
        the agent's identity, trust level, verification count, receipts,
        and behavioural risk score.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentResult with identity, trust, verification_count, receipts, signature.
        """
        res = httpx.get(
            f"{self._client._base_url}/agents/credibility-packet",
            params={"agent_id": agent_id},
            timeout=15,
            follow_redirects=True,
        ).json()
        return AgentResult(res)

    def delegate(self, from_agent: str, to_agent: str, scope: list,
                 expires_at: str, max_spend: float = None) -> AgentResult:
        """Create a signed delegation from one agent to another.

        Args:
            from_agent: The delegator agent_id (must be owned by caller).
            to_agent: The delegatee agent_id.
            scope: List of allowed actions e.g. ["send_message", "make_payment"].
            expires_at: ISO timestamp when delegation expires.
            max_spend: Optional spending limit for the delegatee.

        Returns:
            AgentResult with delegation_id, delegation_proof, scope, expires_at.
        """
        data = {
            "from_agent": from_agent,
            "to_agent": to_agent,
            "scope": scope,
            "expires_at": expires_at,
        }
        if max_spend is not None:
            data["max_spend"] = max_spend
        res = self._client._post("/agents/delegate", data)
        return AgentResult(res)

    def list_delegations(self, agent_id: str) -> AgentResult:
        """List active delegations for an agent.

        Requires API key auth. Returns delegations where agent is
        either delegator or delegatee.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            AgentResult with delegations, active_count, total_count.
        """
        res = self._client._get(f"/agents/delegations?agent_id={agent_id}")
        return AgentResult(res)

    def update_metadata(self, agent_id: str, model_version: str = None,
                        prompt_hash: str = None,
                        social_links: dict = None) -> AgentResult:
        """Update model_version, prompt_hash, and/or social_links for an agent.

        Args:
            agent_id: The agent's unique identifier.
            model_version: Optional LLM model version string.
            prompt_hash: Optional SHA-256 hash of the system prompt.
            social_links: Optional dict with github, x, and/or website URLs.

        Returns:
            AgentResult with agent_id, model_version, prompt_hash, social_links, changes.
        """
        data = {"agent_id": agent_id}
        if model_version is not None:
            data["model_version"] = model_version
        if prompt_hash is not None:
            data["prompt_hash"] = prompt_hash
        if social_links is not None:
            data["social_links"] = social_links
        res = self._client._post("/agents/update-metadata", data)
        return AgentResult(res)


class Client:
    """AgentID API Client.

    Usage:
        client = agentid.Client(api_key="agentid_sk_...")
        result = client.agents.register(name="My Bot")
        print(result.agent_id)
    """

    def __init__(self, api_key: str = None, base_url: str = None):
        self._api_key = api_key
        self._base_url = base_url or BASE_URL
        self.agents = Agents(self)

    def _post(self, path: str, data: dict) -> dict:
        headers = {}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        res = httpx.post(f"{self._base_url}{path}", json=data, headers=headers, timeout=10, follow_redirects=True)
        if res.status_code >= 400:
            error = res.json().get("error", "Unknown error")
            raise Exception(f"AgentID API error: {error}")
        return res.json()

    def _get(self, path: str, params: dict = None) -> dict:
        headers = {}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        res = httpx.get(f"{self._base_url}{path}", params=params, headers=headers, timeout=10, follow_redirects=True)
        if res.status_code >= 400:
            error = res.json().get("error", "Unknown error")
            raise Exception(f"AgentID API error: {error}")
        return res.json()
