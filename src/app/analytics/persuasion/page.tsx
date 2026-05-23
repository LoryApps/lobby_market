'use client'

/**
 * /analytics/persuasion — Argument Persuasion Effectiveness
 *
 * Measures how well your arguments land relative to debate size.
 * Instead of raw upvote counts (which favour large debates), every
 * argument earns a normalised "persuasion score" — upvotes divided by
 * the square root of total votes on that topic, scaled to 0–100.
 *
 * Shows: persuasion tier, FOR vs AGAINST effectiveness, top performing
 * arguments, best categories, monthly trend, and actionable tips.
 *
 * Distinct from:
 *   /analytics/impact      — raw upvotes + reach (not size-normalised)
 *   /analytics/resonance   — cross-partisan upvotes only
 *   /analytics/rhetoric    — writing style (not effectiveness)
 *   /analytics/influence   — reputation and clout earned
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
  Flame,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  PersuasionResponse,
  PersuasionArgument,
  CategoryPersuasion,
  MonthlyPersuasion,
  PersuasionTip,
} from '@/app/api/analytics/persuasion/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(iso: string): string {
  const [year, month] = iso.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(month, 10) - 1]} ${year}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Score bar color ──────────────────────────────────────────────────────────

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-gold'
  if (score >= 50) return 'bg-emerald'
  if (score >= 30) return 'bg-for-500'
  if (score >= 15) return 'bg-gold/70'
  return 'bg-surface-400'
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'text-gold bg-gold/10 border-gold/30'
  if (score >= 50) return 'text-emerald bg-emerald/10 border-emerald/30'
  if (score >= 30) return 'text-for-300 bg-for-500/10 border-for-500/30'
  if (score >= 15) return 'text-gold bg-gold/10 border-gold/30'
  return 'text-surface-400 bg-surface-300/10 border-surface-400/30'
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

function catColor(c: string): string {
  return CATEGORY_COLORS[c] ?? 'text-surface-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
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

function TierCard({ data }: { data: PersuasionResponse }) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
          <Trophy className="h-6 w-6 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('font-mono text-lg font-bold', data.persuasion_tier_color)}>
              {data.persuasion_tier}
            </span>
            <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full border', scoreBadgeClass(data.avg_persuasion_score))}>
              Score: {data.avg_persuasion_score}
            </span>
          </div>
          <p className="text-sm font-mono text-surface-500 leading-relaxed">
            {data.persuasion_tier_description}
          </p>
        </div>
      </div>

      {/* Score gauge */}
      <div className="mt-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] font-mono text-surface-600">Emerging</span>
          <span className="text-[10px] font-mono text-surface-600">Elite</span>
        </div>
        <div className="h-3 rounded-full bg-surface-300/30 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', scoreBarColor(data.avg_persuasion_score))}
            initial={{ width: 0 }}
            animate={{ width: `${data.avg_persuasion_score}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {[0, 25, 50, 75, 100].map((v) => (
            <span key={v} className="text-[9px] font-mono text-surface-700">{v}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SideComparison({ data }: { data: PersuasionResponse }) {
  const { for_stats, against_stats, stronger_side } = data
  const maxScore = Math.max(for_stats.avg_score, against_stats.avg_score, 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center">
          <Scale className="h-5 w-5 text-purple" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">FOR vs AGAINST Effectiveness</p>
          <p className="text-[11px] font-mono text-surface-500">Which side do you argue more persuasively?</p>
        </div>
        {stronger_side !== 'balanced' && (
          <span className={cn(
            'ml-auto text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            stronger_side === 'for'
              ? 'text-for-300 bg-for-500/10 border-for-500/30'
              : 'text-against-300 bg-against-500/10 border-against-500/30'
          )}>
            {stronger_side === 'for' ? 'FOR' : 'AGAINST'} stronger
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* FOR */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-for-400" />
            <span className="text-sm font-mono font-semibold text-for-400">FOR</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-surface-500 mb-1">
                <span>Avg score</span>
                <span className="text-white font-semibold">{for_stats.avg_score}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-for-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(for_stats.avg_score / maxScore) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 rounded-lg bg-surface-200/50">
                <p className="font-mono text-sm font-bold text-white">{for_stats.count}</p>
                <p className="text-[10px] font-mono text-surface-600">Arguments</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-200/50">
                <p className="font-mono text-sm font-bold text-white">{for_stats.avg_upvotes}</p>
                <p className="text-[10px] font-mono text-surface-600">Avg upvotes</p>
              </div>
            </div>
          </div>
        </div>

        {/* AGAINST */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ThumbsDown className="h-4 w-4 text-against-400" />
            <span className="text-sm font-mono font-semibold text-against-400">AGAINST</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-surface-500 mb-1">
                <span>Avg score</span>
                <span className="text-white font-semibold">{against_stats.avg_score}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-against-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(against_stats.avg_score / maxScore) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 rounded-lg bg-surface-200/50">
                <p className="font-mono text-sm font-bold text-white">{against_stats.count}</p>
                <p className="text-[10px] font-mono text-surface-600">Arguments</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-200/50">
                <p className="font-mono text-sm font-bold text-white">{against_stats.avg_upvotes}</p>
                <p className="text-[10px] font-mono text-surface-600">Avg upvotes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TopArgumentCard({ arg, rank }: { arg: PersuasionArgument; rank: number }) {
  const rankColors = ['text-gold', 'text-surface-300', 'text-against-400']
  return (
    <Link
      href={`/topic/${arg.topic_id}`}
      className="block rounded-xl bg-surface-100 border border-surface-300/40 p-4 hover:border-surface-400/60 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-xs font-mono font-bold',
          rank < 3
            ? `${rankColors[rank]} border-current bg-current/10`
            : 'text-surface-600 border-surface-500/30 bg-surface-300/20'
        )}>
          {rank + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border',
              arg.side === 'blue'
                ? 'text-for-300 bg-for-500/10 border-for-500/30'
                : 'text-against-300 bg-against-500/10 border-against-500/30'
            )}>
              {arg.side === 'blue'
                ? <><ThumbsUp className="h-2.5 w-2.5" /> FOR</>
                : <><ThumbsDown className="h-2.5 w-2.5" /> AGAINST</>}
            </span>
            {arg.category && (
              <span className={cn('text-[10px] font-mono font-semibold', catColor(arg.category))}>
                {arg.category}
              </span>
            )}
            <span className="ml-auto text-[10px] font-mono text-surface-600">
              {relativeTime(arg.created_at)}
            </span>
          </div>
          <p className="text-xs font-mono text-surface-400 line-clamp-1 mb-1.5 group-hover:text-surface-300 transition-colors">
            {arg.topic_statement}
          </p>
          <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
            &ldquo;{arg.content}&rdquo;
          </p>
          <div className="flex items-center gap-4 mt-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
              <ThumbsUp className="h-3 w-3" />
              <span className="text-white font-semibold">{arg.upvotes}</span>
              <span>upvotes</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
              <Zap className="h-3 w-3" />
              <span className="text-white font-semibold">{arg.persuasion_score}</span>
              <span>score</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  )
}

function CategoryRow({ cat, maxScore }: { cat: CategoryPersuasion; maxScore: number }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-sm font-semibold', catColor(cat.category))}>
            {cat.category}
          </span>
          <span className="text-[11px] font-mono text-surface-600">
            {cat.argument_count} arg{cat.argument_count !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="font-mono text-sm font-bold text-white tabular-nums">{cat.avg_score}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden mb-2">
        <motion.div
          className={cn('h-full rounded-full', scoreBarColor(cat.avg_score))}
          initial={{ width: 0 }}
          animate={{ width: `${(cat.avg_score / maxScore) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="text-[10px] font-mono text-surface-600">
          <span className="text-surface-400">{cat.total_upvotes}</span> total upvotes
        </div>
        <div className="text-[10px] font-mono text-surface-600">
          <span className="text-surface-400">{cat.avg_upvotes}</span> avg/arg
        </div>
      </div>
    </div>
  )
}

const SW = 300
const SH = 80
const P = 8

function MonthlyChart({ trend }: { trend: MonthlyPersuasion[] }) {
  const months = trend.filter((m) => m.count > 0)
  if (months.length < 2) return null

  const scores = months.map((m) => m.avg_score)
  const maxS = Math.max(...scores)
  const minS = Math.min(...scores.filter((s) => s > 0))
  const maxVol = Math.max(...months.map((m) => m.count))

  const xFor = (i: number) => P + (i / (months.length - 1)) * (SW - P * 2)
  const yFor = (s: number) =>
    SH - P - ((s - minS) / (maxS - minS || 1)) * (SH - P * 2)

  const path = months
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(m.avg_score)}`)
    .join(' ')

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-for-400" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Monthly Persuasion Trend</p>
          <p className="text-[11px] font-mono text-surface-500">Avg persuasion score over time</p>
        </div>
      </div>

      <svg
        width={SW}
        height={SH}
        viewBox={`0 0 ${SW} ${SH}`}
        className="w-full"
        role="img"
        aria-label="Monthly persuasion trend"
      >
        {months.map((m, i) => {
          const x = xFor(i)
          const h = (m.count / maxVol) * (SH - P * 2)
          return (
            <rect
              key={`${m.month}-bar`}
              x={x - 10}
              y={SH - P - h}
              width={20}
              height={h}
              rx={3}
              fill="rgba(59,130,246,0.10)"
            />
          )
        })}
        <path
          d={path}
          fill="none"
          stroke="#c9a84c"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {months.map((m, i) => (
          <circle
            key={`${m.month}-dot`}
            cx={xFor(i)}
            cy={yFor(m.avg_score)}
            r={3}
            fill="#c9a84c"
          />
        ))}
      </svg>

      <div className="flex justify-between mt-1">
        {months.map((m) => (
          <span key={m.month} className="text-[10px] font-mono text-surface-600">
            {fmtMonth(m.month)}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-for-500/30" />
          <span className="text-[11px] font-mono text-surface-500">Volume</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 bg-gold rounded-full" />
          <span className="text-[11px] font-mono text-surface-500">Avg score</span>
        </div>
      </div>
    </div>
  )
}

function TipCard({ tip }: { tip: PersuasionTip }) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-start gap-3',
      tip.priority === 'high'
        ? 'bg-for-500/5 border-for-500/20'
        : 'bg-surface-100 border-surface-300/40'
    )}>
      <div className={cn(
        'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center mt-0.5',
        tip.priority === 'high' ? 'bg-for-500/15' : 'bg-surface-200'
      )}>
        <Lightbulb className={cn('h-3.5 w-3.5', tip.priority === 'high' ? 'text-for-400' : 'text-gold')} />
      </div>
      <div>
        <p className="text-sm font-mono font-semibold text-white mb-1">{tip.title}</p>
        <p className="text-xs font-mono text-surface-500 leading-relaxed">{tip.body}</p>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-36 rounded-2xl mb-4" />
        <Skeleton className="h-52 rounded-2xl mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PersuasionPage() {
  const router = useRouter()
  const [data, setData] = useState<PersuasionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllCats, setShowAllCats] = useState(false)
  const [showAllArgs, setShowAllArgs] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/persuasion', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as PersuasionResponse)
    } catch (err) {
      setError((err as Error).message || 'Failed to load persuasion data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="h-14 w-14 rounded-full bg-against-500/10 border border-against-500/20 flex items-center justify-center mb-4">
            <Zap className="h-6 w-6 text-against-400" />
          </div>
          <h2 className="font-mono text-lg font-semibold text-white mb-2">Persuasion data unavailable</h2>
          <p className="text-sm font-mono text-surface-500 max-w-sm mb-6">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white hover:border-surface-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />Retry
            </button>
            <Link href="/analytics" className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors">
              Back to Analytics
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) return null

  if (data.total_arguments === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-8 pb-24">
          <div className="flex items-start gap-3 mb-8">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300/60 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-for-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-mono text-xl font-bold text-white leading-tight">Persuasion Power</h1>
                <p className="text-[12px] font-mono text-surface-500">Argument effectiveness · size-normalised</p>
              </div>
            </div>
          </div>
          <EmptyState
            icon={MessageSquare}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="No arguments yet"
            description="Post arguments on topics to start tracking your persuasion effectiveness."
            actions={[{ label: 'Browse topics', href: '/', icon: ArrowRight }]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const visibleCats = showAllCats ? data.by_category : data.by_category.slice(0, 5)
  const visibleArgs = showAllArgs ? data.top_arguments : data.top_arguments.slice(0, 5)
  const maxCatScore = data.by_category.length > 0 ? Math.max(...data.by_category.map((c) => c.avg_score), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-8">

        {/* Header */}
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
              <Sparkles className="h-5 w-5 text-for-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-xl font-bold text-white leading-tight">Persuasion Power</h1>
              <p className="text-[12px] font-mono text-surface-500">Argument effectiveness · size-normalised · all time</p>
            </div>
          </div>
          <button
            onClick={load}
            aria-label="Refresh data"
            className="flex-shrink-0 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300/60 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Arguments"
            value={data.total_arguments.toLocaleString()}
            animateValue={data.total_arguments}
            icon={MessageSquare}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
          />
          <StatCard
            label="Total Upvotes"
            value={data.total_upvotes.toLocaleString()}
            animateValue={data.total_upvotes}
            icon={ThumbsUp}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
          />
          <StatCard
            label="Avg / Argument"
            value={data.avg_upvotes_per_argument}
            sub="upvotes"
            icon={BarChart2}
            iconColor="text-purple"
            iconBg="bg-purple/10"
          />
          <StatCard
            label="Avg Score"
            value={data.avg_persuasion_score}
            sub="out of 100"
            icon={Zap}
            iconColor="text-gold"
            iconBg="bg-gold/10"
          />
        </div>

        {/* Persuasion tier */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <TierCard data={data} />
        </motion.div>

        {/* FOR vs AGAINST comparison */}
        {(data.for_stats.count > 0 || data.against_stats.count > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <SideComparison data={data} />
          </motion.div>
        )}

        {/* Top arguments */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              Top Performing Arguments
            </h2>
            <Link
              href="/analytics/arguments"
              className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              All arguments <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {visibleArgs.map((arg, i) => (
                <motion.div
                  key={arg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <TopArgumentCard arg={arg} rank={i} />
                </motion.div>
              ))}
            </AnimatePresence>
            {data.top_arguments.length > 5 && (
              <button
                onClick={() => setShowAllArgs((v) => !v)}
                className="w-full py-2.5 rounded-xl border border-surface-300/60 text-[12px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                {showAllArgs ? 'Show less' : `Show all ${data.top_arguments.length} top arguments`}
              </button>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        {data.by_category.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-purple" />
                By Category
              </h2>
              <Link
                href="/categories"
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Browse <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {visibleCats.map((cat, i) => (
                  <motion.div
                    key={cat.category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <CategoryRow cat={cat} maxScore={maxCatScore} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.by_category.length > 5 && (
                <button
                  onClick={() => setShowAllCats((v) => !v)}
                  className="w-full py-2.5 rounded-xl border border-surface-300/60 text-[12px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  {showAllCats ? 'Show less' : `Show all ${data.by_category.length} categories`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Monthly trend */}
        {data.monthly_trend.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <MonthlyChart trend={data.monthly_trend} />
          </motion.div>
        )}

        {/* Tips */}
        {data.tips.length > 0 && (
          <div className="mb-6">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
              <Lightbulb className="h-3.5 w-3.5 text-gold" />
              How to Improve
            </h2>
            <div className="space-y-2">
              {data.tips.map((tip) => (
                <TipCard key={tip.id} tip={tip} />
              ))}
            </div>
          </div>
        )}

        {/* Footer links */}
        <div className="mt-8 pt-6 border-t border-surface-300/30 flex flex-wrap gap-3">
          <Link href="/analytics/impact" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <Zap className="h-3.5 w-3.5" />Argument Impact
          </Link>
          <Link href="/analytics/resonance" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <Flame className="h-3.5 w-3.5" />Resonance
          </Link>
          <Link href="/analytics/rhetoric" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <MessageSquare className="h-3.5 w-3.5" />Rhetoric Style
          </Link>
          <Link href="/analytics" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <BarChart2 className="h-3.5 w-3.5" />All Analytics
          </Link>
          <Link href="/arguments" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <ArrowRight className="h-3.5 w-3.5" />Browse Arguments
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
