'use client'

/**
 * /topic/[id]/similar — Similar Topics Discovery Hub
 *
 * Surfaces civic debates related to the current topic through three lenses:
 *   1. Related by Tags/Category — topics sharing the most tags or same category
 *   2. Correlated Voting Patterns — topics voted on by the same people
 *      (aligned = people who voted FOR here also voted FOR there;
 *       opposed = opposite sides chosen)
 *   3. Browse More — quick link to the category index
 *
 * Uses existing API routes:
 *   /api/topics/[id]/related       → tag/category similarity
 *   /api/topics/[id]/correlations  → voter-behavior alignment
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  GitMerge,
  Layers,
  Network,
  RefreshCw,
  Scale,
  Tag,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RelatedTopicResult } from '@/app/api/topics/[id]/related/route'
import type { CorrelatedTopic } from '@/app/api/topics/[id]/correlations/route'
import type { SourceTopic } from './page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function statusConfig(status: string): { label: string; cls: string } {
  switch (status) {
    case 'law':
      return { label: 'Law', cls: 'bg-gold/10 text-gold border-gold/25' }
    case 'failed':
      return { label: 'Failed', cls: 'bg-surface-600/40 text-surface-400 border-surface-500/20' }
    case 'voting':
      return { label: 'Voting', cls: 'bg-for-500/10 text-for-400 border-for-500/20' }
    case 'proposed':
      return { label: 'Proposed', cls: 'bg-surface-400/15 text-surface-400 border-surface-400/20' }
    default:
      return { label: 'Active', cls: 'bg-emerald/10 text-emerald border-emerald/20' }
  }
}

function forPctColor(pct: number, status: string): string {
  if (status === 'law') return 'text-gold font-bold'
  if (status === 'failed') return 'text-surface-500'
  if (pct >= 70) return 'text-for-400'
  if (pct <= 30) return 'text-against-400'
  return 'text-surface-300'
}

// ─── Consensus Bar ────────────────────────────────────────────────────────────

function ConsensusBar({ forPct, status }: { forPct: number; status: string }) {
  const dead = status === 'failed'
  return (
    <div className="h-1 rounded-full overflow-hidden bg-surface-400/20">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          dead ? 'bg-surface-500/40' : 'bg-gradient-to-r from-for-500 to-for-400'
        )}
        style={{ width: `${Math.max(2, Math.min(98, forPct))}%` }}
      />
    </div>
  )
}

// ─── Related Topic Card ───────────────────────────────────────────────────────

function RelatedCard({ topic }: { topic: RelatedTopicResult }) {
  const st = statusConfig(topic.status)
  const forPct = Math.round(topic.blue_pct ?? 50)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/topic/${topic.id}`} className="group block">
        <div className="p-4 rounded-xl border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all">
          {/* Top row */}
          <div className="flex items-start gap-3">
            <p className="flex-1 text-sm font-mono text-white/90 leading-snug group-hover:text-white transition-colors line-clamp-2">
              {topic.statement}
            </p>
            <div className={cn('flex-shrink-0 text-center rounded-lg px-2 py-1 border min-w-[52px]', st.cls)}>
              <div className={cn('text-base font-bold tabular-nums', forPctColor(forPct, topic.status))}>
                {forPct}<span className="text-xs">%</span>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">FOR</div>
            </div>
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {topic.category && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-300/50 text-surface-400 border border-surface-400/20">
                <Layers className="h-2.5 w-2.5" />
                {topic.category}
              </span>
            )}
            {topic.shared_tags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple/10 text-purple border border-purple/20">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-surface-500 font-mono flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {formatVotes(topic.total_votes)}
            </span>
          </div>

          {/* Bar */}
          <div className="mt-2.5">
            <ConsensusBar forPct={forPct} status={topic.status} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Correlated Topic Card ────────────────────────────────────────────────────

function CorrelatedCard({ topic }: { topic: CorrelatedTopic }) {
  const st = statusConfig(topic.status)
  const forPct = Math.round(topic.blue_pct ?? 50)
  const isAligned = topic.direction === 'aligned'
  const strength = Math.abs(topic.correlation)

  const strengthLabel =
    strength >= 0.6 ? 'Strong' : strength >= 0.35 ? 'Moderate' : 'Mild'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/topic/${topic.id}`} className="group block">
        <div className="p-4 rounded-xl border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all">
          {/* Top row */}
          <div className="flex items-start gap-3">
            <p className="flex-1 text-sm font-mono text-white/90 leading-snug group-hover:text-white transition-colors line-clamp-2">
              {topic.statement}
            </p>
            <div className={cn('flex-shrink-0 text-center rounded-lg px-2 py-1 border min-w-[52px]', st.cls)}>
              <div className={cn('text-base font-bold tabular-nums', forPctColor(forPct, topic.status))}>
                {forPct}<span className="text-xs">%</span>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">FOR</div>
            </div>
          </div>

          {/* Correlation row */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {topic.category && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-300/50 text-surface-400 border border-surface-400/20">
                <Layers className="h-2.5 w-2.5" />
                {topic.category}
              </span>
            )}
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
              isAligned
                ? 'bg-for-600/15 text-for-400 border-for-500/25'
                : 'bg-against-600/15 text-against-400 border-against-500/25'
            )}>
              <GitMerge className="h-2.5 w-2.5" />
              {strengthLabel} {isAligned ? 'alignment' : 'opposition'}
            </span>
            <span className="text-[10px] text-surface-500 font-mono">
              {topic.shared_voters} shared voters
            </span>
            <span className="ml-auto text-[10px] text-surface-500 font-mono flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {formatVotes(topic.total_votes)}
            </span>
          </div>

          {/* Bars */}
          <div className="mt-2.5 space-y-1">
            <ConsensusBar forPct={forPct} status={topic.status} />
            {/* Correlation strength bar */}
            <div className="h-0.5 rounded-full overflow-hidden bg-surface-400/10">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isAligned ? 'bg-for-500/50' : 'bg-against-500/50'
                )}
                style={{ width: `${Math.round(strength * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Card Skeleton ─────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-surface-300/40 bg-surface-200/30 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-12 w-14 rounded-lg flex-shrink-0" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topic: SourceTopic
}

export function SimilarTopicsClient({ topicId, topic }: Props) {
  const [related, setRelated] = useState<RelatedTopicResult[]>([])
  const [correlated, setCorrelated] = useState<CorrelatedTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasCorrelations, setHasCorrelations] = useState(false)

  const forPct = Math.round(topic.blue_pct ?? 50)
  const st = statusConfig(topic.status)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [relRes, corRes] = await Promise.all([
        fetch(`/api/topics/${topicId}/related`),
        fetch(`/api/topics/${topicId}/correlations?limit=8`),
      ])

      if (relRes.ok) {
        const { topics } = await relRes.json() as { topics: RelatedTopicResult[] }
        setRelated(topics ?? [])
      }

      if (corRes.ok) {
        const data = await corRes.json() as {
          correlations: CorrelatedTopic[]
          has_data: boolean
        }
        setCorrelated(data.correlations ?? [])
        setHasCorrelations(data.has_data ?? false)
      }
    } catch {
      setError('Failed to load similar topics.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const alignedTopics = correlated.filter((c) => c.direction === 'aligned')
  const opposedTopics = correlated.filter((c) => c.direction === 'opposed')

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-8">

        {/* Back + header */}
        <div className="space-y-4">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>

          <div>
            <h1 className="text-xl font-mono font-bold text-white">
              Similar Topics
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Debates related to this topic by tags, votes, and voter patterns.
            </p>
          </div>

          {/* Source topic context card */}
          <div className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4">
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm font-mono text-surface-300 leading-snug line-clamp-2">
                {topic.statement}
              </p>
              <div className={cn('flex-shrink-0 text-center rounded-lg px-2 py-1 border min-w-[52px]', st.cls)}>
                <div className={cn('text-base font-bold tabular-nums', forPctColor(forPct, topic.status))}>
                  {forPct}<span className="text-xs">%</span>
                </div>
                <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">FOR</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              {topic.category && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-300/50 text-surface-400 border border-surface-400/20">
                  {topic.category}
                </span>
              )}
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', st.cls)}>
                {st.label}
              </span>
              <span className="text-[10px] text-surface-500 font-mono ml-auto flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {formatVotes(topic.total_votes)}
              </span>
            </div>
            <ConsensusBar forPct={forPct} status={topic.status} />
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-surface-300/40 bg-surface-200/40 p-4">
            <p className="text-sm text-surface-400 font-mono">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Section 1: Related by Tags / Category ──────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple" />
              <h2 className="text-sm font-mono font-semibold text-white">Related Topics</h2>
            </div>
            {!loading && related.length > 0 && (
              <span className="text-xs text-surface-500 font-mono">{related.length} found</span>
            )}
          </div>

          <p className="text-xs text-surface-500 font-mono -mt-1">
            Topics sharing tags or category — voters interested in this debate often engage with these.
          </p>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="rel-skel" className="space-y-3">
                {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
              </motion.div>
            ) : related.length === 0 ? (
              <motion.div key="rel-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={Tag}
                  iconColor="text-purple"
                  iconBg="bg-purple/10"
                  iconBorder="border-purple/20"
                  title="No tagged matches yet"
                  description="This topic hasn't accumulated enough tag overlap with other debates. Check back as the platform grows."
                  size="sm"
                  action={{ label: `Browse ${topic.category ?? 'all topics'}`, href: topic.category ? `/categories/${encodeURIComponent(topic.category.toLowerCase())}` : '/categories' }}
                />
              </motion.div>
            ) : (
              <motion.div key="rel-list" className="space-y-3">
                {related.map((t) => (
                  <RelatedCard key={t.id} topic={t} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Section 2: Correlated Voting Patterns ──────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald" />
            <h2 className="text-sm font-mono font-semibold text-white">Correlated Votes</h2>
          </div>

          <p className="text-xs text-surface-500 font-mono -mt-1">
            Topics that people who voted here also tend to vote on — revealing ideological clusters.
          </p>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="cor-skel" className="space-y-3">
                {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
              </motion.div>
            ) : !hasCorrelations || correlated.length === 0 ? (
              <motion.div key="cor-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={Network}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10"
                  iconBorder="border-emerald/20"
                  title="Not enough shared voters yet"
                  description="Voter correlation requires at least 3 people who voted on both topics. As the debate grows, ideological links will surface here."
                  size="sm"
                />
              </motion.div>
            ) : (
              <motion.div key="cor-list" className="space-y-6">
                {alignedTopics.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                      <span className="text-xs font-mono font-semibold text-for-400">Aligned — voters chose the same side</span>
                    </div>
                    {alignedTopics.map((t) => (
                      <CorrelatedCard key={t.id} topic={t} />
                    ))}
                  </div>
                )}

                {opposedTopics.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5 text-against-400" />
                      <span className="text-xs font-mono font-semibold text-against-400">Opposed — voters chose opposite sides</span>
                    </div>
                    {opposedTopics.map((t) => (
                      <CorrelatedCard key={t.id} topic={t} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Discovery footer ────────────────────────────────────────────── */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-surface-300/30 bg-surface-200/20 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold" />
              <span className="text-sm font-mono font-semibold text-white">Explore More</span>
            </div>
            <p className="text-xs text-surface-500 font-mono">
              Dive deeper into the civic debate landscape.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {topic.category && (
                <Link
                  href={`/categories/${encodeURIComponent(topic.category.toLowerCase())}`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all group"
                >
                  <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors truncate">
                    {topic.category}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white transition-colors" />
                </Link>
              )}
              <Link
                href={`/topic/${topicId}/correlations`}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all group"
              >
                <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors">
                  Full correlations
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white transition-colors" />
              </Link>
              <Link
                href="/discover"
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all group"
              >
                <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors">
                  Discover topics
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white transition-colors" />
              </Link>
              <Link
                href="/trending"
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all group"
              >
                <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors">
                  Trending now
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
