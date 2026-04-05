'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function ShowcasePage() {
  const [agentData, setAgentData] = useState<any>(null)
  const [trustHeader, setTrustHeader] = useState<any>(null)
  const [agentCount, setAgentCount] = useState(0)

  useEffect(() => {
    // Fetch live data from our own endpoints only
    fetch('https://www.getagentid.dev/api/v1/agents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 'agent_d1b7ef01f9af191f' }),
    })
      .then(r => r.json())
      .then(setAgentData)
      .catch(() => {})

    fetch('https://www.getagentid.dev/api/v1/agents/trust-header?agent_id=agent_d1b7ef01f9af191f')
      .then(r => r.json())
      .then(setTrustHeader)
      .catch(() => {})

    fetch('https://www.getagentid.dev/.well-known/agentid.json')
      .then(r => r.json())
      .then(data => setAgentCount(data.stats?.total_agents || 0))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div className="mb-12 text-center">
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-3">
              What We Built
            </div>
            <h1 className="text-4xl font-black mb-4">
              <span className="holo-gradient">The Identity Layer for AI Agents</span>
            </h1>
            <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
              Every agent needs identity. Every action needs a receipt. Every system needs trust.
              AgentID provides all three — cryptographic, verifiable, and open.
            </p>
            {agentCount > 0 && (
              <div className="mt-6 text-3xl font-black text-cyan-400">{agentCount}+ agents registered</div>
            )}
          </div>

          {/* What AgentID Does */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {[
              { title: 'Cryptographic Identity', desc: 'Ed25519 certificates for every agent. W3C DID documents. Verifiable offline with just the public key.', color: '#00d4ff' },
              { title: 'Dual-Signed Receipts', desc: 'Every action produces a receipt signed with HMAC + Ed25519. Publicly verifiable. JCS RFC 8785 canonicalized.', color: '#22c55e' },
              { title: 'Trust Levels L1-L4', desc: 'Capability-based, not time-based. Register and you are L1. Bind Ed25519 key = L2. Bind wallet = L3. Entity verified = L4.', color: '#a78bfa' },
              { title: 'Session Continuity', desc: 'Auto-detects when an agent model or memory changes. Server-side — the agent cannot suppress it. Score 0-100.', color: '#f0a500' },
              { title: 'Behavioral Monitoring', desc: 'Frequency spikes, unusual hours, payload drift, model changes, trust drops. 30-day baseline. Anomalies flagged in real-time.', color: '#ef4444' },
              { title: 'Daemon Agent Support', desc: 'Always-on background agents with heartbeat intervals, autonomy levels, and context shift reporting. Built for KAIROS-style agents.', color: '#00e676' },
              { title: 'Blockchain Anchoring', desc: 'Solana memo transactions for every receipt. Immutable, timestamped, publicly verifiable on Solana Explorer.', color: '#7c3aed' },
              { title: 'We Build Agents', desc: 'Tell us what you need. We design, build, and deploy a custom AI agent for your business. Every agent gets AgentID identity.', color: '#ff6b6b' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl p-5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-white font-bold text-sm">{item.title}</span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Proof Points */}
          <div className="rounded-2xl p-8 mb-12 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white mb-6">Proof Points</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { num: '8/8', label: 'Cross-Protocol Tests' },
                { num: '6/6', label: 'Multi-Attestation Verified' },
                { num: 'L1-L4', label: 'Trust Levels' },
                { num: 'v0.5.0', label: 'SDK on PyPI' },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-2xl font-black text-cyan-400">{item.num}</div>
                  <div className="text-gray-500 text-xs mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Attestation Spec */}
          <div className="rounded-2xl p-6 mb-8"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <h2 className="text-sm font-bold text-green-400 mb-4">Verified in the Multi-Attestation Spec</h2>
            <p className="text-gray-400 text-xs mb-4">
              AgentID is one of 6 independently verified trust issuers. Each covers a different dimension.
              All cryptographically verifiable. No shared keys or infrastructure.
            </p>
            <div className="space-y-2">
              {[
                { name: 'AgentID', q: 'Is this agent still behaving like itself?', status: 'Section 3.6', color: '#00d4ff' },
                { name: 'APS', q: 'What is this agent allowed to do?', status: 'Section 3.5', color: '#ff6b6b' },
                { name: 'InsumerAPI', q: 'What does this wallet hold?', status: 'Section 3.1', color: '#4285F4' },
                { name: 'ThoughtProof', q: 'Did this agent reason correctly?', status: 'Section 3.2', color: '#22c55e' },
                { name: 'RNWY', q: 'Is this agent legitimate on-chain?', status: 'Section 3.3', color: '#f0a500' },
                { name: 'Maiat', q: 'Has this agent delivered quality work?', status: 'Section 3.4', color: '#a78bfa' },
              ].map(item => (
                <div key={item.name} className="flex items-center gap-3 py-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <span className="text-white text-xs font-bold w-24 shrink-0">{item.name}</span>
                  <span className="text-gray-400 text-xs flex-1">{item.q}</span>
                  <span className="text-gray-600 text-[10px] font-mono">{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Agent Data */}
          {agentData && (
            <div className="rounded-2xl p-6 mb-8"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <h2 className="text-sm font-bold text-cyan-400 mb-4">Live Agent Verification</h2>
              <p className="text-gray-500 text-xs mb-4">Real-time data from our verify endpoint. This agent is live on the platform right now.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Verified</div>
                  <div className="text-green-400 font-bold">{agentData.verified ? 'TRUE' : 'FALSE'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Trust Level</div>
                  <div className="text-white">{agentData.trust_level_label}</div>
                </div>
                <div>
                  <div className="text-gray-500">Agent Type</div>
                  <div className="text-white">{agentData.agent_type}</div>
                </div>
                <div>
                  <div className="text-gray-500">Context Continuity</div>
                  <div className="text-white">{agentData.context_continuity?.score ?? '?'}/100</div>
                </div>
                <div>
                  <div className="text-gray-500">Ed25519 Receipt</div>
                  <div className="text-green-400">{agentData.receipt?.compound_digest_ed25519_signature ? 'SIGNED' : '?'}</div>
                </div>
                <div>
                  <div className="text-gray-500">DID</div>
                  <div className="text-cyan-400 font-mono text-[10px] break-all">{agentData.did}</div>
                </div>
              </div>
            </div>
          )}

          {/* EdDSA Trust Header */}
          {trustHeader?.payload && (
            <div className="rounded-2xl p-6 mb-8"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(123,47,255,0.15)' }}>
              <h2 className="text-sm font-bold text-purple-400 mb-4">EdDSA Trust Header JWT</h2>
              <p className="text-gray-500 text-xs mb-4">
                Signed with Ed25519. Verifiable offline with the public key from /.well-known/jwks.json. 1 hour TTL. No API call needed after initial fetch.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {['trust_level', 'trust_level_label', 'context_continuity_score', 'behavioral_risk_score', 'scarring_score', 'attestation_count'].map(k => (
                  <div key={k}>
                    <div className="text-gray-500">{k}</div>
                    <div className="text-white font-mono">{String(trustHeader.payload[k])}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Integrations */}
          <div className="rounded-2xl p-6 mb-8"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white mb-4">Where AgentID Lives</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                'Google A2A', 'CrewAI', 'AutoGen', 'Solana Agent Kit',
                'Upsonic', 'ERC-8004', 'ElizaOS', 'browser-use',
                'qntm WG', 'W3C CG', 'Multi-Attestation Spec', 'PyPI',
              ].map(name => (
                <div key={name} className="text-center py-2 rounded-lg text-xs text-gray-400"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {name}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <a href="/docs" className="inline-block px-8 py-4 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)', boxShadow: '0 4px 20px rgba(0,212,255,0.2)' }}>
                Read the Docs
              </a>
              <a href="/build" className="inline-block px-8 py-4 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #ef4444, #f0a500)', boxShadow: '0 4px 20px rgba(239,68,68,0.2)' }}>
                Get an Agent Built
              </a>
            </div>
            <p className="text-gray-600 text-xs">pip install getagentid</p>
          </div>

        </motion.div>
      </div>
    </div>
  )
}
