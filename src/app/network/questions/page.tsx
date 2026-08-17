'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  NetworkQuestionItem,
  NetworkQuestionsResponse,
} from '@/app/api/network/questions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  senator:      { label: 'Senator',      color: 'text-purple border-purple/40 bg-purple/10' },
  elder:        { label: 'Elder',        color: 'text-gold border-gold/40 bg-gold/10' },
  lawmaker:     { label: 'Lawmaker',     color: 'text-gold border-gold/40 bg-gold/20' },
  debator:      { label: 'Debator',      color: 'text-for-400 border-for-500/40 bg-for-500/10' },
  troll_catcher:{ label: 'Catcher',      color: 'text-emerald border-emerald/40 bg-emerald/10' },
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-for-400',
  voting: 'bg-purple',
  law:    'bg-gold',
  proposed: 'bg-surface-400',
  failed: 'bg-against-400',
}

// ─── Network tab bar ──────────────────────────────────────────────────────────

const TABS = [
  { label: 'Feed',         href: '/network' },
  { label: 'Topics',       href: '/network/topics' },
  { label: 'Votes',        href: '/network/votes' },
  { label: 'Arguments',    href: '/network/arguments' },
  { label: 'Questions',    href: '/network/questions' },
  { label: 'Debates',      href: '/network/debates' },
  { label: 'Laws',         href: '/network/laws' },
  { label: 'Predictions',  href: '/network/predictions' },
  { label: 'Relays',       href: '/network/relays' },
  { label: 'Achievements', href: '/network/achievements' },
  { label: 'Coalitions',   href: '/network/coalitions' },
  { label: 'People',       href: '/network/people' },
]

// ─── QuestionCard ─────────────────────────────────────────────────────────────

function QuestionCard({ item }: { item: NetworkQuestionItem }) {
  const isAsked = item.event_type === 'asked'
  const dot = STATUS_DOT[item.topic.status] ?? 'bg-surface-400'
  const roleBadge = ROLE_BADGE[item.actor.role]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/topic/${item.topic.id}?tab=qa`}
        className="flex gap-3 px-4 py-4 hover:bg-surface-200/50 transition-colors group"
      >
        {/* Actor avatar */}
        <Link
          href={`/profile/${item.actor.username}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 mt-0.5"
        >
          <Avatar
            src={item.actor.avatar_url}
            fallback={item.actor.display_name ?? item.actor.username}
            size="sm"
          />
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Actor + action */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
            <Link
              href={`/profile/${item.actor.username}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-white hover:text-for-300 transition-colors"
            >
              {item.actor.display_name ?? item.actor.username}
            </Link>
            {roleBadge && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', roleBadge.color)}>
                {roleBadge.label}
              </span>
            )}
            <span className="text-surface-500">
              {isAsked ? 'asked a question on' : 'answered a question on'}
            </span>
            {/* Topic inline */}
            <span className="flex items-center gap-1 text-surface-400">
              <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dot)} />
              <span className="truncate max-w-[180px]">{item.topic.statement}</span>
            </span>
          </div>

          {/* Question box */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 mb-2 group-hover:border-surface-400/60 transition-colors">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-surface-700 leading-snug line-clamp-3">
                {item.question_content}
              </p>
            </div>

            {/* Answer preview */}
            {item.answer_content && (
              <div className="mt-2 pt-2 border-t border-surface-300/60 flex items-start gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                <p className="text-xs text-surface-600 leading-snug line-clamp-2">
                  {item.answer_content}
                </p>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {item.question_upvotes}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {item.question_answer_count} answer{item.question_answer_count !== 1 ? 's' : ''}
            </span>
            {item.is_answered && (
              <span className="flex items-center gap-1 text-emerald">
                <CheckCircle2 className="h-3 w-3" />
                Answered
              </span>
            )}
            {item.topic.category && (
              <span className="text-surface-600">{item.topic.category}</span>
            )}
            <span className="ml-auto">{relativeTime(item.occurred_at)}</span>
          </div>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex gap-3 px-4 py-4">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'questions' | 'answers'

export default function NetworkQuestionsPage() {
  const router = useRouter()
  const [data, setData] = useState<NetworkQuestionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (reset = true) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (reset) {
      setLoading(true)
      setError(false)
      setData(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const cursor = reset ? '' : (data?.cursor ?? '')
      const params = new URLSearchParams({ filter, limit: '40' })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/network/questions?${params}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as NetworkQuestionsResponse

      setData((prev) =>
        reset
          ? json
          : {
              ...json,
              items: [...(prev?.items ?? []), ...json.items],
            },
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, data?.cursor, router])

  useEffect(() => {
    load(true)
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto pb-28">
        {/* Header */}
        <div className="sticky top-14 z-20 bg-surface-50/95 backdrop-blur-sm border-b border-surface-300/60 px-4 pt-4 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-mono text-lg font-bold text-white">Network · Questions</h1>
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Tab scroll */}
          <div className="flex gap-1 overflow-x-auto pb-0 no-scrollbar -mx-4 px-4">
            {TABS.map((tab) => {
              const isActive = tab.href === '/network/questions'
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'flex-shrink-0 px-3 py-2 text-xs font-mono font-medium transition-colors border-b-2',
                    isActive
                      ? 'text-for-400 border-for-500'
                      : 'text-surface-500 border-transparent hover:text-surface-700',
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>

          {/* Filter bar */}
          <div className="flex gap-1.5 py-3">
            {(['all', 'questions', 'answers'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  filter === f
                    ? f === 'questions'
                      ? 'bg-for-500/20 text-for-400 border-for-500/50'
                      : f === 'answers'
                      ? 'bg-emerald/20 text-emerald border-emerald/50'
                      : 'bg-surface-300 text-white border-surface-400'
                    : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                )}
              >
                {f === 'all' ? 'All' : f === 'questions' ? 'Questions' : 'Answers'}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="divide-y divide-surface-300/60">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
            <HelpCircle className="h-8 w-8 text-surface-500" />
            <p className="text-sm text-surface-500 font-mono">Failed to load network Q&A</p>
            <button
              onClick={() => load(true)}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Not following anyone */}
        {!loading && !error && data?.is_empty && data.following_count === 0 && (
          <div className="px-4 py-16">
            <EmptyState
              icon={HelpCircle}
              title="Follow people to see their questions"
              description="When you follow citizens, their Q&A activity on civic topics appears here."
              action={{ label: 'Find people to follow', href: '/search?tab=people' }}
            />
          </div>
        )}

        {/* No Q&A activity yet */}
        {!loading && !error && data?.is_empty && (data.following_count ?? 0) > 0 && (
          <div className="px-4 py-16">
            <EmptyState
              icon={HelpCircle}
              title="No questions yet"
              description="The people you follow haven't asked or answered any Q&A questions recently."
              action={{ label: 'Browse topics with Q&A', href: '/topics' }}
            />
          </div>
        )}

        {/* Items */}
        {!loading && !error && data && !data.is_empty && (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="divide-y divide-surface-300/60"
              >
                {data.items.map((item) => (
                  <QuestionCard key={item.item_id} item={item} />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Load more */}
            {data.cursor && (
              <div className="flex justify-center py-6">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
