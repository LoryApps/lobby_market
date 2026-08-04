'use client'

/**
 * /new-laws — Recently Established Laws
 *
 * A celebration page showing the most recently established civic laws.
 * Distinct from:
 *   /laws          — the full Law Codex (alphabetical, searchable encyclopedia)
 *   /law-watch     — topics currently in the voting phase
 *   /near-law      — topics close to becoming law
 *
 * This page answers: "What has the Lobby just democratically decided?"
 * It's the democratic victory lap — where the community celebrates laws
 * that were just forged from debate and consensus.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Gavel,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RecentLaw, RecentLawsStats, RecentLawsResponse } from '@/app/api/laws/recent/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 90_000

const SORT_OPTIONS: { id: string; label: string; icon: typeof Clock }[] = [
  { id: 'new', label: 'Newest', icon: Clock },
  { id: 'votes', label: 'Most Votes', icon: Users },
  { id: 'consensus', label: 'Highest FOR%', icon: ThumbsUp },
]

const CATEGORIES = [
  'all',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-surface-400', bg: 'bg-surface-300/40', border: 'border-surface-400/40' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

function getCatStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const wk = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${wk}w ago`
  return `${mo}mo ago`
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LawSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-24 rounded-xl" />
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-3 rounded-2xl bg-surface-100 border border-surface-300 min-w-[72px]">
      <span className={cn('text-xl font-bold font-mono', color)}>{value.toLocaleString()}</span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
        {label}
      </span>
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, rank }: { law: RecentLaw; rank: number }) {
  const forPct = Math.round(law.blue_pct ?? 0)
  const againstPct = 100 - forPct
  const cat = getCatStyle(law.category)

  const rankBadge = rank === 1
    ? { bg: 'bg-gold/20', border: 'border-gold/50', text: 'text-gold', icon: Award }
    : rank === 2
    ? { bg: 'bg-surface-300/60', border: 'border-surface-400/60', text: 'text-surface-400', icon: Award }
    : rank === 3
    ? { bg: 'bg-amber-900/30', border: 'border-amber-700/40', text: 'text-amber-500', icon: Award }
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank - 1, 5) * 0.04 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 flex flex-col gap-3 group transition-colors',
        rank <= 3 ? 'border-gold/30 bg-gold/[0.02]' : 'border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Top row: rank + category + time */}
      <div className="flex items-center gap-2 flex-wrap">
        {rankBadge ? (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-semibold',
              rankBadge.bg,
              rankBadge.border,
              rankBadge.text
            )}
          >
            <rankBadge.icon className="h-3 w-3" />
            <span>#{rank}</span>
          </div>
        ) : (
          <span className="text-xs font-mono text-surface-600">#{rank}</span>
        )}

        {law.category && (
          <span
            className={cn(
              'text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border',
              cat.text,
              cat.bg,
              cat.border
            )}
          >
            {law.category}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Gavel className="h-3 w-3 text-gold/70" />
          <span>Passed {relativeTime(law.established_at)}</span>
        </div>
      </div>

      {/* Statement */}
      <Link
        href={`/topic/${law.topic_id}`}
        className="group/link"
      >
        <h3 className="text-sm font-semibold text-white leading-snug group-hover/link:text-gold transition-colors">
          {law.statement}
        </h3>
      </Link>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" />
            {forPct}% For
          </span>
          <span className="text-surface-500">
            {law.total_votes.toLocaleString()} votes
          </span>
          <span className="flex items-center gap-1 text-against-400">
            {againstPct}% Against
            <ThumbsDown className="h-3 w-3" />
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-px">
          <div
            className="bg-for-600 rounded-l-full transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="bg-against-600 rounded-r-full transition-all"
            style={{ width: `${againstPct}%` }}
          />
        </div>
      </div>

      {/* Date + actions */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        <span className="text-[11px] font-mono text-surface-600 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {fullDate(law.established_at)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/topic/${law.topic_id}`}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium',
              'bg-surface-200 border border-surface-300 text-surface-600',
              'hover:bg-surface-300 hover:text-white transition-all'
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Topic
          </Link>
          <Link
            href={`/law/${law.id}`}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold',
              'bg-gold/10 border border-gold/30 text-gold',
              'hover:bg-gold/20 hover:border-gold/50 transition-all'
            )}
          >
            <Gavel className="h-3.5 w-3.5" />
            View Law
            <ArrowRight className="h-3 w-3 -mr-0.5 opacity-70" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NewLawsClient() {
  const [laws, setLaws] = useState<RecentLaw[]>([])
  const [stats, setStats] = useState<RecentLawsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState('new')
  const [category, setCategory] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const offsetRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const buildUrl = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ sort, limit: '20', offset: String(offset) })
      if (category !== 'all') p.set('category', category)
      return `/api/laws/recent?${p.toString()}`
    },
    [sort, category]
  )

  const fetchLaws = useCallback(
    async (opts: { reset?: boolean; silent?: boolean } = {}) => {
      if (opts.reset) {
        setLoading(true)
        offsetRef.current = 0
      }
      try {
        const res = await fetch(buildUrl(offsetRef.current))
        if (!res.ok) return
        const data: RecentLawsResponse = await res.json()
        setLaws((prev) =>
          opts.reset ? data.laws : [...prev, ...data.laws]
        )
        if (opts.reset && data.stats) setStats(data.stats)
        setHasMore(data.hasMore)
        offsetRef.current += data.laws.length
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [buildUrl]
  )

  // Initial load + refetch on filter change
  useEffect(() => {
    fetchLaws({ reset: true })
  }, [fetchLaws])

  // Auto-poll
  useEffect(() => {
    pollRef.current = setInterval(() => fetchLaws({ silent: true }), POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchLaws])

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    await fetchLaws({ reset: true })
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    await fetchLaws()
  }

  const activeFilters = (sort !== 'new' ? 1 : 0) + (category !== 'all' ? 1 : 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gold/10 border border-gold/30">
                <Gavel className="h-4 w-4 text-gold" />
              </div>
              <h1 className="text-2xl font-bold font-mono text-white">New Laws</h1>
            </div>
            <p className="text-sm text-surface-500">
              Recently established civic laws — debates the Lobby turned into consensus.
            </p>
          </div>

          {/* Refresh + filter controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
            <button
              onClick={() => setShowFilters((f) => !f)}
              aria-label="Toggle filters"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                'border transition-all',
                showFilters || activeFilters > 0
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-gold text-surface-900 text-[10px] font-bold">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <StatPill label="Total" value={stats.total} color="text-gold" />
            <StatPill label="This month" value={stats.this_month} color="text-for-400" />
            <StatPill label="This week" value={stats.this_week} color="text-emerald" />
            <StatPill label="Today" value={stats.today} color="text-purple" />
          </div>
        )}

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-4">
                {/* Sort */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2">
                    Sort
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setSort(id)}
                        aria-pressed={sort === id}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border',
                          sort === id
                            ? 'bg-gold/20 border-gold/40 text-gold'
                            : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2">
                    Category
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {CATEGORIES.map((cat) => {
                      const style = cat === 'all' ? null : getCatStyle(cat)
                      const isActive = category === cat
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          aria-pressed={isActive}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition-all border',
                            isActive && style
                              ? cn(style.bg, style.border, style.text)
                              : isActive
                              ? 'bg-gold/20 border-gold/40 text-gold'
                              : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                          )}
                        >
                          {cat === 'all' ? 'All' : cat}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Law count header */}
        {!loading && laws.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono text-surface-500">
              {laws.length} law{laws.length !== 1 ? 's' : ''} shown
              {category !== 'all' && ` · ${category}`}
            </p>
            <Link
              href="/laws"
              className="text-xs font-mono text-gold/70 hover:text-gold transition-colors flex items-center gap-1"
            >
              <span>Full Codex</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Law list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <LawSkeleton key={i} />
            ))}
          </div>
        ) : laws.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No laws yet"
            description={
              category !== 'all'
                ? `No laws established in ${category} yet. Be the first to debate and pass one.`
                : 'No laws have been established yet. Vote on active topics to push them toward consensus.'
            }
            action={{ label: 'Browse Topics', href: '/topics' }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {laws.map((law, i) => (
                <LawCard key={law.id} law={law} rank={i + 1} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-medium',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Load more
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer link */}
        {!loading && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold/60" />
              <p className="text-xs font-mono text-surface-500">
                Laws are established when a topic sustains ≥67% FOR consensus through a voting period.
              </p>
            </div>
            <Link
              href="/law-watch"
              className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-for-400/70 hover:text-for-400 transition-colors ml-4"
            >
              <TrendingUp className="h-3 w-3" />
              Law Watch
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
