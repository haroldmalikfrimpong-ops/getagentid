import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { trackIpUsage, getIpUsageCount } from '@/lib/usage'
import {
  calculateTrustLevel,
  PERMISSIONS,
  getSpendingLimit,
  levelUpRequirements,
  TRUST_LEVEL_LABELS,
  type AgentTrustData,
} from '@/lib/trust-levels'

const IP_RATE_LIMIT = 200 // max 200 lookups per hour per IP

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    // IP-based rate limiting (this endpoint is public)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') ||
               'unknown'

    const ipUsage = await getIpUsageCount(ip)
    if (ipUsage >= IP_RATE_LIMIT) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests from this IP. Max ${IP_RATE_LIMIT} trust-level lookups per hour.`,
        },
        { status: 429 }
      )
    }
    await trackIpUsage(ip)

    const db = getServiceClient()

    // Fetch agent
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, owner, trust_score, verified, active, created_at, last_active, certificate, user_id, ed25519_key, wallet_address')
      .eq('agent_id', agent_id)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found', agent_id }, { status: 404 })
    }

    // Verify certificate validity
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
      .eq('agent_id', agent_id)
      .eq('event_type', 'verified')

    // Get owner profile for email/entity verification status
    const { data: ownerProfile } = await db
      .from('profiles')
      .select('email_verified, entity_verified')
      .eq('id', agent.user_id)
      .single()

    // Build trust data
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
    const level_up = levelUpRequirements(trust_level, agentTrustData)

    const now = Date.now()
    const createdAt = new Date(agent.created_at).getTime()
    const daysActive = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      agent_id: agent.agent_id,
      name: agent.name,
      trust_level,
      trust_level_label: TRUST_LEVEL_LABELS[trust_level],
      permissions,
      spending_limit,
      level_up_requirements: level_up,
      trust_score_breakdown: {
        trust_score: agent.trust_score ?? 0,
        verified: agent.verified ?? false,
        certificate_valid,
        entity_verified: ownerProfile?.entity_verified === true,
        owner_email_verified: ownerProfile?.email_verified === true,
        days_active: daysActive,
        successful_verifications: verificationCount ?? 0,
        active: agent.active,
      },
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
