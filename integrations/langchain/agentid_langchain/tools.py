"""LangChain BaseTool subclasses wrapping the AgentID API."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Type

import httpx
from langchain_core.callbacks import CallbackManagerForToolRun, AsyncCallbackManagerForToolRun
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

DEFAULT_BASE_URL = "https://getagentid.dev/api/v1"


# ---------------------------------------------------------------------------
# Pydantic input schemas
# ---------------------------------------------------------------------------

class RegisterInput(BaseModel):
    """Input for registering a new agent with AgentID."""

    name: str = Field(description="Name of the agent to register.")
    description: str = Field(
        default="",
        description="Short human-readable description of what the agent does.",
    )
    capabilities: List[str] = Field(
        default_factory=list,
        description="List of capability tags, e.g. ['search', 'code-review'].",
    )
    platform: Optional[str] = Field(
        default=None,
        description="Platform the agent runs on, e.g. 'langchain', 'autogen'.",
    )
    endpoint: Optional[str] = Field(
        default=None,
        description="Optional webhook/callback URL for the agent.",
    )


class VerifyInput(BaseModel):
    """Input for verifying an agent's identity."""

    agent_id: str = Field(description="The AgentID identifier to verify (e.g. 'agid_...').")


class DiscoverInput(BaseModel):
    """Input for discovering agents in the AgentID registry."""

    capability: Optional[str] = Field(
        default=None,
        description="Filter agents by capability tag, e.g. 'summarization'.",
    )
    owner: Optional[str] = Field(
        default=None,
        description="Filter agents by owner/organization name.",
    )
    limit: int = Field(
        default=20,
        description="Maximum number of agents to return (1-100).",
    )


class ConnectInput(BaseModel):
    """Input for sending a message between two agents."""

    from_agent: str = Field(description="AgentID of the sending agent.")
    to_agent: str = Field(description="AgentID of the receiving agent.")
    payload: Dict[str, Any] = Field(
        description="Message payload to send, e.g. {'task': 'summarize', 'content': '...'}.",
    )
    message_type: str = Field(
        default="request",
        description="Message type: 'request', 'response', or 'broadcast'.",
    )


# ---------------------------------------------------------------------------
# Helper: HTTP calls
# ---------------------------------------------------------------------------

def _post(base_url: str, path: str, data: dict, api_key: Optional[str] = None) -> dict:
    """Synchronous POST helper."""
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    resp = httpx.post(
        f"{base_url}{path}",
        json=data,
        headers=headers,
        timeout=15,
        follow_redirects=True,
    )
    body = resp.json()
    if resp.status_code >= 400:
        error = body.get("error", "Unknown error")
        raise RuntimeError(f"AgentID API error ({resp.status_code}): {error}")
    return body


async def _apost(base_url: str, path: str, data: dict, api_key: Optional[str] = None) -> dict:
    """Async POST helper."""
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        resp = await client.post(
            f"{base_url}{path}",
            json=data,
            headers=headers,
            timeout=15,
        )
    body = resp.json()
    if resp.status_code >= 400:
        error = body.get("error", "Unknown error")
        raise RuntimeError(f"AgentID API error ({resp.status_code}): {error}")
    return body


def _get(base_url: str, path: str, params: dict, api_key: Optional[str] = None) -> dict:
    """Synchronous GET helper."""
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    resp = httpx.get(
        f"{base_url}{path}",
        params=params,
        headers=headers,
        timeout=15,
        follow_redirects=True,
    )
    body = resp.json()
    if resp.status_code >= 400:
        error = body.get("error", "Unknown error")
        raise RuntimeError(f"AgentID API error ({resp.status_code}): {error}")
    return body


async def _aget(base_url: str, path: str, params: dict, api_key: Optional[str] = None) -> dict:
    """Async GET helper."""
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        resp = await client.get(
            f"{base_url}{path}",
            params=params,
            headers=headers,
            timeout=15,
        )
    body = resp.json()
    if resp.status_code >= 400:
        error = body.get("error", "Unknown error")
        raise RuntimeError(f"AgentID API error ({resp.status_code}): {error}")
    return body


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

