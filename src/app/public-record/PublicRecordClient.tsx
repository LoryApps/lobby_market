'use client'

/**
 * /public-record — The Civic Public Record
 *
 * A permanent, searchable archive of every democratic decision on Lobby Market:
 * laws established by consensus and proposals rejected by the people.
 *
 * Designed as a serious civic document — the constitutional record of what
 * this community has decided. Laws display with a civic seal; rejected topics
 * display with a memorial stone treatment.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  ExternalLink,
  Gavel,
  Loader2,
  Scale,
  Search,
  Shield,
  Skull,
  Sparkles,
  TrendingUp,
  Vote,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PublicRecord, PublicRecordStats, PublicRecordResponse } from '@/app/api/public-record/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const OUTCOME_TABS = [
  { id: 'all',    label: 'All Decisions', icon: Scale },
  { id: 'law',    label: 'Laws Established', icon: Gavel },
  { id: 'failed', label: 'Rejected Proposals', icon: Skull },
] as const

type OutcomeTab = 'all' | 'law' | 'failed'
type SortMode = 'recent' | 'votes' | 'consensus'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Scale
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-200/60 border border-surface-300/40 p-4">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  )
}

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ record, index }: { record: PublicRecord; index: number }) {
  const isLaw = record.status === 'law'
  const forPct = Math.round(record.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
    >
      <Link
        href={`/topic/${record.id}`}
        className={cn(
          'block rounded-xl border p-4 transition-all hover:scale-[1.01] hover:shadow-lg',
          isLaw
            ? 'bg-surface-200/70 border-for-600/30 hover:border-for-500/50 hover:bg-surface-200/90'
            : 'bg-surface-200/50 border-surface-300/40 hover:border-surface-400/60'
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {isLaw ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-for-600/20 border border-for-600/40 px-2.5 py-1">
                <Gavel className="h-3.5 w-3.5 text-for-400" />
                <span className="text-[11px] font-bold text-for-400 tracking-wide uppercase">
                  Law
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-against-900/30 border border-against-700/30 px-2.5 py-1">
                <XCircle className="h-3.5 w-3.5 text-against-400" />
                <span className="text-[11px] font-bold text-against-400 tracking-wide uppercase">
                  Rejected
                </span>
              </div>
            )}
            {record.category && (
              <Badge variant="outline" size="sm" className="text-surface-500 border-surface-600/40">
                {record.category}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-surface-500 flex-shrink-0">
            <Calendar className="h-3 w-3" />
            <span className="text-[11px] font-mono">{formatDate(record.decided_at)}</span>
          </div>
        </div>

        {/* Statement */}
        <p
          className={cn(
            'text-sm font-medium leading-snug mb-3',
            isLaw ? 'text-white' : 'text-surface-300'
          )}
        >
          {record.statement}
        </p>

        {/* Vote bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <span className="text-surface-500 flex items-center gap-1">
              <Vote className="h-3 w-3" />
              {formatNumber(record.total_votes)} votes
            </span>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-400/30 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isLaw
                  ? 'bg-gradient-to-r from-for-600 to-for-400'
                  : 'bg-gradient-to-r from-for-800/60 to-against-600'
              )}
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        {/* Scope */}
        {record.scope && record.scope !== 'global' && (
          <p className="mt-2 text-[11px] text-surface-500 uppercase tracking-wide font-mono">
            {record.scope} scope
          </p>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RecordSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/30 bg-surface-200/40 p-4 space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PublicRecordClient() {
  const [records, setRecords] = useState<PublicRecord[]>([])
  const [stats, setStats] = useState<PublicRecordStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  const [outcome, setOutcome] = useState<OutcomeTab>('all')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortMode>('recent')
  const [query, setQuery] = useState('')
  const [inputValue, setInputValue] = useState('')

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetch = useCallback(
    async (
      opts: {
        outcome: OutcomeTab
        category: string
        sort: SortMode
        query: string
        cursor?: string | null
        append?: boolean
      }
    ) => {
      const params = new URLSearchParams()
      if (opts.outcome !== 'all') params.set('outcome', opts.outcome)
      if (opts.category !== 'All') params.set('category', opts.category)
      if (opts.sort !== 'recent') params.set('sort', opts.sort)
      if (opts.query) params.set('q', opts.query)
      if (opts.cursor) params.set('cursor', opts.cursor)

      try {
        const res = await window.fetch(`/api/public-record?${params}`)
        if (!res.ok) throw new Error('Failed')
        const data: PublicRecordResponse = await res.json()

        if (opts.append) {
          setRecords((prev) => [...prev, ...data.records])
        } else {
          setRecords(data.records)
          setStats(data.stats)
          setTotalCount(data.total_count)
        }
        setHasMore(data.has_more)
        setCursor(data.next_cursor)
      } catch {
        // best-effort
      }
    },
    []
  )

  // Initial load
  useEffect(() => {
    setLoading(true)
    fetch({ outcome, category, sort, query }).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, category, sort, query])

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return
    observerRef.current?.disconnect()

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true)
          fetch({ outcome, category, sort, query, cursor, append: true }).finally(() =>
            setLoadingMore(false)
          )
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(loadMoreRef.current)
    observerRef.current = observer
    return () => observer.disconnect()
  }, [hasMore, loadingMore, cursor, outcome, category, sort, query, fetch])

  // Debounced search
  function handleSearchInput(val: string) {
    setInputValue(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => setQuery(val.trim()), 350)
  }

  return (
    <div className="min-h-screen bg-surface-900 text-white pb-24">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {/* Back nav */}
        <div className="mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-surface-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lobby
          </Link>
        </div>

        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-for-600/20 border border-for-600/40 p-2.5">
              <Shield className="h-6 w-6 text-for-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                The Civic Public Record
              </h1>
              <p className="text-sm text-surface-400">
                The permanent democratic archive of Lobby Market
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed mt-3">
            Every law established by consensus. Every proposal rejected by the people.
            An unalterable ledger of civic decisions — sorted by date, searchable by topic.
          </p>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Gavel} value={stats.total_laws} label="Laws Passed" color="text-for-400" />
            <StatCard
              icon={XCircle}
              value={stats.total_failed}
              label="Rejected"
              color="text-against-400"
            />
            <StatCard
              icon={Vote}
              value={formatNumber(stats.total_votes_cast)}
              label="Total Votes"
              color="text-gold"
            />
            <StatCard
              icon={Sparkles}
              value={stats.laws_this_month}
              label="Laws This Month"
              color="text-purple"
            />
          </div>
        ) : null}

        {/* Highlight cards */}
        {stats && (stats.most_decisive_id || stats.closest_id) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {stats.most_decisive_id && (
              <Link
                href={`/topic/${stats.most_decisive_id}`}
                className="rounded-xl bg-for-900/30 border border-for-600/30 p-3.5 hover:border-for-500/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                  <span className="text-[11px] font-bold text-for-400 uppercase tracking-wide">
                    Most Decisive Law
                  </span>
                  <ExternalLink className="h-3 w-3 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-white font-medium leading-snug line-clamp-2">
                  {stats.most_decisive_statement}
                </p>
                {stats.most_decisive_pct != null && (
                  <p className="mt-1 text-[11px] font-mono text-for-300">
                    {Math.round(stats.most_decisive_pct)}% FOR
                  </p>
                )}
              </Link>
            )}
            {stats.closest_id && (
              <Link
                href={`/topic/${stats.closest_id}`}
                className="rounded-xl bg-surface-200/40 border border-surface-400/30 p-3.5 hover:border-surface-400/60 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Scale className="h-3.5 w-3.5 text-gold" />
                  <span className="text-[11px] font-bold text-gold uppercase tracking-wide">
                    Closest Decision
                  </span>
                  <ExternalLink className="h-3 w-3 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-white font-medium leading-snug line-clamp-2">
                  {stats.closest_statement}
                </p>
                {stats.closest_pct != null && (
                  <p className="mt-1 text-[11px] font-mono text-surface-400">
                    {Math.round(stats.closest_pct)}% FOR · nearly tied
                  </p>
                )}
              </Link>
            )}
          </div>
        )}

        {/* Outcome tabs */}
        <div className="flex items-center gap-1 bg-surface-800/60 rounded-xl p-1 mb-4">
          {OUTCOME_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setOutcome(tab.id); setCursor(null) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                outcome === tab.id
                  ? tab.id === 'law'
                    ? 'bg-for-600/30 border border-for-600/50 text-for-300'
                    : tab.id === 'failed'
                    ? 'bg-against-900/40 border border-against-700/40 text-against-300'
                    : 'bg-surface-700/80 border border-surface-500/50 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === 'all' ? 'All' : tab.id === 'law' ? 'Laws' : 'Rejected'}
              </span>
            </button>
          ))}
        </div>

        {/* Search + filters row */}
        <div className="flex gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
            <input
              type="text"
              placeholder="Search decisions…"
              value={inputValue}
              onChange={(e) => handleSearchInput(e.target.value)}
              className={cn(
                'w-full rounded-xl bg-surface-800/60 border border-surface-600/40 pl-9 pr-9 py-2.5',
                'text-sm text-white placeholder:text-surface-500 focus:outline-none',
                'focus:border-for-500/60 focus:bg-surface-800/80 transition-all'
              )}
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(''); setQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortMode); setCursor(null) }}
              className={cn(
                'rounded-xl bg-surface-800/60 border border-surface-600/40 pl-3 pr-8 py-2.5',
                'text-sm text-white focus:outline-none focus:border-for-500/60 transition-all',
                'appearance-none cursor-pointer'
              )}
            >
              <option value="recent">Most Recent</option>
              <option value="votes">Most Voted</option>
              <option value="consensus">By Consensus</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setCursor(null) }}
              className={cn(
                'flex-shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition-all border',
                category === cat
                  ? 'bg-purple/20 border-purple/50 text-purple'
                  : 'bg-surface-800/40 border-surface-600/30 text-surface-400 hover:text-white hover:border-surface-500/50'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Result count */}
        {!loading && (
          <p className="text-xs text-surface-500 mb-3 font-mono">
            {records.length > 0
              ? `Showing ${records.length} of ${totalCount} decisions`
              : query
              ? `No decisions matching "${query}"`
              : `No decisions recorded yet`}
          </p>
        )}

        {/* Records list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <RecordSkeleton key={i} />)}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No decisions yet"
            description={
              query
                ? `No civic decisions match "${query}". Try a different search.`
                : outcome === 'law'
                ? 'No laws have been established yet. Go vote!'
                : outcome === 'failed'
                ? 'No proposals have been rejected yet.'
                : 'No civic decisions have been recorded yet.'
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {records.map((record, i) => (
                <RecordCard key={record.id} record={record} index={i} />
              ))}
            </AnimatePresence>

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="h-4" />

            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            )}

            {!hasMore && records.length > 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-surface-500 font-mono">
                  — End of Record. {records.length} decisions archived. —
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
