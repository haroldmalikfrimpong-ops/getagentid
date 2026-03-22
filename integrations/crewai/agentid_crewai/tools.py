"""CrewAI tool wrappers for the AgentID API.

Each tool subclasses ``crewai.tools.BaseTool`` so it can be handed directly to
any CrewAI ``Agent`` via its ``tools=[]`` parameter.

All tools require an **AgentID API key** (``AGENTID_API_KEY`` env-var or
passed explicitly).  The optional ``AGENTID_BASE_URL`` env-var overrides the
default ``https://getagentid.dev/api/v1`` endpoint.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from agentid_crewai.client import AgentIDClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client(api_key: Optional[str] = None, base_url: Optional[str] = None) -> AgentIDClient:
    """Resolve API key from arg -> env-var and return an AgentIDClient."""
    key = api_key or os.environ.get("AGENTID_API_KEY", "")
    if not key:
        raise ValueError(
            "AgentID API key is required.  "
            "Set the AGENTID_API_KEY environment variable or pass api_key= when "
            "constructing the tool."
        )
    url = base_url or os.environ.get("AGENTID_BASE_URL")
    return AgentIDClient(api_key=key, base_url=url)


def _json_dump(obj: Any) -> str:
    """Pretty-print a dict/list as JSON so the LLM can parse it easily."""
    return json.dumps(obj, indent=2, default=str)


# ===================================================================
# 1. Register Tool
# ===================================================================

class RegisterInput(BaseModel):
    """Input schema for AgentIDRegisterTool."""
    name: str = Field(..., description="Human-readable name for the new agent.")
    description: str = Field(
        default="",
        description="Short description of what the agent does.",
    )
    capabilities: Optional[List[str]] = Field(
        default=None,
        description='List of capability tags, e.g. ["code-review", "summarization"].',
    )
    platform: Optional[str] = Field(
        default=None,
        description="Platform the agent runs on, e.g. 'crewai', 'langchain'.",
    )
    endpoint: Optional[str] = Field(
        default=None,
        description="Optional callback URL where the agent can receive messages.",
    )


class AgentIDRegisterTool(BaseTool):
    """Register a new AI agent with AgentID and receive its identity certificate.

    Returns the agent_id, certificate, public/private key pair, and metadata.
    Requires an AgentID API key (Bearer token).
    """

    name: str = "agentid_register"
    description: str = (
        "Register a new AI agent with AgentID to obtain a unique agent_id and "
        "cryptographic identity certificate. Provide a name and optionally a "
        "description, capabilities list, platform, and endpoint URL."
    )
    args_schema: Type[BaseModel] = RegisterInput

    # Optional overrides — set at construction time
    api_key: Optional[str] = None
    base_url: Optional[str] = None

    def _run(
        self,
        name: str,
        description: str = "",
        capabilities: Optional[List[str]] = None,
        platform: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> str:
        try:
            client = _get_client(self.api_key, self.base_url)
            result = client.register(
                name=name,
                description=description,
                capabilities=capabilities,
                platform=platform or "crewai",
                endpoint=endpoint,
            )
            return _json_dump(result)
        except Exception as exc:
            return f"Error registering agent: {exc}"


# ===================================================================
# 2. Verify Tool
# ===================================================================

class VerifyInput(BaseModel):
    """Input schema for AgentIDVerifyTool."""
    agent_id: str = Field(
        ..., description="The agent_id to verify (e.g. 'agent_abc123xyz')."
    )


class AgentIDVerifyTool(BaseTool):
    """Verify an AI agent's identity via AgentID.

    Returns whether the agent is verified, its trust score, certificate
    validity, capabilities, and owner information.  No API key is needed
    for verification — it is a public endpoint.
    """

    name: str = "agentid_verify"
    description: str = (
        "Verify an AI agent's identity using its agent_id. Returns "
        "verification status, trust score, certificate validity, "
        "capabilities, and owner. Use this before trusting any agent."
    )
    args_schema: Type[BaseModel] = VerifyInput

    api_key: Optional[str] = None
    base_url: Optional[str] = None

    def _run(self, agent_id: str) -> str:
        try:
            client = _get_client(
                api_key=self.api_key or "public",  # verify is unauthenticated
                base_url=self.base_url,
            )
            result = client.verify(agent_id=agent_id)
            return _json_dump(result)
        except Exception as exc:
            return f"Error verifying agent: {exc}"


# ===================================================================
# 3. Discover Tool
# ===================================================================

class DiscoverInput(BaseModel):
    """Input schema for AgentIDDiscoverTool."""
    capability: Optional[str] = Field(
        default=None,
        description="Filter agents by capability keyword, e.g. 'summarization'.",
    )
    owner: Optional[str] = Field(
        default=None,
        description="Filter agents by owner / organisation name.",
    )
    limit: int = Field(
        default=20,
        description="Maximum number of agents to return (1-100).",
        ge=1,
        le=100,
    )


class AgentIDDiscoverTool(BaseTool):
    """Discover other AI agents registered on AgentID.

    Search by capability, owner, or both.  Returns a list of matching
    agents with their IDs, names, capabilities, trust scores, etc.
    This is a public endpoint — no API key is strictly required.
    """

    name: str = "agentid_discover"
    description: str = (
        "Search for AI agents registered on AgentID. Filter by capability "
        "keyword or owner name. Returns a list of agents with their IDs, "
        "names, trust scores, and capabilities."
    )
    args_schema: Type[BaseModel] = DiscoverInput

    api_key: Optional[str] = None
    base_url: Optional[str] = None

    def _run(
        self,
        capability: Optional[str] = None,
        owner: Optional[str] = None,
        limit: int = 20,
    ) -> str:
        try:
            client = _get_client(
                api_key=self.api_key or "public",
                base_url=self.base_url,
            )
            result = client.discover(
                capability=capability,
                owner=owner,
                limit=limit,
            )
            return _json_dump(result)
        except Exception as exc:
            return f"Error discovering agents: {exc}"


# ===================================================================
# 4. Connect Tool
# ===================================================================

class ConnectInput(BaseModel):
    """Input schema for AgentIDConnectTool."""
    from_agent: str = Field(
        ..., description="The agent_id of the sending agent (must be yours)."
    )
    to_agent: str = Field(
        ..., description="The agent_id of the receiving agent."
    )
    payload: Dict[str, Any] = Field(
        ..., description="The message payload to send (arbitrary JSON object)."
    )
    message_type: str = Field(
        default="request",
        description="Message type: 'request', 'response', 'notification', etc.",
    )


class AgentIDConnectTool(BaseTool):
    """Send a verified message from one agent to another via AgentID.

    Both agents are verified before the message is delivered.  Returns
    a trust_check indicating whether both parties are verified and a
    recommendation for data exchange safety.
    """

    name: str = "agentid_connect"
    description: str = (
        "Send a verified message from one AI agent to another through "
        "AgentID. Both agents' identities are checked first. Provide "
        "from_agent, to_agent, a payload dict, and an optional message_type."
    )
    args_schema: Type[BaseModel] = ConnectInput

    api_key: Optional[str] = None
    base_url: Optional[str] = None

    def _run(
        self,
        from_agent: str,
        to_agent: str,
        payload: Dict[str, Any],
        message_type: str = "request",
    ) -> str:
        try:
            client = _get_client(self.api_key, self.base_url)
            result = client.connect(
                from_agent=from_agent,
                to_agent=to_agent,
                payload=payload,
                message_type=message_type,
            )
            return _json_dump(result)
        except Exception as exc:
            return f"Error connecting agents: {exc}"
