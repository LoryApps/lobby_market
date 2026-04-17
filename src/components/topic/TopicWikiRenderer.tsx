'use client'

import { Fragment, type ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { Network } from 'lucide-react'
import { parseBlocks } from '@/components/law/LawDocument'
import { cn } from '@/lib/utils/cn'

// ─── Inline token types ───────────────────────────────────────────────────────

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
        const isInternal = token.href.startsWith('/topic/') || token.href.startsWith('/law/')
        return isInternal ? (
          <Link
            key={key}
            href={token.href}
            className={cn(
              'inline-flex items-center gap-0.5 font-mono text-[0.85em]',
              'text-for-300 bg-for-600/15 border border-for-500/30',
              'rounded px-1 py-0.5 hover:bg-for-600/25 hover:text-for-200',
              'transition-colors no-underline'
            )}
          >
            <Network className="h-2.5 w-2.5 flex-shrink-0 opacity-70" aria-hidden />
            {token.value}
          </Link>
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

// ─── Table of Contents ────────────────────────────────────────────────────────

interface TocEntry {
  id: string
  text: string
  level: 1 | 2 | 3
}

function TableOfContents({ entries, className }: { entries: TocEntry[]; className?: string }) {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const headings = document.querySelectorAll('h2[id], h3[id], h4[id]')
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (obs) => {
        const visible = obs.find((e) => e.isIntersecting)
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  if (!entries.length) return null

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="Table of contents"
      className={cn(
        'rounded-xl border border-surface-300 bg-surface-100 p-4',
        className
      )}
    >
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-500 mb-3">
        Contents
      </p>
      <ol className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} className={cn(entry.level === 3 && 'ml-3')}>
            <button
              onClick={() => scrollTo(entry.id)}
              className={cn(
                'text-left text-[12px] font-mono leading-snug transition-colors w-full truncate',
                active === entry.id
                  ? 'text-for-300 font-semibold'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              {entry.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ─── Main renderer ────────────────────────────────────────────────────────────

interface TopicWikiRendererProps {
  description: string | null
  className?: string
}

export function TopicWikiRenderer({ description, className }: TopicWikiRendererProps) {
  if (!description?.trim()) {
    return (
      <p className="text-surface-500 italic text-sm font-mono py-8 text-center">
        No wiki context has been added to this topic yet.
      </p>
    )
  }

  const blocks = parseBlocks(description)

  // Extract headings for TOC
  const toc: TocEntry[] = blocks
    .filter((b) => b.type === 'heading' && (b.level === 1 || b.level === 2 || b.level === 3))
    .map((b) => {
      if (b.type !== 'heading') return null as never
      return { id: b.id, text: b.text, level: b.level } as TocEntry
    })

  return (
    <div className={cn('flex flex-col-reverse lg:flex-row gap-6', className)}>
      {/* ── TOC sidebar ────────────────────────────────────────────────────── */}
      {toc.length >= 2 && (
        <aside className="lg:w-52 xl:w-60 flex-shrink-0">
          <div className="lg:sticky lg:top-6">
            <TableOfContents entries={toc} />
          </div>
        </aside>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {blocks.map((block, idx) => {
          const key = `wb-${idx}`
          switch (block.type) {
            case 'heading': {
              const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
              const sizeClass =
                block.level === 1
                  ? 'text-xl font-bold mt-8 first:mt-0 border-b border-surface-300 pb-2'
                  : block.level === 2
                    ? 'text-base font-semibold mt-6 first:mt-0'
                    : 'text-sm font-semibold mt-4 first:mt-0 text-surface-700'
              return (
                <Tag
                  key={key}
                  id={block.id}
                  className={cn('font-mono text-white scroll-mt-6', sizeClass)}
                >
                  {block.text}
                </Tag>
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
                  className="pl-3 border-l-2 border-for-500/50 bg-for-600/5 py-2 text-surface-700 text-sm italic rounded-r"
                >
                  {block.lines.map((line, li) => (
                    <p key={`${key}-l-${li}`}>
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
                    'pl-5 space-y-1 text-sm text-surface-700',
                    block.ordered ? 'list-decimal' : 'list-disc',
                    'marker:text-for-500/60'
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
                  className="bg-surface-200 border border-surface-300 rounded-lg p-3 font-mono text-xs text-surface-800 overflow-x-auto"
                >
                  <code>{block.code}</code>
                </pre>
              )
            case 'hr':
              return <hr key={key} className="border-surface-300 my-2" />
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}
