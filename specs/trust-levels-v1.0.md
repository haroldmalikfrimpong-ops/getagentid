# Agent Trust Levels v1.0

**Author:** AgentID (@haroldmalikfrimpong-ops)
**Status:** DRAFT
**Date:** 2026-03-25
**Spec ID:** ATL-1

## Abstract

This specification defines a 5-tier trust level system (L0–L4) for AI agents. Trust levels are computed from cryptographic verification status, behavioural history, entity binding, and time active. Each level gates a defined set of permissions and spending authority. The system is automatic — agents level up when criteria are met, with no manual promotion.

## 1. Trust Level Definitions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Level | Name | Description |
|-------|------|-------------|
| L0 | UNVERIFIED | Agent registered. No verification performed. No permissions. |
| L1 | BASIC | Owner email verified. Read-only access. |
| L2 | VERIFIED | Cryptographic certificate issued. At least 1 successful verification. Can interact with other agents. |
| L3 | TRUSTED | Proven track record. Trust score ≥ 0.7. Can handle sensitive data and make payments. |
| L4 | FULL_AUTHORITY | Entity verified. Maximum trust. Full autonomy and financial authority. |

### 1.1 Level-Up Criteria

Implementations MUST use the following criteria for trust level calculation:

**L0 → L1:**
- Owner email address MUST be verified

**L1 → L2:**
- Agent MUST have a valid cryptographic certificate (ECDSA P-256 or Ed25519)
- Agent MUST have at least 1 successful verification event

**L2 → L3:**
- Trust score MUST be ≥ 0.7
- Agent MUST have at least 10 successful verification events
- Agent MUST have been active for at least 7 days

**L3 → L4:**
- Trust score MUST be ≥ 0.9
- Agent MUST have a verified legal entity (via Entity Verification v1.0)
- Agent MUST have been active for at least 30 days
- Agent MUST have at least 50 successful verification events

## 2. Permission Sets

Each trust level grants a cumulative set of permissions. Higher levels inherit all permissions from lower levels.

| Action | L0 | L1 | L2 | L3 | L4 |
|--------|----|----|----|----|-----|
| `read` | — | ✅ | ✅ | ✅ | ✅ |
| `discover` | — | ✅ | ✅ | ✅ | ✅ |
| `verify` | — | — | ✅ | ✅ | ✅ |
| `send_message` | — | — | ✅ | ✅ | ✅ |
| `connect` | — | — | ✅ | ✅ | ✅ |
| `handle_data` | — | — | — | ✅ | ✅ |
| `access_paid_service` | — | — | — | ✅ | ✅ |
| `make_payment` | — | — | — | ✅ | ✅ |
| `sign_contract` | — | — | — | — | ✅ |
| `manage_funds` | — | — | — | — | ✅ |
| `full_autonomy` | — | — | — | — | ✅ |

Implementations MUST enforce these permission sets. An agent at L2 MUST NOT be permitted to perform `handle_data` or `make_payment` actions.

## 3. Trust Level Calculation Algorithm

Implementations MUST evaluate trust levels from L4 downward. The first level where ALL criteria are satisfied is the agent's trust level.

### 3.1 Input Data

```
AgentTrustData {
  trust_score: float          // 0.0 to 1.0
  verified: boolean           // certificate verification passed
  certificate_valid: boolean  // certificate not expired
  entity_verified: boolean    // legal entity confirmed via Entity Verification v1.0
  owner_email_verified: bool  // owner's email confirmed
  created_at: ISO-8601        // agent creation timestamp
  successful_verifications: int  // count of successful verify events
}
```

### 3.2 Algorithm

```
function calculateTrustLevel(agent: AgentTrustData) -> int:
    days_active = (now - agent.created_at).days

    if (agent.trust_score >= 0.9
        AND agent.verified
        AND agent.certificate_valid
        AND agent.entity_verified
        AND agent.owner_email_verified
        AND days_active >= 30
        AND agent.successful_verifications >= 50):
        return L4

    if (agent.trust_score >= 0.7
        AND agent.verified
        AND agent.certificate_valid
        AND agent.owner_email_verified
        AND days_active >= 7
        AND agent.successful_verifications >= 10):
        return L3

    if (agent.verified
        AND agent.certificate_valid
        AND agent.successful_verifications >= 1):
        return L2

    if (agent.owner_email_verified):
        return L1

    return L0
```

## 4. Spending Authority

Trust levels gate financial operations. Implementations MUST enforce the following daily spending limits:

| Level | Daily Limit (USD) | Notes |
|-------|-------------------|-------|
| L0 | $0 | No financial access |
| L1 | $0 | No financial access |
| L2 | $0 | No financial access |
| L3 | $100 | Sensitive operations permitted |
| L4 | $10,000 | Full financial authority |

### 4.1 Transaction Requirements

Every spend transaction MUST include:
- `agent_id`: the spending agent's identifier
- `amount`: positive number
- `currency`: ISO 4217 currency code
- `description`: human-readable description
- `recipient`: identifier of the receiving party
- `trust_level`: agent's trust level at time of transaction
- `receipt`: HMAC-SHA256 signed receipt
- `timestamp`: ISO-8601

### 4.2 Daily Limit Reset

Daily spending limits MUST reset at 00:00 UTC.

