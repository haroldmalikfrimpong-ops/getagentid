// AgentID Trust Level System
// Defines L0-L4 trust levels with permissions, spending limits, and level-up requirements.

export enum TrustLevel {
  L0_UNVERIFIED = 0,    // Just registered. No access.
  L1_BASIC = 1,         // Read-only. Can browse, search, discover.
  L2_VERIFIED = 2,      // Can send messages, make API calls, interact with agents.
  L3_TRUSTED = 3,       // Can handle sensitive data, access paid services, small payments.
  L4_FULL_AUTHORITY = 4 // Can make payments, sign contracts, manage funds, full autonomy.
}

// All possible actions in the system
export type Action =
  | 'read'
  | 'discover'
  | 'verify'
  | 'send_message'
  | 'connect'
  | 'handle_data'
  | 'access_paid_service'
  | 'make_payment'
  | 'sign_contract'
  | 'manage_funds'
  | 'full_autonomy'

// Permission sets per trust level (cumulative — each level includes all permissions from lower levels)
export const PERMISSIONS: Record<TrustLevel, Action[]> = {
  [TrustLevel.L0_UNVERIFIED]: [],
  [TrustLevel.L1_BASIC]: ['read', 'discover'],
  [TrustLevel.L2_VERIFIED]: ['read', 'discover', 'verify', 'send_message', 'connect'],
  [TrustLevel.L3_TRUSTED]: ['read', 'discover', 'verify', 'send_message', 'connect', 'handle_data', 'access_paid_service', 'make_payment'],
  [TrustLevel.L4_FULL_AUTHORITY]: ['read', 'discover', 'verify', 'send_message', 'connect', 'handle_data', 'access_paid_service', 'make_payment', 'sign_contract', 'manage_funds', 'full_autonomy'],
}

// Daily spending limits in USD per trust level
const SPENDING_LIMITS: Record<TrustLevel, number> = {
  [TrustLevel.L0_UNVERIFIED]: 0,
  [TrustLevel.L1_BASIC]: 0,
  [TrustLevel.L2_VERIFIED]: 0,
  [TrustLevel.L3_TRUSTED]: 100,
  [TrustLevel.L4_FULL_AUTHORITY]: 10000,
}

// Human-readable labels
export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  [TrustLevel.L0_UNVERIFIED]: 'L0 — Unverified',
  [TrustLevel.L1_BASIC]: 'L1 — Basic',
  [TrustLevel.L2_VERIFIED]: 'L2 — Verified',
  [TrustLevel.L3_TRUSTED]: 'L3 — Trusted',
  [TrustLevel.L4_FULL_AUTHORITY]: 'L4 — Full Authority',
}

// Agent data shape expected by calculateTrustLevel
export interface AgentTrustData {
  trust_score: number            // 0.0 to 1.0
  verified: boolean              // has been verified at least once
  certificate_valid: boolean     // current certificate is not expired
  entity_verified?: boolean      // legal entity binding confirmed
  owner_email_verified?: boolean // owner has verified their email
  created_at: string             // ISO timestamp
  successful_verifications?: number // count of successful verifications
}

export interface LevelUpRequirement {
  current_level: TrustLevel
  next_level: TrustLevel | null
  requirements: string[]
  met: Record<string, boolean>
}

/**
 * Calculate the trust level for an agent based on its data.
 * Evaluates from highest level down and returns the first level whose criteria are fully met.
 */
