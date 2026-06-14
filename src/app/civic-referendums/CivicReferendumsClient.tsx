'use client'

/**
 * /civic-referendums — Platform governance meta-voting.
 *
 * Any citizen can propose a referendum on platform features, community
 * guidelines, or civic policy. Once a referendum reaches 25 votes and
 * closes, it passes at ≥55% FOR or fails. Elders can veto.
 *
 * API:
 *   GET /api/referendums           → list open/closed referendums
 *   POST /api/referendums          → propose new referendum
 *   POST /api/referendums/[id]/vote → cast FOR/AGAINST
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type {
  ReferendumRow,
  ReferendumCategory,
  ReferendumsResponse,
} from '@/app/api/referendums/route'

// ─── Category config ────────────────────────────────────────────────────────

const CAT: Record<
  ReferendumCategory,
  { label: string; text: string; bg: string; border: string }
> = {
  governance: {
    label: 'Governance',
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  features: {
    label: 'Features',
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  community: {
    label: 'Community',
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  policy: {
    label: 'Policy',
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  other: {
    label: 'Other',
    text: 'text-surface-500',
    bg: 'bg-surface-200/60',
    border: 'border-surface-300/40',
  },
}

const STATUS_CONFIG: Record<
  string,
  { label: string; text: string; bg: string; border: string }
> = {
  open: { label: 'Open', text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  passed: { label: 'Passed', text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  failed: { label: 'Failed', text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  vetoed: { label: 'Vetoed', text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
}

const CATEGORY_OPTIONS: { value: ReferendumCategory; label: string }[] = [
  { value: 'governance', label: 'Governance — platform meta-rules' },
  { value: 'features', label: 'Features — request new platform features' },
  { value: 'community', label: 'Community — conduct and culture' },
  { value: 'policy', label: 'Policy — civic topic guidelines' },
  { value: 'other', label: 'Other' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `${d}d ${h}h left`
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

// ─── Referendum card ─────────────────────────────────────────────────────────

function ReferendumCard({
  referendum,
  onVoteCast,
}: {
  referendum: ReferendumRow
  onVoteCast: (id: string, vote: 'for' | 'against', result: { for_votes: number; against_votes: number; total: number; for_pct: number }) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState<'for' | 'against' | null>(
    referendum.user_vote,
  )
  const [localCounts, setLocalCounts] = useState({
    for_votes: referendum.for_votes,
    against_votes: referendum.against_votes,
    total: referendum.total_votes,
    for_pct: referendum.for_pct,
  })

  const isOpen = referendum.status === 'open'
  const cat = CAT[referendum.category] ?? CAT.other
  const statusCfg = STATUS_CONFIG[referendum.status] ?? STATUS_CONFIG.open
  const quorumPct = Math.min(100, (localCounts.total / referendum.quorum_required) * 100)

  async function castVote(vote: 'for' | 'against') {
    if (voting || !isOpen) return
    setVoting(true)
    try {
      const res = await fetch(`/api/referendums/${referendum.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.ok) {
          setLocalVote(vote)
          const newCounts = {
            for_votes: json.for_votes,
            against_votes: json.against_votes,
            total: json.total,
            for_pct: json.for_pct,
          }
          setLocalCounts(newCounts)
          onVoteCast(referendum.id, vote, newCounts)
        }
      }
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300/50 bg-surface-100/50 overflow-hidden"
    >
      <div className="p-5 space-y-4">
        {/* Top row: category + status */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className={cn(
              'font-mono text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
              cat.text,
              cat.bg,
              cat.border,
            )}
          >
            {cat.label}
          </span>
          <span
            className={cn(
              'font-mono text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
              statusCfg.text,
              statusCfg.bg,
              statusCfg.border,
            )}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* Question */}
        <p className="font-mono text-sm font-bold text-white leading-snug">
          {referendum.question}
        </p>

        {/* Description (expandable) */}
        {referendum.description && (
          <div>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-xs text-surface-500 leading-relaxed overflow-hidden mb-2"
                >
                  {referendum.description}
                </motion.p>
              )}
            </AnimatePresence>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 font-mono text-[11px] text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Read more
                </>
              )}
            </button>
          </div>
        )}

        {/* Vote bar */}
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-surface-300/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all duration-500"
              style={{ width: `${localCounts.for_pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-for-400">
              {localCounts.for_votes} FOR ({localCounts.for_pct.toFixed(0)}%)
            </span>
            <span className="text-against-400">
              {localCounts.against_votes} AGAINST
            </span>
          </div>
        </div>

        {/* Quorum indicator */}
        <div className="space-y-1">
          <div className="flex items-center justify-between font-mono text-[10px] text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Quorum: {localCounts.total}/{referendum.quorum_required} votes
            </span>
            {referendum.quorum_met && (
              <span className="text-emerald font-bold">Quorum met</span>
            )}
          </div>
          <div className="h-1 rounded-full bg-surface-300/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple transition-all duration-500"
              style={{ width: `${quorumPct}%` }}
            />
          </div>
        </div>

        {/* Proposer + meta */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            href={`/profile/${referendum.proposer_username}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={referendum.proposer_avatar_url}
              fallback={referendum.proposer_display_name || referendum.proposer_username}
              size="xs"
            />
            <span className="font-mono text-[11px] text-surface-500">
              @{referendum.proposer_username}
            </span>
          </Link>
          <div className="flex items-center gap-1 font-mono text-[10px] text-surface-600">
            <Clock className="h-3 w-3" />
            {isOpen ? timeLeft(referendum.closes_at) : timeAgo(referendum.closes_at)}
          </div>
        </div>
      </div>

      {/* Vote actions (only when open) */}
      {isOpen && (
        <div className="border-t border-surface-300/40 p-3 flex gap-2">
          {localVote ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-1">
              <Check className="h-4 w-4 text-gold" />
              <span className="font-mono text-xs text-gold font-bold">
                You voted {localVote === 'for' ? 'FOR' : 'AGAINST'}
              </span>
              <span className="font-mono text-[10px] text-surface-600">(you can change your vote)</span>
            </div>
          ) : null}
          <button
            onClick={() => castVote('for')}
            disabled={voting}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border font-mono text-xs font-bold transition-all',
              localVote === 'for'
                ? 'bg-for-500/20 border-for-500/50 text-for-300'
                : 'bg-surface-200/40 border-surface-300/40 text-surface-400 hover:border-for-500/50 hover:text-for-400 hover:bg-for-500/10',
            )}
          >
            {voting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className="h-3.5 w-3.5" />
            )}
            FOR
          </button>
          <button
            onClick={() => castVote('against')}
            disabled={voting}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border font-mono text-xs font-bold transition-all',
              localVote === 'against'
                ? 'bg-against-500/20 border-against-500/50 text-against-300'
                : 'bg-surface-200/40 border-surface-300/40 text-surface-400 hover:border-against-500/50 hover:text-against-400 hover:bg-against-500/10',
            )}
          >
            {voting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5" />
            )}
            AGAINST
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Propose form ─────────────────────────────────────────────────────────────

