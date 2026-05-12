'use client'

/**
 * /analytics/predictions — Prediction Market Analytics
 *
 * Comprehensive breakdown of the user's prediction market record:
 *   - Hero stats: total, accuracy %, Brier score, Clout earned
 *   - Calibration chart: confidence buckets vs actual accuracy
 *   - Category breakdown: where your foresight is sharpest
 *   - Prediction archetype: Oracle, Analyst, Cautious, Contrarian, Newcomer
 *   - Active (pending) predictions
 *   - Resolved prediction history with outcomes
 *
 * Distinct from:
 *   /predictions    — browse open market topics, stake predictions
 *   /prescient      — vote alignment intelligence
 *   /forecasters    — community-wide Oracle Board leaderboard
 *   /analytics      — overall civic stats hub
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coins,
  Crown,
  Eye,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PredictionRecord } from '@/app/api/analytics/predictions/route'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PredictionArchetype =
  | 'oracle'
  | 'analyst'
  | 'contrarian'
  | 'cautious'
  | 'newcomer'

interface CalibrationBucket {
  label: string
  range: [number, number]
  total: number
  correct: number
  accuracy: number | null
}

interface CategoryStat {
  category: string
  total: number
  resolved: number
  correct: number
  accuracy: number | null
  avg_brier: number | null
  clout: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relDate(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Archetype config ──────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<
  PredictionArchetype,
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
    description: 'Uncanny accuracy. You call 75%+ of resolutions correctly and your Brier score is better than chance. The Lobby trusts your foresight.',
    icon: Eye,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  analyst: {
    label: 'The Analyst',
    description: 'Solid forecaster. Your accuracy is above average and you spread predictions across multiple categories.',
    icon: Brain,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  contrarian: {
    label: 'The Contrarian',
    description: 'You consistently bet against the crowd. Sometimes it pays off spectacularly — and sometimes the crowd is right.',
    icon: TrendingDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  cautious: {
    label: 'The Cautious',
    description: 'You favour lower-confidence predictions, hedging your bets. A safer but less clout-efficient strategy.',
    icon: Scale,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  newcomer: {
    label: 'The Newcomer',
    description: 'Just getting started in the prediction market. Make at least 5 resolved predictions to unlock your forecaster archetype.',
    icon: Circle,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
  },
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof Trophy
  color: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-0.5">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <div className="text-[11px] text-surface-500 font-mono">{sub}</div>}
    </div>
  )
}

// ─── Calibration chart ─────────────────────────────────────────────────────────

function CalibrationChart({ buckets }: { buckets: CalibrationBucket[] }) {
  const hasSome = buckets.some((b) => b.total > 0)
  if (!hasSome) {
    return (
      <div className="text-xs text-surface-500 font-mono py-4 text-center">
        Make more resolved predictions to see your calibration.
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Perfect calibration guide */}
      <div className="text-[11px] text-surface-500 font-mono mb-3">
        A perfectly calibrated forecaster&apos;s accuracy matches their confidence level.
      </div>
      {buckets.map((b) => {
        const mid = (b.range[0] + b.range[1]) / 2
        const accuracy = b.accuracy ?? 0
        const perfect = mid
        const deviation = accuracy - perfect

        return (
          <div key={b.label} className="grid grid-cols-[80px_1fr_50px] items-center gap-3">
            <span className="text-[11px] font-mono text-surface-500 text-right">{b.label}</span>
            <div className="relative h-5">
              {/* Perfect calibration line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-surface-400/30"
                style={{ left: `${perfect}%` }}
              />
              {/* Actual bar */}
              {b.total > 0 ? (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${accuracy}%` }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    'h-full rounded-sm',
                    deviation >= 10
                      ? 'bg-gold/60'
                      : deviation <= -10
                      ? 'bg-against-500/60'
                      : 'bg-for-500/60'
                  )}
                />
              ) : (
                <div className="h-full rounded-sm bg-surface-300/20" />
              )}
            </div>
            <span className={cn(
              'text-[11px] font-mono',
              b.total === 0 ? 'text-surface-500' : accuracy >= 50 ? 'text-for-300' : 'text-against-400'
            )}>
              {b.total === 0 ? '—' : `${Math.round(accuracy)}%`}
            </span>
          </div>
        )
      })}
      <div className="flex justify-between text-[10px] text-surface-600 font-mono mt-1 px-[80px]">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

// ─── Prediction row ────────────────────────────────────────────────────────────

function PredictionRow({ p }: { p: PredictionRecord }) {
  const resolved = p.resolved_at !== null
  const isCorrect = p.correct === true
  const isWrong = p.correct === false
  const predictedLaw = p.predicted_law

  let outcomeIcon = <Circle className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
  if (resolved && isCorrect) outcomeIcon = <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
  else if (resolved && isWrong) outcomeIcon = <XCircle className="w-4 h-4 text-against-400 shrink-0 mt-0.5" />

  return (
    <Link href={`/topic/${p.topic_id}`}>
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5 hover:border-surface-400/60 transition-colors group">
        <div className="flex items-start gap-3">
          {outcomeIcon}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {p.topic?.statement ?? 'Unknown topic'}
            </p>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={cn(
                  'text-[11px] font-mono px-1.5 py-0.5 rounded border',
                  predictedLaw
                    ? 'text-for-300 bg-for-500/10 border-for-500/20'
                    : 'text-against-400 bg-against-500/10 border-against-500/20'
                )}
              >
                {predictedLaw ? 'Predicted LAW' : 'Predicted FAIL'}
              </span>
              <span className="text-[11px] text-surface-500 font-mono">
                {p.confidence}% confidence
              </span>
              {p.topic?.category && (
                <span className="text-[11px] text-surface-600 font-mono">
                  {p.topic.category}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {resolved ? (
              <>
                <div className={cn('text-xs font-mono font-semibold', isCorrect ? 'text-emerald' : isWrong ? 'text-against-400' : 'text-surface-500')}>
                  {isCorrect ? `+${p.clout_earned} Clout` : isWrong ? '—' : '—'}
                </div>
                <div className="text-[10px] text-surface-600 mt-0.5">{relDate(p.resolved_at)}</div>
              </>
            ) : (
              <>
                <div className="text-xs font-mono text-surface-500">Pending</div>
                <div className="text-[10px] text-surface-600 mt-0.5">{relDate(p.created_at)}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function PredictionsAnalyticsPage() {
  const router = useRouter()
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'resolved'>('resolved')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/predictions')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      const d = await res.json()
      setPredictions(d.predictions ?? [])
    } catch {
      setError('Failed to load prediction analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // ─── Derived stats ────────────────────────────────────────────────────────────

  const resolved = predictions.filter((p) => p.resolved_at !== null)
  const active = predictions.filter((p) => p.resolved_at === null)
  const correct = resolved.filter((p) => p.correct === true)

  const accuracy = resolved.length > 0 ? (correct.length / resolved.length) * 100 : null
  const totalClout = predictions.reduce((s, p) => s + p.clout_earned, 0)

  const brierScores = resolved.filter((p) => p.brier_score !== null).map((p) => p.brier_score as number)
  const avgBrier = brierScores.length > 0
    ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
    : null

  // Calibration buckets
  const BUCKETS: CalibrationBucket[] = [
    { label: '0–30%', range: [0, 30], total: 0, correct: 0, accuracy: null },
    { label: '30–50%', range: [30, 50], total: 0, correct: 0, accuracy: null },
    { label: '50–70%', range: [50, 70], total: 0, correct: 0, accuracy: null },
    { label: '70–85%', range: [70, 85], total: 0, correct: 0, accuracy: null },
    { label: '85–100%', range: [85, 100], total: 0, correct: 0, accuracy: null },
  ]
  for (const p of resolved) {
    for (const b of BUCKETS) {
      if (p.confidence >= b.range[0] && p.confidence <= b.range[1]) {
        b.total++
        if (p.correct) b.correct++
        break
      }
    }
  }
  for (const b of BUCKETS) {
    b.accuracy = b.total > 0 ? (b.correct / b.total) * 100 : null
  }

  // Category breakdown
  const catMap = new Map<string, CategoryStat>()
  for (const p of predictions) {
    const cat = p.topic?.category ?? 'Other'
    const s = catMap.get(cat) ?? { category: cat, total: 0, resolved: 0, correct: 0, accuracy: null, avg_brier: null, clout: 0 }
    s.total++
    s.clout += p.clout_earned
    if (p.resolved_at !== null) {
      s.resolved++
      if (p.correct) s.correct++
    }
    catMap.set(cat, s)
  }
  const categoryStats: CategoryStat[] = Array.from(catMap.values())
    .map((s) => ({
      ...s,
      accuracy: s.resolved > 0 ? (s.correct / s.resolved) * 100 : null,
    }))
    .sort((a, b) => b.total - a.total)

  // Archetype
  function computeArchetype(): PredictionArchetype {
    if (resolved.length < 5) return 'newcomer'
    const acc = accuracy ?? 0
    const avgConf = predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length

    if (acc >= 75) return 'oracle'
    if (acc >= 58 && predictions.length >= 10) return 'analyst'
    if (avgConf < 45) return 'cautious'
    if (acc < 40) return 'contrarian'
    return 'analyst'
  }

  const archetype = computeArchetype()
  const archetypeConf = ARCHETYPE_CONFIG[archetype]
  const ArchIcon = archetypeConf.icon

  // Best / worst predictions
  const bestPredictions = resolved
    .filter((p) => p.correct === true)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)

  const worstPredictions = resolved
    .filter((p) => p.correct === false)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)

  // Active / resolved lists
  const displayList = tab === 'active' ? active : resolved.slice(0, 50)

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Analytics
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-surface-600" />
          <span className="text-xs font-mono text-white">Prediction Analytics</span>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-purple" />
            <h1 className="text-xl font-bold font-mono text-white">Prediction Analytics</h1>
          </div>
          <p className="text-sm text-surface-500 font-mono">
            Your full prediction market record — accuracy, calibration, and market instincts.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-14 mb-1" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-against-900/20 border border-against-500/20 p-6 text-center">
            <p className="text-sm text-against-400 font-mono mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-white bg-surface-200 hover:bg-surface-300 border border-surface-400 rounded-lg px-3 py-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : predictions.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No predictions yet"
            description="Visit the Prediction Market to stake your accuracy on topics heading to a final vote."
            action={{ label: 'Open Prediction Market', href: '/predictions' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >

              {/* Hero stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total"
                  value={predictions.length}
                  sub={`${active.length} pending`}
                  icon={Target}
                  color="text-purple"
                />
                <StatCard
                  label="Accuracy"
                  value={accuracy !== null ? `${Math.round(accuracy)}%` : '—'}
                  sub={`${correct.length} / ${resolved.length} correct`}
                  icon={CheckCircle2}
                  color={accuracy !== null && accuracy >= 60 ? 'text-emerald' : 'text-against-400'}
                />
                <StatCard
                  label="Brier Score"
                  value={avgBrier !== null ? avgBrier.toFixed(3) : '—'}
                  sub="lower is better"
                  icon={Brain}
                  color={avgBrier !== null && avgBrier < 0.2 ? 'text-gold' : 'text-surface-400'}
                />
                <StatCard
                  label="Clout Earned"
                  value={totalClout}
                  sub="from predictions"
                  icon={Coins}
                  color="text-gold"
                />
              </div>

              {/* Archetype */}
              <div className={cn(
                'rounded-xl border p-5 flex items-start gap-4',
                archetypeConf.bg,
                archetypeConf.border
              )}>
                <div className={cn('p-2.5 rounded-xl', archetypeConf.bg, archetypeConf.border)}>
                  <ArchIcon className={cn('w-5 h-5', archetypeConf.color)} />
                </div>
                <div>
                  <div className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest mb-0.5', archetypeConf.color)}>
                    Forecaster Archetype
                  </div>
                  <h2 className="text-base font-bold text-white font-mono mb-1">{archetypeConf.label}</h2>
                  <p className="text-xs text-surface-500 font-mono leading-relaxed">
                    {archetypeConf.description}
                  </p>
                </div>
              </div>

              {/* Calibration */}
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-5">
                <h3 className="text-sm font-semibold text-white font-mono mb-4 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-for-400" />
                  Calibration — Confidence vs Accuracy
                </h3>
                <CalibrationChart buckets={BUCKETS} />
              </div>

              {/* Category breakdown */}
              {categoryStats.length > 0 && (
                <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-5">
                  <h3 className="text-sm font-semibold text-white font-mono mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-purple" />
                    Category Breakdown
                  </h3>
                  <div className="space-y-2">
                    {categoryStats.map((s) => {
                      const accNum = s.accuracy ?? 0
                      const barPct = Math.min(accNum, 100)
                      return (
                        <div key={s.category}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-white">{s.category}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-mono text-surface-500">
                                {s.total} prediction{s.total !== 1 ? 's' : ''}
                              </span>
                              <span className={cn(
                                'text-xs font-mono font-semibold',
                                s.accuracy === null ? 'text-surface-500' :
                                s.accuracy >= 65 ? 'text-emerald' :
                                s.accuracy >= 50 ? 'text-for-300' : 'text-against-400'
                              )}>
                                {s.accuracy !== null ? `${Math.round(s.accuracy)}%` : 'Pending'}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
                            {s.accuracy !== null && (
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${barPct}%` }}
                                transition={{ duration: 0.5 }}
                                className={cn(
                                  'h-full rounded-full',
                                  s.accuracy >= 65 ? 'bg-emerald' :
                                  s.accuracy >= 50 ? 'bg-for-500' : 'bg-against-500'
                                )}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Best / worst */}
              {(bestPredictions.length > 0 || worstPredictions.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Best */}
                  {bestPredictions.length > 0 && (
                    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-5">
                      <h3 className="text-sm font-semibold text-white font-mono mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-gold" />
                        Best Calls
                      </h3>
                      <div className="space-y-2">
                        {bestPredictions.map((p) => (
                          <Link key={p.id} href={`/topic/${p.topic_id}`}>
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors group">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-mono text-white truncate group-hover:text-for-300 transition-colors">
                                  {p.topic?.statement ?? '—'}
                                </p>
                                <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                                  {p.confidence}% confident · {p.predicted_law ? 'LAW' : 'FAIL'}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Worst */}
                  {worstPredictions.length > 0 && (
                    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-5">
                      <h3 className="text-sm font-semibold text-white font-mono mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-against-400" />
                        Missed Calls
                      </h3>
                      <div className="space-y-2">
                        {worstPredictions.map((p) => (
                          <Link key={p.id} href={`/topic/${p.topic_id}`}>
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors group">
                              <XCircle className="w-3.5 h-3.5 text-against-400 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-mono text-white truncate group-hover:text-for-300 transition-colors">
                                  {p.topic?.statement ?? '—'}
                                </p>
                                <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                                  {p.confidence}% confident · {p.predicted_law ? 'LAW' : 'FAIL'}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prediction list tabs */}
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-surface-300/60">
                  {(
                    [
                      { key: 'resolved', label: 'Resolved', count: resolved.length },
                      { key: 'active', label: 'Active', count: active.length },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-mono font-semibold transition-colors',
                        tab === t.key
                          ? 'text-white bg-surface-200/60 border-b-2 border-purple'
                          : 'text-surface-500 hover:text-surface-400'
                      )}
                    >
                      {t.label}
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-md text-[10px]',
                        tab === t.key ? 'bg-purple/20 text-purple' : 'bg-surface-300/40 text-surface-600'
                      )}>
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="p-4 space-y-2">
                  {displayList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-surface-500 font-mono">
                      {tab === 'active'
                        ? 'No active predictions right now.'
                        : 'No resolved predictions yet.'}
                    </div>
                  ) : (
                    displayList.map((p) => (
                      <PredictionRow key={p.id} p={p} />
                    ))
                  )}
                  {tab === 'resolved' && resolved.length > 50 && (
                    <p className="text-center text-[11px] text-surface-600 font-mono pt-2">
                      Showing 50 of {resolved.length} resolved predictions.
                    </p>
                  )}
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/predictions"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/80 hover:bg-purple border border-purple/50 text-white text-xs font-mono font-semibold transition-colors"
                >
                  <Target className="w-3.5 h-3.5" />
                  Prediction Market
                </Link>
                <Link
                  href="/forecasters"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-400/40 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Oracle Leaderboard
                </Link>
                <Link
                  href="/prescient"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-400/40 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Vote Alignment
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
