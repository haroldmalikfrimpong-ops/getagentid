import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agent_id')
    const status = searchParams.get('status') || 'pending'

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify the user owns this agent
    const { data: agent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', auth.user_id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Get messages for this agent
    let query = db
      .from('agent_messages')
      .select('*')
      .eq('to_agent', agentId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: messages } = await query

    // Enrich with sender info
    const enriched = []
    for (const msg of (messages || [])) {
      const { data: sender } = await db
        .from('agents')
        .select('name, owner, verified, trust_score')
        .eq('agent_id', msg.from_agent)
        .single()

      enriched.push({
        message_id: msg.id,
        from_agent: msg.from_agent,
        from_name: sender?.name || 'Unknown',
        from_owner: sender?.owner || 'Unknown',
        from_verified: sender?.verified || false,
        from_trust_score: sender?.trust_score || 0,
        message_type: msg.message_type,
        payload: msg.payload,
        status: msg.status,
        response: msg.response,
        created_at: msg.created_at,
        responded_at: msg.responded_at,
      })
    }

    return NextResponse.json({
      agent_id: agentId,
      messages: enriched,
      count: enriched.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
