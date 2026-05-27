'use client'

/**
 * /analytics/diversity — Civic Diversity Score
 *
 * Measures how broad, balanced, and independent your civic engagement is:
 *  • Breadth     — how many of the 10 civic categories you vote in
 *  • Balance     — whether your votes are spread evenly across categories
 *  • Independence— how often you vote against the majority consensus
 *
 * Inspired by information-theoretic diversity metrics (Shannon entropy).
 * A high score means you're a genuine Civic Polymath; a low score may
 * indicate an echo chamber or hyper-specialisation.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
  Globe,
  Info,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DiversityData, BroadenSuggestion } from '@/app/api/analytics/diversity/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   '#c9a84c',
  Politics:    '#3b82f6',
  Technology:  '#8b5cf6',
  Science:     '#10b981',
  Ethics:      '#ef4444',
  Philosophy:  '#a78bfa',
  Culture:     '#f59e0b',
  Health:      '#ec4899',
  Environment: '#22c55e',
  Education:   '#06b6d4',
}

const GRADE_META: Record<string, { color: string; bg: string; border: string }> = {
  'Echo Chamber': { color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  'Leaning':      { color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  'Balanced':     { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  'Curious':      { color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  'Free Thinker': { color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const cx = size / 2
  const cy = size / 2

  const color =
    score >= 80 ? '#8b5cf6' :
    score >= 60 ? '#10b981' :
    score >= 40 ? '#3b82f6' :
    score >= 20 ? '#c9a84c' : '#ef4444'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2028" strokeWidth={10} />
      <motion.circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - filled }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  )
}

// ─── Sub-score bar ────────────────────────────────────────────────────────────

function SubScoreBar({
  label,
  score,
  maxScore,
  textColor,
  barColor,
  icon: Icon,
  description,
}: {
  label: string
  score: number
  maxScore: number
  textColor: string
  barColor: string
  icon: typeof Target
  description: string
}) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 flex-shrink-0', textColor)} aria-hidden />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wide flex-1">{label}</span>
        <span className={cn('text-lg font-bold font-mono', textColor)}>
          {score}
          <span className="text-xs text-surface-500 font-normal">/{maxScore}</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
        />
      </div>
      <p className="text-xs text-surface-500 leading-relaxed">{description}</p>
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  row,
  maxCount,
  index,
}: {
  row: DiversityData['byCategory'][number]
  maxCount: number
  index: number
}) {
  const barWidth = maxCount > 0 ? (row.count / maxCount) * 100 : 0
  const color = CATEGORY_COLOR[row.category] ?? '#6b7280'
  const deviation = row.deviation

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white truncate">{row.category}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* FOR% vs platform */}
          <span className="text-xs font-mono text-surface-500">
            You: <span style={{ color: row.forPct >= 50 ? '#3b82f6' : '#ef4444' }}>{row.forPct}%</span>
            {' '}·{' '}
            Avg: <span className="text-surface-400">{row.platformAvgFor}%</span>
          </span>
          {deviation >= 20 && (
            <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 rounded px-1">
              +{deviation}%
            </span>
          )}
          <span className="text-xs font-mono text-surface-500 w-8 text-right">{row.pct}%</span>
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, width: `${barWidth}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 + 0.04 * index }}
        />
      </div>
      <p className="text-[11px] text-surface-600 font-mono">{row.count.toLocaleString()} votes</p>
    </motion.div>
  )
}

// ─── Broaden Card ─────────────────────────────────────────────────────────────

function BroadenCard({ topic }: { topic: BroadenSuggestion }) {
  const forPct = Math.round(topic.blue_pct)
  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
  }
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">{topic.status}</Badge>
          {topic.category && (
            <span
              className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ color: CATEGORY_COLOR[topic.category] ?? '#6b7280', background: (CATEGORY_COLOR[topic.category] ?? '#6b7280') + '1a' }}
            >
              {topic.category}
            </span>
          )}
        </div>
        <p className="text-sm text-surface-700 group-hover:text-white line-clamp-2 transition-colors leading-snug">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-surface-600">·</span>
          <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 mt-1 transition-colors" aria-hidden />
    </Link>
  )
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-3">
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        {[0,1,2,3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiversityPage() {
  const router = useRouter()
  const [data, setData] = useState<DiversityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/diversity', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const json = await res.json() as DiversityData
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const gradeMeta = data ? (GRADE_META[data.label] ?? GRADE_META['Balanced']) : GRADE_META['Balanced']

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Back to analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple" aria-hidden />
              Civic Diversity
            </h1>
            <p className="text-xs text-surface-500 font-mono">
              How broad, balanced, and independent is your civic engagement?
            </p>
          </div>
        </div>

        {loading && <PageSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={Scale}
            title="Could not load diversity data"
            description="Please try again in a moment."
            actions={[{ label: 'Retry', onClick: load }]}
          />
        )}

        {!loading && data && data.totalVotes === 0 && (
          <EmptyState
            icon={Globe}
            title="No votes yet"
            description="Vote on topics across different categories to generate your Civic Diversity Score."
            actions={[{ label: 'Go to Feed', href: '/' }]}
          />
        )}

        {!loading && data && data.totalVotes > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >

              {/* ── Score hero ────────────────────────────────────────────── */}
              <div className={cn(
                'rounded-2xl border p-6 flex flex-col items-center gap-3',
                gradeMeta.bg, gradeMeta.border,
              )}>
                <div className="relative flex items-center justify-center">
                  <ScoreRing score={data.diversityScore} size={128} />
                  <div className="absolute flex flex-col items-center leading-none">
                    <span className={cn('text-3xl font-black font-mono', gradeMeta.color)}>
                      {data.diversityScore}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mt-0.5">/ 100</span>
                  </div>
                </div>

                <div className={cn(
                  'px-4 py-1.5 rounded-full border text-sm font-bold font-mono',
                  gradeMeta.color, gradeMeta.bg, gradeMeta.border,
                )}>
                  {data.label}
                </div>

                <p className="text-sm text-surface-400 text-center max-w-xs leading-relaxed">
                  {data.labelDesc}
                </p>

                {/* Platform comparison */}
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 bg-surface-200/60 px-3 py-1.5 rounded-lg border border-surface-300">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Platform avg: <span className="text-white font-semibold">{data.platformAvgDiversity}</span>
                  {data.diversityScore > data.platformAvgDiversity ? (
                    <span className="text-emerald">+{data.diversityScore - data.platformAvgDiversity} above avg</span>
                  ) : data.diversityScore < data.platformAvgDiversity ? (
                    <span className="text-against-400">{data.diversityScore - data.platformAvgDiversity} below avg</span>
                  ) : (
                    <span className="text-surface-400">at avg</span>
                  )}
                </div>
              </div>

              {/* ── Sub-scores ────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SubScoreBar
                  label="Breadth"
                  score={data.categoryScore}
                  maxScore={40}
                  textColor="text-for-400"
                  barColor="bg-for-500"
                  icon={Globe}
                  description={`${data.categoriesVoted} of 10 civic categories engaged`}
                />
                <SubScoreBar
                  label="Balance"
                  score={data.balanceScore}
                  maxScore={30}
                  textColor="text-emerald"
                  barColor="bg-emerald"
                  icon={Scale}
                  description="How evenly distributed across categories"
                />
                <SubScoreBar
                  label="Independence"
                  score={data.independenceScore}
                  maxScore={30}
                  textColor="text-purple"
                  barColor="bg-purple"
                  icon={Brain}
                  description={`${data.contrarian_rate}% of votes differ from majority`}
                />
              </div>

              {/* ── Quick stats ────────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Votes', value: data.totalVotes.toLocaleString(), icon: Zap, color: 'text-gold' },
                  { label: 'Categories', value: `${data.categoriesVoted}/10`, icon: BarChart2, color: 'text-for-400' },
                  { label: 'Contrarian', value: `${data.contrarian_rate}%`, icon: ShieldCheck, color: 'text-purple' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
                      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
                    </div>
                    <span className={cn('text-xl font-bold font-mono', color)}>{value}</span>
                  </div>
                ))}
              </div>

              {/* ── Category breakdown ───────────────────────────────────── */}
              {data.byCategory.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-surface-400" aria-hidden />
                      Category Breakdown
                    </h2>
                    <span className="text-xs font-mono text-surface-500">You vs Platform Avg</span>
                  </div>

                  <div className="space-y-4">
                    {data.byCategory.map((row, i) => (
                      <CategoryRow
                        key={row.category}
                        row={row}
                        maxCount={data.byCategory[0]?.count ?? 1}
                        index={i}
                      />
                    ))}
                  </div>

                  {data.topCategory && (
                    <div className="pt-1 border-t border-surface-300 flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-mono text-surface-500">
                      <span>
                        Most active in:{' '}
                        <span className="text-white font-semibold">{data.topCategory}</span>
                      </span>
                      {data.leastVotedCategory && (
                        <>
                          <span className="hidden sm:inline text-surface-600">·</span>
                          <span>
                            Least active in:{' '}
                            <span className="text-surface-400">{data.leastVotedCategory}</span>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* ── Opinion independence note ─────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex gap-3">
                <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">About Independence</p>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Contrarian rate measures how often you vote against the current majority.
                    An optimal range is 20–70%: too low suggests conformity, too high suggests reflexive opposition.
                    Your rate of <span className="text-white font-semibold">{data.contrarian_rate}%</span> is{' '}
                    {data.contrarian_rate < 20 ? 'on the conformist side' :
                     data.contrarian_rate > 70 ? 'on the contrarian side' :
                     'in the healthy range'}.
                  </p>
                </div>
              </div>

              {/* ── Broaden suggestions ───────────────────────────────────── */}
              {data.broadenSuggestions.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden />
                    Broaden Your Civic Diet
                  </h2>
                  <p className="text-xs text-surface-500 font-mono">
                    Topics in categories you haven&apos;t explored much — voting on these will raise your breadth score.
                  </p>
                  <div className="space-y-2">
                    {data.broadenSuggestions.map((topic) => (
                      <BroadenCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Navigation links ─────────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                {[
                  { href: '/analytics/votes', label: 'Voting Analytics', icon: Zap },
                  { href: '/analytics/calibration', label: 'Prediction Calibration', icon: Target },
                  { href: '/analytics/contrarian', label: 'Contrarian Insights', icon: Brain },
                  { href: '/analytics', label: 'All Analytics', icon: BarChart2 },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
                  >
                    <span className="flex items-center gap-2 text-sm text-surface-500 group-hover:text-white transition-colors">
                      <Icon className="h-4 w-4" aria-hidden />
                      {label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden />
                  </Link>
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
