'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

export default function SetupPage() {
  const [apiKey, setApiKey] = useState('')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) {
        // Fetch user's API key
        fetch('/api/v1/keys', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
          .then(r => r.json())
          .then(data => {
            if (data.keys && data.keys.length > 0) {
              setApiKey(data.keys[0].prefix + '...')
            }
          })
          .catch(() => {})
      }
      setLoading(false)
    })
  }, [])

  const claudePrompt = `You are managing AI agents using the AgentID platform (getagentid.dev).

API Base URL: https://www.getagentid.dev/api/v1
API Key: ${apiKey || 'YOUR_API_KEY_HERE'}

Always include this header in every request:
Authorization: Bearer ${apiKey || 'YOUR_API_KEY_HERE'}
Content-Type: application/json

WHAT YOU CAN DO:

1. REGISTER A NEW AGENT
POST /agents/register
Body: { "name": "MyAgent", "description": "What it does", "capabilities": ["trading", "analysis"], "platform": "python" }
Returns: agent_id, certificate, trust_level (starts at L1)

2. VERIFY AN AGENT
POST /agents/verify
Body: { "agent_id": "agent_xxx" }
Returns: verified, trust_score, trust_level, certificate_valid, permissions, spending_limit

3. SEARCH FOR AGENTS
GET /agents/discover?capability=trading&limit=10
Returns: list of agents matching the capability

4. CHECK TRUST LEVEL
GET /agents/trust-level?agent_id=agent_xxx
Returns: trust_level (L1-L4), permissions, spending_limit, level_up_requirements

5. CONNECT TWO AGENTS
POST /agents/connect
Body: { "from_agent": "agent_xxx", "to_agent": "agent_yyy", "message_type": "request", "payload": { "data": "hello" } }
Returns: message_id, receipt (hash + blockchain)

6. SEND A MESSAGE
POST /agents/message
Body: { "message_id": 123, "response": { "status": "acknowledged" } }

7. CHECK INBOX
GET /agents/inbox?agent_id=agent_xxx
Returns: messages with sender trust level and risk score

8. CHECK BALANCE
GET /agents/balance?agent_id=agent_xxx
Returns: SOL and USDC balances (if wallet bound)

9. AGENT-TO-AGENT PAYMENT
POST /agents/pay
Body: { "from_agent_id": "agent_xxx", "to_agent_id": "agent_yyy", "amount": 5, "currency": "usd", "chain": "solana" }
Requires: sender must be L3+ (wallet bound)

10. COMPLIANCE REPORT
GET /reports/compliance
Returns: EU AI Act readiness score, agent inventory, risk flags

11. CREDIBILITY PACKET
GET /agents/credibility-packet?agent_id=agent_xxx
Returns: signed portable trust resume (Ed25519 + HMAC dual-signed, offline verifiable)

12. DAEMON AGENT REGISTRATION
POST /agents/register with agent_type: "daemon", heartbeat_interval: 300, autonomy_level: "semi-autonomous"
For always-on background agents. Also supports "heartbeat" (wake-on-schedule).

TRUST LEVELS:
- L1 (Registered): Can connect, message, verify. Default on registration.
- L2 (Verified): Ed25519 key bound. Can do challenge-response.
- L3 (Secured): Wallet bound. Can make payments up to $10,000/day.
- L4 (Certified): Entity verified. Full authority up to $100,000/day.

To level up an agent:
- L1 to L2: POST /agents/bind-ed25519 with { "agent_id": "xxx", "ed25519_public_key": "64-char-hex" }
- L2 to L3: POST /agents/bind-wallet with { "agent_id": "xxx", "wallet_address": "solana-address", "chain": "solana", "signature": "hex" }

IMPORTANT RULES:
- Every write action generates dual-signed receipts: HMAC-SHA256 + Ed25519, blockchain anchor on Solana
- All receipts use JCS RFC 8785 canonicalization for cross-implementation compatibility
- Trust levels are based on what security features are set up, not time
- Spending limits are defaults the user can lower, not restrictions
- The agent IS the wallet — its Ed25519 key derives a Solana address
- Session continuity is auto-detected: context_continuity_score (0-100) on every verify
- Agent types: interactive (default), daemon (always-on), heartbeat (wake-on-schedule)
- Python SDK: pip install getagentid (v0.5.0, includes DaemonAgent class)`

  const cursorPrompt = `# AgentID Setup for Cursor/Windsurf/Bolt

Add this to your project's .cursorrules or system prompt:

${claudePrompt}`

  function copyPrompt() {
    navigator.clipboard.writeText(claudePrompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 3000)
  }

  function copyApiKey() {
    navigator.clipboard.writeText(apiKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 3000)
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-10">
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-3">
              Setup Guide
            </div>
            <h1 className="text-3xl font-black text-white mb-3">
              Use AgentID with your AI assistant
            </h1>
            <p className="text-gray-500 leading-relaxed">
              Copy the instructions below and paste them into Claude Code, Cursor, Windsurf, Bolt,
              or any AI coding assistant. Your assistant will be able to register agents, verify identities,
              send payments, and manage your entire fleet — all through natural language.
            </p>
          </div>

          {/* Step 1: Get API Key */}
          <div className="rounded-2xl p-6 mb-6"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
                style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                1
              </div>
              <h2 className="text-lg font-bold text-white">Get your API key</h2>
            </div>
            {user ? (
              apiKey ? (
                <div className="flex items-center gap-3">
                  <code className="flex-1 px-4 py-3 rounded-lg text-sm font-mono text-cyan-400"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
                    {apiKey}
                  </code>
                  <a href="/dashboard/keys" className="shrink-0 px-4 py-3 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
                    View Full Key
                  </a>
                </div>
              ) : (
                <a href="/dashboard/keys" className="inline-block px-4 py-3 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
                  Generate API Key
                </a>
              )
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-3">Sign in to get your API key</p>
                <a href="/signup" className="inline-block px-4 py-3 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
                  Sign Up Free
                </a>
              </div>
            )}
          </div>

          {/* Step 2: Copy Instructions */}
          <div className="rounded-2xl p-6 mb-6"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
                style={{ background: 'rgba(123,47,255,0.1)', color: '#a78bfa', border: '1px solid rgba(123,47,255,0.2)' }}>
                2
              </div>
              <h2 className="text-lg font-bold text-white">Copy instructions for your AI assistant</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Paste this into Claude Code, Cursor, Windsurf, or any AI coding tool.
              It tells your assistant everything it needs to manage your agents.
            </p>

            {/* Preview */}
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
              <div className="px-4 py-2 flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] font-mono text-gray-500">AGENT_ID_INSTRUCTIONS.md</span>
                <span className="text-[10px] font-mono text-gray-600">{claudePrompt.length} chars</span>
              </div>
              <pre className="p-4 text-[11px] font-mono text-gray-400 leading-relaxed overflow-auto max-h-[300px]"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                {claudePrompt.slice(0, 800)}...
              </pre>
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={copyPrompt}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: copiedPrompt ? 'rgba(34,197,94,0.1)' : 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                  border: copiedPrompt ? '1px solid rgba(34,197,94,0.3)' : 'none',
                  color: copiedPrompt ? '#22c55e' : 'white',
                }}
              >
                {copiedPrompt ? 'Copied to clipboard!' : 'Copy Full Instructions'}
              </motion.button>
            </div>
          </div>

          {/* Step 3: Use it */}
          <div className="rounded-2xl p-6 mb-6"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
                style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}>
                3
              </div>
              <h2 className="text-lg font-bold text-white">Tell your AI what to do</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              After pasting the instructions, just talk naturally:
            </p>
            <div className="space-y-3">
              {[
                'Register a new agent called "DataBot" with data-analysis capabilities',
                'Verify all my agents and show me their trust levels',
                'Connect my Trading Bot to my Analyst agent and send market data',
                'Generate a compliance report for my agents',
                'Check the balance of my Trading Bot\'s wallet',
                'Show me which agents need security keys',
              ].map((example, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-cyan-400 text-sm shrink-0">{">"}</span>
                  <span className="text-sm text-gray-300">{example}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Works with */}
          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white mb-4">Works with</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'Claude Code', desc: 'Anthropic CLI' },
                { name: 'Cursor', desc: 'AI code editor' },
                { name: 'Windsurf', desc: 'AI IDE' },
                { name: 'Bolt', desc: 'Stackblitz AI' },
              ].map((tool, i) => (
                <div key={i} className="text-center py-3 px-2 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-xs font-bold text-white">{tool.name}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{tool.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
