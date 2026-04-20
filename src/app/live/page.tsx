'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ChevronDown,
  Filter,
  MessageSquare,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { RecentArgument, RecentArgumentsResponse } from '@/app/api/arguments/recent/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 6_000
const MAX_ITEMS = 120

const SIDES = [
  { id: 'all', label: 'Both Sides' },
  { id: 'for', label: 'FOR', color: 'text-for-400' },
  { id: 'against', label: 'AGAINST', color: 'text-against-400' },
] as const

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1_000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

// ─── Argument Card ─────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: RecentArgument }) {
  const isFor = arg.side === 'blue'
  const [relTime, setRelTime] = useState(() => relativeTime(arg.created_at))

  // Update relative time every 15 seconds
  useEffect(() => {
    const id = setInterval(() => setRelTime(relativeTime(arg.created_at)), 15_000)
    return () => clearInterval(id)
  }, [arg.created_at])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border bg-surface-100 p-4 transition-colors',
        isFor
          ? 'border-for-900/60 hover:border-for-800/80'
          : 'border-against-900/60 hover:border-against-800/80'
      )}
    >
      {/* Header: author + side + time */}
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar
            src={arg.author?.avatar_url}
            fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
            size="sm"
          />
          {/* Side indicator dot */}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-100',
              isFor ? 'bg-for-500' : 'bg-against-500'
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {arg.author ? (
              <Link
                href={`/profile/${arg.author.username}`}
                className="text-sm font-semibold text-white hover:text-for-300 transition-colors"
              >
                {arg.author.display_name ?? arg.author.username}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-surface-500">Anonymous</span>
            )}
            <span
              className={cn(
                'text-xs font-bold tracking-wide',
                isFor ? 'text-for-400' : 'text-against-400'
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-xs text-surface-500">{relTime}</span>
          </div>

          {/* Topic context */}
          {arg.topic && (
            <Link
              href={`/topic/${arg.topic.id}`}
              className="mt-0.5 flex items-center gap-1 group"
            >
              <span className="text-xs text-surface-500 group-hover:text-surface-400 transition-colors truncate">
                {truncate(arg.topic.statement, 72)}
              </span>
              <ArrowRight className="h-3 w-3 flex-shrink-0 text-surface-600 group-hover:text-surface-400 transition-colors" />
            </Link>
          )}
        </div>

        {/* Status + category badges */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {arg.topic && (
            <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} className="text-[10px] px-1.5 py-0">
              {arg.topic.status === 'voting' ? 'VOTING' : arg.topic.status.toUpperCase()}
            </Badge>
          )}
          {arg.topic?.category && (
            <span
              className={cn(
                'text-[10px] font-medium uppercase tracking-wider',
                CATEGORY_COLORS[arg.topic.category] ?? 'text-surface-500'
              )}
            >
              {arg.topic.category}
            </span>
          )}
        </div>
      </div>

      {/* Argument body */}
      <p
        className={cn(
          'mt-3 text-sm leading-relaxed',
          isFor ? 'text-for-100' : 'text-against-100'
        )}
      >
        {renderWithMentions(truncate(arg.content, 320))}
      </p>

      {/* Footer: upvotes */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-surface-500">
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-500" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-500" />
          )}
          <span>{arg.upvotes}</span>
        </div>
        <Link
          href={`/topic/${arg.topic_id}`}
          className="ml-auto text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Reply
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function ArgumentSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>
  )
}

// ─── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot({ active }: { active: boolean }) {
  if (!active) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-surface-500">
        <span className="h-2 w-2 rounded-full bg-surface-500" />
        Paused
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-against-400 font-medium">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-against-400" />
      </span>
      LIVE
    </span>
  )
}

// ─── New-items banner ─────────────────────────────────────────────────────────

