'use client'

/**
 * /quotes — Civic Quotes Gallery
 *
 * A masonry-style gallery of the most memorable arguments from across
 * the platform — presented as visual pull-quote cards.
 *
 * Distinct from:
 *   /top-arguments      — ranked leaderboard by AI grade
 *   /topic/[id]/quotes  — per-topic best arguments
 *   /argument-of-the-day — single daily spotlight
 *   /live               — real-time argument stream
 *
 * This is the "hall of rhetoric" — cross-debate, filterable by category,
 * side, and time period. Best for discovering how citizens argue.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  ChevronDown,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Quote,
  RefreshCw,
  ThumbsUp,
  TrendingUp,
  Clock,
  Award,
  X,
  Check,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { QuoteEntry, QuotesResponse } from '@/app/api/quotes/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-for-300',
  Philosophy: 'text-purple',
  Culture: 'text-against-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
] as const

const SORT_OPTIONS = [
  { id: 'upvotes', label: 'Most upvoted', icon: TrendingUp },
  { id: 'ai_score', label: 'Highest quality', icon: Award },
  { id: 'recent', label: 'Most recent', icon: Clock },
] as const

const SIDE_OPTIONS = [
  { id: 'all', label: 'Both sides' },
  { id: 'for', label: 'FOR', class: 'text-for-400' },
  { id: 'against', label: 'AGAINST', class: 'text-against-400' },
] as const

type Period = 'today' | 'week' | 'month' | 'all'
type Sort = 'upvotes' | 'ai_score' | 'recent'
type Side = 'all' | 'for' | 'against'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, max = 320): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 200 ? cut.slice(0, lastSpace) : cut) + '…'
}

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard({ quote, index }: { quote: QuoteEntry; index: number }) {
  const [copied, setCopied] = useState(false)
  const isFor = quote.side === 'blue'
  const text = truncate(quote.content)
  const categoryColor = quote.topic?.category ? (CATEGORY_COLOR[quote.topic.category] ?? 'text-surface-500') : 'text-surface-500'

  async function copyToClipboard() {
    const shareText = `"${text}"\n\n— ${quote.author?.display_name ?? quote.author?.username ?? 'Anonymous'} on Lobby Market\n\nhttps://lobby.market/topic/${quote.topic_id}`
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'group relative rounded-2xl border bg-surface-100 p-5 flex flex-col gap-4',
        'hover:border-surface-400 transition-colors',
        isFor ? 'border-for-500/25' : 'border-against-500/25'
      )}
    >
      {/* Side accent bar */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-full',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )}
      />

      {/* Header: side badge + grade */}
      <div className="pl-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
              isFor
                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                : 'text-against-400 bg-against-500/10 border-against-500/30'
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {quote.ai_grade && (
            <span
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
                quote.ai_grade === 'A' ? 'text-emerald bg-emerald/10 border-emerald/30' :
                quote.ai_grade === 'B' ? 'text-for-400 bg-for-500/10 border-for-500/30' :
                'text-surface-500 bg-surface-200 border-surface-300'
              )}
            >
              {quote.ai_grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          <span className="text-xs font-mono">{quote.upvotes.toLocaleString()}</span>
        </div>
      </div>

      {/* Quote text */}
      <div className="pl-3 flex-1">
        <Quote className={cn('h-5 w-5 mb-2 opacity-60', isFor ? 'text-for-500' : 'text-against-500')} />
        <p className="text-sm font-mono text-white leading-relaxed">
          {text}
        </p>
      </div>

      {/* Topic context */}
      {quote.topic && (
        <Link
          href={`/topic/${quote.topic.id}`}
          className={cn(
            'pl-3 block group/topic rounded-lg py-2 pr-2 -mx-1 transition-colors',
            'hover:bg-surface-200/60'
          )}
        >
          <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-0.5', categoryColor)}>
            {quote.topic.category ?? 'General'}
          </p>
          <p className="text-xs font-mono text-surface-600 group-hover/topic:text-surface-500 line-clamp-2 leading-relaxed">
            {quote.topic.statement}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <div className="h-1 w-12 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full"
                  style={{ width: `${quote.topic.blue_pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-for-400">{Math.round(quote.topic.blue_pct)}%</span>
            </div>
            <span className="text-[10px] font-mono text-surface-600">
              {quote.topic.total_votes.toLocaleString()} votes
            </span>
            <Badge variant={quote.topic.status === 'law' ? 'law' : quote.topic.status === 'active' ? 'active' : 'proposed'} className="text-[10px] py-0 px-1.5">
              {quote.topic.status === 'law' ? 'LAW' : quote.topic.status}
            </Badge>
          </div>
        </Link>
      )}

      {/* Footer: author + actions */}
      <div className="pl-3 flex items-center justify-between gap-2 border-t border-surface-300 pt-3">
        {quote.author ? (
          <Link href={`/profile/${quote.author.username}`} className="flex items-center gap-2 group/author min-w-0">
            <Avatar
              src={quote.author.avatar_url}
              fallback={quote.author.display_name ?? quote.author.username}
              size="xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate group-hover/author:text-for-400 transition-colors font-mono">
                {quote.author.display_name ?? quote.author.username}
              </p>
              <p className="text-[10px] text-surface-500 font-mono">{relativeTime(quote.created_at)}</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-surface-300" />
            <span className="text-xs text-surface-500 font-mono">Anonymous</span>
          </div>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={copyToClipboard}
            aria-label="Copy quote"
            className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <Link
            href={`/topic/${quote.topic_id}`}
            aria-label="View full topic"
            className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function QuoteSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-1 rounded-lg bg-surface-200/60 p-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="flex items-center gap-2 border-t border-surface-300 pt-3">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
  activeClass = 'bg-surface-300 text-white border-surface-400',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  activeClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
        active
          ? activeClass
          : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-700'
      )}
    >
      {children}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)

  const [category, setCategory] = useState('All')
  const [side, setSide] = useState<Side>('all')
  const [period, setPeriod] = useState<Period>('week')
  const [sort, setSort] = useState<Sort>('upvotes')
  const [showFilters, setShowFilters] = useState(false)

  const LIMIT = 24

  const fetchQuotes = useCallback(async (reset = false) => {
    const newOffset = reset ? 0 : offset
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        category: category === 'All' ? 'all' : category,
        side,
        period,
        sort,
        limit: String(LIMIT),
        offset: String(reset ? 0 : newOffset),
      })
      const res = await fetch(`/api/quotes?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as QuotesResponse
      if (reset) {
        setQuotes(data.quotes)
        setOffset(data.quotes.length)
      } else {
        setQuotes((prev) => [...prev, ...data.quotes])
        setOffset((prev) => prev + data.quotes.length)
      }
      setTotal(data.total)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [category, side, period, sort, offset])

  useEffect(() => {
    setOffset(0)
    fetchQuotes(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, side, period, sort])

  const hasMore = quotes.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-1 w-6 rounded-full bg-for-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-surface-500">
              Civic Quotes
            </span>
            <div className="flex h-1 w-6 rounded-full bg-against-500" />
          </div>
          <h1 className="font-mono font-bold text-3xl md:text-4xl text-white tracking-tight mb-2">
            Argument Gallery
          </h1>
          <p className="text-sm font-mono text-surface-500 max-w-2xl">
            The most memorable arguments from across the Lobby — ranked by community upvotes.
            Every card is a real position, made by a real citizen.
          </p>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
                  sort === opt.id
                    ? 'bg-for-600 border-for-600 text-white'
                    : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-700'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            )
          })}
          <div className="ml-auto flex-shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
                showFilters
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-700'
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {(category !== 'All' || side !== 'all' || period !== 'week') && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-for-500" />
              )}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mb-4 rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
                {/* Period */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">Time period</p>
                  <div className="flex flex-wrap gap-2">
                    {PERIOD_OPTIONS.map((opt) => (
                      <FilterChip key={opt.id} active={period === opt.id} onClick={() => setPeriod(opt.id)}>
                        {opt.label}
                      </FilterChip>
                    ))}
                  </div>
                </div>

                {/* Side */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">Side</p>
                  <div className="flex flex-wrap gap-2">
                    {SIDE_OPTIONS.map((opt) => (
                      <FilterChip
                        key={opt.id}
                        active={side === opt.id}
                        onClick={() => setSide(opt.id)}
                        activeClass={
                          opt.id === 'for'
                            ? 'bg-for-500/20 text-for-300 border-for-500/50'
                            : opt.id === 'against'
                            ? 'bg-against-500/20 text-against-300 border-against-500/50'
                            : 'bg-surface-300 text-white border-surface-400'
                        }
                      >
                        {opt.label}
                      </FilterChip>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <FilterChip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
                        {cat}
                      </FilterChip>
                    ))}
                  </div>
                </div>

                {/* Active filters summary */}
                {(category !== 'All' || side !== 'all' || period !== 'week') && (
                  <button
                    onClick={() => { setCategory('All'); setSide('all'); setPeriod('week') }}
                    className="flex items-center gap-1.5 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats bar */}
        {!loading && quotes.length > 0 && (
          <div className="mb-6 flex items-center gap-4">
            <p className="text-xs font-mono text-surface-500">
              Showing <span className="text-white font-semibold">{quotes.length}</span> of{' '}
              <span className="text-white font-semibold">{total.toLocaleString()}</span> quotes
              {category !== 'All' && (
                <> in <span className={cn('font-semibold', CATEGORY_COLOR[category] ?? 'text-white')}>{category}</span></>
              )}
              {side !== 'all' && (
                <> · <span className={cn('font-semibold', side === 'for' ? 'text-for-400' : 'text-against-400')}>{side === 'for' ? 'FOR' : 'AGAINST'}</span></>
              )}
            </p>
            <button
              onClick={() => fetchQuotes(true)}
              className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              disabled={loading}
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => <QuoteSkeleton key={i} />)}
          </div>
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No quotes found"
            description={
              period === 'today'
                ? "No arguments have been posted today — check back later or widen the time filter."
                : "No quotes match your current filters. Try adjusting the category or time period."
            }
            action={{ label: "Show all quotes", onClick: () => { setCategory('All'); setSide('all'); setPeriod('week') } }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotes.map((q, i) => (
              <QuoteCard key={q.id} quote={q} index={i} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => fetchQuotes(false)}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl border border-surface-300',
                'text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Load more quotes
            </button>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-surface-300">
          <p className="text-xs font-mono text-surface-600 text-center">
            Quotes are real arguments posted by citizens of the Lobby.{' '}
            <Link href="/guidelines" className="text-surface-500 hover:text-white transition-colors">
              Community guidelines
            </Link>{' '}
            apply to all content.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
