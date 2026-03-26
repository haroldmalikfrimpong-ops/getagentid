'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────
interface AgentEvent {
  id: number
  agent_id: string
  event_type: string
  data: any
  created_at: string
}

interface Agent {
  agent_id: string
  name: string
  [key: string]: any
}

// ─── Event type color map ────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  api_verify:           { bg: 'rgba(0,230,118,0.08)', text: '#00e676', border: 'rgba(0,230,118,0.2)' },
  verification_check:   { bg: 'rgba(0,230,118,0.08)', text: '#00e676', border: 'rgba(0,230,118,0.2)' },
  api_register:         { bg: 'rgba(0,212,255,0.08)', text: '#00d4ff', border: 'rgba(0,212,255,0.2)' },
  agent_registered:     { bg: 'rgba(0,212,255,0.08)', text: '#00d4ff', border: 'rgba(0,212,255,0.2)' },
  api_connect:          { bg: 'rgba(123,47,255,0.08)', text: '#7b2fff', border: 'rgba(123,47,255,0.2)' },
  api_message:          { bg: 'rgba(123,47,255,0.08)', text: '#a855f7', border: 'rgba(123,47,255,0.2)' },
  api_verify_anonymous: { bg: 'rgba(255,179,0,0.08)', text: '#ffb300', border: 'rgba(255,179,0,0.2)' },
  key_bound:            { bg: 'rgba(255,149,0,0.08)', text: '#ff9500', border: 'rgba(255,149,0,0.2)' },
}

const DEFAULT_COLOR = { bg: 'rgba(255,255,255,0.04)', text: '#888', border: 'rgba(255,255,255,0.1)' }

function getEventColor(type: string) {
  return EVENT_COLORS[type] || DEFAULT_COLOR
}

// ─── Status from event data ──────────────────────────────────────────────────
function getStatus(event: AgentEvent): { label: string; color: string } {
  const d = event.data || {}
  if (d.error || d.status === 'error' || d.status === 'failed')
    return { label: 'Error', color: '#ff5252' }
  if (d.verified === true || d.status === 'verified' || event.event_type.includes('verify'))
    return { label: 'Success', color: '#00e676' }
  if (d.status === 'pending')
    return { label: 'Pending', color: '#ffb300' }
  return { label: 'OK', color: '#666' }
}

// ─── Detail summary from event data ─────────────────────────────────────────
function getDetailSummary(event: AgentEvent): string {
  const d = event.data || {}
  const parts: string[] = []

  if (d.ip) parts.push(`IP: ${d.ip}`)
  if (d.agent_name) parts.push(d.agent_name)
  if (d.user_agent) parts.push(d.user_agent.slice(0, 40))
  if (d.method) parts.push(d.method)
  if (d.capabilities) parts.push(`caps: ${Array.isArray(d.capabilities) ? d.capabilities.join(', ') : d.capabilities}`)
  if (d.error) parts.push(`err: ${typeof d.error === 'string' ? d.error : JSON.stringify(d.error)}`)

  return parts.length > 0 ? parts.join(' · ') : '—'
}

// ─── Icons ───────────────────────────────────────────────────────────────────
function FilterIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {direction === 'left'
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      }
    </svg>
  )
}

