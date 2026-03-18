'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const Scene3D = dynamic(() => import('@/components/Scene3D'), { ssr: false })

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    // If already logged in, skip landing page and go to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push('/dashboard')
      } else {
        setChecking(false)
      }
    })
  }, [])

  if (!mounted || checking) return null

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <span className="text-xl font-black holo-gradient">AgentID</span>
        <div className="flex gap-3">
          <a href="/login" className="px-5 py-2 text-sm text-gray-400 hover:text-white transition-colors">Log In</a>
          <a href="/signup" className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white text-sm font-bold">Sign Up</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-screen flex flex-col">
        <Scene3D agents={[
          { agent_id: 'demo1', name: 'Trading Bot', last_active: new Date().toISOString() },
          { agent_id: 'demo2', name: 'Support Agent', last_active: new Date().toISOString() },
          { agent_id: 'demo3', name: 'Data Pipeline', last_active: new Date().toISOString() },
          { agent_id: 'demo4', name: 'Payment Agent', last_active: new Date().toISOString() },
        ]} />

        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-6xl md:text-8xl font-black mb-4">
              <span className="holo-gradient">AgentID</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-2">
              The Identity & Discovery Layer for AI Agents
            </p>
            <p className="text-sm text-gray-600 mb-10 max-w-lg mx-auto">
              Every website needs SSL. Every person needs a passport.
              Every AI agent needs AgentID.
            </p>
            <div className="flex gap-4 justify-center pointer-events-auto">
              <motion.a
                href="/signup"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white font-bold text-sm tracking-wider"
              >
                GET STARTED FREE
              </motion.a>
              <motion.a
                href="/docs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 border border-cyan-500/30 rounded-full text-cyan-400 font-bold text-sm tracking-wider hover:bg-cyan-500/10"
              >
                VIEW DOCS
              </motion.a>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border border-cyan-500/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-cyan-500/50 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* What is AgentID */}
      <section className="py-24 px-6 md:px-20">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
            <span className="holo-gradient">The SSL of the Agent Economy</span>
          </h2>
          <p className="text-gray-400 text-center text-lg mb-16 max-w-2xl mx-auto">
            AI agents are like the internet before SSL — anyone can pretend to be anyone. AgentID fixes that.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '🔐', title: 'Agent Certificates', desc: 'Cryptographic proof that "this agent belongs to Barclays and does customer service." Signed, verifiable, revocable.' },
              { icon: '🔍', title: 'Agent Registry', desc: 'Searchable directory to find agents by capability. "Find me an agent that handles insurance claims."' },
              { icon: '✓', title: 'Verification API', desc: 'One API call to verify if an agent is legit before trusting it. Real-time. Instant.' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="glow-border rounded-xl p-6 bg-[#111118] text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Code examples */}
      <section className="py-24 px-6 md:px-20 bg-[#080812]">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-16"><span className="holo-gradient">3 Lines of Code</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glow-border rounded-xl p-6 bg-[#0d0d15]">
              <div className="text-xs text-cyan-500 font-mono mb-3">Register your agent</div>
              <pre className="text-sm text-gray-300 font-mono overflow-x-auto">{`from agentid import AgentID

agent = AgentID()
cert = agent.register(
    name="My Trading Bot",
    capabilities=["trading"]
)
# That's it. Your agent has an identity.`}</pre>
            </div>
            <div className="glow-border rounded-xl p-6 bg-[#0d0d15]">
              <div className="text-xs text-purple-400 font-mono mb-3">Verify another agent</div>
              <pre className="text-sm text-gray-300 font-mono overflow-x-auto">{`result = agent.verify("agent_abc123")

if result.verified:
    print(f"Trusted: {result.name}")
    print(f"Owner: {result.owner}")
    print(f"Trust: {result.trust_score}")
# One call. Instant trust decision.`}</pre>
            </div>
          </div>
          <div className="mt-8 text-center">
            <code className="text-cyan-400 font-mono text-sm">pip install agentid</code>
            <span className="text-gray-600 mx-4">or</span>
            <code className="text-purple-400 font-mono text-sm">npm install agentid</code>
          </div>
        </motion.div>
      </section>

      {/* Market */}
      <section className="py-24 px-6 md:px-20">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-8"><span className="holo-gradient">The Opportunity</span></h2>
          <div className="grid grid-cols-2 gap-6 mb-12">
            {[
              { value: '$52.6B', label: 'AI Agent Market by 2030' },
              { value: '700+', label: 'Agent Startups Building' },
              { value: '$15T', label: 'Agent Commerce by 2028' },
              { value: '0', label: 'Working Solutions Today' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glow-border rounded-xl p-6 bg-[#111118]">
                <div className="text-3xl font-black text-cyan-400">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
          <p className="text-gray-400 text-lg">Nobody has shipped a working, cross-organization agent identity system. <span className="text-white font-bold">We ship first, we define the standard.</span></p>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-4xl md:text-5xl font-black mb-4"><span className="holo-gradient">Start Building Trust</span></h2>
          <p className="text-gray-500 mb-10 max-w-lg mx-auto">Register your first agent in seconds. Free tier — 5 agents, 1,000 verifications/month.</p>
          <a href="/signup" className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white font-bold tracking-wider inline-block">GET STARTED FREE</a>
          <p className="text-gray-700 text-xs mt-6">No credit card required</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 text-center">
        <p className="holo-gradient text-xl font-bold mb-2">AgentID</p>
        <p className="text-gray-600 text-xs mb-4">The Identity & Discovery Layer for AI Agents</p>
        <div className="flex gap-6 justify-center text-xs text-gray-500">
          <a href="/docs" className="hover:text-cyan-400">Documentation</a>
          <a href="/login" className="hover:text-cyan-400">Log In</a>
          <a href="https://github.com/haroldmalikfrimpong-ops/getagentid" className="hover:text-cyan-400">GitHub</a>
        </div>
      </footer>
    </div>
  )
}
