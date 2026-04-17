'use client'

/**
 * MentionAutocomplete
 *
 * Floating dropdown that appears when a user types @ in any text composer.
 * Fetches matching profiles from /api/users/suggest and lets the user pick
 * one to insert as an @username mention.
 *
 * Usage:
 *   <MentionAutocomplete
 *     query="alice"
 *     selectedIndex={0}
 *     onSelect={(s) => { ... }}
 *     onClose={() => { ... }}
 *   />
 */

import { useEffect, useRef, useState } from 'react'
import { AtSign, Loader2, Shield } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MentionSuggestion {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

interface MentionAutocompleteProps {
  query: string
  selectedIndex: number
  onSelect: (suggestion: MentionSuggestion) => void
  onClose: () => void
  onResultsChange?: (count: number) => void
  onResultsReady?: (results: MentionSuggestion[]) => void
  /** Position: 'above' renders above the cursor (default), 'below' renders below */
  position?: 'above' | 'below'
}

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  senator: 'text-gold',
  moderator: 'text-purple',
  person: 'text-surface-500',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MentionAutocomplete({
  query,
  selectedIndex,
  onSelect,
  onClose,
  onResultsChange,
  onResultsReady,
  position = 'above',
}: MentionAutocompleteProps) {
  const [results, setResults] = useState<MentionSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Stable callback refs so fetch effect doesn't re-run on each render
  const onResultsReadyRef = useRef(onResultsReady)
  const onResultsChangeRef = useRef(onResultsChange)
  useEffect(() => {
    onResultsReadyRef.current = onResultsReady
    onResultsChangeRef.current = onResultsChange
  })

  // Fetch suggestions when query changes (debounced 120ms)
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
        const res = await fetch(
          `/api/users/suggest?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal }
        )
        if (!res.ok) throw new Error('fetch failed')
        const json = (await res.json()) as { results?: MentionSuggestion[] }
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
  }, [query])

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
      <div
        className={cn(
          'absolute left-0 right-0 z-50 rounded-xl border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60 overflow-hidden',
          position === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
        )}
      >
        <div className="px-4 py-3 text-xs font-mono text-surface-500 flex items-center gap-2">
          <AtSign className="h-3 w-3 flex-shrink-0" />
          No users found for &ldquo;@{query}&rdquo;
        </div>
      </div>
    )
  }

  if (results.length === 0) return null

  return (
    <div
      className={cn(
        'absolute left-0 right-0 z-50 rounded-xl border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60 overflow-hidden',
        position === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-300 bg-surface-200/60">
        <AtSign className="h-3 w-3 text-for-400 flex-shrink-0" />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
          Mention user
        </span>
        {loading && <Loader2 className="h-3 w-3 text-surface-500 animate-spin ml-auto" />}
        <span className="text-[10px] font-mono text-surface-600 ml-auto">
          ↑↓ navigate · Enter select · Esc close
        </span>
      </div>

      {/* Results */}
      <ul ref={listRef} role="listbox" aria-label="User suggestions" className="max-h-48 overflow-y-auto">
        {results.map((s, i) => {
          const isActive = i === selectedIndex
          const roleColor = ROLE_COLOR[s.role] ?? 'text-surface-500'

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
                'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
                isActive
                  ? 'bg-for-600/20 border-l-2 border-for-500'
                  : 'hover:bg-surface-200 border-l-2 border-transparent'
              )}
            >
              <Avatar
                src={s.avatar_url}
                fallback={s.display_name || s.username}
                size="xs"
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono font-semibold text-white truncate">
                    @{highlightMatch(s.username, query)}
                  </span>
                  {s.role !== 'person' && (
                    <Shield className={cn('h-3 w-3 flex-shrink-0', roleColor)} aria-hidden />
                  )}
                </div>
                {s.display_name && (
                  <p className="text-[10px] text-surface-500 truncate mt-0.5">{s.display_name}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-for-500/30 text-for-300 rounded-sm not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Utility: detect @mention context at cursor position ─────────────────────

/**
 * Returns the mention query string if the cursor is inside an @word pattern
 * (i.e., `@` followed by word chars with no whitespace yet), or null otherwise.
 */
export function getMentionContext(
  text: string,
  cursorPos: number
): { query: string; startPos: number } | null {
  const before = text.slice(0, cursorPos)
  // Match @ immediately preceded by start-of-string, whitespace, or newline
  const match = before.match(/(?:^|[\s\n])@([A-Za-z0-9_]*)$/)
  if (!match) return null
  // startPos is where the @ character is
  const startPos = before.length - match[1].length - 1
  return { query: match[1], startPos }
}
