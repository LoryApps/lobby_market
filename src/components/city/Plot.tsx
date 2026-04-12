'use client'

import { useMemo, useRef, useState } from 'react'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Profile } from '@/lib/supabase/types'
import {
  buildingTier,
  plotPosition,
  seededScalar,
  tierName,
} from '@/lib/city/plot-math'
import { Building, Tree } from './Building'

export interface PlotProps {
  user: Profile
  isFocused?: boolean
  isSelected?: boolean
  onSelect?: (user: Profile) => void
  /** If true, render a simple colored stub instead of the full building (used for LOD). */
  simplified?: boolean
}

/**
 * A single user's plot of land in The Lobby city.
 */
export function Plot({
  user,
  isFocused = false,
  isSelected = false,
  onSelect,
  simplified = false,
}: PlotProps) {
  const [x, z] = useMemo(() => plotPosition(user.id), [user.id])
  const tier = useMemo(() => buildingTier(user.reputation_score), [user.reputation_score])
  const seed = useMemo(() => seededScalar(user.id, 'rot'), [user.id])
  const cloutFlair = useMemo(() => Math.min(4, Math.floor((user.clout ?? 0) / 250)), [user.clout])
  const [hovered, setHovered] = useState(false)

  return (
    <group position={[x, 0, z]}>
      <PlotGround
        tier={tier}
        highlighted={isFocused || isSelected}
        hovered={hovered}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(user)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      />

      {simplified ? (
        <LODStub tier={tier} />
      ) : (
        <>
          <Building tier={tier} role={user.role} seed={seed} />

          {/* Role decorations */}
          {user.role === 'debator' && <Podium />}
          {user.role === 'troll_catcher' && <GuardTower />}
          {user.role === 'elder' && <GoldenStatue />}

          {/* Influencer aura */}
          {user.is_influencer && <InfluencerAura />}

          {/* Clout flourishes: up to 4 trees based on clout balance */}
          {Array.from({ length: cloutFlair }).map((_, i) => {
            const a = (i / 4) * Math.PI * 2 + seed * 2
            const r = 3.5
            return (
              <Tree
                key={i}
                position={[Math.cos(a) * r, 0, Math.sin(a) * r]}
                scale={0.7 + seededScalar(user.id, 'tree' + i) * 0.4}
              />
            )
          })}

          {/* Username label when hovered or focused */}
          {(hovered || isFocused || isSelected) && (
            <Html position={[0, heightForTier(tier) + 2.2, 0]} center distanceFactor={18}>
              <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-white/10 bg-black/80 px-2 py-1 text-xs text-white shadow-lg">
                <div className="font-semibold">
                  {user.display_name ?? user.username}
                </div>
                <div className="text-[10px] text-white/60">
                  @{user.username} · {tierName(tier)}
                </div>
              </div>
            </Html>
          )}
        </>
      )}

      {/* Selection ring */}
      {(isFocused || isSelected) && <SelectionRing />}
    </group>
  )
}

function heightForTier(tier: number): number {
  // Rough height used only for placing the username label above the roof.
  switch (tier) {
    case 0:
      return 2
    case 1:
      return 3
    case 2:
      return 3.5
    case 3:
      return 4.5
    case 4:
      return 6.5
    case 5:
      return 11.5
    case 6:
    default:
      return 17
  }
}

