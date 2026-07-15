'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Filter,
  Gavel,
  History,
  RefreshCw,
  Target,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ResolvedMarket, ResolvedResponse } from '@/app/api/exchange/resolved/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: 'recent',     label: 'Recent',     icon: Clock },
  { id: 'volume',     label: 'Volume',     icon: BarChart2 },
  { id: 'accuracy',   label: 'Accuracy',   icon: Target },
  { id: 'conviction', label: 'Conviction', icon: Zap },
] as const
type SortId = (typeof SORT_TABS)[number]['id']

const OUTCOME_FILTERS = [
  { id: null,     label: 'All' },
  { id: 'law',    label: 'Enacted' },
  { id: 'failed', label: 'Failed' },
] as const
type OutcomeFilter = null | 'law' | 'failed'

const CATEGORIES = [
  null,
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (d >= 365) return `${Math.floor(d / 365)}y ago`
  if (d >= 30) return `${Math.floor(d / 30)}mo ago`
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  if (m >= 1) return `${m}m ago`
  return 'just now'
}

function accuracyColor(pct: number): string {
  if (pct >= 70) return 'text-emerald'
  if (pct >= 55) return 'text-for-400'
  if (pct <= 40) return 'text-against-400'
  return 'text-surface-400'
}

// ─── Sub-nav ──────────────────────────────────────────────────────────────────

const EXCHANGE_NAV = [
  { href: '/exchange',            label: 'Markets' },
  { href: '/exchange/categories', label: 'Sectors' },
  { href: '/exchange/movers',     label: 'Movers' },
  { href: '/exchange/resolved',   label: 'Resolved', active: true },
  { href: '/exchange/portfolio',  label: 'Portfolio' },
  { href: '/exchange/leaderboard',label: 'Leaderboard' },
  { href: '/exchange/alerts',     label: 'Alerts' },
]

// ─── Market card ──────────────────────────────────────────────────────────────

