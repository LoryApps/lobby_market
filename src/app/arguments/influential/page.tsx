'use client'

/**
 * /arguments/influential — Cross-Partisan Powerhouses
 *
 * Surfaces arguments that reached across the aisle — FOR arguments that
 * convinced AGAINST voters, AGAINST arguments that resonated with FOR voters.
 * Combined with "insightful", "balanced", and "compelling" community reactions,
 * these are the arguments that genuinely moved minds.
 *
 * Influence score = (cross-partisan upvotes × 4) + (balanced reactions × 3)
 *                  + (insightful reactions × 2) + (compelling reactions × 1)
 *                  + (upvotes × 0.5) + (AI score × 0.3)
 *
 * Distinct from:
 *   /arguments/top-scored  — ranked by AI quality alone
 *   /arguments/champions   — all-time top upvoted (partisan crowd favourite)
 *   /arguments/trending    — short-term velocity
 *   /arguments/underrated  — quality with few upvotes (just buried)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  Brain,
  ChevronDown,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  GitMerge,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  InfluentialArgument,
  InfluentialResponse,
  Period,
  SideFilter,
  SortMode,
} from '@/app/api/arguments/influential/route'

// ── Category colors ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Health:      'bg-for-500/10 text-for-400 border-for-500/30',
  Culture:     'bg-gold/10 text-gold border-gold/30',
  Education:   'bg-for-500/10 text-for-400 border-for-500/30',
}

function catClass(cat: string | null) {
  if (!cat) return 'bg-surface-300/40 text-surface-500 border-surface-400/30'
  return CATEGORY_COLORS[cat] ?? 'bg-surface-300/40 text-surface-500 border-surface-400/30'
}

// ── Grade badge ────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { label: string; className: string }> = {
  A: { label: 'A', className: 'bg-gold/15 text-gold border-gold/30' },
  B: { label: 'B', className: 'bg-emerald/15 text-emerald border-emerald/30' },
  C: { label: 'C', className: 'bg-for-500/15 text-for-400 border-for-500/30' },
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cfg = GRADE_CONFIG[grade]
  if (!cfg) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded border font-mono',
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  )
}

// ── Relative time ──────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (mo >= 1) return `${mo}mo ago`
  if (d >= 1) return `${d}d ago`
  const h = Math.floor(diff / 3_600_000)
  if (h >= 1) return `${h}h ago`
  return 'just now'
}

// ── Influence tier ─────────────────────────────────────────────────────────────

function influenceTier(score: number): { label: string; color: string; icon: typeof Award } {
  if (score >= 20) return { label: 'Landmark', color: 'text-gold', icon: Crown }
  if (score >= 10) return { label: 'Persuasive', color: 'text-emerald', icon: Award }
  if (score >= 5) return { label: 'Notable', color: 'text-for-400', icon: Star }
  return { label: 'Rising', color: 'text-purple', icon: Zap }
}

// ── Argument Card ──────────────────────────────────────────────────────────────

function ArgumentCard({ arg, index }: { arg: InfluentialArgument; index: number }) {
  const isFor = arg.side === 'blue'
  const tier = influenceTier(arg.influence_score)
  const TierIcon = tier.icon
  const topic = arg.topic
  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const rankColor =
    index === 0 ? 'text-gold' :
    index === 1 ? 'text-surface-400' :
    index === 2 ? 'text-amber-600' :
    'text-surface-500'

  const totalReactions = arg.reaction_insightful + arg.reaction_compelling + arg.reaction_balanced

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.35 }}
      className={cn(
        'relative rounded-2xl border p-5 space-y-4 transition-colors',
        'bg-surface-100/60 border-surface-300/50 hover:border-surface-400/60',
        index < 3 && isFor && 'border-for-500/15 bg-for-950/10',
        index < 3 && !isFor && 'border-against-500/15 bg-against-950/10',
      )}
    >
      {/* Side accent */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full',
          isFor ? 'bg-for-500' : 'bg-against-500',
        )}
      />

      {/* Rank + author */}
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn('text-sm font-mono font-bold w-6 text-right flex-shrink-0', rankColor)}>
            #{index + 1}
          </span>
          {arg.author ? (
            <Link
              href={`/profile/${arg.author.username}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
            >
              <Avatar
                src={arg.author.avatar_url}
                username={arg.author.username}
                size="sm"
                className="flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {arg.author.display_name ?? arg.author.username}
                </p>
                <p className="text-xs text-surface-500">@{arg.author.username}</p>
              </div>
            </Link>
          ) : (
            <span className="text-sm text-surface-500">Anonymous</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
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

      {/* Influence tier */}
      <div className="pl-3">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-mono font-semibold', tier.color)}>
          <TierIcon className="h-3 w-3" />
          {tier.label} influence
        </span>
      </div>

      {/* Argument text */}
      <div className="pl-3">
        <blockquote className="text-sm text-surface-700 leading-relaxed line-clamp-4 italic border-l-2 border-surface-400/30 pl-3">
          &ldquo;{arg.content}&rdquo;
        </blockquote>
      </div>

      {/* Cross-partisan signal */}
      {arg.cross_partisan_count > 0 && (
        <div className="pl-3">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium',
              isFor
                ? 'bg-against-950/30 border-against-500/20 text-against-400'
                : 'bg-for-950/30 border-for-500/20 text-for-400',
            )}
          >
            <GitMerge className="h-3 w-3 flex-shrink-0" />
            <span>
              <strong>{arg.cross_partisan_count}</strong>{' '}
              {isFor ? 'AGAINST voter' : 'FOR voter'}{arg.cross_partisan_count !== 1 ? 's' : ''} found this compelling
            </span>
          </div>
        </div>
      )}

      {/* Reactions row */}
      {totalReactions > 0 && (
        <div className="pl-3 flex items-center gap-2 flex-wrap">
          {arg.reaction_insightful > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-purple/10 text-purple border border-purple/20 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3" />
              {arg.reaction_insightful} insightful
            </span>
          )}
          {arg.reaction_balanced > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald/10 text-emerald border border-emerald/20 px-2 py-0.5 rounded-full">
              <Scale className="h-3 w-3" />
              {arg.reaction_balanced} balanced
            </span>
          )}
          {arg.reaction_compelling > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded-full">
              <Flame className="h-3 w-3" />
              {arg.reaction_compelling} compelling
            </span>
          )}
        </div>
      )}

      {/* Topic context */}
      {topic && (
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
                  {topic.statement}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {topic.category && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-md border font-medium', catClass(topic.category))}>
                      {topic.category}
                    </span>
                  )}
                  <span className="text-xs text-for-400 font-mono">{forPct}% For</span>
                  <span className="text-xs text-against-400 font-mono">{againstPct}% Against</span>
                  {topic.total_votes > 0 && (
                    <span className="text-xs text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
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
            {arg.upvotes}
          </span>
          {arg.ai_score != null && (
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              {arg.ai_score}/10
            </span>
          )}
          <span className="font-mono text-[11px] text-purple font-semibold">
            {arg.influence_score.toFixed(1)} pts
          </span>
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

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3 pl-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="pl-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="pl-3">
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="pl-3 flex gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

// ── Filter button ──────────────────────────────────────────────────────────────

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

// ── Main ───────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30

export default function InfluentialArgumentsPage() {
  const [side, setSide] = useState<SideFilter>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [sort, setSort] = useState<SortMode>('influence')
  const [category, setCategory] = useState('all')
  const [args, setArgs] = useState<InfluentialArgument[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(
    async (s: SideFilter, p: Period, srt: SortMode, cat: string, off: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          side: s,
          period: p,
          sort: srt,
          category: cat,
          limit: String(PAGE_SIZE),
          offset: String(off),
        })
        const res = await fetch(`/api/arguments/influential?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: InfluentialResponse = await res.json()

        if (append) {
          setArgs((prev) => [...prev, ...data.arguments])
        } else {
          setArgs(data.arguments)
          setCategories(data.categories)
        }
        setTotal(data.total)
        setOffset(off + data.arguments.length)
      } catch {
        setError('Failed to load. Please try again.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    setOffset(0)
    fetch_(side, period, sort, category, 0, false)
  }, [side, period, sort, category, fetch_])

  const loadMore = () => {
    if (!loadingMore && args.length < total) {
      fetch_(side, period, sort, category, offset, true)
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
              <div className="h-12 w-12 rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                <GitMerge className="h-6 w-6 text-emerald" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Cross-Partisan Powerhouses
            </h1>
            <p className="text-surface-500 max-w-xl mx-auto text-sm leading-relaxed">
              Arguments that reached across the aisle — FOR cases that convinced AGAINST voters,
              AGAINST cases that resonated with FOR supporters. These are the arguments that
              genuinely changed minds.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-surface-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <GitMerge className="h-3.5 w-3.5 text-emerald" />
                Cross-partisan upvotes
              </span>
              <span className="text-surface-600">·</span>
              <span className="flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-emerald" />
                Community reactions
              </span>
              <span className="text-surface-600">·</span>
              <span className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-emerald" />
                AI quality score
              </span>
            </div>
          </motion.div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Sort */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Sort:</span>
              <FilterBtn
                active={sort === 'influence'}
                onClick={() => setSort('influence')}
                activeClass="bg-emerald/15 text-emerald border-emerald/30"
              >
                <span className="flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  Influence score
                </span>
              </FilterBtn>
              <FilterBtn
                active={sort === 'cross_partisan'}
                onClick={() => setSort('cross_partisan')}
                activeClass="bg-purple/15 text-purple border-purple/30"
              >
                <span className="flex items-center gap-1">
                  <GitMerge className="h-3 w-3" />
                  Cross-partisan
                </span>
              </FilterBtn>
              <FilterBtn
                active={sort === 'reactions'}
                onClick={() => setSort('reactions')}
                activeClass="bg-gold/15 text-gold border-gold/30"
              >
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Reactions
                </span>
              </FilterBtn>
            </div>

            {/* Side */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Side:</span>
              <FilterBtn active={side === 'all'} onClick={() => setSide('all')}>All</FilterBtn>
              <FilterBtn
                active={side === 'for'}
                onClick={() => setSide('for')}
                activeClass="bg-for-500/15 text-for-400 border-for-500/30"
              >
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  FOR
                </span>
              </FilterBtn>
              <FilterBtn
                active={side === 'against'}
                onClick={() => setSide('against')}
                activeClass="bg-against-500/10 text-against-400 border-against-500/30"
              >
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />
                  AGAINST
                </span>
              </FilterBtn>
            </div>

            {/* Period */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-surface-500 font-mono shrink-0">Period:</span>
              <FilterBtn active={period === 'all'} onClick={() => setPeriod('all')}>All time</FilterBtn>
              <FilterBtn active={period === 'month'} onClick={() => setPeriod('month')}>This month</FilterBtn>
              <FilterBtn active={period === 'week'} onClick={() => setPeriod('week')}>This week</FilterBtn>
            </div>

            {/* Category */}
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

          {/* Stats */}
          {!loading && args.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-surface-500"
            >
              <Users className="h-4 w-4 text-emerald" />
              <span>
                <span className="text-white font-semibold">{total.toLocaleString()}</span>{' '}
                influential argument{total !== 1 ? 's' : ''}
                {category !== 'all' && ` in ${category}`}
              </span>
            </motion.div>
          )}

          {/* Influence tier legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs font-mono">
            <span className="flex items-center gap-1.5 text-gold">
              <Crown className="h-3 w-3" /> Landmark (≥20 pts)
            </span>
            <span className="flex items-center gap-1.5 text-emerald">
              <Award className="h-3 w-3" /> Persuasive (≥10 pts)
            </span>
            <span className="flex items-center gap-1.5 text-for-400">
              <Star className="h-3 w-3" /> Notable (≥5 pts)
            </span>
            <span className="flex items-center gap-1.5 text-purple">
              <Zap className="h-3 w-3" /> Rising (&lt;5 pts)
            </span>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-against-500/20 bg-against-950/10 p-6 text-center space-y-3">
              <p className="text-against-400 font-medium">{error}</p>
              <button
                onClick={() => fetch_(side, period, sort, category, 0, false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-white text-sm font-medium hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : args.length === 0 ? (
            <EmptyState
              icon={GitMerge}
              iconColor="text-emerald"
              iconBg="bg-emerald/10"
              iconBorder="border-emerald/20"
              title="No influential arguments yet"
              description="Cross-partisan arguments emerge as the community grows. Check back as more users vote and react to arguments across the aisle."
              actions={[
                { label: 'Top scored arguments', href: '/arguments/top-scored', variant: 'primary' },
                { label: 'All arguments', href: '/arguments', variant: 'secondary' },
              ]}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${side}-${period}-${sort}-${category}`}
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

          {/* Navigation */}
          <div className="pt-4 border-t border-surface-300/40 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/arguments', label: 'All Arguments', icon: Scale },
              { href: '/arguments/top-scored', label: 'Top Scored', icon: Brain },
              { href: '/arguments/champions', label: 'Champions', icon: Trophy },
              { href: '/arguments/trending', label: 'Trending', icon: Flame },
              { href: '/arguments/underrated', label: 'Hidden Gems', icon: Sparkles },
              { href: '/arguments/hall-of-fame', label: 'Hall of Fame', icon: Crown },
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
