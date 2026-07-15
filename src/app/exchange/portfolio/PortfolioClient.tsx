'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Flame,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PortfolioPosition, PortfolioResponse, PortfolioStats } from '@/app/api/exchange/portfolio/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-emerald'
  if (pnl < 0) return 'text-against-400'
  return 'text-surface-500'
}

function pnlSign(pnl: number): string {
  if (pnl > 0) return '+'
  if (pnl < 0) return ''
  return '±'
}

function returnGrade(totalReturn: number, count: number): { grade: string; color: string } {
  if (count === 0) return { grade: '—', color: 'text-surface-500' }
  const avg = totalReturn / count
  if (avg >= 15) return { grade: 'S', color: 'text-gold' }
  if (avg >= 8) return { grade: 'A', color: 'text-for-400' }
  if (avg >= 3) return { grade: 'B', color: 'text-emerald' }
  if (avg >= -3) return { grade: 'C', color: 'text-surface-500' }
  if (avg >= -8) return { grade: 'D', color: 'text-against-300' }
  return { grade: 'F', color: 'text-against-400' }
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

const STATUS_CLASS: Record<string, string> = {
  proposed: 'bg-surface-300/60 text-surface-600 border-surface-500',
  active: 'bg-for-500/15 text-for-400 border-for-500/30',
  voting: 'bg-purple/15 text-purple border-purple/30',
  law: 'bg-gold/15 text-gold border-gold/30',
  failed: 'bg-against-500/15 text-against-400 border-against-500/30',
}

const OUTCOME_CONFIG: Record<
  PortfolioPosition['outcome'],
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  winning: { icon: TrendingUp, color: 'text-emerald', label: 'Winning' },
  losing: { icon: TrendingDown, color: 'text-against-400', label: 'Losing' },
  settled_win: { icon: Trophy, color: 'text-gold', label: 'Won' },
  settled_loss: { icon: XCircle, color: 'text-against-400', label: 'Lost' },
  push: { icon: Scale, color: 'text-surface-500', label: 'Push' },
}

type SortKey = 'pnl' | 'voted_at' | 'current_price' | 'entry_price'
type Filter = 'all' | 'open' | 'settled' | 'blue' | 'red'

// ─── Stats Grid ───────────────────────────────────────────────────────────────

