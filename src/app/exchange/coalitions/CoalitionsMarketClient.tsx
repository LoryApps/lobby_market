'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  Globe,
  RefreshCw,
  Scale,
  Shield,
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
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CoalitionMarketStat,
  CoalitionStanceMarket,
  CoalitionsMarketResponse,
} from '@/app/api/exchange/coalitions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function winRateColor(rate: number | null): string {
  if (rate === null) return 'text-surface-500'
  if (rate >= 75) return 'text-gold'
  if (rate >= 60) return 'text-emerald'
  if (rate >= 45) return 'text-for-400'
  if (rate >= 30) return 'text-against-300'
  return 'text-against-400'
}

function winRadeGrade(rate: number | null): string {
  if (rate === null) return '—'
  if (rate >= 75) return 'S'
  if (rate >= 60) return 'A'
  if (rate >= 45) return 'B'
  if (rate >= 30) return 'C'
  return 'D'
}

function sentimentLabel(c: CoalitionMarketStat): {
  label: string
  color: string
  icon: typeof TrendingUp
} {
  if (c.active_stances === 0) return { label: 'No positions', color: 'text-surface-500', icon: Scale }
  const ratio = c.bullish_count / c.active_stances
  if (ratio >= 0.7) return { label: 'Very Bullish', color: 'text-for-400', icon: TrendingUp }
  if (ratio >= 0.5) return { label: 'Bullish', color: 'text-for-300', icon: TrendingUp }
  if (ratio <= 0.3) return { label: 'Very Bearish', color: 'text-against-400', icon: TrendingDown }
  if (ratio <= 0.5) return { label: 'Bearish', color: 'text-against-300', icon: TrendingDown }
  return { label: 'Neutral', color: 'text-surface-400', icon: Scale }
}

const STATUS_DOT: Record<string, string> = {
  proposed: 'bg-surface-400',
  active:   'bg-for-500',
  voting:   'bg-purple',
  law:      'bg-gold',
  failed:   'bg-against-500',
}

// ─── Sort modes ───────────────────────────────────────────────────────────────

type SortMode = 'influence' | 'accuracy' | 'active' | 'bullish' | 'bearish'

const SORT_OPTS: { id: SortMode; label: string; icon: typeof TrendingUp }[] = [
  { id: 'influence',  label: 'Influence',  icon: Zap },
  { id: 'accuracy',   label: 'Accuracy',   icon: Trophy },
  { id: 'active',     label: 'Active',     icon: BarChart2 },
  { id: 'bullish',    label: 'Bullish',    icon: TrendingUp },
  { id: 'bearish',    label: 'Bearish',    icon: TrendingDown },
]

function sortCoalitions(list: CoalitionMarketStat[], mode: SortMode): CoalitionMarketStat[] {
  return [...list].sort((a, b) => {
    switch (mode) {
      case 'influence':
        return b.coalition_influence - a.coalition_influence
      case 'accuracy':
        return (b.win_rate ?? -1) - (a.win_rate ?? -1)
      case 'active':
        return b.active_stances - a.active_stances
      case 'bullish':
        return (b.bullish_count / Math.max(b.active_stances, 1)) -
               (a.bullish_count / Math.max(a.active_stances, 1))
      case 'bearish':
        return (b.bearish_count / Math.max(b.active_stances, 1)) -
               (a.bearish_count / Math.max(a.active_stances, 1))
    }
  })
}

// ─── Stance row ───────────────────────────────────────────────────────────────

function StanceRow({ s }: { s: CoalitionStanceMarket }) {
  return (
    <Link
      href={`/topic/${s.topic_id}`}
      className={cn(
        'flex items-start gap-3 px-4 py-2.5 hover:bg-surface-200/40 transition-colors',
        'border-b border-surface-300/30 last:border-b-0 group'
      )}
    >
      {/* Stance icon */}
      <span
        className={cn(
          'flex-shrink-0 mt-0.5 h-5 w-5 rounded flex items-center justify-center',
          s.stance === 'for'
            ? 'bg-for-500/20 text-for-400'
            : s.stance === 'against'
            ? 'bg-against-500/20 text-against-400'
            : 'bg-surface-300/40 text-surface-500'
        )}
      >
        {s.stance === 'for' ? (
          <ThumbsUp className="h-3 w-3" />
        ) : s.stance === 'against' ? (
          <ThumbsDown className="h-3 w-3" />
        ) : (
          <Scale className="h-3 w-3" />
        )}
      </span>

      {/* Statement */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-700 line-clamp-1 group-hover:text-white transition-colors">
          {s.statement}
        </p>
        {s.stance_statement && (
          <p className="text-[10px] text-surface-500 mt-0.5 line-clamp-1 italic">
            &ldquo;{s.stance_statement}&rdquo;
          </p>
        )}
      </div>

      {/* Market price + status */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <span
          className={cn(
            'text-xs font-mono font-semibold',
            s.market_price >= 60 ? 'text-for-400' :
            s.market_price <= 40 ? 'text-against-400' : 'text-surface-400'
          )}
        >
          {s.market_price}%
        </span>
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full flex-shrink-0',
            STATUS_DOT[s.status] ?? 'bg-surface-400'
          )}
        />
      </div>
    </Link>
  )
}

// ─── Coalition card ───────────────────────────────────────────────────────────

