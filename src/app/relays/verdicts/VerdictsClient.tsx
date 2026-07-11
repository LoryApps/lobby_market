'use client'

/**
 * /relays/verdicts — Community Verdict Feed
 *
 * A live results board for completed relay chains. Shows the community's
 * compelling / not-compelling judgment on every finished relay, with:
 *   - Verdict badge (compelling / not compelling / contested)
 *   - Vote breakdown bar and percentages
 *   - The best leg (most upvoted quote)
 *   - Opposing chain result (FOR vs AGAINST margin)
 *   - Filter by verdict type, side, category, sort order
 *
 * Distinct from:
 *   /relays/pulse      — live feed of individual legs as they're contributed
 *   /relays/stats      — aggregate platform-wide statistics
 *   /relays/hall-of-fame — all-time most compelling chains
 *   /relays/league     — weekly competitive ranking
 *   /relays/showdown   — head-to-head comparison tool (pick one topic)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Filter,
  GitMerge,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { VerdictRelay, VerdictsResponse } from '@/app/api/relays/verdicts/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sideLabel(side: 'for' | 'against') {
  return side === 'for' ? 'FOR' : 'AGAINST'
}

function sideColors(side: 'for' | 'against') {
  return side === 'for'
    ? {
        text: 'text-for-400',
        bg: 'bg-for-500/10',
        border: 'border-for-500/30',
        bar: 'bg-for-500',
        pill: 'bg-for-500/15 text-for-300 border-for-500/30',
      }
    : {
        text: 'text-against-400',
        bg: 'bg-against-500/10',
        border: 'border-against-500/30',
        bar: 'bg-against-500',
        pill: 'bg-against-500/15 text-against-300 border-against-500/30',
      }
}

function verdictColors(verdict: 'compelling' | 'not_compelling' | 'contested') {
  switch (verdict) {
    case 'compelling':    return { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30', icon: CheckCircle2 }
    case 'not_compelling': return { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: XCircle }
    case 'contested':     return { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30', icon: Scale }
  }
}

function verdictLabel(verdict: 'compelling' | 'not_compelling' | 'contested') {
  switch (verdict) {
    case 'compelling':    return 'Compelling'
    case 'not_compelling': return 'Not Compelling'
    case 'contested':     return 'Contested'
  }
}

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science', 'Law',
  'Society', 'Culture', 'Environment', 'Health', 'Education',
]

// ─── Card ─────────────────────────────────────────────────────────────────────

function VerdictCard({ relay, index }: { relay: VerdictRelay; index: number }) {
  const side = sideColors(relay.side)
  const vc = verdictColors(relay.verdict)
  const VerdictIcon = vc.icon
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingBar = totalVotes > 0 ? (relay.vote_compelling / totalVotes) * 100 : 50

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400 transition-colors group',
        side.border,
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={cn('px-4 pt-3 pb-2 border-b border-surface-300 flex items-start gap-3')}>
        {/* Side badge */}
        <span className={cn(
          'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono border mt-0.5',
          side.pill,
        )}>
          <GitMerge className="h-2.5 w-2.5" />
          {sideLabel(relay.side)}
        </span>

        {/* Topic */}
        <div className="flex-1 min-w-0">
          {relay.topic_statement ? (
            <Link
              href={`/topic/${relay.topic_id}`}
              className="text-sm font-medium text-white leading-snug hover:text-for-300 transition-colors line-clamp-2"
            >
              {relay.topic_statement}
            </Link>
          ) : (
            <span className="text-sm text-surface-500">Untitled Topic</span>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {relay.topic_category && (
              <span className="text-[10px] text-surface-500 font-mono">{relay.topic_category}</span>
            )}
            <span className="text-[10px] text-surface-500">·</span>
            <span className="text-[10px] text-surface-500">{relay.leg_count}/{relay.max_legs} legs</span>
            <span className="text-[10px] text-surface-500">·</span>
            <span className="text-[10px] text-surface-500">{relativeTime(relay.completed_at)}</span>
          </div>
        </div>

        {/* Verdict badge */}
        <span className={cn(
          'shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border',
          vc.bg, vc.border, vc.text,
        )}>
          <VerdictIcon className="h-3 w-3" />
          {verdictLabel(relay.verdict)}
        </span>
      </div>

      {/* ── Vote bar ───────────────────────────────────────────────── */}
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <ThumbsUp className="h-3.5 w-3.5 text-emerald shrink-0" />
          <div className="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald to-for-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${compellingBar}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.04 + 0.2 }}
            />
          </div>
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 shrink-0" />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-emerald">{relay.compelling_pct ?? '—'}% compelling ({relay.vote_compelling})</span>
          <span className="text-against-400">{relay.vote_not_compelling > 0 ? `${100 - (relay.compelling_pct ?? 50)}%` : '0%'} ({relay.vote_not_compelling})</span>
        </div>
      </div>

      {/* ── Best leg quote ─────────────────────────────────────────── */}
      {relay.top_leg && (
        <div className="px-4 pb-3">
          <div className={cn('rounded-lg p-3 border', side.bg, side.border)}>
            <div className="flex items-start gap-2">
              <Quote className={cn('h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60', side.text)} />
              <p className="text-xs text-surface-700 leading-relaxed line-clamp-3 italic">
                {relay.top_leg.content}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-surface-500">
                Leg {relay.top_leg.leg_number} ·{' '}
                {relay.top_leg.author_display_name ?? relay.top_leg.author_username}
              </span>
              {relay.top_leg.upvote_count > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-gold font-mono">
                  <Zap className="h-2.5 w-2.5" />
                  {relay.top_leg.upvote_count}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer: opposing relay + link ──────────────────────────── */}
      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        {/* Opposing relay */}
        {relay.opposing_relay_id && relay.opposing_compelling_pct !== null ? (
          <Link
            href={`/relays/${relay.opposing_relay_id}`}
            className="flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-surface-700 transition-colors"
          >
            <Scale className="h-3 w-3" />
            <span>
              Opposing chain:{' '}
              <span className={cn(
                relay.opposing_compelling_pct >= 60 ? 'text-emerald' : relay.opposing_compelling_pct <= 40 ? 'text-against-400' : 'text-gold'
              )}>
                {relay.opposing_compelling_pct}% compelling
              </span>
            </span>
          </Link>
        ) : (
          <span className="text-[11px] text-surface-500 italic">No opposing chain yet</span>
        )}

        <Link
          href={`/relays/${relay.relay_id}`}
          className={cn(
            'shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium border transition-all',
            'bg-surface-200 border-surface-300 text-surface-700',
            'hover:border-surface-500 hover:text-white',
          )}
        >
          View relay
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VerdictSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-surface-300 flex items-start gap-3">
        <Skeleton className="h-5 w-16 rounded" />
        <div className="flex-1">
          <Skeleton className="h-4 w-3/4 rounded mb-1" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
        <Skeleton className="h-6 w-24 rounded-lg" />
      </div>
      <div className="px-4 py-2.5">
        <Skeleton className="h-2 w-full rounded-full mb-1" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="px-4 pb-3">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="px-4 pb-3 flex justify-between">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Filter = 'all' | 'compelling' | 'not_compelling' | 'contested'
type SortMode = 'recent' | 'decisive' | 'contested'

export function VerdictsClient() {
  const [verdicts, setVerdicts] = useState<VerdictRelay[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const [filter, setFilter] = useState<Filter>('all')
  const [side, setSide] = useState<'all' | 'for' | 'against'>('all')
  const [sort, setSort] = useState<SortMode>('recent')
  const [category, setCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const offsetRef = useRef(0)
  const PAGE = 20

  const fetchVerdicts = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError(false)

    try {
      const params = new URLSearchParams({
        filter,
        sort,
        limit: String(PAGE),
        offset: String(reset ? 0 : offsetRef.current),
      })
      if (side !== 'all') params.set('side', side)
      if (category) params.set('category', category)

      const res = await fetch(`/api/relays/verdicts?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: VerdictsResponse = await res.json()

      if (reset) {
        setVerdicts(data.verdicts)
      } else {
        setVerdicts((prev) => [...prev, ...data.verdicts])
      }
      setTotal(data.total)
      setHasMore(data.has_more)
      offsetRef.current = (reset ? 0 : offsetRef.current) + data.verdicts.length
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, sort, side, category])

  useEffect(() => {
    fetchVerdicts(true)
  }, [fetchVerdicts])

  const activeFilters = [
    filter !== 'all' && verdictLabel(filter as 'compelling' | 'not_compelling' | 'contested'),
    side !== 'all' && (side === 'for' ? 'FOR only' : 'AGAINST only'),
    category,
    sort !== 'recent' && (sort === 'decisive' ? 'Most decisive' : 'Closest call'),
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-surface-50 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/relays"
            className="text-surface-500 hover:text-surface-700 transition-colors"
            aria-label="Back to relays"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              Relay Verdicts
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Community judgments on completed relay chains
            </p>
          </div>
          <button
            onClick={() => fetchVerdicts(true)}
            disabled={loading}
            className="ml-auto text-surface-500 hover:text-surface-700 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Stats summary ────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total verdicts', value: total, icon: BarChart2, color: 'text-for-400' },
              {
                label: 'Compelling',
                value: verdicts.filter((v) => v.verdict === 'compelling').length,
                icon: CheckCircle2,
                color: 'text-emerald',
              },
              {
                label: 'Contested',
                value: verdicts.filter((v) => v.verdict === 'contested').length,
                icon: Scale,
                color: 'text-gold',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
              >
                <stat.icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
                <div className={cn('text-lg font-bold font-mono', stat.color)}>{stat.value}</div>
                <div className="text-[10px] text-surface-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter bar ───────────────────────────────────────────── */}
        <div className="mb-4 space-y-3">
          {/* Verdict filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'compelling', 'not_compelling', 'contested'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  filter === f
                    ? f === 'all'
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : f === 'compelling'
                        ? 'bg-emerald/20 border-emerald/50 text-emerald'
                        : f === 'not_compelling'
                          ? 'bg-against-500/20 border-against-500/50 text-against-300'
                          : 'bg-gold/20 border-gold/50 text-gold'
                    : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400'
                )}
              >
                {f === 'all' ? 'All verdicts' : verdictLabel(f)}
              </button>
            ))}

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ml-auto',
                showFilters || activeFilters.length > 0
                  ? 'bg-surface-200 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilters.length > 0 && (
                <span className="bg-for-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          {/* Extended filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 space-y-3">
                  {/* Side */}
                  <div>
                    <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-2">Side</p>
                    <div className="flex gap-2">
                      {(['all', 'for', 'against'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSide(s)}
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs border transition-all',
                            side === s
                              ? s === 'for'
                                ? 'bg-for-500/20 border-for-500/50 text-for-300'
                                : s === 'against'
                                  ? 'bg-against-500/20 border-against-500/50 text-against-300'
                                  : 'bg-surface-200 border-surface-500 text-white'
                              : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400',
                          )}
                        >
                          {s === 'all' ? 'All sides' : s === 'for' ? 'FOR' : 'AGAINST'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort */}
                  <div>
                    <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-2">Sort by</p>
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { value: 'recent', label: 'Most recent' },
                        { value: 'decisive', label: 'Most decisive' },
                        { value: 'contested', label: 'Closest call' },
                      ] as const).map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSort(s.value)}
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs border transition-all',
                            sort === s.value
                              ? 'bg-surface-200 border-surface-500 text-white'
                              : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400',
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-2">Category</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setCategory('')}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs border transition-all',
                          !category
                            ? 'bg-surface-200 border-surface-500 text-white'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400',
                        )}
                      >
                        All
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat === category ? '' : cat)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs border transition-all',
                            category === cat
                              ? 'bg-purple/20 border-purple/50 text-purple'
                              : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400',
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active filter chips */}
                  {activeFilters.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
                      <Filter className="h-3 w-3 text-surface-500 shrink-0" />
                      <div className="flex gap-1.5 flex-wrap flex-1">
                        {activeFilters.map((f) => (
                          <span
                            key={String(f)}
                            className="px-2 py-0.5 rounded bg-surface-200 text-[10px] text-surface-700 border border-surface-400"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setFilter('all')
                          setSide('all')
                          setSort('recent')
                          setCategory('')
                        }}
                        className="text-surface-500 hover:text-surface-700 transition-colors text-xs flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Content ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <VerdictSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={TrendingUp}
            title="Couldn't load verdicts"
            description="Something went wrong. Tap refresh to try again."
            action={
              <button
                onClick={() => fetchVerdicts(true)}
                className="px-4 py-2 rounded-lg bg-for-500 text-white text-sm font-medium hover:bg-for-600 transition-colors"
              >
                Retry
              </button>
            }
          />
        ) : verdicts.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No verdicts yet"
            description={
              activeFilters.length > 0
                ? 'No relay chains match your current filters. Try clearing them.'
                : 'No relay chains have been completed and voted on yet. Be the first to start one!'
            }
            action={
              <Link
                href="/relays/create"
                className="px-4 py-2 rounded-lg bg-for-500 text-white text-sm font-medium hover:bg-for-600 transition-colors inline-block"
              >
                Start a relay
              </Link>
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {verdicts.map((v, i) => (
                <VerdictCard key={v.relay_id} relay={v} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => fetchVerdicts(false)}
                  disabled={loadingMore}
                  className={cn(
                    'px-5 py-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-2',
                    'bg-surface-100 border-surface-300 text-surface-700',
                    'hover:border-surface-500 hover:text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Load more verdicts
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Footer note */}
            {!hasMore && verdicts.length > 0 && (
              <p className="text-center text-xs text-surface-500 mt-4">
                {verdicts.length} verdict{verdicts.length !== 1 ? 's' : ''} shown
                {activeFilters.length > 0 ? ' (filtered)' : ''}
              </p>
            )}
          </>
        )}

        {/* ── Related nav ───────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            { href: '/relays', label: 'Browse Relays', icon: GitMerge },
            { href: '/position-papers', label: 'Position Papers', icon: FileText },
            { href: '/relays/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
            { href: '/relays/stats', label: 'Platform Stats', icon: BarChart2 },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-300 bg-surface-100 text-sm text-surface-400 hover:text-white hover:border-surface-400 transition-all"
            >
              <link.icon className="h-4 w-4 text-surface-500" />
              {link.label}
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
