'use client'

/**
 * /arguments/clips — Civic Clips
 *
 * A scrollable showcase of the platform's sharpest arguments — filterable
 * by side (FOR / AGAINST), category, and sort order (Top / New / AI Score).
 * Each clip card shows the full argument text, author, upvotes, AI grade,
 * topic context, and reply count.
 *
 * Distinct from:
 *   /arguments               — brief summaries, paginated by side
 *   /arguments/top-scored    — AI grade leaderboard (grade-centric)
 *   /arguments/trending      — upvote velocity in the last 7 days
 *   /arguments/hall-of-fame  — all-time community legends
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Clapperboard,
  ChevronDown,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { ClipArgument, ClipsResponse } from '@/app/api/arguments/clips/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type SideFilter = 'all' | 'for' | 'against'
type SortFilter = 'top' | 'new' | 'ai_score'

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  B: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  C: { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  D: { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
  F: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Clip card ────────────────────────────────────────────────────────────────

function ClipCard({ clip }: { clip: ClipArgument }) {
  const isFor = clip.side === 'blue'
  const grade = clip.ai_grade?.toUpperCase()
  const gradeCfg = grade ? GRADE_CONFIG[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-5 flex flex-col gap-4',
        isFor ? 'border-for-500/25' : 'border-against-500/25'
      )}
    >
      {/* ── Side badge + grade ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isFor ? (
            <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-for-400 bg-for-500/10 border border-for-500/25 rounded-xl px-2.5 py-1">
              <ThumbsUp className="h-3 w-3" /> FOR
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-against-400 bg-against-500/10 border border-against-500/25 rounded-xl px-2.5 py-1">
              <ThumbsDown className="h-3 w-3" /> AGAINST
            </span>
          )}
          {gradeCfg && grade && (
            <span className={cn(
              'flex items-center gap-1 text-xs font-mono font-bold rounded-xl px-2 py-1 border',
              gradeCfg.text, gradeCfg.bg, gradeCfg.border
            )}>
              <Award className="h-3 w-3" />
              {grade}
            </span>
          )}
          {clip.ai_score != null && (
            <span className="text-xs font-mono text-surface-500">
              {clip.ai_score}/100
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-surface-600">
          {relativeTime(clip.created_at)}
        </span>
      </div>

      {/* ── Argument content ────────────────────────────────────────────── */}
      <p className="text-sm font-mono text-surface-100 leading-relaxed whitespace-pre-wrap">
        {renderWithMentions(clip.content)}
      </p>

      {/* ── Topic context ───────────────────────────────────────────────── */}
      {clip.topic && (
        <Link
          href={`/topic/${clip.topic.id}`}
          className="group flex items-start gap-2 rounded-xl bg-surface-200/50 border border-surface-300 p-3 hover:bg-surface-200 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={STATUS_BADGE[clip.topic.status] ?? 'proposed'}>
                {clip.topic.status === 'law' ? 'LAW' : clip.topic.status}
              </Badge>
              {clip.topic.category && (
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  {clip.topic.category}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors line-clamp-2 leading-snug">
              {clip.topic.statement}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-surface-600">
              <span className="text-for-500">{Math.round(clip.topic.blue_pct)}% FOR</span>
              <span>{clip.topic.total_votes.toLocaleString()} votes</span>
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 flex-shrink-0 mt-0.5 transition-colors" />
        </Link>
      )}

      {/* ── Footer: author + engagement ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-300">
        {clip.author ? (
          <Link
            href={`/profile/${clip.author.username}`}
            className="flex items-center gap-2 group min-w-0"
          >
            <Avatar
              src={clip.author.avatar_url}
              username={clip.author.username}
              size={28}
            />
            <div className="min-w-0">
              <p className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors truncate leading-none">
                {clip.author.display_name ?? clip.author.username}
              </p>
              {clip.author.role !== 'person' && (
                <p className="text-[10px] font-mono text-surface-600 leading-none mt-0.5">
                  {ROLE_LABEL[clip.author.role] ?? clip.author.role}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <div className="text-xs font-mono text-surface-600">Anonymous</div>
        )}
        <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            {clip.upvotes.toLocaleString()}
          </span>
          {clip.reply_count > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {clip.reply_count}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ClipSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-16 rounded-xl" />
            <Skeleton className="h-7 w-10 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/6 rounded" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="flex items-center justify-between pt-2 border-t border-surface-300">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap transition-all',
        active
          ? 'bg-for-500 text-white border border-for-400'
          : 'bg-surface-100 text-surface-400 border border-surface-300 hover:bg-surface-200 hover:text-surface-200'
      )}
    >
      {children}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function CivicClipsPage() {
  const [clips, setClips] = useState<ClipArgument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const [side, setSide] = useState<SideFilter>('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortFilter>('top')
  const [catOpen, setCatOpen] = useState(false)

  const catRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (
    s: SideFilter,
    cat: string,
    so: SortFilter,
    off: number,
    append: boolean
  ) => {
    if (off === 0) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        side: s,
        category: cat,
        sort: so,
        limit: String(PAGE_SIZE),
        offset: String(off),
      })
      const res = await fetch(`/api/arguments/clips?${params}`)
      if (!res.ok) throw new Error('Failed to load clips')
      const data: ClipsResponse = await res.json()
      if (append) {
        setClips((prev) => [...prev, ...data.clips])
      } else {
        setClips(data.clips)
      }
      setHasMore(data.clips.length === PAGE_SIZE)
    } catch {
      setError('Failed to load clips. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    setOffset(0)
    load(side, category, sort, 0, false)
  }, [side, category, sort, load])

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    load(side, category, sort, next, true)
  }

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedCatLabel = category === 'all' ? 'All Categories' : category

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-16">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/arguments"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:bg-surface-200 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-300" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-purple" />
              <h1 className="font-mono text-xl font-bold text-white leading-none">
                Civic Clips
              </h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-1">
              The platform&apos;s sharpest arguments — browse, filter, read
            </p>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="space-y-2.5 mb-6">
          {/* Side filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <FilterChip active={side === 'all'} onClick={() => setSide('all')}>All Sides</FilterChip>
            <FilterChip active={side === 'for'} onClick={() => setSide('for')}>
              <ThumbsUp className="inline h-3 w-3 mr-1" />FOR
            </FilterChip>
            <FilterChip active={side === 'against'} onClick={() => setSide('against')}>
              <ThumbsDown className="inline h-3 w-3 mr-1" />AGAINST
            </FilterChip>
            <div className="h-5 w-px bg-surface-300 mx-1 flex-shrink-0" />
            <FilterChip active={sort === 'top'} onClick={() => setSort('top')}>Top</FilterChip>
            <FilterChip active={sort === 'new'} onClick={() => setSort('new')}>New</FilterChip>
            <FilterChip active={sort === 'ai_score'} onClick={() => setSort('ai_score')}>AI Score</FilterChip>
          </div>

          {/* Category dropdown */}
          <div className="relative" ref={catRef}>
            <button
              onClick={() => setCatOpen((v) => !v)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all',
                category !== 'all'
                  ? 'bg-for-500 text-white border-for-400'
                  : 'bg-surface-100 text-surface-400 border-surface-300 hover:bg-surface-200'
              )}
            >
              {selectedCatLabel}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', catOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1.5 left-0 z-30 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden min-w-[160px]"
                >
                  {['all', ...CATEGORIES].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === cat
                          ? 'bg-for-500/15 text-for-400'
                          : 'text-surface-400 hover:bg-surface-200 hover:text-surface-200'
                      )}
                    >
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Results count ────────────────────────────────────────────────── */}
        {!loading && !error && clips.length > 0 && (
          <p className="text-xs font-mono text-surface-600 mb-4">
            {clips.length}{hasMore ? '+' : ''} clip{clips.length !== 1 ? 's' : ''}
            {category !== 'all' ? ` in ${category}` : ''}
            {side !== 'all' ? ` · ${side === 'for' ? 'FOR' : 'AGAINST'} only` : ''}
          </p>
        )}

        {/* ── Clip list ────────────────────────────────────────────────────── */}
        {loading ? (
          <ClipSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/20 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load(side, category, sort, 0, false)}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : clips.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title="No clips found"
            description={
              category !== 'all'
                ? `No qualifying arguments in ${category} yet. Try a different filter.`
                : 'No clips match your current filters.'
            }
          />
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              <div className="space-y-4">
                {clips.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} />
                ))}
              </div>
            </AnimatePresence>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-300 hover:text-white transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more clips'}
                </button>
              </div>
            )}

            {!hasMore && clips.length > 0 && (
              <div className="mt-10 flex items-center gap-3">
                <div className="h-px flex-1 bg-surface-200" />
                <span className="text-xs font-mono text-surface-600">All clips shown</span>
                <div className="h-px flex-1 bg-surface-200" />
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
