'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Gavel,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Star,
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
import type { RelayComment, RelayCommentsResponse } from '@/app/api/relays/[id]/comments/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  relayId: string
  side: 'for' | 'against'
  status: 'open' | 'in_progress' | 'complete' | 'voted'
  maxLegs: number
  topicId: string | null
  topicStatement: string | null
  topicCategory: string | null
  voteCompelling: number
  voteNotCompelling: number
  completedAt?: string | null
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Props['status'], { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'text-emerald border-emerald/30 bg-emerald/10' },
  in_progress: { label: 'In Progress', cls: 'text-gold border-gold/30 bg-gold/10' },
  complete:    { label: 'Complete',    cls: 'text-for-400 border-for-500/30 bg-for-500/10' },
  voted:       { label: 'Voted',       cls: 'text-surface-400 border-surface-400/30 bg-surface-300/10' },
}

// ─── Single comment row ───────────────────────────────────────────────────────

function CommentRow({
  comment,
  relayId,
  onDelete,
}: {
  comment: RelayComment
  relayId: string
  onDelete: (id: string) => void
}) {
  const [upvoted, setUpvoted] = useState(comment.user_upvoted)
  const [upvoteCount, setUpvoteCount] = useState(comment.upvote_count)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function toggleUpvote() {
    if (busy) return
    setBusy(true)
    try {
      const method = upvoted ? 'DELETE' : 'POST'
      const res = await fetch(`/api/relays/${relayId}/comments/${comment.id}/upvote`, { method })
      if (res.ok || res.status === 409) {
        setUpvoted((p) => !p)
        setUpvoteCount((p) => (upvoted ? Math.max(0, p - 1) : p + 1))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/relays/${relayId}/comments/${comment.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(comment.id)
    } finally {
      setDeleting(false)
    }
  }

  const isCurrentUser = false // optimistic — would need session

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex gap-3 group"
    >
      <Link href={`/profile/${comment.author.username}`} className="flex-shrink-0 mt-0.5">
        <Avatar
          src={comment.author.avatar_url}
          fallback={comment.author.display_name || comment.author.username}
          size="sm"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            href={`/profile/${comment.author.username}`}
            className="text-sm font-semibold text-white hover:text-for-400 transition-colors"
          >
            {comment.author.display_name || comment.author.username}
          </Link>
          <span className="text-xs text-surface-500 font-mono">@{comment.author.username}</span>
          {comment.leg_number != null && (
            <span className="text-[11px] text-surface-500 border border-surface-400/40 rounded px-1.5 py-0.5">
              re: Leg {comment.leg_number}
            </span>
          )}
          <span className="text-xs text-surface-600 ml-auto">{relativeTime(comment.created_at)}</span>
        </div>
        <p className="mt-1 text-sm text-surface-100 leading-relaxed whitespace-pre-wrap break-words">
          {comment.content}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={toggleUpvote}
            disabled={busy}
            aria-label={upvoted ? 'Remove upvote' : 'Upvote comment'}
            className={cn(
              'flex items-center gap-1 text-xs font-mono transition-colors disabled:opacity-50',
              upvoted ? 'text-gold' : 'text-surface-500 hover:text-gold',
            )}
          >
            <Star className={cn('h-3.5 w-3.5', upvoted && 'fill-gold')} aria-hidden="true" />
            <span>{upvoteCount > 0 ? upvoteCount : ''}</span>
          </button>
          {isCurrentUser && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete comment"
              className="text-xs text-surface-600 hover:text-against-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'delete'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiscussionClient({
  relayId,
  side,
  status,
  maxLegs,
  topicId,
  topicStatement,
  topicCategory,
  voteCompelling,
  voteNotCompelling,
}: Props) {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [comments, setComments] = useState<RelayComment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [draft, setDraft] = useState('')
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null)
  const [showLegPicker, setShowLegPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load comments ──────────────────────────────────────────────────────────

  const loadComments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relayId}/comments`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as RelayCommentsResponse
      setComments(data.comments)
      setTotal(data.total)
    } catch {
      setError('Could not load comments. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [relayId])

  useEffect(() => { loadComments() }, [loadComments])

  // ── Post comment ───────────────────────────────────────────────────────────

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || posting) return
    setPosting(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relayId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, leg_number: selectedLeg }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const { error: e } = (await res.json()) as { error?: string }
        throw new Error(e ?? 'Failed to post')
      }
      const { comment } = (await res.json()) as { comment: RelayComment }
      setComments((p) => [...p, comment])
      setTotal((p) => p + 1)
      setDraft('')
      setSelectedLeg(null)
      setShowLegPicker(false)
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  function removeComment(id: string) {
    setComments((p) => p.filter((c) => c.id !== id))
    setTotal((p) => Math.max(0, p - 1))
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const isFor = side === 'for'
  const statusCfg = STATUS_CFG[status]
  const totalVotes = voteCompelling + voteNotCompelling
  const compellingPct = totalVotes > 0 ? Math.round((voteCompelling / totalVotes) * 100) : null
  const charCount = draft.length
  const remaining = 500 - charCount

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* ── Back + breadcrumb ── */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => router.push(`/relays/${relayId}`)}
            aria-label="Back to relay"
            className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Relay</span>
          </button>
          <span className="text-surface-600" aria-hidden="true">/</span>
          <span className="text-sm text-surface-300">Discussion</span>
        </div>

        {/* ── Header ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span
                  className={cn(
                    'text-xs font-mono font-bold px-2 py-0.5 rounded-md border uppercase',
                    isFor
                      ? 'text-for-400 border-for-500/30 bg-for-500/10'
                      : 'text-against-400 border-against-500/30 bg-against-500/10',
                  )}
                >
                  {isFor ? 'FOR' : 'AGAINST'}
                </span>
                <span
                  className={cn(
                    'text-xs font-mono px-2 py-0.5 rounded-md border',
                    statusCfg.cls,
                  )}
                >
                  {statusCfg.label}
                </span>
                {topicCategory && (
                  <Badge variant="outline" size="sm">{topicCategory}</Badge>
                )}
              </div>
              {topicStatement ? (
                <p className="text-base font-semibold text-white leading-snug">
                  {topicStatement}
                </p>
              ) : (
                <p className="text-sm text-surface-400 italic">No topic linked</p>
              )}
            </div>
          </div>

          {/* Vote tally */}
          {totalVotes > 0 && compellingPct != null && (
            <div className="mt-4 pt-4 border-t border-surface-300">
              <div className="flex items-center justify-between text-xs text-surface-500 mb-1.5">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                  Compelling ({voteCompelling})
                </span>
                <span className="font-mono text-surface-300">{compellingPct}%</span>
                <span className="flex items-center gap-1">
                  Not compelling ({voteNotCompelling})
                  <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500 transition-all"
                  style={{ width: `${compellingPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Nav links */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link
              href={`/relays/${relayId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-surface-400 hover:text-white border border-surface-300/60 hover:border-surface-400 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              View chain
            </Link>
            <Link
              href={`/relays/${relayId}/transcript`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-surface-400 hover:text-white border border-surface-300/60 hover:border-surface-400 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Transcript
            </Link>
            {topicId && (
              <Link
                href={`/topic/${topicId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-surface-400 hover:text-white border border-surface-300/60 hover:border-surface-400 transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                Topic page
              </Link>
            )}
          </div>
        </div>

        {/* ── Comments section ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-surface-400" aria-hidden="true" />
              Discussion
              {total > 0 && (
                <span className="text-xs font-mono text-surface-500 ml-1">
                  {total}
                </span>
              )}
            </h2>
            {!loading && (
              <button
                onClick={loadComments}
                aria-label="Refresh comments"
                className="p-1.5 rounded-lg text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-against-900/20 border border-against-700/30 p-3 mb-4 text-sm text-against-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title="No comments yet"
              description="Be the first to share your thoughts on this relay chain."
            />
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    relayId={relayId}
                    onDelete={removeComment}
                  />
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Compose area ── */}
        <div className="sticky bottom-20 md:static md:bottom-auto">
          <form
            onSubmit={submitComment}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
          >
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="relay-comment" className="text-xs font-semibold text-surface-400">
                  Add your thoughts
                </label>
                {/* Leg picker toggle */}
                <button
                  type="button"
                  onClick={() => setShowLegPicker((p) => !p)}
                  aria-expanded={showLegPicker}
                  aria-label="Reference a specific leg"
                  className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {selectedLeg != null ? (
                    <span className="text-for-400 font-mono">Leg {selectedLeg}</span>
                  ) : (
                    <span>Ref leg</span>
                  )}
                  {showLegPicker ? (
                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Leg picker */}
              <AnimatePresence>
                {showLegPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLeg(null)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                          selectedLeg == null
                            ? 'bg-for-600/20 border-for-600/40 text-for-400'
                            : 'border-surface-400/40 text-surface-400 hover:border-surface-300',
                        )}
                      >
                        Overall
                      </button>
                      {Array.from({ length: maxLegs }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSelectedLeg(n)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                            selectedLeg === n
                              ? 'bg-for-600/20 border-for-600/40 text-for-400'
                              : 'border-surface-400/40 text-surface-400 hover:border-surface-300',
                          )}
                        >
                          Leg {n}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                id="relay-comment"
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  selectedLeg != null
                    ? `Comment on Leg ${selectedLeg}…`
                    : 'Share your thoughts on this relay chain…'
                }
                aria-label="Comment text"
                className={cn(
                  'w-full resize-none rounded-xl bg-surface-200 border px-3.5 py-2.5 text-sm',
                  'text-white placeholder:text-surface-500',
                  'focus:outline-none focus:ring-2 focus:ring-for-600/50',
                  'transition-colors',
                  remaining < 0
                    ? 'border-against-500/50'
                    : 'border-surface-300/60 focus:border-for-600/50',
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-xs font-mono',
                  remaining < 50 ? (remaining < 0 ? 'text-against-400' : 'text-gold') : 'text-surface-600',
                )}
              >
                {remaining}
              </span>
              <button
                type="submit"
                disabled={!draft.trim() || remaining < 0 || posting}
                aria-label="Post comment"
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold',
                  'bg-for-600 text-white hover:bg-for-500',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'transition-all',
                )}
              >
                {posting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Post
              </button>
            </div>
          </form>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
