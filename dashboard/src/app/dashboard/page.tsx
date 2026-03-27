'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgentPassport from '@/components/AgentPassport'
import StatsPanel from '@/components/StatsPanel'
import ActivityFeed from '@/components/ActivityFeed'

// ─── Sign-out icon ───────────────────────────────────────────────────────────
function SignOutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Navbar({ userName, avatarUrl, onSignOut }: { userName: string; avatarUrl?: string; onSignOut: () => void }) {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isActive = (path: string) => pathname === path

  const navLinks = [
    { href: '/dashboard',                  label: 'Dashboard' },
    { href: '/dashboard/fleet',            label: 'Fleet' },
    { href: '/dashboard/audit',            label: 'Audit' },
    { href: '/dashboard/reports',          label: 'Reports' },
    { href: '/dashboard/webhooks',         label: 'Webhooks' },
    { href: '/dashboard/keys',             label: 'API Keys' },
    { href: '/dashboard/verify-business',  label: 'Verify Business' },
    { href: '/registry',                   label: 'Registry' },
    { href: '/docs',                       label: 'Docs' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background:     'rgba(7,7,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom:   '1px solid rgba(255,255,255,0.05)',
      }}>
      <div className="flex items-center gap-6">
        <a href="/" className="text-lg font-black holo-gradient">AgentID</a>
        <div className="flex gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={isActive(link.href)
                ? { background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }
                : { color: '#6b7280' }
              }
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full border border-white/10" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.4), rgba(123,47,255,0.4))', border: '1px solid rgba(0,212,255,0.2)' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm text-gray-400 hidden sm:block max-w-[140px] truncate">{userName}</span>
        <button onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 ml-1">
          <SignOutIcon />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </nav>
  )
}

