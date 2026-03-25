import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { checkSpendingAuthority, recordSpend } from '@/lib/agent-spending'
import { trackUsage } from '@/lib/usage'

export async function POST(req: NextRequest) {
  try {
    // Authenticate via API key
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Parse body
    const body = await req.json()
    const { agent_id, amount, currency, description, recipient } = body

    // Validate required fields
    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }
    if (amount == null || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    if (!currency || typeof currency !== 'string') {
      return NextResponse.json({ error: 'currency is required (e.g. "usd")' }, { status: 400 })
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (!recipient || typeof recipient !== 'string') {
      return NextResponse.json({ error: 'recipient is required' }, { status: 400 })
    }

    // Verify the caller owns this agent
    const db = getServiceClient()
    const { data: agent, error: agentError } = await db
      .from('agents')
      .select('agent_id, user_id')
      .eq('agent_id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Check spending authority (trust level + daily limit)
    const authority = await checkSpendingAuthority(agent_id, amount, currency)
    if (!authority.authorized) {
      return NextResponse.json({
        authorized: false,
        reason: authority.reason,
        trust_level: authority.trust_level,
        daily_limit: authority.daily_limit,
        spent_today: authority.spent_today,
        remaining_daily_limit: authority.remaining_daily_limit,
      }, { status: 403 })
    }

    // Record the spend transaction
    const result = await recordSpend(agent_id, amount, currency, description, recipient)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Track usage
    await trackUsage(auth.user_id, 'spend')

    return NextResponse.json({
      authorized: true,
      transaction_id: result.transaction.id,
      agent_id: result.transaction.agent_id,
      amount: result.transaction.amount,
      currency: result.transaction.currency,
      description: result.transaction.description,
      recipient: result.transaction.recipient,
      trust_level: result.transaction.trust_level,
      remaining_daily_limit: result.remaining_daily_limit,
      receipt: result.transaction.receipt,
      created_at: result.transaction.created_at,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
