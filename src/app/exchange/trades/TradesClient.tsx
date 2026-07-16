'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Trade, TradeStats, TradesResponse } from '@/app/api/exchange/trades/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const REFRESH_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1_000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (s < 60) return `${s}s ago`
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('h-3.5 w-3.5', iconColor ?? 'text-surface-500')} />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold font-mono text-white tabular-nums leading-none">{value}</p>
    </div>
  )
}

// ─── Sentiment bar ────────────────────────────────────────────────────────────

function SentimentBar({ forPct, againstPct }: { forPct: number; againstPct: number }) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-for-400" />
          <span className="text-[10px] font-mono text-for-400 uppercase tracking-wider">For</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-against-400 uppercase tracking-wider">Against</span>
          <ThumbsDown className="h-3 w-3 text-against-400" />
        </div>
      </div>
      <div className="relative h-2 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] font-mono text-for-400 tabular-nums">{forPct}%</span>
        <span className="text-[11px] font-mono text-against-400 tabular-nums">{againstPct}%</span>
      </div>
    </div>
  )
}

// ─── Price bar ────────────────────────────────────────────────────────────────

function PriceBar({ price }: { price: number }) {
  const red = 100 - price
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={cn('text-[10px] font-mono w-7 text-right tabular-nums', priceColor(price, ''))}>
        {price}¢
      </span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${price}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums">{red}¢</span>
    </div>
  )
}

// ─── Trade row ────────────────────────────────────────────────────────────────

