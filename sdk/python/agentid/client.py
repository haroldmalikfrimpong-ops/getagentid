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
                 platform: str = None, endpoint: str = None) -> AgentResult:
        """Register a new agent and get its certificate."""
        res = self._client._post("/agents/register", {
            "name": name,
            "description": description,
            "capabilities": capabilities or [],
            "platform": platform,
            "endpoint": endpoint,
        })
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

    def discover(self, capability: str = None, owner: str = None, limit: int = 20) -> list:
        """Search for agents by capability or owner."""
        params = {"limit": limit}
        if capability:
            params["capability"] = capability
        if owner:
            params["owner"] = owner
        res = httpx.get(
            f"{self._client._base_url}/agents/discover",
            params=params,
            timeout=10,
            follow_redirects=True,
        ).json()
        return [AgentResult(a) for a in res.get("agents", [])]


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
