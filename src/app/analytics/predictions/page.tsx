'use client'

/**
 * /analytics/predictions — Prediction Market Analytics
 *
 * Personal breakdown of all prediction-market forecasts the user has
 * staked on topic outcomes:
 *   - Overall accuracy, Brier score, total clout earned
 *   - Letter grade reflecting calibration quality
 *   - Predicted-LAW vs Predicted-FAIL accuracy split
 *   - Category breakdown bars (best and worst prediction categories)
 *   - Brier score distribution chart (confidence vs outcome)
 *   - Full prediction history with filter tabs (All / Correct / Wrong / Pending)
 *
 * Distinct from:
 *   /predictions        — live prediction market leaderboard
 *   /forecasters        — platform-wide oracle leaderboard
 *   /prescient          — vote alignment (not prediction market)
 *   /analytics          — overall civic stats hub
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coins,
  ExternalLink,
  FlaskConical,
  Gavel,
  RefreshCw,
  Sparkles,
  Target,
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

// ─── Grade config ─────────────────────────────────────────────────────────────

type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

const GRADE_STYLE: Record<Grade, { text: string; bg: string; border: string; ring: string }> = {
  S: { text: 'text-gold',          bg: 'bg-gold/10',        border: 'border-gold/30',        ring: 'ring-gold/20' },
  A: { text: 'text-emerald',       bg: 'bg-emerald/10',     border: 'border-emerald/30',     ring: 'ring-emerald/20' },
  B: { text: 'text-for-400',       bg: 'bg-for-500/10',     border: 'border-for-500/30',     ring: 'ring-for-500/20' },
  C: { text: 'text-purple',        bg: 'bg-purple/10',      border: 'border-purple/30',      ring: 'ring-purple/20' },
  D: { text: 'text-against-400',   bg: 'bg-against-500/10', border: 'border-against-500/30', ring: 'ring-against-500/20' },
  F: { text: 'text-surface-500',   bg: 'bg-surface-300/20', border: 'border-surface-300/30', ring: 'ring-surface-300/10' },
}

function computeGrade(accuracy: number, total: number): Grade {
  if (total < 3) return 'F'
  if (accuracy >= 75) return 'S'
  if (accuracy >= 65) return 'A'
  if (accuracy >= 55) return 'B'
  if (accuracy >= 45) return 'C'
  if (accuracy >= 35) return 'D'
  return 'F'
}

// ─── Category color map ────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-purple',
  Culture:     'bg-gold',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}
function catBar(cat: string | null): string {
  return CATEGORY_COLOR[cat ?? ''] ?? 'bg-surface-400'
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const w = Math.floor(d / 7)
  if (w > 0) return `${w}w ago`
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

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
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5">
      <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      <span className={cn('text-3xl font-black tabular-nums leading-none', accent ?? 'text-white')}>
        {value}
      </span>
      {sub && <span className="text-xs text-surface-500 leading-snug">{sub}</span>}
    </div>
  )
}

// ─── Individual prediction row ────────────────────────────────────────────────

function PredictionRow({ pred }: { pred: PredictionRecord }) {
  const topic = pred.topic
  const isResolved = pred.resolved_at !== null
  const isCorrect = pred.correct === true
  const isPending = pred.correct === null

  const predictedLaw = pred.predicted_law
  const actualStatus = topic?.status ?? 'unknown'

  return (
    <Link
      href={`/topic/${pred.topic_id}`}
      className="flex items-start gap-3 px-4 py-4 hover:bg-surface-200/50 transition-colors group"
    >
      {/* Outcome icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isPending ? (
          <Circle className="h-4 w-4 text-surface-500" />
        ) : isCorrect ? (
          <CheckCircle2 className="h-4 w-4 text-emerald" />
        ) : (
          <XCircle className="h-4 w-4 text-against-400" />
        )}
      </div>

      {/* Topic and prediction details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-snug mb-1.5">
          {topic?.statement ?? 'Unknown topic'}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          {/* Predicted outcome */}
          <span
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded',
              predictedLaw
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400',
            )}
          >
            {predictedLaw ? (
              <Gavel className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {predictedLaw ? 'Predicted LAW' : 'Predicted FAIL'}
          </span>

          {/* Confidence */}
          <span className="text-surface-500">
            {pred.confidence}% confidence
          </span>

          {/* Actual outcome */}
          {isResolved && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded',
                actualStatus === 'law'
                  ? 'bg-gold/15 text-gold'
                  : 'bg-surface-300/30 text-surface-500',
              )}
            >
              {actualStatus === 'law' ? 'BECAME LAW' : 'FAILED'}
            </span>
          )}

          {/* Brier score */}
          {pred.brier_score !== null && (
            <span className="text-surface-600">
              Brier {pred.brier_score.toFixed(3)}
            </span>
          )}

          {/* Clout */}
          {pred.clout_earned > 0 && (
            <span className="text-gold flex items-center gap-0.5">
              <Coins className="h-3 w-3" />
              +{pred.clout_earned}
            </span>
          )}

          {/* Pending label */}
          {isPending && (
            <span className="text-surface-600 italic">pending</span>
          )}

          {/* Time */}
          <span className="text-surface-600 ml-auto">
            {relTime(pred.created_at)}
          </span>
        </div>
      </div>

      <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Brier chart (confidence buckets) ────────────────────────────────────────

