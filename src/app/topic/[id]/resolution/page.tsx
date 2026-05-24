'use client'

/**
 * /topic/[id]/resolution — Resolution Criteria
 *
 * Shows the explicit path a topic must travel to become law (or fail):
 *   • Current status in the pipeline with progress indicators
 *   • Vote thresholds and how far the current debate is from each one
 *   • Time remaining in the voting phase (if applicable)
 *   • Community predictions (% who think it will pass)
 *   • Historical context: category law rate and similar outcomes
 *
 * Distinct from:
 *   /topic/[id]/stats        — raw vote/argument statistics
 *   /topic/[id]/momentum     — vote velocity and trend chart
 *   /topic/[id]/predictions  — individual predictor profiles
 *
 * This is the "resolution criteria" page — the civic equivalent of a
 * prediction market's resolution criteria section.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  Info,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ResolutionData,
  ResolutionMilestone,
  SimilarOutcome,
} from '@/app/api/topics/[id]/resolution/route'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  proposed: { label: 'Proposed', color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' },
  active:   { label: 'Active',   color: 'text-for-400',    bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  voting:   { label: 'Voting',   color: 'text-purple',     bg: 'bg-purple/10',       border: 'border-purple/30' },
  law:      { label: 'LAW',      color: 'text-gold',       bg: 'bg-gold/10',         border: 'border-gold/30' },
  failed:   { label: 'Failed',   color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  continued:{ label: 'Continued',color: 'text-purple',     bg: 'bg-purple/10',       border: 'border-purple/30' },
  archived: { label: 'Archived', color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' },
}

// ─── Countdown helpers ────────────────────────────────────────────────────────

function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!endsAt) return
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Voting ended'); setExpired(true); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      if (h > 48) setRemaining(`${Math.ceil(h / 24)} days left`)
      else if (h > 0) setRemaining(`${h}h ${m}m left`)
      else if (m > 0) setRemaining(`${m}m ${s}s left`)
      else setRemaining(`${s}s left`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [endsAt])

  return { remaining, expired }
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  return `${m}mo ago`
}

// ─── Components ───────────────────────────────────────────────────────────────

function VoteBar({ forPct, className }: { forPct: number; className?: string }) {
  const red = 100 - forPct
  return (
    <div className={cn('flex h-2 rounded-full overflow-hidden bg-surface-300', className)}>
      <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
      <div className="h-full bg-against-500 rounded-r-full" style={{ width: `${red}%` }} />
    </div>
  )
}

function ThresholdBar({
  current,
  threshold,
  label,
  className,
}: {
  current: number
  threshold: number
  label: string
  className?: string
}) {
  const pct = Math.min(100, (current / threshold) * 100)
  const reached = current >= threshold
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-surface-500">{label}</span>
        <span className={cn('font-mono font-medium', reached ? 'text-emerald' : 'text-gold')}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden relative">
        <motion.div
          className={cn('h-full rounded-full', reached ? 'bg-emerald' : 'bg-gold')}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Threshold marker at 100% */}
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/30" />
      </div>
      <div className="flex items-center justify-between text-xs text-surface-600">
        <span>{current.toLocaleString()} / {threshold.toLocaleString()}</span>
        {!reached && (
          <span className="text-gold">{(threshold - current).toLocaleString()} more needed</span>
        )}
        {reached && <span className="text-emerald">Threshold reached</span>}
      </div>
    </div>
  )
}

function MilestoneStep({
  milestone,
  index,
  total,
}: {
  milestone: ResolutionMilestone
  index: number
  total: number
}) {
  const isLast = index === total - 1
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-full border-2 flex-shrink-0 transition-colors',
            milestone.current
              ? 'bg-for-500 border-for-500 text-white'
              : milestone.reached
              ? 'bg-emerald/20 border-emerald text-emerald'
              : 'bg-surface-200 border-surface-400 text-surface-500'
          )}
        >
          {milestone.reached && !milestone.current ? (
            <Check className="h-4 w-4" />
          ) : (
            <span className="text-xs font-bold">{index + 1}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              'w-0.5 flex-1 min-h-6 mt-1',
              milestone.reached ? 'bg-emerald/40' : 'bg-surface-300'
            )}
          />
        )}
      </div>
      <div className={cn('pb-4', isLast && 'pb-0')}>
        <p className={cn('text-sm font-semibold', milestone.current ? 'text-white' : milestone.reached ? 'text-emerald' : 'text-surface-500')}>
          {milestone.label}
        </p>
        <p className="text-xs text-surface-500 mt-0.5">{milestone.sublabel}</p>
      </div>
    </div>
  )
}

