'use client'

/**
 * /coach — Argument Coach
 *
 * AI-powered argument workshop. Users select a topic, pick a side,
 * draft an argument, and receive a structured critique from Claude
 * across four dimensions: Clarity, Evidence, Logic, and Persuasion.
 * A final score, letter grade, and actionable suggestions help
 * users strengthen their arguments before posting to the debate.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { CritiqueResponse } from '@/app/api/arguments/critique/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 500

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type Phase = 'compose' | 'evaluating' | 'result' | 'unavailable'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald'
    case 'B': return 'text-for-300'
    case 'C': return 'text-gold'
    case 'D': return 'text-against-300'
    default:  return 'text-against-400'
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald/10 border-emerald/25'
    case 'B': return 'bg-for-500/10 border-for-500/25'
    case 'C': return 'bg-gold/10 border-gold/25'
    case 'D': return 'bg-against-400/10 border-against-400/25'
    default:  return 'bg-against-500/10 border-against-500/25'
  }
}

function scoreBar(score: number): string {
  if (score >= 8) return 'bg-emerald'
  if (score >= 6) return 'bg-for-500'
  if (score >= 4) return 'bg-gold'
  return 'bg-against-500'
}

function dimensionIcon(name: string): React.ReactNode {
  switch (name) {
    case 'Clarity':    return <Sparkles className="h-3.5 w-3.5 text-for-400"  aria-hidden />
    case 'Evidence':   return <Shield   className="h-3.5 w-3.5 text-emerald"  aria-hidden />
    case 'Logic':      return <Zap      className="h-3.5 w-3.5 text-gold"     aria-hidden />
    case 'Persuasion': return <Bot      className="h-3.5 w-3.5 text-purple"   aria-hidden />
    default:           return <CheckCircle2 className="h-3.5 w-3.5 text-surface-500" aria-hidden />
  }
}

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circumference = 2 * Math.PI * r
  const pct = score / 10
  const filled = pct * circumference
  const color =
    score >= 8 ? '#10b981' :
    score >= 6 ? '#60a5fa' :
    score >= 4 ? '#f59e0b' :
                 '#f87171'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 116, height: 116 }}>
      <svg width="116" height="116" className="-rotate-90" aria-hidden>
        <circle cx="58" cy="58" r={r} fill="none" stroke="#1e2a3a" strokeWidth="8" />
        <circle
          cx="58" cy="58" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span
        className="absolute text-3xl font-black tabular-nums"
        style={{ color }}
        aria-label={`Score ${score} out of 10`}
      >
        {score}
      </span>
    </div>
  )
}

// ─── Compose panel ────────────────────────────────────────────────────────────

function ComposePanel({
  selectedTopic,
  setSelectedTopic,
  side,
  setSide,
  argument,
  setArgument,
  onEvaluate,
  evaluating,
}: {
  selectedTopic: TopicResult | null
  setSelectedTopic: (t: TopicResult | null) => void
  side: 'for' | 'against'
  setSide: (s: 'for' | 'against') => void
  argument: string
  setArgument: (a: string) => void
  onEvaluate: () => void
  evaluating: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
        if (!res.ok) throw new Error('search failed')
        const data = await res.json()
        setResults((data.results ?? []).slice(0, 8))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  function selectTopic(t: TopicResult) {
    setSelectedTopic(t)
    setQuery('')
    setResults([])
  }

  function clearTopic() {
    setSelectedTopic(null)
    setQuery('')
    setResults([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const canEvaluate = !!selectedTopic && argument.trim().length >= 20 && !evaluating

  return (
    <div className="space-y-5">
      {/* Topic search */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Topic
        </label>

        {selectedTopic ? (
          <div className="flex items-start gap-3 bg-surface-200 border border-surface-300 rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                {selectedTopic.statement}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {selectedTopic.category && (
                  <span className="text-xs text-surface-500">{selectedTopic.category}</span>
                )}
                <Badge
                  variant={STATUS_BADGE[selectedTopic.status] ?? 'proposed'}
                >
                  {STATUS_LABEL[selectedTopic.status] ?? selectedTopic.status}
                </Badge>
              </div>
            </div>
            <button
              onClick={clearTopic}
              className="flex-shrink-0 p-1 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="Remove topic"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" aria-hidden />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a topic…"
                className={cn(
                  'w-full bg-surface-200 border border-surface-300 rounded-xl',
                  'pl-9 pr-9 py-3 text-sm text-white placeholder:text-surface-500',
                  'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/25',
                  'transition-all',
                )}
                aria-label="Search topics"
                aria-autocomplete="list"
              />
            </div>
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={cn(
                    'absolute z-20 top-full mt-1.5 left-0 right-0',
                    'bg-surface-100 border border-surface-300 rounded-xl overflow-hidden shadow-xl',
                  )}
                  role="listbox"
                  aria-label="Topic results"
                >
                  {results.map((t) => (
                    <button
                      key={t.id}
                      role="option"
                      aria-selected={false}
                      onClick={() => selectTopic(t)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-200 transition-colors border-b border-surface-300 last:border-0 group"
                    >
                      <p className="text-sm text-white group-hover:text-white line-clamp-2 leading-snug">
                        {t.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {t.category && (
                          <span className="text-xs text-surface-500">{t.category}</span>
                        )}
                        <Badge
                          variant={STATUS_BADGE[t.status] ?? 'proposed'}
                        >
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Side selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Your stance
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setSide('for')}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all',
              side === 'for'
                ? 'bg-for-600/20 border-for-500/60 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/40 hover:text-for-400',
            )}
            aria-pressed={side === 'for'}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden />
            FOR
          </button>
          <button
            onClick={() => setSide('against')}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all',
              side === 'against'
                ? 'bg-against-600/20 border-against-500/60 text-against-300'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-against-500/40 hover:text-against-400',
            )}
            aria-pressed={side === 'against'}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden />
            AGAINST
          </button>
        </div>
      </div>

      {/* Argument textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="argument-input"
            className="text-xs font-semibold text-surface-500 uppercase tracking-wider"
          >
            Your argument
          </label>
          <span
            className={cn(
              'text-xs tabular-nums transition-colors',
              argument.length > MAX_CHARS * 0.9
                ? 'text-against-400'
                : argument.length > MAX_CHARS * 0.7
                  ? 'text-gold'
                  : 'text-surface-500',
            )}
          >
            {argument.length}/{MAX_CHARS}
          </span>
        </div>
        <textarea
          id="argument-input"
          value={argument}
          onChange={(e) => setArgument(e.target.value.slice(0, MAX_CHARS))}
          placeholder={
            selectedTopic
              ? `Write your ${side === 'for' ? 'FOR' : 'AGAINST'} argument here. Be specific, cite evidence, and state your reasoning clearly…`
              : 'Select a topic above, then write your argument…'
          }
          disabled={!selectedTopic}
          rows={6}
          className={cn(
            'w-full bg-surface-200 border border-surface-300 rounded-xl',
            'px-4 py-3 text-sm text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/25',
            'resize-none transition-all leading-relaxed',
            !selectedTopic && 'opacity-50 cursor-not-allowed',
          )}
        />
        {argument.trim().length > 0 && argument.trim().length < 20 && (
          <p className="text-xs text-against-400">
            Write at least 20 characters to enable evaluation.
          </p>
        )}
      </div>

      {/* Evaluate button */}
      <button
        onClick={onEvaluate}
        disabled={!canEvaluate}
        className={cn(
          'w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl',
          'font-semibold text-sm transition-all',
          canEvaluate
            ? 'bg-for-500 hover:bg-for-400 text-white shadow-lg shadow-for-500/20 hover:shadow-for-400/30'
            : 'bg-surface-300 text-surface-500 cursor-not-allowed',
        )}
        aria-busy={evaluating}
      >
        {evaluating ? (
          <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Evaluating…</>
        ) : (
          <><Sparkles className="h-4 w-4" aria-hidden /> Evaluate Argument</>
        )}
      </button>

      <p className="text-center text-xs text-surface-500">
        Powered by Claude · Your draft stays private
      </p>
    </div>
  )
}

