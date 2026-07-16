'use client'

/**
 * /exchange/calculator — Civic Market Position Calculator
 *
 * An educational tool for understanding resolution probability, vote leverage,
 * and historical analogues for any active civic prediction market.
 *
 * Shows:
 *   1. Market search + selection
 *   2. Current consensus price with distance-to-law indicator
 *   3. Historical resolution rate for topics at this price range
 *   4. Votes-needed meter: how many more votes to cross 67% threshold
 *   5. Percentile ranking vs all active markets
 *   6. Similar resolved topics (same category, similar price)
 *
 * Distinct from /exchange/[id] (individual market detail) and
 * /exchange/arbitrage (expert vs crowd divergence).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Calculator,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  CalculatorData,
  CalculatorSearchResult,
  HistoricalBand,
} from '@/app/api/exchange/calculator/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeUntil(iso: string | null): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h left`
  if (h > 0) return `${h}h ${m % 60}m left`
  return `${m}m left`
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
}

function catStyle(cat: string | null) {
  return cat
    ? (CATEGORY_COLOR[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-400/30' })
    : { text: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-400/30' }
}

// ─── Resolution probability ring ──────────────────────────────────────────────

function ProbabilityRing({ rate, label }: { rate: number; label: string }) {
  const pct = Math.round(rate * 100)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - rate)
  const color = rate >= 0.7 ? '#10b981' : rate >= 0.5 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1a22" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold text-white">
          {pct}%
        </span>
      </div>
      <p className="text-xs text-surface-500 text-center leading-tight">{label}</p>
    </div>
  )
}

// ─── Historical band bar ───────────────────────────────────────────────────────

function BandBar({ band, isActive }: { band: HistoricalBand; isActive: boolean }) {
  const pct = Math.round(band.law_rate * 100)
  const color = pct >= 67 ? 'bg-emerald' : pct >= 50 ? 'bg-gold' : pct >= 33 ? 'bg-for-400' : 'bg-against-400'

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
        isActive && 'bg-surface-200/60 ring-1 ring-for-500/30'
      )}
    >
      <span className={cn('text-xs font-mono w-16 flex-shrink-0', isActive ? 'text-for-300 font-semibold' : 'text-surface-500')}>
        {band.label}
      </span>
      <div className="flex-1 h-2 bg-surface-300/40 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={cn('text-xs font-mono font-semibold', isActive ? 'text-white' : 'text-surface-500')}>
          {pct}%
        </span>
        <span className="text-[10px] text-surface-600">
          ({band.law_count}/{band.total})
        </span>
      </div>
    </div>
  )
}

// ─── Market search ─────────────────────────────────────────────────────────────

function MarketSearch({
  onSelect,
}: {
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CalculatorSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exchange/calculator?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Load defaults on mount
  useEffect(() => { search('') }, [search])

  function handleSelect(id: string) {
    setOpen(false)
    setQuery('')
    onSelect(id)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search for a civic market…"
          className={cn(
            'w-full h-11 pl-10 pr-4 rounded-xl',
            'bg-surface-200/60 border border-surface-300/60',
            'text-sm text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30',
            'transition-colors'
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              'absolute z-50 top-full mt-1.5 w-full',
              'bg-surface-100 border border-surface-300/60 rounded-xl',
              'shadow-xl shadow-black/40',
              'overflow-hidden'
            )}
          >
            <div className="p-1 max-h-72 overflow-y-auto">
              {results.map((r) => {
                const cs = catStyle(r.category)
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left',
                      'hover:bg-surface-200/60 transition-colors'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                        {r.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {r.category && (
                          <span className={cn('text-[10px] font-mono font-semibold', cs.text)}>
                            {r.category}
                          </span>
                        )}
                        <span className="text-[10px] text-surface-600">
                          {fmtVol(r.volume)} votes
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1 pt-0.5">
                      <span className={cn(
                        'font-mono text-sm font-bold',
                        r.price >= 67 ? 'text-emerald' : r.price >= 55 ? 'text-for-400' : r.price <= 33 ? 'text-against-400' : 'text-surface-500'
                      )}>
                        {Math.round(r.price)}¢
                      </span>
                      <span className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded',
                        r.status === 'voting' ? 'bg-purple/20 text-purple' : 'bg-for-500/20 text-for-300'
                      )}>
                        {r.status === 'voting' ? 'VOTING' : 'LIVE'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay to close dropdown */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Votes needed meter ────────────────────────────────────────────────────────

