'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  PerspectiveCamera,
  Sky,
  Stars,
} from '@react-three/drei'
import * as THREE from 'three'
import type { Profile } from '@/lib/supabase/types'
import { buildingTier, plotPosition } from '@/lib/city/plot-math'
import { Ground } from './Ground'
import { Plot } from './Plot'
import { HUD } from './HUD'
import {
  PlayerCharacter,
  type PlayerCharacterHandle,
  type Obstacle,
} from './PlayerCharacter'
import { NPC } from './NPC'
import { FollowCamera } from './FollowCamera'
import { InteractionPrompt } from './InteractionPrompt'
import { PropPlacement } from './PropPlacement'

export interface CityViewProps {
  users: Profile[]
  currentUser: Profile | null
  focusUsername?: string
}

type CameraMode = 'follow' | 'orbit'

/**
 * Root 3D scene + overlay HUD for The Lobby.
 * Mounted client-side only (see dynamic import in the page).
 */
export function CityView({ users, currentUser, focusUsername }: CityViewProps) {
  const [selected, setSelected] = useState<Profile | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow')
  const [playerPosition, setPlayerPosition] = useState<{
    x: number
    z: number
  } | null>(null)
  const [nearbyPlot, setNearbyPlot] = useState<Profile | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerCharacterHandle | null>(null)
  const positionSampleRef = useRef(0)

  const focusedUser = useMemo(
    () =>
      focusUsername
        ? users.find((u) => u.username === focusUsername) ?? null
        : null,
    [users, focusUsername]
  )

  // Build an obstacles list for player collision: one circle per plot
  // centered on the building and sized to its footprint.
  const obstacles = useMemo<Obstacle[]>(() => {
    const list: Obstacle[] = []
    for (const u of users) {
      const [x, z] = plotPosition(u.id)
      const tier = buildingTier(u.reputation_score)
      const radius = obstacleRadiusForTier(tier)
      list.push({ x, z, radius })
    }
    return list
  }, [users])

  // The player spawns at the focused user's plot, else the current user's
  // plot, else origin.
  const initialPosition = useMemo<[number, number, number]>(() => {
    const anchor = focusedUser ?? currentUser
    if (!anchor) return [0, 0, 0]
    const [x, z] = plotPosition(anchor.id)
    // Spawn just off the south edge of their plot so they don't inter-sect
    // the building at t=0.
    return [x, 0, z + 6]
  }, [focusedUser, currentUser])

  const handleSelect = useCallback((u: Profile) => {
    setSelected(u)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelected(null)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }, [])

  // Sync fullscreen state with the actual API in case the user exits via Esc
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Global key handler: O toggles camera mode, E opens nearest plot profile.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'o') {
        setCameraMode((m) => (m === 'follow' ? 'orbit' : 'follow'))
      } else if (key === 'e') {
        if (nearbyPlot) {
          setSelected(nearbyPlot)
        }
      } else if (key === 'escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nearbyPlot])

  // Position-change callback from the player. This is called every frame while
  // moving so we throttle state updates to ~10Hz to avoid re-rendering React
  // on every three.js frame.
  const handlePlayerMove = useCallback(
    (pos: THREE.Vector3) => {
      positionSampleRef.current += 1
      if (positionSampleRef.current % 6 !== 0) return
      setPlayerPosition({ x: pos.x, z: pos.z })

      // Find the nearest plot and, if within interaction range, flag it.
      let bestUser: Profile | null = null
      let bestDist = Infinity
      for (const u of users) {
        const [px, pz] = plotPosition(u.id)
        const dx = px - pos.x
        const dz = pz - pos.z
        const d = Math.hypot(dx, dz)
        if (d < bestDist) {
          bestDist = d
          bestUser = u
        }
      }
      if (bestUser && bestDist < 6) {
        setNearbyPlot((prev) => (prev?.id === bestUser!.id ? prev : bestUser))
      } else {
        setNearbyPlot((prev) => (prev ? null : prev))
      }
    },
    [users]
  )

  // When focus changes, set it as the "selected" so the HUD shows its details.
  useEffect(() => {
    if (focusedUser) setSelected(focusedUser)
  }, [focusedUser])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 h-screen w-screen overflow-hidden bg-black"
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={handleClearSelection}
      >
        <Suspense fallback={null}>
          <Scene
            users={users}
            selected={selected}
            focusedUserId={focusedUser?.id ?? null}
            currentUserId={currentUser?.id ?? null}
            onSelect={handleSelect}
            playerRef={playerRef}
            initialPosition={initialPosition}
            obstacles={obstacles}
            onPlayerMove={handlePlayerMove}
            cameraMode={cameraMode}
            nearbyPlot={nearbyPlot}
          />
        </Suspense>
      </Canvas>

      <HUD
        currentUser={currentUser}
        selectedUser={selected}
        onClearSelection={handleClearSelection}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        users={users}
        playerPosition={playerPosition}
        cameraMode={cameraMode}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scene — everything inside the <Canvas>                              */
/* ------------------------------------------------------------------ */

interface SceneProps {
  users: Profile[]
  selected: Profile | null
  focusedUserId: string | null
  currentUserId: string | null
  onSelect: (u: Profile) => void
  playerRef: React.MutableRefObject<PlayerCharacterHandle | null>
  initialPosition: [number, number, number]
  obstacles: Obstacle[]
  onPlayerMove: (pos: THREE.Vector3) => void
  cameraMode: CameraMode
  nearbyPlot: Profile | null
}

function Scene({
  users,
  selected,
  focusedUserId,
  currentUserId,
  onSelect,
  playerRef,
  initialPosition,
  obstacles,
  onPlayerMove,
  cameraMode,
  nearbyPlot,
}: SceneProps) {
  const playerTargetRef = useRef<THREE.Object3D | null>(null)

  // Keep playerTargetRef in sync with the player group so FollowCamera can
  // consume a stable object reference.
  useFrame(() => {
    const group = playerRef.current?.group ?? null
    if (playerTargetRef.current !== group) {
      playerTargetRef.current = group
    }
  })

  return (
    <>
      {/* Camera rig */}
      <PerspectiveCamera
        makeDefault
        position={[
          initialPosition[0],
          initialPosition[1] + 11,
          initialPosition[2] + 14,
        ]}
        fov={55}
      />

      {/* Follow camera — active only in follow mode */}
      <FollowCamera
        target={playerTargetRef}
        disabled={cameraMode !== 'follow'}
      />

      {/* Orbit controls — only active in orbit mode */}
      {cameraMode === 'orbit' && (
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 6}
          minDistance={8}
          maxDistance={220}
          makeDefault
        />
      )}

      {/* Atmosphere */}
      <color attach="background" args={['#05060d']} />
      <fog attach="fog" args={['#05060d', 80, 260]} />

      {/* Lights */}
      <ambientLight intensity={0.45} color="#8ea0c0" />
      <hemisphereLight args={['#6080c0', '#201030', 0.55]} />
      <directionalLight
        position={[40, 60, 30]}
        intensity={1.1}
        color="#cfd8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
      />

      {/* Sky — dusk */}
      <Sky
        sunPosition={[-20, 2, -30]}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.008}
        mieDirectionalG={0.85}
        inclination={0.52}
      />
      <Stars radius={300} depth={50} count={2000} factor={4} fade speed={0.5} />

      {/* Ground */}
      <Ground />

      {/* Plots */}
      <PlotsLOD
        users={users}
        selected={selected}
        focusedUserId={focusedUserId}
        currentUserId={currentUserId}
        onSelect={onSelect}
      />

      {/* Props scattered around plots */}
      <PropPlacement users={users} />

      {/* NPCs — one per user, excluding the player's own profile */}
      <NPCs
        users={users}
        onSelect={onSelect}
        excludeUserId={currentUserId}
      />

      {/* Player character */}
      <PlayerCharacter
        ref={playerRef as React.RefObject<PlayerCharacterHandle>}
        initialPosition={initialPosition}
        obstacles={obstacles}
        onPositionChange={onPlayerMove}
      />

      {/* Floating "Press E" prompt when near a plot */}
      {nearbyPlot && <NearbyPrompt user={nearbyPlot} />}
    </>
  )
}

