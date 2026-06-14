'use client'

/**
 * /leaderboard/impact — Civic Impact Leaderboard
 *
 * Ranks citizens not by any single metric but by their composite real-world
 * civic impact: topics authored that became law, argument reputation earned
 * from peers, clout accumulated, and community reach (followers).
 *
 * Impact score formula (all capped to prevent single-metric dominance):
 *   laws_authored × 250           — highest weight, creating law is king
 *   + arguments × 3  (max 300)   — consistent contributors
 *   + reputation × 0.5 (max 200) — community recognition
 *   + clout × 0.01  (max 150)    — earned economic standing
 *   + followers × 2  (max 100)   — reach / influence
 *
 * Distinct from:
 *   /leaderboard                  — raw clout ranking
 *   /leaderboard/reputation       — reputation score only
 *   /leaderboard/lawmakers        — laws authored only (single metric)
 *   /leaderboard/engagement       — geometric mean of activity dimensions
 *   /leaderboard/grades           — argument AI quality only
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ImpactEntry, ImpactLeaderboardResponse } from '@/app/api/leaderboard/impact/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-surface-600'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-600/10 border-amber-600/30'
  return 'bg-surface-100 border-surface-300'
}

function fmtScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

const ROLE_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  citizen: 'proposed',
  senator: 'active',
  magistrate: 'law',
  elder: 'law',
  admin: 'law',
}

// ─── Podium (top 3) ───────────────────────────────────────────────────────────

function PodiumSlot({
  entry,
  rank,
  position,
}: {
  entry: ImpactEntry
  rank: 1 | 2 | 3
  position: 'left' | 'center' | 'right'
}) {
  const heights = { center: 'h-20', left: 'h-14', right: 'h-12' }
  const colors = {
    center: 'from-gold/20 to-gold/5 border-gold/40',
    left: 'from-surface-300/20 to-surface-300/5 border-surface-400/30',
    right: 'from-amber-700/20 to-amber-700/5 border-amber-700/30',
  }
  const crownColors = {
    center: 'text-gold',
    left: 'text-surface-300',
    right: 'text-amber-600',
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {rank === 1 && (
          <Crown
            className={cn('absolute -top-4 left-1/2 -translate-x-1/2 h-5 w-5', crownColors.center)}
            aria-hidden="true"
          />
        )}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size={position === 'center' ? 'xl' : 'lg'}
          className="ring-2 ring-offset-2 ring-offset-surface-50 ring-surface-400"
        />
        <div
          className={cn(
            'absolute -bottom-1 -right-1 flex items-center justify-center',
            'h-5 w-5 rounded-full text-[10px] font-mono font-bold',
            rank === 1
              ? 'bg-gold text-surface-900'
              : rank === 2
              ? 'bg-surface-400 text-surface-900'
              : 'bg-amber-700 text-white'
          )}
        >
          {rank}
        </div>
      </div>

      {/* Podium bar */}
      <div
        className={cn(
          'w-20 rounded-t-lg bg-gradient-to-t border',
          heights[position],
          colors[position]
        )}
      />

      <div className="text-center max-w-[80px]">
        <Link
          href={`/profile/${entry.username}`}
          className="font-mono text-xs font-semibold text-white hover:text-for-300 transition-colors line-clamp-1"
        >
          {entry.display_name || entry.username}
        </Link>
        <p className={cn('font-mono text-[10px] font-bold', rankColor(rank))}>
          {fmtScore(entry.impact_score)} pts
        </p>
      </div>
    </div>
  )
}

// ─── Row entry ────────────────────────────────────────────────────────────────