export function calculateTrustLevel(agent: AgentTrustData): TrustLevel {
  const now = Date.now()
  const createdAt = new Date(agent.created_at).getTime()
  const daysActive = (now - createdAt) / (1000 * 60 * 60 * 24)
  const successfulVerifications = agent.successful_verifications ?? 0

  // L4: trust_score >= 0.9, entity verified, 30 days active, 50+ successful verifications
  if (
    agent.trust_score >= 0.9 &&
    agent.entity_verified === true &&
    daysActive >= 30 &&
    successfulVerifications >= 50 &&
    agent.certificate_valid
  ) {
    return TrustLevel.L4_FULL_AUTHORITY
  }

  // L3: trust_score >= 0.7, 10+ successful verifications, 7 days active
  if (
    agent.trust_score >= 0.7 &&
    successfulVerifications >= 10 &&
    daysActive >= 7 &&
    agent.certificate_valid
  ) {
    return TrustLevel.L3_TRUSTED
  }

  // L2: certificate issued + at least 1 successful verification
  if (agent.certificate_valid && successfulVerifications >= 1) {
    return TrustLevel.L2_VERIFIED
  }

  // L1: agent exists + owner verified email
  if (agent.owner_email_verified === true) {
    return TrustLevel.L1_BASIC
  }

  // L0: default — just registered
  return TrustLevel.L0_UNVERIFIED
}

/**
 * Check whether a given trust level grants permission for a specific action.
 */
export function checkPermission(agentTrustLevel: TrustLevel, requiredAction: Action): boolean {
  const allowed = PERMISSIONS[agentTrustLevel] || []
  return allowed.includes(requiredAction)
}

/**
 * Get the maximum daily spending limit in USD for a trust level.
 */
export function getSpendingLimit(trustLevel: TrustLevel): number {
  return SPENDING_LIMITS[trustLevel] ?? 0
}

/**
 * Return what an agent needs to reach the next trust level.
 * Includes which requirements are already met based on the agent's current data.
 */
export function levelUpRequirements(currentLevel: TrustLevel, agent?: AgentTrustData): LevelUpRequirement {
  if (currentLevel >= TrustLevel.L4_FULL_AUTHORITY) {
    return {
      current_level: currentLevel,
      next_level: null,
      requirements: ['Already at maximum trust level'],
      met: { max_level: true },
    }
  }

  const now = Date.now()
  const daysActive = agent
    ? (now - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const successfulVerifications = agent?.successful_verifications ?? 0

  switch (currentLevel) {
    case TrustLevel.L0_UNVERIFIED:
      return {
        current_level: currentLevel,
        next_level: TrustLevel.L1_BASIC,
        requirements: [
          'Agent must exist (registered)',
          'Owner must verify their email address',
        ],
        met: {
          agent_exists: true, // if we're calculating, the agent exists
          owner_email_verified: agent?.owner_email_verified === true,
        },
      }

    case TrustLevel.L1_BASIC:
      return {
        current_level: currentLevel,
        next_level: TrustLevel.L2_VERIFIED,
        requirements: [
          'Valid certificate must be issued',
          'At least 1 successful verification',
        ],
        met: {
          certificate_valid: agent?.certificate_valid === true,
          has_verification: successfulVerifications >= 1,
        },
      }

    case TrustLevel.L2_VERIFIED:
      return {
        current_level: currentLevel,
        next_level: TrustLevel.L3_TRUSTED,
        requirements: [
          'Trust score >= 0.7',
          'At least 10 successful verifications',
          'At least 7 days active',
        ],
        met: {
          trust_score_sufficient: (agent?.trust_score ?? 0) >= 0.7,
          enough_verifications: successfulVerifications >= 10,
          days_active_sufficient: daysActive >= 7,
        },
      }

    case TrustLevel.L3_TRUSTED:
      return {
        current_level: currentLevel,
        next_level: TrustLevel.L4_FULL_AUTHORITY,
        requirements: [
          'Trust score >= 0.9',
          'Entity verified (legal entity binding)',
          'At least 30 days active',
          'At least 50 successful verifications',
        ],
        met: {
          trust_score_sufficient: (agent?.trust_score ?? 0) >= 0.9,
          entity_verified: agent?.entity_verified === true,
          days_active_sufficient: daysActive >= 30,
          enough_verifications: successfulVerifications >= 50,
        },
      }

    default:
      return {
        current_level: currentLevel,
        next_level: null,
        requirements: [],
        met: {},
      }
  }
}
