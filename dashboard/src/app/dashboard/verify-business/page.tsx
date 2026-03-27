'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const COUNTRIES = [
  'Nigeria', 'United States', 'United Kingdom', 'Canada', 'Germany', 'France',
  'India', 'South Africa', 'Kenya', 'Ghana', 'Australia', 'Singapore',
  'United Arab Emirates', 'Netherlands', 'Switzerland', 'Japan', 'Brazil',
  'Ireland', 'Estonia', 'Other',
]

export default function VerifyBusinessPage() {
  const [user, setUser] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Form fields
  const [businessName, setBusinessName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [fileName, setFileName] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setReady(true)
        // Pre-fill contact email from user account
        if (session.user.email) setContactEmail(session.user.email)
      }
      if (event === 'INITIAL_SESSION' && !session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!businessName.trim() || !registrationNumber.trim() || !country || !contactEmail.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Session expired. Please log in again.')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/v1/verify-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          registrationNumber: registrationNumber.trim(),
          country,
          website: website.trim(),
          contactEmail: contactEmail.trim(),
          fileName,
          notes: notes.trim(),
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  // Loading state
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    )
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <a href="/dashboard" className="text-cyan-500/50 text-sm hover:text-cyan-400">← Dashboard</a>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'rgba(34,197,94,0.04)',
              border: '1px solid rgba(34,197,94,0.15)',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            <h2 className="text-xl font-black text-white mb-2">Verification request submitted!</h2>
            <p className="text-gray-400 text-sm mb-1">We'll review your documents within 48 hours.</p>
            <p className="text-gray-500 text-sm mb-8">You'll receive an email when your agents are upgraded to L4.</p>

            <div className="rounded-xl p-4 mb-6 text-left max-w-sm mx-auto"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-500">Business</span>
                  <span className="text-gray-300">{businessName}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-500">Country</span>
                  <span className="text-gray-300">{country}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-500">Contact</span>
                  <span className="text-gray-300">{contactEmail}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-500">Status</span>
                  <span className="text-yellow-400">Pending Review</span>
                </div>
              </div>
            </div>

            <a href="/dashboard"
              className="inline-block px-6 py-3 rounded-lg text-white text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)', boxShadow: '0 4px 16px rgba(0,212,255,0.2)' }}
            >
              Back to Dashboard
            </a>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/dashboard" className="text-cyan-500/50 text-sm hover:text-cyan-400">← Dashboard</a>
            <h1 className="text-3xl font-black mt-2"><span className="holo-gradient">Verify Business</span></h1>
            <p className="text-gray-500 text-sm mt-1">Upgrade your agents to L4 — Certified</p>
          </div>
        </div>

        {/* What L4 unlocks */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 mb-8"
          style={{
            background: 'rgba(245,158,11,0.03)',
            border: '1px solid rgba(245,158,11,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider"
              style={{
                background: 'rgba(245,158,11,0.10)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.25)',
                boxShadow: '0 0 12px rgba(245,158,11,0.10)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
              L4 — Certified
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { text: 'Proves your agent is backed by a real organisation', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
              { text: 'Unlocks $100,000/day spending authority', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              { text: 'Unlocks contract signing and full autonomy', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              { text: 'Required for enterprise and government use', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <span className="text-xs text-gray-300 leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Verification form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glow-border rounded-xl p-6 bg-[#111118]"
        >
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Business Details</h2>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg text-xs font-mono"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-5">
            {/* Business name */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Business Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Corp Ltd"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-600 font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            {/* Registration number */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Registration Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. RC1234567 or CAC-BN-1234567"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-600 font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Country <span className="text-red-400">*</span>
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-sm text-white font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/30 appearance-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <option value="" disabled className="bg-[#111118] text-gray-500">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} className="bg-[#111118] text-white">{c}</option>
                ))}
              </select>
            </div>

            {/* Website */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Business Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acmecorp.com"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-600 font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            {/* Contact email */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Contact Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-600 font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            {/* File upload */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Proof Document
              </label>
              <p className="text-[10px] text-gray-600 mb-2">
                Certificate of incorporation, business registration, or similar. We'll request this via email if not attached.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full px-4 py-4 rounded-lg text-center cursor-pointer transition-all hover:border-cyan-500/20"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.1)' }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-400 font-mono">{fileName}</span>
                  </div>
                ) : (
                  <div>
                    <svg className="w-6 h-6 text-gray-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-xs text-gray-500">Click to upload (PDF, PNG, JPG, DOC)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 tracking-wider uppercase mb-1.5">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context about your organisation..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-gray-600 font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/30 resize-none"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={submitting ? {} : { scale: 1.02 }}
              whileTap={submitting ? {} : { scale: 0.98 }}
              className="w-full px-6 py-3.5 rounded-lg text-white text-sm font-bold disabled:opacity-50 transition-all"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                boxShadow: '0 4px 16px rgba(245,158,11,0.2)',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="inline-block w-4 h-4 rounded-full"
                    style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                  />
                  Submitting...
                </span>
              ) : (
                'Submit Verification Request'
              )}
            </motion.button>
            <p className="text-[10px] text-gray-600 text-center mt-3 font-mono">
              We review all requests manually. Typical turnaround is 24–48 hours.
            </p>
          </div>
        </motion.form>

        {/* Footer */}
        <div className="text-center py-10 mt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-gray-700 text-xs font-mono">AgentID · getagentid.dev</p>
        </div>
      </motion.div>
    </div>
  )
}
