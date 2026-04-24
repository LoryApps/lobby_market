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
  Layers,
  Loader2,
  Monitor,
  Search,
  Smartphone,
  Tag,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type WidgetSize = 'compact' | 'standard' | 'wide'

const SIZE_CONFIG: Record<WidgetSize, { label: string; width: number; height: number; icon: typeof Monitor }> = {
  compact: { label: 'Compact', width: 320, height: 180, icon: Smartphone },
  standard: { label: 'Standard', width: 480, height: 220, icon: Monitor },
  wide: { label: 'Wide', width: 640, height: 200, icon: Expand },
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function buildIframeCode(topicId: string, size: WidgetSize): string {
  const { width, height } = SIZE_CONFIG[size]
  return `<iframe
  src="https://lobby.market/api/embed/topic/${topicId}"
  width="${width}"
  height="${height}"
  frameborder="0"
  scrolling="no"
  style="border-radius:14px;overflow:hidden;"
  title="Lobby Market — Live Vote Widget"
  loading="lazy"
></iframe>`
}

function buildResizingCode(topicId: string, size: WidgetSize): string {
  const { width } = SIZE_CONFIG[size]
  return `<iframe
  id="lm-widget-${topicId.slice(0, 8)}"
  src="https://lobby.market/api/embed/topic/${topicId}"
  width="${width}"
  height="220"
  frameborder="0"
  scrolling="no"
  style="border-radius:14px;overflow:hidden;"
  title="Lobby Market — Live Vote Widget"
  loading="lazy"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'lobby-embed-resize') {
    var el = document.getElementById('lm-widget-${topicId.slice(0, 8)}');
    if (el) el.height = e.data.height;
  }
});
</script>`
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-HTTPS
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WidgetBuilderPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<TopicResult | null>(null)
  const [selectedSize, setSelectedSize] = useState<WidgetSize>('standard')
  const [showResizing, setShowResizing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
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
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
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
  }, [query])

  function selectTopic(topic: TopicResult) {
    setSelectedTopic(topic)
    setQuery(topic.statement.slice(0, 60))
    setResults([])
  }

  function clearTopic() {
    setSelectedTopic(null)
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  const iframeCode = selectedTopic
    ? (showResizing
        ? buildResizingCode(selectedTopic.id, selectedSize)
        : buildIframeCode(selectedTopic.id, selectedSize))
    : ''

  const embedSrc = selectedTopic
    ? `/api/embed/topic/${selectedTopic.id}`
    : null

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
                Embed a live vote widget on any website. Updates in real-time — no account required to view.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

          {/* Left column: config */}
          <div className="space-y-5">

            {/* Step 1: Topic search */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                  1
                </div>
                <h2 className="text-white font-semibold font-mono">Choose a topic</h2>
              </div>

              {/* Search input */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      if (selectedTopic && e.target.value !== selectedTopic.statement.slice(0, 60)) {
                        setSelectedTopic(null)
                      }
                    }}
                    onFocus={() => {}}
                    placeholder="Search for a debate topic…"
                    aria-label="Search topics"
                    className={cn(
                      'w-full pl-9 pr-9 py-3 rounded-xl text-sm font-mono',
                      'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                      'focus:outline-none focus:ring-1 focus:ring-for-500/50 focus:border-for-500/50 transition-colors'
                    )}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={clearTopic}
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
                  {results.length > 0 && !selectedTopic && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden"
                    >
                      {results.map((topic) => {
                        const forPct = Math.round(topic.blue_pct ?? 50)
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => selectTopic(topic)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
                          >
                            {/* Mini vote bar */}
                            <div className="flex-shrink-0 mt-1 w-1 h-8 rounded-full overflow-hidden bg-surface-300">
                              <div
                                className="w-full bg-for-500 rounded-full"
                                style={{ height: `${forPct}%` }}
                              />
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
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Selected topic pill */}
              <AnimatePresence>
                {selectedTopic && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="mt-3 flex items-start gap-3 p-3 rounded-xl border border-for-500/30 bg-for-500/5"
                  >
                    <div className="flex-shrink-0 mt-0.5 w-1 h-6 rounded-full overflow-hidden bg-surface-300">
                      <div
                        className="w-full bg-for-500 rounded-full"
                        style={{ height: `${Math.round(selectedTopic.blue_pct ?? 50)}%` }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-mono line-clamp-2 leading-snug">
                        {selectedTopic.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {selectedTopic.category && (
                          <span className="text-[10px] text-surface-500 font-mono flex items-center gap-1">
                            <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                            {selectedTopic.category}
                          </span>
                        )}
                        <Badge variant={STATUS_BADGE[selectedTopic.status] ?? 'proposed'} className="text-[10px] px-1.5 py-0">
                          {STATUS_LABEL[selectedTopic.status] ?? selectedTopic.status}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearTopic}
                      aria-label="Remove selected topic"
                      className="flex-shrink-0 text-surface-500 hover:text-white transition-colors mt-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Step 2: Size */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                  2
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
                          : 'bg-surface-200/40 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
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
                  3
                </div>
                <h2 className="text-white font-semibold font-mono">Options</h2>
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  role="checkbox"
                  aria-checked={showResizing}
                  tabIndex={0}
                  onClick={() => setShowResizing((v) => !v)}
                  onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? setShowResizing((v) => !v) : undefined}
                  className={cn(
                    'flex-shrink-0 mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer',
                    showResizing
                      ? 'bg-for-500 border-for-500'
                      : 'bg-surface-200 border-surface-400 group-hover:border-for-500/50'
                  )}
                >
                  {showResizing && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm text-white font-mono">Auto-resize height</p>
                  <p className="text-xs text-surface-500 font-mono mt-0.5">
                    Adds a message listener so the widget auto-adjusts its height. Recommended for blogs and articles.
                  </p>
                </div>
              </label>
            </div>

            {/* Step 4: Copy code */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-for-500 text-white text-xs font-mono font-bold flex-shrink-0">
                    4
                  </div>
                  <h2 className="text-white font-semibold font-mono">Copy embed code</h2>
                </div>
                {selectedTopic && (
                  <CopyButton text={iframeCode} />
                )}
              </div>

              {selectedTopic ? (
                <div className="relative">
                  <pre className={cn(
                    'text-[11px] font-mono text-surface-400 bg-surface-0 border border-surface-300 rounded-xl p-4',
                    'overflow-x-auto whitespace-pre-wrap break-all leading-relaxed'
                  )}>
                    <code>{iframeCode}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-surface-400 text-surface-600 font-mono text-xs">
                  Select a topic above to generate code
                </div>
              )}
            </div>

            {/* API reference callout */}
            <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-4 flex items-start gap-3">
              <Code2 className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs font-mono text-surface-500">
                <span className="text-surface-400">API endpoint: </span>
                <code className="text-for-400">GET /api/embed/topic/{'{id}'}</code>
                {' · '}
                <Link href="/developers#embed" className="text-for-400 hover:text-for-300 underline underline-offset-2">
                  Full docs →
                </Link>
              </div>
            </div>
          </div>

          {/* Right column: live preview */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
                <h2 className="text-white font-semibold font-mono text-sm">Live Preview</h2>
                {selectedTopic && (
                  <span className="ml-auto text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/20 px-2 py-0.5 rounded-full">
                    Live
                  </span>
                )}
              </div>

              {selectedTopic ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${selectedTopic.id}-${selectedSize}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="w-full overflow-x-auto"
                  >
                    {/* Browser chrome mockup */}
                    <div className="rounded-xl border border-surface-300 overflow-hidden bg-surface-0">
                      {/* Browser chrome bar */}
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
                      {/* Preview area */}
                      <div className="p-3 bg-surface-0 overflow-x-auto">
                        <iframe
                          src={embedSrc!}
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
                      {' · '}Updates every 30s
                    </p>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-surface-200/60 border border-surface-300 flex items-center justify-center">
                    <Layers className="h-8 w-8 text-surface-500" />
                  </div>
                  <p className="text-sm font-mono text-surface-500">
                    Search for a topic to see a live preview
                  </p>
                </div>
              )}
            </div>

            {/* Share this widget CTA */}
            {selectedTopic && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-xl border border-surface-300/50 bg-surface-100/50 p-4"
              >
                <p className="text-xs font-mono text-surface-500 mb-2">Direct link to topic</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono text-for-400 bg-surface-0 border border-surface-300 rounded-lg px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    lobby.market/topic/{selectedTopic.id.slice(0, 8)}…
                  </code>
                  <CopyButton text={`https://lobby.market/topic/${selectedTopic.id}`} />
                </div>
                <div className="mt-2 pt-2 border-t border-surface-300/50">
                  <Link
                    href={`/topic/${selectedTopic.id}`}
                    className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    View topic page →
                  </Link>
                </div>
              </motion.div>
            )}
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
                desc: 'Each widget is a single HTML page with inline CSS. No external dependencies, no tracking.',
              },
              {
                num: '02',
                title: 'CDN-cached',
                desc: 'Widget data is cached at the edge for 30 seconds. Low latency everywhere, real-time feel.',
              },
              {
                num: '03',
                title: 'Auto-resize',
                desc: 'With the auto-resize option, the widget posts its height via postMessage. Your page adjusts automatically.',
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
