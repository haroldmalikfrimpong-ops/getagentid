'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { signIn } from '@/lib/supabase'
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

          <p className="text-center text-gray-600 text-xs mt-4">
            No account? <a href="/signup" className="text-cyan-500 hover:underline">Sign up free</a>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
