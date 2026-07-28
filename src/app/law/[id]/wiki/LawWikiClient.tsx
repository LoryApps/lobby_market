'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bold,
  BookOpen,
  Check,
  ChevronRight,
  Code,
  Columns2,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  History,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Network,
  Pencil,
  Quote,
  Save,
  Scale,
  Share2,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopicWikiRenderer } from '@/components/topic/TopicWikiRenderer'
import { WikilinkAutocomplete, type WikilinkSuggestion } from '@/components/topic/WikilinkAutocomplete'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { WikiLaw, WikiHistoryEntry } from '@/app/api/laws/[id]/wiki/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WikiContributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  edits: number
}

interface LawWikiClientProps {
  lawId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function estDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Format toolbar ───────────────────────────────────────────────────────────

const TOOLBAR_ACTIONS = [
  { icon: Bold,        title: 'Bold',          wrap: ['**', '**'],    placeholder: 'bold text' },
  { icon: Italic,      title: 'Italic',        wrap: ['*', '*'],      placeholder: 'italic text' },
  { icon: Code,        title: 'Inline code',   wrap: ['`', '`'],      placeholder: 'code' },
  { icon: Quote,       title: 'Blockquote',    prefix: '> ',          placeholder: null },
  { icon: List,        title: 'Bullet list',   prefix: '- ',          placeholder: null },
  { icon: ListOrdered, title: 'Numbered list', prefix: '1. ',         placeholder: null },
  { icon: Link2,       title: 'Link',          wrap: ['[', '](url)'], placeholder: 'link text' },
]

function insertFormatting(
  textarea: HTMLTextAreaElement,
  action: typeof TOOLBAR_ACTIONS[number],
  setValue: (v: string) => void,
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end)

  let newValue: string
  let newCursor: number

  if (action.prefix) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEnd = value.indexOf('\n', lineStart) === -1 ? undefined : value.indexOf('\n', lineStart)
    const line = value.slice(lineStart, lineEnd)
    const after = value.slice(lineStart + line.length)
    newValue = value.slice(0, lineStart) + action.prefix + line + after
    newCursor = start + action.prefix.length
  } else if (action.wrap) {
    const [wl, wr] = action.wrap
    const text = selected || action.placeholder || ''
    newValue = value.slice(0, start) + wl + text + wr + value.slice(end)
    newCursor = start + wl.length + text.length
  } else {
    newValue = value
    newCursor = start
  }

  setValue(newValue)
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(newCursor, newCursor)
  }, 0)
}

// ─── Wikilink helpers ─────────────────────────────────────────────────────────

function getWikilinkContext(text: string, cursorPos: number): { query: string; startPos: number } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/\[\[([^\][]*)$/)
  if (!match) return null
  return { query: match[1], startPos: before.length - match[0].length }
}

// ─── Component ────────────────────────────────────────────────────────────────

type ViewMode = 'read' | 'edit' | 'split'

