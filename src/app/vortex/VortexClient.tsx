'use client'

/**
 * /vortex — The Civic Vortex
 *
 * Reveals the "argument black holes" of civic debate: topics where rhetoric
 * and intellectual energy far outpace simple vote counts. High vortex score
 * means a fierce, many-voiced argument culture has formed around the topic
 * even before a large voter base has weighed in.
 *
 * Vortex Score = (arg_count × 12 + unique_arguers × 8 + reply_count × 3)
 *                / log2(total_votes + 2)
 *
 * Distinct from:
 *   /meridian     — high engagement but 50/50 locked
 *   /pressure     — topics under opinion-flip pressure
 *   /frontlines   — contested vote battle map
 *   /crossfire    — head-to-head argument comparison
 *   /flashpoint   — rate-of-change for new activity
 *
 * The Vortex asks: "Where is the intellectual fire burning hottest — per voter?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Flame,
  GitFork,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { VortexTopic, VortexStats, VortexResponse } from '@/app/api/vortex/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-amber-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}


const SORT_OPTIONS = [
  { id: 'vortex', label: 'Vortex Score', icon: Sparkles },
  { id: 'density', label: 'Arg Density', icon: Flame },
  { id: 'arguers', label: 'Unique Voices', icon: Users },
  { id: 'replies', label: 'Reply Depth', icon: GitFork },
] as const

type SortId = (typeof SORT_OPTIONS)[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return (n / 1_000).toFixed(0) + 'K'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function intensityLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Inferno', color: 'text-against-300', bg: 'bg-against-500/20 border-against-500/40' }
  if (score >= 50) return { label: 'Raging', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40' }
  if (score >= 30) return { label: 'Heated', color: 'text-gold', bg: 'bg-gold/20 border-gold/40' }
  if (score >= 15) return { label: 'Active', color: 'text-for-300', bg: 'bg-for-500/20 border-for-500/40' }
  return { label: 'Simmering', color: 'text-surface-400', bg: 'bg-surface-300/20 border-surface-400/30' }
}

// ─── Vortex rank badge ────────────────────────────────────────────────────────

function VortexRank({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xs font-black text-against-300 font-mono">#1</span>
  if (rank === 2) return <span className="text-xs font-black text-amber-400 font-mono">#2</span>
  if (rank === 3) return <span className="text-xs font-black text-gold font-mono">#3</span>
  return <span className="text-xs font-semibold text-surface-500 font-mono">#{rank}</span>
}

// ─── Argument preview strip ───────────────────────────────────────────────────

function ArgPreview({ arg }: { arg: VortexTopic['top_argument'] }) {
  if (!arg) return null
  const isFor = arg.side === 'blue'

  return (
    <div className={cn(
      'mt-3 p-2.5 rounded-lg border text-xs',
      isFor
        ? 'bg-for-500/5 border-for-500/20'
        : 'bg-against-500/5 border-against-500/20'
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        {arg.author_avatar_url || arg.author_username ? (
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name || arg.author_username || '?'}
            size="xs"
          />
        ) : null}
        <span className="text-surface-400 font-mono">
          {arg.author_username ? `@${arg.author_username}` : 'Anonymous'}
        </span>
        <span className={cn(
          'ml-auto flex items-center gap-0.5 font-semibold',
          isFor ? 'text-for-400' : 'text-against-400'
        )}>
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
      </div>
      <p className="text-surface-200 line-clamp-2 leading-relaxed">{arg.content}</p>
      <div className="flex items-center gap-3 mt-1.5 text-surface-500">
        <span className="flex items-center gap-1">
          <Zap className="h-2.5 w-2.5" />
          {arg.upvotes} upvotes
        </span>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function VortexCard({ topic, rank }: { topic: VortexTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const intensity = intensityLabel(topic.vortex_score)
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(rank * 0.04, 0.4) }}
      className="rounded-xl border border-surface-300/60 bg-surface-100/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header row */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-7 pt-0.5 text-center">
            <VortexRank rank={rank} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {topic.category && (
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide', catColor)}>
                  {topic.category}
                </span>
              )}
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                intensity.color, intensity.bg
              )}>
                {intensity.label}
              </span>
              <Badge
                variant={
                  topic.status === 'law' ? 'law'
                    : topic.status === 'voting' ? 'active'
                    : topic.status === 'active' ? 'active'
                    : 'proposed'
                }
                size="sm"
              />
            </div>

            {/* Statement */}
            <Link href={`/topic/${topic.id}`} className="group block">
              <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
                {topic.statement}
              </p>
            </Link>

            {/* Vote bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[10px] text-for-400 font-mono w-7 text-right">{forPct}%</span>
              <span className="text-[10px] text-against-400 font-mono w-7">{againstPct}%</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 ml-10">
          <div className="flex flex-col items-center p-1.5 rounded-lg bg-surface-200/50">
            <span className="text-[10px] text-surface-500 mb-0.5">Score</span>
            <span className="text-xs font-bold text-white font-mono">{topic.vortex_score.toFixed(1)}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded-lg bg-surface-200/50">
            <span className="text-[10px] text-surface-500 mb-0.5">Args</span>
            <span className="text-xs font-bold text-purple font-mono">{fmt(topic.argument_count)}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded-lg bg-surface-200/50">
            <span className="text-[10px] text-surface-500 mb-0.5">Voices</span>
            <span className="text-xs font-bold text-emerald font-mono">{fmt(topic.unique_arguers)}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded-lg bg-surface-200/50">
            <span className="text-[10px] text-surface-500 mb-0.5">Votes</span>
            <span className="text-xs font-bold text-surface-300 font-mono">{fmt(topic.total_votes)}</span>
          </div>
        </div>

        {/* Density pill */}
        <div className="ml-10 mt-2 flex items-center gap-2">
          <span className="text-[10px] text-surface-500">
            <span className="text-white font-semibold">{topic.arg_density.toFixed(2)}</span> args+replies per vote
          </span>
          {topic.reply_count > 0 && (
            <span className="text-[10px] text-surface-500">
              · <span className="text-amber-400 font-semibold">{fmt(topic.reply_count)}</span> replies
            </span>
          )}
          {topic.debate_count > 0 && (
            <span className="text-[10px] text-surface-500">
              · <span className="text-gold font-semibold">{topic.debate_count}</span> debate{topic.debate_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Top argument (expandable) */}
      {topic.top_argument && (
        <div className="border-t border-surface-300/40 px-4 py-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center gap-2 text-[11px] text-surface-400 hover:text-surface-200 transition-colors"
          >
            <MessageSquare className="h-3 w-3 flex-shrink-0" />
            <span className="flex-1 text-left">Top argument</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ArgPreview arg={topic.top_argument} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-surface-300/40 px-4 py-2 flex items-center justify-between">
        <Link
          href={`/topic/${topic.id}/arguments`}
          className="flex items-center gap-1 text-[11px] text-purple hover:text-purple/80 transition-colors font-medium"
        >
          <MessageSquare className="h-3 w-3" />
          View all {fmt(topic.argument_count)} arguments
        </Link>
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-1 text-[11px] text-surface-400 hover:text-white transition-colors"
        >
          Open topic
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VortexSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-100/40 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-7 h-4 rounded" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-10 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Stats banner ─────────────────────────────────────────────────────────────

function StatsBanner({ stats }: { stats: VortexStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-3 text-center">
        <p className="text-[11px] text-surface-500 mb-0.5">Vortex Topics</p>
        <AnimatedNumber value={stats.total_qualified} className="text-lg font-black text-white font-mono" />
      </div>
      <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-3 text-center">
        <p className="text-[11px] text-surface-500 mb-0.5">Avg Score</p>
        <p className="text-lg font-black text-against-300 font-mono">{stats.avg_vortex_score.toFixed(1)}</p>
      </div>
      <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-3 text-center">
        <p className="text-[11px] text-surface-500 mb-0.5">Total Arguments</p>
        <AnimatedNumber value={stats.total_arguments_in_vortex} className="text-lg font-black text-purple font-mono" />
      </div>
      <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-3 text-center">
        <p className="text-[11px] text-surface-500 mb-0.5">Hottest Category</p>
        <p className={cn('text-sm font-bold truncate', stats.highest_density_category ? CATEGORY_COLOR[stats.highest_density_category] ?? 'text-white' : 'text-surface-500')}>
          {stats.highest_density_category ?? '—'}
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function VortexClient() {
  const [topics, setTopics] = useState<VortexTopic[]>([])
  const [stats, setStats] = useState<VortexStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortId>('vortex')
  const [showCats, setShowCats] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const load = useCallback(async (cat: string | null, s: SortId, quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams({ sort: s, limit: '25' })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/vortex?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data: VortexResponse = await res.json()
      setTopics(data.topics)
      setStats(data.stats)
      setGeneratedAt(data.generated_at)
    } catch {
      // keep previous data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(category, sort) }, [load, category, sort])

  function handleCategory(cat: string | null) {
    setCategory(cat)
    setShowCats(false)
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">

        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-against-500/20 border border-against-500/40 flex items-center justify-center">
              <Zap className="h-4 w-4 text-against-300" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">The Civic Vortex</h1>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed ml-9">
            Argument black holes — topics where intellectual fire burns hottest per voter.
            Ranked by debate intensity relative to vote count.
          </p>
          {generatedAt && (
            <p className="text-[10px] text-surface-600 mt-1 ml-9 font-mono">
              Updated {relativeTime(generatedAt)}
            </p>
          )}
        </div>

        {/* Sort + Filter row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Sort pills */}
          <div className="flex items-center gap-1 bg-surface-200/60 rounded-lg p-1 border border-surface-300/50">
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all',
                  sort === id
                    ? 'bg-against-500/30 text-against-300 border border-against-500/40'
                    : 'text-surface-400 hover:text-white'
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Category button */}
          <div className="relative">
            <button
              onClick={() => setShowCats((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                category
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200/60 border-surface-300/50 text-surface-400 hover:text-white'
              )}
            >
              <TrendingUp className="h-3 w-3" />
              {category ?? 'All Categories'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showCats && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showCats && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 z-20 bg-surface-100 border border-surface-300/60 rounded-xl p-2 shadow-xl min-w-[160px]"
                >
                  <button
                    onClick={() => handleCategory(null)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                      !category ? 'bg-surface-300/60 text-white' : 'text-surface-400 hover:bg-surface-200/60 hover:text-white'
                    )}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategory(cat)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                        category === cat
                          ? 'bg-surface-300/60 text-white'
                          : 'text-surface-400 hover:bg-surface-200/60 hover:text-white',
                        CATEGORY_COLOR[cat]
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => load(category, sort, true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-300/50 bg-surface-200/40 text-[11px] text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && !loading && <StatsBanner stats={stats} />}

        {/* Content */}
        {loading ? (
          <VortexSkeleton />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No vortex topics found"
            description="No topics currently have enough argument activity to enter the Vortex. Check back later as debates heat up."
          />
        ) : (
          <div className="space-y-3">
            {topics.map((topic, i) => (
              <VortexCard key={topic.id} topic={topic} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Legend */}
        {!loading && topics.length > 0 && (
          <div className="mt-8 p-4 rounded-xl border border-surface-300/40 bg-surface-100/40">
            <p className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-against-400" />
              How Vortex Score works
            </p>
            <p className="text-xs text-surface-500 leading-relaxed">
              Vortex Score = <span className="text-white font-mono text-[11px]">(args × 12 + unique voices × 8 + replies × 3) ÷ log₂(votes)</span>.
              It rewards topics that attract many distinct voices and deep reply chains, relative to how many people have simply voted.
              A high score means the intellectual battle is fierce — even if the voter base is still forming.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {[
                { label: 'Inferno', color: 'text-against-300' },
                { label: 'Raging', color: 'text-amber-400' },
                { label: 'Heated', color: 'text-gold' },
                { label: 'Active', color: 'text-for-300' },
                { label: 'Simmering', color: 'text-surface-400' },
              ].map(({ label, color }) => (
                <span key={label} className={cn('font-semibold', color)}>{label}</span>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
