'use client'

/**
 * /drift — Opinion Drift
 *
 * Shows how civic consensus has shifted across debate categories over time.
 * Each category card displays the weighted FOR% across four time windows
 * (7d / 30d / 90d / all-time) and an indicator of the current drift direction.
 *
 * "Drift" = 7-day weighted FOR% minus all-time FOR%.
 * Positive drift → opinion trending more FOR lately.
 * Negative drift → trending more AGAINST lately.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Cpu,
  FlaskConical,
  Flame,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategoryDrift, DriftResponse, DriftWindow } from '@/app/api/stats/drift/route'

// ─── Category config ───────────────────────────────────────────────────────────

interface CatConfig {
  icon: typeof Flame
  color: string
  bg: string
  border: string
  barFor: string
  barAgainst: string
}

const CAT_CONFIG: Record<string, CatConfig> = {
  Economics:   { icon: BarChart2,    color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/20',          barFor: 'bg-gold',         barAgainst: 'bg-gold/30' },
  Politics:    { icon: Landmark,     color: 'text-for-400',      bg: 'bg-for-500/10',        border: 'border-for-500/20',        barFor: 'bg-for-500',      barAgainst: 'bg-against-500' },
  Technology:  { icon: Cpu,          color: 'text-purple',       bg: 'bg-purple/10',         border: 'border-purple/20',         barFor: 'bg-purple',       barAgainst: 'bg-purple/30' },
  Science:     { icon: FlaskConical, color: 'text-emerald',      bg: 'bg-emerald/10',        border: 'border-emerald/20',        barFor: 'bg-emerald',      barAgainst: 'bg-emerald/30' },
  Ethics:      { icon: Scale,        color: 'text-against-300',  bg: 'bg-against-500/10',    border: 'border-against-500/20',    barFor: 'bg-for-500',      barAgainst: 'bg-against-500' },
  Philosophy:  { icon: Activity,     color: 'text-for-300',      bg: 'bg-for-400/10',        border: 'border-for-400/20',        barFor: 'bg-for-400',      barAgainst: 'bg-against-400' },
  Culture:     { icon: Music2,       color: 'text-gold',         bg: 'bg-gold/10',           border: 'border-gold/20',           barFor: 'bg-gold',         barAgainst: 'bg-gold/20' },
  Health:      { icon: Heart,        color: 'text-against-300',  bg: 'bg-against-400/10',    border: 'border-against-400/20',    barFor: 'bg-for-500',      barAgainst: 'bg-against-400' },
  Environment: { icon: Leaf,         color: 'text-emerald',      bg: 'bg-emerald/10',        border: 'border-emerald/20',        barFor: 'bg-emerald',      barAgainst: 'bg-emerald/20' },
  Education:   { icon: GraduationCap,color: 'text-purple',       bg: 'bg-purple/10',         border: 'border-purple/20',         barFor: 'bg-purple',       barAgainst: 'bg-purple/20' },
}

const DEFAULT_CAT: CatConfig = {
  icon: BarChart2,
  color: 'text-surface-400',
  bg: 'bg-surface-300/10',
  border: 'border-surface-300/20',
  barFor: 'bg-for-500',
  barAgainst: 'bg-against-500',
}

function catCfg(cat: string): CatConfig {
  return CAT_CONFIG[cat] ?? DEFAULT_CAT
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function driftLabel(d: number, dir: CategoryDrift['drift_direction']): string {
  if (dir === 'stable' || d === 0) return 'Stable'
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}% 7d drift`
}

// ─── Sparkline (SVG mini-chart) ───────────────────────────────────────────────

function Sparkline({
  windows,
  color,
}: {
  windows: DriftWindow[]
  color: string
}) {
  // Show 7d, 30d, 90d, all in chronological order (all → 90d → 30d → 7d)
  const ordered = ['all', '90d', '30d', '7d'] as const
  const points = ordered
    .map((p) => windows.find((w) => w.period === p))
    .filter(Boolean) as DriftWindow[]

  if (points.length < 2) return null

  const W = 120
  const H = 36
  const padding = 4

  const values = points.map((p) => p.avg_for_pct)
  const min = Math.max(0, Math.min(...values) - 5)
  const max = Math.min(100, Math.max(...values) + 5)
  const range = max - min || 1

  const coords = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (W - padding * 2)
    const y = H - padding - ((v - min) / range) * (H - padding * 2)
    return `${x},${y}`
  })

  const pathD = `M ${coords.join(' L ')}`
  const areaD = `M ${coords[0]} L ${coords.join(' L ')} L ${W - padding},${H - padding} L ${padding},${H - padding} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9" aria-hidden="true">
      {/* midline at 50% */}
      <line
        x1={padding}
        y1={H - padding - ((50 - min) / range) * (H - padding * 2)}
        x2={W - padding}
        y2={H - padding - ((50 - min) / range) * (H - padding * 2)}
        stroke="currentColor"
        strokeWidth="0.5"
        strokeDasharray="2 2"
        className="text-surface-500/40"
      />
      <path d={areaD} className="fill-current opacity-10" style={{ color: color.replace('text-', '') }} />
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.5" className={color} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => {
        const [x, y] = c.split(',').map(Number)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            className={cn('fill-current', color)}
          />
        )
      })}
    </svg>
  )
}

