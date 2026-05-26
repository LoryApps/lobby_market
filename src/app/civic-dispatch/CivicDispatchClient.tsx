'use client'

/**
 * /civic-dispatch — The Civic Dispatch
 *
 * A category-curated "tonight's top stories" for democracy. Shows the single
 * most significant active debate per policy domain, scored by a composite
 * signal that weighs threshold proximity, vote volume, consensus decisiveness,
 * and recency. Urgency labels (BREAKING / DEVELOPING / WATCH / LIVE) map to
 * concrete civic conditions.
 *
 * Distinct from:
 *   /breaking    — chronological list of multiple breaking events
 *   /triage      — urgency-ranked across all categories (no per-cat curation)
 *   /signals     — aggregate platform metrics and power-user dashboard
 *   /heat        — composite heat score (all topics, all categories)
 *   /lens        — static category overview (latest law + hottest debate)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Cpu,
  DollarSign,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lightbulb,
  Palette,
  Radio,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DispatchItem, DispatchResponse, DispatchUrgency } from '@/app/api/civic-dispatch/route'

// ─── Category config ──────────────────────────────────────────────────────────

interface CatMeta {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  glow: string
}

const CAT_META: Record<string, CatMeta> = {
  Economics: {
    icon: DollarSign,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'shadow-gold/10',
  },
  Politics: {
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-for-500/10',
  },
  Technology: {
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'shadow-purple/10',
  },
  Science: {
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'shadow-emerald/10',
  },
  Ethics: {
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-against-500/10',
  },
  Philosophy: {
    icon: Lightbulb,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'shadow-gold/10',
  },
  Culture: {
    icon: Palette,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'shadow-purple/10',
  },
  Health: {
    icon: Heart,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-against-500/10',
  },
  Environment: {
    icon: Leaf,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'shadow-emerald/10',
  },
  Education: {
    icon: GraduationCap,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-for-500/10',
  },
}

const CATEGORY_ORDER = [
  'Politics',
  'Economics',
  'Technology',
  'Health',
  'Environment',
  'Education',
  'Science',
  'Ethics',
  'Culture',
  'Philosophy',
]

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<DispatchUrgency, { label: string; dot: string; text: string }> = {
  BREAKING: { label: 'BREAKING', dot: 'bg-against-500', text: 'text-against-400' },
  DEVELOPING: { label: 'DEVELOPING', dot: 'bg-gold', text: 'text-gold' },
  WATCH: { label: 'WATCH', dot: 'bg-purple', text: 'text-purple' },
  LIVE: { label: 'LIVE', dot: 'bg-emerald', text: 'text-emerald' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: DispatchUrgency }) {
  const cfg = URGENCY_CONFIG[urgency]
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest', cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function VoteBar({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className="h-full bg-for-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  )
}

function DispatchCard({
  category,
  item,
  index,
  isHottest,
}: {
  category: string
  item: DispatchItem
  index: number
  isHottest: boolean
}) {
  const meta = CAT_META[category] ?? CAT_META.Politics
  const Icon = meta.icon
  const forPct = Math.round(item.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cn(
        'relative rounded-xl border p-4 bg-surface-200/50 transition-shadow duration-200',
        'hover:shadow-lg',
        meta.border,
        meta.glow,
        isHottest && 'ring-1 ring-against-500/30'
      )}
    >
      {isHottest && (
        <span className="absolute -top-px right-4 text-[9px] font-mono font-bold tracking-widest text-against-400 bg-surface-100 px-2 py-0.5 border-x border-b border-against-500/30 rounded-b">
          TOP STORY
        </span>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
            <Icon className={cn('h-3.5 w-3.5', meta.color)} />
          </div>
          <div>
            <p className={cn('text-[10px] font-mono font-bold tracking-widest uppercase', meta.color)}>
              {category}
            </p>
            {item.scope && (
              <p className="text-[9px] text-surface-500 font-mono">{item.scope}</p>
            )}
          </div>
        </div>
        <UrgencyBadge urgency={item.urgency} />
      </div>

      {/* Statement */}
      <p className="text-sm font-medium text-white leading-snug mb-3 line-clamp-3">
        {item.statement}
      </p>

      {/* Urgency detail */}
      <p className="text-[11px] text-surface-500 mb-3 leading-snug">
        {item.urgency_detail}
      </p>

      {/* Vote split */}
      <div className="mb-3">
        <VoteBar pct={forPct} />
        <div className="flex justify-between mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-for-400 font-mono">
            <ThumbsUp className="h-2.5 w-2.5" />
            {forPct}% For
          </span>
          <span className="text-[9px] text-surface-500 font-mono">
            {item.total_votes.toLocaleString()} votes
          </span>
          <span className="flex items-center gap-1 text-[10px] text-against-400 font-mono">
            {againstPct}% Against
            <ThumbsDown className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/topic/${item.id}`}
        className={cn(
          'flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-mono font-semibold',
          'transition-colors duration-150',
          meta.bg,
          meta.color,
          'hover:brightness-110 border',
          meta.border
        )}
      >
        Go to debate <ArrowRight className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

function EmptyCategory({ category, index }: { category: string; index: number }) {
  const meta = CAT_META[category] ?? CAT_META.Politics
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cn(
        'rounded-xl border p-4 bg-surface-200/30',
        meta.border
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', meta.bg)}>
          <Icon className={cn('h-3.5 w-3.5 opacity-50', meta.color)} />
        </div>
        <p className={cn('text-[10px] font-mono font-bold tracking-widest uppercase opacity-50', meta.color)}>
          {category}
        </p>
      </div>
      <p className="text-xs text-surface-500 text-center py-4">No active debates</p>
    </motion.div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-surface-300/30 p-4 bg-surface-200/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicDispatchClient() {
  const [data, setData] = useState<DispatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-dispatch')
      if (!res.ok) throw new Error('Failed to load dispatch')
      const json: DispatchResponse = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), 60_000)
    return () => clearInterval(timer)
  }, [load])

  const dispatches = data?.dispatches ?? {}
  const summary = data?.summary

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 pb-24 pt-16">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Radio className="h-4 w-4 text-against-400" />
                <h1 className="text-lg font-bold text-white tracking-tight font-mono">
                  The Civic Dispatch
                </h1>
              </div>
              <p className="text-xs text-surface-500 leading-relaxed max-w-md">
                One top story per category — the most significant civic debate happening right now,
                scored by consensus urgency, vote volume, and threshold proximity.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono text-surface-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-200 border border-transparent hover:border-surface-300"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              {refreshing ? 'Updating…' : 'Refresh'}
            </button>
          </div>

          {/* Summary strip */}
          {summary && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 mb-6 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300/30"
            >
              <Zap className="h-3.5 w-3.5 text-gold shrink-0" />
              <div className="flex items-center gap-4 flex-wrap text-[10px] font-mono text-surface-400">
                <span>
                  <span className="text-white font-bold">{summary.total_active}</span> active debates
                </span>
                <span>
                  <span className="text-white font-bold">{summary.total_dispatches}</span> categories covered
                </span>
                {summary.hottest_category && (
                  <span>
                    Top story: <span className={cn('font-bold', CAT_META[summary.hottest_category]?.color ?? 'text-white')}>{summary.hottest_category}</span>
                  </span>
                )}
                {lastUpdated && (
                  <span className="ml-auto text-surface-600">
                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-6 p-3 rounded-lg bg-against-500/10 border border-against-500/30 text-xs text-against-400 text-center"
              >
                {error} —{' '}
                <button onClick={() => load()} className="underline hover:no-underline">
                  retry
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dispatch grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
              : CATEGORY_ORDER.map((cat, i) => {
                  const item = dispatches[cat]
                  if (!item) return <EmptyCategory key={cat} category={cat} index={i} />
                  return (
                    <DispatchCard
                      key={cat}
                      category={cat}
                      item={item}
                      index={i}
                      isHottest={cat === summary?.hottest_category}
                    />
                  )
                })}
          </div>

          {/* Footer nav */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 pt-6 border-t border-surface-300/30"
            >
              <p className="text-[10px] font-mono text-surface-600 text-center mb-4 uppercase tracking-widest">
                Related Signals
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { href: '/breaking', label: 'Breaking' },
                  { href: '/triage', label: 'Triage' },
                  { href: '/heat', label: 'Heat Index' },
                  { href: '/canary', label: 'Canary' },
                  { href: '/signals', label: 'Signals' },
                  { href: '/lens', label: 'Lens' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[10px] font-mono px-3 py-1.5 rounded-full border border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
