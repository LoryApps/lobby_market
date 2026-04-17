'use client'

/**
 * ArgumentThread
 *
 * Shows a list of FOR/AGAINST arguments for a topic and allows
 * authenticated users to post their own argument + upvote others.
 *
 * Each user can post exactly one argument per topic.
 * Users cannot upvote their own argument.
 *
 * UX enhancements:
 *  - Sort toggle: Top (upvotes desc) / New (created_at desc)
 *  - Mobile tab view: All / For / Against (stacked)
 *  - Skeleton card loading instead of a spinner
 *  - Inline reply threads beneath each argument (lazy-loaded)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { GiftCloutButton } from '@/components/clout/GiftCloutButton'
import {
  MentionAutocomplete,
  getMentionContext,
  type MentionSuggestion,
} from '@/components/ui/MentionAutocomplete'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { TopicArgumentWithAuthor, ArgumentReplyWithAuthor } from '@/lib/supabase/types'

const MAX_REPLY_CHARS = 300

const MAX_CHARS = 500
const MIN_CHARS = 10

function relativeTime(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

interface ArgumentThreadProps {
  topicId: string
}

type SortMode = 'top' | 'new'
type MobileTab = 'all' | 'for' | 'against'

// ─── Skeleton loading cards ───────────────────────────────────────────────────

function ArgumentSkeleton() {
  return (
    <div className="flex gap-3 p-4 rounded-xl border border-surface-300/30 bg-surface-200/40 animate-pulse">
      <div className="flex-shrink-0 pt-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-surface-400/50" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-surface-400/50 flex-shrink-0" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pl-1">
        <Skeleton className="h-7 w-8 rounded-lg" />
      </div>
    </div>
  )
}

function ArgumentThreadSkeleton() {
  return (
    <div className="space-y-3">
      <ArgumentSkeleton />
      <ArgumentSkeleton />
      <ArgumentSkeleton />
    </div>
  )
}

// ─── Reply panel ──────────────────────────────────────────────────────────────

function ReplyPanel({
  topicId,
  argumentId,
  currentUserId,
  side,
}: {
  topicId: string
  argumentId: string
  currentUserId: string | null
  side: 'blue' | 'red'
}) {
  const [replies, setReplies] = useState<ArgumentReplyWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)
  const [mentionResultCount, setMentionResultCount] = useState(0)
  const mentionResultsRef = useRef<MentionSuggestion[]>([])

  const accentColor = side === 'blue' ? 'border-for-500/30' : 'border-against-500/30'

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/topics/${topicId}/arguments/${argumentId}/replies`
      )
      if (!res.ok) return
      const json = await res.json()
      setReplies(json.replies ?? [])
    } finally {
      setLoading(false)
    }
  }, [topicId, argumentId])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || submitting || !currentUserId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/topics/${topicId}/arguments/${argumentId}/replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to post reply')
        return
      }
      setReplies((prev) => [...prev, json.reply as ArgumentReplyWithAuthor])
      setContent('')
      setMentionQuery(null)
      inputRef.current?.focus()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReplyContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    const cursor = e.target.selectionStart ?? val.length
    const ctx = getMentionContext(val, cursor)
    if (ctx) {
      setMentionQuery(ctx.query)
      setMentionSelectedIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  function insertReplyMention(s: MentionSuggestion) {
    const textarea = inputRef.current
    const cursor = textarea?.selectionStart ?? content.length
    const ctx = getMentionContext(content, cursor)
    if (!ctx) return
    const before = content.slice(0, ctx.startPos)
    const after = content.slice(cursor)
    const inserted = `@${s.username} `
    const newContent = before + inserted + after
    setContent(newContent)
    setMentionQuery(null)
    // Restore focus and move cursor to end of inserted text
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      const newCursor = before.length + inserted.length
      textarea.setSelectionRange(newCursor, newCursor)
    }, 0)
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionResultCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionSelectedIndex((i) => Math.min(i + 1, mentionResultCount - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const selected = mentionResultsRef.current[mentionSelectedIndex]
        if (selected) {
          e.preventDefault()
          insertReplyMention(selected)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const handleDelete = async (replyId: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId))
    try {
      await fetch(
        `/api/topics/${topicId}/arguments/${argumentId}/replies?replyId=${replyId}`,
        { method: 'DELETE' }
      )
    } catch {
      // best-effort; re-load on failure
      load()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className={cn('ml-5 mt-2 pl-3 border-l-2', accentColor)}>
        {/* Existing replies */}
        {loading ? (
          <div className="flex items-center gap-1.5 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-surface-500" />
            <span className="text-[11px] text-surface-500 font-mono">Loading replies…</span>
          </div>
        ) : replies.length > 0 ? (
          <div className="space-y-2 py-2">
            {replies.map((reply) => {
              const isOwn = reply.user_id === currentUserId
              return (
                <div key={reply.id} className="group flex items-start gap-2">
                  <Avatar
                    src={reply.author?.avatar_url ?? null}
                    fallback={reply.author?.display_name || reply.author?.username || '?'}
                    size="xs"
                    className="flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-surface-300">
                        {reply.author?.display_name || reply.author?.username || 'Anonymous'}
                      </span>
                      <span className="text-[10px] text-surface-600">
                        {relativeTime(reply.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-surface-400 leading-relaxed mt-0.5">
                      {renderWithMentions(reply.content)}
                    </p>
                  </div>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDelete(reply.id)}
                      aria-label="Delete reply"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-surface-600 hover:text-against-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Reply form */}
        {currentUserId ? (
          <form onSubmit={handleSubmit} className="flex items-end gap-2 py-2">
            <div className="flex-1 relative">
              {mentionQuery !== null && (
                <MentionAutocomplete
                  query={mentionQuery}
                  selectedIndex={mentionSelectedIndex}
                  onSelect={insertReplyMention}
                  onClose={() => setMentionQuery(null)}
                  onResultsChange={setMentionResultCount}
                  onResultsReady={(r) => { mentionResultsRef.current = r }}
                  position="above"
                />
              )}
              <textarea
                ref={inputRef}
                value={content}
                onChange={handleReplyContentChange}
                onKeyDown={handleReplyKeyDown}
                placeholder="Reply… (@username to mention)"
                rows={1}
                maxLength={MAX_REPLY_CHARS}
                className={cn(
                  'w-full resize-none rounded-lg px-3 py-2 text-xs',
                  'bg-surface-300/50 border border-surface-400/50',
                  'text-white placeholder:text-surface-600',
                  'focus:outline-none focus:border-surface-400 transition-colors',
                  'leading-relaxed'
                )}
              />
              {content.length > MAX_REPLY_CHARS * 0.8 && (
                <span className="absolute bottom-2 right-2 text-[9px] font-mono text-surface-600">
                  {MAX_REPLY_CHARS - content.length}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              aria-label="Post reply"
              className={cn(
                'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
                'bg-surface-300 border border-surface-400',
                content.trim() && !submitting
                  ? 'text-white hover:bg-surface-400'
                  : 'text-surface-600 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        ) : (
          <p className="py-2 text-[11px] text-surface-600">
            <a href="/login" className="text-for-400 hover:underline">Sign in</a> to reply.
          </p>
        )}

        {error && (
          <p role="alert" className="text-[11px] text-against-400 font-mono pb-2">
            {error}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Single argument card ─────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  topicId,
  currentUserId,
  onUpvote,
}: {
  arg: TopicArgumentWithAuthor
  topicId: string
  currentUserId: string | null
  onUpvote: (argId: string, currentlyUpvoted: boolean) => Promise<void>
}) {
  const [upvoting, setUpvoting] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const isOwn = arg.user_id === currentUserId
  const canUpvote = currentUserId !== null && !isOwn

  const handleUpvote = async () => {
    if (!canUpvote || upvoting) return
    setUpvoting(true)
    try {
      await onUpvote(arg.id, arg.has_upvoted)
    } finally {
      setUpvoting(false)
    }
  }

  const isFor = arg.side === 'blue'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const sideDot = isFor ? 'bg-for-500' : 'bg-against-500'

  return (
    <div>
    <div
      className={cn(
        'flex gap-3 p-4 rounded-xl border transition-colors',
        sideBg,
        sideBorder,
        showReplies && (isFor ? 'rounded-b-none border-b-0' : 'rounded-b-none border-b-0'),
        isOwn && 'ring-1 ring-surface-400/20'
      )}
    >
      {/* Left: side indicator dot */}
      <div className="flex-shrink-0 pt-1.5">
        <div className={cn('h-2.5 w-2.5 rounded-full', sideDot)} aria-hidden />
      </div>

      {/* Center: author + content */}
      <div className="flex-1 min-w-0">
        {/* Author row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Avatar
            src={arg.author?.avatar_url ?? null}
            fallback={arg.author?.display_name || arg.author?.username || '?'}
            size="xs"
          />
          <span className="text-xs font-medium text-white truncate max-w-[120px]">
            {arg.author?.display_name || arg.author?.username || 'Anonymous'}
          </span>
          {arg.author?.role && arg.author.role !== 'person' && (
            <Badge
              variant={arg.author.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}
              className="text-[9px]"
            >
              {arg.author.role}
            </Badge>
          )}
          <span
            className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', sideColor)}
          >
            {isFor ? 'For' : 'Against'}
          </span>
          {isOwn && (
            <span className="text-[10px] text-surface-500 font-mono">· you</span>
          )}
          <span className="text-[10px] text-surface-600 ml-auto flex-shrink-0">
            {relativeTime(arg.created_at)}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm text-surface-300 leading-relaxed">{renderWithMentions(arg.content)}</p>

        {/* Reply toggle */}
        <button
          type="button"
          onClick={() => setShowReplies((v) => !v)}
          className={cn(
            'mt-2 flex items-center gap-1 text-[11px] font-mono transition-colors',
            showReplies
              ? 'text-surface-400 hover:text-surface-300'
              : 'text-surface-600 hover:text-surface-400'
          )}
        >
          <MessageSquare className="h-3 w-3" aria-hidden />
          {showReplies ? 'Hide replies' : 'Reply'}
        </button>
      </div>

      {/* Right: upvote + tip column */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 pl-1">
        {/* Upvote */}
        <button
          type="button"
          onClick={handleUpvote}
          disabled={!canUpvote || upvoting}
          aria-label={arg.has_upvoted ? 'Remove upvote' : 'Upvote this argument'}
          aria-pressed={arg.has_upvoted}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all',
            canUpvote
              ? arg.has_upvoted
                ? 'text-emerald bg-emerald/10 hover:bg-emerald/20'
                : 'text-surface-500 hover:text-white hover:bg-surface-300'
              : 'text-surface-700 cursor-default'
          )}
        >
          {upvoting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
          <span className="text-[10px] font-mono">{arg.upvotes}</span>
        </button>

        {/* Tip Clout — only for other users' arguments */}
        {canUpvote && arg.author && (
          <GiftCloutButton
            recipientId={arg.user_id}
            recipientName={arg.author.display_name || arg.author.username || 'this user'}
            size="sm"
          />
        )}
      </div>
    </div>

    {/* Inline reply thread */}
    <AnimatePresence>
      {showReplies && (
        <div
          className={cn(
            'border-x border-b rounded-b-xl px-4 pb-3',
            isFor ? 'bg-for-500/5 border-for-500/30' : 'bg-against-500/5 border-against-500/30'
          )}
        >
          <ReplyPanel
            topicId={topicId}
            argumentId={arg.id}
            currentUserId={currentUserId}
            side={arg.side}
          />
        </div>
      )}
    </AnimatePresence>
    </div>
  )
}

// ─── Post form ────────────────────────────────────────────────────────────────

function PostArgumentForm({
  topicId,
  onPosted,
}: {
  topicId: string
  onPosted: (arg: TopicArgumentWithAuthor) => void
}) {
  const [side, setSide] = useState<'blue' | 'red' | null>(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)
  const [mentionResultCount, setMentionResultCount] = useState(0)
  const mentionResultsRef = useRef<MentionSuggestion[]>([])

  const remaining = MAX_CHARS - content.length
  const isValid = side !== null && content.trim().length >= MIN_CHARS && content.trim().length <= MAX_CHARS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}/arguments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, content: content.trim() }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to post argument')
        return
      }

      onPosted(json.argument as TopicArgumentWithAuthor)
      setContent('')
      setSide(null)
      setMentionQuery(null)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function handleArgContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    const cursor = e.target.selectionStart ?? val.length
    const ctx = getMentionContext(val, cursor)
    if (ctx) {
      setMentionQuery(ctx.query)
      setMentionSelectedIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  function insertArgMention(s: MentionSuggestion) {
    const textarea = textareaRef.current
    const cursor = textarea?.selectionStart ?? content.length
    const ctx = getMentionContext(content, cursor)
    if (!ctx) return
    const before = content.slice(0, ctx.startPos)
    const after = content.slice(cursor)
    const inserted = `@${s.username} `
    const newContent = before + inserted + after
    setContent(newContent)
    setMentionQuery(null)
    setTimeout(() => {
      if (!textarea) return
      textarea.focus()
      const newCursor = before.length + inserted.length
      textarea.setSelectionRange(newCursor, newCursor)
    }, 0)
  }

  function handleArgKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionResultCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionSelectedIndex((i) => Math.min(i + 1, mentionResultCount - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const selected = mentionResultsRef.current[mentionSelectedIndex]
        if (selected) {
          e.preventDefault()
          insertArgMention(selected)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Side selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSide('blue')}
          aria-pressed={side === 'blue'}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-mono font-semibold border transition-all',
            side === 'blue'
              ? 'bg-for-500/20 text-for-300 border-for-500/60 shadow-sm'
              : 'bg-transparent text-surface-500 border-surface-400 hover:border-for-500/40 hover:text-for-400'
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          For
        </button>
        <button
          type="button"
          onClick={() => setSide('red')}
          aria-pressed={side === 'red'}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-mono font-semibold border transition-all',
            side === 'red'
              ? 'bg-against-500/20 text-against-300 border-against-500/60 shadow-sm'
              : 'bg-transparent text-surface-500 border-surface-400 hover:border-against-500/40 hover:text-against-400'
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Against
        </button>
      </div>

      {/* Text area */}
      <div className="relative">
        {mentionQuery !== null && (
          <MentionAutocomplete
            query={mentionQuery}
            selectedIndex={mentionSelectedIndex}
            onSelect={insertArgMention}
            onClose={() => setMentionQuery(null)}
            onResultsChange={setMentionResultCount}
            onResultsReady={(r) => { mentionResultsRef.current = r }}
            position="above"
          />
        )}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleArgContentChange}
          onKeyDown={handleArgKeyDown}
          placeholder={
            side === 'blue'
              ? 'Make your case for this proposition… (@username to mention)'
              : side === 'red'
                ? 'Make your case against this proposition… (@username to mention)'
                : 'Select a side, then make your argument…'
          }
          rows={3}
          maxLength={MAX_CHARS}
          aria-label="Argument text"
          className={cn(
            'w-full resize-none rounded-xl px-4 py-3 text-sm',
            'bg-surface-200 border border-surface-300',
            'text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
            'transition-colors',
            !side && 'opacity-60'
          )}
          disabled={!side}
        />
        <span
          className={cn(
            'absolute bottom-2.5 right-3 text-[10px] font-mono',
            remaining < 50 ? 'text-against-400' : 'text-surface-600'
          )}
          aria-live="polite"
        >
          {remaining}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-xs text-against-400 font-mono">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!isValid || submitting}
        className="w-full"
        size="sm"
      >
        {submitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            Posting…
          </>
        ) : (
          'Post Argument'
        )}
      </Button>
    </form>
  )
}

// ─── Side column ──────────────────────────────────────────────────────────────

function SideColumn({
  side,
  args,
  topicId,
  currentUserId,
  onUpvote,
}: {
  side: 'for' | 'against'
  args: TopicArgumentWithAuthor[]
  topicId: string
  currentUserId: string | null
  onUpvote: (argId: string, currentlyUpvoted: boolean) => Promise<void>
}) {
  const isFor = side === 'for'
  const dotClass = isFor ? 'bg-for-500' : 'bg-against-500'
  const labelClass = isFor ? 'text-for-400' : 'text-against-400'
  const label = isFor ? 'For' : 'Against'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-2 w-2 rounded-full', dotClass)} aria-hidden />
        <span className={cn('text-xs font-mono font-semibold uppercase tracking-wide', labelClass)}>
          {label} · {args.length}
        </span>
      </div>
      {args.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-surface-400/30 text-center">
          <p className="text-xs text-surface-500 italic">
            No {label.toLowerCase()} arguments yet.
          </p>
          <p className="text-[11px] text-surface-600 mt-0.5">Be the first to argue {isFor ? 'for' : 'against'} this.</p>
        </div>
      ) : (
        args.map((arg) => (
          <ArgumentCard
            key={arg.id}
            arg={arg}
            topicId={topicId}
            currentUserId={currentUserId}
            onUpvote={onUpvote}
          />
        ))
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArgumentThread({ topicId }: ArgumentThreadProps) {
  const [args, setArgs] = useState<TopicArgumentWithAuthor[]>([])
  const [myArgumentId, setMyArgumentId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('top')
  const [mobileTab, setMobileTab] = useState<MobileTab>('all')

  // Get current user id for self-detection
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  const loadArguments = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topicId}/arguments`)
      if (!res.ok) return
      const json = await res.json()
      setArgs(json.arguments ?? [])
      setMyArgumentId(json.myArgumentId ?? null)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    loadArguments()
  }, [loadArguments])

  // Append a newly posted argument and hide the form
  const handlePosted = (_newArg: TopicArgumentWithAuthor) => {
    loadArguments()
    setShowForm(false)
  }

  // Toggle upvote optimistically
  const handleUpvote = useCallback(
    async (argId: string, currentlyUpvoted: boolean) => {
      // Optimistic update
      setArgs((prev) =>
        prev.map((a) =>
          a.id === argId
            ? {
                ...a,
                has_upvoted: !currentlyUpvoted,
                upvotes: currentlyUpvoted
                  ? Math.max(0, a.upvotes - 1)
                  : a.upvotes + 1,
              }
            : a
        )
      )

      try {
        const res = await fetch(
          `/api/topics/${topicId}/arguments/${argId}/upvote`,
          { method: 'POST' }
        )
        if (res.ok) {
          const json = await res.json()
          setArgs((prev) =>
            prev.map((a) =>
              a.id === argId
                ? { ...a, has_upvoted: json.upvoted, upvotes: json.upvotes }
                : a
            )
          )
        } else {
          // Revert on failure
          setArgs((prev) =>
            prev.map((a) =>
              a.id === argId
                ? {
                    ...a,
                    has_upvoted: currentlyUpvoted,
                    upvotes: currentlyUpvoted
                      ? a.upvotes + 1
                      : Math.max(0, a.upvotes - 1),
                  }
                : a
            )
          )
        }
      } catch {
        // Revert on network error
        setArgs((prev) =>
          prev.map((a) =>
            a.id === argId
              ? {
                  ...a,
                  has_upvoted: currentlyUpvoted,
                  upvotes: currentlyUpvoted
                    ? a.upvotes + 1
                    : Math.max(0, a.upvotes - 1),
                }
              : a
          )
        )
      }
    },
    [topicId]
  )

  const hasPosted = myArgumentId !== null

  // Client-side sort
  const sorted = [...args].sort((a, b) => {
    if (sortMode === 'new') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    // top: by upvotes desc, then newest
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const forArgs = sorted.filter((a) => a.side === 'blue')
  const againstArgs = sorted.filter((a) => a.side === 'red')

  // For mobile stacked tab view
  const mobileArgs =
    mobileTab === 'for'
      ? forArgs
      : mobileTab === 'against'
        ? againstArgs
        : sorted

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <ArgumentThreadSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-mono font-semibold text-white">
            Arguments
            {args.length > 0 && (
              <span className="ml-2 text-surface-500 font-normal">
                ({args.length})
              </span>
            )}
          </h3>
          <p className="text-xs text-surface-500 mt-0.5">
            Make your case — one argument per person.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Sort toggle */}
          {args.length > 1 && (
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === 'top' ? 'new' : 'top'))}
              aria-label={`Sort by ${sortMode === 'top' ? 'newest' : 'top'}`}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:text-white transition-colors'
              )}
            >
              {sortMode === 'top' ? (
                <>
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  Top
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" aria-hidden />
                  New
                </>
              )}
              <ArrowUpDown className="h-3 w-3 text-surface-500" aria-hidden />
            </button>
          )}

          {/* Post CTA */}
          {currentUserId && !hasPosted && !showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                'bg-surface-200 text-surface-400 border border-surface-300',
                'hover:bg-surface-300 hover:text-white transition-colors'
              )}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Argue
            </button>
          )}
        </div>
      </div>

      {/* ── Post form ── */}
      {showForm && currentUserId && !hasPosted && (
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              Your argument
            </span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-surface-600 hover:text-surface-400 transition-colors"
            >
              Cancel
            </button>
          </div>
          <PostArgumentForm topicId={topicId} onPosted={handlePosted} />
        </div>
      )}

      {/* Already posted — nudge */}
      {hasPosted && currentUserId && (
        <div className="text-xs text-surface-500 font-mono px-1">
          You&apos;ve made your argument. Upvote others you agree with.
        </div>
      )}

      {/* Not logged in */}
      {!currentUserId && (
        <div className="text-xs text-surface-500 font-mono px-1">
          <a href="/login" className="text-for-400 hover:underline">
            Sign in
          </a>{' '}
          to post an argument.
        </div>
      )}

      {/* ── Empty state ── */}
      {args.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="h-10 w-10 rounded-xl bg-surface-200 flex items-center justify-center mb-3">
            <MessageSquarePlus className="h-5 w-5 text-surface-500" />
          </div>
          <p className="text-sm text-surface-500">No arguments yet.</p>
          <p className="text-xs text-surface-600 mt-1">
            Be the first to make a case.
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile: tab switcher (All / For / Against) ── */}
          <div className="flex gap-1 md:hidden">
            {([
              { id: 'all', label: `All (${args.length})` },
              { id: 'for', label: `For (${forArgs.length})` },
              { id: 'against', label: `Against (${againstArgs.length})` },
            ] as { id: MobileTab; label: string }[]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                aria-pressed={mobileTab === tab.id}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors',
                  mobileTab === tab.id
                    ? tab.id === 'for'
                      ? 'bg-for-500/15 text-for-400 border-for-500/40'
                      : tab.id === 'against'
                        ? 'bg-against-500/15 text-against-400 border-against-500/40'
                        : 'bg-surface-300 text-white border-surface-400'
                    : 'bg-transparent text-surface-500 border-surface-400 hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Mobile stacked list ── */}
          <div className="md:hidden space-y-2">
            {mobileArgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-surface-400/30 text-center">
                <p className="text-xs text-surface-500 italic">
                  No {mobileTab === 'for' ? 'FOR' : 'AGAINST'} arguments yet.
                </p>
              </div>
            ) : (
              mobileArgs.map((arg) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  topicId={topicId}
                  currentUserId={currentUserId}
                  onUpvote={handleUpvote}
                />
              ))
            )}
          </div>

          {/* ── Desktop 2-column layout ── */}
          <div className="hidden md:grid md:grid-cols-2 gap-4">
            <SideColumn
              side="for"
              args={forArgs}
              topicId={topicId}
              currentUserId={currentUserId}
              onUpvote={handleUpvote}
            />
            <SideColumn
              side="against"
              args={againstArgs}
              topicId={topicId}
              currentUserId={currentUserId}
              onUpvote={handleUpvote}
            />
          </div>
        </>
      )}
    </div>
  )
}
