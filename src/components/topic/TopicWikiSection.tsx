'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Fragment, type ReactNode } from 'react'
import {
  Bold,
  Italic,
  Quote,
  Code,
  List,
  ListOrdered,
  Link2,
  Eye,
  EyeOff,
  BookOpen,
  Pencil,
  Check,
  X,
  Loader2,
  Plus,
  Network,
  Clock,
} from 'lucide-react'
import { parseBlocks } from '@/components/law/LawDocument'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  WikilinkAutocomplete,
  type WikilinkSuggestion,
} from '@/components/topic/WikilinkAutocomplete'

// ─── Wikilink helpers ─────────────────────────────────────────────────────────

/**
 * Returns the [[query string if the cursor is currently inside a [[...
 * pattern (no closing ]] yet), or null otherwise.
 */
function getWikilinkContext(
  text: string,
  cursorPos: number
): { query: string; startPos: number } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/\[\[([^\][]*)$/)
  if (!match) return null
  const startPos = before.length - match[0].length
  return { query: match[1], startPos }
}

// ─── Inline token renderer (subset used for topic descriptions) ───────────────

type Token =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'bold'; children: Token[] }
  | { type: 'italic'; children: Token[] }

function tokenizeInline(input: string): Token[] {
  const tokens: Token[] = []
  let remaining = input

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push({ type: 'code', value: codeMatch[1] })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      tokens.push({ type: 'link', value: linkMatch[1], href: linkMatch[2] })
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      tokens.push({ type: 'bold', children: tokenizeInline(boldMatch[1]) })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      tokens.push({ type: 'italic', children: tokenizeInline(italicMatch[1]) })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const nextSpecial = remaining.search(/[`\[*]/)
    if (nextSpecial === -1) {
      tokens.push({ type: 'text', value: remaining })
      remaining = ''
    } else if (nextSpecial === 0) {
      tokens.push({ type: 'text', value: remaining[0] })
      remaining = remaining.slice(1)
    } else {
      tokens.push({ type: 'text', value: remaining.slice(0, nextSpecial) })
      remaining = remaining.slice(nextSpecial)
    }
  }

  return tokens
}

function renderTokens(tokens: Token[], keyPrefix: string): ReactNode {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`
    switch (token.type) {
      case 'text':
        return <Fragment key={key}>{token.value}</Fragment>
      case 'code':
        return (
          <code
            key={key}
            className="bg-surface-200 text-for-300 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-surface-300"
          >
            {token.value}
          </code>
        )
      case 'link': {
        // Internal topic links (inserted via [[wikilink]] autocomplete)
        // get a distinctive cross-reference style; external links get standard style.
        const isInternal =
          token.href.startsWith('/topic/') ||
          token.href.startsWith('/law/')
        return isInternal ? (
          <a
            key={key}
            href={token.href}
            className={cn(
              'inline-flex items-center gap-0.5 font-mono text-[0.85em]',
              'text-for-300 bg-for-600/15 border border-for-500/30',
              'rounded px-1 py-0.5 hover:bg-for-600/25 hover:text-for-200',
              'transition-colors no-underline'
            )}
            title="Related topic"
          >
            <Network className="h-2.5 w-2.5 flex-shrink-0 opacity-70" aria-hidden />
            {token.value}
          </a>
        ) : (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-for-400 underline underline-offset-2 hover:text-for-300 transition-colors"
          >
            {token.value}
          </a>
        )
      }
      case 'bold':
        return (
          <strong key={key} className="text-white font-semibold">
            {renderTokens(token.children, key)}
          </strong>
        )
      case 'italic':
        return (
          <em key={key} className="text-surface-700 italic">
            {renderTokens(token.children, key)}
          </em>
        )
    }
  })
}

// ─── Markdown preview renderer ────────────────────────────────────────────────

