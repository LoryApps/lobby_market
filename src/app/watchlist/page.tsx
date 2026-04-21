'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellOff,
  BookOpen,
  ChevronRight,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Zap,
  FileText,
  XCircle,
  BellRing,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SubscribedTopic } from '@/app/api/topics/subscribed/route'

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
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Status config ─────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'proposed' | 'active' | 'voting' | 'law' | 'failed'

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: XCircle,
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'voting', label: 'Voting' },
  { id: 'law', label: 'LAW' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'failed', label: 'Failed' },
]

// ─── Topic row ─────────────────────────────────────────────────────────────────

function WatchlistRow({
  topic,
  onUnsubscribe,
}: {
  topic: SubscribedTopic
  onUnsubscribe: (id: string) => void
}) {
  const [unsubbing, setUnsubbing] = useState(false)
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const StatusIcon = STATUS_ICON[topic.status] ?? FileText

  async function handleUnsubscribe(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (unsubbing) return
    setUnsubbing(true)
    try {
      const res = await fetch(`/api/topics/${topic.id}/subscribe`, { method: 'DELETE' })
      if (res.ok) {
        onUnsubscribe(topic.id)
      }
    } catch {
      // best-effort
    } finally {
      setUnsubbing(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group flex items-start gap-3 p-4 rounded-2xl',
          'bg-surface-100 border border-surface-300/80',
          'hover:border-surface-400/80 hover:bg-surface-200/60',
          'transition-colors'
        )}
      >
        {/* Status icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl mt-0.5',
            topic.status === 'law'
              ? 'bg-emerald/10 border border-emerald/30'
              : topic.status === 'active' || topic.status === 'voting'
                ? 'bg-for-500/10 border border-for-500/30'
                : topic.status === 'failed'
                  ? 'bg-against-500/10 border border-against-500/30'
                  : 'bg-surface-300/40 border border-surface-400/30'
          )}
        >
          <StatusIcon
            className={cn(
              'h-4 w-4',
              topic.status === 'law'
                ? 'text-emerald'
                : topic.status === 'active' || topic.status === 'voting'
                  ? 'text-for-400'
                  : topic.status === 'failed'
                    ? 'text-against-400'
                    : 'text-surface-500'
            )}
            aria-hidden
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {topic.statement}
            </p>
            <ChevronRight className="flex-shrink-0 h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors mt-0.5" aria-hidden />
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            {topic.category && (
              <span className="text-[11px] font-mono text-surface-500 truncate">{topic.category}</span>
            )}
            <span className="text-[11px] text-surface-600">
              Followed {relativeTime(topic.subscribed_at)}
            </span>
          </div>

          {/* Vote bar */}
          {topic.total_votes > 0 && (
            <div className="space-y-1">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div
                  className="bg-for-500 transition-all"
                  style={{ width: `${forPct}%` }}
                  aria-label={`${forPct}% for`}
                />
                <div
                  className="bg-against-500 transition-all"
                  style={{ width: `${againstPct}%` }}
                  aria-label={`${againstPct}% against`}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-surface-500">
                <span className="text-for-400">{forPct}% For</span>
                <span className="text-surface-600">{topic.total_votes.toLocaleString()} votes</span>
                <span className="text-against-400">{againstPct}% Against</span>
              </div>
            </div>
          )}
        </div>

        {/* Unsubscribe button */}
        <button
          type="button"
          aria-label="Stop following this topic"
          title="Unfollow"
          onClick={handleUnsubscribe}
          disabled={unsubbing}
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full',
            'text-surface-500 hover:text-against-400 hover:bg-against-500/10',
            'transition-colors disabled:opacity-50 mt-0.5'
          )}
        >
          {unsubbing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </button>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton rows ─────────────────────────────────────────────────────────────

function WatchlistSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300/80 animate-pulse"
        >
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-2 mt-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full mt-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<SubscribedTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch('/api/topics/subscribed')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load watchlist')
      const data = await res.json()
      setTopics(data.topics ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function handleUnsubscribe(topicId: string) {
    setTopics((prev) => prev.filter((t) => t.id !== topicId))
  }

  // Filtering
  const filtered = topics.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      return (
        t.statement.toLowerCase().includes(q) ||
        (t.category?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  // Group counts for filter tabs
  const counts: Record<string, number> = { all: topics.length }
  for (const t of topics) {
    counts[t.status] = (counts[t.status] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <BellRing className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">My Watchlist</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading
                  ? 'Loading…'
                  : `${topics.length} topic${topics.length !== 1 ? 's' : ''} followed`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh watchlist"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl',
              'bg-surface-200 text-surface-500 border border-surface-300',
              'hover:bg-surface-300 hover:text-white transition-colors',
              'disabled:opacity-40'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ─── Search ──────────────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your watchlist…"
              className={cn(
                'w-full h-10 pl-10 pr-4 rounded-xl text-sm',
                'bg-surface-200 border border-surface-300',
                'text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:bg-surface-200',
                'transition-colors'
              )}
            />
          </div>
        )}

        {/* ─── Status filter tabs ───────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-5">
            {STATUS_FILTERS.map((f) => {
              const count = counts[f.id] ?? 0
              if (f.id !== 'all' && count === 0) return null
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium',
                    'border transition-colors',
                    statusFilter === f.id
                      ? f.id === 'law'
                        ? 'bg-emerald/15 text-emerald border-emerald/40'
                        : f.id === 'failed'
                          ? 'bg-against-500/15 text-against-400 border-against-500/40'
                          : f.id === 'voting'
                            ? 'bg-purple/15 text-purple border-purple/40'
                            : 'bg-for-500/15 text-for-300 border-for-500/40'
                      : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                  )}
                >
                  {f.label}
                  <span className="opacity-60 text-[10px]">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ─── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <WatchlistSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <p className="text-against-400 text-sm font-mono mb-3">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors underline"
            >
              Try again
            </button>
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Bell}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="Nothing in your watchlist yet"
            description="Follow topics you care about — you'll get notified when they change status or become law."
            actions={[
              {
                label: 'Browse topics',
                href: '/',
                variant: 'primary',
                icon: BookOpen,
              },
              {
                label: 'Discover trending',
                href: '/trending',
                variant: 'secondary',
              },
            ]}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            iconColor="text-surface-400"
            iconBg="bg-surface-300/30"
            iconBorder="border-surface-400/20"
            title="No matches"
            description={
              query
                ? `No topics match "${query}"`
                : `No ${statusFilter} topics in your watchlist`
            }
            actions={[
              {
                label: 'Clear filters',
                onClick: () => { setStatusFilter('all'); setQuery('') },
                variant: 'secondary',
              },
            ]}
            size="sm"
          />
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <div className="space-y-3">
              {filtered.map((topic) => (
                <WatchlistRow
                  key={topic.id}
                  topic={topic}
                  onUnsubscribe={handleUnsubscribe}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ─── Footer tip ──────────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <p className="mt-8 text-center text-[11px] font-mono text-surface-600">
            You receive notifications when followed topics change status.{' '}
            <Link href="/notifications" className="text-for-400 hover:text-for-300 transition-colors">
              View notifications
            </Link>
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
