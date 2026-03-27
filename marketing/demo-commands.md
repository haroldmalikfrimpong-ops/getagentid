# Demo Video — Copy & Paste Commands (WINDOWS)

All commands work on Windows Command Prompt / PowerShell. API key is already filled in. Just paste each one and hit enter.

---

## STEP 1 — THE PROBLEM

Paste in terminal:

```
echo Who is this agent? Is it legit? No way to know.
```

What happens: Text prints on screen. That's it. You're showing the problem.

---

## STEP 2 — THE SOLUTION

Switch to browser. Go to:

```
https://getagentid.dev
```

What happens: Landing page loads. Sit there 3 seconds. People see the product.

---

## STEP 3 — REGISTER AN AGENT

Switch to terminal. Paste:

```
curl -X POST https://getagentid.dev/api/v1/agents/register -H "Authorization: Bearer agentid_sk_your_api_key_here" -H "Content-Type: application/json" -d "{""name"": ""ResearchBot"", ""description"": ""AI research assistant"", ""capabilities"": [""web-search"", ""summarization""], ""platform"": ""langchain""}"
```

What happens: API responds with agent ID, certificate, keys. You just created an agent identity in one second.

---

## STEP 4 — THE REGISTRY

Switch to browser. Go to:

```
https://getagentid.dev/registry
```

What happens: You see all your agents. Click on one to show its passport — name, owner, trust score, certificate.

---

## STEP 5 — VERIFY AN AGENT

Switch to terminal. Paste:

```
curl -X POST https://getagentid.dev/api/v1/agents/verify -H "Content-Type: application/json" -d "{""agent_id"": ""agent_c5460451b4344268""}"
```

What happens: Response shows "verified: true", Trading Bot, trust score 0.94, certificate valid. Anyone can check any agent, no login needed.

---

## STEP 6 — CONNECT TWO AGENTS

Switch to terminal. Paste:

```
curl -X POST https://getagentid.dev/api/v1/agents/connect -H "Authorization: Bearer agentid_sk_your_api_key_here" -H "Content-Type: application/json" -d "{""from_agent"": ""agent_c5460451b4344268"", ""to_agent"": ""agent_9ba9aa4a929f4ca7"", ""message_type"": ""request"", ""payload"": {""query"": ""latest gold signal analysis""}}"
```

What happens: Response shows Trading Bot (verified) connecting to BillionmakerHQ (verified). Trust check says "TRUSTED — both agents verified. Safe to exchange data." This is the big moment.

---

## STEP 7 — DASHBOARD

Switch to browser. Go to:

```
https://getagentid.dev/dashboard
```

What happens: Your command center with all agents, stats, activity feed. Scroll around slowly.

---

## STEP 8 — END

Switch to browser. Go to:

```
https://getagentid.dev
```

What happens: Landing page. Last thing people see. Stop recording.
