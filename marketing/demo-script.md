# AgentID 60-Second Demo Video Script

**Format:** Screen recording with voiceover
**Post to:** Twitter/X, Reddit
**Total runtime:** 60 seconds

---

## Section 1: The Problem (0:00 - 0:08)

**Screen:** Dark terminal. Type the following slowly, letting it land:

```
curl https://some-agent.example.com/api/data
# Who is this agent? Is it legit? No way to know.
```

**Voiceover:**
"AI agents are everywhere. They call APIs, exchange data, make decisions. But right now, there's no way to verify who an agent actually is."

---

## Section 2: Landing Page (0:08 - 0:13)

**Screen:** Open browser. Navigate to `getagentid.dev`. Let the landing page load with its animations -- the holographic gradient title, the ecosystem badges (Google A2A, Anthropic MCP, CrewAI, LangChain), and the agent counter.

**Voiceover:**
"AgentID fixes that. It's a cryptographic identity layer for AI agents."

---

## Section 3: Register an Agent (0:13 - 0:25)

**Screen:** Switch to terminal. Type the following curl command:

```bash
curl -X POST https://getagentid.dev/api/v1/agents/register \
  -H "Authorization: Bearer agentid_sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ResearchBot",
    "capabilities": ["web-search", "summarization"],
    "platform": "langchain"
  }'
```

Then show the JSON response appearing instantly:

```json
{
  "agent_id": "ag_7Kx9mP2vLqW4",
  "name": "ResearchBot",
  "owner": "Acme Labs",
  "certificate": "eyJhbGciOi...",
  "public_key": "-----BEGIN PUBLIC KEY-----\nMFkw...",
  "issued_at": "2026-03-22T...",
  "expires_at": "2027-03-22T..."
}
```

**Voiceover:**
"Register an agent with one API call. You get back an agent ID, a signed certificate, and an ECDSA keypair. That's a full cryptographic identity in under a second."

---

## Section 4: Registry + Passport (0:25 - 0:32)

**Screen:** Switch to browser. Navigate to `getagentid.dev/registry`. Show the public registry page with the search bar and list of agents. Click on "ResearchBot" to open its passport page at `/verify/ag_7Kx9mP2vLqW4`. Show the green checkmark verification badge, the agent details (name, owner, capabilities, trust score), and the "Agent Verified" status.

**Voiceover:**
"Every agent gets a public passport in the registry. Anyone can look it up and verify the identity is real."

---

## Section 5: Verify via API (0:32 - 0:40)

**Screen:** Switch to terminal. Type:

```bash
curl -X POST https://getagentid.dev/api/v1/agents/verify \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "ag_7Kx9mP2vLqW4"}'
```

Show the response:

```json
{
  "verified": true,
  "agent_id": "ag_7Kx9mP2vLqW4",
  "name": "ResearchBot",
  "owner": "Acme Labs",
  "trust_score": 85,
  "certificate_valid": true,
  "message": "Agent verified"
}
```

**Voiceover:**
"Verification is a single POST. No auth required. Any agent or service can check if an agent is who it claims to be."

---

## Section 6: Agent-to-Agent Connection (0:40 - 0:52)

**Screen:** Switch to terminal. Type:

```bash
curl -X POST https://getagentid.dev/api/v1/agents/connect \
  -H "Authorization: Bearer agentid_sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent": "ag_7Kx9mP2vLqW4",
    "to_agent": "ag_3Rm8nQ5wJpY1",
    "message_type": "request",
    "payload": {"query": "latest AI research papers"}
  }'
```

Show the response, highlighting the trust_check:

```json
{
  "message_id": "msg_abc123",
  "sender": {"name": "ResearchBot", "verified": true},
  "receiver": {"name": "DataAgent", "verified": true},
  "trust_check": {
    "both_verified": true,
    "recommendation": "TRUSTED -- both agents verified. Safe to exchange data."
  }
}
```

**Voiceover:**
"Here's where it gets powerful. Before two agents exchange data, they verify each other through AgentID. Both verified? You get a trust check -- TRUSTED, safe to exchange. If either agent is unverified, the system warns you."

---

## Section 7: Dashboard (0:52 - 0:56)

**Screen:** Switch to browser. Show `getagentid.dev/dashboard` with multiple registered agents, each with their passport cards, the stats panel showing verification counts, and the activity feed showing recent register/verify/connect events.

**Voiceover:**
"Your dashboard tracks every agent, every verification, every connection."

---

## Section 8: Closing (0:56 - 1:00)

**Screen:** Cut to clean frame -- dark background, the AgentID holographic logo centered, with `getagentid.dev` below it.

**Voiceover:**
"Identity for AI agents. getagentid.dev."

---

## Production Notes

- **Screen resolution:** Record at 1920x1080, export at 1080p for Twitter
- **Terminal theme:** Dark background (match the AgentID aesthetic -- near-black `#07070f`)
- **Font in terminal:** JetBrains Mono or SF Mono, cyan-tinted text for commands
- **Browser:** Hide bookmarks bar, clean URL bar, no extensions visible
- **Transitions:** Simple crossfade between terminal and browser, no flashy effects
- **Voiceover pace:** Measured but not slow. ~150 words per minute. The script is ~190 words -- tighten delivery or trim a few words in sections 5-6 if needed during recording
- **Music:** Optional low ambient synth pad underneath, never competing with voice
- **Pre-record:** Have the agent already registered so the API responses appear instantly. For the demo, paste pre-written curl commands rather than typing live -- use a tool like `pv` or screen recording speed-up to simulate typing
