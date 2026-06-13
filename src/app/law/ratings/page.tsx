'use client'

/**
 * /law/ratings — Community Law Ratings
 *
 * Ranks established laws by their citizen star ratings (1–5 ★).
 * A complement to /law/quality (which uses voting data) — this uses the
 * post-establishment review scores that citizens leave after seeing how a
 * law plays out in practice.
 *
 * Distinct from:
 *   /law/quality  — democratic mandate score (vote count × consensus strength)
 *   /law/[id]/reviews — the individual review thread for one law
 *   /leaderboard  — user-level ranking
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Gavel,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RatedLaw, RatingsResponse } from '@/app/api/laws/ratings/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'top', label: 'Top Rated' },
  { value: 'bottom', label: 'Lowest Rated' },
  { value: 'most', label: 'Most Reviewed' },
  { value: 'recent', label: 'Recently Established' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function starColor(avg: number): string {
  if (avg >= 4.5) return 'text-emerald'
  if (avg >= 3.5) return 'text-gold'
  if (avg >= 2.5) return 'text-amber-400'
  return 'text-against-400'
}

function starBg(avg: number): string {
  if (avg >= 4.5) return 'bg-emerald/10 border-emerald/30'
  if (avg >= 3.5) return 'bg-gold/10 border-gold/30'
  if (avg >= 2.5) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-against-500/10 border-against-500/30'
}

function starLabel(avg: number): string {
  if (avg >= 4.5) return 'Excellent'
  if (avg >= 3.5) return 'Good'
  if (avg >= 2.5) return 'Acceptable'
  if (avg >= 1.5) return 'Poor'
  return 'Terrible'
}

function renderStars(avg: number, size = 'sm') {
  const full = Math.floor(avg)
  const half = avg - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const color = starColor(avg)
  return (
    <span className="flex items-center gap-0.5" aria-label={`${avg.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} className={cn(cls, color, 'fill-current')} />
      ))}
      {half && (
        <span className="relative inline-block" style={{ width: size === 'sm' ? 14 : 16 }}>
          <Star className={cn(cls, 'text-surface-400 fill-current absolute')} />
          <Star className={cn(cls, color, 'fill-current absolute')} style={{ clipPath: 'inset(0 50% 0 0)' }} />
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className={cn(cls, 'text-surface-400 fill-current')} />
      ))}
    </span>
  )
}

// ─── Distribution bar ─────────────────────────────────────────────────────────

function DistBar({ law }: { law: RatedLaw }) {
  const counts = [law.star_5, law.star_4, law.star_3, law.star_2, law.star_1]
  const max = Math.max(...counts, 1)
  const starColors = ['text-emerald', 'text-gold', 'text-amber-400', 'text-orange-400', 'text-against-400']
  const barColors = ['bg-emerald/60', 'bg-gold/60', 'bg-amber-400/60', 'bg-orange-400/60', 'bg-against-500/60']

  return (
    <div className="space-y-1">
      {counts.map((count, i) => {
        const starN = 5 - i
        const pct = (count / max) * 100
        return (
          <div key={starN} className="flex items-center gap-2">
            <span className={cn('text-[10px] font-mono font-semibold w-4 flex-shrink-0 tabular-nums', starColors[i])}>
              {starN}★
            </span>
            <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', barColors[i])}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
              />
            </div>
            <span className="text-[10px] font-mono text-surface-600 w-4 text-right flex-shrink-0">
              {count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, rank }: { law: RatedLaw; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const avg = law.avg_stars
  const catColor = CATEGORY_COLORS[law.category ?? ''] ?? 'text-surface-500'
  const sbg = starBg(avg)

  const rankBg =
    rank === 1 ? 'bg-gold/10 border-gold/40 text-gold' :
    rank === 2 ? 'bg-surface-400/10 border-surface-400/40 text-surface-400' :
    rank === 3 ? 'bg-amber-700/10 border-amber-700/40 text-amber-600' :
    'bg-surface-200/40 border-surface-400/20 text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (rank - 1) * 0.04, duration: 0.3 }}
      className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden"
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Rank */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border text-xs font-mono font-bold',
            rankBg
          )}
          aria-label={`Rank ${rank}`}
        >
          {rank <= 3 ? (
            rank === 1 ? <Trophy className="h-4 w-4" /> : `#${rank}`
          ) : (
            `#${rank}`
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            {law.category && (
              <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor)}>
                {law.category}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-mono font-semibold text-white leading-snug line-clamp-2">
            {law.statement}
          </p>

          {/* Star rating row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border', sbg)}>
              {renderStars(avg)}
              <span className={cn('text-xs font-mono font-bold tabular-nums', starColor(avg))}>
                {avg.toFixed(1)}
              </span>
            </div>
            <span className="text-[10px] font-mono text-surface-500">
              {starLabel(avg)} · {law.review_count} review{law.review_count !== 1 ? 's' : ''}
            </span>
            {(law.blue_pct ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
                <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
                <span>{Math.round(law.blue_pct ?? 0)}%</span>
                <span className="text-surface-700">·</span>
                <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
                <span>{100 - Math.round(law.blue_pct ?? 0)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <Link
            href={`/law/${law.id}/reviews`}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 hover:bg-for-500/20 hover:text-for-400 text-surface-500 transition-colors"
            aria-label="View reviews"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setExpanded((x) => !x)}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse distribution' : 'Show rating distribution'}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Expanded distribution */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-surface-300/60">
              <div className="pt-3">
                <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-2">
                  Rating distribution
                </p>
                <DistBar law={law} />
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/law/${law.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    View law <ArrowRight className="h-3 w-3" />
                  </Link>
                  <span className="text-surface-700 text-[10px]">·</span>
                  <Link
                    href={`/law/${law.id}/reviews`}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-gold hover:text-amber-300 transition-colors"
                  >
                    <Star className="h-3 w-3 fill-current" />
                    Write a review
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-lg" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawRatingsPage() {
  const [data, setData] = useState<RatingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState('top')
  const [category, setCategory] = useState('All')
  const [sortOpen, setSortOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort })
      if (category !== 'All') params.set('category', category)
      const res = await fetch(`/api/laws/ratings?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: RatingsResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load law ratings. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [sort, category])

  useEffect(() => {
    load()
  }, [load])

  const laws = data?.laws ?? []
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Top Rated'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/law"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to law codex"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0">
                <Star className="h-4 w-4 text-gold fill-current" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono text-white leading-tight">
                  Law Ratings
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  Citizen reviews of established laws · 1–5 ★
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Context banner ─────────────────────────────────────────── */}
        <div className="rounded-xl bg-surface-100 border border-gold/20 p-4 mb-5 flex items-start gap-3">
          <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
            <Gavel className="h-4 w-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              After a topic becomes law, citizens reflect on whether it turned out to be good policy.
              These ratings capture post-establishment sentiment — separate from the original vote.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Link
                href="/law"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Browse all laws <ArrowRight className="h-3 w-3" />
              </Link>
              <span className="text-surface-700 text-[10px]">·</span>
              <Link
                href="/law/quality"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald hover:text-emerald/80 transition-colors"
              >
                Quality Index <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setSortOpen((x) => !x); setCatOpen(false) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white',
                sortOpen && 'border-for-500/50 text-for-400'
              )}
            >
              {sortLabel}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', sortOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-10 left-0 z-20 w-44 rounded-xl bg-surface-100 border border-surface-300 shadow-xl shadow-black/30 overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSort(opt.value); setSortOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-xs font-mono transition-colors',
                        sort === opt.value
                          ? 'bg-for-500/10 text-for-400'
                          : 'text-surface-500 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Category */}
          <div className="relative">
            <button
              onClick={() => { setCatOpen((x) => !x); setSortOpen(false) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white',
                catOpen && 'border-for-500/50 text-for-400',
                category !== 'All' && 'border-for-500/40 text-for-400 bg-for-500/10'
              )}
            >
              {category}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', catOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-10 left-0 z-20 w-48 rounded-xl bg-surface-100 border border-surface-300 shadow-xl shadow-black/30 overflow-hidden max-h-64 overflow-y-auto"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-xs font-mono transition-colors',
                        category === cat
                          ? 'bg-for-500/10 text-for-400'
                          : 'text-surface-500 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stats chip */}
          {data && (
            <span className="ml-auto text-[11px] font-mono text-surface-600">
              {data.total} rated law{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <EmptyState
            icon={Star}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load ratings"
            description={error}
            actions={[{ label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw }]}
          />
        ) : laws.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No rated laws yet"
            description={
              category !== 'All'
                ? `No ${category} laws have been reviewed yet. Be the first to leave a rating.`
                : 'No laws have been reviewed yet. Visit any established law to leave the first rating.'
            }
            actions={[
              { label: 'Browse laws', href: '/law', variant: 'primary', icon: Gavel },
            ]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${sort}-${category}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {laws.map((law, i) => (
                <LawCard key={law.id} law={law} rank={i + 1} />
              ))}

              {/* CTA footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 text-center mt-4"
              >
                <p className="text-xs font-mono text-surface-500 mb-3">
                  Have an opinion on these laws? Leave your rating.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/law"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
                  >
                    <Gavel className="h-3.5 w-3.5" />
                    Browse Laws
                  </Link>
                  <Link
                    href="/law/quality"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white text-xs font-mono font-medium hover:bg-surface-300 transition-colors"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Quality Index
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
