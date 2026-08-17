'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Mic,
  Radio,
  RefreshCw,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  NetworkDebateItem,
  NetworkDebateRelation,
  NetworkDebatesResponse,
} from '@/app/api/network/debates/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const past = diff < 0
  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return past ? 'just now' : 'starting now'
  if (m < 60) return past ? `${m}m ago` : `in ${m}m`
  if (h < 24) return past ? `${h}h ago` : `in ${h}h`
  if (d < 7) return past ? `${d}d ago` : `in ${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const RELATION_CONFIG: Record<
  NetworkDebateRelation,
  { verb: string; icon: typeof Mic; color: string }
> = {
  speaker: { verb: 'is debating', icon: Mic, color: 'text-against-400' },
  creator: { verb: 'scheduled a debate', icon: Calendar, color: 'text-for-400' },
  rsvp: { verb: 'RSVPed to', icon: Users, color: 'text-purple' },
}

const DEBATE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; pulse?: boolean }
> = {
  live: { label: 'LIVE', color: 'text-against-300', bg: 'bg-against-500/10', pulse: true },
  scheduled: { label: 'UPCOMING', color: 'text-for-300', bg: 'bg-for-500/10' },
  ended: { label: 'ENDED', color: 'text-surface-400', bg: 'bg-surface-300/20' },
}

const TYPE_LABELS: Record<string, string> = {
  quick: '15m · Quick',
  grand: '45m · Grand',
  tribunal: '60m · Tribunal',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DebateSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function NetworkDebateCard({ item }: { item: NetworkDebateItem }) {
  const rel = RELATION_CONFIG[item.relation]
  const RelIcon = rel.icon
  const statusCfg = DEBATE_STATUS_CONFIG[item.debate_status] ?? DEBATE_STATUS_CONFIG.scheduled
  const topicStatus = STATUS_BADGE[item.topic.status] ?? 'proposed'
  const isLive = item.debate_status === 'live'
  const isEnded = item.debate_status === 'ended'

  const href = isEnded
    ? `/debate/${item.debate_id}/recap`
    : `/debate/${item.debate_id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200/40 transition-colors"
    >
      {/* Actor avatar */}
      <Link href={`/profile/${item.actor.username}`} className="flex-shrink-0 mt-0.5">
        <Avatar
          src={item.actor.avatar_url}
          fallback={item.actor.display_name ?? item.actor.username}
          size="sm"
        />
      </Link>

      <div className="flex-1 min-w-0">
        {/* Actor + relation */}
        <p className="text-xs font-mono text-surface-400 mb-1.5">
          <Link
            href={`/profile/${item.actor.username}`}
            className="font-semibold text-white hover:text-for-300 transition-colors"
          >
            {item.actor.display_name ?? item.actor.username}
          </Link>
          {' '}
          <span className={rel.color}>
            <RelIcon className="inline h-3 w-3 mb-0.5" aria-hidden="true" />
            {' '}{rel.verb}
          </span>
        </p>

        {/* Debate title */}
        <Link href={href} className="group block mb-1.5">
          <p className="text-sm font-mono font-medium text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
            {item.debate_title}
          </p>
        </Link>

        {/* Topic */}
        <Link
          href={`/topic/${item.topic.id}`}
          className="block text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors mb-3 line-clamp-1"
        >
          Re: {item.topic.statement}
        </Link>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live / Upcoming / Ended badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider',
              statusCfg.color,
              statusCfg.bg
            )}
          >
            {statusCfg.pulse && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-against-500" />
              </span>
            )}
            {statusCfg.label}
          </span>

          {/* Type */}
          {TYPE_LABELS[item.debate_type] && (
            <span className="text-[10px] font-mono text-surface-500">
              {TYPE_LABELS[item.debate_type]}
            </span>
          )}

          {/* Category */}
          {item.topic.category && (
            <Badge variant={topicStatus} className="text-[10px] py-0 h-5">
              {item.topic.category}
            </Badge>
          )}

          {/* Time */}
          <span className="text-[10px] font-mono text-surface-500 ml-auto">
            {isLive ? (
              <span className="text-against-300 font-semibold">Happening now</span>
            ) : (
              relativeTime(item.scheduled_at)
            )}
          </span>
        </div>

        {/* Sway bar for ended debates */}
        {isEnded && (item.blue_sway > 0 || item.red_sway > 0) && (
          <div className="mt-3">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
              {item.blue_sway > 0 && (
                <div
                  className="bg-for-500 transition-all"
                  style={{
                    width: `${Math.round((item.blue_sway / (item.blue_sway + item.red_sway)) * 100)}%`,
                  }}
                />
              )}
              {item.red_sway > 0 && (
                <div
                  className="bg-against-500 transition-all"
                  style={{
                    width: `${Math.round((item.red_sway / (item.blue_sway + item.red_sway)) * 100)}%`,
                  }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-mono text-for-400">
                For {Math.round((item.blue_sway / (item.blue_sway + item.red_sway)) * 100)}%
              </span>
              <span className="text-[10px] font-mono text-against-400">
                Against {Math.round((item.red_sway / (item.blue_sway + item.red_sway)) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NetworkDebatesPage() {
  const router = useRouter()
  const [debates, setDebates] = useState<NetworkDebateItem[]>([])
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [notLoggedIn, setNotLoggedIn] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const fetchDebates = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/network/debates?limit=30')

      if (res.status === 401) {
        if (isMounted.current) {
          setNotLoggedIn(true)
          setLoading(false)
          setRefreshing(false)
        }
        return
      }

      const data: NetworkDebatesResponse = await res.json()
      if (!isMounted.current) return

      setDebates(data.debates)
      setFollowingCount(data.following_count)
      setIsEmpty(data.is_empty)
      setCursor(data.cursor)
    } catch {
      // silently fail
    } finally {
      if (isMounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchDebates()
  }, [fetchDebates])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/network/debates?limit=30&cursor=${encodeURIComponent(cursor)}`)
      const data: NetworkDebatesResponse = await res.json()
      if (!isMounted.current) return
      setDebates((prev) => [...prev, ...data.debates])
      setCursor(data.cursor)
    } catch {
      // silently fail
    } finally {
      if (isMounted.current) setLoadingMore(false)
    }
  }, [cursor, loadingMore])

  if (notLoggedIn) {
    router.replace('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/network"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Back to network feed"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-against-400" aria-hidden="true" />
                <h1 className="font-mono text-xl font-bold text-white">Network Debates</h1>
              </div>
              {followingCount > 0 && (
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Debates from {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchDebates(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 mb-4 rounded-xl bg-surface-100 border border-surface-300 w-fit">
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
          <Link
            href="/network/votes"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Votes
          </Link>
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
          <span className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-surface-200 border border-surface-300 text-white">
            Debates
          </span>
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
        </div>

        {/* Feed */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <DebateSkeleton key={i} />)
            ) : isEmpty && followingCount === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={Users}
                  iconColor="text-for-400/60"
                  iconBg="bg-for-600/10"
                  iconBorder="border-for-500/20"
                  title="Follow people to see their debates"
                  description="When you follow other members of the Lobby, their debates will appear here."
                  actions={[
                    { label: 'Find people', href: '/search?tab=people', icon: Users },
                    { label: 'Browse debates', href: '/debate', icon: Swords, variant: 'secondary' },
                  ]}
                  size="lg"
                />
              </div>
            ) : isEmpty ? (
              <div className="py-4">
                <EmptyState
                  icon={Swords}
                  iconColor="text-against-400/60"
                  iconBg="bg-against-600/10"
                  iconBorder="border-against-500/20"
                  title="No recent debates in your network"
                  description="The people you follow haven't participated in any debates in the last 30 days."
                  actions={[
                    { label: 'Browse all debates', href: '/debate', icon: Swords },
                    { label: 'Schedule a debate', href: '/debate/create', icon: Calendar, variant: 'secondary' },
                  ]}
                  size="lg"
                />
              </div>
            ) : (
              debates.map((item) => (
                <NetworkDebateCard key={item.id} item={item} />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Load more */}
        {cursor && !loading && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {loadingMore ? 'Loading…' : 'Load more debates'}
            </button>
          </div>
        )}

        {/* Footer links */}
        {!loading && !isEmpty && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-center gap-6">
            <Link
              href="/debate"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              All debates
            </Link>
            <Link
              href="/debate/create"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              Schedule one
            </Link>
            <Link
              href="/debate/my-schedule"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              My schedule
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
