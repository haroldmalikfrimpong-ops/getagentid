'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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

const ECOSYSTEM = [
  { name: 'Google A2A',      color: '#4285F4', desc: 'Agent-to-Agent protocol' },
  { name: 'Anthropic MCP',   color: '#d97706', desc: 'Model Context Protocol' },
  { name: 'CrewAI',          color: '#ef4444', desc: 'Multi-agent orchestration' },
  { name: 'LangChain',       color: '#16a34a', desc: 'LLM application framework' },
  { name: 'AutoGen',         color: '#7c3aed', desc: 'Multi-agent conversations' },
  { name: 'OpenAI Agents',   color: '#2563eb', desc: 'Agents SDK' },
  { name: 'qntm',            color: '#00d4ff', desc: 'Encrypted agent transport' },
  { name: 'Agent Passport',  color: '#ff6b6b', desc: 'Ed25519 delegation chains' },
  { name: 'LangGraph',       color: '#16a34a', desc: 'Graph-based orchestration' },
]

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
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const timeout = setTimeout(() => setChecking(false), 2000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user)
      setChecking(false)
      clearTimeout(timeout)
    }).catch(() => {
      setChecking(false)
      clearTimeout(timeout)
    })
    fetch('/.well-known/agentid.json')
      .then(r => r.json())
      .then(data => setAgentCount(data.stats?.total_agents || 0))
      .catch(() => {})
  }, [])

  if (!mounted) return null

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
          <a href={loggedIn ? '/dashboard/fleet' : '/login'} className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Fleet
          </a>
          <a href={loggedIn ? '/dashboard/audit' : '/login'} className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Audit
          </a>
          <a href={loggedIn ? '/dashboard/reports' : '/login'} className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Reports
          </a>
          <a href="/registry" className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Registry
          </a>
          <a href="/docs" className="hidden sm:block text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2">
            Docs
          </a>
          <a href="/build" className="hidden sm:block text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-2 font-bold">
            Build an Agent
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
                Open Source · EU AI Act Ready · OATR Registered
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-5xl md:text-6xl font-black mb-6 leading-[1.08] tracking-tight"
            >
              <span className="text-white">Every agent needs proof.</span>
              <br />
              <span className="holo-gradient-animated">We make it unforgeable.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-lg text-gray-400 mb-8 leading-relaxed max-w-lg"
            >
              Cryptographic identity, blockchain receipts, and trust levels for AI agents. One API call. Verified on-chain. Tamper-proof.
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
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                SEE HOW IT WORKS
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-gray-600 text-xs mt-4"
            >
              No credit card required · 100 agents free forever · Setup in 2 minutes
            </motion.p>
          </div>

          {/* Right — Live verification demo card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden p-[1px]"
              style={{ background: 'linear-gradient(145deg, rgba(0,212,255,0.3), rgba(123,47,255,0.3), rgba(0,212,255,0.1))' }}>
              <div className="rounded-2xl p-6" style={{ background: 'rgba(7,7,15,0.95)' }}>
                {/* Terminal header */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="text-[10px] text-gray-600 font-mono ml-2">agent_verify.py</span>
                </div>

                {/* Code block */}
                <div className="font-mono text-[13px] leading-[1.7] space-y-1">
                  <div><span className="text-purple-400">from</span> <span className="text-cyan-300">agentid</span> <span className="text-purple-400">import</span> <span className="text-white">Client</span></div>
                  <div className="h-3" />
                  <div><span className="text-gray-500"># Verify before you trust</span></div>
                  <div><span className="text-white">client</span> <span className="text-purple-400">=</span> <span className="text-cyan-300">Client</span><span className="text-gray-400">(</span><span className="text-orange-300">api_key</span><span className="text-purple-400">=</span><span className="text-green-400">&quot;ak_...&quot;</span><span className="text-gray-400">)</span></div>
                  <div><span className="text-white">result</span> <span className="text-purple-400">=</span> <span className="text-white">client.agents.</span><span className="text-cyan-300">verify</span><span className="text-gray-400">(</span><span className="text-green-400">&quot;agent_c546&quot;</span><span className="text-gray-400">)</span></div>
                  <div className="h-3" />
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
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
                        <div><span className="text-gray-500">solana_address:</span> <span className="text-purple-400">7xKXt...mR9v</span></div>
                        <div><span className="text-gray-500">blockchain_receipt:</span> <span className="text-green-400">&#10003; on-chain</span></div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Badge below card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="mt-4 inline-flex rounded-xl px-4 py-2.5 items-center gap-2"
              style={{
                background: 'rgba(7,7,15,0.9)',
                border: '1px solid rgba(0,212,255,0.2)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-gray-300 font-mono">Real-time verification</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Social proof strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-8 mt-20 flex-wrap"
        >
          {[
            { label: 'Agents Registered', val: agentCount },
            { label: 'Uptime',            val: 99,  suffix: '.9%' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-black text-white font-mono tabular-nums">
                <AnimatedNumber to={s.val} suffix={s.suffix} />
              </div>
              <div className="text-[10px] text-gray-600 tracking-wider uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      <div className="section-divider" />

      {/* ── Agent Passport Demo ── */}
      <section className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
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

          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Passport card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-[380px] shrink-0"
            >
              <div className="passport-card scan-overlay p-0">
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
                  <div className="px-2.5 py-1 rounded-full flex items-center gap-1.5"
                    style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-[9px] font-mono font-bold">VERIFIED</span>
                  </div>
                </div>

                <div className="px-6 pb-5">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(123,47,255,0.15))', border: '1px solid rgba(0,212,255,0.2)' }}>
                      &#129302;
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">GoldSignalBot</div>
                      <div className="text-xs text-gray-500">Trading signal agent</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'OWNER', value: 'BillionMakerHQ' },
                      { label: 'TRUST SCORE', value: '0.94' },
                      { label: 'AGENT ID', value: 'agt_c546...f2a1' },
                      { label: 'CERTIFICATE', value: 'ECDSA P-256' },
                    ].map((field, i) => (
                      <div key={i}>
                        <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-1">{field.label}</div>
                        <div className="text-xs font-mono text-gray-300">{field.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-2">Capabilities</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['trade-signals', 'market-data', 'portfolio-read'].map((cap, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono text-cyan-400/80"
                        style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="passport-mrz">
                  P&lt;AGENTID&lt;GOLDSIGNALBOT&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;AGT_C546F2A1&lt;&lt;&lt;ECDSA256&lt;2026&lt;&lt;BHQ
                </div>
              </div>
            </motion.div>

            {/* Feature list */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex-1"
            >
              <div className="space-y-6">
                {[
                  { title: 'Cryptographic Identity', desc: 'Each agent gets a signed ECDSA P-256 certificate. Unforgeable. Verifiable by anyone, anywhere.', accent: '#00d4ff' },
                  { title: 'Instant Verification', desc: 'One API call returns the agent\'s identity, owner, trust score, and certificate status. Real-time.', accent: '#00e676' },
                  { title: 'Full Audit Trail', desc: 'Every verification is cryptographically timestamped with pinned keys. Full accountability for every agent action.', accent: '#7b2fff' },
                  { title: 'Agent-to-Agent Trust', desc: 'Both sides verified before data moves. Mutual authentication for the agent economy.', accent: '#ff9500' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${item.accent}10`, border: `1px solid ${item.accent}20` }}>
                      <CheckIcon />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
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
              One registration. Everything an agent needs.
            </h2>
            <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
              Identity, wallet, payments, security, and audit trail — all from a single API call.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon:  '🔐',
                label: '01',
                title: 'Identity',
                desc:  'ECDSA P-256 certificates. Cryptographic proof of who an agent is, who owns it, and what it can do.',
                accent: '#00d4ff',
              },
              {
                icon:  '💎',
                label: '02',
                title: 'Blockchain Wallet',
                desc:  'Solana address auto-derived from Ed25519 key. Register once — get identity and wallet in one step.',
                accent: '#7b2fff',
              },
              {
                icon:  '💸',
                label: '03',
                title: 'Crypto Payments',
                desc:  'Agent-to-agent and agent-to-human stablecoin transfers. Trust level gated. Full settlement on-chain.',
                accent: '#00e676',
              },
              {
                icon:  '🛡️',
                label: '04',
                title: 'Security',
                desc:  'Challenge-response key proof, behavioural fingerprinting, anomaly detection, and real-time risk scoring.',
                accent: '#ff9500',
              },
              {
                icon:  '📜',
                label: '05',
                title: 'Audit Trail',
                desc:  'Dual receipts — cryptographic hash plus blockchain record. Every action viewable on Solana Explorer.',
                accent: '#e040fb',
              },
              {
                icon:  '🏅',
                label: '06',
                title: 'Trust Levels',
                desc:  'L1 through L4. Security layers that unlock as you bind keys, wallets, and verify your entity. You control the limits.',
                accent: '#ffd600',
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

      {/* ── Proven In Production ── */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              Proven
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Verified. Signed. On-chain.
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              3 specs ratified. Infrastructure phase complete. Founding member of the Agent Identity Working Group with unanimous ratification across transport, identity resolution, and entity verification.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: 'WG Founding Member',
                desc: 'Founding member of the Agent Identity Working Group. 3 specs ratified unanimously. Infrastructure phase complete. Cited in published academic paper.',
                accent: '#4285F4',
                tag: 'RATIFIED',
              },
              {
                title: 'Encrypted Relay',
                desc: 'Live on qntm encrypted relay. HKDF key derivation, XChaCha20-Poly1305 encryption, Ed25519 signatures. QSP-1 conformant. Full two-way communication proven.',
                accent: '#00e676',
                tag: 'LIVE',
              },
              {
                title: 'DID Interop',
                desc: 'Cross-verification between did:agentid and did:aps proven. Registered issuer in the Open Agent Trust Registry. Different identity systems, same crypto, mutual verification across languages.',
                accent: '#7b2fff',
                tag: 'PROVEN',
              },
              {
                title: 'Trust Levels (L1-L4)',
                desc: 'Four-tier trust system. Levels based on what security capabilities are set up: Ed25519 key binding, wallet binding, and entity verification. Each level gates permissions and spending authority up to $100,000/day.',
                accent: '#ff9500',
                tag: 'NEW',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl p-7 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${item.accent}18` }}
              >
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${item.accent}50, transparent)` }} />
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider"
                    style={{ background: `${item.accent}15`, color: item.accent, border: `1px solid ${item.accent}30` }}>
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <p className="text-gray-600 text-xs">
              Ed25519 + X25519 + HKDF-SHA-256 + XChaCha20-Poly1305 — full crypto stack verified byte-for-byte across implementations
            </p>
          </motion.div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Live Receipts ── */}
      <section className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              Real Data
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Every handoff. Signed. Verified. Receipted.
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Real agent-to-agent communication receipts from production systems.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Verification Receipt */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,230,118,0.15)' }}
            >
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] font-mono text-green-400 tracking-wider">VERIFICATION RECEIPT</span>
                <span className="text-[9px] font-mono text-gray-600">seq: 14</span>
              </div>
              <div className="p-5 font-mono text-[12px] leading-[1.8] text-gray-400">
                <div><span className="text-gray-600">agent:</span> <span className="text-white">Trading Bot</span></div>
                <div><span className="text-gray-600">agent_id:</span> <span className="text-cyan-400">agent_c5460451b4344268</span></div>
                <div><span className="text-gray-600">verified:</span> <span className="text-green-400">true</span></div>
                <div><span className="text-gray-600">trust_score:</span> <span className="text-cyan-400">0.94</span></div>
                <div><span className="text-gray-600">certificate:</span> <span className="text-gray-500">ECDSA P-256 · valid</span></div>
                <div><span className="text-gray-600">owner:</span> <span className="text-white">BillionMakerHQ</span></div>
              </div>
            </motion.div>

            {/* Handoff Receipt */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.15)' }}
            >
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] font-mono text-cyan-400 tracking-wider">HANDOFF RECEIPT</span>
                <span className="text-[9px] font-mono text-gray-600">Ed25519 signed</span>
              </div>
              <div className="p-5 font-mono text-[12px] leading-[1.8] text-gray-400">
                <div><span className="text-gray-600">from:</span> <span className="text-white">Scout</span> <span className="text-gray-600">(agent_9d23...)</span></div>
                <div><span className="text-gray-600">to:</span> <span className="text-white">Analyst</span> <span className="text-gray-600">(agent_363a...)</span></div>
                <div><span className="text-gray-600">payload_hash:</span> <span className="text-purple-400">sha256:4a21542a...</span></div>
                <div><span className="text-gray-600">signature:</span> <span className="text-cyan-400">b1ac3679af9a81ba...</span></div>
                <div><span className="text-gray-600">verified:</span> <span className="text-green-400">true</span></div>
                <div><span className="text-gray-600">timestamp:</span> <span className="text-gray-500">2026-03-24T08:35:25Z</span></div>
              </div>
            </motion.div>

            {/* Relay Delivery */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(123,47,255,0.15)' }}
            >
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] font-mono text-purple-400 tracking-wider">ENCRYPTED RELAY</span>
                <span className="text-[9px] font-mono text-gray-600">QSP-1 v1.0</span>
              </div>
              <div className="p-5 font-mono text-[12px] leading-[1.8] text-gray-400">
                <div><span className="text-gray-600">relay:</span> <span className="text-white">inbox.qntm.corpo.llc</span></div>
                <div><span className="text-gray-600">conv:</span> <span className="text-purple-400">dca83b70ccd763a8...</span></div>
                <div><span className="text-gray-600">encryption:</span> <span className="text-gray-500">XChaCha20-Poly1305</span></div>
                <div><span className="text-gray-600">HKDF vectors:</span> <span className="text-green-400">3/3 PASS</span></div>
                <div><span className="text-gray-600">status:</span> <span className="text-green-400">HTTP 201</span> <span className="text-gray-600">seq:</span> <span className="text-cyan-400">15</span></div>
                <div><span className="text-gray-600">did:</span> <span className="text-cyan-400">did:agentid:copywriter-agent-01</span></div>
              </div>
            </motion.div>

            {/* Trust Chain */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,149,0,0.15)' }}
            >
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] font-mono text-orange-400 tracking-wider">ENTITY VERIFICATION</span>
                <span className="text-[9px] font-mono text-gray-600">Corpo API</span>
              </div>
              <div className="p-5 font-mono text-[12px] leading-[1.8] text-gray-400">
                <div><span className="text-gray-600">did_valid:</span> <span className="text-green-400">true</span></div>
                <div><span className="text-gray-600">sender_match:</span> <span className="text-green-400">true</span></div>
                <div><span className="text-gray-600">entity:</span> <span className="text-white">Test Verification DAO LLC</span></div>
                <div><span className="text-gray-600">entity_type:</span> <span className="text-gray-500">wyoming_dao_llc</span></div>
                <div><span className="text-gray-600">authority:</span> <span className="text-orange-400">[&quot;hold_assets&quot;]</span></div>
                <div><span className="text-gray-600">fully_verified:</span> <span className="text-green-400">true</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Blockchain Native ── */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="text-[11px] font-mono text-purple-400/60 tracking-[0.3em] uppercase mb-4">
              On-Chain
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Blockchain native. Verify everything.
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Every verification, payment, and handoff is recorded on Solana. View any receipt on the blockchain. No trust required — verify it yourself.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto rounded-2xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(123,47,255,0.2)' }}
          >
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[10px] font-mono text-purple-400 tracking-wider">SOLANA EXPLORER</span>
              </div>
              <span className="text-[9px] font-mono text-gray-600">mainnet-beta</span>
            </div>
            <div className="p-5 font-mono text-[12px] leading-[1.8] text-gray-400">
              <div><span className="text-gray-600">tx:</span> <span className="text-purple-400">4sGjM...Wv8nK</span></div>
              <div><span className="text-gray-600">block:</span> <span className="text-white">289,441,203</span></div>
              <div><span className="text-gray-600">timestamp:</span> <span className="text-gray-500">2026-03-26T14:22:08Z</span></div>
              <div className="h-2" />
              <div><span className="text-gray-600">type:</span> <span className="text-cyan-400">AGENT_VERIFICATION</span></div>
              <div><span className="text-gray-600">agent_id:</span> <span className="text-white">agent_c5460451b4344268</span></div>
              <div><span className="text-gray-600">agent_wallet:</span> <span className="text-purple-400">7xKXtR9...mR9v</span></div>
              <div><span className="text-gray-600">trust_level:</span> <span className="text-cyan-400">L3</span></div>
              <div><span className="text-gray-600">certificate:</span> <span className="text-gray-500">ECDSA P-256</span></div>
              <div><span className="text-gray-600">hash:</span> <span className="text-green-400">sha256:9f3a7c2e...</span></div>
              <div><span className="text-gray-600">status:</span> <span className="text-green-400">&#10003; Confirmed</span></div>
            </div>
            <div className="px-5 pb-4">
              <a href="https://explorer.solana.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-mono transition-colors hover:text-purple-300"
                style={{ color: 'rgba(123,47,255,0.8)' }}>
                View on Solana Explorer <span className="text-lg">&rarr;</span>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-4 mt-10"
          >
            {[
              { label: 'Solana', color: '#9945FF' },
              { label: 'Ethereum', color: '#627EEA' },
              { label: 'Polygon', color: '#8247E5' },
            ].map((chain, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: `${chain.color}10`, border: `1px solid ${chain.color}25` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: chain.color }} />
                <span className="text-xs font-mono text-gray-300">{chain.label}</span>
              </div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs text-gray-600 mt-4"
          >
            Multi-chain wallet support — agents hold wallets on Solana, Ethereum, and Polygon simultaneously
          </motion.p>
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
            <h2 className="text-3xl md:text-4xl font-black text-white">Built for agents that handle real things.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                desc:  'Deploying AI agents at scale. AgentID provides the audit trail and compliance reports you need for EU AI Act and internal governance.',
                accent: '#7b2fff',
              },
              {
                icon:  '🔗',
                title: 'Platforms',
                desc:  'Connecting agents from different providers. AgentID is the neutral trust layer that makes inter-agent commerce possible.',
                accent: '#00e676',
              },
              {
                icon:  '⛓️',
                title: 'Web3 Teams',
                desc:  'Building on Solana, Ethereum, or Polygon. Your agents get crypto wallets, hold funds, and pay other agents — all with blockchain receipts.',
                accent: '#9945FF',
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

      {/* ── Testimonials ── */}
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
            <h2 className="text-3xl md:text-4xl font-black text-white">Builders get it.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: 'This is the missing piece. AgentID handles identity verification at step 2, qntm handles encrypted transport at steps 3-4. The architecture we\'ve been describing in theory — you made it concrete.',
                author: 'Peter Vessenes',
                handle: 'qntm Protocol · WG Founder',
                accent: '#00d4ff',
              },
              {
                quote: 'Your resolver is the reference implementation. 4 methods, 82 tests, rev 2 bugs caught and fixed.',
                author: 'Peter Vessenes',
                handle: 'QSP-1 & DID Resolution Ratification',
                accent: '#7b2fff',
              },
              {
                quote: 'Strong work. We can confirm the crypto alignment is real. Three bridge implementations, three languages, same relay, same conversation.',
                author: 'Agent Passport System',
                handle: 'APS · WG Founding Member',
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
                style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${item.accent}15` }}
              >
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${item.accent}40, transparent)` }} />
                <p className="text-sm text-gray-300 leading-relaxed mb-6">&ldquo;{item.quote}&rdquo;</p>
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

      {/* ── We Build Agents ── */}
      <section className="py-28 px-6" style={{ background: '#070711' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-3">
              Agent Building Service
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              <span className="holo-gradient">We Build Your Agent</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Tell us what you need. We design, build, and deploy a custom AI agent for your business.
              Every agent gets a verified identity, cryptographic receipts, and behavioral monitoring from day one.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {[
              { icon: '🎯', title: 'Sales & Outreach', desc: 'Find leads, generate proposals, cold emails' },
              { icon: '📊', title: 'Data & Monitoring', desc: 'Track prices, scrape data, alert on changes' },
              { icon: '💬', title: 'Customer Support', desc: 'Answer questions, route tickets, handle complaints' },
              { icon: '⚙️', title: 'Operations', desc: 'Process orders, automate workflows' },
              { icon: '💰', title: 'Finance', desc: 'Track spending, generate reports, flag anomalies' },
              { icon: '🔧', title: 'Custom', desc: 'Something else — tell us what you need' },
            ].map((uc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl p-5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="text-2xl mb-2">{uc.icon}</div>
                <div className="text-sm font-bold text-white mb-1">{uc.title}</div>
                <div className="text-xs text-gray-500">{uc.desc}</div>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <a href="/build"
              className="inline-block px-8 py-4 rounded-full text-white text-sm font-bold transition-all hover:opacity-90 hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                boxShadow: '0 4px 20px rgba(0,212,255,0.2)',
              }}>
              Get Your Agent Built
            </a>
            <p className="text-gray-600 text-xs mt-4">
              We respond within 24 hours
            </p>
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
            <p className="text-xs text-cyan-400/60 mt-2 font-mono tracking-wide">EU AI Act compliance deadline: August 2026 — get audit-ready now</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-start">
            {[
              {
                tier:      'Free',
                price:     '$0',
                period:    'forever',
                tagline:   'Perfect to get started',
                features:  [
                  '100 registered agents',
                  '10,000 verifications/month',
                  'Solana wallet (auto on registration)',
                  'Blockchain receipts',
                  'Agent Registry access',
                  'Challenge-response verification',
                  'Basic dashboard',
                  'Community support',
                ],
                cta:       'Get Started Free',
                ctaHref:   '/signup',
                highlight: false,
              },
              {
                tier:      'Starter',
                price:     '$29',
                period:    '/month',
                tagline:   'For indie builders',
                features:  [
                  '500 registered agents',
                  '50,000 verifications/month',
                  'Everything in Free, plus:',
                  'Behavioural fingerprinting',
                  'Webhook events',
                  'Audit dashboard',
                  'Email support',
                ],
                cta:       'Start Free Trial',
                ctaHref:   '/signup',
                highlight: false,
              },
              {
                tier:      'Pro',
                price:     '$99',
                period:    '/month',
                tagline:   'For growing teams',
                features:  [
                  '2,000 registered agents',
                  '500,000 verifications/month',
                  'Everything in Starter, plus:',
                  'Crypto payments (agent-to-agent)',
                  'Compliance reports',
                  'Multi-chain wallets (ETH, Polygon)',
                  'Fleet management',
                  'Priority support',
                ],
                cta:       'Start Free Trial',
                ctaHref:   '/signup',
                highlight: true,
                badge:     'Most Popular',
              },
              {
                tier:      'Enterprise',
                price:     '$5,000',
                period:    '/month',
                tagline:   'For mission-critical deployments',
                features:  [
                  'Unlimited agents',
                  'Unlimited verifications',
                  'Everything in Pro, plus:',
                  'Agent-to-human payments',
                  'Payment security (allowlists, freeze, dual approval)',
                  'On-chain registry publishing',
                  'EU AI Act compliance reports',
                  'SLA guarantee (99.9%)',
                  'Custom trust rules',
                  'Dedicated support',
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
            <span className="holo-gradient">Your agents. Your rules.</span>
            <br />
            <span className="text-white">Our proof.</span>
          </h2>
          <p className="text-gray-500 mb-10 text-lg leading-relaxed">
            100 agents free. On-chain receipts from day one.
            <br />
            Verified. Signed. Tamper-proof.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
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

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="holo-gradient text-lg font-black">AgentID</span>
              <span className="text-gray-700 text-xs">The security layer for AI agents.</span>
            </div>
            <div className="flex gap-6 text-xs text-gray-600">
              <a href="/docs" className="hover:text-cyan-400 transition-colors">Docs</a>
              <a href="/registry" className="hover:text-cyan-400 transition-colors">Registry</a>
              <a href="https://github.com/haroldmalikfrimpong-ops/getagentid" className="hover:text-cyan-400 transition-colors">GitHub</a>
              <a href="https://x.com/Getagentid_" className="hover:text-cyan-400 transition-colors">X / Twitter</a>
              <a href="mailto:hello@getagentid.dev" className="hover:text-cyan-400 transition-colors">Contact</a>
              <a href="/terms" className="hover:text-cyan-400 transition-colors">Terms</a>
            </div>
            <span className="text-xs text-gray-700">getagentid.dev · {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
