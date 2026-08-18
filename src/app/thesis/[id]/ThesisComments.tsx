'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ThesisComment } from '@/app/api/thesis/[id]/comments/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ROLE_STYLE: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debator',
  person: 'Citizen',
}

// ─── Comment row ──────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  isOwn,
  onDelete,
}: {
  comment: ThesisComment
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const { author } = comment
  const displayName = author?.display_name ?? author?.username ?? 'Unknown'
  const role = author?.role ?? 'person'

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    onDelete(comment.id)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="group flex items-start gap-2.5 py-2"
    >
      <Link href={`/profile/${author?.username ?? ''}`} className="flex-shrink-0 mt-0.5">
        <Avatar src={author?.avatar_url ?? null} fallback={displayName} size="xs" />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Link
            href={`/profile/${author?.username ?? ''}`}
            className="font-mono text-xs font-semibold text-white hover:text-for-400 transition-colors truncate max-w-[120px]"
          >
            {displayName}
          </Link>
          <span className={cn('font-mono text-[10px] font-medium', ROLE_STYLE[role] ?? 'text-surface-500')}>
            {ROLE_LABEL[role] ?? role}
          </span>
          <span className="text-[10px] font-mono text-surface-600 ml-auto">
            {relativeTime(comment.created_at)}
          </span>
          {isOwn && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete comment"
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-surface-600 hover:text-against-400 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
        <p className="text-sm text-surface-700 leading-relaxed break-words">{comment.body}</p>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ThesisCommentsProps {
  thesisId: string
}

export function ThesisComments({ thesisId }: ThesisCommentsProps) {
  const [comments, setComments] = useState<ThesisComment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/thesis/${thesisId}/comments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setComments(d?.comments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [thesisId])

  useEffect(() => { load() }, [load])

  const submit = useCallback(async () => {
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/thesis/${thesisId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error ?? 'Failed to post comment')
        return
      }
      const d = await res.json()
      setComments((prev) => [...prev, d.comment])
      setDraft('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }, [draft, submitting, thesisId])

  const deleteComment = useCallback(async (id: string) => {
    const res = await fetch(`/api/thesis/${thesisId}/comments?commentId=${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id))
    }
  }, [thesisId])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const charCount = draft.length
  const overLimit = charCount > 1000

  return (
    <div className="mt-6 rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
        <MessageSquare className="h-4 w-4 text-surface-500" />
        <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
          Discussion
        </span>
        {!loading && (
          <span className="ml-auto text-xs font-mono text-surface-600">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {/* Comment list */}
      <div className="px-4 py-2 divide-y divide-surface-300/50 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={MessageSquare}
              title="No discussion yet"
              description="Be the first to share your reasoning on this thesis."
            />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                isOwn={c.user_id === currentUserId}
                onDelete={deleteComment}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      {currentUserId ? (
        <div className="px-4 py-3 border-t border-surface-300">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add your reasoning… (⌘ Enter to post)"
              rows={2}
              maxLength={1000}
              aria-label="Comment body"
              className={cn(
                'w-full resize-none bg-surface-200 border rounded-xl px-3 py-2.5 pr-12',
                'text-sm text-white placeholder:text-surface-600',
                'focus:outline-none focus:ring-1 transition-colors',
                overLimit
                  ? 'border-against-500 focus:ring-against-500'
                  : 'border-surface-400 focus:ring-for-500'
              )}
            />
            <button
              onClick={submit}
              disabled={submitting || !draft.trim() || overLimit}
              aria-label="Post comment"
              className={cn(
                'absolute right-2.5 bottom-2.5 flex items-center justify-center',
                'h-7 w-7 rounded-lg transition-all',
                draft.trim() && !overLimit
                  ? 'bg-for-600 text-white hover:bg-for-500'
                  : 'bg-surface-300 text-surface-600 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="flex items-center mt-1.5">
            {error && (
              <p className="text-xs font-mono text-against-400">{error}</p>
            )}
            <span className={cn(
              'ml-auto text-[10px] font-mono',
              overLimit ? 'text-against-400' : 'text-surface-600'
            )}>
              {charCount}/1000
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-surface-300 text-center">
          <Link
            href="/sign-in"
            className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Sign in to join the discussion →
          </Link>
        </div>
      )}
    </div>
  )
}
