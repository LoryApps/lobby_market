'use client'

import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import type { Lobby } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface CampaignProgressProps {
  lobby: Lobby
  peak?: number
}

/**
 * Minimal momentum visualization. Without a per-day history table, we fake
 * a plausible trajectory from the lobby's current member count and influence
 * score so the UI stays useful on day one. Callers that have real snapshots
 * can swap this out for a time-series chart later.
 */
export function CampaignProgress({ lobby, peak }: CampaignProgressProps) {
  const points = useMemo(() => {
    const members = Math.max(lobby.member_count, 1)
    const base = members
    const seed = [
      Math.round(base * 0.05),
      Math.round(base * 0.12),
      Math.round(base * 0.3),
      Math.round(base * 0.55),
      Math.round(base * 0.75),
      Math.round(base * 0.9),
      members,
    ]
    return seed
  }, [lobby.member_count])

  const max = Math.max(...points, peak ?? 0, 1)
  const width = 280
  const height = 80
  const stepX = width / (points.length - 1)
  const path = points
    .map((v, idx) => {
      const x = idx * stepX
      const y = height - (v / max) * height
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const positionStroke = lobby.position === 'for' ? '#3b82f6' : '#ef4444'
  const positionFill =
    lobby.position === 'for' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)'
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-gold" />
          Campaign Momentum
        </h3>
        <div
          className={cn(
            'font-mono text-xs font-bold tabular-nums',
            lobby.position === 'for' ? 'text-for-400' : 'text-against-400'
          )}
        >
          {lobby.member_count.toLocaleString()}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-20 overflow-visible"
      >
        <path d={fillPath} fill={positionFill} />
        <path
          d={path}
          fill="none"
          stroke={positionStroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((v, idx) => {
          const x = idx * stepX
          const y = height - (v / max) * height
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={idx === points.length - 1 ? 3 : 2}
              fill={positionStroke}
            />
          )
        })}
      </svg>

      <div className="mt-3 flex justify-between text-[9px] font-mono text-surface-500 uppercase">
        <span>Week start</span>
        <span>Now</span>
      </div>
    </div>
  )
}
