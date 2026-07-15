'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConfidenceVote, CVListResponse } from '@/app/api/confidence-votes/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const MOTION_LABEL: Record<ConfidenceVote['motion_type'], string> = {
  no_confidence: 'No Confidence',
  confidence: 'Confidence',
  censure: 'Censure',
}

const MOTION_COLOR: Record<ConfidenceVote['motion_type'], string> = {
  no_confidence: 'text-against-400 border-against-500/40 bg-against-500/10',
  confidence: 'text-for-400 border-for-500/40 bg-for-500/10',
  censure: 'text-gold border-gold/40 bg-gold/10',
}

const TARGET_LABEL: Record<ConfidenceVote['target_type'], string> = {
  coalition: 'Coalition',
  committee: 'Committee',
  elder: 'Elder',
  council: 'Council',
  officer: 'Officer',
}

const MOTION_TYPES: Array<{ value: ConfidenceVote['motion_type']; label: string; desc: string }> = [
  {
    value: 'no_confidence',
    label: 'Vote of No Confidence',
    desc: 'Demands the body stand down or lose legitimacy if carried by majority.',
  },
  {
    value: 'confidence',
    label: 'Vote of Confidence',
    desc: 'Reaffirms the body\'s mandate and asks citizens to back their work.',
  },
  {
    value: 'censure',
    label: 'Motion of Censure',
    desc: 'Formally rebukes conduct without demanding dismissal.',
  },
]

const TARGET_TYPES: Array<{ value: ConfidenceVote['target_type']; label: string }> = [
  { value: 'coalition', label: 'Coalition' },
  { value: 'committee', label: 'Committee' },
  { value: 'elder', label: 'Elder' },
  { value: 'council', label: 'Grand Council' },
  { value: 'officer', label: 'Civic Officer' },
]

type Tab = 'active' | 'tabling' | 'decided'

// ── Vote card ─────────────────────────────────────────────────────────────────

