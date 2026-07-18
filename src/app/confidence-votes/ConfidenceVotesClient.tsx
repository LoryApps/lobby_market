'use client'

/**
 * /confidence-votes — Westminster-style Confidence Vote Chamber
 *
 * Two-phase democratic accountability mechanism:
 *   Phase 1 — Tabling: A citizen proposes a motion. 10 others must second it
 *             within 7 days for it to advance.
 *   Phase 2 — Division: A 48-hour formal vote. Citizens cast Aye / No / Abstain.
 *             Majority of cast ballots (excluding abstentions) determines outcome.
 *
 * Motion types:
 *   no_confidence — body must stand down if carried
 *   confidence    — reaffirms the body's mandate
 *   censure       — formal rebuke; binding but not dismissal
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Gavel,
  Info,
  Loader2,
  MinusCircle,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
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
  ConfidenceVote,
  CVListResponse,
} from '@/app/api/confidence-votes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeUntil(iso: string | null): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m remaining`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function totalDivisionVotes(v: ConfidenceVote): number {
  return v.ayes + v.noes
}

function ayePct(v: ConfidenceVote): number {
  const total = totalDivisionVotes(v)
  return total === 0 ? 0 : Math.round((v.ayes / total) * 100)
}

// ─── Motion type config ───────────────────────────────────────────────────────

const MOTION_CONFIG = {
  no_confidence: {
    label: 'No Confidence',
    color: 'text-against-400',
    bg: 'bg-against-900/30',
    border: 'border-against-700/40',
    badgeBg: 'bg-against-500/20',
    icon: XCircle,
    description: 'If carried, the body must stand down or lose civic legitimacy.',
  },
  confidence: {
    label: 'Confidence',
    color: 'text-for-400',
    bg: 'bg-for-900/20',
    border: 'border-for-700/30',
    badgeBg: 'bg-for-500/20',
    icon: CheckCircle2,
    description: 'If carried, reaffirms the body\'s democratic mandate.',
  },
  censure: {
    label: 'Censure',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badgeBg: 'bg-gold/20',
    icon: AlertTriangle,
    description: 'A formal rebuke. Binding but not a dismissal.',
  },
} as const

const STATUS_CONFIG = {
  tabling: {
    label: 'Tabling',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Clock,
  },
  open: {
    label: 'Division Open',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Zap,
  },
  closed: {
    label: 'Concluded',
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/20',
    icon: Gavel,
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'text-surface-600',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/10',
    icon: MinusCircle,
  },
} as const

const TARGET_TYPE_LABELS: Record<ConfidenceVote['target_type'], string> = {
  coalition: 'Coalition',
  committee: 'Committee',
  elder: 'Elder',
  council: 'Council',
  officer: 'Officer',
}

// ─── Propose modal ────────────────────────────────────────────────────────────

const MOTION_TYPES: Array<{ value: ConfidenceVote['motion_type']; label: string; desc: string }> = [
  { value: 'no_confidence', label: 'No Confidence', desc: 'Move that a body has lost your confidence' },
  { value: 'confidence', label: 'Confidence', desc: 'Reaffirm a body\'s mandate publicly' },
  { value: 'censure', label: 'Censure', desc: 'Issue a formal rebuke without dismissal' },
]

const TARGET_TYPES: Array<{ value: ConfidenceVote['target_type']; label: string }> = [
  { value: 'coalition', label: 'Coalition' },
  { value: 'committee', label: 'Committee' },
  { value: 'elder', label: 'Elder' },
  { value: 'council', label: 'Council' },
  { value: 'officer', label: 'Officer' },
]

interface ProposeModalProps {
  onClose: () => void
  onSubmit: (fields: {
    motion_type: ConfidenceVote['motion_type']
    target_name: string
    target_type: ConfidenceVote['target_type']
    reason: string
    context_note: string
  }) => Promise<void>
  submitting: boolean
}

function ProposeModal({ onClose, onSubmit, submitting }: ProposeModalProps) {
  const [motionType, setMotionType] = useState<ConfidenceVote['motion_type']>('no_confidence')
  const [targetName, setTargetName] = useState('')
  const [targetType, setTargetType] = useState<ConfidenceVote['target_type']>('coalition')
  const [reason, setReason] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    targetName.trim().length >= 3 && reason.trim().length >= 30 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit({ motion_type: motionType, target_name: targetName, target_type: targetType, reason, context_note: contextNote })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to table motion')
    }
  }

  const cfg = MOTION_CONFIG[motionType]
  const MotionIcon = cfg.icon

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-5 sm:p-6 space-y-4 z-10 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-gold" />
            <h2 className="font-semibold text-white text-sm">Table a Motion</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-200 transition-colors">
            <X className="h-4 w-4 text-surface-500" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gold/80 leading-relaxed">
            Your motion must gather <strong>10 seconds</strong> within 7 days to advance to a
            formal division. You may table one motion per 7 days.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Motion type */}
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-2">
              Motion Type <span className="text-against-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MOTION_TYPES.map((mt) => {
                const mc = MOTION_CONFIG[mt.value]
                const Icon = mc.icon
                return (
                  <button
                    key={mt.value}
                    type="button"
                    onClick={() => setMotionType(mt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all',
                      motionType === mt.value
                        ? `${mc.bg} ${mc.border} ${mc.color}`
                        : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:border-surface-400/40',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-semibold leading-tight">{mt.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-surface-500 mt-1.5 leading-relaxed">
              <MotionIcon className={cn('inline h-3 w-3 mr-1', cfg.color)} />
              {cfg.description}
            </p>
          </div>

          {/* Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-400 mb-1.5">
                Target Name <span className="text-against-400">*</span>
              </label>
              <input
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="e.g. The Grand Council"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm placeholder:text-surface-600 focus:outline-none focus:border-gold/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-400 mb-1.5">
                Target Type <span className="text-against-400">*</span>
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as ConfidenceVote['target_type'])}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm focus:outline-none focus:border-gold/40 transition-colors appearance-none"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">
              Grounds for the Motion <span className="text-against-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Set out the specific grounds for this motion. Be precise and factual…"
              maxLength={1000}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm placeholder:text-surface-600 focus:outline-none focus:border-gold/40 transition-colors resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className={cn('text-[10px] font-mono', reason.length < 30 ? 'text-against-400' : 'text-surface-600')}>
                {reason.length < 30 ? `${30 - reason.length} more characters required` : ''}
              </span>
              <span className="text-[10px] text-surface-600 font-mono">{reason.length}/1000</span>
            </div>
          </div>

          {/* Context note (optional) */}
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">
              Context Note <span className="text-surface-600 font-normal">(optional)</span>
            </label>
            <input
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder="Any supplementary context for citizens…"
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm placeholder:text-surface-600 focus:outline-none focus:border-gold/40 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-against-900/20 border border-against-700/30">
              <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
              <p className="text-xs text-against-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-400 text-sm font-semibold hover:bg-surface-300/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl bg-gold/80 border border-gold/50 text-black text-sm font-bold hover:bg-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scale className="h-3.5 w-3.5" />
              )}
              Table Motion
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Motion card ──────────────────────────────────────────────────────────────

interface MotionCardProps {
  vote: ConfidenceVote
  onSecond: (id: string) => Promise<void>
  onBallot: (id: string, ballot: 'aye' | 'no' | 'abstain') => Promise<void>
  actioning: Set<string>
}

function MotionCard({ vote, onSecond, onBallot, actioning }: MotionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [balloting, setBalloting] = useState(false)

  const motionCfg = MOTION_CONFIG[vote.motion_type]
  const statusCfg = STATUS_CONFIG[vote.status]
  const MotionIcon = motionCfg.icon
  const StatusIcon = statusCfg.icon

  const secondsPct = Math.min(100, Math.round((vote.seconds_count / vote.seconds_required) * 100))
  const isTabling = vote.status === 'tabling'
  const isOpen = vote.status === 'open'
  const isClosed = vote.status === 'closed' || vote.status === 'withdrawn'
  const isActioning = actioning.has(vote.id)

  const total = totalDivisionVotes(vote)
  const aye = ayePct(vote)
  const noe = total === 0 ? 0 : Math.round((vote.noes / total) * 100)
  const carried = vote.outcome === 'carried'
  const defeated = vote.outcome === 'defeated'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-all',
        motionCfg.bg,
        motionCfg.border,
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 p-2 rounded-xl', motionCfg.bg, motionCfg.border)}>
            <MotionIcon className={cn('h-4 w-4', motionCfg.color)} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', motionCfg.badgeBg, motionCfg.color)}>
                {motionCfg.label}
              </span>
              <span className="text-[10px] text-surface-500 bg-surface-300/30 px-2 py-0.5 rounded-full font-medium">
                {TARGET_TYPE_LABELS[vote.target_type]}
              </span>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', statusCfg.bg, statusCfg.border, statusCfg.color, 'border')}>
                <StatusIcon className="h-2.5 w-2.5" />
                {statusCfg.label}
              </span>
              {vote.outcome && (
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                  carried ? 'bg-emerald/20 text-emerald' : 'bg-against-500/20 text-against-400',
                )}>
                  {carried ? 'Carried' : defeated ? 'Defeated' : vote.outcome}
                </span>
              )}
            </div>

            {/* Target */}
            <h3 className="text-sm font-bold text-white leading-snug">
              {motionCfg.label} — {vote.target_name}
            </h3>

            {/* Proposer + time */}
            <div className="flex items-center gap-2 mt-2">
              <Avatar src={vote.proposer.avatar_url} fallback={vote.proposer.display_name ?? vote.proposer.username} size="xs" />
              <span className="text-[11px] text-surface-500">
                <Link href={`/profile/${vote.proposer.username}`} className="text-surface-400 hover:text-white transition-colors font-medium">
                  {vote.proposer.display_name ?? vote.proposer.username}
                </Link>
                {' · '}{timeAgo(vote.created_at)}
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-surface-300/30 transition-colors text-surface-500"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Phase 1: Tabling progress */}
        {isTabling && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-surface-400 font-medium">
                <Users className="inline h-3 w-3 mr-1 text-surface-500" />
                {vote.seconds_count} / {vote.seconds_required} seconds
              </span>
              <span className="text-[11px] text-gold font-mono">
                <Clock className="inline h-3 w-3 mr-1" />
                {timeUntil(vote.seconds_deadline)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gold transition-all duration-500"
                style={{ width: `${secondsPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase 2: Division tally */}
        {(isOpen || isClosed) && total > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="text-for-400">
                  <ThumbsUp className="inline h-3 w-3 mr-1" />
                  {vote.ayes} Aye
                </span>
                <span className="text-surface-500">·</span>
                <span className="text-against-400">
                  <ThumbsDown className="inline h-3 w-3 mr-1" />
                  {vote.noes} No
                </span>
                <span className="text-surface-500">·</span>
                <span className="text-surface-500">
                  {vote.abstentions} Abstain
                </span>
              </div>
              {isOpen && (
                <span className="text-[11px] text-emerald font-mono">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {timeUntil(vote.closes_at)}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-surface-300/40 overflow-hidden flex">
              <div className="h-full bg-for-500 transition-all duration-500" style={{ width: `${aye}%` }} />
              <div className="h-full bg-against-500 transition-all duration-500" style={{ width: `${noe}%` }} />
            </div>
          </div>
        )}
        {(isOpen || isClosed) && total === 0 && (
          <p className="mt-3 text-[11px] text-surface-600">No ballots cast yet.</p>
        )}
      </div>

      {/* Expanded: reason */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300/30 pt-3">
              <div>
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-1">Grounds</p>
                <p className="text-xs text-surface-300 leading-relaxed">{vote.reason}</p>
              </div>
              {vote.context_note && (
                <div>
                  <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-1">Context</p>
                  <p className="text-xs text-surface-400 leading-relaxed">{vote.context_note}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {(isTabling || isOpen) && (
        <div className={cn(
          'px-4 py-3 border-t flex items-center gap-3',
          motionCfg.border,
        )}>
          {isTabling && (
            vote.user_has_seconded ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                You seconded this motion
              </div>
            ) : (
              <button
                onClick={() => onSecond(vote.id)}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/80 hover:bg-gold text-black text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isActioning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ThumbsUp className="h-3.5 w-3.5" />
                )}
                Second this Motion
              </button>
            )
          )}

          {isOpen && !balloting && (
            vote.user_ballot ? (
              <div className={cn(
                'flex items-center gap-1.5 text-[11px] font-semibold capitalize',
                vote.user_ballot === 'aye' ? 'text-for-400' : vote.user_ballot === 'no' ? 'text-against-400' : 'text-surface-400',
              )}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                You voted {vote.user_ballot.toUpperCase()}
              </div>
            ) : (
              <button
                onClick={() => setBalloting(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald/20 hover:bg-emerald/30 border border-emerald/30 text-emerald text-xs font-bold transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                Cast Your Ballot
                <ArrowRight className="h-3 w-3" />
              </button>
            )
          )}

          {isOpen && balloting && !vote.user_ballot && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-surface-400 font-semibold">Division:</span>
              <button
                onClick={async () => { await onBallot(vote.id, 'aye'); setBalloting(false) }}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-500/20 hover:bg-for-500/30 border border-for-500/30 text-for-400 text-xs font-bold transition-colors disabled:opacity-40"
              >
                <ThumbsUp className="h-3 w-3" /> AYE
              </button>
              <button
                onClick={async () => { await onBallot(vote.id, 'no'); setBalloting(false) }}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-against-500/20 hover:bg-against-500/30 border border-against-500/30 text-against-400 text-xs font-bold transition-colors disabled:opacity-40"
              >
                <ThumbsDown className="h-3 w-3" /> NO
              </button>
              <button
                onClick={async () => { await onBallot(vote.id, 'abstain'); setBalloting(false) }}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-300/20 hover:bg-surface-300/30 border border-surface-400/30 text-surface-400 text-xs font-bold transition-colors disabled:opacity-40"
              >
                <MinusCircle className="h-3 w-3" /> ABSTAIN
              </button>
              <button
                onClick={() => setBalloting(false)}
                className="p-1.5 rounded-lg text-surface-600 hover:text-surface-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'tabling' | 'open' | 'closed'

const FILTER_TABS: { id: FilterTab; label: string; icon: typeof Scale }[] = [
  { id: 'all', label: 'All', icon: Scale },
  { id: 'tabling', label: 'Tabling', icon: Clock },
  { id: 'open', label: 'Division', icon: Zap },
  { id: 'closed', label: 'Concluded', icon: Gavel },
]

export function ConfidenceVotesClient() {
  const [data, setData] = useState<CVListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showPropose, setShowPropose] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actioning, setActioning] = useState(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/confidence-votes')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as CVListResponse)
    } catch {
      setError('Could not load confidence votes. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handlePropose = useCallback(async (fields: {
    motion_type: ConfidenceVote['motion_type']
    target_name: string
    target_type: ConfidenceVote['target_type']
    reason: string
    context_note: string
  }) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/confidence-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to table motion')
      setShowPropose(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }, [load])

  const handleSecond = useCallback(async (id: string) => {
    setActioning((s) => new Set([...s, id]))
    try {
      const res = await fetch(`/api/confidence-votes/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'second' }),
      })
      if (!res.ok) return
      const json = await res.json()
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          votes: prev.votes.map((v) =>
            v.id === id
              ? {
                  ...v,
                  user_has_seconded: true,
                  seconds_count: v.seconds_count + 1,
                  status: json.now_open ? 'open' : v.status,
                  closes_at: json.now_open ? new Date(Date.now() + 48 * 3_600_000).toISOString() : v.closes_at,
                }
              : v
          ),
        }
      })
    } finally {
      setActioning((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }, [])

  const handleBallot = useCallback(async (id: string, ballot: 'aye' | 'no' | 'abstain') => {
    setActioning((s) => new Set([...s, id]))
    try {
      const res = await fetch(`/api/confidence-votes/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ballot', ballot }),
      })
      if (!res.ok) return
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          votes: prev.votes.map((v) => {
            if (v.id !== id) return v
            return {
              ...v,
              user_ballot: ballot,
              ayes: ballot === 'aye' ? v.ayes + 1 : v.ayes,
              noes: ballot === 'no' ? v.noes + 1 : v.noes,
              abstentions: ballot === 'abstain' ? v.abstentions + 1 : v.abstentions,
            }
          }),
        }
      })
    } finally {
      setActioning((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }, [])

  const filtered =
    filter === 'all'
      ? (data?.votes ?? [])
      : (data?.votes ?? []).filter((v) =>
          filter === 'closed'
            ? v.status === 'closed' || v.status === 'withdrawn'
            : v.status === filter
        )

  const stats = data
    ? {
        tabling: data.votes.filter((v) => v.status === 'tabling').length,
        open: data.votes.filter((v) => v.status === 'open').length,
        carried: data.votes.filter((v) => v.outcome === 'carried').length,
      }
    : null

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28">
        {/* Header */}
        <div className="pt-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-5 w-5 text-gold" />
            <h1 className="font-mono font-bold text-xl text-white">Confidence Votes</h1>
            <Badge variant="gold" className="font-mono text-[10px]">Westminster</Badge>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Citizens may table formal motions of no confidence, confidence, or censure against any civic body.
            Gather 10 seconds within 7 days — and the division opens for 48 hours.
          </p>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 text-center">
              <p className="text-xl font-bold text-gold">{stats.tabling}</p>
              <p className="text-[10px] text-surface-500 mt-0.5">Tabling</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald/10 border border-emerald/20 text-center">
              <p className="text-xl font-bold text-emerald">{stats.open}</p>
              <p className="text-[10px] text-surface-500 mt-0.5">Division Open</p>
            </div>
            <div className="p-3 rounded-xl bg-against-900/20 border border-against-700/20 text-center">
              <p className="text-xl font-bold text-against-400">{stats.carried}</p>
              <p className="text-[10px] text-surface-500 mt-0.5">Carried</p>
            </div>
          </div>
        )}

        {/* Active divisions banner */}
        {(data?.votes ?? []).some((v) => v.status === 'open') && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald/10 border border-emerald/30 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald animate-pulse" />
              <p className="text-sm font-semibold text-emerald">
                {(data?.votes ?? []).filter((v) => v.status === 'open').length} division{(data?.votes ?? []).filter((v) => v.status === 'open').length > 1 ? 's' : ''} in progress
              </p>
            </div>
            {(data?.votes ?? []).filter((v) => v.status === 'open').map((v) => (
              <div key={v.id} className="flex items-center gap-3">
                <span className={cn(
                  'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                  MOTION_CONFIG[v.motion_type].badgeBg,
                  MOTION_CONFIG[v.motion_type].color,
                )}>
                  {MOTION_CONFIG[v.motion_type].label}
                </span>
                <p className="text-xs text-white truncate flex-1">{v.target_name}</p>
                <span className="text-[11px] text-emerald font-mono flex-shrink-0">
                  {timeUntil(v.closes_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs + propose button */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                    filter === tab.id
                      ? 'bg-surface-300/60 text-white border border-surface-400/30'
                      : 'text-surface-500 hover:text-surface-300 hover:bg-surface-300/20',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setShowPropose(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold text-xs font-bold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Table Motion
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="flex-shrink-0 p-1.5 rounded-xl text-surface-500 hover:text-surface-300 hover:bg-surface-300/20 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* How it works (collapsible) */}
        <details className="mb-5 group">
          <summary className="flex items-center gap-2 cursor-pointer text-xs text-surface-500 hover:text-surface-300 transition-colors select-none">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            <span>How confidence votes work</span>
            <ChevronDown className="h-3.5 w-3.5 ml-auto group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-3 p-4 rounded-xl bg-surface-100/50 border border-surface-300/30 space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-[10px] font-bold text-gold">1</div>
              <div>
                <p className="text-xs font-semibold text-white">Tabling Phase</p>
                <p className="text-[11px] text-surface-400 leading-relaxed mt-0.5">
                  A citizen proposes a motion — no confidence, confidence, or censure — against a named civic body.
                  The motion must gather <strong className="text-surface-300">10 seconds</strong> within 7 days.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald/20 flex items-center justify-center text-[10px] font-bold text-emerald">2</div>
              <div>
                <p className="text-xs font-semibold text-white">Division Phase</p>
                <p className="text-[11px] text-surface-400 leading-relaxed mt-0.5">
                  Once seconded, a 48-hour formal vote opens. Citizens cast <strong className="text-for-400">Aye</strong>,{' '}
                  <strong className="text-against-400">No</strong>, or <strong className="text-surface-400">Abstain</strong>.
                  The majority of Aye/No ballots determines the outcome.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-against-500/20 flex items-center justify-center text-[10px] font-bold text-against-400">3</div>
              <div>
                <p className="text-xs font-semibold text-white">Outcome</p>
                <p className="text-[11px] text-surface-400 leading-relaxed mt-0.5">
                  A <strong className="text-emerald">carried</strong> no confidence motion forces the body to stand down.
                  A carried censure is a binding rebuke. A carried confidence motion reaffirms the body&apos;s mandate.
                </p>
              </div>
            </div>
          </div>
        </details>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-300/30 overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400" />
            <p className="text-sm text-surface-400">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-300 text-xs font-semibold hover:bg-surface-300/60 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Shield}
            iconColor="text-surface-600"
            title="No motions"
            description={
              filter === 'all'
                ? 'No confidence votes have been tabled yet. Be the first to hold a civic body accountable.'
                : `No ${filter === 'closed' ? 'concluded' : filter} motions at the moment.`
            }
            action={
              filter === 'all'
                ? {
                    label: 'Table a Motion',
                    onClick: () => setShowPropose(true),
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((v) => (
              <MotionCard
                key={v.id}
                vote={v}
                onSecond={handleSecond}
                onBallot={handleBallot}
                actioning={actioning}
              />
            ))}
          </div>
        )}

        {/* Links to related chambers */}
        <div className="mt-8 pt-6 border-t border-surface-300/20">
          <p className="text-[10px] font-semibold text-surface-600 uppercase tracking-wider mb-3">Related Chambers</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/emergency-debates', label: 'Emergency Debates', icon: AlertTriangle },
              { href: '/tribunal', label: 'Civic Tribunal', icon: Gavel },
              { href: '/assembly', label: "Citizens' Assembly", icon: Users },
              { href: '/divisions', label: 'Parliamentary Divisions', icon: Scale },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-100/60 border border-surface-300/30 hover:border-surface-400/40 hover:bg-surface-200/40 transition-all group"
              >
                <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
                <span className="text-xs text-surface-400 group-hover:text-surface-200 transition-colors truncate">{label}</span>
                <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 ml-auto flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Propose modal */}
      <AnimatePresence>
        {showPropose && (
          <ProposeModal
            onClose={() => setShowPropose(false)}
            onSubmit={handlePropose}
            submitting={submitting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