function ImpactRow({
  entry,
  rank,
  myId,
}: {
  entry: ImpactEntry
  rank: number
  myId: string | null
}) {
  const isMe = myId === entry.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.6) }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 p-4 rounded-xl border transition-all',
          rankBg(rank),
          isMe && 'ring-1 ring-for-500/40',
          'hover:border-surface-400 group'
        )}
        aria-label={`View profile of ${entry.display_name || entry.username}, rank ${rank}`}
      >
        {/* Rank */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg font-mono text-xs font-bold',
            rank <= 3 ? rankColor(rank) : 'text-surface-600',
            rank <= 3 ? 'bg-surface-200' : ''
          )}
        >
          {rank <= 3 ? (
            rank === 1 ? <Crown className="h-4 w-4" /> :
            rank === 2 ? <Trophy className="h-3.5 w-3.5" /> :
            <Star className="h-3.5 w-3.5" />
          ) : rank}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="md"
          className="flex-shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-white truncate">
              {entry.display_name || entry.username}
            </span>
            {isMe && (
              <span className="flex-shrink-0 text-[9px] font-mono font-bold text-for-400 bg-for-500/10 border border-for-500/30 px-1.5 py-0.5 rounded-full">
                YOU
              </span>
            )}
            <Badge
              variant={ROLE_BADGE[entry.role] ?? 'proposed'}
              className="flex-shrink-0 capitalize text-[10px]"
            >
              {entry.role}
            </Badge>
          </div>

          {/* Impact signals */}
          <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-surface-500 flex-wrap">
            {entry.laws_authored > 0 && (
              <span className="flex items-center gap-0.5 text-gold font-semibold">
                <Gavel className="h-2.5 w-2.5" />
                {entry.laws_authored} law{entry.laws_authored !== 1 ? 's' : ''}
              </span>
            )}
            {entry.total_arguments > 0 && (
              <span className="flex items-center gap-0.5 text-for-400">
                <MessageSquare className="h-2.5 w-2.5" />
                {fmtNumber(entry.total_arguments)}
              </span>
            )}
            {entry.followers_count > 0 && (
              <span className="flex items-center gap-0.5 text-purple">
                <Users className="h-2.5 w-2.5" />
                {fmtNumber(entry.followers_count)}
              </span>
            )}
            {entry.reputation_score > 0 && (
              <span className="flex items-center gap-0.5 text-emerald">
                <Sparkles className="h-2.5 w-2.5" />
                {fmtNumber(entry.reputation_score)} rep
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <div className={cn(
            'font-mono text-sm font-bold',
            rank === 1 ? 'text-gold' : rank <= 3 ? 'text-white' : 'text-for-300'
          )}>
            <AnimatedNumber value={entry.impact_score} />
          </div>
          <div className="font-mono text-[10px] text-surface-600">impact pts</div>
        </div>

        <ChevronRight
          className="h-3.5 w-3.5 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImpactLeaderboardPage() {
  const [data, setData] = useState<ImpactLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState<string | null>(null)
  const [myRank, setMyRank] = useState<number | null>(null)
  const myRowRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Load leaderboard data + current user in parallel
      const [leaderRes, userRes] = await Promise.all([
        fetch('/api/leaderboard/impact', { cache: 'no-store' }),
        fetch('/api/me/profile', { cache: 'no-store' }),
      ])

      if (leaderRes.ok) {
        const json = await leaderRes.json() as ImpactLeaderboardResponse
        setData(json)
      }

      if (userRes.ok) {
        const user = await userRes.json() as { id: string }
        setMyId(user.id)
      }
    } catch {
      // non-fatal — show partial data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Find my rank once data + myId are available
  useEffect(() => {
    if (!data || !myId) return
    const idx = data.entries.findIndex((e) => e.id === myId)
    setMyRank(idx >= 0 ? idx + 1 : null)
  }, [data, myId])

  const top3 = data?.entries.slice(0, 3) ?? []
  const rest = data?.entries.slice(3) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <div className="mb-5">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leaderboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30">
            <Target className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
              Civic Impact Leaderboard
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              Citizens ranked by composite real-world impact — laws authored, argument reputation, clout, and community reach.
            </p>
          </div>
        </div>

        {/* My rank banner */}
        {myRank !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl bg-for-600/10 border border-for-500/30 px-4 py-3 mb-4"
          >
            <Zap className="h-4 w-4 text-for-400 flex-shrink-0" />
            <p className="font-mono text-sm text-for-300">
              You are ranked <span className="font-bold text-white">#{myRank}</span> by civic impact.
            </p>
            <button
              onClick={() => myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="ml-auto text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors flex-shrink-0"
            >
              Jump to me
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        )}

        {/* Empty */}
        {!loading && (!data || data.entries.length === 0) && (
          <EmptyState
            icon={Target}
            title="No impact data yet"
            description="Once citizens start authoring topics and earning reputation, the Impact Leaderboard will fill up."
          />
        )}

        {/* Content */}
        {!loading && data && data.entries.length > 0 && (
          <div className="space-y-4">
            {/* Podium */}
            {top3.length >= 3 && (
              <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="h-4 w-4 text-gold" />
                  <span className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Top Civic Influencers
                  </span>
                </div>
                <div className="flex items-end justify-center gap-4 px-4">
                  <PodiumSlot entry={top3[1]} rank={2} position="left" />
                  <PodiumSlot entry={top3[0]} rank={1} position="center" />
                  <PodiumSlot entry={top3[2]} rank={3} position="right" />
                </div>
              </div>
            )}

            {/* Score breakdown legend */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mb-2 font-semibold">
                Impact Score Breakdown
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-surface-500">
                <span className="flex items-center gap-1.5">
                  <Gavel className="h-3 w-3 text-gold" />
                  Laws authored ×250 pts
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-for-400" />
                  Arguments ×3 pts
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-emerald" />
                  Reputation ×0.5 pts
                </span>
                <span className="flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-gold" />
                  Clout ×0.01 pts
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-purple" />
                  Followers ×2 pts
                </span>
              </div>
            </div>

            {/* Ranked list (4–100) */}
            {rest.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-mono text-xs text-surface-500 uppercase tracking-wider font-semibold pl-1">
                  Rankings 4–{Math.min(data.entries.length, 100)}
                </p>
                {rest.map((entry, i) => (
                  <div
                    key={entry.id}
                    ref={myId === entry.id ? myRowRef : undefined}
                  >
                    <ImpactRow
                      entry={entry}
                      rank={i + 4}
                      myId={myId}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* How to improve */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-for-400" />
                <p className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  How to rise in Impact
                </p>
              </div>
              <ul className="space-y-2 font-mono text-sm text-surface-500">
                <li className="flex items-start gap-2">
                  <Gavel className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
                  <span>Propose topics that earn community support and become <span className="text-gold">Laws</span> — each is worth 250 impact points.</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
                  <span>Write compelling arguments. Community upvotes turn into <span className="text-for-300">reputation</span>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <UserPlus className="h-3.5 w-3.5 text-purple mt-0.5 flex-shrink-0" />
                  <span>Grow your <span className="text-purple">follower base</span> by being consistently insightful.</span>
                </li>
              </ul>
              <Link
                href="/topic/create"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-medium transition-colors mt-1"
              >
                Propose a topic
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                All Leaderboards
              </Link>
              <Link
                href="/leaderboard/lawmakers"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                Law Makers
              </Link>
              <Link
                href="/leaderboard/engagement"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Engagement Index
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
