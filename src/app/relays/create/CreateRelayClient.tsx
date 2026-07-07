'use client'

/**
 * /relays/create — Start a new Civic Relay
 *
 * Lets an authenticated user start a collaborative argument relay chain:
 *  1. Optionally link to a topic (search or URL param ?topic_id=)
 *  2. Pick a side: FOR (blue) or AGAINST (red)
 *  3. Write the opening leg (30–300 chars)
 *  4. Submit → POST /api/relays → redirected to /relays
 *
 * The relay is then open for up to 4 other contributors to add legs.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  GitMerge,
  Info,
  Loader2,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_CHARS = 30
const MAX_CHARS = 300

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function CreateRelayInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTopicId = searchParams.get('topic_id') ?? null

  // Step 1: topic selection
  const [selectedTopic, setSelectedTopic] = useState<TopicResult | null>(null)
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<TopicResult[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 2: side
  const [side, setSide] = useState<'for' | 'against' | null>(null)

  // Step 3: content
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Auto-load topic from URL param
  useEffect(() => {
    if (!initialTopicId) return
    fetch(`/api/topics/${initialTopicId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.topic) setSelectedTopic(data.topic as TopicResult)
      })
      .catch(() => {})
  }, [initialTopicId])

  // Debounced topic search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (topicQuery.length < 2) {
      setTopicResults([])
      return
    }
    setLoadingTopics(true)
    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(topicQuery)}&type=topics&limit=5`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const data = (await res.json()) as { topics?: TopicResult[] }
        setTopicResults(data.topics ?? [])
      } catch {
        // non-critical
      } finally {
        setLoadingTopics(false)
      }
    }, 300)
  }, [topicQuery])

  function selectTopic(t: TopicResult) {
    setSelectedTopic(t)
    setTopicQuery('')
    setTopicResults([])
  }

  function clearTopic() {
    setSelectedTopic(null)
    setTopicQuery('')
    setTopicResults([])
  }

  // Character count and validation
  const charCount = content.trim().length
  const isValid = side !== null && charCount >= MIN_CHARS && charCount <= MAX_CHARS

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/relays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic?.id ?? null,
          side,
          content: content.trim(),
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Failed to start relay')
      }

      setDone(true)
      setTimeout(() => router.push('/relays'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center px-4"
        >
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald/10 border border-emerald/30">
            <CheckCircle2 className="h-8 w-8 text-emerald" />
          </div>
          <p className="text-xl font-mono font-bold text-white">Relay started!</p>
          <p className="text-sm font-mono text-surface-500 max-w-xs">
            Others can now add their legs. Redirecting to the relay board…
          </p>
          <Loader2 className="h-4 w-4 text-surface-500 animate-spin mt-2" />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/relays"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Back to Relays"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-for-400" />
            <h1 className="text-lg font-mono font-bold text-white">Start a Relay</h1>
          </div>
        </div>

        {/* What is a relay? */}
        <div className="mb-6 rounded-xl bg-surface-100 border border-surface-300 p-4 flex gap-3">
          <Info className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            A <span className="text-white font-semibold">Relay</span> is a collaborative argument chain. You write the first leg — up to 4 other citizens then continue building the case. When all legs are in, the community votes on whether the relay is compelling.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1: Topic (optional) */}
          <fieldset className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <legend className="sr-only">Select a topic</legend>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-for-600/20 border border-for-500/40 text-[10px] font-mono font-bold text-for-400">1</span>
              <p className="text-sm font-mono font-semibold text-white">Link to a topic <span className="text-surface-500 font-normal">(optional)</span></p>
            </div>

            {selectedTopic ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-for-600/10 border border-for-500/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-white leading-snug line-clamp-2">
                    {selectedTopic.statement}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedTopic.category && (
                      <span className={cn('text-[11px] font-mono', CATEGORY_COLOR[selectedTopic.category] ?? 'text-surface-400')}>
                        {selectedTopic.category}
                      </span>
                    )}
                    <Badge variant={STATUS_BADGE[selectedTopic.status] ?? 'proposed'} size="xs" />
                    <span className="text-[11px] font-mono text-surface-500">
                      {Math.round(selectedTopic.blue_pct)}% FOR
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearTopic}
                  aria-label="Remove topic"
                  className="flex-shrink-0 p-1 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  placeholder="Search topics by keyword…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60 transition-colors"
                />
                {loadingTopics && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" aria-hidden="true" />
                )}

                <AnimatePresence>
                  {topicResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
                    >
                      {topicResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTopic(t)}
                          className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-300 transition-colors border-b border-surface-300 last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-white leading-snug line-clamp-2">
                              {t.statement}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {t.category && (
                                <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[t.category] ?? 'text-surface-400')}>
                                  {t.category}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-surface-500">
                                {Math.round(t.blue_pct)}% FOR
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </fieldset>

          {/* Step 2: Side */}
          <fieldset className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <legend className="sr-only">Choose your side</legend>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-for-600/20 border border-for-500/40 text-[10px] font-mono font-bold text-for-400">2</span>
              <p className="text-sm font-mono font-semibold text-white">Choose your side</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* FOR */}
              <button
                type="button"
                onClick={() => setSide('for')}
                aria-pressed={side === 'for'}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all duration-150 font-mono',
                  side === 'for'
                    ? 'border-for-500 bg-for-600/20 text-for-300 ring-2 ring-for-500/30'
                    : 'border-surface-300 bg-surface-200 text-surface-400 hover:border-for-500/50 hover:text-for-400'
                )}
              >
                <ThumbsUp className={cn('h-6 w-6', side === 'for' ? 'text-for-400' : 'text-surface-500')} aria-hidden="true" />
                <span className="text-sm font-bold">FOR</span>
                <span className="text-[11px] text-center leading-tight opacity-70">
                  Build the case in favour
                </span>
              </button>

              {/* AGAINST */}
              <button
                type="button"
                onClick={() => setSide('against')}
                aria-pressed={side === 'against'}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all duration-150 font-mono',
                  side === 'against'
                    ? 'border-against-500 bg-against-600/20 text-against-300 ring-2 ring-against-500/30'
                    : 'border-surface-300 bg-surface-200 text-surface-400 hover:border-against-500/50 hover:text-against-400'
                )}
              >
                <ThumbsDown className={cn('h-6 w-6', side === 'against' ? 'text-against-400' : 'text-surface-500')} aria-hidden="true" />
                <span className="text-sm font-bold">AGAINST</span>
                <span className="text-[11px] text-center leading-tight opacity-70">
                  Build the case against
                </span>
              </button>
            </div>
          </fieldset>

          {/* Step 3: Opening leg */}
          <fieldset className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <legend className="sr-only">Write the opening leg</legend>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-for-600/20 border border-for-500/40 text-[10px] font-mono font-bold text-for-400">3</span>
              <p className="text-sm font-mono font-semibold text-white">Write the opening leg</p>
            </div>

            <p className="text-xs font-mono text-surface-500">
              Start the argument chain. Make it specific and substantive — others will continue from where you leave off.
            </p>

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={MAX_CHARS}
                placeholder={
                  side === 'for'
                    ? 'The strongest reason this position is correct is…'
                    : side === 'against'
                    ? 'This proposal fails because…'
                    : 'Choose a side above, then write your opening argument…'
                }
                disabled={!side}
                aria-label="Opening leg content"
                aria-describedby="char-count"
                className={cn(
                  'w-full p-3.5 rounded-xl border text-sm font-mono text-white placeholder-surface-500 resize-none',
                  'bg-surface-200 focus:outline-none transition-colors',
                  !side
                    ? 'border-surface-300 opacity-50 cursor-not-allowed'
                    : side === 'for'
                    ? 'border-surface-300 focus:border-for-500/60'
                    : 'border-surface-300 focus:border-against-500/60'
                )}
              />

              {/* Character counter */}
              <div
                id="char-count"
                aria-live="polite"
                className={cn(
                  'absolute bottom-2.5 right-3 text-[11px] font-mono transition-colors',
                  charCount < MIN_CHARS
                    ? 'text-surface-600'
                    : charCount > MAX_CHARS - 20
                    ? 'text-against-400'
                    : 'text-surface-500'
                )}
              >
                {charCount}/{MAX_CHARS}
              </div>
            </div>

            {charCount > 0 && charCount < MIN_CHARS && (
              <p className="text-[11px] font-mono text-against-400">
                {MIN_CHARS - charCount} more characters needed (minimum {MIN_CHARS})
              </p>
            )}
          </fieldset>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="alert"
                className="text-sm font-mono text-against-400 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || submitting}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm transition-all duration-150',
              isValid && !submitting
                ? side === 'for'
                  ? 'bg-for-600 hover:bg-for-500 text-white shadow-lg shadow-for-600/20'
                  : 'bg-against-600 hover:bg-against-500 text-white shadow-lg shadow-against-600/20'
                : 'bg-surface-300 text-surface-500 cursor-not-allowed'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Starting relay…
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4" aria-hidden="true" />
                Start Relay
              </>
            )}
          </button>

        </form>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Exported component (wrapped in Suspense for useSearchParams) ─────────────

export function CreateRelayClient() {
  return (
    <Suspense fallback={null}>
      <CreateRelayInner />
    </Suspense>
  )
}
