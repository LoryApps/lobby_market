'use client'

/**
 * /volatility — The Civic Volatility Index
 *
 * Shows which active debates have the most UNSTABLE vote splits —
 * topics where the FOR/AGAINST ratio swings significantly day-over-day.
 *
 * Volatility score = standard deviation of daily FOR% over 7 days.
 * A high score means the community is genuinely undecided: some days FOR,
 * other days AGAINST, with no stable majority forming.
 *
 * Distinct from:
 *   /flux      — shows the single biggest SHIFT in last 24 h (direction-based)
 *   /seismic   — detects anomalous single-day vote BURSTS
 *   /drift     — shows category-level trend over time (directional, not variance)
 *   /pendulum  — shows historical arc of resolved topics (not ongoing instability)
 *
 * This is the only view answering: "Which debates are genuinely up for grabs?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  VolatileTopic,
  CategoryVolatility,
  DailySnapshot,
  VolatilityResponse,
} from '@/app/api/volatility/route'

// ─── Category config ──────────────────────────────────────────────────────────

interface CatMeta {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}

const CAT_META: Record<string, CatMeta> = {
  Economics:   { icon: BarChart2,    color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { icon: Landmark,     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { icon: Cpu,          color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { icon: FlaskConical, color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { icon: Scale,        color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Culture:     { icon: Music2,       color: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Health:      { icon: Heart,        color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Environment: { icon: Leaf,         color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { icon: GraduationCap,color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
}

function getCatMeta(cat: string | null): CatMeta {
  return (cat && CAT_META[cat]) ?? {
    icon: Activity,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  }
}

// ─── Volatility label config ──────────────────────────────────────────────────

const LABEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  extreme: { label: 'Extreme',  color: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/40' },
  high:    { label: 'High',     color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  moderate:{ label: 'Moderate', color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  low:     { label: 'Low',      color: 'text-surface-500', bg: 'bg-surface-200',    border: 'border-surface-300'    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ snapshots, className }: { snapshots: DailySnapshot[]; className?: string }) {
  if (snapshots.length < 2) return null

  const W = 80
  const H = 28
  const pts = snapshots
  const minV = Math.min(...pts.map((s) => s.for_pct))
  const maxV = Math.max(...pts.map((s) => s.for_pct))
  const range = Math.max(maxV - minV, 5)

  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W)
  const ys = pts.map((s) => H - ((s.for_pct - minV) / range) * (H - 4) - 2)

  const d = pts
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ')

  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  const lineColor = last.for_pct > prev.for_pct ? '#3b82f6' : last.for_pct < prev.for_pct ? '#ef4444' : '#6b7280'

  return (
    <svg width={W} height={H} className={className} viewBox={`0 0 ${W} ${H}`}>
      {/* 50% reference line */}
      <line
        x1={0} y1={H - ((50 - minV) / range) * (H - 4) - 2}
        x2={W} y2={H - ((50 - minV) / range) * (H - 4) - 2}
        stroke="#3f3f46" strokeDasharray="2 2" strokeWidth={0.8}
      />
      <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={xs[xs.length - 1]}
        cy={ys[ys.length - 1]}
        r={2}
        fill={lineColor}
      />
    </svg>
  )
}

// ─── Topic card ────────────────────────────────────────────────────────────────

