'use client'

/**
 * /topic/[id]/predictions — Topic Prediction Market
 *
 * A dedicated prediction market for a single topic. Shows:
 *   - Community consensus gauge (% predicting law vs. fail)
 *   - Confidence distribution histogram
 *   - Individual predictor profiles and reasoning
 *   - User's own prediction form (make or update)
 *
 * Distinct from /predictions (global market across all topics).
 * This is the deep-dive view for one specific debate.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Coins,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TopicPredictionsResponse,
  TopicPredictor,
  ConfidenceBucket,
} from '@/app/api/topics/[id]/predictions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting',
  law: 'LAW', failed: 'Failed',
}
const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
}

// ─── ConsensusGauge ───────────────────────────────────────────────────────────

function ConsensusGauge({ lawConf }: { lawConf: number }) {
  const failConf = 100 - lawConf
  const isLaw = lawConf >= 65
  const isContest = lawConf >= 40 && lawConf < 65
  const barColor = isLaw ? 'bg-emerald' : isContest ? 'bg-gold' : 'bg-against-500'
  const textColor = isLaw ? 'text-emerald' : isContest ? 'text-gold' : 'text-against-400'
  const label = isLaw ? 'Likely Law' : isContest ? 'Contested' : 'Likely to Fail'

  return (
    <div className="flex flex-col gap-3">
      {/* Big numbers */}
      <div className="flex items-end justify-between gap-4">
        <div className="text-center">
          <div className={cn('text-4xl font-mono font-black tabular-nums', textColor)}>
            {lawConf}%
          </div>
          <div className="text-xs font-mono text-surface-500 mt-0.5 uppercase tracking-wider">
            predict law
          </div>
        </div>
        <div className={cn('text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full', textColor,
          isLaw ? 'bg-emerald/10' : isContest ? 'bg-gold/10' : 'bg-against-500/10'
        )}>
          {label}
        </div>
        <div className="text-center">
          <div className="text-4xl font-mono font-black tabular-nums text-against-400">
            {failConf}%
          </div>
          <div className="text-xs font-mono text-surface-500 mt-0.5 uppercase tracking-wider">
            predict fail
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-against-500/20">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${lawConf}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] font-mono text-surface-500 uppercase tracking-wider">
        <span className="flex items-center gap-1">
          <Gavel className="h-2.5 w-2.5" /> Become Law
        </span>
        <span className="flex items-center gap-1">
          Fail <XCircle className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  )
}

// ─── DistributionBar ─────────────────────────────────────────────────────────

