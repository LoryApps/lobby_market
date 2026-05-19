'use client'

/**
 * /mosaic — The Civic Mosaic
 *
 * Every topic on the platform rendered as a colour-coded tile in a living mosaic.
 * Tile colour = consensus lean (blue → strong FOR, red → strong AGAINST, gold → contested).
 * Tile size = relative vote count (more votes → bigger tile).
 *
 * Filter by category, status, or consensus type.
 * Hover / tap a tile to see the topic statement and navigate.
 *
 * Distinct from:
 *  /map        — scatter-plot (consensus vs engagement axes)
 *  /consensus  — D3 force-directed bubble chart
 *  /city       — 3D city (buildings = users, sized by reputation)
 *  /influence  — personal vote network graph
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Grid3X3,
  Info,
  Layers,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { MosaicTile, MosaicResponse } from '@/app/api/mosaic/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 90_000

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_ACCENT: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-sky-400',
  Culture: 'text-amber-400',
  Health: 'text-rose-400',
  Environment: 'text-emerald',
  Education: 'text-violet-400',
}

type FilterStatus = 'all' | 'active' | 'law' | 'failed' | 'proposed'
type ConsensusFilter = 'all' | 'mandate' | 'contested' | 'deadlock'

// ─── Colour helpers ────────────────────────────────────────────────────────────

/**
 * Returns a CSS color string representing the consensus lean.
 * blue_pct 60+ → blue (FOR mandate)
 * blue_pct 40-60 → gold (contested)
 * blue_pct <40 → red (AGAINST mandate)
 *
 * The further from 50, the more saturated the color.
 */
function tileColor(bluePct: number, status: string): { bg: string; border: string; text: string } {
  if (status === 'law') {
    if (bluePct >= 66) {
      return {
        bg: 'bg-gold/80',
        border: 'border-gold',
        text: 'text-surface-900',
      }
    }
  }
  if (status === 'failed') {
    return {
      bg: 'bg-surface-300/60',
      border: 'border-surface-400',
      text: 'text-surface-600',
    }
  }

  if (bluePct >= 65) {
    // Strong FOR — deep blue
    return { bg: 'bg-for-600', border: 'border-for-400', text: 'text-white' }
  }
  if (bluePct >= 57) {
    // Moderate FOR — medium blue
    return { bg: 'bg-for-700/80', border: 'border-for-500/70', text: 'text-for-200' }
  }
  if (bluePct <= 35) {
    // Strong AGAINST — deep red
    return { bg: 'bg-against-600', border: 'border-against-400', text: 'text-white' }
  }
  if (bluePct <= 43) {
    // Moderate AGAINST — medium red
    return { bg: 'bg-against-700/80', border: 'border-against-500/70', text: 'text-against-200' }
  }
  // Contested 43-57 — gold range
  return { bg: 'bg-gold/25', border: 'border-gold/50', text: 'text-gold' }
}

function consensusLabel(bluePct: number): string {
  if (bluePct >= 66) return 'Strong FOR'
  if (bluePct >= 57) return 'FOR leading'
  if (bluePct <= 34) return 'Strong AGAINST'
  if (bluePct <= 43) return 'AGAINST leading'
  return 'Contested'
}

function matchesConsensusFilter(tile: MosaicTile, filter: ConsensusFilter): boolean {
  if (filter === 'all') return true
  const dev = Math.abs(tile.blue_pct - 50)
  if (filter === 'mandate') return dev > 20
  if (filter === 'contested') return dev <= 15
  if (filter === 'deadlock') return dev <= 5
  return true
}

// ─── Tile size helper ─────────────────────────────────────────────────────────

function tileSize(votes: number, maxVotes: number): number {
  if (maxVotes === 0) return 1
  const ratio = Math.sqrt(votes / maxVotes) // sqrt to compress range
  // Map to 1-4 grid-column-span equivalent
  if (ratio > 0.7) return 4
  if (ratio > 0.4) return 3
  if (ratio > 0.15) return 2
  return 1
}

// ─── Tile component ───────────────────────────────────────────────────────────

interface TileProps {
  tile: MosaicTile
  size: number
  onClick: (tile: MosaicTile) => void
}

