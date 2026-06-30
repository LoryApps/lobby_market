'use client'

/**
 * /topic/[id]/anatomy — Argument Anatomy
 *
 * Structural analysis of how a debate is argued:
 *   • FOR vs AGAINST argument counts and quality comparison
 *   • Length distribution (short / medium / long)
 *   • AI grade distribution (A–F curve)
 *   • Citation rates — who backs their claims with sources
 *   • Upvote and reply engagement patterns
 *   • Top words used by each side
 *
 * Distinct from:
 *   /topic/[id]/themes     — WHAT topics are being argued (clusters by subject)
 *   /topic/[id]/quality    — per-argument quality scores and ranking
 *   /topic/[id]/impact     — which arguments had the most reach/engagement
 *   /topic/[id]/versus     — the single strongest case on each side
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
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
import { Badge } from '@/components/ui/Badge'
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

function BarRow({
  label,
  value,
  max,
  barClass,
  suffix = '',
}: {
  label: string
  value: number
  max: number
  barClass: string
  suffix?: string
}) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono text-surface-400 w-16 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barClass)}
          initial={{ width: 0 }}
          animate={{ width: `${w}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[11px] font-mono text-surface-400 w-10 text-right flex-shrink-0">
        {value}{suffix}
      </span>
    </div>
  )
}

function StatCard({
  label,
  forVal,
  againstVal,
  icon: Icon,
  suffix = '',
  highlightFor,
}: {
  label: string
  forVal: string | number
  againstVal: string | number
  icon: typeof TrendingUp
  suffix?: string
  highlightFor?: boolean
}) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="h-3.5 w-3.5 text-surface-500" />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={cn('rounded-lg p-2 text-center', highlightFor === true ? 'bg-for-500/20' : 'bg-surface-200')}>
          <div className="text-xs font-mono text-for-400 mb-0.5">FOR</div>
          <div className="text-lg font-bold text-white leading-tight">
            {forVal}{suffix}
          </div>
        </div>
        <div className={cn('rounded-lg p-2 text-center', highlightFor === false ? 'bg-against-500/20' : 'bg-surface-200')}>
          <div className="text-xs font-mono text-against-400 mb-0.5">AGAINST</div>
          <div className="text-lg font-bold text-white leading-tight">
            {againstVal}{suffix}
          </div>
        </div>
      </div>
    </div>
  )
}

function GradeSection({
  title,
  dist,
  total,
  sideClass,
}: {
  title: string
  dist: AnatomyData['grade_dist']['for']
  total: number
  sideClass: string
}) {
  const grades: Array<keyof typeof dist> = ['A', 'B', 'C', 'D', 'F', 'ungraded']
  const maxVal = Math.max(...grades.map((g) => dist[g]))

  return (
    <div className="flex-1 min-w-0">
      <div className={cn('text-[11px] font-mono uppercase tracking-wide mb-3', sideClass)}>
        {title}
      </div>
      <div className="space-y-2">
        {grades.map((grade) => (
          <BarRow
            key={grade}
            label={grade === 'ungraded' ? '—' : grade}
            value={dist[grade]}
            max={maxVal || 1}
            barClass={GRADE_BAR[grade]}
          />
        ))}
      </div>
      <div className="mt-2 text-[10px] font-mono text-surface-500">
        {total} argument{total !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

function LengthSection({
  title,
  dist,
  total,
  sideClass,
}: {
  title: string
  dist: AnatomyData['length_dist']['for']
  total: number
  sideClass: string
}) {
  const total3 = dist.short + dist.medium + dist.long || 1
  return (
    <div className="flex-1 min-w-0">
      <div className={cn('text-[11px] font-mono uppercase tracking-wide mb-3', sideClass)}>
        {title}
      </div>
      <div className="space-y-2">
        {(['short', 'medium', 'long'] as const).map((bucket) => (
          <div key={bucket} className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-400 w-14 text-right">{bucket}</span>
            <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', LENGTH_COLOR[bucket])}
                initial={{ width: 0 }}
                animate={{ width: `${pct(dist[bucket], total3)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[11px] font-mono text-surface-400 w-9 text-right">
              {pct(dist[bucket], total3)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] font-mono text-surface-500">
        {total} total
      </div>
    </div>
  )
}

function WordCloud({
  words,
  badgeBase,
}: {
  words: AnatomyData['top_words']['for']
  badgeBase: string
}) {
  if (!words.length) return <p className="text-xs text-surface-500 italic">No words yet</p>
  const maxCount = words[0]?.count ?? 1
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map(({ word, count }) => {
        const opacity = 0.3 + (count / maxCount) * 0.7
        const size = count >= maxCount * 0.7 ? 'text-sm' : count >= maxCount * 0.4 ? 'text-xs' : 'text-[11px]'
        return (
          <span
            key={word}
            className={cn('px-2 py-0.5 rounded-full font-mono border', badgeBase, size)}
            style={{ opacity }}
            title={`${count} occurrence${count !== 1 ? 's' : ''}`}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto px-4 py-6 pb-24">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-2 gap-3 mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2, 3].map((j) => (
            <div key={j} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-2.5 w-8" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnatomyClient({ topicId }: { topicId: string }) {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? topicId

  const [data, setData] = useState<AnatomyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/anatomy`)
      if (!res.ok) throw new Error('Failed to load anatomy data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const forPct = data ? Math.round(data.blue_pct) : 50
  const againstPct = 100 - forPct

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

          {/* Back link */}
          <Link
            href={`/topic/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-4 w-4 text-purple" />
              <h1 className="text-base font-bold text-white">Argument Anatomy</h1>
              {data?.category && (
                <Badge variant="outline" className="text-[10px] font-mono">{data.category}</Badge>
              )}
            </div>
            {data && (
              <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">
                {data.topic_statement}
              </p>
            )}
            {data && (
              <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-surface-500">
                <span className="text-for-400">{forPct}% FOR</span>
                <span className="text-surface-600">·</span>
                <span className="text-against-400">{againstPct}% AGAINST</span>
                <span className="text-surface-600">·</span>
                <span>{data.total_votes.toLocaleString()} votes</span>
                <span className="text-surface-600">·</span>
                <span>{data.total_arguments} arguments</span>
              </div>
            )}
          </div>

          {loading && <PageSkeleton />}

          {error && (
            <EmptyState
              icon={FileText}
              title="Failed to load"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          )}

          {data && !loading && data.total_arguments === 0 && (
            <EmptyState
              icon={MessageSquare}
              title="No arguments yet"
              description="Be the first to argue this debate — then come back to see the anatomy."
              action={{ label: 'View debate', href: `/topic/${id}` }}
            />
          )}

          {data && !loading && data.total_arguments > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* ── Overview stat cards ───────────────────────────────── */}
                <section>
                  <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-3">
                    Overview
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="Arguments"
                      forVal={data.for_count}
                      againstVal={data.against_count}
                      icon={MessageSquare}
                      highlightFor={data.for_count > data.against_count}
                    />
                    <StatCard
                      label="Avg upvotes"
                      forVal={data.upvote_stats.for.avg ?? '—'}
                      againstVal={data.upvote_stats.against.avg ?? '—'}
                      icon={ThumbsUp}
                      highlightFor={
                        data.upvote_stats.for.avg !== null &&
                        data.upvote_stats.against.avg !== null &&
                        data.upvote_stats.for.avg > data.upvote_stats.against.avg
                      }
                    />
                    <StatCard
                      label="Avg quality"
                      forVal={data.ai_score_stats.for.avg ?? '—'}
                      againstVal={data.ai_score_stats.against.avg ?? '—'}
                      icon={Brain}
                      highlightFor={
                        data.ai_score_stats.for.avg !== null &&
                        data.ai_score_stats.against.avg !== null &&
                        data.ai_score_stats.for.avg > data.ai_score_stats.against.avg
                      }
                    />
                    <StatCard
                      label="Citation rate"
                      forVal={data.citation_rate.for}
                      againstVal={data.citation_rate.against}
                      icon={BookMarked}
                      suffix="%"
                      highlightFor={data.citation_rate.for > data.citation_rate.against}
                    />
                  </div>
                </section>

                {/* ── Reply engagement ─────────────────────────────────── */}
                <section className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-4">
                    <MessageSquare className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                      Reply Engagement
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-mono text-for-400 mb-2">FOR</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-surface-500">Avg replies</span>
                          <span className="text-white">{data.reply_stats.for.avg}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-surface-500">Max replies</span>
                          <span className="text-white">{data.reply_stats.for.max}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-surface-500">Top upvotes</span>
                          <span className="text-white">{data.upvote_stats.for.max ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-mono text-against-400 mb-2">AGAINST</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-surface-500">Avg replies</span>
                          <span className="text-white">{data.reply_stats.against.avg}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-surface-500">Max replies</span>
                          <span className="text-white">{data.reply_stats.against.max}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-surface-500">Top upvotes</span>
                          <span className="text-white">{data.upvote_stats.against.max ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── Grade distributions ───────────────────────────────── */}
                <section className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-4">
                    <Zap className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                      AI Grade Distribution
                    </h2>
                  </div>
                  <div className="flex gap-6">
                    <GradeSection
                      title="FOR"
                      dist={data.grade_dist.for}
                      total={data.for_count}
                      sideClass="text-for-400"
                    />
                    <div className="w-px bg-surface-300 flex-shrink-0" />
                    <GradeSection
                      title="AGAINST"
                      dist={data.grade_dist.against}
                      total={data.against_count}
                      sideClass="text-against-400"
                    />
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 mt-3">
                    Grades reflect AI-assessed clarity, evidence quality, and logical coherence
                  </p>
                </section>

                {/* ── Length distributions ──────────────────────────────── */}
                <section className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-4">
                    <Type className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                      Argument Length
                    </h2>
                  </div>
                  <div className="flex gap-6">
                    <LengthSection
                      title="FOR"
                      dist={data.length_dist.for}
                      total={data.for_count}
                      sideClass="text-for-400"
                    />
                    <div className="w-px bg-surface-300 flex-shrink-0" />
                    <LengthSection
                      title="AGAINST"
                      dist={data.length_dist.against}
                      total={data.against_count}
                      sideClass="text-against-400"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-mono text-surface-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-for-500" />
                      Short &lt;50 words
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-gold" />
                      Medium 50–149
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-purple" />
                      Long 150+
                    </span>
                  </div>
                </section>

                {/* ── Top words ─────────────────────────────────────────── */}
                <section className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-4">
                    <TrendingUp className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                      Frequent Words
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-mono text-for-400 mb-2">FOR side uses</p>
                      <WordCloud
                        words={data.top_words.for}
                        badgeBase="border-for-500/30 text-for-300 bg-for-500/5"
                      />
                    </div>
                    <div className="h-px bg-surface-300" />
                    <div>
                      <p className="text-[11px] font-mono text-against-400 mb-2">AGAINST side uses</p>
                      <WordCloud
                        words={data.top_words.against}
                        badgeBase="border-against-500/30 text-against-300 bg-against-500/5"
                      />
                    </div>
                  </div>
                </section>

                {/* ── Top arguments ──────────────────────────────────────── */}
                {(data.top_for || data.top_against) && (
                  <section>
                    <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-3">
                      Most Upvoted
                    </h2>
                    <div className="space-y-3">
                      {data.top_for && (
                        <div className="bg-for-500/5 border border-for-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                              <span className="text-[11px] font-mono text-for-400">TOP FOR</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {data.top_for.grade && (
                                <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', GRADE_COLOR[data.top_for.grade])}>
                                  {data.top_for.grade}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-surface-500">
                                {data.top_for.upvotes} ↑
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-surface-200 leading-relaxed line-clamp-4">
                            {data.top_for.content}
                          </p>
                        </div>
                      )}
                      {data.top_against && (
                        <div className="bg-against-500/5 border border-against-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                              <span className="text-[11px] font-mono text-against-400">TOP AGAINST</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {data.top_against.grade && (
                                <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', GRADE_COLOR[data.top_against.grade])}>
                                  {data.top_against.grade}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-surface-500">
                                {data.top_against.upvotes} ↑
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-surface-200 leading-relaxed line-clamp-4">
                            {data.top_against.content}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* ── Nav links ──────────────────────────────────────────── */}
                <section className="border-t border-surface-300 pt-4">
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-3">
                    Explore further
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Arguments', href: `/topic/${id}/arguments` },
                      { label: 'Quality', href: `/topic/${id}/quality` },
                      { label: 'Impact', href: `/topic/${id}/impact` },
                      { label: 'Themes', href: `/topic/${id}/themes` },
                      { label: 'Versus', href: `/topic/${id}/versus` },
                    ].map(({ label, href }) => (
                      <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {label}
                      </Link>
                    ))}
                  </div>
                </section>

                {/* Reload */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={load}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
