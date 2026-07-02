'use client'

/**
 * /topic/[id]/global — Global Context Analyzer
 *
 * Shows how this civic debate maps onto real-world policy worldwide:
 * regional stances, leading/opposing countries, global support percentage,
 * and alignment between the Lobby Market community and worldwide opinion.
 *
 * Distinct from:
 *   /parallels    — historical precedents from the past
 *   /impact       — projected domestic impact
 *   /stakeholders — groups affected by this debate
 *   /correlations — cross-topic correlations within the platform
 *
 * This is the only page dedicated to a live global comparison view,
 * mapping the Lobby's debate onto the current state of the world.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Globe2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { GlobalContextResponse, WorldRegion, CountryData, RegionStance } from '@/app/api/topics/[id]/global/route'

// ─── Stance helpers ───────────────────────────────────────────────────────────

const STANCE_CONFIG: Record<RegionStance, {
  label: string
  dot: string
  text: string
  bg: string
  border: string
  bar: string
}> = {
  majority_for: {
    label: 'FOR',
    dot: 'bg-for-400',
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
  },
  majority_against: {
    label: 'AGAINST',
    dot: 'bg-against-400',
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
  },
  contested: {
    label: 'CONTESTED',
    dot: 'bg-purple',
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    bar: 'bg-purple',
  },
  neutral: {
    label: 'NEUTRAL',
    dot: 'bg-surface-400',
    text: 'text-surface-400',
    bg: 'bg-surface-200/60',
    border: 'border-surface-300/60',
    bar: 'bg-surface-400',
  },
}

// ─── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: CountryData['trend'] }) {
  if (trend === 'rising') return <TrendingUp className="h-3 w-3 text-emerald" />
  if (trend === 'falling') return <TrendingDown className="h-3 w-3 text-against-400" />
  return <ArrowRight className="h-3 w-3 text-surface-400" />
}

// ─── Global pulse bar ─────────────────────────────────────────────────────────

function GlobalPulseBar({ globalPct, lobbyPct }: { globalPct: number; lobbyPct: number }) {
  const forPct = Math.round(globalPct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[11px] font-mono text-surface-400 uppercase tracking-widest">
        <span>Global FOR</span>
        <span>Global AGAINST</span>
      </div>
      <div className="relative h-4 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full bg-for-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {/* Lobby marker */}
        <motion.div
          className="absolute top-0 h-full w-0.5 bg-white/80 shadow"
          initial={{ left: '50%' }}
          animate={{ left: `${lobbyPct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          title={`Lobby Market: ${lobbyPct}% FOR`}
        />
      </div>
      <div className="flex justify-between text-sm font-bold tabular-nums">
        <span className="text-for-400">{forPct}%</span>
        <span className="text-surface-400 text-xs font-normal">
          Lobby {lobbyPct}% <span className="text-surface-500">▲</span>
        </span>
        <span className="text-against-400">{againstPct}%</span>
      </div>
    </div>
  )
}

// ─── Region card ──────────────────────────────────────────────────────────────

function RegionCard({ region }: { region: WorldRegion }) {
  const [expanded, setExpanded] = useState(false)
  const sc = STANCE_CONFIG[region.stance]
  const forCount = region.countries.filter((c) => c.supportPct >= 55).length
  const againstCount = region.countries.filter((c) => c.supportPct <= 45).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-colors cursor-pointer',
        sc.bg, sc.border
      )}
    >
      {/* Header row */}
      <button
        className="w-full flex items-start gap-4 p-5 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={`${region.name} – ${sc.label}`}
      >
        {/* Stance dot */}
        <div className={cn('mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0', sc.dot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{region.name}</p>
            <Badge className={cn('text-[10px] font-mono px-2 py-0.5 border', sc.text, sc.bg, sc.border)}>
              {sc.label}
            </Badge>
            <span className={cn('ml-auto text-xl font-black tabular-nums', sc.text)}>
              {region.supportPct}%
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-1 leading-snug line-clamp-2">
            {region.summary}
          </p>
          <div className="flex gap-3 mt-2">
            <span className="text-[10px] font-mono text-for-400">{forCount} FOR</span>
            <span className="text-[10px] font-mono text-against-400">{againstCount} AGAINST</span>
            <span className="text-[10px] font-mono text-surface-500">{region.countries.length - forCount - againstCount} NEUTRAL</span>
          </div>
        </div>

        <div className="flex-shrink-0 text-surface-500 mt-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded countries */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-2">
              {/* Key development */}
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 mb-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Key Development</p>
                <p className="text-xs text-surface-300 leading-relaxed">{region.keyDevelopment}</p>
              </div>
              {/* Country list */}
              {region.countries.map((c) => (
                <CountryRow key={c.code} country={c} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Country row ──────────────────────────────────────────────────────────────

function CountryRow({ country }: { country: CountryData }) {
  const sc = STANCE_CONFIG[country.stance]
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-200/40 border border-surface-300/40 p-3">
      <span className="text-xl flex-shrink-0" aria-hidden>{country.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-white truncate">{country.name}</p>
          <TrendIcon trend={country.trend} />
        </div>
        <p className="text-[10px] text-surface-500 truncate">{country.policyStatus}</p>
        <p className="text-[10px] text-surface-400 leading-snug mt-0.5 line-clamp-2">{country.note}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={cn('text-sm font-bold tabular-nums', sc.text)}>{country.supportPct}%</p>
        <p className="text-[10px] font-mono text-surface-500">{sc.label}</p>
      </div>
    </div>
  )
}

// ─── Alignment meter ──────────────────────────────────────────────────────────

function AlignmentMeter({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? 'text-emerald' :
    score >= 60 ? 'text-gold' :
    score >= 40 ? 'text-purple' :
    'text-against-400'
  const barColor =
    score >= 80 ? 'bg-emerald' :
    score >= 60 ? 'bg-gold' :
    score >= 40 ? 'bg-purple' :
    'bg-against-500'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest mb-1">Lobby Alignment</p>
          <p className={cn('text-4xl font-black tabular-nums', color)}>{score}</p>
          <p className="text-xs text-surface-500 mt-0.5">out of 100</p>
        </div>
        <Badge className={cn(
          'text-xs font-mono px-3 py-1.5 border',
          score >= 80 ? 'bg-emerald/20 text-emerald border-emerald/30' :
          score >= 60 ? 'bg-gold/20 text-gold border-gold/30' :
          score >= 40 ? 'bg-purple/20 text-purple border-purple/30' :
          'bg-against-500/20 text-against-300 border-against-500/30'
        )}>
          {label}
        </Badge>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-surface-400 leading-relaxed">
        {score >= 80
          ? "The Lobby Market community's stance is well within the range of global opinion."
          : score >= 60
          ? 'The Lobby community generally aligns with the global direction, with some divergence.'
          : score >= 40
          ? 'The Lobby community diverges meaningfully from the global average on this issue.'
          : 'The Lobby community takes a significantly different position from global opinion.'}
      </p>
    </div>
  )
}

// ─── Country list section ─────────────────────────────────────────────────────

function CountryList({
  title,
  countries,
  icon,
  iconColor,
}: {
  title: string
  countries: CountryData[]
  icon: React.ReactNode
  iconColor: string
}) {
  if (countries.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <p className="text-xs font-mono text-surface-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="space-y-2">
        {countries.map((c) => (
          <div
            key={c.code}
            className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-3"
          >
            <span className="text-xl" aria-hidden>{c.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{c.name}</p>
              <p className="text-[10px] text-surface-500 truncate">{c.policyStatus}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={c.trend} />
              <span className={cn(
                'text-sm font-bold tabular-nums',
                c.supportPct >= 55 ? 'text-for-400' : 'text-against-400'
              )}>
                {c.supportPct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GlobalSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
}

export function GlobalContextClient({ topicId, topicStatement }: Props) {
  const [data, setData] = useState<GlobalContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/global`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as GlobalContextResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const lobbyPct = data?.topic.blue_pct ?? 50
  const globalPct = data?.globalSupportPct ?? 50

  const trendIcon =
    data?.trendDirection === 'towards_support' ? <TrendingUp className="h-4 w-4 text-emerald" /> :
    data?.trendDirection === 'towards_opposition' ? <TrendingDown className="h-4 w-4 text-against-400" /> :
    <Scale className="h-4 w-4 text-surface-400" />

  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">

          {/* Back + header */}
          <div>
            <Link
              href={`/topic/${topicId}`}
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to topic
            </Link>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center">
                <Globe2 className="h-4 w-4 text-purple" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wider">Global Context</h1>
                <p className="text-xs text-surface-400 mt-0.5 leading-snug line-clamp-2">
                  {topicStatement}
                </p>
              </div>
            </div>
          </div>

          {loading && <GlobalSkeleton />}

          {error && (
            <EmptyState
              icon={Globe2}
              title="Global data unavailable"
              description="Could not load global context data. Try refreshing."
              action={{ label: 'Retry', onClick: load }}
            />
          )}

          {data && !loading && (
            <>
              {/* Global pulse */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest mb-1">Global Pulse</p>
                    <p className="text-3xl font-black tabular-nums text-white">{globalPct}%</p>
                    <p className="text-xs text-surface-400">worldwide support estimate</p>
                  </div>
                  <div className="text-right">
                    <Badge className={cn(
                      'text-xs font-mono px-3 py-1.5 border mb-2',
                      globalPct >= 55
                        ? 'bg-for-500/20 text-for-300 border-for-500/30'
                        : globalPct >= 45
                        ? 'bg-purple/20 text-purple border-purple/30'
                        : 'bg-against-500/20 text-against-300 border-against-500/30'
                    )}>
                      {data.globalLabel}
                    </Badge>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      {trendIcon}
                      <span className="text-[10px] text-surface-400">
                        {data.trendDirection === 'towards_support' ? 'Momentum FOR' :
                         data.trendDirection === 'towards_opposition' ? 'Momentum AGAINST' :
                         'Stable globally'}
                      </span>
                    </div>
                  </div>
                </div>

                <GlobalPulseBar globalPct={globalPct} lobbyPct={lobbyPct} />

                <div className="pt-1 border-t border-surface-300">
                  <p className="text-xs text-surface-400 leading-relaxed">{data.globalInsight}</p>
                </div>
              </div>

              {/* Trend reason */}
              <div className="rounded-xl bg-surface-100/50 border border-surface-300/50 p-4 flex gap-3">
                <div className="flex-shrink-0 mt-0.5">{trendIcon}</div>
                <p className="text-xs text-surface-300 leading-relaxed">{data.trendReason}</p>
              </div>

              {/* Alignment score */}
              <AlignmentMeter score={data.alignmentScore} label={data.alignmentLabel} />

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'FOR Regions',
                    value: data.regions.filter((r) => r.stance === 'majority_for').length,
                    color: 'text-for-400',
                    sub: 'of 9 regions',
                  },
                  {
                    label: 'AGAINST Regions',
                    value: data.regions.filter((r) => r.stance === 'majority_against').length,
                    color: 'text-against-400',
                    sub: 'of 9 regions',
                  },
                  {
                    label: 'FOR Countries',
                    value: data.leadingCountries.length,
                    color: 'text-emerald',
                    sub: '≥60% support',
                  },
                  {
                    label: 'AGAINST Countries',
                    value: data.opposingCountries.length,
                    color: 'text-against-400',
                    sub: '≤40% support',
                  },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                    <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest mb-1">{label}</p>
                    <p className={cn('text-3xl font-black tabular-nums', color)}>{value}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Leading / opposing countries */}
              <div className="grid sm:grid-cols-2 gap-4">
                <CountryList
                  title="Most Supportive"
                  countries={data.leadingCountries}
                  icon={<ThumbsUp className="h-3.5 w-3.5" />}
                  iconColor="text-for-400"
                />
                <CountryList
                  title="Most Opposed"
                  countries={data.opposingCountries}
                  icon={<ThumbsDown className="h-3.5 w-3.5" />}
                  iconColor="text-against-400"
                />
              </div>

              {/* Regional breakdown */}
              <div>
                <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest mb-3">
                  Regional Breakdown
                </p>
                <div className="space-y-2">
                  {data.regions.map((region) => (
                    <RegionCard key={region.id} region={region} />
                  ))}
                </div>
              </div>

              {/* Refresh */}
              <button
                onClick={load}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs text-surface-400 hover:text-surface-200 hover:border-surface-300 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh global data
              </button>

              {/* Nav to other analyses */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {[
                  { href: `/topic/${topicId}/parallels`, label: 'Historical Parallels' },
                  { href: `/topic/${topicId}/impact`, label: 'Impact Analysis' },
                  { href: `/topic/${topicId}/stakeholders`, label: 'Stakeholders' },
                  { href: `/topic/${topicId}/forecast`, label: 'Outcome Forecast' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between gap-1.5 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                  >
                    <span className="text-xs text-surface-300 truncate">{label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
