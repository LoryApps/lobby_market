'use client'

/**
 * /thesis — Civic Thesis Board
 *
 * Users publish personal civic predictions — called "theses" — and stake
 * their reputation on them. Others agree or disagree. When time passes the
 * author marks each thesis Vindicated or Refuted and the platform tracks
 * their long-run accuracy.
 *
 * Distinct from:
 *   /predictions  — single-topic law-or-fail binary bets
 *   /pledges      — commitment to civic actions (not predictions)
 *   /debate       — live real-time structured debate
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  Flame,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Thesis, ThesisListResponse, ThesisCategory } from '@/lib/types/thesis'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    icon: CircleDot,
    color: 'text-for-400',
    bg: 'bg-for-500/10 border-for-500/30',
  },
  vindicated: {
    label: 'Vindicated',
    icon: Trophy,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/30',
  },
  refuted: {
    label: 'Refuted',
    icon: X,
    color: 'text-against-400',
    bg: 'bg-against-500/10 border-against-500/30',
  },
  expired: {
    label: 'Expired',
    icon: Clock,
    color: 'text-surface-500',
    bg: 'bg-surface-200 border-surface-300',
  },
}

type SortMode = 'newest' | 'popular' | 'expiring' | 'contested'
type StatusFilter = 'active' | 'vindicated' | 'refuted'

// ─── Create Thesis Modal ──────────────────────────────────────────────────────

function CreateThesisModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (t: Thesis) => void
}) {
  const [statement, setStatement] = useState('')
  const [rationale, setRationale] = useState('')
  const [category, setCategory] = useState<ThesisCategory>('politics')
  const [resolutionDate, setResolutionDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const charLeft = 280 - statement.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (statement.trim().length < 10) {
      setError('Thesis must be at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: statement.trim(),
          rationale: rationale.trim() || undefined,
          category,
          resolution_date: resolutionDate || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to publish thesis')
        return
      }
      const { thesis } = await res.json()
      onCreated(thesis)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0">
              <Scroll className="h-4 w-4 text-purple" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white">Publish a Thesis</h2>
              <p className="text-[11px] text-surface-500 font-mono">
                Stake your view on the future
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center text-surface-500 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Statement */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Thesis Statement *
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value.slice(0, 280))}
              placeholder="I believe that… / By 2030, … / Universal X will…"
              rows={3}
              className={cn(
                'w-full bg-surface-200 border rounded-xl px-4 py-3',
                'text-sm font-mono text-white placeholder:text-surface-500',
                'resize-none focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all',
                charLeft < 20
                  ? 'border-against-500/50 focus:ring-against-500/40'
                  : 'border-surface-300'
              )}
            />
            <div className="flex justify-end">
              <span
                className={cn(
                  'text-[11px] font-mono',
                  charLeft < 20
                    ? charLeft < 5
                      ? 'text-against-400'
                      : 'text-gold'
                    : 'text-surface-500'
                )}
              >
                {charLeft} left
              </span>
            </div>
          </div>

          {/* Rationale */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Rationale{' '}
              <span className="normal-case font-normal text-surface-600">(optional)</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value.slice(0, 1000))}
              placeholder="Why do you believe this? What evidence supports your view?"
              rows={2}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-surface-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all"
            />
          </div>

          {/* Category + Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Category
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ThesisCategory)}
                  className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-8 transition-all"
                >
                  {THESIS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Resolve by{' '}
                <span className="normal-case font-normal text-surface-600">(optional)</span>
              </label>
              <input
                type="date"
                value={resolutionDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setResolutionDate(e.target.value)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-mono text-against-400 bg-against-500/10 border border-against-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || statement.trim().length < 10}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono font-semibold bg-purple hover:bg-purple/90 text-white border border-purple/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Scroll className="h-3.5 w-3.5" />
                  Publish Thesis
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Thesis Vote Button ───────────────────────────────────────────────────────

function ThesisVoteButtons({
  thesis,
  isOwner,
  onVoted,
}: {
  thesis: Thesis
  isOwner: boolean
  onVoted: (id: string, agree: boolean | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const currentVote = thesis.viewer_vote

  async function vote(agree: boolean) {
    if (isOwner || busy) return
    setBusy(true)
    try {
      if (currentVote === agree) {
        // Toggle off
        await fetch(`/api/thesis/${thesis.id}/vote`, { method: 'DELETE' })
        onVoted(thesis.id, null)
      } else {
        await fetch(`/api/thesis/${thesis.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agree }),
        })
        onVoted(thesis.id, agree)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50

  return (
    <div className="mt-4 space-y-2">
      {/* Bar */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-for-400 w-8 text-right">
            {agreePct}%
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-against-900/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all duration-500"
              style={{ width: `${agreePct}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-against-400 w-8">
            {100 - agreePct}%
          </span>
        </div>
      )}

      {/* Buttons */}
      {!isOwner && thesis.status === 'active' && (
        <div className="flex gap-2">
          <button
            onClick={() => vote(true)}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg',
              'text-[11px] font-mono font-semibold border transition-all',
              currentVote === true
                ? 'bg-for-500/25 border-for-500/50 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/40 hover:text-for-400'
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            Agree{thesis.agree_count > 0 ? ` · ${thesis.agree_count}` : ''}
          </button>
          <button
            onClick={() => vote(false)}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg',
              'text-[11px] font-mono font-semibold border transition-all',
              currentVote === false
                ? 'bg-against-500/25 border-against-500/50 text-against-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400'
            )}
          >
            <ThumbsDown className="h-3 w-3" />
            Disagree{thesis.disagree_count > 0 ? ` · ${thesis.disagree_count}` : ''}
          </button>
        </div>
      )}

      {(isOwner || thesis.status !== 'active') && total > 0 && (
        <div className="flex gap-4 text-[11px] font-mono">
          <span className="text-for-400">
            <ThumbsUp className="h-3 w-3 inline mr-1" />
            {thesis.agree_count} agree
          </span>
          <span className="text-against-400">
            <ThumbsDown className="h-3 w-3 inline mr-1" />
            {thesis.disagree_count} disagree
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Thesis Card ──────────────────────────────────────────────────────────────

function ThesisCard({
  thesis,
  currentUserId,
  onVoted,
  onResolve,
}: {
  thesis: Thesis
  currentUserId: string | null
  onVoted: (id: string, agree: boolean | null) => void
  onResolve: (id: string, status: 'vindicated' | 'refuted') => void
}) {
  const isOwner = thesis.user_id === currentUserId
  const status = STATUS_CONFIG[thesis.status]
  const StatusIcon = status.icon
  const catColor = CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const [showResolve, setShowResolve] = useState(false)

  const daysLeft = thesis.resolution_date
    ? Math.ceil(
        (new Date(thesis.resolution_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-5 transition-colors"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {thesis.author && (
            <Link href={`/profile/${thesis.author.username}`} className="flex-shrink-0">
              <Avatar
                src={thesis.author.avatar_url}
                fallback={thesis.author.display_name || thesis.author.username}
                size="xs"
              />
            </Link>
          )}
          <div className="min-w-0">
            {thesis.author && (
              <Link
                href={`/profile/${thesis.author.username}`}
                className="text-xs font-mono font-semibold text-white hover:text-for-300 truncate block transition-colors"
              >
                {thesis.author.display_name || thesis.author.username}
              </Link>
            )}
            <p className="text-[10px] font-mono text-surface-500">
              {new Date(thesis.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              catColor
            )}
          >
            {thesis.category}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              status.bg,
              status.color
            )}
          >
            <StatusIcon className="h-2.5 w-2.5" />
            {status.label}
          </span>
        </div>
      </div>

      {/* Statement */}
      <p className="text-sm font-mono text-white leading-relaxed mb-1">
        {thesis.statement}
      </p>

      {/* Rationale preview */}
      {thesis.rationale && (
        <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-2 mt-1.5">
          {thesis.rationale}
        </p>
      )}

      {/* Resolution date + related topic */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
        {daysLeft !== null && thesis.status === 'active' && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-mono',
              daysLeft < 7
                ? 'text-against-400'
                : daysLeft < 30
                ? 'text-gold'
                : 'text-surface-500'
            )}
          >
            <Calendar className="h-2.5 w-2.5" />
            {daysLeft > 0 ? `${daysLeft}d to resolve` : 'Overdue for resolution'}
          </span>
        )}
        {thesis.resolved_at && thesis.status !== 'active' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Check className="h-2.5 w-2.5" />
            Resolved{' '}
            {new Date(thesis.resolved_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
        {thesis.related_topic_statement && (
          <Link
            href={`/topic/${thesis.related_topic_id}`}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-purple hover:text-purple/80 transition-colors"
          >
            <Zap className="h-2.5 w-2.5" />
            <span className="truncate max-w-[160px]">
              {thesis.related_topic_statement.slice(0, 48)}
              {thesis.related_topic_statement.length > 48 ? '…' : ''}
            </span>
          </Link>
        )}
      </div>

      {/* Votes */}
      <ThesisVoteButtons
        thesis={thesis}
        isOwner={isOwner}
        onVoted={onVoted}
      />

      {/* Owner resolve controls */}
      {isOwner && thesis.status === 'active' && (
        <div className="mt-3 pt-3 border-t border-surface-300">
          {showResolve ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-surface-500 mr-1">Mark as:</span>
              <button
                onClick={() => { onResolve(thesis.id, 'vindicated'); setShowResolve(false) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold text-[11px] font-mono font-semibold hover:bg-gold/30 transition-colors"
              >
                <Trophy className="h-3 w-3" /> Vindicated
              </button>
              <button
                onClick={() => { onResolve(thesis.id, 'refuted'); setShowResolve(false) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-against-500/20 border border-against-500/40 text-against-400 text-[11px] font-mono font-semibold hover:bg-against-500/30 transition-colors"
              >
                <X className="h-3 w-3" /> Refuted
              </button>
              <button
                onClick={() => setShowResolve(false)}
                className="px-2 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResolve(true)}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Scale className="h-3 w-3" />
              Resolve this thesis
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ThesisSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse"
        >
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ThesisPage() {
  const [theses, setTheses] = useState<Thesis[]>([])
  const [stats, setStats] = useState({ total_active: 0, total_vindicated: 0, total_refuted: 0 })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const [category, setCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [showCreate, setShowCreate] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const hasMore = theses.length < total

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(
    async (reset = true) => {
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
      } else {
        setLoadingMore(true)
      }
      try {
        const params = new URLSearchParams({
          sort,
          status: statusFilter,
          limit: '20',
          offset: String(offsetRef.current),
        })
        if (category) params.set('category', category)

        const res = await fetch(`/api/thesis?${params}`)
        if (!res.ok) return
        const data: ThesisListResponse = await res.json()

        if (reset) {
          setTheses(data.theses)
        } else {
          setTheses((prev) => [...prev, ...data.theses])
          offsetRef.current += data.theses.length
        }
        setTotal(data.total)
        setStats(data.stats)
        if (reset) offsetRef.current = data.theses.length
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [sort, category, statusFilter]
  )

  useEffect(() => {
    load(true)
  }, [load])

  function handleVoted(id: string, agree: boolean | null) {
    setTheses((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const oldVote = t.viewer_vote
        let agree_count = t.agree_count
        let disagree_count = t.disagree_count
        // Undo old vote
        if (oldVote === true) agree_count = Math.max(0, agree_count - 1)
        if (oldVote === false) disagree_count = Math.max(0, disagree_count - 1)
        // Apply new vote
        if (agree === true) agree_count++
        if (agree === false) disagree_count++
        return { ...t, viewer_vote: agree, agree_count, disagree_count }
      })
    )
  }

  async function handleResolve(id: string, status: 'vindicated' | 'refuted') {
    try {
      const res = await fetch(`/api/thesis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      const { thesis } = await res.json()
      setTheses((prev) => prev.map((t) => (t.id === id ? { ...t, ...thesis } : t)))
    } catch {
      // best-effort
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Scroll className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white">Civic Theses</h1>
              <p className="text-xs font-mono text-surface-400 mt-0.5">
                Personal predictions, staked on reputation
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple/20 border border-purple/30 hover:bg-purple/30 text-purple text-sm font-mono font-semibold transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Thesis</span>
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Active', value: stats.total_active, color: 'text-for-400', icon: CircleDot },
            { label: 'Vindicated', value: stats.total_vindicated, color: 'text-gold', icon: Trophy },
            { label: 'Refuted', value: stats.total_refuted, color: 'text-against-400', icon: X },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl py-3"
            >
              <Icon className={cn('h-4 w-4', color)} />
              <span className={cn('text-lg font-mono font-bold', color)}>{value}</span>
              <span className="text-[10px] font-mono text-surface-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Thesis of the Day banner */}
        <Link
          href="/thesis/today"
          className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-gradient-to-r from-gold/15 via-gold/8 to-transparent border border-gold/30 hover:border-gold/50 transition-all group"
        >
          <Sparkles className="h-5 w-5 text-gold shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gold uppercase tracking-wider">Thesis of the Day</p>
            <p className="text-xs text-surface-400 mt-0.5">Today&apos;s most contested civic prediction</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gold/50 group-hover:text-gold transition-colors shrink-0" />
        </Link>

        {/* Quick nav shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Link
            href="/thesis/my"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 transition-colors group"
          >
            <span className="text-xs font-mono text-purple/70 group-hover:text-purple transition-colors">
              My theses
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple/40 group-hover:text-purple transition-colors" />
          </Link>
          <Link
            href="/thesis/category"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
          >
            <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
              By category
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
          </Link>
          <Link
            href="/thesis/map"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 transition-colors group"
          >
            <span className="text-xs font-mono text-purple/70 group-hover:text-purple transition-colors">
              Thesis Map
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple/40 group-hover:text-purple transition-colors" />
          </Link>
          <Link
            href="/thesis/network"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 transition-colors group"
          >
            <span className="text-xs font-mono text-purple/70 group-hover:text-purple transition-colors">
              Network Graph
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple/40 group-hover:text-purple transition-colors" />
          </Link>
          <Link
            href="/thesis/rising"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald/5 border border-emerald/20 hover:border-emerald/40 transition-colors group"
          >
            <span className="text-xs font-mono text-emerald/70 group-hover:text-emerald transition-colors">
              Rising
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald/40 group-hover:text-emerald transition-colors" />
          </Link>
          <Link
            href="/thesis/digest"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 transition-colors group"
          >
            <span className="text-xs font-mono text-gold/70 group-hover:text-gold transition-colors">
              Weekly digest
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-gold/40 group-hover:text-gold transition-colors" />
          </Link>
          <Link
            href="/thesis/resolved"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-against-500/5 border border-against-500/20 hover:border-against-500/40 transition-colors group"
          >
            <span className="text-xs font-mono text-against-400/70 group-hover:text-against-400 transition-colors">
              Hall of Record
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-against-400/40 group-hover:text-against-400 transition-colors" />
          </Link>
          <Link
            href="/thesis/today"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 transition-colors group"
          >
            <span className="text-xs font-mono text-gold/70 group-hover:text-gold transition-colors">
              Today&apos;s Pick
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-gold/40 group-hover:text-gold transition-colors" />
          </Link>
          <Link
            href="/thesis/alignment"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-for-500/5 border border-for-500/20 hover:border-for-500/40 transition-colors group"
          >
            <span className="text-xs font-mono text-for-400/70 group-hover:text-for-400 transition-colors">
              Alignment
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-for-400/40 group-hover:text-for-400 transition-colors" />
          </Link>
          <Link
            href="/thesis/topics"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 transition-colors group"
          >
            <span className="text-xs font-mono text-purple/70 group-hover:text-purple transition-colors">
              Battlegrounds
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-purple/40 group-hover:text-purple transition-colors" />
          </Link>
          <Link
            href="/thesis/watching"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 transition-colors group"
          >
            <span className="text-xs font-mono text-gold/70 group-hover:text-gold transition-colors">
              Watchlist
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-gold/40 group-hover:text-gold transition-colors" />
          </Link>
        </div>

        {/* Filters */}
        <div className="space-y-2.5 mb-5">
          {/* Status tabs */}
          <div className="flex gap-1 p-1 bg-surface-200 rounded-xl border border-surface-300">
            {([
              { id: 'active', label: 'Active', icon: CircleDot },
              { id: 'vindicated', label: 'Vindicated', icon: Trophy },
              { id: 'refuted', label: 'Refuted', icon: X },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                  statusFilter === id
                    ? id === 'active'
                      ? 'bg-for-500/20 border border-for-500/40 text-for-400'
                      : id === 'vindicated'
                      ? 'bg-gold/20 border border-gold/40 text-gold'
                      : 'bg-against-500/20 border border-against-500/40 text-against-400'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Sort + Category row */}
          <div className="flex gap-2">
            {/* Sort */}
            <div className="relative flex-1">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-7 transition-all"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Agreed</option>
                <option value="contested">Most Contested</option>
                <option value="expiring">Expiring Soon</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-surface-500 pointer-events-none" />
            </div>

            {/* Category */}
            <div className="relative flex-1">
              <select
                value={category || ''}
                onChange={(e) => setCategory(e.target.value || null)}
                className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-7 transition-all"
              >
                <option value="">All Categories</option>
                {THESIS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-surface-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ThesisSkeleton />
        ) : theses.length === 0 ? (
          <EmptyState
            icon={Scroll}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No theses yet"
            description={
              statusFilter === 'active'
                ? 'Be the first to stake a civic thesis. Put your predictions on the record.'
                : `No ${statusFilter} theses found. Try a different filter.`
            }
            action={
              statusFilter === 'active'
                ? {
                    label: 'Publish a Thesis',
                    onClick: () => setShowCreate(true),
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {theses.map((t) => (
                <ThesisCard
                  key={t.id}
                  thesis={t}
                  currentUserId={currentUserId}
                  onVoted={handleVoted}
                  onResolve={handleResolve}
                />
              ))}
            </AnimatePresence>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      <AnimatePresence>
        {showCreate && (
          <CreateThesisModal
            onClose={() => setShowCreate(false)}
            onCreated={(t) => {
              setTheses((prev) => [t, ...prev])
              setTotal((n) => n + 1)
              setStats((s) => ({ ...s, total_active: s.total_active + 1 }))
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
