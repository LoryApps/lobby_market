'use client'

/**
 * /civic-index — Civic Topic Index
 *
 * A–Z encyclopedic reference listing of every debate topic on the platform.
 * Distinct from /search (query-based), /topics (sortable table, paginated),
 * and /categories (domain-level browse).
 *
 * Designed for "I heard about a topic, let me find it" use-cases and for
 * power-users who want a full-picture reference view.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Gavel,
  Hash,
  Layers,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { LetterGroup, IndexTopic } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STATUS_CONFIG: Record<string, {
  label: string
  dot: string
  text: string
  bg: string
  border: string
}> = {
  proposed: {
    label: 'Proposed',
    dot: 'bg-surface-400',
    text: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  },
  active: {
    label: 'Active',
    dot: 'bg-for-400',
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  voting: {
    label: 'Voting',
    dot: 'bg-purple',
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  law: {
    label: 'Law',
    dot: 'bg-emerald',
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-against-400',
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const CATEGORY_DOT_COLORS: Record<string, string> = {
  Politics: 'bg-for-400',
  Economics: 'bg-gold',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-400',
  Philosophy: 'bg-for-300',
  Culture: 'bg-gold',
  Health: 'bg-against-300',
  Environment: 'bg-emerald',
  Education: 'bg-purple',
}

// ─── Letter navigation ─────────────────────────────────────────────────────────

function LetterNav({
  available,
  onJump,
}: {
  available: Set<string>
  onJump: (letter: string) => void
}) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 flex-wrap',
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
      )}
      aria-label="Jump to letter"
    >
      {letters.map((l) => {
        const has = available.has(l)
        return (
          <button
            key={l}
            onClick={() => has && onJump(l)}
            disabled={!has}
            aria-label={has ? `Jump to ${l}` : `No topics starting with ${l}`}
            className={cn(
              'h-7 w-7 rounded text-[11px] font-mono font-semibold transition-colors',
              has
                ? 'text-surface-500 hover:bg-surface-200 hover:text-white cursor-pointer'
                : 'text-surface-700 cursor-default',
            )}
          >
            {l === '#' ? <Hash className="h-3 w-3 mx-auto" /> : l}
          </button>
        )
      })}
    </div>
  )
}

// ─── Topic row ─────────────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: IndexTopic }) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'
  const catDot = CATEGORY_DOT_COLORS[topic.category ?? ''] ?? 'bg-surface-500'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-center gap-3 py-2.5 px-3 rounded-lg',
        'hover:bg-surface-200 transition-colors',
      )}
    >
      {/* Category dot */}
      <span
        className={cn('h-2 w-2 rounded-full flex-shrink-0', catDot)}
        title={topic.category ?? 'Uncategorized'}
        aria-hidden="true"
      />

      {/* Statement */}
      <span className="flex-1 min-w-0 text-sm text-white group-hover:text-for-300 transition-colors leading-snug line-clamp-1">
        {topic.statement}
      </span>

      {/* Category label — hidden on small screens */}
      {topic.category && (
        <span className={cn('hidden sm:block text-[11px] font-mono flex-shrink-0 w-20 text-right', catColor)}>
          {topic.category}
        </span>
      )}

      {/* Vote bar — hidden on xs */}
      <div className="hidden xs:flex items-center gap-1.5 flex-shrink-0 w-28">
        <span className="text-[10px] font-mono text-for-400 tabular-nums w-7 text-right">
          {forPct}%
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-against-400 tabular-nums w-7">
          {againstPct}%
        </span>
      </div>

      {/* Status pill */}
      <span
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
          cfg.bg, cfg.text, cfg.border,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} aria-hidden="true" />
        {cfg.label}
      </span>

      {/* Total votes */}
      <span className="hidden md:block flex-shrink-0 text-[11px] font-mono text-surface-500 tabular-nums w-16 text-right">
        {topic.total_votes.toLocaleString()}
      </span>
    </Link>
  )
}

// ─── Letter section ────────────────────────────────────────────────────────────

