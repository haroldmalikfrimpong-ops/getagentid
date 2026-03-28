# AgentID Trust Level Constraint Mapping v0.1

**Author:** AgentID (@haroldmalikfrimpong-ops)
**Status:** DRAFT — for WG Authority Constraints Interface v0.1
**Date:** 2026-03-28
**Spec ID:** ACI-AGENTID-1

## Abstract

This document maps AgentID trust levels (L1–L4) to the Authority Constraints Interface proposed in corpollc/qntm#7. Each trust level defines a constraint envelope — the set of facets, limits, and permissions that gate agent authority. Constraint evaluations are expressed in the `ConstraintEvaluation` schema proposed by @desiorac.

## 1. Trust Level → Constraint Envelope

AgentID trust levels are capability-based, not time-based. An agent's level is determined by what security capabilities it has set up:

| Level | Name | Criteria | Constraint Envelope |
|-------|------|----------|-------------------|
| L1 | Registered | Agent registered, certificate issued | Scope: basic actions only. Spend: $0. No payment authority. |
| L2 | Verified | Ed25519 key bound | Scope: basic + challenge-response + data handling. Spend: $0. |
| L3 | Secured | Wallet bound | Scope: all except contracts. Spend: $10,000/day default (user-configurable downward). |
| L4 | Certified | Entity verified | Scope: full autonomy. Spend: $100,000/day default (user-configurable downward). |

**Critical design principle:** Spending limits are DEFAULTS that the agent owner can LOWER, not system-imposed restrictions. AgentID is a security layer, not a governance authority. The owner sets their own constraints.

## 2. Facet Taxonomy

AgentID evaluates 5 constraint facets per action:

### 2.1 Scope

What actions the agent is permitted to perform.

| Level | Permitted Actions |
|-------|------------------|
| L1 | `read`, `discover`, `verify`, `send_message`, `connect` |
| L2 | L1 + `challenge_response`, `handle_data` |
| L3 | L2 + `make_payment`, `access_paid_service` |
| L4 | L3 + `sign_contract`, `manage_funds`, `full_autonomy` |

Scope is cumulative — each level inherits all permissions from lower levels.

### 2.2 Spend

Maximum daily spending authority in USD.

| Level | Default Limit | User Override |
|-------|--------------|---------------|
| L1 | $0 | N/A (no wallet) |
| L2 | $0 | N/A (no wallet) |
| L3 | $10,000/day | Owner MAY set lower via `setCustomSpendingLimit()` |
| L4 | $100,000/day | Owner MAY set lower via `setCustomSpendingLimit()` |

The effective limit is: `min(trust_level_default, user_custom_limit)`.

Spend limits reset at 00:00 UTC daily.

### 2.3 Time

No time-based constraints in the current model. Agents do not expire or lose trust levels over time. This is a deliberate design choice — trust levels are based on what security capabilities are set up, not on duration.

Future: if the WG defines time-window constraints for delegated authority, AgentID can implement them as an additional facet.

### 2.4 Reputation (Behavioural)

AgentID implements behavioural fingerprinting as a constraint facet:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Frequency spike | 50+ calls/hour (high severity) | Block action, fire webhook |
| Unusual hour | Activity outside typical window | Flag (medium severity) |
| New action type | Action never performed before | Flag (low severity) |
| Trust drop | Trust score decreased | Flag (high severity) |

Behavioural constraints are evaluated on every `connect` and `message` action. High-severity anomalies block the action. Medium/low severities are reported but do not block.

### 2.5 Reversibility (Payment Security)

For payment actions, AgentID evaluates additional sub-constraints:

| Check | Description |
|-------|-------------|
| Allowlist | Recipient wallet MUST be on owner's approved list |
| Cooling period | 24-hour delay on first payment to new wallet |
| Duplicate detection | Same amount + same recipient within 10 min = blocked |
| Per-recipient limit | L3: $500/day per wallet. L4: $10,000/day per wallet |
| Dual approval | L3: payments >$500 need owner confirmation. L4: >$50,000 |
| Freeze | Owner can freeze all agent payments instantly |
| Idempotency | `Idempotency-Key` header prevents duplicate execution on retry |

## 3. ConstraintEvaluation Schema

Following @desiorac's proposed format:

```json
{
  "facet": "scope | spend | time | reputation | reversibility",
  "limit": "the constraint boundary",
  "actual": "the value being evaluated",
  "delta": "distance from threshold (positive = within, negative = exceeded)",
  "result": "permit | deny | flag"
}
```

## 4. Test Vectors

### Vector 1: L1 agent attempts `connect` (PERMIT)

```json
{
  "id": "agentid-vec-001",
  "scenario": "L1 agent connects to another agent",
  "agent_trust_level": 1,
  "action": "connect",
  "expected_result": "permit",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": ["read", "discover", "verify", "send_message", "connect"],
      "actual": "connect",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "spend",
      "limit": 0,
      "actual": 0,
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "reputation",
      "limit": 50,
      "actual": 0,
      "delta": 50,
      "result": "permit"
    }
  ]
}
```

### Vector 2: L1 agent attempts `make_payment` (DENY)

```json
{
  "id": "agentid-vec-002",
  "scenario": "L1 agent attempts payment — no wallet, no permission",
  "agent_trust_level": 1,
  "action": "make_payment",
  "expected_result": "deny",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": ["read", "discover", "verify", "send_message", "connect"],
      "actual": "make_payment",
      "delta": -1,
      "result": "deny"
    }
  ]
}
```

### Vector 3: L3 agent pays $50 (PERMIT)

