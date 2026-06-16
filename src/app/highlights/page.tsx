'use client'

/**
 * /highlights — Civic Argument Highlights Reel
 *
 * A daily curated showcase of the top arguments from the last 24 hours.
 * One argument per topic, ranked by composite score (upvotes × 3 + ai_score × 10).
 *
 * Distinct from:
 *   /argument-of-the-day  — single best argument, curated
 *   /gallery              — all-time best arguments, no curation
 *   /reel                 — TikTok scroll format, not curated
 *   /top-arguments        — ranked leaderboard, no daily curation
 *   /pulse                — live argument stream
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
  Filter,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'
import type { HighlightsResponse, HighlightArgument, CategoryStat } from '@/app/api/highlights/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',       glow: 'shadow-gold/10'       },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',    glow: 'shadow-for-500/10'    },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',     glow: 'shadow-purple/10'     },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',    glow: 'shadow-emerald/10'    },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30',glow: 'shadow-against-500/10'},
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30',    glow: 'shadow-for-400/10'    },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',       glow: 'shadow-gold/10'       },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30',glow: 'shadow-against-400/10'},
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',    glow: 'shadow-emerald/10'    },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',     glow: 'shadow-purple/10'     },
}

function getCatStyle(cat: string | null | undefined) {
  return CATEGORY_STYLE[cat ?? ''] ?? {
    text: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-300/40',
    glow: '',
  }
}

const GRADE_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  B: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  C: { text: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/30'    },
  D: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  F: { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300/40' },
}

function gradeStyle(grade: string | null | undefined) {
  return GRADE_STYLE[grade?.charAt(0) ?? ''] ?? GRADE_STYLE.F
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgumentCardSkeleton({ rank }: { rank: number }) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-300/50 flex items-center justify-center">
            <span className="text-[11px] font-mono text-surface-600">#{rank}</span>
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
      <div className="pl-10 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="pl-10 rounded-xl bg-surface-200 p-3 space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="pl-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Category Filter ──────────────────────────────────────────────────────────

function CategoryPill({
  cat,
  count,
  active,
  onClick,
}: {
  cat: string
  count: number
  active: boolean
  onClick: () => void
}) {
  const s = getCatStyle(cat)
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium',
        'border transition-all duration-150 flex-shrink-0',
        active
          ? [s.text, s.bg, s.border]
          : 'border-surface-300 text-surface-500 bg-surface-200/60 hover:border-surface-400 hover:text-white'
      )}
    >
      <span>{cat}</span>
      <span className={cn('opacity-60', active && 'opacity-80')}>{count}</span>
    </button>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  argument,
  rank,
  bookmarked,
  onBookmark,
}: {
  argument: HighlightArgument
  rank: number
  bookmarked: boolean
  onBookmark: () => void
}) {
  const topic = argument.topic
  const author = argument.author
  const isFor = argument.side === 'blue'
  const cat = topic?.category ?? null
  const catStyle = getCatStyle(cat)
  const gs = gradeStyle(argument.ai_grade)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'group relative rounded-2xl bg-surface-100 border p-5 space-y-4',
        'hover:border-surface-400/60 transition-all duration-200',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Rank + category + side */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rank badge */}
          <div
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold',
              rank === 1
                ? 'bg-gold/20 border border-gold/40 text-gold'
                : rank === 2
                ? 'bg-surface-400/20 border border-surface-400/40 text-surface-400'
                : rank === 3
                ? 'bg-amber-800/20 border border-amber-700/30 text-amber-600'
                : 'bg-surface-200 border border-surface-300 text-surface-600'
            )}
            aria-label={`Rank ${rank}`}
          >
            {rank === 1 ? '★' : `#${rank}`}
          </div>

          {/* Side badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold',
              isFor
                ? 'bg-for-500/15 border border-for-500/30 text-for-300'
                : 'bg-against-500/15 border border-against-500/30 text-against-300'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" aria-hidden />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>

          {/* Category */}
          {cat && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono',
                catStyle.text, catStyle.bg, catStyle.border, 'border'
              )}
            >
              {cat}
            </span>
          )}

          {/* AI Grade */}
          {argument.ai_grade && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border',
                gs.text, gs.bg, gs.border
              )}
              title={`AI Grade: ${argument.ai_grade}`}
            >
              {argument.ai_grade}
            </span>
          )}
        </div>

        {/* Upvotes + bookmark */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-gold bg-gold/10 border border-gold/20"
            aria-label={`${argument.upvotes} upvotes`}
          >
            <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
            {argument.upvotes}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault()
              haptics.light()
              onBookmark()
            }}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark argument'}
            aria-pressed={bookmarked}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg border transition-all',
              bookmarked
                ? 'border-for-500/40 bg-for-500/10 text-for-400'
                : 'border-surface-300 bg-surface-200 text-surface-500 hover:border-surface-400 hover:text-white'
            )}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-3.5 w-3.5" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-700 leading-relaxed pl-9 font-mono">
        {argument.content.length > 300
          ? argument.content.slice(0, 300) + '…'
          : argument.content}
      </p>

      {/* Topic context */}
      {topic && (
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'block pl-9 rounded-xl p-3 transition-all',
            'bg-surface-200/60 hover:bg-surface-300/60',
            'border border-surface-300/40 hover:border-surface-400/40'
          )}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {topic.status === 'law' ? (
                <Gavel className="h-3 w-3 text-gold" aria-hidden />
              ) : topic.status === 'voting' ? (
                <Scale className="h-3 w-3 text-purple" aria-hidden />
              ) : (
                <Zap className="h-3 w-3 text-for-400" aria-hidden />
              )}
            </div>
            <p className="text-xs text-surface-500 font-mono leading-relaxed line-clamp-2">
              {topic.statement}
            </p>
            <ChevronRight className="h-3 w-3 text-surface-600 flex-shrink-0 mt-0.5" aria-hidden />
          </div>
          {topic.total_votes > 0 && (
            <div className="mt-2 ml-5 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full"
                  style={{ width: `${Math.round(topic.blue_pct)}%` }}
                  aria-hidden
                />
              </div>
              <span className="text-[10px] font-mono text-surface-600">
                {Math.round(topic.blue_pct)}% FOR
              </span>
            </div>
          )}
        </Link>
      )}

      {/* Author + time */}
      <div className="pl-9 flex items-center justify-between gap-3">
        {author ? (
          <Link
            href={`/profile/${author.username}`}
            className="flex items-center gap-2 group/author"
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="xs"
            />
            <div className="min-w-0">
              <span className="text-xs font-mono text-white group-hover/author:text-for-300 transition-colors truncate">
                {author.display_name || author.username}
              </span>
              {author.clout > 0 && (
                <span className="ml-1.5 text-[10px] font-mono text-gold opacity-70">
                  {author.clout.toLocaleString()} clout
                </span>
              )}
            </div>
          </Link>
        ) : (
          <span className="text-xs text-surface-600 font-mono">Anonymous</span>
        )}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] font-mono text-surface-600">
            {relativeTime(argument.created_at)}
          </span>
          <Link
            href={`/topic/${argument.topic_id}`}
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
            aria-label="View full argument thread"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Thread
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Category Breakdown Sidebar ───────────────────────────────────────────────

