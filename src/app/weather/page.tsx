'use client'

/**
 * /weather — The Civic Weather Report
 *
 * A meteorological metaphor for the political climate across topic categories.
 * Temperature = consensus level (how far from 50/50)
 * Wind        = debate activity (argument volume)
 * Precipitation = polarisation (% of topics in deadlock territory)
 * Condition   = combined reading: Scorching / Sunny / Partly Cloudy / Overcast / Stormy / Thunderstorm
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudRain,
  Droplets,
  ExternalLink,
  Gavel,
  Globe,
  RefreshCw,
  Sun,
  Thermometer,
  TrendingDown,
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
  CategoryWeather,
  CivicWeatherResponse,
  GlobalForecast,
  WeatherCondition,
} from '@/app/api/civic-weather/route'

// ─── Category icons + colors ──────────────────────────────────────────────────

const CATEGORY_STYLE: Record<
  string,
  { color: string; bg: string; border: string; dot: string }
> = {
  Politics:    { color: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/30',     dot: 'bg-for-500' },
  Economics:   { color: 'text-gold',          bg: 'bg-gold/10',        border: 'border-gold/30',        dot: 'bg-gold' },
  Technology:  { color: 'text-purple',        bg: 'bg-purple/10',      border: 'border-purple/30',      dot: 'bg-purple' },
  Science:     { color: 'text-emerald',       bg: 'bg-emerald/10',     border: 'border-emerald/30',     dot: 'bg-emerald' },
  Ethics:      { color: 'text-against-300',  bg: 'bg-against-500/10', border: 'border-against-500/30', dot: 'bg-against-500' },
  Philosophy:  { color: 'text-for-300',       bg: 'bg-for-400/10',     border: 'border-for-400/30',     dot: 'bg-for-400' },
  Culture:     { color: 'text-gold',          bg: 'bg-gold/10',        border: 'border-gold/25',        dot: 'bg-gold' },
  Health:      { color: 'text-against-300',  bg: 'bg-against-400/10', border: 'border-against-400/30', dot: 'bg-against-400' },
  Environment: { color: 'text-emerald',       bg: 'bg-emerald/10',     border: 'border-emerald/30',     dot: 'bg-emerald' },
  Education:   { color: 'text-purple',        bg: 'bg-purple/10',      border: 'border-purple/30',      dot: 'bg-purple' },
}

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? {
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-300',
    dot: 'bg-surface-400',
  }
}

// ─── Weather condition config ─────────────────────────────────────────────────

interface ConditionConfig {
  icon: React.ReactNode
  skyGrad: string
  accentBorder: string
  accentBg: string
  tempColor: string
}

function conditionConfig(c: WeatherCondition, temp: number): ConditionConfig {
  const forDom = temp >= 50

  switch (c) {
    case 'scorching':
      return {
        icon: <Sun className="h-10 w-10 text-gold drop-shadow-[0_0_12px_rgba(201,168,76,0.7)]" />,
        skyGrad: forDom
          ? 'from-for-600/20 via-for-600/5 to-transparent'
          : 'from-against-600/20 via-against-600/5 to-transparent',
        accentBorder: forDom ? 'border-for-500/50' : 'border-against-500/50',
        accentBg: forDom ? 'bg-for-500/5' : 'bg-against-500/5',
        tempColor: forDom ? 'text-for-300' : 'text-against-300',
      }
    case 'sunny':
      return {
        icon: <Sun className="h-10 w-10 text-gold/80" />,
        skyGrad: forDom
          ? 'from-for-600/15 via-for-600/5 to-transparent'
          : 'from-against-600/15 via-against-600/5 to-transparent',
        accentBorder: forDom ? 'border-for-500/40' : 'border-against-500/40',
        accentBg: forDom ? 'bg-for-500/5' : 'bg-against-500/5',
        tempColor: forDom ? 'text-for-300' : 'text-against-300',
      }
    case 'partly_cloudy':
      return {
        icon: (
          <div className="relative h-10 w-10">
            <Sun className="absolute top-0 right-0 h-7 w-7 text-gold/60" />
            <Cloud className="absolute bottom-0 left-0 h-7 w-7 text-surface-400" />
          </div>
        ),
        skyGrad: 'from-surface-400/10 via-surface-400/5 to-transparent',
        accentBorder: 'border-surface-400/40',
        accentBg: 'bg-surface-300/5',
        tempColor: 'text-surface-400',
      }
    case 'overcast':
      return {
        icon: <Cloud className="h-10 w-10 text-surface-500" />,
        skyGrad: 'from-surface-400/10 to-transparent',
        accentBorder: 'border-surface-400/30',
        accentBg: 'bg-surface-300/5',
        tempColor: 'text-surface-500',
      }
    case 'stormy':
      return {
        icon: <CloudRain className="h-10 w-10 text-for-300/70" />,
        skyGrad: 'from-purple/15 via-purple/5 to-transparent',
        accentBorder: 'border-purple/40',
        accentBg: 'bg-purple/5',
        tempColor: 'text-purple',
      }
    case 'thunderstorm':
      return {
        icon: <CloudLightning className="h-10 w-10 text-against-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />,
        skyGrad: 'from-against-600/20 via-against-600/5 to-transparent',
        accentBorder: 'border-against-500/50',
        accentBg: 'bg-against-500/5',
        tempColor: 'text-against-400',
      }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function temperatureLabel(temp: number): string {
  const deviation = Math.abs(temp - 50)
  if (deviation < 5) return 'Deadlocked'
  if (deviation < 12) return temp >= 50 ? 'Leans FOR' : 'Leans AGAINST'
  if (deviation < 22) return temp >= 50 ? 'FOR advantage' : 'AGAINST advantage'
  return temp >= 50 ? 'FOR dominant' : 'AGAINST dominant'
}

function windLabel(wind: number): string {
  if (wind >= 75) return 'Hurricane-force'
  if (wind >= 50) return 'Strong gusts'
  if (wind >= 25) return 'Breezy'
  if (wind >= 10) return 'Light breeze'
  return 'Calm'
}

function precipLabel(precip: number): string {
  if (precip >= 70) return 'Heavy polarisation'
  if (precip >= 50) return 'Moderate polarisation'
  if (precip >= 30) return 'Some division'
  return 'Low division'
}

// ─── Global forecast banner ───────────────────────────────────────────────────

function GlobalBanner({
  global,
  updatedAt,
}: {
  global: GlobalForecast
  updatedAt: string
}) {
  const cfg = conditionConfig(global.condition, 50)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-2xl border p-6 mb-8 bg-gradient-to-b',
        cfg.skyGrad,
        cfg.accentBorder,
        'bg-surface-100',
      )}
    >
      <div className="flex items-start gap-5">
        <div className="flex-shrink-0">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-surface-500" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              National Forecast
            </span>
          </div>
          <h2 className="text-2xl font-mono font-bold text-white mb-1">
            {global.conditionLabel}
          </h2>
          <p className="text-sm font-mono text-surface-400 mb-4">
            Platform-wide civic climate based on {global.totalActiveTopics} active debate
            {global.totalActiveTopics !== 1 ? 's' : ''}.
          </p>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5 text-purple" />
              <span className="text-surface-400">Polarisation:</span>
              <span className="text-white">{global.overallPolarization}%</span>
            </div>
            {global.hottestCategory && (
              <div className="flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5 text-gold" />
                <span className="text-surface-400">Hottest:</span>
                <Link
                  href={`/categories/${encodeURIComponent(global.hottestCategory)}`}
                  className="text-gold hover:underline"
                >
                  {global.hottestCategory}
                </Link>
              </div>
            )}
            {global.mostActiveCategory && (
              <div className="flex items-center gap-1.5">
                <Wind className="h-3.5 w-3.5 text-for-400" />
                <span className="text-surface-400">Most active:</span>
                <Link
                  href={`/categories/${encodeURIComponent(global.mostActiveCategory)}`}
                  className="text-for-300 hover:underline"
                >
                  {global.mostActiveCategory}
                </Link>
              </div>
            )}
            {global.recentLaws > 0 && (
              <div className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5 text-emerald" />
                <span className="text-surface-400">New laws (30d):</span>
                <span className="text-emerald">{global.recentLaws}</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-right text-xs font-mono text-surface-600 flex-shrink-0 hidden sm:block">
          <p>Updated</p>
          <p>{relativeTime(updatedAt)}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Category weather card ────────────────────────────────────────────────────

function WeatherCard({
  cw,
  index,
}: {
  cw: CategoryWeather
  index: number
}) {
  const cfg = conditionConfig(cw.condition, cw.temperature)
  const catStyle = getCategoryStyle(cw.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cn(
        'group relative rounded-2xl border overflow-hidden',
        'bg-gradient-to-b bg-surface-100',
        cfg.skyGrad,
        cfg.accentBorder,
      )}
    >
      {/* Top strip */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('h-2 w-2 rounded-full', catStyle.dot)} />
            <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', catStyle.color)}>
              {cw.category}
            </span>
          </div>
          <p className="text-lg font-mono font-bold text-white leading-tight">
            {cw.conditionLabel}
          </p>
          {cw.topicCount > 0 && (
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {cw.conditionDesc}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">{cfg.icon}</div>
      </div>

      {/* Stats row */}
      {cw.topicCount > 0 ? (
        <>
          <div className="px-5 pb-4 space-y-3">
            {/* Temperature (FOR vs AGAINST) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="h-3 w-3 text-surface-500" />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Consensus Temp
                  </span>
                </div>
                <span className={cn('text-[10px] font-mono font-semibold', cfg.tempColor)}>
                  {temperatureLabel(cw.temperature)}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                {/* FOR bar from left */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cw.temperature}%` }}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.05 }}
                  className="absolute left-0 top-0 h-full bg-for-500 rounded-full"
                />
                {/* Centre marker */}
                <div className="absolute left-1/2 top-0 h-full w-0.5 bg-surface-200 -translate-x-1/2" />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] font-mono text-for-400">
                  FOR {cw.temperature}%
                </span>
                <span className="text-[9px] font-mono text-against-400">
                  AGAINST {100 - cw.temperature}%
                </span>
              </div>
            </div>

            {/* Wind + Precipitation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Wind className="h-3 w-3 text-surface-500" />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Wind
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cw.wind}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.05 }}
                    className="h-full bg-for-500/60 rounded-full"
                  />
                </div>
                <p className="text-[9px] font-mono text-surface-500 mt-0.5">
                  {windLabel(cw.wind)}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Droplets className="h-3 w-3 text-surface-500" />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Polarisation
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cw.precipitation}%` }}
                    transition={{ duration: 0.5, delay: 0.35 + index * 0.05 }}
                    className="h-full bg-purple/70 rounded-full"
                  />
                </div>
                <p className="text-[9px] font-mono text-surface-500 mt-0.5">
                  {precipLabel(cw.precipitation)}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={cn('px-5 py-3 border-t flex items-center justify-between', cfg.accentBorder, cfg.accentBg)}>
            <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
              <span>{cw.topicCount} topic{cw.topicCount !== 1 ? 's' : ''}</span>
              {cw.lawCount > 0 && (
                <span className="flex items-center gap-1">
                  <Gavel className="h-3 w-3 text-gold" />
                  <span className="text-gold">{cw.lawCount} law{cw.lawCount !== 1 ? 's' : ''}</span>
                </span>
              )}
              {cw.trend !== 'stable' && (
                <span className={cn(
                  'flex items-center gap-0.5',
                  cw.trend === 'warming' ? 'text-for-400' : 'text-against-400',
                )}>
                  {cw.trend === 'warming'
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  {cw.trend === 'warming' ? 'FOR trending' : 'AGAINST trending'}
                </span>
              )}
            </div>

            <Link
              href={`/categories/${encodeURIComponent(cw.category)}`}
              className="flex items-center gap-1 text-[10px] font-mono text-surface-400 hover:text-white transition-colors"
              aria-label={`Browse ${cw.category} topics`}
            >
              Browse
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      ) : (
        <div className="px-5 pb-5">
          <p className="text-xs font-mono text-surface-600 italic">
            No active debates yet.{' '}
            <Link href="/topic/create" className="text-for-400 hover:underline">
              Start one
            </Link>
          </p>
        </div>
      )}

      {/* Hot topic chip */}
      {cw.hotTopicId && cw.hotTopicStatement && (
        <Link
          href={`/topic/${cw.hotTopicId}`}
          className={cn(
            'block px-5 py-2.5 border-t text-[10px] font-mono text-surface-400',
            'hover:text-white transition-colors group/hot',
            cfg.accentBorder,
          )}
        >
          <span className="text-gold mr-1.5">HOT:</span>
          <span className="group-hover/hot:text-white transition-colors">
            {cw.hotTopicStatement.length > 72
              ? cw.hotTopicStatement.slice(0, 69) + '…'
              : cw.hotTopicStatement}
          </span>
          <ExternalLink className="inline h-2.5 w-2.5 ml-1 opacity-0 group-hover/hot:opacity-100 transition-opacity" />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WeatherSkeleton() {
  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="rounded-2xl border border-surface-300 p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="flex gap-4 mt-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-300 p-5 space-y-3">
            <div className="flex justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-6 rounded" />
              <Skeleton className="h-6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const CONDITIONS: { c: WeatherCondition; label: string; desc: string }[] = [
  { c: 'scorching',     label: 'Clear Skies',    desc: 'Overwhelming consensus' },
  { c: 'sunny',         label: 'Mostly Sunny',   desc: 'Strong lean, little dissent' },
  { c: 'partly_cloudy', label: 'Partly Cloudy',  desc: 'Active but no clear winner' },
  { c: 'overcast',      label: 'Overcast',       desc: 'Contested, low activity' },
  { c: 'stormy',        label: 'Storm Warning',  desc: 'High polarisation' },
  { c: 'thunderstorm',  label: 'Thunderstorm',   desc: 'Maximum clash + activity' },
]

const LEGEND_ICONS: Record<WeatherCondition, React.ReactNode> = {
  scorching:     <Sun className="h-4 w-4 text-gold" />,
  sunny:         <Sun className="h-4 w-4 text-gold/60" />,
  partly_cloudy: <Cloud className="h-4 w-4 text-surface-400" />,
  overcast:      <Cloud className="h-4 w-4 text-surface-600" />,
  stormy:        <CloudRain className="h-4 w-4 text-purple/70" />,
  thunderstorm:  <CloudLightning className="h-4 w-4 text-against-400" />,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const [data, setData] = useState<CivicWeatherResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/civic-weather')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json as CivicWeatherResponse)
    } catch {
      // keep old data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(false)
    intervalRef.current = setInterval(() => fetchData(true), 5 * 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30">
                  <Cloud className="h-5 w-5 text-for-400" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white">
                    Civic Weather Report
                  </h1>
                  <p className="text-xs font-mono text-surface-500">{today}</p>
                </div>
              </div>
              <p className="text-sm font-mono text-surface-400 max-w-xl">
                The political climate across every debate category — measured in consensus,
                controversy, and civic wind speed.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowLegend((v) => !v)}
                className="text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {showLegend ? 'Hide' : 'Legend'}
              </button>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                aria-label="Refresh weather data"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Legend */}
          <AnimatePresence>
            {showLegend && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 p-4">
                  <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wide">
                    How to read the forecast
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CONDITIONS.map(({ c, label, desc }) => (
                      <div key={c} className="flex items-start gap-2">
                        <span className="flex-shrink-0 mt-0.5">{LEGEND_ICONS[c]}</span>
                        <div>
                          <p className="text-xs font-mono text-white">{label}</p>
                          <p className="text-[10px] font-mono text-surface-500">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-300 grid grid-cols-3 gap-2 text-[10px] font-mono text-surface-500">
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="h-3 w-3 text-gold" />
                      <span>Temperature = FOR vs AGAINST consensus split</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wind className="h-3 w-3 text-for-400" />
                      <span>Wind = weekly argument activity level</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Droplets className="h-3 w-3 text-purple" />
                      <span>Precipitation = % of topics near 50/50 deadlock</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        {loading ? (
          <WeatherSkeleton />
        ) : !data || data.categories.length === 0 ? (
          <EmptyState
            icon={<Cloud className="h-10 w-10 text-surface-600" />}
            title="Forecast unavailable"
            description="No debate data found. Check back once topics are active."
            action={{ label: 'Browse topics', href: '/' }}
          />
        ) : (
          <>
            {/* Global banner */}
            <GlobalBanner global={data.global} updatedAt={data.global.generatedAt} />

            {/* Category grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {data.categories.map((cw, i) => (
                <WeatherCard key={cw.category} cw={cw} index={i} />
              ))}
            </div>

            {/* Links strip */}
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wide">
                Explore the data
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { href: '/heatmap', label: 'Vote Heatmap', icon: BarChart2 },
                  { href: '/observatory', label: 'Observatory', icon: Zap },
                  { href: '/consensus', label: 'Consensus Bubbles', icon: Globe },
                  { href: '/drift', label: 'Opinion Drift', icon: TrendingUp },
                  { href: '/spectrum', label: 'Civic Spectrum', icon: BarChart2 },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
