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
    const { name, description, capabilities, platform, endpoint } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

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
    })

    if (dbError) {
      return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 })
    }

    // Log event
    await db.from('agent_events').insert({
      agent_id: agentId,
      event_type: 'registered',
      data: { name, owner, capabilities },
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

    return NextResponse.json({
      agent_id: agentId,
      name,
      owner,
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
      message: 'Your agent is at L1 (Registered). It can connect, message, and verify immediately.',
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
