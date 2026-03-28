import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'
import crypto from 'crypto'

/**
 * POST /api/v1/agents/delegate
 *
 * Create a signed delegation from one agent to another.
 * The delegator's owner must authenticate via API key.
 *
 * Body: {
 *   from_agent: string,   // delegator agent_id
 *   to_agent: string,     // delegatee agent_id
 *   scope: string[],      // allowed actions e.g. ["send_message", "make_payment"]
 *   expires_at: string,   // ISO timestamp
 *   max_spend?: number    // optional spending limit for delegatee
 * }
 *
 * The delegation proof is a signed JWT containing the scope, expiry, and both agent IDs.
 * Stored in agent_messages with message_type "delegation".
 */

function getSigningSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required for delegation signing')
  return secret
}

function signDelegationJwt(payload: object): string {
  const secret = getSigningSecret()
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'AgentID-Delegation' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { from_agent, to_agent, scope, expires_at, max_spend } = body

    if (!from_agent || !to_agent) {
      return NextResponse.json({ error: 'from_agent and to_agent are required' }, { status: 400 })
    }
    if (!scope || !Array.isArray(scope) || scope.length === 0) {
      return NextResponse.json({ error: 'scope must be a non-empty array of actions' }, { status: 400 })
    }
    if (!expires_at) {
      return NextResponse.json({ error: 'expires_at is required' }, { status: 400 })
    }

    // Validate expiry is in the future
    const expiresDate = new Date(expires_at)
    if (isNaN(expiresDate.getTime()) || expiresDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'expires_at must be a valid future ISO timestamp' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify caller owns the from_agent (delegator)
    const { data: fromAgent, error: fromError } = await db
      .from('agents')
      .select('agent_id, name, owner, user_id')
      .eq('agent_id', from_agent)
      .single()

    if (fromError || !fromAgent) {
      return NextResponse.json({ error: 'Delegator agent not found' }, { status: 404 })
    }
    if (fromAgent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own the delegator agent' }, { status: 403 })
    }

    // Verify to_agent exists and is active
    const { data: toAgent, error: toError } = await db
      .from('agents')
      .select('agent_id, name, owner, active')
      .eq('agent_id', to_agent)
      .eq('active', true)
      .single()

    if (toError || !toAgent) {
      return NextResponse.json({ error: 'Delegatee agent not found or inactive' }, { status: 404 })
    }

    // Cannot delegate to self
    if (from_agent === to_agent) {
      return NextResponse.json({ error: 'Cannot delegate to the same agent' }, { status: 400 })
    }

    // Build the delegation proof JWT
    const now = Math.floor(Date.now() / 1000)
    const delegationPayload = {
      iss: 'https://getagentid.dev',
      type: 'delegation',
      from_agent,
      to_agent,
      scope,
      max_spend: max_spend || null,
      iat: now,
      exp: Math.floor(expiresDate.getTime() / 1000),
    }

    const delegation_proof = signDelegationJwt(delegationPayload)

    // Store delegation as a message with type "delegation"
    const { data: msg, error: msgError } = await db
      .from('agent_messages')
      .insert({
        from_agent,
        to_agent,
        message_type: 'delegation',
        payload: {
          scope,
          max_spend: max_spend || null,
          expires_at,
          delegation_proof,
        },
        status: 'active',
        verified_sender: true,
        verified_receiver: true,
      })
      .select()
      .single()

    if (msgError) {
      return NextResponse.json({ error: 'Failed to create delegation' }, { status: 500 })
    }

    // Log event
    await db.from('agent_events').insert({
      agent_id: from_agent,
      event_type: 'delegation_created',
      data: {
        to_agent,
        scope,
        max_spend: max_spend || null,
        expires_at,
        delegation_id: msg.id,
      },
    })

    await trackUsage(auth.user_id, 'delegate')

    return NextResponse.json({
      delegation_id: msg.id,
      from_agent,
      from_name: fromAgent.name,
      to_agent,
      to_name: toAgent.name,
      scope,
      max_spend: max_spend || null,
      expires_at,
      delegation_proof,
      created_at: new Date().toISOString(),
      message: 'Delegation created successfully',
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
