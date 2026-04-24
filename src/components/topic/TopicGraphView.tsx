'use client'

/**
 * TopicGraphView
 *
 * Full-page client wrapper for TopicGraph.
 * Manages:
 *  - Live search (highlights matching nodes, dims others)
 *  - Category filter pills
 *  - Status filter pills (All / Active / Voting / Law)
 *  - Reset view button
 *  - Copy-link button (shares current filter state via URL params)
 *  - Category colour legend
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, Copy, RotateCcw, Search, X } from 'lucide-react'
import type { TopicNode, TopicEdge } from '@/components/topic/TopicGraph'
import { GRAPH_CATEGORY_COLORS as CATEGORY_COLORS, graphColorForCategory as colorForCategory } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'

// Lazy-load the D3-powered canvas — d3-force is only bundled when the graph
// page is actually visited, keeping the main JS payload lighter.
const TopicGraph = dynamic(
  () => import('@/components/topic/TopicGraph').then((m) => m.TopicGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="text-surface-500 text-sm">Loading graph…</div>
      </div>
    ),
  }
)

interface TopicGraphViewProps {
  topics: TopicNode[]
  edges: TopicEdge[]
  graphClassName?: string
}

// ─── URL param helpers ────────────────────────────────────────────────────────

function readParams(): { q: string; hideCategories: Set<string>; hideStatuses: Set<string> } {
  if (typeof window === 'undefined')
    return { q: '', hideCategories: new Set(), hideStatuses: new Set() }
  const sp = new URLSearchParams(window.location.search)
  const q = sp.get('q') ?? ''
  const hideCatStr = sp.get('hidecat') ?? ''
  const hideStatStr = sp.get('hidestat') ?? ''
  const hideCategories = new Set(
    hideCatStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  )
  const hideStatuses = new Set(
    hideStatStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  )
  return { q, hideCategories, hideStatuses }
}

function writeParams(q: string, hideCategories: Set<string>, hideStatuses: Set<string>) {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)
  if (q) sp.set('q', q)
  else sp.delete('q')
  if (hideCategories.size > 0) sp.set('hidecat', Array.from(hideCategories).join(','))
  else sp.delete('hidecat')
  if (hideStatuses.size > 0) sp.set('hidestat', Array.from(hideStatuses).join(','))
  else sp.delete('hidestat')
  const newSearch = sp.toString()
  window.history.replaceState(
    null,
    '',
    window.location.pathname + (newSearch ? `?${newSearch}` : ''),
  )
}

// ─── Status config ────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  { id: 'proposed', label: 'Proposed', color: '#52525b' },
  { id: 'active',   label: 'Active',   color: '#3b82f6' },
  { id: 'voting',   label: 'Voting',   color: '#8b5cf6' },
  { id: 'law',      label: 'LAW',      color: '#f59e0b' },
  { id: 'failed',   label: 'Failed',   color: '#ef4444' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicGraphView({ topics, edges, graphClassName }: TopicGraphViewProps) {
  const [initialised, setInitialised] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())
  const [graphKey, setGraphKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Read URL params on first client render
  useEffect(() => {
    const { q, hideCategories, hideStatuses } = readParams()
    if (q) setSearchQuery(q)
    if (hideCategories.size > 0) setHiddenCategories(hideCategories)
    if (hideStatuses.size > 0) setHiddenStatuses(hideStatuses)
    setInitialised(true)
  }, [])

  // Sync URL params when filters change
  useEffect(() => {
    if (!initialised) return
    writeParams(searchQuery, hiddenCategories, hiddenStatuses)
  }, [searchQuery, hiddenCategories, hiddenStatuses, initialised])

  // Derive sorted list of categories present in the data
  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const t of topics) {
      if (t.category) seen.add(t.category)
    }
    return Array.from(seen).sort()
  }, [topics])

  const toggleCategory = useCallback((cat: string) => {
    const key = cat.toLowerCase()
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleStatus = useCallback((status: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }, [])

  const showAllCategories = useCallback(() => setHiddenCategories(new Set()), [])
  const hideAllCategories = useCallback(
    () => setHiddenCategories(new Set(categories.map((c) => c.toLowerCase()))),
    [categories],
  )

  const resetView = useCallback(() => setGraphKey((k) => k + 1), [])

  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  const matchCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return topics.filter((t) => t.statement.toLowerCase().includes(q)).length
  }, [searchQuery, topics])

  const visibleCount = useMemo(() => {
    return topics.filter((t) => {
      const catKey = (t.category ?? '').toLowerCase()
      return !hiddenCategories.has(catKey) && !hiddenStatuses.has(t.status)
    }).length
  }, [topics, hiddenCategories, hiddenStatuses])

  const hasActiveFilters =
    searchQuery.trim().length > 0 || hiddenCategories.size > 0 || hiddenStatuses.size > 0

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of topics) {
      counts[t.status] = (counts[t.status] ?? 0) + 1
    }
    return counts
  }, [topics])

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {/* Row 1: search + actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics…"
              aria-label="Search topics in graph"
              className={cn(
                'w-full h-9 pl-9 pr-8 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors',
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {matchCount !== null && (
            <span className="text-[11px] font-mono text-surface-500 shrink-0">
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </span>
          )}

          {(hiddenCategories.size > 0 || hiddenStatuses.size > 0) && (
            <span className="text-[11px] font-mono text-surface-500 shrink-0">
              {visibleCount}/{topics.length} visible
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={copyShareLink}
              title={copied ? 'Link copied!' : 'Copy link to this view'}
              aria-label={copied ? 'Link copied' : 'Copy link to current graph view'}
              className={cn(
                'flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-mono border transition-colors',
                copied
                  ? 'bg-emerald/10 border-emerald/40 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share view'}</span>
            </button>

            <button
              onClick={resetView}
              title="Reset pan/zoom and restart simulation"
              aria-label="Reset graph view"
              className={cn(
                'flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Row 2: status filter pills */}
        <div
          className={cn(
            'flex items-center gap-1.5 overflow-x-auto',
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
          )}
          aria-label="Filter by status"
        >
          {ALL_STATUSES.filter((s) => (statusCounts[s.id] ?? 0) > 0).map((s) => {
            const isHidden = hiddenStatuses.has(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggleStatus(s.id)}
                aria-pressed={!isHidden}
                aria-label={`${isHidden ? 'Show' : 'Hide'} ${s.label} topics`}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                  isHidden
                    ? 'bg-transparent border-surface-500/30 text-surface-600'
                    : 'border-surface-400/40',
                )}
                style={
                  isHidden
                    ? undefined
                    : {
                        backgroundColor: `${s.color}18`,
                        borderColor: `${s.color}50`,
                        color: s.color,
                      }
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isHidden ? '#71717a' : s.color }}
                  aria-hidden
                />
                {s.label}
                <span className={cn('text-[9px] opacity-60', isHidden && 'opacity-30')}>
                  {statusCounts[s.id] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        {/* Row 3: category filter pills */}
        {categories.length > 0 && (
          <div
            className={cn(
              'flex items-center gap-1.5 overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
            )}
            aria-label="Filter by category"
          >
            {/* Show all / Hide all */}
            <button
              onClick={hiddenCategories.size > 0 ? showAllCategories : hideAllCategories}
              className={cn(
                'shrink-0 px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                hiddenCategories.size === 0
                  ? 'bg-surface-400/30 border-surface-400 text-surface-600 hover:border-surface-500'
                  : 'bg-for-600/20 border-for-500/50 text-for-400 hover:bg-for-600/30',
              )}
            >
              {hiddenCategories.size > 0 ? 'Show all' : 'Hide all'}
            </button>

            <div className="h-4 w-px bg-surface-400 shrink-0" aria-hidden />

            {categories.map((cat) => {
              const key = cat.toLowerCase()
              const isHidden = hiddenCategories.has(key)
              const color = colorForCategory(cat)
              const hexColor = CATEGORY_COLORS[key] ?? '#71717a'
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={!isHidden}
                  aria-label={`${isHidden ? 'Show' : 'Hide'} ${cat} topics`}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                    isHidden
                      ? 'bg-transparent border-surface-500/30 text-surface-600'
                      : 'border-surface-400/40',
                  )}
                  style={
                    isHidden
                      ? undefined
                      : {
                          backgroundColor: `${hexColor}18`,
                          borderColor: `${hexColor}50`,
                          color,
                        }
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: isHidden ? '#71717a' : hexColor }}
                    aria-hidden
                  />
                  {cat}
                  {isHidden && (
                    <span className="opacity-40 ml-0.5 text-[9px]" aria-hidden>✕</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Active filter summary */}
        {hasActiveFilters && (
          <p className="text-[10px] font-mono text-surface-500 px-0.5" role="status" aria-live="polite">
            {[
              searchQuery.trim() ? `Searching "${searchQuery.trim()}"` : null,
              hiddenCategories.size > 0
                ? `${hiddenCategories.size} categor${hiddenCategories.size === 1 ? 'y' : 'ies'} hidden`
                : null,
              hiddenStatuses.size > 0
                ? `${hiddenStatuses.size} status${hiddenStatuses.size === 1 ? '' : 'es'} hidden`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {' · '}
            <button
              onClick={() => {
                setSearchQuery('')
                setHiddenCategories(new Set())
                setHiddenStatuses(new Set())
              }}
              className="text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          </p>
        )}
      </div>

      {/* ── Graph canvas ──────────────────────────────────────────────────── */}
      <TopicGraph
        key={graphKey}
        topics={topics}
        edges={edges}
        searchQuery={searchQuery}
        hiddenCategories={hiddenCategories}
        hiddenStatuses={hiddenStatuses}
        className={cn('flex-1 min-h-0', graphClassName)}
      />

      {/* ── Category legend ───────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div
          className="flex items-center gap-3 flex-wrap px-1 flex-shrink-0"
          aria-label="Category colour legend"
        >
          {categories.map((cat) => {
            const color = colorForCategory(cat)
            const isHidden = hiddenCategories.has(cat.toLowerCase())
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                aria-pressed={!isHidden}
                aria-label={`${isHidden ? 'Show' : 'Hide'} ${cat}`}
                className={cn(
                  'flex items-center gap-1.5 text-[11px] font-mono transition-opacity',
                  isHidden ? 'opacity-25' : 'opacity-75 hover:opacity-100',
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span style={{ color }}>{cat}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
