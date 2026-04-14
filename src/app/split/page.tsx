'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  ChevronDown,
  Eye,
  GitFork,
  Loader2,
  Tag,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ContestedTopic } from '@/app/api/topics/contested/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Philosophy',
  'Science',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

type StatusFilter = 'all' | 'active' | 'voting' | 'proposed'

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All Live' },
  { id: 'active', label: 'Active' },
  { id: 'voting', label: 'Voting' },
  { id: 'proposed', label: 'Proposed' },
]

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
}

// ─── Controversy meter ────────────────────────────────────────────────────────

/**
 * Visual tension meter — a split bar centered on 50%,
 * coloured red on the left and blue on the right.
 * The gap between the two bars visualises how close to 50/50 the topic is.
 */
function TensionMeter({
  forPct,
  score,
}: {
  forPct: number
  score: number
}) {
  const againstPct = 100 - forPct

  // Intensity: 100 = pure red/gold, 60 = pale
  const intensity = Math.round(score) // same as controversy_score

  return (
    <div className="space-y-1.5">
      {/* Split bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-surface-300">
        {/* Against (red) — grows from left */}
        <motion.div
          className="absolute left-0 top-0 h-full rounded-l-full bg-against-500"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* For (blue) — grows from right */}
        <motion.div
          className="absolute right-0 top-0 h-full rounded-r-full bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-mono text-against-400">
          {Math.round(againstPct)}% Against
        </span>

        {/* Tension score badge */}
        <span
          className={cn(
            'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
            intensity >= 95
              ? 'bg-purple/20 text-purple border border-purple/40'
              : intensity >= 85
              ? 'bg-gold/20 text-gold border border-gold/40'
              : 'bg-surface-200 text-surface-500 border border-surface-300'
          )}
        >
          {intensity >= 95
            ? 'DEADLOCK'
            : intensity >= 85
            ? 'HIGH TENSION'
            : 'CONTESTED'}
        </span>

        <span className="text-[11px] font-mono text-for-400">
          {Math.round(forPct)}% For
        </span>
      </div>
    </div>
  )
}

// ─── Topic card ────────────────────────────────────────────────────────────────

