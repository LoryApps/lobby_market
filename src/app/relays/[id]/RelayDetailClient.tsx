'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  GitMerge,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  RefreshCw,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RelayInviteSheet } from '@/components/relay/RelayInviteSheet'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { RelayRow, RelayLeg } from '@/app/api/relays/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RelayRow['status'], { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'text-emerald border-emerald/30 bg-emerald/10' },
  in_progress: { label: 'In Progress', cls: 'text-gold border-gold/30 bg-gold/10' },
  complete:    { label: 'Complete',    cls: 'text-for-400 border-for-500/30 bg-for-500/10' },
  voted:       { label: 'Voted',       cls: 'text-surface-400 border-surface-400/30 bg-surface-300/10' },
}

const TOPIC_STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  law:     Gavel,
  voting:  Zap,
  active:  Zap,
}

// ─── Leg card ─────────────────────────────────────────────────────────────────

function LegCard({
  leg,
  legNumber,
  isFor,
  isLast,
  relayId,
  canStar,
}: {
  leg: RelayLeg
  legNumber: number
  isFor: boolean
  isLast: boolean
  relayId: string
  canStar: boolean
}) {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: legNumber * 0.07 }}
      className="flex gap-3"
    >
      {/* Spine */}
      <div className="flex flex-col items-center">
        <Link href={`/profile/${leg.author?.username ?? ''}`} className="flex-shrink-0 z-10">
          <Avatar
            src={leg.author?.avatar_url ?? null}
            fallback={leg.author?.display_name || leg.author?.username || '?'}
            size="sm"
          />
        </Link>
        {!isLast && (
          <div
            className={cn(
              'w-0.5 flex-1 mt-2',
              isFor ? 'bg-for-800/40' : 'bg-against-800/40'
            )}
            style={{ minHeight: '40px' }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-5', isLast && 'pb-0')}>
        {/* Author + meta */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link
            href={`/profile/${leg.author?.username ?? ''}`}
            className="text-[13px] font-mono font-semibold text-white hover:text-for-300 transition-colors"
          >
            {leg.author?.display_name || leg.author?.username || 'Unknown'}
          </Link>
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider',
            isFor
              ? 'text-for-400 bg-for-500/10'
              : 'text-against-400 bg-against-500/10'
          )}>
            Leg {legNumber}
          </span>
          <span className="text-[11px] font-mono text-surface-600">
            {relativeTime(leg.created_at)}
          </span>

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
            {starring
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Star className={cn('h-3 w-3', upvoted ? 'fill-gold text-gold' : '')} />
            }
            {upvoteCount > 0 && <span>{upvoteCount}</span>}
          </button>
        </div>

        {/* Argument text */}
        <div className={cn(
          'rounded-xl border p-4',
          isFor
            ? 'bg-for-900/15 border-for-800/40'
            : 'bg-against-900/15 border-against-800/40'
        )}>
          <p className="text-sm font-mono text-surface-200 leading-relaxed">{leg.content}</p>
        </div>

        {/* Connector label for all but last */}
        {!isLast && (
          <p className={cn(
            'text-[10px] font-mono mt-2.5 ml-1',
            isFor ? 'text-for-800' : 'text-against-800'
          )}>
            builds on →
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Open slot ────────────────────────────────────────────────────────────────

function OpenSlot({ isFor, slotNumber, total }: { isFor: boolean; slotNumber: number; total: number }) {
  return (
    <div className="flex gap-3 opacity-40">
      <div className="flex flex-col items-center">
        <div className={cn(
          'h-9 w-9 rounded-full border-2 border-dashed flex items-center justify-center flex-shrink-0',
          isFor ? 'border-for-700' : 'border-against-700'
        )}>
          <span className={cn(
            'text-[11px] font-bold',
            isFor ? 'text-for-600' : 'text-against-600'
          )}>+</span>
        </div>
        {slotNumber < total && (
          <div
            className={cn('w-0.5 mt-2 bg-surface-600/30', )}
            style={{ minHeight: '40px' }}
          />
        )}
      </div>
      <div className="flex-1 pb-5">
        <div className="rounded-xl border border-dashed border-surface-600/40 bg-surface-200/20 p-4">
          <p className="text-xs font-mono text-surface-600 italic">
            Leg {slotNumber} — open for contribution
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function RelayDetailClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [relay, setRelay] = useState<RelayRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Add-leg state
  const [legText, setLegText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [legErr, setLegErr] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Vote state
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState<'compelling' | 'not_compelling' | null>(null)

  // Share state
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Invite sheet state
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false)

  const fetchRelay = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relays/${id}`, { cache: 'no-store' })
      if (res.status === 404) {
        router.push('/relays')
        return
      }
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.ok) {
        const json = await res.json()
        setRelay(json.relay)
        setLocalVote(json.relay.user_vote)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchRelay()
  }, [fetchRelay])

  useEffect(() => {
    async function getUser() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
    }
    getUser()
  }, [])

  async function handleAddLeg() {
    const trimmed = legText.trim()
    if (trimmed.length < 30) {
      setLegErr('Minimum 30 characters required')
      return
    }
    if (trimmed.length > 300) {
      setLegErr('Maximum 300 characters allowed')
      return
    }
    setLegErr(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/relays/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_leg', content: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) {
        setLegErr(json.error ?? 'Failed to add leg')
      } else {
        setLegText('')
        await fetchRelay()
      }
    } catch {
      setLegErr('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVote(vote: 'compelling' | 'not_compelling') {
    setVoting(true)
    try {
      const res = await fetch(`/api/relays/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', vote }),
      })
      if (res.ok) {
        setLocalVote(vote)
        await fetchRelay()
      }
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  function handleCopy() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!relay) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="font-mono text-surface-500">Relay not found</p>
          <Link href="/relays" className="text-sm font-mono text-for-400 hover:text-for-300 flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Relays
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  const isFor = relay.side === 'for'
  const legCount = relay.legs.length
  const openSlots = Math.max(0, relay.max_legs - legCount)
  const isAccepting = ['open', 'in_progress'].includes(relay.status)
  const { label: statusLabel, cls: statusCls } = STATUS_CONFIG[relay.status]

  const canAddLeg =
    userId &&
    !relay.user_has_leg &&
    relay.starter_id !== userId &&
    isAccepting &&
    legCount < relay.max_legs

  const canVote = userId && !localVote && relay.status === 'complete'

  const canInvite = userId && isAccepting && (relay.starter_id === userId || relay.user_has_leg)

  const charCount = legText.length
  const charColorCls =
    charCount > 280 ? 'text-against-400' : charCount > 250 ? 'text-gold' : 'text-surface-500'

  const TopicStatusIcon = relay.topic_status
    ? (TOPIC_STATUS_ICON[relay.topic_status] ?? null)
    : null

  // Vote ratio
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Nav ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/relays"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
            aria-label="Back to Relays"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GitMerge className="h-4 w-4 text-purple flex-shrink-0" />
            <span className="text-sm font-mono text-surface-500 truncate">
              Civic Relay
            </span>
          </div>
          {/* Transcript + Scorecard links (only for complete/voted relays with legs) */}
          {(relay?.status === 'complete' || relay?.status === 'voted') && (relay?.legs?.length ?? 0) > 0 && (
            <>
              <Link
                href={`/relays/${id}/scorecard`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono flex-shrink-0"
                aria-label="View relay scorecard"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Score
              </Link>
              <Link
                href={`/relays/${id}/transcript`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono flex-shrink-0"
                aria-label="Read relay as position paper"
              >
                <FileText className="h-3.5 w-3.5" />
                Read
              </Link>
              <Link
                href={`/relays/${id}/discussion`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono flex-shrink-0"
                aria-label="Discussion thread for this relay"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Discuss
              </Link>
            </>
          )}
          {canInvite && (
            <button
              onClick={() => setInviteSheetOpen(true)}
              aria-label="Invite a collaborator to this relay"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono flex-shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite
            </button>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copy link to this relay"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono flex-shrink-0"
          >
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-emerald" /> Copied</>
            ) : (
              <><Share2 className="h-3.5 w-3.5" /> Share</>
            )}
          </button>
        </div>

        {/* ── Header: side + status ──────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-sm font-black font-mono uppercase tracking-widest border',
            isFor
              ? 'bg-for-600/15 text-for-300 border-for-600/30'
              : 'bg-against-600/15 text-against-300 border-against-600/30'
          )}>
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {relay.topic_category && (
            <span className="text-[11px] font-mono text-surface-500 bg-surface-200/50 px-2 py-0.5 rounded-full border border-surface-400/20">
              {relay.topic_category}
            </span>
          )}
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ml-auto',
            statusCls
          )}>
            {statusLabel}
          </span>
        </div>

        {/* ── Topic card ─────────────────────────────────────────────── */}
        {relay.topic_statement && relay.topic_id && (
          <Link
            href={`/topic/${relay.topic_id}`}
            className="block rounded-2xl border border-surface-300/60 bg-surface-100 hover:bg-surface-200/80 hover:border-surface-400/60 p-4 mb-5 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {TopicStatusIcon && <TopicStatusIcon className="h-3.5 w-3.5 text-for-400" />}
                  {relay.topic_status && (
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                      {relay.topic_status}
                    </span>
                  )}
                </div>
                <p className="text-sm font-mono text-white leading-snug font-medium">
                  {relay.topic_statement}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-surface-500 group-hover:text-surface-300 flex-shrink-0 mt-0.5 transition-colors" />
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-surface-600 group-hover:text-surface-500 transition-colors">
              View topic debate <ChevronRight className="h-3 w-3" />
            </div>
          </Link>
        )}

        {/* ── Leg progress ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-1">
            {Array.from({ length: relay.max_legs }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i < legCount
                    ? isFor ? 'bg-for-500' : 'bg-against-500'
                    : 'bg-surface-500'
                )}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-surface-500">
            {legCount}/{relay.max_legs} legs
          </span>
          {relay.completed_at && (
            <span className="text-xs font-mono text-surface-600">
              · completed {relativeTime(relay.completed_at)}
            </span>
          )}
        </div>

        {/* ── Chain of legs ──────────────────────────────────────────── */}
        <div className="mb-6">
          {relay.legs.map((leg, i) => (
            <LegCard
              key={leg.id}
              leg={leg}
              legNumber={leg.leg_number}
              isFor={isFor}
              isLast={i === relay.legs.length - 1 && openSlots === 0}
              relayId={relay.id}
              canStar={userId !== null && leg.author_id !== userId}
            />
          ))}

          {/* Open slots */}
          {isAccepting && openSlots > 0 && (
            Array.from({ length: Math.min(openSlots, 3) }).map((_, i) => (
              <OpenSlot
                key={`slot-${i}`}
                isFor={isFor}
                slotNumber={legCount + i + 1}
                total={relay.max_legs}
              />
            ))
          )}
        </div>

        {/* ── Vote tally (complete/voted) ────────────────────────────── */}
        {(relay.status === 'complete' || relay.status === 'voted') && totalVotes > 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5 space-y-3">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wide">Community Verdict</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-emerald flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {relay.vote_compelling} compelling
                </span>
                <span className="text-against-400 flex items-center gap-1.5">
                  {relay.vote_not_compelling} not compelling
                  <ThumbsDown className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald transition-all"
                  style={{ width: `${compellingPct}%` }}
                />
              </div>
              <p className="text-xs font-mono text-surface-500 text-center">
                {compellingPct}% found this relay compelling
              </p>
            </div>
          </div>
        )}

        {/* ── Add-leg form ───────────────────────────────────────────── */}
        {canAddLeg && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-5 mb-5 space-y-3',
                isFor
                  ? 'bg-for-900/20 border-for-800/50'
                  : 'bg-against-900/20 border-against-800/50'
              )}
            >
              <p className={cn(
                'text-xs font-mono font-semibold uppercase tracking-wider',
                isFor ? 'text-for-400' : 'text-against-400'
              )}>
                Add your {isFor ? 'FOR' : 'AGAINST'} perspective — Leg {legCount + 1}
              </p>
              <p className="text-[11px] font-mono text-surface-500">
                Build on the argument chain. Write a clear, reasoned continuation (30–300 characters).
              </p>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={legText}
                  onChange={(e) => setLegText(e.target.value)}
                  placeholder="Continue the argument…"
                  rows={4}
                  maxLength={300}
                  className={cn(
                    'w-full rounded-xl border p-3 text-sm font-mono bg-surface-100/80 text-white placeholder:text-surface-600',
                    'focus:outline-none focus:ring-1 resize-none transition-colors',
                    isFor
                      ? 'border-for-800/40 focus:border-for-600/60 focus:ring-for-600/20'
                      : 'border-against-800/40 focus:border-against-600/60 focus:ring-against-600/20'
                  )}
                />
                <span className={cn('absolute bottom-2.5 right-3 text-[10px] font-mono', charColorCls)}>
                  {charCount}/300
                </span>
              </div>
              {legErr && (
                <p className="text-xs font-mono text-against-400">{legErr}</p>
              )}
              <button
                onClick={handleAddLeg}
                disabled={submitting || charCount < 30}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-semibold transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  isFor
                    ? 'bg-for-600 hover:bg-for-500 text-white border border-for-500/50'
                    : 'bg-against-600 hover:bg-against-500 text-white border border-against-500/50'
                )}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="h-4 w-4" />
                )}
                Add Leg {legCount + 1}
              </button>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Already contributed ────────────────────────────────────── */}
        {relay.user_has_leg && isAccepting && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald/20 bg-emerald/5 px-4 py-3 mb-5">
            <Check className="h-4 w-4 text-emerald flex-shrink-0" />
            <p className="text-xs font-mono text-emerald">
              Your leg has been submitted to this relay.
            </p>
          </div>
        )}

        {/* ── Vote CTA ───────────────────────────────────────────────── */}
        {canVote && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5 space-y-3">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wide">
              Was this collaborative argument compelling?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote('compelling')}
                disabled={voting}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-semibold transition-all',
                  'bg-emerald/10 hover:bg-emerald/20 text-emerald border border-emerald/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                Compelling
              </button>
              <button
                onClick={() => handleVote('not_compelling')}
                disabled={voting}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-semibold transition-all',
                  'bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                Not compelling
              </button>
            </div>
          </div>
        )}

        {/* ── Voted indicator ────────────────────────────────────────── */}
        {localVote && (
          <div className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-3 mb-5',
            localVote === 'compelling'
              ? 'border-emerald/20 bg-emerald/5 text-emerald'
              : 'border-surface-400/20 bg-surface-200/30 text-surface-400'
          )}>
            {localVote === 'compelling' ? <ThumbsUp className="h-4 w-4 flex-shrink-0" /> : <ThumbsDown className="h-4 w-4 flex-shrink-0" />}
            <p className="text-xs font-mono">
              You voted: {localVote === 'compelling' ? 'Compelling' : 'Not compelling'}
            </p>
          </div>
        )}

        {/* ── Login nudge ────────────────────────────────────────────── */}
        {!userId && isAccepting && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5 text-center space-y-2">
            <p className="text-sm font-mono text-surface-400">
              Sign in to add your leg to this relay
            </p>
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all',
                isFor
                  ? 'bg-for-600 hover:bg-for-500 text-white'
                  : 'bg-against-600 hover:bg-against-500 text-white'
              )}
            >
              Sign in to participate
            </Link>
          </div>
        )}

        {/* ── Footer meta ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300/60 bg-surface-100/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
            <span>Started by</span>
            <Link href={`/profile/${relay.starter_username}`} className="flex items-center gap-1.5 text-surface-400 hover:text-white transition-colors">
              <Avatar
                src={relay.starter_avatar_url}
                fallback={relay.starter_display_name || relay.starter_username}
                size="xs"
              />
              {relay.starter_display_name || `@${relay.starter_username}`}
            </Link>
            <span>·</span>
            <span>{relativeTime(relay.created_at)}</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-surface-600">
            <span>{legCount}/{relay.max_legs} legs submitted</span>
            {totalVotes > 0 && (
              <>
                <span>·</span>
                <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link
              href="/relays"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              All Relays
            </Link>
            <span className="text-surface-600">·</span>
            {(relay.status === 'complete' || relay.status === 'voted') && (
              <>
                <Link
                  href={`/relays/${id}/scorecard`}
                  className="text-xs font-mono text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
                >
                  <BarChart2 className="h-3 w-3" />
                  Scorecard
                </Link>
                <span className="text-surface-600">·</span>
              </>
            )}
            <Link
              href="/relays/create"
              className="text-xs font-mono text-purple hover:text-purple/80 transition-colors flex items-center gap-1"
            >
              <GitMerge className="h-3 w-3" />
              Start your own
            </Link>
            <span className="text-surface-600">·</span>
            <button
              onClick={() => fetchRelay()}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </div>

      </main>

      <BottomNav />

      {canInvite && (
        <RelayInviteSheet
          relayId={id}
          relayTopicStatement={relay.topic_statement ?? undefined}
          isFor={isFor}
          open={inviteSheetOpen}
          onClose={() => setInviteSheetOpen(false)}
        />
      )}
    </div>
  )
}
