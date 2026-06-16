'use client'

/**
 * /coalitions/[id]/constitution — Coalition Constitution
 *
 * A formal founding charter that coalition leaders can author in markdown.
 * Documents core values, governance rules, and policy positions.
 * Every save is versioned in coalition_constitution_revisions.
 *
 * Distinct from:
 *   /coalitions/[id]/topics  — per-topic stance declarations
 *   /coalitions/[id]/war-room — internal strategy board
 *   /constitution             — platform-wide law codex
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bold,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Eye,
  FileText,
  History,
  Italic,
  List,
  Loader2,
  Pencil,
  Quote,
  Save,
  ScrollText,
  Shield,
  Slash,
  Users,
  X,
} from 'lucide-react'
import { parseBlocks } from '@/components/law/LawDocument'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConstitutionResponse, ConstitutionRevision } from '@/app/api/coalitions/[id]/constitution/route'

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

// ─── Default starter constitution ─────────────────────────────────────────────

const STARTER_TEMPLATE = `# Preamble

We, the members of this coalition, unite around our shared civic values and commit to debating in good faith toward the common good.

## Article I — Core Values

*Replace this with your coalition's founding principles.*

- We believe in evidence-based debate
- We welcome dissent and revision
- We hold ourselves accountable to the community

## Article II — Policy Positions

*List the key positions your coalition takes on major issues.*

## Article III — Governance

**Decision-making:** Major coalition decisions require a simple majority of active members.

**Membership:** We welcome any citizen who agrees to our core values and participates constructively.

## Article IV — Amendments

This constitution may be amended by the coalition leader with a 7-day notice period to all members.
`

// ─── Markdown preview renderer ────────────────────────────────────────────────

function ConstitutionPreview({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)

  if (blocks.length === 0) {
    return (
      <p className="text-surface-500 italic text-sm py-2">
        Your constitution will appear here as you type…
      </p>
    )
  }

  return (
    <div className="space-y-4 prose-constitution">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const Tag = (`h${block.level}`) as 'h1' | 'h2' | 'h3'
            const sizeClass =
              block.level === 1
                ? 'text-xl font-bold text-white border-b border-gold/30 pb-2'
                : block.level === 2
                  ? 'text-base font-semibold text-white/90 mt-2'
                  : 'text-sm font-semibold text-surface-300 uppercase tracking-wide'
            return <Tag key={idx} className={sizeClass}>{block.text}</Tag>
          }
          case 'paragraph':
            return (
              <p key={idx} className="text-sm text-surface-300 leading-relaxed">
                {block.text}
              </p>
            )
          case 'bullet':
            return (
              <ul key={idx} className="space-y-1 pl-4">
                {block.items.map((item, i) => (
                  <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                    <span className="text-gold mt-0.5 flex-shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )
          case 'ordered':
            return (
              <ol key={idx} className="space-y-1 pl-4">
                {block.items.map((item, i) => (
                  <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                    <span className="text-gold font-mono text-xs mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            )
          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-gold/50 pl-4 italic text-sm text-surface-400"
              >
                {block.text}
              </blockquote>
            )
          case 'code':
            return (
              <pre
                key={idx}
                className="bg-surface-200 border border-surface-300 rounded-lg p-4 text-xs font-mono text-surface-300 overflow-x-auto"
              >
                {block.text}
              </pre>
            )
          case 'divider':
            return <hr key={idx} className="border-surface-300/40" />
          default:
            return null
        }
      })}
    </div>
  )
}

// ─── Revision item ─────────────────────────────────────────────────────────────

function RevisionRow({ rev }: { rev: ConstitutionRevision }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-surface-200/50 last:border-0">
      <Avatar
        src={rev.author_avatar_url}
        fallback={rev.author_display_name ?? rev.author_username ?? '?'}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/80">
            {rev.author_display_name ?? rev.author_username ?? 'Unknown'}
          </span>
          <span className="text-xs text-surface-500">{relativeTime(rev.created_at)}</span>
        </div>
        {rev.edit_summary && (
          <p className="text-xs text-surface-400 mt-0.5 italic">&ldquo;{rev.edit_summary}&rdquo;</p>
        )}
      </div>
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement>,
  before: string,
  after = '',
  setValue: (v: string) => void,
  getValue: () => string
) {
  const el = ref.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = getValue().slice(start, end)
  const replacement = before + (selected || 'text') + after
  const next = getValue().slice(0, start) + replacement + getValue().slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    el.focus()
    const newPos = start + before.length + (selected || 'text').length
    el.setSelectionRange(
      start + before.length,
      selected ? newPos : start + before.length + 4
    )
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoalitionConstitutionPage() {
  const params = useParams<{ id: string }>()
  const coalitionId = params.id

  const [data, setData] = useState<ConstitutionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [charCount, setCharCount] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/constitution`)
      if (!res.ok) throw new Error('Failed to load constitution')
      const json = await res.json() as ConstitutionResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => { load() }, [load])

  function startEditing() {
    const current = data?.coalition.constitution_md ?? STARTER_TEMPLATE
    setDraft(current)
    setCharCount(current.length)
    setEditSummary('')
    setViewMode('split')
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setDraft('')
    setSaveError(null)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/constitution`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ constitution_md: draft, edit_summary: editSummary || undefined }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? 'Save failed')
      }
      setEditing(false)
      await load()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleDraftChange(v: string) {
    setDraft(v)
    setCharCount(v.length)
  }

  const toolbar = [
    { icon: Bold,   title: 'Bold',        before: '**', after: '**' },
    { icon: Italic, title: 'Italic',      before: '*', after: '*' },
    { icon: Quote,  title: 'Blockquote',  before: '> ', after: '' },
    { icon: Code,   title: 'Code block',  before: '```\n', after: '\n```' },
    { icon: List,   title: 'Bullet list', before: '\n- ', after: '' },
    { icon: Slash,  title: 'Divider',     before: '\n---\n', after: '' },
  ]

  // ── Skeleton ──

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 container max-w-3xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-64 w-full" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 container max-w-3xl mx-auto px-4 py-12">
          <EmptyState
            icon={<FileText className="h-8 w-8 text-surface-500" />}
            title="Coalition not found"
            description={error ?? 'Could not load the constitution.'}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { coalition, revisions, is_leader } = data
  const hasContent = !!coalition.constitution_md?.trim()

  // ── Edit mode ──

  if (editing) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 flex flex-col container max-w-5xl mx-auto px-4 py-4 gap-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                title="Discard changes"
              >
                <X className="h-4 w-4" />
              </button>
              <h1 className="text-sm font-semibold text-white">
                Editing Constitution — {coalition.name}
              </h1>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5 text-xs">
              {(['edit', 'split', 'preview'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-md transition-colors capitalize',
                    viewMode === m
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  {m === 'split' ? <Eye className="h-3.5 w-3.5" /> : m}
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-lg p-1.5 flex-wrap">
            {toolbar.map(({ icon: Icon, title, before, after }) => (
              <button
                key={title}
                title={title}
                onClick={() =>
                  insertAtCursor(
                    textareaRef as React.RefObject<HTMLTextAreaElement>,
                    before,
                    after,
                    handleDraftChange,
                    () => draft
                  )
                }
                className="p-2 rounded text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
            <div className="ml-auto text-xs text-surface-500">
              {charCount.toLocaleString()} / 50,000
            </div>
          </div>

          {/* Editor + Preview */}
          <div
            className={cn(
              'flex-1 min-h-0 grid gap-4',
              viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'
            )}
            style={{ minHeight: '400px' }}
          >
            {/* Editor pane */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className="flex flex-col">
                {viewMode === 'split' && (
                  <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> Markdown
                  </p>
                )}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  className={cn(
                    'flex-1 w-full bg-surface-200 border border-surface-300 rounded-lg',
                    'text-sm font-mono text-white/90 placeholder-surface-500',
                    'p-4 resize-none focus:outline-none focus:ring-1 focus:ring-gold/50',
                    'leading-relaxed'
                  )}
                  placeholder={STARTER_TEMPLATE}
                  spellCheck
                  style={{ minHeight: '400px' }}
                />
              </div>
            )}

            {/* Preview pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="flex flex-col">
                {viewMode === 'split' && (
                  <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Preview
                  </p>
                )}
                <div className="flex-1 bg-surface-200 border border-surface-300 rounded-lg p-4 overflow-y-auto" style={{ minHeight: '400px' }}>
                  <ConstitutionPreview markdown={draft} />
                </div>
              </div>
            )}
          </div>

          {/* Save bar */}
          <div className="flex items-center gap-3 bg-surface-200 border border-surface-300 rounded-xl p-3">
            <input
              type="text"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              maxLength={200}
              placeholder="Brief edit summary (optional)…"
              className="flex-1 bg-transparent text-sm text-white placeholder-surface-500 focus:outline-none"
            />
            {saveError && (
              <span className="text-xs text-against-400">{saveError}</span>
            )}
            <Button
              onClick={save}
              disabled={saving || !draft.trim()}
              size="sm"
              className="bg-gold text-black hover:bg-gold/90 font-semibold flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? 'Saving…' : 'Save Constitution'}
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Read mode ──

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Back + heading */}
        <div className="flex items-center gap-3">
          <Link
            href={`/coalitions/${coalitionId}`}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-gold flex-shrink-0" />
              {coalition.name} — Constitution
            </h1>
            {coalition.constitution_updated_at && (
              <p className="text-xs text-surface-500 mt-0.5">
                Last updated {relativeTime(coalition.constitution_updated_at)}
                {coalition.updater_display_name || coalition.updater_username
                  ? ` by ${coalition.updater_display_name ?? coalition.updater_username}`
                  : ''}
              </p>
            )}
          </div>
          {is_leader && (
            <Button
              onClick={startEditing}
              size="sm"
              className="flex items-center gap-1.5 bg-surface-300 hover:bg-surface-200 text-white border border-surface-200"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>

        {/* Nav pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { href: `/coalitions/${coalitionId}`, label: 'Overview', icon: Shield },
            { href: `/coalitions/${coalitionId}/topics`, label: 'Positions', icon: FileText },
            { href: `/coalitions/${coalitionId}/members`, label: 'Members', icon: Users },
            { href: `/coalitions/${coalitionId}/constitution`, label: 'Constitution', icon: ScrollText },
          ].map(({ href, label, icon: Icon }) => {
            const active = label === 'Constitution'
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-gold text-black'
                    : 'bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Constitution body */}
        {hasContent ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-200 border border-surface-300 rounded-2xl p-6"
          >
            <ConstitutionPreview markdown={coalition.constitution_md!} />
          </motion.div>
        ) : (
          <div className="bg-surface-200 border border-surface-300/60 border-dashed rounded-2xl p-10 text-center">
            <ScrollText className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-white/80 mb-1">No constitution yet</h2>
            <p className="text-sm text-surface-500 mb-4 max-w-sm mx-auto">
              {is_leader
                ? 'Give your coalition a formal charter — define your values, governance, and positions.'
                : 'This coalition has not yet written a formal constitution.'}
            </p>
            {is_leader && (
              <Button
                onClick={startEditing}
                size="sm"
                className="bg-gold text-black hover:bg-gold/90 font-semibold mx-auto"
              >
                Write Constitution
              </Button>
            )}
          </div>
        )}

        {/* Revision history */}
        {revisions.length > 0 && (
          <div className="bg-surface-200 border border-surface-300 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowHistory((h) => !h)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-300/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-white/80">
                <History className="h-4 w-4 text-surface-500" />
                Revision History
                <Badge variant="proposed" className="text-xs py-0 px-1.5">
                  {revisions.length}
                </Badge>
              </span>
              {showHistory ? (
                <ChevronUp className="h-4 w-4 text-surface-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-surface-500" />
              )}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 divide-y divide-surface-300/40">
                    {revisions.map((rev) => (
                      <RevisionRow key={rev.id} rev={rev} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Empty history placeholder */}
        {revisions.length === 0 && hasContent && (
          <div className="flex items-center gap-2 text-xs text-surface-500 px-1">
            <Clock className="h-3.5 w-3.5" />
            No revision history — edits from this point on will be recorded here.
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
