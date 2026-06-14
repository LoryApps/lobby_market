'use client'

/**
 * /law/reviews — The Civic Review Feed
 *
 * A platform-wide social feed of all text reviews citizens have left on
 * established laws. Shows what the community thinks about the Codex in
 * their own words — beyond aggregate star ratings.
 *
 * Distinct from:
 *   /law/ratings      — ranks laws by aggregate star score (no text)
 *   /law/[id]/reviews — all reviews for one specific law
 *   /leaderboard/reviews — top reviewers by review count
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gavel,
  RefreshCw,
  Star,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PublicLawReview, AllReviewsResponse } from '@/app/api/laws/reviews/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type SortOption = 'recent' | 'helpful' | 'top' | 'critical'

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'recent',   label: 'Most Recent' },
  { id: 'helpful',  label: 'Most Helpful' },
  { id: 'top',      label: 'Top Rated' },
  { id: 'critical', label: 'Critical' },
]

const STAR_FILTERS = [
  { id: null, label: 'All Stars' },
  { id: 5,    label: '5 Stars' },
  { id: 4,    label: '4 Stars' },
  { id: 3,    label: '3 Stars' },
  { id: 2,    label: '2 Stars' },
  { id: 1,    label: '1 Star' },
]

const STAR_LABEL: Record<number, string> = {
  1: 'Poor civic policy',
  2: 'Needs improvement',
  3: 'Acceptable',
  4: 'Good policy',
  5: 'Excellent law',
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function renderStars(n: number, size: 'sm' | 'md' = 'sm') {
  const cls = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(cls, i <= n ? 'text-gold fill-gold' : 'text-surface-500')}
        />
      ))}
    </span>
  )
}

function formatAvg(n: number | null) {
  if (n === null) return '—'
  return n.toFixed(1)
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: PublicLawReview; index: number }) {
  const [helpful, setHelpful] = useState(review.helpful)
  const [markedHelpful, setMarkedHelpful] = useState(false)
  const [busy, setBusy] = useState(false)

  async function toggleHelpful(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laws/${review.law?.id}/reviews/${review.id}/helpful`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json() as { helpful: boolean }
        setMarkedHelpful(data.helpful)
        setHelpful((h) => data.helpful ? h + 1 : Math.max(0, h - 1))
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="bg-surface-100 border border-surface-300 rounded-2xl p-4 hover:border-surface-400/60 transition-colors"
    >
      {/* Author row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href={review.author ? `/profile/${review.author.username}` : '#'}>
            <Avatar
              src={review.author?.avatar_url ?? null}
              fallback={review.author?.display_name ?? review.author?.username ?? '?'}
              size="sm"
            />
          </Link>
          <div className="min-w-0">
            <Link
              href={review.author ? `/profile/${review.author.username}` : '#'}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate block"
            >
              {review.author?.display_name ?? review.author?.username ?? 'Anonymous'}
            </Link>
            <span className="text-[11px] text-surface-500">{relTime(review.created_at)}</span>
          </div>
        </div>

        {/* Stars */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {renderStars(review.stars)}
          <span className="text-[10px] text-surface-500 font-mono">{STAR_LABEL[review.stars]}</span>
        </div>
      </div>

      {/* Review text */}
      {review.body && (
        <p className="text-sm text-surface-200 leading-relaxed mb-3 line-clamp-4">
          &ldquo;{review.body}&rdquo;
        </p>
      )}

      {/* Law link */}
      <Link
        href={`/law/${review.law?.id}`}
        className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-emerald/30 hover:bg-emerald/5 transition-colors group mb-3"
      >
        <Gavel className="h-3.5 w-3.5 text-emerald mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white group-hover:text-emerald transition-colors line-clamp-2 leading-relaxed">
            {review.law?.statement}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {review.law?.category && (
              <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[review.law.category] ?? 'text-surface-500')}>
                {review.law.category}
              </span>
            )}
            <span className="text-[10px] text-surface-500 font-mono">
              {review.law?.review_count ?? 0} review{(review.law?.review_count ?? 0) !== 1 ? 's' : ''} ·{' '}
              {formatAvg(review.law?.avg_stars ?? null)}★ avg
            </span>
          </div>
        </div>
        <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0 mt-0.5" />
      </Link>

      {/* Helpful button */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggleHelpful}
          disabled={busy}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all',
            'disabled:opacity-50',
            markedHelpful
              ? 'bg-for-600/20 border-for-600/40 text-for-400'
              : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
          )}
        >
          <ThumbsUp className="h-3 w-3" />
          {helpful > 0 && <span>{helpful}</span>}
          {markedHelpful ? 'Helpful' : 'Mark helpful'}
        </button>

        <Link
          href={`/law/${review.law?.id}/reviews`}
          className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
        >
          See all reviews <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Platform Stats Bar ───────────────────────────────────────────────────────

