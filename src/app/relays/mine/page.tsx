'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Link2,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MineRelaysResponse, MyRelayEntry, MyRelayStat } from '@/app/api/relays/mine/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: MyRelayEntry['relay_status'] }) {
  const config: Record<MyRelayEntry['relay_status'], { label: string; cls: string }> = {
    open:        { label: 'Open',        cls: 'text-emerald border-emerald/30 bg-emerald/10' },
    in_progress: { label: 'In Progress', cls: 'text-gold border-gold/30 bg-gold/10' },
    complete:    { label: 'Complete',    cls: 'text-for-400 border-for-500/30 bg-for-500/10' },
    voted:       { label: 'Voted',       cls: 'text-surface-400 border-surface-400/30 bg-surface-300/10' },
  }
  const { label, cls } = config[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', cls)}>
      {label}
    </span>
  )
}

// ─── Leg progress dots ────────────────────────────────────────────────────────

function LegDots({
  filled,
  total,
  myLegNumbers,
  isFor,
}: {
  filled: number
  total: number
  myLegNumbers: Set<number>
  isFor: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < filled
        const isMine = myLegNumbers.has(i + 1)
        return (
          <div
            key={i}
            title={isMine ? `My leg #${i + 1}` : isFilled ? `Leg #${i + 1}` : 'Empty'}
            className={cn(
              'h-2 w-2 rounded-full border transition-all',
              isMine
                ? isFor
                  ? 'bg-for-400 border-for-300 ring-1 ring-for-300/50'
                  : 'bg-against-400 border-against-300 ring-1 ring-against-300/50'
                : isFilled
                  ? isFor ? 'bg-for-700/60 border-for-600/40' : 'bg-against-700/60 border-against-600/40'
                  : 'bg-surface-300/40 border-surface-400/30',
            )}
          />
        )
      })}
    </div>
  )
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: MyRelayStat }) {
  const tiles = [
    {
      icon: <Link2 className="h-4 w-4" />,
      label: 'Legs Written',
      value: stats.legs_written,
      cls: 'text-for-400',
      sub: null,
    },
    {
      icon: <GitBranch className="h-4 w-4" />,
      label: 'Relays Started',
      value: stats.relays_started,
      cls: 'text-gold',
      sub: null,
    },
    {
      icon: <Trophy className="h-4 w-4" />,
      label: 'Completed',
      value: stats.relays_completed,
      cls: 'text-emerald',
      sub: null,
    },
    {
      icon: <Star className="h-4 w-4" />,
      label: 'Stars Received',
      value: stats.leg_stars_received,
      cls: 'text-gold',
      sub: null,
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: 'Compelling Rate',
      value: stats.compelling_rate !== null ? `${stats.compelling_rate}%` : '—',
      cls: stats.compelling_rate !== null && stats.compelling_rate >= 60 ? 'text-emerald' : 'text-surface-400',
      sub: stats.compelling_votes + stats.not_compelling_votes > 0
        ? `${stats.compelling_votes}↑ / ${stats.not_compelling_votes}↓`
        : null,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col gap-1 rounded-xl border border-surface-300 bg-surface-100 p-3"
        >
          <div className={cn('flex items-center gap-1.5', t.cls)}>
            {t.icon}
            <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wider">{t.label}</span>
          </div>
          <span className={cn('text-2xl font-bold tabular-nums', t.cls)}>{t.value}</span>
          {t.sub && (
            <span className="text-[10px] font-mono text-surface-500">{t.sub}</span>
          )}
        </div>
      ))}
    </motion.div>
  )
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, index }: { entry: MyRelayEntry; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const isFor = entry.relay_side === 'for'
  const myLegNumbers = new Set(entry.my_legs.map((l) => l.leg_number))

  const totalVotes = entry.relay_vote_compelling + entry.relay_vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((entry.relay_vote_compelling / totalVotes) * 100) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Header row */}
      <div className="p-3.5 flex flex-col gap-2">
        {/* Top line: status + side + started badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={entry.relay_status} />
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              isFor
                ? 'text-for-400 border-for-500/30 bg-for-500/10'
                : 'text-against-400 border-against-500/30 bg-against-500/10',
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {entry.relay_started_by_me && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border text-gold border-gold/30 bg-gold/10">
              Starter
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono text-surface-500">
            {relativeTime(entry.relay_created_at)}
          </span>
        </div>

        {/* Topic statement */}
        {entry.topic_statement && (
          <p className="text-sm text-white leading-snug line-clamp-2">
            {entry.topic_statement}
          </p>
        )}

        {/* Leg dots + vote bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LegDots
              filled={entry.all_legs_count}
              total={entry.relay_max_legs}
              myLegNumbers={myLegNumbers}
              isFor={isFor}
            />
            <span className="text-[10px] font-mono text-surface-500">
              {entry.all_legs_count}/{entry.relay_max_legs} legs · {entry.my_legs.length} mine
            </span>
          </div>

          {totalVotes > 0 && (
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-3 w-3 text-emerald" />
              <span className="text-[10px] font-mono text-emerald">{entry.relay_vote_compelling}</span>
              <ThumbsDown className="h-3 w-3 text-against-400" />
              <span className="text-[10px] font-mono text-against-400">{entry.relay_vote_not_compelling}</span>
              {compellingPct !== null && (
                <span className="text-[10px] font-mono text-surface-500">({compellingPct}% compelling)</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href={`/relays/${entry.relay_id}`}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
              isFor
                ? 'bg-for-700/30 text-for-400 hover:bg-for-700/50'
                : 'bg-against-700/30 text-against-400 hover:bg-against-700/50',
            )}
          >
            View relay <ArrowRight className="h-3 w-3" />
          </Link>

          {entry.my_legs.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
            >
              My legs
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded: my legs */}
      <AnimatePresence initial={false}>
        {expanded && entry.my_legs.length > 0 && (
          <motion.div
            key="legs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('border-t border-surface-300/60 divide-y divide-surface-300/40')}>
              {entry.my_legs.map((leg) => (
                <div key={leg.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={cn(
                        'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                        isFor ? 'bg-for-700/30 text-for-400' : 'bg-against-700/30 text-against-400',
                      )}
                    >
                      Leg {leg.leg_number}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500">{relativeTime(leg.created_at)}</span>
                    {leg.upvote_count > 0 && (
                      <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-mono text-gold">
                        <Star className="h-3 w-3 fill-gold" />
                        {leg.upvote_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed line-clamp-4">{leg.content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EntrySkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function MyRelaysPage() {
  const router = useRouter()
  const [data, setData] = useState<MineRelaysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(async (pageOffset: number, replace: boolean) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const res = await fetch(`/api/relays/mine?limit=${PAGE_SIZE}&offset=${pageOffset}`, {
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load relay contributions')

      const json = (await res.json()) as MineRelaysResponse

      setData((prev) => {
        if (replace || !prev) return json
        return {
          ...json,
          entries: [...prev.entries, ...json.entries],
        }
      })
      setHasMore(pageOffset + PAGE_SIZE < json.total)
      setOffset(pageOffset)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [router])

  useEffect(() => {
    fetchPage(0, true)
  }, [fetchPage])

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    fetchPage(offset + PAGE_SIZE, false)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-for-400" />
              My Relay Contributions
            </h1>
            <p className="text-xs font-mono text-surface-400 mt-0.5">
              Every civic relay you&apos;ve written a leg for
            </p>
          </div>
          <button
            onClick={() => fetchPage(0, true)}
            className="p-2 rounded-lg hover:bg-surface-200 text-surface-400 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Nav link to all relays */}
        <div className="flex gap-2 text-xs font-mono">
          <Link href="/relays" className="text-surface-400 hover:text-white transition-colors">
            Browse all relays
          </Link>
          <span className="text-surface-600">·</span>
          <Link href="/relays/create" className="text-for-400 hover:text-for-300 transition-colors">
            + New relay
          </Link>
          <span className="text-surface-600">·</span>
          <Link href="/relays/invitations" className="inline-flex items-center gap-1 text-purple hover:text-purple/80 transition-colors">
            <UserPlus className="h-3 w-3" />
            Invitations
          </Link>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <StatsPanel stats={data.stats} />
        ) : null}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-sm text-against-300">
            {error}
          </div>
        )}

        {/* Entries */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <EntrySkeleton key={i} />
            ))}
          </div>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No relay contributions yet"
            description="Join a civic relay and write a leg to see your contributions here."
            action={{ label: 'Browse relays', href: '/relays', variant: 'primary' }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {data.entries.map((entry, i) => (
                <EntryRow key={entry.relay_id} entry={entry} index={i} />
              ))}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                  </span>
                ) : (
                  `Load more (${data.total - data.entries.length} remaining)`
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
