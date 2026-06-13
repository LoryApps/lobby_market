'use client'

/**
 * /gazette/archive — The Civic Gazette Archive
 *
 * A calendar-style index of every past gazette edition. Each day is a
 * clickable cell that navigates to /gazette/[date]. Visual indicators
 * show which days had notable activity: laws established, high vote counts,
 * active debates.
 *
 * Distinct from:
 *   /gazette           — today's live edition
 *   /gazette/[date]    — a specific past edition
 *   /records           — platform records (top votes, streaks, etc.)
 *   /history           — chronological event log
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  Newspaper,
  RefreshCw,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ArchiveDay, ArchiveMonth, GazetteArchiveResponse } from '@/app/api/gazette/archive/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isToday(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10)
}

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay()
}

function dayNumber(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDate()
}

// Returns 0-7 blank cells to push the first day to the right column
function leadingBlanks(month: ArchiveMonth): number {
  if (month.days.length === 0) return 0
  return dayOfWeek(month.days[0].date)
}

// Activity level for background shade intensity
function activityLevel(day: ArchiveDay): 'none' | 'low' | 'medium' | 'high' | 'peak' {
  const total = day.votes_count + day.arguments_count * 3 + day.laws_count * 20
  if (total === 0) return 'none'
  if (total < 10) return 'low'
  if (total < 50) return 'medium'
  if (total < 200) return 'high'
  return 'peak'
}

const ACTIVITY_BG: Record<ReturnType<typeof activityLevel>, string> = {
  none: 'bg-surface-300/20',
  low: 'bg-for-600/15',
  medium: 'bg-for-600/25',
  high: 'bg-for-600/40',
  peak: 'bg-for-500/55',
}

const ACTIVITY_BORDER: Record<ReturnType<typeof activityLevel>, string> = {
  none: 'border-surface-300/20',
  low: 'border-for-600/20',
  medium: 'border-for-500/30',
  high: 'border-for-500/45',
  peak: 'border-for-400/60',
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ─── Day tooltip content ──────────────────────────────────────────────────────

interface DayTooltipProps {
  day: ArchiveDay
}

function DayTooltip({ day }: DayTooltipProps) {
  const d = new Date(day.date + 'T12:00:00Z')
  const label = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none w-52">
      <div className="rounded-xl border border-surface-300 bg-surface-100 shadow-2xl p-3 text-left">
        <div className="flex items-center gap-1.5 mb-2">
          <Newspaper className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <span className="text-[10px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
            Edition #{day.edition}
          </span>
        </div>
        <p className="text-xs font-mono text-white mb-2 leading-tight">{label}</p>
        <div className="space-y-1">
          {day.laws_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <Gavel className="h-3 w-3 text-gold flex-shrink-0" />
              <span className="text-gold font-semibold">
                {day.laws_count} law{day.laws_count !== 1 ? 's' : ''} established
              </span>
            </div>
          )}
          {day.votes_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-400">
              <ThumbsUp className="h-3 w-3 flex-shrink-0" />
              {day.votes_count.toLocaleString()} votes
            </div>
          )}
          {day.arguments_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-400">
              <MessageSquare className="h-3 w-3 flex-shrink-0" />
              {day.arguments_count} arguments
            </div>
          )}
          {day.topics_count > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-400">
              <Zap className="h-3 w-3 flex-shrink-0" />
              {day.topics_count} new topic{day.topics_count !== 1 ? 's' : ''}
            </div>
          )}
          {day.has_debate && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple">
              <Flame className="h-3 w-3 flex-shrink-0" />
              Debate held
            </div>
          )}
        </div>
      </div>
      {/* Caret */}
      <div className="w-3 h-3 bg-surface-100 border-b border-r border-surface-300 rotate-45 -mt-1.5 mx-auto" />
    </div>
  )
}

// ─── Calendar day cell ────────────────────────────────────────────────────────

