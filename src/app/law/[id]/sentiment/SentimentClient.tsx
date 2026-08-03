'use client'

/**
 * /law/[id]/sentiment — Community Sentiment Analysis
 *
 * Tracks how the community feels about an established law post-passage:
 *   STAR RATINGS   — community reviews scored 1–5
 *   ARGUMENT TONE  — FOR vs AGAINST argument balance from original debate
 *   CHALLENGE      — formal challenges signal friction
 *   AMENDMENT      — pending amendments signal desire for change
 *
 * Distinct from:
 *   /law/[id]/reviews     — raw reviews list + submission form
 *   /law/[id]/dissent     — minority position arguments
 *   /law/[id]/challenge   — formal challenge filing
 *   /law/[id]/mandate     — original vote margin analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawSentimentData, ReviewItem } from '@/app/api/laws/[id]/sentiment/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Sentiment label config ───────────────────────────────────────────────────

const SENTIMENT_CONFIG: Record<LawSentimentData['sentimentLabel'], {
  color: string; bg: string; border: string; icon: typeof Sparkles; description: string
}> = {
  Endorsed: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Sparkles,
    description: 'Strong positive community support post-passage',
  },
  Accepted: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: CheckCircle2,
    description: 'Broadly accepted with minor friction',
  },
  Contested: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
    description: 'Mixed reception — active debate continues',
  },
  Disputed: {
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: AlertTriangle,
    description: 'Significant community opposition or challenge pressure',
  },
  Opposed: {
    color: 'text-against-500',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    icon: XCircle,
    description: 'High challenge pressure — law stability at risk',
  },
}

// ─── Stars display ────────────────────────────────────────────────────────────

function StarRow({ filled }: { filled: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= filled ? 'text-gold fill-gold' : 'text-surface-500',
          )}
        />
      ))}
    </span>
  )
}

// ─── Rating bar ───────────────────────────────────────────────────────────────

function RatingBar({
  stars,
  count,
  pct,
  max,
}: {
  stars: number
  count: number
  pct: number
  max: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-surface-400 w-10 text-right">{stars}★</span>
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gold"
          initial={{ width: 0 }}
          animate={{ width: max > 0 ? `${(count / max) * 100}%` : '0%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-500 w-8 tabular-nums">{pct}%</span>
    </div>
  )
}

// ─── Review card ─────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <div className="border-t border-surface-300 pt-4 first:border-0 first:pt-0">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${review.author?.username ?? '#'}`} className="flex-shrink-0">
          <Avatar
            src={review.author?.avatar_url ?? null}
            fallback={review.author?.display_name ?? review.author?.username ?? '?'}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Link
              href={`/profile/${review.author?.username ?? '#'}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
            >
              {review.author?.display_name ?? review.author?.username ?? 'Anonymous'}
            </Link>
            <div className="flex items-center gap-2">
              <StarRow filled={review.stars} />
              <span className="text-[10px] text-surface-500">{formatDate(review.created_at)}</span>
            </div>
          </div>
          {review.body && (
            <p className="mt-1.5 text-xs text-surface-500 leading-relaxed">{review.body}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Gauge arc (SVG) ─────────────────────────────────────────────────────────

function SentimentGauge({ score, color }: { score: number; color: string }) {
  const radius = 44
  const cx = 60
  const cy = 60
  const startAngle = -200
  const sweep = 220

  function polarToXY(deg: number, r: number) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function describeArc(start: number, end: number, r: number) {
    const s = polarToXY(start, r)
    const e = polarToXY(end, r)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const needleAngle = startAngle + (score / 100) * sweep
  const needleEnd = polarToXY(needleAngle, 34)

  return (
    <svg viewBox="0 0 120 80" className="w-full max-w-[140px]">
      {/* Track */}
      <path
        d={describeArc(startAngle, startAngle + sweep, radius)}
        fill="none"
        stroke="#2a2d36"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Fill */}
      <motion.path
        d={describeArc(startAngle, startAngle + (score / 100) * sweep, radius)}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      {/* Needle */}
      <motion.line
        x1={cx}
        y1={cy}
        x2={needleEnd.x}
        y2={needleEnd.y}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      />
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
      {/* Score */}
      <text x={cx} y={cy + 16} textAnchor="middle" className="text-[10px]" fill="#ffffff" fontSize="11" fontFamily="monospace" fontWeight="700">
        {score}
      </text>
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
}

