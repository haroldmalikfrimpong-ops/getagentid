'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user)
      setChecking(false)
    })
  }, [])

  if (!mounted || checking) return null

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5">
        <span className="text-xl font-black holo-gradient">AgentID</span>
        <div className="flex gap-3">
          {loggedIn ? (
            <a href="/dashboard" className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white text-sm font-bold">Dashboard</a>
          ) : (
            <>
              <a href="/login" className="px-5 py-2 text-sm text-gray-400 hover:text-white transition-colors">Log In</a>
              <a href="/signup" className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white text-sm font-bold">Sign Up Free</a>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl mx-auto">
          <div className="inline-block px-4 py-1 rounded-full border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-6">
            THE TRUST LAYER FOR AI AGENTS
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            <span className="holo-gradient">Every AI Agent</span>
            <br />
            <span className="text-white">Needs an Identity</span>
          </h1>
          <p className="text-lg text-gray-400 mb-4 max-w-xl mx-auto">
            AI agents can&apos;t verify each other. Any agent can pretend to be anyone.
          </p>
          <p className="text-lg text-white font-bold mb-10 max-w-xl mx-auto">
            AgentID gives every agent a verified identity — like SSL certificates for the agent economy.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/signup" className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white font-bold text-sm tracking-wider hover:opacity-90 transition-opacity">
              GET STARTED FREE
            </a>
            <a href="#how" className="px-8 py-4 border border-white/10 rounded-full text-gray-300 font-bold text-sm tracking-wider hover:bg-white/5 transition-colors">
              SEE HOW IT WORKS
            </a>
          </div>
          <p className="text-gray-600 text-xs mt-4">Free tier — no credit card required</p>
        </motion.div>
      </section>

      {/* What is AgentID */}
      <section className="py-24 px-6 bg-[#080812]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl font-black text-white mb-3">What is AgentID?</h2>
            <p className="text-gray-500 max-w-lg mx-auto">Three core products that make agent-to-agent trust possible.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '🔐',
                title: 'Agent Certificates',
                desc: 'Cryptographic proof of identity. "This agent belongs to Barclays and does customer service." Signed. Verifiable. Revocable.',
              },
              {
                icon: '🔍',
                title: 'Agent Registry',
                desc: 'Find any agent by what it does. "Show me agents that handle insurance claims." Searchable. Discoverable.',
              },
              {
                icon: '✓',
                title: 'Verification API',
                desc: 'One API call to check if an agent is legit before trusting it. Real-time verification. Instant trust decisions.',
              },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glow-border rounded-xl p-8 bg-[#111118]">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl font-black text-white mb-3">How It Works</h2>
            <p className="text-gray-500">Three steps. That&apos;s it.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Register',
                desc: 'Sign up and register your agent. Tell us what it does, who owns it, what it can do.',
                code: 'agent.register(name="My Bot")',
              },
              {
                step: '02',
                title: 'Get Certified',
                desc: 'Your agent receives a cryptographic certificate — its digital passport. Signed by AgentID.',
                code: '→ Certificate issued ✓',
              },
              {
                step: '03',
                title: 'Verify',
                desc: 'Before trusting any agent, verify it with one call. Know exactly who you&apos;re dealing with.',
                code: 'agent.verify("agent_xyz")',
              },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center">
                <div className="text-4xl font-black text-cyan-500/20 mb-4">{item.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{item.desc}</p>
                <div className="bg-black/40 border border-cyan-500/10 rounded-lg px-4 py-2 inline-block">
                  <code className="text-xs text-cyan-400 font-mono">{item.code}</code>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-24 px-6 bg-[#080812]">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl font-black text-white mb-3">Built For</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '⚡', title: 'Developers', desc: 'Building AI agents and need identity verification between them. SDKs for Python and Node.js.' },
              { icon: '🏢', title: 'Companies', desc: 'Deploying agents that interact with other businesses. Need proof your agent is legitimate.' },
              { icon: '🔗', title: 'Platforms', desc: 'Connecting agents from different providers. Need a trust layer to verify who is who.' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glow-border rounded-xl p-8 bg-[#111118] text-center">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl font-black text-white mb-3">Simple Pricing</h2>
            <p className="text-gray-500">Start free. Scale when you need to.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { tier: 'Free', price: '$0', period: 'forever', features: ['5 agents', '1,000 verifications/month', 'Community support', 'Basic dashboard'], cta: 'Get Started', highlight: false },
              { tier: 'Startup', price: '$49', period: '/month', features: ['50 agents', '50,000 verifications/month', 'Email support', 'Custom trust rules', 'API analytics'], cta: 'Start Trial', highlight: true },
              { tier: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited agents', 'Unlimited verifications', 'SLA guarantee', 'Priority support', 'On-premise option', 'Dedicated account manager'], cta: 'Contact Us', highlight: false },
            ].map((plan, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`rounded-xl p-8 ${plan.highlight ? 'bg-gradient-to-b from-cyan-500/10 to-purple-500/10 border border-cyan-500/30' : 'glow-border bg-[#111118]'}`}>
                <div className="text-sm text-gray-500 mb-1">{plan.tier}</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="text-sm text-gray-400 flex items-center gap-2">
                      <span className="text-cyan-500 text-xs">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a href="/signup" className={`block text-center py-3 rounded-lg text-sm font-bold ${plan.highlight ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'border border-white/10 text-gray-300 hover:bg-white/5'}`}>
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center bg-[#080812]">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-4xl font-black mb-4"><span className="holo-gradient">Ready to Build Trust?</span></h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Register your first agent in seconds. Free forever for small teams.</p>
          <a href="/signup" className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white font-bold tracking-wider inline-block hover:opacity-90">
            GET STARTED FREE
          </a>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="holo-gradient text-lg font-bold">AgentID</span>
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="/login" className="hover:text-cyan-400">Log In</a>
            <a href="/signup" className="hover:text-cyan-400">Sign Up</a>
            <a href="https://github.com/haroldmalikfrimpong-ops/getagentid" className="hover:text-cyan-400">GitHub</a>
          </div>
          <span className="text-xs text-gray-700">getagentid.dev</span>
        </div>
      </footer>
    </div>
  )
}
