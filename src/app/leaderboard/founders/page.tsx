'use client'

/**
 * /leaderboard/founders — The Founding Citizens
 *
 * Honors Lobby Market's earliest adopters — ranked by join order,
 * not by performance. The earlier you arrived, the higher your
 * founding rank. A record that can never be improved: time of arrival
 * is permanent.
 *
 * Founding eras (by join-order rank):
 *   Patriarch   (#1–10)     — the original ten
 *   Pioneer     (#11–50)    — first fifty
 *   Vanguard    (#51–200)   — first two hundred
 *   Early       (#201–500)  — first five hundred
 *   Citizen     (#501+)     — the growing community
 *
 * Distinct from:
 *   /leaderboard/legends    — all-time record holders by metric
 *   /leaderboard/reputation — ranked by civic reputation score
 *   /leaderboard/rising     — ranked by recent growth
 *   /rising                 — newest active citizens
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Crown,
  Info,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  FounderEntry,
  FoundingEra,
  FoundersLeaderboardResponse,
} from '@/app/api/leaderboard/founders/route'

// ─── Era config ───────────────────────────────────────────────────────────────

const ERA_CONFIG: Record<
  FoundingEra,
  {
    label: string
    range: string
    color: string
    bg: string
    border: string
    badge: string
    icon: typeof Crown
    glow: string
  }
> = {
  patriarch: {
    label: 'Patriarch',
    range: '#1 – 10',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    badge: 'bg-gold/20 text-gold border-gold/40',
    icon: Crown,
    glow: 'shadow-gold/20',
  },
  pioneer: {
    label: 'Pioneer',
    range: '#11 – 50',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    badge: 'bg-purple/20 text-purple border-purple/40',
    icon: Sparkles,
    glow: 'shadow-purple/20',
  },
  vanguard: {
    label: 'Vanguard',
    range: '#51 – 200',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    badge: 'bg-for-500/20 text-for-400 border-for-500/40',
    icon: Shield,
    glow: 'shadow-for-500/20',
  },
  early: {
    label: 'Early Citizen',
    range: '#201 – 500',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    badge: 'bg-emerald/20 text-emerald border-emerald/40',
    icon: Star,
    glow: 'shadow-emerald/20',
  },
  citizen: {
    label: 'Citizen',
    range: '#501+',
    color: 'text-surface-400',
    bg: 'bg-surface-200/40',
    border: 'border-surface-300',
    badge: 'bg-surface-200 text-surface-400 border-surface-400/30',
    icon: Users,
    glow: '',
  },
}

type EraFilter = FoundingEra | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDays(days: number): string {
  if (days < 1) return 'today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  const yrs = Math.floor(days / 365)
  const mos = Math.floor((days % 365) / 30)
  return mos > 0 ? `${yrs}y ${mos}mo` : `${yrs}y`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-surface-500'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-600/10 border-amber-600/30'
  return 'bg-surface-200/30 border-surface-300/20'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EntrySkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-surface-300/20 bg-surface-100/40 px-4 py-4">
      <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
      <Skeleton className="h-5 w-10" />
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function FounderRow({
  entry,
  isMe,
  animate,
}: {
  entry: FounderEntry
  isMe: boolean
  animate: boolean
}) {
  const era = ERA_CONFIG[entry.era]
  const EraIcon = era.icon

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all hover:border-surface-400/40 hover:bg-surface-200/40',
          isMe
            ? 'border-for-500/40 bg-for-500/5 ring-1 ring-for-500/20'
            : 'border-surface-300/20 bg-surface-100/30'
        )}
      >
        {/* Founding rank */}
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg border text-xs font-mono font-bold flex-shrink-0',
            rankBg(entry.founding_rank),
            rankColor(entry.founding_rank)
          )}
        >
          #{entry.founding_rank}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate">
              {entry.display_name ?? entry.username}
            </span>
            {isMe && (
              <span className="text-[9px] font-mono font-bold text-for-400 bg-for-500/20 px-1.5 py-0.5 rounded border border-for-500/30">
                YOU
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-surface-500 font-mono">
            <span>@{entry.username}</span>
            <span>·</span>
            <span title={new Date(entry.joined_at).toLocaleDateString()}>
              {formatDays(entry.days_on_platform)} on platform
            </span>
          </div>
        </div>

        {/* Era badge */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold flex-shrink-0',
            era.badge
          )}
        >
          <EraIcon className="h-2.5 w-2.5" />
          {era.label}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-shrink-0 text-right">
          <div className="hidden md:block text-right">
            <div className="text-xs font-mono font-semibold text-white">
              {formatNumber(entry.total_votes)}
            </div>
            <div className="text-[10px] text-surface-500">votes</div>
          </div>
          <div className="hidden lg:block text-right">
            <div className="text-xs font-mono font-semibold text-emerald">
              {formatNumber(entry.reputation_score)}
            </div>
            <div className="text-[10px] text-surface-500">rep</div>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── My rank banner ───────────────────────────────────────────────────────────

function MyRankBanner({
  rank,
  era,
}: {
  rank: number
  era: FoundingEra
}) {
  const config = ERA_CONFIG[era]
  const EraIcon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-2xl border p-4 mb-6',
        config.bg,
        config.border
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center h-12 w-12 rounded-xl border',
            config.bg,
            config.border
          )}
        >
          <EraIcon className={cn('h-6 w-6', config.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-base font-bold font-mono', config.color)}>
              Founding Citizen #{rank}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            You are a <span className={cn('font-semibold', config.color)}>{config.label}</span> — {config.range}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FoundersLeaderboardPage() {
  const [data, setData] = useState<FoundersLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [eraFilter, setEraFilter] = useState<EraFilter>('all')
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 50

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(
        `/api/leaderboard/founders?limit=${PAGE_SIZE}&offset=${offset}`
      )
      if (res.ok) {
        const json = (await res.json()) as FoundersLeaderboardResponse
        setData(json)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [offset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredEntries =
    !data?.entries
      ? []
      : eraFilter === 'all'
        ? data.entries
        : data.entries.filter((e) => e.era === eraFilter)

  const totalCitizens = data?.total_citizens ?? 0
  const myRank = data?.my_rank ?? null
  const myEra = data?.my_era ?? null

  const ERA_FILTERS: { id: EraFilter; label: string; icon: typeof Crown }[] = [
    { id: 'all', label: 'All', icon: Users },
    { id: 'patriarch', label: 'Patriarchs', icon: Crown },
    { id: 'pioneer', label: 'Pioneers', icon: Sparkles },
    { id: 'vanguard', label: 'Vanguard', icon: Shield },
    { id: 'early', label: 'Early', icon: Star },
    { id: 'citizen', label: 'Citizens', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10">

        {/* Back */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Leaderboard
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                  <Crown className="h-4 w-4 text-gold" />
                </div>
                <h1 className="text-xl font-bold text-white font-mono">
                  Founding Citizens
                </h1>
              </div>
              <p className="text-sm text-surface-500 leading-relaxed">
                The citizens who arrived first — ranked by join order, not by performance.
                A permanent record that can never be improved upon.
              </p>
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-surface-500 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* My rank banner */}
        {myRank !== null && myEra !== null && (
          <MyRankBanner rank={myRank} era={myEra} />
        )}

        {/* Stats strip */}
        {data && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl border border-surface-300/30 bg-surface-100/40 p-3 text-center">
              <div className="text-lg font-bold text-white font-mono">
                <AnimatedNumber value={totalCitizens} />
              </div>
              <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mt-0.5">
                Total Citizens
              </div>
            </div>
            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-3 text-center">
              <div className="text-lg font-bold text-gold font-mono">10</div>
              <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mt-0.5">
                Patriarchs
              </div>
            </div>
            <div className="rounded-2xl border border-surface-300/30 bg-surface-100/40 p-3 text-center">
              <div className="text-lg font-bold text-purple font-mono">50</div>
              <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mt-0.5">
                Pioneers
              </div>
            </div>
          </div>
        )}

        {/* Era legend */}
        <details className="mb-5 group">
          <summary className="flex items-center gap-1.5 text-xs font-mono text-surface-500 cursor-pointer hover:text-white transition-colors list-none">
            <Info className="h-3.5 w-3.5" />
            Founding eras explained
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {(Object.entries(ERA_CONFIG) as [FoundingEra, typeof ERA_CONFIG['patriarch']][]).map(([era, cfg]) => {
              const EraIcon = cfg.icon
              return (
                <div
                  key={era}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2',
                    cfg.bg,
                    cfg.border
                  )}
                >
                  <EraIcon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} />
                  <div className="flex items-center gap-2 flex-1">
                    <span className={cn('text-xs font-mono font-semibold', cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-surface-500">{cfg.range}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </details>

        {/* Era filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {ERA_FILTERS.map((f) => {
            const EIcon = f.icon
            const isActive = eraFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setEraFilter(f.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all',
                  isActive
                    ? 'bg-for-500/20 text-for-300 border-for-500/50'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white'
                )}
              >
                <EIcon className="h-3 w-3" />
                {f.label}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 12 }).map((_, i) => <EntrySkeleton key={i} />)
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No citizens found"
              description="No citizens match the selected era filter."
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredEntries.map((entry, i) => (
                <FounderRow
                  key={entry.user_id}
                  entry={entry}
                  isMe={myRank === entry.founding_rank}
                  animate={i < 20}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Pagination */}
        {!loading && data && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-300 bg-surface-100 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Prev
            </button>

            <div className="text-xs font-mono text-surface-500">
              #{offset + 1} – #{Math.min(offset + PAGE_SIZE, totalCitizens)}
              {' '}of{' '}
              {totalCitizens.toLocaleString()}
            </div>

            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= totalCitizens}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-300 bg-surface-100 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Footer note */}
        <p className="mt-8 text-center text-[11px] font-mono text-surface-600 leading-relaxed">
          Founding ranks are permanent. No civic action can change when you arrived.
          <br />
          Every citizen listed here helped build the Lobby from the ground up.
        </p>

      </main>
      <BottomNav />
    </div>
  )
}
