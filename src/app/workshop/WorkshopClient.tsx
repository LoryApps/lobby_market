'use client'

/**
 * /workshop — Civic Argument Workshop
 *
 * A four-step guided argument builder that scaffolds the full argument
 * creation process from blank page to published debate contribution:
 *
 *   Step 1 — TOPIC   : Search and select a topic + choose FOR/AGAINST
 *   Step 2 — ANGLES  : Pick from 3 AI-generated argument hooks (or skip)
 *   Step 3 — DRAFT   : Write the argument with a live char counter
 *   Step 4 — REVIEW  : AI quality feedback, then publish to the topic
 *
 * Distinct from:
 *   /coach   — critiques a single draft you already have
 *   /argue   — generates starters for one topic (no guided flow)
 *   /spar    — live AI debate opponent
 *   /topic/create — creates new topics, not arguments
 *
 * The Workshop ties existing AI tools (/api/topics/[id]/argument-starters,
 * /api/arguments/critique, /api/topics/[id]/arguments) into a unified
 * step-by-step creation experience.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ArgumentStarter, ArgumentStartersResponse } from '@/app/api/topics/[id]/argument-starters/route'
import type { CritiqueResponse } from '@/app/api/arguments/critique/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'for' | 'against'
type Step = 1 | 2 | 3 | 4 | 5

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface WorkshopState {
  topic: TopicResult | null
  side: Side | null
  chosenAngle: ArgumentStarter | null
  draft: string
  critique: CritiqueResponse | null
  publishedId: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 500
const MIN_CHARS = 20
const STORAGE_KEY = 'lm_workshop_v1'

const STEP_META: Array<{ label: string; short: string }> = [
  { label: 'Choose Topic', short: 'Topic' },
  { label: 'Pick Angle',   short: 'Angle' },
  { label: 'Draft',        short: 'Draft' },
  { label: 'Review & Publish', short: 'Publish' },
]

const GRADE_CONFIG: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-emerald/10',       border: 'border-emerald/40',      text: 'text-emerald' },
  B: { bg: 'bg-for-500/10',       border: 'border-for-500/40',      text: 'text-for-400' },
  C: { bg: 'bg-purple/10',        border: 'border-purple/40',       text: 'text-purple' },
  D: { bg: 'bg-gold/10',          border: 'border-gold/40',         text: 'text-gold' },
  F: { bg: 'bg-against-500/10',   border: 'border-against-500/40',  text: 'text-against-400' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  if (current === 5) return null
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEP_META.map((s, i) => {
        const n = (i + 1) as Step
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-1">
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full text-xs font-mono font-bold transition-all',
                done  && 'bg-emerald/20 border border-emerald/50 text-emerald',
                active && 'bg-for-500/20 border border-for-500/50 text-for-400',
                !done && !active && 'bg-surface-200 border border-surface-300 text-surface-500',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span className={cn(
              'hidden sm:block text-xs font-mono transition-colors',
              active ? 'text-for-400' : 'text-surface-500',
            )}>
              {s.short}
            </span>
            {i < STEP_META.length - 1 && (
              <div className={cn(
                'h-px w-4 sm:w-6 mx-1 transition-colors',
                done ? 'bg-emerald/50' : 'bg-surface-300',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Topic selector ───────────────────────────────────────────────────

function Step1Topic({
  onSelect,
  initialTopic,
}: {
  onSelect: (topic: TopicResult, side: Side) => void
  initialTopic: TopicResult | null
}) {
  const searchParams = useSearchParams()
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<TopicResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected]   = useState<TopicResult | null>(initialTopic)
  const [side, setSide]           = useState<Side | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pre-fill from URL param ?topic=<id>
  useEffect(() => {
    const tid = searchParams?.get('topic')
    if (tid && !initialTopic) {
      fetch(`/api/topics/browse?id=${tid}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.topics?.[0]) setSelected(data.topics[0] as TopicResult)
        })
        .catch(() => {})
    }
    inputRef.current?.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
        if (!res.ok) throw new Error('search failed')
        const data = await res.json()
        setResults((data.results ?? []).slice(0, 6) as TopicResult[])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [query])

  const canContinue = selected && side

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-mono font-bold text-white mb-1">Choose a topic</h2>
        <p className="text-sm font-mono text-surface-500">
          Search for any active topic on the platform, then pick your side.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search civic topics…"
          className={cn(
            'w-full pl-10 pr-4 py-3 rounded-xl bg-surface-200 border border-surface-300',
            'text-sm font-mono text-white placeholder:text-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-for-500/30 focus:border-for-500/50',
            'transition-colors',
          )}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {results.length > 0 && !selected && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSelected(t); setQuery(''); setResults([]) }}
                className={cn(
                  'w-full text-left p-3 rounded-xl bg-surface-200 border border-surface-300',
                  'hover:border-for-500/40 hover:bg-surface-300/60 transition-all',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-mono text-white leading-relaxed">{t.statement}</p>
                  <span className={cn(
                    'flex-shrink-0 text-[10px] font-mono font-bold uppercase',
                    CATEGORY_COLORS[t.category ?? ''] ?? 'text-surface-500',
                  )}>
                    {t.category ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <Badge
                    variant={
                      t.status === 'law' ? 'law'
                        : t.status === 'active' ? 'active'
                        : t.status === 'voting' ? 'active'
                        : t.status === 'failed' ? 'failed'
                        : 'proposed'
                    }
                  >
                    {t.status}
                  </Badge>
                  <span className="text-[11px] font-mono text-surface-500">
                    {t.total_votes.toLocaleString()} votes
                  </span>
                  <span className="text-[11px] font-mono text-for-400">
                    {Math.round(t.blue_pct)}% for
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected topic */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-surface-100 border border-for-500/30 p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-mono text-white leading-relaxed">{selected.statement}</p>
              <button
                type="button"
                onClick={() => { setSelected(null); setSide(null) }}
                aria-label="Change topic"
                className="flex-shrink-0 p-1 rounded-lg hover:bg-surface-200 transition-colors"
              >
                <X className="h-4 w-4 text-surface-500" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Badge
                variant={
                  selected.status === 'law' ? 'law'
                    : selected.status === 'active' || selected.status === 'voting' ? 'active'
                    : selected.status === 'failed' ? 'failed'
                    : 'proposed'
                }
              >
                {selected.status}
              </Badge>
              {selected.category && (
                <span className={cn('text-xs font-mono font-bold', CATEGORY_COLORS[selected.category] ?? 'text-surface-500')}>
                  {selected.category}
                </span>
              )}
              <span className="text-xs font-mono text-surface-500 ml-auto">
                {Math.round(selected.blue_pct)}% for · {selected.total_votes.toLocaleString()} votes
              </span>
            </div>

            {/* Side picker */}
            <p className="text-xs font-mono text-surface-500 mb-3">Which side will you argue?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSide('for')}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left',
                  side === 'for'
                    ? 'bg-for-600/20 border-for-500/60 shadow-lg shadow-for-500/10'
                    : 'bg-surface-200 border-surface-300 hover:border-for-500/30',
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 transition-colors',
                  side === 'for' ? 'bg-for-500/20' : 'bg-surface-300',
                )}>
                  <ThumbsUp className={cn('h-4 w-4', side === 'for' ? 'text-for-400' : 'text-surface-500')} />
                </div>
                <div>
                  <p className={cn('text-sm font-mono font-bold', side === 'for' ? 'text-for-400' : 'text-white')}>
                    FOR
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">Argue in favour</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSide('against')}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left',
                  side === 'against'
                    ? 'bg-against-600/20 border-against-500/60 shadow-lg shadow-against-500/10'
                    : 'bg-surface-200 border-surface-300 hover:border-against-500/30',
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 transition-colors',
                  side === 'against' ? 'bg-against-500/20' : 'bg-surface-300',
                )}>
                  <ThumbsDown className={cn('h-4 w-4', side === 'against' ? 'text-against-400' : 'text-surface-500')} />
                </div>
                <div>
                  <p className={cn('text-sm font-mono font-bold', side === 'against' ? 'text-against-400' : 'text-white')}>
                    AGAINST
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">Argue against</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end pt-2">
        <Button
          variant="for"
          size="md"
          disabled={!canContinue}
          onClick={() => onSelect(selected!, side!)}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Angle picker ─────────────────────────────────────────────────────

