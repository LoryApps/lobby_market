'use client'

/**
 * Global ⌘K / Ctrl+K command palette.
 *
 * Triggered by:
 *   - macOS : ⌘ + K
 *   - Windows/Linux : Ctrl + K
 *   - Click on the search icon in TopBar when in "palette" mode
 *
 * Features:
 *   - Static quick-nav links when no query is entered
 *   - Debounced full-text search via /api/search (topics, laws, people)
 *   - Arrow-key + Enter keyboard navigation
 *   - Framer Motion slide-in / fade-out animation
 *   - Closes on Escape, backdrop click, or after navigation
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  Bookmark,
  Flame,
  LayoutGrid,
  Loader2,
  Mic,
  PenSquare,
  Scale,
  Search,
  Trophy,
  User,
  Users,
  X,
  Building2,
  Landmark,
  FileText,
  TrendingUp,
  Bell,
  Settings,
  HelpCircle,
  Zap,
  GitFork,
  Calendar,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickLink {
  type: 'link'
  id: string
  label: string
  sublabel?: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  iconBg?: string
}

interface TopicResult {
  type: 'topic'
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface LawResult {
  type: 'law'
  id: string
  statement: string
  category: string | null
}

interface PersonResult {
  type: 'person'
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

type PaletteItem = QuickLink | TopicResult | LawResult | PersonResult

// ─── Quick-nav links shown when no query is typed ─────────────────────────────

const QUICK_LINKS: QuickLink[] = [
  {
    type: 'link',
    id: 'feed',
    label: 'Feed',
    sublabel: 'Live topic feed',
    href: '/',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'floor',
    label: 'The Floor',
    sublabel: 'Watch consensus form in real-time',
    href: '/floor',
    icon: Landmark,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'city',
    label: 'City View',
    sublabel: 'Explore the user city',
    href: '/city',
    icon: Building2,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'debates',
    label: 'Debates',
    sublabel: 'Live debate arena',
    href: '/debate',
    icon: Mic,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'leaderboard',
    label: 'Leaderboard',
    sublabel: 'Top voters and lawmakers',
    href: '/leaderboard',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics',
    label: 'Analytics',
    sublabel: 'Your voting patterns and stats',
    href: '/analytics',
    icon: BarChart2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'activity',
    label: 'Activity',
    sublabel: 'What\'s happening in the Lobby',
    href: '/activity',
    icon: Activity,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'pulse',
    label: 'Community Pulse',
    sublabel: 'Top FOR/AGAINST arguments from active debates',
    href: '/pulse',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'split',
    label: 'The Split',
    sublabel: 'Most contested topics — vote where it matters',
    href: '/split',
    icon: GitFork,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'categories',
    label: 'Categories',
    sublabel: 'Browse topics by category',
    href: '/topic/categories',
    icon: LayoutGrid,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'coalitions',
    label: 'Coalitions',
    sublabel: 'Join or create an alliance',
    href: '/coalitions',
    icon: Users,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'create-topic',
    label: 'Propose a Topic',
    sublabel: 'Submit a new topic for debate',
    href: '/topic/create',
    icon: PenSquare,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'profile',
    label: 'My Profile',
    sublabel: 'View your public profile',
    href: '/profile/me',
    icon: User,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'saved',
    label: 'Saved Topics',
    sublabel: 'Your bookmarked topics',
    href: '/saved',
    icon: Bookmark,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'notifications',
    label: 'Notifications',
    sublabel: 'Recent alerts and updates',
    href: '/notifications',
    icon: Bell,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'settings',
    label: 'Settings',
    sublabel: 'Preferences and account',
    href: '/settings',
    icon: Settings,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'digest',
    label: 'Weekly Digest',
    sublabel: 'Laws, debates, and top voices this week',
    href: '/digest',
    icon: Calendar,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
]

// Status label / color helpers for topic results
const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500',
  active: 'text-emerald',
  voting: 'text-purple',
  law: 'text-gold',
  failed: 'text-against-400',
}

// ─── Single result row ────────────────────────────────────────────────────────

function ResultRow({
  item,
  isActive,
  onSelect,
}: {
  item: PaletteItem
  isActive: boolean
  onSelect: (item: PaletteItem) => void
}) {
  const baseClass = cn(
    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
    isActive ? 'bg-for-500/15' : 'hover:bg-surface-200'
  )

  if (item.type === 'link') {
    const Icon = item.icon
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => onSelect(item)}
        tabIndex={-1}
      >
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
            item.iconBg
          )}
        >
          <Icon className={cn('h-4 w-4', item.iconColor)} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white leading-tight">
            {item.label}
          </span>
          {item.sublabel && (
            <span className="block text-xs text-surface-500 leading-tight mt-0.5">
              {item.sublabel}
            </span>
          )}
        </span>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
          ↵
        </span>
      </button>
    )
  }

  if (item.type === 'topic') {
    const forPct = Math.round(item.blue_pct)
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => onSelect(item)}
        tabIndex={-1}
      >
        <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10">
          <FileText className="h-4 w-4 text-for-400" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white leading-tight line-clamp-1">
            {item.statement}
          </span>
          <span className="flex items-center gap-2 mt-0.5">
            {item.category && (
              <span className="text-xs text-surface-500">{item.category}</span>
            )}
            <span
              className={cn(
                'text-[10px] font-mono uppercase',
                STATUS_COLOR[item.status] ?? 'text-surface-500'
              )}
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {forPct}% For
            </span>
          </span>
        </span>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
          ↵
        </span>
      </button>
    )
  }

  if (item.type === 'law') {
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => onSelect(item)}
        tabIndex={-1}
      >
        <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10">
          <Scale className="h-4 w-4 text-gold" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white leading-tight line-clamp-1">
            {item.statement}
          </span>
          <span className="flex items-center gap-2 mt-0.5">
            {item.category && (
              <span className="text-xs text-surface-500">{item.category}</span>
            )}
            <span className="text-[10px] font-mono text-gold uppercase">LAW</span>
          </span>
        </span>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
          ↵
        </span>
      </button>
    )
  }

  // person
  return (
    <button
      type="button"
      className={baseClass}
      onClick={() => onSelect(item)}
      tabIndex={-1}
    >
      <Avatar
        src={item.avatar_url}
        fallback={item.display_name || item.username}
        size="sm"
        className="flex-shrink-0"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-white leading-tight">
          {item.display_name || item.username}
        </span>
        <span className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-surface-500">@{item.username}</span>
          <span className="text-[10px] font-mono text-gold">
            <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" />
            {item.clout.toLocaleString()}
          </span>
        </span>
      </span>
      <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
        ↵
      </span>
    </button>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-2 pb-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
        {label}
      </span>
    </div>
  )
}

// ─── The palette itself ───────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PaletteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived flat list of all navigable items
  const items: PaletteItem[] = query.trim().length < 2 ? QUICK_LINKS : results

  // Auto-focus input when palette opens; reset state on close
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Fire all three tabs in parallel
      const [topicsRes, lawsRes, peopleRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=topics`),
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=laws`),
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=people`),
      ])

      const [topicsData, lawsData, peopleData] = await Promise.all([
        topicsRes.ok ? topicsRes.json() : { results: [] },
        lawsRes.ok ? lawsRes.json() : { results: [] },
        peopleRes.ok ? peopleRes.json() : { results: [] },
      ])

      const combined: PaletteItem[] = [
        ...(topicsData.results ?? []).slice(0, 4).map(
          (r: Omit<TopicResult, 'type'>) => ({ ...r, type: 'topic' as const })
        ),
        ...(lawsData.results ?? []).slice(0, 3).map(
          (r: Omit<LawResult, 'type'>) => ({ ...r, type: 'law' as const })
        ),
        ...(peopleData.results ?? []).slice(0, 3).map(
          (r: Omit<PersonResult, 'type'>) => ({ ...r, type: 'person' as const })
        ),
      ]

      setResults(combined)
      setActiveIndex(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  // Navigate to the selected item
  const navigateTo = useCallback(
    (item: PaletteItem) => {
      onClose()
      let href = '/'

      if (item.type === 'link') href = item.href
      else if (item.type === 'topic') href = `/topic/${item.id}`
      else if (item.type === 'law') href = `/law/${item.id}`
      else if (item.type === 'person') href = `/profile/${item.username}`

      router.push(href)
    },
    [onClose, router]
  )

  // Keyboard: ↑ ↓ Enter Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIndex]
        if (item) navigateTo(item)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [items, activeIndex, navigateTo, onClose]
  )

  // Scroll active item into view
  useEffect(() => {
    const list = scrollRef.current
    if (!list) return
    const el = list.querySelectorAll('[data-palette-item]')[activeIndex] as
      | HTMLElement
      | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Group labels when showing search results
  const topicsInResults = results.filter((r) => r.type === 'topic')
  const lawsInResults = results.filter((r) => r.type === 'law')
  const peopleInResults = results.filter((r) => r.type === 'person')

  // Build labelled sections for search results
  const sections: Array<{ label: string; items: PaletteItem[] }> = []
  if (topicsInResults.length > 0)
    sections.push({ label: 'Topics', items: topicsInResults })
  if (lawsInResults.length > 0)
    sections.push({ label: 'Laws', items: lawsInResults })
  if (peopleInResults.length > 0)
    sections.push({ label: 'People', items: peopleInResults })

  // Flat index offset for highlighting within grouped sections
  function globalIndex(sectionIdx: number, rowIdx: number): number {
    let offset = 0
    for (let s = 0; s < sectionIdx; s++) offset += sections[s].items.length
    return offset + rowIdx
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9995] flex items-start justify-center px-4 pt-[12vh] pb-8"
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-label="Command palette"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="command-palette-panel"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative z-10 w-full max-w-lg',
              'rounded-2xl overflow-hidden',
              'bg-surface-100 border border-surface-300',
              'shadow-2xl shadow-black/60'
            )}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-300">
              {loading ? (
                <Loader2 className="h-4 w-4 text-surface-500 animate-spin flex-shrink-0" />
              ) : (
                <Search className="h-4 w-4 text-surface-500 flex-shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search topics, laws, people…"
                className={cn(
                  'flex-1 bg-transparent text-sm text-white placeholder:text-surface-500',
                  'focus:outline-none'
                )}
                autoComplete="off"
                spellCheck={false}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setActiveIndex(0)
                    inputRef.current?.focus()
                  }}
                  className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                  aria-label="Clear search"
                  tabIndex={-1}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex flex-shrink-0 items-center justify-center px-1.5 py-0.5 rounded-md bg-surface-200 border border-surface-400 text-[10px] font-mono text-surface-500">
                esc
              </kbd>
            </div>

            {/* Results area */}
            <div
              ref={scrollRef}
              className="overflow-y-auto overscroll-contain max-h-[min(420px,60dvh)] py-1"
            >
              {/* No query: show quick links */}
              {query.trim().length < 2 && (
                <>
                  <SectionHeader label="Quick Navigation" />
                  {QUICK_LINKS.map((link, i) => (
                    <div key={link.id} data-palette-item>
                      <ResultRow
                        item={link}
                        isActive={i === activeIndex}
                        onSelect={navigateTo}
                      />
                    </div>
                  ))}
                </>
              )}

              {/* With query: show grouped results */}
              {query.trim().length >= 2 && !loading && sections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
                  <Search className="h-6 w-6 text-surface-500" />
                  <p className="text-sm text-surface-500">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      router.push(
                        `/search?q=${encodeURIComponent(query.trim())}`
                      )
                    }}
                    className="mt-1 text-xs text-for-400 hover:text-for-300 transition-colors underline-offset-2 hover:underline"
                  >
                    Open full search page
                  </button>
                </div>
              )}

              {query.trim().length >= 2 && sections.length > 0 &&
                sections.map((section, si) => (
                  <div key={section.label}>
                    <SectionHeader label={section.label} />
                    {section.items.map((item, ri) => (
                      <div key={item.id} data-palette-item>
                        <ResultRow
                          item={item}
                          isActive={globalIndex(si, ri) === activeIndex}
                          onSelect={navigateTo}
                        />
                      </div>
                    ))}
                  </div>
                ))}

              {/* Quick link to full search page */}
              {query.trim().length >= 2 && sections.length > 0 && (
                <div className="px-4 py-2 mt-1 border-t border-surface-300">
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      router.push(
                        `/search?q=${encodeURIComponent(query.trim())}`
                      )
                    }}
                    className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    See all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-surface-300 bg-surface-50">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">↑↓</kbd>
                navigate
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">↵</kbd>
                open
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">esc</kbd>
                close
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    import('@/lib/hooks/useKeyboardShortcuts').then(({ openKeyboardShortcuts }) => {
                      openKeyboardShortcuts()
                    })
                  }}
                  className="flex items-center gap-1.5 text-surface-600 hover:text-surface-700 transition-colors"
                  aria-label="Show keyboard shortcuts"
                >
                  <HelpCircle className="h-3 w-3" />
                  <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">
                    ?
                  </kbd>
                  shortcuts
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