function WikiPreview({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)

  if (blocks.length === 0) {
    return (
      <p className="text-surface-500 italic text-sm py-1 font-mono">
        Start typing to see a preview…
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const key = `wb-${idx}`
        switch (block.type) {
          case 'heading': {
            const sizeClass =
              block.level === 1
                ? 'text-lg font-bold'
                : block.level === 2
                  ? 'text-base font-semibold'
                  : 'text-sm font-semibold'
            return (
              <p
                key={key}
                className={cn(
                  'font-mono text-white border-l-2 border-for-500/50 pl-2.5',
                  sizeClass
                )}
              >
                {block.text}
              </p>
            )
          }
          case 'paragraph':
            return (
              <p key={key} className="text-surface-700 text-sm leading-relaxed">
                {renderTokens(tokenizeInline(block.text), key)}
              </p>
            )
          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="pl-3 border-l-2 border-for-500/50 bg-for-600/5 py-1 text-surface-700 text-sm italic rounded-r"
              >
                {block.lines.map((line, li) => (
                  <p key={`${key}-l-${li}`}>{renderTokens(tokenizeInline(line), `${key}-l-${li}`)}</p>
                ))}
              </blockquote>
            )
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            return (
              <Tag
                key={key}
                className={cn(
                  'pl-5 space-y-1 text-sm text-surface-700',
                  block.ordered ? 'list-decimal' : 'list-disc',
                  'marker:text-for-500/60'
                )}
              >
                {block.items.map((item, li) => (
                  <li key={`${key}-i-${li}`}>{renderTokens(tokenizeInline(item), `${key}-i-${li}`)}</li>
                ))}
              </Tag>
            )
          }
          case 'codeblock':
            return (
              <pre
                key={key}
                className="bg-surface-200 border border-surface-300 rounded-lg p-3 font-mono text-xs text-surface-800 overflow-x-auto"
              >
                <code>{block.code}</code>
              </pre>
            )
          case 'hr':
            return <hr key={key} className="border-surface-300" />
          default:
            return null
        }
      })}
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

type ToolbarAction = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  prefix: string
  suffix?: string
  block?: boolean
  wrap?: boolean
}

const TOOLBAR: ToolbarAction[] = [
  { label: 'Bold', icon: Bold, prefix: '**', suffix: '**', wrap: true },
  { label: 'Italic', icon: Italic, prefix: '*', suffix: '*', wrap: true },
  { label: 'Blockquote', icon: Quote, prefix: '> ', block: true },
  { label: 'Inline code', icon: Code, prefix: '`', suffix: '`', wrap: true },
  { label: 'Bullet list', icon: List, prefix: '- ', block: true },
  { label: 'Numbered list', icon: ListOrdered, prefix: '1. ', block: true },
  { label: 'Link', icon: Link2, prefix: '[', suffix: '](url)', wrap: true },
  // Wikilink button is handled specially below — not in applyToolbarAction
]

function applyToolbarAction(
  textarea: HTMLTextAreaElement,
  action: ToolbarAction
): string {
  const { value, selectionStart, selectionEnd } = textarea
  const selected = value.slice(selectionStart, selectionEnd)

  let before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  let insertion = ''

  if (action.block) {
    // Prepend to the current line
    const lineStart = before.lastIndexOf('\n') + 1
    const linePrefix = before.slice(lineStart)
    before = before.slice(0, lineStart)
    insertion = action.prefix + linePrefix + selected
  } else if (action.wrap) {
    const suffix = action.suffix ?? ''
    if (selected.length > 0) {
      insertion = action.prefix + selected + suffix
    } else {
      insertion = action.prefix + suffix
    }
  } else {
    insertion = action.prefix + selected
  }

  return before + insertion + after
}

// ─── Main component ───────────────────────────────────────────────────────────

const MAX_CHARS = 5000

function wikiRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TopicWikiSectionProps {
  topicId: string
  authorId: string
  description: string | null | undefined
  onUpdate: (description: string | null) => void
  className?: string
  /** ISO timestamp of the last description edit */
  updatedAt?: string | null
  /** Username of the editor (display without @) */
  updatedByUsername?: string | null
}

