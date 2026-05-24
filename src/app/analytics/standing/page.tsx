'use client'

/**
 * /analytics/standing — Civic Standing Report
 *
 * Your absolute rank on the platform across five civic dimensions:
 * Clout, Reputation, Votes, Arguments, and Streak. Each dimension
 * shows your rank number, percentile, and tier — letting you see exactly
 * where you stand among all citizens on the platform.
 *
 * Distinct from:
 *   /analytics/benchmark   — compares to your signup cohort (not all citizens)
 *   /leaderboard           — single-dimension all-time ranking table
 *   /analytics/growth      — participation trends over time
 *   /karma                 — composite credit score (not raw rank)
 *   /league                — monthly clout-sprint leaderboard only
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Gavel,
  Medal,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
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
import type { StandingResponse, DimensionRank } from '@/app/api/analytics/standing/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}


// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  DimensionRank['tier'],
  { label: string; color: string; bg: string; border: string; bar: string; icon: typeof Trophy }
> = {
  elite: {
    label: 'Elite',
    color:  'text-gold',
    bg:     'bg-gold/10',
    border: 'border-gold/40',
    bar:    'bg-gold',
    icon:   Crown,
  },
  top: {
    label: 'Top Tier',
    color:  'text-emerald',
    bg:     'bg-emerald/10',
    border: 'border-emerald/30',
    bar:    'bg-emerald',
    icon:   Trophy,
  },
  high: {
    label: 'High',
    color:  'text-for-300',
    bg:     'bg-for-500/10',
    border: 'border-for-500/30',
    bar:    'bg-for-500',
    icon:   Medal,
  },
  mid: {
    label: 'Mid',
    color:  'text-surface-300',
    bg:     'bg-surface-200',
    border: 'border-surface-400/30',
    bar:    'bg-surface-400',
    icon:   Shield,
  },
  low: {
    label: 'Rising',
    color:  'text-surface-500',
    bg:     'bg-surface-200',
    border: 'border-surface-400/20',
    bar:    'bg-surface-500',
    icon:   Zap,
  },
}

// ─── Dimension config ──────────────────────────────────────────────────────────

const DIM_ICON: Record<string, React.ElementType> = {
  clout:     Coins,
  reputation: Star,
  votes:     ThumbsUp,
  arguments: MessageSquare,
  streak:    Flame,
}

const DIM_COLOR: Record<string, string> = {
  clout:     'text-gold',
  reputation:'text-emerald',
  votes:     'text-for-400',
  arguments: 'text-purple',
  streak:    'text-against-400',
}

const DIM_BG: Record<string, string> = {
  clout:     'bg-gold/10 border-gold/20',
  reputation:'bg-emerald/10 border-emerald/20',
  votes:     'bg-for-500/10 border-for-500/20',
  arguments: 'bg-purple/10 border-purple/20',
  streak:    'bg-against-500/10 border-against-500/20',
}

const DIM_BAR: Record<string, string> = {
  clout:     'bg-gold',
  reputation:'bg-emerald',
  votes:     'bg-for-500',
  arguments: 'bg-purple',
  streak:    'bg-against-500',
}

const DIM_LINKS: Record<string, string> = {
  clout:     '/analytics/clout',
  reputation:'/analytics/legacy',
  votes:     '/analytics/votes',
  arguments: '/analytics/arguments',
  streak:    '/analytics/streak',
}

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',       color: 'text-surface-400' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',         color: 'text-gold' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StandingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-7 w-14 mx-auto" />
              <Skeleton className="h-3 w-10 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Overall Banner ────────────────────────────────────────────────────────────

function OverallBanner({
  data,
  animate,
}: {
  data: StandingResponse
  animate: boolean
}) {
  const tier = TIER_CONFIG[data.overall_tier]
  const TierIcon = tier.icon
  const roleConf = ROLE_LABEL[data.profile.role] ?? { label: data.profile.role, color: 'text-surface-400' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      {/* Profile row */}
      <div className="flex items-center gap-4 mb-5">
        <Avatar
          src={data.profile.avatar_url}
          fallback={data.profile.display_name || data.profile.username}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-mono font-bold text-white truncate">
            {data.profile.display_name || data.profile.username}
          </p>
          <p className={cn('text-xs font-mono', roleConf.color)}>{roleConf.label}</p>
        </div>
        {/* Overall tier badge */}
        <div
          className={cn(
            'flex flex-col items-center justify-center h-16 w-16 rounded-2xl border flex-shrink-0',
            tier.bg, tier.border
          )}
        >
          <TierIcon className={cn('h-5 w-5 mb-0.5', tier.color)} aria-hidden="true" />
          <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', tier.color)}>
            {tier.label}
          </span>
        </div>
      </div>

      {/* Overall rank stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="text-center">
          <p className="text-2xl font-mono font-bold text-white">
            #{fmtNum(data.overall_rank)}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
            Platform Rank
          </p>
        </div>
        <div className="text-center border-x border-surface-300">
          <p className={cn('text-2xl font-mono font-bold', tier.color)}>
            {data.overall_percentile}
            <span className="text-sm">%</span>
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
            Percentile
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-mono font-bold text-surface-400">
            {fmtNum(data.citizen_count)}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
            Citizens
          </p>
        </div>
      </div>

      {/* Overall percentile bar */}
      <div>
        <div className="flex justify-between text-[9px] font-mono text-surface-600 mb-1.5">
          <span>0th</span>
          <span>50th</span>
          <span>100th</span>
        </div>
        <div className="relative h-3 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="absolute top-0 h-full w-px bg-surface-500/50"
            style={{ left: '50%' }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 h-full w-px bg-surface-500/30"
            style={{ left: '90%' }}
            aria-hidden="true"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={animate ? { width: `${Math.min(data.overall_percentile, 99)}%` } : { width: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
            className={cn('h-full rounded-full', tier.bar, 'opacity-80')}
          />
        </div>
        <p className="text-xs font-mono text-surface-500 text-center mt-2">
          You outrank{' '}
          <span className={cn('font-bold', tier.color)}>{data.overall_percentile}%</span>
          {' '}of all citizens on Lobby Market
        </p>
      </div>
    </motion.div>
  )
}

// ─── Dimension Card ────────────────────────────────────────────────────────────

function DimensionCard({
  dim,
  index,
  animate,
}: {
  dim: DimensionRank
  index: number
  animate: boolean
}) {
  const Icon = DIM_ICON[dim.key] ?? BarChart2
  const iconColor = DIM_COLOR[dim.key] ?? 'text-surface-400'
  const iconBg = DIM_BG[dim.key] ?? 'bg-surface-200 border-surface-300'
  const barColor = DIM_BAR[dim.key] ?? 'bg-surface-500'
  const tier = TIER_CONFIG[dim.tier]
  const TierIcon = tier.icon
  const drillLink = DIM_LINKS[dim.key]
  const markerPct = Math.min(dim.percentile, 98)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * index }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-white">{dim.label}</p>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">{dim.description}</p>
          </div>
        </div>

        {/* Tier pill */}
        <div
          className={cn(
            'flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold',
            tier.color, tier.bg, tier.border
          )}
        >
          <TierIcon className="h-3 w-3" aria-hidden="true" />
          {tier.label}
        </div>
      </div>

      {/* Rank + value row */}
      <div className="flex items-center gap-4 mb-3">
        <div>
          <span className="text-xl font-mono font-bold text-white">
            #{fmtNum(dim.rank)}
          </span>
          <span className="text-xs font-mono text-surface-500 ml-1">
            / {fmtNum(dim.total)}
          </span>
        </div>
        <div className="h-5 w-px bg-surface-300" />
        <div>
          <span className={cn('text-xl font-mono font-bold', iconColor)}>
            {fmtNum(dim.value)}
          </span>
          <span className="text-xs font-mono text-surface-500 ml-1">{dim.unit}</span>
        </div>
        <div className="h-5 w-px bg-surface-300" />
        <div>
          <span className="text-sm font-mono font-bold text-white">{dim.percentile}</span>
          <span className="text-xs font-mono text-surface-500">th %ile</span>
        </div>
      </div>

      {/* Percentile track */}
      <div className="relative">
        <div className="flex justify-between text-[9px] font-mono text-surface-600 mb-1">
          <span>0th</span>
          <span>50th</span>
          <span>100th</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-surface-300 overflow-visible">
          {/* Tick marks */}
          <div className="absolute top-0 h-full w-px bg-surface-500/50" style={{ left: '50%' }} aria-hidden="true" />
          <div className="absolute top-0 h-full w-px bg-surface-500/30" style={{ left: '75%' }} aria-hidden="true" />
          <div className="absolute top-0 h-full w-px bg-surface-500/20" style={{ left: '90%' }} aria-hidden="true" />

          {/* Fill bar */}
          <motion.div
            initial={{ width: 0 }}
            animate={animate ? { width: `${markerPct}%` } : { width: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 * index + 0.2 }}
            className={cn('h-full rounded-full opacity-75', barColor)}
          />

          {/* Dot marker */}
          <motion.div
            initial={{ left: 0 }}
            animate={animate ? { left: `${markerPct}%` } : { left: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 * index + 0.2 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          >
            <div className={cn('h-4 w-4 rounded-full border-2 border-surface-100 shadow', barColor)} />
          </motion.div>
        </div>
      </div>

      {/* Drill link */}
      {drillLink && (
        <div className="mt-3 pt-3 border-t border-surface-300/50">
          <Link
            href={drillLink}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <BarChart2 className="h-3 w-3" aria-hidden="true" />
            Deep dive into {dim.label.toLowerCase()} analytics
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────

function QuickActions({ data }: { data: StandingResponse }) {
  const lowestDim = [...data.dimensions].sort((a, b) => a.percentile - b.percentile)[0]
  const highestDim = [...data.dimensions].sort((a, b) => b.percentile - a.percentile)[0]

  const suggestions: Array<{ label: string; href: string; icon: React.ElementType; color: string }> = []

  if (lowestDim?.key === 'arguments' || (data.dimensions.find(d => d.key === 'arguments')?.percentile ?? 100) < 50) {
    suggestions.push({ label: 'Write an argument', href: '/workshop', icon: MessageSquare, color: 'text-purple' })
  }
  if (lowestDim?.key === 'votes' || (data.dimensions.find(d => d.key === 'votes')?.percentile ?? 100) < 40) {
    suggestions.push({ label: 'Vote on topics', href: '/', icon: ThumbsUp, color: 'text-for-400' })
  }
  if (lowestDim?.key === 'streak') {
    suggestions.push({ label: 'Keep your streak', href: '/', icon: Flame, color: 'text-against-400' })
  }
  suggestions.push({ label: 'Full leaderboard', href: '/leaderboard', icon: Trophy, color: 'text-gold' })
  suggestions.push({ label: 'Cohort benchmark', href: '/analytics/benchmark', icon: Users, color: 'text-for-300' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Improve Your Standing
      </p>

      {lowestDim && (
        <div className="mb-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/60">
          <p className="text-xs font-mono text-surface-400">
            Your lowest dimension is{' '}
            <span className="text-white font-semibold">{lowestDim.label}</span>{' '}
            ({lowestDim.percentile}th percentile). Focus here to move up fastest.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {suggestions.slice(0, 4).map((s) => {
          const SIcon = s.icon
          return (
            <Link
              key={s.href + s.label}
              href={s.href}
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-mono font-medium transition-colors',
                'bg-surface-200/40 border-surface-300/60 text-surface-400',
                'hover:border-surface-400/60 hover:text-white'
              )}
            >
              <SIcon className={cn('h-3.5 w-3.5 flex-shrink-0', s.color)} aria-hidden="true" />
              {s.label}
            </Link>
          )
        })}
      </div>

      {highestDim && (
        <p className="text-[11px] font-mono text-surface-600 mt-3 text-center">
          Your strongest dimension:{' '}
          <Link href={DIM_LINKS[highestDim.key] ?? '/analytics'} className="text-emerald hover:underline">
            {highestDim.label} ({highestDim.percentile}th percentile)
          </Link>
        </p>
      )}
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StandingPage() {
  const router = useRouter()
  const [data, setData] = useState<StandingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [animate, setAnimate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnimate(false)
    try {
      const res = await fetch('/api/analytics/standing', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/login'); return }
      if (!res.ok) throw new Error('Failed to load standings')
      const json = (await res.json()) as StandingResponse
      setData(json)
      // Trigger animations after data arrives
      setTimeout(() => setAnimate(true), 80)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Analytics
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
            aria-label="Refresh standings"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Title */}
        <div className="mb-5">
          <h1 className="font-mono text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-gold" aria-hidden="true" />
            Civic Standing
          </h1>
          <p className="text-sm font-mono text-surface-500 mt-1">
            Your absolute platform rank across every civic dimension
          </p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StandingSkeleton />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Trophy}
                iconColor="text-against-400"
                iconBg="bg-against-500/10"
                iconBorder="border-against-500/20"
                title="Couldn't load standings"
                description={error}
                actions={[{ label: 'Try again', onClick: load }]}
              />
            </motion.div>
          )}

          {data && !loading && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Overall banner */}
              <OverallBanner data={data} animate={animate} />

              {/* Dimension breakdown */}
              <div>
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Dimension Breakdown
                </p>
                <div className="space-y-3">
                  {data.dimensions.map((dim, i) => (
                    <DimensionCard key={dim.key} dim={dim} index={i} animate={animate} />
                  ))}
                </div>
              </div>

              {/* Quick actions & suggestions */}
              <QuickActions data={data} />

              {/* Footer links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-3"
              >
                {[
                  { href: '/leaderboard', label: 'Full Leaderboard', icon: Trophy, color: 'text-gold' },
                  { href: '/analytics/benchmark', label: 'Cohort Benchmark', icon: Users, color: 'text-for-300' },
                  { href: '/analytics/growth', label: 'Growth Trends', icon: TrendingUp, color: 'text-emerald' },
                  { href: '/analytics/legacy', label: 'Civic Legacy', icon: Gavel, color: 'text-purple' },
                ].map((link) => {
                  const LIcon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'flex items-center gap-2.5 p-3.5 rounded-2xl border transition-colors',
                        'bg-surface-100 border-surface-300 hover:border-surface-400',
                        'text-sm font-mono font-medium text-surface-400 hover:text-white'
                      )}
                    >
                      <LIcon className={cn('h-4 w-4 flex-shrink-0', link.color)} aria-hidden="true" />
                      {link.label}
                      <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" aria-hidden="true" />
                    </Link>
                  )
                })}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
