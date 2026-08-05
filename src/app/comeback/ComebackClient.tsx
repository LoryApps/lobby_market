'use client'

/**
 * /comeback — Comeback Debates
 *
 * Civic debates that went dormant (no votes for 48h+) but have just received
 * fresh votes in the last 24 hours. The "revival debates" — topics the platform
 * thought were finished until someone reignited them.
 *
 * Distinct from /stalled (still dormant) and /swing (opinion reversals):
 * comeback topics are specifically about activity returning after silence,
 * not about which side is winning.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  RotateCcw,
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

interface ComebackTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  _comeback_vote_count: number
  _comeback_revived_at: string
}

interface ComebackResponse {
  topics: ComebackTopic[]
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
  { id: 'top', label: 'Most Revived' },
  { id: 'new', label: 'Most Recently Revived' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revivedLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / (60 * 60 * 1000))
  const m = Math.floor(ms / (60 * 1000))
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return 'today'
}

// ─── ComebackCard ─────────────────────────────────────────────────────────────

function ComebackCard({ topic }: { topic: ComebackTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300/70',
        'hover:border-emerald/30 transition-colors',
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
            className="block font-mono text-sm font-semibold text-white leading-snug hover:text-emerald transition-colors line-clamp-3"
          >
            {topic.statement}
          </Link>
        </div>

        {/* Revival badge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border bg-emerald/10 border-emerald/30">
          <RotateCcw className="h-3.5 w-3.5 text-emerald" />
          <span className="text-[11px] font-mono font-semibold text-emerald tabular-nums">
            {topic._comeback_vote_count}
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
            {topic.total_votes.toLocaleString()} total
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald/70">
            <Flame className="h-3 w-3" />
            {topic._comeback_vote_count} new
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Clock className="h-3 w-3" />
          Revived {revivedLabel(topic._comeback_revived_at)}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-center justify-center gap-2 py-2 rounded-xl',
          'bg-emerald/10 border border-emerald/30',
          'hover:bg-emerald/20 hover:border-emerald/50 hover:text-emerald',
          'text-xs font-mono text-emerald/70 transition-colors'
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Join the comeback
      </Link>
    </motion.div>
  )
}

function ComebackCardSkeleton() {
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

export function ComebackClient() {
  const [topics, setTopics] = useState<ComebackTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('top')
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

      const res = await globalThis.fetch(`/api/feed/comeback?${qs.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch comeback')
      const data: ComebackResponse = await res.json()

      // Apply client-side category filter
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
      offsetRef.current = (reset ? 0 : offsetRef.current) + data.topics.length
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortMode, category])

  useEffect(() => { loadData(true) }, [loadData])

  const avgNewVotes = topics.length > 0
    ? Math.round(topics.reduce((s, t) => s + t._comeback_vote_count, 0) / topics.length)
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <RotateCcw className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Comeback Debates
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Dormant debates revived in the last 24 hours
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
          <div className="rounded-xl bg-emerald/5 border border-emerald/20 px-4 py-3 text-xs font-mono text-emerald/70 leading-relaxed">
            These debates went silent — no new votes for at least 48 hours — and then someone came back.
            Now the conversation is live again. The question is whether the revival holds or fades back into silence.
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                label: 'Revived today',
                value: total.toLocaleString(),
                icon: RotateCcw,
                color: 'text-emerald',
              },
              {
                label: 'Avg new votes',
                value: avgNewVotes.toLocaleString(),
                icon: Flame,
                color: 'text-gold',
              },
              {
                label: 'Showing',
                value: topics.length.toLocaleString(),
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
                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
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
            {category !== 'all' && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-emerald text-surface-900 text-[9px] font-bold">
                1
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
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4">
                <p className="text-[11px] font-mono text-surface-500 mb-2 uppercase tracking-wide">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-colors',
                        category === cat
                          ? 'bg-emerald/20 border-emerald/50 text-emerald'
                          : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {cat === 'all' ? 'All categories' : cat}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Topic grid ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <ComebackCardSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No comebacks right now"
            description={
              category !== 'all'
                ? 'No revived debates in this category. Try All categories or check back later.'
                : 'No dormant debates have been revived in the last 24 hours. The community may be focused elsewhere — or everything is still active.'
            }
            className="mt-8"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {topics.map(topic => (
                  <ComebackCard key={topic.id} topic={topic} />
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
                    'hover:bg-emerald/10 hover:border-emerald/40 hover:text-emerald',
                    'disabled:opacity-50 disabled:cursor-not-allowed transition-all'
                  )}
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Load more comebacks
                </button>
              </div>
            )}

            {!hasMore && topics.length > 0 && (
              <p className="mt-8 text-center text-xs font-mono text-surface-600">
                All {topics.length} comeback debates surfaced
              </p>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
