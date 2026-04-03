"""AgentID API — The Identity & Discovery Layer for AI Agents."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes.agents import router as agents_router
from src.routes.a2a import router as a2a_router

app = FastAPI(
    title="AgentID",
    description="The Identity & Discovery Layer for AI Agents",
    version="0.1.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router, prefix="/v1")
app.include_router(a2a_router, prefix="/v1")


@app.get("/")
async def root():
    return {
        "name": "AgentID",
        "version": "0.1.0",
        "description": "The Identity & Discovery Layer for AI Agents",
        "docs": "/docs",
        "endpoints": {
            "register": "POST /v1/agents/register",
            "verify": "POST /v1/agents/verify",
            "discover": "GET /v1/agents/discover",
            "agent_card": "GET /v1/agent/{agent_id}/agent-card.json",
            "platform_card": "GET /v1/.well-known/agent-card.json",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
