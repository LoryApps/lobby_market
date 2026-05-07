'use client'

/**
 * /leaderboard/tags — Tag Leaderboard
 *
 * Two modes:
 *  Overview  — shows all tags sorted by activity: debate count, votes,
 *              arguments.  Click a tag to drill into its leaderboard.
 *  Tag view  — shows top arguers + top topics for the selected tag.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  Hash,
  MessageSquare,
  RefreshCw,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
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
  TagLeaderboardResponse,
  TagsOverviewResponse,
  TagArguer,
  TagStats,
  TagTopic,
} from '@/app/api/leaderboard/tags/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

const TAG_PALETTES = [
  { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     active: 'ring-for-500/40'     },
  { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30', active: 'ring-against-500/40' },
  { text: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         active: 'ring-gold/40'         },
  { text: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30',      active: 'ring-emerald/40'      },
  { text: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30',       active: 'ring-purple/40'       },
  { text: 'text-for-400',     bg: 'bg-for-500/15',      border: 'border-for-500/40',      active: 'ring-for-400/40'      },
]

function tagPalette(tag: string) {
  const code = tag.charCodeAt(0) + tag.charCodeAt(Math.min(2, tag.length - 1))
  return TAG_PALETTES[code % TAG_PALETTES.length]
}

const ROLE_COLOR: Record<string, string> = {
  elder:          'text-gold',
  troll_catcher:  'text-emerald',
  debator:        'text-for-400',
  person:         'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder:          'Elder',
  troll_catcher:  'Troll Catcher',
  debator:        'Debator',
  person:         'Citizen',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'LAW',
  failed:   'Failed',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-4 w-20 rounded-full" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TagViewSkeleton() {
  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      {/* Arguers */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="text-right space-y-1.5">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tag overview card ────────────────────────────────────────────────────────

