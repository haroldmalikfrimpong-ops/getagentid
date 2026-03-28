/**
 * Behavioural fingerprinting for AgentID.
 * Builds a baseline profile from recent activity and detects anomalies
 * when an agent deviates from its normal patterns.
 *
 * MVP anomaly detection — simple statistical rules, not ML.
 */

import { getServiceClient } from './api-auth'
import { calculateTrustLevel, type AgentTrustData } from './trust-levels'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PayloadFingerprint {
  common_keys: string[]         // most common payload keys/fields used
  avg_payload_size: number      // average payload size in bytes
  message_type_distribution: Record<string, number> // message_type -> count
}

export interface BehaviourProfile {
  agent_id: string
  avg_verifications_per_day: number
  avg_api_calls_per_hour: number
  typical_active_hours: [number, number] // e.g. [9, 17]
  typical_actions: string[] // most common event types
  payload_fingerprint: PayloadFingerprint // semantic fingerprint of payloads
  last_known_model_version: string | null
  last_known_prompt_hash: string | null
  last_updated: string
}

export interface AnomalyAlert {
  agent_id: string
  type: 'frequency_spike' | 'unusual_hour' | 'new_action' | 'trust_drop' | 'payload_drift' | 'model_changed'
  severity: 'low' | 'medium' | 'high'
  description: string
  detected_at: string
  current_value: number
  baseline_value: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const BASELINE_DAYS = 30
const FREQUENCY_SPIKE_MULTIPLIER = 3
const SEVERITY_WEIGHTS: Record<AnomalyAlert['severity'], number> = {
  low: 10,
  medium: 30,
  high: 50,
}

// ── Build a baseline profile from the last 30 days ──────────────────────────

export async function buildProfile(agentId: string): Promise<BehaviourProfile> {
  const db = getServiceClient()
  const since = new Date(Date.now() - BASELINE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: events, error } = await db
    .from('agent_events')
    .select('event_type, created_at, data')
    .eq('agent_id', agentId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error || !events || events.length === 0) {
    return {
      agent_id: agentId,
      avg_verifications_per_day: 0,
      avg_api_calls_per_hour: 0,
      typical_active_hours: [0, 23],
      typical_actions: [],
      payload_fingerprint: { common_keys: [], avg_payload_size: 0, message_type_distribution: {} },
      last_known_model_version: null,
      last_known_prompt_hash: null,
      last_updated: new Date().toISOString(),
    }
  }

  // Count verifications
  const verifications = events.filter((e) => e.event_type === 'verified').length
  const avgVerificationsPerDay = verifications / BASELINE_DAYS

  // Count all events as "API calls"
  const totalEvents = events.length
  const avgApiCallsPerHour = totalEvents / (BASELINE_DAYS * 24)

  // Find typical active hours — bucket events by hour, find the range
  const hourCounts = new Array(24).fill(0)
  for (const event of events) {
    const hour = new Date(event.created_at).getUTCHours()
    hourCounts[hour]++
  }

  // Find the contiguous block containing the most activity
  const { start, end } = findActiveHourRange(hourCounts)

  // Find most common event types
  const actionCounts: Record<string, number> = {}
  for (const event of events) {
    actionCounts[event.event_type] = (actionCounts[event.event_type] || 0) + 1
  }
  const typicalActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type]) => type)

  // ── Semantic fingerprinting: analyse payload patterns ──────────────────
  const keyCounts: Record<string, number> = {}
  let totalPayloadSize = 0
  let payloadCount = 0
  const messageTypeDist: Record<string, number> = {}

  for (const event of events) {
    const data = event.data as any
    if (data && typeof data === 'object') {
      // Track payload keys
      const keys = Object.keys(data)
      for (const key of keys) {
        keyCounts[key] = (keyCounts[key] || 0) + 1
      }
      // Track payload size
      const size = JSON.stringify(data).length
      totalPayloadSize += size
      payloadCount++

      // Track message type distribution
      if (data.type || data.message_type) {
        const mt = data.type || data.message_type
        messageTypeDist[mt] = (messageTypeDist[mt] || 0) + 1
      }
    }
  }

  const commonKeys = Object.entries(keyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key]) => key)

  const avgPayloadSize = payloadCount > 0 ? Math.round(totalPayloadSize / payloadCount) : 0

  // ── Track last known model version and prompt hash ────────────────────
  const { data: agentRow } = await db
    .from('agents')
    .select('model_version, prompt_hash')
    .eq('agent_id', agentId)
    .single()

  return {
    agent_id: agentId,
    avg_verifications_per_day: Math.round(avgVerificationsPerDay * 100) / 100,
    avg_api_calls_per_hour: Math.round(avgApiCallsPerHour * 100) / 100,
    typical_active_hours: [start, end],
    typical_actions: typicalActions,
    payload_fingerprint: {
      common_keys: commonKeys,
      avg_payload_size: avgPayloadSize,
      message_type_distribution: messageTypeDist,
    },
    last_known_model_version: agentRow?.model_version || null,
    last_known_prompt_hash: agentRow?.prompt_hash || null,
    last_updated: new Date().toISOString(),
  }
}

