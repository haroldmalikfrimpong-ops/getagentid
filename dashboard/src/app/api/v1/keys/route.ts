import { NextRequest, NextResponse } from 'next/server'
import { generateApiKey, getServiceClient } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    // Get user from Supabase session (browser auth, not API key)
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Generate API key
    const { key, hash, prefix } = generateApiKey()

    // Store hash in database (never store the actual key)
    const db = getServiceClient()
    const { error: dbError } = await db.from('api_keys').insert({
      user_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      name: 'Default',
      active: true,
    })

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    // Return the key ONCE — it's never shown again
    return NextResponse.json({
      api_key: key,
      prefix: prefix,
      message: 'Save this key — it will not be shown again.',
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
