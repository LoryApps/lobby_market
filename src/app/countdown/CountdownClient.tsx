'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CountdownTopic, CountdownResponse } from '@/app/api/topics/countdown/route'

// ─── Urgency tiers ─────────────────────────────────────────────────────────────

type UrgencyTier = 'critical' | 'urgent' | 'active' | 'extended' | 'expired'

function getUrgency(voting_ends_at: string): UrgencyTier {
  const ms = new Date(voting_ends_at).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const h = ms / 3_600_000
  if (h < 6) return 'critical'
  if (h < 24) return 'urgent'
  if (h < 48) return 'active'
  return 'extended'
}

const URGENCY_CONFIG: Record<
  UrgencyTier,
  {
    label: string
    dot: string
    pill: string
    border: string
    glow: string
    icon: typeof Clock
    animate: boolean
  }
> = {
  critical: {
    label: 'Critical',
    dot: 'bg-against-500',
    pill: 'bg-against-500/15 border-against-500/50 text-against-300',
    border: 'border-against-500/40 hover:border-against-500/70',
    glow: 'shadow-against-600/10',
    icon: AlertTriangle,
    animate: true,
  },
  urgent: {
    label: 'Urgent',
    dot: 'bg-gold',
    pill: 'bg-gold/15 border-gold/50 text-gold',
    border: 'border-gold/30 hover:border-gold/60',
    glow: 'shadow-gold/10',
    icon: Flame,
    animate: true,
  },
  active: {
    label: 'Active',
    dot: 'bg-purple',
    pill: 'bg-purple/15 border-purple/50 text-purple',
    border: 'border-purple/30 hover:border-purple/60',
    glow: '',
    icon: Zap,
    animate: false,
  },
  extended: {
    label: 'Open',
    dot: 'bg-surface-500',
    pill: 'bg-surface-300/20 border-surface-400/40 text-surface-400',
    border: 'border-surface-300 hover:border-surface-400',
    glow: '',
    icon: Clock,
    animate: false,
  },
  expired: {
    label: 'Expired',
    dot: 'bg-surface-600',
    pill: 'bg-surface-600/20 border-surface-600/40 text-surface-600',
    border: 'border-surface-400',
    glow: '',
    icon: Timer,
    animate: false,
  },
}

// ─── Countdown formatter ────────────────────────────────────────────────────────

