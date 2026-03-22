"""AgentIDToolkit — convenience class that bundles all AgentID tools."""

from __future__ import annotations

from typing import List, Optional

from langchain_core.tools import BaseTool
from pydantic import Field

from .tools import (
    DEFAULT_BASE_URL,
    AgentIDRegisterTool,
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDConnectTool,
)


class AgentIDToolkit:
    """Convenience wrapper that creates all four AgentID tools at once.

    Usage::

        toolkit = AgentIDToolkit(api_key="agentid_sk_...")
        tools = toolkit.get_tools()
        # Pass `tools` to your LangChain agent
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url

    def get_tools(self) -> List[BaseTool]:
        """Return a list of all AgentID LangChain tools.

        If no ``api_key`` was provided, tools that require authentication
        (register, connect) are omitted so agents cannot accidentally call
        them and receive auth errors.
        """
        tools: List[BaseTool] = [
            AgentIDVerifyTool(base_url=self.base_url),
            AgentIDDiscoverTool(base_url=self.base_url),
        ]
        if self.api_key:
            tools.extend([
                AgentIDRegisterTool(api_key=self.api_key, base_url=self.base_url),
                AgentIDConnectTool(api_key=self.api_key, base_url=self.base_url),
            ])
        return tools
