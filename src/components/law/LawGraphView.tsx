'use client'

/**
 * LawGraphView
 *
 * Full-page client wrapper for LawGraph.  Manages:
 *  - Live search input  (highlights matching nodes, dims others)
 *  - Category filter pills (click to show/hide each category)
 *  - "Reset view" button to re-center the simulation
 *  - URL state encoding — filters are reflected in ?q= and ?hide= params
 *    so views can be bookmarked and shared.
 *  - "Copy link" button to copy the current filtered view URL to clipboard.
 *
 * Props come from the server-rendered page that prefetches laws + links.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, Copy, RotateCcw, Search, X } from 'lucide-react'
import type { Law, LawLink } from '@/lib/supabase/types'
import { GRAPH_CATEGORY_COLORS as CATEGORY_COLORS, graphColorForCategory as colorForCategory } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'

// Lazy-load the D3-powered canvas — d3-force only loads when the law graph is visited.
const LawGraph = dynamic(
  () => import('@/components/law/LawGraph').then((m) => m.LawGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-surface-500 text-sm">Loading graph…</div>
      </div>
    ),
  }
)

interface LawGraphViewProps {
  laws: Law[]
  links: LawLink[]
  currentLawId?: string
  /** Pass className through to the canvas container */
  graphClassName?: string
}

// ─── URL param helpers ────────────────────────────────────────────────────────