function ProposeForm({
  onCancel,
}: {
  onCancel: () => void
}) {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ReferendumCategory>('features')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    questionRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const q = question.trim()
    if (q.length < 10 || q.length > 200) {
      setError('Question must be 10–200 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/referendums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, description: description.trim() || undefined, category }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to create referendum.')
        return
      }
      // Refresh the list by re-fetching (simpler than constructing the full row)
      window.location.reload()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="rounded-2xl border border-purple/40 bg-purple/5 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-purple" />
          <h3 className="font-mono text-sm font-bold text-white">Propose a Referendum</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-surface-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Question */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] text-surface-500 font-bold uppercase tracking-wider">
            Question *
          </label>
          <textarea
            ref={questionRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Should Lobby Market add a dark mode toggle in the sidebar?"
            maxLength={200}
            rows={2}
            className="w-full bg-surface-200/60 border border-surface-300/60 rounded-xl px-3 py-2.5 font-mono text-sm text-white placeholder-surface-500 resize-none focus:outline-none focus:border-purple/60 transition-colors"
          />
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-surface-600">Min 10, max 200 characters</span>
            <span
              className={cn(
                'font-mono text-[10px]',
                question.length > 200
                  ? 'text-against-400'
                  : question.length > 170
                    ? 'text-gold'
                    : 'text-surface-600',
              )}
            >
              {question.length}/200
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] text-surface-500 font-bold uppercase tracking-wider">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context, reasoning, or a link to discussion…"
            maxLength={1500}
            rows={3}
            className="w-full bg-surface-200/60 border border-surface-300/60 rounded-xl px-3 py-2.5 font-mono text-sm text-white placeholder-surface-500 resize-none focus:outline-none focus:border-purple/60 transition-colors"
          />
          <span className="font-mono text-[10px] text-surface-600 text-right block">
            {description.length}/1500
          </span>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] text-surface-500 font-bold uppercase tracking-wider">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => {
              const c = CAT[opt.value]
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all',
                    category === opt.value
                      ? cn(c.text, c.bg, c.border)
                      : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:border-surface-400/60',
                  )}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-against-400 mt-0.5 shrink-0" />
            <p className="font-mono text-xs text-against-300">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || question.trim().length < 10}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple border border-purple/50 font-mono text-sm font-bold text-white hover:bg-purple/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Vote className="h-4 w-4" />
            )}
            Submit Referendum
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-surface-300/60 font-mono text-sm text-surface-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="font-mono text-[10px] text-surface-600 text-center">
          Max 2 open referendums per user · 7-day window · 25 votes to reach quorum · 55% FOR to pass
        </p>
      </form>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

