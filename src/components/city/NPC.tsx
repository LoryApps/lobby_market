'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Profile } from '@/lib/supabase/types'
import { seededScalar } from '@/lib/city/plot-math'

export interface NPCProps {
  user: Profile
  center: [number, number]
  wanderRadius?: number
  onClick?: (user: Profile) => void
  showLabel?: boolean
}

/**
 * A non-player character representing one user. Wanders inside a circular
 * zone around their plot center, picking new random targets when it gets
 * close to the current one. Sprite is chosen from the user's role.
 */
export function NPC({
  user,
  center,
  wanderRadius = 4,
  onClick,
  showLabel = true,
}: NPCProps) {
  const texturePath = useMemo(() => npcTextureForUser(user), [user])
  const fallbackColor = useMemo(() => npcFallbackColor(user), [user])
  const [cx, cz] = center
  const groupRef = useRef<THREE.Group>(null)
  const targetRef = useRef<THREE.Vector2>(
    pickInitialTarget(user.id, cx, cz, wanderRadius)
  )
  const idleUntilRef = useRef<number>(0)
  // A small phase offset so all NPCs don't update their targets in lockstep.
  const phase = useMemo(() => seededScalar(user.id, 'npc-phase') * 5, [user.id])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const now = state.clock.elapsedTime + phase

    const dxGoal = targetRef.current.x - group.position.x
    const dzGoal = targetRef.current.y - group.position.z
    const dist = Math.hypot(dxGoal, dzGoal)

    if (dist < 0.3 || now < idleUntilRef.current) {
      // Close enough — idle briefly then pick a new target.
      if (idleUntilRef.current === 0) {
        idleUntilRef.current = now + 1 + (Math.sin(now * 1.7) * 0.5 + 0.5) * 2
      } else if (now >= idleUntilRef.current) {
        targetRef.current = pickWanderTarget(
          user.id,
          now,
          cx,
          cz,
          wanderRadius
        )
        idleUntilRef.current = 0
      }
    } else {
      const speed = 1.6
      const step = Math.min(dist, speed * delta)
      group.position.x += (dxGoal / dist) * step
      group.position.z += (dzGoal / dist) * step
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick?.(user)
  }

  return (
    <group
      ref={groupRef}
      position={[cx + (seededScalar(user.id, 'npc-ox') - 0.5) * 2, 0, cz + (seededScalar(user.id, 'npc-oz') - 0.5) * 2]}
    >
      <Suspense
        fallback={
          <NPCFallback
            color={fallbackColor}
            onClick={handleClick}
          />
        }
      >
        <NPCSpriteInner texturePath={texturePath} onClick={handleClick} />
      </Suspense>

      {showLabel && (
        <Html
          position={[0, 3.6, 0]}
          center
          distanceFactor={22}
          zIndexRange={[10, 0]}
        >
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-white/10 bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow">
            @{user.username}
          </div>
        </Html>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Sprite inner                                                        */
/* ------------------------------------------------------------------ */
interface NPCSpriteInnerProps {
  texturePath: string
  onClick: (e: ThreeEvent<MouseEvent>) => void
}

function NPCSpriteInner({ texturePath, onClick }: NPCSpriteInnerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useTexture(texturePath) as THREE.Texture
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  }
  const size: [number, number] = [2, 3]

  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const parent = mesh.parent
    if (!parent) return
    mesh.rotation.y = Math.atan2(
      camera.position.x - parent.position.x,
      camera.position.z - parent.position.z
    )
  })

  return (
    <mesh ref={meshRef} position={[0, size[1] / 2, 0]} onClick={onClick}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.35}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Fallback when sprite PNG isn't available                            */
/* ------------------------------------------------------------------ */
function NPCFallback({
  color,
  onClick,
}: {
  color: string
  onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const size: [number, number] = [2, 3]

  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const parent = mesh.parent
    if (!parent) return
    mesh.rotation.y = Math.atan2(
      camera.position.x - parent.position.x,
      camera.position.z - parent.position.z
    )
  })

  return (
    <group onClick={onClick}>
      <mesh ref={meshRef} position={[0, size[1] / 2, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, size[1] * 0.88, 0]}>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function npcTextureForUser(user: Profile): string {
  switch (user.role) {
    case 'elder':
      return '/assets/sprites/npc-elder.png'
    case 'troll_catcher':
      return '/assets/sprites/npc-troll-catcher.png'
    case 'debator':
      return '/assets/sprites/npc-debator.png'
    default:
      if (user.is_influencer) return '/assets/sprites/npc-influencer.png'
      return '/assets/sprites/npc-person.png'
  }
}

function npcFallbackColor(user: Profile): string {
  switch (user.role) {
    case 'elder':
      return '#f59e0b'
    case 'troll_catcher':
      return '#3b82f6'
    case 'debator':
      return '#8b5cf6'
    default:
      return user.is_influencer ? '#fde68a' : '#94a3b8'
  }
}

function pickInitialTarget(
  userId: string,
  cx: number,
  cz: number,
  radius: number
): THREE.Vector2 {
  const a = seededScalar(userId, 'npc-init-a') * Math.PI * 2
  const r = seededScalar(userId, 'npc-init-r') * radius
  return new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r)
}

function pickWanderTarget(
  userId: string,
  now: number,
  cx: number,
  cz: number,
  radius: number
): THREE.Vector2 {
  const seed = userId + ':' + Math.floor(now * 3)
  const a = seededScalar(seed, 'npc-wander-a') * Math.PI * 2
  const r = 0.8 + seededScalar(seed, 'npc-wander-r') * radius
  return new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r)
}
