'use client'

/**
 * /law/wiki/missing — Laws Without Wiki Articles
 *
 * Lists established laws that have no wiki_content yet, sorted by
 * importance (total votes desc by default). Each card links directly to
 * the law's wiki tab so a contributor can immediately start writing.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Gavel,
  Loader2,
  PenLine,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MissingWikiLaw, MissingWikiResponse } from '@/app/api/law/wiki/missing/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'votes', label: 'Most Voted' },
  { value: 'newest', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['value']

const CATEGORIES = [
  'All', 'Economy', 'Healthcare', 'Environment', 'Education',
  'Justice', 'Housing', 'Technology', 'Foreign Policy', 'Civil Rights', 'Other',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    Economy: 'text-gold bg-gold/10 border-gold/30',
    Healthcare: 'text-emerald bg-emerald/10 border-emerald/30',
    Environment: 'text-emerald bg-emerald/10 border-emerald/30',
    Education: 'text-for-400 bg-for-500/10 border-for-500/30',
    Justice: 'text-purple bg-purple/10 border-purple/30',
    Housing: 'text-gold bg-gold/10 border-gold/30',
    Technology: 'text-for-400 bg-for-500/10 border-for-500/30',
    'Foreign Policy': 'text-against-400 bg-against-500/10 border-against-500/30',
    'Civil Rights': 'text-purple bg-purple/10 border-purple/30',
  }
  return map[cat ?? ''] ?? 'text-surface-400 bg-surface-200 border-surface-300'
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function MissingLawCard({ law }: { law: MissingWikiLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-xl border border-surface-200 bg-surface-100 hover:border-surface-300 transition-colors"
    >
      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 shrink-0 mt-0.5">
          <Scale className="h-4 w-4 text-gold" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-white leading-snug mb-2">
            {law.statement}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {law.category && (
              <span className={cn('text-xs font-mono px-2 py-0.5 rounded-md border', categoryColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="text-xs font-mono text-surface-500">
              {law.total_votes?.toLocaleString() ?? 0} votes
            </span>
            <span className="text-xs font-mono text-surface-600">·</span>
            <span className="text-xs font-mono text-emerald">
              {forPct}% FOR
            </span>
            <span className="text-xs font-mono text-surface-600">·</span>
            <span className="text-xs font-mono text-surface-500">
              Passed {formatDate(law.established_at)}
            </span>
          </div>
        </div>

        {/* Write CTA */}
        <Link
          href={`/law/${law.id}/wiki`}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 hover:bg-for-500/20 transition-colors text-xs font-mono shrink-0 whitespace-nowrap"
        >
          <PenLine className="h-3.5 w-3.5" />
          Write
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-100 p-4 flex items-start gap-3">
      <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MissingWikiPage() {
  const [laws, setLaws] = useState<MissingWikiLaw[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('votes')
  const [category, setCategory] = useState('All')
  const [offset, setOffset] = useState(0)

  const fetchLaws = useCallback(
    async (newOffset: number, replace: boolean) => {
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          sort,
          category,
          limit: String(PAGE_SIZE),
          offset: String(newOffset),
        })
        const res = await fetch(`/api/law/wiki/missing?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: MissingWikiResponse = await res.json()
        setLaws((prev) => replace ? data.laws : [...prev, ...data.laws])
        setTotal(data.total)
        setHasMore(data.has_more)
        setOffset(newOffset + data.laws.length)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (replace) setLoading(false)
        else setLoadingMore(false)
      }
    },
    [sort, category]
  )

  useEffect(() => {
    setOffset(0)
    fetchLaws(0, true)
  }, [sort, category]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/law/wiki"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Law Codex Wiki
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <PenLine className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Laws Needing Articles</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading ? '…' : `${total.toLocaleString()} law${total !== 1 ? 's' : ''} without wiki content`}
              </p>
            </div>
          </div>

          <p className="text-sm font-mono text-surface-400 leading-relaxed">
            These laws passed through civic consensus but have no wiki article yet.
            Click <span className="text-for-400">Write</span> on any card to start an article — add context, background, and real-world impact.
          </p>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="appearance-none h-8 pl-3 pr-7 rounded-lg bg-surface-200 border border-surface-300 text-white text-xs font-mono focus:outline-none focus:border-for-500 cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
          </div>

          {/* Category */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none h-8 pl-3 pr-7 rounded-lg bg-surface-200 border border-surface-300 text-white text-xs font-mono focus:outline-none focus:border-for-500 cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-surface-200 bg-surface-100 p-8 text-center">
            <p className="text-surface-500 font-mono text-sm mb-3">{error}</p>
            <button
              onClick={() => fetchLaws(0, true)}
              className="flex items-center gap-1.5 mx-auto text-sm font-mono text-for-400 hover:text-for-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : laws.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="All laws documented!"
            description="Every established law in the Codex has a wiki article. Great work, community!"
            action={{ label: 'Browse Law Codex', href: '/law' }}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {laws.map((law) => (
                <MissingLawCard key={law.id} law={law} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => fetchLaws(offset, false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                  ) : (
                    <><ChevronDown className="h-4 w-4" />Load more</>
                  )}
                </button>
              </div>
            )}

            {/* Progress strip */}
            {!hasMore && laws.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 rounded-xl border border-surface-200 bg-surface-100 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2 text-sm font-mono text-surface-400">
                  <Gavel className="h-4 w-4 text-gold" />
                  Showing all {laws.length} undocumented law{laws.length !== 1 ? 's' : ''}
                </div>
                <Link
                  href="/law/wiki"
                  className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300"
                >
                  Wiki Hub
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
