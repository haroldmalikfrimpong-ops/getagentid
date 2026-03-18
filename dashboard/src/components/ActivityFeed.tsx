'use client'

import { motion } from 'framer-motion'

interface Event {
  id: number
  agent_id: string
  event_type: string
  data: any
  created_at: string
}

export default function ActivityFeed({ events, agents }: { events: Event[]; agents: any[] }) {
  const agentNames: Record<string, string> = {}
  agents.forEach(a => { agentNames[a.agent_id] = a.name })

  const typeColors: Record<string, string> = {
    trade_opened: 'text-green-400',
    trade_closed: 'text-red-400',
    heartbeat: 'text-gray-500',
    scan: 'text-cyan-400',
    deploy: 'text-purple-400',
  }

  const typeIcons: Record<string, string> = {
    trade_opened: '📈',
    trade_closed: '📉',
    heartbeat: '💓',
    scan: '🔍',
    deploy: '🚀',
  }

  const recent = events.slice(0, 20)

  return (
    <div className="glow-border rounded-xl p-5 bg-[#111118]">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
        Live Activity Feed
      </h2>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {recent.length === 0 && (
          <p className="text-gray-600 text-sm">No activity yet — agents will report here</p>
        )}
        {recent.map((event, i) => {
          const name = agentNames[event.agent_id] || event.agent_id
          const age = Date.now() - new Date(event.created_at).getTime()
          const ageStr = age < 60000 ? 'now' :
            age < 3600000 ? `${Math.floor(age / 60000)}m ago` :
            age < 86400000 ? `${Math.floor(age / 3600000)}h ago` :
            `${Math.floor(age / 86400000)}d ago`

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 text-sm py-2 border-b border-white/5"
            >
              <span className="text-lg">{typeIcons[event.event_type] || '⚡'}</span>
              <span className={`font-mono ${typeColors[event.event_type] || 'text-gray-400'}`}>
                {event.event_type}
              </span>
              <span className="text-gray-500">—</span>
              <span className="text-white">{name}</span>
              <span className="text-gray-600 ml-auto text-xs">{ageStr}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
