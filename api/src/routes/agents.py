"""Agent API routes — register, verify, discover."""

from fastapi import APIRouter, HTTPException
from ..models.agent import AgentRegister, VerifyRequest, VerifyResponse
from ..services import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/register")
async def register(req: AgentRegister):
    """Register a new agent and get its certificate + keypair."""
    result = await agent_service.register_agent(
        name=req.name,
        description=req.description,
        owner=req.owner,
        capabilities=req.capabilities,
        platform=req.platform,
        endpoint=req.endpoint,
    )
    return result


@router.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest):
    """Verify an agent's identity."""
    result = await agent_service.verify_agent(req.agent_id)
    return result


@router.get("/discover")
async def discover(capability: str = None, owner: str = None, limit: int = 20):
    """Search for agents by capability or owner."""
    agents = await agent_service.discover_agents(
        capability=capability,
        owner=owner,
        limit=limit,
    )
    return {"agents": agents, "count": len(agents)}


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get an agent's public profile."""
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    # Don't expose private fields
    return {
        "agent_id": agent["agent_id"],
        "name": agent["name"],
        "description": agent["description"],
        "owner": agent["owner"],
        "capabilities": agent.get("capabilities", []),
        "platform": agent.get("platform"),
        "trust_score": agent.get("trust_score", 0),
        "verified": agent.get("verified", False),
        "created_at": agent.get("created_at"),
        "last_active": agent.get("last_active"),
    }
