'use client'

import { Suspense, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

export interface Obstacle {
  x: number
  z: number
  radius: number
}

export interface PlayerCharacterProps {
  initialPosition?: [number, number, number]
  speed?: number
  obstacles?: Obstacle[]
  onPositionChange?: (pos: THREE.Vector3) => void
  /** Controls are disabled when the user is interacting with form elements etc. */
  disabled?: boolean
}

export interface PlayerCharacterHandle {
  group: THREE.Group | null
}

/**
 * Controllable player character. Uses a billboard sprite that swaps textures
 * every ~0.2s while moving. WASD / arrow keys move the character on the XZ
 * plane. Circular collision against an obstacles list prevents walking through
 * buildings.
 */
export const PlayerCharacter = forwardRef<
  PlayerCharacterHandle,
  PlayerCharacterProps
>(function PlayerCharacter(
  {
    initialPosition = [0, 0, 0],
    speed = 6,
    obstacles,
    onPositionChange,
    disabled = false,
  },
  ref
) {
  const groupRef = useRef<THREE.Group>(null)

  useImperativeHandle(ref, () => ({
    get group() {
      return groupRef.current
    },
  }))

  // Ensure the ref's position matches the initialPosition on mount.
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        initialPosition[0],
        initialPosition[1],
        initialPosition[2]
      )
      onPositionChange?.(groupRef.current.position)
    }
    // Only run on mount (or when the initialPosition identity changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition[0], initialPosition[1], initialPosition[2]])

  return (
    <group ref={groupRef} position={initialPosition}>
      <Suspense fallback={<PlayerFallbackSprite />}>
        <PlayerSpriteInner />
      </Suspense>
      <PlayerController
        groupRef={groupRef}
        speed={speed}
        obstacles={obstacles}
        onPositionChange={onPositionChange}
        disabled={disabled}
      />
    </group>
  )
})

/* ------------------------------------------------------------------ */
/* Controller — keyboard input + per-frame physics update              */
/* ------------------------------------------------------------------ */
interface PlayerControllerProps {
  groupRef: React.RefObject<THREE.Group | null>
  speed: number
  obstacles?: Obstacle[]
  onPositionChange?: (pos: THREE.Vector3) => void
  disabled: boolean
}

function PlayerController({
  groupRef,
  speed,
  obstacles,
  onPositionChange,
  disabled,
}: PlayerControllerProps) {
  const keysRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing into form controls
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      keysRef.current[e.key.toLowerCase()] = true
    }
    const onUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false
    }
    const onBlur = () => {
      keysRef.current = {}
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group || disabled) return

    const k = keysRef.current
    const dx =
      (k['d'] || k['arrowright'] ? 1 : 0) -
      (k['a'] || k['arrowleft'] ? 1 : 0)
    const dz =
      (k['s'] || k['arrowdown'] ? 1 : 0) -
      (k['w'] || k['arrowup'] ? 1 : 0)

    if (dx === 0 && dz === 0) {
      // Still fire a position change so listeners can rely on a steady sample.
      // Skipping this avoids needless re-renders, so do nothing.
      return
    }

    const len = Math.hypot(dx, dz)
    const step = speed * delta
    const moveX = (dx / len) * step
    const moveZ = (dz / len) * step

    // Axis-separated collision: try X first, then Z. This lets the player
    // slide along walls instead of sticking.
    const pos = group.position
    const candidate = new THREE.Vector2(pos.x + moveX, pos.z)
    if (!isBlocked(candidate.x, candidate.y, obstacles)) {
      pos.x = candidate.x
    }
    candidate.set(pos.x, pos.z + moveZ)
    if (!isBlocked(candidate.x, candidate.y, obstacles)) {
      pos.z = candidate.y
    }

    // Clamp to world bounds (ground plane is 800 wide; keep a margin).
    const bound = 380
    if (pos.x > bound) pos.x = bound
    if (pos.x < -bound) pos.x = -bound
    if (pos.z > bound) pos.z = bound
    if (pos.z < -bound) pos.z = -bound

    onPositionChange?.(pos)
  })

  return null
}

function isBlocked(x: number, z: number, obstacles?: Obstacle[]): boolean {
  if (!obstacles || obstacles.length === 0) return false
  // Player body radius
  const PLAYER_R = 0.45
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    const dx = x - o.x
    const dz = z - o.z
    const r = o.radius + PLAYER_R
    if (dx * dx + dz * dz < r * r) return true
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Sprite — attempts to load the three animation frames                */
/* ------------------------------------------------------------------ */
function PlayerSpriteInner() {
  const textures = useTexture([
    '/assets/sprites/player-idle.png',
    '/assets/sprites/player-walk-1.png',
    '/assets/sprites/player-walk-2.png',
  ]) as THREE.Texture[]

  const [idleTex, walk1Tex, walk2Tex] = textures
  ;[idleTex, walk1Tex, walk2Tex].forEach((t) => {
    if (!t) return
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
  })

  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const [size] = useState<[number, number]>([2.2, 3.2])

  useFrame((state) => {
    const mesh = meshRef.current
    const mat = materialRef.current
    if (!mesh || !mat) return
    const parent = mesh.parent
    if (!parent) return

    // Billboard (Y axis only)
    mesh.rotation.y = Math.atan2(
      state.camera.position.x - parent.position.x,
      state.camera.position.z - parent.position.z
    )

    // Walk animation — swap textures every ~0.18s while moving
    const t = state.clock.elapsedTime
    const frame = Math.floor(t * 5) % 3
    const next = frame === 0 ? idleTex : frame === 1 ? walk1Tex : walk2Tex
    if (next && mat.map !== next) {
      mat.map = next
      mat.needsUpdate = true
    }
  })

  return (
    <mesh ref={meshRef} position={[0, size[1] / 2, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        ref={materialRef}
        map={idleTex}
        transparent
        alphaTest={0.35}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Fallback sprite — shown while textures load or if they fail         */
/* ------------------------------------------------------------------ */
function PlayerFallbackSprite() {
  const meshRef = useRef<THREE.Mesh>(null)
  const size: [number, number] = [2.2, 3.2]

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
    <group>
      <mesh ref={meshRef} position={[0, size[1] / 2, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, size[1] * 0.88, 0]}>
        <sphereGeometry args={[0.38, 12, 12]} />
        <meshBasicMaterial color="#fde68a" toneMapped={false} />
      </mesh>
    </group>
  )
}
