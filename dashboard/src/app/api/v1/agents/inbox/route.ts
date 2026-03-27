import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { calculateTrustLevel, TRUST_LEVEL_LABELS, type AgentTrustData } from '@/lib/trust-levels'
import { quickAnomalyCheck, calculateRiskScore } from '@/lib/behaviour'

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

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agent_id')
    const status = searchParams.get('status') || 'pending'

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify the user owns this agent
    const { data: agent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', auth.user_id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Get messages for this agent
    let query = db
      .from('agent_messages')
      .select('*')
      .eq('to_agent', agentId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: messages } = await query

    // Enrich with sender info, trust level, risk score, and receipt
    const enriched = []
    for (const msg of (messages || [])) {
      const { data: sender } = await db
        .from('agents')
        .select('*')
        .eq('agent_id', msg.from_agent)
        .single()

      // Calculate sender trust level
      let senderTrustLevel = 0
      let senderTrustLabel = TRUST_LEVEL_LABELS[0]
      if (sender) {
        try {
          senderTrustLevel = await getAgentTrustLevel(sender, db)
          senderTrustLabel = (TRUST_LEVEL_LABELS as any)[senderTrustLevel]
        } catch {
          // Default to L0 if trust level calculation fails
        }
      }

      // Calculate sender risk score (non-blocking)
      let senderRiskScore = 0
      try {
        const anomalies = await quickAnomalyCheck(msg.from_agent)
        senderRiskScore = calculateRiskScore(anomalies)
      } catch {
        // Default to 0 if behaviour check fails
      }

      // Look up any existing receipt for this message
      let messageReceipt = null
      try {
        const { data: receiptData } = await db
          .from('action_receipts')
          .select('receipt_id, action, timestamp, data_hash, signature, tx_hash, cluster, explorer_url')
          .eq('agent_id', msg.from_agent)
          .eq('action', 'connection')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()

        if (receiptData) {
          messageReceipt = {
            hash: {
              receipt_id: receiptData.receipt_id,
              action: receiptData.action,
              agent_id: msg.from_agent,
              timestamp: receiptData.timestamp,
              data_hash: receiptData.data_hash,
              signature: receiptData.signature,
            },
            blockchain: receiptData.tx_hash ? {
              tx_hash: receiptData.tx_hash,
              explorer_url: receiptData.explorer_url,
            } : null,
          }
        }
      } catch {
        // Non-blocking — receipt lookup failure is not critical
      }

      enriched.push({
        message_id: msg.id,
        from_agent: msg.from_agent,
        from_name: sender?.name || 'Unknown',
        from_owner: sender?.owner || 'Unknown',
        from_verified: sender?.verified || false,
        from_trust_score: sender?.trust_score || 0,
        from_trust_level: senderTrustLevel,
        from_trust_label: senderTrustLabel,
        from_risk_score: senderRiskScore,
        message_type: msg.message_type,
        payload: msg.payload,
        status: msg.status,
        response: msg.response,
        created_at: msg.created_at,
        responded_at: msg.responded_at,
        receipt: messageReceipt,
        blockchain_receipt: messageReceipt?.blockchain || null,
        sender_trust_level: senderTrustLevel,
        sender_risk_score: senderRiskScore,
      })
    }

    return NextResponse.json({
      agent_id: agentId,
      messages: enriched,
      count: enriched.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
