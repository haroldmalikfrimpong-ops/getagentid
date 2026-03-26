/**
 * AgentID Payment Security Engine
 *
 * Security layer for agent-to-human crypto payments. Every outbound payment
 * to a human wallet must pass through these checks:
 *
 *   1. Wallet allowlist — owner must pre-approve every destination wallet
 *   2. Cooling period  — 24-hour delay on first payment to a new wallet
 *   3. Duplicate detection — same amount + same wallet within 10 min = blocked
 *   4. Per-recipient daily limit — caps how much flows to any single wallet/day
 *   5. Dual approval — large payments require explicit owner approval
 *   6. Freeze — owner can kill-switch all payments for an agent instantly
 *   7. Wallet validation — format-level checks per chain (ETH, SOL, Polygon)
 *
 * This module never touches on-chain state. It is the authorization gate that
 * sits BEFORE any crypto transfer happens.
 */

import { getServiceClient } from './api-auth'
import { TrustLevel } from './trust-levels'
import { sendWebhook } from './webhooks'
import crypto from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AllowlistEntry {
  id: string
  user_id: string
  wallet_address: string
  chain: string
  label: string
  created_at: string
}

export interface CoolingPeriodResult {
  allowed: boolean
  cooldown_remaining_seconds?: number
}

export interface RecipientLimitResult {
  allowed: boolean
  spent_today: number
  limit: number
}

export interface PendingApproval {
  id: string
  payment_id: string
  user_id: string
  details: object
  status: 'pending' | 'approved' | 'denied'
  deadline: string
  created_at: string
}

// ── Constants ────────────────────────────────────────────────────────────────

/** 24 hours in seconds — cooling period for first payment to a new wallet. */
const COOLING_PERIOD_SECONDS = 24 * 60 * 60

/** Default duplicate-detection window in minutes. */
const DEFAULT_DUPLICATE_WINDOW_MINUTES = 10

/** Per-recipient daily limits by trust level (USD). */
const RECIPIENT_DAILY_LIMITS: Record<number, number> = {
  [TrustLevel.L3_TRUSTED]: 50,
  [TrustLevel.L4_FULL_AUTHORITY]: 1000,
}

/** Dual-approval thresholds by trust level (USD). Payments above this need owner sign-off. */
const DUAL_APPROVAL_THRESHOLDS: Record<number, number> = {
  [TrustLevel.L3_TRUSTED]: 50,
  [TrustLevel.L4_FULL_AUTHORITY]: 5000,
}

/** Owner has 1 hour to approve or deny a pending payment. */
const APPROVAL_DEADLINE_MS = 60 * 60 * 1000

// ── Wallet Address Validation ────────────────────────────────────────────────

/**
 * Validate a wallet address format for a given chain.
 *
 * Ethereum / Polygon: 0x prefix + 40 hex characters (42 total).
 * Solana: base58 string, 32-44 characters, no 0/O/I/l (base58 alphabet).
 *
 * This is format-level only — it does NOT prove the address exists on-chain.
 */
export function validateWalletAddress(
  address: string,
  chain: string
): { valid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Wallet address is required' }
  }

  const trimmed = address.trim()

  switch (chain) {
    case 'ethereum':
    case 'polygon': {
      // EVM: 0x + 40 hex chars
      const evmRegex = /^0x[0-9a-fA-F]{40}$/
      if (!evmRegex.test(trimmed)) {
        return {
          valid: false,
          error: `Invalid ${chain} address. Expected 0x followed by 40 hex characters.`,
        }
      }
      return { valid: true }
    }

    case 'solana': {
      // Solana: base58 alphabet, 32-44 characters
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      if (!base58Regex.test(trimmed)) {
        return {
          valid: false,
          error: 'Invalid Solana address. Expected 32-44 base58 characters.',
        }
      }
      return { valid: true }
    }

    default:
      return { valid: false, error: `Unsupported chain "${chain}"` }
  }
}

// ── Dead Wallet Warning ──────────────────────────────────────────────────────

/**
 * Check if a wallet address appears to be a dead/burn wallet.
 *
 * For now this is format-level only: checks known burn addresses and obvious
 * zero-addresses. On-chain balance checks can be added later.
 */
export async function isDeadWallet(address: string, chain: string): Promise<boolean> {
  const trimmed = address.trim().toLowerCase()

  // Known burn / zero addresses
  const deadAddresses = new Set([
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
    '0xdead000000000000000000000000000000000000',
    '11111111111111111111111111111111', // Solana system program (not a wallet)
  ])

  if (deadAddresses.has(trimmed)) {
    return true
  }

  // EVM: all-zero after 0x prefix
  if ((chain === 'ethereum' || chain === 'polygon') && /^0x0+$/.test(trimmed)) {
    return true
  }

  return false
}

