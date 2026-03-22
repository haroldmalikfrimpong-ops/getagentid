import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''

// Service client bypasses RLS — for API routes only
export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Authenticate API request by API key
export async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing API key. Use: Authorization: Bearer your-api-key', status: 401 }
  }

  const apiKey = authHeader.replace('Bearer ', '')
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const db = getServiceClient()
  const { data, error } = await db
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('active', true)
    .single()

  if (error || !data) {
    return { error: 'Invalid API key', status: 401 }
  }

  // Get profile separately
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', data.user_id)
    .single()

  // Update last used
  await db.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', data.id)

  return { user_id: data.user_id, api_key_id: data.id, profile: profile || { agent_limit: 5, verification_limit: 1000, plan: 'free' } }
}

// Generate a new API key for a user
export function generateApiKey() {
  const key = `agentid_sk_${crypto.randomBytes(24).toString('hex')}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const prefix = key.substring(0, 14) + '...'
  return { key, hash, prefix }
}

// Generate agent ID
export function generateAgentId() {
  return `agent_${crypto.randomBytes(8).toString('hex')}`
}

// Get the signing secret, refusing to use a publicly-known default
function getSigningSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Cannot sign certificates without a proper secret. ' +
      'Set JWT_SECRET to a strong random value (e.g. 64+ hex chars).'
    )
  }
  return secret
}

// Sign a certificate (JWT-like)
export function issueCertificate(agentId: string, name: string, owner: string, capabilities: string[]) {
  const secret = getSigningSecret()

  const now = Math.floor(Date.now() / 1000)
  const expires = now + 365 * 24 * 60 * 60 // 1 year

  const payload = {
    iss: 'https://getagentid.dev',
    sub: agentId,
    name,
    owner,
    capabilities,
    iat: now,
    exp: expires,
  }

  // Base64 encode the payload as a simple certificate
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'AgentID' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')

  return {
    certificate: `${header}.${body}.${signature}`,
    issued_at: new Date(now * 1000).toISOString(),
    expires_at: new Date(expires * 1000).toISOString(),
  }
}
