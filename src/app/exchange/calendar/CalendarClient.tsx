'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Gavel,
  RefreshCw,
  Scale,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CalendarGroup, CalendarMarket, CalendarResponse } from '@/app/api/exchange/calendar/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceTextColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-500'
}

function priceBarColor(price: number): string {
  if (price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-600'
  if (price <= 45) return 'bg-against-500'
  return 'bg-surface-500'
}

function formatCountdown(market: CalendarMarket): string {
  if (market.is_overdue) return 'Overdue'
  if (market.days_until === 0 && market.hours_until < 1) return 'Closing soon'
  if (market.days_until === 0) return `${market.hours_until}h left`
  if (market.days_until === 1) return `1d ${market.hours_until}h`
  return `${market.days_until}d`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function groupLabelColor(label: string): string {
  if (label === 'Overdue') return 'text-against-400'
  if (label === 'Today') return 'text-gold'
  if (label === 'Tomorrow') return 'text-for-400'
  return 'text-surface-500'
}

function groupLabelIcon(label: string) {
  if (label === 'Overdue') return <AlertTriangle className="w-3 h-3 text-against-400" />
  if (label === 'Today') return <Zap className="w-3 h-3 text-gold" />
  if (label === 'Tomorrow') return <Timer className="w-3 h-3 text-for-400" />
  return <Calendar className="w-3 h-3 text-surface-400" />
}

// ─── Market row ───────────────────────────────────────────────────────────────

function MarketRow({ market }: { market: CalendarMarket }) {
  const countdown = formatCountdown(market)

  return (
    <Link
      href={`/exchange/${market.id}`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-200 transition-colors group"
    >
      {/* Urgency indicator */}
      <div className="flex-shrink-0 w-1.5 self-stretch rounded-full"
        style={{
          background: market.is_overdue
            ? 'rgb(239 68 68 / 0.6)'
            : market.is_urgent
              ? 'rgb(234 179 8 / 0.6)'
              : market.is_near_law
                ? 'rgb(234 179 8 / 0.3)'
                : 'rgb(100 116 139 / 0.2)',
        }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-800 font-medium line-clamp-2 group-hover:text-surface-900 leading-snug">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {market.category && (
            <span className="text-[10px] text-surface-500">{market.category}</span>
          )}
          {market.is_near_law && (
            <span className="flex items-center gap-0.5 text-[10px] text-gold font-semibold">
              <Gavel className="w-2.5 h-2.5" />
              Near Law
            </span>
          )}
          {market.is_deadlocked && !market.is_near_law && (
            <span className="flex items-center gap-0.5 text-[10px] text-surface-500 font-medium">
              <Scale className="w-2.5 h-2.5" />
              Contested
            </span>
          )}
          <span className="text-[10px] text-surface-500">
            Vol {formatVolume(market.volume)}
          </span>
        </div>
      </div>

      {/* Right: countdown + price */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <Clock className={cn(
            'w-3 h-3',
            market.is_overdue ? 'text-against-400' :
            market.is_urgent ? 'text-gold' :
            'text-surface-500'
          )} />
          <span className={cn(
            'text-[11px] font-bold',
            market.is_overdue ? 'text-against-400' :
            market.is_urgent ? 'text-gold' :
            'text-surface-600'
          )}>
            {countdown}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1 bg-surface-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', priceBarColor(market.price))}
              style={{ width: `${market.price}%` }}
            />
          </div>
          <span className={cn('text-xs font-bold tabular-nums w-7 text-right', priceTextColor(market.price))}>
            {market.price}¢
          </span>
        </div>
        <ChevronRight className="w-3 h-3 text-surface-400 group-hover:text-surface-600 self-end" />
      </div>
    </Link>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({ group }: { group: CalendarGroup }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {groupLabelIcon(group.label)}
        <span className={cn('text-[11px] font-bold uppercase tracking-widest', groupLabelColor(group.label))}>
          {group.label}
        </span>
        <span className="text-[10px] text-surface-500 ml-auto">
          {group.markets.length} {group.markets.length === 1 ? 'market' : 'markets'}
        </span>
      </div>
      <div className="bg-surface-100 border border-surface-200 rounded-xl overflow-hidden divide-y divide-surface-200">
        {group.markets.map((market) => (
          <MarketRow key={market.id} market={market} />
        ))}
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CalendarClient() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/exchange/calendar')
      if (!res.ok) throw new Error('Failed to load')
      const json: CalendarResponse = await res.json()
      setData(json)
    } catch {
      // keep existing data on refresh failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const asOf = data
    ? new Date(data.as_of).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24">
        {/* Header */}
        <div className="sticky top-14 z-10 bg-surface-50/90 backdrop-blur border-b border-surface-200">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link
              href="/exchange"
              className="flex items-center gap-1.5 text-surface-500 hover:text-surface-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Exchange
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-surface-900 text-base leading-none">
                Market Calendar
              </h1>
              {asOf && (
                <div className="text-[10px] text-surface-500 mt-0.5">Updated {asOf}</div>
              )}
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 disabled:opacity-40"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Exchange sub-nav */}
          <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none text-xs">
            {(
              [
                { href: '/exchange', label: 'Markets' },
                { href: '/exchange/movers', label: 'Movers' },
                { href: '/exchange/categories', label: 'Sectors' },
                { href: '/exchange/indices', label: 'Indices' },
                { href: '/exchange/calendar', label: 'Calendar', active: true },
                { href: '/exchange/correlations', label: 'Correlations' },
                { href: '/exchange/portfolio', label: 'Portfolio' },
                { href: '/exchange/leaderboard', label: 'Leaderboard' },
              ] as { href: string; label: string; active?: boolean }[]
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-full font-medium transition-colors',
                  item.active
                    ? 'bg-for-500 text-white'
                    : 'text-surface-500 hover:text-surface-800 hover:bg-surface-200',
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Stats banner */}
          {data && (data.closing_today > 0 || data.overdue_count > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              {data.closing_today > 0 && (
                <div className="flex-1 bg-gold/10 border border-gold/25 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gold flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-gold">{data.closing_today}</div>
                    <div className="text-[10px] text-surface-500">closing today</div>
                  </div>
                </div>
              )}
              {data.overdue_count > 0 && (
                <div className="flex-1 bg-against-500/10 border border-against-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-against-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-against-400">{data.overdue_count}</div>
                    <div className="text-[10px] text-surface-500">overdue</div>
                  </div>
                </div>
              )}
              <div className="flex-1 bg-surface-100 border border-surface-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-surface-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-surface-700">{data.total}</div>
                  <div className="text-[10px] text-surface-500">scheduled</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Calendar groups */}
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-36 rounded-xl" />
                </div>
              ))}
            </div>
          ) : !data || data.groups.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No scheduled markets"
              description="Markets with voting deadlines will appear here as they are created."
              action={{ label: 'Browse Markets', href: '/exchange' }}
            />
          ) : (
            <div className="space-y-6">
              {data.groups.map((group) => (
                <GroupSection key={group.date_key} group={group} />
              ))}

              <div className="flex items-center gap-2 text-xs text-surface-500 justify-center py-2">
                <TrendingUp className="w-3.5 h-3.5 text-for-400" />
                <span className="text-for-300">FOR</span>
                <div className="w-16 h-1 bg-gradient-to-r from-against-600 via-surface-400 to-gold rounded-full" />
                <span className="text-against-400">AGAINST</span>
                <TrendingDown className="w-3.5 h-3.5 text-against-400" />
              </div>

              <Link
                href="/exchange/resolved"
                className="flex items-center justify-center gap-2 py-3 text-sm text-surface-500 hover:text-surface-800 transition-colors"
              >
                View resolved markets
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
