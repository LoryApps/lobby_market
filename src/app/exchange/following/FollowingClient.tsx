'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Clock,
  ExternalLink,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  FollowingPosition,
  FollowingTrader,
  FollowingResponse,
  FollowingAggregate,
} from '@/app/api/exchange/following/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function priceColor(pct: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (pct >= 67) return 'text-gold'
  if (pct >= 55) return 'text-for-400'
  if (pct <= 33) return 'text-against-400'
  if (pct <= 45) return 'text-against-300'
  return 'text-surface-400'
}

const GRADE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-gold/15',        text: 'text-gold',        border: 'border-gold/40' },
  A: { bg: 'bg-for-500/15',     text: 'text-for-400',     border: 'border-for-500/40' },
  B: { bg: 'bg-emerald/15',     text: 'text-emerald',     border: 'border-emerald/40' },
  C: { bg: 'bg-surface-300/60', text: 'text-surface-400', border: 'border-surface-400/40' },
  D: { bg: 'bg-against-500/15', text: 'text-against-400', border: 'border-against-500/40' },
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const CATEGORY_STYLE: Record<string, { text: string; border: string; bg: string }> = {
  Economics:   { text: 'text-gold',         border: 'border-gold/30',         bg: 'bg-gold/10' },
  Politics:    { text: 'text-for-400',      border: 'border-for-500/30',      bg: 'bg-for-500/10' },
  Technology:  { text: 'text-purple',       border: 'border-purple/30',       bg: 'bg-purple/10' },
  Science:     { text: 'text-emerald',      border: 'border-emerald/30',      bg: 'bg-emerald/10' },
  Ethics:      { text: 'text-against-400',  border: 'border-against-500/30',  bg: 'bg-against-500/10' },
  Philosophy:  { text: 'text-purple',       border: 'border-purple/30',       bg: 'bg-purple/10' },
  Culture:     { text: 'text-gold',         border: 'border-gold/30',         bg: 'bg-gold/10' },
  Health:      { text: 'text-emerald',      border: 'border-emerald/30',      bg: 'bg-emerald/10' },
  Environment: { text: 'text-emerald',      border: 'border-emerald/30',      bg: 'bg-emerald/10' },
  Education:   { text: 'text-for-400',      border: 'border-for-500/30',      bg: 'bg-for-500/10' },
}

function catStyle(cat: string | null) {
  if (!cat) return { text: 'text-surface-500', border: 'border-surface-500/30', bg: 'bg-surface-500/10' }
  return CATEGORY_STYLE[cat] ?? { text: 'text-surface-500', border: 'border-surface-500/30', bg: 'bg-surface-500/10' }
}

// ─── Position Card ────────────────────────────────────────────────────────────

