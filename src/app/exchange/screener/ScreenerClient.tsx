'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpDown,
  BarChart2,
  ChevronRight,
  Clock,
  Filter,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Market, ExchangeResponse } from '@/app/api/exchange/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS = [
  { id: 'volume',     label: 'Volume',     icon: BarChart2 },
  { id: 'price_asc',  label: 'Price ↑',    icon: TrendingUp },
  { id: 'price_desc', label: 'Price ↓',    icon: TrendingDown },
  { id: 'momentum',   label: 'Momentum',   icon: Zap },
  { id: 'closing',    label: 'Closing',    icon: Clock },
  { id: 'newest',     label: 'Newest',     icon: RefreshCw },
] as const
type SortId = (typeof SORT_OPTIONS)[number]['id']

const SIGNAL_OPTIONS = [
  { id: 'hot',          label: 'Hot',          icon: Flame,    color: 'text-against-400' },
  { id: 'closing_soon', label: 'Closing Soon', icon: Clock,    color: 'text-gold' },
  { id: 'near_law',     label: 'Near Law',     icon: Gavel,    color: 'text-gold' },
  { id: 'deadlocked',   label: 'Deadlocked',   icon: Scale,    color: 'text-purple' },
  { id: 'high_volume',  label: 'High Volume',  icon: BarChart2, color: 'text-for-400' },
] as const
type SignalId = (typeof SIGNAL_OPTIONS)[number]['id']

const STATUS_OPTIONS = [
  { id: 'all',    label: 'All' },
  { id: 'live',   label: 'Live' },
  { id: 'voting', label: 'Voting' },
] as const
type StatusId = (typeof STATUS_OPTIONS)[number]['id']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function priceColor(price: number): string {
  if (price >= 70) return 'text-for-400'
  if (price >= 55) return 'text-for-300'
  if (price >= 45) return 'text-purple'
  if (price >= 30) return 'text-against-300'
  return 'text-against-400'
}