// ── Detect anomalies against the baseline ───────────────────────────────────

export async function detectAnomalies(agentId: string): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = []
  const now = new Date()
  const detectedAt = now.toISOString()

  const [profile, recentActivity] = await Promise.all([
    buildProfile(agentId),
    getRecentActivity(agentId),
  ])

  // 1. Frequency spike — ratio-based but with MINIMUM absolute thresholds
  // An agent making 4 calls when its baseline is 0.01 is NOT an attack — it's normal use.
  // Only flag as HIGH when the absolute count is genuinely concerning.
  const MIN_CALLS_FOR_LOW = 10       // at least 10 calls/hr before any flag
  const MIN_CALLS_FOR_MEDIUM = 25    // at least 25 calls/hr for medium
  const MIN_CALLS_FOR_HIGH = 50      // at least 50 calls/hr for high (actual abuse)

  if (profile.avg_api_calls_per_hour > 0) {
    const ratio = recentActivity.lastHourCount / profile.avg_api_calls_per_hour
    const count = recentActivity.lastHourCount

    if (ratio >= FREQUENCY_SPIKE_MULTIPLIER && count >= MIN_CALLS_FOR_LOW) {
      let severity: AnomalyAlert['severity'] = 'low'
      if (ratio >= 10 && count >= MIN_CALLS_FOR_HIGH) severity = 'high'
      else if (ratio >= 5 && count >= MIN_CALLS_FOR_MEDIUM) severity = 'medium'

      alerts.push({
        agent_id: agentId,
        type: 'frequency_spike',
        severity,
        description: `API call rate is ${Math.round(ratio)}x the baseline average (${count} calls in the last hour vs avg ${profile.avg_api_calls_per_hour}/hr)`,
        detected_at: detectedAt,
        current_value: count,
        baseline_value: profile.avg_api_calls_per_hour,
      })
    }
  } else if (recentActivity.lastHourCount > MIN_CALLS_FOR_MEDIUM) {
    // No baseline yet but genuinely high volume
    alerts.push({
      agent_id: agentId,
      type: 'frequency_spike',
      severity: recentActivity.lastHourCount >= MIN_CALLS_FOR_HIGH ? 'high' : 'medium',
      description: `${recentActivity.lastHourCount} API calls in the last hour from an agent with no prior baseline`,
      detected_at: detectedAt,
      current_value: recentActivity.lastHourCount,
      baseline_value: 0,
    })
  }

  // 2. Unusual hour — activity outside typical window
  const currentHour = now.getUTCHours()
  const [startHour, endHour] = profile.typical_active_hours
  if (profile.typical_actions.length > 0 && !isWithinHours(currentHour, startHour, endHour)) {
    alerts.push({
      agent_id: agentId,
      type: 'unusual_hour',
      severity: 'medium',
      description: `Agent active at ${currentHour}:00 UTC, outside its typical window of ${startHour}:00-${endHour}:00 UTC`,
      detected_at: detectedAt,
      current_value: currentHour,
      baseline_value: startHour,
    })
  }

  // 3. New action — event types never seen before
  if (profile.typical_actions.length > 0) {
    for (const action of recentActivity.recentActions) {
      if (!profile.typical_actions.includes(action)) {
        alerts.push({
          agent_id: agentId,
          type: 'new_action',
          severity: 'low',
          description: `Agent performed action "${action}" which has not been seen in the last ${BASELINE_DAYS} days`,
          detected_at: detectedAt,
          current_value: 1,
          baseline_value: 0,
        })
      }
    }
  }

  // 4. Trust drop — current trust level lower than it was recently
  const trustDrop = await checkTrustDrop(agentId)
  if (trustDrop) {
    alerts.push({
      agent_id: agentId,
      type: 'trust_drop',
      severity: 'high',
      description: trustDrop.description,
      detected_at: detectedAt,
      current_value: trustDrop.current,
      baseline_value: trustDrop.previous,
    })
  }

  // 5. Payload drift — detect when payload structure changes significantly
  if (profile.payload_fingerprint.common_keys.length > 0) {
    const recentPayloadKeys = await getRecentPayloadKeys(agentId)
    if (recentPayloadKeys.length > 0) {
      const baselineKeys = new Set(profile.payload_fingerprint.common_keys)
      const newKeys = recentPayloadKeys.filter((k) => !baselineKeys.has(k))
      const driftRatio = baselineKeys.size > 0 ? newKeys.length / baselineKeys.size : 0

      if (driftRatio >= 0.5) {
        alerts.push({
          agent_id: agentId,
          type: 'payload_drift',
          severity: driftRatio >= 0.8 ? 'high' : 'medium',
          description: `Agent payload structure has drifted ${Math.round(driftRatio * 100)}% from baseline. ${newKeys.length} new keys detected: ${newKeys.slice(0, 5).join(', ')}`,
          detected_at: detectedAt,
          current_value: newKeys.length,
          baseline_value: baselineKeys.size,
        })
      }
    }
  }

  // 6. Model changed — detect when model_version or prompt_hash changes
  if (profile.last_known_model_version || profile.last_known_prompt_hash) {
    const modelChange = await checkModelChange(agentId, profile)
    if (modelChange) {
      alerts.push({
        agent_id: agentId,
        type: 'model_changed',
        severity: 'medium',
        description: modelChange.description,
        detected_at: detectedAt,
        current_value: 1,
        baseline_value: 0,
      })
    }
  }

  return alerts
}

