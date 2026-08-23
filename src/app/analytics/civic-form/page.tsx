'use client'

/**
 * /analytics/civic-form — Civic Form
 *
 * "Form" in the athletic sense: are you peaking, holding steady, or gone cold?
 * Compares the user's last 30 days of civic engagement (argument quality + volume,
 * voting activity) against their prior 60-day baseline to derive a form rating:
 * On Fire / Sharp / Steady / Cold / Dormant.
 *
 * Distinct from:
 *   /analytics/momentum      — directional trend in engagement volume over 8 weeks
 *   /analytics/consistency   — streak-based voting consistency metric
 *   /analytics/volatility    — variance/rhythm of engagement pattern
 *   /analytics/quality-trend — month-by-month AI grade breakdown history
 *   /analytics/retention     — long-term cohort retention patterns
 *
 * Civic Form is a CURRENT SNAPSHOT — your right-now fitness level — using
 * recent-vs-historical comparison rather than long timelines or streaks.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Snowflake,
  Star,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CivicFormData,
  FormRating,
  TopArg,
  WeeklyPoint,
} from '@/app/api/analytics/civic-form/route'

// ─── Form config ──────────────────────────────────────────────────────────────

const FORM_CONFIG: Record<
  FormRating,
  {
    color: string
    bg: string
    border: string
    glow: string
    ring: string
    icon: typeof Flame
    gradient: string
  }
> = {
  on_fire: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    glow: 'shadow-gold/20',
    ring: 'ring-gold/30',
    icon: Flame,
    gradient: 'from-gold/20 to-gold/5',
  },
  sharp: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    glow: 'shadow-emerald/20',
    ring: 'ring-emerald/30',
    icon: Zap,
    gradient: 'from-emerald/15 to-emerald/5',
  },
  steady: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-for-500/20',
    ring: 'ring-for-500/20',
    icon: Activity,
    gradient: 'from-for-500/10 to-for-500/5',
  },
  cold: {
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-against-500/20',
    ring: 'ring-against-500/20',
    icon: Snowflake,
    gradient: 'from-against-500/10 to-against-500/5',
  },
  dormant: {
    color: 'text-surface-500',
    bg: 'bg-surface-200/50',
    border: 'border-surface-300',
    glow: 'shadow-surface-900/10',
    ring: 'ring-surface-300',
    icon: Activity,
    gradient: 'from-surface-200/30 to-surface-100',
  },
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald',
  A: 'text-emerald',
  'A-': 'text-emerald',
  'B+': 'text-for-400',
  B: 'text-for-400',
  'B-': 'text-for-400',
  'C+': 'text-gold',
  C: 'text-gold',
  'C-': 'text-gold',
  'D+': 'text-against-400',
  D: 'text-against-400',
  'D-': 'text-against-400',
  F: 'text-against-500',
}

// ─── Delta pill ───────────────────────────────────────────────────────────────

function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-mono text-surface-500">
        <Minus className="h-3 w-3" />
        <span>—</span>
      </span>
    )
  const up = value > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-mono font-semibold',
        up ? 'text-emerald' : 'text-against-400'
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {value}
      {unit}
    </span>
  )
}

// ─── Form Score Gauge ─────────────────────────────────────────────────────────

function FormGauge({ score, rating }: { score: number; rating: FormRating }) {
  const cfg = FORM_CONFIG[rating]
  const circumference = 2 * Math.PI * 40
  const dash = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center h-28 w-28">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-300" />
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={cfg.color}
            stroke="currentColor"
            strokeDasharray={`${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span className={cn('text-2xl font-mono font-bold', cfg.color)}>{score}</span>
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">form</span>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Weekly Quality Chart ─────────────────────────────────────────────────────

function WeeklyChart({ weeks }: { weeks: WeeklyPoint[] }) {
  const maxScore = 100
  const hasData = weeks.some((w) => w.avg_score !== null)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-28 text-xs font-mono text-surface-500">
        No scored arguments in the last 6 weeks
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 h-28">
      {weeks.map((w, i) => {
        const height = w.avg_score !== null ? Math.max(6, (w.avg_score / maxScore) * 100) : 6
        const isEmpty = w.avg_score === null

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="relative w-full flex flex-col items-center justify-end" style={{ height: '88px' }}>
              {!isEmpty && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-surface-400 whitespace-nowrap">
                  {Math.round(w.avg_score!)}
                </div>
              )}
              <motion.div
                className={cn(
                  'w-full rounded-t-sm',
                  isEmpty ? 'bg-surface-300/30' : 'bg-for-500'
                )}
                style={{ height: `${height}%` }}
                initial={{ scaleY: 0, originY: 1 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[9px] font-mono text-surface-500 text-center leading-tight">
              {w.week}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Top Argument Card ────────────────────────────────────────────────────────

function ArgCard({ arg, index }: { arg: TopArg; index: number }) {
  const gradeColor = arg.ai_grade ? (GRADE_COLORS[arg.ai_grade] ?? 'text-surface-400') : 'text-surface-400'
  const sideColor = arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
  const sideBg = arg.side === 'blue' ? 'bg-for-500/10' : 'bg-against-500/10'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0 mt-0.5', sideBg)}>
          <MessageSquare className={cn('h-3.5 w-3.5', sideColor)} />
        </div>
        <div className="flex-1 min-w-0">
          {arg.topic_statement && (
            <div className="text-[10px] font-mono text-surface-500 mb-1 truncate">{arg.topic_statement}</div>
          )}
          <p className="text-xs font-mono text-surface-300 leading-relaxed line-clamp-2">{arg.content}</p>
          <div className="flex items-center gap-3 mt-2">
            {arg.ai_grade && (
              <span className={cn('text-xs font-mono font-bold', gradeColor)}>{arg.ai_grade}</span>
            )}
            {arg.ai_score !== null && (
              <span className="text-[10px] font-mono text-surface-500">{arg.ai_score}/100</span>
            )}
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {new Date(arg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Comparison Row ───────────────────────────────────────────────────────────

function CompareRow({
  label,
  recent,
  historical,
  delta,
  unit = '',
  higherIsBetter = true,
}: {
  label: string
  recent: number | string | null
  historical: number | string | null
  delta: number
  unit?: string
  higherIsBetter?: boolean
}) {
  return (
    <div className="flex items-center py-3 border-b border-surface-300/50 last:border-0">
      <div className="flex-1 text-xs font-mono text-surface-400">{label}</div>
      <div className="w-20 text-right text-xs font-mono text-surface-500">
        {historical !== null ? `${historical}${unit}` : '—'}
      </div>
      <div className="w-20 text-right text-xs font-mono font-semibold text-white">
        {recent !== null ? `${recent}${unit}` : '—'}
      </div>
      <div className="w-16 text-right">
        {delta !== 0 ? (
          <Delta value={higherIsBetter ? delta : -delta} unit={unit} />
        ) : (
          <span className="text-xs font-mono text-surface-600">—</span>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CivicFormPage() {
  const router = useRouter()
  const [data, setData] = useState<CivicFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/civic-form', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load civic form data')
      const json: CivicFormData = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const cfg = data ? FORM_CONFIG[data.form_rating] : FORM_CONFIG.dormant
  const FormIcon = cfg.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-mono font-bold text-white">Civic Form</h1>
              <button
                type="button"
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center justify-center h-6 w-6 rounded-lg hover:bg-surface-200 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5 text-surface-500', refreshing && 'animate-spin')} />
              </button>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5 truncate">
              30-day performance vs your prior baseline
            </p>
          </div>
          <Link
            href="/analytics"
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
          >
            All analytics
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-4 h-56 animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-24 animate-pulse" />
              ))}
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40 animate-pulse" />
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40 animate-pulse" />
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Activity}
            title="Couldn't load your form"
            description={error}
            action={{ label: 'Try again', onClick: () => load() }}
          />
        )}

        {/* ── Data ──────────────────────────────────────────────────────── */}
        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >

              {/* Form rating hero card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'rounded-2xl border p-6 bg-gradient-to-br',
                  cfg.border,
                  cfg.gradient
                )}
              >
                <div className="flex items-center gap-5">
                  <FormGauge score={data.form_score} rating={data.form_rating} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn('flex items-center justify-center h-8 w-8 rounded-xl', cfg.bg)}>
                        <FormIcon className={cn('h-4 w-4', cfg.color)} />
                      </div>
                      <span className={cn('text-xl font-mono font-bold', cfg.color)}>
                        {data.form_label}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-surface-400 leading-relaxed">
                      {data.form_desc}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Last 30 days</div>
                      <div className="flex items-center gap-3">
                        {data.recent.args_count > 0 && (
                          <span className="flex items-center gap-1 text-xs font-mono text-surface-400">
                            <MessageSquare className="h-3 w-3" />
                            {data.recent.args_count} args
                          </span>
                        )}
                        {data.recent.votes_count > 0 && (
                          <span className="flex items-center gap-1 text-xs font-mono text-surface-400">
                            <Vote className="h-3 w-3" />
                            {data.recent.votes_count} votes
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Delta stat cards */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  {
                    label: 'Quality',
                    value: data.recent.avg_score !== null ? `${data.recent.avg_score}` : '—',
                    sub: 'avg AI score',
                    delta: data.quality_delta,
                    icon: Star,
                  },
                  {
                    label: 'Arguments',
                    value: `${data.recent.args_count}`,
                    sub: 'written',
                    delta: data.volume_delta,
                    icon: MessageSquare,
                  },
                  {
                    label: 'Votes',
                    value: `${data.recent.votes_count}`,
                    sub: 'cast',
                    delta: data.vote_delta,
                    icon: TrendingUp,
                  },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{stat.label}</span>
                      <stat.icon className="h-3.5 w-3.5 text-surface-500" />
                    </div>
                    <span className="text-xl font-mono font-bold text-white">{stat.value}</span>
                    <span className="text-[10px] font-mono text-surface-600">{stat.sub}</span>
                    <Delta value={stat.delta} />
                  </div>
                ))}
              </motion.div>

              {/* Comparison table */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-surface-300">
                  <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    Recent vs Baseline
                  </h2>
                </div>
                <div className="px-5">
                  {/* header row */}
                  <div className="flex items-center py-2 border-b border-surface-300/50">
                    <div className="flex-1 text-[9px] font-mono text-surface-600 uppercase tracking-wider" />
                    <div className="w-20 text-right text-[9px] font-mono text-surface-600 uppercase tracking-wider">
                      Prev 60d
                    </div>
                    <div className="w-20 text-right text-[9px] font-mono text-surface-600 uppercase tracking-wider">
                      Last 30d
                    </div>
                    <div className="w-16 text-right text-[9px] font-mono text-surface-600 uppercase tracking-wider">
                      Δ
                    </div>
                  </div>
                  <CompareRow
                    label="Avg AI Quality"
                    recent={data.recent.avg_score !== null ? Math.round(data.recent.avg_score) : null}
                    historical={data.historical.avg_score !== null ? Math.round(data.historical.avg_score) : null}
                    delta={data.quality_delta}
                    unit=""
                  />
                  <CompareRow
                    label="Arguments Written"
                    recent={data.recent.args_count}
                    historical={Math.round(data.historical.args_count / 2)}
                    delta={data.volume_delta}
                  />
                  <CompareRow
                    label="Votes Cast"
                    recent={data.recent.votes_count}
                    historical={Math.round(data.historical.votes_count / 2)}
                    delta={data.vote_delta}
                  />
                </div>
              </motion.div>

              {/* Weekly quality trend */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    Weekly Argument Quality
                  </h2>
                  <span className="text-[10px] font-mono text-surface-600">last 6 weeks</span>
                </div>
                <WeeklyChart weeks={data.weekly_quality} />
              </motion.div>

              {/* Top recent arguments */}
              {data.top_recent_args.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                      Best Arguments This Month
                    </h2>
                    <span className="text-[10px] font-mono text-surface-600">by AI score</span>
                  </div>
                  <div className="space-y-2">
                    {data.top_recent_args.map((arg, i) => (
                      <ArgCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Dormant empty state */}
              {data.form_rating === 'dormant' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center py-8"
                >
                  <p className="text-sm font-mono text-surface-500 mb-4">
                    Get started to see your civic form
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl bg-for-600 hover:bg-for-700 px-5 py-2.5 text-sm font-mono font-medium text-white transition-colors"
                  >
                    Go to Feed
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}

              {/* Related analytics */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-surface-300">
                  <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    Related Analytics
                  </h2>
                </div>
                <div className="divide-y divide-surface-300/50">
                  {[
                    { href: '/analytics/momentum', label: 'Momentum Report', desc: '8-week engagement trend' },
                    { href: '/analytics/quality-trend', label: 'Argument Quality Trend', desc: 'Monthly AI grade breakdown' },
                    { href: '/analytics/volatility', label: 'Engagement Volatility', desc: 'Rhythm and consistency patterns' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-200/50 transition-colors group"
                    >
                      <div>
                        <div className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                          {link.label}
                        </div>
                        <div className="text-[10px] font-mono text-surface-500 mt-0.5">{link.desc}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </motion.div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
