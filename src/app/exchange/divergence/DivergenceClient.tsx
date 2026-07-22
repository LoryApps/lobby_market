'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
  Filter,
  GitCompare,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DivergenceResponse, DivergentMarket } from '@/app/api/exchange/divergence/route'

// ─── Filter types ─────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'overpriced' | 'underpriced' | 'aligned'

const FILTER_OPTIONS: { id: FilterMode; label: string; icon: typeof Scale }[] = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'overpriced', label: 'Overpriced', icon: TrendingDown },
  { id: 'underpriced', label: 'Underpriced', icon: TrendingUp },
  { id: 'aligned', label: 'Aligned', icon: Scale },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function divergenceColor(direction: DivergentMarket['direction']) {
  if (direction === 'overpriced') return 'text-against-400'
  if (direction === 'underpriced') return 'text-for-400'
  return 'text-surface-500'
}

function divergenceBg(direction: DivergentMarket['direction']) {
  if (direction === 'overpriced') return 'bg-against-500/10 border-against-500/30'
  if (direction === 'underpriced') return 'bg-for-500/10 border-for-500/30'
  return 'bg-surface-200/40 border-surface-300/40'
}

function divergenceLabel(direction: DivergentMarket['direction'], magnitude: number) {
  if (direction === 'aligned') return 'Aligned'
  const level = magnitude >= 30 ? 'Strong' : magnitude >= 20 ? 'Moderate' : 'Mild'
  if (direction === 'overpriced') return `${level} overpriced`
  return `${level} underpriced`
}

