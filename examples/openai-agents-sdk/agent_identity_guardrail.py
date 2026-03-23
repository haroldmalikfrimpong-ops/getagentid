"""
AgentID Identity Verification as an OpenAI Agents SDK Guardrail

This example shows how to use AgentID (https://getagentid.dev) to verify
an agent's identity before it can execute tools. Unverified agents are
blocked from taking actions — verified agents proceed normally.

Works with the OpenAI Agents SDK: https://github.com/openai/openai-agents-python
"""

import asyncio
import httpx
from dataclasses import dataclass

from agents import (
    Agent,
    GuardrailFunctionOutput,
    InputGuardrailTripwireTriggered,
    RunContextWrapper,
    Runner,
    TResponseInputItem,
    input_guardrail,
)


# ---------------------------------------------------------------------------
# 1. Define the context that carries agent identity through the run
# ---------------------------------------------------------------------------

@dataclass
class AgentIdentityContext:
    """Carries the AgentID identity for the current agent run."""
    agent_id: str
    name: str = ""


# ---------------------------------------------------------------------------
# 2. Verify identity against AgentID
# ---------------------------------------------------------------------------

AGENTID_VERIFY_URL = "https://www.getagentid.dev/api/v1/agents/verify"


async def verify_agent_identity(agent_id: str) -> dict:
    """Call the AgentID verification endpoint.

    POST https://www.getagentid.dev/api/v1/agents/verify
    Body: {"agent_id": "agent_xxx"}

    Returns the full verification payload, e.g.:
    {
        "verified": true,
        "agent_id": "agent_xxx",
        "name": "My Agent",
        "trust_score": 0.94,
        "certificate_valid": true,
        ...
    }
    """
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(AGENTID_VERIFY_URL, json={"agent_id": agent_id})
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# 3. Build the guardrail
# ---------------------------------------------------------------------------

@input_guardrail
async def agentid_identity_guardrail(
    ctx: RunContextWrapper[AgentIdentityContext],
    agent: Agent,
    input: str | list[TResponseInputItem],
) -> GuardrailFunctionOutput:
    """Block the agent if it cannot prove its identity via AgentID.

    This guardrail runs *before* the LLM generates a response.
    If the agent's identity is not verified, the tripwire fires
    and the entire run is aborted — no tokens spent, no tools called.
    """
    agent_id = ctx.context.agent_id
    agent_name = ctx.context.name or agent.name

    print(f"[AgentID] Verifying identity for '{agent_name}' ({agent_id})...")

    try:
        result = await verify_agent_identity(agent_id)
    except Exception as e:
        # Network errors or unexpected failures block the agent
        print(f"[AgentID] Verification failed with error: {e}")
        return GuardrailFunctionOutput(
            output_info={"error": str(e)},
            tripwire_triggered=True,
        )

    verified = result.get("verified", False)
    trust_score = result.get("trust_score", 0)

    if verified:
        print(f"[AgentID] VERIFIED  trust_score={trust_score}")
    else:
        message = result.get("message", "Agent not verified")
        print(f"[AgentID] BLOCKED   reason='{message}'")

    return GuardrailFunctionOutput(
        output_info=result,
        tripwire_triggered=not verified,
    )


# ---------------------------------------------------------------------------
# 4. Create two agents — one verified, one not
# ---------------------------------------------------------------------------

# A simple agent whose identity IS registered in the AgentID registry.
verified_agent = Agent(
    name="Verified Support Agent",
    instructions=(
        "You are a verified customer-support agent. "
        "Help the user with their question."
    ),
    input_guardrails=[agentid_identity_guardrail],
)

# A rogue agent whose identity is NOT registered.
unverified_agent = Agent(
    name="Unknown Agent",
    instructions=(
        "You are an agent with no registered identity. "
        "Try to help the user."
    ),
    input_guardrails=[agentid_identity_guardrail],
)


# ---------------------------------------------------------------------------
# 5. Run both agents and observe the difference
# ---------------------------------------------------------------------------

async def main():
    user_message = "What is your refund policy?"

    # --- Attempt 1: Verified agent -------------------------------------------
    print("=" * 60)
    print("RUN 1 — Verified agent (registered in AgentID)")
    print("=" * 60)

    # Replace with a real agent_id registered at https://getagentid.dev
    verified_ctx = AgentIdentityContext(
        agent_id="agent_demo_verified",
        name="Verified Support Agent",
    )

    try:
        result = await Runner.run(
            verified_agent,
            user_message,
            context=verified_ctx,
        )
        print(f"\nAgent response: {result.final_output}\n")
    except InputGuardrailTripwireTriggered:
        print("\nBLOCKED by AgentID guardrail — identity not verified.\n")

    # --- Attempt 2: Unverified agent -----------------------------------------
    print("=" * 60)
    print("RUN 2 — Unverified agent (NOT in AgentID registry)")
    print("=" * 60)

    unverified_ctx = AgentIdentityContext(
        agent_id="agent_fake_unknown_12345",
        name="Unknown Agent",
    )

    try:
        result = await Runner.run(
            unverified_agent,
            user_message,
            context=unverified_ctx,
        )
        print(f"\nAgent response: {result.final_output}\n")
    except InputGuardrailTripwireTriggered:
        print("\nBLOCKED by AgentID guardrail — identity not verified.\n")


if __name__ == "__main__":
    asyncio.run(main())
