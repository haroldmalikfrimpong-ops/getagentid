import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { buildProfile, detectAnomalies, calculateRiskScore } from '@/lib/behaviour'
import { getServiceClient } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    // Require authentication — behaviour data is sensitive
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const agentId = req.nextUrl.searchParams.get('agent_id')
    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id query parameter is required' },
        { status: 400 }
      )
    }

    // Verify the agent belongs to this user
    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, user_id')
      .eq('agent_id', agentId)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json(
        { error: 'You do not own this agent' },
        { status: 403 }
      )
    }

    // Build profile and detect anomalies in parallel
    const [profile, anomalies] = await Promise.all([
      buildProfile(agentId),
      detectAnomalies(agentId),
    ])

    const risk_score = calculateRiskScore(anomalies)

    return NextResponse.json({
      profile,
      anomalies,
      risk_score,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Internal error' },
      { status: 500 }
    )
  }
}
