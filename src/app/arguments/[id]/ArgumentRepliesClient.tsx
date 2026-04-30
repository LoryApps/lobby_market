'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { ArgumentReplyWithAuthor } from '@/lib/supabase/types'

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

const ROLE_BADGE: Record<string, 'person' | 'debator' | 'troll_catcher' | 'elder'> = {
  person: 'person',
  debator: 'debator',
  troll_catcher: 'troll_catcher',
  elder: 'elder',
}

const MAX_REPLY_LENGTH = 300

// ─── Reply row ────────────────────────────────────────────────────────────────

function ReplyRow({
  reply,
  currentUserId,
  onDelete,
}: {
  reply: ArgumentReplyWithAuthor
  currentUserId: string | null
  onDelete: (replyId: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const isOwn = reply.user_id === currentUserId

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex gap-3 group"
    >
      <div className="flex-shrink-0 pt-0.5">
        {reply.author ? (
          <Link href={`/profile/${reply.author.username}`}>
            <Avatar
              src={reply.author.avatar_url}
              fallback={reply.author.display_name || reply.author.username}
              size="sm"
            />
          </Link>
        ) : (
          <div className="h-8 w-8 rounded-full bg-surface-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {reply.author ? (
            <Link
              href={`/profile/${reply.author.username}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors"
            >
              {reply.author.display_name || reply.author.username}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-surface-500">Anonymous</span>
          )}
          {reply.author?.role && reply.author.role !== 'person' && (
            <Badge
              variant={ROLE_BADGE[reply.author.role] ?? 'person'}
              className="text-[9px] py-0 px-1.5"
            >
              {reply.author.role}
            </Badge>
          )}
          <span className="text-xs font-mono text-surface-600 ml-auto">
            {relativeTime(reply.created_at)}
          </span>
        </div>

        <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap break-words">
          {reply.content}
        </p>
      </div>

      {isOwn && !deleting && (
        <button
          onClick={async () => {
            setDeleting(true)
            await onDelete(reply.id)
          }}
          aria-label="Delete reply"
          className={cn(
            'flex-shrink-0 self-start opacity-0 group-hover:opacity-100 transition-opacity',
            'p-1 rounded hover:bg-against-500/20 text-surface-600 hover:text-against-400'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {deleting && (
        <Loader2 className="h-4 w-4 flex-shrink-0 self-start mt-1 animate-spin text-surface-600" />
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  argumentId: string
  topicId: string
  initialCount: number
}

export function ArgumentRepliesClient({ argumentId, topicId, initialCount }: Props) {
  const [replies, setReplies] = useState<ArgumentReplyWithAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Compose state
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const count = Math.max(initialCount, replies.length)

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  const loadReplies = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/topics/${topicId}/arguments/${argumentId}/replies`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { replies: ArgumentReplyWithAuthor[] }
      setReplies(json.replies ?? [])
    } catch {
      // silently fail — count is still shown
    } finally {
      setLoading(false)
    }
  }, [argumentId, topicId, loading])

  const handleToggle = useCallback(() => {
    if (!expanded) {
      setExpanded(true)
      loadReplies()
    } else {
      setExpanded(false)
    }
  }, [expanded, loadReplies])

  const handleSubmit = useCallback(async () => {
    const content = draft.trim()
    if (!content || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(
        `/api/topics/${topicId}/arguments/${argumentId}/replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      )
      if (res.status === 401) {
        setSubmitError('Sign in to post a reply.')
        return
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setSubmitError(j.error ?? 'Failed to post reply.')
        return
      }
      const json = (await res.json()) as { reply: ArgumentReplyWithAuthor }
      setReplies((prev) => [...prev, json.reply])
      setDraft('')
      setComposing(false)
    } finally {
      setSubmitting(false)
    }
  }, [draft, submitting, argumentId, topicId])

  const handleDelete = useCallback(async (replyId: string) => {
    try {
      await fetch(
        `/api/topics/${topicId}/arguments/${argumentId}/replies?replyId=${replyId}`,
        { method: 'DELETE' }
      )
      setReplies((prev) => prev.filter((r) => r.id !== replyId))
    } catch {
      // best-effort
    }
  }, [argumentId, topicId])

  // Auto-focus textarea when composing opens
  useEffect(() => {
    if (composing) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [composing])

  const charsLeft = MAX_REPLY_LENGTH - draft.length
  const canSubmit = draft.trim().length > 0 && charsLeft >= 0 && !submitting

  return (
    <div className="border border-surface-300 rounded-2xl overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'bg-surface-100 hover:bg-surface-200 transition-colors',
          'border-b border-surface-300',
          expanded && 'border-b-0'
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-surface-500" aria-hidden />
          <span className="text-sm font-mono font-semibold text-white">
            {count === 0 ? 'No replies yet' : `${count} ${count === 1 ? 'reply' : 'replies'}`}
          </span>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 text-surface-500 animate-spin" aria-hidden />
        ) : expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500" aria-hidden />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="thread"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-4 border-b border-surface-300">
              {/* Reply list */}
              {loading && replies.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
                </div>
              ) : replies.length === 0 ? (
                <p className="text-sm font-mono text-surface-600 text-center py-4">
                  No replies yet. Be the first to respond.
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {replies.map((reply) => (
                    <ReplyRow
                      key={reply.id}
                      reply={reply}
                      currentUserId={currentUserId}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Compose area */}
            <div className="px-4 py-3 bg-surface-100">
              {!composing ? (
                <button
                  onClick={() => {
                    if (!currentUserId) {
                      window.location.href = '/auth/login'
                      return
                    }
                    setComposing(true)
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 rounded-xl',
                    'border border-surface-300 bg-surface-200',
                    'text-sm font-mono text-surface-600 hover:text-surface-500',
                    'hover:border-surface-400 transition-colors'
                  )}
                >
                  {currentUserId ? 'Write a reply…' : 'Sign in to reply'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          handleSubmit()
                        }
                        if (e.key === 'Escape') {
                          setComposing(false)
                          setDraft('')
                        }
                      }}
                      maxLength={MAX_REPLY_LENGTH}
                      rows={3}
                      placeholder="Add your reply… (⌘↵ to post, Esc to cancel)"
                      aria-label="Reply content"
                      className={cn(
                        'w-full resize-none rounded-xl px-3 py-2.5 text-sm font-mono',
                        'bg-surface-200 border border-surface-300 text-white',
                        'placeholder:text-surface-600',
                        'focus:outline-none focus:border-for-500/60',
                        'transition-colors'
                      )}
                    />
                  </div>

                  {submitError && (
                    <p className="text-xs font-mono text-against-400">{submitError}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs font-mono',
                        charsLeft < 20 ? 'text-against-400' : 'text-surface-600'
                      )}
                    >
                      {charsLeft} left
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setComposing(false)
                          setDraft('')
                          setSubmitError(null)
                        }}
                        aria-label="Cancel reply"
                        className="p-1.5 rounded-lg text-surface-600 hover:text-white hover:bg-surface-300 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        aria-label="Post reply"
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                          'text-xs font-mono font-semibold transition-colors',
                          canSubmit
                            ? 'bg-for-600 hover:bg-for-500 text-white'
                            : 'bg-surface-300 text-surface-600 cursor-not-allowed'
                        )}
                      >
                        {submitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
