'use client'

/**
 * /voting — Votes in Progress
 *
 * The complete civic voting chamber: every topic currently in the
 * voting phase, sorted by urgency (soonest deadline first by default).
 *
 * Filter tabs let users focus on the outcome they care about:
 *   All          — every voting-phase topic
 *   Near Law     — FOR ≥ 55% (strong majority, possible law)
 *   Too Close    — 45% < FOR < 55% (genuinely undecided)
 *   Near Failure — FOR ≤ 45% (AGAINST majority, possible failure)
 *
 * Sort modes:
 *   Urgency      — soonest voting_ends_at first (default)
 *   Consensus    — most decisive vote split first
 *   Most Votes   — highest total_votes first
 *
 * Distinct from:
 *   /near-law    — only near-law threshold topics (≥ 55% FOR)
 *   /last-call   — time-ordered but no outcome filters
 *   /countdown   — legacy time-ordered page
 *   /battleground — cinematically presented; single hot topic
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CountdownTopic, CountdownResponse } from '@/app/api/topics/countdown/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000
const LAW_THRESHOLD = 67
const NEAR_LAW_PCT = 55
const NEAR_FAIL_PCT = 45

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'near-law' | 'close' | 'near-failure'
type SortMode = 'urgency' | 'consensus' | 'votes'

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Health:      'bg-for-500/10 text-for-400 border-for-500/30',
  Culture:     'bg-gold/10 text-gold border-gold/30',
  Education:   'bg-for-500/10 text-for-400 border-for-500/30',
}

function catClass(cat: string | null) {
  if (!cat) return 'bg-surface-300/40 text-surface-500 border-surface-400/30'
  return CATEGORY_COLORS[cat] ?? 'bg-surface-300/40 text-surface-500 border-surface-400/30'
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────

type UrgencyTier = 'critical' | 'urgent' | 'active' | 'extended' | 'expired'

interface UrgencyConfig {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Zap
  pulse: boolean
}

const URGENCY: Record<UrgencyTier, UrgencyConfig> = {
  critical: { label: 'Critical', color: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/30', icon: Flame, pulse: true },
  urgent:   { label: 'Urgent',   color: 'text-gold',        bg: 'bg-gold/15',         border: 'border-gold/30',        icon: Zap,   pulse: false },
  active:   { label: 'Active',   color: 'text-for-400',     bg: 'bg-for-500/15',      border: 'border-for-500/30',     icon: Timer, pulse: false },
  extended: { label: 'Extended', color: 'text-surface-400', bg: 'bg-surface-300/30',  border: 'border-surface-400/30', icon: Clock, pulse: false },
  expired:  { label: 'Ended',    color: 'text-surface-500', bg: 'bg-surface-300/20',  border: 'border-surface-400/20', icon: Clock, pulse: false },
}

function getUrgency(voting_ends_at: string): UrgencyTier {
  const ms = new Date(voting_ends_at).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const h = ms / 3_600_000
  if (h < 6) return 'critical'
  if (h < 24) return 'urgent'
  if (h < 48) return 'active'
  return 'extended'
}

function timeUntil(voting_ends_at: string): string {
  const ms = new Date(voting_ends_at).getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const totalSecs = Math.floor(ms / 1_000)
  const d = Math.floor(totalSecs / 86_400)
  const h = Math.floor((totalSecs % 86_400) / 3_600)
  const m = Math.floor((totalSecs % 3_600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

// ─── Outcome helpers ──────────────────────────────────────────────────────────

interface OutcomeConfig {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof ThumbsUp
}

function getOutcome(blue_pct: number): OutcomeConfig {
  if (blue_pct >= LAW_THRESHOLD)
    return { label: 'Near Law', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30', icon: Gavel }
  if (blue_pct >= NEAR_LAW_PCT)
    return { label: 'Strong FOR', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20', icon: ThumbsUp }
  if (blue_pct <= 100 - LAW_THRESHOLD)
    return { label: 'Near Failure', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20', icon: ThumbsDown }
  if (blue_pct <= NEAR_FAIL_PCT)
    return { label: 'Strong AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20', icon: ThumbsDown }
  return { label: 'Too Close', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20', icon: Scale }
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortTopics(topics: CountdownTopic[], sort: SortMode): CountdownTopic[] {
  const copy = [...topics]
  switch (sort) {
    case 'urgency':
      return copy.sort(
        (a, b) => new Date(a.voting_ends_at).getTime() - new Date(b.voting_ends_at).getTime(),
      )
    case 'consensus':
      return copy.sort((a, b) => {
        const devA = Math.abs(a.blue_pct - 50)
        const devB = Math.abs(b.blue_pct - 50)
        return devB - devA
      })
    case 'votes':
      return copy.sort((a, b) => b.total_votes - a.total_votes)
  }
}

function filterTopics(topics: CountdownTopic[], tab: FilterTab): CountdownTopic[] {
  switch (tab) {
    case 'near-law':     return topics.filter((t) => t.blue_pct >= NEAR_LAW_PCT)
    case 'close':        return topics.filter((t) => t.blue_pct > NEAR_FAIL_PCT && t.blue_pct < NEAR_LAW_PCT)
    case 'near-failure': return topics.filter((t) => t.blue_pct <= NEAR_FAIL_PCT)
    default:             return topics
  }
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="space-y-2 pt-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex justify-between pt-0.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    </div>
  )
}

// ─── Filter button ────────────────────────────────────────────────────────────

function FilterBtn({
  active,
  onClick,
  children,
  activeClass = 'bg-white/10 text-white border-white/20',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  activeClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
        active
          ? activeClass
          : 'text-surface-500 border-surface-400/30 hover:border-surface-400/60 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function VotingCard({ topic, index }: { topic: CountdownTopic; index: number }) {
  const [timeLeft, setTimeLeft] = useState(() => timeUntil(topic.voting_ends_at))
  const urgency = getUrgency(topic.voting_ends_at)
  const urg = URGENCY[urgency]
  const UrgIcon = urg.icon
  const outcome = getOutcome(topic.blue_pct)
  const OutcomeIcon = outcome.icon
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const voted = topic.user_vote !== null

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(timeUntil(topic.voting_ends_at)), 30_000)
    return () => clearInterval(id)
  }, [topic.voting_ends_at])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.35 }}
      className={cn(
        'relative rounded-2xl border p-5 space-y-4 transition-colors',
        urgency === 'critical'
          ? 'bg-against-950/20 border-against-500/25 hover:border-against-500/40'
          : 'bg-surface-100/60 border-surface-300/50 hover:border-surface-400/60',
      )}
    >
      {/* Left accent bar — colour by urgency */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full',
          urgency === 'critical' ? 'bg-against-500' :
          urgency === 'urgent'   ? 'bg-gold' :
          urgency === 'active'   ? 'bg-for-500' :
          'bg-surface-500',
        )}
      />

      {/* Header row */}
      <div className="flex items-center justify-between gap-2 pl-3">
        {/* Urgency badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
            urg.bg, urg.color, urg.border,
          )}
        >
          {urg.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
          <UrgIcon className="h-3 w-3" />
          {timeLeft}
        </span>

        {/* Outcome badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
            outcome.bg, outcome.color, outcome.border,
          )}
        >
          <OutcomeIcon className="h-3 w-3" />
          {outcome.label}
        </span>
      </div>

      {/* Statement */}
      <div className="pl-3">
        <Link
          href={`/topic/${topic.id}`}
          className="group flex items-start gap-1.5 hover:opacity-80 transition-opacity"
        >
          <p className="text-base font-semibold text-white leading-snug group-hover:text-for-400 transition-colors">
            {topic.statement}
          </p>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>

      {/* Meta row */}
      <div className="pl-3 flex items-center gap-2 flex-wrap">
        {topic.category && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded-md border font-medium', catClass(topic.category))}>
            {topic.category}
          </span>
        )}
        {topic.scope && topic.scope !== 'global' && (
          <span className="inline-flex items-center gap-1 text-xs text-surface-500">
            <Globe className="h-3 w-3" />
            {topic.scope}
          </span>
        )}
        {voted && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border font-medium',
            topic.user_vote === 'blue'
              ? 'bg-for-500/10 text-for-400 border-for-500/20'
              : 'bg-against-500/10 text-against-400 border-against-500/20',
          )}>
            <Check className="h-3 w-3" />
            Voted {topic.user_vote === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
        )}
      </div>

      {/* Vote split */}
      <div className="pl-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1 text-for-400 font-semibold">
            <ThumbsUp className="h-3 w-3" />
            {forPct}% FOR
          </span>
          <span className="text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
          <span className="flex items-center gap-1 text-against-400 font-semibold">
            {againstPct}% AGAINST
            <ThumbsDown className="h-3 w-3" />
          </span>
        </div>

        {/* Split bar */}
        <div className="h-2.5 w-full rounded-full bg-surface-300/40 overflow-hidden flex">
          <div
            className="h-full bg-for-500 rounded-l-full transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-against-500 rounded-r-full flex-1 transition-all duration-500"
          />
        </div>

        {/* Law threshold marker */}
        <div className="relative h-1">
          {/* 67% FOR threshold marker */}
          <div
            className="absolute top-0 h-2 w-0.5 bg-gold/60 rounded-full -translate-y-1"
            style={{ left: '67%' }}
            title="Law threshold (67% FOR)"
          />
          {/* 33% FOR marker (failure threshold) */}
          <div
            className="absolute top-0 h-2 w-0.5 bg-surface-500/40 rounded-full -translate-y-1"
            style={{ left: '33%' }}
            title="Failure threshold (33% FOR)"
          />
        </div>
      </div>

      {/* Vote CTA */}
      <div className="pl-3">
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
            voted
              ? 'bg-surface-200/60 border border-surface-300/50 text-surface-400 hover:text-white hover:border-surface-400/60'
              : urgency === 'critical'
                ? 'bg-against-600/20 border border-against-500/30 text-against-400 hover:bg-against-600/30'
                : 'bg-for-600/20 border border-for-500/30 text-for-400 hover:bg-for-600/30',
          )}
        >
          {voted ? (
            <>
              <Check className="h-4 w-4" />
              View debate
            </>
          ) : (
            <>
              <Gavel className="h-4 w-4" />
              Cast your vote
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: CountdownResponse['stats'] }) {
  const items = [
    { label: 'Critical', value: stats.critical, color: 'text-against-400', desc: '< 6h' },
    { label: 'Urgent',   value: stats.urgent,   color: 'text-gold',        desc: '6–24h' },
    { label: 'Active',   value: stats.active,   color: 'text-for-400',     desc: '24–48h' },
    { label: 'Extended', value: stats.extended, color: 'text-surface-400', desc: '> 48h' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-surface-100/60 border border-surface-300/50 p-3 text-center"
        >
          <p className={cn('text-xl font-bold font-mono', item.color)}>{item.value}</p>
          <p className="text-xs text-white font-medium mt-0.5">{item.label}</p>
          <p className="text-[10px] text-surface-500">{item.desc}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function VotingClient() {
  const [allTopics, setAllTopics] = useState<CountdownTopic[]>([])
  const [stats, setStats] = useState<CountdownResponse['stats']>({
    critical: 0, urgent: 0, active: 0, extended: 0, total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortMode>('urgency')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topics/countdown')
      if (!res.ok) throw new Error('Failed to load')
      const data: CountdownResponse = await res.json()
      setAllTopics(data.topics)
      setStats(data.stats)
    } catch {
      setError('Failed to load voting topics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  const visible = sortTopics(filterTopics(allTopics, tab), sort)

  const tabCounts = {
    all:          allTopics.length,
    'near-law':   allTopics.filter((t) => t.blue_pct >= NEAR_LAW_PCT).length,
    close:        allTopics.filter((t) => t.blue_pct > NEAR_FAIL_PCT && t.blue_pct < NEAR_LAW_PCT).length,
    'near-failure': allTopics.filter((t) => t.blue_pct <= NEAR_FAIL_PCT).length,
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 pb-24 pt-4 md:pt-8">
        <div className="mx-auto max-w-3xl px-4 space-y-6">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 py-4"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-for-500/10 border border-for-500/20 flex items-center justify-center">
                <Gavel className="h-6 w-6 text-for-400" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Votes in Progress
            </h1>
            <p className="text-surface-500 max-w-xl mx-auto text-sm leading-relaxed">
              Every civic debate currently in the voting phase. These are the live decisions
              your vote can still shape — some closing in hours.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-surface-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-against-400" />
                Critical (&lt; 6h)
              </span>
              <span className="text-surface-600">·</span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gold" />
                Urgent (6–24h)
              </span>
              <span className="text-surface-600">·</span>
              <span className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5 text-gold" />
                Gold marker = law threshold
              </span>
            </div>
          </motion.div>

          {/* Stats bar */}
          {!loading && <StatsBar stats={stats} />}

          {/* Controls */}
          <div className="space-y-3">
            {/* Outcome tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Outcome:</span>
              <FilterBtn
                active={tab === 'all'}
                onClick={() => setTab('all')}
              >
                All ({tabCounts.all})
              </FilterBtn>
              <FilterBtn
                active={tab === 'near-law'}
                onClick={() => setTab('near-law')}
                activeClass="bg-gold/15 text-gold border-gold/30"
              >
                <span className="flex items-center gap-1">
                  <Gavel className="h-3 w-3" />
                  Near Law ({tabCounts['near-law']})
                </span>
              </FilterBtn>
              <FilterBtn
                active={tab === 'close'}
                onClick={() => setTab('close')}
                activeClass="bg-purple/15 text-purple border-purple/30"
              >
                <span className="flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  Too Close ({tabCounts.close})
                </span>
              </FilterBtn>
              <FilterBtn
                active={tab === 'near-failure'}
                onClick={() => setTab('near-failure')}
                activeClass="bg-against-500/15 text-against-400 border-against-500/30"
              >
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />
                  Near Failure ({tabCounts['near-failure']})
                </span>
              </FilterBtn>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0 flex items-center gap-1">
                <SlidersHorizontal className="h-3 w-3" />
                Sort:
              </span>
              <FilterBtn
                active={sort === 'urgency'}
                onClick={() => setSort('urgency')}
                activeClass="bg-against-500/15 text-against-400 border-against-500/30"
              >
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Urgency
                </span>
              </FilterBtn>
              <FilterBtn
                active={sort === 'consensus'}
                onClick={() => setSort('consensus')}
                activeClass="bg-for-500/15 text-for-400 border-for-500/30"
              >
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Consensus
                </span>
              </FilterBtn>
              <FilterBtn
                active={sort === 'votes'}
                onClick={() => setSort('votes')}
                activeClass="bg-purple/15 text-purple border-purple/30"
              >
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Most Votes
                </span>
              </FilterBtn>
            </div>
          </div>

          {/* Count + refresh */}
          {!loading && allTopics.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-sm text-surface-500">
                <span className="text-white font-semibold">{visible.length}</span>{' '}
                topic{visible.length !== 1 ? 's' : ''} in voting
                {tab !== 'all' && ' (filtered)'}
              </span>
              <button
                onClick={() => load()}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </motion.div>
          )}

          {/* Content */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-against-500/20 bg-against-950/10 p-6 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
              <p className="text-against-400 font-medium">{error}</p>
              <button
                onClick={() => load()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-white text-sm font-medium hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Gavel}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              iconBorder="border-for-500/20"
              title={
                tab === 'all'
                  ? 'No votes in progress'
                  : `No ${tab === 'near-law' ? 'near-law' : tab === 'close' ? 'too-close' : 'near-failure'} topics`
              }
              description={
                tab === 'all'
                  ? 'No topics are currently in the voting phase. Check active debates or proposed topics.'
                  : 'Try a different filter to see more voting topics.'
              }
              actions={[
                { label: 'Near Law',    href: '/near-law',     variant: 'primary' },
                { label: 'All Topics',  href: '/topics',       variant: 'secondary' },
              ]}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${tab}-${sort}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {visible.map((topic, i) => (
                  <VotingCard key={topic.id} topic={topic} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Related navigation */}
          <div className="pt-4 border-t border-surface-300/40 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/near-law',    label: 'Near Law',      icon: Gavel },
              { href: '/last-call',   label: 'Last Call',     icon: Timer },
              { href: '/countdown',   label: 'Countdown',     icon: Clock },
              { href: '/battleground',label: 'Battleground',  icon: Scale },
              { href: '/deadlock',    label: 'Deadlock',      icon: AlertTriangle },
              { href: '/topics',      label: 'All Topics',    icon: TrendingUp },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100/50 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  <span className="text-xs font-medium text-surface-500 group-hover:text-white transition-colors">
                    {link.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
