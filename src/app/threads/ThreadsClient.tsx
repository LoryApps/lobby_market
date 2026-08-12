'use client'

/**
 * /threads — Civic Threads
 *
 * Surfaces active debate "threads" — clusters of related topics that share a
 * common keyword tag. A thread groups every debate on, say, #climate or #tax
 * so you can see the entire conversation arc: how many debates are live,
 * how votes are splitting across the theme, and which individual topics matter
 * most right now.
 *
 * Distinct from:
 *   /tags         — raw tag browser (alphabetical, no clustering or scoring)
 *   /chains       — sequential chains (one debate spawned from another)
 *   /continuations — follow-on debate proposals awaiting a vote
 *   /topics       — unorganised full topic roster
 *
 * This is the only page that groups parallel debates by theme and ranks
 * the themes themselves by collective civic weight.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  FileText,
  Filter,
  Gavel,
  Hash,
  Loader2,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicThread, ThreadsResponse } from '@/app/api/threads/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS = [
  { value: 'activity', label: 'Most Active' },
  { value: 'votes', label: 'Most Votes' },
  { value: 'size', label: 'Most Debates' },
  { value: 'contested', label: 'Most Split' },
]

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function catColor(cat: string) {
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/30' }
}

const STATUS_ICON: Record<string, typeof FileText> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Swords,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Topic mini-card ──────────────────────────────────────────────────────────

function TopicMiniCard({
  topic,
}: {
  topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
}) {
  const Icon = STATUS_ICON[topic.status] ?? FileText
  const for_pct = Math.round(topic.blue_pct)
  const against_pct = 100 - for_pct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex flex-col gap-1.5 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/70 hover:bg-surface-200/80 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-white/90 font-medium leading-snug line-clamp-2 flex-1">
          {topic.statement}
        </p>
        <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-surface-500" />
      </div>
      {/* Mini vote bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-l-full"
            style={{ width: `${for_pct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-for-400 tabular-nums">{for_pct}%</span>
        <span className="text-[10px] font-mono text-against-400 tabular-nums">{against_pct}%</span>
      </div>
      <p className="text-[10px] text-surface-500 font-mono">
        {fmt(topic.total_votes)} votes
      </p>
    </Link>
  )
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({ thread, index }: { thread: CivicThread; index: number }) {
  const for_pct = Math.round(thread.avg_blue_pct)
  const against_pct = 100 - for_pct
  const isContested = thread.controversy_score >= 70

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'flex flex-col gap-4 p-4 rounded-2xl border transition-colors',
        'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60',
      )}
    >
      {/* Thread header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={`/tags/${encodeURIComponent(thread.tag)}`}
            className="group flex items-center gap-1.5"
          >
            <Hash className="h-4 w-4 text-for-500 flex-shrink-0" />
            <span className="text-base font-bold text-white group-hover:text-for-400 transition-colors">
              {thread.tag}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
          </Link>
          {/* Category pills */}
          {thread.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {thread.categories.slice(0, 3).map((cat) => {
                const c = catColor(cat)
                return (
                  <span
                    key={cat}
                    className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium border', c.text, c.bg, c.border)}
                  >
                    {cat}
                  </span>
                )
              })}
              {thread.categories.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] text-surface-500 bg-surface-300/40 border border-surface-400/30">
                  +{thread.categories.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats column */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            {thread.active_count > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-for-500/15 border border-for-500/30 text-[10px] font-semibold text-for-400">
                <Zap className="h-2.5 w-2.5" />
                {thread.active_count} live
              </span>
            )}
            {thread.law_count > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[10px] font-semibold text-gold">
                <Gavel className="h-2.5 w-2.5" />
                {thread.law_count} law{thread.law_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 font-mono">{fmt(thread.total_votes)} votes</p>
          <p className="text-[10px] text-surface-500">{thread.topic_count} debates · {relativeTime(thread.last_activity)}</p>
        </div>
      </div>

      {/* Consensus bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" />
            {for_pct}% avg FOR
          </span>
          {isContested && (
            <span className="flex items-center gap-1 text-amber-400 text-[10px]">
              <Scale className="h-2.5 w-2.5" />
              Highly contested
            </span>
          )}
          <span className="flex items-center gap-1 text-against-400">
            {against_pct}% avg AGAINST
            <ThumbsDown className="h-3 w-3" />
          </span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full transition-all duration-500"
            style={{ width: `${for_pct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full transition-all duration-500"
            style={{ width: `${against_pct}%` }}
          />
        </div>
      </div>

      {/* Top topic previews */}
      {thread.top_topics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {thread.top_topics.map((topic) => (
            <TopicMiniCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <BarChart2 className="h-3 w-3" />
          <span>Controversy {thread.controversy_score}/100</span>
        </div>
        <Link
          href={`/tags/${encodeURIComponent(thread.tag)}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-for-400 hover:text-for-300 transition-colors"
        >
          Explore thread
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl border border-surface-300/60 bg-surface-200/60 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThreadsClient() {
  const [threads, setThreads] = useState<CivicThread[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('')
  const [sort, setSort] = useState<string>('activity')
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (category) params.set('category', category)
      const res = await fetch(`/api/threads?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const data: ThreadsResponse = await res.json()
      setThreads(data.threads)
      setTotal(data.total)
    } catch {
      setThreads([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [sort, category])

  useEffect(() => { void load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30">
              <Hash className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Civic Threads</h1>
              <p className="text-sm text-surface-500">
                Debate clusters grouped by theme — discover every angle of a civic topic
              </p>
            </div>
          </div>

          {total > 0 && !loading && (
            <p className="text-xs text-surface-500 mt-3">
              {total} active thread{total !== 1 ? 's' : ''} · debates grouped by shared keyword
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-xl p-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  sort === opt.value
                    ? 'bg-surface-50 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryFilter((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors',
                category
                  ? 'bg-for-500/10 border-for-500/40 text-for-400'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-surface-700',
              )}
            >
              <Filter className="h-3 w-3" />
              {category || 'Category'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showCategoryFilter && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showCategoryFilter && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 top-full mt-1 z-20 w-44 bg-surface-200 border border-surface-300 rounded-xl shadow-lg overflow-hidden"
                >
                  <button
                    onClick={() => { setCategory(''); setShowCategoryFilter(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-semibold transition-colors',
                      !category ? 'text-white bg-surface-300/60' : 'text-surface-500 hover:bg-surface-300/40',
                    )}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategoryFilter(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-semibold transition-colors',
                        category === cat ? 'text-white bg-surface-300/60' : 'text-surface-500 hover:bg-surface-300/40',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active filter chip */}
          {category && (
            <button
              onClick={() => setCategory('')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-for-500/10 border border-for-500/30 text-xs text-for-400 hover:bg-for-500/20 transition-colors"
            >
              {category}
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh threads"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300 text-xs text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ThreadSkeleton key={i} />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            icon={Hash}
            title="No threads found"
            description={
              category
                ? `No active debate clusters in the ${category} category yet.`
                : 'No debate clusters with 3+ topics found. As more topics are tagged, threads will form here.'
            }
            action={category ? { label: 'Clear filter', onClick: () => setCategory('') } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {threads.map((thread, i) => (
              <ThreadCard key={thread.tag} thread={thread} index={i} />
            ))}
          </div>
        )}

        {/* Footer note */}
        {!loading && threads.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300/60 text-center">
            <p className="text-xs text-surface-500">
              Threads group debates sharing a common keyword tag.{' '}
              <Link href="/tags" className="text-for-400 hover:text-for-300 transition-colors underline underline-offset-2">
                Browse all tags →
              </Link>
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
