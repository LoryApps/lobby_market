'use client'

/**
 * LawGraphView
 *
 * Full-page client wrapper for LawGraph.  Manages:
 *  - Live search input  (highlights matching nodes, dims others)
 *  - Category filter pills (click to show/hide each category)
 *  - "Reset view" button to re-center the simulation
 *
 * Props come from the server-rendered page that prefetches laws + links.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import { LawGraph, CATEGORY_COLORS, colorForCategory } from '@/components/law/LawGraph'
import type { Law, LawLink } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LawGraphViewProps {
  laws: Law[]
  links: LawLink[]
  currentLawId?: string
  /** Pass className through to the canvas container */
  graphClassName?: string
}

export function LawGraphView({
  laws,
  links,
  currentLawId,
  graphClassName,
}: LawGraphViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [graphKey, setGraphKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const matchCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return laws.filter((l) => l.statement.toLowerCase().includes(q)).length
  }, [searchQuery, laws])

  const visibleCount = useMemo(() => {
    if (hiddenCategories.size === 0) return laws.length
    return laws.filter((l) => !hiddenCategories.has((l.category ?? '').toLowerCase())).length
  }, [laws, hiddenCategories])

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Row 1: search + reset */}
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

          {/* Reset view */}
          <button
            onClick={resetView}
            title="Reset pan/zoom and restart simulation"
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-mono',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors shrink-0',
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
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

            <div className="h-4 w-px bg-surface-400 shrink-0" aria-hidden />

            {categories.map((cat) => {
              const key = cat.toLowerCase()
              const isHidden = hiddenCategories.has(key)
              const color = colorForCategory(cat)
              const hexInCss = CATEGORY_COLORS[key] ?? '#71717a'

              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
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
                  aria-pressed={!isHidden}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: isHidden ? '#71717a' : hexInCss }}
                  />
                  {cat}
                  {isHidden && <span className="opacity-40 ml-0.5 text-[9px]">✕</span>}
                </button>
              )
            })}
          </div>
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
        <div className="flex items-center gap-3 flex-wrap px-1">
          {categories.map((cat) => {
            const color = colorForCategory(cat)
            const isHidden = hiddenCategories.has(cat.toLowerCase())
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  'flex items-center gap-1.5 text-[11px] font-mono transition-opacity',
                  isHidden ? 'opacity-30' : 'opacity-80 hover:opacity-100',
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
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
