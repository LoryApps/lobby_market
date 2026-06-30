'use client'

/**
 * /topic/[id]/intelligence — Debate Intelligence Report
 *
 * A power-user synthesis page that aggregates all available signals for a
 * single topic into one analyst-style report:
 *   • Composite Intel Score (0–100)
 *   • Law probability forecast with signal breakdown
 *   • Elite vs. grassroots vote divergence
 *   • Role distribution analysis
 *   • Top contributors (for + against)
 *   • Similar resolved debates
 *   • Trajectory verdict
 *
 * Distinct from:
 *   /stats       — raw numbers only
 *   /forecast    — probability model only
 *   /pressure    — social pressure only
 *   /archetypes  — voter personality types
 *   /brief       — lightweight summary
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  Crown,
  ExternalLink,
  Gavel,
  Info,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ForecastResponse, ForecastSignal } from '@/app/api/topics/[id]/forecast/route'
import type { TopicStatsResponse } from '@/app/api/topics/[id]/stats/route'
import type {
  ContributorsResponse,
  TopicContributor,
} from '@/app/api/topics/[id]/contributors/route'
import type {
  PressureResponse as PressureAPIResponse,
} from '@/app/api/topics/[id]/pressure/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type PressureResponse = PressureAPIResponse

interface IntelData {
  forecast: ForecastResponse
  stats: TopicStatsResponse
  contributors: ContributorsResponse
  pressure: PressureResponse | null
}

interface Props {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  topicForPct: number
  topicTotalVotes: number
  topicCreatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'Law',
  failed:   'Failed',
}

const ROLE_ICON: Record<string, typeof Users> = {
  elder:         Crown,
  troll_catcher: Shield,
  debator:       Swords,
  person:        Users,
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elders',
  troll_catcher: 'Troll Catchers',
  debator:       'Debators',
  person:        'Citizens',
}

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  troll_catcher: 'text-emerald',
  debator:       'text-for-300',
  person:        'text-surface-400',
}

function probabilityColor(p: number) {
  if (p >= 70) return { text: 'text-emerald', bar: 'bg-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (p >= 50) return { text: 'text-for-400', bar: 'bg-for-500', bg: 'bg-for-500/10 border-for-500/30' }
  if (p >= 30) return { text: 'text-gold', bar: 'bg-gold', bg: 'bg-gold/10 border-gold/30' }
  return { text: 'text-against-400', bar: 'bg-against-500', bg: 'bg-against-500/10 border-against-500/30' }
}

function signalDirection(signal: ForecastSignal) {
  if (signal.direction === 'positive') return { icon: TrendingUp, color: 'text-emerald', bg: 'bg-emerald/10' }
  if (signal.direction === 'negative') return { icon: TrendingDown, color: 'text-against-400', bg: 'bg-against-500/10' }
  return { icon: BarChart2, color: 'text-surface-400', bg: 'bg-surface-300/30' }
}

function intelScore(forecast: ForecastResponse, stats: TopicStatsResponse): number {
  const votes = Math.min(stats.totalVotes / 1000, 1) * 20
  const engagement = Math.min((stats.votesLast7d ?? 0) / 200, 1) * 20
  const signals = forecast.signals.reduce((acc, s) => acc + Math.abs(s.score), 0)
  const signalStrength = Math.min(signals / 10, 1) * 30
  const confidence = forecast.confidence === 'high' ? 30 : forecast.confidence === 'medium' ? 15 : 5
  return Math.round(Math.min(votes + engagement + signalStrength + confidence, 100))
}

function intelScoreLabel(score: number): string {
  if (score >= 80) return 'Rich Intelligence'
  if (score >= 60) return 'Strong Intelligence'
  if (score >= 40) return 'Moderate Intelligence'
  if (score >= 20) return 'Limited Intelligence'
  return 'Sparse Data'
}

function intelScoreColor(score: number) {
  if (score >= 80) return { text: 'text-emerald', bar: 'bg-emerald', ring: 'ring-emerald/30' }
  if (score >= 60) return { text: 'text-for-400', bar: 'bg-for-500', ring: 'ring-for-500/30' }
  if (score >= 40) return { text: 'text-gold', bar: 'bg-gold', ring: 'ring-gold/30' }
  return { text: 'text-surface-500', bar: 'bg-surface-400', ring: 'ring-surface-400/30' }
}

function verdictText(forecast: ForecastResponse, eliteDelta: number | null): string {
  const { law_probability: p, topic } = forecast
  if (topic.status === 'law') return 'This debate has resolved — consensus reached law status.'
  if (topic.status === 'failed') return 'This debate failed to reach consensus.'

  const direction = eliteDelta !== null && Math.abs(eliteDelta) > 5
    ? eliteDelta > 0
      ? 'High-reputation users are pulling FOR, giving this debate elite tailwind.'
      : 'High-reputation users lean AGAINST, creating grassroots vs. elite tension.'
    : 'Elite and grassroots voters are broadly aligned on this debate.'

  if (p >= 75) return `Strong consensus forming. ${direction} Passage looks likely.`
  if (p >= 55) return `Leaning toward passage. ${direction} The outcome remains competitive.`
  if (p >= 40) return `Too close to call. ${direction} A few hundred votes could shift this either way.`
  if (p >= 20) return `Resistance is substantial. ${direction} This debate needs a momentum shift to survive.`
  return `Consensus is elusive. ${direction} This topic faces an uphill battle.`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full max-w-lg" />
        <div className="flex gap-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[0,1].map(i => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            {[0,1,2].map(j => <Skeleton key={j} className="h-10 w-full rounded-xl" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function SplitBar({ forPct, size = 'md' }: { forPct: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className={cn('w-full rounded-full bg-surface-300 overflow-hidden', h)}>
      <div
        className="h-full bg-gradient-to-r from-for-500 to-for-400 rounded-full"
        style={{ width: `${Math.round(forPct)}%` }}
      />
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: typeof Brain
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center">
        <Icon className="w-4 h-4 text-surface-500" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IntelligenceClient({
  topicId,
  topicStatement,
  topicCategory,
  topicStatus,
  topicForPct,
  topicTotalVotes,
  topicCreatedAt: _topicCreatedAt,
}: Props) {
  const [data, setData] = useState<IntelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      const [forecastRes, statsRes, contributorsRes, pressureRes] = await Promise.all([
        fetch(`/api/topics/${topicId}/forecast`, { cache: 'no-store' }),
        fetch(`/api/topics/${topicId}/stats`, { cache: 'no-store' }),
        fetch(`/api/topics/${topicId}/contributors`, { cache: 'no-store' }),
        fetch(`/api/topics/${topicId}/pressure`, { cache: 'no-store' }),
      ])

      if (!forecastRes.ok || !statsRes.ok) throw new Error('Failed to load intelligence data')

      const [forecast, stats, contributors, pressure] = await Promise.all([
        forecastRes.json() as Promise<ForecastResponse>,
        statsRes.json() as Promise<TopicStatsResponse>,
        contributorsRes.ok ? (contributorsRes.json() as Promise<ContributorsResponse>) : Promise.resolve({ contributors: [], total_arguments: 0 }),
        pressureRes.ok ? (pressureRes.json() as Promise<PressureResponse>) : Promise.resolve(null),
      ])

      setData({ forecast, stats, contributors, pressure })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const score = data ? intelScore(data.forecast, data.stats) : 0
  const scoreColors = intelScoreColor(score)
  const probColors = data ? probabilityColor(data.forecast.law_probability) : null
  const eliteDelta = data?.pressure?.cloutWeighted?.eliteInfluenceDelta ?? null
  const roleBreakdown = data?.pressure?.roleBreakdown ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to debate
        </Link>

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple flex-shrink-0" />
                <span className="text-xs font-mono text-purple uppercase tracking-wider">Intelligence Report</span>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-white leading-snug mb-3">
                {topicStatement}
              </h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_BADGE[topicStatus] ?? 'proposed'}>
                  {STATUS_LABEL[topicStatus] ?? topicStatus}
                </Badge>
                {topicCategory && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-300/50 text-surface-500 border border-surface-400/30">
                    {topicCategory}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-300/50 text-surface-500 border border-surface-400/30">
                  <Users className="w-3 h-3" />
                  {topicTotalVotes.toLocaleString()} votes
                </span>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex-shrink-0 p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Vote split */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-for-400">FOR {Math.round(topicForPct)}%</span>
              <span className="text-against-400">AGAINST {Math.round(100 - topicForPct)}%</span>
            </div>
            <SplitBar forPct={topicForPct} />
          </div>
        </div>

        {loading && <ReportSkeleton />}

        {error && (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-against-400 mx-auto" />
            <p className="text-sm text-surface-400">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 text-sm text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Intel Score + Law Probability */}
            <div className="grid grid-cols-2 gap-3">

              {/* Intel Score */}
              <div className={cn(
                'rounded-2xl bg-surface-100 border p-5 flex flex-col',
                scoreColors.ring.replace('ring', 'border')
              )}>
                <span className="text-xs text-surface-500 mb-2 font-medium">Intel Score</span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={cn('text-3xl font-bold font-mono', scoreColors.text)}>
                    {score}
                  </span>
                  <span className="text-xs text-surface-500">/100</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreColors.bar)}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-xs text-surface-500">{intelScoreLabel(score)}</span>
              </div>

              {/* Law Probability */}
              <div className={cn(
                'rounded-2xl bg-surface-100 border p-5 flex flex-col',
                probColors?.bg ?? 'border-surface-300'
              )}>
                <span className="text-xs text-surface-500 mb-2 font-medium">Law Probability</span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={cn('text-3xl font-bold font-mono', probColors?.text)}>
                    {topicStatus === 'law' ? '✓' : topicStatus === 'failed' ? '✗' : `${Math.round(data.forecast.law_probability)}%`}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
                  <div
                    className={cn('h-full rounded-full transition-all', probColors?.bar)}
                    style={{ width: `${topicStatus === 'law' ? 100 : topicStatus === 'failed' ? 100 : data.forecast.law_probability}%` }}
                  />
                </div>
                <span className="text-xs text-surface-500 capitalize">{data.forecast.confidence} confidence</span>
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Last 24h', value: data.stats.votesLast24h?.toLocaleString() ?? '—', icon: Zap, color: 'text-for-300' },
                { label: 'Last 7d', value: data.stats.votesLast7d?.toLocaleString() ?? '—', icon: BarChart2, color: 'text-for-400' },
                { label: 'Arguments', value: data.contributors.total_arguments.toLocaleString(), icon: Swords, color: 'text-purple' },
                { label: 'Contributors', value: data.contributors.contributors.length.toLocaleString(), icon: Users, color: 'text-gold' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn('w-3.5 h-3.5', color)} />
                    <span className="text-xs text-surface-500">{label}</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-white">{value}</span>
                </div>
              ))}
            </div>

            {/* Forecast Signals */}
            {data.forecast.signals.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <SectionHeader
                  icon={Brain}
                  title="Signal Breakdown"
                  subtitle="Factors influencing the law probability model"
                />
                <div className="space-y-2">
                  {data.forecast.signals.map((signal) => {
                    const { icon: SIcon, color, bg } = signalDirection(signal)
                    return (
                      <div key={signal.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50">
                        <div className={cn('flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5', bg)}>
                          <SIcon className={cn('w-3 h-3', color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-white truncate">{signal.label}</span>
                            <span className={cn(
                              'text-xs font-mono font-semibold flex-shrink-0',
                              signal.direction === 'positive' ? 'text-emerald' :
                              signal.direction === 'negative' ? 'text-against-400' : 'text-surface-500'
                            )}>
                              {signal.direction === 'positive' ? '+' : signal.direction === 'negative' ? '−' : '±'}{Math.abs(signal.score).toFixed(1)}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{signal.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Elite vs Grassroots */}
            {data.pressure?.elite && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <SectionHeader
                  icon={Crown}
                  title="Elite vs. Grassroots"
                  subtitle="How high-reputation users diverge from the general public"
                />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Elite voters',
                      count: data.pressure.elite.eliteTotal,
                      forPct: data.pressure.elite.eliteForPct,
                      color: 'text-gold',
                      icon: Crown,
                    },
                    {
                      label: 'Grassroots',
                      count: data.pressure.elite.grassrootsTotal,
                      forPct: data.pressure.elite.grassrootsForPct,
                      color: 'text-surface-400',
                      icon: Users,
                    },
                  ].map(({ label, count, forPct, color, icon: GIcon }) => (
                    <div key={label} className="rounded-xl bg-surface-200/50 p-4 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <GIcon className={cn('w-3.5 h-3.5', color)} />
                        <span className="text-xs text-surface-500">{label}</span>
                        <span className="text-xs text-surface-600 font-mono ml-auto">({count.toLocaleString()})</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={cn('text-xl font-bold font-mono', forPct >= 50 ? 'text-for-400' : 'text-against-400')}>
                          {Math.round(forPct)}%
                        </span>
                        <span className="text-xs text-surface-500">For</span>
                      </div>
                      <SplitBar forPct={forPct} size="sm" />
                    </div>
                  ))}
                </div>

                {data.pressure.cloutWeighted && Math.abs(data.pressure.cloutWeighted.eliteInfluenceDelta) > 2 && (
                  <div className={cn(
                    'mt-3 rounded-xl p-3 flex items-start gap-2',
                    data.pressure.cloutWeighted.eliteInfluenceDelta > 0
                      ? 'bg-for-500/8 border border-for-500/20'
                      : 'bg-against-500/8 border border-against-500/20'
                  )}>
                    <Info className={cn(
                      'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
                      data.pressure.cloutWeighted.eliteInfluenceDelta > 0 ? 'text-for-400' : 'text-against-400'
                    )} />
                    <p className="text-xs text-surface-400">
                      Elite voters are{' '}
                      <span className={cn(
                        'font-semibold',
                        data.pressure.cloutWeighted.eliteInfluenceDelta > 0 ? 'text-for-400' : 'text-against-400'
                      )}>
                        {Math.abs(Math.round(data.pressure.cloutWeighted.eliteInfluenceDelta))}pp {data.pressure.cloutWeighted.eliteInfluenceDelta > 0 ? 'more FOR' : 'more AGAINST'}
                      </span>{' '}
                      than the grassroots — a meaningful divergence.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Role Distribution */}
            {roleBreakdown.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <SectionHeader
                  icon={Users}
                  title="Role Distribution"
                  subtitle="How different civic roles align on this debate"
                />
                <div className="space-y-3">
                  {roleBreakdown
                    .filter(r => r.total > 0)
                    .sort((a, b) => b.total - a.total)
                    .map((role) => {
                      const RIcon = ROLE_ICON[role.role] ?? Users
                      const rColor = ROLE_COLOR[role.role] ?? 'text-surface-400'
                      return (
                        <div key={role.role} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <RIcon className={cn('w-3.5 h-3.5', rColor)} />
                              <span className="text-xs font-medium text-white">
                                {ROLE_LABEL[role.role] ?? role.label}
                              </span>
                              <span className="text-xs text-surface-600 font-mono">
                                ({role.total.toLocaleString()})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-for-400">{Math.round(role.forPct)}% For</span>
                              <span className="text-against-400">{Math.round(100 - role.forPct)}% Against</span>
                            </div>
                          </div>
                          <SplitBar forPct={role.forPct} size="sm" />
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Top Contributors */}
            {data.contributors.contributors.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <SectionHeader
                  icon={Award}
                  title="Top Contributors"
                  subtitle="Most influential voices by argument upvotes"
                />
                <div className="space-y-2">
                  {data.contributors.contributors.slice(0, 6).map((c: TopicContributor, i: number) => (
                    <Link
                      key={c.user_id}
                      href={`/profile/${c.username}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-200/60 transition-colors group"
                    >
                      <span className="text-xs font-mono text-surface-600 w-4 flex-shrink-0">{i + 1}</span>
                      <Avatar
                        src={c.avatar_url}
                        username={c.username}
                        displayName={c.display_name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white truncate group-hover:text-for-300 transition-colors">
                            {c.display_name ?? c.username}
                          </span>
                          <span className="text-xs text-surface-600 font-mono">@{c.username}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.for_upvotes > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-for-400">
                              <ThumbsUp className="w-2.5 h-2.5" />
                              {c.for_upvotes}
                            </span>
                          )}
                          {c.against_upvotes > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-against-400">
                              <ThumbsDown className="w-2.5 h-2.5" />
                              {c.against_upvotes}
                            </span>
                          )}
                          <span className="text-xs text-surface-600">{c.argument_count} arg{c.argument_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <span className={cn(
                        'text-xs font-mono px-2 py-0.5 rounded-full border flex-shrink-0',
                        c.dominant_side === 'for'
                          ? 'text-for-400 border-for-500/30 bg-for-500/10'
                          : c.dominant_side === 'against'
                          ? 'text-against-400 border-against-500/30 bg-against-500/10'
                          : 'text-surface-400 border-surface-400/30 bg-surface-300/20'
                      )}>
                        {c.dominant_side === 'for' ? 'FOR' : c.dominant_side === 'against' ? 'AGAINST' : 'MIXED'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Resolved Debates */}
            {data.forecast.similar_resolved.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <SectionHeader
                  icon={Scale}
                  title="Historical Comparables"
                  subtitle="Similar debates that have already resolved"
                />
                <div className="space-y-2">
                  {data.forecast.similar_resolved.slice(0, 4).map((sim) => (
                    <Link
                      key={sim.id}
                      href={`/law/${sim.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-200/60 transition-colors group"
                    >
                      <div className={cn(
                        'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
                        sim.final_status === 'law' ? 'bg-emerald/10' : 'bg-against-500/10'
                      )}>
                        {sim.final_status === 'law'
                          ? <Gavel className="w-3.5 h-3.5 text-emerald" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-against-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white line-clamp-1 group-hover:text-for-300 transition-colors">
                          {sim.statement}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn(
                            'text-xs font-mono',
                            sim.final_status === 'law' ? 'text-emerald' : 'text-against-400'
                          )}>
                            {sim.final_status === 'law' ? 'Passed' : 'Failed'}
                          </span>
                          <span className="text-xs text-surface-600">·</span>
                          <span className="text-xs text-surface-500 font-mono">
                            {Math.round(sim.blue_pct)}% For
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-surface-600 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Verdict */}
            <div className="rounded-2xl bg-surface-100 border border-purple/30 bg-purple/5 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Intelligence Verdict</h3>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {verdictText(data.forecast, eliteDelta)}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link
                      href={`/topic/${topicId}/forecast`}
                      className="inline-flex items-center gap-1.5 text-xs text-purple hover:text-purple/80 transition-colors"
                    >
                      Full forecast <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/topic/${topicId}/pressure`}
                      className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
                    >
                      Pressure analysis <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/topic/${topicId}/archetypes`}
                      className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
                    >
                      Voter archetypes <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Category base rate */}
            {data.forecast.category_base_rate !== null && topicCategory && (
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-surface-500 mb-1">
                      {topicCategory} category base rate
                    </p>
                    <p className="text-sm text-white">
                      <span className="font-mono font-semibold text-for-400">
                        {Math.round(data.forecast.category_base_rate * 100)}%
                      </span>{' '}
                      of {topicCategory} debates become law
                    </p>
                    <p className="text-xs text-surface-600 mt-0.5">
                      ({data.forecast.category_law_count} passed, {data.forecast.category_fail_count} failed)
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-surface-200 flex items-center justify-center">
                    <Gavel className="w-5 h-5 text-surface-500" />
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
