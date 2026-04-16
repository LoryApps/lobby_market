'use client'

/**
 * VoteCalendar
 *
 * GitHub-style 52-week contribution heatmap for voting activity.
 * Shows the last full year of votes as a colour-intensity grid with
 * month labels, day-of-week labels, and hover tooltips.
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DayData {
  date: string // YYYY-MM-DD
  count: number
}

interface VoteCalendarProps {
  days: DayData[]
  className?: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Only show labels for Mon / Wed / Fri to avoid crowding
const SHOWN_DAYS = new Set([1, 3, 5])

const CELL_SIZE = 11 // px
const GAP = 2 // px
const CELL_STEP = CELL_SIZE + GAP

// ─── Helpers ───────────────────────────────────────────────────────────────────

function intensityClass(count: number): string {
  if (count === 0) return 'bg-surface-300'
  if (count === 1) return 'bg-for-900'
  if (count <= 3) return 'bg-for-700'
  if (count <= 6) return 'bg-for-500'
  return 'bg-for-300'
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function VoteCalendar({ days, className }: VoteCalendarProps) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  const { grid, monthPositions, totalVotes, activeDays } = useMemo(() => {
    // Build lookup: date string → vote count
    const dayMap = new Map<string, number>()
    for (const d of days) {
      dayMap.set(d.date, d.count)
    }

    // Determine grid bounds:
    // - End at this coming Saturday (or today if today is Saturday)
    // - Start 52 weeks (364 days) before that Sunday
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)

    // Find the Saturday that ends the current week
    const daysUntilSat = (6 - today.getDay() + 7) % 7
    const gridEnd = new Date(today)
    gridEnd.setDate(gridEnd.getDate() + daysUntilSat)

    // Grid starts 364 days before gridEnd (Sunday of 52 weeks ago)
    const gridStart = new Date(gridEnd)
    gridStart.setDate(gridStart.getDate() - 363)

    // Build 52 columns × 7 rows
    const WEEKS = 52
    const columns: Array<Array<{
      date: string
      count: number
      isToday: boolean
      isFuture: boolean
      dayOfWeek: number
    }>> = []

    let totalVotes = 0
    let activeDays = 0

    for (let w = 0; w < WEEKS; w++) {
      const col: typeof columns[number] = []
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(gridStart)
        d.setDate(d.getDate() + w * 7 + dow)
        const dateStr = d.toISOString().slice(0, 10)
        const count = dayMap.get(dateStr) ?? 0
        const isFuture = d > today
        if (!isFuture && count > 0) {
          totalVotes += count
          activeDays++
        }
        col.push({
          date: dateStr,
          count: isFuture ? 0 : count,
          isToday: dateStr === todayStr,
          isFuture,
          dayOfWeek: dow,
        })
      }
      columns.push(col)
    }

    // Calculate month label positions (which column each month first appears in)
    const monthPositions: Array<{ label: string; weekIndex: number }> = []
    let lastMonth = -1
    for (let w = 0; w < WEEKS; w++) {
      const firstDay = columns[w][0]
      const d = new Date(firstDay.date)
      const month = d.getMonth()
      if (month !== lastMonth) {
        // Avoid crowding at the very start of the grid
        if (w > 0) {
          monthPositions.push({ label: MONTH_LABELS[month], weekIndex: w })
        }
        lastMonth = month
      }
    }

    return { grid: columns, monthPositions, totalVotes, activeDays }
  }, [days])

  // Stats row
  const maxStreak = useMemo(() => {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
    let best = 0
    let current = 0
    let prev: Date | null = null
    for (const d of sorted) {
      if (d.count === 0) {
        current = 0
        prev = null
        continue
      }
      const thisDate = new Date(d.date)
      if (prev) {
        const diff = (thisDate.getTime() - prev.getTime()) / 86400000
        if (diff === 1) {
          current++
        } else {
          current = 1
        }
      } else {
        current = 1
      }
      if (current > best) best = current
      prev = thisDate
    }
    return best
  }, [days])

  const gridWidth = 52 * CELL_STEP

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
          <Flame className="h-3.5 w-3.5 text-for-400" />
          Voting Calendar
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
          <span>
            <span className="text-white font-semibold">{totalVotes.toLocaleString()}</span> votes
          </span>
          <span>
            <span className="text-white font-semibold">{activeDays}</span> active days
          </span>
          {maxStreak > 1 && (
            <span>
              <span className="text-for-400 font-semibold">{maxStreak}</span> day streak
            </span>
          )}
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div style={{ minWidth: `${gridWidth + 32}px` }}>
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: 32 }}>
            {monthPositions.map(({ label, weekIndex }) => (
              <div
                key={`${label}-${weekIndex}`}
                className="absolute text-[10px] font-mono text-surface-500"
                style={{ left: 32 + weekIndex * CELL_STEP }}
              >
                {label}
              </div>
            ))}
            {/* Invisible placeholder to hold height */}
            <div className="h-4" />
          </div>

          {/* Grid + day labels */}
          <div className="flex gap-0" style={{ position: 'relative' }}>
            {/* Day-of-week labels */}
            <div
              className="flex flex-col shrink-0"
              style={{ width: 28, gap: GAP, marginRight: GAP }}
            >
              {DAY_ABBREVS.map((label, i) => (
                <div
                  key={i}
                  style={{ height: CELL_SIZE }}
                  className="flex items-center text-[9px] font-mono text-surface-600 leading-none"
                >
                  {SHOWN_DAYS.has(i) ? label : ''}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex" style={{ gap: GAP }}>
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map((cell) => (
                    <div
                      key={cell.date}
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                      className={cn(
                        'rounded-[2px] transition-colors cursor-default',
                        cell.isFuture
                          ? 'bg-surface-200/40'
                          : intensityClass(cell.count),
                        cell.isToday && 'ring-1 ring-white/60 ring-offset-0'
                      )}
                      onMouseEnter={(e) => {
                        if (cell.isFuture) return
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({
                          date: cell.date,
                          count: cell.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 6,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3" style={{ paddingLeft: 32 }}>
            <span className="text-[10px] font-mono text-surface-600">Less</span>
            {(['bg-surface-300', 'bg-for-900', 'bg-for-700', 'bg-for-500', 'bg-for-300'] as const).map((cls, i) => (
              <div
                key={i}
                className={cn('rounded-[2px]', cls)}
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
              />
            ))}
            <span className="text-[10px] font-mono text-surface-600">More</span>
          </div>
        </div>
      </div>

      {/* Tooltip (portal-less, fixed) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded-lg bg-surface-0 border border-surface-300 shadow-xl text-[11px] font-mono text-white whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <span className="text-surface-400">{formatDate(tooltip.date)}</span>
          {' — '}
          {tooltip.count === 0 ? (
            <span className="text-surface-500">no votes</span>
          ) : (
            <span className="text-for-300 font-semibold">
              {tooltip.count} vote{tooltip.count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}
