'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Loader2,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicBountyEntry } from '@/app/api/topics/[id]/bounties/route'

interface TopicBountyPanelProps {
  topicId: string
  topicStatus: string
  className?: string
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

function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return '< 1h left'
  if (h < 24) return `${h}h left`
  if (d < 7) return `${d}d left`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Post Bounty Form ─────────────────────────────────────────────────────────

interface PostFormProps {
  topicId: string
  userClout: number
  onPosted: (bounty: TopicBountyEntry) => void
  onCancel: () => void
}

function PostBountyForm({ topicId, userClout, onPosted, onCancel }: PostFormProps) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(10)
  const [side, setSide] = useState<'for' | 'against' | null>(null)
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (description.trim().length < 5) {
      setError('Description must be at least 5 characters')
      return
    }
    if (amount < 1 || amount > Math.min(500, userClout)) {
      setError(`Amount must be 1–${Math.min(500, userClout)} Clout`)
      return
    }
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/topics/${topicId}/bounties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description.trim(),
        amount,
        side: side ?? null,
        deadline: deadline || null,
      }),
    })

    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(json.error ?? 'Failed to post bounty')
      return
    }

    // Re-shape the raw bounty row into a TopicBountyEntry (names won't be populated yet)
    onPosted({
      ...json.bounty,
      creator_username: 'you',
      creator_display_name: null,
      creator_avatar_url: null,
      winner_username: null,
    } as TopicBountyEntry)
  }

  const maxAmount = Math.min(500, userClout)

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm font-semibold text-white">Post a Bounty</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-surface-500 hover:text-white transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="font-mono text-xs text-surface-400">
          What argument are you commissioning?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Make the strongest empirical case for the FOR side…"
          maxLength={280}
          rows={3}
          className={cn(
            'w-full rounded-lg border bg-surface-200 px-3 py-2',
            'font-mono text-sm text-white placeholder-surface-600 resize-none',
            'border-surface-300 focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500/40',
          )}
        />
        <p className="font-mono text-xs text-surface-600 text-right">
          {description.length}/280
        </p>
      </div>

      {/* Side preference */}
      <div className="space-y-1.5">
        <label className="font-mono text-xs text-surface-400">
          Preferred side (optional)
        </label>
        <div className="flex gap-2">
          {(['for', 'against', null] as const).map((s) => (
            <button
              key={String(s)}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-medium transition-colors',
                side === s
                  ? s === 'for'
                    ? 'border-for-500 bg-for-500/10 text-for-400'
                    : s === 'against'
                    ? 'border-against-500 bg-against-500/10 text-against-400'
                    : 'border-surface-400 bg-surface-300 text-white'
                  : 'border-surface-300 bg-transparent text-surface-500 hover:text-white'
              )}
            >
              {s === 'for' && <ThumbsUp className="h-3 w-3" />}
              {s === 'against' && <ThumbsDown className="h-3 w-3" />}
              {s === null ? 'Either side' : s === 'for' ? 'For' : 'Against'}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label className="font-mono text-xs text-surface-400">
          Bounty amount (Clout) — you have {userClout}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="flex-1 accent-gold"
          />
          <div className="flex items-center gap-1 min-w-[4rem]">
            <Coins className="h-3.5 w-3.5 text-gold" />
            <input
              type="number"
              min={1}
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(Math.min(maxAmount, Math.max(1, Number(e.target.value))))}
              className={cn(
                'w-16 rounded-lg border bg-surface-200 px-2 py-1',
                'font-mono text-sm text-white text-center',
                'border-surface-300 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40',
              )}
            />
          </div>
        </div>
      </div>

      {/* Deadline */}
      <div className="space-y-1.5">
        <label className="font-mono text-xs text-surface-400">
          Deadline (optional)
        </label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
          className={cn(
            'w-full rounded-lg border bg-surface-200 px-3 py-2',
            'font-mono text-sm text-white',
            'border-surface-300 focus:border-surface-400 focus:outline-none',
            '[color-scheme:dark]',
          )}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-against-400 font-mono text-xs">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          variant="gold"
          size="sm"
          disabled={submitting || userClout < 1}
          className="flex-1"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Coins className="h-3.5 w-3.5" />
          )}
          Post {amount} Clout Bounty
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.form>
  )
}

// ─── Bounty Card ──────────────────────────────────────────────────────────────

