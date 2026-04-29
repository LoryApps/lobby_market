'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gavel,
  Globe,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsUp,
  User,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { CalendarDay, CalendarResponse } from '@/app/api/stats/activity-calendar/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

// Level → colour classes
const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-surface-200 border-surface-300/50',
  1: 'bg-for-500/20 border-for-500/30',
  2: 'bg-for-500/40 border-for-500/40',
  3: 'bg-for-500/65 border-for-500/50',
  4: 'bg-for-500 border-for-600',
}

const LEVEL_LABEL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'No activity',
  1: 'Light activity',
  2: 'Moderate activity',
  3: 'High activity',
  4: 'Peak activity',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipState {
  day: CalendarDay
  x: number
  y: number
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

interface CalendarGridProps {
  days: CalendarDay[]
  year: number
  onHover: (state: TooltipState | null) => void
  onSelect: (day: CalendarDay | null) => void
  selectedDate: string | null
}

function CalendarGrid({ days, year, onHover, onSelect, selectedDate }: CalendarGridProps) {
  // Build a 2D grid: columns = weeks (0..52), rows = days (0..6)
  const grid = useMemo(() => {
    // Find what day of week Jan 1 falls on
    const jan1 = new Date(`${year}-01-01T00:00:00Z`)
    const startDow = jan1.getUTCDay() // 0=Sun

    const cols: (CalendarDay | null)[][] = []
    let col: (CalendarDay | null)[] = Array(startDow).fill(null)

    for (const day of days) {
      col.push(day)
      if (col.length === 7) {
        cols.push(col)
        col = []
      }
    }
    if (col.length > 0) {
      while (col.length < 7) col.push(null)
      cols.push(col)
    }

    return cols
  }, [days, year])

  // Month label positions
  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    grid.forEach((col, ci) => {
      const firstReal = col.find((d) => d !== null)
      if (firstReal) {
        const m = parseInt(firstReal.date.slice(5, 7), 10) - 1
        if (m !== lastMonth) {
          labels.push({ col: ci, label: MONTHS[m] })
          lastMonth = m
        }
      }
    })
    return labels
  }, [grid])

  return (
    <div className="relative overflow-x-auto pb-2">
      <div className="inline-flex flex-col gap-1 min-w-max">
        {/* Month labels */}
        <div className="flex gap-1 pl-8 mb-0.5">
          {grid.map((_, ci) => {
            const label = monthLabels.find((l) => l.col === ci)
            return (
              <div key={ci} className="w-3 text-[9px] text-surface-500 leading-none">
                {label ? label.label : ''}
              </div>
            )
          })}
        </div>

        {/* Weekday labels + grid rows */}
        {WEEKDAYS.map((_, row) => (
          <div key={row} className="flex items-center gap-1">
            {/* Weekday label */}
            <span className="w-7 text-[9px] text-surface-500 text-right pr-1 leading-none shrink-0">
              {WEEKDAY_LABELS[row]}
            </span>

            {/* Squares for this row */}
            {grid.map((col, ci) => {
              const day = col[row]
              if (!day) {
                return <div key={ci} className="w-3 h-3" />
              }

              const isSelected = day.date === selectedDate

              return (
                <motion.button
                  key={ci}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.1 }}
                  className={cn(
                    'w-3 h-3 rounded-sm border transition-all duration-100 cursor-pointer',
                    LEVEL_CLASSES[day.level],
                    isSelected && 'ring-1 ring-white ring-offset-1 ring-offset-surface-100',
                  )}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onHover({ day, x: rect.left + rect.width / 2, y: rect.top })
                  }}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(isSelected ? null : day)}
                  aria-label={`${formatDate(day.date)}: ${day.total} actions`}
                />
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 pl-8 mt-2">
          <span className="text-[10px] text-surface-500">Less</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <div
              key={lvl}
              className={cn('w-3 h-3 rounded-sm border', LEVEL_CLASSES[lvl])}
              title={LEVEL_LABEL[lvl]}
            />
          ))}
          <span className="text-[10px] text-surface-500">More</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Activity
  label: string
  value: number
  sub?: string
  accent: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', accent)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">
        <AnimatedNumber value={value} />
      </div>
      {sub && <div className="text-xs text-surface-500">{sub}</div>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActivityCalendarClient() {
  const currentYear = new Date().getUTCFullYear()
  const [year, setYear] = useState(currentYear)
  const [mode, setMode] = useState<'personal' | 'platform'>('personal')
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [selected, setSelected] = useState<CalendarDay | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(null)
    try {
      const res = await fetch(`/api/stats/activity-calendar?year=${year}&mode=${mode}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as CalendarResponse
      setData(json)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [year, mode])

  useEffect(() => { load() }, [load])

  const handleHover = useCallback((state: TooltipState | null) => {
    setTooltip(state)
  }, [])

  const handleSelect = useCallback((day: CalendarDay | null) => {
    setSelected(day)
  }, [])

  const { days, totals } = data ?? { days: [], totals: null }

  // Summary for selected day
  const selectedInfo = selected

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-for-400" />
              Activity Calendar
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              {mode === 'personal' ? 'Your daily civic engagement' : 'Platform-wide daily activity'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-surface-300 overflow-hidden text-xs">
            {(['personal', 'platform'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-2 flex items-center gap-1.5 transition-colors capitalize',
                  mode === m
                    ? 'bg-for-500/20 text-for-300'
                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200/50',
                )}
              >
                {m === 'personal' ? <User className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {m}
              </button>
            ))}
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= 2024}
              className="p-1.5 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous year"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-white tabular-nums w-12 text-center">
              {year}
            </span>
            <button
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= currentYear}
              className="p-1.5 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next year"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={load}
              className="p-1.5 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stat cards */}
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard
              icon={ThumbsUp}
              label="Votes"
              value={totals.votes}
              accent="text-for-400"
            />
            <StatCard
              icon={MessageSquare}
              label="Arguments"
              value={totals.arguments}
              accent="text-purple"
            />
            <StatCard
              icon={Gavel}
              label="Laws"
              value={totals.laws}
              accent="text-gold"
            />
            <StatCard
              icon={Activity}
              label="Active Days"
              value={totals.activeDays}
              sub={`of ${days.length} days`}
              accent="text-emerald"
            />
            <StatCard
              icon={Flame}
              label="Current Streak"
              value={totals.currentStreak}
              sub="days"
              accent="text-against-400"
            />
            <StatCard
              icon={Zap}
              label="Longest Streak"
              value={totals.longestStreak}
              sub="days"
              accent="text-gold"
            />
          </div>
        )}

        {/* Calendar */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 md:p-6 relative">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-surface-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading calendar…
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${year}-${mode}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <CalendarGrid
                  days={days}
                  year={year}
                  onHover={handleHover}
                  onSelect={handleSelect}
                  selectedDate={selected?.date ?? null}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Selected day detail */}
        <AnimatePresence>
          {selectedInfo && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-xl bg-surface-100 border border-surface-300 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    {formatDate(selectedInfo.date)}
                  </h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {selectedInfo.total === 0
                      ? 'No activity recorded'
                      : `${selectedInfo.total} action${selectedInfo.total !== 1 ? 's' : ''} · ${LEVEL_LABEL[selectedInfo.level]}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-surface-500 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-surface-200 p-3 text-center">
                  <ThumbsUp className="h-4 w-4 text-for-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-white">{selectedInfo.votes}</div>
                  <div className="text-[10px] text-surface-500">Votes</div>
                </div>
                <div className="rounded-lg bg-surface-200 p-3 text-center">
                  <MessageSquare className="h-4 w-4 text-purple mx-auto mb-1" />
                  <div className="text-lg font-bold text-white">{selectedInfo.arguments}</div>
                  <div className="text-[10px] text-surface-500">Arguments</div>
                </div>
                <div className="rounded-lg bg-surface-200 p-3 text-center">
                  <Gavel className="h-4 w-4 text-gold mx-auto mb-1" />
                  <div className="text-lg font-bold text-white">{selectedInfo.laws}</div>
                  <div className="text-[10px] text-surface-500">Laws</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation links */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>
          <Link
            href="/streaks"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <Flame className="h-3.5 w-3.5" />
            Streaks
          </Link>
          <Link
            href="/wrapped"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            Year Wrapped
          </Link>
          <Link
            href="/my-week"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            My Week
          </Link>
        </div>
      </main>

      {/* Hover tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-surface-0 border border-surface-300 rounded-lg px-3 py-2 shadow-lg text-xs">
              <div className="font-medium text-white mb-1">
                {new Date(tooltip.day.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </div>
              {tooltip.day.total === 0 ? (
                <div className="text-surface-500">No activity</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {tooltip.day.votes > 0 && (
                    <span className="text-for-400">{tooltip.day.votes} vote{tooltip.day.votes !== 1 ? 's' : ''}</span>
                  )}
                  {tooltip.day.arguments > 0 && (
                    <span className="text-purple">{tooltip.day.arguments} argument{tooltip.day.arguments !== 1 ? 's' : ''}</span>
                  )}
                  {tooltip.day.laws > 0 && (
                    <span className="text-gold">{tooltip.day.laws} law{tooltip.day.laws !== 1 ? 's' : ''}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
