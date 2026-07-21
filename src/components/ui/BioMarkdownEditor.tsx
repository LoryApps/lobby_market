'use client'

/**
 * BioMarkdownEditor
 *
 * A textarea with a formatting toolbar (Bold, Italic, Code, Link) and a
 * live Preview tab that renders the bio using the same inline-markdown
 * tokenizer that ProfileHeader uses — so what you see in preview is exactly
 * what your followers will see on your profile.
 */

import { useRef, useState, type ReactNode } from 'react'
import { Bold, Code, Eye, Italic, Link2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Inline markdown tokenizer (mirrors ProfileHeader BioText logic) ──────────

type Token =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string }

/** Tokenize inline bio markdown. Exported for reuse. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let s = input
  while (s.length > 0) {
    const bold = s.match(/^\*\*([^*]+)\*\*/)
    if (bold) { tokens.push({ t: 'bold', v: bold[1] }); s = s.slice(bold[0].length); continue }
    const italic = s.match(/^\*([^*]+)\*/)
    if (italic) { tokens.push({ t: 'italic', v: italic[1] }); s = s.slice(italic[0].length); continue }
    const code = s.match(/^`([^`]+)`/)
    if (code) { tokens.push({ t: 'code', v: code[1] }); s = s.slice(code[0].length); continue }
    const link = s.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
    if (link) { tokens.push({ t: 'link', v: link[1], href: link[2] }); s = s.slice(link[0].length); continue }
    const next = s.match(/^[^*`[]+/) ?? [s[0]]
    tokens.push({ t: 'text', v: next[0] }); s = s.slice(next[0].length)
  }
  return tokens
}

/** Render inline bio markdown tokens to ReactNodes. Exported for reuse. */
export function renderTokens(tokens: Token[]): ReactNode[] {
  return tokens.map((tok, i) => {
    switch (tok.t) {
      case 'bold':
        return <strong key={i} className="font-semibold text-white">{tok.v}</strong>
      case 'italic':
        return <em key={i} className="italic">{tok.v}</em>
      case 'code':
        return <code key={i} className="px-1 py-0.5 rounded bg-surface-300 text-emerald font-mono text-xs">{tok.v}</code>
      case 'link':
        return <a key={i} href={tok.href} target="_blank" rel="noopener noreferrer" className="text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors">{tok.v}</a>
      default:
        return <span key={i}>{tok.v}</span>
    }
  })
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

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
  const newValue = `${before}${prefix}${selected}${suffix}${after}`
  onChange(newValue)
  // Re-focus and restore selection around the new content
  setTimeout(() => {
    textarea.focus()
    const newStart = start + prefix.length
    const newEnd = newStart + selected.length
    textarea.setSelectionRange(newStart, newEnd)
  }, 0)
}

function insertLink(
  textarea: HTMLTextAreaElement,
  onChange: (v: string) => void,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end) || 'link text'
  const before = value.slice(0, start)
  const after = value.slice(end)
  const snippet = `[${selected}](https://)`
  const newValue = `${before}${snippet}${after}`
  onChange(newValue)
  setTimeout(() => {
    textarea.focus()
    // Place cursor at the URL part
    const urlStart = start + selected.length + 3
    const urlEnd = urlStart + 8
    textarea.setSelectionRange(urlStart, urlEnd)
  }, 0)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BioMarkdownEditorProps {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  className?: string
}

export function BioMarkdownEditor({
  value,
  onChange,
  maxLength = 280,
  className,
}: BioMarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const remaining = maxLength - value.length
  const countColor =
    remaining > 50 ? 'text-surface-500' : remaining > 20 ? 'text-gold' : 'text-against-400'

  function bold() {
    if (!textareaRef.current) return
    wrapSelection(textareaRef.current, '**', '**', 'bold text', onChange)
  }
  function italic() {
    if (!textareaRef.current) return
    wrapSelection(textareaRef.current, '*', '*', 'italic text', onChange)
  }
  function code() {
    if (!textareaRef.current) return
    wrapSelection(textareaRef.current, '`', '`', 'code', onChange)
  }
  function link() {
    if (!textareaRef.current) return
    insertLink(textareaRef.current, onChange)
  }

  const toolbarBtnClass =
    'flex items-center justify-center w-7 h-7 rounded-md text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors'

  return (
    <div className={cn('space-y-1', className)}>
      {/* Tab row + toolbar */}
      <div className="flex items-center justify-between gap-2">
        {/* Write / Preview tabs */}
        <div className="flex gap-1 text-xs font-mono">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors',
              tab === 'write'
                ? 'bg-surface-300 text-white'
                : 'text-surface-500 hover:text-white hover:bg-surface-200',
            )}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors',
              tab === 'preview'
                ? 'bg-surface-300 text-white'
                : 'text-surface-500 hover:text-white hover:bg-surface-200',
            )}
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            Preview
          </button>
        </div>

        {/* Formatting toolbar — only visible in write mode */}
        {tab === 'write' && (
          <div className="flex items-center gap-0.5" role="toolbar" aria-label="Bio formatting">
            <button type="button" onClick={bold} className={toolbarBtnClass} title="Bold (**text**)">
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={italic} className={toolbarBtnClass} title="Italic (*text*)">
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={code} className={toolbarBtnClass} title="Inline code (`code`)">
              <Code className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={link} className={toolbarBtnClass} title="Link ([text](url))">
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Editor / Preview area */}
      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          id="bio"
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tell the Lobby who you are… Markdown supported: **bold**, *italic*, `code`, [link](url)"
          className="w-full rounded-lg border border-surface-300 bg-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-500 focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500 transition-colors resize-none leading-relaxed"
          aria-label="Bio — supports Markdown formatting"
        />
      ) : (
        <div
          aria-label="Bio preview"
          className="w-full rounded-lg border border-surface-300 bg-surface-200/50 px-4 py-3 min-h-[104px] text-sm text-surface-600 leading-relaxed"
        >
          {value.trim() ? (
            <p>{renderTokens(tokenize(value))}</p>
          ) : (
            <span className="text-surface-500 italic text-xs">Nothing to preview yet — switch to Write and add your bio.</span>
          )}
        </div>
      )}

      {/* Footer row: hint + char count */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-surface-600">
          {tab === 'write' ? 'Supports **bold**, *italic*, `code`, [link](url)' : 'This is how your bio appears on your profile.'}
        </p>
        <span className={cn('text-[10px] font-mono tabular-nums', countColor)}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}
