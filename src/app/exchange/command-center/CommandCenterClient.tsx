'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bell,
  Bookmark,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  Lightbulb,
  LogIn,
  Minus,
  RefreshCw,
  Scale,
  Target,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CommandCenterResponse } from '@/app/api/exchange/command-center/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

function priceBg(price: number, status: string): string {
  if (status === 'law') return 'bg-gold/10 border-gold/30'
  if (status === 'failed') return 'bg-surface-300/20 border-surface-400/30'
  if (price >= 60) return 'bg-for-900/30 border-for-800/40'
  if (price <= 40) return 'bg-against-950/30 border-against-800/40'
  return 'bg-surface-200/30 border-surface-400/30'
}

function outcomeConfig(outcome: string, _side: 'blue' | 'red') {
  if (outcome === 'settled_win')
    return { label: 'Won', icon: CheckCircle2, color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (outcome === 'settled_loss')
    return { label: 'Lost', icon: XCircle, color: 'text-against-400', bg: 'bg-against-900/30 border-against-700/30' }
  if (outcome === 'winning')
    return { label: 'Winning', icon: TrendingUp, color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (outcome === 'losing')
    return { label: 'Losing', icon: TrendingDown, color: 'text-against-400', bg: 'bg-against-900/30 border-against-700/30' }
  return { label: 'Push', icon: Minus, color: 'text-surface-500', bg: 'bg-surface-300/20 border-surface-400/30' }
}

function directionBadge(dir: string) {
  if (dir === 'for' || dir === 'bullish')
    return 'bg-for-500/15 border-for-500/30 text-for-300'
  if (dir === 'against' || dir === 'bearish')
    return 'bg-against-500/15 border-against-500/30 text-against-300'
  return 'bg-surface-300/20 border-surface-400/30 text-surface-400'
}

function directionLabel(dir: string) {
  if (dir === 'for') return 'FOR'
  if (dir === 'against') return 'AGAINST'
  if (dir === 'bullish') return 'BULLISH'
  if (dir === 'bearish') return 'BEARISH'
  return 'NEUTRAL'
}

function horizonLabel(h: string) {
  const map: Record<string, string> = {
    '7d': '1W', '14d': '2W', '30d': '1M', '90d': '3M', '180d': '6M',
  }
  return map[h] ?? h
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  href,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: number
  href?: string
  iconClass?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass ?? 'text-surface-500')} />
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-widest">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[11px] font-mono text-surface-600 bg-surface-300/20 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-surface-600 hover:text-white transition-colors"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  subValue,
  color,
  icon: Icon,
}: {
  label: string
  value: string | number
  subValue?: string
  color?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl bg-surface-200/40 border border-surface-300/50 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', color ?? 'text-surface-500')} />
        <span className="text-[11px] font-mono uppercase tracking-widest text-surface-600">{label}</span>
      </div>
      <div className={cn('text-xl font-bold font-mono', color ?? 'text-surface-300')}>
        {value}
      </div>
      {subValue && (
        <div className="text-[11px] text-surface-600 mt-0.5">{subValue}</div>
      )}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CommandCenterClient() {
  const [data, setData] = useState<CommandCenterResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/command-center', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Failed to load command center')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Exchange
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-for-400" />
                Command Center
              </h1>
              <p className="text-sm text-surface-500 mt-1">
                Your personal exchange dashboard — watchlist, alerts, forecasts, and positions in one place.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-24 rounded-xl" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <EmptyState
              icon={AlertTriangle}
              title="Failed to load"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          )}

          {/* Not authenticated */}
          {!loading && data && !data.is_authenticated && (
            <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-8 text-center">
              <LogIn className="h-8 w-8 text-surface-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">Sign in to access your Command Center</h3>
              <p className="text-sm text-surface-500 mb-4">
                Your personal dashboard for watchlist, alerts, forecasts, and market positions.
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
              >
                Sign in
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Content */}
          {!loading && data && data.is_authenticated && (
            <AnimatePresence mode="wait">
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* ── Summary Stats ── */}
                <section>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatTile
                      label="Watching"
                      value={data.summary.total_watched}
                      icon={Bookmark}
                      color="text-for-400"
                    />
                    <StatTile
                      label="Alerts"
                      value={data.summary.active_alerts}
                      subValue={data.summary.alerts_near_threshold > 0 ? `${data.summary.alerts_near_threshold} near threshold` : undefined}
                      icon={Bell}
                      color={data.summary.alerts_near_threshold > 0 ? 'text-gold' : 'text-surface-500'}
                    />
                    <StatTile
                      label="Win Rate"
                      value={
                        data.summary.win_rate !== null
                          ? `${data.summary.win_rate}%`
                          : '—'
                      }
                      subValue={
                        data.summary.settled_wins + data.summary.settled_losses > 0
                          ? `${data.summary.settled_wins}W / ${data.summary.settled_losses}L`
                          : 'No settled positions'
                      }
                      icon={Trophy}
                      color={
                        data.summary.win_rate !== null && data.summary.win_rate >= 55
                          ? 'text-emerald'
                          : data.summary.win_rate !== null && data.summary.win_rate < 40
                            ? 'text-against-400'
                            : 'text-surface-400'
                      }
                    />
                    <StatTile
                      label="Forecast Accuracy"
                      value={
                        data.summary.avg_forecast_accuracy !== null
                          ? `${data.summary.avg_forecast_accuracy}%`
                          : '—'
                      }
                      subValue={`${data.summary.forecasts_on_target} on target`}
                      icon={Target}
                      color={
                        data.summary.avg_forecast_accuracy !== null && data.summary.avg_forecast_accuracy >= 70
                          ? 'text-emerald'
                          : 'text-surface-400'
                      }
                    />
                  </div>
                </section>

                {/* ── Watchlist ── */}
                <section>
                  <SectionHeader
                    icon={Bookmark}
                    title="Watchlist"
                    count={data.summary.total_watched}
                    href="/exchange/watchlist"
                    iconClass="text-for-400"
                  />

                  {data.watchlist.length === 0 ? (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 p-6 text-center">
                      <Bookmark className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No markets on your watchlist yet.</p>
                      <Link
                        href="/exchange"
                        className="text-xs text-for-400 hover:text-for-300 mt-1 block"
                      >
                        Browse the exchange →
                      </Link>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 overflow-hidden divide-y divide-surface-300/30">
                      {data.watchlist.map((w) => (
                        <Link
                          key={w.topic_id}
                          href={`/exchange/${w.topic_id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/60 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-surface-200 group-hover:text-white transition-colors line-clamp-1 font-medium">
                              {w.statement}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {w.category && (
                                <span className="text-[10px] text-surface-600 font-mono">{w.category}</span>
                              )}
                              <span className="text-[10px] text-surface-600">
                                Added {relTime(w.added_at)}
                              </span>
                            </div>
                          </div>
                          <div className={cn(
                            'flex-shrink-0 text-sm font-bold font-mono px-2 py-1 rounded-lg border',
                            priceBg(w.price, w.status),
                            priceColor(w.price, w.status),
                          )}>
                            {w.status === 'law' ? 'LAW' : w.status === 'failed' ? 'FAILED' : `${w.price}¢`}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-300 transition-colors flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Alerts ── */}
                <section>
                  <SectionHeader
                    icon={Bell}
                    title="Active Alerts"
                    count={data.summary.active_alerts}
                    href="/exchange/alerts"
                    iconClass={data.summary.alerts_near_threshold > 0 ? 'text-gold' : 'text-surface-500'}
                  />

                  {data.alerts.length === 0 ? (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 p-6 text-center">
                      <Bell className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No active price alerts.</p>
                      <Link
                        href="/exchange/alerts"
                        className="text-xs text-gold hover:text-yellow-300 mt-1 block"
                      >
                        Set up alerts →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.alerts.map((a) => {
                        const isNear = a.proximity_pct >= 70
                        return (
                          <Link
                            key={a.id}
                            href={`/exchange/${a.topic_id}`}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors group',
                              isNear
                                ? 'bg-gold/5 border-gold/25 hover:bg-gold/10'
                                : 'bg-surface-200/30 border-surface-300/50 hover:bg-surface-200/60',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-surface-200 group-hover:text-white transition-colors line-clamp-1 font-medium">
                                {a.statement}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn(
                                  'text-[10px] font-mono font-semibold',
                                  a.direction === 'above' ? 'text-emerald' : 'text-against-400',
                                )}>
                                  {a.direction === 'above' ? '▲' : '▼'} {a.threshold}¢
                                </span>
                                {isNear && (
                                  <span className="text-[10px] text-gold font-semibold animate-pulse">
                                    NEAR TRIGGER
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Proximity bar */}
                            <div className="flex-shrink-0 w-16">
                              <div className="flex items-center justify-end gap-1 mb-1">
                                <span className={cn('text-[11px] font-mono', priceColor(a.current_price, a.status))}>
                                  {a.current_price}¢
                                </span>
                              </div>
                              <div className="h-1.5 bg-surface-300/30 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    isNear ? 'bg-gold' : 'bg-for-500',
                                  )}
                                  style={{ width: `${a.proximity_pct}%` }}
                                />
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* ── Forecasts ── */}
                <section>
                  <SectionHeader
                    icon={Target}
                    title="My Forecasts"
                    count={data.summary.total_forecasts}
                    href="/exchange/forecasts"
                    iconClass="text-purple"
                  />

                  {data.forecasts.length === 0 ? (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 p-6 text-center">
                      <Target className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No price forecasts yet.</p>
                      <Link
                        href="/exchange"
                        className="text-xs text-purple hover:text-purple/80 mt-1 block"
                      >
                        Find markets to forecast →
                      </Link>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 overflow-hidden divide-y divide-surface-300/30">
                      {data.forecasts.map((f) => (
                        <Link
                          key={f.id}
                          href={`/exchange/${f.topic_id}/forecast`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/60 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-surface-200 group-hover:text-white transition-colors line-clamp-1 font-medium">
                              {f.statement}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded border font-semibold',
                                directionBadge(f.direction),
                              )}>
                                {directionLabel(f.direction)}
                              </span>
                              <span className="text-[10px] text-surface-600 font-mono">
                                {horizonLabel(f.horizon)}
                              </span>
                              <span className="text-[10px] text-surface-600">
                                Conf {f.confidence}/5
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className={cn('text-[11px] font-mono', priceColor(f.current_price, f.status))}>
                                {f.current_price}¢
                              </span>
                              <ArrowRight className="h-3 w-3 text-surface-600" />
                              <span className="text-[11px] font-mono font-bold text-purple">
                                {f.target_price}¢
                              </span>
                            </div>
                            <div className={cn(
                              'text-[10px] font-mono text-right mt-0.5',
                              f.delta > 0 ? 'text-emerald' : f.delta < 0 ? 'text-against-400' : 'text-surface-500',
                            )}>
                              {f.delta > 0 ? '+' : ''}{f.delta}¢
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Positions ── */}
                <section>
                  <SectionHeader
                    icon={BarChart2}
                    title="Positions"
                    count={data.summary.open_positions}
                    href="/exchange/portfolio"
                    iconClass="text-emerald"
                  />

                  {data.positions.length === 0 ? (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 p-6 text-center">
                      <Scale className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No voting positions yet.</p>
                      <Link
                        href="/exchange"
                        className="text-xs text-emerald hover:text-emerald/80 mt-1 block"
                      >
                        Start voting →
                      </Link>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 overflow-hidden divide-y divide-surface-300/30">
                      {data.positions.map((p) => {
                        const oc = outcomeConfig(p.outcome, p.side)
                        const OcIcon = oc.icon
                        return (
                          <Link
                            key={p.topic_id}
                            href={`/exchange/${p.topic_id}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/60 transition-colors group"
                          >
                            <div className="flex-shrink-0">
                              <OcIcon className={cn('h-4 w-4', oc.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-surface-200 group-hover:text-white transition-colors line-clamp-1 font-medium">
                                {p.statement}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn(
                                  'text-[10px] font-semibold',
                                  p.side === 'blue' ? 'text-for-400' : 'text-against-400',
                                )}>
                                  {p.side === 'blue' ? 'FOR' : 'AGAINST'}
                                </span>
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded border',
                                  oc.bg,
                                  oc.color,
                                )}>
                                  {oc.label}
                                </span>
                              </div>
                            </div>
                            <div className={cn(
                              'flex-shrink-0 text-sm font-bold font-mono',
                              priceColor(p.current_price, p.status),
                            )}>
                              {p.status === 'law' ? 'LAW' : p.status === 'failed' ? 'FAILED' : `${p.current_price}¢`}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* ── Ideas / Theses ── */}
                {data.ideas.length > 0 && (
                  <section>
                    <SectionHeader
                      icon={Lightbulb}
                      title="My Theses"
                      count={data.ideas.length}
                      href="/exchange/ideas"
                      iconClass="text-gold"
                    />

                    <div className="rounded-xl bg-surface-200/30 border border-surface-300/50 overflow-hidden divide-y divide-surface-300/30">
                      {data.ideas.map((idea) => (
                        <Link
                          key={idea.id}
                          href={idea.topic_id ? `/exchange/ideas/${idea.id}` : `/exchange/ideas/${idea.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/60 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-surface-200 group-hover:text-white transition-colors line-clamp-1 font-medium">
                              {idea.title}
                            </p>
                            {idea.statement && (
                              <p className="text-[10px] text-surface-600 line-clamp-1 mt-0.5">
                                {idea.statement}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded border font-semibold',
                              directionBadge(idea.direction),
                            )}>
                              {directionLabel(idea.direction)}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-surface-500">
                              <ThumbsUp className="h-3 w-3" />
                              <span className={idea.score > 0 ? 'text-emerald' : idea.score < 0 ? 'text-against-400' : ''}>
                                {idea.score > 0 ? '+' : ''}{idea.score}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Quick links ── */}
                <section>
                  <h2 className="text-xs font-semibold text-surface-600 uppercase tracking-widest mb-3">
                    Quick Access
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: '/exchange/portfolio', label: 'Full Portfolio', icon: BarChart2, color: 'text-emerald' },
                      { href: '/exchange/performance', label: 'Performance', icon: TrendingUp, color: 'text-for-400' },
                      { href: '/exchange/top-calls', label: 'Top Calls', icon: Zap, color: 'text-gold' },
                      { href: '/exchange/screener', label: 'Screener', icon: Activity, color: 'text-purple' },
                      { href: '/exchange/near-law', label: 'Near Law', icon: Gavel, color: 'text-gold' },
                      { href: '/exchange/smart-money', label: 'Smart Money', icon: Brain, color: 'text-emerald' },
                      { href: '/exchange/opportunity', label: 'Opportunities', icon: Flame, color: 'text-against-400' },
                      { href: '/exchange/following', label: 'Following', icon: Users, color: 'text-for-400' },
                    ].map(({ href, label, icon: Icon, color }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-200/40 border border-surface-300/50 hover:border-surface-400/80 hover:bg-surface-200/70 transition-colors group"
                      >
                        <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                        <span className="text-xs text-surface-400 group-hover:text-white transition-colors">
                          {label}
                        </span>
                        <ArrowRight className="h-3 w-3 text-surface-700 group-hover:text-surface-400 ml-auto transition-colors" />
                      </Link>
                    ))}
                  </div>
                </section>

                {/* Footer */}
                <div className="text-center text-[11px] text-surface-700 pt-2">
                  Updated {data.generated_at ? relTime(data.generated_at) : 'just now'}
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

// Tiny Trophy icon used in StatTile
function Trophy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}
