'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Expand,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Monitor,
  Search,
  Smartphone,
  Tag,
  User,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetType = 'topic' | 'argument' | 'profile'
type WidgetSize = 'compact' | 'standard' | 'wide'

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface ArgumentResult {
  id: string
  content: string
  side: string
  upvotes: number
  topic?: { id: string; statement: string } | null
  author?: { username: string; display_name: string | null } | null
}

interface PersonResult {
  id: string
  username: string
  display_name: string | null
  role: string
  clout: number
}

type SearchItem = TopicResult | ArgumentResult | PersonResult

// ─── Widget type definitions ──────────────────────────────────────────────────

const WIDGET_TYPES: {
  id: WidgetType
  label: string
  icon: typeof FileText
  description: string
  searchTab: string
  searchPlaceholder: string
  updateInterval: string
}[] = [
  {
    id: 'topic',
    label: 'Topic',
    icon: FileText,
    description: 'Live vote bar with FOR/AGAINST split, status badge, and vote count.',
    searchTab: 'topics',
    searchPlaceholder: 'Search topics — "climate", "AI", "tax reform"…',
    updateInterval: '30s',
  },
  {
    id: 'argument',
    label: 'Argument',
    icon: MessageSquare,
    description: 'Argument quote card with side indicator, text, and upvote count.',
    searchTab: 'arguments',
    searchPlaceholder: 'Search arguments by keyword…',
    updateInterval: '60s',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    description: 'Civic profile summary with stats, role badge, and bio.',
    searchTab: 'people',
    searchPlaceholder: 'Search by username or display name…',
    updateInterval: '2m',
  },
]

// ─── Size config ──────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<WidgetSize, { label: string; width: number; height: number; icon: typeof Monitor }> = {
  compact: { label: 'Compact', width: 320, height: 180, icon: Smartphone },
  standard: { label: 'Standard', width: 480, height: 220, icon: Monitor },
  wide: { label: 'Wide', width: 640, height: 200, icon: Expand },
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Code builders ────────────────────────────────────────────────────────────

function getEmbedSrc(type: WidgetType, item: SearchItem): string {
  if (type === 'topic') return `/api/embed/topic/${(item as TopicResult).id}`
  if (type === 'argument') return `/api/embed/argument/${(item as ArgumentResult).id}`
  return `/api/embed/profile/${(item as PersonResult).username}`
}

function buildIframeCode(type: WidgetType, item: SearchItem, size: WidgetSize): string {
  const { width, height } = SIZE_CONFIG[size]
  const src = `https://lobby.market${getEmbedSrc(type, item)}`
  const titles: Record<WidgetType, string> = {
    topic: 'Lobby Market — Live Vote Widget',
    argument: 'Lobby Market — Argument Card',
    profile: 'Lobby Market — Civic Profile',
  }
  return `<iframe
  src="${src}"
  width="${width}"
  height="${height}"
  frameborder="0"
  scrolling="no"
  style="border-radius:14px;overflow:hidden;"
  title="${titles[type]}"
  loading="lazy"
></iframe>`
}

function buildResizingCode(type: WidgetType, item: SearchItem, size: WidgetSize): string {
  const { width } = SIZE_CONFIG[size]
  const src = `https://lobby.market${getEmbedSrc(type, item)}`
  const shortId =
    type === 'profile'
      ? (item as PersonResult).username.slice(0, 8)
      : (item as { id: string }).id.slice(0, 8)
  const titles: Record<WidgetType, string> = {
    topic: 'Lobby Market — Live Vote Widget',
    argument: 'Lobby Market — Argument Card',
    profile: 'Lobby Market — Civic Profile',
  }
  return `<iframe
  id="lm-widget-${shortId}"
  src="${src}"
  width="${width}"
  height="220"
  frameborder="0"
  scrolling="no"
  style="border-radius:14px;overflow:hidden;"
  title="${titles[type]}"
  loading="lazy"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'lobby-embed-resize') {
    var el = document.getElementById('lm-widget-${shortId}');
    if (el) el.height = e.data.height;
  }
});
</script>`
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-all',
        copied
          ? 'bg-emerald/20 text-emerald border border-emerald/30'
          : 'bg-surface-300/60 text-surface-400 border border-surface-400/30 hover:bg-surface-300 hover:text-white',
        className,
      )}
    >
      {copied ? (
        <><Check className="h-3 w-3" />Copied!</>
      ) : (
        <><Copy className="h-3 w-3" />Copy</>
      )}
    </button>
  )
}

// ─── Search result rows ───────────────────────────────────────────────────────

