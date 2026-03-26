import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'
import crypto from 'crypto'

/**
 * POST /api/v1/agents/challenge/verify
 *
 * Verify an agent's Ed25519 signature over a previously-issued challenge.
 * This proves the agent holds the private key RIGHT NOW, not just that it
 * once had a certificate.
 *
 * Body: { agent_id: string, challenge: string (hex), signature: string (hex) }
 * Auth: Bearer API key (required)
 *
 * Returns: { verified: bool, challenge_passed: bool, ... }
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
    const { agent_id, challenge, signature } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }
    if (!challenge) {
      return NextResponse.json({ error: 'challenge is required' }, { status: 400 })
    }
    if (!signature) {
      return NextResponse.json({ error: 'signature is required' }, { status: 400 })
    }

    // Validate hex formats
    if (!/^[0-9a-f]{64}$/i.test(challenge)) {
      return NextResponse.json({
        error: 'challenge must be a 64-character hex string (32 bytes)',
      }, { status: 400 })
    }
    if (!/^[0-9a-f]{128}$/i.test(signature)) {
      return NextResponse.json({
        error: 'signature must be a 128-character hex string (64 bytes)',
      }, { status: 400 })
    }

    const db = getServiceClient()

    // ── Look up the challenge ────────────────────────────────────
    const { data: stored, error: lookupError } = await db
      .from('agent_challenges')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('challenge', challenge)
      .eq('used', false)
      .single()

    if (lookupError || !stored) {
      return NextResponse.json({
        verified: false,
        challenge_passed: false,
        message: 'Challenge not found or already used',
      })
    }

    // ── Check expiry ─────────────────────────────────────────────
    const now = new Date()
    const expiresAt = new Date(stored.expires_at)
    if (now > expiresAt) {
      // Mark as used so it can't be retried
      await db
        .from('agent_challenges')
        .update({ used: true })
        .eq('id', stored.id)

      return NextResponse.json({
        verified: false,
        challenge_passed: false,
        message: 'Challenge expired',
      })
    }

    // ── Get the agent's registered Ed25519 public key ────────────
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('agent_id, ed25519_key, active')
      .eq('agent_id', agent_id)
      .single()

    if (agentError || !agent || !agent.ed25519_key) {
      return NextResponse.json({
        verified: false,
        challenge_passed: false,
        message: 'Agent not found or no Ed25519 key bound',
      })
    }

    // ── Verify Ed25519 signature ─────────────────────────────────
    // Node.js crypto supports Ed25519 natively since v16
    let signatureValid = false
    try {
      const publicKeyBuffer = Buffer.from(agent.ed25519_key, 'hex')
      const signatureBuffer = Buffer.from(signature, 'hex')
      const challengeBuffer = Buffer.from(challenge, 'hex')

      // Import the raw 32-byte Ed25519 public key
      const keyObject = crypto.createPublicKey({
        key: Buffer.concat([
          // DER prefix for Ed25519 public key (RFC 8410)
          Buffer.from('302a300506032b6570032100', 'hex'),
          publicKeyBuffer,
        ]),
        format: 'der',
        type: 'spki',
      })

      signatureValid = crypto.verify(
        null, // Ed25519 does not use a separate hash algorithm
        challengeBuffer,
        keyObject,
        signatureBuffer,
      )
    } catch (e) {
      signatureValid = false
    }

    // ── Mark challenge as used (one-time use) ────────────────────
    await db
      .from('agent_challenges')
      .update({ used: true })
      .eq('id', stored.id)

    // ── Log event ────────────────────────────────────────────────
    await db.from('agent_events').insert({
      agent_id,
      event_type: signatureValid ? 'challenge_passed' : 'challenge_failed',
      data: {
        challenge_prefix: challenge.substring(0, 16) + '...',
        signature_valid: signatureValid,
      },
    })

    // ── Track usage ──────────────────────────────────────────────
    await trackUsage(auth.user_id, 'challenge_verify')

    return NextResponse.json({
      verified: signatureValid && agent.active,
      challenge_passed: signatureValid,
      agent_id,
      active: agent.active,
      message: signatureValid
        ? 'Agent proved possession of private key'
        : 'Signature verification failed',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