function readParams(): { q: string; hide: Set<string> } {
  if (typeof window === 'undefined') return { q: '', hide: new Set() }
  const sp = new URLSearchParams(window.location.search)
  const q = sp.get('q') ?? ''
  const hideStr = sp.get('hide') ?? ''
  const hide = new Set(
    hideStr
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
  return { q, hide }
}

function writeParams(q: string, hidden: Set<string>) {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)

  if (q) {
    sp.set('q', q)
  } else {
    sp.delete('q')
  }

  if (hidden.size > 0) {
    sp.set('hide', Array.from(hidden).join(','))
  } else {
    sp.delete('hide')
  }

  const newSearch = sp.toString()
  const newUrl =
    window.location.pathname + (newSearch ? `?${newSearch}` : '')

  // Use replaceState so filter changes don't add browser history entries
  window.history.replaceState(null, '', newUrl)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LawGraphView({
  laws,
  links,
  currentLawId,
  graphClassName,
}: LawGraphViewProps) {
  // Initialise from URL params (only on first render — window may not exist during SSR)
  const [initialised, setInitialised] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [graphKey, setGraphKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Read URL params on first client render
  useEffect(() => {
    const { q, hide } = readParams()
    if (q) setSearchQuery(q)
    if (hide.size > 0) setHiddenCategories(hide)
    setInitialised(true)
  }, [])

  // Sync URL params whenever filters change (but only after initial read)
  useEffect(() => {
    if (!initialised) return
    writeParams(searchQuery, hiddenCategories)
  }, [searchQuery, hiddenCategories, initialised])

  // Derive sorted list of categories present in the data
  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const law of laws) {
      if (law.category) seen.add(law.category)
    }
    return Array.from(seen).sort()
  }, [laws])

  const toggleCategory = useCallback((cat: string) => {
    const key = cat.toLowerCase()
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const showAll = useCallback(() => {
    setHiddenCategories(new Set())
  }, [])

  const hideAll = useCallback(() => {
    setHiddenCategories(new Set(categories.map((c) => c.toLowerCase())))
  }, [categories])

  /** Re-mount the graph to reset pan/zoom and restart the simulation */
  const resetView = useCallback(() => {
    setGraphKey((k) => k + 1)
  }, [])

  /** Copy the current filtered view URL to clipboard */
  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  const matchCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return laws.filter((l) => l.statement.toLowerCase().includes(q)).length
  }, [searchQuery, laws])

  const visibleCount = useMemo(() => {
    if (hiddenCategories.size === 0) return laws.length
    return laws.filter((l) => !hiddenCategories.has((l.category ?? '').toLowerCase())).length
  }, [laws, hiddenCategories])

  const hasActiveFilters = searchQuery.trim().length > 0 || hiddenCategories.size > 0

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Row 1: search + actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search laws…"
              className={cn(
                'w-full h-9 pl-9 pr-8 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors',
              )}
              aria-label="Search laws in graph"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Match count */}
          {matchCount !== null && (
            <span className="text-[11px] font-mono text-surface-500 shrink-0">
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </span>
          )}

          {/* Visible count */}
          {hiddenCategories.size > 0 && (
            <span className="text-[11px] font-mono text-surface-500 shrink-0">
              {visibleCount}/{laws.length} visible
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* Share current view */}
            <button
              onClick={copyShareLink}
              title={copied ? 'Link copied!' : 'Copy link to this view'}
              aria-label={copied ? 'Link copied' : 'Copy link to current graph view'}
              className={cn(
                'flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-mono',
                'border transition-colors',
                copied
                  ? 'bg-emerald/10 border-emerald/40 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {copied ? 'Copied!' : hasActiveFilters ? 'Share view' : 'Share'}
              </span>
            </button>

            {/* Reset view */}
            <button
              onClick={resetView}
              title="Reset pan/zoom and restart simulation"
              aria-label="Reset graph pan and zoom"
              className={cn(
                'flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Row 2: category filter pills */}
        {categories.length > 0 && (
          <div
            className={cn(
              'flex items-center gap-1.5 overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
            )}
          >
            {/* Show all / Hide all */}
            <button
              onClick={hiddenCategories.size > 0 ? showAll : hideAll}
              className={cn(
                'shrink-0 px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                hiddenCategories.size === 0
                  ? 'bg-surface-400/30 border-surface-400 text-surface-600 hover:border-surface-500'
                  : 'bg-for-600/20 border-for-500/50 text-for-400 hover:bg-for-600/30',
              )}
            >
              {hiddenCategories.size > 0 ? 'Show all' : 'Hide all'}
            </button>

            <div className="h-4 w-px bg-surface-400 shrink-0" aria-hidden="true" />

            {categories.map((cat) => {
              const key = cat.toLowerCase()
              const isHidden = hiddenCategories.has(key)
              const color = colorForCategory(cat)
              const hexInCss = CATEGORY_COLORS[key] ?? '#71717a'

              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={!isHidden}
                  aria-label={`${isHidden ? 'Show' : 'Hide'} ${cat} laws`}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-mono border transition-colors',
                    isHidden
                      ? 'bg-transparent border-surface-500/30 text-surface-600 hover:border-surface-400'
                      : 'border-surface-400/40 text-surface-700 hover:border-surface-300',
                  )}
                  style={
                    isHidden
                      ? undefined
                      : {
                          backgroundColor: `${hexInCss}18`,
                          borderColor: `${hexInCss}50`,
                          color,
                        }
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: isHidden ? '#71717a' : hexInCss }}
                    aria-hidden="true"
                  />
                  {cat}
                  {isHidden && <span className="opacity-40 ml-0.5 text-[9px]" aria-hidden="true">✕</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Active filter summary — shown when URL has encoded state */}
        {hasActiveFilters && (
          <p className="text-[10px] font-mono text-surface-500 px-0.5" role="status" aria-live="polite">
            {[
              searchQuery.trim() ? `Searching "${searchQuery.trim()}"` : null,
              hiddenCategories.size > 0
                ? `${hiddenCategories.size} categor${hiddenCategories.size === 1 ? 'y' : 'ies'} hidden`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {' · '}
            <button
              onClick={() => {
                setSearchQuery('')
                setHiddenCategories(new Set())
              }}
              className="text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors"
            >
              Clear all filters
            </button>
          </p>
        )}
      </div>

      {/* ── Graph canvas ─────────────────────────────────────────────────── */}
      <LawGraph
        key={graphKey}
        laws={laws}
        links={links}
        currentLawId={currentLawId}
        searchQuery={searchQuery}
        hiddenCategories={hiddenCategories}
        className={cn('flex-1', graphClassName)}
      />

      {/* ── Category legend ───────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-1" aria-label="Category legend">
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
                  isHidden ? 'opacity-30' : 'opacity-80 hover:opacity-100',
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
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
