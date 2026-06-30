'use client'

/**
 * /topic/[id]/forecast — Civic Law Forecast
 *
 * A statistical model that estimates the probability of this topic becoming
 * law, based on:
 *   • Current vote percentage vs the 67% consensus threshold
 *   • Category historical law-passage rate (base rate)
 *   • Engagement depth (total votes)
 *   • Current status in the pipeline
 *   • Age of the debate
 *
 * Distinct from:
 *   /topic/[id]/predictions — individual user-submitted prediction bets
 *   /topic/[id]/resolution  — resolution criteria and thresholds
 *   /topic/[id]/momentum    — vote velocity over time
 *
 * This is the *model* view — statistical inference, not crowd prediction.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Gavel,
  Info,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ForecastResponse,
  ForecastSignal,
  SimilarResolved,
} from '@/app/api/topics/[id]/forecast/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

function probabilityColor(p: number): { text: string; bar: string; glow: string } {
  if (p >= 70) return { text: 'text-emerald', bar: 'bg-emerald', glow: 'shadow-emerald/20' }
  if (p >= 50) return { text: 'text-for-400', bar: 'bg-for-500', glow: 'shadow-for-500/20' }
  if (p >= 35) return { text: 'text-gold', bar: 'bg-gold', glow: 'shadow-gold/20' }
  return { text: 'text-against-400', bar: 'bg-against-500', glow: 'shadow-against-500/20' }
}

function probabilityLabel(p: number, status: string): string {
  if (status === 'law') return 'Established law'
  if (status === 'failed') return 'Failed'
  if (p >= 80) return 'Very likely'
  if (p >= 65) return 'Likely'
  if (p >= 45) return 'Uncertain'
  if (p >= 25) return 'Unlikely'
  return 'Very unlikely'
}

function confidenceLabel(c: 'low' | 'medium' | 'high'): string {
  if (c === 'high') return 'High confidence'
  if (c === 'medium') return 'Medium confidence'
  return 'Low confidence'
}

function confidenceClass(c: 'low' | 'medium' | 'high'): string {
  if (c === 'high') return 'text-emerald border-emerald/30 bg-emerald/10'
  if (c === 'medium') return 'text-gold border-gold/30 bg-gold/10'
  return 'text-surface-400 border-surface-500/30 bg-surface-300/10'
}


// ─── Probability gauge ────────────────────────────────────────────────────────

function ProbabilityGauge({ probability, status }: { probability: number; status: string }) {
  const col = probabilityColor(probability)
  const label = probabilityLabel(probability, status)
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference * (1 - probability / 100)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-surface-300/40"
          />
          <motion.circle
            cx="60" cy="60" r="54"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={col.bar.replace('bg-', 'text-')}
            stroke="currentColor"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('font-mono text-3xl font-bold', col.text)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            {probability}%
          </motion.span>
          <span className="font-mono text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">
            law probability
          </span>
        </div>
      </div>

      <div className="text-center">
        <p className={cn('font-mono text-base font-bold', col.text)}>{label}</p>
      </div>
    </div>
  )
}

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: ForecastSignal }) {
  const [expanded, setExpanded] = useState(false)

  const icon =
    signal.direction === 'positive' ? (
      <TrendingUp className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
    ) : signal.direction === 'negative' ? (
      <TrendingDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
    ) : (
      <Scale className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
    )

  const barCol =
    signal.direction === 'positive'
      ? 'bg-emerald'
      : signal.direction === 'negative'
      ? 'bg-against-500'
      : 'bg-surface-400'

  const labelCol =
    signal.direction === 'positive'
      ? 'text-emerald'
      : signal.direction === 'negative'
      ? 'text-against-400'
      : 'text-surface-400'

  const contribution = Math.abs(signal.score)
  const barWidth = Math.min(100, (contribution / 20) * 100)

  return (
    <button
      type="button"
      className="w-full text-left rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors"
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className={cn('font-mono text-xs font-semibold', labelCol)}>
            {signal.label}
          </p>

          {/* mini contribution bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-surface-300/50 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', barCol)}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className={cn('font-mono text-[10px] flex-shrink-0', labelCol)}>
              {signal.score > 0 ? '+' : ''}{signal.score}pp
            </span>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="font-mono text-[11px] text-surface-400 leading-relaxed overflow-hidden"
              >
                {signal.description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <Info className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5" />
      </div>
    </button>
  )
}

// ─── Similar resolved topic card ──────────────────────────────────────────────

function SimilarCard({ topic }: { topic: SimilarResolved }) {
  const isLaw = topic.final_status === 'law'
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors',
        isLaw
          ? 'border-gold/30 bg-gold/5 hover:border-gold/50'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/30'
      )}
    >
      <div className="flex items-start gap-2">
        {isLaw ? (
          <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
        ) : (
          <Scale className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('font-mono text-[10px] font-bold', isLaw ? 'text-gold' : 'text-against-400')}>
              {isLaw ? 'LAW' : 'FAILED'}
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="font-mono text-[10px] text-surface-500">
              {Math.round(topic.blue_pct)}% FOR
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="font-mono text-[10px] text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
        <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 mt-0.5" />
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ForecastSkeleton() {
  return (
    <div className="space-y-4">
      {/* Gauge */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-4">
        <Skeleton className="h-40 w-40 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      {/* Signals */}
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ForecastClient({ topicId }: { topicId: string }) {

  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/forecast`)
      if (!res.ok) throw new Error('Failed to load forecast')
      setData(await res.json())
    } catch {
      setError('Could not load the forecast. Try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const topic = data?.topic

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        {/* Back button */}
        <div className="mb-5">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>
        </div>

        {/* Topic meta */}
        {topic && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                <BarChart2 className="h-4 w-4 text-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                    {topic.status.toUpperCase()}
                  </Badge>
                  {topic.category && (
                    <Badge variant="proposed">{topic.category}</Badge>
                  )}
                </div>
                <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-3">
                  {topic.statement}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-for-400">
                    <ThumbsUp className="h-3 w-3" />
                    {Math.round(topic.blue_pct)}% FOR
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-against-400">
                    <ThumbsDown className="h-3 w-3" />
                    {Math.round(100 - topic.blue_pct)}% AGAINST
                  </span>
                  <span className="font-mono text-[10px] text-surface-500">
                    {topic.total_votes.toLocaleString()} votes
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <ForecastSkeleton />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Forecast unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        ) : data ? (
          <div className="space-y-4">

            {/* Gauge card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex flex-col items-center gap-4">
                <ProbabilityGauge
                  probability={data.law_probability}
                  status={data.topic.status}
                />

                {/* Confidence pill */}
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold',
                  confidenceClass(data.confidence)
                )}>
                  <Info className="h-3 w-3" />
                  {confidenceLabel(data.confidence)}
                </span>

                {/* Threshold progress bar */}
                <div className="w-full max-w-xs space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-surface-500">
                    <span>0%</span>
                    <span className="text-gold">67% law threshold</span>
                    <span>100%</span>
                  </div>
                  <div className="relative h-2.5 bg-surface-300/50 rounded-full overflow-hidden">
                    {/* Vote bar */}
                    <motion.div
                      className={cn(
                        'absolute top-0 left-0 h-full rounded-full',
                        data.topic.blue_pct >= 67 ? 'bg-emerald' : 'bg-for-500'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${data.topic.blue_pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                    {/* Threshold marker */}
                    <div className="absolute top-0 h-full w-px bg-gold/60" style={{ left: '67%' }} />
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-for-400">{Math.round(data.topic.blue_pct)}% FOR</span>
                    <span className="text-against-400">{Math.round(100 - data.topic.blue_pct)}% AGAINST</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Signals */}
            <section>
              <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 px-1">
                Forecast signals
              </h2>
              <div className="space-y-2">
                {data.signals.map((signal, i) => (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                  >
                    <SignalRow signal={signal} />
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Category context */}
            {data.category_base_rate !== null && (data.category_law_count + data.category_fail_count) >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">
                  {data.topic.category ?? 'Category'} history
                </h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                    <p className="font-mono text-xl font-bold text-gold">{data.category_base_rate}%</p>
                    <p className="font-mono text-[10px] text-surface-500 mt-0.5">pass rate</p>
                  </div>
                  <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                    <p className="font-mono text-xl font-bold text-emerald">{data.category_law_count}</p>
                    <p className="font-mono text-[10px] text-surface-500 mt-0.5">became law</p>
                  </div>
                  <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                    <p className="font-mono text-xl font-bold text-against-400">{data.category_fail_count}</p>
                    <p className="font-mono text-[10px] text-surface-500 mt-0.5">failed</p>
                  </div>
                </div>

                {/* Pass rate bar */}
                <div className="h-2 bg-surface-300/40 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gold rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.category_base_rate}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                  />
                </div>
                <p className="font-mono text-[10px] text-surface-500 mt-2">
                  {data.category_base_rate}% of resolved {data.topic.category ?? 'category'} debates became law
                </p>
              </motion.div>
            )}

            {/* Similar resolved topics */}
            {data.similar_resolved.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">
                  Similar debates — resolved
                </h2>
                <p className="font-mono text-[11px] text-surface-400 mb-3">
                  Topics in the same category with a similar FOR percentage. How did they end?
                </p>
                <div className="space-y-2">
                  {data.similar_resolved.map((t) => (
                    <SimilarCard key={t.id} topic={t} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Disclaimer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="rounded-xl border border-surface-300/50 bg-surface-200/30 p-4"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-[10px] text-surface-500 leading-relaxed">
                  This forecast is a statistical estimate based on current vote data, category
                  history, and engagement signals. It is not a guarantee of outcome. The Lobby
                  is a live democratic platform — community activity, debates, and events can
                  shift outcomes at any time.
                </p>
              </div>
            </motion.div>

            {/* Navigation links */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href={`/topic/${topicId}/predictions`}
                className={cn(
                  'flex items-center justify-between gap-2 p-3 rounded-xl',
                  'border border-surface-300 bg-surface-100 hover:border-surface-400',
                  'transition-colors'
                )}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-purple" />
                  <span className="font-mono text-xs text-white">Predictions</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
              </Link>
              <Link
                href={`/topic/${topicId}/momentum`}
                className={cn(
                  'flex items-center justify-between gap-2 p-3 rounded-xl',
                  'border border-surface-300 bg-surface-100 hover:border-surface-400',
                  'transition-colors'
                )}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                  <span className="font-mono text-xs text-white">Momentum</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
              </Link>
            </div>
          </div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
