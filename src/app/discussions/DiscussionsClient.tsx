'use client'

/**
 * /discussions — Active Argument Discussions
 *
 * Surfaces the most active reply threads across all topics. Unlike the
 * top-arguments page (which ranks by quality score) or the live stream
 * (which shows new arguments in real time), this view surfaces the arguments
 * that are generating the most back-and-forth conversation.
 *
 * Sort modes:
 *   most_replies     — highest total reply count in the window
 *   recent_activity  — most recently replied-to first
 *   most_active      — combined recency × velocity score
 *
 * Filters: category, side (FOR / AGAINST), look-back window
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DiscussedArgument, DiscussionsResponse } from '@/app/api/arguments/discussions/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'most_replies',    label: 'Most Replies',    icon: MessageSquare },
  { id: 'recent_activity', label: 'Latest Activity', icon: Clock },
  { id: 'most_active',     label: 'Most Active',     icon: Flame },
] as const

const DAY_OPTIONS = [
  { id: 7,   label: '7 days' },
  { id: 30,  label: '30 days' },
  { id: 90,  label: '90 days' },
  { id: 365, label: 'All time' },
] as const

const SIDE_OPTIONS = [
  { id: '',        label: 'Both sides', icon: Scale },
  { id: 'for',     label: 'FOR',        icon: ThumbsUp },
  { id: 'against', label: 'AGAINST',    icon: ThumbsDown },
] as const

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'LAW',
  failed:   'Failed',
}

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  B: { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  C: { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  D: { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  F: { text: 'text-against-400', bg: 'bg-against-600/10', border: 'border-against-600/30' },
}

type SortId = typeof SORT_OPTIONS[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgumentSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function DiscussionCard({
  arg,
  rank,
}: {
  arg: DiscussedArgument
  rank: number
}) {
  const isFor = arg.side === 'blue'
  const topic = arg.topic
  const author = arg.author
  const grade = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade] : null
  const latestAt = arg.latest_reply_at ?? arg.created_at

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(rank * 0.04, 0.4) }}
    >
      <div className="group rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden">
        {/* Topic header */}
        {topic && (
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-surface-200 hover:bg-surface-200/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {topic.category && (
                  <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                    {topic.category}
                  </span>
                )}
                <span className="text-surface-600 text-[10px]">·</span>
                <Badge variant={STATUS_BADGE[topic.status] ?? 'active'} className="text-[10px] px-1.5 py-0">
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </Badge>
              </div>
              <p className="text-xs font-mono text-surface-400 line-clamp-1 group-hover:text-surface-300 transition-colors">
                {truncate(topic.statement, 100)}
              </p>
            </div>
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-surface-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        )}

        {/* Argument body */}
        <div className="px-5 py-4">
          {/* Side indicator + content */}
          <div className="flex gap-3">
            <div className={cn(
              'w-0.5 flex-shrink-0 rounded-full mt-0.5',
              isFor ? 'bg-for-500' : 'bg-against-500'
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={cn(
                  'text-[10px] font-mono font-bold uppercase tracking-wider',
                  isFor ? 'text-for-400' : 'text-against-400'
                )}>
                  {isFor ? 'FOR' : 'AGAINST'}
                </span>
                {grade && (
                  <span className={cn(
                    'text-[10px] font-mono font-semibold px-1.5 py-0 rounded border',
                    grade.text, grade.bg, grade.border
                  )}>
                    {arg.ai_grade}
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-surface-300 leading-relaxed line-clamp-3">
                {arg.content}
              </p>
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-200">
            {/* Author */}
            <div className="flex items-center gap-2">
              {author ? (
                <Link href={`/profile/${author.username}`} className="flex items-center gap-1.5 group/author">
                  <Avatar
                    src={author.avatar_url}
                    fallback={author.display_name || author.username}
                    size="xs"
                  />
                  <span className="text-xs font-mono text-surface-500 group-hover/author:text-surface-300 transition-colors truncate max-w-[100px]">
                    {author.display_name || `@${author.username}`}
                  </span>
                </Link>
              ) : (
                <span className="text-xs font-mono text-surface-600">Anonymous</span>
              )}
              <span className="text-surface-700 text-[10px]">·</span>
              <span className="text-[11px] font-mono text-surface-600">
                {relativeTime(arg.created_at)}
              </span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                <ThumbsUp className="h-3 w-3" />
                <span>{arg.upvotes}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-for-400 font-semibold">
                <MessageSquare className="h-3 w-3" />
                <span>{arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-surface-600">
                <Clock className="h-3 w-3" />
                <span>{relativeTime(latestAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* View discussion CTA */}
        {topic && (
          <Link
            href={`/topic/${topic.id}#arguments`}
            className="flex items-center justify-between px-5 py-2.5 bg-surface-200/40 hover:bg-surface-200/80 border-t border-surface-200 transition-colors"
          >
            <span className="text-[11px] font-mono text-surface-500">View full discussion thread</span>
            <ArrowRight className="h-3 w-3 text-surface-600" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DiscussionsClient() {
  const [sort, setSort] = useState<SortId>('most_replies')
  const [category, setCategory] = useState('')
  const [side, setSide] = useState('')
  const [days, setDays] = useState(30)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  const [args, setArgs] = useState<DiscussedArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const categoryRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams({
          sort,
          days: String(days),
          limit: '20',
        })
        if (category) params.set('category', category)
        if (side) params.set('side', side)

        const res = await fetch(`/api/arguments/discussions?${params}`, {
          signal: abortRef.current.signal,
        })
        if (!res.ok) throw new Error('Failed to load')
        const data: DiscussionsResponse = await res.json()
        setArgs(data.arguments)
        setTotal(data.total)
        setGeneratedAt(data.generatedAt)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setArgs([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sort, category, side, days]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30">
              <MessageSquare className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Active Discussions</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Arguments generating the most reply threads right now
              </p>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="ml-auto p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
          {total > 0 && generatedAt && (
            <p className="text-[11px] font-mono text-surface-600 ml-13 pl-[52px]">
              {total.toLocaleString()} active threads · updated {relativeTime(generatedAt)}
            </p>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="space-y-3 mb-6"
        >
          {/* Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider w-8 flex-shrink-0">Sort</span>
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  sort === id
                    ? 'bg-for-500/20 text-for-300 border-for-500/50'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Side + Days */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider w-8 flex-shrink-0">Side</span>
            {SIDE_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSide(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  side === id
                    ? id === 'for'
                      ? 'bg-for-500/20 text-for-300 border-for-500/50'
                      : id === 'against'
                      ? 'bg-against-500/20 text-against-300 border-against-500/50'
                      : 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                {label}
              </button>
            ))}

            <span className="text-surface-600 text-[10px] mx-1">|</span>

            {DAY_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDays(id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  days === id
                    ? 'bg-purple/20 text-purple border-purple/50'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider w-8 flex-shrink-0">Cat</span>
            <div className="relative" ref={categoryRef}>
              <button
                onClick={() => setShowCategoryDropdown((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  category
                    ? 'bg-gold/20 text-gold border-gold/50'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                {category || 'All Categories'}
                <ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {showCategoryDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 z-30 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                  >
                    <button
                      onClick={() => { setCategory(''); setShowCategoryDropdown(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                        !category ? 'text-white font-semibold' : 'text-surface-400'
                      )}
                    >
                      All Categories
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat); setShowCategoryDropdown(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                          category === cat
                            ? cn('font-semibold', CATEGORY_COLOR[cat] ?? 'text-white')
                            : 'text-surface-400'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <ArgumentSkeleton key={i} />)
          ) : args.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              iconBorder="border-for-500/30"
              title="No active discussions"
              description={
                category || side || days < 30
                  ? 'No argument threads match your current filters. Try adjusting the sort, side, or time window.'
                  : 'No reply threads found yet. Arguments with active discussions will appear here as conversation picks up.'
              }
              actions={[
                {
                  label: 'Browse Arguments',
                  href: '/arguments',
                  icon: TrendingUp,
                },
                {
                  label: 'Explore Topics',
                  href: '/discover',
                  icon: Sparkles,
                  variant: 'secondary',
                },
              ]}
            />
          ) : (
            args.map((arg, i) => (
              <DiscussionCard key={arg.id} arg={arg} rank={i} />
            ))
          )}
        </div>

        {/* Footer links */}
        {!loading && args.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-6"
          >
            <Link
              href="/arguments"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Top Arguments
            </Link>
            <Link
              href="/live"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Live Stream
            </Link>
            <Link
              href="/common-threads"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              Common Threads
            </Link>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