interface BrierBucket {
  label: string
  confidence: number
  accuracy: number
  count: number
}

function BrierChart({ buckets }: { buckets: BrierBucket[] }) {
  const nonEmpty = buckets.filter((b) => b.count > 0)
  if (nonEmpty.length < 2) return null

  return (
    <div className="space-y-2">
      {nonEmpty.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-surface-500 w-16 flex-shrink-0 text-right">
            {b.label}
          </span>
          <div className="flex-1 relative h-5 flex items-center">
            {/* Confidence bar */}
            <div
              className="absolute left-0 h-3 rounded bg-for-500/30"
              style={{ width: `${b.confidence}%` }}
            />
            {/* Actual accuracy bar */}
            <div
              className={cn(
                'absolute left-0 h-1.5 rounded',
                b.accuracy >= b.confidence ? 'bg-emerald' : 'bg-against-400',
              )}
              style={{ width: `${b.accuracy}%`, top: '60%' }}
            />
          </div>
          <div className="text-[11px] font-mono w-20 flex-shrink-0 flex justify-between">
            <span className="text-for-400">{b.confidence}%</span>
            <span
              className={cn(
                b.accuracy >= b.confidence ? 'text-emerald' : 'text-against-400',
              )}
            >
              {b.accuracy}%
            </span>
          </div>
          <span className="text-[11px] font-mono text-surface-600 w-6 flex-shrink-0 text-right">
            {b.count}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-3 mt-1">
        <div className="w-16" />
        <div className="flex-1" />
        <div className="text-[10px] font-mono text-surface-600 w-20 flex justify-between">
          <span>Predicted</span>
          <span>Actual</span>
        </div>
        <div className="w-6" />
      </div>
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'correct' | 'wrong' | 'pending'

const FILTER_TABS: { id: FilterTab; label: string; icon: typeof Circle }[] = [
  { id: 'all',     label: 'All',     icon: BarChart2 },
  { id: 'correct', label: 'Correct', icon: CheckCircle2 },
  { id: 'wrong',   label: 'Wrong',   icon: XCircle },
  { id: 'pending', label: 'Pending', icon: Circle },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PredictionAnalyticsPage() {
  const router = useRouter()
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/predictions', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPredictions((data.predictions as PredictionRecord[]) ?? [])
    } catch {
      setError('Could not load prediction data. Try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const resolved  = predictions.filter((p) => p.resolved_at !== null)
  const pending   = predictions.filter((p) => p.resolved_at === null)
  const correct   = resolved.filter((p) => p.correct === true)
  const wrong     = resolved.filter((p) => p.correct === false)
  const accuracy  = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0
  const grade     = computeGrade(accuracy, resolved.length)
  const gradeStyle = GRADE_STYLE[grade]

  const totalClout = predictions.reduce((s, p) => s + (p.clout_earned ?? 0), 0)

  const brierScores = resolved.filter((p) => p.brier_score !== null).map((p) => p.brier_score as number)
  const avgBrier = brierScores.length > 0
    ? Math.round((brierScores.reduce((a, b) => a + b, 0) / brierScores.length) * 1000) / 1000
    : null

  const predictedLaw  = resolved.filter((p) => p.predicted_law)
  const predictedFail = resolved.filter((p) => !p.predicted_law)
  const lawCorrect  = predictedLaw.filter((p) => p.correct === true)
  const failCorrect = predictedFail.filter((p) => p.correct === true)

  // By category
  const catMap = new Map<string, { total: number; correct: number }>()
  for (const p of resolved) {
    const cat = p.topic?.category ?? 'Uncategorized'
    const entry = catMap.get(cat) ?? { total: 0, correct: 0 }
    entry.total++
    if (p.correct) entry.correct++
    catMap.set(cat, entry)
  }
  const byCategory = [...catMap.entries()]
    .filter(([, d]) => d.total >= 1)
    .map(([cat, d]) => ({ cat, total: d.total, correct: d.correct, accuracy: Math.round((d.correct / d.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // Brier buckets (10-wide confidence intervals)
  const brierBuckets: BrierBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${i * 10 + 9}%`,
    confidence: i * 10 + 5,
    accuracy: 0,
    count: 0,
  }))
  const wins = Array.from({ length: 10 }, () => 0)
  for (const p of resolved) {
    const bin = Math.min(9, Math.floor(p.confidence / 10))
    brierBuckets[bin].count++
    if (p.correct) wins[bin]++
  }
  for (let i = 0; i < 10; i++) {
    if (brierBuckets[i].count > 0) {
      brierBuckets[i].accuracy = Math.round((wins[i] / brierBuckets[i].count) * 100)
    }
  }

  // Filtered list
  const filteredPredictions = predictions.filter((p) => {
    if (filter === 'correct') return p.correct === true
    if (filter === 'wrong')   return p.correct === false
    if (filter === 'pending') return p.resolved_at === null
    return true
  })
  const SHOW_PAGE = 20
  const visible = showAll ? filteredPredictions : filteredPredictions.slice(0, SHOW_PAGE)
  const hasMore = filteredPredictions.length > SHOW_PAGE && !showAll

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Target className="h-6 w-6 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Prediction Analytics</h1>
              <p className="text-xs text-surface-500">Your forecast accuracy and calibration</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <XCircle className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm text-against-300 mb-3">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg bg-against-500/20 text-against-300 hover:bg-against-500/30 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && predictions.length === 0 && (
          <EmptyState
            icon={Target}
            title="No predictions yet"
            description="Open any active topic and stake a prediction to start tracking your forecast accuracy."
            action={{ label: 'Browse topics', href: '/' }}
          />
        )}

        {/* Content */}
        {!loading && !error && predictions.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* ── Stats row ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Grade */}
                <div
                  className={cn(
                    'rounded-2xl border p-5 flex flex-col gap-2 ring-2',
                    gradeStyle.bg,
                    gradeStyle.border,
                    gradeStyle.ring,
                  )}
                >
                  <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">Grade</span>
                  <span className={cn('text-4xl font-black leading-none', gradeStyle.text)}>{grade}</span>
                  <span className="text-xs text-surface-500">
                    {resolved.length < 3 ? 'Need more data' : `${accuracy}% accuracy`}
                  </span>
                </div>

                <StatCard
                  label="Predictions"
                  value={<AnimatedNumber value={predictions.length} />}
                  sub={`${resolved.length} resolved · ${pending.length} pending`}
                />
                <StatCard
                  label="Accuracy"
                  value={resolved.length > 0 ? `${accuracy}%` : '—'}
                  sub={`${correct.length} correct / ${resolved.length} resolved`}
                  accent={accuracy >= 60 ? 'text-emerald' : accuracy >= 45 ? 'text-for-400' : 'text-against-400'}
                />
                <StatCard
                  label="Clout Earned"
                  value={<AnimatedNumber value={totalClout} />}
                  sub="from correct predictions"
                  accent="text-gold"
                />
              </div>

              {/* ── Calibration strip ──────────────────────────────────────── */}
              {resolved.length >= 3 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Brier score */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FlaskConical className="h-3.5 w-3.5" />
                      Brier Score
                    </span>
                    <span className={cn(
                      'text-2xl font-black tabular-nums',
                      avgBrier !== null && avgBrier <= 0.15 ? 'text-emerald'
                        : avgBrier !== null && avgBrier <= 0.22 ? 'text-for-400'
                        : 'text-against-400',
                    )}>
                      {avgBrier !== null ? avgBrier.toFixed(3) : '—'}
                    </span>
                    <span className="text-xs text-surface-500">
                      {avgBrier === null ? 'No scored predictions' :
                        avgBrier <= 0.15 ? 'Excellent calibration' :
                        avgBrier <= 0.22 ? 'Good calibration' :
                        'Room for improvement'}
                    </span>
                  </div>

                  {/* Predicted LAW accuracy */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Gavel className="h-3.5 w-3.5 text-for-400" />
                      Predicted Law
                    </span>
                    <span className="text-2xl font-black tabular-nums text-for-400">
                      {predictedLaw.length > 0
                        ? `${Math.round((lawCorrect.length / predictedLaw.length) * 100)}%`
                        : '—'}
                    </span>
                    <span className="text-xs text-surface-500">
                      {lawCorrect.length}/{predictedLaw.length} correct
                    </span>
                  </div>

                  {/* Predicted FAIL accuracy */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-against-400" />
                      Predicted Fail
                    </span>
                    <span className="text-2xl font-black tabular-nums text-against-400">
                      {predictedFail.length > 0
                        ? `${Math.round((failCorrect.length / predictedFail.length) * 100)}%`
                        : '—'}
                    </span>
                    <span className="text-xs text-surface-500">
                      {failCorrect.length}/{predictedFail.length} correct
                    </span>
                  </div>
                </div>
              )}

              {/* ── Category breakdown ─────────────────────────────────────── */}
              {byCategory.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" />
                    By Category
                  </h2>
                  <div className="space-y-3">
                    {byCategory.map(({ cat, total, correct: c, accuracy: acc }) => (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-surface-600 font-medium">{cat}</span>
                          <span className={cn(
                            'font-mono font-bold',
                            acc >= 60 ? 'text-emerald' : acc >= 45 ? 'text-for-400' : 'text-against-400',
                          )}>
                            {acc}%
                            <span className="text-surface-600 font-normal ml-1">({c}/{total})</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-300/40 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', catBar(cat))}
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Confidence calibration chart ──────────────────────────── */}
              {resolved.length >= 5 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Confidence vs Reality
                  </h2>
                  <p className="text-xs text-surface-600 mb-4">
                    Blue bar = your confidence level. Line = actual accuracy achieved.
                  </p>
                  <BrierChart buckets={brierBuckets} />
                </div>
              )}

              {/* ── Prediction list ────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                {/* Filter tabs */}
                <div className="flex items-center gap-0 border-b border-surface-300 overflow-x-auto">
                  {FILTER_TABS.map(({ id, label, icon: Icon }) => {
                    const count =
                      id === 'all'     ? predictions.length :
                      id === 'correct' ? correct.length :
                      id === 'wrong'   ? wrong.length :
                      pending.length

                    return (
                      <button
                        key={id}
                        onClick={() => { setFilter(id); setShowAll(false) }}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-3 text-xs font-mono whitespace-nowrap transition-colors border-b-2 -mb-px',
                          filter === id
                            ? 'text-white border-for-400'
                            : 'text-surface-500 border-transparent hover:text-surface-700',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                        <span className={cn(
                          'rounded px-1 py-0.5 text-[10px]',
                          filter === id ? 'bg-for-500/20 text-for-400' : 'bg-surface-300/40 text-surface-600',
                        )}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* List */}
                {filteredPredictions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-surface-500">
                    No predictions in this category.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-surface-300/60">
                      {visible.map((pred) => (
                        <PredictionRow key={pred.id} pred={pred} />
                      ))}
                    </div>

                    {hasMore && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors border-t border-surface-300/60"
                      >
                        Show all {filteredPredictions.length} predictions
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── CTA links ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/predictions"
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-surface-100 border border-surface-300 hover:border-purple/40 hover:bg-surface-200 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-purple flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-purple transition-colors">
                        Prediction Market
                      </p>
                      <p className="text-xs text-surface-500">Browse active topics to forecast</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-purple transition-colors" />
                </Link>
                <Link
                  href="/forecasters"
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-surface-100 border border-surface-300 hover:border-gold/40 hover:bg-surface-200 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="h-5 w-5 text-gold flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-gold transition-colors">
                        Oracle Leaderboard
                      </p>
                      <p className="text-xs text-surface-500">See top forecasters platform-wide</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-gold transition-colors" />
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
