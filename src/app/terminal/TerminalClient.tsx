'use client'

/**
 * /terminal — The Consensus Terminal
 *
 * A Bloomberg-style live market data view of every active civic debate.
 * Shows consensus percentage, vote volume, momentum, and contention level
 * across all "live" topics — the Lobby as a real-time market.
 *
 * Distinct from:
 *   /tally    — election-night view, voting-phase topics only
 *   /dashboard — personalised command centre
 *   /live     — argument stream
 *   /now      — recent activity feed
 *
 * This is a market terminal: all active debates, ranked by any column,
 * with live 30-second refresh and signal indicators.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  ChevronRight,
  Clock,
  Gavel,
  Minus,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TerminalTopic, TerminalResponse } from '@/app/api/terminal/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const MOMENTUM_CONFIG: Record<TerminalTopic['momentum'], {
  icon: typeof TrendingUp
  label: string
  color: string
}> = {
  surging: { icon: TrendingUp,   label: 'SURGING',  color: 'text-emerald' },
  rising:  { icon: ArrowUp,      label: 'RISING',   color: 'text-for-400' },
  stable:  { icon: Minus,        label: 'STABLE',   color: 'text-surface-500' },
  falling: { icon: ArrowDown,    label: 'FALLING',  color: 'text-against-400' },
  cooling: { icon: TrendingDown, label: 'COOLING',  color: 'text-surface-600' },
}

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type SortKey = 'feed_score' | 'blue_pct' | 'total_votes' | 'vote_velocity' | 'argument_count_24h' | 'spread'
type SortDir = 'asc' | 'desc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d >= 30) return `${Math.floor(d / 30)}mo`
  if (d >= 7)  return `${Math.floor(d / 7)}wk`
  if (d > 0)   return `${d}d`
  return `${h}h`
}

function countdown(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'EXPIRED'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${m}m`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon: typeof BarChart2
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 flex flex-col gap-0.5 min-w-[120px]">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-widest">
        <Icon className="h-3 w-3 flex-shrink-0" />
        {label}
      </div>
      <div className={cn('font-mono text-xl font-bold tabular-nums', color)}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-surface-600">{sub}</div>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TerminalSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex gap-3 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-28 rounded-xl" />
        ))}
      </div>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ─── Consensus pill ───────────────────────────────────────────────────────────

function ConsensusPill({ pct }: { pct: number }) {
  const isFor     = pct >= 60
  const isAgainst = pct <= 40

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <span
        className={cn(
          'font-mono text-sm font-bold tabular-nums w-9 text-right',
          isFor ? 'text-for-400' : isAgainst ? 'text-against-400' : 'text-surface-400',
        )}
      >
        {Math.round(pct)}%
      </span>
      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isFor ? 'bg-for-500' : isAgainst ? 'bg-against-500' : 'bg-surface-500',
          )}
          style={{ width: `${Math.round(pct)}%` }}
        />
      </div>
      <span
        className={cn(
          'font-mono text-sm font-bold tabular-nums w-9',
          isAgainst ? 'text-against-400' : isFor ? 'text-for-400' : 'text-surface-400',
        )}
      >
        {100 - Math.round(pct)}%
      </span>
    </div>
  )
}

// ─── Signal badges ────────────────────────────────────────────────────────────

function SignalBadges({ topic }: { topic: TerminalTopic }) {
  return (
    <div className="flex items-center gap-1">
      {topic.is_approaching_law && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald/10 text-emerald border border-emerald/30 uppercase tracking-wide">
          ↑LAW
        </span>
      )}
      {topic.is_approaching_failure && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-against-500/10 text-against-400 border border-against-500/30 uppercase tracking-wide">
          ↓FAIL
        </span>
      )}
      {topic.is_contested && !topic.is_approaching_law && !topic.is_approaching_failure && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-surface-300/30 text-surface-500 border border-surface-400/30 uppercase tracking-wide">
          SPLIT
        </span>
      )}
      {topic.status === 'voting' && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-gold/10 text-gold border border-gold/30 uppercase tracking-wide">
          VOTE
        </span>
      )}
    </div>
  )
}

// ─── Sort header ─────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = currentKey === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest transition-colors',
        active ? 'text-for-400' : 'text-surface-600 hover:text-surface-400',
        className,
      )}
    >
      {label}
      {active ? (
        currentDir === 'desc' ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />
      ) : (
        <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
      )}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TerminalClient() {
  const [data, setData] = useState<TerminalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('feed_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/terminal', { cache: 'no-store' })
      if (!res.ok) throw new Error('Request failed')
      const json = (await res.json()) as TerminalResponse
      setData(json)
      setLastRefresh(new Date())
    } catch {
      if (!isBackground) setError('Failed to load terminal data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => load(true), REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filteredTopics = (data?.topics ?? []).filter((t) => {
    if (category !== 'All' && t.category !== category) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      if (!t.statement.toLowerCase().includes(q)) return false
    }
    return true
  })

  const sortedTopics = [...filteredTopics].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const stats = data?.stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 pt-4 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Activity className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
                Consensus Terminal
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Live market view of all active debates · refreshes every 30s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:block text-[10px] font-mono text-surface-600">
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-for-500/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────── */}
        {stats && (
          <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
            <StatCard
              label="Active"
              value={stats.total_active}
              icon={Zap}
              color="text-for-400"
            />
            <StatCard
              label="Voting"
              value={stats.total_in_voting}
              icon={Gavel}
              color="text-gold"
            />
            <StatCard
              label="Contested"
              value={stats.contested_count}
              sub="within 10pts of split"
              icon={Scale}
              color="text-against-400"
            />
            <StatCard
              label="→ Law"
              value={stats.approaching_law_count}
              sub="FOR ≥ 60%"
              icon={Gavel}
              color="text-emerald"
            />
            <StatCard
              label="Avg. Consensus"
              value={`${stats.avg_consensus}%`}
              icon={BarChart2}
              color={stats.avg_consensus >= 55 ? 'text-for-400' : stats.avg_consensus <= 45 ? 'text-against-400' : 'text-surface-400'}
            />
          </div>
        )}

        {/* ── Filter row ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search debates…"
              className="w-full h-8 rounded-lg bg-surface-200 border border-surface-300 pl-8 pr-3 font-mono text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-surface-500 hover:text-white" />
              </button>
            )}
          </div>

          {/* Category filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg border font-mono text-xs transition-colors',
              showFilters
                ? 'bg-for-500/15 border-for-500/40 text-for-400'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {category !== 'All' && (
              <span className="ml-0.5 px-1 rounded bg-for-500/20 text-for-300 text-[10px]">
                {category.slice(0, 3)}
              </span>
            )}
          </button>

          <div className="ml-auto text-[10px] font-mono text-surface-600">
            {sortedTopics.length} debate{sortedTopics.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Category pills ──────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 flex-wrap mb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-colors',
                      category === cat
                        ? 'bg-for-500/20 border-for-500/50 text-for-300'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Terminal table ──────────────────────────────────────────── */}
        {loading ? (
          <TerminalSkeleton />
        ) : error ? (
          <EmptyState
            icon={Activity}
            title="Terminal offline"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        ) : sortedTopics.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No active debates"
            description={
              category !== 'All'
                ? `No active ${category} debates right now.`
                : 'No active debates found. Check back soon.'
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-surface-300 overflow-hidden">
              {/* Table header */}
              <div className="bg-surface-100 border-b border-surface-300 grid grid-cols-[1fr_120px_160px_80px_80px_80px_80px_80px] gap-4 px-4 py-2 items-center">
                <SortHeader label="Debate" sortKey="feed_score" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">Category</span>
                <SortHeader label="Consensus" sortKey="blue_pct" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" />
                <SortHeader label="Votes" sortKey="total_votes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                <SortHeader label="V/Day" sortKey="vote_velocity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                <SortHeader label="Args 24h" sortKey="argument_count_24h" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                <SortHeader label="Spread" sortKey="spread" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest text-right">Signal</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-surface-300">
                {sortedTopics.map((topic, i) => {
                  const mom = MOMENTUM_CONFIG[topic.momentum]
                  const MomIcon = mom.icon
                  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

                  return (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    >
                      <Link
                        href={`/topic/${topic.id}`}
                        className="grid grid-cols-[1fr_120px_160px_80px_80px_80px_80px_80px] gap-4 px-4 py-3 items-center hover:bg-surface-100/50 transition-colors group"
                      >
                        {/* Statement */}
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-white group-hover:text-for-300 transition-colors truncate leading-tight">
                            {topic.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <SignalBadges topic={topic} />
                            <span className="text-[10px] font-mono text-surface-600">{fmtTime(topic.created_at)} old</span>
                          </div>
                        </div>

                        {/* Category */}
                        <span className={cn('font-mono text-xs truncate', catColor)}>
                          {topic.category ?? '—'}
                        </span>

                        {/* Consensus bar */}
                        <ConsensusPill pct={topic.blue_pct} />

                        {/* Votes */}
                        <span className="font-mono text-xs text-surface-400 text-right tabular-nums">
                          {fmtNum(topic.total_votes)}
                        </span>

                        {/* Velocity */}
                        <span className="font-mono text-xs text-surface-400 text-right tabular-nums">
                          {fmtNum(topic.vote_velocity)}/d
                        </span>

                        {/* Arguments 24h */}
                        <span className={cn(
                          'font-mono text-xs text-right tabular-nums',
                          topic.argument_count_24h > 0 ? 'text-for-300' : 'text-surface-600',
                        )}>
                          {topic.argument_count_24h > 0 ? `+${topic.argument_count_24h}` : '—'}
                        </span>

                        {/* Spread */}
                        <span className={cn(
                          'font-mono text-xs text-right tabular-nums',
                          topic.spread >= 60 ? 'text-emerald' : topic.spread <= 20 ? 'text-against-400' : 'text-surface-400',
                        )}>
                          {topic.spread}%
                        </span>

                        {/* Momentum signal */}
                        <div className="flex items-center justify-end gap-1">
                          <MomIcon className={cn('h-3.5 w-3.5', mom.color)} />
                          <span className={cn('font-mono text-[10px] hidden lg:inline', mom.color)}>
                            {mom.label}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {sortedTopics.map((topic) => {
                const mom = MOMENTUM_CONFIG[topic.momentum]
                const MomIcon = mom.icon
                const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
                const voting = topic.voting_ends_at && topic.status === 'voting' ? countdown(topic.voting_ends_at) : null

                return (
                  <Link
                    key={topic.id}
                    href={`/topic/${topic.id}`}
                    className="block rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-for-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm text-white leading-snug line-clamp-2">
                          {topic.statement}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={cn('font-mono text-[11px]', catColor)}>
                            {topic.category ?? 'General'}
                          </span>
                          <SignalBadges topic={topic} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <MomIcon className={cn('h-4 w-4', mom.color)} />
                        <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
                      </div>
                    </div>

                    <ConsensusPill pct={topic.blue_pct} />

                    <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-surface-600">
                      <span>{fmtNum(topic.total_votes)} votes</span>
                      {topic.argument_count_24h > 0 && (
                        <span className="text-for-400">+{topic.argument_count_24h} args today</span>
                      )}
                      {voting && (
                        <span className="flex items-center gap-1 text-gold">
                          <Clock className="h-3 w-3" />
                          {voting}
                        </span>
                      )}
                      <span>{fmtTime(topic.created_at)} old</span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between text-[10px] font-mono text-surface-600">
              <span>
                Showing {sortedTopics.length} of {data?.topics.length ?? 0} active debates
              </span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                <span>Live · refreshes every 30s</span>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
