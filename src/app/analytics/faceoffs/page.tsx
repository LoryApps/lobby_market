'use client'

/**
 * /analytics/faceoffs — Faceoff Judge Analytics
 *
 * Shows how the authenticated user has performed as a JUDGE in the
 * Argument Arena faceoff system — not how their own arguments fared,
 * but how their picks compare to the community majority.
 *
 * Distinct from:
 *   /analytics/arguments  — stats for your OWN written arguments
 *   /arguments/champions  — all-time top arena argument leaderboard
 *   /arguments/faceoff    — play the faceoff game
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  FaceoffJudgingStats,
  RecentFaceoffVote,
  CategoryStat,
  JudgeArchetype,
} from '@/app/api/analytics/faceoffs/route'

// ─── Archetype config ─────────────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<
  JudgeArchetype,
  {
    label: string
    description: string
    icon: typeof Trophy
    color: string
    bg: string
    border: string
  }
> = {
  oracle: {
    label: 'The Oracle',
    description: "Your taste aligns with the majority 65%+ of the time. The crowd trusts your judgment — you spot quality arguments before they trend.",
    icon: Sparkles,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  consensus: {
    label: 'The Consensus Builder',
    description: "Your picks match the majority 50–65% of the time. You have mainstream sensibilities — reliable and broadly representative.",
    icon: Scale,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  contrarian: {
    label: 'The Contrarian',
    description: "Your picks diverge from the majority 50–60% of the time. You see merit where others miss it — or you just march to your own drum.",
    icon: Zap,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  maverick: {
    label: 'The Maverick',
    description: "Your picks defy the majority more than 60% of the time. Independent and uncompromising — you evaluate on your own terms.",
    icon: Flame,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  newcomer: {
    label: 'The Newcomer',
    description: "Judge more faceoffs to unlock your full archetype. Play at least 10 rounds in the Argument Arena to see how you compare.",
    icon: Award,
    color: 'text-surface-400',
    bg: 'bg-surface-200/40',
    border: 'border-surface-300/40',
  },
}

// ─── Category colours ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-400',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-400',
  Philosophy:  'bg-purple',
  Culture:     'bg-for-300',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-gold',
}

function categoryColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'bg-surface-400') : 'bg-surface-400'
}

// ─── Stat card ────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 sm:p-5 flex flex-col gap-1">
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">{label}</p>
      <div className={cn('font-mono text-2xl font-bold', accent ?? 'text-white')}>{value}</div>
      {sub && <p className="text-xs text-surface-500 font-mono">{sub}</p>}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Alignment bar ────────────────────────────────────────────────────────────────────────

function AlignmentBar({ rate }: { rate: number }) {
  const color =
    rate >= 65 ? 'bg-gold'
    : rate >= 50 ? 'bg-for-400'
    : rate >= 40 ? 'bg-purple'
    : 'bg-against-400'

  return (
    <div className="relative h-3 w-full rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${rate}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      />
      {/* 50% marker */}
      <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: '50%' }} />
    </div>
  )
}

// ─── FOR vs AGAINST preference bar ───────────────────────────────────────────────

