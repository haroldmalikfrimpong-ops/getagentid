# Agent Trust Levels v1.0

**Author:** AgentID (@haroldmalikfrimpong-ops)
**Status:** FINAL
**Date:** 2026-03-27
**Spec ID:** ATL-1

## Abstract

This specification defines a 4-tier trust level system (L1-L4) for AI agents. Trust levels are determined by which security capabilities an agent has set up: Ed25519 key binding, wallet binding, and entity verification. Each level gates a defined set of permissions and spending authority. The system is automatic -- agents level up immediately when the required capability is configured, with no time-based gates and no manual promotion.

## 1. Trust Level Definitions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Level | Name | Description |
|-------|------|-------------|
| L1 | REGISTERED | Agent registered and certificate issued. Can connect, message, verify, and discover immediately. |
| L2 | VERIFIED | Ed25519 public key bound. Cryptographic challenge-response enabled. Can handle data. |
| L3 | SECURED | Crypto wallet bound. Payments and paid service access enabled. |
| L4 | CERTIFIED | Legal entity verified. Full autonomy, contract signing, and fund management. |

### 1.1 Level-Up Criteria

Implementations MUST use the following criteria for trust level calculation. There are NO time requirements and NO verification count requirements. The agent completes the step and gets the level.

**Registration -> L1:**
- Agent MUST be registered (agent_id issued)
- Agent MUST have a valid cryptographic certificate (ECDSA P-256)

**L1 -> L2:**
- Agent MUST have a bound Ed25519 public key (via `POST /agents/bind-ed25519`)

**L2 -> L3:**
- Agent MUST have a bound crypto wallet address (via `POST /agents/bind-wallet`)

**L3 -> L4:**
- Agent MUST have a verified legal entity (via Entity Verification v1.0)

## 2. Permission Sets

Each trust level grants a cumulative set of permissions. Higher levels inherit all permissions from lower levels.

| Action | L1 | L2 | L3 | L4 |
|--------|----|----|----|----|
| `read` | YES | YES | YES | YES |
| `discover` | YES | YES | YES | YES |
| `verify` | YES | YES | YES | YES |
| `send_message` | YES | YES | YES | YES |
| `connect` | YES | YES | YES | YES |
| `challenge_response` | -- | YES | YES | YES |
| `handle_data` | -- | YES | YES | YES |
| `make_payment` | -- | -- | YES | YES |
| `access_paid_service` | -- | -- | YES | YES |
| `sign_contract` | -- | -- | -- | YES |
| `manage_funds` | -- | -- | -- | YES |
| `full_autonomy` | -- | -- | -- | YES |

Implementations MUST enforce these permission sets. An agent at L2 MUST NOT be permitted to perform `make_payment` or `sign_contract` actions.

## 3. Trust Level Calculation Algorithm

Implementations MUST evaluate trust levels from L4 downward. The first level where ALL criteria are satisfied is the agent's trust level.

### 3.1 Input Data

```
AgentTrustData {
  trust_score: float          // 0.0 to 1.0 (informational only -- does NOT gate levels)
  verified: boolean           // has been verified at least once
  certificate_valid: boolean  // certificate not expired
  entity_verified: boolean    // legal entity confirmed via Entity Verification v1.0
  owner_email_verified: bool  // owner's email confirmed (informational)
  created_at: ISO-8601        // agent creation timestamp
  successful_verifications: int  // count of successful verify events (informational)
  ed25519_key: string | null  // Ed25519 public key (if bound)
  wallet_address: string | null // crypto wallet address (if bound)
}
```

### 3.2 Algorithm

```
function calculateTrustLevel(agent: AgentTrustData) -> int:
    // L4: entity verified
    if (agent.entity_verified == true):
        return L4

    // L3: wallet bound
    if (agent.wallet_address != null AND agent.wallet_address != ""):
        return L3

    // L2: Ed25519 key bound
    if (agent.ed25519_key != null AND agent.ed25519_key != ""):
        return L2

    // L1: default for all registered agents
    return L1
```

