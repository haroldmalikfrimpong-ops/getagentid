'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase, getUser, signOut } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgentPassport from '@/components/AgentPassport'
import StatsPanel from '@/components/StatsPanel'
import ActivityFeed from '@/components/ActivityFeed'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [time, setTime] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    const clock = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000)

    // Listen for auth changes (handles OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user)
        loadData()
      }
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })

    return () => { clearInterval(clock); subscription.unsubscribe() }
  }, [])

  async function checkAuth() {
    const u = await getUser()
    if (!u) {
      router.push('/login')
      return
    }
    setUser(u)
    await loadData()
    setLoading(false)
  }

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
  }

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    )
  }

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen p-6 md:p-10">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold"><span className="holo-gradient">AgentID</span></h1>
          <p className="text-gray-500 text-sm mt-1">Command Center</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xl font-mono text-cyan-400">{time}</div>
            <div className="text-xs text-gray-600">{dateStr}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white">{user?.email || user?.user_metadata?.user_name}</div>
            <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-red-400">Sign out</button>
          </div>
        </div>
      </motion.header>

      {/* Stats */}
      <StatsPanel agents={agents} events={events} />

      {/* Agents */}
      <div className="flex items-center gap-3 my-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em]">Your Agents</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>

      {agents.length === 0 ? (
        <div className="glow-border rounded-xl p-12 bg-[#111118] text-center">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-xl font-bold text-white mb-2">No agents yet</h3>
          <p className="text-gray-500 text-sm mb-6">Register your first agent to get started</p>
          <code className="text-cyan-400 font-mono text-sm bg-black/40 px-4 py-2 rounded-lg">
            pip install agentid
          </code>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {agents.map((agent, i) => <AgentPassport key={agent.agent_id} agent={agent} index={i} />)}
        </div>
      )}

      {/* Activity + Transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <ActivityFeed events={events} agents={agents} />
        <div className="glow-border rounded-xl p-5 bg-[#111118]">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Transactions</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {transactions.length === 0 && <p className="text-gray-600 text-sm">No transactions yet</p>}
            {transactions.map((tx) => (
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
    </div>
  )
}
