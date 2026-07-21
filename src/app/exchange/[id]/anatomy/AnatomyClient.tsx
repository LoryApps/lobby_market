'use client'

/**
 * /exchange/[id]/anatomy — Market Debate Anatomy
 *
 * Structural analysis of the civic debate powering this prediction market:
 *   • FOR vs AGAINST argument counts and market price alignment
 *   • Argument length distribution (short / medium / long)
 *   • AI grade distribution (A–F) — debate quality by side
 *   • Citation rates — how many arguments cite a source
 *   • Upvote & engagement stats per side
 *   • Top words by side (what language shapes each position)
 *   • Top argument per side
 *
 * Distinct from:
 *   /exchange/[id]/arguments   — browse individual arguments
 *   /exchange/[id]/persuasion  — which arguments shifted the price
 *   /exchange/[id]/signal      — multi-factor market signal
 *   /exchange/[id]/analysis    — statistical price analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookMarked,
  Brain,
  ExternalLink,
  FileText,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Type,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AnatomyData } from '@/app/api/topics/[id]/anatomy/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-emerald text-black',
  B: 'bg-for-500 text-white',
  C: 'bg-gold text-black',
  D: 'bg-against-400 text-white',
  F: 'bg-against-600 text-white',
  ungraded: 'bg-surface-400 text-surface-100',
}

const GRADE_BAR: Record<string, string> = {
  A: 'bg-emerald',
  B: 'bg-for-500',
  C: 'bg-gold',
  D: 'bg-against-400',
  F: 'bg-against-600',
  ungraded: 'bg-surface-400',
}

const LENGTH_COLOR = {
  short: 'bg-for-500',
  medium: 'bg-gold',
  long: 'bg-purple',
}

// ─── Bar row ──────────────────────────────────────────────────────────────────

function BarRow({
  label,
  value,
  total,
  color,
  suffix = '',
}: {
  label: string
  value: number
  total: number
  color: string
  suffix?: string
}) {
  const p = pct(value, total)
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] text-surface-500 text-right shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="w-16 text-[11px] font-mono text-surface-400 shrink-0">
        {value}{suffix} ({p}%)
      </span>
    </div>
  )
}

// ─── Side stat block ──────────────────────────────────────────────────────────

function StatBlock({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-lg font-bold font-mono tabular-nums', color)}>{value}</span>
      <span className="text-[11px] text-surface-500">{label}</span>
      {sub && <span className="text-[10px] text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AnatomySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-4 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-4/5" />
            <Skeleton className="h-2 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Grade distribution panel ─────────────────────────────────────────────────

function GradeDistPanel({
  title,
  dist,
  total,
  color,
}: {
  title: string
  dist: AnatomyData['grade_dist']['for']
  total: number
  color: string
}) {
  const grades = ['A', 'B', 'C', 'D', 'F', 'ungraded'] as const
  return (
    <div className="space-y-2">
      <p className={cn('text-xs font-semibold', color)}>{title}</p>
      <div className="space-y-1.5">
        {grades.map((g) => (
          <BarRow
            key={g}
            label={g === 'ungraded' ? 'Ungraded' : `Grade ${g}`}
            value={dist[g]}
            total={total || 1}
            color={GRADE_BAR[g]}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  id: string
  statement: string
}

export function AnatomyClient({ id, statement }: Props) {
  const [data, setData] = useState<AnatomyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${id}/anatomy`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setData(json as AnatomyData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const forTotal = data?.for_count ?? 0
  const againstTotal = data?.against_count ?? 0
  const totalArgs = data?.total_arguments ?? 0
  const forLenTotal = forTotal || 1
  const againstLenTotal = againstTotal || 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* ── Back nav ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-xs text-surface-400 font-mono">Anatomy</span>
        </div>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30">
              <Brain className="h-4 w-4 text-purple" />
            </div>
            <h1 className="text-base font-semibold text-white">Debate Anatomy</h1>
          </div>
          <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">{statement}</p>
          <p className="text-[11px] text-surface-600 mt-1">
            Structural analysis of how this civic debate is argued — quality distribution, citation rates, and language patterns.
          </p>
        </div>

        {loading && <AnatomySkeleton />}

        {error && (
          <EmptyState
            icon={<BarChart2 className="h-8 w-8" />}
            title="Anatomy unavailable"
            description="Could not load debate structure data."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* ── Argument overview ──────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-for-400" />
                  <h2 className="text-sm font-semibold text-white">Argument Overview</h2>
                  <span className="ml-auto text-[11px] font-mono text-surface-500">
                    {totalArgs} total
                  </span>
                </div>

                {/* FOR vs AGAINST split */}
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-for-400">FOR {forTotal}</span>
                    <span className="text-against-400">AGAINST {againstTotal}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-for-500 transition-all"
                      style={{ width: `${pct(forTotal, totalArgs || 1)}%` }}
                    />
                    <div
                      className="h-full bg-against-500 transition-all"
                      style={{ width: `${pct(againstTotal, totalArgs || 1)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-surface-600 mt-1">
                    <span>{pct(forTotal, totalArgs || 1)}%</span>
                    <span>{pct(againstTotal, totalArgs || 1)}%</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-[11px] font-mono font-semibold text-for-400 uppercase tracking-wider">FOR side</p>
                    <div className="grid grid-cols-2 gap-2">
                      <StatBlock
                        label="Avg upvotes"
                        value={data.upvote_stats.for.avg?.toFixed(1) ?? '—'}
                        color="text-for-400"
                      />
                      <StatBlock
                        label="Avg AI score"
                        value={data.ai_score_stats.for.avg?.toFixed(1) ?? '—'}
                        color="text-for-400"
                      />
                      <StatBlock
                        label="Cited"
                        value={`${data.citation_rate.for}%`}
                        color="text-emerald"
                      />
                      <StatBlock
                        label="Avg replies"
                        value={data.reply_stats.for.avg?.toFixed(1) ?? '—'}
                        color="text-for-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-mono font-semibold text-against-400 uppercase tracking-wider">AGAINST side</p>
                    <div className="grid grid-cols-2 gap-2">
                      <StatBlock
                        label="Avg upvotes"
                        value={data.upvote_stats.against.avg?.toFixed(1) ?? '—'}
                        color="text-against-400"
                      />
                      <StatBlock
                        label="Avg AI score"
                        value={data.ai_score_stats.against.avg?.toFixed(1) ?? '—'}
                        color="text-against-400"
                      />
                      <StatBlock
                        label="Cited"
                        value={`${data.citation_rate.against}%`}
                        color="text-emerald"
                      />
                      <StatBlock
                        label="Avg replies"
                        value={data.reply_stats.against.avg?.toFixed(1) ?? '—'}
                        color="text-against-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Market alignment note */}
                <div className="mt-4 pt-4 border-t border-surface-300">
                  <div className="flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5 text-surface-500" />
                    <p className="text-[11px] text-surface-500">
                      Market consensus: <span className="text-for-400 font-mono font-semibold">{Math.round(data.blue_pct)}% FOR</span>
                      {' · '}
                      Argument split: <span className="text-for-400 font-mono font-semibold">{pct(forTotal, totalArgs || 1)}% FOR</span>
                    </p>
                  </div>
                  {Math.abs(Math.round(data.blue_pct) - pct(forTotal, totalArgs || 1)) > 10 && (
                    <p className="text-[11px] text-gold mt-1 pl-5">
                      {pct(forTotal, totalArgs || 1) > Math.round(data.blue_pct)
                        ? 'FOR arguments outpace the consensus price — the debate skews more positive than the market.'
                        : 'AGAINST arguments outpace the consensus price — the debate skews more skeptical than the market.'}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Length distribution ─────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Type className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Argument Length</h2>
                  <div className="ml-auto flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-for-500" />Short</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-gold" />Medium</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-purple" />Long</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-for-400">FOR</p>
                    <BarRow label="Short (&lt;50w)" value={data.length_dist.for.short} total={forLenTotal} color={LENGTH_COLOR.short} />
                    <BarRow label="Medium" value={data.length_dist.for.medium} total={forLenTotal} color={LENGTH_COLOR.medium} />
                    <BarRow label="Long (&gt;150w)" value={data.length_dist.for.long} total={forLenTotal} color={LENGTH_COLOR.long} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-against-400">AGAINST</p>
                    <BarRow label="Short (&lt;50w)" value={data.length_dist.against.short} total={againstLenTotal} color={LENGTH_COLOR.short} />
                    <BarRow label="Medium" value={data.length_dist.against.medium} total={againstLenTotal} color={LENGTH_COLOR.medium} />
                    <BarRow label="Long (&gt;150w)" value={data.length_dist.against.long} total={againstLenTotal} color={LENGTH_COLOR.long} />
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-surface-600">
                  Longer arguments tend to include more reasoning and citations. Short arguments can be sharp but lack depth.
                </p>
              </div>

              {/* ── Grade distribution ──────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-emerald" />
                  <h2 className="text-sm font-semibold text-white">AI Quality Grades</h2>
                  <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                    {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => (
                      <span key={g} className={cn('text-[9px] px-1.5 py-0.5 rounded font-mono font-bold', GRADE_COLOR[g])}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <GradeDistPanel
                    title="FOR arguments"
                    dist={data.grade_dist.for}
                    total={forLenTotal}
                    color="text-for-400"
                  />
                  <GradeDistPanel
                    title="AGAINST arguments"
                    dist={data.grade_dist.against}
                    total={againstLenTotal}
                    color="text-against-400"
                  />
                </div>

                {/* Quality insight */}
                {(data.ai_score_stats.for.avg !== null || data.ai_score_stats.against.avg !== null) && (
                  <div className="mt-4 pt-3 border-t border-surface-300">
                    <div className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-purple" />
                      {data.ai_score_stats.for.avg !== null && data.ai_score_stats.against.avg !== null ? (
                        <p className="text-[11px] text-surface-500">
                          {data.ai_score_stats.for.avg > data.ai_score_stats.against.avg
                            ? <><span className="text-for-400 font-semibold">FOR arguments score higher</span> on average ({data.ai_score_stats.for.avg.toFixed(1)} vs {data.ai_score_stats.against.avg.toFixed(1)})</>
                            : data.ai_score_stats.against.avg > data.ai_score_stats.for.avg
                              ? <><span className="text-against-400 font-semibold">AGAINST arguments score higher</span> on average ({data.ai_score_stats.against.avg.toFixed(1)} vs {data.ai_score_stats.for.avg.toFixed(1)})</>
                              : <>Both sides score equally on average ({data.ai_score_stats.for.avg.toFixed(1)})</>
                          }
                        </p>
                      ) : (
                        <p className="text-[11px] text-surface-500">AI scores not yet available for this debate.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Citation rates ──────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BookMarked className="h-4 w-4 text-emerald" />
                  <h2 className="text-sm font-semibold text-white">Citation Rates</h2>
                  <p className="ml-auto text-[11px] text-surface-500">% of arguments with a source</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[11px] font-semibold text-for-400">FOR</p>
                      <span className="text-xl font-bold font-mono text-for-400">{data.citation_rate.for}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
                      <motion.div
                        className="h-full bg-for-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${data.citation_rate.for}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <p className="text-[11px] text-surface-600">
                      {Math.round((data.citation_rate.for / 100) * forTotal)} of {forTotal} arguments cite a source
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[11px] font-semibold text-against-400">AGAINST</p>
                      <span className="text-xl font-bold font-mono text-against-400">{data.citation_rate.against}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
                      <motion.div
                        className="h-full bg-against-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${data.citation_rate.against}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <p className="text-[11px] text-surface-600">
                      {Math.round((data.citation_rate.against / 100) * againstTotal)} of {againstTotal} arguments cite a source
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-surface-600">
                  Higher citation rates indicate evidence-based debate. Markets with well-cited arguments tend to reach more reliable consensus.
                </p>
              </div>

              {/* ── Top words ──────────────────────────────────────────────── */}
              {(data.top_words.for.length > 0 || data.top_words.against.length > 0) && (
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-4 w-4 text-gold" />
                    <h2 className="text-sm font-semibold text-white">Debate Language</h2>
                    <p className="ml-auto text-[11px] text-surface-500">Most-used terms by side</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-for-400 mb-2">FOR</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.top_words.for.slice(0, 10).map(({ word, count }) => (
                          <span
                            key={word}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-for-500/10 border border-for-500/20 text-[11px] text-for-300"
                            title={`${count} occurrences`}
                          >
                            {word}
                            <span className="font-mono text-for-500/60 text-[9px]">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-against-400 mb-2">AGAINST</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.top_words.against.slice(0, 10).map(({ word, count }) => (
                          <span
                            key={word}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-500/10 border border-against-500/20 text-[11px] text-against-300"
                            title={`${count} occurrences`}
                          >
                            {word}
                            <span className="font-mono text-against-500/60 text-[9px]">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Top arguments ──────────────────────────────────────────── */}
              {(data.top_for || data.top_against) && (
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4 text-purple" />
                    <h2 className="text-sm font-semibold text-white">Top Argument Per Side</h2>
                    <span className="ml-auto text-[11px] text-surface-500">by upvotes</span>
                  </div>

                  <div className="space-y-3">
                    {data.top_for && (
                      <div className="rounded-lg border border-for-500/20 bg-for-500/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                          <span className="text-[11px] font-semibold text-for-400">Top FOR argument</span>
                          {data.top_for.grade && (
                            <span className={cn('ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono font-bold', GRADE_COLOR[data.top_for.grade])}>
                              {data.top_for.grade}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-for-500/70">{data.top_for.upvotes} ▲</span>
                        </div>
                        <p className="text-[12px] text-surface-300 leading-relaxed line-clamp-4">
                          {data.top_for.content}
                        </p>
                      </div>
                    )}
                    {data.top_against && (
                      <div className="rounded-lg border border-against-500/20 bg-against-500/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                          <span className="text-[11px] font-semibold text-against-400">Top AGAINST argument</span>
                          {data.top_against.grade && (
                            <span className={cn('ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono font-bold', GRADE_COLOR[data.top_against.grade])}>
                              {data.top_against.grade}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-against-500/70">{data.top_against.upvotes} ▲</span>
                        </div>
                        <p className="text-[12px] text-surface-300 leading-relaxed line-clamp-4">
                          {data.top_against.content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Empty state ─────────────────────────────────────────────── */}
              {totalArgs === 0 && (
                <EmptyState
                  icon={<MessageSquare className="h-8 w-8" />}
                  title="No arguments yet"
                  description="Be the first to argue this market. Your argument will shape the anatomy."
                  action={{ label: 'Add argument', href: `/topic/${id}` }}
                />
              )}

              {/* ── Footer links ────────────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-2">
                <Link
                  href={`/exchange/${id}/arguments`}
                  className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Browse all arguments
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <button
                  onClick={load}
                  className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