// ─── Window bars ──────────────────────────────────────────────────────────────

const WINDOW_ORDER = ['7d', '30d', '90d', 'all'] as const

function WindowBars({ windows, cfg }: { windows: DriftWindow[]; cfg: CatConfig }) {
  return (
    <div className="space-y-1.5">
      {WINDOW_ORDER.map((period) => {
        const w = windows.find((x) => x.period === period)
        if (!w) return null
        const forPct = Math.round(w.avg_for_pct)
        const againstPct = 100 - forPct

        const labels: Record<typeof period, string> = {
          '7d': '7d',
          '30d': '30d',
          '90d': '90d',
          'all': 'All',
        }

        return (
          <div key={period} className="flex items-center gap-2">
            <span className="w-7 text-right font-mono text-[10px] text-surface-500 flex-shrink-0">
              {labels[period]}
            </span>
            <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-surface-300/30">
              <div
                className={cn('h-full rounded-l-full transition-all', cfg.barFor)}
                style={{ width: `${forPct}%` }}
              />
              <div
                className={cn('h-full rounded-r-full transition-all', cfg.barAgainst, 'opacity-40')}
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <span className="w-8 font-mono text-[10px] text-for-400 flex-shrink-0">
              {forPct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Drift badge ──────────────────────────────────────────────────────────────

function DriftBadge({ drift, direction }: { drift: number; direction: CategoryDrift['drift_direction'] }) {
  if (direction === 'stable') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-300/30 text-surface-500">
        <Minus className="h-2.5 w-2.5" />
        stable
      </span>
    )
  }

  if (direction === 'toward_for') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-for-500/15 text-for-400 border border-for-500/20">
        <ArrowUp className="h-2.5 w-2.5" />
        +{Math.abs(drift).toFixed(1)}%
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-against-500/15 text-against-400 border border-against-500/20">
      <ArrowDown className="h-2.5 w-2.5" />
      -{Math.abs(drift).toFixed(1)}%
    </span>
  )
}

// ─── Category Drift Card ──────────────────────────────────────────────────────

function DriftCard({ cat }: { cat: CategoryDrift }) {
  const cfg = catCfg(cat.category)
  const Icon = cfg.icon
  const allTimeW = cat.windows.find((w) => w.period === 'all')
  const sevenDayW = cat.windows.find((w) => w.period === '7d')

  const allTimePct = Math.round(allTimeW?.avg_for_pct ?? 50)
  const sevenDayPct = sevenDayW && sevenDayW.vote_count >= 5
    ? Math.round(sevenDayW.avg_for_pct)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-4 flex flex-col gap-3',
        'bg-surface-100 hover:bg-surface-200/60 transition-colors',
        cfg.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border', cfg.bg, cfg.border)}>
          <Icon className={cn('h-4.5 w-4.5', cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-mono text-sm font-bold', cfg.color)}>
              {cat.category}
            </span>
            <DriftBadge drift={cat.drift} direction={cat.drift_direction} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-surface-500">
            <span>{fmtVotes(cat.total_votes)} votes</span>
            <span className="text-surface-600">·</span>
            <span>{cat.total_topics} topics</span>
            <span className="text-surface-600">·</span>
            <span className="text-gold">{cat.law_rate}% law rate</span>
          </div>
        </div>

        <Link
          href={`/categories/${cat.category.toLowerCase()}`}
          className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300/40 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
          aria-label={`Browse ${cat.category} topics`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Sparkline */}
      <div className="relative">
        <Sparkline windows={cat.windows} color={cfg.color} />
      </div>

      {/* Current FOR% big number + 7d comparison */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('font-mono text-2xl font-bold', allTimePct >= 50 ? 'text-for-400' : 'text-against-400')}>
              {allTimePct}%
            </span>
            <span className="font-mono text-xs text-surface-500">all-time FOR</span>
          </div>
          {sevenDayPct !== null && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="font-mono text-[11px] text-surface-500">7d avg:</span>
              <span className={cn(
                'font-mono text-[11px] font-semibold',
                sevenDayPct >= 50 ? 'text-for-400' : 'text-against-400'
              )}>
                {sevenDayPct}% FOR
              </span>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            {cat.drift_direction === 'toward_for' ? (
              <TrendingUp className="h-4 w-4 text-for-400" />
            ) : cat.drift_direction === 'toward_against' ? (
              <TrendingDown className="h-4 w-4 text-against-400" />
            ) : (
              <Minus className="h-4 w-4 text-surface-500" />
            )}
            <span className={cn(
              'font-mono text-xs font-semibold',
              cat.drift_direction === 'toward_for' ? 'text-for-400' :
              cat.drift_direction === 'toward_against' ? 'text-against-400' :
              'text-surface-500'
            )}>
              {driftLabel(cat.drift, cat.drift_direction)}
            </span>
          </div>
          <div className="text-[10px] font-mono text-surface-600 mt-0.5">
            vs all-time avg
          </div>
        </div>
      </div>

      {/* Window bars */}
      <div className="border-t border-surface-300/50 pt-3">
        <WindowBars windows={cat.windows} cfg={cfg} />
      </div>
    </motion.div>
  )
}

// ─── Sort options ──────────────────────────────────────────────────────────────

type SortBy = 'votes' | 'for_pct' | 'drift_up' | 'drift_down' | 'law_rate'

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'votes',      label: 'Most Active' },
  { id: 'for_pct',    label: 'Most FOR' },
  { id: 'drift_up',   label: 'Drifting FOR' },
  { id: 'drift_down', label: 'Drifting AGAINST' },
  { id: 'law_rate',   label: 'Law Rate' },
]

function sortCats(cats: CategoryDrift[], sort: SortBy): CategoryDrift[] {
  return [...cats].sort((a, b) => {
    switch (sort) {
      case 'votes':      return b.total_votes - a.total_votes
      case 'for_pct': {
        const aF = a.windows.find((w) => w.period === 'all')?.avg_for_pct ?? 50
        const bF = b.windows.find((w) => w.period === 'all')?.avg_for_pct ?? 50
        return bF - aF
      }
      case 'drift_up':   return b.drift - a.drift
      case 'drift_down': return a.drift - b.drift
      case 'law_rate':   return b.law_rate - a.law_rate
      default:           return 0
    }
  })
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryBar({ categories }: { categories: CategoryDrift[] }) {
  const surging = categories.filter((c) => c.drift_direction === 'toward_for')
  const declining = categories.filter((c) => c.drift_direction === 'toward_against')
  const stable = categories.filter((c) => c.drift_direction === 'stable')
  const totalVotes = categories.reduce((s, c) => s + c.total_votes, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total votes tracked', value: fmtVotes(totalVotes), color: 'text-white' },
        { label: 'Trending FOR', value: `${surging.length} categories`, color: 'text-for-400' },
        { label: 'Trending AGAINST', value: `${declining.length} categories`, color: 'text-against-400' },
        { label: 'Stable', value: `${stable.length} categories`, color: 'text-surface-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
          <div className={cn('font-mono text-base font-bold', color)}>{value}</div>
          <div className="font-mono text-[11px] text-surface-500 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriftPage() {
  const [data, setData] = useState<DriftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sort, setSort] = useState<SortBy>('votes')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stats/drift', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as DriftResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sorted = data ? sortCats(data.categories, sort) : []

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/signals"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-for-400" />
              Opinion Drift
            </h1>
            <p className="font-mono text-xs text-surface-500 mt-0.5">
              How civic consensus is shifting across debate categories — 7d vs all-time
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh drift data"
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Sort pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {SORT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs font-semibold border transition-all',
                sort === id
                  ? 'bg-for-600/30 text-for-300 border-for-500/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[0,1,2,3].map(i => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28 rounded" />
                      <Skeleton className="h-3 w-40 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-full rounded" />
                  <Skeleton className="h-20 w-full rounded" />
                </div>
              ))}
            </div>
          </>
        ) : error ? (
          <EmptyState
            icon={Activity}
            title="Couldn't load drift data"
            description="The opinion drift calculation hit a snag. Try refreshing."
            action={<button onClick={() => load()} className="px-4 py-2 rounded-lg bg-for-600/30 text-for-300 font-mono text-sm border border-for-500/30 hover:bg-for-600/40 transition-colors">Retry</button>}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div key={sort} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <SummaryBar categories={data.categories} />

              {/* Drift legend */}
              <div className="flex items-center gap-4 mb-4 text-[11px] font-mono text-surface-500">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-for-500" />
                  <span>FOR %</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-against-500 opacity-40" />
                  <span>AGAINST %</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                  <span>Trending FOR in last 7 days</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-against-400" />
                  <span>Trending AGAINST</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {sorted.map((cat) => (
                  <DriftCard key={cat.category} cat={cat} />
                ))}
              </div>

              {/* Footer */}
              <div className="mt-8 text-center space-y-2">
                <p className="font-mono text-xs text-surface-600">
                  Drift = 7-day weighted FOR% minus all-time FOR% per category.
                  Requires ≥5 votes in the 7-day window to show drift.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs font-mono">
                  <Link href="/signals" className="text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> Signals
                  </Link>
                  <Link href="/shifts" className="text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                    <ArrowRight className="h-3.5 w-3.5" /> Shifts
                  </Link>
                  <Link href="/momentum" className="text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" /> Momentum
                  </Link>
                  <Link href="/spectrum" className="text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                    <Scale className="h-3.5 w-3.5" /> Spectrum
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