function formatCountdown(voting_ends_at: string): string {
  const ms = new Date(voting_ends_at).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

// ─── Category accent ──────────────────────────────────────────────────────────

const CATEGORY_TEXT: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

// ─── Live countdown display ──────────────────────────────────────────────────

function CountdownDisplay({
  voting_ends_at,
  urgency,
}: {
  voting_ends_at: string
  urgency: UrgencyTier
}) {
  const [display, setDisplay] = useState(() => formatCountdown(voting_ends_at))

  useEffect(() => {
    setDisplay(formatCountdown(voting_ends_at))
    const needsSeconds = urgency === 'critical' || urgency === 'urgent'
    const interval = needsSeconds ? 1000 : 30_000
    const id = setInterval(() => setDisplay(formatCountdown(voting_ends_at)), interval)
    return () => clearInterval(id)
  }, [voting_ends_at, urgency])

  return (
    <span
      className={cn(
        'font-mono text-sm font-bold tabular-nums',
        urgency === 'critical' && 'text-against-300',
        urgency === 'urgent' && 'text-gold',
        urgency === 'active' && 'text-purple',
        (urgency === 'extended' || urgency === 'expired') && 'text-surface-500',
      )}
    >
      {display}
    </span>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({
  blue_pct,
  total_votes,
  user_vote,
}: {
  blue_pct: number
  total_votes: number
  user_vote: 'blue' | 'red' | null
}) {
  const forPct = Math.round(blue_pct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
        <div
          className="h-full bg-for-500 rounded-l-full transition-all duration-500"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-against-500 rounded-r-full transition-all duration-500"
          style={{ width: `${againstPct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1">
          <ThumbsUp
            className={cn(
              'h-3 w-3',
              user_vote === 'blue' ? 'text-for-400' : 'text-surface-600',
            )}
          />
          <span className={cn(user_vote === 'blue' ? 'text-for-400 font-semibold' : 'text-surface-500')}>
            {forPct}%
          </span>
        </div>
        <span className="text-surface-600 text-[10px]">
          {total_votes.toLocaleString()} vote{total_votes !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          <span className={cn(user_vote === 'red' ? 'text-against-400 font-semibold' : 'text-surface-500')}>
            {againstPct}%
          </span>
          <ThumbsDown
            className={cn(
              'h-3 w-3',
              user_vote === 'red' ? 'text-against-400' : 'text-surface-600',
            )}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Topic card ──────────────────────────────────────────────────────────────

function CountdownCard({ topic }: { topic: CountdownTopic }) {
  const urgency = getUrgency(topic.voting_ends_at)
  const cfg = URGENCY_CONFIG[urgency]
  const Icon = cfg.icon
  const catText = CATEGORY_TEXT[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block p-4 rounded-xl bg-surface-100 border transition-all duration-200 group',
          'shadow-sm',
          cfg.border,
          cfg.glow && `shadow-md ${cfg.glow}`,
        )}
      >
        {/* Header row: urgency pill + countdown */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                cfg.pill,
              )}
            >
              {cfg.animate && (
                <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', cfg.dot)} />
              )}
              <Icon className="h-3 w-3" aria-hidden="true" />
              {cfg.label}
            </span>
            {topic.category && (
              <span className={cn('text-xs font-mono', catText)}>
                {topic.category}
              </span>
            )}
          </div>

          <CountdownDisplay
            voting_ends_at={topic.voting_ends_at}
            urgency={urgency}
          />
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-3 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <VoteBar
          blue_pct={topic.blue_pct}
          total_votes={topic.total_votes}
          user_vote={topic.user_vote}
        />

        {/* Footer: voted indicator + CTA */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300/60">
          <div className="text-[11px] font-mono text-surface-600">
            {topic.user_vote ? (
              <span className="flex items-center gap-1 text-emerald">
                <Check className="h-3 w-3" />
                You voted {topic.user_vote === 'blue' ? 'FOR' : 'AGAINST'}
              </span>
            ) : (
              <span className="text-surface-500">
                You haven&apos;t voted yet
              </span>
            )}
          </div>
          <span
            className={cn(
              'text-[11px] font-mono font-semibold flex items-center gap-1',
              'text-for-400 group-hover:text-for-300 transition-colors',
            )}
          >
            {topic.user_vote ? 'View debate' : 'Vote now'}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({
  stats,
}: {
  stats: CountdownResponse['stats']
}) {
  const items = [
    { label: 'Critical', value: stats.critical, color: 'text-against-400', bg: 'bg-against-500/10' },
    { label: 'Urgent', value: stats.urgent, color: 'text-gold', bg: 'bg-gold/10' },
    { label: 'Active', value: stats.active, color: 'text-purple', bg: 'bg-purple/10' },
    { label: 'Open', value: stats.extended, color: 'text-surface-400', bg: 'bg-surface-300/20' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {items.map(({ label, value, color, bg }) => (
        <div
          key={label}
          className={cn('flex flex-col items-center gap-1 py-2.5 rounded-xl border border-surface-300', bg)}
        >
          <span className={cn('text-xl font-mono font-bold tabular-nums', color)}>
            {value}
          </span>
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tab ───────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'critical' | 'urgent' | 'active' | 'extended' | 'unvoted'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'active', label: 'Active' },
  { key: 'extended', label: 'Open' },
  { key: 'unvoted', label: 'Not Voted' },
]

function filterTopics(topics: CountdownTopic[], filter: FilterTab): CountdownTopic[] {
  if (filter === 'all') return topics
  if (filter === 'unvoted') return topics.filter((t) => t.user_vote === null)
  return topics.filter((t) => {
    const u = getUrgency(t.voting_ends_at)
    return u === filter
  })
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// ─── Sort options ────────────────────────────────────────────────────────────

type SortOption = 'deadline' | 'votes' | 'margin'

function sortTopics(topics: CountdownTopic[], sort: SortOption): CountdownTopic[] {
  const copy = [...topics]
  if (sort === 'deadline') {
    return copy.sort(
      (a, b) => new Date(a.voting_ends_at).getTime() - new Date(b.voting_ends_at).getTime(),
    )
  }
  if (sort === 'votes') {
    return copy.sort((a, b) => b.total_votes - a.total_votes)
  }
  // margin: closest to 50/50
  return copy.sort((a, b) => {
    const ma = Math.abs(a.blue_pct - 50)
    const mb = Math.abs(b.blue_pct - 50)
    return ma - mb
  })
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CountdownClient() {
  const [data, setData] = useState<CountdownResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortOption>('deadline')
  const [sortOpen, setSortOpen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/countdown', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as CountdownResponse
      setData(json)
      setLastRefresh(new Date())
    } catch {
      setError(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    pollingRef.current = setInterval(() => load(true), 60_000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [load])

  const SORT_LABELS: Record<SortOption, string> = {
    deadline: 'Closing soonest',
    votes: 'Most voted',
    margin: 'Most contested',
  }

  const displayed = data
    ? sortTopics(filterTopics(data.topics, filter), sort)
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30">
              <Timer className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white tracking-tight">
                Civic Countdown
              </h1>
              <p className="text-xs text-surface-500">
                Active votes by time remaining — act before the window closes
              </p>
            </div>
            <button
              onClick={() => load()}
              disabled={loading}
              aria-label="Refresh"
              className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
          {lastRefresh && (
            <p className="text-[11px] font-mono text-surface-600 mt-1 pl-[52px]">
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}auto-refreshes every minute
            </p>
          )}
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        {!loading && data && <StatsStrip stats={data.stats} />}
        {loading && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[62px] rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Filter tabs ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 bg-surface-200 rounded-xl mb-4 overflow-x-auto scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors',
                filter === tab.key
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700',
              )}
            >
              {tab.label}
              {data && tab.key !== 'all' && tab.key !== 'unvoted' && (
                <span className="ml-1 opacity-60">
                  {tab.key === 'critical' && data.stats.critical > 0 && `(${data.stats.critical})`}
                  {tab.key === 'urgent' && data.stats.urgent > 0 && `(${data.stats.urgent})`}
                  {tab.key === 'active' && data.stats.active > 0 && `(${data.stats.active})`}
                  {tab.key === 'extended' && data.stats.extended > 0 && `(${data.stats.extended})`}
                </span>
              )}
              {data && tab.key === 'unvoted' && (
                <span className="ml-1 opacity-60">
                  {(() => {
                    const cnt = data.topics.filter((t) => t.user_vote === null).length
                    return cnt > 0 ? `(${cnt})` : ''
                  })()}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sort picker ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-surface-500">
            {loading ? (
              'Loading…'
            ) : (
              <>{displayed.length} topic{displayed.length !== 1 ? 's' : ''}</>
            )}
          </p>
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              {SORT_LABELS[sort]}
              {sortOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <AnimatePresence>
              {sortOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSortOpen(false)}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 z-20 w-44 bg-surface-100 border border-surface-300 rounded-xl shadow-xl py-1"
                  >
                    {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setSort(key); setSortOpen(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                          sort === key ? 'text-white bg-surface-200' : 'text-surface-500 hover:text-white hover:bg-surface-200',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-surface-500 text-sm">Failed to load countdown data.</p>
            <button
              onClick={() => load()}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Loading skeletons ────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {displayed.length === 0 ? (
              <EmptyState
                icon={Gavel}
                title="No active votes"
                description={
                  filter === 'all'
                    ? 'There are no topics in the voting phase right now. Check back soon.'
                    : 'No topics match this filter.'
                }
                action={
                  filter !== 'all'
                    ? { label: 'Show all', onClick: () => setFilter('all') }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {displayed.map((topic) => (
                    <CountdownCard key={topic.id} topic={topic} />
                  ))}
                </AnimatePresence>

                {/* Bottom note */}
                <div className="pt-4 text-center">
                  <p className="text-xs font-mono text-surface-600">
                    Showing {displayed.length} active vote{displayed.length !== 1 ? 's' : ''}
                    {' · '}
                    <Link href="/topics" className="text-for-400 hover:text-for-300 transition-colors">
                      Browse all topics →
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
