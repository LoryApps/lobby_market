'use client'

/**
 * /sources — Evidence Index
 *
 * A global leaderboard of the external sources cited most often in Lobby Market
 * arguments. Shows citation counts split by FOR / AGAINST side and a bias bar
 * indicating whether a domain is predominantly cited by one side.
 *
 * Data comes from source_url fields on topic_arguments (migration 00040).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Filter,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SourceDomain, SourcesResponse } from '@/app/api/sources/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

type SortOption = 'total' | 'for' | 'against' | 'bias'

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'total', label: 'Most Cited' },
  { id: 'for', label: 'FOR Citations' },
  { id: 'against', label: 'AGN Citations' },
  { id: 'bias', label: 'Most Biased' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Favicon ──────────────────────────────────────────────────────────────────

function Favicon({ domain }: { domain: string }) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <div className="flex-shrink-0 h-5 w-5 rounded bg-surface-300 flex items-center justify-center">
        <BookOpen className="h-3 w-3 text-surface-500" aria-hidden />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      aria-hidden
      className="flex-shrink-0 h-5 w-5 rounded"
      onError={() => setErrored(true)}
    />
  )
}

// ─── Bias bar ─────────────────────────────────────────────────────────────────

function BiasBar({ forPct, total }: { forPct: number; total: number }) {
  const againstPct = 100 - forPct
  const isNeutral = forPct >= 40 && forPct <= 60
  const isFor = forPct > 60

  const forW = forPct > 0 && forPct < 3 ? 3 : forPct
  const agnW = againstPct > 0 && againstPct < 3 ? 3 : againstPct

  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-1.5 rounded-full overflow-hidden flex"
        role="meter"
        aria-valuenow={forPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${forPct}% FOR citations, ${againstPct}% AGAINST`}
      >
        <div
          className="h-full bg-gradient-to-r from-for-700 to-for-400 rounded-l-full"
          style={{ width: `${forW}%` }}
        />
        <div
          className="h-full bg-gradient-to-l from-against-700 to-against-400 rounded-r-full ml-auto"
          style={{ width: `${agnW}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
        <span
          className={cn(
            'text-[10px] font-mono',
            isNeutral ? 'text-surface-500' : isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isNeutral ? 'Balanced' : isFor ? 'FOR-leaning' : 'AGN-leaning'}
        </span>
        <span className="text-[10px] font-mono text-against-400">{againstPct}% AGN</span>
      </div>
      <p className="text-[10px] font-mono text-surface-500 text-center">
        {fmtNum(total)} citation{total === 1 ? '' : 's'}
      </p>
    </div>
  )
}

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({ source, rank }: { source: SourceDomain; rank: number }) {
  const [expanded, setExpanded] = useState(false)

  const isNeutral = source.for_pct >= 40 && source.for_pct <= 60
  const isForLeaning = source.for_pct > 60
  const hasTopics = source.sample_topics.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(rank * 0.035, 0.5) }}
      className={cn(
        'rounded-2xl border bg-surface-100 transition-shadow',
        isNeutral
          ? 'border-surface-300'
          : isForLeaning
          ? 'border-for-500/20 shadow-[0_0_12px_rgba(59,130,246,0.06)]'
          : 'border-against-500/20 shadow-[0_0_12px_rgba(239,68,68,0.06)]'
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Rank */}
          <span className="flex-shrink-0 w-6 text-right text-xs font-mono text-surface-500 pt-0.5">
            {rank + 1}
          </span>

          {/* Favicon + domain */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Favicon domain={source.domain} />
            <div className="min-w-0 flex-1">
              <a
                href={source.example_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
                aria-label={`Visit ${source.domain}`}
              >
                <span className="truncate">{source.domain}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" aria-hidden />
              </a>
              {/* Categories */}
              {source.top_categories.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {source.top_categories.map((cat) => (
                    <span key={cat} className="text-[10px] font-mono text-surface-500">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Counts */}
          <div className="flex-shrink-0 flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1 text-for-400" aria-label={`${source.for_count} FOR citations`}>
              <ThumbsUp className="h-3 w-3" aria-hidden />
              {source.for_count}
            </span>
            <span className="text-surface-600">/</span>
            <span className="flex items-center gap-1 text-against-400" aria-label={`${source.against_count} AGAINST citations`}>
              <ThumbsDown className="h-3 w-3" aria-hidden />
              {source.against_count}
            </span>
          </div>
        </div>

        {/* Bias bar */}
        <div className="pl-9">
          <BiasBar forPct={source.for_pct} total={source.total_count} />
        </div>

        {/* Sample topics toggle */}
        {hasTopics && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 ml-9 inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide topics' : `${source.sample_topics.length} topic${source.sample_topics.length > 1 ? 's' : ''}`}
            <ArrowRight
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
              aria-hidden
            />
          </button>
        )}
      </div>

      {/* Expanded: sample topics */}
      <AnimatePresence>
        {expanded && hasTopics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300 px-4 py-3 space-y-2 ml-0">
              {source.sample_topics.map((t) => (
                <Link
                  key={t.id}
                  href={`/topic/${t.id}`}
                  className="flex items-start gap-2 group"
                >
                  <Badge
                    variant={
                      t.status === 'law'
                        ? 'law'
                        : t.status === 'voting' || t.status === 'active'
                        ? 'active'
                        : t.status === 'failed'
                        ? 'failed'
                        : 'proposed'
                    }
                    className="flex-shrink-0 mt-0.5 text-[10px] px-1.5 py-0"
                  >
                    {t.status === 'law' ? 'LAW' : t.status === 'voting' ? 'Voting' : t.status === 'active' ? 'Active' : t.status === 'failed' ? 'Failed' : 'Proposed'}
                  </Badge>
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors line-clamp-2 flex-1">
                    {truncate(t.statement, 100)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-for-400 flex-shrink-0 mt-0.5 transition-colors" aria-hidden />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SourceSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
        <Skeleton className="h-5 w-5 flex-shrink-0 rounded" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-16 flex-shrink-0" />
      </div>
      <div className="pl-9 space-y-1.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-20 mx-auto" />
      </div>
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
      <span className={cn('text-lg font-mono font-bold', color)}>{value}</span>
      <span className="text-[11px] font-mono text-surface-500 text-center leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  const [data, setData] = useState<SourcesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortOption>('total')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort })
      if (category !== 'All') params.set('category', category)
      const res = await fetch(`/api/sources?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: SourcesResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/arguments"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors mt-0.5"
            aria-label="Back to arguments"
          >
            <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald/10 border border-emerald/30">
                <BookOpen className="h-4 w-4 text-emerald" aria-hidden />
              </div>
              <h1 className="font-mono text-xl font-bold text-white">Evidence Index</h1>
            </div>
            <p className="text-xs font-mono text-surface-500">
              External sources cited in Lobby Market arguments — ranked by usage and side bias
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40 mt-0.5"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <StatPill
              label="Unique sources"
              value={fmtNum(data.total_unique_domains)}
              color="text-emerald"
            />
            <StatPill
              label="Cited arguments"
              value={fmtNum(data.total_cited_args)}
              color="text-white"
            />
            <StatPill
              label="FOR citations"
              value={fmtNum(data.for_cited)}
              color="text-for-400"
            />
            <StatPill
              label="AGN citations"
              value={fmtNum(data.against_cited)}
              color="text-against-400"
            />
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="mb-5 space-y-3">
          {/* Sort tabs */}
          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar"
            role="tablist"
            aria-label="Sort options"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                role="tab"
                aria-selected={sort === opt.id}
                onClick={() => setSort(opt.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors',
                  sort === opt.id
                    ? 'bg-for-600/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {opt.label}
              </button>
            ))}

            <button
              onClick={() => setShowFilters((f) => !f)}
              aria-expanded={showFilters}
              aria-label="Toggle category filter"
              className={cn(
                'ml-auto flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors',
                showFilters || category !== 'All'
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Filter className="h-3 w-3" aria-hidden />
              {category !== 'All' ? category : 'Category'}
            </button>
          </div>

          {/* Category filter (expandable) */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowFilters(false) }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                        category === cat
                          ? 'bg-purple/20 border-purple/40 text-purple'
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading sources">
            {Array.from({ length: 8 }).map((_, i) => (
              <SourceSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden /> Try again
            </button>
          </div>
        ) : !data || data.sources.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No cited arguments yet"
            description={
              category !== 'All'
                ? `No arguments in ${category} have cited external sources yet.`
                : 'Arguments with source URLs will appear here once added.'
            }
            actions={[
              { label: 'Browse arguments', href: '/arguments', variant: 'primary' },
            ]}
          />
        ) : (
          <>
            {/* Category breakdown */}
            {data.category_breakdown.length > 0 && category === 'All' && (
              <div className="mb-5">
                <p className="text-xs font-mono text-surface-500 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  Sources per category
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {data.category_breakdown.map((cb) => (
                    <button
                      key={cb.category}
                      onClick={() => setCategory(cb.category)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                    >
                      {cb.category}
                      <span className="text-surface-600">{cb.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Source list */}
            <div className="space-y-3" role="list" aria-label="Cited sources">
              {data.sources.map((source, i) => (
                <div key={source.domain} role="listitem">
                  <SourceCard source={source} rank={i} />
                </div>
              ))}
            </div>

            {data.sources.length >= 60 && (
              <p className="mt-6 text-center text-xs font-mono text-surface-500">
                Showing top 60 sources · {fmtNum(data.total_unique_domains)} unique domains total
              </p>
            )}
          </>
        )}

        {/* ── Context note ───────────────────────────────────────────── */}
        {!loading && !error && data && data.sources.length > 0 && (
          <div className="mt-8 rounded-xl border border-surface-300 bg-surface-100/50 p-4">
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              <span className="text-white font-medium">About Evidence Index.</span>{' '}
              Sources are extracted from argument citations added voluntarily by Lobby Market users.
              Bias scores reflect citation patterns — not source credibility. A FOR-leaning source
              is cited more often in FOR arguments; it does not imply bias in the source itself.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
