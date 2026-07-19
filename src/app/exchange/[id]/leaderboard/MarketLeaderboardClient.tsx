'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Crown,
  Filter,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LeaderEntry, LeaderboardData } from '@/app/api/exchange/[id]/leaderboard/route'

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',      label: 'All Traders',   icon: Users      },
  { id: 'winning',  label: 'Winners',        icon: Trophy     },
  { id: 'for',      label: 'FOR',            icon: ThumbsUp   },
  { id: 'against',  label: 'AGAINST',        icon: ThumbsDown },
] as const
type TabId = (typeof TABS)[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function edgeLabel(edge: number): string {
  const sign = edge > 0 ? '+' : ''
  return `${sign}${edge}¢`
}

function edgeColor(edge: number): string {
  if (edge > 10) return 'text-emerald-400'
  if (edge > 0)  return 'text-for-300'
  if (edge < -10) return 'text-against-400'
  if (edge < 0)  return 'text-against-300'
  return 'text-surface-500'
}

function edgeBg(edge: number): string {
  if (edge > 10) return 'bg-emerald-500/15 border-emerald-500/25'
  if (edge > 0)  return 'bg-for-500/15 border-for-500/25'
  if (edge < -10) return 'bg-against-500/20 border-against-500/30'
  if (edge < 0)  return 'bg-against-500/10 border-against-500/20'
  return 'bg-surface-300/30 border-surface-500/20'
}

function rankBadge(rank: number): { icon: typeof Crown | typeof Award | null; cls: string } {
  if (rank === 1) return { icon: Crown,  cls: 'text-gold' }
  if (rank === 2) return { icon: Trophy, cls: 'text-surface-400' }
  if (rank === 3) return { icon: Award,  cls: 'text-amber-700' }
  return { icon: null, cls: 'text-surface-500' }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

const ROLE_BADGE: Record<string, string> = {
  observer:   'bg-surface-300/50 text-surface-500',
  citizen:    'bg-for-500/15 text-for-300',
  senator:    'bg-purple/15 text-purple',
  chancellor: 'bg-gold/15 text-gold',
  admin:      'bg-against-500/15 text-against-400',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconCls,
  label,
  value,
  sub,
}: {
  icon: typeof Trophy
  iconCls: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 flex items-center gap-3">
      <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', iconCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-mono font-bold text-white">{value}</p>
        <p className="text-xs font-mono text-surface-500">{label}</p>
        {sub && <p className="text-xs text-surface-600">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Leader row ───────────────────────────────────────────────────────────────

function LeaderRow({ entry }: { entry: LeaderEntry }) {
  const { icon: RankIcon, cls: rankCls } = rankBadge(entry.rank)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(entry.rank * 0.03, 0.3) }}
      className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3 hover:border-surface-400 transition-colors"
    >
      {/* Rank */}
      <div className={cn('w-7 flex-shrink-0 text-center', rankCls)}>
        {RankIcon ? (
          <RankIcon className="h-5 w-5 mx-auto" />
        ) : (
          <span className="text-sm font-mono font-bold">{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar
          src={entry.avatar_url}
          alt={entry.display_name ?? entry.username}
          size="sm"
          className="ring-1 ring-surface-400 hover:ring-for-500 transition-all"
        />
      </Link>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/profile/${entry.username}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {entry.display_name ?? entry.username}
          </Link>
          {entry.is_influencer && (
            <Zap className="h-3 w-3 text-gold flex-shrink-0" />
          )}
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono uppercase tracking-wide', ROLE_BADGE[entry.role] ?? ROLE_BADGE.citizen)}>
            {entry.role}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Side */}
          <span className={cn('flex items-center gap-0.5 text-xs font-mono font-bold', entry.side === 'for' ? 'text-for-400' : 'text-against-400')}>
            {entry.side === 'for' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {entry.side.toUpperCase()}
          </span>
          {/* Entry vs current */}
          <span className="text-xs text-surface-500 font-mono">
            entered {entry.entry_price}¢ → {entry.current_price}¢
          </span>
          <span className="text-xs text-surface-600 font-mono">
            {relTime(entry.voted_at)}
          </span>
        </div>
      </div>

      {/* Edge badge */}
      <div className={cn('flex-shrink-0 rounded-lg border px-2.5 py-1.5 text-center', edgeBg(entry.edge))}>
        <div className={cn('text-sm font-mono font-bold tabular-nums', edgeColor(entry.edge))}>
          {edgeLabel(entry.edge)}
        </div>
        <div className="flex items-center justify-center gap-0.5 text-[10px] text-surface-500 font-mono">
          {entry.edge > 0 ? (
            <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
          ) : entry.edge < 0 ? (
            <TrendingDown className="h-2.5 w-2.5 text-against-400" />
          ) : null}
          edge
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function MarketLeaderboardClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${topicId}/leaderboard?filter=${tab}`)
      if (!res.ok) throw new Error('Failed to load leaderboard')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId, tab])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-950 text-white pb-24">
      <TopBar />

      <div className="mx-auto max-w-2xl px-4 pt-20">
        {/* Back nav */}
        <Link
          href={`/exchange/${topicId}`}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to market
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              Market Leaderboard
            </h1>
            {data && (
              <p className="mt-1 text-sm text-surface-500 line-clamp-2">
                {data.topic.statement}
              </p>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex-shrink-0 p-2 rounded-lg border border-surface-400 text-surface-500 hover:text-white hover:border-surface-300 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Current price pill */}
        {data && (
          <div className="mb-5 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-surface-500">Current price:</span>
            <span className={cn(
              'text-sm font-mono font-bold px-2 py-0.5 rounded',
              data.topic.current_price >= 50 ? 'text-for-300 bg-for-500/10' : 'text-against-300 bg-against-500/10'
            )}>
              {data.topic.current_price}¢
            </span>
            <span className="text-xs text-surface-600 font-mono">
              {data.topic.blue_votes ?? 0} FOR · {data.topic.red_votes ?? 0} AGAINST
            </span>
            {data.topic.status === 'law' && (
              <Badge variant="law" size="sm">LAW</Badge>
            )}
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : data && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Trophy}
              iconCls="bg-gold/10 text-gold"
              label="Winners"
              value={`${data.winners_count}`}
              sub={`of ${data.total_voters} traders`}
            />
            <StatCard
              icon={TrendingUp}
              iconCls="bg-emerald-500/10 text-emerald-400"
              label="Top Edge"
              value={`+${data.top_edge}¢`}
              sub="best call so far"
            />
            <StatCard
              icon={ThumbsUp}
              iconCls="bg-for-500/10 text-for-400"
              label="FOR Winners"
              value={`${data.for_winners}`}
              sub="bullish & up"
            />
            <StatCard
              icon={ThumbsDown}
              iconCls="bg-against-500/10 text-against-400"
              label="AGAINST Winners"
              value={`${data.against_winners}`}
              sub="bearish & down"
            />
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  tab === t.id
                    ? 'bg-surface-200 text-white'
                    : 'text-surface-500 hover:text-white hover:bg-surface-300/50',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<Filter className="h-8 w-8 text-surface-500" />}
            title="Failed to load"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        ) : !data || data.leaders.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8 text-surface-500" />}
            title="No traders yet"
            description={
              tab === 'winning'
                ? 'No winning positions yet — the market may not have moved enough.'
                : 'Be the first to take a position on this market.'
            }
            action={
              tab !== 'all'
                ? { label: 'Show all traders', onClick: () => setTab('all') }
                : { label: 'Trade this market', href: `/exchange/${topicId}` }
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {data.leaders.map((entry) => (
                <LeaderRow key={entry.user_id} entry={entry} />
              ))}

              {/* Average edge footer */}
              {data.total_voters > 0 && (
                <div className="pt-3 text-center text-xs text-surface-600 font-mono">
                  Average market edge: {data.avg_edge > 0 ? '+' : ''}{data.avg_edge}¢ across {data.total_voters} traders
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
