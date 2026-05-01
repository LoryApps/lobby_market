'use client'

/**
 * /perspective — Civic Perspective Swap
 *
 * An AI-powered tool for reducing echo chambers. Pick a topic, choose
 * your side (or the side you voted), and Claude generates the strongest
 * possible steel-man argument for the OPPOSING position.
 *
 * Goal: Help users understand the best case for views they disagree with —
 * not to change minds, but to deepen civic discourse.
 *
 * Distinct from:
 *   /spar    — real-time AI debate opponent
 *   /coach   — critique of your own argument
 *   /judge   — game where you score argument quality
 *   /prep    — dossier for debate preparation
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Lightbulb,
  Loader2,
  Network,
  RefreshCw,
  Scale,
  Search,
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
import type {
  PerspectiveRequest,
  PerspectiveResponse,
} from '@/app/api/perspective/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type Phase = 'pick' | 'side' | 'loading' | 'result' | 'unavailable'

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

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function strengthLabel(r: number): { label: string; color: string } {
  if (r >= 9) return { label: 'Very strong case', color: 'text-against-400' }
  if (r >= 7) return { label: 'Strong case', color: 'text-gold' }
  if (r >= 5) return { label: 'Moderate case', color: 'text-for-400' }
  if (r >= 3) return { label: 'Weak case', color: 'text-surface-500' }
  return { label: 'Very weak case', color: 'text-surface-600' }
}

// ─── Components ───────────────────────────────────────────────────────────────

function TopicSearchPanel({
  onSelect,
}: {
  onSelect: (t: TopicResult) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&tab=topics`,
      )
      if (!res.ok) return
      const data = await res.json() as { results?: TopicResult[] }
      setResults((data.results ?? []).slice(0, 8))
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 300)
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search topics to explore the other side…"
          autoFocus
          className={cn(
            'w-full pl-9 pr-9 py-3 rounded-xl font-mono text-sm text-white',
            'bg-surface-200 border border-surface-300 placeholder-surface-500',
            'focus:outline-none focus:border-purple/50 focus:bg-surface-300/50 transition-colors',
          )}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-1.5"
          >
            {results.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                  'bg-surface-200 border-surface-300 hover:bg-surface-300 hover:border-purple/40',
                  'group',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-mono text-white leading-snug flex-1">
                    {t.statement}
                  </p>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-purple flex-shrink-0 mt-0.5 transition-colors" />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {t.category && (
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        CATEGORY_COLOR[t.category] ?? 'text-surface-500',
                      )}
                    >
                      {t.category}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-surface-600">
                    {Math.round(t.blue_pct)}% FOR · {t.total_votes.toLocaleString()} votes
                  </span>
                  <Badge variant={STATUS_BADGE[t.status] ?? 'proposed'} className="text-[9px]">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm font-mono text-surface-600 py-4"
          >
            No topics found for &ldquo;{query}&rdquo;
          </motion.p>
        )}
      </AnimatePresence>

      {/* Browse popular topics fallback */}
      {query.length < 2 && (
        <PopularTopics onSelect={onSelect} />
      )}
    </div>
  )
}

