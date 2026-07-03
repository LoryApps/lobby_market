'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  FlipHorizontal,
  Lightbulb,
  Loader2,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ChangemakerEntry,
  ChangemakersResponse,
} from '@/app/api/topics/[id]/changemakers/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const SIDE_CONFIG = {
  for: {
    label: 'FOR',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    pill: 'bg-for-500/20 text-for-400 border border-for-500/40',
    icon: ThumbsUp,
  },
  against: {
    label: 'AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    pill: 'bg-against-500/20 text-against-400 border border-against-500/40',
    icon: ThumbsDown,
  },
}

const CHAR_MIN = 20
const CHAR_MAX = 500

// ─── Add / Edit Form ──────────────────────────────────────────────────────────

interface FormProps {
  topicId: string
  existing: ChangemakerEntry | null
  userVote: 'for' | 'against' | null
  onSaved: (entry: ChangemakerEntry) => void
  onClose: () => void
}

function ChangemakerForm({ topicId, existing, userVote, onSaved, onClose }: FormProps) {
  const [condition, setCondition] = useState(existing?.condition ?? '')
  const [side, setSide] = useState<'for' | 'against'>(
    existing?.current_vote ?? userVote ?? 'for'
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const remaining = CHAR_MAX - condition.length
  const valid = condition.trim().length >= CHAR_MIN && condition.trim().length <= CHAR_MAX

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/changemakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition: condition.trim(), current_vote: side }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save')
        return
      }
      // Return a provisional entry to update UI immediately
      const provisional: ChangemakerEntry = {
        id: json.id ?? existing?.id ?? 'temp',
        user_id: '',
        username: '',
        display_name: null,
        avatar_url: null,
        role: 'person',
        current_vote: side,
        condition: condition.trim(),
        upvotes: existing?.upvotes ?? 0,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        viewer_upvoted: existing?.viewer_upvoted ?? false,
        is_own: true,
      }
      onSaved(provisional)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
          <FlipHorizontal className="h-3.5 w-3.5 text-purple" />
          {existing ? 'Edit your changemaker' : 'Add your changemaker'}
        </h3>
        <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors p-1 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-[11px] font-mono text-surface-500 mb-3">
        What evidence or argument would genuinely flip your position?
      </p>

      {/* Side selector */}
      <div className="flex gap-2 mb-3">
        {(['for', 'against'] as const).map((s) => {
          const cfg = SIDE_CONFIG[s]
          const Icon = cfg.icon
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                side === s
                  ? cfg.pill
                  : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
              )}
            >
              <Icon className="h-3 w-3" />
              I currently vote {cfg.label}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            ref={textRef}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder={`e.g. "If independent studies showed ${side === 'for' ? 'this policy caused net harm' : 'this policy had documented success'}, I would change my vote."`}
            rows={3}
            maxLength={CHAR_MAX}
            className={cn(
              'w-full rounded-lg bg-surface-200 border px-3 py-2.5 text-sm text-white placeholder:text-surface-500',
              'focus:outline-none focus:ring-1 resize-none transition-colors font-mono',
              error
                ? 'border-against-500 focus:ring-against-500/50'
                : 'border-surface-300 focus:border-surface-400 focus:ring-surface-400/30'
            )}
          />
          <span
            className={cn(
              'absolute bottom-2 right-3 text-[10px] font-mono tabular-nums',
              remaining < 50 ? 'text-against-400' : remaining < 100 ? 'text-gold' : 'text-surface-600'
            )}
          >
            {remaining}
          </span>
        </div>

        {condition.trim().length > 0 && condition.trim().length < CHAR_MIN && (
          <p className="text-[11px] font-mono text-against-400">
            At least {CHAR_MIN} characters required ({CHAR_MIN - condition.trim().length} more)
          </p>
        )}

        {error && (
          <p className="text-[11px] font-mono text-against-400">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || submitting}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
              'bg-purple/80 border-purple/50 text-white hover:bg-purple',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {existing ? 'Save changes' : 'Add changemaker'}
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// ─── Entry row ────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: ChangemakerEntry
  topicId: string
  onUpvoteToggled: (id: string, newUpvoted: boolean, delta: number) => void
  onEditClick: () => void
  onDelete: (id: string) => void
}

function EntryRow({ entry, topicId, onUpvoteToggled, onEditClick, onDelete }: EntryRowProps) {
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cfg = SIDE_CONFIG[entry.current_vote]
  const Icon = cfg.icon

  async function handleUpvote() {
    if (busy || entry.is_own) return
    setBusy(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/changemakers/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changemaker_id: entry.id }),
      })
      if (res.ok) {
        const json = await res.json()
        onUpvoteToggled(entry.id, json.upvoted, json.upvoted ? 1 : -1)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/changemakers`, { method: 'DELETE' })
      if (res.ok) onDelete(entry.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'rounded-xl border p-3.5 transition-colors',
        entry.is_own
          ? 'bg-purple/5 border-purple/20'
          : 'bg-surface-100 border-surface-200 hover:border-surface-300'
      )}
    >
      {/* Top row: avatar + meta + side pill */}
      <div className="flex items-start gap-2.5 mb-2">
        <Link href={`/profile/${entry.username}`} className="shrink-0 mt-0.5">
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="sm"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name || entry.username}
            </Link>
            <span className="text-[10px] font-mono text-surface-600 shrink-0">
              {relativeTime(entry.created_at)}
            </span>
            {entry.is_own && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-purple bg-purple/10 border border-purple/20 px-1.5 py-0.5 rounded">
                you
              </span>
            )}
          </div>

          <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded mt-0.5', cfg.pill)}>
            <Icon className="h-2.5 w-2.5" />
            Votes {cfg.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {entry.is_own && (
            <>
              <button
                onClick={onEditClick}
                className="p-1 rounded text-surface-500 hover:text-white transition-colors"
                aria-label="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1 rounded text-surface-500 hover:text-against-400 transition-colors disabled:opacity-40"
                aria-label="Delete"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Condition text */}
      <p className="text-sm text-surface-200 leading-relaxed pl-9">
        {entry.condition}
      </p>

      {/* Upvote */}
      <div className="mt-2.5 pl-9 flex items-center gap-2">
        <button
          onClick={handleUpvote}
          disabled={busy || !!entry.is_own}
          aria-label={entry.viewer_upvoted ? 'Remove upvote' : 'Upvote this changemaker'}
          className={cn(
            'flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-1 rounded-lg border transition-all',
            'disabled:cursor-not-allowed',
            entry.viewer_upvoted
              ? 'bg-for-500/20 border-for-500/40 text-for-400'
              : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:border-for-500/40 hover:text-for-400',
            entry.is_own && 'opacity-40'
          )}
        >
          {busy
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <ThumbsUp className="h-3 w-3" />
          }
          <span>{entry.upvotes}</span>
        </button>

        <span className="text-[10px] font-mono text-surface-600">
          {entry.upvotes === 1 ? '1 person agrees this would be convincing' : `${entry.upvotes} people agree`}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface TopicChangemakersPanelProps {
  topicId: string
  userVote?: 'for' | 'against' | null
  className?: string
}

type ViewFilter = 'all' | 'for' | 'against'

const PREVIEW_COUNT = 4

export function TopicChangemakersPanel({
  topicId,
  userVote,
  className,
}: TopicChangemakersPanelProps) {
  const [data, setData] = useState<ChangemakersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingOwn, setEditingOwn] = useState(false)
  const [filter, setFilter] = useState<ViewFilter>('all')
  const [expanded, setExpanded] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    import('@/lib/supabase/client')
      .then(({ createClient }) => createClient().auth.getUser())
      .then(({ data: { user } }) => setIsLoggedIn(!!user))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/changemakers`)
      if (!res.ok) return
      const json = (await res.json()) as ChangemakersResponse
      setData(json)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  function handleUpvoteToggled(id: string, newUpvoted: boolean, delta: number) {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === id
            ? { ...e, upvotes: Math.max(0, e.upvotes + delta), viewer_upvoted: newUpvoted }
            : e
        ),
      }
    })
  }

  function handleDelete(id: string) {
    setData((prev) => {
      if (!prev) return prev
      const entries = prev.entries.filter((e) => e.id !== id)
      return {
        ...prev,
        entries,
        viewer_entry: null,
        stats: {
          ...prev.stats,
          total: prev.stats.total - 1,
          for_count: prev.stats.for_count - (prev.viewer_entry?.current_vote === 'for' ? 1 : 0),
          against_count: prev.stats.against_count - (prev.viewer_entry?.current_vote === 'against' ? 1 : 0),
        },
      }
    })
    setEditingOwn(false)
    setShowForm(false)
  }

  function handleSaved(entry: ChangemakerEntry) {
    setData((prev) => {
      if (!prev) return prev
      const isUpdate = !!prev.viewer_entry
      const entries = isUpdate
        ? prev.entries.map((e) => (e.is_own ? { ...e, ...entry } : e))
        : [{ ...entry, upvotes: 0, viewer_upvoted: false, is_own: true }, ...prev.entries]
      return {
        ...prev,
        entries,
        viewer_entry: entry,
        stats: isUpdate ? prev.stats : {
          ...prev.stats,
          total: prev.stats.total + 1,
          for_count: prev.stats.for_count + (entry.current_vote === 'for' ? 1 : 0),
          against_count: prev.stats.against_count + (entry.current_vote === 'against' ? 1 : 0),
        },
      }
    })
    setShowForm(false)
    setEditingOwn(false)
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 p-5', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3.5 w-36 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-200 bg-surface-50 p-3.5">
              <div className="flex gap-2.5 mb-2">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-3 w-full rounded ml-9 mb-1" />
              <Skeleton className="h-3 w-3/4 rounded ml-9" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { entries, stats, viewer_entry } = data

  const filteredEntries = filter === 'all'
    ? entries
    : entries.filter((e) => e.current_vote === filter)

  const visibleEntries = expanded ? filteredEntries : filteredEntries.slice(0, PREVIEW_COUNT)
  const hasMore = filteredEntries.length > PREVIEW_COUNT

  return (
    <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple/10 border border-purple/20">
            <FlipHorizontal className="h-3.5 w-3.5 text-purple" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold text-white">
              What would change minds?
            </h3>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">
              {stats.total === 0
                ? 'No changemakers yet — be first'
                : `${stats.total} ${stats.total === 1 ? 'person has' : 'people have'} shared what would flip their vote`}
            </p>
          </div>
        </div>

        {/* Stats pills */}
        {stats.total > 0 && (
          <div className="flex gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-for-500/15 text-for-400 border border-for-500/30">
              <ThumbsUp className="h-2.5 w-2.5" />
              {stats.for_count}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-against-500/15 text-against-400 border border-against-500/30">
              <ThumbsDown className="h-2.5 w-2.5" />
              {stats.against_count}
            </span>
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      <AnimatePresence>
        {(showForm || editingOwn) && (
          <ChangemakerForm
            key="form"
            topicId={topicId}
            existing={editingOwn ? (viewer_entry ?? null) : null}
            userVote={userVote ?? null}
            onSaved={handleSaved}
            onClose={() => { setShowForm(false); setEditingOwn(false) }}
          />
        )}
      </AnimatePresence>

      {/* CTA — add your changemaker */}
      {!showForm && !editingOwn && isLoggedIn && !viewer_entry && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-surface-300 hover:border-purple/40 hover:bg-purple/5 text-surface-500 hover:text-white transition-all text-sm font-mono mb-4 group"
        >
          <Plus className="h-3.5 w-3.5 group-hover:text-purple transition-colors" />
          Add what would change your mind…
        </button>
      )}

      {/* Filter tabs */}
      {stats.total > 0 && (
        <div className="flex gap-1.5 mb-3">
          {(['all', 'for', 'against'] as const).map((f) => {
            const count = f === 'all' ? stats.total : f === 'for' ? stats.for_count : stats.against_count
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-all',
                  filter === f
                    ? f === 'for'
                      ? 'bg-for-500/20 border-for-500/40 text-for-400'
                      : f === 'against'
                        ? 'bg-against-500/20 border-against-500/40 text-against-400'
                        : 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-transparent border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {f === 'all' ? 'All' : f === 'for' ? 'Votes FOR' : 'Votes AGAINST'} · {count}
              </button>
            )
          })}
        </div>
      )}

      {/* Entries */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5 text-surface-500" />}
          title={filter === 'all' ? 'No changemakers yet' : `No ${filter === 'for' ? 'FOR' : 'AGAINST'} changemakers`}
          description={
            isLoggedIn
              ? 'Be the first to share what evidence would shift your position.'
              : 'Sign in to share what would change your mind.'
          }
          size="sm"
        />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {visibleEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                topicId={topicId}
                onUpvoteToggled={handleUpvoteToggled}
                onEditClick={() => { setEditingOwn(true); setShowForm(false) }}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-mono text-surface-500 hover:text-white transition-colors rounded-lg hover:bg-surface-200/50"
            >
              {expanded
                ? <><ChevronUp className="h-3.5 w-3.5" /> Show fewer</>
                : <><ChevronDown className="h-3.5 w-3.5" /> Show {filteredEntries.length - PREVIEW_COUNT} more</>
              }
            </button>
          )}
        </div>
      )}

      {/* Footer: hint + full-page link */}
      <div className="mt-3 flex items-center justify-between gap-3">
        {stats.total > 0 && (
          <p className="text-[10px] font-mono text-surface-600">
            Upvote conditions you find genuinely convincing
          </p>
        )}
        <Link
          href={`/topic/${topicId}/changemaker`}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-purple hover:text-purple/80 transition-colors ml-auto shrink-0"
        >
          <FlipHorizontal className="h-3 w-3" />
          Full changemakers page &rarr;
        </Link>
      </div>
    </div>
  )
}
