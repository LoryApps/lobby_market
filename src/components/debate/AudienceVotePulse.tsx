'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface AudienceVotePulseProps {
  blueSway: number
  redSway: number
}

export function AudienceVotePulse({
  blueSway,
  redSway,
}: AudienceVotePulseProps) {
  const [isPulsing, setIsPulsing] = useState(false)
  const prevRef = useRef({ blue: blueSway, red: redSway })

  useEffect(() => {
    const prev = prevRef.current
    const delta = Math.abs(blueSway - prev.blue) + Math.abs(redSway - prev.red)
    if (delta >= 4) {
      setIsPulsing(true)
      const t = setTimeout(() => setIsPulsing(false), 600)
      prevRef.current = { blue: blueSway, red: redSway }
      return () => clearTimeout(t)
    }
    prevRef.current = { blue: blueSway, red: redSway }
  }, [blueSway, redSway])

  const bluePct = Math.max(0, Math.min(100, blueSway))
  const redPct = Math.max(0, Math.min(100, redSway))

  return (
    <div className="relative w-full px-6 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-for-500" />
          <span className="font-mono text-[11px] font-bold text-for-300 uppercase tracking-wider">
            FOR
          </span>
          <span className="font-mono text-[11px] text-for-400">{bluePct}%</span>
        </div>
        <span className="font-mono text-[10px] text-surface-500 uppercase tracking-widest">
          Audience Sway
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-against-400">
            {redPct}%
          </span>
          <span className="font-mono text-[11px] font-bold text-against-300 uppercase tracking-wider">
            AGAINST
          </span>
          <span className="h-2 w-2 rounded-full bg-against-500" />
        </div>
      </div>

      <div
        className={cn(
          'relative h-3 rounded-full overflow-hidden border',
          'bg-black/50 border-surface-300/50',
          isPulsing && 'shadow-[0_0_20px_rgba(255,255,255,0.3)]'
        )}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 via-for-500 to-for-400"
          initial={{ width: `${bluePct}%` }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-700 via-against-500 to-against-400"
          initial={{ width: `${redPct}%` }}
          animate={{ width: `${redPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Center divider */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-white/30" />
      </div>
    </div>
  )
}
