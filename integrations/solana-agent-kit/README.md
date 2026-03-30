# agentid-solana-identity

AgentID identity provider adapter for the [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) unified identity plugin. Lets Solana agents verify other agents' identity and trust level by looking up their Solana wallet address on [AgentID](https://getagentid.dev).

## Install

```bash
npm install agentid-solana-identity
```

## Quick Start

```typescript
import { AgentIdProvider } from "agentid-solana-identity";

const provider = new AgentIdProvider();

// Verify an agent by its Solana wallet address
const result = await provider.verify("So1ana...WalletAddress");
console.log(result);
// {
//   verified: true,
//   trust_level: "L3 — Secured",
//   trust_score: 0.85,
//   risk_score: 0,
//   scarring_score: 0,
//   attestation_count: 42,
//   did: "did:web:getagentid.dev:agent:agentid_abc123",
//   agent_id: "agentid_abc123",
//   name: "Trading Bot",
//   owner: "Malik",
//   description: "Automated DeFi trading agent",
//   capabilities: ["trade", "analyze"],
//   certificate_valid: true,
//   message: "Agent verified"
// }

// Check if an agent has a specific credential
const cred = await provider.checkCredential("So1ana...WalletAddress", "ed25519");
console.log(cred);
// {
//   has_credential: true,
//   credential_type: "ed25519",
//   agent_id: "agentid_abc123",
//   details: { key_type: "ed25519", trust_level: "L3 — Secured" },
//   message: "Agent has Ed25519 key bound"
// }
```

## Usage with Solana Agent Kit Unified Identity Plugin

```typescript
import { AgentIdProvider } from "agentid-solana-identity";

// The provider implements the IdentityProvider interface:
// interface IdentityProvider {
//   name: string;
//   verify(wallet: string): Promise<VerifyResult>;
//   checkCredential?(wallet: string, type: string): Promise<CredentialResult>;
// }

const agentid = new AgentIdProvider();

// Register it with the unified identity plugin
identityPlugin.registerProvider(agentid);

// Now any Solana agent can look up trust data for another agent
// by wallet address, using AgentID as the identity backend.
```

## Configuration

```typescript
const provider = new AgentIdProvider({
  // Optional: custom API base URL (default: https://getagentid.dev/api/v1)
  baseUrl: "https://getagentid.dev/api/v1",

  // Optional: API key for authenticated requests (higher rate limits)
  apiKey: "agentid_sk_...",

  // Optional: request timeout in ms (default: 10000)
  timeoutMs: 10000,
});
```

Environment variables are also supported:

| Variable            | Description                       |
| ------------------- | --------------------------------- |
| `AGENTID_BASE_URL`  | Override the API base URL         |
| `AGENTID_API_KEY`   | API key for authenticated access  |

## Credential Types

The `checkCredential` method supports these built-in types:

| Type               | What it checks                                           |
| ------------------ | -------------------------------------------------------- |
| `ed25519`          | Agent has bound an Ed25519 key (trust level L2+)         |
| `wallet`           | Agent has bound a crypto wallet (trust level L3+)        |
| `entity`           | Agent owner completed entity verification (trust level L4) |
| `certificate`      | Agent has a valid, non-expired certificate               |
| *(any other string)* | Checked against the agent's capabilities and credentials |

## Trust Levels

AgentID trust levels are capability-based, not time-based:

| Level | Name         | Requirements                        |
| ----- | ------------ | ----------------------------------- |
| L1    | Registered   | Agent registered, certificate issued |
| L2    | Verified     | Ed25519 key bound                    |
| L3    | Secured      | Crypto wallet bound                  |
| L4    | Certified    | Entity verification completed        |

## Error Handling

The provider never throws exceptions. On any failure (network error, API error, agent not found), it returns safe default values:

- `verify()` returns `{ verified: false, trust_level: "L0", trust_score: 0, ... }`
- `checkCredential()` returns `{ has_credential: false, ... }`

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## License

MIT
