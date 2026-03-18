'use client'

import { motion } from 'framer-motion'

interface StatProps {
  label: string
  value: string
  sub?: string
  color?: string
  delay?: number
}

function StatCard({ label, value, sub, color = 'cyan', delay = 0 }: StatProps) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
    green: 'text-green-400 border-green-500/20 bg-green-500/5',
    red: 'text-red-400 border-red-500/20 bg-red-500/5',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      className={`rounded-xl border p-4 ${colors[color]}`}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color].split(' ')[0]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Agents"
        value={agents.length.toString()}
        sub="Registered on AgentID"
        color="purple"
        delay={0}
      />
      <StatCard
        label="Online Now"
        value={`${online}/${agents.length}`}
        sub="Active heartbeats"
        color={online > 0 ? 'green' : 'red'}
        delay={0.1}
      />
      <StatCard
        label="Events Today"
        value={recentEvents.toString()}
        sub="Agent activities"
        color="cyan"
        delay={0.2}
      />
      <StatCard
        label="Total Events"
        value={totalEvents.toString()}
        sub="All time"
        color="orange"
        delay={0.3}
      />
    </div>
  )
}
