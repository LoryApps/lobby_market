'use client'

/**
 * /relays/compare — Relay Chain Head-to-Head
 *
 * Deep-dive comparison of all FOR and AGAINST relay chains on a single topic.
 * Find a topic with the search bar, then browse both sides' chains leg-by-leg.
 *
 * Distinct from /relays/showdown (which browses ALL topics with paired chains).
 * This page is focused on ONE topic and shows every chain, not just the top pair.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GitMerge,
  Loader2,
  Scale,
  Search,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CompareRelay, CompareResponse } from '@/app/api/relays/compare/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Topic search ─────────────────────────────────────────────────────────────

interface TopicHit {
  id: string
  statement: string
  category: string | null
  status: string
}

function TopicPicker({ onSelect }: { onSelect: (t: TopicHit) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicHit[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=8`)
      if (res.ok) {
        const data = await res.json()
        setResults((data.results ?? []).slice(0, 8))
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (v: string) => {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 300)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search for a topic…"
          className="w-full pl-9 pr-9 py-2.5 bg-surface-200 border border-surface-300 rounded-xl text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20 font-mono"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {(results.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1.5 w-full z-50 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
          >
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-surface-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching…
              </div>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => { onSelect(r); setQuery(''); setResults([]) }}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-surface-200 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-snug line-clamp-2">{r.statement}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.category && (
                      <span className="text-[10px] text-surface-500 font-mono">{r.category}</span>
                    )}
                    <span className={cn(
                      'text-[10px] font-mono uppercase font-semibold',
                      r.status === 'law' ? 'text-gold' :
                      r.status === 'voting' ? 'text-purple' :
                      r.status === 'active' ? 'text-for-400' :
                      'text-surface-500'
                    )}>
                      {r.status}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors flex-shrink-0 mt-0.5" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Single relay card ────────────────────────────────────────────────────────

function RelayCard({ relay, isFor, rank }: { relay: CompareRelay; isFor: boolean; rank: number }) {
  const [expanded, setExpanded] = useState(rank === 0)
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState<'compelling' | 'not_compelling' | null>(relay.user_vote)
  const [localCounts, setLocalCounts] = useState({
    compelling: relay.vote_compelling,
    not_compelling: relay.vote_not_compelling,
  })

  const totalVotes = localCounts.compelling + localCounts.not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((localCounts.compelling / totalVotes) * 100) : 0

  const isComplete = relay.status === 'complete' || relay.status === 'voted'
  const isOpen = relay.status === 'open' || relay.status === 'in_progress'

  const sideColor = isFor
    ? { text: 'text-for-300', border: 'border-for-500/25', bar: 'bg-for-500', badge: 'bg-for-500/15 text-for-300 border-for-500/30', hover: 'hover:bg-for-500/10 hover:border-for-500/40' }
    : { text: 'text-against-300', border: 'border-against-500/25', bar: 'bg-against-500', badge: 'bg-against-500/15 text-against-300 border-against-500/30', hover: 'hover:bg-against-500/10 hover:border-against-500/40' }

  async function vote(v: 'compelling' | 'not_compelling') {
    if (voting || !isComplete) return
    setVoting(true)
    try {
      const method = localVote === v ? 'DELETE' : 'POST'
      const res = await fetch(`/api/relays/${relay.id}/vote`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: v }),
      })
      if (res.ok) {
        setLocalCounts((prev) => {
          const next = { ...prev }
          if (method === 'DELETE') {
            next[v] = Math.max(0, next[v] - 1)
          } else {
            next[v] += 1
            if (localVote) next[localVote] = Math.max(0, next[localVote] - 1)
          }
          return next
        })
        setLocalVote(method === 'DELETE' ? null : v)
      }
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-colors bg-surface-100',
        sideColor.border,
        sideColor.hover
      )}
    >
      {/* Card header */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {/* Rank badge */}
        <div className={cn(
          'flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border',
          rank === 0 ? (isFor ? 'bg-for-500/20 text-for-300 border-for-500/40' : 'bg-against-500/20 text-against-300 border-against-500/40') : 'bg-surface-300/60 text-surface-400 border-surface-400/40'
        )}>
          {rank + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Starter + status */}
          <div className="flex items-center gap-2 flex-wrap">
            {relay.starter && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={relay.starter.avatar_url}
                  fallback={relay.starter.display_name ?? relay.starter.username}
                  size="xs"
                />
                <span className="text-xs text-surface-400 font-mono">
                  @{relay.starter.username}
                </span>
              </div>
            )}
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md border',
              isOpen ? 'bg-for-500/10 text-for-400 border-for-500/20' : 'bg-surface-300/60 text-surface-400 border-surface-400/30'
            )}>
              {relay.status === 'open' ? 'OPEN' :
               relay.status === 'in_progress' ? `${relay.leg_count}/${relay.max_legs} LEGS` :
               relay.status === 'complete' ? 'COMPLETE' : 'VOTED'}
            </span>
            <span className="text-[10px] text-surface-600 font-mono ml-auto flex-shrink-0">
              {relativeTime(relay.created_at)}
            </span>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-surface-500 font-mono">
              {relay.leg_count}/{relay.max_legs} legs
            </span>
            {isComplete && totalVotes > 0 && (
              <span className={cn('text-xs font-mono font-semibold', compellingPct >= 60 ? 'text-emerald' : compellingPct <= 40 ? 'text-against-400' : 'text-surface-400')}>
                {compellingPct}% compelling
              </span>
            )}
            {isComplete && totalVotes > 0 && (
              <span className="text-xs text-surface-600 font-mono">
                {totalVotes} votes
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 text-surface-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded: legs + vote */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Legs */}
              {relay.legs.length > 0 ? (
                <div className="space-y-2">
                  {relay.legs.map((leg) => (
                    <div key={leg.id} className="flex gap-2.5">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className={cn(
                          'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border flex-shrink-0',
                          isFor ? 'bg-for-500/20 text-for-300 border-for-500/30' : 'bg-against-500/20 text-against-300 border-against-500/30'
                        )}>
                          {leg.leg_number}
                        </div>
                        {leg.leg_number < relay.max_legs && relay.legs.find((l) => l.leg_number === leg.leg_number + 1) && (
                          <div className={cn('w-px flex-1 min-h-[12px]', isFor ? 'bg-for-500/20' : 'bg-against-500/20')} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <p className="text-sm text-surface-100 leading-relaxed">{leg.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {leg.author && (
                            <span className="text-[10px] text-surface-600 font-mono">
                              @{leg.author.username}
                            </span>
                          )}
                          {leg.upvote_count > 0 && (
                            <span className="text-[10px] text-surface-600 font-mono">
                              ★ {leg.upvote_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-surface-600 font-mono italic px-1">No legs yet — be the first to contribute.</p>
              )}

              {/* Voting section (completed relays only) */}
              {isComplete && (
                <div className="pt-2 border-t border-surface-300/60 space-y-2">
                  {totalVotes > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-surface-500">
                        <span>{localCounts.compelling} compelling</span>
                        <span>{localCounts.not_compelling} not compelling</span>
                      </div>
                      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', isFor ? 'bg-for-500' : 'bg-against-500')}
                          style={{ width: `${compellingPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => vote('compelling')}
                      disabled={voting}
                      aria-label="Vote compelling"
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors border',
                        localVote === 'compelling'
                          ? 'bg-emerald/20 text-emerald border-emerald/40'
                          : 'bg-surface-200 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Compelling
                    </button>
                    <button
                      onClick={() => vote('not_compelling')}
                      disabled={voting}
                      aria-label="Vote not compelling"
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors border',
                        localVote === 'not_compelling'
                          ? 'bg-against-500/20 text-against-300 border-against-500/40'
                          : 'bg-surface-200 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                      )}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Weak
                    </button>
                  </div>
                </div>
              )}

              {/* CTA for open relays */}
              {isOpen && (
                <Link
                  href={`/relays/${relay.id}`}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-mono font-semibold transition-colors border',
                    isFor
                      ? 'bg-for-500/10 text-for-300 border-for-500/30 hover:bg-for-500/20'
                      : 'bg-against-500/10 text-against-300 border-against-500/30 hover:bg-against-500/20'
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Join this relay
                </Link>
              )}

              {/* Link to full relay */}
              <div className="flex justify-end">
                <Link
                  href={`/relays/${relay.id}`}
                  className="text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
                >
                  View full relay →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Column skeleton ──────────────────────────────────────────────────────────

function ColumnSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Battle banner ────────────────────────────────────────────────────────────

function BattleBanner({ winner, forTotal, againstTotal }: {
  winner: 'for' | 'against' | 'tied' | null
  forTotal: number
  againstTotal: number
}) {
  if (!winner || (forTotal === 0 && againstTotal === 0)) return null

  const cfg = winner === 'for'
    ? { label: 'FOR is leading', color: 'from-for-500/20 to-transparent', text: 'text-for-300', icon: Trophy }
    : winner === 'against'
    ? { label: 'AGAINST is leading', color: 'from-against-500/20 to-transparent', text: 'text-against-300', icon: Trophy }
    : { label: 'Battle is tied', color: 'from-surface-400/20 to-transparent', text: 'text-surface-300', icon: Scale }

  const Icon = cfg.icon

  return (
    <div className={cn(
      'rounded-xl border border-surface-300 p-3 bg-gradient-to-r flex items-center gap-3',
      cfg.color
    )}>
      <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.text)} />
      <span className={cn('text-sm font-mono font-semibold', cfg.text)}>
        {cfg.label}
      </span>
      <div className="ml-auto flex items-center gap-2 text-xs font-mono text-surface-500">
        <span className="text-for-400">{forTotal} FOR</span>
        <span>·</span>
        <span className="text-against-400">{againstTotal} AGAINST</span>
        <span className="text-surface-600">chains</span>
      </div>
    </div>
  )
}

// ─── Main compare page ────────────────────────────────────────────────────────

function CompareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const topicId = searchParams.get('topic')

  const [data, setData] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (tid: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/compare?topicId=${encodeURIComponent(tid)}`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Failed to load relay comparison.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load when topic changes via URL
  useEffect(() => {
    if (topicId) {
      load(topicId)
    }
  }, [topicId, load])

  function handleTopicSelect(t: { id: string; statement: string; status: string }) {
    router.push(`/relays/compare?topic=${t.id}`, { scroll: false })
  }

  const topic = data?.topic
  const hasData = data && (data.for_relays.length > 0 || data.against_relays.length > 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/relays"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
              aria-label="Back to relays"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-surface-400" />
              <h1 className="text-lg font-mono font-bold text-white">Relay Compare</h1>
            </div>
          </div>
          <p className="text-sm text-surface-500 font-mono ml-12">
            Compare all FOR and AGAINST relay chains on a single topic — side by side.
          </p>
        </div>

        {/* Topic search */}
        <div className="mb-6 relative z-10">
          <TopicPicker onSelect={handleTopicSelect} />
        </div>

        {/* Selected topic info */}
        {topic && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl bg-surface-100 border border-surface-300 p-4"
          >
            <div className="flex items-start gap-3">
              <GitMerge className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug font-medium">{topic.statement}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {topic.category && (
                    <span className="text-[10px] text-surface-500 font-mono">{topic.category}</span>
                  )}
                  <span className={cn(
                    'text-[10px] font-mono font-semibold uppercase',
                    topic.status === 'law' ? 'text-gold' :
                    topic.status === 'voting' ? 'text-purple' :
                    topic.status === 'active' ? 'text-for-400' :
                    'text-surface-500'
                  )}>
                    {topic.status}
                  </span>
                  <span className="text-[10px] text-surface-600 font-mono">
                    {Math.round(topic.blue_pct)}% FOR · {topic.total_votes.toLocaleString()} votes
                  </span>
                  <Link
                    href={`/topic/${topic.id}`}
                    className="text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors ml-auto"
                  >
                    View topic →
                  </Link>
                </div>
              </div>
            </div>

            {/* FOR vs AGAINST bar */}
            <div className="mt-3 space-y-1">
              <div className="h-2 bg-surface-300 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-for-500 transition-all"
                  style={{ width: `${Math.round(topic.blue_pct)}%` }}
                />
                <div className="h-full bg-against-500 flex-1" />
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-for-400">{Math.round(topic.blue_pct)}% For</span>
                <span className="text-against-400">{100 - Math.round(topic.blue_pct)}% Against</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Battle banner */}
        {data && (
          <div className="mb-5">
            <BattleBanner
              winner={data.battle_winner}
              forTotal={data.for_total}
              againstTotal={data.against_total}
            />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-4 rounded-full bg-for-500/20 border border-for-500/40 flex-shrink-0" />
                <Skeleton className="h-4 w-20" />
              </div>
              <ColumnSkeleton />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-4 rounded-full bg-against-500/20 border border-against-500/40 flex-shrink-0" />
                <Skeleton className="h-4 w-24" />
              </div>
              <ColumnSkeleton />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-4 text-sm text-against-400 font-mono">
            {error}
          </div>
        )}

        {/* No data placeholder (no topic selected yet) */}
        {!topicId && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center">
              <Swords className="h-6 w-6 text-surface-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-mono font-bold text-white">Pick a topic to compare</p>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Search above to find a topic and see its relay chain battle.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
              <Link href="/relays/showdown" className="text-for-400 hover:text-for-300 transition-colors">
                Browse all showdowns →
              </Link>
              <span>·</span>
              <Link href="/relays" className="text-surface-400 hover:text-white transition-colors">
                Browse relays
              </Link>
            </div>
          </div>
        )}

        {/* Empty state (topic selected but no relays) */}
        {data && !hasData && !loading && (
          <EmptyState
            icon={GitMerge}
            title="No relay chains yet"
            description="This topic doesn't have any relay chains. Be the first to start one!"
            action={{
              label: 'Start a relay',
              href: `/relay?topic=${topic?.id}`,
              icon: Zap,
            }}
          />
        )}

        {/* Relay columns */}
        {data && hasData && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* FOR column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-4 rounded-full bg-for-500 border-2 border-for-500/50 flex-shrink-0" />
                <span className="text-sm font-mono font-bold text-for-300">FOR</span>
                <Badge variant="default" className="ml-1 text-[10px] bg-for-500/10 text-for-400 border-for-500/20">
                  {data.for_total} chain{data.for_total !== 1 ? 's' : ''}
                </Badge>
              </div>

              {data.for_relays.length > 0 ? (
                <div className="space-y-3">
                  {data.for_relays.map((r, i) => (
                    <RelayCard key={r.id} relay={r} isFor rank={i} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-for-500/20 p-6 text-center">
                  <p className="text-sm text-surface-500 font-mono">No FOR chains yet</p>
                  <Link
                    href={`/relay?topic=${topic?.id}&side=for`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    Start a FOR chain
                  </Link>
                </div>
              )}
            </div>

            {/* AGAINST column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-4 rounded-full bg-against-500 border-2 border-against-500/50 flex-shrink-0" />
                <span className="text-sm font-mono font-bold text-against-300">AGAINST</span>
                <Badge variant="default" className="ml-1 text-[10px] bg-against-500/10 text-against-400 border-against-500/20">
                  {data.against_total} chain{data.against_total !== 1 ? 's' : ''}
                </Badge>
              </div>

              {data.against_relays.length > 0 ? (
                <div className="space-y-3">
                  {data.against_relays.map((r, i) => (
                    <RelayCard key={r.id} relay={r} isFor={false} rank={i} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-against-500/20 p-6 text-center">
                  <p className="text-sm text-surface-500 font-mono">No AGAINST chains yet</p>
                  <Link
                    href={`/relay?topic=${topic?.id}&side=against`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    Start an AGAINST chain
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Related links */}
        {data && hasData && (
          <div className="mt-8 flex items-center justify-center gap-4 text-xs font-mono text-surface-600">
            <Link href="/relays/showdown" className="hover:text-surface-400 transition-colors">
              All showdowns
            </Link>
            <span>·</span>
            <Link href={`/topic/${topic?.id}/relays`} className="hover:text-surface-400 transition-colors">
              All relays for this topic
            </Link>
            <span>·</span>
            <Link href="/relays" className="hover:text-surface-400 transition-colors">
              Browse relays
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}

export default function RelaysComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-5xl mx-auto px-4 pt-6 pb-24">
          <div className="mb-6">
            <Skeleton className="h-9 w-9 rounded-xl mb-3" />
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ColumnSkeleton />
            <ColumnSkeleton />
          </div>
        </main>
        <BottomNav />
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
