'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Users,
  X,
  MessageSquare,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AMASession, AMAHost } from '@/app/api/ama/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionWithHost extends AMASession {
  host: AMAHost | null
}

interface Props {
  sessions: SessionWithHost[]
  initialYear: number
  initialMonth: number // 0-indexed
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CATEGORIES = [
  'All',
  'Policy',
  'Economy',
  'Health',
  'Technology',
  'Environment',
  'Education',
  'Foreign Policy',
  'Civil Rights',
  'Other',
]

const CATEGORY_COLORS: Record<string, string> = {
  Policy: 'bg-for-500/20 text-for-400 border-for-500/30',
  Economy: 'bg-gold/20 text-gold border-gold/30',
  Health: 'bg-emerald/20 text-emerald border-emerald/30',
  Technology: 'bg-purple/20 text-purple border-purple/30',
  Environment: 'bg-emerald/20 text-emerald border-emerald/30',
  Education: 'bg-for-500/20 text-for-400 border-for-500/30',
  'Foreign Policy': 'bg-gold/20 text-gold border-gold/30',
  'Civil Rights': 'bg-against-500/20 text-against-400 border-against-500/30',
  Other: 'bg-surface-400/20 text-surface-500 border-surface-400/30',
}

const CATEGORY_DOT: Record<string, string> = {
  Policy: 'bg-for-500',
  Economy: 'bg-gold',
  Health: 'bg-emerald',
  Technology: 'bg-purple',
  Environment: 'bg-emerald',
  Education: 'bg-for-500',
  'Foreign Policy': 'bg-gold',
  'Civil Rights': 'bg-against-500',
  Other: 'bg-surface-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateKey(iso: string): string {
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

function buildGrid(
  year: number,
  month: number,
  byDay: Map<string, SessionWithHost[]>
): Array<{ dateKey: string | null; day: number | null; sessions: SessionWithHost[] }> {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ dateKey: string | null; day: number | null; sessions: SessionWithHost[] }> = []

  for (let i = 0; i < firstDay; i++) {
    cells.push({ dateKey: null, day: null, sessions: [] })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const key = `${year}-${m}-${dd}`
    cells.push({ dateKey: key, day: d, sessions: byDay.get(key) ?? [] })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, sessions: [] })
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
  cell: { dateKey: string | null; day: number | null; sessions: SessionWithHost[] }
  isToday: boolean
  isSelected: boolean
  onClick: () => void
}) {
  const hasLive = cell.sessions.some((s) => s.status === 'live')
  const count = cell.sessions.length
  const dotColor = cell.sessions[0]?.category
    ? (CATEGORY_DOT[cell.sessions[0].category] ?? 'bg-purple')
    : 'bg-purple'

  if (!cell.day) {
    return <div className="min-h-[60px] sm:min-h-[72px]" />
  }

  return (
    <button
      onClick={onClick}
      aria-label={`${cell.dateKey}: ${count} session${count !== 1 ? 's' : ''}`}
      aria-pressed={isSelected}
      className={cn(
        'group relative min-h-[60px] sm:min-h-[72px] w-full rounded-xl p-2 text-left',
        'border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple',
        isSelected
          ? 'bg-purple/15 border-purple/60 shadow-sm'
          : count > 0
          ? 'bg-surface-200 border-surface-400 hover:bg-surface-300 hover:border-surface-500 cursor-pointer'
          : 'bg-surface-100 border-surface-300 hover:bg-surface-200 cursor-default'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center h-6 w-6 rounded-full text-sm font-mono font-medium transition-colors',
          isToday
            ? 'bg-purple text-white'
            : isSelected
            ? 'bg-purple/20 text-purple'
            : 'text-surface-700 group-hover:text-white'
        )}
      >
        {cell.day}
      </span>

      {count > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {hasLive && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-against-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
            </span>
          )}
          {!hasLive && <span className={cn('h-2 w-2 rounded-full flex-shrink-0', dotColor)} />}
          {count > 1 && (
            <span className="text-[9px] font-mono text-surface-500">+{count - 1}</span>
          )}
        </div>
      )}

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
  sessions,
  onClose,
}: {
  dateKey: string
  sessions: SessionWithHost[]
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-surface-500">{label}</div>
          <div className="text-sm font-semibold text-white mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
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

      <div className="overflow-y-auto max-h-[50vh] lg:max-h-[500px] divide-y divide-surface-300">
        {sessions.map((s) => {
          const isLive = s.status === 'live'
          const catColor = s.category ? (CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.Other) : CATEGORY_COLORS.Other

          return (
            <div key={s.id} className="p-5 hover:bg-surface-200 transition-colors">
              {/* Status + category */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                    {formatTime(s.scheduled_at)}
                  </div>
                )}
                {s.category && (
                  <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-mono border', catColor)}>
                    {s.category}
                  </span>
                )}
                {s.user_rsvped && (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald ml-auto flex-shrink-0" />
                )}
              </div>

              {/* Host */}
              {s.host && (
                <div className="flex items-center gap-2 mb-2">
                  {s.host.avatar_url ? (
                    <Image
                      src={s.host.avatar_url}
                      alt={s.host.display_name ?? s.host.username}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-purple/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-purple">
                        {(s.host.display_name ?? s.host.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-[11px] font-mono text-surface-500 truncate">
                    {s.host.display_name ?? s.host.username}
                  </span>
                </div>
              )}

              {/* Title */}
              <p className="text-sm font-medium text-white leading-snug mb-3 line-clamp-2">
                {s.title}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-3 mb-3 text-[11px] font-mono text-surface-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {s.rsvp_count} RSVP{s.rsvp_count !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {s.question_count} Q
                </span>
              </div>

              {/* CTA */}
              <Link
                href={`/ama/${s.id}`}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors',
                  isLive
                    ? 'bg-against-600 hover:bg-against-700 text-white'
                    : 'bg-purple/20 border border-purple/30 text-purple hover:bg-purple/30'
                )}
              >
                {isLive ? 'Join Live AMA' : 'View Session'}
              </Link>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main Calendar ─────────────────────────────────────────────────────────────

export function AMAScheduleCalendar({ sessions, initialYear, initialMonth }: Props) {
  const today = new Date()
  const todayKey = localDateKey(today.toISOString())

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('All')

  const filteredSessions = useMemo(() => {
    if (categoryFilter === 'All') return sessions
    return sessions.filter((s) => s.category === categoryFilter)
  }, [sessions, categoryFilter])

  const byDay = useMemo(() => {
    const map = new Map<string, SessionWithHost[]>()
    for (const s of filteredSessions) {
      const key = localDateKey(s.scheduled_at)
      const existing = map.get(key) ?? []
      existing.push(s)
      map.set(key, existing)
    }
    return map
  }, [filteredSessions])

  const grid = useMemo(() => buildGrid(year, month, byDay), [year, month, byDay])

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthSessions = filteredSessions.filter((s) =>
    localDateKey(s.scheduled_at).startsWith(monthKey)
  )
  const liveCount = monthSessions.filter((s) => s.status === 'live').length
  const upcomingCount = monthSessions.filter((s) => s.status === 'upcoming').length

  // Categories present in the data
  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const s of sessions) {
      if (s.category) cats.add(s.category)
    }
    return ['All', ...CATEGORIES.slice(1).filter((c) => cats.has(c))]
  }, [sessions])

  function prevMonth() {
    setSelectedKey(null)
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    setSelectedKey(null)
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  function handleDayClick(dateKey: string | null, hasSessions: boolean) {
    if (!dateKey || !hasSessions) return
    setSelectedKey((prev) => (prev === dateKey ? null : dateKey))
  }

  const selectedSessions = selectedKey ? (byDay.get(selectedKey) ?? []) : []

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      {availableCategories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setSelectedKey(null) }}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                cat === categoryFilter
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200 border-surface-400 text-surface-500 hover:border-surface-500 hover:text-white'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
          {upcomingCount > 0 && (
            <span className="flex items-center gap-1.5 text-purple">
              <span className="h-2 w-2 rounded-full bg-purple" />
              {upcomingCount} upcoming
            </span>
          )}
          {monthSessions.length === 0 && (
            <span className="text-surface-500">No sessions this month</span>
          )}
        </div>
      </div>

      {/* Calendar + Detail panel */}
      <div className={cn('grid gap-4', selectedKey ? 'lg:grid-cols-3' : 'grid-cols-1')}>
        <div className={cn(selectedKey ? 'lg:col-span-2' : 'col-span-1')}>
          {/* Day headers */}
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

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => (
              <DayCell
                key={cell.dateKey ?? `blank-${i}`}
                cell={cell}
                isToday={cell.dateKey === todayKey}
                isSelected={cell.dateKey === selectedKey}
                onClick={() => handleDayClick(cell.dateKey, cell.sessions.length > 0)}
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
              <span className="h-2 w-2 rounded-full bg-purple" />
              Upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple text-white text-[9px]">
                15
              </span>
              Today
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedKey && (
            <DayPanel
              key={selectedKey}
              dateKey={selectedKey}
              sessions={selectedSessions}
              onClose={() => setSelectedKey(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Empty month state */}
      {monthSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 mb-4">
            <CalendarDays className="h-5 w-5 text-surface-500" />
          </div>
          <p className="text-sm font-mono text-surface-500">
            No {categoryFilter !== 'All' ? categoryFilter + ' ' : ''}sessions in {MONTH_NAMES[month]}.
          </p>
          <p className="text-xs text-surface-600 mt-1">Check back or request an AMA.</p>
          <Link
            href="/ama/request"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple/20 border border-purple/30 hover:bg-purple/30 text-sm font-mono font-medium text-purple transition-colors"
          >
            Request an AMA
          </Link>
        </div>
      )}

      {/* Upcoming list */}
      {filteredSessions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-mono uppercase tracking-wider text-surface-500 mb-3 flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            All Upcoming ({filteredSessions.filter((s) => s.status !== 'ended').length})
          </h3>
          <div className="space-y-2">
            {filteredSessions
              .filter((s) => s.status !== 'ended')
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              .slice(0, 10)
              .map((s) => {
                const isLive = s.status === 'live'
                const dt = new Date(s.scheduled_at)
                const dayLabel = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const timeLabel = formatTime(s.scheduled_at)
                const catColor = s.category
                  ? (CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.Other)
                  : CATEGORY_COLORS.Other

                return (
                  <Link
                    key={s.id}
                    href={`/ama/${s.id}`}
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

                    {/* Host avatar */}
                    {s.host && (
                      s.host.avatar_url ? (
                        <Image
                          src={s.host.avatar_url}
                          alt={s.host.display_name ?? s.host.username}
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-purple/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-purple">
                            {(s.host.display_name ?? s.host.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )
                    )}

                    {/* Title + category */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-1">{s.title}</p>
                      {s.host && (
                        <p className="text-xs text-surface-500 line-clamp-1">
                          {s.host.display_name ?? s.host.username}
                        </p>
                      )}
                    </div>

                    {/* Category + RSVP */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      {s.category && (
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono border', catColor)}>
                          {s.category}
                        </span>
                      )}
                      {s.user_rsvped && (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald" />
                      )}
                    </div>
                  </Link>
                )
              })}
          </div>

          {filteredSessions.filter((s) => s.status !== 'ended').length > 10 && (
            <Link
              href="/ama"
              className="block text-center text-xs font-mono text-surface-500 hover:text-purple mt-3 transition-colors"
            >
              View all AMA sessions →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
