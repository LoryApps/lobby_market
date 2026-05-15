'use client'

/**
 * /analytics/benchmark — Civic Benchmark Report
 *
 * Shows how the user's stats compare to their signup cohort — other citizens
 * who joined within 15 days of when the user registered.  Percentile rankings
 * across Clout, Votes Cast, Reputation, and Arguments give a clear picture of
 * where the user stands relative to peers who started at the same time.
 *
 * Distinct from:
 *   /leaderboard          — all-time all-platform ranking (join date irrelevant)
 *   /league               — monthly clout-sprint leaderboard
 *   /analytics/calibration — prediction accuracy grade (not relative to cohort)
 *   /karma                — composite civic credit score
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Crown,
  MessageSquare,
  RefreshCw,
  Shield,
  Star,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BenchmarkResponse, BenchmarkStat, CohortPeer } from '@/app/api/analytics/benchmark/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function percentileLabel(pct: number): { label: string; color: string; bg: string; border: string } {
  if (pct >= 95) return { label: 'Top 5%',   color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/40' }
  if (pct >= 90) return { label: 'Top 10%',  color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' }
  if (pct >= 75) return { label: 'Top 25%',  color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' }
  if (pct >= 50) return { label: 'Top 50%',  color: 'text-for-300',      bg: 'bg-for-500/10',      border: 'border-for-500/30' }
  if (pct >= 25) return { label: 'Top 75%',  color: 'text-surface-400',  bg: 'bg-surface-200',     border: 'border-surface-400/30' }
  return               { label: 'Bottom 25%',color: 'text-surface-500',  bg: 'bg-surface-200',     border: 'border-surface-400/20' }
}

function overallGrade(pct: number): { grade: string; label: string; color: string; bg: string; ring: string } {
  if (pct >= 95) return { grade: 'S',  label: 'Exceptional',   color: 'text-gold',        bg: 'bg-gold/10',        ring: 'ring-gold/40' }
  if (pct >= 85) return { grade: 'A+', label: 'Outstanding',   color: 'text-emerald',     bg: 'bg-emerald/10',     ring: 'ring-emerald/40' }
  if (pct >= 75) return { grade: 'A',  label: 'Excellent',     color: 'text-emerald',     bg: 'bg-emerald/10',     ring: 'ring-emerald/30' }
  if (pct >= 65) return { grade: 'B+', label: 'Above Average', color: 'text-for-300',     bg: 'bg-for-500/10',     ring: 'ring-for-500/30' }
  if (pct >= 55) return { grade: 'B',  label: 'Good',          color: 'text-for-400',     bg: 'bg-for-500/10',     ring: 'ring-for-500/20' }
  if (pct >= 45) return { grade: 'C+', label: 'Average',       color: 'text-gold',        bg: 'bg-gold/10',        ring: 'ring-gold/20' }
  if (pct >= 35) return { grade: 'C',  label: 'Moderate',      color: 'text-gold',        bg: 'bg-gold/10',        ring: 'ring-gold/15' }
  if (pct >= 25) return { grade: 'D',  label: 'Below Average', color: 'text-against-300', bg: 'bg-against-500/10', ring: 'ring-against-500/20' }
  return               { grade: 'F',  label: 'Getting started',color: 'text-against-400', bg: 'bg-against-600/10', ring: 'ring-against-500/20' }
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',       color: 'text-surface-400' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',         color: 'text-gold' },
}

const STAT_ICONS: Record<string, React.ElementType> = {
  clout:            TrendingUp,
  total_votes:      ThumbsUp,
  reputation_score: Star,
  total_arguments:  MessageSquare,
}

const STAT_COLORS: Record<string, string> = {
  clout:            'text-gold',
  total_votes:      'text-for-400',
  reputation_score: 'text-emerald',
  total_arguments:  'text-purple',
}

const STAT_BG: Record<string, string> = {
  clout:            'bg-gold/10 border-gold/20',
  total_votes:      'bg-for-500/10 border-for-500/20',
  reputation_score: 'bg-emerald/10 border-emerald/20',
  total_arguments:  'bg-purple/10 border-purple/20',
}

const STAT_BAR: Record<string, string> = {
  clout:            'bg-gold',
  total_votes:      'bg-for-500',
  reputation_score: 'bg-emerald',
  total_arguments:  'bg-purple',
}

// ─── Stat Benchmark Row ────────────────────────────────────────────────────────

function StatRow({ stat, animate }: { stat: BenchmarkStat; animate: boolean }) {
  const Icon = STAT_ICONS[stat.key] ?? BarChart2
  const iconColor = STAT_COLORS[stat.key] ?? 'text-surface-400'
  const iconBg = STAT_BG[stat.key] ?? 'bg-surface-300/20 border-surface-400/20'
  const barColor = STAT_BAR[stat.key] ?? 'bg-surface-500'
  const pill = percentileLabel(stat.percentile)

  // Position marker: percent along bar where user falls
  const markerPct = Math.min(stat.percentile, 98)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-white">{stat.label}</p>
            <p className={cn('text-xs font-mono font-bold', iconColor)}>
              {fmtNum(stat.value)}{stat.unit ? ` ${stat.unit}` : ''}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border',
            pill.color, pill.bg, pill.border
          )}
        >
          {pill.label}
        </span>
      </div>

      {/* Percentile bar */}
      <div className="relative">
        {/* Track labels */}
        <div className="flex justify-between text-[9px] font-mono text-surface-600 mb-1.5">
          <span>0th</span>
          <span>50th</span>
          <span>100th</span>
        </div>

        {/* Background track */}
        <div className="relative h-2.5 rounded-full bg-surface-300 overflow-visible">
          {/* Median tick */}
          <div
            className="absolute top-0 h-full w-px bg-surface-500/60"
            style={{ left: '50%' }}
            aria-hidden="true"
          />
          {/* p75 tick */}
          <div
            className="absolute top-0 h-full w-px bg-surface-500/40"
            style={{ left: '75%' }}
            aria-hidden="true"
          />
          {/* p90 tick */}
          <div
            className="absolute top-0 h-full w-px bg-surface-500/30"
            style={{ left: '90%' }}
            aria-hidden="true"
          />

          {/* Fill to user percentile */}
          <motion.div
            initial={{ width: 0 }}
            animate={animate ? { width: `${markerPct}%` } : { width: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            className={cn('h-full rounded-full opacity-70', barColor)}
          />

          {/* User marker dot */}
          <motion.div
            initial={{ left: 0 }}
            animate={animate ? { left: `${markerPct}%` } : { left: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          >
            <div className={cn('h-4 w-4 rounded-full border-2 border-surface-100 shadow-lg', barColor)} />
          </motion.div>
        </div>

        {/* Cohort comparisons */}
        <div className="flex items-center gap-4 mt-3">
          <div className="text-[10px] font-mono text-surface-500">
            Median cohort: <span className="text-white font-semibold">{fmtNum(stat.cohort_median)}</span>
          </div>
          <div className="text-[10px] font-mono text-surface-500">
            Top 25%: <span className="text-white font-semibold">{fmtNum(stat.cohort_p75)}</span>
          </div>
          <div className="text-[10px] font-mono text-surface-500">
            Top 10%: <span className="text-white font-semibold">{fmtNum(stat.cohort_p90)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Peer row ─────────────────────────────────────────────────────────────────

function PeerRow({ peer, isSelf }: { peer: CohortPeer; isSelf?: boolean }) {
  const roleConf = ROLE_CONFIG[peer.role] ?? { label: peer.role, color: 'text-surface-400' }
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <Link
      href={`/profile/${peer.username}`}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isSelf
          ? 'bg-gold/5 border-gold/30 hover:border-gold/50'
          : 'bg-surface-200/40 border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      <div className="flex-shrink-0 w-6 text-center text-xs font-mono font-bold text-surface-400">
        {medals[peer.rank] ?? `#${peer.rank}`}
      </div>
      <Avatar
        src={peer.avatar_url}
        fallback={peer.display_name || peer.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold truncate', isSelf ? 'text-gold' : 'text-white')}>
          {peer.display_name || peer.username}
          {isSelf && <span className="ml-1.5 text-[10px] text-gold/70">(you)</span>}
        </p>
        <p className={cn('text-[11px] font-mono truncate', roleConf.color)}>
          {roleConf.label}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-mono font-bold text-gold">{fmtNum(peer.clout)}</p>
        <p className="text-[10px] font-mono text-surface-500">clout</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-mono font-bold text-for-400">{fmtNum(peer.total_votes)}</p>
        <p className="text-[10px] font-mono text-surface-500">votes</p>
      </div>
    </Link>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BenchmarkSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-16 w-16 rounded-xl" />
        </div>
        <Skeleton className="h-3 w-56" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-2.5 rounded-full" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const router = useRouter()
  const [data, setData] = useState<BenchmarkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [animating, setAnimating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnimating(false)
    try {
      const res = await fetch('/api/analytics/benchmark', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load benchmark')
      const json = (await res.json()) as BenchmarkResponse
      setData(json)
      setTimeout(() => setAnimating(true), 100)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const grade = data ? overallGrade(data.overall_percentile) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-10 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors flex-shrink-0"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div>
            <h1 className="text-xl font-mono font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
              Civic Benchmark
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              How you compare to your signup cohort
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh benchmark"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <BenchmarkSkeleton />}

        {error && (
          <div className="rounded-2xl bg-against-950 border border-against-800 p-6 text-center">
            <p className="text-against-400 text-sm font-mono mb-3">{error}</p>
            <button
              onClick={load}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && !data && (
          <EmptyState
            icon={BarChart2}
            title="No benchmark data yet"
            description="Cast some votes and write arguments to generate your benchmark report."
            action={{ label: 'Go to Feed', href: '/' }}
          />
        )}

        {data && (
          <AnimatePresence>

            {/* Profile card + overall grade */}
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex items-center gap-4">
                <Avatar
                  src={data.user.avatar_url}
                  fallback={data.user.display_name || data.user.username}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-mono font-bold text-white truncate">
                    {data.user.display_name || data.user.username}
                  </p>
                  <p className={cn('text-xs font-mono', (ROLE_CONFIG[data.user.role] ?? ROLE_CONFIG.person).color)}>
                    {(ROLE_CONFIG[data.user.role] ?? ROLE_CONFIG.person).label}
                  </p>
                  <p className="text-[11px] text-surface-500 mt-1 font-mono">
                    Joined {fmtDate(data.user.joined_at)} · cohort of{' '}
                    <span className="text-white font-semibold">{data.cohort_size.toLocaleString()}</span> citizens
                    {data.cohort_size < 5 && (
                      <span className="ml-1 text-surface-600">(±{data.cohort_window_days}d window)</span>
                    )}
                  </p>
                </div>

                {/* Overall grade bubble */}
                {grade && (
                  <div
                    className={cn(
                      'flex-shrink-0 flex flex-col items-center justify-center',
                      'h-16 w-16 rounded-2xl border-2 ring-2',
                      grade.bg, grade.ring,
                      'border-surface-300'
                    )}
                    aria-label={`Overall grade: ${grade.grade} — ${grade.label}`}
                  >
                    <span className={cn('text-2xl font-mono font-extrabold leading-none', grade.color)}>
                      {grade.grade}
                    </span>
                    <span className={cn('text-[9px] font-mono uppercase tracking-wider mt-0.5', grade.color)}>
                      overall
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={animating ? { width: `${data.overall_percentile}%` } : { width: 0 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={cn(
                      'h-full rounded-full',
                      data.overall_percentile >= 90
                        ? 'bg-gradient-to-r from-gold to-gold/60'
                        : data.overall_percentile >= 75
                        ? 'bg-gradient-to-r from-emerald to-emerald/60'
                        : data.overall_percentile >= 50
                        ? 'bg-gradient-to-r from-for-500 to-for-400/60'
                        : 'bg-gradient-to-r from-surface-500 to-surface-400/60'
                    )}
                  />
                </div>
                <span className={cn('text-xs font-mono font-bold flex-shrink-0', grade?.color)}>
                  {data.overall_percentile}th percentile
                </span>
              </div>
              <p className="text-[11px] text-surface-500 mt-1.5 font-mono">
                {grade?.label} — you outperform{' '}
                <span className="text-white">{data.overall_percentile}%</span> of your cohort on average
              </p>
            </motion.div>

            {/* Stat breakdown */}
            <motion.div
              key="stats-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 px-1"
            >
              <BarChart2 className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-500">
                Metric Breakdown
              </span>
            </motion.div>

            {data.stats.map((stat, i) => (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <StatRow stat={stat} animate={animating} />
              </motion.div>
            ))}

            {/* Cohort leaderboard */}
            {data.top_peers.length > 0 && (
              <>
                <motion.div
                  key="peers-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-2 px-1 pt-2"
                >
                  <Users className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-500">
                    Top in Your Cohort
                  </span>
                  <span className="text-[10px] font-mono text-surface-600 ml-auto">
                    by clout
                  </span>
                </motion.div>

                <motion.div
                  key="peers"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2"
                >
                  {data.top_peers.map((peer) => (
                    <PeerRow
                      key={peer.username}
                      peer={peer}
                    />
                  ))}
                </motion.div>
              </>
            )}

            {/* Cohort explanation */}
            <motion.div
              key="cohort-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4"
            >
              <div className="flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                  Your <span className="text-white">cohort</span> is the{' '}
                  <span className="text-white">{data.cohort_size}</span> citizen{data.cohort_size !== 1 ? 's' : ''} who
                  joined within ±{data.cohort_window_days} days of you (
                  <span className="text-white">{fmtDate(data.user.joined_at)}</span>). Percentile rankings compare
                  your current stats to all cohort members regardless of activity level.
                </p>
              </div>
            </motion.div>

            {/* CTA links */}
            <motion.div
              key="ctas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="grid grid-cols-2 gap-3"
            >
              <Link
                href="/analytics"
                className="flex items-center gap-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 p-3.5 transition-colors group"
              >
                <BarChart2 className="h-4 w-4 text-surface-400 group-hover:text-white transition-colors flex-shrink-0" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  Analytics Hub
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors ml-auto" />
              </Link>
              <Link
                href="/leaderboard"
                className="flex items-center gap-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-gold/40 p-3.5 transition-colors group"
              >
                <Crown className="h-4 w-4 text-surface-400 group-hover:text-gold transition-colors flex-shrink-0" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-gold transition-colors">
                  Leaderboard
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-gold transition-colors ml-auto" />
              </Link>
            </motion.div>

          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