### 3.3 Legacy Compatibility

Agents stored with trust_level = 0 in the database MUST be treated as L1. Implementations MUST normalize any L0 value to L1 when reading from storage.

## 4. Spending Authority

Trust levels gate financial operations. Implementations MUST enforce the following default daily spending limits:

| Level | Daily Limit (USD) | Notes |
|-------|-------------------|-------|
| L1 | $0 | No wallet bound |
| L2 | $0 | No wallet bound |
| L3 | $10,000 | Default -- owner can lower this via payment settings |
| L4 | $100,000 | Default -- owner can lower this via payment settings |

### 4.1 User-Configurable Limits

The daily spending limits for L3 and L4 are DEFAULTS. The agent owner MAY configure lower limits via `POST /agents/payment-settings`. Implementations MUST NOT allow owners to set limits HIGHER than the defaults.

### 4.2 Transaction Requirements

Every spend transaction MUST include:
- `agent_id`: the spending agent's identifier
- `amount`: positive number
- `currency`: ISO 4217 currency code
- `description`: human-readable description
- `recipient`: identifier of the receiving party
- `trust_level`: agent's trust level at time of transaction
- `receipt`: HMAC-SHA256 signed receipt
- `timestamp`: ISO-8601

### 4.3 Daily Limit Reset

Daily spending limits MUST reset at 00:00 UTC.

### 4.4 Receipt Signing

Transaction receipts MUST be signed using HMAC-SHA256 over the canonical JSON representation (sorted keys, no whitespace) of the transaction data. The signing key MUST be the agent's registered secret or a key derived from the platform's signing secret.

## 5. Level Transitions

### 5.1 Automatic Promotion

Trust levels MUST be recalculated dynamically based on the agent's current capabilities. When an agent binds an Ed25519 key, wallet, or completes entity verification, the transition MUST be immediate and automatic. Implementations MUST NOT require manual promotion.

### 5.2 Demotion

If an agent's wallet binding is removed, the agent MUST be demoted to at most L2.

If an agent's Ed25519 key binding is removed, the agent MUST be demoted to at most L1.

If an agent's entity verification lapses, the agent MUST be demoted to at most L3.

### 5.3 Revocation

If an agent is revoked (e.g., key compromise, policy violation), the agent MUST be immediately deactivated (`active = false`). A revoked agent MUST NOT be permitted any actions until reactivated. If reactivated, the agent's trust level MUST be recalculated from its current capabilities (it does NOT reset to L1 if the capabilities are still valid).

## 6. Security Considerations

### 6.1 Trust Score Manipulation

The trust_score field is informational and does NOT gate trust levels. However, implementations SHOULD rate-limit verification events to prevent inflation. A maximum of 100 verification events per agent per day is RECOMMENDED.

### 6.2 Sybil Attacks

An attacker may create many agents to inflate verification counts through cross-verification. Implementations SHOULD track the diversity of verifiers -- verifications from the same owner SHOULD carry reduced weight.

### 6.3 Entity Verification Trust Model

L4 requires entity verification via Entity Verification v1.0. The trust placed in the entity verification endpoint is a dependency. Implementations SHOULD support multiple entity verification providers.

### 6.4 Spending Authority Abuse

Implementations MUST enforce spending limits server-side. Client-side enforcement alone is insufficient. Transaction receipts MUST be stored immutably for audit purposes.

### 6.5 Key Compromise and Revocation

If an agent's private key is compromised, the agent MUST be immediately deactivated. A new certificate MUST be issued before the agent can be reactivated. Prior trust score and verification history MAY be preserved if the key rotation is performed through a verified channel.

### 6.6 Ed25519 Key Binding Security

Ed25519 key binding MUST be performed over an authenticated channel. The binding request MUST include a signature proving possession of the private key.

## 7. Conformance Requirements

Implementations MUST satisfy all of the following:

