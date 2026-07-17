'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Gavel,
  GitMerge,
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
import type {
  CrossingsResponse,
  ThresholdCrossing,
  CrossingThreshold,
  CrossingDirection,
} from '@/app/api/exchange/crossings/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Threshold colour helpers ─────────────────────────────────────────────────

function thresholdColor(threshold: CrossingThreshold, direction: CrossingDirection) {
  if (threshold === 75 && direction === 'up') return { badge: 'text-gold bg-gold/10 border-gold/30', bar: 'bg-gold' }
  if (threshold === 75 && direction === 'down') return { badge: 'text-against-400 bg-against-500/10 border-against-500/30', bar: 'bg-against-500' }
  if (threshold === 50 && direction === 'up') return { badge: 'text-emerald bg-emerald/10 border-emerald/30', bar: 'bg-emerald' }
  if (threshold === 50 && direction === 'down') return { badge: 'text-against-300 bg-against-500/10 border-against-500/20', bar: 'bg-against-400' }
  if (threshold === 25 && direction === 'up') return { badge: 'text-for-400 bg-for-500/10 border-for-500/30', bar: 'bg-for-500' }
  return { badge: 'text-surface-400 bg-surface-200 border-surface-400', bar: 'bg-surface-500' }
}

function priceBarColor(price: number): string {
  if (price >= 75) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 25) return 'bg-against-500'
  if (price <= 45) return 'bg-against-400'
  return 'bg-surface-400'
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type FilterId = 'all' | 'law' | 'majority' | 'dissent'

const FILTERS: { id: FilterId; label: string; icon: typeof TrendingUp; color: string }[] = [
  { id: 'all',      label: 'All',           icon: GitMerge,     color: 'text-surface-400' },
  { id: 'law',      label: 'Law Threshold', icon: Scale,        color: 'text-gold' },
  { id: 'majority', label: 'Majority',      icon: TrendingUp,   color: 'text-emerald' },
  { id: 'dissent',  label: 'Dissent',       icon: TrendingDown, color: 'text-against-400' },
]

function matchesFilter(c: ThresholdCrossing, filter: FilterId): boolean {
  if (filter === 'all') return true
  if (filter === 'law') return c.threshold === 75
  if (filter === 'majority') return c.threshold === 50
  return c.threshold === 25
}

// ─── Window options ───────────────────────────────────────────────────────────

const WINDOWS = [
  { days: 1, label: '24h' },
  { days: 3, label: '3d' },
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
]

// ─── Crossing Row ─────────────────────────────────────────────────────────────

