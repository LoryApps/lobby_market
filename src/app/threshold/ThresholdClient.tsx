'use client'

/**
 * /threshold — The Civic Threshold
 *
 * Tracks topics at critical status-transition moments:
 *   • Activating   — proposed topics ≥ 80% of their support threshold
 *   • Just Activated — topics that became active in the last 48 h
 *   • Entering Vote  — topics that entered voting phase in the last 72 h
 *   • Nearing Law    — voting topics with strong FOR majority (≥ 62%)
 *   • Nearing Fail   — voting topics with strong AGAINST majority (≤ 38%)
 *
 * Distinct from:
 *   /surge         — raw velocity/momentum (how fast topics gain votes)
 *   /tipping-point — topics near the 75% consensus line (vote-% proximity)
 *   /pipeline      — all topics at every stage (full overview)
 *   /influx        — viewer-to-voter gap (not about status change)
 *   /split         — most contested 50/50 splits (not status transitions)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ThresholdResponse,
  ThresholdStats,
  ThresholdTopic,
  ThresholdZone,
} from '@/app/api/topics/threshold/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-indigo-400',
  Culture:     'text-orange-400',
  Health:      'text-pink-400',
  Environment: 'text-green-400',
  Education:   'text-cyan-400',
}

function catColor(cat: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function fmtCountdown(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'closing now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h === 0) return `${m}m left`
  if (h < 24) return m > 0 ? `${h}h ${m}m left` : `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

function fmtHoursAgo(h: number): string {
  if (h < 1) return 'just now'
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Zone config ──────────────────────────────────────────────────────────────

const ZONE_CONFIG: Record<
  ThresholdZone,
  { label: string; icon: typeof Zap; color: string; bg: string; border: string; desc: string }
> = {
  activating: {
    label: 'On the Brink',
    icon: Zap,
    color: 'text-for-400',
    bg: 'bg-for-500/8',
    border: 'border-for-500/25',
    desc: 'Proposed — ≥ 80% of activation support gathered',
  },
  just_activated: {
    label: 'Just Activated',
    icon: Sparkles,
    color: 'text-emerald',
    bg: 'bg-emerald/8',
    border: 'border-emerald/25',
    desc: 'Activated in the last 48 hours — fresh debates open for votes',
  },
  entering_vote: {
    label: 'Entering Vote',
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/8',
    border: 'border-purple/25',
    desc: 'Voting phase opened in the last 72 hours',
  },
  nearing_law: {
    label: 'Nearing Law',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/8',
    border: 'border-gold/25',
    desc: 'Strong FOR majority — approaching consensus threshold',
  },
  nearing_fail: {
    label: 'Nearing Failure',
    icon: XCircle,
    color: 'text-against-400',
    bg: 'bg-against-500/8',
    border: 'border-against-500/25',
    desc: 'Strong AGAINST majority — heading toward rejection',
  },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2"
        >
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Topic Cards ──────────────────────────────────────────────────────────────

function ActivatingCard({ topic }: { topic: ThresholdTopic }) {
  const remaining = Math.max(0, topic.activation_threshold - topic.support_count)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-100 p-4 transition-all duration-200 group',
        'hover:border-for-500/40 hover:bg-surface-200/60',
        'border-surface-300',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="proposed">Proposed</Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-medium', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-for-400 flex-shrink-0 font-semibold">
          {topic.activation_pct}% ready
        </span>
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-for-200 transition-colors">
        {topic.statement}
      </p>

      <div className="space-y-1.5">
        <div
          className="h-2 w-full rounded-full bg-surface-300 overflow-hidden"
          role="progressbar"
          aria-valuenow={topic.support_count}
          aria-valuemax={topic.activation_threshold}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-700 to-for-400 transition-all duration-500"
            style={{ width: `${Math.min(topic.activation_pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400 font-semibold">
            {topic.support_count.toLocaleString()} supporters
          </span>
          <span>
            {remaining === 0
              ? 'Threshold reached!'
              : `${remaining.toLocaleString()} more needed`}
          </span>
        </div>
      </div>
    </Link>
  )
}

function JustActivatedCard({ topic }: { topic: ThresholdTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-100 p-4 transition-all duration-200 group',
        'hover:border-emerald/40 hover:bg-surface-200/60',
        'border-emerald/20',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="active">Active</Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-medium', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
          {fmtHoursAgo(topic.hours_in_status)}
        </span>
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-emerald/80 transition-colors">
        {topic.statement}
      </p>

      {topic.total_votes > 0 ? (
        <div className="space-y-1">
          <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-surface-300">
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-for-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 rounded-r-full bg-against-600"
              style={{ width: `${againstPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}%</span>
            <span className="text-surface-500">{fmtVotes(topic.total_votes)} votes</span>
            <span className="text-against-400">{againstPct}%</span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] font-mono text-surface-600">No votes yet — be the first</p>
      )}
    </Link>
  )
}

function EnteringVoteCard({ topic }: { topic: ThresholdTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const countdown = fmtCountdown(topic.voting_ends_at)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-100 p-4 transition-all duration-200 group',
        'hover:border-purple/40 hover:bg-surface-200/60',
        'border-purple/20',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="active">Voting</Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-medium', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
        {countdown && (
          <span className="text-[10px] font-mono text-purple flex items-center gap-1 flex-shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {countdown}
          </span>
        )}
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-purple/80 transition-colors">
        {topic.statement}
      </p>

      <div className="space-y-1">
        <div className="relative h-2 w-full rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-for-500"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-against-600"
            style={{ width: `${againstPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-surface-500">{fmtVotes(topic.total_votes)} votes</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
        </div>
      </div>
    </Link>
  )
}

function NearingLawCard({ topic }: { topic: ThresholdTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const countdown = fmtCountdown(topic.voting_ends_at)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-100 p-4 transition-all duration-200 group',
        'hover:border-gold/50 hover:bg-surface-200/60',
        'border-gold/30',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="active">Voting</Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-medium', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {countdown && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {countdown}
            </span>
          )}
          <span className="text-[10px] font-mono text-gold font-bold flex items-center gap-0.5">
            <ThumbsUp className="h-2.5 w-2.5" />
            {forPct}%
          </span>
        </div>
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-gold/80 transition-colors">
        {topic.statement}
      </p>

      <div className="space-y-1.5">
        <div className="relative h-2.5 w-full rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-for-700 to-for-400"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-against-700"
            style={{ width: `${100 - forPct}%` }}
          />
          {/* Law threshold marker at 75% */}
          <div
            className="absolute inset-y-0 w-px bg-gold/80"
            style={{ left: '75%' }}
            aria-label="Law threshold at 75%"
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-gold">75% threshold</span>
          <span>{fmtVotes(topic.total_votes)} votes</span>
        </div>
      </div>
    </Link>
  )
}

