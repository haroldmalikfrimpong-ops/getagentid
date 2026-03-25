import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { getSpendingHistory, getAgentBalance } from '@/lib/agent-spending'

export async function GET(req: NextRequest) {
  try {
    // Authenticate via API key
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agent_id')
    const daysParam = searchParams.get('days')

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    const days = daysParam ? parseInt(daysParam, 10) : 30
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 })
    }

    // Verify the caller owns this agent
    const db = getServiceClient()
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('agent_id, user_id')
      .eq('agent_id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Fetch balance and history in parallel
    const [balance, transactions] = await Promise.all([
      getAgentBalance(agentId),
      getSpendingHistory(agentId, days),
    ])

    return NextResponse.json({
      agent_id: agentId,
      days,
      balance: balance ? {
        trust_level: balance.trust_level,
        daily_limit: balance.daily_limit,
        spent_today: balance.spent_today,
        remaining_daily_limit: balance.remaining_daily_limit,
        transaction_count_today: balance.transaction_count_today,
      } : null,
      transactions: transactions.map(txn => ({
        transaction_id: txn.id,
        amount: txn.amount,
        currency: txn.currency,
        description: txn.description,
        recipient: txn.recipient,
        trust_level: txn.trust_level,
        created_at: txn.created_at,
        receipt: txn.receipt,
      })),
      total_transactions: transactions.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
