'use client'

/**
 * /stalled — Stalled Debates
 *
 * Civic debates that had significant vote activity in the last 5-30 days
 * but have received NO new votes in the last 5 days. These are the
 * "forgotten debates" — topics that were alive, then went silent.
 *
 * Unlike /elders (just old), stalled topics are defined by an activity gap:
 * they had real momentum and then the community moved on without a verdict.
 *
 * UI: grid of topic cards with a "Days Stalled" badge, silence duration,
 * and a vote count for the last active burst. Filter by category or silence
 * duration. Sort by most-abandoned vs. most-recently-stalled.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  ArrowRight,
  Clock,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StalledTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  _stalled_vote_count: number
  _stalled_last_vote_at: string
  _stalled_days_silent: number
}

interface StalledResponse {
  topics: StalledTopic[]
  hasMore: boolean
  total: number
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

type SortMode = 'top' | 'new'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'top', label: 'Most Abandoned' },
  { id: 'new', label: 'Most Recently Stalled' },
]

const SILENCE_FILTERS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'all', label: 'Any duration', min: 0, max: 999 },
  { id: '5-7', label: '5-7 days', min: 5, max: 7 },
  { id: '8-14', label: '8-14 days', min: 8, max: 14 },
  { id: '15+', label: '15+ days', min: 15, max: 999 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function silenceLabel(days: number): string {
  if (days < 7) return `${days}d silent`
  if (days < 30) return `${Math.floor(days / 7)}w silent`
  return `${Math.floor(days / 30)}mo silent`
}

function silenceColor(days: number): string {
  if (days >= 20) return 'text-against-400'
  if (days >= 10) return 'text-gold'
  return 'text-surface-400'
}

function silenceBg(days: number): string {
  if (days >= 20) return 'bg-against-500/15 border-against-500/30'
  if (days >= 10) return 'bg-gold/15 border-gold/30'
  return 'bg-surface-300/30 border-surface-400/30'
}

function lastActivityLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`
  return `${Math.floor(d / 30)} months ago`
}

// ─── StalledCard ─────────────────────────────────────────────────────────────

function StalledCard({ topic }: { topic: StalledTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300/70',
        'hover:border-surface-400/70 transition-colors',
        'flex flex-col gap-3 p-4'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {topic.category && (
              <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                {topic.category}
              </span>
            )}
            <Badge
              variant={
                topic.status === 'law' ? 'law'
                  : topic.status === 'voting' ? 'active'
                  : topic.status === 'active' ? 'active'
                  : 'proposed'
              }
            >
              {topic.status}
            </Badge>
          </div>

          <Link
            href={`/topic/${topic.id}`}
            className="block font-mono text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-3"
          >
            {topic.statement}
          </Link>
        </div>

        {/* Silence badge */}
        <div
          className={cn(
            'flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border',
            silenceBg(topic._stalled_days_silent)
          )}
        >
          <Clock className={cn('h-3.5 w-3.5', silenceColor(topic._stalled_days_silent))} />
          <span className={cn('text-[11px] font-mono font-semibold tabular-nums', silenceColor(topic._stalled_days_silent))}>
            {topic._stalled_days_silent}d
          </span>
        </div>
      </div>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full rounded-full bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-surface-300/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" />
            {topic.total_votes.toLocaleString()} votes
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Archive className="h-3 w-3" />
            {topic._stalled_vote_count.toLocaleString()} stalled
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Clock className="h-3 w-3" />
          Last active {lastActivityLabel(topic._stalled_last_vote_at)}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-center justify-center gap-2 py-2 rounded-xl',
          'bg-surface-200/60 border border-surface-300/50',
          'hover:bg-for-600/20 hover:border-for-500/40 hover:text-for-300',
          'text-xs font-mono text-surface-400 transition-colors'
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Reignite this debate
      </Link>
    </motion.div>
  )
}

function StalledCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StalledClient() {
  const [topics, setTopics] = useState<StalledTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('top')
  const [silenceFilter, setSilenceFilter] = useState<string>('all')
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

      const res = await globalThis.fetch(`/api/feed/stalled?${qs.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch stalled')
      const data: StalledResponse = await res.json()

      // Apply client-side category and silence filters
      const silenceFilterObj = SILENCE_FILTERS.find(f => f.id === silenceFilter) ?? SILENCE_FILTERS[0]
      let filtered = data.topics
      if (category !== 'all') {
        filtered = filtered.filter(t => t.category === category)
      }
      if (silenceFilter !== 'all') {
        filtered = filtered.filter(
          t => t._stalled_days_silent >= silenceFilterObj.min && t._stalled_days_silent <= silenceFilterObj.max
        )
      }

      if (reset) {
        setTopics(filtered)
      } else {
        setTopics(prev => [...prev, ...filtered])
      }
      setHasMore(data.hasMore)
      setTotal(data.total)
      offsetRef.current = (reset ? 0 : offsetRef.current) + data.topics.length
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortMode, category, silenceFilter])

  useEffect(() => { loadData(true) }, [loadData])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300">
                <Archive className="h-5 w-5 text-surface-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Stalled Debates
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Active debates that went silent — waiting to be rediscovered
                </p>
              </div>
            </div>

            <button
              onClick={() => loadData(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:text-white hover:border-surface-400 transition-colors text-xs font-mono'
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* Context blurb */}
          <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 px-4 py-3 text-xs font-mono text-surface-400 leading-relaxed">
            These debates had real civic activity — votes, heat, momentum — and then the community moved on
            without reaching a verdict. Not failed, not laws. Just forgotten. Each one is a question that
            the Lobby started asking and never finished.
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                label: 'Stalled debates',
                value: total.toLocaleString(),
                icon: Archive,
                color: 'text-surface-300',
              },
              {
                label: 'Avg silence',
                value: topics.length > 0
                  ? `${Math.round(topics.reduce((s, t) => s + t._stalled_days_silent, 0) / topics.length)}d`
                  : '—',
                icon: Clock,
                color: 'text-gold',
              },
              {
                label: 'Avg votes stalled',
                value: topics.length > 0
                  ? Math.round(topics.reduce((s, t) => s + t._stalled_vote_count, 0) / topics.length).toLocaleString()
                  : '—',
                icon: Users,
                color: 'text-for-400',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 text-center"
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-2', color)} />
                <div className="font-mono text-xl font-bold text-white">{value}</div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Controls ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-surface-200/60 border border-surface-300/60 rounded-xl p-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortMode(opt.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-colors',
                  sortMode === opt.id
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-medium',
              'border transition-colors',
              showFilters
                ? 'bg-surface-300 border-surface-400 text-white'
                : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {(category !== 'all' || silenceFilter !== 'all') && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-for-600 text-white text-[9px]">
                {(category !== 'all' ? 1 : 0) + (silenceFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* ── Filter panel ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 space-y-4">
                {/* Category */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-2 uppercase tracking-wide">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-colors',
                          category === cat
                            ? 'bg-for-600/80 border-for-600 text-white'
                            : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400'
                        )}
                      >
                        {cat === 'all' ? 'All categories' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Silence duration */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-2 uppercase tracking-wide">Silence Duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SILENCE_FILTERS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSilenceFilter(f.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-colors',
                          silenceFilter === f.id
                            ? 'bg-surface-400/60 border-surface-400 text-white'
                            : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Topic grid ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <StalledCardSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No stalled debates found"
            description={
              category !== 'all' || silenceFilter !== 'all'
                ? 'Try adjusting the filters — the silence boundary shifts daily.'
                : 'Every active debate is still receiving votes. The civic conversation is healthy.'
            }
            className="mt-8"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {topics.map(topic => (
                  <StalledCard key={topic.id} topic={topic} />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => loadData(false)}
                  disabled={loadingMore}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm font-semibold',
                    'bg-surface-200 border border-surface-300 text-surface-300',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed transition-all'
                  )}
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Load more stalled debates
                </button>
              </div>
            )}

            {!hasMore && topics.length > 0 && (
              <p className="mt-8 text-center text-xs font-mono text-surface-600">
                All {topics.length} stalled debates surfaced
              </p>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
