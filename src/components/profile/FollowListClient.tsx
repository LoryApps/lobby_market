'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { cn } from '@/lib/utils/cn'
import type { FollowerEntry } from '@/app/api/profile/[username]/followers/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'followers' | 'following'

interface FollowListClientProps {
  username: string
  displayName: string | null
  avatarUrl: string | null
  followersCount: number
  followingCount: number
  initialTab: Tab
  viewerId: string | null
}

// ─── Follow row ───────────────────────────────────────────────────────────────

function FollowRow({
  user,
  viewerId,
}: {
  user: FollowerEntry
  viewerId: string | null
}) {
  const [following, setFollowing] = useState(user.isFollowing)
  const [toggling, setToggling] = useState(false)
  const [hovered, setHovered] = useState(false)

  async function toggle() {
    if (!viewerId) {
      window.location.href = '/login'
      return
    }
    if (toggling) return
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setToggling(true)
    try {
      const res = await fetch('/api/follow', {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: user.id }),
      })
      if (!res.ok) setFollowing(wasFollowing)
    } catch {
      setFollowing(wasFollowing)
    } finally {
      setToggling(false)
    }
  }

  const isSelf = viewerId === user.id

  let label: string
  let Icon: typeof UserPlus
  if (toggling) {
    label = following ? 'Following' : 'Follow'
    Icon = UserPlus
  } else if (following && hovered) {
    label = 'Unfollow'
    Icon = UserMinus
  } else if (following) {
    label = 'Following'
    Icon = UserCheck
  } else {
    label = 'Follow'
    Icon = UserPlus
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 py-3 px-0 border-b border-surface-300 last:border-0 hover:bg-surface-200/30 transition-colors -mx-1 px-1 rounded-lg"
    >
      <Link href={`/profile/${user.username}`} className="flex-shrink-0">
        <Avatar
          src={user.avatar_url}
          fallback={user.display_name || user.username}
          size="md"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${user.username}`}
          className="group flex items-center gap-2 flex-wrap"
        >
          <span className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
            {user.display_name || user.username}
          </span>
          <RoleBadge role={user.role} size="sm" />
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-surface-500 font-mono">
            @{user.username}
          </span>
          {user.clout > 0 && (
            <>
              <span className="text-surface-600" aria-hidden>·</span>
              <span className="flex items-center gap-0.5 text-xs text-gold font-mono">
                <TrendingUp className="h-2.5 w-2.5" aria-hidden />
                {user.clout.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      {isSelf ? (
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-500 px-2">
          You
        </span>
      ) : (
        <button
          onClick={toggle}
          disabled={toggling}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
            'border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-for-500/40',
            following && hovered
              ? 'border-against-500/50 text-against-400 bg-against-950/30 hover:bg-against-950/50'
              : following
              ? 'border-surface-400 text-surface-400 bg-surface-200 hover:bg-surface-300'
              : 'border-for-600 text-white bg-for-600 hover:bg-for-700'
          )}
          aria-label={`${label} ${user.display_name || user.username}`}
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Icon className="h-3 w-3" aria-hidden />
          )}
          {label}
        </button>
      )}
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-surface-300 last:border-0">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-20 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FollowListClient({
  username,
  displayName,
  avatarUrl,
  followersCount,
  followingCount,
  initialTab,
  viewerId,
}: FollowListClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [users, setUsers] = useState<FollowerEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean, currentTab: Tab) => {
      const params = new URLSearchParams({ type: currentTab })
      if (cursor) params.set('cursor', cursor)
      try {
        const res = await fetch(`/api/profile/${username}/followers?${params.toString()}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          users: FollowerEntry[]
          nextCursor: string | null
        }
        setUsers((prev) => append ? [...prev, ...(data.users ?? [])] : (data.users ?? []))
        setNextCursor(data.nextCursor ?? null)
      } catch {
        // non-fatal
      }
    },
    [username]
  )

  useEffect(() => {
    setUsers([])
    setNextCursor(null)
    setLoading(true)
    fetchPage(null, false, tab).finally(() => setLoading(false))
  }, [tab, fetchPage])

  function switchTab(newTab: Tab) {
    setTab(newTab)
    router.replace(`/profile/${username}/${newTab}`, { scroll: false })
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    await fetchPage(nextCursor, true, tab)
    setLoadingMore(false)
  }

  const name = displayName || username

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">

        {/* Back + header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push(`/profile/${username}`)}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to profile"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <Link href={`/profile/${username}`} className="flex items-center gap-2.5 min-w-0">
            <Avatar src={avatarUrl} fallback={name} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white font-mono truncate">@{username}</p>
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-300 mb-0">
          {(
            [
              { id: 'followers' as Tab, label: 'Followers', count: followersCount },
              { id: 'following' as Tab, label: 'Following', count: followingCount },
            ]
          ).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-mono font-semibold transition-colors',
                'border-b-2 -mb-px',
                tab === id
                  ? 'border-for-500 text-white'
                  : 'border-transparent text-surface-500 hover:text-surface-300'
              )}
            >
              {label}
              <span
                className={cn(
                  'text-xs font-mono px-1.5 py-0.5 rounded-full',
                  tab === id
                    ? 'bg-for-500/20 text-for-400'
                    : 'bg-surface-300 text-surface-500'
                )}
              >
                {count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="mt-1">
          {loading ? (
            <SkeletonRows />
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              iconColor="text-surface-500"
              iconBg="bg-surface-200"
              iconBorder="border-surface-300"
              title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              description={
                tab === 'followers'
                  ? `${name} hasn't been followed by anyone yet.`
                  : `${name} isn't following anyone yet.`
              }
              action={{ label: 'Back to profile', href: `/profile/${username}`, variant: 'secondary' }}
              size="md"
            />
          ) : (
            <>
              {users.map((u) => (
                <FollowRow key={u.id} user={u} viewerId={viewerId} />
              ))}

              {nextCursor && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
                      'bg-surface-200 border border-surface-300 text-surface-400',
                      'hover:bg-surface-300 hover:text-white transition-colors',
                      loadingMore && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Loading…</>
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
