import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'AgentID — The Identity Layer for AI Agents',
  description: 'Register, verify, and discover AI agents with cryptographic certificates.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grid-bg min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  )
}