function SideBar({ forRate }: { forRate: number }) {
  const againstRate = 100 - forRate
  return (
    <div className="flex gap-1 h-3 rounded-full overflow-hidden">
      <motion.div
        className="bg-for-500 rounded-l-full"
        initial={{ width: 0 }}
        animate={{ width: `${forRate}%` }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
      />
      <motion.div
        className="bg-against-500 rounded-r-full flex-1"
        initial={{ width: 0 }}
        animate={{ width: `${againstRate}%` }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
      />
    </div>
  )
}

// ─── Recent vote row ────────────────────────────────────────────────────────────────────

function VoteRow({ vote, index }: { vote: RecentFaceoffVote; index: number }) {
  const agreed = vote.majority_agreed
  const sideLabel = vote.winner_side === 'blue' ? 'FOR' : vote.winner_side === 'red' ? 'AGAINST' : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      {/* Alignment indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {agreed === true ? (
          <CheckCircle2 className="h-5 w-5 text-emerald" />
        ) : agreed === false ? (
          <XCircle className="h-5 w-5 text-against-400" />
        ) : (
          <Circle className="h-5 w-5 text-surface-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Winner argument snippet */}
        <p className="text-sm text-surface-200 leading-snug line-clamp-2 mb-1.5">
          {vote.winner_content ?? 'Argument text unavailable'}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Side badge */}
          {sideLabel && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                vote.winner_side === 'blue'
                  ? 'bg-for-500/15 text-for-300 border border-for-500/30'
                  : 'bg-against-500/15 text-against-300 border border-against-500/30'
              )}
            >
              {vote.winner_side === 'blue' ? (
                <ThumbsUp className="h-2.5 w-2.5" />
              ) : (
                <ThumbsDown className="h-2.5 w-2.5" />
              )}
              {sideLabel}
            </span>
          )}

          {/* Category */}
          {vote.topic_category && (
            <span className="text-[11px] text-surface-500 font-mono">{vote.topic_category}</span>
          )}

          {/* Community agreement */}
          {vote.pair_total_votes > 1 && (
            <span className="text-[11px] text-surface-500 font-mono ml-auto">
              {vote.pair_agreement_votes}/{vote.pair_total_votes} agreed
            </span>
          )}
        </div>

        {/* Topic link */}
        {vote.topic_id && vote.topic_statement && (
          <Link
            href={`/topic/${vote.topic_id}`}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-surface-500 hover:text-for-300 transition-colors line-clamp-1"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            {vote.topic_statement}
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────────────────

function CategoryRow({ stat, max }: { stat: CategoryStat; max: number }) {
  const pct = max > 0 ? (stat.judged / max) * 100 : 0
  const forPct = stat.judged > 0 ? Math.round((stat.for_picks / stat.judged) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono text-surface-200 truncate">
          {stat.category ?? 'Unknown'}
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-for-400 font-mono">{forPct}% FOR</span>
          <span className="text-xs text-surface-500 font-mono">{stat.judged} judged</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', categoryColor(stat.category))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────────────────────

export default function FaceoffAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<FaceoffJudgingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [authed, setAuthed] = useState(true)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/analytics/faceoffs', { cache: 'no-store' })
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login?next=/analytics/faceoffs')
      } else {
        load()
      }
    })
  }, [load, router])

  const archetypeConfig = data
    ? ARCHETYPE_CONFIG[data.archetype]
    : null

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-12">
        {/* ── Header ────────────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
            <Swords className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              Faceoff Judge Record
            </h1>
            <p className="text-xs text-surface-500 font-mono">
              How your argument picks compare to community consensus
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh data"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : !authed ? null : data?.total_judged === 0 ? (
          /* ── Empty state ────────────────────────────────────────────────────────────────── */}
          <div className="space-y-6">
            <EmptyState
              icon={Swords}
              title="No faceoffs judged yet"
              description="Visit the Argument Arena to start judging head-to-head matchups. Pick the more compelling argument — your stats will appear here."
            />
            <div className="flex justify-center">
              <Link
                href="/arguments/faceoff"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple/15 border border-purple/30 text-purple text-sm font-mono font-semibold hover:bg-purple/25 transition-colors"
              >
                <Swords className="h-4 w-4" />
                Go to Argument Arena
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* ── Hero stats grid ─────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Judged"
                  value={<AnimatedNumber value={data.total_judged} />}
                  sub="faceoffs"
                  accent="text-white"
                />
                <StatCard
                  label="This Week"
                  value={<AnimatedNumber value={data.week_judged} />}
                  sub="faceoffs"
                  accent="text-for-300"
                />
                <StatCard
                  label="Majority Rate"
                  value={
                    data.alignment_rate !== null
                      ? <><AnimatedNumber value={data.alignment_rate} />%</>
                      : '—'
                  }
                  sub={data.alignment_rate !== null ? 'agree with crowd' : 'need 3+ data points'}
                  accent={
                    data.alignment_rate === null ? 'text-surface-400'
                    : data.alignment_rate >= 65 ? 'text-gold'
                    : data.alignment_rate >= 50 ? 'text-emerald'
                    : 'text-against-300'
                  }
                />
                <StatCard
                  label="Active Days"
                  value={<AnimatedNumber value={data.active_days} />}
                  sub={`peak ${data.peak_daily}/day`}
                  accent="text-purple"
                />
              </div>

              {/* ── Archetype card ─────────────────────────────────────────────────────────── */}
              {archetypeConfig && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'rounded-2xl border p-5',
                    archetypeConfig.bg,
                    archetypeConfig.border
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'flex items-center justify-center h-12 w-12 rounded-xl border flex-shrink-0',
                        archetypeConfig.bg,
                        archetypeConfig.border
                      )}
                    >
                      <archetypeConfig.icon
                        className={cn('h-6 w-6', archetypeConfig.color)}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-0.5">
                        Judge Archetype
                      </p>
                      <h2 className={cn('font-mono text-xl font-bold mb-1', archetypeConfig.color)}>
                        {archetypeConfig.label}
                      </h2>
                      <p className="text-sm text-surface-400 leading-relaxed">
                        {archetypeConfig.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Alignment + side preference ───────────────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-5"
              >
                <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-surface-500" />
                  Judging Patterns
                </h3>

                {/* Alignment rate bar */}
                {data.alignment_rate !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-surface-500">Majority Alignment</span>
                      <span className="text-xs font-mono font-semibold text-white">
                        {data.alignment_rate}%
                      </span>
                    </div>
                    <AlignmentBar rate={data.alignment_rate} />
                    <div className="flex justify-between text-[10px] font-mono text-surface-600">
                      <span>Maverick (0%)</span>
                      <span className="text-surface-500">Consensus (50%)</span>
                      <span>Oracle (100%)</span>
                    </div>
                  </div>
                )}

                {/* Side preference bar */}
                {data.for_pick_rate !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-surface-500">Side Preference</span>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-for-400">{data.for_pick_rate}% FOR</span>
                        <span className="text-against-400">{100 - data.for_pick_rate}% AGAINST</span>
                      </div>
                    </div>
                    <SideBar forRate={data.for_pick_rate} />
                    <p className="text-[11px] text-surface-600 font-mono">
                      {data.for_pick_rate > 60
                        ? 'You tend to favour FOR-side arguments in Arena matchups.'
                        : data.for_pick_rate < 40
                        ? 'You tend to favour AGAINST-side arguments in Arena matchups.'
                        : 'You judge both sides roughly evenly — a balanced evaluator.'}
                    </p>
                  </div>
                )}
              </motion.div>

              {/* ── Category breakdown ────────────────────────────────────────────────────────── */}
              {data.category_breakdown.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
                >
                  <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-surface-500" />
                    Faceoffs by Category
                  </h3>
                  <div className="space-y-4">
                    {data.category_breakdown.map((stat) => (
                      <CategoryRow
                        key={stat.category ?? 'unknown'}
                        stat={stat}
                        max={data.category_breakdown[0]?.judged ?? 1}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Recent judging history ────────────────────────────────────────────────────────────────── */}
              {data.recent_votes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-surface-500" />
                      Recent Picks
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-surface-600">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald" /> matched majority
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-against-400" /> diverged
                      </span>
                    </div>
                  </div>

                  {data.recent_votes.map((vote, i) => (
                    <VoteRow key={`${vote.argument_a_id}-${vote.argument_b_id}`} vote={vote} index={i} />
                  ))}
                </motion.div>
              )}

              {/* ── CTA strip ───────────────────────────────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 pt-2"
              >
                <Link
                  href="/arguments/faceoff"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple/15 border border-purple/30 text-purple text-sm font-mono font-semibold hover:bg-purple/25 transition-colors"
                >
                  <Swords className="h-4 w-4" />
                  Judge More Faceoffs
                </Link>
                <Link
                  href="/arguments/champions"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface-100 border border-surface-300 text-surface-300 text-sm font-mono hover:border-surface-400 transition-colors"
                >
                  <Trophy className="h-4 w-4" />
                  View Arena Champions
                </Link>
                <Link
                  href="/analytics/arguments"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface-100 border border-surface-300 text-surface-300 text-sm font-mono hover:border-surface-400 transition-colors"
                >
                  <BarChart2 className="h-4 w-4" />
                  Argument Portfolio
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
