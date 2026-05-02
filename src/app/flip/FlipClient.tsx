'use client'

/**
 * /flip — The Big Flip
 *
 * Displays civic debates with the most dramatic vote reversals:
 *   • Topics that started strongly FOR but failed (collapses)
 *   • Topics that started strongly AGAINST but became law (comebacks)
 *
 * "Swing" = final_blue_pct − early_blue_pct
 * Positive swing  → came from behind (underdog blue)
 * Negative swing  → led and lost (blue collapse)
 *
 * Uses the first 15 votes as the "early" sample to establish the initial
 * trajectory, then compares against the final resolved vote percentage.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FlipTopic, FlipResponse } from '@/app/api/flip/route'

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type Filter = 'all' | 'comeback' | 'collapse'

const FILTERS: { id: Filter; label: string; icon: typeof TrendingUp; desc: string }[] = [
  { id: 'all',      label: 'All Flips',   icon: Zap,          desc: 'Every dramatic reversal' },
  { id: 'comeback', label: 'Comebacks',   icon: TrendingUp,   desc: 'Trailed early, won late' },
  { id: 'collapse', label: 'Collapses',   icon: TrendingDown, desc: 'Led early, fell apart' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function pctBar(pct: number, isFor: boolean): string {
  return isFor
    ? `${Math.round(pct)}% FOR`
    : `${Math.round(pct)}% AGN`
}

// ─── Swing arc visualisation ─────────────────────────────────────────────────

interface SwingArcProps {
  early: number
  final: number
  swing: number
}

function SwingArc({ early, final, swing }: SwingArcProps) {
  const isPositive = swing > 0
  const absSwing = Math.abs(swing)

  // Clamp to 0–100 for display
  const earlyW  = Math.max(2, Math.min(100, early))
  const finalW  = Math.max(2, Math.min(100, final))

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
        <span>Early ({pctBar(early, true)})</span>
        <span className={cn(
          'font-semibold',
          isPositive ? 'text-for-400' : 'text-against-400'
        )}>
          {isPositive ? '+' : ''}{swing.toFixed(1)}pp swing
        </span>
        <span>Final ({pctBar(final, true)})</span>
      </div>

      {/* Dual bar */}
      <div className="relative h-5 rounded-full bg-surface-300/50 overflow-hidden">
        {/* Early bar */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-l-full opacity-40 transition-all duration-700',
            earlyW >= 50 ? 'bg-for-500' : 'bg-against-500'
          )}
          style={{ width: `${earlyW}%` }}
        />
        {/* Final bar (brighter, overlaid) */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-l-full transition-all duration-700',
            finalW >= 50 ? 'bg-for-500' : 'bg-against-500'
          )}
          style={{ width: `${finalW}%`, opacity: 0.85 }}
        />
        {/* 50% line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      </div>

      {/* Arrow storytelling */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <span className={cn(
          'px-1.5 py-0.5 rounded font-semibold',
          early >= 50 ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300'
        )}>
          {Math.round(early)}% {early >= 50 ? 'FOR' : 'AGN'}
        </span>
        <ArrowRight className={cn(
          'h-3 w-3 flex-shrink-0',
          isPositive ? 'text-for-400' : 'text-against-400'
        )} />
        <span className={cn(
          'px-1.5 py-0.5 rounded font-semibold',
          final >= 50 ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300'
        )}>
          {Math.round(final)}% {final >= 50 ? 'FOR' : 'AGN'}
        </span>
        <span className={cn(
          'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
          isPositive
            ? 'bg-for-500/15 text-for-400 border border-for-500/30'
            : 'bg-against-500/15 text-against-400 border border-against-500/30'
        )}>
          {isPositive ? '▲' : '▼'} {absSwing.toFixed(1)}pp
        </span>
      </div>
    </div>
  )
}

// ─── Flip card ────────────────────────────────────────────────────────────────

