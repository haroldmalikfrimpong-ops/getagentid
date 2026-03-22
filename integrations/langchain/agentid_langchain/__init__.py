"""AgentID LangChain Integration — identity tools for AI agents."""

from .tools import (
    AgentIDRegisterTool,
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDConnectTool,
)
from .toolkit import AgentIDToolkit

__version__ = "0.1.0"
__all__ = [
    "AgentIDRegisterTool",
    "AgentIDVerifyTool",
    "AgentIDDiscoverTool",
    "AgentIDConnectTool",
    "AgentIDToolkit",
]