function NearingFailCard({ topic }: { topic: ThresholdTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const countdown = fmtCountdown(topic.voting_ends_at)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-100 p-4 transition-all duration-200 group',
        'hover:border-against-500/50 hover:bg-surface-200/60',
        'border-against-500/30',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="active">Voting</Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-medium', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {countdown && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {countdown}
            </span>
          )}
          <span className="text-[10px] font-mono text-against-400 font-bold flex items-center gap-0.5">
            <ThumbsDown className="h-2.5 w-2.5" />
            {againstPct}%
          </span>
        </div>
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-against-400/80 transition-colors">
        {topic.statement}
      </p>

      <div className="space-y-1.5">
        <div className="relative h-2.5 w-full rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-for-700"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-against-500 to-against-700"
            style={{ width: `${againstPct}%` }}
          />
          {/* Fail threshold marker at 25% FOR (= 75% against) */}
          <div
            className="absolute inset-y-0 w-px bg-against-400/80"
            style={{ left: '25%' }}
            aria-label="Failure threshold at 25% FOR"
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span>{fmtVotes(topic.total_votes)} votes</span>
          <span className="text-against-400">25% threshold</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  zone,
  topics,
  defaultOpen = false,
}: {
  zone: ThresholdZone
  topics: ThresholdTopic[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || topics.length > 0)
  const cfg = ZONE_CONFIG[zone]
  const Icon = cfg.icon

  if (topics.length === 0) {
    return (
      <section>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-3 group"
        >
          <div className="flex items-center gap-2.5">
            <div className={cn('p-2 rounded-xl', cfg.bg, 'border', cfg.border)}>
              <Icon className={cn('h-4 w-4', cfg.color)} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-white">{cfg.label}</span>
                <span className="text-[10px] font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded-full">
                  0
                </span>
              </div>
              <p className="text-[10px] font-mono text-surface-600 mt-0.5">{cfg.desc}</p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-surface-500 transition-transform flex-shrink-0',
              open && 'rotate-180',
            )}
          />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-surface-300/60 bg-surface-100/50 p-6 text-center">
                <p className="text-xs font-mono text-surface-600">
                  No topics in this zone right now.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    )
  }

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('p-2 rounded-xl', cfg.bg, 'border', cfg.border)}>
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-white">{cfg.label}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                  cfg.bg,
                  cfg.border,
                  cfg.color,
                )}
              >
                {topics.length}
              </span>
            </div>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">{cfg.desc}</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-surface-500 transition-transform flex-shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pb-1">
              {topics.map((topic, i) => (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  {zone === 'activating' && <ActivatingCard topic={topic} />}
                  {zone === 'just_activated' && <JustActivatedCard topic={topic} />}
                  {zone === 'entering_vote' && <EnteringVoteCard topic={topic} />}
                  {zone === 'nearing_law' && <NearingLawCard topic={topic} />}
                  {zone === 'nearing_fail' && <NearingFailCard topic={topic} />}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: ThresholdStats }) {
  const items = [
    { label: 'On Brink', value: stats.activating_count, color: 'text-for-400' },
    { label: 'Activated', value: stats.just_activated_count, color: 'text-emerald' },
    { label: 'In Vote', value: stats.entering_vote_count, color: 'text-purple' },
    { label: 'Near Law', value: stats.nearing_law_count, color: 'text-gold' },
    { label: 'Near Fail', value: stats.nearing_fail_count, color: 'text-against-400' },
  ]

  return (
    <div className="grid grid-cols-5 gap-2 rounded-2xl bg-surface-100 border border-surface-300 p-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-0.5">
          <span className={cn('text-lg font-mono font-bold tabular-nums', item.color)}>
            {item.value}
          </span>
          <span className="text-[9px] font-mono text-surface-600 text-center leading-tight">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ThresholdClient() {
  const [data, setData] = useState<ThresholdResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/threshold')
      if (!res.ok) throw new Error('fetch_failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const total = data?.stats.total ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-6">
        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Activity className="h-6 w-6 text-for-400" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-white mb-1">
              The Civic Threshold
            </h1>
            <p className="text-sm font-mono text-surface-500 leading-relaxed">
              Topics at critical transition moments — activating, entering vote, nearing law or failure.
            </p>
          </div>
        </div>

        {/* ── Live indicator ───────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="flex items-center gap-2 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-for-500" />
            </span>
            <span className="text-xs font-mono text-surface-500">
              {total > 0
                ? `${total} topic${total !== 1 ? 's' : ''} at threshold right now`
                : 'Monitoring for threshold events'}
            </span>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load threshold data"
            description="Check your connection and try refreshing."
            actions={[{ label: 'Retry', onClick: () => load() }]}
          />
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {loading && !error && (
          <div className="space-y-6">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Stats strip */}
            <StatsStrip stats={data.stats} />

            {/* Sections — sorted by urgency */}
            <Section zone="nearing_law" topics={data.nearing_law} defaultOpen />
            <Section zone="activating" topics={data.activating} defaultOpen />
            <Section zone="entering_vote" topics={data.entering_vote} defaultOpen />
            <Section zone="just_activated" topics={data.just_activated} defaultOpen />
            <Section zone="nearing_fail" topics={data.nearing_fail} />

            {/* Footer nav */}
            <div className="pt-4 border-t border-surface-300 flex flex-wrap gap-2">
              {[
                { href: '/surge', label: 'Surge', icon: Flame },
                { href: '/tipping-point', label: 'Tipping Point', icon: AlertTriangle },
                { href: '/pipeline', label: 'Pipeline', icon: ArrowRight },
                { href: '/split', label: 'The Split', icon: Scale },
                { href: '/bedrock', label: 'Bedrock Laws', icon: Gavel },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
