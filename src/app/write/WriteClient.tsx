'use client'

/**
 * /write — Argument Composer
 *
 * A focused, distraction-free environment for crafting a high-quality
 * argument on any active debate topic. Three-step flow:
 *   1. Search and select a topic
 *   2. Choose your side (FOR / AGAINST)
 *   3. Write the argument (10–500 chars) with optional source URL
 *
 * On submit: posts to /api/topics/[id]/arguments.
 * Save draft: posts to /api/arguments/drafts (PUT upsert).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileEdit,
  Gavel,
  Loader2,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
  BookmarkCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SearchTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type Step = 'topic' | 'side' | 'write' | 'done'
type Side = 'blue' | 'red'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MIN_CHARS = 10
const MAX_CHARS = 500
const AUTOSAVE_DEBOUNCE_MS = 1500

const STATUS_WRITABLE = new Set(['active', 'proposed', 'voting'])

// ─── Category badge colour map ─────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold border-gold/30 bg-gold/10',
  Politics: 'text-for-400 border-for-500/30 bg-for-500/10',
  Technology: 'text-purple border-purple/30 bg-purple/10',
  Science: 'text-emerald border-emerald/30 bg-emerald/10',
  Ethics: 'text-against-400 border-against-500/30 bg-against-500/10',
  Philosophy: 'text-surface-400 border-surface-400/30 bg-surface-400/10',
  Culture: 'text-gold border-gold/30 bg-gold/10',
  Health: 'text-emerald border-emerald/30 bg-emerald/10',
  Environment: 'text-emerald border-emerald/30 bg-emerald/10',
  Education: 'text-purple border-purple/30 bg-purple/10',
}

function catBadgeClass(category: string | null): string {
  return category ? (CAT_COLOR[category] ?? 'text-surface-500 border-surface-500/30 bg-surface-500/10') : 'text-surface-500 border-surface-500/30 bg-surface-500/10'
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  if (s === 'active') return 'Active'
  if (s === 'proposed') return 'Proposed'
  if (s === 'voting') return 'Final Vote'
  return s
}

// ─── Step indicators ───────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'topic', label: 'Topic' },
  { key: 'side', label: 'Side' },
  { key: 'write', label: 'Write' },
]

function StepBar({ current }: { current: Step }) {
  const active = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-1.5 mb-6" role="list" aria-label="Steps">
      {STEPS.map((s, i) => {
        const done = i < active
        const here = i === active
        return (
          <div key={s.key} className="flex items-center gap-1.5" role="listitem">
            <div
              className={cn(
                'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-mono font-bold transition-all duration-300',
                done
                  ? 'bg-for-600 text-white'
                  : here
                    ? 'bg-surface-300 border border-for-500 text-for-400'
                    : 'bg-surface-300 text-surface-500'
              )}
              aria-current={here ? 'step' : undefined}
            >
              {done ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-mono transition-colors duration-300',
                here ? 'text-white' : done ? 'text-for-400' : 'text-surface-600'
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-px w-6 transition-colors duration-500',
                  i < active ? 'bg-for-600' : 'bg-surface-300'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Topic search ──────────────────────────────────────────────────────────────

function TopicSearch({
  onSelect,
  prefillId,
}: {
  onSelect: (t: SearchTopic) => void
  prefillId?: string | null
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchTopic[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Prefill: if a topicId is passed via query params, fetch it directly
  useEffect(() => {
    if (!prefillId) return
    fetch(`/api/topics/${prefillId}`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.topic as SearchTopic
        if (t && STATUS_WRITABLE.has(t.status)) {
          onSelect(t)
        }
      })
      .catch(() => {})
  }, [prefillId, onSelect])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      // Show popular active topics when no query
      setLoading(true)
      try {
        const res = await fetch('/api/topics/batch?status=active&limit=12')
        if (res.ok) {
          const data = await res.json()
          setResults((data.topics ?? []).filter((t: SearchTopic) => STATUS_WRITABLE.has(t.status)))
        }
      } catch {}
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&tab=topics&status=active`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResults(
        (data.results ?? []).filter((t: SearchTopic) => STATUS_WRITABLE.has(t.status))
      )
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Load popular topics on mount
  useEffect(() => {
    search('')
  }, [search])

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics to argue about…"
          aria-label="Search topics"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-200 border border-surface-300/60 text-white placeholder:text-surface-500 text-sm focus:outline-none focus:border-for-500/60 transition-colors"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-200 animate-pulse" />
          ))
        ) : results.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-6 font-mono">
            No active topics found. Try a different search.
          </p>
        ) : (
          results.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full text-left p-3 rounded-xl bg-surface-200 border border-surface-300/40 hover:border-for-500/40 hover:bg-surface-200/80 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white group-hover:text-for-200 transition-colors line-clamp-2 leading-snug font-medium">
                    {t.statement}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {t.category && (
                      <span
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                          catBadgeClass(t.category)
                        )}
                      >
                        {t.category}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-surface-500">
                      {statusLabel(t.status)} · {t.total_votes.toLocaleString()} votes
                    </span>
                    <span className="text-[10px] font-mono text-for-500">
                      {Math.round(t.blue_pct)}% FOR
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 flex-shrink-0 mt-0.5 transition-colors" aria-hidden="true" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Side picker ───────────────────────────────────────────────────────────────

function SidePicker({
  topic,
  onPick,
  onBack,
}: {
  topic: SearchTopic
  onPick: (side: Side) => void
  onBack: () => void
}) {
  const forPct = Math.round(topic.blue_pct)
  const agPct = 100 - forPct

  return (
    <div>
      {/* Topic recap */}
      <div className="mb-6 p-4 rounded-xl bg-surface-200 border border-surface-300/40">
        <p className="text-sm text-white font-medium leading-snug mb-2">{topic.statement}</p>
        <div className="flex items-center gap-3">
          {topic.category && (
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                catBadgeClass(topic.category)
              )}
            >
              {topic.category}
            </span>
          )}
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
            {forPct}% FOR
          </span>
        </div>
      </div>

      <p className="text-sm text-surface-400 mb-4 font-mono">Choose your position:</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onPick('blue')}
          className={cn(
            'flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all group',
            'bg-for-500/10 border-for-500/30 hover:bg-for-500/20 hover:border-for-500/60',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
          )}
          aria-label="Argue FOR this topic"
        >
          <ThumbsUp className="h-6 w-6 text-for-400 group-hover:text-for-300 transition-colors" aria-hidden="true" />
          <span className="text-sm font-mono font-bold text-for-400 group-hover:text-for-300 transition-colors">
            FOR
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {forPct}% agree
          </span>
        </button>

        <button
          onClick={() => onPick('red')}
          className={cn(
            'flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all group',
            'bg-against-500/10 border-against-500/30 hover:bg-against-500/20 hover:border-against-500/60',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-against-500/50'
          )}
          aria-label="Argue AGAINST this topic"
        >
          <ThumbsDown className="h-6 w-6 text-against-400 group-hover:text-against-300 transition-colors" aria-hidden="true" />
          <span className="text-sm font-mono font-bold text-against-400 group-hover:text-against-300 transition-colors">
            AGAINST
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {agPct}% disagree
          </span>
        </button>
      </div>

      <button
        onClick={onBack}
        className="mt-5 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" />
        Change topic
      </button>
    </div>
  )
}

