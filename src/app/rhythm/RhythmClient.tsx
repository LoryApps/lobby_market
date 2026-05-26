'use client'

/**
 * /rhythm — The Civic Rhythm
 *
 * A 7×24 temporal heatmap showing when the platform is most alive:
 * votes cast and arguments posted by day-of-week × hour-of-day (UTC),
 * computed over the past 90 days.
 *
 * Answers: When should I show up for maximum engagement?
 * Which days see the sharpest debates? When does the Lobby sleep?
 *
 * Distinct from:
 *   /activity-calendar — your personal contribution calendar (daily granularity)
 *   /analytics/streak  — your personal vote-streak stats
 *   /pulse             — real-time argument stream
 *   /live              — real-time new argument feed
 *   /now               — live platform heartbeat
 *
 * This is a platform-wide temporal fingerprint — not personal, not real-time,
 * but a structural pattern of when civic democracy happens.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Clock,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RhythmCell, RhythmResponse } from '@/app/api/stats/rhythm/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type ViewMode = 'combined' | 'votes' | 'args'

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: typeof Vote }[] = [
  { id: 'combined', label: 'Combined',  icon: Activity },
  { id: 'votes',    label: 'Votes',     icon: Vote },
  { id: 'args',     label: 'Arguments', icon: MessageSquare },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  if (h === 0)  return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function formatLargeNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Heatmap cell ─────────────────────────────────────────────────────────────

function HeatCell({
  cell,
  maxVal,
  mode,
  isSelected,
  onSelect,
}: {
  cell: RhythmCell
  maxVal: number
  mode: ViewMode
  isSelected: boolean
  onSelect: (cell: RhythmCell | null) => void
}) {
  const raw = mode === 'votes' ? cell.votes : mode === 'args' ? cell.args : cell.total
  const intensity = maxVal > 0 ? raw / maxVal : 0

  // 5-step colour ramp  (0 = surface-200, peak = for-500 or gold or purple)
  const bg =
    intensity === 0
      ? 'bg-surface-200/40'
      : intensity < 0.2
      ? mode === 'args' ? 'bg-purple/20' : 'bg-for-600/25'
      : intensity < 0.4
      ? mode === 'args' ? 'bg-purple/35' : 'bg-for-600/40'
      : intensity < 0.65
      ? mode === 'args' ? 'bg-purple/55' : 'bg-for-500/55'
      : intensity < 0.85
      ? mode === 'args' ? 'bg-purple/75' : 'bg-for-500/75'
      : mode === 'args' ? 'bg-purple'    : 'bg-for-500'

  return (
    <button
      type="button"
      aria-label={`${DAY_FULL[cell.dow]} ${formatHour(cell.hour)} UTC — ${raw.toLocaleString()} ${mode}`}
      onClick={() => onSelect(isSelected ? null : cell)}
      className={cn(
        'w-full aspect-square rounded-[3px] transition-all duration-150',
        bg,
        isSelected
          ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-surface-50'
          : 'hover:brightness-125 hover:scale-110',
      )}
    />
  )
}

// ─── Peak stat card ───────────────────────────────────────────────────────────

function PeakCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
  border,
}: {
  label: string
  value: string
  sub: string
  icon: typeof Clock
  color: string
  bg: string
  border: string
}) {
  return (
    <div className={cn('rounded-2xl border p-4 space-y-2', bg, border)}>
      <div className={cn('flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider', color)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-mono text-xl font-bold text-white leading-none">{value}</p>
      <p className="text-xs font-mono text-surface-500 leading-snug">{sub}</p>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-24" />
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-surface-300/60" />
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(25, 1fr)' }}>
          {Array.from({ length: 7 * 25 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[3px] bg-surface-300/40" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RhythmClient() {
  const [data, setData] = useState<RhythmResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [mode, setMode] = useState<ViewMode>('combined')
  const [selected, setSelected] = useState<RhythmCell | null>(null)
  const loadedAt = useRef<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stats/rhythm', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const json: RhythmResponse = await res.json()
      setData(json)
      loadedAt.current = Date.now()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Build a lookup map for cells
  const cellMap = new Map<string, RhythmCell>()
  if (data) {
    for (const c of data.cells) {
      cellMap.set(`${c.dow}:${c.hour}`, c)
    }
  }

  const maxVal = data
    ? mode === 'votes' ? data.max_votes
    : mode === 'args'  ? data.max_args
    : data.max_total
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/signals"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Live Signals
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <Activity className="h-6 w-6 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Rhythm
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  When democracy happens — platform activity by day &amp; hour
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error || !data ? (
          <EmptyState
            icon={BarChart2}
            title="Rhythm unavailable"
            description="Could not load temporal activity data."
            actions={[{ label: 'Retry', onClick: load }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >

              {/* ── Peak stat cards ──────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PeakCard
                  label="Peak Hour"
                  value={data.peaks.busiest.label}
                  sub={`${formatLargeNum(data.peaks.busiest.total)} total actions`}
                  icon={Zap}
                  color="text-for-400"
                  bg="bg-for-500/8"
                  border="border-for-500/25"
                />
                <PeakCard
                  label="Best for Arguments"
                  value={data.peaks.best_for_args.label}
                  sub="Highest argument-to-vote ratio"
                  icon={MessageSquare}
                  color="text-purple"
                  bg="bg-purple/8"
                  border="border-purple/25"
                />
                <PeakCard
                  label="Quietest Hour"
                  value={data.peaks.quietest.label}
                  sub="Fewest total civic actions"
                  icon={Clock}
                  color="text-surface-500"
                  bg="bg-surface-100"
                  border="border-surface-300"
                />
              </div>

              {/* ── View toggle ───────────────────────────────────────────── */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-surface-500 mr-1">Show:</span>
                {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border',
                      mode === id
                        ? id === 'args'
                          ? 'bg-purple/20 border-purple/40 text-purple'
                          : id === 'votes'
                          ? 'bg-for-500/20 border-for-500/40 text-for-400'
                          : 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
                <span className="ml-auto text-xs font-mono text-surface-500">
                  Last {data.window_days} days · UTC
                </span>
              </div>

              {/* ── Heatmap ───────────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-6 overflow-x-auto">
                <div className="min-w-[600px]">

                  {/* Hour labels */}
                  <div className="flex mb-1 pl-10">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        className="flex-1 text-center text-[9px] font-mono text-surface-600 leading-none select-none"
                      >
                        {h % 3 === 0 ? formatHour(h) : ''}
                      </div>
                    ))}
                  </div>

                  {/* Grid rows */}
                  {Array.from({ length: 7 }, (_, dow) => (
                    <div key={dow} className="flex items-center gap-1 mb-1">
                      {/* Day label */}
                      <div className="w-9 flex-shrink-0 text-right text-[10px] font-mono text-surface-500 pr-1 select-none">
                        {DAY_LABELS[dow]}
                      </div>

                      {/* 24 cells */}
                      {Array.from({ length: 24 }, (_, hour) => {
                        const cell = cellMap.get(`${dow}:${hour}`)!
                        const isSel = selected?.dow === dow && selected?.hour === hour
                        return (
                          <div key={hour} className="flex-1">
                            <HeatCell
                              cell={cell}
                              maxVal={maxVal}
                              mode={mode}
                              isSelected={isSel}
                              onSelect={setSelected}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <span className="text-[10px] font-mono text-surface-600">Less</span>
                    {[0, 0.2, 0.4, 0.65, 0.85, 1].map((t, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-3 w-3 rounded-[3px]',
                          t === 0
                            ? 'bg-surface-200/40'
                            : t < 0.2
                            ? mode === 'args' ? 'bg-purple/20' : 'bg-for-600/25'
                            : t < 0.4
                            ? mode === 'args' ? 'bg-purple/35' : 'bg-for-600/40'
                            : t < 0.65
                            ? mode === 'args' ? 'bg-purple/55' : 'bg-for-500/55'
                            : t < 0.85
                            ? mode === 'args' ? 'bg-purple/75' : 'bg-for-500/75'
                            : mode === 'args' ? 'bg-purple' : 'bg-for-500',
                        )}
                      />
                    ))}
                    <span className="text-[10px] font-mono text-surface-600">More</span>
                  </div>
                </div>
              </div>

              {/* ── Selected cell tooltip ─────────────────────────────────── */}
              <AnimatePresence>
                {selected && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl bg-surface-100 border border-for-500/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono font-bold text-white text-base">
                          {DAY_FULL[selected.dow]}, {formatHour(selected.hour)} UTC
                        </p>
                        <p className="text-xs font-mono text-surface-500 mt-0.5">
                          Over the last {data.window_days} days
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-3 flex gap-6">
                      <div>
                        <p className="text-xs font-mono text-surface-500">Votes</p>
                        <p className="font-mono text-xl font-bold text-for-400">
                          {selected.votes.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-mono text-surface-500">Arguments</p>
                        <p className="font-mono text-xl font-bold text-purple">
                          {selected.args.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-mono text-surface-500">Total Actions</p>
                        <p className="font-mono text-xl font-bold text-white">
                          {selected.total.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Day breakdown ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Day totals */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="font-mono text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    Activity by Day
                  </h2>
                  <div className="space-y-2">
                    {data.day_totals.map((total, dow) => {
                      const pct = data.max_total > 0
                        ? (total / Math.max(...data.day_totals)) * 100
                        : 0
                      return (
                        <div key={dow} className="flex items-center gap-3">
                          <span className="w-8 text-xs font-mono text-surface-500 text-right flex-shrink-0">
                            {DAY_LABELS[dow]}
                          </span>
                          <div className="flex-1 h-5 rounded-md bg-surface-200 overflow-hidden">
                            <div
                              className="h-full bg-for-500/70 rounded-md transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-14 text-xs font-mono text-surface-500 text-right flex-shrink-0">
                            {formatLargeNum(total)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Hour totals — compressed to 6-hour buckets */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="font-mono text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gold" />
                    Activity by Time of Day
                  </h2>
                  <div className="space-y-2">
                    {[
                      { label: 'Midnight–6am', start: 0,  end: 5  },
                      { label: '6am–Noon',    start: 6,  end: 11 },
                      { label: 'Noon–6pm',    start: 12, end: 17 },
                      { label: '6pm–Midnight', start: 18, end: 23 },
                    ].map(({ label, start, end }) => {
                      const total = data.hour_totals
                        .slice(start, end + 1)
                        .reduce((a, b) => a + b, 0)
                      const maxBucket = [0, 6, 12, 18]
                        .map(s => data.hour_totals.slice(s, s + 6).reduce((a, b) => a + b, 0))
                        .reduce((a, b) => Math.max(a, b), 1)
                      const pct = (total / maxBucket) * 100
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <span className="w-28 text-xs font-mono text-surface-500 text-right flex-shrink-0">
                            {label}
                          </span>
                          <div className="flex-1 h-5 rounded-md bg-surface-200 overflow-hidden">
                            <div
                              className="h-full bg-gold/70 rounded-md transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-14 text-xs font-mono text-surface-500 text-right flex-shrink-0">
                            {formatLargeNum(total)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── Platform totals ───────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex flex-wrap gap-6 text-center">
                  {[
                    { label: 'Total Votes (90d)',     value: formatLargeNum(data.total_votes), color: 'text-for-400', icon: Vote },
                    { label: 'Total Arguments (90d)', value: formatLargeNum(data.total_args),  color: 'text-purple',  icon: MessageSquare },
                    { label: 'Total Actions (90d)',   value: formatLargeNum(data.total_votes + data.total_args), color: 'text-white', icon: Activity },
                    { label: 'Avg / Day',             value: formatLargeNum(Math.round((data.total_votes + data.total_args) / data.window_days)), color: 'text-gold', icon: TrendingUp },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="flex-1 min-w-[140px]">
                      <p className="text-xs font-mono text-surface-500">{label}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <Icon className={cn('h-4 w-4', color)} />
                        <p className={cn('font-mono text-2xl font-bold', color)}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Interpretation tip ───────────────────────────────────── */}
              <div className="rounded-2xl bg-for-500/5 border border-for-500/20 p-5">
                <h2 className="font-mono text-sm font-semibold text-for-400 mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  How to read this
                </h2>
                <p className="text-sm font-mono text-surface-400 leading-relaxed">
                  Each cell represents one hour-of-day on one day-of-week (UTC), averaged over the last 90 days.
                  Darker cells = more civic activity. Click any cell to see exact counts.
                  The <span className="text-purple">Arguments</span> view reveals when the community is most willing to deliberate
                  — not just vote. Post your argument at peak hours for maximum exposure.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/live"
                    className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Live argument stream
                  </Link>
                  <Link
                    href="/pulse"
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Community pulse
                  </Link>
                  <Link
                    href="/activity-calendar"
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Your activity calendar
                  </Link>
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
