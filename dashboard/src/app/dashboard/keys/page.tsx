'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function KeysPage() {
  const [user, setUser] = useState<any>(null)
  const [keys, setKeys] = useState<any[]>([])
  const [newKey, setNewKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setReady(true)
        loadKeys()
      }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadKeys() {
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false })
    if (data) setKeys(data)
  }

  async function generateKey() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.api_key) {
        setNewKey(data.api_key)
        loadKeys()
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <h1 className="text-3xl font-black mt-2"><span className="holo-gradient">API Keys</span></h1>
          </div>
        </div>

        {/* New key display */}
        {newKey && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-lg">✓</span>
              <span className="text-green-400 font-bold text-sm">API Key Created</span>
            </div>
            <p className="text-yellow-400 text-xs mb-3">Copy this key now — it will not be shown again.</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-black/40 rounded-lg px-4 py-3 text-cyan-300 font-mono text-sm break-all">
                {newKey}
              </code>
              <button onClick={copyKey}
                className="px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-sm hover:bg-cyan-500/20">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Generate button */}
        <div className="glow-border rounded-xl p-6 bg-[#111118] mb-8">
          <p className="text-gray-400 text-sm mb-4">
            Use API keys to authenticate your agents with the AgentID API. Keys are stored securely — we only keep a hash.
          </p>
          <button onClick={generateKey} disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white font-bold text-sm disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate New API Key'}
          </button>
        </div>

        {/* Existing keys */}
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Your Keys</h2>
        {keys.length === 0 ? (
          <p className="text-gray-600 text-sm">No API keys yet. Generate one above.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="glow-border rounded-lg p-4 bg-[#111118] flex items-center justify-between">
                <div>
                  <code className="text-cyan-400 font-mono text-sm">{k.key_prefix}</code>
                  <div className="text-xs text-gray-600 mt-1">
                    Created {new Date(k.created_at).toLocaleDateString()} ·
                    {k.last_used ? ` Last used ${new Date(k.last_used).toLocaleDateString()}` : ' Never used'}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${k.active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {k.active ? 'Active' : 'Revoked'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Usage example */}
        <div className="glow-border rounded-xl p-6 bg-[#111118] mt-8">
          <h3 className="text-sm text-cyan-400 font-mono mb-3">Usage</h3>
          <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">{`curl -X POST https://getagentid.dev/api/v1/agents/register \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Bot", "capabilities": ["trading"]}'`}</pre>
        </div>
      </motion.div>
    </div>
  )
}