function TopicRow({ topic, onSelect }: { topic: TopicResult; onSelect: () => void }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
    >
      <div className="flex-shrink-0 mt-1 w-1 h-8 rounded-full overflow-hidden bg-surface-300">
        <div className="w-full bg-for-500 rounded-full" style={{ height: `${forPct}%` }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono line-clamp-2 leading-snug group-hover:text-for-200 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {topic.category && (
            <span className="text-[10px] text-surface-500 font-mono">{topic.category}</span>
          )}
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px] px-1.5 py-0">
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          <span className="text-[10px] text-surface-600 font-mono">
            {forPct}% FOR · {fmtVotes(topic.total_votes)} votes
          </span>
        </div>
      </div>
    </button>
  )
}

function ArgumentRow({ arg, onSelect }: { arg: ArgumentResult; onSelect: () => void }) {
  const isFor = arg.side === 'blue' || arg.side === 'for'
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
    >
      <div
        className={cn(
          'flex-shrink-0 mt-1 w-1 h-8 rounded-full',
          isFor ? 'bg-for-500' : 'bg-against-500',
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono line-clamp-2 leading-snug group-hover:text-for-200 transition-colors">
          {arg.content}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
              isFor
                ? 'bg-for-500/15 text-for-400 border-for-500/30'
                : 'bg-against-500/15 text-against-400 border-against-500/30',
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          <span className="text-[10px] text-surface-500 font-mono">{arg.upvotes} upvotes</span>
        </div>
      </div>
    </button>
  )
}

function PersonRow({ person, onSelect }: { person: PersonResult; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
    >
      <div className="flex-shrink-0 mt-1 h-8 w-8 rounded-full bg-surface-300 flex items-center justify-center">
        <User className="h-4 w-4 text-surface-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono group-hover:text-for-200 transition-colors">
          {person.display_name ?? person.username}
        </p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">
          @{person.username} · {fmtVotes(person.clout)} clout
        </p>
      </div>
    </button>
  )
}

// ─── Selected item pill ───────────────────────────────────────────────────────

function SelectedPill({
  type,
  item,
  onClear,
}: {
  type: WidgetType
  item: SearchItem
  onClear: () => void
}) {
  const label =
    type === 'topic'
      ? (item as TopicResult).statement.slice(0, 80)
      : type === 'argument'
        ? (item as ArgumentResult).content.slice(0, 80)
        : `@${(item as PersonResult).username}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="mt-3 flex items-start gap-3 p-3 rounded-xl border border-for-500/30 bg-for-500/5"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono line-clamp-2 leading-snug">{label}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Remove selection"
        className="flex-shrink-0 text-surface-500 hover:text-white transition-colors mt-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

// ─── Direct link section ──────────────────────────────────────────────────────

function DirectLink({ type, item }: { type: WidgetType; item: SearchItem }) {
  const href =
    type === 'topic'
      ? `https://lobby.market/topic/${(item as TopicResult).id}`
      : type === 'argument'
        ? `https://lobby.market/topic/${(item as ArgumentResult).topic?.id ?? ''}`
        : `https://lobby.market/profile/${(item as PersonResult).username}`
  const display =
    type === 'topic'
      ? `lobby.market/topic/${(item as TopicResult).id.slice(0, 8)}…`
      : type === 'argument'
        ? 'lobby.market/topic/…'
        : `lobby.market/profile/${(item as PersonResult).username}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-xl border border-surface-300/50 bg-surface-100/50 p-4"
    >
      <p className="text-xs font-mono text-surface-500 mb-2">Direct page link</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] font-mono text-for-400 bg-surface-0 border border-surface-300 rounded-lg px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">
          {display}
        </code>
        <CopyButton text={href} />
      </div>
      <div className="mt-2 pt-2 border-t border-surface-300/50">
        <Link
          href={
            type === 'topic'
              ? `/topic/${(item as TopicResult).id}`
              : type === 'argument'
                ? `/topic/${(item as ArgumentResult).topic?.id ?? ''}`
                : `/profile/${(item as PersonResult).username}`
          }
          className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          View full page →
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WidgetBuilderPage() {
  const [widgetType, setWidgetType] = useState<WidgetType>('topic')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchItem | null>(null)
  const [selectedSize, setSelectedSize] = useState<WidgetSize>('standard')
  const [showResizing, setShowResizing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeType = WIDGET_TYPES.find((t) => t.id === widgetType)!

  // ── Clear when type changes ────────────────────────────────────────────────
  useEffect(() => {
    setQuery('')
    setResults([])
    setSelected(null)
  }, [widgetType])

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&tab=${activeType.searchTab}`,
        )
        if (!res.ok) throw new Error('search failed')
        const data = await res.json()
        setResults((data.results ?? []).slice(0, 8))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeType.searchTab])

  function selectItem(item: SearchItem) {
    setSelected(item)
    const label =
      widgetType === 'topic'
        ? (item as TopicResult).statement.slice(0, 60)
        : widgetType === 'argument'
          ? (item as ArgumentResult).content.slice(0, 60)
          : `@${(item as PersonResult).username}`
    setQuery(label)
    setResults([])
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  const embedSrc = selected ? getEmbedSrc(widgetType, selected) : null
  const iframeCode = selected
    ? showResizing
      ? buildResizingCode(widgetType, selected, selectedSize)
      : buildIframeCode(widgetType, selected, selectedSize)
    : ''

  const { width: previewW, height: previewH } = SIZE_CONFIG[selectedSize]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-32 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white text-sm font-mono mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Developers
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl bg-for-500/10 border border-for-500/20">
              <Layers className="h-6 w-6 text-for-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white font-mono tracking-tight">
                Widget Builder
              </h1>
              <p className="text-surface-500 font-mono text-sm mt-1">
                Embed live civic debate widgets on any website — topics, arguments, and profiles.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

          {/* Left: config */}
          <div className="space-y-5">

            {/* Step 0: Widget type */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                  1
                </div>
                <h2 className="text-white font-semibold font-mono">Choose widget type</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {WIDGET_TYPES.map((t) => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setWidgetType(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                        widgetType === t.id
                          ? 'bg-for-500/15 border-for-500/50 text-for-300'
                          : 'bg-surface-200/40 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <span className="text-xs font-mono font-semibold">{t.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-xs font-mono text-surface-500">{activeType.description}</p>
            </div>

            {/* Step 1: Search */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                  2
                </div>
                <h2 className="text-white font-semibold font-mono">
                  {widgetType === 'topic'
                    ? 'Choose a topic'
                    : widgetType === 'argument'
                      ? 'Choose an argument'
                      : 'Choose a profile'}
                </h2>
              </div>

              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      if (selected) setSelected(null)
                    }}
                    placeholder={activeType.searchPlaceholder}
                    aria-label={`Search ${widgetType}s`}
                    className={cn(
                      'w-full pl-9 pr-9 py-3 rounded-xl text-sm font-mono',
                      'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                      'focus:outline-none focus:ring-1 focus:ring-for-500/50 focus:border-for-500/50 transition-colors',
                    )}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      aria-label="Clear"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
                    >
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Results dropdown */}
                <AnimatePresence>
                  {results.length > 0 && !selected && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden"
                    >
                      {widgetType === 'topic' &&
                        (results as TopicResult[]).map((item) => (
                          <TopicRow key={item.id} topic={item} onSelect={() => selectItem(item)} />
                        ))}
                      {widgetType === 'argument' &&
                        (results as ArgumentResult[]).map((item) => (
                          <ArgumentRow key={item.id} arg={item} onSelect={() => selectItem(item)} />
                        ))}
                      {widgetType === 'profile' &&
                        (results as PersonResult[]).map((item) => (
                          <PersonRow key={item.id} person={item} onSelect={() => selectItem(item)} />
                        ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {selected && (
                  <SelectedPill type={widgetType} item={selected} onClear={clearSelection} />
                )}
              </AnimatePresence>
            </div>

            {/* Step 2: Size */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                  3
                </div>
                <h2 className="text-white font-semibold font-mono">Choose a size</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(SIZE_CONFIG) as [WidgetSize, typeof SIZE_CONFIG[WidgetSize]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedSize(key)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center',
                        selectedSize === key
                          ? 'bg-for-500/15 border-for-500/50 text-for-300'
                          : 'bg-surface-200/40 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-mono font-semibold">{cfg.label}</p>
                        <p className="text-[10px] font-mono opacity-70">{cfg.width}×{cfg.height}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 3: Options */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                  4
                </div>
                <h2 className="text-white font-semibold font-mono">Options</h2>
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  role="checkbox"
                  aria-checked={showResizing}
                  tabIndex={0}
                  onClick={() => setShowResizing((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setShowResizing((v) => !v)
                  }}
                  className={cn(
                    'flex-shrink-0 mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer',
                    showResizing
                      ? 'bg-for-500 border-for-500'
                      : 'bg-surface-200 border-surface-400 group-hover:border-for-500/50',
                  )}
                >
                  {showResizing && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm text-white font-mono">Auto-resize height</p>
                  <p className="text-xs text-surface-500 font-mono mt-0.5">
                    Adds a postMessage listener so the widget auto-adjusts its height.
                  </p>
                </div>
              </label>
            </div>

            {/* Step 4: Copy code */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                    5
                  </div>
                  <h2 className="text-white font-semibold font-mono">Copy embed code</h2>
                </div>
                {selected && <CopyButton text={iframeCode} />}
              </div>

              {selected ? (
                <pre className={cn(
                  'text-[11px] font-mono text-surface-400 bg-surface-0 border border-surface-300 rounded-xl p-4',
                  'overflow-x-auto whitespace-pre-wrap break-all leading-relaxed',
                )}>
                  <code>{iframeCode}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-surface-400 text-surface-600 font-mono text-xs">
                  Select a {widgetType} above to generate code
                </div>
              )}
            </div>

            {/* API reference */}
            <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-4 flex items-start gap-3">
              <Code2 className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs font-mono text-surface-500 space-y-1">
                <div>
                  <span className="text-surface-400">Topics: </span>
                  <code className="text-for-400">GET /api/embed/topic/{'{id}'}</code>
                </div>
                <div>
                  <span className="text-surface-400">Arguments: </span>
                  <code className="text-for-400">GET /api/embed/argument/{'{id}'}</code>
                </div>
                <div>
                  <span className="text-surface-400">Profiles: </span>
                  <code className="text-for-400">GET /api/embed/profile/{'{username}'}</code>
                </div>
                <div className="pt-1">
                  <Link href="/developers#embed" className="text-for-400 hover:text-for-300 underline underline-offset-2">
                    Full docs →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
                <h2 className="text-white font-semibold font-mono text-sm">Live Preview</h2>
                {selected && (
                  <span className="ml-auto text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/20 px-2 py-0.5 rounded-full">
                    Live
                  </span>
                )}
              </div>

              {selected && embedSrc ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${embedSrc}-${selectedSize}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="w-full overflow-x-auto"
                  >
                    <div className="rounded-xl border border-surface-300 overflow-hidden bg-surface-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface-200/80 border-b border-surface-300">
                        <div className="flex gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-against-500/40" />
                          <div className="h-2.5 w-2.5 rounded-full bg-gold/40" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald/40" />
                        </div>
                        <div className="flex-1 mx-2 h-4 rounded bg-surface-300/50 text-[9px] font-mono text-surface-600 flex items-center px-2 overflow-hidden">
                          yoursite.com/article
                        </div>
                      </div>
                      <div className="p-3 bg-surface-0 overflow-x-auto">
                        <iframe
                          src={embedSrc}
                          width={Math.min(previewW, 380)}
                          height={previewH}
                          style={{
                            border: 'none',
                            borderRadius: '14px',
                            display: 'block',
                            maxWidth: '100%',
                          }}
                          title="Widget preview"
                          loading="lazy"
                          scrolling="no"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] font-mono text-surface-600 mt-2 text-center">
                      {SIZE_CONFIG[selectedSize].width}×{SIZE_CONFIG[selectedSize].height}px
                      {' · '}Updates every {activeType.updateInterval}
                    </p>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-surface-200/60 border border-surface-300 flex items-center justify-center">
                    <Layers className="h-8 w-8 text-surface-500" />
                  </div>
                  <p className="text-sm font-mono text-surface-500">
                    Search for a {widgetType} to see a live preview
                  </p>
                </div>
              )}
            </div>

            {selected && <DirectLink type={widgetType} item={selected} />}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-10 rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <h2 className="text-white font-semibold font-mono mb-5 flex items-center gap-2">
            <Code2 className="h-4 w-4 text-surface-400" />
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                num: '01',
                title: 'Self-contained HTML',
                desc: 'Each widget is a single HTML page with inline CSS. No external dependencies, no tracking, no account required to view.',
              },
              {
                num: '02',
                title: 'CDN-cached',
                desc: 'Widget data is cached at the edge. Topics update every 30s, arguments every 60s, profiles every 2m.',
              },
              {
                num: '03',
                title: 'Auto-resize',
                desc: 'The widget posts its height via postMessage. Enable the option above to include a listener that adjusts the iframe automatically.',
              },
            ].map((item) => (
              <div key={item.num} className="flex gap-3">
                <div className="flex-shrink-0 font-mono text-xs text-surface-600 w-6 mt-0.5">{item.num}</div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white mb-1">{item.title}</p>
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