function Step2Angles({
  topic,
  side,
  onPick,
  onSkip,
  onBack,
}: {
  topic: TopicResult
  side: Side
  onPick: (starter: ArgumentStarter) => void
  onSkip: () => void
  onBack: () => void
}) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [starters, setStarters] = useState<ArgumentStarter[]>([])
  const [chosen, setChosen]     = useState<number | null>(null)

  const fetchStarters = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topic.id}/argument-starters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      })
      const data: ArgumentStartersResponse = await res.json()
      if (data.unavailable) {
        setStarters([])
        setError('AI unavailable')
        return
      }
      const list = side === 'for' ? data.starters.for : data.starters.against
      setStarters(list ?? [])
    } catch {
      setError('Could not load argument angles.')
    } finally {
      setLoading(false)
    }
  }, [topic.id, side])

  useEffect(() => { fetchStarters() }, [fetchStarters])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-mono font-bold text-white mb-1">Pick your angle</h2>
        <p className="text-sm font-mono text-surface-500">
          Choose one of these AI-generated argument hooks to base your draft on, or skip to write freely.
        </p>
      </div>

      {/* Topic context */}
      <div className="rounded-xl bg-surface-200 border border-surface-300 px-4 py-3">
        <p className="text-xs font-mono text-surface-500 mb-1">
          Arguing <span className={cn('font-bold', side === 'for' ? 'text-for-400' : 'text-against-400')}>
            {side === 'for' ? 'FOR' : 'AGAINST'}
          </span>
        </p>
        <p className="text-sm font-mono text-white leading-relaxed">{topic.statement}</p>
      </div>

      {/* Angles */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2 animate-pulse">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-6 text-center">
          <Bot className="h-8 w-8 text-surface-500 mx-auto mb-2" />
          <p className="text-sm font-mono text-surface-500 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchStarters}
            className="flex items-center gap-2 mx-auto text-sm font-mono text-for-400 hover:text-for-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {starters.map((s, i) => (
            <motion.button
              key={i}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setChosen(i)}
              className={cn(
                'w-full text-left p-4 rounded-xl border transition-all',
                chosen === i
                  ? (side === 'for'
                      ? 'bg-for-600/10 border-for-500/50'
                      : 'bg-against-600/10 border-against-500/50')
                  : 'bg-surface-100 border-surface-300 hover:border-surface-400',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-mono font-bold flex-shrink-0 mt-0.5 transition-colors',
                  chosen === i
                    ? (side === 'for' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400')
                    : 'bg-surface-300 text-surface-500',
                )}>
                  {chosen === i ? <Check className="h-3 w-3" /> : (i + 1)}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    'text-[11px] font-mono font-bold uppercase mb-1 tracking-wide',
                    chosen === i
                      ? (side === 'for' ? 'text-for-400' : 'text-against-400')
                      : 'text-surface-500',
                  )}>
                    {s.angle}
                  </p>
                  <p className="text-sm font-mono text-white leading-relaxed">{s.text}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            Skip — write freely
          </button>
          <Button
            variant={side === 'for' ? 'for' : 'against'}
            size="md"
            disabled={chosen === null || loading}
            onClick={() => chosen !== null && onPick(starters[chosen])}
          >
            Use this angle
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Draft editor ─────────────────────────────────────────────────────

