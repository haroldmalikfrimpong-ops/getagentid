# AgentID TrustProvider for browser-use

Trust verification for AI browser agents. This module implements the [AgentID](https://getagentid.dev) trust protocol as a provider that integrates with [browser-use](https://github.com/browser-use/browser-use).

Agents present `Agent-Trust-Score` JWTs. Site operators evaluate them against configurable policies to make access decisions (allow, degrade, block).

## Install

```bash
pip install agentid-trust-provider
```

Or add to your project:

```bash
uv add agentid-trust-provider
```

## Usage

### Get and verify a trust JWT

```python
from agentid_trust_provider import AgentIDTrustProvider

provider = AgentIDTrustProvider(api_key="your_key")

# Fetch a signed JWT for your agent
jwt = await provider.get_trust_jwt("agent_abc123")

# Verify and decode claims
claims = await provider.verify_trust_jwt(jwt)
print(claims.trust_score)   # 75
print(claims.trust_level)   # "L2"
print(claims.scarring_score) # 5
```

### Evaluate against a policy

```python
from agentid_trust_provider import TrustPolicy

policy = TrustPolicy({
    "min_trust_score": 60,
    "max_risk_score": 30,
    "required_attestations": ["identity_verified"],
    "action_on_fail": "block",
})

result = policy.evaluate(claims)
if result.action == "block":
    raise PermissionError("Agent does not meet trust policy")
```

### Chain multiple policies

```python
from policy_engine import TrustPolicyChain

chain = TrustPolicyChain([
    TrustPolicy({"min_trust_score": 50, "action_on_fail": "degrade"}),
    TrustPolicy({"max_risk_score": 20, "action_on_fail": "block"}),
])

result = chain.evaluate(claims)
# Most restrictive action wins
```

### Use with browser-use agent

```python
from browser_use import Agent
from agentid_trust_provider import AgentIDTrustProvider

provider = AgentIDTrustProvider()
jwt = await provider.get_trust_jwt("my_agent_id")

# Attach to requests as Agent-Trust-Score header
agent = Agent(
    task="Book a flight",
    extra_headers={"Agent-Trust-Score": jwt},
)
await agent.run()
```

## Trust Claims

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | `str` | Unique agent identifier |
| `trust_score` | `int` | 0-100 composite trust score |
| `trust_level` | `str` | L0-L4 trust tier |
| `scarring_score` | `int` | Accumulated penalty score |
| `risk_score` | `int` | Current risk assessment |
| `attestations` | `list[str]` | Verified attestation labels |
| `provider` | `str` | Trust provider identifier |

## Tests

```bash
pytest tests/
```

## Protocol

See the full [AgentID Trust Protocol spec](https://getagentid.dev/docs/trust-protocol).
