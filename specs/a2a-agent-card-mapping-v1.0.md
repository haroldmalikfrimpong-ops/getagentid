# A2A Agent Card Mapping Specification v1.0

**Author:** @laplace0x (Agent Laplace), @haroldmalikfrimpong-ops (AgentID)
**Status:** DRAFT
**Date:** 2026-04-04
**Spec ID:** AAC-1
**Discussion:** https://github.com/erc-8004/erc-8004-contracts/issues/71, https://github.com/a2aproject/A2A/discussions/1631

## Abstract

This specification defines how AgentID profiles map to Google A2A-compatible agent cards, enabling interoperability between AgentID's identity/trust layer and the A2A agent-to-agent protocol.

The mapping is **dynamic** (computed on request from live Firestore data) so trust scores, behavioral metrics, and capability declarations are always current.

## 1. Motivation

Agent identity is fragmented. An agent registered on ERC-8004 across multiple chains, with trust scores in AgentID, cannot be discovered by A2A-compliant agents without a standardized bridge.

This spec creates that bridge: one endpoint (`/agent/{id}/agent-card.json`) that translates AgentID's rich identity data into the A2A Agent Card format, with trust and reputation data surfaced via the `extensions` mechanism.

## 2. Field Mapping

### 2.1 Core Fields

| AgentID field | A2A Agent Card field | Notes |
|---|---|---|
| `name` | `name` | Direct mapping |
| `description` | `description` | Direct mapping |
| `endpoint` | `url` | Falls back to AgentID profile URL if no endpoint set |
| — | `version` | Always `"1.0.0"` (card format version) |
| — | `capabilities` | A2A protocol capabilities (streaming, push, etc.) |

### 2.2 Capabilities → Skills

Each AgentID capability maps to one A2A `skill` object:

| AgentID `capabilities[]` | A2A `skills[]` |
|---|---|
| capability name | `skills[].id` (kebab-case) |
| capability name | `skills[].name` (display name) |
| catalog or generated | `skills[].description` |
| catalog or default | `skills[].inputModes` |
| catalog or default | `skills[].outputModes` |

A **skill catalog** maps well-known capabilities (e.g., `market-analysis`, `trading`, `code-review`) to richer A2A skill objects with proper input/output modes. Unknown capabilities get a generic mapping so no data is lost.

### 2.3 Trust & Reputation → Extensions

All trust and reputation data lives in the `extensions.agentid` namespace:

```json
{
  "uri": "https://getagentid.dev/extensions/agentid/v1",
  "required": false,
  "config": {
    "agent_id": "abc-123",
    "provider": "agentid",

    "trust_level": 3,
    "trust_level_name": "SECURED",
    "trust_score": 0.87,

    "context_continuity_score": 0.92,
    "scarring_score": 0.05,

    "erc8004_reputation": {
      "tradingYield": 0.15,
      "successRate": 0.68,
      "responseTime": 0.95,
      "revenues": 1250.00
    },

    "wallet_bindings": [
      {"chain": "ethereum", "chain_id": 1, "address": "0x..."},
      {"chain": "base", "chain_id": 8453, "address": "0x..."},
      {"chain": "solana", "address": "DPi7d2..."}
    ],

    "verification_url": "https://getagentid.dev/agent/abc-123",
    "did_document_url": "https://getagentid.dev/agent/abc-123/did.json"
  }
}
```

#### Extension fields

| Field | Type | Description |
|---|---|---|
| `trust_level` | int (1-4) | Capability-based trust level per ATL-1 spec |
| `trust_level_name` | string | Human-readable: REGISTERED, VERIFIED, SECURED, CERTIFIED |
| `trust_score` | float (0.0-1.0) | Behavioral trust score |
| `context_continuity_score` | float or null | 30-day behavioral baseline consistency |
| `scarring_score` | float or null | Lifetime incident history (lower is better) |
| `erc8004_reputation` | object or null | Domain-specific reputation tags from ERC-8004 |
| `wallet_bindings` | array or null | Bound wallet addresses with chain info |
| `verification_url` | string | URL to verify this agent's identity |
| `did_document_url` | string | URL to the agent's DID document |

### 2.4 Authentication Schemes

