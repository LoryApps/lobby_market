'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Flame,
  Gavel,
  Info,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Market } from '@/app/api/exchange/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CAT_ACCENT: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-surface-400',
  Philosophy: 'text-surface-500',
  Culture: 'text-for-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

// ─── Color logic ──────────────────────────────────────────────────────────────

function priceToColor(price: number, status: string): string {
  if (status === 'law') return 'bg-gold/80 border-gold/60'
  if (status === 'failed') return 'bg-against-900/60 border-against-700/40'
  if (price >= 80) return 'bg-gold/50 border-gold/40'
  if (price >= 68) return 'bg-for-700/70 border-for-600/50'
  if (price >= 57) return 'bg-for-800/60 border-for-700/40'
  if (price >= 44) return 'bg-surface-300/40 border-surface-400/30'
  if (price >= 33) return 'bg-against-800/60 border-against-700/40'
  if (price >= 22) return 'bg-against-700/70 border-against-600/50'
  return 'bg-against-600/60 border-against-500/40'
}

function priceToTextColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 80) return 'text-gold'
  if (price >= 57) return 'text-for-300'
  if (price >= 44) return 'text-surface-400'
  if (price >= 22) return 'text-against-300'
  return 'text-against-200'
}

function priceToDelta(price: number): { label: string; icon: typeof TrendingUp | null } {
  if (price >= 70) return { label: 'Strong FOR', icon: TrendingUp }
  if (price >= 55) return { label: 'Leaning FOR', icon: TrendingUp }
  if (price >= 45) return { label: 'Contested', icon: null }
  if (price >= 30) return { label: 'Leaning AGAINST', icon: TrendingDown }
  return { label: 'Strong AGAINST', icon: TrendingDown }
}

// ─── Treemap layout (squarified algorithm simplified) ─────────────────────────

interface TreeNode {
  market: Market
  x: number
  y: number
  w: number
  h: number
}

