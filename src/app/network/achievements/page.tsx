'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trophy,
  Users,
  Sparkles,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  NetworkAchievementItem,
  NetworkAchievementsResponse,
} from '@/app/api/network/achievements/route'

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

type Tier = 'common' | 'rare' | 'epic' | 'legendary'

const TIER_STYLES: Record<
  Tier,
  { label: string; iconBg: string; iconBorder: string; iconColor: string; glow: string; badge: string }
> = {
  legendary: {
    label: 'Legendary',
    iconBg: 'bg-gold/15',
    iconBorder: 'border-gold/40',
    iconColor: 'text-gold',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.2)]',
    badge: 'bg-gold/15 text-gold border-gold/30',
  },
  epic: {
    label: 'Epic',
    iconBg: 'bg-purple/15',
    iconBorder: 'border-purple/40',
    iconColor: 'text-purple',
    glow: 'shadow-[0_0_12px_rgba(139,92,246,0.2)]',
    badge: 'bg-purple/15 text-purple border-purple/30',
  },
  rare: {
    label: 'Rare',
    iconBg: 'bg-for-500/15',
    iconBorder: 'border-for-500/40',
    iconColor: 'text-for-400',
    glow: '',
    badge: 'bg-for-500/15 text-for-400 border-for-500/30',
  },
  common: {
    label: 'Common',
    iconBg: 'bg-surface-200/60',
    iconBorder: 'border-surface-400/30',
    iconColor: 'text-surface-400',
    glow: '',
    badge: 'bg-surface-200/60 text-surface-400 border-surface-400/30',
  },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AchievementSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
    </div>
  )
}

// ─── Achievement card ─────────────────────────────────────────────────────────

function AchievementCard({ item }: { item: NetworkAchievementItem }) {
  const tier = (item.achievement.tier ?? 'common') as Tier
  const styles = TIER_STYLES[tier] ?? TIER_STYLES.common
  const isHighTier = tier === 'legendary' || tier === 'epic'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative flex items-start gap-3 rounded-2xl border bg-surface-100 p-4 transition-all',
        isHighTier
          ? 'border-surface-300 hover:border-surface-400 ' + styles.glow
          : 'border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Actor avatar */}
      <Link
        href={`/profile/${item.actor.username}`}
        className="flex-shrink-0 mt-0.5"
        aria-label={`View ${item.actor.display_name ?? item.actor.username}'s profile`}
      >
        <Avatar
          src={item.actor.avatar_url}
          fallback={item.actor.display_name ?? item.actor.username}
          size="sm"
          className="ring-1 ring-surface-300 group-hover:ring-surface-400 transition-all"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Actor name + time */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <Link
            href={`/profile/${item.actor.username}`}
            className="text-xs font-mono font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {item.actor.display_name ?? item.actor.username}
          </Link>
          <span className="text-xs font-mono text-surface-500">earned an achievement</span>
          <span className="text-xs font-mono text-surface-600 ml-auto flex-shrink-0">
            {relativeTime(item.earned_at)}
          </span>
        </div>

        {/* Achievement name */}
        <p className={cn('text-sm font-semibold leading-snug', isHighTier ? styles.iconColor : 'text-white')}>
          {item.achievement.icon} {item.achievement.name}
        </p>

        {/* Achievement description */}
        <p className="text-xs text-surface-500 mt-0.5 leading-relaxed line-clamp-2">
          {item.achievement.description}
        </p>

        {/* Tier badge */}
        <div className="mt-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              styles.badge,
            )}
          >
            {tier === 'legendary' && <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />}
            {styles.label}
          </span>
        </div>
      </div>

      {/* Achievement icon tile */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl border text-2xl',
          styles.iconBg,
          styles.iconBorder,
          isHighTier && styles.glow,
        )}
        aria-hidden="true"
      >
        {item.achievement.icon}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkAchievementsPage() {
  const router = useRouter()
  const [achievements, setAchievements] = useState<NetworkAchievementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [followingCount, setFollowingCount] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchAchievements = useCallback(
    async (resetCursor?: boolean) => {
      const url = new URL('/api/network/achievements', window.location.origin)
      url.searchParams.set('limit', '30')
      if (!resetCursor && cursor) url.searchParams.set('cursor', cursor)

      try {
        const res = await fetch(url.toString())
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error('Failed to load')

        const data: NetworkAchievementsResponse = await res.json()

        if (resetCursor) {
          setAchievements(data.achievements)
        } else {
          setAchievements((prev) => [...prev, ...data.achievements])
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
    },
    [cursor, router],
  )

  useEffect(() => {
    fetchAchievements(true)
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
          fetchAchievements()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, fetchAchievements])

  const handleRefresh = () => {
    setLoading(true)
    setCursor(null)
    setHasMore(false)
    fetchAchievements(true)
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
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/20">
              <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Network Achievements
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
          <Link
            href="/network/votes"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Votes
          </Link>
          <span className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-surface-200 border border-surface-300 text-white">
            Achievements
          </span>
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
          <Link
            href="/network/predictions"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Predictions
          </Link>
          <Link
            href="/network/relays"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            Relays
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <AchievementSkeleton key={i} />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Trophy}
            iconColor="text-gold/60"
            iconBg="bg-gold/10"
            iconBorder="border-gold/20"
            title={
              followingCount === 0
                ? 'Follow people to see their achievements'
                : 'No achievements from your network yet'
            }
            description={
              followingCount === 0
                ? 'When you follow civic participants, their earned achievements will appear here.'
                : "The people you follow haven't earned achievements recently. Check back soon."
            }
            actions={[
              { label: 'Find People', href: '/discover', icon: Users },
              { label: 'Browse Achievements', href: '/achievements', variant: 'secondary' },
            ]}
            size="lg"
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {achievements.map((item) => (
                <AchievementCard key={item.id} item={item} />
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
