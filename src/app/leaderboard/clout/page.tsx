'use client'

/**
 * /leaderboard/clout — Civic Clout Rankings
 *
 * Three views:
 *   Richest  — who holds the most Clout right now (current balance)
 *   Earners  — who earned the most Clout in the last 7 days
 *   Givers   — who gifted the most Clout this week (community generosity)
 *
 * Clout tiers:
 *   Magnate    (≥50,000) — commanding presence in the Clout economy
 *   Baron      (≥10,000) — significant Clout capital
 *   Merchant   (≥5,000)  — active participant in the Clout economy
 *   Trader     (≥1,000)  — building civic wealth
 *   Participant (<1,000)  — early-stage Clout journey
 *
 * Distinct from:
 *   /leaderboard/reputation  — civic reputation score (not Clout balance)
 *   /leaderboard/impact      — influence on platform outcomes
 *   /clout                   — public Clout transaction ledger
 *   /analytics/clout         — personal Clout breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Coins,
  Crown,
  Gift,
  Info,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
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
  CloutLeaderEntry,
  CloutTier,
  CloutLeaderboardResponse,
} from '@/app/api/leaderboard/clout/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  CloutTier,
  {
    label: string
    threshold: string
    color: string
    bg: string
    border: string
    badge: string
    icon: typeof Crown
  }
> = {
  magnate: {
    label: 'Magnate',
    threshold: '≥50,000',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    badge: 'bg-gold/20 text-gold',
    icon: Crown,
  },
  baron: {
    label: 'Baron',
    threshold: '≥10,000',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    badge: 'bg-purple/20 text-purple',
    icon: Sparkles,
  },
  merchant: {
    label: 'Merchant',
    threshold: '≥5,000',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    badge: 'bg-for-500/20 text-for-400',
    icon: TrendingUp,
  },
  trader: {
    label: 'Trader',
    threshold: '≥1,000',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    badge: 'bg-emerald/20 text-emerald',
    icon: Coins,
  },
  participant: {
    label: 'Participant',
    threshold: '<1,000',
    color: 'text-surface-400',
    bg: 'bg-surface-200/40',
    border: 'border-surface-300',
    badge: 'bg-surface-200 text-surface-400',
    icon: Zap,
  },
}

type Tab = 'richest' | 'earners' | 'givers'

const TAB_CONFIG: {
  id: Tab
  label: string
  icon: typeof Coins
  description: string
  metricLabel: string
}[] = [
  {
    id: 'richest',
    label: 'Richest',
    icon: Trophy,
    description: 'Highest current Clout balance',
    metricLabel: 'Total Clout',
  },
  {
    id: 'earners',
    label: 'Top Earners',
    icon: TrendingUp,
    description: 'Most Clout earned this week',
    metricLabel: 'Earned (7d)',
  },
  {
    id: 'givers',
    label: 'Top Givers',
    icon: Gift,
    description: 'Most Clout gifted this week',
    metricLabel: 'Gifted (7d)',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClout(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function EntrySkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-surface-300/20 bg-surface-100/40 px-4 py-4">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────────

function LeaderRow({
  entry,
  tab,
  isMe,
  animate,
}: {
  entry: CloutLeaderEntry
  tab: Tab
  isMe: boolean
  animate: boolean
}) {
  const tier = TIER_CONFIG[entry.tier]
  const TierIcon = tier.icon
  const metricValue = tab !== 'richest' ? (entry.period_amount ?? 0) : entry.clout

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors hover:bg-surface-200/40',
          isMe
            ? 'border-for-500/40 bg-for-500/5'
            : rankBg(entry.rank)
        )}
      >
        {/* Rank */}
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-mono font-bold flex-shrink-0',
            isMe
              ? 'border-for-500/40 bg-for-500/10 text-for-400'
              : rankBg(entry.rank),
            !isMe && rankColor(entry.rank)
          )}
        >
          {entry.rank <= 3 ? (
            <Trophy className={cn('h-3.5 w-3.5', rankColor(entry.rank))} />
          ) : (
            entry.rank
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          username={entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + tier */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-mono text-sm font-semibold truncate', isMe ? 'text-for-300' : 'text-white')}>
              {entry.display_name ?? entry.username}
            </span>
            {isMe && (
              <span className="text-[10px] font-mono bg-for-500/20 text-for-400 border border-for-500/30 px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">
                You
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <TierIcon className={cn('h-3 w-3', tier.color)} />
            <span className={cn('text-xs font-mono', tier.color)}>
              {tier.label}
            </span>
            <span className="text-surface-600 text-xs font-mono">·</span>
            <span className="text-xs font-mono text-surface-500 capitalize">
              {entry.role.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Metric */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className={cn('flex items-center gap-1 font-mono font-bold text-sm', tier.color)}>
            <Coins className="h-3.5 w-3.5" />
            {formatClout(metricValue)}
          </div>
          {tab !== 'richest' && (
            <span className="text-xs font-mono text-surface-500">
              bal: {formatClout(entry.clout)}
            </span>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CloutLeaderboardPage() {
  const [tab, setTab] = useState<Tab>('richest')
  const [data, setData] = useState<CloutLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [animateEntries, setAnimateEntries] = useState(false)

  // Fetch current user id for "isMe" highlighting
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        setMyUserId(user?.id ?? null)
      })
    })
  }, [])

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboard/clout?tab=${t}`)
      if (!res.ok) throw new Error('Failed to load leaderboard')
      const json: CloutLeaderboardResponse = await res.json()
      setData(json)
      setAnimateEntries(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setAnimateEntries(false)
    load(tab)
  }, [tab, load])

  const myStats = data?.my_stats ?? null
  const activeTabCfg = TAB_CONFIG.find((t) => t.id === tab)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Coins className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold text-white leading-tight">
                Civic Clout Rankings
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Who controls the Clout economy
              </p>
            </div>
          </div>
        </div>

        {/* My stats card */}
        {myStats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-for-500/30 bg-for-500/5 px-5 py-4"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wide mb-1">
                  Your Clout
                </p>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-gold" />
                  <span className="font-mono text-2xl font-bold text-gold">
                    <AnimatedNumber value={myStats.clout} />
                  </span>
                  <span className={cn(
                    'text-xs font-mono px-2 py-0.5 rounded-md border',
                    TIER_CONFIG[myStats.tier].badge,
                    TIER_CONFIG[myStats.tier].border
                  )}>
                    {TIER_CONFIG[myStats.tier].label}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {myStats.rank && (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    <span className="font-mono text-sm font-semibold text-white">
                      #{myStats.rank}
                    </span>
                    {myStats.percentile != null && (
                      <span className="text-xs font-mono text-surface-400">
                        top {100 - myStats.percentile}%
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-emerald">
                    +{formatClout(myStats.earned_this_week)} earned
                  </span>
                  <span className="text-purple">
                    {formatClout(myStats.gifted_this_week)} gifted
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Platform total */}
        {data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-surface-300/30 bg-surface-100/40 px-4 py-3">
              <p className="text-xs font-mono text-surface-500 mb-0.5">Total citizens</p>
              <p className="font-mono text-sm font-semibold text-white">
                {data.total_citizens.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-surface-300/30 bg-surface-100/40 px-4 py-3">
              <p className="text-xs font-mono text-surface-500 mb-0.5">
                {tab === 'richest' ? 'Total Clout in top 100' : tab === 'earners' ? 'Earned this week' : 'Gifted this week'}
              </p>
              <div className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-gold" />
                <p className="font-mono text-sm font-semibold text-gold">
                  {formatClout(data.platform_total)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tier legend */}
        <div className="rounded-2xl border border-surface-300/20 bg-surface-100/30 px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-3.5 w-3.5 text-surface-500" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">
              Clout Tiers
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.entries(TIER_CONFIG) as [CloutTier, typeof TIER_CONFIG[CloutTier]][]).map(
              ([tier, cfg]) => {
                const Icon = cfg.icon
                return (
                  <div
                    key={tier}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
                      cfg.bg,
                      cfg.border
                    )}
                  >
                    <Icon className={cn('h-3 w-3 flex-shrink-0', cfg.color)} />
                    <div>
                      <p className={cn('text-[10px] font-mono font-bold', cfg.color)}>
                        {cfg.label}
                      </p>
                      <p className="text-[9px] font-mono text-surface-500">{cfg.threshold}</p>
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-surface-200/60 border border-surface-300/30 p-1 gap-1">
          {TAB_CONFIG.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-mono font-medium transition-colors',
                  tab === t.id
                    ? 'bg-surface-50 text-white border border-surface-300/50 shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.id === 'richest' ? 'Rich' : t.id === 'earners' ? 'Earn' : 'Give'}</span>
              </button>
            )
          })}
        </div>

        {/* Tab description */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-surface-500">
            {activeTabCfg.description}
          </p>
          <button
            onClick={() => load(tab)}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 text-sm font-mono text-against-300">
            {error}
          </div>
        )}

        {/* Entries */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => <EntrySkeleton key={i} />)
          ) : data?.entries.length === 0 ? (
            <EmptyState
              icon={Coins}
              iconColor="text-gold"
              iconBg="bg-gold/10"
              iconBorder="border-gold/30"
              title="No data yet"
              description={
                tab === 'richest'
                  ? 'No citizens have earned Clout yet.'
                  : tab === 'earners'
                  ? 'No Clout earned this week yet — be the first.'
                  : 'No Clout gifted this week yet — be the first to give.'
              }
              actions={[{ label: 'Earn Clout', href: '/', variant: 'primary', icon: Zap }]}
            />
          ) : (
            <AnimatePresence mode="wait">
              <div key={tab} className="space-y-2">
                {(data?.entries ?? []).map((entry, idx) => (
                  <LeaderRow
                    key={entry.user_id}
                    entry={entry}
                    tab={tab}
                    isMe={entry.user_id === myUserId}
                    animate={animateEntries && idx < 20}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Bottom links */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href="/clout"
            className="flex items-center justify-between rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 hover:bg-gold/10 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-gold" />
              <span className="text-sm font-mono text-surface-300 group-hover:text-white transition-colors">
                Clout Ledger
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </Link>
          <Link
            href="/analytics/clout"
            className="flex items-center justify-between rounded-xl border border-for-500/20 bg-for-500/5 px-4 py-3 hover:bg-for-500/10 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-for-400" />
              <span className="text-sm font-mono text-surface-300 group-hover:text-white transition-colors">
                My Analytics
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
