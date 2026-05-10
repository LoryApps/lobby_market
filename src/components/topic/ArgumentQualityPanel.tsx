'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentQualityResponse,
  Grade,
  GradeCount,
  QualityTier,
} from '@/app/api/topics/[id]/argument-quality/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<
  Grade,
  { text: string; bg: string; border: string; bar: string }
> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/15',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  B: { text: 'text-for-300',      bg: 'bg-for-500/15',     border: 'border-for-500/30',     bar: 'bg-for-400' },
  C: { text: 'text-gold',         bg: 'bg-gold/15',         border: 'border-gold/30',         bar: 'bg-gold' },
  D: { text: 'text-against-300',  bg: 'bg-against-500/15', border: 'border-against-500/30', bar: 'bg-against-400' },
  F: { text: 'text-against-400',  bg: 'bg-against-600/15', border: 'border-against-600/30', bar: 'bg-against-600' },
}

const TIER_CONFIG: Record<
  QualityTier,
  { text: string; bg: string; border: string; dot: string }
> = {
  excellent: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     dot: 'bg-emerald' },
  good:      { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     dot: 'bg-for-400' },
  mixed:     { text: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         dot: 'bg-gold' },
  poor:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30', dot: 'bg-against-400' },
  ungraded:  { text: 'text-surface-500', bg: 'bg-surface-200/40', border: 'border-surface-300/40', dot: 'bg-surface-500' },
}

// ─── Grade distribution bar ───────────────────────────────────────────────────