// ── Get all active alerts across all agents for a user ──────────────────────

export async function getActiveAlerts(userId: string): Promise<AnomalyAlert[]> {
  const db = getServiceClient()

  // Get all agents for this user
  const { data: agents, error } = await db
    .from('agents')
    .select('agent_id')
    .eq('user_id', userId)
    .eq('active', true)

  if (error || !agents || agents.length === 0) {
    return []
  }

  // Run anomaly detection for each agent in parallel
  const allAlerts = await Promise.all(
    agents.map((agent) => detectAnomalies(agent.agent_id))
  )

  return allAlerts.flat()
}

// ── Calculate risk score from anomalies ─────────────────────────────────────

export function calculateRiskScore(anomalies: AnomalyAlert[]): number {
  if (anomalies.length === 0) return 0

  let score = 0
  for (const anomaly of anomalies) {
    score += SEVERITY_WEIGHTS[anomaly.severity]
  }

  // Cap at 100
  return Math.min(100, score)
}

// ── Quick check for the verify endpoint (lightweight) ───────────────────────

export async function quickAnomalyCheck(agentId: string): Promise<AnomalyAlert[]> {
  // Same as detectAnomalies but designed to be called inline
  // We don't cache profiles yet — this is MVP
  return detectAnomalies(agentId)
}

// ── Internal helpers ────────────────────────────────────────────────────────

async function getRecentPayloadKeys(agentId: string): Promise<string[]> {
  const db = getServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: events } = await db
    .from('agent_events')
    .select('data')
    .eq('agent_id', agentId)
    .gte('created_at', oneHourAgo)

  const keySet = new Set<string>()
  for (const event of events || []) {
    const data = event.data as any
    if (data && typeof data === 'object') {
      for (const key of Object.keys(data)) {
        keySet.add(key)
      }
    }
  }
  return Array.from(keySet)
}

