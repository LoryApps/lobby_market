'use client'

/**
 * /leaderboard/civic-score — Civic Score Leaderboard
 *
 * Ranks citizens by a composite Civic Score spanning four dimensions:
 *   Engagement  (30%) — votes cast, daily voting habit, streak length
 *   Quality     (25%) — arguments written, laws authored
 *   Influence   (25%) — clout earned, followers gained
 *   Consistency (20%) — vote streak, long-term participation
 *
 * Distinct from:
 *   /leaderboard/reputation — purely votes × 1 + topics × 5 + laws × 50
 *   /leaderboard/clout      — raw clout balance
 *   /leaderboard/grades     — argument AI grade quality only
 *   /civic-score            — your personal score breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
  Crown,
  Flame,
  Loader2,
  Medal,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicScoreEntry, CivicScoreLeaderboardResponse } from '@/app/api/leaderboard/civic-score/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  lawmaker: 'Lawmaker',
  senator: 'Senator',
  elder: 'Elder',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  person: 'Citizen',
}

const ROLE_COLOR: Record<string, string> = {
  lawmaker: 'text-gold',
  senator: 'text-purple',
  elder: 'text-gold',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  person: 'text-surface-500',
}

const DIM_CONFIG = [
  {
    key: 'engagement_score' as const,
    label: 'Engage',
    icon: Flame,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    bar: 'bg-for-500',
    tooltip: 'Votes cast + daily habit + streak',
  },
  {
    key: 'quality_score' as const,
    label: 'Quality',
    icon: Brain,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    bar: 'bg-purple',
    tooltip: 'Arguments written + laws authored',
  },
  {
    key: 'influence_score' as const,
    label: 'Influence',
    icon: Users,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
    bar: 'bg-emerald',
    tooltip: 'Clout earned + followers',
  },
  {
    key: 'consistency_score' as const,
    label: 'Consist.',
    icon: Activity,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    bar: 'bg-gold',
    tooltip: 'Vote streak + long-term participation',
  },
]

type FilterMode = 'all' | 'lawmaker' | 'senator' | 'elder' | 'debator'

const FILTER_OPTIONS: { id: FilterMode; label: string }[] = [
  { id: 'all', label: 'All Citizens' },
  { id: 'lawmaker', label: 'Lawmakers' },
  { id: 'senator', label: 'Senators' },
  { id: 'elder', label: 'Elders' },
  { id: 'debator', label: 'Debators' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function civicGrade(score: number): { grade: string; color: string } {
  if (score >= 85) return { grade: 'A+', color: 'text-emerald' }
  if (score >= 75) return { grade: 'A', color: 'text-emerald' }
  if (score >= 65) return { grade: 'B+', color: 'text-for-300' }
  if (score >= 55) return { grade: 'B', color: 'text-for-400' }
  if (score >= 45) return { grade: 'C+', color: 'text-gold' }
  if (score >= 35) return { grade: 'C', color: 'text-gold' }
  if (score >= 25) return { grade: 'D', color: 'text-against-400' }
  return { grade: 'F', color: 'text-against-500' }
}

function podiumConfig(rank: number) {
  if (rank === 1) return { medal: '🥇', height: 'h-28', border: 'border-gold/50', bg: 'bg-gold/5', glow: 'shadow-gold/20 shadow-lg' }
  if (rank === 2) return { medal: '🥈', height: 'h-20', border: 'border-surface-400/50', bg: 'bg-surface-200/50', glow: '' }
  return { medal: '🥉', height: 'h-16', border: 'border-against-500/30', bg: 'bg-against-500/5', glow: '' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ value, barClass }: { value: number; barClass: string }) {
  return (
    <div className="w-full h-1 rounded-full bg-surface-300/50 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', barClass)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function PodiumCard({ entry, rank }: { entry: CivicScoreEntry; rank: number }) {
  const cfg = podiumConfig(rank)
  const { grade, color } = civicGrade(entry.civic_index)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors',
          'hover:border-surface-400/60',
          cfg.border, cfg.bg, cfg.glow,
        )}
        aria-label={`${entry.display_name ?? entry.username} — Rank ${rank}`}
      >
        <span className="text-2xl" role="img" aria-label={`Rank ${rank} medal`}>{cfg.medal}</span>
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="md"
        />
        <div className="text-center min-w-0 w-full">
          <p className="text-xs font-semibold text-white truncate">
            {entry.display_name ?? entry.username}
          </p>
          <p className={cn('text-[10px] font-mono', ROLE_COLOR[entry.role] ?? 'text-surface-500')}>
            {ROLE_LABEL[entry.role] ?? entry.role}
          </p>
        </div>
        <div className={cn('text-2xl font-mono font-bold', color)}>
          {entry.civic_index}
        </div>
        <div className={cn('text-xs font-mono font-semibold', color)}>
          Grade {grade}
        </div>
      </Link>
    </motion.div>
  )
}

function EntryRow({ entry, index }: { entry: CivicScoreEntry; index: number }) {
  const { grade, color } = civicGrade(entry.civic_index)
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.5) }}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        'bg-surface-100 border-surface-300 hover:border-surface-400/60',
      )}
    >
      {/* Rank */}
      <div className="w-7 text-center text-[11px] font-mono text-surface-600 flex-shrink-0">
        {entry.rank <= 3 ? (
          <span role="img" aria-label={`Rank ${entry.rank}`}>
            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
          </span>
        ) : (
          entry.rank
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

      {/* Name + role */}
      <Link href={`/profile/${entry.username}`} className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">
          {entry.display_name ?? entry.username}
        </p>
        <p className={cn('text-[10px] font-mono truncate', ROLE_COLOR[entry.role] ?? 'text-surface-500')}>
          @{entry.username}
        </p>
      </Link>

      {/* Dimensional mini-bars */}
      <div className="hidden sm:flex flex-col gap-0.5 w-20 flex-shrink-0">
        {DIM_CONFIG.map((dim) => (
          <ScoreBar key={dim.key} value={entry[dim.key]} barClass={dim.bar} />
        ))}
      </div>

      {/* Composite score + grade */}
      <div className="flex flex-col items-end flex-shrink-0">
        <span className={cn('text-base font-mono font-bold', color)}>
          {entry.civic_index}
        </span>
        <span className={cn('text-[10px] font-mono', color)}>
          {grade}
        </span>
      </div>

      <Link
        href={`/profile/${entry.username}`}
        className="flex-shrink-0 text-surface-600 hover:text-surface-400 transition-colors"
        aria-label={`View ${entry.username}'s profile`}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </motion.div>
  )
}

