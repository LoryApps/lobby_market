'use client'

/**
 * LawTimeline
 *
 * A chronological timeline of all established Laws, grouped by month.
 * Features:
 *   - Category filter pills
 *   - Live search (client-side)
 *   - Animated entrance for each law entry
 *   - Stats strip (total laws, span, busiest month)
 *   - Color-coded category dots on the timeline spine
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Gavel,
  LayoutList,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_DOT: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-for-300',
  Culture:     'bg-gold',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}

const CATEGORY_BADGE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
}

const DEFAULT_BADGE = { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-400' }
const DEFAULT_DOT   = 'bg-surface-400'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ laws }: { laws: Law[] }) {
  const totalVotes = laws.reduce((s, l) => s + (l.total_votes ?? 0), 0)

  const categoryCounts = laws.reduce<Record<string, number>>((acc, l) => {
    const c = l.category ?? 'Other'
    acc[c] = (acc[c] ?? 0) + 1
    return acc
  }, {})
  const topCat = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]

  const firstLaw = laws.length > 0 ? laws[laws.length - 1] : null
  const firstYear = firstLaw ? new Date(firstLaw.established_at).getFullYear() : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        {
          label: 'Laws Established',
          value: laws.length.toLocaleString(),
          icon: Gavel,
          color: 'text-emerald',
          bg: 'bg-emerald/10',
          border: 'border-emerald/30',
        },
        {
          label: 'Total Votes',
          value: totalVotes >= 1000
            ? `${(totalVotes / 1000).toFixed(1)}k`
            : totalVotes.toLocaleString(),
          icon: Users,
          color: 'text-for-400',
          bg: 'bg-for-500/10',
          border: 'border-for-500/30',
        },
        {
          label: 'Top Category',
          value: topCat ? topCat[0] : '—',
          icon: LayoutList,
          color: 'text-gold',
          bg: 'bg-gold/10',
          border: 'border-gold/30',
        },
        {
          label: 'Since',
          value: firstYear ? String(firstYear) : '—',
          icon: Calendar,
          color: 'text-purple',
          bg: 'bg-purple/10',
          border: 'border-purple/30',
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className={cn(
            'rounded-2xl border p-4 flex items-center gap-3',
            'bg-surface-100',
            stat.border
          )}
        >
          <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl', stat.bg)}>
            <stat.icon className={cn('h-4 w-4', stat.color)} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={cn('text-base font-bold font-mono', stat.color)}>{stat.value}</p>
            <p className="text-[11px] text-surface-500 truncate">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single law entry ─────────────────────────────────────────────────────────

function LawEntry({ law, index }: { law: Law; index: number }) {
  const badge = CATEGORY_BADGE[law.category ?? ''] ?? DEFAULT_BADGE
  const dot   = CATEGORY_DOT[law.category ?? ''] ?? DEFAULT_DOT
  const forPct = Math.round(law.blue_pct ?? 0)
  const winPct  = forPct >= 50 ? forPct : 100 - forPct
  const sideColor = forPct >= 50 ? 'text-for-400' : 'text-against-400'
  const sideLabel = forPct >= 50 ? 'FOR' : 'AGAINST'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.6) }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {/* Timeline spine */}
      <div className="relative flex flex-col items-center flex-shrink-0" style={{ width: 20 }}>
        {/* Dot */}
        <div
          className={cn('h-3 w-3 rounded-full ring-2 ring-surface-200 mt-1 flex-shrink-0', dot)}
          aria-hidden="true"
        />
        {/* Vertical line below dot */}
        <div className="flex-1 w-px bg-surface-300 mt-1.5" aria-hidden="true" />
      </div>

      {/* Card */}
      <Link
        href={`/law/${law.id}`}
        className={cn(
          'group flex-1 rounded-xl border bg-surface-100 p-4 mb-px',
          'border-surface-300 hover:border-emerald/40 hover:bg-emerald/[0.02]',
          'transition-all duration-150'
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-mono text-sm font-semibold text-white leading-snug group-hover:text-emerald transition-colors line-clamp-2">
            {law.statement}
          </p>
          {/* Consensus badge */}
          <span
            className={cn(
              'flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold',
              'bg-surface-200 border border-surface-300',
              sideColor
            )}
          >
            {sideLabel} {winPct}%
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {law.category && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
                badge.text, badge.bg, badge.border
              )}
            >
              {law.category}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" aria-hidden="true" />
            {(law.total_votes ?? 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {shortDate(law.established_at)}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Month group ──────────────────────────────────────────────────────────────

function MonthGroup({ month, laws }: { month: string; laws: Law[] }) {
  return (
    <div className="mb-10">
      {/* Month header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300">
            <Calendar className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
          </div>
          <h2 className="font-mono text-sm font-bold text-surface-500 uppercase tracking-widest">
            {month}
          </h2>
        </div>
        <div className="flex-1 h-px bg-surface-300" aria-hidden="true" />
        <span className="font-mono text-xs text-surface-600">
          {laws.length} law{laws.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Entries */}
      <div className="pl-2">
        {laws.map((law, i) => (
          <LawEntry key={law.id} law={law} index={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LawTimelineProps {
  laws: Law[]
}

export function LawTimeline({ laws }: LawTimelineProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Collect categories with counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const law of laws) {
      const c = law.category ?? 'Other'
      counts[c] = (counts[c] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [laws])

  // Filter + search
  const filtered = useMemo(() => {
    let result = laws

    if (selectedCategory) {
      result = result.filter((l) => (l.category ?? 'Other') === selectedCategory)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (l) =>
          l.statement.toLowerCase().includes(q) ||
          (l.full_statement ?? '').toLowerCase().includes(q) ||
          (l.category ?? '').toLowerCase().includes(q)
      )
    }

    return result
  }, [laws, selectedCategory, search])

  // Group by month (newest first — laws are already sorted newest-first)
  const grouped = useMemo(() => {
    const groups: { month: string; laws: Law[] }[] = []
    const map = new Map<string, Law[]>()

    for (const law of filtered) {
      const key = monthLabel(law.established_at)
      const existing = map.get(key)
      if (existing) {
        existing.push(law)
      } else {
        map.set(key, [law])
        groups.push({ month: key, laws: map.get(key)! })
      }
    }

    return groups
  }, [filtered])

  const hasResults = grouped.length > 0

  return (
    <div>
      {/* Stats */}
      <StatsStrip laws={laws} />

      {/* Search + category filters */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search laws…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search laws"
            className={cn(
              'w-full h-10 pl-9 pr-9 rounded-xl bg-surface-200 border border-surface-300',
              'text-sm text-white placeholder-surface-500',
              'focus:outline-none focus:border-emerald/50 focus:ring-2 focus:ring-emerald/20',
              'transition-colors'
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div
          className="flex gap-2 flex-wrap"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors',
              selectedCategory === null
                ? 'bg-emerald/20 text-emerald border-emerald/50'
                : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700'
            )}
          >
            All ({laws.length})
          </button>
          {categories.map(({ name, count }) => {
            const badge = CATEGORY_BADGE[name] ?? DEFAULT_BADGE
            const active = selectedCategory === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedCategory(active ? null : name)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors',
                  active
                    ? cn(badge.bg, badge.text, badge.border)
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700'
                )}
              >
                {name} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Results count when filtering */}
      {(search || selectedCategory) && (
        <p className="text-xs font-mono text-surface-500 mb-4">
          {filtered.length} {filtered.length === 1 ? 'law' : 'laws'} found
          {search && ` matching "${search}"`}
          {selectedCategory && ` in ${selectedCategory}`}
        </p>
      )}

      {/* Timeline */}
      <AnimatePresence mode="wait">
        {hasResults ? (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {grouped.map(({ month, laws: monthLaws }) => (
              <MonthGroup key={month} month={month} laws={monthLaws} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald/10 border border-emerald/30 mb-5">
              <TrendingUp className="h-7 w-7 text-emerald" aria-hidden="true" />
            </div>
            <h2 className="font-mono text-lg font-bold text-white mb-2">
              No laws found
            </h2>
            <p className="text-sm text-surface-500 max-w-xs leading-relaxed mb-5">
              {search
                ? `No laws match "${search}". Try a different term.`
                : `No laws in the ${selectedCategory ?? ''} category yet.`}
            </p>
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory(null) }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
