'use client'

/**
 * /retrospective — Civic Retrospective
 *
 * A personal look-back at a user's civic journey over a chosen period
 * (30 days / 90 days / 6 months / 1 year). Shows:
 *  - Aggregate stats: votes, arguments, laws, accuracy, streak
 *  - Laws established in the period, with the user's vote marked
 *  - Top arguments ranked by upvotes
 *  - Category breakdown bar chart
 *  - Milestone badges unlocked during the period
 *
 * Distinct from:
 *   /wrapped     — year-in-review, once a year
 *   /analytics   — current rolling stats dashboard
 *   /rewind      — platform time machine (any past date)
 *   /digest      — weekly notification digest
 *   /history     — recently viewed topics list
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  Period,
  RetrospectiveResponse,
  RetroLaw,
  RetroArgument,
  RetroCategoryEntry,
  RetroMilestone,
  RetroStats,
} from '@/app/api/retrospective/route'

// ─── Period config ────────────────────────────────────────────────────────────

const PERIODS: { id: Period; label: string }[] = [
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '180d', label: '6 Months' },
  { id: '365d', label: '1 Year' },
]

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  Economics:    { bar: 'bg-gold',          text: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:     { bar: 'bg-for-500',       text: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:   { bar: 'bg-purple',        text: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:      { bar: 'bg-emerald',       text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:       { bar: 'bg-against-500',   text: 'text-against-400',  bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  Philosophy:   { bar: 'bg-purple',        text: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:      { bar: 'bg-gold',          text: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30' },
  Health:       { bar: 'bg-emerald',       text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment:  { bar: 'bg-emerald',       text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:    { bar: 'bg-for-400',       text: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30' },
}

function catStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { bar: 'bg-surface-500', text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Milestone icon map ───────────────────────────────────────────────────────

const MILESTONE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Gavel: Gavel,
  CheckCircle2: CheckCircle2,
  Flame: Flame,
  Zap: Zap,
  TrendingUp: TrendingUp,
  ThumbsUp: ThumbsUp,
  Vote: Vote,
}

const MILESTONE_COLOR_MAP: Record<string, string> = {
  gold:     'bg-gold/10 border-gold/30 text-gold',
  emerald:  'bg-emerald/10 border-emerald/30 text-emerald',
  for:      'bg-for-500/10 border-for-500/30 text-for-400',
  against:  'bg-against-500/10 border-against-500/30 text-against-400',
  purple:   'bg-purple/10 border-purple/30 text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  return `${m}mo ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', accent)}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-surface-500 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({ law }: { law: RetroLaw }) {
  const cs = catStyle(law.category)
  return (
    <Link
      href={`/topic/${law.topic_id}`}
      className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div className="mt-0.5 shrink-0">
        {law.user_vote === null ? (
          <div className="w-5 h-5 rounded-full border-2 border-surface-400/60 flex items-center justify-center">
            <span className="sr-only">Not voted</span>
          </div>
        ) : law.correct ? (
          <div className="w-5 h-5 rounded-full bg-emerald/20 border border-emerald/50 flex items-center justify-center">
            <Check className="w-3 h-3 text-emerald" aria-label="Predicted correctly" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-against-500/10 border border-against-500/30 flex items-center justify-center">
            <X className="w-3 h-3 text-against-400" aria-label="Wrong prediction" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {law.category && (
            <span className={cn('text-[10px] font-medium', cs.text)}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] text-surface-600">{relTime(law.established_at)}</span>
          {law.user_vote !== null && (
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                law.user_vote === 'blue'
                  ? 'bg-for-500/15 text-for-300'
                  : 'bg-against-500/15 text-against-300',
              )}
            >
              Voted {law.user_vote === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
          )}
        </div>
      </div>
      <Gavel className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" aria-hidden="true" />
    </Link>
  )
}

// ─── Argument row ─────────────────────────────────────────────────────────────

function ArgumentRow({ arg }: { arg: RetroArgument }) {
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0',
          arg.side === 'blue'
            ? 'bg-for-500/20 border border-for-500/40'
            : 'bg-against-500/20 border border-against-500/40',
        )}
      >
        {arg.side === 'blue' ? (
          <ThumbsUp className="w-2.5 h-2.5 text-for-400" aria-hidden="true" />
        ) : (
          <ThumbsDown className="w-2.5 h-2.5 text-against-400" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          "{arg.content}"
        </p>
        <p className="text-[10px] text-surface-500 mt-1 truncate">{arg.topic_statement}</p>
        <div className="flex items-center gap-2 mt-1">
          <ThumbsUp className="w-3 h-3 text-surface-500" aria-hidden="true" />
          <span className="text-[10px] text-surface-500">{arg.upvotes} upvotes</span>
          <span className="text-[10px] text-surface-600">{relTime(arg.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ entries, total }: { entries: RetroCategoryEntry[]; total: number }) {
  if (entries.length === 0) return null
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const cs = catStyle(e.category)
        const width = pct(e.vote_count, total)
        return (
          <div key={e.category}>
            <div className="flex items-center justify-between mb-1">
              <span className={cn('text-xs font-medium', cs.text)}>{e.category}</span>
              <span className="text-[11px] text-surface-500">
                {e.vote_count} vote{e.vote_count !== 1 ? 's' : ''} · {e.for_pct}% FOR
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn('h-full rounded-full', cs.bar)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({ milestone }: { milestone: RetroMilestone }) {
  const Icon = MILESTONE_ICON_MAP[milestone.icon] ?? Award
  const colorClass = MILESTONE_COLOR_MAP[milestone.color] ?? 'bg-surface-300/40 border-surface-400/40 text-surface-500'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border',
        colorClass.split(' ').slice(0, 2).join(' '),
      )}
    >
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', colorClass.split(' ').slice(0, 2).join(' '))}>
        <Icon className={cn('w-4 h-4', colorClass.split(' ')[2])} aria-hidden="true" />
      </div>
      <div>
        <p className={cn('text-xs font-semibold', colorClass.split(' ')[2])}>{milestone.label}</p>
        <p className="text-[11px] text-surface-500 mt-0.5 leading-relaxed">{milestone.description}</p>
        {milestone.date && (
          <p className="text-[10px] text-surface-600 mt-1">{formatDate(milestone.date)}</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RetrospectiveSkeleton() {
  return (
    <div className="space-y-6 px-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RetrospectiveClient() {
  const [period, setPeriod] = useState<Period>('90d')
  const [data, setData] = useState<RetrospectiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showAllLaws, setShowAllLaws] = useState(false)
  const [showAllArgs, setShowAllArgs] = useState(false)

  const load = useCallback(async (p: Period) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/retrospective?period=${p}`)
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(period) }, [period, load])

  function selectPeriod(p: Period) {
    setPeriod(p)
    setShowAllLaws(false)
    setShowAllArgs(false)
  }

  const stats = data?.stats
  const visibleLaws = showAllLaws ? (data?.laws ?? []) : (data?.laws ?? []).slice(0, 5)
  const visibleArgs = showAllArgs ? (data?.top_arguments ?? []) : (data?.top_arguments ?? []).slice(0, 3)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 pt-14 pb-20 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/analytics"
              className="w-8 h-8 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors"
              aria-label="Back to Analytics"
            >
              <ArrowLeft className="w-4 h-4 text-surface-500" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Civic Retrospective</h1>
              <p className="text-xs text-surface-500">Your civic journey, by the numbers</p>
            </div>
          </div>

          {/* Period picker */}
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Select time period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPeriod(p.id)}
                aria-pressed={period === p.id}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  period === p.id
                    ? 'bg-for-500/20 border-for-500/50 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <RetrospectiveSkeleton />
        ) : error ? (
          <div className="px-4">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center">
              <p className="text-sm text-surface-500 mb-3">Failed to load retrospective data.</p>
              <button
                onClick={() => load(period)}
                className="flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Try again
              </button>
            </div>
          </div>
        ) : !data?.authenticated ? (
          <div className="px-4">
            <EmptyState
              icon={<Calendar className="w-8 h-8 text-surface-500" />}
              title="Sign in to see your retrospective"
              description="Your personal civic journey, laws you predicted correctly, and top arguments — all in one place."
              action={{ label: 'Sign In', href: '/sign-in' }}
            />
          </div>
        ) : !stats || stats.votes_cast === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={<Vote className="w-8 h-8 text-surface-500" />}
              title="No civic activity yet"
              description="Start voting on topics to build your civic record. Your retrospective will track laws you predict, arguments you make, and your civic growth."
              action={{ label: 'Browse Topics', href: '/trending' }}
            />
          </div>
        ) : (
          <div className="px-4 space-y-6">
            {/* ── Milestones ── */}
            {(data?.milestones ?? []).length > 0 && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                  Milestones
                </h2>
                <div className="space-y-2">
                  {data!.milestones.map((m, i) => (
                    <MilestoneCard key={i} milestone={m} />
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Stats grid ── */}
            <section aria-label="Statistics">
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-for-400" aria-hidden="true" />
                Your Numbers
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatTile
                  label="Votes Cast"
                  value={stats.votes_cast.toLocaleString()}
                  sub={`${pct(stats.for_votes, stats.votes_cast)}% FOR · ${pct(stats.against_votes, stats.votes_cast)}% AGAINST`}
                  icon={Vote}
                  accent="bg-for-500/10 text-for-400"
                />
                <StatTile
                  label="Arguments Written"
                  value={stats.arguments_written}
                  sub={stats.argument_upvotes > 0 ? `${stats.argument_upvotes} upvotes earned` : undefined}
                  icon={MessageSquare}
                  accent="bg-purple/10 text-purple"
                />
                <StatTile
                  label="Laws Tracked"
                  value={stats.laws_established}
                  sub={stats.accuracy_pct !== null ? `${stats.accuracy_pct}% prediction accuracy` : 'No votes on laws yet'}
                  icon={Gavel}
                  accent="bg-gold/10 text-gold"
                />
                <StatTile
                  label="Best Streak"
                  value={`${stats.best_streak}d`}
                  sub="Consecutive voting days"
                  icon={Flame}
                  accent="bg-against-500/10 text-against-400"
                />
                <StatTile
                  label="Categories"
                  value={stats.categories_active}
                  sub="Civic topics engaged"
                  icon={BookOpen}
                  accent="bg-emerald/10 text-emerald"
                />
                <StatTile
                  label="Active Days"
                  value={stats.days_active}
                  sub="Days with votes cast"
                  icon={Calendar}
                  accent="bg-surface-400/10 text-surface-400"
                />
              </div>
            </section>

            {/* ── Accuracy banner ── */}
            {stats.accuracy_pct !== null && (
              <div
                className={cn(
                  'rounded-2xl border p-4 flex items-center gap-4',
                  stats.accuracy_pct >= 70
                    ? 'bg-emerald/5 border-emerald/20'
                    : stats.accuracy_pct >= 50
                    ? 'bg-for-500/5 border-for-500/20'
                    : 'bg-against-500/5 border-against-500/20',
                )}
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-lg font-bold border-2',
                    stats.accuracy_pct >= 70
                      ? 'border-emerald/40 text-emerald bg-emerald/10'
                      : stats.accuracy_pct >= 50
                      ? 'border-for-500/40 text-for-300 bg-for-500/10'
                      : 'border-against-500/40 text-against-300 bg-against-500/10',
                  )}
                  aria-label={`${stats.accuracy_pct}% prediction accuracy`}
                >
                  {stats.accuracy_pct}%
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {stats.accuracy_pct >= 70
                      ? 'Sharp Civic Mind'
                      : stats.accuracy_pct >= 50
                      ? 'Above Average Foresight'
                      : 'Room to Grow'}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    You voted correctly on {stats.laws_correct} of{' '}
                    {stats.laws_correct + stats.laws_wrong} laws that resolved this period.
                  </p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs text-emerald flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      {stats.laws_correct} correct
                    </span>
                    <span className="text-xs text-against-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" aria-hidden="true" />
                      {stats.laws_wrong} missed
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Category breakdown ── */}
            {(data?.category_breakdown ?? []).length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-for-400" aria-hidden="true" />
                  Category Breakdown
                </h2>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <CategoryBar entries={data!.category_breakdown} total={stats.votes_cast} />
                </div>
              </section>
            )}

            {/* ── Laws established ── */}
            {(data?.laws ?? []).length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                  Laws Established This Period
                  <span className="ml-auto text-[10px] normal-case font-normal text-surface-600">
                    {data!.laws.length} law{data!.laws.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {visibleLaws.map((law, i) => (
                      <motion.div
                        key={law.topic_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <LawRow law={law} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {data!.laws.length > 5 && (
                    <button
                      onClick={() => setShowAllLaws((v) => !v)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
                      aria-expanded={showAllLaws}
                    >
                      <ChevronDown
                        className={cn('w-3.5 h-3.5 transition-transform', showAllLaws && 'rotate-180')}
                        aria-hidden="true"
                      />
                      {showAllLaws ? 'Show less' : `Show ${data!.laws.length - 5} more`}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ── Top arguments ── */}
            {(data?.top_arguments ?? []).length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple" aria-hidden="true" />
                  Your Top Arguments
                </h2>
                <div className="space-y-2">
                  {visibleArgs.map((arg, i) => (
                    <motion.div
                      key={arg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <ArgumentRow arg={arg} />
                    </motion.div>
                  ))}
                  {data!.top_arguments.length > 3 && (
                    <button
                      onClick={() => setShowAllArgs((v) => !v)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
                      aria-expanded={showAllArgs}
                    >
                      <ChevronDown
                        className={cn('w-3.5 h-3.5 transition-transform', showAllArgs && 'rotate-180')}
                        aria-hidden="true"
                      />
                      {showAllArgs ? 'Show less' : `Show ${data!.top_arguments.length - 3} more`}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ── Explore more ── */}
            <section>
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Explore More
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: '/analytics', label: 'Full Analytics', icon: BarChart2, color: 'text-for-400' },
                  { href: '/wrapped', label: 'Year in Review', icon: Sparkles, color: 'text-gold' },
                  { href: '/rewind', label: 'Time Machine', icon: Calendar, color: 'text-purple' },
                  { href: '/predictions', label: 'My Predictions', icon: Scale, color: 'text-emerald' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                  >
                    <item.icon className={cn('w-4 h-4 shrink-0', item.color)} aria-hidden="true" />
                    <span className="text-xs text-surface-400 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight className="w-3 h-3 text-surface-600 ml-auto shrink-0" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>

            {/* bottom spacing */}
            <div className="h-4" />
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
