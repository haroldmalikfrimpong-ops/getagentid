'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgentPassport from '@/components/AgentPassport'
import StatsPanel from '@/components/StatsPanel'
import ActivityFeed from '@/components/ActivityFeed'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [agents, setAgents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [time, setTime] = useState('')
  const [ready, setReady] = useState(false)
  const [plan, setPlan] = useState('free')
  const [agentLimit, setAgentLimit] = useState(5)
  const [upgrading, setUpgrading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const clock = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000)

    // This handles EVERYTHING — initial load, OAuth redirects, existing sessions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsNew(event === 'SIGNED_IN')
        setReady(true)
        loadData()
        loadProfile()
      }
      // Only redirect if we get INITIAL_SESSION with no user (meaning no session at all)
      // Don't redirect on SIGNED_OUT during page load
      if (event === 'INITIAL_SESSION' && !session) {
        router.push('/login')
      }
      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })

    return () => { clearInterval(clock); subscription.unsubscribe() }
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
  }

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').single()
    if (data) {
      setPlan(data.plan || 'free')
      setAgentLimit(data.agent_limit || 5)
    }
  }

  async function handleUpgrade(planName: string) {
    setUpgrading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planName }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) { console.error(e) }
    setUpgrading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const userName = user?.user_metadata?.user_name || user?.user_metadata?.full_name || user?.email || 'Agent'
  const avatarUrl = user?.user_metadata?.avatar_url
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Not ready yet — show loading
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Authenticating...</p>
        </div>
      </div>
    )
  }

  // Welcome screen — only shows once on first sign in
  if (isNew) {
    setTimeout(() => setIsNew(false), 2500)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }} className="mb-6">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full border-2 border-cyan-500/30 mx-auto" />
            ) : (
              <div className="text-6xl">✓</div>
            )}
          </motion.div>
          <h1 className="text-3xl font-black mb-2"><span className="holo-gradient">Welcome, {userName}!</span></h1>
          <p className="text-gray-500">Your AgentID command center is ready.</p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-4 text-xs text-cyan-500/50 font-mono">
            Loading dashboard...
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Dashboard
  return (
    <div className="min-h-screen p-6 md:p-10">
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
        <div>
          <a href="/"><h1 className="text-3xl font-bold"><span className="holo-gradient">AgentID</span></h1></a>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-gray-500 text-sm">Command Center</p>
            <a href="/dashboard/keys" className="text-xs text-cyan-500/50 hover:text-cyan-400">API Keys</a>
            <a href="/docs" className="text-xs text-cyan-500/50 hover:text-cyan-400">Docs</a>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <div className="text-xl font-mono text-cyan-400">{time}</div>
            <div className="text-xs text-gray-600">{dateStr}</div>
          </div>
          <div className="flex items-center gap-3">
            {avatarUrl && <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full border border-cyan-500/30" />}
            <div className="text-right">
              <div className="text-sm text-white">{userName}</div>
              <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Plan bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center justify-between glow-border rounded-xl p-4 bg-[#111118] mb-8">
        <div className="flex items-center gap-4">
          <span className={`text-xs font-mono px-3 py-1 rounded-full ${plan === 'free' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
            {plan.toUpperCase()}
          </span>
          <span className="text-sm text-gray-400">
            {agents.length}/{agentLimit} agents
          </span>
        </div>
        {plan === 'free' && (
          <button onClick={() => handleUpgrade('startup')} disabled={upgrading}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white text-xs font-bold disabled:opacity-50">
            {upgrading ? 'Loading...' : 'Upgrade to Startup — $49/mo'}
          </button>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <StatsPanel agents={agents} events={events} />
      </motion.div>

      <div className="flex items-center gap-3 my-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em]">Your Agents</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>

      {agents.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glow-border rounded-xl p-12 bg-[#111118] text-center">
          <div className="text-5xl mb-4">🛂</div>
          <h3 className="text-xl font-bold text-white mb-2">No agents registered</h3>
          <p className="text-gray-500 text-sm mb-6">Register your first agent to get its identity passport</p>
          <div className="bg-black/40 rounded-lg p-4 inline-block text-left">
            <div className="text-xs text-gray-500 mb-2">Install the SDK:</div>
            <code className="text-cyan-400 font-mono text-sm">pip install agentid</code>
            <div className="text-xs text-gray-500 mt-3 mb-2">Then register:</div>
            <pre className="text-cyan-300 font-mono text-xs">{`agent = agentid.register(
    name="My Agent",
    capabilities=["trading"]
)`}</pre>
          </div>
          <div className="mt-6"><a href="/docs" className="text-cyan-500 text-sm hover:underline">Read the docs →</a></div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {agents.map((agent, i) => <AgentPassport key={agent.agent_id} agent={agent} index={i} />)}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
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
      </motion.div>

      <div className="text-center py-8 mt-8 border-t border-white/5">
        <p className="text-gray-700 text-xs">AgentID — getagentid.dev</p>
      </div>
    </div>
  )
}
