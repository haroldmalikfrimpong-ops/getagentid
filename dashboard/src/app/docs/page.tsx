'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function DocsPage() {
  const [user, setUser] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setReady(true)
      }
      if (event === 'INITIAL_SESSION' && !session) {
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <a href="/dashboard" className="text-cyan-500/50 text-sm hover:text-cyan-400">← Dashboard</a>
          <span className="text-xs text-gray-600">{user?.email || user?.user_metadata?.user_name}</span>
        </div>

        <h1 className="text-4xl font-black mb-2"><span className="holo-gradient">Documentation</span></h1>
        <p className="text-gray-500 mb-12">Everything you need to integrate AgentID into your agents.</p>

        {/* Quick Start */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Quick Start</h2>

          <div className="glow-border rounded-xl p-6 bg-[#111118] mb-6">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">1. Install the SDK</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/40 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Python</div>
                <code className="text-cyan-300 text-sm">pip install agentid</code>
              </div>
              <div className="bg-black/40 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Node.js</div>
                <code className="text-cyan-300 text-sm">npm install agentid</code>
              </div>
            </div>
          </div>

          <div className="glow-border rounded-xl p-6 bg-[#111118] mb-6">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">2. Register your agent</h3>
            <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">{`import agentid

client = agentid.Client(api_key="your-api-key")

result = client.agents.register(
    name="My Trading Bot",
    description="Automated gold trading",
    capabilities=["trading", "gold-signals"]
)

print(result.agent_id)      # agent_abc123
print(result.certificate)   # Signed JWT certificate`}</pre>
          </div>

          <div className="glow-border rounded-xl p-6 bg-[#111118] mb-6">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">3. Verify another agent</h3>
            <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">{`result = client.agents.verify("agent_abc123")

if result.verified:
    print(f"Trusted: {result.name}")
    print(f"Trust Score: {result.trust_score}")`}</pre>
          </div>
        </section>

        {/* API Reference */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">API Reference</h2>
          <div className="space-y-4">
            {[
              { method: 'POST', path: '/v1/agents/register', desc: 'Register a new agent' },
              { method: 'POST', path: '/v1/agents/verify', desc: 'Verify an agent identity' },
              { method: 'GET', path: '/v1/agents/discover', desc: 'Search agents by capability' },
              { method: 'POST', path: '/v1/agents/connect', desc: 'Send verified message between agents' },
              { method: 'POST', path: '/v1/agents/message', desc: 'Respond to a message' },
              { method: 'GET', path: '/v1/agents/inbox', desc: 'Get pending messages for an agent' },
            ].map((ep, i) => (
              <div key={i} className="glow-border rounded-lg p-4 bg-[#111118] flex items-center gap-4">
                <span className={`text-xs font-mono px-2 py-1 rounded ${ep.method === 'POST' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                  {ep.method}
                </span>
                <code className="text-white font-mono text-sm">{ep.path}</code>
                <span className="text-gray-500 text-sm ml-auto">{ep.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/5 pt-8 text-center">
          <p className="text-gray-700 text-xs">AgentID — getagentid.dev</p>
        </footer>
      </motion.div>
    </div>
  )
}
