'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Share2,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CivicScoreResponse, ScoreDimension } from '@/app/api/civic-score/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, typeof Vote> = {
  participation:  Vote,
  argumentation:  MessageSquare,
  breadth:        Globe,
  accuracy:       Target,
  reputation:     Trophy,
}

const DIMENSION_COLORS: Record<string, { text: string; bg: string; ring: string; bar: string; glow: string }> = {
  participation: {
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    ring: 'ring-for-500/30',
    bar: 'bg-for-500',
    glow: '#3b82f6',
  },
  argumentation: {
    text: 'text-purple',
    bg: 'bg-purple/10',
    ring: 'ring-purple/30',
    bar: 'bg-purple',
    glow: '#8b5cf6',
  },
  breadth: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    ring: 'ring-emerald/30',
    bar: 'bg-emerald',
    glow: '#10b981',
  },
  accuracy: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    ring: 'ring-gold/30',
    bar: 'bg-gold',
    glow: '#f59e0b',
  },
  reputation: {
    text: 'text-against-300',
    bg: 'bg-against-500/10',
    ring: 'ring-against-500/30',
    bar: 'bg-against-400',
    glow: '#f87171',
  },
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald',
  'A':  'text-emerald',
  'A-': 'text-emerald',
  'B+': 'text-for-300',
  'B':  'text-for-400',
  'B-': 'text-for-400',
  'C+': 'text-gold',
  'C':  'text-gold',
  'C-': 'text-gold',
  'D':  'text-against-400',
  'F':  'text-against-500',
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCounter({
  target,
  duration = 1400,
  className,
}: {
  target: number
  duration?: number
  className?: string
}) {
  const [current, setCurrent] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return <span className={className}>{current}</span>
}

// ─── Circular gauge ───────────────────────────────────────────────────────────