function CoalitionCard({
  coalition,
  rank,
}: {
  coalition: CoalitionMarketStat
  rank: number
}) {
  const [expanded, setExpanded] = useState(false)
  const sentiment = sentimentLabel(coalition)
  const SentimentIcon = sentiment.icon
  const grade = winRadeGrade(coalition.win_rate)
  const gradeColor = winRateColor(coalition.win_rate)

  return (
    <motion.div
      layout
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4 hover:bg-surface-200/30 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {/* Rank */}
          <span
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold',
              rank === 1
                ? 'bg-gold/20 text-gold'
                : rank === 2
                ? 'bg-surface-400/20 text-surface-400'
                : rank === 3
                ? 'bg-against-400/20 text-against-400'
                : 'bg-surface-300/20 text-surface-500'
            )}
          >
            {rank}
          </span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white truncate">{coalition.name}</h3>
              {coalition.active_stances > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-surface-500/50 text-surface-500">
                  {coalition.active_stances} active
                </Badge>
              )}
            </div>
            {coalition.description && (
              <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{coalition.description}</p>
            )}

            {/* Stat pills */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {/* Sentiment */}
              <span className={cn('flex items-center gap-1 text-[11px] font-medium', sentiment.color)}>
                <SentimentIcon className="h-3 w-3" />
                {sentiment.label}
              </span>

              {/* Members */}
              <span className="flex items-center gap-1 text-[11px] text-surface-500">
                <Users className="h-3 w-3" />
                {coalition.member_count}
              </span>

              {/* For/against breakdown */}
              {coalition.active_stances > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-surface-500">
                  <span className="text-for-400">{coalition.bullish_count}↑</span>
                  <span className="text-against-400">{coalition.bearish_count}↓</span>
                  {coalition.neutral_count > 0 && (
                    <span className="text-surface-500">{coalition.neutral_count}↔</span>
                  )}
                </span>
              )}

              {/* Avg price */}
              {coalition.avg_market_price !== null && (
                <span className="text-[11px] text-surface-500 font-mono">
                  avg {coalition.avg_market_price}%
                </span>
              )}
            </div>
          </div>

          {/* Win rate grade */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <span className={cn('text-2xl font-black font-mono leading-none', gradeColor)}>
              {grade}
            </span>
            {coalition.win_rate !== null && (
              <span className="text-[10px] text-surface-500 font-mono">
                {coalition.win_rate}%
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-surface-500 transition-transform',
                expanded && 'rotate-180'
              )}
            />
          </div>
        </div>

        {/* Win/loss bar */}
        {coalition.resolved_stances > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-500 to-emerald transition-all"
                style={{ width: `${coalition.win_rate ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-surface-500 font-mono flex-shrink-0">
              {coalition.correct_stances}/{coalition.resolved_stances} correct
            </span>
          </div>
        )}
      </button>

      {/* Expanded stances */}
      <AnimatePresence>
        {expanded && coalition.top_stances.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-300/40"
          >
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-surface-500 font-mono">
                Current positions
              </p>
              {coalition.top_stances.map((s) => (
                <StanceRow key={s.topic_id} s={s} />
              ))}
              {coalition.active_stances > coalition.top_stances.length && (
                <div className="px-4 py-2">
                  <Link
                    href={`/coalitions/${coalition.id}`}
                    className="text-[11px] text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                  >
                    View all {coalition.active_stances} stances
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {expanded && coalition.top_stances.length === 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-300/40"
          >
            <p className="px-4 py-3 text-xs text-surface-500 text-center">
              No active stances declared
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CoalitionCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CoalitionsMarketClient() {
  const [data, setData] = useState<CoalitionsMarketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('influence')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/coalitions')
      if (!res.ok) throw new Error('Failed to load data')
      const json = (await res.json()) as CoalitionsMarketResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sorted = data ? sortCoalitions(data.coalitions, sort) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/exchange"
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Exchange
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white">Coalition Market Tracker</h1>
          </div>
          <p className="text-sm text-surface-500">
            How every coalition is positioned across civic prediction markets — stance accuracy, conviction, and head-to-head record.
          </p>
        </div>

        {/* Global stat cards */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-xs text-surface-500 mb-1">Active Stances</p>
              <p className="text-lg font-bold text-white font-mono">
                {data.total_active_stances}
              </p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-xs text-surface-500 mb-1">Coalitions</p>
              <p className="text-lg font-bold text-white font-mono">
                {data.coalitions.length}
              </p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-xs text-surface-500 mb-1">Top Accurate</p>
              <p className="text-xs font-semibold text-gold truncate">
                {data.highest_accuracy ?? '—'}
              </p>
            </div>
          </div>
        )}

        {/* Spotlight chips */}
        {data && !loading && (data.most_bullish || data.most_bearish) && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {data.most_bullish && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-for-500/10 border border-for-500/20">
                <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                <span className="text-xs text-for-400 font-medium">Most Bullish: {data.most_bullish}</span>
              </div>
            )}
            {data.most_bearish && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-against-500/10 border border-against-500/20">
                <TrendingDown className="h-3.5 w-3.5 text-against-400" />
                <span className="text-xs text-against-400 font-medium">Most Bearish: {data.most_bearish}</span>
              </div>
            )}
          </div>
        )}

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {SORT_OPTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                sort === id
                  ? 'bg-for-600/20 border border-for-600/40 text-for-400'
                  : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-surface-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <CoalitionCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/20 p-6 text-center">
            <p className="text-sm text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No coalition stances yet"
            description="Coalitions haven't declared positions on any active markets. Once they do, you'll see their accuracy and conviction here."
            action={{ label: 'Browse coalitions', href: '/coalitions' }}
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((coalition, i) => (
              <CoalitionCard key={coalition.id} coalition={coalition} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Footer link */}
        {!loading && sorted.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/coalitions"
              className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
            >
              <Users className="h-4 w-4" />
              Browse all coalitions
            </Link>
            <Link
              href="/coalitions/stance-map"
              className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
            >
              <Globe className="h-4 w-4" />
              Stance map
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
