import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'

/**
 * POST /api/v1/agents/credentials
 * Attach a verifiable credential to an agent profile.
 * Requires API key auth (owner must own the agent).
 *
 * Body: { agent_id, credential: { type, issuer, issued_at, expires_at, signature } }
 *
 * GET /api/v1/agents/credentials?agent_id=...
 * List credentials for an agent. Public endpoint.
 */

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { agent_id, credential } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }
    if (!credential || !credential.type || !credential.issuer) {
      return NextResponse.json({ error: 'credential with type and issuer is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify caller owns this agent
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('agent_id, user_id, credentials')
      .eq('agent_id', agent_id)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Build the credential object
    const newCredential = {
      type: credential.type,
      issuer: credential.issuer,
      issued_at: credential.issued_at || new Date().toISOString(),
      expires_at: credential.expires_at || null,
      signature: credential.signature || null,
    }

    // Append to existing credentials array
    const existingCredentials = Array.isArray(agent.credentials) ? agent.credentials : []
    const updatedCredentials = [...existingCredentials, newCredential]

    const { error: updateError } = await db
      .from('agents')
      .update({ credentials: updatedCredentials })
      .eq('agent_id', agent_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to attach credential' }, { status: 500 })
    }

    // Log event
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'credential_attached',
      data: { type: newCredential.type, issuer: newCredential.issuer },
    })

    await trackUsage(auth.user_id, 'attach_credential')

    return NextResponse.json({
      agent_id,
      credential: newCredential,
      total_credentials: updatedCredentials.length,
      message: 'Credential attached successfully',
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, credentials')
      .eq('agent_id', agent_id)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const credentials = Array.isArray(agent.credentials) ? agent.credentials : []

    // Filter out expired credentials
    const now = new Date().toISOString()
    const activeCredentials = credentials.filter((c: any) =>
      !c.expires_at || c.expires_at > now
    )

    return NextResponse.json({
      agent_id: agent.agent_id,
      name: agent.name,
      credentials: activeCredentials,
      total: activeCredentials.length,
      expired: credentials.length - activeCredentials.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
