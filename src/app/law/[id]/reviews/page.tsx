'use client'

/**
 * /law/[id]/reviews — Law Reviews
 *
 * Citizens rate and review established laws after the debate has settled.
 * Star ratings (1–5) + optional short text (≤ 280 chars) let the community
 * reflect on whether the law turned out to be good civic policy.
 *
 * Distinct from:
 *   /law/[id]/impact    — vote trajectory and quantitative stats
 *   /law/[id]/community — amendments + blueprint notes
 *   topic arguments     — FOR/AGAINST debate during the voting period
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Gavel,
  Loader2,
  RefreshCw,
  Send,
  Star,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ReviewsResponse, LawReview } from '@/app/api/laws/[id]/reviews/route'

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

function starLabel(n: number): string {
  return ['', 'Poor civic policy', 'Needs improvement', 'Acceptable', 'Good policy', 'Excellent law'][n] ?? ''
}

// ─── Star Rating Input ────────────────────────────────────────────────────────

function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none disabled:cursor-not-allowed"
          aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              'h-7 w-7 transition-colors',
              (hover || value) >= n
                ? 'fill-gold text-gold'
                : 'text-surface-400 fill-transparent'
            )}
          />
        </button>
      ))}
      {(hover || value) > 0 && (
        <span className="ml-2 text-sm font-mono text-surface-400">
          {starLabel(hover || value)}
        </span>
      )}
    </div>
  )
}

// ─── Star Distribution Bar ────────────────────────────────────────────────────

function DistributionBar({
  distribution,
  total,
}: {
  distribution: Record<number, number>
  total: number
}) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((n) => {
        const count = distribution[n] ?? 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={n} className="flex items-center gap-2">
            <span className="w-3 text-right text-xs font-mono text-surface-400">{n}</span>
            <Star className="h-3 w-3 fill-gold text-gold flex-shrink-0" />
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="w-6 text-right text-xs font-mono text-surface-500">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Review Card ─────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  isOwn,
  onHelpful,
  onDelete,
}: {
  review: LawReview
  isOwn: boolean
  onHelpful: (id: string) => void
  onDelete: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-xl border p-4',
        isOwn
          ? 'bg-gold/5 border-gold/20'
          : 'bg-surface-100 border-surface-200'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link href={`/profile/${review.author?.username}`}>
            <Avatar
              username={review.author?.username ?? ''}
              avatarUrl={review.author?.avatar_url}
              size={32}
            />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/profile/${review.author?.username}`}
                className="text-sm font-mono font-semibold text-white hover:text-gold transition-colors"
              >
                {review.author?.display_name ?? review.author?.username ?? 'Citizen'}
              </Link>
              {isOwn && (
                <Badge variant="gold" className="text-[10px] px-1.5 py-0.5">You</Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    'h-3 w-3',
                    review.stars >= n ? 'fill-gold text-gold' : 'text-surface-400 fill-transparent'
                  )}
                />
              ))}
              <span className="text-xs font-mono text-surface-500 ml-1">
                {relTime(review.created_at)}
              </span>
            </div>
          </div>
        </div>

        {isOwn && (
          <button
            onClick={onDelete}
            className="text-surface-500 hover:text-against-400 transition-colors"
            aria-label="Delete review"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {review.body && (
        <p className="mt-3 text-sm text-surface-200 leading-relaxed font-mono">
          &ldquo;{review.body}&rdquo;
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => onHelpful(review.id)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-mono transition-colors',
            review.user_marked_helpful
              ? 'text-for-400'
              : 'text-surface-500 hover:text-surface-200'
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span>Helpful{review.helpful > 0 ? ` (${review.helpful})` : ''}</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── Write Review Form ────────────────────────────────────────────────────────

function WriteReviewForm({
  existing,
  onSubmit,
  onCancel,
  submitting,
}: {
  existing: LawReview | null
  onSubmit: (stars: number, body: string) => Promise<void>
  onCancel: () => void
  submitting: boolean
}) {
  const [stars, setStars] = useState(existing?.stars ?? 0)
  const [body, setBody] = useState(existing?.body ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stars) return
    await onSubmit(stars, body)
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-4"
    >
      <div>
        <p className="text-xs font-mono text-surface-400 mb-2">
          {existing ? 'Update your review' : 'Write a review'}
        </p>
        <StarInput value={stars} onChange={setStars} disabled={submitting} />
      </div>

      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 280))}
          disabled={submitting}
          placeholder="Share your thoughts on this law... (optional)"
          rows={3}
          className={cn(
            'w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2',
            'text-sm font-mono text-white placeholder-surface-500',
            'focus:outline-none focus:border-gold/50 resize-none',
            'disabled:opacity-50'
          )}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[11px] font-mono text-surface-500">
            {body.length}/280 characters
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={!stars || submitting}
          className="flex items-center gap-2"
          size="sm"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {existing ? 'Update' : 'Submit'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </motion.form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LawReviewsPage() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [authed, setAuthed] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/reviews`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load reviews')
      const json = (await res.json()) as ReviewsResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Check auth
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setAuthed(!!d?.user))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSubmit(stars: number, body: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/laws/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, body }),
      })
      if (!res.ok) throw new Error('Failed to submit review')
      setShowForm(false)
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error submitting review')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete your review?')) return
    await fetch(`/api/laws/${id}/reviews`, { method: 'DELETE' })
    await fetchData()
  }

  async function handleHelpful(reviewId: string) {
    if (!authed) return
    // Optimistic toggle
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        reviews: prev.reviews.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                user_marked_helpful: !r.user_marked_helpful,
                helpful: r.user_marked_helpful ? r.helpful - 1 : r.helpful + 1,
              }
            : r
        ),
      }
    })
    await fetch(`/api/laws/${id}/reviews/${reviewId}/helpful`, { method: 'POST' })
  }

  const { reviews = [], aggregate, own_review, law } = data ?? {}
  const avg = aggregate ? Math.round(aggregate.avg_stars * 10) / 10 : 0
  const filledStars = Math.round(avg)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Back nav ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/law/${id}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Law</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
          <span className="text-sm font-mono text-surface-300">Reviews</span>
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Star className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Citizen Reviews</h1>
            {law && (
              <p className="text-sm font-mono text-surface-400 mt-0.5 line-clamp-2">
                {law.statement}
              </p>
            )}
          </div>
        </div>

        {/* ── Breadcrumb links ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { href: `/law/${id}`, label: 'Law', icon: Gavel },
            { href: `/law/${id}/impact`, label: 'Impact', icon: null },
            { href: `/law/${id}/blueprint`, label: 'Blueprint', icon: null },
            { href: `/law/${id}/community`, label: 'Community', icon: null },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                href === `/law/${id}/reviews`
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'bg-surface-100 border-surface-200 text-surface-400 hover:text-white hover:border-surface-300'
              )}
            >
              {label}
            </Link>
          ))}
          <Link
            href={`/law/${id}/reviews`}
            className="text-xs font-mono px-3 py-1.5 rounded-lg border bg-gold/10 border-gold/30 text-gold"
          >
            Reviews
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-against-400 font-mono text-sm mb-4">{error}</p>
            <Button onClick={fetchData} size="sm" variant="ghost">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Aggregate score card ──────────────────────────────────── */}
            <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
              <div className="flex items-start gap-6">

                {/* Big number */}
                <div className="flex flex-col items-center">
                  <span className="font-mono text-5xl font-bold text-white">
                    {aggregate && aggregate.total > 0 ? avg.toFixed(1) : '—'}
                  </span>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          'h-4 w-4',
                          filledStars >= n ? 'fill-gold text-gold' : 'text-surface-400 fill-transparent'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-mono text-surface-500 mt-1">
                    {aggregate?.total ?? 0} review{aggregate?.total !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Distribution */}
                <div className="flex-1">
                  {aggregate && aggregate.total > 0 ? (
                    <DistributionBar
                      distribution={aggregate.distribution}
                      total={aggregate.total}
                    />
                  ) : (
                    <p className="text-sm font-mono text-surface-500 mt-2">
                      No reviews yet. Be the first to rate this law.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Write / Edit review CTA ───────────────────────────────── */}
            {authed ? (
              <AnimatePresence mode="wait">
                {showForm ? (
                  <WriteReviewForm
                    key="form"
                    existing={own_review ?? null}
                    onSubmit={handleSubmit}
                    onCancel={() => setShowForm(false)}
                    submitting={submitting}
                  />
                ) : own_review ? (
                  <motion.div
                    key="own"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-gold/20 bg-gold/5 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-sm font-mono text-surface-300">
                      <Check className="h-4 w-4 text-gold" />
                      You reviewed this law
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={cn('h-3.5 w-3.5', own_review.stars >= n ? 'fill-gold text-gold' : 'text-surface-400 fill-transparent')} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowForm(true)}
                        className="text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="text-xs font-mono text-surface-500 hover:text-against-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setShowForm(true)}
                    className={cn(
                      'w-full rounded-xl border border-gold/20 bg-gold/5 p-4',
                      'flex items-center gap-3 hover:bg-gold/10 hover:border-gold/30 transition-colors',
                      'text-left'
                    )}
                  >
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} className="h-5 w-5 text-surface-400 fill-transparent" />
                      ))}
                    </div>
                    <span className="text-sm font-mono text-surface-400">
                      Rate this law — was it good civic policy?
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            ) : (
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-4 text-center">
                <p className="text-sm font-mono text-surface-400">
                  <Link href="/login" className="text-gold hover:underline">Sign in</Link>
                  {' '}to review this law.
                </p>
              </div>
            )}

            {/* ── Reviews list ──────────────────────────────────────────── */}
            <div>
              {reviews.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No reviews yet"
                  description="Be the first citizen to review this established law."
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-mono font-semibold text-surface-300 uppercase tracking-wider">
                      Citizen Reviews
                    </h2>
                    <button
                      onClick={fetchData}
                      className="text-surface-500 hover:text-white transition-colors"
                      aria-label="Refresh reviews"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {reviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        isOwn={review.id === own_review?.id}
                        onHelpful={handleHelpful}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