function LetterSection({ letter, topics }: { letter: string; topics: IndexTopic[] }) {
  return (
    <section id={`letter-${letter}`} aria-label={`Topics starting with ${letter}`}>
      {/* Section header */}
      <div className="sticky top-[56px] z-10 flex items-center gap-3 py-2 bg-surface-50">
        <div className={cn(
          'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
          'bg-for-500/10 border border-for-500/20 font-mono font-bold text-for-400 text-sm',
        )}>
          {letter === '#' ? <Hash className="h-4 w-4" /> : letter}
        </div>
        <div className="h-px flex-1 bg-surface-200" aria-hidden="true" />
        <span className="text-[11px] font-mono text-surface-500 flex-shrink-0">
          {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
        </span>
      </div>

      {/* Topic rows */}
      <div className="mt-1 mb-4">
        {topics.map((topic) => (
          <TopicRow key={topic.id} topic={topic} />
        ))}
      </div>
    </section>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

interface TopicIndexClientProps {
  groups: LetterGroup[]
  counts: {
    total: number
    active: number
    voting: number
    law: number
    proposed: number
    failed: number
  }
}

export function TopicIndexClient({ groups, counts }: TopicIndexClientProps) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [catDropdown, setCatDropdown] = useState(false)

  const mainRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Apply filters
  const filteredGroups = useMemo<LetterGroup[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        topics: g.topics.filter((t) => {
          if (statusFilter && t.status !== statusFilter) return false
          if (categoryFilter && t.category !== categoryFilter) return false
          if (q && !t.statement.toLowerCase().includes(q)) return false
          return true
        }),
      }))
      .filter((g) => g.topics.length > 0)
  }, [groups, statusFilter, categoryFilter, searchQuery])

  const totalVisible = useMemo(
    () => filteredGroups.reduce((s, g) => s + g.topics.length, 0),
    [filteredGroups],
  )

  const availableLetters = useMemo(
    () => new Set(filteredGroups.map((g) => g.letter)),
    [filteredGroups],
  )

  const jumpToLetter = useCallback((letter: string) => {
    const el = document.getElementById(`letter-${letter}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const hasFilters = statusFilter !== null || categoryFilter !== null || searchQuery.trim().length > 0

  return (
    <div ref={mainRef}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/topics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Topics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-for-400 flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Topic Index
              </h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {counts.total.toLocaleString()} topics · A–Z encyclopedic reference
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {[
          { label: 'Active', count: counts.active, color: 'text-for-400', icon: Zap },
          { label: 'Voting', count: counts.voting, color: 'text-purple', icon: Scale },
          { label: 'Laws', count: counts.law, color: 'text-emerald', icon: Gavel },
          { label: 'Proposed', count: counts.proposed, color: 'text-surface-400', icon: Layers },
        ].map(({ label, count, color, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(
              statusFilter === label.toLowerCase()
                ? null
                : label.toLowerCase() === 'laws' ? 'law' : label.toLowerCase()
            )}
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors',
              statusFilter === (label.toLowerCase() === 'laws' ? 'law' : label.toLowerCase())
                ? color
                : 'text-surface-500 hover:text-surface-400',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono font-bold tabular-nums">{count.toLocaleString()}</span>
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Controls bar ─────────────────────────────────────────────── */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter topics…"
              className={cn(
                'w-full h-9 pl-9 pr-8 rounded-lg text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors',
              )}
              aria-label="Filter topics by keyword"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: null, label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'voting', label: 'Voting' },
              { id: 'law', label: 'Law' },
              { id: 'proposed', label: 'Proposed' },
              { id: 'failed', label: 'Failed' },
            ].map(({ id, label }) => {
              const isActive = statusFilter === id
              const cfg = id ? STATUS_CONFIG[id] : null
              return (
                <button
                  key={label}
                  onClick={() => setStatusFilter(id)}
                  aria-pressed={isActive}
                  className={cn(
                    'px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                    isActive && cfg
                      ? cn(cfg.bg, cfg.text, cfg.border)
                      : isActive && !cfg
                        ? 'bg-surface-300 text-white border-surface-400'
                        : 'bg-transparent text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-400',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Category dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setCatDropdown(!catDropdown)}
              aria-expanded={catDropdown}
              className={cn(
                'flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                categoryFilter
                  ? 'bg-for-500/10 text-for-400 border-for-500/40'
                  : 'bg-transparent text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-400',
              )}
            >
              {categoryFilter ?? 'Category'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', catDropdown && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {catDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'absolute right-0 top-full mt-1 z-30 w-40',
                    'bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden',
                  )}
                >
                  <button
                    onClick={() => { setCategoryFilter(null); setCatDropdown(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                      categoryFilter === null
                        ? 'bg-surface-300 text-white'
                        : 'text-surface-400 hover:bg-surface-200 hover:text-white',
                    )}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); setCatDropdown(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 transition-colors',
                        categoryFilter === cat
                          ? 'bg-surface-300 text-white'
                          : 'text-surface-400 hover:bg-surface-200 hover:text-white',
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full flex-shrink-0', CATEGORY_DOT_COLORS[cat] ?? 'bg-surface-500')} />
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={() => {
                setStatusFilter(null)
                setCategoryFilter(null)
                setSearchQuery('')
              }}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Active filter summary */}
        {hasFilters && (
          <p className="text-[11px] font-mono text-surface-500" role="status" aria-live="polite">
            Showing {totalVisible.toLocaleString()} of {counts.total.toLocaleString()} topics
            {searchQuery && ` matching "${searchQuery}"`}
            {statusFilter && ` · ${STATUS_CONFIG[statusFilter]?.label ?? statusFilter}`}
            {categoryFilter && ` · ${categoryFilter}`}
          </p>
        )}
      </div>

      {/* ── Letter navigation ─────────────────────────────────────────── */}
      <div className="mb-4 pb-3 border-b border-surface-200">
        <LetterNav available={availableLetters} onJump={jumpToLetter} />
      </div>

      {/* ── Column headers ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 mb-1">
        <span className="w-2 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 text-[10px] font-mono text-surface-600 uppercase tracking-wider">
          Topic
        </span>
        <span className="hidden sm:block text-[10px] font-mono text-surface-600 uppercase tracking-wider w-20 text-right">
          Category
        </span>
        <span className="hidden xs:block text-[10px] font-mono text-surface-600 uppercase tracking-wider w-28 text-center">
          <span className="flex items-center justify-center gap-1">
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            <span>/</span>
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
          </span>
        </span>
        <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider flex-shrink-0 w-16 text-center">
          Status
        </span>
        <span className="hidden md:block text-[10px] font-mono text-surface-600 uppercase tracking-wider w-16 text-right">
          Votes
        </span>
      </div>

      {/* ── Index body ───────────────────────────────────────────────── */}
      {filteredGroups.length === 0 ? (
        <div className="py-20 text-center">
          <BookOpen className="h-10 w-10 text-surface-600 mx-auto mb-3" />
          <p className="font-mono text-white font-semibold mb-1">No topics found</p>
          <p className="text-sm text-surface-500">
            {hasFilters
              ? 'Try adjusting your filters or clearing the search.'
              : 'No topics are available yet.'}
          </p>
          {hasFilters && (
            <button
              onClick={() => { setStatusFilter(null); setCategoryFilter(null); setSearchQuery('') }}
              className="mt-4 text-sm font-mono text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div>
          {filteredGroups.map((group) => (
            <LetterSection key={group.letter} letter={group.letter} topics={group.topics} />
          ))}

          {/* Footer summary */}
          <div className="mt-8 pt-6 border-t border-surface-200 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-mono text-surface-500">
              {totalVisible.toLocaleString()} {totalVisible === 1 ? 'topic' : 'topics'} in index
            </p>
            <div className="flex items-center gap-4">
              <Link href="/topics" className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                Table view
              </Link>
              <Link href="/search" className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                Full search
              </Link>
              <Link href="/categories" className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                By category
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
