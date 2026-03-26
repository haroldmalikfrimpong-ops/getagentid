import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { checkSpendingAuthority, recordSpend } from '@/lib/agent-spending'
import { sendWebhook } from '@/lib/webhooks'
import { trackUsage } from '@/lib/usage'
import {
  validateWalletAddress,
  isDeadWallet,
  isAllowlisted,
  isAgentFrozen,
  checkCoolingPeriod,
  isDuplicatePayment,
  checkRecipientDailyLimit,
  requiresDualApproval,
  requestOwnerApproval,
} from '@/lib/payment-security'
import { createDualReceipt } from '@/lib/receipts'
import crypto from 'crypto'

const SUPPORTED_CHAINS = ['solana', 'ethereum', 'polygon'] as const
type Chain = (typeof SUPPORTED_CHAINS)[number]

// Payment intent expires after 10 minutes
const INTENT_TTL_MS = 10 * 60 * 1000

// ── POST /api/v1/agents/pay ──────────────────────────────────────────────────
//
// Three modes:
//   1. Agent-to-agent:  { from_agent_id, to_agent_id, amount, currency?, chain? }
//   2. Agent-to-human:  { from_agent_id, to_wallet, amount, currency?, chain? }
//   3. Execute payment: { action: "execute", payment_id, signed_transaction }

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate via API key ──────────────────────────────────
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()

    // Route to execute handler if action is "execute"
    if (body.action === 'execute') {
      return handleExecute(auth, body)
    }

    // Route to agent-to-human if to_wallet is provided
    if (body.to_wallet) {
      return handleHumanPayment(auth, body)
    }

    // Otherwise: create agent-to-agent payment intent
    return handleCreateIntent(auth, body)

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

