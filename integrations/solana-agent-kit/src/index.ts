/**
 * AgentID Identity Provider for Solana Agent Kit
 *
 * Implements the IdentityProvider interface from the unified identity plugin
 * proposal (kai-agent-free). Allows any Solana agent to verify another agent's
 * identity and trust level by looking up its Solana wallet address on AgentID.
 *
 * Usage:
 *   import { AgentIdProvider } from "agentid-solana-identity";
 *   const provider = new AgentIdProvider();
 *   const result = await provider.verify("So1ana...WalletAddress");
 */

// ---------------------------------------------------------------------------
// Types — matches the unified identity plugin interface
// ---------------------------------------------------------------------------

export interface VerifyResult {
  verified: boolean;
  trust_level: string;
  trust_score: number;
  risk_score: number;
  scarring_score: number;
  attestation_count: number;
  did: string | null;
  agent_id: string | null;
  name: string | null;
  owner: string | null;
  description: string | null;
  capabilities: string[];
  certificate_valid: boolean;
  message: string;
}

export interface CredentialResult {
  has_credential: boolean;
  credential_type: string;
  agent_id: string | null;
  details: Record<string, unknown> | null;
  message: string;
}

/**
 * The IdentityProvider interface from the Solana Agent Kit unified identity
 * plugin proposal. This adapter implements it fully.
 */
export interface IdentityProvider {
  name: string;
  verify(wallet: string): Promise<VerifyResult>;
  checkCredential?(wallet: string, type: string): Promise<CredentialResult>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AgentIdProviderOptions {
  /** AgentID API base URL. Defaults to https://getagentid.dev/api/v1 */
  baseUrl?: string;
  /** Optional API key for authenticated requests (higher rate limits). */
  apiKey?: string;
  /** Request timeout in milliseconds. Defaults to 10000 (10s). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Default empty results — used on errors and not-found cases
// ---------------------------------------------------------------------------

function emptyVerifyResult(message: string): VerifyResult {
  return {
    verified: false,
    trust_level: "L0",
    trust_score: 0,
    risk_score: 0,
    scarring_score: 0,
    attestation_count: 0,
    did: null,
    agent_id: null,
    name: null,
    owner: null,
    description: null,
    capabilities: [],
    certificate_valid: false,
    message,
  };
}

function emptyCredentialResult(type: string, message: string): CredentialResult {
  return {
    has_credential: false,
    credential_type: type,
    agent_id: null,
    details: null,
    message,
  };
}

// ---------------------------------------------------------------------------
// AgentIdProvider — the main export
// ---------------------------------------------------------------------------

export class AgentIdProvider implements IdentityProvider {
  readonly name = "agentid";

  private baseUrl: string;
  private apiKey: string | undefined;
  private timeoutMs: number;

  constructor(options: AgentIdProviderOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.AGENTID_BASE_URL ||
      "https://getagentid.dev/api/v1";
    this.apiKey = options.apiKey || process.env.AGENTID_API_KEY;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  // -----------------------------------------------------------------------
  // verify(wallet) — core identity lookup
  // -----------------------------------------------------------------------

  /**
   * Look up a Solana wallet address on AgentID and return its trust data.
   *
   * Flow:
   *  1. GET /agents/discover to find an agent with this solana_address
   *  2. If found, POST /agents/verify to get full trust data
   *  3. GET /agents/trust-header to get trust JWT with risk/scarring scores
   *  4. Merge results into a VerifyResult
   *
   * Never throws — returns a safe L0/unknown result on any failure.
   */
  async verify(wallet: string): Promise<VerifyResult> {
    try {
      // Validate wallet address format (Solana base58, 32-44 chars)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        return emptyVerifyResult("Invalid Solana wallet address format");
      }

      // Step 1: Find the agent by Solana wallet address
      const agents = await this.discoverBySolanaAddress(wallet);
      if (!agents || agents.length === 0) {
        return emptyVerifyResult("No AgentID agent found for this Solana address");
      }

      // Use the first matching agent
      const agent = agents[0];
      const agentId: string = agent.agent_id;

      // Step 2: Full verify call to get trust level and permissions
      const verifyData = await this.verifyAgent(agentId);

      // Step 3: Get trust header for risk/scarring scores
      const trustHeader = await this.getTrustHeader(agentId);

      // Merge all data into a unified result
      return {
        verified: verifyData?.verified ?? false,
        trust_level: verifyData?.trust_level_label ?? trustHeader?.payload?.trust_level ?? "L0",
        trust_score: verifyData?.trust_score ?? 0,
        risk_score: trustHeader?.payload?.risk_score ?? 0,
        scarring_score:
          verifyData?.scarring_score ?? trustHeader?.payload?.scarring_score ?? 0,
        attestation_count:
          trustHeader?.payload?.attestation_count ?? 0,
        did: verifyData?.did ?? `did:web:getagentid.dev:agent:${agentId}`,
        agent_id: agentId,
        name: verifyData?.name ?? agent.name ?? null,
        owner: verifyData?.owner ?? agent.owner ?? null,
        description: verifyData?.description ?? agent.description ?? null,
        capabilities: verifyData?.capabilities ?? agent.capabilities ?? [],
        certificate_valid: verifyData?.certificate_valid ?? false,
        message: verifyData?.message ?? "Agent found",
      };
    } catch {
      // Never throw — return safe defaults
      return emptyVerifyResult("AgentID lookup failed — returning safe defaults");
    }
  }