AgentID verification methods map to A2A `authentication.schemes[]`:

| AgentID verification | A2A auth scheme | Available at |
|---|---|---|
| API key | `{"scheme": "apiKey", "in": "header", "name": "Authorization"}` | All levels (L1+) |
| Ed25519 key binding | `{"scheme": "ed25519-challenge", ...}` | L2+ only |

The Ed25519 scheme includes `challengeEndpoint` and `verifyEndpoint` URLs for the challenge-response flow.

## 3. Design Decisions

### 3.1 Dynamic, not static

Cards are computed on every request from live Firestore data. Trust scores change, context continuity changes, scarring changes. A static card goes stale.

Latency is manageable — the DID doc endpoint already returns in <200ms from the same data source.

### 3.2 ETag + Last-Modified for smart caching

Despite being dynamic, the endpoint supports conditional requests:
- `ETag` header (SHA-256 hash of card content, truncated to 16 chars)
- `Last-Modified` header (request timestamp)
- `If-None-Match` support (returns 304 if unchanged)
- `Cache-Control: public, max-age=60, must-revalidate`

This lets consumers cache aggressively while still getting fresh data on revalidation.

### 3.3 Trust as extension, not core

Trust data lives in `extensions`, not in core A2A fields. This means:
- AgentID-aware consumers can read and act on trust data
- A2A consumers that don't know about AgentID ignore it gracefully
- No pollution of the core Agent Card schema

### 3.4 Domain-specific reputation over flat scores

ERC-8004 reputation tags (`tradingYield`, `successRate`, `responseTime`, `revenues`) are surfaced individually, not collapsed into a single number. An agent trusted for trading may be unproven for code review. Consumers can weight dimensions based on their task.

### 3.5 Skill catalog with fallback

Well-known capabilities get rich A2A skill objects (proper input/output modes, detailed descriptions). Unknown capabilities get a generic mapping. This ensures:
- No capability is lost in translation
- Common capabilities get standardized representation
- The catalog is extensible without code changes

## 4. Endpoint Reference

### `GET /agent/{agent_id}/agent-card.json`

Returns A2A-compatible agent card with AgentID extensions.

**Response headers:**
- `Cache-Control: public, max-age=60, must-revalidate`
- `Last-Modified: <RFC 7231 date>`
- `ETag: "<hash>"`
- `X-AgentID: <agent_id>`
- `X-Trust-Level: <1-4>`

**Response:** A2A Agent Card JSON.

**Errors:**
- `404` — Agent not found
- `304` — Not Modified (if `If-None-Match` matches current ETag)

### `GET /.well-known/agent-card.json`

Returns AgentID platform's own A2A agent card (describes AgentID itself as an A2A service).

## 5. Relationship to DID Documents

The agent card and DID document are **complementary views of the same data**:

| Aspect | DID Document | A2A Agent Card |
|---|---|---|
| **Purpose** | Cryptographic identity verification | Agent capability discovery + task routing |
| **Audience** | Identity verifiers, wallets | A2A agents seeking collaborators |
| **Format** | W3C DID Core | A2A Agent Card spec |
| **Trust data** | Verification methods | Trust scores + reputation extensions |
| **Endpoint** | `/agent/{id}/did.json` | `/agent/{id}/agent-card.json` |

Both are served from the same Firestore data. Both are dynamic.

## 6. Future Work

1. **Attestation surface integration** — embed provider-neutral attestations (per A2A #1631 discussion) alongside the AgentID extension
2. **Per-skill trust scores** — `scores_by_capability` keyed to `skills[].id`, not just aggregate scores
3. **Behavioral test provenance** — link to agent-security-harness results via `evidence_ref` in the extension
4. **A2A agent card → DID document auto-generation** — reverse mapping for A2A-native agents that want AgentID identity

## 7. References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [AgentID Trust Levels v1.0](./trust-levels-v1.0.md)
- [ERC-8004 Contracts](https://github.com/erc-8004/erc-8004-contracts)
- [A2A Discussion #1631 — Reputation-Aware Agent Discovery](https://github.com/a2aproject/A2A/discussions/1631)
- [A2A Discussion #1708 — Agent Infrastructure Lessons](https://github.com/a2aproject/A2A/discussions/1708)
