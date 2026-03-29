# Agent-Trust-Score HTTP Header — v0.1 DRAFT

**Status:** DRAFT
**Authors:** haroldmalikfrimpong-ops (AgentID), 0xbrainkid (SATP)
**Date:** 2026-03-29

---

## §1 Purpose

This spec defines a standard HTTP header for transmitting agent trust information with every request. Websites and services verify agent trust without a round-trip to any registry — the proof travels with the request.

```
Agent-Trust-Score: eyJhbGciOiJFZDI1NTE5...
```

Like `Sec-CH-UA` for browser hints, `Agent-Trust-Score` lets receiving services make trust decisions at the transport layer.

## §2 Header Format

The header value is a Base64url-encoded signed JWT.

### §2.1 JWT Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trust_level` | integer | Yes | 1-4 graduated scale (L1 Registered → L4 Certified) |
| `attestation_count` | integer | Yes | Number of independent verifications |
| `last_verified` | string | Yes | ISO 8601 UTC timestamp of last verification |
| `risk_score` | integer | Yes | Behavioural anomaly score (0 = clean, 100 = compromised) |
| `scarring_score` | integer | Yes | Lifetime negative incident count (scars never heal) |
| `negative_signals` | integer | No | Count of unresolved negative events |
| `resolved_signals` | integer | No | Count of resolved incidents |
| `agent_id` | string | Yes | Unique agent identifier |
| `did` | string | No | W3C Decentralized Identifier |
| `provider` | string | Yes | Trust provider identifier (e.g. `agentid`, `satp`, `agentscore`) |
| `iss` | string | Yes | Issuer URL |
| `iat` | integer | Yes | Issued at (Unix timestamp) |
| `exp` | integer | Yes | Expires at (Unix timestamp) — MUST be short-lived (max 1 hour) |

### §2.2 JWT Header

```json
{
  "alg": "Ed25519",
  "typ": "Agent-Trust-Score"
}
```

Supported algorithms: `Ed25519` (preferred), `ES256` (ECDSA P-256).

### §2.3 Signature

The JWT is signed by the trust provider's key. Verifiers check the signature against the provider's published public key at `/.well-known/did.json` or `/v1/pubkey`.

### §2.4 Example

**Decoded payload:**
```json
{
  "trust_level": 3,
  "attestation_count": 43,
  "last_verified": "2026-03-29T14:00:00Z",
  "risk_score": 0,
  "scarring_score": 2,
  "negative_signals": 2,
  "resolved_signals": 2,
  "agent_id": "agent_c5460451b4344268",
  "did": "did:web:getagentid.dev:agent:agent_c5460451b4344268",
  "provider": "agentid",
  "iss": "https://getagentid.dev",
  "iat": 1743260400,
  "exp": 1743264000
}
```

**HTTP request:**
```http
GET /api/data HTTP/1.1
Host: example.com
Agent-Trust-Score: eyJhbGciOiJFZDI1NTE5IiwidHlwIjoiQWdlbnQtVHJ1c3QtU2NvcmUifQ...
```

## §3 Trust Level Scale

| Level | Name | Meaning |
|-------|------|---------|
| 1 | Registered | Agent has a valid certificate |
| 2 | Verified | Ed25519 key bound — cryptographic proof of key possession |
| 3 | Secured | Wallet bound — payment capable, spending limits enforced |
| 4 | Certified | Entity verified — legal organisation confirmed |

## §4 Verification Procedure

A receiving service verifies the header in 3 steps:

1. **Decode** the Base64url JWT
2. **Check `exp`** — reject if expired (max 1 hour validity)
3. **Verify signature** against the provider's published public key

No API call needed. The trust data is self-contained and cryptographically signed.

### §4.1 Provider Key Discovery

The provider's public key is discoverable at:

| Method | Endpoint |
|--------|----------|
| DID Document | `GET /.well-known/did.json` → find `Ed25519VerificationKey2020` |
| Direct | `GET /v1/pubkey` → `{"pubkey": "ed25519:<base64url>"}` |

Verifiers SHOULD cache provider keys with a TTL of 24 hours.

### §4.2 Trust Decision Matrix

Services make their own trust decisions. Suggested thresholds:

| Action | Minimum Trust Level | Max Risk Score |
|--------|-------------------|----------------|
| Read public data | 1 | Any |
| Write data | 2 | < 50 |
| Financial operations | 3 | < 20 |
| Autonomous operations | 4 | < 10 |

These are recommendations, not requirements. Each service sets its own policy.

## §5 Multi-Provider Support

The header supports multiple trust providers. A single agent may carry trust scores from different systems:

```http
Agent-Trust-Score: <agentid-jwt>
Agent-Trust-Score: <satp-jwt>
```

Multiple headers are permitted per RFC 9110 §5.3. Services evaluate all provided scores and apply their own policy (e.g., require at least 2 providers, use the lowest trust level, average risk scores).

## §6 Generation

### §6.1 From AgentID

```
GET /api/v1/agents/trust-header?agent_id=agent_xxx
→ { "header": "eyJ...", "expires_in": 3600 }
```

The header is derived from the agent's credibility packet, signed with the platform's Ed25519 key, and valid for 1 hour.

### §6.2 From Other Providers

Any trust provider can generate conformant headers by:

1. Assembling the payload (§2.1)
2. Signing with their Ed25519 or ECDSA key
3. Publishing their verification key at `/.well-known/did.json`

## §7 Security Considerations

### §7.1 Short-Lived Tokens

Headers MUST expire within 1 hour (`exp - iat <= 3600`). This limits the window for replay attacks.

### §7.2 No Sensitive Data

The header contains trust metadata only — no credentials, no private keys, no session tokens.

### §7.3 Signature Verification

Services MUST verify the JWT signature before trusting any field. An unsigned or invalid header MUST be treated as absent.

### §7.4 Provider Trust

Services decide which providers they trust. A header from an unknown provider SHOULD be ignored, not rejected — the agent may have other valid headers.

## §8 Conformance

**CR-1:** A conformant header MUST contain all required fields from §2.1.

**CR-2:** A conformant header MUST be signed with Ed25519 or ES256.

**CR-3:** A conformant header MUST expire within 1 hour of issuance.

**CR-4:** A conformant verifier MUST check the signature before reading any payload field.

**CR-5:** A conformant verifier MUST reject expired headers.

---

## References

- RFC 9110 — HTTP Semantics (§5.3 Header Fields)
- RFC 7519 — JSON Web Token (JWT)
- RFC 8032 — Edwards-Curve Digital Signature Algorithm (Ed25519)
- AgentID Trust Levels — getagentid.dev/docs
- SATP Agent Trust Protocol — agentfolio.ai

---

<p align="center">
  Draft spec — open for review and contribution
</p>