function ExpandedStats({ entry }: { entry: CivicScoreEntry }) {
  return (
    <div className="mt-2 rounded-xl bg-surface-200/50 border border-surface-300/50 p-3 space-y-2">
      {DIM_CONFIG.map((dim) => {
        const score = entry[dim.key]
        return (
          <div key={dim.key} className="flex items-center gap-2">
            <dim.icon className={cn('h-3.5 w-3.5 flex-shrink-0', dim.color)} aria-hidden />
            <span className="text-[11px] font-mono text-surface-500 w-16 flex-shrink-0">{dim.label}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-300/50 overflow-hidden">
              <div
                className={cn('h-full rounded-full', dim.bar)}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={cn('text-[11px] font-mono font-semibold w-7 text-right', dim.color)}>
              {score}
            </span>
          </div>
        )
      })}
      <div className="pt-1 flex gap-4 flex-wrap">
        <span className="text-[10px] font-mono text-surface-600">
          {entry.total_votes.toLocaleString()} votes
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          {entry.total_arguments} args
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          {entry.vote_streak}d streak
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          {entry.clout.toLocaleString()} clout
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          {entry.followers_count} followers
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicScoreLeaderboardClient() {
  const [data, setData] = useState<CivicScoreLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/civic-score')
      if (!res.ok) throw new Error('Failed to load')
      const json: CivicScoreLeaderboardResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load the Civic Score Leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const entries = data?.entries ?? []
  const filtered = filter === 'all'
    ? entries
    : entries.filter((e) => e.role === filter)

  const podium = filtered.slice(0, 3)
  const rest = filtered.slice(3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple flex-shrink-0" aria-hidden />
              <h1 className="font-mono text-xl font-bold text-white truncate">
                Civic Score Leaderboard
              </h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Multi-dimensional ranking: engagement · quality · influence · consistency
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Platform stats strip */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5">
              <p className="text-[10px] font-mono text-surface-600 mb-0.5">Participants</p>
              <p className="text-lg font-mono font-bold text-white">
                {data.platformStats.total_participants.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5">
              <p className="text-[10px] font-mono text-surface-600 mb-0.5">Avg Score</p>
              <p className="text-lg font-mono font-bold text-purple">
                {data.platformStats.avg_civic_index}
              </p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-for-500/20 bg-for-500/5 px-3 py-2.5">
              <p className="text-[10px] font-mono text-surface-600 mb-0.5">Peak Engage</p>
              <p className="text-lg font-mono font-bold text-for-400">
                {data.platformStats.top_engagement}
              </p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-emerald/20 bg-emerald/5 px-3 py-2.5">
              <p className="text-[10px] font-mono text-surface-600 mb-0.5">Peak Influence</p>
              <p className="text-lg font-mono font-bold text-emerald">
                {data.platformStats.top_influence}
              </p>
            </div>
          </motion.div>
        )}

        {/* Dimension legend */}
        <div className="flex gap-2 flex-wrap mb-5">
          {DIM_CONFIG.map((dim) => (
            <div
              key={dim.key}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                dim.bg, dim.border,
              )}
            >
              <dim.icon className={cn('h-3 w-3', dim.color)} aria-hidden />
              <span className={cn('text-[10px] font-mono font-semibold', dim.color)}>
                {dim.label}
              </span>
            </div>
          ))}
          <Link
            href="/civic-score"
            className="flex items-center gap-1.5 rounded-full border border-surface-400/40 bg-surface-200/60 px-2.5 py-1 hover:border-purple/40 hover:bg-purple/10 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-purple" aria-hidden />
            <span className="text-[10px] font-mono text-purple">Your score</span>
          </Link>
        </div>

        {/* Role filter */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={cn(
                'rounded-full border text-[11px] font-mono px-3 py-1 transition-colors',
                filter === opt.id
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
                <Skeleton className="h-5 w-6" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-12 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <EmptyState
            icon={<BarChart2 className="h-8 w-8 text-surface-500" />}
            title="Failed to load"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Shield className="h-8 w-8 text-surface-500" />}
            title="No results"
            description={
              filter === 'all'
                ? 'No civic participants found yet.'
                : `No ${FILTER_OPTIONS.find((f) => f.id === filter)?.label ?? filter} found.`
            }
          />
        )}

        {/* Podium (top 3) */}
        {!loading && !error && podium.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {/* Reorder: 2nd, 1st, 3rd for podium effect */}
            {[podium[1], podium[0], podium[2]].map((entry, i) => {
              if (!entry) return <div key={i} />
              const rank = i === 0 ? 2 : i === 1 ? 1 : 3
              return (
                <PodiumCard key={entry.user_id} entry={entry} rank={rank} />
              )
            })}
          </div>
        )}

        {/* Ranked list */}
        {!loading && !error && rest.length > 0 && (
          <div className="space-y-1.5" role="list" aria-label="Civic Score rankings">
            <div className="flex items-center gap-3 px-3 pb-1">
              <div className="w-7 text-[10px] font-mono text-surface-600 text-center">Rank</div>
              <div className="w-8 flex-shrink-0" />
              <div className="flex-1 text-[10px] font-mono text-surface-600 uppercase tracking-wide">Citizen</div>
              <div className="hidden sm:block text-[10px] font-mono text-surface-600 uppercase tracking-wide w-20 text-center">Dimensions</div>
              <div className="text-[10px] font-mono text-surface-600 uppercase tracking-wide pr-5">Score</div>
            </div>
            {rest.map((entry, i) => (
              <div key={entry.user_id} role="listitem">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedId(expandedId === entry.user_id ? null : entry.user_id)}
                  aria-expanded={expandedId === entry.user_id}
                  aria-controls={`stats-${entry.user_id}`}
                >
                  <EntryRow entry={entry} index={i} />
                </button>
                <AnimatePresence>
                  {expandedId === entry.user_id && (
                    <motion.div
                      id={`stats-${entry.user_id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden px-1"
                    >
                      <ExpandedStats entry={entry} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {filtered.length >= 100 && (
              <p className="text-center text-xs font-mono text-surface-600 pt-2 pb-1">
                Showing top 100 · Participate more to climb the ranks
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        {!loading && !error && (
          <div className="mt-8 rounded-2xl bg-purple/5 border border-purple/20 p-5 text-center">
            <Sparkles className="h-8 w-8 text-purple mx-auto mb-3" aria-hidden />
            <p className="text-sm font-mono font-semibold text-white mb-1">
              Improve your Civic Score
            </p>
            <p className="text-xs font-mono text-surface-500 mb-4">
              Vote daily, write quality arguments, build influence, and stay consistent.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/civic-score"
                className="flex items-center gap-1.5 rounded-lg bg-purple/20 border border-purple/30 text-purple px-4 py-2 text-xs font-mono font-semibold hover:bg-purple/30 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" aria-hidden />
                My Score
              </Link>
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 px-4 py-2 text-xs font-mono font-semibold hover:border-for-500/40 hover:text-for-400 transition-colors"
              >
                <Flame className="h-3.5 w-3.5" aria-hidden />
                Vote Now
              </Link>
              <Link
                href="/coach"
                className="flex items-center gap-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 px-4 py-2 text-xs font-mono font-semibold hover:border-emerald/40 hover:text-emerald transition-colors"
              >
                <Brain className="h-3.5 w-3.5" aria-hidden />
                Argument Coach
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
