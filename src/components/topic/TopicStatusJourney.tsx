'use client'

/**
 * TopicStatusJourney
 *
 * A horizontal stepper showing a topic's lifecycle progression:
 *   Proposed → Active → Voting → Law ✓  or  → Failed ✗
 *
 * Each completed / current stage is highlighted with relevant stats
 * (support count, vote totals, current pct, deadline, outcome).
 * Future stages are dimmed. Framer Motion animates the connector fill.
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, Zap, Scale, Gavel, Users } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type TopicStatus =
  | 'proposed'
  | 'active'
  | 'voting'
  | 'law'
  | 'failed'
  | 'continued'
  | 'archived'

interface TopicStatusJourneyProps {
  status: TopicStatus
  supportCount: number
  activationThreshold: number
  totalVotes: number
  bluePct: number
  votingEndsAt: string | null
  createdAt: string
  className?: string
}

// ─── Stage ordering ───────────────────────────────────────────────────────────

type StageId = 'proposed' | 'active' | 'voting' | 'resolved'

const STAGE_ORDER: StageId[] = ['proposed', 'active', 'voting', 'resolved']

function statusToStageIndex(status: TopicStatus): number {
  switch (status) {
    case 'proposed':
      return 0
    case 'active':
      return 1
    case 'voting':
      return 2
    case 'law':
    case 'failed':
    case 'continued':
    case 'archived':
      return 3
    default:
      return 0
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ended'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  const m = Math.floor(diff / 60_000)
  return `${m}m left`
}

// ─── Stage dot ────────────────────────────────────────────────────────────────

function StageDot({
  stageIdx,
  currentIdx,
  status,
}: {
  stageIdx: number
  currentIdx: number
  status: TopicStatus
}) {
  const isPast = stageIdx < currentIdx
  const isCurrent = stageIdx === currentIdx
  const isFuture = stageIdx > currentIdx

  // Resolved stage — law vs. failed
  const isResolved = stageIdx === 3 && (status === 'law' || status === 'failed' || status === 'continued' || status === 'archived')
  const isLaw = status === 'law' || status === 'continued'
  if (isResolved) {
    return (
      <div
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full border-2',
          isLaw
            ? 'border-gold bg-gold/20'
            : 'border-against-500 bg-against-500/20'
        )}
      >
        {isLaw ? (
          <Gavel className="h-4 w-4 text-gold" aria-hidden="true" />
        ) : (
          <XCircle className="h-4 w-4 text-against-400" aria-hidden="true" />
        )}
      </div>
    )
  }

  if (isPast) {
    return (
      <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-for-500 bg-for-500/20">
        <CheckCircle2 className="h-4 w-4 text-for-400" aria-hidden="true" />
      </div>
    )
  }

  if (isCurrent) {
    const icons: Record<StageId, typeof Zap> = {
      proposed: Users,
      active: Zap,
      voting: Scale,
      resolved: Gavel,
    }
    const Icon = icons[STAGE_ORDER[stageIdx]]
    const ringColor =
      stageIdx === 0
        ? 'border-surface-400 bg-surface-300/40'
        : stageIdx === 1
        ? 'border-for-500 bg-for-500/20'
        : stageIdx === 2
        ? 'border-purple bg-purple/20'
        : 'border-gold bg-gold/20'
    const iconColor =
      stageIdx === 0
        ? 'text-surface-500'
        : stageIdx === 1
        ? 'text-for-400'
        : stageIdx === 2
        ? 'text-purple'
        : 'text-gold'

    return (
      <motion.div
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full border-2',
          ringColor
        )}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
      >
        <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
        {/* Ping ring */}
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-20',
            stageIdx === 2 ? 'bg-purple' : 'bg-for-500'
          )}
        />
      </motion.div>
    )
  }

  // Future
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-300 bg-surface-200 opacity-40"
      aria-hidden="true"
    >
      <div className="h-2 w-2 rounded-full bg-surface-400" />
    </div>
  )

  void isFuture
}

