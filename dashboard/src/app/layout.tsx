import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentID — Command Center',
  description: 'The Identity & Discovery Layer for AI Agents',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grid-bg min-h-screen">{children}</body>
    </html>
  )
}
