'use client'

/**
 * /diversity — Civic Diversity Score
 *
 * An echo-chamber detector for civic engagement. Measures three dimensions:
 *   Category Coverage  — how many of the 10 civic domains you vote in
 *   Category Balance   — how evenly distributed your votes are (Shannon entropy)
 *   Position Independence — how often you vote against the current majority
 *
 * The composite score labels you as Echo Chamber → Leaning → Balanced →
 * Curious → Free Thinker, with suggestions to broaden your civic diet.
 *
 * Distinct from:
 *   /fingerprint      — which categories you deviate from in raw vote %
 *   /perspective      — AI tool that shows the other side of one argument
 *   /compass          — political compass / ideology placement
 *   /analytics/calibration — accuracy and majority-bias score
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  Compass,
  Globe,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DiversityData, CategoryDiversityRow, BroadenSuggestion } from '@/app/api/analytics/diversity/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

const CATEGORY_BG: Record<string, string> = {
  Economics: 'bg-gold/10',
  Politics: 'bg-for-500/10',
  Technology: 'bg-purple/10',
  Science: 'bg-emerald/10',
  Ethics: 'bg-against-500/10',
  Philosophy: 'bg-purple/10',
  Culture: 'bg-gold/10',
  Health: 'bg-emerald/10',
  Environment: 'bg-emerald/10',
  Education: 'bg-for-500/10',
}

const CATEGORY_BAR: Record<string, string> = {
  Economics: 'bg-gold',
  Politics: 'bg-for-500',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-500',
  Philosophy: 'bg-purple',
  Culture: 'bg-gold',
  Health: 'bg-emerald',
  Environment: 'bg-emerald',
  Education: 'bg-for-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 160,
  strokeWidth = 14,
  label,
  color = 'stroke-for-500',
}: {
  score: number
  size?: number
  strokeWidth?: number
  label: string
  color?: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-surface-300"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-black text-white tabular-nums"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  )
}

function SubScorePill({
  label,
  score,
  max,
  color,
}: {
  label: string
  score: number
  max: number
  color: string
}) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
        <span className={cn('text-xs font-bold', color)}>{score}<span className="text-surface-600">/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

function CategoryCoverageGrid({
  byCategory,
}: {
  byCategory: CategoryDiversityRow[]
}) {
  const votedSet = new Set(byCategory.map((c) => c.category))
  const catMap = new Map(byCategory.map((c) => [c.category, c]))

  return (
    <div className="grid grid-cols-5 gap-2">
      {ALL_CATEGORIES.map((cat) => {
        const row = catMap.get(cat)
        const voted = votedSet.has(cat)
        return (
          <div
            key={cat}
            className={cn(
              'rounded-xl p-2.5 text-center border transition-all',
              voted
                ? `${CATEGORY_BG[cat] ?? 'bg-surface-200'} border-surface-400/50`
                : 'bg-surface-200/30 border-surface-300/30 opacity-40'
            )}
          >
            <div className={cn('text-[10px] font-mono font-semibold truncate', voted ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-600')}>
              {cat.slice(0, 4)}
            </div>
            {voted && row && (
              <div className="text-[9px] text-surface-500 mt-0.5">
                {row.count}v
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CategoryBar({ row }: { row: CategoryDiversityRow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-xs font-semibold truncate', CATEGORY_COLORS[row.category] ?? 'text-surface-500')}>
            {row.category}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-[11px] font-mono text-surface-500">
          <span className="text-white">{row.count}v</span>
          <span>{row.pct}%</span>
          <span className={row.forPct >= 50 ? 'text-for-400' : 'text-against-400'}>
            {row.forPct}% For
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', CATEGORY_BAR[row.category] ?? 'bg-surface-400')}
          initial={{ width: 0 }}
          animate={{ width: `${row.pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function BroadenCard({ topic }: { topic: BroadenSuggestion }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex flex-col gap-2.5 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0',
          CATEGORY_COLORS[topic.category] ?? 'text-surface-500',
          (CATEGORY_BG[topic.category] ?? 'bg-surface-200'),
          'border-surface-400/40'
        )}>
          {topic.category}
        </span>
        <p className="text-xs font-medium text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-2">
          {topic.statement}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
        <ThumbsUp className="h-2.5 w-2.5 text-for-400" /><span>{forPct}%</span>
        <ThumbsDown className="h-2.5 w-2.5 text-against-400 ml-2" /><span>{againstPct}%</span>
        <span className="ml-auto">{topic.total_votes.toLocaleString()} votes</span>
        <ArrowRight className="h-3 w-3 text-surface-500 group-hover:text-white transition-colors" />
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiversityPage() {
  const router = useRouter()
  const [data, setData] = useState<DiversityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/diversity', { cache: 'no-store' })
      if (res.status === 401) { setAuthed(false); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Failed to load diversity data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const scoreColor = (score: number) => {
    if (score < 20) return 'stroke-against-500'
    if (score < 40) return 'stroke-gold'
    if (score < 60) return 'stroke-for-500'
    if (score < 80) return 'stroke-emerald'
    return 'stroke-purple'
  }

  if (!authed) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={Globe}
            title="Sign in to see your diversity score"
            description="Your civic diversity profile requires you to be logged in."
            action={{ label: 'Sign in', href: '/login' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-surface-200 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald" />
                Civic Diversity Score
              </h1>
              <p className="text-xs text-surface-500 mt-0.5">
                How broad and independent is your civic diet?
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="ml-auto p-2 rounded-lg hover:bg-surface-200 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-against-900/30 border border-against-700/40 p-4 text-xs text-against-300">
              {error}
            </div>
          )}

          {loading ? (
            <DiversitySkeleton />
          ) : !data || data.totalVotes === 0 ? (
            <EmptyState
              icon={Globe}
              title="No votes yet"
              description="Vote on at least a few topics to generate your civic diversity profile."
              action={{ label: 'Browse topics', href: '/' }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                {/* Score ring + label */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ScoreRing
                      score={data.diversityScore}
                      label="Diversity"
                      color={scoreColor(data.diversityScore)}
                    />
                    <div className="flex-1 space-y-4 text-center sm:text-left">
                      <div>
                        <div className={cn('text-2xl font-black', data.labelColor)}>
                          {data.label}
                        </div>
                        <p className="text-sm text-surface-500 mt-1 leading-relaxed">
                          {data.labelDesc}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-surface-500 justify-center sm:justify-start">
                        <BarChart2 className="h-3.5 w-3.5" />
                        <span>
                          Platform average: <span className="text-white font-semibold">{data.platformAvgDiversity}</span> / 100
                        </span>
                        {data.diversityScore > data.platformAvgDiversity ? (
                          <span className="text-emerald flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {data.diversityScore - data.platformAvgDiversity}pts above avg
                          </span>
                        ) : data.diversityScore < data.platformAvgDiversity ? (
                          <span className="text-against-400 flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {data.platformAvgDiversity - data.diversityScore}pts below avg
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-scores */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Layers className="h-4 w-4 text-for-400" />
                    Score Breakdown
                  </div>
                  <div className="space-y-4">
                    <SubScorePill
                      label="Category Coverage"
                      score={data.categoryScore}
                      max={40}
                      color="text-for-400"
                    />
                    <div className="text-[11px] text-surface-500 -mt-2">
                      You&apos;ve voted in <span className="text-white font-semibold">{data.categoriesVoted}</span> of 10 civic categories.
                    </div>
                    <SubScorePill
                      label="Category Balance"
                      score={data.balanceScore}
                      max={30}
                      color="text-emerald"
                    />
                    <div className="text-[11px] text-surface-500 -mt-2">
                      How evenly your votes are distributed across categories.
                    </div>
                    <SubScorePill
                      label="Position Independence"
                      score={data.independenceScore}
                      max={30}
                      color="text-purple"
                    />
                    <div className="text-[11px] text-surface-500 -mt-2">
                      You vote against the current majority{' '}
                      <span className="text-white font-semibold">{data.contrarian_rate}%</span> of the time.
                      {data.contrarian_rate < 15 && ' Voting with the crowd reduces your independence score.'}
                      {data.contrarian_rate > 80 && ' Reflexively opposing the majority also reduces this score.'}
                    </div>
                  </div>
                </div>

                {/* Category coverage grid */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Globe className="h-4 w-4 text-emerald" />
                    Category Coverage
                    <span className="ml-auto text-xs font-normal text-surface-500">
                      {data.categoriesVoted}/10 domains
                    </span>
                  </div>
                  <CategoryCoverageGrid byCategory={data.byCategory} />
                </div>

                {/* Per-category bars */}
                {data.byCategory.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <BarChart2 className="h-4 w-4 text-for-400" />
                      Your Vote Distribution
                    </div>
                    <div className="space-y-3">
                      {data.byCategory.map((row) => (
                        <CategoryBar key={row.category} row={row} />
                      ))}
                    </div>
                    {data.topCategory && (
                      <div className="text-[11px] text-surface-500 pt-1 border-t border-surface-300">
                        Your most engaged category:{' '}
                        <span className={cn('font-semibold', CATEGORY_COLORS[data.topCategory] ?? 'text-white')}>
                          {data.topCategory}
                        </span>
                        {data.leastVotedCategory && (
                          <>
                            {' '}· Least engaged:{' '}
                            <span className="font-semibold text-surface-500">{data.leastVotedCategory}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Independence insight */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Scale className="h-4 w-4 text-purple" />
                    Position Independence
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center p-3 rounded-xl bg-surface-200 border border-surface-300">
                      <div className={cn('text-2xl font-black tabular-nums',
                        data.contrarian_rate >= 25 && data.contrarian_rate <= 65 ? 'text-emerald' :
                        data.contrarian_rate < 15 || data.contrarian_rate > 80 ? 'text-against-400' : 'text-gold'
                      )}>
                        {data.contrarian_rate}%
                      </div>
                      <div className="text-[10px] font-mono text-surface-500 mt-0.5 uppercase tracking-wide">
                        Independent votes
                      </div>
                    </div>
                    <div className="flex-1 text-xs text-surface-500 leading-relaxed">
                      {data.contrarian_rate < 15
                        ? 'You tend to vote with the majority. This can indicate an echo chamber — try exploring topics where you might disagree.'
                        : data.contrarian_rate > 80
                        ? "You frequently oppose the majority. This may reflect strong independent views, but watch for reflexive contrarianism."
                        : data.contrarian_rate >= 25 && data.contrarian_rate <= 65
                        ? 'Healthy range. You form your own views while remaining open to popular consensus.'
                        : 'Slightly outside the optimal range. A mix of aligned and independent votes is healthy.'}
                    </div>
                  </div>
                  <p className="text-[10px] text-surface-600 border-t border-surface-300 pt-2">
                    Measured as how often your vote is on the minority side at the time of casting.
                    The optimal range for civic independence is 25–65%.
                  </p>
                </div>

                {/* Broaden suggestions */}
                {data.broadenSuggestions.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <Sparkles className="h-4 w-4 text-gold" />
                      Broaden Your Civic Diet
                    </div>
                    <p className="text-xs text-surface-500">
                      Topics from categories you rarely engage with — voting on these will boost your diversity score.
                    </p>
                    <div className="space-y-3">
                      {data.broadenSuggestions.map((topic) => (
                        <BroadenCard key={topic.id} topic={topic} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Related links */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">
                    Related Analytics
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: '/fingerprint', label: 'Fingerprint', icon: BarChart2, color: 'text-against-400' },
                      { href: '/compass', label: 'Compass', icon: Compass, color: 'text-purple' },
                      { href: '/perspective', label: 'Perspective', icon: Brain, color: 'text-emerald' },
                      { href: '/analytics/calibration', label: 'Calibration', icon: Scale, color: 'text-for-400' },
                    ].map(({ href, label, icon: Icon, color }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                      >
                        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                        <span className="text-xs text-surface-600 group-hover:text-white transition-colors font-medium">
                          {label}
                        </span>
                        <ArrowRight className="h-3 w-3 ml-auto text-surface-600 group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DiversitySkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Skeleton className="h-40 w-40 rounded-full" />
          <div className="flex-1 space-y-3 w-full">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <Skeleton className="h-5 w-36" />
        {[40, 30, 30].map((max, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
