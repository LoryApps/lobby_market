'use client'

/**
 * /civic-polls — Community Quick Polls
 *
 * Lightweight multi-option community polls, distinct from the formal
 * FOR/AGAINST topic-voting mechanism.  Citizens can:
 *   • Browse and vote on active polls
 *   • See live results after voting
 *   • Create new polls (2–4 options, optional category + topic link)
 *   • Filter by category or status (active / closed / mine)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Vote,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { CivicPollRow, PollOption, CivicPollsResponse } from '@/app/api/civic-polls/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const DURATIONS = [
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
  { label: '72 hours', value: 72 },
  { label: '1 week', value: 168 },
]

const CAT_STYLE: Record<string, string> = {
  Economics:   'text-gold bg-gold/10 border-gold/30',
  Politics:    'text-for-400 bg-for-500/10 border-for-500/30',
  Technology:  'text-purple bg-purple/10 border-purple/30',
  Science:     'text-emerald bg-emerald/10 border-emerald/30',
  Ethics:      'text-against-400 bg-against-500/10 border-against-500/30',
  Philosophy:  'text-for-300 bg-for-400/10 border-for-400/20',
  Culture:     'text-gold bg-gold/10 border-gold/20',
  Health:      'text-against-300 bg-against-500/10 border-against-500/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
  Education:   'text-purple bg-purple/10 border-purple/30',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pct(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

// ─── Poll Card ────────────────────────────────────────────────────────────────

function PollCard({
  poll,
  onVote,
  userId,
}: {
  poll: CivicPollRow
  onVote: (pollId: string, optionId: string) => Promise<void>
  userId: string | null
}) {
  const [voting, setVoting] = useState<string | null>(null)
  const [localVote, setLocalVote] = useState<string | null>(poll.user_vote)
  const [localCounts, setLocalCounts] = useState<Record<string, number>>(poll.vote_counts)
  const [localTotal, setLocalTotal] = useState(poll.total_votes)
  const [error, setError] = useState<string | null>(null)

  const isClosed = poll.is_closed || new Date(poll.expires_at) < new Date()
  const hasVoted = localVote !== null
  const showResults = hasVoted || isClosed

  async function handleVote(optionId: string) {
    if (!userId || hasVoted || isClosed || voting) return
    setVoting(optionId)
    setError(null)
    try {
      await onVote(poll.id, optionId)
      // Optimistic update
      setLocalVote(optionId)
      setLocalCounts((prev) => ({
        ...prev,
        [optionId]: (prev[optionId] ?? 0) + 1,
      }))
      setLocalTotal((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to vote')
    } finally {
      setVoting(null)
    }
  }

  const winnerCount = Math.max(...Object.values(localCounts), 0)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            src={poll.author?.avatar_url ?? null}
            username={poll.author?.username ?? '?'}
            size="sm"
          />
          <div className="min-w-0">
            <Link
              href={`/profile/${poll.author?.username ?? ''}`}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors truncate block"
            >
              {poll.author?.display_name ?? poll.author?.username ?? 'Unknown'}
            </Link>
            <span className="text-xs font-mono text-surface-600">
              {relativeTime(poll.created_at)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {poll.category && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
                CAT_STYLE[poll.category] ?? 'text-surface-400 bg-surface-300/40 border-surface-400/40'
              )}
            >
              {poll.category}
            </span>
          )}
          {isClosed ? (
            <span className="text-[10px] font-mono text-surface-600 bg-surface-300/50 border border-surface-400/30 rounded px-1.5 py-0.5">
              CLOSED
            </span>
          ) : (
            <span className="text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/30 rounded px-1.5 py-0.5 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeLeft(poll.expires_at)}
            </span>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="text-sm font-mono font-semibold text-white leading-relaxed">
        {poll.question}
      </p>

      {/* Topic link */}
      {poll.topic_id && poll.topic_statement && (
        <Link
          href={`/topic/${poll.topic_id}`}
          className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors line-clamp-1"
        >
          Re: {poll.topic_statement}
        </Link>
      )}

      {/* Options */}
      <div className="space-y-2">
        {(poll.options as PollOption[]).map((opt) => {
          const count = localCounts[opt.id] ?? 0
          const p = pct(count, localTotal)
          const isWinner = showResults && count === winnerCount && winnerCount > 0
          const isUserChoice = localVote === opt.id

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={!userId || hasVoted || isClosed || voting !== null}
              className={cn(
                'relative w-full rounded-xl overflow-hidden text-left transition-all',
                showResults
                  ? 'cursor-default'
                  : userId && !hasVoted && !isClosed
                  ? 'hover:border-for-500/50 hover:bg-surface-200 cursor-pointer'
                  : 'cursor-default',
                'border',
                isUserChoice
                  ? 'border-for-500/60 bg-for-900/30'
                  : isWinner && showResults
                  ? 'border-gold/40 bg-gold/5'
                  : 'border-surface-300 bg-surface-200/50'
              )}
            >
              {/* Progress bar */}
              {showResults && (
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 transition-all duration-700',
                    isUserChoice ? 'bg-for-600/25' : isWinner ? 'bg-gold/15' : 'bg-surface-300/30'
                  )}
                  style={{ width: `${p}%` }}
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  {voting === opt.id ? (
                    <Loader2 className="h-3.5 w-3.5 text-for-400 animate-spin flex-shrink-0" />
                  ) : isUserChoice ? (
                    <Check className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                  ) : (
                    <div
                      className={cn(
                        'h-3.5 w-3.5 rounded-full border flex-shrink-0',
                        showResults ? 'border-surface-500' : 'border-surface-400'
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'text-sm font-mono',
                      isUserChoice
                        ? 'text-for-300 font-semibold'
                        : isWinner && showResults
                        ? 'text-gold font-semibold'
                        : 'text-surface-300'
                    )}
                  >
                    {opt.label}
                  </span>
                </div>
                {showResults && (
                  <span
                    className={cn(
                      'text-xs font-mono font-bold flex-shrink-0',
                      isUserChoice ? 'text-for-400' : isWinner ? 'text-gold' : 'text-surface-500'
                    )}
                  >
                    {p}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs font-mono text-surface-500">
        <span className="flex items-center gap-1.5">
          <Vote className="h-3.5 w-3.5" />
          {localTotal.toLocaleString()} vote{localTotal !== 1 ? 's' : ''}
        </span>
        {!userId && !isClosed && (
          <Link href="/login" className="text-for-400 hover:text-for-300 transition-colors">
            Sign in to vote
          </Link>
        )}
        {error && <span className="text-against-400">{error}</span>}
      </div>
    </motion.div>
  )
}

// ─── Poll Skeleton ────────────────────────────────────────────────────────────

function PollSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="h-5 w-4/5" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ─── Create Poll Modal ────────────────────────────────────────────────────────

function CreatePollModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [category, setCategory] = useState('')
  const [durationHours, setDurationHours] = useState(48)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addOption() {
    if (options.length < 4) setOptions((o) => [...o, ''])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions((o) => o.filter((_, idx) => idx !== i))
  }

  function setOption(i: number, val: string) {
    setOptions((o) => o.map((v, idx) => (idx === i ? val : v)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const filledOptions = options.filter((o) => o.trim().length > 0)
    if (filledOptions.length < 2) {
      setError('At least 2 options required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/civic-polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          options: filledOptions.map((l) => ({ label: l })),
          category: category || undefined,
          duration_hours: durationHours,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create poll')
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-lg rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-mono font-bold text-white">New Poll</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-surface-400 uppercase tracking-wide">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask the community something…"
              maxLength={200}
              rows={2}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 resize-none outline-none focus:border-surface-400 transition-colors font-mono"
              required
            />
            <p className="text-right text-[11px] font-mono text-surface-600">
              {question.length}/200
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-surface-400 uppercase tracking-wide">
              Options (2–4)
            </label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  maxLength={80}
                  className="flex-1 bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none focus:border-surface-400 transition-colors font-mono"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="p-1.5 rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-900/30 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add option
              </button>
            )}
          </div>

          {/* Category + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-surface-400 uppercase tracking-wide">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-surface-400 transition-colors font-mono appearance-none cursor-pointer"
              >
                <option value="">None</option>
                {CATEGORIES.slice(1).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-surface-400 uppercase tracking-wide">
                Duration
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-surface-400 transition-colors font-mono appearance-none cursor-pointer"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs font-mono text-against-400 bg-against-900/20 border border-against-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !question.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600 hover:bg-for-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-mono font-semibold transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
            {saving ? 'Creating…' : 'Create Poll'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicPollsClient() {
  const [polls, setPolls] = useState<CivicPollRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<'active' | 'closed' | 'mine'>('active')
  const [category, setCategory] = useState('All')
  const [showCreate, setShowCreate] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const LIMIT = 12

  // Load user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [])

  const fetchPolls = useCallback(
    async (reset = true) => {
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams({
        filter,
        limit: String(LIMIT),
        offset: String(reset ? 0 : offsetRef.current),
      })
      if (category !== 'All') params.set('category', category)

      const res = await fetch(`/api/civic-polls?${params}`)
      const data: CivicPollsResponse = await res.json()

      if (reset) {
        setPolls(data.polls)
      } else {
        setPolls((p) => [...p, ...data.polls])
      }
      setTotal(data.total)
      offsetRef.current = (reset ? 0 : offsetRef.current) + data.polls.length
      setLoading(false)
      setLoadingMore(false)
    },
    [filter, category]
  )

  useEffect(() => {
    fetchPolls(true)
  }, [fetchPolls])

  async function handleVote(pollId: string, optionId: string) {
    const res = await fetch(`/api/civic-polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Vote failed')
    }
  }

  const hasMore = polls.length < total

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-mono font-bold text-white flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-for-400" />
              Civic Polls
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Quick community votes on what matters
            </p>
          </div>
          {userId && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Poll
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Status filter */}
          <div className="flex gap-2">
            {(['active', 'closed', 'mine'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors capitalize',
                  filter === f
                    ? f === 'active'
                      ? 'bg-emerald/15 text-emerald border-emerald/40'
                      : f === 'closed'
                      ? 'bg-surface-300 text-white border-surface-400'
                      : 'bg-for-600/80 text-white border-for-600'
                    : 'bg-surface-200/50 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                )}
              >
                {f === 'mine' ? 'My Polls' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-colors flex-shrink-0',
                  category === c
                    ? c === 'All'
                      ? 'bg-surface-300 text-white border-surface-400'
                      : (CAT_STYLE[c] ?? 'bg-surface-300 text-white border-surface-400')
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-between text-xs font-mono text-surface-500">
          <span>{total.toLocaleString()} poll{total !== 1 ? 's' : ''}</span>
          <button
            onClick={() => fetchPolls(true)}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Poll list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <PollSkeleton key={i} />)}
          </div>
        ) : polls.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title={filter === 'mine' ? 'No polls yet' : 'No polls found'}
            description={
              filter === 'mine'
                ? 'Create your first poll to ask the community a question.'
                : filter === 'active'
                ? 'No active polls right now. Be the first to ask something.'
                : 'No closed polls match these filters.'
            }
            action={
              userId
                ? { label: 'Create Poll', onClick: () => setShowCreate(true) }
                : { label: 'Sign in to create', href: '/login' }
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {polls.map((poll) => (
                <PollCard key={poll.id} poll={poll} onVote={handleVote} userId={userId} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => fetchPolls(false)}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreatePollModal
            onClose={() => setShowCreate(false)}
            onCreated={() => fetchPolls(true)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
