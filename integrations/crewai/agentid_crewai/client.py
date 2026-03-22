"""Thin HTTP client for the AgentID API.

This is a self-contained client so the CrewAI integration has zero dependency
on the core ``getagentid`` SDK — users only need to ``pip install agentid-crewai``.
"""

from __future__ import annotations

import httpx
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "https://getagentid.dev/api/v1"
_TIMEOUT = 15  # seconds


class AgentIDClient:
    """Minimal AgentID API client used internally by the CrewAI tools."""

    def __init__(self, api_key: str, base_url: str | None = None) -> None:
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")

    # -- helpers -------------------------------------------------------------

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def _post(self, path: str, json: Dict[str, Any]) -> Dict[str, Any]:
        resp = httpx.post(
            f"{self.base_url}{path}",
            json=json,
            headers=self._headers(),
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        data = resp.json()
        if resp.status_code >= 400:
            raise RuntimeError(
                f"AgentID API error ({resp.status_code}): "
                f"{data.get('error', 'Unknown error')}"
            )
        return data

    def _get(self, path: str, params: Dict[str, Any] | None = None) -> Dict[str, Any]:
        resp = httpx.get(
            f"{self.base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        data = resp.json()
        if resp.status_code >= 400:
            raise RuntimeError(
                f"AgentID API error ({resp.status_code}): "
                f"{data.get('error', 'Unknown error')}"
            )
        return data

    # -- public methods (one per API endpoint) -------------------------------

    def register(
        self,
        name: str,
        description: str = "",
        capabilities: Optional[List[str]] = None,
        platform: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """POST /agents/register — register a new agent and receive its certificate."""
        return self._post("/agents/register", {
            "name": name,
            "description": description,
            "capabilities": capabilities or [],
            "platform": platform,
            "endpoint": endpoint,
        })

    def verify(self, agent_id: str) -> Dict[str, Any]:
        """POST /agents/verify — verify an agent's identity (no auth required)."""
        resp = httpx.post(
            f"{self.base_url}/agents/verify",
            json={"agent_id": agent_id},
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        return resp.json()

    def discover(
        self,
        capability: Optional[str] = None,
        owner: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """GET /agents/discover — search for agents by capability or owner."""
        params: Dict[str, Any] = {"limit": min(limit, 100)}
        if capability:
            params["capability"] = capability
        if owner:
            params["owner"] = owner
        resp = httpx.get(
            f"{self.base_url}/agents/discover",
            params=params,
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        return resp.json()

    def connect(
        self,
        from_agent: str,
        to_agent: str,
        payload: Dict[str, Any],
        message_type: str = "request",
    ) -> Dict[str, Any]:
        """POST /agents/connect — send a verified message between two agents."""
        return self._post("/agents/connect", {
            "from_agent": from_agent,
            "to_agent": to_agent,
            "message_type": message_type,
            "payload": payload,
        })
