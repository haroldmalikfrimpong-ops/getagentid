'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const USE_CASES = [
  { title: 'Sales & Outreach', desc: 'Find leads, generate proposals, send cold emails', icon: '🎯' },
  { title: 'Data & Monitoring', desc: 'Track prices, scrape data, alert on changes', icon: '📊' },
  { title: 'Customer Support', desc: 'Answer questions, route tickets, handle complaints', icon: '💬' },
  { title: 'Operations', desc: 'Process orders, manage inventory, automate workflows', icon: '⚙️' },
  { title: 'Finance', desc: 'Track spending, generate reports, flag anomalies', icon: '💰' },
  { title: 'Custom', desc: 'Something else entirely — tell us what you need', icon: '🔧' },
]

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Real Estate', 'E-commerce',
  'Logistics', 'Education', 'Legal', 'Marketing', 'Other',
]

const TIMELINES = [
  'As soon as possible',
  'Within 2 weeks',
  'Within a month',
  'No rush — exploring options',
]

export default function BuildPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    industry: '',
    agentDescription: '',
    runSchedule: '',
    integrations: '',
    dataNeeded: '',
    reporting: '',
    timeline: '',
    budget: '',
    additional: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.agentDescription) {
      setError('Please fill in your name, email, and what the agent should do.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/v1/build-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again or email us directly at hello@getagentid.dev')
      }
    } catch {
      setError('Something went wrong. Please try again or email us directly at hello@getagentid.dev')
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center" style={{ background: '#07070f' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="text-5xl mb-6">✓</div>
          <h1 className="text-2xl font-black text-white mb-3">Request Received</h1>
          <p className="text-gray-400 leading-relaxed">
            We'll review your requirements and get back to you at <strong className="text-white">{form.email}</strong> within 24 hours.
          </p>
          <a href="/" className="inline-block mt-8 px-6 py-3 rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}>
            Back to Home
          </a>
        </motion.div>
      </div>
    )
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
              Agent Building Service
            </div>
            <h1 className="text-3xl font-black text-white mb-3">
              We Build Your Agent
            </h1>
            <p className="text-gray-400 leading-relaxed max-w-2xl">
              Tell us what you need. We design, build, and deploy a custom AI agent for your business.
              Every agent gets a verified identity on AgentID — cryptographic receipts, trust scoring,
              and behavioral monitoring from day one.
            </p>
          </div>

          {/* What you get */}
          <div className="rounded-2xl p-6 mb-8"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white mb-4">What you get</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Custom-built AI agent for your use case',
                'Registered on AgentID with verified identity',
                'Ed25519 cryptographic receipts for every action',
                'Behavioral monitoring and anomaly detection',
                'Deployed and running (cloud or your infrastructure)',
                'Dashboard to monitor trust level and activity',
                'Agent-Trust-Score headers for API integrations',
                'Ongoing support and maintenance options',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0 text-cyan-400 mt-0.5" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-gray-400 text-xs">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Use cases */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-white mb-4">Example use cases</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {USE_CASES.map((uc, i) => (
                <div key={i} className="rounded-xl p-4"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-xl mb-2">{uc.icon}</div>
                  <div className="text-xs font-bold text-white mb-1">{uc.title}</div>
                  <div className="text-[11px] text-gray-500">{uc.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="rounded-2xl p-6 mb-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-lg font-bold text-white mb-6">Tell us about your agent</h2>

              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm text-red-400"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Your name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => update('company', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Industry</label>
                  <select
                    value={form.industry}
                    onChange={e => update('industry', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white appearance-none"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* The agent */}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">What should the agent do? *</label>
                <textarea
                  value={form.agentDescription}
                  onChange={e => update('agentDescription', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg text-sm text-white resize-none"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Describe what you want the agent to do. Be as specific as you can — what tasks, what inputs, what outputs, what decisions."
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">When should it run?</label>
                <input
                  type="text"
                  value={form.runSchedule}
                  onChange={e => update('runSchedule', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm text-white"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="24/7, every hour, on a schedule, triggered by events..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">What does it connect to?</label>
                <input
                  type="text"
                  value={form.integrations}
                  onChange={e => update('integrations', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm text-white"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="APIs, databases, CRM, email, WhatsApp, Telegram, Slack..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">What data does it need access to?</label>
                <input
                  type="text"
                  value={form.dataNeeded}
                  onChange={e => update('dataNeeded', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm text-white"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Customer data, product catalog, internal documents, external APIs..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">How should it report back to you?</label>
                <input
                  type="text"
                  value={form.reporting}
                  onChange={e => update('reporting', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm text-white"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Dashboard, email alerts, Telegram, Slack, webhook..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Timeline</label>
                  <select
                    value={form.timeline}
                    onChange={e => update('timeline', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white appearance-none"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="">When do you need it?</option>
                    {TIMELINES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Budget range</label>
                  <input
                    type="text"
                    value={form.budget}
                    onChange={e => update('budget', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                    placeholder="$500, $2,000, $5,000+, not sure..."
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs text-gray-500 mb-1.5">Anything else?</label>
                <textarea
                  value={form.additional}
                  onChange={e => update('additional', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg text-sm text-white resize-none"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Links, examples, preferences, concerns..."
                />
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-4 rounded-lg text-sm font-bold text-white transition-all"
                style={{ background: submitting ? '#333' : 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}
              >
                {submitting ? 'Sending...' : 'Submit Request'}
              </motion.button>
            </div>
          </form>

          {/* Direct contact */}
          <div className="text-center">
            <p className="text-gray-600 text-xs">
              Prefer email? Send your requirements to{' '}
              <a href="mailto:hello@getagentid.dev" className="text-cyan-400 hover:text-cyan-300">
                hello@getagentid.dev
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