  // -----------------------------------------------------------------------
  // checkCredential(wallet, type) — credential type check
  // -----------------------------------------------------------------------

  /**
   * Check if an agent (looked up by Solana wallet) has a specific credential.
   *
   * Credential types map to AgentID security capabilities:
   *  - "ed25519"    → agent has bound an Ed25519 key (L2+)
   *  - "wallet"     → agent has bound a crypto wallet (L3+)
   *  - "entity"     → agent owner has completed entity verification (L4)
   *  - "certificate" → agent has a valid, non-expired certificate
   *  - Any other string → checked against the agent's capabilities array
   *
   * Never throws.
   */
  async checkCredential(wallet: string, type: string): Promise<CredentialResult> {
    try {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        return emptyCredentialResult(type, "Invalid Solana wallet address format");
      }

      // Find the agent
      const agents = await this.discoverBySolanaAddress(wallet);
      if (!agents || agents.length === 0) {
        return emptyCredentialResult(type, "No AgentID agent found for this Solana address");
      }

      const agent = agents[0];
      const agentId: string = agent.agent_id;

      // Get full verification data
      const verifyData = await this.verifyAgent(agentId);
      if (!verifyData) {
        return emptyCredentialResult(type, "Failed to verify agent");
      }

      const normalizedType = type.toLowerCase().trim();

      // Check built-in credential types
      switch (normalizedType) {
        case "ed25519":
        case "ed25519_key": {
          // L2+ agents have Ed25519 keys bound
          const has = verifyData.supported_key_types?.includes("ed25519") ?? false;
          return {
            has_credential: has,
            credential_type: type,
            agent_id: agentId,
            details: has ? { key_type: "ed25519", trust_level: verifyData.trust_level_label } : null,
            message: has ? "Agent has Ed25519 key bound" : "Agent does not have Ed25519 key bound",
          };
        }

        case "wallet":
        case "crypto_wallet": {
          const hasWallet = !!(verifyData.wallet || verifyData.solana_wallet);
          return {
            has_credential: hasWallet,
            credential_type: type,
            agent_id: agentId,
            details: hasWallet
              ? { wallet: verifyData.wallet ?? verifyData.solana_wallet, trust_level: verifyData.trust_level_label }
              : null,
            message: hasWallet ? "Agent has crypto wallet bound" : "Agent does not have a wallet bound",
          };
        }

        case "entity":
        case "entity_verified": {
          // L4 agents have entity verification
          const trustLevel = verifyData.trust_level ?? 0;
          const isEntity = trustLevel >= 4;
          return {
            has_credential: isEntity,
            credential_type: type,
            agent_id: agentId,
            details: isEntity ? { trust_level: verifyData.trust_level_label } : null,
            message: isEntity ? "Agent owner has completed entity verification" : "Agent owner has not completed entity verification",
          };
        }

        case "certificate":
        case "cert": {
          const valid = verifyData.certificate_valid ?? false;
          return {
            has_credential: valid,
            credential_type: type,
            agent_id: agentId,
            details: valid ? { certificate_valid: true, trust_level: verifyData.trust_level_label } : null,
            message: valid ? "Agent has a valid certificate" : "Agent certificate is invalid or expired",
          };
        }

        default: {
          // Check against capabilities array
          const capabilities: string[] = verifyData.capabilities ?? [];
          const hasCapability = capabilities.some(
            (c: string) => c.toLowerCase() === normalizedType
          );

          // Also check the credentials array from discover
          const credentials: Array<{ type?: string }> = agent.credentials ?? [];
          const hasCredential = credentials.some(
            (c: { type?: string }) => c.type?.toLowerCase() === normalizedType
          );

          const found = hasCapability || hasCredential;
          return {
            has_credential: found,
            credential_type: type,
            agent_id: agentId,
            details: found
              ? {
                  source: hasCredential ? "credential" : "capability",
                  trust_level: verifyData.trust_level_label,
                }
              : null,
            message: found
              ? `Agent has "${type}" credential/capability`
              : `Agent does not have "${type}" credential/capability`,
          };
        }
      }
    } catch {
      return emptyCredentialResult(type, "AgentID credential check failed — returning safe defaults");
    }
  }

  // -----------------------------------------------------------------------
  // Private API helpers
  // -----------------------------------------------------------------------

  /**
   * Discover agents that have a specific Solana address bound.
   * Uses the /agents/discover endpoint and filters client-side since
   * the API does not yet support direct solana_address search.
   */
  private async discoverBySolanaAddress(wallet: string): Promise<any[] | null> {
    // The discover endpoint doesn't filter by solana_address directly,
    // so we fetch agents and check. For production scale, a dedicated
    // lookup endpoint would be better.
    //
    // Strategy: try the verify endpoint with a wallet-based lookup first.
    // If that fails, fall back to discover with a limit.

    try {
      // Try direct wallet lookup via discover
      const url = new URL(`${this.baseUrl}/agents/discover`);
      url.searchParams.set("limit", "100");

      const res = await this.fetchWithTimeout(url.toString(), { method: "GET" });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        agents?: Array<{
          agent_id: string;
          name?: string;
          owner?: string;
          description?: string;
          capabilities?: string[];
          credentials?: Array<{ type?: string }>;
          [key: string]: unknown;
        }>;
      };

      if (!data.agents) return null;

      // Filter by solana_address or wallet_address matching the wallet
      const matches = data.agents.filter((a) => {
        const solAddr = (a as any).solana_address;
        const walAddr = (a as any).wallet_address;
        return solAddr === wallet || walAddr === wallet;
      });

      return matches.length > 0 ? matches : null;
    } catch {
      return null;
    }
  }

  /**
   * POST /agents/verify — get full trust data for an agent.
   */
  private async verifyAgent(agentId: string): Promise<any | null> {
    try {
      const url = `${this.baseUrl}/agents/verify`;
      const res = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ agent_id: agentId }),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * GET /agents/trust-header — get the signed trust JWT with risk/scarring.
   */
  private async getTrustHeader(agentId: string): Promise<any | null> {
    try {
      const url = new URL(`${this.baseUrl}/agents/trust-header`);
      url.searchParams.set("agent_id", agentId);

      const res = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.headers(),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Build request headers. Includes auth if an API key is configured.
   */
  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "agentid-solana-identity/0.1.0",
    };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  /**
   * Fetch with a timeout using AbortController.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...this.headers(),
          ...(init.headers as Record<string, string> | undefined),
        },
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience factory — for quick one-liner usage
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured AgentIdProvider instance.
 *
 *   import { createAgentIdProvider } from "agentid-solana-identity";
 *   const provider = createAgentIdProvider();
 */
export function createAgentIdProvider(
  options?: AgentIdProviderOptions
): AgentIdProvider {
  return new AgentIdProvider(options);
}

// Default export for convenience
export default AgentIdProvider;
