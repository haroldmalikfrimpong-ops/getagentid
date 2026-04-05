'use client'

import { motion } from 'framer-motion'

export default function BlogPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <div className="mb-8">
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-3">Blog</div>
            <h1 className="text-3xl font-black text-white mb-2">
              How I Built Cryptographic Identity for AI Agents
            </h1>
            <p className="text-gray-600 text-sm">April 5, 2026 &middot; By Malik</p>
          </div>

          <article className="prose prose-invert prose-sm max-w-none">

            <div className="text-gray-300 leading-relaxed space-y-6">

              <p className="text-lg text-gray-200">
                AI agents are shipping without identity. No proof of who they are. No receipt of what they did.
                No trust signal for systems they interact with. I built AgentID to fix this. In 3 months. On one laptop.
              </p>

              <div className="section-divider my-8" />

              <h2 className="text-xl font-black text-white mt-8 mb-4">The Problem</h2>
              <p>
                Every agent framework — CrewAI, AutoGen, LangChain, Phidata — treats agents as trusted by default.
                That works when you{"'"}re running agents locally. It breaks the moment agents handle money, sensitive data,
                or talk to agents they{"'"}ve never met.
              </p>
              <p>
                When Agent A interacts with Agent B across organizations, there{"'"}s no proof of identity. No audit trail.
                No trust signal. In fintech, this means you can{"'"}t deploy autonomous agents for regulated operations.
                In multi-agent systems, you can{"'"}t verify handoffs.
              </p>

              <h2 className="text-xl font-black text-white mt-8 mb-4">What AgentID Does</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
                {[
                  { t: 'Cryptographic Identity', d: 'Ed25519 certificates + W3C DID document for every agent' },
                  { t: 'Dual-Signed Receipts', d: 'Every action signed with HMAC + Ed25519. Publicly verifiable.' },
                  { t: 'Trust Levels L1-L4', d: 'Capability-based. Register = L1. Key = L2. Wallet = L3. Entity = L4.' },
                  { t: 'Session Continuity', d: 'Auto-detects model or memory changes. Server-side. Score 0-100.' },
                  { t: 'Behavioral Monitoring', d: 'Frequency spikes, payload drift, model changes. Real-time alerts.' },
                  { t: 'Daemon Agents', d: 'Always-on background agents with heartbeat and context tracking.' },
                  { t: 'Blockchain Anchoring', d: 'Solana memo transactions for every receipt. Immutable proof.' },
                  { t: 'We Build Agents', d: 'Custom AI agents for your business. Every agent gets AgentID identity.' },
                ].map(item => (
                  <div key={item.t} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-white text-xs font-bold mb-1">{item.t}</div>
                    <div className="text-gray-500 text-[11px]">{item.d}</div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-black text-white mt-8 mb-4">5 Lines of Code</h2>

              <div className="rounded-xl overflow-hidden my-4" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
                <div className="px-4 py-1.5" style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] font-mono text-gray-500">python</span>
                </div>
                <pre className="p-4 text-[13px] font-mono text-gray-300 leading-relaxed overflow-x-auto" style={{ background: 'rgba(0,0,0,0.4)' }}>
{`pip install getagentid

from agentid import Client
client = Client(api_key="agentid_sk_...")

# Register an agent
result = client.agents.register(
    name="My Trading Bot",
    capabilities=["trading", "analysis"],
)

# Verify any agent
v = client.agents.verify("agent_abc123")
print(v.trust_level)           # 2
print(v.context_continuity)    # 100/100`}
                </pre>
              </div>

              <h2 className="text-xl font-black text-white mt-8 mb-4">The Numbers</h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
                {[
                  { n: '141+', l: 'Agents' },
                  { n: '8/8', l: 'Cross-Tests' },
                  { n: '6/6', l: 'Multi-Attestation' },
                  { n: 'v0.5.0', l: 'SDK on PyPI' },
                ].map(item => (
                  <div key={item.l} className="text-center py-4 rounded-lg" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                    <div className="text-xl font-black text-cyan-400">{item.n}</div>
                    <div className="text-gray-500 text-[10px] mt-1">{item.l}</div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-black text-white mt-8 mb-4">Where AgentID Lives</h2>
              <p>
                Integrated with CrewAI, AutoGen, Solana Agent Kit, Upsonic, ERC-8004, ElizaOS, browser-use.
                Named Identity Verification owner in the agent identity Working Group.
                Verified in the multi-attestation spec alongside InsumerAPI, ThoughtProof, RNWY, Maiat, and APS.
              </p>

              <p>
                3 months. One laptop. No team. No funding.
              </p>

              <div className="section-divider my-8" />

              <div className="text-center mt-8">
                <a href="/docs" className="inline-block px-6 py-3 rounded-full text-white text-sm font-bold mr-3"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
                  Read the Docs
                </a>
                <a href="/build" className="inline-block px-6 py-3 rounded-full text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #f0a500)' }}>
                  Get an Agent Built
                </a>
                <p className="text-gray-600 text-xs mt-4">pip install getagentid</p>
              </div>

            </div>
          </article>

        </motion.div>
      </div>
    </div>
  )
}
