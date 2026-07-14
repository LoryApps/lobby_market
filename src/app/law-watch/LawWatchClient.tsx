'use client'

/**
 * /law-watch — Real-time Legislative Tracker
 *
 * Monitors every topic currently in the voting phase, scoring each by
 * law probability and surfacing momentum signals.
 *
 * Sections:
 *   IMMINENT — above 75% FOR threshold, expected to pass soon
 *   LIKELY   — 60–74% FOR, on track but not guaranteed
 *   CONTESTED — 45–59% FOR, outcome genuinely uncertain
 *   UNLIKELY — 25–44% FOR, would need a major swing
 *   FAILING  — below 25% FOR, heading to rejection
 *   ACTIVE WATCH — active-phase topics already at ≥60% FOR (approaching voting)
 *
 * Distinct from:
 *   /triage     — urgency-based (starved, deadlocked, expiring)
 *   /topics     — general topic browser
 *   /watchlist  — personal subscriptions
 *   /threshold  — threshold tracker (static view)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Filter,
  Gavel,
  Globe,
  MapPin,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawWatchResponse, WatchedTopic, LawChance } from '@/app/api/law-watch/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 90_000
const LAW_THRESHOLD = 75

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(hours: number | null): string {
  if (hours === null) return '—'
  if (hours <= 0) return 'Ended'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours)}h`
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`
}

function formatVotesPerHour(vph: number): string {
  if (vph < 0.1) return '<0.1/h'
  if (vph < 1) return `${vph.toFixed(1)}/h`
  return `${Math.round(vph)}/h`
}

// ─── Chance config ────────────────────────────────────────────────────────────

const CHANCE_CONFIG: Record<
  LawChance,
  { label: string; icon: typeof Gavel; bg: string; border: string; text: string; dotColor: string }
> = {
  imminent: {
    label: 'Law Imminent',
    icon: Gavel,
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    text: 'text-gold',
    dotColor: 'bg-gold',
  },
  likely: {
    label: 'Likely to Pass',
    icon: TrendingUp,
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    text: 'text-for-400',
    dotColor: 'bg-for-500',
  },
  contested: {
    label: 'Contested',
    icon: Scale,
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    text: 'text-purple',
    dotColor: 'bg-purple',
  },
  unlikely: {
    label: 'Unlikely',
    icon: TrendingDown,
    bg: 'bg-surface-200/60',
    border: 'border-surface-400/60',
    text: 'text-surface-500',
    dotColor: 'bg-surface-500',
  },
  failing: {
    label: 'Heading to Rejection',
    icon: XCircle,
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    text: 'text-against-400',
    dotColor: 'bg-against-500',
  },
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-emerald',
  Science: 'text-purple',
  Ethics: 'text-for-300',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

const SCOPE_ICON: Record<string, typeof Globe> = {
  Global: Globe,
  National: MapPin,
  Regional: MapPin,
  Local: MapPin,
}

// ─── Law probability bar ──────────────────────────────────────────────────────

function LawProbabilityBar({ pct, chance }: { pct: number; chance: LawChance }) {
  const cfg = CHANCE_CONFIG[chance]
  const barWidth = Math.max(2, Math.min(100, pct))

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-surface-500">Law Probability</span>
        <span className={cn('text-[11px] font-mono font-bold', cfg.text)}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', {
            'bg-gold': chance === 'imminent',
            'bg-for-500': chance === 'likely',
            'bg-purple': chance === 'contested',
            'bg-surface-500': chance === 'unlikely',
            'bg-against-500': chance === 'failing',
          })}
          initial={false}
          animate={{ width: `${barWidth}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>
      {/* Threshold marker at 75% */}
      <div className="relative -mt-1.5 h-0">
        <div className="absolute" style={{ left: `${LAW_THRESHOLD}%` }}>
          <div className="w-px h-2.5 bg-surface-500/60" />
        </div>
      </div>
    </div>
  )
}

// ─── FOR/AGAINST split bar ────────────────────────────────────────────────────

