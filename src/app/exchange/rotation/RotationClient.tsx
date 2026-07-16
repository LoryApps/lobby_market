'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Compass,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategorySnapshot, RotationPhase, RotationResponse } from '@/app/api/exchange/rotation/route'

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<
  RotationPhase,
  { label: string; description: string; color: string; bg: string; border: string; icon: typeof TrendingUp }
> = {
  leading: {
    label: 'Leading',
    description: 'High consensus + rising momentum — strongest sectors right now',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: TrendingUp,
  },
  recovering: {
    label: 'Recovering',
    description: 'Lower consensus but gaining — sectors heating up',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: TrendingUp,
  },
  weakening: {
    label: 'Weakening',
    description: 'High consensus but losing steam — watch for reversals',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: TrendingDown,
  },
  lagging: {
    label: 'Lagging',
    description: 'Low consensus + flat or falling — weakest sectors',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: TrendingDown,
  },
}

// ─── Category accent colors ───────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald-400',
  Ethics:      'text-surface-400',
  Philosophy:  'text-surface-500',
  Culture:     'text-for-300',
  Health:      'text-emerald-300',
  Environment: 'text-emerald-400',
  Education:   'text-for-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function momentumArrow(m: number): { label: string; color: string } {
  if (m >= 5)  return { label: `↑ +${m.toFixed(1)}pt`, color: 'text-emerald-400' }
  if (m >= 1.5) return { label: `↑ +${m.toFixed(1)}pt`, color: 'text-for-400' }
  if (m <= -5)  return { label: `↓ ${m.toFixed(1)}pt`,  color: 'text-against-400' }
  if (m <= -1.5) return { label: `↓ ${m.toFixed(1)}pt`, color: 'text-against-300' }
  return { label: `→ ${m >= 0 ? '+' : ''}${m.toFixed(1)}pt`, color: 'text-surface-500' }
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, index }: { cat: CategorySnapshot; index: number }) {
  const phase    = PHASE_CONFIG[cat.phase]
  const PhaseIcon = phase.icon
  const arrow    = momentumArrow(cat.momentum)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        phase.bg, phase.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={cn('text-base font-semibold', CAT_COLOR[cat.category] ?? 'text-surface-300')}>
              {cat.category}
            </h3>
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded border', phase.bg, phase.border, phase.color)}>
              {phase.label}
            </span>
          </div>
          <p className="text-xs text-surface-600">
            {cat.active_topic_count} live · {cat.topic_count} total
          </p>
        </div>
        <PhaseIcon className={cn('w-5 h-5 shrink-0 mt-0.5', phase.color)} />
      </div>

      {/* Price bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-surface-500">Avg consensus</span>
          <span className={cn('text-sm font-bold tabular-nums', priceColor(cat.current_avg_price))}>
            {cat.current_avg_price.toFixed(1)}¢
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              cat.current_avg_price >= 67 ? 'bg-gold' :
              cat.current_avg_price >= 55 ? 'bg-for-500' :
              cat.current_avg_price <= 33 ? 'bg-against-500' :
              cat.current_avg_price <= 45 ? 'bg-against-600' :
              'bg-surface-600'
            )}
            style={{ width: `${cat.current_avg_price}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-surface-600">7d change</p>
            <p className={cn('text-xs font-semibold tabular-nums', arrow.color)}>
              {arrow.label}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-600">Avg volume</p>
            <p className="text-xs font-semibold text-surface-400 tabular-nums">
              {cat.avg_volume.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Top topic */}
        {cat.top_topic && (
          <Link
            href={`/exchange/${cat.top_topic.id}`}
            className="group flex items-center gap-1 text-xs text-surface-600 hover:text-surface-300 transition-colors"
          >
            Top pick <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {/* Top topic preview */}
      {cat.top_topic && (
        <div className="mt-2.5 pt-2.5 border-t border-surface-700/40">
          <Link href={`/exchange/${cat.top_topic.id}`} className="group">
            <p className="text-xs text-surface-500 line-clamp-1 group-hover:text-surface-300 transition-colors">
              {cat.top_topic.statement}
            </p>
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Quadrant diagram ─────────────────────────────────────────────────────────

function QuadrantDiagram({ categories }: { categories: CategorySnapshot[] }) {
  return (
    <div className="relative rounded-xl border border-surface-700/60 bg-surface-800/30 overflow-hidden mb-6">
      {/* Axis labels */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-surface-600">
        High Consensus →
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-surface-600">
        ← Low Consensus
      </div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-surface-600 -rotate-90 origin-center">
        Momentum ↑
      </div>

      {/* Grid lines */}
      <div className="relative h-56 mt-4 mb-4 mx-8">
        <div className="absolute inset-0 border border-surface-700/30 rounded" />
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-surface-700/30 border-dashed" />
        <div className="absolute top-1/2 left-0 right-0 border-t border-surface-700/30 border-dashed" />

        {/* Quadrant labels */}
        <div className="absolute top-2 right-2 text-xs text-emerald-500/50 font-medium">LEADING</div>
        <div className="absolute top-2 left-2 text-xs text-for-500/50 font-medium">RECOVERING</div>
        <div className="absolute bottom-2 right-2 text-xs text-gold/50 font-medium">WEAKENING</div>
        <div className="absolute bottom-2 left-2 text-xs text-against-500/50 font-medium">LAGGING</div>

        {/* Category dots */}
        {categories.map((cat) => {
          const x = (cat.current_avg_price / 100) * 100 // 0-100%
          // Momentum: normalize to 0-100% where 50% = 0 momentum, ±10pt = extremes
          const yMomentum = 50 - (cat.momentum / 10) * 50
          const clampedY = Math.max(2, Math.min(96, yMomentum))
          const catColor = CAT_COLOR[cat.category]

          return (
            <Link
              key={cat.category}
              href={`/categories/${cat.category}`}
              className="absolute group"
              style={{
                left: `${Math.max(2, Math.min(96, x))}%`,
                top: `${clampedY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full border-2 border-surface-800 transition-transform group-hover:scale-150',
                  PHASE_CONFIG[cat.phase].color.replace('text-', 'bg-'),
                )}
              />
              <div className={cn(
                'absolute left-1/2 -translate-x-1/2 bottom-full mb-1',
                'bg-surface-900/90 text-xs px-1.5 py-0.5 rounded whitespace-nowrap',
                'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10',
                catColor
              )}>
                {cat.category}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function RotationSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-56 rounded-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function RotationClient() {
  const [data, setData]       = useState<RotationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [refreshed, setRefreshed] = useState(false)
  const [activePhase, setActivePhase] = useState<RotationPhase | 'all'>('all')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/rotation')
      if (!res.ok) throw new Error('Failed to load rotation data')
      const json: RotationResponse = await res.json()
      setData(json)
      if (silent) {
        setRefreshed(true)
        setTimeout(() => setRefreshed(false), 2000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = (data?.categories ?? []).filter(
    (c) => activePhase === 'all' || c.phase === activePhase
  )

  const phaseCounts = Object.fromEntries(
    (['leading', 'recovering', 'weakening', 'lagging'] as RotationPhase[]).map((p) => [
      p,
      (data?.categories ?? []).filter((c) => c.phase === p).length,
    ])
  ) as Record<RotationPhase, number>

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Back */}
        <div className="mb-4">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exchange
          </Link>
        </div>

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Compass className="w-5 h-5 text-gold" />
              <h1 className="text-xl font-bold text-white">Sector Rotation</h1>
            </div>
            <p className="text-sm text-surface-500 leading-relaxed">
              Which civic debate categories are leading, recovering, weakening, or lagging
              based on 7-day consensus momentum.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors mt-1 shrink-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshed && 'text-emerald-400')} />
            {refreshed ? 'Updated' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <RotationSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-against-400 opacity-60" />
            <p className="text-surface-400 text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="text-xs text-for-400 hover:text-for-300"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Quadrant diagram */}
            {data && data.categories.length > 0 && (
              <QuadrantDiagram categories={data.categories} />
            )}

            {/* Phase filter pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setActivePhase('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  activePhase === 'all'
                    ? 'bg-surface-700 text-white border-surface-600'
                    : 'bg-surface-800/50 text-surface-500 border-surface-700/60 hover:text-surface-300'
                )}
              >
                All ({data?.categories.length ?? 0})
              </button>
              {(Object.entries(PHASE_CONFIG) as [RotationPhase, typeof PHASE_CONFIG.leading][]).map(
                ([phase, config]) => {
                  const Icon = config.icon
                  const count = phaseCounts[phase] ?? 0
                  return (
                    <button
                      key={phase}
                      onClick={() => setActivePhase(phase)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        activePhase === phase
                          ? cn('text-white border-surface-600', config.bg)
                          : 'bg-surface-800/50 text-surface-500 border-surface-700/60 hover:text-surface-300'
                      )}
                    >
                      <Icon className={cn('w-3 h-3', config.color)} />
                      {config.label} ({count})
                    </button>
                  )
                }
              )}
            </div>

            {/* Category cards */}
            {filtered.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No sectors in this phase"
                description="No categories match the selected phase. Try switching to All."
              />
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {filtered.map((cat, i) => (
                    <CategoryCard key={cat.category} cat={cat} index={i} />
                  ))}
                </div>
              </AnimatePresence>
            )}

            {/* Footer */}
            {data && (
              <div className="mt-6 flex items-center justify-between text-xs text-surface-600">
                <span>7-day lookback · {data.categories.length} sectors</span>
                <span>as of {new Date(data.as_of).toLocaleTimeString()}</span>
              </div>
            )}

            {/* CTA links */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { href: '/exchange/movers', label: 'Movers', icon: TrendingUp },
                { href: '/exchange/arbitrage', label: 'Arbitrage', icon: BarChart2 },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-surface-700/60 bg-surface-800/50 hover:bg-surface-800 hover:border-surface-600 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                    <span className="text-sm text-surface-400 group-hover:text-surface-200 transition-colors">
                      {label}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
