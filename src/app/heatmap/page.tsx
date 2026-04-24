'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Gavel,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { HeatmapCell, HeatmapResponse } from '@/app/api/stats/heatmap/route'

// ─── Category icons + colors ──────────────────────────────────────────────────

const CAT_STYLE: Record<string, { color: string; dot: string }> = {
  Economics:   { color: 'text-gold',         dot: 'bg-gold' },
  Politics:    { color: 'text-for-400',      dot: 'bg-for-500' },
  Technology:  { color: 'text-purple',       dot: 'bg-purple' },
  Science:     { color: 'text-emerald',      dot: 'bg-emerald' },
  Ethics:      { color: 'text-against-300',  dot: 'bg-against-500' },
  Philosophy:  { color: 'text-for-300',      dot: 'bg-for-400' },
  Culture:     { color: 'text-gold',         dot: 'bg-gold' },
  Health:      { color: 'text-against-300',  dot: 'bg-against-400' },
  Environment: { color: 'text-emerald',      dot: 'bg-emerald' },
  Education:   { color: 'text-purple',       dot: 'bg-purple' },
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: typeof Zap }
> = {
  proposed: {
    label: 'Proposed',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/20',
    icon: Globe,
  },
  active: {
    label: 'Active',
    color: 'text-for-300',
    bg: 'bg-for-600/20',
    border: 'border-for-500/30',
    icon: Zap,
  },
  voting: {
    label: 'Voting',
    color: 'text-purple',
    bg: 'bg-purple/15',
    border: 'border-purple/30',
    icon: Scale,
  },
  law: {
    label: 'LAW',
    color: 'text-gold',
    bg: 'bg-gold/15',
    border: 'border-gold/30',
    icon: Gavel,
  },
  failed: {
    label: 'Failed',
    color: 'text-against-400',
    bg: 'bg-against-600/10',
    border: 'border-against-500/20',
    icon: ThumbsDown,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intensityClass(count: number, max: number): string {
  if (count === 0) return 'bg-surface-200/40 border-surface-300/30'
  const ratio = count / max
  if (ratio < 0.1) return 'bg-for-900/40 border-for-800/30'
  if (ratio < 0.25) return 'bg-for-800/50 border-for-700/40'
  if (ratio < 0.5)  return 'bg-for-700/60 border-for-600/50'
  if (ratio < 0.75) return 'bg-for-600/70 border-for-500/60'
  return 'bg-for-500/80 border-for-400/70'
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Cell tooltip ─────────────────────────────────────────────────────────────

interface CellTooltipProps {
  cell: HeatmapCell
  onClose: () => void
  onNavigate: (cat: string, status: string) => void
}

function CellTooltip({ cell, onClose, onNavigate }: CellTooltipProps) {
  const statusConf = STATUS_CONFIG[cell.status] ?? STATUS_CONFIG.proposed
  const catStyle = CAT_STYLE[cell.category] ?? { color: 'text-surface-400', dot: 'bg-surface-400' }
  const forPct = Math.round(cell.avg_blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-950/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl bg-surface-100 border border-surface-300 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className={cn('text-sm font-mono font-bold', catStyle.color)}>{cell.category}</p>
            <div className={cn('inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-xs font-mono border', statusConf.bg, statusConf.border, statusConf.color)}>
              <statusConf.icon className="h-3 w-3" />
              {statusConf.label}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 text-surface-500 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-surface-200 p-3 text-center">
            <p className="text-xl font-mono font-bold text-white">{cell.count}</p>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">topics</p>
          </div>
          <div className="rounded-xl bg-surface-200 p-3 text-center">
            <p className="text-xl font-mono font-bold text-for-400">{forPct}%</p>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">avg FOR</p>
          </div>
          <div className="rounded-xl bg-surface-200 p-3 text-center">
            <p className="text-xl font-mono font-bold text-gold">{formatVotes(cell.total_votes)}</p>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">votes</p>
          </div>
        </div>

        {/* Vote distribution bar */}
        {cell.count > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
              <span className="text-for-400 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> FOR {forPct}%
              </span>
              <span className="text-against-400 flex items-center gap-1">
                {100 - forPct}% AGAINST <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden bg-against-800/60 flex">
              <div
                className="h-full bg-for-500 rounded-l-full transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        {cell.count > 0 ? (
          <button
            onClick={() => onNavigate(cell.category, cell.status)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
          >
            Browse {cell.count} {statusConf.label} topics
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <p className="text-center text-xs font-mono text-surface-600 py-2">
            No {statusConf.label.toLowerCase()} topics in {cell.category} yet.
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Heatmap grid ─────────────────────────────────────────────────────────────

interface HeatmapGridProps {
  data: HeatmapResponse
  onCellClick: (cell: HeatmapCell) => void
}

function HeatmapGrid({ data, onCellClick }: HeatmapGridProps) {
  const { cells, categories, statuses, max_count } = data

  const cellMap = new Map<string, HeatmapCell>()
  for (const c of cells) cellMap.set(`${c.category}:${c.status}`, c)

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="min-w-[640px]">
        {/* Column headers (statuses) */}
        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `140px repeat(${statuses.length}, 1fr)` }}>
          <div /> {/* empty corner */}
          {statuses.map((st) => {
            const conf = STATUS_CONFIG[st] ?? STATUS_CONFIG.proposed
            const Icon = conf.icon
            return (
              <div
                key={st}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border text-center',
                  conf.bg,
                  conf.border
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', conf.color)} />
                <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', conf.color)}>
                  {conf.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Rows (categories) */}
        <div className="space-y-1.5">
          {categories.map((cat) => {
            const catStyle = CAT_STYLE[cat] ?? { color: 'text-surface-400', dot: 'bg-surface-400' }
            return (
              <div
                key={cat}
                className="grid gap-1.5 items-center"
                style={{ gridTemplateColumns: `140px repeat(${statuses.length}, 1fr)` }}
              >
                {/* Row label */}
                <div className="flex items-center gap-2 pr-2">
                  <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', catStyle.dot)} />
                  <span className={cn('text-xs font-mono font-semibold truncate', catStyle.color)}>
                    {cat}
                  </span>
                </div>

                {/* Cells */}
                {statuses.map((st) => {
                  const cell = cellMap.get(`${cat}:${st}`) ?? { category: cat, status: st, count: 0, avg_blue_pct: 50, total_votes: 0 }
                  const bg = intensityClass(cell.count, max_count)

                  return (
                    <motion.button
                      key={st}
                      whileHover={{ scale: cell.count > 0 ? 1.06 : 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onCellClick(cell)}
                      title={`${cat} · ${st} · ${cell.count} topics`}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-lg border transition-all duration-200 cursor-pointer',
                        'h-14 min-h-[3.5rem]',
                        bg,
                        cell.count === 0 ? 'cursor-default opacity-40' : 'hover:ring-1 hover:ring-for-500/50'
                      )}
                    >
                      <span className={cn(
                        'text-base font-mono font-bold',
                        cell.count === 0 ? 'text-surface-600' : 'text-white'
                      )}>
                        {cell.count}
                      </span>
                      {cell.count > 0 && cell.total_votes > 0 && (
                        <span className="text-[9px] font-mono text-surface-500 mt-0.5">
                          {formatVotes(cell.total_votes)}v
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ maxCount }: { maxCount: number }) {
  const steps = [
    { label: '0', bg: 'bg-surface-200/40 border-surface-300/30' },
    { label: '1+', bg: 'bg-for-900/40 border-for-800/30' },
    { label: '3+', bg: 'bg-for-800/50 border-for-700/40' },
    { label: `${Math.round(maxCount * 0.25)}+`, bg: 'bg-for-700/60 border-for-600/50' },
    { label: `${Math.round(maxCount * 0.5)}+`, bg: 'bg-for-600/70 border-for-500/60' },
    { label: `${maxCount}`, bg: 'bg-for-500/80 border-for-400/70' },
  ]

  return (
    <div className="flex items-center gap-1.5 mt-4">
      <span className="text-[10px] font-mono text-surface-600 mr-1">Fewer</span>
      {steps.map(({ label, bg }) => (
        <div
          key={label}
          className={cn('h-5 w-5 rounded border flex-shrink-0', bg)}
          title={`${label} topics`}
        />
      ))}
      <span className="text-[10px] font-mono text-surface-600 ml-1">More</span>
    </div>
  )
}

// ─── Summary row ──────────────────────────────────────────────────────────────

interface SummaryRowProps {
  data: HeatmapResponse
}

function SummaryRow({ data }: SummaryRowProps) {
  const totals = data.statuses.reduce<Record<string, number>>((acc, st) => {
    acc[st] = data.cells.filter((c) => c.status === st).reduce((s, c) => s + c.count, 0)
    return acc
  }, {})

  const grand = Object.values(totals).reduce((a, b) => a + b, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-6">
      {data.statuses.map((st) => {
        const conf = STATUS_CONFIG[st] ?? STATUS_CONFIG.proposed
        const Icon = conf.icon
        const count = totals[st] ?? 0
        const pct = grand > 0 ? Math.round((count / grand) * 100) : 0

        return (
          <div
            key={st}
            className={cn(
              'flex flex-col gap-1.5 p-3 rounded-xl border',
              conf.bg,
              conf.border
            )}
          >
            <div className="flex items-center gap-1.5">
              <Icon className={cn('h-3.5 w-3.5', conf.color)} />
              <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', conf.color)}>
                {conf.label}
              </span>
            </div>
            <p className="text-2xl font-mono font-bold text-white">{count}</p>
            <p className="text-[10px] font-mono text-surface-500">{pct}% of all topics</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeatmapPage() {
  const router = useRouter()
  const [data, setData] = useState<HeatmapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<HeatmapCell | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stats/heatmap')
      if (!res.ok) throw new Error('Failed to load heatmap data')
      const json: HeatmapResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleCellClick(cell: HeatmapCell) {
    setActiveCell(cell)
  }

  function handleNavigate(cat: string, status: string) {
    setActiveCell(null)
    // Navigate to category deep-dive with status filter pre-selected
    const slug = cat.toLowerCase()
    router.push(`/topic/categories/${slug}?status=${status}`)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/stats"
            className="inline-flex items-center gap-2 text-surface-500 hover:text-white text-sm font-mono mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Stats
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
                <BarChart2 className="h-6 w-6 text-for-400" />
                Lobby Heatmap
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1">
                Topic density across every category and lifecycle stage. Tap any cell to explore.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60 mb-6">
          <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Each cell shows how many topics exist in that <span className="text-white">category × status</span> combination.
            Deeper blue = more topics. Click any cell for breakdown and quick navigation.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 text-for-500 animate-spin" />
            <p className="text-sm font-mono text-surface-500">Building heatmap…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <>
            {/* Grid */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 overflow-hidden">
              <HeatmapGrid data={data} onCellClick={handleCellClick} />
              <Legend maxCount={data.max_count} />
            </div>

            {/* Status summary */}
            <SummaryRow data={data} />

            {/* Most active category */}
            {data.cells.length > 0 && (() => {
              const catTotals = data.categories.map((cat) => ({
                cat,
                count: data.cells.filter((c) => c.category === cat).reduce((s, c) => s + c.count, 0),
                votes: data.cells.filter((c) => c.category === cat).reduce((s, c) => s + c.total_votes, 0),
              })).sort((a, b) => b.count - a.count)

              const top = catTotals[0]
              if (!top) return null

              return (
                <div className="mt-4 rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="text-sm font-mono font-bold text-white mb-3 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-for-400" />
                    Most Active Category
                  </h2>
                  <div className="space-y-2">
                    {catTotals.slice(0, 5).map(({ cat, count }, idx) => {
                      const catStyle = CAT_STYLE[cat] ?? { color: 'text-surface-400', dot: 'bg-surface-400' }
                      const maxCat = catTotals[0]?.count ?? 1
                      return (
                        <Link
                          key={cat}
                          href={`/topic/categories/${cat.toLowerCase()}`}
                          className="group flex items-center gap-3 py-2 hover:bg-surface-200/60 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <span className="text-xs font-mono text-surface-600 w-4 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', catStyle.dot)} />
                          <span className={cn('text-sm font-mono font-medium flex-1', catStyle.color)}>
                            {cat}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="h-1.5 w-24 bg-surface-300 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-for-500 rounded-full"
                                style={{ width: `${(count / maxCat) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-surface-500 w-12 text-right">
                              {count} topics
                            </span>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Timestamp */}
            <p className="text-center text-[10px] font-mono text-surface-700 mt-4">
              Data snapshot · {new Date(data.generated_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        ) : null}
      </main>

      {/* Cell detail modal */}
      <AnimatePresence>
        {activeCell && (
          <CellTooltip
            cell={activeCell}
            onClose={() => setActiveCell(null)}
            onNavigate={handleNavigate}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
