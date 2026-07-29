'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  Gavel,
  GitCompare,
  Loader2,
  MessageSquare,
  Mic,
  Scale,
  Search,
  Tag,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { TopicCompareResponse, CompareTopic } from '@/app/api/topics/[id]/compare/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function consensusLabel(pct: number): string {
  if (pct >= 80) return 'Overwhelming'
  if (pct >= 70) return 'Strong'
  if (pct >= 60) return 'Solid'
  if (pct >= 55) return 'Narrow'
  if (pct >= 45) return 'Contested'
  return 'Minority'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: typeof Zap }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500', Icon: FileText },
  active:   { label: 'Active',   color: 'text-for-400',     Icon: Zap },
  voting:   { label: 'Voting',   color: 'text-purple',      Icon: Scale },
  law:      { label: 'LAW',      color: 'text-gold',        Icon: Gavel },
  failed:   { label: 'Failed',   color: 'text-against-400', Icon: X },
  continued: { label: 'Continued', color: 'text-for-300',   Icon: TrendingUp },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-against-400',
  Health:      'text-emerald',
  Education:   'text-gold',
  Environment: 'text-emerald',
}

// ─── Topic Search Input ───────────────────────────────────────────────────────

interface SearchResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface TopicSearchInputProps {
  label: string
  accentClass: string
  onSelect: (topic: SearchResult) => void
  excludeId?: string
  currentTopic?: CompareTopic | null
}