function MarketCard({ market, index }: { market: ResolvedMarket; index: number }) {
  const isLaw = market.outcome === 'law'
  const catColor = market.category ? (CAT_COLOR[market.category] ?? 'text-surface-400') : 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'group flex flex-col gap-3 rounded-2xl border p-4 transition-all',
          'bg-surface-200/60 hover:bg-surface-200 border-surface-300/60 hover:border-surface-400',
        )}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Outcome icon */}
          <div
            className={cn(
              'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
              isLaw
                ? 'bg-gold/10 text-gold'
                : 'bg-against-500/10 text-against-400',
            )}
          >
            {isLaw ? <Gavel className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          </div>

          {/* Statement */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-50 leading-snug line-clamp-2 group-hover:text-white transition-colors">
              {market.statement}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {market.category && (
                <span className={cn('text-xs font-medium', catColor)}>
                  {market.category}
                </span>
              )}
              <span className="text-xs text-surface-500">·</span>
              <span className="text-xs text-surface-500">{relDate(market.resolved_at)}</span>
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 transition-colors mt-1" />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Final price */}
          <div className="flex flex-col items-center rounded-xl bg-surface-300/40 py-2 px-2 gap-0.5">
            <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">
              Final
            </span>
            <span
              className={cn(
                'text-base font-bold tabular-nums',
                isLaw ? 'text-gold' : 'text-against-400',
              )}
            >
              {market.final_price}¢
            </span>
          </div>

          {/* Accuracy */}
          <div className="flex flex-col items-center rounded-xl bg-surface-300/40 py-2 px-2 gap-0.5">
            <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">
              Called it
            </span>
            <span className={cn('text-base font-bold tabular-nums', accuracyColor(market.accuracy))}>
              {market.accuracy}%
            </span>
          </div>

          {/* Volume */}
          <div className="flex flex-col items-center rounded-xl bg-surface-300/40 py-2 px-2 gap-0.5">
            <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wide">
              Volume
            </span>
            <span className="text-base font-bold tabular-nums text-surface-300">
              {formatVolume(market.total_votes)}
            </span>
          </div>
        </div>

        {/* Conviction bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-500 w-14 flex-shrink-0">Conviction</span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isLaw ? 'bg-gold' : 'bg-against-500',
              )}
              style={{ width: `${Math.min(100, market.conviction * 2)}%` }}
            />
          </div>
          <span className="text-[10px] text-surface-500 w-8 text-right tabular-nums">
            {market.conviction}pt
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold text-surface-50 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-surface-500">{sub}</div>}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300/60 bg-surface-200/60 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-14 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResolvedClient() {
  const [data, setData] = useState<ResolvedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortId>('recent')
  const [outcome, setOutcome] = useState<OutcomeFilter>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [showCatFilter, setShowCatFilter] = useState(false)

  const load = useCallback(
    async (nextPage = 0, append = false) => {
      if (nextPage === 0) setLoading(true)
      else setLoadingMore(true)
      setError(null)

      const params = new URLSearchParams({ sort, page: String(nextPage) })
      if (outcome) params.set('outcome', outcome)
      if (category) params.set('category', category)

      try {
        const res = await fetch(`/api/exchange/resolved?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const json: ResolvedResponse = await res.json()

        if (append && data) {
          setData({
            ...json,
            markets: [...data.markets, ...json.markets],
          })
        } else {
          setData(json)
        }
        setPage(nextPage)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, outcome, category],
  )

  useEffect(() => {
    load(0, false)
  }, [load])

  const hasMore = data
    ? data.markets.length < data.total
    : false

  return (
    <div className="min-h-screen bg-surface-100 text-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto pb-28 pt-16 px-4">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Link
            href="/exchange"
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface-200/60 hover:bg-surface-200 border border-surface-300/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-surface-50 flex items-center gap-2">
              <History className="h-5 w-5 text-gold" />
              Resolved Markets
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Settled prediction markets — who called it right?
            </p>
          </div>
          <button
            onClick={() => load(0, false)}
            className="ml-auto flex items-center justify-center w-8 h-8 rounded-xl bg-surface-200/60 hover:bg-surface-200 border border-surface-300/60 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-surface-400" />
          </button>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-5 no-scrollbar">
          {EXCHANGE_NAV.map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                active
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-surface-400 hover:text-surface-300 hover:bg-surface-200',
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Stats tiles */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile
              label="Total Resolved"
              value={data.stats.total_resolved.toLocaleString()}
              icon={History}
              color="text-surface-400"
            />
            <StatTile
              label="Enacted"
              value={data.stats.laws.toLocaleString()}
              sub={`${data.stats.total_resolved > 0 ? Math.round((data.stats.laws / data.stats.total_resolved) * 100) : 0}% pass rate`}
              icon={Gavel}
              color="text-gold"
            />
            <StatTile
              label="Avg Accuracy"
              value={`${data.stats.avg_accuracy}%`}
              sub="voters correct"
              icon={Target}
              color="text-emerald"
            />
            <StatTile
              label="Avg Volume"
              value={formatVolume(data.stats.avg_volume)}
              sub="votes per market"
              icon={BarChart2}
              color="text-for-400"
            />
          </div>
        )}

        {/* Filter / sort bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-surface-200/60 border border-surface-300/60 rounded-xl p-1">
            {SORT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all',
                  sort === id
                    ? 'bg-surface-300 text-surface-50 shadow-sm'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Outcome filter */}
          <div className="flex items-center gap-1 bg-surface-200/60 border border-surface-300/60 rounded-xl p-1">
            {OUTCOME_FILTERS.map(({ id, label }) => (
              <button
                key={String(id)}
                onClick={() => setOutcome(id as OutcomeFilter)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                  outcome === id
                    ? id === 'law'
                      ? 'bg-gold/20 text-gold shadow-sm'
                      : id === 'failed'
                        ? 'bg-against-500/20 text-against-400 shadow-sm'
                        : 'bg-surface-300 text-surface-50 shadow-sm'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category filter toggle */}
          <button
            onClick={() => setShowCatFilter((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
              category
                ? 'bg-for-500/15 border-for-500/40 text-for-400'
                : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-surface-300',
            )}
          >
            <Filter className="h-3 w-3" />
            {category ?? 'Sector'}
          </button>
        </div>

        {/* Category selector */}
        <AnimatePresence>
          {showCatFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="flex flex-wrap gap-2 pt-1 pb-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat ?? '__all'}
                    onClick={() => {
                      setCategory(cat)
                      setShowCatFilter(false)
                    }}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                      category === cat
                        ? 'bg-for-500/20 border-for-500/40 text-for-300'
                        : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-surface-300',
                    )}
                  >
                    {cat ?? 'All Sectors'}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="text-against-400 text-sm font-medium">{error}</p>
            <button
              onClick={() => load(0, false)}
              className="mt-3 text-xs text-surface-400 hover:text-surface-300 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        ) : !data || data.markets.length === 0 ? (
          <EmptyState
            icon={History}
            title="No resolved markets"
            description="Markets appear here once topics become law or are voted down."
          />
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 px-1">
              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <Gavel className="h-3.5 w-3.5 text-gold" />
                <span className="text-gold">Enacted</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <XCircle className="h-3.5 w-3.5 text-against-400" />
                <span className="text-against-400">Failed</span>
              </div>
              <div className="ml-auto text-xs text-surface-500">
                {data.total.toLocaleString()} total
              </div>
            </div>

            <div className="space-y-3">
              {data.markets.map((market, i) => (
                <MarketCard key={market.id} market={market} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => load(page + 1, true)}
                  disabled={loadingMore}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all',
                    'bg-surface-200/60 border border-surface-300/60 text-surface-300',
                    'hover:bg-surface-200 hover:border-surface-400',
                    loadingMore && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load more
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
