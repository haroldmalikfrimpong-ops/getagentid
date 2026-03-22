import { NextRequest, NextResponse } from 'next/server'
import { notifyNewUser } from '@/lib/notify'
import { getServiceClient } from '@/lib/api-auth'

// Called from the signup page after successful registration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, provider } = body

    // --- Authentication: verify Supabase session token ---
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { ok: false, error: 'Missing authorization token' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const db = getServiceClient()

    const { data: authData, error: authError } = await db.auth.getUser(accessToken)
    if (authError || !authData?.user) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // Ensure the caller can only create/access their own profile
    if (body.user_id && authData.user.id !== body.user_id) {
      return NextResponse.json(
        { ok: false, error: 'Token does not match requested user_id' },
        { status: 403 }
      )
    }
    // --- End authentication ---

    if (email) {
      if (db && body.user_id) {
        // Check if profile already exists to avoid overwriting paid plans
        const { data: existing } = await db
          .from('profiles')
          .select('id')
          .eq('id', body.user_id)
          .single()

        if (!existing) {
          // New user — create profile with free defaults
          await db.from('profiles').insert({
            id: body.user_id,
            email,
            plan: 'free',
            agent_limit: 5,
            verification_limit: 1000,
          })

          // Only notify for genuinely new users
          await notifyNewUser(email, provider || 'email')
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
