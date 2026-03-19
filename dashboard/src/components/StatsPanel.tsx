'use client'

import { motion } from 'framer-motion'

interface StatProps {
  label: string
  value: string
  sub?: string
  accent?: string
  delay?: number
  icon?: string
}

function StatCard({ label, value, sub, accent = '#00d4ff', delay = 0, icon }: StatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl p-4 overflow-hidden group"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border:     `1px solid ${accent}18`,
        boxShadow:  `0 0 0 0 ${accent}00`,
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}
      whileHover={{
        boxShadow: `0 0 24px ${accent}18`,
        borderColor: `${accent}35`,
      } as any}
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 0% 0%, ${accent}08 0%, transparent 60%)` }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.18em]">
            {label}
          </div>
          {icon && (
            <div className="text-base opacity-50">{icon}</div>
          )}
        </div>
        <div
          className="text-2xl font-bold font-mono mb-0.5 tabular-nums"
          style={{ color: accent, textShadow: `0 0 20px ${accent}40` }}
        >
          {value}
        </div>
        {sub && (
          <div className="text-[10px] text-gray-600">{sub}</div>
        )}
      </div>
    </motion.div>
  )
}

export default function StatsPanel({ agents, events }: { agents: any[]; events: any[] }) {
  const online = agents.filter(a => {
    if (!a.last_active) return false
    return (Date.now() - new Date(a.last_active).getTime()) < 600000
  }).length

  const totalEvents = events.length
  const recentEvents = events.filter(e => {
    return (Date.now() - new Date(e.created_at).getTime()) < 86400000
  }).length

  const verifiedCount = agents.filter(a => a.verified).length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Total Agents"
        value={agents.length.toString()}
        sub="Registered & certified"
        accent="#7b2fff"
        icon="🔐"
        delay={0}
      />
      <StatCard
        label="Online Now"
        value={`${online}/${agents.length}`}
        sub="Active heartbeats"
        accent={online > 0 ? '#00e676' : '#ff5252'}
        icon="📡"
        delay={0.08}
      />
      <StatCard
        label="Events Today"
        value={recentEvents.toString()}
        sub="Last 24 hours"
        accent="#00d4ff"
        icon="⚡"
        delay={0.16}
      />
      <StatCard
        label="Verified"
        value={verifiedCount.toString()}
        sub={`of ${agents.length} total`}
        accent="#ff9500"
        icon="✓"
        delay={0.24}
      />
    </div>
  )
}
