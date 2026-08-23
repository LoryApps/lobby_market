'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle,
  Flame,
  RefreshCw,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RetentionData, RetentionMonth } from '@/app/api/analytics/retention/route'

// ─── Monthly Heatmap ─────────────────────────────────────────────────────────

function MonthHeatmap({ grid }: { grid: RetentionMonth[] }) {
  const max = Math.max(...grid.map(c => c.vote_count), 1)

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {grid.map((cell) => {
          const intensity = cell.vote_count / max
          let bg: string
          if (!cell.is_active) {
            bg = 'bg-surface-300'
          } else if (intensity < 0.25) {
            bg = 'bg-for-500/30'
          } else if (intensity < 0.5) {
            bg = 'bg-for-500/55'
          } else if (intensity < 0.75) {
            bg = 'bg-for-500/80'
          } else {
            bg = 'bg-for-500'
          }

          return (
            <div
              key={cell.month_key}
              title={cell.is_active ? `${cell.month}: ${cell.vote_count} votes` : `${cell.month}: no votes`}
              className={cn(
                'relative h-8 rounded-md border transition-all group',
                cell.is_active ? 'border-for-500/40 cursor-pointer' : 'border-surface-300',
                bg,
              )}
              style={{ width: '3rem' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1.5 text-center whitespace-nowrap shadow-xl">
                  <p className="text-[10px] font-mono text-surface-500 mb-0.5">{cell.month}</p>
                  <p className="text-xs font-mono font-bold text-white">
                    {cell.is_active ? `${cell.vote_count} vote${cell.vote_count !== 1 ? 's' : ''}` : 'inactive'}
                  </p>
                </div>
                <div className="w-1.5 h-1.5 rotate-45 bg-surface-100 border-b border-r border-surface-300 -mt-[4px]" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] font-mono text-surface-500">Less</span>
        <div className="h-3 w-4 rounded-sm bg-surface-300" />
        <div className="h-3 w-4 rounded-sm bg-for-500/30" />
        <div className="h-3 w-4 rounded-sm bg-for-500/55" />
        <div className="h-3 w-4 rounded-sm bg-for-500/80" />
        <div className="h-3 w-4 rounded-sm bg-for-500" />
        <span className="text-[10px] font-mono text-surface-500">More</span>
      </div>
    </div>
  )
}

// ─── Retention Ring ───────────────────────────────────────────────────────────

function RetentionRing({ rate }: { rate: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (rate / 100) * circ
  const color = rate >= 80 ? '#3b82f6' : rate >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} strokeWidth="8" fill="none" className="stroke-surface-300" />
        <circle
          cx="56" cy="56" r={r} strokeWidth="8" fill="none"
          stroke={color}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-mono font-bold text-white">{rate}%</span>
        <span className="text-[10px] font-mono text-surface-500 leading-none">retained</span>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color = 'text-white', delay = 0,
}: {
  label: string; value: number | string; sub?: string
  icon: typeof TrendingUp; color?: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1"
    >
      <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className={cn('text-3xl font-bold font-mono', color)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-xs font-mono text-surface-500">{sub}</div>}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RetentionPage() {
  const router = useRouter()
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/retention', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as RetentionData)
    } catch {
      setError('Could not load retention data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const retentionLabel =
    data && data.retention_rate >= 80 ? 'Excellent'
    : data && data.retention_rate >= 60 ? 'Good'
    : data && data.retention_rate >= 40 ? 'Moderate'
    : data && data.retention_rate > 0  ? 'Low'
    : 'No data'

  const retentionColor =
    data && data.retention_rate >= 80 ? 'text-for-400'
    : data && data.retention_rate >= 60 ? 'text-emerald'
    : data && data.retention_rate >= 40 ? 'text-gold'
    : 'text-against-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Target className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white leading-none">Retention</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">How consistently you stay civically active</p>
          </div>
          <button
            onClick={load}
            aria-label="Refresh"
            className="ml-auto h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0,1,2,3].map(i => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-8 w-20 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-48 animate-pulse" />
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-40 animate-pulse" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load retention data"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && data && data.total_votes === 0 && (
          <EmptyState
            icon={Activity}
            title="No voting history yet"
            description="Cast your first vote to start tracking your civic retention."
            action={{ label: 'Browse topics', href: '/' }}
          />
        )}

        {!loading && data && data.total_votes > 0 && (
          <AnimatePresence mode="wait">
            <div className="space-y-5">

              {/* Retention score hero */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                  <Target className="h-3.5 w-3.5" />
                  Civic Retention Score
                </div>
                <div className="flex items-center gap-6">
                  <RetentionRing rate={data.retention_rate} />
                  <div className="flex-1">
                    <div className={cn('text-2xl font-mono font-bold mb-1', retentionColor)}>
                      {retentionLabel}
                    </div>
                    <p className="text-sm font-mono text-surface-400 leading-relaxed">
                      Active in{' '}
                      <span className="text-white font-semibold">{data.active_months}</span>
                      {' of '}
                      <span className="text-white font-semibold">{data.total_months}</span>
                      {' months since '}
                      <span className="text-white font-semibold">{data.joined_month}</span>
                    </p>
                    {data.last_active_month && (
                      <p className="text-xs font-mono text-surface-500 mt-1.5">
                        Last active: {data.last_active_month}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Top stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Votes"
                  value={data.total_votes}
                  sub="all time"
                  icon={CheckCircle}
                  color="text-for-400"
                  delay={0.05}
                />
                <StatCard
                  label="Active Months"
                  value={data.active_months}
                  sub={`of ${data.total_months} total`}
                  icon={Calendar}
                  color="text-emerald"
                  delay={0.1}
                />
                <StatCard
                  label="Current Streak"
                  value={data.current_streak}
                  sub={data.current_streak === 1 ? 'month' : 'months'}
                  icon={Flame}
                  color={data.current_streak >= 3 ? 'text-against-400' : 'text-surface-400'}
                  delay={0.15}
                />
                <StatCard
                  label="Best Streak"
                  value={data.best_streak}
                  sub={data.best_streak === 1 ? 'month' : 'months'}
                  icon={TrendingUp}
                  color="text-gold"
                  delay={0.2}
                />
              </div>

              {/* Heatmap */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Monthly activity — since {data.joined_month}
                </div>
                <MonthHeatmap grid={data.monthly_grid} />
              </motion.div>

              {/* Avg votes insight */}
              {data.avg_votes_per_active_month > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                    <Activity className="h-3.5 w-3.5" />
                    Engagement Depth
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-white">
                      {data.avg_votes_per_active_month}
                    </span>
                    <span className="text-sm font-mono text-surface-500">votes per active month</span>
                  </div>
                  {data.most_active_month && (
                    <p className="text-xs font-mono text-surface-500 mt-2">
                      Peak:{' '}
                      <span className="text-white">{data.most_active_month.vote_count} votes</span>
                      {' in '}
                      <span className="text-white">{data.most_active_month.month}</span>
                    </p>
                  )}
                </motion.div>
              )}

              {/* Streak insight */}
              {data.current_streak >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  className="rounded-2xl bg-against-500/5 border border-against-500/30 p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <Flame className="h-5 w-5 text-against-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-mono font-semibold text-white">
                        {data.current_streak}-month streak
                      </p>
                      <p className="text-xs font-mono text-against-400/70 mt-0.5">
                        You&apos;ve been civically active every month for {data.current_streak} months running.
                        {data.current_streak >= data.best_streak && ' That&apos;s your personal best!'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="flex flex-wrap gap-3"
              >
                <Link
                  href="/analytics"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <BarChart2 className="h-4 w-4" />
                  Analytics Hub
                </Link>
                <Link
                  href="/analytics/growth"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  Civic Growth
                </Link>
                <Link
                  href="/"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-500/20 border border-for-500/40 text-sm font-mono text-for-400 hover:bg-for-500/30 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  Vote now
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

            </div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
