'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Swords,
  UserPlus,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkCoalitionItem, NetworkCoalitionsResponse } from '@/app/api/network/coalitions/route'

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

function formatInfluence(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const ROLE_CONFIG = {
  leader:  { label: 'Leader',  color: 'text-gold',     bg: 'bg-gold/10',     icon: Crown },
  officer: { label: 'Officer', color: 'text-purple',   bg: 'bg-purple/10',   icon: Shield },
  member:  { label: 'Member',  color: 'text-for-400',  bg: 'bg-for-500/10',  icon: Users },
} as const

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
    { label: 'People',       href: '/network/people' },
    { label: 'Coalitions',   href: '/network/coalitions' },
    { label: 'Predictions',  href: '/network/predictions' },
    { label: 'Relays',       href: '/network/relays' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 mb-5 rounded-xl bg-surface-100 border border-surface-300 w-fit">
      {tabs.map((t) =>
        t.href === active ? (
          <span
            key={t.href}
            className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-surface-200 border border-surface-300 text-white"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            {t.label}
          </Link>
        ),
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CoalitionSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-surface-300/60 last:border-0">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <div className="rounded-xl border border-surface-300 p-3 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Coalition card ───────────────────────────────────────────────────────────

function CoalitionRow({ item, index }: { item: NetworkCoalitionItem; index: number }) {
  const roleCfg = ROLE_CONFIG[item.member_role] ?? ROLE_CONFIG.member
  const RoleIcon = roleCfg.icon
  const winRate =
    item.coalition.wins + item.coalition.losses > 0
      ? Math.round((item.coalition.wins / (item.coalition.wins + item.coalition.losses)) * 100)
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      className="flex items-start gap-3 p-4 border-b border-surface-300/50 last:border-0"
    >
      {/* Actor avatar */}
      <Link
        href={`/profile/${item.actor.username}`}
        className="flex-shrink-0 mt-0.5"
        aria-label={`View @${item.actor.username}`}
      >
        <Avatar
          src={item.actor.avatar_url}
          fallback={item.actor.display_name || item.actor.username}
          size="sm"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Actor + verb + time */}
        <div className="flex items-baseline gap-1.5 flex-wrap mb-2">
          <Link
            href={`/profile/${item.actor.username}`}
            className="text-sm font-semibold text-white hover:text-for-400 transition-colors"
          >
            {item.actor.display_name || item.actor.username}
          </Link>
          <span className="text-xs text-surface-500">
            {item.member_role === 'leader' ? 'founded' : 'joined'}
          </span>
          {/* Member role pill */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider',
              roleCfg.color, roleCfg.bg,
            )}
          >
            <RoleIcon className="h-2.5 w-2.5" aria-hidden="true" />
            {roleCfg.label}
          </span>
          <span className="text-xs text-surface-600 ml-auto">{relativeTime(item.joined_at)}</span>
        </div>

        {/* Coalition card */}
        <Link
          href={`/coalitions/${item.coalition.id}`}
          className="group block rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-for-500/40 hover:bg-for-950/20 transition-all"
        >
          {/* Name row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-for-600/10 border border-for-500/20 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-white truncate group-hover:text-for-400 transition-colors">
                {item.coalition.name}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          {/* Description */}
          {item.coalition.description && (
            <p className="text-xs text-surface-500 line-clamp-2 mb-2.5 leading-relaxed">
              {item.coalition.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Members */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" aria-hidden="true" />
              <span>{item.coalition.member_count.toLocaleString()} member{item.coalition.member_count !== 1 ? 's' : ''}</span>
            </div>

            {/* Influence */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-gold">
              <Coins className="h-3 w-3" aria-hidden="true" />
              <span>{formatInfluence(item.coalition.coalition_influence)} influence</span>
            </div>

            {/* Win rate */}
            {winRate !== null && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald">
                <Swords className="h-3 w-3" aria-hidden="true" />
                <span>{winRate}% win rate</span>
              </div>
            )}

            {/* Creator */}
            {item.coalition.creator && item.coalition.creator.id !== item.actor.id && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-surface-600 ml-auto">
                <span>by</span>
                <span className="text-surface-500">@{item.coalition.creator.username}</span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkCoalitionsPage() {
  const router = useRouter()
  const [items, setItems] = useState<NetworkCoalitionItem[]>([])
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [notAuthed, setNotAuthed] = useState(false)
  const loadedRef = useRef(false)

  const fetchItems = useCallback(async (c: string | null = null, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '30' })
      if (c) params.set('cursor', c)
      const res = await fetch(`/api/network/coalitions?${params}`)
      if (res.status === 401) { setNotAuthed(true); return }
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as NetworkCoalitionsResponse

      if (append) {
        setItems((prev) => [...prev, ...data.items])
      } else {
        setItems(data.items)
        setFollowingCount(data.following_count)
        setIsEmpty(data.is_empty)
      }
      setCursor(data.cursor)
      setHasMore(data.cursor !== null)
    } catch {
      // keep current state
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      fetchItems()
    }
  }, [fetchItems])

  if (notAuthed) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-0 sm:px-4 pt-4 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-0 mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Users className="h-5 w-5 text-for-400" aria-hidden="true" />
              Network Coalitions
            </h1>
            {!loading && followingCount > 0 && (
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Coalitions joined by {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
              </p>
            )}
          </div>
          <button
            onClick={() => { loadedRef.current = false; fetchItems() }}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-4 sm:px-0">
          <NetworkTabs active="/network/coalitions" />
        </div>

        {/* Feed card */}
        <div className="bg-surface-100 border border-surface-300 sm:rounded-2xl overflow-hidden">

          {/* Loading */}
          {loading && (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <CoalitionSkeleton key={i} />
              ))}
            </div>
          )}

          {/* No follows */}
          {!loading && isEmpty && followingCount === 0 && (
            <div className="py-4">
              <EmptyState
                icon={UserPlus}
                iconColor="text-for-400/60"
                iconBg="bg-for-600/10"
                iconBorder="border-for-500/20"
                title="Follow people to discover coalitions"
                description="When you follow civic voices, the coalitions they join or lead will appear here."
                actions={[
                  { label: 'Find people', href: '/search?tab=people', icon: Users },
                  { label: 'Browse coalitions', href: '/coalitions', icon: Activity, variant: 'secondary' },
                ]}
                size="lg"
              />
            </div>
          )}

          {/* Following but no activity */}
          {!loading && isEmpty && followingCount > 0 && (
            <div className="py-4">
              <EmptyState
                icon={Users}
                iconColor="text-surface-500"
                iconBg="bg-surface-300/30"
                iconBorder="border-surface-400/20"
                title="No coalition activity yet"
                description="None of the people you follow have joined coalitions recently."
                actions={[
                  { label: 'Browse coalitions', href: '/coalitions', icon: Users },
                  { label: 'Find more people', href: '/search?tab=people', icon: UserPlus, variant: 'secondary' },
                ]}
                size="md"
              />
            </div>
          )}

          {/* Results */}
          {!loading && items.length > 0 && (
            <AnimatePresence initial={false}>
              {items.map((item, i) => (
                <CoalitionRow key={item.join_id} item={item} index={i} />
              ))}
            </AnimatePresence>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <div className="flex justify-center py-4 border-t border-surface-300/50">
              <button
                onClick={() => fetchItems(cursor, true)}
                disabled={loadingMore}
                className={cn(
                  'flex items-center gap-2 h-9 px-5 rounded-xl text-xs font-mono font-medium',
                  'bg-surface-200 border border-surface-300 text-surface-400',
                  'hover:border-surface-400 hover:text-white transition-colors',
                  'disabled:opacity-50',
                )}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Load more
                  </>
                )}
              </button>
            </div>
          )}

          {/* Refresh indicator */}
          {loading && items.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-surface-300">
              <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin" aria-hidden="true" />
              <span className="text-xs font-mono text-surface-500">Refreshing…</span>
            </div>
          )}
        </div>

        {/* Footer note */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-4 sm:px-0">
            <p className="text-[11px] font-mono text-surface-600">
              Coalition memberships from your network
            </p>
            <Link
              href="/coalitions"
              className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Browse all
              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
