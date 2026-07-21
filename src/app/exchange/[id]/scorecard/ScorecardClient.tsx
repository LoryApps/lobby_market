'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  ShieldCheck,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MarketAnalysis } from '@/app/api/exchange/[id]/analysis/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  price: number
  totalVotes: number
  blueVotes: number
  redVotes: number
  feedScore: number
  viewCount: number
}

type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

interface ScoreCategory {
  id: string
  label: string
  grade: Grade
  score: number
  detail: string
  icon: typeof BarChart2
  color: string
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

function toGrade(score: number): Grade {
  if (score >= 95) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 78) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 62) return 'C+'
  if (score >= 52) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function gradeColor(grade: Grade): string {
  switch (grade) {
    case 'A+': return 'text-emerald'
    case 'A':  return 'text-emerald'
    case 'B+': return 'text-for-400'
    case 'B':  return 'text-for-300'
    case 'C+': return 'text-gold'
    case 'C':  return 'text-gold'
    case 'D':  return 'text-against-300'
    case 'F':  return 'text-against-400'
  }
}

function gradeBg(grade: Grade): string {
  switch (grade) {
    case 'A+': return 'bg-emerald/10 border-emerald/30'
    case 'A':  return 'bg-emerald/10 border-emerald/30'
    case 'B+': return 'bg-for-500/10 border-for-500/30'
    case 'B':  return 'bg-for-500/10 border-for-500/30'
    case 'C+': return 'bg-gold/10 border-gold/30'
    case 'C':  return 'bg-gold/10 border-gold/30'
    case 'D':  return 'bg-against-500/10 border-against-500/30'
    case 'F':  return 'bg-against-500/15 border-against-500/40'
  }
}

// ─── Score calculations ───────────────────────────────────────────────────────

function calcConsensusScore(price: number, status: string): { score: number; detail: string } {
  if (status === 'law') return { score: 100, detail: 'Established as law — consensus confirmed' }
  if (status === 'failed') return { score: 20, detail: 'Failed — consensus against was decisive' }
  const dist = Math.abs(price - 50)
  const score = Math.min(100, Math.round((dist / 50) * 120))
  if (dist >= 35) return { score, detail: `Strong ${price > 50 ? 'FOR' : 'AGAINST'} consensus at ${price}¢` }
  if (dist >= 20) return { score, detail: `Moderate ${price > 50 ? 'FOR' : 'AGAINST'} lean at ${price}¢` }
  if (dist >= 8) return { score, detail: `Slight ${price > 50 ? 'FOR' : 'AGAINST'} tilt at ${price}¢` }
  return { score, detail: `Contested — nearly split at ${price}¢` }
}

function calcEngagementScore(
  totalVotes: number,
  viewCount: number,
  dailyAvg: number,
  daysActive: number,
): { score: number; detail: string } {
  let s = 0
  if (totalVotes >= 10000) s += 40
  else if (totalVotes >= 2000) s += 30
  else if (totalVotes >= 500) s += 20
  else if (totalVotes >= 100) s += 10
  else s += 5

  if (viewCount >= 5000) s += 20
  else if (viewCount >= 1000) s += 15
  else if (viewCount >= 200) s += 8

  if (dailyAvg >= 50) s += 25
  else if (dailyAvg >= 15) s += 18
  else if (dailyAvg >= 5) s += 10
  else if (dailyAvg >= 1) s += 5

  if (daysActive >= 30) s += 15
  else if (daysActive >= 14) s += 10
  else if (daysActive >= 7) s += 5

  const score = Math.min(100, s)
  if (score >= 85) return { score, detail: `${totalVotes.toLocaleString()} votes · very active market` }
  if (score >= 65) return { score, detail: `${totalVotes.toLocaleString()} votes · healthy engagement` }
  if (score >= 45) return { score, detail: `${totalVotes.toLocaleString()} votes · moderate activity` }
  return { score, detail: `${totalVotes.toLocaleString()} votes · early-stage market` }
}

