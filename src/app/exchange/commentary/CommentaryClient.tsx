'use client'

/**
 * /exchange/commentary — Market Commentary Feed
 *
 * Twitter-style micro-notes (≤280 chars) where traders share quick takes on
 * civic prediction markets. Filter by direction (for/against/neutral) and
 * sort by newest or most liked.
 *
 * Compose: inline textarea at the top (auth required)
 * Each note: avatar · username · content · topic chip · direction badge ·
 *            timestamp · like button · delete (own notes)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Flame,
  Heart,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketCommentary, CommentaryResponse } from '@/app/api/exchange/commentary/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 280

const DIRECTION_CONFIG = {
  for: {
    label: 'For',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    dot: 'bg-for-400',
  },
  against: {
    label: 'Against',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    dot: 'bg-against-400',
  },
  neutral: {
    label: 'Neutral',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
    dot: 'bg-surface-400',
  },
} as const

const SORT_TABS = [
  { id: 'new', label: 'New', icon: Clock },
  { id: 'top', label: 'Top', icon: Flame },
] as const
type SortMode = (typeof SORT_TABS)[number]['id']

const DIR_FILTERS = [
  { id: null, label: 'All' },
  { id: 'for', label: 'For' },
  { id: 'against', label: 'Against' },
  { id: 'neutral', label: 'Neutral' },
] as const
type DirFilter = 'for' | 'against' | 'neutral' | null

const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
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

function priceColor(pct: number): string {
  if (pct >= 67) return 'text-gold'
  if (pct >= 55) return 'text-for-400'
  if (pct <= 33) return 'text-against-400'
  if (pct <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  currentUserId,
  onLike,
  onDelete,
}: {
  note: MarketCommentary
  currentUserId: string | null
  onLike: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [localLikes, setLocalLikes] = useState(note.likes)
  const [liked, setLiked] = useState(note.viewer_liked)
  const [liking, setLiking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isOwn = currentUserId === note.user_id
  const dirCfg = note.direction ? DIRECTION_CONFIG[note.direction] : null

  async function handleLike() {
    if (liking || !currentUserId) return
    setLiking(true)
    const prev = liked
    setLiked(!prev)
    setLocalLikes((l) => l + (prev ? -1 : 1))
    try {
      const res = await fetch('/api/exchange/commentary/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentary_id: note.id }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLocalLikes(data.likes)
      setLiked(data.viewer_liked)
      onLike(note.id)
    } catch {
      setLiked(prev)
      setLocalLikes((l) => l + (prev ? 1 : -1))
    } finally {
      setLiking(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch('/api/exchange/commentary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id }),
      })
      if (!res.ok) throw new Error()
      onDelete(note.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 hover:border-surface-400/60 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${note.author?.username}`} className="flex-shrink-0">
          <Avatar
            src={note.author?.avatar_url ?? null}
            username={note.author?.username ?? '?'}
            size="sm"
          />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Author row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${note.author?.username}`}
              className="text-sm font-semibold text-surface-900 hover:text-for-400 transition-colors truncate"
            >
              {note.author?.display_name ?? note.author?.username}
            </Link>
            <span className="text-[11px] text-surface-500 font-mono flex-shrink-0">
              @{note.author?.username}
            </span>

            {/* Direction badge */}
            {dirCfg && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
                  dirCfg.bg,
                  dirCfg.border,
                  dirCfg.color,
                  'border'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', dirCfg.dot)} />
                {dirCfg.label}
              </span>
            )}

            <span className="text-[11px] text-surface-500 font-mono ml-auto flex-shrink-0">
              {relTime(note.created_at)}
            </span>
          </div>

          {/* Content */}
          <p className="mt-1.5 text-sm text-surface-800 leading-relaxed whitespace-pre-wrap break-words">
            {note.content}
          </p>

          {/* Topic chip */}
          {note.topic && (
            <Link
              href={`/topic/${note.topic.id}`}
              className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 transition-colors group max-w-full"
            >
              {note.topic.blue_pct != null && (
                <span
                  className={cn(
                    'text-[10px] font-mono font-bold tabular-nums flex-shrink-0',
                    priceColor(note.topic.blue_pct)
                  )}
                >
                  {Math.round(note.topic.blue_pct)}¢
                </span>
              )}
              <span className="text-[11px] text-surface-600 group-hover:text-surface-400 transition-colors truncate">
                {note.topic.statement.length > 60
                  ? note.topic.statement.slice(0, 60) + '…'
                  : note.topic.statement}
              </span>
              <ExternalLink className="h-2.5 w-2.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-300/40">
        <button
          onClick={handleLike}
          disabled={liking || !currentUserId}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={cn(
            'flex items-center gap-1.5 text-xs font-mono transition-colors',
            liked ? 'text-against-400' : 'text-surface-500 hover:text-against-400',
            !currentUserId && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Heart
            className={cn('h-3.5 w-3.5 transition-all', liked && 'fill-current')}
            aria-hidden="true"
          />
          <span>{localLikes}</span>
        </button>

        {isOwn && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete note"
            className="flex items-center gap-1 text-xs text-surface-600 hover:text-against-400 transition-colors"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Compose Box ──────────────────────────────────────────────────────────────

function ComposeBox({
  currentUserId,
  onPosted,
}: {
  currentUserId: string | null
  onPosted: (note: MarketCommentary) => void
}) {
  const [content, setContent] = useState('')
  const [direction, setDirection] = useState<'for' | 'against' | 'neutral' | null>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const remaining = MAX_CHARS - content.length
  const canPost = content.trim().length > 0 && remaining >= 0 && !posting

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  async function handlePost() {
    if (!canPost || !currentUserId) return
    setPosting(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), direction }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to post')
      }
      const note = await res.json() as MarketCommentary
      onPosted(note)
      setContent('')
      setDirection(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPosting(false)
    }
  }

  if (!currentUserId) {
    return (
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 text-center">
        <MessageSquare className="h-5 w-5 text-surface-500 mx-auto mb-2" />
        <p className="text-sm text-surface-500 mb-3">Sign in to share your market take</p>
        <Link href="/sign-in">
          <Button size="sm" variant="primary">Sign in</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => { setContent(e.target.value); autoResize() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost()
        }}
        placeholder="Share your market take... (⌘+Enter to post)"
        rows={3}
        maxLength={MAX_CHARS + 1}
        className={cn(
          'w-full bg-transparent text-sm text-surface-900 placeholder:text-surface-500',
          'resize-none outline-none leading-relaxed',
          'border-0 p-0 min-h-[72px]'
        )}
      />

      {/* Direction toggles + char count + post */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-300/40 flex-wrap">
        {/* Direction pills */}
        <div className="flex gap-1.5 flex-shrink-0">
          {(['for', 'against', 'neutral'] as const).map((d) => {
            const cfg = DIRECTION_CONFIG[d]
            const active = direction === d
            return (
              <button
                key={d}
                onClick={() => setDirection(active ? null : d)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border transition-all',
                  active
                    ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                    : 'bg-transparent border-surface-300/50 text-surface-500 hover:border-surface-400/70'
                )}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Char count */}
        <span
          className={cn(
            'ml-auto text-[11px] font-mono tabular-nums',
            remaining < 20 ? (remaining < 0 ? 'text-against-400' : 'text-gold') : 'text-surface-500'
          )}
        >
          {remaining}
        </span>

        {/* Post button */}
        <Button
          size="sm"
          variant="primary"
          onClick={handlePost}
          disabled={!canPost}
          className="flex items-center gap-1.5"
        >
          {posting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Post
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-against-400">{error}</p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommentaryClient() {
  const [notes, setNotes] = useState<MarketCommentary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<SortMode>('new')
  const [dirFilter, setDirFilter] = useState<DirFilter>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // Get current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.id && setCurrentUserId(d.id))
      .catch(() => null)
  }, [])

  const fetchNotes = useCallback(
    async (reset = true) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const offset = reset ? 0 : offsetRef.current

      if (reset) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams({
          sort,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        })
        if (dirFilter) params.set('direction', dirFilter)

        const res = await fetch(`/api/exchange/commentary?${params}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('fetch failed')
        const data: CommentaryResponse = await res.json()

        if (reset) {
          setNotes(data.notes)
          offsetRef.current = data.notes.length
        } else {
          setNotes((prev) => [...prev, ...data.notes])
          offsetRef.current += data.notes.length
        }
        setHasMore(data.has_more)
        setTotal(data.total)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [sort, dirFilter]
  )

  useEffect(() => {
    fetchNotes(true)
  }, [fetchNotes])

  function handlePosted(note: MarketCommentary) {
    setNotes((prev) => [note, ...prev])
    setTotal((t) => t + 1)
    offsetRef.current += 1
  }

  function handleLike(_id: string) {
    // Like state is managed inside NoteCard; nothing to sync at list level
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    offsetRef.current = Math.max(0, offsetRef.current - 1)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/exchange"
            className="p-2 rounded-lg hover:bg-surface-200/60 text-surface-500 hover:text-surface-300 transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-surface-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-for-400" aria-hidden="true" />
              Market Commentary
            </h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              {total > 0 ? `${total.toLocaleString()} notes` : 'Trader takes on civic markets'}
            </p>
          </div>
          <button
            onClick={() => fetchNotes(true)}
            className="ml-auto p-2 rounded-lg hover:bg-surface-200/60 text-surface-500 hover:text-surface-300 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Compose box */}
        <div className="mb-5">
          <ComposeBox currentUserId={currentUserId} onPosted={handlePosted} />
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Sort tabs */}
          <div className="flex bg-surface-200/60 rounded-lg p-0.5 gap-0.5">
            {SORT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                  sort === id
                    ? 'bg-surface-100 text-surface-900 shadow-sm'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Direction filters */}
          <div className="flex gap-1.5 flex-wrap">
            {DIR_FILTERS.map(({ id, label }) => (
              <button
                key={String(id)}
                onClick={() => setDirFilter(id as DirFilter)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                  dirFilter === id
                    ? id === 'for'
                      ? 'bg-for-500/15 border-for-500/40 text-for-400'
                      : id === 'against'
                        ? 'bg-against-500/15 border-against-500/40 text-against-400'
                        : id === 'neutral'
                          ? 'bg-surface-300/20 border-surface-400/40 text-surface-400'
                          : 'bg-surface-200/80 border-surface-400/40 text-surface-400'
                    : 'bg-transparent border-surface-300/40 text-surface-500 hover:border-surface-400/60'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes feed */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No commentary yet"
            description={
              dirFilter
                ? `No ${dirFilter} takes found. Be the first to share one.`
                : 'No market notes yet. Share your first take above.'
            }
          />
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <div className="space-y-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  currentUserId={currentUserId}
                  onLike={handleLike}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-5 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNotes(false)}
              disabled={loadingMore}
              className="text-surface-500 hover:text-surface-300"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Load more
            </Button>
          </div>
        )}

        {/* No-more marker */}
        {!hasMore && notes.length > 0 && !loading && (
          <p className="mt-6 text-center text-[11px] text-surface-600 font-mono">
            — {total.toLocaleString()} notes total —
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
