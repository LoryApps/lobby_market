'use client'

/**
 * /analytics/quality-trend — Argument Quality Progression
 *
 * Shows how your AI argument quality scores have evolved over the past 12 months:
 * monthly average scores, grade distribution, best arguments, and category breakdown.
 * Produces a "Trajectory" label (Improving / Stable / Declining) so you can see
 * whether your civic arguments are getting sharper or plateauing.
 *
 * Distinct from:
 *   /analytics/arguments      — portfolio overview (static snapshot, not trend)
 *   /analytics/mentor         — AI coaching on argument style (qualitative)
 *   /analytics/argument-quality — platform-wide quality statistics (not personal)
 *   /analytics/discourse       — depth / reply engagement, not AI score
 *   /analytics/persuasion      — cross-partisan upvotes, not quality grade
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type {
  QualityTrendResponse,
  MonthlyQuality,
  TopArgument,
  CategoryQuality,
  Grade,
  Trajectory,
} from '@/app/api/analytics/quality-trend/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<Grade, {
  label: string
  color: string
  bg: string
  border: string
  bar: string
}> = {
  A: { label: 'A', color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30',    bar: 'bg-emerald'    },
  B: { label: 'B', color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30',    bar: 'bg-for-500'    },
  C: { label: 'C', color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30',       bar: 'bg-gold'       },
  D: { label: 'D', color: 'text-against-400',bg: 'bg-against-500/10',border: 'border-against-500/30',bar: 'bg-against-500'},
  F: { label: 'F', color: 'text-surface-500',bg: 'bg-surface-300/10',border: 'border-surface-300/30',bar: 'bg-surface-400'},
}

// ─── Trajectory config ────────────────────────────────────────────────────────

const TRAJECTORY_CONFIG: Record<Trajectory, {
  label: string
  desc: string
  color: string
  bg: string
  border: string
  icon: typeof TrendingUp
}> = {
  improving: {
    label: 'Improving',
    desc: "Your argument quality is trending upward. Your civic voice is getting sharper.",
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: TrendingUp,
  },
  stable: {
    label: 'Stable',
    desc: "Your argument quality is consistent. Solid civic reasoning across the board.",
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: BarChart2,
  },
  declining: {
    label: 'Declining',
    desc: "Your recent arguments are scoring lower. Check the insights below for ideas to sharpen your reasoning.",
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: TrendingDown,
  },
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function QualityTrendSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyChart({ monthly }: { monthly: MonthlyQuality[] }) {
  const chartMonths = [...monthly].reverse() // chronological
  const maxScore = 10
  const activeMonths = chartMonths.filter((m) => m.count > 0)

  if (activeMonths.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-surface-500 text-sm font-mono">
        No graded arguments yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="flex items-end gap-1 h-40 px-1">
        {chartMonths.map((m) => {
          const heightPct = m.avg_score !== null ? (m.avg_score / maxScore) * 100 : 0
          const g = m.grade ?? 'F'
          const cfg = GRADE_CONFIG[g]
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end gap-1"
              title={m.avg_score !== null ? `${m.month_label}: ${m.avg_score}/10 (${m.count} arg${m.count !== 1 ? 's' : ''})` : m.month_label}
            >
              {m.avg_score !== null && (
                <span className={cn('text-[9px] font-mono font-semibold hidden sm:block', cfg.color)}>
                  {m.avg_score}
                </span>
              )}
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all duration-300',
                  m.avg_score !== null ? cfg.bar : 'bg-surface-300/30',
                )}
                style={{ height: m.avg_score !== null ? `${Math.max(heightPct, 4)}%` : '4%', opacity: m.avg_score !== null ? 1 : 0.3 }}
              />
            </div>
          )
        })}
      </div>

      {/* Month labels */}
      <div className="flex gap-1 px-1">
        {chartMonths.map((m) => (
          <div key={m.month} className="flex-1 text-center">
            <span className="text-[9px] font-mono text-surface-600 leading-none">
              {m.month_label.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Grade legend */}
      <div className="flex items-center flex-wrap gap-3 pt-1">
        {(Object.entries(GRADE_CONFIG) as [Grade, typeof GRADE_CONFIG[Grade]][]).map(([grade, cfg]) => (
          <div key={grade} className="flex items-center gap-1">
            <div className={cn('h-2 w-2 rounded-sm', cfg.bar)} />
            <span className="text-[10px] font-mono text-surface-500">Grade {grade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Top argument card ────────────────────────────────────────────────────────

function TopArgumentCard({ arg, rank }: { arg: TopArgument; rank: number }) {
  const cfg = GRADE_CONFIG[arg.ai_grade]
  const preview = arg.content.length > 160 ? arg.content.slice(0, 157) + '…' : arg.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-surface-500">#{rank}</span>
          <span
            className={cn(
              'inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold font-mono border',
              cfg.color, cfg.bg, cfg.border
            )}
          >
            {arg.ai_grade}
          </span>
          <span className="text-xs font-mono font-semibold text-surface-400">{arg.ai_score}/10</span>
          {arg.category && (
            <Badge variant="proposed" className="text-[10px]">{arg.category}</Badge>
          )}
          <div className={cn(
            'flex items-center gap-0.5 text-[10px] font-mono',
            arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
          )}>
            {arg.side === 'blue' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
          </div>
        </div>
        <Link
          href={`/topic/${arg.topic_id}`}
          className="flex-shrink-0 p-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
          aria-label="View topic"
        >
          <ExternalLink className="h-3.5 w-3.5 text-surface-500" />
        </Link>
      </div>

      <p className="text-xs font-mono text-surface-400 italic leading-relaxed">
        &ldquo;{arg.topic_statement}&rdquo;
      </p>

      <p className="text-sm text-white leading-relaxed">{preview}</p>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" /> {arg.upvotes} upvotes
        </span>
        <span>{new Date(arg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </motion.div>
  )
}

// ─── Category quality row ─────────────────────────────────────────────────────

function CategoryRow({ cat, maxScore }: { cat: CategoryQuality; maxScore: number }) {
  const cfg = GRADE_CONFIG[cat.grade]
  const barPct = maxScore > 0 ? (cat.avg_score / maxScore) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 flex-shrink-0">
        <span className="text-xs font-mono text-surface-400 truncate">{cat.category}</span>
      </div>
      <div className="flex-1 h-5 rounded bg-surface-200 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded', cfg.bar)}
        />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-xs font-mono font-bold', cfg.color)}>{cat.avg_score}</span>
        <span className={cn(
          'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border',
          cfg.color, cfg.bg, cfg.border
        )}>
          {cat.grade}
        </span>
        <span className="text-[10px] font-mono text-surface-600 w-14 text-right">
          {cat.count} arg{cat.count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QualityTrendPage() {
  const router = useRouter()
  const [data, setData] = useState<QualityTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/analytics/quality-trend', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as QualityTrendResponse
      setData(json)
    } catch {
      setError('Could not load quality trend data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tCfg = data ? TRAJECTORY_CONFIG[data.trajectory] : null
  const TrajIcon = tCfg?.icon ?? BarChart2
  const maxCatScore = data
    ? Math.max(...data.category_quality.map((c) => c.avg_score), 1)
    : 10

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Brain className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Argument Quality Trend</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                How your AI argument grades have evolved over time
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <QualityTrendSkeleton />}

        {error && (
          <EmptyState
            icon={Brain}
            title="Could not load quality data"
            description={error}
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {!loading && !error && data && data.total_graded === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No graded arguments yet"
            description="Get your arguments AI-scored by using the quality critique tool on any argument you've written. Then come back here to track your progress."
            actions={[{ label: 'Browse your arguments', href: '/analytics/arguments' }]}
          />
        )}

        {!loading && !error && data && data.total_graded > 0 && (
          <div className="space-y-6">

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Overall grade */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Avg Grade</p>
                {data.avg_grade ? (
                  <div className={cn(
                    'text-3xl font-mono font-bold',
                    GRADE_CONFIG[data.avg_grade].color
                  )}>
                    {data.avg_grade}
                  </div>
                ) : (
                  <div className="text-3xl font-mono font-bold text-surface-600">–</div>
                )}
                <p className="text-[10px] font-mono text-surface-600">
                  {data.avg_score !== null ? `${data.avg_score}/10 average` : 'No data'}
                </p>
              </motion.div>

              {/* Graded count */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Graded</p>
                <div className="text-3xl font-mono font-bold text-white">
                  <AnimatedNumber value={data.total_graded} />
                </div>
                <p className="text-[10px] font-mono text-surface-600">arguments scored</p>
              </motion.div>

              {/* Trajectory */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.10 }}
                className={cn(
                  'rounded-xl border p-4 space-y-1',
                  tCfg?.bg, tCfg?.border
                )}
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Trajectory</p>
                <div className={cn('text-xl font-mono font-bold flex items-center gap-1.5', tCfg?.color)}>
                  <TrajIcon className="h-5 w-5" />
                  {tCfg?.label}
                </div>
                <p className="text-[10px] font-mono text-surface-600">
                  {data.trajectory_pct !== null
                    ? `${data.trajectory_pct > 0 ? '+' : ''}${data.trajectory_pct}% from prior period`
                    : 'based on trend'}
                </p>
              </motion.div>

              {/* Best month */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Peak Month</p>
                <div className="text-base font-mono font-bold text-gold truncate">
                  {data.best_month ?? '–'}
                </div>
                <p className="text-[10px] font-mono text-surface-600">
                  {data.best_month_avg !== null ? `avg ${data.best_month_avg}/10` : 'no peak yet'}
                </p>
              </motion.div>
            </div>

            {/* Trajectory explanation */}
            {tCfg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'rounded-xl border px-4 py-3 flex items-start gap-3',
                  tCfg.bg, tCfg.border
                )}
              >
                <TrajIcon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', tCfg.color)} />
                <p className={cn('text-sm font-mono', tCfg.color)}>{tCfg.desc}</p>
              </motion.div>
            )}

            {/* Monthly chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-for-400" />
                <h2 className="text-sm font-mono font-semibold text-white">Monthly Average Score</h2>
                <span className="text-[10px] font-mono text-surface-500 ml-auto">last 12 months</span>
              </div>
              <MonthlyChart monthly={data.monthly} />
            </motion.div>

            {/* Monthly grade breakdown table */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3"
            >
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-mono font-semibold text-white">Grade Distribution by Month</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="border-b border-surface-300">
                      <th className="text-left text-surface-500 py-1.5 pr-3 font-normal">Month</th>
                      {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map((g) => (
                        <th key={g} className={cn('text-center py-1.5 px-2 font-bold', GRADE_CONFIG[g].color)}>
                          {g}
                        </th>
                      ))}
                      <th className="text-right text-surface-500 py-1.5 pl-3 font-normal">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly
                      .filter((m) => m.count > 0)
                      .map((m) => (
                        <tr key={m.month} className="border-b border-surface-300/50">
                          <td className="py-1.5 pr-3 text-surface-400">{m.month_label}</td>
                          {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map((g) => (
                            <td key={g} className={cn('text-center py-1.5 px-2', GRADE_CONFIG[g].color)}>
                              {m.grade_counts[g] > 0 ? m.grade_counts[g] : <span className="text-surface-700">–</span>}
                            </td>
                          ))}
                          <td className={cn('text-right py-1.5 pl-3 font-semibold', m.grade ? GRADE_CONFIG[m.grade].color : 'text-surface-500')}>
                            {m.avg_score ?? '–'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {data.monthly.every((m) => m.count === 0) && (
                  <p className="text-surface-500 text-xs text-center py-4">No scored arguments in the past 12 months.</p>
                )}
              </div>
            </motion.div>

            {/* Category quality */}
            {data.category_quality.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-mono font-semibold text-white">Quality by Category</h2>
                  <span className="text-[10px] font-mono text-surface-500 ml-auto">avg AI score</span>
                </div>
                <div className="space-y-2.5">
                  {data.category_quality.map((cat) => (
                    <CategoryRow key={cat.category} cat={cat} maxScore={maxCatScore} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Top arguments */}
            {data.top_arguments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-semibold text-white">Your Best Arguments</h2>
                  <span className="text-[10px] font-mono text-surface-500 ml-auto">by AI score</span>
                </div>
                {data.top_arguments.map((arg, i) => (
                  <TopArgumentCard key={arg.id} arg={arg} rank={i + 1} />
                ))}
              </motion.div>
            )}

            {/* CTA links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2"
            >
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">Improve your craft</p>
              <Link
                href="/analytics/arguments"
                className="flex items-center justify-between gap-3 py-2 border-b border-surface-300/50 group"
              >
                <div>
                  <p className="text-sm font-mono text-white group-hover:text-for-400 transition-colors">Argument Portfolio</p>
                  <p className="text-[10px] font-mono text-surface-500">Full stats — grades, arena record, categories</p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              </Link>
              <Link
                href="/analytics/mentor"
                className="flex items-center justify-between gap-3 py-2 border-b border-surface-300/50 group"
              >
                <div>
                  <p className="text-sm font-mono text-white group-hover:text-for-400 transition-colors">Argument Mentor</p>
                  <p className="text-[10px] font-mono text-surface-500">AI coaching report — patterns, weaknesses, improvement plan</p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              </Link>
              <Link
                href="/coach"
                className="flex items-center justify-between gap-3 py-2 group"
              >
                <div>
                  <p className="text-sm font-mono text-white group-hover:text-for-400 transition-colors">Argument Coach</p>
                  <p className="text-[10px] font-mono text-surface-500">Real-time AI feedback on arguments before you publish</p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              </Link>
            </motion.div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
