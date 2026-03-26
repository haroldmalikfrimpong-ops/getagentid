'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function WebhooksPage() {
  const [user, setUser] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setReady(true)
        loadWebhookConfig()
      }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadWebhookConfig() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/v1/webhooks', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.webhook_url) {
        setWebhookUrl(data.webhook_url)
        setSavedUrl(data.webhook_url)
      }
      if (data.deliveries) setDeliveries(data.deliveries)
    } catch (e) { console.error(e) }
  }

  async function saveUrl() {
    setSaving(true)
    setSaveMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/v1/webhooks', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhook_url: webhookUrl }),
      })
      const data = await res.json()
      if (data.success) {
        setSavedUrl(webhookUrl || null)
        setSaveMsg('Saved')
        setTimeout(() => setSaveMsg(''), 2000)
      } else {
        setSaveMsg(data.error || 'Failed to save')
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function testWebhook() {
    setTesting(true)
    setTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setTestResult(data)
      // Reload deliveries
      loadWebhookConfig()
    } catch (e) {
      setTestResult({ success: false, error: 'Request failed' })
    }
    setTesting(false)
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/dashboard" className="text-cyan-500/50 text-sm hover:text-cyan-400">← Dashboard</a>
            <h1 className="text-3xl font-black mt-2"><span className="holo-gradient">Webhooks</span></h1>
            <p className="text-gray-500 text-sm mt-1">Get notified when agents are registered, verified, or make transactions</p>
          </div>
        </div>

        {/* Webhook URL config */}
        <div className="glow-border rounded-xl p-6 bg-[#111118] mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Webhook URL</h2>
          <p className="text-gray-500 text-xs mb-4">
            We will POST event payloads to this URL with HMAC-SHA256 signatures for verification.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks/agentid"
              className="flex-1 bg-black/40 rounded-lg px-4 py-3 text-cyan-300 font-mono text-sm border border-white/10 focus:border-cyan-500/40 focus:outline-none transition-colors placeholder:text-gray-700"
            />
            <button onClick={saveUrl} disabled={saving}
              className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white font-bold text-sm disabled:opacity-50 whitespace-nowrap">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {saveMsg && (
            <div className={`text-xs mt-2 ${saveMsg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </div>
          )}
          {savedUrl && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-gray-500 font-mono">Active: {savedUrl}</span>
            </div>
          )}
        </div>

        {/* Test webhook */}
        <div className="glow-border rounded-xl p-6 bg-[#111118] mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Test Delivery</h2>
          <p className="text-gray-500 text-xs mb-4">
            Send a test event to verify your endpoint is receiving webhooks correctly.
          </p>
          <button onClick={testWebhook} disabled={testing || !savedUrl}
            className="px-5 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-sm font-bold hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
            {testing ? 'Sending...' : 'Test Webhook'}
          </button>
          {!savedUrl && (
            <span className="text-gray-600 text-xs ml-3">Save a webhook URL first</span>
          )}
          {testResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-4 rounded-lg p-4 text-sm ${
                testResult.success
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
              {testResult.success ? 'Test webhook delivered successfully' : `Failed: ${testResult.error}`}
            </motion.div>
          )}
        </div>

        {/* Supported events */}
        <div className="glow-border rounded-xl p-6 bg-[#111118] mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Supported Events</h2>
          <div className="space-y-2">
            {[
              { event: 'agent.registered', desc: 'A new agent is registered' },
              { event: 'agent.verified', desc: 'An agent is verified via the API' },
              { event: 'agent.trust_level_changed', desc: 'Trust level changes for an agent' },
              { event: 'agent.certificate_expired', desc: 'An agent certificate expires' },
              { event: 'spend.authorized', desc: 'A spend request is approved' },
              { event: 'spend.denied', desc: 'A spend request is denied' },
            ].map((e) => (
              <div key={e.event} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <code className="text-cyan-400 font-mono text-xs bg-black/30 px-2 py-1 rounded">{e.event}</code>
                <span className="text-gray-500 text-xs">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent deliveries */}
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Deliveries</h2>
        {deliveries.length === 0 ? (
          <div className="glow-border rounded-xl p-8 bg-[#111118] text-center">
            <p className="text-gray-600 text-sm">No webhook deliveries yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((d: any) => (
              <motion.div key={d.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                className="glow-border rounded-lg p-4 bg-[#111118] flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.success ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="min-w-0">
                    <code className="text-cyan-400 font-mono text-xs">{d.event}</code>
                    <div className="text-[10px] text-gray-600 mt-0.5 truncate">
                      {d.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    d.success
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {d.success ? `${d.status_code || 'OK'}` : d.error || 'FAILED'}
                  </span>
                  <span className="text-[10px] text-gray-700 font-mono">
                    {d.created_at ? new Date(d.created_at).toLocaleString('en-GB') : ''}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Payload example */}
        <div className="glow-border rounded-xl p-6 bg-[#111118] mt-8">
          <h3 className="text-sm text-cyan-400 font-mono mb-3">Payload Format</h3>
          <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">{`{
  "event": "agent.registered",
  "timestamp": "2026-03-26T12:00:00.000Z",
  "data": {
    "agent_id": "agent_abc123",
    "name": "My Agent",
    "owner": "you@example.com"
  }
}`}</pre>
          <div className="mt-4">
            <h4 className="text-xs text-gray-500 font-mono mb-2">Headers</h4>
            <div className="bg-black/40 rounded-lg p-4 text-xs text-gray-400 font-mono space-y-1">
              <div><span className="text-cyan-400">Content-Type:</span> application/json</div>
              <div><span className="text-cyan-400">X-AgentID-Event:</span> agent.registered</div>
              <div><span className="text-cyan-400">X-AgentID-Signature:</span> hmac-sha256-hex-digest</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