export function LawWikiClient({ lawId }: LawWikiClientProps) {
  const [law, setLaw] = useState<WikiLaw | null>(null)
  const [contributors, setContributors] = useState<WikiContributor[]>([])
  const [totalEdits, setTotalEdits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Edit state
  const [viewMode, setViewMode] = useState<ViewMode>('read')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null)

  // Wikilink autocomplete
  const [wikilinkCtx, setWikilinkCtx] = useState<{ query: string; startPos: number } | null>(null)
  const [wikilinkIndex, setWikilinkIndex] = useState(0)
  const [wikilinkResults, setWikilinkResults] = useState<WikilinkSuggestion[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Share feedback
  const [copied, setCopied] = useState(false)

  // Load law + history
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/wiki`)
      if (!res.ok) throw new Error('Law not found')
      const data = await res.json() as { law: WikiLaw; history: WikiHistoryEntry[]; total_edits: number }
      setLaw(data.law)
      setEditContent(data.law.wiki_content ?? '')
      setTotalEdits(data.total_edits)

      // Aggregate contributors
      const map = new Map<string, WikiContributor>()
      for (const entry of data.history) {
        if (!entry.editor) continue
        const ed = entry.editor
        const cur = map.get(ed.id)
        if (cur) { cur.edits++ } else { map.set(ed.id, { ...ed, edits: 1 }) }
      }
      setContributors(Array.from(map.values()).sort((a, b) => b.edits - a.edits).slice(0, 8))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  // Load current user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user ? { id: user.id } : null))
  }, [])

  useEffect(() => { load() }, [load])

  // Textarea handlers
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setEditContent(val)
    setSaved(false)
    const ctx = getWikilinkContext(val, e.target.selectionStart)
    setWikilinkCtx(ctx)
    setWikilinkIndex(0)
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (wikilinkCtx) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setWikilinkIndex(i => Math.min(i + 1, wikilinkResults.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setWikilinkIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); if (wikilinkResults[wikilinkIndex]) insertWikilink(wikilinkResults[wikilinkIndex]); return }
      if (e.key === 'Escape')    { setWikilinkCtx(null); return }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void handleSave() }
  }

  function insertWikilink(suggestion: WikilinkSuggestion) {
    if (!wikilinkCtx || !textareaRef.current) { setWikilinkCtx(null); return }
    const before = editContent.slice(0, wikilinkCtx.startPos)
    const after = editContent.slice(textareaRef.current.selectionStart)
    const link = `[[${suggestion.statement}]]`
    const newVal = before + link + after
    setEditContent(newVal)
    setWikilinkCtx(null)
    setTimeout(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      const pos = before.length + link.length
      textareaRef.current.setSelectionRange(pos, pos)
    }, 0)
  }

  async function handleSave() {
    if (!law) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/wiki`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wiki_content: editContent }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? 'Save failed')
      }
      const { law: updated } = await res.json() as { law: WikiLaw }
      setLaw(updated)
      setSaved(true)
      setViewMode('read')
      setTimeout(load, 500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function startEditing() {
    setEditContent(law?.wiki_content ?? '')
    setViewMode('edit')
    setSaved(false)
    setSaveError(null)
  }

  function cancelEditing() {
    setViewMode('read')
    setEditContent(law?.wiki_content ?? '')
    setSaveError(null)
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <div className="space-y-6">
            <Skeleton className="h-4 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24 rounded-lg" />
              <Skeleton className="h-8 w-4/5" />
            </div>
            <div className="h-px bg-surface-300" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
              ))}
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (loadError || !law) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <EmptyState
            icon={BookOpen}
            title="Law not found"
            description={loadError ?? 'This law does not exist or has been removed.'}
            action={{ label: 'Browse laws', href: '/laws' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const isEditing = viewMode === 'edit' || viewMode === 'split'
  const hasContent = (law.wiki_content ?? '').trim().length > 0
  const wordCount = (law.wiki_content ?? '').trim().split(/\s+/).filter(Boolean).length
  const forPct = Math.round(law.blue_pct ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-mono text-surface-500 mb-5">
          <Link href="/laws" className="hover:text-surface-700 transition-colors">Laws</Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <Link href={`/law/${law.id}`} className="hover:text-surface-700 transition-colors truncate max-w-[200px]">
            {law.statement.slice(0, 40)}{law.statement.length > 40 ? '…' : ''}
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <span className="text-white">Wiki</span>
        </nav>

        {/* Law header */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <Link
              href={`/law/${law.id}`}
              className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="Back to law"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border text-gold bg-gold/10 border-gold/30">
                  <Gavel className="h-3 w-3" aria-hidden="true" />
                  ESTABLISHED LAW
                </span>
                {law.category && (
                  <span className="text-[11px] font-mono text-surface-500 border border-surface-400/30 rounded-md px-2 py-0.5">
                    {law.category}
                  </span>
                )}
                <span className="text-[11px] font-mono text-surface-600">
                  Passed {estDate(law.established_at)}
                </span>
                <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                  <Network className="h-3 w-3" aria-hidden="true" />
                  <span>Wiki</span>
                </div>
              </div>

              <h1 className="text-xl md:text-2xl font-mono font-bold text-white leading-snug">
                {law.statement}
              </h1>
            </div>
          </div>

          {/* Consensus bar */}
          <div className="flex items-center gap-3 ml-12">
            <div
              className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden"
              role="meter"
              aria-valuenow={forPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${forPct}% consensus`}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold" style={{ width: `${forPct}%` }} />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
              <span className="text-gold">{forPct}% consensus</span>
              {law.total_votes && (
                <>
                  <span className="text-surface-600">·</span>
                  <span className="text-surface-500">{law.total_votes.toLocaleString()} votes</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Wiki toolbar */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <span className="text-xs font-mono text-surface-500 flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  {hasContent ? `${wordCount.toLocaleString()} words` : 'No content yet'}
                </span>
                {law.wiki_updated_at && (
                  <span className="text-xs font-mono text-surface-600">
                    · Edited {relTime(law.wiki_updated_at)}
                  </span>
                )}
              </>
            )}
            {isEditing && (
              <div className="flex items-center gap-1 rounded-lg bg-surface-200 border border-surface-300 p-0.5">
                {(['edit', 'split'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono transition-colors',
                      viewMode === mode
                        ? 'bg-surface-300 text-white'
                        : 'text-surface-500 hover:text-surface-700',
                    )}
                  >
                    {mode === 'edit'
                      ? <><Pencil className="h-3 w-3" aria-hidden="true" /> Edit</>
                      : <><Columns2 className="h-3 w-3" aria-hidden="true" /> Split</>
                    }
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!isEditing && (
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy wiki link"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}

            {!isEditing && totalEdits > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 text-xs font-mono">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                {totalEdits} {totalEdits === 1 ? 'edit' : 'edits'}
              </span>
            )}

            {!isEditing && currentUser && (
              <button
                type="button"
                onClick={startEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/40 text-gold text-xs font-mono font-semibold transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Edit wiki
              </button>
            )}
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors text-xs font-mono disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/40 text-gold text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                >
                  {saving
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Saving…</>
                    : <><Save className="h-3.5 w-3.5" aria-hidden="true" />Save</>
                  }
                </button>
              </>
            )}
          </div>
        </div>

        {/* Format toolbar (edit mode only) */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 mb-3 p-2 rounded-xl bg-surface-100 border border-surface-300 flex-wrap"
              role="toolbar"
              aria-label="Formatting toolbar"
            >
              {TOOLBAR_ACTIONS.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  title={action.title}
                  aria-label={action.title}
                  onClick={() => {
                    if (textareaRef.current) insertFormatting(textareaRef.current, action, setEditContent)
                  }}
                  className="flex items-center justify-center h-7 w-7 rounded-md text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
                >
                  <action.icon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
              <div className="h-5 w-px bg-surface-300 mx-1" role="separator" />
              <span className="text-[10px] font-mono text-surface-600 px-1">
                {editContent.length}/5000
              </span>
              <span className="text-[10px] font-mono text-surface-600 ml-1 hidden sm:inline">
                · <kbd className="font-mono">⌘S</kbd> to save · <kbd className="font-mono">[[</kbd> to link topics
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save error */}
        <AnimatePresence>
          {saveError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/30 text-against-400 text-xs font-mono"
              role="alert"
            >
              {saveError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className={cn(
          'rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden',
          isEditing && viewMode === 'split' && 'grid grid-cols-2',
        )}>
          {/* Editor pane */}
          {isEditing && (
            <div className={cn('relative', viewMode === 'split' && 'border-r border-surface-300')}>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder={`Write the law wiki here…

Use **bold**, *italic*, \`code\`, > blockquotes, and [[Topic Name]] to link to related debates.

Ideas: historical context, policy rationale, real-world impact, implementation notes, related laws.`}
                maxLength={5000}
                rows={28}
                spellCheck
                aria-label="Law wiki editor"
                className={cn(
                  'w-full h-full min-h-[400px] resize-y bg-transparent',
                  'px-5 py-4 text-sm font-mono text-white leading-relaxed',
                  'placeholder:text-surface-500 focus:outline-none',
                )}
              />
              {wikilinkCtx && (
                <div className="absolute left-4 top-auto z-50 w-80">
                  <WikilinkAutocomplete
                    query={wikilinkCtx.query}
                    selectedIndex={wikilinkIndex}
                    onSelect={insertWikilink}
                    onClose={() => setWikilinkCtx(null)}
                    onResultsChange={(n) => setWikilinkIndex(i => Math.min(i, Math.max(n - 1, 0)))}
                    onResultsReady={setWikilinkResults}
                  />
                </div>
              )}
            </div>
          )}

          {/* Read / preview pane */}
          {(viewMode === 'read' || viewMode === 'split') && (
            <div className="p-5 md:p-7">
              {hasContent ? (
                <TopicWikiRenderer
                  description={viewMode === 'split' ? editContent : (law.wiki_content ?? '')}
                  className="min-h-[200px]"
                />
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No wiki content yet"
                  description="Be the first to add context, history, and impact notes to this established law."
                  action={currentUser
                    ? { label: 'Write the first entry', onClick: startEditing, variant: 'primary' }
                    : { label: 'Sign in to contribute', href: '/login', variant: 'primary' }
                  }
                  size="md"
                />
              )}
            </div>
          )}
        </div>

        {/* Saved confirmation */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 text-emerald text-xs font-mono"
              role="status"
              aria-live="polite"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Saved successfully
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer metadata */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Contributors */}
          <div className="sm:col-span-2 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Contributors
            </h2>
            {contributors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contributors.map((c) => (
                  <Link
                    key={c.id}
                    href={`/profile/${c.username}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
                    title={`${c.display_name ?? c.username} — ${c.edits} edit${c.edits !== 1 ? 's' : ''}`}
                  >
                    <Avatar src={c.avatar_url} fallback={c.display_name ?? c.username} size="xs" />
                    <span className="text-xs font-mono text-surface-400 hover:text-white transition-colors">
                      @{c.username}
                    </span>
                    <span className="text-[10px] font-mono text-surface-600 bg-surface-300 rounded-full px-1.5 py-0.5">
                      {c.edits}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-surface-500">
                No edits yet — start the wiki by adding context above.
              </p>
            )}
          </div>

          {/* Quick links */}
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Related
            </h2>
            <nav className="space-y-1" aria-label="Related pages">
              <Link
                href={`/law/${law.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
              >
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                Law details
              </Link>
              <Link
                href={`/law/${law.id}/impact`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
              >
                <Scale className="h-3 w-3" aria-hidden="true" />
                Impact analysis
              </Link>
              <Link
                href={`/law/${law.id}/amendments`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                Amendments
              </Link>
              <Link
                href={`/law/${law.id}/community`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
              >
                <Users className="h-3 w-3" aria-hidden="true" />
                Community
              </Link>
              <Link
                href="/wiki"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
              >
                <Network className="h-3 w-3" aria-hidden="true" />
                Wiki portal
              </Link>
            </nav>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
