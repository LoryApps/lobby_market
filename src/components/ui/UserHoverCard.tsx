'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Flame, MessageSquare, Coins } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

// ─── Mini profile type ────────────────────────────────────────────────────────

type MiniProfile = Pick<
  Profile,
  | 'id'
  | 'username'
  | 'display_name'
  | 'avatar_url'
  | 'role'
  | 'clout'
  | 'total_votes'
  | 'total_arguments'
  | 'reputation_score'
  | 'bio'
  | 'is_influencer'
  | 'vote_streak'
>

// ─── Session-level cache ──────────────────────────────────────────────────────

const cache = new Map<string, MiniProfile | null>()

async function fetchMiniProfile(username: string): Promise<MiniProfile | null> {
  if (cache.has(username)) return cache.get(username) ?? null

  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(username)}`)
    if (!res.ok) {
      cache.set(username, null)
      return null
    }
    const data = (await res.json()) as { profile: MiniProfile }
    cache.set(username, data.profile)
    return data.profile
  } catch {
    cache.set(username, null)
    return null
  }
}

// ─── Role ring colours (mirrors RoleBadge logic) ──────────────────────────────

function roleRingClass(role: string): string {
  switch (role) {
    case 'elder':        return 'ring-gold'
    case 'troll_catcher': return 'ring-emerald'
    case 'debator':      return 'ring-for-500'
    default:             return 'ring-surface-500/50'
  }
}

// ─── Floating profile card ────────────────────────────────────────────────────

function ProfileCard({ profile }: { profile: MiniProfile }) {
  const displayName = profile.display_name || profile.username

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.13, ease: 'easeOut' }}
      className={cn(
        'absolute z-[9999] w-72',
        'rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60',
        'p-4',
      )}
      style={{ top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }}
    >
      {/* Arrow tip */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 rounded-sm border-l border-t border-surface-300 bg-surface-100" />

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('flex-shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-surface-100', roleRingClass(profile.role))}>
          <Avatar src={profile.avatar_url} fallback={displayName} size="md" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-sm font-semibold text-white">{displayName}</span>
            {profile.is_influencer && <span className="text-gold text-xs flex-shrink-0">★</span>}
          </div>
          <div className="text-[11px] font-mono text-surface-500 truncate mb-1">@{profile.username}</div>
          <RoleBadge role={profile.role} size="sm" />
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-[12px] text-surface-600 mb-3 line-clamp-2 leading-relaxed">
          {profile.bio}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-2 text-center">
          <div className="font-mono text-sm font-bold text-for-400">
            {(profile.total_votes ?? 0).toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
            <Flame className="h-2.5 w-2.5" />
            Votes
          </div>
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-2 text-center">
          <div className="font-mono text-sm font-bold text-purple">
            {(profile.total_arguments ?? 0).toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
            <MessageSquare className="h-2.5 w-2.5" />
            Args
          </div>
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-2 text-center">
          <div className="font-mono text-sm font-bold text-gold">
            {(profile.clout ?? 0).toLocaleString()}
          </div>
          <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
            <Coins className="h-2.5 w-2.5" />
            Clout
          </div>
        </div>
      </div>

      {/* View profile link */}
      <Link
        href={`/profile/${profile.username}`}
        className={cn(
          'flex items-center justify-center gap-1.5 w-full',
          'rounded-xl border border-surface-300 bg-surface-200 hover:bg-surface-300',
          'text-[11px] font-mono text-surface-600 hover:text-white py-2',
          'transition-colors',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3" />
        View Profile
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="absolute z-[9999] w-72 rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60 p-4"
      style={{ top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }}
    >
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 rounded-sm border-l border-t border-surface-300 bg-surface-100" />
      <div className="flex items-start gap-3 mb-3 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-surface-300 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-surface-300 rounded w-3/4" />
          <div className="h-3 bg-surface-300 rounded w-1/2" />
          <div className="h-5 bg-surface-300 rounded w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-surface-200 border border-surface-300" />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface UserHoverCardProps {
  username: string
  children: React.ReactNode
  className?: string
}

export function UserHoverCard({ username, children, className }: UserHoverCardProps) {
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [profile, setProfile] = useState<MiniProfile | null>(null)
  const [open, setOpen] = useState(false)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (fetchState !== 'idle') return
    setFetchState('loading')
    const p = await fetchMiniProfile(username)
    if (p) {
      setProfile(p)
      setFetchState('loaded')
    } else {
      setFetchState('error')
    }
  }, [username, fetchState])

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    enterTimer.current = setTimeout(() => {
      setOpen(true)
      load()
    }, 350)
  }, [load])

  const handleMouseLeave = useCallback(() => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current)
      enterTimer.current = null
    }
    leaveTimer.current = setTimeout(() => {
      setOpen(false)
    }, 150)
  }, [])

  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [])

  return (
    <span
      className={cn('relative inline-block', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {open && (
          <span
            onMouseEnter={() => {
              if (leaveTimer.current) {
                clearTimeout(leaveTimer.current)
                leaveTimer.current = null
              }
            }}
            onMouseLeave={handleMouseLeave}
          >
            {fetchState === 'loading' && <CardSkeleton />}
            {fetchState === 'loaded' && profile && <ProfileCard profile={profile} />}
          </span>
        )}
      </AnimatePresence>
    </span>
  )
}
