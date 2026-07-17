'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Loader2,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BacktestResponse, BacktestTrade, StrategyDirection } from '@/app/api/exchange/backtest/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTIONS: Array<{ value: StrategyDirection; label: string; desc: string }> = [
  { value: 'for',        label: 'Always FOR',    desc: 'Bet every topic will pass as law' },
  { value: 'against',    label: 'Always AGAINST', desc: 'Bet every topic will fail' },
  { value: 'momentum',   label: 'Momentum',       desc: 'Follow the consensus — bet with the majority' },
  { value: 'contrarian', label: 'Contrarian',     desc: 'Fight the consensus — bet against the majority' },
]

const CATEGORIES = [
  'All',
  'Economics',
  'Civil Rights',
  'Healthcare',
  'Environment',
  'Defence',
  'Education',
  'Housing',
  'Technology',
  'Foreign Policy',
  'Justice',
  'Immigration',
]

const VOLUME_OPTIONS = [
  { value: 0,   label: 'Any volume' },
  { value: 25,  label: '25+ votes' },
  { value: 50,  label: '50+ votes' },
  { value: 100, label: '100+ votes' },
  { value: 200, label: '200+ votes' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pnlColor(pnl: number) {
  if (pnl > 0) return 'text-emerald'
  if (pnl < 0) return 'text-against-400'
  return 'text-surface-500'
}

function pnlBg(pnl: number) {
  if (pnl > 0) return 'bg-emerald/10 border-emerald/20'
  if (pnl < 0) return 'bg-against-500/10 border-against-500/20'
  return 'bg-surface-300/10 border-surface-300/20'
}

function pnlSign(pnl: number) {
  return pnl > 0 ? '+' : ''
}

function shortStatement(s: string, max = 60) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function relDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ─── P&L Curve Chart ─────────────────────────────────────────────────────────

function PnlCurve({ trades, width = 600, height = 140 }: { trades: BacktestTrade[]; width?: number; height?: number }) {
  const points = useMemo(() => {
    if (trades.length < 2) return null
    const values = [0, ...trades.map((t) => t.cumulative_pnl)]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const step = width / (values.length - 1)
    return values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 8) - 4}`)
  }, [trades, width, height])

  const zeroY = useMemo(() => {
    if (trades.length < 2) return null
    const values = [0, ...trades.map((t) => t.cumulative_pnl)]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    return height - ((0 - min) / range) * (height - 8) - 4
  }, [trades, height])

  if (!points) return null

  const finalPnl = trades[trades.length - 1]?.cumulative_pnl ?? 0
  const strokeColor = finalPnl > 0 ? '#10b981' : finalPnl < 0 ? '#ef4444' : '#6b7280'
  const fillId = finalPnl > 0 ? 'gradGreen' : 'gradRed'

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="w-full"
    >
      <defs>
        <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Zero line */}
      {zeroY !== null && zeroY > 0 && zeroY < height && (
        <line
          x1={0} y1={zeroY} x2={width} y2={zeroY}
          stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
        />
      )}

      {/* Area fill */}
      {points && (
        <polygon
          points={`0,${height} ${points.join(' ')} ${width},${height}`}
          fill={`url(#${fillId})`}
        />
      )}

      {/* Line */}
      {points && (
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

// ─── Trade Row ────────────────────────────────────────────────────────────────

function TradeRow({ trade, index }: { trade: BacktestTrade; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015, duration: 0.2 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
        pnlBg(trade.pnl),
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-surface-100 font-medium truncate">{shortStatement(trade.statement)}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {trade.category && (
            <span className="text-[10px] font-mono text-surface-500 bg-surface-300/30 px-1.5 py-0.5 rounded">
              {trade.category}
            </span>
          )}
          <span className="text-[10px] text-surface-500 font-mono">
            Entry {trade.entry_price}¢
          </span>
          <span className={cn('text-[10px] font-mono font-semibold flex items-center gap-0.5',
            trade.direction === 'for' ? 'text-for-400' : 'text-against-400'
          )}>
            {trade.direction === 'for'
              ? <><ThumbsUp className="h-2.5 w-2.5" /> FOR</>
              : <><ThumbsDown className="h-2.5 w-2.5" /> AGAINST</>
            }
          </span>
          <span className={cn('text-[10px] font-mono font-semibold',
            trade.outcome === 'law' ? 'text-gold' : 'text-against-400'
          )}>
            {trade.outcome === 'law' ? 'PASSED' : 'FAILED'}
          </span>
          <span className="text-[10px] text-surface-600">{relDate(trade.resolved_at)}</span>
        </div>
      </div>

      <div className={cn('font-mono font-bold text-sm shrink-0', pnlColor(trade.pnl))}>
        {pnlSign(trade.pnl)}{trade.pnl}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BacktestClient() {
  const [direction, setDirection] = useState<StrategyDirection>('momentum')
  const [minPrice, setMinPrice]   = useState(0)
  const [maxPrice, setMaxPrice]   = useState(100)
  const [category, setCategory]   = useState('All')
  const [minVolume, setMinVolume] = useState(0)

  const [result, setResult]     = useState<BacktestResponse | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showAll, setShowAll]   = useState(false)
  const [hasRun, setHasRun]     = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setShowAll(false)

    const params = new URLSearchParams({
      direction,
      min_price: String(minPrice),
      max_price: String(maxPrice),
      min_volume: String(minVolume),
    })
    if (category !== 'All') params.set('category', category)

    try {
      const res = await fetch(`/api/exchange/backtest?${params}`)
      if (!res.ok) throw new Error('Server error')
      const data: BacktestResponse = await res.json()
      setResult(data)
      setHasRun(true)
    } catch {
      setError('Failed to run backtest. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [direction, minPrice, maxPrice, category, minVolume])

  const displayTrades = useMemo(() => {
    if (!result) return []
    return showAll ? result.trades : result.trades.slice(0, 30)
  }, [result, showAll])

  const { stats } = result ?? {}

  return (
    <div className="min-h-screen bg-surface-900">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="p-2 rounded-lg hover:bg-surface-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-surface-50 flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-purple-400" />
              Strategy Backtester
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Simulate a trading strategy against every resolved civic market
            </p>
          </div>
        </div>

        {/* Strategy Builder */}
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5 mb-5 space-y-5">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
            Build Your Strategy
          </h2>

          {/* Direction */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-surface-400">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDirection(d.value)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                    direction === d.value
                      ? 'border-purple-500/60 bg-purple-500/10 text-surface-50'
                      : 'border-surface-600 bg-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-300',
                  )}
                >
                  <span className="font-semibold block text-xs mb-0.5">{d.label}</span>
                  <span className="text-[11px] text-surface-500">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-surface-400">
              Entry Price Range (consensus % at time of entry)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-surface-500 w-6">Min</span>
                  <span className="text-xs font-mono text-for-400">{minPrice}¢</span>
                </div>
                <input
                  type="range" min={0} max={100} value={minPrice}
                  onChange={(e) => setMinPrice(Math.min(parseInt(e.target.value), maxPrice - 5))}
                  className="w-full accent-for-400 h-1.5"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-surface-500 w-6">Max</span>
                  <span className="text-xs font-mono text-for-400">{maxPrice}¢</span>
                </div>
                <input
                  type="range" min={0} max={100} value={maxPrice}
                  onChange={(e) => setMaxPrice(Math.max(parseInt(e.target.value), minPrice + 5))}
                  className="w-full accent-for-400 h-1.5"
                />
              </div>
            </div>
            <p className="text-[11px] text-surface-600">
              Only enter trades where the consensus price was between {minPrice}¢ and {maxPrice}¢
            </p>
          </div>

          {/* Category + Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-purple-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-400">Min Volume</label>
              <select
                value={minVolume}
                onChange={(e) => setMinVolume(parseInt(e.target.value))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-purple-500"
              >
                {VOLUME_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={run}
            disabled={loading}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
              loading
                ? 'bg-purple-700/50 text-purple-300 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white',
            )}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running simulation…</>
            ) : (
              <><Zap className="h-4 w-4" /> Run Backtest</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-against-500/10 border border-against-500/30 rounded-xl p-4 text-against-400 text-sm mb-5">
            {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {stats && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* P&L Chart */}
              {result && result.trades.length >= 2 && (
                <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-surface-300">Cumulative P&amp;L</h2>
                    <span className={cn('font-mono font-bold text-lg', pnlColor(stats.total_pnl))}>
                      {pnlSign(stats.total_pnl)}{stats.total_pnl} pts
                    </span>
                  </div>
                  <div className="h-36 w-full overflow-hidden">
                    <PnlCurve trades={result.trades} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
                    <span>Start</span>
                    <span>End</span>
                  </div>
                </div>
              )}

              {/* Key Metrics */}
              {stats.total_trades === 0 ? (
                <EmptyState
                  title="No trades matched"
                  description="Try widening the price range, removing the category filter, or lowering the min volume."
                  icon={FlaskConical}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Trades',
                      value: stats.total_trades.toString(),
                      sub: `${stats.wins}W / ${stats.losses}L`,
                      color: 'text-surface-100',
                    },
                    {
                      label: 'Win Rate',
                      value: `${stats.win_rate}%`,
                      sub: stats.win_rate >= 55 ? 'Edge!' : stats.win_rate >= 50 ? 'Slight edge' : 'No edge',
                      color: stats.win_rate >= 55 ? 'text-emerald' : stats.win_rate >= 50 ? 'text-for-400' : 'text-against-400',
                    },
                    {
                      label: 'Total P&L',
                      value: `${pnlSign(stats.total_pnl)}${stats.total_pnl}`,
                      sub: 'points',
                      color: pnlColor(stats.total_pnl),
                    },
                    {
                      label: 'Avg P&L',
                      value: `${pnlSign(stats.avg_pnl)}${stats.avg_pnl}`,
                      sub: 'per trade',
                      color: pnlColor(stats.avg_pnl),
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="bg-surface-800 border border-surface-700 rounded-xl p-4 text-center"
                    >
                      <p className="text-xs text-surface-500 mb-1">{m.label}</p>
                      <p className={cn('font-mono font-bold text-xl', m.color)}>{m.value}</p>
                      <p className="text-[10px] text-surface-600 mt-0.5">{m.sub}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Additional stats row */}
              {stats.total_trades > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                    <p className="text-xs text-surface-500 mb-2 flex items-center gap-1.5">
                      <TrendingDown className="h-3 w-3" /> Max Drawdown
                    </p>
                    <p className="font-mono font-bold text-against-400 text-lg">
                      -{stats.max_drawdown} pts
                    </p>
                    <p className="text-[10px] text-surface-600 mt-0.5">
                      Biggest peak-to-trough drop
                    </p>
                  </div>
                  <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                    <p className="text-xs text-surface-500 mb-2 flex items-center gap-1.5">
                      <Trophy className="h-3 w-3 text-gold" /> Best Trade
                    </p>
                    {stats.best_trade ? (
                      <>
                        <p className={cn('font-mono font-bold text-lg', pnlColor(stats.best_trade.pnl))}>
                          {pnlSign(stats.best_trade.pnl)}{stats.best_trade.pnl} pts
                        </p>
                        <p className="text-[10px] text-surface-500 mt-0.5 truncate">
                          {shortStatement(stats.best_trade.statement, 40)}
                        </p>
                      </>
                    ) : (
                      <p className="text-surface-600 text-sm">—</p>
                    )}
                  </div>
                </div>
              )}

              {/* By Category */}
              {stats.by_category.length > 0 && (
                <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
                  <h2 className="text-sm font-semibold text-surface-300 mb-4 flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-purple-400" />
                    Performance by Category
                  </h2>
                  <div className="space-y-2">
                    {stats.by_category.map((cat) => {
                      const winPct = cat.trades > 0 ? Math.round((cat.wins / cat.trades) * 100) : 0
                      return (
                        <div key={cat.category} className="flex items-center gap-3 text-sm">
                          <div className="w-28 text-surface-400 text-xs truncate shrink-0">
                            {cat.category}
                          </div>
                          <div className="flex-1">
                            <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', cat.pnl >= 0 ? 'bg-emerald' : 'bg-against-400')}
                                style={{ width: `${Math.min(100, Math.abs(cat.pnl) / 10)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-surface-500 font-mono w-12 text-right">
                            {cat.trades}T {winPct}%
                          </span>
                          <span className={cn('text-xs font-mono font-semibold w-16 text-right', pnlColor(cat.pnl))}>
                            {pnlSign(cat.pnl)}{cat.pnl}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Trade Log */}
              {result && result.trades.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-purple-400" />
                      Trade Log
                    </h2>
                    <span className="text-xs text-surface-500">
                      {result.trades.length} trades (chronological)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {displayTrades.map((trade, i) => (
                      <TradeRow key={trade.topic_id + i} trade={trade} index={i} />
                    ))}
                  </div>
                  {result.trades.length > 30 && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="w-full py-2.5 rounded-xl border border-surface-700 text-surface-400 text-sm hover:text-surface-200 hover:border-surface-500 transition-all flex items-center justify-center gap-2"
                    >
                      {showAll ? (
                        <><ChevronUp className="h-4 w-4" /> Show less</>
                      ) : (
                        <><ChevronDown className="h-4 w-4" /> Show all {result.trades.length} trades</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* First-run prompt */}
        {!hasRun && !loading && (
          <div className="bg-surface-800 border border-surface-700 rounded-2xl p-8 text-center">
            <FlaskConical className="h-10 w-10 text-purple-400 mx-auto mb-3" />
            <h3 className="text-surface-200 font-semibold mb-2">Configure your strategy above</h3>
            <p className="text-sm text-surface-500 max-w-sm mx-auto">
              Choose a direction, set your entry price range and filters, then run the backtest
              to see how the strategy would have performed on all resolved markets.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-36 rounded-2xl" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