function Step3Draft({
  topic,
  side,
  starter,
  initialDraft,
  onNext,
  onBack,
}: {
  topic: TopicResult
  side: Side
  starter: ArgumentStarter | null
  initialDraft: string
  onNext: (draft: string) => void
  onBack: () => void
}) {
  const [draft, setDraft]           = useState(initialDraft || (starter?.text ?? ''))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    // Place cursor at end
    const len = textareaRef.current?.value.length ?? 0
    textareaRef.current?.setSelectionRange(len, len)
  }, [])

  const chars  = draft.trim().length
  const pct    = Math.min(100, (chars / MAX_CHARS) * 100)
  const tooShort = chars < MIN_CHARS
  const tooLong  = chars > MAX_CHARS

  const barColor = tooLong
    ? 'bg-against-500'
    : chars >= MAX_CHARS * 0.85
    ? 'bg-gold'
    : side === 'for'
    ? 'bg-for-500'
    : 'bg-against-500'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-mono font-bold text-white mb-1">Write your argument</h2>
        <p className="text-sm font-mono text-surface-500">
          {starter
            ? 'Edit and expand the angle you chose. Make it your own.'
            : 'Write your civic argument. Be clear, evidence-based, and persuasive.'}
        </p>
      </div>

      {/* Context */}
      <div className="rounded-xl bg-surface-200 border border-surface-300 px-4 py-3">
        <p className="text-xs font-mono text-surface-500 mb-1">
          {side === 'for' ? 'FOR' : 'AGAINST'} ·{' '}
          {topic.category && (
            <span className={cn('font-bold', CATEGORY_COLORS[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
        </p>
        <p className="text-sm font-mono text-white leading-relaxed">{topic.statement}</p>
      </div>

      {/* Angle badge */}
      {starter && (
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
          <Wand2 className="h-3.5 w-3.5 text-purple" />
          <span>Angle: <span className="text-white">{starter.angle}</span></span>
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Write your ${side === 'for' ? 'FOR' : 'AGAINST'} argument here…`}
          rows={8}
          className={cn(
            'w-full resize-none rounded-xl bg-surface-200 border p-4',
            'text-sm font-mono text-white placeholder:text-surface-500',
            'focus:outline-none focus:ring-2 transition-colors',
            tooLong
              ? 'border-against-500/60 focus:ring-against-500/20'
              : side === 'for'
              ? 'border-surface-300 focus:ring-for-500/30 focus:border-for-500/50'
              : 'border-surface-300 focus:ring-against-500/30 focus:border-against-500/50',
          )}
        />

        {/* Char bar */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn(
            'text-[11px] font-mono tabular-nums',
            tooLong ? 'text-against-400' : tooShort ? 'text-surface-500' : 'text-surface-500',
          )}>
            {chars}/{MAX_CHARS}
          </span>
        </div>

        {tooLong && (
          <p className="text-xs font-mono text-against-400 mt-1">
            Trim your argument to {MAX_CHARS} characters or fewer.
          </p>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-4">
        <p className="text-xs font-mono text-surface-500 font-bold mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-gold" /> WRITING TIPS
        </p>
        <ul className="space-y-1">
          {[
            'Lead with your strongest point',
            'Cite real evidence if possible',
            'Anticipate the opposing view',
            'End with a clear call to action or conclusion',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs font-mono text-surface-500">
              <span className="text-gold mt-px">·</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          variant={side === 'for' ? 'for' : 'against'}
          size="md"
          disabled={tooShort || tooLong}
          onClick={() => onNext(draft.trim())}
        >
          Review argument
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Review & publish ─────────────────────────────────────────────────

function Step4Review({
  topic,
  side,
  draft,
  onPublished,
  onBack,
}: {
  topic: TopicResult
  side: Side
  draft: string
  onPublished: (id: string) => void
  onBack: () => void
}) {
  const [loadingCritique, setLoadingCritique] = useState(true)
  const [critique, setCritique]               = useState<CritiqueResponse | null>(null)
  const [critiqueErr, setCritiqueErr]         = useState<string | null>(null)
  const [publishing, setPublishing]           = useState(false)
  const [publishErr, setPublishErr]           = useState<string | null>(null)

  const fetchCritique = useCallback(async () => {
    setLoadingCritique(true)
    setCritiqueErr(null)
    try {
      const res = await fetch('/api/arguments/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_statement: topic.statement,
          category: topic.category,
          side,
          argument_text: draft,
        }),
      })
      const data: CritiqueResponse = await res.json()
      if (data.unavailable) {
        setCritique(null)
        setCritiqueErr(null)
      } else {
        setCritique(data)
      }
    } catch {
      setCritiqueErr('Could not load AI feedback.')
    } finally {
      setLoadingCritique(false)
    }
  }, [topic, side, draft])

  useEffect(() => { fetchCritique() }, [fetchCritique])

  async function handlePublish() {
    setPublishing(true)
    setPublishErr(null)
    try {
      const res = await fetch(`/api/topics/${topic.id}/arguments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: side === 'for' ? 'blue' : 'red',
          content: draft,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPublishErr(data.error ?? 'Failed to publish.')
        return
      }
      onPublished(data.argument?.id ?? topic.id)
    } catch {
      setPublishErr('Network error. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  const gc = critique ? (GRADE_CONFIG[critique.grade] ?? GRADE_CONFIG.C) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-mono font-bold text-white mb-1">Review & publish</h2>
        <p className="text-sm font-mono text-surface-500">
          Check the AI feedback, then publish your argument to the debate.
        </p>
      </div>

      {/* Your argument */}
      <div className={cn(
        'rounded-xl border p-4',
        side === 'for'
          ? 'bg-for-600/5 border-for-500/30'
          : 'bg-against-600/5 border-against-500/30',
      )}>
        <div className="flex items-center gap-2 mb-3">
          <div className={cn(
            'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold',
            side === 'for' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400',
          )}>
            {side === 'for' ? 'FOR' : 'AGAINST'}
          </div>
          <span className="text-xs font-mono text-surface-500">your argument</span>
        </div>
        <p className="text-sm font-mono text-white leading-relaxed whitespace-pre-wrap">{draft}</p>
      </div>

      {/* AI feedback */}
      {loadingCritique ? (
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ) : critiqueErr ? (
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-4 text-center">
          <p className="text-sm font-mono text-surface-500">{critiqueErr}</p>
        </div>
      ) : critique ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden"
        >
          {/* Grade header */}
          <div className="flex items-center gap-4 p-4 border-b border-surface-300">
            <div className={cn(
              'flex items-center justify-center h-14 w-14 rounded-xl border text-2xl font-mono font-bold flex-shrink-0',
              gc?.bg, gc?.border, gc?.text,
            )}>
              {critique.grade}
            </div>
            <div>
              <p className="text-sm font-mono font-bold text-white">
                Score: {critique.score}/10
              </p>
              <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">
                {critique.summary}
              </p>
            </div>
          </div>

          {/* Dimensions */}
          <div className="divide-y divide-surface-300">
            {critique.dimensions.map((d) => (
              <div key={d.name} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-shrink-0 w-16">
                  <p className="text-[10px] font-mono font-bold text-surface-500 uppercase">{d.name}</p>
                  <p className="text-sm font-mono font-bold text-white">{d.score}/10</p>
                </div>
                <p className="text-xs font-mono text-surface-500 leading-relaxed">{d.feedback}</p>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {critique.suggestions.length > 0 && (
            <div className="px-4 py-3 border-t border-surface-300">
              <p className="text-[10px] font-mono font-bold text-surface-500 uppercase mb-2">Suggestions</p>
              <ul className="space-y-1">
                {critique.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-mono text-surface-500">
                    <Zap className="h-3 w-3 text-gold flex-shrink-0 mt-px" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strong point */}
          {critique.strong_point && (
            <div className="px-4 py-3 border-t border-surface-300 bg-emerald/5">
              <p className="text-[10px] font-mono font-bold text-emerald uppercase mb-1">Strong point</p>
              <p className="text-xs font-mono text-surface-500 leading-relaxed">{critique.strong_point}</p>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="rounded-xl bg-surface-200/60 border border-surface-300 p-4 text-center">
          <Bot className="h-6 w-6 text-surface-500 mx-auto mb-2" />
          <p className="text-xs font-mono text-surface-500">AI feedback unavailable</p>
        </div>
      )}

      {publishErr && (
        <p className="text-sm font-mono text-against-400 bg-against-500/10 border border-against-500/30 rounded-xl px-4 py-3">
          {publishErr}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={publishing}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          variant={side === 'for' ? 'for' : 'against'}
          size="md"
          disabled={publishing || loadingCritique}
          onClick={handlePublish}
        >
          {publishing ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>
          ) : (
            <><Send className="h-4 w-4" /> Publish argument</>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 5: Success screen ───────────────────────────────────────────────────

function Step5Success({
  topic,
  side,
  argumentId,
  onStartNew,
}: {
  topic: TopicResult
  side: Side
  argumentId: string
  onStartNew: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="py-8 flex flex-col items-center text-center gap-6"
    >
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-emerald/10 border border-emerald/40">
        <CheckCircle2 className="h-10 w-10 text-emerald" />
      </div>

      <div>
        <h2 className="text-xl font-mono font-bold text-white mb-2">Argument published!</h2>
        <p className="text-sm font-mono text-surface-500 max-w-xs leading-relaxed">
          Your{' '}
          <span className={cn('font-bold', side === 'for' ? 'text-for-400' : 'text-against-400')}>
            {side === 'for' ? 'FOR' : 'AGAINST'}
          </span>{' '}
          argument is now live in the debate.
        </p>
      </div>

      <div className="rounded-xl bg-surface-200 border border-surface-300 px-4 py-3 w-full max-w-sm">
        <p className="text-xs font-mono text-surface-500 mb-1">On the topic of</p>
        <p className="text-sm font-mono text-white leading-relaxed">{topic.statement}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href={`/topic/${topic.id}/arguments${argumentId !== topic.id ? `#arg-${argumentId}` : ''}`}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold transition-colors',
            side === 'for'
              ? 'bg-for-600 text-white hover:bg-for-500'
              : 'bg-against-600 text-white hover:bg-against-500',
          )}
        >
          <MessageSquare className="h-4 w-4" />
          View debate
        </Link>
        <button
          type="button"
          onClick={onStartNew}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
        >
          <Pencil className="h-4 w-4" />
          New argument
        </button>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Link href="/workshop" onClick={onStartNew} className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-gold" /> Workshop again
        </Link>
        <Link href="/analytics/arguments" className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" /> View my arguments
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkshopClient() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>(1)
  const [ws, setWs]               = useState<WorkshopState>({
    topic: null,
    side: null,
    chosenAngle: null,
    draft: '',
    critique: null,
    publishedId: null,
  })

  // Persist state across refreshes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<WorkshopState> & { step?: number }
        if (parsed.topic && parsed.side) {
          setWs((prev) => ({ ...prev, ...parsed }))
          if (parsed.step && parsed.step > 1 && parsed.step < 5) {
            setStep(parsed.step as Step)
          }
        }
      }
    } catch {}
  }, [])

  function saveState(updates: Partial<WorkshopState & { step: number }>) {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }))
    } catch {}
  }

  function resetWorkshop() {
    setWs({ topic: null, side: null, chosenAngle: null, draft: '', critique: null, publishedId: null })
    setStep(1)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => step > 1 && step < 5 ? setStep((s) => (s - 1) as Step) : router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <h1 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple" />
              Argument Workshop
            </h1>
            {step < 5 && (
              <p className="text-xs font-mono text-surface-500">
                Step {step} of 4 — {STEP_META[step - 1].label}
              </p>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className={cn(
              step < 5 && 'rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6',
            )}
          >
            {step === 1 && (
              <Step1Topic
                initialTopic={ws.topic}
                onSelect={(topic, side) => {
                  const updates = { topic, side, chosenAngle: null, draft: '', step: 2 }
                  setWs((prev) => ({ ...prev, ...updates }))
                  saveState(updates)
                  setStep(2)
                }}
              />
            )}

            {step === 2 && ws.topic && ws.side && (
              <Step2Angles
                topic={ws.topic}
                side={ws.side}
                onPick={(starter) => {
                  const updates = { chosenAngle: starter, draft: starter.text, step: 3 }
                  setWs((prev) => ({ ...prev, ...updates }))
                  saveState(updates)
                  setStep(3)
                }}
                onSkip={() => {
                  const updates = { chosenAngle: null, draft: '', step: 3 }
                  setWs((prev) => ({ ...prev, ...updates }))
                  saveState(updates)
                  setStep(3)
                }}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && ws.topic && ws.side && (
              <Step3Draft
                topic={ws.topic}
                side={ws.side}
                starter={ws.chosenAngle}
                initialDraft={ws.draft}
                onNext={(draft) => {
                  const updates = { draft, step: 4 }
                  setWs((prev) => ({ ...prev, ...updates }))
                  saveState(updates)
                  setStep(4)
                }}
                onBack={() => setStep(2)}
              />
            )}

            {step === 4 && ws.topic && ws.side && ws.draft && (
              <Step4Review
                topic={ws.topic}
                side={ws.side}
                draft={ws.draft}
                onPublished={(id) => {
                  setWs((prev) => ({ ...prev, publishedId: id }))
                  try { localStorage.removeItem(STORAGE_KEY) } catch {}
                  setStep(5)
                }}
                onBack={() => setStep(3)}
              />
            )}

            {step === 5 && ws.topic && ws.side && (
              <Step5Success
                topic={ws.topic}
                side={ws.side}
                argumentId={ws.publishedId ?? ws.topic.id}
                onStartNew={resetWorkshop}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Tip bar — only on steps 1-4 */}
        {step < 5 && (
          <div className="mt-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-200/50 border border-surface-300/60">
            <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              {step === 1 && 'Choose any active topic and pick your side. Only active and voting topics accept new arguments.'}
              {step === 2 && 'AI generates three distinct argument angles. Pick the strongest or skip to write from scratch.'}
              {step === 3 && `Keep your argument between ${MIN_CHARS}–${MAX_CHARS} characters. Quality beats quantity.`}
              {step === 4 && 'The AI reviews your argument across four dimensions. You can go back and revise before publishing.'}
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
