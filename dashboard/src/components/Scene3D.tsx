'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

// Deterministic pseudo-random based on index — no Math.random() at render time
// so there are no SSR/hydration mismatches.
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

const COLORS = ['#00d4ff', '#7b2fff', '#00e676', '#ff9500', '#ff6b6b']

const ORBITAL_POSITIONS = [
  { left: '14%',  top: '28%' },
  { left: '76%',  top: '22%' },
  { left: '18%',  top: '68%' },
  { left: '72%',  top: '63%' },
]

const AGENT_ICONS = ['📈', '🤖', '📱', '💰']

export default function Scene3D({ agents }: { agents: any[] }) {
  // Build particle data once using deterministic seeds
  const particles = useMemo(() =>
    Array.from({ length: 60 }).map((_, i) => ({
      left:     `${seededRand(i * 3 + 0) * 100}%`,
      top:      `${seededRand(i * 3 + 1) * 100}%`,
      color:    COLORS[i % COLORS.length],
      duration: 3.5 + seededRand(i * 3 + 2) * 4,
      delay:    seededRand(i * 7) * 3,
      size:     seededRand(i * 5) > 0.7 ? 2 : 1,
      yAmp:     10 + seededRand(i * 11) * 18,
    })),
  [])

  return (
    <div className="w-full h-[540px] relative overflow-hidden rounded-2xl"
      style={{ background: 'radial-gradient(ellipse at 50% 60%, #0a0a1a 0%, #05050e 100%)' }}>

      {/* Grid — perspective tilt */}
      <div className="absolute inset-0" style={{
        backgroundImage:
          'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* Ambient glow blobs */}
      <div className="absolute w-96 h-96 -top-24 -left-24 opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.3) 0%, transparent 70%)' }} />
      <div className="absolute w-96 h-96 -bottom-24 -right-24 opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(123,47,255,0.3) 0%, transparent 70%)' }} />

      {/* Particles */}
      {particles.map((p, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width:  p.size,
            height: p.size,
            background: p.color,
            left: p.left,
            top:  p.top,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{
            y:       [0, -p.yAmp, 0],
            opacity: [0.1, 0.7, 0.1],
            scale:   [1, 1.4, 1],
          }}
          transition={{
            duration: p.duration,
            repeat:   Infinity,
            delay:    p.delay,
            ease:     'easeInOut',
          }}
        />
      ))}

      {/* Connection lines to center */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          {COLORS.map((c, i) => (
            <linearGradient key={i} id={`lg-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={c} stopOpacity="0" />
              <stop offset="50%" stopColor={c} stopOpacity="0.35" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {agents.slice(0, 4).map((_, i) => (
          <motion.line
            key={`line-${i}`}
            x1={ORBITAL_POSITIONS[i].left}
            y1={ORBITAL_POSITIONS[i].top}
            x2="50%" y2="50%"
            stroke={COLORS[i]}
            strokeWidth="1.5"
            strokeDasharray="4 8"
            animate={{ opacity: [0.05, 0.25, 0.05], strokeDashoffset: [0, -24] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.6, ease: 'linear' }}
          />
        ))}
      </svg>

      {/* Central core */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {/* Outer orbit rings */}
        <motion.div
          className="w-36 h-36 rounded-full"
          style={{ border: '1px solid rgba(0,212,255,0.18)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-4 rounded-full"
          style={{ border: '1px solid rgba(123,47,255,0.18)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-8 rounded-full"
          style={{ border: '1px solid rgba(0,230,118,0.12)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />

        {/* Core glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="text-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[9px] font-mono text-cyan-400/50 tracking-[0.3em] mb-0.5">AGENT</div>
            <div className="text-2xl font-black holo-gradient leading-none">ID</div>
            <motion.div
              className="text-[8px] font-mono text-cyan-400/30 tracking-wider mt-1"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              TRUST LAYER
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Agent orbs */}
      {agents.slice(0, 4).map((agent, i) => (
        <motion.div
          key={agent.agent_id}
          className="absolute"
          style={{ ...ORBITAL_POSITIONS[i], transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 200, damping: 14 }}
        >
          {/* Pulsing aura */}
          <motion.div
            className="absolute -inset-5 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${COLORS[i]}18 0%, transparent 70%)` }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.4 }}
          />

          {/* Orb */}
          <motion.div
            className="relative w-16 h-16 rounded-full flex items-center justify-center cursor-default"
            style={{
              border:     `1px solid ${COLORS[i]}40`,
              background: `linear-gradient(145deg, ${COLORS[i]}10 0%, ${COLORS[i]}05 100%)`,
              boxShadow:  `0 0 20px ${COLORS[i]}20, inset 0 1px 0 ${COLORS[i]}20`,
            }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' }}
            whileHover={{ scale: 1.12, boxShadow: `0 0 35px ${COLORS[i]}40` }}
          >
            <span className="text-xl">{AGENT_ICONS[i]}</span>
          </motion.div>

          {/* Label */}
          <div className="text-center mt-2 max-w-[80px]">
            <div
              className="text-[10px] font-mono font-medium truncate"
              style={{ color: COLORS[i], textShadow: `0 0 10px ${COLORS[i]}60` }}
            >
              {agent.name}
            </div>
            <div className="text-[8px] text-gray-600 font-mono">CERTIFIED</div>
          </div>
        </motion.div>
      ))}

      {/* HUD overlays */}
      <div className="absolute top-4 left-4 text-[9px] font-mono text-cyan-500/25 space-y-1 pointer-events-none">
        <div className="tracking-[0.2em]">AGENTID NETWORK</div>
        <div>{agents.length} REGISTERED</div>
        <motion.div
          className="flex items-center gap-1.5"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-green-400/50">LIVE</span>
        </motion.div>
      </div>

      <div className="absolute top-4 right-4 text-[9px] font-mono text-purple-500/25 text-right space-y-1 pointer-events-none">
        <div className="tracking-[0.2em]">TRUST LAYER v1</div>
        <motion.div animate={{ opacity: [0.3, 0.9, 0.3] }} transition={{ duration: 1.8, repeat: Infinity }}>
          ACTIVE
        </motion.div>
        <div>UPTIME 99.9%</div>
      </div>

      {/* Corner brackets decoration */}
      {[
        'top-2 left-2 border-t border-l',
        'top-2 right-2 border-t border-r',
        'bottom-2 left-2 border-b border-l',
        'bottom-2 right-2 border-b border-r',
      ].map((cls, i) => (
        <div key={i} className={`absolute w-4 h-4 ${cls} border-cyan-500/15`} />
      ))}

      {/* Bottom scanline vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(5,5,14,0.6) 100%)' }} />
    </div>
  )
}
