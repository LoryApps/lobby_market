'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { UserRole } from '@/lib/supabase/types'

/**
 * Shared low-poly material palette matching the Lobby Market theme.
 */
const PALETTE = {
  dirt: '#3a2f24',
  wood: '#6b4423',
  woodDark: '#4a2e16',
  stone: '#5a5a64',
  stoneDark: '#3c3c48',
  roof: '#8b1a1a',
  roofDark: '#5a1010',
  windowGlow: '#ffd97d',
  windowCold: '#60a5fa',
  glass: '#3b82f6',
  gold: '#f59e0b',
  concrete: '#4a4a54',
  metal: '#6a6a78',
  neonBlue: '#3b82f6',
  neonRed: '#ef4444',
}

export interface BuildingProps {
  tier: number
  role?: UserRole
  seed: number
}

export function Building({ tier, seed }: BuildingProps) {
  switch (tier) {
    case 0:
      return <Tent seed={seed} />
    case 1:
      return <WoodenHouse seed={seed} />
    case 2:
      return <StoneCottage seed={seed} />
    case 3:
      return <Townhouse seed={seed} />
    case 4:
      return <OfficeBuilding seed={seed} />
    case 5:
      return <ApartmentTower seed={seed} />
    case 6:
    default:
      return <Skyscraper seed={seed} />
  }
}

/* ------------------------------------------------------------------ */
/* Tier 0 — Tent                                                       */
/* ------------------------------------------------------------------ */
function Tent({ seed }: { seed: number }) {
  return (
    <group rotation-y={seed * Math.PI * 2}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.2, 1.8, 4]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
      {/* Tent entrance */}
      <mesh position={[0, 0.4, 0.7]} rotation-y={Math.PI / 4}>
        <planeGeometry args={[0.6, 0.8]} />
        <meshStandardMaterial color={PALETTE.woodDark} side={THREE.DoubleSide} />
      </mesh>
      {/* Campfire */}
      <Campfire position={[1.6, 0.05, 0]} />
    </group>
  )
}

function Campfire({ position }: { position: [number, number, number] }) {
  const flameRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const flicker = 0.85 + Math.sin(t * 8) * 0.1 + Math.sin(t * 17) * 0.05
    if (flameRef.current) {
      flameRef.current.scale.set(flicker, flicker * 1.2, flicker)
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.2 * flicker
    }
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.1, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh ref={flameRef} position={[0, 0.25, 0]}>
        <coneGeometry args={[0.15, 0.35, 6]} />
        <meshStandardMaterial
          color="#ff9020"
          emissive="#ff6000"
          emissiveIntensity={1.4}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ff8030"
        intensity={1.2}
        distance={6}
        decay={2}
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tier 1 — Wooden House                                               */
/* ------------------------------------------------------------------ */
function WoodenHouse({ seed }: { seed: number }) {
  return (
    <group rotation-y={seed * Math.PI * 0.5}>
      {/* Base */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.5, 2.4]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.8} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.85, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.9, 1.1, 4]} />
        <meshStandardMaterial color={PALETTE.roof} roughness={0.7} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.55, 1.21]}>
        <planeGeometry args={[0.5, 0.9]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Window glow */}
      <GlowingWindow position={[-0.7, 0.9, 1.21]} size={[0.35, 0.35]} />
      <GlowingWindow position={[0.7, 0.9, 1.21]} size={[0.35, 0.35]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tier 2 — Stone Cottage                                              */
/* ------------------------------------------------------------------ */
function StoneCottage({ seed }: { seed: number }) {
  return (
    <group rotation-y={seed * Math.PI * 0.5}>
      {/* Base */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.8, 3]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={0.9} />
      </mesh>
      {/* Stone trim */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.3, 3.2]} />
        <meshStandardMaterial color={PALETTE.stoneDark} roughness={1} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 2.15, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[2.4, 1.3, 4]} />
        <meshStandardMaterial color={PALETTE.roof} roughness={0.7} />
      </mesh>
      {/* Chimney */}
      <mesh position={[1, 2.3, 0.8]} castShadow>
        <boxGeometry args={[0.35, 1.2, 0.35]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.6, 1.51]}>
        <planeGeometry args={[0.6, 1.0]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Windows */}
      <GlowingWindow position={[-0.9, 1.05, 1.51]} size={[0.45, 0.45]} />
      <GlowingWindow position={[0.9, 1.05, 1.51]} size={[0.45, 0.45]} />
      <GlowingWindow position={[-1.51, 1.05, 0]} size={[0.45, 0.45]} rotY={Math.PI / 2} />
      <GlowingWindow position={[1.51, 1.05, 0]} size={[0.45, 0.45]} rotY={Math.PI / 2} />
      {/* Small garden tree */}
      <Tree position={[1.8, 0, 1.8]} scale={0.8} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tier 3 — Two-story Townhouse                                        */
