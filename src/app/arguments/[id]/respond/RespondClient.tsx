'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/ui/Avatar'
import type { Suggestion, SuggestResponse } from '@/app/api/arguments/[id]/suggest/route'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgumentData {
  id: string
  content: string
  side: 'blue' | 'red'
  topic_id: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface TopicData {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Strategy type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<Suggestion['type'], { label: string; color: string; bg: string; border: string }> = {
  counter:  { label: 'Counter',  color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  extend:   { label: 'Extend',   color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30'         },
  reinforce: { label: 'Reframe', color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30'       },
}

// ─── Strategy card ────────────────────────────────────────────────────────────

function StrategyCard({ s, onUse }: { s: Suggestion; onUse: (starter: string) => void }) {
  const cfg = TYPE_CONFIG[s.type]
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(s.starter).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
          cfg.color, cfg.bg, cfg.border,
        )}>
          {cfg.label}
        </span>
        <span className="text-xs font-mono font-semibold text-white">{s.label}</span>
      </div>
      <p className="text-sm text-surface-600 leading-relaxed mb-3">{s.point}</p>
      <div className="rounded-lg bg-surface-200/60 border border-surface-300 p-3">
        <p className="text-sm font-mono leading-snug text-surface-400 italic mb-2">
          &ldquo;{s.starter}&rdquo;
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUse(s.starter)}
            className="text-[10px] font-mono px-2 py-1 rounded border transition-all text-for-400 border-for-500/40 bg-for-500/10 hover:bg-for-500/20"
          >
            Use as starter
          </button>
          <button
            onClick={copy}
            aria-label="Copy starter sentence"
            className={cn(
              'text-[10px] font-mono px-2 py-1 rounded border transition-all flex items-center gap-1',
              copied
                ? 'text-emerald border-emerald/40 bg-emerald/10'
                : 'text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
            )}
          >
            {copied ? (
              <><CheckCircle2 className="h-3 w-3" aria-hidden />Copied</>
            ) : (
              <><Copy className="h-3 w-3" aria-hidden />Copy</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function RespondClient({ argument, topic }: { argument: ArgumentData; topic: TopicData }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const responseSide: 'blue' | 'red' = argument.side === 'blue' ? 'red' : 'blue'
  const originalIsFor = argument.side === 'blue'
  const responseIsFor = !originalIsFor

  const [text, setText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [phase, setPhase] = useState<'compose' | 'submitting' | 'success'>('compose')
  const [newArgId, setNewArgId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [strategiesOpen, setStrategiesOpen] = useState(true)

  useEffect(() => {
    loadStrategies()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadStrategies() {
    setSuggestLoading(true)
    setSuggestError(null)
    try {
      const res = await fetch(`/api/arguments/${argument.id}/suggest`, { method: 'POST' })
      if (res.status === 401) {
        setSuggestError('Sign in to get AI strategies.')
        return
      }
      const data = (await res.json()) as SuggestResponse
      if (data.unavailable) {
        setSuggestError('AI strategies unavailable right now.')
        return
      }
      setSuggestions(data.suggestions)
    } catch {
      setSuggestError('Could not load strategies.')
    } finally {
      setSuggestLoading(false)
    }
  }

  function useStarter(starter: string) {
    const prefilled = starter + ' '
    setText(prefilled)
    setTimeout(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(prefilled.length, prefilled.length)
    }, 50)
  }

  async function handleSubmit() {
    if (text.trim().length < 10 || phase !== 'compose') return
    setPhase('submitting')
    setError(null)

    try {
      const body: { side: string; content: string; source_url?: string } = {
        side: responseSide,
        content: text.trim(),
      }
      if (sourceUrl.trim()) body.source_url = sourceUrl.trim()

      const res = await fetch(`/api/topics/${topic.id}/arguments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 401) {
        setError('Sign in to post an argument.')
        setPhase('compose')
        return
      }

      if (res.status === 409) {
        setError('You already have an argument on this topic. Each user can post one argument per topic.')
        setPhase('compose')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to post argument')
      }

      const data = await res.json() as { argument?: { id: string } }
      setNewArgId(data.argument?.id ?? null)
      setPhase('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('compose')
    }
  }

  const MAX_CHARS = 500
  const canSubmit = text.trim().length >= 10 && phase === 'compose'

  // ─── Success state ──────────────────────────────────────────────────────────

  if (phase === 'success') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center py-16">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-4 max-w-sm"
        >
          <div className="h-16 w-16 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald" aria-hidden />
          </div>
          <h2 className="text-xl font-bold text-white">Response posted!</h2>
          <p className="text-sm text-surface-500">
            Your {responseIsFor ? 'FOR' : 'AGAINST'} argument has been added to the debate.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {newArgId && (
              <Link
                href={`/arguments/${newArgId}`}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold transition-all text-white',
                  responseIsFor
                    ? 'bg-for-500 hover:bg-for-400 shadow-lg shadow-for-500/20'
                    : 'bg-against-500 hover:bg-against-400 shadow-lg shadow-against-500/20',
                )}
              >
                View your argument
              </Link>
            )}
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center justify-center gap-2 py-3 px-5 bg-surface-200 border border-surface-300 text-white rounded-xl text-sm font-semibold transition-all hover:bg-surface-300"
            >
              See the full debate
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ─── Compose state ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 bg-against-500/10 border border-against-500/30 rounded-xl px-4 py-3">
              <X className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" aria-hidden />
              <p className="text-sm text-against-300">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Original argument context */}
      <div className={cn(
        'rounded-2xl border p-5',
        originalIsFor ? 'bg-for-500/8 border-for-500/30' : 'bg-against-500/8 border-against-500/30',
      )}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest border',
            originalIsFor
              ? 'text-for-400 bg-for-500/10 border-for-500/30'
              : 'text-against-400 bg-against-500/10 border-against-500/30',
          )}>
            <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', originalIsFor ? 'bg-for-500' : 'bg-against-500')} />
            {originalIsFor
              ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
              : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
            {originalIsFor ? 'FOR' : 'AGAINST'}
          </div>
          <span className="text-xs font-mono text-surface-600">argument you are responding to</span>
        </div>
        <p className="text-white text-sm leading-relaxed font-medium whitespace-pre-wrap">
          {argument.content}
        </p>
        {argument.author && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-300/30">
            <Avatar
              src={argument.author.avatar_url}
              fallback={argument.author.display_name ?? argument.author.username}
              size="xs"
            />
            <span className="text-xs font-mono text-surface-600">
              @{argument.author.username}
            </span>
          </div>
        )}
      </div>

      {/* AI strategies accordion */}
      <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
        <button
          onClick={() => setStrategiesOpen(o => !o)}
          aria-expanded={strategiesOpen}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-gold" aria-hidden />
            <span className="text-sm font-mono font-semibold text-white">
              AI response strategies
            </span>
            {suggestions && (
              <span className="text-[10px] font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded-full border border-surface-300">
                3 angles
              </span>
            )}
          </div>
          {strategiesOpen
            ? <ChevronUp className="h-4 w-4 text-surface-500" aria-hidden />
            : <ChevronDown className="h-4 w-4 text-surface-500" aria-hidden />}
        </button>

        <AnimatePresence initial={false}>
          {strategiesOpen && (
            <motion.div
              key="strategies-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-surface-300"
            >
              <div className="p-4 space-y-3">
                {suggestLoading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-surface-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    <span className="text-sm font-mono">Generating strategies…</span>
                  </div>
                )}

                {!suggestLoading && suggestError && (
                  <div className="text-center py-6">
                    <p className="text-sm font-mono text-against-400 mb-2">{suggestError}</p>
                    {!suggestError.includes('Sign in') && (
                      <button
                        onClick={loadStrategies}
                        className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1 mx-auto"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden />
                        Try again
                      </button>
                    )}
                  </div>
                )}

                {!suggestLoading && suggestions && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono text-surface-500 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-gold" aria-hidden />
                        Click &ldquo;Use as starter&rdquo; to insert into your draft
                      </p>
                      <button
                        onClick={loadStrategies}
                        aria-label="Regenerate strategies"
                        className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden />
                        Regenerate
                      </button>
                    </div>
                    {suggestions.map(s => (
                      <StrategyCard key={s.type} s={s} onUse={useStarter} />
                    ))}
                    <p className="text-[10px] font-mono text-surface-600 text-center pt-1">
                      Use a starter · adapt it · make it your own
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compose panel */}
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
        {/* Response side badge */}
        <div className="flex items-center gap-2">
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest border',
            responseIsFor
              ? 'text-for-400 bg-for-500/10 border-for-500/30'
              : 'text-against-400 bg-against-500/10 border-against-500/30',
          )}>
            <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', responseIsFor ? 'bg-for-500' : 'bg-against-500')} />
            {responseIsFor
              ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
              : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
            {responseIsFor ? 'FOR' : 'AGAINST'}
          </div>
          <span className="text-xs font-mono text-surface-600">your response</span>
        </div>

        {/* Argument text */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="respond-text"
              className="text-xs font-semibold text-surface-500 uppercase tracking-wider"
            >
              Your argument
            </label>
            <span className={cn(
              'text-xs tabular-nums transition-colors',
              text.length > MAX_CHARS * 0.9
                ? 'text-against-400'
                : text.length > MAX_CHARS * 0.7
                  ? 'text-gold'
                  : 'text-surface-500',
            )}>
              {text.length}/{MAX_CHARS}
            </span>
          </div>
          <textarea
            id="respond-text"
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={`Write your ${responseIsFor ? 'FOR' : 'AGAINST'} argument… Use one of the AI starters above, or write from scratch.`}
            rows={5}
            className={cn(
              'w-full bg-surface-200 border border-surface-300 rounded-xl',
              'px-4 py-3 text-sm text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/25',
              'resize-none transition-all leading-relaxed',
            )}
          />
          {text.trim().length > 0 && text.trim().length < 10 && (
            <p className="text-xs text-against-400">Write at least 10 characters to post.</p>
          )}
        </div>

        {/* Optional source URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="respond-source"
            className="text-xs font-semibold text-surface-500 uppercase tracking-wider"
          >
            Source URL{' '}
            <span className="font-normal normal-case text-surface-600">(optional)</span>
          </label>
          <input
            id="respond-source"
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://example.com/supporting-evidence"
            className={cn(
              'w-full bg-surface-200 border border-surface-300 rounded-xl',
              'px-4 py-2.5 text-sm text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/25',
              'transition-all',
            )}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={phase === 'submitting'}
          className={cn(
            'w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl',
            'font-semibold text-sm transition-all',
            canSubmit
              ? responseIsFor
                ? 'bg-for-500 hover:bg-for-400 text-white shadow-lg shadow-for-500/20 hover:shadow-for-400/30'
                : 'bg-against-500 hover:bg-against-400 text-white shadow-lg shadow-against-500/20 hover:shadow-against-400/30'
              : 'bg-surface-300 text-surface-500 cursor-not-allowed',
          )}
        >
          {phase === 'submitting' ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Posting…</>
          ) : (
            <><Send className="h-4 w-4" aria-hidden />Post Response</>
          )}
        </button>

        <p className="text-[10px] font-mono text-surface-600 text-center">
          One argument per topic · max 500 characters
        </p>
      </div>
    </div>
  )
}
