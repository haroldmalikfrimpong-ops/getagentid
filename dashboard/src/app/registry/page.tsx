'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function RegistryPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/v1/agents/discover?limit=100')
      .then(r => r.json())
      .then(data => { setAgents(data.agents || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = search
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.owner.toLowerCase().includes(search.toLowerCase()) ||
        a.capabilities?.some((c: string) => c.toLowerCase().includes(search.toLowerCase()))
      )
    : agents

  return (
    <div className="min-h-screen pt-20 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
            Public Registry
          </div>
          <h1 className="text-4xl font-black mb-3">
            <span className="holo-gradient">Verified Agents</span>
          </h1>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            Browse all agents registered on AgentID. Click any agent to verify its identity.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, owner, or capability..."
              className="w-full rounded-xl px-5 py-3 text-sm text-white focus:outline-none"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,212,255,0.15)',
              }}
            />
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-8 mb-10">
          <div className="text-center">
            <div className="text-2xl font-black text-cyan-400 font-mono">{agents.length}</div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider">Registered</div>
          </div>
          <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="text-center">
            <div className="text-2xl font-black text-green-400 font-mono">
              {agents.filter(a => a.last_active && (Date.now() - new Date(a.last_active).getTime()) < 3600000).length}
            </div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider">Online</div>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4" />
            <p className="text-gray-600 text-sm">Loading registry...</p>
          </div>
        )}

        {/* Agent grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((agent, i) => {
              const isOnline = agent.last_active && (Date.now() - new Date(agent.last_active).getTime()) < 3600000
              const created = new Date(agent.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

              return (
                <motion.a
                  key={agent.agent_id}
                  href={`/verify/${agent.agent_id}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-2xl p-5 transition-all cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                  whileHover={{ borderColor: 'rgba(0,212,255,0.3)', boxShadow: '0 0 30px rgba(0,212,255,0.06)' } as any}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">{agent.name}</h3>
                      <p className="text-xs text-gray-600 font-mono mt-0.5">{agent.agent_id}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-700'}`} />
                      <span className={`text-[10px] font-mono ${isOnline ? 'text-green-400' : 'text-gray-600'}`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{agent.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {agent.capabilities?.slice(0, 3).map((cap: string, j: number) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                          style={{ background: 'rgba(123,47,255,0.08)', color: 'rgba(123,47,255,0.7)', border: '1px solid rgba(123,47,255,0.15)' }}>
                          {cap}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      <span className="text-gray-500">{agent.owner}</span> · {created}
                    </div>
                  </div>

                  {/* Verify hint */}
                  <div className="mt-3 pt-3 flex items-center justify-between"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-[10px] text-cyan-500/50 font-mono group-hover:text-cyan-400 transition-colors">
                      Click to verify →
                    </span>
                    <span className="text-[10px] text-gray-700 font-mono">
                      {agent.platform || 'API'}
                    </span>
                  </div>
                </motion.a>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-3xl mb-3 opacity-30">🔍</div>
            <p className="text-gray-600 text-sm">No agents found</p>
          </div>
        )}

        {/* Register CTA */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center mt-16 py-12 rounded-2xl"
          style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}>
          <h3 className="text-xl font-bold text-white mb-2">Register your agent</h3>
          <p className="text-gray-500 text-sm mb-6">Get a verified identity passport for your AI agent</p>
          <a href="/signup" className="px-8 py-3 rounded-full text-white text-sm font-bold inline-block"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
            Get Started Free
          </a>
        </motion.div>
      </div>
    </div>
  )
}
