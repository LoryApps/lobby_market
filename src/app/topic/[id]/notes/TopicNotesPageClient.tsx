'use client'

/**
 * /topic/[id]/notes — Dedicated notes workspace for a single topic.
 *
 * Shows all the user's private notes for this topic in a split-pane editor.
 * Linked from the TopicNotesButton "All notes" shortcut and from the
 * topic sidebar. Notes are stored in civic_notes (private, server-side).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Save,
  Trash2,
  Zap,
  Scale,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { CivicNote } from '@/app/api/notes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500', icon: FileText },
  active:   { label: 'Active',   color: 'text-for-400',     icon: Zap },
  voting:   { label: 'Voting',   color: 'text-purple',      icon: Scale },
  law:      { label: 'LAW',      color: 'text-gold',        icon: Gavel },
  failed:   { label: 'Failed',   color: 'text-against-400', icon: X },
}

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopicNotesPageClientProps {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  bluePct: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicNotesPageClient({
  topicId,
  topicStatement,
  topicCategory,
  topicStatus,
  bluePct,
}: TopicNotesPageClientProps) {
  const [notes, setNotes] = useState<CivicNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Editor state
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorPinned, setEditorPinned] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Load notes for this topic
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/notes?topic_id=${topicId}`)
        if (res.ok) {
          const data = await res.json()
          const fetched: CivicNote[] = data.notes ?? []
          setNotes(fetched)
          if (fetched.length > 0) {
            openNote(fetched[0])
          }
        }
      } catch {
        // best-effort
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId])

  function openNote(note: CivicNote) {
    setActiveId(note.id)
    setCreating(false)
    setEditorTitle(note.title)
    setEditorContent(note.content)
    setEditorPinned(note.pinned)
    setDirty(false)
    setError(null)
  }

  function startNew() {
    setActiveId(null)
    setCreating(true)
    setEditorTitle('')
    setEditorContent('')
    setEditorPinned(false)
    setDirty(false)
    setError(null)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  async function handleSave() {
    if (!editorTitle.trim() && !editorContent.trim()) {
      setError('Add a title or some content before saving.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (creating) {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editorTitle.trim(),
            content: editorContent.trim(),
            topic_id: topicId,
            pinned: editorPinned,
          }),
        })
        if (res.ok) {
          const json = await res.json() as { note: CivicNote }
          setNotes((prev) => [json.note, ...prev])
          setActiveId(json.note.id)
          setCreating(false)
          setDirty(false)
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        }
      } else if (activeId) {
        const res = await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeId,
            title: editorTitle.trim(),
            content: editorContent.trim(),
            pinned: editorPinned,
          }),
        })
        if (res.ok) {
          const json = await res.json() as { note: CivicNote }
          setNotes((prev) =>
            prev
              .map((n) => (n.id === activeId ? json.note : n))
              .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          )
          setDirty(false)
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        }
      }
    } catch {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!activeId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/notes?id=${activeId}`, { method: 'DELETE' })
      if (res.ok) {
        const remaining = notes.filter((n) => n.id !== activeId)
        setNotes(remaining)
        if (remaining.length > 0) {
          openNote(remaining[0])
        } else {
          setActiveId(null)
          setCreating(false)
          setEditorTitle('')
          setEditorContent('')
        }
      }
    } finally {
      setDeleting(false)
    }
  }

  async function togglePin() {
    const newPinned = !editorPinned
    setEditorPinned(newPinned)
    if (activeId && !creating) {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeId, pinned: newPinned }),
      })
      setNotes((prev) =>
        prev
          .map((n) => (n.id === activeId ? { ...n, pinned: newPinned } : n))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  const statusCfg = STATUS_CONFIG[topicStatus] ?? STATUS_CONFIG.proposed
  const StatusIcon = statusCfg.icon
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const hasEditor = creating || activeId !== null

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <div className="flex-1 overflow-hidden flex flex-col max-w-5xl mx-auto w-full px-4 py-6 gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href={`/topic/${topicId}`}
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <NotebookPen className="h-4 w-4 text-gold flex-shrink-0" />
              <span className="text-xs font-mono text-surface-500">My Notes</span>
              {topicCategory && (
                <span className={cn('text-xs font-mono', CAT_COLOR[topicCategory] ?? 'text-surface-500')}>
                  · {topicCategory}
                </span>
              )}
              <span className={cn('flex items-center gap-1 text-xs font-mono', statusCfg.color)}>
                · <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
            </div>
            <Link
              href={`/topic/${topicId}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors line-clamp-2"
            >
              {topicStatement}
            </Link>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">
              {forPct}% For · {againstPct}% Against
            </p>
          </div>
          <Link
            href="/notes"
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            All notes
          </Link>
        </div>

        {/* Split pane */}
        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
          {/* Left: note list */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={startNew}
              className="w-full flex items-center gap-2 justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              New note
            </Button>

            {loading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            )}

            {!loading && notes.length === 0 && !creating && (
              <p className="text-center text-xs text-surface-600 font-mono py-6 px-2">
                No notes yet. Hit &ldquo;New note&rdquo; to start.
              </p>
            )}

            {creating && (
              <div className={cn(
                'px-3 py-2.5 rounded-xl border text-xs font-mono font-semibold',
                'bg-gold/10 border-gold/40 text-gold',
              )}>
                New note…
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {notes.map((note) => (
                <motion.button
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  type="button"
                  onClick={() => openNote(note)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl border transition-colors',
                    activeId === note.id && !creating
                      ? 'bg-for-600/20 border-for-500/40 text-white'
                      : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60 text-surface-400',
                  )}
                >
                  {note.pinned && (
                    <Pin className="h-2.5 w-2.5 text-gold inline-block mr-1 mb-0.5" aria-label="Pinned" />
                  )}
                  <span className="text-xs font-semibold block truncate">
                    {note.title || 'Untitled note'}
                  </span>
                  {note.content && (
                    <span className="text-[10px] text-surface-600 block truncate mt-0.5">
                      {note.content.slice(0, 60)}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-surface-600 block mt-1">
                    {relTime(note.updated_at)}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Right: editor */}
          <div className="flex-1 min-w-0 flex flex-col" onKeyDown={handleKeyDown}>
            {!hasEditor ? (
              <EmptyState
                icon={NotebookPen}
                title="No note selected"
                description="Select a note from the list or create a new one."
              />
            ) : (
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                {/* Editor toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePin}
                    title={editorPinned ? 'Unpin note' : 'Pin note'}
                    className={cn(
                      'flex items-center gap-1 text-xs font-mono transition-colors',
                      editorPinned ? 'text-gold' : 'text-surface-500 hover:text-gold',
                    )}
                    aria-label={editorPinned ? 'Unpin note' : 'Pin note'}
                  >
                    {editorPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                    {editorPinned ? 'Pinned' : 'Pin'}
                  </button>
                  <div className="flex-1" />
                  {dirty && (
                    <span className="text-[10px] font-mono text-surface-600">Unsaved changes</span>
                  )}
                  {saved && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1 text-[10px] font-mono text-emerald"
                    >
                      <Check className="h-3 w-3" />
                      Saved
                    </motion.span>
                  )}
                  <span className="text-[10px] font-mono text-surface-600">⌘S</span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                      'bg-for-600 text-white hover:bg-for-500 disabled:opacity-50 transition-colors',
                    )}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {activeId && !creating && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-against-400 transition-colors disabled:opacity-50"
                      aria-label="Delete note"
                    >
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {/* Title */}
                <input
                  ref={titleRef}
                  type="text"
                  value={editorTitle}
                  onChange={(e) => { setEditorTitle(e.target.value); setDirty(true) }}
                  placeholder="Note title…"
                  maxLength={120}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border text-base font-semibold text-white placeholder:text-surface-600',
                    'bg-surface-200 border-surface-300 focus:border-for-500/60 focus:outline-none transition-colors',
                  )}
                  aria-label="Note title"
                />

                {/* Content */}
                <textarea
                  ref={textRef}
                  value={editorContent}
                  onChange={(e) => { setEditorContent(e.target.value); setDirty(true) }}
                  placeholder="Your research notes, key arguments, counterpoints, context…&#10;&#10;Markdown supported: **bold**, *italic*, `code`, [links](url)"
                  className={cn(
                    'flex-1 w-full px-4 py-3 rounded-xl border text-sm text-white placeholder:text-surface-600',
                    'bg-surface-200 border-surface-300 focus:border-for-500/60 focus:outline-none',
                    'resize-none transition-colors font-mono leading-relaxed min-h-[300px]',
                  )}
                  aria-label="Note content"
                />

                {error && (
                  <p className="text-xs text-against-400 font-mono">{error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
