'use client'

/**
 * /analytics/volatility — Civic Engagement Volatility
 *
 * Shows HOW CONSISTENTLY a user engages: burst voter vs steady citizen,
 * day-of-week preference, 90-day vote heatmap, and a stability score.
 *
 * Distinct from:
 *   /analytics/consistency  — streak-based voting consistency metric
 *   /analytics/drift        — gradual position change over time
 *   /analytics/momentum     — current directional trend
 *   /analytics/engagement   — raw engagement volume counts
 *   /analytics/streak       — streak timeline history
 *
 * Volatility measures the VARIANCE in engagement — the difference between
 * someone who votes every day vs. someone who disappears for a month then
 * votes 40 times in one session.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Calendar,
  ChevronRight,
  Flame,
  RefreshCw,
  Sunrise,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { VolatilityData, RhythmType, HeatmapDay, MonthPoint } from '@/app/api/analytics/volatility/route'

// ─── Rhythm config ────────────────────────────────────────────────────────────

const RHYTHM_CONFIG: Record<RhythmType, {
  label: string
  color: string
  bg: string
  border: string
  glow: string
  icon: typeof Zap
}> = {
  burst_voter: {
    label: 'Burst Voter',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-against-500/20',
    icon: Zap,
  },
  steady_citizen: {
    label: 'Steady Citizen',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-for-500/20',
    icon: Activity,
  },
  weekend_warrior: {
    label: 'Weekend Warrior',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'shadow-gold/20',
    icon: Flame,
  },
  daily_habit: {
    label: 'Daily Habit',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'shadow-emerald/20',
    icon: Sunrise,
  },
  dormant: {
    label: 'Getting Started',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    glow: '',
    icon: Activity,
  },
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function VoteHeatmap({ days }: { days: HeatmapDay[] }) {
  const max = Math.max(...days.map((d) => d.count), 1)

  function cellColor(count: number): string {
    if (count === 0) return 'bg-surface-300'
    const intensity = count / max
    if (intensity < 0.25) return 'bg-for-900'
    if (intensity < 0.5) return 'bg-for-700'
    if (intensity < 0.75) return 'bg-for-600'
    return 'bg-for-500'
  }

  // Arrange into weeks (cols)
  const weeks: HeatmapDay[][] = []
  let week: HeatmapDay[] = []
  // Pad start to Sunday
  const firstDow = new Date(days[0].date + 'T00:00:00Z').getUTCDay()
  for (let i = 0; i < firstDow; i++) week.push({ date: '', count: -1 })
  for (const day of days) {
    week.push(day)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length) {
    while (week.length < 7) week.push({ date: '', count: -1 })
    weeks.push(week)
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((wk, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {wk.map((day, di) => (
              <div
                key={di}
                title={day.date ? `${day.date}: ${day.count} vote${day.count === 1 ? '' : 's'}` : undefined}
                className={cn(
                  'w-[10px] h-[10px] rounded-[2px] transition-colors',
                  day.count < 0 ? 'invisible' : cellColor(day.count),
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[10px] text-surface-500 font-mono">Less</span>
        {['bg-surface-300', 'bg-for-900', 'bg-for-700', 'bg-for-600', 'bg-for-500'].map((c, i) => (
          <div key={i} className={cn('w-[10px] h-[10px] rounded-[2px]', c)} />
        ))}
        <span className="text-[10px] text-surface-500 font-mono">More</span>
      </div>
    </div>
  )
}

// ─── DOW bar chart ────────────────────────────────────────────────────────────

function DowChart({ distribution, preferred_day }: { distribution: number[]; preferred_day: string }) {
  const max = Math.max(...distribution, 1)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {distribution.map((count, i) => {
        const h = Math.round((count / max) * 100)
        const isTop = DOW_SHORT[i] === preferred_day?.slice(0, 3)
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={cn(
                  'w-full rounded-t-sm',
                  isTop ? 'bg-for-500' : 'bg-surface-300',
                )}
              />
            </div>
            <span className={cn('text-[9px] font-mono', isTop ? 'text-for-400' : 'text-surface-500')}>
              {DOW_SHORT[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Monthly trend ────────────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthPoint[] }) {
  const max = Math.max(...months.map((m) => m.count), 1)
  return (
    <div className="flex items-end gap-2 h-20">
      {months.map((m, i) => {
        const h = Math.round((m.count / max) * 100)
        const isLast = i === months.length - 1
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className={cn('w-full rounded-t-sm', isLast ? 'bg-for-500' : 'bg-surface-300')}
              />
            </div>
            <span className="text-[9px] font-mono text-surface-500 text-center leading-tight">
              {m.month.split(' ')[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stability dial (SVG arc) ─────────────────────────────────────────────────

function StabilityDial({ score }: { score: number }) {
  const r = 40
  const cx = 56
  const cy = 56
  const circ = 2 * Math.PI * r
  // Full arc = 270 degrees (from 135° to 405°/45°)
  const arc = (score / 100) * (circ * 0.75)
  const color =
    score >= 75 ? '#10b981'
    : score >= 50 ? '#3b82f6'
    : score >= 25 ? '#f59e0b'
    : '#ef4444'

  return (
    <svg width={112} height={100} viewBox="0 0 112 100">
      {/* Background track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#24242e"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={0}
        transform={`rotate(135 ${cx} ${cy})`}
      />
      {/* Filled arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeDashoffset={0}
        transform={`rotate(135 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      {/* Score text */}
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#fafafa" fontSize={20} fontWeight="bold" fontFamily="monospace">
        {score}
      </text>
    </svg>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-2xl font-bold font-mono tabular-nums', color)}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VolatilitySkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div>
          <Skeleton className="h-6 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VolatilityPage() {
  const router = useRouter()
  const [data, setData] = useState<VolatilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/volatility')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const rc = data ? RHYTHM_CONFIG[data.rhythm_type] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Engagement Volatility</h1>
            <p className="text-xs text-surface-500">When you vote and how consistent you are</p>
          </div>
          {!loading && (
            <button
              onClick={load}
              className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Loading state */}
        {loading && <VolatilitySkeleton />}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={Activity}
            title="Something went wrong"
            description="Could not load your volatility data. Please try again."
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* ── Rhythm type + stability dial ─────────────────────────── */}
              {rc && (
                <div className={cn(
                  'rounded-2xl border p-5',
                  rc.bg, rc.border,
                )}>
                  <div className="flex items-center gap-4">
                    <StabilityDial score={data.stability_score} />
                    <div className="flex-1 min-w-0">
                      <div className={cn('flex items-center gap-2 mb-1', rc.color)}>
                        <rc.icon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-lg font-bold">{data.rhythm_label}</span>
                      </div>
                      <p className="text-sm text-surface-600 leading-snug">{data.rhythm_desc}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Stability</span>
                          <span className={cn('text-lg font-bold font-mono', rc.color)}>
                            {data.stability_score}
                            <span className="text-xs font-normal text-surface-500">/100</span>
                          </span>
                        </div>
                        <div className="w-px h-8 bg-surface-300" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Volatility</span>
                          <span className="text-lg font-bold font-mono text-white">
                            {data.volatility_score}
                            <span className="text-xs font-normal text-surface-500">/100</span>
                          </span>
                        </div>
                        {data.cv > 0 && (
                          <>
                            <div className="w-px h-8 bg-surface-300" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">CV</span>
                              <span className="text-lg font-bold font-mono text-surface-600">{data.cv}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Key stats ────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <StatPill
                  label="Total Votes"
                  value={data.total_votes.toLocaleString()}
                  sub="all time"
                  color="text-for-400"
                />
                <StatPill
                  label="Active Days"
                  value={data.days_active}
                  sub={`avg ${data.avg_per_active_day} votes/day`}
                />
                <StatPill
                  label="Peak Day"
                  value={data.peak_day_votes}
                  sub="most votes in one day"
                  color="text-gold"
                />
                <StatPill
                  label="Longest Gap"
                  value={data.longest_gap_days === 0 ? '—' : `${data.longest_gap_days}d`}
                  sub="days without a vote"
                  color={data.longest_gap_days > 14 ? 'text-against-400' : 'text-white'}
                />
              </div>

              {/* ── Streak row ───────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-against-400" />
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Current Streak</p>
                    <p className="text-xl font-bold font-mono text-white">
                      {data.current_streak}
                      <span className="text-xs text-surface-500 ml-1">days</span>
                    </p>
                  </div>
                </div>
                <div className="w-px h-10 bg-surface-300" />
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald" />
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Best Streak</p>
                    <p className="text-xl font-bold font-mono text-white">
                      {data.longest_streak}
                      <span className="text-xs text-surface-500 ml-1">days</span>
                    </p>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Fav Day</p>
                  <p className="text-sm font-bold text-for-400">{data.preferred_day}</p>
                </div>
              </div>

              {/* ── Day-of-week chart ────────────────────────────────────── */}
              {data.total_votes >= 3 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-semibold text-white">Votes by Day of Week</h2>
                  </div>
                  <DowChart
                    distribution={data.dow_distribution}
                    preferred_day={data.preferred_day}
                  />
                </div>
              )}

              {/* ── 90-day heatmap ───────────────────────────────────────── */}
              {data.heatmap.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-semibold text-white">90-Day Activity</h2>
                  </div>
                  <VoteHeatmap days={data.heatmap} />
                </div>
              )}

              {/* ── Monthly trend ────────────────────────────────────────── */}
              {data.monthly.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-semibold text-white">Monthly Trend</h2>
                  </div>
                  <MonthlyChart months={data.monthly} />
                </div>
              )}

              {/* ── Navigation footer ────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Related Analytics</p>
                {[
                  { href: '/analytics/streak', label: 'Streak Timeline', desc: 'Full streak history' },
                  { href: '/analytics/consistency', label: 'Vote Consistency', desc: 'Streak-based scoring' },
                  { href: '/analytics/timing', label: 'Engagement Timing', desc: 'Peak times & patterns' },
                ].map(({ href, label, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between group hover:bg-surface-200 rounded-xl px-3 py-2 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-[11px] text-surface-500">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