/* ------------------------------------------------------------------ */
function Townhouse({ seed }: { seed: number }) {
  return (
    <group rotation-y={seed * Math.PI * 0.5}>
      {/* Ground floor */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2, 3]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={0.85} />
      </mesh>
      {/* Upper floor */}
      <mesh position={[0, 2.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.6, 3.2]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.8} />
      </mesh>
      {/* Flat roof */}
      <mesh position={[0, 3.75, 0]} castShadow>
        <boxGeometry args={[3.6, 0.3, 3.4]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.8, 1.51]}>
        <planeGeometry args={[0.7, 1.2]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Ground windows */}
      <GlowingWindow position={[-1.1, 1.3, 1.51]} size={[0.5, 0.6]} />
      <GlowingWindow position={[1.1, 1.3, 1.51]} size={[0.5, 0.6]} />
      {/* Upper windows */}
      <GlowingWindow position={[-1, 2.8, 1.61]} size={[0.55, 0.55]} />
      <GlowingWindow position={[0, 2.8, 1.61]} size={[0.55, 0.55]} />
      <GlowingWindow position={[1, 2.8, 1.61]} size={[0.55, 0.55]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tier 4 — Office Building                                            */
/* ------------------------------------------------------------------ */
function OfficeBuilding({ seed }: { seed: number }) {
  return (
    <group rotation-y={seed * Math.PI * 0.5}>
      {/* Base */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.5, 4]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Main tower */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 5.5, 3.4]} />
        <meshStandardMaterial color={PALETTE.concrete} roughness={0.7} />
      </mesh>
      {/* Roof cap */}
      <mesh position={[0, 5.9, 0]} castShadow>
        <boxGeometry args={[3, 0.3, 3]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Window strips — 4 floors x 4 sides */}
      <WindowStrip y={1.2} sides={4} width={3.05} height={0.4} />
      <WindowStrip y={2.3} sides={4} width={3.05} height={0.4} />
      <WindowStrip y={3.4} sides={4} width={3.05} height={0.4} />
      <WindowStrip y={4.5} sides={4} width={3.05} height={0.4} />
      {/* Entrance canopy */}
      <mesh position={[0, 0.9, 1.8]} castShadow>
        <boxGeometry args={[1.4, 0.15, 0.6]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.5} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tier 5 — Apartment Tower                                            */
/* ------------------------------------------------------------------ */
function ApartmentTower({ seed }: { seed: number }) {
  const floors = 8
  return (
    <group rotation-y={seed * Math.PI * 0.5}>
      {/* Plinth */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.8, 4.2]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Main body */}
      <mesh position={[0, 4.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 8, 3.6]} />
        <meshStandardMaterial color={PALETTE.concrete} roughness={0.6} />
      </mesh>
      {/* Crown */}
      <mesh position={[0, 9.1, 0]} castShadow>
        <boxGeometry args={[4, 0.5, 4]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Window strips */}
      {Array.from({ length: floors }).map((_, i) => (
        <WindowStrip
          key={i}
          y={1.4 + i * 0.95}
          sides={4}
          width={3.25}
          height={0.35}
          emissive={i % 2 === 0 ? PALETTE.windowGlow : PALETTE.windowCold}
        />
      ))}
      {/* Antenna */}
      <mesh position={[0, 10.2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.8} />
      </mesh>
      <mesh position={[0, 11.15, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          color="#ff2020"
          emissive="#ff0000"
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tier 6 — Glass Skyscraper                                           */
/* ------------------------------------------------------------------ */
function Skyscraper({ seed }: { seed: number }) {
  const floors = 14
  const edgeRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (edgeRef.current) {
      const mat = edgeRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.8 + Math.sin(t * 1.5) * 0.3
    }
  })
  return (
    <group rotation-y={seed * Math.PI * 0.5}>
      {/* Plinth */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.8, 4.6]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Glass body */}
      <mesh position={[0, 8, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 14, 3.8]} />
        <meshStandardMaterial
          color={PALETTE.glass}
          metalness={0.9}
          roughness={0.15}
          emissive={PALETTE.neonBlue}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Glowing edges — slightly larger wireframe box */}
      <mesh ref={edgeRef} position={[0, 8, 0]}>
        <boxGeometry args={[3.85, 14.05, 3.85]} />
        <meshStandardMaterial
          color="#000"
          emissive={PALETTE.neonBlue}
          emissiveIntensity={0.8}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Window strips */}
      {Array.from({ length: floors }).map((_, i) => (
        <WindowStrip
          key={i}
          y={1.5 + i * 0.95}
          sides={4}
          width={3.5}
          height={0.35}
          emissive={i % 3 === 0 ? PALETTE.neonRed : PALETTE.neonBlue}
          intensity={1.2}
        />
      ))}
      {/* Spire */}
      <mesh position={[0, 15.6, 0]} castShadow>
        <coneGeometry args={[0.3, 1.4, 6]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.9} />
      </mesh>
      <mesh position={[0, 16.5, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color={PALETTE.gold}
          emissive={PALETTE.gold}
          emissiveIntensity={2.5}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export function GlowingWindow({
  position,
  size,
  rotY = 0,
  color = PALETTE.windowGlow,
}: {
  position: [number, number, number]
  size: [number, number]
  rotY?: number
  color?: string
}) {
  return (
    <mesh position={position} rotation-y={rotY}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function WindowStrip({
  y,
  sides,
  width,
  height,
  emissive = PALETTE.windowGlow,
  intensity = 0.9,
}: {
  y: number
  sides: number
  width: number
  height: number
  emissive?: string
  intensity?: number
}) {
  const faces = []
  for (let i = 0; i < sides; i++) {
    const angle = (i * Math.PI * 2) / sides
    const x = Math.sin(angle) * (width / 2 + 0.01)
    const z = Math.cos(angle) * (width / 2 + 0.01)
    faces.push(
      <mesh key={i} position={[x, y, z]} rotation-y={angle}>
        <planeGeometry args={[width * 0.85, height]} />
        <meshStandardMaterial
          color={emissive}
          emissive={emissive}
          emissiveIntensity={intensity}
          side={THREE.DoubleSide}
        />
      </mesh>
    )
  }
  return <>{faces}</>
}

function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number]
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 1.2, 6]} />
        <meshStandardMaterial color="#4a2e16" />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[0.7, 1.4, 6]} />
        <meshStandardMaterial color="#1f5f3f" />
      </mesh>
    </group>
  )
}

export { Tree }