export function TopicWikiSection({
  topicId,
  authorId,
  description,
  onUpdate,
  className,
  updatedAt,
  updatedByUsername,
}: TopicWikiSectionProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Wikilink autocomplete state ────────────────────────────────────────────
  const [wikilinkOpen, setWikilinkOpen] = useState(false)
  const [wikilinkQuery, setWikilinkQuery] = useState('')
  const [wikilinkStartPos, setWikilinkStartPos] = useState(0)
  const [wikilinkSelectedIdx, setWikilinkSelectedIdx] = useState(0)
  const [wikilinkResultCount, setWikilinkResultCount] = useState(0)
  // Store latest results so we can select on Enter
  const wikilinkResultsRef = useRef<WikilinkSuggestion[]>([])

  // Detect auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  const isAuthor = currentUserId === authorId

  const startEditing = useCallback(() => {
    setDraft(description ?? '')
    setPreviewMode(false)
    setError(null)
    setEditing(true)
  }, [description])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setDraft('')
    setError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: draft.trim() || null }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to save')
      }

      const { topic } = await res.json()
      onUpdate(topic.description ?? null)
      setEditing(false)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [topicId, draft, saving, onUpdate])

  // Insert a [[wikilink]] — replaces `[[query` with `[Statement](/topic/id)`
  const handleWikilinkSelect = useCallback(
    (suggestion: WikilinkSuggestion) => {
      const ta = textareaRef.current
      if (!ta) return
      const replacement = `[${suggestion.statement}](/topic/${suggestion.id})`
      const newValue =
        draft.slice(0, wikilinkStartPos) +
        replacement +
        draft.slice(ta.selectionStart)
      setDraft(newValue)
      setWikilinkOpen(false)
      setWikilinkQuery('')
      setWikilinkSelectedIdx(0)
      // Move cursor to end of inserted link
      const newCursor = wikilinkStartPos + replacement.length
      setTimeout(() => {
        ta.focus()
        ta.setSelectionRange(newCursor, newCursor)
      }, 0)
    },
    [draft, wikilinkStartPos]
  )

  // Insert `[[` to trigger wikilink mode manually (toolbar button)
  const insertWikilinkTrigger = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const newValue = draft.slice(0, pos) + '[[' + draft.slice(pos)
    setDraft(newValue)
    setTimeout(() => {
      ta.focus()
      const newPos = pos + 2
      ta.setSelectionRange(newPos, newPos)
      // Manually trigger the autocomplete
      const ctx = getWikilinkContext(newValue, newPos)
      if (ctx) {
        setWikilinkStartPos(ctx.startPos)
        setWikilinkQuery(ctx.query)
        setWikilinkSelectedIdx(0)
        setWikilinkOpen(true)
      }
    }, 0)
  }, [draft])

  const applyFormat = useCallback((action: ToolbarAction) => {
    const ta = textareaRef.current
    if (!ta) return
    const newValue = applyToolbarAction(ta, action)
    setDraft(newValue)
    // Restore focus after React re-renders
    setTimeout(() => {
      ta.focus()
    }, 0)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta || !editing) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.max(120, ta.scrollHeight)}px`
  }, [draft, editing])

  const remaining = MAX_CHARS - draft.length
  const nearLimit = remaining < 200

  // ── Empty state for non-authors / no description ──────────────────────────

  if (!description && !editing) {
    if (!isAuthor) return null
    return (
      <div className={cn('mt-5', className)}>
        <button
          onClick={startEditing}
          className={cn(
            'w-full flex items-center gap-2.5 px-4 py-3 rounded-xl',
            'border border-dashed border-surface-400/50 hover:border-for-500/40',
            'bg-surface-100/50 hover:bg-for-600/5',
            'text-surface-500 hover:text-for-400',
            'transition-all duration-150 group'
          )}
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-mono">Add context · background, evidence, reasoning…</span>
        </button>
      </div>
    )
  }

  // ── Editing mode ──────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className={cn('mt-5 rounded-xl border border-for-500/30 bg-surface-100 overflow-hidden', className)}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-surface-300">
          <BookOpen className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono text-surface-500 uppercase tracking-wider flex-1">
            Context
          </span>
          <button
            onClick={() => setPreviewMode((p) => !p)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-colors',
              previewMode
                ? 'bg-for-600/20 text-for-400 border border-for-500/30'
                : 'text-surface-500 hover:text-white hover:bg-surface-300'
            )}
            aria-pressed={previewMode}
            title={previewMode ? 'Back to editor' : 'Preview'}
          >
            {previewMode ? (
              <><EyeOff className="h-3 w-3" /> Edit</>
            ) : (
              <><Eye className="h-3 w-3" /> Preview</>
            )}
          </button>
        </div>

        {/* Toolbar */}
        {!previewMode && (
          <div
            className="flex items-center gap-0.5 px-3 py-1.5 border-b border-surface-300 flex-wrap"
            role="toolbar"
            aria-label="Formatting toolbar"
          >
            {TOOLBAR.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyFormat(action)
                  }}
                  className={cn(
                    'flex items-center justify-center h-7 w-7 rounded-md',
                    'text-surface-500 hover:text-white hover:bg-surface-300',
                    'transition-colors'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}

            {/* Wikilink button — inserts [[ to trigger autocomplete */}
            <div className="h-4 w-px bg-surface-400/40 mx-0.5" aria-hidden />
            <button
              type="button"
              title="Link to related topic  ([[)"
              aria-label="Insert topic wikilink"
              onMouseDown={(e) => {
                e.preventDefault()
                insertWikilinkTrigger()
              }}
              className={cn(
                'flex items-center gap-1 h-7 px-2 rounded-md',
                'text-for-400/80 hover:text-for-300 hover:bg-for-600/20',
                'transition-colors text-[11px] font-mono font-semibold'
              )}
            >
              <Network className="h-3 w-3 flex-shrink-0" />
              [[
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="p-4">
          {previewMode ? (
            <div className="min-h-[120px]">
              {draft.trim() ? (
                <WikiPreview markdown={draft} />
              ) : (
                <p className="text-surface-500 italic text-sm font-mono">Nothing to preview yet…</p>
              )}
            </div>
          ) : (
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  const newVal = e.target.value.slice(0, MAX_CHARS)
                  setDraft(newVal)
                  // Detect [[ trigger for wikilink autocomplete
                  const pos = e.target.selectionStart
                  const ctx = getWikilinkContext(newVal, pos)
                  if (ctx) {
                    setWikilinkStartPos(ctx.startPos)
                    setWikilinkQuery(ctx.query)
                    setWikilinkSelectedIdx(0)
                    setWikilinkOpen(true)
                  } else {
                    setWikilinkOpen(false)
                    setWikilinkQuery('')
                  }
                }}
                onKeyDown={(e) => {
                  if (!wikilinkOpen) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setWikilinkSelectedIdx((i) =>
                      Math.min(i + 1, wikilinkResultCount - 1)
                    )
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setWikilinkSelectedIdx((i) => Math.max(i - 1, 0))
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setWikilinkOpen(false)
                    setWikilinkQuery('')
                  } else if (e.key === 'Enter') {
                    const suggestion = wikilinkResultsRef.current[wikilinkSelectedIdx]
                    if (suggestion) {
                      e.preventDefault()
                      handleWikilinkSelect(suggestion)
                    }
                  }
                }}
                placeholder={`Add background context, evidence links, key facts, or reasoning…\n\nUse **bold**, *italic*, > blockquotes, and - bullets.\nType [[ to link to a related topic.`}
                rows={5}
                className={cn(
                  'w-full bg-transparent text-sm text-surface-700 placeholder-surface-500',
                  'font-mono leading-relaxed resize-none outline-none',
                  'min-h-[120px] transition-all'
                )}
                aria-label="Topic context editor"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                spellCheck
              />

              {/* Wikilink autocomplete dropdown */}
              {wikilinkOpen && (
                <WikilinkAutocomplete
                  query={wikilinkQuery}
                  excludeTopicId={topicId}
                  selectedIndex={wikilinkSelectedIdx}
                  onSelect={handleWikilinkSelect}
                  onClose={() => {
                    setWikilinkOpen(false)
                    setWikilinkQuery('')
                  }}
                  onResultsChange={(count) => {
                    setWikilinkResultCount(count)
                    setWikilinkSelectedIdx((i) => Math.min(i, Math.max(0, count - 1)))
                  }}
                  onResultsReady={(results) => {
                    wikilinkResultsRef.current = results
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer: char counter + actions */}
        <div className="flex items-center gap-3 px-4 pb-3 border-t border-surface-300 pt-2">
          <span
            className={cn(
              'text-[11px] font-mono',
              nearLimit ? 'text-against-400' : 'text-surface-500'
            )}
          >
            {draft.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>

          {error && (
            <span className="text-xs text-against-400 flex-1 truncate">{error}</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || draft.length > MAX_CHARS}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-for-600 hover:bg-for-500 text-white border border-for-500/50',
                'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Display mode ──────────────────────────────────────────────────────────

  return (
    <div className={cn('mt-5 rounded-xl border border-surface-300 bg-surface-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300 flex-wrap">
        <BookOpen className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
          Context
        </span>
        {/* Editor attribution */}
        {updatedAt && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-600 ml-1 min-w-0">
            <Clock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">
              {updatedByUsername ? (
                <>edited by <span className="text-surface-500">@{updatedByUsername}</span> · {wikiRelativeTime(updatedAt)}</>
              ) : (
                <>edited {wikiRelativeTime(updatedAt)}</>
              )}
            </span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isAuthor && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              title="Edit context"
              aria-label="Edit context"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Rendered content */}
      <div className="px-4 py-4">
        {description ? (
          <WikiPreview markdown={description} />
        ) : (
          <p className="text-surface-500 text-sm italic font-mono">No context added yet.</p>
        )}
      </div>
    </div>
  )
}