function TagOverviewCard({
  stats,
  onSelect,
}: {
  stats: TagStats
  onSelect: (tag: string) => void
}) {
  const palette = tagPalette(stats.tag)
  const forPct = stats.consensus_for_pct

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(stats.tag)}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl p-4 text-left w-full',
        'bg-surface-100 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-200/60',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2',
        palette.active
      )}
    >
      {/* Tag name */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Hash className={cn('h-3.5 w-3.5 flex-shrink-0', palette.text)} />
          <span className={cn('font-mono font-semibold text-sm truncate', palette.text)}>
            {stats.tag}
          </span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-surface-300 transition-colors" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <BarChart2 className="h-3 w-3" />
          {fmtNum(stats.topic_count)} topics
        </span>
        {stats.law_count > 0 && (
          <span className="flex items-center gap-1 text-gold">
            <Gavel className="h-3 w-3" />
            {stats.law_count}
          </span>
        )}
        {stats.active_count > 0 && (
          <span className="flex items-center gap-1 text-for-400">
            <Zap className="h-3 w-3" />
            {stats.active_count}
          </span>
        )}
        {stats.total_arguments > 0 && (
          <span className="flex items-center gap-1 ml-auto">
            <MessageSquare className="h-3 w-3" />
            {fmtNum(stats.total_arguments)}
          </span>
        )}
      </div>

      {/* Consensus bar */}
      {stats.total_votes > 0 && (
        <div className="space-y-1">
          <div className="h-1 w-full rounded-full overflow-hidden flex bg-surface-300">
            <div className="h-full bg-for-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-against-600 transition-all duration-500" style={{ width: `${100 - forPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-surface-600">{fmtNum(stats.total_votes)} votes</span>
            <span className="text-against-400">{100 - forPct}% Against</span>
          </div>
        </div>
      )}
    </motion.button>
  )
}

// ─── Arguer row ───────────────────────────────────────────────────────────────

const RANK_STYLE: Record<number, string> = {
  1: 'text-gold font-bold',
  2: 'text-surface-300 font-semibold',
  3: 'text-amber-700 font-semibold',
}

function ArguerRow({ arguer }: { arguer: TagArguer }) {
  const rankStyle = RANK_STYLE[arguer.rank] ?? 'text-surface-500'
  const roleLabel = ROLE_LABEL[arguer.role] ?? 'Citizen'
  const roleColor = ROLE_COLOR[arguer.role] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: arguer.rank * 0.04 }}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0 hover:bg-surface-200/30 transition-colors"
    >
      {/* Rank */}
      <span className={cn('font-mono text-sm w-6 flex-shrink-0 text-right', rankStyle)}>
        {arguer.rank === 1 ? '🥇' : arguer.rank === 2 ? '🥈' : arguer.rank === 3 ? '🥉' : `#${arguer.rank}`}
      </span>

      {/* Avatar */}
      <Link href={`/profile/${arguer.username}`} className="flex-shrink-0">
        <Avatar
          src={arguer.avatar_url}
          fallback={arguer.display_name ?? arguer.username}
          size="sm"
        />
      </Link>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${arguer.username}`}
          className="block font-mono font-semibold text-sm text-white hover:text-for-300 transition-colors truncate"
        >
          {arguer.display_name ?? `@${arguer.username}`}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[11px] font-mono', roleColor)}>{roleLabel}</span>
          <span className="text-[11px] font-mono text-surface-600">
            {arguer.argument_count} arg{arguer.argument_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Upvote score */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 justify-end">
          <ThumbsUp className="h-3 w-3 text-for-400" />
          <span className="font-mono font-bold text-sm text-white">
            {fmtNum(arguer.total_upvotes)}
          </span>
        </div>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">upvotes</p>
      </div>
    </motion.div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: TagTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const badgeVariant = STATUS_BADGE[topic.status] ?? 'proposed'
  const label = STATUS_LABEL[topic.status] ?? topic.status

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0 hover:bg-surface-200/30 transition-colors group"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-mono text-sm text-white group-hover:text-for-300 transition-colors leading-snug line-clamp-2">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={badgeVariant}>{label}</Badge>
          {topic.argument_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <MessageSquare className="h-2.5 w-2.5" />
              {topic.argument_count}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right space-y-1 min-w-[60px]">
        <div className="text-sm font-mono font-bold text-for-400">{forPct}%</div>
        <div className="h-1 w-14 rounded-full overflow-hidden flex bg-surface-300">
          <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
          <div className="h-full bg-against-600" style={{ width: `${100 - forPct}%` }} />
        </div>
        <div className="text-[10px] font-mono text-surface-500">{fmtNum(topic.total_votes)} votes</div>
      </div>
    </Link>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

function TagLeaderboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramTag = searchParams.get('tag') ?? ''

  const [selectedTag, setSelectedTag] = useState(paramTag)
  const [search, setSearch] = useState('')
  const [overviewData, setOverviewData] = useState<TagsOverviewResponse | null>(null)
  const [tagData, setTagData] = useState<TagLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchOverview = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/tags', { signal: ac.signal })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as TagsOverviewResponse
      setOverviewData(data)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Failed to load tag overview')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTag = useCallback(async (tag: string) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboard/tags?tag=${encodeURIComponent(tag)}`, { signal: ac.signal })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as TagLeaderboardResponse
      setTagData(data)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(`Failed to load leaderboard for #${tag}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedTag) {
      fetchTag(selectedTag)
    } else {
      fetchOverview()
    }
    return () => abortRef.current?.abort()
  }, [selectedTag, fetchOverview, fetchTag])

  function handleSelectTag(tag: string) {
    setSelectedTag(tag)
    setTagData(null)
    router.replace(`/leaderboard/tags?tag=${encodeURIComponent(tag)}`, { scroll: false })
  }

  function handleClearTag() {
    setSelectedTag('')
    setTagData(null)
    router.replace('/leaderboard/tags', { scroll: false })
  }

  // Filtered overview tags
  const filteredTags = (overviewData?.tags ?? []).filter((t) =>
    !search || t.tag.includes(search.toLowerCase())
  )

  const palette = selectedTag ? tagPalette(selectedTag) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors'
            )}
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Tag className="h-4 w-4 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                {selectedTag ? (
                  <span>
                    Tag Leaderboard
                    {' '}
                    <span className={cn('text-base', palette?.text)}>#{selectedTag}</span>
                  </span>
                ) : (
                  'Tag Leaderboard'
                )}
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                {selectedTag
                  ? 'Top arguers and most active debates'
                  : 'Top contributors ranked by tag — select one to drill in'}
              </p>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={() => selectedTag ? fetchTag(selectedTag) : fetchOverview()}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors'
            )}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Nav tabs ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {[
            { href: '/leaderboard', label: 'Overall' },
            { href: '/leaderboard/topics', label: 'Topics' },
            { href: '/leaderboard/debates', label: 'Debates' },
            { href: '/leaderboard/arguments', label: 'Arguments' },
            { href: '/leaderboard/categories', label: 'Categories' },
            { href: '/leaderboard/tags', label: 'Tags', active: true },
            { href: '/leaderboard/laws', label: 'Laws' },
            { href: '/leaderboard/week', label: 'This Week' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors',
                tab.active
                  ? 'bg-for-600 text-white'
                  : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-4 text-sm font-mono text-against-400 mb-5">
            {error}
          </div>
        )}

        {/* ── Tag view ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {selectedTag ? (
            <motion.div
              key="tag-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
              {/* Clear tag button */}
              <button
                onClick={handleClearTag}
                className={cn(
                  'flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors'
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All tags
              </button>

              {loading ? (
                <TagViewSkeleton />
              ) : tagData ? (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: BarChart2, label: 'Topics', value: fmtNum(tagData.stats.topic_count), color: 'text-for-400' },
                      { icon: Gavel,     label: 'Laws',   value: fmtNum(tagData.stats.law_count),   color: 'text-gold' },
                      { icon: Users,     label: 'Votes',  value: fmtNum(tagData.stats.total_votes), color: 'text-emerald' },
                      { icon: MessageSquare, label: 'Arguments', value: fmtNum(tagData.stats.total_arguments), color: 'text-purple' },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div
                        key={label}
                        className="flex flex-col gap-1 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3.5 w-3.5', color)} />
                          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
                        </div>
                        <span className={cn('text-xl font-mono font-bold', color)}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Consensus bar */}
                  {tagData.stats.total_votes > 0 && (
                    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
                      <div className="flex justify-between text-xs font-mono font-semibold">
                        <span className="text-for-400 flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {tagData.stats.consensus_for_pct}% consensus FOR
                        </span>
                        <span className="text-against-400 flex items-center gap-1">
                          {100 - tagData.stats.consensus_for_pct}% AGAINST
                          <ThumbsDown className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-surface-300">
                        <div
                          className="h-full bg-gradient-to-r from-for-700 to-for-400 transition-all duration-700"
                          style={{ width: `${tagData.stats.consensus_for_pct}%` }}
                        />
                        <div
                          className="h-full bg-against-600 transition-all duration-700"
                          style={{ width: `${100 - tagData.stats.consensus_for_pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-mono text-surface-500 text-center">
                        Average consensus across {tagData.stats.topic_count} debate{tagData.stats.topic_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Top arguers */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-gold" />
                      <h2 className="text-sm font-mono font-bold text-white">Top Arguers</h2>
                      <span className="text-xs font-mono text-surface-500 ml-1">by upvotes on #{selectedTag} debates</span>
                    </div>
                    {tagData.topArguers.length > 0 ? (
                      <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
                        {tagData.topArguers.map((arguer) => (
                          <ArguerRow key={arguer.user_id} arguer={arguer} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={MessageSquare}
                        title="No arguments yet"
                        description={`Be the first to argue on a #${selectedTag} topic`}
                        size="sm"
                      />
                    )}
                  </div>

                  {/* Top topics */}
                  {tagData.topTopics.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-against-400" />
                          <h2 className="text-sm font-mono font-bold text-white">Top Debates</h2>
                        </div>
                        <Link
                          href={`/tags/${encodeURIComponent(selectedTag)}`}
                          className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                        >
                          All #{selectedTag} debates
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
                        {tagData.topTopics.map((topic) => (
                          <TopicRow key={topic.id} topic={topic} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </motion.div>
          ) : (
            /* ── Overview ─────────────────────────────────────────── */
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
              {/* Search */}
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter tags…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    'w-full h-10 rounded-xl pl-9 pr-4',
                    'bg-surface-100 border border-surface-300',
                    'text-sm font-mono text-white placeholder:text-surface-500',
                    'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/30',
                    'transition-colors'
                  )}
                />
              </div>

              {loading ? (
                <OverviewSkeleton />
              ) : filteredTags.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredTags.map((stats) => (
                    <TagOverviewCard key={stats.tag} stats={stats} onSelect={handleSelectTag} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Tag}
                  title={search ? `No tags matching "${search}"` : 'No tags yet'}
                  description="Tags are auto-generated as topics are created."
                  size="md"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Export with Suspense for useSearchParams ─────────────────────────────────

export default function TagLeaderboardPage() {
  return (
    <Suspense>
      <TagLeaderboardInner />
    </Suspense>
  )
}
