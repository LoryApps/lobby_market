'use client'

/**
 * /topic/[id]/parallels — The Historical Mirror
 *
 * Surfaces 5 landmark historical debates that structurally mirror the
 * current topic. Surfaces lessons, outcomes, and a precedent-based forecast.
 *
 * Distinct from:
 *   /topic/[id]/legacy    — what THIS topic's resolved legacy is
 *   /topic/[id]/forecast  — probabilistic vote projection
 *   /topic/[id]/context   — editorial/news context
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Globe,
  History,
  Lightbulb,
  RefreshCw,
  Scroll,
  Star,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ParallelsResponse, HistoricalParallel } from '@/app/api/topics/[id]/parallels/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ParallelsClientProps {
  topicId: string
}

// ─── Outcome badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: HistoricalParallel['outcome'] }) {
  const cfg = {
    passed: { label: 'Passed', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', Icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'text-against-400 bg-against-400/10 border-against-400/20', Icon: XCircle },
    partial: { label: 'Partial', color: 'text-gold bg-gold/10 border-gold/20', Icon: TrendingUp },
    mixed: { label: 'Mixed', color: 'text-purple bg-purple/10 border-purple/20', Icon: Zap },
  }[outcome]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border',
        cfg.color,
      )}
    >
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Similarity bar ───────────────────────────────────────────────────────────

function SimilarityBar({ score }: { score: number }) {
  const color =
    score >= 80 ? '#3b82f6' :
    score >= 65 ? '#8b5cf6' :
    score >= 50 ? '#f59e0b' :
    '#6b7280'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-surface-400 w-8 text-right">{score}%</span>
    </div>
  )
}

// ─── Parallel card ────────────────────────────────────────────────────────────

function ParallelCard({
  parallel,
  index,
}: {
  parallel: HistoricalParallel
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-surface-800/60 border border-surface-700 rounded-xl overflow-hidden"
    >
      {/* Header ---------------------------------------------------------------- */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {parallel.landmark && (
                <Star className="h-3.5 w-3.5 text-gold flex-shrink-0" />
              )}
              <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wider">
                {parallel.domain}
              </span>
              <span className="text-[10px] font-mono text-surface-500">·</span>
              <span className="text-[10px] font-mono text-surface-400 flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {parallel.country}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-surface-100 leading-snug">
              {parallel.title}
            </h3>
            <p className="text-xs font-mono text-surface-400 mt-0.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {parallel.period} · {parallel.resolutionTime}
            </p>
          </div>
          <OutcomeBadge outcome={parallel.outcome} />
        </div>

        {/* Similarity score */}
        <div className="mb-3">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            Similarity
          </p>
          <SimilarityBar score={parallel.similarityScore} />
        </div>

        {/* Description */}
        <p className="text-xs text-surface-300 leading-relaxed">
          {parallel.description}
        </p>
      </div>

      {/* Match reasons --------------------------------------------------------- */}
      <div className="px-4 pb-3">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
          Why this matches
        </p>
        <ul className="space-y-1">
          {parallel.matchReasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-surface-400">
              <span className="text-for-400 mt-0.5 flex-shrink-0">›</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Toggle lesson + relevance --------------------------------------------- */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-2 flex items-center gap-2 text-xs font-mono text-surface-400 hover:text-surface-200 hover:bg-surface-700/30 transition-colors border-t border-surface-700/50"
      >
        <Lightbulb className="h-3.5 w-3.5 text-gold" />
        {expanded ? 'Hide lesson' : 'Show lesson & relevance'}
        <span className="ml-auto">{expanded ? '↑' : '↓'}</span>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-surface-700/50"
        >
          <div className="p-4 space-y-3">
            <div>
              <p className="text-[10px] font-mono text-gold uppercase tracking-wider mb-1.5">
                Key lesson
              </p>
              <p className="text-xs text-surface-300 leading-relaxed">
                {parallel.keyLesson}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-1.5">
                Why it matters today
              </p>
              <p className="text-xs text-surface-300 leading-relaxed">
                {parallel.currentRelevance}
              </p>
            </div>
            {/* Public support bar */}
            <div>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Historical public support at peak
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-for-500 rounded-l-full"
                    style={{ width: `${parallel.forSentiment}%` }}
                  />
                  <div
                    className="h-full bg-against-500 rounded-r-full"
                    style={{ width: `${100 - parallel.forSentiment}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-for-400">{parallel.forSentiment}%</span>
                <span className="text-xs font-mono text-surface-500">/</span>
                <span className="text-xs font-mono text-against-400">{100 - parallel.forSentiment}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Forecast panel ───────────────────────────────────────────────────────────

function ForecastPanel({ data }: { data: ParallelsResponse }) {
  const { precedentForecast } = data
  const color =
    precedentForecast.confidenceScore >= 70 ? 'text-emerald-400' :
    precedentForecast.confidenceScore >= 50 ? 'text-gold' :
    'text-surface-400'

  const passColor =
    precedentForecast.historicalPassRate >= 60 ? 'text-for-400' :
    precedentForecast.historicalPassRate >= 40 ? 'text-gold' :
    'text-against-400'

  const passWidth = precedentForecast.historicalPassRate

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-surface-800/60 border border-surface-700 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Scroll className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-semibold text-surface-100">Precedent Forecast</h2>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="text-center">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            Historical pass rate
          </p>
          <p className={cn('text-2xl font-bold font-mono', passColor)}>
            {precedentForecast.historicalPassRate}%
          </p>
          <p className="text-[10px] text-surface-500">of parallels passed</p>
        </div>
        <div className="flex-1 border-l border-surface-700 pl-4">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            Confidence
          </p>
          <p className={cn('text-lg font-bold font-mono', color)}>
            {precedentForecast.confidenceScore}%
          </p>
          <p className="text-[10px] text-surface-500">signal strength</p>
        </div>
      </div>

      {/* Pass rate bar */}
      <div className="mb-3">
        <div className="h-2 bg-surface-700 rounded-full overflow-hidden flex">
          <motion.div
            className="h-full bg-for-500 rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${passWidth}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-against-500 rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${100 - passWidth}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>

      <p className="text-xs text-surface-300 leading-relaxed mb-2">
        {precedentForecast.mostLikelyOutcome}
      </p>
      <p className="text-[10px] font-mono text-surface-500">
        Based on: {precedentForecast.basedOn}
      </p>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ParallelsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParallelsClient({ topicId }: ParallelsClientProps) {
  const params = useParams()
  const id = (params?.id as string) ?? topicId

  const [data, setData] = useState<ParallelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/parallels`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load historical parallels.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Established Law',
    failed: 'Failed',
  }

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Back link */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* Page header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <History className="h-5 w-5 text-gold" />
            <h1 className="text-lg font-bold text-surface-100">Historical Mirror</h1>
            <Badge variant="outline" className="text-[10px] font-mono ml-auto">
              Ch. 465
            </Badge>
          </div>
          {data && (
            <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
              {data.topic.statement}
            </p>
          )}
          <p className="text-xs text-surface-500 mt-1">
            Landmark historical debates that structurally mirror this topic
          </p>
        </div>

        {loading && <ParallelsSkeleton />}

        {error && (
          <div className="text-center py-16 space-y-3">
            <p className="text-surface-400 text-sm">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 font-mono"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            {/* Overall insight */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gold/5 border border-gold/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-gold" />
                <span className="text-xs font-semibold text-gold">Historical Overview</span>
              </div>
              <p className="text-xs text-surface-300 leading-relaxed">
                {data.overallInsight}
              </p>
              {data.themeFingerprint.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {data.themeFingerprint.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 bg-surface-700/60 rounded text-[10px] font-mono text-surface-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Topic stat pills */}
            <div className="flex gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-surface-800 border border-surface-700 rounded-lg text-[10px] font-mono text-surface-400">
                {statusLabel[data.topic.status] ?? data.topic.status}
              </span>
              <span className="px-2.5 py-1 bg-surface-800 border border-surface-700 rounded-lg text-[10px] font-mono text-for-400">
                {Math.round(data.topic.blue_pct)}% For
              </span>
              <span className="px-2.5 py-1 bg-surface-800 border border-surface-700 rounded-lg text-[10px] font-mono text-against-400">
                {100 - Math.round(data.topic.blue_pct)}% Against
              </span>
              <span className="px-2.5 py-1 bg-surface-800 border border-surface-700 rounded-lg text-[10px] font-mono text-surface-400">
                {data.topic.total_votes.toLocaleString()} votes
              </span>
              <span className="px-2.5 py-1 bg-surface-800 border border-surface-700 rounded-lg text-[10px] font-mono text-surface-400">
                {data.topic.total_arguments.toLocaleString()} arguments
              </span>
            </div>

            {/* Forecast panel */}
            <ForecastPanel data={data} />

            {/* Section header */}
            <div className="flex items-center gap-2 pt-1">
              <History className="h-4 w-4 text-surface-500" />
              <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider font-mono">
                {data.parallels.length} Historical Parallels
              </h2>
            </div>

            {/* Parallel cards */}
            {data.parallels.map((p, i) => (
              <ParallelCard key={p.id} parallel={p} index={i} />
            ))}

            {/* Methodology note */}
            <div className="bg-surface-800/40 border border-surface-700/50 rounded-xl p-4">
              <p className="text-[10px] font-mono text-surface-500 leading-relaxed">
                Parallels are scored by domain alignment, contestedness profile, and debate
                intensity across a curated pool of landmark civic debates. They are not
                predictions — they are structural mirrors that surface relevant historical
                lessons.
              </p>
            </div>

            {/* Related links */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <Link
                href={`/topic/${id}/forecast`}
                className="flex items-center gap-2 p-3 bg-surface-800/40 border border-surface-700/50 rounded-xl hover:bg-surface-800 transition-colors"
              >
                <TrendingUp className="h-4 w-4 text-for-400" />
                <div>
                  <p className="text-xs font-semibold text-surface-200">Vote Forecast</p>
                  <p className="text-[10px] text-surface-500">Live projection</p>
                </div>
              </Link>
              <Link
                href={`/topic/${id}/context`}
                className="flex items-center gap-2 p-3 bg-surface-800/40 border border-surface-700/50 rounded-xl hover:bg-surface-800 transition-colors"
              >
                <Globe className="h-4 w-4 text-purple" />
                <div>
                  <p className="text-xs font-semibold text-surface-200">Real-World Context</p>
                  <p className="text-[10px] text-surface-500">News & sources</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