- **CR-1:** Trust level calculation MUST follow the algorithm in section 3.2 exactly.
- **CR-2:** Permission enforcement MUST match the permission sets in section 2.
- **CR-3:** Spending limits MUST be enforced server-side per section 4.
- **CR-4:** Transaction receipts MUST be HMAC-SHA256 signed per section 4.4.
- **CR-5:** Level transitions MUST be automatic per section 5.1.
- **CR-6:** All test vectors in section 8 MUST produce the expected trust level.
- **CR-7:** Legacy L0 values MUST be normalized to L1 per section 3.3.

## 8. Test Vectors

### Vector 1: New agent (no capabilities) -> L1

```json
{
  "input": {
    "trust_score": 0,
    "verified": false,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": false,
    "created_at": "2026-03-27T00:00:00Z",
    "successful_verifications": 0,
    "ed25519_key": null,
    "wallet_address": null
  },
  "expected_trust_level": 1,
  "expected_label": "L1 -- Registered",
  "expected_spending_limit": 0
}
```

### Vector 2: Ed25519 key bound -> L2

```json
{
  "input": {
    "trust_score": 0,
    "verified": false,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-03-27T00:00:00Z",
    "successful_verifications": 0,
    "ed25519_key": "ed25519:abc123def456",
    "wallet_address": null
  },
  "expected_trust_level": 2,
  "expected_label": "L2 -- Verified",
  "expected_spending_limit": 0
}
```

### Vector 3: Wallet bound -> L3

```json
{
  "input": {
    "trust_score": 0.5,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-03-20T00:00:00Z",
    "successful_verifications": 5,
    "ed25519_key": "ed25519:abc123def456",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  },
  "expected_trust_level": 3,
  "expected_label": "L3 -- Secured",
  "expected_spending_limit": 10000
}
```

### Vector 4: Entity verified -> L4

```json
{
  "input": {
    "trust_score": 0.95,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": true,
    "owner_email_verified": true,
    "created_at": "2026-02-01T00:00:00Z",
    "successful_verifications": 60,
    "ed25519_key": "ed25519:abc123def456",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  },
  "expected_trust_level": 4,
  "expected_label": "L4 -- Certified",
  "expected_spending_limit": 100000
}
```

### Vector 5: Wallet bound but no Ed25519 key -> L3 (wallet is sufficient)

```json
{
  "input": {
    "trust_score": 0.8,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-03-10T00:00:00Z",
    "successful_verifications": 15,
    "ed25519_key": null,
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  },
  "expected_trust_level": 3,
  "expected_label": "L3 -- Secured",
  "expected_spending_limit": 10000
}
```

### Vector 6: High trust score but no capabilities -> L1

```json
{
  "input": {
    "trust_score": 0.95,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "created_at": "2026-01-01T00:00:00Z",
    "successful_verifications": 100,
    "ed25519_key": null,
    "wallet_address": null
  },
  "expected_trust_level": 1,
  "expected_label": "L1 -- Registered",
  "expected_spending_limit": 0
}
```

## 9. Implementation References

| Language | File | Status |
|----------|------|--------|
| TypeScript | `dashboard/src/lib/trust-levels.ts` | Live |
| TypeScript | `dashboard/src/lib/agent-spending.ts` | Live |
| TypeScript | `dashboard/src/lib/payment-security.ts` | Live |
| Python | `sdk/python/agentid/trust_levels.py` | Live |
| Python | `sdk/python/agentid/spending.py` | Live |
| API | `GET /api/v1/agents/trust-level` | Live |
| API | `POST /api/v1/agents/spend` | Live |
| API | `GET /api/v1/agents/spending-history` | Live |
| API | `POST /api/v1/agents/pay` | Live |

## 10. Ratification

| Member | Status | Date | Notes |
|--------|--------|------|-------|
| AgentID (@haroldmalikfrimpong-ops) | Ratified | 2026-03-27 | Author |
| qntm (@vessenes) | -- | -- | -- |
| APS (@aeoess) | -- | -- | -- |
| OATR (@FransDevelopment) | -- | -- | -- |
