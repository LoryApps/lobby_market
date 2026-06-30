'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Clock,
  Flame,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HeatResponse, HourBucket, DayBucket } from '@/app/api/topics/[id]/heat/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Lerp a value 0→1 to a CSS color between "neutral", "blue", and "red"
function intensityClass(intensity: number, forPct: number, hasVotes: boolean): string {
  if (!hasVotes) return 'bg-surface-300/20'
  if (intensity < 0.05) return 'bg-surface-400/30'

  // Blend between blue (FOR) and red (AGAINST) based on forPct, scaled by intensity
  if (forPct >= 60)  return intensity > 0.5 ? 'bg-for-500/80'  : 'bg-for-500/40'
  if (forPct <= 40)  return intensity > 0.5 ? 'bg-against-500/80' : 'bg-against-500/40'
  // Contested
  return intensity > 0.5 ? 'bg-purple/60' : 'bg-purple/25'
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  sub,
  color = 'text-for-400',
}: {
  icon: typeof Clock
  label: string
  sub?: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center bg-surface-200', color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{label}</h2>
        {sub && <p className="text-xs text-surface-500">{sub}</p>}
      </div>
    </div>
  )
}

// ─── By-Hour Bar Chart ────────────────────────────────────────────────────────

function HourBars({ byHour, peakHour }: { byHour: HourBucket[]; peakHour: number }) {
  const maxTotal = Math.max(...byHour.map((h) => h.total), 1)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[480px]">
        {/* Bars */}
        <div className="flex items-end gap-0.5 h-24">
          {byHour.map((bucket) => {
            const heightPct = (bucket.total / maxTotal) * 100
            const isPeak = bucket.hour === peakHour
            const forFrac = bucket.total > 0 ? bucket.forCount / bucket.total : 0.5
            return (
              <div
                key={bucket.hour}
                className="flex-1 flex flex-col justify-end group relative"
                title={`${formatHour(bucket.hour)}: ${bucket.total} votes (${bucket.forCount} FOR, ${bucket.againstCount} AGAINST)`}
              >
                <div
                  className={cn(
                    'w-full rounded-t transition-opacity group-hover:opacity-90 cursor-default overflow-hidden',
                    isPeak && 'ring-1 ring-white/20'
                  )}
                  style={{ height: `${Math.max(heightPct, bucket.total > 0 ? 4 : 1)}%` }}
                >
                  {/* FOR portion (blue, bottom) */}
                  <div
                    className="w-full bg-for-500/80"
                    style={{ height: `${forFrac * 100}%` }}
                  />
                  {/* AGAINST portion (red, top) */}
                  <div
                    className="w-full bg-against-500/80"
                    style={{ height: `${(1 - forFrac) * 100}%` }}
                  />
                </div>
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1 shadow-xl whitespace-nowrap text-center">
                    <p className="text-[11px] font-mono font-bold text-white">{formatHour(bucket.hour)}</p>
                    <p className="text-[10px] text-surface-400">{bucket.total} votes</p>
                    {bucket.total > 0 && (
                      <p className="text-[10px]">
                        <span className="text-for-400">{bucket.forCount} FOR</span>
                        {' · '}
                        <span className="text-against-400">{bucket.againstCount} AGAINST</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Hour labels — every 3 hours */}
        <div className="flex gap-0.5 mt-1">
          {byHour.map((bucket) => (
            <div key={bucket.hour} className="flex-1 text-center">
              {bucket.hour % 6 === 0 && (
                <span className="text-[9px] font-mono text-surface-600">
                  {formatHour(bucket.hour)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── By-Day Bar Chart ─────────────────────────────────────────────────────────

function DayBars({ byDay, peakDay }: { byDay: DayBucket[]; peakDay: number }) {
  const maxTotal = Math.max(...byDay.map((d) => d.total), 1)

  return (
    <div className="flex items-end gap-2 h-24">
      {byDay.map((bucket) => {
        const heightPct = (bucket.total / maxTotal) * 100
        const isPeak = bucket.day === peakDay
        const forFrac = bucket.total > 0 ? bucket.forCount / bucket.total : 0.5
        return (
          <div
            key={bucket.day}
            className="flex-1 flex flex-col items-center gap-1 group relative"
            title={`${DAY_FULL[bucket.day]}: ${bucket.total} votes`}
          >
            <div
              className={cn(
                'w-full rounded-t overflow-hidden transition-opacity group-hover:opacity-90 cursor-default',
                isPeak && 'ring-1 ring-white/20'
              )}
              style={{ height: `${Math.max(heightPct, bucket.total > 0 ? 6 : 2)}%` }}
            >
              <div className="w-full bg-for-500/80" style={{ height: `${forFrac * 100}%` }} />
              <div className="w-full bg-against-500/80" style={{ height: `${(1 - forFrac) * 100}%` }} />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1 shadow-xl whitespace-nowrap text-center">
                <p className="text-[11px] font-mono font-bold text-white">{DAY_FULL[bucket.day]}</p>
                <p className="text-[10px] text-surface-400">{bucket.total} votes</p>
                {bucket.total > 0 && (
                  <p className="text-[10px]">
                    <span className="text-for-400">{bucket.forCount} FOR</span>
                    {' · '}
                    <span className="text-against-400">{bucket.againstCount} AGAINST</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini Heatmap Grid (7 rows × 24 cols) ────────────────────────────────────

interface GridCell {
  day: number
  hour: number
  total: number
  forPct: number
}

function MiniGrid({ cells, maxTotal }: { cells: GridCell[]; maxTotal: number }) {
  // Build 7×24 lookup
  const lookup = new Map<string, GridCell>()
  for (const c of cells) lookup.set(`${c.day}:${c.hour}`, c)

  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const DAYS  = Array.from({ length: 7  }, (_, i) => i)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[360px]">
        {/* Hour header */}
        <div className="flex gap-px ml-8 mb-0.5">
          {HOURS.map((h) => (
            <div key={h} className="flex-1 text-center">
              {h % 6 === 0 && (
                <span className="text-[8px] font-mono text-surface-600 block">{formatHour(h)}</span>
              )}
            </div>
          ))}
        </div>
        {/* Rows */}
        {DAYS.map((d) => (
          <div key={d} className="flex items-center gap-px mb-0.5">
            <span className="w-8 text-[9px] font-mono text-surface-600 text-right pr-1.5 flex-shrink-0">
              {DAY_LABELS[d]}
            </span>
            {HOURS.map((h) => {
              const cell = lookup.get(`${d}:${h}`)
              const total = cell?.total ?? 0
              const fp = cell?.forPct ?? 50
              const intensity = maxTotal > 0 ? total / maxTotal : 0
              const cls = intensityClass(intensity, fp, total > 0)
              return (
                <div
                  key={h}
                  className={cn('flex-1 h-3.5 rounded-[2px] transition-opacity cursor-default group relative', cls)}
                  title={
                    total > 0
                      ? `${DAY_LABELS[d]} ${formatHour(h)}: ${total} votes · ${fp}% FOR`
                      : `${DAY_LABELS[d]} ${formatHour(h)}: no votes`
                  }
                >
                  {/* No inline tooltip on grid — title attr is enough */}
                </div>
              )
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center justify-end gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
            <div className="h-2.5 w-2.5 rounded-sm bg-surface-400/30" />
            No votes
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-for-400">
            <div className="h-2.5 w-2.5 rounded-sm bg-for-500/80" />
            Majority FOR
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-against-400">
            <div className="h-2.5 w-2.5 rounded-sm bg-against-500/80" />
            Majority AGAINST
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple">
            <div className="h-2.5 w-2.5 rounded-sm bg-purple/60" />
            Contested
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Insight Pill ─────────────────────────────────────────────────────────────

function InsightPill({
  icon: Icon,
  label,
  value,
  color = 'text-for-400',
}: {
  icon: typeof Flame
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300">
      <div className={cn('mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center bg-surface-200', color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeatSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
}

export function HeatClient({ topicId, topicStatement }: Props) {
  const [data, setData] = useState<HeatResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/heat`)
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as HeatResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { fetchData() }, [fetchData])

  const maxCellTotal = data
    ? Math.max(...data.cells.map((c) => c.total), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">Vote Activity Heatmap</h1>
            <p className="text-xs text-surface-500 line-clamp-1 mt-0.5">{topicStatement}</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <HeatSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={Activity}
            title="Unable to load activity data"
            description="Could not fetch vote timing data. Try again in a moment."
            actions={[{ label: 'Retry', onClick: fetchData }]}
          />
        )}

        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary */}
            <p className="text-xs text-surface-500">
              Based on{' '}
              <span className="text-white font-mono">{data.sampleSize.toLocaleString()}</span>
              {data.sampleSize < data.totalVotes
                ? ` of ${data.totalVotes.toLocaleString()} votes`
                : ' votes'}{' '}
              — all times shown in <span className="font-mono text-white">UTC</span>.
            </p>

            {/* Key insights grid */}
            <div className="grid grid-cols-2 gap-3">
              <InsightPill
                icon={Flame}
                label="Peak hour"
                value={formatHour(data.peakHour)}
                color="text-orange-400"
              />
              <InsightPill
                icon={Activity}
                label="Busiest day"
                value={DAY_FULL[data.peakDay]}
                color="text-purple"
              />
              <InsightPill
                icon={ThumbsUp}
                label="Top-3 hours"
                value={data.topHours.map(formatHour).join(', ')}
                color="text-for-400"
              />
              <InsightPill
                icon={Zap}
                label="Top-3 days"
                value={data.topDays.map((d) => DAY_LABELS[d]).join(', ')}
                color="text-gold"
              />
            </div>

            {/* By-Hour chart */}
            <section className="p-4 rounded-xl bg-surface-100 border border-surface-300">
              <SectionHeader
                icon={Clock}
                label="By Hour of Day (UTC)"
                sub="When is this debate most active?"
                color="text-for-400"
              />
              <HourBars byHour={data.byHour} peakHour={data.peakHour} />
              {/* FOR/AGAINST legend */}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-for-400">
                  <ThumbsUp className="h-3 w-3" />
                  FOR
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-against-400">
                  <ThumbsDown className="h-3 w-3" />
                  AGAINST
                </div>
                <span className="text-[11px] text-surface-600 ml-auto">Bars stacked FOR (bottom) + AGAINST (top)</span>
              </div>
            </section>

            {/* By-Day chart */}
            <section className="p-4 rounded-xl bg-surface-100 border border-surface-300">
              <SectionHeader
                icon={Activity}
                label="By Day of Week"
                sub="Which days drive the most debate?"
                color="text-purple"
              />
              <DayBars byDay={data.byDay} peakDay={data.peakDay} />
              {/* Day labels */}
              <div className="flex gap-2 mt-2">
                {data.byDay.map((d) => (
                  <div key={d.day} className="flex-1 text-center">
                    <span className={cn(
                      'text-[10px] font-mono',
                      d.day === data.peakDay ? 'text-white font-bold' : 'text-surface-600'
                    )}>
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 7×24 Mini Heatmap */}
            {data.cells.length > 0 && (
              <section className="p-4 rounded-xl bg-surface-100 border border-surface-300">
                <SectionHeader
                  icon={Zap}
                  label="Full Heatmap"
                  sub="Day × hour — color shows majority side, intensity shows volume"
                  color="text-gold"
                />
                <MiniGrid cells={data.cells} maxTotal={maxCellTotal} />
              </section>
            )}

            {/* FOR/AGAINST swing by hour */}
            {data.sampleSize >= 10 && (
              <section className="p-4 rounded-xl bg-surface-100 border border-surface-300">
                <SectionHeader
                  icon={ThumbsUp}
                  label="Opinion Swing by Hour"
                  sub="Does the majority side shift depending on when people vote?"
                  color="text-for-400"
                />
                <div className="space-y-1.5 overflow-x-auto">
                  <div className="min-w-[360px]">
                    {data.byHour.filter((h) => h.total > 0).map((h) => {
                      const isForMajority = h.forPct >= 50
                      const deviation = Math.abs(h.forPct - 50)
                      return (
                        <div key={h.hour} className="flex items-center gap-2">
                          <span className="w-10 text-[10px] font-mono text-surface-600 text-right flex-shrink-0">
                            {formatHour(h.hour)}
                          </span>
                          <div className="flex-1 flex items-center gap-0.5 h-3.5">
                            {/* FOR bar — right from center */}
                            <div className="flex-1 flex items-center justify-end">
                              <div
                                className={cn(
                                  'h-2 rounded-l-full transition-all',
                                  isForMajority ? 'bg-for-500/80' : 'bg-surface-400/20'
                                )}
                                style={{ width: `${isForMajority ? deviation * 2 : 0}%` }}
                              />
                            </div>
                            {/* Center line */}
                            <div className="h-3.5 w-px bg-surface-500/40 flex-shrink-0" />
                            {/* AGAINST bar — left from center */}
                            <div className="flex-1 flex items-center">
                              <div
                                className={cn(
                                  'h-2 rounded-r-full transition-all',
                                  !isForMajority ? 'bg-against-500/80' : 'bg-surface-400/20'
                                )}
                                style={{ width: `${!isForMajority ? deviation * 2 : 0}%` }}
                              />
                            </div>
                          </div>
                          <span className={cn(
                            'w-8 text-[10px] font-mono text-right flex-shrink-0',
                            isForMajority ? 'text-for-400' : 'text-against-400'
                          )}>
                            {h.forPct}%
                          </span>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-10" />
                      <div className="flex-1 flex justify-between text-[9px] font-mono text-surface-600">
                        <span className="text-against-500">← AGAINST</span>
                        <span className="text-surface-600">50/50</span>
                        <span className="text-for-500">FOR →</span>
                      </div>
                      <div className="w-8" />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {data.sampleSize === 0 && (
              <EmptyState
                icon={Activity}
                title="No vote timing data yet"
                description="Once votes start coming in, this heatmap will show when this debate is most active."
              />
            )}
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