function calcMomentumScore(
  trend: 'bullish' | 'bearish' | 'neutral',
  strength: number,
  momentum7d: number | null,
): { score: number; detail: string } {
  const base = trend === 'neutral' ? 50 : trend === 'bullish' ? 55 + strength * 0.35 : 45 - strength * 0.35
  const score = Math.min(100, Math.max(0, Math.round(base)))
  const m7 = momentum7d ?? 0
  if (Math.abs(m7) < 2) return { score, detail: 'Price stable — no strong directional move' }
  if (m7 > 0) return { score, detail: `+${m7.toFixed(1)}¢ in 7 days — building FOR momentum` }
  return { score, detail: `${m7.toFixed(1)}¢ in 7 days — building AGAINST momentum` }
}

function calcArgumentScore(
  forCount: number,
  againstCount: number,
  topForScore: number,
  topAgainstScore: number,
): { score: number; detail: string } {
  const total = forCount + againstCount
  let s = 0
  if (total >= 20) s += 35
  else if (total >= 10) s += 25
  else if (total >= 4) s += 15
  else if (total >= 1) s += 8

  const balance = total > 0 ? 1 - Math.abs(forCount - againstCount) / total : 0
  s += Math.round(balance * 25)

  const topScore = Math.max(topForScore, topAgainstScore)
  if (topScore >= 20) s += 30
  else if (topScore >= 8) s += 20
  else if (topScore >= 3) s += 10
  else if (topScore >= 1) s += 5

  const score = Math.min(100, s)
  if (total === 0) return { score, detail: 'No arguments yet — unanalyzed market' }
  if (score >= 80) return { score, detail: `${total} arguments with strong community engagement` }
  if (score >= 55) return { score, detail: `${total} arguments — decent debate depth` }
  return { score, detail: `${total} arguments — limited debate so far` }
}

function calcCertaintyScore(
  volatilityScore: number,
  snapshotCount: number,
  daysActive: number,
): { score: number; detail: string } {
  const stability = Math.max(0, 100 - volatilityScore)
  const maturity = Math.min(40, daysActive >= 30 ? 40 : Math.round((daysActive / 30) * 40))
  const dataRichness = Math.min(20, snapshotCount >= 100 ? 20 : Math.round((snapshotCount / 100) * 20))
  const score = Math.min(100, Math.round(stability * 0.4 + maturity + dataRichness))

  if (volatilityScore > 60) return { score, detail: 'High volatility — price moving significantly' }
  if (volatilityScore > 35) return { score, detail: 'Moderate volatility — some price swings' }
  if (daysActive < 3) return { score, detail: 'New market — too early to assess stability' }
  return { score, detail: `Stable over ${daysActive} days — consistent consensus` }
}

function overallGrade(scores: number[]): { grade: Grade; avg: number } {
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  return { grade: toGrade(avg), avg }
}

// ─── Verdict text ─────────────────────────────────────────────────────────────

function getVerdict(
  grade: Grade,
  price: number,
  trend: 'bullish' | 'bearish' | 'neutral',
  status: string,
): string {
  if (status === 'law') return 'This market has resolved — consensus became law.'
  if (status === 'failed') return 'This market closed without reaching consensus.'
  if (status === 'voting') return 'Final vote is underway — the consensus is being locked in now.'

  if (grade === 'A+' || grade === 'A') {
    if (price >= 65) return `Strong FOR consensus with excellent signal quality. This market shows high conviction.`
    if (price <= 35) return `Strong AGAINST consensus with excellent signal quality. Resistance is well-established.`
    return `Market quality is high but consensus is contested. Watch momentum.`
  }
  if (grade === 'B+' || grade === 'B') {
    if (trend === 'bullish') return `Solid market building FOR momentum. Quality engagement supports the trend.`
    if (trend === 'bearish') return `Solid market building AGAINST momentum. Quality engagement supports the trend.`
    return `A well-formed market waiting for a catalyst to break the deadlock.`
  }
  if (grade === 'C+' || grade === 'C') {
    return `Developing market. Engagement is growing but consensus needs more time to crystallize.`
  }
  return `Early-stage or low-engagement market. More community input needed for reliable signals.`
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-400 border-surface-600',
  active: 'text-for-400 border-for-500/40',
  voting: 'text-purple border-purple/40',
  law: 'text-gold border-gold/40',
  failed: 'text-against-400 border-against-500/40',
}