function GradeBar({
  distribution,
  total,
  label,
  isFor,
}: {
  distribution: GradeCount[]
  total: number
  label: string
  isFor: boolean
}) {
  if (total === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full flex-shrink-0',
            isFor ? 'bg-for-400' : 'bg-against-400'
          )}
        />
        <span className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] font-mono text-surface-600 ml-auto">
          {total} graded
        </span>
      </div>

      {/* Stacked bar */}
      <div className="h-2 flex rounded-full overflow-hidden bg-surface-300/40 gap-px">
        {distribution.map(({ grade, count }) => {
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={grade}
              className={cn(GRADE_CONFIG[grade].bar, 'transition-all')}
              style={{ width: `${pct}%` }}
              title={`Grade ${grade}: ${count} argument${count !== 1 ? 's' : ''}`}
            />
          )
        })}
      </div>

      {/* Grade pills */}
      <div className="flex flex-wrap gap-1">
        {distribution.map(({ grade, count }) => {
          if (count === 0) return null
          const cfg = GRADE_CONFIG[grade]
          return (
            <span
              key={grade}
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                cfg.bg,
                cfg.text,
                cfg.border,
                'border'
              )}
            >
              {grade}
              <span className="font-normal opacity-70">×{count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Score display ────────────────────────────────────────────────────────────

function ScoreBadge({ score, side }: { score: number | null; side: 'for' | 'against' }) {
  if (score === null) return <span className="text-xs text-surface-600 font-mono">—</span>

  const grade: Grade =
    score >= 9 ? 'A' :
    score >= 7 ? 'B' :
    score >= 5 ? 'C' :
    score >= 3 ? 'D' : 'F'

  const cfg = GRADE_CONFIG[grade]

  return (
    <div className="flex items-baseline gap-1">
      <span className={cn('text-lg font-mono font-bold tabular-nums', side === 'for' ? 'text-for-300' : 'text-against-300')}>
        {score.toFixed(1)}
      </span>
      <span className={cn('text-xs font-mono font-bold', cfg.text)}>{grade}</span>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface ArgumentQualityPanelProps {
  topicId: string
  className?: string
}

export function ArgumentQualityPanel({ topicId, className }: ArgumentQualityPanelProps) {
  const [data, setData] = useState<ArgumentQualityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/argument-quality`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json() as ArgumentQualityResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className={cn('rounded-xl bg-surface-100 border border-surface-300/60 p-4', className)}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-4 w-4 text-surface-500 animate-pulse" />
          <div className="h-4 w-32 bg-surface-300/60 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-surface-300/40 rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-surface-300/40 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !data) return null
  if (data.total_arguments === 0) return null

  const tierCfg = TIER_CONFIG[data.quality_tier]
  const hasGrades = data.graded_arguments > 0

  return (
    <div className={cn('rounded-xl bg-surface-100 border border-surface-300/60 overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-200/60 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-for-400 flex-shrink-0" />
        <span className="flex-1 text-sm font-mono font-semibold text-white">
          Debate Quality
        </span>

        {hasGrades && (
          <span
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
              tierCfg.text,
              tierCfg.bg,
              tierCfg.border
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', tierCfg.dot)} />
            {data.quality_label}
          </span>
        )}

        {!hasGrades && (
          <span className="text-[11px] font-mono text-surface-600">
            {data.total_arguments} args · no grades yet
          </span>
        )}

        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-surface-300/40">

              {/* Ungraded state */}
              {!hasGrades && (
                <div className="pt-4 flex flex-col items-center gap-2 py-4 text-center">
                  <Sparkles className="h-5 w-5 text-surface-500" />
                  <p className="text-xs text-surface-500 font-mono">
                    No AI grades yet.
                  </p>
                  <p className="text-[11px] text-surface-600 font-mono leading-relaxed max-w-[240px]">
                    Post an argument and run the AI critique to earn a grade visible to all.
                  </p>
                </div>
              )}

              {/* Graded state */}
              {hasGrades && (
                <>
                  {/* Score summary row */}
                  <div className="pt-3 grid grid-cols-3 gap-3">
                    {/* FOR avg */}
                    <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-for-500/10 border border-for-500/20">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-for-400" />
                        <span className="text-[10px] font-mono text-for-400 uppercase tracking-wider font-semibold">FOR</span>
                      </div>
                      <ScoreBadge score={data.for_quality.avg_score} side="for" />
                      <span className="text-[10px] font-mono text-surface-600">{data.for_quality.graded_count} graded</span>
                    </div>

                    {/* Overall avg */}
                    <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/40">
                      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider font-semibold">Overall</span>
                      {data.overall_avg_score !== null ? (
                        <>
                          <span className={cn('text-lg font-mono font-bold tabular-nums', tierCfg.text)}>
                            {data.overall_avg_score.toFixed(1)}
                          </span>
                          <span className="text-[10px] font-mono text-surface-600">{data.graded_arguments}/{data.total_arguments}</span>
                        </>
                      ) : (
                        <span className="text-xs text-surface-600 font-mono">—</span>
                      )}
                    </div>

                    {/* AGAINST avg */}
                    <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-against-500/10 border border-against-500/20">
                      <div className="flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3 text-against-400" />
                        <span className="text-[10px] font-mono text-against-400 uppercase tracking-wider font-semibold">AGN</span>
                      </div>
                      <ScoreBadge score={data.against_quality.avg_score} side="against" />
                      <span className="text-[10px] font-mono text-surface-600">{data.against_quality.graded_count} graded</span>
                    </div>
                  </div>

                  {/* Grade distributions */}
                  <div className="space-y-3">
                    {data.for_quality.graded_count > 0 && (
                      <GradeBar
                        distribution={data.for_quality.grade_distribution}
                        total={data.for_quality.graded_count}
                        label="FOR arguments"
                        isFor
                      />
                    )}
                    {data.against_quality.graded_count > 0 && (
                      <GradeBar
                        distribution={data.against_quality.grade_distribution}
                        total={data.against_quality.graded_count}
                        label="AGAINST arguments"
                        isFor={false}
                      />
                    )}
                  </div>

                  {/* Quality edge callout */}
                  {data.for_quality.avg_score !== null &&
                   data.against_quality.avg_score !== null &&
                   Math.abs((data.for_quality.avg_score ?? 0) - (data.against_quality.avg_score ?? 0)) >= 1 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-200/40 border border-surface-300/30">
                      <Award className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-gold" />
                      <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
                        {(data.for_quality.avg_score ?? 0) > (data.against_quality.avg_score ?? 0)
                          ? 'FOR arguments are scoring higher — a stronger evidential case so far.'
                          : 'AGAINST arguments are scoring higher — a stronger evidential case so far.'}
                      </p>
                    </div>
                  )}

                  {/* CTA to top arguments */}
                  <Link
                    href="/top-arguments"
                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface-200/40 border border-surface-300/30 hover:border-surface-400/40 transition-colors group"
                  >
                    <span className="text-[11px] font-mono text-surface-500 group-hover:text-surface-400">
                      View platform-wide argument rankings
                    </span>
                    <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 flex-shrink-0" />
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
