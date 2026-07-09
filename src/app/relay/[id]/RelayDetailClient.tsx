'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RelayRow, RelayLeg } from '@/app/api/relays/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RelayDetail extends RelayRow {
  topic_blue_pct?: number
  topic_total_votes?: number
}

interface RelayDetailResponse {
  relay: RelayDetail
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/30' },
  in_progress: { label: 'In Progress', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  complete:    { label: 'Complete',    color: 'text-purple',  bg: 'bg-purple/10',  border: 'border-purple/30' },
  voted:       { label: 'Voted',       color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
} as const

const TOPIC_STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Leg step dots ────────────────────────────────────────────────────────────

function LegSteps({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${filled} of ${total} legs added`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 flex-1 rounded-full transition-all duration-300',
            i < filled ? 'bg-for-500' : 'bg-surface-300'
          )}
        />
      ))}
    </div>
  )
}

// ─── Single leg card ──────────────────────────────────────────────────────────

function LegCard({
  leg,
  index,
  total,
  side,
  relayId,
  canStar,
}: {
  leg: RelayLeg
  index: number
  total: number
  side: 'for' | 'against'
  relayId: string
  canStar: boolean
}) {
  const isLast = index === total - 1
  const lineColor = side === 'for' ? 'bg-for-500/40' : 'bg-against-500/40'
  const [upvoted, setUpvoted] = useState(leg.user_upvoted)
  const [upvoteCount, setUpvoteCount] = useState(leg.upvote_count)
  const [starring, setStarring] = useState(false)

  async function toggleStar() {
    if (!canStar || starring) return
    setStarring(true)
    try {
      const res = await fetch(`/api/relays/${relayId}/legs/${leg.id}/upvote`, { method: 'POST' })
      if (res.ok) {
        const json = await res.json()
        setUpvoted(json.upvoted)
        setUpvoteCount(json.upvote_count)
      }
    } finally {
      setStarring(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="relative flex gap-4"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold font-mono',
            side === 'for'
              ? 'border-for-500/60 bg-for-500/10 text-for-300'
              : 'border-against-500/60 bg-against-500/10 text-against-300'
          )}
          aria-label={`Leg ${index + 1}`}
        >
          {index + 1}
        </div>
        {!isLast && (
          <div className={cn('mt-1 w-0.5 flex-1 rounded-full min-h-[24px]', lineColor)} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {leg.author ? (
            <Link
              href={`/profile/${leg.author.username}`}
              className="flex items-center gap-2 group"
            >
              <Avatar
                src={leg.author.avatar_url}
                fallback={leg.author.display_name || leg.author.username}
                size="xs"
              />
              <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors">
                @{leg.author.username}
              </span>
            </Link>
          ) : (
            <span className="text-xs text-surface-600">Anonymous</span>
          )}
          <span className="text-surface-600 text-xs">·</span>
          <span className="text-xs text-surface-600">{relativeTime(leg.created_at)}</span>
          {index === 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-for-500/10 text-for-300 border border-for-500/20">
              OPENER
            </span>
          )}
          {!isLast && index > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-300/40 text-surface-500 border border-surface-400/30">
              LEG {index + 1}
            </span>
          )}
          {isLast && index > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple/10 text-purple border border-purple/20">
              CLOSER
            </span>
          )}

          {/* Star upvote */}
          <button
            onClick={toggleStar}
            disabled={!canStar || starring}
            className={cn(
              'ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono transition-colors',
              upvoted
                ? 'border-gold/50 bg-gold/10 text-gold'
                : canStar
                ? 'border-surface-400/40 bg-surface-200/60 text-surface-500 hover:border-gold/40 hover:text-gold hover:bg-gold/5'
                : 'border-surface-400/20 bg-surface-200/30 text-surface-600 cursor-default'
            )}
            aria-label={upvoted ? 'Remove star' : 'Star this leg'}
            title={canStar ? (upvoted ? 'Remove star' : 'Star this leg') : 'Sign in to star'}
          >
            <Star className={cn('h-3 w-3', upvoted ? 'fill-gold text-gold' : '')} />
            {upvoteCount > 0 && <span>{upvoteCount}</span>}
          </button>
        </div>
        <div className="rounded-xl border border-surface-300 bg-surface-200/60 p-4">
          <p className="text-sm text-surface-700 leading-relaxed">{leg.content}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Empty leg slot ───────────────────────────────────────────────────────────

function EmptyLegSlot({ index, canJoin, onJoinClick }: { index: number; canJoin: boolean; onJoinClick: () => void }) {
  return (
    <div className="relative flex gap-4 opacity-60">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-surface-400 bg-surface-300/20 text-xs font-mono text-surface-500">
          {index + 1}
        </div>
      </div>
      <div className="flex-1 pb-5">
        <div
          className={cn(
            'rounded-xl border border-dashed border-surface-400/50 bg-surface-200/20 p-4 flex items-center justify-center gap-2',
            canJoin ? 'cursor-pointer hover:border-for-500/40 hover:bg-for-500/5 transition-colors' : ''
          )}
          onClick={canJoin ? onJoinClick : undefined}
          role={canJoin ? 'button' : undefined}
          aria-label={canJoin ? `Add leg ${index + 1}` : `Leg ${index + 1} waiting`}
        >
          {canJoin ? (
            <>
              <Plus className="h-4 w-4 text-for-400" />
              <span className="text-sm text-for-400 font-medium">Add Leg {index + 1}</span>
            </>
          ) : (
            <span className="text-xs text-surface-600">Waiting for next contributor…</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Join modal ───────────────────────────────────────────────────────────────

function JoinModal({
  relay,
  nextLeg,
  onClose,
  onSuccess,
}: {
  relay: RelayDetail
  nextLeg: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function submit() {
    const trimmed = content.trim()
    if (trimmed.length < 30) { setError('Minimum 30 characters'); return }
    if (trimmed.length > 300) { setError('Maximum 300 characters'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relay.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_leg', content: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to add leg'); return }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setBusy(false)
    }
  }

  const remaining = 300 - content.trim().length
  const valid = content.trim().length >= 30 && content.trim().length <= 300

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div>
            <h3 className="font-semibold text-white text-sm">Add Leg {nextLeg}</h3>
            <p className="text-xs text-surface-500 mt-0.5">Continue the {relay.side === 'for' ? 'FOR' : 'AGAINST'} argument</p>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Previous leg context */}
        {relay.legs.length > 0 && (
          <div className="px-5 pt-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-surface-600 mb-2">Continue from Leg {relay.legs.length}:</p>
            <div className="rounded-lg bg-surface-200/60 border border-surface-300 p-3">
              <p className="text-xs text-surface-600 line-clamp-3">{relay.legs[relay.legs.length - 1].content}</p>
            </div>
          </div>
        )}

        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Write your ${nextLeg === 1 ? 'opening' : nextLeg === relay.max_legs ? 'closing' : 'continuation'} argument (30–300 chars)…`}
            className="w-full h-32 rounded-xl bg-surface-200 border border-surface-300 focus:border-for-500/50 focus:outline-none focus:ring-1 focus:ring-for-500/30 text-sm text-white placeholder:text-surface-600 p-3 resize-none transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={cn('text-xs font-mono', remaining < 0 ? 'text-against-400' : remaining < 40 ? 'text-gold' : 'text-surface-600')}>
              {remaining} left
            </span>
            {error && <p className="text-xs text-against-400">{error}</p>}
          </div>
          <Button
            onClick={submit}
            disabled={!valid || busy}
            className="w-full mt-4"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {busy ? 'Submitting…' : `Add Leg ${nextLeg}`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelayDetailClient({ relayId }: { relayId: string }) {
  const [relay, setRelay] = useState<RelayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchRelay = useCallback(async () => {
    try {
      const res = await fetch(`/api/relays/${relayId}`)
      if (!res.ok) { setNotFound(true); return }
      const data: RelayDetailResponse = await res.json()
      setRelay(data.relay)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [relayId])

  useEffect(() => { fetchRelay() }, [fetchRelay])

  async function handleVote(vote: 'compelling' | 'not_compelling') {
    if (!relay || voting) return
    setVoting(true)
    try {
      await fetch(`/api/relays/${relay.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', vote }),
      })
      fetchRelay()
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: 'Civic Relay · Lobby Market', url })
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 text-white">
        <TopBar />
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
          <Skeleton className="h-5 w-24 mb-6" />
          <Skeleton className="h-28 w-full rounded-2xl mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (notFound || !relay) {
    return (
      <div className="min-h-screen bg-surface-50 text-white">
        <TopBar />
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
          <EmptyState
            icon={Link2}
            title="Relay not found"
            description="This relay may have been removed or the link is incorrect."
            actions={[{ label: 'Browse relays', href: '/relay' }]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const cfg = STATUS_CONFIG[relay.status]
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : null
  const canJoin = ['open', 'in_progress'].includes(relay.status) && !relay.user_has_leg
  const canVote = relay.status === 'complete' && !relay.user_vote
  const nextLeg = relay.legs.length + 1
  const emptySlots = Array.from({ length: relay.max_legs - relay.legs.length }, (_, i) => relay.legs.length + i)

  return (
    <div className="min-h-screen bg-surface-50 text-white">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">

        {/* Back */}
        <Link
          href="/relay"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All Relays
        </Link>

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
          {/* Status + side + share */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border',
                  cfg.color, cfg.bg, cfg.border
                )}
              >
                {cfg.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border uppercase',
                  relay.side === 'for'
                    ? 'text-for-300 bg-for-500/10 border-for-500/30'
                    : 'text-against-300 bg-against-500/10 border-against-500/30'
                )}
              >
                {relay.side === 'for' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                {relay.side === 'for' ? 'FOR' : 'AGAINST'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors"
                aria-label="Share relay"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>

          {/* Topic link */}
          {relay.topic_statement && (
            <Link
              href={`/topic/${relay.topic_id}`}
              className="group block rounded-xl border border-surface-300 hover:border-for-500/40 bg-surface-200/60 hover:bg-for-500/5 p-4 transition-colors mb-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-600">
                      Topic
                    </span>
                    {relay.topic_status && (
                      <Badge variant={TOPIC_STATUS_BADGE[relay.topic_status] ?? 'proposed'} size="xs">
                        {relay.topic_status === 'law' ? 'LAW' : relay.topic_status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors leading-snug">
                    {relay.topic_statement}
                  </p>
                  {relay.topic_category && (
                    <p className="text-xs text-surface-500 mt-1">{relay.topic_category}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 flex-shrink-0 text-surface-500 group-hover:text-for-400 transition-colors mt-0.5" />
              </div>
              {/* Vote bar */}
              {relay.topic_blue_pct != null && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-for-400">{Math.round(relay.topic_blue_pct)}% For</span>
                    <span className="text-against-400">{100 - Math.round(relay.topic_blue_pct)}% Against</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-against-500/30 overflow-hidden">
                    <div
                      className="h-full bg-for-500 rounded-full transition-all"
                      style={{ width: `${Math.round(relay.topic_blue_pct)}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          )}

          {/* Starter */}
          <div className="flex items-center gap-2.5 mb-3">
            <Avatar
              src={relay.starter_avatar_url}
              fallback={relay.starter_display_name || relay.starter_username}
              size="sm"
            />
            <div>
              <Link
                href={`/profile/${relay.starter_username}`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                @{relay.starter_username}
              </Link>
              <p className="text-[11px] text-surface-600">started this relay · {relativeTime(relay.created_at)}</p>
            </div>
          </div>

          {/* Leg progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-surface-500">
                {relay.legs.length}/{relay.max_legs} legs
              </span>
              <span className="text-[11px] font-mono text-surface-500">
                <Users className="inline h-3 w-3 mr-0.5" />
                {relay.legs.length} contributor{relay.legs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <LegSteps total={relay.max_legs} filled={relay.legs.length} />
          </div>
        </div>

        {/* Chain */}
        <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 mb-4 flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5" />
          The Chain
        </h2>

        <div className="space-y-0">
          {relay.legs.map((leg, i) => (
            <LegCard
              key={leg.id}
              leg={leg}
              index={i}
              total={relay.max_legs}
              side={relay.side}
              relayId={relayId}
              canStar={true}
            />
          ))}

          {/* Empty slots */}
          {emptySlots.map((slotIdx, i) => (
            <EmptyLegSlot
              key={slotIdx}
              index={relay.legs.length + i}
              canJoin={canJoin && i === 0}
              onJoinClick={() => setShowJoin(true)}
            />
          ))}
        </div>

        {/* Vote result (if voted/complete with votes) */}
        {(relay.status === 'voted' || (relay.status === 'complete' && totalVotes > 0)) && compellingPct !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mt-6 rounded-2xl border p-5',
              compellingPct >= 60
                ? 'bg-emerald/10 border-emerald/30'
                : compellingPct >= 40
                  ? 'bg-gold/10 border-gold/30'
                  : 'bg-against-500/10 border-against-500/30'
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className={cn(
                'h-5 w-5',
                compellingPct >= 60 ? 'text-emerald' : compellingPct >= 40 ? 'text-gold' : 'text-against-400'
              )} />
              <div>
                <p className={cn('font-semibold text-sm', compellingPct >= 60 ? 'text-emerald' : compellingPct >= 40 ? 'text-gold' : 'text-against-300')}>
                  {compellingPct >= 60 ? 'Compelling!' : compellingPct >= 40 ? 'Mixed verdict' : 'Not convincing'}
                </p>
                <p className="text-xs text-surface-500">{totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast</p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  compellingPct >= 60 ? 'bg-emerald' : compellingPct >= 40 ? 'bg-gold' : 'bg-against-500'
                )}
                style={{ width: `${compellingPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono mt-1.5">
              <span className="text-emerald">{compellingPct}% Compelling</span>
              <span className="text-against-400">{100 - compellingPct}% Not compelling</span>
            </div>
          </motion.div>
        )}

        {/* Vote actions */}
        {canVote && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl bg-surface-100 border border-surface-300 p-5"
          >
            <p className="text-sm font-medium text-white mb-1">Is this argument compelling?</p>
            <p className="text-xs text-surface-500 mb-4">Rate the collective case made {relay.side === 'for' ? 'FOR' : 'AGAINST'} this topic.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote('compelling')}
                disabled={voting}
                className="flex items-center justify-center gap-2 rounded-xl py-3 border border-emerald/40 bg-emerald/10 text-emerald font-semibold text-sm hover:bg-emerald/20 transition-colors disabled:opacity-50"
                aria-label="Vote compelling"
              >
                {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                Compelling
              </button>
              <button
                onClick={() => handleVote('not_compelling')}
                disabled={voting}
                className="flex items-center justify-center gap-2 rounded-xl py-3 border border-against-500/40 bg-against-500/10 text-against-300 font-semibold text-sm hover:bg-against-500/20 transition-colors disabled:opacity-50"
                aria-label="Vote not compelling"
              >
                {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                Not convincing
              </button>
            </div>
          </motion.div>
        )}

        {/* Already voted */}
        {relay.user_vote && (
          <div className="mt-6 flex items-center gap-2 text-sm text-surface-500">
            <Check className="h-4 w-4 text-emerald" />
            You voted: <span className="font-medium text-white capitalize">{relay.user_vote.replace('_', ' ')}</span>
          </div>
        )}

        {/* User has a leg */}
        {relay.user_has_leg && !relay.user_vote && relay.status !== 'complete' && (
          <div className="mt-6 flex items-center gap-2 text-sm text-surface-500">
            <Zap className="h-4 w-4 text-for-400" />
            You&apos;ve contributed a leg to this relay.
          </div>
        )}

        {/* Join CTA */}
        {canJoin && relay.legs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <button
              onClick={() => setShowJoin(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 bg-for-600 hover:bg-for-500 text-white font-semibold text-sm transition-colors border border-for-500/50"
            >
              <Plus className="h-4 w-4" />
              Add Leg {nextLeg} — Join the Relay
            </button>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between pt-6 border-t border-surface-300">
          <Link
            href="/relay"
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Relays
          </Link>
          {relay.topic_id && (
            <Link
              href={`/topic/${relay.topic_id}`}
              className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
            >
              View Topic
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </main>

      <BottomNav />

      {/* Join modal */}
      <AnimatePresence>
        {showJoin && (
          <JoinModal
            relay={relay}
            nextLeg={nextLeg}
            onClose={() => setShowJoin(false)}
            onSuccess={() => {
              setShowJoin(false)
              fetchRelay()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