function NearbyPrompt({ user }: { user: Profile }) {
  const pos = useMemo<[number, number, number]>(() => {
    const [x, z] = plotPosition(user.id)
    return [x, 4.5, z]
  }, [user.id])
  return <InteractionPrompt position={pos} user={user} />
}

/* ------------------------------------------------------------------ */
/* NPC spawner — cuts NPCs beyond a certain distance for perf          */
/* ------------------------------------------------------------------ */
function NPCs({
  users,
  onSelect,
  excludeUserId,
}: {
  users: Profile[]
  onSelect: (u: Profile) => void
  excludeUserId: string | null
}) {
  const { camera } = useThree()
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const tickRef = useRef(0)

  // Recompute NPC visibility every ~0.5s
  useFrame(() => {
    tickRef.current += 1
    if (tickRef.current % 30 !== 0) return
    const next = new Set<string>()
    for (const u of users) {
      if (u.id === excludeUserId) continue
      const [x, z] = plotPosition(u.id)
      const dx = camera.position.x - x
      const dz = camera.position.z - z
      const dist = Math.hypot(dx, dz)
      if (dist < 80) next.add(u.id)
    }
    let changed = next.size !== visibleIds.size
    if (!changed) {
      next.forEach((id) => {
        if (!visibleIds.has(id)) changed = true
      })
    }
    if (changed) setVisibleIds(next)
  })

  return (
    <>
      {users.map((u) => {
        if (u.id === excludeUserId) return null
        if (!visibleIds.has(u.id)) return null
        const [x, z] = plotPosition(u.id)
        return (
          <NPC
            key={u.id}
            user={u}
            center={[x, z]}
            wanderRadius={3.2}
            onClick={onSelect}
          />
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Plot LOD — swap distant plots to simplified stubs every frame       */
/* ------------------------------------------------------------------ */
function PlotsLOD({
  users,
  selected,
  focusedUserId,
  currentUserId,
  onSelect,
}: {
  users: Profile[]
  selected: Profile | null
  focusedUserId: string | null
  currentUserId: string | null
  onSelect: (u: Profile) => void
}) {
  const { camera } = useThree()
  const [simplifiedIds, setSimplifiedIds] = useState<Set<string>>(new Set())
  const tickRef = useRef(0)

  // Recompute LOD buckets every ~0.5s for perf; avoid per-frame re-renders.
  useFrame(() => {
    tickRef.current += 1
    if (tickRef.current % 30 !== 0) return
    const next = new Set<string>()
    users.forEach((u) => {
      const [x, z] = plotPosition(u.id)
      const dx = camera.position.x - x
      const dz = camera.position.z - z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > 110) next.add(u.id)
    })
    // Shallow diff to avoid unnecessary state updates
    let changed = next.size !== simplifiedIds.size
    if (!changed) {
      next.forEach((id) => {
        if (!simplifiedIds.has(id)) changed = true
      })
    }
    if (changed) {
      setSimplifiedIds(next)
    }
  })

  return (
    <>
      {users.map((user) => (
        <Plot
          key={user.id}
          user={user}
          isFocused={user.id === focusedUserId || user.id === currentUserId}
          isSelected={selected?.id === user.id}
          onSelect={onSelect}
          simplified={simplifiedIds.has(user.id)}
        />
      ))}
    </>
  )
}

/** Approximate building footprint radius by tier (used for collision). */
function obstacleRadiusForTier(tier: number): number {
  switch (tier) {
    case 0:
      return 1.4
    case 1:
      return 1.7
    case 2:
    case 3:
      return 2.2
    case 4:
      return 2.6
    case 5:
      return 2.8
    case 6:
    default:
      return 3.0
  }
}

export default CityView
