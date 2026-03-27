'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentInventoryItem {
  agent_id: string
  name: string
  platform: string | null
  trust_level: number
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

// ── Severity styling ─────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    text: '#f87171',
    dot: '#ef4444',
  },
  high: {
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.25)',
    text: '#fb923c',
    dot: '#f97316',
  },
  medium: {
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.25)',
    text: '#facc15',
    dot: '#eab308',
  },
  low: {
    bg: 'rgba(148,163,184,0.06)',
    border: 'rgba(148,163,184,0.15)',
    text: '#94a3b8',
    dot: '#64748b',
  },
}

// ── Trust level badge colours ────────────────────────────────────────────────

const TRUST_BADGE_STYLES: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
  2: { bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.2)', text: '#00d4ff' },
  3: { bg: 'rgba(123,47,255,0.08)', border: 'rgba(123,47,255,0.2)', text: '#a78bfa' },
  4: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#34d399' },
}

// ── Radial gauge component ───────────────────────────────────────────────────

function ReadinessGauge({ score }: { score: number }) {
  const radius = 58
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const arc = circumference * 0.75 // 270-degree arc
  const offset = arc - (arc * score) / 100

  const getColor = (s: number) => {
    if (s >= 80) return '#34d399'
    if (s >= 50) return '#facc15'
    if (s >= 25) return '#f97316'
    return '#ef4444'
  }

  const color = getColor(score)

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 140 }}>
      <svg width="160" height="140" viewBox="0 0 160 140">
        {/* Background arc */}
        <circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(135 80 80)"
        />
        {/* Value arc */}
        <motion.circle
          cx="80" cy="80" r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          transform="rotate(135 80 80)"
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 8 }}>
        <motion.span
          className="text-3xl font-black tabular-nums"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}%
        </motion.span>
        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-0.5">Readiness</span>
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-black text-white tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Requirement row ──────────────────────────────────────────────────────────

