'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Compass,
  Flame,
  RefreshCw,
  Share2,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CompassData } from '@/app/api/analytics/compass/route'

// ─── Radar chart ──────────────────────────────────────────────────────────────

const CHART_SIZE = 280
const CENTER = CHART_SIZE / 2
const MAX_RADIUS = CENTER - 32

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

function buildPolygon(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

// Category ring colors
const CATEGORY_COLORS: Record<string, { stroke: string; fill: string }> = {
  Politics: { stroke: '#60a5fa', fill: '#3b82f620' },
  Economics: { stroke: '#f59e0b', fill: '#f59e0b20' },
  Technology: { stroke: '#8b5cf6', fill: '#8b5cf620' },
  Ethics: { stroke: '#10b981', fill: '#10b98120' },
  Science: { stroke: '#34d399', fill: '#34d39920' },
  Culture: { stroke: '#f472b6', fill: '#f472b620' },
  Philosophy: { stroke: '#a78bfa', fill: '#a78bfa20' },
  Health: { stroke: '#2dd4bf', fill: '#2dd4bf20' },
}

interface RadarChartProps {
  stats: CompassData['stats']
  animated?: boolean
}

function RadarChart({ stats, animated = true }: RadarChartProps) {
  const n = stats.length
  const angleStep = 360 / n

  // Grid rings at 25%, 50%, 75%, 100%
  const gridRings = [0.25, 0.5, 0.75, 1.0]

  // Build axis endpoints (outer edge)
  const axes = stats.map((s, i) => {
    const angle = i * angleStep
    const { x, y } = polarToXY(angle, MAX_RADIUS)
    const labelPos = polarToXY(angle, MAX_RADIUS + 18)
    return { ...s, angle, x, y, labelPos }
  })

  // Build data polygon points — forPct 0–100 mapped to 0–MAX_RADIUS
  // We center at 50 = middle, so a neutral voter is at 50% radius
  const dataPoints = stats.map((s, i) => {
    const angle = i * angleStep
    const r = (s.forPct / 100) * MAX_RADIUS
    return polarToXY(angle, r)
  })

  const polygonStr = buildPolygon(dataPoints)

  return (
    <svg
      width={CHART_SIZE}
      height={CHART_SIZE}
      viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      aria-label="Civic compass radar chart"
    >
      {/* Grid rings */}
      {gridRings.map((pct) => {
        const ringPts = stats.map((_, i) => {
          const angle = i * angleStep
          return polarToXY(angle, MAX_RADIUS * pct)
        })
        return (
          <polygon
            key={pct}
            points={buildPolygon(ringPts)}
            fill="none"
            stroke={pct === 0.5 ? '#3f3f4a' : '#24242e'}
            strokeWidth={pct === 0.5 ? 1.5 : 0.75}
            strokeDasharray={pct === 0.5 ? '4 3' : undefined}
          />
        )
      })}

      {/* Axis lines */}
      {axes.map((ax) => (
        <line
          key={ax.category}
          x1={CENTER}
          y1={CENTER}
          x2={ax.x}
          y2={ax.y}
          stroke="#24242e"
          strokeWidth={0.75}
        />
      ))}

      {/* Data fill */}
      <motion.polygon
        points={polygonStr}
        fill="url(#compassFill)"
        stroke="none"
        initial={animated ? { opacity: 0, scale: 0.2 } : { opacity: 0.35 }}
        animate={{ opacity: 0.35, scale: 1 }}
        style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <motion.polygon
        points={polygonStr}
        fill="none"
        stroke="url(#compassStroke)"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={animated ? { opacity: 0, scale: 0.2 } : { opacity: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />

      {/* Midline (neutral) ring label */}
      <text
        x={CENTER + MAX_RADIUS * 0.5 + 3}
        y={CENTER - 3}
        fill="#71717a"
        fontSize="7"
        fontFamily="JetBrains Mono, monospace"
        textAnchor="start"
      >
        50%
      </text>

      {/* Data point dots */}
      {dataPoints.map((pt, i) => (
        <motion.circle
          key={stats[i].category}
          cx={pt.x}
          cy={pt.y}
          r={3.5}
          fill={CATEGORY_COLORS[stats[i].category]?.stroke ?? '#8b5cf6'}
          initial={animated ? { opacity: 0, scale: 0 } : { opacity: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
          transition={{ duration: 0.5, delay: 0.6 + i * 0.06 }}
        />
      ))}

      {/* Category labels */}
      {axes.map((ax) => {
        const isLeft = ax.labelPos.x < CENTER - 4
        return (
          <text
            key={ax.category}
            x={ax.labelPos.x}
            y={ax.labelPos.y + 4}
            fill="#a1a1aa"
            fontSize="8.5"
            fontFamily="JetBrains Mono, monospace"
            textAnchor={isLeft ? 'end' : ax.labelPos.x > CENTER + 4 ? 'start' : 'middle'}
            fontWeight="600"
          >
            {ax.category.toUpperCase()}
          </text>
        )
      })}

      {/* SVG defs for gradients */}
      <defs>
        <linearGradient id="compassFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="compassStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryRow({
  stat,
  maxTotal,
  index,
}: {
  stat: CompassData['stats'][number]
  maxTotal: number
  index: number
}) {
  const engagementPct = maxTotal > 0 ? (stat.total / maxTotal) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="flex items-center gap-3"
    >
      {/* Category name */}
      <div className="w-20 flex-shrink-0">
        <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
          {stat.category}
        </span>
      </div>

      {/* Engagement bar (width = engagement relative to max) */}
      <div className="flex-1 relative h-4 rounded-full bg-surface-300/40 overflow-hidden">
        {stat.total > 0 ? (
          <>
            {/* FOR portion */}
            <motion.div
              className="absolute left-0 top-0 h-full rounded-l-full"
              style={{ backgroundColor: '#3b82f640' }}
              initial={{ width: 0 }}
              animate={{ width: `${(stat.blue / stat.total) * engagementPct}%` }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.05 }}
            />
            {/* AGAINST portion */}
            <motion.div
              className="absolute top-0 h-full rounded-r-full"
              style={{
                backgroundColor: '#ef444440',
                left: `${(stat.blue / stat.total) * engagementPct}%`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(stat.red / stat.total) * engagementPct}%` }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.05 }}
            />
            {/* Divider dot */}
            <div
              className="absolute top-0.5 bottom-0.5 w-px bg-surface-400/60"
              style={{ left: `${(stat.blue / stat.total) * engagementPct}%` }}
            />
          </>
        ) : (
          <div className="h-full w-full flex items-center pl-2">
            <span className="text-[9px] font-mono text-surface-500">no votes</span>
          </div>
        )}
      </div>

      {/* FOR% label */}
      <div className="w-14 flex-shrink-0 flex items-center justify-end gap-1.5">
        {stat.total > 0 ? (
          <>
            <span
              className="text-[10px] font-mono font-bold tabular-nums"
              style={{ color: stat.forPct >= 50 ? '#60a5fa' : '#f87171' }}
            >
              {stat.forPct}%
            </span>
            <span className="text-[9px] font-mono text-surface-500">
              {stat.forPct >= 50 ? 'FOR' : 'AGN'}
            </span>
          </>
        ) : (
          <span className="text-[10px] font-mono text-surface-500">—</span>
        )}
      </div>

      {/* Vote count */}
      <div className="w-8 flex-shrink-0 text-right">
        <span className="text-[10px] font-mono text-surface-500 tabular-nums">{stat.total}</span>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CompassSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col items-center gap-4">
        <div className="h-[280px] w-[280px] rounded-full bg-surface-300/30" />
        <div className="h-6 w-40 rounded bg-surface-300/40" />
        <div className="h-4 w-64 rounded bg-surface-300/30" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-20 h-3 rounded bg-surface-300/30" />
            <div className="flex-1 h-4 rounded-full bg-surface-300/30" />
            <div className="w-14 h-3 rounded bg-surface-300/30" />
            <div className="w-8 h-3 rounded bg-surface-300/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CivicCompassPage() {
  const router = useRouter()
  const [data, setData] = useState<CompassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/compass')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load compass data')
      const json = await res.json()
      setData(json as CompassData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handleShare() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const maxTotal = data
    ? Math.max(...data.stats.map((s) => s.total), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors'
              )}
              aria-label="Back to Analytics"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Compass className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Compass</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Your political profile, built from your votes
              </p>
            </div>
          </div>

          <button
            onClick={handleShare}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono font-semibold',
              'border transition-all',
              copied
                ? 'bg-emerald/10 border-emerald/30 text-emerald'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
            aria-label="Share your Civic Compass"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CompassSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-against-500/30 bg-surface-100 p-8 text-center"
            >
              <p className="font-mono text-against-400 mb-4">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white font-mono text-sm hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Radar chart + archetype card */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
                {/* Chart */}
                <div className="flex-shrink-0">
                  <RadarChart stats={data.stats} animated />
                </div>

                {/* Archetype */}
                <div className="flex flex-col gap-4 text-center sm:text-left">
                  <div>
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider border mb-3"
                      style={{
                        color: data.archetype.color,
                        borderColor: `${data.archetype.color}40`,
                        backgroundColor: `${data.archetype.color}10`,
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Civic Archetype
                    </div>
                    <h2
                      className="font-mono text-3xl font-bold mb-1"
                      style={{ color: data.archetype.color }}
                    >
                      {data.archetype.label}
                    </h2>
                    <p className="font-mono text-sm text-surface-500 mb-3">
                      {data.archetype.subtitle}
                    </p>
                    <p className="text-sm text-surface-600 leading-relaxed max-w-sm">
                      {data.archetype.description}
                    </p>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 justify-center sm:justify-start flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                      <span className="font-mono text-xs text-surface-500">
                        <span className="text-for-400 font-bold">{data.overallForPct}%</span> FOR
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                      <span className="font-mono text-xs text-surface-500">
                        <span className="text-against-400 font-bold">{100 - data.overallForPct}%</span> AGN
                      </span>
                    </div>
                    {data.voteStreak > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-gold" />
                        <span className="font-mono text-xs text-surface-500">
                          <span className="text-gold font-bold">{data.voteStreak}</span> streak
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-purple" />
                    Category Breakdown
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-4 rounded-full bg-for-500/40" />
                      FOR
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-4 rounded-full bg-against-500/40" />
                      AGAINST
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {[...data.stats]
                    .sort((a, b) => b.total - a.total)
                    .map((stat, i) => (
                      <CategoryRow
                        key={stat.category}
                        stat={stat}
                        maxTotal={maxTotal}
                        index={i}
                      />
                    ))}
                </div>

                {/* Footer note */}
                <p className="mt-5 text-[10px] font-mono text-surface-500 text-center">
                  Based on your last {data.totalVotes.toLocaleString()} vote
                  {data.totalVotes !== 1 ? 's' : ''} ·{' '}
                  {data.totalArguments > 0 && (
                    <>{data.totalArguments} argument{data.totalArguments !== 1 ? 's' : ''} posted · </>
                  )}
                  Chart position = your FOR% per category
                </p>
              </div>

              {/* No votes empty state */}
              {data.totalVotes === 0 && (
                <div className="rounded-2xl border border-purple/20 bg-purple/5 p-6 text-center">
                  <Target className="h-10 w-10 text-purple mx-auto mb-3" />
                  <h3 className="font-mono text-lg font-bold text-white mb-2">
                    Calibrate Your Compass
                  </h3>
                  <p className="text-sm text-surface-500 mb-5 max-w-xs mx-auto">
                    Cast your first votes to shape your civic profile. The more you vote, the more
                    accurate your compass becomes.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple text-white font-mono text-sm font-semibold hover:bg-purple/90 transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    Start Voting
                  </Link>
                </div>
              )}

              {/* CTA row */}
              <div className="flex items-center gap-3">
                <Link
                  href="/analytics"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                    'border border-surface-300 bg-surface-100 text-surface-500',
                    'hover:bg-surface-200 hover:text-white font-mono text-sm font-semibold transition-colors'
                  )}
                >
                  <BarChart2 className="h-4 w-4" />
                  Full Analytics
                </Link>
                <Link
                  href="/leaderboard"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                    'border border-purple/30 bg-purple/10 text-purple',
                    'hover:bg-purple/20 font-mono text-sm font-semibold transition-colors'
                  )}
                >
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
