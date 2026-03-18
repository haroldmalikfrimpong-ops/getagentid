'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import AgentPassport from '@/components/AgentPassport'
import StatsPanel from '@/components/StatsPanel'
import ActivityFeed from '@/components/ActivityFeed'

export default function DashboardPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState('')

  useEffect(() => {
    setMounted(true)
    loadData()
    const interval = setInterval(loadData, 30000)
    const clock = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000)
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
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (!mounted) return null
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen p-6 md:p-10">
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold"><span className="holo-gradient">AgentID</span></h1>
          <p className="text-gray-500 text-sm mt-1">Command Center</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-cyan-400">{time}</div>
          <div className="text-xs text-gray-600">{dateStr}</div>
        </div>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
        </div>
      ) : (
        <>
          <StatsPanel agents={agents} events={events} />

          <div className="flex items-center gap-3 my-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em]">Registered Agents</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {agents.map((agent, i) => <AgentPassport key={agent.agent_id} agent={agent} index={i} />)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ActivityFeed events={events} agents={agents} />
            <div className="glow-border rounded-xl p-5 bg-[#111118]">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Transactions</h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {transactions.length === 0 && <p className="text-gray-600 text-sm">No transactions yet</p>}
                {transactions.map((tx, i) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                    <div className="flex items-center gap-3">
                      <span>{tx.type === 'entry' ? '📈' : '📉'}</span>
                      <div>
                        <div className="text-white">{tx.vendor || tx.type}</div>
                        <div className="text-xs text-gray-600">{tx.category}</div>
                      </div>
                    </div>
                    <div className={`font-mono ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.currency} {tx.amount?.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
