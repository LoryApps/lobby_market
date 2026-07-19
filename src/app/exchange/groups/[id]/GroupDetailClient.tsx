'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Gavel,
  Globe,
  Layers,
  Loader2,
  Lock,
  Minus,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GroupDetail, GroupMarket } from '@/app/api/exchange/groups/[id]/route'
import type { Market } from '@/app/api/exchange/route'
import type { GroupHistoryResponse, MarketHistory, PriceTick } from '@/app/api/exchange/groups/[id]/history/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function priceBg(price: number, status: string): string {
  if (status === 'law') return 'bg-gold/10 border-gold/30'
  if (status === 'failed') return 'bg-against-900/20 border-against-800/30'
  if (price >= 60) return 'bg-for-950/30 border-for-900/30'
  if (price <= 40) return 'bg-against-950/30 border-against-900/30'
  return 'bg-surface-300/20 border-surface-400/20'
}

function statusBadge(status: string) {
  if (status === 'law') return <Badge className="text-[10px] bg-gold/10 border-gold/30 text-gold py-0 px-1.5"><Gavel className="h-2.5 w-2.5 mr-0.5" />Law</Badge>
  if (status === 'failed') return <Badge className="text-[10px] bg-against-900/20 border-against-800/30 text-against-400 py-0 px-1.5">Failed</Badge>
  if (status === 'voting') return <Badge className="text-[10px] bg-purple/10 border-purple/30 text-purple py-0 px-1.5"><Zap className="h-2.5 w-2.5 mr-0.5" />Voting</Badge>
  if (status === 'active') return <Badge className="text-[10px] bg-for-500/10 border-for-500/30 text-for-400 py-0 px-1.5"><TrendingUp className="h-2.5 w-2.5 mr-0.5" />Live</Badge>
  return <Badge className="text-[10px] bg-surface-300/20 border-surface-400/20 text-surface-500 py-0 px-1.5">Pending</Badge>
}

// ─── Add Market Modal ─────────────────────────────────────────────────────────

interface AddMarketModalProps {
  groupId: string
  existingIds: Set<string>
  onClose: () => void
  onAdd: (market: GroupMarket) => void
}

