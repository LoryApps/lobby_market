'use client'

/**
 * /exchange/[id]/fundamentals — Market Fundamentals Analysis
 *
 * Evaluates the underlying strength of a civic prediction market based on
 * the quality, balance, and depth of the debate powering it:
 *   • Citation rate — how many arguments cite a source
 *   • Debate balance — are both sides equally represented?
 *   • AI quality distribution — grade breakdown of arguments
 *   • Category context — how often topics like this become law
 *   • Claim Integrity Score — composite 0–100 fundamentals rating
 *
 * Distinct from:
 *   /exchange/[id]/analysis    — statistical price analysis
 *   /exchange/[id]/anatomy     — argument structure breakdown
 *   /exchange/[id]/signal      — multi-factor market signal
 *   /exchange/[id]/research    — pre-trade research pack
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  Layers,
  Link2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FundamentalsData } from '@/app/api/exchange/[id]/fundamentals/route'

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  size = 96,
}: {
  score: number
  label: string
  size?: number
}) {
  const r = size * 0.38
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color =
    score >= 70
      ? '#10b981'   // emerald
      : score >= 45
      ? '#3b82f6'   // blue
      : score >= 25
      ? '#f59e0b'   // gold
      : '#ef4444'   // red

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={size * 0.09}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.09}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold tabular-nums"
          style={{ fontSize: size * 0.22, color }}
        >
          {score}
        </span>
        <span
          className="font-mono text-surface-500 leading-none"
          style={{ fontSize: size * 0.10 }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

// ─── Bar ──────────────────────────────────────────────────────────────────────

function MetricBar({
  value,
  max = 100,
  color,
}: {
  value: number
  max?: number
  color: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-2 w-full rounded-full bg-surface-300/60 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Grade pill ───────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald/20 text-emerald border-emerald/30',
  B: 'bg-for-500/20 text-for-300 border-for-500/30',
  C: 'bg-gold/20 text-gold border-gold/30',
  D: 'bg-against-500/20 text-against-400 border-against-500/30',
  F: 'bg-surface-300/40 text-surface-500 border-surface-400/30',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FundamentalsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  id: string
  statement: string
}

export function FundamentalsClient({ id, statement }: Props) {
  const [data, setData] = useState<FundamentalsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/fundamentals`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as FundamentalsData
      setData(json)
    } catch {
      setError('Failed to load fundamentals data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Integrity label color ────────────────────────────────────────────────
  const labelColor = !data
    ? 'text-surface-500'
    : data.integrity_label === 'Robust'
    ? 'text-emerald'
    : data.integrity_label === 'Solid'
    ? 'text-for-400'
    : data.integrity_label === 'Developing'
    ? 'text-gold'
    : 'text-against-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 space-y-5">
        {/* Back + reload */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Page header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-purple" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
              Market Fundamentals
            </span>
          </div>
          <h1 className="font-mono text-lg font-bold text-white leading-snug line-clamp-2">
            {statement}
          </h1>
        </div>

        {loading && <FundamentalsLoading />}

        {error && (
          <EmptyState
            icon={XCircle}
            title="Failed to load"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* ── Integrity Score card ──────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-5">
                <ScoreRing score={data.integrity_score} label="/ 100" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('font-mono font-bold text-xl', labelColor)}>
                      {data.integrity_label}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-surface-500">
                      Claim Integrity
                    </Badge>
                  </div>
                  <p className="text-sm text-surface-600 font-mono leading-relaxed">
                    {data.integrity_label === 'Robust'
                      ? 'This market is backed by well-cited arguments, balanced debate, and high-quality reasoning.'
                      : data.integrity_label === 'Solid'
                      ? 'The underlying debate has good depth and reasonable balance between sides.'
                      : data.integrity_label === 'Developing'
                      ? 'The debate is building — more sources and argument quality would strengthen this market.'
                      : 'Thin evidence base. This market needs more sourced arguments and balanced debate.'}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <Link
                      href={`/exchange/${id}/arguments`}
                      className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      View arguments <ChevronRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/topic/${id}/sources`}
                      className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Add sources <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Citation & Sources ──────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-for-400" />
                <h2 className="font-mono font-semibold text-sm text-white">
                  Evidence Quality
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
                  <div className="text-2xl font-mono font-bold text-for-400 tabular-nums">
                    {data.citation_rate}%
                  </div>
                  <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Arguments cited
                  </div>
                  <MetricBar
                    value={data.citation_rate}
                    color="#3b82f6"
                  />
                </div>
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
                  <div className="text-2xl font-mono font-bold text-purple tabular-nums">
                    {data.source_count}
                  </div>
                  <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Topic sources
                  </div>
                  <MetricBar
                    value={data.source_count}
                    max={10}
                    color="#8b5cf6"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-200/40 border border-surface-300/40">
                <Info className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-mono text-surface-500 leading-relaxed">
                  Citation rate measures how many arguments link to an external source.
                  Topic sources are curated references added directly to this debate.
                </p>
              </div>
            </div>

            {/* ── Debate Balance ─────────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-gold" />
                <h2 className="font-mono font-semibold text-sm text-white">
                  Debate Balance
                </h2>
                <span
                  className={cn(
                    'ml-auto text-xs font-mono font-bold tabular-nums',
                    data.balance_score >= 70
                      ? 'text-emerald'
                      : data.balance_score >= 40
                      ? 'text-gold'
                      : 'text-against-400'
                  )}
                >
                  {data.balance_score}/100
                </span>
              </div>

              <MetricBar value={data.balance_score} color="#f59e0b" />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-for-500/10 border border-for-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                    <span className="text-xs font-mono text-for-400 font-semibold">FOR</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-white tabular-nums">
                    {data.for_arg_count}
                  </div>
                  <div className="text-[11px] font-mono text-surface-500">
                    {data.for_upvotes.toLocaleString()} upvotes
                  </div>
                </div>
                <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                    <span className="text-xs font-mono text-against-400 font-semibold">AGAINST</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-white tabular-nums">
                    {data.against_arg_count}
                  </div>
                  <div className="text-[11px] font-mono text-surface-500">
                    {data.against_upvotes.toLocaleString()} upvotes
                  </div>
                </div>
              </div>

              {data.balance_score < 40 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/20">
                  <XCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">
                    This debate is lopsided — one side has significantly more arguments.
                    Price may not fully reflect the opposing case.
                  </p>
                </div>
              )}
            </div>

            {/* ── AI Quality Distribution ───────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple" />
                <h2 className="font-mono font-semibold text-sm text-white">
                  Argument Quality
                </h2>
                {data.avg_ai_score !== null && (
                  <span className="ml-auto text-xs font-mono text-surface-500">
                    Avg score{' '}
                    <span className="text-purple font-bold">{data.avg_ai_score}/10</span>
                  </span>
                )}
              </div>

              {data.graded_count === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/40 border border-surface-300/40">
                  <Info className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500">
                    No arguments have been AI-graded yet.{' '}
                    <Link href={`/topic/${id}/arguments`} className="text-for-400 hover:underline">
                      Grade an argument →
                    </Link>
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {data.grade_breakdown.map((g) => (
                      <div key={g.grade} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-mono font-bold',
                            GRADE_COLORS[g.grade] ?? 'bg-surface-300/40 text-surface-500 border-surface-400/30'
                          )}
                        >
                          {g.grade}
                        </span>
                        <div className="flex-1">
                          <MetricBar
                            value={g.pct}
                            color={
                              g.grade === 'A' ? '#10b981'
                              : g.grade === 'B' ? '#3b82f6'
                              : g.grade === 'C' ? '#f59e0b'
                              : g.grade === 'D' ? '#f87171'
                              : '#71717a'
                            }
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-mono text-surface-500 tabular-nums">
                          {g.count}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-mono text-surface-600">
                    {data.graded_count} of {data.total_arg_count} arguments graded by AI
                  </p>
                </>
              )}
            </div>

            {/* ── Category Context ───────────────────────────────────────────── */}
            {data.category && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-emerald" />
                  <h2 className="font-mono font-semibold text-sm text-white">
                    Category Context
                  </h2>
                  <span className="ml-auto">
                    <Badge variant="outline" className="text-[10px] text-emerald border-emerald/30">
                      {data.category}
                    </Badge>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-white tabular-nums">
                      {data.category_law_rate}%
                    </div>
                    <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                      Category law rate
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-white tabular-nums">
                      {data.category_topic_count}
                    </div>
                    <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                      Total topics
                    </div>
                  </div>
                </div>

                {data.similar_resolved.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                      Resolved Comparables
                    </h3>
                    {data.similar_resolved.map((t) => (
                      <Link
                        key={t.id}
                        href={`/exchange/${t.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:bg-surface-200/70 hover:border-surface-400/60 transition-colors group"
                      >
                        <div className="flex-shrink-0">
                          {t.became_law ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald" />
                          ) : (
                            <XCircle className="h-4 w-4 text-against-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-surface-700 group-hover:text-white transition-colors line-clamp-1">
                            {t.statement}
                          </p>
                          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                            Final: {t.final_blue_pct}¢ · {t.total_votes.toLocaleString()} votes
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <span
                            className={cn(
                              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                              t.became_law
                                ? 'bg-emerald/20 text-emerald'
                                : 'bg-against-500/20 text-against-400'
                            )}
                          >
                            {t.became_law ? 'LAW' : 'FAILED'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Quick nav ───────────────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <h2 className="font-mono text-sm font-semibold text-white">
                Related Analysis
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Anatomy', href: `/exchange/${id}/anatomy`, icon: Layers },
                  { label: 'Signal', href: `/exchange/${id}/signal`, icon: Sparkles },
                  { label: 'Arguments', href: `/exchange/${id}/arguments`, icon: FileText },
                  { label: 'Research', href: `/exchange/${id}/research`, icon: BookOpen },
                  { label: 'Scorecard', href: `/exchange/${id}/scorecard`, icon: BarChart2 },
                  { label: 'Laws', href: `/law`, icon: Gavel },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:bg-surface-200/70 hover:border-surface-400/60 transition-colors group"
                  >
                    <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                    <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors">
                      {label}
                    </span>
                    <ExternalLink className="h-3 w-3 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
