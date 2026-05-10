'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CritiqueResponse } from '@/app/api/arguments/critique/route'

// ─── Grade helpers ────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-gold'
    case 'B': return 'text-emerald'
    case 'C': return 'text-for-400'
    case 'D': return 'text-against-400'
    default:  return 'text-surface-500'
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-gold/10 border-gold/30'
    case 'B': return 'bg-emerald/10 border-emerald/30'
    case 'C': return 'bg-for-500/10 border-for-500/30'
    case 'D': return 'bg-against-500/10 border-against-500/30'
    default:  return 'bg-surface-300/40 border-surface-400/30'
  }
}

function dimensionColor(score: number): string {
  if (score >= 8) return 'bg-emerald'
  if (score >= 6) return 'bg-for-400'
  if (score >= 4) return 'bg-gold'
  return 'bg-against-400'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CritiqueSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-surface-400/40 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-28 rounded bg-surface-400/40" />
          <div className="h-3 w-full rounded bg-surface-400/30" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between">
            <div className="h-2.5 w-16 rounded bg-surface-400/30" />
            <div className="h-2.5 w-6 rounded bg-surface-400/30" />
          </div>
          <div className="h-1.5 rounded-full bg-surface-400/20" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InlineCritiquePanelProps {
  loading: boolean
  critique: CritiqueResponse | null
  unavailable: boolean
  side: 'blue' | 'red'
  onClose: () => void
}

export function InlineCritiquePanel({
  loading,
  critique,
  unavailable,
  side,
  onClose,
}: InlineCritiquePanelProps) {
  const isFor = side === 'blue'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        <div
          className={cn(
            'rounded-xl border p-4 space-y-4',
            isFor
              ? 'bg-for-900/30 border-for-500/20'
              : 'bg-against-900/30 border-against-500/20',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className={cn('h-3.5 w-3.5', isFor ? 'text-for-400' : 'text-against-400')} />
              <span className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
                AI Critique
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close critique panel"
              className="text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Loading */}
          {loading && <CritiqueSkeleton />}

          {/* Unavailable */}
          {!loading && unavailable && (
            <p className="text-[11px] font-mono text-surface-500">
              AI critique is unavailable on this deployment.
            </p>
          )}

          {/* Results */}
          {!loading && !unavailable && critique && (
            <div className="space-y-4">
              {/* Grade + summary */}
              <div className={cn('flex items-start gap-3 rounded-xl border p-3', gradeBg(critique.grade))}>
                <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-lg bg-surface-100">
                  <span className={cn('text-2xl font-black leading-none', gradeColor(critique.grade))}>
                    {critique.grade}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-mono font-bold text-white">
                      Score: {critique.score}/10
                    </span>
                    <div className="flex-1 h-1 rounded-full bg-surface-300/40 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          critique.score >= 8 ? 'bg-emerald' :
                          critique.score >= 6 ? 'bg-for-400' :
                          critique.score >= 4 ? 'bg-gold' : 'bg-against-400',
                        )}
                        style={{ width: `${critique.score * 10}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-surface-300 font-mono leading-snug">
                    {critique.summary}
                  </p>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-2.5">
                {critique.dimensions.map((dim) => (
                  <div key={dim.name} className="space-y-1">
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
                        className={cn('h-full rounded-full', dimensionColor(dim.score))}
                        initial={{ width: 0 }}
                        animate={{ width: `${dim.score * 10}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-surface-500 leading-snug">
                      {dim.feedback}
                    </p>
                  </div>
                ))}
              </div>

              {/* Strong point */}
              {critique.strong_point && (
                <div className="flex items-start gap-2 rounded-lg bg-emerald/5 border border-emerald/20 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-mono text-surface-300 leading-snug">
                    <span className="text-emerald font-semibold">Strong: </span>
                    {critique.strong_point}
                  </p>
                </div>
              )}

              {/* Suggestions */}
              {critique.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3 text-gold" />
                    <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wide">
                      How to improve
                    </span>
                  </div>
                  {critique.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 text-gold flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-mono text-surface-400 leading-snug">
                        {s}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Trigger button ───────────────────────────────────────────────────────────

interface CritiqueButtonProps {
  side: 'blue' | 'red'
  loading: boolean
  hasResult: boolean
  onClick: () => void
}

export function CritiqueButton({ side, loading, hasResult, onClick }: CritiqueButtonProps) {
  const isFor = side === 'blue'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Get AI critique of your argument draft"
      className={cn(
        'flex items-center gap-1.5 text-[11px] font-mono transition-colors disabled:opacity-50',
        hasResult
          ? 'text-surface-500 hover:text-surface-300'
          : isFor
            ? 'text-for-400/70 hover:text-for-300'
            : 'text-against-400/70 hover:text-against-300',
      )}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-3 w-3" aria-hidden />
      )}
      {loading ? 'Evaluating…' : hasResult ? 'Refresh critique' : 'Get AI critique'}
    </button>
  )
}
