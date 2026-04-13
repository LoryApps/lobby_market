'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Mic,
  Clock,
  Plus,
  X,
  CalendarCheck,
} from 'lucide-react'
import { DebateRSVPButton } from '@/components/debate/DebateRSVPButton'
import { cn } from '@/lib/utils/cn'
import type { DebateWithTopic, DebateParticipantWithProfile } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebateWithParticipants extends DebateWithTopic {
  participants: DebateParticipantWithProfile[]
  rsvp_count?: number
}

interface Props {
  debates: DebateWithParticipants[]
  initialYear: number
  initialMonth: number // 0-indexed
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TYPE_LABEL: Record<string, string> = {
  quick: '15m',
  grand: '45m',
  tribunal: '60m',
}

function localDateKey(iso: string): string {
  // Returns YYYY-MM-DD in local time (not UTC) so debates appear on correct day.
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(type: string): string {
  return TYPE_LABEL[type] ?? type
}

// Build an array of { date, debates } for a given year/month.
// Fills in blank days around the first/last of the month to form full weeks.
function buildGrid(
  year: number,
  month: number,
  byDay: Map<string, DebateWithParticipants[]>
): Array<{ dateKey: string | null; day: number | null; debates: DebateWithParticipants[] }> {
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ dateKey: string | null; day: number | null; debates: DebateWithParticipants[] }> = []

  // Leading blanks
  for (let i = 0; i < firstDay; i++) {
    cells.push({ dateKey: null, day: null, debates: [] })
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const key = `${year}-${m}-${dd}`
    cells.push({ dateKey: key, day: d, debates: byDay.get(key) ?? [] })
  }

  // Trailing blanks to complete the last row
  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, debates: [] })
  }

  return cells
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({
  cell,
  isToday,
  isSelected,
  onClick,
}: {
  cell: { dateKey: string | null; day: number | null; debates: DebateWithParticipants[] }
  isToday: boolean
  isSelected: boolean
  onClick: () => void
}) {
  const hasLive = cell.debates.some((d) => d.status === 'live')
  const hasScheduled = cell.debates.some((d) => d.status === 'scheduled')
  const count = cell.debates.length

  if (!cell.day) {
    return <div className="min-h-[60px] sm:min-h-[72px]" />
  }

  return (
    <button
      onClick={onClick}
      aria-label={`${cell.dateKey}: ${count} debate${count !== 1 ? 's' : ''}`}
      aria-pressed={isSelected}
      className={cn(
        'group relative min-h-[60px] sm:min-h-[72px] w-full rounded-xl p-2 text-left',
        'border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
        isSelected
          ? 'bg-for-500/15 border-for-500/60 shadow-sm'
          : count > 0
          ? 'bg-surface-200 border-surface-400 hover:bg-surface-300 hover:border-surface-500 cursor-pointer'
          : 'bg-surface-100 border-surface-300 hover:bg-surface-200 cursor-default'
      )}
    >
      {/* Day number */}
      <span
        className={cn(
          'flex items-center justify-center h-6 w-6 rounded-full text-sm font-mono font-medium transition-colors',
          isToday
            ? 'bg-for-500 text-white'
            : isSelected
            ? 'bg-for-500/20 text-for-400'
            : 'text-surface-700 group-hover:text-white'
        )}
      >
        {cell.day}
      </span>

      {/* Debate indicators */}
      {count > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {hasLive && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-against-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
            </span>
          )}
          {hasScheduled && (
            <span className="h-2 w-2 rounded-full bg-for-500 flex-shrink-0" />
          )}
          {count > 2 && (
            <span className="text-[9px] font-mono text-surface-500">
              +{count - (hasLive ? 1 : 0) - (hasScheduled ? 1 : 0)}
            </span>
          )}
        </div>
      )}

      {/* Count badge on hover */}
      {count > 0 && (
        <span className="absolute top-1 right-1 hidden sm:flex items-center justify-center h-4 min-w-4 rounded-full bg-surface-400 text-[10px] font-mono text-white px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Day Panel ─────────────────────────────────────────────────────────────────

function DayPanel({
  dateKey,
  debates,
  onClose,
}: {
  dateKey: string
  debates: DebateWithParticipants[]
  onClose: () => void
}) {
  const date = new Date(dateKey + 'T00:00:00')
  const label = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <motion.div
      key={dateKey}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="lg:col-span-1 rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-surface-500">
            {label}
          </div>
          <div className="text-sm font-semibold text-white mt-0.5">
            {debates.length} debate{debates.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Debates */}
      <div className="overflow-y-auto max-h-[50vh] lg:max-h-[500px] divide-y divide-surface-300">
        {debates.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-surface-500 font-mono">
            No debates on this day.
          </div>
        ) : (
          debates.map((d) => {
            const isLive = d.status === 'live'
            return (
              <div key={d.id} className="p-5 hover:bg-surface-200 transition-colors">
                {/* Status + type */}
                <div className="flex items-center gap-2 mb-2">
                  {isLive ? (
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-against-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-against-400">
                        Live
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(d.scheduled_at)}
                    </div>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    {formatDuration(d.type)}
                  </span>
                </div>

                {/* Title */}
                <p className="text-sm font-medium text-white leading-snug mb-1 line-clamp-2">
                  {d.title}
                </p>

                {/* Topic statement */}
                {d.topic && (
                  <p className="text-xs text-surface-500 line-clamp-1 mb-3">
                    {d.topic.statement}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/debate/${d.id}`}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors',
                      isLive
                        ? 'bg-against-600 hover:bg-against-700 text-white'
                        : 'bg-for-600 hover:bg-for-700 text-white'
                    )}
                  >
                    <Mic className="h-3 w-3" />
                    {isLive ? 'Join Live' : 'View'}
                  </Link>
                  {!isLive && (
                    <DebateRSVPButton
                      debateId={d.id}
                      initialCount={d.rsvp_count ?? 0}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Schedule CTA */}
      <div className="px-5 py-4 border-t border-surface-300">
        <Link
          href="/debate/create"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-surface-400 text-xs font-mono text-surface-500 hover:border-for-500/50 hover:text-for-400 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Schedule a debate on this day
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main Calendar ─────────────────────────────────────────────────────────────

export function DebateCalendar({ debates, initialYear, initialMonth }: Props) {
  const today = new Date()
  const todayKey = localDateKey(today.toISOString())

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Build lookup: date key → debates
  const byDay = useMemo(() => {
    const map = new Map<string, DebateWithParticipants[]>()
    for (const debate of debates) {
      const key = localDateKey(debate.scheduled_at)
      const existing = map.get(key) ?? []
      existing.push(debate)
      map.set(key, existing)
    }
    return map
  }, [debates])

  const grid = useMemo(() => buildGrid(year, month, byDay), [year, month, byDay])

  // Summary stats for this month
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthDebates = debates.filter((d) => {
    return localDateKey(d.scheduled_at).startsWith(monthKey)
  })
  const liveCount = monthDebates.filter((d) => d.status === 'live').length
  const scheduledCount = monthDebates.filter((d) => d.status === 'scheduled').length

  function prevMonth() {
    setSelectedKey(null)
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    setSelectedKey(null)
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function handleDayClick(dateKey: string | null, hasDebates: boolean) {
    if (!dateKey) return
    if (!hasDebates) return
    setSelectedKey((prev) => (prev === dateKey ? null : dateKey))
  }

  const selectedDebates = selectedKey ? (byDay.get(selectedKey) ?? []) : []

  return (
    <div className="space-y-4">
      {/* Month navigation + stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="font-mono text-lg font-bold text-white min-w-[160px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 text-against-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-against-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
              </span>
              {liveCount} live
            </span>
          )}
          {scheduledCount > 0 && (
            <span className="flex items-center gap-1.5 text-for-400">
              <span className="h-2 w-2 rounded-full bg-for-500" />
              {scheduledCount} scheduled
            </span>
          )}
          {monthDebates.length === 0 && (
            <span className="text-surface-500">No debates this month</span>
          )}
        </div>
      </div>

      {/* Calendar + Detail panel */}
      <div className={cn(
        'grid gap-4',
        selectedKey ? 'lg:grid-cols-3' : 'grid-cols-1'
      )}>
        {/* Calendar grid */}
        <div className={cn(selectedKey ? 'lg:col-span-2' : 'col-span-1')}>
          {/* Day header row */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-mono text-surface-500 uppercase tracking-wider pb-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => (
              <DayCell
                key={cell.dateKey ?? `blank-${i}`}
                cell={cell}
                isToday={cell.dateKey === todayKey}
                isSelected={cell.dateKey === selectedKey}
                onClick={() => handleDayClick(cell.dateKey, cell.debates.length > 0)}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 px-1 text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-against-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
              </span>
              Live now
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-for-500" />
              Scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-for-500 text-white text-[9px]">
                15
              </span>
              Today
            </span>
          </div>
        </div>

        {/* Selected day panel */}
        <AnimatePresence mode="wait">
          {selectedKey && (
            <DayPanel
              key={selectedKey}
              dateKey={selectedKey}
              debates={selectedDebates}
              onClose={() => setSelectedKey(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Empty month state */}
      {monthDebates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 mb-4">
            <Calendar className="h-5 w-5 text-surface-500" />
          </div>
          <p className="text-sm font-mono text-surface-500">No debates in {MONTH_NAMES[month]}.</p>
          <p className="text-xs text-surface-600 mt-1">Be the first to schedule one.</p>
          <Link
            href="/debate/create"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-sm font-mono font-medium text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Schedule a Debate
          </Link>
        </div>
      )}

      {/* All upcoming list (below calendar, compact) */}
      {debates.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-mono uppercase tracking-wider text-surface-500 mb-3 flex items-center gap-2">
            <CalendarCheck className="h-3.5 w-3.5" />
            All Upcoming ({debates.filter(d => d.status !== 'ended').length})
          </h3>
          <div className="space-y-2">
            {debates
              .filter((d) => d.status !== 'ended')
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              .slice(0, 10)
              .map((d) => {
                const isLive = d.status === 'live'
                const dt = new Date(d.scheduled_at)
                const dayLabel = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const timeLabel = formatTime(d.scheduled_at)

                return (
                  <Link
                    key={d.id}
                    href={`/debate/${d.id}`}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl transition-all',
                      'border border-surface-300 bg-surface-100 hover:bg-surface-200',
                      isLive && 'border-against-500/30 bg-against-500/[0.04]'
                    )}
                  >
                    {/* Date block */}
                    <div className="flex-shrink-0 w-12 text-center">
                      {isLive ? (
                        <span className="relative flex h-2.5 w-2.5 mx-auto">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-against-500 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-against-500" />
                        </span>
                      ) : (
                        <>
                          <div className="text-xs font-mono text-surface-500">{dayLabel}</div>
                          <div className="text-[10px] font-mono text-surface-600">{timeLabel}</div>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-1">{d.title}</p>
                      {d.topic && (
                        <p className="text-xs text-surface-500 line-clamp-1">{d.topic.statement}</p>
                      )}
                    </div>

                    {/* Type + live badge */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-surface-500 uppercase">
                        {formatDuration(d.type)}
                      </span>
                      {isLive && (
                        <span className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-wider">
                          Live
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
          </div>

          {debates.filter(d => d.status !== 'ended').length > 10 && (
            <Link
              href="/debate"
              className="block text-center text-xs font-mono text-surface-500 hover:text-for-400 mt-3 transition-colors"
            >
              View all debates →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