function DivergenceBar({
  marketPrice,
  argLean,
}: {
  marketPrice: number
  argLean: number
}) {
  return (
    <div className="space-y-1.5">
      {/* Market price bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-500 w-20 shrink-0">Market price</span>
        <div className="flex-1 h-2 bg-surface-300/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${marketPrice}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full bg-for-500"
          />
        </div>
        <span className="text-[11px] font-mono font-bold text-for-300 w-8 text-right">
          {marketPrice}¢
        </span>
      </div>
      {/* Argument lean bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-500 w-20 shrink-0">Arg. lean</span>
        <div className="flex-1 h-2 bg-surface-300/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${argLean}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="h-full rounded-full bg-purple/70"
          />
        </div>
        <span className="text-[11px] font-mono font-bold text-purple w-8 text-right">
          {argLean}¢
        </span>
      </div>
    </div>
  )
}

// ─── Market card ──────────────────────────────────────────────────────────────

function DivergenceCard({
  market,
  index,
}: {
  market: DivergentMarket
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const absDivergence = Math.abs(market.divergence)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <div
        className={cn(
          'border rounded-xl overflow-hidden transition-all duration-200',
          divergenceBg(market.direction),
        )}
      >
        {/* Header */}
        <div className="p-4 space-y-3">
          {/* Top row: category + direction badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {market.category && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
                  {market.category}
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                  market.direction === 'overpriced'
                    ? 'bg-against-500/20 text-against-400'
                    : market.direction === 'underpriced'
                      ? 'bg-for-500/20 text-for-400'
                      : 'bg-surface-300/40 text-surface-500',
                )}
              >
                {divergenceLabel(market.direction, absDivergence)}
              </span>
              {absDivergence >= 25 && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold">
                  High signal
                </span>
              )}
            </div>
            <div
              className={cn(
                'text-2xl font-mono font-black tabular-nums shrink-0',
                divergenceColor(market.direction),
              )}
            >
              {market.divergence > 0 ? '+' : ''}{market.divergence}¢
            </div>
          </div>

          {/* Statement */}
          <Link
            href={`/exchange/${market.id}`}
            className="block text-sm font-medium text-white leading-snug hover:text-surface-100 transition-colors"
          >
            {market.statement}
            <ChevronRight className="inline-block ml-1 w-3.5 h-3.5 text-surface-500" />
          </Link>

          {/* Divergence bars */}
          <DivergenceBar marketPrice={market.market_price} argLean={market.arg_lean} />

          {/* Stats row */}
          <div className="flex items-center gap-4 text-[11px] text-surface-500 font-mono">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3 text-for-400" />
              {market.for_args} for
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="w-3 h-3 text-against-400" />
              {market.against_args} against
            </span>
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3" />
              {market.arg_count} args
            </span>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="ml-auto flex items-center gap-1 text-surface-400 hover:text-white transition-colors"
            >
              {expanded ? 'hide' : 'show'} args
              <ArrowRight
                className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')}
              />
            </button>
          </div>
        </div>

        {/* Expanded: top arguments */}
        <AnimatePresence>
          {expanded && (market.top_for_arg || market.top_against_arg) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-surface-300/20"
            >
              <div className="p-4 space-y-3 bg-surface-100/30">
                {market.top_for_arg && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-for-400">
                      <ThumbsUp className="w-3 h-3" />
                      Top FOR argument
                    </div>
                    <p className="text-xs text-surface-300 leading-relaxed">
                      {market.top_for_arg}
                    </p>
                  </div>
                )}
                {market.top_against_arg && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-against-400">
                      <ThumbsDown className="w-3 h-3" />
                      Top AGAINST argument
                    </div>
                    <p className="text-xs text-surface-300 leading-relaxed">
                      {market.top_against_arg}
                    </p>
                  </div>
                )}
                <Link
                  href={`/exchange/${market.id}/arguments`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
                >
                  View all arguments <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DivergenceSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border border-surface-300/30 rounded-xl p-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-12" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function DivergenceClient() {
  const [data, setData] = useState<DivergenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/divergence')
      if (res.ok) {
        const json: DivergenceResponse = await res.json()
        setData(json)
        setLastRefresh(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = (data?.markets ?? []).filter((m) => {
    if (filter !== 'all' && m.direction !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        m.statement.toLowerCase().includes(q) ||
        (m.category?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  return (
    <div className="flex flex-col min-h-screen bg-surface-100 text-white">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-100/95 backdrop-blur-sm border-b border-surface-200/60">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <Link
                href="/exchange"
                className="p-1.5 rounded-lg hover:bg-surface-200/60 transition-colors"
                aria-label="Back to Exchange"
              >
                <ArrowLeft className="w-4 h-4 text-surface-400" />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-purple" />
                  <h1 className="text-sm font-bold text-white">Divergence Detector</h1>
                </div>
                <p className="text-[11px] text-surface-500 font-mono">
                  Markets where price and argument quality disagree
                </p>
              </div>
              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh"
                className="p-1.5 rounded-lg hover:bg-surface-200/60 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('w-4 h-4 text-surface-400', loading && 'animate-spin')} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search markets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-surface-200/60 border border-surface-300/40 rounded-lg text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {FILTER_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap transition-all border',
                    filter === id
                      ? id === 'overpriced'
                        ? 'bg-against-500/20 text-against-400 border-against-500/40'
                        : id === 'underpriced'
                          ? 'bg-for-500/20 text-for-400 border-for-500/40'
                          : id === 'aligned'
                            ? 'bg-surface-300/60 text-white border-surface-400/60'
                            : 'bg-purple/20 text-purple border-purple/40'
                      : 'bg-surface-200/40 text-surface-500 border-surface-300/30 hover:border-surface-400/40',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                  {data && (
                    <span className="opacity-60">
                      {id === 'all'
                        ? data.markets.length
                        : id === 'overpriced'
                          ? data.summary.overpriced_count
                          : id === 'underpriced'
                            ? data.summary.underpriced_count
                            : data.markets.length - data.summary.divergent_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Summary stats */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-4 gap-2"
            >
              {[
                {
                  label: 'Scanned',
                  value: data.summary.total_scanned,
                  icon: BarChart2,
                  color: 'text-surface-400',
                },
                {
                  label: 'Divergent',
                  value: data.summary.divergent_count,
                  icon: Zap,
                  color: 'text-gold',
                },
                {
                  label: 'Overpriced',
                  value: data.summary.overpriced_count,
                  icon: TrendingDown,
                  color: 'text-against-400',
                },
                {
                  label: 'Underpriced',
                  value: data.summary.underpriced_count,
                  icon: TrendingUp,
                  color: 'text-for-400',
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="bg-surface-200/40 border border-surface-300/30 rounded-xl p-3 text-center"
                >
                  <Icon className={cn('w-3.5 h-3.5 mx-auto mb-1', color)} />
                  <div className={cn('text-lg font-mono font-black', color)}>{value}</div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    {label}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Explainer banner */}
          <div className="flex gap-3 p-3 bg-purple/10 border border-purple/20 rounded-xl">
            <Brain className="w-4 h-4 text-purple shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-purple">What is divergence?</p>
              <p className="text-[11px] text-surface-400 leading-relaxed">
                Each market has a <span className="text-for-300">consensus price</span> (from votes)
                and an <span className="text-purple">argument lean</span> (weighted quality of FOR vs.
                AGAINST arguments). When they disagree significantly, it signals the crowd may be
                voting on momentum rather than evidence.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <span className="flex items-center gap-1 text-[10px] font-mono text-against-400">
                  <TrendingDown className="w-3 h-3" />
                  Overpriced = price higher than args justify
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-for-400">
                  <TrendingUp className="w-3 h-3" />
                  Underpriced = price lower than args justify
                </span>
              </div>
            </div>
          </div>

          {/* Market list */}
          {loading ? (
            <DivergenceSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No markets found"
              description={
                search
                  ? 'No markets match your search'
                  : filter === 'aligned'
                    ? 'All markets currently show some divergence'
                    : 'No markets with this divergence type right now'
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((market, i) => (
                <DivergenceCard key={market.id} market={market} index={i} />
              ))}
            </div>
          )}

          {/* Legend */}
          {!loading && data && (
            <div className="mt-4 p-3 bg-surface-200/30 border border-surface-300/20 rounded-xl space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
                How divergence is calculated
              </p>
              <div className="grid grid-cols-1 gap-1.5 text-[11px] text-surface-400">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-for-500 shrink-0 mt-1" />
                  <span>
                    <span className="text-white font-mono">Market price</span> — the current FOR
                    consensus expressed as cents (votes cast FOR ÷ total votes × 100)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple shrink-0 mt-1" />
                  <span>
                    <span className="text-white font-mono">Argument lean</span> — weighted quality of
                    FOR vs AGAINST arguments (upvotes + AI score bonus per argument)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-gold shrink-0 mt-1" />
                  <span>
                    <span className="text-white font-mono">Divergence</span> — the gap between price
                    and lean. Positive = overpriced, negative = underpriced. ≥12¢ gap = divergent.
                  </span>
                </div>
              </div>
            </div>
          )}

          {lastRefresh && (
            <p className="text-center text-[10px] font-mono text-surface-600">
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
