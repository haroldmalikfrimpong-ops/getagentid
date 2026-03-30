# AgentID Proof Specification — v0.1 DRAFT

**Status:** DRAFT
**Authors:** haroldmalikfrimpong-ops (AgentID)
**Date:** 2026-03-28

---

## 1. Purpose

This spec defines how AgentID creates, signs, stores, and verifies cryptographic execution receipts. Every significant action (verification, connection, payment, key binding) produces a **dual receipt**: an instant HMAC-signed hash receipt and a best-effort Solana blockchain anchor. Optionally, a third-party attestation from ArkForge elevates the proof to the highest assurance level.

Receipts are the audit trail of the agent economy. They answer: "did this action actually happen, and can I prove it?"

## 2. Receipt Structure

Every receipt contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `receipt_id` | string (UUID v4) | Globally unique receipt identifier |
| `action` | string | Action type: `verification`, `connection`, `payment`, `handoff`, `challenge`, `registration`, `ed25519_bound`, `message` |
| `agent_id` | string | The agent that performed or was the subject of the action |
| `timestamp` | string (ISO 8601) | When the receipt was created |
| `data_hash` | string (hex) | SHA-256 hash of `{action, agent_id, data, timestamp}` |
| `signature` | string (hex) | HMAC-SHA256 signature (see 3) |
| `verification_url` | string (URL) | Public proof endpoint: `https://getagentid.dev/proof/{receipt_id}` |

### 2.1 Blockchain Anchor (optional)

If Solana publishing is configured, the receipt also includes:

| Field | Type | Description |
|-------|------|-------------|
| `tx_hash` | string | Solana transaction signature |
| `cluster` | string | `devnet` or `mainnet-beta` |
| `explorer_url` | string (URL) | Solana Explorer link |
| `block_time` | integer | Unix timestamp of the Solana block |
| `memo` | string | The memo data written on-chain |

### 2.2 ArkForge Attestation (optional)

If `ARKFORGE_API_KEY` is configured, the receipt is submitted to ArkForge for independent third-party attestation:

| Field | Type | Description |
|-------|------|-------------|
| `arkforge_proof_id` | string | ArkForge proof identifier |
| `arkforge_verification_url` | string (URL) | ArkForge public verification link |

### 2.3 Attestation Level

| Level | Value | Condition |
|-------|-------|-----------|
| Self-Issued | `self-issued` | HMAC-SHA256 signed by platform key only |
| Domain-Attested | `domain-attested` | Solana `tx_hash` exists (on-chain anchor) |
| Third-Party-Attested | `third-party-attested` | ArkForge `proof_id` exists (external attestation) |

The attestation level is stored alongside the receipt and returned by the public proof endpoint.

## 3. HMAC-SHA256 Signing

### 3.1 Data Hash

The `data_hash` is computed as:

```
data_hash = SHA-256(JSON.stringify({ action, agent_id, data, timestamp }))
```

Where `data` is the action-specific payload (e.g., trust level, connection parties, payment amount).

### 3.2 Signature

The `signature` is computed as:

```
signature = HMAC-SHA256(key=JWT_SECRET, message="{receipt_id}:{action}:{agent_id}:{data_hash}:{timestamp}")
```

The signing key is the platform's `JWT_SECRET` environment variable. This is the same key used to sign agent certificates and trust headers, creating a unified trust anchor.

### 3.3 Signature Format

- Algorithm: HMAC-SHA256
- Output: lowercase hexadecimal string (64 characters)
- Input: colon-delimited string of receipt fields

## 4. Chain Hash

Receipts form an implicit chain through their timestamps and data hashes. Each receipt's `data_hash` covers the action payload and timestamp, creating a temporal ordering. Combined with the Solana blockchain anchor (which provides an independent timestamp from the network), this creates a tamper-evident sequence.

The chain can be verified by:

1. Recomputing each `data_hash` from the stored action data
2. Verifying each `signature` against the platform key
3. Confirming Solana `tx_hash` transactions exist on-chain (if `domain-attested` or higher)

## 5. Solana Anchoring

### 5.1 Memo Program

Receipts are anchored on Solana using the **Memo Program** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`). The memo payload contains:

```json
{
  "protocol": "agentid",
  "version": 1,
  "receipt_id": "uuid",
  "action": "verification",
  "agent_id": "agent_xxx",
  "data_hash": "sha256hex...",
  "timestamp": "2026-03-28T12:00:00.000Z",
  "auth_context": {
    "trust_level": 2,
    "permissions": ["read", "discover", "verify", "send_message", "connect", "challenge_response", "handle_data"]
  }
}
```

### 5.2 Registry Keypair

The memo transaction is signed by the AgentID registry keypair, loaded from `AGENTID_REGISTRY_KEYPAIR_JSON` (a JSON array of 64 secret-key bytes). This keypair is the on-chain identity of the AgentID platform.

### 5.3 Best-Effort Guarantee

Blockchain anchoring is non-blocking. If the Solana RPC is unavailable, the keypair is not configured, or the transaction fails, the hash receipt is still created and stored. The `attestation_level` will be `self-issued` instead of `domain-attested`.

## 6. ArkForge External Attestation

### 6.1 Submission

When `ARKFORGE_API_KEY` is set, the receipt data is submitted to:

```
POST https://trust.arkforge.tech/v1/proxy
Authorization: Bearer {ARKFORGE_API_KEY}
Content-Type: application/json

