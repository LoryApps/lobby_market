'use client'

/**
 * /thesis/search — Civic Thesis Search
 *
 * Dedicated search interface for discovering public civic theses.
 * Supports keyword search, category filters, status filters, and sort modes.
 * URL state is encoded so results are shareable and bookmarkable.
 *
 * Distinct from:
 *   /thesis         — main thesis board (curated tabs: hot, rising, etc.)
 *   /thesis/compare — head-to-head comparison of two specific theses
 *   /thesis/my      — your own theses
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  GitCompare,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { ThesisSearchResult } from '@/app/api/thesis/search/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof CircleDot }> = {
  active:     { label: 'Active',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     Icon: CircleDot },
  vindicated: { label: 'Vindicated', color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        Icon: Trophy },
  refuted:    { label: 'Refuted',    color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', Icon: XCircle },
  expired:    { label: 'Expired',    color: 'text-surface-500', bg: 'bg-surface-200/40', border: 'border-surface-400/30', Icon: Clock },
}

const CAT_COLORS: Record<string, string> = {
  economics:   'text-gold border-gold/40 bg-gold/10',
  politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  technology:  'text-purple border-purple/40 bg-purple/10',
  science:     'text-emerald border-emerald/40 bg-emerald/10',
  ethics:      'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy:  'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture:     'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health:      'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education:   'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

const SORT_OPTIONS = [
  { id: 'popular',       label: 'Most Popular' },
  { id: 'newest',        label: 'Newest' },
  { id: 'contested',     label: 'Most Contested' },
  { id: 'resolving_soon', label: 'Resolving Soon' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function agreePct(agree: number, disagree: number): number {
  const total = agree + disagree
  return total === 0 ? 50 : Math.round((agree / total) * 100)
}

// ─── Result card ───────────────────────────────────────────────────────────────

function ThesisResultCard({ thesis, compareMode, onAddToCompare, isInCompare }: {
  thesis: ThesisSearchResult
  compareMode: boolean
  onAddToCompare: (id: string) => void
  isInCompare: boolean
}) {
  const sc = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.active
  const Icon = sc.Icon
  const catColor = CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const pct = agreePct(thesis.agree_count, thesis.disagree_count)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group rounded-2xl bg-surface-100 border transition-colors',
        isInCompare
          ? 'border-purple/50 bg-purple/5'
          : 'border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {thesis.author && (
            <Link
              href={`/profile/${thesis.author.username}`}
              className="flex-shrink-0 mt-0.5"
              aria-label={`View ${thesis.author.display_name ?? thesis.author.username}'s profile`}
            >
              <Avatar
                src={thesis.author.avatar_url}
                fallback={thesis.author.display_name ?? thesis.author.username}
                size="sm"
              />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <Link href={`/thesis/${thesis.id}`} className="block group/link">
              <p className="text-sm font-medium text-white leading-snug group-hover/link:text-for-300 transition-colors line-clamp-3">
                {thesis.statement}
              </p>
            </Link>
            {thesis.author && (
              <p className="text-xs text-surface-500 mt-1">
                by{' '}
                <Link
                  href={`/profile/${thesis.author.username}`}
                  className="text-surface-400 hover:text-white transition-colors"
                >
                  {thesis.author.display_name ?? thesis.author.username}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border capitalize', catColor)}>
            {thesis.category}
          </span>
          <span className={cn('flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border', sc.color, sc.bg, sc.border)}>
            <Icon className="h-3 w-3" />
            {sc.label}
          </span>
          {thesis.resolution_date && (
            <span className="flex items-center gap-1 text-xs text-surface-500 font-mono">
              <Calendar className="h-3 w-3" />
              {fmtDate(thesis.resolution_date)}
            </span>
          )}
        </div>

        {/* Agreement bar */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs font-mono text-surface-500">
            <span className="flex items-center gap-1 text-for-300">
              <ThumbsUp className="h-3 w-3" />
              {thesis.agree_count}
            </span>
            <span className="text-surface-600">{pct}% agree</span>
            <span className="flex items-center gap-1 text-against-300">
              {thesis.disagree_count}
              <ThumbsDown className="h-3 w-3" />
            </span>
          </div>
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300/60">
          <Link
            href={`/thesis/${thesis.id}`}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            View thesis
          </Link>
          <span className="text-surface-600">·</span>
          {compareMode ? (
            <button
              onClick={() => onAddToCompare(thesis.id)}
              disabled={isInCompare}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                isInCompare
                  ? 'text-purple cursor-default'
                  : 'text-surface-500 hover:text-purple',
              )}
            >
              <GitCompare className="h-3.5 w-3.5" />
              {isInCompare ? 'Added' : 'Add to compare'}
            </button>
          ) : (
            <Link
              href={`/thesis/${thesis.id}/edit`}
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <Scale className="h-3.5 w-3.5" />
              Vote
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ThesisSearchClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── URL state ──────────────────────────────────────────────────────────────
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState(searchParams.get('category') ?? 'all')
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'popular')
  const [showFilters, setShowFilters] = useState(false)

  // ── Search state ───────────────────────────────────────────────────────────
  const [results, setResults] = useState<ThesisSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Compare mode ───────────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])

  // ── Search function ────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string, cat: string, st: string, srt: string) => {
    if (q.length < 2 && cat === 'all' && st === 'all') {
      setResults([])
      setHasSearched(false)
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ limit: '30', sort: srt })
      if (q.length >= 2) params.set('q', q)
      if (cat !== 'all') params.set('category', cat)
      if (st !== 'all') params.set('status', st)
      const res = await fetch(`/api/thesis/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Debounced search on input change ───────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query, category, status, sort), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category, status, sort, doSearch])

  // ── Sync URL when filters change ───────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category !== 'all') params.set('category', category)
    if (status !== 'all') params.set('status', status)
    if (sort !== 'popular') params.set('sort', sort)
    const newSearch = params.toString()
    router.replace(`/thesis/search${newSearch ? `?${newSearch}` : ''}`, { scroll: false })
  }, [query, category, status, sort, router])

  // ── Run on mount if URL has params ─────────────────────────────────────────
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    const cat = searchParams.get('category') ?? 'all'
    const st = searchParams.get('status') ?? 'all'
    const srt = (searchParams.get('sort') as SortOption) ?? 'popular'
    if (q.length >= 2 || cat !== 'all' || st !== 'all') {
      doSearch(q, cat, st, srt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Compare helpers ────────────────────────────────────────────────────────
  function addToCompare(id: string) {
    if (compareIds.includes(id)) return
    if (compareIds.length >= 2) {
      setCompareIds([compareIds[1], id])
      return
    }
    setCompareIds((prev) => [...prev, id])
  }

  function goCompare() {
    if (compareIds.length < 2) return
    router.push(`/thesis/compare?a=${compareIds[0]}&b=${compareIds[1]}`)
  }

  function clearFilter() {
    setQuery('')
    setCategory('all')
    setStatus('all')
    setSort('popular')
    setResults([])
    setHasSearched(false)
    setCompareIds([])
    inputRef.current?.focus()
  }

  const activeFilters = (category !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/thesis"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Back to Thesis board"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Search Theses</h1>
            <p className="text-xs text-surface-500">Find civic predictions from across the Lobby</p>
          </div>
          {/* Compare mode toggle */}
          <button
            onClick={() => { setCompareMode((v) => !v); setCompareIds([]) }}
            className={cn(
              'ml-auto flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
              compareMode
                ? 'text-purple border-purple/40 bg-purple/10 hover:bg-purple/20'
                : 'text-surface-500 border-surface-300 bg-surface-200 hover:bg-surface-300 hover:text-white',
            )}
          >
            <GitCompare className="h-3.5 w-3.5" />
            {compareMode ? 'Comparing' : 'Compare'}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search thesis statements…"
            autoFocus
            className={cn(
              'w-full pl-10 pr-10 py-3 rounded-xl',
              'bg-surface-100 border border-surface-300 text-white text-sm',
              'placeholder-surface-500 focus:outline-none focus:border-purple/50 focus:bg-surface-200/80',
              'transition-colors',
            )}
            aria-label="Search theses"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors',
              (showFilters || activeFilters > 0)
                ? 'text-for-300 border-for-500/40 bg-for-500/10'
                : 'text-surface-500 border-surface-300 bg-surface-200 hover:bg-surface-300 hover:text-white',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilters > 0 && (
              <span className="ml-1 h-4 w-4 flex items-center justify-center rounded-full bg-for-500 text-white text-[10px] font-bold">
                {activeFilters}
              </span>
            )}
          </button>

          {/* Sort pills */}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className={cn(
                'text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors',
                sort === opt.id
                  ? 'text-white border-surface-400 bg-surface-300'
                  : 'text-surface-500 border-surface-300 bg-surface-200 hover:bg-surface-300 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}

          {/* Clear all */}
          {(query || activeFilters > 0) && (
            <button
              onClick={clearFilter}
              className="ml-auto flex items-center gap-1 text-xs text-surface-500 hover:text-against-400 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Expanded filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-5"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-4">
                {/* Category filter */}
                <div>
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', ...THESIS_CATEGORIES].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'text-xs font-mono px-2 py-0.5 rounded border capitalize transition-colors',
                          category === cat
                            ? cat === 'all'
                              ? 'text-white border-surface-400 bg-surface-300'
                              : cn(CAT_COLORS[cat] ?? 'text-white border-surface-400 bg-surface-300', 'opacity-100')
                            : 'text-surface-500 border-surface-300 hover:text-surface-300 hover:border-surface-400',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status filter */}
                <div>
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', 'active', 'vindicated', 'refuted', 'expired'].map((st) => {
                      const sc = STATUS_CONFIG[st]
                      return (
                        <button
                          key={st}
                          onClick={() => setStatus(st)}
                          className={cn(
                            'flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border capitalize transition-colors',
                            status === st
                              ? sc
                                ? cn(sc.color, sc.bg, sc.border)
                                : 'text-white border-surface-400 bg-surface-300'
                              : 'text-surface-500 border-surface-300 hover:text-surface-300 hover:border-surface-400',
                          )}
                        >
                          {sc && <sc.Icon className="h-3 w-3" />}
                          {st}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compare banner */}
        <AnimatePresence>
          {compareMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-purple/40 bg-purple/10 p-3 mb-5 flex items-center gap-3"
            >
              <GitCompare className="h-4 w-4 text-purple flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium">Compare mode</p>
                <p className="text-xs text-surface-400">
                  {compareIds.length === 0 && 'Click "Add to compare" on two theses'}
                  {compareIds.length === 1 && 'Pick one more thesis to compare'}
                  {compareIds.length >= 2 && 'Ready to compare — click Compare below'}
                </p>
              </div>
              {compareIds.length >= 2 && (
                <button
                  onClick={goCompare}
                  className="flex items-center gap-1.5 text-xs font-mono bg-purple hover:bg-purple/80 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Compare
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {compareIds.length > 0 && (
                <button
                  onClick={() => setCompareIds([])}
                  className="text-surface-500 hover:text-white transition-colors"
                  aria-label="Clear compare selection"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-mono text-surface-500">
              {results.length} {results.length === 1 ? 'thesis' : 'theses'} found
              {results.length === 30 && ' (showing top 30)'}
            </p>
            {results.map((thesis) => (
              <ThesisResultCard
                key={thesis.id}
                thesis={thesis}
                compareMode={compareMode}
                onAddToCompare={addToCompare}
                isInCompare={compareIds.includes(thesis.id)}
              />
            ))}
          </div>
        ) : hasSearched ? (
          <EmptyState
            icon={Search}
            title="No theses found"
            description={
              query
                ? `No public theses match "${query}". Try different keywords or adjust your filters.`
                : 'No theses match your selected filters. Try a different combination.'
            }
            action={
              <button
                onClick={clearFilter}
                className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear filters
              </button>
            }
          />
        ) : (
          /* Default discovery state */
          <div className="space-y-6 py-4">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-sm font-semibold text-white mb-1">Search civic predictions</h2>
              <p className="text-xs text-surface-500 mb-4">
                Type a keyword to search thesis statements, or use the filters above to browse by category or status.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Active predictions', onClick: () => { setStatus('active'); setCategory('all') } },
                  { label: 'Vindicated theses', onClick: () => { setStatus('vindicated'); setCategory('all') } },
                  { label: 'Economics theses', onClick: () => { setCategory('economics'); setStatus('all') } },
                  { label: 'Political predictions', onClick: () => { setCategory('politics'); setStatus('all') } },
                  { label: 'Tech forecasts', onClick: () => { setCategory('technology'); setStatus('all') } },
                  { label: 'Science theses', onClick: () => { setCategory('science'); setStatus('all') } },
                ].map(({ label, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="text-left text-xs text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300 border border-surface-300 hover:border-surface-400 rounded-lg px-3 py-2 transition-colors"
                  >
                    {label}
                    <ChevronDown className="inline ml-1 h-3 w-3 rotate-[-90deg]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-surface-500">
              <Link href="/thesis" className="hover:text-white transition-colors flex items-center gap-1">
                <CircleDot className="h-3.5 w-3.5" />
                Browse all theses
              </Link>
              <span>·</span>
              <Link href="/thesis/leaderboard" className="hover:text-white transition-colors flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                Leaderboard
              </Link>
              <span>·</span>
              <Link href="/thesis/compare" className="hover:text-white transition-colors flex items-center gap-1">
                <GitCompare className="h-3.5 w-3.5" />
                Compare two theses
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