function SplitBar({ bluePct }: { bluePct: number }) {
  const redPct = 100 - bluePct
  return (
    <div
      className="relative w-full h-2 rounded-full overflow-hidden bg-surface-300"
      role="img"
      aria-label={`${Math.round(bluePct)}% for, ${Math.round(redPct)}% against`}
    >
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-l-full"
        initial={false}
        animate={{ width: `${bluePct}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      />
      <motion.div
        className="absolute inset-y-0 right-0 bg-gradient-to-r from-against-400 to-against-600 rounded-r-full"
        initial={false}
        animate={{ width: `${redPct}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      />
      {/* Law threshold marker */}
      <div
        className="absolute inset-y-0 w-px bg-gold/60"
        style={{ left: `${LAW_THRESHOLD}%` }}
      />
    </div>
  )
}

// ─── Topic row card ───────────────────────────────────────────────────────────

function TopicWatchCard({
  topic,
  rank,
  showActiveLabel,
}: {
  topic: WatchedTopic
  rank: number
  showActiveLabel?: boolean
}) {
  const cfg = CHANCE_CONFIG[topic.law_chance]
  const Icon = cfg.icon
  const ScopeIcon = SCOPE_ICON[topic.scope] ?? Globe
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.3 }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div
          className={cn(
            'rounded-xl border p-4 transition-all duration-200',
            'hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20',
            cfg.bg,
            cfg.border,
            'hover:border-opacity-70'
          )}
        >
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            {/* Rank */}
            <span className="text-[11px] font-mono text-surface-600 mt-0.5 w-4 flex-shrink-0">
              {rank}
            </span>

            {/* Statement */}
            <p className="flex-1 text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
              {topic.statement}
            </p>

            {/* Chance badge */}
            <div
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold',
                cfg.bg,
                cfg.border,
                cfg.text
              )}
            >
              <Icon className="h-3 w-3" />
              {showActiveLabel ? 'Active' : topic.status === 'voting' ? 'VOTING' : topic.status.toUpperCase()}
            </div>
          </div>

          {/* Split bar */}
          <SplitBar bluePct={topic.blue_pct} />

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 mb-3">
            <span className="text-xs font-mono font-bold text-for-400">{forPct}% FOR</span>
            <span className="text-surface-600 text-[10px]">/</span>
            <span className="text-xs font-mono font-bold text-against-400">{againstPct}% AGAINST</span>
            <span className="ml-auto text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>

          {/* Law probability */}
          <LawProbabilityBar pct={topic.chance_pct} chance={topic.law_chance} />

          {/* Footer */}
          <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-surface-500">
            {/* Category */}
            {topic.category && (
              <span className={catColor}>{topic.category}</span>
            )}

            {/* Scope */}
            <span className="flex items-center gap-0.5">
              <ScopeIcon className="h-3 w-3" />
              {topic.scope}
            </span>

            {/* Days active */}
            <span>{topic.days_active}d active</span>

            {/* Vote rate */}
            <span className="flex items-center gap-0.5">
              <Activity className="h-3 w-3" />
              {formatVotesPerHour(topic.votes_per_hour)}
            </span>

            {/* Countdown */}
            {topic.hours_remaining !== null && (
              <span
                className={cn(
                  'ml-auto flex items-center gap-0.5',
                  topic.hours_remaining < 6 ? 'text-gold animate-pulse' : 'text-surface-500'
                )}
              >
                <Clock className="h-3 w-3" />
                {formatCountdown(topic.hours_remaining)} left
              </span>
            )}
          </div>

          {/* Signal line */}
          <p className={cn('mt-2 text-[11px] leading-snug', cfg.text)}>
            {topic.signal_detail}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function WatchSection({
  title,
  description,
  topics,
  chance,
  defaultOpen,
  showActiveLabel,
}: {
  title: string
  description: string
  topics: WatchedTopic[]
  chance: LawChance
  defaultOpen?: boolean
  showActiveLabel?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const cfg = CHANCE_CONFIG[chance]
  const Icon = cfg.icon

  if (topics.length === 0) return null

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-surface-200/40 transition-colors text-left"
      >
        <div
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-full border',
            cfg.bg,
            cfg.border
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-semibold', cfg.text)}>{title}</span>
            <span className="text-[11px] font-mono bg-surface-300 text-surface-400 px-1.5 py-0.5 rounded-full">
              {topics.length}
            </span>
          </div>
          <p className="text-[11px] text-surface-500 truncate">{description}</p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              {topics.map((t, i) => (
                <TopicWatchCard
                  key={t.id}
                  topic={t}
                  rank={i + 1}
                  showActiveLabel={showActiveLabel}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface-200/60 border border-surface-300/60 rounded-xl p-3">
      <span className={cn('text-xl font-mono font-bold', color ?? 'text-white')}>
        {value}
      </span>
      <span className="text-[11px] font-mono text-surface-400">{label}</span>
      {sub && <span className="text-[10px] text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LawWatchClient() {
  const [data, setData] = useState<LawWatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/law-watch', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const json: LawWatchResponse = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  // Category filter helper
  function filterByCategory(topics: WatchedTopic[]): WatchedTopic[] {
    if (!categoryFilter) return topics
    return topics.filter((t) => t.category === categoryFilter)
  }

  const categories = data
    ? Array.from(
        new Set(
          [
            ...data.imminent,
            ...data.likely,
            ...data.contested,
            ...data.unlikely,
            ...data.failing,
            ...data.active_watch,
          ].map((t) => t.category).filter(Boolean)
        )
      ).sort() as string[]
    : []

  const totalTracked = data
    ? data.imminent.length + data.likely.length + data.contested.length
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Gavel className="h-5 w-5 text-gold" />
            <h1 className="text-xl font-bold text-white">Law Watch</h1>
            {/* Live indicator */}
            <span className="flex items-center gap-1 ml-1 text-[10px] font-mono text-emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-surface-400">
            Real-time tracker for topics in the voting phase — scored by law probability.
          </p>
          {lastUpdated && (
            <p className="text-[11px] font-mono text-surface-600 mt-0.5">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors text-xs font-mono"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>

          <button
            onClick={() => setShowFilters((f) => !f)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
              showFilters
                ? 'bg-for-500/20 border border-for-500/40 text-for-400'
                : 'bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter{categoryFilter ? `: ${categoryFilter}` : ''}
          </button>

          <Link
            href="/triage"
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors text-xs font-mono"
          >
            Triage
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Category filter pills */}
        <AnimatePresence>
          {showFilters && categories.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="flex flex-wrap gap-2 py-2">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-mono transition-colors border',
                    !categoryFilter
                      ? 'bg-for-500/20 border-for-500/40 text-for-400'
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-mono transition-colors border',
                      categoryFilter === cat
                        ? 'bg-for-500/20 border-for-500/40 text-for-400'
                        : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load Law Watch"
            description="Check your connection and try again."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <StatTile
                label="In Voting"
                value={data.total_voting}
                sub="active voting phase"
                color="text-purple"
              />
              <StatTile
                label="On Track"
                value={data.imminent.length + data.likely.length}
                sub="likely to pass"
                color="text-for-400"
              />
              <StatTile
                label="Active Watch"
                value={data.active_watch.length}
                sub="≥60% FOR active topics"
                color="text-gold"
              />
            </div>

            {/* No voting topics */}
            {data.total_voting === 0 && data.active_watch.length === 0 && (
              <EmptyState
                icon={Scale}
                title="No topics currently in voting"
                description="When active topics reach the support threshold they enter voting. Check back soon."
                action={{ label: 'Browse active topics', href: '/topics?status=active' }}
              />
            )}

            {/* Imminent */}
            <WatchSection
              title="Law Imminent"
              description="Above 75% FOR threshold — expected to pass soon"
              topics={filterByCategory(data.imminent)}
              chance="imminent"
              defaultOpen
            />

            {/* Likely */}
            <WatchSection
              title="On Track to Pass"
              description="60–74% FOR — strong majority, heading toward law"
              topics={filterByCategory(data.likely)}
              chance="likely"
              defaultOpen
            />

            {/* Contested */}
            <WatchSection
              title="Too Close to Call"
              description="45–59% FOR — genuine uncertainty, every vote counts"
              topics={filterByCategory(data.contested)}
              chance="contested"
              defaultOpen={totalTracked < 3}
            />

            {/* Unlikely */}
            <WatchSection
              title="Uphill Battle"
              description="25–44% FOR — needs a major swing to pass"
              topics={filterByCategory(data.unlikely)}
              chance="unlikely"
              defaultOpen={false}
            />

            {/* Failing */}
            <WatchSection
              title="Heading to Rejection"
              description="Below 25% FOR — on course for defeat"
              topics={filterByCategory(data.failing)}
              chance="failing"
              defaultOpen={false}
            />

            {/* Active Watch */}
            {data.active_watch.length > 0 && (
              <div className="mt-6 pt-4 border-t border-surface-300/40">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Active Phase — Law Watch</h2>
                </div>
                <p className="text-[11px] text-surface-500 mb-3">
                  Topics still in the active phase with ≥60% FOR — strong early signals of future law candidates.
                </p>
                <WatchSection
                  title="Rising Candidates"
                  description="Active topics already above 60% FOR — watch for entry to voting phase"
                  topics={filterByCategory(data.active_watch)}
                  chance="likely"
                  defaultOpen={data.total_voting < 5}
                  showActiveLabel
                />
              </div>
            )}

            {/* Threshold legend */}
            <div className="mt-8 p-4 rounded-xl bg-surface-200/40 border border-surface-300/40">
              <h3 className="text-xs font-semibold text-surface-400 mb-3 uppercase tracking-wide">
                How Law Probability Works
              </h3>
              <div className="space-y-2 text-[11px] text-surface-500">
                <p>
                  <span className="text-gold font-semibold">75% FOR</span> — the consensus threshold. Topics that sustain
                  ≥75% FOR votes through their voting phase become established laws in the Civic Codex.
                </p>
                <p>
                  <span className="text-against-400 font-semibold">25% FOR (or below)</span> — the rejection threshold.
                  Topics below this mark are voted down and recorded as failed proposals.
                </p>
                <p>
                  Law Probability combines the current FOR%, distance to the threshold, and time pressure to score
                  each topic 0–100. The gold marker on every bar marks the 75% law line.
                </p>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-400/30">
                <Link
                  href="/laws"
                  className="flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
                >
                  View the Law Codex <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/triage"
                  className="flex items-center gap-1 text-[11px] text-surface-400 hover:text-white transition-colors"
                >
                  Urgency Triage <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/threshold"
                  className="flex items-center gap-1 text-[11px] text-surface-400 hover:text-white transition-colors"
                >
                  Threshold tracker <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
