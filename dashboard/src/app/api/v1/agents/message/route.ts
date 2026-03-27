import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { calculateTrustLevel, checkPermission, getSpendingLimit, TRUST_LEVEL_LABELS, type AgentTrustData } from '@/lib/trust-levels'
import { quickAnomalyCheck, calculateRiskScore, type AnomalyAlert } from '@/lib/behaviour'
import { createDualReceipt } from '@/lib/receipts'
import { sendWebhook } from '@/lib/webhooks'
import {
  isAllowlisted,
  isDuplicatePayment,
  checkRecipientDailyLimit,
  requiresDualApproval,
  requestOwnerApproval,
  isAgentFrozen,
  checkCoolingPeriod,
  validateWalletAddress,
} from '@/lib/payment-security'
import crypto from 'crypto'

// ── Helper: compute trust level for an agent row ────────────────────────────

async function getAgentTrustLevel(agent: any, db: any) {
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

  const { count: verificationCount } = await db
    .from('agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.agent_id)
    .eq('event_type', 'verified')

  const { data: ownerProfile } = await db
    .from('profiles')
    .select('email_verified, entity_verified')
    .eq('id', agent.user_id)
    .single()

  const trustData: AgentTrustData = {
    trust_score: agent.trust_score ?? 0,
    verified: agent.verified ?? false,
    certificate_valid,
    entity_verified: ownerProfile?.entity_verified === true,
    owner_email_verified: ownerProfile?.email_verified === true,
    created_at: agent.created_at,
    successful_verifications: verificationCount ?? 0,
  }

  return calculateTrustLevel(trustData)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { message_id, response, payment_amount, payment_wallet, payment_chain } = body

    if (!message_id) {
      return NextResponse.json({ error: 'message_id is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Get the message
    const { data: msg } = await db
      .from('agent_messages')
      .select('*')
      .eq('id', message_id)
      .single()

    if (!msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Verify the responder owns the receiving agent
    const { data: receiverAgent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', msg.to_agent)
      .eq('user_id', auth.user_id)
      .single()

    if (!receiverAgent) {
      return NextResponse.json({ error: 'You do not own the receiving agent' }, { status: 403 })
    }

    // Get the sender agent for trust/behaviour checks
    const { data: senderAgent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', msg.from_agent)
      .single()

    if (!senderAgent) {
      return NextResponse.json({ error: 'Sending agent no longer exists' }, { status: 404 })
    }

    // ── Trust level checks ──────────────────────────────────────────────────

    const senderTrustLevel = await getAgentTrustLevel(senderAgent, db)
    const receiverTrustLevel = await getAgentTrustLevel(receiverAgent, db)

    // L2+ required to send messages
    if (!checkPermission(senderTrustLevel, 'send_message')) {
      return NextResponse.json({
        error: 'Sender agent does not have permission to send messages. L2+ required.',
        sender_trust_level: senderTrustLevel,
        sender_trust_label: (TRUST_LEVEL_LABELS as any)[senderTrustLevel],
        required: 'L2 — Verified',
      }, { status: 403 })
    }

    // ── Behavioural anomaly check on sender ─────────────────────────────────

    let sender_behaviour_warnings: AnomalyAlert[] = []
    let sender_risk_score = 0
    try {
      sender_behaviour_warnings = await quickAnomalyCheck(msg.from_agent)
      sender_risk_score = calculateRiskScore(sender_behaviour_warnings)

      // Block message if high-risk anomaly detected
      if (sender_behaviour_warnings.some((a) => a.severity === 'high')) {
        if (senderAgent.user_id) {
          sendWebhook(senderAgent.user_id, 'agent.message_blocked', {
            agent_id: msg.from_agent,
            name: senderAgent.name,
            message_id,
            risk_score: sender_risk_score,
            anomalies: sender_behaviour_warnings.filter((a) => a.severity === 'high'),
            reason: 'High-risk behavioural anomaly detected',
          })
        }

        return NextResponse.json({
          error: 'Message blocked — high-risk behavioural anomaly detected on sending agent',
          sender_risk_score,
          anomalies: sender_behaviour_warnings.filter((a) => a.severity === 'high'),
        }, { status: 403 })
      }
    } catch {
      // Never block on behaviour check failure
    }

    // ── Payment security flow (if message contains a payment) ───────────────

    let payment_result = null
    if (payment_amount && payment_amount > 0) {
      const wallet = payment_wallet || ''
      const chain = payment_chain || 'solana'

      // Check trust level allows payments
      if (!checkPermission(senderTrustLevel, 'make_payment')) {
        return NextResponse.json({
          error: 'Sender agent does not have permission to make payments. L3+ required.',
          sender_trust_level: senderTrustLevel,
          sender_trust_label: (TRUST_LEVEL_LABELS as any)[senderTrustLevel],
          required: 'L3 — Trusted',
        }, { status: 403 })
      }

      // Check spending authority (daily limit)
      const dailyLimit = getSpendingLimit(senderTrustLevel)
      if (payment_amount > dailyLimit) {
        return NextResponse.json({
          error: `Payment amount ($${payment_amount}) exceeds daily spending limit ($${dailyLimit}) for trust level ${(TRUST_LEVEL_LABELS as any)[senderTrustLevel]}`,
          sender_trust_level: senderTrustLevel,
          spending_limit: dailyLimit,
        }, { status: 403 })
      }

      // Check if agent payments are frozen
      const frozen = await isAgentFrozen(msg.from_agent)
      if (frozen) {
        return NextResponse.json({
          error: 'Payments for this agent are currently frozen by the owner',
        }, { status: 403 })
      }

      // If paying to a wallet, run wallet security checks
      if (wallet) {
        // Validate wallet address format
        const walletValidation = validateWalletAddress(wallet, chain)
        if (!walletValidation.valid) {
          return NextResponse.json({
            error: `Invalid wallet address: ${walletValidation.error}`,
          }, { status: 400 })
        }

        // Check allowlist
        const allowed = await isAllowlisted(senderAgent.user_id, wallet)
        if (!allowed) {
          return NextResponse.json({
            error: 'Destination wallet is not on the owner\'s allowlist. The owner must pre-approve this wallet.',
          }, { status: 403 })
        }

        // Check cooling period for first payment to new wallet
        const cooling = await checkCoolingPeriod(msg.from_agent, wallet)
        if (!cooling.allowed) {
          return NextResponse.json({
            error: 'First payment to this wallet — 24-hour cooling period active.',
            cooldown_remaining_seconds: cooling.cooldown_remaining_seconds,
          }, { status: 403 })
        }

        // Check for duplicate payment
        const duplicate = await isDuplicatePayment(msg.from_agent, wallet, payment_amount)
        if (duplicate) {
          return NextResponse.json({
            error: 'Duplicate payment detected — same amount to same wallet within 10 minutes.',
          }, { status: 409 })
        }

        // Check per-recipient daily limit
        const recipientLimit = await checkRecipientDailyLimit(msg.from_agent, wallet, payment_amount, senderTrustLevel)
        if (!recipientLimit.allowed) {
          return NextResponse.json({
            error: `Per-recipient daily limit exceeded. Spent today: $${recipientLimit.spent_today}, Limit: $${recipientLimit.limit}`,
          }, { status: 403 })
        }
      }

      // Create payment intent record
      const paymentId = `pay_${crypto.randomBytes(12).toString('hex')}`
      const { error: paymentInsertErr } = await db.from('agent_payments').insert({
        id: paymentId,
        from_agent_id: msg.from_agent,
        to_wallet: wallet || null,
        amount: payment_amount,
        chain,
        status: 'authorized',
        user_id: senderAgent.user_id,
        message_id,
      })

      if (paymentInsertErr) {
        console.error('Failed to create payment intent:', paymentInsertErr)
      }

      // Check if dual approval is required
      if (requiresDualApproval(senderTrustLevel, payment_amount)) {
        try {
          await requestOwnerApproval(senderAgent.user_id, paymentId, {
            from_agent: msg.from_agent,
            to_wallet: wallet,
            amount: payment_amount,
            chain,
            message_id,
          })
        } catch (e: any) {
          console.error('Failed to request owner approval:', e.message)
        }

        payment_result = {
          payment_id: paymentId,
          status: 'pending_approval',
          message: 'Payment requires owner approval. Owner has been notified.',
          amount: payment_amount,
          wallet: wallet || null,
          chain,
        }
      } else {
        payment_result = {
          payment_id: paymentId,
          status: 'authorized',
          amount: payment_amount,
          wallet: wallet || null,
          chain,
        }
      }
    }

    // ── Update the message with response ────────────────────────────────────

    await db
      .from('agent_messages')
      .update({
        status: 'responded',
        response: response || { acknowledged: true },
        responded_at: new Date().toISOString(),
      })
      .eq('id', message_id)

    // Log response event
    await db.from('agent_events').insert({
      agent_id: msg.to_agent,
      event_type: 'message_responded',
      data: { message_id, from: msg.from_agent },
    })

    // ── Create dual receipt for the message ──────────────────────────────────

    let receipt = null
    try {
      receipt = await createDualReceipt('message', msg.from_agent, {
        message_id,
        from_agent: msg.from_agent,
        to_agent: msg.to_agent,
        sender_trust_level: senderTrustLevel,
        receiver_trust_level: receiverTrustLevel,
        has_payment: !!payment_result,
        ...(payment_result && { payment: payment_result }),
      })
    } catch {
      // Never block on receipt creation failure
    }

    // ── Fire webhook: agent.message_sent ─────────────────────────────────────

    if (senderAgent.user_id) {
      sendWebhook(senderAgent.user_id, 'agent.message_sent', {
        message_id,
        from_agent: msg.from_agent,
        to_agent: msg.to_agent,
        sender_trust_level: senderTrustLevel,
        sender_risk_score,
        has_payment: !!payment_result,
        ...(payment_result && { payment: payment_result }),
      })
    }

    return NextResponse.json({
      message_id,
      status: 'responded',
      message: 'Response sent successfully',
      sender_trust_level: senderTrustLevel,
      sender_risk_score,
      receiver_trust_level: receiverTrustLevel,
      ...(payment_result && { payment: payment_result }),
      receipt: receipt ? {
        hash: receipt.hash,
        blockchain: receipt.blockchain ? {
          tx_hash: receipt.blockchain.tx_hash,
          explorer_url: receipt.blockchain.explorer_url,
        } : null,
      } : null,
      blockchain_receipt: receipt?.blockchain ? {
        tx_hash: receipt.blockchain.tx_hash,
        explorer_url: receipt.blockchain.explorer_url,
      } : null,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
