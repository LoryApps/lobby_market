'use client'

/**
 * /swing — The Civic Swing
 *
 * Topics where the most recent votes (last 6 hours) are going in the
 * OPPOSITE direction to the overall established consensus. These debates
 * are mid-reversal — public sentiment is actively changing.
 *
 * Swing Delta = recent_blue_pct - overall_blue_pct
 *   Negative delta: recent voters are more AGAINST than the overall
 *   Positive delta: recent voters are more FOR than the overall
 *
 * Minimum thresholds:
 *   - 5 recent votes (last 6h)
 *   - 15 broader votes (last 48h)
 *   - |delta| ≥ 8 percentage points
 *
 * Distinct from:
 *   /flux       — 24h vs prior-24h comparison window
 *   /momentum   — raw vote velocity (direction-agnostic)
 *   /battleground — near 50/50 overall consensus
 *   /pivot      — long-run historical divergence
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCcw,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SwingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  _swing_score: number
  _swing_recent_pct: number
  _swing_broad_pct: number
  _swing_delta: number
  _swing_direction: 'against_consensus' | 'for_consensus'
  _swing_votes: number
}

interface SwingResponse {
  topics: SwingTopic[]
  hasMore: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold border-gold/40 bg-gold/10',
  Politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  Technology:  'text-purple border-purple/40 bg-purple/10',
  Science:     'text-emerald border-emerald/40 bg-emerald/10',
  Ethics:      'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Philosophy:  'text-sky-400 border-sky-500/40 bg-sky-500/10',
  Culture:     'text-pink-400 border-pink-500/40 bg-pink-500/10',
  Health:      'text-rose-400 border-rose-500/40 bg-rose-500/10',
  Environment: 'text-lime-400 border-lime-500/40 bg-lime-500/10',
  Education:   'text-orange-400 border-orange-500/40 bg-orange-500/10',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
}

function swingLabel(delta: number): { label: string; color: string; intensity: number } {
  const abs = Math.abs(delta)
  if (abs >= 40) return { label: 'Full reversal', color: 'text-against-300', intensity: 5 }
  if (abs >= 25) return { label: 'Strong swing',  color: 'text-gold',         intensity: 4 }
  if (abs >= 16) return { label: 'Notable shift', color: 'text-purple',       intensity: 3 }
  if (abs >= 10) return { label: 'Early swing',   color: 'text-for-300',      intensity: 2 }
  return                 { label: 'Subtle drift',  color: 'text-surface-500',  intensity: 1 }
}

// ─── Mini vote bar showing overall vs recent ──────────────────────────────────

function DualVoteBar({ overall, recent }: { overall: number; recent: number }) {
  const overallFor  = Math.round(overall)
  const recentFor   = Math.round(recent)
  return (
    <div className="space-y-2">
      {/* Overall consensus bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] font-mono text-surface-600">
          <span>Overall consensus</span>
          <span className={overallFor >= 50 ? 'text-for-400' : 'text-against-400'}>
            {overallFor}% FOR
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
          <div
            className="h-full bg-gradient-to-r from-for-700 to-for-500"
            style={{ width: `${overallFor}%` }}
            aria-hidden="true"
          />
          <div
            className="h-full bg-against-600"
            style={{ width: `${100 - overallFor}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
      {/* Recent votes bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] font-mono text-surface-600">
          <span>Last 6 hours</span>
          <span className={recentFor >= 50 ? 'text-for-400' : 'text-against-400'}>
            {recentFor}% FOR
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
          <div
            className="h-full bg-gradient-to-r from-for-700 to-for-500"
            style={{ width: `${recentFor}%` }}
            aria-hidden="true"
          />
          <div
            className="h-full bg-against-600"
            style={{ width: `${100 - recentFor}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Individual topic card ─────────────────────────────────────────────────────

function SwingCard({ topic, rank }: { topic: SwingTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const catStyle = topic.category
    ? (CATEGORY_COLORS[topic.category] ?? 'text-surface-500 border-surface-400 bg-surface-300/40')
    : ''
  const { label, color, intensity } = swingLabel(topic._swing_delta)
  const isAgainst = topic._swing_direction === 'against_consensus'
  const absDelta  = Math.abs(topic._swing_delta)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.045 }}
    >
      <div className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden">
        {/* Main row */}
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3 md:gap-4">
            {/* Rank badge */}
            <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono font-bold text-surface-500 mt-0.5">
              {rank + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex items-center flex-wrap gap-1.5 mb-2">
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px]">
                  {topic.status === 'voting' ? 'VOTING' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                </Badge>

                {topic.category && (
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
                      catStyle
                    )}
                  >
                    {topic.category}
                  </span>
                )}

                {/* Swing direction badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
                    isAgainst
                      ? 'text-against-300 border-against-500/40 bg-against-600/10'
                      : 'text-for-300 border-for-500/40 bg-for-600/10'
                  )}
                  aria-label={`Swing direction: ${isAgainst ? 'shifting against' : 'shifting for'}`}
                >
                  {isAgainst
                    ? <><ArrowDown className="h-2.5 w-2.5" aria-hidden="true" /> Swing AGAINST</>
                    : <><ArrowUp className="h-2.5 w-2.5" aria-hidden="true" /> Swing FOR</>
                  }
                </span>
              </div>

              {/* Statement */}
              <Link
                href={`/topic/${topic.id}`}
                className="block text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors leading-snug mb-3"
              >
                {topic.statement}
              </Link>

              {/* Metric row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Swing label */}
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    intensity >= 4 ? 'bg-against-400 animate-pulse' :
                    intensity >= 3 ? 'bg-gold' :
                    intensity >= 2 ? 'bg-purple' :
                    'bg-surface-500'
                  )} aria-hidden="true" />
                  <span className={cn('text-xs font-mono font-semibold', color)}>{label}</span>
                </div>

                {/* Vote counts */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-surface-600">
                  <span>
                    <strong className="text-white">{topic._swing_votes}</strong> recent votes
                  </span>
                  <span className="text-surface-700">·</span>
                  <span>{topic.total_votes.toLocaleString()} total</span>
                </div>
              </div>
            </div>

            {/* Swing delta badge — right side */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <div
                className={cn(
                  'px-2 py-1 rounded-xl border text-center min-w-[52px]',
                  isAgainst
                    ? 'bg-against-600/10 border-against-500/30'
                    : 'bg-for-600/10 border-for-500/30'
                )}
                aria-label={`Swing delta: ${absDelta} percentage points ${isAgainst ? 'toward AGAINST' : 'toward FOR'}`}
              >
                <div className={cn(
                  'text-lg font-mono font-black leading-none tabular-nums',
                  isAgainst ? 'text-against-300' : 'text-for-300'
                )}>
                  {isAgainst ? '−' : '+'}{absDelta}
                </div>
                <div className="text-[9px] font-mono text-surface-600 mt-0.5 uppercase tracking-wider">
                  pts swing
                </div>
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide details' : 'Show details'}
                className="p-1 rounded-md text-surface-600 hover:text-white hover:bg-surface-200 transition-colors"
              >
                {expanded
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Expanded detail panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 md:px-5 pb-4 border-t border-surface-300 pt-4 space-y-3">
                {/* Dual vote bar comparison */}
                <DualVoteBar overall={topic._swing_broad_pct} recent={topic._swing_recent_pct} />

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-surface-200/60 border border-surface-300">
                    <div className="text-base font-mono font-bold text-surface-400 tabular-nums">
                      {topic._swing_broad_pct}%
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">48h FOR</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface-200/60 border border-surface-300">
                    <div className={cn(
                      'text-base font-mono font-bold tabular-nums',
                      topic._swing_recent_pct >= 50 ? 'text-for-300' : 'text-against-400'
                    )}>
                      {topic._swing_recent_pct}%
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">6h FOR</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface-200/60 border border-surface-300">
                    <div className={cn(
                      'text-base font-mono font-bold tabular-nums',
                      isAgainst ? 'text-against-300' : 'text-for-300'
                    )}>
                      {isAgainst ? '−' : '+'}{absDelta}pp
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">swing</div>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/topic/${topic.id}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg border transition-colors group',
                    isAgainst
                      ? 'bg-against-600/10 border-against-500/30 hover:bg-against-600/20'
                      : 'bg-for-600/10 border-for-500/30 hover:bg-for-600/20'
                  )}
                  aria-label={`View topic: ${topic.statement}`}
                >
                  <span className={cn(
                    'text-xs font-mono',
                    isAgainst ? 'text-against-300' : 'text-for-300'
                  )}>
                    See the debate
                  </span>
                  <ArrowRight
                    className={cn(
                      'h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform',
                      isAgainst ? 'text-against-400' : 'text-for-400'
                    )}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SwingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-5">
          <div className="flex items-start gap-3 md:gap-4">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex items-center gap-3 mt-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SwingClient() {
  const [topics, setTopics] = useState<SwingTopic[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [sortBy, setSortBy]     = useState<'magnitude' | 'votes'>('magnitude')
  const [dirFilter, setDirFilter] = useState<'all' | 'against' | 'for'>('all')

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feed/swing?limit=50&offset=0', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load swing data')
      const json = (await res.json()) as SwingResponse
      setTopics(json.topics)
    } catch {
      setError('Could not load swing data. Try again in a moment.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Client-side filter + sort
  const filtered = topics
    .filter((t) => {
      if (dirFilter === 'against') return t._swing_direction === 'against_consensus'
      if (dirFilter === 'for')     return t._swing_direction === 'for_consensus'
      return true
    })
    .sort((a, b) =>
      sortBy === 'magnitude'
        ? b._swing_score - a._swing_score
        : b._swing_votes - a._swing_votes
    )

  const againstCount = topics.filter((t) => t._swing_direction === 'against_consensus').length
  const forCount     = topics.filter((t) => t._swing_direction === 'for_consensus').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12" id="main-content">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-purple/10 border border-purple/30">
              <RefreshCcw className="h-4 w-4 text-purple" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-bold text-white">The Civic Swing</h1>
                {refreshing && (
                  <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin" aria-label="Refreshing" />
                )}
              </div>
              <p className="text-[11px] font-mono text-surface-600">
                Topics where recent votes reverse the established consensus
              </p>
            </div>
          </div>

          {/* Info strip */}
          <div className="rounded-xl bg-purple/5 border border-purple/20 px-4 py-3 mb-4">
            <p className="text-xs font-mono text-surface-600 leading-relaxed">
              A <span className="text-purple font-semibold">swing</span> means the last 6 hours of voting disagree with the overall consensus.{' '}
              A <span className="text-against-300 font-semibold">−15pp swing</span> on a 70% FOR topic means recent voters are only 55% FOR — opinion is shifting.
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Direction filter */}
            <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-lg p-0.5">
              {([
                { id: 'all',     label: 'All',           count: topics.length },
                { id: 'against', label: 'Swing AGAINST', count: againstCount },
                { id: 'for',     label: 'Swing FOR',     count: forCount },
              ] as const).map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setDirFilter(id)}
                  aria-pressed={dirFilter === id}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors',
                    dirFilter === id
                      ? id === 'against'
                        ? 'bg-against-600/80 text-white'
                        : id === 'for'
                          ? 'bg-for-600/80 text-white'
                          : 'bg-purple/80 text-white'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      'ml-0.5 text-[9px] font-mono opacity-70',
                      dirFilter === id ? 'text-white' : 'text-surface-600'
                    )}>
                      ({count})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-lg p-0.5">
              <button
                onClick={() => setSortBy('magnitude')}
                aria-pressed={sortBy === 'magnitude'}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors',
                  sortBy === 'magnitude' ? 'bg-surface-300/80 text-white' : 'text-surface-500 hover:text-white'
                )}
              >
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
                Magnitude
              </button>
              <button
                onClick={() => setSortBy('votes')}
                aria-pressed={sortBy === 'votes'}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors',
                  sortBy === 'votes' ? 'bg-surface-300/80 text-white' : 'text-surface-500 hover:text-white'
                )}
              >
                <Zap className="h-3 w-3" aria-hidden="true" />
                Recent votes
              </button>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh swing data"
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 border border-surface-300 bg-surface-200 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading ? (
          <SwingSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-8 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RefreshCcw}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title={topics.length > 0 ? 'No topics match this filter' : 'No swings detected right now'}
            description={
              topics.length > 0
                ? 'Try switching to All directions to see all swing topics.'
                : 'No civic debates are showing vote reversals in the last 6 hours. Check back — swings appear quickly when sentiment shifts.'
            }
            actions={[
              { label: 'View Flux',      href: '/flux',       icon: TrendingDown, variant: 'primary'   },
              { label: 'Battleground',   href: '/battleground', icon: Scale,      variant: 'secondary' },
            ]}
            size="md"
          />
        ) : (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-surface-600">
                <span className="text-white font-semibold">{filtered.length}</span>{' '}
                topic{filtered.length !== 1 ? 's' : ''} in active swing
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono text-surface-700">
                {againstCount > 0 && (
                  <span className="flex items-center gap-0.5 text-against-400">
                    <ArrowDown className="h-2.5 w-2.5" aria-hidden="true" />
                    {againstCount} vs consensus
                  </span>
                )}
                {forCount > 0 && (
                  <span className="flex items-center gap-0.5 text-for-400">
                    <ArrowUp className="h-2.5 w-2.5" aria-hidden="true" />
                    {forCount} with consensus
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3" role="list" aria-label="Topics in active swing">
              {filtered.map((topic, i) => (
                <div key={topic.id} role="listitem">
                  <SwingCard topic={topic} rank={i} />
                </div>
              ))}
            </div>

            {/* Related links */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { href: '/flux',          label: 'In Flux',        desc: '24h vs prior-24h shifts',   icon: TrendingDown },
                { href: '/battleground',  label: 'Battleground',   desc: 'Near 50/50 deadlocks',       icon: Scale },
                { href: '/pivot',         label: 'Civic Pivot',    desc: 'Long-run reversals',         icon: TrendingUp },
              ].map(({ href, label, desc, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors group"
                >
                  <div className="flex-shrink-0 p-1.5 rounded-lg bg-surface-200 border border-surface-300 group-hover:border-surface-400 transition-colors mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">{label}</p>
                    <p className="text-[11px] font-mono text-surface-600">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