function DistributionChart({ buckets }: { buckets: ConfidenceBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.law_count + b.fail_count), 1)

  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
        Confidence Distribution
      </p>
      <div className="space-y-1.5">
        {buckets.map((bucket) => {
          const total = bucket.law_count + bucket.fail_count
          const lawW = total > 0 ? (bucket.law_count / maxCount) * 100 : 0
          const failW = total > 0 ? (bucket.fail_count / maxCount) * 100 : 0

          return (
            <div key={bucket.label} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-surface-500 w-14 text-right flex-shrink-0">
                {bucket.label}%
              </span>
              <div className="flex-1 flex items-center gap-0.5 h-4">
                {lawW > 0 && (
                  <div
                    className="h-full rounded-l bg-emerald/60"
                    style={{ width: `${lawW}%` }}
                    title={`${bucket.law_count} predicting law`}
                  />
                )}
                {failW > 0 && (
                  <div
                    className="h-full rounded-r bg-against-500/60"
                    style={{ width: `${failW}%` }}
                    title={`${bucket.fail_count} predicting fail`}
                  />
                )}
                {total === 0 && (
                  <div className="h-full w-full rounded bg-surface-300/30" />
                )}
              </div>
              <span className="text-[10px] font-mono text-surface-500 w-6 text-right flex-shrink-0">
                {total}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald/60" />
          <span className="text-[10px] font-mono text-surface-500">Predicting law</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-against-500/60" />
          <span className="text-[10px] font-mono text-surface-500">Predicting fail</span>
        </div>
      </div>
    </div>
  )
}

// ─── PredictorRow ─────────────────────────────────────────────────────────────

function PredictorRow({ predictor, rank }: { predictor: TopicPredictor; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'flex gap-3 p-3 rounded-xl border transition-colors',
        predictor.predicted_law
          ? 'bg-emerald/5 border-emerald/20 hover:border-emerald/30'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/30'
      )}
    >
      <Link href={`/profile/${predictor.username}`} className="flex-shrink-0">
        <Avatar
          src={predictor.avatar_url}
          username={predictor.username}
          size="sm"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${predictor.username}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors"
          >
            {predictor.display_name ?? predictor.username}
          </Link>
          <Badge variant={predictor.role === 'senator' ? 'law' : 'proposed'} size="xs">
            {predictor.role}
          </Badge>
          {predictor.correct !== null && (
            predictor.correct
              ? <span className="text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Correct
                </span>
              : <span className="text-[10px] font-mono text-against-400 bg-against-500/10 border border-against-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <XCircle className="h-2.5 w-2.5" /> Wrong
                </span>
          )}
        </div>

        {predictor.reasoning && (
          <p className="text-xs text-surface-400 mt-1 leading-relaxed line-clamp-2">
            &ldquo;{predictor.reasoning}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <div className={cn(
            'flex items-center gap-1 text-[10px] font-mono font-semibold',
            predictor.predicted_law ? 'text-emerald' : 'text-against-400'
          )}>
            {predictor.predicted_law
              ? <><Gavel className="h-2.5 w-2.5" /> Predicts LAW</>
              : <><XCircle className="h-2.5 w-2.5" /> Predicts FAIL</>
            }
          </div>
          <span className="text-[10px] font-mono text-surface-500">
            {predictor.confidence}% confidence
          </span>
          <span className="text-[10px] font-mono text-surface-600">
            {relativeTime(predictor.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── PredictionForm ───────────────────────────────────────────────────────────

function PredictionForm({
  topicId,
  isResolved,
  existing,
  onSaved,
}: {
  topicId: string
  isResolved: boolean
  existing: TopicPredictionsResponse['user_prediction']
  onSaved: () => void
}) {
  const [predictedLaw, setPredictedLaw] = useState<boolean | null>(existing?.predicted_law ?? null)
  const [confidence, setConfidence] = useState(existing?.confidence ?? 70)
  const [reasoning, setReasoning] = useState(existing?.reasoning ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const canSave = predictedLaw !== null && !isResolved
  const charCount = reasoning.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predicted_law: predictedLaw, confidence, reasoning }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (isResolved) {
    return (
      <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-4 text-center">
        <p className="text-sm font-mono text-surface-500">
          This topic has resolved — predictions are closed.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
        {existing ? 'Update your prediction' : 'Make your prediction'}
      </p>

      {/* Outcome choice */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPredictedLaw(true)}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-mono font-semibold transition-all',
            predictedLaw === true
              ? 'bg-emerald/15 border-emerald text-emerald'
              : 'bg-surface-200/50 border-surface-300 text-surface-500 hover:border-emerald/40 hover:text-emerald/70'
          )}
        >
          <Gavel className="h-4 w-4" />
          Will Become Law
        </button>
        <button
          type="button"
          onClick={() => setPredictedLaw(false)}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-mono font-semibold transition-all',
            predictedLaw === false
              ? 'bg-against-500/15 border-against-500 text-against-400'
              : 'bg-surface-200/50 border-surface-300 text-surface-500 hover:border-against-500/40 hover:text-against-400/70'
          )}
        >
          <XCircle className="h-4 w-4" />
          Will Fail
        </button>
      </div>

      {/* Confidence slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-mono text-surface-400">
            Confidence
          </label>
          <span className={cn(
            'text-sm font-mono font-bold',
            confidence >= 80 ? 'text-emerald' : confidence >= 60 ? 'text-gold' : 'text-surface-400'
          )}>
            {confidence}%
          </span>
        </div>
        <input
          type="range"
          min={51}
          max={100}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full accent-for-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono text-surface-600">
          <span>Lean (51%)</span>
          <span>Certain (100%)</span>
        </div>
      </div>

      {/* Reasoning */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-mono text-surface-400">
            Reasoning <span className="text-surface-600">(optional)</span>
          </label>
          <span className={cn('text-[10px] font-mono', charCount > 260 ? 'text-against-400' : 'text-surface-600')}>
            {charCount}/280
          </span>
        </div>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value.slice(0, 280))}
          placeholder="Why do you think this will or won't become law?"
          rows={3}
          className={cn(
            'w-full rounded-xl bg-surface-200 border px-3 py-2.5 text-sm font-mono text-white',
            'placeholder-surface-500 focus:outline-none transition-colors resize-none',
            'focus:border-for-500/40 focus:bg-surface-300/50 border-surface-300',
          )}
        />
      </div>

      {error && (
        <p className="text-xs font-mono text-against-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSave || saving}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
          'text-sm font-mono font-semibold transition-all',
          canSave && !saving
            ? 'bg-for-600 hover:bg-for-500 text-white'
            : 'bg-surface-300 text-surface-600 cursor-not-allowed'
        )}
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
        ) : saved ? (
          <><CheckCircle2 className="h-4 w-4 text-emerald" /> Prediction saved!</>
        ) : (
          <>{existing ? 'Update prediction' : 'Submit prediction'} <ArrowRight className="h-4 w-4" /></>
        )}
      </button>
    </form>
  )
}

