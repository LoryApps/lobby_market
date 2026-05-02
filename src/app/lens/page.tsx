'use client'

/**
 * /lens — The Civic Lens
 *
 * A live, scannable dashboard showing the current state of every civic
 * category at a glance.  Each "lens" card reveals the category's hottest
 * active debate, the most recently established law, the overall FOR/AGAINST
 * lean, and a week-over-week opinion trend indicator.
 *
 * Unlike /discover (personalised) or /signals (power-user metrics), the Lens
 * gives every visitor the same structured 30 000-ft view of what the Lobby is
 * debating right now — sorted by activity level.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronRight,
  Cpu,
  DollarSign,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  LayoutGrid,
  Leaf,
  Lightbulb,
  Loader2,
  Palette,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LensCategoryData, LensResponse } from '@/app/api/lens/route'

// ─── Category meta ────────────────────────────────────────────────────────────

type CategoryMeta = {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  glow: string
  description: string
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  Economics: {
    icon: DollarSign,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'shadow-gold/10',
    description: 'Markets, wealth, fiscal policy, and economic systems.',
  },
  Politics: {
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-for-500/10',
    description: 'Governance, elections, power, and democratic systems.',
  },
  Technology: {
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'shadow-purple/10',
    description: 'Digital futures, AI, innovation, and tech regulation.',
  },
  Science: {
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'shadow-emerald/10',
    description: 'Research, evidence, and empirical truth.',
  },
  Ethics: {
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-against-500/10',
    description: 'Morality, rights, justice, and values.',
  },
  Philosophy: {
    icon: Lightbulb,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'shadow-gold/10',
    description: 'Foundations of thought, metaphysics, and meaning.',
  },
  Culture: {
    icon: Palette,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'shadow-purple/10',
    description: 'Society, expression, identity, and shared life.',
  },
  Health: {
    icon: Heart,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-against-500/10',
    description: 'Medicine, mental health, public health policy.',
  },
  Environment: {
    icon: Leaf,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'shadow-emerald/10',
    description: 'Climate, sustainability, and ecological systems.',
  },
  Education: {
    icon: GraduationCap,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-for-500/10',
    description: 'Learning, knowledge systems, and academic policy.',
  },
}

function getMeta(name: string): CategoryMeta {
  return CATEGORY_META[name] ?? {
    icon: LayoutGrid,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
    glow: '',
    description: 'Miscellaneous civic topics.',
  }
}

// ─── Status badge variant ─────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LensCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
      </div>
      <div className="space-y-2 pt-1">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="border-t border-surface-300/50 pt-3 space-y-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

// ─── Trend indicator ──────────────────────────────────────────────────────────

function TrendPill({ delta }: { delta: number }) {
  if (Math.abs(delta) < 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-300/40 text-surface-500 border border-surface-400/30">
        <Minus className="h-2.5 w-2.5" />
        Flat
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-for-600/20 text-for-300 border border-for-500/30">
        <ArrowUp className="h-2.5 w-2.5" />
        +{delta}% FOR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-against-600/20 text-against-300 border border-against-500/30">
      <ArrowDown className="h-2.5 w-2.5" />
      {delta}% AGN
    </span>
  )
}

// ─── Category Lens Card ───────────────────────────────────────────────────────

function LensCard({ data, index }: { data: LensCategoryData; index: number }) {
  const meta = getMeta(data.name)
  const Icon = meta.icon
  const forPct = Math.round(data.avgBluePct)
  const againstPct = 100 - forPct

  const activityLevel =
    data.activeCount >= 5 ? 'High' :
    data.activeCount >= 2 ? 'Moderate' :
    data.activeCount === 1 ? 'Low' : 'Quiet'

  const activityColor =
    data.activeCount >= 5 ? 'text-emerald' :
    data.activeCount >= 2 ? 'text-gold' :
    data.activeCount === 1 ? 'text-surface-500' : 'text-surface-600'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 flex flex-col gap-4',
        'hover:border-surface-400/60 transition-colors duration-200',
        meta.border
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0',
            meta.bg, `border ${meta.border}`
          )}
        >
          <Icon className={cn('h-5 w-5', meta.color)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={cn('text-sm font-mono font-bold leading-tight', meta.color)}>
            {data.name}
          </h2>
          <p className="text-[11px] font-mono text-surface-500 truncate mt-0.5">
            {meta.description}
          </p>
        </div>
        <span className={cn('text-[10px] font-mono font-semibold flex-shrink-0 pt-0.5', activityColor)}>
          {activityLevel}
        </span>
      </div>

      {/* ── Overall lean bar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            Overall lean
          </span>
          <TrendPill delta={data.recentVoteDelta} />
        </div>
        <div className="relative h-2 rounded-full overflow-hidden bg-surface-300/50">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-400 rounded-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGN</span>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap">
        {data.activeCount > 0 && (
          <span className="flex items-center gap-1 text-for-400">
            <Zap className="h-3 w-3" />
            {data.activeCount} active
          </span>
        )}
        {data.proposedCount > 0 && (
          <span className="text-surface-500">{data.proposedCount} proposed</span>
        )}
        {data.lawCount > 0 && (
          <span className="flex items-center gap-1 text-gold">
            <Gavel className="h-3 w-3" />
            {data.lawCount} laws
          </span>
        )}
        {data.weeklyVotes > 0 && (
          <span className="text-surface-600 ml-auto">
            {data.weeklyVotes.toLocaleString()} votes/wk
          </span>
        )}
      </div>

      {/* ── Top active topic ── */}
      {data.topTopic ? (
        <div className="space-y-2 border-t border-surface-300/40 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1">
              <Zap className="h-3 w-3 text-for-500" />
              Hot debate
            </span>
            <Badge variant={STATUS_VARIANT[data.topTopic.status] ?? 'proposed'} className="text-[10px]">
              {STATUS_LABEL[data.topTopic.status] ?? data.topTopic.status}
            </Badge>
          </div>
          <Link
            href={`/topic/${data.topTopic.id}`}
            className="group block"
          >
            <p className="text-xs font-mono text-surface-700 group-hover:text-white line-clamp-2 leading-relaxed transition-colors">
              {data.topTopic.statement}
            </p>
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-for-400">
              <ThumbsUp className="h-2.5 w-2.5 inline mr-0.5" />
              {Math.round(data.topTopic.blue_pct)}%
            </span>
            <span className="text-against-400">
              <ThumbsDown className="h-2.5 w-2.5 inline mr-0.5" />
              {100 - Math.round(data.topTopic.blue_pct)}%
            </span>
            <span className="text-surface-600 ml-auto">
              {data.topTopic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
      ) : (
        <div className="border-t border-surface-300/40 pt-3">
          <p className="text-[11px] font-mono text-surface-600 italic">No active debates right now.</p>
          <Link
            href={`/topic/create`}
            className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            Propose a topic →
          </Link>
        </div>
      )}

      {/* ── Most recent law ── */}
      {data.recentLaw && (
        <div className="space-y-1.5 border-t border-surface-300/40 pt-3">
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1">
            <Gavel className="h-3 w-3 text-gold" />
            Latest law
          </span>
          <Link
            href={`/law/${data.recentLaw.id}`}
            className="group block"
          >
            <p className="text-xs font-mono text-gold/80 group-hover:text-gold line-clamp-2 leading-relaxed transition-colors">
              {data.recentLaw.statement}
            </p>
          </Link>
          <p className="text-[10px] font-mono text-surface-600">
            {relativeTime(data.recentLaw.established_at)} · {data.recentLaw.total_votes.toLocaleString()} votes
          </p>
        </div>
      )}

      {/* ── Pass rate + explore ── */}
      <div className="flex items-center justify-between pt-1 border-t border-surface-300/40">
        <div className="text-[10px] font-mono text-surface-500">
          {data.passRate > 0 ? (
            <span>
              <span className="text-gold font-semibold">{data.passRate}%</span> passage rate
            </span>
          ) : (
            <span>No resolved topics yet</span>
          )}
        </div>
        <Link
          href={`/categories/${encodeURIComponent(data.name)}`}
          className={cn(
            'flex items-center gap-1 text-[11px] font-mono font-semibold transition-colors',
            meta.color, `hover:opacity-80`
          )}
          aria-label={`Explore ${data.name} category`}
        >
          Explore
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const POLL_MS = 60_000 * 2 // refresh every 2 minutes

export default function LensPage() {
  const [data, setData] = useState<LensResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/lens', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as LensResponse
        setData(json)
        setLastUpdated(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(), POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  const totalActive = data?.categories.reduce((s, c) => s + c.activeCount, 0) ?? 0
  const totalLaws = data?.categories.reduce((s, c) => s + c.lawCount, 0) ?? 0
  const weeklyVotes = data?.categories.reduce((s, c) => s + c.weeklyVotes, 0) ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Lens</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The state of every debate category, right now
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh lens data"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 text-xs font-mono"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Platform-wide summary strip ── */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center">
              <p className="text-xl font-black font-mono text-for-400">{totalActive}</p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">Active debates</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center">
              <p className="text-xl font-black font-mono text-gold">{totalLaws}</p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">Laws established</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center">
              <p className="text-xl font-black font-mono text-purple">
                {weeklyVotes >= 1000 ? `${(weeklyVotes / 1000).toFixed(1)}k` : weeklyVotes}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">Votes this week</p>
            </div>
          </motion.div>
        )}

        {/* ── Last updated ── */}
        {lastUpdated && !loading && (
          <p className="text-[11px] font-mono text-surface-600 mb-4">
            Updated {relativeTime(lastUpdated.toISOString())} · auto-refreshes every 2 min
          </p>
        )}

        {/* ── Category grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <LensCardSkeleton key={i} />
            ))}
          </div>
        ) : data && data.categories.length > 0 ? (
          <AnimatePresence mode="wait">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.categories.map((cat, i) => (
                <LensCard key={cat.name} data={cat} index={i} />
              ))}
            </div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4">
              <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
            </div>
            <p className="text-surface-500 text-sm font-mono">Loading civic landscape…</p>
          </div>
        )}

        {/* ── Footer CTA ── */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-semibold transition-colors"
            >
              <Zap className="h-4 w-4" />
              Vote now
            </Link>
            <Link
              href="/signals"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-white text-sm font-mono font-semibold transition-colors"
            >
              Platform Signals
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/drift"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-white text-sm font-mono font-semibold transition-colors"
            >
              Opinion Drift
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
