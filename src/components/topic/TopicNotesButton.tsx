'use client'

/**
 * TopicNotesButton
 *
 * A compact action-bar button that opens a bottom sheet where users can
 * take, view, edit, and delete private notes tied to the current topic.
 *
 * Uses the existing civic_notes table + /api/notes endpoint.
 * Acts as a quick-access shortcut to the full /notes workspace.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  Loader2,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CivicNote } from '@/app/api/notes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  return `${d}d`
}

// ─── Note card ────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: CivicNote
  onEdit: (note: CivicNote) => void
  onDelete: (id: string) => void
  onPin: (note: CivicNote) => void
}

function NoteCard({ note, onEdit, onDelete, onPin }: NoteCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [pinning, setPinning] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    try {
      await fetch(`/api/notes?id=${note.id}`, { method: 'DELETE' })
      onDelete(note.id)
    } catch {
      setDeleting(false)
    }
  }

  async function handlePin(e: React.MouseEvent) {
    e.stopPropagation()
    if (pinning) return
    setPinning(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
      })
      if (res.ok) onPin({ ...note, pinned: !note.pinned })
    } catch {
      // best-effort
    } finally {
      setPinning(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'group relative p-3 rounded-xl border cursor-pointer transition-colors',
        note.pinned
          ? 'bg-gold/5 border-gold/30 hover:border-gold/50'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60',
      )}
      onClick={() => onEdit(note)}
    >
      {note.pinned && (
        <span className="absolute top-2 right-2 text-gold/60">
          <Pin className="h-3 w-3" aria-label="Pinned" />
        </span>
      )}
      {note.title && (
        <p className="text-xs font-semibold text-white mb-1 pr-4 leading-snug line-clamp-1">
          {note.title}
        </p>
      )}
      {note.content && (
        <p className="text-[11px] text-surface-500 leading-snug line-clamp-2">
          {note.content}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] font-mono text-surface-600">{relTime(note.updated_at)}</span>
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handlePin}
            disabled={pinning}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            className="p-1 rounded text-surface-500 hover:text-gold transition-colors disabled:opacity-40"
          >
            {pinning
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : note.pinned
                ? <PinOff className="h-3 w-3" />
                : <Pin className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete note"
            className="p-1 rounded text-surface-500 hover:text-against-400 transition-colors disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Note editor ──────────────────────────────────────────────────────────────

interface NoteEditorProps {
  note: Partial<CivicNote>
  topicId: string
  onSave: (note: CivicNote) => void
  onCancel: () => void
}

function NoteEditor({ note, topicId, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSave() {
    if (saving) return
    if (!title.trim() && !content.trim()) {
      setError('Add a title or some content before saving.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const isNew = !note.id
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch('/api/notes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isNew ? {} : { id: note.id }),
          title: title.trim(),
          content: content.trim(),
          topic_id: topicId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save note')
      }
      const data = await res.json()
      const saved: CivicNote = data.note ?? data
      onSave(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title (optional)"
        maxLength={120}
        className={cn(
          'w-full px-3 py-2 rounded-xl text-sm font-semibold text-white placeholder:text-surface-600',
          'bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none transition-colors',
        )}
        aria-label="Note title"
      />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Your thoughts, research, key points…"
        rows={6}
        className={cn(
          'w-full px-3 py-2 rounded-xl text-sm text-white placeholder:text-surface-600',
          'bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none',
          'resize-none transition-colors font-mono leading-relaxed',
        )}
        aria-label="Note content"
      />
      {error && (
        <p className="text-xs text-against-400 font-mono">{error}</p>
      )}
      <p className="text-[10px] text-surface-600 font-mono">⌘S to save · Esc to cancel</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold',
            'bg-for-600 text-white hover:bg-for-500 disabled:opacity-50 transition-colors',
          )}
          aria-label="Save note"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save note'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold text-surface-500 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TopicNotesButtonProps {
  topicId: string
  className?: string
}

export function TopicNotesButton({ topicId, className }: TopicNotesButtonProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<CivicNote[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [editingNote, setEditingNote] = useState<Partial<CivicNote> | null>(null)
  const [saved, setSaved] = useState(false)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes?topic_id=${topicId}`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes ?? [])
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [topicId])

  function handleOpen() {
    setOpen(true)
    if (!loaded) fetchNotes()
  }

  function handleClose() {
    setOpen(false)
    setEditingNote(null)
  }

  function handleSaved(note: CivicNote) {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = note
        return updated
      }
      return [note, ...prev]
    })
    setEditingNote(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  function handlePin(updated: CivicNote) {
    setNotes((prev) =>
      prev
        .map((n) => (n.id === updated.id ? updated : n))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    )
  }

  const count = notes.length

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="My notes on this topic"
        aria-label={`Notes on this topic${count > 0 ? ` (${count})` : ''}`}
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-lg',
          'bg-surface-200 border border-surface-300 text-surface-500',
          'hover:bg-surface-300 hover:text-gold transition-colors',
          open && 'text-gold border-gold/40 bg-gold/10',
          className,
        )}
      >
        <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[8px] font-mono font-bold text-surface-50 tabular-nums">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <BottomSheet open={open} onClose={handleClose} title="My Notes">
        <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-surface-500">
              {count === 0 ? 'No notes yet' : `${count} note${count !== 1 ? 's' : ''} on this topic`}
            </span>
            <div className="flex items-center gap-2">
              {saved && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-[10px] font-mono text-emerald"
                >
                  <Check className="h-3 w-3" />
                  Saved
                </motion.span>
              )}
              <Link
                href={`/topic/${topicId}/notes`}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                onClick={handleClose}
              >
                <ArrowUpRight className="h-3 w-3" />
                Full view
              </Link>
            </div>
          </div>

          {/* Editor / New note form */}
          <AnimatePresence mode="wait">
            {editingNote !== null ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <NoteEditor
                  note={editingNote}
                  topicId={topicId}
                  onSave={handleSaved}
                  onCancel={() => setEditingNote(null)}
                />
              </motion.div>
            ) : (
              <motion.button
                key="new-btn"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingNote({})}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-mono font-semibold',
                  'bg-surface-200/40 border-dashed border-surface-400/50 text-surface-500',
                  'hover:border-gold/50 hover:text-gold transition-colors',
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                New note on this topic
              </motion.button>
            )}
          </AnimatePresence>

          {/* Notes list */}
          {loading && !loaded && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          )}

          {loaded && notes.length === 0 && editingNote === null && (
            <p className="text-center text-xs text-surface-600 font-mono py-4">
              Take notes while you research this topic. They&apos;re private — only visible to you.
            </p>
          )}

          {loaded && notes.length > 0 && (
            <AnimatePresence mode="popLayout">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={(n) => setEditingNote(n)}
                  onDelete={handleDelete}
                  onPin={handlePin}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </BottomSheet>
    </>
  )
}
