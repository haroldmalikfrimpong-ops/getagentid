# AgentID RuntimeVerifier — WG Integration

Drop-in `RuntimeVerifier` for the WG integration test harness.

Two implementations, same interface:
- `runtime_verifier.py` — Python (uses `httpx` + AgentID SDK)
- `runtime_verifier.ts` — TypeScript (uses `fetch`)

## Interface

```typescript
interface RuntimeVerifier {
  verify(agentDID: string, agentPublicKey: string): Promise<RuntimeVerification>
}

interface RuntimeVerification {
  verified: boolean;         // agent passed all checks
  trust_level: number;       // 1-4 (L1 Registered .. L4 Certified)
  trust_score: number;       // 0.0 - 1.0
  permissions: string[];     // actions allowed at this trust level
  spending_limit: number;    // daily USD limit
  did_resolution_status: "live" | "cached" | "failed";
  entity_verified: boolean;  // legal entity binding confirmed
}
```

## Python

```bash
pip install httpx agentid
```

```python
from runtime_verifier import RuntimeVerifier

verifier = RuntimeVerifier(api_key="your-key")
result = await verifier.verify("did:agentid:agent-007", "abcdef1234...")

print(result.verified)       # True
print(result.trust_level)    # 3
print(result.permissions)    # ["read", "discover", ...]
print(result.spending_limit) # 100
```

The Python version does two things:
1. Calls `verify_agent_full()` from the AgentID SDK for local DID resolution and entity checks
2. Calls the AgentID API (`POST /agents/verify`, `GET /agents/trust-level`) for trust score and level

## TypeScript

```typescript
import { RuntimeVerifier } from "./runtime_verifier";

const verifier = new RuntimeVerifier({ apiKey: "your-key" });
const result = await verifier.verify("did:agentid:agent-007", "abcdef1234...");

console.log(result.verified);       // true
console.log(result.trust_level);    // 3
console.log(result.permissions);    // ["read", "discover", ...]
console.log(result.spending_limit); // 100
```

The TypeScript version calls the API only (no local DID resolution). Set `AGENTID_API_KEY` and optionally `AGENTID_BASE_URL` as env vars, or pass them in the constructor.

## API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/agents/verify` | POST | Trust score, certificate validity, basic verification |
| `/api/v1/agents/trust-level` | GET | Trust level (0-4), entity verification status |

## Trust Levels

| Level | Label | Permissions | Daily Limit |
|---|---|---|---|
| 0 | Unverified | none | $0 |
| 1 | Basic | read, discover | $0 |
| 2 | Verified | + verify, send_message, connect | $0 |
| 3 | Trusted | + handle_data, access_paid_service, make_payment | $100 |
| 4 | Full Authority | + sign_contract, manage_funds, full_autonomy | $10,000 |

## Plugging into the Test Harness

Replace the stub `RuntimeVerifier` in the test harness with either implementation:

**Python:**
```python
# In your test setup
from runtime_verifier import RuntimeVerifier
verifier = RuntimeVerifier(api_key=os.environ["AGENTID_API_KEY"])
```

**TypeScript:**
```typescript
// In your test setup
import { RuntimeVerifier } from "./runtime_verifier";
const verifier = new RuntimeVerifier();
```

Both accept the same constructor options and return the same `RuntimeVerification` shape.
