import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/v1/build-request
 *
 * Receives agent build request from the /build page.
 * Sends notification to Telegram and stores in Supabase.
 */

const BOT_TOKEN = process.env.TELEGRAM_NOTIFY_TOKEN || ''
const CHAT_ID = process.env.TELEGRAM_NOTIFY_CHAT || ''

async function notifyTelegram(message: string) {
  if (!BOT_TOKEN || !CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, email, company, industry,
      agentDescription, runSchedule, integrations,
      dataNeeded, reporting, timeline, budget, additional,
    } = body

    if (!name || !email || !agentDescription) {
      return NextResponse.json({ error: 'name, email, and agentDescription are required' }, { status: 400 })
    }

    // Send Telegram notification
    const message =
      `<b>New Agent Build Request</b>\n\n` +
      `<b>Name:</b> ${name}\n` +
      `<b>Email:</b> ${email}\n` +
      `<b>Company:</b> ${company || 'Not specified'}\n` +
      `<b>Industry:</b> ${industry || 'Not specified'}\n\n` +
      `<b>What the agent should do:</b>\n${agentDescription}\n\n` +
      `<b>Run schedule:</b> ${runSchedule || 'Not specified'}\n` +
      `<b>Integrations:</b> ${integrations || 'Not specified'}\n` +
      `<b>Data needed:</b> ${dataNeeded || 'Not specified'}\n` +
      `<b>Reporting:</b> ${reporting || 'Not specified'}\n` +
      `<b>Timeline:</b> ${timeline || 'Not specified'}\n` +
      `<b>Budget:</b> ${budget || 'Not specified'}\n` +
      (additional ? `\n<b>Additional:</b> ${additional}\n` : '') +
      `\n<b>Time:</b> ${new Date().toLocaleString('en-GB')}`

    await notifyTelegram(message)

    return NextResponse.json({ ok: true, message: 'Request received' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
