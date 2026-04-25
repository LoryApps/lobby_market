'use client'

/**
 * PredictionPanel
 *
 * The Polymarket-style prediction widget for a topic.
 * Shows:
 *   - Aggregate "market" confidence bar (what the crowd thinks)
 *   - Total predictor count
 *   - Current user's prediction + ability to update or cancel it
 *   - Outcome badge if topic is resolved
 *
 * Displayed on the topic detail page below the vote section.
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gavel,
  Info,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PredictionRow {
  id: string
  predicted_law: boolean
  confidence: number
  reasoning: string | null
  resolved_at: string | null
  correct: boolean | null
  brier_score: number | null
  clout_earned: number
  updated_at: string
}

interface PredictionStats {
  total_predictions: number
  law_confidence: number  // 0–100: crowd's aggregate % predicting law
}

interface PredictionPanelProps {
  topicId: string
  topicStatus: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brierLabel(score: number): { text: string; color: string } {
  if (score <= 0.05) return { text: 'Exceptional', color: 'text-emerald' }
  if (score <= 0.15) return { text: 'Sharp', color: 'text-for-400' }
  if (score <= 0.25) return { text: 'Good', color: 'text-for-300' }
  if (score <= 0.4)  return { text: 'Fair', color: 'text-gold' }
  return { text: 'Missed', color: 'text-against-400' }
}

const TERMINAL_STATUSES = new Set(['law', 'failed', 'archived'])

// ─── Confidence Slider ────────────────────────────────────────────────────────

function ConfidenceSlider({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const pct = value
  const isHigh = pct >= 60
  const isMid  = pct >= 40 && pct < 60

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-surface-500">Confidence</span>
        <span
          className={cn(
            'font-bold text-base tabular-nums',
            isHigh ? 'text-for-400' : isMid ? 'text-gold' : 'text-against-400'
          )}
        >
          {pct}%
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Prediction confidence"
        className={cn(
          'w-full h-2 rounded-full appearance-none cursor-pointer',
          'bg-surface-300',
          'accent-for-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <div className="flex justify-between text-[10px] font-mono text-surface-500">
        <span>1% — just guessing</span>
        <span>100% — certain</span>
      </div>
    </div>
  )
}

// ─── Market Bar ───────────────────────────────────────────────────────────────

function MarketBar({ lawConfidence, total }: { lawConfidence: number; total: number }) {
  const forPct = Math.round(lawConfidence)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
          <span className="text-for-400 font-semibold">{forPct}% Will Pass</span>
        </div>
        <div className="flex items-center gap-1 text-surface-500">
          <Users className="h-3 w-3" aria-hidden="true" />
          <span>{total.toLocaleString()} {total === 1 ? 'predictor' : 'predictors'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-against-400 font-semibold">{againstPct}% Will Fail</span>
          <TrendingDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
        </div>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400"
          initial={{ width: '50%' }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-600 to-against-400"
          initial={{ width: '50%' }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PredictionPanel({ topicId, topicStatus }: PredictionPanelProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [myPrediction, setMyPrediction] = useState<PredictionRow | null>(null)
  const [stats, setStats] = useState<PredictionStats>({ total_predictions: 0, law_confidence: 50 })

  // Editing state
  const [editPredictedLaw, setEditPredictedLaw] = useState<boolean>(true)
  const [editConfidence, setEditConfidence] = useState(70)
  const [editReasoning, setEditReasoning] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const isTerminal = TERMINAL_STATUSES.has(topicStatus)
  const isLaw = topicStatus === 'law'
  const MAX_REASONING = 280

  // Load initial data
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/predict`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setMyPrediction(json.myPrediction)
      setStats(json.stats)
      if (json.myPrediction) {
        setEditPredictedLaw(json.myPrediction.predicted_law)
        setEditConfidence(json.myPrediction.confidence)
        setEditReasoning(json.myPrediction.reasoning ?? '')
      }
    } finally {
      setLoading(false)
    }
  }, [topicId])

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(!!data.user)
    })
    load()
  }, [load])

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const trimmedReasoning = editReasoning.trim()
      const res = await fetch(`/api/topics/${topicId}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predicted_law: editPredictedLaw,
          confidence: editConfidence,
          reasoning: trimmedReasoning || null,
        }),
      })
      if (!res.ok) return
      const json = await res.json()
      setMyPrediction(json.prediction)
      if (json.stats) setStats(json.stats)
      setIsEditing(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await fetch(`/api/topics/${topicId}/predict`, { method: 'DELETE' })
      setMyPrediction(null)
      setEditPredictedLaw(true)
      setEditConfidence(70)
      setEditReasoning('')
      setIsEditing(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  // Don't show panel while loading if there are no predictions yet (keeps page clean)
  if (loading && stats.total_predictions === 0 && !isTerminal) {
    return null
  }

  return (
    <div className="mt-6 rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5',
          'hover:bg-surface-200 transition-colors text-left',
          expanded && 'border-b border-surface-300'
        )}
        aria-expanded={expanded}
        aria-controls="prediction-panel-body"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
          <BarChart2 className="h-4 w-4 text-purple" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-semibold text-white">Prediction Market</span>
            {myPrediction && !isEditing && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
                myPrediction.predicted_law
                  ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                  : 'bg-against-500/20 text-against-300 border border-against-500/30'
              )}>
                {myPrediction.predicted_law ? 'Predicting: Pass' : 'Predicting: Fail'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 font-mono mt-0.5 truncate">
            {stats.total_predictions === 0
              ? 'Be the first to make a prediction'
              : `${stats.total_predictions.toLocaleString()} ${stats.total_predictions === 1 ? 'prediction' : 'predictions'} · ${Math.round(stats.law_confidence)}% predict passage`}
          </p>
        </div>

        <div className="flex-shrink-0 text-surface-500">
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="prediction-panel-body"
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-5">

              {/* Market bar */}
              {stats.total_predictions > 0 && (
                <MarketBar lawConfidence={stats.law_confidence} total={stats.total_predictions} />
              )}

              {/* Resolved outcome banner */}
              {isTerminal && (
                <div className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3',
                  isLaw
                    ? 'border-emerald/30 bg-emerald/10'
                    : 'border-surface-300 bg-surface-200'
                )}>
                  {isLaw ? (
                    <Gavel className="h-5 w-5 text-emerald flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-5 w-5 text-surface-500 flex-shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">
                      {isLaw ? 'Established as Law' : 'Topic did not pass'}
                    </p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      This market is resolved. Predictions have been scored.
                    </p>
                  </div>
                </div>
              )}

              {/* My prediction card */}
              {myPrediction && !isEditing && (
                <div className={cn(
                  'rounded-xl border p-4',
                  myPrediction.correct === true
                    ? 'border-emerald/30 bg-emerald/5'
                    : myPrediction.correct === false
                    ? 'border-against-400/30 bg-against-500/5'
                    : myPrediction.predicted_law
                    ? 'border-for-500/30 bg-for-500/5'
                    : 'border-against-400/30 bg-against-500/5'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {myPrediction.correct === true ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald" aria-hidden="true" />
                        ) : myPrediction.correct === false ? (
                          <XCircle className="h-4 w-4 text-against-400" aria-hidden="true" />
                        ) : myPrediction.predicted_law ? (
                          <TrendingUp className="h-4 w-4 text-for-400" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-against-400" aria-hidden="true" />
                        )}
                        <span className="text-sm font-mono font-semibold text-white">
                          Your prediction:{' '}
                          <span className={myPrediction.predicted_law ? 'text-for-400' : 'text-against-400'}>
                            {myPrediction.predicted_law ? 'Will Pass' : 'Will Fail'}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs font-mono text-surface-500">
                        {myPrediction.confidence}% confident
                        {myPrediction.resolved_at && myPrediction.brier_score !== null && (
                          <>
                            {' · '}
                            <span className={brierLabel(myPrediction.brier_score).color}>
                              {brierLabel(myPrediction.brier_score).text}
                            </span>
                            {' · Brier '}
                            {myPrediction.brier_score.toFixed(3)}
                          </>
                        )}
                        {myPrediction.clout_earned > 0 && (
                          <span className="text-gold"> · +{myPrediction.clout_earned} clout</span>
                        )}
                      </p>
                      {myPrediction.reasoning && (
                        <p className="mt-2 text-xs font-mono text-surface-400 italic leading-relaxed border-l-2 border-surface-400 pl-2">
                          &ldquo;{myPrediction.reasoning}&rdquo;
                        </p>
                      )}
                    </div>

                    {!isTerminal && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors underline underline-offset-2"
                          aria-label="Edit prediction"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={submitting}
                          className="text-xs font-mono text-surface-500 hover:text-against-400 transition-colors underline underline-offset-2"
                          aria-label="Cancel prediction"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prediction form */}
              {!isTerminal && (isEditing || !myPrediction) && (
                <div className="space-y-4">
                  {!loggedIn ? (
                    <div className="flex items-center gap-2 rounded-lg border border-surface-300 bg-surface-200 px-4 py-3">
                      <Info className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
                      <p className="text-xs font-mono text-surface-500">
                        <a href="/login" className="text-for-400 hover:underline">Sign in</a>
                        {' '}to place a prediction and track your accuracy.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Outcome selector */}
                      <div className="space-y-2">
                        <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                          Your prediction
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditPredictedLaw(true)}
                            className={cn(
                              'flex items-center justify-center gap-2 rounded-xl border py-3 px-4',
                              'text-sm font-mono font-semibold transition-all',
                              editPredictedLaw
                                ? 'border-for-500/50 bg-for-500/15 text-for-300 ring-1 ring-for-500/30'
                                : 'border-surface-300 bg-surface-200 text-surface-500 hover:border-for-500/30 hover:text-for-400'
                            )}
                            aria-pressed={editPredictedLaw}
                          >
                            <TrendingUp className="h-4 w-4" aria-hidden="true" />
                            Will Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPredictedLaw(false)}
                            className={cn(
                              'flex items-center justify-center gap-2 rounded-xl border py-3 px-4',
                              'text-sm font-mono font-semibold transition-all',
                              !editPredictedLaw
                                ? 'border-against-400/50 bg-against-500/15 text-against-300 ring-1 ring-against-400/30'
                                : 'border-surface-300 bg-surface-200 text-surface-500 hover:border-against-400/30 hover:text-against-400'
                            )}
                            aria-pressed={!editPredictedLaw}
                          >
                            <TrendingDown className="h-4 w-4" aria-hidden="true" />
                            Will Fail
                          </button>
                        </div>
                      </div>

                      {/* Confidence slider */}
                      <ConfidenceSlider
                        value={editConfidence}
                        onChange={setEditConfidence}
                      />

                      {/* Optional reasoning */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            className="text-xs font-mono text-surface-500 uppercase tracking-wider"
                            htmlFor="pred-reasoning"
                          >
                            Why? <span className="normal-case text-surface-600">(optional)</span>
                          </label>
                          <span className={cn(
                            'text-[10px] font-mono tabular-nums',
                            editReasoning.length > MAX_REASONING - 30 ? 'text-against-400' : 'text-surface-600'
                          )}>
                            {MAX_REASONING - editReasoning.length}
                          </span>
                        </div>
                        <textarea
                          id="pred-reasoning"
                          value={editReasoning}
                          onChange={(e) => setEditReasoning(e.target.value.slice(0, MAX_REASONING))}
                          disabled={submitting}
                          rows={2}
                          maxLength={MAX_REASONING}
                          placeholder="Share your analysis — what signals are you seeing?"
                          aria-label="Prediction reasoning (optional)"
                          className={cn(
                            'w-full resize-none rounded-xl px-3 py-2.5 text-xs font-mono',
                            'bg-surface-200 border border-surface-300',
                            'text-white placeholder:text-surface-600',
                            'focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/20',
                            'transition-colors',
                            submitting && 'opacity-60 cursor-not-allowed'
                          )}
                        />
                      </div>

                      {/* Submit / cancel */}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSubmit}
                          disabled={submitting}
                          className="flex-1"
                          variant={editPredictedLaw ? 'for' : 'against'}
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : myPrediction ? (
                            'Update prediction'
                          ) : (
                            'Place prediction'
                          )}
                        </Button>
                        {isEditing && (
                          <Button
                            onClick={() => setIsEditing(false)}
                            variant="ghost"
                            disabled={submitting}
                            aria-label="Discard changes"
                          >
                            Discard
                          </Button>
                        )}
                      </div>

                      {/* Brier score explainer */}
                      <div className="flex items-start gap-2 text-[11px] font-mono text-surface-500 border-t border-surface-300 pt-3">
                        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <p>
                          Predictions are scored with the <strong className="text-surface-600">Brier score</strong> —
                          higher confidence earns more clout when correct, but penalises overconfidence when wrong.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
