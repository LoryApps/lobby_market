'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, Loader2, LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface TagFollowButtonProps {
  tag: string
  /** Optional initial state passed from SSR to avoid flicker */
  initialFollowing?: boolean
  initialCount?: number
  size?: 'sm' | 'md'
  className?: string
  /** Called after the user successfully unfollows */
  onUnfollowed?: () => void
}

export function TagFollowButton({
  tag,
  initialFollowing,
  initialCount,
  size = 'md',
  className,
  onUnfollowed,
}: TagFollowButtonProps) {
  const router = useRouter()
  const [following, setFollowing] = useState<boolean | null>(initialFollowing ?? null)
  const [count, setCount] = useState<number | null>(initialCount ?? null)
  const [busy, setBusy] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  // Fetch current follow status + count on mount if not provided via SSR
  useEffect(() => {
    if (initialFollowing !== undefined) {
      setAuthed(true)
      return
    }
    fetch(`/api/tags/follow?tag=${encodeURIComponent(tag)}`)
      .then((r) => {
        if (r.status === 401) { setAuthed(false); return null }
        setAuthed(true)
        return r.json()
      })
      .then((d) => {
        if (!d) return
        setFollowing(d.following as boolean)
        setCount(d.follower_count as number)
      })
      .catch(() => {})
  }, [tag, initialFollowing])

  async function toggle() {
    if (authed === false) {
      router.push('/login')
      return
    }
    if (busy) return
    setBusy(true)

    try {
      const method = following ? 'DELETE' : 'POST'
      const url =
        following
          ? `/api/tags/follow?tag=${encodeURIComponent(tag)}`
          : `/api/tags/follow`
      const body = following ? undefined : JSON.stringify({ tag })

      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (res.ok) {
        const d = await res.json()
        setFollowing(d.following as boolean)
        setCount(d.follower_count as number)
        if (!(d.following as boolean) && onUnfollowed) {
          onUnfollowed()
        }
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  const isSm = size === 'sm'

  return (
    <button
      onClick={toggle}
      disabled={busy || authed === null}
      aria-label={following ? `Unfollow #${tag}` : `Follow #${tag}`}
      aria-pressed={following ?? false}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono font-semibold border transition-all',
        'rounded-lg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
        isSm
          ? 'px-2.5 py-1 text-[11px]'
          : 'px-3.5 py-1.5 text-xs',
        following
          ? 'bg-for-500/15 border-for-500/30 text-for-400 hover:bg-against-500/15 hover:border-against-500/30 hover:text-against-400'
          : authed === false
          ? 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
          : 'bg-surface-200 border-surface-300 text-surface-400 hover:bg-for-500/15 hover:border-for-500/30 hover:text-for-400',
        className,
      )}
    >
      {busy ? (
        <Loader2 className={cn('animate-spin', isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : following ? (
        <Check className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : authed === false ? (
        <LogIn className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : (
        <Bell className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      )}
      <span>
        {following
          ? 'Following'
          : authed === false
          ? 'Sign in'
          : 'Follow'}
        {count !== null && count > 0 && (
          <span className="ml-1 opacity-60">{count.toLocaleString()}</span>
        )}
      </span>
    </button>
  )
}
