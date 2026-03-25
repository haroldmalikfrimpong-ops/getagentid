import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage, getUsageCount, trackIpUsage, getIpUsageCount } from '@/lib/usage'
import { calculateTrustLevel, PERMISSIONS, getSpendingLimit, TRUST_LEVEL_LABELS, type AgentTrustData } from '@/lib/trust-levels'

const IP_RATE_LIMIT = 100 // max 100 verifications per hour for unauthenticated requests

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    // Check for optional API key authentication
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let verificationLimit = 0

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Authenticated request — enforce plan limits
      const auth = await authenticateRequest(req)

      if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }

      userId = auth.user_id
      verificationLimit = auth.profile?.verification_limit ?? 1000

      // Check monthly usage against plan limit
      const currentUsage = await getUsageCount(userId!)
      if (currentUsage >= verificationLimit) {
        return NextResponse.json(
          {
            error: 'Monthly verification limit reached',
            usage: currentUsage,
            limit: verificationLimit,
            plan: auth.profile?.plan ?? 'free',
            message: `You have used ${currentUsage}/${verificationLimit} verifications this month. Upgrade your plan at https://getagentid.dev/pricing for higher limits.`,
          },
          { status: 429 }
        )
      }
    } else {
      // Unauthenticated request — enforce IP-based rate limiting
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                 req.headers.get('x-real-ip') ||
                 'unknown'

      const ipUsage = await getIpUsageCount(ip)
      if (ipUsage >= IP_RATE_LIMIT) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Too many requests from this IP. Max ${IP_RATE_LIMIT} verifications per hour. Use an API key for higher limits.`,
          },
          { status: 429 }
        )
      }

      // Track anonymous IP usage
      await trackIpUsage(ip)
    }

    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, description, owner, capabilities, platform, trust_score, verified, active, created_at, last_active, certificate, user_id')
      .eq('agent_id', agent_id)
      .single()

    if (error || !agent) {
      return NextResponse.json({
        verified: false,
        agent_id,
        message: 'Agent not found',
      })
    }

    // Verify certificate is valid
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

    // Count successful verifications for this agent
    const { count: verificationCount } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('event_type', 'verified')

    // Get owner profile to check email verification status and entity verification
    const { data: ownerProfile } = await db
      .from('profiles')
      .select('email_verified, entity_verified')
      .eq('id', agent.user_id)
      .single()

    // Calculate trust level
    const agentTrustData: AgentTrustData = {
      trust_score: agent.trust_score ?? 0,
      verified: agent.verified ?? false,
      certificate_valid,
      entity_verified: ownerProfile?.entity_verified === true,
      owner_email_verified: ownerProfile?.email_verified === true,
      created_at: agent.created_at,
      successful_verifications: verificationCount ?? 0,
    }

    const trust_level = calculateTrustLevel(agentTrustData)
    const permissions = PERMISSIONS[trust_level]
    const spending_limit = getSpendingLimit(trust_level)
    const trust_level_label = TRUST_LEVEL_LABELS[trust_level]

    // Update last_active
    await db.from('agents').update({ last_active: new Date().toISOString() }).eq('agent_id', agent_id)

    // Log verification event
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'verified',
      data: { verified_by: 'api' },
    })

    // Track usage for authenticated requests
    if (userId) {
      await trackUsage(userId, 'verify')
    }

    return NextResponse.json({
      verified: certificate_valid && agent.active,
      agent_id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      owner: agent.owner,
      capabilities: agent.capabilities,
      platform: agent.platform,
      trust_score: agent.trust_score,
      trust_level,
      trust_level_label,
      permissions,
      spending_limit,
      certificate_valid,
      active: agent.active,
      created_at: agent.created_at,
      last_active: agent.last_active,
      message: certificate_valid && agent.active ? 'Agent verified' : 'Agent not verified',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
