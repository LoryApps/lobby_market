'use client'

/**
 * /confidence — Motion of No Confidence
 *
 * Citizens can table a formal motion challenging the governing coalition and
 * vote FOR (no confidence) or AGAINST (confidence in government).
 *
 * A motion carries if it gets a simple majority of "no confidence" votes
 * before the 7-day window expires.  Carried motions trigger a constitutional
 * crisis — the governing coalition loses its mandate.
 *
 * Related pages:
 *   /government    — the ruling coalition
 *   /opposition    — the official opposition
 *   /parliament    — full parliamentary hub
 *   /grand-council — constitutional amendments
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  FileText,
  Flag,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MotionAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

interface ConfidenceMotion {
  id: string
  reason: string
  status: 'open' | 'carried' | 'defeated' | 'withdrawn'
  votes_for: number
  votes_against: number
  expires_at: string
  created_at: string
  profiles: MotionAuthor | null
}

interface ApiResponse {
  motions: ConfidenceMotion[]
  userVotes: Record<string, string>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const past = diff < 0

  if (abs < 60_000) return past ? 'just now' : 'in a moment'
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000)
    return past ? `${m}m ago` : `in ${m}m`
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000)
    return past ? `${h}h ago` : `in ${h}h`
  }
  const d = Math.round(abs / 86_400_000)
  return past ? `${d}d ago` : `in ${d}d`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const STATUS_CONFIG: Record<
  ConfidenceMotion['status'],
  { label: string; icon: typeof AlertTriangle; color: string; bg: string; border: string }
> = {
  open: {
    label: 'Open',
    icon: Clock,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  carried: {
    label: 'CARRIED',
    icon: ThumbsDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  defeated: {
    label: 'Defeated',
    icon: CheckCircle2,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  withdrawn: {
    label: 'Withdrawn',
    icon: XCircle,
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  },
}

// ─── Active motion vote card ──────────────────────────────────────────────────

function ActiveMotionCard({
  motion,
  userVote,
  onVote,
  voting,
}: {
  motion: ConfidenceMotion
  userVote: string | undefined
  onVote: (motionId: string, side: 'no_confidence' | 'confidence') => void
  voting: boolean
}) {
  const totalVotes = motion.votes_for + motion.votes_against
  const noPct = totalVotes > 0 ? Math.round((motion.votes_for / totalVotes) * 100) : 50
  const confPct = 100 - noPct
  const expiresAt = new Date(motion.expires_at)
  const expired = expiresAt < new Date()
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))

  return (
    <div className="rounded-2xl bg-surface-100 border border-against-500/30 overflow-hidden">
      {/* Urgency bar */}
      <div className="h-1 bg-surface-300">
        <motion.div
          className="h-full bg-against-500"
          initial={{ width: '100%' }}
          animate={{ width: `${Math.max(5, (daysLeft / 7) * 100)}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-against-500/10 border border-against-500/30">
              <AlertTriangle className="h-4 w-4 text-against-400" />
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-against-400 uppercase tracking-wider">
                Motion of No Confidence
              </p>
              <p className="text-[11px] text-surface-500 font-mono">
                {expired ? 'Expired' : `Expires ${formatRelative(motion.expires_at)}`}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
              'bg-gold/10 border-gold/30 text-gold',
            )}
          >
            <Clock className="h-2.5 w-2.5" />
            {expired ? 'Expired' : `${daysLeft}d left`}
          </span>
        </div>

        {/* Reason */}
        <blockquote className="relative pl-4 border-l-2 border-against-500/40">
          <p className="text-sm text-surface-300 italic leading-relaxed">
            &ldquo;{motion.reason}&rdquo;
          </p>
        </blockquote>

        {/* Author */}
        {motion.profiles && (
          <Link
            href={`/profile/${motion.profiles.username}`}
            className="flex items-center gap-2 group"
          >
            <Avatar
              src={motion.profiles.avatar_url}
              fallback={motion.profiles.display_name || motion.profiles.username}
              size="xs"
            />
            <span className="text-[11px] text-surface-500 group-hover:text-white transition-colors">
              Tabled by{' '}
              <span className="font-semibold">
                {motion.profiles.display_name || motion.profiles.username}
              </span>
              <span className="text-surface-600"> · {formatDate(motion.created_at)}</span>
            </span>
          </Link>
        )}

        {/* Vote bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[11px] font-mono font-semibold">
            <span className="text-against-400">No Confidence {motion.votes_for}</span>
            <span className="text-surface-600">{totalVotes} votes</span>
            <span className="text-for-400">Confidence {motion.votes_against}</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-for-500/20">
            <motion.div
              className="absolute inset-y-0 left-0 bg-against-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${noPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-mono font-bold text-white drop-shadow">
                {noPct}% / {confPct}%
              </span>
            </div>
          </div>
          <p className="text-[10px] font-mono text-surface-600 text-center">
            50% majority required to carry
          </p>
        </div>

        {/* Vote buttons */}
        {!expired && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              disabled={voting}
              onClick={() => onVote(motion.id, 'no_confidence')}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl',
                'text-sm font-semibold border transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                userVote === 'no_confidence'
                  ? 'bg-against-500 border-against-500 text-white shadow-lg shadow-against-900/40'
                  : 'bg-against-500/10 border-against-500/30 text-against-400 hover:bg-against-500/20 hover:border-against-500/50',
              )}
            >
              {voting && userVote !== 'confidence' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
              No Confidence
              {userVote === 'no_confidence' && (
                <span className="text-[10px] font-mono opacity-80">✓</span>
              )}
            </button>

            <button
              disabled={voting}
              onClick={() => onVote(motion.id, 'confidence')}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl',
                'text-sm font-semibold border transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                userVote === 'confidence'
                  ? 'bg-for-500 border-for-500 text-white shadow-lg shadow-for-900/40'
                  : 'bg-for-500/10 border-for-500/30 text-for-400 hover:bg-for-500/20 hover:border-for-500/50',
              )}
            >
              {voting && userVote !== 'no_confidence' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
              Confidence
              {userVote === 'confidence' && (
                <span className="text-[10px] font-mono opacity-80">✓</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Past motion card ─────────────────────────────────────────────────────────

function PastMotionCard({ motion }: { motion: ConfidenceMotion }) {
  const cfg = STATUS_CONFIG[motion.status]
  const StatusIcon = cfg.icon
  const total = motion.votes_for + motion.votes_against
  const noPct = total > 0 ? Math.round((motion.votes_for / total) * 100) : 50

  return (
    <div className="p-4 rounded-xl bg-surface-100 border border-surface-300/40 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-surface-400 italic leading-relaxed flex-1 line-clamp-2">
          &ldquo;{motion.reason}&rdquo;
        </p>
        <span
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex-shrink-0',
            cfg.bg,
            cfg.border,
            cfg.color,
          )}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-for-500/20 overflow-hidden">
          <div
            className="h-full bg-against-500/70 rounded-full"
            style={{ width: `${noPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
          {motion.votes_for} / {motion.votes_against} · {formatRelative(motion.created_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Table motion form ────────────────────────────────────────────────────────

function TableMotionForm({
  onSuccess,
}: {
  onSuccess: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const charCount = reason.trim().length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (charCount < 10 || charCount > 500) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/government/confidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to table motion')
        return
      }

      setReason('')
      setExpanded(false)
      onSuccess()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/40 overflow-hidden">
      <button
        onClick={() => {
          setExpanded((v) => !v)
          if (!expanded) setTimeout(() => textRef.current?.focus(), 150)
        }}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-200/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-against-500/10 border border-against-500/30">
            <Flag className="h-3.5 w-3.5 text-against-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Table a Motion</p>
            <p className="text-[11px] text-surface-500">
              Formally challenge the governing coalition
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4 border-t border-surface-300/40 pt-4">
              <p className="text-[11px] text-surface-500 leading-relaxed">
                State your grounds for the motion. Be specific — a constitutional crisis requires
                clear reasoning. Citizens will vote FOR (no confidence) or AGAINST (confidence)
                over the next 7 days.
              </p>

              <div className="space-y-1.5">
                <textarea
                  ref={textRef}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="The government has failed to uphold its mandate because…"
                  rows={4}
                  maxLength={500}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-surface-600',
                    'bg-surface-200 border border-surface-300 resize-none',
                    'focus:outline-none focus:border-against-500/60 focus:ring-1 focus:ring-against-500/30',
                    'transition-colors',
                  )}
                />
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      'text-[10px] font-mono',
                      charCount < 10 || charCount > 500
                        ? 'text-against-400'
                        : 'text-surface-600',
                    )}
                  >
                    {charCount}/500 chars · min 10
                  </p>
                  {error && (
                    <p className="text-[10px] font-mono text-against-400 text-right">{error}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-surface-500 hover:text-white bg-surface-200 border border-surface-300/60 hover:border-surface-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || charCount < 10 || charCount > 500}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl',
                    'text-sm font-semibold border transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'bg-against-500/90 border-against-600 text-white',
                    'hover:bg-against-500 enabled:hover:shadow-lg enabled:hover:shadow-against-900/40',
                  )}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Table the Motion
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ConfidenceClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState<string | null>(null) // motion id being voted on
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/government/confidence', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleVote(motionId: string, side: 'no_confidence' | 'confidence') {
    if (voting) return
    setVoting(motionId)

    const prev = data
    // Optimistic update
    if (data) {
      const prevVote = data.userVotes[motionId]
      const updatedMotions = data.motions.map((m) => {
        if (m.id !== motionId) return m
        let vf = m.votes_for
        let va = m.votes_against

        if (prevVote === side) {
          // Unvote
          if (side === 'no_confidence') vf = Math.max(0, vf - 1)
          else va = Math.max(0, va - 1)
        } else {
          if (prevVote === 'no_confidence') vf = Math.max(0, vf - 1)
          if (prevVote === 'confidence') va = Math.max(0, va - 1)
          if (side === 'no_confidence') vf++
          else va++
        }
        return { ...m, votes_for: vf, votes_against: va }
      })

      const updatedVotes = { ...data.userVotes }
      if (prevVote === side) {
        delete updatedVotes[motionId]
      } else {
        updatedVotes[motionId] = side
      }

      setData({ motions: updatedMotions, userVotes: updatedVotes })
    }

    try {
      const res = await fetch(`/api/government/confidence/${motionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      })
      if (!res.ok) {
        // Revert on failure
        setData(prev)
      } else {
        // Refresh to get accurate counts
        await load()
      }
    } catch {
      setData(prev)
    } finally {
      setVoting(null)
    }
  }

  const openMotion = data?.motions.find((m) => m.status === 'open') ?? null
  const pastMotions = data?.motions.filter((m) => m.status !== 'open') ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-5">
        {/* Back + refresh */}
        <div className="flex items-center justify-between">
          <Link
            href="/parliament"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Parliament"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <button
            onClick={() => { setLoading(true); load() }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Page title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-against-400" />
            <h1 className="text-xl font-bold text-white">Motion of No Confidence</h1>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            A formal parliamentary tool to challenge the ruling coalition. A carried motion
            triggers a constitutional crisis — the government must seek a new mandate.
          </p>
        </div>

        {/* Constitutional threshold info */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, label: 'Majority', value: '50%+', desc: 'to carry' },
            { icon: Clock, label: 'Window', value: '7 days', desc: 'to vote' },
            { icon: Crown, label: 'Effect', value: 'Crisis', desc: 'if carried' },
          ].map(({ icon: Icon, label, value, desc }) => (
            <div
              key={label}
              className="p-3 rounded-xl bg-surface-100 border border-surface-300/40 text-center space-y-0.5"
            >
              <Icon className="h-4 w-4 text-surface-500 mx-auto" />
              <p className="text-xs font-semibold text-white">{value}</p>
              <p className="text-[10px] font-mono text-surface-600">{desc}</p>
            </div>
          ))}
        </div>

        {/* Loading state */}
        {loading && !data && (
          <div className="space-y-3">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        )}

        {/* Active motion */}
        {!loading && data && (
          <>
            {openMotion ? (
              <ActiveMotionCard
                motion={openMotion}
                userVote={data.userVotes[openMotion.id]}
                onVote={handleVote}
                voting={voting === openMotion.id}
              />
            ) : (
              <div className="p-6 rounded-2xl bg-surface-100 border border-surface-300/40 text-center space-y-2">
                <Shield className="h-8 w-8 text-for-500/50 mx-auto" />
                <p className="text-sm font-semibold text-white">Government Stable</p>
                <p className="text-xs text-surface-500">
                  No active motion. The governing coalition holds its mandate.
                </p>
              </div>
            )}

            {/* Table a motion form (only when no open motion) */}
            {!openMotion && <TableMotionForm onSuccess={load} />}

            {/* Quick nav */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { href: '/government', icon: Crown, label: 'Government' },
                { href: '/opposition', icon: Gavel, label: 'Opposition' },
                { href: '/grand-council', icon: FileText, label: 'Grand Council' },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-all text-center group"
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
                  <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
                    {label}
                  </span>
                </Link>
              ))}
            </div>

            {/* Past motions */}
            {pastMotions.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-surface-500 hover:text-white transition-colors"
                >
                  {showHistory ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Historical Motions ({pastMotions.length})
                </button>

                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-2"
                    >
                      {pastMotions.map((m) => (
                        <PastMotionCard key={m.id} motion={m} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Empty history */}
            {pastMotions.length === 0 && !openMotion && (
              <p className="text-[11px] font-mono text-surface-600 text-center py-4">
                No historical motions. The government has never been formally challenged.
              </p>
            )}

            {/* How it works */}
            <div className="p-4 rounded-xl bg-surface-100 border border-surface-300/40 space-y-3">
              <p className="text-xs font-semibold text-white flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-surface-500" />
                How it works
              </p>
              <ul className="space-y-2">
                {[
                  'Any citizen can table a motion by stating clear grounds',
                  'Citizens vote FOR (no confidence) or AGAINST (confidence) over 7 days',
                  'If votes_for > votes_against, the motion carries',
                  'A carried motion triggers a constitutional crisis — the governing coalition loses its mandate',
                  'Only one motion may be open at a time',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-surface-500">
                    <span className="flex-shrink-0 flex items-center justify-center h-4 w-4 rounded-full bg-surface-300/60 text-[9px] font-mono font-bold text-surface-400 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
              <Link
                href="/parliament"
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Back to Parliament <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
