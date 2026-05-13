'use client'

/**
 * /analytics/growth — Civic Activity Growth Tracker
 *
 * Shows how your civic engagement has evolved over time:
 *   • 14-month stacked bar chart (votes, arguments, debates, achievements)
 *   • Momentum indicator — recent 30d vs prior 30d
 *   • Personal activity records (best month, best month for votes/arguments)
 *   • Milestone timeline — first vote, 100th vote, first argument, etc.
 *   • Days active on the platform
 *
 * Complements /analytics (snapshot stats), /analytics/evolution (opinion drift),
 * and /analytics/votes (raw history). This is the bird's-eye growth view.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Calendar,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GrowthData, MonthlyActivityPoint, GrowthMilestone } from '@/app/api/analytics/growth/route'

// ─── Stacked Bar Chart ────────────────────────────────────────────────────────

const CHART_HEIGHT = 140
type BarSegment = { key: keyof MonthlyActivityPoint; color: string; label: string }
const SEGMENTS: BarSegment[] = [
  { key: 'votes',        color: '#3b82f6', label: 'Votes'        },  // for-500
  { key: 'arguments',    color: '#8b5cf6', label: 'Arguments'    },  // purple
  { key: 'debates',      color: '#10b981', label: 'Debates'      },  // emerald
  { key: 'achievements', color: '#f59e0b', label: 'Achievements' },  // gold
]

function StackedBarChart({ data }: { data: MonthlyActivityPoint[] }) {
  const maxTotal = Math.max(...data.map(d => d.total), 1)

  return (
    <div className="w-full">
      {/* Bars */}
      <div className="flex items-end gap-[3px] h-[140px]">
        {data.map((point) => {
          return (
            <div
              key={point.month_key}
              title={`${point.month}: ${point.total} actions`}
              className="flex-1 flex flex-col-reverse items-stretch relative group"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1.5 text-center whitespace-nowrap shadow-xl">
                  <p className="text-[10px] font-mono text-surface-500 mb-0.5">{point.month}</p>
                  <p className="text-xs font-mono font-bold text-white">{point.total} actions</p>
                  {point.votes > 0 && <p className="text-[10px] font-mono text-for-400">{point.votes}v</p>}
                  {point.arguments > 0 && <p className="text-[10px] font-mono text-purple">{point.arguments}a</p>}
                  {point.debates > 0 && <p className="text-[10px] font-mono text-emerald">{point.debates}d</p>}
                  {point.achievements > 0 && <p className="text-[10px] font-mono text-gold">{point.achievements}🏆</p>}
                </div>
                <div className="w-1.5 h-1.5 rotate-45 bg-surface-100 border-b border-r border-surface-300 -mt-[4px]" />
              </div>

              {/* Stacked segments (rendered bottom to top) */}
              {SEGMENTS.map(seg => {
                const val = point[seg.key] as number
                if (val === 0) return null
                const h = (val / maxTotal) * CHART_HEIGHT
                return (
                  <div
                    key={seg.key}
                    style={{ height: `${h}px`, backgroundColor: seg.color }}
                    className="w-full rounded-[2px] opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                )
              })}

              {/* Empty bar floor */}
              {point.total === 0 && (
                <div className="w-full h-[2px] bg-surface-300 rounded-full self-end" />
              )}
            </div>
          )
        })}
      </div>

      {/* Month labels (every 2nd to avoid crowding) */}
      <div className="flex items-start gap-[3px] mt-1.5">
        {data.map((point, i) => (
          <div key={point.month_key} className="flex-1 flex items-center justify-center">
            {i % 2 === 0 && (
              <span className="text-[9px] font-mono text-surface-500 leading-none text-center">
                {point.month.split(' ')[0]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {SEGMENTS.map(seg => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <div className="h-2 w-3 rounded-[2px]" style={{ backgroundColor: seg.color, opacity: 0.8 }} />
            <span className="text-[10px] font-mono text-surface-500">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Momentum Badge ──────────────────────────────────────────────────────────

function MomentumBadge({ pct, isSurging, recent, prior }: {
  pct: number | null
  isSurging: boolean
  recent: number
  prior: number
}) {
  if (pct === null) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
        <Activity className="h-3.5 w-3.5" />
        Building baseline data
      </div>
    )
  }

  const isUp = pct >= 0
  const label = Math.abs(pct)

  return (
    <div className={cn(
      'flex items-center gap-2 text-sm font-mono font-semibold',
      isSurging ? 'text-emerald' : pct < -20 ? 'text-against-400' : 'text-surface-400'
    )}>
      {isUp
        ? <TrendingUp className="h-4 w-4" />
        : <TrendingDown className="h-4 w-4" />}
      <span>{isUp ? '+' : '-'}{label}% vs prev. 30 days</span>
      <span className="text-[10px] font-mono text-surface-500 font-normal">
        ({recent} vs {prior})
      </span>
    </div>
  )
}

// ─── Milestone Icon ───────────────────────────────────────────────────────────

const MILESTONE_ICONS: Record<GrowthMilestone['category'], React.ElementType> = {
  vote:        ThumbsUp,
  argument:    MessageSquare,
  law:         Gavel,
  streak:      Flame,
  achievement: Award,
  debate:      Mic,
}
const MILESTONE_COLORS: Record<GrowthMilestone['category'], string> = {
  vote:        'text-for-400 bg-for-500/10 border-for-500/30',
  argument:    'text-purple bg-purple/10 border-purple/30',
  law:         'text-gold bg-gold/10 border-gold/30',
  streak:      'text-against-400 bg-against-500/10 border-against-500/30',
  achievement: 'text-gold bg-gold/10 border-gold/30',
  debate:      'text-emerald bg-emerald/10 border-emerald/30',
}

function MilestoneRow({ m }: { m: GrowthMilestone }) {
  const Icon = MILESTONE_ICONS[m.category]
  const colors = MILESTONE_COLORS[m.category]
  const [iconCls, bgCls, borderCls] = colors.split(' ')

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3"
    >
      <div className={cn('flex-shrink-0 h-7 w-7 rounded-full border flex items-center justify-center', bgCls, borderCls)}>
        <Icon className={cn('h-3.5 w-3.5', iconCls)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white leading-snug">{m.label}</p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">
          {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </motion.div>
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

export default function GrowthPage() {
  const router = useRouter()
  const [data, setData] = useState<GrowthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/analytics/growth', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as GrowthData)
    } catch {
      setError('Could not load growth data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

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
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white leading-none">Civic Growth</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Your engagement trajectory over time</p>
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
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-48">
              <Skeleton className="h-4 w-36 mb-6" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load growth data"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && data && (
          <AnimatePresence mode="wait">
            <div className="space-y-5">

              {/* Top stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Votes"
                  value={data.total_votes}
                  sub="all time"
                  icon={ThumbsUp}
                  color="text-for-400"
                  delay={0}
                />
                <StatCard
                  label="Arguments"
                  value={data.total_arguments}
                  sub="all time"
                  icon={MessageSquare}
                  color="text-purple"
                  delay={0.05}
                />
                <StatCard
                  label="Active Months"
                  value={data.total_active_months}
                  sub="last 14 months"
                  icon={Calendar}
                  color="text-emerald"
                  delay={0.1}
                />
                <StatCard
                  label="Days Active"
                  value={data.days_since_first ?? 0}
                  sub={data.first_activity_date
                    ? `since ${new Date(data.first_activity_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                    : 'on Lobby Market'}
                  icon={Star}
                  color="text-gold"
                  delay={0.15}
                />
              </div>

              {/* Momentum card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className={cn(
                  'rounded-2xl border p-5',
                  data.is_surging
                    ? 'bg-emerald/5 border-emerald/30'
                    : (data.momentum_pct ?? 0) < -20
                      ? 'bg-against-500/5 border-against-500/30'
                      : 'bg-surface-100 border-surface-300'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                  <Rocket className="h-3.5 w-3.5" />
                  Momentum
                </div>
                <MomentumBadge
                  pct={data.momentum_pct}
                  isSurging={data.is_surging}
                  recent={data.recent_30_total}
                  prior={data.prior_30_total}
                />
                {data.is_surging && (
                  <p className="text-xs font-mono text-emerald/70 mt-2">
                    You&apos;re on a civic upswing — keep the momentum going!
                  </p>
                )}
                {!data.is_surging && (data.momentum_pct ?? 0) < -20 && (
                  <p className="text-xs font-mono text-against-400/70 mt-2">
                    Your engagement has dipped — the Lobby needs your voice.
                  </p>
                )}
              </motion.div>

              {/* Monthly activity chart */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Activity — last 14 months
                  </div>
                </div>
                <StackedBarChart data={data.monthly_activity} />
              </motion.div>

              {/* Personal records */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                  <Award className="h-3.5 w-3.5" />
                  Personal Records
                </div>
                {data.best_month || data.best_month_votes || data.best_month_arguments ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {data.best_month && (
                      <div className="rounded-xl bg-emerald/5 border border-emerald/20 p-3">
                        <p className="text-[10px] font-mono text-emerald uppercase tracking-wider mb-1">Best Month Overall</p>
                        <p className="text-lg font-mono font-bold text-white">{data.best_month.total}</p>
                        <p className="text-xs font-mono text-surface-500">{data.best_month.month}</p>
                      </div>
                    )}
                    {data.best_month_votes && (
                      <div className="rounded-xl bg-for-500/5 border border-for-500/20 p-3">
                        <p className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-1">Most Votes in a Month</p>
                        <p className="text-lg font-mono font-bold text-white">{data.best_month_votes.count}</p>
                        <p className="text-xs font-mono text-surface-500">{data.best_month_votes.month}</p>
                      </div>
                    )}
                    {data.best_month_arguments && (
                      <div className="rounded-xl bg-purple/5 border border-purple/20 p-3">
                        <p className="text-[10px] font-mono text-purple uppercase tracking-wider mb-1">Most Arguments in a Month</p>
                        <p className="text-lg font-mono font-bold text-white">{data.best_month_arguments.count}</p>
                        <p className="text-xs font-mono text-surface-500">{data.best_month_arguments.month}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-mono text-surface-500">Cast your first vote to start building your record.</p>
                )}
              </motion.div>

              {/* Milestone timeline */}
              {data.milestones.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Sparkles className="h-3.5 w-3.5" />
                    Civic Milestones
                  </div>
                  <div className="relative pl-4">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[13px] top-3 bottom-3 w-px bg-surface-300" aria-hidden="true" />
                    <div className="space-y-4">
                      {data.milestones.slice().reverse().map((m, i) => (
                        <MilestoneRow key={`${m.label}-${i}`} m={m} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {data.milestones.length === 0 && !loading && (
                <EmptyState
                  icon={Zap}
                  title="No milestones yet"
                  description="Vote on topics, write arguments, and join debates to build your civic timeline."
                  action={{ label: 'Browse the feed', href: '/' }}
                />
              )}

              {/* CTA */}
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
                  href="/analytics/evolution"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Activity className="h-4 w-4" />
                  Opinion Evolution
                </Link>
                <Link
                  href="/"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald/20 border border-emerald/40 text-sm font-mono text-emerald hover:bg-emerald/30 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  Cast votes
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
