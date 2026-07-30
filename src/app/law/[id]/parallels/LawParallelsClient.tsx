'use client'

/**
 * /law/[id]/parallels — Global Legal Precedents
 *
 * Shows how similar laws from other jurisdictions have fared — implementation
 * quality, amendment history, public acceptance, key outcomes, and lessons.
 * Distinct from:
 *   /law/[id]/impact    — this law's own vote timeline and stats
 *   /law/[id]/blueprint — AI implementation plan for this law
 *   /law/[id]/reviews   — community review scores
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Globe,
  Gavel,
  Lightbulb,
  RefreshCw,
  Scale,
  Shield,
  Star,
  TrendingUp,
  XCircle,
  Zap,
  AlertTriangle,
  BarChart3,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawParallelsResponse, GlobalLawComparative } from '@/app/api/laws/[id]/parallels/route'

// ─── Implementation badge ─────────────────────────────────────────────────────

function ImplementationBadge({ impl }: { impl: GlobalLawComparative['implementation'] }) {
  const cfg = {
    strong: { label: 'Strong', classes: 'text-emerald bg-emerald/10 border-emerald/20', Icon: CheckCircle2 },
    moderate: { label: 'Moderate', classes: 'text-gold bg-gold/10 border-gold/20', Icon: TrendingUp },
    weak: { label: 'Weak', classes: 'text-against-400 bg-against-400/10 border-against-400/20', Icon: AlertTriangle },
    contested: { label: 'Contested', classes: 'text-purple bg-purple/10 border-purple/20', Icon: Zap },
  }[impl]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border',
        cfg.classes,
      )}
    >
      <cfg.Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GlobalLawComparative['currentStatus'] }) {
  const cfg = {
    active: { label: 'Active', classes: 'text-for-400 bg-for-400/10 border-for-400/20' },
    amended: { label: 'Amended', classes: 'text-gold bg-gold/10 border-gold/20' },
    expanded: { label: 'Expanded', classes: 'text-emerald bg-emerald/10 border-emerald/20' },
    repealed: { label: 'Repealed', classes: 'text-against-400 bg-against-400/10 border-against-400/20' },
    contested: { label: 'Contested', classes: 'text-purple bg-purple/10 border-purple/20' },
  }[status] ?? { label: status, classes: 'text-surface-400 bg-surface-700 border-surface-600' }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border',
        cfg.classes,
      )}
    >
      {cfg.label}
    </span>
  )
}

// ─── Acceptance bar ───────────────────────────────────────────────────────────

function AcceptanceBar({ score }: { score: number }) {
  const color =
    score >= 70 ? '#10b981' :
    score >= 55 ? '#c9a84c' :
    score >= 40 ? '#f97316' :
    '#ef4444'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-surface-400 w-8 text-right">{score}%</span>
    </div>
  )
}

// ─── Similarity bar ───────────────────────────────────────────────────────────

function SimilarityBar({ score }: { score: number }) {
  const color =
    score >= 80 ? '#3b82f6' :
    score >= 65 ? '#8b5cf6' :
    score >= 50 ? '#f59e0b' :
    '#6b7280'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-surface-400 w-8 text-right">{score}%</span>
    </div>
  )
}

// ─── Comparative card ─────────────────────────────────────────────────────────

function ComparativeCard({
  comp,
  index,
}: {
  comp: GlobalLawComparative
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.38 }}
      className="bg-surface-800/60 border border-surface-700 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {comp.landmark && (
                <Star className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden="true" />
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-400">
                <Globe className="h-3 w-3" aria-hidden="true" />
                {comp.jurisdiction}
              </span>
              <span className="text-[11px] font-mono text-surface-500">·</span>
              <span className="text-[11px] font-mono text-surface-400">{comp.enacted}</span>
              <StatusBadge status={comp.currentStatus} />
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug">{comp.title}</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">{comp.domain}</p>
          </div>
          <ImplementationBadge impl={comp.implementation} />
        </div>

        <p className="text-xs text-surface-300 leading-relaxed mb-3">{comp.description}</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
              Similarity
            </p>
            <SimilarityBar score={comp.similarityScore} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
              Public Support
            </p>
            <AcceptanceBar score={comp.publicAcceptance} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
              Amendments
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm font-bold text-gold font-mono">{comp.amendmentCount}</span>
              {comp.yearsInForce > 0 && (
                <span className="text-[10px] text-surface-500">
                  over {comp.yearsInForce}y
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Match reasons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {comp.matchReasons.map((reason, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-for-500/10 border border-for-500/20 text-[11px] text-for-400 font-mono"
            >
              {reason}
            </span>
          ))}
        </div>

        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          {expanded ? 'Less detail' : 'Key outcome & lesson'}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-t border-surface-700 divide-y divide-surface-700/60"
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
              <span className="text-[11px] font-mono text-surface-400 uppercase tracking-wide">
                What Happened
              </span>
            </div>
            <p className="text-xs text-surface-300 leading-relaxed">{comp.keyOutcome}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              <span className="text-[11px] font-mono text-surface-400 uppercase tracking-wide">
                Key Lesson
              </span>
            </div>
            <p className="text-xs text-surface-300 leading-relaxed">{comp.keyLesson}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ComparativeSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface-800/60 border border-surface-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-5/6 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-6 rounded" />
            <Skeleton className="h-6 rounded" />
            <Skeleton className="h-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
}

export function LawParallelsClient({ lawId }: Props) {
  const params = useParams<{ id: string }>()
  const id = lawId || params.id

  const [data, setData] = useState<LawParallelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/laws/${id}/parallels`)
      if (!res.ok) throw new Error('fetch error')
      const json: LawParallelsResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  return (
    <div className="min-h-screen bg-surface-950 text-white pb-24">
      <TopBar />

      {/* Page header */}
      <div className="sticky top-14 z-10 bg-surface-950/90 backdrop-blur border-b border-surface-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/law/${id}`}
            className="p-1.5 rounded-lg hover:bg-surface-800 transition-colors text-surface-400 hover:text-white"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-for-400" aria-hidden="true" />
              <h1 className="text-sm font-semibold truncate">Global Legal Precedents</h1>
            </div>
            {data && (
              <p className="text-[11px] text-surface-400 truncate mt-0.5">
                {data.law.statement}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-surface-800 transition-colors text-surface-400 hover:text-white disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <XCircle className="h-8 w-8 text-against-400" aria-hidden="true" />
            <p className="text-sm text-surface-400">Failed to load comparatives.</p>
            <button
              onClick={load}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && !data && <ComparativeSkeleton />}

        {/* Data */}
        {data && !loading && (
          <>
            {/* Overall insight */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-for-500/5 border border-for-500/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-for-400" aria-hidden="true" />
                <span className="text-[11px] font-mono text-for-400 uppercase tracking-wide">
                  Global Context
                </span>
              </div>
              <p className="text-sm text-surface-200 leading-relaxed">{data.overallInsight}</p>

              {/* Theme fingerprint */}
              {data.themeFingerprint.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {data.themeFingerprint.map((theme) => (
                    <span
                      key={theme}
                      className="px-2 py-0.5 rounded-full bg-surface-700/60 text-[11px] text-surface-400 font-mono capitalize"
                    >
                      #{theme}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Implementation forecast */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-surface-800/50 border border-surface-700 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-gold/10 border border-gold/20">
                  <Shield className="h-4 w-4 text-gold" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-mono text-gold uppercase tracking-wide">
                      Implementation Forecast
                    </span>
                    <span className="text-[11px] font-mono text-surface-400">
                      {data.implementationForecast.confidenceScore}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed">
                    {data.implementationForecast.mostLikelyChallenges}
                  </p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <p className="text-[10px] font-mono text-surface-500 mb-0.5">Strong impl. rate</p>
                      <p className="text-sm font-bold text-emerald font-mono">
                        {data.implementationForecast.strongImplementationRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-surface-500 mb-0.5">Avg. yrs active</p>
                      <p className="text-sm font-bold text-for-400 font-mono">
                        {data.implementationForecast.averageAmendmentYears}y
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-surface-500 mb-0.5">Based on</p>
                      <p className="text-xs text-surface-400 leading-tight">
                        {data.implementationForecast.basedOn.split(' across ')[0]}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Section header */}
            <div className="flex items-center gap-2 pt-1">
              <Scale className="h-4 w-4 text-surface-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-surface-200">
                Closest Global Comparatives
              </h2>
              <span className="text-[11px] font-mono text-surface-500">
                ({data.comparatives.length})
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {data.comparatives.map((comp, i) => (
                <ComparativeCard key={comp.id} comp={comp} index={i} />
              ))}
            </div>

            {/* Footer links */}
            <div className="flex flex-wrap gap-2 pt-2 pb-4">
              <Link
                href={`/law/${id}/impact`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-300 hover:text-white hover:border-surface-600 transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                Impact Stats
              </Link>
              <Link
                href={`/law/${id}/blueprint`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-300 hover:text-white hover:border-surface-600 transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                Blueprint
              </Link>
              <Link
                href={`/law/${id}/reviews`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-300 hover:text-white hover:border-surface-600 transition-colors"
              >
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                Community Reviews
              </Link>
              <Link
                href={`/law/${id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-300 hover:text-white hover:border-surface-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to Law
              </Link>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