function VoteCard({
  vote,
  onAction,
}: {
  vote: ConfidenceVote
  onAction: (id: string, action: 'second' | 'ballot', ballot?: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)
  const total = vote.ayes + vote.noes + vote.abstentions
  const ayePct = total > 0 ? Math.round((vote.ayes / total) * 100) : 0
  const noPct = total > 0 ? Math.round((vote.noes / total) * 100) : 0

  async function act(action: 'second' | 'ballot', ballot?: string) {
    setActing(true)
    await onAction(vote.id, action, ballot)
    setActing(false)
  }

  const outcomeLabel =
    vote.outcome === 'carried'
      ? vote.motion_type === 'no_confidence'
        ? 'Motion Carried — Body Fell'
        : 'Motion Carried'
      : vote.outcome === 'defeated'
      ? 'Motion Defeated'
      : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 space-y-3">
        {/* Type badge + target */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                MOTION_COLOR[vote.motion_type]
              )}
            >
              {MOTION_LABEL[vote.motion_type].toUpperCase()}
            </span>
            <span className="text-[11px] font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
              {TARGET_LABEL[vote.target_type]}
            </span>
            {vote.status === 'open' && (
              <span className="text-[11px] font-mono text-gold px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 animate-pulse">
                DIVISION OPEN
              </span>
            )}
            {vote.outcome && (
              <span
                className={cn(
                  'text-[11px] font-mono px-2 py-0.5 rounded-full border',
                  vote.outcome === 'carried'
                    ? 'text-against-400 bg-against-500/10 border-against-500/30'
                    : 'text-surface-400 bg-surface-200 border-surface-300'
                )}
              >
                {outcomeLabel}
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-surface-500 hover:text-white transition-colors flex-shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Target name */}
        <p className="font-mono font-semibold text-white text-base leading-snug">
          {vote.target_name}
        </p>

        {/* Reason excerpt */}
        <p className="text-sm text-surface-400 font-mono leading-relaxed line-clamp-2">
          {vote.reason}
        </p>

        {/* Proposer + time */}
        <div className="flex items-center justify-between text-[11px] text-surface-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Avatar
              src={vote.proposer?.avatar_url}
              username={vote.proposer?.username ?? '?'}
              size={16}
              className="rounded-full"
            />
            <span>{vote.proposer?.display_name ?? vote.proposer?.username ?? 'Unknown'}</span>
          </div>
          <span>{relativeTime(vote.created_at)}</span>
        </div>
      </div>

      {/* Tabling progress */}
      {vote.status === 'tabling' && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {vote.seconds_count}/{vote.seconds_required} seconds
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeUntil(vote.seconds_deadline)} remaining
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${Math.min(100, (vote.seconds_count / vote.seconds_required) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Division progress */}
      {(vote.status === 'open' || vote.status === 'closed') && total > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
            <span className="text-for-400">Aye {ayePct}%</span>
            {vote.status === 'open' && vote.closes_at && (
              <span className="flex items-center gap-1 text-gold">
                <Clock className="h-3 w-3" />
                {timeUntil(vote.closes_at)}
              </span>
            )}
            <span className="text-against-400">No {noPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
            <div
              className="h-full bg-for-500 transition-all duration-500"
              style={{ width: `${ayePct}%` }}
            />
            <div
              className="h-full bg-surface-400 transition-all duration-500"
              style={{ width: `${total > 0 ? Math.round((vote.abstentions / total) * 100) : 0}%` }}
            />
            <div
              className="h-full bg-against-500 transition-all duration-500"
              style={{ width: `${noPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-500">
            <span>{vote.ayes} aye{vote.ayes !== 1 ? 's' : ''}</span>
            <span>{vote.abstentions} abstain{vote.abstentions !== 1 ? 's' : ''}</span>
            <span>{vote.noes} no{vote.noes !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(vote.status === 'tabling' || vote.status === 'open') && (
        <div className="px-4 pb-4 flex gap-2 flex-wrap">
          {vote.status === 'tabling' && !vote.user_has_seconded && (
            <button
              onClick={() => act('second')}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-medium hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              Second This Motion
            </button>
          )}
          {vote.status === 'tabling' && vote.user_has_seconded && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Seconded
            </span>
          )}
          {vote.status === 'open' && !vote.user_ballot && (
            <>
              <button
                onClick={() => act('ballot', 'aye')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 text-white text-xs font-mono font-medium hover:bg-for-500 transition-colors disabled:opacity-50"
              >
                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                Aye
              </button>
              <button
                onClick={() => act('ballot', 'no')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-against-600 text-white text-xs font-mono font-medium hover:bg-against-500 transition-colors disabled:opacity-50"
              >
                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                No
              </button>
              <button
                onClick={() => act('ballot', 'abstain')}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-300 text-xs font-mono font-medium hover:bg-surface-300 transition-colors disabled:opacity-50"
              >
                Abstain
              </button>
            </>
          )}
          {vote.status === 'open' && vote.user_ballot && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Voted {vote.user_ballot === 'aye' ? 'Aye' : vote.user_ballot === 'no' ? 'No' : 'Abstain'}
            </span>
          )}
        </div>
      )}

      {/* Expanded reason */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-surface-300"
          >
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Full reason</p>
              <p className="text-sm font-mono text-surface-300 leading-relaxed whitespace-pre-wrap">{vote.reason}</p>
              {vote.context_note && (
                <p className="text-xs font-mono text-surface-500 italic leading-relaxed">{vote.context_note}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Table motion modal ────────────────────────────────────────────────────────

function TableMotionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [step, setStep] = useState<'type' | 'form'>('type')
  const [motionType, setMotionType] = useState<ConfidenceVote['motion_type']>('no_confidence')
  const [targetName, setTargetName] = useState('')
  const [targetType, setTargetType] = useState<ConfidenceVote['target_type']>('coalition')
  const [reason, setReason] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!targetName.trim() || !reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/confidence-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motion_type: motionType,
          target_name: targetName.trim(),
          target_type: targetType,
          reason: reason.trim(),
          context_note: contextNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to table motion')
        return
      }
      onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-surface-100 border border-surface-300 rounded-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-gold" />
            <span className="font-mono font-semibold text-white text-sm">Table a Motion</span>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: pick type */}
        {step === 'type' && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-surface-500 font-mono">Select motion type:</p>
            {MOTION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setMotionType(t.value); setStep('form') }}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-colors',
                  motionType === t.value
                    ? 'border-gold/40 bg-gold/5'
                    : 'border-surface-300 bg-surface-200 hover:border-surface-200'
                )}
              >
                <span className={cn('text-sm font-mono font-semibold', MOTION_COLOR[t.value].split(' ')[0])}>
                  {t.label}
                </span>
                <p className="text-xs text-surface-500 font-mono mt-1 leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: fill in form */}
        {step === 'form' && (
          <div className="p-5 space-y-4">
            {/* Motion type summary */}
            <div className={cn('rounded-lg border px-3 py-2 text-xs font-mono', MOTION_COLOR[motionType])}>
              {MOTION_LABEL[motionType]}
              <button
                onClick={() => setStep('type')}
                className="ml-2 text-surface-400 underline hover:text-white"
              >
                change
              </button>
            </div>

            {/* Target type */}
            <div>
              <label className="text-xs text-surface-500 font-mono block mb-1.5">Target type</label>
              <div className="flex flex-wrap gap-2">
                {TARGET_TYPES.map((tt) => (
                  <button
                    key={tt.value}
                    onClick={() => setTargetType(tt.value)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-mono border transition-colors',
                      targetType === tt.value
                        ? 'bg-gold/10 border-gold/40 text-gold'
                        : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-200'
                    )}
                  >
                    {tt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target name */}
            <div>
              <label className="text-xs text-surface-500 font-mono block mb-1.5">
                Name of {TARGET_LABEL[targetType]}
              </label>
              <input
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder={`e.g. ${targetType === 'coalition' ? 'The Civic Alliance' : 'Economics Committee'}`}
                maxLength={120}
                className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-surface-100"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs text-surface-500 font-mono block mb-1.5">
                Grounds for the motion <span className="text-surface-600">({reason.length}/1000)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Set out clearly why this motion is warranted. Be specific about the conduct or decisions in question."
                rows={4}
                maxLength={1000}
                className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-surface-100 resize-none"
              />
            </div>

            {/* Context note */}
            <div>
              <label className="text-xs text-surface-500 font-mono block mb-1.5">
                Additional context <span className="text-surface-600">(optional)</span>
              </label>
              <textarea
                value={contextNote}
                onChange={(e) => setContextNote(e.target.value)}
                placeholder="Links, background, or prior incidents that inform this motion."
                rows={2}
                maxLength={500}
                className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-surface-100 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-against-400 font-mono flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-surface-300 text-sm font-mono hover:bg-surface-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || targetName.trim().length < 3 || reason.trim().length < 30}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-mono font-semibold hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Table Motion
              </button>
            </div>

            <p className="text-[10px] text-surface-600 font-mono text-center">
              You may table one motion per 7 days. 10 seconds needed to open the division.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Loading skeletons ─────────────────────────────────────────────────────────

function VoteSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConfidenceVoteClient() {
  const [data, setData] = useState<CVListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('active')
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/confidence-votes', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Failed to load confidence votes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAction(id: string, action: 'second' | 'ballot', ballot?: string) {
    const res = await fetch(`/api/confidence-votes/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ballot }),
    })
    if (res.ok) await load()
  }

  const allVotes = data?.votes ?? []
  const filtered = allVotes.filter((v) => {
    if (tab === 'active') return v.status === 'open'
    if (tab === 'tabling') return v.status === 'tabling'
    return v.status === 'closed' || v.status === 'withdrawn'
  })

  const tabCounts = {
    active: allVotes.filter((v) => v.status === 'open').length,
    tabling: allVotes.filter((v) => v.status === 'tabling').length,
    decided: allVotes.filter((v) => v.status === 'closed' || v.status === 'withdrawn').length,
  }

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">

          {/* Back nav */}
          <Link
            href="/parliament"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 font-mono hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Parliament
          </Link>

          {/* Page header */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-gold flex-shrink-0" />
                  <h1 className="font-mono font-bold text-white text-xl">Confidence Votes</h1>
                </div>
                <p className="text-sm text-surface-400 font-mono leading-relaxed">
                  Table a formal vote of no confidence in any civic body. 10 citizens must second
                  the motion within 7 days — then a 48-hour division opens.
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                disabled={data?.user_tabled_this_week === true}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-black text-xs font-mono font-semibold hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Table Motion
              </button>
            </div>

            {/* How it works */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { icon: Gavel, label: 'Table', desc: 'Propose a motion with your grounds' },
                { icon: Users, label: '10 Seconds', desc: 'Citizens back the motion to open a vote' },
                { icon: Shield, label: 'Division', desc: '48-hour Aye / No vote decides the outcome' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl bg-surface-200 border border-surface-300 p-3 text-center space-y-1">
                  <Icon className="h-4 w-4 text-gold mx-auto" />
                  <p className="text-xs font-mono font-semibold text-white">{label}</p>
                  <p className="text-[10px] font-mono text-surface-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
            {(['active', 'tabling', 'decided'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-mono font-medium transition-colors capitalize',
                  tab === t
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {t === 'active' ? 'Division Open' : t === 'tabling' ? 'Tabling' : 'Decided'}
                {tabCounts[t] > 0 && (
                  <span className="ml-1 text-[10px] text-surface-500">({tabCounts[t]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <div className="flex justify-end">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white font-mono transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <VoteSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
              <p className="text-sm font-mono text-surface-400">{error}</p>
              <Button onClick={load} variant="outline" size="sm">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={
                tab === 'active' ? Shield :
                tab === 'tabling' ? Crown :
                Gavel
              }
              title={
                tab === 'active' ? 'No open divisions' :
                tab === 'tabling' ? 'No motions in tabling' :
                'No decided motions yet'
              }
              description={
                tab === 'active'
                  ? 'No divisions are currently open. Tabling motions need 10 seconds to open a division.'
                  : tab === 'tabling'
                  ? 'No motions are currently gathering seconds. Be the first to table one.'
                  : 'No motions have been decided yet.'
              }
              action={
                tab === 'tabling' ? {
                  label: 'Table a Motion',
                  onClick: () => setShowModal(true),
                } : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((vote) => (
                  <VoteCard key={vote.id} vote={vote} onAction={handleAction} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      <AnimatePresence>
        {showModal && (
          <TableMotionModal
            onClose={() => setShowModal(false)}
            onSubmit={() => {
              setShowModal(false)
              load()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
