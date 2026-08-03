'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawHealthData, LawHealthDimension } from '@/app/api/laws/[id]/health/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_PILL: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-for-400/10 text-for-300 border-for-400/30',
  Culture:     'bg-gold/10 text-gold border-gold/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-for-500/10 text-for-400 border-for-500/30',
}
function catPill(cat: string | null) {
  return cat && CAT_PILL[cat]
    ? CAT_PILL[cat]
    : 'bg-surface-300/40 text-surface-500 border-surface-400/40'
}

// ─── Grade ring colours ───────────────────────────────────────────────────────

const GRADE_STYLES: Record<string, { ring: string; text: string; bg: string }> = {
  A: { ring: 'stroke-emerald',    text: 'text-emerald',    bg: 'bg-emerald/10 border-emerald/30' },
  B: { ring: 'stroke-for-400',    text: 'text-for-400',    bg: 'bg-for-500/10 border-for-500/30' },
  C: { ring: 'stroke-gold',       text: 'text-gold',       bg: 'bg-gold/10 border-gold/30' },
  D: { ring: 'stroke-against-400', text: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
  F: { ring: 'stroke-against-500', text: 'text-against-500', bg: 'bg-against-500/15 border-against-500/40' },
}

const DIM_ICONS: Record<string, typeof Activity> = {
  'Verdict Coverage': ThumbsUp,
  'Wiki Documentation': BookOpen,
  'Formal Scrutiny': Shield,
  'Active Discussion': MessageSquare,
}

const STATUS_STYLES = {
  good: 'text-emerald bg-emerald/10 border-emerald/30',
  fair: 'text-gold bg-gold/10 border-gold/30',
  poor: 'text-against-400 bg-against-500/10 border-against-500/30',
}

// ─── Components ───────────────────────────────────────────────────────────────

function GradeRing({ score, grade }: { score: number; grade: string }) {
  const styles = GRADE_STYLES[grade] ?? GRADE_STYLES.F
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-surface-300" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700', styles.ring)}
        />
      </svg>
      <div className="relative text-center">
        <p className={cn('text-3xl font-mono font-black leading-none', styles.text)}>{grade}</p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">{score}/100</p>
      </div>
    </div>
  )
}

