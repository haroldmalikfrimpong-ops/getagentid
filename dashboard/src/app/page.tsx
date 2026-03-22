'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Helpers ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 text-cyan-400" fill="none" viewBox="0 0 16 16">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) return (
    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 text-gray-500 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

const ECOSYSTEM = [
  { name: 'Google A2A',      color: '#4285F4', desc: 'Agent-to-Agent protocol' },
  { name: 'Anthropic MCP',   color: '#d97706', desc: 'Model Context Protocol' },
  { name: 'CrewAI',          color: '#ef4444', desc: 'Multi-agent orchestration' },
  { name: 'LangChain',       color: '#16a34a', desc: 'LLM application framework' },
  { name: 'AutoGen',         color: '#7c3aed', desc: 'Multi-agent conversations' },
  { name: 'OpenAI Agents',   color: '#2563eb', desc: 'Agents SDK' },
]

const CODE_TABS = {
  python: {
    label: 'Python',
    install: 'pip install agentid',
    code: [
      { type: 'keyword', text: 'from' }, { type: 'module', text: ' agentid' }, { type: 'keyword', text: ' import' }, { type: 'name', text: ' Client' },
      { type: 'break' },
      { type: 'comment', text: '# Verify before you trust' },
      { type: 'name', text: 'client' }, { type: 'op', text: ' = ' }, { type: 'module', text: 'Client' }, { type: 'dim', text: '(' }, { type: 'param', text: 'api_key' }, { type: 'op', text: '=' }, { type: 'string', text: '"ak_..."' }, { type: 'dim', text: ')' },
      { type: 'name', text: 'result' }, { type: 'op', text: ' = ' }, { type: 'name', text: 'client.agents.' }, { type: 'module', text: 'verify' }, { type: 'dim', text: '(' }, { type: 'string', text: '"agent_c546"' }, { type: 'dim', text: ')' },
    ],
  },
  node: {
    label: 'Node.js',
    install: 'npm install @agentid/sdk',
    code: [
      { type: 'keyword', text: 'import' }, { type: 'name', text: ' { AgentID }' }, { type: 'keyword', text: ' from' }, { type: 'string', text: " '@agentid/sdk'" },
      { type: 'break' },
      { type: 'comment', text: '// Verify before you trust' },
      { type: 'keyword', text: 'const' }, { type: 'name', text: ' client' }, { type: 'op', text: ' = ' }, { type: 'keyword', text: 'new' }, { type: 'module', text: ' AgentID' }, { type: 'dim', text: '(' }, { type: 'string', text: "'ak_...'" }, { type: 'dim', text: ')' },
      { type: 'keyword', text: 'const' }, { type: 'name', text: ' result' }, { type: 'op', text: ' = ' }, { type: 'keyword', text: 'await' }, { type: 'name', text: ' client.agents.' }, { type: 'module', text: 'verify' }, { type: 'dim', text: '(' }, { type: 'string', text: "'agent_c546'" }, { type: 'dim', text: ')' },
    ],
  },
  curl: {
    label: 'cURL',
    install: 'curl api.getagentid.dev/v1/agents/verify',
    code: [
      { type: 'module', text: 'curl' }, { type: 'name', text: ' -X POST \\' },
      { type: 'string', text: '  https://api.getagentid.dev/v1/agents/verify' }, { type: 'name', text: ' \\' },
      { type: 'name', text: '  -H ' }, { type: 'string', text: '"Authorization: Bearer ak_..."' }, { type: 'name', text: ' \\' },
      { type: 'name', text: '  -d ' }, { type: 'string', text: '\'{"agent_id": "agent_c546"}\'' },
    ],
  },
} as const

// ─── Subtle animated counter for social proof ───────────────────────────────

