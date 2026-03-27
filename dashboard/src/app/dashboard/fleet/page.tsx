'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  TrustLevel,
  TRUST_LEVEL_LABELS,
  calculateTrustLevel,
  levelUpRequirements,
  type AgentTrustData,
} from '@/lib/trust-levels'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Agent {
  id: string
  name: string
  agent_id: string
  owner: string
  capabilities: string[]
  trust_score: number
  certificate: any
  verified: boolean
  created_at: string
  description?: string
  platform?: string
  last_active?: string
  entity_verified?: boolean
  owner_email_verified?: boolean
  successful_verifications?: number
}

interface AgentEvent {
  id: string
  agent_id: string
  event_type: string
  created_at: string
}

type AgentStatus = 'active' | 'inactive' | 'at-risk'
type SortKey = 'name' | 'trust_level' | 'last_verified'

// ─── Constants ───────────────────────────────────────────────────────────────
const TRUST_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'rgba(59,130,246,0.1)',   text: '#60a5fa', border: 'rgba(59,130,246,0.25)',  glow: 'rgba(59,130,246,0.15)' },
  2: { bg: 'rgba(34,197,94,0.1)',    text: '#4ade80', border: 'rgba(34,197,94,0.25)',   glow: 'rgba(34,197,94,0.15)' },
  3: { bg: 'rgba(168,85,247,0.1)',   text: '#c084fc', border: 'rgba(168,85,247,0.25)',  glow: 'rgba(168,85,247,0.15)' },
  4: { bg: 'rgba(234,179,8,0.1)',    text: '#facc15', border: 'rgba(234,179,8,0.25)',   glow: 'rgba(234,179,8,0.15)' },
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; bg: string; border: string; label: string }> = {
  active:    { color: '#4ade80', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',   label: 'Active' },
  inactive:  { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', label: 'Inactive' },
  'at-risk': { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  label: 'At Risk' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getAgentTrustData(agent: Agent): AgentTrustData {
  const cert = agent.certificate
  const certValid = cert
    ? (typeof cert === 'object' && cert.valid !== undefined ? cert.valid : !cert.revoked && (!cert.expires_at || new Date(cert.expires_at) > new Date()))
    : agent.verified
  return {
    trust_score: agent.trust_score ?? 0,
    verified: agent.verified,
    certificate_valid: certValid,
    entity_verified: agent.entity_verified,
    owner_email_verified: agent.owner_email_verified,
    created_at: agent.created_at,
    successful_verifications: agent.successful_verifications ?? 0,
  }
}

function getCertStatus(agent: Agent): 'valid' | 'expired' | 'revoked' {
  const cert = agent.certificate
  if (!cert) return agent.verified ? 'valid' : 'expired'
  if (typeof cert === 'object') {
    if (cert.revoked) return 'revoked'
    if (cert.expires_at && new Date(cert.expires_at) < new Date()) return 'expired'
    if (cert.valid === false) return 'expired'
  }
  return 'valid'
}

function isCertExpiringSoon(agent: Agent): boolean {
  const cert = agent.certificate
  if (!cert || typeof cert !== 'object' || !cert.expires_at) return false
  const expiry = new Date(cert.expires_at)
  const now = new Date()
  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry > 0 && daysUntilExpiry <= 14
}

function getAgentStatus(agent: Agent, lastVerification: string | null): AgentStatus {
  if (isCertExpiringSoon(agent) || getCertStatus(agent) === 'expired') return 'at-risk'
  if (lastVerification) {
    const daysSinceVerification = (Date.now() - new Date(lastVerification).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceVerification <= 7) return 'active'
  }
  if (agent.verified) {
    const daysSinceCreated = (Date.now() - new Date(agent.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreated <= 7) return 'active'
  }
  return 'inactive'
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never'
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function truncateId(id: string): string {
  if (id.length <= 16) return id
  return id.slice(0, 8) + '...' + id.slice(-6)
}

// ─── Icons (inline SVGs matching existing codebase) ──────────────────────────
function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  )
}

// ─── Trust Level Badge ───────────────────────────────────────────────────────
function TrustBadge({ level }: { level: TrustLevel }) {
  const colors = TRUST_COLORS[level]
  const label = `L${level}`
  return (
    <span
      className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full tracking-wider inline-flex items-center gap-1"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 0 8px ${colors.glow}`,
      }}
    >
      {label}
    </span>
  )
}

// ─── Certificate Status Indicator ────────────────────────────────────────────
function CertIndicator({ status }: { status: 'valid' | 'expired' | 'revoked' }) {
  const config = {
    valid:   { color: '#4ade80', label: 'Valid',   dotShadow: '0 0 6px rgba(74,222,128,0.6)' },
    expired: { color: '#f59e0b', label: 'Expired', dotShadow: '0 0 6px rgba(245,158,11,0.6)' },
    revoked: { color: '#ef4444', label: 'Revoked', dotShadow: '0 0 6px rgba(239,68,68,0.6)' },
  }
  const c = config[status]
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: c.color, boxShadow: c.dotShadow }} />
      <span className="text-[10px] font-mono" style={{ color: c.color }}>{c.label}</span>
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AgentStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span
      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full tracking-wider"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {c.label.toUpperCase()}
    </span>
  )
}

