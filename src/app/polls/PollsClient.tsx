'use client'

/**
 * /polls — Civic Quick Polls
 *
 * Lightweight community polling distinct from the formal topic/law pipeline.
 * Users post binary or multiple-choice questions (2–4 options), set a
 * duration, and results are revealed after voting.
 *
 * Distinct from:
 *  - /topic voting (formal FOR/AGAINST policy debate, days-long process)
 *  - /predictions  (market-style confidence staking on topic outcomes)
 *  - /challenge    (quorum-based daily voting quota)
 *
 * Uses table civic_polls + civic_poll_votes (migration 00071).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Hash,
  Loader2,
  Plus,
  RefreshCw,
  Timer,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PollWithResults } from '@/app/api/polls/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const FILTERS = ['active', 'all', 'mine'] as const
type Filter = (typeof FILTERS)[number]

const DURATION_OPTIONS = [
  { label: '1 hour',  hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '3 days',  hours: 72 },
  { label: '1 week',  hours: 168 },
]

const OPTION_COLORS = [
  'from-for-600 to-for-500',
  'from-against-600 to-against-500',
  'from-purple to-purple/70',
  'from-gold to-gold/70',
]

const OPTION_TEXT = [
  'text-for-300',
  'text-against-300',
  'text-purple',
  'text-gold',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Poll Card ────────────────────────────────────────────────────────────────

function PollCard({ poll, onVote }: { poll: PollWithResults; onVote: (pollId: string, optionId: string) => Promise<void> }) {
  const [voting, setVoting] = useState(false)
  const isExpired = new Date(poll.expires_at) < new Date() || poll.is_closed
  const hasVoted = !!poll.user_vote || isExpired

  async function handleVote(optionId: string) {
    if (hasVoted || voting) return
    setVoting(true)
    try {
      await onVote(poll.id, optionId)
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            src={poll.author_avatar_url}
            fallback={poll.author_display_name || poll.author_username}
            size="sm"
          />
          <div className="min-w-0">
            <Link href={`/profile/${poll.author_username}`} className="text-xs font-semibold text-white hover:text-for-400 transition-colors">
              {poll.author_display_name || poll.author_username}
            </Link>
            <p className="text-[11px] text-surface-500">{relativeTime(poll.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {poll.category && (
            <span className="inline-flex items-center rounded-full text-[10px] font-mono font-medium px-2 py-0.5 border border-surface-400/60 text-surface-400">
              {poll.category}
            </span>
          )}
          {isExpired ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Timer className="h-3 w-3" /> Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400">
              <Clock className="h-3 w-3" /> {timeLeft(poll.expires_at)}
            </span>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="text-base font-semibold text-white leading-snug">{poll.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const result = poll.results.find((r) => r.option_id === opt.id)
          const pct = result?.pct ?? 0
          const count = result?.count ?? 0
          const isSelected = poll.user_vote === opt.id
          const colorFrom = OPTION_COLORS[i % OPTION_COLORS.length]
          const textColor = OPTION_TEXT[i % OPTION_TEXT.length]

          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={hasVoted || voting}
              className={cn(
                'w-full text-left rounded-xl border transition-all relative overflow-hidden',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                hasVoted
                  ? isSelected
                    ? 'border-surface-400 bg-surface-200'
                    : 'border-surface-300/50 bg-surface-100/50'
                  : 'border-surface-300 bg-surface-200/50 hover:border-surface-400 hover:bg-surface-200 cursor-pointer',
                voting && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Progress bar fill */}
              {hasVoted && (
                <div
                  className={cn('absolute inset-y-0 left-0 bg-gradient-to-r opacity-20 transition-all duration-500', colorFrom)}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                  )}
                  {!isSelected && hasVoted && (
                    <div className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  {!hasVoted && voting && (
                    <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin flex-shrink-0" />
                  )}
                  {!hasVoted && !voting && (
                    <div className={cn('h-3.5 w-3.5 rounded-full border-2 flex-shrink-0', `border-${['for-500', 'against-500', 'purple', 'gold'][i % 4]}`)} />
                  )}
                  <span className={cn('text-sm font-medium truncate', hasVoted && isSelected ? 'text-white' : 'text-surface-700')}>
                    {opt.label}
                  </span>
                </div>
                {hasVoted && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs font-mono', isSelected ? textColor : 'text-surface-500')}>
                      {count} vote{count !== 1 ? 's' : ''}
                    </span>
                    <span className={cn('text-sm font-bold font-mono', isSelected ? textColor : 'text-surface-500')}>
                      {pct}%
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-[11px] text-surface-500 font-mono">
          <Users className="h-3 w-3" />
          <span>{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}</span>
        </div>
        {poll.topic_id && poll.topic_statement && (
          <Link
            href={`/topic/${poll.topic_id}`}
            className="inline-flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors font-mono"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate max-w-[160px]">Related topic</span>
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Create Poll Form ─────────────────────────────────────────────────────────

function CreatePollForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [category, setCategory] = useState('')
  const [durationHours, setDurationHours] = useState(24)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addOption() {
    if (options.length < 4) setOptions([...options, ''])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions(options.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, val: string) {
    setOptions(options.map((o, idx) => (idx === i ? val : o)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
    if (cleanOptions.length < 2) {
      setError('Add at least 2 options')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          options: cleanOptions,
          category: category || null,
          duration_hours: durationHours,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create poll')
        return
      }
      onCreated()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      onSubmit={handleSubmit}
      className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-white">Create a Poll</h3>
        <button type="button" onClick={onCancel} className="text-surface-500 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Question */}
      <div>
        <label className="block text-xs font-mono text-surface-500 mb-1.5">Question *</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What should the Lobby decide?"
          maxLength={200}
          rows={2}
          required
          className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 resize-none"
        />
        <p className="text-[11px] text-surface-500 mt-1 text-right">{question.length}/200</p>
      </div>

      {/* Options */}
      <div>
        <label className="block text-xs font-mono text-surface-500 mb-1.5">Options (2–4) *</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn('h-3 w-3 rounded-full flex-shrink-0', ['bg-for-500', 'bg-against-500', 'bg-purple', 'bg-gold'][i % 4])} />
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={100}
                className="flex-1 bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60"
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="text-surface-500 hover:text-against-400 transition-colors flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 4 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-for-400 hover:text-for-300 transition-colors font-mono"
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
        )}
      </div>

      {/* Category + Duration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-mono text-surface-500 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-for-500/60"
          >
            <option value="">None</option>
            {CATEGORIES.slice(1).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-surface-500 mb-1.5">Duration</label>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-for-500/60"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.hours} value={d.hours}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-against-400 font-mono">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" variant="for" size="sm" disabled={submitting} className="flex-1">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Vote className="h-3.5 w-3.5" />}
          {submitting ? 'Creating…' : 'Launch Poll'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PollsClient() {
  const [polls, setPolls] = useState<PollWithResults[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [category, setCategory] = useState('All')
  const [showCreate, setShowCreate] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user))
  }, [])

  const fetchPolls = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ filter, limit: '30' })
      if (category !== 'All') params.set('category', category)

      const res = await fetch(`/api/polls?${params}`, { cache: 'no-store' })
      const data = await res.json()
      setPolls(data.polls ?? [])
    } catch {
      setPolls([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, category])

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleVote(pollId: string, optionId: string) {
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    })
    if (!res.ok) return

    // Optimistic update: mark user vote and recalculate results
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p
        const total = p.total_votes + 1
        const results = p.options.map((opt) => {
          const existing = p.results.find((r) => r.option_id === opt.id)
          const count = (existing?.count ?? 0) + (opt.id === optionId ? 1 : 0)
          return { option_id: opt.id, count, pct: Math.round((count / total) * 100) }
        })
        return { ...p, user_vote: optionId, total_votes: total, results }
      })
    )
  }

  const activePollCount = polls.filter(
    (p) => !p.is_closed && new Date(p.expires_at) > new Date()
  ).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <BarChart2 className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Quick Polls</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading ? '…' : `${activePollCount} active`} · community questions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPolls(true)}
              disabled={refreshing}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-200 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh polls"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
            {isSignedIn && !showCreate && (
              <Button
                variant="for"
                size="sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" />
                New Poll
              </Button>
            )}
          </div>
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <div className="mb-4">
              <CreatePollForm
                onCreated={() => { setShowCreate(false); fetchPolls(true) }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {/* Filter tabs */}
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                filter === f
                  ? 'bg-for-600/20 text-for-300 border-for-500/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700'
              )}
            >
              {f === 'active' ? 'Active' : f === 'all' ? 'All time' : 'My polls'}
            </button>
          ))}

          {/* Category dropdown */}
          <div className="relative flex-shrink-0" ref={categoryRef}>
            <button
              onClick={() => setShowCategoryDropdown((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                category !== 'All'
                  ? 'bg-purple/20 text-purple border-purple/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700'
              )}
            >
              <Hash className="h-3 w-3" />
              {category === 'All' ? 'Category' : category}
              {showCategoryDropdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <AnimatePresence>
              {showCategoryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1 w-44 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden z-20"
                >
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategory(c); setShowCategoryDropdown(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === c ? 'text-purple bg-purple/10' : 'text-surface-500 hover:text-white hover:bg-surface-200'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : polls.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title={filter === 'mine' ? 'No polls yet' : 'No polls found'}
            description={
              filter === 'mine'
                ? 'Create your first civic poll to ask the community a question.'
                : filter === 'active'
                ? 'No active polls right now. Be the first to create one!'
                : 'No polls match your filters. Try a different category.'
            }
            actions={
              isSignedIn
                ? [{ label: 'Create a poll', onClick: () => setShowCreate(true) }]
                : [{ label: 'Sign in to create polls', href: '/login' }]
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {polls.map((poll) => (
                <PollCard key={poll.id} poll={poll} onVote={handleVote} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info footer */}
        {!loading && polls.length > 0 && (
          <div className="mt-8 p-4 bg-surface-100 border border-surface-300/50 rounded-xl text-center">
            <p className="text-xs text-surface-500 font-mono">
              Quick polls are informal community questions. For formal policy votes,{' '}
              <Link href="/" className="text-for-400 hover:underline">browse topics →</Link>
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