// ─── Getting Started Onboarding ──────────────────────────────────────────────
function GettingStarted({ agents }: { agents: any[] }) {
  // Compute step completion
  const hasAgents     = agents.length > 0
  const hasEd25519    = agents.some((a: any) => a.ed25519_key)
  const hasWallet     = agents.some((a: any) => a.wallet_address)
  const hasEntity     = false // entity_verified is on the profile, not agent — we assume false here

  // Determine the highest trust level across all agents
  const maxLevel = agents.reduce((max: number, a: any) => {
    const level = a.wallet_address ? 3 : a.ed25519_key ? 2 : 1
    return Math.max(max, level)
  }, 0)

  // Hide if user has reached L3+
  if (maxLevel >= 3) return null
  // Hide if no agents yet (the empty state handles that)
  if (!hasAgents) return null

  const steps = [
    { done: hasAgents,  label: `Register an agent — you have ${agents.length}`, href: null },
    { done: hasEd25519, label: 'Generate a security key for your agent', href: null, note: 'Click "Generate Security Key" on any agent card below' },
    { done: hasWallet,  label: 'Connect a blockchain wallet to enable payments', href: null, note: 'Click "Connect Wallet" on any agent card below' },
    { done: hasEntity,  label: 'Verify your business for full authority', href: '/dashboard/verify-business', note: 'Submit your business details for L4 certification' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl p-5 mb-6"
      style={{
        background: 'rgba(0,212,255,0.02)',
        border: '1px solid rgba(0,212,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-white">Getting Started with AgentID</h3>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            {/* Check / number */}
            <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
              step.done
                ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                : 'bg-white/5 text-gray-500 border border-white/10'
            }`}>
              {step.done ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <div className="flex-1">
              <span className={`text-xs ${step.done ? 'text-gray-400 line-through' : 'text-gray-300'}`}>
                {step.label}
              </span>
              {!step.done && step.note && (
                <div className="text-[10px] text-gray-600 mt-0.5">{step.note}</div>
              )}
              {!step.done && step.href && (
                <a href={step.href} className="inline-block mt-1 text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors font-mono">
                  Start this step →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[10px] text-gray-600 font-mono">
          Each level unlocks new capabilities. L3 enables payments. L4 enables full autonomy.
        </p>
      </div>
    </motion.div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyAgents() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl p-12 text-center"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border:     '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
        style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
        🛂
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No agents registered</h3>
      <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
        Register your first agent to get a cryptographic identity passport
      </p>
      <div className="max-w-sm mx-auto rounded-xl overflow-hidden text-left"
        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.1)' }}>
        <div className="px-4 pt-4 pb-2 text-[10px] font-mono text-gray-600 uppercase tracking-wider border-b"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          Quick start
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10px] text-gray-600 mb-1">1. Install the SDK</div>
            <code className="text-cyan-400 font-mono text-sm block">pip install getagentid</code>
          </div>
          <div>
            <div className="text-[10px] text-gray-600 mb-1">2. Register your agent</div>
            <pre className="text-cyan-300 font-mono text-xs leading-relaxed">{`client = agentid.Client(api_key="your-key")
agent = client.agents.register(
    name="My Agent",
    capabilities=["trading"]
)`}</pre>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <a href="/docs" className="text-cyan-500 text-sm hover:text-cyan-300 transition-colors font-medium">
          Read the documentation →
        </a>
      </div>
    </motion.div>
  )
}

// ─── Upgrade banner ───────────────────────────────────────────────────────────
function PlanBar({
  plan, agents, agentLimit, upgrading, onUpgrade,
}: {
  plan: string; agents: any[]; agentLimit: number; upgrading: boolean; onUpgrade: (p: string) => void;
}) {
  const pct = agentLimit > 0 ? (agents.length / agentLimit) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border:     '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full tracking-wider"
            style={plan === 'free'
              ? { background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }
              : { background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }
            }>
            {plan.toUpperCase()}
          </span>
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">{agents.length} / {agentLimit} agents</span>
          </div>
          <div className="w-32 h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width:      `${Math.min(pct, 100)}%`,
                background: pct > 80
                  ? 'linear-gradient(90deg, #ff9500, #ff5252)'
                  : 'linear-gradient(90deg, #00d4ff, #7b2fff)',
              }} />
          </div>
        </div>
      </div>

      {plan === 'free' && (
        <motion.button
          onClick={() => onUpgrade('pro')}
          disabled={upgrading}
          whileHover={upgrading ? {} : { scale: 1.02 }}
          whileTap={upgrading ? {} : { scale: 0.98 }}
          className="px-5 py-2 rounded-full text-white text-xs font-bold tracking-wide disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)', boxShadow: '0 4px 16px rgba(0,212,255,0.2)' }}
        >
          {upgrading ? 'Redirecting...' : 'Upgrade to Pro — $99/mo'}
        </motion.button>
      )}
    </motion.div>
  )
}

// ─── Transaction list ─────────────────────────────────────────────────────────
function TransactionList({ transactions }: { transactions: any[] }) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Top accent */}
      <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.2), transparent)' }} />

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.2em]">
            Transactions
          </h2>
          <span className="text-[10px] text-gray-700 font-mono">{transactions.length} total</span>
        </div>
        <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
          {transactions.length === 0 && (
            <p className="text-gray-700 text-sm py-8 text-center">No transactions yet</p>
          )}
          {transactions.map((tx) => (
            <div key={tx.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-sm transition-colors hover:bg-white/5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-3">
                <div className="text-base">{tx.type === 'entry' ? '📈' : '📉'}</div>
                <div>
                  <div className="text-gray-300 text-xs font-medium">{tx.vendor || tx.type}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{tx.category}</div>
                </div>
              </div>
              <div className={`font-mono text-xs font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {tx.amount > 0 ? '+' : ''}{tx.currency} {tx.amount?.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [user, setUser]               = useState<any>(null)
  const [isNew, setIsNew]             = useState(false)
  const [agents, setAgents]           = useState<any[]>([])
  const [events, setEvents]           = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [time, setTime]               = useState('')
  const [ready, setReady]             = useState(false)
  const [plan, setPlan]               = useState('free')
  const [agentLimit, setAgentLimit]   = useState(100)
  const [upgrading, setUpgrading]     = useState(false)
  const router = useRouter()

  const loadData = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    const clock = setInterval(() => setTime(
      new Date().toLocaleTimeString('en-GB', { hour12: false })
    ), 1000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsNew(event === 'SIGNED_IN')
        setReady(true)
        loadData()
        loadProfile()
        // Notify on new signup
        if (event === 'SIGNED_IN') {
          fetch('/api/v1/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: session.user.email,
              provider: session.user.app_metadata?.provider || 'email',
              user_id: session.user.id,
            }),
          }).catch(() => {})
        }
      }
      if (event === 'INITIAL_SESSION' && !session) {
        router.push('/login')
      }
      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })

    return () => { clearInterval(clock); subscription.unsubscribe() }
  }, [loadData, router])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').single()
    if (data) {
      setPlan(data.plan || 'free')
      setAgentLimit(data.agent_limit || 100)
    }
  }

  async function handleUpgrade(planName: string) {
    setUpgrading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/v1/checkout', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planName }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) { console.error(e) }
    setUpgrading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const userName  = user?.user_metadata?.user_name || user?.user_metadata?.full_name || user?.email || 'Agent'
  const avatarUrl = user?.user_metadata?.avatar_url
  const dateStr   = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Loading ──
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 mx-auto mb-4 rounded-full"
            style={{
              border:      '2px solid rgba(0,212,255,0.12)',
              borderTop:   '2px solid #00d4ff',
              boxShadow:   '0 0 20px rgba(0,212,255,0.2)',
            }}
          />
          <p className="text-gray-600 text-sm font-mono">Authenticating...</p>
        </div>
      </div>
    )
  }

  // ── Welcome flash ──
  if (isNew) {
    setTimeout(() => setIsNew(false), 2500)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            className="mb-6"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt=""
                className="w-20 h-20 rounded-full mx-auto"
                style={{ border: '2px solid rgba(0,212,255,0.3)', boxShadow: '0 0 30px rgba(0,212,255,0.15)' }} />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-black text-white"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(123,47,255,0.2))', border: '1px solid rgba(0,212,255,0.2)' }}>
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </motion.div>
          <h1 className="text-3xl font-black mb-2">
            <span className="holo-gradient">Welcome, {userName}!</span>
          </h1>
          <p className="text-gray-500 text-sm">Your AgentID command center is ready.</p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-xs text-cyan-500/40 font-mono"
          >
            Loading dashboard...
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ── Dashboard ──
  return (
    <div className="min-h-screen grid-bg" style={{ background: '#07070f' }}>
      <Navbar userName={userName} avatarUrl={avatarUrl} onSignOut={handleSignOut} />

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-24 pb-16">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-black text-white">Command Center</h1>
            <p className="text-xs text-gray-600 mt-1">{dateStr}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-cyan-400 tabular-nums"
              style={{ textShadow: '0 0 20px rgba(0,212,255,0.3)' }}>
              {time}
            </div>
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-gray-600 font-mono">LIVE</span>
            </div>
          </div>
        </motion.div>

        {/* ── Plan bar ── */}
        <PlanBar
          plan={plan}
          agents={agents}
          agentLimit={agentLimit}
          upgrading={upgrading}
          onUpgrade={handleUpgrade}
        />

        {/* ── Getting Started ── */}
        <GettingStarted agents={agents} />

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <StatsPanel agents={agents} events={events} />
        </motion.div>

        {/* ── Agents divider ── */}
        <div className="flex items-center gap-4 mb-6 mt-10">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.15))' }} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.25em]">Your Agents</span>
            {agents.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                style={{ background: 'rgba(0,212,255,0.08)', color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.15)' }}>
                {agents.length}
              </span>
            )}
          </div>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.15), transparent)' }} />
        </div>

        {/* ── Agents grid or empty ── */}
        {agents.length === 0 ? (
          <EmptyAgents />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10"
          >
            {agents.map((agent, i) => (
              <AgentPassport key={agent.agent_id} agent={agent} index={i} onAgentUpdated={loadData} />
            ))}
          </motion.div>
        )}

        {/* ── Activity + Transactions ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6"
        >
          <ActivityFeed events={events} agents={agents} />
          <TransactionList transactions={transactions} />
        </motion.div>

        {/* Footer */}
        <div className="text-center py-10 mt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-gray-700 text-xs font-mono">AgentID · getagentid.dev</p>
        </div>
      </div>
    </div>
  )
}
