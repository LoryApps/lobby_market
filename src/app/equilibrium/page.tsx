'use client'

/**
 * /equilibrium — The Civic Equilibrium Monitor
 *
 * Shows which civic debates have found stable equilibrium (settled consensus)
 * vs. which are still in active flux. Computes a composite stability score
 * from consensus strength, vote volume, lifecycle stage, and argument balance.
 *
 * A debate is "in equilibrium" when the community has reached a clear,
 * stable verdict. A debate is "out of equilibrium" when it's contested,
 * low-volume, or still early in its lifecycle.
 *
 * Distinct from:
 *   /uncertainty  — measures closeness to 50/50 split
 *   /volatility   — measures rate of change over time
 *   /gradient     — shows distribution of all vote splits
 *   /momentum     — shows direction and speed of change
 *   /spectrum     — 2D scatter of consensus × engagement
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Circle,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EquilibriumResponse,
  EquilibriumTopic,
  EquilibriumTier,
  CategoryEquilibrium,
} from '@/app/api/equilibrium/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  EquilibriumTier,
  {
    label: string
    desc: string
    color: string
    bg: string
    border: string
    icon: typeof CheckCircle2
    bar: string
  }
> = {
  settled: {
    label: 'Settled',
    desc: 'Clear community verdict',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: CheckCircle2,
    bar: 'bg-emerald',
  },
  converging: {
    label: 'Converging',
    desc: 'Trending toward resolution',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: TrendingUp,
    bar: 'bg-for-500',
  },
  contested: {
    label: 'Contested',
    desc: 'Still actively debated',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
    bar: 'bg-gold',
  },
  undecided: {
    label: 'Undecided',
    desc: 'Too close or too new',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: Circle,
    bar: 'bg-against-400',
  },
}

const CAT_COLORS: Record<string, { text: string; bar: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bar: 'bg-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bar: 'bg-for-500',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bar: 'bg-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bar: 'bg-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300', bar: 'bg-against-400', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Philosophy:  { text: 'text-for-300',     bar: 'bg-for-400',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',        bar: 'bg-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-against-300', bar: 'bg-against-400', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Environment: { text: 'text-emerald',     bar: 'bg-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bar: 'bg-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreGradient(score: number): string {
  if (score >= 75) return 'text-emerald'
  if (score >= 50) return 'text-for-400'
  if (score >= 25) return 'text-gold'
  return 'text-against-300'
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald'
  if (score >= 50) return 'bg-for-500'
  if (score >= 25) return 'bg-gold'
  return 'bg-against-400'
}

// ─── Components ───────────────────────────────────────────────────────────────

function PlatformScoreGauge({ score }: { score: number }) {
  const tier = score >= 75 ? 'settled' : score >= 50 ? 'converging' : score >= 25 ? 'contested' : 'undecided'
  const cfg = TIER_CONFIG[tier]

  // SVG arc gauge
  const radius = 60
  const strokeWidth = 8
  const cx = 80
  const cy = 80
  // half-circle circumference (π * r) used to compute arc proportions
  // Generate arc path from 180° to 0° (left to right)
  function arcPath(pct: number) {
    const angle = Math.PI * pct // 0 to π
    const x = cx - radius * Math.cos(angle)
    const y = cy - radius * Math.sin(angle)
    return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${pct > 0.5 ? 1 : 0} 1 ${x} ${y}`
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="90" viewBox="0 0 160 90" className="overflow-visible">
        {/* Track */}
        <path
          d={arcPath(1)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-300"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={arcPath(score / 100)}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={cfg.color}
          strokeLinecap="round"
        />
        {/* Score text */}
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-mono" style={{ fontSize: 28, fill: 'white', fontWeight: 700 }}>
          {score}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 11, fill: '#6b7280', fontFamily: 'monospace' }}>
          / 100
        </text>
      </svg>
      <div className={cn('text-xs font-mono font-bold uppercase tracking-widest', cfg.color)}>
        {cfg.label}
      </div>
      <div className="text-xs font-mono text-surface-500">{cfg.desc}</div>
    </div>
  )
}

function TierBar({
  settled, converging, contested, undecided, total,
}: {
  settled: number; converging: number; contested: number; undecided: number; total: number
}) {
  if (total === 0) return null
  const pcts = {
    settled: (settled / total) * 100,
    converging: (converging / total) * 100,
    contested: (contested / total) * 100,
    undecided: (undecided / total) * 100,
  }
  return (
    <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface-300">
      {(['settled', 'converging', 'contested', 'undecided'] as const).map((tier) => (
        pcts[tier] > 0 && (
          <div
            key={tier}
            className={cn('h-full transition-all', TIER_CONFIG[tier].bar)}
            style={{ width: `${pcts[tier]}%` }}
            title={`${tier}: ${pcts[tier].toFixed(1)}%`}
          />
        )
      ))}
    </div>
  )
}

