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
