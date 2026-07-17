'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TradersData, TraderEntry, RecentTrade } from '@/app/api/exchange/[id]/traders/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClout(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  elder:         { label: 'Elder',        color: 'text-gold',       icon: Crown },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald',   icon: Shield },
  debator:       { label: 'Debator',      color: 'text-for-400',    icon: Zap },
  person:        { label: 'Citizen',      color: 'text-surface-500', icon: Users },
}

// ─── Trader row ───────────────────────────────────────────────────────────────

function TraderRow({
  trader,
  rank,
  side,
}: {
  trader: TraderEntry
  rank: number
  side: 'for' | 'against'
}) {
  const role = ROLE_CONFIG[trader.role] ?? ROLE_CONFIG.person
  const RoleIcon = role.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'for' ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.2 }}
    >
      <Link
        href={`/profile/${trader.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 transition-colors',
          'hover:bg-surface-200/50 rounded-lg',
          'border border-transparent hover:border-surface-300',
        )}
      >
        {/* Rank */}
        <span
          className={cn(
            'w-6 text-xs font-mono text-center flex-shrink-0',
            rank === 0 ? 'text-gold font-bold' : 'text-surface-500',
          )}
          aria-label={`Rank ${rank + 1}`}
        >
          {rank + 1}
        </span>

        {/* Avatar */}
        <Avatar
          src={trader.avatar_url}
          alt={trader.display_name ?? trader.username}
          size={32}
          className={cn(
            'flex-shrink-0 ring-2',
            side === 'for' ? 'ring-for-500/30' : 'ring-against-500/30',
          )}
        />

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-surface-800 truncate">
              {trader.display_name ?? trader.username}
            </span>
            {trader.is_influencer && (
              <Star
                className="h-3 w-3 text-gold flex-shrink-0 fill-gold"
                aria-label="Influencer"
              />
            )}
          </div>
          <div className={cn('flex items-center gap-1 text-xs', role.color)}>
            <RoleIcon className="h-3 w-3" aria-hidden="true" />
            <span>{role.label}</span>
            <span className="text-surface-500">·</span>
            <span className="text-surface-500">{relTime(trader.voted_at)}</span>
          </div>
        </div>

        {/* Clout */}
        <div className="text-right flex-shrink-0">
          <div
            className={cn(
              'text-sm font-mono font-bold',
              side === 'for' ? 'text-for-400' : 'text-against-400',
            )}
          >
            {formatClout(trader.clout)}
          </div>
          <div className="text-[10px] text-surface-500">clout</div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Recent activity row ──────────────────────────────────────────────────────

function ActivityRow({ trade, index }: { trade: RecentTrade; index: number }) {
  const isFor = trade.side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      className="flex items-center gap-3 py-2.5 border-b border-surface-200 last:border-0"
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
          isFor ? 'bg-for-500/20' : 'bg-against-500/20',
        )}
        aria-hidden="true"
      >
        {isFor ? (
          <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
        ) : (
          <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
        )}
      </div>

      <Avatar
        src={trade.avatar_url}
        alt={trade.display_name ?? trade.username}
        size={22}
        className="flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <span className="text-sm text-surface-700 font-medium truncate">
          {trade.display_name ?? trade.username}
        </span>
        <span className={cn('text-xs ml-1.5', isFor ? 'text-for-400' : 'text-against-400')}>
          voted {isFor ? 'FOR' : 'AGAINST'}
        </span>
      </div>

      <div className="text-right flex-shrink-0">
        <span className="text-[10px] text-surface-500 font-mono">
          {formatClout(trade.clout)}
        </span>
        <span className="text-[10px] text-surface-400 ml-1">·</span>
        <span className="text-[10px] text-surface-500">{relTime(trade.voted_at)}</span>
      </div>
    </motion.div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'for' | 'against' | 'neutral'
}) {
  return (
    <div className="bg-surface-200 rounded-lg px-4 py-3 space-y-0.5">
      <div className="text-[11px] text-surface-500 uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          'text-lg font-bold font-mono',
          accent === 'for' ? 'text-for-400'
          : accent === 'against' ? 'text-against-400'
          : 'text-surface-800',
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-surface-500">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TradersClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<TradersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'leaderboard' | 'activity'>('leaderboard')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${topicId}/traders`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load traders')
      const json = await res.json() as TradersData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const topic = data?.topic
  const forPct = topic?.price ?? 50
  const againstPct = 100 - forPct

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-24 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/exchange/${topicId}`}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Back to market"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>

          <div className="flex-1 min-w-0">
            {loading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <h1 className="text-sm font-medium text-surface-700 truncate leading-snug">
                {topic?.statement ?? 'Market Traders'}
              </h1>
            )}
            <p className="text-[11px] text-surface-500 mt-0.5">Market Traders</p>
          </div>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Sub-nav (back to exchange market) */}
        <div className="flex items-center gap-2 mb-6 text-xs text-surface-500">
          <Link
            href={`/exchange/${topicId}`}
            className="hover:text-surface-700 transition-colors"
          >
            Overview
          </Link>
          <span>/</span>
          <Link
            href={`/exchange/${topicId}/orderbook`}
            className="hover:text-surface-700 transition-colors"
          >
            Order Book
          </Link>
          <span>/</span>
          <span className="text-surface-700 font-medium">Traders</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-8 w-64" />
            <div className="grid md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  {[...Array(6)].map((_, j) => (
                    <Skeleton key={j} className="h-14 rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Flame}
            title="Failed to load traders"
            description={error}
            action={
              <button
                type="button"
                onClick={() => load()}
                className="px-4 py-2 text-sm bg-surface-300 hover:bg-surface-400 text-white rounded-lg transition-colors"
              >
                Try again
              </button>
            }
          />
        )}

        {/* Content */}
        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Consensus bar */}
              <div className="bg-surface-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                    <span className="text-sm font-bold text-for-400">{forPct}% FOR</span>
                    <span className="text-xs text-surface-500">
                      ({(data.topic.blue_votes).toLocaleString()} voters)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-surface-500">
                      ({(data.topic.red_votes).toLocaleString()} voters)
                    </span>
                    <span className="text-sm font-bold text-against-400">{againstPct}% AGAINST</span>
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                  </div>
                </div>
                <div className="h-2.5 bg-surface-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${forPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-surface-500">
                  <span>{data.topic.total_votes.toLocaleString()} total votes</span>
                  <Link
                    href={`/topic/${topicId}`}
                    className="flex items-center gap-1 hover:text-surface-700 transition-colors"
                  >
                    View topic
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Market intelligence metrics */}
              <div>
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Market Intelligence
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard
                    label="Avg Clout FOR"
                    value={formatClout(data.metrics.avg_clout_for)}
                    sub="mean clout of FOR voters"
                    accent="for"
                  />
                  <MetricCard
                    label="Avg Clout AGAINST"
                    value={formatClout(data.metrics.avg_clout_against)}
                    sub="mean clout of AGAINST voters"
                    accent="against"
                  />
                  <MetricCard
                    label="Influencers FOR"
                    value={data.metrics.influencer_for}
                    sub="marked influencer accounts"
                    accent="for"
                  />
                  <MetricCard
                    label="Influencers AGAINST"
                    value={data.metrics.influencer_against}
                    sub="marked influencer accounts"
                    accent="against"
                  />
                </div>

                {/* Elder breakdown */}
                {(data.metrics.elder_for > 0 || data.metrics.elder_against > 0) && (
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-surface-500 bg-surface-200 rounded-lg px-4 py-2.5">
                    <Crown className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden="true" />
                    <span>
                      <span className="text-for-400 font-semibold">{data.metrics.elder_for} Elder{data.metrics.elder_for !== 1 ? 's' : ''}</span>
                      {' '}FOR · {' '}
                      <span className="text-against-400 font-semibold">{data.metrics.elder_against} Elder{data.metrics.elder_against !== 1 ? 's' : ''}</span>
                      {' '}AGAINST
                    </span>
                    <span className="ml-auto text-[10px]">Elders carry maximum platform weight</span>
                  </div>
                )}
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 bg-surface-200 rounded-lg p-1">
                {(
                  [
                    { id: 'leaderboard', label: 'Top Traders', icon: BarChart2 },
                    { id: 'activity', label: 'Recent Activity', icon: Zap },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all flex-1 justify-center',
                      tab === id
                        ? 'bg-surface-100 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-700',
                    )}
                    aria-pressed={tab === id}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Leaderboard tab */}
              {tab === 'leaderboard' && (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* FOR side */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-for-400" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-for-400">
                          FOR Traders
                        </h2>
                        <span className="bg-for-500/20 text-for-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                          {forPct}%
                        </span>
                      </div>
                    </div>

                    {data.forTraders.length === 0 ? (
                      <EmptyState
                        icon={ThumbsUp}
                        title="No FOR voters yet"
                        description="Be the first to back this position."
                        className="py-8"
                      />
                    ) : (
                      <div className="space-y-0.5">
                        {data.forTraders.map((trader, i) => (
                          <TraderRow key={trader.user_id} trader={trader} rank={i} side="for" />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AGAINST side */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="h-4 w-4 text-against-400" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-against-400">
                          AGAINST Traders
                        </h2>
                        <span className="bg-against-500/20 text-against-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                          {againstPct}%
                        </span>
                      </div>
                    </div>

                    {data.againstTraders.length === 0 ? (
                      <EmptyState
                        icon={ThumbsDown}
                        title="No AGAINST voters yet"
                        description="Be the first to oppose this position."
                        className="py-8"
                      />
                    ) : (
                      <div className="space-y-0.5">
                        {data.againstTraders.map((trader, i) => (
                          <TraderRow key={trader.user_id} trader={trader} rank={i} side="against" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Activity tab */}
              {tab === 'activity' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-surface-700">
                      Recent Votes
                    </h2>
                    <span className="text-xs text-surface-500">latest 30</span>
                  </div>

                  {data.recentTrades.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No votes yet"
                      description="Be the first to take a position on this market."
                      className="py-8"
                    />
                  ) : (
                    <div className="bg-surface-200 rounded-xl px-4 py-1">
                      {data.recentTrades.map((trade, i) => (
                        <ActivityRow key={`${trade.username}-${trade.voted_at}`} trade={trade} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer links */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-200">
                <Link
                  href={`/exchange/${topicId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-500 hover:text-white bg-surface-200 hover:bg-surface-300 rounded-lg transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Market Overview
                </Link>
                <Link
                  href={`/exchange/${topicId}/orderbook`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-500 hover:text-white bg-surface-200 hover:bg-surface-300 rounded-lg transition-colors"
                >
                  <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                  Order Book
                </Link>
                <Link
                  href={`/topic/${topicId}/arguments`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-500 hover:text-white bg-surface-200 hover:bg-surface-300 rounded-lg transition-colors"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Arguments
                </Link>
                <Link
                  href={`/topic/${topicId}/leaderboard`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-500 hover:text-white bg-surface-200 hover:bg-surface-300 rounded-lg transition-colors"
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Topic Leaderboard
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
