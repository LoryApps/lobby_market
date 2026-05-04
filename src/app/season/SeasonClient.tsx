'use client'

/**
 * /season — Civic Seasonal Championship
 *
 * Monthly meta-game: every civic action earns Season Points.
 * The leaderboard resets each season; top citizens win exclusive titles.
 *
 * Scoring (kept in sync with 00056_civic_seasons.sql):
 *   1 pt  per vote cast
 *   5 pts per argument posted
 *  10 pts per debate participated
 *  25 pts per topic that became law (user voted FOR)
 *   3 pts per argument upvote received
 *  15 pts per correct prediction
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BarChart2,
  Calendar,
  ChevronRight,
  Crown,
  Flame,
  Gavel,
  History,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { SeasonResponse, SeasonEntry } from '@/app/api/season/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000

// How many seconds between ticks in the countdown
const TICK_MS = 1_000

// Rank title thresholds (top-N in season)
const RANK_TITLES: Array<{ maxRank: number; label: string; color: string; icon: typeof Crown }> = [
  { maxRank: 1,  label: 'Season Champion',   color: 'text-gold',       icon: Crown      },
  { maxRank: 3,  label: 'Silver Senator',     color: 'text-for-200',    icon: Trophy     },
  { maxRank: 10, label: 'Bronze Statesman',   color: 'text-against-300',icon: Award      },
  { maxRank: 25, label: 'Rising Citizen',     color: 'text-emerald',    icon: Sparkles   },
  { maxRank: 50, label: 'Active Participant', color: 'text-purple',     icon: Star       },
]

function getRankTitle(rank: number) {
  return RANK_TITLES.find((t) => rank <= t.maxRank) ?? null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Season ended'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  isMe,
  index,
}: {
  entry: SeasonEntry
  isMe: boolean
  index: number
}) {
  const title = getRankTitle(entry.rank)
  const TitleIcon = title?.icon ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-3 border transition-all',
        isMe
          ? 'bg-purple/8 border-purple/30 ring-1 ring-purple/20'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
        entry.rank <= 3 && !isMe && 'border-gold/20 bg-gold/3'
      )}
    >
      {/* Rank */}
      <div className="w-8 flex-shrink-0 text-center">
        {entry.rank === 1 ? (
          <Crown className="h-5 w-5 text-gold mx-auto" />
        ) : entry.rank === 2 ? (
          <Trophy className="h-4.5 w-4.5 text-for-300 mx-auto" />
        ) : entry.rank === 3 ? (
          <Award className="h-4 w-4 text-against-300 mx-auto" />
        ) : (
          <span className="font-mono text-sm font-semibold text-surface-500">
            {entry.rank}
          </span>
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

      {/* Name + title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/profile/${entry.username}`}
            className="text-sm font-semibold text-white group-hover:text-surface-700 transition-colors truncate"
          >
            {entry.display_name ?? entry.username}
          </Link>
          {isMe && (
            <span className="flex-shrink-0 text-[10px] font-mono font-bold text-purple bg-purple/10 border border-purple/30 px-1.5 py-0.5 rounded-full">
              YOU
            </span>
          )}
          {title && TitleIcon && (
            <span
              className={cn(
                'hidden sm:inline-flex flex-shrink-0 items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider',
                title.color
              )}
            >
              <TitleIcon className="h-3 w-3" />
              {title.label}
            </span>
          )}
        </div>

        {/* Mini breakdown */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {entry.vote_pts > 0 && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <Vote className="h-2.5 w-2.5" />
              {entry.vote_pts}
            </span>
          )}
          {entry.argument_pts > 0 && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" />
              {entry.argument_pts}
            </span>
          )}
          {entry.debate_pts > 0 && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <Scale className="h-2.5 w-2.5" />
              {entry.debate_pts}
            </span>
          )}
          {entry.law_pts > 0 && (
            <span className="text-[10px] font-mono text-emerald flex items-center gap-0.5">
              <Gavel className="h-2.5 w-2.5" />
              {entry.law_pts}
            </span>
          )}
        </div>
      </div>

      {/* Total points */}
      <div className="flex-shrink-0 text-right">
        <div className="font-mono text-lg font-bold text-white tabular-nums">
          <AnimatedNumber value={entry.total_pts} />
        </div>
        <div className="text-[10px] font-mono text-surface-500">pts</div>
      </div>
    </motion.div>
  )
}

// ─── My rank card ─────────────────────────────────────────────────────────────

