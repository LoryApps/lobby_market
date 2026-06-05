'use client'

/**
 * /wellspring — The Civic Wellspring
 *
 * Reveals which topics have been the most generative sources of new debate —
 * root questions that spawned chains of follow-on proposals, each building on
 * the last. A wellspring topic doesn't just get voted on; it opens a door.
 *
 * The Wellspring Score = (direct_children × 3) + total_descendants + log10(votes+1)×5
 *
 * Distinct from:
 *   /cascade      — measures post-law activity surge across a whole category
 *   /inheritance  — the genealogy of LAWS spawning new debates (not voting chains)
 *   /chains       — shows the chain sequence for individual topics
 *   /pendulum     — tracks the vote-% arc of resolved topics
 *   /pivot        — per-topic momentum shifts, not generativity
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Droplets,
  ExternalLink,
  Gavel,
  GitBranch,
  GitMerge,
  Layers,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  TreePine,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { WellspringResponse, WellspringTopic, WellspringChild } from '@/app/api/wellspring/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

const CATEGORY_DOT: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-for-300',
  Philosophy:  'bg-purple',
  Culture:     'bg-against-400',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-gold',
}

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type SortMode = 'score' | 'children' | 'descendants' | 'votes'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'score',       label: 'Wellspring Score' },
  { id: 'children',    label: 'Direct Offshoots' },
  { id: 'descendants', label: 'Total Descendants' },
  { id: 'votes',       label: 'Most Voted' },
]

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function categoryClass(cat: string | null) {
  return cat
    ? (CATEGORY_COLORS[cat] ?? 'bg-surface-300 text-surface-400 border-surface-400')
    : 'bg-surface-300 text-surface-400 border-surface-400'
}

function statusColor(status: string): string {
  if (status === 'law')     return 'text-gold'
  if (status === 'voting')  return 'text-purple'
  if (status === 'active')  return 'text-for-400'
  if (status === 'failed')  return 'text-against-400'
  return 'text-surface-500'
}

function statusLabel(status: string): string {
  if (status === 'law')      return 'LAW'
  if (status === 'voting')   return 'VOTING'
  if (status === 'active')   return 'ACTIVE'
  if (status === 'proposed') return 'PROPOSED'
  if (status === 'failed')   return 'FAILED'
  return status.toUpperCase()
}

function scoreColor(score: number): string {
  if (score >= 20) return 'text-gold'
  if (score >= 12) return 'text-emerald'
  if (score >= 6)  return 'text-for-400'
  return 'text-surface-400'
}

// ─── Child branch chip ────────────────────────────────────────────────────────

function ChildChip({ child }: { child: WellspringChild }) {
  const forPct = Math.round(child.blue_pct)
  const isLaw = child.status === 'law'

  return (
    <Link
      href={`/topic/${child.id}`}
      className={cn(
        'group flex items-start gap-2 rounded-lg border p-2.5 transition-colors text-left',
        isLaw
          ? 'border-gold/20 bg-gold/5 hover:bg-gold/10'
          : 'border-surface-300/50 bg-surface-100/50 hover:bg-surface-200/50'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isLaw ? (
          <Gavel className="h-3.5 w-3.5 text-gold" />
        ) : (
          <GitBranch className="h-3.5 w-3.5 text-surface-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-mono text-surface-600 group-hover:text-white transition-colors line-clamp-2 leading-snug">
          {child.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-[10px] font-mono font-semibold', statusColor(child.status))}>
            {statusLabel(child.status)}
          </span>
          <span className="text-[10px] font-mono text-surface-600">
            {forPct}% FOR
          </span>
          {child.grandchildren > 0 && (
            <span className="text-[10px] font-mono text-purple flex items-center gap-0.5">
              <Layers className="h-2.5 w-2.5" />
              +{child.grandchildren}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Tree depth visualization ─────────────────────────────────────────────────

function DepthBar({ depth, directCount, descendants }: { depth: number; directCount: number; descendants: number }) {
  const maxDepth = Math.max(depth, 1)
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: Math.min(maxDepth, 5) }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 rounded-sm transition-all',
            i === 0
              ? 'w-4 bg-emerald/70'
              : i === 1
              ? 'w-3 bg-emerald/50'
              : i === 2
              ? 'w-2.5 bg-emerald/35'
              : 'w-2 bg-emerald/20'
          )}
        />
      ))}
      {maxDepth > 5 && (
        <span className="text-[10px] font-mono text-surface-500">+{maxDepth - 5}</span>
      )}
      <span className="text-[11px] font-mono text-surface-500 ml-1">
        {directCount} direct · {descendants} total
      </span>
    </div>
  )
}

// ─── Wellspring topic card ─────────────────────────────────────────────────────

function WellspringCard({
  topic,
  rank,
}: {
  topic: WellspringTopic
  rank: number
}) {
  const [expanded, setExpanded] = useState(false)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const rankColor =
    rank === 1 ? 'text-gold'
    : rank === 2 ? 'text-surface-400'
    : rank === 3 ? 'text-amber-600'
    : 'text-surface-600'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(rank - 1, 8) * 0.05 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className={cn('text-xl font-mono font-bold tabular-nums flex-shrink-0 w-7 pt-0.5', rankColor)}>
            #{rank}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {topic.category && (
                <span className={cn(
                  'text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border',
                  categoryClass(topic.category)
                )}>
                  {topic.category}
                </span>
              )}
              <span className={cn('text-[10px] font-mono font-semibold', statusColor(topic.status))}>
                {statusLabel(topic.status)}
              </span>
              {topic.law_descendants > 0 && (
                <span className="text-[10px] font-mono text-gold flex items-center gap-1">
                  <Gavel className="h-3 w-3" />
                  {topic.law_descendants} law{topic.law_descendants !== 1 ? 's' : ''} spawned
                </span>
              )}
            </div>

            <Link href={`/topic/${topic.id}`} className="group">
              <p className="text-sm font-mono font-medium text-white group-hover:text-for-300 transition-colors leading-relaxed">
                {topic.statement}
              </p>
            </Link>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {/* Wellspring score */}
              <div className="flex items-center gap-1.5">
                <Droplets className={cn('h-3.5 w-3.5', scoreColor(topic.wellspring_score))} />
                <span className={cn('text-sm font-mono font-bold', scoreColor(topic.wellspring_score))}>
                  {topic.wellspring_score.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-surface-600">score</span>
              </div>

              {/* Chain depth */}
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple" />
                <span className="text-sm font-mono font-bold text-purple">{topic.max_depth}</span>
                <span className="text-[10px] font-mono text-surface-600">
                  {topic.max_depth === 1 ? 'generation' : 'generations'}
                </span>
              </div>

              {/* Vote breakdown */}
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                <span className="text-sm font-mono font-bold text-for-400">{forPct}%</span>
                <span className="text-[10px] font-mono text-surface-600">/</span>
                <span className="text-sm font-mono font-bold text-against-400">{againstPct}%</span>
                <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                <span className="text-[10px] font-mono text-surface-600">
                  ({fmtVotes(topic.total_votes)} votes)
                </span>
              </div>
            </div>

            {/* Depth bar */}
            <div className="mt-3">
              <DepthBar
                depth={topic.max_depth}
                directCount={topic.direct_children}
                descendants={topic.total_descendants}
              />
            </div>

            {/* Vote bar */}
            <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <motion.div
                className="bg-for-500 h-full"
                initial={{ width: '50%' }}
                animate={{ width: `${forPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
              <motion.div
                className="bg-against-500 h-full"
                initial={{ width: '50%' }}
                animate={{ width: `${againstPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Action */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            {topic.top_children.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
                aria-label={expanded ? 'Collapse branches' : 'Expand branches'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded children */}
      <AnimatePresence>
        {expanded && topic.top_children.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-surface-300/50">
              <div className="flex items-center gap-2 pt-4 mb-3">
                <GitMerge className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  Top offshoots ({topic.direct_children} total)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {topic.top_children.map((child) => (
                  <ChildChip key={child.id} child={child} />
                ))}
              </div>
              {topic.direct_children > 3 && (
                <Link
                  href={`/topic/${topic.id}`}
                  className="mt-3 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  <span>View all {topic.direct_children} offshoots</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WellspringSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-6 w-7 rounded" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-14 rounded" />
              </div>
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-4/5 rounded" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function WellspringClient() {
  const [data, setData] = useState<WellspringResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const fetchedRef = useRef(false)

  const load = useCallback(async (cat: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const url = cat ? `/api/wellspring?category=${encodeURIComponent(cat)}` : '/api/wellspring'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as WellspringResponse
      setData(json)
    } catch {
      setError('Unable to load the wellspring data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      load(null)
    }
  }, [load])

  // Close sort menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleCategory(cat: string | null) {
    setSelectedCategory(cat)
    load(cat)
  }

  function sortedTopics(topics: WellspringTopic[]): WellspringTopic[] {
    return [...topics].sort((a, b) => {
      if (sortMode === 'children')    return b.direct_children - a.direct_children
      if (sortMode === 'descendants') return b.total_descendants - a.total_descendants
      if (sortMode === 'votes')       return b.total_votes - a.total_votes
      return b.wellspring_score - a.wellspring_score
    })
  }

  const topics = data ? sortedTopics(data.topics) : []
  const currentSortLabel = SORT_OPTIONS.find((o) => o.id === sortMode)?.label ?? 'Sort'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
              <Droplets className="h-6 w-6 text-emerald" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-white">The Civic Wellspring</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Topics that opened the floodgates — the most generative debates in the Lobby
              </p>
            </div>
          </div>

          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-3 gap-3 mt-5"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <div className="text-xl font-mono font-bold text-emerald">{data.total_with_chains}</div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">source debates</div>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <div className="text-xl font-mono font-bold text-purple">
                  {data.topics.reduce((s, t) => s + t.total_descendants, 0)}
                </div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">total offshoots</div>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <div className="text-xl font-mono font-bold text-gold">
                  {data.topics.reduce((s, t) => s + t.law_descendants, 0)}
                </div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">laws spawned</div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Explainer */}
        <div className="mb-6 rounded-xl bg-emerald/5 border border-emerald/20 p-4">
          <div className="flex items-start gap-3">
            <TreePine className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              A <strong className="text-emerald">wellspring</strong> is a topic that didn&apos;t just get voted on — it opened a door.
              When a debate resolves, it can spawn continuation proposals: &ldquo;…but what about X?&rdquo; or &ldquo;…and therefore Y?&rdquo;
              Wellspring topics are the ones that generated the richest chains of follow-on questions.
              The score weights direct offshoots heavily, then adds total descendants and vote volume.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Category pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              onClick={() => handleCategory(null)}
              className={cn(
                'text-[11px] font-mono px-3 py-1.5 rounded-full border transition-colors',
                selectedCategory === null
                  ? 'bg-emerald/20 text-emerald border-emerald/40'
                  : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400'
              )}
            >
              All
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategory(cat === selectedCategory ? null : cat)}
                className={cn(
                  'text-[11px] font-mono px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5',
                  selectedCategory === cat
                    ? cn(categoryClass(cat), 'opacity-100')
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full flex-shrink-0',
                    CATEGORY_DOT[cat] ?? 'bg-surface-500'
                  )}
                />
                {cat}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative flex-shrink-0" ref={sortRef}>
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className="flex items-center gap-2 text-[11px] font-mono text-surface-500 hover:text-white transition-colors bg-surface-100 border border-surface-300 px-3 py-1.5 rounded-lg"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{currentSortLabel}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setSortMode(opt.id); setShowSortMenu(false) }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-[11px] font-mono transition-colors flex items-center gap-2',
                        sortMode === opt.id
                          ? 'text-emerald bg-emerald/10'
                          : 'text-surface-500 hover:text-white hover:bg-surface-200'
                      )}
                    >
                      {sortMode === opt.id && <span className="h-1.5 w-1.5 rounded-full bg-emerald" />}
                      {sortMode !== opt.id && <span className="h-1.5 w-1.5 rounded-full bg-transparent" />}
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => load(selectedCategory)}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <WellspringSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => load(selectedCategory)}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Droplets}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No wellspring topics yet"
            description={
              selectedCategory
                ? `No ${selectedCategory} topics have spawned chain debates yet. Check back as the Lobby grows.`
                : 'No topics have spawned chain debates yet. The wellspring fills as the community debates.'
            }
            actions={[
              { label: 'View all topics', href: '/topics', variant: 'primary' },
              ...(selectedCategory
                ? [{ label: 'Clear filter', onClick: () => handleCategory(null), variant: 'secondary' as const }]
                : []),
            ]}
          />
        ) : (
          <div className="space-y-4">
            {topics.map((topic, i) => (
              <WellspringCard key={topic.id} topic={topic} rank={i + 1} />
            ))}

            {data && (
              <div className="pt-4 flex flex-col items-center gap-2">
                <p className="text-[11px] font-mono text-surface-600">
                  Showing {topics.length} of {data.total_with_chains} generative topics
                  {selectedCategory && ` in ${selectedCategory}`}
                </p>
                {selectedCategory && (
                  <button
                    onClick={() => handleCategory(null)}
                    className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear category filter
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer links */}
        {!loading && topics.length > 0 && (
          <div className="mt-10 pt-6 border-t border-surface-300/50">
            <p className="text-[11px] font-mono text-surface-600 mb-3">Explore related views</p>
            <div className="flex flex-wrap gap-2">
              {[
                { href: '/cascade',     label: 'Cascade', icon: TrendingUp,  desc: 'Post-law activity surge' },
                { href: '/inheritance', label: 'Inheritance', icon: GitMerge,   desc: 'Law genealogy' },
                { href: '/chains',      label: 'Chains',  icon: Layers,      desc: 'Topic chain sequences' },
                { href: '/pendulum',    label: 'Pendulum', icon: Sparkles,   desc: 'Vote arc history' },
              ].map(({ href, label, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 rounded-lg bg-surface-100 border border-surface-300 px-3 py-2 hover:border-surface-400 transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" />
                  <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
                    {label}
                  </span>
                  <span className="hidden sm:block text-[10px] font-mono text-surface-600">
                    — {desc}
                  </span>
                  <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-white transition-colors" />
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
