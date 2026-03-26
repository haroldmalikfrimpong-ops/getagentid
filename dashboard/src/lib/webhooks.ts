/**
 * Webhook delivery system for AgentID.
 * Sends event notifications to user-configured webhook URLs.
 * Fire-and-forget — never blocks the main request.
 */

import crypto from 'crypto'
import { getServiceClient } from '@/lib/api-auth'

// ── Supported events ────────────────────────────────────────────────────────
export type WebhookEvent =
  | 'agent.registered'
  | 'agent.verified'
  | 'agent.trust_level_changed'
  | 'agent.certificate_expired'
  | 'agent.behaviour_anomaly'
  | 'spend.authorized'
  | 'spend.denied'
  | 'payment.authorized'
  | 'payment.denied'
  | 'payment.human_authorized'
  | 'payment.human_pending_approval'
  | 'payment.human_denied'
  | 'payment.frozen'
  | 'payment.unfrozen'

// ── Webhook payload shape ───────────────────────────────────────────────────
interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: object
}

// ── Send a webhook (fire and forget) ────────────────────────────────────────
export function sendWebhook(userId: string, event: WebhookEvent, data: object) {
  // Run async — don't await, never block the caller
  deliverWebhook(userId, event, data).catch(() => {})
}

async function deliverWebhook(userId: string, event: WebhookEvent, data: object) {
  const db = getServiceClient()

  // Look up the user's webhook URL and get their API key hash for signing
  const [profileRes, keyRes] = await Promise.all([
    db.from('profiles').select('webhook_url').eq('id', userId).single(),
    db.from('api_keys').select('key_hash').eq('user_id', userId).eq('active', true).limit(1).single(),
  ])

  const webhookUrl = profileRes.data?.webhook_url
  if (!webhookUrl) return // No webhook configured — nothing to do

  const signingSecret = keyRes.data?.key_hash || userId

  // Build payload
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const body = JSON.stringify(payload)

  // HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(body)
    .digest('hex')

  // Deliver with 5-second timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  let success = false
  let statusCode: number | null = null
  let errorMsg: string | null = null

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentID-Event': event,
        'X-AgentID-Signature': signature,
      },
      body,
      signal: controller.signal,
    })
    statusCode = res.status
    success = res.ok
    if (!res.ok) {
      errorMsg = `HTTP ${res.status}`
    }
  } catch (e: any) {
    errorMsg = e.name === 'AbortError' ? 'Timeout (5s)' : (e.message || 'Delivery failed')
  } finally {
    clearTimeout(timeout)
  }

  // Log the delivery attempt
  try {
    await db.from('webhook_deliveries').insert({
      user_id: userId,
      event,
      url: webhookUrl,
      status_code: statusCode,
      success,
      error: errorMsg,
      payload: payload,
    })
  } catch {
    // Never block on logging failure
  }
}

// ── Send a test webhook ─────────────────────────────────────────────────────
export async function sendTestWebhook(userId: string): Promise<{ success: boolean; error?: string }> {
  const db = getServiceClient()

  const [profileRes, keyRes] = await Promise.all([
    db.from('profiles').select('webhook_url').eq('id', userId).single(),
    db.from('api_keys').select('key_hash').eq('user_id', userId).eq('active', true).limit(1).single(),
  ])

  const webhookUrl = profileRes.data?.webhook_url
  if (!webhookUrl) return { success: false, error: 'No webhook URL configured' }

  const signingSecret = keyRes.data?.key_hash || userId

  const payload: WebhookPayload = {
    event: 'agent.verified',
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      agent_id: 'agent_test_000000',
      name: 'Test Agent',
      message: 'This is a test webhook from AgentID',
    },
  }

  const body = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(body)
    .digest('hex')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  let success = false
  let statusCode: number | null = null
  let errorMsg: string | null = null

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentID-Event': 'agent.verified',
        'X-AgentID-Signature': signature,
      },
      body,
      signal: controller.signal,
    })
    statusCode = res.status
    success = res.ok
    if (!res.ok) errorMsg = `HTTP ${res.status}`
  } catch (e: any) {
    errorMsg = e.name === 'AbortError' ? 'Timeout (5s)' : (e.message || 'Delivery failed')
  } finally {
    clearTimeout(timeout)
  }

  // Log delivery
  try {
    await db.from('webhook_deliveries').insert({
      user_id: userId,
      event: 'agent.verified',
      url: webhookUrl,
      status_code: statusCode,
      success,
      error: errorMsg,
      payload: { ...payload, test: true },
    })
  } catch {}

  return success ? { success: true } : { success: false, error: errorMsg || 'Unknown error' }
}
