'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase, updateUserPassword } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [ready, setReady]           = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase client auto-detects the recovery token from the URL hash
    // Listen for the PASSWORD_RECOVERY event to know we're ready
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Also check if there's already a session (user may have landed here with a valid token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await updateUserPassword(password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(123,47,255,0.08) 0%, transparent 65%)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 65%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <a href="/" className="inline-block group">
            <span className="text-3xl font-black holo-gradient">AgentID</span>
          </a>
          <p className="text-gray-500 text-sm mt-2.5">Set a new password for your account.</p>
        </div>

        {/* Card */}
        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background:  'rgba(12, 12, 20, 0.85)',
            border:      '1px solid rgba(255,255,255,0.06)',
            boxShadow:   '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
            backdropFilter: 'blur(20px)',
          }}>
          {/* Top accent */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

          <div className="p-8">
            {!ready ? (
              <div className="text-center py-8">
                <motion.span
                  className="inline-block w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <p className="text-gray-500 text-sm mt-4">Verifying reset link...</p>
              </div>
            ) : (
              <>
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
                      New Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="input-field w-full rounded-xl px-4 py-3 text-sm"
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-500 uppercase tracking-[0.18em] mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      className="input-field w-full rounded-xl px-4 py-3 text-sm"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={loading ? {} : { scale: 1.01 }}
                    whileTap={loading ? {} : { scale: 0.99 }}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider mt-2
                      relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                          Updating...
                        </span>
                      ) : 'SET NEW PASSWORD'}
                    </span>
                  </motion.button>
                </form>
              </>
            )}

            <p className="text-center text-gray-600 text-xs mt-6">
              <a href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                Back to sign in
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          getagentid.dev — The trust layer for AI agents
        </p>
      </motion.div>
    </div>
  )
}