function RequirementRow({ label, met, total }: { label: string; met: number; total: number }) {
  const pct = total > 0 ? Math.round((met / total) * 100) : 0
  const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#facc15' : '#ef4444'

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs font-mono tabular-nums" style={{ color }}>{met}/{total}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setReady(true)
        fetchReport(session.access_token)
      }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchReport(token: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/reports/compliance', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch report')
      }
      const data = await res.json()
      setReport(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load compliance report')
    }
    setLoading(false)
  }

  function downloadReport() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentid-compliance-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Loading state ──
  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 mx-auto mb-4 rounded-full"
            style={{
              border: '2px solid rgba(0,212,255,0.12)',
              borderTop: '2px solid #00d4ff',
              boxShadow: '0 0 20px rgba(0,212,255,0.2)',
            }}
          />
          <p className="text-gray-600 text-sm font-mono">Generating compliance report...</p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto">
        <a href="/dashboard" className="text-cyan-500/50 text-sm hover:text-cyan-400">
          &larr; Dashboard
        </a>
        <div className="mt-8 rounded-xl p-8 text-center"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="text-red-400 text-lg font-bold mb-2">Report Generation Failed</div>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!report) return null

  const { eu_ai_act_readiness: eu, risk_flags, verification_summary, trust_level_distribution, spending_summary, agent_inventory } = report

  const criticalCount = risk_flags.filter((f) => f.severity === 'critical').length
  const highCount = risk_flags.filter((f) => f.severity === 'high').length

  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <a href="/dashboard" className="text-cyan-500/50 text-sm hover:text-cyan-400 transition-colors">
            &larr; Dashboard
          </a>
          <div className="flex items-center justify-between mt-4 mb-2">
            <div>
              <h1 className="text-3xl font-black">
                <span className="holo-gradient">Compliance Report</span>
              </h1>
              <p className="text-xs text-gray-600 mt-1 font-mono">
                Generated {new Date(report.report.generated_at).toLocaleString()} &middot; v{report.report.version}
              </p>
            </div>
            <motion.button
              onClick={downloadReport}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 rounded-full text-white text-xs font-bold tracking-wide transition-all flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                boxShadow: '0 4px 16px rgba(0,212,255,0.2)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </motion.button>
          </div>
          <div className="text-[10px] text-gray-700 font-mono">
            Period: {new Date(report.report.period_start).toLocaleDateString()} &ndash; {new Date(report.report.period_end).toLocaleDateString()}
          </div>
        </motion.div>

        {/* ── EU AI Act Readiness ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 rounded-2xl p-6"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="h-[1px] -mt-6 -mx-6 mb-6 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.2), transparent)' }} />

          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.2em]">EU AI Act Readiness</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
              style={{
                background: eu.score >= 80 ? 'rgba(16,185,129,0.08)' : eu.score >= 50 ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)',
                color: eu.score >= 80 ? '#34d399' : eu.score >= 50 ? '#facc15' : '#ef4444',
                border: `1px solid ${eu.score >= 80 ? 'rgba(16,185,129,0.2)' : eu.score >= 50 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
              {eu.compliant_agents}/{eu.total_agents} compliant
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <ReadinessGauge score={eu.score} />
            <div className="flex-1 w-full space-y-1">
              <RequirementRow label="Valid Certificates" met={eu.requirements.valid_certificates.met} total={eu.requirements.valid_certificates.total} />
              <RequirementRow label="Entity Verification" met={eu.requirements.entity_verification.met} total={eu.requirements.entity_verification.total} />
              <RequirementRow label="Audit Trail" met={eu.requirements.audit_trail.met} total={eu.requirements.audit_trail.total} />
            </div>
          </div>
        </motion.div>

        {/* ── Summary stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6"
        >
          <StatCard label="Total Agents" value={agent_inventory.length} />
          <StatCard label="Verifications" value={verification_summary.total_verifications} sub={`${verification_summary.success_rate}% success rate`} />
          <StatCard label="Total Spend" value={`$${spending_summary.total_spend.toFixed(2)}`} sub={spending_summary.currency} />
          <StatCard
            label="Risk Flags"
            value={risk_flags.length}
            sub={criticalCount > 0 ? `${criticalCount} critical` : highCount > 0 ? `${highCount} high` : 'None critical'}
          />
        </motion.div>

        {/* ── Trust Level Distribution ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-4">Trust Level Distribution</div>
          <div className="flex items-end gap-2 h-28">
            {Object.entries(trust_level_distribution).map(([label, count], i) => {
              const maxCount = Math.max(1, ...Object.values(trust_level_distribution))
              const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4
              const levelNum = parseInt(label.match(/L(\d)/)?.[1] || '1', 10)
              const style = TRUST_BADGE_STYLES[levelNum] || TRUST_BADGE_STYLES[1]

              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono font-bold tabular-nums" style={{ color: style.text }}>{count}</span>
                  <motion.div
                    className="w-full rounded-t-lg"
                    style={{ background: style.text, opacity: count > 0 ? 0.7 : 0.15 }}
                    initial={{ height: 0 }}
                    animate={{ height }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.08 }}
                  />
                  <span className="text-[9px] text-gray-600 font-mono text-center leading-tight mt-1">
                    L{levelNum}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ── Risk Flags ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.15))' }} />
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.25em]">Risk Flags</span>
            {risk_flags.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                style={{
                  background: criticalCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)',
                  color: criticalCount > 0 ? '#f87171' : '#fb923c',
                  border: `1px solid ${criticalCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)'}`,
                }}>
                {risk_flags.length}
              </span>
            )}
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.15), transparent)' }} />
          </div>

          {risk_flags.length === 0 ? (
            <div className="rounded-xl p-8 text-center"
              style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="text-green-400 font-bold text-sm mb-1">No risk flags</div>
              <p className="text-gray-600 text-xs">All agents are operating within compliance parameters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {risk_flags.map((flag, i) => {
                const style = SEVERITY_STYLES[flag.severity]
                return (
                  <motion.div
                    key={`${flag.agent_id}-${flag.type}-${i}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                    className="rounded-xl px-4 py-3 flex items-start gap-3"
                    style={{ background: style.bg, border: `1px solid ${style.border}` }}
                  >
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: style.dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold" style={{ color: style.text }}>
                          {flag.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">{flag.agent_name}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{flag.message}</p>
                    </div>
                    <span className="text-[9px] text-gray-700 font-mono flex-shrink-0 mt-0.5">{flag.type}</span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* ── Agent Inventory ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.15))' }} />
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.25em]">Agent Inventory</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(0,212,255,0.08)', color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.15)' }}>
              {agent_inventory.length}
            </span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.15), transparent)' }} />
          </div>

          {agent_inventory.length === 0 ? (
            <div className="rounded-xl p-8 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-gray-600 text-sm">No agents registered yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agent_inventory.map((agent, i) => {
                const badge = TRUST_BADGE_STYLES[agent.trust_level] || TRUST_BADGE_STYLES[1]

                return (
                  <motion.div
                    key={agent.agent_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.04 }}
                    className="rounded-xl px-5 py-4"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      {/* Left: name + meta */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text }}>
                          L{agent.trust_level}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">{agent.name}</span>
                            {agent.active ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5 truncate">
                            {agent.agent_id}
                            {agent.platform ? ` \u00b7 ${agent.platform}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Right: badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Trust level badge */}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                          style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text }}>
                          {agent.trust_level_label}
                        </span>

                        {/* Certificate badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                          agent.certificate_valid
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {agent.certificate_valid ? 'Cert Valid' : 'No Cert'}
                        </span>

                        {/* Entity verification badge */}
                        {agent.entity_verified && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Entity Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom row: stats */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <span className="text-[10px] text-gray-600">
                        Trust Score: <span className="text-gray-400 font-mono">{(agent.trust_score * 100).toFixed(0)}%</span>
                      </span>
                      <span className="text-[10px] text-gray-600">
                        Daily Limit: <span className="text-gray-400 font-mono">${agent.spending_limit}</span>
                      </span>
                      {agent.last_verification && (
                        <span className="text-[10px] text-gray-600">
                          Last Verified: <span className="text-gray-400 font-mono">{new Date(agent.last_verification).toLocaleDateString()}</span>
                        </span>
                      )}
                      <span className="text-[10px] text-gray-600">
                        Created: <span className="text-gray-400 font-mono">{new Date(agent.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* ── Spending by Agent ── */}
        {spending_summary.by_agent.some((a) => a.total > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-4">Spending by Agent</div>
            <div className="space-y-3">
              {spending_summary.by_agent
                .filter((a) => a.total > 0)
                .sort((a, b) => b.total - a.total)
                .map((agent) => {
                  const pct = agent.daily_limit > 0 ? Math.min((agent.total / (agent.daily_limit * 30)) * 100, 100) : 0

                  return (
                    <div key={agent.agent_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">{agent.agent_name}</span>
                        <span className="text-xs font-mono text-gray-300">${agent.total.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: pct > 80
                              ? 'linear-gradient(90deg, #ff9500, #ff5252)'
                              : 'linear-gradient(90deg, #00d4ff, #7b2fff)',
                          }}
                        />
                      </div>
                      <div className="text-[9px] text-gray-700 font-mono mt-0.5">
                        Daily limit: ${agent.daily_limit}
                      </div>
                    </div>
                  )
                })}
            </div>
          </motion.div>
        )}

        {/* ── Verification Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6 rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-4">Verification Summary</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] text-gray-600 mb-0.5">Total</div>
              <div className="text-lg font-black text-white tabular-nums">{verification_summary.total_verifications}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 mb-0.5">Successful</div>
              <div className="text-lg font-black text-green-400 tabular-nums">{verification_summary.successful}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 mb-0.5">Failed</div>
              <div className="text-lg font-black tabular-nums" style={{ color: verification_summary.failed > 0 ? '#f87171' : '#666' }}>
                {verification_summary.failed}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 mb-0.5">Success Rate</div>
              <div className="text-lg font-black tabular-nums" style={{ color: verification_summary.success_rate >= 95 ? '#34d399' : verification_summary.success_rate >= 80 ? '#facc15' : '#f87171' }}>
                {verification_summary.success_rate}%
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center py-10 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-gray-700 text-xs font-mono">AgentID Compliance Report &middot; getagentid.dev</p>
        </div>
      </div>
    </div>
  )
}
