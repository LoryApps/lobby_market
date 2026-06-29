'use client'

/**
 * /accountability — The Civic Accountability Board
 *
 * A public record of every citizen who has taken the Civic Oath, ranked
 * by post-oath civic engagement. Surfaces whether sworn citizens are
 * actually following through on their commitment.
 *
 * Sections:
 *   Overview        — Total oath-takers, value breakdown, engagement rate
 *   Your Standing   — Rank and stats for the logged-in user (if oath taken)
 *   The Oath Roll   — Full sorted list of oath-holders with engagement metrics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  Globe,
  Heart,
  RefreshCw,
  Scale,
  Scroll,
  Shield,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  AccountabilityResponse,
  OathHolder,
  OathValue,
  AccountabilityStats,
} from '@/app/api/accountability/route'

// ─── Value config ─────────────────────────────────────────────────────────────

const VALUE_CONFIG: Record<
  OathValue,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string; glyph: string }
> = {
  truth:      { label: 'Truth',     icon: Star,       color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30',          glyph: '★' },
  justice:    { label: 'Justice',   icon: Scale,      color: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30',       glyph: '⚖' },
  liberty:    { label: 'Liberty',   icon: Globe,      color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30',       glyph: '◎' },
  community:  { label: 'Community', icon: Heart,      color: 'text-against-400',  bg: 'bg-against-500/10',   border: 'border-against-500/30',   glyph: '♥' },
  progress:   { label: 'Progress',  icon: TrendingUp, color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30',        glyph: '↑' },
}

// ─── Sort modes ───────────────────────────────────────────────────────────────

type SortMode = 'reputation' | 'votes' | 'arguments' | 'streak' | 'newest'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'reputation', label: 'Reputation' },
  { id: 'votes',      label: 'Votes' },
  { id: 'arguments',  label: 'Arguments' },
  { id: 'streak',     label: 'Streak' },
  { id: 'newest',     label: 'Newest' },
]

function sortHolders(holders: OathHolder[], mode: SortMode): OathHolder[] {
  return [...holders].sort((a, b) => {
    switch (mode) {
      case 'votes':      return b.total_votes - a.total_votes
      case 'arguments':  return b.total_arguments - a.total_arguments
      case 'streak':     return b.vote_streak - a.vote_streak
      case 'newest':     return new Date(b.civic_oath_at).getTime() - new Date(a.civic_oath_at).getTime()
      default:           return b.reputation_score - a.reputation_score
    }
  })
}

// ─── Engagement tier ─────────────────────────────────────────────────────────

function getEngagementTier(h: OathHolder): {
  label: string
  color: string
  icon: React.ComponentType<{ className?: string }>
} {
  const score = h.total_votes + h.total_arguments * 5 + h.vote_streak * 2
  if (score >= 500) return { label: 'Exemplary',  color: 'text-gold',        icon: Crown }
  if (score >= 100) return { label: 'Active',     color: 'text-emerald',     icon: Zap }
  if (score >= 20)  return { label: 'Engaged',    color: 'text-for-400',     icon: ThumbsUp }
  if (score >= 5)   return { label: 'Participating', color: 'text-surface-500', icon: Target }
  return               { label: 'Quiet',        color: 'text-surface-600', icon: BookOpen }
}

// ─── Time since oath ──────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30)  return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month ago'
  if (months < 12)  return `${months} months ago`
  const years = Math.floor(days / 365)
  return `${years}yr ago`
}

// ─── Stats overview ───────────────────────────────────────────────────────────

function StatsOverview({ stats }: { stats: AccountabilityStats }) {
  const activeRate =
    stats.total_oath_takers > 0
      ? Math.round((stats.highly_active_count / stats.total_oath_takers) * 100)
      : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {[
        {
          label: 'Oath Takers',
          value: stats.total_oath_takers,
          icon: Scroll,
          color: 'text-gold',
          bg: 'bg-gold/10',
          border: 'border-gold/20',
        },
        {
          label: 'Active Citizens',
          value: stats.highly_active_count,
          icon: Flame,
          color: 'text-emerald',
          bg: 'bg-emerald/10',
          border: 'border-emerald/20',
        },
        {
          label: 'Engagement Rate',
          value: activeRate,
          suffix: '%',
          icon: BarChart2,
          color: 'text-for-400',
          bg: 'bg-for-500/10',
          border: 'border-for-500/20',
        },
        {
          label: 'Avg Votes Cast',
          value: stats.avg_votes_after_oath,
          icon: Vote,
          color: 'text-purple',
          bg: 'bg-purple/10',
          border: 'border-purple/20',
        },
      ].map((s) => (
        <div
          key={s.label}
          className={cn(
            'rounded-xl border p-4 flex flex-col gap-1',
            s.bg,
            s.border
          )}
        >
          <s.icon className={cn('h-4 w-4 mb-1', s.color)} />
          <div className={cn('font-mono text-2xl font-bold', s.color)}>
            <AnimatedNumber value={s.value} />
            {s.suffix}
          </div>
          <div className="text-xs font-mono text-surface-500">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Value breakdown bar ──────────────────────────────────────────────────────

function ValueBreakdown({ stats }: { stats: AccountabilityStats }) {
  const total = stats.total_oath_takers
  if (total === 0) return null

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-100 p-4 mb-6">
      <h3 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold" />
        Value Breakdown
      </h3>
      <div className="space-y-2">
        {(Object.keys(VALUE_CONFIG) as OathValue[]).map((v) => {
          const count = stats.by_value[v] ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const cfg = VALUE_CONFIG[v]
          const Icon = cfg.icon
          return (
            <div key={v} className="flex items-center gap-3">
              <div className={cn('w-24 flex items-center gap-1.5 shrink-0', cfg.color)}>
                <Icon className="h-3 w-3" />
                <span className="font-mono text-xs font-semibold">{cfg.label}</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-surface-200 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', cfg.bg, 'border', cfg.border)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  style={{ backgroundColor: 'currentColor' }}
                />
              </div>
              <div className="font-mono text-xs text-surface-400 w-12 text-right">
                {count} <span className="text-surface-600">({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Your standing card ───────────────────────────────────────────────────────

function YourStanding({
  yourRank,
  yourStats,
}: {
  yourRank: number | null
  yourStats: OathHolder | null
}) {
  if (!yourStats) return null

  const tier = getEngagementTier(yourStats)
  const TierIcon = tier.icon
  const valCfg = VALUE_CONFIG[yourStats.civic_oath_value]
  const ValIcon = valCfg.icon

  return (
    <motion.div
      className="rounded-xl border border-gold/30 bg-gold/5 p-4 mb-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-gold" />
        <span className="font-mono text-sm font-semibold text-gold">Your Accountability Standing</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="font-mono text-3xl font-bold text-gold">
            #{yourRank ?? '—'}
          </div>
          <div className="text-xs font-mono text-surface-500">Rank</div>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="font-mono text-lg font-bold text-white">
              {yourStats.total_votes.toLocaleString()}
            </div>
            <div className="text-xs font-mono text-surface-500">Votes</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-lg font-bold text-white">
              {yourStats.total_arguments.toLocaleString()}
            </div>
            <div className="text-xs font-mono text-surface-500">Arguments</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-lg font-bold text-white">
              {yourStats.vote_streak}
            </div>
            <div className="text-xs font-mono text-surface-500">Streak</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={cn('flex items-center gap-1 font-mono text-xs font-semibold', valCfg.color)}>
            <ValIcon className="h-3 w-3" />
            {valCfg.label}
          </div>
          <div className={cn('flex items-center gap-1 font-mono text-xs font-semibold', tier.color)}>
            <TierIcon className="h-3 w-3" />
            {tier.label}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Holder row ───────────────────────────────────────────────────────────────

function HolderRow({
  holder,
  rank,
  index,
}: {
  holder: OathHolder
  rank: number
  index: number
}) {
  const tier = getEngagementTier(holder)
  const TierIcon = tier.icon
  const valCfg = VALUE_CONFIG[holder.civic_oath_value]
  const ValIcon = valCfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.4) }}
    >
      <Link
        href={`/profile/${holder.username}`}
        className={cn(
          'flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-100',
          'px-3 py-2.5 hover:border-surface-300 hover:bg-surface-150 transition-colors group'
        )}
      >
        {/* Rank */}
        <div className="w-8 text-center font-mono text-sm font-bold text-surface-500 shrink-0">
          {rank <= 3 ? (
            <span className={rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-300' : 'text-amber-600'}>
              #{rank}
            </span>
          ) : (
            <span>#{rank}</span>
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={holder.avatar_url}
          fallback={holder.display_name?.[0] ?? holder.username[0]}
          size="sm"
        />

        {/* Name + value */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {holder.display_name ?? holder.username}
            </span>
            <span className={cn('shrink-0 text-[10px] font-mono font-bold px-1 py-0.5 rounded flex items-center gap-0.5', valCfg.color, valCfg.bg)}>
              <ValIcon className="h-2.5 w-2.5" />
              {valCfg.glyph}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[11px] text-surface-500">@{holder.username}</span>
            <span className="text-surface-700">·</span>
            <span className="font-mono text-[11px] text-surface-500">{timeAgo(holder.civic_oath_at)}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-white">{holder.total_votes.toLocaleString()}</div>
            <div className="font-mono text-[10px] text-surface-600">votes</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-white">{holder.total_arguments}</div>
            <div className="font-mono text-[10px] text-surface-600">args</div>
          </div>
        </div>

        {/* Tier badge */}
        <div className={cn('hidden md:flex items-center gap-1 font-mono text-xs font-semibold shrink-0', tier.color)}>
          <TierIcon className="h-3 w-3" />
          {tier.label}
        </div>

        <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountabilityClient() {
  const [data, setData] = useState<AccountabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('reputation')
  const [valueFilter, setValueFilter] = useState<OathValue | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accountability', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load accountability data')
      const json = await res.json() as AccountabilityResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered + sorted list
  const displayedHolders = data
    ? sortHolders(
        valueFilter
          ? data.holders.filter((h) => h.civic_oath_value === valueFilter)
          : data.holders,
        sortMode
      )
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/oath"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Civic Oath
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 shrink-0">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Accountability</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">The public oath roll — commitment in action</p>
            </div>
          </div>
          <p className="text-sm text-surface-400 font-mono leading-relaxed">
            Every citizen who has taken the Civic Oath, ranked by how they have lived their pledge.
            Accountability is not a promise — it is a record.
          </p>
        </div>

        {/* Refresh */}
        <div className="flex justify-end mb-4">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[160px] rounded-xl" />
            <LoadingSkeleton />
          </div>
        )}

        {error && (
          <EmptyState
            icon={Scale}
            title="Could not load accountability data"
            description={error}
            action={{ label: 'Try again', onClick: fetchData }}
          />
        )}

        {data && (
          <AnimatePresence mode="wait">
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Stats */}
              <StatsOverview stats={data.stats} />

              {/* Value breakdown */}
              <ValueBreakdown stats={data.stats} />

              {/* Your standing */}
              <YourStanding yourRank={data.your_rank} yourStats={data.your_stats} />

              {/* No oath taken CTA */}
              {data.your_stats === null && (
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 mb-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-sm font-semibold text-gold mb-0.5">
                      You haven&apos;t taken the Civic Oath yet
                    </div>
                    <div className="font-mono text-xs text-surface-500">
                      Take the oath to appear on this board and demonstrate your commitment.
                    </div>
                  </div>
                  <Link
                    href="/oath"
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 font-mono text-xs font-semibold text-gold hover:bg-gold/30 transition-colors"
                  >
                    Take the Oath
                  </Link>
                </div>
              )}

              {/* Sort + filter controls */}
              <div className="flex flex-col gap-3 mb-4">
                {/* Value filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setValueFilter(null)}
                    className={cn(
                      'shrink-0 px-2.5 py-1 rounded-full font-mono text-xs font-semibold border transition-colors',
                      valueFilter === null
                        ? 'bg-surface-200 border-surface-300 text-white'
                        : 'border-surface-200 text-surface-500 hover:text-white hover:border-surface-300'
                    )}
                  >
                    All Values
                  </button>
                  {(Object.keys(VALUE_CONFIG) as OathValue[]).map((v) => {
                    const cfg = VALUE_CONFIG[v]
                    const Icon = cfg.icon
                    return (
                      <button
                        key={v}
                        onClick={() => setValueFilter(v === valueFilter ? null : v)}
                        className={cn(
                          'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-semibold border transition-colors',
                          valueFilter === v
                            ? cn(cfg.bg, cfg.border, cfg.color)
                            : 'border-surface-200 text-surface-500 hover:text-white hover:border-surface-300'
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>

                {/* Sort options */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="shrink-0 font-mono text-xs text-surface-600">Sort:</span>
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSortMode(s.id)}
                      className={cn(
                        'shrink-0 px-2.5 py-1 rounded-full font-mono text-xs font-semibold border transition-colors',
                        sortMode === s.id
                          ? 'bg-surface-200 border-surface-300 text-white'
                          : 'border-surface-200 text-surface-500 hover:text-white'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div className="font-mono text-xs text-surface-500 mb-3">
                {displayedHolders.length === 0
                  ? 'No citizens match this filter'
                  : `${displayedHolders.length} citizen${displayedHolders.length !== 1 ? 's' : ''}`}
              </div>

              {/* Oath roll */}
              {displayedHolders.length === 0 ? (
                <EmptyState
                  icon={Scroll}
                  title="No oath-takers match this filter"
                  description="Try clearing the value filter to see all oath-holders."
                  action={{ label: 'Clear filter', onClick: () => setValueFilter(null) }}
                />
              ) : (
                <div className="space-y-2">
                  {displayedHolders.map((holder, i) => (
                    <HolderRow
                      key={holder.id}
                      holder={holder}
                      rank={i + 1}
                      index={i}
                    />
                  ))}
                </div>
              )}

              {/* Footer note */}
              <div className="mt-8 rounded-lg border border-surface-200 bg-surface-100 p-4 text-center">
                <div className="font-mono text-xs text-surface-500 leading-relaxed">
                  Rankings reflect total civic engagement across the platform.
                  Oath-takers are held to the standard of their chosen value.{' '}
                  <Link href="/oath" className="text-gold hover:underline">
                    Take the oath
                  </Link>{' '}
                  to join the roll.
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
