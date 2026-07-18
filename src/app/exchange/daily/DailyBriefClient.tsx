'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Briefcase,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DailyBriefResponse,
  DailyMover,
  DailyLawWatch,
  DailyEvent,
  DailyForYou,
  DailyPortfolioSummary,
} from '@/app/api/exchange/daily/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${h}h ago`
}

function fmtPnl(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}¢`
}

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<DailyEvent['type'], {
  icon: typeof Gavel
  label: string
  color: string
}> = {
  became_law:     { icon: Gavel,        label: 'LAW',     color: 'text-gold border-gold/30 bg-gold/10' },
  failed:         { icon: XCircle,      label: 'FAILED',  color: 'text-against-400 border-against-500/30 bg-against-500/10' },
  entered_voting: { icon: Scale,        label: 'VOTING',  color: 'text-purple border-purple/30 bg-purple/10' },
  big_move_up:    { icon: TrendingUp,   label: 'SURGE',   color: 'text-for-300 border-for-500/30 bg-for-500/10' },
  big_move_down:  { icon: TrendingDown, label: 'DECLINE', color: 'text-against-300 border-against-500/30 bg-against-500/10' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PortfolioCard({ p }: { p: DailyPortfolioSummary }) {
  const pnlPositive = p.today_pnl > 0
  const pnlNeutral = p.today_pnl === 0

  return (
    <div className={cn(
      'p-4 rounded-xl border',
      pnlPositive
        ? 'bg-for-900/20 border-for-700/30'
        : pnlNeutral
          ? 'bg-surface-100/40 border-surface-400/30'
          : 'bg-against-900/20 border-against-700/30',
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Your Portfolio Today
          </h2>
          <div className={cn(
            'text-2xl font-bold font-mono mt-1',
            pnlPositive ? 'text-for-300' : pnlNeutral ? 'text-surface-600' : 'text-against-300',
          )}>
            {fmtPnl(p.today_pnl)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-surface-500">{p.open_positions} open</div>
          <div className="text-[10px] text-surface-400">{p.total_positions} total</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-for-500/10 border border-for-500/20 text-center">
          <div className="text-sm font-bold text-for-300">{p.winning_today}</div>
          <div className="text-[9px] text-surface-500 uppercase tracking-wide">Winning</div>
        </div>
        <div className="p-2 rounded-lg bg-against-500/10 border border-against-500/20 text-center">
          <div className="text-sm font-bold text-against-300">{p.losing_today}</div>
          <div className="text-[9px] text-surface-500 uppercase tracking-wide">Losing</div>
        </div>
      </div>

      {(p.best_today || p.worst_today) && (
        <div className="space-y-1.5 border-t border-surface-400/20 pt-3">
          {p.best_today && (
            <Link
              href={`/topic/${p.best_today.id}`}
              className="flex items-center gap-2 group"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
              <span className="text-xs text-surface-600 group-hover:text-surface-800 truncate flex-1 leading-tight">
                {p.best_today.statement}
              </span>
              <span className="text-xs font-mono text-for-300 flex-shrink-0">{fmtPnl(p.best_today.pnl)}</span>
            </Link>
          )}
          {p.worst_today && (
            <Link
              href={`/topic/${p.worst_today.id}`}
              className="flex items-center gap-2 group"
            >
              <ArrowDownRight className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
              <span className="text-xs text-surface-600 group-hover:text-surface-800 truncate flex-1 leading-tight">
                {p.worst_today.statement}
              </span>
              <span className="text-xs font-mono text-against-300 flex-shrink-0">{fmtPnl(p.worst_today.pnl)}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function MoverRow({ mover, dir }: { mover: DailyMover; dir: 'up' | 'down' }) {
  const Icon = dir === 'up' ? ArrowUpRight : ArrowDownRight
  const deltaColor = dir === 'up' ? 'text-for-300' : 'text-against-300'
  const sign = dir === 'up' ? '+' : ''

  return (
    <Link
      href={`/topic/${mover.id}`}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        'bg-surface-100/30 border-surface-400/20',
        'hover:bg-surface-200/40 hover:border-surface-400/40 transition-colors group',
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
          {mover.statement}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {mover.category && (
            <span className="text-[10px] text-surface-500 font-medium">{mover.category}</span>
          )}
          {mover.is_near_law && (
            <span className="text-[9px] font-mono font-bold text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded">
              NEAR LAW
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className={cn('text-sm font-mono font-bold', deltaColor)}>
          {sign}{mover.delta}¢
        </div>
        <div className="text-[10px] text-surface-500 font-mono">{mover.current_price}%</div>
      </div>
    </Link>
  )
}

function LawWatchCard({ item }: { item: DailyLawWatch }) {
  const pct = item.blue_pct
  const pctColor = pct >= 60 ? 'text-for-300' : pct <= 40 ? 'text-against-300' : 'text-surface-600'
  const barColor = pct >= 60 ? 'bg-for-500' : pct <= 40 ? 'bg-against-500' : 'bg-surface-500'

  return (
    <Link
      href={`/topic/${item.id}`}
      className={cn(
        'p-3 rounded-lg border transition-colors group',
        item.voted_side === 'blue'
          ? 'bg-for-900/15 border-for-700/25 hover:border-for-700/40'
          : item.voted_side === 'red'
            ? 'bg-against-900/15 border-against-700/25 hover:border-against-700/40'
            : 'bg-surface-100/30 border-surface-400/20 hover:bg-surface-200/40',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm text-surface-700 group-hover:text-surface-900 leading-snug line-clamp-2 flex-1">
          {item.statement}
        </p>
        {item.voted_side && (
          <span className={cn(
            'flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
            item.voted_side === 'blue'
              ? 'text-for-300 border-for-500/30 bg-for-500/10'
              : 'text-against-300 border-against-500/30 bg-against-500/10',
          )}>
            {item.voted_side === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
        )}
      </div>

      <div className="h-1.5 bg-surface-300/30 rounded-full overflow-hidden mb-2">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-mono font-bold', pctColor)}>{pct}% FOR</span>
        <div className="flex items-center gap-2">
          {item.category && (
            <span className="text-[10px] text-surface-500">{item.category}</span>
          )}
          {item.hours_left !== null && (
            <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {item.hours_left}h left
            </span>
          )}
        </div>
      </div>
    </Link>
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
    </Link>
  )
}

function ForYouCard({ item }: { item: DailyForYou }) {
  return (
    <Link
      href={`/topic/${item.id}`}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors group',
        item.is_hot
          ? 'bg-gold/5 border-gold/20 hover:border-gold/40'
          : 'bg-surface-100/30 border-surface-400/20 hover:bg-surface-200/40',
      )}
    >
      <div className={cn(
        'flex-shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full border',
        item.is_hot
          ? 'bg-gold/15 border-gold/30'
          : 'bg-purple/10 border-purple/20',
      )}>
        {item.is_hot
          ? <Flame className="h-3.5 w-3.5 text-gold" />
          : <Sparkles className="h-3.5 w-3.5 text-purple" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-surface-900 leading-snug line-clamp-2">
          {item.statement}
        </p>
        <p className="text-[10px] text-surface-500 mt-0.5">{item.reason}</p>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-mono font-bold text-surface-600">{item.blue_pct}%</div>
        <div className="text-[10px] text-surface-400">{item.total_votes} votes</div>
      </div>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DailySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
      <Skeleton className="h-5 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
      <Skeleton className="h-5 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyBriefClient() {
  const [data, setData] = useState<DailyBriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [asOf, setAsOf] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/daily', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as DailyBriefResponse
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

  const stats = data?.market_stats

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
              <h1 className="text-lg font-bold text-surface-900 tracking-tight">Daily Brief</h1>
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
            <DailySkeleton />
          ) : !data ? (
            <EmptyState
              icon={Activity}
              title="Market data unavailable"
              description="We couldn't load today's brief. Try refreshing."
              action={{ label: 'Retry', onClick: load }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="daily-content"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >

                {/* Market stats */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Active', value: stats!.total_active, color: 'text-for-300', icon: Activity, iconColor: 'text-for-500' },
                    { label: 'Voting', value: stats!.in_voting, color: 'text-purple', icon: Scale, iconColor: 'text-purple' },
                    { label: 'Laws Today', value: stats!.laws_today, color: 'text-gold', icon: Gavel, iconColor: 'text-gold' },
                    { label: 'Consensus', value: `${stats!.avg_consensus}%`, color: 'text-surface-600', icon: TrendingUp, iconColor: 'text-surface-500' },
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

                {/* Portfolio summary */}
                {data.portfolio && (
                  <PortfolioCard p={data.portfolio} />
                )}

                {/* Top movers */}
                {(data.top_gainers.length > 0 || data.top_losers.length > 0) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {data.top_gainers.length > 0 && (
                      <div>
                        <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-for-500" />
                          Top Gainers
                        </h2>
                        <div className="space-y-2">
                          {data.top_gainers.map((m) => (
                            <MoverRow key={m.id} mover={m} dir="up" />
                          ))}
                        </div>
                      </div>
                    )}

                    {data.top_losers.length > 0 && (
                      <div>
                        <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <TrendingDown className="h-3.5 w-3.5 text-against-500" />
                          Biggest Declines
                        </h2>
                        <div className="space-y-2">
                          {data.top_losers.map((m) => (
                            <MoverRow key={m.id} mover={m} dir="down" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Law watch */}
                {data.law_watch.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5 text-purple" />
                      Law Watch
                    </h2>
                    <div className="space-y-2">
                      {data.law_watch.map((item) => (
                        <LawWatchCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Today's events */}
                {data.events.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-gold" />
                      Today&apos;s Events
                    </h2>
                    <div className="space-y-2">
                      {data.events.map((event, i) => (
                        <EventCard key={`${event.type}-${event.id}-${i}`} event={event} />
                      ))}
                    </div>
                  </div>
                )}

                {/* For You */}
                {data.for_you.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-emerald" />
                      For You
                    </h2>
                    <div className="space-y-2">
                      {data.for_you.map((item) => (
                        <ForYouCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {data.top_gainers.length === 0 &&
                  data.top_losers.length === 0 &&
                  data.events.length === 0 &&
                  data.law_watch.length === 0 && (
                  <EmptyState
                    icon={Activity}
                    title="Markets are quiet"
                    description="No significant activity today — check back later."
                  />
                )}

                {/* Footer */}
                <div className="pt-2 border-t border-surface-300/30 flex items-center justify-between">
                  <p className="text-[10px] text-surface-500">
                    {asOf ? `Updated ${relTime(asOf)}` : 'Live data'}
                  </p>
                  <div className="flex items-center gap-3">
                    <Link href="/exchange/wrap" className="text-[10px] text-surface-500 hover:text-surface-700 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Daily Wrap
                    </Link>
                    <Link href="/exchange/movers" className="text-[10px] text-surface-500 hover:text-surface-700 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Movers
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
