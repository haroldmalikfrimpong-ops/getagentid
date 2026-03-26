import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { sendTestWebhook } from '@/lib/webhooks'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''

function getDb() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Helper: get user from session token
async function getUserFromSession(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// GET — fetch webhook config + recent deliveries
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromSession(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getDb()

    const [profileRes, deliveriesRes] = await Promise.all([
      db.from('profiles').select('webhook_url').eq('id', user.id).single(),
      db.from('webhook_deliveries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    return NextResponse.json({
      webhook_url: profileRes.data?.webhook_url || null,
      deliveries: deliveriesRes.data || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

// PUT — update webhook URL
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromSession(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { webhook_url } = body

    // Allow empty string to clear
    if (webhook_url && typeof webhook_url === 'string' && webhook_url.length > 0) {
      try {
        new URL(webhook_url)
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
      }
    }

    const db = getDb()
    const { error } = await db
      .from('profiles')
      .update({ webhook_url: webhook_url || null })
      .eq('id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update webhook URL' }, { status: 500 })
    }

    return NextResponse.json({ success: true, webhook_url: webhook_url || null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

// POST — send test webhook
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromSession(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await sendTestWebhook(user.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
