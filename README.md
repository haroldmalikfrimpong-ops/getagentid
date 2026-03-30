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
| `POST` | `/api/v1/agents/credentials` | Attach verifiable credential |
| `GET` | `/api/v1/agents/credentials` | List agent credentials (public) |
| `GET` | `/api/v1/agents/credibility-packet` | Signed portable trust resume (public) |
| `GET` | `/api/v1/agents/trust-header` | Signed Agent-Trust-Score JWT header (public) |
| `GET` | `/proof/:receipt_id` | Public proof verification — anyone can verify any receipt |
| `POST` | `/api/v1/agents/delegate` | Create scoped delegation between agents |
| `GET` | `/api/v1/agents/delegations` | List active delegations |
| `POST` | `/api/v1/agents/update-metadata` | Update model version / prompt hash |
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
| **Payload drift** | Message payload structure changes significantly from baseline |
| **Model changed** | Underlying LLM model or system prompt hash changes — detects supply chain attacks |

Each anomaly carries a severity (`low`, `medium`, `high`) and feeds into a **risk score** (0-100) that other agents can check before interacting.

```python
# Check any agent's behavioural profile
check = client.agents.verify("agent_abc123")
print(check.risk_score)      # 0 = clean, 100 = compromised
print(check.anomalies)       # Active alerts
```

**Why this matters:** Certificates prove who an agent is. Behavioural fingerprinting proves it's still acting like itself. A stolen credential with altered behaviour gets flagged. This is a layer most identity systems don't have.

## DID Support

Every agent gets a W3C-compatible Decentralized Identifier on registration:

```
did:web:getagentid.dev:agent:agent_abc123
```

This makes AgentID interoperable with the entire decentralized identity ecosystem — W3C DID Core, did:web, did:key, and any system that resolves DIDs.

## Verifiable Credentials

Third parties can attach qualification credentials to any agent:

```python
client.agents.attach_credential("agent_abc123", {
    "type": "gdpr-compliant",
    "issuer": "compliance-authority",
    "expires_at": "2027-12-31T23:59:59Z"
})

# Discover agents by credential
agents = client.agents.discover(credential_type="gdpr-compliant")
```

Identity answers "who is this agent?" — credentials answer "is this agent qualified?"

## Delegation Chains

Agents can delegate scoped authority to other agents with signed JWT proofs:

```python
client.agents.delegate(
    from_agent="agent_coordinator",
    to_agent="agent_specialist",
    scope=["send_message", "make_payment"],
    expires_at="2026-12-31T23:59:59Z",
    max_spend=5000
)
```

Delegations enforce `effectiveAuthority = min(delegation_scope, trust_level)` — a delegation can never grant more power than the agent already has.

## Credibility Packets

Portable, signed trust resumes that any system can verify offline:

```python
packet = client.agents.credibility_packet("agent_abc123")
print(packet.signature)           # HMAC-SHA256 signed
print(packet.verification_count)  # Lifetime verifications
print(packet.negative_signals)    # Historical incidents
print(packet.resolved_signals)    # Recovered incidents
print(packet.scarring_score)      # Permanent trust scars
```

An agent with resolved incidents is MORE trustworthy than one with zero history. Silence is suspicious.

## Agent-Trust-Score Header

A short-lived signed JWT that agents attach to HTTP requests so receiving services can evaluate trust at the transport layer — no round-trip to a registry needed.

```python
header = client.agents.trust_header("agent_abc123")
requests.get("https://example.com/api", headers={
    "Agent-Trust-Score": header.header
})
# Receiving service decodes the JWT to get trust_level, risk_score, scarring_score, etc.
```

See the full spec at `specs/agent-trust-score-header-v0.1.md`.

## Cryptographic Scarring

When an agent gets flagged (anomaly, revoked connection, failed verification), the incident is permanently recorded. Recovery costs more than first-time trust:

- `negative_signals` — lifetime count of all incidents
- `resolved_signals` — recovered incidents (trust positive)
- `scarring_score` — permanent record, never fully heals

This prevents agents from gaming the system by cycling through good and bad behaviour.

## Negative Signal Tracking

Full audit trail of every negative event across the platform:

| Event | When it fires |
|-------|--------------|
| `verification_failed` | Certificate invalid, agent inactive, admin unverify |
| `anomaly_detected` | Behavioural anomaly on verify, connect, or behaviour check |
| `connection_revoked` | High-risk anomaly blocks connection, admin deactivate |
| `incident_resolved` | Payment approved, agent unfrozen, admin re-verify |
| `api_key_created` | New API key generated |
| `api_key_revoked` | API key revoked |

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
| Starter | $29/mo | 500 | 50,000/month |
| Pro | $99/mo | 2,000 | 500,000/month |
| Enterprise | $5,000/mo | Unlimited | Unlimited |

## Tech Stack

- **Frontend:** Next.js, Tailwind CSS, Framer Motion
- **Backend:** Next.js API Routes (Vercel Serverless)
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Auth:** Supabase Auth + GitHub OAuth
- **Payments:** Stripe
- **SDK:** Python (httpx), Node.js (planned)
- **Crypto:** ECDSA P-256 + Ed25519 keypairs, JWT certificates, HMAC-SHA256 receipts
- **Blockchain:** Solana (Ed25519 identity, on-chain registry, dual receipts)
- **Identity:** W3C DID (did:web), Verifiable Credentials, delegation proofs
- **Security:** Behavioural fingerprinting, cryptographic scarring, negative signal tracking

## Test Suite

32 tests against the live API — 100% passing:

| Group | Tests | Status |
|-------|-------|--------|
| Identity | 3 | Passing |
| Trust & Registry | 3 | Passing |
| Communication | 4 | Passing |
| Security | 4 | Passing |
| Compliance | 2 | Passing |
| DID & Credentials | 4 | Passing |
| Signals & Credibility | 4 | Passing |
| Delegation & Metadata | 4 | Passing |
| Advanced Security | 4 | Passing |

## License

MIT

---

<p align="center">
  <a href="https://getagentid.dev">getagentid.dev</a> — The trust layer for AI agents
</p>
