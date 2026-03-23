# AgentID + OpenAI Agents SDK: Identity Verification Guardrails

Verify an agent's identity before it can act. Unverified agents are blocked from executing tools or generating responses.

Built on [AgentID](https://getagentid.dev) and the [OpenAI Agents SDK](https://github.com/openai/openai-agents-python).

## Why

When agents can call tools, make handoffs, or take real-world actions, you need to know *who* is acting. AgentID provides a public registry and verification API for AI agent identities. This example wires it into the Agents SDK's guardrail system so that:

- **Verified agents** (registered in AgentID) proceed normally
- **Unverified agents** are blocked before they spend tokens or execute tools

## Two Patterns

### 1. Input Guardrail (`agent_identity_guardrail.py`)

Checks identity once at the start of the run. If verification fails, the entire run is aborted — no LLM call, no tool execution.

```
User input --> [AgentID guardrail] --> Agent runs (or is blocked)
```

### 2. Tool Guardrail (`tool_guardrail.py`)

Checks identity before every tool invocation. Useful when multiple agents share tools via handoffs and you want per-action verification.

```
Agent decides to call tool --> [AgentID guardrail] --> Tool executes (or is rejected)
```

## Setup

```bash
pip install openai-agents httpx
```

Set your OpenAI API key:

```bash
export OPENAI_API_KEY="sk-..."
```

Register an agent at [getagentid.dev](https://getagentid.dev) and note the `agent_id`.

## Usage

### Input guardrail

```bash
python agent_identity_guardrail.py
```

Update the `agent_id` values in the script to use your registered agent ID:

```python
verified_ctx = AgentIdentityContext(
    agent_id="agent_YOUR_REAL_ID",  # <-- your registered agent
    name="Support Agent",
)
```

### Tool guardrail

```bash
python tool_guardrail.py
```

## How it works

### AgentID verification

The guardrail calls the AgentID verify endpoint:

```
POST https://www.getagentid.dev/api/v1/agents/verify
Body: {"agent_id": "agent_xxx"}
```

Response:

```json
{
  "verified": true,
  "agent_id": "agent_xxx",
  "name": "My Support Agent",
  "trust_score": 0.94,
  "certificate_valid": true,
  "active": true
}
```

No authentication is required for basic verification (rate-limited by IP). For production use, pass a Bearer token for higher limits.

### Input guardrail flow

```python
@input_guardrail
async def agentid_identity_guardrail(ctx, agent, input):
    result = await verify_agent_identity(ctx.context.agent_id)
    return GuardrailFunctionOutput(
        output_info=result,
        tripwire_triggered=not result.get("verified", False),
    )

agent = Agent(
    name="Support Agent",
    input_guardrails=[agentid_identity_guardrail],
)
```

When `tripwire_triggered=True`, the SDK raises `InputGuardrailTripwireTriggered` and the run is aborted.

### Tool guardrail flow

```python
@tool_input_guardrail
async def require_verified_identity(data):
    # data.context.context is the user-defined AgentIdentityContext
    result = await verify_agent(data.context.context.agent_id)
    if result.get("verified"):
        return ToolGuardrailFunctionOutput.allow()
    else:
        return ToolGuardrailFunctionOutput.reject_content("Agent not verified")

@function_tool(tool_input_guardrails=[require_verified_identity])
def lookup_order(order_id: str) -> str:
    ...
```

When rejected, the tool output is replaced with the rejection message and the agent sees it could not execute the action.

## Expected output

```
============================================================
RUN 1 -- Verified agent (registered in AgentID)
============================================================
[AgentID] Verifying identity for 'Verified Support Agent' (agent_demo_verified)...
[AgentID] VERIFIED  trust_score=0.94

Agent response: Our refund policy allows returns within 30 days...

============================================================
RUN 2 -- Unverified agent (NOT in AgentID registry)
============================================================
[AgentID] Verifying identity for 'Unknown Agent' (agent_fake_unknown_12345)...
[AgentID] BLOCKED   reason='Agent not found'

BLOCKED by AgentID guardrail -- identity not verified.
```

## Production considerations

- **Cache verification results** to avoid calling the API on every request. A TTL of 60 seconds is reasonable.
- **Use an API key** (`Authorization: Bearer ak_...`) for higher rate limits.
- **Set a minimum trust score** threshold instead of only checking `verified`.
- **Combine with output guardrails** to verify identity on both ends of the pipeline.

## Links

- [AgentID](https://getagentid.dev) - Register and verify agent identities
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) - Agent framework
- [Agents SDK Guardrails docs](https://openai.github.io/openai-agents-python/guardrails/) - Full guardrails reference
