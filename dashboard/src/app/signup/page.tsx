'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { signUp, signInWithGitHub, getUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

export default function SignUpPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const router = useRouter()

  useEffect(() => {
    getUser().then(u => { if (u) router.push('/dashboard') })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(123,47,255,0.08) 0%, transparent 65%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <a href="/" className="inline-block">
            <span className="text-3xl font-black holo-gradient">AgentID</span>
          </a>
          <p className="text-gray-500 text-sm mt-2.5">Create your free account. No credit card needed.</p>
        </div>

        {/* Success state */}
        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden text-center p-10"
            style={{
              background:  'rgba(12, 12, 20, 0.85)',
              border:      '1px solid rgba(0,230,118,0.2)',
              boxShadow:   '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,230,118,0.06)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="h-[1px] absolute top-0 left-0 right-0 bg-gradient-to-r from-transparent via-green-400/30 to-transparent" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)' }}
            >
              <span className="text-2xl">✓</span>
            </motion.div>
            <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              We sent a confirmation link to{' '}
              <span className="text-cyan-400 font-medium">{email}</span>.
              <br />Click it to activate your account.
            </p>
            <a href="/login"
              className="inline-block mt-6 text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
              Back to login →
            </a>
          </motion.div>
        ) : (
          /* Main form card */
          <div className="relative rounded-2xl overflow-hidden"
            style={{
              background:  'rgba(12, 12, 20, 0.85)',
              border:      '1px solid rgba(255,255,255,0.06)',
              boxShadow:   '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
              backdropFilter: 'blur(20px)',
            }}>
            {/* Top accent */}
            <div className="h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />

            <div className="p-8">
              {/* GitHub */}
              <motion.button
                type="button"
                onClick={() => signInWithGitHub()}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 rounded-xl text-sm font-semibold tracking-wide
                  flex items-center justify-center gap-2.5 mb-6 transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border:     '1px solid rgba(255,255,255,0.09)',
                  color:      '#e0e0e0',
                }}
              >
                <GitHubIcon />
                Continue with GitHub
              </motion.button>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs text-gray-600"
                    style={{ background: 'rgba(12,12,20,0.85)' }}>
                    or sign up with email
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3.5 mb-5 text-sm flex items-start gap-2.5"
                  style={{
                    background: 'rgba(255,82,82,0.08)',
                    border:     '1px solid rgba(255,82,82,0.2)',
                    color:      '#ff8a80',
                  }}
                >
                  <span className="mt-0.5 shrink-0">⚠</span>
                  {error}
                </motion.div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase tracking-[0.18em] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="input-field w-full rounded-xl px-4 py-3 text-sm"
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase tracking-[0.18em] mb-2">
                    Company <span className="text-gray-700 normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    className="input-field w-full rounded-xl px-4 py-3 text-sm"
                    placeholder="Your company or project"
                    autoComplete="organization"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase tracking-[0.18em] mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-field w-full rounded-xl px-4 py-3 text-sm"
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? {} : { scale: 1.01 }}
                  whileTap={loading ? {} : { scale: 0.99 }}
                  className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider mt-2
                    relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}
                >
                  <span className="relative z-10">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        Creating account...
                      </span>
                    ) : 'CREATE FREE ACCOUNT'}
                  </span>
                </motion.button>
              </form>

              <p className="text-center text-gray-600 text-xs mt-6">
                Already have an account?{' '}
                <a href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Free tier note */}
        {!success && (
          <p className="text-center text-gray-700 text-xs mt-4">
            Free tier: 5 agents · 1,000 verifications/month · No credit card required
          </p>
        )}
      </motion.div>
    </div>
  )
}