// ── GET /api/v1/agents/pay?agent_id=xxx ──────────────────────────────────────
//
// Returns payment history for an agent.
// Optional: ?direction=sent|received  ?days=30

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agent_id')
    const direction = searchParams.get('direction') || 'all'
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365)

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    // Verify the caller owns this agent
    const db = getServiceClient()
    const { data: agent, error: agentErr } = await db
      .from('agents')
      .select('agent_id, user_id')
      .eq('agent_id', agentId)
      .single()

    if (agentErr || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Fetch payment history
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = db
      .from('agent_payments')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (direction === 'sent') {
      query = query.eq('from_agent_id', agentId)
    } else if (direction === 'received') {
      query = query.eq('to_agent_id', agentId)
    } else {
      // All payments involving this agent
      query = query.or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
    }

    const { data: payments, error: histErr } = await query

    if (histErr) {
      console.error('Failed to fetch payment history:', histErr)
      return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 })
    }

    return NextResponse.json({
      agent_id: agentId,
      direction,
      days,
      count: (payments || []).length,
      payments: payments || [],
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

// ── Create Agent-to-Agent Payment Intent ─────────────────────────────────────

async function handleCreateIntent(
  auth: { user_id: string; api_key_id: string; profile: any },
  body: any
) {
  const { from_agent_id, to_agent_id, amount, currency = 'usd', chain = 'solana' } = body

  // ── Validate required fields ──────────────────────────────────
  if (!from_agent_id) {
    return NextResponse.json({ error: 'from_agent_id is required' }, { status: 400 })
  }
  if (!to_agent_id) {
    return NextResponse.json({ error: 'to_agent_id is required' }, { status: 400 })
  }
  if (from_agent_id === to_agent_id) {
    return NextResponse.json({ error: 'Cannot pay yourself — from and to agent must differ' }, { status: 400 })
  }
  if (amount == null || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!SUPPORTED_CHAINS.includes(chain as Chain)) {
    return NextResponse.json({
      error: `Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(', ')}`,
    }, { status: 400 })
  }

  const db = getServiceClient()

  // ── Verify the caller owns the sending agent ────────────────
  const { data: fromAgent, error: fromErr } = await db
    .from('agents')
    .select('agent_id, name, user_id, wallet_address, wallet_chain, verified, active')
    .eq('agent_id', from_agent_id)
    .single()

  if (fromErr || !fromAgent) {
    return NextResponse.json({ error: 'Sending agent not found' }, { status: 404 })
  }

  if (fromAgent.user_id !== auth.user_id) {
    return NextResponse.json({ error: 'You do not own the sending agent' }, { status: 403 })
  }

  // ── Verify the receiving agent exists ───────────────────────
  const { data: toAgent, error: toErr } = await db
    .from('agents')
    .select('agent_id, name, verified, active, wallet_address, wallet_chain')
    .eq('agent_id', to_agent_id)
    .single()

  if (toErr || !toAgent) {
    return NextResponse.json({ error: 'Receiving agent not found' }, { status: 404 })
  }

  // ── Check spending authority (trust level + daily limit) ────
  const authority = await checkSpendingAuthority(from_agent_id, amount, currency)

  if (!authority.authorized) {
    // Fire webhook for denied payment
    sendWebhook(auth.user_id, 'payment.denied', {
      from_agent_id,
      to_agent_id,
      amount,
      currency,
      chain,
      reason: authority.reason,
      trust_level: authority.trust_level,
    })

    return NextResponse.json({
      status: 'denied',
      reason: authority.reason,
      from_agent_id,
      to_agent_id,
      amount,
      chain,
      trust_level: authority.trust_level,
      daily_limit: authority.daily_limit,
      spent_today: authority.spent_today,
      remaining_daily_limit: authority.remaining_daily_limit,
    }, { status: 403 })
  }

  // ── Record the spend against daily limits ───────────────────
  const spendResult = await recordSpend(
    from_agent_id,
    amount,
    currency,
    `Agent-to-agent payment to ${to_agent_id}`,
    to_agent_id
  )

  if ('error' in spendResult) {
    return NextResponse.json({ error: spendResult.error }, { status: 500 })
  }

  // ── Create the payment intent record ────────────────────────
  const paymentId = `pay_${crypto.randomBytes(12).toString('hex')}`
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString()

  const { error: insertErr } = await db.from('agent_payments').insert({
    id: paymentId,
    from_agent_id,
    to_agent_id,
    amount,
    currency,
    chain,
    status: 'authorized',
    trust_level: authority.trust_level,
    spend_transaction_id: spendResult.transaction.id,
    receipt: spendResult.transaction.receipt,
    expires_at: expiresAt,
    user_id: auth.user_id,
  })

  if (insertErr) {
    console.error('Failed to create payment intent:', insertErr)
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
  }

  // ── Log event ───────────────────────────────────────────────
  await db.from('agent_events').insert({
    agent_id: from_agent_id,
    event_type: 'payment_authorized',
    data: {
      payment_id: paymentId,
      to_agent_id,
      amount,
      currency,
      chain,
      trust_level: authority.trust_level,
    },
  })

  // ── Fire webhook ────────────────────────────────────────────
  sendWebhook(auth.user_id, 'payment.authorized', {
    payment_id: paymentId,
    from_agent_id,
    to_agent_id,
    amount,
    currency,
    chain,
    trust_level: authority.trust_level,
    remaining_daily_limit: spendResult.remaining_daily_limit,
    expires_at: expiresAt,
  })

  // ── Track usage ─────────────────────────────────────────────
  await trackUsage(auth.user_id, 'payment')

  // ── Create dual receipt ────────────────────────────────────
  const dualReceipt = await createDualReceipt('payment', from_agent_id, {
    payment_id: paymentId,
    from_agent_id,
    to_agent_id,
    amount,
    currency,
    chain,
    trust_level: authority.trust_level,
  })

  return NextResponse.json({
    payment_id: paymentId,
    status: 'authorized',
    from_agent_id,
    from_agent_name: fromAgent.name,
    to_agent_id,
    to_agent_name: toAgent.name,
    amount,
    currency,
    chain,
    trust_level: authority.trust_level,
    remaining_daily_limit: spendResult.remaining_daily_limit,
    spend_transaction_id: spendResult.transaction.id,
    receipt: dualReceipt,
    expires_at: expiresAt,
    created_at: now,
  })
}

// ── Create Agent-to-Human Payment Intent ─────────────────────────────────────
//
// Security check sequence (every step must pass):
//   1. Sending agent exists, is verified, and is NOT frozen
//   2. Wallet address format is valid for the specified chain
//   3. Wallet is NOT a known dead/burn address
//   4. Wallet is on the owner's allowlist
//   5. Cooling period — 24h delay on first payment to a new wallet
//   6. Duplicate detection — same amount + same wallet within 10 min
//   7. Trust-level spending authority (existing system)
//   8. Per-recipient daily limit
//   9. Dual-approval check — large payments need owner sign-off

async function handleHumanPayment(
  auth: { user_id: string; api_key_id: string; profile: any },
  body: any
) {
  const { from_agent_id, to_wallet, amount, currency = 'usd', chain = 'solana' } = body

  // ── Validate required fields ──────────────────────────────────
  if (!from_agent_id) {
    return NextResponse.json({ error: 'from_agent_id is required' }, { status: 400 })
  }
  if (!to_wallet || typeof to_wallet !== 'string') {
    return NextResponse.json({ error: 'to_wallet is required (destination wallet address)' }, { status: 400 })
  }
  if (amount == null || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!SUPPORTED_CHAINS.includes(chain as Chain)) {
    return NextResponse.json({
      error: `Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(', ')}`,
    }, { status: 400 })
  }

  const db = getServiceClient()
  const trimmedWallet = to_wallet.trim()

  // ── 1. Verify the sending agent exists, is verified, caller owns it ──
  const { data: fromAgent, error: fromErr } = await db
    .from('agents')
    .select('agent_id, name, user_id, wallet_address, wallet_chain, verified, active')
    .eq('agent_id', from_agent_id)
    .single()

  if (fromErr || !fromAgent) {
    return NextResponse.json({ error: 'Sending agent not found' }, { status: 404 })
  }

  if (fromAgent.user_id !== auth.user_id) {
    return NextResponse.json({ error: 'You do not own the sending agent' }, { status: 403 })
  }

  if (!fromAgent.verified) {
    return NextResponse.json({
      error: 'Sending agent must be verified to make payments to human wallets',
    }, { status: 403 })
  }

  // ── 1b. Check if agent is frozen ──────────────────────────────
  const frozen = await isAgentFrozen(from_agent_id)
  if (frozen) {
    sendWebhook(auth.user_id, 'payment.denied', {
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      chain,
      reason: 'Agent payments are frozen',
    })
    return NextResponse.json({
      status: 'denied',
      reason: 'Agent payments are frozen. The owner must unfreeze this agent before it can make payments.',
      from_agent_id,
      to_wallet: trimmedWallet,
    }, { status: 403 })
  }

  // ── 2. Validate wallet address format ─────────────────────────
  const walletValidation = validateWalletAddress(trimmedWallet, chain)
  if (!walletValidation.valid) {
    return NextResponse.json({
      error: walletValidation.error,
      to_wallet: trimmedWallet,
      chain,
    }, { status: 400 })
  }

  // ── 3. Dead wallet check ──────────────────────────────────────
  const dead = await isDeadWallet(trimmedWallet, chain)
  if (dead) {
    return NextResponse.json({
      error: 'Destination wallet appears to be a burn/dead address. Payment blocked for safety.',
      to_wallet: trimmedWallet,
      chain,
    }, { status: 400 })
  }

  // ── 4. Allowlist check — wallet must be pre-approved ──────────
  const allowed = await isAllowlisted(auth.user_id, trimmedWallet)
  if (!allowed) {
    return NextResponse.json({
      error: 'Destination wallet is not on your allowlist. Add it via the payment-settings endpoint first.',
      to_wallet: trimmedWallet,
      action_required: 'POST /api/v1/agents/payment-settings with { action: "add_allowlist", wallet_address, chain, label }',
    }, { status: 403 })
  }

  // ── 5. Cooling period — 24h delay on first payment to new wallet ──
  const cooling = await checkCoolingPeriod(from_agent_id, trimmedWallet)
  if (!cooling.allowed) {
    // If this is the very first attempt, create a cooling record
    const paymentId = `pay_${crypto.randomBytes(12).toString('hex')}`
    const now = new Date().toISOString()

    // Check if a cooling record already exists (to avoid duplicates)
    const { data: existingCooling } = await db
      .from('agent_payments')
      .select('id, created_at')
      .eq('from_agent_id', from_agent_id)
      .eq('to_wallet', trimmedWallet)
      .eq('status', 'cooling')
      .limit(1)
      .single()

    if (!existingCooling) {
      // Create the cooling record
      await db.from('agent_payments').insert({
        id: paymentId,
        from_agent_id,
        to_wallet: trimmedWallet,
        amount,
        currency,
        chain,
        status: 'cooling',
        user_id: auth.user_id,
        payment_type: 'agent_to_human',
      })

      // Notify owner about the cooling period
      sendWebhook(auth.user_id, 'payment.human_pending_approval', {
        payment_id: paymentId,
        from_agent_id,
        to_wallet: trimmedWallet,
        amount,
        chain,
        message: 'First payment to a new wallet. 24-hour cooling period started. Payment will be allowed after the cooling period.',
        cooldown_remaining_seconds: cooling.cooldown_remaining_seconds,
      })
    }

    return NextResponse.json({
      status: 'cooling',
      reason: 'First payment to this wallet requires a 24-hour cooling period. The owner has been notified.',
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      chain,
      cooldown_remaining_seconds: cooling.cooldown_remaining_seconds,
      payment_id: existingCooling?.id || paymentId,
    }, { status: 202 })
  }

  // ── 6. Duplicate detection — same amount + same wallet within 10 min ──
  const duplicate = await isDuplicatePayment(from_agent_id, trimmedWallet, amount)
  if (duplicate) {
    return NextResponse.json({
      error: 'Duplicate payment detected. Same amount to same wallet within 10 minutes.',
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      chain,
    }, { status: 409 })
  }

  // ── 7. Check spending authority (trust level + daily limit) ───
  const authority = await checkSpendingAuthority(from_agent_id, amount, currency)

  if (!authority.authorized) {
    sendWebhook(auth.user_id, 'payment.denied', {
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      currency,
      chain,
      reason: authority.reason,
      trust_level: authority.trust_level,
      payment_type: 'agent_to_human',
    })

    return NextResponse.json({
      status: 'denied',
      reason: authority.reason,
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      chain,
      trust_level: authority.trust_level,
      daily_limit: authority.daily_limit,
      spent_today: authority.spent_today,
      remaining_daily_limit: authority.remaining_daily_limit,
    }, { status: 403 })
  }

  // ── 8. Per-recipient daily limit ──────────────────────────────
  const recipientLimit = await checkRecipientDailyLimit(
    from_agent_id,
    trimmedWallet,
    amount,
    authority.trust_level
  )

  if (!recipientLimit.allowed) {
    sendWebhook(auth.user_id, 'payment.denied', {
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      chain,
      reason: `Per-recipient daily limit exceeded. Limit: $${recipientLimit.limit}, spent today to this wallet: $${recipientLimit.spent_today.toFixed(2)}`,
      payment_type: 'agent_to_human',
    })

    return NextResponse.json({
      status: 'denied',
      reason: `Per-recipient daily limit exceeded. Limit: $${recipientLimit.limit}, spent today to this wallet: $${recipientLimit.spent_today.toFixed(2)}`,
      from_agent_id,
      to_wallet: trimmedWallet,
      amount,
      chain,
      recipient_daily_limit: recipientLimit.limit,
      recipient_spent_today: recipientLimit.spent_today,
    }, { status: 403 })
  }

  // ── Record the spend against daily limits ───────────────────
  const spendResult = await recordSpend(
    from_agent_id,
    amount,
    currency,
    `Agent-to-human payment to wallet ${trimmedWallet}`,
    trimmedWallet
  )

  if ('error' in spendResult) {
    return NextResponse.json({ error: spendResult.error }, { status: 500 })
  }

  // ── Create the payment record ─────────────────────────────────
  const paymentId = `pay_${crypto.randomBytes(12).toString('hex')}`
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString()

  const { error: insertErr } = await db.from('agent_payments').insert({
    id: paymentId,
    from_agent_id,
    to_wallet: trimmedWallet,
    amount,
    currency,
    chain,
    status: 'authorized', // May be overridden to pending_approval below
    trust_level: authority.trust_level,
    spend_transaction_id: spendResult.transaction.id,
    receipt: spendResult.transaction.receipt,
    expires_at: expiresAt,
    user_id: auth.user_id,
    payment_type: 'agent_to_human',
  })

  if (insertErr) {
    console.error('Failed to create human payment intent:', insertErr)
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
  }

  // ── 9. Dual-approval check — large payments need owner sign-off ──
  const needsApproval = requiresDualApproval(authority.trust_level, amount)

  if (needsApproval) {
    // Set to pending approval — owner must approve within 1 hour
    await requestOwnerApproval(auth.user_id, paymentId, {
      from_agent_id,
      from_agent_name: fromAgent.name,
      to_wallet: trimmedWallet,
      amount,
      currency,
      chain,
      trust_level: authority.trust_level,
      payment_type: 'agent_to_human',
    })

    // Log event
    await db.from('agent_events').insert({
      agent_id: from_agent_id,
      event_type: 'payment_pending_approval',
      data: {
        payment_id: paymentId,
        to_wallet: trimmedWallet,
        amount,
        currency,
        chain,
        trust_level: authority.trust_level,
        reason: 'Amount exceeds dual-approval threshold',
      },
    })

    await trackUsage(auth.user_id, 'payment')

    return NextResponse.json({
      payment_id: paymentId,
      status: 'pending_approval',
      reason: `Payment of $${amount} exceeds the dual-approval threshold. Owner must approve within 1 hour.`,
      from_agent_id,
      from_agent_name: fromAgent.name,
      to_wallet: trimmedWallet,
      amount,
      currency,
      chain,
      trust_level: authority.trust_level,
      approval_required: true,
      created_at: now,
    }, { status: 202 })
  }

  // ── Payment authorized — no approval needed ───────────────────

  // Log event
  await db.from('agent_events').insert({
    agent_id: from_agent_id,
    event_type: 'payment_human_authorized',
    data: {
      payment_id: paymentId,
      to_wallet: trimmedWallet,
      amount,
      currency,
      chain,
      trust_level: authority.trust_level,
    },
  })

  // Fire webhook — owner is notified on EVERY payment
  sendWebhook(auth.user_id, 'payment.human_authorized', {
    payment_id: paymentId,
    from_agent_id,
    from_agent_name: fromAgent.name,
    to_wallet: trimmedWallet,
    amount,
    currency,
    chain,
    trust_level: authority.trust_level,
    remaining_daily_limit: spendResult.remaining_daily_limit,
    recipient_spent_today: recipientLimit.spent_today + amount,
    recipient_daily_limit: recipientLimit.limit,
    expires_at: expiresAt,
  })

  await trackUsage(auth.user_id, 'payment')

  // ── Create dual receipt ────────────────────────────────────
  const dualReceipt = await createDualReceipt('payment', from_agent_id, {
    payment_id: paymentId,
    payment_type: 'agent_to_human',
    from_agent_id,
    to_wallet: trimmedWallet,
    amount,
    currency,
    chain,
    trust_level: authority.trust_level,
  })

  return NextResponse.json({
    payment_id: paymentId,
    status: 'authorized',
    payment_type: 'agent_to_human',
    from_agent_id,
    from_agent_name: fromAgent.name,
    to_wallet: trimmedWallet,
    amount,
    currency,
    chain,
    trust_level: authority.trust_level,
    remaining_daily_limit: spendResult.remaining_daily_limit,
    recipient_spent_today: recipientLimit.spent_today + amount,
    recipient_daily_limit: recipientLimit.limit,
    spend_transaction_id: spendResult.transaction.id,
    receipt: dualReceipt,
    expires_at: expiresAt,
    created_at: now,
  })
}

// ── Execute Payment (attach signed transaction) ──────────────────────────────

async function handleExecute(
  auth: { user_id: string; api_key_id: string; profile: any },
  body: any
) {
  const { payment_id, signed_transaction } = body

  if (!payment_id) {
    return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })
  }
  if (!signed_transaction || typeof signed_transaction !== 'string') {
    return NextResponse.json({ error: 'signed_transaction is required (hex string)' }, { status: 400 })
  }

  const db = getServiceClient()

  // ── Look up the payment intent ──────────────────────────────
  const { data: payment, error: fetchErr } = await db
    .from('agent_payments')
    .select('*')
    .eq('id', payment_id)
    .single()

  if (fetchErr || !payment) {
    return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
  }

  // Verify ownership
  if (payment.user_id !== auth.user_id) {
    return NextResponse.json({ error: 'You do not own this payment intent' }, { status: 403 })
  }

  // Check status
  if (payment.status === 'executed') {
    return NextResponse.json({ error: 'Payment already executed' }, { status: 409 })
  }
  if (payment.status !== 'authorized') {
    return NextResponse.json({ error: `Payment cannot be executed — status is "${payment.status}"` }, { status: 400 })
  }

  // Check expiry
  if (payment.expires_at && new Date(payment.expires_at) < new Date()) {
    // Mark as expired
    await db.from('agent_payments').update({ status: 'expired' }).eq('id', payment_id)
    return NextResponse.json({ error: 'Payment intent has expired' }, { status: 410 })
  }

  // If this is an agent-to-human payment, re-check freeze status
  if (payment.to_wallet) {
    const frozen = await isAgentFrozen(payment.from_agent_id)
    if (frozen) {
      return NextResponse.json({
        error: 'Agent payments are frozen. Cannot execute.',
        from_agent_id: payment.from_agent_id,
      }, { status: 403 })
    }
  }

  // ── Update payment with signed transaction ──────────────────
  const executedAt = new Date().toISOString()

  const { error: updateErr } = await db
    .from('agent_payments')
    .update({
      status: 'executed',
      signed_transaction,
      executed_at: executedAt,
    })
    .eq('id', payment_id)

  if (updateErr) {
    console.error('Failed to execute payment:', updateErr)
    return NextResponse.json({ error: 'Failed to execute payment' }, { status: 500 })
  }

  // ── Log event ───────────────────────────────────────────────
  await db.from('agent_events').insert({
    agent_id: payment.from_agent_id,
    event_type: 'payment_executed',
    data: {
      payment_id,
      to_agent_id: payment.to_agent_id || null,
      to_wallet: payment.to_wallet || null,
      amount: payment.amount,
      chain: payment.chain,
      payment_type: payment.payment_type || 'agent_to_agent',
      signed_transaction,
    },
  })

  // ── Track usage ─────────────────────────────────────────────
  await trackUsage(auth.user_id, 'payment_execute')

  // ── Create dual receipt for execution ──────────────────────
  const executionReceipt = await createDualReceipt('payment', payment.from_agent_id, {
    payment_id,
    action: 'execute',
    from_agent_id: payment.from_agent_id,
    to_agent_id: payment.to_agent_id || null,
    to_wallet: payment.to_wallet || null,
    amount: payment.amount,
    chain: payment.chain,
    signed_transaction,
    executed_at: executedAt,
  })

  return NextResponse.json({
    payment_id,
    status: 'executed',
    from_agent_id: payment.from_agent_id,
    to_agent_id: payment.to_agent_id || null,
    to_wallet: payment.to_wallet || null,
    payment_type: payment.payment_type || 'agent_to_agent',
    amount: payment.amount,
    currency: payment.currency,
    chain: payment.chain,
    signed_transaction,
    receipt: executionReceipt,
    executed_at: executedAt,
  })
}
