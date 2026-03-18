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

export default function AgentPassport({ agent, index }: { agent: Agent; index: number }) {
  const isOnline = agent.last_active
    ? (Date.now() - new Date(agent.last_active).getTime()) < 600000 // 10 min
    : false

  const platformIcon: Record<string, string> = {
    telegram: '🤖',
    web: '🌐',
    api: '⚡',
    local: '💻',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.15, duration: 0.6 }}
      whileHover={{ scale: 1.02, rotateY: 2 }}
      className="passport-card p-6 relative"
    >
      {/* Holographic overlay */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="scan-overlay absolute inset-0" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{platformIcon[agent.platform || ''] || '🔮'}</div>
            <div>
              <h3 className="text-lg font-bold text-white">{agent.name}</h3>
              <p className="text-xs text-gray-500 font-mono">{agent.agent_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`heartbeat ${isOnline ? 'online' : 'offline'}`} />
            <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Agent ID Badge */}
        <div className="bg-black/40 rounded-lg p-3 mb-4 border border-cyan-900/30">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">CERTIFICATE ID</span>
            <span className="text-xs text-cyan-400 font-mono">VERIFIED ✓</span>
          </div>
          <div className="text-sm font-mono text-cyan-300 mt-1 tracking-wider">
            {agent.agent_id.toUpperCase()}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 mb-4">{agent.description}</p>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-2 mb-4">
          {agent.capabilities?.map((cap: string, i: number) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10"
            >
              {cap}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span>Owner: {agent.owner}</span>
          <span>Trust: {(agent.trust_score * 100).toFixed(0)}%</span>
        </div>

        {/* Holographic stamp */}
        <motion.div
          className="absolute top-4 right-4 w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <div className="text-[8px] text-cyan-500/40 text-center leading-tight">
            AGENT<br/>ID<br/>CERT
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
