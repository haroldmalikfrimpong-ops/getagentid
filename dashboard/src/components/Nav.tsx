'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const isActive = (path: string) => pathname === path

  // Don't show nav on landing page
  if (pathname === '/') return null

  const userName = user?.user_metadata?.user_name || user?.user_metadata?.full_name || user?.email || ''
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-8">
        <a href="/" className="text-lg font-black holo-gradient">AgentID</a>
        {user && (
          <div className="flex gap-1">
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/dashboard/keys', label: 'API Keys' },
              { href: '/docs', label: 'Docs' },
            ].map((link) => (
              <a key={link.href} href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}>
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            {avatarUrl && <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full border border-cyan-500/20" />}
            <span className="text-xs text-gray-400 hidden md:block">{userName}</span>
            <button onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors">
              Sign Out
            </button>
          </>
        ) : (
          <>
            <a href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">Log In</a>
            <a href="/signup" className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white text-xs font-bold">Sign Up</a>
          </>
        )}
      </div>
    </nav>
  )
}