function ContestCard({
  topic,
  rank,
}: {
  topic: ContestedTopic
  rank: number
}) {
  const score = Math.round(topic.controversy_score)
  const isDeadlock = score >= 95
  const isHighTension = score >= 85

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group block p-4 rounded-2xl border transition-all duration-200',
          'hover:scale-[1.005] focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
          isDeadlock
            ? 'bg-purple/5 border-purple/30 hover:border-purple/50'
            : isHighTension
            ? 'bg-gold/5 border-gold/20 hover:border-gold/40'
            : 'bg-surface-100 border-surface-300 hover:border-surface-400'
        )}
        aria-label={`Topic: ${topic.statement}`}
      >
        {/* Top row: rank + status + category */}
        <div className="flex items-center gap-2 mb-2.5">
          {/* Rank pill */}
          <span
            className={cn(
              'flex-shrink-0 inline-flex items-center justify-center h-5 w-6 rounded text-[10px] font-mono font-bold',
              rank <= 3
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'bg-surface-200 text-surface-500 border border-surface-300'
            )}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </span>

          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
            {topic.status === 'voting' ? 'Voting' : topic.status === 'active' ? 'Active' : 'Proposed'}
          </Badge>

          {topic.category && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Tag className="h-3 w-3" />
              {topic.category}
            </span>
          )}

          {/* Deadlock / high-tension icon */}
          {isDeadlock && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-purple">
              <GitFork className="h-3 w-3" />
              DEADLOCK
            </span>
          )}
          {!isDeadlock && isHighTension && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-gold">
              <Zap className="h-3 w-3" />
              HOT
            </span>
          )}
        </div>

        {/* Statement */}
        <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2 mb-3 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>

        {/* Tension meter */}
        <TensionMeter forPct={topic.blue_pct} score={topic.controversy_score} />

        {/* Footer stats */}
        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-surface-300/50">
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" aria-hidden="true" />
            {topic.total_votes.toLocaleString()} votes
          </span>
          {topic.view_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {topic.view_count.toLocaleString()}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 group-hover:text-for-400 transition-colors">
            Vote now
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-surface-100 border border-surface-300 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-6 rounded" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ category, status }: { category: string; status: StatusFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="relative mb-5">
        <div className="h-16 w-16 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center mx-auto">
          <BarChart2 className="h-7 w-7 text-surface-500" />
        </div>
        {/* Split bar decoration */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-1 w-20 rounded-full overflow-hidden">
          <div className="flex-1 bg-against-500/40" />
          <div className="flex-1 bg-for-500/40" />
        </div>
      </div>
      <h3 className="text-base font-mono font-semibold text-white mb-1.5">
        No contested topics found
      </h3>
      <p className="text-sm font-mono text-surface-500 max-w-xs">
        {category !== 'All'
          ? `No closely split ${category} topics right now. Try a different category.`
          : status !== 'all'
          ? 'No closely split topics in this status. Try "All Live".'
          : 'The Lobby is in unusual agreement right now. Check back soon.'}
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-sm font-mono text-for-400 hover:bg-for-500/20 transition-colors"
      >
        Browse all topics
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SplitPage() {
  const [topics, setTopics] = useState<ContestedTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('All')
  const [catOpen, setCatOpen] = useState(false)

  const fetchTopics = useCallback(async (status: StatusFilter, cat: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (cat !== 'All') params.set('category', cat)
      params.set('limit', '30')

      const res = await fetch(`/api/topics/contested?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const { topics: data } = (await res.json()) as { topics: ContestedTopic[] }
      setTopics(data)
    } catch {
      setTopics([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTopics(statusFilter, category)
  }, [statusFilter, category, fetchTopics])

  const deadlockCount = topics.filter((t) => t.controversy_score >= 95).length
  const highTensionCount = topics.filter(
    (t) => t.controversy_score >= 85 && t.controversy_score < 95
  ).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* ── Hero header ──────────────────────────────────────────────── */}
        <div className="mb-7">
          {/* Split bar accent */}
          <div className="flex h-0.5 w-full mb-5 rounded-full overflow-hidden">
            <motion.div
              className="flex-1 bg-against-500"
              initial={{ scaleX: 0, originX: 1 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="flex-1 bg-for-500"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
                  <GitFork className="h-5 w-5 text-surface-600" />
                </div>
                <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
                  The Split
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 leading-relaxed">
                The most contested topics in the Lobby — where the community is
                almost evenly divided and every vote matters.
              </p>
            </div>
          </div>

          {/* Live stats pills */}
          {!loading && topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 mt-4 flex-wrap"
            >
              {deadlockCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple/10 border border-purple/30 text-xs font-mono text-purple">
                  <GitFork className="h-3 w-3" />
                  {deadlockCount} deadlock{deadlockCount !== 1 ? 's' : ''}
                </span>
              )}
              {highTensionCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 text-xs font-mono text-gold">
                  <AlertTriangle className="h-3 w-3" />
                  {highTensionCount} high tension
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500">
                <BarChart2 className="h-3 w-3" />
                {topics.length} contested
              </span>
            </motion.div>
          )}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Status tabs */}
          <div
            className="flex gap-1 p-1 bg-surface-200 rounded-xl"
            role="tablist"
            aria-label="Filter by status"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'px-3 h-8 rounded-lg text-xs font-mono font-medium transition-colors',
                  statusFilter === tab.id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <button
              onClick={() => setCatOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={catOpen}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-mono font-medium transition-colors',
                'bg-surface-200 border border-surface-300',
                category !== 'All'
                  ? 'text-for-400 border-for-500/40'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <Tag className="h-3 w-3" />
              {category}
              <ChevronDown className={cn('h-3 w-3 transition-transform', catOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1 z-20 w-44 rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
                  role="listbox"
                  aria-label="Select category"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      role="option"
                      aria-selected={category === cat}
                      onClick={() => {
                        setCategory(cat)
                        setCatOpen(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === cat
                          ? 'bg-for-500/20 text-for-300'
                          : 'text-surface-500 hover:bg-surface-300 hover:text-white'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              aria-busy="true"
              aria-label="Loading contested topics"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </motion.div>
          ) : topics.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState category={category} status={statusFilter} />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              role="feed"
              aria-label="Contested topics"
            >
              {/* Intro line */}
              <p className="text-[11px] font-mono text-surface-500 pb-1">
                Sorted by controversy — closest to 50/50 first
              </p>

              {topics.map((topic, i) => (
                <ContestCard key={topic.id} topic={topic} rank={i + 1} />
              ))}

              {/* Footer CTA */}
              <div className="pt-4 text-center">
                <Link
                  href="/trending"
                  className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors"
                >
                  See all trending topics
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading indicator when switching filters */}
        <AnimatePresence>
          {loading && topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 shadow-xl"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
