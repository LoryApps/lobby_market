'use client'

/**
 * /analytics/mentor — Civic Argument Mentor
 *
 * AI-powered coaching report on your complete argument history.
 * Analyses your writing style, identifies patterns, grades your
 * overall performance, and provides a personalised improvement plan.
 *
 * Distinct from:
 *   /coach               — real-time critique of a single draft argument
 *   /analytics/argument-quality — platform-wide quality statistics
 *   /arguments/top-scored       — ranked argument leaderboard
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MentorReport, MentorDimension } from '@/app/api/analytics/mentor/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  A: { bg: 'bg-emerald/10', border: 'border-emerald/40', text: 'text-emerald', ring: 'ring-emerald/30' },
  B: { bg: 'bg-for-500/10', border: 'border-for-500/40', text: 'text-for-400', ring: 'ring-for-500/30' },
  C: { bg: 'bg-purple/10', border: 'border-purple/40', text: 'text-purple', ring: 'ring-purple/30' },
  D: { bg: 'bg-gold/10', border: 'border-gold/40', text: 'text-gold', ring: 'ring-gold/30' },
  F: { bg: 'bg-against-500/10', border: 'border-against-500/40', text: 'text-against-400', ring: 'ring-against-500/30' },
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, className }: { score: number; className?: string }) {
  const color =
    score >= 80 ? 'bg-emerald' :
    score >= 65 ? 'bg-for-500' :
    score >= 50 ? 'bg-purple' :
    score >= 35 ? 'bg-gold' :
    'bg-against-500'
  return (
    <div className={cn('h-1.5 rounded-full bg-surface-300 overflow-hidden', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim }: { dim: MentorDimension }) {
  const [open, setOpen] = useState(false)
  const color =
    dim.score >= 80 ? { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/20' } :
    dim.score >= 65 ? { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' } :
    dim.score >= 50 ? { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' } :
    dim.score >= 35 ? { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' } :
    { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' }

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-colors',
        color.bg, color.border,
        'hover:opacity-90'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{dim.name}</span>
        <span className={cn('font-mono text-lg font-bold tabular-nums', color.text)}>
          {dim.score}
        </span>
      </div>
      <ScoreBar score={dim.score} className="mt-2" />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {dim.observation && (
                <p className="text-xs text-surface-500 leading-relaxed">{dim.observation}</p>
              )}
              {dim.tip && (
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gold/80 leading-relaxed">{dim.tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MentorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MentorPage() {
  const router = useRouter()
  const [report, setReport] = useState<MentorReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasGeneratedRef = useRef(false)

  const generate = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/mentor', { method: 'POST' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = (await res.json()) as MentorReport
      if (data.insufficient_data) {
        setError('You need at least 3 arguments to generate a coaching report. Start arguing!')
        return
      }
      if (data.unavailable) {
        setError('AI coaching is temporarily unavailable. Try again later.')
        return
      }
      setReport(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [loading, router])

  useEffect(() => {
    if (!hasGeneratedRef.current) {
      hasGeneratedRef.current = true
      generate()
    }
  }, [generate])

  const gradeStyle = report ? (GRADE_CONFIG[report.overall_grade] ?? GRADE_CONFIG['C']) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Brain className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Argument Mentor</h1>
              <p className="text-xs text-surface-500">AI coaching based on your full argument history</p>
            </div>
          </div>
          {report && (
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              aria-label="Regenerate report"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          )}
        </div>

        {/* Generating state */}
        {loading && !report && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-surface-100 border border-purple/20 p-6 flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-purple animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Analysing your argument history…</p>
                <p className="text-xs text-surface-500 mt-0.5">
                  Reading your arguments, identifying patterns, crafting your coaching report.
                </p>
              </div>
            </div>
            <MentorSkeleton />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 space-y-4">
            <p className="text-sm text-against-300">{error}</p>
            <div className="flex gap-3">
              <Link
                href="/arguments"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Write an argument
              </Link>
              <button
                type="button"
                onClick={generate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-sm font-semibold transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Report */}
        {report && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Hero card — grade + archetype */}
            <div className={cn(
              'rounded-3xl border p-6',
              gradeStyle?.bg, gradeStyle?.border
            )}>
              <div className="flex items-start gap-5">
                {/* Grade badge */}
                <div className={cn(
                  'flex-shrink-0 flex items-center justify-center h-20 w-20 rounded-2xl border-2 shadow-lg',
                  gradeStyle?.bg, gradeStyle?.border, 'ring-4', gradeStyle?.ring
                )}>
                  <span className={cn('font-mono text-5xl font-black', gradeStyle?.text)}>
                    {report.overall_grade}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full border', gradeStyle?.bg, gradeStyle?.border, gradeStyle?.text)}>
                      {report.style_archetype}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium leading-snug mt-2">
                    {report.style_archetype_desc}
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-surface-500 mb-1">
                      <span>Overall Score</span>
                      <span className={cn('font-mono font-bold', gradeStyle?.text)}>{report.overall_score}/100</span>
                    </div>
                    <ScoreBar score={report.overall_score} />
                  </div>
                </div>
              </div>

              {/* Strength + Weakness */}
              {(report.signature_strength || report.signature_weakness) && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.signature_strength && (
                    <div className="rounded-xl bg-surface-200/60 border border-emerald/15 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Star className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                        <span className="text-xs font-mono font-semibold text-emerald">Signature Strength</span>
                      </div>
                      <p className="text-xs text-surface-400 leading-relaxed">{report.signature_strength}</p>
                    </div>
                  )}
                  {report.signature_weakness && (
                    <div className="rounded-xl bg-surface-200/60 border border-gold/15 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Target className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                        <span className="text-xs font-mono font-semibold text-gold">Growth Area</span>
                      </div>
                      <p className="text-xs text-surface-400 leading-relaxed">{report.signature_weakness}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <p className="text-xl font-bold text-white tabular-nums">{report.stats.total_arguments}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">Arguments</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <p className="text-xl font-bold text-for-400 tabular-nums">{report.stats.avg_upvotes}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">Avg Upvotes</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <p className="text-xl font-bold text-purple tabular-nums">{report.stats.cited_pct}%</p>
                <p className="text-[10px] text-surface-500 mt-0.5">Cited</p>
              </div>
            </div>

            {/* Dimensions */}
            {report.dimensions.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider px-1">
                  Coaching Breakdown <span className="text-surface-600">(tap to expand)</span>
                </h2>
                {report.dimensions.map((dim) => (
                  <DimensionCard key={dim.name} dim={dim} />
                ))}
              </div>
            )}

            {/* Best argument */}
            {report.best_argument && (
              <div className="rounded-2xl bg-surface-100 border border-gold/25 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gold flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-gold">Your Best Argument</span>
                </div>
                <blockquote className="text-sm text-surface-300 leading-relaxed italic border-l-2 border-gold/40 pl-3">
                  &ldquo;{report.best_argument.content}&rdquo;
                </blockquote>
                <div className="flex items-center justify-between text-xs text-surface-500">
                  <span className="truncate max-w-[70%]">{report.best_argument.topic_statement}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {report.best_argument.upvotes}
                    </span>
                    {report.best_argument.ai_score !== null && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple" />
                        {report.best_argument.ai_score}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Improvement plan */}
            {report.improvement_plan.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-for-400">Your Improvement Plan</span>
                </div>
                <ul className="space-y-2">
                  {report.improvement_plan.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-for-600/20 border border-for-600/40 text-for-400 text-[10px] font-mono font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-surface-400 leading-relaxed">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Personal note */}
            {report.personal_note && (
              <div className="rounded-2xl bg-surface-100 border border-purple/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-purple flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-purple">From Your Mentor</span>
                </div>
                <p className="text-sm text-surface-400 leading-relaxed italic">
                  {report.personal_note}
                </p>
              </div>
            )}

            {/* CTA links */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/coach"
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/25 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-for-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">Argument Coach</p>
                  <p className="text-[10px] text-surface-500">Draft & critique</p>
                </div>
              </Link>
              <Link
                href="/analytics/argument-quality"
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-purple/10 border border-purple/25 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="h-4 w-4 text-purple" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-purple transition-colors">Quality Index</p>
                  <p className="text-[10px] text-surface-500">Platform-wide stats</p>
                </div>
              </Link>
            </div>

            {/* Generated timestamp */}
            <p className="text-center text-[11px] text-surface-600">
              Report generated {new Date(report.generated_at).toLocaleString()} ·{' '}
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="text-purple hover:text-purple/80 transition-colors disabled:opacity-40"
              >
                Regenerate
              </button>
            </p>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