async function checkModelChange(agentId: string, profile: BehaviourProfile): Promise<{ description: string } | null> {
  const db = getServiceClient()

  // Get the latest model_version_changed or prompt_hash_changed event
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: changeEvents } = await db
    .from('agent_events')
    .select('event_type, data, created_at')
    .eq('agent_id', agentId)
    .in('event_type', ['model_version_changed', 'prompt_hash_changed'])
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (changeEvents && changeEvents.length > 0) {
    const event = changeEvents[0]
    const data = event.data as any
    if (event.event_type === 'model_version_changed') {
      return {
        description: `Model version changed from "${data?.previous || 'unknown'}" to "${data?.current || 'unknown'}" in the last 24 hours`,
      }
    }
    if (event.event_type === 'prompt_hash_changed') {
      return {
        description: `Prompt hash changed from "${data?.previous || 'unknown'}" to "${data?.current || 'unknown'}" in the last 24 hours`,
      }
    }
  }
  return null
}

async function getRecentActivity(agentId: string) {
  const db = getServiceClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: events } = await db
    .from('agent_events')
    .select('event_type, created_at')
    .eq('agent_id', agentId)
    .gte('created_at', oneHourAgo)

  const recentEvents = events || []
  const recentActions = Array.from(new Set(recentEvents.map((e: any) => e.event_type)))

  return {
    lastHourCount: recentEvents.length,
    recentActions,
  }
}

async function checkTrustDrop(agentId: string): Promise<{ current: number; previous: number; description: string } | null> {
  const db = getServiceClient()

  // Get current agent data
  const { data: agent } = await db
    .from('agents')
    .select('trust_score, verified, certificate, created_at, user_id')
    .eq('agent_id', agentId)
    .single()

  if (!agent) return null

  // Check if there's a recent trust_level_changed event showing a decrease
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: trustEvents } = await db
    .from('agent_events')
    .select('data, created_at')
    .eq('agent_id', agentId)
    .eq('event_type', 'trust_level_changed')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (trustEvents && trustEvents.length > 0) {
    const eventData = trustEvents[0].data as any
    if (eventData?.previous_level !== undefined && eventData?.new_level !== undefined) {
      if (eventData.new_level < eventData.previous_level) {
        return {
          current: eventData.new_level,
          previous: eventData.previous_level,
          description: `Trust level dropped from L${eventData.previous_level} to L${eventData.new_level} in the last 24 hours — possible compromise`,
        }
      }
    }
  }

  // Also flag if trust_score itself is significantly lower than expected
  // Check the agent's trust_score history via events
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: scoreEvents } = await db
    .from('agent_events')
    .select('data')
    .eq('agent_id', agentId)
    .eq('event_type', 'verified')
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: true })
    .limit(1)

  // If we can see a previous trust_score in event data, compare
  if (scoreEvents && scoreEvents.length > 0) {
    const oldData = scoreEvents[0].data as any
    if (oldData?.trust_score !== undefined && agent.trust_score !== null) {
      const drop = oldData.trust_score - agent.trust_score
      if (drop >= 0.2) {
        return {
          current: agent.trust_score,
          previous: oldData.trust_score,
          description: `Trust score dropped by ${Math.round(drop * 100)}% (from ${oldData.trust_score} to ${agent.trust_score}) in the last 7 days`,
        }
      }
    }
  }

  return null
}

/**
 * Find the contiguous block of hours containing the most activity.
 * Returns start and end hour (inclusive, UTC).
 */
function findActiveHourRange(hourCounts: number[]): { start: number; end: number } {
  const totalEvents = hourCounts.reduce((a, b) => a + b, 0)
  if (totalEvents === 0) return { start: 0, end: 23 }

  // Find hours where at least 5% of total activity occurs
  const threshold = totalEvents * 0.05
  const activeHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count >= threshold)
    .map((h) => h.hour)

  if (activeHours.length === 0) return { start: 0, end: 23 }
  if (activeHours.length === 24) return { start: 0, end: 23 }

  // Simple: take min and max of active hours
  // This works for agents with a single contiguous active window
  const start = Math.min(...activeHours)
  const end = Math.max(...activeHours)

  return { start, end }
}

/**
 * Check if an hour falls within a range (handles overnight ranges like 22-6).
 */
function isWithinHours(hour: number, start: number, end: number): boolean {
  if (start === 0 && end === 23) return true // no meaningful window
  if (start <= end) {
    return hour >= start && hour <= end
  }
  // Wraps midnight (e.g. 22 to 6)
  return hour >= start || hour <= end
}
