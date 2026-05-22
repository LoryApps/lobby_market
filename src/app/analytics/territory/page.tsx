'use client'

/**
 * /analytics/territory — Civic Territory Map
 *
 * A 10×4 grid (categories × scopes) visualising which corners of
 * civic debate you have voted in. Each cell is coloured by vote
 * density; cells you haven't touched are dark.
 *
 * Distinct from:
 *   /analytics/tags         — tag-level vote breakdown
 *   /analytics/topics       — individual topic list
 *   /analytics/depth        — engagement depth per topic
 *   /analytics/consistency  — opinion consistency within categories
 *   /diversity              — simple category breadth bar chart
 *   /heatmap                — platform-wide category × scope matrix
 *
 * Territory combines BOTH category AND geographic scope to show
 * exactly which civic "territories" you've staked a position in.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Compass,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  TerritoryResponse,
  TerritoryCell,
  TerritoryArchetype,
} from '@/app/api/analytics/territory/route'

// ─── Archetype styling ────────────────────────────────────────────────────────

const ARCHETYPE_STYLE: Record<
  TerritoryArchetype,
  { color: string; bg: string; border: string; icon: typeof Globe }
> = {
  explorer: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Compass,
  },
  generalist: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Globe,
  },
  specialist: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Target,
  },
  pioneer: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Flag,
  },
  newcomer: {
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    icon: MapPin,
  },
}

// ─── Category icons / colors ──────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

const SCOPE_COLOR: Record<string, string> = {
  Global:   'text-for-400',
  National: 'text-gold',
  Regional: 'text-purple',
  Local:    'text-emerald',
}

// ─── Cell color ───────────────────────────────────────────────────────────────

function cellBg(cell: TerritoryCell): string {
  if (!cell.is_explored) return 'bg-surface-200/40'
  if (cell.is_mastered) return 'bg-gold/25 border-gold/40'
  if (cell.coverage >= 50) return 'bg-for-600/30 border-for-500/40'
  if (cell.coverage >= 20) return 'bg-for-700/25 border-for-600/30'
  return 'bg-for-900/20 border-for-800/20'
}

function cellOpacity(votes: number): string {
  if (votes === 0) return 'opacity-30'
  if (votes < 3) return 'opacity-60'
  if (votes < 8) return 'opacity-80'
  return 'opacity-100'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TerritorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-[340px] rounded-2xl" />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ─── Territory grid ───────────────────────────────────────────────────────────

const SCOPES = ['Global', 'National', 'Regional', 'Local'] as const

function TerritoryGrid({
  grid,
  categories,
}: {
  grid: TerritoryCell[][]
  categories: string[]
}) {
  const [hovered, setHovered] = useState<{ cat: number; scope: number } | null>(null)
  const hoveredCell = hovered ? grid[hovered.cat]?.[hovered.scope] : null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center">
          <BarChart2 className="h-4 w-4 text-for-400" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Territory Map</p>
          <p className="text-[11px] font-mono text-surface-500">Category × Scope coverage</p>
        </div>
      </div>

      {/* Scope header row */}
      <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '7rem repeat(4, 1fr)' }}>
        <div />
        {SCOPES.map((s) => (
          <div key={s} className="text-center">
            <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', SCOPE_COLOR[s])}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Grid rows */}
      <div className="space-y-1.5">
        {categories.map((cat, ci) => (
          <div key={cat} className="grid gap-1.5" style={{ gridTemplateColumns: '7rem repeat(4, 1fr)' }}>
            {/* Category label */}
            <div className="flex items-center pr-2">
              <span className={cn('text-[10px] font-mono font-semibold truncate', CAT_COLOR[cat] ?? 'text-surface-500')}>
                {cat}
              </span>
            </div>

            {/* Scope cells */}
            {SCOPES.map((scope, si) => {
              const cell = grid[ci]?.[si]
              if (!cell) return <div key={scope} className="h-8 rounded-md bg-surface-200/20" />

              const isHovered = hovered?.cat === ci && hovered?.scope === si

              return (
                <motion.div
                  key={scope}
                  className={cn(
                    'relative h-8 rounded-md border cursor-default transition-all duration-150',
                    cellBg(cell),
                    cellOpacity(cell.votes),
                    isHovered && 'ring-1 ring-white/30 scale-105 z-10',
                  )}
                  onMouseEnter={() => setHovered({ cat: ci, scope: si })}
                  onMouseLeave={() => setHovered(null)}
                  aria-label={`${cat} × ${scope}: ${cell.votes} votes`}
                >
                  {cell.is_mastered && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Trophy className="h-3 w-3 text-gold opacity-70" aria-hidden="true" />
                    </div>
                  )}
                  {cell.is_explored && !cell.is_mastered && cell.votes > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-white/60">
                        {cell.votes}
                      </span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Tooltip / hover detail */}
      <AnimatePresence>
        {hoveredCell && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="mt-3 rounded-lg bg-surface-200 border border-surface-300 px-3 py-2 flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-xs font-mono font-semibold text-white">
                {hoveredCell.category}
                <span className="text-surface-500 mx-1">×</span>
                {hoveredCell.scope}
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                {hoveredCell.votes} vote{hoveredCell.votes !== 1 ? 's' : ''}
                {hoveredCell.available > 0 && ` · ${hoveredCell.coverage}% coverage`}
                {hoveredCell.is_mastered && ' · Mastered'}
              </p>
            </div>
            {hoveredCell.is_explored && (
              <div className="flex gap-3 flex-shrink-0">
                <span className="text-xs font-mono font-bold text-for-400">{hoveredCell.for_pct}% FOR</span>
                <span className="text-xs font-mono font-bold text-against-400">{100 - hoveredCell.for_pct}% AGN</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Legend</span>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-surface-200/40 border border-surface-400/20 opacity-30" />
          <span className="text-[10px] font-mono text-surface-500">Unexplored</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-for-900/20 border border-for-800/20" />
          <span className="text-[10px] font-mono text-surface-500">Entered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-for-600/30 border border-for-500/40" />
          <span className="text-[10px] font-mono text-surface-500">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-gold/25 border border-gold/40 flex items-center justify-center">
            <Trophy className="h-2 w-2 text-gold" />
          </div>
          <span className="text-[10px] font-mono text-surface-500">Mastered</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TerritoryPage() {
  const router = useRouter()
  const [data, setData] = useState<TerritoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const categories = [
    'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
    'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/territory', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (!json.authenticated) {
        router.push('/login')
        return
      }
      setData(json as TerritoryResponse)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const archStyle = data ? ARCHETYPE_STYLE[data.archetype] : null
  const ArchIcon = archStyle?.icon ?? Compass

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-white truncate">Territory Map</h1>
              <Badge variant="proposed" className="hidden sm:flex">Analytics</Badge>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Which civic territories have you staked a position in?</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            aria-label="Refresh territory data"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TerritorySkeleton />
          </motion.div>
        )}

        {!loading && error && (
          <div className="py-12">
            <EmptyState
              icon={BarChart2}
              title="Couldn't load territory data"
              description="Something went wrong. Try refreshing."
              actions={[{ label: 'Retry', onClick: load }]}
            />
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Archetype banner */}
              <div className={cn(
                'rounded-2xl border p-5 flex items-start gap-4',
                archStyle?.bg, archStyle?.border,
              )}>
                <div className={cn('h-11 w-11 rounded-xl border flex items-center justify-center flex-shrink-0', archStyle?.bg, archStyle?.border)}>
                  <ArchIcon className={cn('h-5 w-5', archStyle?.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('font-mono text-base font-bold', archStyle?.color)}>{data.archetype_label}</p>
                    <span className="text-surface-500 font-mono text-xs">·</span>
                    <p className="font-mono text-xs text-surface-400 italic">{data.archetype_tagline}</p>
                  </div>
                  <p className="text-xs text-surface-400 font-mono mt-1 leading-relaxed">{data.archetype_description}</p>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Territory Score"
                  value={data.territory_score}
                  sub="out of 100"
                  icon={Zap}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  animateValue={data.territory_score}
                />
                <StatCard
                  label="Territories"
                  value={`${data.territories_explored}/40`}
                  sub="explored"
                  icon={Flag}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10"
                  animateValue={data.territories_explored}
                />
                <StatCard
                  label="Mastered"
                  value={data.territories_mastered}
                  sub="≥80% coverage"
                  icon={Trophy}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  animateValue={data.territories_mastered}
                />
                <StatCard
                  label="Total Votes"
                  value={data.total_votes}
                  sub="cast across map"
                  icon={BarChart2}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10"
                  animateValue={data.total_votes}
                />
              </div>

              {/* Territory grid */}
              {data.grid.length > 0 && (
                <TerritoryGrid grid={data.grid} categories={categories} />
              )}

              {/* Scope breakdown */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                <p className="font-mono text-sm font-semibold text-white mb-3">Scope Coverage</p>
                <div className="space-y-2.5">
                  {data.scope_totals.map((st) => {
                    const pct = Math.round((st.explored_categories / 10) * 100)
                    return (
                      <div key={st.scope} className="flex items-center gap-3">
                        <span className={cn('text-[11px] font-mono font-semibold w-20 flex-shrink-0', SCOPE_COLOR[st.scope])}>
                          {st.scope}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-surface-300/30 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-for-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500 w-20 text-right flex-shrink-0">
                          {st.explored_categories}/10 cats · {st.votes}v
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                <p className="font-mono text-sm font-semibold text-white mb-3">Category Coverage</p>
                <div className="space-y-2.5">
                  {data.category_totals.map((ct) => {
                    const pct = Math.round((ct.explored_scopes / 4) * 100)
                    return (
                      <div key={ct.category} className="flex items-center gap-3">
                        <span className={cn('text-[11px] font-mono font-semibold w-24 flex-shrink-0 truncate', CAT_COLOR[ct.category])}>
                          {ct.category}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-surface-300/30 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-for-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500 w-20 text-right flex-shrink-0">
                          {ct.explored_scopes}/4 scopes · {ct.votes}v
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top territories */}
              {data.top_territories.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono text-sm font-semibold text-white">Top Territories</p>
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    {data.top_territories.map((t, i) => (
                      <Link
                        key={`${t.category}-${t.scope}`}
                        href={`/topic/categories/${t.category.toLowerCase()}?scope=${t.scope}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
                      >
                        <span className="font-mono text-[10px] text-surface-500 w-4 text-center flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-semibold text-white">
                            {t.category}
                            <span className="text-surface-500 mx-1">×</span>
                            <span className={SCOPE_COLOR[t.scope]}>{t.scope}</span>
                          </p>
                          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{t.votes} votes</p>
                        </div>
                        <div className="flex gap-2 items-center flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold text-for-400">{t.for_pct}%</span>
                          <span className="text-[10px] font-mono text-surface-600">FOR</span>
                        </div>
                        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Unexplored territories */}
              {data.unexplored.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono text-sm font-semibold text-white">Scout These Next</p>
                    <MapPin className="h-4 w-4 text-against-400" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] font-mono text-surface-500 mb-3">
                    Unexplored territories with active debates
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.unexplored.slice(0, 6).map((t) => (
                      <Link
                        key={`${t.category}-${t.scope}`}
                        href={`/topic/categories/${t.category.toLowerCase()}?scope=${t.scope}`}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-200/30 border border-dashed border-surface-400/30 hover:border-surface-400/60 hover:bg-surface-200/50 transition-colors group"
                      >
                        <div className="h-6 w-6 rounded-md bg-surface-300/50 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-3 w-3 text-surface-500" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-mono font-semibold text-surface-300 truncate">
                            {t.category} × {t.scope}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500">{t.available} topic{t.available !== 1 ? 's' : ''} available</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for new users */}
              {data.total_votes === 0 && (
                <EmptyState
                  icon={Compass}
                  title="No territory yet"
                  description="Start voting on topics to build your civic territory map."
                  actions={[{ label: 'Browse topics', href: '/topics' }]}
                />
              )}

              {/* Back link */}
              <div className="pt-2">
                <Link
                  href="/analytics"
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                  All analytics
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
