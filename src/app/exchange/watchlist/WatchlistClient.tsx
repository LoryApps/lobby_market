'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkX,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WatchlistItem, WatchlistResponse } from '@/app/api/exchange/watchlist/route'

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
  if (status === 'failed') return 'bg-against-900/30 border-against-800/40'
  if (price >= 60) return 'bg-for-950/40 border-for-900/40'
  if (price <= 40) return 'bg-against-950/40 border-against-900/40'
  return 'bg-surface-300/20 border-surface-400/20'
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Watchlist Card ───────────────────────────────────────────────────────────

interface WatchlistCardProps {
  item: WatchlistItem
  onRemove: (topicId: string) => void
  removing: boolean
}

function WatchlistCard({ item, onRemove, removing }: WatchlistCardProps) {
  const { market } = item
  const isSettled = market.status === 'law' || market.status === 'failed'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'group relative rounded-2xl border bg-surface-100 p-4 transition-colors',
        'hover:bg-surface-200/60',
        priceBg(market.price, market.status),
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Price badge */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-xl border font-mono font-bold text-lg',
            priceBg(market.price, market.status),
            priceColor(market.price, market.status),
          )}
        >
          {market.price_label}
        </div>

        {/* Statement + meta */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/exchange/${market.id}`}
            className="text-sm font-medium text-white leading-snug hover:text-for-300 transition-colors line-clamp-2 block"
          >
            {market.statement}
          </Link>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {market.category && (
              <span className="text-xs text-surface-500">{market.category}</span>
            )}
            {market.is_hot && !isSettled && (
              <Badge variant="ghost" className="text-xs text-against-300 border-against-800/40 gap-1 px-1.5 py-0.5">
                <Flame className="h-3 w-3" /> Hot
              </Badge>
            )}
            {market.is_closing_soon && !isSettled && (
              <Badge variant="ghost" className="text-xs text-gold border-gold/30 gap-1 px-1.5 py-0.5">
                <Zap className="h-3 w-3" /> Closing Soon
              </Badge>
            )}
            {market.status === 'law' && (
              <Badge variant="ghost" className="text-xs text-gold border-gold/30 gap-1 px-1.5 py-0.5">
                <Gavel className="h-3 w-3" /> Law
              </Badge>
            )}
            {market.status === 'failed' && (
              <Badge variant="ghost" className="text-xs text-against-400 border-against-800/40 gap-1 px-1.5 py-0.5">
                Failed
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onRemove(market.id)}
            disabled={removing}
            title="Remove from watchlist"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
              'text-surface-500 hover:text-against-400 hover:bg-against-900/30',
              removing && 'opacity-50 cursor-not-allowed',
            )}
          >
            <BookmarkX className="h-4 w-4" />
          </button>
          <Link
            href={`/exchange/${market.id}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            title="Open market"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Vote bar */}
      {!isSettled && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-for-400 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {market.price}%
            </span>
            <span className="text-against-400 flex items-center gap-1">
              {100 - market.price}%
              <ThumbsDown className="h-3 w-3" />
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
              style={{ width: `${market.price}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="flex items-center justify-between text-xs text-surface-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Scale className="h-3 w-3" />
            {formatVolume(market.volume)} votes
          </span>
          {market.is_near_law && !isSettled && (
            <span className="flex items-center gap-1 text-gold">
              <TrendingUp className="h-3 w-3" />
              Near law
            </span>
          )}
          {market.is_deadlocked && !isSettled && (
            <span className="flex items-center gap-1 text-surface-400">
              <Scale className="h-3 w-3" />
              Deadlocked
            </span>
          )}
        </div>
        <span className="text-surface-600">Added {relTime(item.created_at)}</span>
      </div>
    </motion.div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'added' | 'price_high' | 'price_low' | 'volume' | 'hot'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'added', label: 'Recently Added' },
  { id: 'price_high', label: 'Price: High' },
  { id: 'price_low', label: 'Price: Low' },
  { id: 'volume', label: 'Most Votes' },
  { id: 'hot', label: 'Trending' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function WatchlistClient() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('added')
  const [removing, setRemoving] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/exchange/watchlist', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to view your watchlist.')
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as WatchlistResponse
      setItems(data.items)
      setError(null)
    } catch {
      setError('Failed to load watchlist. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const removeItem = useCallback(async (topicId: string) => {
    setRemoving((prev) => new Set([...prev, topicId]))
    try {
      await fetch(`/api/exchange/watchlist?topic_id=${topicId}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((item) => item.topic_id !== topicId))
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev)
        next.delete(topicId)
        return next
      })
    }
  }, [])

  const sorted = [...items].sort((a, b) => {
    switch (sort) {
      case 'price_high': return b.market.price - a.market.price
      case 'price_low':  return a.market.price - b.market.price
      case 'volume':     return b.market.volume - a.market.volume
      case 'hot':        return b.market.feed_score - a.market.feed_score
      default:           return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  // Split into active and settled
  const activeItems  = sorted.filter((i) => !['law', 'failed'].includes(i.market.status))
  const settledItems = sorted.filter((i) => ['law', 'failed'].includes(i.market.status))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* Header */}
      <div className="sticky top-14 z-30 bg-surface-50/95 backdrop-blur border-b border-surface-300">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-for-400" />
              <span className="text-sm font-semibold text-white">My Watchlist</span>
              {items.length > 0 && (
                <span className="text-xs font-mono text-surface-500">
                  {items.length} market{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={load}
            disabled={refreshing}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg transition-colors',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              refreshing && 'opacity-50',
            )}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>

          <Link
            href="/exchange"
            className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-medium transition-colors"
          >
            Browse Markets
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Sort bar */}
        {items.length > 1 && (
          <div className="max-w-3xl mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  sort === s.id
                    ? 'bg-for-600 text-white'
                    : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-16 text-center">
            <p className="text-surface-500 text-sm mb-4">{error}</p>
            {error.includes('Sign in') ? (
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            ) : (
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Your watchlist is empty"
            description="Add markets to your watchlist from the Exchange to track them here."
            action={
              <Link
                href="/exchange"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-medium transition-colors"
              >
                Browse Markets
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Active markets */}
            {activeItems.length > 0 && (
              <section>
                {settledItems.length > 0 && (
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                    Active Markets ({activeItems.length})
                  </h2>
                )}
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3">
                    {activeItems.map((item) => (
                      <WatchlistCard
                        key={item.topic_id}
                        item={item}
                        onRemove={removeItem}
                        removing={removing.has(item.topic_id)}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </section>
            )}

            {/* Settled markets */}
            {settledItems.length > 0 && (
              <section>
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Gavel className="h-3.5 w-3.5 text-gold" />
                  Settled ({settledItems.length})
                </h2>
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3 opacity-75">
                    {settledItems.map((item) => (
                      <WatchlistCard
                        key={item.topic_id}
                        item={item}
                        onRemove={removeItem}
                        removing={removing.has(item.topic_id)}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </section>
            )}

            {/* Footer stats */}
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-mono font-bold text-white">{activeItems.length}</div>
                  <div className="text-xs text-surface-500 mt-0.5">Active</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-gold">
                    {settledItems.filter((i) => i.market.status === 'law').length}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">Became Law</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-against-400">
                    {settledItems.filter((i) => i.market.status === 'failed').length}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">Failed</div>
                </div>
              </div>
            </div>

            {/* Tip */}
            <p className="text-xs text-surface-600 text-center">
              Watch markets from{' '}
              <Link href="/exchange" className="text-for-400 hover:text-for-300 transition-colors">
                the Exchange
              </Link>{' '}
              or any market detail page.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
