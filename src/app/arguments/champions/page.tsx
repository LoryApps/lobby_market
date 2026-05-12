'use client'

/**
 * /arguments/champions — Arena Champions
 *
 * The definitive leaderboard of arguments ranked by their head-to-head
 * faceoff win rate in the Argument Arena. Arguments are battle-tested —
 * only those with a minimum number of bouts qualify. Unlike upvotes (a
 * popularity contest) and AI scores (a rubric), the Arena win rate is
 * determined by the community choosing which argument is more compelling
 * in a blind 1-vs-1 matchup.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Crown,
  ExternalLink,
  Loader2,
  Medal,
  RefreshCw,
  Shield,
  Swords,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ChampionArgument,
  ChampionsResponse,
  SideFilter,
  SortBy,
  MinBouts,
} from '@/app/api/arguments/champions/route'

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Environment',
  'Health',
  'Education',
  'Justice',
]

const SIDES: { value: SideFilter; label: string }[] = [
  { value: 'all', label: 'Both Sides' },
  { value: 'for', label: 'FOR' },
  { value: 'against', label: 'AGAINST' },
]

const SORTS: { value: SortBy; label: string }[] = [
  { value: 'win_pct', label: 'Win Rate' },
  { value: 'wins', label: 'Total Wins' },
  { value: 'bouts', label: 'Most Bouts' },
]

const MIN_BOUTS_OPTIONS: { value: MinBouts; label: string }[] = [
  { value: 3, label: '3+ bouts' },
  { value: 5, label: '5+ bouts' },
  { value: 10, label: '10+ bouts' },
  { value: 20, label: '20+ bouts' },
]

const PAGE_SIZE = 25

const GRADE_CONFIG: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-gold/20', border: 'border-gold/50', text: 'text-gold' },
  B: { bg: 'bg-emerald/15', border: 'border-emerald/40', text: 'text-emerald' },
  C: { bg: 'bg-for-500/12', border: 'border-for-500/35', text: 'text-for-400' },
  D: { bg: 'bg-surface-300/50', border: 'border-surface-400/50', text: 'text-surface-400' },
  F: { bg: 'bg-against-500/10', border: 'border-against-500/30', text: 'text-against-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 30)
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m < 2) return 'just now'
  return `${m}m ago`
}

function getRankMedal(rank: number) {
  if (rank === 1)
    return {
      Icon: Crown,
      color: 'text-gold',
      bg: 'bg-gold/15 border-gold/30',
      label: '#1 Champion',
    }
  if (rank === 2)
    return {
      Icon: Medal,
      color: 'text-surface-300',
      bg: 'bg-surface-300/15 border-surface-300/30',
      label: '#2 Silver',
    }
  if (rank === 3)
    return {
      Icon: Medal,
      color: 'text-amber-600',
      bg: 'bg-amber-900/20 border-amber-700/30',
      label: '#3 Bronze',
    }
  return null
}

function getCardGlow(rank: number): string {
  if (rank === 1) return 'shadow-[0_0_32px_rgba(201,168,76,0.18)] border-gold/20'
  if (rank === 2) return 'shadow-[0_0_20px_rgba(180,180,180,0.10)] border-surface-300/25'
  if (rank === 3) return 'shadow-[0_0_16px_rgba(180,100,30,0.10)] border-amber-700/20'
  return 'border-surface-300'
}

// ─── Win Rate Bar ─────────────────────────────────────────────────────────────────────────────

function WinRateBar({ winPct }: { winPct: number }) {
  const color =
    winPct >= 70
      ? 'bg-gold'
      : winPct >= 55
        ? 'bg-emerald'
        : winPct >= 45
          ? 'bg-for-400'
          : 'bg-surface-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${winPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-mono font-bold tabular-nums w-10 text-right',
          winPct >= 70
            ? 'text-gold'
            : winPct >= 55
              ? 'text-emerald'
              : winPct >= 45
                ? 'text-for-400'
                : 'text-surface-500',
        )}
      >
        {winPct}%
      </span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────────────────────

function ArgSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-surface-300 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-28 bg-surface-300 rounded" />
          <div className="h-2.5 w-20 bg-surface-300 rounded" />
        </div>
        <div className="h-6 w-16 bg-surface-300 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-surface-300 rounded" />
        <div className="h-3.5 w-5/6 bg-surface-300 rounded" />
        <div className="h-3.5 w-4/6 bg-surface-300 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 bg-surface-300 rounded-full" />
        <div className="h-3 w-10 bg-surface-300 rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-24 bg-surface-300 rounded" />
        <div className="h-2.5 w-20 bg-surface-300 rounded" />
      </div>
    </div>
  )
}

// ─── Champion Card ────────────────────────────────────────────────────────────────────────────

function ChampionCard({
  arg,
  rank,
}: {
  arg: ChampionArgument
  rank: number
}) {
  const medal = getRankMedal(rank)
  const glow = getCardGlow(rank)
  const gradeCfg = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade.toUpperCase()] : null
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-4 space-y-3 transition-colors group relative overflow-hidden',
        glow,
      )}
    >
      {/* Rank badge top-right */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {medal ? (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-bold',
              medal.bg,
              medal.color,
            )}
          >
            <medal.Icon className="h-3 w-3" />
            <span>#{rank}</span>
          </div>
        ) : (
          <span className="text-xs font-mono text-surface-500">#{rank}</span>
        )}
      </div>

      {/* Author row */}
      <div className="flex items-start gap-3 pr-16">
        <Link href={`/profile/${arg.author.username}`} className="flex-shrink-0">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${arg.author.username}`}
              className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {arg.author.display_name ?? `@${arg.author.username}`}
            </Link>
            {arg.ai_grade && gradeCfg && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
                  gradeCfg.bg,
                  gradeCfg.border,
                  gradeCfg.text,
                )}
              >
                {arg.ai_grade}
              </span>
            )}
            <Badge
              variant={isFor ? 'for' : 'against'}
              size="xs"
              className="flex-shrink-0"
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </Badge>
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            {relativeTime(arg.created_at)}
          </p>
        </div>
      </div>

      {/* Argument content */}
      <Link href={`/arguments/${arg.id}`}>
        <p className="text-sm font-mono text-surface-200 leading-relaxed line-clamp-4 group-hover:text-white transition-colors cursor-pointer">
          {arg.content}
        </p>
      </Link>

      {/* Win rate bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <Swords className="h-3 w-3" />
            Arena Record
          </span>
          <span>
            {arg.wins}W – {arg.bouts - arg.wins}L · {arg.bouts} bout{arg.bouts !== 1 ? 's' : ''}
          </span>
        </div>
        <WinRateBar winPct={Math.round(arg.win_pct)} />
      </div>

      {/* Topic + upvotes row */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/topic/${arg.topic.id}`}
          className="flex-1 min-w-0 group/topic"
        >
          <p className="text-[11px] font-mono text-surface-500 group-hover/topic:text-surface-300 transition-colors truncate">
            {truncate(arg.topic.statement, 55)}
          </p>
        </Link>
        <div className="flex items-center gap-3 flex-shrink-0">
          {arg.source_url && (
            <a
              href={arg.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-surface-600 hover:text-for-400 transition-colors"
              title="Source"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            <span>{arg.upvotes}</span>
          </div>
          <Link
            href={`/arguments/${arg.id}`}
            className="flex items-center gap-0.5 text-[11px] font-mono text-surface-600 hover:text-for-400 transition-colors"
          >
            <span>View</span>
            <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Filter pill ────────────────────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-for-600 text-white'
          : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
      )}
    >
      {children}
    </button>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────────────────

export default function ArenaChampionsPage() {
  const [args, setArgs] = useState<ChampionArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [side, setSide] = useState<SideFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('win_pct')
  const [minBouts, setMinBouts] = useState<MinBouts>(5)
  const [category, setCategory] = useState<string>('All')

  const loadChampions = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true)
        setCurrentOffset(0)
      } else {
        setLoadingMore(true)
      }
      setError(null)

      const off = reset ? 0 : currentOffset
      const params = new URLSearchParams({
        side,
        sort: sortBy,
        min_bouts: String(minBouts),
        limit: String(PAGE_SIZE),
        offset: String(off),
      })
      if (category !== 'All') params.set('category', category)

      try {
        const res = await fetch(`/api/arguments/champions?${params}`)
        if (!res.ok) throw new Error('Failed to load champions')
        const data: ChampionsResponse = await res.json()

        if (reset) {
          setArgs(data.arguments)
          setCurrentOffset(data.arguments.length)
        } else {
          setArgs((prev) => [...prev, ...data.arguments])
          setCurrentOffset(off + data.arguments.length)
        }
        setTotal(data.total)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [side, sortBy, minBouts, category],
  )

  useEffect(() => {
    loadChampions(true)
  }, [loadChampions])

  const remaining = total - args.length

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 pt-16 pb-24 px-4 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="py-6 space-y-1">
          <div className="flex items-center gap-2 text-sm font-mono">
            <Link
              href="/arguments"
              className="text-surface-500 hover:text-white transition-colors"
            >
              Arguments
            </Link>
            <span className="text-surface-600">/</span>
            <span className="text-white font-semibold">Arena Champions</span>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white">Arena Champions</h1>
              <p className="text-sm font-mono text-surface-500">
                Arguments that proved most compelling in head-to-head battle
              </p>
            </div>
          </div>

          {!loading && total > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 flex items-center gap-2 text-xs font-mono text-surface-500"
            >
              <Shield className="h-3 w-3 text-for-400" />
              <span>
                <span className="text-white font-semibold">{total}</span> battle-tested arguments
                ranked
              </span>
            </motion.div>
          )}
        </div>

        {/* Hub nav strip */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {[
            { href: '/arguments/daily', label: 'Daily Pick' },
            { href: '/arguments/trending', label: 'Trending' },
            { href: '/arguments/top-scored', label: 'Best Quality' },
            { href: '/arguments/reactions', label: 'Reactions' },
            { href: '/arguments/faceoff', label: 'Arena' },
            { href: '/arguments/champions', label: 'Champions', active: true },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors',
                tab.active
                  ? 'bg-gold/20 border border-gold/40 text-gold'
                  : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <span className="text-[11px] font-mono text-surface-600 flex-shrink-0">Sort:</span>
            {SORTS.map((s) => (
              <FilterPill key={s.value} active={sortBy === s.value} onClick={() => setSortBy(s.value)}>
                {s.label}
              </FilterPill>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <span className="text-[11px] font-mono text-surface-600 flex-shrink-0">Min:</span>
            {MIN_BOUTS_OPTIONS.map((o) => (
              <FilterPill key={o.value} active={minBouts === o.value} onClick={() => setMinBouts(o.value)}>
                {o.label}
              </FilterPill>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <span className="text-[11px] font-mono text-surface-600 flex-shrink-0">Side:</span>
            {SIDES.map((s) => (
              <FilterPill key={s.value} active={side === s.value} onClick={() => setSide(s.value)}>
                {s.label}
              </FilterPill>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <span className="text-[11px] font-mono text-surface-600 flex-shrink-0">Topic:</span>
            {CATEGORIES.map((c) => (
              <FilterPill key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </FilterPill>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 text-sm font-mono text-against-300 flex items-center gap-2">
            <span>{error}</span>
            <button
              onClick={() => loadChampions(true)}
              className="ml-auto text-against-400 hover:text-against-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ArgSkeleton key={i} delay={i * 60} />
            ))}
          </div>
        ) : args.length === 0 ? (
          <EmptyState
            icon={Swords}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/20"
            title="No champions yet"
            description={`No arguments have completed ${minBouts}+ Arena bouts. Lower the minimum or head to the Arena to start voting.`}
            actions={[
              { label: 'Enter the Arena', href: '/arguments/faceoff', icon: Swords },
              {
                label: 'Lower minimum',
                onClick: () => setMinBouts(3),
                variant: 'secondary',
              },
            ]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {args.map((arg, idx) => (
                <ChampionCard key={arg.id} arg={arg} rank={idx + 1} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {!loading && remaining > 0 && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={() => loadChampions(false)}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-300 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Load {Math.min(remaining, PAGE_SIZE)} more
            </button>
            <p className="text-xs font-mono text-surface-600">{remaining} remaining</p>
          </div>
        )}

        {/* CTA: go to Arena */}
        {!loading && args.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border border-gold/20 bg-gold/5 p-5 text-center space-y-3"
          >
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              <span className="text-sm font-mono font-semibold text-gold">
                Help crown the next champion
              </span>
            </div>
            <p className="text-xs font-mono text-surface-500 max-w-xs mx-auto">
              Vote in head-to-head faceoffs to build the Arena rankings. Your votes shape this leaderboard.
            </p>
            <Link
              href="/arguments/faceoff"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-sm font-mono font-medium text-gold hover:bg-gold/30 transition-colors"
            >
              <Swords className="h-3.5 w-3.5" />
              Enter the Arena
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
