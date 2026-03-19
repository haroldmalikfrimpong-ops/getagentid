/**
 * Send notifications to BillionmakerHQ Telegram bot
 * when users sign up, register agents, or make payments.
 */

const BOT_TOKEN = process.env.TELEGRAM_NOTIFY_TOKEN || ''
const CHAT_ID = process.env.TELEGRAM_NOTIFY_CHAT || ''

export async function notifyTelegram(message: string) {
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
  } catch {
    // Never block the main flow
  }
}

export async function notifyNewUser(email: string, provider: string) {
  await notifyTelegram(
    `🆕 <b>New AgentID User</b>\n\n` +
    `Email: ${email}\n` +
    `Provider: ${provider}\n` +
    `Time: ${new Date().toLocaleString('en-GB')}\n\n` +
    `<a href="https://getagentid.dev/admin">View in Admin →</a>`
  )
}

export async function notifyAgentRegistered(agentName: string, owner: string, agentId: string) {
  await notifyTelegram(
    `🤖 <b>New Agent Registered</b>\n\n` +
    `Agent: ${agentName}\n` +
    `Owner: ${owner}\n` +
    `ID: ${agentId}\n` +
    `Time: ${new Date().toLocaleString('en-GB')}\n\n` +
    `<a href="https://getagentid.dev/verify/${agentId}">Verify →</a>`
  )
}

export async function notifyAgentConnect(fromName: string, toName: string, trusted: boolean) {
  await notifyTelegram(
    `🔗 <b>Agent Connection</b>\n\n` +
    `${fromName} → ${toName}\n` +
    `Trust: ${trusted ? '✅ TRUSTED' : '⚠️ PARTIAL'}\n` +
    `Time: ${new Date().toLocaleString('en-GB')}`
  )
}

export async function notifyPayment(email: string, plan: string) {
  await notifyTelegram(
    `💰 <b>New Payment!</b>\n\n` +
    `User: ${email}\n` +
    `Plan: ${plan.toUpperCase()}\n` +
    `Time: ${new Date().toLocaleString('en-GB')}\n\n` +
    `<a href="https://getagentid.dev/admin">View in Admin →</a>`
  )
}
