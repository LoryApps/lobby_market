'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SignalGroup, SignalMarket, SignalType, SignalsResponse } from '@/app/api/exchange/signals/route'

// ─── Signal config ────────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<
  SignalType,
  {
    icon: typeof TrendingUp
    color: string
    bg: string
    border: string
    badge: string
    badgeBg: string
  }
> = {
  near_law: {
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/8',
    border: 'border-gold/20',
    badge: 'text-gold',
    badgeBg: 'bg-gold/10',
  },
  strong_for: {
    icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/8',
    border: 'border-for-500/20',
    badge: 'text-for-400',
    badgeBg: 'bg-for-500/10',
  },
  contested: {
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/8',
    border: 'border-purple/20',
    badge: 'text-purple',
    badgeBg: 'bg-purple/10',
  },
  near_failure: {
    icon: TrendingDown,
    color: 'text-against-400',
    bg: 'bg-against-500/8',
    border: 'border-against-500/20',
    badge: 'text-against-400',
    badgeBg: 'bg-against-500/10',
  },
  high_volume: {
    icon: BarChart2,
    color: 'text-emerald',
    bg: 'bg-emerald/8',
    border: 'border-emerald/20',
    badge: 'text-emerald',
    badgeBg: 'bg-emerald/10',
  },
  momentum_up: {
    icon: ArrowUpRight,
    color: 'text-for-300',
    bg: 'bg-for-400/8',
    border: 'border-for-400/20',
    badge: 'text-for-300',
    badgeBg: 'bg-for-400/10',
  },
  momentum_down: {
    icon: ArrowDownRight,
    color: 'text-against-300',
    bg: 'bg-against-400/8',
    border: 'border-against-400/20',
    badge: 'text-against-300',
    badgeBg: 'bg-against-400/10',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function priceBar(price: number, status: string): string {
  if (status === 'law' || price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-500'
  if (price <= 45) return 'bg-against-400'
  return 'bg-surface-400'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDelta(d: number | null): string | null {
  if (d === null) return null
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}¢`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${h}h ago`
}

// ─── Market row ───────────────────────────────────────────────────────────────

function MarketRow({ market }: { market: SignalMarket }) {
  const delta = formatDelta(market.delta_24h)
  const deltaPos = (market.delta_24h ?? 0) > 0
  const deltaNeg = (market.delta_24h ?? 0) < 0

  return (
    <Link
      href={`/exchange/${market.id}`}
      className={cn(
        'block group px-4 py-3.5 rounded-xl border transition-all duration-150',
        'bg-surface-100 border-surface-300/50',
        'hover:border-surface-400/70 hover:bg-surface-200/50',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Price pill */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
          <span className={cn('text-lg font-mono font-bold leading-none', priceColor(market.price, market.status))}>
            {market.price}
          </span>
          <span className="text-[10px] text-surface-500 leading-none">¢</span>
        </div>

        {/* Statement */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-snug mb-1.5">
            {market.statement}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {market.category && (
              <span className={cn('text-xs font-medium', CATEGORY_COLOR[market.category] ?? 'text-surface-500')}>
                {market.category}
              </span>
            )}
            <span className="text-xs text-surface-500">
              {formatVolume(market.volume)} votes
            </span>
            {delta && (
              <span className={cn(
                'text-xs font-mono font-medium',
                deltaPos ? 'text-for-400' : deltaNeg ? 'text-against-400' : 'text-surface-500',
              )}>
                {delta}
              </span>
            )}
          </div>

          {/* Price bar */}
          <div className="mt-2 h-1 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', priceBar(market.price, market.status))}
              style={{ width: `${Math.max(2, market.price)}%` }}
            />
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-400 flex-shrink-0 mt-1" />
      </div>
    </Link>
  )
}

// ─── Signal group card ────────────────────────────────────────────────────────

function SignalCard({ group }: { group: SignalGroup }) {
  const cfg = SIGNAL_CONFIG[group.type]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('rounded-2xl border p-4', cfg.bg, cfg.border)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', cfg.badgeBg)}>
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div>
            <h2 className={cn('text-sm font-mono font-semibold', cfg.color)}>{group.label}</h2>
            <p className="text-xs text-surface-500 mt-0.5 leading-snug max-w-xs">{group.description}</p>
          </div>
        </div>
        <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full', cfg.badgeBg, cfg.badge)}>
          {group.markets.length}
        </span>
      </div>

      {/* Markets */}
      <div className="space-y-2">
        {group.markets.slice(0, 4).map((market) => (
          <MarketRow key={market.id} market={market} />
        ))}
      </div>

      {group.markets.length > 4 && (
        <div className="mt-2 text-center">
          <Link
            href={`/exchange?signal=${group.type}`}
            className={cn('text-xs font-medium', cfg.color, 'hover:underline')}
          >
            +{group.markets.length - 4} more
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SignalsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1.5" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="rounded-xl border border-surface-300/50 bg-surface-100 p-3">
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-8 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function SignalsClient() {
  const [data, setData] = useState<SignalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/exchange/signals', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as SignalsResponse
      setData(json)
    } catch {
      setError('Failed to load signals. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetch_()
  }, [fetch_])

  const relTimeStr = data ? relTime(data.as_of) : null

  return (
    <>
      <TopBar />
      <main id="main-content" className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald" />
              <h1 className="text-sm font-mono font-semibold text-white">Market Signals</h1>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Pattern-based intelligence across all live civic markets
              {relTimeStr && ` · ${relTimeStr}`}
            </p>
          </div>
          <button
            onClick={() => fetch_(true)}
            disabled={loading || refreshing}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors disabled:opacity-40',
            )}
            aria-label="Refresh signals"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Navigation strip back to Exchange */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { href: '/exchange', label: 'All Markets', icon: BarChart2 },
            { href: '/exchange/movers', label: 'Movers', icon: TrendingUp },
            { href: '/exchange/signals', label: 'Signals', icon: Zap, active: true },
            { href: '/exchange/screener', label: 'Screener', icon: Scale },
            { href: '/exchange/flow', label: 'Flow', icon: Activity },
          ].map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                active
                  ? 'bg-emerald/15 text-emerald border border-emerald/30'
                  : 'bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <SignalsSkeleton />
          ) : error ? (
            <EmptyState
              icon={<Flame className="h-8 w-8 text-surface-500" />}
              title="Signals unavailable"
              description={error}
              action={{ label: 'Try again', onClick: () => fetch_() }}
            />
          ) : !data || data.groups.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8 text-surface-500" />}
              title="No signals detected"
              description="No live markets match current signal patterns. Check back as more debates become active."
              action={{ label: 'Browse all markets', href: '/exchange' }}
            />
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {data.groups.map((group) => (
                <SignalCard key={group.type} group={group} />
              ))}

              {/* Footer note */}
              <p className="text-center text-xs text-surface-600 pt-2 pb-4">
                Signals are computed from live market data · Refreshes every 5 min
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </>
  )
}
