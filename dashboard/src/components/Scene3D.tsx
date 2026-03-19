'use client'

import { motion } from 'framer-motion'

export default function Scene3D({ agents }: { agents: any[] }) {
  const colors = ['#00d4ff', '#7b2fff', '#00ff64', '#ff9500']
  const positions = [
    { left: '15%', top: '30%' },
    { left: '75%', top: '25%' },
    { left: '20%', top: '70%' },
    { left: '70%', top: '65%' },
  ]

  return (
    <div className="w-full h-[500px] relative overflow-hidden bg-[#060610]">
      {/* Grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div key={`p-${i}`} className="absolute w-1 h-1 rounded-full"
          style={{ background: colors[i % 4], left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }} />
      ))}

      {/* Central core */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div className="w-28 h-28 rounded-full border border-cyan-500/20"
          animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute inset-3 rounded-full border border-purple-500/20"
          animate={{ rotate: -360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute inset-6 rounded-full border border-green-500/15"
          animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity }}>
            <div className="text-[10px] font-mono text-cyan-400/60">AGENT</div>
            <div className="text-lg font-black holo-gradient">ID</div>
          </motion.div>
        </div>
      </div>

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {agents.slice(0, 4).map((_, i) => (
          <motion.line key={`l-${i}`} x1={positions[i].left} y1={positions[i].top} x2="50%" y2="50%"
            stroke={colors[i]} strokeWidth="1"
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }} />
        ))}
      </svg>

      {/* Agent orbs */}
      {agents.slice(0, 4).map((agent, i) => (
        <motion.div key={agent.agent_id} className="absolute" style={{ ...positions[i], transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.15 }}>
          <motion.div className="absolute -inset-3 rounded-full"
            style={{ background: `radial-gradient(circle, ${colors[i]}10, transparent)` }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }} />
          <motion.div className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{ border: `1px solid ${colors[i]}30`, background: `${colors[i]}08` }}
            animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.4 }}>
            <div className="text-lg">{i === 0 ? '📈' : i === 1 ? '🤖' : i === 2 ? '📱' : '💰'}</div>
          </motion.div>
          <div className="text-center mt-2">
            <div className="text-[10px] font-mono" style={{ color: colors[i] }}>{agent.name}</div>
          </div>
        </motion.div>
      ))}

      {/* HUD */}
      <div className="absolute top-3 left-3 text-[9px] font-mono text-cyan-500/30 space-y-0.5">
        <div>AGENTID NETWORK</div>
        <div>{agents.length} REGISTERED</div>
      </div>
      <div className="absolute top-3 right-3 text-[9px] font-mono text-purple-500/30 text-right space-y-0.5">
        <div>TRUST LAYER</div>
        <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>ACTIVE</motion.div>
      </div>
    </div>
  )
}
