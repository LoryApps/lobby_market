'use client'

/**
 * /prescient — Vote Alignment Intelligence
 *
 * Analyses the current user's full voting history against current platform
 * consensus to reveal their alignment profile:
 *   - Overall alignment rate (% of votes matching current majority)
 *   - Contrarian index (how often they buck the consensus)
 *   - Outcome accuracy (for concluded debates: law / failed)
 *   - Category-by-category breakdown
 *   - Their most notable prescient or contrarian votes
 *
 * Distinct from:
 *  - /karma      (holistic credit score across 5 dimensions)
 *  - /analytics  (raw vote/argument statistics)
 *  - /report-card (letter grades)
 *  - /compass    (ideological position map)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Gavel,
  RefreshCw,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PrescientData, CategoryAlignment, PrescientVote } from '@/app/api/prescient/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alignmentColor(pct: number): string {
  if (pct >= 75) return 'text-emerald'
  if (pct >= 55) return 'text-for-400'
  if (pct >= 40) return 'text-surface-300'
  return 'text-against-400'
}

function alignmentBarColor(pct: number): string {
  if (pct >= 75) return 'bg-emerald'
  if (pct >= 55) return 'bg-for-500'
  if (pct >= 40) return 'bg-surface-400'
  return 'bg-against-500'
}

function contraryColor(pct: number): string {
  if (pct >= 60) return 'text-against-400'
  if (pct >= 40) return 'text-surface-300'
  return 'text-for-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1 bg-surface-200 rounded-2xl p-4 border border-surface-300"
    >
      <div className="flex items-center gap-2 text-surface-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-2xl font-bold font-mono', accent ?? 'text-white')}>{value}</div>
      {sub && <div className="text-xs text-surface-500 font-mono">{sub}</div>}
    </motion.div>
  )
}

function CategoryRow({ cat }: { cat: CategoryAlignment }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-surface-300 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-mono font-medium text-white truncate">{cat.category}</span>
            <div className="flex items-center gap-2 shrink-0">
              {cat.contrarian && (
                <Badge variant="against" size="sm">Contrarian</Badge>
              )}
              <span className={cn('text-sm font-mono font-bold', alignmentColor(cat.alignmentPct))}>
                {cat.alignmentPct}%
              </span>
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', alignmentBarColor(cat.alignmentPct))}
              style={{ width: `${cat.alignmentPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-surface-500 font-mono">{cat.totalVotes} votes</span>
            {cat.outcomePct !== null && (
              <span className="text-xs text-surface-500 font-mono">
                {cat.outcomePct}% outcome accuracy
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-surface-500 transition-transform shrink-0', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-surface-300 bg-surface-200/30 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold font-mono text-white">{cat.alignedVotes}</div>
                  <div className="text-[11px] text-surface-500 font-mono">Aligned</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-white">{cat.totalVotes - cat.alignedVotes}</div>
                  <div className="text-[11px] text-surface-500 font-mono">Contrarian</div>
                </div>
                {cat.outcomePct !== null ? (
                  <div>
                    <div className={cn('text-lg font-bold font-mono', cat.outcomePct >= 60 ? 'text-emerald' : 'text-against-400')}>
                      {cat.outcomePct}%
                    </div>
                    <div className="text-[11px] text-surface-500 font-mono">Outcomes</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-lg font-bold font-mono text-surface-500">—</div>
                    <div className="text-[11px] text-surface-500 font-mono">No outcomes</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function VoteRow({ vote }: { vote: PrescientVote }) {
  const isFor = vote.side === 'blue'
  const isCompleted = vote.finalStatus === 'law' || vote.finalStatus === 'failed'

  return (
    <Link
      href={`/topic/${vote.topicId}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-200/50 transition-colors border-b border-surface-300/50 last:border-0"
    >
      <div className={cn(
        'mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center',
        isFor ? 'bg-for-900/50 text-for-400' : 'bg-against-900/50 text-against-400'
      )}>
        {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 leading-snug line-clamp-2">{vote.statement}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {vote.category && (
            <span className="text-[11px] text-surface-500 font-mono">{vote.category}</span>
          )}
          <span className="text-[11px] text-surface-500 font-mono">
            {Math.round(vote.bluePct)}% FOR
          </span>
          {isCompleted && vote.isCorrectOutcome !== null && (
            <span className={cn(
              'flex items-center gap-0.5 text-[11px] font-mono font-medium',
              vote.isCorrectOutcome ? 'text-emerald' : 'text-against-400'
            )}>
              {vote.isCorrectOutcome
                ? <><Check className="h-3 w-3" /> Called it</>
                : <><X className="h-3 w-3" /> Wrong side</>
              }
            </span>
          )}
          {!isCompleted && (
            <span className={cn(
              'text-[11px] font-mono',
              vote.isAligned ? 'text-for-400' : 'text-against-400'
            )}>
              {vote.isAligned ? 'With majority' : 'Against majority'}
            </span>
          )}
        </div>
      </div>

      <ArrowRight className="h-4 w-4 text-surface-600 shrink-0 mt-0.5" />
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'categories' | 'votes'

export default function PrescientPage() {
  const [data, setData] = useState<PrescientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [voteFilter, setVoteFilter] = useState<'all' | 'aligned' | 'contrarian' | 'correct' | 'wrong'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/prescient')
      if (res.status === 404) {
        setError('no-votes')
        return
      }
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to load')
        return
      }
      setData(await res.json())
    } catch {
      setError('Failed to load alignment data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filtered votes
  const filteredVotes = data?.prescientVotes.filter((v) => {
    if (voteFilter === 'aligned') return v.isAligned
    if (voteFilter === 'contrarian') return !v.isAligned
    if (voteFilter === 'correct') return v.isCorrectOutcome === true
    if (voteFilter === 'wrong') return v.isCorrectOutcome === false
    return true
  }) ?? []

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/analytics" className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-for-400" />
              Vote Alignment Intelligence
            </h1>
            <p className="text-sm text-surface-500 font-mono mt-0.5">
              How your votes align with platform consensus
            </p>
          </div>
          {!loading && (
            <button
              onClick={load}
              className="ml-auto text-surface-500 hover:text-white transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {/* Error: no auth */}
        {!loading && error && error !== 'no-votes' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-against-400" />
            <p className="text-surface-400 font-mono text-sm">{error}</p>
            <Link
              href="/login"
              className="text-for-400 hover:text-for-300 text-sm font-mono transition-colors"
            >
              Sign in to see your alignment
            </Link>
          </div>
        )}

        {/* Error: no votes */}
        {!loading && error === 'no-votes' && (
          <EmptyState
            icon={Target}
            title="No votes yet"
            description="Cast your first vote to start tracking your alignment intelligence."
            action={{ label: 'Go to feed', href: '/' }}
          />
        )}

        {/* Data */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* Tier banner */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-surface-200 border border-surface-300 rounded-2xl p-5 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-for-500 to-against-500" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={cn('text-2xl font-bold font-mono', data.tierColor)}>
                        {data.tier}
                      </div>
                      <div className="text-sm text-surface-400 font-mono mt-0.5">{data.tierLabel}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-surface-500 font-mono">Votes analyzed</div>
                      <div className="text-xl font-bold font-mono text-white">{data.totalVotesCast}</div>
                    </div>
                  </div>
                  {data.insight && (
                    <p className="mt-4 text-sm text-surface-300 leading-relaxed border-t border-surface-300/50 pt-3">
                      {data.insight}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Tabs */}
              <div className="flex gap-1 bg-surface-200 rounded-xl p-1 border border-surface-300">
                {(['overview', 'categories', 'votes'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-mono font-medium capitalize transition-all',
                      tab === t
                        ? 'bg-surface-300 text-white'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {tab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="Alignment"
                      value={`${data.overallAlignment}%`}
                      sub="with current majority"
                      accent={alignmentColor(data.overallAlignment)}
                      icon={Users}
                    />
                    <StatCard
                      label="Contrarian"
                      value={`${data.contraryIndex}%`}
                      sub="against the grain"
                      accent={contraryColor(data.contraryIndex)}
                      icon={Swords}
                    />
                  </div>

                  {data.outcomeAccuracy !== null && (
                    <StatCard
                      label="Outcome Accuracy"
                      value={`${data.outcomeAccuracy}%`}
                      sub={`${data.correctOutcomes} of ${data.completedTopics} concluded debates`}
                      accent={data.outcomeAccuracy >= 60 ? 'text-emerald' : 'text-against-400'}
                      icon={Target}
                    />
                  )}

                  {/* Alignment gauge */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-surface-200 border border-surface-300 rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-surface-500 font-mono uppercase tracking-wider">Alignment Spectrum</span>
                      <BarChart2 className="h-4 w-4 text-surface-500" />
                    </div>
                    <div className="relative h-4 bg-surface-300 rounded-full overflow-hidden">
                      {/* Gradient background: against on left, for on right */}
                      <div className="absolute inset-0 bg-gradient-to-r from-against-800/60 via-surface-400/40 to-for-800/60" />
                      {/* Needle */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg transition-all duration-700"
                        style={{ left: `calc(${data.overallAlignment}% - 2px)` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-against-400 font-mono">Maverick</span>
                      <span className="text-xs text-surface-500 font-mono">Neutral</span>
                      <span className="text-xs text-for-400 font-mono">Consensus</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="bg-surface-300/50 rounded-xl p-2">
                        <div className="text-lg font-bold font-mono text-white">
                          {data.prescientVotes.filter((v) => v.isAligned).length}
                        </div>
                        <div className="text-[11px] text-surface-500 font-mono">With majority</div>
                      </div>
                      <div className="bg-surface-300/50 rounded-xl p-2">
                        <div className="text-lg font-bold font-mono text-white">
                          {data.prescientVotes.filter((v) => !v.isAligned).length}
                        </div>
                        <div className="text-[11px] text-surface-500 font-mono">Against majority</div>
                      </div>
                      <div className="bg-surface-300/50 rounded-xl p-2">
                        <div className="text-lg font-bold font-mono text-emerald">
                          {data.prescientVotes.filter((v) => v.isCorrectOutcome === true).length}
                        </div>
                        <div className="text-[11px] text-surface-500 font-mono">Correct calls</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Quick links to other analytics */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-surface-200 border border-surface-300 rounded-2xl p-4"
                  >
                    <div className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-3">Explore More</div>
                    <div className="space-y-1">
                      {[
                        { href: '/karma', label: 'Civic Karma Score', icon: Zap },
                        { href: '/analytics', label: 'Full Analytics', icon: BarChart2 },
                        { href: '/compass', label: 'Political Compass', icon: Compass },
                        { href: '/impact', label: 'Your Impact on Laws', icon: Gavel },
                      ].map(({ href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-300/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 text-surface-300 group-hover:text-white transition-colors">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-mono">{label}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Categories tab */}
              {tab === 'categories' && (
                <motion.div
                  key="categories"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  {data.categoryBreakdown.length === 0 ? (
                    <EmptyState
                      icon={BarChart2}
                      title="Not enough data"
                      description="Vote on at least 2 topics in the same category to see your breakdown."
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-surface-500 font-mono uppercase tracking-wider">
                          {data.categoryBreakdown.length} categories
                        </span>
                        <div className="flex items-center gap-3 text-xs text-surface-500 font-mono">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-emerald" /> Aligned
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-against-400" /> Contrarian
                          </span>
                        </div>
                      </div>
                      {data.categoryBreakdown.map((cat) => (
                        <CategoryRow key={cat.category} cat={cat} />
                      ))}
                    </>
                  )}
                </motion.div>
              )}

              {/* Votes tab */}
              {tab === 'votes' && (
                <motion.div
                  key="votes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {/* Filter pills */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'aligned', label: 'Aligned' },
                        { id: 'contrarian', label: 'Contrarian' },
                        { id: 'correct', label: 'Called it' },
                        { id: 'wrong', label: 'Wrong side' },
                      ] as { id: typeof voteFilter; label: string }[]
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setVoteFilter(id)}
                        className={cn(
                          'shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                          voteFilter === id
                            ? 'bg-for-600 border-for-500 text-white'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-surface-300'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {filteredVotes.length === 0 ? (
                    <EmptyState
                      icon={Target}
                      title="No votes match"
                      description="Try a different filter."
                    />
                  ) : (
                    <div className="bg-surface-200 border border-surface-300 rounded-2xl overflow-hidden">
                      {filteredVotes.map((vote) => (
                        <VoteRow key={vote.topicId} vote={vote} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
