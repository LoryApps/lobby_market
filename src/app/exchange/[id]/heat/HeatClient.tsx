'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Clock,
  Flame,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  HeatResponse,
  HeatCell,
  HotZone,
  HotArgument,
  DailyVolume,
} from '@/app/api/exchange/[id]/heat/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 120_000

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const HOUR_LABELS = [
  '12a', '1a', '2a', '3a', '4a', '5a',
  '6a',  '7a', '8a', '9a', '10a', '11a',
  '12p', '1p', '2p', '3p', '4p', '5p',
  '6p',  '7p', '8p', '9p', '10p', '11p',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  return HOUR_LABELS[h] ?? `${h}h`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function heatScoreColor(score: number): string {
  if (score >= 85) return 'text-against-400'
  if (score >= 70) return 'text-against-300'
  if (score >= 55) return 'text-gold'
  if (score >= 40) return 'text-for-300'
  if (score >= 25) return 'text-for-400'
  return 'text-surface-500'
}

function heatScoreBg(score: number): string {
  if (score >= 85) return 'bg-against-500/15 border-against-500/30'
  if (score >= 70) return 'bg-against-600/10 border-against-600/20'
  if (score >= 55) return 'bg-gold/10 border-gold/30'
  if (score >= 40) return 'bg-for-500/10 border-for-500/30'
  if (score >= 25) return 'bg-for-600/8 border-for-600/20'
  return 'bg-surface-300/20 border-surface-400/30'
}

function cellIntensity(count: number, maxCount: number): number {
  if (maxCount === 0 || count === 0) return 0
  return count / maxCount
}

function cellBg(intensity: number): string {
  if (intensity === 0) return 'bg-surface-200/30'
  if (intensity <= 0.2) return 'bg-for-900/40'
  if (intensity <= 0.4) return 'bg-for-800/60'
  if (intensity <= 0.6) return 'bg-for-700/70'
  if (intensity <= 0.8) return 'bg-for-600/80'
  return 'bg-for-500'
}

function zoneColor(side: HotZone['side']): { bar: string; text: string; bg: string; border: string } {
  if (side === 'for')       return { bar: 'bg-for-500', text: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/30' }
  if (side === 'against')   return { bar: 'bg-against-500', text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' }
  return { bar: 'bg-purple', text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeatSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  )
}

// ─── Activity Grid (7×24) ──────────────────────────────────────────────────────

function ActivityGrid({ grid, peakHour, peakDay }: {
  grid: HeatCell[]
  peakHour: number | null
  peakDay: number | null
}) {
  const cellMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of grid) m.set(`${c.day}:${c.hour}`, c.count)
    return m
  }, [grid])

  const maxCount = useMemo(
    () => grid.reduce((mx, c) => Math.max(mx, c.count), 0),
    [grid],
  )

  // Show every 3 hours to save space
  const hoursToShow = [0, 3, 6, 9, 12, 15, 18, 21]

  if (grid.length === 0) {
    return (
      <p className="text-center text-sm text-surface-500 font-mono py-8">
        Not enough data to display activity grid yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[340px]">
        {/* Hour axis labels */}
        <div className="flex mb-1" style={{ paddingLeft: '36px' }}>
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              className={cn(
                'flex-1 text-center text-[8px] font-mono leading-none',
                hoursToShow.includes(h) ? 'text-surface-500' : 'text-transparent',
              )}
            >
              {hoursToShow.includes(h) ? formatHour(h) : '·'}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAY_LABELS.map((dayLabel, day) => (
          <div key={day} className="flex items-center gap-0 mb-[2px]">
            {/* Day label */}
            <div
              className={cn(
                'w-9 flex-shrink-0 text-[9px] font-mono text-right pr-1.5 leading-none',
                day === peakDay ? 'text-for-300 font-bold' : 'text-surface-500',
              )}
            >
              {dayLabel}
            </div>
            {/* Hour cells */}
            {Array.from({ length: 24 }).map((_, hour) => {
              const count = cellMap.get(`${day}:${hour}`) ?? 0
              const intensity = cellIntensity(count, maxCount)
              const isPeakH = hour === peakHour
              const isPeakD = day === peakDay
              const isApex  = isPeakH && isPeakD

              return (
                <div
                  key={hour}
                  title={count > 0 ? `${DAY_LABELS[day]} ${formatHour(hour)} — ${count} data point${count > 1 ? 's' : ''}` : undefined}
                  className={cn(
                    'flex-1 h-3.5 rounded-[2px] mx-[1px] transition-colors',
                    cellBg(intensity),
                    isApex && 'ring-1 ring-against-400/80',
                  )}
                />
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[9px] text-surface-600 font-mono">Less</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <div key={v} className={cn('w-3 h-3 rounded-[2px]', cellBg(v))} />
          ))}
          <span className="text-[9px] text-surface-600 font-mono">More</span>
        </div>
      </div>
    </div>
  )
}

// ─── Daily Volume Bar Chart ───────────────────────────────────────────────────

function DailyVolumeChart({ data }: { data: DailyVolume[] }) {
  if (data.length === 0) {
    return (
      <p className="text-center text-sm text-surface-500 font-mono py-4">
        No daily activity data yet.
      </p>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const displayData = data.slice(-21) // last 21 days

  return (
    <div className="flex items-end gap-[2px] h-20">
      {displayData.map((d, i) => {
        const pct = (d.count / maxCount) * 100
        const isRecent = i >= displayData.length - 7

        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center justify-end gap-0"
            title={`${d.date}: ${d.count} data points`}
          >
            <div
              className={cn(
                'w-full rounded-t-[2px] transition-all',
                isRecent ? 'bg-for-500/80' : 'bg-surface-400/60',
                pct === 100 && 'bg-against-500/70',
              )}
              style={{ height: `${Math.max(2, pct)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Hot Zone Bars ────────────────────────────────────────────────────────────

function HotZoneBar({ zone, rank }: { zone: HotZone; rank: number }) {
  const c = zoneColor(zone.side)

  return (
    <div className={cn('rounded-xl border px-4 py-3', c.bg, c.border)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-surface-600">#{rank}</span>
          <span className={cn('text-sm font-mono font-semibold', c.text)}>{zone.label}</span>
        </div>
        <span className="text-xs font-mono text-surface-500">{zone.pct_of_total}% of activity</span>
      </div>
      <div className="h-1.5 w-full bg-surface-300/60 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', c.bar)}
          style={{ width: `${zone.pct_of_total}%` }}
        />
      </div>
      <p className="text-[10px] font-mono text-surface-600 mt-1.5">
        {zone.count} data point{zone.count !== 1 ? 's' : ''}
        {' · '}
        {zone.side === 'contested' ? 'Contested range' : zone.side === 'for' ? 'FOR majority' : 'AGAINST majority'}
      </p>
    </div>
  )
}

// ─── Hot Argument Card ────────────────────────────────────────────────────────

function HotArgumentCard({ arg, rank }: { arg: HotArgument; rank: number }) {
  const isFor = arg.side === 'for'

  return (
    <Link
      href={`/exchange/${arg.id}/arguments`}
      className={cn(
        'block rounded-xl border px-4 py-3 transition-colors',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <span className="text-[10px] font-mono text-surface-600 mt-0.5 flex-shrink-0 w-4">
          #{rank}
        </span>

        <div className="flex-1 min-w-0">
          {/* Side badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
              isFor
                ? 'bg-for-500/15 text-for-300 border-for-500/30'
                : 'bg-against-500/15 text-against-300 border-against-500/30',
            )}>
              {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
              {isFor ? 'FOR' : 'AGAINST'}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-gold">
              <Flame className="h-2.5 w-2.5" />
              {arg.heat_score}
            </div>
          </div>

          {/* Body */}
          <p className="text-xs text-surface-600 leading-relaxed line-clamp-2 mb-2">
            {arg.body}
          </p>

          {/* Author + stats */}
          <div className="flex items-center gap-2">
            <Avatar
              src={arg.author_avatar_url}
              fallback={arg.author_display_name || arg.author_username}
              size="xs"
            />
            <span className="text-[10px] text-surface-500 font-mono">
              @{arg.author_username}
            </span>
            <span className="text-[10px] text-surface-600 font-mono ml-auto">
              <ArrowUpRight className="h-2.5 w-2.5 inline mr-0.5" />{arg.upvotes}
            </span>
            <span className="text-[10px] text-surface-600 font-mono">
              {relTime(arg.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface HeatClientProps {
  id: string
}

export function HeatClient({ id }: HeatClientProps) {
  const params = useParams()
  const marketId = id || (params?.id as string)

  const [data, setData] = useState<HeatResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [_lastRefresh, setLastRefresh] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exchange/${marketId}/heat`)
      if (!res.ok) throw new Error('Failed to load heat data')
      const json = await res.json() as HeatResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [marketId])

  useEffect(() => {
    load()
    const interval = setInterval(() => {
      load()
      setLastRefresh(Date.now())
    }, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  const topic   = data?.topic
  const catBadge = topic?.category
    ? (topic.category as 'Economics') // just for Badge type
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back nav ── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/exchange/${marketId}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm text-surface-500 font-mono">Heat Map</span>
        </div>

        {/* ── Topic title ── */}
        {topic && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              {catBadge && <Badge variant="category" value={catBadge} />}
              <Badge variant={topic.status as 'active'} />
            </div>
            <h1 className="font-mono text-lg font-bold text-white leading-snug line-clamp-2">
              {topic.statement}
            </h1>
            <p className="mt-1 text-xs text-surface-500 font-mono">
              {topic.volume.toLocaleString()} votes · {topic.price}% For
            </p>
          </div>
        )}

        {loading && <HeatSkeleton />}

        {error && (
          <EmptyState
            icon={Activity}
            title="Heat map unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* ── KPI row ── */}
            <div className="grid grid-cols-3 gap-3">
              {/* Heat score */}
              <div className={cn(
                'rounded-2xl border px-4 py-4 flex flex-col items-center justify-center text-center',
                heatScoreBg(data.heat_score),
              )}>
                <div className={cn('text-2xl font-mono font-black', heatScoreColor(data.heat_score))}>
                  {data.heat_score}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">HEAT SCORE</div>
                <div className={cn('text-[10px] font-mono font-bold mt-0.5', heatScoreColor(data.heat_score))}>
                  {data.heat_label}
                </div>
              </div>

              {/* Active days */}
              <div className="rounded-2xl border bg-surface-100 border-surface-300 px-4 py-4 flex flex-col items-center justify-center text-center">
                <div className="text-2xl font-mono font-black text-white">
                  {data.active_days}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">ACTIVE DAYS</div>
                <div className="text-[10px] font-mono text-surface-600 mt-0.5">last 30d</div>
              </div>

              {/* Peak time */}
              <div className="rounded-2xl border bg-surface-100 border-surface-300 px-4 py-4 flex flex-col items-center justify-center text-center">
                {data.peak_hour !== null ? (
                  <>
                    <div className="text-xl font-mono font-black text-white">
                      {formatHour(data.peak_hour)}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 mt-0.5">PEAK HOUR</div>
                    {data.peak_day !== null && (
                      <div className="text-[10px] font-mono text-surface-600 mt-0.5">
                        {DAY_LABELS[data.peak_day]} UTC
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Clock className="h-6 w-6 text-surface-500 mb-1" />
                    <div className="text-[10px] font-mono text-surface-500">No peak yet</div>
                  </>
                )}
              </div>
            </div>

            {/* ── Activity heat grid ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-for-400" />
                  Activity Grid
                </h2>
                <span className="text-[10px] font-mono text-surface-600">
                  {data.snapshot_count} data points · UTC
                </span>
              </div>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <ActivityGrid
                  grid={data.grid}
                  peakHour={data.peak_hour}
                  peakDay={data.peak_day}
                />
              </div>
            </section>

            {/* ── Daily volume chart ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                  Daily Activity
                </h2>
                <span className="text-[10px] font-mono text-surface-600">last 21 days</span>
              </div>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 px-4 pt-4 pb-2">
                <DailyVolumeChart data={data.daily_volume} />
                <p className="text-[9px] font-mono text-surface-600 text-right mt-1">
                  Blue = recent 7d
                </p>
              </div>
            </section>

            {/* ── Hot price zones ── */}
            {data.hot_zones.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-against-400" />
                    Hot Price Zones
                  </h2>
                  <span className="text-[10px] font-mono text-surface-600">
                    where the market spends most time
                  </span>
                </div>
                <div className="space-y-2">
                  {data.hot_zones.map((zone, i) => (
                    <HotZoneBar key={zone.label} zone={zone} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Hot arguments ── */}
            {data.hot_arguments.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-purple" />
                    Hottest Arguments
                  </h2>
                  <Link
                    href={`/exchange/${marketId}/arguments`}
                    className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    All <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.hot_arguments.map((arg, i) => (
                    <HotArgumentCard key={arg.id} arg={arg} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Related links ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3">Related analysis</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/exchange/${marketId}/momentum`, label: 'Momentum' },
                  { href: `/exchange/${marketId}/signal`, label: 'Signals' },
                  { href: `/exchange/${marketId}/risk`, label: 'Risk' },
                  { href: `/exchange/${marketId}/analysis`, label: 'Analysis' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 px-3 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    {label}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </section>

            {/* ── Last refresh ── */}
            <div className="flex items-center justify-end gap-2 text-[10px] text-surface-600 font-mono">
              <RefreshCw className="h-2.5 w-2.5" />
              Updated {new Date(data.as_of).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
