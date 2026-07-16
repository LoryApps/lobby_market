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
  Bell,
  ChevronRight,
  Flame,
  Gavel,
  Minus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Volume2,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  WrapResponse,
  WrapMove,
  CategoryWrap,
  DailyEvent,
  MarketSentiment,
} from '@/app/api/exchange/wrap/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${h}h ago`
}

// ─── Sentiment badge ──────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  bullish:  { label: 'BULLISH',  bg: 'bg-for-500/20',      text: 'text-for-300',      border: 'border-for-500/40',      icon: TrendingUp },
  bearish:  { label: 'BEARISH',  bg: 'bg-against-500/20',  text: 'text-against-300',  border: 'border-against-500/40',  icon: TrendingDown },
  neutral:  { label: 'NEUTRAL',  bg: 'bg-surface-300/40',  text: 'text-surface-400',  border: 'border-surface-400/30',  icon: Minus },
  mixed:    { label: 'MIXED',    bg: 'bg-gold/10',          text: 'text-gold',          border: 'border-gold/30',          icon: Scale },
} as const

// ─── Category color ───────────────────────────────────────────────────────────

function catColor(color: string) {
  const map: Record<string, { bg: string; text: string; bar: string }> = {
    gold:     { bg: 'bg-gold/10',         text: 'text-gold',      bar: 'bg-gold' },
    for:      { bg: 'bg-for-500/10',      text: 'text-for-400',   bar: 'bg-for-500' },
    purple:   { bg: 'bg-purple/10',       text: 'text-purple',    bar: 'bg-purple' },
    emerald:  { bg: 'bg-emerald/10',      text: 'text-emerald',   bar: 'bg-emerald' },
    against:  { bg: 'bg-against-500/10',  text: 'text-against-400', bar: 'bg-against-500' },
    surface:  { bg: 'bg-surface-300/30',  text: 'text-surface-500', bar: 'bg-surface-400' },
  }
  return map[color] ?? map.surface
}

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<DailyEvent['type'], {
  icon: typeof Gavel
  label: string
  color: string
}> = {
  became_law:       { icon: Gavel,         label: 'LAW',          color: 'text-gold border-gold/30 bg-gold/10' },
  failed:           { icon: XCircle,       label: 'FAILED',       color: 'text-against-400 border-against-500/30 bg-against-500/10' },
  entered_voting:   { icon: Scale,         label: 'VOTING',       color: 'text-purple border-purple/30 bg-purple/10' },
  big_move_up:      { icon: TrendingUp,    label: 'SURGE',        color: 'text-for-300 border-for-500/30 bg-for-500/10' },
  big_move_down:    { icon: TrendingDown,  label: 'DECLINE',      color: 'text-against-300 border-against-500/30 bg-against-500/10' },
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: MarketSentiment['sentiment'] }) {
  const cfg = SENTIMENT_CONFIG[sentiment]
  const Icon = cfg.icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold tracking-widest',
      cfg.bg, cfg.text, cfg.border,
    )}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function MoveRow({ move, dir }: { move: WrapMove; dir: 'up' | 'down' }) {
  const Icon = dir === 'up' ? ArrowUpRight : ArrowDownRight
  const deltaColor = dir === 'up' ? 'text-for-300' : 'text-against-300'
  const sign = dir === 'up' ? '+' : ''

  return (
    <Link
      href={`/topic/${move.id}`}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        'bg-surface-100/30 border-surface-400/20',
        'hover:bg-surface-200/40 hover:border-surface-400/40 transition-colors',
        'group',
      )}
    >
      <div className={cn(
        'flex-shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full',
        dir === 'up' ? 'bg-for-500/15' : 'bg-against-500/15',
      )}>
        <Icon className={cn('h-4 w-4', deltaColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-surface-900 leading-snug line-clamp-2">
          {move.statement}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {move.category && (
            <span className="text-[10px] text-surface-500 font-medium">{move.category}</span>
          )}
          <span className="text-[10px] text-surface-500">{formatVolume(move.volume)} votes</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className={cn('text-sm font-mono font-bold', deltaColor)}>
          {sign}{move.delta.toFixed(1)}¢
        </div>
        <div className="text-[10px] text-surface-500 font-mono">{move.current_price}¢</div>
      </div>
    </Link>
  )
}

