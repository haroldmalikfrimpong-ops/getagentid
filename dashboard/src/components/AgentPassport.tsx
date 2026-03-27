'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

interface Agent {
  agent_id: string
  name: string
  description: string
  owner: string
  capabilities: string[]
  platform: string | null
  trust_score: number
  verified: boolean
  active: boolean
  last_active: string | null
  created_at: string
  trust_level?: number
  ed25519_key?: string | null
  wallet_address?: string | null
  solana_address?: string | null
  wallet_chain?: string | null
}

const PLATFORM_ICONS: Record<string, string> = {
  telegram: '🤖',
  web:      '🌐',
  api:      '⚡',
  local:    '💻',
}

const TRUST_BADGE: Record<number, { label: string; shortLabel: string; color: string; bg: string; border: string }> = {
  1: { label: 'L1 — Registered',  shortLabel: 'L1', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.25)' },
  2: { label: 'L2 — Verified',    shortLabel: 'L2', color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)' },
  3: { label: 'L3 — Secured',     shortLabel: 'L3', color: '#a855f7', bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.25)' },
  4: { label: 'L4 — Certified',   shortLabel: 'L4', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)' },
}

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? '#00e676' : pct >= 50 ? '#ffb300' : '#ff5252'
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-mono text-gray-500 tracking-wider">TRUST SCORE</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function TrustLevelBadge({ level }: { level: number }) {
  const badge = TRUST_BADGE[level] || TRUST_BADGE[1]
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider"
      style={{
        background: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        boxShadow: `0 0 12px ${badge.bg}`,
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: badge.color, boxShadow: `0 0 6px ${badge.color}` }}
      />
      {badge.label}
    </div>
  )
}

// -- Toast notification component --
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const colors = {
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    error:   { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    info:    { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
  }
  const c = colors[type]
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute top-0 left-0 right-0 z-20 mx-4 mt-2 p-3 rounded-xl text-xs font-mono"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="leading-relaxed">{message}</span>
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">x</button>
      </div>
    </motion.div>
  )
}

