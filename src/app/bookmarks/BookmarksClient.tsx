'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  BookmarkX,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BookmarkedTopic } from '@/app/api/bookmarks/topics/route'
import type { BookmarkedArgument } from '@/app/api/arguments/bookmarked/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'topics' | 'arguments'
type TopicSortKey = 'saved' | 'votes' | 'status'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_CLASS: Record<string, string> = {
  proposed: 'bg-surface-400/20 text-surface-400 border-surface-400/30',
  active: 'bg-for-500/20 text-for-400 border-for-500/30',
  voting: 'bg-purple/20 text-purple border-purple/30',
  law: 'bg-emerald/20 text-emerald border-emerald/30',
  failed: 'bg-against-500/20 text-against-400 border-against-500/30',
}

const STATUS_ICON: Record<string, typeof FileText> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: X,
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Topic bookmark card ──────────────────────────────────────────────────────

function TopicBookmarkCard({
  topic,
  onRemove,
}: {
  topic: BookmarkedTopic
  onRemove: (id: string) => void
}) {
  const [removing, setRemoving] = useState(false)
  const StatusIcon = STATUS_ICON[topic.status] ?? FileText
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (removing) return
    setRemoving(true)
    try {
      await fetch(`/api/topics/${topic.id}/bookmark`, { method: 'POST' })
      onRemove(topic.id)
    } catch {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="group rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden"
    >
      <Link href={`/topic/${topic.id}`} className="block p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
                STATUS_CLASS[topic.status] ?? STATUS_CLASS.proposed
              )}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {STATUS_LABEL[topic.status] ?? topic.status}
            </span>
            {topic.category && (
              <span className="text-[11px] font-mono text-surface-500">{topic.category}</span>
            )}
            <span className="text-[11px] font-mono text-surface-600">
              · saved {relativeTime(topic.bookmarked_at)}
            </span>
          </div>

          {/* Remove button */}
          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label="Remove bookmark"
            className={cn(
              'flex-shrink-0 p-1.5 rounded-lg transition-all',
              'text-surface-500 hover:text-against-400 hover:bg-against-500/10',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkX className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Statement */}
        <p className="text-sm font-mono font-semibold text-white leading-snug mb-3 line-clamp-2">
          {topic.statement}
        </p>

        {/* Vote bar + stats */}
        <div className="space-y-1.5">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
            <div
              className="bg-for-500 transition-all duration-700"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="bg-against-500 flex-1"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-for-400 font-semibold">{forPct}% For</span>
            <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400 font-semibold">{againstPct}% Against</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Argument bookmark card ───────────────────────────────────────────────────

function ArgumentBookmarkCard({
  argument: arg,
  onRemove,
}: {
  argument: BookmarkedArgument
  onRemove: (id: string) => void
}) {
  const [removing, setRemoving] = useState(false)
  const isFor = arg.side === 'blue'

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (removing) return
    setRemoving(true)
    try {
      await fetch(`/api/arguments/${arg.id}/bookmark`, { method: 'POST' })
      onRemove(arg.id)
    } catch {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className={cn(
        'group rounded-2xl bg-surface-100 border transition-colors overflow-hidden',
        isFor
          ? 'border-for-500/30 hover:border-for-500/50'
          : 'border-against-500/30 hover:border-against-500/50'
      )}
    >
      <div className="p-4">
        {/* Header: side + topic + remove */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
                isFor
                  ? 'bg-for-500/20 text-for-400 border-for-500/30'
                  : 'bg-against-500/20 text-against-400 border-against-500/30'
              )}
            >
              {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[11px] font-mono text-surface-600">
              · saved {relativeTime(arg.bookmarked_at)}
            </span>
          </div>

          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label="Remove bookmark"
            className={cn(
              'flex-shrink-0 p-1.5 rounded-lg transition-all',
              'text-surface-500 hover:text-against-400 hover:bg-against-500/10',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkX className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Argument text */}
        <p className="text-sm font-mono text-white leading-relaxed mb-3 line-clamp-3">
          {arg.content}
        </p>

        {/* Footer: author + topic + upvotes */}
        <div className="flex items-center justify-between gap-2">
          {arg.author ? (
            <Link
              href={`/profile/${arg.author.username}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name || arg.author.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500 truncate">
                @{arg.author.username}
              </span>
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-surface-600">anonymous</span>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <TrendingUp className="h-3 w-3" />
              {arg.upvotes}
            </span>
            {arg.topic && (
              <Link
                href={`/topic/${arg.topic.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{arg.topic.statement}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function TopicSkeletonRow() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="space-y-1.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

function ArgumentSkeletonRow() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const TOPIC_STATUSES = ['proposed', 'active', 'voting', 'law', 'failed']

export function BookmarksClient() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('topics')

  // Topics state
  const [topics, setTopics] = useState<BookmarkedTopic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const [topicSort, setTopicSort] = useState<TopicSortKey>('saved')
  const [topicCategory, setTopicCategory] = useState<string | null>(null)
  const [topicStatus, setTopicStatus] = useState<string | null>(null)

  // Arguments state
  const [args, setArgs] = useState<BookmarkedArgument[]>([])
  const [argsLoading, setArgsLoading] = useState(false)
  const [argsError, setArgsError] = useState<string | null>(null)
  const [argSide, setArgSide] = useState<'blue' | 'red' | null>(null)

  // Shared search
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Load topics
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true)
    setTopicsError(null)
    try {
      const res = await fetch('/api/bookmarks/topics')
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to load bookmarked topics')
      }
      const data = await res.json()
      setTopics(data.topics ?? [])
    } catch (e) {
      setTopicsError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setTopicsLoading(false)
    }
  }, [router])

  // Load arguments (lazy — only when tab changes to arguments)
  const loadArgs = useCallback(async () => {
    if (argsLoading || args.length > 0) return
    setArgsLoading(true)
    setArgsError(null)
    try {
      const res = await fetch('/api/arguments/bookmarked')
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to load bookmarked arguments')
      }
      const data = await res.json()
      setArgs(data.arguments ?? [])
    } catch (e) {
      setArgsError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setArgsLoading(false)
    }
  }, [router, argsLoading, args.length])

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  useEffect(() => {
    if (tab === 'arguments') {
      loadArgs()
    }
  }, [tab, loadArgs])

  // Filtered + sorted topics
  const filteredTopics = useMemo(() => {
    let result = [...topics]

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((t) =>
        t.statement.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q)
      )
    }

    if (topicCategory) {
      result = result.filter((t) => t.category === topicCategory)
    }

    if (topicStatus) {
      result = result.filter((t) => t.status === topicStatus)
    }

    if (topicSort === 'votes') {
      result.sort((a, b) => b.total_votes - a.total_votes)
    } else if (topicSort === 'status') {
      const order = { proposed: 0, active: 1, voting: 2, law: 3, failed: 4 }
      result.sort(
        (a, b) =>
          (order[a.status as keyof typeof order] ?? 5) -
          (order[b.status as keyof typeof order] ?? 5)
      )
    }
    // 'saved' = default — already ordered by saved time from API

    return result
  }, [topics, query, topicCategory, topicStatus, topicSort])

  // Filtered arguments
  const filteredArgs = useMemo(() => {
    let result = [...args]

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (a) =>
          a.content.toLowerCase().includes(q) ||
          (a.topic?.statement ?? '').toLowerCase().includes(q) ||
          (a.author?.username ?? '').toLowerCase().includes(q)
      )
    }

    if (argSide) {
      result = result.filter((a) => a.side === argSide)
    }

    return result
  }, [args, query, argSide])

  const topicsCount = topics.length
  const argsCount = args.length

  const hasActiveFilters =
    tab === 'topics'
      ? !!(query || topicCategory || topicStatus || topicSort !== 'saved')
      : !!(query || argSide)

  function clearFilters() {
    setQuery('')
    setTopicCategory(null)
    setTopicStatus(null)
    setTopicSort('saved')
    setArgSide(null)
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-gold" />
              Bookmarks
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Your saved topics and arguments
            </p>
          </div>
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-xs font-mono font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5" role="tablist" aria-label="Bookmark categories">
          <button
            role="tab"
            aria-selected={tab === 'topics'}
            onClick={() => setTab('topics')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all',
              tab === 'topics'
                ? 'bg-for-600 text-white shadow-lg shadow-for-600/20'
                : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Topics
            {topicsCount > 0 && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                  tab === 'topics'
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-300 text-surface-400'
                )}
              >
                {topicsCount}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'arguments'}
            onClick={() => setTab('arguments')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all',
              tab === 'arguments'
                ? 'bg-purple/80 text-white shadow-lg shadow-purple/20'
                : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Arguments
            {argsCount > 0 && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                  tab === 'arguments'
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-300 text-surface-400'
                )}
              >
                {argsCount}
              </span>
            )}
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'topics' ? 'Search saved topics…' : 'Search saved arguments…'}
              aria-label="Search bookmarks"
              className={cn(
                'w-full pl-8 pr-3 py-2 rounded-xl text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-white placeholder-surface-500',
                'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/30',
                'transition-all'
              )}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono font-medium transition-all border',
              hasActiveFilters && !query
                ? 'bg-for-600/20 border-for-600/40 text-for-400'
                : showFilters
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {(hasActiveFilters) && (
              <span className="h-1.5 w-1.5 rounded-full bg-for-400 flex-shrink-0" />
            )}
          </button>
          <button
            onClick={tab === 'topics' ? loadTopics : () => { setArgs([]); loadArgs() }}
            aria-label="Refresh bookmarks"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', topicsLoading && tab === 'topics' ? 'animate-spin' : '')} />
          </button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl bg-surface-200 border border-surface-300 p-4 space-y-4">
                {tab === 'topics' && (
                  <>
                    {/* Sort */}
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">Sort</p>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { id: 'saved', label: 'Recently Saved', icon: Clock },
                          { id: 'votes', label: 'Most Votes', icon: TrendingUp },
                          { id: 'status', label: 'By Status', icon: Scale },
                        ] as const).map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setTopicSort(id)}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                              topicSort === id
                                ? 'bg-for-600 border-for-600 text-white'
                                : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status filter */}
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setTopicStatus(null)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                            !topicStatus
                              ? 'bg-surface-400 border-surface-400 text-white'
                              : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                          )}
                        >
                          All
                        </button>
                        {TOPIC_STATUSES.map((s) => {
                          const Icon = STATUS_ICON[s] ?? FileText
                          return (
                            <button
                              key={s}
                              onClick={() => setTopicStatus(topicStatus === s ? null : s)}
                              className={cn(
                                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                                topicStatus === s
                                  ? STATUS_CLASS[s]
                                  : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {STATUS_LABEL[s]}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Category filter */}
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">Category</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setTopicCategory(null)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                            !topicCategory
                              ? 'bg-surface-400 border-surface-400 text-white'
                              : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                          )}
                        >
                          All
                        </button>
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setTopicCategory(topicCategory === cat ? null : cat)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                              topicCategory === cat
                                ? 'bg-for-600/20 border-for-600/40 text-for-400'
                                : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tab === 'arguments' && (
                  <div>
                    <p className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">Side</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setArgSide(null)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                          !argSide
                            ? 'bg-surface-400 border-surface-400 text-white'
                            : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                        )}
                      >
                        Both
                      </button>
                      <button
                        onClick={() => setArgSide(argSide === 'blue' ? null : 'blue')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                          argSide === 'blue'
                            ? 'bg-for-500/20 border-for-500/30 text-for-400'
                            : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                        )}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        FOR
                      </button>
                      <button
                        onClick={() => setArgSide(argSide === 'red' ? null : 'red')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                          argSide === 'red'
                            ? 'bg-against-500/20 border-against-500/30 text-against-400'
                            : 'bg-surface-300 border-surface-400 text-surface-400 hover:text-white'
                        )}
                      >
                        <ThumbsDown className="h-3 w-3" />
                        AGAINST
                      </button>
                    </div>
                  </div>
                )}

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-against-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results summary */}
        {tab === 'topics' && !topicsLoading && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-surface-500">
              {filteredTopics.length === topicsCount
                ? `${topicsCount} saved topic${topicsCount !== 1 ? 's' : ''}`
                : `${filteredTopics.length} of ${topicsCount} topics`}
            </p>
            {filteredTopics.length !== topicsCount && (
              <button
                onClick={clearFilters}
                className="text-xs font-mono text-surface-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}

        {tab === 'arguments' && !argsLoading && args.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-surface-500">
              {filteredArgs.length === argsCount
                ? `${argsCount} saved argument${argsCount !== 1 ? 's' : ''}`
                : `${filteredArgs.length} of ${argsCount} arguments`}
            </p>
          </div>
        )}

        {/* ── Topics tab ── */}
        {tab === 'topics' && (
          <div role="tabpanel" aria-label="Saved topics">
            {topicsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <TopicSkeletonRow key={i} />
                ))}
              </div>
            ) : topicsError ? (
              <div className="py-16 text-center space-y-4">
                <p className="font-mono text-sm text-against-400">{topicsError}</p>
                <button
                  onClick={loadTopics}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : topics.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/20"
                title="No saved topics yet"
                description="Bookmark any topic to save it here for later reading and quick access."
                actions={[
                  { label: 'Browse topics', href: '/topics', variant: 'primary' },
                  { label: 'Explore feed', href: '/', variant: 'secondary' },
                ]}
              />
            ) : filteredTopics.length === 0 ? (
              <EmptyState
                icon={Search}
                iconColor="text-surface-400"
                iconBg="bg-surface-200"
                iconBorder="border-surface-300"
                title="No matches"
                description="No bookmarked topics match your filters. Try clearing them."
                actions={[
                  { label: 'Clear filters', onClick: clearFilters, variant: 'primary' },
                ]}
                size="sm"
              />
            ) : (
              <motion.div layout className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredTopics.map((topic) => (
                    <TopicBookmarkCard
                      key={topic.id}
                      topic={topic}
                      onRemove={(id) => setTopics((prev) => prev.filter((t) => t.id !== id))}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}

        {/* ── Arguments tab ── */}
        {tab === 'arguments' && (
          <div role="tabpanel" aria-label="Saved arguments">
            {argsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ArgumentSkeletonRow key={i} />
                ))}
              </div>
            ) : argsError ? (
              <div className="py-16 text-center space-y-4">
                <p className="font-mono text-sm text-against-400">{argsError}</p>
                <button
                  onClick={() => { setArgs([]); loadArgs() }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : args.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                iconBorder="border-purple/20"
                title="No saved arguments yet"
                description="Bookmark arguments you find compelling to build your reading list."
                actions={[
                  { label: 'Browse arguments', href: '/top-arguments', variant: 'primary' },
                  { label: 'Explore topics', href: '/topics', variant: 'secondary' },
                ]}
              />
            ) : filteredArgs.length === 0 ? (
              <EmptyState
                icon={Search}
                iconColor="text-surface-400"
                iconBg="bg-surface-200"
                iconBorder="border-surface-300"
                title="No matches"
                description="No bookmarked arguments match your filters."
                actions={[
                  { label: 'Clear filters', onClick: clearFilters, variant: 'primary' },
                ]}
                size="sm"
              />
            ) : (
              <motion.div layout className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredArgs.map((arg) => (
                    <ArgumentBookmarkCard
                      key={arg.id}
                      argument={arg}
                      onRemove={(id) => setArgs((prev) => prev.filter((a) => a.id !== id))}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
