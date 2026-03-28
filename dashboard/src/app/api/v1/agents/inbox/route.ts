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
    ed25519_key: agent.ed25519_key ?? null,
    wallet_address: agent.wallet_address ?? null,
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

    // Batch-fetch all unique sender agents in ONE query instead of per-message
    const allMessages = messages || []
    const uniqueSenderIds = Array.from(new Set(allMessages.map((m: any) => m.from_agent))) as string[]

    // Fetch all senders at once
    const senderCache: Record<string, any> = {}
    if (uniqueSenderIds.length > 0) {
      const { data: senders } = await db
        .from('agents')
        .select('agent_id, name, owner, trust_score, verified, active, certificate, user_id, ed25519_key, wallet_address, created_at')
        .in('agent_id', uniqueSenderIds)

      for (const s of (senders || [])) {
        senderCache[s.agent_id] = s
      }
    }

    // Calculate trust levels for unique senders (not per-message)
    const trustCache: Record<string, { level: number; label: string }> = {}
    for (const senderId of uniqueSenderIds) {
      const sender = senderCache[senderId]
      if (sender) {
        try {
          const level = await getAgentTrustLevel(sender, db)
          trustCache[senderId] = {
            level,
            label: (TRUST_LEVEL_LABELS as any)[level] || 'L1 — Registered',
          }
        } catch {
          trustCache[senderId] = { level: 1, label: 'L1 — Registered' }
        }
      } else {
        trustCache[senderId] = { level: 1, label: 'L1 — Registered' }
      }
    }

    // Build enriched messages without per-message DB calls
    const enriched = allMessages.map((msg: any) => {
      const sender = senderCache[msg.from_agent]
      const trust = trustCache[msg.from_agent] || { level: 1, label: 'L1 — Registered' }

      return {
        message_id: msg.id,
        from_agent: msg.from_agent,
        from_name: sender?.name || 'Unknown',
        from_owner: sender?.owner || 'Unknown',
        from_verified: sender?.verified || false,
        from_trust_score: sender?.trust_score || 0,
        from_trust_level: trust.level,
        from_trust_label: trust.label,
        from_risk_score: 0, // Skip per-message anomaly check for performance
        message_type: msg.message_type,
        payload: msg.payload,
        status: msg.status,
        response: msg.response,
        created_at: msg.created_at,
        responded_at: msg.responded_at,
        receipt: null, // Receipts available via /agents/credibility-packet
        blockchain_receipt: null,
        sender_trust_level: trust.level,
        sender_risk_score: 0,
      }
    })

    return NextResponse.json({
      agent_id: agentId,
      messages: enriched,
      count: enriched.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