export function SentimentClient({ lawId }: Props) {
  const [data, setData] = useState<LawSentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/sentiment`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json as LawSentimentData)
    } catch {
      setError('Could not load sentiment data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const cfg = data ? SENTIMENT_CONFIG[data.sentimentLabel] : null
  const SentimentIcon = cfg?.icon ?? Sparkles

  const maxBandCount = data
    ? Math.max(...data.ratingBands.map((b) => b.count), 1)
    : 1

  // SVG gauge color
  const gaugeColor =
    !data ? '#6b7280'
    : data.sentimentScore >= 75 ? '#10b981'
    : data.sentimentScore >= 58 ? '#3b82f6'
    : data.sentimentScore >= 42 ? '#f59e0b'
    : data.sentimentScore >= 25 ? '#f97316'
    : '#ef4444'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* ── Back + header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-mono text-lg font-bold text-white">Community Sentiment</h1>
            {data && (
              <p className="text-xs text-surface-500 font-mono truncate">
                {data.law.statement.slice(0, 70)}{data.law.statement.length > 70 ? '…' : ''}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-xl bg-against-600/10 border border-against-600/30 text-against-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Loading skeletons ──────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {data && cfg && (
          <>
            {/* ── Sentiment score card ──────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-5 rounded-2xl border',
                cfg.bg, cfg.border,
              )}
            >
              <div className="flex items-start gap-4">
                {/* Gauge */}
                <div className="flex-shrink-0 w-32">
                  <SentimentGauge score={data.sentimentScore} color={gaugeColor} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SentimentIcon className={cn('h-4 w-4', cfg.color)} />
                    <span className={cn('font-mono font-bold text-lg', cfg.color)}>
                      {data.sentimentLabel}
                    </span>
                    <Badge className={cn('text-[10px] font-mono', cfg.bg, cfg.color, cfg.border)}>
                      {data.sentimentScore}/100
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 mb-3">{cfg.description}</p>

                  {/* Category benchmark */}
                  {data.categoryBenchmark.lawCount > 0 && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
                      <BarChart2 className="h-3 w-3 flex-shrink-0" />
                      <span>
                        Category avg: {data.categoryBenchmark.avgSentimentScore}/100
                        {' · '}{data.categoryBenchmark.lawCount} similar laws
                      </span>
                      {data.sentimentScore > data.categoryBenchmark.avgSentimentScore + 5 && (
                        <span className="text-emerald flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" /> Above avg
                        </span>
                      )}
                      {data.sentimentScore < data.categoryBenchmark.avgSentimentScore - 5 && (
                        <span className="text-against-400 flex items-center gap-0.5">
                          <TrendingDown className="h-3 w-3" /> Below avg
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── Stat pills ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Reviews',
                  value: data.totalReviews,
                  icon: Star,
                  color: 'text-gold',
                  sub: data.avgStars !== null ? `${data.avgStars.toFixed(1)}/5 avg` : 'No reviews',
                },
                {
                  label: 'Challenges',
                  value: data.challengeSignal.totalChallenges,
                  icon: Shield,
                  color: data.challengeSignal.openChallenges > 0 ? 'text-against-400' : 'text-surface-400',
                  sub: `${data.challengeSignal.openChallenges} open`,
                },
                {
                  label: 'Amendments',
                  value: data.amendmentSignal.totalAmendments,
                  icon: FileWarning,
                  color: data.amendmentSignal.pendingAmendments > 0 ? 'text-gold' : 'text-surface-400',
                  sub: `${data.amendmentSignal.pendingAmendments} pending`,
                },
                {
                  label: 'Arguments',
                  value: data.argumentSentiment.totalArguments,
                  icon: MessageSquare,
                  color: 'text-for-400',
                  sub: `${data.argumentSentiment.forArguments}F / ${data.argumentSentiment.againstArguments}A`,
                },
              ].map(({ label, value, icon: Icon, color, sub }) => (
                <div
                  key={label}
                  className="p-3 rounded-xl bg-surface-200/60 border border-surface-300 text-center"
                >
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <p className="font-mono font-bold text-white text-lg tabular-nums">{value}</p>
                  <p className="text-[10px] text-surface-500">{label}</p>
                  <p className={cn('text-[10px] font-mono mt-0.5', color)}>{sub}</p>
                </div>
              ))}
            </div>

            {/* ── Star rating breakdown ──────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  <Star className="h-4 w-4 text-gold" />
                  Community Ratings
                </h2>
                {data.avgStars !== null && (
                  <div className="flex items-center gap-1.5">
                    <StarRow filled={Math.round(data.avgStars)} />
                    <span className="text-xs font-mono text-gold">{data.avgStars.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {data.totalReviews === 0 ? (
                <EmptyState
                  icon={Star}
                  title="No reviews yet"
                  description="Be the first to rate this law"
                  action={{ label: 'Leave a review', href: `/law/${lawId}/reviews` }}
                />
              ) : (
                <div className="space-y-2">
                  {data.ratingBands.map((band) => (
                    <RatingBar
                      key={band.label}
                      stars={parseInt(band.label)}
                      count={band.count}
                      pct={band.pct}
                      max={maxBandCount}
                    />
                  ))}
                  <p className="text-[10px] text-surface-500 text-right pt-1">
                    {data.totalReviews} review{data.totalReviews !== 1 ? 's' : ''} total
                    {' · '}
                    <Link href={`/law/${lawId}/reviews`} className="text-for-400 hover:underline">
                      View all
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* ── Argument sentiment ─────────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300 space-y-4">
              <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-for-400" />
                Original Debate Arguments
              </h2>

              {data.argumentSentiment.totalArguments === 0 ? (
                <p className="text-xs text-surface-500 text-center py-2">No arguments on record</p>
              ) : (
                <>
                  {/* FOR / AGAINST bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-for-400">FOR {data.argumentSentiment.forArguments}</span>
                      <span className="text-against-400">AGAINST {data.argumentSentiment.againstArguments}</span>
                    </div>
                    <div className="h-2 rounded-full bg-against-600/40 overflow-hidden flex">
                      <div
                        className="h-full bg-for-500 rounded-l-full transition-all"
                        style={{
                          width: `${data.argumentSentiment.totalArguments > 0
                            ? (data.argumentSentiment.forArguments / data.argumentSentiment.totalArguments) * 100
                            : 50}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Top arguments */}
                  <div className="space-y-3">
                    {data.argumentSentiment.topUpvotedFor && (
                      <div className="p-3 rounded-xl bg-for-600/10 border border-for-600/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                          <span className="text-[10px] font-mono text-for-400 font-semibold">Top FOR argument</span>
                          <span className="ml-auto text-[10px] text-surface-500 font-mono">
                            {data.argumentSentiment.topUpvotedFor.upvotes} upvotes
                          </span>
                        </div>
                        <p className="text-xs text-surface-300 leading-relaxed line-clamp-3">
                          &ldquo;{data.argumentSentiment.topUpvotedFor.content}&rdquo;
                        </p>
                      </div>
                    )}
                    {data.argumentSentiment.topUpvotedAgainst && (
                      <div className="p-3 rounded-xl bg-against-600/10 border border-against-600/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                          <span className="text-[10px] font-mono text-against-400 font-semibold">Top AGAINST argument</span>
                          <span className="ml-auto text-[10px] text-surface-500 font-mono">
                            {data.argumentSentiment.topUpvotedAgainst.upvotes} upvotes
                          </span>
                        </div>
                        <p className="text-xs text-surface-300 leading-relaxed line-clamp-3">
                          &ldquo;{data.argumentSentiment.topUpvotedAgainst.content}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Challenge & amendment pressure ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Challenges */}
              <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-against-400" />
                    Challenges
                  </h2>
                  <Link
                    href={`/law/${lawId}/challenge`}
                    className="text-[11px] text-for-400 hover:underline font-mono flex items-center gap-0.5"
                  >
                    View <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Open', count: data.challengeSignal.openChallenges, color: 'text-against-400' },
                    { label: 'Upheld', count: data.challengeSignal.uphelChallenges, color: 'text-emerald' },
                    { label: 'Dismissed', count: data.challengeSignal.dismissedChallenges, color: 'text-surface-500' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-surface-500">{label}</span>
                      <span className={cn('font-mono font-semibold', color)}>{count}</span>
                    </div>
                  ))}
                  <div className="border-t border-surface-400/30 pt-1.5 flex items-center justify-between text-xs">
                    <span className="text-surface-500">Total</span>
                    <span className="font-mono font-bold text-white">{data.challengeSignal.totalChallenges}</span>
                  </div>
                </div>
              </div>

              {/* Amendments */}
              <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-gold" />
                    Amendments
                  </h2>
                  <Link
                    href={`/law/${lawId}/amendments`}
                    className="text-[11px] text-for-400 hover:underline font-mono flex items-center gap-0.5"
                  >
                    View <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Pending', count: data.amendmentSignal.pendingAmendments, color: 'text-gold' },
                    { label: 'Ratified', count: data.amendmentSignal.ratifiedAmendments, color: 'text-emerald' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-surface-500">{label}</span>
                      <span className={cn('font-mono font-semibold', color)}>{count}</span>
                    </div>
                  ))}
                  <div className="border-t border-surface-400/30 pt-1.5 flex items-center justify-between text-xs">
                    <span className="text-surface-500">Total</span>
                    <span className="font-mono font-bold text-white">{data.amendmentSignal.totalAmendments}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Recent reviews ────────────────────────────────────────── */}
            {data.recentReviews.length > 0 && (
              <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="h-4 w-4 text-against-400" />
                    Recent Reviews
                  </h2>
                  <Link
                    href={`/law/${lawId}/reviews`}
                    className="text-[11px] text-for-400 hover:underline font-mono flex items-center gap-0.5"
                  >
                    All reviews <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-4">
                  {data.recentReviews.slice(0, 5).map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Quick links ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Write a Review', href: `/law/${lawId}/reviews`, icon: Star, color: 'text-gold' },
                { label: 'File a Challenge', href: `/law/${lawId}/challenge`, icon: Shield, color: 'text-against-400' },
                { label: 'Propose Amendment', href: `/law/${lawId}/amendments`, icon: FileWarning, color: 'text-gold' },
                { label: 'Law Adoption', href: `/law/${lawId}/adoption`, icon: Zap, color: 'text-emerald' },
              ].map(({ label, href, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                    {label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto" />
                </Link>
              ))}
            </div>

            {/* ── Back to law ───────────────────────────────────────────── */}
            <div className="pt-2">
              <Link
                href={`/law/${lawId}`}
                className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="h-4 w-4" />
                Back to law
              </Link>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