// ─── Critique panel ───────────────────────────────────────────────────────────

function CritiquePanel({
  critique,
  topic,
  side,
  onReset,
}: {
  critique: CritiqueResponse
  topic: TopicResult
  side: 'for' | 'against'
  onReset: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Overall score header */}
      <div className={cn(
        'flex items-center gap-5 bg-surface-200 border rounded-2xl p-5',
        gradeBg(critique.grade),
      )}>
        <ScoreRing score={critique.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-4xl font-black leading-none', gradeColor(critique.grade))}>
              {critique.grade}
            </span>
            <span className="text-xs text-surface-500 uppercase tracking-wider font-semibold">
              Grade
            </span>
          </div>
          <p className="text-sm text-surface-700 leading-snug">{critique.summary}</p>
        </div>
      </div>

      {/* Strong point */}
      <div className="flex items-start gap-3 bg-emerald/5 border border-emerald/20 rounded-xl px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald mt-0.5 flex-shrink-0" aria-hidden />
        <div>
          <p className="text-xs font-semibold text-emerald uppercase tracking-wider mb-0.5">
            Strongest point
          </p>
          <p className="text-sm text-surface-700 leading-snug">{critique.strong_point}</p>
        </div>
      </div>

      {/* Dimension scores */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Breakdown
        </p>
        <div className="space-y-3">
          {critique.dimensions.map((dim, i) => (
            <motion.div
              key={dim.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
              className="bg-surface-200 border border-surface-300 rounded-xl p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {dimensionIcon(dim.name)}
                  <span className="text-sm font-semibold text-white">{dim.name}</span>
                </div>
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  dim.score >= 8 ? 'text-emerald' :
                  dim.score >= 6 ? 'text-for-300' :
                  dim.score >= 4 ? 'text-gold' :
                                   'text-against-400'
                )}>
                  {dim.score}/10
                </span>
              </div>
              {/* Score bar */}
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', scoreBar(dim.score))}
                  initial={{ width: 0 }}
                  animate={{ width: `${dim.score * 10}%` }}
                  transition={{ duration: 0.5, delay: 0.1 * i, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-surface-600 leading-relaxed">{dim.feedback}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {critique.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            How to improve
          </p>
          <div className="space-y-2">
            {critique.suggestions.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + 0.1 * i }}
                className="flex items-start gap-3 bg-surface-200 border border-surface-300 rounded-xl px-4 py-3"
              >
                <Lightbulb className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden />
                <p className="text-sm text-surface-700 leading-snug">{s}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2.5 pt-1">
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'flex items-center justify-center gap-2 py-3 rounded-xl',
            'font-semibold text-sm transition-all',
            side === 'for'
              ? 'bg-for-500 hover:bg-for-400 text-white'
              : 'bg-against-500 hover:bg-against-400 text-white',
          )}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Post to Topic
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-semibold transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Evaluate another argument
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const [phase, setPhase] = useState<Phase>('compose')
  const [selectedTopic, setSelectedTopic] = useState<TopicResult | null>(null)
  const [side, setSide] = useState<'for' | 'against'>('for')
  const [argument, setArgument] = useState('')
  const [critique, setCritique] = useState<CritiqueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resultRef = useRef<HTMLDivElement>(null)

  const handleEvaluate = useCallback(async () => {
    if (!selectedTopic || argument.trim().length < 20) return
    setPhase('evaluating')
    setError(null)

    try {
      const res = await fetch('/api/arguments/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_statement: selectedTopic.statement,
          category: selectedTopic.category,
          side,
          argument_text: argument,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Evaluation failed')
      }

      const data: CritiqueResponse = await res.json()

      if (data.unavailable) {
        setPhase('unavailable')
        return
      }

      setCritique(data)
      setPhase('result')

      // Scroll to results on mobile
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('compose')
    }
  }, [selectedTopic, side, argument])

  function handleReset() {
    setPhase('compose')
    setCritique(null)
    setArgument('')
    setSelectedTopic(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-20 pb-28">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 h-12 w-12 bg-for-600/20 border border-for-500/30 rounded-2xl flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Argument Coach</h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Draft an argument, get AI critique on clarity, evidence, logic, and persuasion — then post it to the debate.
              </p>
            </div>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 flex items-center gap-3 bg-against-500/10 border border-against-500/30 rounded-xl px-4 py-3"
            >
              <X className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden />
              <p className="text-sm text-against-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unavailable state */}
        {phase === 'unavailable' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-100 border border-surface-300 rounded-2xl p-8 text-center"
          >
            <Bot className="h-10 w-10 text-surface-500 mx-auto mb-3" aria-hidden />
            <h2 className="text-lg font-semibold text-white mb-1">AI Coach Unavailable</h2>
            <p className="text-sm text-surface-500 mb-5">
              The AI evaluation service is not available right now.
            </p>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm text-white hover:bg-surface-300 transition-colors font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Try again later
            </button>
          </motion.div>
        )}

        {/* Main two-column layout */}
        {phase !== 'unavailable' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Compose */}
            <div
              className={cn(
                'bg-surface-100 border border-surface-300 rounded-2xl p-5',
                phase === 'result' && 'lg:sticky lg:top-24 lg:self-start',
              )}
            >
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-for-500/20 border border-for-500/30 flex items-center justify-center text-xs font-bold text-for-400">
                  1
                </span>
                Draft your argument
              </h2>
              <ComposePanel
                selectedTopic={selectedTopic}
                setSelectedTopic={setSelectedTopic}
                side={side}
                setSide={setSide}
                argument={argument}
                setArgument={setArgument}
                onEvaluate={handleEvaluate}
                evaluating={phase === 'evaluating'}
              />
            </div>

            {/* Right: Critique or skeleton */}
            <div ref={resultRef}>
              {phase === 'evaluating' && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-for-400" aria-hidden />
                    Evaluating…
                  </h2>
                  {/* Skeleton */}
                  <div className="flex items-center gap-5 bg-surface-200 rounded-2xl p-5 animate-pulse">
                    <div className="h-[116px] w-[116px] rounded-full bg-surface-300 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-8 w-12 bg-surface-300 rounded-lg" />
                      <div className="h-4 w-full bg-surface-300 rounded" />
                      <div className="h-4 w-3/4 bg-surface-300 rounded" />
                    </div>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-surface-200 rounded-xl p-3.5 space-y-2.5 animate-pulse">
                      <div className="flex justify-between">
                        <div className="h-4 w-20 bg-surface-300 rounded" />
                        <div className="h-4 w-10 bg-surface-300 rounded" />
                      </div>
                      <div className="h-1.5 bg-surface-300 rounded-full" />
                      <div className="h-3 w-full bg-surface-300 rounded" />
                    </div>
                  ))}
                </div>
              )}

              {phase === 'result' && critique && selectedTopic && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                  <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-for-500/20 border border-for-500/30 flex items-center justify-center text-xs font-bold text-for-400">
                      2
                    </span>
                    Your critique
                  </h2>
                  <CritiquePanel
                    critique={critique}
                    topic={selectedTopic}
                    side={side}
                    onReset={handleReset}
                  />
                </div>
              )}

              {phase === 'compose' && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                  <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4">
                    <Bot className="h-7 w-7 text-surface-500" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Critique will appear here
                  </h3>
                  <p className="text-sm text-surface-500 max-w-xs">
                    Select a topic, write your argument, and click <strong className="text-surface-400">Evaluate</strong> to get AI coaching.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2 w-full max-w-xs">
                    {['Clarity', 'Evidence', 'Logic', 'Persuasion'].map((d) => (
                      <div
                        key={d}
                        className="flex items-center gap-1.5 bg-surface-200 rounded-lg px-3 py-2 text-xs text-surface-500"
                      >
                        {dimensionIcon(d)}
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How it works */}
        {phase === 'compose' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-surface-100 border border-surface-300 rounded-2xl p-5"
          >
            <h3 className="text-sm font-semibold text-white mb-3">How the Coach works</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Search className="h-4 w-4 text-for-400" aria-hidden />, title: 'Pick a topic', desc: 'Search any active debate or proposed law' },
                { icon: <ThumbsUp className="h-4 w-4 text-emerald" aria-hidden />, title: 'Choose your side', desc: 'Argue FOR or AGAINST' },
                { icon: <Sparkles className="h-4 w-4 text-gold" aria-hidden />, title: 'Write & evaluate', desc: 'Claude scores across 4 dimensions' },
                { icon: <ChevronRight className="h-4 w-4 text-purple" aria-hidden />, title: 'Refine & post', desc: 'Improve with suggestions, then post live' },
              ].map((step, i) => (
                <div key={i} className="bg-surface-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {step.icon}
                    <span className="text-xs font-semibold text-white">{step.title}</span>
                  </div>
                  <p className="text-xs text-surface-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