// ─── Fleet Health Summary ────────────────────────────────────────────────────
function FleetHealthSummary({
  agents,
  trustLevels,
  statuses,
  complianceScore,
  attentionCount,
}: {
  agents: Agent[]
  trustLevels: Map<string, TrustLevel>
  statuses: Map<string, AgentStatus>
  complianceScore: number
  attentionCount: number
}) {
  const avgTrust = agents.length > 0
    ? Array.from(trustLevels.values()).reduce((sum, l) => sum + l, 0) / agents.length
    : 0

  const cards = [
    {
      label: 'Total Agents',
      value: agents.length.toString(),
      sub: 'Registered in fleet',
      accent: '#7b2fff',
      icon: '🛡️',
    },
    {
      label: 'Avg Trust Level',
      value: `L${avgTrust.toFixed(1)}`,
      sub: TRUST_LEVEL_LABELS[Math.round(avgTrust) as TrustLevel] || 'N/A',
      accent: TRUST_COLORS[Math.round(avgTrust)]?.text || '#00d4ff',
      icon: '📊',
    },
    {
      label: 'Need Attention',
      value: attentionCount.toString(),
      sub: 'Expired certs / at-risk',
      accent: attentionCount > 0 ? '#f59e0b' : '#4ade80',
      icon: '⚠️',
    },
    {
      label: 'Compliance',
      value: `${complianceScore}%`,
      sub: 'Valid cert + recent verify',
      accent: complianceScore >= 80 ? '#4ade80' : complianceScore >= 50 ? '#f59e0b' : '#ef4444',
      icon: '✓',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-xl p-4 overflow-hidden group"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: `1px solid ${card.accent}18`,
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 0% 0%, ${card.accent}08 0%, transparent 60%)` }}
          />
          <div className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background: `linear-gradient(90deg, transparent, ${card.accent}40, transparent)` }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.18em]">{card.label}</div>
              <div className="text-base opacity-50">{card.icon}</div>
            </div>
            <div
              className="text-2xl font-bold font-mono mb-0.5 tabular-nums"
              style={{ color: card.accent, textShadow: `0 0 20px ${card.accent}40` }}
            >
              {card.value}
            </div>
            <div className="text-[10px] text-gray-600">{card.sub}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Trust Level Progress ────────────────────────────────────────────────────
function TrustProgress({ agent, level }: { agent: Agent; level: TrustLevel }) {
  const trustData = getAgentTrustData(agent)
  const reqs = levelUpRequirements(level, trustData)

  if (!reqs.next_level && reqs.next_level !== 0) {
    return (
      <div className="text-[10px] font-mono text-gray-600 flex items-center gap-1.5">
        <span style={{ color: TRUST_COLORS[4].text }}>Maximum trust level reached</span>
      </div>
    )
  }

  const totalReqs = Object.keys(reqs.met).length
  const metCount = Object.values(reqs.met).filter(Boolean).length
  const pct = totalReqs > 0 ? Math.round((metCount / totalReqs) * 100) : 0
  const nextColors = TRUST_COLORS[reqs.next_level]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
          Progress to L{reqs.next_level}
        </span>
        <span className="text-[10px] font-mono" style={{ color: nextColors.text }}>
          {metCount}/{totalReqs}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${nextColors.text}80, ${nextColors.text})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="space-y-1">
        {reqs.requirements.map((req, i) => {
          const metKeys = Object.keys(reqs.met)
          const isMet = metKeys[i] !== undefined ? reqs.met[metKeys[i]] : false
          return (
            <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
              <span style={{ color: isMet ? '#4ade80' : '#6b7280' }}>
                {isMet ? '✓' : '○'}
              </span>
              <span style={{ color: isMet ? '#9ca3af' : '#6b7280' }}>{req}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Agent Row ───────────────────────────────────────────────────────────────
function AgentRow({
  agent,
  trustLevel,
  certStatus,
  status,
  lastVerification,
  expanded,
  onToggle,
  onVerify,
  verifying,
  index,
}: {
  agent: Agent
  trustLevel: TrustLevel
  certStatus: 'valid' | 'expired' | 'revoked'
  status: AgentStatus
  lastVerification: string | null
  expanded: boolean
  onToggle: () => void
  onVerify: () => void
  verifying: boolean
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Main row — clickable */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors hover:bg-white/[0.02]"
      >
        {/* Name + ID column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white truncate">{agent.name}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-[10px] font-mono text-gray-600 truncate">{truncateId(agent.agent_id)}</p>
        </div>

        {/* Capabilities */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0 max-w-[200px] overflow-hidden">
          {(agent.capabilities || []).slice(0, 3).map((cap, i) => (
            <span
              key={i}
              className="text-[9px] px-2 py-0.5 rounded-full font-mono tracking-wide
                bg-purple-500/8 text-purple-300 border border-purple-500/20 whitespace-nowrap"
            >
              {cap}
            </span>
          ))}
          {(agent.capabilities || []).length > 3 && (
            <span className="text-[9px] text-gray-600 font-mono">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>

        {/* Trust level */}
        <div className="flex-shrink-0">
          <TrustBadge level={trustLevel} />
        </div>

        {/* Cert status */}
        <div className="flex-shrink-0 hidden sm:block">
          <CertIndicator status={certStatus} />
        </div>

        {/* Last verified */}
        <div className="flex-shrink-0 hidden lg:block w-20 text-right">
          <span className="text-[10px] font-mono text-gray-500">{formatTimestamp(lastVerification)}</span>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 text-gray-600">
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 pt-1"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: Details */}
                <div className="space-y-4">
                  {/* Info grid */}
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(0,212,255,0.1)',
                    }}
                  >
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Agent ID</div>
                        <div className="text-[11px] font-mono text-gray-300 break-all">{agent.agent_id}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Owner</div>
                        <div className="text-[11px] font-mono text-gray-300 truncate">{agent.owner}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Created</div>
                        <div className="text-[11px] font-mono text-gray-300">
                          {new Date(agent.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Certificate</div>
                        <CertIndicator status={certStatus} />
                      </div>
                      <div>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Trust Score</div>
                        <div className="text-[11px] font-mono text-gray-300">{Math.round((agent.trust_score ?? 0) * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Last Verified</div>
                        <div className="text-[11px] font-mono text-gray-300">{formatTimestamp(lastVerification)}</div>
                      </div>
                    </div>
                  </div>

                  {/* All capabilities */}
                  {(agent.capabilities || []).length > 0 && (
                    <div>
                      <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-2">Capabilities</div>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.capabilities.map((cap, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2.5 py-1 rounded-full font-mono tracking-wide
                              bg-purple-500/8 text-purple-300 border border-purple-500/20"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Trust progress + verify */}
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: `1px solid ${TRUST_COLORS[trustLevel].border}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <TrustBadge level={trustLevel} />
                      <span className="text-[11px] text-gray-400 font-mono">
                        {TRUST_LEVEL_LABELS[trustLevel]}
                      </span>
                    </div>
                    <TrustProgress agent={agent} level={trustLevel} />
                  </div>

                  <motion.button
                    onClick={(e) => { e.stopPropagation(); onVerify() }}
                    disabled={verifying}
                    whileHover={verifying ? {} : { scale: 1.02 }}
                    whileTap={verifying ? {} : { scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(123,47,255,0.12))',
                      border: '1px solid rgba(0,212,255,0.25)',
                      color: '#00d4ff',
                    }}
                  >
                    <RefreshIcon spinning={verifying} />
                    {verifying ? 'Verifying...' : 'Verify Now'}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Navbar (matches main dashboard) ─────────────────────────────────────────
function SignOutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  )
}

