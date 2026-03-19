import { NextRequest, NextResponse } from 'next/server'
import { notifyNewUser } from '@/lib/notify'
import { getServiceClient } from '@/lib/api-auth'

// Called from the signup page after successful registration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, provider } = body

    if (email) {
      await notifyNewUser(email, provider || 'email')

      // Create profile
      const db = getServiceClient()
      if (db && body.user_id) {
        await db.from('profiles').upsert({
          id: body.user_id,
          email,
          plan: 'free',
          agent_limit: 5,
          verification_limit: 1000,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