```json
{
  "id": "agentid-vec-003",
  "scenario": "L3 agent pays $50 — within default limit",
  "agent_trust_level": 3,
  "action": "make_payment",
  "amount_usd": 50,
  "expected_result": "permit",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": ["read", "discover", "verify", "send_message", "connect", "challenge_response", "handle_data", "make_payment", "access_paid_service"],
      "actual": "make_payment",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "spend",
      "limit": 10000,
      "actual": 50,
      "delta": 9950,
      "result": "permit"
    },
    {
      "facet": "reversibility",
      "limit": "allowlisted",
      "actual": "wallet_on_allowlist",
      "delta": 0,
      "result": "permit"
    }
  ]
}
```

### Vector 4: L3 agent pays $10,001 (DENY — exceeds daily limit)

```json
{
  "id": "agentid-vec-004",
  "scenario": "L3 agent pays $10,001 — exceeds default daily limit",
  "agent_trust_level": 3,
  "action": "make_payment",
  "amount_usd": 10001,
  "expected_result": "deny",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": ["read", "discover", "verify", "send_message", "connect", "challenge_response", "handle_data", "make_payment", "access_paid_service"],
      "actual": "make_payment",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "spend",
      "limit": 10000,
      "actual": 10001,
      "delta": -1,
      "result": "deny"
    }
  ]
}
```

### Vector 5: L3 agent pays $600 to new wallet (DENY — cooling period)

```json
{
  "id": "agentid-vec-005",
  "scenario": "L3 agent pays $600 to wallet not yet past 24h cooling period",
  "agent_trust_level": 3,
  "action": "make_payment",
  "amount_usd": 600,
  "expected_result": "deny",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": "make_payment in permissions",
      "actual": "make_payment",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "spend",
      "limit": 10000,
      "actual": 600,
      "delta": 9400,
      "result": "permit"
    },
    {
      "facet": "reversibility",
      "limit": "24h cooling period for new wallets",
      "actual": "wallet_first_seen_2h_ago",
      "delta": -22,
      "result": "deny"
    }
  ]
}
```

### Vector 6: L3 agent pays $600 — needs dual approval (FLAG)

```json
{
  "id": "agentid-vec-006",
  "scenario": "L3 agent pays $600 to allowlisted wallet past cooling — triggers dual approval",
  "agent_trust_level": 3,
  "action": "make_payment",
  "amount_usd": 600,
  "expected_result": "flag",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": "make_payment in permissions",
      "actual": "make_payment",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "spend",
      "limit": 10000,
      "actual": 600,
      "delta": 9400,
      "result": "permit"
    },
    {
      "facet": "reversibility",
      "limit": "dual_approval_threshold=500",
      "actual": 600,
      "delta": -100,
      "result": "flag"
    }
  ],
  "note": "Action proceeds only after owner confirms within 1-hour deadline"
}
```

### Vector 7: L2 agent with high-risk behavioural anomaly attempts connect (DENY)

```json
{
  "id": "agentid-vec-007",
  "scenario": "L2 agent with 50+ calls/hour tries to connect — behavioural block",
  "agent_trust_level": 2,
  "action": "connect",
  "expected_result": "deny",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": "connect in permissions",
      "actual": "connect",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "reputation",
      "limit": 50,
      "actual": 75,
      "delta": -25,
      "result": "deny"
    }
  ]
}
```

### Vector 8: L3 agent with user-lowered limit pays $200 (DENY)

```json
{
  "id": "agentid-vec-008",
  "scenario": "L3 agent owner set custom daily limit of $100 — agent tries $200",
  "agent_trust_level": 3,
  "action": "make_payment",
  "amount_usd": 200,
  "user_custom_limit": 100,
  "expected_result": "deny",
  "constraint_evaluations": [
    {
      "facet": "scope",
      "limit": "make_payment in permissions",
      "actual": "make_payment",
      "delta": 0,
      "result": "permit"
    },
    {
      "facet": "spend",
      "limit": 100,
      "actual": 200,
      "delta": -100,
      "result": "deny"
    }
  ],
  "note": "Effective limit is min(trust_default=$10000, user_custom=$100) = $100. Owner controls their own agent."
}
```

## 5. Implementation Reference

All constraint evaluations described in this document are implemented and tested:

- **TypeScript:** `dashboard/src/lib/trust-levels.ts`, `dashboard/src/lib/agent-spending.ts`, `dashboard/src/lib/payment-security.ts`, `dashboard/src/lib/behaviour.ts`
- **Python:** `sdk/python/agentid/trust_levels.py`, `sdk/python/agentid/spending.py`
- **API endpoints:** `POST /api/v1/agents/pay`, `POST /api/v1/agents/connect`, `POST /api/v1/agents/message`
- **Test suite:** 32/32 tests passing on live API with blockchain receipts

Live constraint enforcement proof:
https://explorer.solana.com/tx/41hqkLR9SGn3DGRaDSL6QSeRtU8MaC4Q7AgCGHNZyUxXsdaZFuDHL517v3B6jyhZ4Hf4Lz98cvdSiY6Jh9dXtuLQ?cluster=devnet

## 6. Conformance Requirements

Implementations of AgentID trust level constraints MUST satisfy:

- **CR-1:** Scope evaluation MUST follow the permission sets in §2.1 exactly.
- **CR-2:** Spend evaluation MUST use `min(trust_default, user_custom_limit)` as the effective limit.
- **CR-3:** Behavioural evaluation MUST NOT block actions below the high-severity threshold (50+ calls/hour).
- **CR-4:** Payment reversibility checks MUST evaluate allowlist, cooling period, duplicate detection, per-recipient limit, and dual approval in order.
- **CR-5:** All test vectors in §4 MUST produce the expected result.
- **CR-6:** Spending limits are defaults. Implementations MUST allow owners to set lower custom limits.
