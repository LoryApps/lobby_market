'use client'

/**
 * /civic-weather — The Civic Weather Station
 *
 * A meteorological metaphor for platform-wide civic sentiment.
 * Each policy category gets a weather condition derived from three signals:
 *
 *   Temperature   = average FOR% across active topics (hot = strong consensus)
 *   Wind          = debate activity (arguments per topic per week)
 *   Precipitation = polarisation (% of topics near 50/50 deadlock)
 *
 * Conditions:
 *   ☀  Clear Skies     — strong consensus (deviation ≥ 25pts from 50)
 *   🌤  Mostly Sunny   — moderate consensus (deviation ≥ 17pts)
 *   ⛅  Partly Cloudy  — lively debate, no majority (high wind)
 *   ☁  Overcast        — split opinion, low activity
 *   ⛈  Storm Warning   — high polarisation
 *   🌩  Thunderstorm    — maximum polarisation + high activity
 *
 * Distinct from:
 *   /barometer      — single dial reading of overall FOR% momentum
 *   /vitals         — discourse quality scores
 *   /polarization   — per-topic polarisation breakdown
 *   /drift          — category FOR% change over time
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart2,
  Cloud,
  Cpu,
  Droplets,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  Thermometer,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CivicWeatherResponse,
  CategoryWeather,
  WeatherCondition,
  WeatherTrend,
} from '@/app/api/civic-weather/route'

// ─── Weather condition config ─────────────────────────────────────────────────

interface ConditionConfig {
  icon: string
  label: string
  bgClass: string
  borderClass: string
  textClass: string
  glowClass: string
}

const CONDITION_CONFIG: Record<WeatherCondition, ConditionConfig> = {
  scorching: {
    icon: '☀️',
    label: 'Clear Skies',
    bgClass: 'bg-for-500/10',
    borderClass: 'border-for-500/40',
    textClass: 'text-for-300',
    glowClass: 'shadow-for-500/20',
  },
  sunny: {
    icon: '🌤',
    label: 'Mostly Sunny',
    bgClass: 'bg-for-500/8',
    borderClass: 'border-for-500/30',
    textClass: 'text-for-400',
    glowClass: 'shadow-for-500/10',
  },
  partly_cloudy: {
    icon: '⛅',
    label: 'Partly Cloudy',
    bgClass: 'bg-gold/8',
    borderClass: 'border-gold/30',
    textClass: 'text-gold',
    glowClass: 'shadow-gold/10',
  },
  overcast: {
    icon: '☁',
    label: 'Overcast',
    bgClass: 'bg-surface-200',
    borderClass: 'border-surface-400/30',
    textClass: 'text-surface-400',
    glowClass: '',
  },
  stormy: {
    icon: '⛈',
    label: 'Storm Warning',
    bgClass: 'bg-against-500/8',
    borderClass: 'border-against-500/30',
    textClass: 'text-against-400',
    glowClass: 'shadow-against-500/10',
  },
  thunderstorm: {
    icon: '🌩',
    label: 'Thunderstorm',
    bgClass: 'bg-against-500/15',
    borderClass: 'border-against-500/50',
    textClass: 'text-against-300',
    glowClass: 'shadow-against-500/20',
  },
}

// ─── Category icons & colors ──────────────────────────────────────────────────

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics:    Landmark,
  Economics:   TrendingUp,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Sparkles,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

// ─── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: WeatherTrend }) {
  if (trend === 'warming') return <ArrowUp className="h-3 w-3 text-for-400" />
  if (trend === 'cooling') return <ArrowDown className="h-3 w-3 text-against-400" />
  return <Minus className="h-3 w-3 text-surface-500" />
}

// ─── Stat gauge bar ───────────────────────────────────────────────────────────

function GaugeBar({
  label,
  value,
  colorClass,
  icon: Icon,
}: {
  label: string
  value: number
  colorClass: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon className={cn('h-3 w-3', colorClass)} />
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
        </div>
        <span className={cn('text-xs font-mono font-bold', colorClass)}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', colorClass.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Global forecast banner ───────────────────────────────────────────────────

function GlobalBanner({ global }: { global: CivicWeatherResponse['global'] }) {
  const cfg = CONDITION_CONFIG[global.condition]

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-3xl border p-6',
        'bg-surface-100',
        cfg.borderClass,
        cfg.glowClass && `shadow-lg ${cfg.glowClass}`,
      )}
    >
      <div className="flex items-start gap-5">
        {/* Big weather icon */}
        <div
          className={cn(
            'flex items-center justify-center h-16 w-16 rounded-2xl border text-4xl leading-none flex-shrink-0',
            cfg.bgClass,
            cfg.borderClass,
          )}
          role="img"
          aria-label={cfg.label}
        >
          {cfg.icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-0.5">
            Today&apos;s Civic Forecast
          </p>
          <h2 className={cn('text-2xl font-bold', cfg.textClass)}>{global.conditionLabel}</h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <span className="text-xs font-mono text-surface-400">
              <span className="text-white font-semibold">{global.totalActiveTopics}</span> active debates
            </span>
            <span className="text-xs font-mono text-surface-400">
              <span className="text-emerald font-semibold">{global.recentLaws}</span> laws this month
            </span>
            <span className="text-xs font-mono text-surface-400">
              <span className={cn('font-semibold', global.overallPolarization > 50 ? 'text-against-400' : 'text-for-400')}>
                {global.overallPolarization}%
              </span> contested
            </span>
          </div>
        </div>
      </div>

      {/* Hottest / most active */}
      {(global.hottestCategory || global.mostActiveCategory) && (
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-surface-300/50">
          {global.hottestCategory && (
            <div>
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-0.5">
                Hottest category
              </p>
              <p className="text-xs font-mono font-semibold text-gold">{global.hottestCategory}</p>
            </div>
          )}
          {global.mostActiveCategory && (
            <div>
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-0.5">
                Most active
              </p>
              <p className="text-xs font-mono font-semibold text-purple">{global.mostActiveCategory}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Category weather card ────────────────────────────────────────────────────

function CategoryCard({
  cat,
  index,
}: {
  cat: CategoryWeather
  index: number
}) {
  const cfg = CONDITION_CONFIG[cat.condition]
  const CatIcon = CAT_ICON[cat.category] ?? BarChart2
  const catCol = CAT_COLOR[cat.category] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        'bg-surface-100 hover:bg-surface-200/60',
        cat.condition === 'thunderstorm' || cat.condition === 'stormy'
          ? cfg.borderClass
          : 'border-surface-300',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', catCol.bg, catCol.border)}>
          <CatIcon className={cn('h-4 w-4', catCol.text)} />
        </div>

        {/* Category name + trend */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-sm font-semibold text-white truncate">{cat.category}</p>
            <TrendIcon trend={cat.trend} />
          </div>
          <p className="text-[11px] font-mono text-surface-500 truncate">{cat.conditionDesc}</p>
        </div>

        {/* Weather badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold flex-shrink-0',
            cfg.bgClass,
            cfg.borderClass,
            cfg.textClass,
          )}
        >
          <span role="img" aria-hidden="true">{cfg.icon}</span>
          <span className="hidden sm:inline">{cfg.label}</span>
        </div>
      </div>

      {/* Gauge bars: Temperature, Wind, Precipitation */}
      <div className="space-y-2">
        <GaugeBar
          label="Temp"
          value={cat.temperature}
          colorClass={cat.temperature >= 50 ? 'text-for-400' : 'text-against-400'}
          icon={Thermometer}
        />
        <GaugeBar label="Wind" value={cat.wind} colorClass="text-purple" icon={Wind} />
        <GaugeBar label="Rain" value={cat.precipitation} colorClass="text-gold" icon={Droplets} />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 pt-1 border-t border-surface-300/40">
        <span>{cat.topicCount} active debate{cat.topicCount !== 1 ? 's' : ''}</span>
        {cat.lawCount > 0 && (
          <span className="text-emerald">{cat.lawCount} law{cat.lawCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Hot topic link */}
      {cat.hotTopicId && cat.hotTopicStatement && (
        <Link
          href={`/topic/${cat.hotTopicId}`}
          className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors group"
        >
          <Zap className="h-3 w-3 text-gold flex-shrink-0" />
          <p className="text-[11px] font-mono text-surface-300 group-hover:text-white transition-colors truncate flex-1">
            {cat.hotTopicStatement}
          </p>
          <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function WeatherLegend() {
  const rows: { icon: string; label: string; desc: string }[] = [
    { icon: '☀️', label: 'Clear Skies', desc: 'Strong consensus — one side dominates decisively' },
    { icon: '🌤', label: 'Mostly Sunny', desc: 'Clear majority with minimal dissent' },
    { icon: '⛅', label: 'Partly Cloudy', desc: 'Active debate, no definitive majority yet' },
    { icon: '☁',  label: 'Overcast',     desc: 'Split opinion, debate activity is low' },
    { icon: '⛈', label: 'Storm Warning', desc: 'Deeply polarised — no consensus forming' },
    { icon: '🌩', label: 'Thunderstorm', desc: 'Maximum polarisation + high argument activity' },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">Weather Legend</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="text-lg w-6 text-center leading-none" role="img" aria-hidden="true">{r.icon}</span>
            <div>
              <p className="text-xs font-mono font-semibold text-white">{r.label}</p>
              <p className="text-[10px] font-mono text-surface-500">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-surface-300/50 grid grid-cols-3 gap-2">
        {[
          { icon: Thermometer, label: 'Temperature', desc: 'Avg FOR% (50 = deadlock)', color: 'text-for-400' },
          { icon: Wind,        label: 'Wind',        desc: 'Debate activity this week',  color: 'text-purple' },
          { icon: Droplets,    label: 'Rain',        desc: 'Polarisation (% near 50/50)', color: 'text-gold' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="space-y-0.5">
            <div className="flex items-center gap-1">
              <Icon className={cn('h-3 w-3', color)} />
              <span className={cn('text-[10px] font-mono font-semibold', color)}>{label}</span>
            </div>
            <p className="text-[10px] font-mono text-surface-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function CivicWeatherClient() {
  const [data, setData] = useState<CivicWeatherResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/civic-weather', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: CivicWeatherResponse = await res.json()
      if (mountedRef.current) setData(json)
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0 text-2xl leading-none">
              🌤
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Weather</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Today&apos;s forecast across every civic domain
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40 mt-1 flex-shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            {/* Global skeleton */}
            <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6">
              <div className="flex items-start gap-5">
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </div>

            {/* Category grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="space-y-1">
                        <Skeleton className="h-2.5 w-24" />
                        <Skeleton className="h-1.5 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <EmptyState
            icon={Cloud}
            iconColor="text-surface-400"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="Forecast unavailable"
            description="Unable to retrieve today's civic weather. Try refreshing."
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="weather-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Global forecast */}
              <GlobalBanner global={data.global} />

              {/* Category grid */}
              <div>
                <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Category Forecast
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.categories.map((cat, i) => (
                    <CategoryCard key={cat.category} cat={cat} index={i} />
                  ))}
                </div>
              </div>

              {/* Legend */}
              <WeatherLegend />

              {/* Trend key */}
              <div className="flex items-center justify-center gap-6 text-xs font-mono text-surface-500">
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="h-3 w-3 text-for-400" />
                  <span>Warming (trending FOR)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Minus className="h-3 w-3 text-surface-500" />
                  <span>Stable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowDown className="h-3 w-3 text-against-400" />
                  <span>Cooling (trending AGAINST)</span>
                </div>
              </div>

              {/* Related explore links */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { href: '/barometer',    label: 'Barometer',     icon: BarChart2,  color: 'text-for-400' },
                  { href: '/polarization', label: 'Polarization',  icon: Zap,        color: 'text-against-400' },
                  { href: '/drift',        label: 'Opinion Drift', icon: ArrowRight, color: 'text-purple' },
                  { href: '/vitals',       label: 'Vitals',        icon: BarChart2,  color: 'text-emerald' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                    <span className="font-mono text-xs text-surface-300 truncate">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Timestamp */}
              <p className="font-mono text-xs text-surface-600 text-center">
                Forecast computed at{' '}
                {new Date(data.global.generatedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
