'use client'

/**
 * /pressure — The Civic Pressure Test
 *
 * Surfaces topics where the vote balance is razor-thin AND debate is actively
 * flowing — the places where a single vote carries maximum real-world weight.
 *
 * Pressure Score formula:
 *   closeness × activity_weight
 *   closeness     = 100 × exp(−0.12 × margin²)   (margin = |FOR% − 50|)
 *   activity_weight = 0.4 + 0.6 × min(recent_votes, 50) / 50
 *
 * A topic deadlocked at 50/50 with 50 recent votes scores 100.
 * A topic at 52/48 with only 2 recent votes scores ≈ 34.
 *
 * Distinct from:
 *   /standoff      — persistent deadlock with no movement
 *   /tipping-point — approaching the 75% law threshold
 *   /flux          — biggest absolute daily swing
 *   /surge         — pure vote velocity (not about closeness)
 *   /undertow      — momentum opposing surface consensus
 *   /senate        — topics in the formal voting phase
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useVoteStore } from '@/lib/stores/vote-store'
import { cn } from '@/lib/utils/cn'
import type { PressureResponse, PressureTopic, PressureArgument } from '@/app/api/pressure/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const

const CAT_STYLE: Record<string, { text: string; dot: string; pill: string }> = {
  Economics:   { text: 'text-gold',        dot: 'bg-gold',        pill: 'bg-gold/10 border-gold/30 text-gold' },
  Politics:    { text: 'text-for-400',     dot: 'bg-for-500',     pill: 'bg-for-500/10 border-for-500/30 text-for-400' },
  Technology:  { text: 'text-purple',      dot: 'bg-purple',      pill: 'bg-purple/10 border-purple/30 text-purple' },
  Science:     { text: 'text-emerald',     dot: 'bg-emerald',     pill: 'bg-emerald/10 border-emerald/30 text-emerald' },
  Ethics:      { text: 'text-against-400', dot: 'bg-against-500', pill: 'bg-against-500/10 border-against-500/30 text-against-400' },
  Philosophy:  { text: 'text-indigo-400',  dot: 'bg-indigo-400',  pill: 'bg-indigo-400/10 border-indigo-400/30 text-indigo-400' },
  Culture:     { text: 'text-orange-400',  dot: 'bg-orange-400',  pill: 'bg-orange-400/10 border-orange-400/30 text-orange-400' },
  Health:      { text: 'text-pink-400',    dot: 'bg-pink-400',    pill: 'bg-pink-400/10 border-pink-400/30 text-pink-400' },
  Environment: { text: 'text-green-400',   dot: 'bg-green-400',   pill: 'bg-green-400/10 border-green-400/30 text-green-400' },
  Education:   { text: 'text-cyan-400',    dot: 'bg-cyan-400',    pill: 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400' },
}

function catStyle(cat: string | null) {
  return cat
    ? (CAT_STYLE[cat] ?? { text: 'text-surface-500', dot: 'bg-surface-500', pill: 'bg-surface-300/30 border-surface-400/30 text-surface-500' })
    : { text: 'text-surface-500', dot: 'bg-surface-500', pill: 'bg-surface-300/30 border-surface-400/30 text-surface-500' }
}

// ─── Pressure label helpers ───────────────────────────────────────────────────

function pressureLabel(score: number): { label: string; color: string; glow: string } {
  if (score >= 80) return { label: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/30',         glow: 'shadow-red-500/20' }
  if (score >= 60) return { label: 'HIGH',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', glow: 'shadow-orange-500/20' }
  if (score >= 40) return { label: 'MODERATE', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', glow: 'shadow-yellow-500/20' }
  return               { label: 'LOW',      color: 'text-surface-500 bg-surface-300/30 border-surface-400/30', glow: '' }
}

// ─── Argument mini-card ───────────────────────────────────────────────────────

function ArgChip({
  arg,
  topicId,
  isFor,
}: {
  arg: PressureArgument
  topicId: string
  isFor: boolean
}) {
  return (
    <Link
      href={`/topic/${topicId}/arguments`}
      className={cn(
        'block p-2.5 rounded-xl border transition-colors text-left',
        isFor
          ? 'bg-for-900/20 border-for-700/30 hover:border-for-600/50'
          : 'bg-against-900/20 border-against-700/30 hover:border-against-600/50',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden="true" />
        )}
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', isFor ? 'text-for-400' : 'text-against-400')}>
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="ml-auto text-[10px] font-mono text-surface-600 flex items-center gap-0.5">
          <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
          {arg.upvotes}
        </span>
      </div>
      <p className="text-[11px] text-surface-300 leading-snug line-clamp-2">
        {arg.content}
      </p>
      {arg.author_username && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name ?? arg.author_username}
            size="xs"
          />
          <span className="text-[10px] font-mono text-surface-600 truncate">
            {arg.author_display_name ?? `@${arg.author_username}`}
          </span>
        </div>
      )}
    </Link>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function PressureCard({
  topic,
  rank,
  delay,
}: {
  topic: PressureTopic
  rank: number
  delay: number
}) {
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const voted    = hasVoted(topic.id) || topic.user_voted
  const votedSide = getVoteSide(topic.id) ?? topic.user_vote
  const [casting, setCasting] = useState(false)
  const [localBluePct, setLocalBluePct] = useState(topic.blue_pct)
  const [localTotal, setLocalTotal]     = useState(topic.total_votes)
  const [expanded, setExpanded]         = useState(false)

  const forPct  = Math.round(localBluePct)
  const agstPct = 100 - forPct
  const style   = catStyle(topic.category)
  const pl      = pressureLabel(topic.pressure_score)
  const margin  = Math.abs(localBluePct - 50)

  async function handleVote(side: 'for' | 'against') {
    if (voted || casting) return
    setCasting(true)
    // Optimistic update
    const delta = side === 'for' ? 1 : 0
    const newTotal = localTotal + 1
    setLocalBluePct(((localBluePct / 100) * localTotal + delta) / newTotal * 100)
    setLocalTotal(newTotal)
    await castVote(topic.id, side === 'for' ? 'blue' : 'red')
    setCasting(false)
  }

  const hasTopArgs = topic.top_for_arg || topic.top_against_arg

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-200',
        'bg-surface-100',
        topic.pressure_score >= 80
          ? 'border-red-500/30 shadow-lg shadow-red-500/10'
          : topic.pressure_score >= 60
          ? 'border-orange-500/20 shadow-md shadow-orange-500/10'
          : 'border-surface-300 hover:border-surface-400',
      )}
      aria-label={topic.statement}
    >
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-300/50 text-[11px] font-mono font-bold text-surface-500">
          {rank}
        </div>
        {topic.category && (
          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold', style.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', style.dot)} aria-hidden="true" />
            {topic.category}
          </span>
        )}
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
            pl.color,
          )}
          aria-label={`Pressure level: ${pl.label}`}
        >
          <Activity className="h-2.5 w-2.5" aria-hidden="true" />
          {pl.label}
        </span>
      </div>

      {/* Pressure score bar */}
      <div className="px-4 pt-2 pb-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${topic.pressure_score}%` }}
              transition={{ duration: 0.6, delay: delay + 0.1, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                topic.pressure_score >= 80 ? 'bg-gradient-to-r from-red-600 to-red-400' :
                topic.pressure_score >= 60 ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                topic.pressure_score >= 40 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                                              'bg-gradient-to-r from-surface-500 to-surface-400'
              )}
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-surface-500 w-8 text-right">
            {topic.pressure_score}
          </span>
        </div>
      </div>

      {/* Statement */}
      <div className="px-4 pt-2.5 pb-3">
        <Link
          href={`/topic/${topic.id}`}
          className="block text-sm font-semibold text-white leading-snug hover:text-for-200 transition-colors group"
        >
          {topic.statement}
          <ChevronRight className="inline h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </Link>
      </div>

      {/* Vote bar */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[11px] font-mono mb-1.5">
          <span className={cn('font-bold', forPct >= 50 ? 'text-for-400' : 'text-surface-500')}>
            {forPct}% FOR
          </span>
          <span className="text-surface-600 text-center">
            {margin.toFixed(1)}pp from centre
          </span>
          <span className={cn('font-bold', agstPct > forPct ? 'text-against-400' : 'text-surface-500')}>
            {agstPct}% AGAINST
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-surface-300 flex relative" role="img" aria-label={`${forPct}% for, ${agstPct}% against`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.5, delay: delay + 0.1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-for-700 to-for-500"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${agstPct}%` }}
            transition={{ duration: 0.5, delay: delay + 0.1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-l from-against-700 to-against-500 ml-auto"
          />
          {/* Centre marker */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" aria-hidden="true" />
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-3 px-4 pb-3 text-[10px] font-mono text-surface-600 flex-wrap">
        <span className="flex items-center gap-1" title="Total votes">
          <Users className="h-3 w-3" aria-hidden="true" />
          {localTotal.toLocaleString()} total
        </span>
        <span className="flex items-center gap-1" title="Votes in last 24h">
          <Activity className="h-3 w-3 text-emerald" aria-hidden="true" />
          {topic.recent_votes} today
        </span>
        <span className="flex items-center gap-1 text-gold" title="Votes needed to flip outcome">
          <Zap className="h-3 w-3" aria-hidden="true" />
          ~{topic.votes_to_flip} to flip
        </span>
        <Badge
          variant={topic.status as 'active' | 'proposed' | 'voting'}
          className="text-[9px] px-1.5 py-0 ml-auto"
        >
          {topic.status}
        </Badge>
      </div>

      {/* Vote buttons */}
      {voted ? (
        <div className={cn(
          'mx-4 mb-3 py-2 rounded-xl text-center text-xs font-semibold border',
          votedSide === 'blue'
            ? 'bg-for-900/30 border-for-700/30 text-for-400'
            : 'bg-against-900/30 border-against-700/30 text-against-400',
        )}>
          <span>
            You voted{' '}
            <strong>{votedSide === 'blue' ? 'FOR' : 'AGAINST'}</strong>
          </span>
          <span className="ml-2 text-surface-600">— your voice is counted</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-4 mb-3">
          <button
            onClick={() => handleVote('for')}
            disabled={casting}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all',
              'bg-for-900/20 border-for-700/30 text-for-400',
              'hover:bg-for-800/30 hover:border-for-600/50 hover:shadow-md hover:shadow-for-500/20',
              'disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
            )}
            aria-label="Vote for this topic"
          >
            {casting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
            Vote FOR
          </button>
          <button
            onClick={() => handleVote('against')}
            disabled={casting}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all',
              'bg-against-900/20 border-against-700/30 text-against-400',
              'hover:bg-against-800/30 hover:border-against-600/50 hover:shadow-md hover:shadow-against-500/20',
              'disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
            )}
            aria-label="Vote against this topic"
          >
            {casting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
            Vote AGAINST
          </button>
        </div>
      )}

      {/* Expandable top arguments */}
      {hasTopArgs && (
        <div className="border-t border-surface-300/50">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
            aria-expanded={expanded}
          >
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            Top arguments
            <ChevronRight
              className={cn('h-3 w-3 ml-auto transition-transform', expanded && 'rotate-90')}
              aria-hidden="true"
            />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                  {topic.top_for_arg
                    ? <ArgChip arg={topic.top_for_arg} topicId={topic.id} isFor={true} />
                    : <div className="rounded-xl border border-surface-300/30 p-2.5 text-[10px] text-surface-700 italic">No FOR argument yet</div>
                  }
                  {topic.top_against_arg
                    ? <ArgChip arg={topic.top_against_arg} topicId={topic.id} isFor={false} />
                    : <div className="rounded-xl border border-surface-300/30 p-2.5 text-[10px] text-surface-700 italic">No AGAINST argument yet</div>
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-5 w-20 ml-auto rounded-full" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-xl" />
        <Skeleton className="h-9 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PressureClient() {
  const [data, setData] = useState<PressureResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory]     = useState<string | null>(null)
  const [onlyUnvoted, setOnlyUnvoted] = useState(false)
  const [showInfo, setShowInfo]     = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (onlyUnvoted) params.set('unvoted', '1')
      const res = await fetch(`/api/pressure?${params}`)
      if (res.ok) setData(await res.json() as PressureResponse)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category, onlyUnvoted])

  useEffect(() => {
    setLoading(true)
    void load()
    timerRef.current = setInterval(() => void load(true), REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const topics = data?.topics ?? []

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="h-6 w-6 text-red-400" aria-hidden="true" />
                The Civic Pressure Test
              </h1>
              <p className="text-sm text-surface-500 mt-1 max-w-lg">
                Debates where the balance is razor-thin and votes are flowing — where your single vote carries maximum weight.
              </p>
            </div>
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="flex-shrink-0 mt-0.5 p-2 rounded-xl bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="How pressure scores work"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Info panel */}
          <AnimatePresence initial={false}>
            {showInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 text-xs text-surface-400 space-y-1.5">
                  <p className="font-semibold text-surface-300">How the Pressure Score works:</p>
                  <p>
                    <strong className="text-red-400">CRITICAL (80–100):</strong> Nearly tied with heavy recent voting — a few votes could flip it.
                  </p>
                  <p>
                    <strong className="text-orange-400">HIGH (60–79):</strong> Very close margin, moderate activity. Your vote is consequential.
                  </p>
                  <p>
                    <strong className="text-yellow-400">MODERATE (40–59):</strong> Close but not critical — still worth your voice.
                  </p>
                  <p className="text-surface-600">
                    Formula: closeness × activity. Closeness peaks at 50/50; activity rewards recent engagement. Refreshes every 60 s.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stat strip */}
          {data && !loading && (
            <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-surface-600">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-red-400" />
                {topics.length} pressure zones
              </span>
              {data.user_unvoted_count > 0 && (
                <span className="flex items-center gap-1 text-gold">
                  <Zap className="h-3 w-3" />
                  {data.user_unvoted_count} you haven&apos;t voted on
                </span>
              )}
              <span className="ml-auto">
                Last {data.window_hours}h only
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-5">
          {/* Category filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCategory(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                !category
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const style = catStyle(cat)
              const active = category === cat
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(active ? null : cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    active
                      ? `${style.pill} border-current`
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* "Only unvoted" toggle + refresh */}
        <div className="flex items-center gap-3 mb-5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              role="checkbox"
              aria-checked={onlyUnvoted}
              tabIndex={0}
              onClick={() => setOnlyUnvoted((v) => !v)}
              onKeyDown={(e) => e.key === 'Enter' && setOnlyUnvoted((v) => !v)}
              className={cn(
                'h-5 w-9 rounded-full border transition-all flex items-center cursor-pointer',
                onlyUnvoted
                  ? 'bg-gold/30 border-gold/50'
                  : 'bg-surface-300 border-surface-400',
              )}
            >
              <motion.div
                layout
                className={cn(
                  'h-3.5 w-3.5 rounded-full mx-0.5 transition-colors',
                  onlyUnvoted ? 'bg-gold ml-auto' : 'bg-surface-500',
                )}
              />
            </div>
            <span className="text-xs font-mono text-surface-500">
              Only show unvoted
            </span>
          </label>

          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-600 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh pressure scores"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={category ? `No pressure zones in ${category}` : 'No pressure zones right now'}
            description={
              onlyUnvoted
                ? "You've already voted on all the high-pressure topics. Check back later or disable the filter."
                : 'All debates are either settled or have low recent activity. Check back later.'
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {topics.map((topic, i) => (
                <PressureCard
                  key={topic.id}
                  topic={topic}
                  rank={i + 1}
                  delay={i * 0.04}
                />
              ))}
            </AnimatePresence>

            {/* Footer links */}
            <div className="pt-4 pb-2 flex flex-wrap gap-3 text-[11px] font-mono text-surface-600">
              <Link href="/standoff" className="flex items-center gap-1 hover:text-white transition-colors">
                <ArrowRight className="h-3 w-3" />
                Civic Standoff
              </Link>
              <Link href="/tipping-point" className="flex items-center gap-1 hover:text-white transition-colors">
                <ArrowRight className="h-3 w-3" />
                Tipping Points
              </Link>
              <Link href="/surge" className="flex items-center gap-1 hover:text-white transition-colors">
                <ArrowRight className="h-3 w-3" />
                Surge
              </Link>
              <Link href="/undertow" className="flex items-center gap-1 hover:text-white transition-colors">
                <ArrowRight className="h-3 w-3" />
                Undertow
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