function AddMarketModal({ groupId, existingIds, onClose, onAdd }: AddMarketModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Market[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
        if (!res.ok) return
        const raw = await res.json() as Array<Record<string, unknown>>
        const markets: Market[] = raw.map((r) => {
          const price = Math.round((r.blue_pct as number) ?? 50)
          return {
            id: r.id as string,
            statement: r.statement as string,
            category: r.category as string | null,
            scope: (r.scope as string) || 'national',
            status: r.status as string,
            price,
            price_label: `${price}¢`,
            volume: (r.total_votes as number) ?? 0,
            voting_ends_at: null,
            feed_score: 0,
            view_count: 0,
            created_at: r.created_at as string,
            updated_at: r.updated_at as string,
            market_status: 'live' as const,
            is_hot: false,
            is_closing_soon: false,
            is_near_law: price >= 75,
            is_deadlocked: price >= 45 && price <= 55,
          }
        })
        setResults(markets)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query])

  async function addMarket(market: Market) {
    if (adding) return
    setAdding(market.id)
    try {
      const res = await fetch(`/api/exchange/groups/${groupId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: market.id }),
      })
      if (res.ok) {
        const item = await res.json() as { added_at: string }
        onAdd({ ...market, added_at: item.added_at })
      }
    } finally {
      setAdding(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-base font-bold text-white">Add Market to Group</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-300 transition-colors">
            <X className="h-4 w-4 text-surface-500" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a civic market…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-200 border border-surface-400 text-white placeholder:text-surface-600 font-mono text-sm focus:outline-none focus:border-for-500/60 transition-colors"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {results.length === 0 && query.trim() && !searching && (
            <p className="text-center text-xs font-mono text-surface-600 py-6">No markets found for &ldquo;{query}&rdquo;</p>
          )}
          {results.length === 0 && !query.trim() && (
            <p className="text-center text-xs font-mono text-surface-600 py-6">Type to search for markets…</p>
          )}
          {results.map((market) => {
            const already = existingIds.has(market.id)
            const isAdding = adding === market.id
            return (
              <div key={market.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-200 border border-surface-400">
                <div className={cn('flex-shrink-0 text-xs font-mono font-bold px-1.5 py-0.5 rounded-md border', priceBg(market.price, market.status), priceColor(market.price, market.status))}>
                  {market.price_label}
                </div>
                <p className="text-xs font-mono text-white line-clamp-2 flex-1">{market.statement}</p>
                <button
                  onClick={() => !already && addMarket(market)}
                  disabled={already || isAdding}
                  aria-label={already ? 'Already added' : 'Add to group'}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-mono text-xs font-semibold border transition-all',
                    already
                      ? 'bg-surface-300 border-surface-400 text-surface-500 cursor-not-allowed'
                      : 'bg-for-600 hover:bg-for-500 border-for-500/40 text-white'
                  )}
                >
                  {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : already ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {already ? 'Added' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-surface-200 border border-surface-300 p-3 space-y-0.5">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
      <p className={cn('font-mono text-xl font-bold', color ?? 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-surface-600">{sub}</p>}
    </div>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  ticks,
  width = 60,
  height = 22,
}: {
  ticks: PriceTick[]
  width?: number
  height?: number
}) {
  const points = useMemo(() => {
    if (ticks.length < 2) return null
    const prices = ticks.map((t) => t.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const step = width / (prices.length - 1)
    return prices
      .map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * (height - 2) - 1).toFixed(1)}`)
      .join(' ')
  }, [ticks, width, height])

  if (!points) return null

  const first = ticks[0].price
  const last = ticks[ticks.length - 1].price
  const up = last > first + 1
  const down = last < first - 1
  const color = up ? '#22c55e' : down ? '#ef4444' : '#6b7280'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible flex-shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) {
    return (
      <span className="text-[10px] font-mono text-surface-500">—</span>
    )
  }
  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-mono font-semibold', up ? 'text-emerald' : 'text-against-400')}>
      <Icon className="h-2.5 w-2.5" />
      {up ? '+' : ''}{delta.toFixed(0)}¢
    </span>
  )
}

// ─── Market Row ────────────────────────────────────────────────────────────────

interface MarketRowProps {
  market: GroupMarket
  isOwner: boolean
  onRemove: (topicId: string) => void
  history?: MarketHistory
}