function MyRankCard({
  entry,
  totalParticipants,
}: {
  entry: SeasonEntry
  totalParticipants: number
}) {
  const title = getRankTitle(entry.rank)
  const TitleIcon = title?.icon

  const breakdown: Array<{ label: string; value: number; icon: typeof Vote; color: string }> = [
    { label: 'Votes',       value: entry.vote_pts,       icon: Vote,         color: 'text-for-400'      },
    { label: 'Arguments',   value: entry.argument_pts,   icon: MessageSquare,color: 'text-purple'        },
    { label: 'Debates',     value: entry.debate_pts,     icon: Scale,        color: 'text-gold'          },
    { label: 'Laws',        value: entry.law_pts,        icon: Gavel,        color: 'text-emerald'       },
    { label: 'Upvotes',     value: entry.upvote_pts,     icon: Zap,          color: 'text-for-300'       },
    { label: 'Predictions', value: entry.prediction_pts, icon: Target,       color: 'text-against-300'   },
  ].filter((b) => b.value > 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-purple/30 bg-purple/5 p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple/15 border border-purple/30">
            <Crown className="h-6 w-6 text-purple" />
          </div>
          <div>
            <div className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-0.5">
              Your Season Rank
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-black text-white">#{entry.rank}</span>
              <span className="font-mono text-sm text-surface-500">
                of {totalParticipants.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-3xl font-black text-purple tabular-nums">
            <AnimatedNumber value={entry.total_pts} />
          </div>
          <div className="text-xs font-mono text-surface-500">season points</div>
        </div>
      </div>

      {title && TitleIcon && (
        <div
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold uppercase tracking-wider',
            title.color,
            'border-current/30 bg-current/5'
          )}
          style={{ borderColor: 'currentColor', backgroundColor: 'color-mix(in srgb, currentColor 8%, transparent)' }}
        >
          <TitleIcon className="h-3.5 w-3.5" />
          {title.label}
        </div>
      )}

      {breakdown.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {breakdown.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-lg bg-surface-200/60 px-2 py-2"
            >
              <Icon className={cn('h-3.5 w-3.5', color)} />
              <span className="font-mono text-sm font-bold text-white">{value}</span>
              <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Season hero banner ───────────────────────────────────────────────────────

function SeasonHero({
  season,
  secondsLeft,
}: {
  season: SeasonResponse['season'] & {}
  secondsLeft: number
}) {
  const [timeLeft, setTimeLeft] = useState(secondsLeft)

  useEffect(() => {
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const ended = timeLeft <= 0
  const pctElapsed = Math.min(
    100,
    ((new Date(season.ends_at).getTime() - new Date(season.starts_at).getTime() - timeLeft * 1000) /
      (new Date(season.ends_at).getTime() - new Date(season.starts_at).getTime())) *
      100
  )

  return (
    <div
      className="relative rounded-2xl overflow-hidden border p-6 space-y-4"
      style={{
        borderColor: `${season.theme_color}40`,
        background: `linear-gradient(135deg, ${season.theme_color}08 0%, transparent 60%)`,
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: season.theme_color }}
      />

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-12 w-12 rounded-xl border"
            style={{
              background: `${season.theme_color}15`,
              borderColor: `${season.theme_color}40`,
            }}
          >
            <Crown className="h-6 w-6" style={{ color: season.theme_color }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
                style={{
                  color: season.theme_color,
                  borderColor: `${season.theme_color}40`,
                  background: `${season.theme_color}15`,
                }}
              >
                {ended ? 'Season Ended' : 'Season Active'}
              </span>
            </div>
            <h1 className="font-mono text-xl font-black text-white">{season.name}</h1>
            {season.tagline && (
              <p className="text-sm text-surface-500 font-mono mt-0.5">{season.tagline}</p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 justify-end mb-0.5">
            <Timer className="h-3 w-3" />
            {ended ? 'Ended' : 'Ends'}
          </div>
          <div
            className="font-mono text-lg font-bold tabular-nums"
            style={{ color: ended ? '#ef4444' : season.theme_color }}
          >
            {ended ? formatDate(season.ends_at) : formatCountdown(timeLeft)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: season.theme_color }}
          initial={{ width: 0 }}
          animate={{ width: `${pctElapsed}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(season.starts_at)}
        </span>
        <span>{Math.round(pctElapsed)}% complete</span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(season.ends_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Scoring guide ─────────────────────────────────────────────────────────────

function ScoringGuide({ themeColor }: { themeColor: string }) {
  const items: Array<{ label: string; pts: number; icon: typeof Vote; color: string; href: string }> = [
    { label: 'Vote cast',              pts: 1,  icon: Vote,         color: 'text-for-400',     href: '/'        },
    { label: 'Argument posted',        pts: 5,  icon: MessageSquare,color: 'text-purple',       href: '/'        },
    { label: 'Debate participated in', pts: 10, icon: Scale,        color: 'text-gold',         href: '/debate'  },
    { label: 'Topic became law (FOR)', pts: 25, icon: Gavel,        color: 'text-emerald',      href: '/law'     },
    { label: 'Argument upvote earned', pts: 3,  icon: Zap,          color: 'text-for-300',      href: '/'        },
    { label: 'Correct prediction',     pts: 15, icon: Target,       color: 'text-against-300',  href: '/predictions' },
  ]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300 bg-surface-200/50">
        <BarChart2 className="h-4 w-4" style={{ color: themeColor }} />
        <h3 className="font-mono text-sm font-bold text-white">How Points Are Earned</h3>
      </div>
      <div className="divide-y divide-surface-300/60">
        {items.map(({ label, pts, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-200/40 transition-colors group"
          >
            <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
            <span className="flex-1 text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
              {label}
            </span>
            <span className="font-mono text-sm font-bold text-white flex items-center gap-1">
              +{pts}
              <span className="text-[10px] text-surface-500 font-normal">pt{pts > 1 ? 's' : ''}</span>
            </span>
            <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Past seasons row ─────────────────────────────────────────────────────────

function PastSeasonRow({
  s,
  index,
}: {
  s: SeasonResponse['pastSeasons'][number]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 px-3.5 py-3 hover:border-surface-400 transition-colors"
    >
      <div
        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border"
        style={{
          background: `${s.theme_color}15`,
          borderColor: `${s.theme_color}40`,
        }}
      >
        <Crown className="h-4 w-4" style={{ color: s.theme_color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-semibold text-white truncate">{s.name}</p>
        <p className="text-[10px] font-mono text-surface-500">Ended {formatDateShort(s.ends_at)}</p>
      </div>
      <History className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 rounded-2xl w-full" />
      <Skeleton className="h-28 rounded-2xl w-full" />
      <Skeleton className="h-8 w-40 rounded-lg" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl w-full" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SeasonClient() {
  const [data, setData] = useState<SeasonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'leaderboard' | 'scoring' | 'history'>('leaderboard')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/season', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json as SeasonResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load season')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => load(true), REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  const season = data?.season ?? null
  const entries = data?.entries ?? []
  const myEntry = data?.myEntry ?? null
  const pastSeasons = data?.pastSeasons ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Season</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Monthly championship — earn points for every action
              </p>
            </div>
          </div>

          <button
            onClick={() => load()}
            disabled={loading}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono font-semibold',
              'border border-surface-300 bg-surface-200 text-surface-500',
              'hover:text-white hover:border-surface-400 transition-all disabled:opacity-50'
            )}
            aria-label="Refresh season data"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PageSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-against-500/30 bg-surface-100 p-8 text-center"
            >
              <p className="font-mono text-against-400 mb-4">{error}</p>
              <button
                onClick={() => load()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white font-mono text-sm hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Season hero or no-season state */}
              {season ? (
                <SeasonHero season={season} secondsLeft={data?.secondsLeft ?? 0} />
              ) : (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                  <Crown className="h-10 w-10 text-gold mx-auto mb-3" />
                  <h2 className="font-mono text-lg font-bold text-white mb-2">No active season</h2>
                  <p className="text-sm text-surface-500 font-mono">
                    The next season is being prepared. Check back soon.
                  </p>
                </div>
              )}

              {/* My rank card */}
              {myEntry && (
                <MyRankCard entry={myEntry} totalParticipants={entries.length || 1} />
              )}

              {/* No-points nudge for authenticated users with 0 pts */}
              {myEntry && myEntry.total_pts === 0 && season && (
                <div className="rounded-2xl border border-for-500/20 bg-for-500/5 p-4 flex items-start gap-3">
                  <Flame className="h-5 w-5 text-for-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-white mb-1">
                      You haven&apos;t earned any season points yet
                    </p>
                    <p className="text-xs font-mono text-surface-500 mb-3">
                      Every vote earns 1 pt. Arguments earn 5. Help pass a law and earn 25.
                    </p>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white font-mono text-sm font-semibold hover:bg-for-700 transition-colors"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Start Voting
                    </Link>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
                {(
                  [
                    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
                    { id: 'scoring',     label: 'How to Earn',  icon: BarChart2 },
                    { id: 'history',     label: 'Past Seasons', icon: History },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                      tab === id
                        ? 'bg-surface-50 text-white shadow-sm'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {tab === 'leaderboard' && (
                  <motion.div
                    key="leaderboard"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    {entries.length === 0 ? (
                      <EmptyState
                        icon={Trophy}
                        title="No participants yet"
                        description={
                          season
                            ? 'Be the first citizen to earn season points. Cast a vote to get started.'
                            : 'The leaderboard will populate when a season is active.'
                        }
                        action={
                          season
                            ? { label: 'Vote now', href: '/' }
                            : undefined
                        }
                      />
                    ) : (
                      <>
                        {/* Top 3 podium highlight */}
                        {entries.slice(0, 3).length === 3 && (
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {[entries[1], entries[0], entries[2]].map((e, podIdx) => {
                              const positions = [2, 1, 3]
                              const heights = ['h-20', 'h-28', 'h-16']
                              const colors = ['text-for-300', 'text-gold', 'text-against-300']
                              const realIdx = podIdx
                              return (
                                <Link
                                  key={e.user_id}
                                  href={`/profile/${e.username}`}
                                  className={cn(
                                    'flex flex-col items-center justify-end rounded-xl border border-surface-300 bg-surface-100 px-2 pb-3 pt-2',
                                    heights[realIdx],
                                    'hover:border-surface-400 transition-colors group'
                                  )}
                                >
                                  <Avatar
                                    src={e.avatar_url}
                                    fallback={e.display_name ?? e.username}
                                    size="sm"
                                    className="mb-1.5"
                                  />
                                  <span className={cn('text-[10px] font-mono font-black', colors[realIdx])}>
                                    #{positions[realIdx]}
                                  </span>
                                  <span className="text-[10px] font-mono text-surface-400 truncate max-w-full">
                                    {e.display_name ?? e.username}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-white">
                                    {e.total_pts} pts
                                  </span>
                                </Link>
                              )
                            })}
                          </div>
                        )}

                        {entries.map((entry, idx) => (
                          <LeaderboardRow
                            key={entry.user_id}
                            entry={entry}
                            isMe={entry.user_id === myEntry?.user_id}
                            index={idx}
                          />
                        ))}

                        {entries.length >= 100 && (
                          <p className="text-center text-xs font-mono text-surface-600 pt-1">
                            Showing top 100 participants
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {tab === 'scoring' && season && (
                  <motion.div
                    key="scoring"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-4"
                  >
                    <ScoringGuide themeColor={season.theme_color} />

                    {/* How seasons work */}
                    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
                      <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-gold" />
                        How Seasons Work
                      </h3>
                      <ul className="space-y-2 text-sm font-mono text-surface-400">
                        <li className="flex items-start gap-2">
                          <span className="text-for-400 mt-0.5">→</span>
                          Each season runs for approximately one calendar month.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-for-400 mt-0.5">→</span>
                          The leaderboard resets at the start of each new season — everyone begins from zero.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-for-400 mt-0.5">→</span>
                          Top performers earn exclusive seasonal titles and badges tied to that season.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-for-400 mt-0.5">→</span>
                          Your all-time reputation and Clout are separate from season points.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-for-400 mt-0.5">→</span>
                          Helping a topic become law while voting FOR earns the highest points — quality over quantity.
                        </li>
                      </ul>
                    </div>

                    {/* CTA */}
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600 text-white font-mono text-sm font-semibold hover:bg-for-700 transition-colors"
                      >
                        <Vote className="h-4 w-4" />
                        Vote Now
                      </Link>
                      <Link
                        href="/debate"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gold/30 bg-gold/5 text-gold font-mono text-sm font-semibold hover:bg-gold/10 transition-colors"
                      >
                        <Scale className="h-4 w-4" />
                        Debate
                      </Link>
                    </div>
                  </motion.div>
                )}

                {tab === 'scoring' && !season && (
                  <motion.div
                    key="scoring-noseason"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center"
                  >
                    <Crown className="h-8 w-8 text-gold mx-auto mb-3" />
                    <p className="font-mono text-sm text-surface-500">
                      Point rules will be displayed when a season is active.
                    </p>
                  </motion.div>
                )}

                {tab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    {pastSeasons.length === 0 ? (
                      <EmptyState
                        icon={History}
                        title="No completed seasons yet"
                        description="Season history will appear here once the first season ends."
                      />
                    ) : (
                      pastSeasons.map((s, i) => (
                        <PastSeasonRow key={s.id} s={s} index={i} />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
