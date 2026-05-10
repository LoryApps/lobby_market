'use client'

/**
 * TopicQualityAdvisor
 *
 * Inline AI quality panel for the topic creation flow. Shows five dimension
 * scores (Clarity, Binary Feasibility, Scope, Debate Potential, Civic Impact)
 * plus an improved statement suggestion when the score is below 8.
 *
 * Mirrors the InlineCritiquePanel design pattern used for argument grading.
 */

import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Lightbulb,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { QualityCheckResponse, QualityTier } from '@/app/api/topics/quality-check/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  QualityTier,
  { label: string; text: string; bg: string; border: string; bar: string; ring: string }
> = {
  excellent: {
    label: 'Excellent',
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    ring: 'ring-emerald/20',
  },
  good: {
    label: 'Good',
    text: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-400',
    ring: 'ring-for-500/20',
  },
  'needs-work': {
    label: 'Needs Work',
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
    ring: 'ring-gold/20',
  },
  poor: {
    label: 'Poor',
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
    ring: 'ring-against-500/20',
  },
}

function dimensionBar(score: number): string {
  if (score >= 8) return 'bg-emerald'
  if (score >= 6) return 'bg-for-400'
  if (score >= 4) return 'bg-gold'
  return 'bg-against-400'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function QualitySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-surface-400/30 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 rounded bg-surface-400/30" />
          <div className="h-3 w-full rounded bg-surface-400/20" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between">
            <div className="h-2.5 w-20 rounded bg-surface-400/30" />
            <div className="h-2.5 w-8 rounded bg-surface-400/30" />
          </div>
          <div className="h-1.5 rounded-full bg-surface-400/20" />
        </div>
      ))}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopicQualityAdvisorProps {
  loading: boolean
  result: QualityCheckResponse | null
  unavailable: boolean
  onClose: () => void
  /** Called when the user clicks "Use this" on the improved statement */
  onApplyImprovement?: (statement: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicQualityAdvisor({
  loading,
  result,
  unavailable,
  onClose,
  onApplyImprovement,
}: TopicQualityAdvisorProps) {
  const tier = result ? TIER_CONFIG[result.tier] : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        <div className="rounded-xl border border-purple/20 bg-purple/5 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple" />
              <span className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
                AI Quality Check
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quality advisor"
              className="text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Loading */}
          {loading && <QualitySkeleton />}

          {/* Unavailable */}
          {!loading && unavailable && (
            <p className="text-[11px] font-mono text-surface-500">
              AI quality check is unavailable on this deployment.
            </p>
          )}

          {/* Results */}
          {!loading && !unavailable && result && tier && (
            <div className="space-y-4">
              {/* Score badge + summary */}
              <div className={cn('flex items-start gap-3 rounded-xl border p-3', tier.bg, tier.border)}>
                <div
                  className={cn(
                    'flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl border',
                    tier.bg,
                    tier.border,
                    'ring-2',
                    tier.ring,
                  )}
                >
                  <span className={cn('text-xs font-black leading-none font-mono', tier.text)}>
                    {result.score}
                    <span className="text-[9px] text-surface-500">/10</span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-[11px] font-mono font-bold', tier.text)}>
                      {tier.label}
                    </span>
                    <div className="flex-1 h-1 rounded-full bg-surface-300/30 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', tier.bar)}
                        style={{ width: `${result.score * 10}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-surface-300 font-mono leading-snug">
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Dimension scores */}
              <div className="space-y-2.5">
                {result.dimensions.map((dim) => (
                  <div key={dim.name} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-surface-400 uppercase tracking-wide">
                        {dim.name}
                      </span>
                      <span className="text-[10px] font-mono text-white tabular-nums">
                        {dim.score}/10
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-300/30 overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', dimensionBar(dim.score))}
                        initial={{ width: 0 }}
                        animate={{ width: `${dim.score * 10}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-surface-500 leading-snug">
                      {dim.feedback}
                    </p>
                  </div>
                ))}
              </div>

              {/* Improvement suggestions */}
              {result.improvements.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono font-semibold text-surface-400 uppercase tracking-wide">
                    Suggestions
                  </p>
                  {result.improvements.map((tip, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-surface-200/40 border border-surface-300/30 px-3 py-2"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-mono text-surface-300 leading-snug">{tip}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Improved statement */}
              {result.improved_statement && (
                <div className="rounded-xl border border-purple/30 bg-purple/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5 text-purple" />
                    <span className="text-[10px] font-mono font-semibold text-purple uppercase tracking-wide">
                      Suggested Revision
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-surface-200 leading-snug">
                    &ldquo;{result.improved_statement}&rdquo;
                  </p>
                  {onApplyImprovement && (
                    <button
                      type="button"
                      onClick={() => onApplyImprovement(result.improved_statement!)}
                      className={cn(
                        'flex items-center gap-1.5 text-[10px] font-mono font-semibold',
                        'text-purple hover:text-white transition-colors',
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Use this statement
                    </button>
                  )}
                </div>
              )}

              {/* Ready badge when score is excellent */}
              {result.tier === 'excellent' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald/5 border border-emerald/20 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                  <p className="text-[11px] font-mono text-surface-300 leading-snug">
                    <span className="text-emerald font-semibold">Ready to post.</span>{' '}
                    This is a strong civic topic statement.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Spinner hint when loading */}
          {loading && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analysing topic quality…
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