// ─── PredictorsSkeleton ───────────────────────────────────────────────────────

function PredictorsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl border border-surface-300 bg-surface-200/30">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TopicPredictionsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<TopicPredictionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [filter, setFilter] = useState<'all' | 'law' | 'fail' | 'reasoned'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/predictions`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 404) { router.replace('/predictions'); return }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = (await res.json()) as TopicPredictionsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    // Check auth status
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
    })
    load()
  }, [load])

  const filteredPredictors = data?.predictors.filter((p) => {
    if (filter === 'law') return p.predicted_law
    if (filter === 'fail') return !p.predicted_law
    if (filter === 'reasoned') return p.reasoning !== null
    return true
  }) ?? []

  const topic = data?.topic
  const market = data?.market

  const isResolved = topic?.status === 'law' || topic?.status === 'failed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-6">

        {/* ── Back + Header ─────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href={topic ? `/topic/${topic.id}` : '/predictions'}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-5 w-full rounded" />
              </div>
            ) : topic ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="xs">
                    {STATUS_LABEL[topic.status] ?? topic.status}
                  </Badge>
                  {topic.category && (
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                      {topic.category}
                    </span>
                  )}
                </div>
                <h1 className="text-base font-mono font-semibold text-white leading-snug">
                  {topic.statement}
                </h1>
              </>
            ) : null}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Page title ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
            <Target className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h2 className="font-mono text-xl font-bold text-white">Prediction Market</h2>
            {market && (
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                {market.total_predictions} prediction{market.total_predictions !== 1 ? 's' : ''} ·{' '}
                {market.law_predictors} law · {market.fail_predictors} fail
              </p>
            )}
          </div>
          <Link
            href="/predictions"
            className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            All markets <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button onClick={load} className="mt-2 text-xs font-mono text-surface-500 hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}

        {/* ── Consensus Gauge ───────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
          ) : market ? (
            <ConsensusGauge lawConf={market.law_confidence} />
          ) : (
            <EmptyState
              icon={Target}
              title="No predictions yet"
              description="Be the first to predict whether this debate will become law."
              size="sm"
            />
          )}
        </div>

        {/* ── Stats row ─────────────────────────────────────────────── */}
        {!loading && market && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/10 border border-purple/20 mx-auto mb-1.5">
                <Users className="h-3.5 w-3.5 text-purple" />
              </div>
              <div className="text-xl font-mono font-black text-white">{market.total_predictions}</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Predictors</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald/10 border border-emerald/20 mx-auto mb-1.5">
                <Gavel className="h-3.5 w-3.5 text-emerald" />
              </div>
              <div className="text-xl font-mono font-black text-emerald">{market.avg_law_confidence}%</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Avg confidence (law)</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-against-500/10 border border-against-500/20 mx-auto mb-1.5">
                <XCircle className="h-3.5 w-3.5 text-against-400" />
              </div>
              <div className="text-xl font-mono font-black text-against-400">{market.avg_fail_confidence}%</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Avg confidence (fail)</div>
            </div>
          </div>
        )}

        {/* ── Distribution ──────────────────────────────────────────── */}
        {!loading && data && market && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <DistributionChart buckets={data.distribution} />
          </div>
        )}

        {/* ── Vote context ──────────────────────────────────────────── */}
        {!loading && topic && (
          <div className="rounded-xl bg-surface-200/40 border border-surface-300 p-4">
            <div className="flex items-center gap-3 mb-3">
              <BarChart2 className="h-4 w-4 text-surface-500" />
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Current Vote Standing</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-for-400 font-semibold">FOR {topic.blue_pct}%</span>
                  <span className="text-against-400 font-semibold">AGAINST {100 - topic.blue_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-against-500/20 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all"
                    style={{ width: `${topic.blue_pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-mono font-bold text-white">{topic.total_votes.toLocaleString()}</div>
                <div className="text-[10px] font-mono text-surface-500">votes</div>
              </div>
            </div>
            <Link
              href={`/topic/${topic.id}`}
              className="mt-3 flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              See full debate <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* ── Prediction Form ───────────────────────────────────────── */}
        {!loading && topic && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            {authed === false ? (
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 mx-auto">
                  <Target className="h-5 w-5 text-purple" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white">Make your prediction</p>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    Sign in to predict whether this topic will become law and earn clout for accuracy.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                >
                  Sign in to predict
                </Link>
              </div>
            ) : (
              <PredictionForm
                topicId={id}
                isResolved={isResolved}
                existing={data?.user_prediction ?? null}
                onSaved={load}
              />
            )}
          </div>
        )}

        {/* ── User's existing prediction ────────────────────────────── */}
        {!loading && data?.user_prediction && (
          <div className={cn(
            'rounded-xl border p-4',
            data.user_prediction.predicted_law
              ? 'bg-emerald/5 border-emerald/30'
              : 'bg-against-500/5 border-against-500/30'
          )}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">
                  Your prediction
                </p>
                <div className={cn(
                  'flex items-center gap-2 text-sm font-mono font-bold',
                  data.user_prediction.predicted_law ? 'text-emerald' : 'text-against-400'
                )}>
                  {data.user_prediction.predicted_law
                    ? <><Gavel className="h-4 w-4" /> Will become LAW</>
                    : <><XCircle className="h-4 w-4" /> Will FAIL</>
                  }
                  <span className="font-normal text-surface-500">
                    · {data.user_prediction.confidence}% confidence
                  </span>
                </div>
                {data.user_prediction.reasoning && (
                  <p className="text-xs text-surface-400 mt-1.5 leading-relaxed">
                    &ldquo;{data.user_prediction.reasoning}&rdquo;
                  </p>
                )}
              </div>
              {data.user_prediction.correct !== null && (
                <div className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono font-semibold',
                  data.user_prediction.correct
                    ? 'bg-emerald/15 text-emerald'
                    : 'bg-against-500/15 text-against-400'
                )}>
                  {data.user_prediction.correct
                    ? <><CheckCircle2 className="h-3 w-3" /> Correct</>
                    : <><XCircle className="h-3 w-3" /> Wrong</>
                  }
                </div>
              )}
            </div>
            {data.user_prediction.clout_earned > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-gold">
                <Coins className="h-3 w-3" />
                +{data.user_prediction.clout_earned} clout earned
              </div>
            )}
          </div>
        )}

        {/* ── Predictors ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              Predictors
              {data && (
                <span className="text-surface-500 font-normal">({filteredPredictors.length})</span>
              )}
            </h3>

            {/* Filters */}
            <div className="flex items-center gap-1.5">
              {(['all', 'law', 'fail', 'reasoned'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors',
                    filter === f
                      ? f === 'law'
                        ? 'bg-emerald/15 text-emerald border border-emerald/30'
                        : f === 'fail'
                        ? 'bg-against-500/15 text-against-400 border border-against-500/30'
                        : 'bg-for-500/15 text-for-400 border border-for-500/30'
                      : 'bg-surface-200 text-surface-500 hover:text-white border border-transparent'
                  )}
                >
                  {f === 'reasoned' ? 'w/ reason' : f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <PredictorsSkeleton />
          ) : filteredPredictors.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filter === 'all' ? 'No predictions yet' : 'No predictors match this filter'}
              description={filter === 'all' ? 'Be the first to stake your forecast on this debate.' : 'Try a different filter.'}
              size="sm"
            />
          ) : (
            <div className="space-y-2">
              {filteredPredictors.map((p, i) => (
                <PredictorRow key={p.user_id} predictor={p} rank={i} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer link ───────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-2">
          <Link
            href="/predictions"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            All prediction markets
          </Link>
          <span className="text-surface-600">·</span>
          <Link
            href="/prescient"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
          >
            <Trophy className="h-3.5 w-3.5" />
            Top predictors
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