// ─── Stat card (matches StatsPanel pattern) ──────────────────────────────────
function AuditStat({
  label, value, sub, accent = '#00d4ff', delay = 0, icon,
}: {
  label: string; value: string; sub?: string; accent?: string; delay?: number; icon?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl p-4 overflow-hidden group"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${accent}18`,
      }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 0% 0%, ${accent}08 0%, transparent 60%)` }} />
      <div className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.18em]">{label}</div>
          {icon && <div className="text-base opacity-50">{icon}</div>}
        </div>
        <div className="text-2xl font-bold font-mono mb-0.5 tabular-nums"
          style={{ color: accent, textShadow: `0 0 20px ${accent}40` }}>
          {value}
        </div>
        {sub && <div className="text-[10px] text-gray-600">{sub}</div>}
      </div>
    </motion.div>
  )
}

// ─── CSV export ──────────────────────────────────────────────────────────────
function exportCSV(events: AgentEvent[], agentNames: Record<string, string>) {
  const header = 'Timestamp,Event Type,Agent ID,Agent Name,Status,Details\n'
  const rows = events.map(e => {
    const status = getStatus(e).label
    const details = getDetailSummary(e).replace(/,/g, ';')
    const name = (agentNames[e.agent_id] || e.agent_id).replace(/,/g, ';')
    const ts = new Date(e.created_at).toISOString()
    return `${ts},${e.event_type},${e.agent_id},${name},${status},${details}`
  }).join('\n')

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agentid-audit-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page size ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 25

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const [user, setUser]           = useState<any>(null)
  const [events, setEvents]       = useState<AgentEvent[]>([])
  const [agents, setAgents]       = useState<Agent[]>([])
  const [ready, setReady]         = useState(false)
  const [loading, setLoading]     = useState(false)

  // Filters
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)

  // Expanded row
  const [expanded, setExpanded] = useState<number | null>(null)

  const router = useRouter()

  // ── Auth ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setReady(true)
        loadData()
      }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
      if (event === 'SIGNED_OUT') router.push('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load ──
  async function loadData() {
    setLoading(true)
    try {
      const [agentsRes, eventsRes] = await Promise.all([
        supabase.from('agents').select('*'),
        supabase.from('agent_events').select('*').order('created_at', { ascending: false }).limit(1000),
      ])
      if (agentsRes.data) setAgents(agentsRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // ── Agent lookup ──
  const agentNames = useMemo(() => {
    const map: Record<string, string> = {}
    agents.forEach(a => { map[a.agent_id] = a.name })
    return map
  }, [agents])

  // ── Unique event types ──
  const eventTypes = useMemo(() => {
    const set = new Set(events.map(e => e.event_type))
    return Array.from(set).sort()
  }, [events])

  // ── Filtered events ──
  const filtered = useMemo(() => {
    let result = events

    if (typeFilter !== 'all') {
      result = result.filter(e => e.event_type === typeFilter)
    }

    if (agentFilter !== 'all') {
      result = result.filter(e => e.agent_id === agentFilter)
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter(e => new Date(e.created_at).getTime() >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59').getTime()
      result = result.filter(e => new Date(e.created_at).getTime() <= to)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.event_type.toLowerCase().includes(q) ||
        e.agent_id.toLowerCase().includes(q) ||
        (agentNames[e.agent_id] || '').toLowerCase().includes(q) ||
        JSON.stringify(e.data || {}).toLowerCase().includes(q)
      )
    }

    return result
  }, [events, typeFilter, agentFilter, dateFrom, dateTo, search, agentNames])

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [typeFilter, agentFilter, dateFrom, dateTo, search])

  // ── Stats ──
  const stats = useMemo(() => {
    const now = Date.now()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const verificationsToday = events.filter(e =>
      (e.event_type.includes('verify') || e.event_type.includes('verification')) &&
      new Date(e.created_at).getTime() >= todayStart.getTime()
    ).length

    const uniqueAgents = new Set(
      events.filter(e =>
        (now - new Date(e.created_at).getTime()) < 7 * 86_400_000
      ).map(e => e.agent_id)
    ).size

    return {
      total: events.length,
      verificationsToday,
      uniqueAgents,
      filtered: filtered.length,
    }
  }, [events, filtered])

  // ── Export handler ──
  const handleExport = useCallback(() => {
    exportCSV(filtered, agentNames)
  }, [filtered, agentNames])

  // ── Loading state ──
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070f' }}>
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 mx-auto mb-4 rounded-full"
            style={{
              border: '2px solid rgba(0,212,255,0.12)',
              borderTop: '2px solid #00d4ff',
              boxShadow: '0 0 20px rgba(0,212,255,0.2)',
            }}
          />
          <p className="text-gray-600 text-sm font-mono">Loading audit trail...</p>
        </div>
      </div>
    )
  }

  // ── Page ──
  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style={{
          background: 'rgba(7,7,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
        <a href="/" className="text-lg font-black holo-gradient">AgentID</a>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-cyan-400 transition-colors font-mono">
            Dashboard
          </a>
          <a href="/dashboard/keys" className="text-xs text-gray-500 hover:text-cyan-400 transition-colors font-mono">
            Keys
          </a>
          <a href="/dashboard/connections" className="text-xs text-gray-500 hover:text-cyan-400 transition-colors font-mono">
            Connections
          </a>
          <span className="text-xs text-cyan-400 font-mono font-bold border-b border-cyan-500/30 pb-0.5">
            Audit
          </span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-24 pb-16">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <a href="/dashboard" className="text-cyan-500/50 text-xs hover:text-cyan-400 transition-colors font-mono">
              ← Back to Dashboard
            </a>
            <h1 className="text-2xl font-black mt-2">
              <span className="holo-gradient">Audit Trail</span>
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Complete event history for all your agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 rounded-full"
                style={{ border: '1.5px solid rgba(0,212,255,0.15)', borderTop: '1.5px solid #00d4ff' }}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-gray-600 font-mono">PRO</span>
            </div>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          <AuditStat
            label="Total Events"
            value={stats.total.toLocaleString()}
            sub="All time"
            accent="#7b2fff"
            icon="⚡"
            delay={0}
          />
          <AuditStat
            label="Verifications Today"
            value={stats.verificationsToday.toString()}
            sub="Since midnight"
            accent="#00e676"
            icon="✓"
            delay={0.08}
          />
          <AuditStat
            label="Active Agents"
            value={stats.uniqueAgents.toString()}
            sub="Last 7 days"
            accent="#00d4ff"
            icon="📡"
            delay={0.16}
          />
          <AuditStat
            label="Filtered Results"
            value={stats.filtered.toLocaleString()}
            sub={stats.filtered === stats.total ? 'Showing all' : 'After filters'}
            accent="#ff9500"
            icon="🔍"
            delay={0.24}
          />
        </motion.div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.15))' }} />
          <span className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.25em]">Event Log</span>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.15), transparent)' }} />
        </div>

        {/* ── Search bar + filters toggle + export ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-3 mb-4"
        >
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search events, agents, IPs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            />
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono transition-all"
            style={{
              background: showFilters ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: showFilters ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.07)',
              color: showFilters ? '#00d4ff' : '#888',
            }}
          >
            <FilterIcon />
            Filters
            {(typeFilter !== 'all' || agentFilter !== 'all' || dateFrom || dateTo) && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            )}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono text-gray-400 hover:text-white transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <DownloadIcon />
            Export CSV
          </button>
        </motion.div>

        {/* ── Filter panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                {/* Event type */}
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1.5">
                    Event Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none cursor-pointer"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <option value="all">All types</option>
                    {eventTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Agent */}
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1.5">
                    Agent
                  </label>
                  <select
                    value={agentFilter}
                    onChange={e => setAgentFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none cursor-pointer"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <option value="all">All agents</option>
                    {agents.map(a => (
                      <option key={a.agent_id} value={a.agent_id}>
                        {a.name || a.agent_id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date from */}
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>

                {/* Date to */}
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>

                {/* Clear filters */}
                {(typeFilter !== 'all' || agentFilter !== 'all' || dateFrom || dateTo) && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <button
                      onClick={() => { setTypeFilter('all'); setAgentFilter('all'); setDateFrom(''); setDateTo('') }}
                      className="text-[10px] font-mono text-cyan-500/60 hover:text-cyan-400 transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Event table ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Top accent */}
          <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(123,47,255,0.25), transparent)' }} />

          {/* Table header */}
          <div className="grid grid-cols-[180px_1fr_1fr_1fr_90px] gap-2 px-5 py-3 text-[10px] font-mono text-gray-600 uppercase tracking-wider border-b hidden md:grid"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div>Timestamp</div>
            <div>Event Type</div>
            <div>Agent</div>
            <div>Details</div>
            <div className="text-right">Status</div>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
            {paged.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3 opacity-30">📋</div>
                <p className="text-gray-600 text-sm">
                  {events.length === 0 ? 'No events recorded yet' : 'No events match your filters'}
                </p>
                {events.length > 0 && search && (
                  <button onClick={() => setSearch('')}
                    className="text-cyan-500/60 text-xs mt-2 hover:text-cyan-400 transition-colors font-mono">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              paged.map((event, i) => {
                const color = getEventColor(event.event_type)
                const status = getStatus(event)
                const agentName = agentNames[event.agent_id] || event.agent_id
                const isExpanded = expanded === event.id
                const ts = new Date(event.created_at)
                const timeStr = ts.toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  hour12: false,
                })

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                    onClick={() => setExpanded(isExpanded ? null : event.id)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[180px_1fr_1fr_1fr_90px] gap-2 px-5 py-3 items-center">
                      {/* Timestamp */}
                      <div className="text-[11px] font-mono text-gray-500 tabular-nums">
                        {timeStr}
                      </div>

                      {/* Event type */}
                      <div>
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full"
                          style={{
                            background: color.bg,
                            color: color.text,
                            border: `1px solid ${color.border}`,
                          }}>
                          {event.event_type}
                        </span>
                      </div>

                      {/* Agent */}
                      <div className="text-xs text-gray-400 truncate">
                        <span className="text-gray-300 font-medium">{agentName}</span>
                        {agentName !== event.agent_id && (
                          <span className="text-gray-700 ml-1.5 text-[10px] font-mono">
                            {event.agent_id.slice(0, 12)}...
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="text-[11px] text-gray-600 truncate font-mono">
                        {getDetailSummary(event)}
                      </div>

                      {/* Status */}
                      <div className="text-right">
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${status.color}12`,
                            color: status.color,
                            border: `1px solid ${status.color}25`,
                          }}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="md:hidden px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: color.bg,
                            color: color.text,
                            border: `1px solid ${color.border}`,
                          }}>
                          {event.event_type}
                        </span>
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${status.color}12`,
                            color: status.color,
                            border: `1px solid ${status.color}25`,
                          }}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-1">{agentName}</div>
                      <div className="text-[10px] text-gray-700 font-mono">{timeStr}</div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4">
                            <div className="rounded-xl p-4"
                              style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.05)',
                              }}>
                              <div className="text-[9px] font-mono text-gray-600 uppercase tracking-wider mb-2">
                                Event Data
                              </div>
                              <pre className="text-[11px] text-cyan-300/80 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify(event.data, null, 2) || 'null'}
                              </pre>
                              <div className="flex items-center gap-4 mt-3 pt-3"
                                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-[10px] text-gray-700 font-mono">
                                  ID: {event.id}
                                </span>
                                <span className="text-[10px] text-gray-700 font-mono">
                                  Agent: {event.agent_id}
                                </span>
                                <span className="text-[10px] text-gray-700 font-mono">
                                  {ts.toISOString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] text-gray-600 font-mono">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronIcon direction="left" />
                </button>
                <span className="text-[10px] text-gray-500 font-mono px-3 tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronIcon direction="right" />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Footer ── */}
        <div className="text-center py-10 mt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-gray-700 text-xs font-mono">AgentID · getagentid.dev</p>
        </div>
      </div>
    </div>
  )
}
