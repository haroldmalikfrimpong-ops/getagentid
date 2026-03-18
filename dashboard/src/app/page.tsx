'use client'

import { useEffect, useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import AgentPassport from '@/components/AgentPassport'
import StatsPanel from '@/components/StatsPanel'
import ActivityFeed from '@/components/ActivityFeed'

const Scene3D = dynamic(() => import('@/components/Scene3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-cyan-500/50 font-mono text-sm">Loading 3D scene...</p>
    </div>
  ),
})

export default function Dashboard() {
  const [agents, setAgents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    const clock = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(interval); clearInterval(clock) }
  }, [])

  async function loadData() {
    try {
      const [agentsRes, eventsRes, txRes] = await Promise.all([
        supabase.from('agents').select('*').order('created_at'),
        supabase.from('agent_events').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(20),
      ])
      if (agentsRes.data) setAgents(agentsRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
      if (txRes.data) setTransactions(txRes.data)
    } catch (e) {
      console.error('Failed to load data:', e)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        {/* 3D Scene */}
        <Scene3D agents={agents} />

        {/* Floating header overlay */}
        <div className="absolute top-6 left-6 z-10">
          <motion.h1
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-black"
          >
            <span className="holo-gradient">AgentID</span>
          </motion.h1>
          <motion.p
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-500 text-sm mt-1"
          >
            Command Center
          </motion.p>
        </div>

        {/* Clock */}
        <div className="absolute top-6 right-6 z-10 text-right">
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-mono text-cyan-400 tracking-wider"
          >
            {time.toLocaleTimeString('en-GB', { hour12: false })}
          </motion.div>
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-gray-600"
          >
            {time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="px-6 md:px-10 pb-10">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center h-32"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-3"
              />
              <p className="text-gray-500 text-sm">Initializing systems...</p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Stats */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mb-8"
            >
              <StatsPanel agents={agents} events={events} />
            </motion.section>

            {/* Agent Passports */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em]">
                  Registered Agents
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agents.map((agent, i) => (
                  <AgentPassport key={agent.agent_id} agent={agent} index={i} />
                ))}
              </div>
            </motion.section>

            {/* Activity + Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              <ActivityFeed events={events} agents={agents} />

              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Agent Transactions
                </h2>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transactions.length === 0 && (
                    <p className="text-gray-600 text-sm">No transactions yet</p>
                  )}
                  {transactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between py-2 border-b border-white/5 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className={tx.type === 'entry' ? 'text-green-400' : 'text-red-400'}>
                          {tx.type === 'entry' ? '📈' : tx.type === 'close' ? '📉' : '💰'}
                        </span>
                        <div>
                          <div className="text-white">{tx.vendor || tx.description || tx.type}</div>
                          <div className="text-xs text-gray-600">{tx.category}</div>
                        </div>
                      </div>
                      <div className={`font-mono ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.currency} {tx.amount?.toFixed(2)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Footer */}
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-center py-8 border-t border-white/5"
            >
              <p className="holo-gradient text-lg font-bold mb-1">AgentID</p>
              <p className="text-gray-600 text-xs">The Identity & Discovery Layer for AI Agents</p>
              <p className="text-gray-700 text-xs mt-1">getagentid.dev — All systems operational</p>
            </motion.footer>
          </>
        )}
      </div>
    </div>
  )
}
