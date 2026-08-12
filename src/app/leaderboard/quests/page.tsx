'use client'

import type { ComponentType } from 'react'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Coins,
  Crown,
  Flame,
  Loader2,
  MessageSquare,
  Network,
  RefreshCw,
  Trophy,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  QuestLeaderboardResponse,
  QuestTrackLeaderboard,
  QuestLeaderEntry,
  QuestTrack,
} from '@/app/api/leaderboard/quests/route'

// ─── Track configs ─────────────────────────────────────────────────────────────

const TRACK_UI: Record<
  QuestTrack,
  {
    icon: ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
    ring: string
    gradient: string
    badge: string
  }
> = {
  voter: {
    icon: Vote,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/40',
    gradient: 'from-for-700/20 to-transparent',
    badge: 'bg-for-500/20 text-for-300 border-for-500/30',
  },
  debater: {
    icon: MessageSquare,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/40',
    gradient: 'from-against-700/20 to-transparent',
    badge: 'bg-against-500/20 text-against-300 border-against-500/30',
  },
  scholar: {
    icon: BookOpen,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/40',
    gradient: 'from-yellow-900/20 to-transparent',
    badge: 'bg-gold/20 text-gold border-gold/30',
  },
  builder: {
    icon: Network,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/40',
    gradient: 'from-emerald/10 to-transparent',
    badge: 'bg-emerald/20 text-emerald border-emerald/30',
  },
}

const TRACKS: QuestTrack[] = ['voter', 'debater', 'scholar', 'builder']
const TRACK_LABELS: Record<QuestTrack, string> = {
  voter: 'Voter',
  debater: 'Debater',
  scholar: 'Scholar',
  builder: 'Builder',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-500'
  return 'text-surface-500'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/20 border-surface-400/30'
  if (rank === 3) return 'bg-amber-800/20 border-amber-600/30'
  return 'bg-surface-200 border-surface-300/60'
}

function fmtScore(score: number, track: QuestTrack): string {
  if (track === 'scholar') return score.toFixed(1)
  return score.toLocaleString('en-US')
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
    lawmaker: 'Lawmaker',
    senator: 'Senator',
  }
  return map[role] ?? 'Citizen'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function QuestLeaderSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
        >
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── My Rank Banner ────────────────────────────────────────────────────────────

