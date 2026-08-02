'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
  Clock,
  Eye,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { LawAuditResponse, AuditDimension, AuditGrade } from '@/app/api/laws/[id]/audit/route'

// ─── Grade helpers ────────────────────────────────────────────────────────────

function gradeColors(grade: AuditGrade) {
  if (grade.startsWith('A')) return {
    text:   'text-emerald',
    bg:     'bg-emerald/10',
    border: 'border-emerald/30',
    bar:    'bg-emerald',
    glow:   'shadow-[0_0_24px_rgba(16,185,129,0.25)]',
  }
  if (grade.startsWith('B')) return {
    text:   'text-for-400',
    bg:     'bg-for-500/10',
    border: 'border-for-500/30',
    bar:    'bg-for-500',
    glow:   'shadow-[0_0_24px_rgba(59,130,246,0.2)]',
  }
  if (grade.startsWith('C')) return {
    text:   'text-gold',
    bg:     'bg-gold/10',
    border: 'border-gold/30',
    bar:    'bg-gold',
    glow:   'shadow-[0_0_24px_rgba(245,158,11,0.2)]',
  }
  return {
    text:   'text-against-400',
    bg:     'bg-against-500/10',
    border: 'border-against-500/30',
    bar:    'bg-against-500',
    glow:   '',
  }
}

// ─── Dimension icons ──────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, typeof Shield> = {
  consensus:     Scale,
  participation: Users,
  deliberation:  Clock,
  balance:       MessageSquare,
  quality:       ThumbsUp,
  scrutiny:      Eye,
}

// ─── Radial score indicator ───────────────────────────────────────────────────