function priceBg(price: number): string {
  if (price >= 70) return 'bg-for-500/15'
  if (price >= 55) return 'bg-for-500/8'
  if (price >= 45) return 'bg-purple/10'
  if (price >= 30) return 'bg-against-500/8'
  return 'bg-against-500/15'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function timeUntil(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d`
  if (h > 0) return `${h}h`
  return `${Math.floor(diff / 60_000)}m`
}

const CAT_DOT: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-for-300',
  Philosophy:  'bg-purple',
  Culture:     'bg-against-300',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-gold',
}

// ─── Market row ────────────────────────────────────────────────────────────────

function MarketRow({ market, rank }: { market: Market; rank: number }) {
  const countdown = timeUntil(market.voting_ends_at)
  const barFor = Math.max(2, Math.min(98, market.price))

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.4) }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'block rounded-xl border bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-150 transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
          'p-3 sm:p-4'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Rank */}
          <span className="flex-shrink-0 w-6 text-[11px] font-mono text-surface-600 pt-0.5 text-right">
            {rank}
          </span>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                  {market.statement}
                </p>
              </div>
              {/* Price badge */}
              <div className={cn(
                'flex-shrink-0 flex flex-col items-center rounded-lg px-2.5 py-1.5 min-w-[52px]',
                priceBg(market.price)
              )}>
                <span className={cn('text-lg font-mono font-bold leading-none', priceColor(market.price))}>
                  {Math.round(market.price)}¢
                </span>
                <span className="text-[9px] font-mono text-surface-600 mt-0.5">FOR</span>
              </div>
            </div>

            {/* Vote bar */}
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-300"
                style={{ width: `${barFor}%` }}
              />
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Category */}
              {market.category && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                  <span className={cn('w-1.5 h-1.5 rounded-full', CAT_DOT[market.category] ?? 'bg-surface-500')} />
                  {market.category}
                </span>
              )}

              {/* Volume */}
              <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                <BarChart2 className="h-3 w-3" />
                {formatVolume(market.volume)}
              </span>

              {/* Closing */}
              {countdown && market.status === 'voting' && (
                <span className={cn(
                  'flex items-center gap-1 text-[11px] font-mono',
                  market.is_closing_soon ? 'text-gold' : 'text-surface-500'
                )}>
                  <Clock className="h-3 w-3" />
                  {countdown}
                </span>
              )}

              {/* Signals */}
              <div className="flex items-center gap-1 ml-auto">
                {market.is_hot && (
                  <span title="Hot market" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-against-800/60 text-against-400 border border-against-700/40">HOT</span>
                )}
                {market.is_near_law && (
                  <span title="Near law threshold" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">NEAR LAW</span>
                )}
                {market.is_deadlocked && (
                  <span title="Deadlocked — close to 50/50" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple/10 text-purple border border-purple/30">DEADLOCK</span>
                )}
                {market.is_closing_soon && (
                  <span title="Closing within 24h" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">CLOSING</span>
                )}
              </div>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 mt-1" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Filters {
  query: string
  categories: Set<string>
  status: StatusId
  signals: Set<SignalId>
  priceMin: number
  priceMax: number
  sort: SortId
}

function defaultFilters(): Filters {
  return {
    query: '',
    categories: new Set(),
    status: 'all',
    signals: new Set(),
    priceMin: 0,
    priceMax: 100,
    sort: 'volume',
  }
}

export function ScreenerClient() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load all markets once; filter client-side
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange?sort=volume', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load markets')
      const data = (await res.json()) as ExchangeResponse
      setMarkets(data.markets)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  // Apply all filters + sort
  const filtered = useMemo(() => {
    let out = markets

    // Query filter
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase()
      out = out.filter((m) => m.statement.toLowerCase().includes(q))
    }

    // Category filter
    if (filters.categories.size > 0) {
      out = out.filter((m) => m.category && filters.categories.has(m.category))
    }

    // Status filter
    if (filters.status === 'live') out = out.filter((m) => m.status === 'active')
    else if (filters.status === 'voting') out = out.filter((m) => m.status === 'voting')

    // Price range filter
    out = out.filter((m) => m.price >= filters.priceMin && m.price <= filters.priceMax)

    // Signal filters
    for (const sig of filters.signals) {
      if (sig === 'hot')          out = out.filter((m) => m.is_hot)
      if (sig === 'closing_soon') out = out.filter((m) => m.is_closing_soon)
      if (sig === 'near_law')     out = out.filter((m) => m.is_near_law)
      if (sig === 'deadlocked')   out = out.filter((m) => m.is_deadlocked)
      if (sig === 'high_volume')  out = out.filter((m) => m.volume >= 200)
    }

    // Sort
    switch (filters.sort) {
      case 'volume':
        out = [...out].sort((a, b) => b.volume - a.volume)
        break
      case 'price_asc':
        out = [...out].sort((a, b) => a.price - b.price)
        break
      case 'price_desc':
        out = [...out].sort((a, b) => b.price - a.price)
        break
      case 'momentum':
        out = [...out].sort((a, b) => b.feed_score - a.feed_score)
        break
      case 'closing':
        out = [...out]
          .filter((m) => m.voting_ends_at && m.status === 'voting')
          .sort((a, b) =>
            new Date(a.voting_ends_at!).getTime() - new Date(b.voting_ends_at!).getTime()
          )
        break
      case 'newest':
        out = [...out].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }

    return out
  }, [markets, filters])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.query.trim()) n++
    if (filters.categories.size > 0) n++
    if (filters.status !== 'all') n++
    if (filters.signals.size > 0) n++
    if (filters.priceMin !== 0 || filters.priceMax !== 100) n++
    return n
  }, [filters])

  function resetFilters() {
    setFilters(defaultFilters())
  }

  function toggleCategory(cat: string) {
    setFilters((prev) => {
      const next = new Set(prev.categories)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return { ...prev, categories: next }
    })
  }

  function toggleSignal(sig: SignalId) {
    setFilters((prev) => {
      const next = new Set(prev.signals)
      if (next.has(sig)) next.delete(sig)
      else next.add(sig)
      return { ...prev, signals: next }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/exchange"
            className="text-surface-500 hover:text-white transition-colors"
            aria-label="Back to Exchange"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">Market Screener</h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} of ${markets.length} markets`}
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="ml-auto p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-all disabled:opacity-40"
            aria-label="Refresh markets"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Search + filter toggle row */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search markets…"
              value={filters.query}
              onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 rounded-xl',
                'bg-surface-200 border border-surface-300',
                'text-sm text-white placeholder-surface-600',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30',
                'transition-colors'
              )}
              aria-label="Search markets"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-mono transition-all',
              filtersOpen || activeFilterCount > 0
                ? 'bg-for-600/20 border-for-600/50 text-for-400'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
            aria-expanded={filtersOpen}
            aria-label="Toggle filters"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-for-600 text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Sort tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilters((p) => ({ ...p, sort: opt.id }))}
              className={cn(
                'flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                filters.sort === opt.id
                  ? 'bg-for-600/30 text-for-400 border border-for-600/50'
                  : 'bg-surface-200 text-surface-500 border border-surface-300 hover:text-white hover:border-surface-400'
              )}
              aria-pressed={filters.sort === opt.id}
            >
              <opt.icon className="h-3 w-3" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Expanded filter panel */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-4">
                {/* Status */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setFilters((p) => ({ ...p, status: opt.id }))}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                          filters.status === opt.id
                            ? 'bg-for-600/30 text-for-400 border-for-600/50'
                            : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white'
                        )}
                        aria-pressed={filters.status === opt.id}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">
                    Price Range — FOR%: {filters.priceMin}¢ – {filters.priceMax}¢
                  </p>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={filters.priceMin}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setFilters((p) => ({ ...p, priceMin: Math.min(v, p.priceMax - 5) }))
                      }}
                      className="flex-1 h-1.5 accent-for-500 cursor-pointer"
                      aria-label="Minimum price"
                    />
                    <span className="text-xs font-mono text-surface-500 w-8 text-center">–</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={filters.priceMax}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setFilters((p) => ({ ...p, priceMax: Math.max(v, p.priceMin + 5) }))
                      }}
                      className="flex-1 h-1.5 accent-for-500 cursor-pointer"
                      aria-label="Maximum price"
                    />
                  </div>
                  {/* Quick price presets */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[
                      { label: 'Strong FOR', min: 70, max: 100 },
                      { label: 'Contested', min: 40, max: 60 },
                      { label: 'Strong AGAINST', min: 0, max: 30 },
                      { label: 'All', min: 0, max: 100 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setFilters((p) => ({ ...p, priceMin: preset.min, priceMax: preset.max }))}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                          filters.priceMin === preset.min && filters.priceMax === preset.max
                            ? 'bg-for-600/30 text-for-400 border-for-600/50'
                            : 'bg-surface-200 text-surface-600 border-surface-300 hover:text-white'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Signals */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Signals</p>
                  <div className="flex gap-2 flex-wrap">
                    {SIGNAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => toggleSignal(opt.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                          filters.signals.has(opt.id)
                            ? 'bg-surface-300 text-white border-surface-400'
                            : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white'
                        )}
                        aria-pressed={filters.signals.has(opt.id)}
                      >
                        <opt.icon className={cn('h-3 w-3', filters.signals.has(opt.id) ? opt.color : '')} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Category</p>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                          filters.categories.has(cat)
                            ? 'bg-surface-300 text-white border-surface-400'
                            : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white'
                        )}
                        aria-pressed={filters.categories.has(cat)}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', CAT_DOT[cat] ?? 'bg-surface-500')} />
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset */}
                {activeFilterCount > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1.5 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-5 h-4 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <div className="flex gap-3">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                  <Skeleton className="w-12 h-12 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={ArrowUpDown}
            title="Couldn't load markets"
            description={error}
            action={{ label: 'Retry', onClick: () => setRefreshKey((k) => k + 1) }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No markets match"
            description={activeFilterCount > 0 ? 'Try relaxing your filters.' : 'No markets are available right now.'}
            action={activeFilterCount > 0 ? { label: 'Clear filters', onClick: resetFilters } : undefined}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((market, i) => (
              <MarketRow key={market.id} market={market} rank={i + 1} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
