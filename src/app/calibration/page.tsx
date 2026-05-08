'use client'

/**
 * /calibration — Civic Calibration Dashboard
 *
 * Analyzes how well a user's votes align with eventual topic outcomes.
 * Inspired by prediction-market calibration: if you vote 70% of the time
 * with the majority, how often does that side actually win?
 *
 * Metrics:
 *   • Overall accuracy (% of votes on the winning side)
 *   • Brier score (lower = better probability estimates)
 *   • Contrarian accuracy (voted against majority and won)
 *   • Consensus accuracy (voted with majority and won)
 *   • Category breakdown
 *   • Calibration curve (SVG — expected vs actual win rate)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  RefreshCw,
  Scale,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { CalibrationData, BucketPoint } from '@/app/api/analytics/calibration/route'

// ─── Category colors (matches platform palette) ───────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:     '#c9a84c',
  Politics:      '#60a5fa',
  Technology:    '#a78bfa',
  Science:       '#34d399',
  Ethics:        '#f87171',
  Philosophy:    '#93c5fd',
  Culture:       '#fbbf24',
  Health:        '#fb7185',
  Environment:   '#6ee7b7',
  Education:     '#c4b5fd',
  Uncategorized: '#6b7280',
}

// ─── Grade styles ─────────────────────────────────────────────────────────────

const GRADE_META: Record<
  string,
  { ring: string; bg: string; text: string; label: string; description: string }
> = {
  S: {
    ring: 'ring-gold/60',
    bg: 'bg-gold/10',
    text: 'text-gold',
    label: 'Visionary',
    description: 'You consistently pick winning sides before the crowd. Elite civic intuition.',
  },
  A: {
    ring: 'ring-emerald/60',
    bg: 'bg-emerald/10',
    text: 'text-emerald',
    label: 'Prescient',
    description: 'Above-average accuracy with strong civic judgment across categories.',
  },
  B: {
    ring: 'ring-for-500/60',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    label: 'Measured',
    description: 'Solid calibration. You read the Lobby\'s pulse more often than not.',
  },
  C: {
    ring: 'ring-purple/60',
    bg: 'bg-purple/10',
    text: 'text-purple',
    label: 'Developing',
    description: 'Near coin-flip accuracy. Room to sharpen your civic instincts.',
  },
  D: {
    ring: 'ring-against-500/60',
    bg: 'bg-against-500/10',
    text: 'text-against-400',
    label: 'Recalibrating',
    description: 'Your votes lean opposite to outcomes. Consider cross-reading arguments.',
  },
  F: {
    ring: 'ring-surface-400/60',
    bg: 'bg-surface-200',
    text: 'text-surface-400',
    label: 'Unranked',
    description: 'Not enough resolved votes to calibrate yet.',
  },
}

// ─── Calibration curve SVG ────────────────────────────────────────────────────

function CalibrationCurve({ curve }: { curve: BucketPoint[] }) {
  const W = 340
  const H = 200
  const PAD = 36

  const plotW = W - PAD * 2
  const plotH = H - PAD * 2

  // Perfect calibration diagonal
  const diagX1 = PAD
  const diagY1 = PAD + plotH
  const diagX2 = PAD + plotW
  const diagY2 = PAD

  // User's points (only buckets with data)
  const points = curve.filter((b) => b.count > 0)

  function toX(pct: number) {
    return PAD + (pct / 100) * plotW
  }
  function toY(pct: number) {
    return PAD + plotH - (pct / 100) * plotH
  }

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.predicted)},${toY(p.actual)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Calibration curve showing predicted vs actual win rates"
    >
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={PAD} y1={toY(v)}
            x2={PAD + plotW} y2={toY(v)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          <text
            x={PAD - 6} y={toY(v) + 4}
            textAnchor="end"
            className="fill-surface-500"
            style={{ fontSize: 9, fontFamily: 'monospace' }}
          >
            {v}%
          </text>
          <line
            x1={toX(v)} y1={PAD}
            x2={toX(v)} y2={PAD + plotH}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          <text
            x={toX(v)} y={PAD + plotH + 14}
            textAnchor="middle"
            className="fill-surface-500"
            style={{ fontSize: 9, fontFamily: 'monospace' }}
          >
            {v}%
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PAD} y1={PAD} x2={PAD} y2={PAD + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={PAD} y1={PAD + plotH} x2={PAD + plotW} y2={PAD + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Perfect calibration diagonal */}
      <line
        x1={diagX1} y1={diagY1}
        x2={diagX2} y2={diagY2}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.5"
        strokeDasharray="5,4"
      />

      {/* Shaded area between user curve and perfect */}
      {points.length >= 2 && (
        <path
          d={[
            `M ${toX(points[0].predicted)},${toY(points[0].actual)}`,
            ...points.slice(1).map((p) => `L ${toX(p.predicted)},${toY(p.actual)}`),
            `L ${toX(points[points.length - 1].predicted)},${toY(points[points.length - 1].predicted)}`,
            ...points
              .slice(0, -1)
              .reverse()
              .map((p) => `L ${toX(p.predicted)},${toY(p.predicted)}`),
            'Z',
          ].join(' ')}
          fill="rgba(96,165,250,0.08)"
        />
      )}

      {/* User curve */}
      {points.length >= 2 && (
        <path
          d={linePath}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={toX(p.predicted)}
            cy={toY(p.actual)}
            r={Math.min(8, 3 + p.count)}
            fill="#1e40af"
            stroke="#60a5fa"
            strokeWidth="1.5"
          />
          {p.count >= 3 && (
            <text
              x={toX(p.predicted)}
              y={toY(p.actual) - 7}
              textAnchor="middle"
              style={{ fontSize: 8, fontFamily: 'monospace', fill: '#93c5fd' }}
            >
              {p.count}
            </text>
          )}
        </g>
      ))}

      {/* Axis labels */}
      <text
        x={W / 2} y={H - 2}
        textAnchor="middle"
        style={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }}
      >
        Platform majority % for your vote
      </text>
      <text
        x={8} y={H / 2}
        textAnchor="middle"
        transform={`rotate(-90, 8, ${H / 2})`}
        style={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }}
      >
        Your win rate
      </text>
    </svg>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cat, max }: { cat: CalibrationData['byCategory'][number]; max: number }) {
  const color = CATEGORY_COLOR[cat.category] ?? '#6b7280'
  const pct = max > 0 ? (cat.accuracy / 100) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3"
    >
      <span className="font-mono text-xs text-surface-400 w-[90px] shrink-0 truncate">
        {cat.category}
      </span>
      <div className="flex-1 relative h-5 bg-surface-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color + '40', borderRight: `2px solid ${color}` }}
        />
        <div
          className="absolute inset-y-0 left-0 w-0.5 opacity-30"
          style={{ left: '50%', backgroundColor: color }}
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {cat.accuracy}%
        </span>
        <span className="font-mono text-xs text-surface-500">({cat.total})</span>
      </div>
    </motion.div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  animate = false,
}: {
  icon: typeof Activity
  label: string
  value: string | number
  sub?: string
  color: string
  animate?: boolean
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="font-mono text-xs text-surface-400">{label}</span>
      </div>
      <div className={cn('font-mono text-2xl font-bold', color)}>
        {animate && typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <p className="font-mono text-xs text-surface-500 leading-snug">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalibrationPage() {
  const [data, setData] = useState<CalibrationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/calibration')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const grade = data?.grade ?? 'F'
  const gradeMeta = GRADE_META[grade] ?? GRADE_META['F']

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <FlaskConical className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Calibration</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                How accurately do your votes predict outcomes?
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors font-mono text-xs disabled:opacity-40"
            aria-label="Refresh calibration data"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 font-mono text-xs text-surface-500 mb-8" aria-label="Breadcrumb">
          <Link href="/analytics" className="hover:text-for-400 transition-colors">Analytics</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-surface-300">Calibration</span>
        </nav>

        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={XCircle}
            title="Couldn't load calibration data"
            description="Something went wrong fetching your results."
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {!loading && !error && data && data.totalResolved === 0 && (
          <EmptyState
            icon={Scale}
            title="No resolved votes yet"
            description="Your calibration score appears once topics you've voted on resolve as law or fail. Keep voting!"
            actions={[
              { label: 'Browse topics', href: '/' },
              { label: 'Your positions', href: '/positions' },
            ]}
          />
        )}

        {!loading && !error && data && data.totalResolved > 0 && (
          <div className="space-y-6">

            {/* Grade card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6',
                'bg-surface-100',
                gradeMeta.ring.replace('ring', 'border'),
              )}
            >
              {/* Grade badge */}
              <div className={cn(
                'flex items-center justify-center w-20 h-20 rounded-2xl border-2 shrink-0',
                'font-mono text-5xl font-black',
                gradeMeta.ring.replace('ring', 'border'),
                gradeMeta.bg,
                gradeMeta.text,
              )}>
                {grade}
              </div>

              <div className="flex-1 min-w-0">
                <p className={cn('font-mono text-sm font-bold mb-1', gradeMeta.text)}>
                  {gradeMeta.label}
                </p>
                <h2 className="font-mono text-3xl font-black text-white mb-1">
                  <AnimatedNumber value={data.accuracy} />% accurate
                </h2>
                <p className="font-mono text-sm text-surface-400 leading-snug">
                  {gradeMeta.description}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Badge variant="default" className="font-mono text-xs">
                    {data.correct} / {data.totalResolved} correct
                  </Badge>
                  <span className="font-mono text-xs text-surface-500">
                    Brier score: {data.brierScore.toFixed(3)} {data.brierScore < 0.2 ? '(excellent)' : data.brierScore < 0.25 ? '(good)' : '(needs work)'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={Target}
                label="Accuracy"
                value={`${data.accuracy}%`}
                sub={`${data.correct} of ${data.totalResolved} resolved`}
                color="text-for-400"
              />
              <StatCard
                icon={Swords}
                label="Contrarian"
                value={`${data.contrarian.accuracy}%`}
                sub={`${data.contrarian.total} minority votes`}
                color="text-against-400"
              />
              <StatCard
                icon={Users}
                label="Consensus"
                value={`${data.consensus.accuracy}%`}
                sub={`${data.consensus.total} majority votes`}
                color="text-purple"
              />
              <StatCard
                icon={data.majorityBias >= 0 ? TrendingUp : TrendingDown}
                label="Majority bias"
                value={`${data.majorityBias > 0 ? '+' : ''}${data.majorityBias}%`}
                sub={data.majorityBias > 20
                  ? 'Echo-chamber tendency'
                  : data.majorityBias < -20
                  ? 'Contrarian tendency'
                  : 'Balanced voter'}
                color={data.majorityBias > 20 ? 'text-gold' : data.majorityBias < -20 ? 'text-against-400' : 'text-emerald'}
              />
            </div>

            {/* Contrarian vs consensus insight */}
            {data.contrarian.total >= 2 && data.consensus.total >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-surface-300 bg-surface-100 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-purple" />
                  <span className="font-mono text-xs font-bold text-surface-300">Contrarian vs Consensus</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Against the crowd',
                      icon: Swords,
                      pct: data.contrarian.accuracy,
                      total: data.contrarian.total,
                      color: 'text-against-400',
                      bg: 'bg-against-500/10',
                      border: 'border-against-500/20',
                    },
                    {
                      label: 'With the crowd',
                      icon: Users,
                      pct: data.consensus.accuracy,
                      total: data.consensus.total,
                      color: 'text-for-400',
                      bg: 'bg-for-500/10',
                      border: 'border-for-500/20',
                    },
                  ].map(({ label, icon: Icon, pct, total, color, bg, border }) => (
                    <div key={label} className={cn('rounded-lg border p-3', bg, border)}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className={cn('h-3.5 w-3.5', color)} />
                        <span className="font-mono text-xs text-surface-400">{label}</span>
                      </div>
                      <p className={cn('font-mono text-2xl font-bold', color)}>{pct}%</p>
                      <p className="font-mono text-xs text-surface-500 mt-0.5">{total} votes</p>
                      <div className="mt-2 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                          className={cn('h-full rounded-full', bg.replace('bg-', 'bg-').replace('/10', '/60'))}
                          style={{
                            backgroundColor: color.includes('against')
                              ? 'rgba(239,68,68,0.5)'
                              : 'rgba(59,130,246,0.5)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-xs text-surface-500 mt-3 leading-snug">
                  {data.contrarian.accuracy > data.consensus.accuracy
                    ? `Your contrarian instincts beat your consensus votes by ${data.contrarian.accuracy - data.consensus.accuracy}pp — you have strong independent civic judgment.`
                    : data.contrarian.accuracy < data.consensus.accuracy
                    ? `You're more accurate when voting with the majority. Contrarian bets cost ${data.consensus.accuracy - data.contrarian.accuracy}pp on average.`
                    : 'Your accuracy is equal whether you vote with the crowd or against it.'}
                </p>
              </motion.div>
            )}

            {/* Calibration curve */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-surface-300 bg-surface-100 p-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-for-400" />
                <h3 className="font-mono text-sm font-bold text-surface-300">Calibration Curve</h3>
              </div>
              <p className="font-mono text-xs text-surface-500 mb-4 leading-snug">
                Blue dots = your actual win rate per confidence level. Dashed line = perfect calibration.
                Dots above the line mean you underestimate your chances; below means overconfidence.
              </p>
              <CalibrationCurve curve={data.curve} />
            </motion.div>

            {/* Category breakdown */}
            {data.byCategory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="h-4 w-4 text-purple" />
                  <h3 className="font-mono text-sm font-bold text-surface-300">Accuracy by Category</h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-4 mt-1">
                  {data.bestCategory && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald/10 border border-emerald/20">
                      <CheckCircle2 className="h-3 w-3 text-emerald" />
                      <span className="font-mono text-xs text-emerald">Best: {data.bestCategory}</span>
                    </div>
                  )}
                  {data.worstCategory && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-against-500/10 border border-against-500/20">
                      <XCircle className="h-3 w-3 text-against-400" />
                      <span className="font-mono text-xs text-against-400">Weakest: {data.worstCategory}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  {data.byCategory.map((cat) => (
                    <CategoryBar key={cat.category} cat={cat} max={100} />
                  ))}
                </div>
                <p className="font-mono text-xs text-surface-500 mt-4">
                  50% line = coin-flip baseline. Bar width shows accuracy; vote count in parentheses.
                </p>
              </motion.div>
            )}

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-surface-300 bg-surface-100 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-gold" />
                <h3 className="font-mono text-sm font-bold text-surface-300">How to improve</h3>
              </div>
              <ul className="space-y-2">
                {[
                  data.accuracy < 55 && {
                    icon: Brain,
                    text: 'Read the top arguments on both sides before voting. The strongest arguments often predict the outcome.',
                  },
                  data.contrarian.accuracy < 40 && data.contrarian.total > 3 && {
                    icon: Swords,
                    text: 'Your contrarian bets underperform. When you\'re in the minority, double-check your reasoning.',
                  },
                  data.majorityBias > 40 && {
                    icon: Users,
                    text: 'You vote with the majority often. Challenge yourself by reading the case for the other side first.',
                  },
                  data.brierScore > 0.28 && {
                    icon: Target,
                    text: 'High Brier score suggests poor calibration. Vote on topics where you have genuine conviction, not just popular ones.',
                  },
                  data.byCategory.some((c) => c.accuracy < 40 && c.total >= 3) && {
                    icon: BarChart2,
                    text: `You struggle in your weakest category (${data.worstCategory}). Try reading more arguments there before voting.`,
                  },
                  { icon: CheckCircle2, text: 'Vote earlier in a topic\'s life — early contrarian votes that win are weighted higher in calibration.' },
                ]
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((tip, i) => {
                    if (!tip) return null
                    const Icon = tip.icon
                    return (
                      <li key={i} className="flex items-start gap-2.5">
                        <Icon className="h-3.5 w-3.5 text-gold mt-0.5 shrink-0" />
                        <p className="font-mono text-xs text-surface-400 leading-snug">{tip.text}</p>
                      </li>
                    )
                  })}
              </ul>
            </motion.div>

            {/* Links */}
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/positions', label: 'Your positions', icon: Scale },
                { href: '/analytics', label: 'Full analytics', icon: BarChart2 },
                { href: '/predictions', label: 'Predictions', icon: Target },
                { href: '/report-card', label: 'Report card', icon: CheckCircle2 },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors font-mono text-xs text-surface-300 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
