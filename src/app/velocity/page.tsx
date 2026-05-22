'use client'

/**
 * /velocity — Civic Category Velocity
 *
 * Shows vote velocity across each civic category over the last 24 hours.
 * Each category gets a sparkline of hourly vote counts, a momentum
 * indicator, and key stats (last-hour votes, last-6h vs prior rate).
 *
 * Distinct from:
 *   /heatmap      — category × status topic count matrix
 *   /momentum     — per-topic vote velocity ranking
 *   /surge        — topics close to their support threshold
 *   /now          — platform-wide live dashboard
 *
 * This is the only page showing cross-category vote flow over time.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Cpu,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { VelocityResponse, CategoryVelocity, VelocityBucket } from '@/app/api/stats/velocity/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CFG: Record<string, {
  icon: typeof Globe
  stroke: string
  fill: string
  bg: string
  border: string
  text: string
}> = {
  Politics:    { icon: Landmark,      stroke: '#3b82f6', fill: 'rgba(59,130,246,0.12)',   bg: 'bg-for-500/10',    border: 'border-for-500/25',    text: 'text-for-400'   },
  Economics:   { icon: BarChart2,     stroke: '#f59e0b', fill: 'rgba(245,158,11,0.12)',   bg: 'bg-gold/10',       border: 'border-gold/25',       text: 'text-gold'      },
  Technology:  { icon: Cpu,           stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.12)',   bg: 'bg-purple/10',     border: 'border-purple/25',     text: 'text-purple'    },
  Science:     { icon: FlaskConical,  stroke: '#10b981', fill: 'rgba(16,185,129,0.12)',   bg: 'bg-emerald/10',    border: 'border-emerald/25',    text: 'text-emerald'   },
  Ethics:      { icon: Scale,         stroke: '#60a5fa', fill: 'rgba(96,165,250,0.12)',   bg: 'bg-for-400/10',    border: 'border-for-400/25',    text: 'text-for-300'   },
  Philosophy:  { icon: Globe,         stroke: '#a78bfa', fill: 'rgba(167,139,250,0.12)',  bg: 'bg-purple/10',     border: 'border-purple/25',     text: 'text-purple'    },
  Culture:     { icon: Music2,        stroke: '#f87171', fill: 'rgba(248,113,113,0.12)',  bg: 'bg-against-500/10',border: 'border-against-500/25',text: 'text-against-400'},
  Health:      { icon: Heart,         stroke: '#34d399', fill: 'rgba(52,211,153,0.12)',   bg: 'bg-emerald/10',    border: 'border-emerald/25',    text: 'text-emerald'   },
  Environment: { icon: Leaf,          stroke: '#6ee7b7', fill: 'rgba(110,231,183,0.12)',  bg: 'bg-emerald/10',    border: 'border-emerald/25',    text: 'text-emerald'   },
  Education:   { icon: GraduationCap, stroke: '#c084fc', fill: 'rgba(192,132,252,0.12)',  bg: 'bg-purple/10',     border: 'border-purple/25',     text: 'text-purple'    },
}

function getCfg(cat: string) {
  return CAT_CFG[cat] ?? {
    icon: Globe,
    stroke: '#6b7280',
    fill: 'rgba(107,114,128,0.12)',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    text: 'text-surface-400',
  }
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function CategorySparkline({
  buckets,
  stroke,
  width = 200,
  height = 48,
}: {
  buckets: VelocityBucket[]
  stroke: string
  width?: number
  height?: number
}) {
  const counts = buckets.map((b) => b.votes)
  const maxCount = Math.max(...counts, 1)
  const pad = 2

  const innerW = width - pad * 2
  const innerH = height - pad * 2

  function x(i: number) {
    return pad + (i / (counts.length - 1)) * innerW
  }
  function y(v: number) {
    return pad + innerH - (v / maxCount) * innerH
  }

  const linePts = counts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const linePath = `M${linePts.join('L')}`
  const areaPath = `${linePath}L${x(counts.length - 1).toFixed(1)},${(pad + innerH).toFixed(1)}L${pad},${(pad + innerH).toFixed(1)}Z`

  const gradId = `vel-grad-${stroke.replace('#', '')}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Highlight the last (most recent) bucket */}
      <circle
        cx={x(counts.length - 1)}
        cy={y(counts[counts.length - 1])}
        r="2.5"
        fill={stroke}
      />
    </svg>
  )
}

