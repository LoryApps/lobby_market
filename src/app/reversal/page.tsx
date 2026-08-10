'use client'

/**
 * /reversal — The Civic Reversal
 *
 * Surfaces topics where the majority opinion has GENUINELY FLIPPED since
 * the debate began. Using vote-price history (snapshot every 20 votes),
 * we find debates where the community started on one side of 50% and
 * has crossed to the other — a true democratic mind-change.
 *
 * Two panels:
 *   Flipped FOR     — Started majority AGAINST, now majority FOR
 *   Flipped AGAINST — Started majority FOR, now majority AGAINST
 *
 * Distinct from:
 *   /shifting      — real-time 24h opinion movement (not a cross-50% flip)
 *   /momentum      — direction of recent votes (not historical crossing)
 *   /divergence    — week-over-week oscillation (not all-time crossing)
 *   /groundswell   — dormant topics waking up (not about the 50% crossing)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Filter,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ReversalTopic, ReversalResponse } from '@/app/api/reversal/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS = [
  { id: 'swing',  label: 'Biggest Swing' },
  { id: 'votes',  label: 'Most Voted' },
  { id: 'recent', label: 'Newest' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed',  color: 'text-surface-500' },
  active:   { label: 'Active',    color: 'text-for-400' },
  voting:   { label: 'Voting',    color: 'text-purple' },
  law:      { label: 'LAW',       color: 'text-gold' },
  failed:   { label: 'Failed',    color: 'text-against-400' },
}

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

// ─── Swing bar ────────────────────────────────────────────────────────────────

function SwingBar({ initial, current, direction }: {
  initial: number
  current: number
  direction: 'flipped_for' | 'flipped_against'
}) {
  const isFlippedFor = direction === 'flipped_for'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-mono text-surface-500">
        <span>Original</span>
        <span>Now</span>
      </div>
      <div className="relative h-5 rounded-full bg-surface-300 overflow-hidden">
        {/* Original marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-surface-500/70 z-10"
          style={{ left: `${initial}%` }}
        />
        {/* Current fill */}
        <div
          className={cn(
            'absolute top-0 bottom-0 left-0 transition-all duration-700',
            isFlippedFor ? 'bg-for-500/60' : 'bg-against-500/60'
          )}
          style={{ width: `${current}%` }}
        />
        {/* 50% line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20 z-20" />
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className={isFlippedFor ? 'text-against-400' : 'text-for-400'}>
          {isFlippedFor ? `Started ${initial.toFixed(0)}% AGAINST` : `Started ${initial.toFixed(0)}% FOR`}
        </span>
        <span className={isFlippedFor ? 'text-for-400' : 'text-against-400'}>
          {isFlippedFor ? `Now ${current.toFixed(0)}% FOR` : `Now ${current.toFixed(0)}% AGAINST`}
        </span>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function ReversalCard({ topic }: { topic: ReversalTopic }) {
  const isFlippedFor = topic.direction === 'flipped_for'
  const catStyle = getCatStyle(topic.category)
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border overflow-hidden',
        isFlippedFor
          ? 'border-for-500/25'
          : 'border-against-500/25'
      )}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          {/* Direction icon */}
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
            isFlippedFor
              ? 'bg-for-500/10 border-for-500/30 text-for-400'
              : 'bg-against-500/10 border-against-500/30 text-against-400'
          )}>
            {isFlippedFor
              ? <TrendingUp className="h-5 w-5" />
              : <TrendingDown className="h-5 w-5" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Swing badge */}
              <span className={cn(
                'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                isFlippedFor
                  ? 'bg-for-500/10 border-for-500/30 text-for-300'
                  : 'bg-against-500/10 border-against-500/30 text-against-300'
              )}>
                {isFlippedFor ? '↑' : '↓'} {topic.price_swing.toFixed(1)}pp swing
              </span>
              {topic.category && (
                <span className={cn(
                  'text-xs font-mono px-2 py-0.5 rounded-full border',
                  catStyle.text, catStyle.bg, catStyle.border
                )}>
                  {topic.category}
                </span>
              )}
              <span className={cn('text-xs font-mono', statusCfg.color)}>
                {statusCfg.label}
              </span>
            </div>
            <Link
              href={`/topic/${topic.id}`}
              className="text-sm font-mono font-semibold text-white leading-snug hover:text-for-400 transition-colors line-clamp-2 block"
            >
              {topic.statement}
            </Link>
          </div>
        </div>

        {/* ── Swing visualization ── */}
        <SwingBar
          initial={topic.initial_price}
          current={topic.current_price}
          direction={topic.direction}
        />

        {/* ── Stats row ── */}
        <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-for-400" />
            {topic.total_votes.toLocaleString()} votes
          </span>
          <span className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            {topic.snapshots_count} snapshots
          </span>
          <span className="ml-auto">{relativeTime(topic.created_at)}</span>
        </div>

        {/* ── Link ── */}
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center justify-between text-xs font-mono text-surface-500 hover:text-white transition-colors pt-1 border-t border-surface-300/50"
        >
          <span>See full debate history</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

