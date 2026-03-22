import { getServiceClient } from './api-auth'

export async function trackUsage(userId: string, action: string) {
  const db = getServiceClient()
  await db.from('agent_events').insert({
    agent_id: 'api',
    event_type: `api_${action}`,
    data: { user_id: userId, timestamp: new Date().toISOString() },
  })
}

export async function getUsageCount(userId: string, action: string = 'verify'): Promise<number> {
  const db = getServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count, error } = await db
    .from('agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', `api_${action}`)
    .gte('created_at', monthStart)
    .contains('data', { user_id: userId })

  if (error) {
    console.error('Failed to get usage count:', error)
    return 0
  }

  return count ?? 0
}

// Track verification requests by IP for unauthenticated rate limiting
export async function trackIpUsage(ip: string) {
  const db = getServiceClient()
  await db.from('agent_events').insert({
    agent_id: 'api',
    event_type: 'api_verify_anonymous',
    data: { ip, timestamp: new Date().toISOString() },
  })
}

// Count verification requests from an IP in the last hour
export async function getIpUsageCount(ip: string): Promise<number> {
  const db = getServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error } = await db
    .from('agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'api_verify_anonymous')
    .gte('created_at', oneHourAgo)
    .contains('data', { ip })

  if (error) {
    console.error('Failed to get IP usage count:', error)
    return 0
  }

  return count ?? 0
}
