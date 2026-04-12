'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface FollowCameraProps {
  target: React.RefObject<THREE.Object3D | null>
  /** Horizontal follow distance behind the player. */
  distance?: number
  /** Height above the player. */
  height?: number
  /** Smoothing factor per frame (0..1). Lower = smoother/laggier. */
  lerp?: number
  /** If true, the camera becomes inert (e.g. when OrbitControls takes over). */
  disabled?: boolean
}

/**
 * Third-person follow camera. Trails the target from behind and above,
 * smoothly easing into position so movement feels weighty.
 *
 * Uses useThree().camera, so it must live inside the Canvas.
 */
export function FollowCamera({
  target,
  distance = 14,
  height = 11,
  lerp = 0.08,
  disabled = false,
}: FollowCameraProps) {
  const { camera } = useThree()
  const desired = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())
  const initialized = useRef(false)

  useFrame(() => {
    if (disabled) return
    const targetObj = target.current
    if (!targetObj) return

    const tp = targetObj.position
    desired.current.set(tp.x, tp.y + height, tp.z + distance)

    if (!initialized.current) {
      camera.position.copy(desired.current)
      initialized.current = true
    } else {
      camera.position.lerp(desired.current, lerp)
    }

    lookAt.current.set(tp.x, tp.y + 1.5, tp.z)
    camera.lookAt(lookAt.current)
  })

  return null
}
