'use client'

/**
 * /amendments — The Amendment Chamber
 *
 * Browse all community-proposed amendments to established laws.
 * Citizens can vote FOR or AGAINST each amendment. An amendment that
 * reaches 60% support with ≥ 20 votes gets ratified into law history.
 *
 * Distinct from the law reopen petition system — amendments refine
 * or extend laws without repealing them.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AmendmentEntry, AllAmendmentsResponse } from '@/app/api/amendments/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const RATIFY_THRESHOLD_PCT = 60
const RATIFY_MIN_VOTES = 20

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function daysLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'expires today'
  return `${d}d left`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AmendmentSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-5 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ─── Amendment card ────────────────────────────────────────────────────────────

interface AmendmentCardProps {
  amendment: AmendmentEntry
  onVote: (id: string, vote: boolean | null) => Promise<void>
}

function AmendmentCard({ amendment: a, onVote }: AmendmentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [localVote, setLocalVote] = useState<boolean | null>(a.user_vote)
  const [forCount, setForCount]   = useState(a.for_count)
  const [against, setAgainst]     = useState(a.against_count)
  const [busy, setBusy]           = useState(false)

  const total = forCount + against
  const pct   = total > 0 ? Math.round((forCount / total) * 100) : 0
  const progressToRatify = Math.min(100, total > 0 ? Math.round((total / RATIFY_MIN_VOTES) * 100) : 0)
  const hasEnoughVotes   = total >= RATIFY_MIN_VOTES
  const isRatified       = a.status === 'ratified'
  const isRejected       = a.status === 'rejected'
  const isPending        = a.status === 'pending'

  const catColor = CATEGORY_COLOR[a.law?.category ?? ''] ?? 'text-surface-500'

  async function handleVote(vote: boolean) {
    if (busy || !isPending) return
    setBusy(true)
    const nextVote = localVote === vote ? null : vote
    const prevVote = localVote
    const prevFor = forCount
    const prevAgainst = against

    // Optimistic update
    setLocalVote(nextVote)
    if (nextVote === true) {
      setForCount((c) => c + 1)
      if (prevVote === false) setAgainst((c) => c - 1)
    } else if (nextVote === false) {
      setAgainst((c) => c + 1)
      if (prevVote === true) setForCount((c) => c - 1)
    } else {
      if (prevVote === true)  setForCount((c) => c - 1)
      if (prevVote === false) setAgainst((c) => c - 1)
    }

    try {
      await onVote(a.id, nextVote)
    } catch {
      setLocalVote(prevVote)
      setForCount(prevFor)
      setAgainst(prevAgainst)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        isRatified ? 'border-emerald/40' :
        isRejected ? 'border-against-500/30' :
        'border-surface-300/60 hover:border-surface-400/60',
        'transition-colors',
      )}
    >
      <div className="p-5 space-y-4">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">

            {/* Status + category */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {isRatified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Ratified
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-against-400 bg-against-500/10 border border-against-500/30 px-2 py-0.5 rounded-full">
                  <XCircle className="h-2.5 w-2.5" />
                  Rejected
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
                  <Edit3 className="h-2.5 w-2.5" />
                  Proposed
                </span>
              )}
              {a.law?.category && (
                <span className={cn('text-[10px] font-mono font-semibold', catColor)}>
                  {a.law.category}
                </span>
              )}
            </div>

            {/* Amendment title */}
            <h3 className="text-sm font-semibold text-white leading-snug">
              {a.title}
            </h3>
          </div>
        </div>

        {/* ── Law reference ──────────────────────────────────── */}
        {a.law && (
          <Link
            href={`/law/${a.law.id}`}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
          >
            <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" />
            <p className="text-xs text-surface-400 group-hover:text-white transition-colors line-clamp-1 flex-1 min-w-0">
              {a.law.statement}
            </p>
            <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0" />
          </Link>
        )}

        {/* ── Body (expandable) ──────────────────────────────── */}
        <div>
          <p
            className={cn(
              'text-xs text-surface-400 leading-relaxed',
              !expanded && 'line-clamp-3',
            )}
          >
            {a.body}
          </p>
          {a.body.length > 180 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-0.5"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" />Less</>
              ) : (
                <><ChevronDown className="h-3 w-3" />Read more</>
              )}
            </button>
          )}
        </div>

        {/* ── Vote progress ──────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className={cn(
              'font-semibold',
              hasEnoughVotes
                ? (pct >= RATIFY_THRESHOLD_PCT ? 'text-emerald' : 'text-against-400')
                : 'text-surface-500',
            )}>
              {pct}% FOR
            </span>
            <span className="text-surface-600">
              {total.toLocaleString()} vote{total !== 1 ? 's' : ''}
            </span>
            <span className={cn(
              'font-semibold',
              hasEnoughVotes
                ? (pct < RATIFY_THRESHOLD_PCT ? 'text-against-400' : 'text-emerald')
                : 'text-surface-500',
            )}>
              {100 - pct}% AGAINST
            </span>
          </div>

          {/* Split bar */}
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden flex">
            <div
              className={cn(
                'h-full rounded-l-full transition-all duration-500',
                pct >= RATIFY_THRESHOLD_PCT ? 'bg-emerald' : 'bg-for-500',
              )}
              style={{ width: `${pct}%` }}
            />
            <div
              className="h-full bg-against-500 rounded-r-full ml-auto transition-all duration-500"
              style={{ width: `${100 - pct}%` }}
            />
          </div>

          {/* Quorum progress (only for pending) */}
          {isPending && !hasEnoughVotes && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-gold/60 rounded-full transition-all duration-500"
                  style={{ width: `${progressToRatify}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-surface-600">
                {total}/{RATIFY_MIN_VOTES} quorum
              </span>
            </div>
          )}
        </div>

        {/* ── Actions row ────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">

          {/* Proposer + timestamp */}
          <div className="flex items-center gap-2 min-w-0">
            {a.proposer && (
              <Link
                href={`/profile/${a.proposer.username}`}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <Avatar
                  src={a.proposer.avatar_url}
                  fallback={a.proposer.display_name || a.proposer.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors truncate">
                  @{a.proposer.username}
                </span>
              </Link>
            )}
            <span className="text-[10px] font-mono text-surface-700 flex-shrink-0">
              · {relativeTime(a.created_at)}
            </span>
            {isPending && (
              <span className="text-[10px] font-mono text-surface-700 flex-shrink-0 flex items-center gap-0.5">
                · <Clock className="h-2.5 w-2.5" /> {daysLeft(a.expires_at)}
              </span>
            )}
          </div>

          {/* Vote buttons */}
          {isPending && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleVote(true)}
                disabled={busy}
                aria-label="Vote for this amendment"
                className={cn(
                  'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-mono font-semibold',
                  'border transition-all disabled:opacity-50',
                  localVote === true
                    ? 'bg-emerald/20 border-emerald/50 text-emerald'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-emerald/50 hover:text-emerald',
                )}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ThumbsUp className="h-3 w-3" />
                )}
                {forCount}
              </button>

              <button
                onClick={() => handleVote(false)}
                disabled={busy}
                aria-label="Vote against this amendment"
                className={cn(
                  'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-mono font-semibold',
                  'border transition-all disabled:opacity-50',
                  localVote === false
                    ? 'bg-against-500/20 border-against-500/50 text-against-400'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/50 hover:text-against-400',
                )}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ThumbsDown className="h-3 w-3" />
                )}
                {against}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AmendmentsPage() {
  const [amendments, setAmendments] = useState<AmendmentEntry[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'ratified' | 'rejected' | 'all'>('pending')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [showCats, setShowCats]     = useState(false)
  const [offset, setOffset]         = useState(0)
  const LIMIT = 20

  const fetchAmendments = useCallback(async (status: string, category: string, off: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status, limit: String(LIMIT), offset: String(off) })
      if (category !== 'All') params.set('category', category)
      const res = await fetch(`/api/amendments?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: AllAmendmentsResponse = await res.json()
      if (off === 0) {
        setAmendments(data.amendments)
      } else {
        setAmendments((prev) => [...prev, ...data.amendments])
      }
      setTotal(data.total)
    } catch {
      setError('Failed to load amendments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setOffset(0)
    fetchAmendments(statusFilter, categoryFilter, 0)
  }, [statusFilter, categoryFilter, fetchAmendments])

  async function handleVote(amendmentId: string, vote: boolean | null) {
    const res = await fetch(`/api/amendments/${amendmentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    })
    if (!res.ok) throw new Error('Vote failed')
    const data = await res.json()
    setAmendments((prev) =>
      prev.map((a) =>
        a.id === amendmentId
          ? { ...a, for_count: data.for_count, against_count: data.against_count, user_vote: data.user_vote, status: data.status }
          : a
      )
    )
  }

  const STATUS_TABS = [
    { id: 'pending',  label: 'Pending',  icon: Scale },
    { id: 'ratified', label: 'Ratified', icon: CheckCircle2 },
    { id: 'rejected', label: 'Rejected', icon: XCircle },
    { id: 'all',      label: 'All',      icon: FileText },
  ] as const

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 space-y-5">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <Edit3 className="h-4 w-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-mono text-xl font-bold text-white">
                Amendment Chamber
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Community proposals to refine and extend established laws
              </p>
            </div>
            <button
              onClick={() => fetchAmendments(statusFilter, categoryFilter, 0)}
              aria-label="Refresh"
              className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Explainer */}
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-3">
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              Citizens may propose amendments to any established law.
              An amendment is <span className="text-emerald font-semibold">ratified</span> when it
              reaches <span className="text-white font-semibold">{RATIFY_THRESHOLD_PCT}% FOR</span> with
              at least <span className="text-white font-semibold">{RATIFY_MIN_VOTES} votes</span>.
            </p>
          </div>
        </div>

        {/* ── Status tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {STATUS_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id as typeof statusFilter)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono font-semibold flex-shrink-0',
                'border transition-all',
                statusFilter === id
                  ? id === 'ratified' ? 'bg-emerald/20 border-emerald/50 text-emerald'
                  : id === 'rejected' ? 'bg-against-500/20 border-against-500/50 text-against-400'
                  : 'bg-gold/20 border-gold/50 text-gold'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Category filter ──────────────────────────────────────── */}
        <div className="relative">
          <button
            onClick={() => setShowCats((s) => !s)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
          >
            <FileText className="h-3 w-3" />
            {categoryFilter === 'All' ? 'All categories' : categoryFilter}
            {showCats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <AnimatePresence>
            {showCats && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                className="absolute top-10 left-0 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl p-2 flex flex-wrap gap-1.5 w-72"
              >
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setShowCats(false) }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                      categoryFilter === cat
                        ? 'bg-gold/20 border-gold/50 text-gold'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Results count ────────────────────────────────────────── */}
        {!loading && (
          <p className="text-[11px] font-mono text-surface-600">
            {total > 0 ? `${total} amendment${total !== 1 ? 's' : ''}` : 'No amendments found'}
            {categoryFilter !== 'All' ? ` in ${categoryFilter}` : ''}
          </p>
        )}

        {/* ── Amendment list ───────────────────────────────────────── */}
        {error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => fetchAmendments(statusFilter, categoryFilter, 0)}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : loading && amendments.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <AmendmentSkeleton key={i} />
            ))}
          </div>
        ) : amendments.length === 0 ? (
          <EmptyState
            icon={Edit3}
            title="No amendments yet"
            description={
              statusFilter === 'pending'
                ? 'Be the first to propose an amendment to a law. Navigate to any established law and click Propose Amendment.'
                : 'No amendments in this category match your filters.'
            }
            action={
              <Link
                href="/law"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
              >
                Browse laws <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {amendments.map((a) => (
                <AmendmentCard key={a.id} amendment={a} onVote={handleVote} />
              ))}
            </AnimatePresence>

            {/* Load more */}
            {amendments.length < total && (
              <button
                onClick={() => {
                  const nextOffset = offset + LIMIT
                  setOffset(nextOffset)
                  fetchAmendments(statusFilter, categoryFilter, nextOffset)
                }}
                disabled={loading}
                className={cn(
                  'w-full py-3 rounded-xl border border-surface-300 text-xs font-mono text-surface-500',
                  'hover:border-surface-400 hover:text-white transition-colors',
                  'disabled:opacity-50',
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  `Load more (${total - amendments.length} remaining)`
                )}
              </button>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
