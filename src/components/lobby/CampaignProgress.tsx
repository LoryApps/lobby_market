'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { Lobby } from '@/lib/supabase/types'
import type { LobbySnapshotsResponse, LobbySnapshot } from '@/app/api/lobbies/[id]/snapshots/route'
import { cn } from '@/lib/utils/cn'

interface CampaignProgressProps {
  lobby: Lobby
  /** Override the displayed peak value (optional). */
  peak?: number
}

// ─── Synthetic fallback curve ─────────────────────────────────────────────────

function syntheticPoints(memberCount: number): number[] {
  const base = Math.max(memberCount, 1)
  return [
    Math.round(base * 0.05),
    Math.round(base * 0.15),
    Math.round(base * 0.32),
    Math.round(base * 0.56),
    Math.round(base * 0.74),
    Math.round(base * 0.90),
    base,
  ]
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({
  points,
  stroke,
  fill,
  width = 280,
  height = 80,
}: {
  points: number[]
  stroke: string
  fill: string
  width?: number
  height?: number
}) {
  if (points.length < 2) return null

  const max = Math.max(...points, 1)
  const stepX = width / (points.length - 1)

  const coords = points.map((v, i) => ({
    x: i * stepX,
    y: height - (v / max) * height,
  }))

  const linePath = coords.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-20 overflow-visible"
      aria-hidden="true"
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map(({ x, y }, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === coords.length - 1 ? 3.5 : 2}
          fill={stroke}
          opacity={i === coords.length - 1 ? 1 : 0.7}
        />
      ))}
    </svg>
  )
}

// ─── Date label helpers ───────────────────────────────────────────────────────

function labelFromIso(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CampaignProgress({ lobby, peak }: CampaignProgressProps) {
  const [snapshots, setSnapshots] = useState<LobbySnapshot[] | null>(null)
  const [hasRealData, setHasRealData] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/lobbies/${lobby.id}/snapshots`)
      .then((r) => r.ok ? r.json() as Promise<LobbySnapshotsResponse> : null)
      .then((json) => {
        if (cancelled || !json) return
        setSnapshots(json.snapshots)
        setHasRealData(json.hasEnoughData)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [lobby.id])

  const isFor = lobby.position === 'for'
  const stroke = isFor ? '#3b82f6' : '#ef4444'
  const fill   = isFor ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'

  // Derive numeric points for the sparkline
  const points = useMemo<number[]>(() => {
    if (hasRealData && snapshots && snapshots.length >= 2) {
      return snapshots.map((s) => s.member_count)
    }
    return syntheticPoints(lobby.member_count)
  }, [hasRealData, snapshots, lobby.member_count])

  // Growth stats (only show with real data)
  const growth = useMemo(() => {
    if (!hasRealData || !snapshots || snapshots.length < 2) return null
    const first = snapshots[0].member_count
    const last  = snapshots[snapshots.length - 1].member_count
    if (first === 0) return null
    const pct = Math.round(((last - first) / first) * 100)
    const delta = last - first
    return { pct, delta }
  }, [hasRealData, snapshots])

  // Time labels derived from actual snapshot timestamps
  const startLabel = useMemo(() => {
    if (hasRealData && snapshots && snapshots.length >= 2) {
      return labelFromIso(snapshots[0].recorded_at)
    }
    return 'Start'
  }, [hasRealData, snapshots])

  const peakVal = peak ?? Math.max(...points, lobby.member_count)

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-gold" />
          Campaign Momentum
          {!hasRealData && (
            <span className="text-[9px] font-mono text-surface-600 normal-case tracking-normal">
              (projected)
            </span>
          )}
        </h3>

        <div className="flex items-center gap-2">
          {/* Growth badge (real data only) */}
          {growth !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded',
                growth.pct >= 0
                  ? 'bg-emerald/10 text-emerald border border-emerald/20'
                  : 'bg-against-500/10 text-against-400 border border-against-500/20'
              )}
            >
              {growth.pct >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              {growth.pct >= 0 ? '+' : ''}{growth.pct}%
            </span>
          )}

          {/* Current member count */}
          <div
            className={cn(
              'font-mono text-xs font-bold tabular-nums',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            {lobby.member_count.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline
        points={points}
        stroke={stroke}
        fill={fill}
      />

      {/* Footer row */}
      <div className="mt-3 flex justify-between text-[9px] font-mono text-surface-500 uppercase">
        <span>{startLabel}</span>
        <div className="flex items-center gap-2">
          {peakVal > lobby.member_count && (
            <span className="text-surface-600">
              Peak: {peakVal.toLocaleString()}
            </span>
          )}
          <span>Now</span>
        </div>
      </div>
    </div>
  )
}
