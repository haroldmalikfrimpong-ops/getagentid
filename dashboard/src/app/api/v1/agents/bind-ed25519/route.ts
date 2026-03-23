import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'
import crypto from 'crypto'

/**
 * POST /api/v1/agents/bind-ed25519
 *
 * Bind an Ed25519 public key to an existing agent and receive a signed
 * certificate that attests the binding.
 *
 * Body: { agent_id: string, ed25519_public_key: string (64-char hex) }
 * Auth: Bearer API key (required)
 */
export async function POST(req: NextRequest) {
  try {
    // ── Authenticate ─────────────────────────────────────────────
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // ── Parse & validate body ────────────────────────────────────
    const body = await req.json()
    const { agent_id, ed25519_public_key } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }
    if (!ed25519_public_key) {
      return NextResponse.json({ error: 'ed25519_public_key is required' }, { status: 400 })
    }

    // Validate hex format (32 bytes = 64 hex chars)
    if (!/^[0-9a-f]{64}$/i.test(ed25519_public_key)) {
      return NextResponse.json({
        error: 'ed25519_public_key must be a 64-character hex string (32 bytes)',
      }, { status: 400 })
    }

    // ── Verify the caller owns this agent ────────────────────────
    const db = getServiceClient()
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('agent_id, name, owner, capabilities, trust_score, user_id, ed25519_key')
      .eq('agent_id', agent_id)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // ── Store the Ed25519 public key ─────────────────────────────
    const normalizedKey = ed25519_public_key.toLowerCase()

    const { error: updateError } = await db
      .from('agents')
      .update({ ed25519_key: normalizedKey })
      .eq('agent_id', agent_id)

    if (updateError) {
      console.error('Failed to store ed25519_key:', updateError)
      return NextResponse.json({ error: 'Failed to bind Ed25519 key' }, { status: 500 })
    }

    // ── Issue a signed Ed25519 binding certificate ───────────────
    const cert = issueEd25519Certificate({
      agent_id,
      ed25519_public_key: normalizedKey,
      owner: agent.owner,
      capabilities: agent.capabilities || [],
      trust_score: agent.trust_score ?? 0,
    })

    // Store the certificate alongside the key
    await db
      .from('agents')
      .update({ ed25519_certificate: cert.certificate })
      .eq('agent_id', agent_id)

    // ── Log event ────────────────────────────────────────────────
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'ed25519_bound',
      data: {
        ed25519_public_key: normalizedKey,
        issued_at: cert.issued_at,
        expires_at: cert.expires_at,
      },
    })

    // ── Track usage ──────────────────────────────────────────────
    await trackUsage(auth.user_id, 'bind_ed25519')

    return NextResponse.json({
      agent_id,
      ed25519_public_key: normalizedKey,
      certificate: cert.certificate,
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

// ── Certificate helpers ──────────────────────────────────────────

interface Ed25519CertPayload {
  agent_id: string
  ed25519_public_key: string
  owner: string
  capabilities: string[]
  trust_score: number
}

function getSigningSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Cannot sign certificates.'
    )
  }
  return secret
}

function issueEd25519Certificate(payload: Ed25519CertPayload) {
  const secret = getSigningSecret()

  const now = Math.floor(Date.now() / 1000)
  const expires = now + 365 * 24 * 60 * 60 // 1 year

  const certPayload = {
    iss: 'https://getagentid.dev',
    sub: payload.agent_id,
    type: 'ed25519-binding',
    ed25519_public_key: payload.ed25519_public_key,
    owner: payload.owner,
    capabilities: payload.capabilities,
    trust_score: payload.trust_score,
    iat: now,
    exp: expires,
  }

  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'AgentID-Ed25519' })
  ).toString('base64url')

  const body = Buffer.from(JSON.stringify(certPayload)).toString('base64url')

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')

  return {
    certificate: `${header}.${body}.${signature}`,
    issued_at: new Date(now * 1000).toISOString(),
    expires_at: new Date(expires * 1000).toISOString(),
  }
}
