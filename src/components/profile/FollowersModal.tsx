'use client'

/**
 * FollowersModal
 *
 * A slide-up / center modal that shows a profile's followers or following list.
 * Each row has a follow/unfollow button. Supports cursor-based pagination.
 *
 * Usage: controlled by an external `tab` + `onClose` so ProfileHeader
 * can open it in either "followers" or "following" mode.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Loader2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from './RoleBadge'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FollowTab = 'followers' | 'following'

type UserRole = 'person' | 'debator' | 'troll_catcher' | 'elder'

interface UserEntry {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: UserRole
  clout: number
  isFollowing: boolean
}

interface FollowersModalProps {
  /** Username whose followers/following to show */
  username: string
  /** Which tab is open */
  tab: FollowTab
  /** Follower / following counts for the header */
  followersCount: number
  followingCount: number
  /** Current viewer id (null = guest) */
  viewerId: string | null
  /** Call to close the modal */
  onClose: () => void
  /** Call when the tab changes */
  onTabChange: (tab: FollowTab) => void
}

// ─── Single user row ────────────────────────────────────────────────────────────

function FollowRow({
  user,
  viewerId,
  isSelf,
}: {
  user: UserEntry
  viewerId: string | null
  isSelf: boolean
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

      if (!res.ok) {
        setFollowing(wasFollowing) // revert
      }
    } catch {
      setFollowing(wasFollowing)
    } finally {
      setToggling(false)
    }
  }

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
    <div className="flex items-center gap-3 py-3 px-4 border-b border-surface-300 last:border-0 hover:bg-surface-200/40 transition-colors">
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
                <TrendingUp className="h-2.5 w-2.5" />
                {user.clout.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Don't show follow button for self */}
      {!isSelf && viewerId !== user.id && (
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
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Icon className="h-3 w-3" />
          )}
          {label}
        </button>
      )}

      {viewerId === user.id && (
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-500 px-2">
          You
        </span>
      )}
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: FollowTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4">
        <UserPlus className="h-5 w-5 text-surface-500" />
      </div>
      <p className="text-sm font-medium text-white">
        {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
      </p>
      <p className="text-xs text-surface-500 mt-1">
        {tab === 'followers'
          ? 'Be the first to follow this profile.'
          : 'Follow others to build your network.'}
      </p>
    </div>
  )
}

// ─── Main modal ────────────────────────────────────────────────────────────────

export function FollowersModal({
  username,
  tab,
  followersCount,
  followingCount,
  viewerId,
  onClose,
  onTabChange,
}: FollowersModalProps) {
  const [users, setUsers] = useState<UserEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      const params = new URLSearchParams({ type: tab })
      if (cursor) params.set('cursor', cursor)

      try {
        const res = await fetch(
          `/api/profile/${username}/followers?${params.toString()}`
        )
        if (!res.ok) return
        const data = (await res.json()) as {
          users: UserEntry[]
          nextCursor: string | null
        }
        setUsers((prev) =>
          append ? [...prev, ...(data.users ?? [])] : (data.users ?? [])
        )
        setNextCursor(data.nextCursor ?? null)
      } catch {
        // network errors are non-fatal
      }
    },
    [username, tab]
  )

  // Reload when tab changes
  useEffect(() => {
    setUsers([])
    setNextCursor(null)
    setLoading(true)
    fetchPage(null, false).finally(() => setLoading(false))
  }, [tab, fetchPage])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    await fetchPage(nextCursor, true)
    setLoadingMore(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={tab === 'followers' ? 'Followers' : 'Following'}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className={cn(
          'relative z-10 w-full sm:max-w-md',
          'bg-surface-100 border border-surface-300 shadow-2xl',
          'rounded-t-3xl sm:rounded-3xl overflow-hidden',
          'flex flex-col',
          'max-h-[80vh] sm:max-h-[70vh]'
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-surface-400" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300 flex-shrink-0">
          <h2 className="text-base font-bold font-mono text-white">
            @{username}
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex flex-shrink-0 border-b border-surface-300">
          {(
            [
              { id: 'followers', label: 'Followers', count: followersCount },
              { id: 'following', label: 'Following', count: followingCount },
            ] as const
          ).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-mono font-semibold transition-colors',
                'border-b-2',
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
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <>
              <div>
                {users.map((u) => (
                  <FollowRow
                    key={u.id}
                    user={u}
                    viewerId={viewerId}
                    isSelf={false}
                  />
                ))}
              </div>

              {nextCursor && (
                <div className="flex justify-center py-4 px-4">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