function BountyCard({ bounty }: { bounty: TopicBountyEntry }) {
  const dl = deadlineLabel(bounty.deadline)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-colors',
        bounty.status === 'awarded'
          ? 'border-gold/30 bg-gold/5'
          : bounty.status === 'expired'
          ? 'border-surface-300/40 opacity-60'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={bounty.creator_avatar_url}
            fallback={bounty.creator_display_name ?? bounty.creator_username}
            size="xs"
          />
          <span className="font-mono text-xs text-surface-400 truncate">
            {bounty.creator_display_name ?? bounty.creator_username}
          </span>
          <span className="font-mono text-xs text-surface-600">·</span>
          <span className="font-mono text-xs text-surface-600">{relativeTime(bounty.created_at)}</span>
        </div>

        {/* Amount + status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Coins className="h-3.5 w-3.5 text-gold" />
          <span className="font-mono text-sm font-bold text-gold">{bounty.amount}</span>
          {bounty.status === 'awarded' && (
            <Trophy className="h-3.5 w-3.5 text-gold ml-0.5" />
          )}
        </div>
      </div>

      {/* Description */}
      <p className="font-mono text-sm text-white leading-relaxed">{bounty.description}</p>

      {/* Footer tags */}
      <div className="flex flex-wrap items-center gap-2">
        {bounty.side && (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-medium',
              bounty.side === 'for'
                ? 'bg-for-500/10 text-for-400 border border-for-500/20'
                : 'bg-against-500/10 text-against-400 border border-against-500/20',
            )}
          >
            {bounty.side === 'for' ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {bounty.side === 'for' ? 'For' : 'Against'} only
          </span>
        )}
        {dl && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-surface-500">
            <Clock className="h-3 w-3" />
            {dl}
          </span>
        )}
        {bounty.status === 'awarded' && bounty.winner_username && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-gold">
            <Award className="h-3 w-3" />
            Won by @{bounty.winner_username}
          </span>
        )}
      </div>
    </motion.article>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function TopicBountyPanel({ topicId, topicStatus, className }: TopicBountyPanelProps) {
  const [bounties, setBounties] = useState<TopicBountyEntry[]>([])
  const [totalClout, setTotalClout] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [userClout, setUserClout] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const ineligible = topicStatus === 'law' || topicStatus === 'failed'

  const fetchBounties = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/bounties`)
      if (!res.ok) throw new Error('Failed to load bounties')
      const json = await res.json()
      setBounties(json.bounties ?? [])
      setTotalClout(json.total_clout ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading bounties')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  // Fetch user clout and id on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('profiles')
        .select('clout')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setUserClout(data?.clout ?? 0)
        })
    })
  }, [])

  useEffect(() => {
    fetchBounties()
  }, [fetchBounties])

  const handlePosted = useCallback((newBounty: TopicBountyEntry) => {
    setBounties((prev) => [newBounty, ...prev])
    setTotalClout((prev) => prev + newBounty.amount)
    setUserClout((prev) => prev - newBounty.amount)
    setShowForm(false)
  }, [])

  const visibleBounties = showAll ? bounties : bounties.slice(0, 5)
  const openBounties = bounties.filter((b) => b.status === 'open')

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="font-mono text-sm font-semibold text-white">Bounties</p>
          {openBounties.length > 0 && (
            <p className="font-mono text-xs text-surface-500">
              {openBounties.length} open &middot;{' '}
              <span className="text-gold font-semibold">{totalClout} Clout</span> pledged
            </p>
          )}
        </div>
        {userId && !ineligible && !showForm && (
          <Button
            size="sm"
            variant="gold"
            onClick={() => setShowForm(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Post Bounty
          </Button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <PostBountyForm
            key="form"
            topicId={topicId}
            userClout={userClout}
            onPosted={handlePosted}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Ineligible notice */}
      {ineligible && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
          <p className="font-mono text-xs text-surface-500">
            Bounties are not available for{' '}
            {topicStatus === 'law' ? 'established laws' : 'failed topics'}.
          </p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-against-500/20 bg-against-500/5 p-4">
          <AlertCircle className="h-4 w-4 text-against-400 flex-shrink-0" />
          <p className="font-mono text-sm text-against-400">{error}</p>
        </div>
      ) : bounties.length === 0 ? (
        <EmptyState
          icon={Coins}
          iconColor="text-gold"
          iconBg="bg-gold/10"
          iconBorder="border-gold/20"
          title="No bounties yet"
          description={
            ineligible
              ? undefined
              : userId
              ? 'Post a bounty to commission the best argument from the community.'
              : 'Sign in to post a bounty and commission arguments.'
          }
          size="sm"
          actions={
            !ineligible && userId
              ? [{ label: 'Post Bounty', onClick: () => setShowForm(true), icon: Plus }]
              : undefined
          }
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {visibleBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Show more / less */}
      {bounties.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1.5 font-mono text-xs text-surface-500 hover:text-white transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show {bounties.length - 5} more
            </>
          )}
        </button>
      )}
    </div>
  )
}
