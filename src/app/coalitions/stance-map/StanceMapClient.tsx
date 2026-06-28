'use client'

/**
 * /coalitions/stance-map — Coalition Stance Map
 *
 * A heatmap grid showing where every coalition officially stands across
 * all 10 civic categories. Each cell is coloured blue (FOR), red (AGAINST),
 * amber (SPLIT), or grey (NEUTRAL/no stances). Intensity reflects the
 * decisiveness of the coalition's dominant position.
 *
 * Distinct from:
 *   /coalitions/[id]/analytics  — per-coalition breakdown (not cross-coalition)
 *   /coalitions/network          — relationship graph (treaties, not stances)
 *   /coalitions/standings        — win/loss record (not ideological positions)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Filter,
  Info,
  Loader2,
  LayoutGrid,
  RefreshCw,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CoalitionStanceCell,
  StanceMapResponse,
} from '@/app/api/coalitions/stance-map/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    '#6366f1',
  Economics:   '#10b981',
  Technology:  '#3b82f6',
  Science:     '#06b6d4',
  Ethics:      '#8b5cf6',
  Culture:     '#f59e0b',
  Philosophy:  '#ec4899',
  Health:      '#22c55e',
  Environment: '#14b8a6',
  Education:   '#f97316',
}

// ─── Cell colour helpers ──────────────────────────────────────────────────────

function cellBg(cell: CoalitionStanceCell): string {
  const s = Math.max(0.15, cell.strength / 100)
  if (cell.dominant_stance === 'for')      return `rgba(59,130,246,${s})`  // blue
  if (cell.dominant_stance === 'against')  return `rgba(239,68,68,${s})`   // red
  if (cell.dominant_stance === 'split')    return `rgba(245,158,11,${s})`  // amber
  return `rgba(107,114,128,0.12)`                                            // neutral grey
}

function cellBorder(cell: CoalitionStanceCell): string {
  if (cell.dominant_stance === 'for')      return 'border-for-500/40'
  if (cell.dominant_stance === 'against')  return 'border-against-500/40'
  if (cell.dominant_stance === 'split')    return 'border-gold/40'
  return 'border-surface-400/30'
}

function cellText(cell: CoalitionStanceCell): string {
  if (cell.dominant_stance === 'for')      return 'text-for-300'
  if (cell.dominant_stance === 'against')  return 'text-against-300'
  if (cell.dominant_stance === 'split')    return 'text-gold'
  return 'text-surface-500'
}

function stanceLabel(stance: CoalitionStanceCell['dominant_stance']): string {
  if (stance === 'for')      return 'FOR'
  if (stance === 'against')  return 'AGAINST'
  if (stance === 'split')    return 'SPLIT'
  return 'NEUTRAL'
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipData {
  cell: CoalitionStanceCell
  x: number
  y: number
}

function CellTooltip({ data, onClose }: { data: TooltipData; onClose: () => void }) {
  const { cell, x, y } = data
  const total = cell.for_count + cell.against_count + cell.neutral_count

  return (
    <AnimatePresence>
      <motion.div
        key="tooltip"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        className="fixed z-50 w-60 pointer-events-auto"
        style={{ left: Math.min(x, window.innerWidth - 260), top: Math.max(8, y - 160) }}
      >
        <div className="bg-surface-100 border border-surface-300 rounded-xl shadow-2xl p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-0.5">
                {cell.category}
              </p>
              <p className="font-mono font-bold text-white text-sm leading-tight line-clamp-2">
                {cell.coalition_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-surface-500 hover:text-white transition-colors shrink-0 mt-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Dominant stance */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-3',
              'border text-xs font-mono font-bold',
              cell.dominant_stance === 'for'
                ? 'bg-for-500/15 border-for-500/30 text-for-300'
                : cell.dominant_stance === 'against'
                  ? 'bg-against-500/15 border-against-500/30 text-against-300'
                  : cell.dominant_stance === 'split'
                    ? 'bg-gold/15 border-gold/30 text-gold'
                    : 'bg-surface-300 border-surface-400 text-surface-500',
            )}
          >
            {cell.dominant_stance === 'for' && <ThumbsUp className="h-3 w-3" />}
            {cell.dominant_stance === 'against' && <ThumbsDown className="h-3 w-3" />}
            {stanceLabel(cell.dominant_stance)} · {cell.strength}% decisive
          </div>

          {/* Stance breakdown */}
          <div className="space-y-1.5 mb-3">
            <StanceRow label="FOR" count={cell.for_count} total={total} color="bg-for-500" />
            <StanceRow label="AGAINST" count={cell.against_count} total={total} color="bg-against-500" />
            <StanceRow label="NEUTRAL" count={cell.neutral_count} total={total} color="bg-surface-400" />
          </div>

          <p className="text-xs font-mono text-surface-500">
            {total} total stance{total !== 1 ? 's' : ''} declared
          </p>

          <Link
            href={`/coalitions/${cell.coalition_id}`}
            className="mt-3 flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <Shield className="h-3 w-3" /> View coalition →
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function StanceRow({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-surface-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className="font-mono text-[10px] text-surface-500 w-6 text-right">{count}</span>
    </div>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: 'bg-for-500', label: 'Mostly FOR' },
    { color: 'bg-against-500', label: 'Mostly AGAINST' },
    { color: 'bg-gold', label: 'Split / Divided' },
    { color: 'bg-surface-400', label: 'Neutral / No stances' },
  ] as const

  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={cn('w-3 h-3 rounded-sm flex-shrink-0', item.color)} />
          <span className="font-mono text-xs text-surface-500">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-surface-500">Intensity = decisiveness</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StanceMapClient() {
  const [data, setData] = useState<StanceMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'heatmap' | 'list'>('heatmap')

  const tooltipRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coalitions/stance-map')
      if (!res.ok) throw new Error('Failed to load stance map')
      const json = (await res.json()) as StanceMapResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filtered coalitions based on search
  const filteredCoalitions = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    return data.coalitions.filter((c) =>
      !q || c.name.toLowerCase().includes(q)
    )
  }, [data, search])

  // Build cell lookup map
  const cellMap = useMemo(() => {
    const map = new Map<string, CoalitionStanceCell>()
    for (const cell of data?.cells ?? []) {
      map.set(`${cell.coalition_id}::${cell.category}`, cell)
    }
    return map
  }, [data])

  // Categories to show (filtered)
  const visibleCategories = useMemo(() => {
    if (!data) return []
    return filterCategory ? [filterCategory] : data.categories
  }, [data, filterCategory])

  function handleCellClick(cell: CoalitionStanceCell, e: React.MouseEvent) {
    if (tooltipRef.current) clearTimeout(tooltipRef.current)
    setTooltip({ cell, x: e.clientX + 8, y: e.clientY })
  }

  function handleCellEnter(cell: CoalitionStanceCell, e: React.MouseEvent) {
    if (tooltipRef.current) clearTimeout(tooltipRef.current)
    setTooltip({ cell, x: e.clientX + 8, y: e.clientY })
  }

  function handleCellLeave() {
    tooltipRef.current = setTimeout(() => setTooltip(null), 300)
  }

  // ── List view ────────────────────────────────────────────────────────────────

  const listCells = useMemo(() => {
    if (!data) return []
    return data.cells
      .filter((c) => {
        if (filterCategory && c.category !== filterCategory) return false
        if (search) {
          const q = search.toLowerCase()
          return c.coalition_name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => b.total_stances - a.total_stances)
  }, [data, filterCategory, search])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/coalitions"
              className="text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-surface-500 text-sm font-mono">/</span>
            <span className="text-surface-500 text-sm font-mono">Stance Map</span>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple/10 border border-purple/30">
                  <LayoutGrid className="h-5 w-5 text-purple" />
                </div>
                <h1 className="font-mono text-3xl font-bold text-white">
                  Stance Map
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 max-w-xl">
                Where every coalition officially stands across all 10 civic categories — the ideological landscape of the Lobby at a glance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center bg-surface-100 border border-surface-300 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('heatmap')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-mono transition-all',
                    viewMode === 'heatmap'
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-surface-600',
                  )}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-mono transition-all',
                    viewMode === 'list'
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-surface-600',
                  )}
                >
                  List
                </button>
              </div>

              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-all text-xs font-mono disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coalitions…"
              className="w-full pl-9 pr-3 py-2.5 bg-surface-100 border border-surface-300 rounded-xl text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-purple/50 focus:border-purple/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-surface-500 shrink-0" />
            <button
              onClick={() => setFilterCategory(null)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-mono border transition-all',
                !filterCategory
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-surface-600',
              )}
            >
              All
            </button>
            {(data?.categories ?? []).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono border transition-all',
                  filterCategory === cat
                    ? 'bg-purple/20 border-purple/40 text-purple'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-surface-600',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {data && (
          <div className="flex flex-wrap items-center gap-4 mb-6 p-3 bg-surface-100 border border-surface-300 rounded-xl">
            <div>
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">Coalitions</span>
              <p className="font-mono text-lg font-bold text-white">{data.coalitions.length}</p>
            </div>
            <div className="h-6 w-px bg-surface-300" />
            <div>
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">Categories</span>
              <p className="font-mono text-lg font-bold text-white">{data.categories.length}</p>
            </div>
            <div className="h-6 w-px bg-surface-300" />
            <div>
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">Total Stances</span>
              <p className="font-mono text-lg font-bold text-white">{data.total_stances.toLocaleString()}</p>
            </div>
            <div className="h-6 w-px bg-surface-300" />
            <div>
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">Cells Filled</span>
              <p className="font-mono text-lg font-bold text-white">{data.cells.length}</p>
            </div>
            <div className="ml-auto">
              <Legend />
            </div>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 text-purple animate-spin" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Info}
            title="Failed to load stance map"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* ── Empty ───────────────────────────────────────────────────────── */}
        {!loading && !error && data && data.cells.length === 0 && (
          <EmptyState
            icon={LayoutGrid}
            title="No stances declared yet"
            description="Coalitions haven't declared their positions on any topics yet. As coalitions declare stances on topics, this map fills in."
            action={{ label: 'Browse Coalitions', href: '/coalitions' }}
          />
        )}

        {/* ── Heatmap grid ────────────────────────────────────────────────── */}
        {!loading && !error && data && data.cells.length > 0 && viewMode === 'heatmap' && (
          <div className="overflow-x-auto">
            <div
              className="inline-block min-w-full"
              style={{ minWidth: `${visibleCategories.length * 80 + 200}px` }}
            >
              {/* Header row */}
              <div
                className="grid gap-1 mb-1"
                style={{ gridTemplateColumns: `200px repeat(${visibleCategories.length}, 72px)` }}
              >
                <div className="h-10 flex items-end pb-1">
                  <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">Coalition</span>
                </div>
                {visibleCategories.map((cat) => (
                  <div key={cat} className="h-10 flex items-end justify-center pb-1">
                    <span
                      className="font-mono text-[10px] font-semibold text-center leading-tight"
                      style={{ color: CATEGORY_COLORS[cat] ?? '#6b7280' }}
                    >
                      {cat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {filteredCoalitions.map((coalition, rowIdx) => (
                <motion.div
                  key={coalition.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: rowIdx * 0.03, duration: 0.25 }}
                  className="grid gap-1 mb-1"
                  style={{ gridTemplateColumns: `200px repeat(${visibleCategories.length}, 72px)` }}
                >
                  {/* Coalition name */}
                  <Link
                    href={`/coalitions/${coalition.id}`}
                    className="h-10 flex items-center gap-2 pr-2 group"
                  >
                    <div className="flex items-center justify-center h-5 w-5 rounded bg-purple/10 border border-purple/20 shrink-0">
                      <Shield className="h-3 w-3 text-purple" />
                    </div>
                    <span className="font-mono text-xs text-surface-500 group-hover:text-white transition-colors truncate">
                      {coalition.name}
                    </span>
                  </Link>

                  {/* Stance cells */}
                  {visibleCategories.map((cat) => {
                    const cell = cellMap.get(`${coalition.id}::${cat}`)

                    if (!cell) {
                      return (
                        <div
                          key={cat}
                          className="h-10 rounded-lg bg-surface-100 border border-surface-200/50"
                        />
                      )
                    }

                    return (
                      <motion.button
                        key={cat}
                        onClick={(e) => handleCellClick(cell, e)}
                        onMouseEnter={(e) => handleCellEnter(cell, e)}
                        onMouseLeave={handleCellLeave}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'h-10 rounded-lg border transition-all duration-150 cursor-pointer',
                          'flex flex-col items-center justify-center gap-0.5',
                          cellBorder(cell),
                        )}
                        style={{ background: cellBg(cell) }}
                        title={`${coalition.name} · ${cat} · ${stanceLabel(cell.dominant_stance)}`}
                      >
                        <span className={cn('font-mono text-[10px] font-bold', cellText(cell))}>
                          {stanceLabel(cell.dominant_stance).slice(0, 3)}
                        </span>
                        <span className="font-mono text-[9px] text-surface-500">
                          {cell.total_stances}
                        </span>
                      </motion.button>
                    )
                  })}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── List view ───────────────────────────────────────────────────── */}
        {!loading && !error && data && viewMode === 'list' && (
          <div className="space-y-2">
            {listCells.length === 0 ? (
              <EmptyState
                icon={LayoutGrid}
                title="No matching stances"
                description="Try adjusting your search or category filter."
              />
            ) : (
              listCells.map((cell, i) => (
                <motion.div
                  key={`${cell.coalition_id}::${cell.category}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 p-4 bg-surface-100 border border-surface-300 rounded-xl hover:border-surface-400 transition-all"
                >
                  {/* Coalition */}
                  <Link
                    href={`/coalitions/${cell.coalition_id}`}
                    className="flex items-center gap-2 min-w-0 w-44 shrink-0 group"
                  >
                    <Shield className="h-4 w-4 text-purple shrink-0" />
                    <span className="font-mono text-sm text-white group-hover:text-purple transition-colors truncate">
                      {cell.coalition_name}
                    </span>
                  </Link>

                  {/* Category */}
                  <span
                    className="font-mono text-xs font-semibold px-2 py-1 rounded-md border shrink-0"
                    style={{
                      color: CATEGORY_COLORS[cell.category],
                      borderColor: `${CATEGORY_COLORS[cell.category]}40`,
                      background: `${CATEGORY_COLORS[cell.category]}15`,
                    }}
                  >
                    {cell.category}
                  </span>

                  {/* Stance */}
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold shrink-0',
                      cell.dominant_stance === 'for'
                        ? 'bg-for-500/15 border-for-500/30 text-for-300'
                        : cell.dominant_stance === 'against'
                          ? 'bg-against-500/15 border-against-500/30 text-against-300'
                          : cell.dominant_stance === 'split'
                            ? 'bg-gold/15 border-gold/30 text-gold'
                            : 'bg-surface-300 border-surface-400 text-surface-500',
                    )}
                  >
                    {cell.dominant_stance === 'for' && <ThumbsUp className="h-3 w-3" />}
                    {cell.dominant_stance === 'against' && <ThumbsDown className="h-3 w-3" />}
                    {stanceLabel(cell.dominant_stance)}
                  </div>

                  {/* Strength bar */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          cell.dominant_stance === 'for'
                            ? 'bg-for-500'
                            : cell.dominant_stance === 'against'
                              ? 'bg-against-500'
                              : cell.dominant_stance === 'split'
                                ? 'bg-gold'
                                : 'bg-surface-400',
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${cell.strength}%` }}
                        transition={{ duration: 0.4, delay: i * 0.02 }}
                      />
                    </div>
                    <span className="font-mono text-xs text-surface-500 w-10 text-right">
                      {cell.strength}%
                    </span>
                  </div>

                  {/* Count */}
                  <span className="font-mono text-xs text-surface-500 shrink-0">
                    {cell.total_stances} stance{cell.total_stances !== 1 ? 's' : ''}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── Info footer ─────────────────────────────────────────────────── */}
        {data && data.cells.length > 0 && (
          <div className="mt-8 p-4 bg-surface-100 border border-surface-300 rounded-xl flex gap-3">
            <Info className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Cells are coloured by the dominant stance (FOR/AGAINST/SPLIT) across all topics in that category where the coalition has officially declared a position.
              Intensity reflects how decisive the coalition&apos;s lean is — lighter cells indicate closer splits.
              Empty cells mean no stances have been declared for that category.
            </p>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Tooltip */}
      {tooltip && (
        <CellTooltip data={tooltip} onClose={() => setTooltip(null)} />
      )}
    </div>
  )
}
