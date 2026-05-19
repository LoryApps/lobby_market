'use client'

/**
 * /inheritance — The Civic Inheritance
 *
 * Shows how each established law in the Codex has generated follow-on debates
 * in the same policy area. When the community establishes consensus on a topic,
 * it rarely ends the conversation — it opens new questions. This feature makes
 * that legislative genealogy visible.
 *
 * Distinct from:
 *   /law/graph    — node graph of law-to-law citation links
 *   /chains       — topic-to-topic debate chains (arguments, not laws)
 *   /tensions     — pairs of laws pulling in opposite directions
 *   /convergence  — opinion momentum on individual topics
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Filter,
  Gavel,
  GitBranch,
  Network,
  RefreshCw,
  Scale,
  Sparkles,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  InheritanceLaw,
  InheritanceCategory,
  InheritanceResponse,
  DescendantTopic,
} from '@/app/api/inheritance/route'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
  active:   { label: 'Active',   color: 'text-for-400',    bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  voting:   { label: 'Voting',   color: 'text-purple',     bg: 'bg-purple/10',         border: 'border-purple/30' },
  law:      { label: 'LAW',      color: 'text-gold',       bg: 'bg-gold/10',           border: 'border-gold/30' },
  failed:   { label: 'Failed',   color: 'text-surface-600',bg: 'bg-surface-300/20',   border: 'border-surface-400/20' },
}

const SORT_OPTIONS = [
  { id: 'generativity', label: 'Most Generative' },
  { id: 'descendants',  label: 'Most Descendants' },
  { id: 'law_chains',   label: 'Most Law Chains' },
  { id: 'recent',       label: 'Most Recent' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['id']

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function LawCardSkeleton({ i }: { i: number }) {
  return (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-24 mb-2 rounded" />
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-3/4 rounded mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((j) => (
          <Skeleton key={j} className="h-14 flex-1 rounded-xl" />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Descendant Chip ──────────────────────────────────────────────────────────

function DescendantChip({ d }: { d: DescendantTopic }) {
  const status = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(d.blue_pct)

  return (
    <Link
      href={d.became_law && d.law_id ? `/law/${d.law_id}` : `/topic/${d.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-all hover:border-surface-400 hover:bg-surface-200/80 group',
        d.became_law
          ? 'border-gold/40 bg-gold/5'
          : 'border-surface-300 bg-surface-200/50'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          {d.became_law ? (
            <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" />
          ) : (
            <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          )}
          <span className={cn('text-[10px] font-mono font-semibold', status.color)}>
            {status.label}
          </span>
        </div>
        <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
          +{d.days_after}d
        </span>
      </div>
      <p className="text-[11px] font-mono text-surface-300 leading-snug line-clamp-2 mb-1.5 group-hover:text-white transition-colors">
        {d.statement}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden bg-surface-300 flex">
          <div
            className="h-full bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-against-600 transition-all"
            style={{ width: `${100 - forPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
          {d.total_votes.toLocaleString()}v
        </span>
      </div>
    </Link>
  )
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

function LawCard({
  law,
  index,
}: {
  law: InheritanceLaw
  index: number
}) {
  const [expanded, setExpanded] = useState(index < 3)
  const catColor = CATEGORY_COLORS[law.category ?? ''] ?? 'bg-surface-300/30 text-surface-500 border-surface-400/30'
  const catDot   = CATEGORY_DOT[law.category ?? '']   ?? 'bg-surface-500'
  const forPct   = Math.round(law.blue_pct ?? 50)

  const tier =
    law.law_descendants >= 3 ? 'legendary' :
    law.law_descendants >= 2 ? 'high'       :
    law.descendants.length >= 5 ? 'medium'  :
    'base'

  const tierConfig = {
    legendary: { label: 'Landmark',  color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/30' },
    high:      { label: 'Generative', color: 'text-purple',  bg: 'bg-purple/10',  border: 'border-purple/30' },
    medium:    { label: 'Fertile',    color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
    base:      { label: 'Active',     color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  }[tier]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border transition-all',
        tier === 'legendary'
          ? 'bg-gold/5 border-gold/30'
          : tier === 'high'
          ? 'bg-purple/5 border-purple/20'
          : 'bg-surface-100 border-surface-300'
      )}
    >
      {/* Law header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Rank / icon */}
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0 mt-0.5',
              tier === 'legendary'
                ? 'bg-gold/15 border-gold/40'
                : tier === 'high'
                ? 'bg-purple/15 border-purple/40'
                : 'bg-for-500/10 border-for-500/30'
            )}
          >
            <Gavel
              className={cn(
                'h-4 w-4',
                tier === 'legendary' ? 'text-gold' : tier === 'high' ? 'text-purple' : 'text-for-400'
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-1.5 mb-2">
              {law.category && (
                <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border', catColor)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', catDot)} />
                  {law.category}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border',
                  tierConfig.color, tierConfig.bg, tierConfig.border
                )}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {tierConfig.label}
              </span>
              <span className="text-[10px] font-mono text-surface-600">
                {formatDate(law.established_at)}
              </span>
            </div>

            {/* Statement */}
            <Link
              href={`/law/${law.id}`}
              className="block font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug mb-3"
            >
              {law.statement}
            </Link>

            {/* Stats row */}
            <div className="flex items-center flex-wrap gap-3">
              {/* Vote bar */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-surface-300">
                  <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
                  <div className="h-full bg-against-600" style={{ width: `${100 - forPct}%` }} />
                </div>
                <span className="text-[10px] font-mono text-surface-500">
                  {forPct}% For · {(law.total_votes ?? 0).toLocaleString()} votes
                </span>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {law.descendants.length} debate{law.descendants.length !== 1 ? 's' : ''} spawned
                </span>
                {law.law_descendants > 0 && (
                  <span className="flex items-center gap-1 text-gold">
                    <Gavel className="h-3 w-3" />
                    {law.law_descendants} became law{law.law_descendants !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label={expanded ? 'Collapse descendants' : 'Show descendants'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Descendants */}
      <AnimatePresence>
        {expanded && law.descendants.length > 0 && (
          <motion.div
            key="descendants"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-surface-300/50 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  Spawned debates · within 120 days
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {law.descendants.map((d) => (
                  <DescendantChip key={d.id} d={d} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

function CategoryBar({ categories }: { categories: InheritanceCategory[] }) {
  const max = Math.max(...categories.map((c) => c.descendant_count), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-4 w-4 text-surface-500" />
        <h2 className="text-sm font-mono font-semibold text-white">Category fertility</h2>
      </div>
      <div className="space-y-2.5">
        {categories.slice(0, 8).map((cat) => {
          const pct = Math.round((cat.descendant_count / max) * 100)
          const color = CATEGORY_DOT[cat.category] ?? 'bg-surface-500'
          const textColor = CATEGORY_COLORS[cat.category]?.split(' ')[1] ?? 'text-surface-400'
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', color)} />
                  <span className={cn('text-[11px] font-mono', textColor)}>{cat.category}</span>
                </div>
                <span className="text-[10px] font-mono text-surface-600">
                  {cat.descendant_count} debate{cat.descendant_count !== 1 ? 's' : ''}
                  {cat.law_chain_count > 0 && (
                    <span className="text-gold ml-1.5">· {cat.law_chain_count} law{cat.law_chain_count !== 1 ? 's' : ''}</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', color, 'opacity-70')}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InheritanceClient() {
  const [data, setData]             = useState<InheritanceResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [category, setCategory]     = useState<string | null>(null)
  const [sort, setSort]             = useState<SortKey>('generativity')
  const [showFilters, setShowFilters] = useState(false)
  const abortRef                    = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      params.set('sort', sort)
      const res = await fetch(`/api/inheritance?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json() as InheritanceResponse
      if (!ctrl.signal.aborted) setData(json)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Failed to load inheritance data.')
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Network className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl md:text-3xl font-bold text-white leading-tight">
                Civic Inheritance
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed max-w-xl">
                Laws don&apos;t end conversations — they start new ones.
                Each established law often sparks follow-on debates in the same policy area.
                This is the living genealogy of Lobby consensus.
              </p>
            </div>
          </div>

          {/* ── Hero stats ──────────────────────────────────────────────── */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-3 mb-5"
            >
              {[
                { label: 'Laws with descendants', value: data.totals.laws, color: 'text-for-400' },
                { label: 'Debates spawned',        value: data.totals.descendants, color: 'text-emerald' },
                { label: 'Law chains formed',      value: data.totals.law_chains,  color: 'text-gold' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center"
                >
                  <p className={cn('font-mono text-2xl font-bold', s.color)}>
                    {s.value.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}
          {loading && !data && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center">
                  <Skeleton className="h-8 w-16 mx-auto mb-1.5" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                </div>
              ))}
            </div>
          )}

          {/* ── Filter / sort row ─────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters((f) => !f)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                  'text-xs font-mono border transition-colors',
                  showFilters
                    ? 'bg-for-600/80 border-for-600/60 text-white'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                {category ?? 'All categories'}
                {category && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCategory(null) }}
                    className="ml-0.5 rounded hover:bg-white/10 transition-colors"
                    aria-label="Clear category filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
            </div>

            {/* Sort pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    'text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-colors',
                    sort === opt.id
                      ? 'bg-for-600/80 border-for-600/60 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {!loading && (
                <button
                  onClick={load}
                  className="p-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category filter dropdown */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                key="cat-filter"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 pt-3">
                  {CATEGORIES.map((cat) => {
                    const cc = CATEGORY_COLORS[cat] ?? ''
                    return (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat === category ? null : cat); setShowFilters(false) }}
                        className={cn(
                          'text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors',
                          cat === category ? cc : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                        )}
                      >
                        {cat}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">

          {/* Left: law list */}
          <div className="space-y-4 min-w-0">
            {loading && !data && (
              <>
                {[0, 1, 2, 3, 4].map((i) => <LawCardSkeleton key={i} i={i} />)}
              </>
            )}

            {error && !loading && (
              <EmptyState
                icon={Scale}
                title="Could not load inheritance data"
                description={error}
                action={{ label: 'Try again', onClick: load }}
              />
            )}

            {!loading && data && data.laws.length === 0 && (
              <EmptyState
                icon={Network}
                title="No inheritance data yet"
                description={
                  category
                    ? `No ${category} laws have spawned follow-on debates yet.`
                    : 'As more laws are established and new debates emerge in the same categories, inheritance chains will appear here.'
                }
              />
            )}

            {data?.laws.map((law, i) => (
              <LawCard key={law.id} law={law} index={i} />
            ))}
          </div>

          {/* Right: sidebar */}
          <div className="space-y-5">

            {/* Category bar */}
            {loading && !data ? (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <Skeleton className="h-4 w-28 mb-4" />
                <div className="space-y-3">
                  {[0,1,2,3,4].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ) : data?.categories && data.categories.length > 0 ? (
              <CategoryBar categories={data.categories} />
            ) : null}

            {/* Legend */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Generativity tiers
              </h3>
              <div className="space-y-2.5">
                {[
                  { tier: 'Landmark',   color: 'text-gold',    desc: '3+ descended laws' },
                  { tier: 'Generative', color: 'text-purple',  desc: '2 descended laws' },
                  { tier: 'Fertile',    color: 'text-emerald', desc: '5+ descended debates' },
                  { tier: 'Active',     color: 'text-for-400', desc: 'Has spawned debates' },
                ].map(({ tier, color, desc }) => (
                  <div key={tier} className="flex items-center gap-2">
                    <Sparkles className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                    <div>
                      <span className={cn('text-xs font-mono font-semibold', color)}>{tier}</span>
                      <span className="text-[10px] font-mono text-surface-600 ml-1.5">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explain */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                How it works
              </h3>
              <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                A topic is counted as &ldquo;descended&rdquo; from a law if it was proposed
                in the same category within 120 days of the law being established.
              </p>
              <p className="text-[11px] font-mono text-surface-600 leading-relaxed mt-2">
                When a descended topic itself becomes a law, it forms a &ldquo;law chain&rdquo; —
                showing how civic consensus in one area generates new consensus in related questions.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/law"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  <Gavel className="h-3 w-3" />
                  Browse the Codex
                </Link>
                <span className="text-surface-600">·</span>
                <Link
                  href="/tensions"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Scale className="h-3 w-3" />
                  Law tensions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
