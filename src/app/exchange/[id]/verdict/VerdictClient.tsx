'use client'

/**
 * /exchange/[id]/verdict — Community Verdict
 *
 * Synthesises every signal into a definitive community judgment:
 *   • Verdict headline (Strong FOR / Leaning FOR / Deadlocked / etc.)
 *   • Confidence score
 *   • One-sentence plain-language summary
 *   • Top FOR & AGAINST arguments
 *   • Key market signals (momentum, quality, volume, deadlock)
 *   • Forecaster consensus
 *   • Resolved comparables from the same category
 *
 * Distinct from:
 *   /exchange/[id]/scorecard  — grades individual market dimensions
 *   /exchange/[id]/model      — fair-value / over-under analysis
 *   /exchange/[id]/steelman   — best arguments by side
 *   /exchange/[id]/analysis   — statistical price deep-dive
 *
 * This page answers: "What is the community's final judgment — and how
 * sure are we?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookMarked,
  Brain,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ShieldCheck,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  VerdictData,
  VerdictLabel,
  VerdictArgument,
  VerdictSignal,
} from '@/app/api/exchange/[id]/verdict/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<
  VerdictLabel,
  { label: string; color: string; bg: string; border: string; icon: typeof ThumbsUp; barColor: string }
> = {
  strong_for:      { label: 'Strong FOR',      color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: ThumbsUp,   barColor: 'bg-emerald' },
  leaning_for:     { label: 'Leaning FOR',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: ThumbsUp,   barColor: 'bg-for-500' },
  deadlocked:      { label: 'Deadlocked',      color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Scale,      barColor: 'bg-gold' },
  leaning_against: { label: 'Leaning AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: ThumbsDown, barColor: 'bg-against-500' },
  strong_against:  { label: 'Strong AGAINST',  color: 'text-against-400', bg: 'bg-against-600/15', border: 'border-against-500/40', icon: ThumbsDown, barColor: 'bg-against-600' },
}

const SIGNAL_DIRECTION_COLOR: Record<VerdictSignal['direction'], string> = {
  for:     'text-for-400',
  against: 'text-against-400',
  neutral: 'text-surface-400',
}

const SIGNAL_DOT: Record<VerdictSignal['direction'], string> = {
  for:     'bg-for-500',
  against: 'bg-against-500',
  neutral: 'bg-surface-400',
}

const SIGNAL_WEIGHT_OPACITY: Record<VerdictSignal['weight'], string> = {
  high:   'opacity-100',
  medium: 'opacity-85',
  low:    'opacity-65',
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald', A: 'text-emerald',
  'B+': 'text-for-400', B: 'text-for-300',
  'C+': 'text-gold', C: 'text-gold',
  D: 'text-against-300', F: 'text-against-400',
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArgCard({
  arg,
  side,
}: {
  arg: VerdictArgument
  side: 'for' | 'against'
}) {
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'block rounded-xl border p-3.5 transition-colors group',
        side === 'for'
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar
          src={arg.author.avatar_url}
          fallback={arg.author.display_name || arg.author.username}
          size="xs"
        />
        <span className="text-[11px] text-surface-400 truncate">
          @{arg.author.username}
          {arg.author.role && arg.author.role !== 'citizen' && (
            <span className="ml-1 text-gold">· {arg.author.role}</span>
          )}
        </span>
        {arg.ai_grade && (
          <span className={cn('ml-auto text-[10px] font-mono font-bold', GRADE_COLOR[arg.ai_grade] ?? 'text-surface-400')}>
            {arg.ai_grade}
          </span>
        )}
      </div>
      <p className="text-xs text-white/85 leading-relaxed line-clamp-3">
        {arg.content}
      </p>
      <div className="flex items-center gap-3 mt-2.5 text-[11px] text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </span>
        {arg.source_url && (
          <span className="flex items-center gap-1 text-purple">
            <BookMarked className="h-3 w-3" />
            cited
          </span>
        )}
        <span className="ml-auto">{relTime(arg.created_at)}</span>
      </div>
    </Link>
  )
}

function SignalRow({ signal }: { signal: VerdictSignal }) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5 border-b border-surface-300/30 last:border-0', SIGNAL_WEIGHT_OPACITY[signal.weight])}>
      <span className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-0.5', SIGNAL_DOT[signal.direction])} />
      <span className="text-xs text-white/80 flex-1">{signal.label}</span>
      <span className={cn('text-xs font-mono font-semibold', SIGNAL_DIRECTION_COLOR[signal.direction])}>
        {signal.value}
      </span>
    </div>
  )
}

function CompRow({ comp }: { comp: VerdictData['resolved_comps'][0] }) {
  return (
    <Link
      href={`/exchange/${comp.id}`}
      className="flex items-center gap-3 py-2.5 border-b border-surface-300/30 last:border-0 hover:opacity-80 transition-opacity group"
    >
      <span
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
          comp.resolution === 'law' ? 'bg-emerald/15 text-emerald' : 'bg-against-500/15 text-against-400',
        )}
      >
        {comp.resolution === 'law' ? <Gavel className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/80 truncate">{truncate(comp.statement, 60)}</p>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {comp.final_price}¢ FOR · {comp.total_votes.toLocaleString()} votes
        </p>
      </div>
      <span className="text-[10px] text-surface-500 font-mono">{comp.similarity}%</span>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-400" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function VerdictSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  marketId: string
  statement: string
  category: string | null
}

export function VerdictClient({ marketId, statement, category }: Props) {
  const [data, setData] = useState<VerdictData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(false)
      const res = await fetch(`/api/exchange/${marketId}/verdict`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as VerdictData
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [marketId])

  useEffect(() => { load() }, [load])

  const vc = data ? VERDICT_CONFIG[data.verdict] : null
  const VerdictIcon = vc?.icon ?? Scale

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-surface-100/95 backdrop-blur border-b border-surface-300/50">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href={`/exchange/${marketId}`} aria-label="Back to market">
              <ArrowLeft className="h-5 w-5 text-surface-400 hover:text-white transition-colors" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Community Verdict</p>
              <p className="text-sm font-semibold text-white truncate">{truncate(statement, 55)}</p>
            </div>
            {data && !loading && (
              <button
                onClick={load}
                aria-label="Refresh verdict"
                className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4 text-surface-400" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VerdictSkeleton />
              </motion.div>
            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={Scale}
                  title="Verdict unavailable"
                  description="Could not load the verdict for this market. Please try again."
                  action={{ label: 'Retry', onClick: load }}
                />
              </motion.div>
            ) : data ? (
              <motion.div key="data" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* ── Verdict headline card ──────────────────────────────── */}
                <div className={cn('rounded-2xl border p-5', vc!.bg, vc!.border)}>
                  <div className="flex items-start gap-4">
                    <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0', vc!.bg, vc!.border, 'border')}>
                      <VerdictIcon className={cn('h-6 w-6', vc!.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xl font-bold font-mono tracking-tight', vc!.color)}>
                          {vc!.label}
                        </span>
                        <Badge
                          variant={
                            data.verdict === 'strong_for' || data.verdict === 'leaning_for' ? 'active' :
                            data.verdict === 'deadlocked' ? 'proposed' : 'failed'
                          }
                        >
                          {data.market.price}¢
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-white/70 leading-relaxed">
                        {data.summary}
                      </p>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-surface-400 font-mono uppercase tracking-wider">Confidence</span>
                      <span className={cn('text-sm font-bold font-mono', vc!.color)}>{data.confidence}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${data.confidence}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', vc!.barColor)}
                      />
                    </div>
                    <p className="text-[11px] text-surface-500 mt-1">
                      Based on {data.market.total_votes.toLocaleString()} votes, {data.argument_stats.total_for + data.argument_stats.total_against} arguments
                      {data.forecast ? `, and ${data.forecast.total} forecaster positions` : ''}
                    </p>
                  </div>
                </div>

                {/* ── Vote split ─────────────────────────────────────────── */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-4">
                  <p className="text-[11px] text-surface-400 font-mono uppercase tracking-wider mb-3">Vote Split</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-for-400 font-semibold flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> FOR
                        </span>
                        <span className="text-xs font-mono text-for-400">{data.market.price}¢</span>
                      </div>
                      <div className="h-3 rounded-full bg-surface-300/50 overflow-hidden flex">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${data.market.price}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className="h-full bg-for-500 rounded-l-full"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${100 - data.market.price}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                          className="h-full bg-against-500 rounded-r-full"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-surface-500">{data.market.blue_votes.toLocaleString()} FOR</span>
                        <span className="text-[11px] text-surface-500">{data.market.red_votes.toLocaleString()} AGAINST</span>
                      </div>
                    </div>
                  </div>

                  {/* Argument counts */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="rounded-lg bg-for-500/8 border border-for-500/15 p-2.5 text-center">
                      <p className="text-lg font-bold font-mono text-for-400">{data.argument_stats.total_for}</p>
                      <p className="text-[10px] text-surface-500">FOR arguments</p>
                      {data.argument_stats.avg_ai_score_for !== null && (
                        <p className="text-[10px] text-for-300 mt-0.5 font-mono">
                          avg score {Math.round(data.argument_stats.avg_ai_score_for)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-against-500/8 border border-against-500/15 p-2.5 text-center">
                      <p className="text-lg font-bold font-mono text-against-400">{data.argument_stats.total_against}</p>
                      <p className="text-[10px] text-surface-500">AGAINST arguments</p>
                      {data.argument_stats.avg_ai_score_against !== null && (
                        <p className="text-[10px] text-against-300 mt-0.5 font-mono">
                          avg score {Math.round(data.argument_stats.avg_ai_score_against)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Signals ────────────────────────────────────────────── */}
                {data.signals.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-4">
                    <p className="text-[11px] text-surface-400 font-mono uppercase tracking-wider mb-2">
                      Key Signals
                    </p>
                    <div>
                      {data.signals.map((s) => (
                        <SignalRow key={s.id} signal={s} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Top arguments ─────────────────────────────────────── */}
                {(data.top_for.length > 0 || data.top_against.length > 0) && (
                  <div className="space-y-3">
                    {data.top_for.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] text-for-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                            <ThumbsUp className="h-3 w-3" /> Top FOR
                          </p>
                          <Link
                            href={`/exchange/${marketId}/arguments?side=for`}
                            className="text-[11px] text-surface-500 hover:text-surface-400 flex items-center gap-0.5"
                          >
                            All <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {data.top_for.map((a) => (
                            <ArgCard key={a.id} arg={a} side="for" />
                          ))}
                        </div>
                      </div>
                    )}

                    {data.top_against.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] text-against-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                            <ThumbsDown className="h-3 w-3" /> Top AGAINST
                          </p>
                          <Link
                            href={`/exchange/${marketId}/arguments?side=against`}
                            className="text-[11px] text-surface-500 hover:text-surface-400 flex items-center gap-0.5"
                          >
                            All <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {data.top_against.map((a) => (
                            <ArgCard key={a.id} arg={a} side="against" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Forecaster consensus ───────────────────────────────── */}
                {data.forecast && data.forecast.total > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] text-surface-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" /> Forecaster Consensus
                      </p>
                      <Link
                        href={`/exchange/${marketId}/forecast`}
                        className="text-[11px] text-surface-500 hover:text-surface-400 flex items-center gap-0.5"
                      >
                        Detail <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-for-500/8 border border-for-500/20 p-3 text-center">
                        <p className="text-xl font-bold font-mono text-for-400">{data.forecast.for_count}</p>
                        <p className="text-[10px] text-surface-500 mt-0.5">FOR forecasters</p>
                        {data.forecast.avg_for_price !== null && (
                          <p className="text-[10px] text-for-300 font-mono mt-0.5">
                            avg {Math.round(data.forecast.avg_for_price)}¢
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl bg-surface-200 border border-surface-300 p-3 text-center">
                        <p className="text-xl font-bold font-mono text-white">{data.forecast.total}</p>
                        <p className="text-[10px] text-surface-500 mt-0.5">total positions</p>
                      </div>
                      <div className="rounded-xl bg-against-500/8 border border-against-500/20 p-3 text-center">
                        <p className="text-xl font-bold font-mono text-against-400">{data.forecast.against_count}</p>
                        <p className="text-[10px] text-surface-500 mt-0.5">AGAINST forecasters</p>
                        {data.forecast.avg_against_price !== null && (
                          <p className="text-[10px] text-against-300 font-mono mt-0.5">
                            avg {Math.round(data.forecast.avg_against_price)}¢
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Forecaster bar */}
                    {data.forecast.total > 0 && (
                      <div className="mt-3">
                        <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden flex">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(data.forecast.for_count / data.forecast.total) * 100}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="h-full bg-for-500 rounded-l-full"
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(data.forecast.against_count / data.forecast.total) * 100}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                            className="h-full bg-against-500 rounded-r-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Resolved comparables ───────────────────────────────── */}
                {data.resolved_comps.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] text-surface-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Gavel className="h-3.5 w-3.5" /> Similar Resolved Markets
                      </p>
                      {category && (
                        <Link
                          href={`/exchange/categories?cat=${encodeURIComponent(category)}`}
                          className="text-[11px] text-surface-500 hover:text-surface-400 flex items-center gap-0.5"
                        >
                          {category} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <div>
                      {data.resolved_comps.map((c) => (
                        <CompRow key={c.id} comp={c} />
                      ))}
                    </div>
                    <p className="text-[10px] text-surface-500 mt-2">
                      Similarity % = keyword overlap with this market&apos;s statement.
                    </p>
                  </div>
                )}

                {/* ── Status badges ─────────────────────────────────────── */}
                {(data.market.is_hot || data.market.is_near_law || data.market.is_deadlocked) && (
                  <div className="flex flex-wrap gap-2">
                    {data.market.is_hot && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-xs text-gold font-semibold">
                        <Flame className="h-3.5 w-3.5" /> Hot
                      </span>
                    )}
                    {data.market.is_near_law && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald/10 border border-emerald/30 text-xs text-emerald font-semibold">
                        <Gavel className="h-3.5 w-3.5" /> Near Resolution
                      </span>
                    )}
                    {data.market.is_deadlocked && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-xs text-gold font-semibold">
                        <Scale className="h-3.5 w-3.5" /> Deadlocked
                      </span>
                    )}
                  </div>
                )}

                {/* ── Deep-dive links ─────────────────────────────────────── */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-4">
                  <p className="text-[11px] text-surface-400 font-mono uppercase tracking-wider mb-3">Dig Deeper</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: `/exchange/${marketId}/steelman`,  label: 'Steelman',   icon: ShieldCheck, color: 'text-purple' },
                      { href: `/exchange/${marketId}/analysis`,  label: 'Analysis',   icon: BarChart2,   color: 'text-for-400' },
                      { href: `/exchange/${marketId}/model`,     label: 'Fair Value', icon: Target,      color: 'text-gold' },
                      { href: `/exchange/${marketId}/scorecard`, label: 'Scorecard',  icon: Award,       color: 'text-emerald' },
                      { href: `/exchange/${marketId}/playbook`,  label: 'Playbook',   icon: Brain,       color: 'text-purple' },
                      { href: `/exchange/${marketId}/arguments`, label: 'Arguments',  icon: MessageSquare, color: 'text-surface-400' },
                      { href: `/exchange/${marketId}/forecast`,  label: 'Forecasts',  icon: TrendingUp,  color: 'text-for-300' },
                      { href: `/exchange/${marketId}/signal`,    label: 'Signal',     icon: Zap,         color: 'text-gold' },
                    ].map(({ href, label, icon: Icon, color }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/50 transition-colors"
                      >
                        <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                        <span className="text-xs text-white/80 font-medium">{label}</span>
                        <ArrowRight className="h-3 w-3 text-surface-500 ml-auto" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Back link */}
                <div className="pb-2">
                  <Link
                    href={`/exchange/${marketId}`}
                    className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to market
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
