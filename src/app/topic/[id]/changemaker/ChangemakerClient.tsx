'use client'

/**
 * /topic/[id]/changemaker — "What Would Change My Mind?"
 *
 * Voters publicly declare the specific evidence or argument that would flip
 * their position. This creates structured persuasion targets for the other
 * side — a map of minds that can actually be changed.
 *
 * Distinct from:
 *   /topic/[id]/reasons     — why you voted the way you did (past)
 *   /topic/[id]/swing       — who already changed their vote (past)
 *   /topic/[id]/steelman    — the strongest case for each side
 *
 * This is forward-looking: what would move you?
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  Edit3,
  Loader2,
  RefreshCw,
  Send,
  ThumbsUp,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChangemakersResponse, ChangemakerEntry } from '@/app/api/topics/[id]/changemakers/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}

const VOTE_LABEL: Record<string, string> = {
  for: 'Voted FOR',
  against: 'Voted AGAINST',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Single changemaker card ──────────────────────────────────────────────────

interface CardProps {
  entry: ChangemakerEntry
  onUpvote: (id: string) => void
  onEdit: () => void
  onDelete: () => void
  upvoting: boolean
}

function ChangemakerCard({ entry, onUpvote, onEdit, onDelete, upvoting }: CardProps) {
  const roleColor = ROLE_COLOR[entry.role] ?? 'text-surface-500'
  const voteColor = entry.current_vote === 'for'
    ? 'text-for-400 bg-for-500/10 border-for-500/30'
    : 'text-against-400 bg-against-500/10 border-against-500/30'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'bg-surface-200/60 border rounded-xl p-4 space-y-3 transition-colors',
        entry.is_own
          ? 'border-gold/40 bg-gold/5'
          : 'border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              className={cn('text-xs font-semibold hover:underline', roleColor)}
            >
              {entry.display_name || entry.username}
            </Link>
            {entry.is_own && (
              <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded-full">
                you
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5">
            {relativeTime(entry.created_at)}
          </p>
        </div>
        <span className={cn('flex-shrink-0 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border', voteColor)}>
          {VOTE_LABEL[entry.current_vote]}
        </span>
      </div>

      {/* Condition text */}
      <div className="pl-10">
        <p className="text-sm text-white/90 leading-relaxed">
          &ldquo;{entry.condition}&rdquo;
        </p>
      </div>

      {/* Actions */}
      <div className="pl-10 flex items-center gap-2">
        <button
          onClick={() => onUpvote(entry.id)}
          disabled={upvoting || entry.is_own}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            entry.viewer_upvoted
              ? 'bg-emerald/10 border-emerald/40 text-emerald'
              : 'bg-surface-300/60 border-surface-400/60 text-surface-400 hover:text-white hover:border-surface-500/80'
          )}
        >
          <ThumbsUp className={cn('h-3 w-3', entry.viewer_upvoted && 'fill-emerald')} />
          <span>{entry.upvotes}</span>
        </button>

        {entry.is_own && (
          <>
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-400/60 hover:border-surface-500/80 transition-all"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-against-400 hover:text-against-300 border border-against-500/30 hover:border-against-500/50 transition-all"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Submit form ──────────────────────────────────────────────────────────────

interface SubmitFormProps {
  topicId: string
  existing: ChangemakerEntry | null
  onSaved: (entry: ChangemakerEntry | null) => void
}

function SubmitForm({ topicId, existing, onSaved }: SubmitFormProps) {
  const [vote, setVote] = useState<'for' | 'against'>(existing?.current_vote ?? 'for')
  const [text, setText] = useState(existing?.condition ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(!existing)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const charLeft = 500 - text.length

  const handleSave = useCallback(async () => {
    if (text.trim().length < 20) {
      setError('Please write at least 20 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/changemakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_vote: vote, condition: text.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save.')
        return
      }
      setEditing(false)
      onSaved(null) // signal parent to refetch
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }, [topicId, vote, text, onSaved])

  const handleDelete = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/topics/${topicId}/changemakers`, { method: 'DELETE' })
      onSaved(null)
      setText('')
      setEditing(true)
    } finally {
      setSaving(false)
    }
  }, [topicId, onSaved])

  if (!editing && existing) {
    return (
      <div className="border border-gold/30 bg-gold/5 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-gold" />
            <span className="text-xs font-mono font-semibold text-gold">Your stance</span>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </button>
        </div>
        <p className="text-sm text-white/90 leading-relaxed pl-6">
          &ldquo;{existing.condition}&rdquo;
        </p>
        <div className="pl-6">
          <span className={cn(
            'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            existing.current_vote === 'for'
              ? 'text-for-400 bg-for-500/10 border-for-500/30'
              : 'text-against-400 bg-against-500/10 border-against-500/30'
          )}>
            {VOTE_LABEL[existing.current_vote]}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-surface-300/80 bg-surface-200/60 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-gold" />
        <span className="text-xs font-mono font-semibold text-gold">
          {existing ? 'Edit your stance' : 'What would change your mind?'}
        </span>
      </div>

      {/* Vote toggle */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-surface-500 font-mono">I currently vote</p>
        <div className="flex gap-2">
          {(['for', 'against'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVote(v)}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-mono font-semibold border transition-all',
                vote === v
                  ? v === 'for'
                    ? 'bg-for-600/30 border-for-500/60 text-for-300'
                    : 'bg-against-600/30 border-against-500/60 text-against-300'
                  : 'bg-surface-300/60 border-surface-400/60 text-surface-400 hover:text-white'
              )}
            >
              {v === 'for' ? 'FOR' : 'AGAINST'}
            </button>
          ))}
        </div>
      </div>

      {/* Condition textarea */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-surface-500 font-mono">
          I would change my vote if...
        </p>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. &ldquo;someone showed peer-reviewed evidence that this policy reduced crime rates by more than 10%&rdquo;"
          className={cn(
            'w-full bg-surface-100/60 border rounded-lg px-3 py-2.5 text-sm text-white',
            'placeholder:text-surface-600 resize-none focus:outline-none transition-colors',
            error
              ? 'border-against-500/60 focus:border-against-400'
              : 'border-surface-400/60 focus:border-for-500/60'
          )}
        />
        <div className="flex items-center justify-between">
          <span className={cn('text-[11px] font-mono', charLeft < 50 ? 'text-against-400' : 'text-surface-600')}>
            {charLeft} chars left
          </span>
          {error && <span className="text-[11px] text-against-400">{error}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || text.trim().length < 20}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-semibold',
            'bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {existing ? 'Update' : 'Submit'}
        </button>
        {existing && (
          <button
            onClick={() => { setEditing(false); setText(existing.condition) }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-400/60 transition-all"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        )}
        {existing && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-mono text-against-400 border border-against-500/30 hover:bg-against-500/10 transition-all disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

type Tab = 'all' | 'for' | 'against'

export function ChangemakerClient({ topicId }: Props) {
  const params = useParams()
  const id = topicId || (params?.id as string)

  const [data, setData] = useState<ChangemakersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [upvotingId, setUpvotingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/changemakers`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: ChangemakersResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load changemaker statements.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleUpvote = useCallback(async (changemakerEntryId: string) => {
    if (upvotingId) return
    setUpvotingId(changemakerEntryId)
    try {
      const res = await fetch(`/api/topics/${id}/changemakers/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changemaker_id: changemakerEntryId }),
      })
      if (!res.ok) return
      const { upvoted }: { upvoted: boolean } = await res.json()
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          entries: prev.entries.map((e) =>
            e.id === changemakerEntryId
              ? { ...e, viewer_upvoted: upvoted, upvotes: e.upvotes + (upvoted ? 1 : -1) }
              : e
          ),
        }
      })
    } finally {
      setUpvotingId(null)
    }
  }, [id, upvotingId])

  const handleEdit = useCallback((_entry: ChangemakerEntry) => {
    setShowForm(true)
  }, [])

  const handleDelete = useCallback(async (_entry: ChangemakerEntry) => {
    await fetch(`/api/topics/${id}/changemakers`, { method: 'DELETE' })
    load()
  }, [id, load])

  const filteredEntries = data?.entries.filter((e) => {
    if (tab === 'for') return e.current_vote === 'for'
    if (tab === 'against') return e.current_vote === 'against'
    return true
  }) ?? []

  const topic = data?.topic
  const stats = data?.stats
  const viewerEntry = data?.viewer_entry ?? null

  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24 space-y-6">
        {/* Back + header */}
        <div className="space-y-3">
          <Link
            href={`/topic/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to topic
          </Link>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : topic ? (
            <div>
              <div className="flex items-start gap-2 mb-1">
                <Brain className="h-5 w-5 text-gold flex-shrink-0 mt-0.5" />
                <h1 className="text-lg font-bold text-white leading-snug">
                  What Would Change Your Mind?
                </h1>
              </div>
              <p className="text-sm text-surface-500 pl-7 leading-snug line-clamp-2">
                {topic.statement}
              </p>
            </div>
          ) : null}
        </div>

        {/* Vote bar */}
        {topic && (
          <div className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-for-400 font-semibold">{forPct}% FOR</span>
              <span className="text-surface-500">{(topic.total_votes ?? 0).toLocaleString()} votes</span>
              <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden flex">
              <div
                className="bg-for-500 rounded-l-full transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="bg-against-500 rounded-r-full transition-all"
                style={{ width: `${againstPct}%` }}
              />
            </div>

            {stats && (
              <div className="flex gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-for-500" />
                  <span className="text-[11px] font-mono text-surface-400">
                    <span className="text-for-400 font-semibold">{stats.for_count}</span> FOR voters shared
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-against-500" />
                  <span className="text-[11px] font-mono text-surface-400">
                    <span className="text-against-400 font-semibold">{stats.against_count}</span> AGAINST voters shared
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Your entry / submit form */}
        {!loading && (
          viewerEntry && !showForm ? (
            <div className="space-y-2">
              <SubmitForm
                topicId={id}
                existing={viewerEntry}
                onSaved={() => { setShowForm(false); load() }}
              />
            </div>
          ) : showForm || !viewerEntry ? (
            <SubmitForm
              topicId={id}
              existing={viewerEntry}
              onSaved={() => { setShowForm(false); load() }}
            />
          ) : null
        )}

        {/* Tab filter */}
        {!loading && (stats?.total ?? 0) > 0 && (
          <div className="flex gap-1 p-1 bg-surface-200/60 border border-surface-300/60 rounded-xl">
            {(['all', 'for', 'against'] as const).map((t) => {
              const count = t === 'all'
                ? (stats?.total ?? 0)
                : t === 'for'
                ? (stats?.for_count ?? 0)
                : (stats?.against_count ?? 0)
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                    tab === t
                      ? t === 'for'
                        ? 'bg-for-600/30 text-for-300'
                        : t === 'against'
                        ? 'bg-against-600/30 text-against-300'
                        : 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {t === 'all' ? 'All' : t === 'for' ? 'FOR voters' : 'AGAINST voters'}
                  <span className="ml-1 opacity-60">({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-surface-500">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-white bg-surface-200 border border-surface-300/60 hover:bg-surface-300/60 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No stances yet"
            description={
              tab === 'all'
                ? "Be the first to share what would change your mind on this topic."
                : `No ${tab === 'for' ? 'FOR' : 'AGAINST'} voters have shared their conditions yet.`
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <ChangemakerCard
                  key={entry.id}
                  entry={entry}
                  onUpvote={handleUpvote}
                  onEdit={() => handleEdit(entry)}
                  onDelete={() => handleDelete(entry)}
                  upvoting={upvotingId === entry.id}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Insight callout */}
        {!loading && (stats?.total ?? 0) >= 5 && (
          <div className="border border-purple/30 bg-purple/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple" />
              <span className="text-xs font-mono font-semibold text-purple">Persuasion Map</span>
            </div>
            <p className="text-xs text-surface-400 leading-relaxed">
              {stats!.for_count > 0 && (
                <>
                  <span className="text-for-400 font-semibold">{stats!.for_count}</span>
                  {' '}FOR voter{stats!.for_count !== 1 ? 's have' : ' has'} shared conditions under which they&apos;d switch.{' '}
                </>
              )}
              {stats!.against_count > 0 && (
                <>
                  <span className="text-against-400 font-semibold">{stats!.against_count}</span>
                  {' '}AGAINST voter{stats!.against_count !== 1 ? 's have' : ' has'} done the same.{' '}
                </>
              )}
              Read their conditions — the arguments that could win are written here.
            </p>
          </div>
        )}

        {/* Related links */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {[
            { href: `/topic/${id}/reasons`, label: 'Why they voted', desc: 'Vote reasons' },
            { href: `/topic/${id}/swing`, label: 'Mind changers', desc: 'Who switched sides' },
            { href: `/topic/${id}/steelman`, label: 'Best cases', desc: 'Steelman arguments' },
            { href: `/topic/${id}/synthesis`, label: 'Common ground', desc: 'AI synthesis' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 rounded-xl p-3 transition-colors"
            >
              <p className="text-xs font-semibold text-white">{l.label}</p>
              <p className="text-[11px] text-surface-500">{l.desc}</p>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
