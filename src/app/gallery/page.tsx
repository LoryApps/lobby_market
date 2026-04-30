'use client'

/**
 * /gallery — The Argument Gallery
 *
 * A curated visual showcase of the platform's most upvoted arguments,
 * displayed as cinematic quote cards in a masonry-style layout.
 * Distinct from /arguments (list view) — this is a discovery surface
 * that surfaces the best civic reasoning in a visually compelling format.
 *
 * Filters: category · side (FOR/AGAINST) · time period
 * Features: featured top-3 hero row · infinite scroll · card expand
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Quote,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopArgument, TopArgumentsResponse } from '@/app/api/arguments/top/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24
const HERO_COUNT = 3

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const PERIODS = [
  { id: 'all', label: 'All Time' },
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
] as const

type Period = (typeof PERIODS)[number]['id']

const SIDES = [
  { id: 'all', label: 'Both Sides' },
  { id: 'for', label: 'FOR', color: 'text-for-400' },
  { id: 'against', label: 'AGAINST', color: 'text-against-400' },
] as const

type Side = (typeof SIDES)[number]['id']

// ─── Category colors ────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const CATEGORY_BG: Record<string, string> = {
  Economics:   'bg-gold/10',
  Politics:    'bg-for-500/10',
  Technology:  'bg-purple/10',
  Science:     'bg-emerald/10',
  Ethics:      'bg-against-500/10',
  Philosophy:  'bg-for-400/10',
  Culture:     'bg-gold/10',
  Health:      'bg-against-400/10',
  Environment: 'bg-emerald/10',
  Education:   'bg-purple/10',
}

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_BADGE: Record<string, 'person' | 'debator' | 'troll_catcher' | 'elder'> = {
  person: 'person',
  debator: 'debator',
  troll_catcher: 'troll_catcher',
  elder: 'elder',
  lawmaker: 'elder',
  senator: 'elder',
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

// ─── Hero Card (top 3) ────────────────────────────────────────────────────────

function HeroCard({ arg, rank }: { arg: TopArgument; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const isFor = arg.side === 'blue'
  const cat = arg.topic?.category ?? null

  const displayText = expanded
    ? arg.content
    : arg.content.length > 220
    ? arg.content.slice(0, 220).trimEnd() + '…'
    : arg.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      className={cn(
        'relative rounded-2xl border p-5 flex flex-col gap-4 overflow-hidden group',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40',
        'transition-colors duration-200'
      )}
    >
      {/* Rank badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        {rank === 0 && <Trophy className="h-4 w-4 text-gold" />}
        <span className={cn(
          'text-xs font-mono font-bold',
          rank === 0 ? 'text-gold' : rank === 1 ? 'text-surface-400' : 'text-surface-500'
        )}>
          #{rank + 1}
        </span>
      </div>

      {/* Quote icon */}
      <Quote className={cn(
        'h-8 w-8 opacity-20 flex-shrink-0',
        isFor ? 'text-for-400' : 'text-against-400'
      )} />

      {/* Argument text */}
      <p className={cn(
        'text-base leading-relaxed font-medium',
        isFor ? 'text-for-100' : 'text-against-100'
      )}>
        {displayText}
      </p>

      {arg.content.length > 220 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-surface-500 hover:text-surface-300 font-mono flex items-center gap-1 transition-colors w-fit"
        >
          {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
        </button>
      )}

      {/* Side pill */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border',
          isFor
            ? 'bg-for-500/20 border-for-500/40 text-for-300'
            : 'bg-against-500/20 border-against-500/40 text-against-300'
        )}>
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {cat && (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent',
            CATEGORY_COLOR[cat] ?? 'text-surface-400',
            CATEGORY_BG[cat] ?? 'bg-surface-300/10'
          )}>
            {cat}
          </span>
        )}
      </div>

      {/* Topic */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic.id}`}
          className="flex items-start gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors group/link"
        >
          <MessageSquare className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2 group-hover/link:text-white">{arg.topic.statement}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
        </Link>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-300/30">
        <div className="flex items-center gap-2">
          {arg.author && (
            <Link href={`/profile/${arg.author.username}`} className="flex items-center gap-2 group/author">
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name || arg.author.username}
                size="xs"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate group-hover/author:text-for-300 transition-colors">
                  {arg.author.display_name || arg.author.username}
                </p>
                <Badge variant={ROLE_BADGE[arg.author.role] ?? 'person'} className="mt-0.5">
                  {ROLE_LABEL[arg.author.role] ?? arg.author.role}
                </Badge>
              </div>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-surface-500">
          <span className="flex items-center gap-1 font-mono font-semibold text-for-400">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes.toLocaleString()}
          </span>
          <span>{relativeTime(arg.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Gallery Card (masonry items) ─────────────────────────────────────────────

function GalleryCard({ arg, index }: { arg: TopArgument; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const isFor = arg.side === 'blue'
  const cat = arg.topic?.category ?? null

  const PREVIEW_LEN = 180
  const isLong = arg.content.length > PREVIEW_LEN
  const displayText = expanded
    ? arg.content
    : isLong
    ? arg.content.slice(0, PREVIEW_LEN).trimEnd() + '…'
    : arg.content

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3 break-inside-avoid',
        'transition-colors duration-200 cursor-default',
        isFor
          ? 'bg-surface-100 border-surface-300 hover:border-for-500/30'
          : 'bg-surface-100 border-surface-300 hover:border-against-500/30'
      )}
    >
      {/* Side + category row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border',
          isFor
            ? 'bg-for-500/15 border-for-500/30 text-for-300'
            : 'bg-against-500/15 border-against-500/30 text-against-300'
        )}>
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {cat && (
          <span className={cn(
            'text-[10px] font-medium',
            CATEGORY_COLOR[cat] ?? 'text-surface-400'
          )}>
            {cat}
          </span>
        )}
      </div>

      {/* Quote text */}
      <p className="text-sm leading-relaxed text-surface-700">
        {displayText}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[11px] text-surface-500 hover:text-surface-300 font-mono flex items-center gap-1 transition-colors w-fit"
        >
          {expanded ? <><ChevronUp className="h-2.5 w-2.5" /> less</> : <><ChevronDown className="h-2.5 w-2.5" /> more</>}
        </button>
      )}

      {/* Topic */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic.id}`}
          className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors line-clamp-2 flex items-start gap-1 group"
        >
          <MessageSquare className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span className="group-hover:text-white transition-colors">{arg.topic.statement}</span>
        </Link>
      )}

      {/* Author + upvotes */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-300/30">
        {arg.author ? (
          <Link href={`/profile/${arg.author.username}`} className="flex items-center gap-1.5 group">
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name || arg.author.username}
              size="xs"
            />
            <span className="text-[11px] text-surface-500 group-hover:text-white transition-colors truncate max-w-[100px]">
              {arg.author.display_name || `@${arg.author.username}`}
            </span>
          </Link>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-0.5 text-[11px] font-mono text-for-400 font-semibold">
          <ThumbsUp className="h-2.5 w-2.5" />
          {arg.upvotes.toLocaleString()}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4 animate-pulse">
      <div className="h-8 w-8 rounded bg-surface-300/50" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-surface-300/50" />
        <div className="h-4 w-5/6 rounded bg-surface-300/50" />
        <div className="h-4 w-4/6 rounded bg-surface-300/50" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-surface-300/50" />
        <div className="h-5 w-20 rounded-full bg-surface-300/50" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-300/30">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-surface-300/50" />
          <div className="h-3 w-24 rounded bg-surface-300/50" />
        </div>
        <div className="h-3 w-12 rounded bg-surface-300/50" />
      </div>
    </div>
  )
}

function GallerySkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse break-inside-avoid">
      <div className="flex gap-2">
        <div className="h-4 w-12 rounded-full bg-surface-300/50" />
        <div className="h-4 w-16 rounded bg-surface-300/50" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-surface-300/50" />
        <div className="h-3 w-full rounded bg-surface-300/50" />
        <div className="h-3 w-3/4 rounded bg-surface-300/50" />
      </div>
      <div className="h-3 w-full rounded bg-surface-300/50" />
      <div className="flex items-center justify-between pt-2 border-t border-surface-300/30">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-surface-300/50" />
          <div className="h-3 w-20 rounded bg-surface-300/50" />
        </div>
        <div className="h-3 w-8 rounded bg-surface-300/50" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [heroArgs, setHeroArgs] = useState<TopArgument[]>([])
  const [galleryArgs, setGalleryArgs] = useState<TopArgument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(HERO_COUNT)

  const [category, setCategory] = useState('All')
  const [period, setPeriod] = useState<Period>('all')
  const [side, setSide] = useState<Side>('all')

  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const catMenuRef = useRef<HTMLDivElement>(null)

  // Close category dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false)
      }
    }
    if (showCategoryMenu) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showCategoryMenu])

  const buildUrl = useCallback((limit: number, off: number) => {
    const p = new URLSearchParams()
    p.set('limit', String(limit))
    p.set('offset', String(off))
    p.set('period', period)
    if (side !== 'all') p.set('side', side)
    if (category !== 'All') p.set('category', category)
    return `/api/arguments/top?${p}`
  }, [period, side, category])

  const fetchInitial = useCallback(async () => {
    setLoading(true)
    setHeroArgs([])
    setGalleryArgs([])
    setOffset(HERO_COUNT)
    try {
      const totalNeeded = HERO_COUNT + PAGE_SIZE
      const res = await fetch(buildUrl(totalNeeded, 0))
      if (!res.ok) throw new Error('fetch failed')
      const data: TopArgumentsResponse = await res.json()
      setHeroArgs(data.arguments.slice(0, HERO_COUNT))
      setGalleryArgs(data.arguments.slice(HERO_COUNT))
      setTotal(data.total)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  const fetchMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(buildUrl(PAGE_SIZE, offset))
      if (!res.ok) throw new Error('fetch failed')
      const data: TopArgumentsResponse = await res.json()
      setGalleryArgs((prev) => [...prev, ...data.arguments])
      setOffset((o) => o + data.arguments.length)
    } catch {
      // best-effort
    } finally {
      setLoadingMore(false)
    }
  }, [buildUrl, offset, loadingMore])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  const hasMore = offset < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0">
                <Quote className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Argument Gallery
                </h1>
                <p className="text-sm text-surface-500 mt-0.5">
                  The platform&apos;s finest civic reasoning, curated by community votes
                </p>
              </div>
            </div>
            <button
              onClick={fetchInitial}
              disabled={loading}
              aria-label="Refresh gallery"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {/* Period */}
          <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors',
                  period === p.id
                    ? 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Side */}
          <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-lg p-1">
            {SIDES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSide(s.id)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors',
                  side === s.id
                    ? 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <div className="relative" ref={catMenuRef}>
            <button
              onClick={() => setShowCategoryMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              {category}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showCategoryMenu && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showCategoryMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 mt-1 z-30 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[140px]"
                >
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategory(c); setShowCategoryMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === c
                          ? 'bg-surface-300 text-white font-semibold'
                          : 'text-surface-500 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {c === 'All' ? 'All Categories' : c}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Result count */}
          {!loading && (
            <span className="text-xs text-surface-600 font-mono ml-auto">
              {total.toLocaleString()} argument{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Featured Hero Row ─────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-mono font-semibold text-gold uppercase tracking-wider">
              Top Arguments
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: HERO_COUNT }).map((_, i) => (
                <HeroSkeleton key={i} />
              ))}
            </div>
          ) : heroArgs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {heroArgs.map((arg, i) => (
                <HeroCard key={arg.id} arg={arg} rank={i} />
              ))}
            </div>
          ) : null}
        </section>

        {/* ── Gallery Grid ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-4 w-4 text-against-400" />
            <h2 className="text-sm font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Gallery
            </h2>
          </div>

          {loading ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <GallerySkeleton key={i} />
              ))}
            </div>
          ) : galleryArgs.length === 0 && heroArgs.length === 0 ? (
            <EmptyState
              icon={Quote}
              title="No arguments yet"
              description="Be the first to make a compelling argument on a topic."
              action={{ label: 'Browse Topics', href: '/' }}
            />
          ) : galleryArgs.length === 0 ? (
            <div className="text-center py-12 text-surface-600 font-mono text-sm">
              Showing only the top {HERO_COUNT} for this filter
            </div>
          ) : (
            <>
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                <AnimatePresence mode="popLayout">
                  {galleryArgs.map((arg, i) => (
                    <GalleryCard key={arg.id} arg={arg} index={i} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-10">
                  <button
                    onClick={fetchMore}
                    disabled={loadingMore}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                      'bg-surface-200 border border-surface-300 text-sm font-mono font-semibold text-surface-400',
                      'hover:bg-surface-300 hover:text-white hover:border-surface-400 transition-colors',
                      'disabled:opacity-50'
                    )}
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                    ) : (
                      <><ArrowRight className="h-4 w-4" /> Load {PAGE_SIZE} more</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

      </main>

      <BottomNav />
    </div>
  )
}
