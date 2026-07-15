'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  GitCompare,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CorrelationMarket, CorrelationPair, CorrelationsResponse } from '@/app/api/exchange/correlations/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_DOT: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-for-300',
  Philosophy:  'bg-surface-400',
  Culture:     'bg-against-400',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}

function catDot(cat: string | null) {
  return cat ? (CAT_DOT[cat] ?? 'bg-surface-500') : 'bg-surface-500'
}

// ─── Correlation → colour gradient ───────────────────────────────────────────

function corrToStyle(r: number, n: number): { bg: string; text: string; border: string } {
  if (n < 3) {
    return { bg: 'bg-surface-200', text: 'text-surface-500', border: 'border-surface-300' }
  }
  if (r >= 0.7)  return { bg: 'bg-emerald/25', text: 'text-emerald',      border: 'border-emerald/40'      }
  if (r >= 0.4)  return { bg: 'bg-emerald/12', text: 'text-emerald',      border: 'border-emerald/25'      }
  if (r >= 0.15) return { bg: 'bg-for-600/10', text: 'text-for-300',      border: 'border-for-600/20'      }
  if (r <= -0.7) return { bg: 'bg-against-600/25', text: 'text-against-400', border: 'border-against-500/40' }
  if (r <= -0.4) return { bg: 'bg-against-600/12', text: 'text-against-400', border: 'border-against-500/25' }
  if (r <= -0.15)return { bg: 'bg-against-600/6',  text: 'text-against-300', border: 'border-against-500/15' }
  return { bg: 'bg-surface-200', text: 'text-surface-500', border: 'border-surface-300' }
}

function corrLabel(r: number, n: number): string {
  if (n < 3) return 'N/A'
  return r > 0 ? `+${r.toFixed(2)}` : r.toFixed(2)
}

// ─── Diagonal / self cell ────────────────────────────────────────────────────

function SelfCell({ market }: { market: CorrelationMarket }) {
  return (
    <div
      className="flex items-center justify-center border border-surface-300 bg-surface-300/60 rounded-lg"
      style={{ minHeight: 52, minWidth: 52 }}
      title={market.statement}
    >
      <span className="font-mono text-xs text-surface-500 font-bold">—</span>
    </div>
  )
}

// ─── Market label row/column header ──────────────────────────────────────────

function MarketLabel({ market, index }: { market: CorrelationMarket; index: number }) {
  return (
    <Link href={`/exchange/${market.id}`} className="group flex items-center gap-1.5 min-w-0 max-w-[160px]">
      <span
        className={cn('flex-shrink-0 h-2 w-2 rounded-full', catDot(market.category))}
      />
      <span className="font-mono text-xs text-surface-400 group-hover:text-white truncate transition-colors">
        {index + 1}. {market.statement.length > 22
          ? market.statement.slice(0, 22) + '…'
          : market.statement}
      </span>
    </Link>
  )
}

// ─── Pair detail panel ───────────────────────────────────────────────────────

interface PairPanel {
  a: CorrelationMarket
  b: CorrelationMarket
  r: number
  n: number
}

