"""Agent models — the core of AgentID."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AgentRegister(BaseModel):
    """Request to register a new agent."""
    name: str = Field(..., description="Agent name (e.g. 'Trading Bot')")
    description: str = Field(..., description="What this agent does")
    owner: str = Field(..., description="Who owns this agent")
    capabilities: list[str] = Field(default=[], description="What the agent can do")
    platform: Optional[str] = Field(None, description="Platform (e.g. 'telegram', 'web', 'api')")
    endpoint: Optional[str] = Field(None, description="Agent's API endpoint if any")


class AgentProfile(BaseModel):
    """Public agent profile — what others see."""
    agent_id: str
    name: str
    description: str
    owner: str
    capabilities: list[str]
    platform: Optional[str]
    trust_score: float = 0.0
    verified: bool = False
    created_at: str
    last_active: Optional[str] = None


class AgentCertificate(BaseModel):
    """Cryptographic certificate issued to an agent."""
    agent_id: str
    public_key: str
    certificate: str
    issued_at: str
    expires_at: str


class VerifyRequest(BaseModel):
    """Request to verify an agent's identity."""
    agent_id: str
    signature: Optional[str] = None


class VerifyResponse(BaseModel):
    """Verification result."""
    verified: bool
    agent_id: str
    name: str
    owner: str
    trust_score: float
    capabilities: list[str]
    certificate_valid: bool
    message: str
