'use client'

import { motion } from 'framer-motion'

interface Agent {
  agent_id: string
  name: string
  description: string
  owner: string
  capabilities: string[]
  platform: string | null
  trust_score: number
  verified: boolean
  active: boolean
  last_active: string | null
  created_at: string
}

const PLATFORM_ICONS: Record<string, string> = {
  telegram: '🤖',
  web:      '🌐',
  api:      '⚡',
  local:    '💻',
}

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? '#00e676' : pct >= 50 ? '#ffb300' : '#ff5252'
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-mono text-gray-500 tracking-wider">TRUST SCORE</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export default function AgentPassport({ agent, index }: { agent: Agent; index: number }) {
  const isOnline = agent.last_active
    ? (Date.now() - new Date(agent.last_active).getTime()) < 600000
    : false

  const issuedDate = new Date(agent.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const expiryDate = new Date(
    new Date(agent.created_at).getTime() + 365 * 24 * 60 * 60 * 1000 * 2
  ).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Shorten agent_id for display
  const shortId = agent.agent_id.length > 20
    ? agent.agent_id.slice(0, 8) + '…' + agent.agent_id.slice(-6)
    : agent.agent_id

  const mrzLine1 = `AGENT<${(agent.name || '').replace(/\s/g, '<').toUpperCase().padEnd(28, '<').slice(0, 28)}`
  const mrzLine2 = `${agent.agent_id.replace(/-/g, '').toUpperCase().padEnd(30, '<').slice(0, 30)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.015, rotateY: 1.5 }}
      style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
      className="passport-card relative group"
    >
      {/* Scan line */}
      <div className="scan-overlay absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none" />

      {/* Holographic shimmer strip */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-6">

        {/* ── Passport Header ── */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl
              bg-gradient-to-br from-white/5 to-white/[0.02]
              border border-white/10 shadow-inner"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              {PLATFORM_ICONS[agent.platform || ''] ?? '🔮'}
            </div>
            <div>
              <div className="text-[9px] font-mono text-gray-500 tracking-[0.25em] uppercase mb-0.5">
                AgentID Passport
              </div>
              <h3 className="text-base font-bold text-white leading-snug">{agent.name}</h3>
              <p className="text-[10px] font-mono text-gray-600 mt-0.5 truncate max-w-[160px]">
                {shortId}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className={`heartbeat ${isOnline ? 'online' : 'offline'}`} />
              <span className={`text-[10px] font-mono font-semibold tracking-wider ${
                isOnline ? 'text-green-400' : 'text-gray-500'
              }`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            {agent.verified && (
              <div className="text-[9px] px-2 py-0.5 rounded-full font-mono tracking-wider
                bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                VERIFIED ✓
              </div>
            )}
          </div>
        </div>

        {/* ── Certificate Block ── */}
        <div className="rounded-xl p-3.5 mb-4"
          style={{
            background:  'rgba(0,0,0,0.4)',
            border:      '1px solid rgba(0,212,255,0.1)',
            boxShadow:   'inset 0 1px 0 rgba(0,212,255,0.05)',
          }}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Owner</div>
              <div className="text-[11px] font-mono text-gray-300 truncate">{agent.owner}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Platform</div>
              <div className="text-[11px] font-mono text-gray-300 capitalize">{agent.platform || 'API'}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Issued</div>
              <div className="text-[11px] font-mono text-gray-300">{issuedDate}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Expires</div>
              <div className="text-[11px] font-mono text-gray-300">{expiryDate}</div>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        {agent.description && (
          <p className="text-xs text-gray-500 mb-4 leading-relaxed line-clamp-2">
            {agent.description}
          </p>
        )}

        {/* ── Capabilities ── */}
        {agent.capabilities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {agent.capabilities.map((cap, i) => (
              <span key={i}
                className="text-[10px] px-2.5 py-1 rounded-full font-mono tracking-wide
                  bg-purple-500/8 text-purple-300 border border-purple-500/20
                  transition-colors hover:border-purple-400/40 hover:text-purple-200">
                {cap}
              </span>
            ))}
          </div>
        )}

        {/* ── Trust score bar ── */}
        <div className="mb-4">
          <TrustBar score={agent.trust_score ?? 0} />
        </div>

        {/* Holographic stamp */}
        <motion.div
          className="absolute bottom-14 right-5 w-14 h-14 rounded-full pointer-events-none"
          style={{
            border:   '1px solid rgba(0,212,255,0.12)',
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(0,212,255,0.04) 90deg, transparent 180deg, rgba(123,47,255,0.04) 270deg, transparent 360deg)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[7px] font-mono text-cyan-500/30 text-center leading-tight tracking-widest">
              AGENT<br />ID<br />CERT
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── MRZ strip (machine-readable zone) ── */}
      <div className="passport-mrz px-6 py-2.5 rounded-b-[20px] overflow-hidden">
        <div className="truncate opacity-60 text-[9px]">{mrzLine1}</div>
        <div className="truncate opacity-40 text-[9px]">{mrzLine2}</div>
      </div>
    </motion.div>
  )
}
