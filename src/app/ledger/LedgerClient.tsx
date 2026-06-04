'use client'

/**
 * /ledger — The Civic Ledger
 *
 * An official, immutable chronological record of every civic decision
 * rendered on the Lobby Market platform — laws established AND topics
 * that failed to reach consensus.
 *
 * Distinct from:
 *   /constitution  — living document of current laws only (organised by article)
 *   /graveyard     — failure analysis (cause of death, no laws included)
 *   /history       — your personal browsing history
 *   /chronicle     — narrative summary format
 *   /legacy        — your personal civic record
 *
 * The Ledger answers: "What decisions has this platform ever made, in order?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Filter,
  Gavel,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Clock,
  Hash,
  BarChart2,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { LedgerEntry, LedgerResponse, LedgerStats } from '@/app/api/ledger/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',        bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',         bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300',    bg: 'bg-against-600/10',   border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',         bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { text: 'text-gold',           bg: 'bg-gold/10',          border: 'border-gold/30' },
  Health:      { text: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',        bg: 'bg-for-600/10',       border: 'border-for-500/20' },
}
function catColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }
}

// ─── Verdict config ───────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  ESTABLISHED: {
    label: 'ESTABLISHED',
    short: 'LAW',
    textColor: 'text-emerald',
    bgColor: 'bg-emerald/10',
    borderColor: 'border-emerald/30',
    icon: Gavel,
    barColor: 'bg-gradient-to-r from-emerald to-emerald/70',
  },
  FAILED: {
    label: 'FAILED',
    short: 'FAILED',
    textColor: 'text-against-400',
    bgColor: 'bg-against-600/10',
    borderColor: 'border-against-500/30',
    icon: ThumbsDown,
    barColor: 'bg-gradient-to-r from-against-600 to-against-500/70',
  },
}

// ─── Sort / filter options ────────────────────────────────────────────────────

type FilterType = 'all' | 'law' | 'failed'
type SortType = 'recent' | 'oldest' | 'votes'

const FILTER_OPTS: { value: FilterType; label: string }[] = [
  { value: 'all',    label: 'All Decisions' },
  { value: 'law',    label: 'Laws Only'     },
  { value: 'failed', label: 'Failed Only'   },
]

const SORT_OPTS: { value: SortType; label: string }[] = [
  { value: 'recent', label: 'Most Recent'  },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'votes',  label: 'Most Votes'   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatEntryId(id: string, num: number) {
  return `#${String(num).padStart(4, '0')} · ${id.slice(0, 8).toUpperCase()}`
}

// ─── Stats header ─────────────────────────────────────────────────────────────

function StatsHeader({ stats }: { stats: LedgerStats }) {
  const pills = [
    { label: 'Total Decisions', value: stats.total_entries, color: 'text-white' },
    { label: 'Laws Established', value: stats.laws_count, color: 'text-emerald' },
    { label: 'Failed Proposals', value: stats.failed_count, color: 'text-against-400' },
    { label: 'Pass Rate', value: `${stats.pass_rate}%`, color: 'text-gold', raw: true },
    { label: 'Avg Votes', value: stats.avg_votes_per_decision, color: 'text-purple' },
  ] as const

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {pills.map((p, i) => (
        <motion.div
          key={p.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.04 }}
          className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-1">{p.label}</p>
          <p className={cn('text-2xl font-mono font-bold', p.color)}>
            {'raw' in p && p.raw
              ? p.value
              : <AnimatedNumber value={typeof p.value === 'number' ? p.value : 0} />
            }
          </p>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Category breakdown bar ───────────────────────────────────────────────────

function CategoryBar({ stats }: { stats: LedgerStats }) {
  const [open, setOpen] = useState(false)
  const top = stats.categories.slice(0, 8)

  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 mb-6">
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-mono uppercase tracking-wider text-surface-500 flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5" />
          Category breakdown
        </span>
        <ChevronDown className={cn('h-4 w-4 text-surface-500 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {top.map((c) => {
                const cc = catColor(c.category)
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className={cn('text-xs font-mono w-24 flex-shrink-0', cc.text)}>{c.category}</span>
                    <div className="flex-1 flex items-center gap-1 h-4">
                      {c.laws > 0 && (
                        <div
                          className="h-full bg-emerald/40 rounded-sm"
                          style={{ width: `${(c.laws / c.total) * 100}%` }}
                          title={`${c.laws} laws`}
                        />
                      )}
                      {c.failed > 0 && (
                        <div
                          className="h-full bg-against-500/40 rounded-sm"
                          style={{ width: `${(c.failed / c.total) * 100}%` }}
                          title={`${c.failed} failed`}
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-surface-500 w-12 text-right flex-shrink-0">
                      {c.pass_rate}% law
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center gap-4 pt-1 border-t border-surface-300 mt-2">
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald"><span className="h-2 w-2 rounded-sm bg-emerald/40 inline-block" />Laws</span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-against-400"><span className="h-2 w-2 rounded-sm bg-against-500/40 inline-block" />Failed</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Single ledger entry ──────────────────────────────────────────────────────

function LedgerRow({ entry, index }: { entry: LedgerEntry; index: number }) {
  const vc = VERDICT_CONFIG[entry.verdict]
  const VIcon = vc.icon
  const forPct = entry.final_blue_pct
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Link href={`/topic/${entry.id}`} className="block group">
        <div className={cn(
          'rounded-xl border transition-colors px-4 py-4',
          'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
        )}>
          {/* Top row: entry ID + verdict + date */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Hash className="h-3 w-3" />
                {formatEntryId(entry.id, entry.entry_number)}
              </span>
              {entry.category && (
                <span className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border',
                  catColor(entry.category).text,
                  catColor(entry.category).bg,
                  catColor(entry.category).border,
                )}>
                  {entry.category}
                </span>
              )}
              {entry.scope && entry.scope !== 'national' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300">
                  {entry.scope}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold tracking-wide',
                vc.textColor, vc.bgColor, vc.borderColor,
              )}>
                <VIcon className="h-3 w-3" />
                {vc.short}
              </span>
              <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(entry.decided_at)}
              </span>
            </div>
          </div>

          {/* Statement */}
          <p className="font-mono text-sm text-white leading-snug mb-3 group-hover:text-surface-100 transition-colors line-clamp-2">
            {entry.statement}
          </p>

          {/* Vote bar + stats */}
          <div className="space-y-1.5">
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-300">
              <div
                className="bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="bg-gradient-to-r from-against-500 to-against-400 transition-all duration-500"
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center gap-1 text-for-400">
                <ThumbsUp className="h-3 w-3" />
                {forPct}% For
              </span>
              <span className="text-surface-500">
                {entry.total_votes.toLocaleString()} votes
                {entry.duration_days > 0 && ` · ${entry.duration_days}d`}
              </span>
              <span className="flex items-center gap-1 text-against-400">
                {againstPct}% Against
                <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LedgerSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LedgerClient() {
  const [data, setData]               = useState<LedgerResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter]           = useState<FilterType>('all')
  const [sort, setSort]               = useState<SortType>('recent')
  const [category, setCategory]       = useState<string | null>(null)
  const [page, setPage]               = useState(1)
  const [sortOpen, setSortOpen]       = useState(false)
  const [catOpen, setCatOpen]         = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const catRef  = useRef<HTMLDivElement>(null)

  const load = useCallback(async (p: number, replace: boolean) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        page:      String(p),
        page_size: '25',
        filter,
        sort,
      })
      if (category) params.set('category', category)

      const res = await fetch(`/api/ledger?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as LedgerResponse

      if (replace) {
        setData(json)
      } else {
        setData((prev) => prev ? {
          ...json,
          entries: [...prev.entries, ...json.entries],
        } : json)
      }
    } catch {
      // Fail silently — empty state handles it
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, sort, category])

  // Reload when filters change
  useEffect(() => {
    setPage(1)
    load(1, true)
  }, [filter, sort, category]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when page changes (but not on first mount or filter changes)
  const isFirstPage = useRef(true)
  useEffect(() => {
    if (isFirstPage.current) { isFirstPage.current = false; return }
    if (page > 1) load(page, false)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
      if (catRef.current  && !catRef.current.contains(e.target as Node))  setCatOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const hasMore = data ? data.entries.length < data.total_count : false
  const categories = data?.stats.categories ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>

          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <BookOpen className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">The Civic Ledger</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The official record of every civic decision — laws established and proposals that failed.
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats header ─────────────────────────────────────────────────── */}
        {data && <StatsHeader stats={data.stats} />}
        {data && <CategoryBar stats={data.stats} />}

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface-200 rounded-lg border border-surface-300">
            {FILTER_OPTS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-mono transition-colors',
                  filter === f.value
                    ? 'bg-surface-0 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              {SORT_OPTS.find((s) => s.value === sort)?.label}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', sortOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 z-50 w-40 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
                >
                  {SORT_OPTS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => { setSort(s.value); setSortOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-xs font-mono transition-colors',
                        sort === s.value
                          ? 'bg-surface-200 text-white'
                          : 'text-surface-400 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div ref={catRef} className="relative">
              <button
                onClick={() => setCatOpen(!catOpen)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-colors',
                  category
                    ? 'bg-for-600/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                {category ?? 'All Categories'}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', catOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {catOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full mt-1 left-0 z-50 w-48 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                  >
                    <button
                      onClick={() => { setCategory(null); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-xs font-mono transition-colors border-b border-surface-300',
                        !category ? 'bg-surface-200 text-white' : 'text-surface-400 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      All Categories
                    </button>
                    {categories.map((c) => {
                      const cc = catColor(c.category)
                      return (
                        <button
                          key={c.category}
                          onClick={() => { setCategory(c.category); setCatOpen(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 text-xs font-mono transition-colors flex items-center justify-between',
                            category === c.category
                              ? 'bg-surface-200 text-white'
                              : `${cc.text} hover:bg-surface-200 hover:text-white`
                          )}
                        >
                          <span>{c.category}</span>
                          <span className="text-surface-500">{c.total}</span>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => load(page, true)}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Entry count label ─────────────────────────────────────────────── */}
        {!loading && data && (
          <p className="text-xs font-mono text-surface-500 mb-4">
            Showing {data.entries.length} of {data.total_count.toLocaleString()} decision{data.total_count !== 1 ? 's' : ''}
            {category && <span> in <span className="text-white">{category}</span></span>}
          </p>
        )}

        {/* ── Entries ───────────────────────────────────────────────────────── */}
        {loading ? (
          <LedgerSkeleton />
        ) : data && data.entries.length > 0 ? (
          <>
            <div className="space-y-3">
              {data.entries.map((entry, i) => (
                <LedgerRow key={entry.id} entry={entry} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Loading...</>
                  ) : (
                    <>Load More<ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No entries yet"
            description="Once topics reach a decision — becoming law or failing — they will appear here as permanent civic records."
            actions={[{ label: 'Browse Topics', href: '/' }]}
          />
        )}

      </main>
      <BottomNav />
    </div>
  )
}
