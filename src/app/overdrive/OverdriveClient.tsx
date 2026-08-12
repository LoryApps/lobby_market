'use client'

/**
 * /overdrive — Civic Overdrive
 *
 * Topics where the argument community has gone FAR deeper than the voter count
 * would predict. Ranked by arguments-per-voter ratio. These are the intellectual
 * black holes: debates where citizens write arguments instead of (or long after)
 * casting their vote.
 *
 * Distinct from:
 *   /argued    — raw recent argument velocity (last 24h count)
 *   /vortex    — argument intensity standalone page
 *   /battleground — contested vote splits
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  Loader2,
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverdriveTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  _overdrive_ratio: number
  _overdrive_args: number
}

interface OverdriveResponse {
  topics: OverdriveTopic[]
  hasMore: boolean
  total: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'all',
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
] as const

type SortMode = 'top' | 'new' | 'hot'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'top', label: 'Highest Ratio' },
  { id: 'hot', label: 'Most Votes' },
  { id: 'new', label: 'Newest' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

function getCategoryColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Intensity label ──────────────────────────────────────────────────────────

function intensityLabel(ratio: number): { label: string; color: string; bg: string; border: string } {
  if (ratio >= 1.0)  return { label: 'Singularity',  color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/40' }
  if (ratio >= 0.5)  return { label: 'Supergiant',   color: 'text-purple',  bg: 'bg-purple/10',  border: 'border-purple/40' }
  if (ratio >= 0.2)  return { label: 'Star',         color: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/40' }
  return              { label: 'Rising',              color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/40' }
}

// ─── OverdriveCard ────────────────────────────────────────────────────────────

function OverdriveCard({ topic, rank }: { topic: OverdriveTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const intensity = intensityLabel(topic._overdrive_ratio)
  const ratioDisplay = topic._overdrive_ratio >= 1
    ? `${topic._overdrive_ratio.toFixed(1)}×`
    : `${(topic._overdrive_ratio * 100).toFixed(0)}%`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300/70',
        'hover:border-purple/30 transition-colors',
        'flex flex-col gap-3 p-4'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 tabular-nums">
              #{rank}
            </span>
            {topic.category && (
              <span className={cn('text-[11px] font-mono uppercase tracking-wide', getCategoryColor(topic.category))}>
                {topic.category}
              </span>
            )}
            <Badge
              variant={
                topic.status === 'law' ? 'law'
                  : topic.status === 'voting' ? 'active'
                  : topic.status === 'active' ? 'active'
                  : 'proposed'
              }
            >
              {topic.status}
            </Badge>
          </div>

          <Link
            href={`/topic/${topic.id}`}
            className="block font-mono text-sm font-semibold text-white leading-snug hover:text-purple transition-colors line-clamp-3"
          >
            {topic.statement}
          </Link>
        </div>

        {/* Ratio badge */}
        <div className={cn(
          'flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border',
          intensity.bg, intensity.border
        )}>
          <BrainCircuit className={cn('h-3.5 w-3.5', intensity.color)} />
          <span className={cn('text-[11px] font-mono font-bold tabular-nums', intensity.color)}>
            {ratioDisplay}
          </span>
          <span className={cn('text-[9px] font-mono', intensity.color, 'opacity-70')}>
            {intensity.label}
          </span>
        </div>
      </div>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full rounded-full bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-surface-300/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" />
            {(topic.total_votes ?? 0).toLocaleString()} votes
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-purple/70">
            <MessageSquare className="h-3 w-3" />
            {(topic._overdrive_args ?? 0).toLocaleString()} args
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <span>
            {(topic._overdrive_ratio * 100).toFixed(0)} args / 100 voters
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-center justify-center gap-2 py-2 rounded-xl',
          'bg-purple/10 border border-purple/30',
          'hover:bg-purple/20 hover:border-purple/50 hover:text-purple',
          'text-xs font-mono text-purple/70 transition-colors'
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Read the arguments
      </Link>
    </motion.div>
  )
}

function OverdriveCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-16 w-14 rounded-xl flex-shrink-0" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OverdriveClient() {
  const [topics, setTopics] = useState<OverdriveTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('top')
  const [showFilters, setShowFilters] = useState(false)
  const offsetRef = useRef(0)
  const PAGE = 24

  const loadData = useCallback(async (reset: boolean) => {
    if (reset) {
      setLoading(true)
      setTopics([])
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }

    try {
      const qs = new URLSearchParams({
        limit: String(PAGE),
        offset: String(reset ? 0 : offsetRef.current),
        sort: sortMode,
      })

      const res = await globalThis.fetch(`/api/feed/overdrive?${qs.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch overdrive')
      const data: OverdriveResponse = await res.json()

      let filtered = data.topics
      if (category !== 'all') {
        filtered = filtered.filter(t => t.category === category)
      }

      if (reset) {
        setTopics(filtered)
      } else {
        setTopics(prev => [...prev, ...filtered])
      }
      setHasMore(data.hasMore)
      setTotal(data.total)
      offsetRef.current = (reset ? 0 : offsetRef.current) + data.topics.length
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortMode, category])

  useEffect(() => { loadData(true) }, [loadData])

  const avgRatio = topics.length > 0
    ? topics.reduce((s, t) => s + (t._overdrive_ratio ?? 0), 0) / topics.length
    : 0

  const topRatio = topics.length > 0
    ? Math.max(...topics.map(t => t._overdrive_ratio ?? 0))
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
                <BrainCircuit className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Overdrive
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Debates where arguments outpace votes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  showFilters
                    ? 'bg-purple/20 border-purple/40 text-purple'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-surface-200'
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-400 hover:text-surface-200 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-surface-400 font-mono leading-relaxed max-w-2xl">
            These debates have pulled citizens into deep intellectual engagement — more arguments
            per voter than anywhere else on the platform. The{' '}
            <span className="text-gold">Singularity</span> tier means more than one argument written
            per vote cast. A true black hole of civic discourse.
          </p>
        </div>

        {/* ── Stats bar ─────────────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
              <p className="text-xl font-mono font-bold text-purple tabular-nums">
                {total}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">overdrive debates</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
              <p className="text-xl font-mono font-bold text-gold tabular-nums">
                {topRatio >= 1
                  ? `${topRatio.toFixed(1)}×`
                  : `${(topRatio * 100).toFixed(0)}%`}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">peak ratio</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
              <p className="text-xl font-mono font-bold text-for-400 tabular-nums">
                {(avgRatio * 100).toFixed(0)}%
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">avg args/100 voters</p>
            </div>
          </motion.div>
        )}

        {/* ── Filters panel ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 space-y-4">
                {/* Sort */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-2">Sort</p>
                  <div className="flex gap-2 flex-wrap">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSortMode(opt.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                          sortMode === opt.id
                            ? 'bg-purple/20 border-purple/40 text-purple'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-surface-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-2">Category</p>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all capitalize',
                          category === cat
                            ? 'bg-purple/20 border-purple/40 text-purple'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-surface-200'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Intensity legend ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[
            { label: 'Rising', desc: '<20%', color: 'text-emerald', border: 'border-emerald/30', bg: 'bg-emerald/10' },
            { label: 'Star', desc: '20-50%', color: 'text-for-300', border: 'border-for-500/40', bg: 'bg-for-500/10' },
            { label: 'Supergiant', desc: '50-100%', color: 'text-purple', border: 'border-purple/40', bg: 'bg-purple/10' },
            { label: 'Singularity', desc: '100%+', color: 'text-gold', border: 'border-gold/40', bg: 'bg-gold/10' },
          ].map(tier => (
            <div
              key={tier.label}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono',
                tier.color, tier.border, tier.bg
              )}
            >
              <BrainCircuit className="h-3 w-3" />
              <span className="font-semibold">{tier.label}</span>
              <span className="opacity-60">{tier.desc}</span>
            </div>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <OverdriveCardSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={BrainCircuit}
            title="No overdrive debates yet"
            description="No debates have enough arguments relative to their votes yet. Start writing arguments — the intellectual black holes will surface as the community digs in."
            action={{ label: 'Browse all topics', href: '/topics' }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {topics.map((topic, i) => (
                  <OverdriveCard key={topic.id} topic={topic} rank={i + 1} />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => loadData(false)}
                  disabled={loadingMore}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm',
                    'bg-surface-200 border border-surface-300 text-surface-300',
                    'hover:bg-surface-300 hover:text-white transition-all disabled:opacity-50'
                  )}
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Footer nav ────────────────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-surface-300/40">
          <p className="text-[11px] font-mono text-surface-600 mb-3 uppercase tracking-widest">
            Related
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Most Argued', href: '/argued', color: 'text-purple/70 border-purple/30 hover:text-purple hover:border-purple/50' },
              { label: 'Battleground', href: '/battleground', color: 'text-for-400/70 border-for-500/30 hover:text-for-400 hover:border-for-500/50' },
              { label: 'Vortex', href: '/vortex', color: 'text-against-400/70 border-against-500/30 hover:text-against-400 hover:border-against-500/50' },
              { label: 'Pulse', href: '/pulse', color: 'text-gold/70 border-gold/30 hover:text-gold hover:border-gold/50' },
              { label: 'All Topics', href: '/topics', color: 'text-surface-400 border-surface-300/60 hover:text-surface-200 hover:border-surface-400' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all',
                  link.color
                )}
              >
                <ChevronRight className="h-3 w-3" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Back link ─────────────────────────────────────────────────────── */}
        <div className="mt-8 flex">
          <Link
            href="/"
            className="flex items-center gap-2 text-[11px] font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
