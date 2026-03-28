import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'
import { notifyAgentConnect } from '@/lib/notify'
import { calculateTrustLevel, checkPermission, TRUST_LEVEL_LABELS, PERMISSIONS, type AgentTrustData } from '@/lib/trust-levels'
import { quickAnomalyCheck, calculateRiskScore, type AnomalyAlert } from '@/lib/behaviour'
import { createDualReceipt } from '@/lib/receipts'
import { sendWebhook } from '@/lib/webhooks'

// ── Helper: compute trust level for an agent row ────────────────────────────

async function getAgentTrustLevel(agent: any, db: any) {
  // Check certificate validity
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
  const { count: verificationCount } = await db
    .from('agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.agent_id)
    .eq('event_type', 'verified')

  // Get owner profile
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
    ed25519_key: agent.ed25519_key ?? null,
    wallet_address: agent.wallet_address ?? null,
  }

  return calculateTrustLevel(trustData)
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate sender
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { from_agent, to_agent, message_type, payload } = body

    if (!from_agent || !to_agent) {
      return NextResponse.json({ error: 'from_agent and to_agent are required' }, { status: 400 })
    }
    if (!payload) {
      return NextResponse.json({ error: 'payload is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify sender owns the from_agent
    const { data: senderAgent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', from_agent)
      .eq('user_id', auth.user_id)
      .single()

    if (!senderAgent) {
      return NextResponse.json({ error: 'You do not own the sending agent' }, { status: 403 })
    }

    // Verify receiver exists and is active
    const { data: receiverAgent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', to_agent)
      .eq('active', true)
      .single()

    if (!receiverAgent) {
      return NextResponse.json({ error: 'Receiving agent not found or inactive' }, { status: 404 })
    }

    // Check both agents' verification status
    const senderVerified = senderAgent.verified && senderAgent.active
    const receiverVerified = receiverAgent.verified && receiverAgent.active

    // ── Trust level checks ──────────────────────────────────────────────────
    // L1+ can connect — all registered agents can connect immediately.

    const senderTrustLevel = await getAgentTrustLevel(senderAgent, db)
    const receiverTrustLevel = await getAgentTrustLevel(receiverAgent, db)

    // L1+ has connect permission, so this only blocks if something is truly wrong
    if (!checkPermission(senderTrustLevel, 'connect')) {
      return NextResponse.json({
        error: 'Sender agent does not have permission to connect. L1+ required.',
        sender_trust_level: senderTrustLevel,
        sender_trust_label: TRUST_LEVEL_LABELS[senderTrustLevel],
        required: 'L1 — Registered',
      }, { status: 403 })
    }

    // ── Behavioural anomaly check on sender ─────────────────────────────────
    // The behavioural system stays — it's security, not governance.
    // Only block on HIGH severity (50+ calls/hour).

    let sender_behaviour_warnings: AnomalyAlert[] = []
    let sender_risk_score = 0
    try {
      sender_behaviour_warnings = await quickAnomalyCheck(from_agent)
      sender_risk_score = calculateRiskScore(sender_behaviour_warnings)

      // Log anomaly if any detected
      if (sender_behaviour_warnings.length > 0) {
        await db.from('agent_events').insert({
          agent_id: from_agent,
          event_type: 'anomaly_detected',
          data: {
            context: 'connect',
            target_agent: to_agent,
            risk_score: sender_risk_score,
            anomaly_count: sender_behaviour_warnings.length,
            types: sender_behaviour_warnings.map((a) => a.type),
            severities: sender_behaviour_warnings.map((a) => a.severity),
          },
        })
      }

      // Block connection if high-risk anomaly detected
      if (sender_behaviour_warnings.some((a) => a.severity === 'high')) {
        // Log connection_revoked event
        await db.from('agent_events').insert({
          agent_id: from_agent,
          event_type: 'connection_revoked',
          data: {
            target_agent: to_agent,
            risk_score: sender_risk_score,
            reason: 'High-risk behavioural anomaly detected',
            anomalies: sender_behaviour_warnings.filter((a) => a.severity === 'high').map((a) => a.type),
          },
        })

        // Fire webhook to alert agent owner
        if (senderAgent.user_id) {
          sendWebhook(senderAgent.user_id, 'agent.connection_blocked', {
            agent_id: from_agent,
            name: senderAgent.name,
            target_agent: to_agent,
            risk_score: sender_risk_score,
            anomalies: sender_behaviour_warnings.filter((a) => a.severity === 'high'),
            reason: 'High-risk behavioural anomaly detected',
          })
        }

        return NextResponse.json({
          error: 'Connection blocked — high-risk behavioural anomaly detected on sending agent',
          sender_risk_score,
          anomalies: sender_behaviour_warnings.filter((a) => a.severity === 'high'),
        }, { status: 403 })
      }
    } catch {
      // Never block the connection on behaviour check failure
    }

    // ── Create the message ──────────────────────────────────────────────────

    const { data: msg, error: msgError } = await db
      .from('agent_messages')
      .insert({
        from_agent,
        to_agent,
        message_type: message_type || 'request',
        payload,
        status: 'pending',
        verified_sender: senderVerified,
        verified_receiver: receiverVerified,
      })
      .select()
      .single()

    if (msgError) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Log events for both agents
    await db.from('agent_events').insert([
      { agent_id: from_agent, event_type: 'message_sent', data: { to: to_agent, message_id: msg.id, type: message_type } },
      { agent_id: to_agent, event_type: 'message_received', data: { from: from_agent, message_id: msg.id, type: message_type } },
    ])

    await trackUsage(auth.user_id, 'connect')
    await notifyAgentConnect(senderAgent.name, receiverAgent.name, senderVerified && receiverVerified)

    // ── Create dual receipt for the connection ──────────────────────────────

    let receipt = null
    try {
      receipt = await createDualReceipt('connection', from_agent, {
        message_id: msg.id,
        from_agent,
        to_agent,
        message_type: message_type || 'request',
        sender_trust_level: senderTrustLevel,
        receiver_trust_level: receiverTrustLevel,
        both_verified: senderVerified && receiverVerified,
      }, { trust_level: senderTrustLevel, permissions: PERMISSIONS[senderTrustLevel] })
    } catch {
      // Never block on receipt creation failure
    }

    // ── Fire webhook: agent.connected ────────────────────────────────────────

    if (senderAgent.user_id) {
      sendWebhook(senderAgent.user_id, 'agent.connected', {
        message_id: msg.id,
        from_agent,
        to_agent,
        from_name: senderAgent.name,
        to_name: receiverAgent.name,
        sender_trust_level: senderTrustLevel,
        receiver_trust_level: receiverTrustLevel,
        sender_risk_score,
        both_verified: senderVerified && receiverVerified,
      })
    }

    // Also notify the receiver's owner
    if (receiverAgent.user_id && receiverAgent.user_id !== senderAgent.user_id) {
      sendWebhook(receiverAgent.user_id, 'agent.connected', {
        message_id: msg.id,
        from_agent,
        to_agent,
        from_name: senderAgent.name,
        to_name: receiverAgent.name,
        sender_trust_level: senderTrustLevel,
        receiver_trust_level: receiverTrustLevel,
        sender_risk_score,
        both_verified: senderVerified && receiverVerified,
      })
    }

    return NextResponse.json({
      message_id: msg.id,
      status: 'pending',
      sender: {
        agent_id: from_agent,
        name: senderAgent.name,
        verified: senderVerified,
        trust_level: senderTrustLevel,
        trust_label: TRUST_LEVEL_LABELS[senderTrustLevel],
        risk_score: sender_risk_score,
      },
      receiver: {
        agent_id: to_agent,
        name: receiverAgent.name,
        verified: receiverVerified,
        trust_level: receiverTrustLevel,
        trust_label: TRUST_LEVEL_LABELS[receiverTrustLevel],
      },
      trust_check: {
        both_verified: senderVerified && receiverVerified,
        sender_verified: senderVerified,
        receiver_verified: receiverVerified,
        sender_trust_level: senderTrustLevel,
        receiver_trust_level: receiverTrustLevel,
        recommendation: senderVerified && receiverVerified
          ? 'TRUSTED — both agents verified. Safe to exchange data.'
          : !senderVerified && !receiverVerified
          ? 'UNTRUSTED — neither agent is verified. Do not exchange sensitive data.'
          : 'PARTIAL — one agent is unverified. Proceed with caution.',
      },
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
      sender_trust_level: senderTrustLevel,
      sender_risk_score,
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
