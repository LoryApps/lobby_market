'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  Filter,
  Flame,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LiveSignal, StrategyResponse, StrategyDirection } from '@/app/api/exchange/strategy/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTIONS: { id: StrategyDirection; label: string; desc: string; color: string }[] = [
  { id: 'momentum',   label: 'Momentum',   desc: 'Follow the crowd',     color: 'text-gold'         },
  { id: 'contrarian', label: 'Contrarian', desc: 'Bet against the crowd', color: 'text-against-400'  },
  { id: 'for',        label: 'Always For', desc: 'Buy every market',      color: 'text-for-400'      },
  { id: 'against',    label: 'Always Against', desc: 'Short every market', color: 'text-purple'      },
]

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const VOLUME_OPTIONS = [
  { value: 0,    label: 'Any'    },
  { value: 10,   label: '10+'   },
  { value: 50,   label: '50+'   },
  { value: 100,  label: '100+'  },
  { value: 500,  label: '500+'  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pnlColor(pnl: number) {
  if (pnl > 0)  return 'text-emerald'
  if (pnl < 0)  return 'text-against-400'
  return 'text-surface-500'
}

function pnlSign(pnl: number) {
  if (pnl > 0) return '+'
  return ''
}

function strengthDot(s: LiveSignal['signal_strength']) {
  if (s === 'strong')   return 'bg-emerald'
  if (s === 'moderate') return 'bg-gold'
  return 'bg-surface-500'
}

function strengthLabel(s: LiveSignal['signal_strength']) {
  if (s === 'strong')   return 'Strong'
  if (s === 'moderate') return 'Moderate'
  return 'Weak'
}

function formatPrice(p: number) {
  return `${p}%`
}

function statusBadge(status: string) {
  if (status === 'voting') return { label: 'VOTING', cls: 'bg-purple/20 text-purple border-purple/30' }
  if (status === 'active') return { label: 'ACTIVE', cls: 'bg-for-500/20 text-for-400 border-for-500/30' }
  return { label: 'PROPOSED', cls: 'bg-surface-300/60 text-surface-500 border-surface-400/30' }
}

// ─── SignalRow ────────────────────────────────────────────────────────────────

function SignalRow({ signal, idx }: { signal: LiveSignal; idx: number }) {
  const badge = statusBadge(signal.status)
  const pnlPos = signal.unrealized_pnl >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.4) }}
    >
      <Link
        href={`/topic/${signal.topic_id}`}
        className={cn(
          'block rounded-xl border p-4 transition-all duration-150',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/80',
        )}
      >
        {/* Top row: status + strength + direction */}
        <div className="flex items-start gap-2 mb-2">
          <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border', badge.cls)}>
            {badge.label}
          </span>
          {signal.category && (
            <span className="text-[10px] font-mono text-surface-500 shrink-0">{signal.category}</span>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* Direction pill */}
            <span className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
              signal.direction === 'for'
                ? 'bg-for-500/10 text-for-400 border-for-500/30'
                : 'bg-against-500/10 text-against-400 border-against-500/30',
            )}>
              {signal.direction === 'for' ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {signal.direction === 'for' ? 'FOR' : 'AGAINST'}
            </span>

            {/* Signal strength */}
            <div className="flex items-center gap-1">
              <div className={cn('h-1.5 w-1.5 rounded-full', strengthDot(signal.signal_strength))} />
              <span className="text-[10px] font-mono text-surface-500">{strengthLabel(signal.signal_strength)}</span>
            </div>
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm text-white font-medium leading-snug mb-3 line-clamp-2">
          {signal.statement}
        </p>

        {/* Price row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Entry price */}
          <div>
            <p className="text-[10px] font-mono text-surface-500 mb-0.5">Entry</p>
            <p className="text-sm font-mono font-bold text-surface-300">{formatPrice(signal.entry_price)}</p>
          </div>

          {/* Current price */}
          <div>
            <p className="text-[10px] font-mono text-surface-500 mb-0.5">Current</p>
            <p className="text-sm font-mono font-bold text-white">{formatPrice(signal.current_price)}</p>
          </div>

          {/* Unrealized PnL */}
          <div className="text-right">
            <p className="text-[10px] font-mono text-surface-500 mb-0.5">Unrealized</p>
            <div className={cn('flex items-center justify-end gap-0.5 text-sm font-mono font-bold', pnlColor(signal.unrealized_pnl))}>
              {pnlPos
                ? <ArrowUpRight className="h-3.5 w-3.5" />
                : signal.unrealized_pnl < 0
                  ? <ArrowDownRight className="h-3.5 w-3.5" />
                  : <Minus className="h-3.5 w-3.5" />
              }
              {pnlSign(signal.unrealized_pnl)}{signal.unrealized_pnl.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Volume bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-for-500/50 rounded-full"
              style={{ width: `${signal.current_price}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 shrink-0">
            {signal.total_votes.toLocaleString()} votes
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueClass,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  icon: typeof Activity
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-surface-500" />
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={cn('text-xl font-mono font-bold text-white', valueClass)}>{value}</p>
      {sub && <p className="text-xs font-mono text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── StrategyClient ───────────────────────────────────────────────────────────

export function StrategyClient() {
  const [direction, setDirection] = useState<StrategyDirection>('momentum')
  const [category, setCategory] = useState<string | null>(null)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(100)
  const [minVolume, setMinVolume] = useState(0)
  const [data, setData] = useState<StrategyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    try {
      const params = new URLSearchParams({
        direction,
        min_price: String(minPrice),
        max_price: String(maxPrice),
        min_volume: String(minVolume),
      })
      if (category) params.set('category', category)

      const res = await fetch(`/api/exchange/strategy?${params}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as StrategyResponse
      setData(json)
      setLastRefreshed(new Date())
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [direction, category, minPrice, maxPrice, minVolume])

  useEffect(() => {
    fetch_()
  }, [fetch_])

  const activeDir = DIRECTIONS.find((d) => d.id === direction)!
  const stats = data?.stats

  // Split: best performers first (already sorted), then worst at bottom
  const gainers = data?.signals.filter((s) => s.unrealized_pnl > 0) ?? []
  const flat    = data?.signals.filter((s) => s.unrealized_pnl === 0) ?? []
  const losers  = [...(data?.signals.filter((s) => s.unrealized_pnl < 0) ?? [])].reverse()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-mono font-bold text-white">Strategy Monitor</h1>
            <p className="text-xs font-mono text-surface-500">Live signals from your configured strategy</p>
          </div>
          <button
            onClick={fetch_}
            disabled={loading}
            aria-label="Refresh signals"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Strategy selector */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-surface-500" />
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Strategy</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDirection(d.id)}
                aria-pressed={direction === d.id}
                className={cn(
                  'rounded-xl p-3 text-left border transition-all duration-150',
                  direction === d.id
                    ? 'bg-surface-200 border-surface-400'
                    : 'bg-surface-100 border-surface-300 hover:border-surface-400',
                )}
              >
                <p className={cn('text-xs font-mono font-bold', direction === d.id ? d.color : 'text-surface-400')}>
                  {d.label}
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">{d.desc}</p>
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            aria-expanded={showFilters}
          >
            <Filter className="h-3.5 w-3.5" />
            Advanced filters
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', showFilters && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-4">
                  {/* Category */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setCategory(null)}
                        aria-pressed={category === null}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors',
                          category === null
                            ? 'bg-surface-300 border-surface-400 text-white'
                            : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
                        )}
                      >
                        All
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategory(category === cat ? null : cat)}
                          aria-pressed={category === cat}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors',
                            category === cat
                              ? 'bg-for-600/80 border-for-600 text-white'
                              : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price range */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                      Entry price range: {minPrice}% – {maxPrice}%
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-mono text-surface-500">Min</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={minPrice}
                          onChange={(e) => setMinPrice(Math.min(Number(e.target.value), maxPrice - 5))}
                          className="w-full accent-for-500"
                          aria-label="Minimum price"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-mono text-surface-500">Max</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice + 5))}
                          className="w-full accent-for-500"
                          aria-label="Maximum price"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Min volume */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Minimum votes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VOLUME_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setMinVolume(opt.value)}
                          aria-pressed={minVolume === opt.value}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors',
                            minVolume === opt.value
                              ? 'bg-surface-300 border-surface-400 text-white'
                              : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats grid */}
        {loading && !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Signals"
              value={String(stats.total_signals)}
              sub={`Active markets`}
              icon={Zap}
            />
            <StatCard
              label="Avg Unrealized"
              value={`${pnlSign(stats.avg_unrealized_pnl)}${stats.avg_unrealized_pnl.toFixed(1)}`}
              sub="pts per position"
              valueClass={pnlColor(stats.avg_unrealized_pnl)}
              icon={BarChart2}
            />
            <StatCard
              label="Historical Win"
              value={stats.historical_win_rate !== null ? `${stats.historical_win_rate}%` : '—'}
              sub={stats.historical_trades > 0 ? `${stats.historical_trades} trades` : 'No history'}
              valueClass={
                stats.historical_win_rate !== null
                  ? stats.historical_win_rate >= 55 ? 'text-emerald'
                  : stats.historical_win_rate >= 45 ? 'text-gold'
                  : 'text-against-400'
                  : 'text-surface-500'
              }
              icon={Scale}
            />
            <StatCard
              label="Gainers / Losers"
              value={`${gainers.length} / ${losers.length}`}
              sub="in your favour / against"
              icon={Activity}
            />
          </div>
        ) : null}

        {/* Historical win rate banner */}
        {stats && stats.historical_win_rate !== null && (
          <div className={cn(
            'rounded-xl border p-3 flex items-start gap-3',
            stats.historical_win_rate >= 55
              ? 'bg-emerald/5 border-emerald/20'
              : stats.historical_win_rate >= 45
                ? 'bg-gold/5 border-gold/20'
                : 'bg-against-500/5 border-against-500/20',
          )}>
            {stats.historical_win_rate >= 55 ? (
              <Sparkles className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
            ) : stats.historical_win_rate >= 45 ? (
              <Flame className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-against-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={cn('text-xs font-mono font-semibold',
                stats.historical_win_rate >= 55 ? 'text-emerald'
                : stats.historical_win_rate >= 45 ? 'text-gold'
                : 'text-against-400',
              )}>
                {stats.historical_win_rate >= 55 ? 'Strong historical edge'
                  : stats.historical_win_rate >= 45 ? 'Moderate historical performance'
                  : 'Strategy underperforms historically'}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                {activeDir.label} won {stats.historical_win_rate}% of {stats.historical_trades} resolved markets
                {category ? ` in ${category}` : ''} matching these filters.
                {' '}
                <Link href="/exchange/backtest" className="text-for-400 hover:text-for-300 underline underline-offset-2">
                  Run a full backtest
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown (collapsed, shown if signals exist) */}
        {stats && stats.by_category.length > 0 && data!.signals.length > 0 && (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
              Category breakdown
            </p>
            <div className="space-y-2">
              {stats.by_category.slice(0, 6).map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <p className="text-xs font-mono text-surface-400 w-24 shrink-0 truncate">{cat.category}</p>
                  <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', cat.avg_pnl >= 0 ? 'bg-emerald/60' : 'bg-against-500/60')}
                      style={{ width: `${Math.min(Math.abs(cat.avg_pnl), 100)}%` }}
                    />
                  </div>
                  <span className={cn('text-xs font-mono font-bold w-12 text-right shrink-0', pnlColor(cat.avg_pnl))}>
                    {pnlSign(cat.avg_pnl)}{cat.avg_pnl.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-mono text-surface-500 w-6 text-right shrink-0">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signal list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono font-bold text-white">
              Live Signals
              {data && (
                <span className="ml-2 text-surface-500 font-normal">
                  ({data.signals.length})
                </span>
              )}
            </h2>
            {lastRefreshed && (
              <p className="text-[10px] font-mono text-surface-500">
                Updated {lastRefreshed.toLocaleTimeString()}
              </p>
            )}
          </div>

          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : data && data.signals.length === 0 ? (
            <EmptyState
              icon={Target}
              iconColor="text-surface-500"
              title="No signals found"
              description="No active markets match your strategy filters. Try adjusting the price range, category, or strategy direction."
              action={{
                label: 'Reset filters',
                onClick: () => {
                  setMinPrice(0)
                  setMaxPrice(100)
                  setMinVolume(0)
                  setCategory(null)
                },
              }}
            />
          ) : (
            <div className="space-y-3">
              {/* Gainers */}
              {gainers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald" />
                    <p className="text-[10px] font-mono font-semibold text-emerald uppercase tracking-wider">
                      In Profit ({gainers.length})
                    </p>
                  </div>
                  {gainers.map((sig, i) => (
                    <SignalRow key={sig.topic_id} signal={sig} idx={i} />
                  ))}
                </div>
              )}

              {/* Flat */}
              {flat.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <Minus className="h-3.5 w-3.5 text-surface-500" />
                    <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Flat ({flat.length})
                    </p>
                  </div>
                  {flat.map((sig, i) => (
                    <SignalRow key={sig.topic_id} signal={sig} idx={gainers.length + i} />
                  ))}
                </div>
              )}

              {/* Losers */}
              {losers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <ArrowDownRight className="h-3.5 w-3.5 text-against-400" />
                    <p className="text-[10px] font-mono font-semibold text-against-400 uppercase tracking-wider">
                      In Loss ({losers.length})
                    </p>
                  </div>
                  {losers.map((sig, i) => (
                    <SignalRow key={sig.topic_id} signal={sig} idx={gainers.length + flat.length + i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Backtest CTA */}
        {data && data.signals.length > 0 && (
          <div className="rounded-xl border border-dashed border-surface-400 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono font-semibold text-white">Validate with historical data</p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                See how this strategy performed on resolved markets
              </p>
            </div>
            <Link
              href={`/exchange/backtest?direction=${direction}${category ? `&category=${category}` : ''}&min_price=${minPrice}&max_price=${maxPrice}&min_volume=${minVolume}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Backtest
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