function CircularGauge({
  score,
  size = 160,
  strokeWidth = 10,
  color = '#3b82f6',
  animate = true,
}: {
  score: number
  size?: number
  strokeWidth?: number
  color?: string
  animate?: boolean
}) {
  const r = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * r
  const [displayed, setDisplayed] = useState(animate ? 0 : score)

  useEffect(() => {
    if (!animate) return
    let start: number | null = null
    const duration = 1200
    function frame(ts: number) {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayed(eased * score)
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [score, animate])

  const dashOffset = circumference * (1 - displayed / 100)

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-surface-300"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 0.016s linear' }}
        filter={`drop-shadow(0 0 6px ${color}80)`}
      />
    </svg>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({
  dim,
  index,
}: {
  dim: ScoreDimension
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = DIMENSION_COLORS[dim.key]
  const Icon = DIMENSION_ICONS[dim.key] ?? Zap
  const gradeColor = GRADE_COLOR[dim.grade] ?? 'text-surface-400'
  const delta = dim.score - dim.platform_avg

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-200/40 transition-colors"
      >
        {/* Icon */}
        <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0', cfg.bg)}>
          <Icon className={cn('h-5 w-5', cfg.text)} />
        </div>

        {/* Label + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-mono font-semibold text-white">{dim.label}</span>
            <span className={cn('text-xs font-mono font-bold', gradeColor)}>{dim.grade}</span>
            {delta !== 0 && (
              <span className={cn('text-[10px] font-mono ml-auto', delta >= 0 ? 'text-emerald' : 'text-against-400')}>
                {delta >= 0 ? '+' : ''}{delta} vs avg
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', cfg.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${dim.score}%` }}
              transition={{ duration: 0.9, delay: 0.15 * index, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-mono text-surface-600">{dim.description}</span>
            <span className={cn('text-sm font-mono font-bold tabular-nums', cfg.text)}>{dim.score}</span>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-surface-500" />
            : <ChevronDown className="h-4 w-4 text-surface-500" />
          }
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-surface-300">
              {/* Platform comparison bar */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
                  <span>Your score</span>
                  <span>Platform avg: {dim.platform_avg}</span>
                </div>
                <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                  {/* Platform average marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-surface-500 z-10"
                    style={{ left: `${dim.platform_avg}%` }}
                  />
                  {/* User score bar */}
                  <motion.div
                    className={cn('h-full rounded-full', cfg.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${dim.score}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Breakdown text */}
              <p className="text-xs font-mono text-surface-500 mt-3 leading-relaxed">
                {dim.breakdown}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Vote
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-300 px-3 py-2">
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
      <div>
        <p className="text-[10px] font-mono text-surface-500 leading-none mb-0.5">{label}</p>
        <p className="text-xs font-mono font-semibold text-white">{value}</p>
      </div>
    </div>
  )
}

// ─── Score color helper ───────────────────────────────────────────────────────

function scoreGlowColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-emerald'
  if (score >= 60) return 'text-for-400'
  if (score >= 40) return 'text-gold'
  return 'text-against-400'
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CivicScorePage() {
  const [data, setData] = useState<CivicScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-score')
      if (res.status === 401) { setError('Sign in to see your Civic Score.'); return }
      if (!res.ok) throw new Error('Failed')
      const json: CivicScoreResponse = await res.json()
      setData(json)
    } catch {
      setError('Failed to load your Civic Score. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleShare = useCallback(async () => {
    if (!data) return
    const text = `My Civic Score on Lobby Market: ${data.composite}/100 (${data.grade}) — ${data.level}. Check yours at lobby.market/civic-score`
    try {
      if (navigator.share) {
        await navigator.share({ text, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* user cancelled */ }
  }, [data])

  const glowColor = data ? scoreGlowColor(data.composite) : '#3b82f6'
  const textColor = data ? scoreTextColor(data.composite) : 'text-for-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white font-mono">Civic Score</h1>
              <button
                onClick={() => setShowInfo((s) => !s)}
                className="text-surface-500 hover:text-white transition-colors"
                aria-label="About Civic Score"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-surface-500 mt-0.5 font-mono">
              Your composite civic engagement rating
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Info panel ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <Sparkles className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Your <strong className="text-white">Civic Score</strong> is a composite of five dimensions, each scored 0–100 and weighted equally. It reflects how deeply and thoughtfully you engage with the platform — not just how often you vote.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {[
                    { label: 'Participation', desc: 'Vote volume and consistency (streak)' },
                    { label: 'Argumentation', desc: 'Quality and engagement of your arguments' },
                    { label: 'Breadth', desc: 'Coverage across categories and topics' },
                    { label: 'Accuracy', desc: 'Prediction accuracy and vote calibration' },
                    { label: 'Reputation', desc: 'Clout, reputation score, and platform standing' },
                  ].map((d) => (
                    <div key={d.label} className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-for-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-mono font-semibold text-white">{d.label}</p>
                        <p className="text-[10px] text-surface-500">{d.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading state ────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
            <p className="text-sm font-mono text-surface-500">Computing your civic score…</p>
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Shield className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-300 mb-4">{error}</p>
            {error.includes('Sign in') ? (
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={load}
                className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        {!loading && data && !error && (
          <div className="space-y-5">

            {/* Composite score hero card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative rounded-3xl bg-surface-100 border border-surface-300 p-6 overflow-hidden"
            >
              {/* Background glow */}
              <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowColor}, transparent 70%)` }}
              />

              <div className="relative flex flex-col items-center text-center">
                {/* Circular gauge */}
                <div className="relative mb-4">
                  <CircularGauge
                    score={data.composite}
                    size={160}
                    strokeWidth={12}
                    color={glowColor}
                    animate
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AnimatedCounter
                      target={data.composite}
                      duration={1200}
                      className={cn('text-4xl font-bold font-mono tabular-nums', textColor)}
                    />
                    <span className="text-xs font-mono text-surface-500 mt-0.5">/ 100</span>
                  </div>
                </div>

                {/* Grade + level */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-2xl font-mono font-bold', GRADE_COLOR[data.grade] ?? 'text-white')}>
                    {data.grade}
                  </span>
                  <span className="text-surface-600 font-mono">·</span>
                  <span className="text-sm font-mono font-semibold text-white">{data.level}</span>
                </div>

                <p className="text-xs font-mono text-surface-500 max-w-xs mb-4">
                  {data.level_description}
                </p>

                {/* Percentile */}
                {data.percentile !== null && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-for-500/10 border border-for-500/20">
                    <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                    <span className="text-xs font-mono text-for-300">
                      Top <AnimatedCounter target={100 - data.percentile} duration={1000} />% of citizens
                    </span>
                  </div>
                )}

                {/* Share button */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Copy className="h-3.5 w-3.5 text-emerald" />
                        <span className="text-emerald">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5" />
                        Share score
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Dimension radar (horizontal bar preview) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart2 className="h-3.5 w-3.5" />
                Score Breakdown
              </h2>

              {/* Mini bar chart */}
              <div className="space-y-2.5">
                {data.dimensions.map((dim, i) => {
                  const cfg = DIMENSION_COLORS[dim.key]
                  return (
                    <div key={dim.key} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-surface-500 w-24 flex-shrink-0 text-right">
                        {dim.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', cfg.bar)}
                          initial={{ width: 0 }}
                          animate={{ width: `${dim.score}%` }}
                          transition={{ duration: 0.8, delay: 0.05 * i, ease: 'easeOut' }}
                        />
                      </div>
                      <span className={cn('text-[11px] font-mono font-bold w-7 flex-shrink-0 tabular-nums', cfg.text)}>
                        {dim.score}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Dimension detail cards */}
            <div>
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                Dimension Details
              </h2>
              <div className="space-y-2">
                {data.dimensions.map((dim, i) => (
                  <DimensionCard key={dim.key} dim={dim} index={i} />
                ))}
              </div>
            </div>

            {/* Stats grid */}
            <div>
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                Your Stats
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StatChip
                  icon={Vote}
                  label="Total Votes"
                  value={data.stats.total_votes.toLocaleString()}
                  color="text-for-400"
                />
                <StatChip
                  icon={Zap}
                  label="Vote Streak"
                  value={`${data.stats.vote_streak} days`}
                  color="text-gold"
                />
                <StatChip
                  icon={MessageSquare}
                  label="Arguments"
                  value={data.stats.total_arguments.toLocaleString()}
                  color="text-purple"
                />
                <StatChip
                  icon={Globe}
                  label="Categories"
                  value={`${data.stats.categories_engaged} / 10`}
                  color="text-emerald"
                />
                <StatChip
                  icon={Brain}
                  label="Avg AI Score"
                  value={data.stats.avg_ai_score !== null ? `${data.stats.avg_ai_score.toFixed(1)}/10` : 'N/A'}
                  color="text-purple"
                />
                <StatChip
                  icon={Target}
                  label="Pred. Accuracy"
                  value={data.stats.prediction_accuracy !== null
                    ? `${Math.round(data.stats.prediction_accuracy * 100)}%`
                    : 'N/A'
                  }
                  color="text-gold"
                />
                <StatChip
                  icon={Star}
                  label="Clout"
                  value={data.stats.clout.toLocaleString()}
                  color="text-against-300"
                />
                <StatChip
                  icon={Trophy}
                  label="Reputation"
                  value={Math.round(data.stats.reputation_score).toLocaleString()}
                  color="text-gold"
                />
                <StatChip
                  icon={Shield}
                  label="Member For"
                  value={`${data.stats.account_age_days}d`}
                  color="text-surface-500"
                />
              </div>
            </div>

            {/* How to improve */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Improve Your Score
              </h2>
              <div className="space-y-2">
                {data.dimensions
                  .slice()
                  .sort((a, b) => a.score - b.score)
                  .slice(0, 3)
                  .map((dim) => {
                    const cfg = DIMENSION_COLORS[dim.key]
                    const Icon = DIMENSION_ICONS[dim.key] ?? Zap
                    const tips: Record<string, { tip: string; href: string; cta: string }> = {
                      participation: { tip: 'Vote on more topics daily to build your streak.', href: '/topics', cta: 'Browse topics' },
                      argumentation: { tip: 'Write high-quality arguments with evidence citations.', href: '/topics', cta: 'Argue a topic' },
                      breadth: { tip: 'Explore categories you haven\'t voted in yet.', href: '/categories', cta: 'Browse categories' },
                      accuracy: { tip: 'Make predictions on active topics to build accuracy.', href: '/predictions', cta: 'Make predictions' },
                      reputation: { tip: 'Consistent engagement grows your clout and reputation.', href: '/leaderboard', cta: 'See leaderboard' },
                    }
                    const tip = tips[dim.key]
                    return (
                      <div
                        key={dim.key}
                        className={cn('flex items-start gap-3 rounded-xl p-3', cfg.bg)}
                      >
                        <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', cfg.text)} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-mono font-semibold mb-0.5', cfg.text)}>
                            {dim.label} · {dim.score}/100
                          </p>
                          <p className="text-xs text-surface-500 leading-relaxed">{tip?.tip}</p>
                        </div>
                        {tip && (
                          <Link
                            href={tip.href}
                            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-mono text-surface-600 hover:text-white transition-colors"
                          >
                            {tip.cta}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    )
                  })}
              </div>
            </motion.div>

            {/* Nav links */}
            <div className="flex items-center justify-center gap-4 text-xs text-surface-500 flex-wrap">
              <Link href="/analytics" className="hover:text-for-400 transition-colors font-mono">
                Full Analytics →
              </Link>
              <Link href="/archetype" className="hover:text-gold transition-colors font-mono">
                Civic Archetype →
              </Link>
              <Link href="/manifesto" className="hover:text-purple transition-colors font-mono">
                My Manifesto →
              </Link>
            </div>

          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
