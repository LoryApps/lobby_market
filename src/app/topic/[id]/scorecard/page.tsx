'use client'

/**
 * /topic/[id]/scorecard — Civic Topic Report Card
 *
 * Grades a debate across five dimensions and presents a shareable
 * report-card summary. Letter grades calculated from live data.
 *
 * Dimensions:
 *   • Participation       — vote + argument count
 *   • Consensus Clarity   — decisiveness of the vote split
 *   • Argument Quality    — AI-graded argument scores
 *   • Evidence & Sources  — linked sources + evidence items
 *   • Debate Balance      — FOR vs AGAINST argument coverage
 *
 * Distinct from:
 *   /stats           — raw vote velocity charts
 *   /quality         — argument-level AI grade breakdown
 *   /intelligence    — debate analysis report
 *   /brief           — AI narrative summary
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Info,
  Lightbulb,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { ScorecardResponse, ScorecardDimension, LetterGrade } from '@/app/api/topics/[id]/scorecard/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Grade color mapping ──────────────────────────────────────────────────────

function gradeConfig(grade: LetterGrade): {
  bg: string; border: string; text: string; glow: string; label: string
} {
  const g = grade[0]  // A, B, C, D, F
  if (g === 'A') return {
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    text: 'text-emerald',
    glow: 'shadow-emerald/20',
    label: grade === 'A+' ? 'Exceptional' : grade === 'A' ? 'Excellent' : 'Very Good',
  }
  if (g === 'B') return {
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    text: 'text-for-300',
    glow: 'shadow-for-500/20',
    label: grade === 'B+' ? 'Good' : grade === 'B' ? 'Solid' : 'Decent',
  }
  if (g === 'C') return {
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    text: 'text-gold',
    glow: 'shadow-gold/20',
    label: grade === 'C+' ? 'Fair' : grade === 'C' ? 'Average' : 'Below Average',
  }
  if (g === 'D') return {
    bg: 'bg-against-700/10',
    border: 'border-against-600/40',
    text: 'text-against-400',
    glow: 'shadow-against-600/20',
    label: 'Poor',
  }
  return {
    bg: 'bg-surface-300/50',
    border: 'border-surface-400/40',
    text: 'text-surface-500',
    glow: 'shadow-none',
    label: 'Incomplete',
  }
}

function gradeScoreFill(score: number): string {
  if (score >= 80) return 'bg-emerald'
  if (score >= 65) return 'bg-for-400'
  if (score >= 50) return 'bg-gold'
  if (score >= 35) return 'bg-against-500'
  return 'bg-surface-400'
}

const DIMENSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  participation:      Users,
  consensus_clarity:  Scale,
  argument_quality:   Sparkles,
  evidence:           BookOpen,
  debate_balance:     BarChart2,
}

// ─── Components ───────────────────────────────────────────────────────────────

function GradeBadge({ grade, size = 'md' }: { grade: LetterGrade; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const cfg = gradeConfig(grade)
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border font-black font-mono shadow-lg',
        cfg.bg, cfg.border, cfg.text, cfg.glow,
        size === 'sm'  && 'h-9 w-9 text-base',
        size === 'md'  && 'h-12 w-12 text-xl',
        size === 'lg'  && 'h-16 w-16 text-2xl',
        size === 'xl'  && 'h-20 w-20 text-3xl',
      )}
    >
      {grade}
    </div>
  )
}

function DimensionCard({ dim, index }: { dim: ScorecardDimension; index: number }) {
  const cfg   = gradeConfig(dim.grade)
  const Icon  = DIMENSION_ICONS[dim.key] ?? Zap
  const fill  = gradeScoreFill(dim.score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.07 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0',
          cfg.bg, cfg.border,
        )}>
          <Icon className={cn('h-4 w-4', cfg.text)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{dim.label}</p>
            <GradeBadge grade={dim.grade} size="sm" />
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5">{dim.description}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dim.score}%` }}
            transition={{ delay: 0.2 + index * 0.07, duration: 0.6, ease: 'easeOut' }}
            className={cn('h-full rounded-full', fill)}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-surface-500 font-mono">{dim.detail}</span>
          <span className={cn('text-[10px] font-mono font-semibold', cfg.text)}>
            {dim.score}/100
          </span>
        </div>
      </div>

      {/* Improvement tip */}
      {dim.improvement && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/60">
          <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-surface-600">{dim.improvement}</p>
        </div>
      )}

      {/* View sub-page link */}
      <Link
        href={dim.href}
        className="flex items-center justify-end gap-1 text-[11px] text-surface-500 hover:text-surface-700 transition-colors"
      >
        <span>View details</span>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

function ScorecardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-20 w-20 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
      {/* Dimensions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Overall grade hero ───────────────────────────────────────────────────────

function OverallHero({
  data,
  onShare,
}: {
  data: ScorecardResponse
  onShare: () => void
}) {
  const cfg = gradeConfig(data.overall_grade)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 md:p-6 space-y-4',
        cfg.bg,
        cfg.border,
      )}
    >
      <div className="flex items-start gap-4">
        {/* Big grade badge */}
        <GradeBadge grade={data.overall_grade} size="xl" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_BADGE[data.status] ?? 'proposed'} size="sm">
              {STATUS_LABEL[data.status] ?? data.status}
            </Badge>
            {data.category && (
              <span className="text-[11px] text-surface-500 font-mono">{data.category}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1">
            {data.statement}
          </p>
          <div className="flex items-center gap-2">
            <Trophy className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.text)} aria-hidden="true" />
            <span className={cn('text-sm font-bold font-mono', cfg.text)}>
              {cfg.label} · {data.overall_score}/100
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-surface-600 leading-relaxed border-t border-surface-300/60 pt-3">
        {data.summary}
      </p>

      {/* Score bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-surface-300/60 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.overall_score}%` }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
            className={cn('h-full rounded-full', gradeScoreFill(data.overall_score))}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span>F</span>
          <span>D</span>
          <span>C</span>
          <span>B</span>
          <span>A</span>
          <span>A+</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`/topic/${data.topic_id}`}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-700 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          View Debate
        </Link>
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-700 hover:text-white transition-colors"
        >
          <Share2 className="h-3 w-3" aria-hidden="true" />
          Share Scorecard
        </button>
      </div>
    </motion.div>
  )
}

// ─── Grade scale legend ───────────────────────────────────────────────────────

function GradeScaleLegend() {
  const SCALE: { grade: LetterGrade; label: string; range: string }[] = [
    { grade: 'A+', label: 'Exceptional',   range: '97–100' },
    { grade: 'A',  label: 'Excellent',     range: '93–96'  },
    { grade: 'B',  label: 'Solid',         range: '80–89'  },
    { grade: 'C',  label: 'Average',       range: '70–79'  },
    { grade: 'D',  label: 'Poor',          range: '60–69'  },
    { grade: 'F',  label: 'Incomplete',    range: '0–59'   },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
        <p className="text-xs font-semibold text-surface-700">Grading Scale</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {SCALE.map(({ grade, label, range }) => {
          const cfg = gradeConfig(grade)
          return (
            <div key={grade} className="flex flex-col items-center gap-1">
              <GradeBadge grade={grade} size="sm" />
              <p className={cn('text-[10px] font-mono font-semibold', cfg.text)}>{label}</p>
              <p className="text-[9px] text-surface-500 font-mono">{range}</p>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScorecardPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData]       = useState<ScorecardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [share, setShare]     = useState(false)
  const prevId = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/scorecard`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Failed to load scorecard')
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id && id !== prevId.current) {
      prevId.current = id
      load()
    }
  }, [id, load])

  const shareUrl  = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = data
    ? `"${data.statement}" scored ${data.overall_grade} on the Lobby Market Civic Scorecard`
    : 'Civic Scorecard · Lobby Market'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">

        {/* Back nav */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Debate
        </Link>

        {/* Page title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Award className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Civic Scorecard</h1>
            <p className="text-xs text-surface-500">Debate graded across five civic dimensions</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh scorecard"
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        {loading && <ScorecardSkeleton />}

        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-against-600/30 p-6 text-center">
            <p className="text-sm text-against-400 mb-3">{error}</p>
            <button
              type="button"
              onClick={load}
              className="text-xs text-surface-500 hover:text-white transition-colors underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Overall grade hero */}
            <OverallHero data={data} onShare={() => setShare(true)} />

            {/* Dimensions section */}
            <div>
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider font-mono mb-3">
                Dimension Breakdown
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.dimensions.map((dim, i) => (
                  <DimensionCard key={dim.key} dim={dim} index={i} />
                ))}
              </div>
            </div>

            {/* Overall score summary row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
            >
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider font-mono mb-3">
                Quick Summary
              </h2>
              <div className="grid grid-cols-5 gap-2">
                {data.dimensions.map((dim) => {
                  const cfg  = gradeConfig(dim.grade)
                  const Icon = DIMENSION_ICONS[dim.key] ?? Zap
                  return (
                    <Link
                      key={dim.key}
                      href={dim.href}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className={cn(
                        'h-8 w-8 rounded-lg border flex items-center justify-center',
                        'transition-all group-hover:scale-105',
                        cfg.bg, cfg.border,
                      )}>
                        <Icon className={cn('h-3.5 w-3.5', cfg.text)} aria-hidden="true" />
                      </div>
                      <span className={cn('text-sm font-black font-mono', cfg.text)}>
                        {dim.grade}
                      </span>
                      <span className="text-[9px] text-surface-500 text-center leading-tight">
                        {dim.label.split(' ')[0]}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </motion.div>

            {/* Improve this debate CTA */}
            {data.dimensions.some(d => d.improvement) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="rounded-2xl bg-for-600/10 border border-for-600/30 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-for-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-white">How to Improve This Score</h2>
                </div>
                <ul className="space-y-2">
                  {data.dimensions
                    .filter(d => d.improvement)
                    .map(d => (
                      <li key={d.key} className="flex items-start gap-2">
                        <div className="h-4 w-4 rounded-full bg-for-600/30 border border-for-600/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ChevronRight className="h-2.5 w-2.5 text-for-400" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-surface-700">{d.improvement}</p>
                          <Link
                            href={d.href}
                            className="text-[10px] text-for-400 hover:text-for-300 transition-colors flex items-center gap-0.5 mt-0.5"
                          >
                            Go to {d.label}
                            <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </li>
                    ))}
                </ul>
              </motion.div>
            )}

            {/* Grade scale legend */}
            <GradeScaleLegend />

            {/* Attribution */}
            <p className="text-[10px] text-surface-500 font-mono text-center">
              Scored at {new Date(data.generated_at).toLocaleString()} · Updates every 5 minutes
            </p>
          </>
        )}
      </main>

      <BottomNav />

      {/* Share panel */}
      <AnimatePresence>
        {share && data && (
          <SharePanel
            url={shareUrl}
            text={shareText}
            onClose={() => setShare(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
