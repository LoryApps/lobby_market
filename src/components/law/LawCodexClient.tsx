'use client'

/**
 * LawCodexClient
 *
 * Interactive Law Codex browser with:
 *   - Platform stats strip (total laws, total votes, categories)
 *   - Category filter tabs with per-category counts
 *   - Sort options: newest, oldest, most votes, highest consensus
 *   - Live client-side search
 *   - Animated grid results
 */

import { useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownAZ,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gavel,
  LayoutGrid,
  Search,
  SortAsc,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ─── Category icon + color config ────────────────────────────────────────────

const CATEGORY_STYLE: Record<
  string,
  { color: string; activeColor: string; activeBg: string; activeBorder: string }
> = {
  Economics:   { color: 'text-gold',        activeColor: 'text-gold',       activeBg: 'bg-gold/10',        activeBorder: 'border-gold/50'      },
  Politics:    { color: 'text-for-400',     activeColor: 'text-for-300',    activeBg: 'bg-for-500/10',     activeBorder: 'border-for-500/50'   },
  Technology:  { color: 'text-purple',      activeColor: 'text-purple',     activeBg: 'bg-purple/10',      activeBorder: 'border-purple/50'    },
  Science:     { color: 'text-emerald',     activeColor: 'text-emerald',    activeBg: 'bg-emerald/10',     activeBorder: 'border-emerald/50'   },
  Ethics:      { color: 'text-against-400', activeColor: 'text-against-300',activeBg: 'bg-against-500/10', activeBorder: 'border-against-500/50'},
  Philosophy:  { color: 'text-for-300',     activeColor: 'text-for-200',    activeBg: 'bg-for-500/10',     activeBorder: 'border-for-500/50'   },
  Culture:     { color: 'text-gold',        activeColor: 'text-gold',       activeBg: 'bg-gold/10',        activeBorder: 'border-gold/50'      },
  Health:      { color: 'text-emerald',     activeColor: 'text-emerald',    activeBg: 'bg-emerald/10',     activeBorder: 'border-emerald/50'   },
  Environment: { color: 'text-emerald',     activeColor: 'text-emerald',    activeBg: 'bg-emerald/10',     activeBorder: 'border-emerald/50'   },
  Education:   { color: 'text-for-400',     activeColor: 'text-for-300',    activeBg: 'bg-for-500/10',     activeBorder: 'border-for-500/50'   },
}

function getCategoryStyle(cat: string) {
  return (
    CATEGORY_STYLE[cat] ?? {
      color: 'text-surface-500',
      activeColor: 'text-white',
      activeBg: 'bg-surface-300',
      activeBorder: 'border-surface-400',
    }
  )
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortOption = 'newest' | 'oldest' | 'most_votes' | 'consensus'

const SORT_OPTIONS: { id: SortOption; label: string; icon: typeof TrendingUp }[] = [
  { id: 'newest',      label: 'Newest',     icon: Calendar   },
  { id: 'oldest',      label: 'Oldest',     icon: ArrowDownAZ},
  { id: 'most_votes',  label: 'Most votes', icon: Users      },
  { id: 'consensus',   label: 'Consensus',  icon: TrendingUp },
]

function sortLaws(laws: Law[], sort: SortOption): Law[] {
  const copy = [...laws]
  switch (sort) {
    case 'newest':
      return copy.sort(
        (a, b) =>
          new Date(b.established_at).getTime() -
          new Date(a.established_at).getTime()
      )
    case 'oldest':
      return copy.sort(
        (a, b) =>
          new Date(a.established_at).getTime() -
          new Date(b.established_at).getTime()
      )
    case 'most_votes':
      return copy.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
    case 'consensus':
      return copy.sort((a, b) => {
        const aCon = Math.abs((a.blue_pct ?? 50) - 50)
        const bCon = Math.abs((b.blue_pct ?? 50) - 50)
        return bCon - aCon
      })
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100">
      <span className={cn('font-mono text-lg font-bold leading-none', color)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Individual law card ──────────────────────────────────────────────────────

function LawItem({ law }: { law: Law }) {
  const bluePct = Math.round(law.blue_pct ?? 0)
  const winPct = bluePct >= 50 ? bluePct : 100 - bluePct
  const sideColor = bluePct >= 50 ? 'text-for-400' : 'text-against-400'
  const barColor = bluePct >= 50 ? 'bg-for-500' : 'bg-against-500'
  const sideLabel = bluePct >= 50 ? 'FOR' : 'AGAINST'

  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'group block bg-surface-100 border border-surface-300 rounded-xl p-5',
        'hover:border-emerald/50 hover:bg-emerald/[0.03]',
        'transition-all duration-200 flex flex-col gap-3'
      )}
    >
      {/* Category tag */}
      {law.category && (
        <span className="text-[10px] font-mono font-medium text-surface-500 uppercase tracking-wider">
          {law.category}
        </span>
      )}

      {/* Statement + side badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-base font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
          {law.statement}
        </h3>
        <div
          className={cn(
            'flex-shrink-0 px-2 py-0.5 rounded font-mono text-[10px] font-bold',
            'bg-surface-200 border border-surface-300',
            sideColor
          )}
        >
          {sideLabel} {winPct}%
        </div>
      </div>

      {/* Consensus bar */}
      <div className="h-1 w-full rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${bluePct}%` }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-300/60">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
          <Users className="h-3 w-3" />
          <span>{(law.total_votes ?? 0).toLocaleString()} votes</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
          <Calendar className="h-3 w-3" />
          <span>
            {new Date(law.established_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LawCodexClientProps {
  laws: Law[]
  totalVotes: number
}

export function LawCodexClient({ laws, totalVotes }: LawCodexClientProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('newest')
  const [search, setSearch] = useState('')
  const [sortOpen, setSortOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  // Derive categories with counts
  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const law of laws) {
      const cat = law.category ?? 'Uncategorized'
      map.set(cat, (map.get(cat) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === 'Uncategorized') return 1
        if (b[0] === 'Uncategorized') return -1
        return b[1] - a[1] // sort by count desc
      })
  }, [laws])

  // Filtered + sorted laws
  const visibleLaws = useMemo(() => {
    let result = laws

    if (activeCategory) {
      result = result.filter(
        (l) => (l.category ?? 'Uncategorized') === activeCategory
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.statement.toLowerCase().includes(q) ||
          (l.full_statement ?? '').toLowerCase().includes(q) ||
          (l.category ?? '').toLowerCase().includes(q)
      )
    }

    return sortLaws(result, sort)
  }, [laws, activeCategory, search, sort])

  // Scroll tabs
  function scrollTabs(dir: 'left' | 'right') {
    const el = tabsRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' })
  }

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.id === sort)?.label ?? 'Sort'

  return (
    <div className="space-y-6">
      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="Laws" value={laws.length} color="text-emerald" />
        <StatPill
          label="Total votes"
          value={totalVotes}
          color="text-for-400"
        />
        <StatPill
          label="Categories"
          value={categories.filter(([c]) => c !== 'Uncategorized').length}
          color="text-gold"
        />
      </div>

      {/* ── Search + Sort row ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the Codex…"
            className={cn(
              'w-full pl-9 pr-9 py-2.5 rounded-xl',
              'bg-surface-200 border border-surface-300',
              'text-sm font-mono text-white placeholder-surface-500',
              'focus:outline-none focus:border-emerald/50 focus:ring-1 focus:ring-emerald/30',
              'transition-colors'
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-xl',
              'bg-surface-200 border border-surface-300',
              'text-sm font-mono text-surface-600 hover:text-white',
              'hover:border-surface-400 transition-colors',
              sortOpen && 'border-surface-400 text-white'
            )}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
          >
            <SortAsc className="h-4 w-4" />
            <span className="hidden sm:inline">{activeSortLabel}</span>
          </button>

          <AnimatePresence>
            {sortOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSortOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'absolute right-0 top-full mt-1 z-20 min-w-[160px]',
                    'rounded-xl border border-surface-300 bg-surface-200 shadow-xl overflow-hidden'
                  )}
                  role="listbox"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.id}
                        role="option"
                        aria-selected={sort === opt.id}
                        onClick={() => {
                          setSort(opt.id)
                          setSortOpen(false)
                        }}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-4 py-2.5',
                          'text-sm font-mono text-left transition-colors',
                          sort === opt.id
                            ? 'text-emerald bg-emerald/10'
                            : 'text-surface-600 hover:text-white hover:bg-surface-300'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {opt.label}
                      </button>
                    )
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Left scroll button */}
        <button
          onClick={() => scrollTabs('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-7 w-7 rounded-full bg-surface-200 border border-surface-300 text-surface-500 hover:text-white shadow-lg md:hidden"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-8 md:px-0 md:flex-wrap"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* All tab */}
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
              'text-xs font-mono font-medium border transition-all duration-150',
              activeCategory === null
                ? 'bg-emerald/10 border-emerald/50 text-emerald'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <LayoutGrid className="h-3 w-3" />
            All
            <span
              className={cn(
                'ml-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold',
                activeCategory === null
                  ? 'bg-emerald/20 text-emerald'
                  : 'bg-surface-300 text-surface-500'
              )}
            >
              {laws.length}
            </span>
          </button>

          {categories.map(([cat, count]) => {
            const style = getCategoryStyle(cat)
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                  'text-xs font-mono font-medium border transition-all duration-150',
                  isActive
                    ? cn(style.activeBg, style.activeBorder, style.activeColor)
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {cat}
                <span
                  className={cn(
                    'ml-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold',
                    isActive ? 'bg-white/10 text-current' : 'bg-surface-300 text-surface-500'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right scroll button */}
        <button
          onClick={() => scrollTabs('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-7 w-7 rounded-full bg-surface-200 border border-surface-300 text-surface-500 hover:text-white shadow-lg md:hidden"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Results header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-surface-500">
          {visibleLaws.length === laws.length
            ? `${laws.length} law${laws.length === 1 ? '' : 's'}`
            : `${visibleLaws.length} of ${laws.length} laws`}
          {activeCategory ? ` · ${activeCategory}` : ''}
          {search ? ` · "${search}"` : ''}
        </p>
        {(activeCategory || search) && (
          <button
            onClick={() => {
              setActiveCategory(null)
              setSearch('')
            }}
            className="text-xs font-mono text-surface-500 hover:text-white underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Law grid ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {visibleLaws.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald/10 border border-emerald/30 mx-auto mb-5">
              <Gavel className="h-7 w-7 text-emerald" />
            </div>
            <h2 className="font-mono text-lg font-bold text-white mb-2">
              No laws found
            </h2>
            <p className="text-sm font-mono text-surface-500 max-w-sm">
              {search
                ? `No laws match "${search}". Try a different term or clear filters.`
                : activeCategory
                ? `No laws in the ${activeCategory} category yet.`
                : 'No laws have been established yet.'}
            </p>
            {(search || activeCategory) && (
              <button
                onClick={() => {
                  setSearch('')
                  setActiveCategory(null)
                }}
                className="mt-5 text-sm font-mono text-emerald hover:underline"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`${activeCategory ?? 'all'}-${sort}-${search}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {visibleLaws.map((law) => (
              <LawItem key={law.id} law={law} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