/* ------------------------------------------------------------------ */
/* Ground plot slab                                                    */
/* ------------------------------------------------------------------ */
function PlotGround({
  tier,
  highlighted,
  hovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  tier: number
  highlighted: boolean
  hovered: boolean
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void
}) {
  const color = tier === 0 ? '#3a2f24' : tier < 3 ? '#2a3040' : '#1d2436'
  const edgeColor = highlighted ? '#fbbf24' : hovered ? '#60a5fa' : '#0c0f1a'
  return (
    <group
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Slab */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[8, 0.1, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {/* Edge trim */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[8.2, 0.05, 8.2]} />
        <meshStandardMaterial
          color={edgeColor}
          emissive={highlighted || hovered ? edgeColor : '#000'}
          emissiveIntensity={highlighted ? 1.2 : hovered ? 0.6 : 0}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Role decorations                                                    */
/* ------------------------------------------------------------------ */

function Podium() {
  return (
    <group position={[-2.8, 0, 2.8]}>
      {/* Base */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.2, 0.4, 0.8]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Podium */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.4]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
      {/* Microphone stand */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
        <meshStandardMaterial color="#333" metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.32, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#333" metalness={0.8} />
      </mesh>
    </group>
  )
}

function GuardTower() {
  const flagRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (flagRef.current) {
      const t = state.clock.getElapsedTime()
      flagRef.current.rotation.z = Math.sin(t * 2) * 0.1
    }
  })
  return (
    <group position={[2.8, 0, 2.8]}>
      {/* Tower base */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 1.5, 6]} />
        <meshStandardMaterial color="#4a4a54" />
      </mesh>
      {/* Observation deck */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.45, 0.3, 6]} />
        <meshStandardMaterial color="#3b3b44" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <coneGeometry args={[0.55, 0.4, 6]} />
        <meshStandardMaterial color="#5a1010" />
      </mesh>
      {/* Shield banner */}
      <mesh ref={flagRef} position={[0, 1.2, 0.45]}>
        <planeGeometry args={[0.5, 0.6]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function GoldenStatue() {
  const lightRef = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    if (lightRef.current) {
      const t = state.clock.getElapsedTime()
      lightRef.current.intensity = 1.6 + Math.sin(t) * 0.3
    }
  })
  return (
    <group position={[0, 0, -2.8]}>
      {/* Pedestal */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.9]} />
        <meshStandardMaterial color="#2a2a34" />
      </mesh>
      {/* Statue body */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.8, 8]} />
        <meshStandardMaterial
          color="#f59e0b"
          metalness={0.85}
          roughness={0.25}
          emissive="#f59e0b"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#f59e0b"
          metalness={0.9}
          roughness={0.2}
          emissive="#f59e0b"
          emissiveIntensity={0.5}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ffb050"
        intensity={1.6}
        distance={8}
        decay={2}
        position={[0, 1.5, 0]}
      />
    </group>
  )
}

function InfluencerAura() {
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.getElapsedTime()
      ringRef.current.rotation.y = t * 0.5
      ringRef.current.position.y = 0.2 + Math.sin(t * 1.5) * 0.15
    }
  })
  return (
    <group>
      <mesh ref={ringRef} position={[0, 0.2, 0]} rotation-x={Math.PI / 2}>
        <ringGeometry args={[3.6, 3.9, 32]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={1.5}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        color="#ffb050"
        intensity={1.2}
        distance={14}
        position={[0, 2, 0]}
      />
    </group>
  )
}

function SelectionRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime()
      ref.current.rotation.z = t * 1.2
      const s = 1 + Math.sin(t * 3) * 0.05
      ref.current.scale.set(s, s, 1)
    }
  })
  return (
    <mesh ref={ref} position={[0, 0.18, 0]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[4.1, 4.35, 32]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#fbbf24"
        emissiveIntensity={2}
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* LOD stub                                                            */
/* ------------------------------------------------------------------ */
function LODStub({ tier }: { tier: number }) {
  const color =
    tier >= 6
      ? '#3b82f6'
      : tier >= 5
        ? '#60a5fa'
        : tier >= 4
          ? '#8b8b98'
          : tier >= 3
            ? '#5a4a3a'
            : tier >= 2
              ? '#5a5a64'
              : tier >= 1
                ? '#6b4423'
                : '#3a2f24'
  const height = [1.8, 2.4, 3, 3.8, 5.5, 9, 14][Math.min(6, tier)]
  return (
    <mesh position={[0, height / 2, 0]} castShadow>
      <boxGeometry args={[2.5, height, 2.5]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
