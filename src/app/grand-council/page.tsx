'use client'

/**
 * /grand-council — The Civic Grand Council
 *
 * A meritocratic governance body composed of the top 20 citizens by clout.
 * Council members propose and vote on motions that carry special weight.
 *
 * Distinct from /senate (topic votes), /citizens-assembly (sortition),
 * and /elections (monthly role elections).
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Crown,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CouncilMember, CouncilMotion, GrandCouncilResponse } from '@/app/api/grand-council/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d ${h}h left`
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return `${h}h ${m}m left`
}

// ─── Effect badge ─────────────────────────────────────────────────────────────

const EFFECT_CONFIG = {
  elevate_topic: {
    label: 'Elevate Topic',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Star,
  },
  issue_statement: {
    label: 'Issue Statement',
    color: 'text-for-300',
    bg: 'bg-for-600/10',
    border: 'border-for-500/30',
    icon: FileText,
  },
  call_assembly: {
    label: 'Call Assembly',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Users,
  },
}

function EffectBadge({ effect }: { effect: CouncilMotion['effect'] }) {
  const cfg = EFFECT_CONFIG[effect]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide border',
        cfg.color, cfg.bg, cfg.border,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, closesAt }: { status: CouncilMotion['status']; closesAt: string }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border bg-emerald/10 border-emerald/30 text-emerald">
        <CheckCircle2 className="h-2.5 w-2.5" /> PASSED
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border bg-against-600/10 border-against-500/30 text-against-400">
        <XCircle className="h-2.5 w-2.5" /> REJECTED
      </span>
    )
  }
  if (status === 'withdrawn') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border bg-surface-300 border-surface-400 text-surface-500">
        <XCircle className="h-2.5 w-2.5" /> WITHDRAWN
      </span>
    )
  }
  const isExpired = new Date(closesAt) < new Date()
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border',
      isExpired
        ? 'bg-surface-300 border-surface-400 text-surface-500'
        : 'bg-for-600/10 border-for-500/30 text-for-300',
    )}>
      <Clock className="h-2.5 w-2.5" />
      {isExpired ? 'Ended' : timeLeft(closesAt)}
    </span>
  )
}

// ─── Motion card ─────────────────────────────────────────────────────────────

interface MotionCardProps {
  motion: CouncilMotion
  isMember: boolean
  currentUserId: string | null
  onVote: (motionId: string, vote: 'for' | 'against') => Promise<void>
}

function MotionCard({ motion, isMember, currentUserId, onVote }: MotionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [voting, setVoting] = useState(false)
  const [localFor, setLocalFor] = useState(motion.votes_for)
  const [localAgainst, setLocalAgainst] = useState(motion.votes_against)
  const [localUserVote, setLocalUserVote] = useState(motion.user_vote)

  const total = localFor + localAgainst
  const pctFor = total > 0 ? Math.round((localFor / total) * 100) : 0
  const isActive = motion.status === 'active' && new Date(motion.closes_at) > new Date()
  const canVote = isMember && isActive && motion.proposer?.id !== currentUserId
  const passThreshold = Math.round(motion.pass_threshold * 100)

  async function handleVote(v: 'for' | 'against') {
    if (voting || !canVote) return
    setVoting(true)
    const prevVote = localUserVote
    const prevFor = localFor
    const prevAgainst = localAgainst

    // Optimistic update
    let newFor = localFor
    let newAgainst = localAgainst
    if (prevVote === v) {
      // Toggle off not supported — keep as-is
    } else {
      if (prevVote === 'for') newFor--
      if (prevVote === 'against') newAgainst--
      if (v === 'for') newFor++
      else newAgainst++
    }
    setLocalFor(newFor)
    setLocalAgainst(newAgainst)
    setLocalUserVote(v)

    try {
      await onVote(motion.id, v)
    } catch {
      setLocalFor(prevFor)
      setLocalAgainst(prevAgainst)
      setLocalUserVote(prevVote)
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-colors',
        motion.status === 'passed'
          ? 'bg-emerald/5 border-emerald/20'
          : motion.status === 'rejected'
            ? 'bg-against-600/5 border-against-500/20'
            : motion.status === 'withdrawn'
              ? 'bg-surface-100 border-surface-300/50 opacity-60'
              : 'bg-surface-100 border-surface-300/60 hover:border-surface-400/70',
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <StatusBadge status={motion.status} closesAt={motion.closes_at} />
              <EffectBadge effect={motion.effect} />
            </div>
            <h3 className="text-sm font-bold text-white leading-tight">{motion.title}</h3>
          </div>
        </div>

        {/* Proposer */}
        {motion.proposer && (
          <div className="flex items-center gap-2 mb-3">
            <Link href={`/profile/${motion.proposer.username}`} className="flex items-center gap-1.5 group">
              <Avatar
                src={motion.proposer.avatar_url}
                fallback={motion.proposer.display_name || motion.proposer.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
                {motion.proposer.display_name || motion.proposer.username}
              </span>
            </Link>
            <span className="text-[11px] font-mono text-surface-600">·</span>
            <span className="text-[11px] font-mono text-surface-600">{timeAgo(motion.created_at)}</span>
          </div>
        )}

        {/* Description preview */}
        <p className={cn(
          'text-xs text-surface-400 leading-relaxed mb-3',
          !expanded && 'line-clamp-2',
        )}>
          {motion.description}
        </p>

        {motion.description.length > 120 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-0.5 text-[10px] font-mono text-surface-600 hover:text-white transition-colors mb-3"
          >
            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Topic reference */}
        {motion.topic_statement && (
          <Link
            href={`/topic/${motion.topic_id}`}
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors mb-3 group"
          >
            <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-white transition-colors" />
            <span className="line-clamp-1">{motion.topic_statement}</span>
          </Link>
        )}

        {/* Vote bar */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-for-400">{localFor} FOR</span>
            <span className="text-surface-600">{total} vote{total !== 1 ? 's' : ''} · {passThreshold}% threshold</span>
            <span className="text-against-400">{localAgainst} AGAINST</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            {total > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pctFor}%` }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'h-full rounded-full',
                  pctFor >= passThreshold ? 'bg-emerald' : 'bg-for-500',
                )}
              />
            )}
          </div>
          <div className="flex justify-end">
            <span className="text-[10px] font-mono text-surface-600">
              {pctFor}% for · needs {passThreshold}%
            </span>
          </div>
        </div>

        {/* Vote buttons */}
        {canVote && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote('for')}
              disabled={voting}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border text-xs font-mono font-semibold transition-all',
                localUserVote === 'for'
                  ? 'bg-for-600/30 border-for-500/60 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/40 hover:text-for-400',
                voting && 'opacity-50 cursor-not-allowed',
              )}
            >
              {voting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
              Vote For
            </button>
            <button
              onClick={() => handleVote('against')}
              disabled={voting}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border text-xs font-mono font-semibold transition-all',
                localUserVote === 'against'
                  ? 'bg-against-600/30 border-against-500/60 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400',
                voting && 'opacity-50 cursor-not-allowed',
              )}
            >
              {voting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
              Vote Against
            </button>
          </div>
        )}

        {isActive && !isMember && (
          <p className="text-[11px] font-mono text-surface-600 text-center mt-1">
            Only Grand Council members can vote
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Member card ─────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: CouncilMember }) {
  const rankColors: Record<number, string> = {
    1: 'text-gold border-gold/50 bg-gold/10',
    2: 'text-surface-300 border-surface-400/50 bg-surface-300/10',
    3: 'text-amber-600 border-amber-600/50 bg-amber-600/10',
  }
  const rankStyle = rankColors[member.rank] ?? 'text-surface-500 border-surface-400/30 bg-surface-200/60'

  return (
    <Link href={`/profile/${member.username}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-100 border border-surface-300/50 hover:border-surface-400/70 transition-colors cursor-pointer"
      >
        <span className={cn(
          'flex-shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center text-[10px] font-mono font-bold',
          rankStyle,
        )}>
          {member.rank === 1 ? <Crown className="h-3 w-3" /> : member.rank}
        </span>
        <Avatar
          src={member.avatar_url}
          fallback={member.display_name || member.username}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">
            {member.display_name || member.username}
          </p>
          <div className="flex items-center gap-1.5">
            <Coins className="h-2.5 w-2.5 text-gold" />
            <span className="text-[10px] font-mono text-gold">{fmt(member.clout)}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Propose motion modal ─────────────────────────────────────────────────────

interface ProposeModalProps {
  onClose: () => void
  onSuccess: () => void
}

function ProposeModal({ onClose, onSuccess }: ProposeModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [effect, setEffect] = useState<CouncilMotion['effect']>('issue_statement')
  const [topicId, setTopicId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsTopic = effect === 'elevate_topic' || effect === 'call_assembly'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/grand-council/motion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          effect,
          topic_id: needsTopic && topicId.trim() ? topicId.trim() : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to create motion')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create motion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="w-full max-w-lg rounded-2xl bg-surface-50 border border-surface-300 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Scale className="h-3.5 w-3.5 text-gold" />
            </div>
            <h2 className="font-mono text-sm font-bold text-white">Propose a Motion</h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center text-surface-500 hover:text-white transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-surface-500">Motion Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="A concise statement of intent…"
              className={cn(
                'w-full h-9 px-3 rounded-xl bg-surface-200 border border-surface-300',
                'text-sm text-white placeholder-surface-600',
                'focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20',
                'transition-colors',
              )}
              required
            />
            <p className="text-[10px] font-mono text-surface-600 text-right">{title.length}/120</p>
          </div>

          {/* Effect */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-surface-500">Motion Effect</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(EFFECT_CONFIG) as [CouncilMotion['effect'], typeof EFFECT_CONFIG[keyof typeof EFFECT_CONFIG]][]).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEffect(key)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-mono font-bold transition-all',
                      effect === key
                        ? `${cfg.color} ${cfg.bg} ${cfg.border}`
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Topic ID (conditional) */}
          {needsTopic && (
            <div className="space-y-1">
              <label className="text-xs font-mono text-surface-500">Topic ID (required)</label>
              <input
                type="text"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                placeholder="Paste a topic UUID…"
                className={cn(
                  'w-full h-9 px-3 rounded-xl bg-surface-200 border border-surface-300',
                  'text-sm font-mono text-white placeholder-surface-600',
                  'focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20',
                  'transition-colors',
                )}
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-surface-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Explain the rationale and expected impact of this motion…"
              className={cn(
                'w-full px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 resize-none',
                'text-sm text-white placeholder-surface-600 leading-relaxed',
                'focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20',
                'transition-colors',
              )}
              required
            />
            <p className="text-[10px] font-mono text-surface-600 text-right">{description.length}/1000</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-against-600/10 border border-against-500/30">
              <AlertCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-against-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || title.trim().length < 5 || description.trim().length < 10}
            className={cn(
              'w-full h-10 rounded-xl border font-mono text-sm font-bold transition-all',
              'bg-gold/15 border-gold/40 text-gold',
              'hover:bg-gold/25 hover:border-gold/60',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Submit Motion'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MemberSkeleton() {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-100 border border-surface-300/50">
      <Skeleton className="h-6 w-6 rounded-lg" />
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-14" />
      </div>
    </div>
  )
}

function MotionSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-24 rounded-md" />
      </div>
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type MotionTab = 'active' | 'passed' | 'rejected' | 'all'

export default function GrandCouncilPage() {
  const [data, setData] = useState<GrandCouncilResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<MotionTab>('active')
  const [showPropose, setShowPropose] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/grand-council')
      if (!res.ok) throw new Error('Failed to load')
      const d: GrandCouncilResponse = await res.json()
      setData(d)
    } catch {
      setError('Failed to load Grand Council')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleVote(motionId: string, vote: 'for' | 'against') {
    const res = await fetch('/api/grand-council/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motion_id: motionId, vote }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Vote failed')
    }
  }

  const filteredMotions = (data?.motions ?? []).filter((m) => {
    if (tab === 'all') return true
    if (tab === 'active') return m.status === 'active'
    if (tab === 'passed') return m.status === 'passed'
    if (tab === 'rejected') return m.status === 'rejected' || m.status === 'withdrawn'
    return true
  })

  const TABS: { id: MotionTab; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'passed', label: 'Passed' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Grand Council</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                The top 20 citizens by clout — proposing and ratifying civic motions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
            {data?.is_member && (
              <button
                onClick={() => setShowPropose(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-gold/15 border border-gold/40 text-gold text-xs font-mono font-bold hover:bg-gold/25 transition-colors"
              >
                <Scale className="h-3.5 w-3.5" />
                Propose
              </button>
            )}
          </div>
        </div>

        {/* ── Info banner for non-members ─────────────────────────────────── */}
        {data && !data.is_member && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-gold/5 border border-gold/20 mb-5">
            <Info className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-mono text-gold font-semibold">Observer Mode</p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                You are observing the Grand Council. Earn more clout to join the top 20 and gain voting rights.
              </p>
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-8 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button onClick={load} className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors">
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: Council members ────────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl bg-surface-100 border border-surface-300/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/50">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    <span className="text-xs font-mono font-bold text-white">Council Members</span>
                    {data && (
                      <span className="text-[10px] font-mono text-surface-600">{data.members.length}/20</span>
                    )}
                  </div>
                  {data && data.members.length > 10 && (
                    <button
                      onClick={() => setShowMembers((s) => !s)}
                      className="text-[10px] font-mono text-surface-600 hover:text-white transition-colors"
                    >
                      {showMembers ? 'Show less' : 'Show all'}
                    </button>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  {loading && !data ? (
                    Array.from({ length: 10 }).map((_, i) => <MemberSkeleton key={i} />)
                  ) : (
                    (showMembers ? data?.members : data?.members.slice(0, 10))?.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))
                  )}
                  {!loading && (!data?.members.length) && (
                    <p className="text-[11px] font-mono text-surface-600 text-center py-4">
                      No council members yet
                    </p>
                  )}
                </div>
              </div>

              {/* Stats sidebar */}
              {data && (
                <div className="mt-4 rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
                  <h3 className="text-xs font-mono font-bold text-white">Council Stats</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Active Motions', value: data.motions.filter((m) => m.status === 'active').length, icon: Scale, color: 'text-for-400' },
                      { label: 'Passed Motions', value: data.motions.filter((m) => m.status === 'passed').length, icon: CheckCircle2, color: 'text-emerald' },
                      { label: 'Members', value: data.members.length, icon: Users, color: 'text-gold' },
                      { label: 'Total Motions', value: data.motions.length, icon: FileText, color: 'text-purple' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="rounded-xl bg-surface-200/60 p-2.5 flex flex-col gap-1">
                        <Icon className={cn('h-3.5 w-3.5', color)} />
                        <span className="text-sm font-mono font-bold text-white">{value}</span>
                        <span className="text-[10px] font-mono text-surface-600">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-surface-300/50">
                    <p className="text-[10px] font-mono text-surface-600 leading-relaxed">
                      Motions pass with <span className="text-white">≥60% of votes cast</span> and a minimum of{' '}
                      <span className="text-white">3 votes</span>. Voting closes after 7 days.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Motions ───────────────────────────────────────────── */}
            <div className="lg:col-span-2">
              {/* Motion tabs */}
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'flex-shrink-0 h-8 px-3 rounded-lg text-xs font-mono font-semibold border transition-all',
                      tab === t.id
                        ? 'bg-gold/15 border-gold/40 text-gold'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                    )}
                  >
                    {t.label}
                    {t.id !== 'all' && data && (
                      <span className="ml-1.5 text-[10px] opacity-70">
                        {t.id === 'active' && data.motions.filter((m) => m.status === 'active').length}
                        {t.id === 'passed' && data.motions.filter((m) => m.status === 'passed').length}
                        {t.id === 'rejected' && data.motions.filter((m) => m.status === 'rejected' || m.status === 'withdrawn').length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Motion list */}
              {loading && !data ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <MotionSkeleton key={i} />)}
                </div>
              ) : filteredMotions.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title={tab === 'active' ? 'No active motions' : `No ${tab} motions`}
                  description={
                    tab === 'active' && data?.is_member
                      ? 'The Council has no pending motions. Propose one to shape the platform.'
                      : 'No motions in this category yet.'
                  }
                  action={
                    tab === 'active' && data?.is_member ? (
                      <button
                        onClick={() => setShowPropose(true)}
                        className="text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                      >
                        Propose a motion
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {filteredMotions.map((m) => (
                      <MotionCard
                        key={m.id}
                        motion={m}
                        isMember={data?.is_member ?? false}
                        currentUserId={data?.current_user_id ?? null}
                        onVote={handleVote}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Propose modal */}
      <AnimatePresence>
        {showPropose && (
          <ProposeModal
            onClose={() => setShowPropose(false)}
            onSuccess={() => {
              setShowPropose(false)
              load()
            }}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
