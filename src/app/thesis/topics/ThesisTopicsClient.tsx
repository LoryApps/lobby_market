'use client'

/**
 * /thesis/topics — Thesis Topics Hub
 *
 * Shows debate topics that have multiple competing civic thesis predictions.
 * Each card surfaces the topic context and the most-supported theses on both
 * sides, letting users see where civic predictions are most contested.
 *
 * Distinct from:
 *   /thesis              — global thesis board (all, chronological)
 *   /thesis/alignment    — scatter plot by agree ratio
 *   /thesis/map          — 2D map by consensus × urgency
 *   /topic/[id]/theses   — theses for a single specific topic
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  Clock,
  Flame,
  Gavel,
  Hash,
  Loader2,
  RefreshCw,
  Scale,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicWithTheses, ThesisTopicsResponse } from '@/app/api/thesis/topics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function daysUntil(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  const d = Math.ceil(diff / 86_400_000)
  if (d < 0) return 'Overdue'
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `${d}d`
}

// ─── Sort options ──────────────────────────────────────────────────────────────

const SORTS = [
  { id: 'controversial', label: 'Most Contested', icon: Flame },
  { id: 'most_theses', label: 'Most Theses', icon: Hash },
  { id: 'active', label: 'Most Active', icon: BarChart2 },
  { id: 'newest', label: 'Newest', icon: Clock },
] as const

type SortId = (typeof SORTS)[number]['id']

// ─── Status config ─────────────────────────────────────────────────────────────

const TOPIC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500', icon: Zap },
  active: { label: 'Active', color: 'text-for-400', icon: Zap },
  voting: { label: 'Voting', color: 'text-purple', icon: Scale },
  law: { label: 'LAW', color: 'text-gold', icon: Gavel },
  failed: { label: 'Failed', color: 'text-against-400', icon: Zap },
}

const CATEGORY_COLOR: Record<string, string> = {
  economics: 'text-gold',
  politics: 'text-for-400',
  technology: 'text-purple',
  science: 'text-emerald',
  ethics: 'text-against-300',
  philosophy: 'text-for-300',
  culture: 'text-gold',
  health: 'text-against-300',
  environment: 'text-emerald',
  education: 'text-purple',
}

// ─── Thesis mini-card ─────────────────────────────────────────────────────────

function ThesisMiniCard({
  thesis,
  rank,
}: {
  thesis: TopicWithTheses['theses'][number]
  rank: number
}) {
  const agreeRatio =
    thesis.agree_count + thesis.disagree_count > 0
      ? thesis.agree_count / (thesis.agree_count + thesis.disagree_count)
      : 0.5
  const isLeaning = agreeRatio >= 0.6
  const isContra = agreeRatio < 0.4

  return (
    <Link
      href={`/thesis/${thesis.id}`}
      className={cn(
        'flex flex-col gap-2 p-3 rounded-xl border transition-colors',
        'bg-surface-200/60 hover:bg-surface-200 border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[10px] text-surface-600 flex-shrink-0">
          #{rank}
        </span>
        <Avatar
          src={thesis.author?.avatar_url}
          fallback={thesis.author?.display_name || thesis.author?.username || '?'}
          size="xs"
        />
        <span className="text-[11px] text-surface-500 truncate">
          @{thesis.author?.username ?? 'unknown'}
        </span>
        {thesis.resolution_date && (
          <span className="ml-auto text-[10px] text-surface-600 flex-shrink-0 font-mono">
            {daysUntil(thesis.resolution_date)}
          </span>
        )}
      </div>

      {/* Statement */}
      <p className="text-xs text-white leading-relaxed line-clamp-2">
        {thesis.statement}
      </p>

      {/* Vote counts */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center gap-1 text-[11px] font-mono',
            isLeaning ? 'text-for-400' : 'text-surface-500'
          )}
        >
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          {thesis.agree_count}
        </div>
        <div
          className={cn(
            'flex items-center gap-1 text-[11px] font-mono',
            isContra ? 'text-against-400' : 'text-surface-600'
          )}
        >
          <ThumbsDown className="h-3 w-3" aria-hidden="true" />
          {thesis.disagree_count}
        </div>
        {/* Agreement bar */}
        <div className="flex-1 h-1.5 rounded-full bg-surface-400/40 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              agreeRatio >= 0.5 ? 'bg-for-500' : 'bg-against-500'
            )}
            style={{ width: `${Math.round(agreeRatio * 100)}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="text-[10px] font-mono text-surface-500">
          {Math.round(agreeRatio * 100)}%
        </span>
      </div>
    </Link>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicThesisCard({ group }: { group: TopicWithTheses }) {
  const [expanded, setExpanded] = useState(false)
  const topicStatus = TOPIC_STATUS_CONFIG[group.topic_status] ?? TOPIC_STATUS_CONFIG.active
  const StatusIcon = topicStatus.icon
  const forPct = Math.round(group.topic_blue_pct ?? 50)
  const againstPct = 100 - forPct

  const visibleTheses = expanded ? group.theses : group.theses.slice(0, 2)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Topic header */}
      <Link href={`/topic/${group.topic_id}`} className="block p-4 hover:bg-surface-200/40 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <div className={cn('flex items-center gap-1 text-[11px] font-mono', topicStatus.color)}>
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {topicStatus.label}
              </div>
              {group.topic_category && (
                <span className={cn('text-[11px] font-mono capitalize', CATEGORY_COLOR[group.topic_category] ?? 'text-surface-500')}>
                  {group.topic_category}
                </span>
              )}
              <span className="text-[11px] text-surface-600 font-mono ml-auto">
                {group.topic_total_votes.toLocaleString()} votes
              </span>
            </div>

            {/* Statement */}
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {group.topic_statement}
            </p>

            {/* Vote bar */}
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden flex">
                <div
                  className="h-full bg-for-500 rounded-l-full transition-all"
                  style={{ width: `${forPct}%` }}
                  aria-hidden="true"
                />
                <div
                  className="h-full bg-against-500 rounded-r-full transition-all"
                  style={{ width: `${againstPct}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-for-400">{forPct}% For</span>
                <span className="text-against-400">{againstPct}% Against</span>
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        </div>
      </Link>

      {/* Thesis count banner */}
      <div className="px-4 py-2 border-t border-surface-300/60 bg-surface-200/30 flex items-center gap-2">
        <Scroll className="h-3 w-3 text-purple" aria-hidden="true" />
        <span className="text-[11px] font-mono text-surface-500">
          <span className="text-purple font-semibold">{group.thesis_count}</span> competing{' '}
          {group.thesis_count === 1 ? 'thesis' : 'theses'}
        </span>
        <span className="ml-auto text-[11px] font-mono text-surface-600">
          <span className="text-for-400">{group.total_agree}</span> agree ·{' '}
          <span className="text-against-400">{group.total_disagree}</span> disagree
        </span>
      </div>

      {/* Theses */}
      <div className="p-3 space-y-2">
        <AnimatePresence initial={false}>
          {visibleTheses.map((thesis, i) => (
            <motion.div
              key={thesis.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.03 }}
            >
              <ThesisMiniCard thesis={thesis} rank={i + 1} />
            </motion.div>
          ))}
        </AnimatePresence>

        {group.theses.length > 2 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>Show less<ChevronDown className="h-3 w-3 rotate-180" /></>
            ) : (
              <>{group.theses.length - 2} more<ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-surface-300/60 flex items-center gap-2">
        <Link
          href={`/topic/${group.topic_id}/theses`}
          className="text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
        >
          <Users className="h-3 w-3" aria-hidden="true" /> All theses for this topic
        </Link>
        <Link
          href={`/thesis/create?topic=${group.topic_id}`}
          className="ml-auto text-[11px] font-mono text-purple hover:text-for-400 transition-colors flex items-center gap-1"
        >
          Add yours <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TopicThesisSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="px-4 py-2 border-t border-surface-300/60 bg-surface-200/30">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="p-3 space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-surface-200/60 p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThesisTopicsClient() {
  const [groups, setGroups] = useState<TopicWithTheses[]>([])
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<SortId>('controversial')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const LIMIT = 15

  const load = useCallback(
    async (currentSort: SortId, currentOffset: number, append = false) => {
      if (currentOffset === 0) setLoading(true)
      else setLoadingMore(true)
      try {
        const params = new URLSearchParams({
          sort: currentSort,
          limit: String(LIMIT),
          offset: String(currentOffset),
        })
        const res = await fetch(`/api/thesis/topics?${params}`)
        if (!res.ok) return
        const data: ThesisTopicsResponse = await res.json()
        if (append) {
          setGroups((prev) => [...prev, ...data.topics])
        } else {
          setGroups(data.topics)
        }
        setTotal(data.total)
        setOffset(currentOffset + data.topics.length)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    setOffset(0)
    load(sort, 0)
  }, [sort, load])

  const hasMore = offset < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Scale className="h-5 w-5 text-purple" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Thesis Battlegrounds</h1>
              <p className="text-xs text-surface-500 font-mono">
                Debates where civic predictions clash
              </p>
            </div>
          </div>
          {total > 0 && !loading && (
            <p className="text-xs text-surface-600 font-mono mt-2">
              <span className="text-purple font-semibold">{total}</span> topics with competing theses
            </p>
          )}
        </div>

        {/* Sort bar */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Sort theses by">
          {SORTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={sort === id}
              onClick={() => setSort(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'border transition-all whitespace-nowrap flex-shrink-0',
                sort === id
                  ? 'bg-purple/20 border-purple/50 text-purple'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <TopicThesisSkeleton key={i} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-8 w-8 text-surface-600" />}
            title="No contested topics yet"
            description="Topics with multiple civic thesis predictions will appear here."
            action={
              <Link
                href="/thesis/create"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/20 border border-purple/40 text-purple text-sm font-mono font-semibold hover:bg-purple/30 transition-colors"
              >
                <Trophy className="h-4 w-4" /> Write a thesis
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <TopicThesisCard key={group.topic_id} group={group} />
            ))}

            {hasMore && (
              <button
                onClick={() => load(sort, offset, true)}
                disabled={loadingMore}
                className={cn(
                  'w-full py-3 rounded-xl border text-sm font-mono font-semibold transition-all',
                  'bg-surface-200/60 border-surface-300/60 text-surface-500',
                  'hover:bg-surface-200 hover:text-white hover:border-surface-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </span>
                ) : (
                  `Load more (${total - offset} remaining)`
                )}
              </button>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
