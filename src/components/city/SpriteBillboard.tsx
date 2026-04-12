'use client'

import { Suspense, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

export interface SpriteBillboardProps {
  texturePath: string
  position: [number, number, number]
  size?: [number, number]
  fallbackColor?: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  /** Extra Y rotation applied on top of the billboarding yaw. */
  rotationYOffset?: number
}

/**
 * Generic billboard sprite — loads a texture and always rotates to face the
 * camera on the Y axis. Missing textures degrade gracefully to a colored plane.
 */
export function SpriteBillboard({
  texturePath,
  position,
  size = [2, 3],
  fallbackColor = '#888',
  onClick,
  onPointerOver,
  onPointerOut,
  rotationYOffset = 0,
}: SpriteBillboardProps) {
  return (
    <group position={position}>
      <Suspense
        fallback={
          <SpriteFallback
            size={size}
            color={fallbackColor}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          />
        }
      >
        <SpriteInner
          texturePath={texturePath}
          size={size}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          rotationYOffset={rotationYOffset}
        />
      </Suspense>
    </group>
  )
}

interface SpriteInnerProps {
  texturePath: string
  size: [number, number]
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  rotationYOffset: number
}

function SpriteInner({
  texturePath,
  size,
  onClick,
  onPointerOver,
  onPointerOut,
  rotationYOffset,
}: SpriteInnerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useTexture(texturePath) as THREE.Texture
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  }

  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const parent = mesh.parent
    if (!parent) return
    const yaw = Math.atan2(
      camera.position.x - parent.position.x,
      camera.position.z - parent.position.z
    )
    mesh.rotation.y = yaw + rotationYOffset
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, size[1] / 2, 0]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
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

interface SpriteFallbackProps {
  size: [number, number]
  color: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
}

function SpriteFallback({
  size,
  color,
  onClick,
  onPointerOver,
  onPointerOut,
}: SpriteFallbackProps) {
  const meshRef = useRef<THREE.Mesh>(null)

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
      {/* Body */}
      <mesh
        ref={meshRef}
        position={[0, size[1] / 2, 0]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <planeGeometry args={size} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Head dot so the fallback still reads as a character */}
      <mesh position={[0, size[1] * 0.85, 0]}>
        <sphereGeometry args={[size[0] * 0.22, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}
