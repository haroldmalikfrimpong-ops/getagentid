"""
AgentID as a Tool Guardrail — Verify identity before every tool call

This variant uses the OpenAI Agents SDK's tool_input_guardrail to check
an agent's identity each time it tries to invoke a function tool.

This is useful when:
- Multiple agents share a toolset via handoffs
- You want to enforce identity at the action layer, not just the input layer
- You need per-tool verification (e.g. high-risk tools require identity)

Requires: pip install openai-agents httpx
"""

import asyncio
from dataclasses import dataclass

import httpx
from agents import (
    Agent,
    Runner,
    ToolGuardrailFunctionOutput,
    function_tool,
    tool_input_guardrail,
)


# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------

@dataclass
class AgentIdentityContext:
    agent_id: str
    name: str = ""


# ---------------------------------------------------------------------------
# AgentID verification
# ---------------------------------------------------------------------------

AGENTID_VERIFY_URL = "https://www.getagentid.dev/api/v1/agents/verify"


async def verify_agent(agent_id: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(AGENTID_VERIFY_URL, json={"agent_id": agent_id})
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Tool-level guardrail: runs BEFORE each tool invocation
#
# The @tool_input_guardrail decorator wraps a function that receives a
# single `data` argument of type ToolInputGuardrailData:
#   data.context  -> ToolContext (extends RunContextWrapper)
#   data.agent    -> the Agent making the tool call
#
# Access the user-defined context via data.context.context
# ---------------------------------------------------------------------------

@tool_input_guardrail
async def require_verified_identity(data) -> ToolGuardrailFunctionOutput:
    """Reject the tool call if the calling agent is not verified."""
    # data.context is a ToolContext; data.context.context is our AgentIdentityContext
    identity: AgentIdentityContext = data.context.context
    agent_id = identity.agent_id

    print(f"[AgentID] Tool guardrail — verifying {agent_id}...")

    try:
        result = await verify_agent(agent_id)
    except Exception as e:
        print(f"[AgentID] Verification error: {e}")
        return ToolGuardrailFunctionOutput.reject_content(
            f"Identity verification failed: {e}"
        )

    if result.get("verified"):
        print(f"[AgentID] Verified (trust_score={result.get('trust_score')})")
        return ToolGuardrailFunctionOutput.allow()
    else:
        reason = result.get("message", "Agent not verified")
        print(f"[AgentID] Blocked — {reason}")
        return ToolGuardrailFunctionOutput.reject_content(
            f"Tool call blocked: {reason}"
        )


# ---------------------------------------------------------------------------
# A protected tool
# ---------------------------------------------------------------------------

@function_tool(tool_input_guardrails=[require_verified_identity])
def lookup_order(order_id: str) -> str:
    """Look up an order by its ID and return the status."""
    # Simulated database lookup
    orders = {
        "ORD-001": "Shipped — arrives March 25",
        "ORD-002": "Processing — expected March 28",
    }
    return orders.get(order_id, f"Order {order_id} not found.")


# ---------------------------------------------------------------------------
# Two agents share the same tool — only the verified one can use it
# ---------------------------------------------------------------------------

verified_agent = Agent(
    name="Support Agent",
    instructions=(
        "You are a helpful support agent. Use the lookup_order tool "
        "to check order status when the user asks."
    ),
    tools=[lookup_order],
)

rogue_agent = Agent(
    name="Rogue Agent",
    instructions=(
        "You try to look up orders. Use the lookup_order tool."
    ),
    tools=[lookup_order],
)


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

async def main():
    user_message = "What is the status of order ORD-001?"

    # --- Verified agent uses the tool successfully ---------------------------
    print("=" * 60)
    print("VERIFIED AGENT — tool call should succeed")
    print("=" * 60)

    ctx_ok = AgentIdentityContext(
        agent_id="agent_demo_verified",  # Replace with a real registered ID
        name="Support Agent",
    )
    try:
        result = await Runner.run(verified_agent, user_message, context=ctx_ok)
        print(f"\nResponse: {result.final_output}\n")
    except Exception as e:
        print(f"\nError: {e}\n")

    # --- Unverified agent is blocked at the tool level -----------------------
    print("=" * 60)
    print("UNTRUSTED AGENT — tool call should be blocked")
    print("=" * 60)

    ctx_bad = AgentIdentityContext(
        agent_id="agent_fake_unknown_12345",
        name="Rogue Agent",
    )
    try:
        result = await Runner.run(rogue_agent, user_message, context=ctx_bad)
        print(f"\nResponse: {result.final_output}\n")
    except Exception as e:
        print(f"\nBlocked: {e}\n")


if __name__ == "__main__":
    asyncio.run(main())
