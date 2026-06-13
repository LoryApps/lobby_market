'use client'

/**
 * /law/[id]/amendments — Law Amendment Chamber
 *
 * Community-proposed amendments to an established law. Citizens can vote
 * FOR or AGAINST each pending amendment, and propose new ones.
 * An amendment is ratified when it reaches 60% support with ≥ 20 votes
 * before its 14-day window expires.
 *
 * Distinct from:
 *   /law/[id]/revisions  — Wikipedia-style text edits to the law body
 *   /law/[id]/community  — combined hub (amendments + blueprint notes)
 *   /amendments          — platform-wide amendment browser
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AmendmentsResponse, Amendment } from '@/app/api/laws/[id]/amendments/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const RATIFY_THRESHOLD_PCT = 60
const RATIFY_MIN_VOTES = 20

type Tab = 'pending' | 'ratified' | 'rejected'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `${d}d left`
  return `${h}h left`
}

function forPct(a: Amendment): number {
  const total = a.for_count + a.against_count
  if (total === 0) return 0
  return Math.round((a.for_count / total) * 100)
}

// ─── Amendment Card ───────────────────────────────────────────────────────────

function AmendmentCard({
  amendment,
  onVote,
  votingId,
}: {
  amendment: Amendment
  onVote: (id: string, vote: boolean | null) => void
  votingId: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const isPending = amendment.status === 'pending'
  const isRatified = amendment.status === 'ratified'
  const isExpired = new Date(amendment.expires_at) < new Date()
  const pct = forPct(amendment)
  const totalVotes = amendment.for_count + amendment.against_count
  const isVoting = votingId === amendment.id
  const needsMore = totalVotes < RATIFY_MIN_VOTES
  const progressToThreshold = Math.min(100, (pct / RATIFY_THRESHOLD_PCT) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-colors',
        isRatified
          ? 'border-emerald/30 bg-emerald/5'
          : amendment.status === 'rejected'
            ? 'border-against-500/20 bg-against-500/5'
            : 'border-surface-300/60 bg-surface-100'
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-200/30 transition-colors"
        aria-expanded={expanded}
      >
        {/* Status icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
            isRatified
              ? 'bg-emerald/15 border border-emerald/30'
              : amendment.status === 'rejected'
                ? 'bg-against-500/10 border border-against-500/30'
                : 'bg-surface-200 border border-surface-300'
          )}
        >
          {isRatified ? (
            <CheckCircle2 className="h-4 w-4 text-emerald" />
          ) : amendment.status === 'rejected' ? (
            <XCircle className="h-4 w-4 text-against-400" />
          ) : (
            <Scale className="h-4 w-4 text-surface-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white font-semibold leading-snug">
            {amendment.title}
          </p>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {/* Proposer */}
            {amendment.proposer ? (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={amendment.proposer.avatar_url}
                  fallback={amendment.proposer.display_name ?? amendment.proposer.username}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-500">
                  {amendment.proposer.display_name ?? amendment.proposer.username}
                </span>
              </div>
            ) : null}

            {/* Timestamp */}
            <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {relTime(amendment.created_at)}
            </div>

            {/* Status badge */}
            {isRatified && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald/15 text-emerald border border-emerald/30">
                RATIFIED
              </span>
            )}
            {amendment.status === 'rejected' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-against-500/15 text-against-400 border border-against-500/30">
                REJECTED
              </span>
            )}
            {isPending && !isExpired && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
                <Clock className="h-2.5 w-2.5" />
                {expiresIn(amendment.expires_at)}
              </span>
            )}
            {isPending && isExpired && (
              <span className="text-[10px] font-mono text-surface-600">Expired</span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-surface-500" />
            : <ChevronDown className="h-4 w-4 text-surface-500" />
          }
        </div>
      </button>

      {/* Vote counts summary row */}
      <div className="px-4 pb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs font-mono text-for-400">
          <ThumbsUp className="h-3 w-3" />
          <span>{amendment.for_count.toLocaleString()} for</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-against-400">
          <ThumbsDown className="h-3 w-3" />
          <span>{amendment.against_count.toLocaleString()} against</span>
        </div>
        {totalVotes > 0 && (
          <span className="text-xs font-mono text-surface-500">{pct}% for</span>
        )}
      </div>

      {/* Progress bar (pending only) */}
      {isPending && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-500">
              Progress to ratification ({RATIFY_THRESHOLD_PCT}% needed)
            </span>
            {needsMore && (
              <span className="text-[10px] font-mono text-surface-600">
                {Math.max(0, RATIFY_MIN_VOTES - totalVotes)} more votes needed
              </span>
            )}
          </div>
          <div className="h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                pct >= RATIFY_THRESHOLD_PCT ? 'bg-emerald' : 'bg-for-500'
              )}
              style={{ width: `${progressToThreshold}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300/50 px-4 py-4 space-y-4">
              {/* Body text */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                    Proposed amendment text
                  </span>
                </div>
                <div className="bg-surface-200/60 rounded-xl border border-surface-300/50 p-4 font-mono text-xs text-surface-400 leading-relaxed whitespace-pre-wrap break-words">
                  {amendment.body}
                </div>
              </div>

              {/* Vote buttons (pending + not expired) */}
              {isPending && !isExpired && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onVote(amendment.id, amendment.user_vote === true ? null : true)}
                    disabled={isVoting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all',
                      amendment.user_vote === true
                        ? 'bg-for-600 text-white border border-for-500'
                        : 'bg-surface-200 hover:bg-for-700/30 text-surface-400 hover:text-for-300 border border-surface-300 hover:border-for-600/50',
                      isVoting && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isVoting && amendment.user_vote !== true ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-3.5 w-3.5" />
                    )}
                    For
                    {amendment.user_vote === true && (
                      <span className="text-[10px] opacity-70">✓</span>
                    )}
                  </button>

                  <button
                    onClick={() => onVote(amendment.id, amendment.user_vote === false ? null : false)}
                    disabled={isVoting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all',
                      amendment.user_vote === false
                        ? 'bg-against-600 text-white border border-against-500'
                        : 'bg-surface-200 hover:bg-against-700/30 text-surface-400 hover:text-against-300 border border-surface-300 hover:border-against-600/50',
                      isVoting && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isVoting && amendment.user_vote !== false ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5" />
                    )}
                    Against
                    {amendment.user_vote === false && (
                      <span className="text-[10px] opacity-70">✓</span>
                    )}
                  </button>

                  {amendment.proposer && (
                    <Link
                      href={`/profile/${amendment.proposer.username}`}
                      className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {amendment.proposer.display_name ?? amendment.proposer.username}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* Ratification info */}
              {isRatified && amendment.ratified_at && (
                <div className="flex items-center gap-2 text-xs font-mono text-emerald">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ratified on {new Date(amendment.ratified_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Propose Form ─────────────────────────────────────────────────────────────

function ProposeForm({
  lawId,
  onSuccess,
}: {
  lawId: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (title.trim().length < 5) { setError('Title must be at least 5 characters.'); return }
    if (body.trim().length < 20) { setError('Body must be at least 20 characters.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to submit amendment.'); return }
      setTitle('')
      setBody('')
      setOpen(false)
      onSuccess()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-200/40 transition-colors"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-700/30 border border-for-600/30">
          <Plus className="h-4 w-4 text-for-400" />
        </div>
        <div>
          <p className="text-sm font-mono font-semibold text-white">Propose an Amendment</p>
          <p className="text-xs font-mono text-surface-500">Suggest a change to this law</p>
        </div>
        <div className="ml-auto">
          {open
            ? <ChevronUp className="h-4 w-4 text-surface-500" />
            : <ChevronDown className="h-4 w-4 text-surface-500" />
          }
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300/50 px-4 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-mono text-surface-500 mb-1.5 uppercase tracking-widest">
                  Amendment title <span className="text-against-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Add exemption for small businesses"
                  maxLength={120}
                  className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500 transition-colors"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-mono text-surface-600">5–120 characters</span>
                  <span className={cn('text-[10px] font-mono', title.length > 110 ? 'text-gold' : 'text-surface-600')}>
                    {title.length}/120
                  </span>
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-mono text-surface-500 mb-1.5 uppercase tracking-widest">
                  Amendment text <span className="text-against-400">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe the proposed change in detail. Be specific about what text to add, remove, or modify."
                  rows={5}
                  maxLength={1000}
                  className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500 transition-colors resize-none"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-mono text-surface-600">20–1000 characters</span>
                  <span className={cn('text-[10px] font-mono', body.length > 900 ? 'text-gold' : 'text-surface-600')}>
                    {body.length}/1000
                  </span>
                </div>
              </div>

              {/* Rules */}
              <div className="bg-surface-200/50 rounded-xl border border-surface-300/40 px-3 py-2.5 flex items-start gap-2">
                <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                  Amendments need {RATIFY_THRESHOLD_PCT}% support with ≥{RATIFY_MIN_VOTES} votes
                  within 14 days to be ratified. You may have up to 2 pending amendments per law.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-against-500/10 border border-against-500/30 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                  <p className="text-xs font-mono text-against-400">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setOpen(false); setError(null) }}
                  className="px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono transition-colors"
                >
                  Cancel
                </button>
                <Button
                  onClick={submit}
                  disabled={submitting || title.trim().length < 5 || body.trim().length < 20}
                  size="sm"
                >
                  {submitting ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Submitting…</>
                  ) : (
                    <>
                      <Edit3 className="h-3.5 w-3.5" />
                      Submit Amendment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AmendmentSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawAmendmentsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AmendmentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [votingId, setVotingId] = useState<string | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dataRes, meRes] = await Promise.all([
        fetch(`/api/laws/${id}/amendments`),
        fetch('/api/me/profile'),
      ])
      if (!dataRes.ok) throw new Error('Failed to load')
      const json: AmendmentsResponse = await dataRes.json()
      setData(json)
      setAuthed(meRes.ok)
    } catch {
      setError('Could not load amendments.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleVote = async (amendmentId: string, vote: boolean | null) => {
    if (!authed) return
    setVotingId(amendmentId)
    try {
      const res = await fetch(`/api/amendments/${amendmentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
      if (!res.ok) return
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          amendments: prev.amendments.map((a) => {
            if (a.id !== amendmentId) return a
            const wasFor = a.user_vote === true
            const wasAgainst = a.user_vote === false
            let forDelta = 0
            let againstDelta = 0
            if (vote === null) {
              forDelta = wasFor ? -1 : 0
              againstDelta = wasAgainst ? -1 : 0
            } else if (vote === true) {
              forDelta = 1
              againstDelta = wasAgainst ? -1 : 0
            } else {
              forDelta = wasFor ? -1 : 0
              againstDelta = 1
            }
            return {
              ...a,
              user_vote: vote,
              for_count: Math.max(0, a.for_count + forDelta),
              against_count: Math.max(0, a.against_count + againstDelta),
            }
          }),
        }
      })
    } finally {
      setVotingId(null)
    }
  }

  const law = data?.law ?? null
  const allAmendments = data?.amendments ?? []
  const filtered = allAmendments.filter((a) => a.status === tab)

  const pendingCount = allAmendments.filter((a) => a.status === 'pending').length
  const ratifiedCount = allAmendments.filter((a) => a.status === 'ratified').length
  const rejectedCount = allAmendments.filter((a) => a.status === 'rejected').length

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'pending', label: 'Pending', count: pendingCount, color: 'text-gold' },
    { key: 'ratified', label: 'Ratified', count: ratifiedCount, color: 'text-emerald' },
    { key: 'rejected', label: 'Rejected', count: rejectedCount, color: 'text-against-400' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3">
          <Link
            href={law ? `/law/${id}` : '/law'}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
            )}
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-sm font-mono text-surface-500 min-w-0">
            <Link href="/law" className="hover:text-white transition-colors">Codex</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            {law ? (
              <Link
                href={`/law/${id}`}
                className="hover:text-white transition-colors truncate"
              >
                {law.statement.slice(0, 50)}{law.statement.length > 50 ? '…' : ''}
              </Link>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-white">Amendments</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-700/20 border border-for-600/30 flex-shrink-0">
            <Edit3 className="h-6 w-6 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Amendment Chamber</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {loading
                ? 'Loading…'
                : allAmendments.length === 0
                  ? 'No amendments yet — be the first to propose one'
                  : `${allAmendments.length} amendment${allAmendments.length !== 1 ? 's' : ''} · ${pendingCount} pending`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Law card */}
        {law && (
          <Link
            href={`/law/${id}`}
            className="block bg-surface-100 border border-surface-300 rounded-2xl p-4 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald/10 border border-emerald/30 flex-shrink-0">
                <Gavel className="h-4 w-4 text-emerald" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white font-medium group-hover:text-emerald transition-colors line-clamp-2">
                  {law.statement}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {law.category && (
                    <Badge variant="law" className="text-[10px]">{law.category}</Badge>
                  )}
                  <span className="text-xs font-mono text-surface-500">
                    Established {new Date(law.established_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-surface-600 group-hover:text-emerald flex-shrink-0 transition-colors" />
            </div>
          </Link>
        )}

        {/* How amendments work */}
        <div className="bg-surface-100 border border-surface-300/50 rounded-xl px-4 py-3 flex items-start gap-3">
          <Scale className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Community amendments refine established laws without repealing them. An amendment
            is <span className="text-emerald">ratified</span> when it reaches{' '}
            <span className="text-white">{RATIFY_THRESHOLD_PCT}% support</span> with at least{' '}
            <span className="text-white">{RATIFY_MIN_VOTES} votes</span> within 14 days.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-against-500/10 border border-against-500/30 rounded-xl px-4 py-3 text-xs font-mono text-against-400 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Propose form (authenticated only) */}
        {!loading && authed && (
          <ProposeForm lawId={id} onSuccess={load} />
        )}

        {/* Auth prompt */}
        {!loading && authed === false && (
          <div className="bg-surface-100 border border-surface-300/50 rounded-2xl px-4 py-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-700/20 border border-for-600/30 flex-shrink-0">
              <Edit3 className="h-4 w-4 text-for-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-mono text-white font-semibold">Propose an amendment</p>
              <p className="text-xs font-mono text-surface-500">Sign in to suggest changes to this law</p>
            </div>
            <Link
              href="/login"
              className="px-3 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Tabs */}
        {!loading && (
          <div className="flex items-center gap-1 bg-surface-200/50 border border-surface-300/40 rounded-xl p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                  tab === t.key
                    ? 'bg-surface-100 border border-surface-300/60 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-mono font-bold',
                    tab === t.key ? t.color : 'text-surface-600'
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Amendment list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <AmendmentSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={tab === 'pending' ? Scale : tab === 'ratified' ? CheckCircle2 : XCircle}
            title={
              tab === 'pending' ? 'No pending amendments'
              : tab === 'ratified' ? 'No ratified amendments yet'
              : 'No rejected amendments'
            }
            description={
              tab === 'pending'
                ? 'No amendments are currently open for voting. Be the first to propose one above.'
                : tab === 'ratified'
                  ? 'No amendments have reached ratification threshold yet.'
                  : 'No amendments have been rejected.'
            }
            actions={
              tab !== 'pending' && pendingCount > 0
                ? [{ label: 'View pending', onClick: () => setTab('pending') }]
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((amendment) => (
              <AmendmentCard
                key={amendment.id}
                amendment={amendment}
                onVote={handleVote}
                votingId={votingId}
              />
            ))}
          </div>
        )}

        {/* Related pages */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/law/${id}/revisions`}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-surface-100 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
                <FileText className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="text-xs font-mono font-semibold text-white">Revisions</p>
                <p className="text-[10px] font-mono text-surface-500">Edit history</p>
              </div>
            </Link>
            <Link
              href={`/law/${id}/community`}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-surface-100 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
                <Gavel className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="text-xs font-mono font-semibold text-white">Community</p>
                <p className="text-[10px] font-mono text-surface-500">Hub + notes</p>
              </div>
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