function PopularTopics({ onSelect }: { onSelect: (t: TopicResult) => void }) {
  const [topics, setTopics] = useState<TopicResult[]>([])

  useEffect(() => {
    fetch('/api/topics/momentum')
      .then((r) => r.json())
      .then((d: { topics?: TopicResult[] }) => setTopics((d.topics ?? []).slice(0, 6)))
      .catch(() => {})
  }, [])

  if (topics.length === 0) return null

  return (
    <div className="mt-4">
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
        Popular debates
      </p>
      <div className="space-y-1.5">
        {topics.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={cn(
              'w-full text-left px-4 py-3 rounded-xl border transition-colors',
              'bg-surface-200 border-surface-300 hover:bg-surface-300 hover:border-purple/40 group',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-mono text-white leading-snug flex-1 line-clamp-2">
                {t.statement}
              </p>
              <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-purple flex-shrink-0 mt-0.5 transition-colors" />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {t.category && (
                <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[t.category] ?? 'text-surface-500')}>
                  {t.category}
                </span>
              )}
              <span className="text-[10px] font-mono text-surface-600">
                {Math.round(t.blue_pct)}% FOR
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SideStrengthBar({ rating }: { rating: number }) {
  const pct = (rating / 10) * 100
  const color =
    rating >= 8
      ? 'bg-against-500'
      : rating >= 6
      ? 'bg-gold'
      : rating >= 4
      ? 'bg-for-500'
      : 'bg-surface-400'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      <span className="text-sm font-mono font-bold text-white tabular-nums w-8">
        {rating}/10
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PerspectiveClient() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [topic, setTopic] = useState<TopicResult | null>(null)
  const [userSide, setUserSide] = useState<'for' | 'against' | null>(null)
  const [result, setResult] = useState<PerspectiveResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleTopicSelect(t: TopicResult) {
    setTopic(t)
    setPhase('side')
  }

  async function handleSideSelect(side: 'for' | 'against') {
    if (!topic) return
    setUserSide(side)
    setPhase('loading')
    setError(null)

    const payload: PerspectiveRequest = {
      topic_id: topic.id,
      topic_statement: topic.statement,
      category: topic.category,
      user_side: side,
      community_for_pct: topic.blue_pct,
      total_votes: topic.total_votes,
    }

    try {
      const res = await fetch('/api/perspective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Failed')
      }

      const data = (await res.json()) as PerspectiveResponse

      if (data.unavailable) {
        setPhase('unavailable')
        return
      }

      setResult(data)
      setPhase('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPhase('side')
    }
  }

  function reset() {
    setPhase('pick')
    setTopic(null)
    setUserSide(null)
    setResult(null)
    setError(null)
  }

  function tryAgain() {
    if (!userSide) { setPhase('side'); return }
    handleSideSelect(userSide)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          {phase !== 'pick' ? (
            <button
              onClick={reset}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              )}
              aria-label="Start over"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href="/"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              )}
              aria-label="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
              <Network className="h-4 w-4 text-purple" />
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-xl font-bold text-white">
                Perspective Swap
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                See the strongest case for the other side
              </p>
            </div>
          </div>
        </div>

        {/* ── Step indicator ──────────────────────────────────────── */}
        {phase !== 'result' && phase !== 'unavailable' && (
          <div className="flex items-center gap-2 mb-6">
            {[
              { id: 'pick', label: 'Choose Topic' },
              { id: 'side', label: 'Your Side' },
              { id: 'loading', label: 'Generating' },
            ].map((step, i) => {
              const steps = ['pick', 'side', 'loading']
              const currentIndex = steps.indexOf(phase)
              const stepIndex = steps.indexOf(step.id)
              const isDone = stepIndex < currentIndex
              const isActive = stepIndex === currentIndex

              return (
                <div key={step.id} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={cn(
                        'h-px w-6 flex-shrink-0 transition-colors',
                        isDone ? 'bg-purple/60' : 'bg-surface-300',
                      )}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all',
                        isDone
                          ? 'bg-purple text-white'
                          : isActive
                          ? 'bg-purple/20 border border-purple/60 text-purple'
                          : 'bg-surface-300 text-surface-500',
                      )}
                    >
                      {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-mono hidden sm:block',
                        isActive ? 'text-white' : isDone ? 'text-purple' : 'text-surface-500',
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-against-500/10 border border-against-500/30 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        {/* ── Phase: Pick topic ────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {phase === 'pick' && (
            <motion.div
              key="pick"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4 text-purple" />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-white mb-1">
                      What is the Perspective Swap?
                    </p>
                    <p className="text-xs font-mono text-surface-500 leading-relaxed">
                      Pick any topic, choose your side, and Claude will generate the
                      most honest and compelling steel-man argument for the opposing view.
                      Not to change your mind — but to ensure you understand the best
                      case for the other side.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-3 border-t border-surface-300">
                  {[
                    { icon: Network, text: 'Genuine steel-man, not strawman', color: 'text-purple' },
                    { icon: Lightbulb, text: 'Blind spots revealed', color: 'text-gold' },
                    { icon: Scale, text: 'Common ground surfaced', color: 'text-emerald' },
                  ].map(({ icon: Icon, text, color }) => (
                    <div key={text} className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                      <span className="text-[10px] font-mono text-surface-500 truncate">
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <TopicSearchPanel onSelect={handleTopicSelect} />
            </motion.div>
          )}

          {/* ── Phase: Choose side ──────────────────────────────────── */}
          {phase === 'side' && topic && (
            <motion.div
              key="side"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {/* Selected topic card */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-start gap-2 mb-3">
                  {topic.category && (
                    <span className={cn('text-[11px] font-mono font-semibold', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                      {topic.category}
                    </span>
                  )}
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[9px]">
                    {STATUS_LABEL[topic.status] ?? topic.status}
                  </Badge>
                </div>
                <p className="text-sm font-mono text-white leading-snug mb-3">
                  {topic.statement}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-for-400">FOR {Math.round(topic.blue_pct)}%</span>
                    <span className="text-against-400">AGAINST {100 - Math.round(topic.blue_pct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
                    <div
                      className="h-full bg-gradient-to-r from-for-700 to-for-500"
                      style={{ width: `${Math.round(topic.blue_pct)}%` }}
                    />
                    <div
                      className="h-full bg-against-600"
                      style={{ width: `${100 - Math.round(topic.blue_pct)}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 text-right">
                    {topic.total_votes.toLocaleString()} votes cast
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-mono font-semibold text-white mb-1">
                  Which side is <em>your</em> position?
                </p>
                <p className="text-xs font-mono text-surface-500 mb-4">
                  Claude will generate the strongest case for the OPPOSITE side.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSideSelect('for')}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2',
                      'border-for-500/50 bg-for-500/5 hover:bg-for-500/10 hover:border-for-400',
                      'transition-all cursor-pointer group',
                    )}
                  >
                    <ThumbsUp className="h-7 w-7 text-for-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono font-bold text-for-400">FOR</span>
                    <span className="text-[11px] font-mono text-surface-500 text-center leading-tight">
                      Show me the best case AGAINST
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSideSelect('against')}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2',
                      'border-against-500/50 bg-against-500/5 hover:bg-against-500/10 hover:border-against-400',
                      'transition-all cursor-pointer group',
                    )}
                  >
                    <ThumbsDown className="h-7 w-7 text-against-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono font-bold text-against-400">AGAINST</span>
                    <span className="text-[11px] font-mono text-surface-500 text-center leading-tight">
                      Show me the best case FOR
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Phase: Loading ───────────────────────────────────────── */}
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-5"
            >
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-purple/20 flex items-center justify-center">
                  <Network className="h-7 w-7 text-purple/60" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-purple border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <div className="text-center">
                <p className="font-mono text-white font-semibold mb-1">
                  Building the steel-man…
                </p>
                <p className="text-xs font-mono text-surface-500">
                  Claude is constructing the strongest honest case for the opposing view
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Phase: Result ────────────────────────────────────────── */}
          {phase === 'result' && result && topic && userSide && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Topic context bar */}
              <div className="rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs font-mono text-surface-500 flex-1 min-w-0 truncate">
                  {topic.statement}
                </p>
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
                >
                  View topic
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* Your side vs. opposing side banner */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  'rounded-xl border px-3 py-2.5 text-center',
                  userSide === 'for'
                    ? 'border-for-500/30 bg-for-500/5'
                    : 'border-against-500/30 bg-against-500/5',
                )}>
                  <p className="text-[10px] font-mono text-surface-500 mb-0.5">Your position</p>
                  <p className={cn(
                    'text-sm font-mono font-bold',
                    userSide === 'for' ? 'text-for-400' : 'text-against-400',
                  )}>
                    {userSide === 'for' ? 'FOR' : 'AGAINST'}
                  </p>
                </div>
                <div className={cn(
                  'rounded-xl border px-3 py-2.5 text-center',
                  result.opposing_side === 'for'
                    ? 'border-for-500/30 bg-for-500/5'
                    : 'border-against-500/30 bg-against-500/5',
                )}>
                  <p className="text-[10px] font-mono text-surface-500 mb-0.5">Opposing view</p>
                  <p className={cn(
                    'text-sm font-mono font-bold',
                    result.opposing_side === 'for' ? 'text-for-400' : 'text-against-400',
                  )}>
                    {result.opposing_side === 'for' ? 'FOR' : 'AGAINST'}
                  </p>
                </div>
              </div>

              {/* Steel-man argument */}
              <div className="rounded-2xl border border-purple/30 bg-purple/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-purple uppercase tracking-wider">
                    The Steel-Man Argument
                  </span>
                </div>
                <p className="text-sm font-mono text-white leading-relaxed">
                  {result.steel_man}
                </p>
              </div>

              {/* Strength rating */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-surface-500">
                    How strong is the opposing case?
                  </span>
                  <span className={cn(
                    'text-xs font-mono font-semibold',
                    strengthLabel(result.strength_rating).color,
                  )}>
                    {strengthLabel(result.strength_rating).label}
                  </span>
                </div>
                <SideStrengthBar rating={result.strength_rating} />
              </div>

              {/* Key points */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-gold flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                    Key Arguments
                  </span>
                </div>
                <div className="space-y-4">
                  {result.key_points.map((kp, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={cn(
                        'flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold mt-0.5',
                        'bg-gold/10 border border-gold/30 text-gold',
                      )}>
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-semibold text-white mb-0.5">
                          {kp.point}
                        </p>
                        <p className="text-xs font-mono text-surface-500 leading-relaxed">
                          {kp.explanation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Factual claims */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-emerald flex-shrink-0" />
                  <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                    Evidence They Would Cite
                  </span>
                </div>
                <ul className="space-y-2">
                  {result.factual_claims.map((claim, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald flex-shrink-0 mt-1.5" />
                      <p className="text-xs font-mono text-surface-600 leading-relaxed">
                        {claim}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Common ground + blind spot grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                    <span className="text-[11px] font-mono font-semibold text-emerald uppercase tracking-wider">
                      Common Ground
                    </span>
                  </div>
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">
                    {result.common_ground}
                  </p>
                </div>

                <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                    <span className="text-[11px] font-mono font-semibold text-gold uppercase tracking-wider">
                      Your Blind Spot
                    </span>
                  </div>
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">
                    {result.blind_spot}
                  </p>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={`/topic/${topic.id}`}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl',
                    'bg-for-600/80 hover:bg-for-500 border border-for-500/40',
                    'text-sm font-mono font-semibold text-white transition-colors',
                  )}
                >
                  <ArrowRight className="h-4 w-4" />
                  Go to debate
                </Link>

                <button
                  onClick={tryAgain}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                    'bg-surface-200 hover:bg-surface-300 border border-surface-300',
                    'text-sm font-mono text-surface-500 hover:text-white transition-colors',
                  )}
                  aria-label="Regenerate"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>

                <button
                  onClick={reset}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                    'bg-surface-200 hover:bg-surface-300 border border-surface-300',
                    'text-sm font-mono text-surface-500 hover:text-white transition-colors',
                  )}
                  aria-label="New topic"
                >
                  <Search className="h-4 w-4" />
                  New topic
                </button>
              </div>

              {/* Related tools */}
              <div className="pt-2 border-t border-surface-300">
                <p className="text-[11px] font-mono text-surface-500 mb-3 uppercase tracking-wider">
                  Continue the conversation
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { href: '/spar', icon: Flame, label: 'Debate AI', desc: 'Real-time match', color: 'text-against-400' },
                    { href: '/coach', icon: Gavel, label: 'Argument Coach', desc: 'Improve yours', color: 'text-gold' },
                    { href: '/prep', icon: Zap, label: 'Debate Prep', desc: 'Full dossier', color: 'text-for-400' },
                  ].map(({ href, icon: Icon, label, desc, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl text-center',
                        'bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', color)} />
                      <span className="text-[11px] font-mono font-semibold text-white">{label}</span>
                      <span className="text-[10px] font-mono text-surface-500">{desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Phase: Unavailable ───────────────────────────────────── */}
          {phase === 'unavailable' && (
            <motion.div
              key="unavailable"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center"
            >
              <Network className="h-10 w-10 text-surface-500 mx-auto mb-3" />
              <p className="text-sm font-mono font-semibold text-white mb-2">
                AI Perspective Swap is unavailable
              </p>
              <p className="text-xs font-mono text-surface-500 mb-5 max-w-xs mx-auto">
                The Anthropic API is not configured in this environment.
                Perspective Swap requires AI to generate the opposing view.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  href="/judge"
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                    'bg-surface-200 hover:bg-surface-300 border border-surface-300',
                    'text-sm font-mono text-white transition-colors',
                  )}
                >
                  Try Argument Judge
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={reset}
                  className="text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  Go back
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