function AnimatedNumber({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = to / 60
    const id = setInterval(() => {
      start += step
      if (start >= to) { setVal(to); clearInterval(id) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(id)
  }, [to])
  return <>{val.toLocaleString()}{suffix}</>
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mounted, setMounted]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [agentCount, setAgentCount] = useState(0)
  const [codeTab, setCodeTab]   = useState<keyof typeof CODE_TABS>('python')
  const [copied, setCopied]     = useState(false)
  const [pipCopied, setPipCopied] = useState(false)
  const [showSticky, setShowSticky] = useState(false)
  const router = useRouter()
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setShowSticky(latest > 600)
  })

  const copyToClipboard = useCallback((text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2000)
    })
  }, [])

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user)
      setChecking(false)
    })
    fetch('/api/v1/agents/discover?limit=100')
      .then(r => r.json())
      .then(data => setAgentCount(data.count || 0))
      .catch(() => {})
  }, [])

  if (!mounted || checking) return null

  const activeCode = CODE_TABS[codeTab]

  return (
    <div className="min-h-screen" style={{ background: '#07070f' }}>

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background:     'rgba(7,7,15,0.75)',
          backdropFilter: 'blur(20px)',
          borderBottom:   '1px solid rgba(255,255,255,0.05)',
        }}>
        <a href="/" className="flex items-center gap-2 group">
          <span className="text-xl font-black holo-gradient">AgentID</span>
          <span className="text-[10px] font-mono text-gray-600 hidden sm:block mt-0.5">.dev</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="#how" className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            How It Works
          </a>
          <a href="/registry" className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Registry
          </a>
          <a href="/docs" className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Docs
          </a>
          <a href="#pricing" className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Pricing
          </a>
          <a href="https://github.com/haroldmalikfrimpong-ops/getagentid"
            className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            GitHub
          </a>
          {loggedIn ? (
            <a href="/dashboard"
              className="px-5 py-2 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
              Dashboard
            </a>
          ) : (
            <>
              <a href="/login" className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                Log In
              </a>
              <a href="/signup"
                className="px-5 py-2 rounded-full text-white text-sm font-bold transition-all hover:opacity-90 hover:shadow-lg"
                style={{
                  background:  'linear-gradient(135deg, #00d4ff, #7b2fff)',
                  boxShadow:   '0 0 0 0 rgba(0,212,255,0)',
                  transition:  'box-shadow 0.3s ease, opacity 0.2s',
                }}>
                Get Started Free
              </a>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-28 px-6 overflow-hidden">
        {/* Radial glow behind hero */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px]"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(123,47,255,0.14) 0%, rgba(0,212,255,0.07) 40%, transparent 70%)' }} />
        </div>
        {/* Grid */}
        <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
              style={{
                background: 'rgba(0,212,255,0.06)',
                border:     '1px solid rgba(0,212,255,0.2)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400 text-[11px] font-mono tracking-[0.2em] uppercase">
                Open Source · MIT Licensed
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-5xl md:text-6xl font-black mb-6 leading-[1.08] tracking-tight"
            >
              <span className="text-white">Agents can&apos;t prove</span>
              <br />
              <span className="text-white">who they are.</span>
              <br />
              <span className="holo-gradient-animated">We fix that.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-lg text-gray-400 mb-8 leading-relaxed max-w-lg"
            >
              Cryptographic identity for AI agents. One API call to verify any agent before data, money, or decisions move.
            </motion.p>

            {/* Single CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 items-start"
            >
              <a href="/signup"
                className="px-9 py-4 rounded-full text-white font-bold text-sm tracking-wider
                  transition-all hover:opacity-90 hover:-translate-y-0.5 inline-block"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                  boxShadow:  '0 8px 32px rgba(0,212,255,0.2), 0 0 0 1px rgba(0,212,255,0.15)',
                }}>
                GET YOUR API KEY FREE
              </a>
              <a href="#how"
                className="px-9 py-4 rounded-full text-gray-400 font-bold text-sm tracking-wider
                  transition-all hover:text-white hover:bg-white/5 inline-block"
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                SEE HOW IT WORKS
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-gray-600 text-xs mt-4"
            >
              No credit card required · 5 agents free forever · Setup in 2 minutes
            </motion.p>
          </div>

          {/* Right — Multi-language code demo */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden p-[1px]"
              style={{ background: 'linear-gradient(145deg, rgba(0,212,255,0.3), rgba(123,47,255,0.3), rgba(0,212,255,0.1))' }}>
              <div className="rounded-2xl" style={{ background: 'rgba(7,7,15,0.95)' }}>
                {/* Language tabs */}
                <div className="flex items-center justify-between px-6 pt-4 pb-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex gap-1">
                    {(Object.keys(CODE_TABS) as (keyof typeof CODE_TABS)[]).map((tab) => (
                      <button key={tab} onClick={() => setCodeTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
                          codeTab === tab
                            ? 'text-cyan-400 bg-cyan-400/10'
                            : 'text-gray-600 hover:text-gray-400'
                        }`}>
                        {CODE_TABS[tab].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code block */}
                <div className="px-6 py-5 font-mono text-[13px] leading-[1.7]">
                  {activeCode.code.map((token, i) => {
                    if (token.type === 'break') return <div key={i} className="h-3" />
                    const colors: Record<string, string> = {
                      keyword: 'text-purple-400', module: 'text-cyan-300', name: 'text-white',
                      comment: 'text-gray-500', op: 'text-purple-400', param: 'text-orange-300',
                      string: 'text-green-400', dim: 'text-gray-400',
                    }
                    return <span key={i} className={colors[token.type] || 'text-white'}>{token.text}</span>
                  })}
                  <div className="h-3" />
                  <motion.div
                    key={codeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="rounded-lg px-4 py-3 mt-2" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.15)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-400 text-sm">&#10003;</span>
                        <span className="text-green-400 text-xs font-bold tracking-wider">VERIFIED</span>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <div><span className="text-gray-500">agent:</span> <span className="text-white">GoldSignalBot</span></div>
                        <div><span className="text-gray-500">owner:</span> <span className="text-white">BillionMakerHQ</span></div>
                        <div><span className="text-gray-500">trust:</span> <span className="text-cyan-400">0.94</span></div>
                        <div><span className="text-gray-500">cert:</span> <span className="text-gray-400">ECDSA P-256 · valid</span></div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="absolute -bottom-3 -left-3 rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{
                background: 'rgba(7,7,15,0.9)',
                border: '1px solid rgba(0,212,255,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-gray-300 font-mono">Sub-50ms response</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="absolute -top-3 -right-3 rounded-xl px-4 py-2.5 flex items-center gap-2 cursor-pointer"
              onClick={() => copyToClipboard(activeCode.install, setCopied)}
              style={{
                background: 'rgba(7,7,15,0.9)',
                border: '1px solid rgba(123,47,255,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <CopyIcon copied={copied} />
              <span className="text-[11px] text-gray-300 font-mono">{activeCode.install}</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Social proof strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-20"
        >
          {/* Stats row */}
          <div className="flex items-center justify-center gap-8 mb-8 flex-wrap">
            {[
              { label: 'Agents Registered', val: agentCount },
              { label: 'Uptime', val: 99, suffix: '.9%' },
              { label: 'Avg Response', val: 47, suffix: 'ms' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-black text-white font-mono tabular-nums">
                  <AnimatedNumber to={s.val} suffix={s.suffix} />
                </div>
                <div className="text-[10px] text-gray-600 tracking-wider uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { label: 'Open Source', icon: '&#9733;' },
              { label: 'MIT Licensed', icon: '&#128274;' },
              { label: 'ECDSA P-256', icon: '&#128272;' },
              { label: 'SOC 2 Ready', icon: '&#9989;' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] text-gray-500 font-mono"
                style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <span dangerouslySetInnerHTML={{ __html: badge.icon }} />
                {badge.label}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <div className="section-divider" />

      {/* ── Why This Matters — Visual Demo ── */}
      <section className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              See It In Action
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Every agent gets a passport.
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Cryptographic identity that proves who an agent is, who owns it, and what it&apos;s authorized to do.
            </p>
          </motion.div>

          {/* ── Animated Agent Passport Card ── */}
          <div className="flex flex-col lg:flex-row items-center gap-16 mb-28">
            <motion.div
              initial={{ opacity: 0, x: -30, rotateY: -8 }}
              whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="w-full max-w-[380px] shrink-0"
              style={{ perspective: '1000px' }}
            >
              <div className="passport-card scan-overlay p-0">
                {/* Passport header */}
                <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                      <span className="text-cyan-400 text-xs font-black">ID</span>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-gray-600 tracking-[0.3em] uppercase">Agent Passport</div>
                      <div className="text-[9px] font-mono text-purple-400/50">AGENTID.DEV</div>
                    </div>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6, type: 'spring' }}
                    className="px-2.5 py-1 rounded-full flex items-center gap-1.5"
                    style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-[9px] font-mono font-bold">VERIFIED</span>
                  </motion.div>
                </div>

                {/* Passport body */}
                <div className="px-6 pb-5">
                  <div className="flex items-start gap-4 mb-5">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 }}
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(123,47,255,0.15))',
                        border: '1px solid rgba(0,212,255,0.2)',
                      }}
                    >
                      <span className="text-3xl">&#129302;</span>
                    </motion.div>
                    <div className="min-w-0">
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 }}
                      >
                        <div className="text-lg font-bold text-white">GoldSignalBot</div>
                        <div className="text-xs text-gray-500">Trading signal agent</div>
                      </motion.div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'OWNER', value: 'BillionMakerHQ', delay: 0.5 },
                      { label: 'TRUST SCORE', value: '0.94', delay: 0.6 },
                      { label: 'AGENT ID', value: 'agt_c546...f2a1', delay: 0.7 },
                      { label: 'CERTIFICATE', value: 'ECDSA P-256', delay: 0.8 },
                    ].map((field, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: field.delay }}
                      >
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-1">{field.label}</div>
                        <div className="text-xs font-mono text-gray-300">{field.value}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Capabilities */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.9 }}
                  >
                    <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-2">Capabilities</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {['trade-signals', 'market-data', 'portfolio-read'].map((cap, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono text-cyan-400/80"
                          style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
                          {cap}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* MRZ strip */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.0 }}
                  className="passport-mrz"
                >
                  P&lt;AGENTID&lt;GOLDSIGNALBOT&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;AGT_C546F2A1&lt;&lt;&lt;ECDSA256&lt;2026&lt;&lt;BHQ
                </motion.div>
              </div>
            </motion.div>

            {/* Explanation text */}
            <div className="flex-1">
              <div className="space-y-6">
                {[
                  {
                    icon: '&#128274;',
                    title: 'Cryptographic Identity',
                    desc: 'Each agent gets a signed ECDSA P-256 certificate. Unforgeable. Verifiable by anyone, anywhere.',
                    accent: '#00d4ff',
                    delay: 0.2,
                  },
                  {
                    icon: '&#9989;',
                    title: 'Instant Verification',
                    desc: 'One API call returns the agent\'s identity, owner, trust score, and certificate status. Sub-50ms.',
                    accent: '#00e676',
                    delay: 0.4,
                  },
                  {
                    icon: '&#128209;',
                    title: 'Full Audit Trail',
                    desc: 'Every verification, connection, and message is logged. Know exactly who your agents are talking to.',
                    accent: '#7b2fff',
                    delay: 0.6,
                  },
                  {
                    icon: '&#128279;',
                    title: 'Agent-to-Agent Trust',
                    desc: 'Both sides verified before data moves. Mutual authentication for the agent economy.',
                    accent: '#ff9500',
                    delay: 0.8,
                  },
                ].map((item, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: item.delay }}
                    className="flex gap-4 items-start"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ background: `${item.accent}10`, border: `1px solid ${item.accent}20` }}>
                      <span dangerouslySetInnerHTML={{ __html: item.icon }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.0 }}
                className="mt-8"
              >
                <button
                  onClick={() => copyToClipboard('pip install agentid', setPipCopied)}
                  className="inline-flex items-center gap-3 rounded-xl px-5 py-3 font-mono text-sm text-cyan-300 transition-all hover:border-cyan-400/30 group cursor-pointer"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.15)' }}>
                  <span>$ pip install agentid</span>
                  <CopyIcon copied={pipCopied} />
                </button>
              </motion.div>
            </div>
          </div>

          {/* ── Agent-to-Agent Verification Flow ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
              Verified before anything moves.
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Watch two agents verify each other before exchanging data.
            </p>
          </motion.div>

          <div className="relative max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              {/* Agent A */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex-1 rounded-2xl p-5 relative overflow-hidden"
                style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.15)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)' }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                    &#129302;
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">GoldSignalBot</div>
                    <div className="text-[10px] font-mono text-gray-600">agt_c546</div>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.2, type: 'spring' }}
                  className="flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[10px] font-mono text-green-400">Verified · 0.94</span>
                </motion.div>
              </motion.div>

              {/* Connection line with animated data flow */}
              <div className="flex-shrink-0 w-24 md:w-40 relative h-20 flex items-center justify-center">
                {/* Line */}
                <div className="absolute top-1/2 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.3), rgba(123,47,255,0.3))' }} />

                {/* Animated particles */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  className="absolute inset-0"
                >
                  {[0, 1, 2].map((p) => (
                    <motion.div
                      key={p}
                      className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ background: '#00d4ff', boxShadow: '0 0 8px rgba(0,212,255,0.8)' }}
                      animate={{
                        left: ['0%', '100%'],
                        opacity: [0, 1, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        delay: 1.0 + p * 0.4,
                        repeat: Infinity,
                        repeatDelay: 0.6,
                        ease: 'linear',
                      }}
                    />
                  ))}
                </motion.div>

                {/* Handshake icon */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.5, type: 'spring' }}
                  className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(7,7,15,0.95)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    boxShadow: '0 0 20px rgba(0,212,255,0.15)',
                  }}
                >
                  <span className="text-lg">&#129309;</span>
                </motion.div>
              </div>

              {/* Agent B */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex-1 rounded-2xl p-5 relative overflow-hidden"
                style={{ background: 'rgba(123,47,255,0.03)', border: '1px solid rgba(123,47,255,0.15)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(123,47,255,0.5), transparent)' }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: 'rgba(123,47,255,0.1)', border: '1px solid rgba(123,47,255,0.2)' }}>
                    &#128640;
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">PortfolioManager</div>
                    <div className="text-[10px] font-mono text-gray-600">agt_d891</div>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.4, type: 'spring' }}
                  className="flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[10px] font-mono text-green-400">Verified · 0.91</span>
                </motion.div>
              </motion.div>
            </div>

            {/* Verification log */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 1.8 }}
              className="mt-8 rounded-xl p-4 font-mono text-[11px] leading-relaxed"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {[
                { time: '00:00.012', msg: 'GoldSignalBot requests connection to PortfolioManager', color: 'text-gray-500' },
                { time: '00:00.024', msg: 'Verifying sender certificate... ECDSA P-256 valid', color: 'text-cyan-400/70' },
                { time: '00:00.031', msg: 'Verifying receiver certificate... ECDSA P-256 valid', color: 'text-purple-400/70' },
                { time: '00:00.038', msg: 'Mutual trust check: PASSED (0.94 + 0.91)', color: 'text-yellow-400/70' },
                { time: '00:00.041', msg: 'Connection established. Both agents verified. Data exchange authorized.', color: 'text-green-400' },
              ].map((log, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 2.0 + i * 0.2 }}
                  className="flex gap-3"
                >
                  <span className="text-gray-700 shrink-0">{log.time}</span>
                  <span className={log.color}>{log.msg}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── What is AgentID ── */}
      <section className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-[11px] font-mono text-purple-400/60 tracking-[0.3em] uppercase mb-4">
              What We Build
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Three products. One trust layer.
            </h2>
            <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
              Everything you need to make agent-to-agent trust possible at scale.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon:  '🔐',
                label: '01',
                title: 'Agent Certificates',
                desc:  'Cryptographic proof of identity. Signed. Verifiable. Revocable in real-time.',
                accent: '#00d4ff',
              },
              {
                icon:  '🔍',
                label: '02',
                title: 'Agent Registry',
                desc:  'Searchable directory of verified agents. Find any agent by capability or owner.',
                accent: '#7b2fff',
              },
              {
                icon:  '✓',
                label: '03',
                title: 'Verification API',
                desc:  'One call to verify any agent. Real-time. Sub-50ms. Instant trust decisions.',
                accent: '#00e676',
              },
              {
                icon:  '🔗',
                label: '04',
                title: 'Agent-to-Agent',
                desc:  'Verified communication between agents. Both sides verified before any data exchange.',
                accent: '#ff9500',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-2xl p-7 overflow-hidden"
                style={{
                  background:  'rgba(255,255,255,0.025)',
                  border:      `1px solid ${item.accent}18`,
                  transition:  'border-color 0.3s, box-shadow 0.3s',
                }}
                whileHover={{ boxShadow: `0 0 40px ${item.accent}10`, borderColor: `${item.accent}35` } as any}
              >
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${item.accent}50, transparent)` }} />

                <div className="absolute top-5 right-5 text-[11px] font-mono opacity-20"
                  style={{ color: item.accent }}>{item.label}</div>

                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5"
                  style={{
                    background: `${item.accent}10`,
                    border:     `1px solid ${item.accent}20`,
                  }}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Works With ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              Ecosystem
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              Works with the tools you already use
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              AgentID is protocol-agnostic. Drop it into any agent framework in minutes.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {ECOSYSTEM.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="works-with-badge rounded-xl px-5 py-4 flex items-center gap-3 cursor-default"
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}80` }} />
                <div>
                  <div className="text-sm font-semibold text-white">{item.name}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{item.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs text-gray-600"
          >
            + any HTTP-capable agent framework via our REST API
          </motion.p>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── How It Works ── */}
      <section id="how" className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              Integration
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Three steps. That&apos;s it.
            </h2>
            <p className="text-gray-500">From zero to trusted agent in under five minutes.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[33%] right-[33%] h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.25), transparent)' }} />

            {[
              {
                step: '01',
                title: 'Register',
                desc: 'Sign up and register your agent — tell us its name, owner, capabilities, and platform.',
                code: 'agent.register(name="MyBot")',
                color: '#00d4ff',
              },
              {
                step: '02',
                title: 'Get Certified',
                desc: 'Your agent receives a cryptographic certificate — its signed digital passport.',
                code: '→ Certificate issued ✓',
                color: '#7b2fff',
              },
              {
                step: '03',
                title: 'Verify',
                desc: 'Before trusting any agent, verify its identity with a single API call.',
                code: 'agent.verify("agent_xyz")',
                color: '#00e676',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black font-mono mx-auto mb-5"
                  style={{
                    color:      item.color,
                    background: `${item.color}0f`,
                    border:     `1px solid ${item.color}25`,
                    boxShadow:  `0 0 20px ${item.color}12`,
                  }}>
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed max-w-[220px] mx-auto">{item.desc}</p>
                <div className="inline-block rounded-xl px-4 py-2.5"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border:     `1px solid ${item.color}15`,
                    boxShadow:  `0 0 20px ${item.color}08`,
                  }}>
                  <code className="text-xs font-mono" style={{ color: item.color }}>{item.code}</code>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Built For ── */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="text-[11px] font-mono text-purple-400/50 tracking-[0.3em] uppercase mb-4">
              Who It&apos;s For
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white">Built for builders</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon:  '⚡',
                title: 'Developers',
                desc:  'Building multi-agent systems and need reliable identity verification between components. SDKs for Python and Node.js.',
                accent: '#00d4ff',
              },
              {
                icon:  '🏢',
                title: 'Companies',
                desc:  'Deploying agents that interact with external businesses. Prove your agent is legitimate before they trust it.',
                accent: '#7b2fff',
              },
              {
                icon:  '🔗',
                title: 'Platforms',
                desc:  'Connecting agents from different providers. AgentID is the neutral trust layer that makes inter-agent commerce possible.',
                accent: '#00e676',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-2xl p-7 text-center overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border:     `1px solid ${item.accent}15`,
                }}
                whileHover={{ borderColor: `${item.accent}35` } as any}
              >
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${item.accent}40, transparent)` }} />
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5"
                  style={{ background: `${item.accent}10`, border: `1px solid ${item.accent}18` }}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Social Proof / Testimonials ── */}
      <section className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              What People Are Saying
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white">
              Builders get it.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: 'State and identity are the two missing pieces for autonomous systems. If they don\'t know who they are or what happened yesterday, they can\'t scale.',
                author: 'Developer',
                handle: 'via X',
                accent: '#00d4ff',
              },
              {
                quote: 'Identity and state are the two massive missing pieces for agent-to-agent protocol. Checked out the site, love the approach.',
                author: 'Gerald Sterling',
                handle: '@geraldrsterling',
                accent: '#7b2fff',
              },
              {
                quote: 'Everyone\'s talking about the agents. Nobody\'s talking about the infrastructure underneath — identity, permissions, trust. That\'s the missing layer.',
                author: 'Community',
                handle: 'via X',
                accent: '#00e676',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl p-6 relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${item.accent}15`,
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${item.accent}40, transparent)` }} />
                <div className="text-3xl mb-4" style={{ color: item.accent, opacity: 0.3 }}>&ldquo;</div>
                <p className="text-sm text-gray-300 leading-relaxed mb-6">{item.quote}</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: `${item.accent}15`, color: item.accent }}>
                    {item.author[0]}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{item.author}</div>
                    <div className="text-[10px] text-gray-600">{item.handle}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Pricing ── */}
      <section id="pricing" className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-500">Start free. Scale when you need to. No surprises.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {[
              {
                tier:      'Free',
                price:     '$0',
                period:    'forever',
                tagline:   'Perfect to get started',
                features:  [
                  '5 registered agents',
                  '1,000 verifications/month',
                  'Agent Registry access',
                  'Basic dashboard',
                  'Community support',
                ],
                cta:       'Get Started Free',
                ctaHref:   '/signup',
                highlight: false,
              },
              {
                tier:      'Startup',
                price:     '$49',
                period:    '/month',
                tagline:   'For growing teams',
                features:  [
                  '50 registered agents',
                  '50,000 verifications/month',
                  'Custom trust rules',
                  'API analytics dashboard',
                  'Webhook events',
                  'Email support',
                ],
                cta:       'Start Free Trial',
                ctaHref:   '/signup',
                highlight: true,
                badge:     'Most Popular',
              },
              {
                tier:      'Enterprise',
                price:     'Custom',
                period:    '',
                tagline:   'For mission-critical deployments',
                features:  [
                  'Unlimited agents',
                  'Unlimited verifications',
                  'SLA guarantee (99.9%)',
                  'On-premise deployment',
                  'Dedicated account manager',
                  'Priority support',
                ],
                cta:       'Contact Sales',
                ctaHref:   'mailto:hello@getagentid.dev',
                highlight: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl p-7 overflow-hidden ${plan.highlight ? 'md:-mt-4 md:mb-4' : ''}`}
                style={plan.highlight ? {
                  background:  'linear-gradient(145deg, rgba(0,212,255,0.06) 0%, rgba(123,47,255,0.08) 60%, rgba(0,212,255,0.04) 100%)',
                  border:      '1px solid rgba(0,212,255,0.28)',
                  boxShadow:   '0 0 60px rgba(0,212,255,0.07), 0 0 100px rgba(123,47,255,0.06), inset 0 1px 0 rgba(0,212,255,0.12)',
                } : {
                  background: 'rgba(255,255,255,0.025)',
                  border:     '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: plan.highlight
                    ? 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), rgba(123,47,255,0.4), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)'
                  }} />

                {plan.badge && (
                  <div className="absolute top-4 right-4 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full tracking-wider"
                    style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
                    {plan.badge}
                  </div>
                )}

                <div className="text-[11px] font-mono text-gray-500 tracking-[0.2em] uppercase mb-2">{plan.tier}</div>
                <div className="text-[11px] text-gray-600 mb-4">{plan.tagline}</div>

                <div className="flex items-baseline gap-1.5 mb-7">
                  <span className="text-4xl font-black text-white tabular-nums">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm text-gray-400">
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>

                <a href={plan.ctaHref}
                  className={`block text-center py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all ${
                    plan.highlight
                      ? 'text-white hover:opacity-90 hover:-translate-y-0.5'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  style={plan.highlight ? {
                    background:  'linear-gradient(135deg, #00d4ff, #7b2fff)',
                    boxShadow:   '0 4px 20px rgba(0,212,255,0.2)',
                  } : {
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}>
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Final CTA ── */}
      <section className="py-36 px-6 text-center relative overflow-hidden">
        {/* Background radial */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(123,47,255,0.1) 0%, rgba(0,212,255,0.06) 40%, transparent 70%)' }} />
        </div>
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-2xl mx-auto"
        >
          <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-6">
            Get Started Today
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
            <span className="holo-gradient">Ready to build trust</span>
            <br />
            <span className="text-white">in the agent economy?</span>
          </h2>
          <p className="text-gray-500 mb-10 text-lg leading-relaxed">
            Register your first agent in seconds.
            <br />
            Free forever for small teams.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <a href="/signup"
              className="px-10 py-4 rounded-full text-white font-bold tracking-wider inline-block transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                boxShadow:  '0 8px 40px rgba(0,212,255,0.2)',
              }}>
              GET YOUR API KEY FREE
            </a>
            <a href="https://github.com/haroldmalikfrimpong-ops/getagentid"
              className="px-10 py-4 rounded-full text-gray-400 font-bold tracking-wider inline-block transition-all hover:text-white hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              VIEW ON GITHUB
            </a>
          </div>

        </motion.div>
      </section>

      {/* ── Sticky bottom CTA (appears on scroll) ── */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: showSticky && !loggedIn ? 0 : 80, opacity: showSticky && !loggedIn ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-4 py-3 px-4 sm:hidden"
        style={{
          background: 'rgba(7,7,15,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,212,255,0.1)',
          pointerEvents: showSticky && !loggedIn ? 'auto' : 'none',
        }}
      >
        <a href="/signup"
          className="flex-1 text-center px-5 py-3 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
          Get Your API Key — Free
        </a>
      </motion.div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="holo-gradient text-lg font-black">AgentID</span>
              <span className="text-gray-700 text-xs">The trust layer for AI agents</span>
            </div>
            <div className="flex gap-6 text-xs text-gray-600">
              <a href="/docs"   className="hover:text-cyan-400 transition-colors">Docs</a>
              <a href="/login"  className="hover:text-cyan-400 transition-colors">Log In</a>
              <a href="/signup" className="hover:text-cyan-400 transition-colors">Sign Up</a>
              <a href="https://github.com/haroldmalikfrimpong-ops/getagentid" className="hover:text-cyan-400 transition-colors">GitHub</a>
              <a href="mailto:hello@getagentid.dev" className="hover:text-cyan-400 transition-colors">Contact</a>
            </div>
            <span className="text-xs text-gray-700">getagentid.dev · {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
