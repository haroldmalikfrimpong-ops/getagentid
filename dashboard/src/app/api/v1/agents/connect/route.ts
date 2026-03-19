import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'

export async function POST(req: NextRequest) {
  try {
    // Authenticate sender
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { from_agent, to_agent, message_type, payload } = body

    if (!from_agent || !to_agent) {
      return NextResponse.json({ error: 'from_agent and to_agent are required' }, { status: 400 })
    }
    if (!payload) {
      return NextResponse.json({ error: 'payload is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify sender owns the from_agent
    const { data: senderAgent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', from_agent)
      .eq('user_id', auth.user_id)
      .single()

    if (!senderAgent) {
      return NextResponse.json({ error: 'You do not own the sending agent' }, { status: 403 })
    }

    // Verify receiver exists and is active
    const { data: receiverAgent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', to_agent)
      .eq('active', true)
      .single()

    if (!receiverAgent) {
      return NextResponse.json({ error: 'Receiving agent not found or inactive' }, { status: 404 })
    }

    // Check both agents' verification status
    const senderVerified = senderAgent.verified && senderAgent.active
    const receiverVerified = receiverAgent.verified && receiverAgent.active

    // Create the message
    const { data: msg, error: msgError } = await db
      .from('agent_messages')
      .insert({
        from_agent,
        to_agent,
        message_type: message_type || 'request',
        payload,
        status: 'pending',
        verified_sender: senderVerified,
        verified_receiver: receiverVerified,
      })
      .select()
      .single()

    if (msgError) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Log events for both agents
    await db.from('agent_events').insert([
      { agent_id: from_agent, event_type: 'message_sent', data: { to: to_agent, message_id: msg.id, type: message_type } },
      { agent_id: to_agent, event_type: 'message_received', data: { from: from_agent, message_id: msg.id, type: message_type } },
    ])

    await trackUsage(auth.user_id, 'connect')

    return NextResponse.json({
      message_id: msg.id,
      status: 'pending',
      sender: {
        agent_id: from_agent,
        name: senderAgent.name,
        verified: senderVerified,
      },
      receiver: {
        agent_id: to_agent,
        name: receiverAgent.name,
        verified: receiverVerified,
      },
      trust_check: {
        both_verified: senderVerified && receiverVerified,
        sender_verified: senderVerified,
        receiver_verified: receiverVerified,
        recommendation: senderVerified && receiverVerified
          ? 'TRUSTED — both agents verified. Safe to exchange data.'
          : !senderVerified && !receiverVerified
          ? 'UNTRUSTED — neither agent is verified. Do not exchange sensitive data.'
          : 'PARTIAL — one agent is unverified. Proceed with caution.',
      },
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
