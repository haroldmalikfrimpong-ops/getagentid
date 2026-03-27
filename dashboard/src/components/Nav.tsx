'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePathname, useRouter } from 'next/navigation'

export default function Nav() {
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Don't render on the landing page — it has its own nav
  if (pathname === '/') return null

  const isActive   = (path: string) => pathname === path
  const userName   = user?.user_metadata?.user_name || user?.user_metadata?.full_name || user?.email || ''
  const avatarUrl  = user?.user_metadata?.avatar_url

  // Always-visible links (redirect to /login if not logged in)
  const publicLinks = [
    { href: '/dashboard',             label: 'Dashboard' },
    { href: '/dashboard/fleet',       label: 'Fleet' },
    { href: '/dashboard/audit',       label: 'Audit' },
    { href: '/dashboard/reports',     label: 'Reports' },
    { href: '/registry',              label: 'Registry' },
    { href: '/setup',                 label: 'Setup' },
    { href: '/docs',                  label: 'Docs' },
  ]

  // Only shown when logged in
  const authLinks = [
    { href: '/dashboard/keys',        label: 'API Keys' },
  ]

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // Public routes don't need auth
    if (href === '/registry' || href === '/docs' || href === '/setup') return
    // If not logged in, redirect to login
    if (!user) {
      e.preventDefault()
      router.push('/login')
    }
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background:     'rgba(7,7,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom:   '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center gap-6">
        <a href="/" className="text-lg font-black holo-gradient">AgentID</a>

        <div className="flex gap-1">
          {publicLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={isActive(link.href)
                ? { background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }
                : { color: '#6b7280' }
              }
            >
              {link.label}
            </a>
          ))}
          {user && authLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={isActive(link.href)
                ? { background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }
                : { color: '#6b7280' }
              }
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full"
                style={{ border: '1px solid rgba(0,212,255,0.2)' }}
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(123,47,255,0.3))',
                  border: '1px solid rgba(0,212,255,0.2)',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs text-gray-400 hidden md:block max-w-[140px] truncate">{userName}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-400/5"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <a href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">Log In</a>
            <a
              href="/signup"
              className="px-4 py-1.5 rounded-full text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7b2fff)' }}
            >
              Sign Up
            </a>
          </>
        )}
      </div>
    </nav>
  )
}