function MarketRow({ market, isOwner, onRemove, history }: MarketRowProps) {
  const [removing, setRemoving] = useState(false)

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    setRemoving(true)
    onRemove(market.id)
  }

  const forPct = market.price
  const againstPct = 100 - forPct

  return (
    <Link href={`/exchange/${market.id}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        layout
        className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-200 hover:bg-surface-150 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              {statusBadge(market.status)}
              {market.category && (
                <Badge className="text-[10px] bg-surface-300/20 border-surface-400/20 text-surface-500 py-0 px-1.5">{market.category}</Badge>
              )}
            </div>
            <p className="font-mono text-sm text-white line-clamp-2 leading-snug">{market.statement}</p>
            {/* Consensus bar */}
            <div className="mt-2.5 space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-surface-500">
                <span className="text-for-400"><ThumbsUp className="h-2.5 w-2.5 inline mr-0.5" />{forPct}%</span>
                <span className="text-against-400">{againstPct}%<ThumbsDown className="h-2.5 w-2.5 inline ml-0.5" /></span>
              </div>
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all" style={{ width: `${forPct}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className={cn('text-sm font-mono font-bold px-2.5 py-1 rounded-lg border', priceBg(market.price, market.status), priceColor(market.price, market.status))}>
              {market.price_label}
            </div>
            {/* Sparkline + delta */}
            {history && history.ticks.length >= 2 && (
              <div className="flex items-center gap-2">
                <DeltaBadge delta={history.delta} />
                <Sparkline ticks={history.ticks} />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-surface-600 flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" />{market.volume.toLocaleString()}
              </span>
              {isOwner && (
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  aria-label="Remove from group"
                  className="p-1 rounded-md text-surface-600 hover:text-against-400 hover:bg-against-900/20 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

interface Props { id: string }

export function GroupDetailClient({ id }: Props) {
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'added' | 'price_asc' | 'price_desc' | 'volume'>('added')
  const [history, setHistory] = useState<GroupHistoryResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/groups/${id}`)
      if (res.status === 404) { setError('Group not found'); return }
      if (!res.ok) { setError('Failed to load group'); return }
      setGroup(await res.json() as GroupDetail)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch(`/api/exchange/groups/${id}/history`)
      .then((r) => r.ok ? r.json() as Promise<GroupHistoryResponse> : null)
      .then((data) => { if (data) setHistory(data) })
      .catch(() => {})
  }, [id])

  const historyMap = useMemo<Record<string, MarketHistory>>(() => {
    if (!history) return {}
    return Object.fromEntries(history.markets.map((m) => [m.topic_id, m]))
  }, [history])

  async function handleRemove(topicId: string) {
    if (!group) return
    // Optimistic update
    setGroup((prev) => prev ? {
      ...prev,
      markets: prev.markets.filter((m) => m.id !== topicId),
      item_count: Math.max(prev.item_count - 1, 0),
    } : prev)
    await fetch(`/api/exchange/groups/${id}/items?topic_id=${topicId}`, { method: 'DELETE' })
  }

  function handleAdded(market: GroupMarket) {
    setGroup((prev) => prev ? {
      ...prev,
      markets: [market, ...prev.markets],
      item_count: prev.item_count + 1,
    } : prev)
  }

  async function handleDelete() {
    if (!confirm(`Delete this group? This cannot be undone.`)) return
    await fetch(`/api/exchange/groups/${id}`, { method: 'DELETE' })
    router.push('/exchange/groups')
  }

  async function togglePublic() {
    if (!group) return
    const newVal = !group.is_public
    setGroup((prev) => prev ? { ...prev, is_public: newVal } : prev)
    await fetch(`/api/exchange/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: newVal }),
    })
  }

  const sortedMarkets = group ? [...group.markets].sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price
    if (sortBy === 'price_desc') return b.price - a.price
    if (sortBy === 'volume') return b.volume - a.volume
    return new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
  }) : []

  const existingIds = new Set(group?.markets.map((m) => m.id) ?? [])

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
          <Link href="/exchange/groups" className="flex items-center gap-2 text-surface-500 hover:text-white font-mono text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Groups
          </Link>
          <div className="rounded-xl bg-against-950/30 border border-against-800/40 p-6 text-center">
            <p className="font-mono text-against-400 font-semibold">{error}</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {/* Back */}
        <Link href="/exchange/groups" className="flex items-center gap-2 text-surface-500 hover:text-white font-mono text-xs mb-5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Market Groups
        </Link>

        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          </div>
        ) : group ? (
          <>
            {/* Group header */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-surface-200 border border-surface-400 flex items-center justify-center text-3xl flex-shrink-0">
                  {group.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h1 className="font-mono text-xl font-bold text-white leading-tight">{group.name}</h1>
                    {group.is_public
                      ? <Badge className="text-[10px] text-for-400 border-for-500/30 bg-for-500/8 py-0 px-1.5"><Globe className="h-2.5 w-2.5 mr-0.5" />Public</Badge>
                      : <Badge className="text-[10px] text-surface-500 border-surface-500/30 py-0 px-1.5"><Lock className="h-2.5 w-2.5 mr-0.5" />Private</Badge>
                    }
                  </div>
                  {group.description && (
                    <p className="text-xs font-mono text-surface-400 mt-1 leading-relaxed">{group.description}</p>
                  )}
                  {!group.is_owner && group.owner_username && (
                    <p className="text-[11px] font-mono text-surface-600 mt-1">
                      by{' '}
                      <Link href={`/profile/${group.owner_username}`} className="text-for-400 hover:underline">
                        @{group.owner_username}
                      </Link>
                    </p>
                  )}
                </div>
              </div>

              {/* Owner actions */}
              {group.is_owner && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-300/50">
                  <button
                    onClick={togglePublic}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-400 hover:border-surface-300 text-surface-400 font-mono text-xs transition-colors"
                  >
                    {group.is_public ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {group.is_public ? 'Make Private' : 'Make Public'}
                  </button>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 border border-for-500/40 text-white font-mono text-xs font-semibold transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add Market
                  </button>
                  <button
                    onClick={handleDelete}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-400 hover:border-against-800/40 hover:text-against-400 text-surface-500 font-mono text-xs transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>

            {/* Aggregate stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatTile
                label="Markets"
                value={group.item_count}
                sub={`${group.live_count} live`}
              />
              <StatTile
                label="Avg Consensus"
                value={`${group.avg_price}¢`}
                sub={group.avg_price >= 60 ? 'Leaning FOR' : group.avg_price <= 40 ? 'Leaning AGAINST' : 'Contested'}
                color={group.avg_price >= 60 ? 'text-for-400' : group.avg_price <= 40 ? 'text-against-400' : 'text-surface-400'}
              />
              <StatTile
                label="Total Volume"
                value={group.total_volume >= 1000 ? `${(group.total_volume / 1000).toFixed(1)}K` : group.total_volume}
                sub="total votes"
              />
              <StatTile
                label="Settled"
                value={group.settled_count}
                sub={`${group.law_count} laws · ${group.failed_count} failed`}
                color={group.law_count > 0 ? 'text-gold' : 'text-surface-400'}
              />
            </div>

            {/* Index trend sparkline */}
            {history && history.index.length >= 2 && (
              <div className="rounded-xl bg-surface-200 border border-surface-300 p-3 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">30-Day Group Index</p>
                  <DeltaBadge delta={history.index_delta} />
                </div>
                <Sparkline ticks={history.index} width={320} height={36} />
              </div>
            )}

            {/* Sort controls */}
            {group.markets.length > 1 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-mono text-surface-600 mr-1">Sort:</span>
                {([
                  { key: 'added', label: 'Recent' },
                  { key: 'price_desc', label: 'Price ↓' },
                  { key: 'price_asc', label: 'Price ↑' },
                  { key: 'volume', label: 'Volume' },
                ] as const).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-mono text-[11px] border transition-all',
                      sortBy === s.key
                        ? 'bg-surface-200 border-surface-300 text-white'
                        : 'bg-transparent border-surface-500/30 text-surface-500 hover:border-surface-400'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Market list */}
            {group.markets.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No markets in this group"
                description={group.is_owner ? 'Add civic markets to start building your thematic basket.' : 'This group has no markets yet.'}
                action={group.is_owner ? (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 border border-for-500/40 text-white font-mono text-sm font-semibold transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add First Market
                  </button>
                ) : undefined}
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {sortedMarkets.map((market) => (
                    <MarketRow
                      key={market.id}
                      market={market}
                      isOwner={group.is_owner}
                      onRemove={handleRemove}
                      history={historyMap[market.id]}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Browse more markets */}
            {group.is_owner && group.markets.length > 0 && (
              <div className="mt-6 pt-4 border-t border-surface-300/50">
                <Link
                  href="/exchange"
                  className="flex items-center justify-between p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-colors group"
                >
                  <span className="font-mono text-sm text-white">Browse Exchange to add more markets</span>
                  <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
            )}
          </>
        ) : null}
      </main>

      <BottomNav />

      <AnimatePresence>
        {showAdd && group && (
          <AddMarketModal
            groupId={id}
            existingIds={existingIds}
            onClose={() => setShowAdd(false)}
            onAdd={handleAdded}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
