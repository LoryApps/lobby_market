'use client'

/**
 * /correlations — Civic Correlation Atlas
 *
 * Reveals the hidden ideological structure of the Lobby by showing which
 * topics tend to be voted on the same way by the same people.
 *
 * A strong positive correlation (e.g. 85%) means: of voters who voted on
 * BOTH topics, 85% chose the same side (both FOR or both AGAINST) on each.
 *
 * A negative correlation means most voters chose opposite sides — i.e. the
 * topics are "flip-sides" of an ideological split.
 *
 * Distinct from:
 *   /analytics/kin         — finds users who vote like you
 *   /analytics/consistency — measures how consistent YOU are
 *   /compare               — compares two specific topics side by side
 *   /analytics/alignment   — how aligned you are with your network
 *   /twins                 — finds users who vote identically to you
 *
 * This is the only view showing cross-TOPIC voting correlations platform-wide.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CorrelationPair, CorrelationsResponse } from '@/app/api/stats/correlations/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20'     },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20'        },
  Health:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function correlationLabel(c: number): {
  label: string
  sub: string
  strength: 'strong' | 'moderate' | 'weak'
  direction: 'aligned' | 'opposed'
} {
  const abs = Math.abs(c)
  const direction: 'aligned' | 'opposed' = c >= 0 ? 'aligned' : 'opposed'
  let strength: 'strong' | 'moderate' | 'weak'
  let label: string
  let sub: string

  if (abs >= 0.6) {
    strength = 'strong'
    label = direction === 'aligned' ? 'Strongly aligned' : 'Strongly opposed'
    sub = direction === 'aligned'
      ? 'Voters almost always agree on both'
      : 'Voters almost always split on these'
  } else if (abs >= 0.3) {
    strength = 'moderate'
    label = direction === 'aligned' ? 'Moderately aligned' : 'Moderately opposed'
    sub = direction === 'aligned'
      ? 'Voters tend to agree on both'
      : 'Voters tend to split on these'
  } else {
    strength = 'weak'
    label = 'Loosely linked'
    sub = 'Slight statistical tendency to co-vote'
  }
  return { label, sub, strength, direction }
}

function correlationColor(c: number): {
  bar: string
  text: string
  bg: string
  border: string
  ring: string
} {
  const abs = Math.abs(c)
  if (c >= 0) {
    // Aligned: blue / for spectrum
    if (abs >= 0.6) return { bar: 'bg-for-500', text: 'text-for-300', bg: 'bg-for-500/8', border: 'border-for-500/25', ring: 'ring-for-500/15' }
    if (abs >= 0.3) return { bar: 'bg-for-600', text: 'text-for-400', bg: 'bg-for-600/6', border: 'border-for-600/20', ring: 'ring-for-500/10' }
    return { bar: 'bg-surface-400', text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/20', ring: 'ring-surface-400/10' }
  } else {
    // Opposed: red / against spectrum
    if (abs >= 0.6) return { bar: 'bg-against-500', text: 'text-against-300', bg: 'bg-against-500/8', border: 'border-against-500/25', ring: 'ring-against-500/15' }
    if (abs >= 0.3) return { bar: 'bg-against-600', text: 'text-against-400', bg: 'bg-against-600/6', border: 'border-against-600/20', ring: 'ring-against-500/10' }
    return { bar: 'bg-surface-400', text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/20', ring: 'ring-surface-400/10' }
  }
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryPill({ category }: { category: string | null }) {
  if (!category) return null
  const cfg = CATEGORY_COLOR[category] ?? { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/20' }
  const Icon = CATEGORY_ICON[category]
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border', cfg.text, cfg.bg, cfg.border)}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {category}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed',
}

function StatusPill({ status }: { status: string }) {
  const type = status === 'law' ? 'law' : status === 'active' || status === 'voting' ? 'active' : status === 'failed' ? 'failed' : 'proposed'
  return <Badge variant={type as 'law' | 'active' | 'proposed' | 'failed'} size="xs">{STATUS_LABEL[status] ?? status}</Badge>
}

// ─── Correlation card ─────────────────────────────────────────────────────────

function CorrelationCard({ pair, index }: { pair: CorrelationPair; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const colors = correlationColor(pair.correlation)
  const meta = correlationLabel(pair.correlation)
  const alignPct = Math.round(pair.alignment_rate * 100)
  const barWidth = Math.round(Math.abs(pair.correlation) * 100)

  // For the explanation: what do aligned voters actually do?
  const bothForPct = pair.shared_voters > 0 ? Math.round((pair.both_blue / pair.shared_voters) * 100) : 0
  const bothAgainstPct = pair.shared_voters > 0 ? Math.round((pair.both_red / pair.shared_voters) * 100) : 0
  const crossPct = 100 - bothForPct - bothAgainstPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-2xl border transition-all duration-200',
        colors.bg, colors.border,
        'ring-1', colors.ring,
        'hover:border-opacity-40',
      )}
    >
      {/* Header */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 mt-0.5">
            <span className={cn('text-xs font-mono font-bold tabular-nums', colors.text)}>
              #{index + 1}
            </span>
          </div>

          {/* Topics */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Topic A */}
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CategoryPill category={pair.topic_a_category} />
                  <StatusPill status={pair.topic_a_status} />
                </div>
                <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                  {pair.topic_a_statement}
                </p>
                <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  <ThumbsUp className="h-2.5 w-2.5 text-for-500" />
                  {Math.round(pair.topic_a_blue_pct)}% For
                  <span className="mx-1">·</span>
                  {pair.topic_a_total_votes.toLocaleString()} votes
                </div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex items-center gap-2 pl-1">
              <div className={cn('h-px flex-1 opacity-40', colors.bar === 'bg-for-500' || colors.bar === 'bg-for-600' ? 'bg-for-500' : colors.bar === 'bg-against-500' || colors.bar === 'bg-against-600' ? 'bg-against-500' : 'bg-surface-400')} />
              <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', colors.text, colors.bg, colors.border)}>
                {pair.correlation >= 0 ? (
                  <Zap className="h-2.5 w-2.5" />
                ) : (
                  <Scale className="h-2.5 w-2.5" />
                )}
                {alignPct}% aligned
              </div>
              <div className={cn('h-px flex-1 opacity-40', colors.bar === 'bg-for-500' || colors.bar === 'bg-for-600' ? 'bg-for-500' : colors.bar === 'bg-against-500' || colors.bar === 'bg-against-600' ? 'bg-against-500' : 'bg-surface-400')} />
            </div>

            {/* Topic B */}
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CategoryPill category={pair.topic_b_category} />
                  <StatusPill status={pair.topic_b_status} />
                </div>
                <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                  {pair.topic_b_statement}
                </p>
                <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  <ThumbsUp className="h-2.5 w-2.5 text-for-500" />
                  {Math.round(pair.topic_b_blue_pct)}% For
                  <span className="mx-1">·</span>
                  {pair.topic_b_total_votes.toLocaleString()} votes
                </div>
              </div>
            </div>
          </div>

          {/* Chevron */}
          <button
            className={cn('flex-shrink-0 mt-1 text-surface-500 hover:text-white transition-colors', expanded && 'text-white')}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', colors.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${barWidth}%` }}
              transition={{ duration: 0.6, delay: index * 0.04 + 0.2, ease: 'easeOut' }}
            />
          </div>
          <div className="flex-shrink-0 text-right">
            <span className={cn('text-[11px] font-mono font-semibold', colors.text)}>
              {meta.label}
            </span>
          </div>
        </div>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">
          {pair.shared_voters.toLocaleString()} citizen{pair.shared_voters !== 1 ? 's' : ''} voted on both · {meta.sub}
        </p>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300/40 pt-3 space-y-3">
              {/* Breakdown */}
              <div>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                  How shared voters split
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <ThumbsUp className="h-3 w-3 text-for-400" />
                      <span className="text-surface-400">FOR on both</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
                        <div className="h-full rounded-full bg-for-500" style={{ width: `${bothForPct}%` }} />
                      </div>
                      <span className="font-mono text-for-300 w-8 text-right">{bothForPct}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <ThumbsDown className="h-3 w-3 text-against-400" />
                      <span className="text-surface-400">AGAINST on both</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
                        <div className="h-full rounded-full bg-against-500" style={{ width: `${bothAgainstPct}%` }} />
                      </div>
                      <span className="font-mono text-against-300 w-8 text-right">{bothAgainstPct}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="h-3 w-3 text-surface-500" />
                      <span className="text-surface-500">Split (voted differently)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
                        <div className="h-full rounded-full bg-surface-400" style={{ width: `${crossPct}%` }} />
                      </div>
                      <span className="font-mono text-surface-500 w-8 text-right">{crossPct}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insight */}
              <div className={cn('rounded-lg p-3 text-xs font-mono leading-relaxed', colors.bg, colors.border, 'border')}>
                {pair.correlation >= 0 ? (
                  <span className="text-surface-300">
                    <span className={colors.text}>Ideologically linked.</span>{' '}
                    Citizens who engage with these topics tend to hold consistent positions across both.
                    A {alignPct}% alignment rate means they share underlying values or frameworks.
                  </span>
                ) : (
                  <span className="text-surface-300">
                    <span className={colors.text}>Ideological fault line.</span>{' '}
                    These topics sit on opposite sides of a values divide — voters who lean one way
                    on the first tend to lean the other way on the second.
                  </span>
                )}
              </div>

              {/* Links */}
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/topic/${pair.topic_a_id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-surface-200/80 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Open topic A
                </Link>
                <Link
                  href={`/topic/${pair.topic_b_id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-surface-200/80 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Open topic B
                </Link>
                <Link
                  href={`/compare?a=${pair.topic_a_id}&b=${pair.topic_b_id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-surface-200/80 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  <BarChart2 className="h-2.5 w-2.5" />
                  Side-by-side compare
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CorrelationSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100/30 p-4 space-y-3">
      <div className="flex gap-3">
        <Skeleton className="h-3 w-5 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-3 w-20 rounded" />
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-surface-300/40" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="flex-1 h-px bg-surface-300/40" />
          </div>
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-48 rounded" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'all' | 'aligned' | 'opposed'

export default function CorrelationsPage() {
  const [data, setData] = useState<CorrelationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [showInfo, setShowInfo] = useState(false)
  const fetchRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++fetchRef.current
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '40' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/stats/correlations?${params}`)
      if (!res.ok) throw new Error('Failed to load correlations')
      const json = (await res.json()) as CorrelationsResponse
      if (id === fetchRef.current) {
        setData(json)
      }
    } catch (e) {
      if (id === fetchRef.current) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    } finally {
      if (id === fetchRef.current) setLoading(false)
    }
  }, [category])

  useEffect(() => {
    load()
  }, [load])

  // Filter by direction
  const pairs = data?.pairs ?? []
  const filtered = viewMode === 'aligned'
    ? pairs.filter((p) => p.correlation >= 0)
    : viewMode === 'opposed'
    ? pairs.filter((p) => p.correlation < 0)
    : pairs

  const alignedCount = pairs.filter((p) => p.correlation >= 0).length
  const opposedCount = pairs.filter((p) => p.correlation < 0).length
  const strongCount = pairs.filter((p) => Math.abs(p.correlation) >= 0.5).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/25">
                  <Zap className="h-5 w-5 text-for-400" />
                </div>
                <h1 className="text-2xl font-bold text-white font-mono">Correlation Atlas</h1>
              </div>
              <p className="text-sm font-mono text-surface-500 leading-relaxed max-w-md">
                Which civic topics are ideologically linked? When voters agree on Topic A,
                do they also agree on Topic B — or flip to the opposite side?
              </p>
            </div>
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="flex-shrink-0 mt-1 text-surface-500 hover:text-white transition-colors"
              aria-label="How this works"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Info panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-4 text-xs font-mono text-surface-400 leading-relaxed space-y-2">
                  <p>
                    <span className="text-for-300 font-semibold">Alignment rate</span> = percentage of voters who chose
                    the SAME side (both FOR or both AGAINST) on both topics.
                    A 75% alignment rate means 3 in 4 shared voters took consistent positions.
                  </p>
                  <p>
                    <span className="text-for-300 font-semibold">Correlation score</span> ranges from −1 (perfectly opposed)
                    to +1 (perfectly aligned). Random overlap would score near 0.
                  </p>
                  <p>
                    Only topic pairs with at least <span className="text-white">5 shared voters</span> are shown.
                    Scores are based on the top 60 most-voted topics.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats bar */}
        {!loading && data && data.pairs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Pairs found', value: data.pairs.length, color: 'text-white' },
              { label: 'Aligned', value: alignedCount, color: 'text-for-300' },
              { label: 'Opposed', value: opposedCount, color: 'text-against-300' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl border border-surface-300/40 bg-surface-100/60 px-3 py-2.5 text-center"
              >
                <p className={cn('text-lg font-mono font-bold tabular-nums', color)}>{value}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Category filter */}
        <div className="mb-4 overflow-x-auto -mx-4 px-4">
          <div className="flex gap-1.5 min-w-max pb-1">
            <button
              onClick={() => setCategory(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                category === null
                  ? 'bg-surface-300/80 border-surface-400/60 text-white'
                  : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:text-white'
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const cfg = CATEGORY_COLOR[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat === category ? null : cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    category === cat
                      ? cn(cfg.text, cfg.bg, cfg.border)
                      : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:text-white'
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* View mode filter */}
        <div className="flex gap-1.5 mb-5">
          {(
            [
              { id: 'all', label: 'All connections', icon: Zap },
              { id: 'aligned', label: `Aligned (${alignedCount})`, icon: ThumbsUp },
              { id: 'opposed', label: `Opposed (${opposedCount})`, icon: Scale },
            ] as { id: ViewMode; label: string; icon: typeof Zap }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                viewMode === id
                  ? id === 'aligned'
                    ? 'bg-for-500/15 border-for-500/30 text-for-300'
                    : id === 'opposed'
                    ? 'bg-against-500/15 border-against-500/30 text-against-300'
                    : 'bg-surface-300/80 border-surface-400/60 text-white'
                  : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:text-white'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <CorrelationSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-800/60 bg-against-950/30 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="No correlations found"
            description={
              category
                ? `Not enough shared voters across ${category} topics yet to compute correlations. Try a broader filter or check back as the platform grows.`
                : 'Not enough users have voted on multiple topics yet. Correlations emerge as more citizens engage across the platform.'
            }
            action={
              category
                ? { label: 'Show all categories', onClick: () => setCategory(null) }
                : { label: 'Browse topics', href: '/' }
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((pair, i) => (
              <CorrelationCard
                key={`${pair.topic_a_id}-${pair.topic_b_id}`}
                pair={pair}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Footer info */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 pt-4 border-t border-surface-300/30 text-center">
            <p className="text-[11px] font-mono text-surface-600">
              Based on {data?.total_topics_analyzed.toLocaleString()} popular topic
              {data?.total_topics_analyzed !== 1 ? 's' : ''} · Pairs with ≥5 shared voters ·{' '}
              {strongCount > 0 && (
                <span className="text-surface-500">{strongCount} strong correlation{strongCount !== 1 ? 's' : ''} found · </span>
              )}
              Updates in real-time as votes come in
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-3">
              <Link href="/analytics" className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors">
                Personal analytics →
              </Link>
              <Link href="/analytics/kin" className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors">
                Find civic kin →
              </Link>
              <Link href="/polarization" className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors">
                Polarization index →
              </Link>
              <Link href="/compare" className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors">
                Compare topics →
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