function FlipCard({ flip, rank }: { flip: FlipTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)

  const isComeback = flip.swing > 0
  const isLaw      = flip.status === 'law'

  const swingLabel = isComeback
    ? isLaw
      ? 'Epic Comeback → LAW'
      : 'Came Back Strong'
    : isLaw
    ? 'Lucky Stumble → LAW'
    : 'Led & Lost'

  const swingIcon = isComeback ? TrendingUp : TrendingDown
  const SwingIcon = swingIcon

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-200',
        'bg-surface-100 hover:bg-surface-200/80',
        isLaw
          ? 'border-gold/30'
          : 'border-surface-300'
      )}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Rank bubble */}
          <div className={cn(
            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5',
            rank === 0 ? 'bg-gold/20 text-gold border border-gold/40'
            : rank === 1 ? 'bg-surface-400/30 text-surface-400 border border-surface-400/30'
            : rank === 2 ? 'bg-against-500/20 text-against-300 border border-against-500/30'
            : 'bg-surface-200 text-surface-500 border border-surface-300'
          )}>
            {rank + 1}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap mb-2">
              {/* Status badge */}
              {isLaw ? (
                <Badge variant="law" size="sm" className="flex-shrink-0 flex items-center gap-1">
                  <Gavel className="h-2.5 w-2.5" />LAW
                </Badge>
              ) : (
                <Badge variant="failed" size="sm" className="flex-shrink-0 flex items-center gap-1">
                  <XCircle className="h-2.5 w-2.5" />Failed
                </Badge>
              )}
              {/* Swing type label */}
              <span className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                isComeback
                  ? 'bg-for-500/10 text-for-400 border-for-500/30'
                  : 'bg-against-500/10 text-against-400 border-against-500/30'
              )}>
                <SwingIcon className="h-2.5 w-2.5" />
                {swingLabel}
              </span>
              {flip.category && (
                <span className="flex-shrink-0 text-[10px] font-mono text-surface-500 border border-surface-400/30 px-2 py-0.5 rounded-full">
                  {flip.category}
                </span>
              )}
            </div>

            {/* Statement */}
            <Link
              href={`/topic/${flip.id}`}
              className="block text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug mb-3"
            >
              {flip.statement}
            </Link>

            {/* Swing arc */}
            <SwingArc
              early={flip.early_blue_pct}
              final={flip.final_blue_pct}
              swing={flip.swing}
            />
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="px-5 pb-3 flex items-center gap-3 text-[11px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" />
          {flip.total_votes.toLocaleString()} votes
        </span>
        <span>·</span>
        <span>{relativeTime(flip.updated_at)}</span>
        <div className="flex-1" />
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors"
          aria-expanded={expanded}
          aria-label="Show pivot argument"
        >
          <MessageSquare className="h-3 w-3" />
          {expanded ? 'Hide' : 'Pivot argument'}
          <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
        </button>
        <Link
          href={`/topic/${flip.id}`}
          aria-label="View debate"
          className="flex items-center gap-1 text-surface-500 hover:text-for-400 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Expanded: pivot argument */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-surface-300/50 pt-3">
              {flip.pivot_argument ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Most upvoted argument in this debate
                  </p>
                  <div className={cn(
                    'rounded-xl p-3 border text-sm',
                    flip.pivot_argument.side === 'blue'
                      ? 'bg-for-500/5 border-for-500/20 text-for-200'
                      : 'bg-against-500/5 border-against-500/20 text-against-200'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border',
                        flip.pivot_argument.side === 'blue'
                          ? 'bg-for-500/15 text-for-300 border-for-500/30'
                          : 'bg-against-500/15 text-against-300 border-against-500/30'
                      )}>
                        {flip.pivot_argument.side === 'blue' ? 'FOR' : 'AGAINST'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                        <ThumbsUp className="h-2.5 w-2.5" />
                        {flip.pivot_argument.upvotes} upvotes
                      </span>
                    </div>
                    <p className="text-xs text-surface-300 leading-relaxed line-clamp-4">
                      {flip.pivot_argument.content}
                    </p>
                    {flip.pivot_argument.author_username && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-surface-300/30">
                        <Avatar
                          src={flip.pivot_argument.author_avatar_url}
                          fallback={flip.pivot_argument.author_display_name ?? flip.pivot_argument.author_username}
                          size="xs"
                        />
                        <Link
                          href={`/profile/${flip.pivot_argument.author_username}`}
                          className="text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
                        >
                          @{flip.pivot_argument.author_username}
                        </Link>
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/arguments/${flip.pivot_argument.id}`}
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    View full argument <ArrowUpRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-surface-500 font-mono">No arguments found for this debate.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FlipSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
        >
          <div className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FlipClient() {
  const [filter, setFilter] = useState<Filter>('all')
  const [data, setData] = useState<FlipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/flip?filter=${filter}`)
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    setData(null)
    load()
  }, [load])

  const comebackCount = data?.flips.filter((f) => f.swing > 0).length ?? 0
  const collapseCount = data?.flips.filter((f) => f.swing < 0).length ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                <Flame className="h-5 w-5 text-against-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">The Big Flip</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Debates that defied the early odds
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <p className="mt-4 text-sm font-mono text-surface-500 leading-relaxed max-w-2xl">
            Every number tells a story. These debates had the most dramatic distance between{' '}
            <span className="text-for-400">where they started</span> and{' '}
            <span className="text-against-400">where they ended</span>. Comebacks that defied the
            crowd. Leads that evaporated. The Lobby&apos;s most unpredictable verdicts.
          </p>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-lg font-mono font-bold text-white">{data.flips.length}</p>
              <p className="text-[10px] font-mono text-surface-500">flip debates</p>
            </div>
            <div className="rounded-xl bg-for-500/10 border border-for-500/30 p-3 text-center">
              <p className="text-lg font-mono font-bold text-for-400">{comebackCount}</p>
              <p className="text-[10px] font-mono text-surface-500">comebacks</p>
            </div>
            <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-3 text-center">
              <p className="text-lg font-mono font-bold text-against-400">{collapseCount}</p>
              <p className="text-[10px] font-mono text-surface-500">collapses</p>
            </div>
          </div>
        )}

        {/* ── Filter tabs ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium',
                'border transition-all duration-150',
                filter === id
                  ? id === 'comeback'
                    ? 'bg-for-600 text-white border-for-500/50 shadow-sm'
                    : id === 'collapse'
                    ? 'bg-against-600/80 text-white border-against-500/50 shadow-sm'
                    : 'bg-surface-400 text-white border-surface-400/50 shadow-sm'
                  : 'bg-surface-200/70 text-surface-500 border-surface-300/50 hover:text-surface-300'
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <FlipSkeleton />
        ) : !data || data.flips.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No flip data yet"
            description="Flip data appears once enough debates have been resolved. Come back once more topics have completed their voting phase."
            action={{ label: 'Browse all topics', href: '/topic/categories' }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {data.flips.map((flip, i) => (
                  <FlipCard key={flip.id} flip={flip} rank={i} />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer context ────────────────────────────────────────────────── */}
        {data && !loading && data.total_topics_analysed > 0 && (
          <p className="mt-6 text-[11px] font-mono text-surface-600 text-center">
            Analysed {data.total_topics_analysed} resolved debates ·{' '}
            <Link href="/topic/categories" className="hover:text-surface-400 transition-colors">
              Browse all topics
            </Link>
            {' · '}
            <Link href="/analytics/evolution" className="hover:text-surface-400 transition-colors">
              Opinion evolution
            </Link>
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
