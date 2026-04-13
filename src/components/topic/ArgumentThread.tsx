'use client'

/**
 * ArgumentThread
 *
 * Shows a list of FOR/AGAINST arguments for a topic and allows
 * authenticated users to post their own argument + upvote others.
 *
 * Each user can post exactly one argument per topic.
 * Users cannot upvote their own argument.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronUp,
  Loader2,
  MessageSquarePlus,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'

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

// ─── Single argument card ─────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  currentUserId,
  onUpvote,
}: {
  arg: TopicArgumentWithAuthor
  currentUserId: string | null
  onUpvote: (argId: string, currentlyUpvoted: boolean) => Promise<void>
}) {
  const [upvoting, setUpvoting] = useState(false)
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
    <div
      className={cn(
        'flex gap-3 p-4 rounded-xl border transition-colors',
        sideBg,
        sideBorder,
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
        <p className="text-sm text-surface-300 leading-relaxed">{arg.content}</p>
      </div>

      {/* Right: upvote button */}
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pl-1">
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
      </div>
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
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
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
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            side === 'blue'
              ? 'Make your case for this proposition…'
              : side === 'red'
                ? 'Make your case against this proposition…'
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ArgumentThread({ topicId }: ArgumentThreadProps) {
  const [args, setArgs] = useState<TopicArgumentWithAuthor[]>([])
  const [myArgumentId, setMyArgumentId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

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
    // Re-fetch the full list so the new argument is enriched with author info
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
          // Sync actual count from server
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

  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + CTA */}
      <div className="flex items-center justify-between">
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

      {/* Post form (shown when user clicks Argue) */}
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

      {/* Arguments split by side */}
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
        <div className="grid md:grid-cols-2 gap-4">
          {/* FOR column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-for-500" aria-hidden />
              <span className="text-xs font-mono text-for-400 font-semibold uppercase tracking-wide">
                For · {forArgs.length}
              </span>
            </div>
            {forArgs.length === 0 ? (
              <p className="text-xs text-surface-600 italic px-1">
                No FOR arguments yet.
              </p>
            ) : (
              forArgs.map((arg) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  currentUserId={currentUserId}
                  onUpvote={handleUpvote}
                />
              ))
            )}
          </div>

          {/* AGAINST column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-against-500" aria-hidden />
              <span className="text-xs font-mono text-against-400 font-semibold uppercase tracking-wide">
                Against · {againstArgs.length}
              </span>
            </div>
            {againstArgs.length === 0 ? (
              <p className="text-xs text-surface-600 italic px-1">
                No AGAINST arguments yet.
              </p>
            ) : (
              againstArgs.map((arg) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  currentUserId={currentUserId}
                  onUpvote={handleUpvote}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
