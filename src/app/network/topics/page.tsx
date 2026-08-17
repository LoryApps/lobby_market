'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Eye,
  FileText,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
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
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import type {
  NetworkTopicItem,
  NetworkTopicRelation,
  NetworkTopicsResponse,
} from '@/app/api/network/topics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const RELATION_CONFIG: Record<
  NetworkTopicRelation,
  { verb: string; icon: typeof FileText; color: string; iconBg: string }
> = {
  voted: {
    verb: 'voted on',
    icon: Scale,
    color: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  proposed: {
    verb: 'proposed',
    icon: FileText,
    color: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  argued: {
    verb: 'argued on',
    icon: MessageSquare,
    color: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicItemSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-surface-100 border border-surface-300 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single topic item ────────────────────────────────────────────────────────

function NetworkTopicCard({ item }: { item: NetworkTopicItem }) {
  const cfg = RELATION_CONFIG[item.relation]
  const RelIcon = cfg.icon
  const signal = getTopicSignal(item.topic)
  const forPct = Math.round(item.topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors space-y-3">
        {/* Actor row */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('flex-shrink-0 p-1.5 rounded-lg', cfg.iconBg)}>
            <RelIcon className={cn('h-3.5 w-3.5', cfg.color)} />
          </div>
          <Link
            href={`/profile/${item.actor.username}`}
            className="flex items-center gap-2 min-w-0 group"
          >
            <Avatar
              src={item.actor.avatar_url}
              fallback={item.actor.display_name ?? item.actor.username}
              size="xs"
            />
            <span className="text-xs font-semibold text-surface-300 group-hover:text-white transition-colors truncate">
              {item.actor.display_name ?? item.actor.username}
            </span>
          </Link>
          <span className={cn('text-xs font-mono flex-shrink-0', cfg.color)}>
            {cfg.verb}
          </span>

          {/* Vote side badge */}
          {item.relation === 'voted' && item.vote_side && (
            <span
              className={cn(
                'ml-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold flex-shrink-0',
                item.vote_side === 'blue'
                  ? 'bg-for-500/15 text-for-300'
                  : 'bg-against-500/15 text-against-300',
              )}
            >
              {item.vote_side === 'blue' ? (
                <ThumbsUp className="h-2.5 w-2.5" />
              ) : (
                <ThumbsDown className="h-2.5 w-2.5" />
              )}
              {item.vote_side === 'blue' ? 'For' : 'Against'}
            </span>
          )}

          <span className="ml-auto flex-shrink-0 text-[11px] font-mono text-surface-500">
            {relativeTime(item.acted_at)}
          </span>
        </div>

        {/* Topic card */}
        <Link
          href={`/topic/${item.topic.id}`}
          className="block rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 p-3 transition-colors group"
        >
          <div className="flex items-start gap-2 mb-2">
            {item.topic.status === 'law' ? (
              <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            ) : item.topic.status === 'voting' ? (
              <Scale className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
            ) : (
              <Zap className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
              {item.topic.statement}
            </p>
          </div>

          {/* Vote bar */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-mono font-bold text-for-400 w-8 text-right tabular-nums">
              {forPct}%
            </span>
            <div className="flex-1 h-1.5 bg-surface-400 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-against-400 w-8 tabular-nums">
              {againstPct}%
            </span>
          </div>

          {/* Footer row */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.topic.category && (
              <Badge variant="proposed" size="sm">
                {item.topic.category}
              </Badge>
            )}
            <Badge
              variant={STATUS_BADGE[item.topic.status] ?? 'proposed'}
              size="sm"
            >
              {item.topic.status === 'law'
                ? 'LAW'
                : item.topic.status.charAt(0).toUpperCase() + item.topic.status.slice(1)}
            </Badge>
            {signal && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold',
                  SIGNAL_PILL_CLASSES[signal.id],
                )}
              >
                {signal.label}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Eye className="h-3 w-3" />
              {item.topic.total_votes.toLocaleString()}
            </span>
          </div>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Tab bar (shared layout) ──────────────────────────────────────────────────

function NetworkTabBar({ active }: { active: string }) {
  const tabs = [
    { label: 'Topics', href: '/network/topics' },
    { label: 'Votes', href: '/network/votes' },
    { label: 'Arguments', href: '/network/arguments' },
    { label: 'Achievements', href: '/network/achievements' },
    { label: 'Debates', href: '/network/debates' },
    { label: 'Laws', href: '/network/laws' },
    { label: 'People', href: '/network/people' },
    { label: 'Coalitions', href: '/network/coalitions' },
    { label: 'Predictions', href: '/network/predictions' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 mb-4 mx-4 sm:mx-0 rounded-xl bg-surface-100 border border-surface-300 w-fit">
      {tabs.map((t) =>
        t.href === active ? (
          <span
            key={t.href}
            className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-surface-200 border border-surface-300 text-white"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            {t.label}
          </Link>
        ),
      )}
    </div>
  )
}

// ─── Filter pill row ──────────────────────────────────────────────────────────

type FilterType = 'all' | NetworkTopicRelation

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  voted: 'Voted',
  proposed: 'Proposed',
  argued: 'Argued',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkTopicsPage() {
  const router = useRouter()
  const [data, setData] = useState<NetworkTopicsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const mountedRef = useRef(true)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/network/topics?limit=60')
      if (res.status === 401) { router.replace('/login'); return }
      if (res.ok && mountedRef.current) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [router])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  const items = data?.items ?? []
  const filtered =
    filter === 'all' ? items : items.filter((i) => i.relation === filter)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Network Topics</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Topics your network has voted on, proposed, or engaged with
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-4 sm:px-4">
          <NetworkTabBar active="/network/topics" />
        </div>

        {/* Filter pills */}
        {!loading && items.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            {(['all', 'voted', 'proposed', 'argued'] as FilterType[]).map((f) => {
              const count =
                f === 'all'
                  ? items.length
                  : items.filter((i) => i.relation === f).length
              if (f !== 'all' && count === 0) return null
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-all flex-shrink-0',
                    filter === f
                      ? 'bg-for-600 text-white'
                      : 'bg-surface-100 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {FILTER_LABELS[f]}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
        <div className="px-4 space-y-2">
          {loading ? (
            <TopicItemSkeleton />
          ) : data?.is_empty || items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No network activity yet"
              description="Follow more people to see the topics they're engaging with."
              actions={[
                { label: 'Find people to follow', href: '/search?tab=people' },
                { label: 'Browse trending', href: '/trending', variant: 'secondary' },
              ]}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={`No ${FILTER_LABELS[filter].toLowerCase()} topics`}
              description="Try a different filter to see more activity."
              action={{ label: 'Show all', onClick: () => setFilter('all') }}
            />
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((item) => (
                <NetworkTopicCard key={item.key} item={item} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Following count footer */}
        {!loading && !data?.is_empty && (data?.following_count ?? 0) > 0 && (
          <p className="text-center text-xs font-mono text-surface-500 mt-6 px-4">
            Showing topics from {data!.following_count} people you follow
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
