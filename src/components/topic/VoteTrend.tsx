'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { VoteTrendResponse, VoteTrendPoint } from '@/app/api/topics/[id]/vote-trend/route'

interface VoteTrendProps {
  topicId: string
  className?: string
}

// ─── Tiny sparkline rendered as inline SVG ────────────────────────────────────

function Sparkline({
  points,
  width = 200,
  height = 48,
}: {
  points: VoteTrendPoint[]
  width?: number
  height?: number
}) {
  if (points.length < 2) return null

  const pad = 4
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  // Map data → SVG coords
  const minPct = Math.min(...points.map((p) => p.forPct))
  const maxPct = Math.max(...points.map((p) => p.forPct))
  // Ensure there's always a visible range (at least ±2pp)
  const lo = Math.min(minPct - 2, 45)
  const hi = Math.max(maxPct + 2, 55)

  function x(i: number) {
    return pad + (i / (points.length - 1)) * innerW
  }
  function y(pct: number) {
    return pad + innerH - ((pct - lo) / (hi - lo)) * innerH
  }

  // Build SVG path
  const linePts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.forPct).toFixed(1)}`)
  const linePath = `M${linePts.join('L')}`

  // Area: close back to bottom
  const areaPath = `${linePath}L${x(points.length - 1).toFixed(1)},${(pad + innerH).toFixed(1)}L${pad},${(pad + innerH).toFixed(1)}Z`

  // 50% line position
  const midY = y(50)

  const lastPct = points[points.length - 1].forPct
  const lineColor = lastPct >= 50 ? '#3b82f6' : '#ef4444' // for-500 / against-500

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="overflow-visible"
    >
      {/* 50% reference line */}
      {midY >= pad && midY <= pad + innerH && (
        <line
          x1={pad}
          y1={midY}
          x2={pad + innerW}
          y2={midY}
          stroke="#3f3f46"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}

      {/* Area fill */}
      <defs>
        <linearGradient id={`trend-grad-${lastPct > 50 ? 'for' : 'against'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#trend-grad-${lastPct > 50 ? 'for' : 'against'})`}
      />

      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />

      {/* End dot */}
      <circle
        cx={x(points.length - 1)}
        cy={y(lastPct)}
        r="2.5"
        fill={lineColor}
      />
    </svg>
  )
}

// ─── Momentum indicator ───────────────────────────────────────────────────────

function MomentumBadge({ early, current }: { early: number; current: number }) {
  const delta = current - early
  const abs = Math.abs(delta)

  if (abs < 1) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
        <Minus className="h-2.5 w-2.5" />
        Stable
      </span>
    )
  }

  const isGaining = delta > 0
  const Icon = isGaining ? TrendingUp : TrendingDown
  const color = isGaining ? 'text-for-400' : 'text-against-400'
  const label = isGaining ? `+${abs.toFixed(1)}pp FOR` : `-${abs.toFixed(1)}pp AGAINST`

  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-mono', color)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoteTrend({ topicId, className }: VoteTrendProps) {
  const [data, setData] = useState<VoteTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)

    fetch(`/api/topics/${topicId}/vote-trend`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((json: VoteTrendResponse | null) => {
        if (mounted && json) setData(json)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [topicId])

  // Don't render anything while loading or if there's insufficient data
  if (loading) {
    return (
      <div className={cn('h-16 rounded-xl bg-surface-300/30 animate-pulse', className)} />
    )
  }

  if (!data || !data.hasEnoughData) return null

  const { points } = data

  // Compute early baseline: average of first 20% of points
  const sliceEnd = Math.max(1, Math.floor(points.length * 0.2))
  const earlyPcts = points.slice(0, sliceEnd).map((p) => p.forPct)
  const earlyAvg = earlyPcts.reduce((a, b) => a + b, 0) / earlyPcts.length
  const latestPct = points[points.length - 1].forPct

  // Day labels: first and last
  function shortDate(iso: string) {
    const [, m, d] = iso.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
  }

  const firstDate = shortDate(points[0].date)
  const lastDate = shortDate(points[points.length - 1].date)
  const daySpan = points.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl bg-surface-100 border border-surface-300 px-4 pt-3 pb-2',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-surface-500" aria-hidden="true" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
            Vote Trend · {daySpan} {daySpan === 1 ? 'day' : 'days'}
          </span>
        </div>
        <MomentumBadge early={earlyAvg} current={latestPct} />
      </div>

      {/* Sparkline */}
      <div className="w-full">
        <Sparkline points={points} width={280} height={44} />
      </div>

      {/* Date labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-surface-600">{firstDate}</span>
        <span className="text-[9px] font-mono text-surface-500">
          {data.totalVotes.toLocaleString()} votes total
        </span>
        <span className="text-[9px] font-mono text-surface-600">{lastDate}</span>
      </div>
    </motion.div>
  )
}