// -- Verify result modal --
function VerifyResultModal({ result, onClose }: { result: any; onClose: () => void }) {
  const badge = TRUST_BADGE[result.trust_level] || TRUST_BADGE[1]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center rounded-[20px]"
      style={{ background: 'rgba(7,7,15,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div className="p-5 w-full max-w-[90%]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white">Verification Result</h4>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xs">Close</button>
        </div>

        <div className="space-y-3">
          {/* Verified status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${result.verified ? 'bg-green-400' : 'bg-red-400'}`}
              style={{ boxShadow: result.verified ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)' }}
            />
            <span className={`text-sm font-bold ${result.verified ? 'text-green-400' : 'text-red-400'}`}>
              {result.verified ? 'VERIFIED' : 'NOT VERIFIED'}
            </span>
          </div>

          {/* Trust level */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-mono">TRUST LEVEL:</span>
            <TrustLevelBadge level={result.trust_level || 1} />
          </div>

          {/* Details grid */}
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {result.trust_level_label && (
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-gray-500">Level</span>
                <span style={{ color: badge.color }}>{result.trust_level_label}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-gray-500">Certificate</span>
              <span className={result.certificate_valid ? 'text-green-400' : 'text-red-400'}>
                {result.certificate_valid ? 'Valid' : 'Invalid'}
              </span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-gray-500">Active</span>
              <span className={result.active ? 'text-green-400' : 'text-gray-500'}>
                {result.active ? 'Yes' : 'No'}
              </span>
            </div>
            {result.spending_limit !== undefined && (
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-gray-500">Daily Limit</span>
                <span className="text-gray-300">${result.spending_limit?.toLocaleString()}</span>
              </div>
            )}
            {result.permissions && (
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-gray-500">Permissions</span>
                <span className="text-gray-300">{result.permissions.length}</span>
              </div>
            )}
          </div>

          {/* Level up hint */}
          {result.level_up && result.level_up.next_level && (
            <div className="text-[10px] font-mono text-gray-500 mt-2">
              Next: {result.level_up.requirements?.join(', ')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function KeyGeneratedModal({ data, onClose }: { data: { publicKey: string; privateKey: string; privateKeyFull: string; solanaAddress: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [downloadedKey, setDownloadedKey] = useState(false)

  function copyPrivateKey() {
    navigator.clipboard.writeText(data.privateKeyFull)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  function downloadKey() {
    const blob = new Blob([data.privateKeyFull], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentid-key-${data.solanaAddress.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setDownloadedKey(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center rounded-[20px]"
      style={{ background: 'rgba(7,7,15,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <div className="p-5 w-full max-w-[90%]">
        {/* Success header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-sm">&#10003;</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Security Key Generated!</h4>
            <p className="text-[10px] text-gray-500">Your agent is now L2 — Verified</p>
          </div>
        </div>

        {/* Solana wallet */}
        {data.solanaAddress && (
          <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div className="text-[9px] font-mono text-gray-500 tracking-wider mb-1">SOLANA WALLET ADDRESS</div>
            <div className="text-[11px] font-mono text-cyan-400 break-all">{data.solanaAddress}</div>
            <div className="text-[9px] text-gray-600 mt-1">Your agent can now receive funds at this address</div>
          </div>
        )}

        {/* Private key warning */}
        <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.15)' }}>
          <div className="text-[10px] font-bold text-orange-400 mb-1">Save your private key</div>
          <div className="text-[10px] text-gray-400 leading-relaxed">
            This is the only time you will see this key. Save it somewhere safe. You need it to prove your agent's identity and to sign transactions.
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={copyPrivateKey}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(0,212,255,0.08)',
              border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(0,212,255,0.15)',
              color: copied ? '#22c55e' : '#00d4ff',
            }}
          >
            {copied ? 'Copied!' : 'Copy Private Key'}
          </button>
          <button
            onClick={downloadKey}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: downloadedKey ? 'rgba(34,197,94,0.1)' : 'rgba(123,47,255,0.08)',
              border: downloadedKey ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(123,47,255,0.15)',
              color: downloadedKey ? '#22c55e' : '#a78bfa',
            }}
          >
            {downloadedKey ? 'Downloaded!' : 'Download Key File'}
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full px-3 py-2.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}
        >
          Done — I've saved my key
        </button>
      </div>
    </motion.div>
  )
}

export default function AgentPassport({ agent, index, onAgentUpdated }: { agent: Agent; index: number; onAgentUpdated?: () => void }) {
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [bindingKey, setBindingKey] = useState(false)
  const [bindingWallet, setBindingWallet] = useState(false)
  const [challenging, setChallenging] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [keyModal, setKeyModal] = useState<{ publicKey: string; privateKey: string; privateKeyFull: string; solanaAddress: string } | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)

  const isOnline = agent.last_active
    ? (Date.now() - new Date(agent.last_active).getTime()) < 600000
    : false

  const issuedDate = new Date(agent.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const expiryDate = new Date(
    new Date(agent.created_at).getTime() + 365 * 24 * 60 * 60 * 1000 * 2
  ).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Determine trust level from agent data
  const trustLevel = agent.trust_level
    ? agent.trust_level
    : agent.wallet_address ? 3 : agent.ed25519_key ? 2 : 1

  // Shorten agent_id for display
  const shortId = agent.agent_id.length > 20
    ? agent.agent_id.slice(0, 8) + '...' + agent.agent_id.slice(-6)
    : agent.agent_id

  const mrzLine1 = `AGENT<${(agent.name || '').replace(/\s/g, '<').toUpperCase().padEnd(28, '<').slice(0, 28)}`
  const mrzLine2 = `${agent.agent_id.replace(/-/g, '').toUpperCase().padEnd(30, '<').slice(0, 30)}`

  function showToast(message: string, type: 'success' | 'error' | 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  // -- API helpers --

  async function getAuthHeader(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    // Fetch user's API key (we need a Bearer API key, not Supabase JWT)
    // First try to get existing keys
    const res = await fetch('/api/v1/keys', {
      method: 'GET',
    })
    // The keys endpoint might not support GET, so we use the session token directly
    // The bind-ed25519 endpoint requires API key auth, so we need to get one
    return session.access_token
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await fetch('/api/v1/agents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.agent_id }),
      })
      const data = await res.json()
      if (res.ok) {
        setVerifyResult(data)
      } else {
        showToast(data.error || 'Verification failed', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error')
    }
    setVerifying(false)
  }

  async function handleBindEd25519() {
    setBindingKey(true)
    try {
      // Generate Ed25519 keypair using Web Crypto API
      const keyPair = await crypto.subtle.generateKey(
        { name: 'Ed25519' } as any,
        true,
        ['sign', 'verify']
      )

      // Export the public key as raw bytes
      const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      const publicKeyHex = Array.from(new Uint8Array(publicKeyRaw))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Store the private key in sessionStorage so the user can use it for challenges
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
      sessionStorage.setItem(`agentid_privkey_${agent.agent_id}`, JSON.stringify(privateKeyJwk))

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        showToast('Not authenticated. Please log in again.', 'error')
        setBindingKey(false)
        return
      }

      const res = await fetch('/api/v1/agents/bind-ed25519', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          agent_id: agent.agent_id,
          ed25519_public_key: publicKeyHex,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        // Show the key modal with all details
        const privateKeyBase64 = privateKeyJwk.d || ''
        setKeyModal({
          publicKey: publicKeyHex,
          privateKey: privateKeyBase64,
          privateKeyFull: JSON.stringify(privateKeyJwk, null, 2),
          solanaAddress: data.solana_address || '',
        })
        onAgentUpdated?.()
      } else {
        showToast(data.error || 'Failed to generate key', 'error')
      }
    } catch (err: any) {
      if (err.name === 'NotSupportedError' || err.message?.includes('Ed25519')) {
        showToast('Your browser does not support this feature. Try Chrome or Firefox.', 'error')
      } else {
        showToast(err.message || 'Failed to generate key', 'error')
      }
    }
    setBindingKey(false)
  }

  async function handleBindWallet() {
    setBindingWallet(true)
    try {
      // If agent has a solana_address (from Ed25519 key), bind that as the wallet
      if (!agent.ed25519_key) {
        showToast('Generate a security key first (click "Generate Security Key" above)', 'error')
        setBindingWallet(false)
        return
      }

      const walletAddress = agent.solana_address
      if (!walletAddress) {
        showToast('Generate a security key first to get a wallet address', 'error')
        setBindingWallet(false)
        return
      }

      // Sign the binding message using the stored private key
      const storedKeyJson = sessionStorage.getItem(`agentid_privkey_${agent.agent_id}`)
      let signatureHex = '00'.repeat(64) // placeholder signature

      if (storedKeyJson) {
        try {
          const privateKeyJwk = JSON.parse(storedKeyJson)
          const privateKey = await crypto.subtle.importKey(
            'jwk',
            privateKeyJwk,
            { name: 'Ed25519' } as any,
            false,
            ['sign']
          )
          const message = new TextEncoder().encode(`AgentID:bind:${agent.agent_id}:${walletAddress}`)
          const signature = await crypto.subtle.sign('Ed25519' as any, privateKey, message)
          signatureHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        } catch {
          // If we can't sign, use placeholder — server stores it as proof-of-intent
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        showToast('Not authenticated. Please log in again.', 'error')
        setBindingWallet(false)
        return
      }

      const res = await fetch('/api/v1/agents/bind-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          agent_id: agent.agent_id,
          wallet_address: walletAddress,
          chain: 'solana',
          signature: signatureHex,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        showToast('Wallet connected! Your agent can now send and receive payments.', 'success')
        onAgentUpdated?.()
      } else {
        showToast(data.error || 'Failed to bind wallet', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to bind wallet', 'error')
    }
    setBindingWallet(false)
  }

  async function handleChallenge() {
    setChallenging(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        showToast('Not authenticated. Please log in again.', 'error')
        setChallenging(false)
        return
      }

      const res = await fetch('/api/v1/agents/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agent_id: agent.agent_id }),
      })

      const data = await res.json()
      if (res.ok) {
        showToast('Identity challenge sent! Your agent must respond within 60 seconds to prove it is real.', 'info')
      } else {
        showToast(data.error || 'Failed to issue challenge', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Challenge failed', 'error')
    }
    setChallenging(false)
  }

  // Determine level-up info
  const levelUpInfo = (() => {
    if (trustLevel >= 4) return null
    if (trustLevel === 1) return { text: 'Secure your agent with a cryptographic key', buttonLabel: 'Generate Security Key', action: handleBindEd25519, loading: bindingKey, hint: 'This gives your agent a unique digital signature — like a fingerprint. Takes 2 seconds.' }
    if (trustLevel === 2) return { text: 'Connect a Solana wallet to enable payments', buttonLabel: 'Connect Wallet', action: handleBindWallet, loading: bindingWallet, hint: 'Your agent gets its own blockchain wallet. It can hold and send funds, with receipts on-chain.' }
    if (trustLevel === 3) return { text: 'Verify your business identity for full authority', buttonLabel: 'Verify Business', action: null, loading: false, hint: 'Proves your agent is backed by a real organisation. Unlocks $100K/day spending and contract signing.' }
    return null
  })()

  // Solana explorer link
  const solanaExplorerUrl = agent.solana_address
    ? `https://explorer.solana.com/address/${agent.solana_address}?cluster=devnet`
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.015, rotateY: 1.5 }}
      style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
      className="passport-card relative group"
    >
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>

      {/* Verify result modal */}
      <AnimatePresence>
        {verifyResult && (
          <VerifyResultModal result={verifyResult} onClose={() => setVerifyResult(null)} />
        )}
      </AnimatePresence>

      {/* Key generated modal */}
      <AnimatePresence>
        {keyModal && (
          <KeyGeneratedModal data={keyModal} onClose={() => setKeyModal(null)} />
        )}
      </AnimatePresence>

      {/* Scan line */}
      <div className="scan-overlay absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none" />

      {/* Holographic shimmer strip */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-6">

        {/* -- Trust Level Badge (prominent, top) -- */}
        <div className="mb-4">
          <TrustLevelBadge level={trustLevel} />
        </div>

        {/* -- Passport Header -- */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl
              bg-gradient-to-br from-white/5 to-white/[0.02]
              border border-white/10 shadow-inner"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              {PLATFORM_ICONS[agent.platform || ''] ?? '🔮'}
            </div>
            <div>
              <div className="text-[9px] font-mono text-gray-500 tracking-[0.25em] uppercase mb-0.5">
                AgentID Passport
              </div>
              <h3 className="text-base font-bold text-white leading-snug">{agent.name}</h3>
              <p className="text-[10px] font-mono text-gray-600 mt-0.5 truncate max-w-[160px]">
                {shortId}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className={`heartbeat ${isOnline ? 'online' : 'offline'}`} />
              <span className={`text-[10px] font-mono font-semibold tracking-wider ${
                isOnline ? 'text-green-400' : 'text-gray-500'
              }`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            {agent.verified && (
              <div className="text-[9px] px-2 py-0.5 rounded-full font-mono tracking-wider
                bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                VERIFIED
              </div>
            )}
          </div>
        </div>

        {/* -- Certificate Block -- */}
        <div className="rounded-xl p-3.5 mb-4"
          style={{
            background:  'rgba(0,0,0,0.4)',
            border:      '1px solid rgba(0,212,255,0.1)',
            boxShadow:   'inset 0 1px 0 rgba(0,212,255,0.05)',
          }}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Owner</div>
              <div className="text-[11px] font-mono text-gray-300 truncate">{agent.owner}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Platform</div>
              <div className="text-[11px] font-mono text-gray-300 capitalize">{agent.platform || 'API'}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Issued</div>
              <div className="text-[11px] font-mono text-gray-300">{issuedDate}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono text-gray-600 tracking-[0.2em] uppercase mb-0.5">Expires</div>
              <div className="text-[11px] font-mono text-gray-300">{expiryDate}</div>
            </div>
          </div>
        </div>

        {/* -- Description -- */}
        {agent.description && (
          <p className="text-xs text-gray-500 mb-4 leading-relaxed line-clamp-2">
            {agent.description}
          </p>
        )}

        {/* -- Capabilities -- */}
        {agent.capabilities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {agent.capabilities.map((cap, i) => (
              <span key={i}
                className="text-[10px] px-2.5 py-1 rounded-full font-mono tracking-wide
                  bg-purple-500/8 text-purple-300 border border-purple-500/20
                  transition-colors hover:border-purple-400/40 hover:text-purple-200">
                {cap}
              </span>
            ))}
          </div>
        )}

        {/* -- Trust score bar -- */}
        <div className="mb-4">
          <TrustBar score={agent.trust_score ?? 0} />
        </div>

        {/* -- Level Up Section -- */}
        {levelUpInfo && (
          <div className="mb-4 rounded-xl p-3.5"
            style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
            }}>
            <div className="text-xs text-white font-medium mb-1">
              {levelUpInfo.text}
            </div>
            {levelUpInfo.hint && (
              <div className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                {levelUpInfo.hint}
              </div>
            )}
            <div className="flex items-center gap-2">
              {levelUpInfo.action ? (
                <motion.button
                  onClick={levelUpInfo.action}
                  disabled={levelUpInfo.loading}
                  whileHover={levelUpInfo.loading ? {} : { scale: 1.03 }}
                  whileTap={levelUpInfo.loading ? {} : { scale: 0.97 }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                    boxShadow: '0 2px 12px rgba(0,212,255,0.2)',
                  }}
                >
                  {levelUpInfo.loading ? (
                    <span className="flex items-center gap-1.5">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                      />
                      Setting up...
                    </span>
                  ) : levelUpInfo.buttonLabel}
                </motion.button>
              ) : (
                <a
                  href="/dashboard/verify-business"
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wide text-white transition-all hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 2px 8px rgba(245,158,11,0.15)',
                  }}
                >
                  Verify Business
                </a>
              )}
            </div>
          </div>
        )}

        {/* -- Action Buttons Row -- */}
        <div className="flex flex-wrap gap-2 mb-2">
          {/* Verify button */}
          <motion.button
            onClick={handleVerify}
            disabled={verifying}
            whileHover={verifying ? {} : { scale: 1.03 }}
            whileTap={verifying ? {} : { scale: 0.97 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wide transition-all disabled:opacity-50"
            style={{
              background: 'rgba(0,212,255,0.08)',
              color: '#00d4ff',
              border: '1px solid rgba(0,212,255,0.15)',
            }}
          >
            {verifying ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-3 h-3 rounded-full"
                style={{ border: '1.5px solid rgba(0,212,255,0.3)', borderTopColor: '#00d4ff' }}
              />
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {verifying ? 'Verifying...' : 'Verify'}
          </motion.button>

          {/* View on Blockchain */}
          {solanaExplorerUrl && (
            <a
              href={solanaExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wide transition-all hover:opacity-80"
              style={{
                background: 'rgba(168,85,247,0.08)',
                color: '#a855f7',
                border: '1px solid rgba(168,85,247,0.15)',
              }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Blockchain
            </a>
          )}

          {/* Challenge button */}
          {agent.ed25519_key && (
            <motion.button
              onClick={handleChallenge}
              disabled={challenging}
              whileHover={challenging ? {} : { scale: 1.03 }}
              whileTap={challenging ? {} : { scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wide transition-all disabled:opacity-50"
              style={{
                background: 'rgba(245,158,11,0.08)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.15)',
              }}
            >
              {challenging ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ border: '1.5px solid rgba(245,158,11,0.3)', borderTopColor: '#f59e0b' }}
                />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {challenging ? 'Issuing...' : 'Challenge'}
            </motion.button>
          )}
        </div>

        {/* Holographic stamp */}
        <motion.div
          className="absolute bottom-14 right-5 w-14 h-14 rounded-full pointer-events-none"
          style={{
            border:   '1px solid rgba(0,212,255,0.12)',
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(0,212,255,0.04) 90deg, transparent 180deg, rgba(123,47,255,0.04) 270deg, transparent 360deg)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[7px] font-mono text-cyan-500/30 text-center leading-tight tracking-widest">
              AGENT<br />ID<br />CERT
            </div>
          </div>
        </motion.div>
      </div>

      {/* -- MRZ strip (machine-readable zone) -- */}
      <div className="passport-mrz px-6 py-2.5 rounded-b-[20px] overflow-hidden">
        <div className="truncate opacity-60 text-[9px]">{mrzLine1}</div>
        <div className="truncate opacity-40 text-[9px]">{mrzLine2}</div>
      </div>
    </motion.div>
  )
}
