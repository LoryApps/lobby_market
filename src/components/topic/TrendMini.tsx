'use client'

/**
 * TrendMini
 *
 * A compact inline sparkline for the main feed TopicCard.
 * Lazy-fetches vote-trend data via IntersectionObserver — the API call fires
 * only when the card scrolls into the viewport, keeping the feed performant.
 *
 * Rendered as a pure SVG (no canvas, no external chart lib).
 * Shows FOR momentum with a blue line / AGAINST with a red line.
 * A dashed grey 50% reference line anchors the chart.
 *
 * Only appears on active/voting topics that have ≥ 2 days of data.
 */

import { useEffect, useRef, useState } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { VoteTrendResponse, VoteTrendPoint } from '@/app/api/topics/[id]/vote-trend/route'

// ─── Cache ─────────────────────────────────────────────────────────────────────
// Session-level in-memory cache shared across all mounted TrendMinis.
// This means the second card showing the same topic pays nothing.

const cache = new Map<string, VoteTrendResponse | null>()

async function fetchTrend(topicId: string): Promise<VoteTrendResponse | null> {
  if (cache.has(topicId)) return cache.get(topicId) ?? null
  try {
    const res = await fetch(`/api/topics/${topicId}/vote-trend`, {
      // Allow the CDN to serve stale data for up to 10 minutes
      next: { revalidate: 600 },
    })
    if (!res.ok) {
      cache.set(topicId, null)
      return null
    }
    const data = (await res.json()) as VoteTrendResponse
    cache.set(topicId, data)
    return data
  } catch {
    cache.set(topicId, null)
    return null
  }
}

// ─── SVG sparkline ─────────────────────────────────────────────────────────────

function Sparkline({
  points,
  width,
  height,
}: {
  points: VoteTrendPoint[]
  width: number
  height: number
}) {
  if (points.length < 2) return null

  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const pcts = points.map((p) => p.forPct)
  const rawMin = Math.min(...pcts)
  const rawMax = Math.max(...pcts)
  // Ensure visible range — at least ±3pp, centred on 50
  const lo = Math.min(rawMin - 3, 47)
  const hi = Math.max(rawMax + 3, 53)

  function x(i: number) {
    return pad + (i / (points.length - 1)) * innerW
  }
  function y(pct: number) {
    return pad + innerH - ((pct - lo) / (hi - lo)) * innerH
  }

  const linePts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.forPct).toFixed(1)}`)
  const linePath = `M${linePts.join('L')}`
  const areaPath = `${linePath}L${x(points.length - 1).toFixed(1)},${(pad + innerH).toFixed(1)}L${pad},${(pad + innerH).toFixed(1)}Z`

  const midY = y(50)
  const lastPct = points[points.length - 1].forPct
  const lineColor = lastPct >= 50 ? '#3b82f6' : '#ef4444'
  const gradId = `trendmini-${lastPct > 50 ? 'for' : 'ag'}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="overflow-visible flex-shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* 50% reference line */}
      {midY >= pad && midY <= pad + innerH && (
        <line
          x1={pad}
          y1={midY}
          x2={pad + innerW}
          y2={midY}
          stroke="#3f3f4a"
          strokeWidth="0.8"
          strokeDasharray="2 2"
        />
      )}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle
        cx={x(points.length - 1)}
        cy={y(lastPct)}
        r="2"
        fill={lineColor}
      />
    </svg>
  )
}

// ─── Momentum label ─────────────────────────────────────────────────────────────

function Delta({ early, current }: { early: number; current: number }) {
  const delta = current - early
  const abs = parseFloat(Math.abs(delta).toFixed(1))

  if (abs < 0.5) {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-mono text-surface-600 flex-shrink-0">
        <Minus className="h-2 w-2" />
        stable
      </span>
    )
  }

  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  const color = up ? 'text-for-500' : 'text-against-500'
  const sign = up ? '+' : '−'

  return (
    <span className={cn('flex items-center gap-0.5 text-[9px] font-mono flex-shrink-0', color)}>
      <Icon className="h-2 w-2" />
      {sign}{abs}pp
    </span>
  )
}

// ─── Main export ────────────────────────────────────────────────────────────────

interface TrendMiniProps {
  topicId: string
  /** Tailwind classes forwarded to the outer wrapper */
  className?: string
  /** Sparkline pixel dimensions — defaults to 80×22 */
  width?: number
  height?: number
}

export function TrendMini({
  topicId,
  className,
  width = 80,
  height = 22,
}: TrendMiniProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<VoteTrendResponse | null>(null)
  const [triggered, setTriggered] = useState(false)

  // Fire the fetch only once the element enters the viewport (IntersectionObserver).
  // Falls back to immediate fetch if IntersectionObserver is unavailable.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('IntersectionObserver' in window)) {
      setTriggered(true)
      return
    }
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTriggered(true)
          obs.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!triggered) return
    let mounted = true
    fetchTrend(topicId).then((d) => {
      if (mounted) setData(d)
    })
    return () => { mounted = false }
  }, [triggered, topicId])

  // Render nothing until data loads; hide if insufficient data
  if (!data || !data.hasEnoughData) {
    return <div ref={ref} className={cn('h-5', className)} />
  }

  const { points } = data

  // Early average: first 25% of points
  const sliceEnd = Math.max(1, Math.floor(points.length * 0.25))
  const earlyAvg =
    points.slice(0, sliceEnd).reduce((sum, p) => sum + p.forPct, 0) / sliceEnd
  const lastPct = points[points.length - 1].forPct

  return (
    <div
      ref={ref}
      className={cn('flex items-center gap-1.5', className)}
      title={`Vote trend over ${points.length} day${points.length !== 1 ? 's' : ''} · ${lastPct.toFixed(1)}% FOR`}
    >
      <Sparkline points={points} width={width} height={height} />
      <Delta early={earlyAvg} current={lastPct} />
    </div>
  )
}
