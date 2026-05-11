'use client'

/**
 * /arguments/discussions — Most Discussed Arguments
 *
 * Surfaces the arguments with the most active reply threads across the
 * whole platform. Distinct from:
 *  - /arguments           (ranked by upvotes — community agreement)
 *  - /arguments/trending  (ranked by upvote velocity — recent heat)
 *  - /arguments/contested (ranked by controversy score)
 *
 * This page answers: "Which arguments are generating the most conversation?"
 * Useful for finding arguments worth reading the full reply thread on.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { DiscussedArgument, DiscussionsResponse } from '@/app/api/arguments/discussions/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORTS = [
  { id: 'most_replies',     label: 'Most Replies',     icon: MessageSquare },
  { id: 'recent_activity',  label: 'Recent Activity',  icon: Zap },
  { id: 'most_active',      label: 'Most Active',      icon: Flame },
] as const

type SortId = typeof SORTS[number]['id']

const SIDES = [
  { id: '',        label: 'All' },
  { id: 'for',     label: 'FOR' },
  { id: 'against', label: 'AGAINST' },
] as const

const DAYS = [
  { id: '7',   label: '7 days' },
  { id: '30',  label: '30 days' },
  { id: '90',  label: '90 days' },
  { id: '365', label: 'All time' },
] as const

const CATEGORIES = [
  '', 'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald border-emerald/40 bg-emerald/10',
  B: 'text-for-300 border-for-500/30 bg-for-500/10',
  C: 'text-gold border-gold/30 bg-gold/10',
  D: 'text-against-300 border-against-500/30 bg-against-500/10',
  F: 'text-against-400 border-against-600/30 bg-against-600/10',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: DiscussedArgument }) {
  const isFor = arg.side === 'blue'
  const grade = arg.ai_grade ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-surface-400 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-full border',
            isFor
              ? 'bg-for-500/10 border-for-500/30 text-for-300'
              : 'bg-against-500/10 border-against-500/30 text-against-300',
          )}
        >
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>

        {grade && (
          <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-full border', GRADE_COLOR[grade] ?? GRADE_COLOR.C)}>
            Grade {grade}
          </span>
        )}

        {arg.topic?.category && (
          <span className="text-xs font-mono text-surface-500 px-2 py-0.5 rounded-full border border-surface-300 bg-surface-200">
            {arg.topic.category}
          </span>
        )}

        {/* Reply count badge — prominent */}
        <span className="ml-auto flex items-center gap-1 text-xs font-mono font-semibold text-purple px-2 py-0.5 rounded-full border border-purple/30 bg-purple/10">
          <MessageSquare className="h-3 w-3" />
          {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
        </span>
      </div>

      {/* Topic statement */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic_id}`}
          className="block text-xs font-mono text-surface-500 hover:text-surface-700 mb-2 line-clamp-1 transition-colors"
        >
          {arg.topic.statement}
        </Link>
      )}

      {/* Argument content */}
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-3 mb-4">
        {renderWithMentions(arg.content)}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {arg.author && (
            <>
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name ?? arg.author.username}
                size="sm"
                className="flex-shrink-0 h-5 w-5"
              />
              <Link
                href={`/profile/${arg.author.username}`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors truncate"
              >
                {arg.author.display_name ?? arg.author.username}
              </Link>
            </>
          )}

          <span className="text-xs text-surface-600 font-mono flex-shrink-0">
            · {reltime(arg.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Upvote count */}
          <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes}
          </span>

          {/* Last reply time */}
          {arg.latest_reply_at && (
            <span className="text-xs font-mono text-purple/70 flex-shrink-0">
              · last reply {reltime(arg.latest_reply_at)}
            </span>
          )}

          {/* Join discussion CTA */}
          <Link
            href={`/arguments/${arg.id}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
              'bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20'
            )}
          >
            <MessageSquare className="h-3 w-3" />
            Read thread
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArgumentDiscussionsPage() {
  const [sort, setSort] = useState<SortId>('most_replies')
  const [side, setSide] = useState('')
  const [days, setDays] = useState('30')
  const [category, setCategory] = useState('')
  const [catOpen, setCatOpen] = useState(false)

  const [data, setData] = useState<DiscussionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort, days, limit: '20' })
      if (side) params.set('side', side)
      if (category) params.set('category', category)
      const res = await fetch(`/api/arguments/discussions?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load discussions')
      const json: DiscussionsResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [sort, side, days, category])

  useEffect(() => { load() }, [load])

  const activeSort = SORTS.find((s) => s.id === sort)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Link
            href="/arguments"
            className="flex-shrink-0 mt-1 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            aria-label="Back to arguments"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-5 w-5 text-purple flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">Discussions</h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              Arguments generating the most conversation — find the threads worth joining
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex-shrink-0 mt-1 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Sort Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {SORTS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-colors flex-shrink-0',
                  sort === s.id
                    ? 'bg-purple text-white'
                    : 'bg-surface-200 border border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Side filter */}
          <div className="flex bg-surface-200 rounded-lg border border-surface-300 overflow-hidden">
            {SIDES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSide(s.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono font-semibold transition-colors',
                  side === s.id
                    ? s.id === 'for'
                      ? 'bg-for-600 text-white'
                      : s.id === 'against'
                        ? 'bg-against-600 text-white'
                        : 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Days filter */}
          <div className="flex bg-surface-200 rounded-lg border border-surface-300 overflow-hidden">
            {DAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDays(d.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono font-semibold transition-colors',
                  days === d.id
                    ? 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((o) => !o)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors border',
                category
                  ? 'bg-purple/10 border-purple/30 text-purple'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {category || 'All categories'}
              <ChevronDown className="h-3 w-3" />
            </button>

            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 top-10 z-20 w-44 rounded-xl bg-surface-100 border border-surface-300 shadow-xl shadow-black/40 overflow-hidden"
                >
                  {CATEGORIES.map((c) => (
                    <button
                      key={c || '__all'}
                      type="button"
                      onClick={() => { setCategory(c); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === c
                          ? 'bg-purple/20 text-purple'
                          : 'text-surface-600 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {c || 'All categories'}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Stats bar */}
        {data && !loading && (
          <div className="flex items-center gap-3 mb-4 text-xs font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {data.total.toLocaleString()} arguments with replies
            </span>
            {activeSort && (
              <>
                <span className="text-surface-600">·</span>
                <span className="flex items-center gap-1">
                  <activeSort.icon className="h-3.5 w-3.5" />
                  sorted by {activeSort.label.toLowerCase()}
                </span>
              </>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <p className="text-surface-500 font-mono text-sm">{error}</p>
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : data?.arguments.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No discussions yet"
            description="Be the first to start a reply conversation on an argument."
            action={{ label: 'Browse arguments', href: '/arguments' }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {data?.arguments.map((arg, i) => (
                <motion.div
                  key={arg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ArgumentCard arg={arg} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Browse more */}
        {data && data.arguments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-mono text-surface-500">
                Showing {data.arguments.length} of {data.total.toLocaleString()} discussed arguments
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/arguments"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                All arguments
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/arguments/contested"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple/10 border border-purple/30 text-xs font-mono text-purple hover:bg-purple/20 transition-colors"
              >
                Most contested
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
