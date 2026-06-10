'use client'

/**
 * /debate/[id]/predictions — Pre-Debate Outcome Predictions
 *
 * Lets users predict debate outcomes before the debate starts:
 *   • Which side will argue more convincingly (FOR / AGAINST / Tie)
 *   • How much the debate will move the topic's FOR% (±50 pp)
 *   • Their confidence level (1–100)
 *
 * Community predictions are shown as aggregate stats + individual cards.
 * After the debate ends, correct predictions are highlighted and clout
 * awards are displayed.
 *
 * Distinct from:
 *   /debate/[id]/audience   — post-debate "who won?" poll
 *   /debate/[id]/verdict    — final debate outcome + topic impact
 *   /debate/[id]/performance — per-speaker stats
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Check,
  ChevronRight,
  Coins,
  ExternalLink,
  Loader2,
  Minus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DebatePredictionsResponse,
  DebatePrediction,
} from '@/app/api/debates/[id]/predictions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'started'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h ${m % 60}m`
  return `${d}d ${h % 24}h`
}

// ─── Prediction form ──────────────────────────────────────────────────────────

interface PredictionFormProps {
  debateId: string
  myPrediction: DebatePrediction | null
  onSubmit: (pred: DebatePrediction) => void
}

function PredictionForm({ debateId, myPrediction, onSubmit }: PredictionFormProps) {
  const [winner, setWinner] = useState<'for' | 'against' | 'tie'>(
    myPrediction?.predicted_winner ?? 'for'
  )
  const [sway, setSway] = useState<number>(myPrediction?.predicted_sway ?? 0)
  const [confidence, setConfidence] = useState<number>(myPrediction?.confidence ?? 60)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${debateId}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predicted_winner: winner, predicted_sway: sway, confidence }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to save prediction')
        return
      }
      const j = await res.json()
      onSubmit(j.prediction as DebatePrediction)
    } catch {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Winner pick */}
      <div>
        <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
          Who will argue more convincingly?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'for', label: 'FOR wins', icon: ThumbsUp, bg: 'bg-for-600', active: 'ring-for-500 bg-for-700' },
              { id: 'tie', label: 'Tie', icon: Minus, bg: 'bg-surface-300', active: 'ring-surface-400 bg-surface-400' },
              { id: 'against', label: 'AGAINST wins', icon: ThumbsDown, bg: 'bg-against-600', active: 'ring-against-500 bg-against-700' },
            ] as const
          ).map(({ id, label, icon: Icon, bg, active }) => (
            <button
              key={id}
              type="button"
              onClick={() => setWinner(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-white font-mono text-xs font-semibold',
                winner === id
                  ? `${active} border-transparent ring-2`
                  : `${bg}/20 border-surface-300/50 hover:border-surface-400/70 text-surface-500`
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sway slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
            Predicted sway change (FOR%)
          </p>
          <span className={cn(
            'text-sm font-mono font-bold tabular-nums',
            sway > 0 ? 'text-for-400' : sway < 0 ? 'text-against-400' : 'text-surface-500'
          )}>
            {sway > 0 ? `+${sway}pp` : sway < 0 ? `${sway}pp` : '0pp'}
          </span>
        </div>
        <input
          type="range"
          min={-20}
          max={20}
          step={1}
          value={sway}
          onChange={(e) => setSway(Number(e.target.value))}
          className="w-full accent-purple h-2 rounded-full"
        />
        <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
          <span>-20pp</span>
          <span className="text-surface-500">no change</span>
          <span>+20pp</span>
        </div>
      </div>

      {/* Confidence slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
            Confidence
          </p>
          <span className={cn(
            'text-sm font-mono font-bold',
            confidence >= 80 ? 'text-gold' : confidence >= 60 ? 'text-for-400' : 'text-surface-500'
          )}>
            {confidence}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full accent-gold h-2 rounded-full"
        />
        <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
          <span>Uncertain</span>
          <span className="text-surface-500">Confident</span>
          <span>Certain</span>
        </div>
      </div>

      {error && (
        <p className="text-xs font-mono text-against-400 flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
          'bg-purple hover:bg-purple/80 text-white font-mono font-semibold text-sm',
          'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
        ) : myPrediction ? (
          <><Check className="h-4 w-4" /> Update Prediction</>
        ) : (
          <><Zap className="h-4 w-4" /> Lock In Prediction</>
        )}
      </button>
    </form>
  )
}

// ─── Prediction card ──────────────────────────────────────────────────────────

function PredictionCard({ pred }: { pred: DebatePrediction }) {
  const winnerConfig = {
    for:     { label: 'FOR wins',     color: 'text-for-400',     bg: 'bg-for-500/10',     icon: ThumbsUp },
    against: { label: 'AGAINST wins', color: 'text-against-400', bg: 'bg-against-500/10', icon: ThumbsDown },
    tie:     { label: 'Tie',          color: 'text-surface-400', bg: 'bg-surface-300/20', icon: Minus },
  }[pred.predicted_winner]

  const WinIcon = winnerConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-colors',
        pred.resolved_at !== null
          ? pred.correct_winner === true
            ? 'bg-emerald/5 border-emerald/20'
            : pred.correct_winner === false
            ? 'bg-against-950/40 border-against-800/20'
            : 'bg-surface-100 border-surface-300/60'
          : 'bg-surface-100 border-surface-300/60'
      )}
    >
      <Avatar
        src={pred.profile?.avatar_url ?? null}
        fallback={pred.profile?.display_name || pred.profile?.username || '?'}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/profile/${pred.profile?.username}`}
            className="text-xs font-semibold font-mono text-white hover:text-for-300 transition-colors"
          >
            {pred.profile?.display_name || pred.profile?.username}
          </Link>
          <span className="text-[10px] font-mono text-surface-600">
            {relativeTime(pred.created_at)}
          </span>
          {pred.resolved_at && pred.correct_winner !== null && (
            pred.correct_winner ? (
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-emerald">
                <Trophy className="h-2.5 w-2.5" /> Called it
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-against-400">
                <XCircle className="h-2.5 w-2.5" /> Missed
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={cn('flex items-center gap-1 text-[11px] font-mono font-semibold', winnerConfig.color)}>
            <WinIcon className="h-3 w-3" />
            {winnerConfig.label}
          </span>
          <span className={cn(
            'text-[11px] font-mono tabular-nums',
            pred.predicted_sway > 0 ? 'text-for-400' : pred.predicted_sway < 0 ? 'text-against-400' : 'text-surface-500'
          )}>
            {pred.predicted_sway > 0 ? `+${pred.predicted_sway}pp` : pred.predicted_sway < 0 ? `${pred.predicted_sway}pp` : '±0pp'}
          </span>
          <span className="text-[10px] font-mono text-surface-600">
            {pred.confidence}% confident
          </span>
        </div>
      </div>
      {pred.resolved_at && pred.clout_earned > 0 && (
        <div className="flex items-center gap-1 text-xs font-mono font-semibold text-gold flex-shrink-0">
          <Coins className="h-3.5 w-3.5" />
          +{pred.clout_earned}
        </div>
      )}
    </motion.div>
  )
}

// ─── Consensus bar ────────────────────────────────────────────────────────────

function ConsensusBar({ forPct, againstPct, tiePct }: { forPct: number; againstPct: number; tiePct: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-for-400 w-16">FOR {forPct}%</span>
        <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-surface-300/30">
          {forPct > 0 && (
            <div className="bg-for-600 transition-all" style={{ width: `${forPct}%` }} />
          )}
          {tiePct > 0 && (
            <div className="bg-surface-400 transition-all" style={{ width: `${tiePct}%` }} />
          )}
          {againstPct > 0 && (
            <div className="bg-against-600 transition-all" style={{ width: `${againstPct}%` }} />
          )}
        </div>
        <span className="text-against-400 w-20 text-right">AGAINST {againstPct}%</span>
      </div>
      {tiePct > 0 && (
        <p className="text-[10px] font-mono text-surface-600 text-center">
          {tiePct}% predict a tie
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DebatePredictionsClient({ debateId }: { debateId: string }) {
  const params = useParams() as { id: string }
  const id = debateId || params.id

  const [data, setData] = useState<DebatePredictionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasAuth, setHasAuth] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/debates/${id}/predictions`)
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    load()
    // Check auth status for form display
    fetch('/api/me/profile')
      .then((r) => { if (r.ok) setHasAuth(true) })
      .catch(() => {})
  }, [load])

  function handlePredictionSubmit(pred: DebatePrediction) {
    if (!data) return
    const exists = data.predictions.some((p) => p.user_id === pred.user_id)
    const newPreds = exists
      ? data.predictions.map((p) => (p.user_id === pred.user_id ? pred : p))
      : [pred, ...data.predictions]
    const total = newPreds.length
    const forCount = newPreds.filter((p) => p.predicted_winner === 'for').length
    const againstCount = newPreds.filter((p) => p.predicted_winner === 'against').length
    const tieCount = newPreds.filter((p) => p.predicted_winner === 'tie').length
    setData({
      ...data,
      predictions: newPreds,
      my_prediction: pred,
      total,
      stats: {
        ...data.stats,
        total,
        for_pct: total > 0 ? Math.round((forCount / total) * 100) : 0,
        against_pct: total > 0 ? Math.round((againstCount / total) * 100) : 0,
        tie_pct: total > 0 ? Math.round((tieCount / total) * 100) : 0,
      },
    })
  }

  const debate = data?.debate
  const isScheduled = debate?.status === 'scheduled'
  const isEnded = debate?.status === 'ended'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-5">
        {/* Back nav */}
        <div className="flex items-center gap-3">
          <Link
            href={`/debate/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to debate"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-mono text-surface-500">Debate</p>
            {loading ? (
              <Skeleton className="h-4 w-48 mt-0.5" />
            ) : (
              <p className="text-sm font-semibold text-white truncate">{debate?.title}</p>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-purple/20 bg-purple/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-purple/20 flex items-center justify-center">
              <BarChart2 className="h-5 w-5 text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white font-mono">
                Debate Predictions
              </h1>
              {loading ? (
                <Skeleton className="h-3 w-56 mt-1" />
              ) : debate ? (
                <p className="text-xs font-mono text-surface-500 mt-0.5 line-clamp-2">
                  {debate.topic_statement}
                </p>
              ) : null}
            </div>
          </div>

          {/* Status pills */}
          {!loading && debate && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {isScheduled && (
                <Badge variant="status" className="bg-for-500/20 text-for-300 border-for-500/30">
                  Scheduled · starts in {timeUntil(debate.scheduled_at)}
                </Badge>
              )}
              {debate.status === 'live' && (
                <Badge variant="status" className="bg-against-500/20 text-against-300 border-against-500/30 animate-pulse">
                  Live now
                </Badge>
              )}
              {isEnded && (
                <Badge variant="status" className="bg-gold/20 text-gold border-gold/30">
                  Ended — predictions resolved
                </Badge>
              )}
              <Badge variant="status" className="bg-surface-300/40 text-surface-500 border-surface-400/30">
                <Users className="h-2.5 w-2.5 mr-1" />
                {data?.total ?? 0} prediction{(data?.total ?? 0) !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Aggregate stats */}
            {data.total > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white font-mono">Community Forecast</h2>
                  <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                    aria-label="Refresh predictions"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                  </button>
                </div>

                {/* Winner consensus bar */}
                <ConsensusBar
                  forPct={data.stats.for_pct}
                  againstPct={data.stats.against_pct}
                  tiePct={data.stats.tie_pct}
                />

                {/* Avg sway + confidence */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-200/50 border border-surface-300/50 p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {data.stats.avg_sway > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                      ) : data.stats.avg_sway < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5 text-against-400" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-surface-500" />
                      )}
                      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                        Avg sway forecast
                      </span>
                    </div>
                    <span className={cn(
                      'text-xl font-bold font-mono tabular-nums',
                      data.stats.avg_sway > 0 ? 'text-for-400' : data.stats.avg_sway < 0 ? 'text-against-400' : 'text-surface-500'
                    )}>
                      {data.stats.avg_sway > 0 ? `+${data.stats.avg_sway}` : data.stats.avg_sway}pp
                    </span>
                  </div>
                  <div className="rounded-xl bg-surface-200/50 border border-surface-300/50 p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Zap className="h-3.5 w-3.5 text-gold" />
                      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                        Avg confidence
                      </span>
                    </div>
                    <span className={cn(
                      'text-xl font-bold font-mono tabular-nums',
                      data.stats.avg_confidence >= 70 ? 'text-gold' : 'text-white'
                    )}>
                      {data.stats.avg_confidence}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Your prediction / prediction form */}
            {(isScheduled || data.my_prediction) && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <h2 className="text-sm font-semibold text-white font-mono mb-4">
                  {data.my_prediction ? 'Your Prediction' : 'Place Your Prediction'}
                </h2>

                {!hasAuth ? (
                  <div className="text-center py-4">
                    <p className="text-sm font-mono text-surface-500 mb-3">
                      Sign in to place a prediction
                    </p>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/80 hover:bg-purple text-white text-sm font-mono font-semibold transition-colors"
                    >
                      Sign in
                    </Link>
                  </div>
                ) : isScheduled ? (
                  <PredictionForm
                    debateId={id}
                    myPrediction={data.my_prediction}
                    onSubmit={handlePredictionSubmit}
                  />
                ) : data.my_prediction ? (
                  /* Show their prediction (read-only, post-debate) */
                  <PredictionCard pred={data.my_prediction} />
                ) : null}
              </div>
            )}

            {/* Quick link to debate */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/debate/${id}`}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold transition-colors',
                  debate?.status === 'live'
                    ? 'bg-against-600 hover:bg-against-700 text-white'
                    : 'bg-surface-200 hover:bg-surface-300 text-surface-600 hover:text-white border border-surface-300'
                )}
              >
                {debate?.status === 'live' ? (
                  <><Zap className="h-4 w-4" /> Join Live Debate</>
                ) : debate?.status === 'ended' ? (
                  <><ExternalLink className="h-4 w-4" /> View Debate Results</>
                ) : (
                  <><ChevronRight className="h-4 w-4" /> Go to Debate</>
                )}
              </Link>
              {isEnded && (
                <Link
                  href={`/debate/${id}/verdict`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 transition-colors"
                >
                  <Trophy className="h-4 w-4" />
                  Verdict
                </Link>
              )}
            </div>

            {/* Predictions list */}
            {data.predictions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white font-mono">
                    All Predictions
                    <span className="ml-2 text-surface-500 font-normal">({data.total})</span>
                  </h2>
                </div>
                <AnimatePresence initial={false}>
                  {data.predictions.map((pred) => (
                    <PredictionCard key={pred.id} pred={pred} />
                  ))}
                </AnimatePresence>
              </div>
            ) : !isScheduled ? (
              <EmptyState
                icon={BarChart2}
                title="No predictions yet"
                description="Be the first to call this debate's outcome."
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={BarChart2}
            title="Debate not found"
            description="This debate may have been removed or the link is incorrect."
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
