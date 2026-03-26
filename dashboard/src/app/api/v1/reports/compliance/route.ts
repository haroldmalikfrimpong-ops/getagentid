import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { calculateTrustLevel, TrustLevel, TRUST_LEVEL_LABELS, getSpendingLimit, type AgentTrustData } from '@/lib/trust-levels'

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentInventoryItem {
  agent_id: string
  name: string
  platform: string | null
  trust_level: TrustLevel
  trust_level_label: string
  trust_score: number
  certificate_valid: boolean
  certificate_expires_at: string | null
  entity_verified: boolean
  last_verification: string | null
  active: boolean
  created_at: string
  spending_limit: number
}

interface RiskFlag {
  agent_id: string
  agent_name: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  message: string
}

interface ComplianceReport {
  report: {
    generated_at: string
    period_start: string
    period_end: string
    user_id: string
    version: string
  }
  agent_inventory: AgentInventoryItem[]
  verification_summary: {
    total_verifications: number
    successful: number
    failed: number
    success_rate: number
  }
  trust_level_distribution: Record<string, number>
  spending_summary: {
    total_spend: number
    currency: string
    by_agent: { agent_id: string; agent_name: string; total: number; daily_limit: number }[]
  }
  risk_flags: RiskFlag[]
  eu_ai_act_readiness: {
    score: number
    total_agents: number
    compliant_agents: number
    requirements: {
      valid_certificates: { met: number; total: number }
      entity_verification: { met: number; total: number }
      audit_trail: { met: number; total: number }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCertificateExpiry(certificate: string | null): { valid: boolean; expires_at: string | null } {
  if (!certificate) return { valid: false, expires_at: null }
  try {
    const parts = certificate.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      const expiresAt = new Date(payload.exp * 1000).toISOString()
      return {
        valid: payload.exp > Math.floor(Date.now() / 1000),
        expires_at: expiresAt,
      }
    }
  } catch {}
  return { valid: false, expires_at: null }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // Authenticate via Supabase session token (dashboard calls) or API key
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const db = getServiceClient()

    // Try to resolve user from Supabase auth token first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
    const userClient = createClient(supabaseUrl, supabaseKey)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)

    let userId: string

    if (user && !authError) {
      userId = user.id
    } else {
      // Fall back to API key auth
      const crypto = await import('crypto')
      const keyHash = crypto.createHash('sha256').update(token).digest('hex')
      const { data: apiKey, error: keyError } = await db
        .from('api_keys')
        .select('user_id')
        .eq('key_hash', keyHash)
        .eq('active', true)
        .single()

      if (keyError || !apiKey) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      userId = apiKey.user_id
    }

    // ── Period: last 30 days ──
    const now = new Date()
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ── Fetch agents ──
    const { data: agents, error: agentsError } = await db
      .from('agents')
      .select('agent_id, name, platform, trust_score, verified, active, created_at, last_active, certificate, user_id')
      .eq('user_id', userId)
      .order('created_at')

    if (agentsError) {
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    const agentList = agents || []
    const agentIds = agentList.map((a: any) => a.agent_id)

    // ── Fetch owner profile ──
    const { data: ownerProfile } = await db
      .from('profiles')
      .select('email_verified, entity_verified')
      .eq('id', userId)
      .single()

    const entityVerified = ownerProfile?.entity_verified === true
    const emailVerified = ownerProfile?.email_verified === true

    // ── Fetch verification events for the period ──
    let verificationEvents: any[] = []
    if (agentIds.length > 0) {
      const { data: events } = await db
        .from('agent_events')
        .select('agent_id, event_type, created_at, data')
        .in('agent_id', agentIds)
        .eq('event_type', 'verified')
        .gte('created_at', periodStart.toISOString())
        .order('created_at', { ascending: false })

      verificationEvents = events || []
    }

    // ── Fetch all verification counts per agent ──
    const verificationCounts: Record<string, number> = {}
    for (const agent of agentList) {
      const { count } = await db
        .from('agent_events')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agent.agent_id)
        .eq('event_type', 'verified')

      verificationCounts[agent.agent_id] = count ?? 0
    }

    // ── Fetch spend transactions for the period ──
    let spendTransactions: any[] = []
    if (agentIds.length > 0) {
      const { data: txns } = await db
        .from('spend_transactions')
        .select('agent_id, amount, currency, created_at')
        .in('agent_id', agentIds)
        .gte('created_at', periodStart.toISOString())

      spendTransactions = txns || []
    }

    // ── Fetch failed verification events ──
    let failedVerifications: any[] = []
    if (agentIds.length > 0) {
      const { data: failedEvents } = await db
        .from('agent_events')
        .select('agent_id, event_type, created_at, data')
        .in('agent_id', agentIds)
        .eq('event_type', 'verification_failed')
        .gte('created_at', periodStart.toISOString())

      failedVerifications = failedEvents || []
    }

    // ── Build agent inventory ──
    const agentInventory: AgentInventoryItem[] = agentList.map((agent: any) => {
      const cert = parseCertificateExpiry(agent.certificate)
      const successfulVer = verificationCounts[agent.agent_id] ?? 0

      const trustData: AgentTrustData = {
        trust_score: agent.trust_score ?? 0,
        verified: agent.verified ?? false,
        certificate_valid: cert.valid,
        entity_verified: entityVerified,
        owner_email_verified: emailVerified,
        created_at: agent.created_at,
        successful_verifications: successfulVer,
      }

      const trustLevel = calculateTrustLevel(trustData)

      // Find last verification for this agent
      const lastVer = verificationEvents.find((e: any) => e.agent_id === agent.agent_id)

      return {
        agent_id: agent.agent_id,
        name: agent.name || 'Unnamed Agent',
        platform: agent.platform,
        trust_level: trustLevel,
        trust_level_label: TRUST_LEVEL_LABELS[trustLevel],
        trust_score: agent.trust_score ?? 0,
        certificate_valid: cert.valid,
        certificate_expires_at: cert.expires_at,
        entity_verified: entityVerified,
        last_verification: lastVer?.created_at || null,
        active: agent.active ?? false,
        created_at: agent.created_at,
        spending_limit: getSpendingLimit(trustLevel),
      }
    })

    // ── Verification summary ──
    const totalVerifications = verificationEvents.length
    const failedCount = failedVerifications.length
    const successfulCount = totalVerifications
    const totalAttempts = successfulCount + failedCount
    const successRate = totalAttempts > 0 ? Math.round((successfulCount / totalAttempts) * 10000) / 100 : 100

    // ── Trust level distribution ──
    const trustDistribution: Record<string, number> = {
      'L0 — Unverified': 0,
      'L1 — Basic': 0,
      'L2 — Verified': 0,
      'L3 — Trusted': 0,
      'L4 — Full Authority': 0,
    }
    for (const agent of agentInventory) {
      const label = TRUST_LEVEL_LABELS[agent.trust_level]
      trustDistribution[label] = (trustDistribution[label] || 0) + 1
    }

    // ── Spending summary ──
    const spendByAgent: Record<string, number> = {}
    let totalSpend = 0
    for (const tx of spendTransactions) {
      spendByAgent[tx.agent_id] = (spendByAgent[tx.agent_id] || 0) + tx.amount
      totalSpend += tx.amount
    }

    const spendingSummary = {
      total_spend: Math.round(totalSpend * 100) / 100,
      currency: 'USD',
      by_agent: agentInventory.map((a) => ({
        agent_id: a.agent_id,
        agent_name: a.name,
        total: Math.round((spendByAgent[a.agent_id] || 0) * 100) / 100,
        daily_limit: a.spending_limit,
      })),
    }

    // ── Risk flags ──
    const riskFlags: RiskFlag[] = []

    for (const agent of agentInventory) {
      // Expired certificates
      if (!agent.certificate_valid && agent.certificate_expires_at) {
        riskFlags.push({
          agent_id: agent.agent_id,
          agent_name: agent.name,
          severity: 'critical',
          type: 'expired_certificate',
          message: `Certificate expired on ${new Date(agent.certificate_expires_at).toLocaleDateString()}. Renew immediately.`,
        })
      }

      // No certificate at all
      if (!agent.certificate_valid && !agent.certificate_expires_at) {
        riskFlags.push({
          agent_id: agent.agent_id,
          agent_name: agent.name,
          severity: 'high',
          type: 'no_certificate',
          message: 'No certificate issued. Agent cannot be verified by third parties.',
        })
      }

      // Low trust level for active agents
      if (agent.active && agent.trust_level <= TrustLevel.L0_UNVERIFIED) {
        riskFlags.push({
          agent_id: agent.agent_id,
          agent_name: agent.name,
          severity: 'medium',
          type: 'low_trust_level',
          message: 'Active agent at L0 (Unverified). No permissions granted.',
        })
      }

      // Inactive agents
      if (!agent.active) {
        riskFlags.push({
          agent_id: agent.agent_id,
          agent_name: agent.name,
          severity: 'low',
          type: 'inactive_agent',
          message: 'Agent is inactive. Consider decommissioning or reactivating.',
        })
      }

      // No entity verification for L3+ agents
      if (agent.trust_level >= TrustLevel.L3_TRUSTED && !agent.entity_verified) {
        riskFlags.push({
          agent_id: agent.agent_id,
          agent_name: agent.name,
          severity: 'high',
          type: 'missing_entity_verification',
          message: 'High-trust agent without entity verification. Required for L4 and EU AI Act compliance.',
        })
      }
    }

    // Add risk flags for agents with failed verifications
    const failedByAgent: Record<string, number> = {}
    for (const ev of failedVerifications) {
      failedByAgent[ev.agent_id] = (failedByAgent[ev.agent_id] || 0) + 1
    }
    for (const [agentId, count] of Object.entries(failedByAgent)) {
      const agent = agentInventory.find((a) => a.agent_id === agentId)
      if (agent && count > 0) {
        riskFlags.push({
          agent_id: agentId,
          agent_name: agent.name,
          severity: count >= 5 ? 'high' : 'medium',
          type: 'failed_verifications',
          message: `${count} failed verification${count > 1 ? 's' : ''} in the last 30 days.`,
        })
      }
    }

    // Sort risk flags by severity
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    riskFlags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    // ── EU AI Act readiness ──
    const totalAgents = agentInventory.length
    const validCerts = agentInventory.filter((a) => a.certificate_valid).length
    const entityVerifiedCount = agentInventory.filter((a) => a.entity_verified).length
    // Audit trail: agents that have at least 1 verification event
    const agentsWithAuditTrail = agentInventory.filter(
      (a) => (verificationCounts[a.agent_id] ?? 0) > 0
    ).length

    const euRequirements = {
      valid_certificates: { met: validCerts, total: totalAgents },
      entity_verification: { met: entityVerifiedCount, total: totalAgents },
      audit_trail: { met: agentsWithAuditTrail, total: totalAgents },
    }

    // Score: average of three requirement percentages
    let euScore = 0
    if (totalAgents > 0) {
      const certPct = validCerts / totalAgents
      const entityPct = entityVerifiedCount / totalAgents
      const auditPct = agentsWithAuditTrail / totalAgents
      euScore = Math.round(((certPct + entityPct + auditPct) / 3) * 10000) / 100
    }

    // Compliant = meets all three requirements
    const compliantAgents = agentInventory.filter(
      (a) =>
        a.certificate_valid &&
        a.entity_verified &&
        (verificationCounts[a.agent_id] ?? 0) > 0
    ).length

    // ── Assemble report ──
    const report: ComplianceReport = {
      report: {
        generated_at: now.toISOString(),
        period_start: periodStart.toISOString(),
        period_end: now.toISOString(),
        user_id: userId,
        version: '1.0.0',
      },
      agent_inventory: agentInventory,
      verification_summary: {
        total_verifications: totalAttempts,
        successful: successfulCount,
        failed: failedCount,
        success_rate: successRate,
      },
      trust_level_distribution: trustDistribution,
      spending_summary: spendingSummary,
      risk_flags: riskFlags,
      eu_ai_act_readiness: {
        score: euScore,
        total_agents: totalAgents,
        compliant_agents: compliantAgents,
        requirements: euRequirements,
      },
    }

    return NextResponse.json(report)
  } catch (e: any) {
    console.error('Compliance report error:', e)
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
