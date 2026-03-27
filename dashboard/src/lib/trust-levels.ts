// AgentID Trust Level System
// Security layer with user control. No gated governance — you register, you're in.
// Levels are based on what security capabilities you've set up, not time or score.

export enum TrustLevel {
  L1_REGISTERED = 1,   // registered, certificate issued
  L2_VERIFIED = 2,     // Ed25519 key bound
  L3_SECURED = 3,      // wallet bound, payments enabled
  L4_CERTIFIED = 4,    // entity verified
}

// Backward compatibility: old L0 agents map to L1 (they're registered — that's enough)
export const LEGACY_L0_MAPS_TO = TrustLevel.L1_REGISTERED

// All possible actions in the system
export type Action =
  | 'read'
  | 'discover'
  | 'verify'
  | 'send_message'
  | 'connect'
  | 'challenge_response'
  | 'handle_data'
  | 'access_paid_service'
  | 'make_payment'
  | 'sign_contract'
  | 'manage_funds'
  | 'full_autonomy'

// Permission sets per trust level (cumulative — each level includes all permissions from lower levels)
export const PERMISSIONS: Record<TrustLevel, Action[]> = {
  [TrustLevel.L1_REGISTERED]: ['read', 'discover', 'verify', 'send_message', 'connect'],
  [TrustLevel.L2_VERIFIED]: ['read', 'discover', 'verify', 'send_message', 'connect', 'challenge_response', 'handle_data'],
  [TrustLevel.L3_SECURED]: ['read', 'discover', 'verify', 'send_message', 'connect', 'challenge_response', 'handle_data', 'make_payment', 'access_paid_service'],
  [TrustLevel.L4_CERTIFIED]: ['read', 'discover', 'verify', 'send_message', 'connect', 'challenge_response', 'handle_data', 'make_payment', 'access_paid_service', 'sign_contract', 'manage_funds', 'full_autonomy'],
}

// Daily spending limits in USD per trust level
// These are DEFAULTS — the user can LOWER these, not us.
const SPENDING_LIMITS: Record<TrustLevel, number> = {
  [TrustLevel.L1_REGISTERED]: 0,       // no wallet bound yet
  [TrustLevel.L2_VERIFIED]: 0,         // no wallet bound yet
  [TrustLevel.L3_SECURED]: 10000,      // default — user can lower this
  [TrustLevel.L4_CERTIFIED]: 100000,   // default — user can lower this
}

// Human-readable labels
export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  [TrustLevel.L1_REGISTERED]: 'L1 — Registered',
  [TrustLevel.L2_VERIFIED]: 'L2 — Verified',
  [TrustLevel.L3_SECURED]: 'L3 — Secured',
  [TrustLevel.L4_CERTIFIED]: 'L4 — Certified',
}

// Agent data shape expected by calculateTrustLevel
export interface AgentTrustData {
  trust_score: number            // 0.0 to 1.0 (informational only — does NOT gate levels)
  verified: boolean              // has been verified at least once
  certificate_valid: boolean     // current certificate is not expired
  entity_verified?: boolean      // legal entity binding confirmed
  owner_email_verified?: boolean // owner has verified their email
  created_at: string             // ISO timestamp
  successful_verifications?: number // count of successful verifications
  ed25519_key?: string | null    // Ed25519 public key (if bound)
  wallet_address?: string | null // crypto wallet address (if bound)
}

export interface LevelUpRequirement {
  current_level: TrustLevel
  next_level: TrustLevel | null
  requirements: string[]
  met: Record<string, boolean>
}

/**
 * Calculate the trust level for an agent based on what security capabilities are set up.
 * No time requirements. No verification count requirements. You complete the step, you get the level.
 */
export function calculateTrustLevel(agent: AgentTrustData): TrustLevel {
  // L4: entity verified
  if (agent.entity_verified === true) {
    return TrustLevel.L4_CERTIFIED
  }

  // L3: wallet bound (wallet_address is not null)
  if (agent.wallet_address != null && agent.wallet_address !== '') {
    return TrustLevel.L3_SECURED
  }

  // L2: Ed25519 key bound (ed25519_key is not null)
  if (agent.ed25519_key != null && agent.ed25519_key !== '') {
    return TrustLevel.L2_VERIFIED
  }

  // L1: default for all registered agents
  return TrustLevel.L1_REGISTERED
}

/**
 * Normalize a trust level value, mapping legacy L0 to L1.
 * Use this when reading trust_level from the database to handle old agents.
 */
export function normalizeTrustLevel(level: number): TrustLevel {
  if (level === 0) return TrustLevel.L1_REGISTERED
  if (level >= 1 && level <= 4) return level as TrustLevel
  return TrustLevel.L1_REGISTERED
}

/**
 * Check whether a given trust level grants permission for a specific action.
 */
export function checkPermission(agentTrustLevel: TrustLevel | number, requiredAction: Action): boolean {
  const normalized = normalizeTrustLevel(agentTrustLevel)
  const allowed = PERMISSIONS[normalized] || []
  return allowed.includes(requiredAction)
}

/**
 * Get the maximum daily spending limit in USD for a trust level.
 */
export function getSpendingLimit(trustLevel: TrustLevel | number): number {
  const normalized = normalizeTrustLevel(trustLevel)
  return SPENDING_LIMITS[normalized] ?? 0
}

/**
 * Return what an agent needs to reach the next trust level.
 * Clear, actionable steps — not time-based gates.
 */
export function levelUpRequirements(currentLevel: TrustLevel | number, agent?: AgentTrustData): LevelUpRequirement {
  const normalized = normalizeTrustLevel(currentLevel)

  if (normalized >= TrustLevel.L4_CERTIFIED) {
    return {
      current_level: normalized,
      next_level: null,
      requirements: ['Already at maximum trust level'],
      met: { max_level: true },
    }
  }

  switch (normalized) {
    case TrustLevel.L1_REGISTERED:
      return {
        current_level: normalized,
        next_level: TrustLevel.L2_VERIFIED,
        requirements: [
          'Bind an Ed25519 key (POST /agents/bind-ed25519)',
        ],
        met: {
          ed25519_key_bound: agent?.ed25519_key != null && agent.ed25519_key !== '',
        },
      }

    case TrustLevel.L2_VERIFIED:
      return {
        current_level: normalized,
        next_level: TrustLevel.L3_SECURED,
        requirements: [
          'Bind a crypto wallet (POST /agents/bind-wallet)',
        ],
        met: {
          wallet_bound: agent?.wallet_address != null && agent.wallet_address !== '',
        },
      }

    case TrustLevel.L3_SECURED:
      return {
        current_level: normalized,
        next_level: TrustLevel.L4_CERTIFIED,
        requirements: [
          'Complete entity verification',
        ],
        met: {
          entity_verified: agent?.entity_verified === true,
        },
      }

    default:
      return {
        current_level: normalized,
        next_level: null,
        requirements: [],
        met: {},
      }
  }
}
