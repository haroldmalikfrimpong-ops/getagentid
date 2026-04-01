import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, generateAgentId, issueCertificate, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'
import { notifyAgentRegistered } from '@/lib/notify'
import { sendWebhook } from '@/lib/webhooks'
import { TrustLevel, PERMISSIONS, getSpendingLimit, TRUST_LEVEL_LABELS, levelUpRequirements } from '@/lib/trust-levels'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Parse body
    const body = await req.json()
    const { name, description, capabilities, platform, endpoint, model_version, prompt_hash, social_links, limitations,
            agent_type, heartbeat_interval, autonomy_level, expected_active_hours } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // Validate agent_type if provided
    const validAgentTypes = ['interactive', 'daemon', 'heartbeat'] as const
    const resolvedAgentType = agent_type && validAgentTypes.includes(agent_type) ? agent_type : 'interactive'

    // Validate daemon-specific fields
    const validAutonomyLevels = ['supervised', 'semi-autonomous', 'fully-autonomous'] as const
    const resolvedAutonomyLevel = autonomy_level && validAutonomyLevels.includes(autonomy_level) ? autonomy_level : null

    // Check agent limit
    const db = getServiceClient()
    const { count } = await db
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user_id)

    const limit = auth.profile?.agent_limit || 100
    if ((count || 0) >= limit) {
      return NextResponse.json({
        error: `Agent limit reached (${count}/${limit}). Upgrade your plan.`,
      }, { status: 403 })
    }

    // Generate agent identity
    const agentId = generateAgentId()
    const owner = auth.profile?.company || auth.profile?.email || 'Unknown'
    const cert = issueCertificate(agentId, name, owner, capabilities || [])

    // Generate keypair (ECDSA)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })

    // Store in database — new agents start at L1 (Registered)
    // L1 can connect, message, verify, and discover immediately.
    const initialTrustLevel = TrustLevel.L1_REGISTERED
    const { error: dbError } = await db.from('agents').insert({
      agent_id: agentId,
      name,
      description: description || '',
      owner,
      capabilities: capabilities || [],
      platform: platform || null,
      endpoint: endpoint || null,
      public_key: publicKey,
      certificate: cert.certificate,
      trust_score: 0,
      trust_level: initialTrustLevel,
      verified: false,
      active: true,
      user_id: auth.user_id,
      ...(model_version && { model_version }),
      ...(prompt_hash && { prompt_hash }),
      ...(social_links && { social_links }),
      ...(limitations && { limitations }),
      ...(resolvedAgentType !== 'interactive' && { agent_type: resolvedAgentType }),
      ...(heartbeat_interval && typeof heartbeat_interval === 'number' && { heartbeat_interval }),
      ...(resolvedAutonomyLevel && { autonomy_level: resolvedAutonomyLevel }),
      ...(expected_active_hours && Array.isArray(expected_active_hours) && { expected_active_hours }),
    })

    if (dbError) {
      return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 })
    }

    // Log event
    await db.from('agent_events').insert({
      agent_id: agentId,
      event_type: 'registered',
      data: { name, owner, capabilities, agent_type: resolvedAgentType },
    })

    // Track usage + notify
    await trackUsage(auth.user_id, 'register')
    await notifyAgentRegistered(name, owner, agentId)

    // Fire webhook
    sendWebhook(auth.user_id, 'agent.registered', {
      agent_id: agentId,
      name,
      owner,
      capabilities: capabilities || [],
      platform: platform || null,
      trust_level: initialTrustLevel,
      trust_level_label: TRUST_LEVEL_LABELS[initialTrustLevel],
    })

    // Level-up info so the user always knows what to do next
    const nextSteps = levelUpRequirements(initialTrustLevel)

    // Build DID
    const did = `did:web:getagentid.dev:agent:${agentId}`

    return NextResponse.json({
      agent_id: agentId,
      name,
      owner,
      did,
      certificate: cert.certificate,
      public_key: publicKey,
      private_key: privateKey,
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
      trust_level: initialTrustLevel,
      trust_level_label: TRUST_LEVEL_LABELS[initialTrustLevel],
      permissions: PERMISSIONS[initialTrustLevel],
      spending_limit: getSpendingLimit(initialTrustLevel),
      solana_wallet: null,
      agent_type: resolvedAgentType,
      ...(resolvedAgentType === 'daemon' && {
        daemon: {
          heartbeat_interval: heartbeat_interval || null,
          autonomy_level: resolvedAutonomyLevel || 'supervised',
          expected_active_hours: expected_active_hours || [0, 23],
          note: 'Daemon agents run autonomously. All actions produce receipts for audit. Session continuity is tracked via context_epoch.',
        },
      }),
      ...(resolvedAgentType === 'heartbeat' && {
        heartbeat: {
          heartbeat_interval: heartbeat_interval || null,
          note: 'Heartbeat agents wake on schedule, pull inbox, act, sleep. Use POST /agents/inbox to pull pending messages.',
        },
      }),
      message: resolvedAgentType === 'daemon'
        ? 'Daemon agent registered at L1. It can connect, message, verify, and operate autonomously. All actions produce verifiable receipts.'
        : 'Your agent is at L1 (Registered). It can connect, message, and verify immediately.',
      next_step: {
        action: 'Bind an Ed25519 key to reach L2 (Verified)',
        endpoint: 'POST /api/v1/agents/bind-ed25519',
        body: '{ agent_id, ed25519_public_key }',
      },
      level_up: nextSteps,
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
