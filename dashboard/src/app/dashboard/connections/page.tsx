'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ConnectionsPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) { setUser(session.user); setReady(true); loadData() }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadData() {
    const [agentsRes, msgsRes] = await Promise.all([
      supabase.from('agents').select('*'),
      supabase.from('agent_messages').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    if (agentsRes.data) setAgents(agentsRes.data)
    if (msgsRes.data) setMessages(msgsRes.data)
  }

  function getAgentName(id: string) {
    return agents.find(a => a.agent_id === id)?.name || id
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
    <div className="min-h-screen pt-20 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-black mb-2"><span className="holo-gradient">Connections</span></h1>
          <p className="text-gray-500 text-sm mb-8">Agent-to-agent communications with verified identity</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Total Messages', value: messages.length, color: '#00d4ff' },
            { label: 'Pending', value: messages.filter(m => m.status === 'pending').length, color: '#ffb300' },
            { label: 'Trusted', value: messages.filter(m => m.verified_sender && m.verified_receiver).length, color: '#00e676' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.color}15` }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.color}30, transparent)` }} />
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-2xl font-black font-mono mt-1" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Messages */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {messages.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-xl font-bold text-white mb-2">No connections yet</h3>
              <p className="text-gray-500 text-sm mb-6">When agents communicate through AgentID, their messages appear here</p>
              <div className="bg-black/40 rounded-xl p-4 inline-block text-left max-w-md">
                <div className="text-[10px] text-gray-600 mb-2">Send a message between agents:</div>
                <pre className="text-cyan-300 font-mono text-xs leading-relaxed">{`client.agents.connect(
    from_agent="agent_abc",
    to_agent="agent_xyz",
    payload={"action": "get_data"}
)`}</pre>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const trusted = msg.verified_sender && msg.verified_receiver
                const statusColor = msg.status === 'responded' ? '#00e676' : msg.status === 'pending' ? '#ffb300' : '#888'

                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="rounded-xl p-5 transition-all hover:border-cyan-500/20"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* From → To */}
                        <div className="flex items-center gap-2">
                          <a href={`/verify/${msg.from_agent}`} className="text-sm font-bold text-white hover:text-cyan-300 transition-colors">
                            {getAgentName(msg.from_agent)}
                          </a>
                          <span className="text-gray-600">→</span>
                          <a href={`/verify/${msg.to_agent}`} className="text-sm font-bold text-white hover:text-cyan-300 transition-colors">
                            {getAgentName(msg.to_agent)}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Trust badge */}
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono"
                          style={trusted
                            ? { background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }
                            : { background: 'rgba(255,179,0,0.1)', color: '#ffb300', border: '1px solid rgba(255,179,0,0.2)' }}>
                          {trusted ? 'TRUSTED ✓' : 'PARTIAL ⚠'}
                        </span>

                        {/* Status */}
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono"
                          style={{ background: `${statusColor}10`, color: statusColor, border: `1px solid ${statusColor}20` }}>
                          {msg.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Verification details */}
                    <div className="flex items-center gap-4 mb-3 text-[10px]">
                      <span className={msg.verified_sender ? 'text-green-400' : 'text-gray-600'}>
                        Sender: {msg.verified_sender ? '✓ Verified' : '✗ Unverified'}
                      </span>
                      <span className={msg.verified_receiver ? 'text-green-400' : 'text-gray-600'}>
                        Receiver: {msg.verified_receiver ? '✓ Verified' : '✗ Unverified'}
                      </span>
                    </div>

                    {/* Payload */}
                    <div className="bg-black/30 rounded-lg p-3 mb-2">
                      <div className="text-[9px] text-gray-600 font-mono mb-1">PAYLOAD</div>
                      <pre className="text-xs text-cyan-300 font-mono overflow-x-auto">
                        {JSON.stringify(msg.payload, null, 2)}
                      </pre>
                    </div>

                    {/* Response */}
                    {msg.response && (
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="text-[9px] text-gray-600 font-mono mb-1">RESPONSE</div>
                        <pre className="text-xs text-green-300 font-mono overflow-x-auto">
                          {JSON.stringify(msg.response, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Time */}
                    <div className="text-[10px] text-gray-700 font-mono mt-3">
                      {new Date(msg.created_at).toLocaleString('en-GB')}
                      {msg.responded_at && ` → Responded ${new Date(msg.responded_at).toLocaleString('en-GB')}`}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