### 4.3 Receipt Signing

Transaction receipts MUST be signed using HMAC-SHA256 over the canonical JSON representation (sorted keys, no whitespace) of the transaction data. The signing key MUST be the agent's registered secret or a key derived from the platform's signing secret.

## 5. Level Transitions

### 5.1 Automatic Promotion

Trust levels MUST be recalculated on every verification event. When an agent meets the criteria for a higher level, the transition MUST be automatic. Implementations MUST NOT require manual promotion.

### 5.2 Demotion

If an agent's trust score drops below the threshold for its current level, the agent MUST be demoted to the highest level whose criteria it still satisfies.

If an agent's certificate expires, the agent MUST be demoted to at most L1.

If an agent's entity verification lapses, the agent MUST be demoted to at most L3.

### 5.3 Revocation

If an agent is revoked (e.g., key compromise, policy violation), the agent MUST be immediately set to L0 regardless of prior status.

## 6. Security Considerations

### 6.1 Trust Score Manipulation

Implementations SHOULD rate-limit verification events to prevent an agent from inflating its verification count. A maximum of 100 verification events per agent per day is RECOMMENDED.

### 6.2 Sybil Attacks

An attacker may create many agents to inflate verification counts through cross-verification. Implementations SHOULD track the diversity of verifiers — verifications from the same owner SHOULD carry reduced weight.

### 6.3 Entity Verification Trust Model

L4 requires entity verification via Entity Verification v1.0. The trust placed in the entity verification endpoint is a dependency. Implementations SHOULD support multiple entity verification providers.

### 6.4 Spending Authority Abuse

Implementations MUST enforce spending limits server-side. Client-side enforcement alone is insufficient. Transaction receipts MUST be stored immutably for audit purposes.

### 6.5 Key Compromise and Level Demotion

If an agent's private key is compromised, the agent MUST be immediately revoked and set to L0. A new certificate MUST be issued before the agent can regain any trust level. Prior trust score and verification history MAY be preserved if the key rotation is performed through a verified channel.

## 7. Conformance Requirements

Implementations MUST satisfy all of the following:

- **CR-1:** Trust level calculation MUST follow the algorithm in §3.2 exactly.
- **CR-2:** Permission enforcement MUST match the permission sets in §2.
- **CR-3:** Spending limits MUST be enforced server-side per §4.
- **CR-4:** Transaction receipts MUST be HMAC-SHA256 signed per §4.3.
- **CR-5:** Level transitions MUST be automatic per §5.1.
- **CR-6:** All test vectors in §8 MUST produce the expected trust level.

## 8. Test Vectors

### Vector 1: New agent → L0

```json
{
  "input": {
    "trust_score": 0,
    "verified": false,
    "certificate_valid": false,
    "entity_verified": false,
    "owner_email_verified": false,
    "created_at": "2026-03-25T00:00:00Z",
    "successful_verifications": 0
  },
  "expected_trust_level": 0,
  "expected_spending_limit": 0
}
```

### Vector 2: Email verified → L1

```json
{
  "input": {
    "trust_score": 0,
    "verified": false,
    "certificate_valid": false,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-03-25T00:00:00Z",
    "successful_verifications": 0
  },
  "expected_trust_level": 1,
  "expected_spending_limit": 0
}
```

### Vector 3: Certificate + verification → L2

```json
{
  "input": {
    "trust_score": 0.5,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-03-20T00:00:00Z",
    "successful_verifications": 5
  },
  "expected_trust_level": 2,
  "expected_spending_limit": 0
}
```

### Vector 4: Trusted agent → L3

```json
{
  "input": {
    "trust_score": 0.8,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-03-10T00:00:00Z",
    "successful_verifications": 15
  },
  "expected_trust_level": 3,
  "expected_spending_limit": 100
}
```

### Vector 5: Full authority → L4

```json
{
  "input": {
    "trust_score": 0.95,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": true,
    "owner_email_verified": true,
    "created_at": "2026-02-01T00:00:00Z",
    "successful_verifications": 60
  },
  "expected_trust_level": 4,
  "expected_spending_limit": 10000
}
```

### Vector 6: High trust but no entity → caps at L3

```json
{
  "input": {
    "trust_score": 0.95,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-01-01T00:00:00Z",
    "successful_verifications": 100
  },
  "expected_trust_level": 3,
  "expected_spending_limit": 100
}
```

## 9. Implementation References

| Language | File | Status |
|----------|------|--------|
| TypeScript | `dashboard/src/lib/trust-levels.ts` | Live |
| TypeScript | `dashboard/src/lib/agent-spending.ts` | Live |
| Python | `sdk/python/agentid/trust_levels.py` | Live |
| Python | `sdk/python/agentid/spending.py` | Live |
| API | `GET /api/v1/agents/trust-level` | Live |
| API | `POST /api/v1/agents/spend` | Live |
| API | `GET /api/v1/agents/spending-history` | Live |

## 10. Ratification

| Member | Status | Date | Notes |
|--------|--------|------|-------|
| AgentID (@haroldmalikfrimpong-ops) | ✅ | 2026-03-25 | Author |
| qntm (@vessenes) | — | — | — |
| APS (@aeoess) | — | — | — |
| OATR (@FransDevelopment) | — | — | — |