class AgentIDRegisterTool(BaseTool):
    """Register a new AI agent with AgentID and receive its identity certificate.

    Requires an API key. Returns the agent_id, certificate, and key pair.
    """

    name: str = "agentid_register"
    description: str = (
        "Register a new AI agent with the AgentID registry. "
        "Returns a unique agent_id, cryptographic certificate, and key pair. "
        "Use this when you need to create a verifiable identity for an agent."
    )
    args_schema: Type[BaseModel] = RegisterInput

    api_key: str = Field(description="AgentID API key (Bearer token).")
    base_url: str = Field(default=DEFAULT_BASE_URL, description="AgentID API base URL.")

    def _run(
        self,
        name: str,
        description: str = "",
        capabilities: List[str] | None = None,
        platform: str | None = None,
        endpoint: str | None = None,
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        result = _post(
            self.base_url,
            "/agents/register",
            {
                "name": name,
                "description": description,
                "capabilities": capabilities or [],
                "platform": platform,
                "endpoint": endpoint,
            },
            api_key=self.api_key,
        )
        return json.dumps(result, indent=2)

    async def _arun(
        self,
        name: str,
        description: str = "",
        capabilities: List[str] | None = None,
        platform: str | None = None,
        endpoint: str | None = None,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        result = await _apost(
            self.base_url,
            "/agents/register",
            {
                "name": name,
                "description": description,
                "capabilities": capabilities or [],
                "platform": platform,
                "endpoint": endpoint,
            },
            api_key=self.api_key,
        )
        return json.dumps(result, indent=2)


class AgentIDVerifyTool(BaseTool):
    """Verify an agent's identity by its AgentID.

    No API key required. Returns verification status, trust score, and certificate validity.
    """

    name: str = "agentid_verify"
    description: str = (
        "Verify an AI agent's identity using its AgentID. "
        "Returns whether the agent is verified, its trust score, certificate validity, "
        "and ownership details. No API key required. "
        "Use this before trusting or interacting with an unknown agent."
    )
    args_schema: Type[BaseModel] = VerifyInput

    base_url: str = Field(default=DEFAULT_BASE_URL, description="AgentID API base URL.")

    def _run(
        self,
        agent_id: str,
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        result = _post(
            self.base_url,
            "/agents/verify",
            {"agent_id": agent_id},
        )
        return json.dumps(result, indent=2)

    async def _arun(
        self,
        agent_id: str,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        result = await _apost(
            self.base_url,
            "/agents/verify",
            {"agent_id": agent_id},
        )
        return json.dumps(result, indent=2)


class AgentIDDiscoverTool(BaseTool):
    """Discover agents registered in the AgentID directory.

    No API key required. Supports filtering by capability and owner.
    """

    name: str = "agentid_discover"
    description: str = (
        "Search the AgentID registry for AI agents. "
        "Filter by capability (e.g. 'summarization') or owner. "
        "Returns a list of matching agents with their trust scores and details. "
        "Use this to find agents that can help with a specific task."
    )
    args_schema: Type[BaseModel] = DiscoverInput

    base_url: str = Field(default=DEFAULT_BASE_URL, description="AgentID API base URL.")

    def _run(
        self,
        capability: str | None = None,
        owner: str | None = None,
        limit: int = 20,
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        params: Dict[str, Any] = {"limit": limit}
        if capability:
            params["capability"] = capability
        if owner:
            params["owner"] = owner
        result = _get(self.base_url, "/agents/discover", params)
        return json.dumps(result, indent=2)

    async def _arun(
        self,
        capability: str | None = None,
        owner: str | None = None,
        limit: int = 20,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        params: Dict[str, Any] = {"limit": limit}
        if capability:
            params["capability"] = capability
        if owner:
            params["owner"] = owner
        result = await _aget(self.base_url, "/agents/discover", params)
        return json.dumps(result, indent=2)


class AgentIDConnectTool(BaseTool):
    """Send a verified message from one agent to another via AgentID.

    Requires an API key. Both agents are verified before the message is delivered.
    """

    name: str = "agentid_connect"
    description: str = (
        "Send a message from one AI agent to another through AgentID. "
        "Both agents' identities are verified before delivery. "
        "Returns a trust check indicating whether both sides are verified. "
        "Use this for secure agent-to-agent communication."
    )
    args_schema: Type[BaseModel] = ConnectInput

    api_key: str = Field(description="AgentID API key (Bearer token).")
    base_url: str = Field(default=DEFAULT_BASE_URL, description="AgentID API base URL.")

    def _run(
        self,
        from_agent: str,
        to_agent: str,
        payload: Dict[str, Any] | None = None,
        message_type: str = "request",
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        result = _post(
            self.base_url,
            "/agents/connect",
            {
                "from_agent": from_agent,
                "to_agent": to_agent,
                "message_type": message_type,
                "payload": payload or {},
            },
            api_key=self.api_key,
        )
        return json.dumps(result, indent=2)

    async def _arun(
        self,
        from_agent: str,
        to_agent: str,
        payload: Dict[str, Any] | None = None,
        message_type: str = "request",
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        result = await _apost(
            self.base_url,
            "/agents/connect",
            {
                "from_agent": from_agent,
                "to_agent": to_agent,
                "message_type": message_type,
                "payload": payload or {},
            },
            api_key=self.api_key,
        )
        return json.dumps(result, indent=2)
