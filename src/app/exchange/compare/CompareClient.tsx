'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  GitCompare,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
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
import type { CompareMarket, CompareResponse } from '@/app/api/exchange/compare/route'
import type { Market } from '@/app/api/exchange/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function catStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

function statusBadge(status: string): { label: string; cls: string } {
  if (status === 'law')    return { label: 'LAW',    cls: 'bg-gold/20 text-gold border-gold/30' }
  if (status === 'failed') return { label: 'FAILED', cls: 'bg-against-500/15 text-against-400 border-against-500/30' }
  if (status === 'voting') return { label: 'VOTING', cls: 'bg-purple/15 text-purple border-purple/30' }
  if (status === 'active') return { label: 'ACTIVE', cls: 'bg-for-500/15 text-for-400 border-for-500/30' }
  return { label: 'PROPOSED', cls: 'bg-surface-300/50 text-surface-600 border-surface-400/30' }
}

function formatVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDelta(d: number | null): { label: string; cls: string; Icon: typeof TrendingUp } | null {
  if (d === null) return null
  if (Math.abs(d) < 0.5) return { label: '~0¢', cls: 'text-surface-500', Icon: TrendingUp }
  if (d > 0) return { label: `+${d.toFixed(1)}¢`, cls: 'text-emerald', Icon: TrendingUp }
  return { label: `${d.toFixed(1)}¢`, cls: 'text-against-400', Icon: TrendingDown }
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 30) return `${Math.floor(d / 30)}mo ago`
  if (d > 0)  return `${d}d ago`
  if (h > 0)  return `${h}h ago`
  return `${m}m ago`
}

// ─── Market Search Picker ──────────────────────────────────────────────────────

