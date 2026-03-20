<p align="center">
  <h1 align="center">AgentID</h1>
  <p align="center"><strong>The Identity & Discovery Layer for AI Agents</strong></p>
  <p align="center">
    <a href="https://getagentid.dev">Website</a> ·
    <a href="https://pypi.org/project/getagentid/">PyPI</a> ·
    <a href="https://getagentid.dev/registry">Registry</a> ·
    <a href="https://getagentid.dev/verify/agent_c5460451b4344268">Live Demo</a>
  </p>
</p>

---

Every website needs SSL. Every person needs a passport. **Every AI agent needs AgentID.**

AI agents can't verify each other. Any agent can pretend to be anyone. AgentID gives every agent a cryptographic identity — like SSL certificates for the agent economy.

## What is AgentID?

- **🔐 Agent Certificates** — Cryptographic proof of identity. Signed. Verifiable. Revocable.
- **🔍 Agent Registry** — Searchable directory of verified agents.
- **✓ Verification API** — One call to verify any agent. Real-time. Instant.
- **🔗 Agent-to-Agent** — Verified communication. Both sides checked before data moves.

## Quick Start

```bash
pip install getagentid
```

```python
from agentid import Client

client = Client(api_key="your-key")

# Register an agent
result = client.agents.register(
    name="My Trading Bot",
    capabilities=["trading", "gold-signals"]
)
print(result.agent_id)       # agent_abc123
print(result.certificate)    # Signed JWT

# Verify any agent
check = client.agents.verify("agent_abc123")
print(check.verified)        # True
print(check.owner)           # "Your Company"
print(check.trust_score)     # 0.94

# Agent-to-agent communication
msg = client.agents.connect(
    from_agent="agent_abc",
    to_agent="agent_xyz",
    payload={"action": "get_data"}
)
print(msg.trust_check)
# → TRUSTED — both agents verified. Safe to exchange data.
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/agents/register` | Register a new agent |
| `POST` | `/api/v1/agents/verify` | Verify an agent (public) |
| `GET` | `/api/v1/agents/discover` | Search agents by capability |
| `POST` | `/api/v1/agents/connect` | Send verified message between agents |
| `POST` | `/api/v1/agents/message` | Respond to a message |
| `GET` | `/api/v1/agents/inbox` | Get pending messages |

## Works With

AgentID is protocol-agnostic:

- Google A2A
- Anthropic MCP
- CrewAI
- LangChain
- AutoGen
- OpenAI Agents SDK
- Any HTTP-capable agent

## Architecture

```
Agent A → AgentID API → Verify → Agent B
              ↓
         Certificate Check
         Trust Score
         Owner Verification
              ↓
         TRUSTED / PARTIAL / UNTRUSTED
```

## Pricing

| Tier | Price | Agents | Verifications |
|------|-------|--------|---------------|
| Free | $0 | 5 | 1,000/month |
| Startup | $49/mo | 50 | 50,000/month |
| Enterprise | Custom | Unlimited | Unlimited |

## Tech Stack

- **Frontend:** Next.js, Tailwind CSS, Framer Motion
- **Backend:** Next.js API Routes (Vercel Serverless)
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Auth:** Supabase Auth + GitHub OAuth
- **Payments:** Stripe
- **SDK:** Python (httpx)
- **Crypto:** ECDSA P-256 keypairs, JWT certificates

## License

MIT

---

<p align="center">
  <a href="https://getagentid.dev">getagentid.dev</a> — The trust layer for AI agents
</p>