function NewItemsBanner({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          onClick={onClick}
          className="sticky top-16 z-20 mx-auto flex w-fit items-center gap-2 rounded-full bg-for-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-for-500 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {count} new argument{count !== 1 ? 's' : ''} — show
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LivePage() {
  const [items, setItems] = useState<RecentArgument[]>([])
  const [pendingItems, setPendingItems] = useState<RecentArgument[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [side, setSide] = useState<'all' | 'for' | 'against'>('all')
  const [category, setCategory] = useState('All')
  const [filterOpen, setFilterOpen] = useState(false)
  const [totalSeen, setTotalSeen] = useState(0)

  const newestAtRef = useRef<string | null>(null)
  const pausedRef = useRef(false)
  const sideRef = useRef(side)
  const categoryRef = useRef(category)

  pausedRef.current = paused
  sideRef.current = side
  categoryRef.current = category

  // ── Initial load ──────────────────────────────────────────────────────────

  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '40' })
      if (sideRef.current !== 'all') params.set('side', sideRef.current)
      if (categoryRef.current !== 'All') params.set('category', categoryRef.current)

      const res = await fetch(`/api/arguments/recent?${params}`)
      if (!res.ok) return
      const data: RecentArgumentsResponse = await res.json()
      setItems(data.arguments)
      setPendingItems([])
      setTotalSeen(data.arguments.length)
      newestAtRef.current = data.newest_at
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  // Re-load when filters change
  useEffect(() => {
    loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, category])

  // ── Polling for new items ─────────────────────────────────────────────────

  useEffect(() => {
    const poll = async () => {
      if (!newestAtRef.current) return

      const params = new URLSearchParams({ limit: '20', since: newestAtRef.current })
      if (sideRef.current !== 'all') params.set('side', sideRef.current)
      if (categoryRef.current !== 'All') params.set('category', categoryRef.current)

      try {
        const res = await fetch(`/api/arguments/recent?${params}`)
        if (!res.ok) return
        const data: RecentArgumentsResponse = await res.json()
        if (!data.arguments.length) return

        // Update cursor
        newestAtRef.current = data.newest_at

        if (pausedRef.current) {
          // Queue for later
          setPendingItems((prev) => [...data.arguments, ...prev])
        } else {
          // Show immediately
          setItems((prev) => {
            const merged = [...data.arguments, ...prev]
            return merged.slice(0, MAX_ITEMS)
          })
          setTotalSeen((n) => n + data.arguments.length)
        }
      } catch {
        // network error — silently skip
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // ── Show pending items ────────────────────────────────────────────────────

  const flushPending = useCallback(() => {
    if (pendingItems.length === 0) return
    setItems((prev) => {
      const merged = [...pendingItems, ...prev]
      return merged.slice(0, MAX_ITEMS)
    })
    setTotalSeen((n) => n + pendingItems.length)
    setPendingItems([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pendingItems])

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (p) {
        // Resuming — flush pending
        flushPending()
      }
      return !p
    })
  }, [flushPending])

  // ── Filtered items (already filtered server-side, but apply locally too) ──

  return (
    <>
      <TopBar />

      <main className="min-h-screen bg-surface-50 pb-24 pt-14">
        {/* ── Header ── */}
        <div className="sticky top-14 z-10 border-b border-surface-300/40 bg-surface-50/90 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Title */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-against-900/50 border border-against-800/50">
                  <Radio className="h-4 w-4 text-against-400" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-white leading-tight">Live Arguments</h1>
                  {!loading && (
                    <p className="text-[11px] text-surface-500 leading-none mt-0.5">
                      {totalSeen.toLocaleString()} seen this session
                    </p>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <LiveDot active={!paused} />

                <button
                  onClick={togglePause}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                    paused
                      ? 'bg-for-600/20 border-for-600/40 text-for-300 hover:bg-for-600/30'
                      : 'bg-surface-300/50 border-surface-400/40 text-surface-600 hover:bg-surface-300'
                  )}
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {paused ? 'Resume' : 'Pause'}
                </button>

                <button
                  onClick={() => setFilterOpen((o) => !o)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                    (side !== 'all' || category !== 'All')
                      ? 'bg-for-600/20 border-for-500/40 text-for-300'
                      : 'bg-surface-300/50 border-surface-400/40 text-surface-600 hover:bg-surface-300'
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                </button>

                <button
                  onClick={loadInitial}
                  className="rounded-full p-1.5 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── Filter panel ── */}
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2.5">
                    {/* Side filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wide w-14">Side</span>
                      <div className="flex gap-1.5">
                        {SIDES.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSide(s.id as typeof side)}
                            className={cn(
                              'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                              side === s.id
                                ? s.id === 'for'
                                  ? 'bg-for-600/30 border-for-500/50 text-for-300'
                                  : s.id === 'against'
                                    ? 'bg-against-600/30 border-against-500/50 text-against-300'
                                    : 'bg-surface-300 border-surface-400 text-white'
                                : 'bg-surface-200/50 border-surface-400/40 text-surface-500 hover:text-white hover:border-surface-400'
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category filter */}
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wide w-14 pt-1.5">Topic</span>
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                              category === cat
                                ? 'bg-surface-300 border-surface-400 text-white'
                                : 'bg-surface-200/50 border-surface-400/40 text-surface-500 hover:text-white hover:border-surface-400'
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── New items banner ── */}
        {paused && pendingItems.length > 0 && (
          <div className="mx-auto max-w-2xl px-4 pt-3">
            <NewItemsBanner count={pendingItems.length} onClick={flushPending} />
          </div>
        )}

        {/* ── Content ── */}
        <div className="mx-auto max-w-2xl px-4 pt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <ArgumentSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No arguments yet"
              description={
                side !== 'all' || category !== 'All'
                  ? 'No recent arguments match these filters. Try broadening your filter.'
                  : 'No arguments have been posted recently. Check back soon.'
              }
              actions={[
                {
                  label: 'Refresh',
                  onClick: loadInitial,
                  variant: 'primary',
                  icon: RefreshCw,
                },
              ]}
            />
          ) : (
            <>
              <AnimatePresence initial={false}>
                <div className="space-y-3">
                  {items.map((arg) => (
                    <ArgumentCard key={arg.id} arg={arg} />
                  ))}
                </div>
              </AnimatePresence>

              {/* Tail indicator */}
              {items.length >= MAX_ITEMS && (
                <p className="mt-6 text-center text-xs text-surface-500">
                  Showing the {MAX_ITEMS} most recent arguments.{' '}
                  <Link href="/arguments" className="text-for-400 hover:underline">
                    Browse all-time top arguments →
                  </Link>
                </p>
              )}

              {/* Pull fresh */}
              {items.length < MAX_ITEMS && (
                <div className="mt-8 flex flex-col items-center gap-3 pb-4">
                  <div className="flex items-center gap-2 text-xs text-surface-500">
                    {paused ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Stream paused
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5 text-for-500 animate-pulse" />
                        Checking for new arguments every {POLL_INTERVAL_MS / 1000}s
                      </>
                    )}
                  </div>
                  <Link
                    href="/pulse"
                    className="text-xs text-surface-500 hover:text-surface-400 transition-colors"
                  >
                    See top arguments on active topics →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  )
}
