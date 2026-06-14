'use client'

/**
 * /leaderboard/engagement — The Civic Engagement Index
 *
 * A "decathlon" leaderboard: ranks citizens by how well-rounded their
 * civic participation is across five dimensions:
 *
 *   Voter      — breadth of topics voted on
 *   Orator     — argument contribution volume
 *   Stalwart   — voting streak (consistency)
 *   Scholar    — reputation earned from peers
 *   Strategist — clout accumulated
 *
 * Score: geometric mean of five 0–100 dimension scores.
 * A user who maxes one dimension but ignores others is outranked by
 * someone who participates meaningfully across all five.
 *
 * Distinct from:
 *   /leaderboard          — clout (single metric)
 *   /leaderboard/grades   — argument AI quality (single metric)
 *   /leaderboard/rising   — recent growth (not balance)
 *   /streaks              — streak only (single metric)
 *   /civic-score          — your personal score (not a leaderboard)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  BookOpen,
  Coins,
  Crown,
  ExternalLink,
  Flame,
  Medal,
  Mic,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  EngagementEntry,
  EngagementLeaderboardResponse,
} from '@/app/api/leaderboard/engagement/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_BADGE: Record<string, string> = {
  elder: 'border-gold/40 text-gold bg-gold/10',
  senator: 'border-purple/40 text-purple bg-purple/10',
  lawmaker: 'border-gold/60 text-gold bg-gold/20',
  debator: 'border-for-500/40 text-for-300 bg-for-500/10',
  troll_catcher: 'border-emerald/40 text-emerald bg-emerald/10',
  person: 'border-surface-400/40 text-surface-500 bg-surface-300/20',
}

const DIMENSION_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string; icon: typeof Vote }
> = {
  Voter:      { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     label: 'Voter',      icon: Vote },
  Orator:     { color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         label: 'Orator',     icon: Mic },
  Stalwart:   { color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  label: 'Stalwart',   icon: Flame },
  Scholar:    { color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       label: 'Scholar',    icon: BookOpen },
  Strategist: { color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30',        label: 'Strategist', icon: Shield },
}

function getDimConfig(dim: string) {
  return DIMENSION_CONFIG[dim] ?? {
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    label: dim,
    icon: Star,
  }
}

function MedalBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-gold" />
  if (rank === 2) return <Medal className="h-5 w-5 text-surface-400" />
  if (rank === 3) return <Trophy className="h-5 w-5 text-amber-600" />
  return (
    <span className="w-5 text-center text-xs font-mono font-semibold text-surface-500">
      {rank}
    </span>
  )
}

// ─── Score Radar Mini ─────────────────────────────────────────────────────────

const RADAR_SIZE = 56
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_RADIUS = RADAR_CENTER - 4

function radarPoint(index: number, total: number, score: number): { x: number; y: number } {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  const r = (score / 100) * RADAR_RADIUS
  return {
    x: RADAR_CENTER + r * Math.cos(angle),
    y: RADAR_CENTER + r * Math.sin(angle),
  }
}

function gridPoint(index: number, total: number, frac: number): { x: number; y: number } {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  const r = frac * RADAR_RADIUS
  return { x: RADAR_CENTER + r * Math.cos(angle), y: RADAR_CENTER + r * Math.sin(angle) }
}

function MiniRadar({ entry }: { entry: EngagementEntry }) {
  const scores = [
    entry.voter_score,
    entry.orator_score,
    entry.stalwart_score,
    entry.scholar_score,
    entry.strategist_score,
  ]
  const N = scores.length

  const gridLines = [0.33, 0.67, 1].map((frac) => {
    const pts = Array.from({ length: N }, (_, i) => gridPoint(i, N, frac))
    return pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ') + 'Z'
  })

  const scorePath = scores
    .map((s, i) => {
      const p = radarPoint(i, N, s)
      return i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`
    })
    .join(' ') + 'Z'

  return (
    <svg
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      className="flex-shrink-0"
      aria-hidden="true"
    >
      {gridLines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgb(63 63 74 / 0.6)" strokeWidth="0.75" />
      ))}
      {/* Axis lines */}
      {Array.from({ length: N }, (_, i) => {
        const outer = gridPoint(i, N, 1)
        return (
          <line
            key={i}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={outer.x}
            y2={outer.y}
            stroke="rgb(63 63 74 / 0.4)"
            strokeWidth="0.75"
          />
        )
      })}
      {/* Score polygon */}
      <path d={scorePath} fill="rgb(96 165 250 / 0.20)" stroke="rgb(96 165 250 / 0.7)" strokeWidth="1.2" />
    </svg>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  score,
  color,
  label,
}: {
  score: number
  color: string
  label: string
}) {
  return (
    <div className="space-y-0.5" aria-label={`${label}: ${score}%`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-surface-500">{label}</span>
        <span className={cn('text-[10px] font-mono font-semibold', color)}>{score}</span>
      </div>
      <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
        />
      </div>
    </div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: EngagementEntry
  expanded: boolean
  onToggle: () => void
}) {
  const dim = getDimConfig(entry.top_dimension)
  const DimIcon = dim.icon
  const score = entry.engagement_score

  const scoreGrade =
    score >= 90 ? { text: 'text-gold', label: 'S' }
    : score >= 70 ? { text: 'text-emerald', label: 'A' }
    : score >= 50 ? { text: 'text-for-400', label: 'B' }
    : score >= 30 ? { text: 'text-purple', label: 'C' }
    : { text: 'text-surface-500', label: 'D' }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-200/40 transition-colors"
        aria-expanded={expanded}
        aria-label={`${entry.display_name || entry.username} — score ${score}`}
      >
        {/* Rank */}
        <div className="w-7 flex items-center justify-center flex-shrink-0">
          <MedalBadge rank={entry.rank} />
        </div>

        {/* Avatar */}
        <Link
          href={`/profile/${entry.username}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
          aria-label={`View ${entry.username}'s profile`}
        >
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="sm"
          />
        </Link>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name || entry.username}
            </Link>
            <span
              className={cn(
                'hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0',
                ROLE_BADGE[entry.role] ?? ROLE_BADGE.person
              )}
            >
              {ROLE_LABEL[entry.role] ?? entry.role}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <DimIcon className={cn('h-3 w-3', dim.color)} />
            <span className={cn('text-[11px] font-mono', dim.color)}>{entry.top_dimension}</span>
          </div>
        </div>

        {/* Mini radar */}
        <div className="hidden sm:block">
          <MiniRadar entry={entry} />
        </div>

        {/* Score + grade */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-white tabular-nums">
              {score.toFixed(1)}
            </div>
            <div className="text-[10px] font-mono text-surface-500 uppercase">score</div>
          </div>
          <div
            className={cn(
              'hidden sm:flex h-8 w-8 items-center justify-center rounded-lg font-mono font-bold text-sm border',
              scoreGrade.text,
              scoreGrade.text.replace('text-', 'bg-') + '/10',
              scoreGrade.text.replace('text-', 'border-') + '/30'
            )}
            aria-label={`Grade ${scoreGrade.label}`}
          >
            {scoreGrade.label}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300/60 pt-3 space-y-3">
              {/* Dimension bars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ScoreBar score={entry.voter_score} color="text-for-400" label="Voter" />
                <ScoreBar score={entry.orator_score} color="text-gold" label="Orator" />
                <ScoreBar score={entry.stalwart_score} color="text-against-400" label="Stalwart" />
                <ScoreBar score={entry.scholar_score} color="text-emerald" label="Scholar" />
                <ScoreBar score={entry.strategist_score} color="text-purple" label="Strategist" />
              </div>

              {/* Raw stats */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-lg bg-surface-200 p-2 text-center">
                  <div className="text-sm font-mono font-semibold text-white">
                    {entry.total_votes.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-surface-500">votes</div>
                </div>
                <div className="rounded-lg bg-surface-200 p-2 text-center">
                  <div className="text-sm font-mono font-semibold text-white">
                    {entry.total_arguments.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-surface-500">arguments</div>
                </div>
                <div className="rounded-lg bg-surface-200 p-2 text-center">
                  <div className="text-sm font-mono font-semibold text-white">
                    {entry.vote_streak}d
                  </div>
                  <div className="text-[10px] text-surface-500">streak</div>
                </div>
              </div>

              {/* Profile link */}
              <Link
                href={`/profile/${entry.username}`}
                className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EngagementSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3"
        >
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-14 w-14 rounded-lg hidden sm:block" />
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EngagementLeaderboardPage() {
  const [data, setData] = useState<EngagementLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (showRefresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/leaderboard/engagement?limit=100', {
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error('Failed to load')
      const json: EngagementLeaderboardResponse = await res.json()
      setData(json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Could not load the engagement leaderboard.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const stats = data?.stats
  const entries = data?.entries ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/leaderboard"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors flex-shrink-0"
              aria-label="Back to Leaderboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-for-600/20 to-purple/20 border border-for-500/30">
                <Activity className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Engagement Index
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  The most well-rounded civic citizens
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Explainer card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" />
            <div className="text-xs font-mono text-surface-400 space-y-1">
              <p>
                The <span className="text-white font-semibold">Civic Engagement Index</span> is
                a decathlon-style score — it rewards citizens who excel across{' '}
                <span className="text-for-400">voting</span>,{' '}
                <span className="text-gold">arguing</span>,{' '}
                <span className="text-against-400">consistency</span>,{' '}
                <span className="text-emerald">scholarship</span>, and{' '}
                <span className="text-purple">strategy</span>.
              </p>
              <p className="text-surface-500">
                Specialists who max one category are outranked by citizens who
                participate broadly. Score range: 0–100.
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="text-xl font-mono font-bold text-white">
                <AnimatedNumber value={stats.total_participants} />
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase mt-0.5">
                citizens ranked
              </div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="text-xl font-mono font-bold text-gold">
                <AnimatedNumber value={stats.avg_score} decimals={1} />
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase mt-0.5">
                avg score
              </div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="text-xl font-mono font-bold text-emerald">
                <AnimatedNumber value={stats.perfect_score_count} />
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase mt-0.5">
                elite (S-tier)
              </div>
            </div>
          </div>
        )}

        {/* My rank banner */}
        {data?.my_rank && data.my_score !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-for-600/10 border border-for-500/30 p-3 mb-5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-for-400" />
              <span className="text-sm font-mono text-for-300">Your rank</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-white">
                #{data.my_rank}
              </span>
              <span className="text-sm font-mono font-bold text-for-400">
                {data.my_score.toFixed(1)} pts
              </span>
            </div>
          </motion.div>
        )}

        {/* Dimension legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(DIMENSION_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon
            const count = stats?.top_dimension_breakdown[key] ?? 0
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border',
                  cfg.bg,
                  cfg.border,
                  cfg.color
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {key}
                {count > 0 && (
                  <span className="text-surface-500 ml-0.5">({count})</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-surface-500">
            Top {entries.length} citizens
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw
              className={cn('h-3 w-3', refreshing && 'animate-spin')}
            />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <EngagementSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs font-mono text-for-400 hover:text-for-300 underline"
            >
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No rankings yet"
            description="Once citizens start voting, the engagement index will populate."
          />
        ) : (
          <div className="space-y-2" role="list" aria-label="Engagement leaderboard">
            {entries.map((entry) => (
              <div key={entry.user_id} role="listitem">
                <EntryRow
                  entry={entry}
                  expanded={expandedId === entry.user_id}
                  onToggle={() =>
                    setExpandedId((prev) =>
                      prev === entry.user_id ? null : entry.user_id
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer tips */}
        <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="text-xs font-mono text-surface-400 font-semibold uppercase tracking-wider">
            How to climb
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: Vote, color: 'text-for-400', tip: 'Cast 300+ votes to max Voter score' },
              { icon: Mic, color: 'text-gold', tip: 'Write 40+ arguments to max Orator score' },
              { icon: Flame, color: 'text-against-400', tip: 'Maintain a 21-day streak for Stalwart' },
              { icon: BookOpen, color: 'text-emerald', tip: 'Earn 5 000+ reputation for Scholar' },
              { icon: Coins, color: 'text-purple', tip: 'Accumulate 30+ Clout for Strategist' },
            ].map(({ icon: Icon, color, tip }) => (
              <div key={tip} className="flex items-start gap-2">
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', color)} />
                <span className="text-[11px] font-mono text-surface-500">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
