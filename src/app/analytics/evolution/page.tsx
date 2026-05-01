'use client'

/**
 * /analytics/evolution — Opinion Evolution Tracker
 *
 * Shows how the current user's voting tendencies have shifted over the
 * last 12 weeks, broken down by debate category.  Each category gets a
 * sparkline showing FOR% week-by-week, a drift indicator (trending more
 * FOR or AGAINST), and a flip count (how often the majority lean changed).
 *
 * No charting library needed — pure SVG sparklines rendered from the data.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Loader2,
  Minus,
  RefreshCw,
  Repeat2,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategoryEvolution, EvolutionResponse } from '@/app/api/analytics/evolution/route'

// ─── Sparkline ────────────────────────────────────────────────────────────────

const SPARK_W = 200
const SPARK_H = 56
const PAD = 4

function Sparkline({
  weeks,
  color,
  className,
}: {
  weeks: CategoryEvolution['weeks']
  color: string
  className?: string
}) {
  const active = weeks.filter((w) => w.forPct !== -1)
  if (active.length < 2) {
    return (
      <div
        className={cn('flex items-center justify-center text-surface-600 text-xs font-mono', className)}
        style={{ width: SPARK_W, height: SPARK_H }}
      >
        not enough data
      </div>
    )
  }

  // Build points for all 12 weeks — gaps where there's no data
  const pointsByIndex: Record<number, { x: number; y: number }> = {}
  weeks.forEach((w, i) => {
    if (w.forPct === -1) return
    const x = PAD + (i / (weeks.length - 1)) * (SPARK_W - PAD * 2)
    // 50% line is in the middle; clamp to [5, 95] for visual clarity
    const pct = Math.max(5, Math.min(95, w.forPct))
    const y = SPARK_H - PAD - ((pct - 5) / 90) * (SPARK_H - PAD * 2)
    pointsByIndex[i] = { x, y }
  })

  // Build polyline segments (skip gaps)
  const segmentGroups: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  weeks.forEach((_, i) => {
    if (pointsByIndex[i]) {
      current.push(pointsByIndex[i])
    } else if (current.length > 0) {
      segmentGroups.push(current)
      current = []
    }
  })
  if (current.length > 0) segmentGroups.push(current)

  // 50% line y position
  const midY = SPARK_H - PAD - ((50 - 5) / 90) * (SPARK_H - PAD * 2)

  // Last active point for the dot
  const lastPoint = pointsByIndex[weeks.reduce((best, w, i) => (w.forPct !== -1 ? i : best), -1)]

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className={className}
      aria-hidden="true"
    >
      {/* 50% reference line */}
      <line
        x1={PAD}
        y1={midY}
        x2={SPARK_W - PAD}
        y2={midY}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Gradient fill below each segment */}
      {segmentGroups.map((seg, gi) => {
        if (seg.length < 2) return null
        const pts = seg.map((p) => `${p.x},${p.y}`).join(' ')
        const firstX = seg[0].x
        const lastX = seg[seg.length - 1].x
        const fillPts = `${firstX},${SPARK_H} ${pts} ${lastX},${SPARK_H}`
        return (
          <polygon
            key={gi}
            points={fillPts}
            fill={color}
            opacity={0.08}
          />
        )
      })}

      {/* Sparklines */}
      {segmentGroups.map((seg, gi) => {
        if (seg.length < 2) return null
        const pts = seg.map((p) => `${p.x},${p.y}`).join(' ')
        return (
          <polyline
            key={gi}
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      })}

      {/* Terminal dot */}
      {lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={color} />
      )}
    </svg>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  cat,
  isSelected,
  onClick,
}: {
  cat: CategoryEvolution
  isSelected: boolean
  onClick: () => void
}) {
  const driftAbs = Math.abs(cat.drift)
  const driftLabel =
    driftAbs < 2
      ? 'Stable'
      : cat.drift > 0
      ? `+${cat.drift}% toward FOR`
      : `${cat.drift}% toward AGAINST`

  const DriftIcon =
    driftAbs < 2 ? Minus : cat.drift > 0 ? ArrowUpRight : ArrowDownRight
  const driftColor =
    driftAbs < 2
      ? 'text-surface-500'
      : cat.drift > 0
      ? 'text-for-400'
      : 'text-against-400'

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all duration-200',
        isSelected
          ? 'border-surface-400/60 bg-surface-200/80'
          : 'border-surface-300/40 bg-surface-100/40 hover:border-surface-400/40 hover:bg-surface-200/40',
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <span className="text-sm font-semibold text-white">{cat.category}</span>
          {cat.flipCount > 0 && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-mono font-semibold text-surface-500 bg-surface-300/60 border border-surface-400/30 rounded-full px-1.5 py-0.5"
              title={`Opinion flipped ${cat.flipCount} time${cat.flipCount !== 1 ? 's' : ''}`}
            >
              <Repeat2 className="h-2.5 w-2.5" />
              {cat.flipCount}
            </span>
          )}
        </div>
        <div className={cn('flex items-center gap-1 text-[11px] font-mono font-semibold', driftColor)}>
          <DriftIcon className="h-3 w-3" />
          <span>{driftLabel}</span>
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline weeks={cat.weeks} color={cat.color} className="mb-3" />

      {/* Footer stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div
              className="text-lg font-bold font-mono"
              style={{ color: cat.currentForPct >= 50 ? '#3b82f6' : '#ef4444' }}
            >
              {cat.currentForPct}%
            </div>
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">now</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-surface-400">
              {cat.historicForPct}%
            </div>
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">avg</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-semibold text-surface-400">
            {cat.totalVotes.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-surface-500">votes</div>
        </div>
      </div>
    </motion.button>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function DetailView({ cat, onClose }: { cat: CategoryEvolution; onClose: () => void }) {
  const activeWeeks = cat.weeks.filter((w) => w.forPct !== -1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-2xl border border-surface-400/50 bg-surface-100/60 backdrop-blur-sm p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
          <h3 className="font-mono font-bold text-white text-base">{cat.category}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-surface-500 hover:text-white transition-colors text-xs font-mono"
        >
          close
        </button>
      </div>

      {/* Large sparkline */}
      <div className="mb-4 overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${SPARK_W * 2} ${SPARK_H * 2}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: 100 }}
          aria-label={`${cat.category} opinion trend chart`}
        >
          {/* Grid lines at 25%, 50%, 75% */}
          {[25, 50, 75].map((pct) => {
            const y = (SPARK_H * 2 - PAD * 2) - ((pct - 5) / 90) * (SPARK_H * 2 - PAD * 4) + PAD * 2
            return (
              <g key={pct}>
                <line
                  x1={0}
                  y1={y}
                  x2={SPARK_W * 2}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={4}
                  y={y - 3}
                  fontSize={10}
                  fill="rgba(255,255,255,0.25)"
                  fontFamily="monospace"
                >
                  {pct}%
                </text>
              </g>
            )
          })}

          {/* Render the full chart */}
          {(() => {
            const W = SPARK_W * 2
            const H = SPARK_H * 2
            const pointsByIndex: Record<number, { x: number; y: number }> = {}
            cat.weeks.forEach((w, i) => {
              if (w.forPct === -1) return
              const x = PAD + (i / (cat.weeks.length - 1)) * (W - PAD * 2)
              const pct = Math.max(5, Math.min(95, w.forPct))
              const y = H - PAD * 2 - ((pct - 5) / 90) * (H - PAD * 4)
              pointsByIndex[i] = { x, y }
            })

            const segmentGroups: Array<Array<{ x: number; y: number }>> = []
            let cur: Array<{ x: number; y: number }> = []
            cat.weeks.forEach((_, i) => {
              if (pointsByIndex[i]) {
                cur.push(pointsByIndex[i])
              } else if (cur.length > 0) {
                segmentGroups.push(cur)
                cur = []
              }
            })
            if (cur.length > 0) segmentGroups.push(cur)

            return segmentGroups.map((seg, gi) => {
              if (seg.length < 2) return null
              const pts = seg.map((p) => `${p.x},${p.y}`).join(' ')
              const fillPts = `${seg[0].x},${H} ${pts} ${seg[seg.length - 1].x},${H}`
              return (
                <g key={gi}>
                  <polygon points={fillPts} fill={cat.color} opacity={0.1} />
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {seg.map((p, pi) => (
                    <circle key={pi} cx={p.x} cy={p.y} r={4} fill={cat.color} opacity={0.9} />
                  ))}
                </g>
              )
            })
          })()}
        </svg>
      </div>

      {/* Week-by-week table */}
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {activeWeeks.map((w) => (
          <div
            key={w.week}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-200/40 hover:bg-surface-200/60 transition-colors"
          >
            <span className="text-[11px] font-mono text-surface-400">{w.weekLabel}</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-surface-500">{w.total} vote{w.total !== 1 ? 's' : ''}</span>
              <span
                className={cn(
                  'text-sm font-bold font-mono',
                  w.forPct >= 50 ? 'text-for-400' : 'text-against-400',
                )}
              >
                {w.forPct}% FOR
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ data }: { data: EvolutionResponse }) {
  const { summary, categories } = data

  const summaryItems = [
    summary.biggestGainer && summary.biggestGainer !== summary.biggestLoser
      ? {
          icon: TrendingUp,
          label: 'Drifting FOR',
          value: summary.biggestGainer,
          color: 'text-for-400',
          iconColor: 'text-for-400',
          bg: 'bg-for-500/10 border-for-500/20',
        }
      : null,
    summary.biggestLoser && summary.biggestLoser !== summary.biggestGainer
      ? {
          icon: TrendingDown,
          label: 'Drifting AGAINST',
          value: summary.biggestLoser,
          color: 'text-against-400',
          iconColor: 'text-against-400',
          bg: 'bg-against-500/10 border-against-500/20',
        }
      : null,
    summary.mostStable
      ? {
          icon: Scale,
          label: 'Most consistent',
          value: summary.mostStable,
          color: 'text-gold',
          iconColor: 'text-gold',
          bg: 'bg-gold/10 border-gold/20',
        }
      : null,
    summary.mostVolatile && summary.mostVolatile !== summary.mostStable
      ? {
          icon: Activity,
          label: 'Most unpredictable',
          value: summary.mostVolatile,
          color: 'text-purple',
          iconColor: 'text-purple',
          bg: 'bg-purple/10 border-purple/20',
        }
      : null,
  ].filter(Boolean) as Array<{
    icon: typeof TrendingUp
    label: string
    value: string
    color: string
    iconColor: string
    bg: string
  }>

  return (
    <div className="grid grid-cols-2 gap-2">
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className={cn('flex flex-col gap-1 rounded-xl border p-3', item.bg)}
        >
          <div className={cn('flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider', item.iconColor)}>
            <item.icon className="h-3 w-3" />
            {item.label}
          </div>
          <p className={cn('text-sm font-bold font-mono', item.color)}>{item.value}</p>
        </div>
      ))}

      {/* Overall drift cell */}
      <div className="flex flex-col gap-1 rounded-xl border border-surface-300/40 bg-surface-200/30 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-500">
          <Zap className="h-3 w-3" />
          Overall drift
        </div>
        <p
          className={cn(
            'text-sm font-bold font-mono',
            summary.overallDrift > 2
              ? 'text-for-400'
              : summary.overallDrift < -2
              ? 'text-against-400'
              : 'text-surface-400',
          )}
        >
          {summary.overallDrift > 0 ? `+${summary.overallDrift}%` : `${summary.overallDrift}%`} FOR
        </p>
      </div>

      {/* Active categories cell */}
      <div className="flex flex-col gap-1 rounded-xl border border-surface-300/40 bg-surface-200/30 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-500">
          <BarChart2 className="h-3 w-3" />
          Categories tracked
        </div>
        <p className="text-sm font-bold font-mono text-white">{categories.length}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvolutionPage() {
  const router = useRouter()
  const [data, setData] = useState<EvolutionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Check auth first
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const res = await fetch('/api/analytics/evolution', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch evolution data')
      const json = await res.json() as EvolutionResponse
      setData(json)
    } catch {
      setError('Unable to load opinion evolution data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const selectedCat = data?.categories.find((c) => c.category === selectedCategory) ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to analytics
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-surface-200 border border-surface-300/60 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Opinion Evolution
              </h1>
              <p className="text-sm text-surface-500 mt-1 font-mono">
                How your voting tendencies have shifted across debate categories over 12 weeks
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="space-y-4">
            <EmptyState
              icon={Activity}
              title="Could not load evolution data"
              description={error}
              action={
                <button
                  onClick={load}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300/60 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              }
            />
          </div>
        )}

        {/* No data */}
        {!loading && !error && data && data.categories.length === 0 && (
          <EmptyState
            icon={BarChart2}
            title="Not enough votes yet"
            description="Cast at least 3 votes in any debate category over the last 12 weeks to see your opinion evolution."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 border border-for-500/50 text-sm font-mono text-white hover:bg-for-500 transition-colors"
              >
                Explore topics
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        )}

        {/* Content */}
        {!loading && !error && data && data.categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  12-Week Summary
                </h2>
                <div className="flex-1 h-px bg-surface-300/40" />
                <button
                  onClick={load}
                  className="text-surface-600 hover:text-surface-400 transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <SummaryBar data={data} />
            </div>

            {/* Category detail view */}
            <AnimatePresence>
              {selectedCat && (
                <DetailView
                  key={selectedCat.category}
                  cat={selectedCat}
                  onClose={() => setSelectedCategory(null)}
                />
              )}
            </AnimatePresence>

            {/* Category cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  By Category
                </h2>
                <div className="flex-1 h-px bg-surface-300/40" />
                <span className="text-[11px] font-mono text-surface-600">
                  tap to expand
                </span>
              </div>
              <div className="space-y-3">
                {data.categories.map((cat, i) => (
                  <motion.div
                    key={cat.category}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <CategoryCard
                      cat={cat}
                      isSelected={selectedCategory === cat.category}
                      onClick={() =>
                        setSelectedCategory((prev) =>
                          prev === cat.category ? null : cat.category,
                        )
                      }
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Links to deeper analytics */}
            <div className="rounded-2xl border border-surface-300/40 bg-surface-100/40 divide-y divide-surface-300/30">
              {[
                { href: '/analytics', label: 'Full analytics dashboard', icon: BarChart2 },
                { href: '/compass', label: 'Your civic compass (radar view)', icon: Activity },
                { href: '/positions', label: 'All your current positions', icon: Scale },
                { href: '/drift', label: 'Platform-wide opinion drift', icon: TrendingDown },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                  <span className="text-sm font-mono text-surface-400 flex-1">{label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
                </Link>
              ))}
            </div>

            {/* Explainer */}
            <div className="rounded-2xl border border-surface-300/30 bg-surface-100/30 p-4">
              <div className="flex items-start gap-2.5">
                <Loader2 className="h-4 w-4 text-surface-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                    How this works
                  </p>
                  <p className="text-xs font-mono text-surface-600 leading-relaxed">
                    Each week&apos;s FOR% is calculated from your votes cast in that 7-day window.
                    Weeks with no votes are shown as gaps. The drift indicator compares your last
                    2 active weeks against your 12-week average. A flip is counted whenever your
                    majority lean (FOR vs AGAINST) changed from one active week to the next.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
