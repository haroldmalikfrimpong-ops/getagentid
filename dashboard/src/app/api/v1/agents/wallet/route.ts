import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

/**
 * GET /api/v1/agents/wallet?agent_id=xxx
 *
 * Retrieve the bound wallet address and chain for an agent.
 * Public endpoint — no API key required (same as verify).
 */
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agent_id')

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, wallet_address, wallet_chain, wallet_bound_at')
      .eq('agent_id', agentId)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.wallet_address) {
      return NextResponse.json({
        agent_id: agent.agent_id,
        wallet_bound: false,
        message: 'No wallet bound to this agent',
      })
    }

    return NextResponse.json({
      agent_id: agent.agent_id,
      wallet_bound: true,
      wallet_address: agent.wallet_address,
      chain: agent.wallet_chain,
      bound_at: agent.wallet_bound_at,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
