// AgentID Spending Authority System
// Gates whether a specific agent is authorized to spend, based on trust level and daily limits.
// This is NOT payment processing — the owner pre-funds; this layer enforces authorization.

import { getServiceClient } from './api-auth'
import { TrustLevel, calculateTrustLevel, getSpendingLimit, AgentTrustData } from './trust-levels'
import crypto from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpendingAuthority {
  authorized: boolean
  reason?: string
  trust_level: TrustLevel
  daily_limit: number
  spent_today: number
  remaining_daily_limit: number
}

export interface SpendTransaction {
  id: string
  agent_id: string
  amount: number
  currency: string
  description: string
  recipient: string
  trust_level: TrustLevel
  created_at: string
  receipt: string            // ECDSA-signed receipt
}

export interface AgentBalance {
  agent_id: string
  trust_level: TrustLevel
  daily_limit: number
  spent_today: number
  remaining_daily_limit: number
  transaction_count_today: number
}

// ── Daily spending limits (mirrors trust-levels.ts, re-stated for clarity) ──

export const AgentSpendingLimits: Record<TrustLevel, number> = {
  [TrustLevel.L0_UNVERIFIED]: 0,
  [TrustLevel.L1_BASIC]: 0,
  [TrustLevel.L2_VERIFIED]: 0,
  [TrustLevel.L3_TRUSTED]: 100,
  [TrustLevel.L4_FULL_AUTHORITY]: 10000,
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Return the start-of-day ISO string in UTC for "today". */
function todayStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

/** Sum the amount column for an agent's spend transactions created today. */
async function sumSpentToday(agentId: string): Promise<{ total: number; count: number }> {
  const db = getServiceClient()
  const start = todayStart()

  const { data, error } = await db
    .from('spend_transactions')
    .select('amount')
    .eq('agent_id', agentId)
    .gte('created_at', start)

  if (error) {
    console.error('Failed to sum daily spending:', error)
    return { total: 0, count: 0 }
  }

  const total = (data || []).reduce((sum: number, row: { amount: number }) => sum + row.amount, 0)
  return { total, count: (data || []).length }
}

/** Resolve an agent row + compute its trust level. */
async function resolveAgentTrust(agentId: string): Promise<{ trustLevel: TrustLevel; agent: any } | null> {
  const db = getServiceClient()

  const { data: agent, error } = await db
    .from('agents')
    .select('agent_id, name, owner, trust_score, verified, active, created_at, certificate, entity_verified, owner_email_verified, user_id')
    .eq('agent_id', agentId)
    .single()

  if (error || !agent) return null

  // Determine certificate validity
  let certificate_valid = false
  if (agent.certificate) {
    try {
      const parts = agent.certificate.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
        certificate_valid = payload.exp > Math.floor(Date.now() / 1000)
      }
    } catch {}
  }

  // Count successful verifications
  const { count: successfulVerifications } = await db
    .from('agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('event_type', 'verified')

  const agentData: AgentTrustData = {
    trust_score: agent.trust_score ?? 0,
    verified: agent.verified ?? false,
    certificate_valid,
    entity_verified: agent.entity_verified ?? false,
    owner_email_verified: agent.owner_email_verified ?? false,
    created_at: agent.created_at,
    successful_verifications: successfulVerifications ?? 0,
  }

  return { trustLevel: calculateTrustLevel(agentData), agent }
}

/** Sign a receipt payload with ECDSA using the server signing key. */
function signReceipt(payload: Record<string, any>): string {
  const secret = process.env.SPENDING_SIGNING_KEY || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('No signing key configured (SPENDING_SIGNING_KEY or JWT_SECRET)')
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'SpendReceipt' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether an agent is authorized to spend a given amount.
 * Does NOT record the spend — use recordSpend() for that.
 */
export async function checkSpendingAuthority(
  agentId: string,
  amount: number,
  currency: string = 'usd'
): Promise<SpendingAuthority> {
  if (amount <= 0) {
    return {
      authorized: false,
      reason: 'Amount must be greater than zero',
      trust_level: TrustLevel.L0_UNVERIFIED,
      daily_limit: 0,
      spent_today: 0,
      remaining_daily_limit: 0,
    }
  }

  const resolved = await resolveAgentTrust(agentId)
  if (!resolved) {
    return {
      authorized: false,
      reason: 'Agent not found',
      trust_level: TrustLevel.L0_UNVERIFIED,
      daily_limit: 0,
      spent_today: 0,
      remaining_daily_limit: 0,
    }
  }

  const { trustLevel } = resolved
  const dailyLimit = getSpendingLimit(trustLevel)

  if (trustLevel < TrustLevel.L3_TRUSTED) {
    return {
      authorized: false,
      reason: `Trust level L${trustLevel} is insufficient. Spending requires L3 (Trusted) or higher.`,
      trust_level: trustLevel,
      daily_limit: dailyLimit,
      spent_today: 0,
      remaining_daily_limit: 0,
    }
  }

  const { total: spentToday } = await sumSpentToday(agentId)
  const remaining = Math.max(0, dailyLimit - spentToday)

  if (amount > remaining) {
    return {
      authorized: false,
      reason: `Exceeds daily spending limit. Limit: $${dailyLimit}, spent today: $${spentToday.toFixed(2)}, remaining: $${remaining.toFixed(2)}, requested: $${amount.toFixed(2)}`,
      trust_level: trustLevel,
      daily_limit: dailyLimit,
      spent_today: spentToday,
      remaining_daily_limit: remaining,
    }
  }

  return {
    authorized: true,
    trust_level: trustLevel,
    daily_limit: dailyLimit,
    spent_today: spentToday,
    remaining_daily_limit: remaining,
  }
}

/**
 * Record a spend transaction. Returns the full transaction record including a signed receipt.
 * Caller should call checkSpendingAuthority first — this function also validates but records on success.
 */
export async function recordSpend(
  agentId: string,
  amount: number,
  currency: string,
  description: string,
  recipient: string
): Promise<{ transaction: SpendTransaction; remaining_daily_limit: number } | { error: string }> {
  // Re-check authority atomically
  const authority = await checkSpendingAuthority(agentId, amount, currency)
  if (!authority.authorized) {
    return { error: authority.reason || 'Spending not authorized' }
  }

  const resolved = await resolveAgentTrust(agentId)
  if (!resolved) {
    return { error: 'Agent not found' }
  }

  const transactionId = `txn_${crypto.randomBytes(12).toString('hex')}`
  const now = new Date().toISOString()

  // Build the receipt payload and sign it
  const receiptPayload = {
    txn: transactionId,
    agent_id: agentId,
    amount,
    currency,
    recipient,
    description,
    trust_level: authority.trust_level,
    iat: Math.floor(Date.now() / 1000),
    iss: 'https://getagentid.dev',
  }
  const receipt = signReceipt(receiptPayload)

  // Insert into spend_transactions table
  const db = getServiceClient()
  const { error: dbError } = await db.from('spend_transactions').insert({
    id: transactionId,
    agent_id: agentId,
    amount,
    currency,
    description,
    recipient,
    trust_level: authority.trust_level,
    receipt,
    user_id: resolved.agent.user_id,
  })

  if (dbError) {
    console.error('Failed to record spend transaction:', dbError)
    return { error: 'Failed to record transaction' }
  }

  // Log the event
  await db.from('agent_events').insert({
    agent_id: agentId,
    event_type: 'spend',
    data: {
      transaction_id: transactionId,
      amount,
      currency,
      recipient,
      trust_level: authority.trust_level,
    },
  })

  const newSpentToday = authority.spent_today + amount
  const newRemaining = Math.max(0, authority.daily_limit - newSpentToday)

  return {
    transaction: {
      id: transactionId,
      agent_id: agentId,
      amount,
      currency,
      description,
      recipient,
      trust_level: authority.trust_level,
      created_at: now,
      receipt,
    },
    remaining_daily_limit: newRemaining,
  }
}

/**
 * Get the agent's current balance — how much has been spent today vs. the daily limit.
 */
export async function getAgentBalance(agentId: string): Promise<AgentBalance | null> {
  const resolved = await resolveAgentTrust(agentId)
  if (!resolved) return null

  const { trustLevel } = resolved
  const dailyLimit = getSpendingLimit(trustLevel)
  const { total: spentToday, count } = await sumSpentToday(agentId)
  const remaining = Math.max(0, dailyLimit - spentToday)

  return {
    agent_id: agentId,
    trust_level: trustLevel,
    daily_limit: dailyLimit,
    spent_today: spentToday,
    remaining_daily_limit: remaining,
    transaction_count_today: count,
  }
}

/**
 * Get spending history for an agent over the last N days.
 */
export async function getSpendingHistory(
  agentId: string,
  days: number = 30
): Promise<SpendTransaction[]> {
  const db = getServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('spend_transactions')
    .select('id, agent_id, amount, currency, description, recipient, trust_level, created_at, receipt')
    .eq('agent_id', agentId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch spending history:', error)
    return []
  }

  return (data || []) as SpendTransaction[]
}