function CategoryBar({ cat }: { cat: CategoryWrap }) {
  const colors = catColor(cat.color)
  const pct = Math.round(cat.avg_consensus)
  const barWidth = `${pct}%`

  return (
    <div className={cn('flex items-center gap-3 p-2.5 rounded-lg border', colors.bg, 'border-surface-400/20')}>
      <div className="flex-shrink-0 w-24 truncate">
        <span className={cn('text-xs font-semibold', colors.text)}>{cat.category}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-surface-300/30 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', colors.bar)}
            initial={{ width: 0 }}
            animate={{ width: barWidth }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <span className="text-xs font-mono text-surface-600">{pct}¢</span>
      </div>

      <div className="flex-shrink-0 text-right w-10">
        <span className="text-[10px] text-surface-500">{cat.active_count} live</span>
      </div>
    </div>
  )
}

function EventCard({ event }: { event: DailyEvent }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  return (
    <Link
      href={`/topic/${event.id}`}
      className="flex items-start gap-3 p-3 rounded-lg border border-surface-400/20 bg-surface-100/20 hover:bg-surface-200/30 transition-colors group"
    >
      <div className={cn(
        'flex-shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full border',
        cfg.color,
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border', cfg.color)}>
            {cfg.label}
          </span>
          {event.category && (
            <span className="text-[10px] text-surface-500">{event.category}</span>
          )}
        </div>
        <p className="text-sm text-surface-700 group-hover:text-surface-900 leading-snug line-clamp-2">
          {event.statement}
        </p>
        <p className="text-[10px] text-surface-500 mt-0.5">{event.detail}</p>
      </div>

      <div className="flex-shrink-0">
        <span className="text-xs font-mono text-surface-600">{event.price}¢</span>
      </div>
    </Link>
  )
}

function ActiveMoveRow({ move }: { move: WrapMove }) {
  return (
    <Link
      href={`/topic/${move.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-surface-400/20 bg-surface-100/20 hover:bg-surface-200/30 transition-colors group"
    >
      <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-purple/10 border border-purple/20">
        <Volume2 className="h-3.5 w-3.5 text-purple" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-surface-900 leading-snug line-clamp-2">
          {move.statement}
        </p>
        {move.category && (
          <span className="text-[10px] text-surface-500">{move.category}</span>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-mono text-purple">+{formatVolume(move.vol_delta)}</div>
        <div className="text-[10px] text-surface-500">{formatVolume(move.volume)} total</div>
      </div>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function WrapSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WrapClient() {
  const [data, setData] = useState<WrapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [asOf, setAsOf] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/wrap', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as WrapResponse
        setData(json)
        setAsOf(json.as_of)
      }
    } catch {
      // swallow — empty state handles
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const sentiment = data?.sentiment

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/exchange"
              className="p-2 rounded-lg hover:bg-surface-200/40 transition-colors text-surface-500 hover:text-surface-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-surface-900 tracking-tight">Daily Wrap</h1>
              {data?.date && (
                <p className="text-xs text-surface-500">{data.date}</p>
              )}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-surface-200/40 transition-colors text-surface-500 hover:text-surface-700 disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {loading ? (
            <WrapSkeleton />
          ) : !data ? (
            <EmptyState
              icon={Activity}
              title="Market data unavailable"
              description="We couldn't load the daily wrap. Try refreshing."
              action={{ label: 'Retry', onClick: load }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="wrap-content"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Headline card */}
                <div className={cn(
                  'p-4 rounded-xl border',
                  sentiment?.sentiment === 'bullish'
                    ? 'bg-for-900/30 border-for-700/40'
                    : sentiment?.sentiment === 'bearish'
                      ? 'bg-against-900/30 border-against-700/40'
                      : 'bg-surface-100/40 border-surface-400/30',
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full border mt-0.5',
                      sentiment?.sentiment === 'bullish'
                        ? 'bg-for-500/20 border-for-500/40'
                        : sentiment?.sentiment === 'bearish'
                          ? 'bg-against-500/20 border-against-500/40'
                          : 'bg-surface-200/40 border-surface-400/30',
                    )}>
                      <BarChart2 className={cn(
                        'h-4 w-4',
                        sentiment?.sentiment === 'bullish' ? 'text-for-300'
                          : sentiment?.sentiment === 'bearish' ? 'text-against-300'
                            : 'text-surface-500',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-800 leading-snug">
                        {data.headline}
                      </p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <SentimentBadge sentiment={sentiment!.sentiment} />
                        <span className="text-[10px] text-surface-500 font-mono">
                          {formatVolume(sentiment!.total_volume)} votes · {sentiment!.total_markets} markets
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      label: 'Advancing',
                      value: sentiment!.advancing,
                      color: 'text-for-300',
                      icon: TrendingUp,
                      iconColor: 'text-for-500',
                    },
                    {
                      label: 'Declining',
                      value: sentiment!.declining,
                      color: 'text-against-300',
                      icon: TrendingDown,
                      iconColor: 'text-against-500',
                    },
                    {
                      label: 'Avg. Price',
                      value: `${sentiment!.avg_consensus}¢`,
                      color: 'text-surface-600',
                      icon: Scale,
                      iconColor: 'text-surface-500',
                    },
                    {
                      label: 'Volume',
                      value: formatVolume(sentiment!.total_volume),
                      color: 'text-purple',
                      icon: Volume2,
                      iconColor: 'text-purple',
                    },
                  ].map((stat) => {
                    const Icon = stat.icon
                    return (
                      <div
                        key={stat.label}
                        className="p-3 rounded-lg border border-surface-400/20 bg-surface-100/30 text-center"
                      >
                        <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', stat.iconColor)} />
                        <div className={cn('text-sm font-bold font-mono', stat.color)}>{stat.value}</div>
                        <div className="text-[9px] text-surface-500 mt-0.5">{stat.label}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Market breadth bar */}
                <div className="p-3 rounded-lg border border-surface-400/20 bg-surface-100/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-surface-600">Market Breadth</span>
                    <span className="text-xs font-mono text-surface-500">
                      {Math.round(sentiment!.breadth * 100)}% advancing
                    </span>
                  </div>
                  <div className="h-2 bg-against-900/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-for-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(sentiment!.breadth * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Top Gainers & Losers */}
                {(data.gainers.length > 0 || data.losers.length > 0) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {data.gainers.length > 0 && (
                      <div>
                        <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-for-500" />
                          Top Gainers
                        </h2>
                        <div className="space-y-2">
                          {data.gainers.slice(0, 4).map((m) => (
                            <MoveRow key={m.id} move={m} dir="up" />
                          ))}
                        </div>
                      </div>
                    )}

                    {data.losers.length > 0 && (
                      <div>
                        <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <TrendingDown className="h-3.5 w-3.5 text-against-500" />
                          Biggest Losers
                        </h2>
                        <div className="space-y-2">
                          {data.losers.slice(0, 4).map((m) => (
                            <MoveRow key={m.id} move={m} dir="down" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Category performance */}
                {data.categories.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
                      Category Consensus
                    </h2>
                    <div className="space-y-1.5">
                      {data.categories.map((cat) => (
                        <CategoryBar key={cat.category} cat={cat} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Most Active */}
                {data.most_active.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Flame className="h-3.5 w-3.5 text-purple" />
                      Most Active Today
                    </h2>
                    <div className="space-y-2">
                      {data.most_active.slice(0, 4).map((m) => (
                        <ActiveMoveRow key={m.id} move={m} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Notable Events */}
                {data.events.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-gold" />
                      Notable Events
                    </h2>
                    <div className="space-y-2">
                      {data.events.map((event, i) => (
                        <EventCard key={`${event.type}-${event.id}-${i}`} event={event} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state for no moves */}
                {data.gainers.length === 0 && data.losers.length === 0 && data.events.length === 0 && (
                  <EmptyState
                    icon={Activity}
                    title="Markets are quiet"
                    description="No significant price movements in the last 24 hours. Check back later."
                  />
                )}

                {/* Footer */}
                <div className="pt-2 border-t border-surface-300/30 flex items-center justify-between">
                  <p className="text-[10px] text-surface-500">
                    {asOf ? `Updated ${relTime(asOf)}` : 'Live data'}
                  </p>
                  <div className="flex items-center gap-3">
                    <Link href="/exchange/movers" className="text-[10px] text-surface-500 hover:text-surface-700 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Movers
                    </Link>
                    <Link href="/exchange/flow" className="text-[10px] text-surface-500 hover:text-surface-700 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Flow
                    </Link>
                    <Link href="/exchange" className="text-[10px] text-surface-500 hover:text-surface-700 flex items-center gap-1">
                      Markets
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
