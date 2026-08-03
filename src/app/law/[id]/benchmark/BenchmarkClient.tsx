'use client'

/**
 * /law/[id]/benchmark — Law Category Benchmark
 *
 * Compares this law's democratic mandate against all other established
 * laws in the same category. Shows percentile rankings, mandate tier,
 * category statistics, top-ranked peers, and similar laws.
 *
 * Distinct from:
 *   /law/[id]/quality   — global platform quality index (all categories)
 *   /law/[id]/scorecard — rubric-based grading
 *   /law/[id]/compare   — side-by-side comparison with a hand-picked law
 *   /law/[id]/impact    — vote-timeline and participation stats
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Gavel,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawBenchmarkData, BenchmarkLaw } from '@/app/api/laws/[id]/benchmark/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Percentile ring ──────────────────────────────────────────────────────────

function PercentileRing({
  value,
  label,
  color,
  size = 120,
}: {
  value: number
  label: string
  color: string
  size?: number
}) {
  const strokeWidth = 10
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-surface-300"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={color}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white font-mono">{value}</span>
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">pct</span>
        </div>
      </div>
      <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  LawBenchmarkData['tier'],
  { label: string; color: string; bg: string; border: string; icon: typeof Trophy }
> = {
  Landmark: {
    label: 'Landmark',
    color: 'text-gold',
    bg: 'bg-gold/15',
    border: 'border-gold/40',
    icon: Crown,
  },
  Strong: {
    label: 'Strong',
    color: 'text-emerald',
    bg: 'bg-emerald/15',
    border: 'border-emerald/40',
    icon: Trophy,
  },
  Clear: {
    label: 'Clear',
    color: 'text-for-300',
    bg: 'bg-for-500/15',
    border: 'border-for-500/40',
    icon: CheckCircle2,
  },
  Slim: {
    label: 'Slim Majority',
    color: 'text-surface-300',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/40',
    icon: Scale,
  },
  Contested: {
    label: 'Contested',
    color: 'text-against-300',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    icon: Flame,
  },
}

// ─── Peer law row ─────────────────────────────────────────────────────────────

function PeerLawRow({
  law,
  rank,
  highlight,
}: {
  law: BenchmarkLaw
  rank?: number
  highlight?: boolean
}) {
  const forSide = law.blue_pct >= 50
  const forPct = Math.round(law.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-colors group',
        highlight
          ? 'bg-for-500/10 border-for-500/30'
          : 'bg-surface-200/60 border-surface-300/40 hover:border-surface-400/60'
      )}
    >
      {rank !== undefined && (
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-surface-300/50 text-[11px] font-mono font-bold text-surface-400">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span
            className={cn(
              'text-[10px] font-mono font-semibold',
              forSide ? 'text-for-300' : 'text-against-300'
            )}
          >
            {forSide ? forPct : againstPct}% {forSide ? 'FOR' : 'AGAINST'}
          </span>
          <span className="text-[10px] text-surface-500">·</span>
          <span className="text-[10px] text-surface-500 font-mono">
            {formatVotes(law.total_votes)} votes
          </span>
          <span className="text-[10px] text-surface-500">·</span>
          <span className="text-[10px] text-surface-500 font-mono">
            {law.mandateStrength}% mandate
          </span>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BenchmarkSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="flex gap-4 justify-around">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BenchmarkClient({ lawId }: { lawId: string }) {
  const [data, setData] = useState<LawBenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'top' | 'similar'>('top')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/benchmark`)
      if (!res.ok) throw new Error('Failed to load')
      const json: LawBenchmarkData = await res.json()
      setData(json)
    } catch {
      setError('Could not load benchmark data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const tier = data ? TIER_CONFIG[data.tier] : null
  const TierIcon = tier?.icon ?? Trophy

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">

        {/* Back link */}
        <div className="mb-5">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-4 w-4 text-purple" />
            <span className="text-xs font-mono font-semibold text-purple uppercase tracking-wider">
              Category Benchmark
            </span>
          </div>
          <h1 className="text-xl font-black text-white leading-tight">
            {data?.law.statement ?? 'Law Benchmark'}
          </h1>
          {data?.law.category && (
            <p className="mt-1 text-xs text-surface-400 font-mono">
              Benchmarked against {data.totalInCategory} established {data.law.category} laws
            </p>
          )}
        </div>

        {loading && <BenchmarkSkeleton />}
        {error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="text-against-300 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white mx-auto transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">

            {/* Tier + rank card */}
            <div className={cn(
              'rounded-2xl border p-5 flex items-center gap-4',
              tier?.bg, tier?.border
            )}>
              <div className={cn(
                'flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center',
                tier?.bg, tier?.border, 'border'
              )}>
                <TierIcon className={cn('h-7 w-7', tier?.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-lg font-black font-mono', tier?.color)}>
                    {tier?.label}
                  </span>
                  <span className="text-surface-500 text-sm font-mono">Mandate</span>
                </div>
                <p className="text-xs text-surface-400 mt-0.5">
                  Ranks <span className="font-bold text-white">#{data.rank}</span> of{' '}
                  <span className="font-bold text-white">{data.totalInCategory}</span>{' '}
                  {data.law.category ?? 'total'} laws by mandate strength
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-mono text-for-300">
                    <ThumbsUp className="inline h-3 w-3 mr-1" />
                    {Math.round(data.law.blue_pct)}% FOR
                  </span>
                  <span className="text-xs font-mono text-against-300">
                    <ThumbsDown className="inline h-3 w-3 mr-1" />
                    {100 - Math.round(data.law.blue_pct)}% AGAINST
                  </span>
                  <span className="text-xs font-mono text-surface-400">
                    <Users className="inline h-3 w-3 mr-1" />
                    {formatVotes(data.law.total_votes)} votes
                  </span>
                </div>
              </div>
            </div>

            {/* Percentile rings */}
            <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                  Percentile Rankings
                </span>
              </div>
              <div className="flex items-center justify-around gap-2 flex-wrap">
                <PercentileRing
                  value={data.percentiles.votes}
                  label="Participation"
                  color="text-purple"
                />
                <PercentileRing
                  value={data.percentiles.mandate}
                  label="Mandate"
                  color="text-for-400"
                />
                <PercentileRing
                  value={data.percentiles.consensus}
                  label="Consensus"
                  color="text-emerald"
                />
                <PercentileRing
                  value={data.percentiles.overall}
                  label="Overall"
                  color="text-gold"
                />
              </div>
              <p className="mt-4 text-[11px] text-surface-500 text-center">
                Percentile vs {data.totalInCategory} {data.law.category ?? 'platform'} laws
              </p>
            </div>

            {/* Category stats */}
            <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-3.5 w-3.5 text-purple" />
                <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                  {data.law.category ?? 'Platform'} Category Stats
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Laws', value: data.totalInCategory.toString(), icon: Gavel },
                  { label: 'Avg votes', value: formatVotes(data.categoryStats.avgVotes), icon: Users },
                  { label: 'Avg mandate', value: `${data.categoryStats.avgMandate}%`, icon: Scale },
                  { label: 'Avg FOR', value: `${data.categoryStats.avgBlue}%`, icon: ThumbsUp },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
                    <Icon className="h-4 w-4 text-surface-500 mx-auto mb-1" />
                    <p className="text-base font-black text-white font-mono">{value}</p>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            {data.insights.length > 0 && (
              <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-3.5 w-3.5 text-gold" />
                  <span className="text-xs font-mono font-semibold text-gold uppercase tracking-wider">
                    Benchmark Insights
                  </span>
                </div>
                <ul className="space-y-2">
                  {data.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-surface-300 leading-relaxed">
                      <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Peer laws tab switcher */}
            <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-gold" />
                  <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                    Peer Laws
                  </span>
                </div>
                <div className="flex rounded-lg border border-surface-300/50 overflow-hidden text-[11px] font-mono">
                  {(['top', 'similar'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        'px-3 py-1.5 transition-colors',
                        tab === t
                          ? 'bg-surface-300 text-white'
                          : 'text-surface-500 hover:text-surface-300'
                      )}
                    >
                      {t === 'top' ? 'Top Ranked' : 'Most Similar'}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  {tab === 'top' ? (
                    data.categoryStats.topLaws.length > 0 ? (
                      data.categoryStats.topLaws.map((law, i) => (
                        <PeerLawRow key={law.id} law={law} rank={i + 1} />
                      ))
                    ) : (
                      <p className="text-xs text-surface-500 text-center py-4">
                        No other laws in this category yet.
                      </p>
                    )
                  ) : (
                    data.categoryStats.similarLaws.length > 0 ? (
                      data.categoryStats.similarLaws.map((law) => (
                        <PeerLawRow key={law.id} law={law} />
                      ))
                    ) : (
                      <p className="text-xs text-surface-500 text-center py-4">
                        No similar laws found.
                      </p>
                    )
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/law/${lawId}/quality`}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-xs font-mono font-semibold text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Award className="h-3.5 w-3.5" />
                Global Quality Index
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/law/${lawId}/scorecard`}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-xs font-mono font-semibold text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Full Scorecard
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
