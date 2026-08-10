'use client'

/**
 * /topics — All Topics Browser
 *
 * A comprehensive, filterable, searchable listing of every civic topic on
 * the platform. Complements the algorithmic home feed (/), category browse
 * (/categories), and search (/search) by giving users a raw, sortable table
 * view of all topics with full filter controls.
 *
 * Filters: status, category, scope
 * Sort: most votes, newest, trending, near law, contested
 * Search: inline full-text filter by statement
 * Pagination: load-more button (20 per page)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  Gem,
  Globe,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import type { BrowseTopic, BrowseResponse } from '@/app/api/topics/browse/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type SortMode = 'votes' | 'new' | 'trending' | 'near_law' | 'contested'

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof TrendingUp }[] = [
  { id: 'votes', label: 'Most Votes', icon: Users },
  { id: 'new', label: 'Newest', icon: Clock },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'near_law', label: 'Near Law', icon: Gavel },
  { id: 'contested', label: 'Contested', icon: Scale },
]

const STATUS_OPTIONS = [
  { id: null, label: 'All' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'active', label: 'Active' },
  { id: 'voting', label: 'Voting' },
  { id: 'law', label: 'LAW' },
] as const

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d > 365 ? 'numeric' : undefined })
}

// ─── TopicRow ─────────────────────────────────────────────────────────────────

function TopicRow({ topic, idx }: { topic: BrowseTopic; idx: number }) {
  const signal = getTopicSignal(topic)
  const SignalPill = signal ? SIGNAL_PILL_CLASSES[signal] : null
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.025, 0.4) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/60 transition-all p-4"
      >
        <div className="flex items-start gap-3">
          {/* Vote bar column */}
          <div className="shrink-0 flex flex-col items-center gap-1 w-12 pt-0.5">
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-for-500/70 rounded-l-full"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-500/70 rounded-r-full"
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-surface-500 whitespace-nowrap">
              <span className="text-for-400">{forPct}%</span>
              {' / '}
              <span className="text-against-400">{againstPct}%</span>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge
                variant={
                  topic.status === 'law'
                    ? 'law'
                    : topic.status === 'failed'
                      ? 'failed'
                      : topic.status === 'voting'
                        ? 'active'
                        : (topic.status as 'proposed' | 'active')
                }
                size="sm"
              >
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>
              {topic.category && (
                <span className={cn('text-[11px] font-mono', catColor)}>
                  {topic.category}
                </span>
              )}
              {topic.scope && topic.scope !== 'Global' && (
                <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
                  <MapPin className="h-2.5 w-2.5" />
                  {topic.scope}
                </span>
              )}
              {signal && SignalPill && (
                <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded-full border', SignalPill)}>
                  {signal.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {topic.statement}
            </p>
          </div>

          {/* Stats column */}
          <div className="shrink-0 hidden sm:flex flex-col items-end gap-1 text-right">
            <span className="text-sm font-bold font-mono text-surface-300">
              {topic.total_votes.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-surface-500">votes</span>
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(topic.created_at)}
            </span>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 shrink-0 self-center transition-colors hidden sm:block" />
        </div>

        {/* Mobile stats */}
        <div className="sm:hidden mt-2 flex items-center gap-3 text-[10px] font-mono text-surface-500">
          <span>{topic.total_votes.toLocaleString()} votes</span>
          <span>·</span>
          <span>{relativeTime(topic.created_at)}</span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TopicsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 space-y-1 pt-0.5">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  status,
  setStatus,
  category,
  setCategory,
  scope,
  setScope,
  sort,
  setSort,
  query,
  setQuery,
  total,
  onClear,
}: {
  status: string | null
  setStatus: (v: string | null) => void
  category: string | null
  setCategory: (v: string | null) => void
  scope: string | null
  setScope: (v: string | null) => void
  sort: SortMode
  setSort: (v: SortMode) => void
  query: string
  setQuery: (v: string) => void
  total: number | null
  onClear: () => void
}) {
  const [showFilters, setShowFilters] = useState(false)
  const hasActiveFilters = status !== null || category !== null || scope !== null || query !== ''

  return (
    <div className="space-y-3">
      {/* Search + toggle row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search topics…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-surface-100 border border-surface-300 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50 focus:bg-surface-200/60 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-mono transition-colors',
            showFilters || hasActiveFilters
              ? 'bg-for-500/15 border-for-500/40 text-for-300'
              : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-for-500/30 text-for-300 text-[9px] font-bold">
              {[status, category, scope, query].filter(Boolean).length}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
        </button>
        {total !== null && (
          <span className="hidden sm:block text-xs font-mono text-surface-500 shrink-0">
            {total.toLocaleString()} topics
          </span>
        )}
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSort(id)}
            className={cn(
              'flex items-center gap-1.5 shrink-0 px-3 h-7 rounded-lg text-xs font-mono transition-colors',
              sort === id
                ? 'bg-surface-300 text-white'
                : 'text-surface-400 hover:text-white hover:bg-surface-200'
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Expandable filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-4">
              {/* Status */}
              <div>
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(({ id, label }) => (
                    <button
                      key={String(id)}
                      onClick={() => setStatus(id)}
                      className={cn(
                        'px-3 h-7 rounded-lg text-xs font-mono border transition-colors',
                        status === id
                          ? id === null
                            ? 'bg-surface-300 border-surface-400 text-white'
                            : id === 'law'
                              ? 'bg-gold/20 border-gold/50 text-gold'
                              : id === 'voting'
                                ? 'bg-purple/20 border-purple/50 text-purple'
                                : id === 'active'
                                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                                  : 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategory(null)}
                    className={cn(
                      'px-3 h-7 rounded-lg text-xs font-mono border transition-colors',
                      category === null
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat === category ? null : cat)}
                      className={cn(
                        'px-3 h-7 rounded-lg text-xs font-mono border transition-colors',
                        category === cat
                          ? cn('bg-surface-300 border-surface-400', CATEGORY_COLOR[cat])
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Scope</p>
                <div className="flex flex-wrap gap-1.5">
                  {[null, 'Global', 'National', 'Regional', 'Local'].map((s) => (
                    <button
                      key={String(s)}
                      onClick={() => setScope(s)}
                      className={cn(
                        'flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-mono border transition-colors',
                        scope === s
                          ? 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {s === null ? 'All' : s === 'Global' ? <><Globe className="h-3 w-3" />{s}</> : <><MapPin className="h-3 w-3" />{s}</>}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={onClear}
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
    </div>
  )
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function TopicsBrowser() {
  const searchParams = useSearchParams()

  const [topics, setTopics] = useState<BrowseTopic[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Filter state (synced from URL search params)
  const [status, setStatusRaw] = useState<string | null>(searchParams.get('status'))
  const [category, setCategoryRaw] = useState<string | null>(searchParams.get('category'))
  const [scope, setScopeRaw] = useState<string | null>(searchParams.get('scope'))
  const [sort, setSortRaw] = useState<SortMode>((searchParams.get('sort') as SortMode) || 'votes')
  const [query, setQueryRaw] = useState(searchParams.get('q') ?? '')
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  // Debounce search query
  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current)
    queryDebounceRef.current = setTimeout(() => setDebouncedQuery(query), 300)
    return () => { if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current) }
  }, [query])

  // Setters that reset page
  function setStatus(v: string | null) { setStatusRaw(v); setPage(1) }
  function setCategory(v: string | null) { setCategoryRaw(v); setPage(1) }
  function setScope(v: string | null) { setScopeRaw(v); setPage(1) }
  function setSort(v: SortMode) { setSortRaw(v); setPage(1) }
  function setQuery(v: string) { setQueryRaw(v); setPage(1) }

  function clearFilters() {
    setStatusRaw(null)
    setCategoryRaw(null)
    setScopeRaw(null)
    setQueryRaw('')
    setDebouncedQuery('')
    setPage(1)
  }

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    p.set('sort', sort)
    p.set('limit', '20')
    p.set('page', String(page))
    if (status) p.set('status', status)
    if (category) p.set('category', category)
    if (scope) p.set('scope', scope)
    if (debouncedQuery) p.set('q', debouncedQuery)
    return p
  }, [status, category, scope, sort, debouncedQuery, page])

  // Initial fetch / filter change — reset list
  const fetchTopics = useCallback(async () => {
    setLoading(true)
    try {
      const p = buildParams()
      p.set('page', '1')
      const res = await fetch(`/api/topics/browse?${p}`)
      if (!res.ok) throw new Error('Failed')
      const data: BrowseResponse = await res.json()
      setTopics(data.topics)
      setTotal(data.total)
      setHasMore(data.hasMore)
      setPage(1)
    } catch {
      setTopics([])
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // Load more
  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const p = buildParams()
      p.set('page', String(nextPage))
      const res = await fetch(`/api/topics/browse?${p}`)
      if (!res.ok) throw new Error('Failed')
      const data: BrowseResponse = await res.json()
      setTopics((prev) => [...prev, ...data.topics])
      setHasMore(data.hasMore)
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }, [buildParams, loadingMore, hasMore, page])

  // Refetch when filters change (except page)
  useEffect(() => {
    fetchTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, scope, sort, debouncedQuery])

  const hasActiveFilters = status !== null || category !== null || scope !== null || query !== ''

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Layers className="h-5 w-5 text-for-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">All Topics</h1>
            <p className="text-sm text-surface-400 mt-0.5">
              Browse every civic debate on the platform — filter, sort, and explore.
            </p>
          </div>
          <button
            onClick={fetchTopics}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="mb-4">
          <FilterBar
            status={status}
            setStatus={setStatus}
            category={category}
            setCategory={setCategory}
            scope={scope}
            setScope={setScope}
            sort={sort}
            setSort={setSort}
            query={query}
            setQuery={setQuery}
            total={total}
            onClear={clearFilters}
          />
        </div>

        {/* Mobile total */}
        {total !== null && (
          <p className="sm:hidden text-xs font-mono text-surface-500 mb-3">
            {total.toLocaleString()} topics
          </p>
        )}

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {status && (
              <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400">
                Status: {STATUS_LABEL[status] ?? status}
                <button onClick={() => setStatus(null)} className="hover:text-white transition-colors ml-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {category && (
              <span className={cn('inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono', CATEGORY_COLOR[category] ?? 'text-surface-400')}>
                {category}
                <button onClick={() => setCategory(null)} className="hover:text-white transition-colors ml-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {scope && (
              <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400">
                <MapPin className="h-2.5 w-2.5" />
                {scope}
                <button onClick={() => setScope(null)} className="hover:text-white transition-colors ml-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {query && (
              <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400">
                <Search className="h-2.5 w-2.5" />
                &ldquo;{query}&rdquo;
                <button onClick={() => setQuery('')} className="hover:text-white transition-colors ml-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Topics list */}
        {loading ? (
          <TopicsSkeleton />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No topics found"
            description={
              hasActiveFilters
                ? 'Try adjusting or clearing your filters.'
                : 'No topics have been created yet.'
            }
            action={
              hasActiveFilters
                ? { label: 'Clear filters', onClick: clearFilters }
                : { label: 'Propose a topic', href: '/topic/create' }
            }
          />
        ) : (
          <div className="space-y-2">
            {topics.map((topic, idx) => (
              <TopicRow key={topic.id} topic={topic} idx={idx} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-4 flex justify-center">
                <button
                  onClick={fetchMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 h-10 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sidebar links at bottom on mobile / right on desktop */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { href: '/categories', label: 'Browse by Category', icon: BarChart2 },
            { href: '/trending', label: 'Trending Now', icon: Flame },
            { href: '/topics/underrated', label: 'Hidden Gems', icon: Gem },
            { href: '/topic/create', label: 'Propose a Topic', icon: Sparkles },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors text-sm text-surface-400 hover:text-white group"
            >
              <Icon className="h-4 w-4 shrink-0 text-surface-500 group-hover:text-for-400 transition-colors" />
              {label}
              <ArrowUpRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function TopicsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-50">
          <TopBar />
          <main className="max-w-4xl mx-auto px-4 pt-6 pb-24">
            <div className="mb-6 flex items-start gap-4">
              <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <TopicsSkeleton />
          </main>
          <BottomNav />
        </div>
      }
    >
      <TopicsBrowser />
    </Suspense>
  )
}

