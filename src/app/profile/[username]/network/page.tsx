'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { cn } from '@/lib/utils/cn'
import type { FollowerEntry } from '@/app/api/profile/[username]/followers/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'followers' | 'following' | 'mutual'
type UserRole = 'person' | 'debator' | 'troll_catcher' | 'elder'

interface ProfileInfo {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  followers_count: number
  following_count: number
}

// ─── Follow row ───────────────────────────────────────────────────────────────

function UserRow({
  user,
  viewerId,
}: {
  user: FollowerEntry
  viewerId: string | null
}) {
  const [following, setFollowing] = useState(user.isFollowing)
  const [toggling, setToggling] = useState(false)

  const toggle = useCallback(async () => {
    if (!viewerId || toggling) return
    setToggling(true)
    const prev = following
    setFollowing(!prev)
    try {
      const res = await fetch('/api/follow', {
        method: prev ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: user.id }),
      })
      if (!res.ok) setFollowing(prev)
    } catch {
      setFollowing(prev)
    } finally {
      setToggling(false)
    }
  }, [following, toggling, user.id, viewerId])

  const isSelf = viewerId === user.id

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-300/50 last:border-0">
      <Link href={`/profile/${user.username}`} className="shrink-0">
        <Avatar
          src={user.avatar_url}
          username={user.username}
          size={40}
          className="w-10 h-10"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${user.username}`}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <span className="text-sm font-semibold text-surface-900 truncate">
            {user.display_name ?? user.username}
          </span>
          <RoleBadge role={user.role as UserRole} size="sm" />
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-surface-500">@{user.username}</span>
          <span className="text-surface-600">·</span>
          <span className="flex items-center gap-1 text-xs text-gold">
            <Zap className="w-3 h-3" />
            {user.clout.toLocaleString()}
          </span>
        </div>
      </div>

      {!isSelf && viewerId && (
        <button
          onClick={toggle}
          disabled={toggling}
          className={cn(
            'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            following
              ? 'bg-surface-200 border border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400 hover:bg-against-500/5'
              : 'bg-for-500/15 border border-for-500/30 text-for-400 hover:bg-for-500/25'
          )}
        >
          {toggling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : following ? (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              Following
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              Follow
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-300/50">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfileNetworkPage() {
  const params = useParams<{ username: string }>()
  const username = params.username

  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('followers')
  const [users, setUsers] = useState<FollowerEntry[]>([])
  const [mutualUsers, setMutualUsers] = useState<FollowerEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadingRef = useRef(false)

  // Load viewer auth state and profile
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setViewerId(user?.id ?? null)

      const res = await fetch(`/api/profile/${username}`)
      if (!res.ok) {
        setProfileLoading(false)
        return
      }
      const data = await res.json()
      setProfile(data.profile ?? null)
      setProfileLoading(false)
    }
    init()
  }, [username])

  // Fetch page of users (followers or following)
  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const type = tab === 'mutual' ? 'followers' : tab
        const p = new URLSearchParams({ type })
        if (cursor) p.set('cursor', cursor)
        const res = await fetch(`/api/profile/${username}/followers?${p}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: { users: FollowerEntry[]; nextCursor: string | null } = await res.json()

        const list = data.users ?? []
        if (append) {
          setUsers((prev) => [...prev, ...list])
        } else {
          setUsers(list)
        }
        setNextCursor(data.nextCursor ?? null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [tab, username]
  )

  // Fetch mutual connections: intersection of followers and following
  const fetchMutuals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [followersRes, followingRes] = await Promise.all([
        fetch(`/api/profile/${username}/followers?type=followers`),
        fetch(`/api/profile/${username}/followers?type=following`),
      ])
      if (!followersRes.ok || !followingRes.ok) throw new Error('Failed to load')
      const [followersData, followingData]: [
        { users: FollowerEntry[]; nextCursor: string | null },
        { users: FollowerEntry[]; nextCursor: string | null },
      ] = await Promise.all([followersRes.json(), followingRes.json()])

      const followingIds = new Set((followingData.users ?? []).map((u) => u.id))
      const mutuals = (followersData.users ?? []).filter((u) => followingIds.has(u.id))
      setMutualUsers(mutuals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [username])

  // Reload on tab change
  useEffect(() => {
    setUsers([])
    setMutualUsers([])
    setNextCursor(null)
    if (tab === 'mutual') {
      fetchMutuals()
    } else {
      fetchPage(null, false)
    }
  }, [tab, fetchPage, fetchMutuals])

  const displayedUsers = tab === 'mutual' ? mutualUsers : users

  const TABS: { id: Tab; label: string; count?: number }[] = [
    {
      id: 'followers',
      label: 'Followers',
      count: profile?.followers_count,
    },
    {
      id: 'following',
      label: 'Following',
      count: profile?.following_count,
    },
    { id: 'mutual', label: 'Mutual' },
  ]

  if (!profileLoading && !profile) {
    return (
      <>
        <TopBar />
        <main className="min-h-screen bg-surface-50 pb-24 pt-16">
          <div className="max-w-xl mx-auto px-4 py-16 text-center">
            <p className="text-surface-500">Profile not found.</p>
          </div>
        </main>
        <BottomNav />
      </>
    )
  }

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 pt-16">
        <div className="max-w-xl mx-auto px-4 py-6">
          {/* Back link */}
          <Link
            href={`/profile/${username}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            {profileLoading ? 'Profile' : profile?.display_name ?? profile?.username ?? 'Profile'}
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {profileLoading ? (
              <>
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </>
            ) : (
              <>
                <Avatar
                  src={profile!.avatar_url}
                  username={profile!.username}
                  size={48}
                  className="w-12 h-12"
                />
                <div>
                  <h1 className="text-lg font-bold text-surface-900">
                    {profile!.display_name ?? profile!.username}
                  </h1>
                  <p className="text-sm text-surface-500">@{profile!.username}&apos;s Network</p>
                </div>
              </>
            )}
          </div>

          {/* Stats strip */}
          {!profileLoading && profile && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="w-4 h-4 text-surface-500" />
                  <span className="text-surface-500 text-xs">Followers</span>
                </div>
                <div className="text-xl font-bold text-surface-900">
                  {profile.followers_count.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <TrendingUp className="w-4 h-4 text-surface-500" />
                  <span className="text-surface-500 text-xs">Following</span>
                </div>
                <div className="text-xl font-bold text-surface-900">
                  {profile.following_count.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 bg-surface-200/50 border border-surface-300 rounded-xl p-1 mb-5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 text-xs font-medium rounded-lg py-2 transition-all flex items-center justify-center gap-1.5',
                  tab === t.id
                    ? 'bg-surface-100 text-surface-900 shadow-sm border border-surface-300'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {t.label}
                {t.count != null && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      tab === t.id
                        ? 'bg-surface-300/50 text-surface-700'
                        : 'bg-surface-300/30 text-surface-600'
                    )}
                  >
                    {t.count > 999 ? `${Math.floor(t.count / 1000)}k` : t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* User list */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 px-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <UserRowSkeleton key={i} />)
            ) : error ? (
              <div className="py-8 text-center text-sm text-surface-500">{error}</div>
            ) : displayedUsers.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  icon={<UserMinus className="w-8 h-8 text-surface-500" />}
                  title={
                    tab === 'followers'
                      ? 'No followers yet'
                      : tab === 'following'
                        ? 'Not following anyone yet'
                        : 'No mutual connections'
                  }
                  description={
                    tab === 'followers'
                      ? 'When citizens follow this profile, they\'ll appear here.'
                      : tab === 'following'
                        ? 'This citizen hasn\'t followed anyone yet.'
                        : 'Citizens who both follow and are followed back will show here.'
                  }
                />
              </div>
            ) : (
              <>
                {displayedUsers.map((u) => (
                  <UserRow key={u.id} user={u} viewerId={viewerId} />
                ))}

                {/* Load more */}
                {nextCursor && tab !== 'mutual' && (
                  <div className="py-4 flex justify-center">
                    <button
                      onClick={() => fetchPage(nextCursor, true)}
                      disabled={loadingMore}
                      className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
                    >
                      {loadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Load more'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