function TradeRow({ trade, animate }: { trade: Trade; animate?: boolean }) {
  const isFor = trade.side === 'blue'
  const displayName = trade.display_name || trade.username

  const content = (
    <Link
      href={`/topic/${trade.topic_id}`}
      className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-200 hover:border-surface-400 hover:bg-surface-300 transition-all duration-200 p-3 group"
    >
      {/* Avatar */}
      <Link
        href={`/profile/${trade.username}`}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 mt-0.5"
      >
        <Avatar
          src={trade.avatar_url}
          username={trade.username}
          size="sm"
          className="ring-1 ring-surface-400 group-hover:ring-surface-500 transition-all"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <Link
            href={`/profile/${trade.username}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-white hover:text-for-300 transition-colors shrink-0"
          >
            {displayName}
          </Link>
          <span className="text-xs text-surface-500 shrink-0">went</span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide shrink-0',
              isFor
                ? 'bg-for-500/15 text-for-300 border border-for-500/30'
                : 'bg-against-500/15 text-against-300 border border-against-500/30',
            )}
          >
            {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>

        {/* Topic statement */}
        <p className="text-sm font-mono text-surface-300 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {trade.statement}
        </p>

        {/* Price bar + meta */}
        <PriceBar price={trade.price} />

        <div className="flex items-center gap-2 mt-1.5">
          {trade.category && (
            <span className="text-[10px] font-mono text-surface-600 bg-surface-300 px-1.5 py-0.5 rounded">
              {trade.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {formatVolume(trade.volume)} votes
          </span>
          {trade.status === 'law' && (
            <span className="text-[10px] font-mono text-gold flex items-center gap-0.5">
              <Gavel className="h-2.5 w-2.5" /> Law
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-[10px] font-mono text-surface-600 whitespace-nowrap">
          {relTime(trade.voted_at)}
        </span>
        <ArrowUpRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )

  if (!animate) return content

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {content}
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function TradeSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-200 p-3">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2 mt-1">
          <Skeleton className="h-1.5 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-10 shrink-0" />
    </div>
  )
}

// ─── Category dropdown ────────────────────────────────────────────────────────

function CategoryDropdown({
  selected,
  onChange,
}: {
  selected: string | null
  onChange: (cat: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border transition-all',
          selected
            ? 'border-for-500/40 bg-for-500/10 text-for-300'
            : 'border-surface-400 bg-surface-200 text-surface-400 hover:border-surface-500',
        )}
      >
        {selected ?? 'All categories'}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1.5 z-50 min-w-[160px] rounded-xl border border-surface-400 bg-surface-100 shadow-xl overflow-hidden"
          >
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                !selected ? 'text-for-300 bg-for-500/10' : 'text-surface-400 hover:bg-surface-200',
              )}
            >
              All categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { onChange(cat); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                  selected === cat ? 'text-for-300 bg-for-500/10' : 'text-surface-400 hover:bg-surface-200',
                )}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TradesClient() {
  const [trades, setTrades] = useState<Trade[] | null>(null)
  const [stats, setStats] = useState<TradeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [side, setSide] = useState<'blue' | 'red' | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTradeIds = useRef<Set<string>>(new Set())

  const fetchTrades = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      else setRefreshing(true)

      try {
        const params = new URLSearchParams({ limit: '80' })
        if (category) params.set('category', category)
        if (side) params.set('side', side)

        const res = await fetch(`/api/exchange/trades?${params}`)
        if (!res.ok) throw new Error('Failed to load trades')
        const data = (await res.json()) as TradesResponse

        prevTradeIds.current = new Set(data.trades.map((t) => t.id))
        setTrades(data.trades)
        setStats(data.stats)
        setAsOf(data.as_of)
      } catch (err) {
        console.error('[trades] fetch failed:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [category, side],
  )

  // Initial load + re-fetch on filter change
  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  // Auto-refresh every 30s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      fetchTrades({ silent: true })
    }, REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchTrades])

  // Last-refresh timestamp display
  const lastRefreshLabel = useMemo(() => {
    if (!asOf) return null
    return relTime(asOf)
  }, [asOf])

  // Determine which trades are "new" after a silent refresh
  const isNewTrade = useCallback(
    (id: string) => !prevTradeIds.current.has(id),
    [],
  )

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-16">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 pt-4 mb-5">
          <div className="flex items-start gap-3">
            <Link
              href="/exchange"
              className="mt-1 p-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors text-surface-500 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-white">Live Trades</h1>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-against-500/15 border border-against-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-against-300 uppercase tracking-wider">Live</span>
                </span>
              </div>
              <p className="text-xs font-mono text-surface-500">
                Civic market activity · real-time
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchTrades({ silent: true })}
            disabled={refreshing}
            className={cn(
              'mt-1 p-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors text-surface-500 hover:text-white',
              refreshing && 'opacity-60 cursor-not-allowed',
            )}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Stats grid ──────────────────────────────────────────────────── */}
        {loading && !stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-200 p-3">
                <Skeleton className="h-4 w-16 mb-1.5" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard
              label="24h trades"
              value={formatVolume(stats.trades_24h)}
              icon={Activity}
              iconColor="text-for-400"
            />
            <StatCard
              label="Markets"
              value={stats.active_markets_24h}
              icon={BarChart2}
              iconColor="text-purple"
            />
            <StatCard
              label="Traders"
              value={stats.unique_traders_24h}
              icon={Users}
              iconColor="text-emerald"
            />
            <StatCard
              label="Top category"
              value={stats.busiest_category ?? '—'}
              icon={Flame}
              iconColor="text-gold"
            />
          </div>
        ) : null}

        {/* ── 24h sentiment bar ───────────────────────────────────────────── */}
        {stats && (
          <div className="mb-5">
            <SentimentBar forPct={stats.for_pct} againstPct={stats.against_pct} />
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Side filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
            {([null, 'blue', 'red'] as const).map((s) => (
              <button
                key={String(s)}
                onClick={() => setSide(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                  side === s
                    ? s === 'blue'
                      ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                      : s === 'red'
                        ? 'bg-against-500/20 text-against-300 border border-against-500/30'
                        : 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-400',
                )}
              >
                {s === null ? 'All' : s === 'blue' ? 'FOR' : 'AGAINST'}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <CategoryDropdown selected={category} onChange={setCategory} />

          {/* Last refresh indicator */}
          {asOf && (
            <span className="ml-auto text-[10px] font-mono text-surface-600 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefreshLabel}
            </span>
          )}
        </div>

        {/* ── Trades list ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <TradeSkeleton key={i} />
            ))}
          </div>
        ) : !trades || trades.length === 0 ? (
          <EmptyState
            icon={Activity}
            iconColor="text-surface-500"
            title="No trades yet"
            description={
              category || side
                ? 'No activity matches these filters. Try broadening your search.'
                : 'No recent market activity. Check back soon.'
            }
            action={{
              label: 'View all markets',
              href: '/exchange',
            }}
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {trades.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  animate={isNewTrade(trade.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {trades && trades.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-[11px] font-mono text-surface-600">
              Showing {trades.length} most recent{' '}
              {side === 'blue' ? 'FOR' : side === 'red' ? 'AGAINST' : ''} positions
              {category ? ` in ${category}` : ''} · auto-refreshes every 30s
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Link
                href="/exchange"
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                All Markets
              </Link>
              <Link
                href="/exchange/movers"
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Movers
              </Link>
              <Link
                href="/exchange/leaderboard"
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <Trophy className="h-3.5 w-3.5" />
                Leaderboard
              </Link>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

