'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Megaphone,
  RefreshCw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ActivityItem, ActivityPost, ActivityStance, ActivityResponse } from '@/app/api/coalitions/activity/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STANCE_CONFIG = {
  for:     { label: 'FOR',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: ThumbsUp },
  against: { label: 'AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: ThumbsDown },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-300/20', icon: Shield },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Coalition badge ──────────────────────────────────────────────────────────

function CoalitionBadge({ name, id, memberCount }: { name: string; id: string; memberCount: number }) {
  return (
    <Link
      href={`/coalitions/${id}`}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple/10 border border-purple/30 hover:bg-purple/20 transition-colors group"
    >
      <Users className="h-3 w-3 text-purple" aria-hidden="true" />
      <span className="font-mono text-[11px] font-semibold text-purple group-hover:text-purple/80 truncate max-w-[160px]">
        {name}
      </span>
      <span className="font-mono text-[10px] text-surface-500">{memberCount.toLocaleString()}</span>
    </Link>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ item }: { item: ActivityPost }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3',
        item.is_pinned && 'border-gold/30 bg-gold/[0.03]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <CoalitionBadge name={item.coalition_name} id={item.coalition_id} memberCount={item.member_count} />
          {item.is_pinned && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-gold/10 text-gold border border-gold/30">
              PINNED
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-surface-200 text-surface-500 border border-surface-300">
            <Megaphone className="h-2.5 w-2.5" aria-hidden="true" />
            BULLETIN
          </span>
        </div>
        <time
          dateTime={item.created_at}
          className="font-mono text-[10px] text-surface-500 flex-shrink-0"
        >
          {relativeTime(item.created_at)}
        </time>
      </div>

      {/* Content */}
      <p className="font-mono text-sm text-surface-700 leading-relaxed whitespace-pre-line">
        {item.content}
      </p>

      {/* Author */}
      {item.author && (
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
          <Avatar
            src={item.author.avatar_url}
            fallback={item.author.display_name || item.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${item.author.username}`}
            className="font-mono text-[11px] text-surface-500 hover:text-white transition-colors"
          >
            {item.author.display_name ?? `@${item.author.username}`}
          </Link>
          <span className="font-mono text-[10px] text-surface-600">posted</span>
        </div>
      )}
    </motion.article>
  )
}

// ─── Stance card ──────────────────────────────────────────────────────────────

function StanceCard({ item }: { item: ActivityStance }) {
  const cfg = STANCE_CONFIG[item.stance]
  const Icon = cfg.icon
  const catColor = CATEGORY_COLORS[item.topic_category ?? ''] ?? 'text-surface-500'

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <CoalitionBadge name={item.coalition_name} id={item.coalition_id} memberCount={item.member_count} />
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border',
              cfg.bg, cfg.border, cfg.color
            )}
          >
            <Icon className="h-2.5 w-2.5" aria-hidden="true" />
            {cfg.label}
          </span>
        </div>
        <time
          dateTime={item.created_at}
          className="font-mono text-[10px] text-surface-500 flex-shrink-0"
        >
          {relativeTime(item.created_at)}
        </time>
      </div>

      {/* Topic link */}
      <Link
        href={`/topic/${item.topic_id}`}
        className="block group"
      >
        <div className="flex items-start gap-2 rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2.5 hover:border-surface-400 transition-colors">
          <Zap className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            {item.topic_category && (
              <p className={cn('font-mono text-[10px] uppercase tracking-wider mb-0.5', catColor)}>
                {item.topic_category}
              </p>
            )}
            <p className="font-mono text-xs text-white group-hover:text-for-300 transition-colors leading-snug">
              {item.topic_statement}
            </p>
          </div>
        </div>
      </Link>

      {/* Optional stance statement */}
      {item.statement && (
        <p className="font-mono text-sm text-surface-600 leading-relaxed italic">
          &ldquo;{item.statement}&rdquo;
        </p>
      )}

      {/* Declarer */}
      {item.declarer && (
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
          <Avatar
            src={item.declarer.avatar_url}
            fallback={item.declarer.display_name || item.declarer.username}
            size="xs"
          />
          <Link
            href={`/profile/${item.declarer.username}`}
            className="font-mono text-[11px] text-surface-500 hover:text-white transition-colors"
          >
            {item.declarer.display_name ?? `@${item.declarer.username}`}
          </Link>
          <span className="font-mono text-[10px] text-surface-600">declared stance</span>
        </div>
      )}
    </motion.article>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterType = 'all' | 'post' | 'stance'

const FILTERS: { id: FilterType; label: string; icon: typeof Users }[] = [
  { id: 'all',    label: 'All Activity', icon: Users },
  { id: 'post',   label: 'Bulletins',    icon: Megaphone },
  { id: 'stance', label: 'Stances',      icon: Zap },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function CoalitionFeedPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const refreshing = useRef(false)

  const fetchItems = useCallback(
    async (type: FilterType, off: number, replace: boolean) => {
      if (refreshing.current) return
      refreshing.current = true
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          type,
          limit: String(PAGE_SIZE),
          offset: String(off),
        })
        const res = await fetch(`/api/coalitions/activity?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: ActivityResponse = await res.json()

        if (replace) {
          setItems(data.items)
        } else {
          setItems((prev) => [...prev, ...data.items])
        }
        setHasMore(data.has_more)
        setOffset(off + data.items.length)
      } catch {
        setError('Could not load coalition activity. Try again.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        refreshing.current = false
      }
    },
    []
  )

  // Initial load + refetch on filter change
  useEffect(() => {
    setOffset(0)
    fetchItems(filter, 0, true)
  }, [filter, fetchItems])

  function handleRefresh() {
    setOffset(0)
    fetchItems(filter, 0, true)
  }

  function handleLoadMore() {
    fetchItems(filter, offset, false)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/coalitions"
            aria-label="Back to coalitions"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple" aria-hidden="true" />
              Coalition Activity
            </h1>
            <p className="font-mono text-xs text-surface-500 mt-0.5">
              Bulletins and stance declarations from public coalitions
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh activity feed"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Filter activity type"
          className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300 mb-5"
        >
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                'flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                filter === id
                  ? 'bg-surface-100 text-white border border-surface-400'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Feed ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <p className="font-mono text-sm text-against-400 mb-3">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white font-mono text-xs transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No activity yet"
            description={
              filter === 'post'
                ? 'No coalition bulletins have been posted yet. Coalition leaders can post announcements to their members.'
                : filter === 'stance'
                ? 'No stances have been declared yet. Coalitions can declare FOR, AGAINST, or NEUTRAL positions on active topics.'
                : 'No coalition activity yet. Join or create a coalition to start participating.'
            }
            actions={[{ label: 'Browse coalitions', href: '/coalitions' }]}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) =>
                item.type === 'post' ? (
                  <PostCard key={`post-${item.id}`} item={item} />
                ) : (
                  <StanceCard key={`stance-${item.id}`} item={item} />
                )
              )}
            </AnimatePresence>

            {/* Load more */}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 font-mono text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
