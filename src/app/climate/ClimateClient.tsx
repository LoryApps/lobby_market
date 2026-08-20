'use client'

/**
 * /climate — Civic Climate Report
 *
 * A "weather report" for the current state of civic discourse on the platform.
 * Uses meteorological metaphors to summarise platform-wide sentiment:
 *   - Storms      = highly contested topics (near 50/50 split)
 *   - Clear skies = topics with strong consensus
 *   - Forecast    = topics near resolution (approaching law threshold)
 *   - Category    = per-domain climate breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Cloud,
  CloudLightning,
  CloudRain,
  Loader2,
  RefreshCw,
  Sun,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  Wind,
  Zap,
  CloudSun,
  Gauge,
  Map,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ClimateResponse,
  ClimateCondition,
  ClimateStorm,
  ClimateSunny,
  ClimateForecast,
  CategoryClimate,
} from '@/app/api/climate/route'

// ─── Condition config ─────────────────────────────────────────────────────────

const CONDITION_CONFIG: Record<
  ClimateCondition,
  {
    icon: typeof CloudLightning
    label: string
    color: string
    bg: string
    border: string
    glow: string
  }
> = {
  stormy:    { icon: CloudLightning, label: 'Stormy',    color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', glow: 'shadow-against-500/20' },
  unsettled: { icon: CloudRain,      label: 'Unsettled', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   glow: 'shadow-amber-500/15'   },
  mixed:     { icon: Cloud,          label: 'Mixed',     color: 'text-surface-500', bg: 'bg-surface-200',    border: 'border-surface-300',    glow: 'shadow-none'           },
  improving: { icon: CloudSun,       label: 'Improving', color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/25',     glow: 'shadow-for-500/15'     },
  clear:     { icon: Sun,            label: 'Clear',     color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/20'        },
}

const CATEGORY_CONDITION_ICON: Record<CategoryClimate['condition'], typeof Cloud> = {
  stormy: CloudLightning,
  mixed:  Cloud,
  clear:  Sun,
}

const CATEGORY_CONDITION_COLOR: Record<CategoryClimate['condition'], string> = {
  stormy: 'text-against-400',
  mixed:  'text-surface-500',
  clear:  'text-gold',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function VoteBar({ bluePct }: { bluePct: number }) {
  const red = Math.round(100 - bluePct)
  const blue = Math.round(bluePct)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-for-400 w-6 text-right tabular-nums">{blue}%</span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full transition-all" style={{ width: `${bluePct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-6 tabular-nums">{red}%</span>
    </div>
  )
}

function ContestBar({ contestedness }: { contestedness: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className="h-full bg-against-500 rounded-full"
          style={{ width: `${contestedness}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums shrink-0">
        {contestedness}%
      </span>
    </div>
  )
}

// ─── Section components ───────────────────────────────────────────────────────

function StormCard({ storm, index }: { storm: ClimateStorm; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/topic/${storm.id}`} className="block group">
        <div className="bg-surface-200 border border-against-500/20 rounded-xl p-4 hover:border-against-500/40 hover:bg-surface-300/20 transition-all">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-sm text-white leading-snug group-hover:text-against-300 transition-colors line-clamp-2">
              {storm.statement}
            </p>
            <ArrowRight className="h-4 w-4 text-surface-500 shrink-0 mt-0.5 group-hover:text-against-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
              <span className="flex items-center gap-1">
                <CloudLightning className="h-3 w-3 text-against-400" />
                Contest level
              </span>
              <span className="text-[10px]">{fmtVotes(storm.total_votes)} votes</span>
            </div>
            <ContestBar contestedness={storm.contestedness} />
            <VoteBar bluePct={storm.blue_pct} />
          </div>
          {storm.category && (
            <Badge variant="proposed" className="mt-2 text-[10px]">
              {storm.category}
            </Badge>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

function SunnyCard({ topic, index }: { topic: ClimateSunny; index: number }) {
  const isFor = topic.side === 'for'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div className={cn(
          'border rounded-xl p-4 transition-all',
          isFor
            ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
            : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
        )}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className={cn(
              'text-sm leading-snug line-clamp-2 transition-colors',
              isFor ? 'text-white group-hover:text-for-300' : 'text-white group-hover:text-against-300'
            )}>
              {topic.statement}
            </p>
            <ArrowRight className="h-4 w-4 text-surface-500 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            {isFor ? (
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
            )}
            <span className={cn('text-xs font-mono font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
              {isFor ? topic.blue_pct : Math.round(100 - topic.blue_pct)}% {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[10px] text-surface-500 ml-auto">{fmtVotes(topic.total_votes)} votes</span>
          </div>
          <VoteBar bluePct={topic.blue_pct} />
          {topic.category && (
            <Badge variant="proposed" className="mt-2 text-[10px]">
              {topic.category}
            </Badge>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

function ForecastRow({ topic, index }: { topic: ClimateForecast; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link href={`/topic/${topic.id}`} className="flex items-start gap-3 py-3 group">
        <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 mt-0.5">
          <TrendingUp className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug group-hover:text-gold transition-colors line-clamp-2 mb-1.5">
            {topic.statement}
          </p>
          <div className="flex items-center gap-3">
            <VoteBar bluePct={topic.blue_pct} />
            {topic.distance_to_law > 0 && (
              <span className="text-[10px] text-gold/70 shrink-0">+{topic.distance_to_law}% to law</span>
            )}
            {topic.distance_to_law === 0 && (
              <span className="text-[10px] text-gold shrink-0 font-semibold">At threshold</span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

function CategoryClimateRow({ cat }: { cat: CategoryClimate }) {
  const Icon = CATEGORY_CONDITION_ICON[cat.condition]
  const color = CATEGORY_CONDITION_COLOR[cat.condition]
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300 last:border-0">
      <Icon className={cn('h-4 w-4 shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-white">{cat.name}</span>
          <span className="text-[10px] text-surface-500">{cat.topicCount} topics</span>
        </div>
        <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
          <div className="h-full bg-for-500/60 rounded-full" style={{ width: `${cat.avgBluePct}%` }} />
        </div>
      </div>
      <span className={cn('text-xs font-mono capitalize shrink-0', color)}>
        {cat.condition}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClimateClient() {
  const [data, setData] = useState<ClimateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/climate', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as ClimateResponse
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

  const config = data ? CONDITION_CONFIG[data.condition] : null
  const ConditionIcon = config?.icon ?? Cloud

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Civic Climate</h1>
            <p className="text-sm text-surface-500 mt-0.5">Today&apos;s civic discourse forecast</p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors disabled:opacity-50"
            aria-label="Refresh climate data"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Current Conditions */}
        {loading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-2xl border p-5 shadow-lg',
              config?.bg, config?.border, config?.glow
            )}
          >
            <div className="flex items-start gap-4">
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', config?.bg, 'border', config?.border)}>
                <ConditionIcon className={cn('h-7 w-7', config?.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-lg font-bold', config?.color)}>{config?.label}</span>
                  <span className="text-xs text-surface-500">conditions</span>
                </div>
                <p className="text-sm text-surface-600 leading-relaxed mb-3">
                  {data.conditionText}
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 text-surface-500" />
                    <span className="text-xs text-surface-500">{data.totalActiveTopics} active topics</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wind className="h-3.5 w-3.5 text-surface-500" />
                    <span className="text-xs text-surface-500">{data.totalVotingTopics} in final vote</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="h-3.5 w-3.5 text-surface-500" />
                    <span className="text-xs text-surface-500">
                      Platform: {data.platformBluePct}% FOR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* Category breakdown */}
        {data && data.categories.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Map className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-white">Climate by Domain</h2>
            </div>
            <div className="bg-surface-200 border border-surface-300 rounded-2xl px-4 py-1">
              {data.categories.map((cat) => (
                <CategoryClimateRow key={cat.name} cat={cat} />
              ))}
            </div>
          </section>
        )}

        {/* Storm systems */}
        {data && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CloudLightning className="h-4 w-4 text-against-400" />
              <h2 className="text-sm font-semibold text-white">Storm Systems</h2>
              <span className="text-xs text-surface-500">Highly contested debates</span>
            </div>
            {data.storms.length === 0 ? (
              <EmptyState
                icon={CloudLightning}
                title="No active storms"
                description="Debates are relatively calm right now — no highly contested topics detected."
                className="bg-surface-200 border-surface-300"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.storms.map((storm, i) => (
                  <StormCard key={storm.id} storm={storm} index={i} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Clear skies */}
        {data && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sun className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Clear Skies</h2>
              <span className="text-xs text-surface-500">Strong consensus forming</span>
            </div>
            {data.sunny.length === 0 ? (
              <EmptyState
                icon={Sun}
                title="No clear skies yet"
                description="No topics have reached strong consensus right now."
                className="bg-surface-200 border-surface-300"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.sunny.map((topic, i) => (
                  <SunnyCard key={topic.id} topic={topic} index={i} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Forecast */}
        {data && data.forecast.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Forecast</h2>
              <span className="text-xs text-surface-500">Topics approaching law status</span>
            </div>
            <div className="bg-surface-200 border border-gold/20 rounded-2xl px-4 divide-y divide-surface-300">
              {data.forecast.map((topic, i) => (
                <ForecastRow key={topic.id} topic={topic} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Loading state for sections */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-40" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
          </div>
        )}

        {/* Footer links */}
        {!loading && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2 pt-2"
            >
              {[
                { href: '/temperature', label: 'Heat Index', icon: Thermometer },
                { href: '/mood', label: 'Civic Mood', icon: Cloud },
                { href: '/flashpoint', label: 'Flashpoint', icon: Zap },
                { href: '/tipping-point', label: 'Tipping Point', icon: TrendingUp },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-200 border border-surface-300 rounded-full text-xs text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Link>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
