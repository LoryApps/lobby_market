'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { ArrowLeft, Box, Grid3x3, Pause, Play, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { buildHeartMesh, type HeartMeshData } from '@/lib/heart/heart-surface'

const RESOLUTIONS = [48, 96, 160] as const
type Resolution = (typeof RESOLUTIONS)[number]

const RESOLUTION_LABEL: Record<Resolution, string> = {
  48: 'Draft',
  96: 'Fine',
  160: 'Ultra',
}

// ─── Geometry → three.js BufferGeometry ─────────────────────────────────────

function toBufferGeometry(mesh: HeartMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}

// ─── The heart mesh ─────────────────────────────────────────────────────────

interface HeartMeshProps {
  geometry: THREE.BufferGeometry
  wireframe: boolean
  spinning: boolean
  beating: boolean
}

function HeartMesh({ geometry, wireframe, spinning, beating }: HeartMeshProps) {
  const group = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    if (spinning) g.rotation.y += delta * 0.45
    if (beating) {
      // Two-pulse heartbeat, ~64 bpm: a strong contraction then a soft one.
      const t = (state.clock.elapsedTime % (60 / 64)) / (60 / 64)
      const pulse =
        Math.exp(-Math.pow((t - 0.08) / 0.05, 2)) * 0.06 +
        Math.exp(-Math.pow((t - 0.28) / 0.07, 2)) * 0.03
      const s = 1 + pulse
      g.scale.set(s, s, s)
    } else {
      g.scale.set(1, 1, 1)
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#c8102e"
          roughness={0.32}
          metalness={0.05}
          clearcoat={0.9}
          clearcoatRoughness={0.25}
          sheen={0.4}
          sheenColor="#ff6b81"
          wireframe={wireframe}
          side={THREE.FrontSide}
        />
      </mesh>
      {wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#1a0508" side={THREE.FrontSide} />
        </mesh>
      )}
    </group>
  )
}

// ─── Scene ──────────────────────────────────────────────────────────────────

interface HeartSceneProps extends HeartMeshProps {
  autoRotateCamera: boolean
}

/**
 * Frames the whole heart at any aspect ratio: on portrait screens the
 * camera backs off so the tip and lobes both stay in view.
 */
function ResponsiveCamera() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const distance = aspect >= 1 ? 5 : Math.min(11, 5 * (1.15 / aspect))
    camera.position.set(0, 0.35, distance)
    camera.lookAt(0, 0.1, 0)
  }, [camera, size.width, size.height])
  return null
}

function HeartScene({ autoRotateCamera, ...meshProps }: HeartSceneProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.35, 5]} fov={38} />
      <ResponsiveCamera />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.2}
        maxDistance={12}
        autoRotate={autoRotateCamera}
        autoRotateSpeed={0.6}
        target={[0, 0.1, 0]}
      />
      <color attach="background" args={['#07070b']} />
      <fog attach="fog" args={['#07070b', 12, 26]} />

      <hemisphereLight args={['#ffe6ea', '#12060a', 0.55]} />
      <directionalLight
        position={[3.5, 5, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#7aa2ff" />
      <pointLight position={[0, -1, 3]} intensity={1.1} color="#ff8fa3" distance={8} />

      <HeartMesh {...meshProps} />

      {/* Ground plane catches the shadow so the heart reads as a solid. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
        <circleGeometry args={[4, 64]} />
        <meshStandardMaterial color="#0c0c12" roughness={1} metalness={0} />
      </mesh>
    </>
  )
}

// ─── Root viewer + HUD ──────────────────────────────────────────────────────

export function HeartViewer() {
  const [resolution, setResolution] = useState<Resolution>(96)
  const [wireframe, setWireframe] = useState(false)
  const [spinning, setSpinning] = useState(true)
  const [beating, setBeating] = useState(true)
  const [mesh, setMesh] = useState<HeartMeshData | null>(null)
  const [building, setBuilding] = useState(true)

  // Build the mesh off the first paint so the page shell appears
  // immediately; the extraction itself is synchronous CPU work.
  useEffect(() => {
    let cancelled = false
    setBuilding(true)
    const handle = window.setTimeout(() => {
      const data = buildHeartMesh(resolution)
      if (cancelled) return
      setMesh(data)
      setBuilding(false)
    }, 16)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [resolution])

  const geometry = useMemo(() => (mesh ? toBufferGeometry(mesh) : null), [mesh])
  useEffect(() => () => geometry?.dispose(), [geometry])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07070b] text-white">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        className="absolute inset-0"
      >
        {geometry && (
          <HeartScene
            geometry={geometry}
            wireframe={wireframe}
            spinning={spinning}
            beating={beating}
            autoRotateCamera={false}
          />
        )}
      </Canvas>

      {/* Top-left: title + equation */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[min(92vw,30rem)] select-none">
        <Link
          href="/"
          className="pointer-events-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Lobby
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Exact 3D Heart</h1>
        <p className="mt-1 hidden text-xs leading-relaxed text-white/60 sm:block">
          Not sculpted, not approximated. This is the zero set of the heart
          polynomial, extracted directly from the equation. Every vertex is
          solved onto the surface to double precision and every normal is the
          analytic gradient.
        </p>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/85 backdrop-blur">
          <div className="whitespace-nowrap overflow-x-auto">
            (x² + <sup>9</sup>⁄<sub>4</sub>y² + z² − 1)³ − x²z³ − <sup>9</sup>⁄<sub>80</sub>y²z³ = 0
          </div>
        </div>
      </div>

      {/* Bottom: controls */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-5 pt-10 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResolution(r)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition',
                  resolution === r
                    ? 'bg-white text-black'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
                aria-pressed={resolution === r}
              >
                {RESOLUTION_LABEL[r]}
                <span className="ml-1 text-[10px] opacity-60">{r}³</span>
              </button>
            ))}
          </div>

          <ToggleButton
            active={wireframe}
            onClick={() => setWireframe((v) => !v)}
            icon={wireframe ? <Grid3x3 className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
            label={wireframe ? 'Wireframe' : 'Solid'}
          />
          <ToggleButton
            active={spinning}
            onClick={() => setSpinning((v) => !v)}
            icon={<RotateCw className="h-3.5 w-3.5" />}
            label="Spin"
          />
          <ToggleButton
            active={beating}
            onClick={() => setBeating((v) => !v)}
            icon={beating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            label="Beat"
          />
        </div>

        <Stats mesh={mesh} building={building} />
        <p className="text-[10px] text-white/40">Drag to orbit · Scroll to zoom</p>
      </div>
    </div>
  )
}

// ─── Small UI pieces ────────────────────────────────────────────────────────

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur transition',
        active
          ? 'border-white/30 bg-white/15 text-white'
          : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function Stats({ mesh, building }: { mesh: HeartMeshData | null; building: boolean }) {
  if (building || !mesh) {
    return (
      <div className="font-mono text-[11px] text-white/50">
        solving surface…
      </div>
    )
  }
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 font-mono text-[11px] text-white/70 sm:grid-cols-4">
      <Stat label="vertices" value={mesh.vertexCount.toLocaleString()} />
      <Stat label="triangles" value={mesh.triangleCount.toLocaleString()} />
      <Stat label="max |f(v)|" value={mesh.maxResidual.toExponential(2)} />
      <Stat label="mean |f(v)|" value={mesh.meanResidual.toExponential(2)} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-center sm:gap-0">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/90">{value}</dd>
    </div>
  )
}
