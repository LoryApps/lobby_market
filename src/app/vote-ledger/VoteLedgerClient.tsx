'use client'

/**
 * /vote-ledger — Public Voting Transparency Ledger
 *
 * A real-time feed of every vote cast on Lobby Market, filterable by
 * side (blue / red / all) and time period. Surfaces platform-wide voting
 * stats at the top and a paginated entry list below — think of it as the
 * public audit trail of democratic expression.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  BookOpen,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  VoteLedgerEntry,
  VoteLedgerResponse,
  VoteLedgerStats,
  VotePeriodFilter,
  VoteSideFilter,
} from '@/app/api/vote-ledger/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SIDE_TABS: { key: VoteSideFilter; label: string }[] = [
  { key: 'all', label: 'All Votes' },
  { key: 'blue', label: 'For' },
  { key: 'red', label: 'Against' },
]

const PERIOD_TABS: { key: VotePeriodFilter; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All time' },
]

function StatsBar({ stats, loading }: { stats: VoteLedgerStats | null; loading: boolean }) {
  const items = [
    {
      label: 'Total votes',
      value: stats ? fmt(stats.total_votes) : '—',
      icon: <Activity className="w-4 h-4 text-purple" />,
    },
    {
      label: 'Unique voters',
      value: stats ? fmt(stats.unique_voters) : '—',
      icon: <Users className="w-4 h-4 text-gold" />,
    },
    {
      label: 'Topics voted on',
      value: stats ? fmt(stats.unique_topics) : '—',
      icon: <BookOpen className="w-4 h-4 text-emerald" />,
    },
    {
      label: 'Consensus tilt',
      value: stats
        ? stats.blue_pct >= stats.red_pct
          ? `${stats.blue_pct}% For`
          : `${stats.red_pct}% Against`
        : '—',
      icon:
        stats && stats.blue_pct >= stats.red_pct ? (
          <TrendingUp className="w-4 h-4 text-for-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-against-400" />
        ),
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            {item.icon}
            <span className="text-xs text-surface-400 font-medium">{item.label}</span>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-16 rounded" />
          ) : (
            <span className="text-xl font-bold text-white tracking-tight">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function ConsensusBar({ stats }: { stats: VoteLedgerStats }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-for-400 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          For {stats.blue_pct}%
        </span>
        <span className="text-xs text-surface-500 font-medium flex items-center gap-1">
          <Scale className="w-3.5 h-3.5" />
          Consensus split
        </span>
        <span className="text-xs font-semibold text-against-400 flex items-center gap-1">
          {stats.red_pct}% Against
          <TrendingDown className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-surface-700">
        <motion.div
          className="bg-for-500 h-full rounded-l-full"
          initial={{ width: '50%' }}
          animate={{ width: `${stats.blue_pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500 h-full rounded-r-full"
          initial={{ width: '50%' }}
          animate={{ width: `${stats.red_pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function VoteRow({ entry, index }: { entry: VoteLedgerEntry; index: number }) {
  const isBlue = entry.side === 'blue'
  const voter = entry.voter
  const topic = entry.topic

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
      className="flex items-start gap-3 px-4 py-3.5 border-b border-surface-800 last:border-0 hover:bg-surface-800/50 transition-colors"
    >
      {/* Side indicator */}
      <div
        className={cn(
          'flex-shrink-0 w-2 h-2 rounded-full mt-2',
          isBlue ? 'bg-for-500' : 'bg-against-500',
        )}
      />

      {/* Voter avatar */}
      {voter ? (
        <Link href={`/profile/${voter.username}`} className="flex-shrink-0">
          <Avatar
            src={voter.avatar_url}
            fallback={voter.display_name?.[0] ?? voter.username[0]}
            size="sm"
          />
        </Link>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center">
          <span className="text-xs text-surface-500">?</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {voter ? (
            <Link
              href={`/profile/${voter.username}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors"
            >
              {voter.display_name ?? voter.username}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-surface-400">Anonymous</span>
          )}
          <span
            className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
              isBlue
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400',
            )}
          >
            {isBlue ? 'For' : 'Against'}
          </span>
          <span className="text-xs text-surface-500 ml-auto whitespace-nowrap">
            {relativeTime(entry.created_at)}
          </span>
        </div>

        {topic ? (
          <Link
            href={`/topic/${topic.id}`}
            className="group flex items-start gap-1 text-sm text-surface-300 hover:text-white transition-colors"
          >
            <span className="line-clamp-2 leading-snug">{topic.statement}</span>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </Link>
        ) : (
          <span className="text-sm text-surface-500 italic">Topic unavailable</span>
        )}

        {topic && (
          <div className="flex items-center gap-3 mt-1.5">
            {topic.category && (
              <span className="text-[10px] text-surface-500 font-medium">{topic.category}</span>
            )}
            <span className="text-[10px] text-surface-600">
              {fmt(topic.blue_votes)}F · {fmt(topic.red_votes)}A
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function VoteRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-surface-800">
      <div className="w-2 h-2 rounded-full bg-surface-700 mt-2 flex-shrink-0" />
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <Skeleton className="h-3.5 w-full max-w-xs rounded" />
        <Skeleton className="h-3.5 w-2/3 rounded" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoteLedgerClient() {
  const [side, setSide] = useState<VoteSideFilter>('all')
  const [period, setPeriod] = useState<VotePeriodFilter>('7d')
  const [data, setData] = useState<VoteLedgerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)

  const PAGE_SIZE = 50

  const fetchEntries = useCallback(
    async (opts: { reset?: boolean; silent?: boolean } = {}) => {
      if (opts.silent) {
        setRefreshing(true)
      } else if (opts.reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError(null)

      const newOffset = opts.reset ? 0 : offsetRef.current
      const params = new URLSearchParams({
        side,
        period,
        limit: String(PAGE_SIZE),
        offset: String(newOffset),
      })

      try {
        const res = await fetch(`/api/vote-ledger?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: VoteLedgerResponse = await res.json()

        if (opts.reset || opts.silent) {
          setData(json)
          offsetRef.current = PAGE_SIZE
        } else {
          setData((prev) =>
            prev
              ? { ...json, entries: [...prev.entries, ...json.entries] }
              : json,
          )
          offsetRef.current = newOffset + PAGE_SIZE
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load vote ledger')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [side, period],
  )

  useEffect(() => {
    offsetRef.current = 0
    fetchEntries({ reset: true })
  }, [fetchEntries])

  const canLoadMore = data ? offsetRef.current < data.total : false

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
              Vote Ledger
            </h1>
            <p className="text-sm text-surface-400">
              A transparent record of every vote cast on Lobby Market.
            </p>
          </div>
          <button
            onClick={() => fetchEntries({ silent: true })}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-surface-300 hover:text-white hover:border-surface-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Stats */}
        <StatsBar stats={data?.stats ?? null} loading={loading} />

        {/* Consensus bar */}
        {data?.stats && !loading && (
          <ConsensusBar stats={data.stats} />
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Side filter */}
          <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1 border border-surface-700">
            <Filter className="w-3.5 h-3.5 text-surface-500 ml-1.5" />
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSide(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  side === tab.key
                    ? tab.key === 'blue'
                      ? 'bg-for-500/20 text-for-400'
                      : tab.key === 'red'
                      ? 'bg-against-500/20 text-against-400'
                      : 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:text-surface-200',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1 border border-surface-700 ml-auto">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriod(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  period === tab.key
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:text-surface-200',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Total count */}
        {!loading && data && (
          <p className="text-xs text-surface-500 mb-3">
            {fmt(data.total)} vote{data.total !== 1 ? 's' : ''} in this view
          </p>
        )}

        {/* Entry list */}
        <div className="bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
          <AnimatePresence mode="wait">
            {loading ? (
              <div key="skeleton">
                {Array.from({ length: 8 }).map((_, i) => (
                  <VoteRowSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div key="error" className="p-8">
                <EmptyState
                  icon={AlertCircle}
                  iconColor="text-against-400"
                  title="Could not load the ledger"
                  description={error}
                  action={{ label: 'Try again', onClick: () => fetchEntries({ reset: true }) }}
                />
              </div>
            ) : !data || data.entries.length === 0 ? (
              <div key="empty" className="p-8">
                <EmptyState
                  icon={Scale}
                  title="No votes found"
                  description="No votes match the selected filters for this period."
                />
              </div>
            ) : (
              <div key="list">
                {data.entries.map((entry, i) => (
                  <VoteRow key={entry.id} entry={entry} index={i} />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Load more */}
          {canLoadMore && (
            <div className="border-t border-surface-800 p-4 flex justify-center">
              <button
                onClick={() => fetchEntries()}
                disabled={loadingMore}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-sm font-semibold text-surface-300 hover:text-white hover:border-surface-600 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>Load more votes</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-surface-600 mt-6">
          All votes are public by design — democratic accountability requires transparency.
          {' '}
          <Link href="/settings/privacy" className="underline hover:text-surface-400 transition-colors">
            Privacy settings
          </Link>
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
