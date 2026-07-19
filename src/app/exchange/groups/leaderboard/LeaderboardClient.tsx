'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Crown,
  Gavel,
  Globe,
  Layers,
  Medal,
  RefreshCw,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GroupLeaderboardEntry, GroupLeaderboardResponse } from '@/app/api/exchange/groups/leaderboard/route'

// ─── Sort options ──────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: 'volume',   label: 'Top',      icon: Trophy },
  { id: 'law_rate', label: 'Accuracy', icon: Gavel  },
  { id: 'size',     label: 'Largest',  icon: Layers },
  { id: 'recent',   label: 'Recent',   icon: Clock  },
] as const

type SortId = (typeof SORT_TABS)[number]['id']

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
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-gold" />
  if (rank === 2) return <Medal className="h-5 w-5 text-zinc-400" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
  return (
    <span className="text-xs font-mono text-surface-500 w-5 text-center">{rank}</span>
  )
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, colorClass }: { label: string; value: string | number; colorClass?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono',
      'bg-surface-300/30 border border-surface-400/20',
      colorClass,
    )}>
      {value}
      <span className="text-surface-500">{label}</span>
    </span>
  )
}

// ─── Group Row ────────────────────────────────────────────────────────────────

function GroupRow({ entry, rank, sort }: { entry: GroupLeaderboardEntry; rank: number; sort: SortId }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.3) }}
    >
      <Link
        href={`/exchange/groups/${entry.id}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors',
          'bg-surface-200/40 border-surface-400/20',
          'hover:bg-surface-300/40 hover:border-surface-400/40',
          rank <= 3 && 'border-surface-400/30',
        )}
      >
        {/* Rank */}
        <div className="flex-none w-6 flex items-center justify-center">
          <RankDisplay rank={rank} />
        </div>

        {/* Emoji */}
        <div className="flex-none text-2xl leading-none">{entry.emoji}</div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-white truncate">{entry.name}</span>
            {rank <= 3 && (
              <Badge className={cn(
                'text-[10px] py-0 px-1.5 font-mono',
                rank === 1 && 'bg-gold/10 border-gold/30 text-gold',
                rank === 2 && 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
                rank === 3 && 'bg-amber-700/10 border-amber-700/30 text-amber-600',
              )}>
                #{rank}
              </Badge>
            )}
          </div>

          {/* Owner */}
          {entry.owner_username && (
            <p className="text-[11px] text-surface-500 mt-0.5">
              by{' '}
              <Link
                href={`/profile/${entry.owner_username}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-for-400 transition-colors"
              >
                @{entry.owner_username}
              </Link>
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <StatPill
              label=" markets"
              value={entry.market_count}
              colorClass="text-white"
            />
            {entry.law_count > 0 && (
              <StatPill
                label=" law"
                value={`${entry.law_count}×`}
                colorClass="text-gold"
              />
            )}
            {entry.live_count > 0 && (
              <StatPill
                label=" live"
                value={entry.live_count}
                colorClass="text-for-400"
              />
            )}
            <StatPill
              label=" vol"
              value={fmtVolume(entry.total_volume)}
              colorClass="text-surface-400"
            />
          </div>
        </div>

        {/* Primary stat based on sort */}
        <div className="flex-none text-right">
          {sort === 'law_rate' && entry.settled_count >= 2 ? (
            <div>
              <p className={cn('text-lg font-mono font-bold', entry.law_rate >= 60 ? 'text-gold' : 'text-surface-400')}>
                {entry.law_rate}%
              </p>
              <p className="text-[10px] text-surface-500">law rate</p>
            </div>
          ) : sort === 'size' ? (
            <div>
              <p className="text-lg font-mono font-bold text-white">{entry.market_count}</p>
              <p className="text-[10px] text-surface-500">markets</p>
            </div>
          ) : sort === 'recent' ? (
            <div>
              <p className="text-sm font-mono text-surface-400">{relTime(entry.updated_at)}</p>
              <p className="text-[10px] text-surface-500">updated</p>
            </div>
          ) : (
            <div>
              <p className={cn('text-lg font-mono font-bold', priceColor(entry.avg_price))}>
                {entry.avg_price}¢
              </p>
              <p className="text-[10px] text-surface-500">avg price</p>
            </div>
          )}
        </div>

        <ChevronRight className="flex-none h-4 w-4 text-surface-600" />
      </Link>
    </motion.div>
  )
}

