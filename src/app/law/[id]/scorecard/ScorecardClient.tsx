'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Scale,
  Share2,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { LawScorecardResponse, LawScorecardDimension, LetterGrade } from '@/app/api/laws/[id]/scorecard/route'

// ─── Grade colour helpers ─────────────────────────────────────────────────────

function gradeColors(grade: LetterGrade) {
  if (grade.startsWith('A')) return {
    text: 'text-emerald',
    bg:   'bg-emerald/10',
    border: 'border-emerald/30',
    bar:  'bg-emerald',
  }
  if (grade.startsWith('B')) return {
    text: 'text-for-400',
    bg:   'bg-for-500/10',
    border: 'border-for-500/30',
    bar:  'bg-for-500',
  }
  if (grade.startsWith('C')) return {
    text: 'text-gold',
    bg:   'bg-gold/10',
    border: 'border-gold/30',
    bar:  'bg-gold',
  }
  return {
    text: 'text-against-400',
    bg:   'bg-against-500/10',
    border: 'border-against-500/30',
    bar:  'bg-against-500',
  }
}

function overallGPA(score: number) {
  if (score >= 93) return '4.0'
  if (score >= 90) return '3.7'
  if (score >= 87) return '3.3'
  if (score >= 83) return '3.0'
  if (score >= 80) return '2.7'
  if (score >= 77) return '2.3'
  if (score >= 73) return '2.0'
  if (score >= 70) return '1.7'
  if (score >= 60) return '1.0'
  return '0.0'
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ScorecardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-8 flex flex-col items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-8 mt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Overall hero ─────────────────────────────────────────────────────────────

function OverallHero({
  data,
  onShare,
}: {
  data: LawScorecardResponse
  onShare: () => void
}) {
  const colors = gradeColors(data.overall_grade)

  const estYear = new Date(data.established_at).getFullYear()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-3xl border p-8 flex flex-col items-center gap-4 text-center',
        colors.bg, colors.border
      )}
    >
      {/* Grade circle */}
      <div
        className={cn(
          'flex items-center justify-center h-24 w-24 rounded-full border-2 text-5xl font-black font-mono leading-none',
          colors.text, colors.border
        )}
        aria-label={`Overall grade ${data.overall_grade}`}
      >
        {data.overall_grade}
      </div>

      {/* Law statement */}
      <p className="text-sm font-semibold text-white max-w-sm leading-snug">
        {data.statement.length > 90
          ? `${data.statement.slice(0, 90)}…`
          : data.statement}
      </p>

      {/* Summary */}
      <p className="text-xs text-surface-500 max-w-sm">{data.summary}</p>

      {/* Key stats row */}
      <div className="flex items-center gap-8 mt-1">
        <div className="flex flex-col items-center">
          <span className={cn('text-2xl font-black font-mono', colors.text)}>
            {overallGPA(data.overall_score)}
          </span>
          <span className="text-[10px] text-surface-500 uppercase tracking-wider font-mono">GPA</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-black font-mono text-white">
            {data.overall_score}
          </span>
          <span className="text-[10px] text-surface-500 uppercase tracking-wider font-mono">Score</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-black font-mono text-surface-600">
            {estYear}
          </span>
          <span className="text-[10px] text-surface-500 uppercase tracking-wider font-mono">Est.</span>
        </div>
      </div>

      {/* Share */}
      <button
        type="button"
        onClick={onShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-600 hover:text-white transition-colors"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        Share Scorecard
      </button>
    </motion.div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({
  dim,
  index,
}: {
  dim: LawScorecardDimension
  index: number
}) {
  const colors = gradeColors(dim.grade)

  const ICONS: Record<string, typeof Scale> = {
    legitimacy:  Scale,
    verdict:     CheckCircle2,
    resilience:  Shield,
    stability:   BarChart2,
    engagement:  Sparkles,
  }
  const Icon = ICONS[dim.key] ?? Award

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-5 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0', colors.bg, colors.border)}>
          <Icon className={cn('h-5 w-5', colors.text)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{dim.label}</span>
            <span className={cn('text-base font-black font-mono leading-none', colors.text)}>
              {dim.grade}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5 leading-snug">{dim.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dim.score}%` }}
            transition={{ delay: index * 0.06 + 0.2, duration: 0.6, ease: 'easeOut' }}
            className={cn('h-full rounded-full', colors.bar)}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-surface-500 font-mono">{dim.score}/100</span>
        </div>
      </div>

      {/* Detail */}
      <p className="text-[11px] text-surface-500 leading-snug">{dim.detail}</p>

      {/* Link */}
      <Link
        href={dim.href}
        className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors"
      >
        View detail
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function SummaryRow({ data }: { data: LawScorecardResponse }) {
  const passing = data.dimensions.filter((d) => d.score >= 70)
  const failing = data.dimensions.filter((d) => d.score < 70)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider font-mono">
        Performance Summary
      </h2>

      {passing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-emerald font-semibold">
            Passing ({passing.length})
          </p>
          {passing.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-surface-600">{d.label}</span>
              <span className="ml-auto text-xs font-mono text-emerald">{d.grade}</span>
            </div>
          ))}
        </div>
      )}

      {failing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-against-400 font-semibold">
            Needs improvement ({failing.length})
          </p>
          {failing.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-surface-600">{d.label}</span>
              <span className="ml-auto text-xs font-mono text-against-400">{d.grade}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="pt-2 border-t border-surface-300 flex flex-wrap gap-2">
        <Link
          href={`/law/${data.law_id}/legacy`}
          className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Legacy
        </Link>
        <Link
          href={`/law/${data.law_id}/pulse`}
          className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Pulse
        </Link>
        <Link
          href={`/law/${data.law_id}/forecast`}
          className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Forecast
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScorecardClient({ lawId }: { lawId: string }) {
  const params = useParams<{ id: string }>()
  const id = lawId || params?.id

  const [data, setData] = useState<LawScorecardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [share, setShare] = useState(false)
  const prevId = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/scorecard`, { cache: 'no-store' })
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
    ? `"${data.statement.slice(0, 60)}${data.statement.length > 60 ? '…' : ''}" scored ${data.overall_grade} on the Lobby Market Law Scorecard`
    : 'Law Scorecard · Lobby Market'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">

        {/* Back nav */}
        <Link
          href={`/law/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Law
        </Link>

        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Award className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Law Scorecard</h1>
            <p className="text-xs text-surface-500">Performance graded across five civic dimensions</p>
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
            <OverallHero data={data} onShare={() => setShare(true)} />

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

            <SummaryRow data={data} />

            {/* Law footer links */}
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <span>Also see:</span>
              <Link href={`/law/${id}/verdict`}  className="hover:text-white underline transition-colors">Verdict</Link>
              <span>·</span>
              <Link href={`/law/${id}/challenge`} className="hover:text-white underline transition-colors">Challenges</Link>
              <span>·</span>
              <Link href={`/law/${id}/amendments`} className="hover:text-white underline transition-colors">Amendments</Link>
            </div>
          </>
        )}
      </main>
      <BottomNav />

      <AnimatePresence>
        {share && (
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