function Navbar({ userName, avatarUrl, onSignOut }: { userName: string; avatarUrl?: string; onSignOut: () => void }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background:     'rgba(7,7,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom:   '1px solid rgba(255,255,255,0.05)',
      }}>
      <div className="flex items-center gap-6">
        <a href="/" className="text-lg font-black holo-gradient">AgentID</a>
        <div className="flex gap-1">
          <a href="/dashboard" className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ color: '#6b7280' }}>
            Dashboard
          </a>
          <a href="/dashboard/fleet" className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}>
            Fleet
          </a>
          <a href="/dashboard/connections" className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ color: '#6b7280' }}>
            Connections
          </a>
          <a href="/dashboard/keys" className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ color: '#6b7280' }}>
            API Keys
          </a>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full border border-white/10" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.4), rgba(123,47,255,0.4))', border: '1px solid rgba(0,212,255,0.2)' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm text-gray-400 hidden sm:block max-w-[140px] truncate">{userName}</span>
        <button onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 ml-1">
          <SignOutIcon />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </nav>
  )
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportFleetCSV(
  agents: Agent[],
  trustLevels: Map<string, TrustLevel>,
  statuses: Map<string, AgentStatus>,
  lastVerifications: Map<string, string>,
) {
  const headers = ['Name', 'Agent ID', 'Owner', 'Capabilities', 'Trust Level', 'Trust Score', 'Certificate Status', 'Status', 'Last Verified', 'Created']
  const rows = agents.map(agent => {
    const tl = trustLevels.get(agent.agent_id) ?? 0
    const st = statuses.get(agent.agent_id) ?? 'inactive'
    const lv = lastVerifications.get(agent.agent_id) || ''
    return [
      agent.name,
      agent.agent_id,
      agent.owner,
      (agent.capabilities || []).join('; '),
      `L${tl}`,
      `${Math.round((agent.trust_score ?? 0) * 100)}%`,
      getCertStatus(agent),
      st,
      lv ? new Date(lv).toISOString() : 'Never',
      new Date(agent.created_at).toISOString(),
    ]
  })

  const csv = [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agentid-fleet-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function FleetPage() {
  const [user, setUser]         = useState<any>(null)
  const [agents, setAgents]     = useState<Agent[]>([])
  const [events, setEvents]     = useState<AgentEvent[]>([])
  const [ready, setReady]       = useState(false)
  const [loading, setLoading]   = useState(true)
  const router = useRouter()

  // UI state
  const [search, setSearch]              = useState('')
  const [trustFilters, setTrustFilters]  = useState<Set<number>>(new Set([0, 1, 2, 3, 4]))
  const [statusFilters, setStatusFilters] = useState<Set<AgentStatus>>(() => new Set<AgentStatus>(['active', 'inactive', 'at-risk']))
  const [sortKey, setSortKey]            = useState<SortKey>('name')
  const [sortAsc, setSortAsc]            = useState(true)
  const [expandedId, setExpandedId]      = useState<string | null>(null)
  const [verifyingAll, setVerifyingAll]  = useState(false)
  const [verifyingIds, setVerifyingIds]  = useState<Set<string>>(new Set())

  // ── Auth + data loading ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setReady(true)
        loadData()
      }
      if (event === 'INITIAL_SESSION' && !session) {
        router.push('/login')
      }
      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [agentsRes, eventsRes] = await Promise.all([
        supabase.from('agents').select('*').order('created_at'),
        supabase.from('agent_events').select('*').order('created_at', { ascending: false }).limit(500),
      ])
      if (agentsRes.data) setAgents(agentsRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  // ── Derived data ──
  const lastVerifications = useMemo(() => {
    const map = new Map<string, string>()
    for (const evt of events) {
      if (evt.event_type === 'verification' || evt.event_type === 'verified' || evt.event_type === 'verify') {
        if (!map.has(evt.agent_id)) {
          map.set(evt.agent_id, evt.created_at)
        }
      }
    }
    return map
  }, [events])

  const trustLevels = useMemo(() => {
    const map = new Map<string, TrustLevel>()
    for (const agent of agents) {
      const data = getAgentTrustData(agent)
      map.set(agent.agent_id, calculateTrustLevel(data))
    }
    return map
  }, [agents])

  const statuses = useMemo(() => {
    const map = new Map<string, AgentStatus>()
    for (const agent of agents) {
      map.set(agent.agent_id, getAgentStatus(agent, lastVerifications.get(agent.agent_id) ?? null))
    }
    return map
  }, [agents, lastVerifications])

  const complianceScore = useMemo(() => {
    if (agents.length === 0) return 100
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const compliant = agents.filter(agent => {
      const certOk = getCertStatus(agent) === 'valid'
      const lastV = lastVerifications.get(agent.agent_id)
      const verifyOk = lastV ? new Date(lastV).getTime() > thirtyDaysAgo : false
      return certOk && verifyOk
    }).length
    return Math.round((compliant / agents.length) * 100)
  }, [agents, lastVerifications])

  const attentionCount = useMemo(() => {
    return agents.filter(agent => {
      const cs = getCertStatus(agent)
      const st = statuses.get(agent.agent_id)
      return cs === 'expired' || cs === 'revoked' || st === 'at-risk'
    }).length
  }, [agents, statuses])

  // ── Filtered + sorted agents ──
  const filteredAgents = useMemo(() => {
    let result = [...agents]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(a => a.name.toLowerCase().includes(q))
    }

    // Trust level filter
    result = result.filter(a => trustFilters.has(trustLevels.get(a.agent_id) ?? 0))

    // Status filter
    result = result.filter(a => statusFilters.has(statuses.get(a.agent_id) ?? 'inactive'))

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'trust_level':
          cmp = (trustLevels.get(a.agent_id) ?? 0) - (trustLevels.get(b.agent_id) ?? 0)
          break
        case 'last_verified': {
          const aTime = lastVerifications.get(a.agent_id) ? new Date(lastVerifications.get(a.agent_id)!).getTime() : 0
          const bTime = lastVerifications.get(b.agent_id) ? new Date(lastVerifications.get(b.agent_id)!).getTime() : 0
          cmp = aTime - bTime
          break
        }
      }
      return sortAsc ? cmp : -cmp
    })

    return result
  }, [agents, search, trustFilters, statusFilters, sortKey, sortAsc, trustLevels, statuses, lastVerifications])

  // ── Status counts ──
  const activeCount   = Array.from(statuses.values()).filter(s => s === 'active').length
  const inactiveCount = Array.from(statuses.values()).filter(s => s === 'inactive').length
  const atRiskCount   = Array.from(statuses.values()).filter(s => s === 'at-risk').length

  // ── Actions ──
  async function verifyAgent(agentId: string) {
    setVerifyingIds(prev => new Set(prev).add(agentId))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch('/api/v1/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ agent_id: agentId }),
        })
      }
      await loadData()
    } catch (e) {
      console.error('Verification failed:', e)
    }
    setVerifyingIds(prev => {
      const next = new Set(prev)
      next.delete(agentId)
      return next
    })
  }

  async function verifyAll() {
    setVerifyingAll(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await Promise.allSettled(
          agents.map(agent =>
            fetch('/api/v1/verify', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ agent_id: agent.agent_id }),
            })
          )
        )
      }
      await loadData()
    } catch (e) {
      console.error('Bulk verification failed:', e)
    }
    setVerifyingAll(false)
  }

  function toggleTrustFilter(level: number) {
    setTrustFilters(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  function toggleStatusFilter(status: AgentStatus) {
    setStatusFilters(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const userName  = user?.user_metadata?.user_name || user?.user_metadata?.full_name || user?.email || 'Agent'
  const avatarUrl = user?.user_metadata?.avatar_url

  // ── Loading state ──
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}>
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 mx-auto mb-4 rounded-full"
            style={{
              border:    '2px solid rgba(0,212,255,0.12)',
              borderTop: '2px solid #00d4ff',
              boxShadow: '0 0 20px rgba(0,212,255,0.2)',
            }}
          />
          <p className="text-gray-600 text-sm font-mono">Authenticating...</p>
        </div>
      </div>
    )
  }

  // ── Page ──
  return (
    <div className="min-h-screen grid-bg" style={{ background: '#07070f' }}>
      <Navbar userName={userName} avatarUrl={avatarUrl} onSignOut={handleSignOut} />

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-24 pb-16">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-black text-white">Fleet Management</h1>
            <p className="text-xs text-gray-600 mt-1">
              Monitor, verify, and manage all your agents from one view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-gray-600 font-mono">
              {agents.length} AGENT{agents.length !== 1 ? 'S' : ''}
            </span>
          </div>
        </motion.div>

        {/* ── Fleet Health Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <FleetHealthSummary
            agents={agents}
            trustLevels={trustLevels}
            statuses={statuses}
            complianceScore={complianceScore}
            attentionCount={attentionCount}
          />
        </motion.div>

        {/* ── Bulk Actions Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Summary */}
          <div className="text-xs text-gray-400 font-mono">
            <span className="text-white font-bold">{agents.length}</span> agents:
            <span className="text-green-400 ml-2">{activeCount} active</span>
            <span className="text-gray-500">, </span>
            <span className="text-gray-500">{inactiveCount} inactive</span>
            {atRiskCount > 0 && (
              <>
                <span className="text-gray-500">, </span>
                <span className="text-amber-400">{atRiskCount} at-risk</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={verifyAll}
              disabled={verifyingAll || agents.length === 0}
              whileHover={verifyingAll ? {} : { scale: 1.02 }}
              whileTap={verifyingAll ? {} : { scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(123,47,255,0.12))',
                border: '1px solid rgba(0,212,255,0.25)',
                color: '#00d4ff',
              }}
            >
              <ShieldIcon />
              {verifyingAll ? 'Verifying All...' : 'Verify All'}
            </motion.button>

            <motion.button
              onClick={() => exportFleetCSV(agents, trustLevels, statuses, lastVerifications)}
              disabled={agents.length === 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#9ca3af',
              }}
            >
              <DownloadIcon />
              Export Fleet
            </motion.button>
          </div>
        </motion.div>

        {/* ── Search + Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl p-4 mb-6 space-y-4"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Search bar */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search agents by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm input-field"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Trust level filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Trust:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(level => {
                  const colors = TRUST_COLORS[level]
                  const active = trustFilters.has(level)
                  return (
                    <button
                      key={level}
                      onClick={() => toggleTrustFilter(level)}
                      className="text-[10px] font-mono font-bold px-2 py-1 rounded-md transition-all"
                      style={{
                        background: active ? colors.bg : 'transparent',
                        color: active ? colors.text : '#4b5563',
                        border: `1px solid ${active ? colors.border : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      L{level}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Status:</span>
              <div className="flex gap-1">
                {(['active', 'inactive', 'at-risk'] as AgentStatus[]).map(status => {
                  const c = STATUS_CONFIG[status]
                  const active = statusFilters.has(status)
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status)}
                      className="text-[10px] font-mono font-semibold px-2 py-1 rounded-md transition-all"
                      style={{
                        background: active ? c.bg : 'transparent',
                        color: active ? c.color : '#4b5563',
                        border: `1px solid ${active ? c.border : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Sort:</span>
              <div className="flex gap-1">
                {([
                  { key: 'name' as SortKey, label: 'Name' },
                  { key: 'trust_level' as SortKey, label: 'Trust' },
                  { key: 'last_verified' as SortKey, label: 'Verified' },
                ]).map(item => {
                  const isActive = sortKey === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleSort(item.key)}
                      className="text-[10px] font-mono px-2 py-1 rounded-md transition-all flex items-center gap-1"
                      style={{
                        background: isActive ? 'rgba(0,212,255,0.08)' : 'transparent',
                        color: isActive ? '#00d4ff' : '#6b7280',
                        border: `1px solid ${isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      {item.label}
                      {isActive && (
                        <span className="text-[8px]">{sortAsc ? '↑' : '↓'}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Agents List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full"
              style={{
                border:    '2px solid rgba(0,212,255,0.12)',
                borderTop: '2px solid #00d4ff',
                boxShadow: '0 0 20px rgba(0,212,255,0.2)',
              }}
            />
          </div>
        ) : filteredAgents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-12 text-center"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}
            >
              {agents.length === 0 ? '🛡️' : '🔍'}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {agents.length === 0 ? 'No agents in your fleet' : 'No agents match your filters'}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
              {agents.length === 0
                ? 'Register your first agent to start building your fleet.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {agents.length === 0 && (
              <a
                href="/docs"
                className="inline-block mt-6 text-cyan-500 text-sm hover:text-cyan-300 transition-colors font-medium"
              >
                Read the documentation
              </a>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            {filteredAgents.map((agent, i) => (
              <AgentRow
                key={agent.agent_id}
                agent={agent}
                trustLevel={trustLevels.get(agent.agent_id) ?? TrustLevel.L1_REGISTERED}
                certStatus={getCertStatus(agent)}
                status={statuses.get(agent.agent_id) ?? 'inactive'}
                lastVerification={lastVerifications.get(agent.agent_id) ?? null}
                expanded={expandedId === agent.agent_id}
                onToggle={() => setExpandedId(expandedId === agent.agent_id ? null : agent.agent_id)}
                onVerify={() => verifyAgent(agent.agent_id)}
                verifying={verifyingIds.has(agent.agent_id)}
                index={i}
              />
            ))}
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center py-10 mt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-gray-700 text-xs font-mono">AgentID Fleet Management</p>
        </div>
      </div>
    </div>
  )
}
