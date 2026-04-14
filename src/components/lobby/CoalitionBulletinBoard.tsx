'use client'

/**
 * CoalitionBulletinBoard
 *
 * Live bulletin board for a coalition's internal announcements.
 *
 * Features:
 *   - Fetches posts on mount; pinned posts float to top with a gold accent
 *   - Leaders/officers see a compose form to post new messages
 *   - Authors and leaders can delete posts (confirm via inline confirm state)
 *   - Leaders can pin/unpin any post (gold pin icon)
 *   - Optimistic UI: new posts prepend instantly, deletes remove immediately
 *   - Real-time: subscribes to Supabase Realtime INSERT/DELETE/UPDATE on
 *     coalition_posts so all members see updates without refreshing
 *   - Empty state with role-aware call-to-action
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  MessageSquarePlus,
  Pin,
  PinOff,
  Send,
  Trash2,
  Megaphone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { CoalitionPostWithAuthor } from '@/lib/supabase/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 1000

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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Post skeleton ─────────────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-4 rounded-xl border border-surface-300/30 bg-surface-200/40">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-surface-400/40 flex-shrink-0" />
        <div className="h-3 w-28 rounded bg-surface-400/40" />
        <div className="ml-auto h-3 w-16 rounded bg-surface-400/30" />
      </div>
      <div className="space-y-1.5 pl-9">
        <div className="h-3.5 w-full rounded bg-surface-400/30" />
        <div className="h-3.5 w-3/4 rounded bg-surface-400/30" />
      </div>
    </div>
  )
}

// ─── Single post card ──────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  isLeader,
  onDelete,
  onTogglePin,
}: {
  post: CoalitionPostWithAuthor
  currentUserId: string | null
  isLeader: boolean
  onDelete: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const isAuthor = post.author_id === currentUserId
  const canDelete = isAuthor || isLeader
  const authorDisplay =
    post.author?.display_name || post.author?.username || 'Anonymous'

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleteBusy(true)
    onDelete(post.id)
  }

  async function handleTogglePin() {
    setPinBusy(true)
    onTogglePin(post.id, !post.is_pinned)
    setPinBusy(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'relative rounded-xl border p-4 transition-colors',
        post.is_pinned
          ? 'border-gold/40 bg-gold/5'
          : 'border-surface-300/60 bg-surface-200/50'
      )}
    >
      {/* Pinned ribbon */}
      {post.is_pinned && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-semibold text-gold">
          <Pin className="h-3 w-3" />
          Pinned
        </div>
      )}

      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar
          src={post.author?.avatar_url ?? null}
          fallback={authorDisplay}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-white truncate">
            {authorDisplay}
          </span>
          {post.author?.username && (
            <span className="ml-1 text-[10px] font-mono text-surface-500">
              @{post.author.username}
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-500">
          {relativeTime(post.created_at)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap pl-9">
        {post.content}
      </p>

      {/* Actions (leader/author only) */}
      {(canDelete || isLeader) && (
        <div className="flex items-center gap-1 mt-3 pl-9">
          {isLeader && (
            <button
              onClick={handleTogglePin}
              disabled={pinBusy}
              aria-label={post.is_pinned ? 'Unpin post' : 'Pin post'}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors',
                'border disabled:opacity-50',
                post.is_pinned
                  ? 'border-gold/40 text-gold hover:bg-gold/10'
                  : 'border-surface-400/40 text-surface-500 hover:border-gold/40 hover:text-gold'
              )}
            >
              {post.is_pinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
              {post.is_pinned ? 'Unpin' : 'Pin'}
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleteBusy}
              onBlur={() => setConfirmDelete(false)}
              aria-label="Delete post"
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors',
                'border disabled:opacity-50',
                confirmDelete
                  ? 'border-against-500/60 text-against-400 bg-against-950/30 hover:bg-against-900/40'
                  : 'border-surface-400/40 text-surface-500 hover:border-against-500/50 hover:text-against-400'
              )}
            >
              {deleteBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Compose form ──────────────────────────────────────────────────────────────

function ComposeForm({
  coalitionId,
  onPosted,
}: {
  coalitionId: string
  onPosted: (post: CoalitionPostWithAuthor) => void
}) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const remaining = MAX_CHARS - content.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? 'Failed to post')
        return
      }
      const data = (await res.json()) as { post: CoalitionPostWithAuthor }
      onPosted(data.post)
      setContent('')
      textareaRef.current?.focus()
    } catch {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-purple/30 bg-purple/5 p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-purple">
        <MessageSquarePlus className="h-3.5 w-3.5" />
        New announcement
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share an update, goal, or strategy with your coalition…"
        maxLength={MAX_CHARS}
        rows={3}
        aria-label="Post content"
        className={cn(
          'w-full resize-none rounded-lg border bg-surface-200 px-3 py-2',
          'text-sm text-white placeholder:text-surface-500',
          'focus:outline-none focus:ring-1 transition-colors',
          error
            ? 'border-against-500/60 focus:ring-against-500/40'
            : 'border-surface-400/60 focus:border-purple/60 focus:ring-purple/30'
        )}
      />

      {error && (
        <p className="text-[11px] text-against-400 font-mono">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[11px] font-mono tabular-nums',
            remaining < 100 ? 'text-gold' : 'text-surface-500'
          )}
        >
          {remaining} chars remaining
        </span>

        <Button
          type="submit"
          disabled={submitting || !content.trim()}
          size="sm"
          className="gap-1.5"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Post
        </Button>
      </div>
    </form>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface CoalitionBulletinBoardProps {
  coalitionId: string
  /** Current user ID; null if not logged in */
  currentUserId: string | null
  /** Current user's role in this coalition; null if not a member */
  currentUserRole: 'leader' | 'officer' | 'member' | null
}

export function CoalitionBulletinBoard({
  coalitionId,
  currentUserId,
  currentUserRole,
}: CoalitionBulletinBoardProps) {
  const [posts, setPosts] = useState<CoalitionPostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const canPost = currentUserRole === 'leader' || currentUserRole === 'officer'
  const isLeader = currentUserRole === 'leader'
  const isMember = currentUserRole !== null

  // ── Fetch posts on mount ────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/posts`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setFetchError('Failed to load bulletin board')
        return
      }
      const data = (await res.json()) as { posts: CoalitionPostWithAuthor[] }
      setPosts(data.posts)
    } catch {
      setFetchError('Network error')
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const channel = supabase
      .channel(`coalition-posts:${coalitionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coalition_posts',
          filter: `coalition_id=eq.${coalitionId}`,
        },
        (payload) => {
          if (!mounted) return
          // Refetch to get enriched post with author profile
          fetchPosts()
          // Suppress unused payload warning
          void payload
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'coalition_posts',
          filter: `coalition_id=eq.${coalitionId}`,
        },
        (payload) => {
          if (!mounted) return
          const deleted = payload.old as { id?: string }
          if (deleted?.id) {
            setPosts((prev) => prev.filter((p) => p.id !== deleted.id))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'coalition_posts',
          filter: `coalition_id=eq.${coalitionId}`,
        },
        (payload) => {
          if (!mounted) return
          const updated = payload.new as CoalitionPostWithAuthor
          setPosts((prev) =>
            prev
              .map((p) =>
                p.id === updated.id ? { ...p, is_pinned: updated.is_pinned } : p
              )
              // Re-sort: pinned first, then newest
              .sort((a, b) => {
                if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              })
          )
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [coalitionId, fetchPosts])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handlePosted(post: CoalitionPostWithAuthor) {
    setPosts((prev) => {
      const next = [post, ...prev]
      return next.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    })
  }

  async function handleDelete(postId: string) {
    // Optimistic remove
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    try {
      await fetch(`/api/coalitions/${coalitionId}/posts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      })
    } catch {
      // On error, refetch to restore state
      fetchPosts()
    }
  }

  async function handleTogglePin(postId: string, isPinned: boolean) {
    // Optimistic update
    setPosts((prev) => {
      const next = prev.map((p) =>
        p.id === postId ? { ...p, is_pinned: isPinned } : p
      )
      return next.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    })
    try {
      await fetch(`/api/coalitions/${coalitionId}/posts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, is_pinned: isPinned }),
      })
    } catch {
      fetchPosts()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section aria-label="Bulletin Board" className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/20">
          <Megaphone className="h-4 w-4 text-purple" />
        </div>
        <h2 className="font-mono text-sm font-semibold text-white">
          Bulletin Board
        </h2>
        {posts.length > 0 && (
          <span className="ml-1 rounded-md bg-surface-300 px-1.5 py-0.5 text-[10px] font-mono text-surface-500">
            {posts.length}
          </span>
        )}
      </div>

      {/* Compose — leaders and officers only */}
      {canPost && (
        <ComposeForm coalitionId={coalitionId} onPosted={handlePosted} />
      )}

      {/* Post list */}
      {loading ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-against-500/30 bg-against-950/20 px-4 py-5 text-center">
          <p className="font-mono text-xs text-against-400">{fetchError}</p>
          <button
            onClick={fetchPosts}
            className="mt-2 text-[11px] font-mono text-for-400 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div
          className={cn(
            'rounded-xl border border-dashed border-surface-300 bg-surface-100/60 px-6 py-8 text-center space-y-2'
          )}
        >
          <Megaphone className="h-8 w-8 text-surface-500 mx-auto" />
          <p className="font-mono text-sm text-surface-500">
            {canPost
              ? 'No announcements yet. Post your first update above.'
              : isMember
              ? 'No announcements yet. Leaders will post updates here.'
              : 'No announcements from this coalition yet.'}
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isLeader={isLeader}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </section>
  )
}
