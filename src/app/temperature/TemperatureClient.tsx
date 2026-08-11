'use client'

/**
 * /temperature — The Civic Temperature
 *
 * A composite heat dashboard showing which topics are "running hot" right
 * now. Unlike /trending (raw activity), /swing (reversal detection), or
 * /momentum (vote velocity), Temperature combines THREE signals:
 *
 *   • Controversy   — how close to 50/50 the debate is (unsettled = hot)
 *   • Velocity      — how many votes have landed in the last 6 hours
 *   • Volume depth  — overall engagement level of the topic
 *
 * The result is a "civic thermometer" — not just the busiest topics but the
 * ones where opinion is most actively in flux AND most evenly contested.
 *
 * Distinct from:
 *   /trending      — raw vote/view count (activity, not heat)
 *   /momentum      — vote velocity only (no controversy signal)
 *   /swing         — reversal detection (direction change vs overall baseline)
 *   /battleground  — static 50/50 snapshot (not time-weighted)
 *   /barometer     — overall platform sentiment (not per-topic heat)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Flame,
  RefreshCw,
  Scale,
  Thermometer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TemperatureTopic, TemperatureResponse } from '@/app/api/topics/temperature/route'

// ─── Heat configuration ───────────────────────────────────────────────────────

const HEAT_CONFIG: Record<
  TemperatureTopic['heat_label'],
  { color: string; bar: string; badge: string; glow: string; emoji: string }
> = {
  Burning: {
    color:  'text-against-400',
    bar:    'bg-against-500',
    badge:  'bg-against-500/20 text-against-400 border-against-500/40',
    glow:   'shadow-against-500/30',
    emoji:  '🔥',
  },
  Hot: {
    color:  'text-amber-400',
    bar:    'bg-amber-500',
    badge:  'bg-amber-500/20 text-amber-400 border-amber-500/40',
    glow:   'shadow-amber-500/20',
    emoji:  '🌡',
  },
  Warm: {
    color:  'text-gold',
    bar:    'bg-gold',
    badge:  'bg-gold/20 text-gold border-gold/40',
    glow:   'shadow-gold/20',
    emoji:  '☀',
  },
  Cold: {
    color:  'text-for-400',
    bar:    'bg-for-500',
    badge:  'bg-for-500/20 text-for-400 border-for-500/40',
    glow:   'shadow-for-500/20',
    emoji:  '❄',
  },
  Freezing: {
    color:  'text-surface-400',
    bar:    'bg-surface-500',
    badge:  'bg-surface-300/30 text-surface-400 border-surface-400/40',
    glow:   '',
    emoji:  '🧊',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold   border-gold/40   bg-gold/10',
  Politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  Technology:  'text-purple  border-purple/40  bg-purple/10',
  Science:     'text-emerald border-emerald/40  bg-emerald/10',
  Ethics:      'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Culture:     'text-pink-400  border-pink-500/40  bg-pink-500/10',
  Environment: 'text-emerald   border-emerald/40   bg-emerald/10',
  Education:   'text-purple    border-purple/40    bg-purple/10',
  Healthcare:  'text-rose-400  border-rose-500/40  bg-rose-500/10',
  Defence:     'text-surface-400 border-surface-400/40 bg-surface-300/20',
}

function categoryClass(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20') : ''
}

// ─── Platform thermometer ─────────────────────────────────────────────────────

function PlatformThermometer({ avgHeat, activeCount, votes6h }: {
  avgHeat: number
  activeCount: number
  votes6h: number
}) {
  const label = avgHeat >= 70 ? 'Scorching'
    : avgHeat >= 55 ? 'Heated'
    : avgHeat >= 40 ? 'Warm'
    : avgHeat >= 25 ? 'Cool'
    : 'Quiet'

  const labelColor = avgHeat >= 70 ? 'text-against-400'
    : avgHeat >= 55 ? 'text-amber-400'
    : avgHeat >= 40 ? 'text-gold'
    : avgHeat >= 25 ? 'text-for-400'
    : 'text-surface-400'

  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-200/40 backdrop-blur-sm p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-surface-500 uppercase tracking-widest mb-1">
            Platform Temperature
          </p>
          <p className={cn('text-3xl font-black tracking-tight', labelColor)}>
            {label}
          </p>
          <p className="text-sm text-surface-500 mt-1">
            {activeCount.toLocaleString()} active debates ·{' '}
            {votes6h.toLocaleString()} votes in the last 6h
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <Thermometer className={cn('h-8 w-8', labelColor)} />
          <span className={cn('text-2xl font-black tabular-nums', labelColor)}>
            {avgHeat}°
          </span>
        </div>
      </div>

      {/* Temperature bar */}
      <div className="mt-4 h-2.5 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(to right,
              #3b82f6 0%,
              #22c55e 30%,
              #eab308 55%,
              #f97316 75%,
              #ef4444 100%)`,
            width: `${avgHeat}%`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${avgHeat}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-surface-600">
        <span>Freezing</span>
        <span>Cold</span>
        <span>Warm</span>
        <span>Hot</span>
        <span>Burning</span>
      </div>
    </div>
  )
}

// ─── Heat bar ─────────────────────────────────────────────────────────────────

