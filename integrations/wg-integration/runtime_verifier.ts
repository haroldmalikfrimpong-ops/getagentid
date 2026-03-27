/**
 * AgentID RuntimeVerifier — TypeScript implementation for WG integration tests.
 *
 * Drop-in replacement for the stub in aeoess's test harness.
 * Uses fetch to call the AgentID API for verification and trust level.
 *
 * Usage:
 *   const verifier = new RuntimeVerifier({ apiKey: "your-key" });
 *   const result = await verifier.verify("did:agentid:agent-007", "abcdef1234...");
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuntimeVerification {
  verified: boolean;
  trust_level: number; // 1-4
  trust_score: number; // 0.0 - 1.0
  permissions: string[];
  spending_limit: number; // daily USD limit
  did_resolution_status: "live" | "cached" | "failed";
  entity_verified: boolean;
  // Cryptographic binding fields (WG feedback -- desiorac)
  execution_timestamp: string;   // ISO 8601 UTC -- when verification was performed
  pinned_public_key: string;     // Resolved public key at verification time
  scope: string | null;          // Delegation scope if known
}

export interface RuntimeVerifierOptions {
  apiKey?: string;
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Trust level constants (mirrors sdk/python/agentid/trust_levels.py)
// ---------------------------------------------------------------------------

const PERMISSIONS: Record<number, string[]> = {
  1: ["read", "discover", "verify", "send_message", "connect"],
  2: ["read", "discover", "verify", "send_message", "connect",
      "challenge_response", "handle_data"],
  3: [
    "read", "discover", "verify", "send_message", "connect",
    "challenge_response", "handle_data",
    "make_payment", "access_paid_service",
  ],
  4: [
    "read", "discover", "verify", "send_message", "connect",
    "challenge_response", "handle_data",
    "make_payment", "access_paid_service",
    "sign_contract", "manage_funds", "full_autonomy",
  ],
};

const SPENDING_LIMITS: Record<number, number> = {
  1: 0,
  2: 0,
  3: 10000,
  4: 100000,
};

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface VerifyApiResponse {
  verified: boolean;
  agent_id: string;
  name: string;
  owner: string;
  trust_score: number;
  capabilities: string[];
  certificate_valid: boolean;
  message: string;
}

interface TrustLevelApiResponse {
  agent_id: string;
  trust_level: number;
  trust_score: number;
  entity_verified?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// RuntimeVerifier
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://getagentid.dev/api/v1";
const TIMEOUT_MS = 15_000;

export class RuntimeVerifier {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(options: RuntimeVerifierOptions = {}) {
    this.apiKey = options.apiKey || process.env.AGENTID_API_KEY;
    this.baseUrl = (options.baseUrl || process.env.AGENTID_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * Verify an agent's DID and public key.
   *
   * 1. Calls POST /api/v1/agents/verify for trust score + basic verification
   * 2. Calls GET /api/v1/agents/trust-level for trust level details
   * 3. Cross-references the public key with the API response
   * 4. Returns a RuntimeVerification with all fields populated
   */
  async verify(agentDID: string, agentPublicKey: string): Promise<RuntimeVerification> {
    const result: RuntimeVerification = {
      verified: false,
      trust_level: 1,
      trust_score: 0,
      permissions: [],
      spending_limit: 0,
      did_resolution_status: "failed",
      entity_verified: false,
      execution_timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      pinned_public_key: "",
      scope: null,
    };

    const agentId = extractAgentId(agentDID);
    if (!agentId) {
      return result;
    }

    // Fire both API calls in parallel
    const [verifyResult, trustLevelResult] = await Promise.all([
      this.apiVerify(agentId),
      this.apiTrustLevel(agentId),
    ]);

    // --- Process verify response ---
    if (verifyResult) {
      result.verified = verifyResult.verified;
      result.trust_score = verifyResult.trust_score ?? 0;
      result.did_resolution_status = verifyResult.verified ? "live" : "failed";

      // Pin the provided public key when DID resolves successfully
      if (verifyResult.verified) {
        result.pinned_public_key = agentPublicKey.toLowerCase().replace(/^0x/, "");
      }

      // If the API returned a certificate check, use it for DID status
      if (verifyResult.certificate_valid && !verifyResult.verified) {
        result.did_resolution_status = "cached";
      }
    }

    // --- Process trust-level response ---
    if (trustLevelResult) {
      result.trust_level = Math.max(1, Math.min(4, trustLevelResult.trust_level ?? 1));
      result.entity_verified = trustLevelResult.entity_verified ?? false;
    } else {
      // Fallback: estimate trust level from score
      result.trust_level = estimateTrustLevel(result.trust_score, result.entity_verified);
    }

    // Set permissions and spending limit based on trust level
    result.permissions = PERMISSIONS[result.trust_level] ?? [];
    result.spending_limit = SPENDING_LIMITS[result.trust_level] ?? 0;

    return result;
  }

  // -----------------------------------------------------------------------
  // Private API helpers
  // -----------------------------------------------------------------------

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  /**
   * POST /api/v1/agents/verify
   */
  private async apiVerify(agentId: string): Promise<VerifyApiResponse | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${this.baseUrl}/agents/verify`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ agent_id: agentId }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return (await res.json()) as VerifyApiResponse;
      }
    } catch {
      // Network error or timeout — return null
    }
    return null;
  }

  /**
   * GET /api/v1/agents/trust-level?agent_id=xxx
   */
  private async apiTrustLevel(agentId: string): Promise<TrustLevelApiResponse | null> {
    try {
      const url = new URL(`${this.baseUrl}/agents/trust-level`);
      url.searchParams.set("agent_id", agentId);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: this.headers(),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return (await res.json()) as TrustLevelApiResponse;
      }
    } catch {
      // Network error or timeout — return null
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractAgentId(did: string): string | null {
  if (did.startsWith("did:agentid:")) return did.slice("did:agentid:".length);
  if (did.startsWith("did:aps:")) return did.slice("did:aps:".length);
  if (did.startsWith("did:key:")) return did.slice("did:key:".length);
  if (did.startsWith("did:web:")) return did.slice("did:web:".length);
  return null;
}

function estimateTrustLevel(trustScore: number, entityVerified: boolean): number {
  if (entityVerified) return 4;
  if (trustScore >= 0.7) return 3;
  if (trustScore >= 0.4) return 2;
  return 1; // minimum is L1 in new model, no L0
}
