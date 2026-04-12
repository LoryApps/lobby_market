'use client'

import { useMemo } from 'react'
import type { Profile } from '@/lib/supabase/types'
import { plotPosition, seededScalar } from '@/lib/city/plot-math'
import { SpriteBillboard } from './SpriteBillboard'

interface PropSpec {
  key: string
  path: string
  position: [number, number, number]
  size: [number, number]
  fallbackColor: string
}

const PROP_KINDS = [
  {
    path: '/assets/sprites/prop-lamppost.png',
    size: [1.2, 3.2] as [number, number],
    color: '#d4a36a',
    tag: 'lamppost',
  },
  {
    path: '/assets/sprites/prop-tree.png',
    size: [2.4, 3.2] as [number, number],
    color: '#2f7a4a',
    tag: 'tree',
  },
  {
    path: '/assets/sprites/prop-bench.png',
    size: [1.8, 1.1] as [number, number],
    color: '#8b5a2b',
    tag: 'bench',
  },
  {
    path: '/assets/sprites/prop-fountain.png',
    size: [2.2, 2.2] as [number, number],
    color: '#60a5fa',
    tag: 'fountain',
  },
] as const

export interface PropPlacementProps {
  users: Profile[]
}

/**
 * Scatters decorative props (lampposts, trees, benches, fountains) around
 * every plot using a deterministic seeded RNG. Each user gets the same
 * layout every time to preserve visual identity.
 */
export function PropPlacement({ users }: PropPlacementProps) {
  const props = useMemo<PropSpec[]>(() => {
    const out: PropSpec[] = []
    for (const user of users) {
      const [cx, cz] = plotPosition(user.id)

      // 0-3 props per plot based on seeded RNG
      const count = Math.floor(seededScalar(user.id, 'prop-count') * 3) + 1
      for (let i = 0; i < count; i++) {
        const kindIdx = Math.floor(
          seededScalar(user.id, 'prop-kind-' + i) * PROP_KINDS.length
        )
        const kind = PROP_KINDS[kindIdx]
        const angle = seededScalar(user.id, 'prop-a-' + i) * Math.PI * 2
        // Props sit on the plot border (slab is 8x8 so radius ~3.3)
        const radius = 3.1 + seededScalar(user.id, 'prop-r-' + i) * 0.6
        const x = cx + Math.cos(angle) * radius
        const z = cz + Math.sin(angle) * radius
        out.push({
          key: user.id + ':' + kind.tag + ':' + i,
          path: kind.path,
          position: [x, 0, z],
          size: kind.size,
          fallbackColor: kind.color,
        })
      }
    }
    return out
  }, [users])

  return (
    <group>
      {props.map((p) => (
        <SpriteBillboard
          key={p.key}
          texturePath={p.path}
          position={p.position}
          size={p.size}
          fallbackColor={p.fallbackColor}
        />
      ))}
    </group>
  )
}
