'use client'

/**
 * /forecast — The Civic Forecast Engine
 *
 * Statistical pass-probability model for every topic currently in voting.
 * Probability is derived from historical base rates: how often did topics
 * with similar vote splits actually become law?
 *
 * This is distinct from /oracle (AI prophecy) and /predictions (user bets).
 * It is a pure data-driven calibration tool — no AI, just base rates.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Clock,
  FlaskConical,
  Info,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CalibrationBucket,
  ForecastResponse,
  ForecastTopic,
} from '@/app/api/stats/forecast/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

const MOMENTUM_CONFIG: Record<ForecastTopic['momentum'], {
  label: string
  color: string
  icon: typeof TrendingUp
}> = {
  strong_for:     { label: 'Strong FOR',     color: 'text-for-400',      icon: TrendingUp },
  likely_for:     { label: 'Likely FOR',     color: 'text-for-300',      icon: TrendingUp },
  toss_up:        { label: 'Toss-up',        color: 'text-gold',         icon: Scale },
  likely_against: { label: 'Likely AGAINST', color: 'text-against-300',  icon: TrendingDown },
  strong_against: { label: 'Strong AGAINST', color: 'text-against-400',  icon: TrendingDown },
}

const CONFIDENCE_CONFIG: Record<ForecastTopic['confidence'], {
  label: string
  color: string
  title: string
}> = {
  high:   { label: 'High confidence',   color: 'text-emerald',       title: '20+ similar historical topics' },
  medium: { label: 'Medium confidence', color: 'text-gold',          title: '5–19 similar historical topics' },
  low:    { label: 'Low confidence',    color: 'text-surface-500',   title: 'Fewer than 5 similar historical topics — treat with caution' },
}

type SortKey = 'probability_desc' | 'probability_asc' | 'ending_soonest' | 'most_votes'

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'probability_desc', label: 'Most likely to pass' },
  { id: 'probability_asc',  label: 'Least likely to pass' },
  { id: 'ending_soonest',   label: 'Ending soonest' },
  { id: 'most_votes',       label: 'Most votes' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHours(h: number | null): string {
  if (h === null) return '—'
  if (h < 1)  return 'less than 1h'
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  const rem = h % 24
  return rem > 0 ? `${d}d ${rem}h` : `${d}d`
}

function formatVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function probColor(p: number): string {
  if (p >= 75) return 'text-for-400'
  if (p >= 55) return 'text-for-300'
  if (p >= 45) return 'text-gold'
  if (p >= 25) return 'text-against-300'
  return 'text-against-400'
}

function probBarColor(p: number): string {
  if (p >= 75) return 'bg-for-500'
  if (p >= 55) return 'bg-for-400'
  if (p >= 45) return 'bg-gold'
  if (p >= 25) return 'bg-against-400'
  return 'bg-against-500'
}

function sortTopics(topics: ForecastTopic[], key: SortKey): ForecastTopic[] {
  const arr = [...topics]
  switch (key) {
    case 'probability_desc': return arr.sort((a, b) => b.pass_probability - a.pass_probability)
    case 'probability_asc':  return arr.sort((a, b) => a.pass_probability - b.pass_probability)
    case 'ending_soonest':
      return arr.sort((a, b) => {
        const ah = a.hours_remaining ?? Infinity
        const bh = b.hours_remaining ?? Infinity
        return ah - bh
      })
    case 'most_votes': return arr.sort((a, b) => b.total_votes - a.total_votes)
  }
}

// ─── Topic Forecast Card ──────────────────────────────────────────────────────

function TopicForecastCard({ topic }: { topic: ForecastTopic }) {
  const mom = MOMENTUM_CONFIG[topic.momentum]
  const MomIcon = mom.icon
  const conf = CONFIDENCE_CONFIG[topic.confidence]

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden hover:border-surface-400 transition-colors group"
    >
      {/* Top: statement + category */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-2 mb-2">
          {topic.category && (
            <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-wider flex-shrink-0 mt-0.5', CATEGORY_COLORS[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
        </div>
        <Link
          href={`/topic/${topic.id}`}
          className="text-sm font-mono text-white leading-snug hover:text-for-300 transition-colors line-clamp-2 group-hover:text-for-300"
        >
          {topic.statement}
        </Link>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={cn('flex items-center gap-1 text-[11px] font-mono', mom.color)}>
            <MomIcon className="h-3 w-3" />
            {mom.label}
          </span>
          {topic.hours_remaining !== null && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {formatHours(topic.hours_remaining)} left
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Zap className="h-3 w-3" />
            {formatVotes(topic.total_votes)} votes
          </span>
        </div>
      </div>

      {/* Vote split bar */}
      <div className="px-4 pb-3">
        <div className="flex h-2 rounded-full overflow-hidden bg-surface-300 gap-px">
          <div
            className="bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="bg-against-500 flex-1"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
          <span className="text-[10px] font-mono text-against-400">{againstPct}% AGAINST</span>
        </div>
      </div>

      {/* Probability section */}
      <div className="border-t border-surface-300 bg-surface-200/40 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Big probability number */}
          <div className="flex-shrink-0 text-center w-14">
            <div className={cn('text-2xl font-mono font-bold tabular-nums', probColor(topic.pass_probability))}>
              {topic.pass_probability}%
            </div>
            <div className="text-[10px] font-mono text-surface-500 leading-tight">pass prob.</div>
          </div>

          {/* Probability bar */}
          <div className="flex-1 space-y-1">
            <div className="h-2 rounded-full bg-surface-400/40 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${topic.pass_probability}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn('h-full rounded-full', probBarColor(topic.pass_probability))}
              />
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className={cn('text-[10px] font-mono', conf.color)} title={conf.title}>
                {conf.label}
              </span>
              <span className="text-[10px] font-mono text-surface-500">
                based on {topic.similar_count} similar topic{topic.similar_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Link */}
          <Link
            href={`/topic/${topic.id}`}
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-300/60 hover:bg-for-600/30 text-surface-500 hover:text-for-400 transition-colors"
            aria-label="View topic"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Base-rate callout */}
        <div className="mt-2 px-2 py-1.5 rounded-lg bg-surface-300/40 text-[11px] font-mono text-surface-500">
          Historical topics in the{' '}
          <span className="text-surface-700">{topic.bucket_label}</span> FOR range pass at{' '}
          <span className={probColor(topic.base_rate)}>{topic.base_rate}%</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Calibration Chart ────────────────────────────────────────────────────────

function CalibrationChart({ buckets }: { buckets: CalibrationBucket[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-200/40 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-for-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-mono font-semibold text-white">Historical Calibration</span>
          <span className="text-xs font-mono text-surface-500 ml-2">
            how often topics in each range actually passed
          </span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-surface-500 transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-surface-300">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-2 pt-3 items-center">
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">FOR range</span>
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Pass rate</span>
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Sample</span>
                <span></span>

                {buckets.map(b => (
                  <>
                    <span key={`${b.bucket}-label`} className="text-xs font-mono text-surface-600 whitespace-nowrap">
                      {b.bucket}
                    </span>
                    <div key={`${b.bucket}-bar`} className="h-2 rounded-full bg-surface-400/30 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', probBarColor(b.pass_rate))}
                        style={{ width: `${b.pass_rate}%` }}
                      />
                    </div>
                    <span key={`${b.bucket}-count`} className="text-[11px] font-mono text-surface-500 text-right tabular-nums">
                      {b.count}
                    </span>
                    <span key={`${b.bucket}-pct`} className={cn('text-xs font-mono font-semibold tabular-nums text-right', probColor(b.pass_rate))}>
                      {b.pass_rate}%
                    </span>
                  </>
                ))}
              </div>

              <p className="text-[11px] font-mono text-surface-600 pt-1 leading-relaxed">
                Calibration is built from all resolved topics on the platform.
                A well-calibrated model should show ~50% pass rate in the 45–55% bucket
                and higher/lower rates at the extremes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Loading skeletons ─────────────────────────────────────────────────────────

function TopicCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="px-4 pt-4 pb-3 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="px-4 pb-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between mt-1">
          <Skeleton className="h-2 w-12" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
      <div className="border-t border-surface-300 px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-14 flex-shrink-0" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        </div>
        <Skeleton className="h-7 w-full rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('probability_desc')
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats/forecast')
      if (!res.ok) throw new Error('Failed to load forecast data')
      const json = await res.json() as ForecastResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sorted = data ? sortTopics(data.voting_topics, sort) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-1">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <FlaskConical className="h-5 w-5 text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Forecast
                </h1>
                <button
                  onClick={() => setShowInfo(i => !i)}
                  className="text-surface-500 hover:text-white transition-colors"
                  aria-label="How this works"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Statistical pass-probability for every topic in final vote
              </p>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Info banner */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                <div className="p-3 rounded-xl bg-purple/5 border border-purple/20 text-[12px] font-mono text-surface-600 space-y-1.5 leading-relaxed">
                  <p>
                    <span className="text-white font-semibold">How it works:</span> Each topic in voting
                    is assigned a probability based on how often topics with similar vote splits have
                    historically become law.
                  </p>
                  <p>
                    A topic showing <span className="text-for-400">68% FOR</span> sits in the
                    historical <span className="text-surface-700">65–75%</span> bucket. If 80% of past
                    topics in that bucket passed, the forecast probability is ~80%.
                  </p>
                  <p>
                    <span className="text-gold">Confidence</span> reflects how many historical topics
                    informed the estimate. Low-confidence forecasts have fewer than 5 comparable cases.
                  </p>
                  <p className="text-surface-500">
                    This is not AI-generated and makes no causal claims — it is purely frequentist.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <div className="text-xl font-mono font-bold text-white tabular-nums">
                {data.voting_topics.length}
              </div>
              <div className="text-[11px] font-mono text-surface-500">in final vote</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <div className="text-xl font-mono font-bold text-for-400 tabular-nums">
                {data.overall_pass_rate}%
              </div>
              <div className="text-[11px] font-mono text-surface-500">platform pass rate</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <div className="text-xl font-mono font-bold text-gold tabular-nums">
                {data.total_resolved.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-surface-500">resolved topics</div>
            </div>
          </div>
        )}

        {/* ── Calibration chart ──────────────────────────────────────────── */}
        {data && !loading && data.calibration.length > 0 && (
          <div className="mb-5">
            <CalibrationChart buckets={data.calibration} />
          </div>
        )}

        {/* ── Sort controls ──────────────────────────────────────────────── */}
        {data && !loading && data.voting_topics.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">Sort</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono transition-colors',
                  sort === opt.id
                    ? 'bg-for-600/30 text-for-400 border border-for-500/30'
                    : 'bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 border border-surface-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 px-4 py-3 text-sm font-mono text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* ── Topic cards ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <TopicCardSkeleton key={i} />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-8 w-8 text-surface-500" />}
            title="No topics in voting"
            description="The Forecast Engine activates when topics enter their final vote. Check back when debates reach the voting stage."
            action={
              <Link
                href="/surge"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                See surging topics
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {sorted.map(topic => (
              <TopicForecastCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}

        {/* ── Footer note ────────────────────────────────────────────────── */}
        {sorted.length > 0 && !loading && (
          <div className="mt-8 flex items-start gap-2 px-3 py-3 rounded-xl bg-surface-100 border border-surface-300">
            <Activity className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
              Forecast probabilities update as votes come in. For a broader platform picture,
              see the{' '}
              <Link href="/oracle" className="text-for-400 hover:text-for-300 transition-colors">Oracle</Link>
              {' '}for AI prophecy or{' '}
              <Link href="/predictions" className="text-for-400 hover:text-for-300 transition-colors">Predictions</Link>
              {' '}to stake Clout on outcomes.
            </p>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
