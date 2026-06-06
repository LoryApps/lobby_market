'use client'

/**
 * /synthesis — Civic Synthesis Hub
 *
 * Browse all AI-generated topic syntheses. Each synthesis has three sections:
 *   • Common Ground — values both FOR and AGAINST sides actually share
 *   • Core Tensions — the fundamental value conflict making debate hard
 *   • Synthesis — a nuanced position acknowledging both sets of concerns
 *
 * Distinct from:
 *   /steelman   — generates strongest argument for each side (advocacy)
 *   /polarization — measures how divided the platform is (quantitative)
 *   /convergence — tracks whether opinion is narrowing over time
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  GitMerge,
  Handshake,
  Loader2,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Swords,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SynthesisEntry, SynthesisListResponse } from '@/app/api/synthesis/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

function catColor(cat: string | null) {
  if (!cat) return { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
}

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'recent' | 'votes' | 'deadlock'

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent',   label: 'Most Recent' },
  { key: 'votes',    label: 'Most Voted' },
  { key: 'deadlock', label: 'Most Divided' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(text: string, maxLen = 130): string {
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, 'proposed' | 'active' | 'voting' | 'law' | 'failed' | 'default'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'voting',
  law:      'law',
  failed:   'failed',
}

// ─── Synthesis card ───────────────────────────────────────────────────────────

function SynthesisCard({ entry, index }: { entry: SynthesisEntry; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const forPct = Math.round(entry.blue_pct)
  const againstPct = 100 - forPct
  const { text, bg, border } = catColor(entry.category)
  const contestedness = Math.abs(forPct - 50)
  const isDivided = contestedness <= 12 // within 12pp of 50/50

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden hover:border-surface-400 transition-colors"
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5 p-2 rounded-xl bg-purple/10 border border-purple/20">
            <GitMerge className="h-3.5 w-3.5 text-purple" />
          </div>

          {/* Topic info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {entry.category && (
                <span className={cn(
                  'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                  bg, border, text
                )}>
                  {entry.category}
                </span>
              )}
              <Badge
                variant={(STATUS_MAP[entry.status] ?? 'default') as Parameters<typeof Badge>[0]['variant']}
                className="text-[10px]"
              >
                {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
              </Badge>
              {isDivided && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-against-400 px-2 py-0.5 rounded-full bg-against-500/10 border border-against-500/20">
                  <Zap className="h-2.5 w-2.5" />
                  Divided
                </span>
              )}
            </div>

            <Link
              href={`/topic/${entry.topic_id}/synthesis`}
              className="block font-mono text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-2"
            >
              {entry.statement}
            </Link>
          </div>
        </div>

        {/* Vote bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1 text-for-400">
              <ThumbsUp className="h-2.5 w-2.5" />
              FOR {forPct}%
            </span>
            <span className="text-surface-500">
              {entry.total_votes.toLocaleString()} votes
            </span>
            <span className="flex items-center gap-1 text-against-400">
              AGAINST {againstPct}%
              <ThumbsDown className="h-2.5 w-2.5" />
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Synthesis sections */}
      <div className="px-5 pb-5 space-y-3">
        {/* Common ground */}
        <div className="rounded-xl bg-emerald/5 border border-emerald/20 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Handshake className="h-3 w-3 text-emerald flex-shrink-0" />
            <span className="text-[9px] font-mono font-bold text-emerald uppercase tracking-wider">
              Common Ground
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
            {expanded ? entry.common_ground : truncate(entry.common_ground)}
          </p>
        </div>

        {/* Core tensions */}
        <div className="rounded-xl bg-against-500/5 border border-against-500/20 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Swords className="h-3 w-3 text-against-400 flex-shrink-0" />
            <span className="text-[9px] font-mono font-bold text-against-400 uppercase tracking-wider">
              Core Tensions
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
            {expanded ? entry.tensions : truncate(entry.tensions)}
          </p>
        </div>

        {/* Synthesis */}
        <div className="rounded-xl bg-purple/5 border border-purple/20 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Scale className="h-3 w-3 text-purple flex-shrink-0" />
            <span className="text-[9px] font-mono font-bold text-purple uppercase tracking-wider">
              Synthesis
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
            {expanded ? entry.synthesis : truncate(entry.synthesis, 160)}
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? 'Show less' : 'Read full synthesis'}
            </button>
            <span className="text-[10px] font-mono text-surface-600">
              {entry.argument_count} arg{entry.argument_count !== 1 ? 's' : ''} · {relativeTime(entry.generated_at)}
            </span>
          </div>
          <Link
            href={`/topic/${entry.topic_id}/synthesis`}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-purple hover:text-purple/80 transition-colors"
          >
            Full view
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SynthesisSkeletonCard() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-200 p-3 space-y-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SynthesisClient() {
  const [entries, setEntries] = useState<SynthesisEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const PAGE_SIZE = 20

  const load = useCallback(async (cat: string | null, s: SortKey, replace = true) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    const offset = replace ? 0 : entries.length
    const params = new URLSearchParams({
      sort: s,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    if (cat) params.set('category', cat)

    try {
      const res = await fetch(`/api/synthesis?${params}`)
      if (!res.ok) throw new Error('Failed to load synthesis data')
      const data = (await res.json()) as SynthesisListResponse
      setTotal(data.total)
      setEntries(replace ? data.entries : (prev) => [...prev, ...data.entries])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length])

  useEffect(() => {
    load(category, sort, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort])

  function handleCategoryChange(cat: string | null) {
    setCategory(cat)
  }

  function handleSortChange(s: SortKey) {
    setSort(s)
    setShowSortMenu(false)
  }

  const hasMore = entries.length < total

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24">

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/"
            className="flex-shrink-0 mt-0.5 p-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple/10 border border-purple/20">
                <GitMerge className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white">Synthesis Hub</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  AI-generated common ground across every major debate
                </p>
              </div>
            </div>
          </div>

          {/* Sort button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono transition-colors',
                showSortMenu
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Sort'}
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-1.5 w-44 rounded-xl bg-surface-100 border border-surface-300 shadow-2xl z-20 overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleSortChange(opt.key)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono transition-colors',
                        opt.key === sort
                          ? 'text-white bg-surface-300'
                          : 'text-surface-400 hover:text-white hover:bg-surface-200'
                      )}
                    >
                      {opt.label}
                      {opt.key === sort && (
                        <span className="h-1.5 w-1.5 rounded-full bg-purple" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── Info banner ─────────────────────────────────────────────── */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6 flex gap-3">
          <WandSparkles className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-mono font-semibold text-white mb-0.5">
              What is a synthesis?
            </p>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              Each synthesis is generated by Claude from the top arguments on both sides of a
              debate — identifying shared values, naming the core tension, and articulating a
              position that acknowledges both sets of concerns. It&apos;s not a compromise; it&apos;s
              genuine synthesis.
            </p>
          </div>
        </div>

        {/* ─── Category tabs ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <button
            onClick={() => handleCategoryChange(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-colors',
              !category
                ? 'bg-purple/20 border-purple/40 text-purple'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const { text, bg, border } = catColor(cat)
            const active = category === cat
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-colors',
                  active
                    ? cn(bg, border, text)
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* ─── Count ───────────────────────────────────────────────────── */}
        {!loading && (
          <p className="text-[11px] font-mono text-surface-600 mb-4">
            {total === 0 ? 'No syntheses yet' : `${total.toLocaleString()} synthesis${total !== 1 ? 'es' : ''}${category ? ` in ${category}` : ''}`}
          </p>
        )}

        {/* ─── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <SynthesisSkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load(category, sort, true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={GitMerge}
            title="No syntheses yet"
            description={
              category
                ? `No topics in ${category} have been synthesized yet. Visit an active topic and generate a synthesis to be the first.`
                : 'No topics have been synthesized yet. Visit any active topic and click "Generate synthesis" to kick things off.'
            }
            actions={[{ label: 'Browse topics', href: '/topics' }]}
          />
        ) : (
          <>
            <div className="space-y-4">
              {entries.map((entry, i) => (
                <SynthesisCard key={entry.topic_id} entry={entry} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => load(category, sort, false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load more
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
                <p className="text-[10px] font-mono text-surface-600 mt-2">
                  {entries.length} of {total} syntheses
                </p>
              </div>
            )}
          </>
        )}

        {/* ─── Footer links ─────────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-surface-300 flex flex-wrap items-center gap-3 text-[11px] font-mono text-surface-500">
          <span>Related:</span>
          <Link href="/steelman" className="hover:text-white transition-colors flex items-center gap-1">
            Steelman Engine <ChevronRight className="h-2.5 w-2.5" />
          </Link>
          <Link href="/polarization" className="hover:text-white transition-colors flex items-center gap-1">
            Polarization Index <ChevronRight className="h-2.5 w-2.5" />
          </Link>
          <Link href="/convergence" className="hover:text-white transition-colors flex items-center gap-1">
            Convergence Tracker <ChevronRight className="h-2.5 w-2.5" />
          </Link>
          <Link href="/topics" className="hover:text-white transition-colors flex items-center gap-1">
            Browse All Topics <ChevronRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
