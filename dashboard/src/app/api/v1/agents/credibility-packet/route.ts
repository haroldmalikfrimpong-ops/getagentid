import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { calculateTrustLevel, PERMISSIONS, getSpendingLimit, TRUST_LEVEL_LABELS, type AgentTrustData } from '@/lib/trust-levels'
import { quickAnomalyCheck, calculateRiskScore } from '@/lib/behaviour'
import { computeMerkleRoot } from '@/lib/merkle'
import crypto from 'crypto'

/**
 * GET /api/v1/agents/credibility-packet?agent_id=...
 *
 * Returns a signed, portable credibility bundle (trust resume) for an agent.
 * Public endpoint — any system can request this to evaluate an agent without
 * being part of our platform.
 *
 * The HMAC signature covers the entire packet, allowing offline verification
 * if the verifier has the platform's public verification key.
 */

function hmacSign(data: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required for packet signing')
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Fetch agent
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, owner, description, capabilities, platform, trust_score, verified, active, created_at, last_active, certificate, user_id, ed25519_key, wallet_address, wallet_chain, solana_address, model_version, prompt_hash, limitations')
      .eq('agent_id', agent_id)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Certificate validity
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

    // Verification count
    const { count: verificationCount } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('event_type', 'verified')

    // Owner profile
    const { data: ownerProfile } = await db
      .from('profiles')
      .select('email_verified, entity_verified')
      .eq('id', agent.user_id)
      .single()

    // Trust level
    const agentTrustData: AgentTrustData = {
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

    const trust_level = calculateTrustLevel(agentTrustData)
    const permissions = PERMISSIONS[trust_level]
    const spending_limit = getSpendingLimit(trust_level)

    // Negative and resolved signals
    const { count: negativeSignals } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .in('event_type', ['verification_failed', 'anomaly_detected', 'connection_revoked'])

    const { count: resolvedSignals } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('event_type', 'incident_resolved')

    // Last 10 receipts
    const { data: receipts } = await db
      .from('action_receipts')
      .select('receipt_id, action, timestamp, data_hash, signature, tx_hash, explorer_url')
      .eq('agent_id', agent_id)
      .order('timestamp', { ascending: false })
      .limit(10)

    // Cryptographic scarring: lifetime negative events
    const scarring_score = (negativeSignals ?? 0)

    // Behavioural risk score
    let behaviour_risk_score = 0
    try {
      const anomalies = await quickAnomalyCheck(agent_id)
      behaviour_risk_score = calculateRiskScore(anomalies)
    } catch {
      // Non-blocking
    }

    // Merkle root over all receipts
    let merkle_root = null
    try {
      const merkle = await computeMerkleRoot(agent_id)
      merkle_root = {
        root: merkle.root,
        leaf_count: merkle.leaf_count,
        computed_at: merkle.computed_at,
      }
    } catch {
      // Non-blocking
    }

    // Active delegation count
    const { count: activeDelegationCount } = await db
      .from('agent_messages')
      .select('*', { count: 'exact', head: true })
      .eq('message_type', 'delegation')
      .eq('status', 'active')
      .or(`from_agent.eq.${agent_id},to_agent.eq.${agent_id}`)

    // DID
    const did = `did:web:getagentid.dev:agent:${agent_id}`

    // Build packet payload (everything except the signature)
    const generated_at = new Date().toISOString()
    const packetPayload = {
      protocol: 'agentid',
      version: 1,
      type: 'credibility-packet',
      identity: {
        agent_id: agent.agent_id,
        did,
        name: agent.name,
        owner: agent.owner,
        description: agent.description,
        platform: agent.platform,
        limitations: agent.limitations || [],
      },
      trust: {
        trust_level,
        trust_level_label: TRUST_LEVEL_LABELS[trust_level],
        trust_score: agent.trust_score,
        permissions,
        spending_limit,
        certificate_valid,
      },
      authorization: {
        trust_level,
        trust_level_label: TRUST_LEVEL_LABELS[trust_level],
        permissions,
        effective_spending_limit: spending_limit,
        active_delegation_count: activeDelegationCount ?? 0,
        scarring_score,
      },
      verification_count: verificationCount ?? 0,
      negative_signals: negativeSignals ?? 0,
      resolved_signals: resolvedSignals ?? 0,
      scarring_score,
      receipts: receipts || [],
      merkle_root,
      behaviour_risk_score,
      generated_at,
    }

    // Sign the entire packet
    const packetJson = JSON.stringify(packetPayload)
    const signature = hmacSign(packetJson)

    return NextResponse.json({
      ...packetPayload,
      signature,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
