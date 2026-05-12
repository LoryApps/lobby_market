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
    description: "You diverge from the crowd 50–60% of the time. You notice value in arguments others overlook — or you just have unusual taste.",
    icon: Flame,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  maverick: {
    label: 'The Maverick',
    description: "Your picks match the majority less than 40% of the time. You march to your own beat — whether that's insight or idiosyncrasy.",
    icon: Zap,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  newcomer: {
    label: 'The Newcomer',
    description: "You're just getting started. Judge at least 10 faceoffs to unlock your archetype.",
    icon: Circle,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    Politics: 'text-for-400', Economics: 'text-gold', Technology: 'text-purple',
    Science: 'text-emerald', Ethics: 'text-for-300', Philosophy: 'text-purple',
    Culture: 'text-against-300', Health: 'text-emerald', Environment: 'text-emerald',
    Education: 'text-gold',
  }
  return cat ? (map[cat] ?? 'text-surface-400') : 'text-surface-500'
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: number | string; sub?: string; icon: typeof Trophy; color: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-0.5">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-surface-500 font-mono">{sub}</div>}
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  )
}

function AlignmentBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, rate))
  const color = pct >= 65 ? 'bg-gold' : pct >= 50 ? 'bg-for-500' : pct >= 40 ? 'bg-against-500' : 'bg-purple'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-surface-300 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono font-bold text-white w-12 text-right shrink-0">{pct}%</span>
    </div>
  )
}

function SideBar({ forRate }: { forRate: number }) {
  const pct = Math.min(100, Math.max(0, forRate))
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-for-400 w-8 text-right shrink-0">FOR</span>
      <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
        <div className="h-full bg-for-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-against-400 w-12 shrink-0">AGN</span>
      <span className="text-xs font-mono text-white w-10 text-right shrink-0">{pct}% ↑</span>
    </div>
  )
}

function VoteRow({ vote, index }: { vote: RecentFaceoffVote; index: number }) {
  const isFor = vote.winner_side === 'blue'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
  const agreedPct = vote.pair_total_votes > 0
    ? Math.round((vote.pair_agreement_votes / vote.pair_total_votes) * 100)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {vote.majority_agreed === true ? (
            <CheckCircle2 className="w-4 h-4 text-emerald" />
          ) : vote.majority_agreed === false ? (
            <XCircle className="w-4 h-4 text-against-400" />
          ) : (
            <Circle className="w-4 h-4 text-surface-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-white font-medium leading-snug line-clamp-2">
            {vote.winner_content ?? 'Argument content unavailable'}
          </p>

          {vote.topic_statement && (
            <p className="text-[11px] text-surface-500 mt-1 truncate">
              re: {vote.topic_statement}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {vote.winner_side && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border',
                sideBg, sideColor
              )}>
                {isFor ? <ThumbsUp className="w-2.5 h-2.5" /> : <ThumbsDown className="w-2.5 h-2.5" />}
                {isFor ? 'FOR' : 'AGAINST'}
              </span>
            )}

            {vote.majority_agreed !== null && (
              <span className={cn(
                'text-[10px] font-mono px-2 py-0.5 rounded-md border',
                vote.majority_agreed
                  ? 'bg-emerald/10 border-emerald/30 text-emerald'
                  : 'bg-against-500/10 border-against-500/30 text-against-400'
              )}>
                {vote.majority_agreed ? 'Majority agreed' : 'Majority disagreed'}
              </span>
            )}

            {agreedPct !== null && (
              <span className="text-[10px] font-mono text-surface-500">
                {agreedPct}% picked this
              </span>
            )}

            {vote.topic_id && (
              <Link
                href={`/topic/${vote.topic_id}`}
                className="inline-flex items-center gap-0.5 text-[10px] text-for-400 hover:text-for-300 font-mono"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Topic
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function CategoryRow({ stat, max }: { stat: CategoryStat; max: number }) {
  const pct = max > 0 ? (stat.judged / max) * 100 : 0
  const forPct = stat.judged > 0 ? Math.round((stat.for_picks / stat.judged) * 100) : 0
  const color = categoryColor(stat.category)

  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono w-24 shrink-0 truncate', color)}>
        {stat.category ?? 'Unknown'}
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-surface-500 w-6 text-right shrink-0">{stat.judged}</span>
      <span className="text-[10px] font-mono text-surface-600 w-12 text-right shrink-0">
        {forPct}% FOR
      </span>
    </div>
  )
}

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
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* ── Stats grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Judged" value={data.total_judged} sub="all time" icon={Gavel} color="text-purple" />
                <StatCard label="This Week" value={data.week_judged} sub="faceoffs" icon={Zap} color="text-for-400" />
                <StatCard
                  label="Alignment"
                  value={data.alignment_rate !== null ? `${data.alignment_rate}%` : '—'}
                  sub="vs majority"
                  icon={Users}
                  color="text-emerald"
                />
                <StatCard
                  label="FOR Picks"
                  value={data.for_pick_rate !== null ? `${data.for_pick_rate}%` : '—'}
                  sub="of your wins"
                  icon={Award}
                  color="text-gold"
                />
              </div>

              {/* ── Archetype ── */}
              {archetypeConfig && (
                <div className={cn(
                  'rounded-2xl border p-4 flex items-start gap-4',
                  archetypeConfig.bg, archetypeConfig.border
                )}>
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                    archetypeConfig.bg, archetypeConfig.border, 'border'
                  )}>
                    <archetypeConfig.icon className={cn('w-6 h-6', archetypeConfig.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-base font-bold', archetypeConfig.color)}>
                        {archetypeConfig.label}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full border border-surface-400/50">
                        Judge Archetype
                      </span>
                    </div>
                    <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                      {archetypeConfig.description}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Alignment bar ── */}
              {data.alignment_rate !== null && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
                  <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Community Alignment
                  </h2>
                  <AlignmentBar rate={data.alignment_rate} />
                  <p className="text-[11px] text-surface-500 mt-2">
                    You agree with the majority on {data.alignment_rate}% of judged pairs.
                  </p>
                </div>
              )}

              {/* ── FOR pick rate ── */}
              {data.for_pick_rate !== null && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
                  <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5" />
                    Side Preference
                  </h2>
                  <SideBar forRate={data.for_pick_rate} />
                  <p className="text-[11px] text-surface-500 mt-2">
                    {data.for_pick_rate}% of your winning picks were FOR arguments.
                  </p>
                </div>
              )}

              {/* ── Category breakdown ── */}
              {data.category_breakdown.length > 0 && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
                  <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5" />
                    By Category
                  </h2>
                  <div className="space-y-2.5">
                    {data.category_breakdown.map((stat) => (
                      <CategoryRow
                        key={stat.category ?? 'unknown'}
                        stat={stat}
                        max={data.category_breakdown[0].judged}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Recent votes ── */}
              {data.recent_votes.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Gavel className="w-3.5 h-3.5" />
                    Recent Picks
                    <span className="text-surface-600 normal-case font-normal">
                      ({data.recent_votes.length})
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {data.recent_votes.map((vote, i) => (
                      <VoteRow key={`${vote.argument_a_id}|${vote.argument_b_id}`} vote={vote} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── CTA ── */}
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
