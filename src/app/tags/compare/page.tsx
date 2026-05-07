'use client'

/**
 * /tags/compare — Civic Tag Compare
 *
 * Side-by-side analysis of two civic tags. Shows:
 *   - Topic count, law count, vote totals, average vote split
 *   - Category distribution bar
 *   - Overlap count + shared topics list
 *   - Divergence score (how different the two tags are ideologically)
 *
 * URL: /tags/compare?a=climate&b=economy
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  GitCompare,
  Hash,
  Loader2,
  Scale,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TagCompareResponse,
  TagStat,
  SharedTopic,
} from '@/app/api/tags/compare/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-400',
  Philosophy:  'bg-for-300',
  Culture:     'bg-gold/70',
  Health:      'bg-against-300',
  Education:   'bg-emerald/70',
  Environment: 'bg-emerald',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Tag stat card ─────────────────────────────────────────────────────────────

function TagStatCard({
  stat,
  side,
}: {
  stat: TagStat
  side: 'a' | 'b'
}) {
  const forPct  = stat.avg_blue_pct
  const agPct   = 100 - forPct
  const accentBg   = side === 'a' ? 'bg-for-500/10'   : 'bg-against-500/10'
  const accentBdr  = side === 'a' ? 'border-for-500/30' : 'border-against-500/30'
  const accentText = side === 'a' ? 'text-for-300'    : 'text-against-300'
  const barFor     = side === 'a' ? 'bg-for-500'      : 'bg-against-500'

  return (
    <div className={cn('flex flex-col gap-4 p-4 rounded-xl border', accentBg, accentBdr)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className={cn('h-4 w-4 flex-shrink-0', accentText)} />
          <span className={cn('font-mono text-lg font-bold truncate', accentText)}>
            {stat.tag}
          </span>
        </div>
        <TagFollowButton tag={stat.tag} initialFollowing={stat.is_followed} size="sm" />
      </div>

      {/* Core stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 bg-surface-200/50 rounded-lg p-2.5">
          <span className="text-[11px] font-mono text-surface-500">Topics</span>
          <span className="text-lg font-mono font-bold text-white">
            {stat.topic_count.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-surface-200/50 rounded-lg p-2.5">
          <span className="text-[11px] font-mono text-surface-500">Laws</span>
          <span className="text-lg font-mono font-bold text-gold">
            {stat.law_count.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-surface-200/50 rounded-lg p-2.5">
          <span className="text-[11px] font-mono text-surface-500">Active now</span>
          <span className="text-lg font-mono font-bold text-emerald">
            {stat.active_count.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-surface-200/50 rounded-lg p-2.5">
          <span className="text-[11px] font-mono text-surface-500">Total votes</span>
          <span className="text-lg font-mono font-bold text-white">
            {stat.total_votes.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Vote split */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" />
            FOR {forPct}%
          </span>
          <span className="flex items-center gap-1 text-against-400">
            AGAINST {agPct}%
            <ThumbsDown className="h-3 w-3" />
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
          <div
            className={cn('h-full rounded-l-full transition-all', barFor)}
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full flex-1 bg-against-500 rounded-r-full"
          />
        </div>
        <p className="text-[10px] font-mono text-surface-500 text-center">
          avg vote split across all topics
        </p>
      </div>

      {/* Top categories */}
      {stat.top_categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
            Top categories
          </p>
          <div className="flex flex-col gap-1.5">
            {stat.top_categories.map(({ category, count }) => {
              const pct = stat.topic_count > 0
                ? Math.round((count / stat.topic_count) * 100)
                : 0
              return (
                <div key={category} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-1.5 rounded-full flex-1',
                      'bg-surface-300 overflow-hidden',
                    )}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        CATEGORY_COLOR[category] ?? 'bg-surface-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-surface-400 w-20 truncate text-right">
                    {category} {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared topic row ─────────────────────────────────────────────────────────

function SharedTopicRow({ topic }: { topic: SharedTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const agPct  = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl',
        'bg-surface-200/50 border border-surface-300/50',
        'hover:bg-surface-200 hover:border-surface-400/60',
        'transition-all duration-150 group',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-white group-hover:text-for-300 transition-colors leading-snug line-clamp-2">
          {topic.statement}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
            {topic.status === 'law' ? 'LAW' : topic.status}
          </Badge>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500">
              {topic.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500 ml-auto">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>
      </div>
      {/* Mini vote bar */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 w-14">
        <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
        <div className="w-full h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-against-400">{agPct}%</span>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0 mt-0.5" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CompareSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-surface-300 bg-surface-200/50">
          <Skeleton className="h-6 w-24" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-surface-300 bg-surface-200/50">
          <Skeleton className="h-6 w-24" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  )
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  label,
  value,
  onChange,
  accent,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  accent: 'for' | 'against'
}) {
  const accentBdr  = accent === 'for' ? 'border-for-500/40 focus-within:border-for-500/70'   : 'border-against-500/40 focus-within:border-against-500/70'
  const accentText = accent === 'for' ? 'text-for-400' : 'text-against-400'

  return (
    <div className={cn('flex items-center gap-2 bg-surface-200/60 rounded-xl border px-3 py-2 transition-colors', accentBdr)}>
      <Hash className={cn('h-4 w-4 flex-shrink-0', accentText)} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
        placeholder={label}
        className="flex-1 bg-transparent text-sm font-mono text-white placeholder-surface-500 outline-none"
        spellCheck={false}
        aria-label={`Tag ${label}`}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear"
          className="text-surface-500 hover:text-surface-300 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Overlap visualisation ────────────────────────────────────────────────────

function OverlapBar({
  data,
}: {
  data: TagCompareResponse
}) {
  const { overlap_count, tag_a, tag_b, overlap_pct_a, overlap_pct_b, divergence_score } = data

  const divergenceColor =
    divergence_score >= 70 ? 'text-against-400' :
    divergence_score >= 40 ? 'text-gold' :
    'text-emerald'

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-surface-300/60 bg-surface-200/40">
      {/* Overlap */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-mono text-surface-500">Topics with both tags</p>
          <p className="text-2xl font-mono font-bold text-white">
            {overlap_count.toLocaleString()}
          </p>
          <p className="text-[10px] font-mono text-surface-600">
            {overlap_pct_a}% of #{tag_a.tag} · {overlap_pct_b}% of #{tag_b.tag}
          </p>
        </div>

        {/* Divergence */}
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-xs font-mono text-surface-500">Ideological divergence</p>
          <p className={cn('text-2xl font-mono font-bold', divergenceColor)}>
            {divergence_score}
            <span className="text-sm font-normal text-surface-500">/100</span>
          </p>
          <p className="text-[10px] font-mono text-surface-600">
            {divergence_score >= 70 ? 'High' : divergence_score >= 40 ? 'Moderate' : 'Low'}
          </p>
        </div>
      </div>

      {/* Visual overlap strip */}
      <div className="relative h-6 rounded-full overflow-hidden flex">
        <div className="h-full bg-for-600/70" style={{ width: `${100 - overlap_pct_a}%` }} />
        <div className="h-full bg-emerald/70 flex-shrink-0" style={{ width: `${overlap_pct_a}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-for-600/70" />
          #{tag_a.tag} only
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald/70" />
          shared
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-against-600/70" />
          #{tag_b.tag} only
        </span>
      </div>
    </div>
  )
}

// ─── Popular comparison pairs ─────────────────────────────────────────────────

const POPULAR_PAIRS: { a: string; b: string }[] = [
  { a: 'climate', b: 'economy' },
  { a: 'healthcare', b: 'tax' },
  { a: 'immigration', b: 'labor' },
  { a: 'ai', b: 'privacy' },
  { a: 'housing', b: 'inequality' },
  { a: 'education', b: 'democracy' },
  { a: 'military', b: 'justice' },
  { a: 'energy', b: 'environment' },
]

// ─── Inner client (reads searchParams) ───────────────────────────────────────

function CompareInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tagA, setTagA] = useState(searchParams.get('a') ?? '')
  const [tagB, setTagB] = useState(searchParams.get('b') ?? '')
  const [data, setData] = useState<TagCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const runCompare = useCallback(async (a: string, b: string) => {
    const aTrim = a.trim()
    const bTrim = b.trim()
    if (!aTrim || !bTrim) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    // Update URL
    const params = new URLSearchParams({ a: aTrim, b: bTrim })
    router.replace(`/tags/compare?${params.toString()}`, { scroll: false })

    try {
      const res = await fetch(`/api/tags/compare?a=${encodeURIComponent(aTrim)}&b=${encodeURIComponent(bTrim)}`, {
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error('Failed to fetch comparison')
      const json = (await res.json()) as TagCompareResponse
      setData(json)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Could not load comparison data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  // Auto-run when both tags are at least 2 chars
  useEffect(() => {
    if (tagA.length >= 2 && tagB.length >= 2) {
      const timer = setTimeout(() => runCompare(tagA, tagB), 400)
      return () => clearTimeout(timer)
    }
  }, [tagA, tagB, runCompare])

  // Pre-fill from URL on mount
  useEffect(() => {
    const a = searchParams.get('a')
    const b = searchParams.get('b')
    if (a && b) {
      setTagA(a)
      setTagB(b)
      runCompare(a, b)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function swapTags() {
    setTagA(tagB)
    setTagB(tagA)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/tags" aria-label="Back to tags" className="text-surface-500 hover:text-surface-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-purple" />
            <h1 className="font-mono text-xl font-bold text-white">Tag Compare</h1>
          </div>
        </div>

        {/* Inputs */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1">
            <TagInput label="Tag A" value={tagA} onChange={setTagA} accent="for" />
          </div>
          <button
            onClick={swapTags}
            aria-label="Swap tags"
            className="flex-shrink-0 p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-surface-300 hover:bg-surface-300 transition-all"
          >
            <GitCompare className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <TagInput label="Tag B" value={tagB} onChange={setTagB} accent="against" />
          </div>
        </div>

        {/* Popular pairs */}
        {!data && !loading && (
          <div className="mb-6">
            <p className="text-xs font-mono text-surface-500 mb-2 uppercase tracking-wide">Popular comparisons</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_PAIRS.map(({ a, b }) => (
                <button
                  key={`${a}-${b}`}
                  onClick={() => {
                    setTagA(a)
                    setTagB(b)
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono',
                    'bg-surface-200/60 border border-surface-300/60 text-surface-400',
                    'hover:bg-surface-200 hover:border-surface-400 hover:text-surface-300',
                    'transition-all duration-150',
                  )}
                >
                  #{a}
                  <ArrowRight className="h-2.5 w-2.5 text-surface-600" />
                  #{b}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-2 mb-4 text-sm font-mono text-surface-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Comparing #{tagA} and #{tagB}…
              </div>
              <CompareSkeleton />
            </motion.div>
          )}

          {/* Error */}
          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-xl border border-against-500/30 bg-against-500/10 text-against-300 text-sm font-mono"
            >
              {error}
            </motion.div>
          )}

          {/* Results */}
          {!loading && data && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              {/* Side-by-side stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <TagStatCard stat={data.tag_a} side="a" />
                <TagStatCard stat={data.tag_b} side="b" />
              </div>

              {/* Overlap visualisation */}
              <OverlapBar data={data} />

              {/* Shared topics */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-surface-500" />
                    <h2 className="font-mono text-sm font-semibold text-white">
                      Topics in both tags
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-surface-500">
                    {data.overlap_count} total
                  </span>
                </div>

                {data.shared_topics.length === 0 ? (
                  <EmptyState
                    title="No shared topics"
                    description={`No topics have both #${data.tag_a.tag} and #${data.tag_b.tag} tags yet.`}
                    icon={Scale}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.shared_topics.map((topic) => (
                      <SharedTopicRow key={topic.id} topic={topic} />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick links */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wide">Explore</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/tags/${encodeURIComponent(data.tag_a.tag)}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl',
                      'bg-for-500/10 border border-for-500/30 text-for-300',
                      'hover:bg-for-500/20 hover:border-for-500/50',
                      'transition-all text-xs font-mono font-medium',
                    )}
                  >
                    <Hash className="h-3 w-3" />
                    All #{data.tag_a.tag} topics
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </Link>
                  <Link
                    href={`/tags/${encodeURIComponent(data.tag_b.tag)}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl',
                      'bg-against-500/10 border border-against-500/30 text-against-300',
                      'hover:bg-against-500/20 hover:border-against-500/50',
                      'transition-all text-xs font-mono font-medium',
                    )}
                  >
                    <Hash className="h-3 w-3" />
                    All #{data.tag_b.tag} topics
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt if both are empty */}
        {!loading && !data && !error && !(tagA.length >= 2 && tagB.length >= 2) && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <GitCompare className="h-10 w-10 text-surface-600" />
            <p className="font-mono text-surface-500 text-sm">
              Enter two tags above to compare them
            </p>
            <p className="text-[11px] font-mono text-surface-600">
              See how topics, vote splits, and categories differ between any two tags
            </p>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TagComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareInner />
    </Suspense>
  )
}
