'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Loader2,
  MessageSquare,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
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
  MarketArgument,
  MarketArgumentsResponse,
} from '@/app/api/exchange/[id]/arguments/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const GRADE_CONFIG: Record<string, { color: string; bg: string }> = {
  A: { color: 'text-emerald',     bg: 'bg-emerald/10 border-emerald/30' },
  B: { color: 'text-for-400',     bg: 'bg-for-500/10 border-for-500/30' },
  C: { color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  D: { color: 'text-against-300', bg: 'bg-against-500/10 border-against-500/30' },
  F: { color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  topicId,
  index,
}: {
  arg: MarketArgument
  topicId: string
  index: number
}) {
  const isFor = arg.side === 'blue'
  const gradeStyle = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-colors',
        isFor
          ? 'bg-for-900/20 border-for-600/20 hover:border-for-500/40'
          : 'bg-against-900/20 border-against-600/20 hover:border-against-500/40',
      )}
    >
      {/* Side indicator + quality badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
              isFor
                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                : 'text-against-400 bg-against-500/10 border-against-500/30',
            )}
          >
            {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>

          {arg.ai_grade && gradeStyle && (
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                gradeStyle.color,
                gradeStyle.bg,
              )}
            >
              Grade {arg.ai_grade}
              {arg.ai_score != null && (
                <span className="ml-0.5 opacity-70">· {arg.ai_score}/10</span>
              )}
            </span>
          )}
        </div>

        <span className="text-[10px] text-surface-500">{relativeTime(arg.created_at)}</span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-100 leading-relaxed">{arg.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Link
          href={`/profile/${arg.author.username}`}
          className="flex items-center gap-2 group"
        >
          <Avatar
            src={arg.author.avatar_url}
            username={arg.author.username}
            size={20}
            className="opacity-80 group-hover:opacity-100 transition-opacity"
          />
          <span className="text-xs text-surface-400 group-hover:text-white transition-colors">
            {arg.author.display_name ?? arg.author.username}
          </span>
          {arg.author.role && arg.author.role !== 'member' && (
            <Badge variant="outline" size="sm" className="text-[9px] px-1 py-0">
              {arg.author.role}
            </Badge>
          )}
        </Link>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            <TrendingUp className="h-3 w-3" />
            {arg.upvotes.toLocaleString()}
          </span>

          <Link
            href={`/topic/${topicId}/arguments`}
            className="text-[10px] text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
            title="View in civic topic"
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgumentSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ data }: { data: MarketArgumentsResponse }) {
  const { stats, topic } = data
  const total = stats.total_for + stats.total_against
  const forPct = total > 0 ? Math.round((stats.total_for / total) * 100) : 50

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-surface-500 uppercase tracking-widest mb-0.5">FOR</p>
            <p className="text-lg font-bold text-for-400">{stats.total_for}</p>
          </div>
          <div className="w-px h-8 bg-surface-300" />
          <div>
            <p className="text-[10px] text-surface-500 uppercase tracking-widest mb-0.5">AGAINST</p>
            <p className="text-lg font-bold text-against-400">{stats.total_against}</p>
          </div>
          <div className="w-px h-8 bg-surface-300" />
          <div>
            <p className="text-[10px] text-surface-500 uppercase tracking-widest mb-0.5">Market</p>
            <p className="text-lg font-bold text-white">{Math.round(topic.price)}¢</p>
          </div>
          {stats.avg_ai_score != null && (
            <>
              <div className="w-px h-8 bg-surface-300" />
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-widest mb-0.5">Avg Quality</p>
                <p className="text-lg font-bold text-gold">{stats.avg_ai_score}/10</p>
              </div>
            </>
          )}
        </div>

        <Link
          href={`/topic/${topic.id}/arguments`}
          className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
        >
          Submit argument
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Argument balance bar */}
      <div>
        <div className="h-2 rounded-full overflow-hidden bg-surface-300">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-500 transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-for-400">{forPct}% FOR</span>
          <span className="text-[10px] text-against-400">{100 - forPct}% AGAINST</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against'
type SortMode = 'top' | 'new' | 'quality'

interface Props {
  id: string
}

