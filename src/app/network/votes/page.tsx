'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkVoteEvent, NetworkVotesResponse } from '@/app/api/network/votes/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VoteSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
    </div>
  )
}

// ─── Vote card ────────────────────────────────────────────────────────────────

function VoteCard({ event }: { event: NetworkVoteEvent }) {
  const isFor = event.side === 'blue'
  const forPct = Math.round(event.topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors overflow-hidden"
    >
      {/* Side accent stripe */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px]',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3 pl-2">
        {/* Actor avatar */}
        <Link
          href={`/profile/${event.actor.username}`}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          aria-label={`View ${event.actor.display_name ?? event.actor.username}'s profile`}
        >
          <Avatar
            src={event.actor.avatar_url}
            fallback={event.actor.display_name ?? event.actor.username}
            size="sm"
          />
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/profile/${event.actor.username}`}
              className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors truncate max-w-[120px]"
            >
              {event.actor.display_name ?? event.actor.username}
            </Link>
            <span className="text-xs font-mono text-surface-500">voted</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-md',
                isFor
                  ? 'bg-for-600/20 text-for-400 border border-for-500/30'
                  : 'bg-against-600/20 text-against-400 border border-against-500/30'
              )}
            >
              {isFor ? (
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ThumbsDown className="h-3 w-3" aria-hidden="true" />
              )}
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[11px] font-mono text-surface-600 ml-auto">
              {relativeTime(event.voted_at)}
            </span>
          </div>

          {/* Topic */}
          <Link
            href={`/topic/${event.topic.id}`}
            className="block text-sm font-mono text-surface-300 line-clamp-2 hover:text-white transition-colors leading-relaxed"
          >
            {event.topic.statement}
          </Link>

          {/* Topic meta row */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {event.topic.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {event.topic.category}
              </span>
            )}
            <Badge variant={STATUS_BADGE[event.topic.status] ?? 'proposed'}>
              {event.topic.status}
            </Badge>
            <span className="text-[11px] font-mono text-surface-600 flex items-center gap-1">
              <span className="text-for-400">{forPct}%</span>
              <span className="text-surface-700">/</span>
              <span className="text-against-400">{againstPct}%</span>
            </span>
          </div>

          {/* Inline vote bar */}
          <div className="mt-2 h-1 rounded-full overflow-hidden bg-surface-300" aria-hidden="true">
            <div
              className="h-full bg-for-500 float-left rounded-l-full"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-against-500 float-left rounded-r-full"
              style={{ width: `${againstPct}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkVotesPage() {
  const router = useRouter()
  const [votes, setVotes] = useState<NetworkVoteEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [followingCount, setFollowingCount] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchVotes = useCallback(async (resetCursor?: boolean) => {
    const params = new URLSearchParams({ limit: '40' })
    if (!resetCursor && cursor) params.set('cursor', cursor)

    try {
      const res = await fetch(`/api/network/votes?${params}`)
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')

      const data: NetworkVotesResponse = await res.json()

      if (resetCursor) {
        setVotes(data.votes)
      } else {
        setVotes((prev) => [...prev, ...data.votes])
      }

      setIsEmpty(data.is_empty)
      setFollowingCount(data.following_count)
      setCursor(data.cursor)
      setHasMore(data.cursor !== null)
    } catch {
      // network error — leave existing state
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [cursor, router])

  useEffect(() => {
    fetchVotes(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loadingMore) return
    const el = loadMoreRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLoadingMore(true)
          fetchVotes()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, fetchVotes])

  const handleRefresh = () => {
    setLoading(true)
    setCursor(null)
    setHasMore(false)
    fetchVotes(true)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-surface-300 bg-surface-100 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-600/10 border border-for-500/20">
              <Vote className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Network Votes
              </h1>
              {followingCount > 0 && !loading && (
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/network"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Activity
            </Link>
            <span className="text-surface-700">·</span>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300 bg-surface-100 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex flex-wrap items-center gap-1 p-1 rounded-xl bg-surface-100 border border-surface-300 w-fit">
          <Link
            href="/network"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Activity
          </Link>
          <Link
            href="/network/topics"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Topics
          </Link>
          <span className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-surface-200 border border-surface-300 text-white">
            Votes
          </span>
          <Link
            href="/network/achievements"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Achievements
          </Link>
          <Link
            href="/network/arguments"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Arguments
          </Link>
          <Link
            href="/network/debates"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Debates
          </Link>
          <Link
            href="/network/laws"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Laws
          </Link>
          <Link
            href="/network/people"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            People
          </Link>
          <Link
            href="/network/coalitions"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Coalitions
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <VoteSkeleton key={i} />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Users}
            iconColor="text-for-400/60"
            iconBg="bg-for-600/10"
            iconBorder="border-for-500/20"
            title={
              followingCount === 0
                ? 'Follow people to see their votes'
                : 'No votes from your network yet'
            }
            description={
              followingCount === 0
                ? 'When you follow civic participants, their recent votes will appear here.'
                : "The people you follow haven't voted recently. Check back soon."
            }
            actions={[
              { label: 'Find People', href: '/discover', icon: Users },
              { label: 'Browse Feed', href: '/', variant: 'secondary' },
            ]}
            size="lg"
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {votes.map((event) => (
                <VoteCard key={event.id} event={event} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more sentinel */}
        {!loading && !isEmpty && (
          <div ref={loadMoreRef} className="mt-6 flex items-center justify-center h-10">
            {loadingMore ? (
              <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
            ) : hasMore ? (
              <span className="text-xs font-mono text-surface-600">Scroll for more</span>
            ) : (
              <span className="text-xs font-mono text-surface-700">All caught up</span>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
