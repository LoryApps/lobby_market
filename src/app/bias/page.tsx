'use client'

/**
 * /bias — Civic Bias Checker
 *
 * A personal analytics page that surfaces cognitive bias patterns in your
 * civic voting and engagement behaviour. Four bias dimensions are measured
 * from existing votes and argument upvote data:
 *
 *   • Confirmation Bias — upvoting arguments that agree with your stance
 *   • Social Proof Bias — voting with the crowd / always contrarian
 *   • Negativity Bias   — reflexively voting AGAINST (or always FOR)
 *   • Category Tunnel   — only engaging with a narrow set of topics
 *
 * Distinct from:
 *   /analytics/diversity  — breadth/entropy of category engagement
 *   /analytics/contrarian — when you vote against majority specifically
 *   /analytics/consistency— whether your positions stay stable over time
 *
 * This is the only page synthesising multiple bias dimensions into a
 * single personal report with actionable tips for each pattern.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Lightbulb,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BiasReport, BiasMetric } from '@/app/api/analytics/bias/route'

// ─── Bias icon map ────────────────────────────────────────────────────────────

const BIAS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  confirmation:  Brain,
  social_proof:  Users,
  negativity:    ThumbsDown,
  tunnel_vision: BarChart2,
}

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<BiasMetric['level'], {
  label: string
  indicatorColor: string
  badge: string
}> = {
  low:      { label: 'Low',      indicatorColor: 'bg-emerald',      badge: 'text-emerald bg-emerald/10 border-emerald/30' },
  moderate: { label: 'Moderate', indicatorColor: 'bg-gold',         badge: 'text-gold bg-gold/10 border-gold/30' },
  notable:  { label: 'Notable',  indicatorColor: 'bg-against-400',  badge: 'text-against-400 bg-against-400/10 border-against-400/30' },
  strong:   { label: 'Strong',   indicatorColor: 'bg-against-500',  badge: 'text-against-300 bg-against-600/15 border-against-500/30' },
}

const OVERALL_LEVEL_CONFIG: Record<BiasReport['overallLevel'], {
  color: string
  bg: string
  border: string
  icon: typeof Shield
}> = {
  'Balanced':   { color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: CheckCircle2 },
  'Mild Lean':  { color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Zap },
  'Noticeable': { color: 'text-against-400', bg: 'bg-against-400/10', border: 'border-against-400/30', icon: AlertTriangle },
  'Strong':     { color: 'text-against-300', bg: 'bg-against-600/15', border: 'border-against-500/30', icon: AlertTriangle },
}

// ─── Score arc (SVG gauge) ────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const radius = 36
  const cx = 48
  const cy = 52
  const startAngle = -160
  const endAngle   = -20
  const totalDeg   = endAngle - startAngle
  const filledDeg  = (score / 100) * totalDeg
  const currentAngle = startAngle + filledDeg

  function polar(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  function arcPath(startDeg: number, endDeg: number, r: number) {
    const s = polar(cx, cy, r, startDeg)
    const e = polar(cx, cy, r, endDeg)
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  const trackColor = '#1e2230'
  const fillColor  = score >= 65 ? '#ef4444' : score >= 35 ? '#c9a84c' : '#10b981'

  return (
    <svg viewBox="0 0 96 60" className="w-full" aria-hidden="true">
      {/* Track */}
      <path
        d={arcPath(startAngle, endAngle, radius)}
        fill="none"
        stroke={trackColor}
        strokeWidth={6}
        strokeLinecap="round"
      />
      {/* Fill */}
      {score > 0 && (
        <path
          d={arcPath(startAngle, currentAngle, radius)}
          fill="none"
          stroke={fillColor}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      {/* Score label */}
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fontFamily="monospace"
        fill="white"
      >
        {score}
      </text>
    </svg>
  )
}

// ─── Bias card ────────────────────────────────────────────────────────────────