function PairDetail({ pair, onClose }: { pair: PairPanel; onClose: () => void }) {
  const { bg, text } = corrToStyle(pair.r, pair.n)
  const isPositive = pair.r >= 0.15
  const isNegative = pair.r <= -0.15
  const strength =
    Math.abs(pair.r) >= 0.7 ? 'Strong' :
    Math.abs(pair.r) >= 0.4 ? 'Moderate' :
    Math.abs(pair.r) >= 0.15 ? 'Weak' : 'Negligible'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-surface-500 flex-shrink-0" />
          <span className="font-mono text-sm text-white font-bold">Market Pair</span>
        </div>
        <button
          onClick={onClose}
          className="text-surface-500 hover:text-white transition-colors p-0.5"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Correlation badge */}
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', bg, text, 'border-surface-300')}>
          {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
          {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
          <span className="font-mono text-base font-bold">
            {corrLabel(pair.r, pair.n)}
          </span>
        </div>
        <div>
          <p className={cn('font-mono text-sm font-bold', text)}>
            {strength} {isPositive ? 'positive' : isNegative ? 'inverse' : 'correlation'}
          </p>
          <p className="font-mono text-xs text-surface-500">
            {pair.n} overlapping data points
          </p>
        </div>
      </div>

      {/* Interpretation */}
      <p className="font-mono text-xs text-surface-400 leading-relaxed">
        {pair.n < 3
          ? 'Not enough shared price history to compute a reliable correlation.'
          : isPositive && Math.abs(pair.r) >= 0.4
          ? 'These markets tend to move together — when one gains consensus, so does the other.'
          : isNegative && Math.abs(pair.r) >= 0.4
          ? 'These markets move in opposite directions — rising consensus on one tends to coincide with falling consensus on the other.'
          : Math.abs(pair.r) < 0.15
          ? 'These markets appear to move independently of each other.'
          : 'There is a mild relationship between these markets, but it is not strongly predictive.'}
      </p>

      {/* Market cards */}
      <div className="grid grid-cols-2 gap-2">
        {[pair.a, pair.b].map(m => (
          <Link
            key={m.id}
            href={`/exchange/${m.id}`}
            className="rounded-xl border border-surface-300 bg-surface-200 p-3 hover:border-surface-400 transition-colors group"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', catDot(m.category))} />
              <span className="font-mono text-[10px] text-surface-500">{m.category ?? 'General'}</span>
            </div>
            <p className="font-mono text-xs text-white font-medium leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
              {m.statement}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-for-400">{m.price}¢</span>
              <span className="font-mono text-[10px] text-surface-500">
                {m.volume.toLocaleString()} votes
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href={`/exchange/${pair.a.id}`}
        className="block text-center font-mono text-xs text-surface-500 hover:text-for-400 transition-colors"
      >
        View market A →
      </Link>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CorrelationsClient() {
  const [data, setData] = useState<CorrelationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedPair, setSelectedPair] = useState<PairPanel | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/exchange/correlations')
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Build a lookup map for fast pair retrieval
  const pairMap = useMemo(() => {
    if (!data) return new Map<string, CorrelationPair>()
    const m = new Map<string, CorrelationPair>()
    for (const p of data.pairs) {
      m.set(`${p.id_a}|${p.id_b}`, p)
      m.set(`${p.id_b}|${p.id_a}`, p)
    }
    return m
  }, [data])

  function getPair(a: string, b: string) {
    return pairMap.get(`${a}|${b}`) ?? null
  }

  function handleCellClick(a: CorrelationMarket, b: CorrelationMarket) {
    const pair = getPair(a.id, b.id)
    if (!pair) return
    setSelectedPair({ a, b, r: pair.r, n: pair.n })
  }

  // Top correlated and inversely correlated pairs for the summary cards
  const { topPositive, topNegative } = useMemo(() => {
    if (!data || !data.pairs.length) return { topPositive: [], topNegative: [] }
    const byR = [...data.pairs].filter(p => p.n >= 3).sort((a, b) => b.r - a.r)
    return {
      topPositive: byR.slice(0, 3),
      topNegative: byR.slice(-3).reverse(),
    }
  }, [data])

  const markets = data?.markets ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-24">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/exchange" className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-gold" />
            <h1 className="font-mono text-xl font-bold text-white">Market Correlations</h1>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        <p className="font-mono text-sm text-surface-500 mb-8 max-w-xl">
          Pearson correlation between the price histories of the top 20 civic markets.
          Positive values (green) mean the markets move together; negative (red) means they diverge.
        </p>

        {/* ── Legend ── */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {[
            { label: 'Strong +', bg: 'bg-emerald/25', text: 'text-emerald', border: 'border-emerald/40' },
            { label: 'Weak +',   bg: 'bg-emerald/12', text: 'text-emerald', border: 'border-emerald/25' },
            { label: 'Neutral',  bg: 'bg-surface-200', text: 'text-surface-500', border: 'border-surface-300' },
            { label: 'Weak −',   bg: 'bg-against-600/12', text: 'text-against-400', border: 'border-against-500/25' },
            { label: 'Strong −', bg: 'bg-against-600/25', text: 'text-against-400', border: 'border-against-500/40' },
          ].map(s => (
            <div
              key={s.label}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium', s.bg, s.text, s.border)}
            >
              {s.label}
            </div>
          ))}
          <span className="font-mono text-xs text-surface-600">· Click any cell to inspect the pair</span>
        </div>

        {/* ── Main content ── */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {error && !loading && (
          <EmptyState
            icon={BarChart2}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="Couldn't load correlations"
            description="Failed to fetch market price histories. Try refreshing."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && markets.length < 2 && (
          <EmptyState
            icon={BarChart2}
            title="Not enough markets yet"
            description="Correlations require at least two markets with price history. Check back once more topics are active."
            action={{ label: 'Browse Markets', href: '/exchange' }}
          />
        )}

        {!loading && !error && markets.length >= 2 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">

            {/* ── Matrix ── */}
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `160px repeat(${markets.length}, minmax(52px, 1fr))`,
                  }}
                >
                  {/* Top-left corner spacer */}
                  <div />

                  {/* Column headers (numbers) */}
                  {markets.map((m, j) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-center"
                      onMouseEnter={() => setHoveredId(m.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <span
                        className={cn(
                          'font-mono text-[10px] font-bold transition-colors',
                          hoveredId === m.id ? 'text-white' : 'text-surface-500',
                        )}
                      >
                        {j + 1}
                      </span>
                    </div>
                  ))}

                  {/* Rows */}
                  {markets.map((rowMarket, i) => (
                    <>
                      {/* Row label */}
                      <div
                        key={`label-${rowMarket.id}`}
                        className="flex items-center pr-2"
                        onMouseEnter={() => setHoveredId(rowMarket.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <MarketLabel market={rowMarket} index={i} />
                      </div>

                      {/* Cells */}
                      {markets.map((colMarket, j) => {
                        if (i === j) {
                          return <SelfCell key={colMarket.id} market={rowMarket} />
                        }
                        const pair = getPair(rowMarket.id, colMarket.id)
                        const r = pair?.r ?? 0
                        const n = pair?.n ?? 0
                        const { bg, text, border } = corrToStyle(r, n)
                        const isHighlighted =
                          hoveredId === rowMarket.id || hoveredId === colMarket.id
                        const isSelected =
                          selectedPair !== null &&
                          ((selectedPair.a.id === rowMarket.id && selectedPair.b.id === colMarket.id) ||
                           (selectedPair.a.id === colMarket.id && selectedPair.b.id === rowMarket.id))

                        return (
                          <button
                            key={colMarket.id}
                            onClick={() => handleCellClick(rowMarket, colMarket)}
                            onMouseEnter={() => setHoveredId(null)}
                            className={cn(
                              'flex items-center justify-center rounded-lg border transition-all duration-150',
                              'font-mono text-[11px] font-bold',
                              'min-h-[52px] min-w-[52px]',
                              bg, text, border,
                              isHighlighted && 'ring-1 ring-surface-400',
                              isSelected && 'ring-2 ring-gold',
                              'hover:brightness-125 hover:z-10 relative cursor-pointer',
                            )}
                            title={`${rowMarket.statement} vs ${colMarket.statement}: r = ${corrLabel(r, n)}`}
                          >
                            {corrLabel(r, n)}
                          </button>
                        )
                      })}
                    </>
                  ))}
                </div>
              </div>

              {/* ── Key ── */}
              <div className="flex items-start gap-2 rounded-xl border border-surface-300 bg-surface-100 p-4">
                <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-surface-500 leading-relaxed">
                  Correlation is computed using Pearson r on daily price buckets where both markets have data.
                  Markets with fewer than 3 overlapping days show N/A. Hover row or column headers to highlight; click any cell to inspect.
                </p>
              </div>
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-5">

              {/* Selected pair */}
              <AnimatePresence>
                {selectedPair && (
                  <PairDetail
                    pair={selectedPair}
                    onClose={() => setSelectedPair(null)}
                  />
                )}
              </AnimatePresence>

              {/* Top positive pairs */}
              {topPositive.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald" />
                    <span className="font-mono text-sm text-white font-bold">Strongest Links</span>
                  </div>
                  {topPositive.map(p => {
                    const a = markets.find(m => m.id === p.id_a)
                    const b = markets.find(m => m.id === p.id_b)
                    if (!a || !b) return null
                    return (
                      <button
                        key={`${p.id_a}|${p.id_b}`}
                        onClick={() => setSelectedPair({ a, b, r: p.r, n: p.n })}
                        className="w-full text-left rounded-xl border border-emerald/20 bg-emerald/6 p-3 hover:border-emerald/35 transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-emerald">
                            r = +{p.r.toFixed(2)}
                          </span>
                          <span className="font-mono text-[10px] text-surface-500">{p.n} pts</span>
                        </div>
                        <p className="font-mono text-[11px] text-surface-400 group-hover:text-white transition-colors truncate">
                          {a.statement.slice(0, 28)}…
                        </p>
                        <p className="font-mono text-[11px] text-surface-500 truncate">
                          {b.statement.slice(0, 28)}…
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Top negative pairs */}
              {topNegative.length > 0 && topNegative[0].r <= -0.1 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-against-400" />
                    <span className="font-mono text-sm text-white font-bold">Strongest Divergences</span>
                  </div>
                  {topNegative.map(p => {
                    const a = markets.find(m => m.id === p.id_a)
                    const b = markets.find(m => m.id === p.id_b)
                    if (!a || !b) return null
                    return (
                      <button
                        key={`${p.id_a}|${p.id_b}`}
                        onClick={() => setSelectedPair({ a, b, r: p.r, n: p.n })}
                        className="w-full text-left rounded-xl border border-against-500/20 bg-against-500/6 p-3 hover:border-against-500/35 transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-against-400">
                            r = {p.r.toFixed(2)}
                          </span>
                          <span className="font-mono text-[10px] text-surface-500">{p.n} pts</span>
                        </div>
                        <p className="font-mono text-[11px] text-surface-400 group-hover:text-white transition-colors truncate">
                          {a.statement.slice(0, 28)}…
                        </p>
                        <p className="font-mono text-[11px] text-surface-500 truncate">
                          {b.statement.slice(0, 28)}…
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Market index */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-gold" />
                  <span className="font-mono text-sm text-white font-bold">Market Index</span>
                </div>
                <div className="space-y-1.5">
                  {markets.map((m, i) => (
                    <Link
                      key={m.id}
                      href={`/exchange/${m.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <span className="font-mono text-[10px] text-surface-600 w-4 text-right flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', catDot(m.category))} />
                      <span className="font-mono text-[11px] text-surface-400 group-hover:text-white transition-colors truncate">
                        {m.statement.length > 30 ? m.statement.slice(0, 30) + '…' : m.statement}
                      </span>
                      <span className="font-mono text-[10px] text-surface-600 flex-shrink-0 ml-auto">
                        {m.price}¢
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
