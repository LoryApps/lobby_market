'use client'

/**
 * /analytics/argument-quality — Platform Argument Quality Index
 *
 * A platform-wide view of argument quality across all AI-graded submissions.
 * Shows the grade distribution (A–F), category breakdown, quality trends
 * over time, and the top arguers by A-grade count.
 *
 * Distinct from:
 *   /top-arguments           — lists top upvoted arguments
 *   /arguments/top-scored    — lists top AI-scored arguments
 *   /topic/[id]/quality      — per-topic argument quality panel
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
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
import type {
  ArgumentQualityIndexResponse,
  Grade,
  GradeCount,
  CategoryQuality,
  TopArguer,
  WeeklyTrend,
} from '@/app/api/analytics/argument-quality/route'

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<Grade, { label: string; bg: string; text: string; border: string; bar: string }> = {
  A: { label: 'A',  bg: 'bg-emerald/10',       text: 'text-emerald',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  B: { label: 'B',  bg: 'bg-for-500/10',        text: 'text-for-400',     border: 'border-for-500/30',     bar: 'bg-for-500' },
  C: { label: 'C',  bg: 'bg-purple/10',         text: 'text-purple',      border: 'border-purple/30',      bar: 'bg-purple' },
  D: { label: 'D',  bg: 'bg-gold/10',           text: 'text-gold',        border: 'border-gold/30',        bar: 'bg-gold' },
  F: { label: 'F',  bg: 'bg-against-500/10',    text: 'text-against-400', border: 'border-against-500/30', bar: 'bg-against-500' },
}

const GRADE_LABELS: Record<Grade, string> = {
  A: 'Excellent reasoning',
  B: 'Good argument',
  C: 'Adequate point',
  D: 'Weak case',
  F: 'Poor quality',
}

const ROLE_COLORS: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-for-300',
  troll_catcher: 'text-emerald',
  debator:       'text-purple',
  citizen:       'text-surface-400',
}

const CAT_EMOJI: Record<string, string> = {
  Economics: '\u{1F4B0}', Politics: '\u{1F5F3}️', Technology: '⚡', Science: '\u{1F52C}',
  Ethics: '⚖️', Philosophy: '\u{1F9E0}', Culture: '\u{1F3AD}', Health: '❤️',
  Environment: '\u{1F33F}', Education: '\u{1F4DA}', Other: '•',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────────────────

function gradeFromScore(score: number): Grade {
  if (score >= 7.5) return 'A'
  if (score >= 6)   return 'B'
  if (score >= 4.5) return 'C'
  if (score >= 3)   return 'D'
  return 'F'
}

function formatWeek(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  icon: Icon,
  color = 'text-white',
  delay = 0,
}: {
  label: string
  value: string
  icon: typeof BarChart2
  color?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2"
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn('text-2xl font-bold font-mono', color)}>{value}</span>
    </motion.div>
  )
}

function GradeBar({ grade, count, pct }: GradeCount) {
  const cfg = GRADE_CONFIG[grade]
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm font-mono flex-shrink-0',
        cfg.bg, cfg.text,
      )}>
        {grade}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-surface-400">{GRADE_LABELS[grade]}</span>
          <span className="text-xs font-mono text-surface-500">
            {count.toLocaleString()} · {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', cfg.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>
    </div>
  )
}

function CategoryRow({ row, rank }: { row: CategoryQuality; rank: number }) {
  const grade = row.top_grade
  const cfg = grade ? GRADE_CONFIG[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors"
    >
      <span className="text-surface-600 font-mono text-xs w-5 text-right flex-shrink-0">{rank + 1}</span>
      <span className="text-lg flex-shrink-0">{CAT_EMOJI[row.category] ?? '•'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-white">{row.category}</span>
          {cfg && (
            <span className={cn('text-xs font-bold font-mono px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
              {grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', cfg?.bar ?? 'bg-surface-400')}
              initial={{ width: 0 }}
              animate={{ width: `${row.score_bar}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: rank * 0.04 + 0.1 }}
            />
          </div>
          <span className="text-xs font-mono text-surface-400 flex-shrink-0">
            {row.avg_score?.toFixed(1) ?? '—'}/10
          </span>
        </div>
        <p className="text-xs text-surface-600 mt-0.5">
          {row.graded_count} graded · {row.graded_pct}% coverage
        </p>
      </div>
    </motion.div>
  )
}

function ArguerRow({ arguer, rank }: { arguer: TopArguer; rank: number }) {
  const roleColor = ROLE_COLORS[arguer.role] ?? 'text-surface-400'
  const grade = gradeFromScore(arguer.avg_score)
  const cfg = GRADE_CONFIG[grade]

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-3"
    >
      <span className="text-surface-600 font-mono text-xs w-5 text-right flex-shrink-0">{rank + 1}</span>
      <Link href={`/profile/${arguer.username}`} className="flex items-center gap-3 flex-1 group min-w-0">
        <Avatar
          src={arguer.avatar_url}
          fallback={arguer.display_name ?? arguer.username}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {arguer.display_name ?? arguer.username}
            </span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider', roleColor)}>
              {arguer.role}
            </span>
          </div>
          <p className="text-xs text-surface-500">
            {arguer.a_grade_count} A-grade · avg {arguer.avg_score.toFixed(1)}/10
          </p>
        </div>
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg font-bold text-sm font-mono',
          cfg.bg, cfg.text,
        )}>
          {grade}
        </div>
      </Link>
    </motion.div>
  )
}

function SparkLine({ data }: { data: WeeklyTrend[] }) {
  if (data.length < 2) return null

  const maxScore = 10
  const height = 48
  const width = Math.max(data.length * 32, 200)
  const gap = width / (data.length - 1)

  const points = data.map((d, i) => ({
    x: i * gap,
    y: height - (d.avg_score / maxScore) * height,
    score: d.avg_score,
    count: d.graded_count,
    week: d.week,
  }))

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: width + 40 }}>
        <svg width={width + 40} height={height + 28} className="block">
          {/* Grid lines */}
          {[0, 5, 10].map((val) => {
            const y = height - (val / maxScore) * height
            return (
              <g key={val}>
                <line x1={0} y1={y} x2={width} y2={y} stroke="#2a2a3a" strokeWidth={1} strokeDasharray="4,3" />
                <text x={width + 6} y={y + 4} fill="#6b7280" fontSize={9} fontFamily="monospace">{val}</text>
              </g>
            )
          })}
          {/* Line */}
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
          ))}
          {/* Week labels */}
          {points.filter((_, i) => i % Math.ceil(points.length / 6) === 0).map((p) => (
            <text key={p.week} x={p.x} y={height + 18} fill="#6b7280" fontSize={9} fontFamily="monospace" textAnchor="middle">
              {formatWeek(p.week)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────────────────────

export default function ArgumentQualityIndexPage() {
  const [data, setData] = useState<ArgumentQualityIndexResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/argument-quality')
      if (!res.ok) throw new Error('Failed to load quality data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const platformGrade = data?.totals.platform_grade
  const platformCfg = platformGrade ? GRADE_CONFIG[platformGrade] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <Brain className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Argument Quality Index
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Platform-wide AI grade distribution &amp; quality trends
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-surface-200 text-surface-500 hover:text-surface-300 hover:border-surface-300 transition-colors disabled:opacity-40 flex-shrink-0"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          <p className="mt-3 text-sm font-mono text-surface-500 max-w-2xl leading-relaxed">
            The quality of civic arguments shapes democratic outcomes. This index tracks how
            arguments are graded by AI across the platform — who reasons best, which categories
            debate with greatest rigour, and whether quality is improving over time.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PageSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Scale}
                title="Quality data unavailable"
                description={error}
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* ── Totals ───────────────────────────────────────────────────────────── */}
              <section aria-labelledby="totals-heading">
                <h2 id="totals-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Platform Overview
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatPill
                    label="Total Arguments"
                    value={data.totals.total_arguments.toLocaleString()}
                    icon={MessageSquare}
                    color="text-for-400"
                    delay={0}
                  />
                  <StatPill
                    label="AI Graded"
                    value={`${data.totals.graded_arguments.toLocaleString()} (${data.totals.graded_pct}%)`}
                    icon={Brain}
                    color="text-emerald"
                    delay={0.05}
                  />
                  <StatPill
                    label="Avg AI Score"
                    value={data.totals.avg_score !== null ? `${data.totals.avg_score}/10` : '—'}
                    icon={BarChart2}
                    color="text-purple"
                    delay={0.1}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Platform Grade</span>
                    </div>
                    {platformGrade && platformCfg ? (
                      <span className={cn('text-3xl font-bold font-mono', platformCfg.text)}>
                        {platformGrade}
                      </span>
                    ) : (
                      <span className="text-2xl font-bold font-mono text-surface-500">—</span>
                    )}
                  </motion.div>
                </div>

                {data.totals.graded_arguments === 0 && (
                  <div className="mt-4 rounded-xl bg-surface-100 border border-gold/30 p-4 flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">No graded arguments yet</p>
                      <p className="text-xs text-surface-500 leading-relaxed">
                        Once citizens submit arguments and run AI critique, quality grades will appear here.
                        Visit any topic&apos;s argument section and hit &quot;Critique&quot; to grade your reasoning.
                      </p>
                      <Link href="/" className="inline-flex items-center gap-1 mt-2 text-xs text-for-400 hover:text-for-300 transition-colors">
                        Browse debates <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Grade distribution ───────────────────────────────────────────────────────── */}
              {data.totals.graded_arguments > 0 && (
                <section aria-labelledby="distribution-heading">
                  <h2 id="distribution-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Grade Distribution
                  </h2>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                    <p className="text-xs text-surface-500 leading-relaxed">
                      AI grades from A (excellent) to F (poor) across all{' '}
                      <span className="text-white font-semibold">{data.totals.graded_arguments.toLocaleString()}</span>{' '}
                      graded arguments on the platform.
                    </p>
                    <div className="space-y-3">
                      {data.grade_distribution.map((g) => (
                        <GradeBar key={g.grade} {...g} />
                      ))}
                    </div>

                    {/* Donut-style summary pills */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-300">
                      {data.grade_distribution.filter((g) => g.count > 0).map((g) => {
                        const cfg = GRADE_CONFIG[g.grade]
                        return (
                          <span
                            key={g.grade}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border',
                              cfg.bg, cfg.text, cfg.border,
                            )}
                          >
                            {g.grade} · {g.pct}%
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Category quality ───────────────────────────────────────────────────────── */}
              {data.category_quality.length > 0 && (
                <section aria-labelledby="category-heading">
                  <h2 id="category-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Quality by Category
                  </h2>
                  <div className="space-y-2">
                    {data.category_quality.map((row, i) => (
                      <CategoryRow key={row.category} row={row} rank={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Weekly trend ───────────────────────────────────────────────────────────── */}
              {data.weekly_trend.length >= 2 && (
                <section aria-labelledby="trend-heading">
                  <h2 id="trend-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Quality Trend (last 8 weeks)
                  </h2>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                      Average AI score per week for newly graded arguments. Rising scores indicate
                      improving argument quality across the platform.
                    </p>
                    <SparkLine data={data.weekly_trend} />
                    {/* Latest vs earliest */}
                    {data.weekly_trend.length >= 2 && (() => {
                      const first = data.weekly_trend[0]
                      const last  = data.weekly_trend[data.weekly_trend.length - 1]
                      const delta = last.avg_score - first.avg_score
                      const dir   = delta > 0.3 ? 'up' : delta < -0.3 ? 'down' : 'flat'
                      return (
                        <div className="mt-4 pt-4 border-t border-surface-300 flex items-center gap-3">
                          <TrendingUp className={cn(
                            'h-4 w-4 flex-shrink-0',
                            dir === 'up' ? 'text-emerald' : dir === 'down' ? 'text-against-400' : 'text-surface-500',
                          )} />
                          <p className="text-xs text-surface-400">
                            {dir === 'up'
                              ? `Quality improving — avg score up ${Math.abs(delta).toFixed(1)} pts over 8 weeks.`
                              : dir === 'down'
                              ? `Quality declining — avg score down ${Math.abs(delta).toFixed(1)} pts over 8 weeks.`
                              : 'Quality stable — avg score holding steady over 8 weeks.'}
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </section>
              )}

              {/* ── Top arguers ───────────────────────────────────────────────────────────── */}
              {data.top_arguers.length > 0 && (
                <section aria-labelledby="arguers-heading">
                  <div className="flex items-center justify-between mb-3">
                    <h2 id="arguers-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Top Arguers by A-Grade
                    </h2>
                    <Link
                      href="/arguments/top-scored"
                      className="inline-flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors font-mono"
                    >
                      All top-scored <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                    <p className="text-xs text-surface-500 leading-relaxed">
                      Citizens who have earned the most A-grade AI evaluations for their arguments.
                    </p>
                    <div className="space-y-3">
                      {data.top_arguers.map((arguer, i) => (
                        <ArguerRow key={arguer.user_id} arguer={arguer} rank={i} />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Quality insights / CTA ───────────────────────────────────────────────── */}
              <section aria-labelledby="insights-heading">
                <h2 id="insights-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Improve Your Arguments
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: Brain,
                      iconColor: 'text-emerald',
                      iconBg: 'bg-emerald/10',
                      title: 'AI Critique',
                      desc: 'Submit any argument for an instant AI quality evaluation — get a score and targeted feedback.',
                      href: '/',
                      cta: 'Post an argument',
                    },
                    {
                      icon: Zap,
                      iconColor: 'text-for-400',
                      iconBg: 'bg-for-500/10',
                      title: 'Argument Training',
                      desc: 'Sharpen your debate skills — fallacy spotting, argument ranking, and vote calibration exercises.',
                      href: '/training',
                      cta: 'Start training',
                    },
                    {
                      icon: Star,
                      iconColor: 'text-gold',
                      iconBg: 'bg-gold/10',
                      title: 'Top Scored Arguments',
                      desc: 'Study the A-grade arguments that earned the highest AI scores for rhetorical technique.',
                      href: '/arguments/top-scored',
                      cta: 'See top arguments',
                    },
                    {
                      icon: Users,
                      iconColor: 'text-purple',
                      iconBg: 'bg-purple/10',
                      title: 'Argument Faceoffs',
                      desc: 'Vote on which argument is more compelling in head-to-head matchups — community curation.',
                      href: '/faceoffs',
                      cta: 'Judge faceoffs',
                    },
                  ].map((item) => (
                    <Link key={item.href} href={item.href}>
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors group h-full">
                        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 mt-0.5', item.iconBg)}>
                          <item.icon className={cn('h-4 w-4', item.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                          <p className="text-xs text-surface-500 leading-relaxed mb-2">{item.desc}</p>
                          <span className="inline-flex items-center gap-1 text-xs text-for-400 group-hover:text-for-300 transition-colors font-medium">
                            {item.cta} <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* ── Related analytics ───────────────────────────────────────────────────────── */}
              <section aria-labelledby="related-heading">
                <h2 id="related-heading" className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Related Analytics
                </h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { href: '/analytics/arguments',  label: 'My Arguments',    sub: 'Your argument history & grades', icon: MessageSquare, color: 'text-for-400' },
                    { href: '/analytics/discourse',  label: 'Discourse Quality', sub: 'Topic-level discussion health',  icon: Scale,         color: 'text-emerald' },
                    { href: '/analytics/reactions',  label: 'Argument Reactions', sub: 'Community reaction analytics', icon: Star,          color: 'text-purple' },
                  ].map((link) => (
                    <Link key={link.href} href={link.href}>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors group">
                        <link.icon className={cn('h-4 w-4 flex-shrink-0', link.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white leading-tight">{link.label}</p>
                          <p className="text-xs text-surface-500 truncate">{link.sub}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-white transition-colors flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* ── Methodology ───────────────────────────────────────────────────────────── */}
              <div className="rounded-xl border border-surface-200 p-4">
                <p className="text-xs text-surface-500 leading-relaxed">
                  <strong className="text-surface-400">Methodology:</strong>{' '}
                  AI grades (A–F) are assigned by Claude when a user requests critique on their argument.
                  Scores range 1–10, mapped to grades: A (≥7.5), B (6–7.4), C (4.5–5.9), D (3–4.4), F (&lt;3).
                  Only explicitly graded arguments are included. Arguments that haven&apos;t been critiqued
                  are excluded from quality calculations.
                </p>
              </div>

              {data.generated_at && (
                <p className="text-xs text-surface-600 font-mono text-center">
                  Updated {new Date(data.generated_at).toLocaleTimeString()}
                </p>
              )}

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
