'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  BarChart2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Flame,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { BlueprintNote, BlueprintNotesResponse, NoteAspect } from '@/app/api/laws/[id]/blueprint/notes/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_CONFIG: Record<
  NoteAspect,
  { label: string; icon: typeof FileText; color: string; bg: string; border: string }
> = {
  phase:       { label: 'Phase',       icon: Zap,          color: 'text-for-300',      bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  stakeholder: { label: 'Stakeholder', icon: Users,         color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30' },
  challenge:   { label: 'Challenge',   icon: AlertCircle,   color: 'text-against-300',  bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  metric:      { label: 'Metric',      icon: BarChart2,     color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  resource:    { label: 'Resource',    icon: Flame,         color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  general:     { label: 'General',     icon: MessageSquare, color: 'text-surface-400',  bg: 'bg-surface-300/50',   border: 'border-surface-400/30' },
}

const MAX_NOTE_CHARS = 500
const ASPECTS: NoteAspect[] = ['general', 'phase', 'stakeholder', 'challenge', 'metric', 'resource']

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  currentUserId,
  onUpvote,
}: {
  note: BlueprintNote
  currentUserId: string | null
  onUpvote: (noteId: string) => void
}) {
  const cfg = ASPECT_CONFIG[note.aspect]
  const Icon = cfg.icon
  const isOwn = note.user_id === currentUserId

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex gap-3 p-3 rounded-xl bg-surface-100/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      {/* Aspect pill */}
      <div className={cn('flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg border', cfg.bg, cfg.border)}>
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-surface-600 text-[10px]">·</span>
          {note.author ? (
            <Link
              href={`/profile/${note.author.username}`}
              className="text-[11px] font-mono text-surface-400 hover:text-white transition-colors truncate"
            >
              @{note.author.username}
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-surface-600">anon</span>
          )}
          <span className="text-surface-600 text-[10px]">·</span>
          <Clock className="h-2.5 w-2.5 text-surface-600 flex-shrink-0" />
          <span className="text-[10px] text-surface-600">{relativeTime(note.created_at)}</span>
        </div>

        {/* Content */}
        <p className="text-xs font-mono text-surface-200 leading-relaxed">{note.content}</p>

        {/* Upvote */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => !isOwn && onUpvote(note.id)}
            disabled={isOwn}
            aria-label={note.has_upvoted ? 'Remove upvote' : 'Upvote this note'}
            className={cn(
              'flex items-center gap-1 text-[11px] font-mono transition-colors',
              isOwn
                ? 'text-surface-600 cursor-not-allowed'
                : note.has_upvoted
                  ? 'text-for-400 hover:text-for-300'
                  : 'text-surface-500 hover:text-for-400',
            )}
          >
            <ThumbsUp className={cn('h-3 w-3', note.has_upvoted && 'fill-current')} />
            <span>{note.upvotes}</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BlueprintNotesProps {
  lawId: string
}

export function BlueprintNotes({ lawId }: BlueprintNotesProps) {
  const [notes, setNotes] = useState<BlueprintNote[]>([])
  const [total, setTotal] = useState(0)
  const [userNoteCount, setUserNoteCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [aspect, setAspect] = useState<NoteAspect>('general')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/blueprint/notes`)
      if (!res.ok) throw new Error('Failed to load notes')
      const data = (await res.json()) as BlueprintNotesResponse
      setNotes(data.notes)
      setTotal(data.total)
      setUserNoteCount(data.user_note_count)
    } catch {
      setError('Could not load community notes')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  // Fetch current user id
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id ?? null)
      })
    })
  }, [])

  useEffect(() => { load() }, [load])

  function openCompose() {
    setComposing(true)
    setExpanded(true)
    setTimeout(() => textareaRef.current?.focus(), 80)
  }

  async function submit() {
    const content = draft.trim()
    if (content.length < 10 || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/blueprint/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, aspect }),
      })
      const data = await res.json() as { note?: BlueprintNote; error?: string }
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to post note')
        return
      }
      if (data.note) {
        setNotes(prev => [data.note!, ...prev])
        setTotal(t => t + 1)
        setUserNoteCount(c => c + 1)
        setDraft('')
        setAspect('general')
        setComposing(false)
      }
    } catch {
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpvote(noteId: string) {
    if (!currentUserId) return
    const res = await fetch(`/api/laws/${lawId}/blueprint/notes/${noteId}/upvote`, { method: 'POST' })
    if (!res.ok) return
    const { upvotes, has_upvoted } = (await res.json()) as { upvotes: number; has_upvoted: boolean }
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, upvotes, has_upvoted } : n))
  }

  const canAdd = currentUserId !== null && userNoteCount < 3
  const charsLeft = MAX_NOTE_CHARS - draft.length

  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-100/60 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-for-500/10 border border-for-500/30">
            <MessageSquare className="h-3.5 w-3.5 text-for-400" />
          </div>
          <span className="text-sm font-mono font-semibold text-white">
            Community Notes
          </span>
          {total > 0 && (
            <span className="text-[11px] font-mono text-surface-500 bg-surface-300/50 px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canAdd && !composing && (
            <button
              onClick={(e) => { e.stopPropagation(); openCompose() }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-for-600/80 border border-for-500/60 text-[11px] font-mono font-semibold text-white hover:bg-for-500 transition-colors"
              aria-label="Add a note"
            >
              <Plus className="h-3 w-3" />
              Add note
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-surface-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-500" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Compose form */}
              <AnimatePresence>
                {composing && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl bg-surface-200/60 border border-surface-400/60 p-3 space-y-2"
                  >
                    {/* Aspect selector */}
                    <div className="flex flex-wrap gap-1.5">
                      {ASPECTS.map((a) => {
                        const cfg = ASPECT_CONFIG[a]
                        const Icon = cfg.icon
                        return (
                          <button
                            key={a}
                            onClick={() => setAspect(a)}
                            className={cn(
                              'flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wide border transition-all',
                              aspect === a
                                ? cn(cfg.bg, cfg.border, cfg.color)
                                : 'bg-surface-300/40 border-surface-400/30 text-surface-500 hover:border-surface-400',
                            )}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Textarea */}
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Add your implementation insight — a specific concern, resource gap, or stakeholder angle (10–500 chars)"
                      maxLength={MAX_NOTE_CHARS}
                      rows={3}
                      className="w-full bg-surface-100/60 border border-surface-400/40 rounded-lg px-3 py-2 text-xs font-mono text-surface-200 placeholder-surface-600 focus:outline-none focus:border-for-500/60 resize-none"
                    />

                    {submitError && (
                      <p className="text-[11px] text-against-400 font-mono">{submitError}</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'text-[10px] font-mono',
                        charsLeft < 50 ? 'text-against-400' : 'text-surface-600',
                      )}>
                        {charsLeft} left
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setComposing(false); setDraft(''); setSubmitError(null) }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-300/50 border border-surface-400/40 text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                        <button
                          onClick={submit}
                          disabled={draft.trim().length < 10 || submitting}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-for-600/80 border border-for-500/60 text-[11px] font-mono font-semibold text-white hover:bg-for-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {submitting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Post
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notes list */}
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-surface-200/60 animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-xs font-mono text-surface-500">{error}</span>
                  <button onClick={load} className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300">
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              ) : notes.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs font-mono text-surface-500">No notes yet.</p>
                  {canAdd && !composing && (
                    <button
                      onClick={openCompose}
                      className="mt-2 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      Be the first to add an insight
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      currentUserId={currentUserId}
                      onUpvote={handleUpvote}
                    />
                  ))}
                </div>
              )}

              {/* Sign in prompt for guests */}
              {!currentUserId && !loading && (
                <p className="text-center text-[11px] font-mono text-surface-500 pt-1">
                  <Link href="/login" className="text-for-400 hover:text-for-300 transition-colors">
                    Sign in
                  </Link>{' '}
                  to add implementation notes
                </p>
              )}

              {/* Limit info */}
              {currentUserId && userNoteCount >= 3 && (
                <p className="text-center text-[11px] font-mono text-surface-600">
                  You&apos;ve added {userNoteCount}/3 notes on this blueprint
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
