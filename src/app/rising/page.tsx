'use client'

/**
 * /rising — Rising Citizens
 *
 * Spotlights new citizens (joined in the last 30 days) who are already
 * making outsized civic impact — measured by their rise score: clout
 * earned per day, arguments posted, vote streaks, and reputation growth.
 *
 * Distinct from:
 *   /leaderboard   — all-time ranking (veterans dominate)
 *   /discover      — algorithmic "who to follow" suggestions
 *   /citizens      — full directory of all platform members
 *   /spotlight     — curated weekly best (not newcomer-scoped)
 *
 * Purpose: give new citizens a dedicated stage; help the community
 * discover fresh voices before they're buried by established players.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RisingCitizen, RisingResponse } from '@/app/api/rising/route'

// ─── Highlight config ──────────────────────────────────────────────────────────

const HIGHLIGHT_CONFIG: Record<
  RisingCitizen['highlight'],
  { icon: typeof Rocket; color: string; bg: string; border: string }
> = {
  rising_star:     { icon: Rocket,      color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  top_argumenter:  { icon: MessageSquare, color: 'text-purple',   bg: 'bg-purple/10',     border: 'border-purple/30' },
  top_voter:       { icon: Vote,         color: 'text-for-400',   bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  top_clout:       { icon: Zap,          color: 'text-gold',      bg: 'bg-gold/10',       border: 'border-gold/30' },
  streak_hero:     { icon: Flame,        color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  new_voice:       { icon: Sparkles,     color: 'text-for-300',   bg: 'bg-for-500/10',    border: 'border-for-500/20' },
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person:       { label: 'Citizen',      color: 'text-surface-500' },
  debator:      { label: 'Debater',      color: 'text-for-400' },
  troll_catcher:{ label: 'Troll Catcher',color: 'text-emerald' },
  elder:        { label: 'Elder',        color: 'text-gold' },
  senator:      { label: 'Senator',      color: 'text-purple' },
  lawmaker:     { label: 'Lawmaker',     color: 'text-gold' },
}

// ─── Relative time ─────────────────────────────────────────────────────────────

function daysAgoLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  if (days < 14) return 'Last week'
  if (days < 21) return '2 weeks ago'
  return '3 weeks ago'
}

// ─── Citizen card ──────────────────────────────────────────────────────────────

function CitizenCard({
  citizen,
  rank,
  onFollow,
  following,
  followBusy,
}: {
  citizen: RisingCitizen
  rank: number
  onFollow: (id: string) => void
  following: boolean
  followBusy: boolean
}) {
  const hl = HIGHLIGHT_CONFIG[citizen.highlight] ?? HIGHLIGHT_CONFIG.new_voice
  const HlIcon = hl.icon
  const role = ROLE_LABELS[citizen.role] ?? ROLE_LABELS.person

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(rank * 0.04, 0.5) }}
      className="group"
    >
      <Link
        href={`/profile/${citizen.username}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border transition-all duration-200',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200',
        )}
      >
        {/* Rank badge */}
        <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-surface-300 font-mono text-xs font-bold text-surface-600 mt-0.5">
          {rank <= 3 ? (
            <Star className={cn('h-3.5 w-3.5', rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : 'text-for-700')} />
          ) : (
            rank
          )}
        </div>

        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar
            src={citizen.avatar_url}
            username={citizen.username}
            displayName={citizen.display_name}
            size={44}
            className="ring-2 ring-surface-300"
          />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-white truncate">
              {citizen.display_name ?? citizen.username}
            </span>
            <span className={cn('text-xs font-mono', role.color)}>
              {role.label}
            </span>
          </div>

          <p className="text-xs font-mono text-surface-500 mt-0.5">
            @{citizen.username} · joined {daysAgoLabel(citizen.days_old)}
          </p>

          {/* Bio snippet */}
          {citizen.bio && (
            <p className="text-xs font-mono text-surface-600 mt-1 line-clamp-1">
              {citizen.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-mono text-for-400">
              <Vote className="h-3 w-3" />
              {citizen.total_votes} votes
            </span>
            {citizen.total_arguments > 0 && (
              <span className="flex items-center gap-1 text-xs font-mono text-purple">
                <MessageSquare className="h-3 w-3" />
                {citizen.total_arguments} args
              </span>
            )}
            {citizen.vote_streak >= 3 && (
              <span className="flex items-center gap-1 text-xs font-mono text-against-400">
                <Flame className="h-3 w-3" />
                {citizen.vote_streak}d streak
              </span>
            )}
            <span className="flex items-center gap-1 text-xs font-mono text-gold">
              <Zap className="h-3 w-3" />
              {citizen.clout} Clout
            </span>
          </div>
        </div>

        {/* Highlight badge + follow */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-semibold',
              hl.bg, hl.border, hl.color,
            )}
          >
            <HlIcon className="h-3 w-3" />
            <span>{citizen.highlight_label}</span>
          </div>

          {/* Follow button (stop propagation so clicking it doesn't navigate) */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!followBusy) onFollow(citizen.id)
            }}
            disabled={followBusy}
            aria-label={following ? `Unfollow ${citizen.username}` : `Follow ${citizen.username}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all',
              following
                ? 'bg-surface-300 border-surface-400 text-surface-600'
                : 'bg-for-500/10 border-for-500/30 text-for-400 hover:bg-for-500/20',
            )}
          >
            {followBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : following ? (
              <>
                <Check className="h-3 w-3" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="h-3 w-3" />
                Follow
              </>
            )}
          </button>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function CitizenSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-surface-300 bg-surface-100">
      <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
      <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-28" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'rising_star' | 'top_argumenter' | 'top_voter' | 'streak_hero'

const FILTER_TABS: { id: FilterMode; label: string; icon: typeof TrendingUp }[] = [
  { id: 'all',           label: 'All',         icon: Users },
  { id: 'rising_star',   label: 'Rising',      icon: TrendingUp },
  { id: 'top_argumenter',label: 'Arguers',     icon: MessageSquare },
  { id: 'top_voter',     label: 'Voters',      icon: Vote },
  { id: 'streak_hero',   label: 'Streaks',     icon: Flame },
]

// ─── Main component ────────────────────────────────────────────────────────────

export default function RisingPage() {
  const [data, setData] = useState<RisingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [followState, setFollowState] = useState<Record<string, 'idle' | 'busy' | 'following'>>({})
  const mountedRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/rising', { cache: 'no-store' })
      if (!res.ok || !mountedRef.current) return
      const json = (await res.json()) as RisingResponse
      if (!mountedRef.current) return
      setData(json)
    } catch {
      // non-critical
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  const handleFollow = useCallback(async (userId: string) => {
    const cur = followState[userId] ?? 'idle'
    const isFollowing = cur === 'following'
    setFollowState((s) => ({ ...s, [userId]: 'busy' }))
    try {
      await fetch('/api/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: userId }),
      })
      setFollowState((s) => ({ ...s, [userId]: isFollowing ? 'idle' : 'following' }))
    } catch {
      setFollowState((s) => ({ ...s, [userId]: cur }))
    }
  }, [followState])

  const citizens = data?.citizens ?? []
  const filtered = filter === 'all'
    ? citizens
    : citizens.filter((c) => c.highlight === filter || (filter === 'rising_star' && c.highlight === 'new_voice'))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Rocket className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Rising Citizens</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                New voices making outsized civic impact
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh rising citizens"
            className="p-2 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Explanation strip */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300 mb-5">
          <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Citizens who joined in the last 30 days, ranked by{' '}
            <span className="text-white">rise score</span> — Clout earned per day,
            argument quality, and vote consistency. The freshest talent in the Lobby.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon
            const active = filter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold whitespace-nowrap transition-all',
                  active
                    ? 'bg-for-500/20 border-for-500/50 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-xs font-mono text-surface-500 mb-4">
            {filtered.length} citizen{filtered.length !== 1 ? 's' : ''} rising
            {data?.window_days ? ` in the last ${data.window_days} days` : ''}
          </p>
        )}

        {/* List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <CitizenSkeleton key={i} />
              ))}
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={<Users className="h-8 w-8 text-surface-500" />}
                title="No rising citizens"
                description={
                  filter === 'all'
                    ? 'No new citizens with activity in the last 30 days.'
                    : 'No citizens match this filter. Try a different category.'
                }
                action={
                  filter !== 'all'
                    ? { label: 'View all', onClick: () => setFilter('all') }
                    : undefined
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {filtered.map((citizen, idx) => (
                <CitizenCard
                  key={citizen.id}
                  citizen={citizen}
                  rank={idx + 1}
                  onFollow={handleFollow}
                  following={followState[citizen.id] === 'following'}
                  followBusy={followState[citizen.id] === 'busy'}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer CTA */}
        {!loading && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 p-4 rounded-xl border border-surface-300 bg-surface-100"
          >
            <p className="text-xs font-mono text-surface-500 mb-3 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-for-400" />
              Know someone who should be here? The Lobby is open to all citizens.
            </p>
            <div className="flex gap-3">
              <Link
                href="/ambassador"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-500/10 border border-for-500/30 text-xs font-mono font-semibold text-for-400 hover:bg-for-500/20 transition-colors"
              >
                <UserPlus className="h-3 w-3" />
                Invite citizens
              </Link>
              <Link
                href="/citizens"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-500 hover:text-white transition-colors"
              >
                <Users className="h-3 w-3" />
                All citizens
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
