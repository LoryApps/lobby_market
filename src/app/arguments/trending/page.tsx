'use client'

/**
 * /arguments/trending — Argument Velocity Leaderboard
 *
 * Shows the arguments with the highest upvote velocity (upvotes per hour
 * since creation) from the last 7 days. Rewards fresh arguments that are
 * gaining traction NOW, not just all-time classics.
 *
 * FOR (blue) vs AGAINST (red) in a split-panel layout.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
  Tag,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { TrendingArgument, TrendingArgumentsResponse } from '@/app/api/arguments/trending/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const HEAT_CONFIG = {
  fire: {
    label: 'On Fire',
    icon: Flame,
    bg: 'bg-against-500/15 border-against-500/30',
    text: 'text-against-300',
    badge: 'bg-against-500/20 text-against-300 border-against-500/40',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  },
  hot: {
    label: 'Hot',
    icon: TrendingUp,
    bg: 'bg-gold/10 border-gold/30',
    text: 'text-gold',
    badge: 'bg-gold/20 text-gold border-gold/40',
    glow: 'shadow-[0_0_12px_rgba(201,168,76,0.12)]',
  },
  warm: {
    label: 'Rising',
    icon: Zap,
    bg: 'bg-surface-200 border-surface-300',
    text: 'text-surface-500',
    badge: 'bg-surface-300/40 text-surface-500 border-surface-400/40',
    glow: '',
  },
} as const

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function velocityLabel(v: number): string {
  if (v >= 2) return `${v.toFixed(1)} upvotes/hr`
  if (v >= 0.5) return `${v.toFixed(2)}/hr`
  return `${(v * 60).toFixed(1)}/min avg`
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function ArgSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-surface-300" />
        <div className="h-3 w-24 bg-surface-300 rounded-full" />
        <div className="ml-auto h-5 w-16 bg-surface-300 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-surface-300 rounded" />
        <div className="h-3.5 w-5/6 bg-surface-300 rounded" />
        <div className="h-3.5 w-4/6 bg-surface-300 rounded" />
      </div>
      <div className="h-3 w-32 bg-surface-300 rounded-full" />
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  rank,
}: {
  arg: TrendingArgument
  rank: number
}) {
  const heat = HEAT_CONFIG[arg.heat]
  const HeatIcon = heat.icon
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-shadow',
        heat.bg,
        heat.glow
      )}
    >
      {/* Header: rank + heat badge + velocity */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold font-mono',
            rank === 0
              ? 'bg-gold/30 text-gold border border-gold/50'
              : 'bg-surface-300/50 text-surface-500 border border-surface-400/30'
          )}
        >
          {rank + 1}
        </span>

        <span
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
            heat.badge
          )}
        >
          <HeatIcon className="h-2.5 w-2.5" aria-hidden />
          {heat.label}
        </span>

        <span className={cn('text-[10px] font-mono ml-auto', heat.text)}>
          {velocityLabel(arg.velocity)}
        </span>
      </div>

      {/* Author */}
      {arg.author ? (
        <div className="flex items-center gap-2">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="xs"
            className="flex-shrink-0"
          />
          <Link
            href={`/profile/${arg.author.username}`}
            className="text-xs font-semibold text-surface-700 hover:text-white transition-colors truncate"
          >
            {arg.author.display_name ?? arg.author.username}
          </Link>
          {arg.author.role !== 'person' && (
            <span className="text-[10px] font-mono text-gold/70 flex-shrink-0">
              {ROLE_LABEL[arg.author.role] ?? arg.author.role}
            </span>
          )}
          <span className="text-[10px] text-surface-500 ml-auto flex-shrink-0">
            {relativeTime(arg.created_at)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-surface-300 flex-shrink-0" />
          <span className="text-xs text-surface-500">Anonymous</span>
        </div>
      )}

      {/* Content */}
      <blockquote
        className={cn(
          'text-sm leading-relaxed',
          isFor ? 'text-for-200' : 'text-against-200'
        )}
      >
        <span
          className={cn(
            'text-lg font-bold leading-none mr-1',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
          aria-hidden
        >
          &ldquo;
        </span>
        {renderWithMentions(truncate(arg.content, 240))}
        <span
          className={cn(
            'text-lg font-bold leading-none ml-1',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
          aria-hidden
        >
          &rdquo;
        </span>
      </blockquote>

      {/* Footer: upvotes + topic link */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden />
          )}
          <span className="text-xs font-mono font-semibold text-white">
            {arg.upvotes.toLocaleString()}
          </span>
          <span className="text-[10px] text-surface-500">upvotes</span>

          {arg.topic?.category && (
            <>
              <span className="text-surface-600 mx-1" aria-hidden>·</span>
              <span className="text-[10px] font-mono text-surface-500">
                {arg.topic.category}
              </span>
            </>
          )}
        </div>

        {arg.topic && (
          <Link
            href={`/topic/${arg.topic_id}`}
            className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            aria-label={`View topic: ${arg.topic.statement}`}
          >
            {arg.topic.status && (
              <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'}>
                {arg.topic.status === 'law'
                  ? 'LAW'
                  : arg.topic.status === 'voting'
                  ? 'Voting'
                  : arg.topic.status === 'active'
                  ? 'Active'
                  : arg.topic.status === 'failed'
                  ? 'Failed'
                  : 'Proposed'}
              </Badge>
            )}
            <span className="truncate max-w-[120px]">
              {truncate(arg.topic.statement, 40)}
            </span>
            <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColumnHeader({
  side,
  count,
}: {
  side: 'for' | 'against'
  count: number
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-1 py-2 mb-3 border-b',
        isFor ? 'border-for-500/30' : 'border-against-500/30'
      )}
    >
      {isFor ? (
        <ThumbsUp
          className="h-4 w-4 text-for-400"
          aria-hidden
        />
      ) : (
        <ThumbsDown
          className="h-4 w-4 text-against-400"
          aria-hidden
        />
      )}
      <span
        className={cn(
          'text-sm font-bold font-mono tracking-wide',
          isFor ? 'text-for-300' : 'text-against-300'
        )}
      >
        {isFor ? 'FOR' : 'AGAINST'}
      </span>
      <span className="text-xs text-surface-500 font-mono ml-1">
        {count} trending
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrendingArgumentsPage() {
  const [data, setData] = useState<TrendingArgumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchTrending = useCallback(
    async (cat: string, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({ limit: '10' })
        if (cat) params.set('category', cat)
        const res = await fetch(`/api/arguments/trending?${params}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: TrendingArgumentsResponse = await res.json()
        setData(json)
        setLastUpdated(new Date())
      } catch {
        setError('Could not load trending arguments. Try again.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchTrending(category)
  }, [category, fetchTrending])

  const isEmpty =
    !loading && !error && data?.for.length === 0 && data?.against.length === 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-3 pb-24 pt-4">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/arguments"
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to Top Arguments"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-against-400 flex-shrink-0" aria-hidden />
              <h1 className="text-base font-bold text-white tracking-tight">
                Trending Arguments
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-against-500/15 border border-against-500/30 text-[10px] font-mono font-semibold text-against-300 flex-shrink-0">
                LIVE
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Highest upvote velocity from the last 7 days — what the Lobby is rallying around
              right now
            </p>
          </div>

          <button
            onClick={() => fetchTrending(category, true)}
            disabled={refreshing || loading}
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white disabled:opacity-40 transition-colors"
            aria-label="Refresh trending"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
              aria-hidden
            />
          </button>
        </div>

        {/* Category filter chips */}
        <div
          className={cn(
            'flex items-center gap-1.5 mb-4',
            'overflow-x-auto pb-1',
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
          )}
          role="group"
          aria-label="Filter by category"
        >
          <Tag className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden />

          <button
            onClick={() => setCategory('')}
            aria-pressed={category === ''}
            className={cn(
              'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
              category === ''
                ? 'bg-surface-400 text-white border-surface-400'
                : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-300 hover:border-surface-400'
            )}
          >
            All
          </button>

          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat === category ? '' : cat)}
              aria-pressed={category === cat}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
                category === cat
                  ? 'bg-against-600/80 text-white border-against-600'
                  : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-300 hover:border-surface-400'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Heat key legend */}
        <div className="flex items-center gap-3 mb-4 px-1">
          {(Object.entries(HEAT_CONFIG) as [keyof typeof HEAT_CONFIG, (typeof HEAT_CONFIG)[keyof typeof HEAT_CONFIG]][]).map(
            ([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <div key={key} className="flex items-center gap-1">
                  <Icon className={cn('h-3 w-3', cfg.text)} aria-hidden />
                  <span className="text-[10px] font-mono text-surface-500">
                    {cfg.label}
                  </span>
                </div>
              )
            }
          )}
          <span className="text-[10px] text-surface-600 ml-auto">
            Sorted by upvotes/hr
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-4 text-sm text-against-300 text-center mb-4">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="h-8 w-32 bg-surface-300 rounded-full animate-pulse mb-3" />
              {[...Array(4)].map((_, i) => (
                <ArgSkeleton key={i} />
              ))}
            </div>
            <div className="space-y-3">
              <div className="h-8 w-32 bg-surface-300 rounded-full animate-pulse mb-3" />
              {[...Array(4)].map((_, i) => (
                <ArgSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <EmptyState
            icon={Scale}
            title="No trending arguments yet"
            description={
              category
                ? `No ${category} arguments with upvotes in the last 7 days. Try another category.`
                : 'No arguments with upvotes in the last 7 days. Be the first to make an argument and earn upvotes.'
            }
            actions={[
              { label: 'Browse all arguments', href: '/arguments' },
            ]}
          />
        )}

        {/* Split FOR vs AGAINST grid */}
        {!loading && !error && data && (data.for.length > 0 || data.against.length > 0) && (
          <AnimatePresence mode="wait">
            <motion.div
              key={category || 'all'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* FOR column */}
              <section aria-label="Trending FOR arguments">
                <ColumnHeader side="for" count={data.for.length} />
                {data.for.length === 0 ? (
                  <p className="text-xs text-surface-500 text-center py-8">
                    No trending FOR arguments in this category.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.for.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} rank={i} />
                    ))}
                  </div>
                )}
              </section>

              {/* AGAINST column */}
              <section aria-label="Trending AGAINST arguments">
                <ColumnHeader side="against" count={data.against.length} />
                {data.against.length === 0 ? (
                  <p className="text-xs text-surface-500 text-center py-8">
                    No trending AGAINST arguments in this category.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.against.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} rank={i} />
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer: last updated + link to all-time top */}
        {!loading && lastUpdated && (
          <div className="mt-6 flex items-center justify-between text-[11px] text-surface-600 font-mono">
            <span>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <Link
              href="/arguments"
              className="flex items-center gap-1 hover:text-surface-400 transition-colors"
            >
              <TrendingUp className="h-3 w-3" aria-hidden />
              All-time top arguments
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