function HeatBar({ score, label }: { score: number; label: TemperatureTopic['heat_label'] }) {
  const cfg = HEAT_CONFIG[label]
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', cfg.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('text-xs font-bold tabular-nums shrink-0', cfg.color)}>
        {score}°
      </span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, rank }: { topic: TemperatureTopic; rank: number }) {
  const cfg = HEAT_CONFIG[topic.heat_label]
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.3 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border transition-all group',
          'bg-surface-200/40 hover:bg-surface-200/70',
          'border-surface-300/50 hover:border-surface-400/60',
          topic.heat_label === 'Burning' && 'border-against-500/30 hover:border-against-500/50',
          topic.heat_label === 'Hot'     && 'border-amber-500/25 hover:border-amber-500/40',
        )}
      >
        {/* Rank */}
        <span className="shrink-0 w-6 text-center text-sm font-bold text-surface-500 pt-0.5">
          {rank + 1}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
            {topic.statement}
          </p>

          {/* Heat bar */}
          <HeatBar score={topic.heat_score} label={topic.heat_label} />

          {/* Metadata row */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Heat badge */}
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
              cfg.badge,
            )}>
              {cfg.emoji} {topic.heat_label}
            </span>

            {/* Category */}
            {topic.category && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
                categoryClass(topic.category),
              )}>
                {topic.category}
              </span>
            )}

            {/* Controversy */}
            <span className="text-[11px] text-surface-500 flex items-center gap-1">
              <Scale className="h-3 w-3 inline" />
              {forPct}% · {againstPct}%
            </span>

            {/* Recent votes */}
            {topic.votes_6h > 0 && (
              <span className="text-[11px] text-surface-500 flex items-center gap-1">
                <Zap className="h-3 w-3 inline" />
                {topic.votes_6h} in 6h
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type HeatFilter = 'all' | 'Burning' | 'Hot' | 'Warm' | 'Cold' | 'Freezing'

const HEAT_FILTERS: { value: HeatFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'Burning',  label: '🔥 Burning' },
  { value: 'Hot',      label: '🌡 Hot' },
  { value: 'Warm',     label: '☀ Warm' },
  { value: 'Cold',     label: '❄ Cold' },
  { value: 'Freezing', label: '🧊 Freezing' },
]

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TemperatureSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-surface-300/50 bg-surface-200/40">
          <div className="flex gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemperatureClient() {
  const [data, setData] = useState<TemperatureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<HeatFilter>('all')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/topics/temperature', { cache: 'no-store' })
      if (res.ok) {
        const json: TemperatureResponse = await res.json()
        setData(json)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data?.topics.filter(
    (t) => filter === 'all' || t.heat_label === filter
  ) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="h-5 w-5 text-against-400" />
              <h1 className="text-xl font-black tracking-tight text-white">
                Civic Temperature
              </h1>
            </div>
            <p className="text-sm text-surface-500">
              Which debates are running hot right now? Controversy × velocity × depth.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh temperature data"
            className="shrink-0 p-2 rounded-xl border border-surface-300/60 bg-surface-200/40 text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Platform thermometer */}
        {data && (
          <PlatformThermometer
            avgHeat={data.platform.avg_heat}
            activeCount={data.platform.active_count}
            votes6h={data.platform.votes_6h_total}
          />
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {HEAT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap',
                filter === f.value
                  ? 'bg-white/10 text-white border-white/30'
                  : 'text-surface-400 border-surface-300/50 hover:text-white hover:border-surface-400/60',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* How is temperature calculated? */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-surface-300/50 bg-surface-200/30 mb-5">
          <Activity className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500 leading-relaxed">
            <span className="text-surface-400 font-medium">How it works: </span>
            Temperature = Controversy (40%) + Vote velocity in the last 6h (40%) + Total engagement (20%).
            A topic running at 51/49 with a surge of new votes scores hotter than a dominant 90/10 blowout.
          </p>
        </div>

        {/* Topic list */}
        {loading ? (
          <TemperatureSkeleton />
        ) : data === null ? (
          <EmptyState
            icon={Thermometer}
            iconColor="text-surface-500"
            title="Temperature unavailable"
            description="Could not load heat data. Please try refreshing."
            action={
              <button
                onClick={() => load()}
                className="text-sm text-for-400 hover:text-for-300 transition-colors"
              >
                Try again
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Thermometer}
            iconColor="text-surface-500"
            title={filter === 'all' ? 'No active debates' : `No ${filter} debates right now`}
            description={
              filter === 'all'
                ? 'There are no active topics with enough votes to measure temperature.'
                : 'Try a different temperature filter to see more debates.'
            }
            action={
              filter !== 'all' ? (
                <button
                  onClick={() => setFilter('all')}
                  className="text-sm text-for-400 hover:text-for-300 transition-colors"
                >
                  Show all temperatures
                </button>
              ) : undefined
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {filtered.map((topic, i) => (
                <TopicRow key={topic.id} topic={topic} rank={i} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        {!loading && data && data.topics.length > 0 && (
          <div className="mt-8 flex flex-col gap-2">
            <p className="text-xs text-surface-600 text-center mb-2">
              Related views
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/momentum',     label: 'Momentum',     icon: TrendingUp },
                { href: '/swing',        label: 'The Swing',    icon: Activity },
                { href: '/battleground', label: 'Battleground', icon: Scale },
                { href: '/trending',     label: 'Trending',     icon: Flame },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-3 rounded-xl border border-surface-300/50 bg-surface-200/30 hover:bg-surface-200/60 hover:border-surface-400/60 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                    <span className="text-sm font-medium text-surface-400 group-hover:text-white transition-colors">
                      {label}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
