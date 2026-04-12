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
import { plotPosition } from '@/lib/city/plot-math'
import { Ground } from './Ground'
import { Plot } from './Plot'
import { HUD } from './HUD'

export interface CityViewProps {
  users: Profile[]
  currentUser: Profile | null
  focusUsername?: string
}

/**
 * Root 3D scene + overlay HUD for The Lobby.
 * Mounted client-side only (see dynamic import in the page).
 */
export function CityView({ users, currentUser, focusUsername }: CityViewProps) {
  const [selected, setSelected] = useState<Profile | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const focusedUser = useMemo(
    () =>
      focusUsername ? users.find((u) => u.username === focusUsername) ?? null : null,
    [users, focusUsername]
  )

  const focusTarget = useMemo<[number, number, number] | null>(() => {
    if (!focusedUser) return null
    const [x, z] = plotPosition(focusedUser.id)
    return [x, 0, z]
  }, [focusedUser])

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
            focusTarget={focusTarget}
            selected={selected}
            focusedUserId={focusedUser?.id ?? null}
            currentUserId={currentUser?.id ?? null}
            onSelect={handleSelect}
          />
        </Suspense>
      </Canvas>

      <HUD
        currentUser={currentUser}
        selectedUser={selected}
        onClearSelection={handleClearSelection}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scene — everything inside the <Canvas>                              */
/* ------------------------------------------------------------------ */

interface SceneProps {
  users: Profile[]
  focusTarget: [number, number, number] | null
  selected: Profile | null
  focusedUserId: string | null
  currentUserId: string | null
  onSelect: (u: Profile) => void
}

function Scene({
  users,
  focusTarget,
  selected,
  focusedUserId,
  currentUserId,
  onSelect,
}: SceneProps) {
  return (
    <>
      {/* Camera rig */}
      <PerspectiveCamera makeDefault position={[40, 40, 40]} fov={55} />
      <CameraRig target={focusTarget} />

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={Math.PI / 6}
        minDistance={8}
        maxDistance={220}
        makeDefault
      />

      {/* Atmosphere */}
      <color attach="background" args={['#05060d']} />
      <fog attach="fog" args={['#05060d', 80, 260]} />

      {/* Lights */}
      <ambientLight intensity={0.35} color="#8ea0c0" />
      <hemisphereLight args={['#6080c0', '#201030', 0.5]} />
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

/* ------------------------------------------------------------------ */
/* Camera rig — ease toward a focus point once on mount                */
/* ------------------------------------------------------------------ */
function CameraRig({ target }: { target: [number, number, number] | null }) {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera
    controls: { target: THREE.Vector3; update: () => void } | null
  }
  const doneRef = useRef(false)

  useFrame(() => {
    if (doneRef.current || !target || !controls) return
    const desired = new THREE.Vector3(target[0], 8, target[2])
    const desiredCam = new THREE.Vector3(target[0] + 18, 18, target[2] + 18)
    controls.target.lerp(desired, 0.05)
    camera.position.lerp(desiredCam, 0.05)
    controls.update()
    if (camera.position.distanceTo(desiredCam) < 0.5) {
      doneRef.current = true
    }
  })

  return null
}

export default CityView