function BiasCard({ metric }: { metric: BiasMetric }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = BIAS_ICONS[metric.id] ?? Brain
  const lc = LEVEL_CONFIG[metric.level]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        'bg-surface-100',
        metric.border,
      )}
    >
      {/* Header row */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Icon + gauge */}
          <div className="flex-shrink-0 w-20">
            <div className={cn(
              'h-8 w-8 rounded-xl flex items-center justify-center mb-1 mx-auto',
              metric.bg,
            )}>
              <Icon className={cn('h-4 w-4', metric.color)} aria-hidden="true" />
            </div>
            <ScoreArc score={metric.score} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-mono font-semibold text-white">
                {metric.label}
              </h3>
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
                lc.badge,
              )}>
                {lc.label}
              </span>
            </div>
            <p className="text-sm text-white leading-snug">{metric.headline}</p>
            <p className="text-xs text-surface-500 mt-1 font-mono">{metric.evidence}</p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          aria-expanded={expanded}
        >
          <Info className="h-3 w-3" aria-hidden="true" />
          {expanded ? 'Less' : 'What does this mean?'}
          {expanded
            ? <ChevronUp className="h-3 w-3" aria-hidden="true" />
            : <ChevronDown className="h-3 w-3" aria-hidden="true" />
          }
        </button>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('px-5 pb-5 pt-0 space-y-3 border-t', metric.border)}>
              {/* Explanation */}
              <p className="text-xs text-surface-400 leading-relaxed">
                {metric.detail}
              </p>

              {/* Tip */}
              <div className={cn(
                'flex items-start gap-2.5 p-3 rounded-xl border',
                metric.bg,
                metric.border,
              )}>
                <Lightbulb className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', metric.color)} aria-hidden="true" />
                <p className={cn('text-xs leading-relaxed', metric.color)}>
                  {metric.tip}
                </p>
              </div>

              {/* Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
                  <span>Low</span>
                  <span>Strong</span>
                </div>
                <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.score}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={cn(
                      'h-full rounded-full',
                      metric.score >= 65
                        ? 'bg-gradient-to-r from-against-700 to-against-400'
                        : metric.score >= 35
                          ? 'bg-gradient-to-r from-gold/60 to-gold'
                          : 'bg-gradient-to-r from-emerald/60 to-emerald',
                    )}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BiasPageSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-32 w-full rounded-2xl mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl mb-3" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BiasPage() {
  const [report, setReport] = useState<BiasReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/bias', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          setError(true)
          return
        }
        throw new Error('Failed to fetch bias report')
      }
      setReport(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport()
  }, [fetchReport, refreshKey])

  if (loading) return <BiasPageSkeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-12 pb-24 text-center">
          <EmptyState
            icon={Brain}
            title="Couldn't load Bias Report"
            description="Log in to see your personalised civic bias analysis."
          />
          <div className="flex justify-center mt-6 gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              Log in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!report) return null

  const overallCfg = OVERALL_LEVEL_CONFIG[report.overallLevel]
  const OverallIcon = overallCfg.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-mono font-bold text-white leading-none">
              Civic Bias Check
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Cognitive patterns in your voting &amp; engagement
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Refresh bias report"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Insufficient data state ─────────────────────────────────────────── */}
        {report.insufficientData ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <Brain className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <h2 className="text-lg font-mono font-bold text-white mb-2">
              Not enough data yet
            </h2>
            <p className="text-sm text-surface-500 mb-5 max-w-xs mx-auto">
              Vote on at least 5 topics to generate your personal Civic Bias Report.
              The more you engage, the more accurate it becomes.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Start voting
            </Link>
          </div>
        ) : (
          <>
            {/* ── Overall score card ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'rounded-2xl border p-5 mb-6',
                overallCfg.bg,
                overallCfg.border,
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center',
                  report.overallLevel === 'Balanced' ? 'bg-emerald/20' : 'bg-surface-200',
                )}>
                  <OverallIcon className={cn('h-6 w-6', overallCfg.color)} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-mono font-bold uppercase tracking-widest', overallCfg.color)}>
                      Overall
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-mono font-bold border',
                      overallCfg.color, overallCfg.bg, overallCfg.border,
                    )}>
                      {report.overallLevel}
                    </span>
                  </div>
                  <p className="text-white text-sm leading-snug">
                    {report.overallDesc}
                  </p>
                  {/* Stats row */}
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden="true" />
                      <span className="text-for-400 font-semibold">{report.forVotes.toLocaleString()}</span>
                      <span>FOR</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden="true" />
                      <span className="text-against-400 font-semibold">{report.againstVotes.toLocaleString()}</span>
                      <span>AGAINST</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <TrendingUp className="h-3 w-3 text-emerald" aria-hidden="true" />
                      <span className="text-white font-semibold">{report.totalVotes.toLocaleString()}</span>
                      <span>total votes</span>
                    </div>
                  </div>
                </div>
                {/* Composite score */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className={cn(
                    'text-3xl font-mono font-black tabular-nums',
                    overallCfg.color,
                  )}>
                    {report.overallScore}
                  </div>
                  <div className="text-[10px] font-mono text-surface-600">/ 100</div>
                </div>
              </div>
            </motion.div>

            {/* ── Bias metrics ──────────────────────────────────────────────── */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  Your bias profile
                </h2>
              </div>
              <div className="space-y-3">
                {report.metrics.map((metric) => (
                  <BiasCard key={metric.id} metric={metric} />
                ))}
              </div>
            </div>

            {/* ── What is cognitive bias? ──────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-mono font-semibold text-white mb-2">
                    About cognitive bias in civic discourse
                  </h3>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    Cognitive biases are systematic patterns in human thinking that affect
                    every decision-maker. Having some bias isn&apos;t a character flaw — it&apos;s universal.
                    This report measures specific patterns in your civic participation to help you
                    deliberate more carefully. High scores don&apos;t mean your votes are wrong; they
                    suggest areas where conscious reflection before voting could strengthen your
                    reasoning.
                  </p>
                  <p className="text-xs text-surface-500 mt-2 leading-relaxed">
                    Scores update as you vote more. The report becomes more accurate
                    with at least 25 total votes.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Related analytics ────────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-xs font-mono text-surface-600 uppercase tracking-wider mb-2">
                Deepen your self-knowledge
              </p>
              {[
                { href: '/analytics/diversity',    label: 'Category Diversity',  desc: 'Breadth across 10 civic domains',       icon: BarChart2 },
                { href: '/analytics/contrarian',   label: 'Contrarian Report',   desc: 'When you vote against consensus',        icon: AlertTriangle },
                { href: '/analytics/consistency',  label: 'Consistency Tracker', desc: 'How stable your positions are over time', icon: Shield },
                { href: '/compass',                label: 'Civic Compass',        desc: 'Your 2D political orientation map',       icon: TrendingUp },
              ].map(({ href, label, desc, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-surface-200 flex items-center justify-center group-hover:bg-surface-300 transition-colors">
                    <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-surface-500">{desc}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