function DimensionCard({ dim }: { dim: LawHealthDimension }) {
  const Icon = DIM_ICONS[dim.label] ?? Activity
  const statusStyle = STATUS_STYLES[dim.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300 bg-surface-200/40 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-surface-300/60 flex-shrink-0">
            <Icon className="h-3.5 w-3.5 text-surface-500" />
          </div>
          <div>
            <p className="text-xs font-mono font-bold text-white">{dim.label}</p>
            <p className="text-[11px] font-mono text-surface-500">{dim.weight}% of health score</p>
          </div>
        </div>
        <div className={cn('flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', statusStyle)}>
          {dim.score}/100
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', {
            'bg-emerald': dim.status === 'good',
            'bg-gold': dim.status === 'fair',
            'bg-against-400': dim.status === 'poor',
          })}
          initial={{ width: 0 }}
          animate={{ width: `${dim.score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />
      </div>

      <p className="text-[11px] font-mono text-surface-500 leading-relaxed">{dim.detail}</p>
    </motion.div>
  )
}

function VerdictBar({ data }: { data: LawHealthData }) {
  const { verdict } = data
  if (verdict.total === 0) return null

  const bars: Array<{ key: string; label: string; count: number; cls: string }> = [
    { key: 'succeeded',        label: 'Succeeded',        count: verdict.succeeded,        cls: 'bg-emerald' },
    { key: 'mostly_succeeded', label: 'Mostly succeeded', count: verdict.mostly_succeeded, cls: 'bg-emerald/60' },
    { key: 'mixed',            label: 'Mixed',            count: verdict.mixed,            cls: 'bg-gold' },
    { key: 'mostly_failed',    label: 'Mostly failed',    count: verdict.mostly_failed,    cls: 'bg-against-400/70' },
    { key: 'failed',           label: 'Failed',           count: verdict.failed,           cls: 'bg-against-400' },
  ]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-200/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-emerald/10 flex-shrink-0">
          <Star className="h-3 w-3 text-emerald" />
        </div>
        <p className="text-xs font-mono font-bold text-white">Community Verdict</p>
        <span className="ml-auto text-[11px] font-mono text-surface-500">{verdict.total} votes</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {bars.map(b => b.count > 0 && (
          <motion.div
            key={b.key}
            className={b.cls}
            initial={{ width: 0 }}
            animate={{ width: `${(b.count / verdict.total) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {bars.filter(b => b.count > 0).map(b => (
          <span key={b.key} className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', b.cls)} />
            {b.label} ({b.count})
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props { lawId: string }

export function LawHealthClient({ lawId }: Props) {
  const [data, setData] = useState<LawHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/health`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load health data')
      setData(await res.json() as LawHealthData)
    } catch {
      setError('Could not load health report.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const gradeStyles = data ? (GRADE_STYLES[data.health_grade] ?? GRADE_STYLES.F) : GRADE_STYLES.F

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Law header */}
        {loading ? (
          <div className="space-y-3 mb-8">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-7 w-full rounded" />
            <Skeleton className="h-5 w-3/4 rounded" />
          </div>
        ) : error ? (
          <p className="text-sm font-mono text-against-400 mb-8">{error}</p>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 mb-8"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="law" className="inline-flex items-center gap-1 text-[11px]">
                <Scale className="h-3 w-3" />
                Established Law
              </Badge>
              {data.law_category && (
                <span className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full border', catPill(data.law_category))}>
                  {data.law_category}
                </span>
              )}
            </div>
            <h1 className="text-lg font-mono font-bold text-white leading-snug">
              {data.law_statement}
            </h1>
            <p className="text-[11px] font-mono text-surface-500">
              {data.law_total_votes.toLocaleString()} votes cast · {Math.round(data.law_blue_pct)}% For
            </p>
          </motion.div>
        ) : null}

        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-emerald/10 border border-emerald/20 flex-shrink-0">
            <Activity className="h-4 w-4 text-emerald" />
          </div>
          <div>
            <p className="text-sm font-mono font-bold text-white">Law Health Report</p>
            <p className="text-[11px] font-mono text-surface-500">Post-passage civic scrutiny score</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full rounded-2xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <AlertTriangle className="h-5 w-5 text-against-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button onClick={load} className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors">
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Health score card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'rounded-2xl border p-6 flex items-center gap-6',
                gradeStyles.bg
              )}
            >
              <GradeRing score={data.overall_health} grade={data.health_grade} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-base font-mono font-black', gradeStyles.text)}>
                  {data.health_grade === 'A' && 'Excellent Health'}
                  {data.health_grade === 'B' && 'Good Health'}
                  {data.health_grade === 'C' && 'Fair Health'}
                  {data.health_grade === 'D' && 'Poor Health'}
                  {data.health_grade === 'F' && 'Critical — Needs Attention'}
                </p>
                <p className="text-[11px] font-mono text-surface-500 mt-1 leading-relaxed">
                  Based on verdict coverage, wiki quality, formal challenges, and discussion activity.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Link
                    href={`/law/${lawId}/verdict`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Verdict
                  </Link>
                  <Link
                    href={`/law/${lawId}/wiki`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <BookOpen className="h-3 w-3" />
                    Wiki
                  </Link>
                  <Link
                    href={`/law/${lawId}/challenge`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <Shield className="h-3 w-3" />
                    Challenges
                  </Link>
                  <Link
                    href={`/law/${lawId}/discuss`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Discuss
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Dimension breakdown */}
            <p className="text-[10px] font-mono font-bold text-surface-500 uppercase tracking-wider pt-2">
              Score Breakdown
            </p>
            {data.dimensions.map((dim, i) => (
              <motion.div
                key={dim.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <DimensionCard dim={dim} />
              </motion.div>
            ))}

            {/* Verdict bar */}
            {data.verdict.total > 0 && (
              <>
                <p className="text-[10px] font-mono font-bold text-surface-500 uppercase tracking-wider pt-2">
                  Verdict Distribution
                </p>
                <VerdictBar data={data} />
              </>
            )}

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                  <p className="text-xs font-mono font-bold text-gold">How to improve this law's health</p>
                </div>
                <ul className="space-y-2">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-surface-400 leading-relaxed">
                      <CheckCircle2 className="h-3 w-3 text-gold/60 flex-shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Context: codex-wide health */}
            <div className="rounded-2xl border border-surface-300 bg-surface-200/40 p-4 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-surface-500" />
                  <p className="text-xs font-mono font-bold text-white">Codex Health Overview</p>
                </div>
                <Link
                  href="/law/health"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  View codex health
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-[11px] font-mono text-surface-500 mt-1.5 leading-relaxed">
                See how this law compares to the entire Lobby Codex — which laws have the most scrutiny and which need attention.
              </p>
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link
                href={`/law/${lawId}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Law text
              </Link>
              <Link
                href={`/law/${lawId}/adoption`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Adoption tracker
              </Link>
              <Link
                href={`/law/${lawId}/verdict`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Star className="h-3.5 w-3.5" />
                Cast your verdict
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
