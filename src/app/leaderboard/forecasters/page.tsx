'use client'

/**
 * /leaderboard/forecasters — Debate Forecasters
 *
 * Ranks citizens by their pre-debate outcome prediction accuracy.
 * Uses the debate_predictions table — distinct from topic_predictions.
 *
 * Three ranked views:
 *   By Accuracy   — highest % correct debate winner predictions (min 2 resolved)
 *   By Precision  — lowest average sway error (how well they predicted opinion shift)
 *   By Clout Earned — most clout collected from correct debate calls
 *
 * Distinct from:
 *   /leaderboard/predictions  — topic outcome predictions (law vs. fail)
 *   /leaderboard/calibration  — vote accuracy (how often voted with the winning side)
 *   /debate/[id]/predictions  — per-debate prediction breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Coins,
  Crown,
  Gauge,
  Medal,
  Mic,
  RefreshCw,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  ForecasterEntry,
  ForecastersLeaderboardResponse,
  RecentDebateResolution,
} from '@/app/api/leaderboard/forecasters/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-300 flex-shrink-0" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600 flex-shrink-0" />
  return (
    <span className="text-xs font-mono text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-700/10 border-amber-700/30'
  return 'bg-surface-100/50 border-surface-300/20'
}

function AccuracyBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? 'bg-emerald/15 border-emerald/30 text-emerald'
      : pct >= 65
        ? 'bg-for-500/15 border-for-500/30 text-for-300'
        : pct >= 50
          ? 'bg-gold/15 border-gold/30 text-gold'
          : 'bg-against-500/15 border-against-500/30 text-against-300'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold border flex-shrink-0',
        color
      )}
    >
      {pct}%
    </span>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Target
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-surface-300 bg-surface-100 px-3 py-3">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <p className="text-sm font-mono font-bold text-white leading-none">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      <p className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</p>
    </div>
  )
}

// ─── Row sub-components ───────────────────────────────────────────────────────

function ForecasterRow({
  entry,
  view,
  index,
}: {
  entry: ForecasterEntry
  view: 'accuracy' | 'precision' | 'clout'
  index: number
}) {
  const primaryMetric =
    view === 'clout'
      ? `${fmtNum(entry.clout_earned)} C`
      : view === 'precision'
        ? entry.avg_sway_error !== null
          ? `±${entry.avg_sway_error}pp`
          : '—'
        : `${entry.winner_accuracy_pct}%`

  const subLabel =
    view === 'clout'
      ? `${entry.winner_accuracy_pct}% accuracy · ${entry.total_resolved} resolved`
      : view === 'precision'
        ? `${entry.winner_accuracy_pct}% winner accuracy`
        : `${entry.correct_winners}/${entry.total_resolved} correct`

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors hover:border-surface-400/60',
          rankBg(entry.rank)
        )}
      >
        <RankMedal rank={entry.rank} />
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {entry.display_name || entry.username}
          </p>
          <p className="text-[11px] font-mono text-surface-500 truncate">
            {subLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {view === 'accuracy' && <AccuracyBadge pct={entry.winner_accuracy_pct} />}
          <span
            className={cn(
              'text-sm font-mono font-bold',
              view === 'clout'
                ? 'text-gold'
                : view === 'precision'
                  ? 'text-purple'
                  : 'text-for-300'
            )}
          >
            {primaryMetric}
          </span>
          <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Debate resolution card ───────────────────────────────────────────────────

function DebateResolutionCard({ debate }: { debate: RecentDebateResolution }) {
  const forPct = debate.predicted_for_pct
  const againstPct = debate.predicted_against_pct

  return (
    <Link
      href={`/debate/${debate.debate_id}/predictions`}
      className="flex flex-col gap-2 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white line-clamp-2 flex-1">{debate.title}</p>
        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0 uppercase">
          {debate.type}
        </span>
      </div>

      {/* Prediction split bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-surface-200">
        <div
          className="bg-for-500 rounded-l-full"
          style={{ width: `${forPct}%` }}
        />
        {debate.predicted_tie_pct > 0 && (
          <div
            className="bg-surface-400"
            style={{ width: `${debate.predicted_tie_pct}%` }}
          />
        )}
        <div
          className="bg-against-500 rounded-r-full flex-1"
          style={{ width: `${againstPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-for-400 flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" /> {forPct}%
          </span>
          {debate.predicted_tie_pct > 0 && (
            <span className="text-surface-400">{debate.predicted_tie_pct}% tie</span>
          )}
          <span className="text-against-400 flex items-center gap-1">
            <ThumbsDown className="h-3 w-3" /> {againstPct}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <Target className="h-3 w-3 text-emerald" />
          <span className="text-emerald font-semibold">{debate.winner_accuracy_pct}% correct</span>
          <span className="text-surface-500">· {fmtNum(debate.total_predictors)} forecasters</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-14 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── View tabs ────────────────────────────────────────────────────────────────

type View = 'accuracy' | 'precision' | 'clout'

const VIEWS: { id: View; label: string; icon: typeof Target; description: string }[] = [
  {
    id: 'accuracy',
    label: 'Winner Accuracy',
    icon: Target,
    description: 'Best at picking the debate winner',
  },
  {
    id: 'precision',
    label: 'Sway Precision',
    icon: Gauge,
    description: 'Closest to actual opinion shift',
  },
  {
    id: 'clout',
    label: 'Clout Earned',
    icon: Coins,
    description: 'Most clout from accurate calls',
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function ForecastersLeaderboardPage() {
  const [data, setData] = useState<ForecastersLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('accuracy')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/forecasters')
      if (!res.ok) throw new Error('Failed to load forecasters')
      const json = (await res.json()) as ForecastersLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the Forecasters leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeList =
    view === 'accuracy'
      ? data?.topByAccuracy ?? []
      : view === 'precision'
        ? data?.topByPrecision ?? []
        : data?.topByClout ?? []

  const stats = data?.platformStats
  const myStats = data?.myStats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </Link>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple" />
                Debate Forecasters
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Who called the winner before the debate even started?
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4 text-white', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats ───────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              icon={Brain}
              value={fmtNum(stats.total_forecasters)}
              label="Forecasters"
              color="text-purple"
            />
            <StatCard
              icon={Target}
              value={`${stats.platform_winner_accuracy_pct}%`}
              label="Platform Accuracy"
              color="text-for-400"
            />
            <StatCard
              icon={Mic}
              value={fmtNum(stats.debates_with_predictions)}
              label="Debates Called"
              color="text-emerald"
            />
          </div>
        )}

        {/* ── My stats (if logged in & has predictions) ────────────────────── */}
        {myStats && myStats.total_resolved > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-purple/30 p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-purple">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider">
                Your Forecast Record
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">
                  {myStats.winner_accuracy_pct}%
                </p>
                <p className="text-[10px] font-mono text-surface-500">Winner accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">
                  {myStats.correct_winners}/{myStats.total_resolved}
                </p>
                <p className="text-[10px] font-mono text-surface-500">Correct calls</p>
              </div>
              {myStats.avg_sway_error !== null && (
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    ±{myStats.avg_sway_error}pp
                  </p>
                  <p className="text-[10px] font-mono text-surface-500">Avg sway error</p>
                </div>
              )}
              {myStats.clout_earned > 0 && (
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-gold">
                    +{fmtNum(myStats.clout_earned)}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500">Clout earned</p>
                </div>
              )}
            </div>
            {(myStats.accuracyRank || myStats.precisionRank) && (
              <div className="flex items-center gap-3 pt-1 border-t border-surface-300">
                {myStats.accuracyRank && (
                  <span className="text-xs font-mono text-surface-400">
                    Accuracy rank:{' '}
                    <span className="text-white font-semibold">#{myStats.accuracyRank}</span>
                  </span>
                )}
                {myStats.precisionRank && (
                  <span className="text-xs font-mono text-surface-400">
                    Precision rank:{' '}
                    <span className="text-white font-semibold">#{myStats.precisionRank}</span>
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── View tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 px-1.5 rounded-lg text-center transition-all',
                view === v.id
                  ? 'bg-surface-50 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono font-semibold leading-tight">{v.label}</span>
            </button>
          ))}
        </div>

        {/* ── View description ─────────────────────────────────────────────── */}
        <p className="text-xs font-mono text-surface-500 -mt-3">
          {VIEWS.find((v) => v.id === view)?.description}
          {view === 'accuracy' && ' — minimum 2 resolved predictions required'}
          {view === 'precision' && ' — lower error = better sway prediction accuracy'}
        </p>

        {/* ── Leaderboard list ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Target className="h-8 w-8 text-surface-400" />}
                title="Could not load forecasters"
                description={error}
                action={
                  <button
                    onClick={load}
                    className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                  >
                    Try again
                  </button>
                }
              />
            </motion.div>
          ) : activeList.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Brain className="h-8 w-8 text-surface-400" />}
                title="No forecasters yet"
                description="Be the first to predict a debate outcome. Go to an upcoming debate and make your call before it starts."
                action={
                  <Link
                    href="/debate"
                    className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                  >
                    Browse Debates
                  </Link>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key={`list-${view}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {activeList.map((entry, i) => (
                <ForecasterRow key={entry.user_id} entry={entry} view={view} index={i} />
              ))}

              {activeList.length >= 50 && (
                <p className="text-center text-xs font-mono text-surface-500 pt-2">
                  Showing top 50 forecasters
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recent debate resolutions ─────────────────────────────────────── */}
        {data && data.recentResolutions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
              <Mic className="h-3.5 w-3.5" />
              Recent Debate Results
            </h2>
            <div className="space-y-2">
              {data.recentResolutions.map((debate) => (
                <DebateResolutionCard key={debate.debate_id} debate={debate} />
              ))}
            </div>
          </section>
        )}

        {/* ── Related links ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
            Related Rankings
          </h2>
          {[
            { href: '/leaderboard/predictions', label: 'Topic Predictions', desc: 'Law vs. fail accuracy' },
            { href: '/leaderboard/calibration', label: 'Vote Calibration', desc: 'Voting with the winning side' },
            { href: '/leaderboard/debates', label: 'Debate Stats', desc: 'Most-watched and decisive debates' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-2 py-2 border-b border-surface-300 last:border-0 hover:text-white transition-colors group"
            >
              <div>
                <p className="text-sm font-mono text-white group-hover:text-for-300 transition-colors">
                  {link.label}
                </p>
                <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </section>

        {/* ── Back to leaderboard ───────────────────────────────────────────── */}
        <div className="flex items-center justify-center pt-2">
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Leaderboards
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
