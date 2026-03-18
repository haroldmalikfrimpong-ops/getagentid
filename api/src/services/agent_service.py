"""Agent service — register, verify, discover agents."""

from datetime import datetime, timezone
from ..database import get_admin
from ..crypto.keys import generate_agent_id, generate_keypair, issue_certificate, verify_certificate


async def register_agent(name, description, owner, capabilities=None, platform=None, endpoint=None):
    """Register a new agent and issue its certificate."""
    agent_id = generate_agent_id()
    private_key, public_key = generate_keypair()

    cert_data = issue_certificate(
        agent_id=agent_id,
        name=name,
        owner=owner,
        capabilities=capabilities or [],
        public_key=public_key,
    )

    db = get_admin()
    if db:
        db.table("agents").insert({
            "agent_id": agent_id,
            "name": name,
            "description": description,
            "owner": owner,
            "capabilities": capabilities or [],
            "platform": platform,
            "endpoint": endpoint,
            "public_key": public_key,
            "certificate": cert_data["certificate"],
            "trust_score": 0.0,
            "verified": False,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    return {
        "agent_id": agent_id,
        "name": name,
        "private_key": private_key,
        "public_key": public_key,
        "certificate": cert_data["certificate"],
        "issued_at": cert_data["issued_at"],
        "expires_at": cert_data["expires_at"],
    }


async def verify_agent(agent_id):
    """Verify an agent's identity and return trust info."""
    db = get_admin()
    if not db:
        return {"verified": False, "message": "Database not available"}

    result = db.table("agents").select("*").eq("agent_id", agent_id).execute()
    if not result.data:
        return {
            "verified": False,
            "agent_id": agent_id,
            "name": "",
            "owner": "",
            "trust_score": 0,
            "capabilities": [],
            "certificate_valid": False,
            "message": "Agent not found",
        }

    agent = result.data[0]

    cert_check = verify_certificate(agent.get("certificate", ""))

    # Update last_active
    db.table("agents").update({
        "last_active": datetime.now(timezone.utc).isoformat()
    }).eq("agent_id", agent_id).execute()

    return {
        "verified": cert_check["valid"] and agent.get("active", False),
        "agent_id": agent_id,
        "name": agent["name"],
        "owner": agent["owner"],
        "trust_score": agent.get("trust_score", 0),
        "capabilities": agent.get("capabilities", []),
        "certificate_valid": cert_check["valid"],
        "message": "Agent verified" if cert_check["valid"] else cert_check.get("error", "Invalid"),
    }


async def discover_agents(capability=None, owner=None, limit=20):
    """Search for agents by capability or owner."""
    db = get_admin()
    if not db:
        return []

    query = db.table("agents").select("agent_id, name, description, owner, capabilities, platform, trust_score, verified, created_at, last_active").eq("active", True)

    if owner:
        query = query.eq("owner", owner)

    result = query.limit(limit).execute()
    agents = result.data or []

    if capability:
        agents = [a for a in agents if capability.lower() in [c.lower() for c in a.get("capabilities", [])]]

    return agents


async def get_agent(agent_id):
    """Get a single agent's profile."""
    db = get_admin()
    if not db:
        return None

    result = db.table("agents").select("*").eq("agent_id", agent_id).execute()
    if result.data:
        return result.data[0]
    return None
