'use client'

import { motion } from 'framer-motion'

interface Event {
  id: number
  agent_id: string
  event_type: string
  data: any
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  trade_opened:  '#00e676',
  trade_closed:  '#ff5252',
  heartbeat:     '#555',
  scan:          '#00d4ff',
  deploy:        '#7b2fff',
  verify:        '#ffb300',
  register:      '#00d4ff',
}

const TYPE_ICONS: Record<string, string> = {
  trade_opened:  '📈',
  trade_closed:  '📉',
  heartbeat:     '♡',
  scan:          '🔍',
  deploy:        '🚀',
  verify:        '✓',
  register:      '🔐',
}

function ageString(ms: number): string {
  if (ms < 60_000)       return 'just now'
  if (ms < 3_600_000)    return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000)   return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export default function ActivityFeed({ events, agents }: { events: Event[]; agents: any[] }) {
  const agentNames: Record<string, string> = {}
  agents.forEach(a => { agentNames[a.agent_id] = a.name })

  const recent = events.slice(0, 20)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Top accent */}
      <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(123,47,255,0.25), transparent)' }} />

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.2em]">
            Live Activity
          </h2>
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] text-gray-600 font-mono">LIVE</span>
          </div>
        </div>

        <div className="space-y-0.5 max-h-[380px] overflow-y-auto pr-1">
          {recent.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-2xl mb-3 opacity-30">⚡</div>
              <p className="text-gray-700 text-sm">No activity yet</p>
              <p className="text-gray-700 text-xs mt-1">Events will appear here as agents report in</p>
            </div>
          )}

          {recent.map((event, i) => {
            const name  = agentNames[event.agent_id] || event.agent_id
            const age   = Date.now() - new Date(event.created_at).getTime()
            const color = TYPE_COLORS[event.event_type] || '#888'
            const icon  = TYPE_ICONS[event.event_type] || '⚡'

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors hover:bg-white/[0.02] group"
              >
                {/* Icon dot */}
                <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: `${color}10`, border: `1px solid ${color}18` }}>
                  {icon}
                </div>

                {/* Event type */}
                <span className="text-xs font-mono font-medium flex-shrink-0"
                  style={{ color }}>
                  {event.event_type}
                </span>

                {/* Agent name */}
                <span className="text-xs text-gray-400 truncate flex-1 min-w-0">
                  {name}
                </span>

                {/* Age */}
                <span className="text-[10px] text-gray-700 font-mono flex-shrink-0">
                  {ageString(age)}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
