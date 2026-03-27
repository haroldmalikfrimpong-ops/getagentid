import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { notifyTelegram } from '@/lib/notify'

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json()
    const {
      businessName,
      registrationNumber,
      country,
      website,
      contactEmail,
      notes,
      fileName,
    } = body

    // Basic validation
    if (!businessName || !registrationNumber || !country || !contactEmail) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const userEmail = authData.user.email || 'unknown'
    const userId = authData.user.id

    // Notify via Telegram (matching existing notification pattern)
    await notifyTelegram(
      `🏢 <b>L4 Business Verification Request</b>\n\n` +
      `<b>User:</b> ${userEmail}\n` +
      `<b>User ID:</b> ${userId}\n\n` +
      `<b>Business:</b> ${businessName}\n` +
      `<b>Reg Number:</b> ${registrationNumber}\n` +
      `<b>Country:</b> ${country}\n` +
      `<b>Website:</b> ${website || 'N/A'}\n` +
      `<b>Contact:</b> ${contactEmail}\n` +
      `<b>Document:</b> ${fileName || 'None uploaded'}\n` +
      `<b>Notes:</b> ${notes || 'None'}\n\n` +
      `Time: ${new Date().toLocaleString('en-GB')}\n\n` +
      `Reply to <b>${contactEmail}</b> within 48 hours.`
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('verify-business error:', err)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
