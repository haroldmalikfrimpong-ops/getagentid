'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'next/navigation'

export default function VerifyPage() {
  const params = useParams()
  const agentId = params.id as string
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    verify()
  }, [agentId])

  async function verify() {
    try {
      const res = await fetch('/api/v1/agents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      })
      const data = await res.json()
      if (data.verified !== undefined) {
        setAgent(data)
      } else {
        setError(data.error || 'Verification failed')
      }
    } catch (e) {
      setError('Could not connect to AgentID')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-14">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-6" />
          <p className="text-cyan-400 font-mono text-sm">Verifying agent identity...</p>
          <p className="text-gray-600 text-xs mt-2 font-mono">{agentId}</p>
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-14">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-2xl font-black text-red-400 mb-2">Agent Not Found</h1>
          <p className="text-gray-500 text-sm mb-4">{error || 'This agent ID does not exist in the AgentID registry.'}</p>
          <code className="text-xs text-gray-600 font-mono">{agentId}</code>
          <div className="mt-8">
            <a href="/" className="text-cyan-500 text-sm hover:underline">← Back to AgentID</a>
          </div>
        </motion.div>
      </div>
    )
  }

  const isOnline = agent.last_active && (Date.now() - new Date(agent.last_active).getTime()) < 600000
  const createdDate = agent.created_at ? new Date(agent.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-14 pb-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">

        {/* Verification status */}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }}
          className="text-center mb-8">
          {agent.verified ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✓</span>
              </div>
              <h1 className="text-2xl font-black text-green-400">Verified Agent</h1>
              <p className="text-gray-500 text-sm mt-1">This agent's identity has been verified by AgentID</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">⚠</span>
              </div>
              <h1 className="text-2xl font-black text-yellow-400">Unverified</h1>
              <p className="text-gray-500 text-sm mt-1">{agent.message}</p>
            </>
          )}
        </motion.div>

        {/* Passport card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="passport-card p-6 relative">

          {/* Holographic overlay */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="scan-overlay absolute inset-0" />
          </div>

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-xs font-mono text-cyan-500/60 uppercase tracking-[0.3em]">Agent Identity Card</div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-600'}`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* Agent name */}
            <h2 className="text-2xl font-black text-white mb-1">{agent.name}</h2>
            <p className="text-sm text-gray-400 mb-6">{agent.description}</p>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Owner</div>
                <div className="text-sm text-white mt-1">{agent.owner}</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Platform</div>
                <div className="text-sm text-white mt-1">{agent.platform || 'Not specified'}</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Trust Score</div>
                <div className="text-sm text-cyan-400 mt-1">{(agent.trust_score * 100).toFixed(0)}%</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Registered</div>
                <div className="text-sm text-white mt-1">{createdDate}</div>
              </div>
            </div>

            {/* Capabilities */}
            {agent.capabilities?.length > 0 && (
              <div className="mb-6">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Capabilities</div>
                <div className="flex flex-wrap gap-2">
                  {agent.capabilities.map((cap: string, i: number) => (
                    <span key={i} className="text-xs px-3 py-1 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certificate ID */}
            <div className="bg-black/30 rounded-lg p-3 mb-4">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Agent ID</div>
              <code className="text-xs text-cyan-400 font-mono">{agent.agent_id}</code>
            </div>

            {/* Certificate status */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={agent.certificate_valid ? 'text-green-400' : 'text-red-400'}>
                  {agent.certificate_valid ? '🔒 Certificate Valid' : '🔓 Certificate Invalid'}
                </span>
              </div>
              <span className="text-gray-600">Issued by AgentID</span>
            </div>

            {/* Rotating holographic stamp */}
            <motion.div
              className="absolute top-6 right-6 w-14 h-14 rounded-full border border-cyan-500/15 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
              <div className="text-[7px] text-cyan-500/30 text-center leading-tight font-mono">
                AGENT<br />ID<br />CERT
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Verify another */}
        <div className="text-center mt-8">
          <p className="text-gray-600 text-xs mb-3">Verify another agent</p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <input type="text" placeholder="agent_abc123..."
              className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-2 text-white text-sm focus:border-cyan-500/50 focus:outline-none font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value
                  if (val) window.location.href = `/verify/${val}`
                }
              }} />
            <button onClick={() => {
              const input = document.querySelector('input') as HTMLInputElement
              if (input?.value) window.location.href = `/verify/${input.value}`
            }} className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-sm hover:bg-cyan-500/20">
              Verify
            </button>
          </div>
          <a href="/" className="text-gray-600 text-xs mt-4 inline-block hover:text-cyan-400">getagentid.dev</a>
        </div>
      </motion.div>
    </div>
  )
}