function MosaicTileCard({ tile, size, onClick }: TileProps) {
  const colors = tileColor(tile.blue_pct, tile.status)
  const isLarge = size >= 3
  const isMedium = size === 2

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(tile)}
      className={cn(
        'relative group rounded-lg border transition-all duration-200',
        'hover:scale-[1.03] hover:shadow-lg hover:z-10 active:scale-[0.98]',
        'focus:outline-none focus:ring-2 focus:ring-for-400/50',
        colors.bg,
        colors.border,
        size === 4 && 'col-span-4 row-span-2',
        size === 3 && 'col-span-3 row-span-2',
        size === 2 && 'col-span-2',
        size === 1 && 'col-span-1',
        isLarge ? 'min-h-[88px] p-3' : isMedium ? 'min-h-[56px] p-2' : 'min-h-[40px] p-1.5',
      )}
      aria-label={`${tile.statement} — ${consensusLabel(tile.blue_pct)}, ${tile.total_votes} votes`}
    >
      {/* Statement — only shown on large / medium tiles */}
      {(isLarge || isMedium) && (
        <p
          className={cn(
            'font-mono text-left leading-snug line-clamp-3',
            colors.text,
            isLarge ? 'text-xs font-semibold' : 'text-[10px]',
          )}
        >
          {tile.statement}
        </p>
      )}

      {/* Vote bar strip at bottom */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-1 rounded-b-lg overflow-hidden',
          isLarge ? '' : 'rounded-b',
        )}
      >
        <div
          className="h-full bg-for-400/60"
          style={{ width: `${tile.blue_pct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-against-500/60"
          style={{ width: `${100 - tile.blue_pct}%` }}
        />
      </div>

      {/* Law gavel badge */}
      {tile.status === 'law' && isLarge && (
        <div className="absolute top-1.5 right-1.5">
          <Gavel className="h-3 w-3 text-gold/80" />
        </div>
      )}

      {/* Hover tooltip glow */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-white/5" />
    </motion.button>
  )
}

// ─── Tooltip / detail panel ───────────────────────────────────────────────────

interface TileDetailProps {
  tile: MosaicTile
  onClose: () => void
}

function TileDetail({ tile, onClose }: TileDetailProps) {
  const colors = tileColor(tile.blue_pct, tile.status)
  const forPct = Math.round(tile.blue_pct)
  const againstPct = 100 - forPct

  const statusBadge: 'proposed' | 'active' | 'law' | 'failed' =
    tile.status === 'law'
      ? 'law'
      : tile.status === 'failed'
        ? 'failed'
        : tile.status === 'proposed'
          ? 'proposed'
          : 'active'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-x-4 bottom-20 md:bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[420px] z-50"
    >
      <div className={cn(
        'rounded-2xl border p-4 shadow-2xl backdrop-blur-sm',
        'bg-surface-100/95',
        colors.border,
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusBadge} />
            {tile.category && (
              <span className={cn(
                'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                CATEGORY_ACCENT[tile.category] ?? 'text-surface-400',
                'border-current/30 bg-current/5',
              )}>
                {tile.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Statement */}
        <p className="font-mono text-sm font-semibold text-white leading-snug mb-4">
          {tile.statement}
        </p>

        {/* Vote bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-surface-500">
            <span>{tile.total_votes.toLocaleString()} votes</span>
            <span className={cn('font-semibold', colors.text)}>{consensusLabel(tile.blue_pct)}</span>
          </div>
        </div>

        {/* Action */}
        <Link
          href={`/topic/${tile.id}`}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl',
            'text-sm font-mono font-semibold transition-colors',
            tile.status === 'law'
              ? 'bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30'
              : 'bg-for-600 hover:bg-for-500 text-white',
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {tile.status === 'law' ? 'View this Law' : 'See full debate'}
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  subLabel,
}: {
  icon: typeof BarChart2
  iconColor: string
  iconBg: string
  label: string
  value: number | string
  subLabel?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center border', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="font-mono text-2xl font-bold text-white">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      {subLabel && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{subLabel}</p>}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono text-surface-400">
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-5 rounded-sm bg-for-600 border border-for-400" />
        <span>Strong FOR (65%+)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-5 rounded-sm bg-gold/25 border border-gold/50" />
        <span>Contested (43–57%)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-5 rounded-sm bg-against-600 border border-against-400" />
        <span>Strong AGAINST (35%–)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-5 rounded-sm bg-gold/80 border border-gold" />
        <span>Established Law</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-5 rounded-sm bg-surface-300/60 border border-surface-400" />
        <span>Failed / Rejected</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>Tile size = vote count</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MosaicClient() {
  const [data, setData] = useState<MosaicResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTile, setSelectedTile] = useState<MosaicTile | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [activeStatus, setActiveStatus] = useState<FilterStatus>('all')
  const [activeConsensus, setActiveConsensus] = useState<ConsensusFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/mosaic', { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json: MosaicResponse = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mosaic')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  // Close detail panel on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedTile(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Filtering ───────────────────────────────────────────────────────────────

  const filteredTiles = (data?.tiles ?? []).filter((tile) => {
    if (activeCategory !== 'All' && tile.category !== activeCategory) return false
    if (activeStatus !== 'all') {
      if (activeStatus === 'active' && !['active', 'voting'].includes(tile.status)) return false
      if (activeStatus !== 'active' && tile.status !== activeStatus) return false
    }
    if (!matchesConsensusFilter(tile, activeConsensus)) return false
    return true
  })

  const maxVotes = filteredTiles.reduce((m, t) => Math.max(m, t.total_votes), 1)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 py-8 pb-28 md:pb-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Link
              href="/"
              className="mt-1 text-surface-500 hover:text-white transition-colors"
              aria-label="Back to feed"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Grid3X3 className="h-5 w-5 text-for-400" />
                <h1 className="font-mono text-2xl font-bold text-white">
                  The Civic Mosaic
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 max-w-lg">
                Every debate as a tile — blue for FOR mandates, red for AGAINST, gold for contested.
                Tile size reflects engagement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowLegend((v) => !v)}
              className="p-2 rounded-lg border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Toggle legend"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
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
              className="overflow-hidden mb-5"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <Legend />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard
              icon={Layers}
              iconColor="text-for-400"
              iconBg="bg-for-500/10 border-for-500/30"
              label="Total Debates"
              value={data.stats.total}
              subLabel="on record"
            />
            <StatCard
              icon={Gavel}
              iconColor="text-gold"
              iconBg="bg-gold/10 border-gold/30"
              label="Laws"
              value={data.stats.total_laws}
              subLabel="established by consensus"
            />
            <StatCard
              icon={Scale}
              iconColor="text-gold"
              iconBg="bg-gold/10 border-gold/30"
              label="Contested"
              value={data.stats.total_contested}
              subLabel="within 10% of 50/50"
            />
            <StatCard
              icon={BarChart2}
              iconColor="text-purple"
              iconBg="bg-purple/10 border-purple/30"
              label="Votes Cast"
              value={data.stats.total_votes_cast}
              subLabel={`avg ${data.stats.avg_consensus}° from centre`}
            />
          </div>
        ) : null}

        {/* Filters */}
        <div className="mb-5">
          {/* Toggle button on mobile */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="sm:hidden flex items-center gap-2 text-sm font-mono text-surface-400 hover:text-white mb-3 transition-colors"
          >
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Filters
            {(activeCategory !== 'All' || activeStatus !== 'all' || activeConsensus !== 'all') && (
              <span className="h-1.5 w-1.5 rounded-full bg-for-400" />
            )}
          </button>

          <div className={cn('space-y-3', !showFilters && 'hidden sm:block')}>
            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all',
                    activeCategory === cat
                      ? 'bg-for-600 border-for-500 text-white'
                      : 'bg-surface-200/60 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Status filter */}
              <div className="flex gap-1">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'law', label: 'Laws' },
                  { id: 'failed', label: 'Failed' },
                ] as { id: FilterStatus; label: string }[]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveStatus(opt.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                      activeStatus === opt.id
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200/40 border-surface-300/60 text-surface-500 hover:text-white',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Consensus filter */}
              <div className="flex gap-1">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'mandate', label: 'Mandates' },
                  { id: 'contested', label: 'Contested' },
                  { id: 'deadlock', label: 'Deadlocked' },
                ] as { id: ConsensusFilter; label: string }[]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveConsensus(opt.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                      activeConsensus === opt.id
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200/40 border-surface-300/60 text-surface-500 hover:text-white',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Result count */}
              {data && (
                <p className="text-[11px] font-mono text-surface-500 self-center ml-1">
                  {filteredTiles.length} of {data.stats.total} topics
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mosaic grid */}
        {loading ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-[500px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-7 w-7 text-for-400 animate-spin" />
              <p className="text-sm font-mono text-surface-500">Assembling your mosaic…</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filteredTiles.length === 0 ? (
          <EmptyState
            icon={Grid3X3}
            title="No tiles match your filters"
            description="Try changing the category or consensus filter."
            actions={[{ label: 'Clear filters', onClick: () => { setActiveCategory('All'); setActiveStatus('all'); setActiveConsensus('all') } }]}
          />
        ) : (
          <motion.div
            layout
            className={cn(
              'grid gap-1',
              'grid-cols-8 sm:grid-cols-12 lg:grid-cols-16',
              'auto-rows-[40px]',
            )}
            style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}
          >
            <AnimatePresence mode="popLayout">
              {filteredTiles.map((tile) => {
                const size = tileSize(tile.total_votes, maxVotes)
                return (
                  <MosaicTileCard
                    key={tile.id}
                    tile={tile}
                    size={size}
                    onClick={setSelectedTile}
                  />
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Subtle info strip */}
        {data && !loading && (
          <p className="mt-4 text-[11px] font-mono text-surface-600 text-center">
            Refreshes every 90 s · {data.tiles.length} total debates · click any tile to explore
          </p>
        )}
      </main>

      <BottomNav />

      {/* Tile detail panel */}
      <AnimatePresence>
        {selectedTile && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-40"
              onClick={() => setSelectedTile(null)}
            />
            <TileDetail tile={selectedTile} onClose={() => setSelectedTile(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
