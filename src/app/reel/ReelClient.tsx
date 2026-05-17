'use client'

/**
 * /reel — The Civic Argument Reel
 *
 * TikTok-style vertical card feed of civic arguments. One argument at a time,
 * full-screen. FOR arguments glow blue, AGAINST glow red. Users can upvote,
 * bookmark, and navigate inline. Personalized for logged-in users; trending
 * fallback for guests.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ReelArgument, ReelResponse } from '@/app/api/reel/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const FILTERS = [
  { id: 'all', label: 'Both Sides' },
  { id: 'for', label: 'FOR only' },
  { id: 'against', label: 'AGAINST only' },
] as const

type Filter = 'all' | 'for' | 'against'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AIStar({ score }: { score: number | null }) {
  if (score === null) return null
  const grade =
    score >= 90 ? { letter: 'A+', color: 'text-emerald' } :
    score >= 80 ? { letter: 'A', color: 'text-emerald' } :
    score >= 70 ? { letter: 'B', color: 'text-for-400' } :
    score >= 60 ? { letter: 'C', color: 'text-gold' } :
                  { letter: 'D', color: 'text-against-400' }
  return (
    <span className={cn('font-mono text-[10px] font-bold', grade.color)}>
      {grade.letter}
    </span>
  )
}

// ─── Main Card ────────────────────────────────────────────────────────────────

interface CardProps {
  arg: ReelArgument
  index: number
  total: number
  upvoted: boolean
  bookmarked: boolean
  onUpvote: () => void
  onBookmark: () => void
  onPrev: () => void
  onNext: () => void
}

function ReelCard({
  arg, index, total, upvoted, bookmarked,
  onUpvote, onBookmark, onPrev, onNext,
}: CardProps) {
  const isFor = arg.side === 'blue'

  const dragY = useMotionValue(0)
  const cardOpacity = useTransform(dragY, [-120, 0, 120], [0.4, 1, 0.4])
  const cardScale = useTransform(dragY, [-120, 0, 120], [0.96, 1, 0.96])

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y < -60 && index < total - 1) onNext()
    else if (info.offset.y > 60 && index > 0) onPrev()
  }

  return (
    <motion.div
      key={arg.id}
      initial={{ opacity: 0, scale: 0.96, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -40 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ opacity: cardOpacity, scale: cardScale }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.25}
      onDragEnd={handleDragEnd}
      className="relative flex flex-col h-full select-none touch-none cursor-grab active:cursor-grabbing"
    >
      {/* Side glow */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl pointer-events-none transition-all duration-500',
          isFor
            ? 'shadow-[0_0_60px_-15px_#3b82f6] ring-1 ring-for-500/30'
            : 'shadow-[0_0_60px_-15px_#ef4444] ring-1 ring-against-500/30'
        )}
      />

      {/* Card background */}
      <div className="absolute inset-0 rounded-2xl bg-surface-100 overflow-hidden">
        {/* Gradient overlay */}
        <div
          className={cn(
            'absolute inset-0 opacity-5',
            isFor ? 'bg-for-500' : 'bg-against-500'
          )}
        />
        {/* Bottom gradient for text legibility */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-surface-50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col h-full p-5 pb-6">
        {/* ── Header: topic + side pill ── */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <Link
            href={`/topic/${arg.topic_id}`}
            className="flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[11px] font-semibold text-surface-500 mb-1 uppercase tracking-wider">
              {arg.topic?.category ?? 'Civic'}
            </p>
            <p className="font-mono text-sm font-semibold text-white/90 line-clamp-2 hover:text-white transition-colors">
              {arg.topic?.statement}
            </p>
          </Link>

          {/* Side pill */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-xs font-bold uppercase tracking-wider',
              isFor
                ? 'bg-for-500/15 border-for-500/40 text-for-400'
                : 'bg-against-500/15 border-against-500/40 text-against-400'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </div>
        </div>

        {/* Vote bar */}
        {arg.topic && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-for-400 font-semibold">
                {Math.round(arg.topic.blue_pct)}% FOR
              </span>
              <span className="font-mono text-[10px] text-surface-500">
                {arg.topic.total_votes.toLocaleString()} votes
              </span>
              <span className="font-mono text-[10px] text-against-400 font-semibold">
                {100 - Math.round(arg.topic.blue_pct)}% AGN
              </span>
            </div>
            <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-500"
                style={{ width: `${arg.topic.blue_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Argument text ── */}
        <div className="flex-1 overflow-y-auto mb-4">
          <p className="font-mono text-sm leading-relaxed text-white/95">
            {arg.content}
          </p>
        </div>

        {/* ── Footer: author + actions ── */}
        <div className="flex items-end justify-between gap-4">
          {/* Author */}
          <Link
            href={`/profile/${arg.author?.username ?? ''}`}
            className="flex items-center gap-2.5 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar
              src={arg.author?.avatar_url}
              fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-white truncate">
                {arg.author?.display_name ?? arg.author?.username}
              </p>
              <div className="flex items-center gap-1.5">
                {arg.author?.role && arg.author.role !== 'user' && (
                  <Badge variant={arg.author.role as 'debator' | 'elder' | 'troll_catcher' | 'person'}>
                    {arg.author.role}
                  </Badge>
                )}
                <span className="font-mono text-[10px] text-surface-500">
                  {timeAgo(arg.created_at)}
                </span>
                {arg.ai_score !== null && (
                  <>
                    <span className="text-surface-600">·</span>
                    <AIStar score={arg.ai_score} />
                  </>
                )}
              </div>
            </div>
          </Link>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Upvote */}
            <button
              onClick={onUpvote}
              className={cn(
                'flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all',
                upvoted
                  ? 'text-for-400 bg-for-500/15'
                  : 'text-surface-500 hover:text-for-400 hover:bg-for-500/10'
              )}
              aria-label={upvoted ? 'Remove upvote' : 'Upvote argument'}
            >
              <ThumbsUp className="h-4 w-4" />
              <span className="font-mono text-[10px] font-semibold">
                {arg.upvotes + (upvoted ? 1 : 0)}
              </span>
            </button>

            {/* Replies */}
            <Link
              href={`/topic/${arg.topic_id}#arg-${arg.id}`}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-300/50 transition-all"
              aria-label="View replies"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="font-mono text-[10px] font-semibold">
                {arg.reply_count}
              </span>
            </Link>

            {/* Bookmark */}
            <button
              onClick={onBookmark}
              className={cn(
                'flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all',
                bookmarked
                  ? 'text-gold bg-gold/10'
                  : 'text-surface-500 hover:text-gold hover:bg-gold/10'
              )}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark argument'}
            >
              {bookmarked ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>

            {/* Open topic */}
            <Link
              href={`/topic/${arg.topic_id}`}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-300/50 transition-all"
              aria-label="Open topic"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
        {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-300',
              i === index % 8
                ? 'w-4 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-surface-400/60'
            )}
          />
        ))}
        {total > 8 && (
          <span className="font-mono text-[10px] text-surface-500 ml-1">
            {index + 1}/{total}
          </span>
        )}
      </div>

      {/* Swipe hint arrows */}
      {index > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-16">
          <ArrowUp className="h-4 w-4 text-surface-400/40 animate-bounce" />
        </div>
      )}
      {index < total - 1 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-16">
          <ArrowDown className="h-4 w-4 text-surface-400/40 animate-bounce" />
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReelClient() {
  const [args, setArgs] = useState<ReelArgument[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [index, setIndex] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState('All')
  const [showFilters, setShowFilters] = useState(false)
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set())
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchArgs = useCallback(async (reset = false) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)
    setError(false)

    try {
      const params = new URLSearchParams({
        filter,
        limit: '20',
        ...(category !== 'All' ? { category } : {}),
        ...(cursor && !reset ? { cursor } : {}),
      })
      const res = await fetch(`/api/reel?${params}`)
      if (!res.ok) throw new Error()
      const data: ReelResponse = await res.json()

      if (reset) {
        setArgs(data.arguments)
        setIndex(0)
      } else {
        setArgs((prev) => [...prev, ...data.arguments])
      }
      setCursor(data.cursor)
      setUpvotedIds((prev) =>
        reset ? new Set(data.user_upvoted_ids) : new Set([...prev, ...data.user_upvoted_ids])
      )
      setBookmarkedIds((prev) =>
        reset ? new Set(data.user_bookmarked_ids) : new Set([...prev, ...data.user_bookmarked_ids])
      )
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, category, cursor])

  useEffect(() => {
    fetchArgs(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, category])

  // Prefetch next page when 5 items from the end
  useEffect(() => {
    if (
      args.length > 0 &&
      index >= args.length - 5 &&
      cursor &&
      !loadingMore &&
      !loading
    ) {
      fetchArgs(false)
    }
  }, [index, args.length, cursor, loadingMore, loading, fetchArgs])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'j') goNext()
      if (e.key === 'ArrowUp' || e.key === 'k') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  function goPrev() {
    setIndex((i) => clamp(i - 1, 0, args.length - 1))
  }

  function goNext() {
    setIndex((i) => clamp(i + 1, 0, args.length - 1))
  }

  async function handleUpvote(arg: ReelArgument) {
    const alreadyUpvoted = upvotedIds.has(arg.id)
    // Optimistic update
    setUpvotedIds((prev) => {
      const next = new Set(prev)
      if (alreadyUpvoted) next.delete(arg.id)
      else next.add(arg.id)
      return next
    })
    try {
      const res = await fetch(
        `/api/topics/${arg.topic_id}/arguments/${arg.id}/upvote`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error()
    } catch {
      // Revert on error
      setUpvotedIds((prev) => {
        const next = new Set(prev)
        if (alreadyUpvoted) next.add(arg.id)
        else next.delete(arg.id)
        return next
      })
    }
  }

  async function handleBookmark(arg: ReelArgument) {
    const alreadyBookmarked = bookmarkedIds.has(arg.id)
    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      if (alreadyBookmarked) next.delete(arg.id)
      else next.add(arg.id)
      return next
    })
    try {
      await fetch(`/api/arguments/${arg.id}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (alreadyBookmarked) next.add(arg.id)
        else next.delete(arg.id)
        return next
      })
    }
  }

  const current = args[index]

  return (
    <div ref={containerRef} className="relative h-screen bg-surface-50 flex flex-col overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-safe pt-3 pb-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-gold" />
          <span className="font-mono text-sm font-bold text-white">
            Civic Reel
          </span>
        </div>

        <button
          onClick={() => setShowFilters((f) => !f)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all',
            showFilters
              ? 'bg-purple/20 text-purple border border-purple/40'
              : 'text-surface-500 hover:text-white hover:bg-surface-300/50'
          )}
          aria-label="Filter reel"
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
        </button>
      </div>

      {/* ── Filter Panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-20 overflow-hidden bg-surface-100/80 backdrop-blur-md border-b border-surface-300/50"
          >
            <div className="px-4 py-3 space-y-3">
              {/* Side filter */}
              <div>
                <p className="font-mono text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Side
                </p>
                <div className="flex gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFilter(f.id as Filter); fetchArgs(true) }}
                      className={cn(
                        'px-3 py-1 rounded-lg font-mono text-xs font-semibold transition-all border',
                        filter === f.id
                          ? 'bg-purple/20 border-purple/40 text-purple'
                          : 'border-surface-300/60 text-surface-500 hover:text-white'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category filter */}
              <div>
                <p className="font-mono text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Category
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all border',
                        category === c
                          ? 'bg-for-500/20 border-for-500/40 text-for-400'
                          : 'border-surface-300/60 text-surface-500 hover:text-white'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Feed ── */}
      <div className="relative flex-1 px-4 py-2 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
              <p className="font-mono text-sm text-surface-500">Loading reel…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<X className="h-8 w-8" />}
              title="Couldn't load the reel"
              description="Check your connection and try again."
              action={
                <button
                  onClick={() => fetchArgs(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white font-mono text-sm font-semibold hover:bg-for-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              }
            />
          </div>
        ) : args.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="No arguments found"
              description="Try a different filter or category."
              action={
                <button
                  onClick={() => { setFilter('all'); setCategory('All') }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white font-mono text-sm font-semibold hover:bg-for-700 transition-colors"
                >
                  Clear filters
                </button>
              }
            />
          </div>
        ) : current ? (
          <AnimatePresence mode="wait">
            <ReelCard
              key={current.id}
              arg={current}
              index={index}
              total={args.length}
              upvoted={upvotedIds.has(current.id)}
              bookmarked={bookmarkedIds.has(current.id)}
              onUpvote={() => handleUpvote(current)}
              onBookmark={() => handleBookmark(current)}
              onPrev={goPrev}
              onNext={goNext}
            />
          </AnimatePresence>
        ) : null}
      </div>

      {/* ── Bottom Nav ── */}
      <div className="relative z-20 flex items-center justify-between px-6 py-3 pb-safe bg-surface-100/80 backdrop-blur-md border-t border-surface-300/30">
        <button
          onClick={goPrev}
          disabled={index === 0 || loading}
          aria-label="Previous argument"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-semibold transition-all',
            index === 0 || loading
              ? 'opacity-30 cursor-not-allowed text-surface-500'
              : 'text-white hover:bg-surface-300/60 active:scale-95'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        {/* Counter + home link */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-xs text-surface-500">
            {args.length > 0 ? `${index + 1} / ${args.length}` : '—'}
          </span>
          <Link
            href="/arguments"
            className="font-mono text-[10px] text-surface-600 hover:text-white transition-colors"
          >
            All arguments →
          </Link>
        </div>

        <button
          onClick={goNext}
          disabled={index >= args.length - 1 || loading}
          aria-label="Next argument"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-semibold transition-all',
            index >= args.length - 1 || loading
              ? 'opacity-30 cursor-not-allowed text-surface-500'
              : 'text-white hover:bg-surface-300/60 active:scale-95'
          )}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200/90 backdrop-blur-sm border border-surface-300/60">
            <Loader2 className="h-3 w-3 text-for-400 animate-spin" />
            <span className="font-mono text-[10px] text-surface-500">Loading more…</span>
          </div>
        </div>
      )}

      {/* Keyboard hint (desktop only) */}
      <div className="hidden md:flex absolute bottom-20 right-4 z-10 flex-col gap-1 text-surface-600">
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-300/50 text-surface-500 text-[10px]">↑</kbd>
          <span>prev</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-300/50 text-surface-500 text-[10px]">↓</kbd>
          <span>next</span>
        </div>
      </div>
    </div>
  )
}
