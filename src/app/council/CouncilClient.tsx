'use client'

/**
 * /council — The Civic Grand Council
 *
 * The platform's meritocratic governance body: the top 20 citizens by clout.
 * Council members can propose motions that carry special weight:
 *   - elevate_topic:    Surface a topic to the front page prominently
 *   - issue_statement:  Publish a collective civic position statement
 *   - call_assembly:    Formally convene a Citizens' Assembly on a topic
 *
 * Motions pass with ≥ 60% of votes cast (minimum 3 votes).
 * All citizens can observe; only council members can propose or vote.
 *
 * Distinct from:
 *   /senate     — voting chamber for topic resolution (all citizens)
 *   /assembly   — sortition-based deliberative body (randomly selected)
 *   /elections  — monthly role elections
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CouncilResponse, CouncilMember, CouncilMotion } from '@/app/api/council/route'

// ─── Effect config ────────────────────────────────────────────────────────────

const EFFECT_CONFIG = {
  elevate_topic: {
    label: 'Elevate Topic',
    icon: Zap,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Surface a topic to the main feed for 24 hours',
  },
  issue_statement: {
    label: 'Issue Statement',
    icon: FileText,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Publish a collective civic position statement',
  },
  call_assembly: {
    label: 'Call Assembly',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Formally convene a Citizens\' Assembly on a topic',
  },
} as const

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  passed: { label: 'Passed', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  rejected: { label: 'Rejected', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  withdrawn: { label: 'Withdrawn', color: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-400/30' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h left`
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`
}

function getVotePct(motion: CouncilMotion): { forPct: number; total: number } {
  const total = motion.votes_for + motion.votes_against
  return { forPct: total === 0 ? 0 : Math.round((motion.votes_for / total) * 100), total }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CouncilSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: CouncilMember }) {
  return (
    <Link
      href={`/profile/${member.username}`}
      className={cn(
        'flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all',
        'bg-surface-100 border-surface-300 hover:border-gold/40 hover:bg-surface-200/80',
        member.is_current_user && 'ring-1 ring-gold/40'
      )}
    >
      <div className="relative">
        <Avatar
          src={member.avatar_url}
          fallback={member.display_name?.[0] ?? member.username?.[0] ?? '?'}
          size="md"
        />
        {member.rank <= 3 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              member.rank === 1 && 'bg-gold text-surface-100',
              member.rank === 2 && 'bg-surface-400 text-white',
              member.rank === 3 && 'bg-amber-700 text-white'
            )}
          >
            {member.rank}
          </span>
        )}
      </div>
      <div className="text-center min-w-0 w-full">
        <p className="text-xs font-semibold text-white truncate">
          {member.display_name ?? member.username}
        </p>
        <p className="text-[10px] text-gold font-mono">{member.clout.toLocaleString()} clout</p>
      </div>
    </Link>
  )
}

// ─── Motion card ──────────────────────────────────────────────────────────────

function MotionCard({
  motion,
  isCouncil,
  onVote,
}: {
  motion: CouncilMotion
  isCouncil: boolean
  onVote: (motionId: string, vote: 'for' | 'against') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [voting, setVoting] = useState(false)

  const effectCfg = EFFECT_CONFIG[motion.effect]
  const statusCfg = STATUS_CONFIG[motion.status]
  const EffectIcon = effectCfg.icon
  const { forPct, total } = getVotePct(motion)

  const canVote = isCouncil && motion.status === 'active' && new Date(motion.closes_at) > new Date()

  async function handleVote(vote: 'for' | 'against') {
    if (!canVote || voting) return
    setVoting(true)
    try {
      await onVote(motion.id, vote)
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        motion.status === 'passed' && 'border-emerald/30',
        motion.status === 'rejected' && 'border-against-500/30',
        motion.status === 'active' && 'border-surface-300',
        motion.status === 'withdrawn' && 'border-surface-400/20'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-xl flex-shrink-0', effectCfg.bg, effectCfg.border, 'border')}>
            <EffectIcon className={cn('h-4 w-4', effectCfg.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                  statusCfg.color,
                  statusCfg.bg,
                  statusCfg.border
                )}
              >
                {statusCfg.label}
              </span>
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', effectCfg.color, effectCfg.bg, effectCfg.border)}>
                {effectCfg.label}
              </span>
              {motion.status === 'active' && (
                <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTimeLeft(motion.closes_at)}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug">{motion.title}</h3>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-surface-500 hover:text-white transition-colors mt-0.5"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Proposer */}
        {motion.proposer && (
          <div className="flex items-center gap-1.5 mt-2 ml-11">
            <Avatar
              src={motion.proposer.avatar_url}
              fallback={motion.proposer.display_name?.[0] ?? motion.proposer.username?.[0] ?? '?'}
              size="xs"
            />
            <span className="text-[11px] text-surface-500">
              Proposed by{' '}
              <Link
                href={`/profile/${motion.proposer.username}`}
                className="text-surface-400 hover:text-white transition-colors"
              >
                {motion.proposer.display_name ?? motion.proposer.username}
              </Link>
            </span>
          </div>
        )}

        {/* Vote bar */}
        {total > 0 && (
          <div className="mt-3 ml-11">
            <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 mb-1">
              <span className="text-for-400">{motion.votes_for} for</span>
              <span>{total} vote{total !== 1 ? 's' : ''} · {forPct}% in favour</span>
              <span className="text-against-400">{motion.votes_against} against</span>
            </div>
            <div className="h-1.5 rounded-full bg-against-500/20 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <p className="text-[10px] text-surface-500 mt-0.5">Requires 60% to pass (min 3 votes)</p>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300/50 pt-3 space-y-3">
              <p className="text-sm text-surface-600 leading-relaxed">{motion.description}</p>

              {motion.topic && (
                <Link
                  href={`/topic/${motion.topic.id}`}
                  className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors group"
                >
                  <Scale className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                  <span className="truncate group-hover:text-white">{motion.topic.statement}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                </Link>
              )}

              {/* Vote buttons — council members only, active motions */}
              {canVote && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleVote('for')}
                    disabled={voting || motion.user_vote === 'for'}
                    className={cn(
                      'flex-1 gap-1.5 border',
                      motion.user_vote === 'for'
                        ? 'border-for-500/60 bg-for-500/15 text-for-300'
                        : 'border-for-500/30 hover:border-for-500/60 hover:bg-for-500/10 text-for-400'
                    )}
                  >
                    {voting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-3.5 w-3.5" />
                    )}
                    {motion.user_vote === 'for' ? 'Voted For' : 'Vote For'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleVote('against')}
                    disabled={voting || motion.user_vote === 'against'}
                    className={cn(
                      'flex-1 gap-1.5 border',
                      motion.user_vote === 'against'
                        ? 'border-against-500/60 bg-against-500/15 text-against-300'
                        : 'border-against-500/30 hover:border-against-500/60 hover:bg-against-500/10 text-against-400'
                    )}
                  >
                    {voting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5" />
                    )}
                    {motion.user_vote === 'against' ? 'Voted Against' : 'Vote Against'}
                  </Button>
                </div>
              )}

              {!canVote && isCouncil && motion.status === 'active' && motion.user_vote && (
                <p className="text-[11px] text-surface-500 text-center">
                  You voted <span className={motion.user_vote === 'for' ? 'text-for-400' : 'text-against-400'}>{motion.user_vote}</span> on this motion.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Propose motion modal ─────────────────────────────────────────────────────

function ProposeMotionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [effect, setEffect] = useState<'elevate_topic' | 'issue_statement' | 'call_assembly'>('issue_statement')
  const [topicSearch, setTopicSearch] = useState('')
  const [topicId, setTopicId] = useState<string | null>(null)
  const [topicLabel, setTopicLabel] = useState('')
  const [topicResults, setTopicResults] = useState<{ id: string; statement: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const needsTopic = effect === 'elevate_topic' || effect === 'call_assembly'

  // Debounced topic search
  useEffect(() => {
    if (!needsTopic || topicSearch.length < 2) {
      setTopicResults([])
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(topicSearch)}&type=topics&limit=5`)
        if (!res.ok) return
        const data = await res.json()
        setTopicResults((data.topics ?? []).map((t: { id: string; statement: string }) => ({ id: t.id, statement: t.statement })))
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [topicSearch, needsTopic])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (needsTopic && !topicId) {
      setError('Please select a topic for this motion type.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/council/motions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, effect, topic_id: topicId }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Failed to propose motion')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      key="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="bg-surface-100 border border-surface-300 rounded-2xl w-full max-w-lg p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gold" />
            <h2 className="font-semibold text-white">Propose a Motion</h2>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Effect selector */}
          <div>
            <label className="text-xs font-mono text-surface-500 mb-1.5 block">Motion Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(EFFECT_CONFIG) as [keyof typeof EFFECT_CONFIG, typeof EFFECT_CONFIG[keyof typeof EFFECT_CONFIG]][]).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setEffect(key); setTopicId(null); setTopicSearch(''); setTopicLabel('') }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[11px] transition-all',
                      effect === key
                        ? cn(cfg.bg, cfg.border, cfg.color)
                        : 'bg-surface-200 border-surface-400 text-surface-500 hover:border-surface-300'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-surface-500 mt-1">{EFFECT_CONFIG[effect].description}</p>
          </div>

          {/* Topic search (conditional) */}
          {needsTopic && (
            <div>
              <label className="text-xs font-mono text-surface-500 mb-1.5 block">Topic</label>
              {topicLabel ? (
                <div className="flex items-center gap-2 p-2 bg-surface-200 rounded-xl border border-surface-400">
                  <Scale className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                  <span className="text-xs text-white flex-1 truncate">{topicLabel}</span>
                  <button
                    type="button"
                    onClick={() => { setTopicId(null); setTopicLabel(''); setTopicSearch('') }}
                    className="text-surface-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Search topics…"
                    className="w-full bg-surface-200 border border-surface-400 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-surface-500" />
                  )}
                  {topicResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-200 border border-surface-400 rounded-xl overflow-hidden z-10 shadow-xl">
                      {topicResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setTopicId(t.id); setTopicLabel(t.statement); setTopicSearch(''); setTopicResults([]) }}
                          className="w-full text-left px-3 py-2 text-xs text-surface-600 hover:bg-surface-300 hover:text-white transition-colors"
                        >
                          {t.statement}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-mono text-surface-500 mb-1.5 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Motion title…"
              maxLength={120}
              required
              className="w-full bg-surface-200 border border-surface-400 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-mono text-surface-500 mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the purpose and rationale of this motion…"
              maxLength={1000}
              required
              rows={4}
              className="w-full bg-surface-200 border border-surface-400 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60 resize-none"
            />
            <p className="text-[10px] text-surface-500 mt-0.5 text-right">{description.length}/1000</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-against-500/10 border border-against-500/30 text-against-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-surface-400">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="flex-1 bg-gold/90 hover:bg-gold text-surface-100 font-semibold gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              Propose Motion
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CouncilClient() {
  const [data, setData] = useState<CouncilResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPropose, setShowPropose] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'passed' | 'rejected'>('all')
  const [showAllMembers, setShowAllMembers] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/council', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: CouncilResponse = await res.json()
      setData(json)
    } catch {
      setError('Failed to load Grand Council data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleVote(motionId: string, vote: 'for' | 'against') {
    const res = await fetch('/api/council/motions/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motion_id: motionId, vote }),
    })
    if (res.ok) {
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          motions: prev.motions.map((m) => {
            if (m.id !== motionId) return m
            const wasFor = m.user_vote === 'for'
            const wasAgainst = m.user_vote === 'against'
            let vf = m.votes_for
            let va = m.votes_against
            if (vote === 'for') { if (wasAgainst) va--; if (!wasFor) vf++ }
            if (vote === 'against') { if (wasFor) vf--; if (!wasAgainst) va++ }
            return { ...m, votes_for: vf, votes_against: va, user_vote: vote }
          }),
        }
      })
    }
  }

  const filteredMotions = data?.motions.filter((m) =>
    activeFilter === 'all' ? true : m.status === activeFilter
  ) ?? []

  const visibleMembers = showAllMembers ? (data?.members ?? []) : (data?.members ?? []).slice(0, 10)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-20 pb-28">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-gold/10 border border-gold/30">
              <Crown className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">The Grand Council</h1>
              <p className="text-sm text-surface-500 mt-0.5">
                The top {data?.council_size ?? 20} citizens by reputation · Meritocratic civic governance
              </p>
            </div>
          </div>

          {data?.user_is_council && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm w-fit">
              <Shield className="h-4 w-4" />
              You are a Council Member — Rank #{data.user_rank}
            </div>
          )}
        </div>

        {loading && <CouncilSkeleton />}

        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-against-400" />
            <p className="text-surface-500">{error}</p>
            <Button size="sm" variant="ghost" onClick={load} className="gap-2 border border-surface-400">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">
            {/* Council roster */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Council Roster</h2>
                  <Badge variant="gold" size="sm">{data.council_size} seats</Badge>
                </div>
                <Link
                  href="/leaderboard"
                  className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  Full leaderboard <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {visibleMembers.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>

              {(data.members ?? []).length > 10 && (
                <button
                  onClick={() => setShowAllMembers(!showAllMembers)}
                  className="mt-2 w-full text-xs text-surface-500 hover:text-white transition-colors py-1 flex items-center justify-center gap-1"
                >
                  {showAllMembers ? (
                    <><ChevronUp className="h-3 w-3" />Show fewer</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" />Show all {data.members.length} members</>
                  )}
                </button>
              )}
            </section>

            {/* Governance explainer */}
            <section className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4 text-for-400" />
                <h2 className="text-sm font-semibold text-white">How the Council Works</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {(Object.entries(EFFECT_CONFIG) as [keyof typeof EFFECT_CONFIG, typeof EFFECT_CONFIG[keyof typeof EFFECT_CONFIG]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <div
                      key={key}
                      className={cn('rounded-xl border p-3 flex flex-col gap-2', cfg.bg, cfg.border)}
                    >
                      <div className={cn('flex items-center gap-2', cfg.color)}>
                        <Icon className="h-4 w-4" />
                        <span className="text-xs font-semibold">{cfg.label}</span>
                      </div>
                      <p className="text-[11px] text-surface-500 leading-relaxed">{cfg.description}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-surface-500 mt-3">
                Motions require ≥ 60% of votes cast and a minimum of 3 council votes to pass. Voting is open for 7 days.
              </p>
            </section>

            {/* Motions */}
            <section>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-semibold text-white">Council Motions</h2>
                </div>

                <div className="flex items-center gap-2">
                  {/* Filter tabs */}
                  <div className="flex bg-surface-200 rounded-xl p-0.5 gap-0.5">
                    {(['all', 'active', 'passed', 'rejected'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono transition-all',
                          activeFilter === f
                            ? 'bg-surface-100 text-white shadow-sm'
                            : 'text-surface-500 hover:text-surface-400'
                        )}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>

                  {data.user_is_council && (
                    <Button
                      size="sm"
                      onClick={() => setShowPropose(true)}
                      className="gap-1.5 bg-gold/90 hover:bg-gold text-surface-100 font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Propose
                    </Button>
                  )}
                </div>
              </div>

              {filteredMotions.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-surface-300 bg-surface-100">
                  <Vote className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                  <p className="text-sm text-surface-500">
                    {activeFilter === 'all'
                      ? 'No motions yet. The first council member to propose a motion will make history.'
                      : `No ${activeFilter} motions.`}
                  </p>
                  {data.user_is_council && activeFilter === 'all' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowPropose(true)}
                      className="mt-3 gap-1.5 border border-surface-400"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-gold" />
                      Propose the first motion
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMotions.map((motion) => (
                    <MotionCard
                      key={motion.id}
                      motion={motion}
                      isCouncil={data.user_is_council}
                      onVote={handleVote}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Non-council CTA */}
            {!data.user_is_council && (
              <section className="rounded-2xl border border-surface-300 bg-surface-100 p-5 text-center">
                <Crown className="h-7 w-7 text-gold mx-auto mb-2" />
                <h3 className="font-semibold text-white mb-1">How to join the Council</h3>
                <p className="text-sm text-surface-500 max-w-sm mx-auto leading-relaxed">
                  The Council is open to the top {data.council_size} citizens by clout. Earn clout by
                  voting on topics, writing quality arguments, winning debates, and building coalitions.
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Link href="/leaderboard">
                    <Button size="sm" variant="ghost" className="gap-1.5 border border-surface-400">
                      <Trophy className="h-3.5 w-3.5 text-gold" />
                      See leaderboard
                    </Button>
                  </Link>
                  <Link href="/clout">
                    <Button size="sm" variant="ghost" className="gap-1.5 border border-surface-400">
                      <Sparkles className="h-3.5 w-3.5 text-for-400" />
                      Earn clout
                    </Button>
                  </Link>
                  <Link href="/nominations">
                    <Button size="sm" variant="ghost" className="gap-1.5 border border-surface-400">
                      <Award className="h-3.5 w-3.5 text-gold" />
                      Nominations
                    </Button>
                  </Link>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Propose modal */}
      <AnimatePresence>
        {showPropose && (
          <ProposeMotionModal
            onClose={() => setShowPropose(false)}
            onSuccess={() => {
              setShowPropose(false)
              load()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