{
  "target": "https://getagentid.dev/api/v1/agents/{action}",
  "payload": {
    "protocol": "agentid",
    "version": 1,
    "receipt_id": "uuid",
    "action": "verification",
    "agent_id": "agent_xxx",
    "data_hash": "sha256hex...",
    "signature": "hmacsha256hex...",
    "timestamp": "2026-03-28T12:00:00.000Z",
    "tx_hash": "solanatxhash..."
  }
}
```

### 6.2 Non-Blocking

ArkForge submission is best-effort. Failures are logged but never block the caller. If submission succeeds, the `attestation_level` is elevated to `third-party-attested`.

## 7. Verification Procedure

### 7.1 Online Verification

Any party can verify a receipt by calling:

```
GET https://getagentid.dev/proof/{receipt_id}
```

This returns the full receipt with hash, signature, blockchain anchor, ArkForge attestation, and attestation level. No authentication required.

### 7.2 Offline Verification

A party with access to the platform's signing key can verify offline:

1. Parse the receipt fields: `receipt_id`, `action`, `agent_id`, `data_hash`, `timestamp`
2. Recompute: `expected = HMAC-SHA256(key, "{receipt_id}:{action}:{agent_id}:{data_hash}:{timestamp}")`
3. Compare `expected` to the stored `signature`
4. If they match, the receipt is authentic

### 7.3 Blockchain Verification

For `domain-attested` receipts:

1. Look up `tx_hash` on Solana Explorer (or via RPC `getTransaction`)
2. Decode the memo data from the transaction
3. Verify `receipt_id` and `data_hash` in the memo match the receipt

### 7.4 Third-Party Verification

For `third-party-attested` receipts:

1. Visit `arkforge_verification_url`
2. ArkForge independently confirms the proof exists and matches

## 8. Public Proof URL Format

All receipts are publicly accessible at:

```
https://getagentid.dev/proof/{receipt_id}
```

The response includes:

- Receipt identity (receipt_id, action, agent info, DID)
- Cryptographic hashes (data_hash, HMAC signature)
- Blockchain anchor (if domain-attested)
- ArkForge attestation (if third-party-attested)
- Attestation level
- Links to agent profile, credibility packet, DID document, and trust header

Responses are cached with `Cache-Control: public, max-age=3600`.

## 9. Database Schema

The `action_receipts` table stores all receipt data:

| Column | Type | Description |
|--------|------|-------------|
| `receipt_id` | text (PK) | UUID v4 |
| `action` | text | Action type |
| `agent_id` | text | Agent identifier |
| `timestamp` | timestamptz | Creation time |
| `data_hash` | text | SHA-256 of action data |
| `signature` | text | HMAC-SHA256 signature |
| `tx_hash` | text | Solana tx signature (nullable) |
| `cluster` | text | Solana cluster (nullable) |
| `explorer_url` | text | Solana Explorer URL (nullable) |
| `block_time` | bigint | Solana block time (nullable) |
| `memo` | text | Solana memo content (nullable) |
| `attestation_level` | text | `self-issued`, `domain-attested`, or `third-party-attested` |
| `arkforge_proof_id` | text | ArkForge proof ID (nullable) |
| `arkforge_verification_url` | text | ArkForge verification URL (nullable) |
| `raw_data` | jsonb | Full action payload |

## 10. Security Considerations

### 10.1 Signing Key

The `JWT_SECRET` must be a strong random value (64+ hex characters). It is never exposed in API responses. Compromise of this key would allow forging receipts.

### 10.2 Immutability

Once created, receipts are never modified. The Solana anchor provides an independent immutability guarantee — even if the database is compromised, the on-chain record remains.

### 10.3 Non-Repudiation

The combination of HMAC signature + Solana anchor + ArkForge attestation provides three independent layers of non-repudiation. An agent cannot deny an action if all three layers confirm it.

---

## References

- RFC 2104 — HMAC: Keyed-Hashing for Message Authentication
- FIPS 180-4 — Secure Hash Standard (SHA-256)
- Solana Memo Program — MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
- AgentID Trust Levels — specs/trust-levels-v1.0.md
- Agent-Trust-Score Header — specs/agent-trust-score-header-v0.1.md

---

<p align="center">
  Draft spec — open for review and contribution
</p>
