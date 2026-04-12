'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Bold,
  Check,
  Code,
  Eye,
  EyeOff,
  FileEdit,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Terminal,
  WrapText,
} from 'lucide-react'
import { parseBlocks } from './LawDocument'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Wikilink autocomplete ────────────────────────────────────────────────────

interface LawSuggestion {
  id: string
  statement: string
  category: string | null
}

// Regex: detect an open [[ that hasn't been closed yet (on the same line)
const WIKILINK_OPEN_RE = /\[\[([^\]\n]*)$/

function WikilinkDropdown({
  suggestions,
  activeIndex,
  onSelect,
  loading,
}: {
  suggestions: LawSuggestion[]
  activeIndex: number
  onSelect: (s: LawSuggestion) => void
  loading: boolean
}) {
  const listRef = useRef<HTMLUListElement>(null)

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div
      className={cn(
        'absolute left-0 right-0 z-50 mt-1',
        'rounded-xl border border-emerald/30 bg-surface-200 shadow-xl',
        'overflow-hidden'
      )}
    >
      {loading && suggestions.length === 0 ? (
        <div className="px-4 py-3 text-xs font-mono text-surface-500">
          Searching laws…
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-3 text-xs font-mono text-surface-500">
          No laws found. Keep typing…
        </div>
      ) : (
        <>
          <div className="px-3 py-1.5 border-b border-surface-300">
            <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
              Link to a Law · ↑↓ navigate · ↵ select · Esc cancel
            </span>
          </div>
          <ul
            ref={listRef}
            className="max-h-48 overflow-y-auto py-1"
            role="listbox"
            aria-label="Law suggestions"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault() // don't blur textarea
                  onSelect(s)
                }}
                className={cn(
                  'flex items-start gap-3 px-4 py-2 cursor-pointer transition-colors',
                  i === activeIndex
                    ? 'bg-emerald/15 text-white'
                    : 'text-surface-700 hover:bg-surface-300'
                )}
              >
                <span className="flex-1 text-xs font-mono leading-snug line-clamp-2">
                  {s.statement}
                </span>
                {s.category && (
                  <span className="flex-shrink-0 text-[10px] font-mono text-surface-500 mt-0.5">
                    {s.category}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

interface ProposeRevisionFormProps {
  lawId: string
  currentRevisionNum: number
  onSubmit?: () => void
}

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
  { label: 'H1', icon: Heading1, prefix: '# ', block: true },
  { label: 'H2', icon: Heading2, prefix: '## ', block: true },
  { label: 'H3', icon: Heading3, prefix: '### ', block: true },
  { label: 'Blockquote', icon: Quote, prefix: '> ', block: true },
  { label: 'Inline code', icon: Code, prefix: '`', suffix: '`', wrap: true },
  {
    label: 'Code block',
    icon: Terminal,
    prefix: '```\n',
    suffix: '\n```',
    wrap: true,
  },
  { label: 'Bullet list', icon: List, prefix: '- ', block: true },
  { label: 'Numbered list', icon: ListOrdered, prefix: '1. ', block: true },
  {
    label: '[[Wikilink]]',
    icon: Link2,
    prefix: '[[',
    suffix: ']]',
    wrap: true,
  },
  {
    label: 'Markdown link',
    icon: WrapText,
    prefix: '[',
    suffix: '](url)',
    wrap: true,
  },
  { label: 'Divider', icon: Minus, prefix: '\n---\n', block: false },
]

// Minimal markdown-to-plain-nodes renderer for the live preview pane.
// Re-uses parseBlocks from LawDocument; renders as unstyled HTML-ish output.
function PreviewPane({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown)

  if (blocks.length === 0) {
    return (
      <p className="text-surface-500 italic font-mono text-sm py-2">
        Start typing to see a preview…
      </p>
    )
  }

  return (
    <div className="prose-sm max-w-none space-y-3">
      {blocks.map((block, idx) => {
        const key = `prev-${idx}`
        switch (block.type) {
          case 'heading': {
            const sizeClass =
              block.level === 1
                ? 'text-xl font-bold'
                : block.level === 2
                  ? 'text-lg font-bold'
                  : 'text-base font-semibold'
            return (
              <p
                key={key}
                className={cn(
                  'font-mono text-white border-l-2 border-emerald/40 pl-2',
                  sizeClass
                )}
              >
                {block.text}
              </p>
            )
          }
          case 'paragraph':
            return (
              <p key={key} className="text-surface-700 font-mono text-sm leading-relaxed">
                {block.text}
              </p>
            )
          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="pl-3 border-l-2 border-emerald/60 bg-emerald/5 py-1 text-surface-700 font-mono text-sm italic rounded-r"
              >
                {block.lines.join(' ')}
              </blockquote>
            )
          case 'list':
            return (
              <ul
                key={key}
                className={cn(
                  'pl-4 space-y-1 font-mono text-sm text-surface-700',
                  block.ordered ? 'list-decimal' : 'list-disc',
                  'marker:text-emerald/60'
                )}
              >
                {block.items.map((item, li) => (
                  <li key={`${key}-${li}`}>{item}</li>
                ))}
              </ul>
            )
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

export function ProposeRevisionForm({
  lawId,
  currentRevisionNum,
  onSubmit,
}: ProposeRevisionFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorWrapRef = useRef<HTMLDivElement>(null)
  const [bodyMarkdown, setBodyMarkdown] = useState('')
  const [summary, setSummary] = useState('')
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // ── Wikilink autocomplete state ────────────────────────────────────────────
  const [wikiQuery, setWikiQuery] = useState<string | null>(null)
  const [wikiStart, setWikiStart] = useState(-1) // index of '[' in '[['
  const [suggestions, setSuggestions] = useState<LawSuggestion[]>([])
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [wikiLoading, setWikiLoading] = useState(false)
  const wikiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch law suggestions when wikiQuery changes
  useEffect(() => {
    if (wikiQuery === null) {
      setSuggestions([])
      return
    }
    if (wikiDebounceRef.current) clearTimeout(wikiDebounceRef.current)

    if (wikiQuery.trim().length === 0) {
      setSuggestions([])
      return
    }

    wikiDebounceRef.current = setTimeout(async () => {
      setWikiLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(wikiQuery)}&tab=laws`
        )
        if (!res.ok) return
        const data = (await res.json()) as { results: LawSuggestion[] }
        setSuggestions(data.results?.slice(0, 8) ?? [])
        setSuggestionIdx(0)
      } catch {
        // best-effort
      } finally {
        setWikiLoading(false)
      }
    }, 200)
  }, [wikiQuery])

  function closeWiki() {
    setWikiQuery(null)
    setSuggestions([])
    setSuggestionIdx(0)
  }

  function selectSuggestion(s: LawSuggestion) {
    const el = textareaRef.current
    if (!el) return

    const pos = el.selectionStart
    const before = bodyMarkdown.slice(0, wikiStart)
    const after = bodyMarkdown.slice(pos)
    const insertion = `[[${s.statement}]]`
    const newValue = before + insertion + after
    const newPos = before.length + insertion.length

    setBodyMarkdown(newValue)
    closeWiki()

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newPos, newPos)
    })
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setBodyMarkdown(value)

    const pos = e.target.selectionStart
    const textBefore = value.slice(0, pos)
    const match = WIKILINK_OPEN_RE.exec(textBefore)

    if (match) {
      const query = match[1]
      const start = pos - query.length - 2 // position of first '['
      setWikiQuery(query)
      setWikiStart(start)
    } else {
      closeWiki()
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (wikiQuery === null || (suggestions.length === 0 && !wikiLoading)) return

    if (e.key === 'Escape') {
      e.preventDefault()
      closeWiki()
      return
    }

    if (suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      selectSuggestion(suggestions[suggestionIdx])
    }
  }

  const nextRevNum = currentRevisionNum + 1
  const canSubmit =
    bodyMarkdown.trim().length >= 50 && !submitting && !submitted

  // Insert or wrap text at the current cursor position in the textarea.
  const applyFormat = useCallback((action: ToolbarAction) => {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = bodyMarkdown.slice(start, end)
    const before = bodyMarkdown.slice(0, start)
    const after = bodyMarkdown.slice(end)

    let newValue: string
    let newCursor: number

    if (action.block) {
      // Insert prefix at the start of the current line
      const lineStart = before.lastIndexOf('\n') + 1
      const linePrefix = bodyMarkdown.slice(lineStart, start)
      const newLine = action.prefix + linePrefix + selected
      newValue =
        bodyMarkdown.slice(0, lineStart) + newLine + bodyMarkdown.slice(end)
      newCursor = lineStart + action.prefix.length + linePrefix.length + selected.length
    } else if (action.wrap && selected.length > 0) {
      // Wrap selection
      newValue = before + action.prefix + selected + (action.suffix ?? '') + after
      newCursor = start + action.prefix.length + selected.length + (action.suffix?.length ?? 0)
    } else {
      // Insert prefix (and suffix) at cursor
      newValue = before + action.prefix + (action.suffix ?? '') + after
      newCursor = start + action.prefix.length
    }

    setBodyMarkdown(newValue)

    // Restore focus and cursor after state update
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newCursor, newCursor)
    })
  }, [bodyMarkdown])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/laws/${lawId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_markdown: bodyMarkdown.trim(),
          summary: summary.trim() || null,
        }),
      })

      if (res.status === 401) {
        setError('You must be signed in to propose a revision.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Failed to submit revision.')
        return
      }

      setSubmitted(true)
      setBodyMarkdown('')
      setSummary('')
      onSubmit?.()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 px-5 py-4 rounded-2xl',
          'border border-dashed border-surface-300 bg-surface-100',
          'text-surface-500 hover:text-emerald hover:border-emerald/40 hover:bg-emerald/5',
          'transition-colors text-sm font-mono'
        )}
      >
        <FileEdit className="h-4 w-4 flex-shrink-0" />
        <span>Propose a revision to this law&rsquo;s body text</span>
        <span className="ml-auto text-[11px] uppercase tracking-wider text-surface-500">
          rev #{nextRevNum}
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald/30 bg-surface-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-300 bg-emerald/5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald/15">
          <FileEdit className="h-3.5 w-3.5 text-emerald" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald">
            Propose Revision #{nextRevNum}
          </p>
          <p className="text-[11px] text-surface-500">
            Edit the body text of this law. Your revision will be visible immediately.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-surface-200"
        >
          Cancel
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-surface-300 bg-surface-50 flex-wrap">
        {TOOLBAR.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              onClick={() => applyFormat(action)}
              title={action.label}
              type="button"
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded text-surface-500',
                'hover:bg-surface-200 hover:text-white transition-colors',
                'text-xs font-mono'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPreview((v) => !v)}
            type="button"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono',
              'transition-colors',
              preview
                ? 'bg-emerald/15 text-emerald border border-emerald/30'
                : 'text-surface-500 hover:text-white hover:bg-surface-200'
            )}
          >
            {preview ? (
              <>
                <EyeOff className="h-3 w-3" /> Edit
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" /> Preview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor / Preview pane */}
      <div className="p-4 space-y-4">
        {preview ? (
          <div className="min-h-[200px] rounded-xl bg-surface-50 border border-surface-300 p-4">
            <PreviewPane markdown={bodyMarkdown} />
          </div>
        ) : (
          <div ref={editorWrapRef} className="relative">
            <div
              className={cn(
                'rounded-xl border bg-surface-50 transition-colors',
                'focus-within:border-emerald/50',
                bodyMarkdown.trim().length > 0 && bodyMarkdown.trim().length < 50
                  ? 'border-against-500/50'
                  : 'border-surface-300'
              )}
            >
              <textarea
                ref={textareaRef}
                value={bodyMarkdown}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder={`# Article I — Overview\n\nWrite the law body in Markdown. Supports **bold**, *italic*, [[wikilinks]], headings, blockquotes, and code blocks.\n\n## Article II — Provisions\n\nStart drafting here…`}
                rows={14}
                disabled={submitting || submitted}
                className={cn(
                  'w-full bg-transparent text-sm text-white placeholder:text-surface-400',
                  'resize-y focus:outline-none font-mono leading-relaxed',
                  'px-4 pt-3 pb-2 disabled:opacity-50'
                )}
              />
              <div className="flex items-center justify-between border-t border-surface-300 px-4 py-2">
                <span className="text-[11px] text-surface-500 font-mono">
                  Markdown · <span className="text-emerald/70">[[law name]]</span> for wikilinks · min 50 chars
                </span>
                <span
                  className={cn(
                    'text-xs font-mono tabular-nums',
                    bodyMarkdown.trim().length < 50
                      ? 'text-against-500'
                      : bodyMarkdown.trim().length > 45000
                        ? 'text-gold'
                        : 'text-surface-500'
                  )}
                >
                  {bodyMarkdown.trim().length.toLocaleString()} / 50,000
                </span>
              </div>
            </div>

            {/* Wikilink autocomplete dropdown — show while typing after [[ */}
            {wikiQuery !== null && wikiQuery.trim().length > 0 && (
              <WikilinkDropdown
                suggestions={suggestions}
                activeIndex={suggestionIdx}
                onSelect={selectSuggestion}
                loading={wikiLoading}
              />
            )}
          </div>
        )}

        {/* Summary input */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-1.5">
            Edit summary{' '}
            <span className="normal-case tracking-normal text-surface-400">
              (optional)
            </span>
          </label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief description of what changed (e.g. 'Added Article II provisions')"
            maxLength={200}
            disabled={submitting || submitted}
            className={cn(
              'w-full h-9 px-3 rounded-lg bg-surface-50 border border-surface-300',
              'text-sm text-white placeholder:text-surface-400 font-mono',
              'focus:outline-none focus:border-emerald/50 focus:ring-1 focus:ring-emerald/20',
              'transition-colors disabled:opacity-50'
            )}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-against-500/30 bg-against-500/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-against-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-against-400 font-mono">{error}</p>
          </div>
        )}

        {/* Success */}
        {submitted && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-3">
            <Check className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald font-mono">
              Revision #{nextRevNum} submitted. The law document has been updated.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-surface-500 font-mono">
            Revisions are public and permanent.
          </p>
          <Button
            variant="gold"
            size="md"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting
              ? 'Submitting…'
              : submitted
                ? 'Submitted'
                : `Submit rev #${nextRevNum}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
