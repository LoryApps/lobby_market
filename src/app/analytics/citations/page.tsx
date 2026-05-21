'use client'

/**
 * /analytics/citations — Citation Impact Analytics
 *
 * Shows how citing evidence in arguments affects engagement and AI quality
 * scores. Compares cited vs uncited argument performance across categories,
 * surfaces top sources used, and shows monthly citation habit trends.
 *
 * Distinct from:
 *   /analytics/arguments  — overall argument portfolio (grades, upvotes, history)
 *   /analytics/discourse  — platform-wide discourse quality
 *   /top-arguments        — leaderboard of best arguments
 *   /sources              — source reliability ratings
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Globe,
  Link2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  CitationAnalyticsResponse,
  CitationImpactByCategory,
  CitationSourceStat,
  TopCitedArgument,
} from '@/app/api/analytics/citations/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald bg-emerald/10 border-emerald/30',
  B: 'text-for-400 bg-for-500/10 border-for-500/30',
  C: 'text-gold bg-gold/10 border-gold/30',
  D: 'text-against-400 bg-against-500/10 border-against-500/30',
  F: 'text-surface-500 bg-surface-300/10 border-surface-500/30',
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function catColor(c: string) {
  return CAT_COLOR[c] ?? 'text-surface-400'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl bg-surface-100 border p-4 flex flex-col gap-2',
        highlight ? 'border-for-500/40 bg-for-500/5' : 'border-surface-300/60',
      )}
    >
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ─── Impact comparison bar ────────────────────────────────────────────────────

function ImpactBar({
  label,
  citedVal,
  uncitedVal,
  unit = '',
  higher = true,
}: {
  label: string
  citedVal: number
  uncitedVal: number
  unit?: string
  higher?: boolean
}) {
  const max = Math.max(citedVal, uncitedVal, 0.01)
  const citedPct = (citedVal / max) * 100
  const uncitedPct = (uncitedVal / max) * 100
  const isBetter = higher ? citedVal > uncitedVal : citedVal < uncitedVal

  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-surface-400 uppercase tracking-wider">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-for-400 w-14 text-right">Cited</span>
          <div className="flex-1 h-2.5 bg-surface-300/30 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', isBetter ? 'bg-for-500' : 'bg-surface-500')}
              initial={{ width: 0 }}
              animate={{ width: `${citedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-mono text-white w-16 tabular-nums">
            {citedVal.toFixed(unit === '%' ? 0 : 1)}
            {unit}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-surface-500 w-14 text-right">No cite</span>
          <div className="flex-1 h-2.5 bg-surface-300/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-surface-500/60"
              initial={{ width: 0 }}
              animate={{ width: `${uncitedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
          <span className="text-[11px] font-mono text-surface-400 w-16 tabular-nums">
            {uncitedVal.toFixed(unit === '%' ? 0 : 1)}
            {unit}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CitationImpactByCategory }) {
  const total = cat.cited_count + cat.uncited_count
  const lift =
    cat.uncited_avg_upvotes > 0
      ? ((cat.cited_avg_upvotes - cat.uncited_avg_upvotes) / cat.uncited_avg_upvotes) * 100
      : 0

  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-sm font-semibold', catColor(cat.category))}>
            {cat.category}
          </span>
          <span className="text-[11px] font-mono text-surface-600">{total} args</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-surface-500">
            {Math.round(cat.citation_rate * 100)}% cited
          </span>
          {lift !== 0 && (
            <span
              className={cn(
                'text-[11px] font-mono font-semibold',
                lift > 0 ? 'text-emerald' : 'text-against-400',
              )}
            >
              {lift > 0 ? '+' : ''}
              {lift.toFixed(0)}% upvotes
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-for-500/70"
          initial={{ width: 0 }}
          animate={{ width: `${cat.citation_rate * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-xs font-bold text-white tabular-nums">{cat.cited_count}</p>
          <p className="text-[10px] font-mono text-surface-600">Cited</p>
        </div>
        <div>
          <p className="font-mono text-xs font-bold text-white tabular-nums">
            {cat.cited_avg_upvotes.toFixed(1)}
          </p>
          <p className="text-[10px] font-mono text-surface-600">Avg ↑ (cited)</p>
        </div>
        <div>
          <p className="font-mono text-xs font-bold text-white tabular-nums">
            {cat.uncited_avg_upvotes.toFixed(1)}
          </p>
          <p className="text-[10px] font-mono text-surface-600">Avg ↑ (no cite)</p>
        </div>
      </div>
    </div>
  )
}

// ─── Source row ───────────────────────────────────────────────────────────────

function SourceRow({ source, rank }: { source: CitationSourceStat; rank: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/40">
      <span className="font-mono text-xs text-surface-600 w-5 text-right flex-shrink-0">
        {rank}
      </span>
      <div className="h-7 w-7 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
        <Globe className="h-3.5 w-3.5 text-for-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-white truncate">{source.domain}</p>
        <p className="text-[10px] font-mono text-surface-500">
          {source.count} citation{source.count !== 1 ? 's' : ''} · {source.avg_upvotes.toFixed(1)} avg ↑
          {source.avg_ai_score !== null && ` · ${source.avg_ai_score.toFixed(1)} AI`}
        </p>
      </div>
      <div className="flex-shrink-0">
        <span className="font-mono text-xs font-bold text-white tabular-nums">
          ×{source.count}
        </span>
      </div>
    </div>
  )
}

// ─── Cited argument card ──────────────────────────────────────────────────────

function CitedArgCard({ arg }: { arg: TopCitedArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="block rounded-xl bg-surface-100 border border-surface-300/40 p-4 hover:border-surface-400/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-mono text-white group-hover:text-for-300 transition-colors leading-snug line-clamp-2 flex-1">
          {arg.content}
        </p>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5 group-hover:text-surface-400 transition-colors" />
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={cn(
            'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            isFor
              ? 'text-for-300 bg-for-500/10 border-for-500/25'
              : 'text-against-300 bg-against-500/10 border-against-500/25',
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {arg.ai_grade && (
          <span
            className={cn(
              'text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border',
              GRADE_COLOR[arg.ai_grade] ?? 'text-surface-400 bg-surface-300/10 border-surface-500/30',
            )}
          >
            Grade {arg.ai_grade}
          </span>
        )}
        {arg.topic?.category && (
          <span className={cn('text-[11px] font-mono font-semibold', catColor(arg.topic.category))}>
            {arg.topic.category}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <a
          href={arg.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors truncate max-w-[60%]"
        >
          <Link2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{arg.domain}</span>
        </a>
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          <span className="tabular-nums">{arg.upvotes}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Monthly trend mini-chart ─────────────────────────────────────────────────

const SW = 280
const SH = 72
const P = 8

function TrendChart({
  trend,
}: {
  trend: { month: string; cited: number; uncited: number; citation_rate: number }[]
}) {
  const months = trend.filter((m) => m.cited + m.uncited > 0).slice(-8)
  if (months.length < 2) return null

  const maxTotal = Math.max(...months.map((m) => m.cited + m.uncited), 1)
  const rates = months.map((m) => m.citation_rate)
  const maxR = Math.max(...rates, 0.01)
  const minR = Math.min(...rates.filter((r) => r > 0), maxR)

  const xFor = (i: number) => P + (i / (months.length - 1)) * (SW - P * 2)
  const yFor = (r: number) =>
    SH - P - ((r - minR) / Math.max(maxR - minR, 0.01)) * (SH - P * 2)

  const path = months
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(m.citation_rate)}`)
    .join(' ')

  const ml = (key: string) =>
    new Date(
      Number(key.slice(0, 4)),
      Number(key.slice(5, 7)) - 1,
      1,
    ).toLocaleDateString('en-US', { month: 'short' })

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-for-400" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Citation Rate Trend</p>
          <p className="text-[11px] font-mono text-surface-500">Monthly citation habit</p>
        </div>
      </div>
      <svg
        width={SW}
        height={SH}
        viewBox={`0 0 ${SW} ${SH}`}
        className="w-full"
        role="img"
        aria-label="Monthly citation rate trend"
      >
        {months.map((m, i) => {
          const totalH = ((m.cited + m.uncited) / maxTotal) * (SH - P * 2)
          const citedH = (m.cited / Math.max(m.cited + m.uncited, 1)) * totalH
          const x = xFor(i)
          return (
            <g key={m.month}>
              <rect
                x={x - 7}
                y={SH - P - totalH}
                width={14}
                height={totalH}
                rx={3}
                fill="rgba(100,116,139,0.2)"
              />
              <rect
                x={x - 7}
                y={SH - P - citedH}
                width={14}
                height={citedH}
                rx={3}
                fill="rgba(59,130,246,0.4)"
              />
            </g>
          )
        })}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="flex justify-between mt-1">
        {months.map((m) => (
          <span key={m.month} className="text-[10px] font-mono text-surface-600">
            {ml(m.month)}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-for-500/40" />
          <span className="text-[11px] font-mono text-surface-500">Cited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-surface-500/40" />
          <span className="text-[11px] font-mono text-surface-500">Uncited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 bg-for-500 rounded-full" />
          <span className="text-[11px] font-mono text-surface-500">Citation rate</span>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-60" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-36 rounded-2xl mb-4" />
        <Skeleton className="h-48 rounded-2xl mb-4" />
        <Skeleton className="h-40 rounded-2xl mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CitationsPage() {
  const router = useRouter()
  const [data, setData] = useState<CitationAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllCategories, setShowAllCategories] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/citations', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as CitationAnalyticsResponse)
    } catch (err) {
      setError((err as Error).message || 'Failed to load citation analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingSkeleton />

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="h-14 w-14 rounded-full bg-against-500/10 border border-against-500/20 flex items-center justify-center mb-4">
            <Link2 className="h-6 w-6 text-against-400" />
          </div>
          <h2 className="font-mono text-lg font-semibold text-white mb-2">No citation data</h2>
          <p className="text-sm font-mono text-surface-500 max-w-sm mb-6">
            {error ?? 'Write some arguments with source links to see citation analytics.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white hover:border-surface-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
            <Link
              href="/analytics"
              className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors"
            >
              Back to Analytics
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const citePct = Math.round(data.citation_rate * 100)
  const platformPct = Math.round(data.platform_citation_rate * 100)
  const visibleCategories = showAllCategories ? data.by_category : data.by_category.slice(0, 5)

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-8">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300/60 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
              <Link2 className="h-5 w-5 text-for-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Citation Impact
              </h1>
              <p className="text-[12px] font-mono text-surface-500">
                How evidence citations affect your argument performance
              </p>
            </div>
          </div>
          <button
            onClick={load}
            aria-label="Refresh"
            className="flex-shrink-0 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300/60 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Overview stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Arguments"
            value={data.total_arguments.toLocaleString()}
            animateValue={data.total_arguments}
            icon={BookOpen}
            iconColor="text-surface-400"
            iconBg="bg-surface-300/30"
          />
          <StatCard
            label="With Citations"
            value={data.cited_count.toLocaleString()}
            animateValue={data.cited_count}
            sub={`${citePct}% of total`}
            icon={Link2}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            highlight={citePct > platformPct}
          />
          <StatCard
            label="Avg ↑ Cited"
            value={data.cited_avg_upvotes.toFixed(1)}
            sub="upvotes per cited arg"
            icon={ThumbsUp}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
          />
          <StatCard
            label="Upvote Lift"
            value={`${data.upvote_lift >= 0 ? '+' : ''}${data.upvote_lift.toFixed(0)}%`}
            sub="vs uncited args"
            icon={TrendingUp}
            iconColor={data.upvote_lift > 0 ? 'text-emerald' : 'text-against-400'}
            iconBg={data.upvote_lift > 0 ? 'bg-emerald/10' : 'bg-against-500/10'}
          />
        </div>

        {/* ── Citation rate vs platform ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-9 w-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Scale className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-white">You vs Platform</p>
              <p className="text-[11px] font-mono text-surface-500">Citation rate comparison</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-for-400 w-14 text-right">You</span>
              <div className="flex-1 h-3 bg-surface-300/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-for-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${citePct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
              <span className="text-sm font-mono font-bold text-white w-10 tabular-nums">
                {citePct}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-surface-500 w-14 text-right">Platform</span>
              <div className="flex-1 h-3 bg-surface-300/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-surface-500/60"
                  initial={{ width: 0 }}
                  animate={{ width: `${platformPct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
              <span className="text-sm font-mono font-bold text-surface-400 w-10 tabular-nums">
                {platformPct}%
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-mono text-surface-500">
            {citePct > platformPct
              ? `You cite evidence ${citePct - platformPct}pp more than average — great evidence discipline.`
              : citePct === platformPct
              ? 'You cite at the same rate as the platform average.'
              : `You cite ${platformPct - citePct}pp less than average — try adding sources to boost credibility.`}
          </p>
        </motion.div>

        {/* ── Cited vs uncited impact ───────────────────────────────────── */}
        {data.cited_count > 0 && data.total_arguments - data.cited_count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-sparkles/10 border border-purple/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple" />
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-white">Evidence Impact</p>
                <p className="text-[11px] font-mono text-surface-500">Cited vs uncited argument performance</p>
              </div>
            </div>
            <ImpactBar
              label="Average upvotes"
              citedVal={data.cited_avg_upvotes}
              uncitedVal={data.uncited_avg_upvotes}
              higher
            />
            {data.cited_avg_score !== null && data.uncited_avg_score !== null && (
              <ImpactBar
                label="Average AI quality score"
                citedVal={data.cited_avg_score}
                uncitedVal={data.uncited_avg_score}
                higher
              />
            )}
          </motion.div>
        )}

        {/* ── Monthly trend ─────────────────────────────────────────────── */}
        {data.monthly_trend.some((m) => m.cited + m.uncited > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <TrendChart trend={data.monthly_trend} />
          </motion.div>
        )}

        {/* ── By category ───────────────────────────────────────────────── */}
        {data.by_category.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                By Category
              </h2>
              <Link
                href="/categories"
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Browse topics
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {visibleCategories.map((cat, i) => (
                  <motion.div
                    key={cat.category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <CategoryRow cat={cat} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.by_category.length > 5 && (
                <button
                  onClick={() => setShowAllCategories((v) => !v)}
                  className="w-full py-2.5 rounded-xl border border-surface-300/60 text-[12px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  {showAllCategories
                    ? 'Show less'
                    : `Show all ${data.by_category.length} categories`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Top sources ───────────────────────────────────────────────── */}
        {data.top_sources.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                Your Go-To Sources
              </h2>
              <Link
                href="/sources"
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Source ratings
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {data.top_sources.map((source, i) => (
                <motion.div
                  key={source.domain}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                >
                  <SourceRow source={source} rank={i + 1} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Top cited arguments ───────────────────────────────────────── */}
        {data.top_cited_arguments.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                Your Best Cited Arguments
              </h2>
              <Link
                href="/arguments/mine"
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                All arguments
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {data.top_cited_arguments.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No cited arguments yet"
                description="Add a source URL to your next argument to start tracking citation impact."
              />
            ) : (
              <div className="space-y-3">
                {data.top_cited_arguments.map((arg, i) => (
                  <motion.div
                    key={arg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <CitedArgCard arg={arg} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state for new users ─────────────────────────────────── */}
        {data.total_arguments === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No arguments yet"
            description="Write your first argument on any debate to start tracking your citation impact."
            action={{ label: 'Browse debates', href: '/' }}
          />
        )}

        {/* ── Footer links ─────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-surface-300/30 flex flex-wrap gap-3">
          <Link
            href="/analytics/arguments"
            className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Argument Portfolio
          </Link>
          <Link
            href="/analytics/discourse"
            className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Discourse Quality
          </Link>
          <Link
            href="/analytics/depth"
            className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            Depth Score
          </Link>
          <Link
            href="/arguments/mine"
            className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            My Arguments
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Trophy className="h-3.5 w-3.5" />
            All Analytics
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