function StatsGrid({ stats }: { stats: PortfolioStats }) {
  const grade = returnGrade(stats.total_return, stats.total_positions)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {/* Portfolio Return */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Total Return</p>
        <p className={cn('text-2xl font-bold font-mono', pnlColor(stats.total_return))}>
          {pnlSign(stats.total_return)}{stats.total_return.toFixed(1)}¢
        </p>
        <p className="text-xs text-surface-500 mt-1">across {stats.total_positions} positions</p>
      </div>

      {/* Win Rate */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Win Rate</p>
        <p className={cn('text-2xl font-bold font-mono', stats.win_rate !== null && stats.win_rate >= 50 ? 'text-emerald' : 'text-against-400')}>
          {stats.win_rate !== null ? `${stats.win_rate}%` : '—'}
        </p>
        <p className="text-xs text-surface-500 mt-1">
          {stats.wins}W · {stats.losses}L · {stats.pushes}P
        </p>
      </div>

      {/* Open / Settled */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Positions</p>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold font-mono text-white">{stats.open_positions}</p>
          <p className="text-sm font-mono text-surface-500 mb-0.5">open</p>
        </div>
        <p className="text-xs text-surface-500 mt-1">{stats.settled_positions} settled</p>
      </div>

      {/* Grade */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-start justify-between">
        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Grade</p>
        <p className={cn('text-4xl font-bold', grade.color)}>{grade.grade}</p>
        <p className="text-xs text-surface-500">
          {stats.by_side.blue}↑ For · {stats.by_side.red}↓ Against
        </p>
      </div>
    </div>
  )
}

// ─── Position Card ────────────────────────────────────────────────────────────

function PositionCard({ pos }: { pos: PortfolioPosition }) {
  const outcome = OUTCOME_CONFIG[pos.outcome]
  const OutcomeIcon = outcome.icon
  const delta = pos.pnl

  const barWidth = Math.min(100, Math.max(0, pos.current_price))
  const entryBarWidth = Math.min(100, Math.max(0, pos.entry_price))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-4 group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Side indicator */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5',
            pos.side === 'blue'
              ? 'bg-for-500/20 border border-for-500/30'
              : 'bg-against-500/20 border border-against-500/30',
          )}
        >
          {pos.side === 'blue'
            ? <ThumbsUp className="h-4 w-4 text-for-400" />
            : <ThumbsDown className="h-4 w-4 text-against-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <Link href={`/exchange/${pos.topic_id}`} className="hover:text-white transition-colors">
            <p className="text-sm text-surface-700 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
              {pos.statement}
            </p>
          </Link>
          <div className="flex items-center gap-2 mt-1">
            {pos.category && (
              <span className="text-xs text-surface-500">{pos.category}</span>
            )}
            <span className="text-xs text-surface-600">·</span>
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium border px-1.5 py-0.5 rounded-md', STATUS_CLASS[pos.status] ?? STATUS_CLASS.proposed)}>
              {STATUS_LABEL[pos.status] ?? pos.status}
            </span>
            <span className="text-xs text-surface-600">·</span>
            <span className="text-xs text-surface-500">{relTime(pos.voted_at)}</span>
          </div>
        </div>

        {/* P&L badge */}
        <div className={cn('flex-shrink-0 flex flex-col items-end gap-1')}>
          <span className={cn('text-lg font-bold font-mono', pnlColor(delta))}>
            {pnlSign(delta)}{Math.abs(delta).toFixed(1)}¢
          </span>
          <div className={cn('flex items-center gap-1 text-xs', outcome.color)}>
            <OutcomeIcon className="h-3 w-3" />
            <span className="font-medium">{outcome.label}</span>
          </div>
        </div>
      </div>

      {/* Price bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
          <span>Entry <span className="font-mono text-surface-600">{pos.entry_price.toFixed(0)}¢</span></span>
          <span>Now <span className={cn('font-mono font-medium', priceColor(pos.current_price, pos.status))}>{pos.current_price.toFixed(0)}¢</span></span>
        </div>

        {/* Dual progress bar */}
        <div className="relative h-1.5 bg-surface-300 rounded-full overflow-hidden">
          {/* Entry marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-surface-500 z-10"
            style={{ left: `${entryBarWidth}%` }}
          />
          {/* Current price bar */}
          <motion.div
            className={cn(
              'h-full rounded-full',
              pos.status === 'law' ? 'bg-gold' :
              pos.status === 'failed' ? 'bg-against-600' :
              pos.current_price >= 60 ? 'bg-for-500' :
              pos.current_price <= 40 ? 'bg-against-500' :
              'bg-surface-500',
            )}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-surface-600">
          <span className={cn(
            'font-medium',
            pos.side === 'blue' ? 'text-for-400' : 'text-against-400',
          )}>
            {pos.side === 'blue' ? '↑ FOR' : '↓ AGAINST'}
          </span>
          <span>{pos.total_votes.toLocaleString()} votes</span>
        </div>
      </div>

      {/* Link to market */}
      <Link
        href={`/exchange/${pos.topic_id}`}
        className="mt-3 flex items-center gap-1 text-xs text-surface-500 hover:text-for-400 transition-colors group/link"
      >
        <span>View market</span>
        <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
      </Link>
    </motion.div>
  )
}

// ─── Best/Worst Callout ───────────────────────────────────────────────────────

function BestWorstRow({ stats }: { stats: PortfolioStats }) {
  if (!stats.best_position && !stats.worst_position) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      {stats.best_position && (
        <div className="rounded-2xl bg-emerald/5 border border-emerald/20 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald" />
            <span className="text-xs font-semibold text-emerald uppercase tracking-wider">Best Position</span>
          </div>
          <p className="text-sm text-surface-700 line-clamp-2 mb-1">{stats.best_position.statement}</p>
          <span className={cn('text-lg font-bold font-mono', pnlColor(stats.best_position.pnl))}>
            {pnlSign(stats.best_position.pnl)}{Math.abs(stats.best_position.pnl).toFixed(1)}¢
          </span>
        </div>
      )}
      {stats.worst_position && stats.total_positions > 1 && (
        <div className="rounded-2xl bg-against-500/5 border border-against-500/20 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="h-4 w-4 text-against-400" />
            <span className="text-xs font-semibold text-against-400 uppercase tracking-wider">Worst Position</span>
          </div>
          <p className="text-sm text-surface-700 line-clamp-2 mb-1">{stats.worst_position.statement}</p>
          <span className={cn('text-lg font-bold font-mono', pnlColor(stats.worst_position.pnl))}>
            {pnlSign(stats.worst_position.pnl)}{Math.abs(stats.worst_position.pnl).toFixed(1)}¢
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Category Breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ stats }: { stats: PortfolioStats }) {
  if (stats.by_category.length === 0) return null
  const maxCount = Math.max(...stats.by_category.map((c) => c.count))

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
        By Category
      </h3>
      <div className="space-y-2">
        {stats.by_category.slice(0, 6).map((cat) => (
          <div key={cat.category} className="flex items-center gap-3">
            <span className="text-xs text-surface-600 w-20 truncate">{cat.category}</span>
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-for-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(cat.count / maxCount) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-surface-500 w-6 text-right">{cat.count}</span>
              <span className={cn('text-xs font-mono w-12 text-right', pnlColor(cat.net_pnl))}>
                {pnlSign(cat.net_pnl)}{Math.abs(cat.net_pnl).toFixed(0)}¢
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PortfolioClient() {
  const router = useRouter()
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('voted_at')
  const [filter, setFilter] = useState<Filter>('all')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/portfolio')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load portfolio')
      const json: PortfolioResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = [...data.positions]

    if (filter === 'open') list = list.filter((p) => !p.is_settled)
    else if (filter === 'settled') list = list.filter((p) => p.is_settled)
    else if (filter === 'blue') list = list.filter((p) => p.side === 'blue')
    else if (filter === 'red') list = list.filter((p) => p.side === 'red')

    return list.sort((a, b) => {
      if (sort === 'pnl') return b.pnl - a.pnl
      if (sort === 'current_price') return b.current_price - a.current_price
      if (sort === 'entry_price') return b.entry_price - a.entry_price
      // voted_at: newest first
      return new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime()
    })
  }, [data, sort, filter])

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'settled', label: 'Settled' },
    { id: 'blue', label: 'For' },
    { id: 'red', label: 'Against' },
  ]

  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'voted_at', label: 'Recent' },
    { id: 'pnl', label: 'P&L' },
    { id: 'current_price', label: 'Price' },
    { id: 'entry_price', label: 'Entry' },
  ]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/exchange"
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-surface-500 hover:text-white transition-colors"
              aria-label="Back to Exchange"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-for-400" />
                My Portfolio
              </h1>
              <p className="text-xs text-surface-500">Your civic market positions &amp; returns</p>
            </div>
            <Link
              href="/exchange/leaderboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 text-xs font-medium text-surface-500 hover:text-gold transition-colors"
            >
              <Trophy className="h-3.5 w-3.5" />
              Leaders
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="ml-auto flex items-center justify-center w-8 h-8 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                    <Skeleton className="h-3 w-16 mb-3" />
                    <Skeleton className="h-7 w-20 mb-2" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/3 mb-3" />
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                    <Skeleton className="h-6 w-12 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
              <p className="text-against-400 mb-3">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          )}

          {/* Content */}
          {!loading && !error && data && (
            <>
              {/* Stats */}
              <StatsGrid stats={data.stats} />

              {/* Best / Worst */}
              <BestWorstRow stats={data.stats} />

              {/* Category breakdown */}
              {data.stats.by_category.length > 1 && (
                <CategoryBreakdown stats={data.stats} />
              )}

              {/* Filter + Sort */}
              {data.positions.length > 0 && (
                <div className="flex items-center justify-between gap-3 mb-4">
                  {/* Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap',
                          filter === f.id
                            ? 'bg-for-500/20 text-for-300 border-for-500/40'
                            : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700',
                        )}
                      >
                        {f.label}
                        {f.id !== 'all' && (
                          <span className="ml-1 text-surface-500">
                            ({f.id === 'open' ? data.stats.open_positions
                              : f.id === 'settled' ? data.stats.settled_positions
                              : f.id === 'blue' ? data.stats.by_side.blue
                              : data.stats.by_side.red})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {SORTS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSort(s.id)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap hidden sm:block',
                          sort === s.id
                            ? 'bg-surface-200 text-white border-surface-400'
                            : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                    {/* Mobile sort dropdown */}
                    <div className="relative sm:hidden">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs bg-surface-100 border border-surface-300 text-surface-500"
                      >
                        Sort <ChevronDown className="h-3 w-3" />
                      </button>
                      <AnimatePresence>
                        {showFilters && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.96 }}
                            className="absolute right-0 top-full mt-1 bg-surface-100 border border-surface-300 rounded-xl p-1 z-20 shadow-2xl min-w-[120px]"
                          >
                            {SORTS.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => { setSort(s.id); setShowFilters(false) }}
                                className={cn(
                                  'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                                  sort === s.id
                                    ? 'bg-for-500/20 text-for-300'
                                    : 'text-surface-500 hover:text-white hover:bg-surface-200',
                                )}
                              >
                                {s.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}

              {/* Position count */}
              {data.positions.length > 0 && (
                <p className="text-xs text-surface-500 mb-3">
                  {filtered.length} position{filtered.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Positions list */}
              {data.positions.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  title="No positions yet"
                  description="Vote on topics in the Civic Exchange to open your first position."
                  action={{ label: 'Browse Markets', href: '/exchange' }}
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No positions match"
                  description="Try a different filter."
                />
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((pos) => (
                      <PositionCard key={pos.topic_id} pos={pos} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Exchange CTA */}
              {data.positions.length > 0 && (
                <div className="mt-8 rounded-2xl bg-for-500/10 border border-for-500/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Explore Markets</p>
                    <p className="text-xs text-surface-500">Vote on more topics to build your portfolio</p>
                  </div>
                  <Link
                    href="/exchange"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500/20 border border-for-500/30 text-for-300 text-sm font-medium hover:bg-for-500/30 transition-colors"
                  >
                    <Flame className="h-4 w-4" />
                    Live Markets
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
