import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, description, owner, capabilities, platform, trust_score, verified, active, created_at, last_active, certificate')
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

    // Update last_active
    await db.from('agents').update({ last_active: new Date().toISOString() }).eq('agent_id', agent_id)

    // Log verification event
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'verified',
      data: { verified_by: 'api' },
    })

    return NextResponse.json({
      verified: certificate_valid && agent.active,
      agent_id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      owner: agent.owner,
      capabilities: agent.capabilities,
      platform: agent.platform,
      trust_score: agent.trust_score,
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