function PlatformStatsBar({ stats }: { stats: AllReviewsResponse['platform_stats'] }) {
  const items = [
    { label: 'Total reviews', value: stats.total_reviews.toLocaleString() },
    { label: 'Avg rating',    value: `${stats.avg_stars}★` },
    { label: 'Laws reviewed', value: stats.laws_reviewed.toLocaleString() },
    { label: 'Reviewers',     value: stats.reviewers.toLocaleString() },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-lg font-mono font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LawReviewsPage() {
  const [reviews, setReviews]           = useState<PublicLawReview[]>([])
  const [platformStats, setPlatformStats] = useState<AllReviewsResponse['platform_stats'] | null>(null)
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [sort, setSort]                 = useState<SortOption>('recent')
  const [category, setCategory]         = useState<string | null>(null)
  const [starsFilter, setStarsFilter]   = useState<number | null>(null)
  const [offset, setOffset]             = useState(0)
  const [hasMore, setHasMore]           = useState(false)
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const LIMIT = 20

  const load = useCallback(async (reset: boolean = false) => {
    if (reset) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        sort,
        limit: String(LIMIT),
        offset: String(reset ? 0 : offset),
      })
      if (category) params.set('category', category)
      if (starsFilter) params.set('stars', String(starsFilter))

      const res = await fetch(`/api/laws/reviews?${params}`)
      if (!res.ok) throw new Error('Failed to load reviews')
      const data = await res.json() as AllReviewsResponse

      if (reset) {
        setReviews(data.reviews)
        setPlatformStats(data.platform_stats)
      } else {
        setReviews((prev) => [...prev, ...data.reviews])
      }
      setTotal(data.total)
      setHasMore(data.reviews.length === LIMIT)
      if (!reset) setOffset((o) => o + LIMIT)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, category, starsFilter, offset])

  // Reset on filter/sort changes
  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category, starsFilter])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/law"
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                <Star className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Citizen Reviews</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  What the Lobby thinks about the laws it made
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/law/ratings"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Top Rated
              </Link>
              <button
                onClick={() => load(true)}
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Platform stats */}
        {platformStats && !loading && (
          <PlatformStatsBar stats={platformStats} />
        )}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3 space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        )}

        {/* Controls: sort + category + stars */}
        <div className="space-y-3 mb-6">
          {/* Sort pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                  sort === opt.id
                    ? 'bg-gold/15 border-gold/50 text-gold'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category dropdown + star filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCatDropdown((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                  category
                    ? 'bg-for-600/15 border-for-600/40 text-for-400'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                )}
              >
                {category ?? 'All categories'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showCatDropdown && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-surface-100 border border-surface-300 rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat === 'All' ? null : cat)
                        setShowCatDropdown(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        (cat === 'All' ? !category : category === cat)
                          ? 'text-for-300 bg-for-600/10'
                          : 'text-surface-400 hover:text-white hover:bg-surface-200'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Star filters */}
            <div className="flex gap-1.5 flex-wrap">
              {STAR_FILTERS.map((sf) => (
                <button
                  key={sf.id ?? 'all'}
                  onClick={() => setStarsFilter(sf.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                    starsFilter === sf.id
                      ? 'bg-gold/15 border-gold/50 text-gold'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                  )}
                >
                  {sf.id !== null && <Star className="h-2.5 w-2.5" />}
                  {sf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs font-mono text-surface-500 mb-4">
            {total.toLocaleString()} review{total !== 1 ? 's' : ''} with text
            {category ? ` in ${category}` : ''}
            {starsFilter ? ` · ${starsFilter}★` : ''}
          </p>
        )}

        {/* Review feed */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <div className="p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No reviews yet"
            description={
              category
                ? `No text reviews in ${category} matching these filters yet.`
                : 'Be the first to leave a review on an established law.'
            }
            action={{ label: 'Browse Laws', href: '/law' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <div className="space-y-4">
              {reviews.map((review, i) => (
                <ReviewCard key={review.id} review={review} index={i} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-6 text-center">
            <button
              onClick={() => load(false)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <>Loading…</>
              ) : (
                <>
                  Load more
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer links */}
        {!loading && reviews.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3 justify-center">
            <Link
              href="/law/ratings"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Trophy className="h-3.5 w-3.5" />
              Law ratings
            </Link>
            <Link
              href="/leaderboard/reviews"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Top reviewers
            </Link>
            <Link
              href="/law"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Gavel className="h-3.5 w-3.5" />
              The Codex
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
