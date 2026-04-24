'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  Share2,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type {
  ArenaCoalition,
  ArenaResponse,
  ArenaSearchResponse,
  ArenaSearchResult,
  BattleTopic,
} from '@/app/api/arena/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatInfluence(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(1)
}

const STANCE_CONFIG = {
  for:     { label: 'FOR',     color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      icon: ThumbsUp },
  against: { label: 'AGAINST', color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  icon: ThumbsDown },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400',  bg: 'bg-surface-300/10',  border: 'border-surface-300/20',  icon: Shield },
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'proposed' | 'active' | 'law' | 'failed' }> = {
  proposed: { label: 'Proposed', variant: 'proposed' },
  active:   { label: 'Active',   variant: 'active' },
  voting:   { label: 'Voting',   variant: 'active' },
  law:      { label: 'LAW',      variant: 'law' },
  failed:   { label: 'Failed',   variant: 'failed' },
}

const OUTCOME_CONFIG = {
  a_wins:    { label: 'A wins',      color: 'text-for-400',     bg: 'bg-for-500/15',     border: 'border-for-500/30' },
  b_wins:    { label: 'B wins',      color: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/30' },
  both_win:  { label: 'Both right',  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/25' },
  both_lose: { label: 'Both wrong',  color: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' },
  draw:      { label: 'Ongoing',     color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/25' },
  pending:   { label: 'Pending',     color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
}

// ─── Coalition Picker ─────────────────────────────────────────────────────────

function CoalitionPicker({
  slot,
  current,
  excludeId,
  onSelect,
  onClear,
}: {
  slot: 'A' | 'B'
  current: ArenaCoalition | null
  excludeId: string | null
  onSelect: (c: ArenaSearchResult) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArenaSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleChange = useCallback((q: string) => {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.trim().length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/arena?search=${encodeURIComponent(q)}`)
        if (res.ok) {
          const json = (await res.json()) as ArenaSearchResponse
          setResults((json.results ?? []).filter((r) => r.id !== excludeId))
          setOpen(true)
        }
      } finally {
        setSearching(false)
      }
    }, 280)
  }, [excludeId])

  const isA = slot === 'A'
  const slotColors = isA
    ? 'border-for-500/40 text-for-400 bg-for-500/10'
    : 'border-against-500/40 text-against-400 bg-against-500/10'
  const inputFocus = isA
    ? 'focus:border-for-500/60 focus:ring-for-500/20'
    : 'focus:border-against-500/60 focus:ring-against-500/20'

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('flex items-center justify-center h-6 w-6 rounded-md font-mono text-xs font-bold border', slotColors)}>
          {slot}
        </div>
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">
          {current ? current.name : 'Pick a coalition'}
        </span>
        {current && (
          <button
            onClick={onClear}
            className="ml-auto text-surface-500 hover:text-white transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {current ? (
        <Link
          href={`/coalitions/${current.id}`}
          className={cn(
            'group p-4 rounded-xl border transition-all duration-200',
            isA
              ? 'bg-for-500/5 border-for-500/30 hover:border-for-500/60'
              : 'bg-against-500/5 border-against-500/30 hover:border-against-500/60',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('text-base font-semibold leading-snug', isA ? 'text-for-300' : 'text-against-300')}>
                {current.name}
              </p>
              {current.description && (
                <p className="text-xs text-surface-500 line-clamp-2 mt-1">{current.description}</p>
              )}
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-surface-400">
              <Users className="h-3 w-3" />
              {current.member_count.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-xs text-surface-400">
              <Trophy className="h-3 w-3" />
              {current.wins}W – {current.losses}L
            </span>
            <span className="flex items-center gap-1 text-xs text-surface-400">
              <Zap className="h-3 w-3" />
              {formatInfluence(current.coalition_influence)} influence
            </span>
          </div>
        </Link>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search coalitions..."
              className={cn(
                'w-full pl-9 pr-9 py-2.5 bg-surface-200 border border-surface-400 rounded-xl',
                'text-sm text-white placeholder:text-surface-500 font-mono',
                'focus:outline-none focus:ring-2',
                inputFocus,
              )}
            />
          </div>

          <AnimatePresence>
            {open && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-200 border border-surface-400 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
              >
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelect(r)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-surface-300 transition-colors border-b border-surface-300 last:border-0"
                  >
                    <p className="text-sm font-semibold text-white">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-surface-500 line-clamp-1 mt-0.5">{r.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-surface-500">
                        {r.member_count} members
                      </span>
                      <span className="text-[10px] font-mono text-surface-600">·</span>
                      <span className="text-[10px] font-mono text-surface-500">
                        {r.wins}W {r.losses}L
                      </span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
            {open && results.length === 0 && !searching && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-200 border border-surface-400 rounded-xl shadow-xl"
              >
                <p className="text-sm text-surface-500 px-4 py-3">No coalitions found</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ─── Battle topic row ─────────────────────────────────────────────────────────

function BattleTopicRow({ topic, nameA, nameB }: { topic: BattleTopic; nameA: string; nameB: string }) {
  const [expanded, setExpanded] = useState(false)
  const stA = STANCE_CONFIG[topic.stance_a]
  const stB = STANCE_CONFIG[topic.stance_b]
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, variant: 'proposed' as const }
  const outcomeCfg = OUTCOME_CONFIG[topic.outcome]
  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border transition-colors',
        topic.aligned
          ? 'border-surface-300/50 bg-surface-200/50'
          : 'border-surface-300 bg-surface-200',
      )}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        {/* outcome indicator */}
        <div className={cn(
          'shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
          outcomeCfg.bg, outcomeCfg.border, outcomeCfg.color,
        )}>
          {outcomeCfg.label}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
            )}
            <Badge variant={statusCfg.variant} className="text-[10px] px-1.5 py-0.5">
              {statusCfg.label}
            </Badge>
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>

        <ChevronRight className={cn(
          'shrink-0 h-4 w-4 text-surface-500 transition-transform mt-0.5',
          expanded && 'rotate-90',
        )} />
      </button>

      {/* Expanded: stances side-by-side */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              {/* Coalition A */}
              <div className={cn('rounded-lg border p-3', stA.bg, stA.border)}>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">{nameA}</p>
                <div className={cn('flex items-center gap-1.5 font-bold text-sm', stA.color)}>
                  <stA.icon className="h-3.5 w-3.5" />
                  {stA.label}
                </div>
                {topic.statement_a && (
                  <p className="text-xs text-surface-400 mt-2 leading-snug">{topic.statement_a}</p>
                )}
                {!topic.statement_a && (
                  <p className="text-xs text-surface-600 mt-2 italic">No statement</p>
                )}
              </div>

              {/* Coalition B */}
              <div className={cn('rounded-lg border p-3', stB.bg, stB.border)}>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">{nameB}</p>
                <div className={cn('flex items-center gap-1.5 font-bold text-sm', stB.color)}>
                  <stB.icon className="h-3.5 w-3.5" />
                  {stB.label}
                </div>
                {topic.statement_b && (
                  <p className="text-xs text-surface-400 mt-2 leading-snug">{topic.statement_b}</p>
                )}
                {!topic.statement_b && (
                  <p className="text-xs text-surface-600 mt-2 italic">No statement</p>
                )}
              </div>
            </div>

            {/* View topic link */}
            <div className="px-4 pb-4 pt-0">
              <Link
                href={`/topic/${topic.topic_id}`}
                className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                View topic <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main arena content ───────────────────────────────────────────────────────

function ArenaContent() {
  const router = useRouter()
  const params = useSearchParams()

  const [coalitionA, setCoalitionA] = useState<ArenaCoalition | null>(null)
  const [coalitionB, setCoalitionB] = useState<ArenaCoalition | null>(null)
  const [battleData, setBattleData] = useState<ArenaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'contested' | 'aligned'>('all')
  const [copied, setCopied] = useState(false)

  // Load from URL params on mount
  useEffect(() => {
    const a = params.get('a')
    const b = params.get('b')
    if (a && b) {
      loadBattle(a, b)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadBattle(idA: string, idB: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/arena?a=${idA}&b=${idB}`)
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Failed to load battle')
        return
      }
      const data = (await res.json()) as ArenaResponse
      setCoalitionA(data.coalition_a)
      setCoalitionB(data.coalition_b)
      setBattleData(data)
      router.replace(`/arena?a=${idA}&b=${idB}`, { scroll: false })
    } catch {
      setError('Failed to load battle data')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectA(c: ArenaSearchResult) {
    if (!c.id) return
    const newA: ArenaCoalition = {
      id: c.id,
      name: c.name,
      description: c.description,
      member_count: c.member_count,
      max_members: 100,
      coalition_influence: c.coalition_influence,
      wins: c.wins,
      losses: c.losses,
      is_public: true,
      created_at: '',
    }
    setCoalitionA(newA)
    setBattleData(null)
    if (coalitionB) loadBattle(c.id, coalitionB.id)
  }

  function handleSelectB(c: ArenaSearchResult) {
    if (!c.id) return
    const newB: ArenaCoalition = {
      id: c.id,
      name: c.name,
      description: c.description,
      member_count: c.member_count,
      max_members: 100,
      coalition_influence: c.coalition_influence,
      wins: c.wins,
      losses: c.losses,
      is_public: true,
      created_at: '',
    }
    setCoalitionB(newB)
    setBattleData(null)
    if (coalitionA) loadBattle(coalitionA.id, c.id)
  }

  function handleSwap() {
    if (!coalitionA || !coalitionB) return
    const tmp = coalitionA
    setCoalitionA(coalitionB)
    setCoalitionB(tmp)
    if (battleData) {
      setBattleData({
        ...battleData,
        coalition_a: battleData.coalition_b,
        coalition_b: battleData.coalition_a,
        topics: battleData.topics.map((t) => ({
          ...t,
          stance_a: t.stance_b,
          stance_b: t.stance_a,
          statement_a: t.statement_b,
          statement_b: t.statement_a,
          outcome:
            t.outcome === 'a_wins' ? 'b_wins'
            : t.outcome === 'b_wins' ? 'a_wins'
            : t.outcome,
        })),
        stats: {
          ...battleData.stats,
          a_wins: battleData.stats.b_wins,
          b_wins: battleData.stats.a_wins,
          a_win_rate: battleData.stats.b_win_rate,
          b_win_rate: battleData.stats.a_win_rate,
        },
      })
    }
    if (coalitionA && coalitionB) {
      router.replace(`/arena?a=${coalitionB.id}&b=${coalitionA.id}`, { scroll: false })
    }
  }

  async function handleShare() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: open share dialog
      if (navigator.share) {
        await navigator.share({ url })
      }
    }
  }

  function handleReset() {
    setCoalitionA(null)
    setCoalitionB(null)
    setBattleData(null)
    setError(null)
    router.replace('/arena', { scroll: false })
  }

  const filteredTopics = battleData?.topics.filter((t) => {
    if (filter === 'contested') return !t.aligned && t.stance_a !== 'neutral' && t.stance_b !== 'neutral'
    if (filter === 'aligned') return t.aligned
    return true
  }) ?? []

  const stats = battleData?.stats
  const readyForBattle = coalitionA && coalitionB

  return (
    <div className="min-h-screen bg-surface-100 pb-24 md:pb-8">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="h-5 w-5 text-gold" />
            <h1 className="text-xl font-bold text-white font-mono tracking-tight">Coalition Arena</h1>
          </div>
          <p className="text-sm text-surface-500">
            Pick two coalitions to see how they square off on shared topics — who aligned with outcomes, who diverged.
          </p>
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <CoalitionPicker
            slot="A"
            current={coalitionA}
            excludeId={coalitionB?.id ?? null}
            onSelect={handleSelectA}
            onClear={() => { setCoalitionA(null); setBattleData(null); router.replace('/arena', { scroll: false }) }}
          />
          <CoalitionPicker
            slot="B"
            current={coalitionB}
            excludeId={coalitionA?.id ?? null}
            onSelect={handleSelectB}
            onClear={() => { setCoalitionB(null); setBattleData(null); router.replace('/arena', { scroll: false }) }}
          />
        </div>

        {/* Action row */}
        {readyForBattle && (
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={handleSwap}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-300 hover:bg-surface-400 text-surface-400 hover:text-white text-xs font-mono transition-colors"
              title="Swap coalitions"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Swap
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-300 hover:bg-surface-400 text-surface-400 hover:text-white text-xs font-mono transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-300 hover:bg-surface-400 text-surface-400 hover:text-white text-xs font-mono transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-surface-500 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 mb-6">
            <p className="text-sm text-against-400 font-mono">{error}</p>
          </div>
        )}

        {/* Empty: both selected but no shared stances */}
        {!loading && !error && battleData && battleData.topics.length === 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-200 p-8 text-center">
            <Swords className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">No shared topics</p>
            <p className="text-sm text-surface-500">
              These coalitions haven&apos;t both declared stances on any of the same topics yet.
            </p>
          </div>
        )}

        {/* Battle results */}
        <AnimatePresence>
          {!loading && battleData && battleData.topics.length > 0 && stats && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Score card */}
              <div className="rounded-2xl border border-surface-300 bg-surface-200 overflow-hidden">
                {/* Header bar */}
                <div className="flex items-stretch divide-x divide-surface-300">
                  {/* A side */}
                  <div className="flex-1 p-4 bg-for-500/5">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Coalition A</p>
                    <p className="text-lg font-bold text-for-300 leading-tight line-clamp-1">{coalitionA?.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-mono font-black text-for-400">{stats.a_wins}</span>
                      <span className="text-xs text-surface-500 font-mono">wins on<br/>contested</span>
                    </div>
                    {stats.a_win_rate !== null && (
                      <div className="mt-2">
                        <div className="text-xs font-mono text-surface-500 mb-1">Win rate</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-for-500 rounded-full transition-all"
                              style={{ width: `${stats.a_win_rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-for-400 font-bold">{stats.a_win_rate}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Center */}
                  <div className="flex flex-col items-center justify-center px-4 py-4 min-w-[80px]">
                    <Swords className="h-5 w-5 text-gold mb-2" />
                    <div className="text-[10px] font-mono text-surface-500 text-center leading-tight">
                      {stats.contested_topics} contested<br/>
                      {stats.aligned_topics} aligned
                    </div>
                  </div>

                  {/* B side */}
                  <div className="flex-1 p-4 bg-against-500/5 text-right">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Coalition B</p>
                    <p className="text-lg font-bold text-against-300 leading-tight line-clamp-1">{coalitionB?.name}</p>
                    <div className="flex items-center gap-2 justify-end mt-2">
                      <span className="text-xs text-surface-500 font-mono">wins on<br/>contested</span>
                      <span className="text-2xl font-mono font-black text-against-400">{stats.b_wins}</span>
                    </div>
                    {stats.b_win_rate !== null && (
                      <div className="mt-2">
                        <div className="text-xs font-mono text-surface-500 mb-1 text-right">Win rate</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-against-400 font-bold">{stats.b_win_rate}%</span>
                          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-against-500 rounded-full float-right transition-all"
                              style={{ width: `${stats.b_win_rate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom stats */}
                <div className="px-4 py-3 bg-surface-100/50 border-t border-surface-300 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-[10px] font-mono text-surface-500">Shared</div>
                    <div className="text-sm font-mono font-bold text-white">{stats.shared_topics}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-emerald">Both right</div>
                    <div className="text-sm font-mono font-bold text-emerald">{stats.both_win}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500">Both wrong</div>
                    <div className="text-sm font-mono font-bold text-surface-400">{stats.both_lose}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500">Opposed</div>
                    <div className="text-sm font-mono font-bold text-surface-400">{stats.contested_topics}</div>
                  </div>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 p-1 bg-surface-200 rounded-xl border border-surface-300">
                {(['all', 'contested', 'aligned'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase tracking-wide transition-all',
                      filter === f
                        ? 'bg-surface-400 text-white'
                        : 'text-surface-500 hover:text-white',
                    )}
                  >
                    {f === 'all' ? `All (${stats.shared_topics})` : f === 'contested' ? `Contested (${stats.contested_topics})` : `Aligned (${stats.aligned_topics})`}
                  </button>
                ))}
              </div>

              {/* Topic rows */}
              {filteredTopics.length === 0 ? (
                <div className="rounded-xl border border-surface-300 bg-surface-200 p-6 text-center">
                  <p className="text-sm text-surface-500">No topics in this category.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTopics.map((t) => (
                    <BattleTopicRow
                      key={t.topic_id}
                      topic={t}
                      nameA={coalitionA?.name ?? 'A'}
                      nameB={coalitionB?.name ?? 'B'}
                    />
                  ))}
                </div>
              )}

              {/* Footer links */}
              <div className="flex items-center justify-center gap-4 pt-2">
                {coalitionA && (
                  <Link
                    href={`/coalitions/${coalitionA.id}`}
                    className="flex items-center gap-1 text-xs text-surface-500 hover:text-for-400 transition-colors"
                  >
                    View {coalitionA.name} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {coalitionB && (
                  <Link
                    href={`/coalitions/${coalitionB.id}`}
                    className="flex items-center gap-1 text-xs text-surface-500 hover:text-against-400 transition-colors"
                  >
                    View {coalitionB.name} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Placeholder when nothing selected */}
        {!loading && !battleData && !error && (
          <div className="rounded-2xl border border-dashed border-surface-400 bg-surface-200/30 p-10 text-center">
            <Swords className="h-12 w-12 text-surface-600 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-surface-400 mb-2">Choose your fighters</h2>
            <p className="text-sm text-surface-600 max-w-sm mx-auto">
              Select two coalitions above to compare their stances head-to-head across shared topics — and see who backed the right side of history.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Page with Suspense boundary ─────────────────────────────────────────────

export default function ArenaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-surface-500 animate-spin" />
      </div>
    }>
      <ArenaContent />
    </Suspense>
  )
}
