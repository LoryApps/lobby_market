'use client'

/**
 * /wellbeing — Civic Wellbeing Dashboard
 *
 * A multi-dimensional, temporal health report for civic discourse on
 * Lobby Market. Unlike /vitals (current snapshot) or /polarization
 * (single metric), this page surfaces how the platform's health has
 * CHANGED across five dimensions over 7, 30, or 90 days:
 *
 *   1. Argument Quality   — are debates getting more substantive?
 *   2. Community Mood     — is sentiment trending positive?
 *   3. Consensus Health   — is the community converging or splitting?
 *   4. Deliberation Depth — are voters also making their case?
 *   5. Prediction Accuracy — are civic theses proving accurate?
 *
 * Distinct from:
 *   /vitals        — current-state snapshot (no temporal comparison)
 *   /polarization  — single metric (FOR/AGAINST splits)
 *   /climate       — weather metaphor framing
 *   /trajectory    — per-topic momentum, not platform-level
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Heart,
  Loader2,
  MessageSquare,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  WellbeingReport,
  WellbeingDimension,
  WellbeingPeriod,
  DailyWellbeingPoint,
} from '@/app/api/wellbeing/route'

// ─── Period config ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { id: WellbeingPeriod; label: string }[] = [
  { id: '7d',  label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
]

// ─── Score label config ───────────────────────────────────────────────────────

const SCORE_CONFIG: Record<string, {
  color: string
  ring: string
  bg: string
  glow: string
  icon: typeof Sparkles
}> = {
  Thriving:   { color: 'text-emerald',    ring: 'ring-emerald/40',   bg: 'bg-emerald/10',   glow: 'shadow-emerald/20',  icon: Sparkles },
  Healthy:    { color: 'text-for-400',    ring: 'ring-for-500/40',   bg: 'bg-for-500/10',   glow: 'shadow-for-500/20',  icon: CheckCircle2 },
  Fair:       { color: 'text-gold',       ring: 'ring-gold/40',      bg: 'bg-gold/10',      glow: 'shadow-gold/20',     icon: Activity },
  Struggling: { color: 'text-against-400',ring: 'ring-against-500/40',bg:'bg-against-500/10',glow:'shadow-against-500/20',icon: AlertTriangle },
}

// ─── Dimension config ─────────────────────────────────────────────────────────

const DIM_CONFIG: Record<string, {
  icon: typeof BarChart2
  color: string
  link: string
}> = {
  quality:    { icon: BarChart2,    color: 'text-for-400',     link: '/vitals' },
  mood:       { icon: Heart,        color: 'text-against-400', link: '/mood' },
  consensus:  { icon: Scale,        color: 'text-emerald',     link: '/polarization' },
  engagement: { icon: MessageSquare,color: 'text-purple',      link: '/analytics/arguments' },
  thesis:     { icon: Brain,        color: 'text-gold',        link: '/thesis/leaderboard' },
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({
  data,
  field,
  color,
}: {
  data: DailyWellbeingPoint[]
  field: 'quality_score' | 'positive_mood_pct' | 'engagement'
  color: string
}) {
  if (data.length < 2) return null
  const vals = data.map((d) => d[field] as number)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const w = 80
  const h = 24
  const pts = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="overflow-visible opacity-70" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
    </svg>
  )
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta)
  if (abs < 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-surface-500">
        <Minus className="h-3 w-3" />
        No change
      </span>
    )
  }
  const improving = delta > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-mono',
        improving ? 'text-emerald' : 'text-against-400',
      )}
    >
      {improving ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {abs.toFixed(0)} pts
    </span>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({
  dim,
  daily,
}: {
  dim: WellbeingDimension
  daily: DailyWellbeingPoint[]
}) {
  const cfg = DIM_CONFIG[dim.key] ?? DIM_CONFIG.quality
  const Icon = cfg.icon

  const sparkField: 'quality_score' | 'positive_mood_pct' | 'engagement' =
    dim.key === 'mood'
      ? 'positive_mood_pct'
      : dim.key === 'engagement'
        ? 'engagement'
        : 'quality_score'

  const trendIcon =
    dim.trend === 'improving' ? TrendingUp : dim.trend === 'declining' ? TrendingDown : Minus

  const TrendIcon = trendIcon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg bg-surface-200', cfg.color)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <span className="text-xs font-semibold text-surface-700">{dim.label}</span>
        </div>
        <Link
          href={cfg.link}
          className="text-surface-500 hover:text-surface-700 transition-colors"
          aria-label={`View ${dim.label} details`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Score */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={cn('text-3xl font-mono font-bold', cfg.color)}>
            {dim.current}
          </p>
          <p className="text-[10px] text-surface-500 mt-0.5">out of 100</p>
        </div>
        <Sparkline data={daily} field={sparkField} color={cfg.color} />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', {
            'bg-emerald':       dim.current >= 75,
            'bg-for-500':       dim.current >= 55 && dim.current < 75,
            'bg-gold':          dim.current >= 35 && dim.current < 55,
            'bg-against-500':   dim.current < 35,
          })}
          style={{ width: `${dim.current}%` }}
          role="progressbar"
          aria-valuenow={dim.current}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${dim.label}: ${dim.current} out of 100`}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <DeltaBadge delta={dim.delta} />
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-mono',
            dim.trend === 'improving'
              ? 'text-emerald'
              : dim.trend === 'declining'
                ? 'text-against-400'
                : 'text-surface-500',
          )}
        >
          <TrendIcon className="h-3 w-3" aria-hidden="true" />
          {dim.trend === 'improving'
            ? 'Improving'
            : dim.trend === 'declining'
              ? 'Declining'
              : 'Stable'}
        </span>
      </div>

      <p className="text-[11px] text-surface-500 leading-relaxed">{dim.description}</p>
    </motion.div>
  )
}

// ─── Timeline chart ───────────────────────────────────────────────────────────

function TimelineChart({ daily, period }: { daily: DailyWellbeingPoint[]; period: WellbeingPeriod }) {
  if (daily.length === 0) return null

  const SHOW_EVERY = period === '7d' ? 1 : period === '30d' ? 5 : 14

  const qualityVals = daily.map((d) => d.quality_score)
  const moodVals    = daily.map((d) => d.positive_mood_pct)
  const minY = Math.max(0, Math.min(...qualityVals, ...moodVals) - 5)
  const maxY = Math.min(100, Math.max(...qualityVals, ...moodVals) + 5)
  const rangeY = maxY - minY || 1

  const W = 600
  const H = 100
  const PAD_L = 24
  const PAD_R = 8
  const usableW = W - PAD_L - PAD_R

  const xOf = (i: number) => PAD_L + (i / (daily.length - 1)) * usableW
  const yOf = (v: number) => H - ((v - minY) / rangeY) * H

  const pathFor = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`)
      .join(' ')

  const ticks = daily
    .map((d, i) => ({ i, label: d.label }))
    .filter((_, i) => i % SHOW_EVERY === 0)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        className="w-full min-w-[320px]"
        aria-label="Wellbeing trend chart"
        role="img"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <line
            key={v}
            x1={PAD_L}
            y1={yOf(v)}
            x2={W - PAD_R}
            y2={yOf(v)}
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 4"
            className="text-surface-300/50"
          />
        ))}

        {/* Quality line */}
        <path
          d={pathFor(qualityVals)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-for-400"
        />
        {/* Mood line */}
        <path
          d={pathFor(moodVals)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 3"
          className="text-against-400"
        />

        {/* X-axis labels */}
        {ticks.map(({ i, label }) => (
          <text
            key={i}
            x={xOf(i)}
            y={H + 14}
            textAnchor="middle"
            fontSize="8"
            className="fill-surface-500"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[11px] text-surface-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-for-400 rounded-full inline-block" />
          Argument Quality
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 inline-block opacity-70 text-against-400" style={{ borderTop: '1.5px dashed currentColor' }} />
          Community Mood
        </span>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function WellbeingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-4">
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WellbeingClient() {
  const [report, setReport] = useState<WellbeingReport | null>(null)
  const [period, setPeriod] = useState<WellbeingPeriod>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (p: WellbeingPeriod) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/wellbeing?period=${p}`)
        if (!res.ok) throw new Error('Failed to load wellbeing data')
        setReport(await res.json())
      } catch {
        setError('Unable to load wellbeing data. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(period)
  }, [period, load])

  const scoreCfg = report
    ? (SCORE_CONFIG[report.overall_label] ?? SCORE_CONFIG.Fair)
    : SCORE_CONFIG.Fair

  const ScoreIcon = scoreCfg.icon

  return (
    <div className="relative flex flex-col min-h-screen">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 pt-4">
        <div className="max-w-2xl mx-auto px-4 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald" aria-hidden="true" />
                Civic Wellbeing
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Platform health across five discourse dimensions
              </p>
            </div>
            <button
              onClick={() => load(period)}
              disabled={loading}
              aria-label="Refresh wellbeing data"
              className="p-2 rounded-xl bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Period selector */}
          <div
            role="tablist"
            aria-label="Time period"
            className="flex gap-1.5 p-1 rounded-xl bg-surface-200 border border-surface-300"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                role="tab"
                aria-selected={period === opt.id}
                onClick={() => setPeriod(opt.id)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                  period === opt.id
                    ? 'bg-surface-100 text-white shadow'
                    : 'text-surface-500 hover:text-surface-700',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loading && <WellbeingSkeleton />}

          {error && (
            <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-4 text-sm text-against-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          {!loading && !error && report && (
            <AnimatePresence mode="wait">
              <motion.div
                key={period}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Overall score card */}
                <div
                  className={cn(
                    'rounded-3xl bg-surface-100 border p-6 flex flex-col items-center gap-4 text-center shadow-lg',
                    scoreCfg.ring,
                  )}
                >
                  {/* Score ring */}
                  <div
                    className={cn(
                      'relative h-32 w-32 rounded-full flex items-center justify-center ring-4',
                      scoreCfg.ring,
                      scoreCfg.bg,
                    )}
                    role="img"
                    aria-label={`Overall civic wellbeing score: ${report.overall_score} out of 100 — ${report.overall_label}`}
                  >
                    <div className="text-center">
                      <p className={cn('text-4xl font-mono font-black', scoreCfg.color)}>
                        {report.overall_score}
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5">/ 100</p>
                    </div>
                    <ScoreIcon
                      className={cn('absolute -top-2 -right-2 h-6 w-6', scoreCfg.color)}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h2 className={cn('text-2xl font-bold', scoreCfg.color)}>
                      {report.overall_label}
                    </h2>
                    <p className="text-sm text-surface-500 mt-1">
                      Civic discourse wellbeing over the last{' '}
                      {period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}
                    </p>
                  </div>

                  {/* Delta */}
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold',
                      report.overall_delta > 2
                        ? 'bg-emerald/10 text-emerald border border-emerald/30'
                        : report.overall_delta < -2
                          ? 'bg-against-500/10 text-against-400 border border-against-500/30'
                          : 'bg-surface-300/50 text-surface-500 border border-surface-400',
                    )}
                  >
                    {report.overall_delta > 2 ? (
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    ) : report.overall_delta < -2 ? (
                      <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Minus className="h-3 w-3" aria-hidden="true" />
                    )}
                    {report.overall_delta > 0 ? '+' : ''}{report.overall_delta} pts vs. prior period
                  </div>

                  {/* Context counts */}
                  <div className="flex items-center gap-4 text-[11px] text-surface-500 flex-wrap justify-center">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" aria-hidden="true" />
                      <AnimatedNumber value={report.total_arguments} /> arguments
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" aria-hidden="true" />
                      <AnimatedNumber value={report.total_mood_reactions} /> mood reactions
                    </span>
                    {report.total_thesis_resolved > 0 && (
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" aria-hidden="true" />
                        <AnimatedNumber value={report.total_thesis_resolved} /> theses resolved
                      </span>
                    )}
                  </div>
                </div>

                {/* Dimension grid */}
                <section aria-label="Wellbeing dimensions">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                    Five Dimensions
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {report.dimensions.map((dim, i) => (
                      <motion.div
                        key={dim.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                      >
                        <DimensionCard dim={dim} daily={report.daily} />
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* Trend chart */}
                <section
                  aria-label="Wellbeing trend over time"
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
                >
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Trend Over Time
                  </h2>
                  <TimelineChart daily={report.daily} period={period} />
                </section>

                {/* Best / worst day */}
                {(report.best_day || report.worst_day) && (
                  <div className="grid grid-cols-2 gap-3">
                    {report.best_day && (
                      <div className="rounded-2xl bg-emerald/5 border border-emerald/20 p-4">
                        <p className="text-[10px] font-mono text-emerald uppercase tracking-wider mb-1">
                          Peak Day
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {new Date(report.best_day).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                        <p className="text-[11px] text-surface-500 mt-0.5">
                          Highest quality + mood composite
                        </p>
                      </div>
                    )}
                    {report.worst_day && (
                      <div className="rounded-2xl bg-against-500/5 border border-against-500/20 p-4">
                        <p className="text-[10px] font-mono text-against-400 uppercase tracking-wider mb-1">
                          Lowest Day
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {new Date(report.worst_day).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                        <p className="text-[11px] text-surface-500 mt-0.5">
                          Lowest quality + mood composite
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Explore links */}
                <section aria-label="Explore related pages">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                    Explore Further
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { href: '/vitals',        label: 'Discourse Vitals',  icon: BarChart2,    color: 'text-for-400' },
                      { href: '/polarization',  label: 'Polarization Index',icon: Scale,        color: 'text-emerald' },
                      { href: '/mood',          label: 'Community Mood',    icon: Heart,        color: 'text-against-400' },
                      { href: '/trajectory',    label: 'Topic Trajectory',  icon: Flame,        color: 'text-gold' },
                      { href: '/thesis',        label: 'Civic Theses',      icon: Target,       color: 'text-purple' },
                      { href: '/climate',       label: 'Civic Climate',     icon: Users,        color: 'text-for-300' },
                    ].map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                        >
                          <ItemIcon
                            className={cn('h-3.5 w-3.5 flex-shrink-0', item.color)}
                            aria-hidden="true"
                          />
                          <span className="text-xs text-surface-500 group-hover:text-white transition-colors truncate">
                            {item.label}
                          </span>
                          <ArrowRight
                            className="h-3 w-3 text-surface-500 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-hidden="true"
                          />
                        </Link>
                      )
                    })}
                  </div>
                </section>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
