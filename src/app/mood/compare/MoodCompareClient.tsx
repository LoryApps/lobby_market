'use client'

/**
 * /mood/compare — Civic Mood Compare
 *
 * Side-by-side emotional comparison of two topics.
 * Shows how the community feels about each debate, the divergence
 * between them, and where sentiment aligns or clashes.
 *
 * Data: /api/mood/compare?a=<topicId>&b=<topicId>
 * Search: /api/search?q=<query>&tab=topics
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodCompareResponse, TopicMoodProfile } from '@/app/api/mood/compare/route'
import type { MoodKind } from '@/app/api/mood/route'

// ─── Mood Config ──────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<MoodKind, { emoji: string; label: string; color: string; bg: string; bar: string }> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful',    color: 'text-for-400',     bg: 'bg-for-500/10',     bar: 'bg-for-500' },
  inspired:   { emoji: '✨', label: 'Inspired',   color: 'text-gold',        bg: 'bg-gold/10',        bar: 'bg-gold' },
  proud:      { emoji: '🏆', label: 'Proud',      color: 'text-emerald',     bg: 'bg-emerald/10',     bar: 'bg-emerald' },
  determined: { emoji: '💪', label: 'Determined', color: 'text-purple',      bg: 'bg-purple/10',      bar: 'bg-purple' },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'text-against-400', bg: 'bg-against-500/10', bar: 'bg-against-500' },
  worried:    { emoji: '😟', label: 'Worried',    color: 'text-against-300', bg: 'bg-against-600/10', bar: 'bg-against-400' },
  angry:      { emoji: '😡', label: 'Angry',      color: 'text-against-500', bg: 'bg-against-700/10', bar: 'bg-against-600' },
  relieved:   { emoji: '😌', label: 'Relieved',   color: 'text-for-300',     bg: 'bg-for-600/10',     bar: 'bg-for-400' },
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

const STATUS_COLORS: Record<string, string> = {
  proposed: 'text-surface-500',
  active:   'text-for-400',
  voting:   'text-purple',
  law:      'text-gold',
  failed:   'text-against-400',
}

// ─── Topic search ─────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

function TopicPicker({
  label,
  selected,
  onSelect,
  onClear,
}: {
  label: string
  selected: SearchResult | null
  onSelect: (t: SearchResult) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
        const data = await res.json() as { results: SearchResult[] }
        setResults(data.results ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (selected) {
    return (
      <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-1">{label}</p>
            <p className="text-sm font-medium text-white leading-snug line-clamp-2">{selected.statement}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {selected.category && (
                <Badge className="text-[10px]">{selected.category}</Badge>
              )}
              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', STATUS_COLORS[selected.status] ?? 'text-surface-500')}>
                {selected.status}
              </span>
              <span className="text-[10px] text-surface-500">{selected.total_votes.toLocaleString()} votes</span>
            </div>
          </div>
          <button
            onClick={onClear}
            className="flex-shrink-0 p-1 rounded text-surface-500 hover:text-white transition-colors"
            aria-label="Remove topic"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-2">{label}</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search for a topic…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-300 text-sm text-white placeholder-surface-500 border border-surface-400 focus:outline-none focus:ring-1 focus:ring-for-500/50"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />}
        </div>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-surface-300 bg-surface-200 shadow-xl overflow-hidden"
          >
            {results.map(t => (
              <button
                key={t.id}
                onClick={() => { onSelect(t); setQuery(''); setOpen(false) }}
                className="w-full text-left px-4 py-3 hover:bg-surface-300 transition-colors border-b border-surface-300/50 last:border-0"
              >
                <p className="text-sm text-white leading-snug line-clamp-2">{t.statement}</p>
                <div className="flex items-center gap-2 mt-1">
                  {t.category && <span className="text-[10px] text-surface-500">{t.category}</span>}
                  <span className={cn('text-[10px] font-medium', STATUS_COLORS[t.status] ?? 'text-surface-500')}>{t.status}</span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mood bar chart for one topic ─────────────────────────────────────────────

function MoodBars({
  profile,
  showLabel = true,
  compact = false,
}: {
  profile: TopicMoodProfile
  showLabel?: boolean
  compact?: boolean
}) {
  const sorted = [...profile.moods].sort((a, b) => b.pct - a.pct)
  const topMood = sorted[0]

  return (
    <div className={cn('space-y-1.5', compact && 'space-y-1')}>
      {sorted.map(({ mood, count, pct }) => {
        const cfg = MOOD_CONFIG[mood]
        if (!cfg) return null
        return (
          <div key={mood} className="flex items-center gap-2">
            <span className={cn('text-sm', compact && 'text-xs')}>{cfg.emoji}</span>
            {showLabel && (
              <span className={cn('text-xs text-surface-500 w-20 flex-shrink-0', compact && 'w-16 text-[10px]')}>
                {cfg.label}
              </span>
            )}
            <div className={cn('flex-1 rounded-full bg-surface-300', compact ? 'h-1.5' : 'h-2')}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className={cn('h-full rounded-full', cfg.bar, mood === topMood?.mood && 'opacity-100', mood !== topMood?.mood && 'opacity-70')}
              />
            </div>
            <span className={cn('text-xs text-surface-400 w-8 text-right flex-shrink-0', compact && 'text-[10px] w-6')}>
              {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Divergence meter ─────────────────────────────────────────────────────────

function DivergenceMeter({ score }: { score: number }) {
  const label = score < 20 ? 'Very Similar' : score < 40 ? 'Similar' : score < 60 ? 'Moderate' : score < 80 ? 'Divergent' : 'Highly Divergent'
  const color = score < 30 ? 'text-for-400' : score < 60 ? 'text-gold' : 'text-against-400'
  const barColor = score < 30 ? 'bg-for-500' : score < 60 ? 'bg-gold' : 'bg-against-500'

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-surface-400" />
          <span className="text-sm font-semibold text-white">Emotional Divergence</span>
        </div>
        <span className={cn('text-sm font-bold', color)}>{label}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-surface-500">0 — Identical</span>
        <span className="text-[11px] font-bold text-surface-400">{score}/100</span>
        <span className="text-[10px] text-surface-500">100 — Opposite</span>
      </div>
    </div>
  )
}

// ─── Side-by-side profile card ────────────────────────────────────────────────

function ProfileCard({
  profile,
  side,
}: {
  profile: TopicMoodProfile
  side: 'A' | 'B'
}) {
  const dominantCfg = profile.dominant_mood ? MOOD_CONFIG[profile.dominant_mood] : null
  const isPositive = profile.positive_pct >= 50

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      side === 'A' ? 'border-for-500/30 bg-for-500/5' : 'border-against-500/30 bg-against-500/5',
    )}>
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
            side === 'A' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400',
          )}>
            Topic {side}
          </span>
          <span className={cn('text-[10px] font-medium', STATUS_COLORS[profile.status] ?? 'text-surface-500')}>
            {profile.status}
          </span>
        </div>
        <Link href={`/topic/${profile.id}`} className="text-sm font-medium text-white leading-snug line-clamp-3 hover:text-for-300 transition-colors">
          {profile.statement}
        </Link>
      </div>

      {profile.category && (
        <Badge className="text-[10px]">{profile.category}</Badge>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-white">{profile.total_mood_responses}</p>
          <p className="text-[10px] text-surface-500">Responses</p>
        </div>
        <div>
          <p className={cn('text-lg font-bold', isPositive ? 'text-for-400' : 'text-against-400')}>
            {isPositive ? profile.positive_pct : profile.anxious_pct}%
          </p>
          <p className="text-[10px] text-surface-500">{isPositive ? 'Positive' : 'Anxious'}</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">{dominantCfg?.emoji ?? '—'}</p>
          <p className="text-[10px] text-surface-500">{dominantCfg?.label ?? 'No data'}</p>
        </div>
      </div>

      {profile.total_mood_responses > 0 ? (
        <MoodBars profile={profile} compact />
      ) : (
        <p className="text-xs text-surface-500 italic text-center py-2">No mood responses yet</p>
      )}

      <Link
        href={`/topic/${profile.id}/mood`}
        className="flex items-center justify-center gap-1 text-xs text-surface-400 hover:text-white transition-colors pt-1"
      >
        <span>Full mood breakdown</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Head-to-head mood bars ───────────────────────────────────────────────────

function HeadToHead({ a, b }: { a: TopicMoodProfile; b: TopicMoodProfile }) {
  const aPctMap = Object.fromEntries(a.moods.map(x => [x.mood, x.pct]))
  const bPctMap = Object.fromEntries(b.moods.map(x => [x.mood, x.pct]))

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-surface-400" />
        <span className="text-sm font-semibold text-white">Head-to-Head</span>
      </div>

      <div className="flex text-[10px] text-surface-500 justify-between mb-1">
        <span className="font-semibold text-for-400">← Topic A</span>
        <span className="font-semibold text-against-400">Topic B →</span>
      </div>

      {ALL_MOODS.map(mood => {
        const cfg = MOOD_CONFIG[mood]
        const aPct = aPctMap[mood] ?? 0
        const bPct = bPctMap[mood] ?? 0
        if (aPct === 0 && bPct === 0) return null
        return (
          <div key={mood} className="flex items-center gap-2">
            <div className="flex-1 flex justify-end">
              <div className="h-2 rounded-full bg-surface-300 w-full overflow-hidden flex justify-end">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${aPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full bg-for-500"
                />
              </div>
            </div>
            <div className="flex-shrink-0 text-center w-20">
              <span className="text-sm">{cfg.emoji}</span>
              <p className="text-[9px] text-surface-500 leading-none">{cfg.label}</p>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${bPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full bg-against-500"
                />
              </div>
            </div>
          </div>
        )
      })}

      <div className="flex text-[10px] justify-between pt-1">
        <span className="text-for-400">{a.positive_pct}% positive</span>
        <span className="text-against-400">{b.positive_pct}% positive</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function MoodCompareInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [topicA, setTopicA] = useState<SearchResult | null>(null)
  const [topicB, setTopicB] = useState<SearchResult | null>(null)
  const [data, setData] = useState<MoodCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load from URL params on mount
  useEffect(() => {
    const aId = searchParams.get('a')
    const bId = searchParams.get('b')
    if (aId && bId) {
      Promise.all([
        fetch(`/api/topics/${aId}`).then(r => r.json()),
        fetch(`/api/topics/${bId}`).then(r => r.json()),
      ]).then(([a, b]) => {
        if (a?.topic) setTopicA(a.topic)
        if (b?.topic) setTopicB(b.topic)
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const compare = useCallback(async () => {
    if (!topicA || !topicB) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mood/compare?a=${topicA.id}&b=${topicB.id}`)
      if (!res.ok) throw new Error('Failed to load comparison')
      const json = await res.json() as MoodCompareResponse
      setData(json)
      router.replace(`/mood/compare?a=${topicA.id}&b=${topicB.id}`, { scroll: false })
    } catch {
      setError('Could not load the comparison. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [topicA, topicB, router])

  // Auto-compare when both topics selected
  useEffect(() => {
    if (topicA && topicB) compare()
  }, [topicA, topicB]) // eslint-disable-line react-hooks/exhaustive-deps

  const swapTopics = () => {
    setTopicA(topicB)
    setTopicB(topicA)
    setData(null)
  }

  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/mood" className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Mood Compare</h1>
            <p className="text-xs text-surface-500">Compare how two debates make the community feel</p>
          </div>
        </div>

        {/* Topic pickers */}
        <div className="space-y-3 mb-4">
          <TopicPicker
            label="Topic A"
            selected={topicA}
            onSelect={(t) => { setTopicA(t); setData(null) }}
            onClear={() => { setTopicA(null); setData(null) }}
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-300" />
            <button
              onClick={swapTopics}
              disabled={!topicA && !topicB}
              className="p-1.5 rounded-full border border-surface-300 bg-surface-200 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Swap topics"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1 h-px bg-surface-300" />
          </div>

          <TopicPicker
            label="Topic B"
            selected={topicB}
            onSelect={(t) => { setTopicB(t); setData(null) }}
            onClear={() => { setTopicB(null); setData(null) }}
          />
        </div>

        {/* Compare button (shown only when auto-compare is deferred) */}
        {topicA && topicB && !data && !loading && (
          <button
            onClick={compare}
            className="w-full py-2.5 rounded-xl bg-for-500 hover:bg-for-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Sparkles className="h-4 w-4" />
            Compare Moods
          </button>
        )}

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-10 space-y-2"
            >
              <Loader2 className="h-6 w-6 text-for-400 animate-spin mx-auto" />
              <p className="text-sm text-surface-500">Comparing emotional responses…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-center mb-4">
            <p className="text-sm text-against-400">{error}</p>
            <button onClick={compare} className="text-xs text-surface-400 hover:text-white mt-2 transition-colors flex items-center gap-1 mx-auto">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!topicA && !topicB && !loading && (
          <EmptyState
            icon={ArrowLeftRight}
            title="Pick two topics"
            description="Search for any two civic debates to compare how the community feels about each."
          />
        )}

        {/* Results */}
        <AnimatePresence>
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Divergence meter */}
              <DivergenceMeter score={data.divergence_score} />

              {/* Emotional tension summary */}
              {data.emotional_tension && (
                <div className="rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3 flex gap-3">
                  <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-surface-400 leading-relaxed">{data.emotional_tension}</p>
                </div>
              )}

              {/* Shared mood */}
              {data.shared_top_mood && MOOD_CONFIG[data.shared_top_mood] && (
                <div className="rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">{MOOD_CONFIG[data.shared_top_mood].emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Shared dominant mood</p>
                    <p className="text-xs text-surface-500">Both topics make the community feel <span className={MOOD_CONFIG[data.shared_top_mood].color}>{MOOD_CONFIG[data.shared_top_mood].label}</span> most.</p>
                  </div>
                </div>
              )}

              {/* Overlap users */}
              {data.overlap_users > 0 && (
                <div className="flex items-center gap-2 text-xs text-surface-500 px-1">
                  <Users className="h-3.5 w-3.5" />
                  <span><strong className="text-surface-400">{data.overlap_users.toLocaleString()}</strong> {data.overlap_users === 1 ? 'person has' : 'people have'} responded to both topics</span>
                </div>
              )}

              {/* Head-to-head bars */}
              {data.topic_a && data.topic_b && (
                <HeadToHead a={data.topic_a} b={data.topic_b} />
              )}

              {/* Side-by-side profiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.topic_a && <ProfileCard profile={data.topic_a} side="A" />}
                {data.topic_b && <ProfileCard profile={data.topic_b} side="B" />}
              </div>

              {/* Related links */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/mood"
                  className="rounded-xl border border-surface-300 bg-surface-200 p-3 flex flex-col gap-1.5 hover:bg-surface-300 transition-colors"
                >
                  <Flame className="h-4 w-4 text-against-400" />
                  <p className="text-xs font-medium text-white">Platform Mood</p>
                  <p className="text-[10px] text-surface-500">How the Lobby feels overall</p>
                </Link>
                <Link
                  href="/mood/atlas"
                  className="rounded-xl border border-surface-300 bg-surface-200 p-3 flex flex-col gap-1.5 hover:bg-surface-300 transition-colors"
                >
                  <TrendingUp className="h-4 w-4 text-for-400" />
                  <p className="text-xs font-medium text-white">Mood Atlas</p>
                  <p className="text-[10px] text-surface-500">By category and theme</p>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  )
}

export function MoodCompareClient() {
  return (
    <Suspense fallback={null}>
      <MoodCompareInner />
    </Suspense>
  )
}
