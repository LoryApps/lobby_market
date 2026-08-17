'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Link2,
  Loader2,
  RefreshCw,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkRelayItem, NetworkRelaysResponse } from '@/app/api/network/relays/route'

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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const RELAY_STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    dot: 'bg-for-500 animate-pulse',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    dot: 'bg-purple animate-pulse',
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
    dot: 'bg-emerald',
  },
  voted: {
    label: 'Voted',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    dot: 'bg-gold',
  },
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function NetworkTabs({ active }: { active: string }) {
  const tabs = [
    { label: 'Activity',     href: '/network' },
    { label: 'Topics',       href: '/network/topics' },
    { label: 'Votes',        href: '/network/votes' },
    { label: 'Arguments',    href: '/network/arguments' },
    { label: 'Achievements', href: '/network/achievements' },
    { label: 'Debates',      href: '/network/debates' },
    { label: 'Laws',         href: '/network/laws' },
    { label: 'Relays',       href: '/network/relays' },
    { label: 'People',       href: '/network/people' },
    { label: 'Coalitions',   href: '/network/coalitions' },
    { label: 'Predictions',  href: '/network/predictions' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 mb-5 rounded-xl bg-surface-100 border border-surface-300 w-fit">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            'px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-colors',
            active === tab.label
              ? 'bg-surface-200 border border-surface-300 text-white'
              : 'text-surface-400 hover:text-white',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RelaySkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Relay card ───────────────────────────────────────────────────────────────

function RelayCard({ item }: { item: NetworkRelayItem }) {
  const isFor = item.side === 'for'
  const statusCfg = RELAY_STATUS_CONFIG[item.status] ?? RELAY_STATUS_CONFIG.open
  const totalVotes = item.vote_compelling + item.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((item.vote_compelling / totalVotes) * 100) : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-2xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors overflow-hidden"
    >
      {/* Side accent stripe */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-0.5',
          isFor ? 'bg-for-500/50' : 'bg-against-500/50',
        )}
        aria-hidden="true"
      />

      <div className="p-4 pl-5">
        {/* Header: starter + status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href={`/profile/${item.starter.username}`}
              className="flex-shrink-0"
              aria-label={`View ${item.starter.display_name ?? item.starter.username}'s profile`}
            >
              <Avatar
                src={item.starter.avatar_url}
                username={item.starter.username}
                size="sm"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={`/profile/${item.starter.username}`}
                  className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
                >
                  {item.starter.display_name ?? item.starter.username}
                </Link>
                <span className="text-xs text-surface-500 font-mono flex-shrink-0">
                  started a relay
                </span>
              </div>
              <p className="text-[11px] text-surface-600 font-mono mt-0.5">
                {relativeTime(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Side badge */}
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
                isFor
                  ? 'bg-for-600/20 text-for-400 border border-for-500/20'
                  : 'bg-against-600/20 text-against-400 border border-against-500/20',
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>

            {/* Status indicator */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                statusCfg.bg,
                statusCfg.color,
                statusCfg.border,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusCfg.dot)} />
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Topic */}
        {item.topic && (
          <Link
            href={`/topic/${item.topic.id}`}
            className="block mb-3 group/topic"
            aria-label={`View topic: ${item.topic.statement}`}
          >
            <p className="text-sm font-medium text-white group-hover/topic:text-for-300 transition-colors leading-snug line-clamp-2">
              {item.topic.statement}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {item.topic.category && (
                <Badge variant="proposed" className="text-[10px] font-mono">
                  {item.topic.category}
                </Badge>
              )}
              <Badge variant={STATUS_BADGE[item.topic.status] ?? 'proposed'} className="text-[10px] font-mono">
                {item.topic.status === 'law' ? 'LAW' : item.topic.status}
              </Badge>
              {item.topic.total_votes > 0 && (
                <span className="text-[10px] font-mono text-surface-600">
                  {item.topic.total_votes.toLocaleString()} votes
                </span>
              )}
            </div>
          </Link>
        )}

        {/* Legs preview */}
        {item.legs.length > 0 && (
          <div className="space-y-2 mb-3">
            {item.legs.slice(0, 3).map((leg) => (
              <div
                key={leg.id}
                className="flex items-start gap-2.5 bg-surface-200/50 rounded-xl p-2.5"
              >
                <span className={cn(
                  'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-mono font-bold mt-0.5',
                  isFor ? 'bg-for-600/20 text-for-400' : 'bg-against-600/20 text-against-400',
                )}>
                  {leg.leg_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-300 leading-snug line-clamp-2">
                    {leg.content}
                  </p>
                  {leg.author && (
                    <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                      — {leg.author.display_name ?? leg.author.username}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {item.legs.length > 3 && (
              <p className="text-[11px] font-mono text-surface-600 pl-2">
                +{item.legs.length - 3} more {item.legs.length - 3 === 1 ? 'leg' : 'legs'}
              </p>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-600">
              {item.leg_count} / {item.max_legs} legs
            </span>
            {(item.status === 'complete' || item.status === 'voted') && totalVotes > 0 && (
              <span className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
                <ThumbsUp className="h-3 w-3 text-emerald" />
                {compellingPct}% compelling
                <span className="text-surface-700">·</span>
                <Users className="h-3 w-3 text-surface-500" />
                {totalVotes}
              </span>
            )}
          </div>
          <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isFor ? 'bg-for-500' : 'bg-against-500',
              )}
              style={{ width: `${Math.round((item.leg_count / item.max_legs) * 100)}%` }}
            />
          </div>
        </div>

        {/* Footer: CTA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
            <Link2 className="h-3 w-3" aria-hidden="true" />
            <span>Relay chain</span>
          </div>
          <Link
            href={`/relay/${item.id}`}
            className={cn(
              'flex items-center gap-1 text-xs font-mono font-semibold transition-colors',
              item.status === 'open'
                ? 'text-for-400 hover:text-for-300'
                : item.status === 'in_progress'
                  ? 'text-purple hover:text-purple/80'
                  : 'text-surface-400 hover:text-white',
            )}
            aria-label="View full relay"
          >
            {item.status === 'open'
              ? 'Join relay'
              : item.status === 'in_progress'
                ? 'Add your leg'
                : 'View relay'}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkRelaysPage() {
  const router = useRouter()
  const [items, setItems] = useState<NetworkRelayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [followingCount, setFollowingCount] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchRelays = useCallback(
    async (resetCursor?: boolean) => {
      const params = new URLSearchParams({ limit: '20' })
      if (!resetCursor && cursor) params.set('cursor', cursor)

      try {
        const res = await fetch(`/api/network/relays?${params}`)
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error('Failed to load')

        const data: NetworkRelaysResponse = await res.json()

        if (resetCursor) {
          setItems(data.relays)
        } else {
          setItems((prev) => [...prev, ...data.relays])
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
        setRefreshing(false)
      }
    },
    [cursor, router]
  )

  useEffect(() => {
    fetchRelays(true)
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
          fetchRelays()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, fetchRelays])

  const handleRefresh = () => {
    setRefreshing(true)
    setLoading(true)
    setCursor(null)
    setHasMore(false)
    fetchRelays(true)
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
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/20">
              <Link2 className="h-5 w-5 text-purple" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Network Relays
              </h1>
              {followingCount > 0 && !loading && (
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Relays from {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-surface-300 bg-surface-100 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            aria-label="Refresh relays"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <NetworkTabs active="Relays" />

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <RelaySkeleton key={i} />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={<Link2 className="h-8 w-8 text-surface-500" />}
            title="No relays yet"
            description={
              followingCount === 0
                ? 'Follow people to see their collaborative relay chains here.'
                : 'None of the people you follow have started a relay chain yet.'
            }
            action={
              followingCount === 0
                ? { label: 'Discover people', href: '/network/people' }
                : { label: 'Browse all relays', href: '/relay' }
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {items.map((item) => (
                <RelayCard key={item.id} item={item} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center pt-6">
            {loadingMore && (
              <Loader2 className="h-5 w-5 text-surface-500 animate-spin" aria-label="Loading more relays" />
            )}
          </div>
        )}

        {/* All caught up */}
        {!loading && !hasMore && items.length > 0 && (
          <p className="text-center text-xs font-mono text-surface-700 mt-6 flex items-center justify-center gap-2">
            <Zap className="h-3.5 w-3.5 text-for-500" aria-hidden="true" />
            All caught up
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
