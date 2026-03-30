'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

// ─── Sidebar sections ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'trust-levels', label: 'Trust Levels' },
  { id: 'api-register', label: 'Register Agent' },
  { id: 'api-verify', label: 'Verify Agent' },
  { id: 'api-discover', label: 'Discover Agents' },
  { id: 'api-trust-level', label: 'Trust Level' },
  { id: 'api-connect', label: 'Connect Agents' },
  { id: 'api-message', label: 'Send Message' },
  { id: 'api-inbox', label: 'Inbox' },
  { id: 'api-bind-ed25519', label: 'Bind Ed25519' },
  { id: 'api-bind-wallet', label: 'Bind Wallet' },
  { id: 'api-wallet', label: 'Get Wallet' },
  { id: 'api-balance', label: 'Check Balance' },
  { id: 'api-challenge', label: 'Challenge' },
  { id: 'api-challenge-verify', label: 'Challenge Verify' },
  { id: 'api-pay', label: 'Pay' },
  { id: 'api-payment-settings-get', label: 'Payment Settings (GET)' },
  { id: 'api-payment-settings-post', label: 'Payment Settings (POST)' },
  { id: 'api-publish-onchain', label: 'Publish On-Chain' },
  { id: 'api-behaviour', label: 'Behaviour' },
  { id: 'api-trust-header', label: 'Trust Header' },
  { id: 'api-compliance', label: 'Compliance Report' },
  { id: 'api-proof', label: 'Proof Verification' },
  { id: 'sdks', label: 'SDKs' },
  { id: 'receipts', label: 'Receipts' },
]

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-mono transition-all"
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
        color: copied ? '#22c55e' : '#6b7280',
        border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Code block ──────────────────────────────────────────────────────────────

function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden my-4" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
      {lang && (
        <div className="px-4 py-1.5 flex items-center justify-between"
          style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{lang}</span>
        </div>
      )}
      <pre className="p-4 text-[13px] font-mono text-gray-300 leading-relaxed overflow-x-auto"
        style={{ background: 'rgba(0,0,0,0.4)' }}>
        {children}
      </pre>
      <CopyButton text={children} />
    </div>
  )
}

// ─── Method badge ────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    GET: { bg: 'rgba(0,212,255,0.1)', text: '#00d4ff', border: 'rgba(0,212,255,0.25)' },
    POST: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  }
  const c = colors[method] || colors.GET
  return (
    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {method}
    </span>
  )
}

// ─── Endpoint heading ────────────────────────────────────────────────────────

