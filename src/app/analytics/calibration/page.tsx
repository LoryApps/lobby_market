'use client'

/**
 * /analytics/calibration — Civic Calibration Report
 *
 * Shows how well-calibrated the user's civic votes are: did the topics
 * they voted FOR become law? Did the topics they voted AGAINST fail?
 *
 * Distinct from:
 *   /calibration              — the prediction GAME (explicit % forecasts)
 *   /analytics/predictions    — stats for formal predictions market
 *   /analytics/votes          — raw voting patterns (when/how often)
 *   /analytics/evolution      — how your FOR% shifts over time
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  Gauge,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CalibrationData,
  CategoryCalibration,
  BucketPoint,
} from '@/app/api/analytics/calibration/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

function catColor(c: string) {
  return CAT_COLOR[c] ?? 'text-surface-400'
}

const GRADE_STYLE: Record<
  string,
  { text: string; bg: string; border: string; ring: string; bar: string }
> = {
  S: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    ring: 'ring-gold/30',
    bar: 'bg-gold',
  },
  A: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    ring: 'ring-emerald/30',
    bar: 'bg-emerald',
  },
  B: {
    text: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    ring: 'ring-for-500/20',
    bar: 'bg-for-500',
  },
  C: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    ring: 'ring-gold/20',
    bar: 'bg-gold',
  },
  D: {
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    ring: 'ring-against-500/20',
    bar: 'bg-against-500',
  },
  F: {
    text: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    ring: 'ring-surface-400/20',
    bar: 'bg-surface-400',
  },
}

const GRADE_LABEL: Record<string, string> = {
  S: 'Exceptional — your civic instincts are sharply calibrated.',
  A: 'Excellent — your votes align well with outcomes.',
  B: 'Good — reliably on the right side of history.',
  C: 'Moderate — about as likely to be right as wrong.',
  D: 'Developing — your picks often diverge from outcomes.',
  F: 'Not enough resolved votes yet to score.',
}

const BIAS_LABEL = (bias: number): { text: string; color: string; icon: typeof TrendingUp } => {
  if (bias > 25) return { text: 'Strong echo-chamber tendency', color: 'text-against-400', icon: TrendingUp }
  if (bias > 10) return { text: 'Mild majority follower', color: 'text-gold', icon: TrendingUp }
  if (bias >= -10) return { text: 'Balanced — you split your votes fairly', color: 'text-emerald', icon: Scale }
  if (bias >= -25) return { text: 'Mild contrarian', color: 'text-for-400', icon: TrendingDown }
  return { text: 'Strong contrarian tendency', color: 'text-purple', icon: TrendingDown }
}

// ─── Calibration curve SVG ────────────────────────────────────────────────────

const CURVE_W = 280
const CURVE_H = 140
const PAD = 20

function CalibrationCurve({ curve }: { curve: BucketPoint[] }) {
  const withData = curve.filter((b) => b.count > 0)

  if (withData.length < 2) {
    return (
      <div className="flex items-center justify-center h-36 text-xs font-mono text-surface-500">
        Need more resolved votes for chart
      </div>
    )
  }

  const toX = (pct: number) => PAD + ((pct / 100) * (CURVE_W - PAD * 2))
  const toY = (pct: number) => CURVE_H - PAD - ((pct / 100) * (CURVE_H - PAD * 2))

  const dotPath = withData
    .map((b, i) => `${i === 0 ? 'M' : 'L'} ${toX(b.predicted)} ${toY(b.actual)}`)
    .join(' ')

  const diagX1 = toX(0)
  const diagY1 = toY(0)
  const diagX2 = toX(100)
  const diagY2 = toY(100)

  return (
    <svg
      viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
      className="w-full"
      aria-label="Calibration curve chart"
    >
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={toX(v)} y1={PAD} x2={toX(v)} y2={CURVE_H - PAD} stroke="#374151" strokeWidth="0.5" />
          <line x1={PAD} y1={toY(v)} x2={CURVE_W - PAD} y2={toY(v)} stroke="#374151" strokeWidth="0.5" />
        </g>
      ))}
      <line x1={diagX1} y1={diagY1} x2={diagX2} y2={diagY2} stroke="#4b5563" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={dotPath} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {withData.map((b) => (
        <g key={b.label}>
          <circle cx={toX(b.predicted)} cy={toY(b.actual)} r={Math.max(3, Math.min(6, 3 + b.count / 10))} fill="#60a5fa" opacity="0.8" />
          <circle cx={toX(b.predicted)} cy={toY(b.actual)} r={Math.max(3, Math.min(6, 3 + b.count / 10)) + 3} fill="transparent" />
        </g>
      ))}
      <text x={CURVE_W / 2} y={CURVE_H - 2} textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace">Predicted outcome %</text>
      <text x={8} y={CURVE_H / 2} textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace" transform={`rotate(-90, 8, ${CURVE_H / 2})`}>Actual %</text>
    </svg>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CalibrationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex items-center gap-6">
        <Skeleton className="h-20 w-20 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, isBest, isWorst }: { cat: CategoryCalibration; isBest: boolean; isWorst: boolean }) {
  const grade = GRADE_STYLE[cat.accuracy >= 75 ? 'S' : cat.accuracy >= 65 ? 'A' : cat.accuracy >= 55 ? 'B' : cat.accuracy >= 45 ? 'C' : cat.accuracy >= 35 ? 'D' : 'F']
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn('text-xs font-mono font-semibold w-28 flex-shrink-0', catColor(cat.category))}>
        {cat.category}
        {isBest && <span className="ml-1 text-[9px] text-emerald bg-emerald/10 px-1 py-0.5 rounded">best</span>}
        {isWorst && <span className="ml-1 text-[9px] text-against-400 bg-against-500/10 px-1 py-0.5 rounded">weakest</span>}
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cat.accuracy}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', grade.bar)}
        />
      </div>
      <span className={cn('text-xs font-mono font-bold tabular-nums w-10 text-right flex-shrink-0', grade.text)}>{cat.accuracy}%</span>
      <span className="text-[10px] font-mono text-surface-500 w-16 text-right flex-shrink-0">{cat.correct}/{cat.total}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalibrationAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<CalibrationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/calibration', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = (await res.json()) as CalibrationData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calibration data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const isEmpty = data && data.totalResolved === 0

  const grade = data?.grade ?? 'F'
  const gs = GRADE_STYLE[grade] ?? GRADE_STYLE['F']
  const biasInfo = data ? BIAS_LABEL(data.majorityBias) : null
  const BiasIcon = biasInfo?.icon ?? Scale

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-mono font-bold text-white leading-tight flex items-center gap-2">
              <Gauge className="h-5 w-5 text-purple flex-shrink-0" />
              Calibration Report
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              How well do your votes predict civic outcomes?
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', refreshing && 'animate-spin')} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-against-950/40 border border-against-700/30 px-4 py-3 mb-4 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CalibrationSkeleton />
            </motion.div>
          ) : isEmpty ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<FlaskConical className="h-8 w-8 text-purple" />}
                title="No resolved votes yet"
                description="Your calibration score appears once topics you voted on reach a final outcome (law or failed). Keep voting!"
                actions={[{ label: 'Browse topics', href: '/' }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className={cn('rounded-2xl border p-5 flex items-center gap-5', gs.bg, gs.border)}
              >
                <div className={cn('h-20 w-20 rounded-xl border-2 flex items-center justify-center flex-shrink-0', gs.border, gs.ring, 'ring-4')}>
                  <span className={cn('text-4xl font-mono font-black', gs.text)}>{grade}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className={cn('h-3.5 w-3.5', gs.text)} />
                    <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', gs.text)}>Calibration Grade</span>
                  </div>
                  <p className="text-sm font-mono text-white leading-relaxed">{GRADE_LABEL[grade]}</p>
                  <p className="text-xs font-mono text-surface-500 mt-1">Based on {data.totalResolved} resolved vote{data.totalResolved !== 1 ? 's' : ''}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                {[
                  { label: 'Accuracy', value: data.accuracy, unit: '%', sub: `${data.correct} correct`, color: data.accuracy >= 60 ? 'text-emerald' : data.accuracy >= 45 ? 'text-gold' : 'text-against-400' },
                  { label: 'Resolved', value: data.totalResolved, unit: '', sub: 'votes judged', color: 'text-for-400' },
                  { label: 'Brier Score', value: data.brierScore.toFixed(3), unit: '', sub: '0 = perfect', color: data.brierScore < 0.2 ? 'text-emerald' : data.brierScore < 0.25 ? 'text-gold' : 'text-against-400' },
                  { label: 'Best Category', value: data.bestCategory ?? '—', unit: '', sub: data.bestCategory ? `${data.byCategory.find(c => c.category === data.bestCategory)?.accuracy ?? 0}% accuracy` : 'vote more', color: catColor(data.bestCategory ?? '') },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">{stat.label}</div>
                    <div className={cn('text-xl font-mono font-bold tabular-nums', stat.color)}>
                      {typeof stat.value === 'number' ? <AnimatedNumber value={stat.value} /> : stat.value}
                      {stat.unit && <span className="text-sm">{stat.unit}</span>}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 mt-1">{stat.sub}</div>
                  </div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                    <Zap className="h-3 w-3 text-purple" />Contrarian Votes
                  </div>
                  <div className="text-2xl font-mono font-bold text-purple tabular-nums mb-1">{data.contrarian.accuracy}%</div>
                  <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${data.contrarian.accuracy}%` }} transition={{ duration: 0.6, delay: 0.3 }} className="h-full rounded-full bg-purple" />
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">{data.contrarian.correct}/{data.contrarian.total} when going against the crowd</div>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                    <Target className="h-3 w-3 text-for-400" />Consensus Votes
                  </div>
                  <div className="text-2xl font-mono font-bold text-for-400 tabular-nums mb-1">{data.consensus.accuracy}%</div>
                  <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${data.consensus.accuracy}%` }} transition={{ duration: 0.6, delay: 0.3 }} className="h-full rounded-full bg-for-500" />
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">{data.consensus.correct}/{data.consensus.total} when voting with the majority</div>
                </div>
              </motion.div>

              {biasInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3"
                >
                  <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', data.majorityBias > 10 ? 'bg-against-500/10' : data.majorityBias < -10 ? 'bg-for-500/10' : 'bg-emerald/10')}>
                    <BiasIcon className={cn('h-4 w-4', biasInfo.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">Voting Tendency</div>
                    <div className={cn('text-sm font-mono font-semibold', biasInfo.color)}>{biasInfo.text}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-mono font-bold text-white tabular-nums">{data.majorityBias > 0 ? '+' : ''}{data.majorityBias}</div>
                    <div className="text-[9px] font-mono text-surface-500">bias score</div>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400" />Calibration Curve
                </div>
                <CalibrationCurve curve={data.curve} />
                <p className="text-[10px] font-mono text-surface-500 mt-2 text-center">Dots on the dashed diagonal = perfectly calibrated</p>
              </motion.div>

              {data.byCategory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5 text-gold" />Accuracy by Category
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald" /> = correct</span>
                      <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-against-400" /> = incorrect</span>
                    </div>
                  </div>
                  <div className="divide-y divide-surface-300/50">
                    {data.byCategory.map((cat) => (
                      <CategoryRow
                        key={cat.category}
                        cat={cat}
                        isBest={cat.category === data.bestCategory}
                        isWorst={cat.category === data.worstCategory && data.byCategory.length > 1}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="flex flex-wrap items-center gap-2 pt-2"
              >
                <Link href="/calibration" className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg', 'bg-purple/10 border border-purple/30 text-purple', 'text-xs font-mono font-medium hover:bg-purple/20 transition-colors')}>
                  <FlaskConical className="h-3.5 w-3.5" />Play the Prediction Game
                </Link>
                <Link href="/analytics/evolution" className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg', 'bg-for-500/10 border border-for-500/30 text-for-400', 'text-xs font-mono font-medium hover:bg-for-500/20 transition-colors')}>
                  <TrendingUp className="h-3.5 w-3.5" />Opinion Evolution
                </Link>
                <Link href="/analytics" className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg', 'bg-surface-200 border border-surface-300 text-surface-500', 'text-xs font-mono hover:border-surface-400 hover:text-white transition-colors')}>
                  <ArrowLeft className="h-3.5 w-3.5" />Analytics Hub
                </Link>
                <Link href="/leaderboard/calibration" className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg', 'bg-surface-200 border border-surface-300 text-surface-500', 'text-xs font-mono hover:border-surface-400 hover:text-white transition-colors')}>
                  <ExternalLink className="h-3.5 w-3.5" />Calibration Leaderboard<ChevronRight className="h-3 w-3" />
                </Link>
              </motion.div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
