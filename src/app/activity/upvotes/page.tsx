'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { UpvoteActivity, UpvotesActivityResponse } from '@/app/api/activity/upvotes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Role config ─────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
}

const ROLE_COLOR: Record<string, string> = {
  person:        'text-surface-500',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
}

// ─── Status badge ───────────────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Filter config ─────────────────────────────────────────────────────────────────────────

type PeriodFilter = 'all' | '7d' | '30d'
type SideFilter   = 'all' | 'blue' | 'red'

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Skeleton ───────────────────────────────────────────────────────────────────────────────

function UpvotesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
            <Skeleton className="h-3.5 w-16 rounded ml-auto" />
          </div>
          <Skeleton className="h-14 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Upvote card ──────────────────────────────────────────────────────────────────────────

function UpvoteCard({ item }: { item: UpvoteActivity }) {
  const isFor = item.argument_side === 'blue'

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400 transition-colors group',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40',
      )}
    >
      {/* Side accent stripe */}
      <div
        className={cn(
          'h-0.5 w-full',
          isFor
            ? 'bg-gradient-to-r from-for-600 to-for-400'
            : 'bg-gradient-to-r from-against-700 to-against-500',
        )}
      />

      <div className="p-4 space-y-3">
        {/* Voter row */}
        <div className="flex items-center gap-2.5">
          {item.voter ? (
            <Link
              href={`/profile/${item.voter.username}`}
              className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={item.voter.avatar_url}
                fallback={item.voter.display_name ?? item.voter.username}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-white truncate">
                  {item.voter.display_name ?? item.voter.username}
                </p>
                <p
                  className={cn(
                    'text-[11px] font-mono',
                    ROLE_COLOR[item.voter.role] ?? 'text-surface-500',
                  )}
                >
                  {ROLE_LABEL[item.voter.role] ?? item.voter.role}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <Avatar src={null} fallback="?" size="sm" />
              <span className="text-xs font-mono text-surface-500">Anonymous citizen</span>
            </div>
          )}

          {/* Upvote indicator + time */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                isFor
                  ? 'bg-for-500/15 border-for-500/30 text-for-400'
                  : 'bg-against-500/15 border-against-500/30 text-against-400',
              )}
              aria-label={isFor ? 'Upvoted your FOR argument' : 'Upvoted your AGAINST argument'}
            >
              <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
              +1
            </span>
            <time
              dateTime={item.vote_created_at}
              className="text-[11px] font-mono text-surface-500"
              title={new Date(item.vote_created_at).toLocaleString()}
            >
              {relativeTime(item.vote_created_at)}
            </time>
          </div>
        </div>

        {/* Your argument */}
        <div
          className={cn(
            'rounded-xl border px-3.5 py-3 space-y-1.5',
            isFor
              ? 'border-for-500/20 bg-for-500/5'
              : 'border-against-500/20 bg-against-500/5',
          )}
        >
          <div className="flex items-center gap-1.5">
            {isFor ? (
              <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden />
            ) : (
              <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden />
            )}
            <span
              className={cn(
                'text-[10px] font-mono font-bold uppercase tracking-wider',
                isFor ? 'text-for-400' : 'text-against-400',
              )}
            >
              Your {isFor ? 'FOR' : 'AGAINST'} argument
            </span>
            <span className="text-[10px] font-mono text-surface-500 ml-auto">
              ↑ {item.argument_upvotes.toLocaleString()} total
            </span>
          </div>
          <p className="text-sm font-mono text-surface-200 leading-relaxed">
            &ldquo;{truncate(item.argument_content, 200)}&rdquo;
          </p>
        </div>

        {/* Topic context */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono text-surface-500 mb-0.5 uppercase tracking-wider">
              Topic
            </p>
            <p className="text-xs font-mono text-surface-300 leading-snug line-clamp-2">
              {item.topic_statement}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {item.topic_category && (
              <Badge variant="proposed" className="text-[10px]">
                {item.topic_category}
              </Badge>
            )}
            <Badge
              variant={STATUS_VARIANT[item.topic_status] ?? 'proposed'}
              className="text-[10px]"
            >
              {item.topic_status === 'law' ? 'LAW' : item.topic_status}
            </Badge>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/arguments/${item.argument_id}`}
          aria-label="View full argument"
          className={cn(
            'flex items-center justify-between w-full',
            'rounded-xl border px-3 py-2 text-xs font-mono font-semibold',
            'transition-all',
            isFor
              ? 'border-for-500/30 bg-for-500/10 text-for-400 hover:bg-for-500/20 hover:border-for-500/50'
              : 'border-against-500/30 bg-against-500/10 text-against-400 hover:bg-against-500/20 hover:border-against-500/50',
          )}
        >
          <span className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View full argument
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function ActivityUpvotesPage() {
  const router = useRouter()

  const [upvotes, setUpvotes]       = useState<UpvoteActivity[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [authed, setAuthed]         = useState<boolean | null>(null)

  // ── Filter state
  const [period, setPeriod]         = useState<PeriodFilter>('all')
  const [side, setSide]             = useState<SideFilter>('all')
  const [category, setCategory]     = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const offsetRef = useRef(0)

  const buildUrl = useCallback((offset: number) => {
    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    if (period !== 'all') params.set('period', period)
    if (side !== 'all')   params.set('side', side)
    if (category)         params.set('category', category)
    return `/api/activity/upvotes?${params.toString()}`
  }, [period, side, category])

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError(null)

    try {
      const res = await fetch(buildUrl(offsetRef.current), { cache: 'no-store' })

      if (res.status === 401) {
        setAuthed(false)
        return
      }
      if (!res.ok) {
        setError('Could not load upvotes. Please try again.')
        return
      }

      setAuthed(true)
      const data = (await res.json()) as UpvotesActivityResponse

      if (reset) {
        setUpvotes(data.upvotes)
      } else {
        setUpvotes((prev) => [...prev, ...data.upvotes])
      }
      setTotal(data.totalCount)
      offsetRef.current += data.upvotes.length
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [buildUrl])

  // Reload when filters change
  useEffect(() => {
    load(true)
  }, [load])

  useEffect(() => {
    if (authed === false) router.push('/login')
  }, [authed, router])

  const hasMore       = upvotes.length < total
  const filtersActive = period !== 'all' || side !== 'all' || !!category

  function clearFilters() {
    setPeriod('all')
    setSide('all')
    setCategory('')
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">

        {/* ── Header ────────────────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href="/activity"
            aria-label="Back to activity"
            className="mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-2xl font-bold text-white">
                Argument Upvotes
              </h1>
              {total > 0 && !loading && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-for-500/20 border border-for-500/30 text-for-400 text-[10px] font-mono font-bold">
                  {total}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Citizens who upvoted your arguments
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
              className={cn(
                'flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-mono font-semibold',
                'transition-colors',
                filtersActive
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', showFilters && 'rotate-180')}
                aria-hidden
              />
              Filter
            </button>

            <button
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Refresh upvotes"
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                'bg-surface-200 border border-surface-300',
                'text-surface-400 hover:text-white hover:border-surface-400',
                'transition-colors disabled:opacity-50',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Quick nav ─────────────────────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Activity navigation">
          {[
            { href: '/activity',           label: 'Feed' },
            { href: '/activity/following', label: 'Following' },
            { href: '/activity/replies',   label: 'Replies' },
            { href: '/activity/upvotes',   label: 'Upvotes', active: true },
            { href: '/activity/mentions',  label: 'Mentions' },
            { href: '/notifications',      label: 'Notifications' },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors whitespace-nowrap',
                active
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* ── Filters panel ─────────────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
                {/* Time period */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                    Time period
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { id: 'all', label: 'All time' },
                      { id: '30d', label: 'Last 30 days' },
                      { id: '7d',  label: 'Last 7 days' },
                    ] as { id: PeriodFilter; label: string }[]).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setPeriod(id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors',
                          period === id
                            ? 'bg-for-500/20 border-for-500/40 text-for-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                    Argument side
                  </p>
                  <div className="flex gap-2">
                    {([
                      { id: 'all',  label: 'All' },
                      { id: 'blue', label: 'FOR' },
                      { id: 'red',  label: 'AGAINST' },
                    ] as { id: SideFilter; label: string }[]).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setSide(id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors',
                          side === id
                            ? id === 'blue'
                              ? 'bg-for-500/20 border-for-500/40 text-for-300'
                              : id === 'red'
                                ? 'bg-against-500/20 border-against-500/40 text-against-300'
                                : 'bg-for-500/20 border-for-500/40 text-for-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                    Category
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setCategory('')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors',
                        !category
                          ? 'bg-for-500/20 border-for-500/40 text-for-300'
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors',
                          category === cat
                            ? 'bg-for-500/20 border-for-500/40 text-for-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filtersActive && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content ─────────────────────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UpvotesSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
              <button
                onClick={() => load(true)}
                className="text-xs font-mono text-surface-400 hover:text-white underline transition-colors"
              >
                Try again
              </button>
            </motion.div>
          ) : upvotes.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={ThumbsUp}
                title={filtersActive ? 'No upvotes match your filters' : 'No upvotes yet'}
                description={
                  filtersActive
                    ? 'Try adjusting your filters to see more results.'
                    : 'When other citizens upvote your arguments, they\'ll appear here. Post a compelling argument on a topic to start.'
                }
                action={
                  filtersActive
                    ? { label: 'Clear filters', href: '/activity/upvotes' }
                    : { label: 'Explore topics', href: '/' }
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {upvotes.map((item, idx) => (
                <UpvoteCard key={`${item.argument_id}-${item.vote_created_at}-${idx}`} item={item} />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => load(false)}
                    disabled={loadingMore}
                    className={cn(
                      'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-mono font-semibold',
                      'bg-surface-200 border-surface-300 text-surface-400',
                      'hover:bg-surface-300 hover:text-white hover:border-surface-400',
                      'transition-all disabled:opacity-50',
                    )}
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</>
                    ) : (
                      `Load more (${total - upvotes.length} remaining)`
                    )}
                  </button>
                </div>
              )}

              {!hasMore && upvotes.length > 0 && (
                <p className="text-center text-[11px] font-mono text-surface-500 pt-2">
                  {total.toLocaleString()} {total === 1 ? 'upvote' : 'upvotes'} total
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Related links ────────────────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <nav aria-label="Related pages" className="grid grid-cols-2 gap-3 pt-2">
            {[
              { href: '/activity/replies',   label: 'Replies',       sub: 'Replies to your arguments' },
              { href: '/arguments/mine',     label: 'My Arguments',  sub: 'All your debate posts' },
              { href: '/arguments/trending', label: 'Trending',      sub: 'Most upvoted right now' },
              { href: '/leaderboard/arguments', label: 'Hall of Fame', sub: 'Best arguments ever' },
            ].map(({ href, label, sub }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-xl border border-surface-300 bg-surface-100 p-3.5',
                  'hover:border-surface-400 hover:bg-surface-200 transition-colors',
                  'flex flex-col gap-0.5',
                )}
              >
                <span className="text-sm font-mono font-semibold text-white">{label}</span>
                <span className="text-[11px] font-mono text-surface-500">{sub}</span>
              </Link>
            ))}
          </nav>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