function VotesMeter({
  label,
  needed,
  current,
  side,
}: {
  label: string
  needed: number
  current: number
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  const total = current + needed
  const pct = total > 0 ? (current / total) * 100 : 0

  return (
    <div className={cn(
      'p-4 rounded-xl border',
      isFor
        ? 'bg-for-900/20 border-for-700/30'
        : 'bg-against-900/20 border-against-700/30'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isFor
            ? <ThumbsUp className="h-4 w-4 text-for-400" />
            : <ThumbsDown className="h-4 w-4 text-against-400" />
          }
          <span className={cn('text-xs font-mono font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
            {label}
          </span>
        </div>
        <span className="text-xs font-mono text-surface-500">
          {needed === 0 ? 'Already there' : `+${fmtVol(needed)} votes needed`}
        </span>
      </div>
      <div className="h-2.5 bg-surface-300/40 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', isFor ? 'bg-for-500' : 'bg-against-500')}
        />
      </div>
      <p className="text-[10px] text-surface-600 mt-1.5">
        {fmtVol(current)} current · {fmtVol(total)} needed
      </p>
    </div>
  )
}

// ─── Main calculator panel ─────────────────────────────────────────────────────

function CalculatorPanel({ topicId }: { topicId: string }) {
  const [data, setData] = useState<CalculatorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/exchange/calculator?id=${topicId}`)
      if (res.ok) setData(await res.json())
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-4 mt-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mt-6 p-6 rounded-xl bg-surface-100 border border-surface-300/60 text-center">
        <p className="text-sm text-surface-500">Failed to load market data.</p>
        <button onClick={load} className="mt-2 text-xs text-for-400 hover:text-for-300 transition-colors">
          Try again
        </button>
      </div>
    )
  }

  const { topic, historical, distance_to_law, votes_needed_for, votes_needed_against, current_percentile, similar_resolved } = data
  const isAboveLaw = topic.price >= data.law_threshold
  const isNearLaw = topic.price >= data.law_threshold - 10
  const isNearFail = topic.price <= 40

  // Find the active band for this topic's price
  const activeBandIndex = historical.findIndex(
    (b) => topic.price >= b.low && topic.price < b.high
  )

  // Historical resolution rate for this price level
  const activeBand = activeBandIndex >= 0 ? historical[activeBandIndex] : null
  const resolutionRate = activeBand?.law_rate ?? 0

  const cs = catStyle(topic.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 space-y-5"
    >
      {/* Market header */}
      <div className="p-4 rounded-xl bg-surface-100 border border-surface-300/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {topic.category && (
                <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full border', cs.text, cs.bg, cs.border)}>
                  {topic.category}
                </span>
              )}
              <span className={cn(
                'text-xs font-mono px-2 py-0.5 rounded-full',
                topic.status === 'voting' ? 'bg-purple/20 text-purple' : 'bg-for-500/20 text-for-300'
              )}>
                {topic.status === 'voting' ? 'VOTING' : 'ACTIVE'}
              </span>
              {topic.voting_ends_at && (
                <span className="flex items-center gap-1 text-xs text-surface-500">
                  <Clock className="h-3 w-3" />
                  {timeUntil(topic.voting_ends_at)}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">
              {topic.statement}
            </h2>
          </div>
          <Link
            href={`/exchange/${topic.id}`}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-surface-500 hover:text-for-400 transition-colors"
            aria-label="Open market detail"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Price bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-for-400">{Math.round(topic.price)}¢ FOR</span>
            <span className="text-surface-500">{fmtVol(topic.volume)} total votes</span>
            <span className="text-against-400">{100 - Math.round(topic.price)}¢ AGAINST</span>
          </div>
          <div className="h-3 bg-against-900/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${topic.price}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                isAboveLaw ? 'bg-emerald' : isNearLaw ? 'bg-for-400' : 'bg-for-500'
              )}
            />
          </div>
          <div
            className="relative mt-1"
            style={{ paddingLeft: `${data.law_threshold}%` }}
          >
            <div className="absolute top-0 flex flex-col items-center" style={{ left: `${data.law_threshold}%`, transform: 'translateX(-50%)' }}>
              <Gavel className="h-3 w-3 text-emerald opacity-60" />
              <span className="text-[9px] font-mono text-emerald opacity-60">67¢ LAW</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key signals row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Distance to law */}
        <div className="p-3 rounded-xl bg-surface-100 border border-surface-300/60 text-center">
          <div className={cn(
            'text-2xl font-mono font-bold',
            isAboveLaw ? 'text-emerald' : isNearLaw ? 'text-gold' : isNearFail ? 'text-against-400' : 'text-surface-500'
          )}>
            {distance_to_law > 0 ? '+' : ''}{Math.round(distance_to_law)}¢
          </div>
          <p className="text-[10px] text-surface-500 mt-0.5 leading-tight">
            {isAboveLaw ? 'above law threshold' : 'from law threshold'}
          </p>
        </div>

        {/* Percentile */}
        <div className="p-3 rounded-xl bg-surface-100 border border-surface-300/60 text-center">
          <div className="text-2xl font-mono font-bold text-purple">
            {current_percentile}th
          </div>
          <p className="text-[10px] text-surface-500 mt-0.5 leading-tight">
            percentile vs all live markets
          </p>
        </div>

        {/* Historical rate */}
        <div className="p-3 rounded-xl bg-surface-100 border border-surface-300/60 text-center">
          <div className={cn(
            'text-2xl font-mono font-bold',
            resolutionRate >= 0.67 ? 'text-emerald' : resolutionRate >= 0.5 ? 'text-gold' : 'text-against-400'
          )}>
            {Math.round(resolutionRate * 100)}%
          </div>
          <p className="text-[10px] text-surface-500 mt-0.5 leading-tight">
            historic law rate at this price
          </p>
        </div>
      </div>

      {/* Resolution probability ring + band */}
      <div className="p-4 rounded-xl bg-surface-100 border border-surface-300/60">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-surface-500" />
          <h3 className="text-sm font-mono font-semibold text-white">Historical Resolution Rate</h3>
        </div>
        <div className="flex items-start gap-6">
          <ProbabilityRing
            rate={resolutionRate}
            label={`Topics at ${activeBand?.label ?? '—'} become law ${Math.round(resolutionRate * 100)}% of the time`}
          />
          <div className="flex-1 min-w-0 space-y-1">
            {historical.map((band, i) => (
              <BandBar key={band.label} band={band} isActive={i === activeBandIndex} />
            ))}
          </div>
        </div>
      </div>

      {/* Votes needed */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-surface-500" />
          <h3 className="text-sm font-mono font-semibold text-white">Vote Leverage</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VotesMeter
            label="Votes to reach LAW (67%)"
            needed={votes_needed_for}
            current={Math.round((topic.price / 100) * topic.volume)}
            side="for"
          />
          <VotesMeter
            label="Votes to force FAIL (33%)"
            needed={votes_needed_against}
            current={Math.round(((100 - topic.price) / 100) * topic.volume)}
            side="against"
          />
        </div>
      </div>

      {/* Similar resolved topics */}
      {similar_resolved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-surface-500" />
            <h3 className="text-sm font-mono font-semibold text-white">Similar Resolved Markets</h3>
            <span className="text-xs text-surface-600">— same category, similar price</span>
          </div>
          <div className="space-y-2">
            {similar_resolved.map((s) => (
              <Link
                key={s.id}
                href={`/topic/${s.id}`}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl',
                  'bg-surface-100 border border-surface-300/60',
                  'hover:border-surface-400/60 transition-colors group'
                )}
              >
                <div className={cn(
                  'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
                  s.final_status === 'law' ? 'bg-emerald/10' : 'bg-against-500/10'
                )}>
                  {s.final_status === 'law'
                    ? <Gavel className="h-4 w-4 text-emerald" />
                    : <X className="h-4 w-4 text-against-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white line-clamp-1 group-hover:text-for-300 transition-colors">
                    {s.statement}
                  </p>
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    Final: {Math.round(s.final_price)}¢ · {fmtVol(s.total_votes)} votes
                  </p>
                </div>
                <div className={cn(
                  'flex-shrink-0 text-xs font-mono font-semibold px-2 py-0.5 rounded',
                  s.final_status === 'law' ? 'bg-emerald/20 text-emerald' : 'bg-against-500/20 text-against-300'
                )}>
                  {s.final_status === 'law' ? 'LAW' : 'FAILED'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Inner component with search params ───────────────────────────────────────

function CalculatorInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>(searchParams.get('id') ?? '')

  function handleSelect(id: string) {
    setSelectedId(id)
    router.replace(`/exchange/calculator?id=${id}`, { scroll: false })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/exchange"
          className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
          aria-label="Back to Exchange"
        >
          <ArrowRight className="h-4 w-4 text-surface-500 rotate-180" />
        </Link>
        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
          <Calculator className="h-5 w-5 text-purple" />
        </div>
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Market Calculator</h1>
          <p className="text-sm font-mono text-surface-500 mt-0.5">
            Resolution probability · Vote leverage · Historical analogues
          </p>
        </div>
      </div>

      {/* Search */}
      <MarketSearch onSelect={handleSelect} />

      {/* Empty state */}
      {!selectedId && (
        <div className="mt-10 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-200/40 border border-surface-300/40 mx-auto mb-4">
            <Calculator className="h-7 w-7 text-surface-500" />
          </div>
          <h3 className="text-base font-mono font-semibold text-white mb-2">Select a market above</h3>
          <p className="text-sm text-surface-500 max-w-sm mx-auto leading-relaxed">
            Pick any live civic prediction market to see its resolution probability,
            how many votes it needs to reach law status, and historical analogues.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {[
              { icon: TrendingUp, title: 'Resolution probability', desc: 'Based on historical data for topics at this price level' },
              { icon: Zap, title: 'Vote leverage', desc: 'How many votes are needed to push across the 67% law threshold' },
              { icon: Scale, title: 'Historical analogues', desc: 'Similar resolved markets in the same category' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-4 rounded-xl bg-surface-100 border border-surface-300/40">
                <Icon className="h-5 w-5 text-purple mb-2" />
                <p className="text-xs font-semibold text-white mb-1">{title}</p>
                <p className="text-[11px] text-surface-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculator panel */}
      {selectedId && <CalculatorPanel key={selectedId} topicId={selectedId} />}
    </div>
  )
}

// ─── Page export ───────────────────────────────────────────────────────────────

export function CalculatorClient() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <Suspense fallback={
        <div className="max-w-2xl mx-auto px-4 pt-20">
          <Skeleton className="h-12 w-64 rounded-xl mb-6" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      }>
        <CalculatorInner />
      </Suspense>
      <BottomNav />
    </div>
  )
}
