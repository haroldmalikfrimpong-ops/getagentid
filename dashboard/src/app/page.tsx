'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import AgentPassport from '@/components/AgentPassport'
import StatsPanel from '@/components/StatsPanel'
import ActivityFeed from '@/components/ActivityFeed'

export default function Dashboard() {
  const [agents, setAgents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30s
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
    <div className="min-h-screen p-6 md:p-10">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-10"
      >
        <div>
          <h1 className="text-3xl font-bold">
            <span className="holo-gradient">AgentID</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Command Center — getagentid.dev</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-cyan-400">
            {time.toLocaleTimeString('en-GB', { hour12: false })}
          </div>
          <div className="text-xs text-gray-600">
            {time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </motion.header>

      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center h-64"
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4"
            />
            <p className="text-gray-500">Initializing systems...</p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Stats */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <StatsPanel agents={agents} events={events} />
          </motion.section>

          {/* Agent Passports */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Registered Agents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent, i) => (
                <AgentPassport key={agent.agent_id} agent={agent} index={i} />
              ))}
            </div>
          </motion.section>

          {/* Activity Feed + Transactions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <ActivityFeed events={events} agents={agents} />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="glow-border rounded-xl p-5 bg-[#111118]"
            >
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                Recent Transactions
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
                      {tx.currency} {tx.amount > 0 ? '+' : ''}{tx.amount?.toFixed(2)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-10 text-center text-gray-600 text-xs"
          >
            <p>AgentID — The Identity & Discovery Layer for AI Agents</p>
            <p className="mt-1">getagentid.dev | All systems operational</p>
          </motion.footer>
        </>
      )}
    </div>
  )
}