// ─── Podium (top 3) ───────────────────────────────────────────────────────────

function Podium({ groups }: { groups: GroupLeaderboardEntry[] }) {
  const top3 = groups.slice(0, 3)
  if (top3.length < 2) return null

  const order = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : [top3[0], top3[1]]

  const heights = top3.length >= 3
    ? ['h-16', 'h-24', 'h-12']
    : ['h-20', 'h-16']

  const ranks = top3.length >= 3
    ? [2, 1, 3]
    : [1, 2]

  return (
    <div className="flex items-end justify-center gap-2 pb-2 pt-4">
      {order.map((g, i) => (
        <Link
          key={g.id}
          href={`/exchange/groups/${g.id}`}
          className="flex flex-col items-center gap-1.5 group"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1 + 0.1 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="text-2xl">{g.emoji}</div>
            <p className="text-[11px] font-medium text-white text-center max-w-[80px] truncate group-hover:text-for-300 transition-colors">
              {g.name}
            </p>
            <div className="flex items-center gap-0.5">
              <RankDisplay rank={ranks[i]} />
            </div>
          </motion.div>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: undefined }}
            className={cn(
              'w-20 rounded-t-lg border-t border-x flex items-start justify-center pt-1.5',
              heights[i],
              ranks[i] === 1 && 'bg-gold/10 border-gold/30',
              ranks[i] === 2 && 'bg-zinc-500/10 border-zinc-500/20',
              ranks[i] === 3 && 'bg-amber-700/10 border-amber-700/20',
            )}
          >
            <span className={cn(
              'text-xs font-mono font-bold',
              ranks[i] === 1 && 'text-gold',
              ranks[i] === 2 && 'text-zinc-400',
              ranks[i] === 3 && 'text-amber-600',
            )}>
              #{ranks[i]}
            </span>
          </motion.div>
        </Link>
      ))}
    </div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-200/40 border border-surface-400/20">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-12 rounded" />
            </div>
          </div>
          <Skeleton className="h-8 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardClient() {
  const [sort, setSort] = useState<SortId>('volume')
  const [data, setData] = useState<GroupLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (s: SortId, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/exchange/groups/leaderboard?sort=${s}&limit=50`, {
        cache: 'no-store',
      })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(sort)
  }, [sort, load])

  const groups = data?.groups ?? []

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange/groups"
            className="p-2 rounded-lg bg-surface-200 border border-surface-400/20 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              Group Leaderboard
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Top public market groups · {data ? `${data.total} groups` : '—'}
            </p>
          </div>
          <button
            onClick={() => load(sort, true)}
            disabled={refreshing}
            className="ml-auto p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/50 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1.5 mb-6 p-1 bg-surface-200/60 border border-surface-400/20 rounded-xl overflow-x-auto">
          {SORT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center',
                sort === id
                  ? 'bg-surface-300 text-white shadow-sm'
                  : 'text-surface-500 hover:text-white hover:bg-surface-300/50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonRows />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No public groups yet"
            description="Be the first to create a public market group and claim the #1 spot."
            action={
              <Link
                href="/exchange/groups"
                className="inline-flex items-center gap-2 px-4 py-2 bg-for-500 hover:bg-for-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create a Group
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={sort}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Podium */}
              {sort === 'volume' && groups.length >= 2 && (
                <div className="rounded-xl bg-surface-200/40 border border-surface-400/20 overflow-hidden mb-2">
                  <Podium groups={groups} />
                </div>
              )}

              {/* Info banner for law_rate */}
              {sort === 'law_rate' && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-gold/5 border border-gold/20 text-xs text-surface-400">
                  <Gavel className="h-4 w-4 text-gold flex-none mt-0.5" />
                  <span>
                    Law rate = % of settled markets that became law. Only groups with 2+ settled
                    markets are ranked here.
                  </span>
                </div>
              )}

              {/* Rows */}
              <div className="space-y-2">
                {groups.map((entry, i) => (
                  <GroupRow
                    key={entry.id}
                    entry={entry}
                    rank={i + 1}
                    sort={sort}
                  />
                ))}
              </div>

              {/* CTA */}
              <div className="mt-4 pt-4 border-t border-surface-400/20 text-center">
                <p className="text-sm text-surface-500 mb-3">
                  Want your group on the leaderboard?
                </p>
                <Link
                  href="/exchange/groups"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-surface-300/60 hover:bg-surface-300 border border-surface-400/20 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  Create a Public Group
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