function RadialScore({ score, grade }: { score: number; grade: AuditGrade }) {
  const colors = gradeColors(grade)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" strokeWidth="10" className="stroke-surface-200" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            'transition-all duration-1000',
            grade.startsWith('A') && 'stroke-emerald',
            grade.startsWith('B') && 'stroke-for-400',
            grade.startsWith('C') && 'stroke-gold',
            grade.startsWith('D') || grade === 'F' ? 'stroke-against-400' : '',
          )}
        />
      </svg>
      <div className="flex flex-col items-center gap-0.5 z-10">
        <span className={cn('text-5xl font-black tracking-tighter', colors.text)}>{grade}</span>
        <span className="text-xs text-surface-500 font-medium">{score}/100</span>
      </div>
    </div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim, index }: { dim: AuditDimension; index: number }) {
  const colors = gradeColors(dim.grade)
  const Icon = DIMENSION_ICONS[dim.key] ?? BarChart2

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={cn(
        'rounded-2xl border p-5 space-y-3 relative overflow-hidden',
        'bg-surface-100',
        colors.border,
      )}
    >
      {/* Pass/fail badge */}
      <div className="absolute top-4 right-4">
        {dim.passed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald" />
        ) : (
          <XCircle className="w-4 h-4 text-against-400" />
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 pr-6">
        <div className={cn('p-2 rounded-xl border', colors.bg, colors.border)}>
          <Icon className={cn('w-5 h-5', colors.text)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{dim.label}</p>
          <p className={cn('text-xl font-black leading-none', colors.text)}>{dim.grade}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', colors.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${dim.score}%` }}
          transition={{ duration: 0.8, delay: index * 0.07 + 0.2 }}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-surface-500 leading-relaxed">{dim.description}</p>

      {/* Finding */}
      <p className={cn('text-xs font-medium rounded-lg px-2.5 py-1.5 border', colors.bg, colors.border, colors.text)}>
        {dim.finding}
      </p>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AuditSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-8 flex flex-col items-center gap-4">
        <Skeleton className="h-40 w-40 rounded-full" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="flex gap-8 mt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-7 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditClient({ lawId }: { lawId: string }) {
  const params = useParams()
  const id = lawId || (params.id as string)

  const [data, setData] = useState<LawAuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/audit`)
      if (!res.ok) throw new Error('Failed to load audit')
      setData(await res.json())
    } catch {
      setError('Could not load the audit. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const overallColors = data ? gradeColors(data.overall_grade) : null

  return (
    <>
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
          {/* Back */}
          <div className="flex items-center justify-between">
            <Link
              href={`/law/${id}`}
              className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Law
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-all disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-purple" />
              <span className="text-xs font-semibold text-purple uppercase tracking-widest">Democratic Audit</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">
              {data ? data.statement : 'Loading…'}
            </h1>
            {data && (
              <p className="text-sm text-surface-500 mt-1">
                {data.category && <span className="text-surface-400">{data.category} · </span>}
                Established {new Date(data.established_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>

          {/* Content */}
          {loading && <AuditSkeleton />}
          {error && (
            <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center text-against-400 text-sm">
              {error}
            </div>
          )}

          {data && !loading && (
            <AnimatePresence mode="wait">
              <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                {/* Overall score card */}
                <div className={cn(
                  'rounded-3xl border p-8 flex flex-col items-center gap-4',
                  'bg-surface-100',
                  overallColors?.border,
                  overallColors?.glow,
                )}>
                  <RadialScore score={data.overall_score} grade={data.overall_grade} />

                  <div className="text-center space-y-1">
                    <p className="text-base font-semibold text-white">{data.headline}</p>
                    <p className="text-xs text-surface-500">
                      Democratic process audit · {data.dimensions.filter((d) => d.passed).length}/{data.dimensions.length} standards met
                    </p>
                  </div>

                  {/* Key stats row */}
                  <div className="flex items-center gap-8 pt-2 border-t border-surface-300 w-full justify-center flex-wrap gap-y-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xl font-black text-white">{data.total_votes.toLocaleString()}</span>
                      <span className="text-xs text-surface-500">votes cast</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xl font-black text-for-400">{Math.round(data.blue_pct)}%</span>
                      <span className="text-xs text-surface-500">consensus FOR</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xl font-black text-white">{data.deliberation_days}d</span>
                      <span className="text-xs text-surface-500">debate duration</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xl font-black text-white">{data.total_arguments}</span>
                      <span className="text-xs text-surface-500">arguments</span>
                    </div>
                  </div>

                  {/* Argument balance bar */}
                  {data.total_arguments > 0 && (
                    <div className="w-full space-y-1.5">
                      <div className="flex justify-between text-xs text-surface-500">
                        <span className="text-for-400 font-medium">{data.for_arguments} FOR</span>
                        <span className="text-against-400 font-medium">{data.against_arguments} AGAINST</span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden flex bg-surface-200">
                        <div
                          className="h-full bg-for-500 transition-all duration-700"
                          style={{
                            width: `${(data.for_arguments / data.total_arguments) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-against-500 transition-all duration-700"
                          style={{
                            width: `${(data.against_arguments / data.total_arguments) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Share */}
                  <SharePanel
                    url={`/law/${id}/audit`}
                    text={`This law scored ${data.overall_grade} (${data.overall_score}/100) in Lobby Market's democratic process audit. ${data.headline}`}
                    lawId={id}
                  />
                </div>

                {/* Dimensions grid */}
                <div>
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                    Audit Dimensions
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.dimensions.map((dim, i) => (
                      <DimensionCard key={dim.key} dim={dim} index={i} />
                    ))}
                  </div>
                </div>

                {/* What this measures */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple" />
                    <h3 className="text-sm font-semibold text-white">About This Audit</h3>
                  </div>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    This audit evaluates the <strong className="text-surface-400">democratic process</strong> that produced
                    this law — not whether the law is good policy. It measures whether the debate was open, deep, and
                    balanced before the community reached consensus.
                  </p>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Six dimensions are assessed: how decisive the vote was, how many citizens participated, how long
                    deliberation ran, whether both sides were heard, the quality of arguments, and whether the community
                    continues to hold the law accountable.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald flex-shrink-0" />
                    <span className="text-xs text-surface-500">= meets the democratic standard</span>
                    <XCircle className="w-3.5 h-3.5 text-against-400 flex-shrink-0 ml-3" />
                    <span className="text-xs text-surface-500">= below the standard</span>
                  </div>
                </div>

                {/* Related links */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300">
                  {[
                    { label: 'Scorecard', description: 'Post-passage performance', href: `/law/${id}/scorecard` },
                    { label: 'Verdict', description: 'Community retrospective judgement', href: `/law/${id}/verdict` },
                    { label: 'Amendments', description: 'Proposed changes to this law', href: `/law/${id}/amendments` },
                    { label: 'Challenges', description: 'Formal challenges filed', href: `/law/${id}/challenge` },
                  ].map(({ label, description, href }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-200 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors">{label}</p>
                        <p className="text-xs text-surface-500">{description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-for-300 transition-colors" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  )
}
