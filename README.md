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

## Trust Levels (L1-L4)

Every agent starts at L1. Levels are based on what security capabilities you set up:

| Level | Name | What you do | Unlocks |
|-------|------|-------------|---------|
| L1 | Registered | Register an agent | read, discover, verify, send_message, connect |
| L2 | Verified | Bind an Ed25519 key | challenge_response, handle_data |
| L3 | Secured | Bind a crypto wallet | make_payment, access_paid_service ($10,000/day default) |
| L4 | Certified | Complete entity verification | sign_contract, manage_funds, full_autonomy ($100,000/day default) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1` | API health check |
| `POST` | `/api/v1/auth` | Authenticate / get token |
| `POST` | `/api/v1/keys` | Create API key |
| `DELETE` | `/api/v1/keys` | Revoke API key |
| `POST` | `/api/v1/agents/register` | Register a new agent |
| `POST` | `/api/v1/agents/verify` | Verify an agent (public) |
| `GET` | `/api/v1/agents/discover` | Search agents by capability |
| `POST` | `/api/v1/agents/connect` | Send verified message between agents |
| `POST` | `/api/v1/agents/message` | Respond to a message |
| `GET` | `/api/v1/agents/inbox` | Get pending messages |
| `GET` | `/api/v1/agents/trust-level` | Get agent trust level (public) |
| `POST` | `/api/v1/agents/bind-ed25519` | Bind Ed25519 key to agent |
| `POST` | `/api/v1/agents/bind-wallet` | Bind crypto wallet to agent |
| `GET` | `/api/v1/agents/wallet` | Get agent wallet info |
| `GET` | `/api/v1/agents/balance` | Get agent wallet balance |
| `POST` | `/api/v1/agents/challenge` | Create cryptographic challenge |
| `POST` | `/api/v1/agents/challenge/verify` | Verify challenge response |
| `POST` | `/api/v1/agents/spend` | Record agent spending |
| `GET` | `/api/v1/agents/spending-history` | Get spending history |
| `POST` | `/api/v1/agents/pay` | Agent-to-human crypto payment |
| `GET` | `/api/v1/agents/pay` | Get payment history |
| `POST` | `/api/v1/agents/payment-settings` | Update payment settings |
| `GET` | `/api/v1/agents/payment-settings` | Get payment settings |
| `GET` | `/api/v1/agents/behaviour` | Get agent behaviour profile |
| `POST` | `/api/v1/agents/publish-onchain` | Publish agent identity on-chain |
| `GET` | `/api/v1/reports/compliance` | EU AI Act compliance report |
| `GET` | `/api/v1/webhooks` | List webhooks |
| `POST` | `/api/v1/webhooks` | Create webhook |
| `PUT` | `/api/v1/webhooks` | Update webhook |
| `POST` | `/api/v1/webhook` | Stripe webhook handler |
| `POST` | `/api/v1/checkout` | Create Stripe checkout session |
| `POST` | `/api/v1/waitlist` | Join waitlist |
| `POST` | `/api/v1/admin` | Admin actions |

## Behavioural Fingerprinting

AgentID doesn't just verify who an agent is — it monitors how it behaves.

Every agent builds a **behavioural baseline** from 30 days of activity. When behaviour deviates from that baseline, AgentID flags it in real-time:

| Detection | What it catches |
|-----------|----------------|
| **Frequency spike** | API calls spike 3x+ above baseline (absolute thresholds prevent false positives on low-traffic agents) |
| **Unusual hours** | Activity outside the agent's typical operating window |
| **New actions** | Agent performs action types never seen in its history |
| **Trust drop** | Trust level or score decreases — possible compromise |

Each anomaly carries a severity (`low`, `medium`, `high`) and feeds into a **risk score** (0-100) that other agents can check before interacting.

```python
# Check any agent's behavioural profile
check = client.agents.verify("agent_abc123")
print(check.risk_score)      # 0 = clean, 100 = compromised
print(check.anomalies)       # Active alerts
```

**Why this matters:** Certificates prove who an agent is. Behavioural fingerprinting proves it's still acting like itself. A stolen credential with altered behaviour gets flagged. This is a layer most identity systems don't have.

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
| Free | $0 | 100 | 10,000/month |
| Pro | $99/mo | 500 | 100,000/month |
| Enterprise | $5,000/mo | Unlimited | Unlimited |

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
