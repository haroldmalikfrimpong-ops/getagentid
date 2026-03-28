import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage, getUsageCount, trackIpUsage, getIpUsageCount } from '@/lib/usage'
import { calculateTrustLevel, PERMISSIONS, getSpendingLimit, TRUST_LEVEL_LABELS, levelUpRequirements, type AgentTrustData } from '@/lib/trust-levels'
import { sendWebhook } from '@/lib/webhooks'
import { quickAnomalyCheck, calculateRiskScore, type AnomalyAlert } from '@/lib/behaviour'
import { createDualReceipt } from '@/lib/receipts'

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
      .select('agent_id, name, description, owner, capabilities, platform, trust_score, verified, active, created_at, last_active, certificate, user_id, wallet_address, wallet_chain, wallet_bound_at, solana_address, ed25519_key, model_version, prompt_hash, social_links')
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

    // Calculate trust level based on security capabilities, not time/score
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
    const trust_level_label = TRUST_LEVEL_LABELS[trust_level]
    const level_up = levelUpRequirements(trust_level, agentTrustData)

    // Update last_active
    await db.from('agents').update({ last_active: new Date().toISOString() }).eq('agent_id', agent_id)

    // Log verification event — including negative signal if cert invalid or agent inactive
    if (!certificate_valid || !agent.active) {
      await db.from('agent_events').insert({
        agent_id,
        event_type: 'verification_failed',
        data: {
          reason: !certificate_valid ? 'certificate_invalid' : 'agent_inactive',
          certificate_valid,
          active: agent.active,
          verified_by: userId || 'anonymous',
        },
      })
    }
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'verified',
      data: { verified_by: 'api' },
    })

    // Track usage for authenticated requests
    if (userId) {
      await trackUsage(userId, 'verify')
    }

    // Fire webhook to the agent owner
    if (agent.user_id) {
      sendWebhook(agent.user_id, 'agent.verified', {
        agent_id: agent.agent_id,
        name: agent.name,
        owner: agent.owner,
        trust_level,
        trust_level_label,
        certificate_valid,
        active: agent.active,
        verified_by: userId || 'anonymous',
      })
    }

    // Run behavioural anomaly check (non-blocking — errors are swallowed)
    let behaviour_warnings: AnomalyAlert[] = []
    let behaviour_risk_score = 0
    try {
      behaviour_warnings = await quickAnomalyCheck(agent_id)
      behaviour_risk_score = calculateRiskScore(behaviour_warnings)

      // Log anomaly_detected event and fire webhook for high-severity anomalies
      if (behaviour_warnings.length > 0) {
        await db.from('agent_events').insert({
          agent_id,
          event_type: 'anomaly_detected',
          data: {
            risk_score: behaviour_risk_score,
            anomaly_count: behaviour_warnings.length,
            types: behaviour_warnings.map((a) => a.type),
            severities: behaviour_warnings.map((a) => a.severity),
          },
        })
      }
      if (agent.user_id && behaviour_warnings.some((a) => a.severity === 'high')) {
        sendWebhook(agent.user_id, 'agent.behaviour_anomaly', {
          agent_id: agent.agent_id,
          name: agent.name,
          risk_score: behaviour_risk_score,
          anomalies: behaviour_warnings.filter((a) => a.severity === 'high'),
        })
      }
    } catch {
      // Never block verification on behaviour check failure
    }

    // Build wallet info if bound
    const wallet = agent.wallet_address
      ? {
          wallet_address: agent.wallet_address,
          chain: agent.wallet_chain,
          bound_at: agent.wallet_bound_at,
        }
      : null

    // Build Solana wallet info (auto-derived from Ed25519 key)
    const cluster = process.env.SOLANA_CLUSTER || 'devnet'
    const solana_wallet = agent.solana_address
      ? {
          solana_address: agent.solana_address,
          cluster,
          explorer_url: `https://explorer.solana.com/address/${agent.solana_address}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`,
        }
      : null

    // Create dual receipt for this verification
    const receipt = await createDualReceipt('verification', agent.agent_id, {
      verified: certificate_valid && agent.active,
      trust_level,
      trust_level_label,
      certificate_valid,
      verified_by: userId || 'anonymous',
    }, { trust_level, permissions })

    // Build DID and supported key types
    const did = `did:web:getagentid.dev:agent:${agent.agent_id}`
    const supported_key_types: string[] = ['ecdsa-p256']
    if (agent.ed25519_key) supported_key_types.push('ed25519')
    if (agent.wallet_address && agent.wallet_chain) {
      const chainKeyTypes: Record<string, string> = {
        ethereum: 'secp256k1',
        polygon: 'secp256k1',
        solana: 'ed25519',
      }
      const walletKeyType = chainKeyTypes[agent.wallet_chain]
      if (walletKeyType && !supported_key_types.includes(walletKeyType)) {
        supported_key_types.push(walletKeyType)
      }
    }

    // Count negative signals (failed verifications, anomalies, revoked connections)
    const { count: negativeSignals } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .in('event_type', ['verification_failed', 'anomaly_detected', 'connection_revoked'])

    // Count resolved signals (recovered from incidents)
    const { count: resolvedSignals } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('event_type', 'incident_resolved')

    // Cryptographic scarring: count ALL lifetime negative events (demotions)
    // This is the total historical count, not windowed — scars never fully heal
    const scarring_score = (negativeSignals ?? 0)
    const trust_note = scarring_score > 0
      ? `Agent has ${scarring_score} historical incidents — elevated scrutiny applied`
      : undefined

    // Get last 10 negative events with resolution status for incident history
    const { data: incidentEvents } = await db
      .from('agent_events')
      .select('id, event_type, data, created_at')
      .eq('agent_id', agent_id)
      .in('event_type', ['verification_failed', 'anomaly_detected', 'connection_revoked', 'incident_resolved'])
      .order('created_at', { ascending: false })
      .limit(10)

    const incident_history = (incidentEvents || []).map((e: any) => ({
      event_id: e.id,
      type: e.event_type,
      data: e.data,
      occurred_at: e.created_at,
      resolved: e.event_type === 'incident_resolved',
    }))

    return NextResponse.json({
      verified: certificate_valid && agent.active,
      agent_id: agent.agent_id,
      did,
      name: agent.name,
      description: agent.description,
      owner: agent.owner,
      capabilities: agent.capabilities,
      platform: agent.platform,
      // Trust score is INFORMATIONAL — included for reference but does NOT gate anything
      trust_score: agent.trust_score,
      trust_level,
      trust_level_label,
      permissions,
      spending_limit,
      certificate_valid,
      active: agent.active,
      created_at: agent.created_at,
      last_active: agent.last_active,
      supported_key_types,
      negative_signals: negativeSignals ?? 0,
      resolved_signals: resolvedSignals ?? 0,
      scarring_score,
      ...(trust_note && { trust_note }),
      incident_history,
      social_links: agent.social_links || null,
      social_verified: {
        github_linked: !!(agent.social_links as any)?.github,
        x_linked: !!(agent.social_links as any)?.x,
        website_linked: !!(agent.social_links as any)?.website,
      },
      wallet,
      solana_wallet,
      receipt,
      // Always show what to do next
      level_up,
      ...(behaviour_warnings.length > 0 && {
        behaviour: {
          risk_score: behaviour_risk_score,
          warnings: behaviour_warnings,
        },
      }),
      message: certificate_valid && agent.active ? 'Agent verified' : 'Agent not verified',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
