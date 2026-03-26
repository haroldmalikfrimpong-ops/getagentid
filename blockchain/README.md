# AgentID On-Chain Registry (Solana)

An on-chain identity registry for AI agents. Agent identities are published to the Solana blockchain so anyone can verify them without trusting the AgentID server.

## How It Works

Every AgentID agent has an identity record (agent_id, owner, public key, trust level, certificate hash). When an agent is published on-chain:

1. The identity record is serialized to JSON
2. It's submitted as a **Memo transaction** on Solana — signed by the official AgentID registry keypair
3. The transaction hash becomes permanent, immutable proof the identity was registered
4. Anyone can verify by querying Solana for memo transactions from the registry address

No custom smart contract is needed. The Solana Memo Program v2 (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) is a standard program deployed on every Solana cluster that lets you attach arbitrary text (up to ~700 bytes) to a transaction.

### What Gets Published On-Chain

```json
{
  "protocol": "agentid",
  "version": 1,
  "agent_id": "agent_abc123def456",
  "owner": "Company Name",
  "public_key": "<first 128 chars of the agent's public key>",
  "trust_level": 2,
  "registered_at": "2026-03-26T12:00:00Z",
  "certificate_hash": "<sha256 of the full certificate>"
}
```

The full certificate is NOT stored on-chain (too large). Instead, a SHA-256 hash of the certificate is published. To verify: fetch the certificate from the AgentID API, hash it, and compare against the on-chain hash.

## Why Solana

- **Fast** — 400ms block times, transactions confirm in ~5 seconds
- **Cheap** — Memo transactions cost ~0.000005 SOL ($0.001) each
- **Ed25519 native** — Solana uses Ed25519 for all signatures, same as AgentID's identity layer. The cryptographic primitives are aligned
- **Immutable** — Once a transaction is confirmed, the memo record is permanent
- **Public** — Anyone can query Solana without an API key or account

## Setup

### 1. Install Dependencies

```bash
pip install solana solders
```

### 2. Generate a Registry Keypair

```bash
# Install Solana CLI tools if needed
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Generate a keypair for the registry authority
mkdir -p ~/.config/agentid
solana-keygen new --outfile ~/.config/agentid/registry-keypair.json
```

### 3. Fund on Devnet

```bash
solana airdrop 2 $(solana-keygen pubkey ~/.config/agentid/registry-keypair.json) --url devnet
```

### 4. Publish an Agent

```python
from blockchain.solana.registry import publish_agent_identity

result = publish_agent_identity(
    agent_id="agent_abc123",
    owner="Harold",
    public_key="<agent-public-key>",
    trust_level=2,
    certificate="<agent-certificate-string>",
)

print(result["tx_hash"])       # Solana transaction signature
print(result["explorer_url"])  # Link to Solana Explorer
```

### 5. Verify an Agent On-Chain

```python
from blockchain.solana.registry import verify_agent_onchain

record = verify_agent_onchain("agent_abc123")
if record:
    print(f"Found on-chain at tx {record['tx_hash']}")
    print(f"Trust level: {record['memo']['trust_level']}")
else:
    print("Not found on-chain")
```

### 6. API Endpoint

```bash
curl -X POST https://getagentid.dev/api/v1/agents/publish-onchain \
  -H "Authorization: Bearer agentid_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agent_abc123"}'
```

Response:
```json
{
  "tx_hash": "5K7x...",
  "explorer_url": "https://explorer.solana.com/tx/5K7x...?cluster=devnet",
  "registry_address": "...",
  "cluster": "devnet"
}
```

## Devnet vs Mainnet

| | Devnet | Mainnet |
|---|---|---|
| **Cost** | Free (airdrop SOL) | ~$0.001 per publish |
| **Persistence** | Wiped periodically | Permanent |
| **Use for** | Testing, MVP | Production |
| **RPC URL** | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` |

**Current status: DEVNET ONLY.** Set `SOLANA_RPC_URL` and `SOLANA_CLUSTER` environment variables to switch to mainnet when ready.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_CLUSTER` | `devnet` | Cluster name for Explorer URLs |
| `AGENTID_REGISTRY_KEYPAIR` | `~/.config/agentid/registry-keypair.json` | Path to registry keypair |

## Architecture

```
Agent Registration (API)
        |
        v
   +---------+
   | Supabase |  <-- source of truth for agent records
   +---------+
        |
        v  (publish-onchain endpoint)
   +----------+
   |  Solana   |  <-- immutable on-chain proof
   |  (Memo)   |
   +----------+
        |
        v
   Anyone can verify by querying
   Solana directly — no trust needed
```

The on-chain record is supplementary proof, not a replacement for the API. The API remains the primary way to register and manage agents. The blockchain provides an immutable, decentralized audit trail.
