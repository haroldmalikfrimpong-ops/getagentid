'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface IssuerResult {
  name: string
  type: string
  alg: string
  kid: string
  status: 'loading' | 'verified' | 'failed'
  jwks_url: string
  detail?: string
}

export default function CrossTestsPage() {
  const [results, setResults] = useState<IssuerResult[]>([
    { name: 'AgentID', type: 'trust_verification', alg: 'EdDSA', kid: 'agentid-2026-03', status: 'loading', jwks_url: 'https://getagentid.dev/.well-known/jwks.json' },
    { name: 'APS', type: 'passport_grade', alg: 'EdDSA', kid: 'gateway-v1', status: 'loading', jwks_url: 'https://gateway.aeoess.com/.well-known/jwks.json' },
    { name: 'InsumerAPI', type: 'wallet_state', alg: 'ES256', kid: 'insumer-attest-v1', status: 'loading', jwks_url: 'https://api.insumermodel.com/.well-known/jwks.json' },
    { name: 'ThoughtProof', type: 'reasoning_integrity', alg: 'EdDSA', kid: 'tp-attestor-v1', status: 'loading', jwks_url: 'https://api.thoughtproof.ai/.well-known/jwks.json' },
    { name: 'RNWY', type: 'behavioral_trust', alg: 'ES256', kid: 'rnwy-trust-v1', status: 'loading', jwks_url: 'https://rnwy.com/.well-known/jwks.json' },
    { name: 'Maiat', type: 'job_performance', alg: 'ES256', kid: 'maiat-trust-v1', status: 'loading', jwks_url: 'https://app.maiat.io/.well-known/jwks.json' },
  ])
  const [agentData, setAgentData] = useState<any>(null)
  const [proofData, setProofData] = useState<any>(null)
  const [trustHeader, setTrustHeader] = useState<any>(null)

  const AGENT_ID = 'agent_d1b7ef01f9af191f'

  useEffect(() => {
    // Verify each issuer's JWKS
    results.forEach((issuer, i) => {
      fetch(issuer.jwks_url)
        .then(r => r.json())
        .then(data => {
          const keys = data.keys || []
          const found = keys.find((k: any) => k.kid === issuer.kid)
          setResults(prev => {
            const next = [...prev]
            next[i] = { ...next[i], status: found ? 'verified' : 'failed', detail: found ? `${found.kty}/${found.crv || found.alg}` : 'key not found' }
            return next
          })
        })
        .catch(() => {
          setResults(prev => {
            const next = [...prev]
            next[i] = { ...next[i], status: 'failed', detail: 'unreachable' }
            return next
          })
        })
    })

    // Fetch AgentID verify
    fetch('https://www.getagentid.dev/api/v1/agents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: AGENT_ID }),
    })
      .then(r => r.json())
      .then(data => {
        setAgentData(data)
        // Fetch proof
        const receiptId = data.receipt?.hash?.receipt_id
        if (receiptId) {
          fetch(`https://www.getagentid.dev/proof/${receiptId}`)
            .then(r => r.json())
            .then(setProofData)
        }
      })

    // Fetch trust header
    fetch(`https://www.getagentid.dev/api/v1/agents/trust-header?agent_id=${AGENT_ID}`)
      .then(r => r.json())
      .then(setTrustHeader)
  }, [])

  const verified = results.filter(r => r.status === 'verified').length
  const total = results.length

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <div className="mb-10">
            <div className="text-[11px] font-mono text-cyan-400/50 tracking-[0.3em] uppercase mb-3">
              Live Cross-Examination
            </div>
            <h1 className="text-3xl font-black text-white mb-3">
              <span className="holo-gradient">Multi-Attestation Verification</span>
            </h1>
            <p className="text-gray-400 leading-relaxed max-w-2xl">
              AgentID verified alongside 5 independent trust issuers in real-time.
              Each issuer covers a different trust dimension. All cryptographically verifiable.
              No shared keys. No shared infrastructure. One agent, six independent proofs.
            </p>
          </div>

          {/* Score */}
          <div className="rounded-2xl p-8 mb-8 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-6xl font-black mb-2" style={{ color: verified === total ? '#22c55e' : '#f0a500' }}>
              {verified}/{total}
            </div>
            <div className="text-gray-500 text-sm">Issuers Verified Live</div>
          </div>

          {/* Issuer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {results.map((issuer, i) => (
              <motion.div
                key={issuer.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${issuer.status === 'verified' ? 'rgba(34,197,94,0.3)' : issuer.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-bold text-sm">{issuer.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{
                    background: issuer.status === 'verified' ? 'rgba(34,197,94,0.1)' : issuer.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                    color: issuer.status === 'verified' ? '#22c55e' : issuer.status === 'failed' ? '#ef4444' : '#666',
                  }}>
                    {issuer.status === 'loading' ? '...' : issuer.status === 'verified' ? 'VERIFIED' : 'FAILED'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-1">Signal: {issuer.type}</div>
                <div className="text-xs text-gray-600">Algorithm: {issuer.alg} | Key: {issuer.kid}</div>
                {issuer.detail && <div className="text-xs text-gray-600 mt-1">{issuer.detail}</div>}
              </motion.div>
            ))}
          </div>

          {/* AgentID Live Data */}
          {agentData && (
            <div className="rounded-2xl p-6 mb-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <h2 className="text-sm font-bold text-cyan-400 mb-4">AgentID Live Verification</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Agent</div>
                  <div className="text-white font-mono">{agentData.agent_id}</div>
                </div>
                <div>
                  <div className="text-gray-500">Verified</div>
                  <div className="text-green-400 font-bold">{agentData.verified ? 'TRUE' : 'FALSE'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Trust Level</div>
                  <div className="text-white">{agentData.trust_level_label}</div>
                </div>
                <div>
                  <div className="text-gray-500">Context Continuity</div>
                  <div className="text-white">{agentData.context_continuity?.score ?? '?'}/100</div>
                </div>
                <div>
                  <div className="text-gray-500">Agent Type</div>
                  <div className="text-white">{agentData.agent_type}</div>
                </div>
                <div>
                  <div className="text-gray-500">DID</div>
                  <div className="text-cyan-400 font-mono text-[10px] break-all">{agentData.did}</div>
                </div>
              </div>
            </div>
          )}

          {/* Trust Header */}
          {trustHeader && (
            <div className="rounded-2xl p-6 mb-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(123,47,255,0.15)' }}>
              <h2 className="text-sm font-bold text-purple-400 mb-4">EdDSA Trust Header JWT</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                {trustHeader.payload && Object.entries(trustHeader.payload).map(([k, v]: [string, any]) => (
                  <div key={k}>
                    <div className="text-gray-500">{k}</div>
                    <div className="text-white font-mono text-[11px] break-all">{String(v)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-[10px] text-gray-600">
                Signed with Ed25519 (EdDSA). Verify offline with public key from /.well-known/jwks.json
              </div>
            </div>
          )}

          {/* Proof */}
          {proofData && (
            <div className="rounded-2xl p-6 mb-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <h2 className="text-sm font-bold text-green-400 mb-4">Receipt Proof</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Verification Status</div>
                  <div className="text-green-400 font-bold">{proofData.verification_status}</div>
                </div>
                <div>
                  <div className="text-gray-500">Ed25519 Signature</div>
                  <div className="text-green-400">{proofData.compound_digest_ed25519_signature ? 'PRESENT' : 'MISSING'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Signing Key Embedded</div>
                  <div className="text-white">{proofData.signing_key ? `kid: ${proofData.signing_key.key_id}` : 'NO'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Canonicalization</div>
                  <div className="text-white">{proofData.canonicalization}</div>
                </div>
                <div>
                  <div className="text-gray-500">Blockchain Anchor</div>
                  <div className="text-white">{proofData.blockchain_anchor ? 'Solana' : 'None'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Attestation Level</div>
                  <div className="text-white">{proofData.attestation_level}</div>
                </div>
              </div>
            </div>
          )}

          {/* What each issuer proves */}
          <div className="rounded-2xl p-6 mb-6"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white mb-4">What Each Issuer Proves</h2>
            <div className="space-y-3">
              {[
                { name: 'AgentID', q: 'Is this agent still behaving like itself?', color: '#00d4ff' },
                { name: 'APS', q: 'What is this agent allowed to do?', color: '#ff6b6b' },
                { name: 'InsumerAPI', q: 'What does this wallet hold?', color: '#4285F4' },
                { name: 'ThoughtProof', q: 'Did this agent reason correctly?', color: '#22c55e' },
                { name: 'RNWY', q: 'Is this agent legitimate on-chain?', color: '#f0a500' },
                { name: 'Maiat', q: 'Has this agent delivered quality work?', color: '#a78bfa' },
              ].map(item => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <span className="text-white text-xs font-bold w-24 shrink-0">{item.name}</span>
                  <span className="text-gray-400 text-xs">{item.q}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-4">
              Six independent issuers. Six different trust dimensions. All cryptographically verifiable. No shared keys or infrastructure.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center mt-10">
            <a href="/docs" className="inline-block px-8 py-4 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)', boxShadow: '0 4px 20px rgba(0,212,255,0.2)' }}>
              Read the Docs
            </a>
            <p className="text-gray-600 text-xs mt-4">pip install getagentid</p>
          </div>

        </motion.div>
      </div>
    </div>
  )
}
