'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  Tag,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TournamentDetail, TournamentEntry } from '@/app/api/exchange/tournaments/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function accuracyPct(entry: TournamentEntry): string {
  if (!entry.predictions_total) return '—'
  return `${Math.round((entry.predictions_correct / entry.predictions_total) * 100)}%`
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-6 w-64 mb-2" />
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-3/4 mb-4" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Leaderboard Row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  position,
  isCurrentUser,
}: {
  entry: TournamentEntry
  position: number
  isCurrentUser: boolean
}) {
  const medal = rankMedal(position)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: position * 0.03 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all',
        isCurrentUser
          ? 'bg-for-500/10 border border-for-500/30'
          : position <= 3
          ? 'bg-surface-200/60 border border-gold/20'
          : 'hover:bg-surface-200/40',
      )}
    >
      {/* Rank */}
      <div className="w-6 text-center flex-shrink-0">
        {medal ? (
          <span className="text-base">{medal}</span>
        ) : (
          <span className="text-xs font-mono text-surface-500">#{position}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
        />
      </Link>

      {/* Name */}
      <Link href={`/profile/${entry.username}`} className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', isCurrentUser ? 'text-for-300' : 'text-white')}>
          {entry.display_name ?? entry.username}
          {isCurrentUser && (
            <span className="ml-1.5 text-[10px] font-mono text-for-400 font-normal">You</span>
          )}
        </p>
        <p className="text-[11px] text-surface-500 truncate">
          @{entry.username}
          {entry.predictions_total > 0 && (
            <span className="ml-2">
              {entry.predictions_correct}/{entry.predictions_total} correct
            </span>
          )}
        </p>
      </Link>

      {/* Score */}
      <div className="flex-shrink-0 text-right">
        <p className={cn(
          'text-sm font-mono font-bold',
          position === 1 ? 'text-gold' : isCurrentUser ? 'text-for-400' : 'text-white',
        )}>
          {entry.score.toFixed(1)}
        </p>
        {entry.predictions_total > 0 && (
          <p className="text-[10px] font-mono text-surface-500">{accuracyPct(entry)}</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TournamentDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [data, setData] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exchange/tournaments/${id}`)
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [id])

  // Get current user ID
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d: { user?: { id: string } }) => setCurrentUserId(d?.user?.id ?? null))
      .catch(() => null)
  }, [])

  useEffect(() => { load() }, [load])

  const handleJoin = useCallback(async () => {
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch('/api/exchange/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: id }),
      })
      if (res.status === 401) { router.push('/auth/login'); return }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setJoinError(body.error ?? 'Failed to join')
        return
      }
      await load()
    } catch {
      setJoinError('Network error — try again')
    } finally {
      setJoining(false)
    }
  }, [id, load, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-32 md:pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/exchange/tournaments" className="p-2 rounded-xl border border-surface-300 text-surface-400">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Skeleton className="h-6 w-48" />
          </div>
          <DetailSkeleton />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-32 flex items-center justify-center">
          <EmptyState icon={Trophy} title="Tournament not found" description="This tournament may have been removed." />
        </main>
        <BottomNav />
      </div>
    )
  }

  const canJoin = data.status !== 'finished' && !data.user_entry
  const userPosition = data.user_entry
    ? data.leaderboard.findIndex((e) => e.user_id === currentUserId) + 1
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-32 md:pb-12">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange/tournaments"
            className="p-2 rounded-xl border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xs font-mono text-surface-500">Tournaments</span>
        </div>

        {/* Tournament header card */}
        <div
          className={cn(
            'rounded-2xl border p-5 mb-4',
            data.status === 'active'
              ? 'bg-surface-100 border-emerald/30'
              : data.status === 'upcoming'
              ? 'bg-surface-100 border-for-500/20'
              : 'bg-surface-100/60 border-surface-300',
          )}
        >
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-2">
            {data.status === 'active' ? (
              <>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-emerald tracking-widest uppercase">Live</span>
              </>
            ) : data.status === 'upcoming' ? (
              <span className="text-[10px] font-mono font-bold text-for-400 tracking-widest uppercase">Upcoming</span>
            ) : (
              <span className="text-[10px] font-mono font-bold text-surface-500 tracking-widest uppercase">Finished</span>
            )}
            {data.category && (
              <>
                <span className="text-surface-600">·</span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400">
                  <Tag className="h-2.5 w-2.5" />
                  {data.category}
                </span>
              </>
            )}
          </div>

          <h1 className="text-xl font-bold text-white mb-1">{data.title}</h1>
          {data.description && (
            <p className="text-sm text-surface-400 leading-relaxed mb-4">{data.description}</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 flex-wrap mb-4">
            <span className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
              <Users className="h-3.5 w-3.5" />
              {data.entry_count} participants
            </span>
            <span className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(data.starts_at)} → {formatDate(data.ends_at)}
            </span>
            {data.status === 'active' && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald">
                <Clock className="h-3.5 w-3.5" />
                {daysLeft(data.ends_at)} day{daysLeft(data.ends_at) !== 1 ? 's' : ''} left
              </span>
            )}
            {data.prize_description && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-gold">
                <Trophy className="h-3.5 w-3.5" />
                {data.prize_description}
              </span>
            )}
          </div>

          {/* CTA / user status */}
          {joinError && (
            <div className="mb-3 rounded-xl border border-against-500/40 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-300">
              {joinError}
            </div>
          )}

          {data.user_entry ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-for-500/10 border border-for-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">
                  You&rsquo;re entered{userPosition ? ` · Rank #${userPosition}` : ''}
                </p>
                {data.user_entry.score > 0 && (
                  <p className="text-[11px] font-mono text-surface-400">
                    Score: {data.user_entry.score.toFixed(1)}
                    {data.user_entry.predictions_total > 0 && (
                      <> · {data.user_entry.predictions_correct}/{data.user_entry.predictions_total} correct</>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : canJoin ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-semibold text-sm transition-all',
                data.status === 'active'
                  ? 'bg-emerald/15 border border-emerald/40 text-emerald hover:bg-emerald/25'
                  : 'bg-for-500/15 border border-for-500/30 text-for-400 hover:bg-for-500/25',
                joining && 'opacity-60 cursor-not-allowed',
              )}
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : data.status === 'active' ? (
                <Zap className="h-4 w-4" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              {joining
                ? 'Joining…'
                : data.status === 'active'
                ? 'Join Tournament'
                : 'Pre-register'}
            </button>
          ) : null}
        </div>

        {/* Leaderboard */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold text-white">Leaderboard</h2>
            <span className="text-[10px] font-mono text-surface-500 ml-1">
              ({data.leaderboard.length} ranked)
            </span>
          </div>

          {data.leaderboard.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No entries yet"
              description={
                data.status === 'finished'
                  ? 'No participants completed this tournament.'
                  : 'Be the first to join and top the leaderboard.'
              }
            />
          ) : (
            <div className="space-y-2">
              {data.leaderboard.map((entry, idx) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  position={idx + 1}
                  isCurrentUser={entry.user_id === currentUserId}
                />
              ))}
            </div>
          )}

          {/* Score explanation */}
          <div className="mt-4 pt-3 border-t border-surface-300/60">
            <p className="text-[11px] text-surface-500 font-mono leading-relaxed">
              <span className="text-surface-400 font-semibold">Score</span> is calculated from prediction accuracy
              on active markets in this tournament window. Make price forecasts via the{' '}
              <Link href="/exchange" className="text-for-400 hover:text-for-300 underline underline-offset-2">
                Exchange
              </Link>{' '}
              to accumulate points.
            </p>
          </div>
        </div>

        {/* Explore markets */}
        <div className="mt-4 rounded-2xl border border-surface-300/60 bg-surface-100/40 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Make your predictions</p>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Browse live markets and submit your price forecasts
            </p>
          </div>
          <Link
            href={data.category ? `/exchange?category=${encodeURIComponent(data.category)}` : '/exchange'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-500/15 border border-for-500/30 text-xs font-mono font-semibold text-for-400 hover:bg-for-500/25 transition-all flex-shrink-0"
          >
            <Flame className="h-3.5 w-3.5" />
            Markets
          </Link>
        </div>

        {/* Medal legend */}
        <div className="mt-4 flex items-center gap-4 justify-center flex-wrap">
          {[
            { medal: '🥇', label: '1st — Champion' },
            { medal: '🥈', label: '2nd — Runner-up' },
            { medal: '🥉', label: '3rd — Finalist' },
          ].map(({ medal, label }) => (
            <span key={medal} className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
              <span>{medal}</span>
              {label}
            </span>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