function DayCell({ day }: { day: ArchiveDay }) {
  const [showTip, setShowTip] = useState(false)
  const level = activityLevel(day)
  const today = isToday(day.date)

  return (
    <Link
      href={`/gazette/${day.date}`}
      className={cn(
        'relative flex flex-col items-center justify-center aspect-square rounded-lg border text-center',
        'transition-all duration-150 hover:scale-105 hover:z-10',
        today
          ? 'border-for-500/60 ring-1 ring-for-500/40'
          : ACTIVITY_BORDER[level],
        ACTIVITY_BG[level],
        'group',
      )}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      aria-label={`Gazette edition ${day.edition} — ${day.date}`}
    >
      {/* Day number */}
      <span
        className={cn(
          'text-[11px] font-mono font-bold leading-none',
          today ? 'text-for-300' : level === 'none' ? 'text-surface-600' : 'text-white',
        )}
      >
        {dayNumber(day.date)}
      </span>

      {/* Indicators */}
      <div className="flex gap-0.5 mt-0.5 justify-center min-h-[8px]">
        {day.laws_count > 0 && (
          <span
            className="block h-1.5 w-1.5 rounded-full bg-gold"
            aria-hidden="true"
          />
        )}
        {day.has_debate && (
          <span
            className="block h-1.5 w-1.5 rounded-full bg-purple"
            aria-hidden="true"
          />
        )}
        {day.votes_count > 100 && (
          <span
            className="block h-1.5 w-1.5 rounded-full bg-for-400"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Today ring label */}
      {today && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-for-400 uppercase tracking-widest whitespace-nowrap">
          today
        </span>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            <DayTooltip day={day} />
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  )
}

// ─── Month calendar ───────────────────────────────────────────────────────────

function MonthCalendar({ month }: { month: ArchiveMonth }) {
  const blanks = leadingBlanks(month)
  const lawCount = month.days.reduce((s, d) => s + d.laws_count, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-surface-300/60 bg-surface-100 overflow-hidden"
    >
      {/* Month header */}
      <div className="px-4 py-3 border-b border-surface-300/40 flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold text-white">{month.label}</h2>
        {lawCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
            <Gavel className="h-3 w-3" />
            {lawCount} law{lawCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 px-3 pt-2 pb-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-[9px] font-mono font-semibold text-surface-600 uppercase tracking-wider">
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
        {/* Leading blanks */}
        {Array.from({ length: blanks }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {/* Day cells */}
        {month.days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArchiveSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300/40 bg-surface-100 overflow-hidden animate-pulse">
          <div className="px-4 py-3 border-b border-surface-300/30">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="grid grid-cols-7 gap-1 p-3">
            {Array.from({ length: 35 }).map((_, j) => (
              <div key={j} className="aspect-square rounded-lg bg-surface-300/20" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-[10px] font-mono text-surface-500">
      <span className="flex items-center gap-1.5">
        <span className="block h-2 w-2 rounded-sm bg-for-500/55 border border-for-400/60" />
        High activity
      </span>
      <span className="flex items-center gap-1.5">
        <span className="block h-1.5 w-1.5 rounded-full bg-gold" />
        Law established
      </span>
      <span className="flex items-center gap-1.5">
        <span className="block h-1.5 w-1.5 rounded-full bg-purple" />
        Debate held
      </span>
      <span className="flex items-center gap-1.5">
        <span className="block h-1.5 w-1.5 rounded-full bg-for-400" />
        100+ votes
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GazetteArchivePage() {
  const [data, setData] = useState<GazetteArchiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [visibleMonths, setVisibleMonths] = useState(3)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gazette/archive')
      if (!res.ok) throw new Error('Failed to load archive')
      const json = (await res.json()) as GazetteArchiveResponse
      setData(json)
    } catch {
      // silent — skeleton remains
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/gazette"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Back to today's gazette"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 border border-surface-300">
                <Newspaper className="h-5 w-5 text-surface-400" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white">Gazette Archive</h1>
                <p className="text-xs font-mono text-surface-500">Every edition, every day</p>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-3 mb-4"
            >
              {[
                { label: 'Total editions', value: data.total_editions.toLocaleString(), icon: Calendar },
                { label: 'Laws on record', value: data.total_laws.toLocaleString(), icon: Gavel },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200/60 border border-surface-300/50"
                >
                  <Icon className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                  <span className="text-xs font-mono font-semibold text-white">{value}</span>
                  <span className="text-xs font-mono text-surface-500">{label}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Today shortcut */}
          <div className="flex items-center justify-between">
            <Legend />
            <Link
              href={`/gazette/${today}`}
              className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors font-semibold"
              aria-label={`Today's edition — ${todayFormatted}`}
            >
              Today&apos;s edition
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Calendar grid ──────────────────────────────────────────────── */}
        {loading ? (
          <ArchiveSkeleton />
        ) : !data || data.months.length === 0 ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <Newspaper className="h-10 w-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-mono text-surface-400">No archive data available yet.</p>
            <p className="text-xs font-mono text-surface-600 mt-1">
              The gazette will begin recording once topics are active.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.months.slice(0, visibleMonths).map((month) => (
              <MonthCalendar key={`${month.year}-${month.month}`} month={month} />
            ))}

            {/* Load more */}
            {visibleMonths < data.months.length && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setVisibleMonths((v) => v + 3)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-mono font-semibold transition-colors',
                    'border-surface-300 bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-white',
                  )}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Load {Math.min(3, data.months.length - visibleMonths)} more month
                  {Math.min(3, data.months.length - visibleMonths) !== 1 ? 's' : ''}
                </button>
              </div>
            )}

            {/* Refresh */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* ── Navigation strip ────────────────────────────────────────────── */}
        <div className="mt-8 rounded-xl border border-surface-300 bg-surface-100 p-4">
          <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wide">
            Browse gazette editions
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/gazette', label: 'Today', icon: Newspaper },
              { href: '/records', label: 'Records', icon: ArrowRight },
              { href: '/history', label: 'History', icon: Calendar },
              { href: '/epoch', label: 'Epochs', icon: ArrowRight },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Icon className="h-3 w-3" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