function CategoryBreakdown({ stats }: { stats: CategoryStat[] }) {
  if (stats.length === 0) return null
  const maxCount = Math.max(...stats.map((s) => s.count), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-surface-500" aria-hidden />
        <h2 className="text-sm font-mono font-semibold text-white">Category Breakdown</h2>
      </div>
      <div className="space-y-3">
        {stats.map((s) => {
          const cs = getCatStyle(s.category)
          return (
            <div key={s.category} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-xs font-mono font-medium', cs.text)}>
                  {s.category}
                </span>
                <span className="text-[11px] font-mono text-surface-500">
                  {s.count} arg{s.count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', cs.bg.replace('/10', '/80'))}
                  style={{ width: `${(s.count / maxCount) * 100}%` }}
                  aria-hidden
                />
              </div>
              <div className="flex gap-2 text-[10px] font-mono text-surface-600">
                <span className="text-for-400">{s.forCount} FOR</span>
                <span className="text-surface-600">·</span>
                <span className="text-against-400">{s.againstCount} AGN</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip({ data }: { data: HighlightsResponse }) {
  const forCount = data.arguments.filter((a) => a.side === 'blue').length
  const againstCount = data.arguments.filter((a) => a.side === 'red').length
  const avgScore = data.arguments.length > 0
    ? Math.round(data.arguments.reduce((s, a) => s + a.composite_score, 0) / data.arguments.length)
    : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total', value: data.total, icon: Flame, color: 'text-gold' },
        { label: 'FOR args', value: forCount, icon: ThumbsUp, color: 'text-for-400' },
        { label: 'AGAINST args', value: againstCount, icon: ThumbsDown, color: 'text-against-400' },
        { label: 'Avg score', value: avgScore, icon: Award, color: 'text-purple' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1"
        >
          <div className="flex items-center gap-1.5">
            <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
            <span className="text-[11px] font-mono text-surface-500">{label}</span>
          </div>
          <span className="block text-xl font-mono font-bold text-white">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HighlightsPage() {
  const [data, setData] = useState<HighlightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())
  const [hoursBack, setHoursBack] = useState(24)

  const load = useCallback(
    async (hours = hoursBack, cat = categoryFilter) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('hours', String(hours))
        if (cat) params.set('category', cat)
        const res = await fetch(`/api/highlights?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load highlights')
        const json = (await res.json()) as HighlightsResponse
        setData(json)
      } catch {
        setError('Could not load highlights')
      } finally {
        setLoading(false)
      }
    },
    [hoursBack, categoryFilter]
  )

  useEffect(() => {
    load()
  }, [load])

  function handleCategoryToggle(cat: string) {
    const next = categoryFilter === cat ? null : cat
    setCategoryFilter(next)
    load(hoursBack, next)
  }

  function handleHoursToggle(h: number) {
    setHoursBack(h)
    load(h, categoryFilter)
  }

  function toggleBookmark(id: string) {
    setBookmarked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const shown = data?.arguments ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <Link
            href="/"
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
            )}
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-gold" aria-hidden />
              <h1 className="font-mono text-2xl font-bold text-white">
                Argument Highlights
              </h1>
            </div>
            {data && (
              <p className="text-sm font-mono text-surface-500">
                {data.periodLabel}
              </p>
            )}
            {loading && !data && (
              <Skeleton className="h-4 w-48" />
            )}
          </div>

          <button
            onClick={() => load()}
            disabled={loading}
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
              'border border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
              'transition-all disabled:opacity-40'
            )}
            aria-label="Refresh highlights"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          </button>
        </div>

        {/* ── Time window toggle ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" aria-hidden />
          <div className="flex gap-1.5">
            {[24, 48, 72].map((h) => (
              <button
                key={h}
                onClick={() => handleHoursToggle(h)}
                disabled={loading}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
                  hoursBack === h
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                )}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* ── Layout: list + sidebar ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">

          {/* Left: category filters + argument list */}
          <div className="space-y-5">

            {/* Category filter pills */}
            {data && data.categoryBreakdown.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setCategoryFilter(null); load(hoursBack, null) }}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono font-medium',
                    'border transition-all flex-shrink-0',
                    !categoryFilter
                      ? 'bg-surface-300 border-surface-400 text-white'
                      : 'border-surface-300 text-surface-500 bg-surface-200/60 hover:border-surface-400 hover:text-white'
                  )}
                >
                  All
                </button>
                {data.categoryBreakdown.map((s) => (
                  <CategoryPill
                    key={s.category}
                    cat={s.category}
                    count={s.count}
                    active={categoryFilter === s.category}
                    onClick={() => handleCategoryToggle(s.category)}
                  />
                ))}
              </div>
            )}

            {/* Stats */}
            {data && !loading && <StatsStrip data={data} />}

            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ArgumentCardSkeleton key={i} rank={i + 1} />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <EmptyState
                icon={Flame}
                iconColor="text-against-400"
                iconBg="bg-against-500/10"
                iconBorder="border-against-500/30"
                title="Couldn't load highlights"
                description={error}
                actions={[
                  { label: 'Try again', onClick: () => load(), variant: 'primary', icon: RefreshCw },
                ]}
              />
            )}

            {/* Empty */}
            {!loading && !error && shown.length === 0 && (
              <EmptyState
                icon={Sparkles}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="No highlights yet"
                description={
                  categoryFilter
                    ? `No ${categoryFilter} arguments in the last ${hoursBack}h. Try widening the time window.`
                    : `No arguments have been posted in the last ${hoursBack}h with upvotes. Be the first to argue!`
                }
                actions={[
                  { label: 'Browse feed', href: '/', variant: 'primary', icon: ArrowRight },
                  ...(categoryFilter
                    ? [{ label: 'Clear filter', onClick: () => { setCategoryFilter(null); load(hoursBack, null) }, variant: 'secondary' as const }]
                    : []),
                ]}
              />
            )}

            {/* Argument list */}
            {!loading && !error && shown.length > 0 && (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {shown.map((arg, i) => (
                    <ArgumentCard
                      key={arg.id}
                      argument={arg}
                      rank={i + 1}
                      bookmarked={bookmarked.has(arg.id)}
                      onBookmark={() => toggleBookmark(arg.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Footer nav */}
            {!loading && shown.length > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href="/argument-of-the-day"
                  className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  <Award className="h-3.5 w-3.5" aria-hidden />
                  Argument of the Day
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
                <span className="text-surface-600" aria-hidden>·</span>
                <Link
                  href="/top-arguments"
                  className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  All-time best
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
                <span className="text-surface-600" aria-hidden>·</span>
                <Link
                  href="/reel"
                  className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  Civic Reel
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            )}
          </div>

          {/* Right: category breakdown sidebar */}
          <aside className="hidden lg:block space-y-4">
            {loading && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
                <Skeleton className="h-4 w-36" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            )}
            {!loading && data && <CategoryBreakdown stats={data.categoryBreakdown} />}

            {/* Quick links */}
            {!loading && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  Related views
                </h2>
                {[
                  { href: '/argument-of-the-day', label: 'Argument of the Day', icon: Award },
                  { href: '/top-arguments', label: 'All-time Champions', icon: Sparkles },
                  { href: '/pulse', label: 'Live Argument Pulse', icon: Zap },
                  { href: '/reel', label: 'Civic Reel', icon: Flame },
                  { href: '/gallery', label: 'Argument Gallery', icon: Gavel },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 text-xs font-mono text-surface-500',
                      'hover:text-white transition-colors group'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0 group-hover:text-for-400 transition-colors" aria-hidden />
                    {label}
                    <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