export function ArgumentsClient({ id }: Props) {
  const [data, setData] = useState<MarketArgumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [side, setSide] = useState<SideFilter>('all')
  const [sort, setSort] = useState<SortMode>('top')
  const [offset, setOffset] = useState(0)
  const [allArgs, setAllArgs] = useState<MarketArgument[]>([])
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 20

  const load = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset
      if (reset) {
        setLoading(true)
        setAllArgs([])
        setOffset(0)
      } else {
        setRefreshing(true)
      }

      try {
        const url = `/api/exchange/${id}/arguments?side=${side}&sort=${sort}&limit=${LIMIT}&offset=${currentOffset}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed')
        const json: MarketArgumentsResponse = await res.json()

        if (reset) {
          setData(json)
          setAllArgs(json.arguments)
        } else {
          setData((prev) => (prev ? { ...prev, ...json } : json))
          setAllArgs((prev) => [...prev, ...json.arguments])
        }
        setHasMore(currentOffset + LIMIT < (json.total ?? 0))
        if (!reset) setOffset(currentOffset + LIMIT)
      } catch {
        // silent
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id, side, sort, offset],
  )

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, sort])

  const loadMore = () => {
    if (!refreshing && hasMore) load(false)
  }

  const forArgs = side === 'all' ? allArgs.filter((a) => a.side === 'blue') : allArgs.filter((a) => a.side === 'blue')
  const againstArgs = side === 'all' ? allArgs.filter((a) => a.side === 'red') : allArgs.filter((a) => a.side === 'red')
  const displayArgs = side === 'all' ? allArgs : side === 'for' ? allArgs.filter((a) => a.side === 'blue') : allArgs.filter((a) => a.side === 'red')

  return (
    <div className="min-h-screen bg-surface-950 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Back nav */}
        <div className="flex items-center gap-2">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-xs text-surface-400 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Arguments
          </span>
        </div>

        {/* Title */}
        {data && !loading && (
          <div>
            <h1 className="text-sm font-semibold text-white leading-snug">
              {data.topic.statement}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-surface-500 uppercase tracking-widest">
                {data.topic.category ?? 'General'}
              </span>
              <span className="text-surface-600">·</span>
              <span className="text-[10px] text-surface-500">
                {data.topic.total_votes.toLocaleString()} votes
              </span>
              <span className="text-surface-600">·</span>
              <span
                className={cn(
                  'text-[10px] font-semibold',
                  data.topic.status === 'law'
                    ? 'text-gold'
                    : data.topic.status === 'failed'
                    ? 'text-against-400'
                    : 'text-for-400',
                )}
              >
                {data.topic.status === 'law'
                  ? '⚖ Law'
                  : data.topic.status === 'failed'
                  ? '✕ Failed'
                  : '● Active'}
              </span>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {loading ? (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ) : data ? (
          <StatsBar data={data} />
        ) : null}

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Side filter */}
          <div className="flex items-center bg-surface-200 border border-surface-300 rounded-lg p-0.5 gap-0.5">
            {(['all', 'for', 'against'] as SideFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize',
                  side === s
                    ? s === 'for'
                      ? 'bg-for-600 text-white'
                      : s === 'against'
                      ? 'bg-against-600 text-white'
                      : 'bg-surface-100 text-white'
                    : 'text-surface-400 hover:text-white',
                )}
              >
                {s === 'for' ? 'FOR' : s === 'against' ? 'AGAINST' : 'All'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center bg-surface-200 border border-surface-300 rounded-lg p-0.5 gap-0.5 ml-auto">
            {(
              [
                { key: 'top', label: 'Top', icon: TrendingUp },
                { key: 'new', label: 'New', icon: Zap },
                { key: 'quality', label: 'Quality', icon: Star },
              ] as { key: SortMode; label: string; icon: typeof TrendingUp }[]
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                  sort === key
                    ? 'bg-surface-100 text-white'
                    : 'text-surface-400 hover:text-white',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Argument list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ArgumentSkeleton key={i} />
            ))}
          </div>
        ) : displayArgs.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="No arguments yet"
            description={
              side === 'for'
                ? 'No FOR arguments have been submitted for this market yet.'
                : side === 'against'
                ? 'No AGAINST arguments have been submitted for this market yet.'
                : 'No arguments have been submitted for this market yet. Be the first.'
            }
            action={
              <Link
                href={`/topic/${id}/arguments`}
                className="inline-flex items-center gap-1.5 text-sm text-for-400 hover:text-for-300 transition-colors"
              >
                Add the first argument
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        ) : (
          <>
            {side === 'all' ? (
              /* Two-column split view for "all" */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-for-400 flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    FOR ({data?.stats.total_for ?? 0})
                  </p>
                  <AnimatePresence mode="popLayout">
                    {forArgs.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} topicId={id} index={i} />
                    ))}
                  </AnimatePresence>
                  {forArgs.length === 0 && (
                    <p className="text-xs text-surface-500 italic">No FOR arguments yet</p>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-against-400 flex items-center gap-1">
                    <ThumbsDown className="h-3 w-3" />
                    AGAINST ({data?.stats.total_against ?? 0})
                  </p>
                  <AnimatePresence mode="popLayout">
                    {againstArgs.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} topicId={id} index={i} />
                    ))}
                  </AnimatePresence>
                  {againstArgs.length === 0 && (
                    <p className="text-xs text-surface-500 italic">No AGAINST arguments yet</p>
                  )}
                </div>
              </div>
            ) : (
              /* Single-column for filtered view */
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {displayArgs.map((arg, i) => (
                    <ArgumentCard key={arg.id} arg={arg} topicId={id} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={loadMore}
                  disabled={refreshing}
                  className="w-full py-2.5 rounded-lg border border-surface-300 bg-surface-200 hover:bg-surface-100 text-xs text-surface-400 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {refreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Load more
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* CTA footer */}
        {!loading && data && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-white">Have a take?</p>
              <p className="text-[11px] text-surface-400 mt-0.5">
                Submit your argument and earn upvotes from the community.
              </p>
            </div>
            <Link
              href={`/topic/${id}/arguments`}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-semibold transition-colors"
            >
              Add Argument
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Related exchange pages */}
        {!loading && data && (
          <div className="flex flex-wrap gap-2 pb-2">
            <Link
              href={`/exchange/${id}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
            >
              Market
            </Link>
            <Link
              href={`/exchange/${id}/signal`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-emerald/40 text-xs text-surface-500 hover:text-emerald transition-colors"
            >
              Signal
            </Link>
            <Link
              href={`/exchange/${id}/catalysts`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
            >
              Catalysts
            </Link>
            <Link
              href={`/exchange/${id}/debates`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-500 hover:text-white transition-colors"
            >
              Debates
            </Link>
            <Link
              href={`/exchange/${id}/commentary`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
            >
              Commentary
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
