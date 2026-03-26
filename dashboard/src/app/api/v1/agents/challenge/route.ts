import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'
import crypto from 'crypto'

/**
 * POST /api/v1/agents/challenge
 *
 * Generate a random 32-byte challenge for an agent to sign with its Ed25519
 * private key.  The challenge is stored in Supabase with a 60-second TTL.
 *
 * Body: { agent_id: string }
 * Auth: Bearer API key (required)
 *
 * Returns: { challenge: string (hex), expires_at: string (ISO 8601) }
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
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    // ── Verify the agent exists and has an Ed25519 key bound ─────
    const db = getServiceClient()
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('agent_id, ed25519_key, user_id')
      .eq('agent_id', agent_id)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.ed25519_key) {
      return NextResponse.json({
        error: 'Agent does not have an Ed25519 key bound. Call /agents/bind-ed25519 first.',
      }, { status: 400 })
    }

    // ── Generate challenge ───────────────────────────────────────
    const challenge = crypto.randomBytes(32).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 1000) // 60 seconds TTL

    // ── Store challenge in Supabase ──────────────────────────────
    const { error: insertError } = await db
      .from('agent_challenges')
      .insert({
        agent_id,
        challenge,
        expires_at: expiresAt.toISOString(),
        used: false,
      })

    if (insertError) {
      console.error('Failed to store challenge:', insertError)
      return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
    }

    // ── Log event ────────────────────────────────────────────────
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'challenge_issued',
      data: { challenge_prefix: challenge.substring(0, 16) + '...' },
    })

    // ── Track usage ──────────────────────────────────────────────
    await trackUsage(auth.user_id, 'challenge')

    return NextResponse.json({
      challenge,
      expires_at: expiresAt.toISOString(),
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