function TopicRow({ topic, rank }: { topic: EquilibriumTopic; rank: number }) {
  const tier = TIER_CONFIG[topic.tier]
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.03 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/50 transition-colors group"
      >
        {/* Rank */}
        <span className="text-xs font-mono text-surface-600 w-5 text-right flex-shrink-0">
          {rank + 1}
        </span>

        {/* Score badge */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-mono font-bold border',
            tier.bg,
            tier.border,
            tier.color
          )}
        >
          {topic.equilibrium_score}
        </div>

        {/* Statement */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {topic.category && (
              <span className={cn('text-[10px] font-mono uppercase tracking-wider', CAT_COLORS[topic.category]?.text ?? 'text-surface-400')}>
                {topic.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {forPct}% FOR · {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>

        {/* Vote bar mini */}
        <div className="flex-shrink-0 w-16 hidden sm:block">
          <div className="h-1.5 rounded-full overflow-hidden flex bg-surface-300">
            <div className="h-full bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-against-400" style={{ width: `${againstPct}%` }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] font-mono text-for-400">{forPct}%</span>
            <span className="text-[9px] font-mono text-against-400">{againstPct}%</span>
          </div>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 group-hover:text-surface-400 transition-colors" />
      </Link>
    </motion.div>
  )
}

function CategoryCard({ cat }: { cat: CategoryEquilibrium }) {
  const colors = CAT_COLORS[cat.category] ?? { text: 'text-surface-400', bar: 'bg-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
  return (
    <div className={cn('rounded-xl border p-3 space-y-2', colors.bg, colors.border)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', colors.text)}>
          {cat.category}
        </span>
        <span className={cn('text-lg font-mono font-bold', scoreGradient(cat.avg_score))}>
          {cat.avg_score}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden bg-surface-300">
        <div
          className={cn('h-full rounded-full transition-all', scoreBarColor(cat.avg_score))}
          style={{ width: `${cat.avg_score}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span>{cat.topic_count} topics</span>
        <span className="text-emerald">{cat.settled_pct}% settled</span>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Skeleton className="h-24 w-40 rounded-xl" />
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Category grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Topic lists */}
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-300">
              <Skeleton className="h-4 w-32" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EquilibriumPage() {
  const [data, setData] = useState<EquilibriumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'settled' | 'contested'>('settled')
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/equilibrium', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load equilibrium data')
      const json: EquilibriumResponse = await res.json()
      setData(json)
      setRefreshedAt(new Date().toLocaleTimeString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const settledTopics = data?.topics.filter((t) => t.tier === 'settled' || t.tier === 'converging').slice(0, 10) ?? []
  const contestedTopics = data?.topics
    .filter((t) => t.tier === 'undecided' || t.tier === 'contested')
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 10) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight">
              Civic Equilibrium
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              Which debates have found their verdict — and which remain unresolved?
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            {refreshedAt ? `Updated ${refreshedAt}` : 'Refresh'}
          </button>
        </div>

        {/* Content */}
        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Failed to load"
            description={error}
            actions={[{ label: 'Try again', onClick: fetchData }]}
          />
        )}

        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >

              {/* Platform score card */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">

                  {/* Gauge */}
                  <div className="flex-shrink-0">
                    <PlatformScoreGauge score={data.stats.platform_score} />
                    <p className="text-center text-[10px] font-mono text-surface-600 mt-1">
                      Platform equilibrium
                    </p>
                  </div>

                  {/* Stats grid */}
                  <div className="flex-1 w-full space-y-3">
                    {/* Tier bar */}
                    <TierBar
                      settled={data.stats.settled_count}
                      converging={data.stats.converging_count}
                      contested={data.stats.contested_count}
                      undecided={data.stats.undecided_count}
                      total={data.stats.total_topics}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(
                        [
                          { tier: 'settled' as const, count: data.stats.settled_count },
                          { tier: 'converging' as const, count: data.stats.converging_count },
                          { tier: 'contested' as const, count: data.stats.contested_count },
                          { tier: 'undecided' as const, count: data.stats.undecided_count },
                        ]
                      ).map(({ tier, count }) => {
                        const cfg = TIER_CONFIG[tier]
                        const TierIcon = cfg.icon
                        return (
                          <div
                            key={tier}
                            className={cn('rounded-xl border p-3 text-center', cfg.bg, cfg.border)}
                          >
                            <TierIcon className={cn('h-4 w-4 mx-auto mb-1', cfg.color)} />
                            <div className={cn('text-xl font-mono font-bold', cfg.color)}>{count}</div>
                            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                              {cfg.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Law vs Active comparison */}
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg bg-surface-200 border border-surface-300 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gavel className="h-3.5 w-3.5 text-gold" />
                          <span className="text-xs font-mono text-surface-400">Laws avg</span>
                        </div>
                        <span className={cn('text-sm font-mono font-bold', scoreGradient(data.stats.law_avg_score))}>
                          {data.stats.law_avg_score}
                        </span>
                      </div>
                      <div className="flex-1 rounded-lg bg-surface-200 border border-surface-300 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-for-400" />
                          <span className="text-xs font-mono text-surface-400">Active avg</span>
                        </div>
                        <span className={cn('text-sm font-mono font-bold', scoreGradient(data.stats.active_avg_score))}>
                          {data.stats.active_avg_score}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Category summary blurb */}
                {data.stats.most_settled_category && data.stats.most_contested_category && (
                  <div className="mt-4 pt-4 border-t border-surface-300 flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 rounded-lg bg-emerald/10 border border-emerald/20 px-3 py-2 text-xs font-mono text-surface-400">
                      <span className="text-emerald font-semibold">Most settled: </span>
                      {data.stats.most_settled_category}
                      <span className="text-surface-600 ml-1">— clearest community consensus</span>
                    </div>
                    <div className="flex-1 rounded-lg bg-against-500/10 border border-against-500/20 px-3 py-2 text-xs font-mono text-surface-400">
                      <span className="text-against-300 font-semibold">Most contested: </span>
                      {data.stats.most_contested_category}
                      <span className="text-surface-600 ml-1">— still being decided</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Category equilibrium grid */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-mono font-semibold text-white">Category stability</h2>
                  <span className="text-xs font-mono text-surface-600 ml-auto">
                    Higher = more debates resolved
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {data.categories.map((cat) => (
                    <CategoryCard key={cat.category} cat={cat} />
                  ))}
                  {data.categories.length === 0 && (
                    <p className="col-span-full text-xs font-mono text-surface-500 text-center py-6">
                      No category data yet
                    </p>
                  )}
                </div>
              </div>

              {/* Topic lists — tabs */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                {/* Tab header */}
                <div className="flex border-b border-surface-300">
                  {(
                    [
                      { key: 'settled' as const, label: 'Most Settled', icon: CheckCircle2, color: 'text-emerald' },
                      { key: 'contested' as const, label: 'Most Contested', icon: Scale, color: 'text-gold' },
                    ]
                  ).map(({ key, label, icon: Icon, color }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-mono font-medium transition-colors',
                        activeTab === key
                          ? 'text-white border-b-2 border-for-500 bg-surface-200/50'
                          : 'text-surface-500 hover:text-surface-300'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', activeTab === key ? color : '')} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  {activeTab === 'settled' && (
                    <motion.div
                      key="settled"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {settledTopics.length === 0 ? (
                        <div className="py-12 text-center">
                          <p className="text-sm font-mono text-surface-500">No settled topics yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/50">
                          {settledTopics.map((topic, i) => (
                            <TopicRow key={topic.id} topic={topic} rank={i} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'contested' && (
                    <motion.div
                      key="contested"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {contestedTopics.length === 0 ? (
                        <div className="py-12 text-center">
                          <p className="text-sm font-mono text-surface-500">No contested topics yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/50">
                          {contestedTopics.map((topic, i) => (
                            <TopicRow key={topic.id} topic={topic} rank={i} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Methodology note */}
              <div className="rounded-xl bg-surface-200/50 border border-surface-300 px-4 py-3 text-xs font-mono text-surface-500 leading-relaxed">
                <Sparkles className="h-3 w-3 inline mr-1.5 text-gold" />
                <strong className="text-surface-400">Equilibrium score</strong> combines four dimensions:
                {' '}consensus strength (45%), vote volume (30%), lifecycle stage (15%), and argument balance (10%).
                Topics scoring ≥75 are <span className="text-emerald">Settled</span>, 50–74 are{' '}
                <span className="text-for-400">Converging</span>, 25–49 are{' '}
                <span className="text-gold">Contested</span>, below 25 are{' '}
                <span className="text-against-300">Undecided</span>.
              </div>

              {/* Related links */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { href: '/uncertainty', label: 'Uncertainty', icon: Scale },
                  { href: '/volatility', label: 'Volatility', icon: Activity },
                  { href: '/gradient', label: 'Gradient', icon: BarChart2 },
                  { href: '/momentum', label: 'Momentum', icon: TrendingUp },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
