'use client'

/**
 * /profile/[username]/growth — Civic Growth Chart
 *
 * Visualises how a citizen's civic engagement has grown since they joined:
 *   • Monthly activity bars (votes + arguments + debates)
 *   • Cumulative clout curve
 *   • Personal milestone timeline
 *   • Lifetime totals at a glance
 *
 * Distinct from:
 *   /profile/[username]/timeline  — individual events in chronological order
 *   /profile/[username]/analytics — not yet implemented
 *   /analytics                    — personal analytics dashboard (own user only)
 *   /civic-score                  — current standing, not historical growth
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { GrowthResponse, GrowthMonth, GrowthMilestone } from '@/app/api/profile/[username]/growth/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500' },
  debator:       { label: 'Debator',      color: 'text-for-400'     },
  troll_catcher: { label: 'Troll Catcher',color: 'text-emerald'     },
  elder:         { label: 'Elder',        color: 'text-gold'        },
}

const MILESTONE_ICONS: Record<GrowthMilestone['type'], typeof Vote> = {
  first_vote:     Vote,
  first_argument: MessageSquare,
  first_debate:   Mic,
  achievement:    Trophy,
  role_upgrade:   Sparkles,
  law_passed:     Gavel,
  streak:         Flame,
}

const MILESTONE_COLORS: Record<GrowthMilestone['type'], string> = {
  first_vote:     'text-for-400 bg-for-500/10 border-for-500/30',
  first_argument: 'text-purple bg-purple/10 border-purple/30',
  first_debate:   'text-emerald bg-emerald/10 border-emerald/25',
  achievement:    'text-gold bg-gold/10 border-gold/30',
  role_upgrade:   'text-purple bg-purple/10 border-purple/30',
  law_passed:     'text-gold bg-gold/10 border-gold/30',
  streak:         'text-against-400 bg-against-500/10 border-against-500/30',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function relativeTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}yr ago`
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function ActivityChart({
  months,
  visibleStart,
  visibleCount,
}: {
  months: GrowthMonth[]
  visibleStart: number
  visibleCount: number
}) {
  const visible = months.slice(visibleStart, visibleStart + visibleCount)
  const maxVal = Math.max(...visible.map((m) => m.votes + m.arguments + m.debates), 1)

  return (
    <div className="flex items-end gap-1 h-28 w-full">
      {visible.map((m) => {
        const total = m.votes + m.arguments + m.debates
        const heightPct = maxVal > 0 ? (total / maxVal) * 100 : 0
        const vPct = total > 0 ? (m.votes / total) * 100 : 0
        const aPct = total > 0 ? (m.arguments / total) * 100 : 0
        const dPct = total > 0 ? (m.debates / total) * 100 : 0

        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Bar */}
            <div className="relative w-full flex-1 flex items-end">
              {total > 0 ? (
                <div
                  className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse transition-all duration-300"
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                  title={`${m.month}: ${total} actions`}
                >
                  {/* Stacked segments: votes (blue) / arguments (purple) / debates (emerald) */}
                  <div className="bg-for-600/80" style={{ height: `${vPct}%` }} />
                  <div className="bg-purple/70" style={{ height: `${aPct}%` }} />
                  <div className="bg-emerald/70" style={{ height: `${dPct}%` }} />
                </div>
              ) : (
                <div className="w-full rounded-t-sm bg-surface-300/30" style={{ height: '2%' }} />
              )}
            </div>

            {/* Tooltip on hover */}
            {total > 0 && (
              <div className={cn(
                'absolute bottom-full mb-2 left-1/2 -translate-x-1/2',
                'bg-surface-200 border border-surface-300 rounded-lg px-2 py-1.5',
                'text-[10px] font-mono text-white whitespace-nowrap z-10',
                'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
                'shadow-lg'
              )}>
                <p className="font-semibold text-surface-600 mb-0.5">{monthLabel(m.month)}</p>
                {m.votes > 0 && <p className="text-for-400">{m.votes} votes</p>}
                {m.arguments > 0 && <p className="text-purple">{m.arguments} args</p>}
                {m.debates > 0 && <p className="text-emerald">{m.debates} debates</p>}
              </div>
            )}

            {/* Month label */}
            <span className="text-[9px] font-mono text-surface-500 rotate-0">
              {monthLabel(m.month).split(' ')[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Clout curve ─────────────────────────────────────────────────────────────

function CloutCurve({
  months,
  visibleStart,
  visibleCount,
}: {
  months: GrowthMonth[]
  visibleStart: number
  visibleCount: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const visible = months.slice(visibleStart, visibleStart + visibleCount)

  // Cumulative clout (absolute totals offset to visible window)
  const cumulativeFromStart = months
    .slice(0, visibleStart)
    .reduce((s, m) => s + m.clout_earned, 0)

  const cumulative = visible.map((_, i) => {
    return cumulativeFromStart + months
      .slice(visibleStart, visibleStart + i + 1)
      .reduce((s, m) => s + m.clout_earned, 0)
  })

  const maxClout = Math.max(...cumulative, 1)
  const W = 300
  const H = 60

  const points = cumulative.map((c, i) => {
    const x = visible.length <= 1 ? W / 2 : (i / (visible.length - 1)) * W
    const y = H - (c / maxClout) * (H - 4) - 2
    return [x, y] as [number, number]
  })

  if (points.length < 2) return null

  const d = points
    .map(([x, y], i) =>
      i === 0
        ? `M ${x} ${y}`
        : `L ${x} ${y}`
    )
    .join(' ')

  const area = `${d} L ${points[points.length - 1][0]} ${H} L ${points[0][0]} ${H} Z`

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-12"
      aria-label="Clout growth curve"
    >
      <defs>
        <linearGradient id="cloutGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cloutGrad)" />
      <path d={d} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function MilestoneRow({ milestone }: { milestone: GrowthMilestone }) {
  const Icon = MILESTONE_ICONS[milestone.type] ?? Award
  const colorClass = MILESTONE_COLORS[milestone.type] ?? 'text-surface-500 bg-surface-200 border-surface-300'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3"
    >
      <div className={cn('flex-shrink-0 h-7 w-7 rounded-lg border flex items-center justify-center mt-0.5', colorClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-white leading-tight">{milestone.label}</p>
        {milestone.detail && (
          <p className="text-[11px] font-mono text-surface-500 mt-0.5 capitalize">{milestone.detail}</p>
        )}
      </div>
      <span className="text-[11px] font-mono text-surface-500 flex-shrink-0 mt-0.5">
        {relativeTime(milestone.occurred_at)}
      </span>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileGrowthPage() {
  const params = useParams()
  const router = useRouter()
  const username = typeof params.username === 'string' ? params.username : ''

  const [data, setData] = useState<GrowthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Windowed chart view
  const VISIBLE = 12
  const [windowStart, setWindowStart] = useState(0)

  const load = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/growth`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Failed to load')
      }
      const json = (await res.json()) as GrowthResponse
      setData(json)
      // Start at the most recent window
      const total = json.monthly.length
      setWindowStart(Math.max(0, total - VISIBLE))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading growth data')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  const months = data?.monthly ?? []
  const canPrev = windowStart > 0
  const canNext = windowStart + VISIBLE < months.length

  const roleInfo = data ? (ROLE_LABELS[data.profile.role] ?? ROLE_LABELS.person) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 md:pb-12">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-surface-400 text-xs font-mono">·</span>
          <Link
            href={`/profile/${username}`}
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            @{username}
          </Link>
          <span className="text-surface-400 text-xs font-mono">·</span>
          <span className="text-sm font-mono text-for-400">Growth</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/25">
            <TrendingUp className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Civic Growth</h1>
            {data && (
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                @{data.profile.username}
                {data.profile.display_name && ` · ${data.profile.display_name}`}
              </p>
            )}
          </div>
          {data && (
            <div className="ml-auto">
              <Avatar
                src={data.profile.avatar_url}
                fallback={data.profile.display_name ?? data.profile.username}
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={<BarChart2 className="h-8 w-8 text-surface-500" />}
            title="Couldn't load growth data"
            description={error}
            action={
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        )}

        {/* Content */}
        {!loading && data && (
          <div className="space-y-4">

            {/* Role + join info */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-center gap-4">
              <Avatar
                src={data.profile.avatar_url}
                fallback={data.profile.display_name ?? data.profile.username}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-white font-bold truncate">
                  {data.profile.display_name ?? data.profile.username}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {roleInfo && (
                    <span className={cn('text-xs font-mono font-semibold', roleInfo.color)}>
                      {roleInfo.label}
                    </span>
                  )}
                  <span className="text-surface-500 text-xs font-mono">·</span>
                  <span className="text-surface-500 text-xs font-mono">
                    Member since {new Date(data.profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <Link
                href={`/profile/${data.profile.username}`}
                className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
                aria-label="View full profile"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Lifetime totals */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                Lifetime Totals
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Votes cast', value: data.totals.votes, icon: Vote, color: 'text-for-400' },
                  { label: 'Arguments', value: data.totals.arguments, icon: MessageSquare, color: 'text-purple' },
                  { label: 'Debates', value: data.totals.debates, icon: Mic, color: 'text-emerald' },
                  { label: 'Clout earned', value: data.totals.clout_earned, icon: Coins, color: 'text-gold' },
                  { label: 'Achievements', value: data.totals.achievements_earned, icon: Trophy, color: 'text-gold' },
                  { label: 'Days active', value: data.totals.days_active, icon: CalendarDays, color: 'text-for-300' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={cn('h-3.5 w-3.5', color)} />
                      <span className="text-[11px] font-mono text-surface-500">{label}</span>
                    </div>
                    <p className={cn('text-2xl font-mono font-bold', color)}>
                      <AnimatedNumber value={value} />
                    </p>
                  </div>
                ))}
              </div>

              {/* Current standing */}
              <div className="mt-3 pt-3 border-t border-surface-300/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Clout</p>
                    <p className="text-base font-mono font-bold text-gold">
                      <AnimatedNumber value={data.profile.clout} />
                    </p>
                  </div>
                  <div className="h-8 w-px bg-surface-300/60" />
                  <div className="text-center">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Rep Score</p>
                    <p className="text-base font-mono font-bold text-emerald">
                      <AnimatedNumber value={data.profile.reputation_score} />
                    </p>
                  </div>
                  <div className="h-8 w-px bg-surface-300/60" />
                  <div className="text-center">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Streak</p>
                    <p className="text-base font-mono font-bold text-against-400">
                      <AnimatedNumber value={data.profile.vote_streak} />d
                    </p>
                  </div>
                </div>
                <Link
                  href={`/civic-score`}
                  className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  Score details
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>

            {/* Monthly activity chart */}
            {months.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Monthly Activity
                  </h2>
                  {months.length > VISIBLE && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setWindowStart((w) => Math.max(0, w - VISIBLE))}
                        disabled={!canPrev}
                        aria-label="Earlier months"
                        className="h-6 w-6 rounded flex items-center justify-center text-surface-500 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-[10px] font-mono text-surface-500">
                        {monthLabel(months[windowStart]?.month ?? '')} – {monthLabel(months[Math.min(windowStart + VISIBLE - 1, months.length - 1)]?.month ?? '')}
                      </span>
                      <button
                        onClick={() => setWindowStart((w) => Math.min(months.length - VISIBLE, w + VISIBLE))}
                        disabled={!canNext}
                        aria-label="Later months"
                        className="h-6 w-6 rounded flex items-center justify-center text-surface-500 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 mb-3">
                  {[
                    { color: 'bg-for-600/80', label: 'Votes' },
                    { color: 'bg-purple/70', label: 'Arguments' },
                    { color: 'bg-emerald/70', label: 'Debates' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className={cn('h-2 w-2 rounded-sm', color)} />
                      <span className="text-[10px] font-mono text-surface-500">{label}</span>
                    </div>
                  ))}
                </div>

                <ActivityChart
                  months={months}
                  visibleStart={windowStart}
                  visibleCount={VISIBLE}
                />
              </div>
            )}

            {/* Clout growth curve */}
            {months.some((m) => m.clout_earned > 0) && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Clout Growth
                </h2>
                <CloutCurve
                  months={months}
                  visibleStart={windowStart}
                  visibleCount={VISIBLE}
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-mono text-surface-500">
                    {monthLabel(months[windowStart]?.month ?? '')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-gold" />
                    <span className="text-[11px] font-mono text-gold font-semibold">
                      +{data.totals.clout_earned.toLocaleString()} total earned
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500">
                    {monthLabel(months[months.length - 1]?.month ?? '')}
                  </span>
                </div>
              </div>
            )}

            {/* Milestones */}
            {data.milestones.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4">
                  Civic Milestones
                </h2>
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {data.milestones.map((m, i) => (
                      <MilestoneRow key={`${m.type}-${i}`} milestone={m} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Empty state: not enough data yet */}
            {data.totals.votes === 0 && data.totals.arguments === 0 && (
              <EmptyState
                icon={<TrendingUp className="h-8 w-8 text-surface-500" />}
                title="No civic activity yet"
                description={
                  data.isOwnProfile
                    ? "Start voting and debating to see your growth chart."
                    : `@${data.profile.username} hasn't cast any votes yet.`
                }
                action={
                  data.isOwnProfile ? (
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors"
                    >
                      <Vote className="h-3.5 w-3.5" />
                      Go vote
                    </Link>
                  ) : undefined
                }
              />
            )}

            {/* Navigation links */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                More Profile Views
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/profile/${username}/timeline`,    label: 'Timeline',     icon: CalendarDays },
                  { href: `/profile/${username}/achievements`,label: 'Achievements',  icon: Trophy        },
                  { href: `/profile/${username}/impact`,      label: 'Impact',       icon: Zap           },
                  { href: `/profile/${username}/debates`,     label: 'Debates',      icon: Mic           },
                  { href: `/profile/${username}/arguments`,   label: 'Arguments',    icon: MessageSquare },
                  { href: `/profile/${username}/votes`,       label: 'Votes',        icon: ThumbsUp      },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl',
                      'border border-surface-300/60 bg-surface-200/40',
                      'hover:border-surface-400/60 hover:bg-surface-200/70 transition-colors',
                      'text-sm font-mono text-surface-600 hover:text-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