function ReversalSection({
  title,
  subtitle,
  topics,
  loading,
  icon: Icon,
  accentClass,
  emptyTitle,
  emptyDesc,
}: {
  title: string
  subtitle: string
  topics: ReversalTopic[]
  loading: boolean
  icon: React.ComponentType<{ className?: string }>
  accentClass: string
  emptyTitle: string
  emptyDesc: string
}) {
  return (
    <section>
      {/* Section header */}
      <div className={cn('flex items-center gap-2 mb-3')}>
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', accentClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-mono font-bold text-white">{title}</h2>
          <p className="text-xs font-mono text-surface-500">{subtitle}</p>
        </div>
        {!loading && (
          <span className="ml-auto text-xs font-mono text-surface-600">
            {topics.length} topic{topics.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title={emptyTitle}
          description={emptyDesc}
          className="py-10"
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {topics.map((t) => (
              <ReversalCard key={t.id} topic={t} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReversalPage() {
  const [data, setData] = useState<ReversalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<string>('')
  const [sort, setSort] = useState<SortOption>('swing')
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'flipped_for' | 'flipped_against'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      params.set('sort', sort)
      const res = await fetch(`/api/reversal?${params}`)
      if (!res.ok) throw new Error('Failed to load reversals')
      setData(await res.json() as ReversalResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  const flippedFor     = data?.flipped_for     ?? []
  const flippedAgainst = data?.flipped_against ?? []
  const total          = data?.total           ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Hero ── */}
        <div className="mb-6">
          <Link
            href="/discover"
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white mb-4 transition-colors w-fit"
          >
            <ArrowLeft className="h-3 w-3" />
            Discover
          </Link>
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-2xl bg-purple/10 border border-purple/30 text-purple">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-black text-white tracking-tight">
                The Civic Reversal
              </h1>
              <p className="text-sm font-mono text-surface-400 mt-0.5">
                Debates where the community genuinely changed its collective mind.
              </p>
            </div>
          </div>

          {/* Explainer */}
          <div className="rounded-xl bg-purple/5 border border-purple/20 p-4">
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              A reversal happens when a debate that started with a majority FOR crosses to majority AGAINST — or vice versa.
              These are the rarest civic moments: the community actually changed its mind as new arguments emerged.
              {total > 0 && (
                <span className="text-purple font-semibold"> {total} reversal{total !== 1 ? 's' : ''} detected.</span>
              )}
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Tab buttons */}
          <div className="flex gap-1 bg-surface-200 rounded-lg p-1">
            {(['all', 'flipped_for', 'flipped_against'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-2.5 py-1 text-xs font-mono rounded-md transition-colors',
                  activeTab === tab
                    ? 'bg-surface-50 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {tab === 'all' ? 'All' : tab === 'flipped_for' ? '↑ Turned FOR' : '↓ Turned AGAINST'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs font-mono bg-surface-200 border border-surface-300 rounded-lg text-white focus:outline-none focus:border-for-500/60 cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-surface-500 pointer-events-none" />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border',
              showFilters || category
                ? 'bg-for-500/15 border-for-500/40 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
            )}
          >
            <Filter className="h-3 w-3" />
            {category || 'Filter'}
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Filter panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="bg-surface-100 border border-surface-300 rounded-xl p-3">
                <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-2">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategory('')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-mono rounded-full border transition-colors',
                      !category
                        ? 'bg-for-500/20 border-for-500/50 text-for-300'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => {
                    const cs = getCatStyle(cat)
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategory(category === cat ? '' : cat)}
                        className={cn(
                          'px-2.5 py-1 text-xs font-mono rounded-full border transition-colors',
                          category === cat
                            ? cn(cs.text, cs.bg, cs.border)
                            : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                        )}
                      >
                        {cat}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-xs font-mono text-against-300">
            {error} — <button onClick={load} className="underline hover:text-white">retry</button>
          </div>
        )}

        {/* ── Content ── */}
        <div className="space-y-8">
          {/* Flipped FOR section */}
          {(activeTab === 'all' || activeTab === 'flipped_for') && (
            <ReversalSection
              title="Turned FOR"
              subtitle="Started AGAINST majority, now FOR majority"
              topics={flippedFor}
              loading={loading}
              icon={TrendingUp}
              accentClass="bg-for-500/15 border border-for-500/30 text-for-400"
              emptyTitle="No FOR reversals yet"
              emptyDesc="No topics have flipped from majority AGAINST to majority FOR with the current filter settings."
            />
          )}

          {/* Flipped AGAINST section */}
          {(activeTab === 'all' || activeTab === 'flipped_against') && (
            <ReversalSection
              title="Turned AGAINST"
              subtitle="Started FOR majority, now AGAINST majority"
              topics={flippedAgainst}
              loading={loading}
              icon={TrendingDown}
              accentClass="bg-against-500/15 border border-against-500/30 text-against-400"
              emptyTitle="No AGAINST reversals yet"
              emptyDesc="No topics have flipped from majority FOR to majority AGAINST with the current filter settings."
            />
          )}
        </div>

        {/* ── Related links ── */}
        {!loading && (
          <div className="mt-10 pt-8 border-t border-surface-300">
            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-3">Related views</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { href: '/shifting',    label: 'Shifting Tides',  desc: 'Moving right now' },
                { href: '/momentum',    label: 'Momentum',        desc: 'Rate of change' },
                { href: '/groundswell', label: 'Groundswell',     desc: 'Dormant waking up' },
                { href: '/convergence', label: 'Convergence',     desc: 'Approaching consensus' },
                { href: '/divergence',  label: 'Divergence',      desc: 'Opinion oscillation' },
                { href: '/swing',       label: 'Swing',           desc: '7d comparison' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
                >
                  <span className="text-xs font-mono font-semibold text-white group-hover:text-for-400 transition-colors">
                    {link.label}
                  </span>
                  <span className="text-[10px] font-mono text-surface-500 mt-0.5">{link.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