// ─── Grade Ring ───────────────────────────────────────────────────────────────

function GradeRing({ grade, avg }: { grade: Grade; avg: number }) {
  const circumference = 2 * Math.PI * 44
  const progress = (avg / 100) * circumference

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg width="128" height="128" className="-rotate-90">
        <circle
          cx="64"
          cy="64"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-surface-300/40"
        />
        <circle
          cx="64"
          cy="64"
          r="44"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          className={cn(
            'transition-all duration-1000',
            grade === 'A+' || grade === 'A' ? 'stroke-emerald' :
            grade === 'B+' || grade === 'B' ? 'stroke-for-400' :
            grade === 'C+' || grade === 'C' ? 'stroke-gold' :
            'stroke-against-400'
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-black tracking-tight', gradeColor(grade))}>{grade}</span>
        <span className="text-xs font-mono text-surface-500 mt-0.5">{avg}/100</span>
      </div>
    </div>
  )
}

// ─── Score Card Row ───────────────────────────────────────────────────────────

function ScoreRow({ item, delay }: { item: ScoreCategory; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border',
        gradeBg(item.grade),
      )}
    >
      <div className={cn('p-2 rounded-lg bg-surface-200/60')}>
        <item.icon className={cn('w-4 h-4', item.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-white uppercase tracking-wide">{item.label}</p>
          <span className={cn('text-base font-black font-mono', gradeColor(item.grade))}>{item.grade}</span>
        </div>
        <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{item.detail}</p>
        <div className="mt-2 h-1 bg-surface-300/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${item.score}%` }}
            transition={{ delay: delay + 0.1, duration: 0.6, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              item.grade === 'A+' || item.grade === 'A' ? 'bg-emerald' :
              item.grade === 'B+' || item.grade === 'B' ? 'bg-for-400' :
              item.grade === 'C+' || item.grade === 'C' ? 'bg-gold' :
              'bg-against-400'
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Metric Chip ─────────────────────────────────────────────────────────────

function MetricChip({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300/40">
      <p className="text-[10px] uppercase tracking-widest text-surface-500 font-semibold">{label}</p>
      <p className={cn('text-lg font-black font-mono', color ?? 'text-white')}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScorecardClient({
  topicId,
  statement,
  category,
  status,
  price,
  totalVotes,
  blueVotes,
  redVotes,
  feedScore,
  viewCount,
}: Props) {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exchange/${topicId}/analysis`)
      if (res.ok) {
        const data: MarketAnalysis = await res.json()
        setAnalysis(data)
      }
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // ── Compute scores ─────────────────────────────────────────────────────────

  const consensusCalc = calcConsensusScore(price, status)
  const engagementCalc = calcEngagementScore(
    totalVotes,
    viewCount,
    analysis?.daily_avg_votes ?? 0,
    analysis?.days_active ?? 1,
  )
  const momentumCalc = calcMomentumScore(
    analysis?.trend_direction ?? 'neutral',
    analysis?.trend_strength ?? 0,
    analysis?.momentum_7d ?? null,
  )
  const argumentCalc = calcArgumentScore(
    analysis?.for_argument_count ?? 0,
    analysis?.against_argument_count ?? 0,
    analysis?.top_for_score ?? 0,
    analysis?.top_against_score ?? 0,
  )
  const certaintyCalc = calcCertaintyScore(
    analysis?.volatility_score ?? 0,
    analysis?.snapshot_count ?? 0,
    analysis?.days_active ?? 1,
  )

  const categories: ScoreCategory[] = [
    {
      id: 'consensus',
      label: 'Consensus Strength',
      grade: toGrade(consensusCalc.score),
      score: consensusCalc.score,
      detail: consensusCalc.detail,
      icon: Scale,
      color: price >= 55 ? 'text-for-400' : price <= 45 ? 'text-against-400' : 'text-surface-400',
    },
    {
      id: 'engagement',
      label: 'Engagement',
      grade: toGrade(engagementCalc.score),
      score: engagementCalc.score,
      detail: engagementCalc.detail,
      icon: Users,
      color: 'text-for-300',
    },
    {
      id: 'momentum',
      label: 'Momentum',
      grade: toGrade(momentumCalc.score),
      score: momentumCalc.score,
      detail: momentumCalc.detail,
      icon: analysis?.trend_direction === 'bullish' ? TrendingUp : analysis?.trend_direction === 'bearish' ? TrendingDown : BarChart2,
      color: analysis?.trend_direction === 'bullish' ? 'text-for-400' : analysis?.trend_direction === 'bearish' ? 'text-against-400' : 'text-surface-400',
    },
    {
      id: 'arguments',
      label: 'Argument Quality',
      grade: toGrade(argumentCalc.score),
      score: argumentCalc.score,
      detail: argumentCalc.detail,
      icon: MessageSquare,
      color: 'text-purple',
    },
    {
      id: 'certainty',
      label: 'Price Certainty',
      grade: toGrade(certaintyCalc.score),
      score: certaintyCalc.score,
      detail: certaintyCalc.detail,
      icon: Target,
      color: 'text-gold',
    },
  ]

  const { grade: overall, avg } = overallGrade(categories.map((c) => c.score))
  const verdict = getVerdict(overall, price, analysis?.trend_direction ?? 'neutral', status)

  const forPct = totalVotes > 0 ? Math.round((blueVotes / totalVotes) * 100) : price
  const againstPct = 100 - forPct

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 pt-16">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-start gap-3">
            <Link
              href={`/exchange/${topicId}`}
              className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 transition-colors mt-0.5 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-surface-400" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={cn(
                  'text-[11px] font-mono font-semibold px-2 py-0.5 rounded border uppercase tracking-wider',
                  STATUS_COLOR[status] ?? 'text-surface-400 border-surface-600',
                )}>
                  {STATUS_LABEL[status] ?? status}
                </span>
                {category && (
                  <span className="text-[11px] text-surface-500">{category}</span>
                )}
              </div>
              <h1 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                {statement}
              </h1>
            </div>
          </div>

          {/* Overall Grade Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              'relative rounded-2xl border p-6 overflow-hidden',
              'bg-surface-100/80',
              gradeBg(overall),
            )}
          >
            <div className="flex items-center gap-6">
              <GradeRing grade={overall} avg={avg} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Award className={cn('w-4 h-4', gradeColor(overall))} />
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-surface-400">Overall Grade</p>
                </div>
                <p className="text-sm text-surface-300 leading-relaxed">{verdict}</p>
              </div>
            </div>
          </motion.div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <MetricChip
              label="Price"
              value={`${price}¢`}
              sub={price > 50 ? `${forPct}% FOR` : price < 50 ? `${againstPct}% AGAINST` : 'Split'}
              color={price >= 65 ? 'text-for-400' : price <= 35 ? 'text-against-400' : 'text-surface-300'}
            />
            <MetricChip
              label="Votes"
              value={fmtNum(totalVotes)}
              sub={`${fmtNum(viewCount)} views`}
            />
            <MetricChip
              label="Trend"
              value={
                analysis?.momentum_7d == null ? '—' :
                analysis.momentum_7d > 0 ? `+${analysis.momentum_7d.toFixed(1)}¢` :
                `${analysis.momentum_7d.toFixed(1)}¢`
              }
              sub="7-day change"
              color={
                (analysis?.momentum_7d ?? 0) > 2 ? 'text-for-400' :
                (analysis?.momentum_7d ?? 0) < -2 ? 'text-against-400' :
                'text-surface-300'
              }
            />
          </div>

          {/* Vote Bar */}
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-4 space-y-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-for-400">
                <ThumbsUp className="w-3.5 h-3.5" />
                FOR {forPct}%
              </span>
              <span className="flex items-center gap-1.5 text-against-400">
                AGAINST {againstPct}%
                <ThumbsDown className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${forPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                className="h-full bg-for-500 rounded-l-full"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${againstPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                className="h-full bg-against-500 rounded-r-full"
              />
            </div>
            <div className="flex justify-between text-[11px] text-surface-500">
              <span>{fmtNum(blueVotes)} votes</span>
              <span>{fmtNum(redVotes)} votes</span>
            </div>
          </div>

          {/* Category Scores */}
          <div>
            <p className="text-[11px] uppercase tracking-widest font-semibold text-surface-500 mb-3">
              Category Breakdown
            </p>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((cat, i) => (
                  <ScoreRow key={cat.id} item={cat} delay={i * 0.08} />
                ))}
              </div>
            )}
          </div>

          {/* Market Signals */}
          {!loading && analysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-4 space-y-2"
            >
              <p className="text-[11px] uppercase tracking-widest font-semibold text-surface-500 mb-3">
                Signal Flags
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: 'Near Law',
                    active: status === 'voting' || price >= 75,
                    icon: Gavel,
                    activeColor: 'text-gold',
                    activeBg: 'bg-gold/10 border-gold/30',
                  },
                  {
                    label: 'Hot Market',
                    active: feedScore > 50 || analysis.daily_avg_votes > 20,
                    icon: Flame,
                    activeColor: 'text-against-300',
                    activeBg: 'bg-against-300/10 border-against-300/30',
                  },
                  {
                    label: 'Overbought',
                    active: analysis.is_overbought,
                    icon: TrendingUp,
                    activeColor: 'text-for-300',
                    activeBg: 'bg-for-300/10 border-for-300/30',
                  },
                  {
                    label: 'Oversold',
                    active: analysis.is_oversold,
                    icon: TrendingDown,
                    activeColor: 'text-against-400',
                    activeBg: 'bg-against-400/10 border-against-400/30',
                  },
                  {
                    label: 'Verified',
                    active: analysis.for_argument_count + analysis.against_argument_count >= 5,
                    icon: ShieldCheck,
                    activeColor: 'text-emerald',
                    activeBg: 'bg-emerald/10 border-emerald/30',
                  },
                  {
                    label: 'Bullish Trend',
                    active: analysis.trend_direction === 'bullish' && analysis.trend_strength > 30,
                    icon: Zap,
                    activeColor: 'text-for-400',
                    activeBg: 'bg-for-400/10 border-for-400/30',
                  },
                ].map(({ label, active, icon: Icon, activeColor, activeBg }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-colors',
                      active
                        ? cn(activeBg, activeColor)
                        : 'bg-surface-300/20 border-surface-400/20 text-surface-600',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-400/40 bg-surface-200/60 text-sm font-semibold text-surface-300 hover:border-surface-400/70 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Link copied!' : 'Share Scorecard'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/exchange/${topicId}/analysis`}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-400/30 bg-surface-200/40 text-xs font-semibold text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Full Analysis
                <ChevronRight className="w-3 h-3" />
              </Link>
              <Link
                href={`/exchange/${topicId}`}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-for-500/30 bg-for-500/10 text-xs font-semibold text-for-400 hover:border-for-500/50 transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Trade This
              </Link>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-surface-600 hover:text-surface-400 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh scorecard'}
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
