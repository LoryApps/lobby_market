'use client'

/**
 * /deadlock — The Civic Deadlock
 *
 * Topics that have been locked in near-perfect 50/50 disagreement for 7+ days.
 * These are the questions democracy struggles most to answer — not because
 * citizens don't care, but because neither side can break the stalemate.
 *
 * Distinct from:
 *   /battleground  — any contested 35–65% split right now
 *   /stalled       — debates with no recent vote activity
 *   /civic-swing   — topics that recently changed direction
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Users,
  Clock,
  MessageSquare,
  Swords,
  Lock,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeadlockTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  created_at: string
  _deadlock_deviation: number
  _deadlock_grip: number
  _deadlock_score: number
  _deadlock_days: number
}

interface DeadlockResponse {
  topics: DeadlockTopic[]
  hasMore: boolean
  total: number
  avgDeviation: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
] as const

type SortMode = 'grip' | 'age' | 'hot'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'grip', label: 'Tightest Lock' },
  { id: 'age', label: 'Oldest Deadlock' },
  { id: 'hot', label: 'Most Voted' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

function getCategoryColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Tier label ───────────────────────────────────────────────────────────────

function lockTier(deviation: number, days: number): { label: string; color: string; bg: string; border: string } {
  // Tightest lock + longest duration = "Total Deadlock"
  if (deviation <= 1 && days >= 14) return { label: 'Total Deadlock', color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/40' }
  if (deviation <= 1)               return { label: 'Perfect Split',   color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/40' }
  if (deviation <= 3 && days >= 14) return { label: 'Entrenched',      color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/40' }
  if (deviation <= 3)               return { label: 'Standoff',        color: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/40' }
  return                                   { label: 'Contested',       color: 'text-surface-400', bg: 'bg-surface-200/60', border: 'border-surface-400/40' }
}

// ─── DeadlockCard ─────────────────────────────────────────────────────────────

function DeadlockCard({ topic, rank }: { topic: DeadlockTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const tier = lockTier(topic._deadlock_deviation, topic._deadlock_days)
  const deviation = topic._deadlock_deviation.toFixed(1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300/70',
        'hover:border-against-500/30 transition-colors',
        'flex flex-col gap-3 p-4'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 tabular-nums">
              #{rank}
            </span>
            {topic.category && (
              <span className={cn('text-[11px] font-mono uppercase tracking-wide', getCategoryColor(topic.category))}>
                {topic.category}
              </span>
            )}
            <Badge
              variant={
                topic.status === 'voting' ? 'active'
                  : topic.status === 'active' ? 'active'
                  : 'proposed'
              }
            >
              {topic.status}
            </Badge>
          </div>

          <Link
            href={`/topic/${topic.id}`}
            className="block font-mono text-sm font-semibold text-white leading-snug hover:text-against-300 transition-colors line-clamp-3"
          >
            {topic.statement}
          </Link>
        </div>

        {/* Lock tier badge */}
        <div className={cn(
          'flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border',
          tier.bg, tier.border
        )}>
          <Lock className={cn('h-3.5 w-3.5', tier.color)} />
          <span className={cn('text-[10px] font-mono font-bold tabular-nums', tier.color)}>
            ±{deviation}%
          </span>
          <span className={cn('text-[9px] font-mono leading-tight text-center', tier.color, 'opacity-80')}>
            {tier.label}
          </span>
        </div>
      </div>

      {/* Vote bar — nearly centered */}
      <div className="space-y-1">
        <div className="relative h-2 w-full rounded-full bg-against-600/30 overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
          {/* Center line */}
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/20 -translate-x-px" />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-surface-600 tabular-nums">{topic._deadlock_days}d locked</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-surface-300/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" />
            {(topic.total_votes ?? 0).toLocaleString()} votes
          </div>
          {(topic.total_arguments ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <MessageSquare className="h-3 w-3" />
              {(topic.total_arguments ?? 0).toLocaleString()} args
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-600">
          <Clock className="h-3 w-3" />
          <span>{topic._deadlock_days}d</span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-center justify-center gap-2 py-2 rounded-xl',
          'bg-against-500/10 border border-against-500/30',
          'hover:bg-against-500/20 hover:border-against-500/50 hover:text-against-300',
          'text-xs font-mono text-against-400/70 transition-colors'
        )}
      >
        <Swords className="h-3.5 w-3.5" />
        Break the deadlock
      </Link>
    </motion.div>
  )
}

function DeadlockCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-16 w-14 rounded-xl flex-shrink-0" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DeadlockClient() {
  const [topics, setTopics] = useState<DeadlockTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [avgDeviation, setAvgDeviation] = useState(0)
  const [category, setCategory] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('grip')
  const [showFilters, setShowFilters] = useState(false)
  const offsetRef = useRef(0)
  const PAGE = 24

  const loadData = useCallback(async (reset: boolean) => {
    if (reset) {
      setLoading(true)
      setTopics([])
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }

    try {
      const qs = new URLSearchParams({
        limit: String(PAGE),
        offset: String(reset ? 0 : offsetRef.current),
        sort: sortMode,
      })

      const res = await globalThis.fetch(`/api/feed/deadlock?${qs.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch deadlock feed')
      const data: DeadlockResponse = await res.json()

      let filtered = data.topics
      if (category !== 'all') {
        filtered = filtered.filter(t => t.category === category)
      }

      if (reset) {
        setTopics(filtered)
      } else {
        setTopics(prev => [...prev, ...filtered])
      }
      setHasMore(data.hasMore)
      setTotal(data.total)
      setAvgDeviation(data.avgDeviation ?? 0)
      offsetRef.current = (reset ? 0 : offsetRef.current) + data.topics.length
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortMode, category])

  useEffect(() => { loadData(true) }, [loadData])

  const tightestLock = topics.length > 0
    ? Math.min(...topics.map(t => t._deadlock_deviation))
    : 0

  const longestDeadlock = topics.length > 0
    ? Math.max(...topics.map(t => t._deadlock_days))
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
                <Scale className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Deadlock
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Debates democracy can't resolve
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  showFilters
                    ? 'bg-against-500/20 border-against-500/40 text-against-300'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-surface-200'
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-400 hover:text-surface-200 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-surface-400 font-mono leading-relaxed max-w-2xl">
            These topics have been stuck within 6 percentage points of a perfect 50/50 split for
            at least a week — despite real votes from real citizens. The civic community is genuinely
            divided. A{' '}
            <span className="text-against-300">Total Deadlock</span> has been perfectly split for
            2+ weeks with no sign of resolution.
          </p>
        </div>

        {/* ── Stats bar ─────────────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
              <p className="text-xl font-mono font-bold text-against-400 tabular-nums">
                {total}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">deadlocked debates</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
              <p className="text-xl font-mono font-bold text-gold tabular-nums">
                ±{tightestLock.toFixed(1)}%
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">tightest split</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
              <p className="text-xl font-mono font-bold text-purple tabular-nums">
                {longestDeadlock}d
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">longest standoff</p>
            </div>
          </motion.div>
        )}

        {/* ── Filters panel ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 space-y-4">
                {/* Sort */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-2">Sort</p>
                  <div className="flex gap-2 flex-wrap">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSortMode(opt.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                          sortMode === opt.id
                            ? 'bg-against-500/20 border-against-500/40 text-against-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-surface-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-2">Category</p>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all capitalize',
                          category === cat
                            ? 'bg-against-500/20 border-against-500/40 text-against-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-surface-200'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tier legend ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[
            { label: 'Contested',     desc: '±4-6%',  color: 'text-surface-400', border: 'border-surface-400/30', bg: 'bg-surface-200/60' },
            { label: 'Standoff',      desc: '±2-4%',  color: 'text-for-300',     border: 'border-for-500/40',    bg: 'bg-for-500/10' },
            { label: 'Entrenched',    desc: '±2%, 14d',color: 'text-purple',      border: 'border-purple/40',     bg: 'bg-purple/10' },
            { label: 'Perfect Split', desc: '±1%',    color: 'text-gold',        border: 'border-gold/40',       bg: 'bg-gold/10' },
            { label: 'Total Deadlock',desc: '±1%, 14d',color: 'text-against-300', border: 'border-against-500/40',bg: 'bg-against-500/10' },
          ].map(tier => (
            <div
              key={tier.label}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono',
                tier.color, tier.border, tier.bg
              )}
            >
              <Lock className="h-3 w-3" />
              <span className="font-semibold">{tier.label}</span>
              <span className="opacity-60">{tier.desc}</span>
            </div>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <DeadlockCardSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No deadlocked debates"
            description="No debates have been perfectly split for 7+ days yet. As topics age and voting slows, the most contested will surface here."
            action={{ label: 'Browse all topics', href: '/topics' }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {topics.map((topic, i) => (
                  <DeadlockCard key={topic.id} topic={topic} rank={i + 1} />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => loadData(false)}
                  disabled={loadingMore}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm',
                    'bg-surface-200 border border-surface-300 text-surface-300',
                    'hover:bg-surface-300 hover:text-white transition-all disabled:opacity-50'
                  )}
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Footer nav ────────────────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-surface-300/40">
          <p className="text-[11px] font-mono text-surface-600 mb-3 uppercase tracking-widest">
            Related
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Battleground', href: '/battleground', color: 'text-for-400/70 border-for-500/30 hover:text-for-400 hover:border-for-500/50' },
              { label: 'Civic Swing',  href: '/civic-swing',  color: 'text-purple/70 border-purple/30 hover:text-purple hover:border-purple/50' },
              { label: 'Stalled',      href: '/stalled',      color: 'text-surface-400 border-surface-300/60 hover:text-surface-200 hover:border-surface-400' },
              { label: 'In Flux',      href: '/flux',         color: 'text-against-400/70 border-against-500/30 hover:text-against-400 hover:border-against-500/50' },
              { label: 'All Topics',   href: '/topics',       color: 'text-surface-400 border-surface-300/60 hover:text-surface-200 hover:border-surface-400' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all',
                  link.color
                )}
              >
                <ChevronRight className="h-3 w-3" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Back link ─────────────────────────────────────────────────────── */}
        <div className="mt-8 flex">
          <Link
            href="/"
            className="flex items-center gap-2 text-[11px] font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