// ── Wallet Allowlist ─────────────────────────────────────────────────────────

/**
 * Add a wallet to the owner's allowlist. Agents can only pay wallets on this list.
 */
export async function addToAllowlist(
  userId: string,
  walletAddress: string,
  chain: string,
  label: string
): Promise<void> {
  const db = getServiceClient()

  // Validate address format before adding
  const validation = validateWalletAddress(walletAddress, chain)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Check for duplicates
  const { data: existing } = await db
    .from('payment_allowlist')
    .select('id')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress.trim())
    .single()

  if (existing) {
    throw new Error('Wallet address is already on the allowlist')
  }

  const { error } = await db.from('payment_allowlist').insert({
    id: `al_${crypto.randomBytes(12).toString('hex')}`,
    user_id: userId,
    wallet_address: walletAddress.trim(),
    chain,
    label: label || 'Unlabeled',
  })

  if (error) {
    console.error('Failed to add wallet to allowlist:', error)
    throw new Error('Failed to add wallet to allowlist')
  }
}

/**
 * Remove a wallet from the owner's allowlist.
 */
export async function removeFromAllowlist(
  userId: string,
  walletAddress: string
): Promise<void> {
  const db = getServiceClient()

  const { error, count } = await db
    .from('payment_allowlist')
    .delete()
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress.trim())

  if (error) {
    console.error('Failed to remove wallet from allowlist:', error)
    throw new Error('Failed to remove wallet from allowlist')
  }
}

/**
 * Check whether a wallet is on the owner's allowlist.
 */
export async function isAllowlisted(
  userId: string,
  walletAddress: string
): Promise<boolean> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('payment_allowlist')
    .select('id')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress.trim())
    .single()

  if (error || !data) return false
  return true
}

/**
 * Get the full allowlist for a user.
 */
export async function getAllowlist(userId: string): Promise<AllowlistEntry[]> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('payment_allowlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch allowlist:', error)
    return []
  }

  return (data || []) as AllowlistEntry[]
}

// ── Cooling Period ───────────────────────────────────────────────────────────

/**
 * Check the cooling period for a first payment to a new wallet.
 *
 * When an agent has never paid a specific wallet before, a 24-hour cooling
 * period starts from the first attempted payment. The owner is notified
 * immediately. Subsequent payments to the same wallet (after the cooling
 * period expires) proceed without delay.
 */
export async function checkCoolingPeriod(
  agentId: string,
  walletAddress: string
): Promise<CoolingPeriodResult> {
  const db = getServiceClient()
  const trimmed = walletAddress.trim()

  // Check if this agent has ever successfully paid this wallet
  const { data: previousPayment } = await db
    .from('agent_payments')
    .select('id')
    .eq('from_agent_id', agentId)
    .eq('to_wallet', trimmed)
    .eq('status', 'authorized')
    .limit(1)
    .single()

  if (previousPayment) {
    // Agent has paid this wallet before — no cooling period
    return { allowed: true }
  }

  // Check if there is an existing cooling record
  const { data: coolingRecord } = await db
    .from('agent_payments')
    .select('created_at')
    .eq('from_agent_id', agentId)
    .eq('to_wallet', trimmed)
    .eq('status', 'cooling')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (coolingRecord) {
    const createdAt = new Date(coolingRecord.created_at).getTime()
    const elapsed = (Date.now() - createdAt) / 1000
    const remaining = COOLING_PERIOD_SECONDS - elapsed

    if (remaining > 0) {
      return { allowed: false, cooldown_remaining_seconds: Math.ceil(remaining) }
    }

    // Cooling period has expired — allow
    return { allowed: true }
  }

  // No previous payments and no cooling record — this is the first attempt.
  // Caller is responsible for creating the cooling record.
  return { allowed: false, cooldown_remaining_seconds: COOLING_PERIOD_SECONDS }
}

// ── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Detect duplicate payments: same agent -> same wallet -> same amount within
 * a configurable time window (default 10 minutes).
 */
