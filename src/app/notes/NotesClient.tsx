'use client'

/**
 * /notes — Civic Notes
 *
 * A private note-taking workspace where users can annotate debates,
 * save their thinking, and build a personal civic knowledge base.
 *
 * Features:
 *   • Create/edit/delete markdown notes
 *   • Optionally link a note to a specific topic
 *   • Pin important notes to the top
 *   • Full-text search across all notes
 *   • Split-pane layout: note list + editor
 *   • Keyboard shortcuts (Mod+S to save, Mod+N to create)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { CivicNote } from '@/app/api/notes/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicSearch {
  id: string
  statement: string
  category: string | null
  status: string
}

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
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active: { label: 'Active', color: 'text-for-400' },
  voting: { label: 'Voting', color: 'text-purple' },
  law: { label: 'LAW', color: 'text-gold' },
  failed: { label: 'Failed', color: 'text-against-400' },
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-surface-400',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      result.push(<h3 key={i} className="text-base font-bold text-white mt-4 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      result.push(<h2 key={i} className="text-lg font-bold text-white mt-5 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      result.push(<h1 key={i} className="text-xl font-bold text-white mt-6 mb-2">{line.slice(2)}</h1>)
    } else if (line.startsWith('> ')) {
      result.push(
        <blockquote key={i} className="border-l-2 border-for-500/50 pl-3 my-2 text-surface-500 italic text-sm">
          {renderInline(line.slice(2))}
        </blockquote>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(
        <li key={i} className="flex gap-2 text-sm text-surface-700 my-0.5">
          <span className="text-surface-500 mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </li>
      )
    } else if (line.trim() === '') {
      result.push(<div key={i} className="h-3" />)
    } else {
      result.push(
        <p key={i} className="text-sm text-surface-700 leading-relaxed">{renderInline(line)}</p>
      )
    }
  }

  return result
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let s = text
  let idx = 0

  while (s.length > 0) {
    const bold = s.match(/^\*\*([^*]+)\*\*/)
    if (bold) {
      parts.push(<strong key={idx++} className="font-semibold text-white">{bold[1]}</strong>)
      s = s.slice(bold[0].length)
      continue
    }
    const italic = s.match(/^\*([^*]+)\*/)
    if (italic) {
      parts.push(<em key={idx++} className="italic">{italic[1]}</em>)
      s = s.slice(italic[0].length)
      continue
    }
    const code = s.match(/^`([^`]+)`/)
    if (code) {
      parts.push(<code key={idx++} className="px-1 py-0.5 rounded bg-surface-300 text-emerald font-mono text-xs">{code[1]}</code>)
      s = s.slice(code[0].length)
      continue
    }
    const link = s.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
    if (link) {
      parts.push(
        <a key={idx++} href={link[2]} target="_blank" rel="noopener noreferrer"
          className="text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors">
          {link[1]}
        </a>
      )
      s = s.slice(link[0].length)
      continue
    }
    const next = s.match(/^[^*`[]+/) ?? [s[0]]
    parts.push(<span key={idx++}>{next[0]}</span>)
    s = s.slice(next[0].length)
  }

  return <>{parts}</>
}

// ─── Topic picker ─────────────────────────────────────────────────────────────