function squarify(
  markets: Market[],
  x: number,
  y: number,
  w: number,
  h: number,
): TreeNode[] {
  if (markets.length === 0) return []

  const totalVol = markets.reduce((s, m) => s + Math.max(m.volume, 1), 0)

  function area(m: Market) {
    return (Math.max(m.volume, 1) / totalVol) * w * h
  }

  function worst(row: Market[], w: number): number {
    const s = row.reduce((sum, m) => sum + area(m), 0)
    const maxA = Math.max(...row.map(area))
    const minA = Math.min(...row.map(area))
    return Math.max((w * w * maxA) / (s * s), (s * s) / (w * w * minA))
  }

  const nodes: TreeNode[] = []

  function layoutRow(row: Market[], xo: number, yo: number, wo: number, ho: number, horizontal: boolean) {
    const totalA = row.reduce((s, m) => s + area(m), 0)
    let cursor = 0
    for (const m of row) {
      const a = area(m)
      const frac = a / totalA
      if (horizontal) {
        nodes.push({ market: m, x: xo + cursor, y: yo, w: frac * wo, h: ho })
        cursor += frac * wo
      } else {
        nodes.push({ market: m, x: xo, y: yo + cursor, w: wo, h: frac * ho })
        cursor += frac * ho
      }
    }
  }

  function squarifyHelper(
    items: Market[],
    row: Market[],
    sx: number,
    sy: number,
    sw: number,
    sh: number,
  ) {
    if (items.length === 0) {
      const horizontal = sw >= sh
      layoutRow(row, sx, sy, horizontal ? sw : sw, horizontal ? sh : sh, horizontal)
      return
    }

    const horizontal = sw >= sh
    const len = horizontal ? sw : sh

    const next = items[0]
    const newRow = [...row, next]

    if (row.length === 0 || worst(row, len) >= worst(newRow, len)) {
      squarifyHelper(items.slice(1), newRow, sx, sy, sw, sh)
    } else {
      // Commit the row
      const totalA = row.reduce((s, m) => s + area(m), 0)
      const frac = totalA / (sw * sh)
      if (horizontal) {
        const rowH = frac * sh
        layoutRow(row, sx, sy, sw, rowH, horizontal)
        squarifyHelper(items, [], sx, sy + rowH, sw, sh - rowH)
      } else {
        const rowW = frac * sw
        layoutRow(row, sx, sy, rowW, sh, horizontal)
        squarifyHelper(items, [], sx + rowW, sy, sw - rowW, sh)
      }
    }
  }

  squarifyHelper(markets, [], x, y, w, h)
  return nodes
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipData {
  market: Market
  x: number
  y: number
}

function Tooltip({ data }: { data: TooltipData }) {
  const { market, x, y } = data
  const { label } = priceToDelta(market.price)
  const containerRef = useRef<HTMLDivElement>(null)

  // Adjust position so tooltip doesn't overflow viewport
  const [pos, setPos] = useState({ left: x + 12, top: y - 8 })
  useEffect(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    let left = x + 12
    let top = y - 8
    if (left + rect.width > window.innerWidth - 16) left = x - rect.width - 12
    if (top + rect.height > window.innerHeight - 16) top = y - rect.height - 8
    setPos({ left, top })
  }, [x, y])

  return (
    <div
      ref={containerRef}
      className="fixed z-50 pointer-events-none"
      style={{ left: pos.left, top: pos.top }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="bg-surface-100/95 border border-surface-300 rounded-xl p-3 shadow-2xl backdrop-blur-sm w-64"
      >
        <p className="text-xs font-medium text-white leading-snug line-clamp-2 mb-2">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-bold', priceToTextColor(market.price, market.status))}>
            {Math.round(market.price)}¢
          </span>
          <span className="text-xs text-surface-500">{label}</span>
          {market.category && (
            <span className="text-xs text-surface-500 bg-surface-200 px-1.5 py-0.5 rounded">
              {market.category}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-surface-500">
          <span>{market.volume.toLocaleString()} votes</span>
          {market.is_hot && (
            <span className="flex items-center gap-0.5 text-gold">
              <Flame className="h-3 w-3" />
              Hot
            </span>
          )}
          {market.is_near_law && (
            <span className="flex items-center gap-0.5 text-gold">
              <Gavel className="h-3 w-3" />
              Near Law
            </span>
          )}
          {market.is_closing_soon && (
            <span className="flex items-center gap-0.5 text-against-400">
              <Zap className="h-3 w-3" />
              Closing
            </span>
          )}
        </div>
        <div className="mt-2 text-xs text-surface-500 flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          Click to open market
        </div>
      </motion.div>
    </div>
  )
}

// ─── Market cell ─────────────────────────────────────────────────────────────

interface CellProps {
  node: TreeNode
  onHover: (data: TooltipData | null) => void
}

function MarketCell({ node, onHover }: CellProps) {
  const { market, x, y, w, h } = node
  const router = useRouter()
  const colorClass = priceToColor(market.price, market.status)
  const textClass = priceToTextColor(market.price, market.status)
  const MIN_LABEL = 48 // px — below this, hide text

  function handleMouseMove(e: React.MouseEvent) {
    onHover({ market, x: e.clientX, y: e.clientY })
  }

  return (
    <div
      className={cn(
        'absolute border transition-all cursor-pointer group overflow-hidden',
        colorClass,
        'hover:brightness-125 hover:z-10',
      )}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        padding: '1px',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
      onClick={() => router.push(`/exchange/${market.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`${market.statement} — ${Math.round(market.price)}¢`}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/exchange/${market.id}`)}
    >
      <div className="relative w-full h-full flex flex-col items-start justify-end p-1 overflow-hidden">
        {w * 300 > MIN_LABEL && h * 300 > MIN_LABEL && (
          <>
            <p
              className={cn(
                'text-white/80 font-medium leading-tight overflow-hidden',
                w * 300 > 120 ? 'text-[9px]' : 'text-[7px]',
              )}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: h * 300 > 80 ? 2 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {market.statement}
            </p>
            {w * 300 > 80 && h * 300 > 60 && (
              <p className={cn('text-[8px] font-bold mt-0.5', textClass)}>
                {Math.round(market.price)}¢
              </p>
            )}
          </>
        )}
        {market.is_hot && (
          <div className="absolute top-0.5 right-0.5">
            <Flame className="h-2 w-2 text-gold opacity-70" />
          </div>
        )}
        {market.status === 'law' && (
          <div className="absolute top-0.5 right-0.5">
            <Gavel className="h-2 w-2 text-gold" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Category block ───────────────────────────────────────────────────────────

interface CategoryBlockProps {
  category: string
  markets: Market[]
  onHover: (data: TooltipData | null) => void
  blockHeight: number
}

const BLOCK_W = 300 // logical width units for treemap calculation

function CategoryBlock({ category, markets, onHover, blockHeight }: CategoryBlockProps) {
  const accent = CAT_ACCENT[category] ?? 'text-surface-400'
  const totalVol = markets.reduce((s, m) => s + Math.max(m.volume, 1), 0)
  const avgPrice = markets.length > 0
    ? markets.reduce((s, m) => s + m.price * Math.max(m.volume, 1), 0) / totalVol
    : 50

  const sorted = [...markets].sort((a, b) => Math.max(b.volume, 1) - Math.max(a.volume, 1))
  const nodes = squarify(sorted, 0, 0, 1, 1)

  return (
    <div className="flex-shrink-0" style={{ flex: `0 0 ${BLOCK_W}px`, height: blockHeight }}>
      <div className="h-full flex flex-col bg-surface-100/30 border border-surface-300/50 rounded-xl overflow-hidden">
        {/* Category header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-300/40 bg-surface-200/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold', accent)}>{category}</span>
            <span className="text-xs text-surface-500">{markets.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold', priceToTextColor(avgPrice, 'active'))}>
              {Math.round(avgPrice)}¢ avg
            </span>
          </div>
        </div>
        {/* Treemap area */}
        <div className="relative flex-1">
          {nodes.map((node) => (
            <MarketCell key={node.market.id} node={node} onHover={onHover} />
          ))}
          {markets.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-surface-600">No markets</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const tiers = [
    { label: 'Strong FOR (≥68¢)', color: 'bg-for-700/70', text: 'text-for-300' },
    { label: 'Leaning FOR (57–67¢)', color: 'bg-for-800/60', text: 'text-for-400' },
    { label: 'Contested (44–56¢)', color: 'bg-surface-300/40', text: 'text-surface-400' },
    { label: 'Leaning AGAINST (33–43¢)', color: 'bg-against-800/60', text: 'text-against-300' },
    { label: 'Strong AGAINST (≤32¢)', color: 'bg-against-600/60', text: 'text-against-200' },
    { label: 'Near Law (≥80¢)', color: 'bg-gold/50', text: 'text-gold' },
    { label: 'Established Law', color: 'bg-gold/80', text: 'text-gold' },
  ]

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {tiers.map(({ label, color, text }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={cn('h-3 w-3 rounded-sm border border-white/10', color)} />
          <span className={cn('text-xs', text)}>{label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2 border-l border-surface-400 pl-2">
        <Flame className="h-3 w-3 text-gold" />
        <span className="text-xs text-surface-500">Hot</span>
        <Gavel className="h-3 w-3 text-gold ml-2" />
        <span className="text-xs text-surface-500">Law</span>
        <Zap className="h-3 w-3 text-against-400 ml-2" />
        <span className="text-xs text-surface-500">Closing</span>
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

interface StatsBarProps {
  markets: Market[]
}

function StatsBar({ markets }: StatsBarProps) {
  const live = markets.filter((m) => m.status === 'active').length
  const voting = markets.filter((m) => m.status === 'voting').length
  const laws = markets.filter((m) => m.status === 'law').length
  const hot = markets.filter((m) => m.is_hot).length
  const nearLaw = markets.filter((m) => m.is_near_law).length
  const totalVol = markets.reduce((s, m) => s + m.volume, 0)
  const avgPrice = markets.length > 0
    ? markets.reduce((s, m) => s + m.price, 0) / markets.length
    : 50

  const stats = [
    { label: 'Markets', value: markets.length, icon: Activity, color: 'text-surface-400' },
    { label: 'Live', value: live, icon: Zap, color: 'text-for-400' },
    { label: 'Voting', value: voting, icon: Scale, color: 'text-gold' },
    { label: 'Hot', value: hot, icon: Flame, color: 'text-gold' },
    { label: 'Near Law', value: nearLaw, icon: Gavel, color: 'text-gold' },
    { label: 'Laws', value: laws, icon: Gavel, color: 'text-emerald' },
    { label: 'Avg Price', value: `${Math.round(avgPrice)}¢`, icon: TrendingUp, color: 'text-for-300' },
    {
      label: 'Total Vol',
      value: totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}K` : totalVol,
      icon: Activity,
      color: 'text-surface-400',
    },
  ]

  return (
    <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
          <Icon className={cn('h-3.5 w-3.5', color)} />
          <span className={cn('text-sm font-semibold', color)}>{value}</span>
          <span className="text-xs text-surface-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type PriceFilter = 'all' | 'for' | 'against' | 'contested' | 'near_law' | 'hot'
type StatusFilter = 'all' | 'live' | 'voting' | 'settled'

const PRICE_FILTERS: { id: PriceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'for', label: 'FOR' },
  { id: 'against', label: 'AGAINST' },
  { id: 'contested', label: 'Contested' },
  { id: 'near_law', label: 'Near Law' },
  { id: 'hot', label: 'Hot' },
]

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'voting', label: 'Voting' },
  { id: 'settled', label: 'Settled' },
]

function applyFilters(
  markets: Market[],
  priceFilter: PriceFilter,
  statusFilter: StatusFilter,
): Market[] {
  return markets.filter((m) => {
    if (priceFilter === 'for' && m.price < 55) return false
    if (priceFilter === 'against' && m.price > 45) return false
    if (priceFilter === 'contested' && (m.price < 44 || m.price > 56)) return false
    if (priceFilter === 'near_law' && !m.is_near_law) return false
    if (priceFilter === 'hot' && !m.is_hot) return false
    if (statusFilter === 'live' && m.status !== 'active') return false
    if (statusFilter === 'voting' && m.status !== 'voting') return false
    if (statusFilter === 'settled' && m.status !== 'law' && m.status !== 'failed') return false
    return true
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HeatmapClient() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('live')
  const [showLegend, setShowLegend] = useState(false)
  const [blockHeight, setBlockHeight] = useState(280)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch volume-sorted markets (up to 100 — API limit)
      const res = await fetch('/api/exchange?sort=volume')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMarkets(data.markets ?? [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const filtered = applyFilters(markets, priceFilter, statusFilter)

  // Group by category, preserving CATEGORIES order
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    markets: filtered.filter((m) => m.category === cat),
  })).filter((g) => g.markets.length > 0)

  // Uncategorized
  const uncategorised = filtered.filter((m) => !m.category || !CATEGORIES.includes(m.category))
  if (uncategorised.length > 0) {
    grouped.push({ category: 'Other', markets: uncategorised })
  }

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-900 pt-14 pb-24">
        {/* Header */}
        <div className="border-b border-surface-300/50 bg-surface-900/90 sticky top-14 z-30 backdrop-blur-sm">
          <div className="px-4 py-3 max-w-screen-2xl mx-auto">
            {/* Title row */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Link
                  href="/exchange"
                  className="p-1.5 rounded-lg hover:bg-surface-300/50 text-surface-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold text-white">Market Heat Map</h1>
                    <span className="hidden sm:block text-xs text-surface-500 bg-surface-200/50 px-2 py-0.5 rounded">
                      {filtered.length} markets
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 hidden sm:block">
                    Sized by volume · Colored by consensus direction
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLegend((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/50 text-xs text-surface-400 hover:text-white hover:bg-surface-300/50 transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Legend</span>
                </button>
                <select
                  value={blockHeight}
                  onChange={(e) => setBlockHeight(Number(e.target.value))}
                  className="text-xs bg-surface-200/50 border border-surface-300/50 text-surface-400 rounded-lg px-2 py-1.5 focus:outline-none focus:border-for-500/50 cursor-pointer"
                >
                  <option value={200}>Compact</option>
                  <option value={280}>Standard</option>
                  <option value={380}>Tall</option>
                </select>
                <button
                  onClick={() => setRefreshKey((k) => k + 1)}
                  disabled={loading}
                  className="p-1.5 rounded-lg hover:bg-surface-300/50 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </button>
              </div>
            </div>

            {/* Stats */}
            {!loading && markets.length > 0 && (
              <div className="mb-3">
                <StatsBar markets={filtered} />
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 flex-shrink-0">
                {PRICE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setPriceFilter(f.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0',
                      priceFilter === f.id
                        ? 'bg-for-600/30 text-for-300 border border-for-500/40'
                        : 'text-surface-400 hover:text-white bg-surface-200/30 border border-transparent hover:border-surface-400/30',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-surface-500 flex-shrink-0 mx-1" />
              <div className="flex items-center gap-1 flex-shrink-0">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0',
                      statusFilter === f.id
                        ? 'bg-surface-300/60 text-white border border-surface-400/40'
                        : 'text-surface-500 hover:text-white bg-surface-200/30 border border-transparent hover:border-surface-400/30',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Legend (collapsible) */}
          <AnimatePresence>
            {showLegend && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-surface-300/40 bg-surface-200/20"
              >
                <div className="px-4 py-3">
                  <Legend />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Heat map content */}
        <div className="px-4 py-4 max-w-screen-2xl mx-auto">
          {loading ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 rounded-xl overflow-hidden"
                  style={{ width: BLOCK_W, height: blockHeight }}
                >
                  <Skeleton className="w-full h-full" />
                </div>
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Activity className="h-10 w-10 text-surface-600 mb-3" />
              <p className="text-surface-400 font-medium">No markets match these filters</p>
              <p className="text-surface-600 text-sm mt-1">Try adjusting the price or status filters</p>
              <button
                onClick={() => { setPriceFilter('all'); setStatusFilter('all') }}
                className="mt-4 px-4 py-2 bg-for-600/20 hover:bg-for-600/30 border border-for-500/30 text-for-300 text-sm rounded-xl transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Horizontal scrolling row of category blocks */}
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                {grouped.map(({ category, markets: catMarkets }) => (
                  <div key={category} className="snap-start">
                    <CategoryBlock
                      category={category}
                      markets={catMarkets}
                      onHover={setTooltip}
                      blockHeight={blockHeight}
                    />
                  </div>
                ))}
              </div>

              {/* Category summary grid (below heat map) */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {grouped.map(({ category, markets: catMarkets }) => {
                  const avgPrice = catMarkets.length > 0
                    ? catMarkets.reduce((s, m) => s + m.price, 0) / catMarkets.length
                    : 50
                  const forCount = catMarkets.filter((m) => m.price >= 55).length
                  const againstCount = catMarkets.filter((m) => m.price <= 45).length
                  const accent = CAT_ACCENT[category] ?? 'text-surface-400'
                  return (
                    <div
                      key={category}
                      className="bg-surface-100/30 border border-surface-300/50 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn('text-xs font-semibold truncate', accent)}>
                          {category}
                        </span>
                        <span className={cn('text-xs font-bold', priceToTextColor(avgPrice, 'active'))}>
                          {Math.round(avgPrice)}¢
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-surface-500">
                        <span>{catMarkets.length} mkts</span>
                        <span className="text-for-400">{forCount} FOR</span>
                        <span className="text-against-400">{againstCount} AGN</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            avgPrice >= 57 ? 'bg-for-500' : avgPrice <= 43 ? 'bg-against-500' : 'bg-surface-500',
                          )}
                          style={{ width: `${Math.min(avgPrice, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* All markets count footer */}
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-surface-600">
                <Info className="h-3.5 w-3.5" />
                <span>
                  Showing {filtered.length} of {markets.length} markets · Tile size = vote volume · Click any tile to open market
                </span>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Global tooltip */}
      <AnimatePresence>
        {tooltip && <Tooltip data={tooltip} />}
      </AnimatePresence>

      <BottomNav />
    </>
  )
}