function TopicSearchInput({ label, accentClass, onSelect, excludeId, currentTopic }: TopicSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=6`,
        )
        if (res.ok) {
          const json = (await res.json()) as { results: SearchResult[] }
          const filtered = (json.results ?? []).filter((t) => t.id !== excludeId)
          setResults(filtered.slice(0, 6))
          setOpen(filtered.length > 0)
        }
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [query, excludeId])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <p className={cn('text-xs font-mono font-bold uppercase tracking-widest mb-2', accentClass)}>
        {label}
      </p>

      {/* Selected topic display */}
      {currentTopic && (
        <div className="mb-2 p-3 rounded-xl bg-surface-200 border border-surface-300">
          <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">
            {currentTopic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {currentTopic.category && (
              <span className={cn('text-[10px] font-mono', CATEGORY_COLORS[currentTopic.category] ?? 'text-surface-500')}>
                {currentTopic.category}
              </span>
            )}
            <span className="text-[10px] text-surface-500">
              {fmtNum(currentTopic.total_votes)} votes
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={currentTopic ? 'Search for a different topic…' : 'Search topics…'}
          className={cn(
            'w-full pl-9 pr-9 py-2.5 rounded-xl text-sm',
            'bg-surface-200 border border-surface-300 text-white placeholder-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50 transition-all',
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
          >
            {results.map((t) => {
              const cfg = STATUS_CONFIG[t.status]
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelect(t)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-surface-200 transition-colors border-b border-surface-300/50 last:border-0"
                >
                  {cfg && <cfg.Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', cfg.color)} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium line-clamp-2 leading-snug">
                      {t.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.category && (
                        <span className={cn('text-[10px] font-mono', CATEGORY_COLORS[t.category] ?? 'text-surface-500')}>
                          {t.category}
                        </span>
                      )}
                      <span className="text-[10px] text-surface-500">{fmtNum(t.total_votes)} votes</span>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ pct, flip = false }: { pct: number; flip?: boolean }) {
  const forPct = Math.round(pct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1 text-[11px] font-mono', flip && 'flex-row-reverse')}>
        <span className="text-for-400 font-bold">{forPct}%</span>
        <span className="text-surface-500">·</span>
        <span className="text-against-400 font-bold">{againstPct}%</span>
      </div>
      <div className={cn('flex h-2 rounded-full overflow-hidden', flip && 'flex-row-reverse')}>
        <div className="bg-for-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
        <div className="bg-against-500 transition-all duration-500" style={{ width: `${againstPct}%` }} />
      </div>
      <div className={cn('flex items-center gap-1 text-[10px] text-surface-500', flip && 'flex-row-reverse')}>
        <ThumbsUp className="h-3 w-3 text-for-500" />
        <span>For</span>
        <span className="mx-1">·</span>
        <ThumbsDown className="h-3 w-3 text-against-500" />
        <span>Against</span>
      </div>
    </div>
  )
}

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  primaryValue,
  secondaryValue,
  primaryWins,
  highlight = false,
}: {
  label: string
  primaryValue: React.ReactNode
  secondaryValue: React.ReactNode
  primaryWins?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3.5',
        'border-b border-surface-300/50 last:border-0',
        highlight && 'bg-surface-200/50',
      )}
    >
      <div className={cn('text-sm', primaryWins === true && 'font-semibold text-white')}>
        {primaryValue}
      </div>
      <div className="text-[10px] font-mono text-surface-500 text-center whitespace-nowrap px-2">
        {label}
      </div>
      <div className={cn('text-sm text-right', primaryWins === false && 'font-semibold text-white')}>
        {secondaryValue}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CompareTopicsClientProps {
  primaryId: string
}

export function CompareTopicsClient({ primaryId }: CompareTopicsClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [data, setData] = useState<TopicCompareResponse | null>(null)
  const [secondaryId, setSecondaryId] = useState<string>(searchParams.get('with') ?? '')
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComparison = useCallback(
    async (withId: string) => {
      if (!withId) return
      setLoadingData(true)
      setError(null)
      try {
        const res = await fetch(`/api/topics/${primaryId}/compare?with=${withId}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError((body as { error?: string }).error ?? 'Failed to load comparison')
          return
        }
        const json = (await res.json()) as TopicCompareResponse
        setData(json)
        router.replace(`/topic/${primaryId}/compare?with=${withId}`, { scroll: false })
      } catch {
        setError('Network error — please try again')
      } finally {
        setLoadingData(false)
      }
    },
    [primaryId, router],
  )

  // Load from URL param on mount
  useEffect(() => {
    const withId = searchParams.get('with')
    if (withId) {
      setSecondaryId(withId)
      fetchComparison(withId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectPrimary(t: { id: string }) {
    if (t.id !== primaryId) {
      router.push(`/topic/${t.id}/compare${secondaryId ? `?with=${secondaryId}` : ''}`)
    }
  }

  function handleSelectSecondary(t: { id: string }) {
    if (t.id === primaryId) return
    setSecondaryId(t.id)
    fetchComparison(t.id)
  }

  const p = data?.primary
  const s = data?.secondary

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${primaryId}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-for-400" />
            <h1 className="text-base font-mono font-bold text-white">Topic Compare</h1>
          </div>
        </div>

        {/* Picker row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <TopicSearchInput
              label="Topic A"
              accentClass="text-for-400"
              onSelect={handleSelectPrimary}
              excludeId={secondaryId}
              currentTopic={data?.primary ?? null}
            />
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <TopicSearchInput
              label="Topic B"
              accentClass="text-against-400"
              onSelect={handleSelectSecondary}
              excludeId={primaryId}
              currentTopic={s ?? null}
            />
          </div>
        </div>

        {/* Loading */}
        {loadingData && (
          <div className="flex items-center justify-center gap-2 py-16 text-surface-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading comparison…</span>
          </div>
        )}

        {/* Error */}
        {!loadingData && error && (
          <div className="text-center py-12 text-against-400 text-sm">{error}</div>
        )}

        {/* Empty prompt */}
        {!loadingData && !data && !error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 text-surface-500"
          >
            <GitCompare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Select a second topic to compare</p>
            <p className="text-xs text-surface-600 mt-1">
              Search above to find any topic on the platform
            </p>
          </motion.div>
        )}

        {/* Comparison */}
        <AnimatePresence mode="wait">
          {!loadingData && data && p && s && (
            <motion.div
              key={`${p.id}-${s.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Category / shared tags ribbon */}
              {(data.same_category || data.shared_tags.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {data.same_category && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-400 font-mono">
                      <Check className="h-3 w-3 text-emerald" />
                      Same category
                    </span>
                  )}
                  {data.shared_tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-400 font-mono"
                    >
                      <Tag className="h-3 w-3 text-for-400" />
                      #{tag}
                    </span>
                  ))}
                  {data.user_voted_both && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-for-500/10 border border-for-500/20 text-for-300 font-mono">
                      <Check className="h-3 w-3" />
                      You voted on both
                    </span>
                  )}
                </div>
              )}

              {/* Statement panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { topic: p, side: 'A', accent: 'border-for-500/30', label: 'text-for-400' },
                  { topic: s, side: 'B', accent: 'border-against-500/30', label: 'text-against-400' },
                ].map(({ topic, side, accent, label }) => {
                  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
                  return (
                    <div
                      key={topic.id}
                      className={cn(
                        'rounded-2xl bg-surface-100 border-2 p-5 space-y-3',
                        accent,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', label)}>
                          Topic {side}
                        </span>
                        <span className={cn('text-[11px] font-mono font-semibold flex items-center gap-1', cfg.color)}>
                          <cfg.Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <Link
                        href={`/topic/${topic.id}`}
                        className="block text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug line-clamp-3"
                      >
                        {topic.statement}
                      </Link>
                      {topic.category && (
                        <span className={cn('inline-block text-[10px] font-mono', CATEGORY_COLORS[topic.category] ?? 'text-surface-500')}>
                          {topic.category} · {topic.scope}
                        </span>
                      )}
                      <VoteBar pct={topic.blue_pct} flip={side === 'B'} />
                    </div>
                  )
                })}
              </div>

              {/* Delta summary */}
              {data.vote_delta > 0 && (
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex items-center justify-center gap-2 text-sm text-surface-400">
                  <BarChart2 className="h-4 w-4 text-for-400" />
                  <span>
                    Vote split differs by{' '}
                    <strong className="text-white">{data.vote_delta.toFixed(1)} pp</strong>
                  </span>
                </div>
              )}

              {/* Head-to-head stat table */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 bg-surface-200/60 border-b border-surface-300">
                  <Link
                    href={`/topic/${p.id}`}
                    className="text-xs font-mono font-bold text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                  >
                    Topic A <ChevronRight className="h-3 w-3" />
                  </Link>
                  <Scale className="h-4 w-4 text-surface-500 mx-auto" />
                  <Link
                    href={`/topic/${s.id}`}
                    className="text-xs font-mono font-bold text-against-400 hover:text-against-300 transition-colors flex items-center justify-end gap-1"
                  >
                    <ChevronRight className="h-3 w-3" />
                    Topic B
                  </Link>
                </div>

                {/* Consensus */}
                <StatRow
                  label="Consensus"
                  primaryValue={
                    <span className={p.blue_pct >= s.blue_pct ? 'font-semibold text-white' : 'text-surface-400'}>
                      {consensusLabel(p.blue_pct)}
                    </span>
                  }
                  secondaryValue={
                    <span className={s.blue_pct > p.blue_pct ? 'font-semibold text-white' : 'text-surface-400'}>
                      {consensusLabel(s.blue_pct)}
                    </span>
                  }
                  primaryWins={p.blue_pct >= s.blue_pct}
                />

                {/* Vote count */}
                <StatRow
                  label="Total votes"
                  primaryValue={
                    <span className={cn('flex items-center gap-1', p.total_votes >= s.total_votes ? 'text-white font-semibold' : 'text-surface-400')}>
                      <Users className="h-3.5 w-3.5 flex-shrink-0" />
                      {fmtNum(p.total_votes)}
                    </span>
                  }
                  secondaryValue={
                    <span className={cn('flex items-center justify-end gap-1', s.total_votes > p.total_votes ? 'text-white font-semibold' : 'text-surface-400')}>
                      {fmtNum(s.total_votes)}
                      <Users className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                  primaryWins={p.total_votes >= s.total_votes}
                />

                {/* FOR votes */}
                <StatRow
                  label="For votes"
                  primaryValue={
                    <span className={cn('flex items-center gap-1 text-for-400', p.blue_votes >= s.blue_votes ? 'font-semibold text-for-300' : '')}>
                      <ThumbsUp className="h-3.5 w-3.5 flex-shrink-0" />
                      {fmtNum(p.blue_votes)}
                    </span>
                  }
                  secondaryValue={
                    <span className={cn('flex items-center justify-end gap-1 text-for-400', s.blue_votes > p.blue_votes ? 'font-semibold text-for-300' : '')}>
                      {fmtNum(s.blue_votes)}
                      <ThumbsUp className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                  primaryWins={p.blue_votes >= s.blue_votes}
                />

                {/* AGAINST votes */}
                <StatRow
                  label="Against votes"
                  primaryValue={
                    <span className={cn('flex items-center gap-1 text-against-400', p.red_votes >= s.red_votes ? 'font-semibold text-against-300' : '')}>
                      <ThumbsDown className="h-3.5 w-3.5 flex-shrink-0" />
                      {fmtNum(p.red_votes)}
                    </span>
                  }
                  secondaryValue={
                    <span className={cn('flex items-center justify-end gap-1 text-against-400', s.red_votes > p.red_votes ? 'font-semibold text-against-300' : '')}>
                      {fmtNum(s.red_votes)}
                      <ThumbsDown className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                  primaryWins={p.red_votes >= s.red_votes}
                />

                {/* Arguments */}
                <StatRow
                  label="Arguments"
                  primaryValue={
                    <span className={cn('flex items-center gap-1', p.argument_count >= s.argument_count ? 'text-white font-semibold' : 'text-surface-400')}>
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                      {fmtNum(p.argument_count)}
                    </span>
                  }
                  secondaryValue={
                    <span className={cn('flex items-center justify-end gap-1', s.argument_count > p.argument_count ? 'text-white font-semibold' : 'text-surface-400')}>
                      {fmtNum(s.argument_count)}
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                  primaryWins={p.argument_count >= s.argument_count}
                />

                {/* Debates */}
                <StatRow
                  label="Debates"
                  primaryValue={
                    <span className={cn('flex items-center gap-1', p.debate_count >= s.debate_count ? 'text-white font-semibold' : 'text-surface-400')}>
                      <Mic className="h-3.5 w-3.5 flex-shrink-0" />
                      {fmtNum(p.debate_count)}
                    </span>
                  }
                  secondaryValue={
                    <span className={cn('flex items-center justify-end gap-1', s.debate_count > p.debate_count ? 'text-white font-semibold' : 'text-surface-400')}>
                      {fmtNum(s.debate_count)}
                      <Mic className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                  primaryWins={p.debate_count >= s.debate_count}
                />

                {/* Feed score */}
                <StatRow
                  label="Feed score"
                  primaryValue={
                    <span className={cn('flex items-center gap-1', p.feed_score >= s.feed_score ? 'text-white font-semibold' : 'text-surface-400')}>
                      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                      {p.feed_score.toFixed(1)}
                    </span>
                  }
                  secondaryValue={
                    <span className={cn('flex items-center justify-end gap-1', s.feed_score > p.feed_score ? 'text-white font-semibold' : 'text-surface-400')}>
                      {s.feed_score.toFixed(1)}
                      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                  primaryWins={p.feed_score >= s.feed_score}
                />

                {/* Created date */}
                <StatRow
                  label="Created"
                  primaryValue={
                    <span className="flex items-center gap-1 text-surface-400">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      {fmtDate(p.created_at)}
                    </span>
                  }
                  secondaryValue={
                    <span className="flex items-center justify-end gap-1 text-surface-400">
                      {fmtDate(s.created_at)}
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    </span>
                  }
                />
              </div>

              {/* Navigation links */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { topic: p, label: 'Topic A', href: `/topic/${p.id}` },
                  { topic: s, label: 'Topic B', href: `/topic/${s.id}` },
                ].map(({ topic, label, href }) => (
                  <Link
                    key={topic.id}
                    href={href}
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
                  >
                    <span className="text-xs text-surface-500">{label}</span>
                    <span className="text-xs font-medium text-white group-hover:text-for-300 transition-colors flex items-center gap-1">
                      View topic
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
