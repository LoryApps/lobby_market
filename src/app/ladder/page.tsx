'use client'

/**
 * /ladder — The Argument Ladder
 *
 * Ranks the platform's best arguers by the total upvotes their arguments
 * have earned from the community. Distinct from /leaderboard (which ranks
 * by reputation_score and clout) and /gallery (which surfaces individual
 * arguments rather than the arguers themselves).
 *
 * Filters: category · side (FOR/AGAINST/All) · period (all time / month / week)
 * Shows: rank · user · total upvotes · argument count · topics covered ·
 *        specialty category · their best argument
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  ExternalLink,
  Flame,
  Layers,
  MessageSquare,
  Quote,
  RefreshCw,
  Scale,
  Star,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LadderEntry, LadderResponse } from '@/app/api/ladder/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'all',
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
] as const
type Category = (typeof CATEGORIES)[number]

const PERIODS = [
  { id: 'all', label: 'All Time', icon: Star },
  { id: 'month', label: 'This Month', icon: Flame },
  { id: 'week', label: 'This Week', icon: Timer },
] as const
type Period = 'all' | 'month' | 'week'

const SIDES = [
  { id: 'all', label: 'All', icon: Scale },
  { id: 'for', label: 'FOR', icon: ThumbsUp },
  { id: 'against', label: 'AGAINST', icon: ThumbsDown },
] as const
type Side = 'all' | 'for' | 'against'

// ─── Category colours (matches platform palette) ──────────────────────────────

const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Politics:    { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Economics:   { color: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { color: 'text-purple',       bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { color: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { color: 'text-for-300',      bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { color: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/25' },
  Health:      { color: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Environment: { color: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { color: 'text-purple',       bg: 'bg-purple/10',      border: 'border-purple/30' },
}

function getCategoryStyle(cat: string | null) {
  if (!cat) return { color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300' }
  return CATEGORY_STYLE[cat] ?? { color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300' }
}

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',       color: 'text-surface-500' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',         color: 'text-gold' },
}

function getRoleInfo(role: string) {
  return ROLE_LABEL[role] ?? ROLE_LABEL.person
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/20 border border-gold/40 flex-shrink-0">
        <Crown className="h-4 w-4 text-gold" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-300/60 border border-surface-400 flex-shrink-0">
        <Trophy className="h-4 w-4 text-surface-400" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
        <Trophy className="h-4 w-4 text-against-400/80" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
      <span className="text-xs font-mono font-bold text-surface-500">#{rank}</span>
    </div>
  )
}

// ─── Upvotes bar ──────────────────────────────────────────────────────────────

function UpvotesBar({
  forUpvotes,
  againstUpvotes,
}: {
  forUpvotes: number
  againstUpvotes: number
}) {
  const total = forUpvotes + againstUpvotes
  if (total === 0) return null
  const forPct = Math.round((forUpvotes / total) * 100)
  const againstPct = 100 - forPct

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono text-for-400 w-7 text-right">{forPct}%</span>
      <div className="relative flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
        <div
          className="absolute left-0 top-0 h-full bg-for-500 rounded-l-full transition-all duration-500"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-against-600 rounded-r-full transition-all duration-500"
          style={{ width: `${againstPct}%` }}
        />
      </div>
      <span className="text-[9px] font-mono text-against-400 w-7">{againstPct}%</span>
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function LadderCard({
  entry,
  index,
  expanded,
  onToggle,
}: {
  entry: LadderEntry
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const roleInfo = getRoleInfo(entry.role)
  const specialtyStyle = getCategoryStyle(entry.specialty_category)
  const bestArgSide = entry.best_argument?.side === 'blue' ? 'FOR' : 'AGAINST'
  const bestArgColor = entry.best_argument?.side === 'blue' ? 'text-for-400' : 'text-against-400'
  const bestArgBg = entry.best_argument?.side === 'blue' ? 'bg-for-500/5 border-for-500/20' : 'bg-against-500/5 border-against-500/20'

  const isTop3 = entry.rank <= 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        'rounded-xl border overflow-hidden transition-colors',
        isTop3
          ? entry.rank === 1
            ? 'border-gold/30 bg-gold/5'
            : entry.rank === 2
              ? 'border-surface-400/40 bg-surface-300/20'
              : 'border-against-500/20 bg-against-500/5'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400'
      )}
    >
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <RankBadge rank={entry.rank} />

        {/* Avatar */}
        <Link
          href={`/profile/${entry.username}`}
          className="flex-shrink-0"
          aria-label={`View ${entry.display_name ?? entry.username}'s profile`}
        >
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name ?? entry.username}
            size="md"
          />
        </Link>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              className="font-mono font-semibold text-white text-sm hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name ?? `@${entry.username}`}
            </Link>
            <span className={cn('text-[10px] font-mono', roleInfo.color)}>
              {roleInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-surface-500">
              @{entry.username}
            </span>
            {entry.specialty_category && (
              <span
                className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                  specialtyStyle.color,
                  specialtyStyle.bg,
                  specialtyStyle.border
                )}
              >
                {entry.specialty_category}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 text-right flex-shrink-0">
          <div>
            <p className={cn('text-base font-mono font-bold', isTop3 && entry.rank === 1 ? 'text-gold' : 'text-white')}>
              {entry.total_upvotes.toLocaleString()}
            </p>
            <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">upvotes</p>
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-surface-400">
              {entry.argument_count.toLocaleString()}
            </p>
            <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">args</p>
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-surface-400">
              {entry.topics_covered.toLocaleString()}
            </p>
            <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">topics</p>
          </div>
        </div>

        {/* Mobile stat */}
        <div className="flex sm:hidden items-center gap-1 flex-shrink-0">
          <ThumbsUp className="h-3 w-3 text-surface-500" />
          <span className={cn('text-sm font-mono font-bold', isTop3 && entry.rank === 1 ? 'text-gold' : 'text-white')}>
            {entry.total_upvotes.toLocaleString()}
          </span>
        </div>

        {/* Expand toggle */}
        {entry.best_argument && (
          <button
            onClick={onToggle}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0',
              'text-surface-500 hover:text-white transition-colors',
              expanded ? 'bg-surface-300' : 'hover:bg-surface-300'
            )}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse best argument' : 'Show best argument'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Mobile stats row */}
      <div className="sm:hidden flex items-center gap-4 px-4 pb-2 text-[10px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />{entry.argument_count} args
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />{entry.topics_covered} topics
        </span>
      </div>

      {/* FOR/AGAINST split bar (if both sides used) */}
      {entry.for_upvotes > 0 && entry.against_upvotes > 0 && (
        <div className="px-4 pb-2">
          <UpvotesBar forUpvotes={entry.for_upvotes} againstUpvotes={entry.against_upvotes} />
        </div>
      )}

      {/* ── Best argument (expandable) ────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && entry.best_argument && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('mx-4 mb-4 rounded-lg border p-3', bestArgBg)}>
              <div className="flex items-center gap-2 mb-2">
                <Quote className="h-3 w-3 text-surface-500 flex-shrink-0" />
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', bestArgColor)}>
                  Best argument · {bestArgSide}
                </span>
                <span className="ml-auto text-[10px] font-mono text-surface-500 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {entry.best_argument.upvotes.toLocaleString()}
                </span>
              </div>
              <p className="text-xs font-mono text-surface-700 leading-relaxed line-clamp-4">
                {entry.best_argument.content}
              </p>
              <div className="mt-2 pt-2 border-t border-surface-300/50 flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono text-surface-500 truncate">
                  on: {entry.best_argument.topic_statement.slice(0, 60)}
                  {entry.best_argument.topic_statement.length > 60 ? '…' : ''}
                </p>
                <Link
                  href={`/topic/${entry.best_argument.topic_id}`}
                  className="flex items-center gap-1 text-[10px] font-mono text-surface-400 hover:text-white transition-colors flex-shrink-0"
                  aria-label="View topic"
                >
                  View <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LadderSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="hidden sm:flex gap-4">
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-2 w-12" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-2 w-8" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LadderPage() {
  const [data, setData] = useState<LadderResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<Period>('all')
  const [side, setSide] = useState<Side>('all')
  const [category, setCategory] = useState<Category>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams({ period, side, category, limit: '50' })
      const res = await fetch(`/api/ladder?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json as LadderResponse)
      setExpandedId(null)
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period, side, category])

  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  const toggle = (userId: string) =>
    setExpandedId((prev) => (prev === userId ? null : userId))

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leaderboard
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-for-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Argument Ladder
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {data
                    ? `${data.entries.length} arguers · ranked by community upvotes`
                    : 'Ranked by community upvotes'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              aria-label="Refresh ladder"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <p className="mt-3 text-sm font-mono text-surface-500 leading-relaxed">
            Who makes the most <em className="text-surface-400 not-italic">persuasive</em> arguments?
            Ranked by total upvotes earned across all debates — not just activity, but
            quality of reasoning.
          </p>
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="space-y-3 mb-6">
          {/* Period */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider w-16 flex-shrink-0">
              Period
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {PERIODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPeriod(id as Period)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border',
                    period === id
                      ? 'bg-for-600/30 border-for-500/40 text-for-300'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider w-16 flex-shrink-0">
              Side
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {SIDES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSide(id as Side)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border',
                    side === id
                      ? id === 'for'
                        ? 'bg-for-600/30 border-for-500/40 text-for-300'
                        : id === 'against'
                          ? 'bg-against-600/20 border-against-500/40 text-against-300'
                          : 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider w-16 flex-shrink-0">
              Topic
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => {
                const style = cat === 'all' ? null : getCategoryStyle(cat)
                const isActive = category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border',
                      isActive
                        ? style
                          ? cn(style.color, style.bg, style.border)
                          : 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
                    )}
                  >
                    {cat === 'all' ? 'All Topics' : cat}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-5 px-1 text-[10px] font-mono text-surface-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Crown className="h-3 w-3 text-gold" /> #1 ranked
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-for-400" /> Total argument upvotes
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-surface-500" /> Unique topics covered
          </span>
          <span className="flex items-center gap-1">
            <ChevronDown className="h-3 w-3" /> Expand best argument
          </span>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <LadderSkeleton />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-10 w-10 text-surface-600" />}
            title="No arguers yet"
            description={
              period !== 'all' || category !== 'all' || side !== 'all'
                ? 'No results match your current filters. Try broadening the search.'
                : 'Be the first to post a compelling argument — upvotes from the community build your rank.'
            }
            action={{ label: 'Browse debates', href: '/' }}
          />
        ) : (
          <div className="space-y-3">
            {data.entries.map((entry, index) => (
              <LadderCard
                key={entry.user_id}
                entry={entry}
                index={index}
                expanded={expandedId === entry.user_id}
                onToggle={() => toggle(entry.user_id)}
              />
            ))}
          </div>
        )}

        {/* ── Related links ───────────────────────────────────────────────── */}
        {!loading && data && data.entries.length > 0 && (
          <div className="mt-8 rounded-xl border border-surface-300 bg-surface-100 p-4">
            <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wide">
              More civic rankings
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { href: '/leaderboard', label: 'Reputation Leaderboard', icon: Trophy },
                { href: '/gallery', label: 'Argument Gallery', icon: Quote },
                { href: '/arguments/trending', label: 'Trending Arguments', icon: Flame },
                { href: '/citizens', label: 'All Citizens', icon: Users },
                { href: '/duel', label: 'Argument Duel', icon: Scale },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
