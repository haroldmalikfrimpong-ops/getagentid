'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_ID = 'ec9ca7d8-77c8-488a-9bfd-8c800c0b5675'

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'users' | 'agents' | 'events'>('overview')
  const [time, setTime] = useState('')
  const router = useRouter()

  useEffect(() => {
    const clock = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (session.user.id !== ADMIN_ID) {
          router.push('/dashboard')
          return
        }
        setUser(session.user)
        setReady(true)
        loadAllData()
      }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
    })

    return () => { clearInterval(clock); subscription.unsubscribe() }
  }, [])

  async function loadAllData() {
    const [agentsRes, eventsRes, txRes] = await Promise.all([
      supabase.from('agents').select('*').order('created_at', { ascending: false }),
      supabase.from('agent_events').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    if (agentsRes.data) setAgents(agentsRes.data)
    if (eventsRes.data) setEvents(eventsRes.data)
    if (txRes.data) setTransactions(txRes.data)

    // Get unique users from agents
    const userIds = new Set(agentsRes.data?.map((a: any) => a.user_id).filter(Boolean))
    setUsers(Array.from(userIds).map(id => ({ id })))
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full" style={{ border: '2px solid rgba(255,61,0,0.2)', borderTop: '2px solid #ff3d00' }} />
      </div>
    )
  }

  const totalAgents = agents.length
  const onlineAgents = agents.filter(a => a.last_active && (Date.now() - new Date(a.last_active).getTime()) < 3600000).length
  const todayEvents = events.filter(e => {
    const d = new Date(e.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length
  const uniqueOwners = new Set(agents.map(a => a.owner)).size

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'agents', label: 'All Agents', icon: '🤖' },
    { id: 'events', label: 'Events', icon: '⚡' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>
      {/* Admin nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,61,0,0.15)' }}>
        <div className="flex items-center gap-4">
          <a href="/" className="text-lg font-black" style={{ background: 'linear-gradient(135deg, #ff3d00, #ff9500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AgentID Admin
          </a>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,61,0,0.1)', color: '#ff3d00', border: '1px solid rgba(255,61,0,0.2)' }}>
            ADMIN
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-orange-400">{time}</span>
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">Dashboard</a>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-black text-white">Mission Control</h1>
          <p className="text-gray-600 text-sm mt-1">Full system overview — all users, agents, and activity</p>
        </motion.div>

        {/* Top stats */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total Users', value: users.length, color: '#ff3d00', icon: '👥' },
            { label: 'Total Agents', value: totalAgents, color: '#ff9500', icon: '🤖' },
            { label: 'Online Now', value: onlineAgents, color: '#00e676', icon: '📡' },
            { label: 'Events Today', value: todayEvents, color: '#00d4ff', icon: '⚡' },
            { label: 'Unique Owners', value: uniqueOwners, color: '#7b2fff', icon: '🏢' },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl p-4 relative overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${stat.color}15` }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${stat.color}40, transparent)` }} />
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{stat.label}</span>
                <span className="text-sm">{stat.icon}</span>
              </div>
              <div className="text-2xl font-black font-mono" style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}40` }}>
                {stat.value}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap"
              style={tab === t.id
                ? { background: 'rgba(255,61,0,0.1)', color: '#ff3d00', border: '1px solid rgba(255,61,0,0.2)' }
                : { color: '#666', border: '1px solid transparent' }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

          {/* Overview */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent agents */}
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-4">Recent Agents</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {agents.slice(0, 15).map(a => (
                    <a key={a.agent_id} href={`/verify/${a.agent_id}`}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                      <div>
                        <div className="text-sm text-white font-medium">{a.name}</div>
                        <div className="text-[10px] text-gray-600 font-mono">{a.owner} · {a.platform || 'API'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${a.last_active && (Date.now() - new Date(a.last_active).getTime()) < 3600000 ? 'bg-green-400' : 'bg-gray-700'}`} />
                        <span className="text-[10px] text-gray-600 font-mono">
                          {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Recent events */}
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-4">Live Activity</h3>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {events.slice(0, 30).map(e => {
                    const agent = agents.find(a => a.agent_id === e.agent_id)
                    const age = Date.now() - new Date(e.created_at).getTime()
                    const ageStr = age < 60000 ? 'now' : age < 3600000 ? `${Math.floor(age / 60000)}m` : age < 86400000 ? `${Math.floor(age / 3600000)}h` : `${Math.floor(age / 86400000)}d`
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.02] text-xs">
                        <span className="text-sm">
                          {e.event_type === 'trade_opened' ? '📈' : e.event_type === 'trade_closed' ? '📉' : e.event_type === 'registered' ? '🔐' : '⚡'}
                        </span>
                        <span className="text-orange-400 font-mono">{e.event_type}</span>
                        <span className="text-gray-500 truncate flex-1">{agent?.name || e.agent_id}</span>
                        <span className="text-gray-700 font-mono">{ageStr}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Revenue placeholder */}
              <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-4">Revenue</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.1)' }}>
                    <div className="text-2xl font-black text-green-400 font-mono">$0</div>
                    <div className="text-[10px] text-gray-600 mt-1">MRR</div>
                  </div>
                  <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div className="text-2xl font-black text-cyan-400 font-mono">{users.length}</div>
                    <div className="text-[10px] text-gray-600 mt-1">Total Users</div>
                  </div>
                  <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(123,47,255,0.05)', border: '1px solid rgba(123,47,255,0.1)' }}>
                    <div className="text-2xl font-black text-purple-400 font-mono">0</div>
                    <div className="text-[10px] text-gray-600 mt-1">Paid Users</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users tab */}
          {tab === 'users' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-5">
                <h3 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-4">All Users ({users.length})</h3>
                <div className="space-y-2">
                  {users.map((u, i) => {
                    const userAgents = agents.filter(a => a.user_id === u.id)
                    return (
                      <div key={u.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/[0.02]">
                        <div>
                          <div className="text-sm text-white font-mono">{u.id.slice(0, 8)}...</div>
                          <div className="text-[10px] text-gray-600">{userAgents.length} agents</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}>FREE</span>
                          <div className="flex -space-x-1">
                            {userAgents.slice(0, 3).map((a: any, j: number) => (
                              <div key={j} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px]"
                                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                                🤖
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Agents tab */}
          {tab === 'agents' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-5">
                <h3 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-4">All Agents ({agents.length})</h3>
                <div className="space-y-2">
                  {agents.map(a => {
                    const isOnline = a.last_active && (Date.now() - new Date(a.last_active).getTime()) < 3600000
                    return (
                      <a key={a.agent_id} href={`/verify/${a.agent_id}`}
                        className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/[0.02] transition-colors block">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-700'}`} />
                          <div>
                            <div className="text-sm text-white font-medium">{a.name}</div>
                            <div className="text-[10px] text-gray-600 font-mono">{a.agent_id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-gray-500">{a.owner}</span>
                          <span className="text-[10px] text-gray-600">{a.platform || 'API'}</span>
                          <div className="flex gap-1">
                            {a.capabilities?.slice(0, 2).map((c: string, j: number) => (
                              <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                                style={{ background: 'rgba(123,47,255,0.08)', color: 'rgba(123,47,255,0.6)' }}>{c}</span>
                            ))}
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Events tab */}
          {tab === 'events' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-5">
                <h3 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-4">All Events ({events.length})</h3>
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {events.map(e => {
                    const agent = agents.find(a => a.agent_id === e.agent_id)
                    const date = new Date(e.created_at)
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.02] text-xs">
                        <span className="text-gray-700 font-mono w-16 shrink-0">
                          {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-mono font-medium w-28 shrink-0" style={{
                          color: e.event_type.includes('trade') ? '#00e676' :
                                 e.event_type.includes('register') ? '#00d4ff' :
                                 e.event_type.includes('verify') ? '#ffb300' : '#888'
                        }}>
                          {e.event_type}
                        </span>
                        <span className="text-gray-400 truncate flex-1">{agent?.name || e.agent_id}</span>
                        <span className="text-gray-700 font-mono shrink-0">
                          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
