'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Gavel,
  MessageSquare,
  Quote,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawReasonsResponse, LawReasonEntry } from '@/app/api/laws/[id]/reasons/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Reason Card ──────────────────────────────────────────────────────────────

function ReasonCard({ entry }: { entry: LawReasonEntry }) {
  const isFor = entry.side === 'blue'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'rounded-xl border p-4 relative group transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Decorative quote icon */}
      <Quote
        className={cn(
          'absolute top-3 right-3 h-4 w-4 opacity-20',
          isFor ? 'text-for-400' : 'text-against-400'
        )}
        aria-hidden
      />

      <p
        className={cn(
          'font-mono text-sm leading-relaxed pr-6',
          isFor ? 'text-for-200' : 'text-against-200'
        )}
      >
        &ldquo;{entry.reason}&rdquo;
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold',
            isFor
              ? 'bg-for-500/15 text-for-400 border border-for-500/20'
              : 'bg-against-500/15 text-against-400 border border-against-500/20'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
          ) : (
            <ThumbsDown className="h-2.5 w-2.5" aria-hidden />
          )}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          {relativeTime(entry.created_at)}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortBy = 'recent' | 'oldest' | 'length'

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'length', label: 'Longest First' },
]

function sortReasons(reasons: LawReasonEntry[], sort: SortBy): LawReasonEntry[] {
  return [...reasons].sort((a, b) => {
    switch (sort) {
      case 'recent':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'length':
        return b.reason.length - a.reason.length
      default:
        return 0
    }
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LawReasonsClient() {
  const params = useParams<{ id: string }>()
  const lawId = params.id

  const [data, setData] = useState<LawReasonsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [sort, setSort] = useState<SortBy>('recent')
  const [query, setQuery] = useState('')
  const [showSort, setShowSort] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/laws/${lawId}/reasons`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as LawReasonsResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const allReasons = data?.reasons ?? []
  const filtered = query.trim()
    ? allReasons.filter((r) => r.reason.toLowerCase().includes(query.toLowerCase()))
    : allReasons

  const sorted = sortReasons(filtered, sort)
  const forReasons = sorted.filter((r) => r.side === 'blue')
  const againstReasons = sorted.filter((r) => r.side === 'red')

  const stats = data?.stats
  const law = data?.law

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/law/${lawId}`}
            className="flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-gold" aria-hidden />
                Why The Nation Voted
              </h1>
              <Badge variant="law">LAW</Badge>
            </div>
            {law && (
              <p className="font-mono text-xs text-surface-500 mt-1 leading-relaxed line-clamp-2">
                {truncate(law.statement, 130)}
              </p>
            )}
            {law?.established_at && (
              <p className="font-mono text-[10px] text-gold/70 mt-0.5 flex items-center gap-1">
                <Gavel className="h-3 w-3" aria-hidden />
                Established {formatDate(law.established_at)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/law/${lawId}`}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 text-surface-500 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Full law
            </Link>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <EmptyState
            icon={MessageSquare}
            title="Couldn't load vote reasons"
            description="The reasons feed hit a snag. Try refreshing."
            action={
              <button
                onClick={() => load()}
                className="px-4 py-2 rounded-lg bg-gold/20 text-gold font-mono text-sm border border-gold/30 hover:bg-gold/30 transition-colors"
              >
                Retry
              </button>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Vote split bar */}
              {law && (
                <div className="mb-6 rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center justify-between mb-2 text-xs font-mono">
                    <span className="text-for-400 font-semibold">
                      {Math.round(law.blue_pct)}% FOR
                    </span>
                    <span className="text-surface-500">
                      {(law.total_votes ?? 0).toLocaleString()} votes cast
                    </span>
                    <span className="text-against-400 font-semibold">
                      {100 - Math.round(law.blue_pct)}% AGAINST
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-against-500/20">
                    <div
                      className="h-full bg-for-500 rounded-full transition-all duration-700"
                      style={{ width: `${law.blue_pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stats grid */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    {
                      label: 'Total reasons',
                      value: stats.total_with_reasons.toLocaleString(),
                      color: 'text-white',
                      sub: `of ${stats.total_votes.toLocaleString()} votes`,
                    },
                    {
                      label: 'Coverage',
                      value: `${stats.coverage_pct}%`,
                      color: stats.coverage_pct >= 20 ? 'text-emerald' : 'text-surface-400',
                      sub: 'voters explained',
                    },
                    {
                      label: 'FOR reasons',
                      value: stats.for_count.toLocaleString(),
                      color: 'text-for-400',
                      sub: 'supported the law',
                    },
                    {
                      label: 'AGAINST reasons',
                      value: stats.against_count.toLocaleString(),
                      color: 'text-against-400',
                      sub: 'opposed the law',
                    },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                      <div className="font-mono text-[11px] text-surface-500 mb-1">{label}</div>
                      <div className={cn('font-mono text-xl font-bold', color)}>{value}</div>
                      <div className="font-mono text-[10px] text-surface-600 mt-0.5">{sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Search + sort toolbar */}
              {allReasons.length > 0 && (
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search reasons…"
                      className={cn(
                        'w-full pl-8 pr-8 py-2 rounded-lg bg-surface-200 border border-surface-300',
                        'font-mono text-xs text-white placeholder:text-surface-500',
                        'focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20',
                        'transition-colors'
                      )}
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sort dropdown */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowSort((v) => !v)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors',
                        showSort
                          ? 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                      )}
                    >
                      {SORT_OPTIONS.find((s) => s.id === sort)?.label ?? 'Sort'}
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showSort && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {showSort && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
                        >
                          {SORT_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => { setSort(opt.id); setShowSort(false) }}
                              className={cn(
                                'w-full text-left px-3 py-2 font-mono text-xs transition-colors',
                                sort === opt.id
                                  ? 'bg-gold/20 text-gold'
                                  : 'text-surface-400 hover:bg-surface-300 hover:text-white'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {query && (
                    <span className="text-xs font-mono text-surface-500 flex-shrink-0">
                      {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Empty state */}
              {allReasons.length === 0 ? (
                <EmptyState
                  icon={Quote}
                  title="No vote reasons recorded"
                  description="Citizens didn't leave explanations when voting on this topic. Future votes on similar topics may capture more reasoning."
                  action={
                    law?.topic_id ? (
                      <Link
                        href={`/topic/${law.topic_id}`}
                        className="px-4 py-2 rounded-lg bg-gold/20 text-gold font-mono text-sm border border-gold/30 hover:bg-gold/30 transition-colors"
                      >
                        View source topic
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* FOR column */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsUp className="h-4 w-4 text-for-400" aria-hidden />
                      <span className="font-mono text-sm font-bold text-for-300">FOR</span>
                      <span className="font-mono text-xs text-surface-500 ml-auto">
                        {forReasons.length} reason{forReasons.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {forReasons.length === 0 ? (
                      <div className="rounded-xl border border-surface-300 bg-surface-100 p-6 text-center">
                        <p className="font-mono text-xs text-surface-500">
                          No FOR reasons match your search.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence>
                          {forReasons.map((entry) => (
                            <ReasonCard key={entry.id} entry={entry} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* AGAINST column */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsDown className="h-4 w-4 text-against-400" aria-hidden />
                      <span className="font-mono text-sm font-bold text-against-300">AGAINST</span>
                      <span className="font-mono text-xs text-surface-500 ml-auto">
                        {againstReasons.length} reason{againstReasons.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {againstReasons.length === 0 ? (
                      <div className="rounded-xl border border-surface-300 bg-surface-100 p-6 text-center">
                        <p className="font-mono text-xs text-surface-500">
                          No AGAINST reasons match your search.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence>
                          {againstReasons.map((entry) => (
                            <ReasonCard key={entry.id} entry={entry} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer navigation */}
              <div className="mt-8 flex items-center justify-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
                <Link
                  href={`/law/${lawId}`}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Full law
                </Link>
                <Link
                  href={`/law/${lawId}/voters`}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Founding voters
                </Link>
                <Link
                  href={`/law/${lawId}/quotes`}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Debate quotes
                </Link>
                {law?.topic_id && (
                  <Link
                    href={`/topic/${law.topic_id}/reasons`}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Topic reasons
                  </Link>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
