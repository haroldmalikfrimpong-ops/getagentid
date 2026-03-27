import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const ADMIN_ID = process.env.ADMIN_USER_ID
    if (!ADMIN_ID) {
      return NextResponse.json({ error: 'ADMIN_USER_ID env var is not configured' }, { status: 500 })
    }

    // Verify admin
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_KEY || '')
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user || user.id !== ADMIN_ID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { action, agent_id, user_id } = body
    const db = getServiceClient()

    if (action === 'verify_agent') {
      await db.from('agents').update({ verified: true, trust_score: 0.94 }).eq('agent_id', agent_id)
      return NextResponse.json({ success: true, message: `Agent ${agent_id} verified` })
    }

    if (action === 'unverify_agent') {
      await db.from('agents').update({ verified: false, trust_score: 0 }).eq('agent_id', agent_id)
      return NextResponse.json({ success: true, message: `Agent ${agent_id} unverified` })
    }

    if (action === 'delete_agent') {
      await db.from('agents').update({ active: false }).eq('agent_id', agent_id)
      return NextResponse.json({ success: true, message: `Agent ${agent_id} deactivated` })
    }

    if (action === 'ban_user') {
      await db.from('agents').update({ active: false }).eq('user_id', user_id)
      return NextResponse.json({ success: true, message: `User ${user_id} banned — all agents deactivated` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
