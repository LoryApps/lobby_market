'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  ChevronRight,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DriftMarket, DriftResponse, DriftTab } from '@/app/api/exchange/drift/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US')
}

function priceColor(price: number): string {
  if (price >= 75) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 25) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function priceBarClass(price: number): string {
  if (price >= 75) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 25) return 'bg-against-500'
  if (price <= 45) return 'bg-against-400'
  return 'bg-surface-400'
}

function consistencyLabel(r: number): { label: string; color: string } {
  if (r >= 0.85) return { label: 'Very Steady', color: 'text-emerald' }
  if (r >= 0.70) return { label: 'Steady', color: 'text-for-400' }
  if (r >= 0.55) return { label: 'Moderate', color: 'text-gold' }
  return { label: 'Erratic', color: 'text-surface-500' }
}

// ─── Mini Sparkline (inline SVG) ──────────────────────────────────────────────

function Sparkline({ prices, direction }: { prices: number[]; direction: 'up' | 'down' }) {
  if (prices.length < 2) return null
  const W = 72
  const H = 28
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W
    const y = H - ((p - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')
  const stroke = direction === 'up' ? '#3b82f6' : '#ef4444'

  return (
    <svg width={W} height={H} className="flex-shrink-0 overflow-visible">
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Last point dot */}
      {pts.length > 0 && (
        <circle
          cx={parseFloat(pts[pts.length - 1].split(',')[0])}
          cy={parseFloat(pts[pts.length - 1].split(',')[1])}
          r="2"
          fill={stroke}
        />
      )}
    </svg>
  )
}

// ─── Drift Row ────────────────────────────────────────────────────────────────

function DriftRow({ market, idx }: { market: DriftMarket; idx: number }) {
  const DirIcon = market.direction === 'up' ? ArrowUpRight : ArrowDownRight
  const dirColor = market.direction === 'up' ? 'text-for-400' : 'text-against-400'
  const dirBg = market.direction === 'up'
    ? 'bg-for-500/10 border-for-500/30'
    : 'bg-against-500/10 border-against-500/30'
  const cons = consistencyLabel(market.consistency)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, delay: Math.min(idx * 0.025, 0.35) }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/80 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-100 transition-all"
      >
        {/* Direction badge */}
        <div className={cn('flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center border', dirBg)}>
          <DirIcon className={cn('h-4 w-4', dirColor)} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Statement */}
          <p className="text-sm font-mono text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
            {market.statement}
          </p>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {market.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {market.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {market.snapshot_count} snapshots · {market.window_days}d window
            </span>
            <span className={cn('text-[10px] font-mono', cons.color)}>
              {cons.label} (R²={market.consistency.toFixed(2)})
            </span>
          </div>

          {/* Price change bar */}
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('text-[11px] font-mono tabular-nums font-medium', priceColor(market.start_price))}>
              {market.start_price.toFixed(1)}¢
            </span>
            <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden max-w-[120px]">
              <div
                className={cn('h-full rounded-full transition-all', priceBarClass(market.current_price))}
                style={{ width: `${market.current_price}%` }}
              />
            </div>
            <span className={cn('text-[11px] font-mono tabular-nums font-bold', priceColor(market.current_price))}>
              {market.current_price.toFixed(1)}¢
            </span>
            <span className={cn('text-[11px] font-mono tabular-nums font-medium ml-1', dirColor)}>
              {market.direction === 'up' ? '+' : ''}{market.drift_total.toFixed(1)}¢
            </span>
          </div>
        </div>

        {/* Right column: sparkline + drift rate */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <Sparkline prices={market.sparkline} direction={market.direction} />
          <div className="flex items-center gap-1">
            <span className={cn('text-[11px] font-mono font-bold tabular-nums', dirColor)}>
              {market.direction === 'up' ? '+' : ''}{market.drift_per_day.toFixed(2)}¢/d
            </span>
          </div>
          <span className="text-[10px] font-mono text-surface-600">
            {formatVolume(market.volume)} vol
          </span>
        </div>

        {/* Chevron */}
        <ChevronRight className="flex-shrink-0 self-center h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function DriftRowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/80 border border-surface-300/60">
      <Skeleton className="flex-shrink-0 h-8 w-8 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
        <Skeleton className="h-1.5 w-32 rounded-full" />
      </div>
      <div className="flex-shrink-0 space-y-1">
        <Skeleton className="h-7 w-18 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
      </div>
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: DriftTab; label: string; icon: typeof TrendingUp; color: string }[] = [
  { id: 'all',           label: 'All Markets',    icon: Activity,      color: 'text-surface-400' },
  { id: 'toward_law',    label: 'Toward Law',     icon: TrendingUp,    color: 'text-for-400' },
  { id: 'away_from_law', label: 'Away from Law',  icon: TrendingDown,  color: 'text-against-400' },
]

const WINDOWS = [
  { days: 7,  label: '7d'  },
  { days: 14, label: '14d' },
  { days: 21, label: '21d' },
  { days: 30, label: '30d' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function DriftClient() {
  const [data, setData] = useState<DriftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DriftTab>('toward_law')
  const [windowDays, setWindowDays] = useState(14)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (days: number, showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/exchange/drift?days=${days}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: DriftResponse = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(windowDays)
  }, [load, windowDays])

  const markets = !data
    ? []
    : tab === 'toward_law'
      ? data.toward_law
      : tab === 'away_from_law'
        ? data.away_from_law
        : [...data.toward_law, ...data.away_from_law].sort((a, b) => b.drift_score - a.drift_score)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/exchange"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
                <Activity className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white leading-none">
                  Consensus Drift
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Sustained, steady movements over time
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => load(windowDays, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 border border-surface-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Explainer ─────────────────────────────────────────────── */}
        <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex items-start gap-3">
          <BarChart2 className="flex-shrink-0 h-4 w-4 text-surface-500 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Drift shows markets moving in a <span className="text-white">consistent direction</span> over
            the selected window — not sudden crossings, but steady, compounding shifts.
            Consistency (R²) measures how linear the drift is: higher means fewer reversals.
          </p>
        </div>

        {/* ── Window picker ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-surface-600 mr-1 uppercase tracking-wider">Window:</span>
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={cn(
                'h-7 px-3 rounded-lg text-xs font-mono font-medium border transition-colors',
                windowDays === w.days
                  ? 'bg-for-500/20 text-for-300 border-for-500/50'
                  : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
              )}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(({ id, label, icon: Icon, color }) => {
            const count = !data
              ? 0
              : id === 'toward_law'
                ? data.toward_law.length
                : id === 'away_from_law'
                  ? data.away_from_law.length
                  : data.toward_law.length + data.away_from_law.length
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-mono font-medium border transition-all',
                  tab === id
                    ? 'bg-surface-200 text-white border-surface-400'
                    : 'text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', tab === id ? color : 'text-surface-600')} />
                {label}
                {!loading && data && (
                  <span className={cn('text-[10px] font-mono ml-0.5', tab === id ? 'text-surface-400' : 'text-surface-600')}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Stats strip ───────────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Toward Law',
                value: data.toward_law.length,
                icon: TrendingUp,
                color: 'text-for-400',
                bg: 'bg-for-500/10',
              },
              {
                label: 'Away from Law',
                value: data.away_from_law.length,
                icon: TrendingDown,
                color: 'text-against-400',
                bg: 'bg-against-500/10',
              },
              {
                label: 'Window',
                value: `${windowDays}d`,
                icon: Zap,
                color: 'text-gold',
                bg: 'bg-gold/10',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="rounded-xl border border-surface-300/60 bg-surface-100/80 p-3 flex flex-col items-center text-center gap-1"
              >
                <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <span className="font-mono font-bold text-lg text-white leading-none">{value}</span>
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── List ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <DriftRowSkeleton key={i} />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No drift detected"
            description="No markets are showing sustained consensus movement over this window. Try a longer time range or check back later as more data accumulates."
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {markets.map((m, idx) => (
                <DriftRow key={`${m.id}-${tab}`} market={m} idx={idx} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Footer note ───────────────────────────────────────────── */}
        {data && !loading && markets.length > 0 && (
          <p className="text-center text-[11px] font-mono text-surface-600 pb-4">
            Drift rate based on linear regression of{' '}
            <span className="text-surface-500">topic_price_history</span> snapshots.
            Consistency (R²) ≥ 0.45 required.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
