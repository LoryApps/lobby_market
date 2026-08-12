'use client'

/**
 * /outliers — The Civic Paradox Board
 *
 * Surfaces topics where community voting and argument quality point in
 * opposite directions: the side winning the vote has lower-quality
 * arguments than the losing side. Democracy is working, but reason
 * isn't always winning.
 *
 * Three paradox types:
 *   Quality Inversion — FOR wins the vote but AGAINST has stronger arguments (or vice versa)
 *   Expert Outlier    — power users disagree with the crowd consensus
 *   Majority Dissent  — aggregate signal mismatch
 *
 * Distinct from:
 *   /contrarian  — your personal minority-position tracker
 *   /schism      — deepest ideological fault lines (50/50 splits)
 *   /deadlock    — near-tie topics
 *   /bias        — your voting pattern biases
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { OutlierTopic, OutliersResponse } from '@/app/api/outliers/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS = [
  { id: 'paradox',     label: 'Most Paradoxical' },
  { id: 'votes',       label: 'Most Voted' },
  { id: 'quality_gap', label: 'Biggest Quality Gap' },
  { id: 'recent',      label: 'Newest' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(score: number | null): string {
  if (score === null) return 'text-surface-500'
  if (score >= 8) return 'text-emerald'
  if (score >= 6) return 'text-for-400'
  if (score >= 4) return 'text-gold'
  return 'text-against-400'
}

function gradeLabel(score: number | null): string {
  if (score === null) return '?'
  if (score >= 8) return 'A'
  if (score >= 6) return 'B'
  if (score >= 4) return 'C'
  if (score >= 2) return 'D'
  return 'F'
}

function paradoxScoreColor(score: number): string {
  if (score >= 70) return 'text-against-400'
  if (score >= 45) return 'text-gold'
  return 'text-purple'
}

function paradoxScoreBg(score: number): string {
  if (score >= 70) return 'bg-against-500/10 border-against-500/30'
  if (score >= 45) return 'bg-gold/10 border-gold/30'
  return 'bg-purple/10 border-purple/30'
}

function paradoxTier(score: number): string {
  if (score >= 70) return 'Critical'
  if (score >= 45) return 'Significant'
  return 'Mild'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OutlierCard({ topic }: { topic: OutlierTopic }) {
  const [expanded, setExpanded] = useState(false)

  const voteWinnerIsFor = topic.vote_winner === 'for'
  const qualityWinnerIsFor = topic.quality_winner === 'for'

  const forScore = topic.for_avg_ai_score
  const againstScore = topic.against_avg_ai_score

  const forIsWinningVote = voteWinnerIsFor
  const againstIsWinningVote = !voteWinnerIsFor

  // The "upset" side — winning the quality fight but losing the vote
  const qualityWinnerLabel = qualityWinnerIsFor ? 'FOR' : 'AGAINST'
  const voteWinnerLabel = voteWinnerIsFor ? 'FOR' : 'AGAINST'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border overflow-hidden transition-colors',
        paradoxScoreBg(topic.paradox_score)
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          {/* Paradox score badge */}
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border text-sm font-mono font-bold',
            paradoxScoreBg(topic.paradox_score),
            paradoxScoreColor(topic.paradox_score)
          )}>
            {topic.paradox_score}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn(
                'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                paradoxScoreBg(topic.paradox_score),
                paradoxScoreColor(topic.paradox_score)
              )}>
                {paradoxTier(topic.paradox_score)} Paradox
              </span>
              {topic.category && (
                <Badge size="sm" variant="neutral">{topic.category}</Badge>
              )}
              <span className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                topic.status === 'voting' ? 'bg-purple/20 text-purple' : 'bg-for-500/15 text-for-400'
              )}>
                {topic.status}
              </span>
            </div>
            <Link
              href={`/topic/${topic.id}`}
              className="text-sm font-mono font-semibold text-white leading-snug hover:text-for-400 transition-colors line-clamp-2"
            >
              {topic.statement}
            </Link>
          </div>
        </div>

        {/* ── Visual paradox display ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* FOR side */}
          <div className={cn(
            'rounded-xl border p-3',
            forIsWinningVote
              ? 'bg-for-500/10 border-for-500/30'
              : 'bg-surface-200 border-surface-300'
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold text-for-400 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> FOR
              </span>
              {forIsWinningVote && (
                <span className="text-xs font-mono text-for-300 flex items-center gap-0.5">
                  <Trophy className="h-2.5 w-2.5" /> Votes
                </span>
              )}
              {qualityWinnerIsFor && (
                <span className="text-xs font-mono text-emerald flex items-center gap-0.5">
                  <Brain className="h-2.5 w-2.5" /> Quality
                </span>
              )}
            </div>
            <div className="text-2xl font-mono font-black text-for-300">
              {topic.blue_pct.toFixed(0)}%
            </div>
            <div className="text-xs font-mono text-surface-500 mt-0.5">
              {topic.for_arg_count} arg{topic.for_arg_count !== 1 ? 's' : ''}
              {forScore !== null && (
                <span className={cn('ml-1.5 font-bold', gradeColor(forScore))}>
                  Grade {gradeLabel(forScore)} ({forScore.toFixed(1)}/10)
                </span>
              )}
            </div>
          </div>

          {/* AGAINST side */}
          <div className={cn(
            'rounded-xl border p-3',
            againstIsWinningVote
              ? 'bg-against-500/10 border-against-500/30'
              : 'bg-surface-200 border-surface-300'
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold text-against-400 flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" /> AGAINST
              </span>
              {againstIsWinningVote && (
                <span className="text-xs font-mono text-against-300 flex items-center gap-0.5">
                  <Trophy className="h-2.5 w-2.5" /> Votes
                </span>
              )}
              {!qualityWinnerIsFor && topic.quality_winner !== 'unknown' && (
                <span className="text-xs font-mono text-emerald flex items-center gap-0.5">
                  <Brain className="h-2.5 w-2.5" /> Quality
                </span>
              )}
            </div>
            <div className="text-2xl font-mono font-black text-against-300">
              {(100 - topic.blue_pct).toFixed(0)}%
            </div>
            <div className="text-xs font-mono text-surface-500 mt-0.5">
              {topic.against_arg_count} arg{topic.against_arg_count !== 1 ? 's' : ''}
              {againstScore !== null && (
                <span className={cn('ml-1.5 font-bold', gradeColor(againstScore))}>
                  Grade {gradeLabel(againstScore)} ({againstScore.toFixed(1)}/10)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Paradox explanation ──────────────────────────────────────────── */}
        <div className="flex items-start gap-2">
          <AlertTriangle className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', paradoxScoreColor(topic.paradox_score))} />
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            {topic.paradox_label}
          </p>
        </div>

        {/* ── Expand toggle ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300">
          <span className="text-xs font-mono text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View debate <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? (
                <><ChevronDown className="h-3 w-3 rotate-180 transition-transform" /> Less</>
              ) : (
                <><ChevronDown className="h-3 w-3 transition-transform" /> Analysis</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded analysis ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-300"
          >
            <div className="px-4 sm:px-5 py-4 space-y-3">
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                <span className="text-white font-bold">What does this mean?</span>{' '}
                Democracy is working — citizens are voting — but the crowd is favouring the side
                with lower-quality arguments. This could mean the{' '}
                <span className={cn('font-bold', paradoxScoreColor(topic.paradox_score))}>
                  {qualityWinnerLabel}
                </span>{' '}
                side needs better outreach, or that{' '}
                <span className="text-white font-bold">emotional appeal</span> is outweighing{' '}
                <span className="text-white font-bold">logical rigour</span>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-200 border border-surface-300 p-2.5">
                  <div className="text-xs font-mono text-surface-500 mb-1">Vote gap</div>
                  <div className="text-sm font-mono font-bold text-white">
                    +{topic.vote_margin.toFixed(1)}pp
                  </div>
                  <div className="text-xs font-mono text-surface-500">
                    {voteWinnerLabel} leads by this margin
                  </div>
                </div>
                <div className="rounded-lg bg-surface-200 border border-surface-300 p-2.5">
                  <div className="text-xs font-mono text-surface-500 mb-1">Quality gap</div>
                  <div className="text-sm font-mono font-bold text-white">
                    {topic.quality_gap != null ? `+${topic.quality_gap.toFixed(1)}/10` : 'N/A'}
                  </div>
                  <div className="text-xs font-mono text-surface-500">
                    {qualityWinnerLabel} arguments score higher
                  </div>
                </div>
              </div>

              <Link
                href={`/topic/${topic.id}/arguments`}
                className="flex items-center justify-between rounded-lg bg-surface-200 border border-surface-300 px-3 py-2.5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors"
              >
                <span className="text-xs font-mono text-surface-400">Read all arguments</span>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function OutlierSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutliersPage() {
  const [topics, setTopics] = useState<OutlierTopic[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('paradox')
  const [showFilters, setShowFilters] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort })
      if (category) params.set('category', category)
      const res = await fetch(`/api/outliers?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: OutliersResponse = await res.json()
      setTopics(data.topics)
      setTotal(data.total)
    } catch {
      setError('Unable to load paradox data. Try again.')
    } finally {
      setLoading(false)
    }
  }, [category, sort, refreshKey])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Feed
          </Link>

          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-2xl bg-purple/10 border border-purple/30 flex-shrink-0 mt-0.5">
              <Scale className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-black text-white">Civic Paradoxes</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Topics where the vote and argument quality point in opposite directions
              </p>
            </div>
          </div>

          {/* Explainer */}
          <div className="mt-4 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              A <span className="text-white font-bold">civic paradox</span> occurs when one side
              wins the vote but the other side makes stronger arguments. These debates reveal
              where <span className="text-for-400 font-bold">persuasion</span> beats{' '}
              <span className="text-emerald font-bold">logic</span> — or where the crowd hasn't
              heard the best case for the other side yet. Higher scores mean a bigger disconnect.
            </p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-300">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-against-400" />
                <span className="text-xs font-mono text-surface-500">Critical ≥70</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-gold" />
                <span className="text-xs font-mono text-surface-500">Significant ≥45</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-purple" />
                <span className="text-xs font-mono text-surface-500">Mild &lt;45</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono transition-colors border',
              showFilters
                ? 'bg-purple/15 border-purple/40 text-purple'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )}
          >
            <Filter className="h-3 w-3" />
            Filters
            {(category) && (
              <span className="ml-0.5 bg-purple/30 text-purple text-[10px] rounded-full px-1 py-px leading-none">
                1
              </span>
            )}
          </button>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs font-mono transition-colors border',
                  sort === opt.id
                    ? 'bg-purple/15 border-purple/40 text-purple'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Filter panel ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                {/* Category */}
                <div>
                  <p className="text-xs font-mono text-surface-500 mb-2">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setCategory(null)}
                      className={cn(
                        'h-7 px-2.5 rounded-full text-xs font-mono border transition-colors',
                        !category
                          ? 'bg-purple/15 border-purple/40 text-purple'
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat === category ? null : cat)}
                        className={cn(
                          'h-7 px-2.5 rounded-full text-xs font-mono border transition-colors',
                          category === cat
                            ? 'bg-purple/15 border-purple/40 text-purple'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Count ─────────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <p className="text-xs font-mono text-surface-500 mb-3">
            {total === 0 ? 'No paradoxes found' : `${total} paradox${total !== 1 ? 'es' : ''} detected`}
            {category && ` in ${category}`}
          </p>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 px-4 py-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" />
            <p className="text-sm font-mono text-against-400">{error}</p>
          </div>
        )}

        {/* ── List ──────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <OutlierSkeleton key={i} />)
          ) : topics.length === 0 && !error ? (
            <EmptyState
              icon={Scale}
              iconColor="text-purple"
              iconBg="bg-purple/10"
              iconBorder="border-purple/30"
              title="No paradoxes detected"
              description="Either argument quality data is sparse right now, or the platform is in a rare moment of alignment — vote and argument quality agree."
              action={{ label: 'Browse all debates', href: '/topics' }}
            />
          ) : (
            topics.map((topic, i) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <OutlierCard topic={topic} />
              </motion.div>
            ))
          )}
        </div>

        {/* ── Related pages ─────────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300">
            <p className="text-xs font-mono text-surface-500 mb-3">Related views</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/schism', icon: Scale, label: 'The Schism', desc: 'Deepest fault lines' },
                { href: '/contrarian', icon: TrendingDown, label: 'Maverick Tracker', desc: 'Your minority votes' },
                { href: '/deadlock', icon: Zap, label: 'Deadlocked', desc: 'Perfect 50/50 splits' },
                { href: '/top-arguments', icon: Trophy, label: 'Top Arguments', desc: 'Platform\'s best reasoning' },
              ].map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                >
                  <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-medium text-white">{label}</div>
                    <div className="text-xs font-mono text-surface-500 truncate">{desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
