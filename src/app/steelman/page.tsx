'use client'

/**
 * /steelman — Civic Steelman Engine
 *
 * Generates the strongest possible version of BOTH sides of any civic debate.
 * A steelman is the opposite of a strawman: it represents the best, most
 * intellectually rigorous version of a position — the argument its smartest
 * proponent would actually make.
 *
 * Distinct from:
 *   /coach  — critiques YOUR draft argument
 *   /spar   — live AI debate opponent
 *   /prep   — pulls real platform arguments as prep material
 *   /simulate — models policy outcomes and real-world effects
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Lightbulb,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Share2,
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
import type { SteelmanResult, SteelmanArgument } from '@/app/api/steelman/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Topic search types ────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Topic search ─────────────────────────────────────────────────────────────

function TopicSearch({
  onSelect,
}: {
  onSelect: (t: TopicResult | null, custom?: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [customStatement, setCustomStatement] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=topics&limit=8`)
      if (!res.ok) return
      const data = await res.json() as { topics: TopicResult[] }
      setResults(data.topics ?? [])
      setOpen(true)
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 320)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (customMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={() => { setCustomMode(false); setCustomStatement('') }}
            className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> back to search
          </button>
        </div>
        <textarea
          value={customStatement}
          onChange={(e) => setCustomStatement(e.target.value)}
          placeholder="Enter any civic policy statement to steelman…"
          maxLength={280}
          rows={3}
          className={cn(
            'w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3',
            'text-white placeholder-surface-500 font-mono text-sm resize-none',
            'focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/20',
          )}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-surface-500">{customStatement.length}/280</span>
          <button
            type="button"
            disabled={customStatement.trim().length < 5}
            onClick={() => onSelect(null, customStatement.trim())}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all',
              customStatement.trim().length >= 5
                ? 'bg-purple hover:bg-purple/80 text-white'
                : 'bg-surface-300 text-surface-500 cursor-not-allowed',
            )}
          >
            <Sparkles className="h-4 w-4" />
            Steelman This
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search a topic to steelman…"
          className={cn(
            'w-full bg-surface-200 border border-surface-300 rounded-xl pl-10 pr-12 py-3',
            'text-white placeholder-surface-500 font-mono text-sm',
            'focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/20',
          )}
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full bg-surface-100 border border-surface-300 rounded-xl shadow-2xl overflow-hidden"
          >
            {results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelect(t); setOpen(false); setQuery('') }}
                className="w-full text-left px-4 py-3 hover:bg-surface-200 transition-colors border-b border-surface-300 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-mono text-white leading-snug line-clamp-2">{t.statement}</p>
                  <Badge variant={STATUS_BADGE[t.status] ?? 'proposed'} className="shrink-0 text-[10px]">
                    {t.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {t.category && (
                    <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[t.category] ?? 'text-surface-400')}>
                      {t.category}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-for-400">
                    {Math.round(t.blue_pct)}% FOR
                  </span>
                  <span className="text-[10px] font-mono text-surface-500">
                    {t.total_votes.toLocaleString()} votes
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          className="text-xs font-mono text-surface-500 hover:text-purple transition-colors"
        >
          or enter a custom statement →
        </button>
      </div>
    </div>
  )
}

// ─── Steelman card ────────────────────────────────────────────────────────────

function SteelmanCard({
  side,
  arg,
  expanded,
  onToggle,
}: {
  side: 'for' | 'against'
  arg: SteelmanArgument
  expanded: boolean
  onToggle: () => void
}) {
  const isFor = side === 'for'
  const accentText = isFor ? 'text-for-400' : 'text-against-400'
  const accentBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const accentBg = isFor ? 'bg-for-500/8' : 'bg-against-500/8'
  const accentGlow = isFor ? 'shadow-for-500/10' : 'shadow-against-500/10'
  const accentBadgeBg = isFor ? 'bg-for-500/15 text-for-400 border-for-500/30' : 'bg-against-500/15 text-against-400 border-against-500/30'
  const Icon = isFor ? ThumbsUp : ThumbsDown
  const label = isFor ? 'FOR' : 'AGAINST'

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border p-5 space-y-4 shadow-lg',
        'bg-surface-100',
        accentBorder,
        accentGlow,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border', accentBadgeBg)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <span className={cn('text-xs font-mono font-bold uppercase tracking-widest', accentText)}>
              {label}
            </span>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">Steelmanned Position</p>
          </div>
        </div>
        <span className={cn(
          'text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border',
          accentBadgeBg,
        )}>
          Best Case
        </span>
      </div>

      {/* Thesis */}
      <div className={cn('rounded-xl p-4 border', accentBg, accentBorder)}>
        <p className="text-sm font-mono text-white leading-relaxed italic">&ldquo;{arg.thesis}&rdquo;</p>
      </div>

      {/* Core claims (always visible) */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-500">Core Claims</p>
        <ul className="space-y-1.5">
          {arg.core_claims.map((claim, i) => (
            <li key={i} className="flex items-start gap-2">
              <ChevronRight className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', accentText)} />
              <p className="text-xs font-mono text-surface-200 leading-relaxed">{claim}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Expand/collapse */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg',
          'text-xs font-mono text-surface-500 hover:text-white transition-colors',
          'border border-surface-300 hover:border-surface-400 hover:bg-surface-200',
        )}
      >
        {expanded ? (
          <>Less detail <ChevronDown className="h-3.5 w-3.5 rotate-180" /></>
        ) : (
          <>Full steelman <ChevronDown className="h-3.5 w-3.5" /></>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-4"
          >
            {/* Evidence */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <BarChart2 className={cn('h-3.5 w-3.5', accentText)} />
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-500">Strongest Evidence</p>
              </div>
              <p className="text-xs font-mono text-surface-300 leading-relaxed pl-5">{arg.strongest_evidence}</p>
            </div>

            {/* Moral foundation */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Scale className={cn('h-3.5 w-3.5', accentText)} />
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-500">Moral Foundation</p>
              </div>
              <p className="text-xs font-mono text-surface-300 leading-relaxed pl-5">{arg.moral_foundation}</p>
            </div>

            {/* Rebuttal */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className={cn('h-3.5 w-3.5', accentText)} />
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-500">
                  Rebuttal to {isFor ? 'AGAINST' : 'FOR'}
                </p>
              </div>
              <p className="text-xs font-mono text-surface-300 leading-relaxed pl-5">{arg.rebuttal_to_opposition}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Result skeleton ──────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 bg-surface-300/40 rounded-xl" />
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-300 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-surface-300/60 rounded-lg" />
              <div className="space-y-1">
                <div className="h-3 w-16 bg-surface-300/60 rounded" />
                <div className="h-2.5 w-24 bg-surface-300/40 rounded" />
              </div>
            </div>
            <div className="h-16 bg-surface-300/40 rounded-xl" />
            <div className="space-y-2">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-3 bg-surface-300/40 rounded" style={{ width: `${80 - j * 10}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="h-20 bg-surface-300/40 rounded-xl" />
    </div>
  )
}

// ─── Main inner component (needs searchParams) ────────────────────────────────

function SteelmanInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const topicId = searchParams.get('topic')

  const [selectedTopic, setSelectedTopic] = useState<TopicResult | null>(null)
  const [customStatement, setCustomStatement] = useState<string | null>(null)
  const [result, setResult] = useState<SteelmanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFor, setExpandedFor] = useState(false)
  const [expandedAgainst, setExpandedAgainst] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load topic from URL param on mount
  useEffect(() => {
    if (!topicId) return
    fetch(`/api/topics/${topicId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.topic) setSelectedTopic(data.topic as TopicResult)
      })
      .catch(() => {/* non-critical */})
  }, [topicId])

  const generate = useCallback(async (topic: TopicResult | null, custom?: string) => {
    const statement = custom ?? topic?.statement
    if (!statement) return

    setLoading(true)
    setError(null)
    setResult(null)
    setExpandedFor(false)
    setExpandedAgainst(false)

    try {
      const res = await fetch('/api/steelman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topic?.id ?? null,
          statement,
          category: topic?.category ?? null,
        }),
      })

      if (res.status === 401) { router.push('/login'); return }

      const data = await res.json() as SteelmanResult
      if (data.unavailable) {
        setError('AI steelman is temporarily unavailable. Try again shortly.')
        return
      }
      setResult(data)
    } catch {
      setError('Failed to generate steelman. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  function handleSelect(topic: TopicResult | null, custom?: string) {
    if (custom) {
      setSelectedTopic(null)
      setCustomStatement(custom)
      generate(null, custom)
    } else if (topic) {
      setSelectedTopic(topic)
      setCustomStatement(null)
      generate(topic)
    }
  }

  function handleReset() {
    setSelectedTopic(null)
    setCustomStatement(null)
    setResult(null)
    setError(null)
  }

  function handleCopy() {
    if (!result) return
    const text = [
      `STEELMAN: ${result.statement}`,
      '',
      '── FOR ──',
      result.for_steelman.thesis,
      result.for_steelman.core_claims.map((c) => `• ${c}`).join('\n'),
      '',
      '── AGAINST ──',
      result.against_steelman.thesis,
      result.against_steelman.core_claims.map((c) => `• ${c}`).join('\n'),
      '',
      `Synthesis: ${result.synthesis}`,
      '',
      'Generated by Lobby Market — lobby.market/steelman',
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const activeStatement = customStatement ?? selectedTopic?.statement

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30">
                <Brain className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white leading-none">
                  Civic Steelman
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  The strongest case for both sides
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm font-mono text-surface-400 leading-relaxed max-w-xl">
            A <span className="text-purple">steelman</span> is the most charitable, most intellectually rigorous version of any position —
            the argument its smartest proponent would actually make. Understand both sides at their best.
          </p>
        </div>

        {/* Search / active statement */}
        <div className="mb-8">
          {!activeStatement ? (
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
              <TopicSearch onSelect={handleSelect} />
            </div>
          ) : (
            <div className="bg-surface-100 border border-purple/25 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 shrink-0 mt-0.5">
                    <Scale className="h-4 w-4 text-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-purple mb-1">Steelmanning</p>
                    <p className="text-sm font-mono text-white leading-snug">{activeStatement}</p>
                    {selectedTopic && (
                      <div className="flex items-center gap-3 mt-2">
                        {selectedTopic.category && (
                          <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[selectedTopic.category] ?? 'text-surface-400')}>
                            {selectedTopic.category}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-for-400">
                          {Math.round(selectedTopic.blue_pct)}% FOR
                        </span>
                        <span className="text-[10px] font-mono text-surface-500">
                          {selectedTopic.total_votes.toLocaleString()} votes
                        </span>
                        <Link
                          href={`/topic/${selectedTopic.id}`}
                          className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
                        >
                          view topic <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-surface-500 hover:text-white transition-colors shrink-0"
                  aria-label="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-3 mb-6 px-1">
                <Loader2 className="h-4 w-4 text-purple animate-spin" />
                <p className="text-sm font-mono text-surface-400">
                  Generating steelmanned arguments…
                </p>
              </div>
              <ResultSkeleton />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-against-500/30 bg-against-500/8 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400">{error}</p>
              {activeStatement && (
                <button
                  type="button"
                  onClick={() => generate(selectedTopic, customStatement ?? undefined)}
                  className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-mono text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              )}
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Community vote strip */}
              {result.community_vote && (
                <div className="flex items-center gap-3 bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
                  <BarChart2 className="h-4 w-4 text-surface-500 shrink-0" />
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-xs font-mono text-for-400">
                      {Math.round(result.community_vote.blue_pct)}% FOR
                    </span>
                    <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-for-500 to-for-400 rounded-full transition-all"
                        style={{ width: `${result.community_vote.blue_pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-against-400">
                      {Math.round(100 - result.community_vote.blue_pct)}% AGAINST
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 shrink-0">
                    {result.community_vote.total_votes.toLocaleString()} votes
                  </span>
                </div>
              )}

              {/* Philosophical tension badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-purple/10 border border-purple/25 rounded-lg px-3 py-1.5">
                  <Zap className="h-3.5 w-3.5 text-purple" />
                  <span className="text-xs font-mono text-purple">{result.philosophical_tension}</span>
                </div>
              </div>

              {/* Two steelman cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <SteelmanCard
                  side="for"
                  arg={result.for_steelman}
                  expanded={expandedFor}
                  onToggle={() => setExpandedFor((v) => !v)}
                />
                <SteelmanCard
                  side="against"
                  arg={result.against_steelman}
                  expanded={expandedAgainst}
                  onToggle={() => setExpandedAgainst((v) => !v)}
                />
              </div>

              {/* Synthesis */}
              <div className="rounded-2xl border border-gold/25 bg-gold/6 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-gold" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-gold">
                    The Synthesis
                  </span>
                </div>
                <p className="text-sm font-mono text-surface-200 leading-relaxed italic">
                  &ldquo;{result.synthesis}&rdquo;
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-2">
                  What both sides ultimately agree on — beneath the disagreement
                </p>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono transition-all',
                    copied
                      ? 'bg-emerald/10 border-emerald/30 text-emerald'
                      : 'bg-surface-100 border-surface-300 hover:border-surface-400 text-white',
                  )}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy Steelman'}
                </button>

                <button
                  type="button"
                  onClick={() => generate(selectedTopic, customStatement ?? undefined)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 hover:border-surface-400 bg-surface-100 text-sm font-mono text-white transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>

                {selectedTopic && (
                  <Link
                    href={`/topic/${selectedTopic.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-for-500/30 bg-for-500/8 text-sm font-mono text-for-400 hover:bg-for-500/15 transition-all"
                  >
                    <Gavel className="h-3.5 w-3.5" />
                    Go Vote
                  </Link>
                )}
              </div>
            </motion.div>
          )}

          {!loading && !error && !result && !activeStatement && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* How it works */}
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-6">
                <h2 className="font-mono text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple" />
                  How Steelmanning Works
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    {
                      step: '01',
                      title: 'Choose a topic',
                      desc: 'Search any active debate or enter your own policy statement.',
                      color: 'text-for-400',
                    },
                    {
                      step: '02',
                      title: 'AI builds both cases',
                      desc: 'Claude constructs the strongest version of FOR and AGAINST — not a strawman, but the best-case argument.',
                      color: 'text-purple',
                    },
                    {
                      step: '03',
                      title: 'Understand the tension',
                      desc: 'A synthesis reveals the shared values beneath the disagreement — and what the debate is really about.',
                      color: 'text-gold',
                    },
                  ].map(({ step, title, desc, color }) => (
                    <div key={step} className="space-y-2">
                      <span className={cn('text-xs font-mono font-bold', color)}>{step}</span>
                      <p className="text-sm font-mono font-semibold text-white">{title}</p>
                      <p className="text-xs font-mono text-surface-400 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related tools */}
              <div>
                <p className="text-xs font-mono text-surface-500 mb-3">Related tools</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { href: '/coach', label: 'Argument Coach', desc: 'Get AI feedback on your draft', icon: Sparkles, color: 'text-for-400' },
                    { href: '/spar', label: 'AI Sparring', desc: 'Debate a live AI opponent', icon: Flame, color: 'text-against-400' },
                    { href: '/simulate', label: 'Policy Simulator', desc: 'Model real-world outcomes', icon: BarChart2, color: 'text-emerald' },
                  ].map(({ href, label, desc, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                    >
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', color)} />
                      <div>
                        <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                          {label}
                        </p>
                        <p className="text-[10px] font-mono text-surface-500 mt-0.5">{desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Page (Suspense boundary for useSearchParams) ─────────────────────────────

export default function SteelmanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-purple animate-spin" />
        </div>
      }
    >
      <SteelmanInner />
    </Suspense>
  )
}
