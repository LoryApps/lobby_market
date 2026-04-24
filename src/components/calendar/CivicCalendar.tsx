'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Mic,
  Gavel,
  Vote,
  Clock,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CivicEventType = 'debate' | 'vote_end' | 'law' | 'vote_start'

export interface CivicEvent {
  id: string
  type: CivicEventType
  title: string
  href: string
  at: string // ISO string
  category: string | null
  /** Debate-specific */
  debateType?: string
  /** Topic voting - ends vs starts */
  votePct?: number
}

interface Props {
  events: CivicEvent[]
  initialYear: number
  initialMonth: number // 0-indexed
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const EVENT_CONFIG: Record<
  CivicEventType,
  {
    icon: typeof Mic
    dot: string
    pill: string
    pillText: string
    label: string
  }
> = {
  debate: {
    icon: Mic,
    dot: 'bg-purple',
    pill: 'bg-purple/10 border-purple/30 text-purple',
    pillText: 'text-purple',
    label: 'Debate',
  },
  vote_end: {
    icon: Vote,
    dot: 'bg-gold',
    pill: 'bg-gold/10 border-gold/30 text-gold',
    pillText: 'text-gold',
    label: 'Vote Closes',
  },
  law: {
    icon: Gavel,
    dot: 'bg-emerald',
    pill: 'bg-emerald/10 border-emerald/30 text-emerald',
    pillText: 'text-emerald',
    label: 'Law Established',
  },
  vote_start: {
    icon: Clock,
    dot: 'bg-for-500',
    pill: 'bg-for-500/10 border-for-500/30 text-for-400',
    pillText: 'text-for-400',
    label: 'Voting Begins',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
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

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface GridCell {
  dateKey: string | null
  day: number | null
  events: CivicEvent[]
}

function buildGrid(
  year: number,
  month: number,
  byDay: Map<string, CivicEvent[]>
): GridCell[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: GridCell[] = []

  for (let i = 0; i < firstDay; i++) {
    cells.push({ dateKey: null, day: null, events: [] })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const y = year
    const m = String(month + 1).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    const key = `${y}-${m}-${day}`
    cells.push({ dateKey: key, day: d, events: byDay.get(key) ?? [] })
  }

  const trailing = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trailing; i++) {
    cells.push({ dateKey: null, day: null, events: [] })
  }

  return cells
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-6">
      {(Object.entries(EVENT_CONFIG) as [CivicEventType, (typeof EVENT_CONFIG)[CivicEventType]][]).map(
        ([type, cfg]) => {
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
              <span className="text-[11px] font-mono text-surface-500">{cfg.label}</span>
            </div>
          )
        }
      )}
    </div>
  )
}

// ─── Event pill in day cell ────────────────────────────────────────────────────

function EventPill({ event }: { event: CivicEvent }) {
  const cfg = EVENT_CONFIG[event.type]
  return (
    <Link
      href={event.href}
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium',
        'border truncate max-w-full hover:opacity-80 transition-opacity',
        cfg.pill
      )}
      title={event.title}
    >
      <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      <span className="truncate">{event.title}</span>
    </Link>
  )
}

// ─── Day event list panel (shown when a day is clicked) ────────────────────────

interface DayPanelProps {
  dateKey: string
  events: CivicEvent[]
  onClose: () => void
}

