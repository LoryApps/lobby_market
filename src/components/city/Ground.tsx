'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Large ground plane. Procedurally colors the half-world blue (for) on the left
 * and red (against) on the right, with a faint grid pattern.
 */
export function Ground() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(800, 800, 1, 1)

    // Vertex colors so the gradient is baked into the geometry and works
    // without any texture loads / canvas work.
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uBlue: { value: new THREE.Color('#1e3a8a') },
        uRed: { value: new THREE.Color('#7f1d1d') },
        uCenter: { value: new THREE.Color('#0f0f18') },
        uGrid: { value: new THREE.Color('#2a2a3a') },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uBlue;
        uniform vec3 uRed;
        uniform vec3 uCenter;
        uniform vec3 uGrid;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          // Political gradient: blue (left) -> dark center -> red (right)
          float t = clamp(vWorldPos.x / 200.0, -1.0, 1.0);
          vec3 side = t < 0.0
            ? mix(uCenter, uBlue, -t)
            : mix(uCenter, uRed, t);

          // Radial falloff so the edges fade toward black
          float dist = length(vWorldPos.xz) / 400.0;
          float falloff = 1.0 - smoothstep(0.3, 1.0, dist);
          vec3 base = side * falloff;

          // Faint grid lines every 12 world units (matches PLOT_SPACING)
          vec2 grid = abs(fract(vWorldPos.xz / 12.0 - 0.5) - 0.5) / fwidth(vWorldPos.xz / 12.0);
          float line = 1.0 - min(min(grid.x, grid.y), 1.0);
          vec3 col = mix(base, uGrid, line * 0.35 * falloff);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })

    return { geometry: geo, material: mat }
  }, [])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[0, 0, 0]}
      receiveShadow
    />
  )
}
