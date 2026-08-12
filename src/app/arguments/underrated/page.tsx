'use client'

/**
 * /arguments/underrated — Hidden Gem Arguments
 *
 * Surfaces high-quality arguments (AI score ≥ 6, grade B or above) that
 * haven't yet found their audience (≤ 15 upvotes). These are the arguments
 * worth reading that most people missed.
 *
 * Distinct from:
 *   /arguments/top-scored  — ranked by absolute quality; high-upvote dominant
 *   /arguments/trending    — short-term velocity; already gaining traction
 *   /arguments/hall-of-fame — all-time best on established laws
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  ChevronDown,
  Crown,
  ExternalLink,
  Gavel,
  Gem,
  GitMerge,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GradeFilter, Period, SideFilter, UnderratedArgument, UnderratedResponse } from '@/app/api/arguments/underrated/route'

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { label: string; className: string; icon: typeof Star }> = {
  A: { label: 'Grade A', className: 'bg-gold/15 text-gold border-gold/30', icon: Crown },
  B: { label: 'Grade B', className: 'bg-emerald/15 text-emerald border-emerald/30', icon: Star },
  C: { label: 'Grade C', className: 'bg-for-500/15 text-for-400 border-for-500/30', icon: Brain },
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cfg = GRADE_CONFIG[grade]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Health:      'bg-for-500/10 text-for-400 border-for-500/30',
  Society:     'bg-gold/10 text-gold border-gold/30',
  Law:         'bg-gold/10 text-gold border-gold/30',
}

function catClass(cat: string | null) {
  if (!cat) return 'bg-surface-300/40 text-surface-500 border-surface-400/30'
  return CATEGORY_COLORS[cat] ?? 'bg-surface-300/40 text-surface-500 border-surface-400/30'
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (mo >= 1) return `${mo}mo ago`
  if (d >= 1) return `${d}d ago`
  return 'today'
}

// ─── Gem score label ──────────────────────────────────────────────────────────

function gemLabel(upvotes: number): { label: string; className: string } {
  if (upvotes === 0) return { label: 'Undiscovered', className: 'text-purple' }
  if (upvotes <= 3) return { label: 'Rare gem', className: 'text-gold' }
  if (upvotes <= 8) return { label: 'Hidden gem', className: 'text-emerald' }
  return { label: 'Overlooked', className: 'text-for-400' }
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, index }: { arg: UnderratedArgument; index: number }) {
  const isFor = arg.side === 'blue'
  const gem = gemLabel(arg.upvotes)

  const rankColor =
    index === 0 ? 'text-gold' :
    index === 1 ? 'text-surface-600' :
    index === 2 ? 'text-amber-600' :
    'text-surface-500'

  const forPct = Math.round(arg.topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.35 }}
      className={cn(
        'relative rounded-2xl border p-5 space-y-4 transition-colors hover:border-surface-400/60',
        'bg-surface-100/60 border-surface-300/50',
        index < 3 && isFor && 'border-for-500/15 bg-for-950/10',
        index < 3 && !isFor && 'border-against-500/15 bg-against-950/10',
      )}
    >
      {/* Side accent bar */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full',
          isFor ? 'bg-for-500' : 'bg-against-500',
        )}
      />

      {/* Rank + author row */}
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-mono font-bold w-6 text-right flex-shrink-0', rankColor)}>
            #{index + 1}
          </span>
          <Link
            href={`/profile/${arg.author?.username ?? ''}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
          >
            <Avatar
              src={arg.author?.avatar_url ?? null}
              username={arg.author?.username ?? '?'}
              size="sm"
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {arg.author?.display_name ?? arg.author?.username ?? 'Unknown'}
              </p>
              {arg.author?.username && (
                <p className="text-xs text-surface-500">@{arg.author.username}</p>
              )}
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <GradeBadge grade={arg.ai_grade} />
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
              isFor
                ? 'bg-for-500/15 text-for-400 border-for-500/30'
                : 'bg-against-500/10 text-against-400 border-against-500/30',
            )}
          >
            {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      </div>

      {/* Gem label */}
      <div className="pl-3">
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono font-semibold', gem.className)}>
          <Gem className="h-3 w-3" />
          {gem.label}
        </span>
      </div>

      {/* Argument text */}
      <div className="pl-3">
        <blockquote className="text-sm text-surface-700 leading-relaxed line-clamp-4 italic border-l-2 border-surface-400/30 pl-3">
          &ldquo;{arg.content}&rdquo;
        </blockquote>
      </div>

      {/* Topic context */}
      {arg.topic && (
        <div className="pl-3">
          <Link
            href={`/topic/${arg.topic_id}`}
            className="group block rounded-xl border border-surface-300/40 bg-surface-200/40 p-3 hover:border-surface-400/60 transition-colors"
          >
            <div className="flex items-start gap-2">
              <Gavel className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-surface-500 font-medium uppercase tracking-wide mb-1">
                  Topic
                </p>
                <p className="text-sm text-white font-medium line-clamp-2 group-hover:text-for-400 transition-colors">
                  {arg.topic.statement}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {arg.topic.category && (
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded-md border font-medium',
                        catClass(arg.topic.category),
                      )}
                    >
                      {arg.topic.category}
                    </span>
                  )}
                  <span className="text-xs text-surface-500">
                    {forPct}% For · {againstPct}% Against
                  </span>
                  {arg.topic.total_votes > 0 && (
                    <span className="text-xs text-surface-500">
                      {arg.topic.total_votes.toLocaleString()} votes
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pl-3">
        <div className="flex items-center gap-3 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''}
          </span>
          {arg.ai_score != null && (
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              {arg.ai_score}/10
            </span>
          )}
          <span>{relativeTime(arg.created_at)}</span>
        </div>
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="rounded-xl border border-surface-300/30 p-3 space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Filter button ────────────────────────────────────────────────────────────

function FilterBtn({
  active,
  onClick,
  children,
  activeClass = 'bg-white/10 text-white border-white/20',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  activeClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
        active
          ? activeClass
          : 'text-surface-500 border-surface-400/30 hover:border-surface-400/60 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24

export default function UnderratedArgumentsPage() {
  const [grade, setGrade] = useState<GradeFilter>('all')
  const [side, setSide] = useState<SideFilter>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [category, setCategory] = useState('all')
  const [args, setArgs] = useState<UnderratedArgument[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetchArgs = useCallback(
    async (
      g: GradeFilter,
      s: SideFilter,
      p: Period,
      cat: string,
      off: number,
      append: boolean,
    ) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          grade: g,
          side: s,
          period: p,
          category: cat,
          limit: String(PAGE_SIZE),
          offset: String(off),
        })
        const res = await fetch(`/api/arguments/underrated?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: UnderratedResponse = await res.json()

        if (append) {
          setArgs((prev) => [...prev, ...data.arguments])
        } else {
          setArgs(data.arguments)
          setCategories(data.categories)
        }
        setTotal(data.total)
        setOffset(off + data.arguments.length)
      } catch {
        setError('Failed to load underrated arguments. Please try again.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    setOffset(0)
    fetchArgs(grade, side, period, category, 0, false)
  }, [grade, side, period, category, fetchArgs])

  const loadMore = () => {
    if (!loadingMore && args.length < total) {
      fetchArgs(grade, side, period, category, offset, true)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 pb-24 pt-4 md:pt-8">
        <div className="mx-auto max-w-3xl px-4 space-y-8">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 py-6"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-purple/10 border border-purple/20 flex items-center justify-center">
                <Gem className="h-6 w-6 text-purple" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Hidden Gems
            </h1>
            <p className="text-surface-500 max-w-xl mx-auto text-sm leading-relaxed">
              High-quality arguments that haven&apos;t found their audience yet. These are the
              well-reasoned, AI-graded takes that slipped through the cracks — worth reading,
              worth upvoting.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-surface-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-purple" />
                AI quality score ≥ 6/10
              </span>
              <span className="text-surface-600">·</span>
              <span className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-purple" />
                15 or fewer upvotes
              </span>
              <span className="text-surface-600">·</span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple" />
                Ranked by quality
              </span>
            </div>
          </motion.div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Grade filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Grade:</span>
              <FilterBtn active={grade === 'all'} onClick={() => setGrade('all')}>All</FilterBtn>
              <FilterBtn
                active={grade === 'A'}
                onClick={() => setGrade('A')}
                activeClass="bg-gold/15 text-gold border-gold/30"
              >
                A only
              </FilterBtn>
              <FilterBtn
                active={grade === 'B'}
                onClick={() => setGrade('B')}
                activeClass="bg-emerald/15 text-emerald border-emerald/30"
              >
                A &amp; B
              </FilterBtn>
            </div>

            {/* Side filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Side:</span>
              <FilterBtn active={side === 'all'} onClick={() => setSide('all')}>Both sides</FilterBtn>
              <FilterBtn
                active={side === 'for'}
                onClick={() => setSide('for')}
                activeClass="bg-for-500/15 text-for-400 border-for-500/30"
              >
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  FOR only
                </span>
              </FilterBtn>
              <FilterBtn
                active={side === 'against'}
                onClick={() => setSide('against')}
                activeClass="bg-against-500/10 text-against-400 border-against-500/30"
              >
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />
                  AGAINST only
                </span>
              </FilterBtn>
            </div>

            {/* Period filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Period:</span>
              <FilterBtn active={period === 'all'} onClick={() => setPeriod('all')}>All time</FilterBtn>
              <FilterBtn active={period === 'month'} onClick={() => setPeriod('month')}>This month</FilterBtn>
              <FilterBtn active={period === 'week'} onClick={() => setPeriod('week')}>This week</FilterBtn>
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-surface-500 font-mono shrink-0">Category:</span>
                <FilterBtn active={category === 'all'} onClick={() => setCategory('all')}>All</FilterBtn>
                {categories.map((cat) => (
                  <FilterBtn
                    key={cat}
                    active={category === cat}
                    onClick={() => setCategory(cat)}
                    activeClass={cn('border', catClass(cat))}
                  >
                    {cat}
                  </FilterBtn>
                ))}
              </div>
            )}
          </div>

          {/* Stats bar */}
          {!loading && args.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-surface-500"
            >
              <Scale className="h-4 w-4 text-purple" />
              <span>
                <span className="text-white font-semibold">{total.toLocaleString()}</span>{' '}
                hidden gem{total !== 1 ? 's' : ''} found
                {category !== 'all' && ` in ${category}`}
              </span>
            </motion.div>
          )}

          {/* Gem tier legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs font-mono text-surface-500">
            <span className="flex items-center gap-1.5 text-purple">
              <Gem className="h-3 w-3" /> Undiscovered (0 upvotes)
            </span>
            <span className="flex items-center gap-1.5 text-gold">
              <Gem className="h-3 w-3" /> Rare gem (1–3)
            </span>
            <span className="flex items-center gap-1.5 text-emerald">
              <Gem className="h-3 w-3" /> Hidden gem (4–8)
            </span>
            <span className="flex items-center gap-1.5 text-for-400">
              <Gem className="h-3 w-3" /> Overlooked (9–15)
            </span>
          </div>

          {/* Argument list */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-against-500/20 bg-against-950/10 p-6 text-center space-y-3">
              <p className="text-against-400 font-medium">{error}</p>
              <button
                onClick={() => fetchArgs(grade, side, period, category, 0, false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-white text-sm font-medium hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : args.length === 0 ? (
            <EmptyState
              icon={Gem}
              iconColor="text-purple"
              iconBg="bg-purple/10"
              iconBorder="border-purple/20"
              title="No hidden gems found"
              description="No high-quality arguments with low upvotes match your filters. Try changing the period or grade filter."
              actions={[
                { label: 'View all arguments', href: '/arguments', variant: 'primary' },
                { label: 'Top scored', href: '/arguments/top-scored', variant: 'secondary' },
              ]}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${grade}-${side}-${period}-${category}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {args.map((arg, i) => (
                  <ArgumentCard key={arg.id} arg={arg} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Load more */}
          {!loading && args.length < total && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm font-medium hover:bg-surface-300 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load more ({total - args.length} remaining)
                  </>
                )}
              </button>
            </div>
          )}

          {/* Navigation links */}
          <div className="pt-4 border-t border-surface-300/40 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/arguments', label: 'All Arguments', icon: Scale },
              { href: '/arguments/top-scored', label: 'Top Scored', icon: Brain },
              { href: '/arguments/influential', label: 'Influential', icon: GitMerge },
              { href: '/arguments/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
              { href: '/arguments/trending', label: 'Trending', icon: Zap },
              { href: '/arguments/daily', label: 'Daily Argument', icon: Sparkles },
              { href: '/arguments/champions', label: 'Champions', icon: Crown },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100/50 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  <span className="text-xs font-medium text-surface-500 group-hover:text-white transition-colors">
                    {link.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