function TopicPicker({
  value,
  onChange,
}: {
  value: TopicSearch | null
  onChange: (t: TopicSearch | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicSearch[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
        if (res.ok) {
          const json = await res.json()
          setResults(((json.results ?? []) as TopicSearch[]).slice(0, 6))
        }
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  if (value) {
    const cfg = STATUS_CONFIG[value.status] ?? { label: value.status, color: 'text-surface-500' }
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-200 border border-surface-300">
        <Tag className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
        <span className="text-xs text-surface-600 truncate flex-1 min-w-0">{value.statement}</span>
        <span className={cn('text-[10px] font-mono font-bold flex-shrink-0', cfg.color)}>{cfg.label}</span>
        <button
          onClick={() => onChange(null)}
          className="text-surface-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Remove topic link"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-200 border border-surface-300 focus-within:border-surface-400">
        <Tag className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
        <input
          type="text"
          placeholder="Link to a topic (optional)…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex-1 bg-transparent text-xs text-white placeholder-surface-500 outline-none min-w-0"
        />
        {loading && <Loader2 className="h-3 w-3 text-surface-500 animate-spin flex-shrink-0" />}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface-100 border border-surface-300 rounded-lg shadow-2xl overflow-hidden"
          >
            {results.map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, color: 'text-surface-500' }
              return (
                <button
                  key={t.id}
                  onMouseDown={() => { onChange(t); setQuery(''); setOpen(false) }}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-surface-200 transition-colors text-left"
                >
                  <FileText className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{t.statement}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.category && (
                        <span className={cn('text-[10px] font-mono', CAT_COLOR[t.category] ?? 'text-surface-500')}>
                          {t.category}
                        </span>
                      )}
                      <span className={cn('text-[10px] font-mono font-bold', cfg.color)}>{cfg.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Note list item ───────────────────────────────────────────────────────────

function NoteListItem({
  note,
  isActive,
  onClick,
}: {
  note: CivicNote
  isActive: boolean
  onClick: () => void
}) {
  const preview = note.content.replace(/[#*`>-]/g, '').trim().slice(0, 80)
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 rounded-lg transition-colors group',
        isActive
          ? 'bg-surface-200 border border-surface-300'
          : 'hover:bg-surface-200/60 border border-transparent'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {note.pinned && <Pin className="h-2.5 w-2.5 text-gold flex-shrink-0" />}
            <p className={cn('text-sm font-medium truncate', isActive ? 'text-white' : 'text-surface-700 group-hover:text-white')}>
              {note.title || 'Untitled'}
            </p>
          </div>
          {preview && (
            <p className="text-xs text-surface-500 line-clamp-2 leading-relaxed">{preview}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono text-surface-500">{relTime(note.updated_at)}</span>
            {note.topic && (
              <>
                <span className="text-surface-400">·</span>
                <span className="text-[10px] font-mono text-for-400 truncate max-w-[100px]">
                  {note.topic.statement.slice(0, 30)}{note.topic.statement.length > 30 ? '…' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotesClient() {
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [notes, setNotes] = useState<CivicNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchMode, setSearchMode] = useState(false)

  // Editor state
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorTopic, setEditorTopic] = useState<TopicSearch | null>(null)
  const [editorPinned, setEditorPinned] = useState(false)
  const [preview, setPreview] = useState(false)
  const [dirty, setDirty] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeNote = notes.find(n => n.id === activeId) ?? null

  // ── Auth check ────────────────────────────────────────────────────────────

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/sign-in?next=/notes')
      } else {
        setAuthed(true)
      }
    })
  }, [router])

  // ── Load notes ────────────────────────────────────────────────────────────

  const loadNotes = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : '/api/notes'
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json() as { notes: CivicNote[] }
        setNotes(json.notes)
        // Keep active note selected if still present
        if (activeId && !json.notes.find(n => n.id === activeId)) {
          setActiveId(json.notes[0]?.id ?? null)
        } else if (!activeId && json.notes.length > 0) {
          setActiveId(json.notes[0].id)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [activeId])

  useEffect(() => {
    if (authed) loadNotes()
  }, [authed, loadNotes])

  // ── Populate editor when active note changes ───────────────────────────────

  useEffect(() => {
    if (!activeNote) {
      if (!creating) {
        setEditorTitle('')
        setEditorContent('')
        setEditorTopic(null)
        setEditorPinned(false)
      }
      return
    }
    setCreating(false)
    setEditorTitle(activeNote.title)
    setEditorContent(activeNote.content)
    setEditorTopic(activeNote.topic as TopicSearch | null)
    setEditorPinned(activeNote.pinned)
    setDirty(false)
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authed) return
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      loadNotes(searchQ || undefined)
    }, 350)
  }, [searchQ, authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (mod && e.key === 'n') {
        e.preventDefault()
        startNew()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editorTitle, editorContent, editorTopic, editorPinned, activeId, creating]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Autosave (3 s after last change, only for existing notes) ─────────────

  useEffect(() => {
    if (!dirty || creating) return
    if (autosaveRef.current) clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(() => {
      if (activeId && !creating) handleSave(true)
    }, 3000)
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current)
    }
  }, [dirty, editorTitle, editorContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  function startNew() {
    setCreating(true)
    setActiveId(null)
    setEditorTitle('')
    setEditorContent('')
    setEditorTopic(null)
    setEditorPinned(false)
    setDirty(false)
    setPreview(false)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  async function handleSave(silent = false) {
    if (!editorTitle.trim() && !editorContent.trim()) return
    if (!silent) setSaving(true)
    try {
      if (creating) {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editorTitle,
            content: editorContent,
            topic_id: editorTopic?.id ?? null,
            pinned: editorPinned,
          }),
        })
        if (res.ok) {
          const json = await res.json() as { note: CivicNote }
          setNotes(prev => [json.note, ...prev])
          setActiveId(json.note.id)
          setCreating(false)
          setDirty(false)
          if (!silent) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
        }
      } else if (activeId) {
        const res = await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeId,
            title: editorTitle,
            content: editorContent,
            topic_id: editorTopic?.id ?? null,
            pinned: editorPinned,
          }),
        })
        if (res.ok) {
          const json = await res.json() as { note: CivicNote }
          setNotes(prev => prev.map(n => n.id === activeId ? json.note : n))
          setDirty(false)
          if (!silent) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
        }
      }
    } finally {
      if (!silent) setSaving(false)
    }
  }

  async function handleDelete() {
    if (!activeId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/notes?id=${activeId}`, { method: 'DELETE' })
      if (res.ok) {
        const remaining = notes.filter(n => n.id !== activeId)
        setNotes(remaining)
        setActiveId(remaining[0]?.id ?? null)
        setCreating(false)
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
      setNotes(prev => prev.map(n => n.id === activeId ? { ...n, pinned: newPinned } : n))
    }
  }

  const hasContent = editorTitle.trim() || editorContent.trim()
  const isEditing = creating || !!activeId

  // ── Render ────────────────────────────────────────────────────────────────

  if (authed === null) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  const displayedNotes = searchMode
    ? notes
    : notes

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-6 pb-28 md:pb-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-mono font-bold text-white">Civic Notes</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Private research notes — only you can see these
            </p>
          </div>
          <Button
            variant="for"
            size="sm"
            onClick={startNew}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Note</span>
          </Button>
        </div>

        {/* Split pane */}
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 items-start">

          {/* ── Left: Note list ──────────────────────────────────────────── */}
          <div className="md:sticky md:top-20">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
              <input
                type="text"
                placeholder="Search notes…"
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setSearchMode(true) }}
                onBlur={() => { if (!searchQ) setSearchMode(false) }}
                className="w-full bg-surface-200 border border-surface-300 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-surface-500 outline-none focus:border-surface-400 transition-colors"
              />
              {searchQ && (
                <button
                  onClick={() => { setSearchQ(''); setSearchMode(false) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Note list */}
            <div className="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : displayedNotes.length === 0 ? (
                <div className="py-8 text-center">
                  {searchQ ? (
                    <p className="text-sm font-mono text-surface-500">No notes match &ldquo;{searchQ}&rdquo;</p>
                  ) : (
                    <EmptyState
                      icon={FileText}
                      title="No notes yet"
                      description="Capture your civic thinking — private, searchable, always yours."
                      size="sm"
                      action={{ label: 'Write first note', onClick: startNew }}
                    />
                  )}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayedNotes.map(note => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <NoteListItem
                        note={note}
                        isActive={note.id === activeId && !creating}
                        onClick={() => {
                          if (dirty && !creating) {
                            // save current before switching
                            handleSave(true)
                          }
                          setCreating(false)
                          setActiveId(note.id)
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Stats footer */}
            {!loading && notes.length > 0 && (
              <p className="text-[10px] font-mono text-surface-500 mt-3 px-1">
                {notes.length} note{notes.length !== 1 ? 's' : ''} · {notes.filter(n => n.pinned).length} pinned
              </p>
            )}
          </div>

          {/* ── Right: Editor ─────────────────────────────────────────────── */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            {isEditing ? (
              <>
                {/* Editor toolbar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
                  {/* Preview toggle */}
                  <div className="flex items-center bg-surface-200 rounded-lg p-0.5">
                    <button
                      onClick={() => setPreview(false)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors',
                        !preview ? 'bg-surface-300 text-white' : 'text-surface-500 hover:text-white'
                      )}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPreview(true)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors',
                        preview ? 'bg-surface-300 text-white' : 'text-surface-500 hover:text-white'
                      )}
                    >
                      Preview
                    </button>
                  </div>

                  <div className="flex-1" />

                  {/* Dirty indicator */}
                  {dirty && !saving && (
                    <span className="text-[10px] font-mono text-surface-500">Unsaved</span>
                  )}

                  {/* Pin */}
                  <button
                    onClick={togglePin}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      editorPinned
                        ? 'text-gold bg-gold/10 border border-gold/20'
                        : 'text-surface-500 hover:text-white hover:bg-surface-200'
                    )}
                    title={editorPinned ? 'Unpin' : 'Pin to top'}
                  >
                    {editorPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                  </button>

                  {/* Delete */}
                  {!creating && activeId && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="p-1.5 rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-500/10 transition-colors"
                      title="Delete note"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  {/* Save button */}
                  <Button
                    variant="for"
                    size="sm"
                    onClick={() => handleSave()}
                    disabled={saving || !hasContent}
                    className="gap-1.5"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : saved ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                </div>

                {/* Topic link */}
                <div className="px-4 pt-3 pb-2">
                  <TopicPicker
                    value={editorTopic}
                    onChange={t => { setEditorTopic(t); setDirty(true) }}
                  />
                </div>

                {preview ? (
                  /* Preview pane */
                  <div className="px-6 py-4 min-h-[400px]">
                    <h1 className="text-xl font-mono font-bold text-white mb-4">
                      {editorTitle || <span className="text-surface-500 italic">Untitled</span>}
                    </h1>
                    {editorContent ? (
                      <div className="space-y-0.5">
                        {renderMarkdown(editorContent)}
                      </div>
                    ) : (
                      <p className="text-sm text-surface-500 italic">No content yet.</p>
                    )}
                  </div>
                ) : (
                  /* Edit pane */
                  <div className="px-4 pb-4">
                    <input
                      ref={titleRef}
                      type="text"
                      placeholder="Note title…"
                      value={editorTitle}
                      onChange={e => { setEditorTitle(e.target.value); setDirty(true) }}
                      className="w-full bg-transparent text-lg font-mono font-bold text-white placeholder-surface-400 outline-none py-3 border-b border-surface-300 focus:border-surface-400 transition-colors"
                    />
                    <textarea
                      ref={textareaRef}
                      placeholder="Write your civic notes here…&#10;&#10;Supports **bold**, *italic*, `code`, and [links](url).&#10;Use # for headings, > for quotes, - for lists."
                      value={editorContent}
                      onChange={e => { setEditorContent(e.target.value); setDirty(true) }}
                      className="w-full bg-transparent text-sm font-mono text-surface-700 placeholder-surface-500 outline-none resize-none py-3 leading-relaxed min-h-[360px]"
                    />
                  </div>
                )}

                {/* Linked topic footer */}
                {editorTopic && (
                  <div className="px-4 py-3 border-t border-surface-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3 w-3 text-surface-500" />
                      <span className="text-xs text-surface-500">Linked to debate</span>
                    </div>
                    <Link
                      href={`/topic/${editorTopic.id}`}
                      className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
                    >
                      View topic
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {/* Keyboard hint */}
                <div className="px-4 py-2 border-t border-surface-300 flex items-center gap-4">
                  <span className="text-[10px] font-mono text-surface-500">
                    <kbd className="px-1 py-0.5 bg-surface-200 rounded text-[9px]">⌘S</kbd> save
                  </span>
                  <span className="text-[10px] font-mono text-surface-500">
                    <kbd className="px-1 py-0.5 bg-surface-200 rounded text-[9px]">⌘N</kbd> new note
                  </span>
                  <span className="text-[10px] font-mono text-surface-500">Autosaves after 3s</span>
                </div>
              </>
            ) : (
              /* Empty editor state */
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-surface-500" />
                </div>
                <p className="text-base font-mono font-bold text-white mb-2">
                  {notes.length === 0 ? 'Start your civic knowledge base' : 'Select a note'}
                </p>
                <p className="text-sm font-mono text-surface-500 mb-6 max-w-xs leading-relaxed">
                  {notes.length === 0
                    ? 'Annotate debates, save key arguments, and track your civic thinking — all private, all yours.'
                    : 'Pick a note from the list to read or edit it.'}
                </p>
                <Button variant="for" size="sm" onClick={startNew} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Write your first note
                </Button>
              </div>
            )}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