function CrossingRow({ crossing, idx }: { crossing: ThresholdCrossing; idx: number }) {
  const colors = thresholdColor(crossing.threshold, crossing.direction)
  const DirIcon = crossing.direction === 'up' ? ArrowUpRight : ArrowDownRight

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.4) }}
    >
      <Link
        href={`/exchange/${crossing.id}`}
        className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/80 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-100 transition-all"
      >
        {/* Direction icon */}
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center',
            colors.badge,
            'border',
          )}
        >
          <DirIcon className="h-4 w-4" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
            {crossing.statement}
          </p>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {crossing.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                {crossing.category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono font-semibold', colors.badge, 'border px-1.5 py-0.5 rounded-md')}>
              {crossing.label}
            </span>
          </div>

          {/* Current price bar */}
          <div className="mt-2 h-1 w-full bg-surface-300 rounded-full overflow-hidden relative">
            {/* Threshold marker */}
            <div
              className="absolute top-0 w-px h-full bg-surface-400/60 z-10"
              style={{ left: `${crossing.threshold}%` }}
            />
            <div
              className={cn('h-full rounded-full transition-all', priceBarColor(crossing.current_price))}
              style={{ width: `${crossing.current_price}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-white">
              {crossing.current_price}¢ now
            </span>
            <span className="text-[10px] text-surface-500">
              {crossing.price_before}¢ → {crossing.price_after}¢ at crossing
            </span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-surface-500 font-mono">
              <Clock className="h-2.5 w-2.5" />
              {relTime(crossing.crossed_at)}
            </span>
          </div>
        </div>

        {/* Threshold badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-1 rounded-lg border',
              colors.badge,
            )}
          >
            {crossing.threshold}¢
          </span>
          <span className="text-[10px] font-mono text-surface-600">
            {formatVolume(crossing.volume)} vol
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CrossingSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/80 border border-surface-300/60">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-1 w-full rounded-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex-shrink-0 space-y-1">
        <Skeleton className="h-6 w-10 rounded-lg" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CrossingsClient() {
  const [data, setData] = useState<CrossingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterId>('all')
  const [windowDays, setWindowDays] = useState(7)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exchange/crossings?days=${windowDays}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: CrossingsResponse = await res.json()
      setData(json)
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
    }
  }, [windowDays])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const filtered = (data?.crossings ?? []).filter((c) => matchesFilter(c, filter))

  // Counts per filter for badges
  const counts: Record<FilterId, number> = {
    all: data?.crossings.length ?? 0,
    law: data?.crossings.filter((c) => c.threshold === 75).length ?? 0,
    majority: data?.crossings.filter((c) => c.threshold === 50).length ?? 0,
    dissent: data?.crossings.filter((c) => c.threshold === 25).length ?? 0,
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/exchange"
                className="text-surface-500 hover:text-white transition-colors"
                aria-label="Back to Exchange"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <GitMerge className="h-5 w-5 text-gold" aria-hidden="true" />
              <h1 className="text-xl font-bold text-white">Crossings</h1>
            </div>
            <p className="text-sm text-surface-500">
              Markets that recently crossed key consensus thresholds
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/exchange/movers"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-xs font-medium text-surface-500 hover:text-white transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Movers
            </Link>
            <Link
              href="/exchange/near-law"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 text-xs font-medium text-surface-500 hover:text-gold transition-colors"
            >
              <Gavel className="h-3.5 w-3.5" />
              Near Law
            </Link>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              aria-label="Refresh crossings"
              className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Last updated */}
        {data?.as_of && (
          <p className="text-[11px] text-surface-600 mb-4 font-mono">
            Updated {relTime(data.as_of)} · {windowDays}d window
          </p>
        )}

        {/* Window selector */}
        <div className="flex gap-1.5 mb-4">
          {WINDOWS.map(({ days, label }) => (
            <button
              key={days}
              onClick={() => setWindowDays(days)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                windowDays === days
                  ? 'bg-surface-200 text-white border-surface-400'
                  : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all border',
                filter === id
                  ? 'bg-surface-200 text-white border-surface-400'
                  : 'text-surface-500 border-transparent hover:text-white hover:border-surface-300',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', filter === id ? color : '')} aria-hidden="true" />
              {label}
              {counts[id] > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-mono px-1 rounded',
                    filter === id ? 'text-white/60' : 'text-surface-600',
                  )}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <CrossingSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No crossings found"
            description={
              filter === 'all'
                ? `No markets crossed a key threshold in the last ${windowDays} day${windowDays === 1 ? '' : 's'}. Try a wider window.`
                : `No markets crossed the ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} threshold recently. Try a wider window.`
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((crossing, i) => (
                <CrossingRow key={`${crossing.id}:${crossing.threshold}:${crossing.direction}`} crossing={crossing} idx={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 rounded-xl bg-surface-100/60 border border-surface-300/40 space-y-3">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Key thresholds</p>
          <div className="space-y-2">
            {[
              { threshold: 75, up: 'Approaching Law', down: 'Slipping from Law', color: 'text-gold', barColor: 'bg-gold' },
              { threshold: 50, up: 'Majority Gained', down: 'Majority Lost', color: 'text-emerald', barColor: 'bg-emerald' },
              { threshold: 25, up: 'Recovering Consensus', down: 'Deep Dissent', color: 'text-against-400', barColor: 'bg-against-500' },
            ].map(({ threshold, up, down, color, barColor }) => (
              <div key={threshold} className="flex items-center gap-3">
                <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', barColor)} />
                <span className={cn('text-[11px] font-mono font-semibold w-6 flex-shrink-0', color)}>{threshold}¢</span>
                <span className="text-[11px] text-surface-500">
                  ↑ {up} · ↓ {down}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-surface-600 pt-1">
            Price = % FOR consensus (0–100¢). Snapshots recorded every 20 votes.
          </p>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all markets
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