function MyRankBanner({
  track,
  my_rank,
  my_score,
}: {
  track: QuestTrack
  my_rank: number | null
  my_score: number | null
}) {
  const ui = TRACK_UI[track]
  if (my_rank === null || my_score === null) return null

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 mb-4',
        ui.bg,
        ui.border,
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold font-mono flex-shrink-0',
          rankBg(my_rank),
          rankColor(my_rank),
        )}
      >
        {my_rank <= 3 ? rankLabel(my_rank) : `#${my_rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Your rank</p>
        <p className="text-xs text-surface-500">
          {fmtScore(my_score, track)} {TRACK_UI[track] && track === 'voter' ? 'votes' : track === 'debater' ? 'arguments' : track === 'scholar' ? 'rep score' : 'clout'}
        </p>
      </div>
      <Link
        href="/quests"
        className={cn(
          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
          ui.badge,
          'hover:brightness-110',
        )}
      >
        View quests
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

// ─── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  track,
  index,
}: {
  entry: QuestLeaderEntry
  track: QuestTrack
  index: number
}) {
  const ui = TRACK_UI[track]
  const isTop3 = entry.rank <= 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4) }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all group',
          entry.is_me
            ? cn('bg-surface-200 border-surface-400', ui.ring, 'ring-1')
            : isTop3
              ? 'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200'
              : 'bg-surface-100/60 border-surface-300/60 hover:border-surface-400 hover:bg-surface-100',
        )}
      >
        {/* Rank badge */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-lg border text-xs font-bold font-mono',
            isTop3 ? 'h-9 w-9 text-base' : 'h-8 w-8',
            rankBg(entry.rank),
            rankColor(entry.rank),
          )}
        >
          {rankLabel(entry.rank)}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-white group-hover:text-surface-200 transition-colors truncate">
              {entry.display_name || `@${entry.username}`}
            </span>
            {entry.is_me && (
              <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border', ui.badge)}>
                You
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 truncate">
            {roleLabel(entry.role)} · @{entry.username}
          </p>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <p className={cn('text-sm font-bold font-mono', isTop3 ? ui.color : 'text-surface-300')}>
            {fmtScore(entry.track_score, track).toLocaleString()}
          </p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <Coins className="h-3 w-3 text-gold" />
            <span className="text-[11px] font-mono text-surface-500">{entry.clout.toLocaleString()}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Track Panel ───────────────────────────────────────────────────────────────

function TrackPanel({ board }: { board: QuestTrackLeaderboard }) {
  const ui = TRACK_UI[board.track]
  const TrackIcon = ui.icon

  return (
    <div>
      {/* Track header */}
      <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 mb-4', ui.bg, ui.border)}>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', ui.bg, ui.border, 'border')}>
          <TrackIcon className={cn('h-5 w-5', ui.color)} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{board.label} Track</h2>
          <p className="text-xs text-surface-500">{board.description}</p>
        </div>
      </div>

      {/* My rank */}
      <MyRankBanner
        track={board.track}
        my_rank={board.my_rank}
        my_score={board.my_score}
      />

      {/* Entries */}
      {board.entries.length === 0 ? (
        <EmptyState
          icon={TrackIcon}
          title="No leaders yet"
          description="Be the first to climb the leaderboard for this track."
        />
      ) : (
        <div className="space-y-2">
          {board.entries.map((entry, i) => (
            <EntryCard key={entry.user_id} entry={entry} track={board.track} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestLeaderboardPage() {
  const [data, setData] = useState<QuestLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTrack, setActiveTrack] = useState<QuestTrack>('voter')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/quests')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeBoard = data?.tracks.find((t) => t.track === activeTrack) ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + header */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Leaderboard
        </Link>

        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/30">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Quest Champions</h1>
              <p className="text-xs text-surface-500 mt-0.5">
                Top civic achievers per quest track
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh leaderboard"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl border transition-all',
              'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              loading && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Track tabs */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TRACKS.map((track) => {
            const ui = TRACK_UI[track]
            const TrackIcon = ui.icon
            const board = data?.tracks.find((t) => t.track === track)
            const isActive = activeTrack === track
            return (
              <button
                key={track}
                onClick={() => setActiveTrack(track)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all',
                  isActive
                    ? cn(ui.bg, ui.color, ui.border)
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400',
                )}
              >
                <TrackIcon className="h-3.5 w-3.5" />
                {TRACK_LABELS[track]}
                {board && board.my_rank && board.my_rank <= 10 && (
                  <span className="ml-1 text-[10px] text-gold">#{board.my_rank}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <QuestLeaderSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-against-900/30 border border-against-700/40 p-6 text-center">
            <p className="text-against-400 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : activeBoard ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTrack}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <TrackPanel board={activeBoard} />
            </motion.div>
          </AnimatePresence>
        ) : null}

        {/* Footer CTA */}
        {!loading && !error && (
          <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="h-5 w-5 text-gold" />
              <h3 className="text-sm font-semibold text-white">Climb every track</h3>
            </div>
            <p className="text-xs text-surface-500 leading-relaxed mb-4">
              Complete quests in each track to earn Clout, unlock new abilities, and rise through
              the civic ranks. Voter, Debater, Scholar, and Builder — each track rewards a different
              kind of civic engagement.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/quests"
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gold/10 border border-gold/30 text-xs font-mono font-semibold text-gold hover:bg-gold/15 hover:border-gold/50 transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                View my quests
              </Link>
              <Link
                href="/missions"
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Flame className="h-3.5 w-3.5" />
                Daily missions
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