export async function isDuplicatePayment(
  agentId: string,
  walletAddress: string,
  amount: number,
  windowMinutes: number = DEFAULT_DUPLICATE_WINDOW_MINUTES
): Promise<boolean> {
  const db = getServiceClient()
  const trimmed = walletAddress.trim()
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('agent_payments')
    .select('id')
    .eq('from_agent_id', agentId)
    .eq('to_wallet', trimmed)
    .eq('amount', amount)
    .in('status', ['authorized', 'executed', 'pending_approval'])
    .gte('created_at', windowStart)
    .limit(1)

  if (error) {
    console.error('Duplicate detection query failed:', error)
    // Fail closed — if we can't check, assume duplicate to be safe
    return true
  }

  return (data || []).length > 0
}

// ── Per-Recipient Daily Limit ────────────────────────────────────────────────

/**
 * Check if a payment would exceed the per-recipient daily limit.
 *
 * L3 agents: $50/day per recipient.
 * L4 agents: $1000/day per recipient.
 */
export async function checkRecipientDailyLimit(
  agentId: string,
  walletAddress: string,
  amount: number,
  trustLevel: number,
  dailyLimit?: number
): Promise<RecipientLimitResult> {
  const limit = dailyLimit ?? RECIPIENT_DAILY_LIMITS[trustLevel] ?? 0
  const db = getServiceClient()
  const trimmed = walletAddress.trim()

  // Sum payments to this specific wallet today
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data, error } = await db
    .from('agent_payments')
    .select('amount')
    .eq('from_agent_id', agentId)
    .eq('to_wallet', trimmed)
    .in('status', ['authorized', 'executed', 'pending_approval'])
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('Recipient daily limit query failed:', error)
    // Fail closed
    return { allowed: false, spent_today: 0, limit }
  }

  const spentToday = (data || []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0
  )

  if (spentToday + amount > limit) {
    return { allowed: false, spent_today: spentToday, limit }
  }

  return { allowed: true, spent_today: spentToday, limit }
}

// ── Dual Approval ────────────────────────────────────────────────────────────

/**
 * Determine if a payment requires explicit owner approval.
 *
 * L3: any payment over $50 needs owner sign-off.
 * L4: any payment over $5000 needs owner sign-off.
 */
export function requiresDualApproval(trustLevel: number, amount: number): boolean {
  const threshold = DUAL_APPROVAL_THRESHOLDS[trustLevel]
  if (threshold === undefined) return true // Unknown level — always require approval
  return amount > threshold
}

/**
 * Create a pending approval request and notify the owner via webhook.
 * The owner has 1 hour to approve or deny.
 */
export async function requestOwnerApproval(
  userId: string,
  paymentId: string,
  details: object
): Promise<void> {
  const db = getServiceClient()
  const deadline = new Date(Date.now() + APPROVAL_DEADLINE_MS).toISOString()

  // Update the payment record to pending_approval status
  const { error: updateErr } = await db
    .from('agent_payments')
    .update({
      status: 'pending_approval',
      approval_status: 'pending',
      approval_deadline: deadline,
      requires_approval: true,
    })
    .eq('id', paymentId)

  if (updateErr) {
    console.error('Failed to set payment to pending approval:', updateErr)
    throw new Error('Failed to create approval request')
  }

  // Notify owner via webhook
  sendWebhook(userId, 'payment.human_pending_approval', {
    payment_id: paymentId,
    deadline,
    message: 'A payment requires your approval. You have 1 hour to approve or deny.',
    ...details,
  })
}

/**
 * Approve a pending payment. Only the owner can approve.
 */
export async function approvePayment(
  userId: string,
  paymentId: string
): Promise<void> {
  const db = getServiceClient()

  // Fetch the payment
  const { data: payment, error: fetchErr } = await db
    .from('agent_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !payment) {
    throw new Error('Payment not found or you do not own it')
  }

  if (payment.status !== 'pending_approval') {
    throw new Error(`Payment cannot be approved — status is "${payment.status}"`)
  }

  // Check deadline
  if (payment.approval_deadline && new Date(payment.approval_deadline) < new Date()) {
    await db
      .from('agent_payments')
      .update({ status: 'expired', approval_status: 'expired' })
      .eq('id', paymentId)
    throw new Error('Approval deadline has passed. Payment expired.')
  }

  // Approve
  const { error: updateErr } = await db
    .from('agent_payments')
    .update({
      status: 'authorized',
      approval_status: 'approved',
    })
    .eq('id', paymentId)

  if (updateErr) {
    console.error('Failed to approve payment:', updateErr)
    throw new Error('Failed to approve payment')
  }

  // Notify via webhook
  sendWebhook(userId, 'payment.human_authorized', {
    payment_id: paymentId,
    from_agent_id: payment.from_agent_id,
    to_wallet: payment.to_wallet,
    amount: payment.amount,
    chain: payment.chain,
    message: 'Payment approved by owner.',
  })
}

