'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { signUp } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
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
          <p className="text-gray-500 text-sm mt-2">Create your account</p>
        </div>

        {success ? (
          <div className="glow-border rounded-xl p-8 bg-[#111118] text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-gray-400 text-sm">We sent a confirmation link to <span className="text-cyan-400">{email}</span></p>
            <a href="/login" className="text-cyan-500 text-sm mt-4 inline-block hover:underline">Go to login</a>
          </div>
        ) : (
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

            <div className="mb-4">
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                placeholder="Your company name"
              />
            </div>

            <div className="mb-6">
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                placeholder="Min 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white font-bold text-sm tracking-wider disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'GET STARTED FREE'}
            </button>

            <p className="text-center text-gray-600 text-xs mt-4">
              Already have an account? <a href="/login" className="text-cyan-500 hover:underline">Log in</a>
            </p>

            <p className="text-center text-gray-700 text-xs mt-2">
              Free tier: 5 agents, 1,000 verifications/month
            </p>
          </form>
        )}
      </motion.div>
    </div>
  )
}