function MarketPicker({
  label,
  onPick,
  current,
}: {
  label: string
  onPick: (m: Market) => void
  current?: CompareMarket | null
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Market[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Normalise search results to the Market shape (price = blue_pct, volume = total_votes)
      const raw: Array<Record<string, unknown>> = data.results ?? []
      const normalised: Market[] = raw.map((r) => ({
        id: r.id as string,
        statement: r.statement as string,
        category: (r.category as string | null) ?? null,
        scope: 'national',
        status: r.status as string,
        price: (r.blue_pct as number) ?? 50,
        price_label: `${Math.round((r.blue_pct as number) ?? 50)}¢`,
        volume: (r.total_votes as number) ?? 0,
        voting_ends_at: null,
        feed_score: 0,
        view_count: (r.view_count as number) ?? 0,
        created_at: r.created_at as string,
        updated_at: r.created_at as string,
        market_status: 'live' as const,
        is_hot: false,
        is_closing_soon: false,
        is_near_law: false,
        is_deadlocked: false,
      }))
      setResults(normalised)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 300)
    setOpen(true)
  }

  function pick(m: Market) {
    onPick(m)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const cs = catStyle(current?.category ?? null)

  return (
    <div className="relative flex-1 min-w-0">
      {/* Current selection pill */}
      {current ? (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-surface-500 mb-1">{label}</p>
            <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{current.statement}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {current.category && (
                <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', cs.text, cs.bg, cs.border)}>
                  {current.category}
                </span>
              )}
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', statusBadge(current.status).cls)}>
                {statusBadge(current.status).label}
              </span>
              <span className="text-[10px] font-mono text-for-400 font-bold">{Math.round(current.price)}¢</span>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex-shrink-0 p-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Change market"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-400 bg-surface-100/50 p-3">
          <p className="text-xs font-mono text-surface-500 mb-2">{label}</p>
          <button
            onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            className="w-full flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Search className="h-4 w-4 flex-shrink-0" />
            <span>Search a market…</span>
          </button>
        </div>
      )}

      {/* Search dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute inset-x-0 top-full mt-1 z-50 rounded-xl bg-surface-100 border border-surface-300 shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-surface-300 flex items-center gap-2">
              <Search className="h-4 w-4 text-surface-500 flex-shrink-0 ml-1" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={handleInput}
                placeholder="Search markets…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-surface-500 outline-none"
              />
              {loading && <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin flex-shrink-0" />}
              <button onClick={() => setOpen(false)} className="text-surface-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {results.length === 0 && query.length >= 2 && !loading ? (
                <p className="text-xs text-surface-500 text-center py-4">No markets found</p>
              ) : results.length === 0 && query.length < 2 ? (
                <p className="text-xs text-surface-500 text-center py-4">Type to search any civic topic…</p>
              ) : null}
              {results.map((m) => {
                const cs2 = catStyle((m as { category?: string | null }).category ?? null)
                return (
                  <button
                    key={m.id}
                    onClick={() => pick(m)}
                    className="w-full flex items-start gap-2 p-3 hover:bg-surface-200 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium leading-tight line-clamp-2">{m.statement}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {(m as { category?: string | null }).category && (
                          <span className={cn('text-[9px] font-mono px-1 py-0.5 rounded-full border', cs2.text, cs2.bg, cs2.border)}>
                            {(m as { category?: string | null }).category}
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-for-400">{Math.round(m.price)}¢</span>
                        <span className="text-[9px] font-mono text-surface-500">{formatVol(m.volume)} votes</span>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Consensus Gauge ──────────────────────────────────────────────────────────

function ConsensusGauge({
  price,
  winner,
}: {
  price: number
  winner: boolean
}) {
  const forPct = Math.round(price)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="relative h-5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {/* Midline */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-surface-500/60" />
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-bold">{forPct}¢ FOR</span>
        <span className="text-against-400 font-bold">AGAINST {againstPct}¢</span>
      </div>
      {winner && (
        <div className="flex justify-center">
          <span className="text-[9px] font-mono text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full">
            Higher consensus
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-lg p-2.5 border text-center', highlight ? 'bg-emerald/10 border-emerald/30' : 'bg-surface-200 border-surface-300')}>
      <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-sm font-bold font-mono', highlight ? 'text-emerald' : 'text-white')}>{value}</p>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgCard({ body, side, upvotes, author }: { body: string; side: 'for' | 'against'; upvotes: number; author: string }) {
  return (
    <div className={cn('rounded-lg p-2.5 border text-left',
      side === 'for'
        ? 'bg-for-500/5 border-for-500/20'
        : 'bg-against-500/5 border-against-500/20'
    )}>
      <p className="text-[11px] text-white leading-relaxed line-clamp-3 mb-1.5">{body}</p>
      <div className="flex items-center gap-2">
        {side === 'for'
          ? <ThumbsUp className="h-3 w-3 text-for-400" />
          : <ThumbsDown className="h-3 w-3 text-against-400" />
        }
        <span className={cn('text-[9px] font-mono font-bold', side === 'for' ? 'text-for-400' : 'text-against-400')}>
          {upvotes}
        </span>
        <span className="text-[9px] text-surface-500 ml-auto">@{author}</span>
      </div>
    </div>
  )
}

// ─── Signals row ──────────────────────────────────────────────────────────────

function Signals({ m }: { m: CompareMarket }) {
  const pills: { label: string; cls: string; Icon: typeof Flame }[] = []
  if (m.is_hot)          pills.push({ label: 'Hot',       cls: 'text-against-400 bg-against-500/10 border-against-500/30', Icon: Flame })
  if (m.is_near_law)     pills.push({ label: 'Near Law',  cls: 'text-gold bg-gold/10 border-gold/30',                     Icon: Gavel })
  if (m.is_deadlocked)   pills.push({ label: 'Deadlocked', cls: 'text-purple bg-purple/10 border-purple/30',              Icon: Scale })
  if (m.is_closing_soon) pills.push({ label: 'Closing',   cls: 'text-gold bg-gold/10 border-gold/30',                     Icon: Zap })

  if (pills.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {pills.map(({ label, cls, Icon }) => (
        <span key={label} className={cn('flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border', cls)}>
          <Icon className="h-2.5 w-2.5" />
          {label}
        </span>
      ))}
    </div>
  )
}

// ─── Market Column ────────────────────────────────────────────────────────────

function MarketColumn({
  m,
  side,
  isHigherConsensus,
  isHigherVolume,
}: {
  m: CompareMarket
  side: 'a' | 'b'
  isHigherConsensus: boolean
  isHigherVolume: boolean
}) {
  const cs = catStyle(m.category)
  const sb = statusBadge(m.status)
  const delta24 = formatDelta(m.price_change_24h)
  const delta7d = formatDelta(m.price_change_7d)
  const colAccent = side === 'a' ? 'border-for-500/30' : 'border-against-500/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: side === 'a' ? 0 : 0.1 }}
      className={cn('flex flex-col gap-4 rounded-2xl border bg-surface-100 p-4', colAccent)}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded-full border', sb.cls)}>
            {sb.label}
          </span>
          <Link
            href={`/exchange/${m.id}`}
            className="flex items-center gap-1 text-[9px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            View
          </Link>
        </div>
        <p className="text-sm font-semibold text-white leading-snug line-clamp-3 mb-2">{m.statement}</p>
        {m.category && (
          <span className={cn('inline-block text-[10px] font-mono px-1.5 py-0.5 rounded-full border', cs.text, cs.bg, cs.border)}>
            {m.category}
          </span>
        )}
      </div>

      {/* Signals */}
      <Signals m={m} />

      {/* Consensus gauge */}
      <div>
        <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wide mb-2">Consensus</p>
        <ConsensusGauge price={m.price} winner={isHigherConsensus} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCell label="Volume" value={formatVol(m.volume)} highlight={isHigherVolume} />
        <StatCell label="Range" value={`${Math.round(m.price_low)}–${Math.round(m.price_high)}¢`} />
        <StatCell label="Open" value={`${Math.round(m.price_open)}¢`} />
        <StatCell label="Created" value={relTime(m.created_at)} />
      </div>

      {/* 24h / 7d delta */}
      <div className="grid grid-cols-2 gap-2">
        {delta24 ? (
          <div className="rounded-lg bg-surface-200 border border-surface-300 p-2 text-center">
            <p className="text-[9px] font-mono text-surface-500 mb-0.5">24h</p>
            <div className={cn('flex items-center justify-center gap-1 text-xs font-mono font-bold', delta24.cls)}>
              <delta24.Icon className="h-3 w-3" />
              {delta24.label}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-200 border border-surface-300 p-2 text-center">
            <p className="text-[9px] font-mono text-surface-500 mb-0.5">24h</p>
            <p className="text-xs font-mono text-surface-500">—</p>
          </div>
        )}
        {delta7d ? (
          <div className="rounded-lg bg-surface-200 border border-surface-300 p-2 text-center">
            <p className="text-[9px] font-mono text-surface-500 mb-0.5">7d</p>
            <div className={cn('flex items-center justify-center gap-1 text-xs font-mono font-bold', delta7d.cls)}>
              <delta7d.Icon className="h-3 w-3" />
              {delta7d.label}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-200 border border-surface-300 p-2 text-center">
            <p className="text-[9px] font-mono text-surface-500 mb-0.5">7d</p>
            <p className="text-xs font-mono text-surface-500">—</p>
          </div>
        )}
      </div>

      {/* Arguments */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">Top Arguments</p>
        {m.top_for.length > 0 ? (
          m.top_for.slice(0, 2).map((a) => (
            <ArgCard
              key={a.id}
              body={a.body}
              side="for"
              upvotes={a.upvote_count}
              author={a.author_username}
            />
          ))
        ) : (
          <p className="text-[11px] text-surface-500 text-center py-2">No FOR arguments yet</p>
        )}
        {m.top_against.length > 0 ? (
          m.top_against.slice(0, 2).map((a) => (
            <ArgCard
              key={a.id}
              body={a.body}
              side="against"
              upvotes={a.upvote_count}
              author={a.author_username}
            />
          ))
        ) : (
          <p className="text-[11px] text-surface-500 text-center py-2">No AGAINST arguments yet</p>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/topic/${m.id}`}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold',
          'bg-surface-200 border border-surface-300 text-white hover:bg-surface-300 transition-colors',
        )}
      >
        Open Topic <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  )
}

// ─── Comparison skeleton ──────────────────────────────────────────────────────

function CompareSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── Share URL helper ─────────────────────────────────────────────────────────

function buildShareUrl(aId: string, bId: string): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/exchange/compare?a=${aId}&b=${bId}`
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompareClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const aIdInit = searchParams.get('a') ?? null
  const bIdInit = searchParams.get('b') ?? null

  const [aMarket, setAMarket] = useState<CompareMarket | null>(null)
  const [bMarket, setBMarket] = useState<CompareMarket | null>(null)

  // Temp: after picking via search, we have a Market (from search API),
  // but we need a CompareMarket. We track the IDs and fetch the full data.
  const [aId, setAId] = useState<string | null>(aIdInit)
  const [bId, setBId] = useState<string | null>(bIdInit)

  const [comparison, setComparison] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Suggestions: popular markets for quick pick
  const [suggestions, setSuggestions] = useState<Market[]>([])

  // Fetch suggestions on mount
  useEffect(() => {
    fetch('/api/exchange?sort=volume&limit=12')
      .then((r) => r.json())
      .then((d) => setSuggestions((d as { markets?: Market[] }).markets ?? []))
      .catch(() => {})
  }, [])

  // Fetch comparison when both IDs are set
  useEffect(() => {
    if (!aId || !bId) {
      setComparison(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/exchange/compare?a=${aId}&b=${bId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load comparison')
        const d: CompareResponse = await r.json()
        setComparison(d)
        setAMarket(d.a)
        setBMarket(d.b)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [aId, bId])

  // Keep URL in sync
  useEffect(() => {
    const params = new URLSearchParams()
    if (aId) params.set('a', aId)
    if (bId) params.set('b', bId)
    const qs = params.toString()
    router.replace(`/exchange/compare${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [aId, bId, router])

  function handlePickA(m: Market) {
    setAId(m.id)
    setAMarket(null)
  }
  function handlePickB(m: Market) {
    setBId(m.id)
    setBMarket(null)
  }

  function swap() {
    setAId(bId)
    setBId(aId)
    setAMarket(bMarket)
    setBMarket(aMarket)
  }

  async function copyLink() {
    if (!aId || !bId) return
    const url = buildShareUrl(aId, bId)
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasBoth = !!comparison

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-purple" />
            <h1 className="text-lg font-bold text-white">Compare Markets</h1>
          </div>
          {hasBoth && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={copyLink}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors border',
                  copied
                    ? 'text-emerald border-emerald/40 bg-emerald/10'
                    : 'text-surface-500 border-surface-400 bg-surface-200 hover:text-white hover:border-surface-300',
                )}
              >
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          )}
        </div>

        {/* ── Market Pickers ──────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <MarketPicker
            label="Market A"
            current={aMarket}
            onPick={handlePickA}
          />

          {/* Swap button */}
          <button
            onClick={swap}
            disabled={!aId || !bId}
            className="flex-shrink-0 mt-3 flex items-center justify-center h-9 w-9 rounded-full bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-30"
            aria-label="Swap markets"
          >
            <GitCompare className="h-4 w-4" />
          </button>

          <MarketPicker
            label="Market B"
            current={bMarket}
            onPick={handlePickB}
          />
        </div>

        {/* ── Quick suggestions (when nothing selected) ────────────────── */}
        {!aId && !bId && suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-xs font-mono text-surface-500 mb-3">Or pick from top markets to get started:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.slice(0, 6).map((m) => {
                const cs2 = catStyle((m as { category?: string | null }).category ?? null)
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (!aId) setAId(m.id)
                      else if (!bId) setBId(m.id)
                    }}
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-left transition-colors"
                  >
                    <BarChart2 className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white font-medium line-clamp-2 leading-tight mb-1">{m.statement}</p>
                      <div className="flex items-center gap-2">
                        {(m as { category?: string | null }).category && (
                          <span className={cn('text-[9px] font-mono px-1 py-0.5 rounded-full border', cs2.text, cs2.bg, cs2.border)}>
                            {(m as { category?: string | null }).category}
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-for-400">{Math.round(m.price)}¢</span>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && <CompareSkeleton />}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && !loading && (
          <EmptyState
            icon={Scale}
            title="Couldn't load comparison"
            description={error}
            action={{ label: 'Retry', onClick: () => { setAId(null); setBId(null) } }}
          />
        )}

        {/* ── Comparison ────────────────────────────────────────────────── */}
        {hasBoth && comparison && !loading && (
          <>
            {/* Same-category badge */}
            {comparison.same_category && (
              <div className="flex items-center justify-center">
                <span className={cn('text-[10px] font-mono px-3 py-1 rounded-full border',
                  catStyle(comparison.a.category).text,
                  catStyle(comparison.a.category).bg,
                  catStyle(comparison.a.category).border,
                )}>
                  Both in {comparison.a.category}
                </span>
              </div>
            )}

            {/* Two columns */}
            <div className="grid grid-cols-2 gap-4">
              <MarketColumn
                m={comparison.a}
                side="a"
                isHigherConsensus={comparison.higher_consensus === 'a'}
                isHigherVolume={comparison.higher_volume === 'a'}
              />
              <MarketColumn
                m={comparison.b}
                side="b"
                isHigherConsensus={comparison.higher_consensus === 'b'}
                isHigherVolume={comparison.higher_volume === 'b'}
              />
            </div>

            {/* Summary verdict */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple" />
                <h2 className="text-sm font-bold text-white">Verdict</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                  <p className="text-[9px] font-mono text-surface-500 mb-1">Stronger Consensus</p>
                  <p className="text-xs font-bold text-white">
                    {comparison.higher_consensus === 'equal'
                      ? 'Tied'
                      : comparison.higher_consensus === 'a'
                      ? 'Market A'
                      : 'Market B'}
                  </p>
                  {comparison.higher_consensus !== 'equal' && (
                    <p className="text-[10px] font-mono text-for-400 mt-0.5">
                      {comparison.higher_consensus === 'a'
                        ? `${Math.round(comparison.a.price)}¢ vs ${Math.round(comparison.b.price)}¢`
                        : `${Math.round(comparison.b.price)}¢ vs ${Math.round(comparison.a.price)}¢`}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                  <p className="text-[9px] font-mono text-surface-500 mb-1">Higher Volume</p>
                  <p className="text-xs font-bold text-white">
                    {comparison.higher_volume === 'equal'
                      ? 'Tied'
                      : comparison.higher_volume === 'a'
                      ? 'Market A'
                      : 'Market B'}
                  </p>
                  {comparison.higher_volume !== 'equal' && (
                    <p className="text-[10px] font-mono text-gold mt-0.5">
                      {comparison.higher_volume === 'a'
                        ? `${formatVol(comparison.a.volume)} vs ${formatVol(comparison.b.volume)}`
                        : `${formatVol(comparison.b.volume)} vs ${formatVol(comparison.a.volume)}`}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-surface-500 text-center">
                Share this comparison · <button onClick={copyLink} className="text-purple hover:text-white transition-colors underline underline-offset-2">{copied ? 'Copied!' : 'Copy link'}</button>
              </p>
            </motion.div>
          </>
        )}

        {/* ── Placeholder when only one market picked ─────────────────── */}
        {((aId && !bId) || (!aId && bId)) && !loading && !hasBoth && (
          <div className="text-center py-12 space-y-2">
            <GitCompare className="h-10 w-10 text-surface-500 mx-auto" />
            <p className="text-sm text-surface-500">Pick a second market to see the comparison</p>
          </div>
        )}

        {/* ── Empty placeholder ────────────────────────────────────────── */}
        {!aId && !bId && suggestions.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <GitCompare className="h-12 w-12 text-surface-500 mx-auto" />
            <p className="text-base font-semibold text-white">Compare any two markets</p>
            <p className="text-sm text-surface-500 max-w-sm mx-auto">
              Search for any civic topic above to see a side-by-side price, volume, and argument comparison.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