function TopicCard({ topic, rank }: { topic: VolatileTopic; rank: number }) {
  const catMeta = getCatMeta(topic.category)
  const CatIcon = catMeta.icon
  const labelCfg = LABEL_CONFIG[topic.volatility_label] ?? LABEL_CONFIG.low
  const TrendIcon = topic.current_trend === 'rising'
    ? TrendingUp
    : topic.current_trend === 'falling'
      ? TrendingDown
      : Minus

  const trendColor = topic.current_trend === 'rising'
    ? 'text-for-400'
    : topic.current_trend === 'falling'
      ? 'text-against-400'
      : 'text-surface-500'

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.3) }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            {/* Rank */}
            <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 text-xs font-mono font-bold text-surface-500 mt-0.5">
              {rank}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  labelCfg.bg, labelCfg.color, labelCfg.border
                )}>
                  <Zap className="h-2.5 w-2.5" />
                  {labelCfg.label} volatility
                </span>
                {topic.category && (
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                    catMeta.bg, catMeta.color, catMeta.border
                  )}>
                    <CatIcon className="h-2.5 w-2.5" />
                    {topic.category}
                  </span>
                )}
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium',
                  topic.status === 'active' && 'bg-for-500/15 text-for-400',
                  topic.status === 'voting' && 'bg-purple/15 text-purple',
                  topic.status === 'proposed' && 'bg-surface-400/15 text-surface-400',
                  topic.status === 'law' && 'bg-emerald/15 text-emerald',
                  topic.status === 'failed' && 'bg-against-500/15 text-against-400',
                )}>
                  {topic.status.toUpperCase()}
                </span>
              </div>

              {/* Statement */}
              <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                {topic.statement}
              </p>
            </div>

            {/* External link */}
            <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-3">
            {/* Vote bar mini */}
            <div className="flex-1">
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-for-400">{forPct}% FOR</span>
                <span className="text-against-400">{againstPct}% AGAINST</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-for-500 to-for-400" style={{ width: `${forPct}%` }} />
              </div>
            </div>

            {/* Sparkline */}
            <div className="flex-shrink-0">
              <Sparkline snapshots={topic.snapshots} />
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-surface-500">
            <span className={cn('flex items-center gap-1', labelCfg.color)}>
              <Zap className="h-3 w-3" />
              σ {topic.volatility_score.toFixed(1)}
            </span>
            <span>±{topic.swing_range}pp swing</span>
            <span>{topic.recent_votes} votes / {topic.day_count}d</span>
            <span className={cn('flex items-center gap-0.5 ml-auto', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {topic.current_trend}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  cat,
  maxVolatility,
  onClick,
  active,
}: {
  cat: CategoryVolatility
  maxVolatility: number
  onClick: () => void
  active: boolean
}) {
  const meta = getCatMeta(cat.category)
  const CatIcon = meta.icon
  const pct = maxVolatility > 0 ? (cat.avg_volatility / maxVolatility) * 100 : 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
        active
          ? cn(meta.bg, meta.border, meta.color)
          : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
      )}
    >
      <CatIcon className={cn('h-4 w-4 flex-shrink-0', active ? meta.color : '')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-white truncate">{cat.category}</span>
          <span className="text-[10px] font-mono ml-2 flex-shrink-0">σ {cat.avg_volatility}</span>
        </div>
        <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn('h-full transition-all', active ? 'bg-current' : 'bg-surface-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] mt-0.5 truncate opacity-70">{cat.topic_count} topic{cat.topic_count !== 1 ? 's' : ''}</p>
      </div>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="space-y-1">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VolatilityClient() {
  const [data, setData] = useState<VolatilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [showCatBreakdown, setShowCatBreakdown] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (cat: string | null, refresh = false) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    if (refresh) setRefreshing(true)
    else setLoading(true)

    try {
      const url = cat
        ? `/api/volatility?category=${encodeURIComponent(cat)}`
        : '/api/volatility'
      const res = await fetch(url, { signal: ac.signal, cache: 'no-store' })
      if (!res.ok || ac.signal.aborted) return
      const json = (await res.json()) as VolatilityResponse
      setData(json)
    } catch {
      // aborted or network error
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    load(selectedCategory)
  }, [selectedCategory, load])

  function handleRefresh() {
    load(selectedCategory, true)
  }

  function handleCategoryClick(cat: string) {
    setSelectedCategory((prev) => (prev === cat ? null : cat))
    setShowAll(false)
  }

  const topics = data?.topics ?? []
  const displayed = showAll ? topics : topics.slice(0, 12)
  const maxCatVol = data ? Math.max(...(data.category_volatility.map((c) => c.avg_volatility)), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-against-400" />
              Civic Volatility Index
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Debates where the community can&apos;t make up its mind — ranked by consensus instability
            </p>
          </div>
        </div>

        {/* Platform summary */}
        {data && !loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-mono font-bold text-against-400">
                  σ {data.platform_avg_volatility}
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">avg volatility</p>
              </div>
              <div className="text-center border-x border-surface-300">
                <p className="text-2xl font-mono font-bold text-white">
                  {data.topics.length}
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">tracked debates</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-mono font-bold text-purple">
                  {data.window_days}d
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">analysis window</p>
              </div>
            </div>
          </div>
        )}

        {/* Category breakdown toggle */}
        {data && data.category_volatility.length > 0 && !loading && (
          <div className="mb-5">
            <button
              onClick={() => setShowCatBreakdown((v) => !v)}
              className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-2"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Category breakdown
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showCatBreakdown && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showCatBreakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-2">
                    {data.category_volatility.map((cat) => (
                      <CategoryBar
                        key={cat.category}
                        cat={cat}
                        maxVolatility={maxCatVol}
                        onClick={() => handleCategoryClick(cat.category)}
                        active={selectedCategory === cat.category}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Category filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <button
            onClick={() => { setSelectedCategory(null); setShowAll(false) }}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
              selectedCategory === null
                ? 'bg-surface-300 text-white border-surface-400'
                : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white'
            )}
          >
            All categories
          </button>
          {CATEGORIES.map((cat) => {
            const meta = getCatMeta(cat)
            return (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  selectedCategory === cat
                    ? cn(meta.bg, meta.color, meta.border)
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white'
                )}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Refresh + legend */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-against-500 inline-block" />
              Extreme (σ≥20)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gold inline-block" />
              High (σ≥12)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple inline-block" />
              Moderate (σ≥6)
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Topic list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <TopicSkeleton key={i} />)}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No volatile debates found"
            description={
              selectedCategory
                ? `No debates in ${selectedCategory} have enough vote data to measure volatility yet.`
                : "There aren't enough debates with sufficient vote data to measure volatility yet. Check back as more votes come in."
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              <AnimatePresence>
                {displayed.map((topic, i) => (
                  <TopicCard key={topic.id} topic={topic} rank={i + 1} />
                ))}
              </AnimatePresence>
            </div>

            {/* Show more */}
            {!showAll && topics.length > 12 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-100 border border-surface-300 text-surface-500 hover:text-white text-sm font-mono transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
                Show {topics.length - 12} more debates
              </button>
            )}

            {/* Data note */}
            {data && (
              <p className="mt-6 text-center text-[10px] font-mono text-surface-600">
                Volatility = σ of daily FOR% over last {data.window_days} days ·
                Updated {new Date(data.generated_at).toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