type Tab = 'open' | 'closed'

export function CivicReferendumsClient() {
  const [data, setData] = useState<ReferendumsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('open')
  const [showForm, setShowForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/referendums?filter=all&limit=60`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setData(json as ReferendumsResponse)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleVoteCast = useCallback(
    (
      id: string,
      vote: 'for' | 'against',
      result: { for_votes: number; against_votes: number; total: number; for_pct: number },
    ) => {
      setData((prev) => {
        if (!prev) return prev
        const update = (arr: ReferendumRow[]) =>
          arr.map((r) =>
            r.id === id
              ? {
                  ...r,
                  user_vote: vote,
                  for_votes: result.for_votes,
                  against_votes: result.against_votes,
                  total_votes: result.total,
                  for_pct: result.for_pct,
                  quorum_met: result.total >= r.quorum_required,
                }
              : r,
          )
        return { ...prev, open: update(prev.open), closed: update(prev.closed) }
      })
    },
    [],
  )

  const displayed = data ? (tab === 'open' ? data.open : data.closed) : []
  const openCount = data?.open.length ?? 0
  const closedCount = data?.closed.length ?? 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* ── Back ── */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-purple" />
              <span className="font-mono text-xs font-bold text-purple uppercase tracking-widest">
                Civic Referendums
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white leading-tight">
              You Govern the Platform
            </h1>
            <p className="font-mono text-xs text-surface-500 max-w-lg">
              Propose changes to platform features, community guidelines, or civic policy.
              Reach 25 votes to count. Pass at 55% FOR. Elders may veto.
            </p>
          </motion.div>

          {/* ── Tabs + Propose ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex gap-1 bg-surface-200/60 rounded-xl p-1">
              {(['open', 'closed'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all capitalize',
                    tab === t
                      ? 'bg-surface-300/80 text-white'
                      : 'text-surface-500 hover:text-white',
                  )}
                >
                  {t}
                  {' '}
                  <span className="opacity-60">
                    ({t === 'open' ? openCount : closedCount})
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowForm((f) => !f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border font-mono text-xs font-bold transition-all',
                showForm
                  ? 'bg-surface-300/60 border-surface-400/60 text-white'
                  : 'bg-purple/10 border-purple/40 text-purple hover:bg-purple/20',
              )}
            >
              {showForm ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Propose
                </>
              )}
            </button>
          </motion.div>

          {/* ── Propose form ── */}
          <AnimatePresence>
            {showForm && (
              <ProposeForm onCancel={() => setShowForm(false)} />
            )}
          </AnimatePresence>

          {/* ── Loading ── */}
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <div className="text-center py-16 space-y-3">
              <p className="font-mono text-sm text-surface-500">
                Failed to load referendums.
              </p>
              <button
                onClick={() => { setError(false); setRefreshKey((k) => k + 1) }}
                className="flex items-center gap-2 mx-auto font-mono text-xs text-for-400 hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}

          {/* ── Content ── */}
          {!loading && !error && data && (
            <>
              {displayed.length === 0 ? (
                <EmptyState
                  icon={Vote}
                  title={
                    tab === 'open'
                      ? 'No open referendums'
                      : 'No closed referendums yet'
                  }
                  description={
                    tab === 'open'
                      ? 'Be the first to propose a change to the platform.'
                      : 'Closed referendums will appear here once they expire.'
                  }
                  actions={
                    tab === 'open'
                      ? [{ label: 'Propose a referendum', onClick: () => setShowForm(true) }]
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-4">
                  {displayed.map((ref) => (
                    <ReferendumCard
                      key={ref.id}
                      referendum={ref}
                      onVoteCast={handleVoteCast}
                    />
                  ))}
                </div>
              )}

              {/* Context note */}
              {data && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl border border-surface-300/30 bg-surface-100/30 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 text-surface-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-mono text-xs font-bold text-surface-400">
                        About referendums
                      </p>
                      <p className="font-mono text-[11px] text-surface-600 leading-relaxed">
                        Any citizen can propose a referendum. A 7-day window is given to reach
                        quorum (25 votes). Referendums that reach quorum pass at ≥55% FOR and
                        inform platform direction. Elders can veto. You may change your vote
                        at any time while it&apos;s open.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