function DayPanel({ dateKey, events, onClose }: DayPanelProps) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono font-semibold text-white">{label}</h3>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.type]
          const Icon = cfg.icon
          return (
            <Link
              key={ev.id}
              href={ev.href}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors group"
            >
              <div className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 mt-0.5',
                cfg.pill.replace('text-', 'border-').replace('/10', '/20'),
                'bg-surface-300'
              )}>
                <Icon className={cn('h-4 w-4', cfg.pillText)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', cfg.pillText)}>
                    {cfg.label}
                  </span>
                  {ev.category && (
                    <span className={cn('text-[10px] font-mono', CATEGORY_COLORS[ev.category] ?? 'text-surface-500')}>
                      {ev.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white font-medium leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
                  {ev.title}
                </p>
                <p className="text-[11px] text-surface-500 mt-1 font-mono">
                  {ev.type === 'law'
                    ? `Established ${formatTime(ev.at)}`
                    : ev.type === 'vote_end'
                    ? `Voting closes ${formatTime(ev.at)}`
                    : ev.type === 'vote_start'
                    ? `Voting opens ${formatTime(ev.at)}`
                    : `Debate at ${formatTime(ev.at)}`}
                  {ev.debateType ? ` · ${ev.debateType}` : ''}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main calendar component ──────────────────────────────────────────────────

export function CivicCalendar({ events, initialYear, initialMonth }: Props) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const today = todayKey()

  // Index events by local date key
  const byDay = useMemo(() => {
    const map = new Map<string, CivicEvent[]>()
    for (const ev of events) {
      const key = localDateKey(ev.at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [events])

  const grid = useMemo(() => buildGrid(year, month, byDay), [year, month, byDay])

  function prevMonth() {
    setSelectedDay(null)
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    setSelectedDay(null)
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToday() {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDay(null)
  }

  const selectedEvents = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  // Count events in current month view
  const monthEventCount = useMemo(() => {
    let count = 0
    for (const cell of grid) {
      if (cell.dateKey) count += cell.events.length
    }
    return count
  }, [grid])

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 text-center">
          <span className="text-base font-mono font-bold text-white">
            {MONTH_NAMES[month]} {year}
          </span>
          {monthEventCount > 0 && (
            <span className="ml-2 text-[11px] font-mono text-surface-500">
              {monthEventCount} event{monthEventCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={goToday}
          className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors"
        >
          Today
        </button>
      </div>

      <Legend />

      {/* Selected day panel */}
      <AnimatePresence>
        {selectedDay && selectedEvents.length > 0 && (
          <DayPanel
            key={selectedDay}
            dateKey={selectedDay}
            events={selectedEvents}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-mono text-surface-500 uppercase tracking-wider py-2"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-surface-300 rounded-xl overflow-hidden border border-surface-300">
        {grid.map((cell, i) => {
          const isToday = cell.dateKey === today
          const isSelected = cell.dateKey === selectedDay
          const hasEvents = cell.events.length > 0

          return (
            <div
              key={i}
              onClick={() => {
                if (!cell.dateKey || !hasEvents) return
                setSelectedDay(isSelected ? null : cell.dateKey)
              }}
              className={cn(
                'bg-surface-100 min-h-[80px] sm:min-h-[100px] p-1.5 transition-colors',
                cell.dateKey && hasEvents ? 'cursor-pointer hover:bg-surface-200' : '',
                isSelected && 'bg-surface-200',
                !cell.day && 'bg-surface-50/50'
              )}
            >
              {cell.day != null && (
                <>
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-xs font-mono font-semibold h-5 w-5 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-for-600 text-white'
                          : 'text-surface-500'
                      )}
                    >
                      {cell.day}
                    </span>
                    {cell.events.length > 2 && (
                      <span className="text-[10px] font-mono text-surface-600">
                        +{cell.events.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Event dots (mobile) + pills (desktop) */}
                  <div className="hidden sm:flex flex-col gap-0.5">
                    {cell.events.slice(0, 2).map((ev) => (
                      <EventPill key={ev.id} event={ev} />
                    ))}
                  </div>

                  {/* Dots only on mobile */}
                  <div className="flex sm:hidden flex-wrap gap-0.5 mt-1">
                    {cell.events.slice(0, 4).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn('h-1.5 w-1.5 rounded-full', EVENT_CONFIG[ev.type].dot)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {monthEventCount === 0 && (
        <div className="mt-8 text-center py-12">
          <Calendar className="h-10 w-10 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-500 text-sm font-mono">No civic events this month.</p>
          <button
            onClick={nextMonth}
            className="mt-3 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Check next month →
          </button>
        </div>
      )}
    </div>
  )
}