/**
 * Deny a pending payment. Only the owner can deny.
 */
export async function denyPayment(
  userId: string,
  paymentId: string
): Promise<void> {
  const db = getServiceClient()

  // Fetch the payment
  const { data: payment, error: fetchErr } = await db
    .from('agent_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !payment) {
    throw new Error('Payment not found or you do not own it')
  }

  if (payment.status !== 'pending_approval') {
    throw new Error(`Payment cannot be denied — status is "${payment.status}"`)
  }

  // Deny
  const { error: updateErr } = await db
    .from('agent_payments')
    .update({
      status: 'denied',
      approval_status: 'denied',
    })
    .eq('id', paymentId)

  if (updateErr) {
    console.error('Failed to deny payment:', updateErr)
    throw new Error('Failed to deny payment')
  }

  // Notify via webhook
  sendWebhook(userId, 'payment.human_denied', {
    payment_id: paymentId,
    from_agent_id: payment.from_agent_id,
    to_wallet: payment.to_wallet,
    amount: payment.amount,
    chain: payment.chain,
    message: 'Payment denied by owner.',
  })
}

// ── Freeze / Unfreeze ────────────────────────────────────────────────────────

/**
 * Freeze all payments for an agent. Immediate kill-switch.
 */
export async function freezeAgentPayments(
  userId: string,
  agentId: string
): Promise<void> {
  const db = getServiceClient()

  // Verify the user owns this agent
  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .single()

  if (agentErr || !agent) {
    throw new Error('Agent not found')
  }

  if (agent.user_id !== userId) {
    throw new Error('You do not own this agent')
  }

  // Upsert the freeze setting
  const { error } = await db
    .from('agent_payment_settings')
    .upsert(
      { agent_id: agentId, frozen: true, updated_at: new Date().toISOString() },
      { onConflict: 'agent_id' }
    )

  if (error) {
    console.error('Failed to freeze agent payments:', error)
    throw new Error('Failed to freeze agent payments')
  }

  // Notify via webhook
  sendWebhook(userId, 'payment.frozen', {
    agent_id: agentId,
    message: 'All payments for this agent have been frozen.',
  })
}

/**
 * Unfreeze payments for an agent.
 */
export async function unfreezeAgentPayments(
  userId: string,
  agentId: string
): Promise<void> {
  const db = getServiceClient()

  // Verify the user owns this agent
  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .single()

  if (agentErr || !agent) {
    throw new Error('Agent not found')
  }

  if (agent.user_id !== userId) {
    throw new Error('You do not own this agent')
  }

  const { error } = await db
    .from('agent_payment_settings')
    .upsert(
      { agent_id: agentId, frozen: false, updated_at: new Date().toISOString() },
      { onConflict: 'agent_id' }
    )

  if (error) {
    console.error('Failed to unfreeze agent payments:', error)
    throw new Error('Failed to unfreeze agent payments')
  }

  // Notify via webhook
  sendWebhook(userId, 'payment.unfrozen', {
    agent_id: agentId,
    message: 'Payments for this agent have been unfrozen.',
  })
}

/**
 * Check whether an agent's payments are currently frozen.
 */
export async function isAgentFrozen(agentId: string): Promise<boolean> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('agent_payment_settings')
    .select('frozen')
    .eq('agent_id', agentId)
    .single()

  if (error || !data) return false // No settings row = not frozen
  return data.frozen === true
}

/**
 * Get all pending approval requests for a user.
 */
export async function getPendingApprovals(userId: string): Promise<any[]> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('agent_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch pending approvals:', error)
    return []
  }

  return data || []
}

/**
 * Get all frozen agent IDs for a user.
 */
export async function getFrozenAgents(userId: string): Promise<string[]> {
  const db = getServiceClient()

  // Get all agents owned by this user
  const { data: agents, error: agentErr } = await db
    .from('agents')
    .select('agent_id')
    .eq('user_id', userId)

  if (agentErr || !agents || agents.length === 0) return []

  const agentIds = agents.map((a: { agent_id: string }) => a.agent_id)

  const { data: settings, error: settingsErr } = await db
    .from('agent_payment_settings')
    .select('agent_id')
    .in('agent_id', agentIds)
    .eq('frozen', true)

  if (settingsErr || !settings) return []

  return settings.map((s: { agent_id: string }) => s.agent_id)
}