// ─── Momentum badge ───────────────────────────────────────────────────────────

function MomentumBadge({ momentum }: { momentum: number }) {
  if (momentum > 1.5) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald/10 text-emerald border border-emerald/25">
        <ArrowUpRight className="h-2.5 w-2.5" />
        {momentum.toFixed(1)}× surge
      </span>
    )
  }
  if (momentum > 1.1) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-for-500/10 text-for-400 border border-for-500/25">
        <TrendingUp className="h-2.5 w-2.5" />
        +{((momentum - 1) * 100).toFixed(0)}%
      </span>
    )
  }
  if (momentum < 0.67) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-against-500/10 text-against-400 border border-against-500/25">
        <TrendingDown className="h-2.5 w-2.5" />
        −{((1 - momentum) * 100).toFixed(0)}%
      </span>
    )
  }
  if (momentum < 0.9) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-300 text-surface-500 border border-surface-400">
        <ArrowDownRight className="h-2.5 w-2.5" />
        slowing
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-300 text-surface-500 border border-surface-400">
      <Minus className="h-2.5 w-2.5" />
      steady
    </span>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, rank }: { cat: CategoryVelocity; rank: number }) {
  const cfg = getCfg(cat.category)
  const Icon = cfg.icon
  const isTopCat = rank === 0

  const forPct = Math.round(cat.forPct24h)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl border p-4 transition-all',
        cfg.bg,
        cfg.border,
        isTopCat && 'ring-1',
        isTopCat && cfg.border,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0', cfg.bg, 'border', cfg.border)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className={cn('text-sm font-mono font-bold text-white')}>{cat.category}</h2>
              {isTopCat && (
                <span className="text-[9px] font-mono font-bold text-gold bg-gold/10 border border-gold/25 px-1.5 py-0.5 rounded">
                  HOTTEST
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-surface-500 truncate">
              {cat.topicCount} active topic{cat.topicCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <MomentumBadge momentum={cat.momentum} />
      </div>

      {/* Sparkline */}
      <div className="mb-3 overflow-hidden">
        <CategorySparkline
          buckets={cat.buckets}
          stroke={cfg.stroke}
          width={320}
          height={44}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-200 rounded-lg p-2 text-center">
          <div className="text-xs font-mono font-bold text-white tabular-nums">
            {cat.votesLast1h.toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500">last hr</div>
        </div>
        <div className="bg-surface-200 rounded-lg p-2 text-center">
          <div className="text-xs font-mono font-bold text-white tabular-nums">
            {cat.votesLast6h.toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500">last 6h</div>
        </div>
        <div className="bg-surface-200 rounded-lg p-2 text-center">
          <div className="text-xs font-mono font-bold text-white tabular-nums">
            {cat.totalVotes24h.toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500">24h total</div>
        </div>
      </div>

      {/* FOR/AGAINST bar */}
      {cat.totalVotes24h > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] font-mono text-for-400 w-7 text-right tabular-nums flex-shrink-0">
            {forPct}%
          </span>
          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums flex-shrink-0">
            {againstPct}%
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VelocitySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'votes24h' | 'momentum' | 'lastHour' | 'forPct'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'votes24h',  label: 'Most Active' },
  { key: 'lastHour',  label: 'Last Hour'   },
  { key: 'momentum',  label: 'Surging'     },
  { key: 'forPct',    label: 'Most FOR'    },
]

function sortCategories(cats: CategoryVelocity[], key: SortKey): CategoryVelocity[] {
  return [...cats].sort((a, b) => {
    switch (key) {
      case 'votes24h':  return b.totalVotes24h - a.totalVotes24h
      case 'lastHour':  return b.votesLast1h - a.votesLast1h
      case 'momentum':  return b.momentum - a.momentum
      case 'forPct':    return b.forPct24h - a.forPct24h
    }
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VelocityPage() {
  const [data, setData] = useState<VelocityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('votes24h')
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/stats/velocity', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load velocity data')
      const json = (await res.json()) as VelocityResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 5 minutes
    intervalRef.current = setInterval(() => load(), 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  const sorted = data ? sortCategories(data.categories, sort) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <Activity className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Velocity</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Vote flow by category · last 24 hours
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              aria-label="Refresh velocity data"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <p className="mt-4 text-sm font-mono text-surface-500 max-w-3xl leading-relaxed">
            How many votes are landing in each civic category, hour by hour.
            Tracks the platform&apos;s democratic pulse — which issues the community
            is engaging with most, and whether activity is surging or slowing.
          </p>
        </div>

        {/* ── Platform summary strip ───────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            <div className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center">
              <div className="text-lg font-mono font-bold text-white tabular-nums">
                {data.totalVotes24h.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500">platform votes 24h</div>
            </div>

            {data.peakCategory && (
              <div className={cn(
                'rounded-xl p-3 text-center border',
                getCfg(data.peakCategory).bg,
                getCfg(data.peakCategory).border,
              )}>
                <div className={cn('text-sm font-mono font-bold', getCfg(data.peakCategory).text)}>
                  {data.peakCategory}
                </div>
                <div className="text-[10px] font-mono text-surface-500">hottest category</div>
              </div>
            )}

            <div className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center">
              <div className="text-lg font-mono font-bold text-white tabular-nums">
                {data.peakHourVotes.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500">peak hour (any cat)</div>
            </div>

            <div className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center">
              <div className="text-lg font-mono font-bold text-for-400 tabular-nums">
                {sorted[0]?.totalVotes24h
                  ? Math.round((sorted[0].totalVotes24h / Math.max(1, data.totalVotes24h)) * 100)
                  : 0}%
              </div>
              <div className="text-[10px] font-mono text-surface-500">top-cat share</div>
            </div>
          </motion.div>
        )}

        {/* ── Sort controls ────────────────────────────────────────────── */}
        {!loading && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-xs font-mono text-surface-500 flex-shrink-0">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
                  sort === opt.key
                    ? 'bg-for-600 border border-for-500/40 text-white'
                    : 'bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
                )}
              >
                {opt.label}
              </button>
            ))}

            {data && (
              <span className="text-[10px] font-mono text-surface-600 ml-auto flex-shrink-0">
                Updated {new Date(data.generatedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })} UTC
              </span>
            )}
          </div>
        )}

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <VelocitySkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Zap className="h-8 w-8 text-against-500 mb-3" />
              <p className="text-sm font-mono text-surface-400">{error}</p>
              <button
                onClick={() => load()}
                className="mt-4 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sorted.map((cat, i) => (
                <CategoryCard key={cat.category} cat={cat} rank={i} />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-8 p-4 bg-surface-200 border border-surface-300 rounded-xl">
            <h3 className="text-xs font-mono font-semibold text-surface-400 mb-2">HOW TO READ THIS</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-surface-500">
              <div className="flex items-start gap-2">
                <Activity className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-surface-300">Sparkline</strong> — each of 24 bars is one hour. Height = votes in that hour. The rightmost point is the most recent.</span>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                <span><strong className="text-surface-300">Momentum</strong> — compares last-6h vote rate against the prior 18h. &gt;1.5× = surge; &lt;0.67 = slowing.</span>
              </div>
              <div className="flex items-start gap-2">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-surface-300">FOR/AGAINST bar</strong> — the aggregate vote split across all votes in the last 24h for that category.</span>
              </div>
              <div className="flex items-start gap-2">
                <ThumbsDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                <span><strong className="text-surface-300">Refreshes</strong> automatically every 5 minutes. Click Refresh for the latest pulse.</span>
              </div>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
