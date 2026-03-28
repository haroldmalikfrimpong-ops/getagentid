import { NextRequest, NextResponse } from 'next/server'
import { generateApiKey, getServiceClient } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { sendWebhook } from '@/lib/webhooks'

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

    // Log key creation event
    await db.from('agent_events').insert({
      agent_id: `user_${user.id}`,
      event_type: 'api_key_created',
      data: { key_prefix: prefix },
    })

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

export async function DELETE(req: NextRequest) {
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

    // Parse key_id from request body
    const body = await req.json()
    const { key_id } = body
    if (!key_id) {
      return NextResponse.json({ error: 'key_id is required' }, { status: 400 })
    }

    // Verify the key belongs to this user before revoking
    const db = getServiceClient()
    const { data: existing, error: lookupError } = await db
      .from('api_keys')
      .select('id, user_id, active, key_prefix')
      .eq('id', key_id)
      .single()

    if (lookupError || !existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    if (!existing.active) {
      return NextResponse.json({ error: 'Key is already revoked' }, { status: 400 })
    }

    // Soft delete — set active to false
    const { error: updateError } = await db
      .from('api_keys')
      .update({ active: false })
      .eq('id', key_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 })
    }

    // Log key revocation event
    await db.from('agent_events').insert({
      agent_id: `user_${user.id}`,
      event_type: 'api_key_revoked',
      data: { key_id, key_prefix: existing.key_prefix || 'unknown' },
    })

    return NextResponse.json({ success: true, message: 'API key revoked' })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
