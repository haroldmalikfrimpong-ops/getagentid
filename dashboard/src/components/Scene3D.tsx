'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Text, MeshDistortMaterial, Stars, Trail } from '@react-three/drei'
import * as THREE from 'three'

function DataParticles({ count = 200 }) {
  const mesh = useRef<THREE.Points>(null!)
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return pos
  }, [count])

  const colors = useMemo(() => {
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = Math.random()
      if (r < 0.33) { col[i*3] = 0; col[i*3+1] = 0.83; col[i*3+2] = 1 }       // cyan
      else if (r < 0.66) { col[i*3] = 0.48; col[i*3+1] = 0.18; col[i*3+2] = 1 } // purple
      else { col[i*3] = 0; col[i*3+1] = 1; col[i*3+2] = 0.39 }                   // green
    }
    return col
  }, [count])

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.02
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1
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

function HolographicOrb({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
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
          <MeshDistortMaterial
            color={color}
            wireframe
            transparent
            opacity={0.3}
            distort={0.2}
            speed={3}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} />
        </mesh>
        <Text
          position={[0, -0.8, 0]}
          fontSize={0.12}
          color={color}
          anchorX="center"
          anchorY="middle"
          font="/fonts/mono.woff"
        >
          {label}
        </Text>
      </group>
    </Float>
  )
}

function ConnectionBeam({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const ref = useRef<any>(null!)

  useFrame((state) => {
    if (ref.current?.material) {
      ref.current.material.opacity = 0.1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
    }
  })

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ])
    return geo
  }, [start, end])

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })
  }, [color])

  return <primitive ref={ref} object={new THREE.Line(geometry, material)} />
}

function CentralCore() {
  const mesh = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.5
      mesh.current.rotation.z = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <Float speed={1.5} floatIntensity={0.5}>
      <group>
        <mesh ref={mesh}>
          <torusGeometry args={[1.2, 0.02, 16, 100]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.02, 16, 100]} />
          <meshBasicMaterial color="#7b2fff" transparent opacity={0.2} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.8, 0.02, 16, 100]} />
          <meshBasicMaterial color="#00ff64" transparent opacity={0.2} />
        </mesh>
        <Text
          position={[0, 0, 0]}
          fontSize={0.25}
          color="#00d4ff"
          anchorX="center"
          anchorY="middle"
        >
          AgentID
        </Text>
      </group>
    </Float>
  )
}

export default function Scene3D({ agents }: { agents: any[] }) {
  const agentPositions: [number, number, number][] = [
    [-3, 1.5, 0],
    [3, 1.5, 0],
    [-3, -1.5, 0],
    [3, -1.5, 0],
  ]

  const agentColors = ['#00d4ff', '#7b2fff', '#00ff64', '#ff9500']

  return (
    <div className="w-full h-[500px] relative">
      <Canvas camera={{ position: [0, 0, 7], fov: 60 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[10, 10, 10]} intensity={0.3} color="#00d4ff" />
        <pointLight position={[-10, -10, -10]} intensity={0.2} color="#7b2fff" />

        <Stars radius={100} depth={50} count={1000} factor={2} saturation={0} fade speed={0.5} />

        <CentralCore />
        <DataParticles count={300} />

        {agents.slice(0, 4).map((agent, i) => (
          <group key={agent.agent_id}>
            <HolographicOrb
              position={agentPositions[i]}
              color={agentColors[i]}
              label={agent.name}
            />
            <ConnectionBeam
              start={agentPositions[i]}
              end={[0, 0, 0]}
              color={agentColors[i]}
            />
          </group>
        ))}
      </Canvas>

      {/* Overlay HUD */}
      <div className="absolute top-4 left-4 text-xs font-mono text-cyan-500/50">
        <div>AGENTID NETWORK // ACTIVE</div>
        <div>{agents.length} AGENTS REGISTERED</div>
      </div>
      <div className="absolute top-4 right-4 text-xs font-mono text-purple-500/50">
        <div>PROTOCOL v0.1.0</div>
        <div>TRUST LAYER // ONLINE</div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono text-cyan-500/30">
        THE IDENTITY LAYER FOR AI AGENTS
      </div>
    </div>
  )
}
