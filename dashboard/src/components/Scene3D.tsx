'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'

function DataParticles({ count = 200 }) {
  const mesh = useRef<THREE.Points>(null!)

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
      const r = Math.random()
      if (r < 0.33) { col[i*3]=0; col[i*3+1]=0.83; col[i*3+2]=1 }
      else if (r < 0.66) { col[i*3]=0.48; col[i*3+1]=0.18; col[i*3+2]=1 }
      else { col[i*3]=0; col[i*3+1]=1; col[i*3+2]=0.39 }
    }
    return [pos, col]
  }, [count])

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.02
    }
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} vertexColors transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

function AgentOrb({ position, color, name }: { position: [number, number, number]; color: string; name: string }) {
  const mesh = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.3
      mesh.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <group position={position}>
        <mesh ref={mesh}>
          <icosahedronGeometry args={[0.5, 1]} />
          <MeshDistortMaterial color={color} wireframe transparent opacity={0.3} distort={0.2} speed={3} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} />
        </mesh>
        <Html position={[0, -0.9, 0]} center>
          <div style={{ color, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {name}
          </div>
        </Html>
      </group>
    </Float>
  )
}

function CentralCore() {
  const ring1 = useRef<THREE.Mesh>(null!)
  const ring2 = useRef<THREE.Mesh>(null!)
  const ring3 = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ring1.current) ring1.current.rotation.y = t * 0.5
    if (ring2.current) ring2.current.rotation.x = t * 0.4
    if (ring3.current) ring3.current.rotation.z = t * 0.3
  })

  return (
    <Float speed={1.5} floatIntensity={0.5}>
      <group>
        <mesh ref={ring1}>
          <torusGeometry args={[1.2, 0.02, 16, 100]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.3} />
        </mesh>
        <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.02, 16, 100]} />
          <meshBasicMaterial color="#7b2fff" transparent opacity={0.2} />
        </mesh>
        <mesh ref={ring3} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.8, 0.02, 16, 100]} />
          <meshBasicMaterial color="#00ff64" transparent opacity={0.2} />
        </mesh>
        <Html center>
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: '10px', color: '#00d4ff', fontFamily: 'monospace', opacity: 0.6 }}>AGENT</div>
            <div style={{ fontSize: '22px', fontWeight: 900, background: 'linear-gradient(135deg, #00d4ff, #7b2fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ID</div>
          </div>
        </Html>
      </group>
    </Float>
  )
}

function ConnectionLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Line>(null!)

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ])
  }, [start, end])

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.15 })
  }, [color])

  useFrame((state) => {
    if (ref.current) {
      ;(ref.current.material as THREE.LineBasicMaterial).opacity = 0.08 + Math.sin(state.clock.elapsedTime * 2) * 0.08
    }
  })

  return <primitive ref={ref} object={new THREE.Line(geometry, material)} />
}

function InnerScene({ agents }: { agents: any[] }) {
  const positions: [number, number, number][] = [
    [-3, 1.5, 0], [3, 1.5, 0], [-3, -1.5, 0], [3, -1.5, 0],
  ]
  const colors = ['#00d4ff', '#7b2fff', '#00ff64', '#ff9500']

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#00d4ff" />
      <pointLight position={[-10, -10, -10]} intensity={0.2} color="#7b2fff" />
      <Stars radius={100} depth={50} count={1000} factor={2} saturation={0} fade speed={0.5} />
      <CentralCore />
      <DataParticles count={300} />
      {agents.slice(0, 4).map((agent, i) => (
        <group key={agent.agent_id || i}>
          <AgentOrb position={positions[i]} color={colors[i]} name={agent.name} />
          <ConnectionLine start={positions[i]} end={[0, 0, 0]} color={colors[i]} />
        </group>
      ))}
    </>
  )
}

export default function Scene3D({ agents }: { agents: any[] }) {
  const [ready, setReady] = useState(false)

  useEffect(() => { setReady(true) }, [])

  if (!ready) {
    return (
      <div className="w-full h-[500px] bg-[#060610] flex items-center justify-center">
        <p className="text-cyan-500/50 font-mono text-sm animate-pulse">Initializing 3D scene...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-[500px] relative">
      <Canvas camera={{ position: [0, 0, 7], fov: 60 }} gl={{ antialias: true, alpha: true }}>
        <InnerScene agents={agents} />
      </Canvas>

      <div className="absolute top-4 left-4 text-[10px] font-mono text-cyan-500/40 space-y-1 pointer-events-none">
        <div>AGENTID NETWORK // v0.1.0</div>
        <div>{agents.length} AGENTS REGISTERED</div>
      </div>
      <div className="absolute top-4 right-4 text-[10px] font-mono text-purple-500/40 text-right space-y-1 pointer-events-none">
        <div>TRUST LAYER // ONLINE</div>
        <div>PROTOCOL ACTIVE</div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-cyan-500/20 tracking-[0.5em] pointer-events-none">
        THE IDENTITY LAYER FOR AI AGENTS
      </div>
    </div>
  )
}
