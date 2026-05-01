'use client'

/**
 * /prep — Civic Debate Prep
 *
 * Pick a platform topic, choose your side (FOR / AGAINST), and receive a
 * full debate dossier: your strongest arguments (drawn from real platform
 * data), the best counterarguments you'll face, and — when Claude is
 * available — AI-generated talking points, an opening hook, and a closer.
 *
 * Distinct from /coach (critiques your draft) and /spar (live AI opponent).
 * This is pure preparation: know your material, know their material.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  Lightbulb,
  Loader2,
  Mic,
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
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { PrepResponse, PrepArgument, TalkingPoints } from '@/app/api/prep/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const ROLE_COLOR: Record<string, string> = {
  person: 'text-surface-600',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
}

// ─── Topic search ──────────────────────────────────────────────────────────────

interface TopicHit {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

function TopicSearch({ onSelect }: { onSelect: (t: TopicHit) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicHit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q.trim() || q.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics`)
        if (res.ok) {
          const data = await res.json() as { results?: TopicHit[] }
          setResults((data.results ?? []).slice(0, 8))
        }
      } catch {
        // best-effort
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [])

  useEffect(() => {
    search(query)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a topic to prepare for..."
          className={cn(
            'w-full h-12 pl-10 pr-10 rounded-xl',
            'bg-surface-200 border border-surface-300 text-white placeholder-surface-500',
            'font-mono text-sm focus:outline-none focus:ring-2 focus:ring-for-500/50 focus:border-for-500/50',
            'transition-colors',
          )}
          aria-label="Search for a topic"
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" aria-hidden="true" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-10 top-full mt-1 w-full rounded-xl border border-surface-300 bg-surface-100 overflow-hidden shadow-xl"
          >
            {results.map((t) => (
              <button
                key={t.id}
                onClick={() => { onSelect(t); setQuery(''); setResults([]) }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-snug">{t.statement}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.category && (
                      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{t.category}</span>
                    )}
                    <span className="text-[10px] font-mono text-for-400">{Math.round(t.blue_pct)}% FOR</span>
                    <span className="text-[10px] font-mono text-surface-600">{(t.total_votes ?? 0).toLocaleString()} votes</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" aria-hidden="true" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
  index,
}: {
  arg: PrepArgument
  side: 'for' | 'against'
  index: number
}) {
  const isFor = side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/35'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/35',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank bubble */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-mono font-bold',
            isFor
              ? 'bg-for-600/20 text-for-400 ring-1 ring-for-500/30'
              : 'bg-against-600/20 text-against-400 ring-1 ring-against-500/30',
          )}
          aria-hidden="true"
        >
          #{index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-relaxed mb-2 font-mono">{arg.content}</p>

          <div className="flex items-center gap-3 flex-wrap">
            {arg.author && (
              <Link
                href={`/profile/${arg.author.username}`}
                className="flex items-center gap-1.5 min-w-0"
              >
                <Avatar
                  src={arg.author.avatar_url}
                  fallback={arg.author.display_name || arg.author.username}
                  size="xs"
                />
                <span className={cn('text-[11px] font-mono truncate', ROLE_COLOR[arg.author.role] ?? 'text-surface-500')}>
                  @{arg.author.username}
                </span>
              </Link>
            )}
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
              {arg.upvotes}
            </span>
            <span className="text-[11px] font-mono text-surface-600">{relativeTime(arg.created_at)}</span>
            {arg.source_url && (
              <a
                href={arg.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-mono text-emerald hover:text-emerald/80 transition-colors"
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                {hostnameOf(arg.source_url)}
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Talking points panel ─────────────────────────────────────────────────────

function TalkingPointsPanel({ points, side }: { points: TalkingPoints; side: 'for' | 'against' }) {
  const isFor = side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-purple/30 bg-purple/5 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-purple/20">
        <Bot className="h-4 w-4 text-purple" aria-hidden="true" />
        <span className="text-xs font-mono font-semibold text-purple uppercase tracking-wider">
          AI Debate Coach
        </span>
        <Sparkles className="h-3.5 w-3.5 text-purple/60 ml-auto" aria-hidden="true" />
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Opening hook */}
        {points.opening_hook && (
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Mic className="h-3 w-3" aria-hidden="true" /> Opening Hook
            </p>
            <blockquote
              className={cn(
                'font-mono text-sm font-medium leading-relaxed border-l-2 pl-4 py-1',
                isFor ? 'text-for-200 border-for-500/60' : 'text-against-200 border-against-500/60',
              )}
            >
              &quot;{points.opening_hook}&quot;
            </blockquote>
          </div>
        )}

        {/* Core arguments */}
        {points.core_arguments?.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3" aria-hidden="true" /> Core Arguments
            </p>
            <ul className="space-y-2">
              {points.core_arguments.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-mono text-surface-200 leading-relaxed">
                  <Check className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Counter rebuttals */}
        {points.counter_prep?.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Shield className="h-3 w-3" aria-hidden="true" /> Rebuttal Prep
            </p>
            <ul className="space-y-2">
              {points.counter_prep.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-mono text-surface-200 leading-relaxed">
                  <ArrowRight className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key stat */}
        {points.key_stat && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
            <p className="text-[10px] font-mono text-gold/70 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Award className="h-3 w-3" aria-hidden="true" /> Key Statistic
            </p>
            <p className="text-sm font-mono text-gold leading-relaxed">{points.key_stat}</p>
          </div>
        )}

        {/* Closing line */}
        {points.closing_line && (
          <div>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Gavel className="h-3 w-3" aria-hidden="true" /> Closing Statement
            </p>
            <blockquote
              className={cn(
                'font-mono text-sm font-medium leading-relaxed border-l-2 pl-4 py-1',
                isFor ? 'text-for-200 border-for-500/60' : 'text-against-200 border-against-500/60',
              )}
            >
              &quot;{points.closing_line}&quot;
            </blockquote>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

function PrepInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedTopic, setSelectedTopic] = useState<TopicHit | null>(null)
  const [side, setSide] = useState<'for' | 'against' | null>(null)
  const [prepData, setPrepData] = useState<PrepResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Support ?topic_id=<id>&side=<for|against> deep-link
  useEffect(() => {
    const tid = searchParams.get('topic_id')
    const s = searchParams.get('side') as 'for' | 'against' | null
    if (tid && (s === 'for' || s === 'against')) {
      fetch(`/api/prep?topic_id=${tid}&side=${s}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: PrepResponse | null) => {
          if (d) {
            setPrepData(d)
            setSelectedTopic({
              id: d.topic.id,
              statement: d.topic.statement,
              category: d.topic.category,
              status: d.topic.status,
              blue_pct: d.topic.blue_pct,
              total_votes: d.topic.total_votes,
            })
            setSide(s)
          }
        })
        .catch(() => {})
    }
  }, [searchParams])

  const loadPrep = useCallback(async (topicId: string, chosenSide: 'for' | 'against') => {
    setLoading(true)
    setError(null)
    setPrepData(null)
    try {
      const res = await fetch(`/api/prep?topic_id=${topicId}&side=${chosenSide}`)
      if (!res.ok) throw new Error('Failed to load prep data')
      const data = await res.json() as PrepResponse
      setPrepData(data)
      router.replace(`/prep?topic_id=${topicId}&side=${chosenSide}`, { scroll: false })
    } catch {
      setError('Could not load debate prep. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  const handleTopicSelect = (t: TopicHit) => {
    setSelectedTopic(t)
    setSide(null)
    setPrepData(null)
    setError(null)
  }

  const handleSideSelect = (s: 'for' | 'against') => {
    setSide(s)
    if (selectedTopic) {
      loadPrep(selectedTopic.id, s)
    }
  }

  const handleReset = () => {
    setSelectedTopic(null)
    setSide(null)
    setPrepData(null)
    setError(null)
    router.replace('/prep', { scroll: false })
  }

  const handleCopyLink = async () => {
    if (!selectedTopic || !side) return
    const url = `${window.location.origin}/prep?topic_id=${selectedTopic.id}&side=${side}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const forPct = prepData ? prepData.topic.blue_pct : (selectedTopic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-14">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
            <BookOpen className="h-5 w-5 text-purple" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Debate Prep</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Know your material. Know their material. Win the argument.
            </p>
          </div>
        </div>

        {/* ── Step 1: Topic search ── */}
        <AnimatePresence mode="wait">
          {!prepData && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Topic search */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Step 1 — Choose your topic
                </p>

                {!selectedTopic ? (
                  <TopicSearch onSelect={handleTopicSelect} />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={STATUS_BADGE[selectedTopic.status] ?? 'proposed'}>
                          {selectedTopic.status}
                        </Badge>
                        {selectedTopic.category && (
                          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                            {selectedTopic.category}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-white leading-snug">{selectedTopic.statement}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono">
                        <span className="text-for-400">{Math.round(selectedTopic.blue_pct)}% FOR</span>
                        <span className="text-against-400">{Math.round(100 - selectedTopic.blue_pct)}% AGAINST</span>
                        <span className="text-surface-600">{selectedTopic.total_votes.toLocaleString()} votes</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedTopic(null); setSide(null) }}
                      className="text-surface-500 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                      aria-label="Clear topic selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Side picker */}
              <AnimatePresence>
                {selectedTopic && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
                  >
                    <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-4">
                      Step 2 — Choose your side
                    </p>

                    {/* Split bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className="text-for-400 flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" aria-hidden="true" /> FOR {forPct}%
                        </span>
                        <span className="text-against-400 flex items-center gap-1">
                          AGAINST {againstPct}%
                          <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-surface-300 flex overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-for-700 to-for-400" style={{ width: `${forPct}%` }} />
                        <div className="h-full bg-against-500 flex-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleSideSelect('for')}
                        disabled={loading}
                        className={cn(
                          'group flex flex-col items-center gap-2 rounded-xl border py-5 px-3 transition-all',
                          'font-mono font-semibold text-sm',
                          side === 'for'
                            ? 'bg-for-600/20 border-for-500/60 text-for-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/40 hover:text-for-300 hover:bg-for-600/10',
                          loading && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <ThumbsUp className="h-6 w-6" aria-hidden="true" />
                        I argue FOR
                        <span className="text-[11px] font-normal opacity-70">I support this</span>
                      </button>
                      <button
                        onClick={() => handleSideSelect('against')}
                        disabled={loading}
                        className={cn(
                          'group flex flex-col items-center gap-2 rounded-xl border py-5 px-3 transition-all',
                          'font-mono font-semibold text-sm',
                          side === 'against'
                            ? 'bg-against-600/20 border-against-500/60 text-against-300'
                            : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-300 hover:bg-against-600/10',
                          loading && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <ThumbsDown className="h-6 w-6" aria-hidden="true" />
                        I argue AGAINST
                        <span className="text-[11px] font-normal opacity-70">I oppose this</span>
                      </button>
                    </div>

                    {loading && (
                      <div className="flex items-center justify-center gap-2 mt-4 text-xs font-mono text-surface-500">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Building your dossier…
                      </div>
                    )}
                    {error && (
                      <p className="text-xs font-mono text-against-400 mt-3 text-center">{error}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dossier ── */}
        <AnimatePresence>
          {prepData && (
            <motion.div
              key="dossier"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Dossier header */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn(
                    'flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl border',
                    side === 'for'
                      ? 'bg-for-600/10 border-for-500/30'
                      : 'bg-against-600/10 border-against-500/30',
                  )}>
                    {side === 'for'
                      ? <ThumbsUp className="h-5 w-5 text-for-400" aria-hidden="true" />
                      : <ThumbsDown className="h-5 w-5 text-against-400" aria-hidden="true" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={STATUS_BADGE[prepData.topic.status] ?? 'proposed'}>
                        {prepData.topic.status}
                      </Badge>
                      {prepData.topic.category && (
                        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                          {prepData.topic.category}
                        </span>
                      )}
                      <span className={cn(
                        'ml-auto text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border',
                        side === 'for'
                          ? 'bg-for-500/15 text-for-400 border-for-500/30'
                          : 'bg-against-500/15 text-against-400 border-against-500/30',
                      )}>
                        ARGUING {side?.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white leading-snug">
                      {prepData.topic.statement}
                    </h2>
                  </div>
                </div>

                {/* Vote split */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-for-400 flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                      FOR {prepData.topic.blue_pct}%
                    </span>
                    <span className="text-surface-600 text-center">
                      {prepData.topic.total_votes.toLocaleString()} votes cast
                    </span>
                    <span className="text-against-400 flex items-center gap-1">
                      AGAINST {100 - prepData.topic.blue_pct}%
                      <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-300 flex overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-for-700 to-for-400"
                      style={{ width: `${prepData.topic.blue_pct}%` }}
                    />
                    <div className="h-full bg-against-500 flex-1" />
                  </div>
                </div>

                {/* Consensus note */}
                <div className="flex items-start gap-2 text-xs font-mono text-surface-400 bg-surface-200/60 rounded-lg px-3 py-2.5">
                  <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {prepData.consensus_note}
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-300">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    aria-label="Start over with a new topic"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    New topic
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
                      aria-label="Copy shareable link"
                    >
                      {copied
                        ? <><Check className="h-3.5 w-3.5 text-emerald" /> Copied</>
                        : <><Share2 className="h-3.5 w-3.5" /> Share</>
                      }
                    </button>
                    <Link
                      href={`/topic/${prepData.topic.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-for-600/10 border border-for-500/30 text-for-400 hover:bg-for-600/20 transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      Debate now
                    </Link>
                  </div>
                </div>
              </div>

              {/* AI talking points */}
              {prepData.talking_points && !prepData.talking_points.unavailable && (
                <TalkingPointsPanel points={prepData.talking_points} side={side!} />
              )}

              {/* Your arsenal */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider',
                    side === 'for' ? 'text-for-400' : 'text-against-400',
                  )}>
                    {side === 'for'
                      ? <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      : <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                    }
                    Your Arsenal — Top {side === 'for' ? 'FOR' : 'AGAINST'} Arguments
                  </div>
                  <span className="ml-auto text-[11px] font-mono text-surface-600">
                    {prepData.your_arguments.length} argument{prepData.your_arguments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {prepData.your_arguments.length === 0 ? (
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-8 text-center">
                    <Lightbulb className="h-8 w-8 text-surface-500 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm font-mono text-surface-500">
                      No {side === 'for' ? 'FOR' : 'AGAINST'} arguments posted yet. Be the first to make the case.
                    </p>
                    <Link
                      href={`/topic/${prepData.topic.id}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      Open the debate
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prepData.your_arguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} side={side!} index={i} />
                    ))}
                  </div>
                )}
              </div>

              {/* Counter intelligence */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider',
                    side === 'for' ? 'text-against-400' : 'text-for-400',
                  )}>
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    Counter-Intelligence — What You&apos;ll Face
                  </div>
                  <span className="ml-auto text-[11px] font-mono text-surface-600">
                    {prepData.counter_arguments.length} argument{prepData.counter_arguments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {prepData.counter_arguments.length === 0 ? (
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-8 text-center">
                    <Scale className="h-8 w-8 text-surface-500 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm font-mono text-surface-500">
                      No opposition arguments yet. You have the floor.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prepData.counter_arguments.map((arg, i) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        side={side === 'for' ? 'against' : 'for'}
                        index={i}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 text-center space-y-3">
                <p className="text-sm font-mono text-surface-400">
                  Ready to put your prep to work?
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link
                    href={`/topic/${prepData.topic.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
                  >
                    <Flame className="h-4 w-4" aria-hidden="true" />
                    Join the debate
                  </Link>
                  <Link
                    href={`/spar/${prepData.topic.id}?side=${side}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/10 border border-purple/30 text-purple text-sm font-mono font-medium hover:bg-purple/20 transition-colors"
                  >
                    <Bot className="h-4 w-4" aria-hidden="true" />
                    Spar vs AI first
                  </Link>
                  <Link
                    href={`/coach?topic=${encodeURIComponent(prepData.topic.statement)}&side=${side}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono font-medium hover:text-white hover:bg-surface-300 transition-colors"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    Draft an argument
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Intro (no topic selected) ── */}
        {!selectedTopic && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {[
              {
                icon: BookOpen,
                color: 'text-for-400',
                bg: 'bg-for-500/10',
                title: 'Your Arguments',
                desc: 'The top-voted arguments from real platform debaters on your side.',
              },
              {
                icon: Shield,
                color: 'text-against-400',
                bg: 'bg-against-500/10',
                title: 'Counter-Intel',
                desc: "The best arguments against you — know them before you face them.",
              },
              {
                icon: Bot,
                color: 'text-purple',
                bg: 'bg-purple/10',
                title: 'AI Coaching',
                desc: 'Opening hook, core points, rebuttals, and a closing line from Claude.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center"
              >
                <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl mx-auto mb-3', card.bg)}>
                  <card.icon className={cn('h-5 w-5', card.color)} aria-hidden="true" />
                </div>
                <p className="text-sm font-mono font-semibold text-white mb-1">{card.title}</p>
                <p className="text-xs font-mono text-surface-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}

export default function PrepPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
      </div>
    }>
      <PrepInner />
    </Suspense>
  )
}
