# AgentID + qntm Encrypted Relay: Secure Agent-to-Agent Communication

Two AI agents with AgentID identities communicate through a qntm encrypted relay. AgentID provides organizational trust (who is this agent?). qntm provides encrypted transport (nobody can read the messages). Together they solve the two hardest problems in agent-to-agent communication: **identity** and **confidentiality**.

Built on [AgentID](https://getagentid.dev) and the [qntm relay protocol](https://qntm.dev).

## The Problem

Agents need to talk to each other. But:

- How does Agent A know Agent B is who it claims to be?
- How do they exchange data without the transport layer reading it?
- How does an organization prove it owns a particular agent?

## The Solution

```
Alice (AgentID)                    qntm Relay                    Bob (AgentID)
     |                                |                               |
     |-- Register with AgentID ------>|                               |
     |<-- certificate + agent_id -----|                               |
     |                                |<-- Register with AgentID -----|
     |                                |--- certificate + agent_id --->|
     |                                |                               |
     |-- Connect + challenge-response |                               |
     |<-- Authenticated --------------|                               |
     |                                |-- Connect + challenge-response|
     |                                |-- Authenticated ------------->|
     |                                |                               |
     |-- Key bundle + certificate --> |-- forward to Bob ------------>|
     |                                |                  verify cert  |
     |<------------ forward to Alice -|<-- Key bundle + certificate --|
     |  verify cert                   |                               |
     |                                |                               |
     |  X3DH key agreement           |         X3DH key agreement    |
     |  (shared secret established)   |   (shared secret established) |
     |                                |                               |
     |== Encrypted message =========>|== forward (opaque blob) =====>|
     |<= Encrypted reply ============|<= forward (opaque blob) ======|
     |                                |                               |
     |  Double Ratchet: new key       |  Relay NEVER sees plaintext   |
     |  per message (forward secrecy) |                               |
```

## How It Works

### 1. AgentID Registration

Each agent registers with the AgentID API and receives:
- A unique `agent_id`
- A signed JWT certificate (proof of identity)
- Cryptographic keys bound to the registry

```python
result = agentid.register(
    name="Alice - Research Agent",
    description="Market analysis agent",
    capabilities=["research", "encrypted-comms"],
)
# result.agent_id = "agent_a1b2c3d4..."
# result.certificate = "eyJhbGciOiJIUzI1NiJ9..."
```

### 2. Ed25519 + X25519 Keypairs

Each agent generates:
- **Ed25519 signing key** -- for authentication (challenge-response with the relay)
- **X25519 identity key** -- for X3DH key agreement
- **X25519 ephemeral prekey** -- rotated per session, enables forward secrecy

These keys are bound to the agent's AgentID -- the certificate proves the keypair belongs to a registered, verified agent.

### 3. qntm Relay Authentication (Challenge-Response)

```
Agent                          qntm Relay
  |-- "I am agent_abc123" ------->|
  |<-- challenge: 0xdeadbeef... --|
  |-- sign(challenge) ----------->|
  |<-- "Authenticated" -----------|
```

The relay issues a random 32-byte challenge. The agent signs it with its Ed25519 key. The relay verifies the signature. No passwords, no tokens -- just cryptographic proof.

### 4. Certificate Exchange and Verification

Before any data is exchanged, both agents:
1. Send their public key bundle (identity key, encryption key, ephemeral key, AgentID certificate)
2. Verify the other agent's AgentID certificate via the AgentID API
3. Confirm organizational trust: who owns this agent? Is its certificate valid?

This is the critical step. Without AgentID, you have encryption but no identity. With AgentID, you know *who* you're talking to.

### 5. X3DH Key Agreement

The [Extended Triple Diffie-Hellman](https://signal.org/docs/specifications/x3dh/) protocol establishes a shared secret between two agents who have never communicated before.

Four DH computations are combined:
- `DH1`: Alice's identity key x Bob's encryption key
- `DH2`: Alice's ephemeral key x Bob's identity key
- `DH3`: Alice's ephemeral key x Bob's encryption key
- `DH4`: Alice's ephemeral key x Bob's ephemeral key

The shared secret is derived via BLAKE2b over the concatenated DH outputs.

### 6. Double Ratchet Encryption

Each message uses a unique key derived from a ratcheting chain:

```
root_key --> chain_key_1 --> message_key_1 (encrypt msg 1)
                         --> chain_key_2 --> message_key_2 (encrypt msg 2)
                                         --> chain_key_3 --> message_key_3 ...
```

Properties:
- **Forward secrecy**: compromising a message key reveals nothing about past messages
- **Break-in recovery**: the DH ratchet step (on key exchange) heals from compromise
- **Message ordering**: each message carries a sequence number

The relay forwards encrypted envelopes without ever seeing plaintext.

## Setup

```bash
pip install -r requirements.txt
```

Dependencies:
- `PyNaCl` -- Ed25519 signing, X25519 key exchange, XSalsa20-Poly1305 encryption
- `httpx` -- HTTP client for AgentID API calls
- `cryptography` -- additional crypto primitives

Optional: set your AgentID API key for authenticated access (higher rate limits):

```bash
export AGENTID_API_KEY="your-key-here"
```

## Run

```bash
python demo.py
```

## Expected Output

```
======================================================================
  PHASE 1: Register Agents with AgentID
======================================================================

  [1] Registering Alice with AgentID...
      OK: agent_id = agent_a1b2c3d4e5f67890
      certificate = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...

  [2] Registering Bob with AgentID...
      OK: agent_id = agent_f9e8d7c6b5a43210
      certificate = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...

======================================================================
  PHASE 2: Generate Cryptographic Keys
======================================================================

  [3] Alice generates Ed25519 + X25519 keypairs...
      OK: Ed25519 verify key = 3a7f2b1c9e4d8f6a5b0c7d2e...
      OK: X25519 public key  = 8c1d4e7f2a5b9c0d3e6f8a1b...
      OK: Ephemeral prekey   = f0e1d2c3b4a59687c6d5e4f3...

  ...

======================================================================
  PHASE 6: Encrypted Message Exchange (Double Ratchet)
======================================================================

  [15] Alice encrypts and sends a message to Bob...
      Plaintext:  "Hey Bob, I found a promising signal in the gold futures market."
      Ciphertext: 9f8e7d6c5b4a3928171605f4e3d2c1b0a9f8e7d6c5b4a392...
      OK: Sent through qntm relay (relay sees only ciphertext).

  [16] Bob receives and decrypts Alice's message...
      OK: Decrypted: "Hey Bob, I found a promising signal in the gold futures market."

======================================================================
  COMPLETE: Secure Agent-to-Agent Communication
======================================================================

  Security properties:
    - End-to-end encryption (relay is zero-knowledge)
    - Forward secrecy (compromise of one key does not reveal past messages)
    - Identity verification (AgentID certificates prove organizational trust)
    - Mutual authentication (both sides verified before any data exchanged)
```

## Architecture Decisions

**Why Ed25519 + X25519?**
Ed25519 is the standard for digital signatures (fast, small keys, no side-channel issues). X25519 is the standard for key agreement. Together they give us authentication and encryption with the same curve family (Curve25519).

**Why X3DH?**
X3DH allows two parties to establish a shared secret even if one is offline. This is important for agents that may not be online simultaneously.

**Why Double Ratchet?**
The Double Ratchet provides forward secrecy per message. If an attacker compromises the current encryption key, they cannot decrypt past messages. This is critical for agents exchanging sensitive data (trading signals, PII, API keys).

**Why AgentID + qntm together?**
qntm provides the encrypted pipe. AgentID provides the identity inside the pipe. Without AgentID, you have encryption to an anonymous endpoint. With AgentID, you have encryption to a verified, organizationally-trusted agent.

## Production Notes

- Replace `QntmRelaySimulator` with a real WebSocket connection to `wss://relay.qntm.dev/v1`
- Implement full DH ratchet steps (not just symmetric ratchet) for complete forward secrecy
- Store prekey bundles server-side so agents can establish sessions asynchronously
- Add certificate revocation checking (AgentID supports this)
- Rate-limit connection attempts and implement exponential backoff
- Pin the relay's TLS certificate for defense-in-depth

## Links

- [AgentID](https://getagentid.dev) -- The identity layer for AI agents
- [qntm](https://qntm.dev) -- Encrypted relay infrastructure
- [Signal Protocol specs](https://signal.org/docs/) -- X3DH and Double Ratchet reference
- [Google A2A proposal](https://github.com/google/A2A) -- Agent-to-Agent protocol (where this was shared)