function Endpoint({ id, method, path, description, trustLevel }: {
  id: string; method: string; path: string; description: string; trustLevel?: string
}) {
  return (
    <div id={id} className="scroll-mt-24 mb-4">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <MethodBadge method={method} />
        <code className="text-white font-mono text-sm">{path}</code>
        {trustLevel && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(123,47,255,0.1)', color: '#a78bfa', border: '1px solid rgba(123,47,255,0.25)' }}>
            {trustLevel}
          </span>
        )}
      </div>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-black text-white mb-6 pt-10 first:pt-0">
      {children}
    </h2>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="section-divider my-10" />
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('quick-start')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen pt-16" style={{ background: '#07070f' }}>
      <div className="max-w-[1400px] mx-auto flex">

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="fixed top-16 w-64 h-[calc(100vh-4rem)] overflow-y-auto py-8 pl-6 pr-4">
            <div className="text-[10px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-4">
              Documentation
            </div>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setMobileNavOpen(false)}
                className="block py-1.5 text-xs transition-all rounded px-2 -mx-2"
                style={{
                  color: activeSection === s.id ? '#00d4ff' : '#6b7280',
                  background: activeSection === s.id ? 'rgba(0,212,255,0.06)' : 'transparent',
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Mobile nav toggle ── */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' }}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={mobileNavOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>

        {/* ── Mobile sidebar overlay ── */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <nav className="absolute left-0 top-0 bottom-0 w-72 overflow-y-auto py-20 px-6"
              style={{ background: '#0a0a14', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setMobileNavOpen(false)}
                  className="block py-2 text-sm transition-all"
                  style={{ color: activeSection === s.id ? '#00d4ff' : '#6b7280' }}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* ── Main content ── */}
        <main ref={mainRef} className="flex-1 min-w-0 px-6 md:px-10 py-8 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* ── Header ── */}
            <div className="mb-12">
              <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-3">
                API Reference
              </div>
              <h1 className="text-4xl font-black mb-3">
                <span className="holo-gradient">AgentID Documentation</span>
              </h1>
              <p className="text-gray-500 leading-relaxed max-w-2xl">
                Everything you need to register, verify, connect, and pay AI agents.
                Works with any language, any framework, any LLM.
              </p>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                QUICK START
            ════════════════════════════════════════════════════════════════════ */}

            <SectionHeading id="quick-start">Quick Start</SectionHeading>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <a href="/dashboard/keys"
                className="glow-border rounded-xl p-5 bg-[#111118] block group">
                <div className="text-xs text-cyan-400 font-mono mb-1">Step 1</div>
                <div className="text-white font-bold text-sm group-hover:text-cyan-300 transition-colors">
                  Get your API key
                </div>
                <p className="text-gray-600 text-xs mt-1">Generate a key from your dashboard</p>
              </a>
              <a href="/setup"
                className="glow-border rounded-xl p-5 bg-[#111118] block group">
                <div className="text-xs text-purple-400 font-mono mb-1">Or</div>
                <div className="text-white font-bold text-sm group-hover:text-purple-300 transition-colors">
                  Use with Claude Code
                </div>
                <p className="text-gray-600 text-xs mt-1">Copy-paste instructions for any AI assistant</p>
              </a>
            </div>

            <p className="text-gray-400 text-sm mb-2">Register your first agent with a single request:</p>

            <Code lang="bash">{`curl -X POST https://www.getagentid.dev/api/v1/agents/register \\
  -H "Authorization: Bearer agentid_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My First Agent",
    "description": "A trading bot that analyses gold markets",
    "capabilities": ["trading", "gold-signals"],
    "platform": "python"
  }'`}</Code>

            <p className="text-gray-500 text-xs mb-1">Response (201 Created):</p>

            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "name": "My First Agent",
  "certificate": "eyJhbGciOiJIUzI1NiJ9...",
  "trust_level": 1,
  "trust_level_label": "L1 — Registered",
  "permissions": ["connect", "send_message", "verify", "discover"],
  "spending_limit": 0,
  "message": "Your agent is at L1 (Registered). It can connect, message, and verify immediately.",
  "next_step": {
    "action": "Bind an Ed25519 key to reach L2 (Verified)",
    "endpoint": "POST /api/v1/agents/bind-ed25519"
  }
}`}</Code>

            <p className="text-gray-500 text-sm">
              Your agent is live. It can connect to other agents and send messages immediately.
            </p>

            <Divider />

            {/* ════════════════════════════════════════════════════════════════════
                AUTHENTICATION
            ════════════════════════════════════════════════════════════════════ */}

            <SectionHeading id="authentication">Authentication</SectionHeading>

            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              All authenticated endpoints require a Bearer token in the <code className="text-cyan-400 text-xs bg-cyan-400/10 px-1.5 py-0.5 rounded">Authorization</code> header.
              Get your API key from the{' '}
              <a href="/dashboard/keys" className="text-cyan-400 underline hover:text-cyan-300">API Keys page</a>.
            </p>

            <Code lang="http">{`Authorization: Bearer agentid_sk_your_key_here
Content-Type: application/json`}</Code>

            <div className="glow-border rounded-xl p-5 bg-[#111118] my-6">
              <div className="text-xs text-yellow-400 font-bold mb-2">Public endpoints (no API key needed)</div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Some endpoints are public and rate-limited by IP:&ensp;
                <code className="text-cyan-300 text-[11px]">POST /agents/verify</code>,&ensp;
                <code className="text-cyan-300 text-[11px]">GET /agents/discover</code>,&ensp;
                <code className="text-cyan-300 text-[11px]">GET /agents/trust-level</code>,&ensp;
                <code className="text-cyan-300 text-[11px]">GET /agents/wallet</code>,&ensp;
                <code className="text-cyan-300 text-[11px]">GET /agents/balance</code>,&ensp;
                <code className="text-cyan-300 text-[11px]">GET /agents/trust-header</code>.
                Using an API key gives you higher rate limits.
              </p>
            </div>

            <Divider />

            {/* ════════════════════════════════════════════════════════════════════
                TRUST LEVELS
            ════════════════════════════════════════════════════════════════════ */}

            <SectionHeading id="trust-levels">Trust Levels</SectionHeading>

            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Trust levels are based on what security features your agent has set up, not time or usage.
              Every agent starts at L1 and can level up by adding cryptographic capabilities.
            </p>

            <div className="space-y-4 mb-8">
              {/* L1 */}
              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-black text-cyan-400">L1</span>
                  <span className="text-white font-bold text-sm">Registered</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                    style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                    Default on registration
                  </span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed mb-2">
                  Your agent has a signed certificate and can immediately connect, message, verify, and discover other agents.
                </p>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Permissions:</span> connect, send_message, verify, discover
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Spending limit:</span> $0/day (no payments)
                </div>
              </div>

              {/* L2 */}
              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-black text-purple-400">L2</span>
                  <span className="text-white font-bold text-sm">Verified</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed mb-2">
                  Agent has an Ed25519 key bound. It can now prove its identity via cryptographic challenge-response.
                  Binding an Ed25519 key also auto-derives a Solana wallet address.
                </p>
                <div className="text-[11px] text-gray-600 mb-1">
                  <span className="text-gray-500 font-bold">How to reach:</span>{' '}
                  <code className="text-cyan-300">POST /agents/bind-ed25519</code> with a 64-char hex public key
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Unlocks:</span> challenge-response verification, Solana wallet
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Spending limit:</span> $0/day
                </div>
              </div>

              {/* L3 */}
              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-black text-green-400">L3</span>
                  <span className="text-white font-bold text-sm">Secured</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed mb-2">
                  Agent has a crypto wallet bound. It can now make and receive payments on Solana, Ethereum, or Polygon.
                </p>
                <div className="text-[11px] text-gray-600 mb-1">
                  <span className="text-gray-500 font-bold">How to reach:</span>{' '}
                  <code className="text-cyan-300">POST /agents/bind-wallet</code> with a signed binding proof
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Unlocks:</span> agent-to-agent payments, agent-to-human payments
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Spending limit:</span> $10,000/day
                </div>
              </div>

              {/* L4 */}
              <div className="glow-border-purple rounded-xl p-5 bg-[#111118]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-black text-yellow-400">L4</span>
                  <span className="text-white font-bold text-sm">Certified</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed mb-2">
                  Entity verified. The owner behind this agent has completed KYB/entity verification. Full authority.
                </p>
                <div className="text-[11px] text-gray-600 mb-1">
                  <span className="text-gray-500 font-bold">How to reach:</span> Complete entity verification (contact team)
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Unlocks:</span> EU AI Act compliance, full authority
                </div>
                <div className="text-[11px] text-gray-600">
                  <span className="text-gray-500 font-bold">Spending limit:</span> $100,000/day
                </div>
              </div>
            </div>

            {/* Progression visual */}
            <div className="flex items-center gap-0 overflow-x-auto pb-2 mb-4">
              {['L1 Registered', 'L2 Verified', 'L3 Secured', 'L4 Certified'].map((label, i) => (
                <div key={label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{
                        background: [
                          'rgba(0,212,255,0.15)',
                          'rgba(123,47,255,0.15)',
                          'rgba(34,197,94,0.15)',
                          'rgba(250,204,21,0.15)',
                        ][i],
                        color: ['#00d4ff', '#a78bfa', '#22c55e', '#facc15'][i],
                        border: `1px solid ${['rgba(0,212,255,0.3)', 'rgba(123,47,255,0.3)', 'rgba(34,197,94,0.3)', 'rgba(250,204,21,0.3)'][i]}`,
                      }}>
                      L{i + 1}
                    </div>
                    <span className="text-[9px] text-gray-600 mt-1 whitespace-nowrap">{label.split(' ')[1]}</span>
                  </div>
                  {i < 3 && (
                    <div className="w-12 md:w-20 h-px mx-1"
                      style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))' }} />
                  )}
                </div>
              ))}
            </div>

            <Divider />

            {/* ════════════════════════════════════════════════════════════════════
                API REFERENCE
            ════════════════════════════════════════════════════════════════════ */}

            <h2 className="text-2xl font-black text-white mb-2 pt-4">API Reference</h2>
            <p className="text-gray-500 text-sm mb-8">
              Base URL: <code className="text-cyan-400 text-xs bg-cyan-400/10 px-1.5 py-0.5 rounded">https://www.getagentid.dev/api/v1</code>
            </p>

            {/* ── POST /agents/register ── */}
            <Endpoint
              id="api-register"
              method="POST"
              path="/agents/register"
              description="Register a new agent. Returns a signed certificate, keypair, and trust level info. The agent starts at L1 and can connect and message immediately."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "name": "My Trading Bot",
  "description": "Automated gold trading agent",
  "capabilities": ["trading", "gold-signals"],
  "limitations": ["no-pii-handling", "english-only"],
  "platform": "python",
  "endpoint": "https://mybot.example.com/webhook"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1 mt-2">
              <strong className="text-gray-300">limitations</strong> <span className="text-gray-600">(optional)</span> — Array of known limitation strings describing what the agent cannot or should not do. Included in the DID document, credibility packet, and verification response.
            </p>
            <p className="text-gray-500 text-xs mb-1">Response (201):</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "name": "My Trading Bot",
  "owner": "Acme Corp",
  "certificate": "eyJhbGciOiJIUzI1NiJ9...",
  "public_key": "-----BEGIN PUBLIC KEY-----...",
  "private_key": "-----BEGIN PRIVATE KEY-----...",
  "issued_at": "2026-03-27T10:00:00.000Z",
  "expires_at": "2027-03-27T10:00:00.000Z",
  "trust_level": 1,
  "trust_level_label": "L1 — Registered",
  "permissions": ["connect", "send_message", "verify", "discover"],
  "spending_limit": 0,
  "solana_wallet": null,
  "message": "Your agent is at L1 (Registered). It can connect, message, and verify immediately.",
  "next_step": {
    "action": "Bind an Ed25519 key to reach L2 (Verified)",
    "endpoint": "POST /api/v1/agents/bind-ed25519",
    "body": "{ agent_id, ed25519_public_key }"
  }
}`}</Code>

            <Divider />

            {/* ── POST /agents/verify ── */}
            <Endpoint
              id="api-verify"
              method="POST"
              path="/agents/verify"
              description="Verify an agent's identity. Returns trust level, certificate validity, permissions, spending limits, wallet info, behavioural risk score, and a dual receipt. Works with or without an API key (IP rate-limited at 100/hour without a key)."
              trustLevel="Public (API key optional)"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "verified": true,
  "agent_id": "agent_a1b2c3d4e5",
  "name": "My Trading Bot",
  "owner": "Acme Corp",
  "capabilities": ["trading", "gold-signals"],
  "trust_score": 42,
  "trust_level": 2,
  "trust_level_label": "L2 — Verified",
  "permissions": ["connect", "send_message", "verify", "discover", "challenge_response"],
  "spending_limit": 0,
  "certificate_valid": true,
  "active": true,
  "wallet": null,
  "solana_wallet": {
    "solana_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "cluster": "devnet",
    "explorer_url": "https://explorer.solana.com/address/7xKX...?cluster=devnet"
  },
  "receipt": {
    "hash": { "receipt_id": "rcpt_abc123", "data_hash": "a1b2c3...", "signature": "d4e5f6..." },
    "blockchain": { "tx_hash": "5eykt4...", "explorer_url": "https://explorer.solana.com/tx/5eykt4..." }
  },
  "level_up": {
    "current": "L2 — Verified",
    "next": "L3 — Secured",
    "requirements": ["Bind a wallet via POST /agents/bind-wallet"]
  },
  "message": "Agent verified"
}`}</Code>

            <Divider />

            {/* ── GET /agents/discover ── */}
            <Endpoint
              id="api-discover"
              method="GET"
              path="/agents/discover"
              description="Search for active agents by capability or owner. Public endpoint, no API key needed."
              trustLevel="Public"
            />
            <p className="text-gray-500 text-xs mb-1">Query parameters:</p>
            <Code lang="http">{`GET /agents/discover?capability=trading&owner=Acme+Corp&limit=20`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "agents": [
    {
      "agent_id": "agent_a1b2c3d4e5",
      "name": "My Trading Bot",
      "description": "Automated gold trading agent",
      "owner": "Acme Corp",
      "capabilities": ["trading", "gold-signals"],
      "platform": "python",
      "trust_score": 42,
      "verified": true,
      "created_at": "2026-03-27T10:00:00.000Z",
      "last_active": "2026-03-27T12:00:00.000Z"
    }
  ],
  "count": 1
}`}</Code>

            <Divider />

            {/* ── GET /agents/trust-level ── */}
            <Endpoint
              id="api-trust-level"
              method="GET"
              path="/agents/trust-level"
              description="Get the full trust level breakdown for an agent. Public endpoint, IP rate-limited at 200/hour."
              trustLevel="Public"
            />
            <p className="text-gray-500 text-xs mb-1">Query parameters:</p>
            <Code lang="http">{`GET /agents/trust-level?agent_id=agent_a1b2c3d4e5`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "name": "My Trading Bot",
  "trust_level": 2,
  "trust_level_label": "L2 — Verified",
  "permissions": ["connect", "send_message", "verify", "discover", "challenge_response"],
  "spending_limit": 0,
  "level_up_requirements": {
    "current": "L2 — Verified",
    "next": "L3 — Secured",
    "requirements": ["Bind a wallet via POST /agents/bind-wallet"]
  },
  "trust_score_breakdown": {
    "trust_score": 42,
    "verified": true,
    "certificate_valid": true,
    "entity_verified": false,
    "owner_email_verified": true,
    "days_active": 30,
    "successful_verifications": 156,
    "active": true
  }
}`}</Code>

            <Divider />

            {/* ── POST /agents/connect ── */}
            <Endpoint
              id="api-connect"
              method="POST"
              path="/agents/connect"
              description="Send a verified message from one agent to another. Creates a message record with a dual receipt (hash + blockchain). Both agents' trust levels and behavioural risk are checked."
              trustLevel="L1+ required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "from_agent": "agent_sender123",
  "to_agent": "agent_receiver456",
  "message_type": "request",
  "payload": {
    "action": "get_market_data",
    "symbols": ["XAUUSD"]
  }
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response (201):</p>
            <Code lang="json">{`{
  "message_id": 42,
  "status": "pending",
  "sender": {
    "agent_id": "agent_sender123",
    "name": "Trading Bot",
    "verified": true,
    "trust_level": 2,
    "trust_label": "L2 — Verified",
    "risk_score": 0
  },
  "receiver": {
    "agent_id": "agent_receiver456",
    "name": "Market Data Agent",
    "verified": true,
    "trust_level": 3,
    "trust_label": "L3 — Secured"
  },
  "trust_check": {
    "both_verified": true,
    "recommendation": "TRUSTED — both agents verified. Safe to exchange data."
  },
  "receipt": {
    "hash": { "receipt_id": "rcpt_abc123", "data_hash": "a1b2..." },
    "blockchain": { "tx_hash": "5eykt4...", "explorer_url": "https://explorer.solana.com/tx/..." }
  }
}`}</Code>

            <Divider />

            {/* ── POST /agents/message ── */}
            <Endpoint
              id="api-message"
              method="POST"
              path="/agents/message"
              description="Respond to a pending message. Optionally include a payment (requires L3+ sender). The response is recorded with a dual receipt."
              trustLevel="L1+ required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "message_id": 42,
  "response": {
    "status": "acknowledged",
    "data": { "XAUUSD": 2345.67 }
  }
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "message_id": 42,
  "status": "responded",
  "message": "Response sent successfully",
  "sender_trust_level": 2,
  "sender_risk_score": 0,
  "receiver_trust_level": 3,
  "receipt": {
    "hash": { "receipt_id": "rcpt_def456", "data_hash": "c3d4..." },
    "blockchain": { "tx_hash": "3fgh5...", "explorer_url": "https://explorer.solana.com/tx/..." }
  }
}`}</Code>

            <Divider />

            {/* ── GET /agents/inbox ── */}
            <Endpoint
              id="api-inbox"
              method="GET"
              path="/agents/inbox"
              description="Get pending (or all) messages for an agent you own. Each message includes the sender's trust level, risk score, and any associated receipt."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Query parameters:</p>
            <Code lang="http">{`GET /agents/inbox?agent_id=agent_a1b2c3d4e5&status=pending`}</Code>
            <p className="text-gray-500 text-xs mb-1">
              <code className="text-cyan-300 text-[11px]">status</code> can be <code className="text-gray-400 text-[11px]">pending</code>, <code className="text-gray-400 text-[11px]">responded</code>, or <code className="text-gray-400 text-[11px]">all</code>.
            </p>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "count": 1,
  "messages": [
    {
      "message_id": 42,
      "from_agent": "agent_sender123",
      "from_name": "Trading Bot",
      "from_verified": true,
      "from_trust_level": 2,
      "from_trust_label": "L2 — Verified",
      "from_risk_score": 0,
      "message_type": "request",
      "payload": { "action": "get_market_data" },
      "status": "pending",
      "created_at": "2026-03-27T12:00:00.000Z",
      "receipt": { "hash": { "receipt_id": "rcpt_abc123" }, "blockchain": null }
    }
  ]
}`}</Code>

            <Divider />

            {/* ── POST /agents/bind-ed25519 ── */}
            <Endpoint
              id="api-bind-ed25519"
              method="POST"
              path="/agents/bind-ed25519"
              description="Bind an Ed25519 public key to your agent. This upgrades the agent to L2 (Verified) and auto-derives a Solana wallet address from the key."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "ed25519_public_key": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">
              The key must be a 64-character hex string (32 bytes).
            </p>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "ed25519_public_key": "a1b2c3d4e5f6...",
  "solana_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "solana_explorer_url": "https://explorer.solana.com/address/7xKX...?cluster=devnet",
  "certificate": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkFnZW50SUQtRWQyNTUxOSJ9...",
  "issued_at": "2026-03-27T10:00:00.000Z",
  "expires_at": "2027-03-27T10:00:00.000Z",
  "receipt": {
    "hash": { "receipt_id": "rcpt_bind123" },
    "blockchain": { "tx_hash": "4abc..." }
  }
}`}</Code>

            <Divider />

            {/* ── POST /agents/bind-wallet ── */}
            <Endpoint
              id="api-bind-wallet"
              method="POST"
              path="/agents/bind-wallet"
              description="Bind a crypto wallet to your agent. This upgrades the agent to L3 (Secured) and enables payments. You must sign the message 'AgentID:bind:{agent_id}:{wallet_address}' with your wallet private key."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "chain": "solana",
  "signature": "a1b2c3d4e5f6..."
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">
              Supported chains: <code className="text-cyan-300 text-[11px]">solana</code>, <code className="text-cyan-300 text-[11px]">ethereum</code>, <code className="text-cyan-300 text-[11px]">polygon</code>
            </p>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "bound": true,
  "agent_id": "agent_a1b2c3d4e5",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "chain": "solana"
}`}</Code>

            <Divider />

            {/* ── GET /agents/wallet ── */}
            <Endpoint
              id="api-wallet"
              method="GET"
              path="/agents/wallet"
              description="Get the bound wallet address and chain for any agent. Public endpoint."
              trustLevel="Public"
            />
            <Code lang="http">{`GET /agents/wallet?agent_id=agent_a1b2c3d4e5`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "wallet_bound": true,
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "chain": "solana",
  "bound_at": "2026-03-20T14:30:00.000Z"
}`}</Code>

            <Divider />

            {/* ── GET /agents/balance ── */}
            <Endpoint
              id="api-balance"
              method="GET"
              path="/agents/balance"
              description="Check the SOL and USDC balance of an agent's auto-derived Solana wallet. The agent must have an Ed25519 key bound. Public endpoint."
              trustLevel="Public"
            />
            <Code lang="http">{`GET /agents/balance?agent_id=agent_a1b2c3d4e5`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "name": "My Trading Bot",
  "solana_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "cluster": "devnet",
  "balances": {
    "sol": "1.500000000",
    "usdc": "250.000000"
  },
  "explorer_url": "https://explorer.solana.com/address/7xKX...?cluster=devnet"
}`}</Code>

            <Divider />

            {/* ── POST /agents/challenge ── */}
            <Endpoint
              id="api-challenge"
              method="POST"
              path="/agents/challenge"
              description="Generate a random 32-byte challenge for an agent to sign with its Ed25519 private key. The challenge expires after 60 seconds. Agent must have an Ed25519 key bound (L2+)."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "challenge": "f4e8a3b1c7d2e9f0a5b6c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
  "expires_at": "2026-03-27T12:01:00.000Z"
}`}</Code>

            <Divider />

            {/* ── POST /agents/challenge/verify ── */}
            <Endpoint
              id="api-challenge-verify"
              method="POST"
              path="/agents/challenge/verify"
              description="Verify an agent's Ed25519 signature over a previously-issued challenge. Proves the agent holds the private key right now. One-time use per challenge."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5",
  "challenge": "f4e8a3b1c7d2e9f0...",
  "signature": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">
              Signature must be a 128-character hex string (64 bytes).
            </p>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "verified": true,
  "challenge_passed": true,
  "agent_id": "agent_a1b2c3d4e5",
  "active": true,
  "message": "Agent proved possession of private key"
}`}</Code>

            <Divider />

            {/* ── POST /agents/pay ── */}
            <Endpoint
              id="api-pay"
              method="POST"
              path="/agents/pay"
              description="Make a payment from one agent to another (or to a human wallet). The sender must be L3+ (wallet bound). Includes full payment security: spending authority checks, daily limits, allowlists, cooling periods, duplicate detection, and dual-approval for large amounts."
              trustLevel="L3+ required"
            />
            <p className="text-gray-500 text-xs mb-2 font-bold">Agent-to-agent payment:</p>
            <Code lang="json">{`{
  "from_agent_id": "agent_sender123",
  "to_agent_id": "agent_receiver456",
  "amount": 25,
  "currency": "usd",
  "chain": "solana"
}`}</Code>
            <p className="text-gray-500 text-xs mb-2 font-bold">Agent-to-human payment:</p>
            <Code lang="json">{`{
  "from_agent_id": "agent_sender123",
  "to_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": 50,
  "currency": "usd",
  "chain": "solana"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "payment_id": "pay_abc123def456",
  "status": "authorized",
  "from_agent_id": "agent_sender123",
  "from_agent_name": "Trading Bot",
  "to_agent_id": "agent_receiver456",
  "to_agent_name": "Data Provider",
  "amount": 25,
  "currency": "usd",
  "chain": "solana",
  "trust_level": 3,
  "remaining_daily_limit": 9975,
  "receipt": {
    "hash": { "receipt_id": "rcpt_pay123" },
    "blockchain": { "tx_hash": "4xyz...", "explorer_url": "https://explorer.solana.com/tx/..." }
  },
  "expires_at": "2026-03-27T12:10:00.000Z"
}`}</Code>

            <div className="glow-border rounded-xl p-5 bg-[#111118] my-6">
              <div className="text-xs text-yellow-400 font-bold mb-2">Payment security layers</div>
              <ul className="text-gray-400 text-xs leading-relaxed space-y-1">
                <li>1. Trust level spending authority (L3: $10K/day, L4: $100K/day)</li>
                <li>2. Wallet address validation (format + dead wallet check)</li>
                <li>3. Allowlist check (human wallets must be pre-approved)</li>
                <li>4. 24-hour cooling period on first payment to a new wallet</li>
                <li>5. Duplicate detection (same amount + same wallet within 10 min)</li>
                <li>6. Per-recipient daily limits</li>
                <li>7. Dual-approval for large payments (owner must sign off)</li>
                <li>8. Agent freeze (owner can freeze all payments instantly)</li>
              </ul>
            </div>

            <Divider />

            {/* ── GET /agents/payment-settings ── */}
            <Endpoint
              id="api-payment-settings-get"
              method="GET"
              path="/agents/payment-settings"
              description="Get your payment security settings: wallet allowlist, frozen agents, and pending payment approvals."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "allowlist": {
    "count": 2,
    "wallets": [
      { "wallet_address": "7xKXtg...", "chain": "solana", "label": "Treasury", "added_at": "..." }
    ]
  },
  "frozen_agents": {
    "count": 0,
    "agent_ids": []
  },
  "pending_approvals": {
    "count": 1,
    "payments": [
      { "payment_id": "pay_abc123", "amount": 5000, "to_wallet": "..." }
    ]
  }
}`}</Code>

            <Divider />

            {/* ── POST /agents/payment-settings ── */}
            <Endpoint
              id="api-payment-settings-post"
              method="POST"
              path="/agents/payment-settings"
              description="Manage payment security: add/remove wallets from your allowlist, freeze/unfreeze agent payments, approve/deny pending payments."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-2">Available actions:</p>
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-gray-500 text-xs mb-1 font-bold">Add wallet to allowlist:</p>
                <Code lang="json">{`{ "action": "add_allowlist", "wallet_address": "7xKXtg...", "chain": "solana", "label": "Treasury" }`}</Code>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1 font-bold">Remove from allowlist:</p>
                <Code lang="json">{`{ "action": "remove_allowlist", "wallet_address": "7xKXtg..." }`}</Code>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1 font-bold">Freeze agent payments:</p>
                <Code lang="json">{`{ "action": "freeze", "agent_id": "agent_a1b2c3d4e5" }`}</Code>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1 font-bold">Unfreeze agent payments:</p>
                <Code lang="json">{`{ "action": "unfreeze", "agent_id": "agent_a1b2c3d4e5" }`}</Code>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1 font-bold">Approve pending payment:</p>
                <Code lang="json">{`{ "action": "approve_payment", "payment_id": "pay_abc123" }`}</Code>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1 font-bold">Deny pending payment:</p>
                <Code lang="json">{`{ "action": "deny_payment", "payment_id": "pay_abc123" }`}</Code>
              </div>
            </div>

            <Divider />

            {/* ── POST /agents/publish-onchain ── */}
            <Endpoint
              id="api-publish-onchain"
              method="POST"
              path="/agents/publish-onchain"
              description="Publish your agent's identity to the Solana blockchain as an immutable memo. The agent's ID, owner, public key hash, and trust level are recorded on-chain. One-time operation per agent."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Request body:</p>
            <Code lang="json">{`{
  "agent_id": "agent_a1b2c3d4e5"
}`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "tx_hash": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  "explorer_url": "https://explorer.solana.com/tx/5eykt4...?cluster=devnet",
  "registry_address": "AgReg1stryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "cluster": "devnet",
  "memo": {
    "protocol": "agentid",
    "version": 1,
    "agent_id": "agent_a1b2c3d4e5",
    "owner": "Acme Corp",
    "trust_level": 2
  }
}`}</Code>

            <Divider />

            {/* ── GET /agents/behaviour ── */}
            <Endpoint
              id="api-behaviour"
              method="GET"
              path="/agents/behaviour"
              description="Get the behavioural profile and anomaly report for an agent you own. AgentID builds a 30-day baseline of each agent's activity patterns and detects anomalies in real-time. Certificates prove who an agent is — behavioural fingerprinting proves it's still acting like itself."
              trustLevel="API key required"
            />

            <p className="text-gray-400 text-sm mb-4">AgentID monitors four anomaly types:</p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th className="text-left py-2 px-3 text-gray-500 font-mono text-xs">Detection</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-mono text-xs">What it catches</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2 px-3 text-cyan-400 font-mono text-xs">frequency_spike</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">API calls spike 3x+ above baseline. Absolute thresholds (10/25/50 calls/hr) prevent false positives on low-traffic agents.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2 px-3 text-cyan-400 font-mono text-xs">unusual_hour</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">Activity outside the agent{"'"}s typical operating window (derived from 30-day hour distribution).</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2 px-3 text-cyan-400 font-mono text-xs">new_action</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">Agent performs action types never seen in its 30-day history.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-400 font-mono text-xs">trust_drop</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">Trust level or score decreased in last 24 hours — possible compromise or credential revocation.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Code lang="http">{`GET /agents/behaviour?agent_id=agent_a1b2c3d4e5`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "profile": {
    "agent_id": "agent_a1b2c3d4e5",
    "avg_verifications_per_day": 8.2,
    "avg_api_calls_per_hour": 3.4,
    "typical_active_hours": [9, 17],
    "typical_actions": ["verified", "message_sent", "payment_authorized"],
    "last_updated": "2026-03-27T12:00:00.000Z"
  },
  "anomalies": [
    {
      "agent_id": "agent_a1b2c3d4e5",
      "type": "frequency_spike",
      "severity": "medium",
      "description": "API call rate is 5x the baseline average (25 calls in the last hour vs avg 3.4/hr)",
      "detected_at": "2026-03-27T12:00:00.000Z",
      "current_value": 25,
      "baseline_value": 3.4
    }
  ],
  "risk_score": 30
}`}</Code>
            <p className="text-gray-500 text-xs mt-2 mb-0">Risk score: 0 = clean, 100 = compromised. Severity weights: low = 10, medium = 30, high = 50. Anomalies are also checked during agent-to-agent connections and verifications.</p>

            <Divider />

            {/* ── GET /agents/trust-header ── */}
            <Endpoint
              id="api-trust-header"
              method="GET"
              path="/agents/trust-header"
              description="Get a signed Agent-Trust-Score JWT for an agent. The JWT is a short-lived (1 hour) token containing trust level, risk score, attestation count, and scarring score. Attach it as an HTTP header so receiving services can evaluate trust at the transport layer without calling back to AgentID."
              trustLevel="Public"
            />
            <p className="text-gray-500 text-xs mb-1">Query parameters:</p>
            <Code lang="http">{`GET /agents/trust-header?agent_id=agent_a1b2c3d4e5`}</Code>
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "header": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkFnZW50LVRydXN0LVNjb3JlIn0...",
  "payload": {
    "trust_level": 3,
    "attestation_count": 43,
    "last_verified": "2026-03-29T14:00:00Z",
    "risk_score": 0,
    "scarring_score": 2,
    "negative_signals": 2,
    "resolved_signals": 2,
    "agent_id": "agent_a1b2c3d4e5",
    "did": "did:web:getagentid.dev:agent:agent_a1b2c3d4e5",
    "provider": "agentid",
    "iss": "https://getagentid.dev",
    "iat": 1743260400,
    "exp": 1743264000
  },
  "expires_in": 3600
}`}</Code>
            <p className="text-gray-500 text-xs mt-2 mb-0">
              Use the <code className="text-cyan-300 text-[11px]">header</code> value as the{' '}
              <code className="text-cyan-300 text-[11px]">Agent-Trust-Score</code> HTTP header when calling other services.
              The receiving service decodes the JWT to get trust metadata without any API call back to AgentID.
              See the full spec at <code className="text-cyan-300 text-[11px]">specs/agent-trust-score-header-v0.1.md</code>.
            </p>

            <Divider />

            {/* ── GET /reports/compliance ── */}
            <Endpoint
              id="api-compliance"
              method="GET"
              path="/reports/compliance"
              description="Generate a full compliance report for all your agents. Includes agent inventory, trust level distribution, verification stats, spending summary, risk flags, and EU AI Act readiness score."
              trustLevel="API key required"
            />
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "report": {
    "generated_at": "2026-03-27T12:00:00.000Z",
    "period_start": "2026-02-25T12:00:00.000Z",
    "period_end": "2026-03-27T12:00:00.000Z",
    "version": "1.0.0"
  },
  "agent_inventory": [
    {
      "agent_id": "agent_a1b2c3d4e5",
      "name": "My Trading Bot",
      "trust_level": 3,
      "trust_level_label": "L3 — Secured",
      "certificate_valid": true,
      "spending_limit": 10000
    }
  ],
  "verification_summary": {
    "total_verifications": 500,
    "successful": 498,
    "failed": 2,
    "success_rate": 99.6
  },
  "trust_level_distribution": {
    "L1 — Registered": 2,
    "L2 — Verified": 3,
    "L3 — Secured": 4,
    "L4 — Certified": 1
  },
  "risk_flags": [
    {
      "agent_id": "agent_old123",
      "severity": "critical",
      "type": "expired_certificate",
      "message": "Certificate expired. Renew immediately."
    }
  ],
  "eu_ai_act_readiness": {
    "score": 78.5,
    "total_agents": 10,
    "compliant_agents": 7
  }
}`}</Code>

            <Divider />

            {/* ── GET /proof/:receipt_id ── */}
            <Endpoint
              id="api-proof"
              method="GET"
              path="/proof/:receipt_id"
              description="Public proof verification endpoint. Anyone with a receipt_id can independently verify the receipt, including its HMAC signature, blockchain anchor, and ArkForge third-party attestation. No authentication required."
              trustLevel="Public"
            />
            <p className="text-gray-500 text-xs mb-1">Response:</p>
            <Code lang="json">{`{
  "verified": true,
  "protocol": "agentid",
  "version": 1,
  "receipt_id": "a1b2c3d4-...",
  "action": "verification",
  "agent": {
    "agent_id": "agent_abc123",
    "name": "My Trading Bot",
    "owner": "Acme Corp",
    "did": "did:web:getagentid.dev:agent:agent_abc123"
  },
  "timestamp": "2026-03-28T12:00:00.000Z",
  "hashes": {
    "data_hash": "sha256hex...",
    "signature": "hmacsha256hex..."
  },
  "blockchain_anchor": {
    "chain": "solana",
    "cluster": "devnet",
    "tx_hash": "5eykt4UsFv8P8NJdT...",
    "explorer_url": "https://explorer.solana.com/tx/5eykt4..."
  },
  "arkforge_attestation": {
    "proof_id": "ark_proof_xyz",
    "verification_url": "https://trust.arkforge.tech/v1/proof/ark_proof_xyz"
  },
  "attestation_level": "third-party-attested",
  "verification": {
    "method": "HMAC-SHA256",
    "issuer": "https://getagentid.dev",
    "issuer_did": "did:web:getagentid.dev"
  }
}`}</Code>
            <div className="glow-border rounded-xl p-5 bg-[#111118] mb-6 mt-4">
              <div className="text-xs text-gray-300 font-bold mb-2">Attestation Levels</div>
              <ul className="text-gray-400 text-xs leading-relaxed space-y-1">
                <li><strong className="text-gray-300">self-issued:</strong> HMAC-SHA256 signed by AgentID platform key only</li>
                <li><strong className="text-gray-300">domain-attested:</strong> Additionally anchored on Solana blockchain via memo transaction</li>
                <li><strong className="text-gray-300">third-party-attested:</strong> Independently verified by ArkForge external attestation service</li>
              </ul>
            </div>

            <Divider />

            {/* ════════════════════════════════════════════════════════════════════
                SDKS
            ════════════════════════════════════════════════════════════════════ */}

            <SectionHeading id="sdks">SDKs</SectionHeading>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="text-white font-bold text-sm mb-2">Python</div>
                <Code lang="bash">{`pip install getagentid`}</Code>
                <a href="https://pypi.org/project/getagentid/"
                  className="text-cyan-400 text-xs hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">
                  View on PyPI
                </a>
              </div>

              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="text-white font-bold text-sm mb-2">CrewAI Integration</div>
                <p className="text-gray-400 text-xs mb-2">Drop-in trust layer for CrewAI multi-agent workflows.</p>
                <a href="https://github.com/getagentid/getagentid-crewai"
                  className="text-cyan-400 text-xs hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">
                  github.com/getagentid/getagentid-crewai
                </a>
              </div>

              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="text-white font-bold text-sm mb-2">LangChain Integration</div>
                <p className="text-gray-400 text-xs mb-2">Identity and trust for LangChain agent pipelines.</p>
                <a href="https://github.com/getagentid/getagentid-langchain"
                  className="text-cyan-400 text-xs hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">
                  github.com/getagentid/getagentid-langchain
                </a>
              </div>

              <a href="/setup" className="glow-border-purple rounded-xl p-5 bg-[#111118] block group">
                <div className="text-white font-bold text-sm mb-2 group-hover:text-purple-300 transition-colors">
                  Claude Code / Cursor / Windsurf
                </div>
                <p className="text-gray-400 text-xs">
                  Copy-paste instructions for any AI coding assistant. No SDK needed.
                </p>
              </a>
            </div>

            <Divider />

            {/* ════════════════════════════════════════════════════════════════════
                RECEIPTS
            ════════════════════════════════════════════════════════════════════ */}

            <SectionHeading id="receipts">Receipts</SectionHeading>

            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Every write action (connect, message, pay, bind key, verify) generates a <strong className="text-white">dual receipt</strong>:
              a cryptographic hash stored in the database, and an immutable record on the Solana blockchain.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="text-cyan-400 font-bold text-sm mb-3">Hash Receipt</div>
                <p className="text-gray-400 text-xs leading-relaxed mb-3">
                  A SHA-256 hash of the action data, signed by the AgentID server. Stored in the database with a unique receipt ID.
                </p>
                <Code lang="json">{`{
  "receipt_id": "rcpt_abc123",
  "action": "connection",
  "agent_id": "agent_sender123",
  "timestamp": "2026-03-27T12:00:00.000Z",
  "data_hash": "a1b2c3d4e5f6...",
  "signature": "d4e5f6a7b8c9..."
}`}</Code>
              </div>

              <div className="glow-border-purple rounded-xl p-5 bg-[#111118]">
                <div className="text-purple-400 font-bold text-sm mb-3">Blockchain Receipt</div>
                <p className="text-gray-400 text-xs leading-relaxed mb-3">
                  The receipt hash is written to Solana as a memo transaction. Immutable, publicly verifiable, and timestamped by the network.
                </p>
                <Code lang="json">{`{
  "tx_hash": "5eykt4UsFv8P8NJdT...",
  "cluster": "devnet",
  "explorer_url": "https://explorer.solana.com/tx/5eykt4..."
}`}</Code>
                <p className="text-gray-500 text-xs">
                  Click the explorer URL to view the full transaction on Solana Explorer.
                </p>
              </div>
            </div>

            <div className="glow-border rounded-xl p-5 bg-[#111118] mb-6">
              <div className="text-xs text-gray-300 font-bold mb-2">What data is in each receipt?</div>
              <ul className="text-gray-400 text-xs leading-relaxed space-y-1">
                <li><strong className="text-gray-300">Connections:</strong> message_id, from/to agent IDs, trust levels, verification status</li>
                <li><strong className="text-gray-300">Messages:</strong> message_id, from/to agent IDs, trust levels, payment info (if any)</li>
                <li><strong className="text-gray-300">Payments:</strong> payment_id, from/to agent or wallet, amount, currency, chain, trust level</li>
                <li><strong className="text-gray-300">Verifications:</strong> agent_id, trust level, certificate validity, verifier</li>
                <li><strong className="text-gray-300">Key bindings:</strong> agent_id, Ed25519 public key, derived Solana address</li>
              </ul>
            </div>

            {/* Footer */}
            <div className="section-divider mt-16 mb-8" />
            <footer className="text-center pb-8">
              <p className="text-gray-700 text-xs">
                AgentID — <a href="https://getagentid.dev" className="text-gray-600 hover:text-cyan-400 transition-colors">getagentid.dev</a>
              </p>
            </footer>

          </motion.div>
        </main>
      </div>
    </div>
  )
}
