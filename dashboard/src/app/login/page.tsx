'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { signIn, signInWithGitHub } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-black"><span className="holo-gradient">AgentID</span></a>
          <p className="text-gray-500 text-sm mt-2">Log in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="glow-border rounded-xl p-8 bg-[#111118]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
              placeholder="you@company.com"
            />
          </div>

          <div className="mb-6">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white font-bold text-sm tracking-wider disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'LOG IN'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center"><span className="bg-[#111118] px-3 text-xs text-gray-600">or</span></div>
          </div>

          <button
            type="button"
            onClick={() => signInWithGitHub()}
            className="w-full py-3 bg-white/5 border border-white/10 rounded-lg text-white font-bold text-sm tracking-wider hover:bg-white/10 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            Log in with GitHub
          </button>

          <p className="text-center text-gray-600 text-xs mt-4">
            No account? <a href="/signup" className="text-cyan-500 hover:underline">Sign up free</a>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
