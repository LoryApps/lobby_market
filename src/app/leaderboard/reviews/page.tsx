'use client'

/**
 * /leaderboard/reviews — Law Reviewers Leaderboard
 *
 * Ranks citizens by their engagement with the law review system:
 *   Top Reviewers  — most law reviews written (any star rating)
 *   Most Helpful   — whose written reviews earned the most helpful votes (min 2 reviews)
 *   Top Rated Laws — established laws with the most reviews and highest average stars
 *
 * Distinct from:
 *   /law/ratings         — ranks laws by avg star score (community ratings)
 *   /law/[id]/reviews    — all reviews for a specific law
 *   /leaderboard/amendments — ranks amendment proposers/voters
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Star,
  ThumbsUp,
  Trophy,
  MessageSquare,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  ReviewLeaderboardResponse,
  ReviewerEntry,
  TopReviewedLaw,
  RecentReview,
} from '@/app/api/leaderboard/reviews/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-surface-500'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-600/10 border-amber-600/30'
  return 'bg-surface-100 border-surface-300/50 hover:border-surface-400/50'
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-3.5 w-3.5 text-gold" />
  if (rank === 2) return <Trophy className="h-3.5 w-3.5 text-surface-300" />
  if (rank === 3) return <Trophy className="h-3.5 w-3.5 text-amber-600" />
  return null
}

function StarBar({ stars, max = 5 }: { stars: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${stars} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < Math.round(stars) ? 'text-gold fill-gold' : 'text-surface-400'
          )}
        />
      ))}
    </div>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ROLE_COLORS: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  senator: 'text-purple',
  person: 'text-surface-500',
}

const ROLE_LABELS: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debator',
  senator: 'Senator',
  person: 'Citizen',
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string }> = {
  Politics:    { text: 'text-for-400',   bg: 'bg-for-500/10' },
  Economics:   { text: 'text-gold',       bg: 'bg-gold/10' },
  Technology:  { text: 'text-purple',     bg: 'bg-purple/10' },
  Science:     { text: 'text-emerald',    bg: 'bg-emerald/10' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10' },
  Philosophy:  { text: 'text-for-300',   bg: 'bg-for-400/10' },
  Culture:     { text: 'text-gold',       bg: 'bg-gold/10' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10' },
  Environment: { text: 'text-emerald',   bg: 'bg-emerald/10' },
  Education:   { text: 'text-purple',    bg: 'bg-purple/10' },
}

// ─── SkeletonRow ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300/50">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-1.5 text-right">
        <Skeleton className="h-4 w-10 ml-auto" />
        <Skeleton className="h-3 w-14 ml-auto" />
      </div>
    </div>
  )
}

// ─── ReviewerRow ─────────────────────────────────────────────────────────────

function ReviewerRow({ entry, rank, metric }: {
  entry: ReviewerEntry
  rank: number
  metric: 'count' | 'helpful'
}) {
  const roleColor = ROLE_COLORS[entry.role] ?? 'text-surface-500'
  const roleLabel = ROLE_LABELS[entry.role] ?? 'Citizen'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-colors',
        rank <= 3 ? rankBg(rank) : rankBg(rank + 1)
      )}
    >
      {/* Rank */}
      <div className={cn('w-6 text-center flex-shrink-0', rankColor(rank))}>
        {rank <= 3 ? (
          <div className="flex justify-center">{rankIcon(rank)}</div>
        ) : (
          <span className="font-mono text-xs">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Avatar
        src={entry.avatar_url}
        fallback={entry.display_name || entry.username}
        size="sm"
        className="flex-shrink-0"
      />

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${entry.username}`}
          className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors truncate block"
        >
          {entry.display_name ?? entry.username}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('font-mono text-xs', roleColor)}>{roleLabel}</span>
          {entry.written_reviews > 0 && (
            <span className="font-mono text-xs text-surface-500">
              · {entry.written_reviews} written
            </span>
          )}
        </div>
      </div>

      {/* Stars */}
      <div className="flex-shrink-0 hidden sm:block">
        <StarBar stars={entry.avg_stars_given} />
        <p className="font-mono text-xs text-surface-500 text-center mt-0.5">avg given</p>
      </div>

      {/* Primary metric */}
      <div className="text-right flex-shrink-0">
        {metric === 'count' ? (
          <>
            <div className="font-mono text-sm font-bold text-white">{entry.review_count}</div>
            <div className="font-mono text-xs text-surface-500">reviews</div>
          </>
        ) : (
          <>
            <div className="font-mono text-sm font-bold text-for-400">{entry.helpful_total}</div>
            <div className="font-mono text-xs text-surface-500">helpful votes</div>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── TopLawRow ───────────────────────────────────────────────────────────────

function TopLawRow({ law, rank }: { law: TopReviewedLaw; rank: number }) {
  const catStyle = CATEGORY_COLORS[law.category ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
      className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300/50 hover:border-surface-400/50 transition-colors"
    >
      {/* Rank */}
      <div className={cn('w-6 text-center flex-shrink-0 pt-0.5', rankColor(rank))}>
        {rank <= 3 ? (
          <div className="flex justify-center">{rankIcon(rank)}</div>
        ) : (
          <span className="font-mono text-xs">{rank}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <Link
            href={`/law/${law.law_id}`}
            className="font-mono text-sm font-semibold text-white hover:text-gold transition-colors line-clamp-2 leading-snug flex-1"
          >
            {law.statement}
          </Link>
          <Link
            href={`/law/${law.law_id}/reviews`}
            className="flex-shrink-0 text-surface-500 hover:text-white transition-colors"
            aria-label="View reviews"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {law.category && (
            <span className={cn('font-mono text-xs px-1.5 py-0.5 rounded', catStyle.text, catStyle.bg)}>
              {law.category}
            </span>
          )}
          <div className="flex items-center gap-1">
            <StarBar stars={law.avg_stars} />
            <span className="font-mono text-xs text-gold">{law.avg_stars}</span>
          </div>
          <span className="font-mono text-xs text-surface-500">
            {law.review_count} {law.review_count === 1 ? 'review' : 'reviews'}
          </span>
          {law.helpful_total > 0 && (
            <span className="font-mono text-xs text-surface-500">
              · {law.helpful_total} helpful
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── RecentReviewCard ─────────────────────────────────────────────────────────

function RecentReviewCard({ review }: { review: RecentReview }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300/50 p-4 space-y-2.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={review.reviewer_avatar}
            fallback={review.reviewer_username}
            size="xs"
            className="flex-shrink-0"
          />
          <Link
            href={`/profile/${review.reviewer_username}`}
            className="font-mono text-xs font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {review.reviewer_username}
          </Link>
          <span className="font-mono text-xs text-surface-500 flex-shrink-0">{relativeTime(review.created_at)}</span>
        </div>
        <StarBar stars={review.stars} />
      </div>

      {/* Review body */}
      {review.body && (
        <p className="font-mono text-xs text-surface-300 leading-relaxed line-clamp-3">
          {review.body}
        </p>
      )}

      {/* Law link */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Link
          href={`/law/${review.law_id}`}
          className="font-mono text-xs text-gold hover:text-gold/80 transition-colors truncate flex items-center gap-1"
        >
          <Gavel className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{review.law_statement}</span>
        </Link>
        {review.helpful > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0 font-mono text-xs text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {review.helpful}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'reviewers' | 'helpful' | 'laws'

const TABS: { id: Tab; label: string; icon: typeof Star }[] = [
  { id: 'reviewers', label: 'Top Reviewers', icon: Star },
  { id: 'helpful', label: 'Most Helpful', icon: ThumbsUp },
  { id: 'laws', label: 'Top Rated Laws', icon: Gavel },
]

// ─── Main client ─────────────────────────────────────────────────────────────

function ReviewLeaderboardClient() {
  const [data, setData] = useState<ReviewLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('reviewers')
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leaderboard/reviews', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      load()
    }
  }, [load])

  const totals = data?.totals
  const myStats = data?.myStats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leaderboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                <Star className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Law Reviewers
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Citizens who rate and critique the Codex — ranked by impact.
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh leaderboard"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Platform stats strip ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {(
            [
              { label: 'Total', value: totals?.total_reviews ?? 0, color: 'text-white' },
              { label: 'Written', value: totals?.written_reviews ?? 0, color: 'text-for-400' },
              { label: 'Reviewers', value: totals?.unique_reviewers ?? 0, color: 'text-purple' },
              { label: 'Laws', value: totals?.unique_laws_reviewed ?? 0, color: 'text-gold' },
              { label: 'Helpful', value: totals?.total_helpful_votes ?? 0, color: 'text-emerald' },
              {
                label: 'Avg Stars',
                value: totals?.platform_avg_stars ?? 0,
                color: 'text-gold',
                decimals: 1,
              },
            ] as const
          ).map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
            >
              <div className={cn('font-mono text-lg font-bold', color)}>
                {loading ? (
                  <Skeleton className="h-6 w-10 mx-auto" />
                ) : (
                  <AnimatedNumber value={value} />
                )}
              </div>
              <div className="font-mono text-xs text-surface-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── My Stats ────────────────────────────────────────────────────── */}
        {myStats && myStats.review_count > 0 && (
          <div className="mb-6 rounded-2xl bg-gold/5 border border-gold/20 p-4">
            <p className="font-mono text-xs text-gold uppercase tracking-wider mb-3">
              Your Review Record
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-white">{myStats.review_count}</div>
                <div className="font-mono text-xs text-surface-500">reviews</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-for-400">{myStats.written_reviews}</div>
                <div className="font-mono text-xs text-surface-500">written</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-emerald">{myStats.helpful_total}</div>
                <div className="font-mono text-xs text-surface-500">helpful votes</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-gold">{myStats.avg_stars_given}</div>
                <div className="font-mono text-xs text-surface-500">avg stars</div>
              </div>
            </div>
            {myStats.reviewer_rank !== null && (
              <p className="font-mono text-xs text-surface-500 text-center mt-3">
                You rank <span className="text-white font-bold">#{myStats.reviewer_rank}</span> among
                top reviewers
              </p>
            )}
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-surface-200/50 p-1 rounded-xl mb-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-mono text-xs font-semibold transition-colors',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* ── Tab description ─────────────────────────────────────────────── */}
        <p className="mb-4 font-mono text-xs text-surface-500">
          {tab === 'reviewers' && 'Citizens ranked by total law reviews submitted — the most active evaluators of the Codex.'}
          {tab === 'helpful' && 'Reviewers whose written critiques have been marked most helpful by the community. Minimum 2 written reviews.'}
          {tab === 'laws' && 'Established laws with the most community reviews — ranked by review count, then average star rating.'}
        </p>

        {/* ── List ────────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div key="skeleton" className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : (
            <div key={tab} className="space-y-2">
              {tab === 'reviewers' && (
                <>
                  {(data?.topReviewers.length ?? 0) === 0 ? (
                    <EmptyState
                      icon={Star}
                      title="No reviews yet"
                      description="Be the first to leave a star rating on an established law."
                      action={{ label: 'Browse Laws', href: '/law' }}
                    />
                  ) : (
                    data!.topReviewers.map((entry, i) => (
                      <ReviewerRow key={entry.user_id} entry={entry} rank={i + 1} metric="count" />
                    ))
                  )}
                </>
              )}

              {tab === 'helpful' && (
                <>
                  {(data?.mostHelpful.length ?? 0) === 0 ? (
                    <EmptyState
                      icon={ThumbsUp}
                      title="No helpful votes yet"
                      description="Write detailed law reviews to earn helpful votes from the community."
                      action={{ label: 'Review a Law', href: '/law' }}
                    />
                  ) : (
                    data!.mostHelpful.map((entry, i) => (
                      <ReviewerRow key={entry.user_id} entry={entry} rank={i + 1} metric="helpful" />
                    ))
                  )}
                </>
              )}

              {tab === 'laws' && (
                <>
                  {(data?.topRatedLaws.length ?? 0) === 0 ? (
                    <EmptyState
                      icon={Gavel}
                      title="No laws reviewed yet"
                      description="Start reviewing established laws to build the rating system."
                      action={{ label: 'Browse Laws', href: '/law' }}
                    />
                  ) : (
                    data!.topRatedLaws.map((law, i) => (
                      <TopLawRow key={law.law_id} law={law} rank={i + 1} />
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* ── Recent Reviews ───────────────────────────────────────────────── */}
        {!loading && (data?.recentReviews.length ?? 0) > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gold" />
                Recent Written Reviews
              </h2>
              <Link
                href="/law/ratings"
                className="font-mono text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                Community ratings <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data!.recentReviews.map((review) => (
                <RecentReviewCard key={review.review_id} review={review} />
              ))}
            </div>
          </section>
        )}

        {/* ── Quick links ──────────────────────────────────────────────────── */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/law/ratings"
            className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-gold/40 hover:bg-gold/5 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Star className="h-4 w-4 text-gold" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">Community Ratings</p>
                <p className="font-mono text-xs text-surface-500">Laws ranked by star rating</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
          </Link>

          <Link
            href="/law"
            className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-gold/40 hover:bg-gold/5 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Gavel className="h-4 w-4 text-gold" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">The Codex</p>
                <p className="font-mono text-xs text-surface-500">Review an established law</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
          </Link>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function ReviewLeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
      </div>
    }>
      <ReviewLeaderboardClient />
    </Suspense>
  )
}
