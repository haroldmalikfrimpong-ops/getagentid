import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { message_id, response } = body

    if (!message_id) {
      return NextResponse.json({ error: 'message_id is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Get the message
    const { data: msg } = await db
      .from('agent_messages')
      .select('*')
      .eq('id', message_id)
      .single()

    if (!msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Verify the responder owns the receiving agent
    const { data: agent } = await db
      .from('agents')
      .select('*')
      .eq('agent_id', msg.to_agent)
      .eq('user_id', auth.user_id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'You do not own the receiving agent' }, { status: 403 })
    }

    // Update the message with response
    await db
      .from('agent_messages')
      .update({
        status: 'responded',
        response: response || { acknowledged: true },
        responded_at: new Date().toISOString(),
      })
      .eq('id', message_id)

    // Log response event
    await db.from('agent_events').insert({
      agent_id: msg.to_agent,
      event_type: 'message_responded',
      data: { message_id, from: msg.from_agent },
    })

    return NextResponse.json({
      message_id,
      status: 'responded',
      message: 'Response sent successfully',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
