'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopCall, PendingCall, TopCallsStats, TopCallsResponse } from '@/app/api/exchange/top-calls/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: 'score',      label: 'Best Score',   icon: Trophy },
  { id: 'accuracy',   label: 'Most Accurate', icon: Target },
  { id: 'confidence', label: 'High Conviction',icon: Flame },
  { id: 'new',        label: 'Recent',        icon: Clock },
] as const
type SortMode = (typeof SORT_TABS)[number]['id']

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const DIRECTION_FILTERS = [
  { id: null,       label: 'All' },
  { id: 'bullish',  label: 'Bullish' },
  { id: 'bearish',  label: 'Bearish' },
] as const

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30'     },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
}

const CONFIDENCE_LABELS = ['', 'Exploratory', 'Low', 'Moderate', 'High', 'Conviction']
const CONFIDENCE_COLORS = ['', 'text-surface-500', 'text-surface-400', 'text-gold', 'text-for-400', 'text-emerald']

const HORIZON_LABEL: Record<string, string> = {
  '7d': '1-week call',
  '14d': '2-week call',
  '30d': '1-month call',
  '90d': '3-month call',
  '180d': '6-month call',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  const wk = Math.floor(d / 7)
  if (wk < 8) return `${wk}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function accuracyRing(accuracy: number) {
  if (accuracy >= 90) return { label: 'Perfect', color: 'text-gold', bg: 'bg-gold/15', border: 'border-gold/40' }
  if (accuracy >= 75) return { label: 'Sharp',   color: 'text-emerald', bg: 'bg-emerald/15', border: 'border-emerald/40' }
  if (accuracy >= 50) return { label: 'Solid',   color: 'text-for-400', bg: 'bg-for-500/15', border: 'border-for-500/40' }
  return { label: 'Miss', color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
}

function scoreBar(score: number) {
  const pct = Math.min(100, score)
  if (pct >= 80) return 'bg-gradient-to-r from-gold to-gold/60'
  if (pct >= 60) return 'bg-gradient-to-r from-emerald to-emerald/60'
  if (pct >= 40) return 'bg-gradient-to-r from-for-500 to-for-400'
  return 'bg-gradient-to-r from-surface-400 to-surface-500'
}

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Trophy
  label: string
  value: string | number | null
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 min-w-[100px]">
      <div className={cn('flex items-center gap-1.5', color)}>
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl font-mono font-bold text-white leading-none">
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─── TopCallCard ──────────────────────────────────────────────────────────────

function TopCallCard({ call, rank }: { call: TopCall; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const catStyle = CATEGORY_COLOR[call.category ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200/50', border: 'border-surface-400/30' }
  const ring = accuracyRing(call.accuracy)
  const isLaw = call.status === 'law'
  const isCorrect = call.direction_correct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(rank * 0.03, 0.3) }}
      className={cn(
        'rounded-2xl border bg-surface-100 transition-colors',
        isCorrect
          ? 'border-surface-300 hover:border-surface-400'
          : 'border-surface-300/60 opacity-70 hover:opacity-90 hover:border-surface-400'
      )}
    >
      <div className="p-4">
        {/* Header: rank + forecaster + score */}
        <div className="flex items-start gap-3 mb-3">
          {/* Rank badge */}
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-xs font-mono font-bold',
            rank === 1 ? 'bg-gold/20 text-gold border border-gold/40' :
            rank === 2 ? 'bg-surface-300/50 text-surface-400 border border-surface-400/30' :
            rank === 3 ? 'bg-against-500/10 text-against-400 border border-against-500/30' :
            'bg-surface-200/50 text-surface-600 border border-surface-300/30'
          )}>
            {rank === 1 ? <Trophy className="h-3.5 w-3.5" /> : `#${rank}`}
          </div>

          {/* Forecaster */}
          <Link
            href={`/profile/${call.username}`}
            className="flex items-center gap-2 flex-1 min-w-0 group"
          >
            <Avatar
              src={call.avatar_url}
              fallback={call.display_name || call.username}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
                {call.display_name || call.username}
              </p>
              <p className="text-[11px] text-surface-500">@{call.username}</p>
            </div>
          </Link>

          {/* Score badge */}
          <div className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold',
            ring.bg, ring.color, ring.border
          )}>
            <Target className="h-3 w-3" />
            {Math.round(call.composite_score)}
          </div>
        </div>

        {/* Resolution badge + direction */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {isLaw ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/40 text-gold text-[10px] font-mono font-bold">
              <Gavel className="h-3 w-3" />
              RESOLVED LAW
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-500/15 border border-against-500/40 text-against-400 text-[10px] font-mono font-bold">
              <X className="h-3 w-3" />
              RESOLVED FAILED
            </span>
          )}

          {call.direction === 'bullish' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-for-500/10 border border-for-500/30 text-for-300 text-[10px] font-mono">
              <TrendingUp className="h-3 w-3" />
              Called bullish
            </span>
          ) : call.direction === 'bearish' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-500/10 border border-against-500/30 text-against-300 text-[10px] font-mono">
              <TrendingDown className="h-3 w-3" />
              Called bearish
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-300/30 border border-surface-400/30 text-surface-500 text-[10px] font-mono">
              Neutral call
            </span>
          )}

          {isCorrect ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/30 text-emerald text-[10px] font-mono">
              <Check className="h-3 w-3" />
              Correct direction
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-300/20 border border-surface-400/20 text-surface-600 text-[10px] font-mono">
              Wrong direction
            </span>
          )}
        </div>

        {/* Topic statement */}
        <Link
          href={`/exchange/${call.topic_id}`}
          className="group block mb-3"
        >
          <p className="text-sm font-medium text-white group-hover:text-for-400 transition-colors leading-snug line-clamp-2">
            {call.statement}
          </p>
          {call.category && (
            <span className={cn('mt-1 inline-block text-[10px] font-mono', catStyle.text)}>
              {call.category}
            </span>
          )}
        </Link>

        {/* Price comparison */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <p className="text-[10px] text-surface-500 mb-1 font-mono">Target price</p>
            <p className="text-base font-mono font-bold text-white">{call.target_price}¢</p>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] text-surface-500 mb-1 font-mono">Resolved at</p>
            <p className={cn('text-base font-mono font-bold', isLaw ? 'text-gold' : 'text-against-400')}>
              {call.resolution_price}¢
            </p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-surface-500 mb-1 font-mono">Error</p>
            <p className={cn('text-base font-mono font-bold', call.price_error <= 10 ? 'text-emerald' : call.price_error <= 25 ? 'text-gold' : 'text-against-400')}>
              {call.price_error}¢
            </p>
          </div>
        </div>

        {/* Accuracy bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-500">Accuracy</span>
            <span className={cn('text-[10px] font-mono font-bold', ring.color)}>{call.accuracy}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', scoreBar(call.accuracy))}
              style={{ width: `${call.accuracy}%` }}
            />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-surface-500 font-mono flex-wrap">
          <span className={cn(CONFIDENCE_COLORS[call.confidence])}>
            {CONFIDENCE_LABELS[call.confidence]} confidence
          </span>
          {call.horizon && (
            <span>{HORIZON_LABEL[call.horizon] ?? call.horizon}</span>
          )}
          <span>{relTime(call.created_at)}</span>
          {call.days_held !== null && (
            <span>{call.days_held}d to resolve</span>
          )}
        </div>

        {/* Reasoning expandable */}
        {call.reasoning && (
          <div className="mt-3 pt-3 border-t border-surface-300">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide reasoning' : 'Show reasoning'}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-surface-400 leading-relaxed mt-2 overflow-hidden"
                >
                  &ldquo;{call.reasoning}&rdquo;
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── PendingCallCard ──────────────────────────────────────────────────────────

function PendingCallCard({ call }: { call: PendingCall }) {
  const catStyle = CATEGORY_COLOR[call.category ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200/50', border: 'border-surface-400/30' }
  const isBullish = call.direction === 'bullish'
  const isBearish = call.direction === 'bearish'

  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 hover:border-surface-400 transition-colors">
      <div className="flex items-start gap-2.5 mb-2.5">
        <Link href={`/profile/${call.username}`} className="flex-shrink-0">
          <Avatar src={call.avatar_url} fallback={call.display_name || call.username} size="sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {call.display_name || call.username}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isBullish ? (
              <span className="flex items-center gap-0.5 text-for-300 text-[10px] font-mono">
                <TrendingUp className="h-3 w-3" /> Bullish
              </span>
            ) : isBearish ? (
              <span className="flex items-center gap-0.5 text-against-300 text-[10px] font-mono">
                <TrendingDown className="h-3 w-3" /> Bearish
              </span>
            ) : (
              <span className="text-surface-500 text-[10px] font-mono">Neutral</span>
            )}
            <span className={cn('text-[10px] font-mono', CONFIDENCE_COLORS[call.confidence])}>
              · {CONFIDENCE_LABELS[call.confidence]}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-purple" />
          <span className="text-[10px] font-mono text-purple font-bold">VOTING</span>
        </div>
      </div>

      <Link href={`/exchange/${call.topic_id}`} className="group block mb-2">
        <p className="text-xs text-white group-hover:text-for-400 transition-colors leading-snug line-clamp-2">
          {call.statement}
        </p>
        {call.category && (
          <span className={cn('text-[10px] font-mono mt-0.5 block', catStyle.text)}>
            {call.category}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-3 text-[11px] font-mono">
        <span className="text-surface-500">
          Now: <span className="text-white">{Math.round(call.current_price)}¢</span>
        </span>
        <ArrowRight className="h-3 w-3 text-surface-600" />
        <span className="text-surface-500">
          Target: <span className={cn(call.delta > 0 ? 'text-for-400' : 'text-against-400')}>
            {call.target_price}¢
          </span>
        </span>
        <span className={cn(
          call.delta > 5 ? 'text-for-400' : call.delta < -5 ? 'text-against-400' : 'text-surface-400',
          'ml-auto'
        )}>
          {call.delta > 0 ? '+' : ''}{Math.round(call.delta)}¢ vs now
        </span>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CallSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-6 w-14 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TopCallsClient() {
  const [data, setData] = useState<TopCallsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortMode>('score')
  const [category, setCategory] = useState<string | null>(null)
  const [direction, setDirection] = useState<'bullish' | 'bearish' | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (s = sort, c = category, d = direction) => {
    setRefreshing(true)
    const params = new URLSearchParams({ sort: s })
    if (c) params.set('category', c)
    if (d) params.set('direction', d)
    try {
      const res = await fetch(`/api/exchange/top-calls?${params}`)
      if (res.ok) setData(await res.json())
    } catch { /* non-fatal */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sort, category, direction])

  useEffect(() => { load() }, [load])

  function handleSort(s: SortMode) {
    setSort(s)
    setLoading(true)
    load(s, category, direction)
  }

  function handleCategory(c: string | null) {
    setCategory(c)
    setShowCategories(false)
    setLoading(true)
    load(sort, c, direction)
  }

  function handleDirection(d: 'bullish' | 'bearish' | null) {
    setDirection(d)
    setLoading(true)
    load(sort, category, d)
  }

  const stats: TopCallsStats | null = data?.stats ?? null
  const calls: TopCall[] = data?.calls ?? []
  const pending: PendingCall[] = data?.pending ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold flex-shrink-0" />
              Top Calls
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              The most accurate civic market predictions — ranked after resolution
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <StatPill
            icon={BarChart2}
            label="Resolved calls"
            value={stats?.total_resolved ?? null}
            color="text-for-400"
          />
          <StatPill
            icon={Check}
            label="Correct dir"
            value={stats?.correct_direction_pct !== null ? `${stats?.correct_direction_pct}%` : null}
            color="text-emerald"
          />
          <StatPill
            icon={Target}
            label="Avg accuracy"
            value={stats?.avg_accuracy !== null ? `${stats?.avg_accuracy}%` : null}
            color="text-gold"
          />
          {stats?.top_category && (
            <StatPill
              icon={Award}
              label="Top category"
              value={stats.top_category}
              color="text-purple"
            />
          )}
        </div>

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {SORT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSort(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all border flex-shrink-0',
                sort === id
                  ? 'bg-for-600/20 border-for-600/50 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {/* Category picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCategories((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                category
                  ? 'bg-for-600/20 border-for-600/50 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {category || 'All categories'}
              <ChevronDown className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {showCategories && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1.5 z-30 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                >
                  <button
                    type="button"
                    onClick={() => handleCategory(null)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                      !category ? 'text-for-400' : 'text-surface-400'
                    )}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategory(cat)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                        category === cat ? 'text-for-400' : 'text-surface-400'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Direction filter */}
          <div className="flex gap-1.5">
            {DIRECTION_FILTERS.map(({ id, label }) => (
              <button
                key={String(id)}
                type="button"
                onClick={() => handleDirection(id as 'bullish' | 'bearish' | null)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  direction === id
                    ? id === 'bullish'
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : id === 'bearish'
                        ? 'bg-against-500/20 border-against-500/50 text-against-300'
                        : 'bg-for-600/20 border-for-600/50 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {(category || direction) && (
            <button
              type="button"
              onClick={() => { setCategory(null); setDirection(null); load(sort, null, null) }}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-against-400 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs font-mono text-surface-600">
            {data ? `${data.total} calls` : ''}
          </span>
        </div>

        {/* Resolved calls */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-mono font-bold text-white">Resolved Predictions</h2>
            {data && !loading && (
              <span className="text-xs text-surface-500 font-mono ml-auto">
                {calls.length} calls
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <CallSkeleton key={i} />)}
            </div>
          ) : calls.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-10 w-10 text-surface-600" />}
              title="No resolved predictions yet"
              description="As civic markets resolve, the most accurate community forecasts will appear here. Submit a price forecast on any active market to be the first to make the board."
              action={
                <Link
                  href="/exchange"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600/20 border border-for-600/40 text-for-300 text-sm font-mono font-semibold hover:bg-for-600/30 transition-colors"
                >
                  Browse markets
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {calls.map((call, i) => (
                <TopCallCard key={call.id} call={call} rank={i + 1} />
              ))}
            </div>
          )}
        </section>

        {/* Near-resolution pending calls */}
        {pending.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-purple" />
              <h2 className="text-sm font-mono font-bold text-white">Calls on the Clock</h2>
              <span className="text-xs text-surface-500 font-mono ml-auto">
                Markets now in voting
              </span>
            </div>
            <p className="text-xs text-surface-500 font-mono mb-3 leading-relaxed">
              These predictions are about to be graded — the markets are in voting phase now.
            </p>
            <div className="space-y-2.5">
              {pending.map((call) => (
                <PendingCallCard key={call.id} call={call} />
              ))}
            </div>
          </section>
        )}

        {/* CTA to submit a forecast */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-mono font-bold text-white mb-1">
                Make your call
              </h3>
              <p className="text-xs text-surface-500 leading-relaxed mb-3">
                Submit a price target and reasoning on any live market. When the market resolves,
                the most accurate calls appear here. High-conviction correct calls earn leaderboard spots and Clout.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/exchange"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-600/40 text-for-300 text-xs font-mono font-semibold hover:bg-for-600/30 transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Browse live markets
                </Link>
                <Link
                  href="/exchange/forecasts"
                  className="text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
                >
                  My forecasts →
                </Link>
              </div>
            </div>
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
