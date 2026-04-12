'use client'

import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import type { Law, LawRevision } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LawDocumentProps {
  law: Law
  revisions: LawRevision[]
}

// -----------------------------------------------------------------------------
// Inline markdown parser
//
// Handles, in order:
//   `code`      -> <code>
//   [[wiki]]    -> /law?search=wiki
//   [text](url) -> <a>
//   **bold**    -> <strong>
//   *italic*    -> <em>
// -----------------------------------------------------------------------------

type Token =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'wiki'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'bold'; children: Token[] }
  | { type: 'italic'; children: Token[] }

function tokenizeInline(input: string): Token[] {
  const tokens: Token[] = []
  let remaining = input

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push({ type: 'code', value: codeMatch[1] })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Wikilink
    const wikiMatch = remaining.match(/^\[\[([^\]]+)\]\]/)
    if (wikiMatch) {
      tokens.push({ type: 'wiki', value: wikiMatch[1] })
      remaining = remaining.slice(wikiMatch[0].length)
      continue
    }

    // Markdown link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      tokens.push({
        type: 'link',
        value: linkMatch[1],
        href: linkMatch[2],
      })
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      tokens.push({
        type: 'bold',
        children: tokenizeInline(boldMatch[1]),
      })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      tokens.push({
        type: 'italic',
        children: tokenizeInline(italicMatch[1]),
      })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Plain text: consume up to the next special marker
    const nextSpecial = remaining.search(/[`\[*]/)
    if (nextSpecial === -1) {
      tokens.push({ type: 'text', value: remaining })
      remaining = ''
    } else if (nextSpecial === 0) {
      // Orphaned special char — treat as text, advance by one
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
            className="bg-surface-200 text-emerald px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-surface-300"
          >
            {token.value}
          </code>
        )
      case 'wiki':
        return (
          <Link
            key={key}
            href={`/law?search=${encodeURIComponent(token.value)}`}
            className="text-emerald underline decoration-dotted decoration-emerald/40 hover:decoration-emerald hover:bg-emerald/10 px-0.5 rounded-sm transition-colors"
          >
            {token.value}
          </Link>
        )
      case 'link':
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-for-400 underline hover:text-for-300"
          >
            {token.value}
          </a>
        )
      case 'bold':
        return (
          <strong key={key} className="text-white font-semibold">
            {renderTokens(token.children, key)}
          </strong>
        )
      case 'italic':
        return (
          <em key={key} className="text-surface-800 italic">
            {renderTokens(token.children, key)}
          </em>
        )
    }
  })
}

// -----------------------------------------------------------------------------
// Block-level parser
// -----------------------------------------------------------------------------

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'codeblock'; lang: string; code: string }
  | { type: 'hr' }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line — skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      const text = headingMatch[2].trim()
      blocks.push({ type: 'heading', level, text, id: slugify(text) })
      i++
      continue
    }

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/)
    if (fenceMatch) {
      const lang = fenceMatch[1]
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      // consume closing fence
      if (i < lines.length) i++
      blocks.push({ type: 'codeblock', lang, code: codeLines.join('\n') })
      continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'blockquote', lines: quoteLines })
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', items, ordered: false })
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', items, ordered: true })
      continue
    }

    // Paragraph — consume until blank line or block boundary
    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s|>\s?|[-*]\s+|\d+\.\s+|```|-{3,}$)/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
  }

  return blocks
}

function renderBlock(block: Block, idx: number): ReactNode {
  const key = `b-${idx}`
  switch (block.type) {
    case 'heading': {
      const sizeClass =
        block.level === 1
          ? 'text-3xl mt-10 mb-4'
          : block.level === 2
            ? 'text-2xl mt-8 mb-3'
            : 'text-xl mt-6 mb-2'
      const Tag = (`h${block.level}` as unknown) as 'h1' | 'h2' | 'h3'
      return (
        <Tag
          key={key}
          id={block.id}
          className={cn(
            'font-mono font-semibold text-white scroll-mt-20',
            'border-l-2 border-emerald/40 pl-3',
            sizeClass
          )}
        >
          {block.text}
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p
          key={key}
          className="text-surface-700 leading-relaxed my-4 font-mono text-[15px]"
        >
          {renderTokens(tokenizeInline(block.text), key)}
        </p>
      )
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className={cn(
            'my-5 pl-4 py-2 border-l-2 border-emerald/60',
            'bg-emerald/5 text-surface-800 italic font-mono text-[15px] rounded-r'
          )}
        >
          {block.lines.map((line, li) => (
            <p key={`${key}-l-${li}`} className="my-1">
              {renderTokens(tokenizeInline(line), `${key}-l-${li}`)}
            </p>
          ))}
        </blockquote>
      )
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul'
      return (
        <ListTag
          key={key}
          className={cn(
            'my-4 pl-6 space-y-1.5 font-mono text-[15px] text-surface-700',
            block.ordered ? 'list-decimal' : 'list-disc',
            'marker:text-emerald/60'
          )}
        >
          {block.items.map((item, li) => (
            <li key={`${key}-i-${li}`}>
              {renderTokens(tokenizeInline(item), `${key}-i-${li}`)}
            </li>
          ))}
        </ListTag>
      )
    }
    case 'codeblock':
      return (
        <pre
          key={key}
          className={cn(
            'my-5 p-4 rounded-lg bg-surface-200 border border-surface-300',
            'overflow-x-auto font-mono text-[13px] text-surface-800'
          )}
        >
          <code>{block.code}</code>
        </pre>
      )
    case 'hr':
      return <hr key={key} className="my-8 border-surface-300" />
  }
}

export function LawDocument({ law, revisions }: LawDocumentProps) {
  const currentBody = revisions[0]?.body_markdown ?? law.body_markdown ?? ''
  const blocks = parseBlocks(currentBody)

  return (
    <article
      className={cn(
        'bg-surface-100 border border-surface-300 rounded-2xl',
        'p-8 md:p-12 shadow-xl shadow-black/20'
      )}
    >
      {/* Title */}
      <h1
        className={cn(
          'font-mono font-bold text-white',
          'text-3xl md:text-4xl leading-tight mb-6',
          'tracking-tight'
        )}
      >
        {law.statement}
      </h1>

      {/* Full statement as a featured blockquote */}
      {law.full_statement && law.full_statement !== law.statement && (
        <blockquote
          className={cn(
            'my-8 pl-5 py-4 pr-4',
            'border-l-4 border-emerald',
            'bg-emerald/5 text-surface-800',
            'font-mono text-base md:text-lg leading-relaxed rounded-r-lg'
          )}
        >
          {law.full_statement}
        </blockquote>
      )}

      {/* Divider */}
      <hr className="my-6 border-surface-300" />

      {/* Body */}
      {blocks.length > 0 ? (
        <div className="law-document-body">
          {blocks.map((block, idx) => renderBlock(block, idx))}
        </div>
      ) : (
        <p className="text-surface-500 italic font-mono text-sm py-4">
          No body content yet. Debators can contribute by proposing a revision.
        </p>
      )}

      {/* Footer with revision info */}
      {revisions.length > 0 && (
        <div className="mt-10 pt-4 border-t border-surface-300 text-xs text-surface-500 font-mono">
          Last revised:{' '}
          {new Date(revisions[0].created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}{' '}
          (rev #{revisions[0].revision_num})
        </div>
      )}
    </article>
  )
}
