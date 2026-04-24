'use client'

/**
 * ArgumentCitationsPanel
 *
 * Aggregates all external sources (source_url) cited in a topic's arguments
 * and shows them grouped by FOR / AGAINST stance.
 *
 * This gives debate participants an at-a-glance view of the evidence
 * landscape before or after diving into the full argument thread.
 *
 * Hidden when fewer than 2 arguments have citations.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookMarked, ChevronDown, ChevronUp, ExternalLink, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CitationDomain, ArgumentCitationsResponse } from '@/app/api/topics/[id]/argument-citations/route'

interface ArgumentCitationsPanelProps {
  topicId: string
  className?: string
}

// ─── Favicon icon ─────────────────────────────────────────────────────────────

function FaviconIcon({ domain }: { domain: string }) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <div className="flex-shrink-0 h-4 w-4 rounded bg-surface-300 flex items-center justify-center">
        <ExternalLink className="h-2.5 w-2.5 text-surface-500" aria-hidden />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={16}
      height={16}
      className="h-4 w-4 rounded flex-shrink-0 bg-surface-300"
      onError={() => setErrored(true)}
    />
  )
}

// ─── Side citation list ───────────────────────────────────────────────────────

function SideCitations({
  citations,
  side,
  count,
}: {
  citations: CitationDomain[]
  side: 'for' | 'against'
  count: number
}) {
  const isFor = side === 'for'

  const filtered = citations.filter((c) => (isFor ? c.for_count > 0 : c.against_count > 0))
  if (filtered.length === 0) return null

  const sorted = [...filtered].sort((a, b) =>
    isFor ? b.for_count - a.for_count : b.against_count - a.against_count
  )

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-1.5 mb-2 pb-1.5 border-b',
          isFor ? 'border-for-500/20' : 'border-against-500/20'
        )}
      >
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden />
        )}
        <span
          className={cn(
            'text-[10px] font-mono font-semibold uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="text-[10px] font-mono text-surface-600 ml-auto tabular-nums">
          {count} cited
        </span>
      </div>

      {/* Domain rows */}
      <ul className="space-y-1.5" role="list" aria-label={`Sources cited in ${side} arguments`}>
        {sorted.slice(0, 6).map((c) => {
          const citedCount = isFor ? c.for_count : c.against_count
          return (
            <li key={c.domain}>
              <a
                href={c.example_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                  'hover:bg-surface-200/80',
                  isFor
                    ? 'hover:border-for-500/20'
                    : 'hover:border-against-500/20'
                )}
              >
                <FaviconIcon domain={c.domain} />
                <span className="flex-1 min-w-0 text-[12px] font-mono text-surface-400 group-hover:text-white truncate transition-colors">
                  {c.domain}
                </span>
                <span
                  className={cn(
                    'flex-shrink-0 text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded',
                    isFor
                      ? 'bg-for-500/15 text-for-400'
                      : 'bg-against-500/15 text-against-400'
                  )}
                  aria-label={`${citedCount} ${citedCount === 1 ? 'argument cites' : 'arguments cite'} this source`}
                >
                  ×{citedCount}
                </span>
                <ExternalLink
                  className="flex-shrink-0 h-2.5 w-2.5 text-surface-600 group-hover:text-surface-400 transition-colors"
                  aria-hidden
                />
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArgumentCitationsPanel({ topicId, className }: ArgumentCitationsPanelProps) {
  const [data, setData] = useState<ArgumentCitationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${topicId}/argument-citations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json as ArgumentCitationsResponse)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [topicId])

  // Show once we have data; hide if fewer than 2 cited args
  if (loading || !data || data.total_cited_args < 2) return null

  const hasBothSides = data.for_cited > 0 && data.against_cited > 0

  return (
    <section
      className={cn(
        'rounded-xl border border-surface-300 bg-surface-100/60 overflow-hidden',
        className
      )}
      aria-label="Evidence cited in debate"
    >
      {/* Accordion trigger */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-3 text-left',
          'hover:bg-surface-200/50 transition-colors'
        )}
      >
        <BookMarked className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden />
        <span className="flex-1 text-[12px] font-mono font-semibold text-surface-400 uppercase tracking-widest">
          Evidence cited
        </span>

        {/* Summary pills */}
        <div className="flex items-center gap-1.5 mr-1" aria-hidden>
          {data.for_cited > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/20 px-1.5 py-0.5 rounded">
              <ThumbsUp className="h-2.5 w-2.5" />
              {data.for_cited}
            </span>
          )}
          {data.against_cited > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-against-400 bg-against-500/10 border border-against-500/20 px-1.5 py-0.5 rounded">
              <ThumbsDown className="h-2.5 w-2.5" />
              {data.against_cited}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {data.citations.length} {data.citations.length === 1 ? 'source' : 'sources'}
          </span>
        </div>

        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden />
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="citations-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'px-4 pb-4 pt-1',
                hasBothSides ? 'grid grid-cols-2 gap-4' : 'flex'
              )}
            >
              <SideCitations
                citations={data.citations}
                side="for"
                count={data.for_cited}
              />
              <SideCitations
                citations={data.citations}
                side="against"
                count={data.against_cited}
              />
            </div>

            {/* Footer note */}
            <div className="px-4 pb-3 -mt-1">
              <p className="text-[10px] font-mono text-surface-600 text-center">
                Sources linked by participants in their arguments
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
