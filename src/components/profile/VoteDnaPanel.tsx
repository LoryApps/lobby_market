'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

// ─── Category color map (matches platform convention) ─────────────────────────

const CATEGORY_COLORS: Record<string, { bar: string; text: string }> = {
  Economics:   { bar: 'bg-gold',         text: 'text-gold' },
  Politics:    { bar: 'bg-for-500',      text: 'text-for-400' },
  Technology:  { bar: 'bg-purple',       text: 'text-purple' },
  Science:     { bar: 'bg-emerald',      text: 'text-emerald' },
  Ethics:      { bar: 'bg-against-500',  text: 'text-against-400' },
  Philosophy:  { bar: 'bg-indigo-400',   text: 'text-indigo-400' },
  Culture:     { bar: 'bg-orange-400',   text: 'text-orange-400' },
  Health:      { bar: 'bg-pink-400',     text: 'text-pink-400' },
  Environment: { bar: 'bg-green-400',    text: 'text-green-400' },
  Education:   { bar: 'bg-cyan-400',     text: 'text-cyan-400' },
  Other:       { bar: 'bg-surface-500',  text: 'text-surface-500' },
}

function categoryColor(cat: string): { bar: string; text: string } {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other
}

export interface VoteCategoryBreakdown {
  category: string
  total: number
  blue: number
  red: number
}

interface VoteDnaPanelProps {
  bluePct: number
  redPct: number
  totalVotes: number
  categoryBreakdown: VoteCategoryBreakdown[]
  className?: string
}

// ─── FOR/AGAINST split bar ─────────────────────────────────────────────────────

function StanceSplitBar({
  bluePct,
  redPct,
  totalVotes,
}: {
  bluePct: number
  redPct: number
  totalVotes: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
        <span className="text-for-400 font-semibold">{bluePct}% FOR</span>
        <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
        <span className="text-against-400 font-semibold">{redPct}% AGAINST</span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden bg-surface-300 flex">
        <motion.div
          className="h-full bg-gradient-to-r from-for-700 to-for-400 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-against-500 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${redPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-surface-600">
        <span>
          {bluePct >= redPct ? 'Leans FOR' : 'Leans AGAINST'}
        </span>
        <span>
          {Math.abs(bluePct - redPct)}pp margin
        </span>
      </div>
    </div>
  )
}

// ─── Category bar chart ────────────────────────────────────────────────────────

function CategoryBreakdown({
  breakdown,
}: {
  breakdown: VoteCategoryBreakdown[]
}) {
  if (breakdown.length === 0) return null

  const max = Math.max(...breakdown.map((b) => b.total))

  return (
    <div className="space-y-2">
      {breakdown.map((b, i) => {
        const barWidth = max > 0 ? (b.total / max) * 100 : 0
        const { bar, text } = categoryColor(b.category)
        const bPct = b.total > 0 ? Math.round((b.blue / b.total) * 100) : 50

        return (
          <motion.div
            key={b.category}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex items-center gap-2.5"
          >
            {/* Category label */}
            <span
              className={cn(
                'text-[10px] font-mono font-medium shrink-0 w-20 truncate',
                text
              )}
            >
              {b.category}
            </span>

            {/* Bar track */}
            <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', bar)}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 + 0.2 }}
              />
            </div>

            {/* Stats */}
            <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
              <span className="text-surface-500 w-6 text-right">{b.total}</span>
              <span className="text-for-400 w-7 text-right">{bPct}%↑</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoteDnaPanel({
  bluePct,
  redPct,
  totalVotes,
  categoryBreakdown,
  className,
}: VoteDnaPanelProps) {
  if (totalVotes === 0) return null

  const topCategories = categoryBreakdown
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-5',
        className
      )}
    >
      <h3 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
        Vote DNA
      </h3>

      {/* FOR/AGAINST split */}
      <StanceSplitBar
        bluePct={bluePct}
        redPct={redPct}
        totalVotes={totalVotes}
      />

      {/* Category breakdown */}
      {topCategories.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-2">
            By Category
          </p>
          <CategoryBreakdown breakdown={topCategories} />
        </div>
      )}
    </div>
  )
}
