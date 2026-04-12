'use client'

import { Html } from '@react-three/drei'
import type { Profile } from '@/lib/supabase/types'

export interface InteractionPromptProps {
  position: [number, number, number]
  user: Profile
}

/**
 * In-world "Press E to view profile" tooltip. Anchored to a plot center and
 * rendered as HTML via drei so it's cheap and always readable.
 */
export function InteractionPrompt({ position, user }: InteractionPromptProps) {
  return (
    <Html position={position} center distanceFactor={14} zIndexRange={[100, 0]}>
      <div className="pointer-events-none select-none whitespace-nowrap rounded-lg border border-white/20 bg-black/85 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <kbd className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
            E
          </kbd>
          <span>
            View <span className="font-semibold text-gold">@{user.username}</span>
          </span>
        </div>
      </div>
    </Html>
  )
}
