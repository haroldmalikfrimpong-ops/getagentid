import { getServiceClient } from './api-auth'

export async function trackUsage(userId: string, action: string) {
  const db = getServiceClient()
  await db.from('agent_events').insert({
    agent_id: 'api',
    event_type: `api_${action}`,
    data: { user_id: userId, timestamp: new Date().toISOString() },
  })
}

export async function getUsageCount(userId: string): Promise<number> {
  const db = getServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count } = await db
    .from('agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'api_verify')
    .gte('created_at', monthStart)
    .contains('data', { user_id: userId })

  return count || 0
}
