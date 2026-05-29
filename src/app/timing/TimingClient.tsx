'use client'

/**
 * /timing — The Civic Timing Profile
 *
 * Reveals WHEN you engage with debates — your peak voting hours, favourite
 * days, how quickly you jump on new topics (early adopter score), and your
 * timing archetype: Trailblazer, Pioneer, Mainstream, Late Majority, or Archivist.
 *
 * Distinct from:
 *   /analytics     — overall voting stats
 *   /conviction    — ideological consistency per category
 *   /velocity      — (admin) platform-wide vote velocity metrics
 *   /activity      — simple vote history feed
 *
 * Timing answers: "WHEN do you vote — and how does that shape your civic impact?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Flame,
  Globe,
  Rocket,
  RefreshCw,
  Target,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TimingResponse,
  TimingResponseUnauthenticated,
  TimingArchetype,
  HourBucket,
  DayBucket,
  EarlyVoteTopic,
} from '@/app/api/analytics/timing/route'

type ApiResponse = TimingResponse | TimingResponseUnauthenticated

// ─── Archetype config ─────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<TimingArchetype, {
  icon: React.ComponentType<{ className?: string }>
  accent: string
  bg: string
  border: string
  gradient: string
}> = {
  trailblazer: {
    icon: Rocket,
    accent: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    gradient: 'from-against-500/20 to-transparent',
  },
  pioneer: {
    icon: Flame,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    gradient: 'from-gold/20 to-transparent',
  },
  mainstream: {
    icon: TrendingUp,
    accent: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    gradient: 'from-for-500/20 to-transparent',
  },
  late_majority: {
    icon: Timer,
    accent: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    gradient: 'from-purple/15 to-transparent',
  },
  archivist: {
    icon: Clock,
    accent: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    gradient: 'from-surface-200 to-transparent',
  },
}

function archetypeCfg(a: TimingArchetype) {
  return ARCHETYPE_CONFIG[a] ?? ARCHETYPE_CONFIG.mainstream
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  )
}

// ─── Archetype hero ───────────────────────────────────────────────────────────

function ArchetypeHero({ data }: { data: TimingResponse }) {
  const cfg = archetypeCfg(data.archetype)
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5',
        cfg.bg, cfg.border,
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-30', cfg.gradient)} />
      <div className="relative flex items-start gap-4">
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl border',
          cfg.bg, cfg.border,
        )}>
          <Icon className={cn('h-7 w-7', cfg.accent)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-1">
            Timing Archetype
          </p>
          <h2 className={cn('text-xl font-mono font-black mb-0.5', cfg.accent)}>
            {data.archetype_label}
          </h2>
          <p className={cn('text-[11px] font-mono italic mb-2', cfg.accent, 'opacity-80')}>
            &ldquo;{data.archetype_tagline}&rdquo;
          </p>
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            {data.archetype_description}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="relative mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-surface-300/50">
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Votes</p>
          <p className="text-lg font-mono font-bold text-white tabular-nums">{data.total_votes}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Adopter Score</p>
          <p className={cn('text-lg font-mono font-bold tabular-nums', cfg.accent)}>
            {data.early_adopter_score}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Avg Delta</p>
          <p className={cn('text-lg font-mono font-bold tabular-nums', cfg.accent)}>
            {data.avg_delta_hours < 1
              ? `${Math.round(data.avg_delta_hours * 60)}m`
              : data.avg_delta_hours < 24
              ? `${Math.round(data.avg_delta_hours)}h`
              : `${Math.round(data.avg_delta_hours / 24)}d`}
          </p>
        </div>
      </div>

      {data.early_accuracy !== null && (
        <div className="relative mt-3 flex items-center gap-2 pt-3 border-t border-surface-300/50">
          <Target className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
          <p className="text-[11px] font-mono text-surface-400">
            <span className="text-emerald font-bold">{data.early_accuracy}%</span> early-vote accuracy on resolved topics
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Hour heatmap ─────────────────────────────────────────────────────────────

function HourHeatmap({ hours, peakHour }: { hours: HourBucket[]; peakHour: number | null }) {
  const max = Math.max(...hours.map((h) => h.count), 1)

  function intensity(count: number): string {
    const pct = count / max
    if (pct === 0) return 'bg-surface-300/20'
    if (pct < 0.25) return 'bg-for-600/30'
    if (pct < 0.5)  return 'bg-for-500/50'
    if (pct < 0.75) return 'bg-for-500/70'
    return 'bg-for-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-for-400" />
        <h2 className="text-sm font-mono font-bold text-white">Voting Hours (UTC)</h2>
        {peakHour !== null && (
          <span className="ml-auto text-[10px] font-mono text-for-400">
            Peak: {hours[peakHour]?.label}
          </span>
        )}
      </div>

      {/* 24-cell heatmap */}
      <div className="grid grid-cols-12 gap-1 mb-2">
        {hours.map((h) => (
          <div
            key={h.hour}
            title={`${h.label}: ${h.count} vote${h.count !== 1 ? 's' : ''} (${h.pct}%)`}
            className={cn(
              'h-6 rounded-sm transition-all',
              intensity(h.count),
              h.hour === peakHour && 'ring-1 ring-for-400/70',
            )}
          />
        ))}
      </div>

      {/* Hour labels — AM / PM markers */}
      <div className="flex justify-between">
        {['12AM', '6AM', '12PM', '6PM', '12AM'].map((label) => (
          <span key={label} className="text-[9px] font-mono text-surface-600">{label}</span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-200/50">
        <span className="text-[10px] font-mono text-surface-600">Less</span>
        {['bg-surface-300/20', 'bg-for-600/30', 'bg-for-500/50', 'bg-for-500/70', 'bg-for-400'].map((cls) => (
          <div key={cls} className={cn('h-3 w-5 rounded-sm', cls)} />
        ))}
        <span className="text-[10px] font-mono text-surface-600">More</span>
      </div>
    </motion.div>
  )
}

// ─── Day distribution ─────────────────────────────────────────────────────────

function DayDistribution({ days, peakDay }: { days: DayBucket[]; peakDay: number | null }) {
  const max = Math.max(...days.map((d) => d.count), 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-purple" />
        <h2 className="text-sm font-mono font-bold text-white">Day of Week</h2>
        {peakDay !== null && (
          <span className="ml-auto text-[10px] font-mono text-purple">
            Peak: {days[peakDay]?.shortLabel}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {days.map((d, i) => {
          const barH = max > 0 ? Math.max(4, Math.round((d.count / max) * 80)) : 4
          const isPeak = d.day === peakDay
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                title={`${d.label}: ${d.count} vote${d.count !== 1 ? 's' : ''}`}
                className={cn(
                  'w-full rounded-t-sm',
                  isPeak ? 'bg-purple' : 'bg-surface-400/40',
                )}
                style={{ height: barH }}
                initial={{ height: 0 }}
                animate={{ height: barH }}
                transition={{ duration: 0.5, delay: i * 0.04 + 0.15, ease: 'easeOut' }}
              />
              <span className={cn('text-[9px] font-mono', isPeak ? 'text-purple font-bold' : 'text-surface-600')}>
                {d.shortLabel.slice(0, 2)}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Fast / slow vote rows ────────────────────────────────────────────────────

function TopicTimingRow({ topic, rank, mode }: { topic: EarlyVoteTopic; rank: number; mode: 'fast' | 'slow' }) {
  const isFor = topic.user_vote === 'blue'
  const delta = topic.delta_hours
  const deltaLabel = delta < 1
    ? `${Math.round(delta * 60)}m`
    : delta < 24
    ? `${Math.round(delta)}h`
    : `${Math.round(delta / 24)}d`

  return (
    <motion.div
      initial={{ opacity: 0, x: mode === 'fast' ? -6 : 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-start gap-3 py-2.5 border-b border-surface-200/50 last:border-0"
    >
      <span className="flex-shrink-0 text-[10px] font-mono text-surface-600 w-4 mt-0.5">#{rank + 1}</span>
      <Link
        href={`/topic/${topic.topic_id}`}
        className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <p className="text-xs font-mono text-surface-300 line-clamp-2 leading-relaxed">{topic.statement}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold',
            isFor
              ? 'bg-for-500/15 text-for-400 border border-for-500/30'
              : 'bg-against-500/15 text-against-400 border border-against-500/30',
          )}>
            {isFor ? <ThumbsUp className="h-2 w-2" /> : <ThumbsDown className="h-2 w-2" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {topic.category && (
            <span className="text-[9px] font-mono text-surface-600">{topic.category}</span>
          )}
          {topic.status === 'law' && (
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald flex-shrink-0" />
          )}
        </div>
      </Link>
      <div className="flex-shrink-0 text-right">
        <p className={cn('text-xs font-mono font-bold tabular-nums', mode === 'fast' ? 'text-against-300' : 'text-purple')}>
          {deltaLabel}
        </p>
        <p className="text-[9px] font-mono text-surface-600">after creation</p>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TimingClient() {
  const router = useRouter()
  const [data, setData] = useState<TimingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/timing', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ApiResponse
      if (!json.authenticated) { router.push('/login'); return }
      setData(json as TimingResponse)
    } catch {
      setError('Failed to load timing data')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-mono font-black text-white">Civic Timing</h1>
            <p className="text-xs font-mono text-surface-500">Your voting rhythm, decoded</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && <TimingSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="font-mono text-against-400 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-2 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* No votes yet */}
        {!loading && !error && data && data.total_votes === 0 && (
          <EmptyState
            icon={Vote}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/30"
            title="No votes yet"
            description="Start voting on topics to reveal your civic timing profile."
            actions={[{ label: 'Browse topics', href: '/', variant: 'primary', icon: ArrowRight }]}
          />
        )}

        {/* Content */}
        {!loading && !error && data && data.total_votes > 0 && (
          <AnimatePresence mode="wait">
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {/* Archetype hero */}
              <ArchetypeHero data={data} />

              {/* Hour heatmap */}
              {data.hour_distribution.length > 0 && (
                <HourHeatmap hours={data.hour_distribution} peakHour={data.peak_hour} />
              )}

              {/* Day distribution */}
              {data.day_distribution.length > 0 && (
                <DayDistribution days={data.day_distribution} peakDay={data.peak_day} />
              )}

              {/* Early adopter score */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-bold text-white">Early Adopter Score</h2>
                  <span className="ml-auto text-lg font-mono font-black text-gold tabular-nums">
                    {data.early_adopter_score}
                    <span className="text-xs text-surface-500 font-normal">/100</span>
                  </span>
                </div>

                <div className="h-2 rounded-full bg-surface-300 overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.early_adopter_score}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Avg delay</p>
                    <p className="text-base font-mono font-bold text-white tabular-nums">
                      {data.avg_delta_hours < 1
                        ? `${Math.round(data.avg_delta_hours * 60)}m`
                        : data.avg_delta_hours < 24
                        ? `${data.avg_delta_hours.toFixed(1)}h`
                        : `${(data.avg_delta_hours / 24).toFixed(1)}d`}
                    </p>
                    <p className="text-[10px] font-mono text-surface-600">after topic creation</p>
                  </div>
                  <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Median delay</p>
                    <p className="text-base font-mono font-bold text-white tabular-nums">
                      {data.median_delta_hours < 1
                        ? `${Math.round(data.median_delta_hours * 60)}m`
                        : data.median_delta_hours < 24
                        ? `${data.median_delta_hours.toFixed(1)}h`
                        : `${(data.median_delta_hours / 24).toFixed(1)}d`}
                    </p>
                    <p className="text-[10px] font-mono text-surface-600">half of your votes</p>
                  </div>
                </div>
              </motion.div>

              {/* Fastest votes */}
              {data.fastest_votes.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="h-4 w-4 text-against-400" />
                    <h2 className="text-sm font-mono font-bold text-white">Fastest Votes</h2>
                    <span className="ml-auto text-[10px] font-mono text-surface-500">jumped early</span>
                  </div>
                  <div>
                    {data.fastest_votes.slice(0, 5).map((t, i) => (
                      <TopicTimingRow key={t.topic_id} topic={t} rank={i} mode="fast" />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Slowest votes */}
              {data.slowest_votes.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-purple" />
                    <h2 className="text-sm font-mono font-bold text-white">Deliberate Votes</h2>
                    <span className="ml-auto text-[10px] font-mono text-surface-500">took your time</span>
                  </div>
                  <div>
                    {data.slowest_votes.slice(0, 5).map((t, i) => (
                      <TopicTimingRow key={t.topic_id} topic={t} rank={i} mode="slow" />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Footer links */}
              <nav aria-label="Related pages" className="grid grid-cols-2 gap-3 pt-2">
                {([
                  { href: '/analytics', label: 'Full analytics', icon: BarChart2, color: 'text-gold' },
                  { href: '/activity', label: 'Vote history', icon: Activity, color: 'text-for-400' },
                  { href: '/conviction', label: 'Conviction tracker', icon: Globe, color: 'text-emerald' },
                  { href: '/rhetoric', label: 'Rhetoric profile', icon: Zap, color: 'text-purple' },
                ] as const).map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                    <span className="text-xs font-mono text-surface-400 hover:text-white transition-colors">{label}</span>
                    <ArrowRight className="h-3 w-3 text-surface-600 ml-auto" />
                  </Link>
                ))}
              </nav>

            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
