'use client'

/**
 * /mandate — The Civic Mandate
 *
 * Shows every civic topic where the community has reached a clear democratic
 * mandate — ≥70% consensus FOR or AGAINST.  Topics are organised by mandate
 * strength:
 *   Overwhelming (≥85%) — Landslide agreement across the Lobby
 *   Strong       (≥75%) — Decisive majority opinion
 *   Clear        (≥70%) — Definite lean with meaningful dissent
 *
 * Blue mandates = community strongly FOR the proposal.
 * Red  mandates = community strongly AGAINST the proposal.
 *
 * Distinct from:
 *   /consensus   — D3 force-bubble chart of all vote distributions
 *   /polarization — measures how divided the platform is
 *   /spectrum    — 2D scatter of consensus vs engagement
 *   /trending    — popularity, not consensus strength
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MandateTopic, MandateResponse, MandateStrength, MandateSide } from '@/app/api/mandate/route'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STRENGTH_CONFIG: Record<MandateStrength, {
  label: string
  description: string
  forColor: string
  againstColor: string
  badge: string
}> = {
  overwhelming: {
    label: 'Overwhelming Mandate',
    description: '≥ 85% consensus — the Lobby has spoken decisively',
    forColor:     'bg-for-500/20 border-for-500/50 text-for-300',
    againstColor: 'bg-against-500/20 border-against-500/50 text-against-300',
    badge:        'bg-gold/20 text-gold border-gold/40',
  },
  strong: {
    label: 'Strong Mandate',
    description: '≥ 75% consensus — a decisive majority',
    forColor:     'bg-for-600/15 border-for-600/40 text-for-400',
    againstColor: 'bg-against-600/15 border-against-600/40 text-against-400',
    badge:        'bg-purple/20 text-purple border-purple/40',
  },
  clear: {
    label: 'Clear Mandate',
    description: '≥ 70% consensus — a definite lean',
    forColor:     'bg-for-700/10 border-for-700/30 text-for-400',
    againstColor: 'bg-against-700/10 border-against-700/30 text-against-400',
    badge:        'bg-surface-300/80 text-surface-600 border-surface-400/60',
  },
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  law:    Gavel,
  voting: Scale,
  active: Zap,
}

const STATUS_LABEL: Record<string, string> = {
  law:      'LAW',
  voting:   'VOTING',
  active:   'ACTIVE',
  proposed: 'PROPOSED',
}

const STATUS_COLOR: Record<string, string> = {
  law:      'bg-gold/20 text-gold border-gold/40',
  voting:   'bg-purple/20 text-purple border-purple/40',
  active:   'bg-for-500/20 text-for-300 border-for-500/40',
  proposed: 'bg-surface-300/60 text-surface-600 border-surface-400/40',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  accent?: 'blue' | 'red' | 'gold' | 'purple' | 'neutral'
}) {
  const colors: Record<string, string> = {
    blue:    'bg-for-500/10 border-for-500/30 text-for-300',
    red:     'bg-against-500/10 border-against-500/30 text-against-300',
    gold:    'bg-gold/10 border-gold/30 text-gold',
    purple:  'bg-purple/10 border-purple/30 text-purple',
    neutral: 'bg-surface-200/60 border-surface-300/60 text-surface-600',
  }
  return (
    <div className={cn('flex flex-col items-center px-4 py-2.5 rounded-xl border', colors[accent])}>
      <span className="text-xl font-mono font-bold">{value}</span>
      <span className="text-[11px] uppercase tracking-wide opacity-70 mt-0.5">{label}</span>
    </div>
  )
}

function MandateBar({ pct, side }: { pct: number; side: MandateSide }) {
  return (
    <div className="relative h-1.5 w-full bg-surface-300/40 rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', side === 'for' ? 'bg-for-500' : 'bg-against-500')}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

function TopicCard({ topic }: { topic: MandateTopic }) {
  const cfg = STRENGTH_CONFIG[topic.strength]
  const cardColor = topic.side === 'for' ? cfg.forColor : cfg.againstColor
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-xl border p-4 transition-all hover:border-opacity-80',
        cardColor,
      )}
    >
      <Link href={`/topic/${topic.id}`} className="block">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 flex-1">
            {topic.statement}
          </p>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity mt-0.5" />
        </div>

        {/* Mandate bar */}
        <MandateBar pct={topic.mandate_pct} side={topic.side} />

        {/* Stats row */}
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {topic.side === 'for' ? (
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
            )}
            <span className={cn(
              'text-sm font-mono font-bold',
              topic.side === 'for' ? 'text-for-300' : 'text-against-300',
            )}>
              {topic.mandate_pct.toFixed(1)}%{' '}
              <span className="text-xs font-normal opacity-70">
                {topic.side === 'for' ? 'FOR' : 'AGAINST'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Status badge */}
            <span className={cn(
              'flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border',
              STATUS_COLOR[topic.status] ?? STATUS_COLOR.active,
            )}>
              <StatusIcon className="h-2.5 w-2.5" />
              {STATUS_LABEL[topic.status] ?? topic.status.toUpperCase()}
            </span>

            {/* Category */}
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500 truncate max-w-[80px]">
                {topic.category}
              </span>
            )}

            {/* Vote count */}
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()}v
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function StrengthSection({
  strength,
  topics,
  defaultOpen,
}: {
  strength: MandateStrength
  topics: MandateTopic[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = STRENGTH_CONFIG[strength]

  if (topics.length === 0) return null

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 mb-3 group"
      >
        <div className="flex items-center gap-2.5">
          <span className={cn('text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border', cfg.badge)}>
            {cfg.label.toUpperCase()}
          </span>
          <span className="text-xs text-surface-500 hidden sm:block">{cfg.description}</span>
          <span className="text-xs font-mono text-surface-500">({topics.length})</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {topics.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MandateClient() {
  const [data, setData] = useState<MandateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [side, setSide] = useState<string>('all')
  const [sort, setSort] = useState<string>('strength')
  const [showFilters, setShowFilters] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (cat: string, s: string, srt: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ category: cat, side: s, sort: srt })
      const res = await fetch(`/api/mandate?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as MandateResponse
      if (!ctrl.signal.aborted) setData(json)
    } catch {
      if (!ctrl.signal.aborted) {
        setError('Could not load mandate data. Please try again.')
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(category, side, sort)
    return () => { abortRef.current?.abort() }
  }, [load, category, side, sort])

  // Partition topics by strength
  const overwhelming = data?.topics.filter((t) => t.strength === 'overwhelming') ?? []
  const strong       = data?.topics.filter((t) => t.strength === 'strong') ?? []
  const clear        = data?.topics.filter((t) => t.strength === 'clear') ?? []
  const total        = data?.topics.length ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/"
            className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:bg-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <Scale className="h-5 w-5 text-for-400 flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">The Civic Mandate</h1>
            </div>
            <p className="text-sm text-surface-500">
              Topics where the community has reached decisive consensus — 70% or more aligned.
            </p>
          </div>
          <button
            onClick={() => load(category, side, sort)}
            disabled={loading}
            className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-600', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Stats row ── */}
        {data && (
          <div className="flex flex-wrap gap-2.5 mb-6">
            <StatPill label="Mandates" value={data.stats.total_mandates} accent="neutral" />
            <StatPill label="FOR"      value={data.stats.for_mandates}   accent="blue" />
            <StatPill label="AGAINST"  value={data.stats.against_mandates} accent="red" />
            <StatPill label="Overwhelming" value={data.stats.overwhelming_count} accent="gold" />
            <StatPill label="Total Votes" value={data.stats.total_votes_in_mandates.toLocaleString()} accent="purple" />
          </div>
        )}

        {/* ── Filters ── */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-3"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3 mb-4"
              >
                {/* Side */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Direction</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'for', label: 'FOR Mandates' },
                      { id: 'against', label: 'AGAINST Mandates' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSide(opt.id)}
                        className={cn(
                          'text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all',
                          side === opt.id
                            ? opt.id === 'for'
                              ? 'bg-for-500/20 text-for-300 border-for-500/50'
                              : opt.id === 'against'
                                ? 'bg-against-500/20 text-against-300 border-against-500/50'
                                : 'bg-surface-300 text-white border-surface-400'
                            : 'bg-surface-200/40 text-surface-500 border-surface-300/40 hover:border-surface-400/60 hover:text-surface-600',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', ...CATEGORIES].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all',
                          category === cat
                            ? 'bg-surface-300 text-white border-surface-400'
                            : 'bg-surface-200/40 text-surface-500 border-surface-300/40 hover:border-surface-400/60 hover:text-surface-600',
                        )}
                      >
                        {cat === 'all' ? 'All' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-2">Sort By</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'strength', label: 'Strength', icon: BarChart2 },
                      { id: 'votes',    label: 'Most Voted', icon: TrendingUp },
                      { id: 'recent',   label: 'Recent', icon: Scale },
                    ].map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSort(opt.id)}
                          className={cn(
                            'flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all',
                            sort === opt.id
                              ? 'bg-surface-300 text-white border-surface-400'
                              : 'bg-surface-200/40 text-surface-500 border-surface-300/40 hover:border-surface-400/60 hover:text-surface-600',
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter pills */}
          {(category !== 'all' || side !== 'all') && (
            <div className="flex flex-wrap gap-1.5">
              {category !== 'all' && (
                <button
                  onClick={() => setCategory('all')}
                  className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-300/60 text-surface-600 border border-surface-400/40 hover:bg-surface-300 transition-colors"
                >
                  {category} ×
                </button>
              )}
              {side !== 'all' && (
                <button
                  onClick={() => setSide('all')}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border transition-colors',
                    side === 'for'
                      ? 'bg-for-500/20 text-for-300 border-for-500/40 hover:bg-for-500/30'
                      : 'bg-against-500/20 text-against-300 border-against-500/40 hover:bg-against-500/30',
                  )}
                >
                  {side === 'for' ? 'FOR' : 'AGAINST'} ×
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Loading state ── */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className="h-24 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error state ── */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Scale className="h-8 w-8 text-surface-400" />
            <p className="text-sm text-surface-500">{error}</p>
            <button
              onClick={() => load(category, side, sort)}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && total === 0 && (
          <EmptyState
            icon={Scale}
            title="No mandates found"
            description={
              category !== 'all' || side !== 'all'
                ? 'Try adjusting your filters to see more results.'
                : 'No topics have reached 70% consensus yet. Check back as more votes come in.'
            }
          />
        )}

        {/* ── Results ── */}
        {!loading && !error && total > 0 && (
          <>
            {/* Context note */}
            <p className="text-xs text-surface-500 mb-5 font-mono">
              {total} mandate{total !== 1 ? 's' : ''} found
              {category !== 'all' ? ` in ${category}` : ''}
              {side !== 'all' ? ` · ${side === 'for' ? 'FOR' : 'AGAINST'} mandates` : ''}
            </p>

            <StrengthSection strength="overwhelming" topics={overwhelming} defaultOpen />
            <StrengthSection strength="strong"       topics={strong}       defaultOpen />
            <StrengthSection strength="clear"        topics={clear}        defaultOpen={overwhelming.length === 0 && strong.length === 0} />
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