function SimilarOutcomeCard({ outcome }: { outcome: SimilarOutcome }) {
  const isLaw = outcome.outcome === 'law'
  const forPct = Math.round(outcome.blue_pct)
  const href = isLaw ? `/law/${outcome.id}` : `/topic/${outcome.id}`
  return (
    <Link
      href={href}
      className="block rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors group"
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className={cn(
            'flex-shrink-0 mt-0.5 h-4 w-4 rounded-full flex items-center justify-center',
            isLaw ? 'bg-gold/20' : 'bg-against-500/20'
          )}
        >
          {isLaw ? (
            <Gavel className="h-2.5 w-2.5 text-gold" />
          ) : (
            <XCircle className="h-2.5 w-2.5 text-against-400" />
          )}
        </span>
        <p className="text-xs text-surface-700 leading-tight line-clamp-2 group-hover:text-white transition-colors">
          {outcome.statement}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <span className={isLaw ? 'text-for-400' : 'text-against-400'}>{forPct}% FOR</span>
        <span>·</span>
        <span>{outcome.total_votes.toLocaleString()} votes</span>
        {outcome.days_active > 0 && (
          <>
            <span>·</span>
            <span>{outcome.days_active}d</span>
          </>
        )}
        <span className="ml-auto">{relTime(outcome.resolved_at)}</span>
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResolutionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ResolutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { remaining: countdown, expired: votingExpired } = useCountdown(
    data?.votingEndsAt ?? null
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/resolution`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load resolution data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
          <Skeleton className="h-8 w-48" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-12 pb-24 text-center">
          <p className="text-surface-500 mb-4">{error ?? 'Topic not found.'}</p>
          <button onClick={fetchData} className="text-for-400 text-sm flex items-center gap-1 mx-auto hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, lawThreshold, supportsNeeded, votesNeededForLaw, daysActive,
    milestones, lawProbability, totalPredictors, categoryLawRate, categoryMedianDays,
    recentLaws, recentFailed } = data

  const sc = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const isConcluded = ['law', 'failed', 'archived'].includes(topic.status)

  // FOR side bar with threshold line
  const atLaw = forPct >= lawThreshold
  const atLawAgainst = againstPct >= lawThreshold

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 hover:bg-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30">
              <Gavel className="h-4 w-4 text-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Resolution Criteria</p>
              <p className="text-xs text-surface-500">Path to law status</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-surface-500" />
          </button>
        </div>

        {/* Topic card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border', sc.color, sc.bg, sc.border)}>
              <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', topic.status === 'voting' && 'animate-pulse bg-purple', topic.status === 'active' && 'bg-for-500', topic.status === 'law' && 'bg-gold', topic.status === 'failed' && 'bg-against-500', topic.status === 'proposed' && 'bg-surface-400')} />
              {sc.label}
            </span>
            {topic.category && (
              <Badge variant="proposed" size="sm">{topic.category}</Badge>
            )}
            {topic.scope && topic.scope !== 'Global' && (
              <Badge variant="proposed" size="sm">{topic.scope}</Badge>
            )}
          </div>

          <Link
            href={`/topic/${topic.id}`}
            className="block text-sm font-medium text-white leading-snug hover:text-for-300 transition-colors"
          >
            {topic.statement}
            <ExternalLink className="inline-block ml-1 h-3 w-3 text-surface-500" />
          </Link>

          {/* Vote split */}
          <div className="space-y-2">
            <div className="relative">
              <VoteBar forPct={forPct} className="h-3" />
              {/* Threshold markers */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gold/60"
                style={{ left: `${lawThreshold}%` }}
                title={`FOR threshold: ${lawThreshold}%`}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gold/60"
                style={{ right: `${lawThreshold - 1}%` }}
                title={`AGAINST threshold: ${lawThreshold}%`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={cn('font-semibold', atLaw ? 'text-for-400' : 'text-for-500')}>{forPct}% FOR</span>
              <span className="text-surface-500 font-mono">{topic.total_votes.toLocaleString()} votes</span>
              <span className={cn('font-semibold', atLawAgainst ? 'text-against-400' : 'text-against-500')}>{againstPct}% AGAINST</span>
            </div>
            <p className="text-[11px] text-surface-600 text-center">
              Gold lines mark the {lawThreshold}% supermajority threshold on each side
            </p>
          </div>
        </div>

        {/* Status-specific progress */}
        <AnimatePresence mode="wait">
          {topic.status === 'proposed' && (
            <motion.div
              key="proposed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-surface-500" />
                <p className="text-sm font-semibold text-white">Activation Progress</p>
              </div>
              <ThresholdBar
                current={topic.support_count}
                threshold={topic.activation_threshold}
                label={`Need ${topic.activation_threshold.toLocaleString()} supporters to become Active`}
              />
              {supportsNeeded !== null && supportsNeeded > 0 && (
                <p className="text-xs text-surface-500 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                  Once {supportsNeeded.toLocaleString()} more citizens support this topic, it enters the Active debate phase.
                </p>
              )}
              {supportsNeeded === 0 && (
                <p className="text-xs text-emerald flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                  Support threshold reached — pending activation.
                </p>
              )}
            </motion.div>
          )}

          {(topic.status === 'active' || topic.status === 'voting' || topic.status === 'continued') && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
            >
              {/* Voting countdown */}
              {topic.status === 'voting' && countdown && (
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border',
                  votingExpired
                    ? 'bg-surface-200 border-surface-400 text-surface-500'
                    : 'bg-purple/10 border-purple/30 text-purple'
                )}>
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-semibold font-mono">{countdown}</span>
                  {!votingExpired && (
                    <span className="text-xs text-surface-500 ml-auto">until voting closes</span>
                  )}
                </div>
              )}

              {/* FOR side progress toward law */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-for-400" />
                  <p className="text-sm font-semibold text-white">FOR Progress to Law</p>
                  {atLaw && (
                    <span className="ml-auto text-xs text-emerald flex items-center gap-1">
                      <Check className="h-3 w-3" /> Supermajority reached
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', atLaw ? 'bg-emerald' : 'bg-for-500')}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (forPct / lawThreshold) * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-500">
                  <span>{forPct}% FOR</span>
                  <span className="text-gold font-mono">{lawThreshold}% needed</span>
                </div>
              </div>

              {/* AGAINST side progress toward law */}
              <div className="space-y-3 pt-1 border-t border-surface-300">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-against-400" />
                  <p className="text-sm font-semibold text-white">AGAINST Progress to Law</p>
                  {atLawAgainst && (
                    <span className="ml-auto text-xs text-emerald flex items-center gap-1">
                      <Check className="h-3 w-3" /> Supermajority reached
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', atLawAgainst ? 'bg-emerald' : 'bg-against-500')}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (againstPct / lawThreshold) * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-500">
                  <span>{againstPct}% AGAINST</span>
                  <span className="text-gold font-mono">{lawThreshold}% needed</span>
                </div>
              </div>

              {/* Votes needed estimate */}
              {votesNeededForLaw !== null && votesNeededForLaw > 0 && !atLaw && !atLawAgainst && (
                <p className="text-xs text-surface-500 flex items-start gap-1.5 pt-1">
                  <Info className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                  The FOR side needs approximately{' '}
                  <strong className="text-gold">{votesNeededForLaw.toLocaleString()} more votes</strong>{' '}
                  (assuming current AGAINST stays fixed) to reach the {lawThreshold}% supermajority and pass into law.
                </p>
              )}

              {(atLaw || atLawAgainst) && (
                <p className="text-xs text-emerald flex items-center gap-1.5">
                  <Gavel className="h-3.5 w-3.5 flex-shrink-0" />
                  The {atLaw ? 'FOR' : 'AGAINST'} side has reached the supermajority threshold.
                  This topic will be processed into law at the next resolution cycle.
                </p>
              )}
            </motion.div>
          )}

          {isConcluded && (
            <motion.div
              key="concluded"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl p-5 border',
                topic.status === 'law'
                  ? 'bg-gold/5 border-gold/30'
                  : 'bg-against-500/5 border-against-500/30'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {topic.status === 'law' ? (
                  <Gavel className="h-5 w-5 text-gold" />
                ) : (
                  <XCircle className="h-5 w-5 text-against-400" />
                )}
                <p className={cn('text-sm font-semibold', topic.status === 'law' ? 'text-gold' : 'text-against-400')}>
                  {topic.status === 'law' ? 'Established as Law' : 'Failed to Pass'}
                </p>
              </div>
              <p className="text-xs text-surface-500">
                Final result: <strong className={topic.status === 'law' ? 'text-for-400' : 'text-against-400'}>{forPct}% FOR</strong>
                {' / '}
                <strong className={topic.status === 'law' ? 'text-against-500' : 'text-against-400'}>{againstPct}% AGAINST</strong>
                {' · '}
                {topic.total_votes.toLocaleString()} total votes
                {daysActive > 0 && ` · ${daysActive} days from proposal to outcome`}
              </p>
              {topic.status === 'law' && (
                <Link
                  href={`/law/${topic.id}`}
                  className="inline-flex items-center gap-1 mt-3 text-xs text-gold hover:underline"
                >
                  View Law Document <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* How resolution works */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-gold" />
            <p className="text-sm font-semibold text-white">How Resolution Works</p>
          </div>
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <MilestoneStep key={i} milestone={m} index={i} total={milestones.length} />
            ))}
          </div>
          <div className="rounded-xl bg-surface-200 p-3 space-y-1.5 text-xs text-surface-500">
            <p className="font-medium text-surface-400">Resolution Rules</p>
            <p>• A topic reaches <strong className="text-gold">Law</strong> when {lawThreshold}%+ vote FOR <em>or</em> AGAINST (supermajority on either side becomes a law — either way, the community has spoken clearly)</p>
            <p>• If neither side reaches {lawThreshold}%, but one side has a simple majority (50%+), the debate may <strong className="text-purple">continue</strong> in a new chain</p>
            <p>• Proposed topics need supporter endorsements to activate — then enter the open debate phase</p>
          </div>
        </div>

        {/* Prediction market signal */}
        {lawProbability !== null && totalPredictors >= 3 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple" />
              <p className="text-sm font-semibold text-white">Community Predictions</p>
              <span className="ml-auto text-xs text-surface-500">{totalPredictors} predictors</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs text-surface-500 mb-1">
                  <span>Predict Law</span>
                  <span>Predict Fail</span>
                </div>
                <div className="h-3 rounded-full bg-surface-300 overflow-hidden flex">
                  <motion.div
                    className="h-full bg-purple rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${lawProbability}%` }}
                    transition={{ duration: 0.8 }}
                  />
                  <motion.div
                    className="h-full bg-against-500 rounded-r-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - lawProbability}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono font-medium">
                  <span className="text-purple">{lawProbability}%</span>
                  <span className="text-against-400">{100 - lawProbability}%</span>
                </div>
              </div>
            </div>
            <Link
              href={`/topic/${id}/predictions`}
              className="flex items-center gap-1 text-xs text-purple hover:underline"
            >
              View all predictions <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Category context stats */}
        {(categoryLawRate !== null || categoryMedianDays !== null) && topic.category && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-for-400" />
              <p className="text-sm font-semibold text-white">{topic.category} Category Context</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {categoryLawRate !== null && (
                <div className="rounded-xl bg-surface-200 p-3 text-center">
                  <p className="text-2xl font-bold text-white font-mono">{categoryLawRate}%</p>
                  <p className="text-xs text-surface-500 mt-0.5">of debates become law</p>
                </div>
              )}
              {categoryMedianDays !== null && (
                <div className="rounded-xl bg-surface-200 p-3 text-center">
                  <p className="text-2xl font-bold text-white font-mono">{categoryMedianDays}d</p>
                  <p className="text-xs text-surface-500 mt-0.5">median days to law</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-surface-500">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              This topic has been active for <strong className="text-surface-400 mx-1">{daysActive} days</strong>
            </div>
          </div>
        )}

        {/* Similar outcomes */}
        {(recentLaws.length > 0 || recentFailed.length > 0) && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-white">Similar Outcomes</p>
              <span className="text-xs text-surface-500 ml-1">in {topic.category ?? 'this category'}</span>
            </div>

            {recentLaws.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gold flex items-center gap-1">
                  <Gavel className="h-3 w-3" /> Recently Passed
                </p>
                {recentLaws.map((o) => (
                  <SimilarOutcomeCard key={o.id} outcome={o} />
                ))}
              </div>
            )}

            {recentFailed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-against-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> Recently Failed
                </p>
                {recentFailed.map((o) => (
                  <SimilarOutcomeCard key={o.id} outcome={o} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick navigation */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/topic/${id}/momentum`}
            className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors group"
          >
            <Zap className="h-4 w-4 text-for-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Vote Momentum</p>
              <p className="text-[11px] text-surface-500">Velocity & trend chart</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto group-hover:text-white transition-colors" />
          </Link>
          <Link
            href={`/topic/${id}/predictions`}
            className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors group"
          >
            <Sparkles className="h-4 w-4 text-purple flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Predictions</p>
              <p className="text-[11px] text-surface-500">Community forecasts</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto group-hover:text-white transition-colors" />
          </Link>
          <Link
            href={`/topic/${id}/stats`}
            className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors group"
          >
            <BarChart2 className="h-4 w-4 text-for-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Full Stats</p>
              <p className="text-[11px] text-surface-500">Detailed analytics</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto group-hover:text-white transition-colors" />
          </Link>
          <Link
            href={`/topic/${id}`}
            className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors group"
          >
            <Scale className="h-4 w-4 text-gold flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Debate</p>
              <p className="text-[11px] text-surface-500">Vote & argue</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto group-hover:text-white transition-colors" />
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
