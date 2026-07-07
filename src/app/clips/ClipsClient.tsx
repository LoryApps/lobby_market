'use client'

/**
 * /clips — Civic Clips
 *
 * A TikTok-style full-screen card experience for the platform's best arguments.
 * One argument per card. Navigate with keyboard (↑↓), arrow buttons, or
 * swipe gestures. Upvote, bookmark, and reply without leaving the flow.
 *
 * Distinct from:
 *   /live         — chronological argument stream (list)
 *   /swipe        — topic voting cards
 *   /pulse        — argument discovery list
 *
 * Clips is focused: one argument, full screen, zero distractions.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Gavel,
  Loader2,
  MessageSquare,
  Scale,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'
import type { ClipArgument, ClipsResponse } from '@/app/api/arguments/clips/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 60
const LOAD_MORE_THRESHOLD = 5

const SIDE_LABEL: Record<'blue' | 'red', string> = {
  blue: 'FOR',
  red: 'AGAINST',
}

const SIDE_COLOR: Record<'blue' | 'red', { text: string; bg: string; border: string; bar: string }> = {
  blue: {
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
  },
  red: {
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
  },
}

const GRADE_CONFIG: Record<string, { text: string; label: string }> = {
  A: { text: 'text-emerald', label: 'Exceptional' },
  B: { text: 'text-for-300', label: 'Strong' },
  C: { text: 'text-gold', label: 'Adequate' },
  D: { text: 'text-against-300', label: 'Weak' },
  F: { text: 'text-against-400', label: 'Poor' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold bg-gold/10 border-gold/30',
  Politics: 'text-for-400 bg-for-500/10 border-for-500/30',
  Technology: 'text-purple bg-purple/10 border-purple/30',
  Science: 'text-emerald bg-emerald/10 border-emerald/30',
  Ethics: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  Philosophy: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  Culture: 'text-against-400 bg-against-500/10 border-against-500/30',
  Health: 'text-emerald bg-emerald/10 border-emerald/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
  Education: 'text-for-300 bg-for-400/10 border-for-400/30',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_ICON: Record<string, typeof Scale> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Scale,
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type SortMode = 'top' | 'new' | 'ai_score'
type SideFilter = 'all' | 'for' | 'against'

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
  return `${Math.floor(d / 7)}w ago`
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  sort: SortMode
  side: SideFilter
  onSort: (s: SortMode) => void
  onSide: (s: SideFilter) => void
}

function FilterBar({ sort, side, onSort, onSide }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sort */}
      <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
        {(
          [
            { id: 'top', label: 'Top', icon: TrendingUp },
            { id: 'new', label: 'New', icon: Zap },
            { id: 'ai_score', label: 'AI Rated', icon: Sparkles },
          ] as { id: SortMode; label: string; icon: typeof TrendingUp }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSort(id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors',
              sort === id
                ? 'bg-surface-400 text-white'
                : 'text-surface-500 hover:text-white'
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Side */}
      <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
        {(
          [
            { id: 'all', label: 'Both' },
            { id: 'for', label: 'FOR' },
            { id: 'against', label: 'AGAINST' },
          ] as { id: SideFilter; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onSide(id)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors',
              side === id
                ? id === 'for'
                  ? 'bg-for-600 text-white'
                  : id === 'against'
                  ? 'bg-against-600 text-white'
                  : 'bg-surface-400 text-white'
                : 'text-surface-500 hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Single clip card ─────────────────────────────────────────────────────────

interface ClipCardProps {
  clip: ClipArgument
  index: number
  total: number
  isUpvoted: boolean
  isBookmarked: boolean
  onUpvote: () => void
  onBookmark: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

function ClipCard({
  clip,
  index,
  total,
  isUpvoted,
  isBookmarked,
  onUpvote,
  onBookmark,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: ClipCardProps) {
  const sideColors = SIDE_COLOR[clip.side]
  const StatusIcon = clip.topic ? (STATUS_ICON[clip.topic.status] ?? Scale) : Scale

  const forPct = Math.round(clip.topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  // Drag-to-navigate
  const y = useMotionValue(0)
  const opacity = useTransform(y, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [0.4, 1, 0.4])

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y < -SWIPE_THRESHOLD && hasNext) {
      haptics.dismiss()
      onNext()
    } else if (info.offset.y > SWIPE_THRESHOLD && hasPrev) {
      haptics.dismiss()
      onPrev()
    }
  }

  const gradientClass =
    clip.side === 'blue'
      ? 'from-for-950/30 via-surface-100/0 to-surface-100/0'
      : 'from-against-950/30 via-surface-100/0 to-surface-100/0'

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      style={{ y, opacity }}
      className="w-full max-w-lg mx-auto cursor-grab active:cursor-grabbing select-none"
    >
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'bg-surface-100 border',
          clip.side === 'blue' ? 'border-for-500/20' : 'border-against-500/20'
        )}
        style={{ minHeight: '62vh' }}
      >
        {/* Side accent gradient */}
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40 pointer-events-none', gradientClass)} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-5">
          {/* Header: side pill + counter + grade */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold border',
                sideColors.bg,
                sideColors.border,
                sideColors.text
              )}
            >
              {SIDE_LABEL[clip.side]}
            </span>

            {clip.ai_grade && GRADE_CONFIG[clip.ai_grade] && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-semibold border',
                  'bg-surface-200 border-surface-300',
                  GRADE_CONFIG[clip.ai_grade].text
                )}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {clip.ai_grade} · {GRADE_CONFIG[clip.ai_grade].label}
              </span>
            )}

            <span className="ml-auto text-xs font-mono text-surface-500">
              {index + 1} / {total}
            </span>
          </div>

          {/* Argument content */}
          <p className="text-white text-lg font-medium leading-relaxed flex-1 mb-6">
            &ldquo;{clip.content}&rdquo;
          </p>

          {/* Author row */}
          <div className="flex items-center gap-3 mb-5">
            {clip.author && (
              <Link
                href={`/profile/${clip.author.username}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2.5 group"
              >
                <Avatar
                  src={clip.author.avatar_url}
                  fallback={clip.author.display_name ?? clip.author.username}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-for-400 transition-colors leading-none">
                    {clip.author.display_name ?? clip.author.username}
                  </p>
                  <p className="text-xs text-surface-500 font-mono mt-0.5">
                    @{clip.author.username} · {relativeTime(clip.created_at)}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* Topic context */}
          {clip.topic && (
            <Link
              href={`/topic/${clip.topic.id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'block rounded-xl p-3 mb-4',
                'bg-surface-200/60 border border-surface-300/50',
                'hover:border-surface-400/60 transition-colors group'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {clip.topic.category && (
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
                        CATEGORY_COLORS[clip.topic.category] ??
                          'text-surface-300 bg-surface-300/10 border-surface-400/30'
                      )}
                    >
                      {clip.topic.category}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-surface-300/40 text-surface-500 border border-surface-400/20">
                    <StatusIcon className="h-2.5 w-2.5" />
                    {STATUS_LABEL[clip.topic.status] ?? clip.topic.status}
                  </span>
                </div>
                <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-white flex-shrink-0 mt-0.5 transition-colors" />
              </div>

              <p className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors leading-snug line-clamp-2 mb-2.5">
                {clip.topic.statement}
              </p>

              {/* Vote bar */}
              <div>
                <div className="flex h-1 rounded-full overflow-hidden mb-1">
                  <div className="bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
                  <div className="bg-against-500 transition-all" style={{ width: `${againstPct}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
                  <span className="text-[10px] font-mono text-surface-600">
                    <Users className="h-2.5 w-2.5 inline mr-0.5" />
                    {formatVotes(clip.topic.total_votes)}
                  </span>
                  <span className="text-[10px] font-mono text-against-400">{againstPct}% AGAINST</span>
                </div>
              </div>
            </Link>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3">
            {/* Upvote */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                haptics.light()
                onUpvote()
              }}
              aria-label={isUpvoted ? 'Remove upvote' : 'Upvote this argument'}
              aria-pressed={isUpvoted}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono font-medium transition-all',
                isUpvoted
                  ? 'bg-for-600/20 border border-for-600/40 text-for-400'
                  : 'bg-surface-200 border border-surface-300 text-surface-500 hover:border-for-600/30 hover:text-for-400'
              )}
            >
              <ThumbsUp className={cn('h-4 w-4', isUpvoted && 'fill-for-500/30')} />
              {formatVotes(clip.upvotes + (isUpvoted ? 1 : 0))}
            </button>

            {/* Bookmark */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                haptics.light()
                onBookmark()
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this argument'}
              aria-pressed={isBookmarked}
              className={cn(
                'flex items-center justify-center h-10 w-10 rounded-xl transition-all border',
                isBookmarked
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-gold/30 hover:text-gold'
              )}
            >
              {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>

            {/* Reply */}
            <Link
              href={`/arguments/${clip.id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono font-medium transition-all',
                'bg-surface-200 border border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              {clip.reply_count > 0 ? formatVotes(clip.reply_count) : 'Reply'}
            </Link>

            {/* View full argument */}
            <Link
              href={`/arguments/${clip.id}`}
              onClick={(e) => e.stopPropagation()}
              aria-label="View full argument thread"
              className={cn(
                'ml-auto flex items-center justify-center h-10 w-10 rounded-xl transition-all border',
                'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Swipe hint (first card only, fades on interaction) */}
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function ClipsClient() {
  const router = useRouter()

  const [clips, setClips] = useState<ClipArgument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<'up' | 'down'>('down')
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<SortMode>('top')
  const [side, setSide] = useState<SideFilter>('all')
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set())
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)

  // Load current user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  // Load clips
  const loadClips = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
        setHasMore(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const params = new URLSearchParams({
          limit: '30',
          offset: String(offsetRef.current),
          sort,
          side,
        })
        const res = await fetch(`/api/arguments/clips?${params}`)
        if (!res.ok) throw new Error('Failed to load clips')
        const data: ClipsResponse = await res.json()

        if (reset) {
          setClips(data.clips)
          setCurrentIndex(0)
        } else {
          setClips((prev) => [...prev, ...data.clips])
        }

        offsetRef.current += data.clips.length
        setHasMore(data.clips.length >= 30)
        setError(false)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [sort, side]
  )

  // Initial load and reload on filter change
  useEffect(() => {
    loadClips(true)
  }, [loadClips])

  // Load bookmarked argument IDs for the current user
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    supabase
      .from('argument_bookmarks')
      .select('argument_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) setBookmarked(new Set(data.map((r: { argument_id: string }) => r.argument_id)))
      })
  }, [userId])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'j') goNext()
      if (e.key === 'ArrowUp' || e.key === 'k') goPrev()
      if (e.key === 'u') handleUpvote()
      if (e.key === 'b') handleBookmark()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const goNext = useCallback(() => {
    if (currentIndex >= clips.length - 1) {
      if (hasMore && !loadingMore) loadClips(false)
      return
    }
    setDirection('down')
    setCurrentIndex((i) => i + 1)

    // Prefetch more
    if (clips.length - currentIndex <= LOAD_MORE_THRESHOLD && hasMore && !loadingMore) {
      loadClips(false)
    }
  }, [currentIndex, clips.length, hasMore, loadingMore, loadClips])

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return
    setDirection('up')
    setCurrentIndex((i) => i - 1)
  }, [currentIndex])

  const handleUpvote = useCallback(async () => {
    if (!userId || !clips[currentIndex]) return
    const clip = clips[currentIndex]
    const wasUpvoted = upvoted.has(clip.id)

    setUpvoted((prev) => {
      const next = new Set(prev)
      if (wasUpvoted) next.delete(clip.id)
      else next.add(clip.id)
      return next
    })

    // Optimistic update
    setClips((prev) =>
      prev.map((c, i) =>
        i === currentIndex
          ? { ...c, upvotes: c.upvotes + (wasUpvoted ? -1 : 1) }
          : c
      )
    )

    try {
      const res = await fetch(
        `/api/topics/${clip.topic_id}/arguments/${clip.id}/upvote`,
        { method: 'POST' }
      )
      if (res.ok) {
        const json = await res.json()
        setClips((prev) =>
          prev.map((c, i) =>
            i === currentIndex ? { ...c, upvotes: json.upvotes } : c
          )
        )
      }
    } catch {
      // Revert
      setUpvoted((prev) => {
        const next = new Set(prev)
        if (wasUpvoted) next.add(clip.id)
        else next.delete(clip.id)
        return next
      })
      setClips((prev) =>
        prev.map((c, i) =>
          i === currentIndex
            ? { ...c, upvotes: c.upvotes + (wasUpvoted ? 1 : -1) }
            : c
        )
      )
    }
  }, [userId, clips, currentIndex, upvoted])

  const handleBookmark = useCallback(async () => {
    if (!userId || !clips[currentIndex]) return
    const clip = clips[currentIndex]
    const wasBookmarked = bookmarked.has(clip.id)

    setBookmarked((prev) => {
      const next = new Set(prev)
      if (wasBookmarked) next.delete(clip.id)
      else next.add(clip.id)
      return next
    })

    try {
      await fetch(`/api/arguments/${clip.id}/bookmark`, {
        method: wasBookmarked ? 'DELETE' : 'POST',
      })
    } catch {
      setBookmarked((prev) => {
        const next = new Set(prev)
        if (wasBookmarked) next.add(clip.id)
        else next.delete(clip.id)
        return next
      })
    }
  }, [userId, clips, currentIndex, bookmarked])

  const currentClip = clips[currentIndex] ?? null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 flex flex-col pb-24 md:pb-12">
        {/* Page header */}
        <div className="sticky top-0 z-20 bg-surface-50/90 backdrop-blur-sm border-b border-surface-300/40">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="flex items-center justify-center h-8 w-8 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex-1">
                <h1 className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <Star className="h-4 w-4 text-gold" />
                  Civic Clips
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  {loading ? 'Loading…' : `${clips.length} top argument${clips.length !== 1 ? 's' : ''}`}
                  {currentClip && ` · ${currentIndex + 1} of ${clips.length}`}
                </p>
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                aria-label="Toggle filters"
                aria-expanded={showFilters}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono font-medium transition-colors',
                  showFilters
                    ? 'bg-for-600/20 border border-for-600/40 text-for-400'
                    : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white'
                )}
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
            </div>

            {/* Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 pb-1">
                    <FilterBar
                      sort={sort}
                      side={side}
                      onSort={(s) => setSort(s)}
                      onSide={(s) => setSide(s)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Card area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4">
          {loading ? (
            <div className="w-full max-w-lg space-y-4">
              <Skeleton className="w-full rounded-2xl" style={{ height: '62vh' }} />
            </div>
          ) : error ? (
            <EmptyState
              icon={X}
              title="Couldn't load clips"
              description="Check your connection and try again."
              action={{ label: 'Retry', onClick: () => loadClips(true) }}
            />
          ) : clips.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No clips found"
              description="Try a different filter or come back later."
              action={{ label: 'Reset filters', onClick: () => { setSort('top'); setSide('all') } }}
            />
          ) : currentClip ? (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentClip.id}
                custom={direction}
                initial={{ opacity: 0, y: direction === 'down' ? 40 : -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction === 'down' ? -40 : 40 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="w-full max-w-lg"
              >
                <ClipCard
                  clip={currentClip}
                  index={currentIndex}
                  total={clips.length}
                  isUpvoted={upvoted.has(currentClip.id)}
                  isBookmarked={bookmarked.has(currentClip.id)}
                  onUpvote={handleUpvote}
                  onBookmark={handleBookmark}
                  onPrev={goPrev}
                  onNext={goNext}
                  hasPrev={currentIndex > 0}
                  hasNext={currentIndex < clips.length - 1 || hasMore}
                />
              </motion.div>
            </AnimatePresence>
          ) : null}

          {/* Navigation controls */}
          {!loading && clips.length > 0 && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => { haptics.light(); goPrev() }}
                disabled={currentIndex === 0}
                aria-label="Previous argument"
                className={cn(
                  'flex items-center justify-center h-10 w-10 rounded-full border transition-all',
                  currentIndex === 0
                    ? 'border-surface-300/30 text-surface-600/30 cursor-not-allowed'
                    : 'border-surface-300 text-surface-400 hover:border-surface-400 hover:text-white'
                )}
              >
                <ChevronUp className="h-5 w-5" />
              </button>

              {/* Progress dots */}
              <div className="flex gap-1.5 items-center">
                {clips.slice(Math.max(0, currentIndex - 2), currentIndex + 5).map((c, relIdx) => {
                  const absIdx = Math.max(0, currentIndex - 2) + relIdx
                  const isCurrent = absIdx === currentIndex
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setDirection(absIdx > currentIndex ? 'down' : 'up')
                        setCurrentIndex(absIdx)
                      }}
                      aria-label={`Go to clip ${absIdx + 1}`}
                      className={cn(
                        'rounded-full transition-all duration-200',
                        isCurrent
                          ? 'w-5 h-2 bg-for-400'
                          : 'w-2 h-2 bg-surface-400 hover:bg-surface-600'
                      )}
                    />
                  )
                })}
                {loadingMore && (
                  <Loader2 className="h-3 w-3 text-surface-600 animate-spin ml-0.5" />
                )}
              </div>

              <button
                onClick={() => { haptics.light(); goNext() }}
                disabled={currentIndex >= clips.length - 1 && !hasMore && !loadingMore}
                aria-label="Next argument"
                className={cn(
                  'flex items-center justify-center h-10 w-10 rounded-full border transition-all',
                  currentIndex >= clips.length - 1 && !hasMore
                    ? 'border-surface-300/30 text-surface-600/30 cursor-not-allowed'
                    : 'border-surface-300 text-surface-400 hover:border-surface-400 hover:text-white'
                )}
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Keyboard hint */}
          {!loading && clips.length > 0 && (
            <p className="text-xs font-mono text-surface-600 hidden md:block">
              Use <kbd className="px-1 py-0.5 rounded bg-surface-300 text-surface-400">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-300 text-surface-400">↓</kbd> or{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-300 text-surface-400">j</kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-300 text-surface-400">k</kbd>{' '}
              to navigate · <kbd className="px-1 py-0.5 rounded bg-surface-300 text-surface-400">u</kbd> upvote ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-300 text-surface-400">b</kbd> bookmark
            </p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