// ─── Writer ────────────────────────────────────────────────────────────────────

function Writer({
  topic,
  side,
  onSubmit,
  onBack,
  onSaveDraft,
}: {
  topic: SearchTopic
  side: Side
  onSubmit: (content: string, sourceUrl: string) => Promise<void>
  onBack: () => void
  onSaveDraft: (content: string) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const remaining = MAX_CHARS - content.length
  const isShort = content.trim().length < MIN_CHARS
  const isOver = content.length > MAX_CHARS
  const canSubmit = !isShort && !isOver && !submitting
  const isFor = side === 'blue'

  // Auto-save draft as user types
  useEffect(() => {
    if (content.trim().length < MIN_CHARS) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      try {
        await onSaveDraft(content)
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 2000)
      } catch {}
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [content, onSaveDraft])

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(content.trim(), sourceUrl.trim())
    } catch (e) {
      setError((e as Error).message ?? 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveDraft() {
    if (content.trim().length < MIN_CHARS) return
    setSavingDraft(true)
    try {
      await onSaveDraft(content)
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2000)
    } catch {}
    setSavingDraft(false)
  }

  return (
    <div>
      {/* Side + topic recap */}
      <div
        className={cn(
          'mb-4 p-3 rounded-xl border',
          isFor
            ? 'bg-for-500/10 border-for-500/25'
            : 'bg-against-500/10 border-against-500/25'
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" aria-hidden="true" />
          )}
          <span
            className={cn(
              'text-[10px] font-mono font-bold uppercase tracking-wider',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            Arguing {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
        <p className="text-xs text-surface-300 line-clamp-2 leading-relaxed">{topic.statement}</p>
      </div>

      {/* Main textarea */}
      <div className="relative mb-3">
        <textarea
          ref={textRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isFor
              ? 'Make the strongest case FOR this position. Be specific, cite evidence, anticipate objections…'
              : 'Make the strongest case AGAINST this position. Be specific, cite evidence, anticipate objections…'
          }
          rows={7}
          maxLength={MAX_CHARS + 50}
          aria-label="Argument content"
          aria-describedby="char-counter"
          className={cn(
            'w-full rounded-xl bg-surface-200 border text-sm text-white',
            'placeholder:text-surface-500 px-4 py-3 focus:outline-none',
            'transition-colors leading-relaxed resize-none',
            isOver
              ? 'border-against-500/60 focus:border-against-400'
              : isFor
                ? 'border-surface-300/60 focus:border-for-500/50'
                : 'border-surface-300/60 focus:border-against-500/50'
          )}
        />
        <div
          id="char-counter"
          className={cn(
            'absolute bottom-3 right-3 text-[10px] font-mono pointer-events-none',
            isOver
              ? 'text-against-400'
              : remaining <= 50
                ? 'text-gold'
                : 'text-surface-500'
          )}
          aria-live="polite"
          aria-label={`${remaining} characters remaining`}
        >
          {remaining}
        </div>
      </div>

      {/* Source URL */}
      <div className="mb-5">
        <div className="relative">
          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (optional) — cite your evidence"
            aria-label="Source URL"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300/50 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-400/60 transition-colors"
          />
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 p-3 rounded-xl bg-against-500/10 border border-against-500/25 text-xs text-against-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold',
            'transition-all focus:outline-none focus-visible:ring-2',
            isFor
              ? 'bg-for-600 hover:bg-for-500 text-white focus-visible:ring-for-500/50'
              : 'bg-against-600 hover:bg-against-500 text-white focus-visible:ring-against-500/50',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-disabled={!canSubmit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {submitting ? 'Submitting…' : 'Submit Argument'}
        </button>

        <button
          onClick={handleSaveDraft}
          disabled={savingDraft || isShort}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-mono border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-500/40"
          aria-label="Save as draft"
        >
          {savingDraft ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : draftSaved ? (
            <BookmarkCheck className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
          ) : (
            <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {draftSaved ? 'Saved!' : 'Save draft'}
        </button>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Change side
        </button>
        {isShort && content.length > 0 && (
          <p className="text-[10px] font-mono text-surface-600">
            {MIN_CHARS - content.trim().length} more character{MIN_CHARS - content.trim().length !== 1 ? 's' : ''} to go
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Success state ─────────────────────────────────────────────────────────────

function SuccessState({
  topic,
  side,
  argumentId,
  onWriteAnother,
}: {
  topic: SearchTopic
  side: Side
  argumentId: string | null
  onWriteAnother: () => void
}) {
  const isFor = side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-6"
    >
      <div
        className={cn(
          'inline-flex items-center justify-center h-14 w-14 rounded-full mb-4',
          isFor ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400'
        )}
      >
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-bold text-white mb-2">Argument submitted!</h2>
      <p className="text-sm text-surface-400 mb-1 max-w-xs mx-auto leading-relaxed">
        Your {isFor ? 'FOR' : 'AGAINST'} argument has been added to the debate.
      </p>
      <p className="text-xs text-surface-500 mb-6 line-clamp-2 max-w-xs mx-auto">
        "{topic.statement}"
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
        >
          <Gavel className="h-4 w-4 text-surface-400" aria-hidden="true" />
          View the debate
        </Link>

        {argumentId && (
          <Link
            href={`/arguments/${argumentId}`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-sm font-mono text-surface-300 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            My argument
          </Link>
        )}

        <button
          onClick={onWriteAnother}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600/20 border border-for-500/30 text-sm font-mono text-for-400 hover:bg-for-600/30 hover:text-white transition-colors"
        >
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          Write another
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function WriteClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillTopicId = searchParams.get('topic')

  const [step, setStep] = useState<Step>('topic')
  const [topic, setTopic] = useState<SearchTopic | null>(null)
  const [side, setSide] = useState<Side | null>(null)
  const [argumentId, setArgumentId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  function selectTopic(t: SearchTopic) {
    setTopic(t)
    setStep('side')
  }

  function pickSide(s: Side) {
    setSide(s)
    setStep('write')
  }

  async function submitArgument(content: string, sourceUrl: string) {
    if (!topic) throw new Error('No topic selected')
    const body: Record<string, string> = {
      side: side === 'blue' ? 'blue' : 'red',
      content,
    }
    if (sourceUrl) body.source_url = sourceUrl

    const res = await fetch(`/api/topics/${topic.id}/arguments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Failed to submit argument')
    }

    const data = await res.json()
    setArgumentId(data.argument?.id ?? data.id ?? null)
    setStep('done')
  }

  async function saveDraft(content: string) {
    if (!topic || !side) return
    await fetch('/api/arguments/drafts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic_id: topic.id,
        side,
        content,
      }),
    })
  }

  function reset() {
    setStep('topic')
    setTopic(null)
    setSide(null)
    setArgumentId(null)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (step === 'topic' ? router.back() : step === 'side' ? setStep('topic') : step === 'write' ? setStep('side') : reset())}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">Argue</h1>
            <p className="text-xs text-surface-500 mt-0.5">Craft a compelling argument</p>
          </div>

          {/* Link to drafts */}
          <Link
            href="/arguments/drafts"
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="View my drafts"
          >
            <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
            Drafts
          </Link>
        </div>

        {/* Steps (hidden in done state) */}
        {step !== 'done' && <StepBar current={step} />}

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 'topic' && (
            <motion.div
              key="topic"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-sm font-mono font-semibold text-surface-400 mb-3 uppercase tracking-wider">
                Select a topic
              </h2>
              <TopicSearch onSelect={selectTopic} prefillId={prefillTopicId} />
            </motion.div>
          )}

          {step === 'side' && topic && (
            <motion.div
              key="side"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-sm font-mono font-semibold text-surface-400 mb-3 uppercase tracking-wider">
                Choose your side
              </h2>
              <SidePicker
                topic={topic}
                onPick={pickSide}
                onBack={() => setStep('topic')}
              />
            </motion.div>
          )}

          {step === 'write' && topic && side && (
            <motion.div
              key="write"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-sm font-mono font-semibold text-surface-400 mb-3 uppercase tracking-wider">
                Write your argument
              </h2>
              <Writer
                topic={topic}
                side={side}
                onSubmit={submitArgument}
                onBack={() => setStep('side')}
                onSaveDraft={saveDraft}
              />
            </motion.div>
          )}

          {step === 'done' && topic && side && (
            <motion.div
              key="done"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <SuccessState
                topic={topic}
                side={side}
                argumentId={argumentId}
                onWriteAnother={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guest prompt */}
        {!userId && step === 'write' && (
          <div className="mt-4 p-3 rounded-xl bg-surface-200 border border-surface-300/40 text-center">
            <p className="text-xs text-surface-400 font-mono">
              <Link href="/login" className="text-for-400 hover:text-for-300 underline">
                Sign in
              </Link>{' '}
              to submit your argument and have it count in the debate.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