function PositionCard({ pos }: { pos: FollowingPosition }) {
  const isFor = pos.side === 'blue'
  const cs = catStyle(pos.category)
  const grade = pos.trader.accuracy_grade
  const gradeCfg = grade ? GRADE_CONFIG[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface-100 hover:bg-surface-150 transition-colors group',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Trader row */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <Link href={`/profile/${pos.trader.username}`} className="flex-shrink-0">
          <Avatar
            src={pos.trader.avatar_url}
            fallback={pos.trader.display_name || pos.trader.username}
            size="sm"
            className="ring-1 ring-surface-400/30"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${pos.trader.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {pos.trader.display_name || pos.trader.username}
            </Link>
            {gradeCfg && grade && (
              <span
                className={cn(
                  'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border',
                  gradeCfg.bg, gradeCfg.text, gradeCfg.border
                )}
              >
                {grade}
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 font-mono">
            @{pos.trader.username} · {relTime(pos.voted_at)}
          </p>
        </div>
        {/* Stance pill */}
        <span
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border',
            isFor
              ? 'bg-for-500/15 text-for-400 border-for-500/30'
              : 'bg-against-500/15 text-against-400 border-against-500/30'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3 w-3" />
          ) : (
            <ThumbsDown className="h-3 w-3" />
          )}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
      </div>

      {/* Topic link */}
      <Link href={`/topic/${pos.topic_id}`} className="block px-3 pb-2 group/topic">
        <p className="text-sm text-white/90 leading-snug group-hover/topic:text-white line-clamp-2 mb-2">
          {pos.statement}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {pos.category && (
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                cs.text, cs.border, cs.bg
              )}
            >
              {pos.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {STATUS_LABEL[pos.status] ?? pos.status}
          </span>
        </div>
      </Link>

      {/* Vote bar */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-mono font-bold', priceColor(pos.blue_pct, pos.status))}>
            {Math.round(pos.blue_pct)}%
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pos.status === 'law'
                  ? 'bg-gold'
                  : pos.status === 'failed'
                  ? 'bg-against-500'
                  : 'bg-for-500'
              )}
              style={{ width: `${Math.round(pos.blue_pct)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-surface-500">
            {pos.total_votes.toLocaleString()}v
          </span>
          <Link
            href={`/topic/${pos.topic_id}`}
            className="flex-shrink-0 p-1 rounded text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Open topic"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Trader Card ──────────────────────────────────────────────────────────────

function TraderCard({ trader }: { trader: FollowingTrader }) {
  const grade = trader.accuracy_grade
  const gradeCfg = grade ? GRADE_CONFIG[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <Link href={`/profile/${trader.username}`} className="flex-shrink-0">
        <Avatar
          src={trader.avatar_url}
          fallback={trader.display_name || trader.username}
          size="sm"
          className="ring-1 ring-surface-400/30"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/profile/${trader.username}`}
            className="text-xs font-semibold text-white truncate hover:text-for-300 transition-colors"
          >
            {trader.display_name || trader.username}
          </Link>
          {gradeCfg && grade && (
            <span
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border',
                gradeCfg.bg, gradeCfg.text, gradeCfg.border
              )}
            >
              {grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] font-mono text-surface-500">
            {trader.position_count} position{trader.position_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[11px] font-mono text-for-400">{trader.for_count} FOR</span>
          <span className="text-[11px] font-mono text-against-400">{trader.against_count} AGAINST</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {trader.win_rate !== null ? (
          <p className={cn(
            'text-sm font-mono font-bold',
            trader.win_rate >= 70 ? 'text-gold' : trader.win_rate >= 55 ? 'text-for-400' : 'text-surface-400'
          )}>
            {trader.win_rate}%
          </p>
        ) : (
          <p className="text-xs font-mono text-surface-500">New</p>
        )}
        <p className="text-[10px] font-mono text-surface-600">win rate</p>
      </div>
    </motion.div>
  )
}

// ─── Consensus Card ───────────────────────────────────────────────────────────

function ConsensusCard({
  topic,
}: {
  topic: FollowingAggregate['consensus_topics'][number]
}) {
  const total = topic.for_trader_count + topic.against_trader_count
  const forPct = total > 0 ? Math.round((topic.for_trader_count / total) * 100) : 50
  const unanimous = forPct >= 80 || forPct <= 20
  const cs = catStyle(topic.category)

  return (
    <Link
      href={`/topic/${topic.topic_id}`}
      className={cn(
        'block p-3 rounded-xl border bg-surface-100 hover:bg-surface-150 transition-colors',
        unanimous
          ? forPct >= 50 ? 'border-for-500/30 hover:border-for-500/50' : 'border-against-500/30 hover:border-against-500/50'
          : 'border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        {topic.category && (
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5', cs.text, cs.border, cs.bg)}>
            {topic.category}
          </span>
        )}
        {unanimous && (
          <span className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5',
            forPct >= 50
              ? 'text-for-400 border-for-500/30 bg-for-500/10'
              : 'text-against-400 border-against-500/30 bg-against-500/10'
          )}>
            {forPct >= 50 ? 'All FOR' : 'All AGAINST'}
          </span>
        )}
      </div>
      <p className="text-xs text-white/90 leading-snug line-clamp-2 mb-2">{topic.statement}</p>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-for-400">{topic.for_trader_count} FOR</span>
        <div className="flex-1 h-1 rounded-full bg-against-500/20 overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full transition-all"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <span className="text-[11px] font-mono text-against-400">{topic.against_trader_count} AGAINST</span>
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-100 p-3 space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-20 rounded" />
            </div>
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'feed' | 'traders' | 'consensus'

const TABS: { id: Tab; label: string; icon: typeof Clock }[] = [
  { id: 'feed', label: 'Latest', icon: Clock },
  { id: 'traders', label: 'Traders', icon: Users },
  { id: 'consensus', label: 'Consensus', icon: Scale },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function FollowingClient() {
  const [data, setData] = useState<FollowingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('feed')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/following')
      if (res.status === 401) {
        setError('You must be logged in to view this page.')
        return
      }
      if (!res.ok) throw new Error('Failed to load data')
      const json = (await res.json()) as FollowingResponse
      setData(json)
    } catch {
      setError('Could not load following feed. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const agg = data?.aggregate

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono">Following Feed</h1>
            <p className="text-sm text-surface-500 font-mono">Market positions from traders you follow</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300 border border-surface-400/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <EmptyState
            icon={Users}
            title="Could not load"
            description={error}
            action={<button onClick={() => load()} className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors">Try again</button>}
          />
        ) : !data?.is_following_anyone ? (
          <EmptyState
            icon={UserPlus}
            title="Not following anyone yet"
            description="Follow other traders to see their market positions here. Find top performers in the Exchange leaderboard."
            action={
              <Link href="/exchange/leaderboard" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors">
                <Trophy className="h-4 w-4" />
                Find top traders
              </Link>
            }
          />
        ) : data.positions.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="No open positions"
            description="The traders you follow haven't placed any active predictions yet. Check back soon."
          />
        ) : (
          <>
            {/* Aggregate stats */}
            {agg && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Traders', value: agg.total_traders, icon: Users, color: 'text-purple' },
                  { label: 'Positions', value: agg.total_positions, icon: BarChart2, color: 'text-for-400' },
                  { label: 'FOR', value: agg.for_count, icon: ThumbsUp, color: 'text-for-400' },
                  { label: 'AGAINST', value: agg.against_count, icon: ThumbsDown, color: 'text-against-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-surface-100 border border-surface-300/60 rounded-xl p-3 text-center">
                    <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                    <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
                    <p className="text-[11px] font-mono text-surface-500">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-surface-200 p-1 rounded-xl">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                    tab === id
                      ? 'bg-surface-100 text-white shadow-sm'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'feed' && (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {data.positions.map((pos) => (
                    <PositionCard key={pos.vote_id} pos={pos} />
                  ))}
                  {data.positions.length >= 40 && (
                    <p className="text-center text-xs font-mono text-surface-500 py-4">
                      Showing latest 120 positions
                    </p>
                  )}
                </motion.div>
              )}

              {tab === 'traders' && (
                <motion.div
                  key="traders"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {data.traders.length === 0 ? (
                    <EmptyState icon={Users} title="No trader data" description="No positions found from traders you follow." />
                  ) : (
                    data.traders.map((trader) => (
                      <TraderCard key={trader.id} trader={trader} />
                    ))
                  )}
                </motion.div>
              )}

              {tab === 'consensus' && (
                <motion.div
                  key="consensus"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="text-xs font-mono text-surface-500 mb-3">
                    Topics where the most traders you follow have taken a position
                  </p>
                  {data.aggregate.consensus_topics.length === 0 ? (
                    <EmptyState icon={Scale} title="No consensus yet" description="Not enough positions from your followed traders to identify consensus." />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {data.aggregate.consensus_topics.map((t) => (
                        <ConsensusCard key={t.topic_id} topic={t} />
                      ))}
                    </div>
                  )}

                  {/* Overall lean */}
                  {agg && agg.total_positions > 0 && (
                    <div className="mt-6 p-4 rounded-xl bg-surface-100 border border-surface-300/60">
                      <p className="text-xs font-mono text-surface-500 mb-3">Network-wide stance distribution</p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-bold text-for-400 w-16 text-right">
                          {agg.for_count} FOR
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-against-500/20 overflow-hidden">
                          <div
                            className="h-full bg-for-500 rounded-full"
                            style={{
                              width: `${Math.round((agg.for_count / agg.total_positions) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-mono font-bold text-against-400 w-20">
                          {agg.against_count} AGAINST
                        </span>
                      </div>
                      {agg.top_category && (
                        <p className="text-[11px] font-mono text-surface-500 mt-2">
                          Most active category: <span className="text-white">{agg.top_category}</span>
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