// ─── Connector line ───────────────────────────────────────────────────────────

function Connector({
  filled,
  partial,
}: {
  filled: boolean
  partial?: boolean
}) {
  return (
    <div className="relative flex-1 h-0.5 bg-surface-300 mx-1" aria-hidden="true">
      {filled && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: partial ? '50%' : '100%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </div>
  )
}

// ─── Stage label + stat ────────────────────────────────────────────────────────

function StageInfo({
  stageId,
  stageIdx,
  currentIdx,
  status,
  supportCount,
  activationThreshold,
  totalVotes,
  bluePct,
  votingEndsAt,
  createdAt,
}: {
  stageId: StageId
  stageIdx: number
  currentIdx: number
  status: TopicStatus
  supportCount: number
  activationThreshold: number
  totalVotes: number
  bluePct: number
  votingEndsAt: string | null
  createdAt: string
}) {
  const isFuture = stageIdx > currentIdx
  const isCurrent = stageIdx === currentIdx

  const textColor = isFuture
    ? 'text-surface-500 opacity-40'
    : isCurrent
    ? 'text-white'
    : 'text-surface-600'

  const statColor = isFuture
    ? 'text-surface-500 opacity-40'
    : isCurrent
    ? 'text-for-300'
    : 'text-surface-500'

  const LABELS: Record<StageId, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    resolved: status === 'law' || status === 'continued' ? 'Law' : status === 'failed' || status === 'archived' ? 'Failed' : 'Resolved',
  }

  // Per-stage secondary stat
  let stat: string | null = null
  if (stageId === 'proposed') {
    stat = formatDate(createdAt)
  } else if (stageId === 'active') {
    if (currentIdx >= 1) {
      stat = `${totalVotes.toLocaleString()} votes`
    } else {
      stat = `${supportCount}/${activationThreshold} support`
    }
  } else if (stageId === 'voting') {
    if (currentIdx === 2) {
      // Currently in voting
      stat = votingEndsAt ? timeUntil(votingEndsAt) : `${Math.round(bluePct)}% FOR`
    } else if (currentIdx > 2) {
      // Voting ended
      stat = `${Math.round(bluePct)}% FOR`
    } else {
      stat = `72h final vote`
    }
  } else if (stageId === 'resolved') {
    if (currentIdx >= 3) {
      const forPct = Math.round(bluePct)
      const isLaw = status === 'law' || status === 'continued'
      stat = isLaw ? `Passed ${forPct}% FOR` : `Failed ${forPct}% FOR`
    } else {
      stat = null
    }
  }

  return (
    <div className="flex flex-col items-center text-center min-w-0 w-full">
      <span className={cn('text-[11px] font-mono font-semibold leading-tight', textColor)}>
        {LABELS[stageId]}
      </span>
      {stat && (
        <span className={cn('text-[10px] font-mono leading-tight mt-0.5 truncate max-w-[72px]', statColor)}>
          {stat}
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicStatusJourney({
  status,
  supportCount,
  activationThreshold,
  totalVotes,
  bluePct,
  votingEndsAt,
  createdAt,
  className,
}: TopicStatusJourneyProps) {
  const currentIdx = useMemo(() => statusToStageIndex(status), [status])

  // Stage-level accessibility summary
  const journeyLabel = useMemo(() => {
    switch (status) {
      case 'proposed':
        return `Topic is proposed — needs ${activationThreshold - supportCount} more supporters to activate`
      case 'active':
        return `Topic is active with ${totalVotes.toLocaleString()} votes cast`
      case 'voting':
        return `Topic is in final voting — currently ${Math.round(bluePct)}% FOR`
      case 'law':
        return `Topic passed and became law with ${Math.round(bluePct)}% FOR`
      case 'continued':
        return `Topic passed as law and was continued`
      case 'failed':
        return `Topic failed with only ${Math.round(bluePct)}% FOR`
      case 'archived':
        return `Topic is archived`
      default:
        return `Topic lifecycle`
    }
  }, [status, supportCount, activationThreshold, totalVotes, bluePct])

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-300 bg-surface-100 p-5',
        className
      )}
      role="group"
      aria-label={journeyLabel}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Clock className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
          Topic Journey
        </span>
        {/* Current status pill */}
        <span
          className={cn(
            'ml-auto text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
            status === 'proposed'
              ? 'text-surface-500 border-surface-400 bg-surface-300/30'
              : status === 'active'
              ? 'text-for-300 border-for-500/50 bg-for-500/10'
              : status === 'voting'
              ? 'text-purple border-purple/50 bg-purple/10'
              : status === 'law' || status === 'continued'
              ? 'text-gold border-gold/50 bg-gold/10'
              : 'text-against-400 border-against-500/50 bg-against-500/10'
          )}
        >
          {status === 'law' || status === 'continued'
            ? 'Law'
            : status === 'failed' || status === 'archived'
            ? 'Failed'
            : status === 'proposed'
            ? 'Proposed'
            : status === 'active'
            ? 'Active'
            : 'Voting'}
        </span>
      </div>

      {/* Stepper */}
      <div className="flex items-center" role="list" aria-label="Lifecycle stages">
        {STAGE_ORDER.map((stageId, idx) => (
          <div
            key={stageId}
            className="flex flex-col items-center flex-1"
            role="listitem"
          >
            {/* Dot + connector row */}
            <div className="flex w-full items-center">
              {idx > 0 && (
                <Connector
                  filled={currentIdx >= idx}
                  partial={currentIdx === idx}
                />
              )}
              <StageDot
                stageIdx={idx}
                currentIdx={currentIdx}
                status={status}
              />
              {idx < STAGE_ORDER.length - 1 && (
                <Connector
                  filled={currentIdx > idx}
                />
              )}
            </div>

            {/* Label + stat below */}
            <div className="mt-2.5 px-1 w-full">
              <StageInfo
                stageId={stageId}
                stageIdx={idx}
                currentIdx={currentIdx}
                status={status}
                supportCount={supportCount}
                activationThreshold={activationThreshold}
                totalVotes={totalVotes}
                bluePct={bluePct}
                votingEndsAt={votingEndsAt}
                createdAt={createdAt}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Progress note for proposed topics */}
      {status === 'proposed' && (
        <div className="mt-4 pt-4 border-t border-surface-300">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-surface-500">
              Support progress
            </span>
            <span className="text-[11px] font-mono text-for-400 font-semibold">
              {supportCount.toLocaleString()} / {activationThreshold.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className="h-full bg-for-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((supportCount / activationThreshold) * 100, 100)}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-1.5">
            {Math.max(0, activationThreshold - supportCount).toLocaleString()} more supporters needed to activate
          </p>
        </div>
      )}

      {/* Countdown for voting topics */}
      {status === 'voting' && votingEndsAt && (
        <div className="mt-4 pt-4 border-t border-surface-300 flex items-center justify-between">
          <span className="text-[11px] font-mono text-surface-500">
            Final vote deadline
          </span>
          <span className="text-[11px] font-mono font-semibold text-purple">
            {new Date(votingEndsAt) > new Date()
              ? timeUntil(votingEndsAt)
              : 'Vote closed'}
          </span>
        </div>
      )}

      {/* Final outcome for resolved topics */}
      {(status === 'law' || status === 'continued') && (
        <div className="mt-4 pt-4 border-t border-surface-300 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] font-mono text-gold">
            Passed with <strong>{Math.round(bluePct)}%</strong> in favour across{' '}
            {totalVotes.toLocaleString()} votes
          </p>
        </div>
      )}
      {(status === 'failed' || status === 'archived') && (
        <div className="mt-4 pt-4 border-t border-surface-300 flex items-center gap-3">
          <XCircle className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] font-mono text-against-400">
            Failed — only <strong>{Math.round(bluePct)}%</strong> in favour across{' '}
            {totalVotes.toLocaleString()} votes
          </p>
        </div>
      )}
    </div>
  )
}
