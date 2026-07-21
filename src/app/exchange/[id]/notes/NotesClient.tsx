'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Eye,
  FileText,
  Gavel,
  Italic,
  Link2,
  NotebookPen,
  Plus,
  RotateCcw,
  Save,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { tokenize, renderTokens } from '@/components/ui/BioMarkdownEditor'
import { cn } from '@/lib/utils/cn'

// ─── Storage ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'lm_market_notes_v1_'
const MAX_HISTORY = 10

interface NoteSnapshot {
  content: string
  savedAt: string
  label: string
}

interface NoteStore {
  draft: string
  history: NoteSnapshot[]
  tags: string[]
}

function storageKey(id: string) {
  return `${STORAGE_KEY_PREFIX}${id}`
}

function loadStore(id: string): NoteStore {
  if (typeof window === 'undefined') return { draft: '', history: [], tags: [] }
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return { draft: '', history: [], tags: [] }
    return JSON.parse(raw) as NoteStore
  } catch {
    return { draft: '', history: [], tags: [] }
  }
}

function saveStore(id: string, store: NoteStore) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(store))
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  const dt = new Date(iso)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDate(iso: string): string {
  const dt = new Date(iso)
  return dt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function priceBar(status: string): { left: string; right: string } {
  if (status === 'law') return { left: 'bg-gold', right: 'bg-surface-300' }
  if (status === 'failed') return { left: 'bg-against-600', right: 'bg-surface-300' }
  return { left: 'bg-for-500', right: 'bg-against-600' }
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
  placeholder: string,
  onChange: (v: string) => void,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end) || placeholder
  const before = value.slice(0, start)
  const after = value.slice(end)
  onChange(`${before}${prefix}${selected}${suffix}${after}`)
  setTimeout(() => {
    textarea.focus()
    const ns = start + prefix.length
    const ne = ns + selected.length
    textarea.setSelectionRange(ns, ne)
  }, 0)
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const PROMPTS = [
  'What\'s my thesis for this debate?',
  'What evidence supports the FOR side?',
  'What evidence supports the AGAINST side?',
  'What would change my mind?',
  'What are the strongest counter-arguments?',
  'What outcome do I predict and why?',
  'What\'s the biggest risk to my position?',
]

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function catStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-400', bg: 'bg-surface-300/40', border: 'border-surface-400/30' }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  id: string
  statement: string
  category: string | null
  price: number
  status: string
  scope: string | null
  totalVotes: number
  votingEndsAt: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotesClient({
  id,
  statement,
  category,
  price,
  status,
  scope,
  totalVotes,
  votingEndsAt,
}: Props) {
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<NoteSnapshot[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [showPrompts, setShowPrompts] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const store = loadStore(id)
    setDraft(store.draft)
    setHistory(store.history)
    setTags(store.tags)
  }, [id])

  // Auto-save draft as user types
  useEffect(() => {
    const store = loadStore(id)
    store.draft = draft
    saveStore(id, store)
  }, [id, draft])

  const handleSave = useCallback(() => {
    if (!draft.trim()) return
    const snapshot: NoteSnapshot = {
      content: draft.trim(),
      savedAt: new Date().toISOString(),
      label: `Note ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    }
    const newHistory = [snapshot, ...history].slice(0, MAX_HISTORY)
    setHistory(newHistory)
    const store: NoteStore = { draft, history: newHistory, tags }
    saveStore(id, store)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [draft, history, tags, id])

  const handleDelete = useCallback((savedAt: string) => {
    const newHistory = history.filter(h => h.savedAt !== savedAt)
    setHistory(newHistory)
    const store = loadStore(id)
    store.history = newHistory
    saveStore(id, store)
    setDeleteConfirm(null)
    if (expanded === savedAt) setExpanded(null)
  }, [history, id, expanded])

  const handleRestore = useCallback((content: string) => {
    setDraft(content)
    setTab('write')
    setShowHistory(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [])

  const handleClear = useCallback(() => {
    setDraft('')
    setTab('write')
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [])

  const handleAddTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t || tags.includes(t) || tags.length >= 8) return
    const newTags = [...tags, t]
    setTags(newTags)
    setTagInput('')
    const store = loadStore(id)
    store.tags = newTags
    saveStore(id, store)
  }, [tagInput, tags, id])

  const handleRemoveTag = useCallback((tag: string) => {
    const newTags = tags.filter(t => t !== tag)
    setTags(newTags)
    const store = loadStore(id)
    store.tags = newTags
    saveStore(id, store)
  }, [tags, id])

  const bar = priceBar(status)
  const cs = catStyle(category)
  const isLaw = status === 'law'
  const isFailed = status === 'failed'

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0
  const charCount = draft.length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">

        {/* Back nav */}
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market
          </button>
          <span className="text-surface-600">/</span>
          <span className="text-surface-400">Notes</span>
        </div>

        {/* Market context card */}
        <div className={cn(
          'rounded-xl border p-4 bg-surface-100/60',
          isLaw ? 'border-gold/30 bg-gold/5' : isFailed ? 'border-surface-300/40' : 'border-surface-300/40',
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {category && (
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cs.bg, cs.border, cs.text, 'border')}>
                    {category}
                  </span>
                )}
                {scope && (
                  <span className="text-xs text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
                    {scope}
                  </span>
                )}
                {isLaw && (
                  <Badge variant="gold" size="sm" className="flex items-center gap-1">
                    <Gavel className="h-3 w-3" />
                    Law
                  </Badge>
                )}
                {isFailed && (
                  <Badge variant="against" size="sm">Failed</Badge>
                )}
              </div>
              <Link
                href={`/exchange/${id}`}
                className="text-sm font-medium text-white hover:text-for-300 transition-colors leading-snug block"
              >
                {statement}
              </Link>
            </div>

            {/* Price chip */}
            <div className="flex-shrink-0 text-right">
              <div className={cn('text-2xl font-mono font-bold tabular-nums', priceColor(price, status))}>
                {price}¢
              </div>
              <div className="text-xs text-surface-500 mt-0.5">
                {totalVotes.toLocaleString()} votes
              </div>
            </div>
          </div>

          {/* Price bar */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-mono text-for-400 tabular-nums w-7 text-right">{price}%</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className={cn('h-full rounded-full transition-all', bar.left)}
                style={{ width: `${price}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-against-400 tabular-nums w-7">{100 - price}%</span>
          </div>

          {votingEndsAt && !isLaw && !isFailed && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-surface-500">
              <Clock className="h-3 w-3" />
              Closes {new Date(votingEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Notes header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
              <NotebookPen className="h-4 w-4 text-for-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Research Notes</h1>
              <p className="text-xs text-surface-500">Private — stored locally on this device</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                  showHistory
                    ? 'bg-for-500/20 border border-for-500/40 text-for-300'
                    : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white',
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                {history.length} {history.length === 1 ? 'save' : 'saves'}
              </button>
            )}
          </div>
        </div>

        {/* Saved history */}
        <AnimatePresence>
          {showHistory && history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-surface-300/40 bg-surface-100/40 divide-y divide-surface-300/30">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-surface-400">Saved versions</span>
                  <span className="text-xs text-surface-600">{history.length}/{MAX_HISTORY} slots</span>
                </div>
                {history.map((snap) => (
                  <div key={snap.savedAt} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-white font-medium">{relTime(snap.savedAt)}</span>
                          <span className="text-xs text-surface-600">{fmtDate(snap.savedAt)}</span>
                        </div>
                        <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
                          {snap.content.slice(0, 120)}{snap.content.length > 120 ? '…' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleRestore(snap.content)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-for-500/10 border border-for-500/30 text-xs text-for-400 hover:text-for-300 hover:bg-for-500/20 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </button>
                        {deleteConfirm === snap.savedAt ? (
                          <button
                            onClick={() => handleDelete(snap.savedAt)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-against-500/20 border border-against-500/40 text-xs text-against-400 hover:text-against-300 transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(snap.savedAt)}
                            className="p-1.5 rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {expanded === snap.savedAt && (
                      <div className="mt-2 p-3 rounded-lg bg-surface-200/60 text-xs text-surface-300 leading-relaxed whitespace-pre-wrap">
                        {snap.content}
                      </div>
                    )}
                    <button
                      onClick={() => setExpanded(v => v === snap.savedAt ? null : snap.savedAt)}
                      className="mt-1.5 text-xs text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-1"
                    >
                      {expanded === snap.savedAt ? (
                        <><ChevronUp className="h-3 w-3" /> Collapse</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" /> Expand</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-surface-500 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Tags:
            </span>
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => handleRemoveTag(tag)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300 text-xs text-surface-400 hover:border-against-500/40 hover:text-against-400 transition-colors group"
              >
                {tag}
                <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
            {tags.length < 8 && (
              <div className="flex items-center gap-1">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add tag…"
                  className="bg-transparent text-xs text-white placeholder-surface-600 border-none outline-none w-20"
                />
                {tagInput.trim() && (
                  <button
                    onClick={handleAddTag}
                    className="p-0.5 rounded text-surface-500 hover:text-for-400 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-surface-300/40 px-3 py-2">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTab('write')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  tab === 'write'
                    ? 'bg-surface-200 text-white border border-surface-300/60'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Write
              </button>
              <button
                onClick={() => setTab('preview')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  tab === 'preview'
                    ? 'bg-surface-200 text-white border border-surface-300/60'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>

            {/* Format buttons */}
            {tab === 'write' && (
              <div className="flex items-center gap-0.5">
                {[
                  { label: 'Bold', icon: Bold, prefix: '**', suffix: '**', placeholder: 'bold text' },
                  { label: 'Italic', icon: Italic, prefix: '*', suffix: '*', placeholder: 'italic text' },
                  { label: 'Code', icon: Code, prefix: '`', suffix: '`', placeholder: 'code' },
                  { label: 'Link', icon: Link2, prefix: '[', suffix: '](https://)', placeholder: 'link text' },
                ].map(({ label, icon: Icon, prefix, suffix, placeholder }) => (
                  <button
                    key={label}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      if (textareaRef.current) {
                        wrapSelection(textareaRef.current, prefix, suffix, placeholder, setDraft)
                      }
                    }}
                    className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-300/40 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Write area */}
          {tab === 'write' ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write your thesis, research notes, or open questions about this debate…&#10;&#10;Supports **bold**, *italic*, `code`, and [links](https://)"
              className={cn(
                'w-full min-h-[280px] bg-transparent px-4 py-4',
                'text-sm text-surface-200 placeholder-surface-600',
                'resize-y outline-none leading-relaxed',
                'font-mono',
              )}
              spellCheck
            />
          ) : (
            <div className="min-h-[280px] px-4 py-4 text-sm text-surface-200 leading-relaxed">
              {draft.trim() ? (
                draft.split('\n').map((line, i) => (
                  <p key={i} className={cn('mb-2', !line.trim() && 'mb-3')}>
                    {renderTokens(tokenize(line))}
                  </p>
                ))
              ) : (
                <p className="text-surface-600 italic">Nothing written yet. Switch to Write to add notes.</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-surface-300/40 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-600">
                {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} chars
              </span>
              {draft.trim() && (
                <button
                  onClick={handleClear}
                  className="text-xs text-surface-600 hover:text-against-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrompts(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                  showPrompts
                    ? 'bg-purple/20 border border-purple/40 text-purple'
                    : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white',
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Prompts
              </button>

              <button
                onClick={handleSave}
                disabled={!draft.trim()}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  saved
                    ? 'bg-emerald/20 border border-emerald/40 text-emerald'
                    : draft.trim()
                    ? 'bg-for-500/20 border border-for-500/40 text-for-400 hover:bg-for-500/30 hover:text-for-300'
                    : 'bg-surface-200 border border-surface-300 text-surface-600 cursor-not-allowed',
                )}
              >
                {saved ? (
                  <><Check className="h-3.5 w-3.5" /> Saved</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> Save version</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Prompts panel */}
        <AnimatePresence>
          {showPrompts && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-purple/20 bg-purple/5 p-4 space-y-2"
            >
              <p className="text-xs font-medium text-purple mb-3">Writing prompts — click to insert</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => {
                      const insertion = `\n\n### ${prompt}\n`
                      setDraft(v => v + insertion)
                      setTab('write')
                      setShowPrompts(false)
                      setTimeout(() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus()
                          textareaRef.current.scrollTop = textareaRef.current.scrollHeight
                        }
                      }, 50)
                    }}
                    className="text-left px-3 py-2 rounded-lg bg-surface-200/60 border border-surface-300/40 hover:border-purple/30 hover:bg-purple/10 transition-colors"
                  >
                    <span className="text-xs text-surface-300 hover:text-white transition-colors">
                      {prompt}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: `/exchange/${id}`, label: 'Market', icon: TrendingUp },
            { href: `/exchange/${id}/analysis`, label: 'Analysis', icon: TrendingDown },
            { href: `/exchange/${id}/arguments`, label: 'Arguments', icon: BookOpen },
            { href: `/exchange/journal`, label: 'Journal', icon: NotebookPen },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100/60 border border-surface-300/40 hover:border-for-500/30 hover:bg-for-500/5 transition-colors group"
            >
              <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              <span className="text-xs text-surface-400 group-hover:text-white transition-colors">{label}</span>
            </Link>
          ))}
        </div>

        {/* Empty state */}
        {history.length === 0 && !draft && (
          <div className="text-center py-8 space-y-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 mx-auto">
              <NotebookPen className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-sm text-surface-400">No notes yet</p>
            <p className="text-xs text-surface-600 max-w-xs mx-auto">
              Write your thesis, track your reasoning, and save versions as the debate evolves. Notes are private and stored locally.
            </p>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
