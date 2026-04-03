import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { calculateTrustLevel, type AgentTrustData } from '@/lib/trust-levels'
import { quickAnomalyCheck, calculateRiskScore, detectContextContinuity } from '@/lib/behaviour'
import crypto from 'crypto'

/**
 * GET /api/v1/agents/trust-header?agent_id=...
 *
 * Returns a signed JWT for use as an Agent-Trust-Score HTTP header.
 * Public endpoint — any system can request this to get a portable,
 * short-lived trust token for an agent.
 *
 * The JWT is signed with HMAC-SHA256 using the platform's JWT_SECRET.
 * It is valid for 1 hour (per the Agent-Trust-Score spec v0.1).
 */

// Ed25519 signing for publicly verifiable trust headers
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
let _ed25519Key: crypto.KeyObject | null = null

function getEd25519Key(): crypto.KeyObject | null {
  if (_ed25519Key) return _ed25519Key
  const keyB64 = process.env.AGENTID_ED25519_PRIVATE_KEY
  if (!keyB64) return null
  try {
    const seed = Buffer.from(keyB64, 'base64url')
    if (seed.length !== 32) return null
    const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed])
    _ed25519Key = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
    return _ed25519Key
  } catch { return null }
}

function buildJwt(payload: Record<string, unknown>): string {
  const ed25519Key = getEd25519Key()

  if (ed25519Key) {
    // Ed25519 signed — publicly verifiable with platform public key
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'Agent-Trust-Score', kid: 'agentid-2026-03' })).toString('base64url')
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = crypto.sign(null, Buffer.from(`${header}.${body}`), ed25519Key).toString('base64url')
    return `${header}.${body}.${signature}`
  }

  // Fallback to HMAC if Ed25519 key not configured
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET or AGENTID_ED25519_PRIVATE_KEY is required for JWT signing')

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'Agent-Trust-Score' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')

  return `${header}.${body}.${signature}`
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
      .select('agent_id, name, owner, description, capabilities, platform, trust_score, verified, active, created_at, last_active, certificate, user_id, ed25519_key, wallet_address, wallet_chain, solana_address, model_version, prompt_hash')
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

    // Attestation count (verified events)
    const { count: attestationCount } = await db
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
      successful_verifications: attestationCount ?? 0,
      ed25519_key: agent.ed25519_key ?? null,
      wallet_address: agent.wallet_address ?? null,
    }

    const trust_level = calculateTrustLevel(agentTrustData)

    // Negative signals (unresolved negative events)
    const { count: negativeSignals } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .in('event_type', ['verification_failed', 'anomaly_detected', 'connection_revoked'])

    // Resolved signals
    const { count: resolvedSignals } = await db
      .from('agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('event_type', 'incident_resolved')

    // Cryptographic scarring: lifetime negative events (scars never heal)
    const scarring_score = negativeSignals ?? 0

    // Behavioural risk score
    let risk_score = 0
    try {
      const anomalies = await quickAnomalyCheck(agent_id)
      risk_score = calculateRiskScore(anomalies)
    } catch {
      // Non-blocking
    }

    // DID
    const did = `did:web:getagentid.dev:agent:${agent_id}`

    // Timestamps
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 3600 // 1 hour

    // Context continuity (non-blocking)
    let context_continuity_score = 100
    try {
      const continuity = await detectContextContinuity(agent_id)
      context_continuity_score = continuity.score
    } catch {}

    // Trust level labels
    const LABELS: Record<number, string> = {
      1: 'L1 — Registered',
      2: 'L2 — Verified',
      3: 'L3 — Secured',
      4: 'L4 — Certified',
    }

    // Build JWT payload — matches the multi-attestation spec entry
    const jwtPayload = {
      agent_id,
      trust_level,
      trust_level_label: LABELS[trust_level] || `L${trust_level}`,
      context_continuity_score,
      behavioral_risk_score: risk_score,
      scarring_score,
      negative_signals: negativeSignals ?? 0,
      resolved_signals: resolvedSignals ?? 0,
      attestation_count: attestationCount ?? 0,
      did,
      evaluatedAt: new Date().toISOString(),
      provider: 'agentid',
      iss: 'https://getagentid.dev',
      iat: now,
      exp,
    }

    // Sign as JWT
    const header = buildJwt(jwtPayload)

    return NextResponse.json({
      header,
      payload: jwtPayload,
      expires_in: 3600,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
