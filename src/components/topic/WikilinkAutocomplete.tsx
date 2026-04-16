'use client'

/**
 * WikilinkAutocomplete
 *
 * Floating dropdown that appears when a user types [[ in the wiki editor.
 * Fetches matching topics from /api/topics/wikilinks and lets the user pick
 * one to insert as a markdown link.
 *
 * Usage:
 *   <WikilinkAutocomplete
 *     query="economic"
 *     excludeTopicId="abc-123"
 *     selectedIndex={0}
 *     onSelect={(s) => { ... }}
 *     onClose={() => { ... }}
 *   />
 */

import { useEffect, useRef, useState } from 'react'
import { Link2, Gavel, Zap, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikilinkSuggestion {
  id: string
  statement: string
  status: string
  category: string | null
}

interface WikilinkAutocompleteProps {
  query: string
  excludeTopicId?: string
  selectedIndex: number
  onSelect: (suggestion: WikilinkSuggestion) => void
  onClose: () => void
  /** Call this when results arrive so parent can update selectedIndex clamp */
  onResultsChange?: (count: number) => void
  /** Called with the full results array so parent can select on Enter */
  onResultsReady?: (results: WikilinkSuggestion[]) => void
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  law: Gavel,
  voting: Zap,
  active: Zap,
  proposed: FileText,
  failed: FileText,
}

const STATUS_COLOR: Record<string, string> = {
  law: 'text-gold',
  voting: 'text-purple',
  active: 'text-for-400',
  proposed: 'text-surface-500',
  failed: 'text-against-400',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WikilinkAutocomplete({
  query,
  excludeTopicId,
  selectedIndex,
  onSelect,
  onClose,
  onResultsChange,
  onResultsReady,
}: WikilinkAutocompleteProps) {
  const [results, setResults] = useState<WikilinkSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // Stable ref so the fetch effect doesn't re-run when callbacks change
  const onResultsReadyRef = useRef(onResultsReady)
  const onResultsChangeRef = useRef(onResultsChange)
  useEffect(() => {
    onResultsReadyRef.current = onResultsReady
    onResultsChangeRef.current = onResultsChange
  })

  // Fetch suggestions whenever query changes (debounced 120 ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (!query) {
      setResults([])
      onResultsChangeRef.current?.(0)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const url = `/api/topics/wikilinks?q=${encodeURIComponent(query)}${
          excludeTopicId ? `&exclude=${excludeTopicId}` : ''
        }`
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) throw new Error('fetch failed')
        const json = (await res.json()) as { results?: WikilinkSuggestion[] }
        const items = json.results ?? []
        setResults(items)
        onResultsChangeRef.current?.(items.length)
        onResultsReadyRef.current?.(items)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([])
          onResultsChangeRef.current?.(0)
        }
      } finally {
        setLoading(false)
      }
    }, 120)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, excludeTopicId])

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!loading && results.length === 0 && query.length > 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-xl border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-4 py-3 text-xs font-mono text-surface-500 flex items-center gap-2">
          <Link2 className="h-3 w-3 flex-shrink-0" />
          No topics found for &ldquo;{query}&rdquo;
        </div>
      </div>
    )
  }

  if (results.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-xl border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-300 bg-surface-200/60">
        <Link2 className="h-3 w-3 text-for-400 flex-shrink-0" />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
          Link to topic
        </span>
        {loading && <Loader2 className="h-3 w-3 text-surface-500 animate-spin ml-auto" />}
        <span className="text-[10px] font-mono text-surface-600 ml-auto">
          ↑↓ navigate · Enter select · Esc close
        </span>
      </div>

      {/* Results */}
      <ul ref={listRef} role="listbox" aria-label="Topic suggestions" className="max-h-56 overflow-y-auto">
        {results.map((s, i) => {
          const Icon = STATUS_ICON[s.status] ?? FileText
          const colorClass = STATUS_COLOR[s.status] ?? 'text-surface-500'
          const isActive = i === selectedIndex

          return (
            <li
              key={s.id}
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(s)
              }}
              className={cn(
                'flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors',
                isActive
                  ? 'bg-for-600/20 border-l-2 border-for-500'
                  : 'hover:bg-surface-200 border-l-2 border-transparent'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', colorClass)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white leading-snug truncate">
                  {highlightMatch(s.statement, query)}
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                  {s.category ? `${s.category} · ` : ''}
                  <span className={colorClass}>{statusLabel(s.status)}</span>
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    law: 'Established Law',
    voting: 'Voting',
    active: 'Active',
    proposed: 'Proposed',
    failed: 'Failed',
  }
  return labels[status] ?? status
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-for-500/30 text-for-300 rounded-sm not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}
