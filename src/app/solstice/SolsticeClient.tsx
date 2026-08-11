'use client'

/**
 * /solstice — Civic Solstice
 *
 * Platform-wide annual engagement calendar: 52 weeks of civic activity
 * shown as a heat-strip, with seasonal breakdowns, peak/quiet week
 * callouts, and category dominance per season.
 *
 * Distinct from:
 *   /activity-calendar  — YOUR personal contribution heatmap
 *   /platform-stats     — Cumulative totals, no time dimension
 *   /weekly             — 7-day community digest
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart2,
  Cpu,
  FlaskConical,
  GraduationCap,
  Globe,
  Gavel,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Moon,
  Music2,
  RefreshCw,
  Scale,
  Sun,
  ThumbsUp,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  SolsticeResponse,
  SolsticeWeek,
  SolsticeSeason,
} from '@/app/api/stats/solstice/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CFG: Record<string, { icon: typeof Globe; color: string; bg: string; text: string }> = {
  Politics:    { icon: Landmark,      color: '#3b82f6', bg: 'bg-for-500/10',     text: 'text-for-400'     },
  Economics:   { icon: BarChart2,     color: '#f59e0b', bg: 'bg-gold/10',        text: 'text-gold'        },
  Technology:  { icon: Cpu,           color: '#8b5cf6', bg: 'bg-purple/10',      text: 'text-purple'      },
  Science:     { icon: FlaskConical,  color: '#10b981', bg: 'bg-emerald/10',     text: 'text-emerald'     },
  Ethics:      { icon: Scale,         color: '#60a5fa', bg: 'bg-for-400/10',     text: 'text-for-300'     },
  Philosophy:  { icon: Globe,         color: '#a78bfa', bg: 'bg-purple/10',      text: 'text-purple'      },
  Culture:     { icon: Music2,        color: '#f87171', bg: 'bg-against-500/10', text: 'text-against-400' },
  Health:      { icon: Heart,         color: '#34d399', bg: 'bg-emerald/10',     text: 'text-emerald'     },
  Environment: { icon: Leaf,          color: '#6ee7b7', bg: 'bg-emerald/10',     text: 'text-emerald'     },
  Education:   { icon: GraduationCap, color: '#c084fc', bg: 'bg-purple/10',      text: 'text-purple'      },
}

function catColor(cat: string | null): string {
  return CAT_CFG[cat ?? '']?.color ?? '#4b5563'
}
function catText(cat: string | null): string {
  return CAT_CFG[cat ?? '']?.text ?? 'text-surface-500'
}

// ─── Level colours ────────────────────────────────────────────────────────────

const LEVEL_BG: Record<number, string> = {
  0: 'bg-surface-300',
  1: 'bg-for-900/40 border-for-800/20',
  2: 'bg-for-700/50 border-for-600/30',
  3: 'bg-for-500/70 border-for-400/50',
  4: 'bg-for-400 border-for-300',
}

// ─── Season icon ─────────────────────────────────────────────────────────────

function SeasonIcon({ name, className }: { name: SolsticeSeason['name']; className?: string }) {
  const icons = {
    Spring: TrendingUp,
    Summer: Sun,
    Autumn: Wind,
    Winter: Moon,
  }
  const Icon = icons[name]
  return <Icon className={className} />
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtWeekRange(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`
}

function fmtMonth(startDate: string): string {
  return new Date(startDate + 'T00:00:00Z').toLocaleDateString('en-GB', {
    month: 'short', year: '2-digit', timeZone: 'UTC',
  })
}

// ─── Week tooltip ─────────────────────────────────────────────────────────────

function WeekTooltip({ week, visible }: { week: SolsticeWeek; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none"
        >
          <div className="bg-surface-100 border border-surface-300 rounded-lg px-2.5 py-2 text-[10px] font-mono whitespace-nowrap shadow-xl min-w-[130px]">
            <div className="text-white font-semibold mb-1">{fmtWeekRange(week.startDate)}</div>
            <div className="flex items-center gap-1 text-for-400">
              <ThumbsUp className="h-2.5 w-2.5" />
              {week.votes.toLocaleString()} votes
            </div>
            <div className="flex items-center gap-1 text-purple">
              <MessageSquare className="h-2.5 w-2.5" />
              {week.arguments.toLocaleString()} arguments
            </div>
            {week.laws > 0 && (
              <div className="flex items-center gap-1 text-gold">
                <Gavel className="h-2.5 w-2.5" />
                {week.laws} law{week.laws !== 1 ? 's' : ''}
              </div>
            )}
            {week.topCategory && (
              <div className={cn('mt-1 font-semibold', catText(week.topCategory))}>
                ⬤ {week.topCategory}
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-surface-300 mx-auto" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Week cell ────────────────────────────────────────────────────────────────

function WeekCell({
  week,
  isPeak,
  delay,
}: {
  week: SolsticeWeek
  isPeak: boolean
  delay: number
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative" style={{ zIndex: hovered ? 50 : 'auto' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, duration: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'h-5 w-5 rounded-sm border cursor-default transition-transform duration-150 flex-shrink-0',
          LEVEL_BG[week.level],
          isPeak && 'ring-1 ring-gold ring-offset-1 ring-offset-surface-100',
          hovered && 'scale-125',
        )}
      />
      <WeekTooltip week={week} visible={hovered} />
    </div>
  )
}

// ─── Season card ──────────────────────────────────────────────────────────────

function SeasonCard({ season, rank }: { season: SolsticeSeason; rank: number }) {
  const topCatColor = catColor(season.topCategory)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + rank * 0.06, duration: 0.3 }}
      className="bg-surface-200 border border-surface-300 rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-surface-300 border border-surface-400">
            <SeasonIcon name={season.name} className="h-4 w-4 text-surface-400" />
          </div>
          <div>
            <div className="text-sm font-mono font-bold text-white">{season.name}</div>
            <div className="text-[10px] font-mono text-surface-500">
              {season.label.split('·')[1]?.trim()}
            </div>
          </div>
        </div>
        {season.laws > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-gold bg-gold/10 border border-gold/25 px-1.5 py-0.5 rounded">
            <Gavel className="h-2.5 w-2.5" />
            {season.laws} laws
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-300 rounded-lg p-2 text-center">
          <div className="text-sm font-mono font-bold text-white tabular-nums">
            {season.totalActivity.toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500">actions</div>
        </div>
        <div className="bg-surface-300 rounded-lg p-2 text-center">
          <div className="text-sm font-mono font-bold text-white tabular-nums">
            {season.weeks.length}
          </div>
          <div className="text-[9px] font-mono text-surface-500">weeks</div>
        </div>
      </div>

      {season.topCategory && (
        <div className={cn('flex items-center gap-1.5 text-xs font-mono font-semibold', catText(season.topCategory))}>
          <span style={{ color: topCatColor }}>⬤</span>
          {season.topCategory} dominated
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SolsticeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SolsticeClient() {
  const [data, setData] = useState<SolsticeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/stats/solstice', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load solstice data')
      const json = (await res.json()) as SolsticeResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => load(), 30 * 60 * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  // Month labels above the grid (one per ~4.3 weeks)
  const monthLabels = data
    ? data.weeks
        .filter((_, i) => i % 4 === 0)
        .map(w => ({ weekNum: w.weekNum, label: fmtMonth(w.startDate) }))
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                <Sun className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Solstice</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  The platform&apos;s annual rhythm · 52-week view
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <p className="mt-4 text-sm font-mono text-surface-500 max-w-3xl leading-relaxed">
            Every cell is one week of collective civic activity — votes cast, arguments made,
            and laws established. Bright cells are peaks of democratic engagement;
            dark cells are quieter weeks. Hover any cell for details.
          </p>
        </div>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <SolsticeSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Zap className="h-8 w-8 text-against-500 mb-3" />
              <p className="text-sm font-mono text-surface-400">{error}</p>
              <button
                onClick={() => load()}
                className="mt-4 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* ── Summary strip ──────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center"
                >
                  <div className="text-xl font-mono font-bold text-white tabular-nums">
                    {data.totals.votes.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">total votes</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center"
                >
                  <div className="text-xl font-mono font-bold text-purple tabular-nums">
                    {data.totals.arguments.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">arguments</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.11 }}
                  className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center"
                >
                  <div className="text-xl font-mono font-bold text-gold tabular-nums">
                    {data.totals.laws.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">laws established</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                  className="bg-surface-200 border border-surface-300 rounded-xl p-3 text-center"
                >
                  <div className="text-xl font-mono font-bold text-for-400 tabular-nums">
                    {data.totals.activeWeeks}
                    <span className="text-sm text-surface-500">/52</span>
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">active weeks</div>
                </motion.div>
              </div>

              {/* ── 52-week heatmap ─────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="bg-surface-200 border border-surface-300 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-for-400" />
                    52-Week Activity Strip
                  </h2>
                  {data.peakWeek && (
                    <span className="text-[10px] font-mono text-gold flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      Peak: {fmtWeekRange(data.peakWeek.startDate)}
                    </span>
                  )}
                </div>

                {/* Month labels */}
                <div className="flex gap-1 mb-1 overflow-x-auto pb-1">
                  {data.weeks.map((w, i) => {
                    const label = monthLabels.find(m => m.weekNum === i)
                    return (
                      <div
                        key={i}
                        className="flex-shrink-0 w-5 text-[8px] font-mono text-surface-600 text-center leading-none"
                      >
                        {label?.label.split(' ')[0] ?? ''}
                      </div>
                    )
                  })}
                </div>

                {/* Cells */}
                <div className="flex gap-1 overflow-x-auto pb-2">
                  {data.weeks.map((w, i) => (
                    <WeekCell
                      key={w.isoWeek}
                      week={w}
                      isPeak={data.peakWeek?.isoWeek === w.isoWeek}
                      delay={0.18 + i * 0.004}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] font-mono text-surface-600">Less</span>
                  {[0, 1, 2, 3, 4].map(l => (
                    <div key={l} className={cn('h-3.5 w-3.5 rounded-sm border', LEVEL_BG[l])} />
                  ))}
                  <span className="text-[10px] font-mono text-surface-600">More</span>
                  <div className="ml-2 flex items-center gap-1">
                    <div className="h-3.5 w-3.5 rounded-sm bg-for-400 ring-1 ring-gold ring-offset-1 ring-offset-surface-200" />
                    <span className="text-[10px] font-mono text-gold">Peak week</span>
                  </div>
                </div>
              </motion.div>

              {/* ── Peak & Quiet callout ───────────────────────────────── */}
              {(data.peakWeek || data.quietWeek) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.peakWeek && (
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-gold/5 border border-gold/20 rounded-2xl p-4 flex items-start gap-3"
                    >
                      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
                        <Sun className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <div className="text-xs font-mono font-bold text-gold mb-0.5">
                          CIVIC SOLSTICE — Peak Week
                        </div>
                        <div className="text-sm font-mono text-white">
                          {fmtWeekRange(data.peakWeek.startDate)}
                        </div>
                        <div className="text-[10px] font-mono text-surface-500 mt-1">
                          {data.peakWeek.total.toLocaleString()} total actions ·{' '}
                          {data.peakWeek.votes.toLocaleString()} votes ·{' '}
                          {data.peakWeek.laws} law{data.peakWeek.laws !== 1 ? 's' : ''}
                        </div>
                        {data.peakWeek.topCategory && (
                          <div className={cn('mt-1 text-[10px] font-mono font-semibold', catText(data.peakWeek.topCategory))}>
                            {data.peakWeek.topCategory} dominated
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {data.quietWeek && (
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.44 }}
                      className="bg-surface-200 border border-surface-300 rounded-2xl p-4 flex items-start gap-3"
                    >
                      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-300 border border-surface-400 flex-shrink-0 mt-0.5">
                        <Moon className="h-4 w-4 text-surface-500" />
                      </div>
                      <div>
                        <div className="text-xs font-mono font-bold text-surface-400 mb-0.5">
                          CIVIC NADIR — Quietest Week
                        </div>
                        <div className="text-sm font-mono text-white">
                          {fmtWeekRange(data.quietWeek.startDate)}
                        </div>
                        <div className="text-[10px] font-mono text-surface-500 mt-1">
                          {data.quietWeek.total.toLocaleString()} total actions
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── Seasons ────────────────────────────────────────────── */}
              <div>
                <h2 className="text-sm font-mono font-bold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-for-400" />
                  Seasonal Breakdown
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.seasons.map((s, i) => (
                    <SeasonCard key={s.name} season={s} rank={i} />
                  ))}
                </div>
              </div>

              {/* ── Category colour key ─────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-surface-200 border border-surface-300 rounded-2xl p-4"
              >
                <h3 className="text-[10px] font-mono font-semibold text-surface-500 mb-3">
                  CATEGORY COLOURS
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {Object.entries(CAT_CFG).map(([cat, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <div key={cat} className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <Icon className={cn('h-2.5 w-2.5', cfg.text)} />
                        <span className="text-[10px] font-mono text-surface-400">{cat}</span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* ── Footer ─────────────────────────────────────────────── */}
              <div className="text-[10px] font-mono text-surface-600 text-right">
                Data covers the past 52 weeks · Updated{' '}
                {new Date(data.generatedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })} UTC
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
