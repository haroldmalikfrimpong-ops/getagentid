import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'

/**
 * GET /api/v1/agents/delegations?agent_id=...
 *
 * List active delegations for an agent (where the agent is either
 * the delegator or the delegatee).
 * Requires API key auth — only the agent owner can see delegations.
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(req.url)
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify caller owns this agent
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('agent_id, user_id, name')
      .eq('agent_id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Get delegations where this agent is the delegator (from_agent)
    const { data: delegationsFrom } = await db
      .from('agent_messages')
      .select('id, from_agent, to_agent, payload, created_at, status')
      .eq('from_agent', agent_id)
      .eq('message_type', 'delegation')
      .order('created_at', { ascending: false })

    // Get delegations where this agent is the delegatee (to_agent)
    const { data: delegationsTo } = await db
      .from('agent_messages')
      .select('id, from_agent, to_agent, payload, created_at, status')
      .eq('to_agent', agent_id)
      .eq('message_type', 'delegation')
      .order('created_at', { ascending: false })

    const now = new Date().toISOString()

    // Format delegations and mark expired ones
    const formatDelegation = (d: any, role: 'delegator' | 'delegatee') => {
      const payload = d.payload || {}
      const expired = payload.expires_at ? payload.expires_at < now : false
      return {
        delegation_id: d.id,
        role,
        from_agent: d.from_agent,
        to_agent: d.to_agent,
        scope: payload.scope || [],
        max_spend: payload.max_spend || null,
        expires_at: payload.expires_at || null,
        delegation_proof: payload.delegation_proof || null,
        created_at: d.created_at,
        status: expired ? 'expired' : d.status,
        active: !expired && d.status === 'active',
      }
    }

    const delegatedTo = (delegationsFrom || []).map((d: any) => formatDelegation(d, 'delegator'))
    const delegatedFrom = (delegationsTo || []).map((d: any) => formatDelegation(d, 'delegatee'))

    const allDelegations = [...delegatedTo, ...delegatedFrom]
    const activeDelegations = allDelegations.filter((d) => d.active)

    return NextResponse.json({
      agent_id,
      agent_name: agent.name,
      delegations: allDelegations,
      active_count: activeDelegations.length,
      total_count: allDelegations.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
