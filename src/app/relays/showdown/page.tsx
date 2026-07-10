'use client'

/**
 * /relays/showdown — Relay Chain Head-to-Head
 *
 * Pairs completed FOR and AGAINST relay chains on the same topic so the
 * community can compare them side-by-side and vote on each chain's
 * compelling-ness.  A topic appears here only when both a complete FOR and
 * a complete AGAINST relay exist.
 *
 * Distinct from:
 *   /relays          — browse and join open relays
 *   /duel            — individual argument duels
 *   /faceoffs        — single-argument head-to-heads
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Loader2,
  RefreshCw,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ShowdownPair, ShowdownResponse, ShowdownRelay } from '@/app/api/relays/showdown/route'

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

// ─── Single relay chain column ────────────────────────────────────────────────

interface RelayColumnProps {
  relay: ShowdownRelay
  expanded: boolean
  onToggle: () => void
  onVote: (vote: 'compelling' | 'not_compelling') => void
  voting: boolean
}

function RelayColumn({ relay, expanded, onToggle, onVote, voting }: RelayColumnProps) {
  const isFor = relay.side === 'for'
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : 0

  const sideStyles = isFor
    ? {
        badge: 'bg-for-500/20 text-for-300 border-for-500/30',
        bar: 'bg-for-500',
        border: 'border-for-500/20',
        glow: 'hover:border-for-500/40',
        label: 'FOR',
      }
    : {
        badge: 'bg-against-500/20 text-against-300 border-against-500/30',
        bar: 'bg-against-500',
        border: 'border-against-500/20',
        glow: 'hover:border-against-500/40',
        label: 'AGAINST',
      }

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl bg-surface-100 border transition-colors',
        sideStyles.border,
        sideStyles.glow,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-surface-300/40">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
            sideStyles.badge,
          )}
        >
          {sideStyles.label}
        </span>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Avatar
            src={relay.starter_avatar_url}
            fallback={relay.starter_display_name || relay.starter_username}
            size="xs"
          />
          <Link
            href={`/profile/${relay.starter_username}`}
            className="text-xs text-surface-400 hover:text-white truncate"
          >
            @{relay.starter_username}
          </Link>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[10px] text-surface-500 font-mono">
            {relay.legs.length}/{relay.max_legs} legs
          </span>
          {relay.completed_at && (
            <span className="text-[10px] text-surface-600 font-mono">
              {relativeTime(relay.completed_at)}
            </span>
          )}
        </div>
      </div>

      {/* Legs preview */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-200/40 transition-colors rounded-t-none"
      >
        <div className="flex-1 min-w-0">
          {relay.legs.length > 0 ? (
            <p className="text-xs text-surface-300 line-clamp-2 leading-relaxed">
              {relay.legs[0].content}
            </p>
          ) : (
            <p className="text-xs text-surface-500 italic">No legs yet</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
        )}
      </button>

      {/* Expanded legs */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {relay.legs.map((leg, idx) => (
                <div key={leg.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                    <span
                      className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold',
                        isFor
                          ? 'bg-for-500/20 text-for-400 border border-for-500/30'
                          : 'bg-against-500/20 text-against-400 border border-against-500/30',
                      )}
                    >
                      {idx + 1}
                    </span>
                    {idx < relay.legs.length - 1 && (
                      <div
                        className={cn('w-px flex-1 min-h-[12px]', isFor ? 'bg-for-500/20' : 'bg-against-500/20')}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-surface-200 leading-relaxed">{leg.content}</p>
                    {leg.author && (
                      <Link
                        href={`/profile/${leg.author.username}`}
                        className="text-[10px] text-surface-500 hover:text-surface-400 mt-0.5 inline-block"
                      >
                        @{leg.author.username}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vote bar */}
      {totalVotes > 0 && (
        <div className="px-4 py-2 border-t border-surface-300/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald shrink-0">{compellingPct}%</span>
            <div className="flex-1 h-1 bg-surface-300/60 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', sideStyles.bar)}
                style={{ width: `${compellingPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-surface-500 shrink-0">{totalVotes} votes</span>
          </div>
        </div>
      )}

      {/* Vote actions */}
      <div className="flex gap-2 px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={() => onVote('compelling')}
          disabled={voting}
          aria-label="Vote compelling"
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-mono font-semibold transition-all',
            relay.user_vote === 'compelling'
              ? 'bg-emerald/20 border-emerald/40 text-emerald'
              : 'border-surface-400/40 text-surface-400 hover:border-emerald/40 hover:text-emerald hover:bg-emerald/10',
            voting && 'opacity-50 cursor-not-allowed',
          )}
        >
          {voting && relay.user_vote !== 'compelling' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
          <span>{relay.vote_compelling}</span>
        </button>
        <button
          type="button"
          onClick={() => onVote('not_compelling')}
          disabled={voting}
          aria-label="Vote not compelling"
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-mono font-semibold transition-all',
            relay.user_vote === 'not_compelling'
              ? 'bg-against-500/20 border-against-500/40 text-against-300'
              : 'border-surface-400/40 text-surface-400 hover:border-against-500/40 hover:text-against-300 hover:bg-against-500/10',
            voting && 'opacity-50 cursor-not-allowed',
          )}
        >
          {voting && relay.user_vote === 'not_compelling' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
          <span>{relay.vote_not_compelling}</span>
        </button>
      </div>
    </div>
  )
}

// ─── Showdown card ────────────────────────────────────────────────────────────

function ShowdownCard({ pair, initialExpand = false }: { pair: ShowdownPair; initialExpand?: boolean }) {
  const [forExpanded, setForExpanded] = useState(initialExpand)
  const [againstExpanded, setAgainstExpanded] = useState(initialExpand)
  const [forRelay, setForRelay] = useState<ShowdownRelay>(pair.for_relay)
  const [againstRelay, setAgainstRelay] = useState<ShowdownRelay>(pair.against_relay)
  const [votingFor, setVotingFor] = useState(false)
  const [votingAgainst, setVotingAgainst] = useState(false)

  async function voteOnRelay(
    relayId: string,
    vote: 'compelling' | 'not_compelling',
    current: ShowdownRelay,
    setRelay: (r: ShowdownRelay) => void,
    setBusy: (b: boolean) => void,
  ) {
    setBusy(true)
    try {
      const res = await fetch(`/api/relays/${relayId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', vote }),
      })
      if (!res.ok) return
      // Optimistically update
      const prev = current.user_vote
      const isToggle = prev === vote
      setRelay({
        ...current,
        user_vote: isToggle ? null : vote,
        vote_compelling:
          vote === 'compelling'
            ? current.vote_compelling + (isToggle ? -1 : 1) + (prev === 'not_compelling' ? 0 : 0)
            : current.vote_compelling + (prev === 'compelling' ? -1 : 0),
        vote_not_compelling:
          vote === 'not_compelling'
            ? current.vote_not_compelling + (isToggle ? -1 : 1)
            : current.vote_not_compelling + (prev === 'not_compelling' ? -1 : 0),
      })
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  const categoryStyle: Record<string, string> = {
    Politics:    'bg-for-500/10 text-for-300 border-for-500/20',
    Economics:   'bg-gold/10 text-gold border-gold/20',
    Technology:  'bg-purple/10 text-purple border-purple/20',
    Science:     'bg-emerald/10 text-emerald border-emerald/20',
    Ethics:      'bg-against-500/10 text-against-300 border-against-500/20',
    Philosophy:  'bg-against-400/10 text-against-200 border-against-400/20',
    Culture:     'bg-amber-500/10 text-amber-300 border-amber-500/20',
    Health:      'bg-rose-500/10 text-rose-300 border-rose-500/20',
    Environment: 'bg-green-500/10 text-green-300 border-green-500/20',
    Education:   'bg-indigo-400/10 text-indigo-300 border-indigo-400/20',
  }
  const catClass = pair.topic_category
    ? (categoryStyle[pair.topic_category] ?? 'bg-surface-300/20 text-surface-400 border-surface-400/20')
    : 'bg-surface-300/20 text-surface-400 border-surface-400/20'

  return (
    <div className="rounded-2xl bg-surface-100/50 border border-surface-300/60 overflow-hidden">
      {/* Topic header */}
      <div className="px-5 py-4 border-b border-surface-300/40 bg-surface-100/80">
        <div className="flex items-start gap-3">
          <Swords className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {pair.topic_category && (
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', catClass)}>
                  {pair.topic_category}
                </span>
              )}
              <span className="text-[10px] font-mono text-surface-500">
                {forRelay.legs.length + againstRelay.legs.length} total legs
              </span>
            </div>
            <Link
              href={`/topic/${pair.topic_id}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug line-clamp-2"
            >
              {pair.topic_statement}
            </Link>
          </div>
          <Link
            href={`/topic/${pair.topic_id}`}
            className="shrink-0 text-[10px] font-mono text-surface-500 hover:text-surface-300 border border-surface-400/30 hover:border-surface-400/60 rounded-lg px-2 py-1 transition-colors"
          >
            Topic →
          </Link>
        </div>
      </div>

      {/* Side-by-side relay columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
        <RelayColumn
          relay={forRelay}
          expanded={forExpanded}
          onToggle={() => setForExpanded((x) => !x)}
          onVote={(v) => voteOnRelay(forRelay.id, v, forRelay, setForRelay, setVotingFor)}
          voting={votingFor}
        />
        <RelayColumn
          relay={againstRelay}
          expanded={againstExpanded}
          onToggle={() => setAgainstExpanded((x) => !x)}
          onVote={(v) => voteOnRelay(againstRelay.id, v, againstRelay, setAgainstRelay, setVotingAgainst)}
          voting={votingAgainst}
        />
      </div>

      {/* View full relays + transcripts */}
      <div className="flex items-center gap-3 px-4 pb-2">
        <Link
          href={`/relays/${forRelay.id}`}
          className="flex-1 text-center py-1.5 rounded-xl border border-for-500/20 text-for-400 text-[11px] font-mono hover:bg-for-500/10 transition-colors"
        >
          Full FOR relay →
        </Link>
        <Link
          href={`/relays/${againstRelay.id}`}
          className="flex-1 text-center py-1.5 rounded-xl border border-against-500/20 text-against-400 text-[11px] font-mono hover:bg-against-500/10 transition-colors"
        >
          Full AGAINST relay →
        </Link>
      </div>
      <div className="flex items-center gap-3 px-4 pb-2">
        <Link
          href={`/relays/${forRelay.id}/transcript`}
          className="flex-1 text-center py-1.5 rounded-xl border border-surface-400/20 text-surface-500 text-[11px] font-mono hover:text-for-300 hover:border-for-500/20 transition-colors"
        >
          Read FOR transcript
        </Link>
        <Link
          href={`/relays/${againstRelay.id}/transcript`}
          className="flex-1 text-center py-1.5 rounded-xl border border-surface-400/20 text-surface-500 text-[11px] font-mono hover:text-against-300 hover:border-against-500/20 transition-colors"
        >
          Read AGAINST transcript
        </Link>
      </div>
      <div className="flex items-center gap-3 px-4 pb-4">
        <Link
          href={`/relays/${forRelay.id}/scorecard`}
          className="flex-1 text-center py-1.5 rounded-xl border border-gold/20 text-gold/70 text-[11px] font-mono hover:text-gold hover:border-gold/40 transition-colors"
        >
          FOR scorecard
        </Link>
        <Link
          href={`/relays/${againstRelay.id}/scorecard`}
          className="flex-1 text-center py-1.5 rounded-xl border border-gold/20 text-gold/70 text-[11px] font-mono hover:text-gold hover:border-gold/40 transition-colors"
        >
          AGAINST scorecard
        </Link>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ShowdownSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100/50 border border-surface-300/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-300/40">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-5 w-full mb-1" />
            <Skeleton className="h-5 w-3/4" />
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-5/6" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-xl" />
                <Skeleton className="h-8 flex-1 rounded-xl" />
              </div>
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-4/5" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-xl" />
                <Skeleton className="h-8 flex-1 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShowdownPage() {
  const router = useRouter()
  const [pairs, setPairs] = useState<ShowdownPair[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  const fetchPage = useCallback(async (p: number, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/showdown?page=${p}`)
      if (!res.ok) throw new Error('Failed to load showdowns')
      const data = (await res.json()) as ShowdownResponse
      setPairs((prev) => (append ? [...prev, ...data.pairs] : data.pairs))
      setTotal(data.total)
      setPage(p)
    } catch {
      setError('Could not load relay showdowns. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchPage(1)
  }, [fetchPage])

  const hasMore = pairs.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 sm:pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-surface-400" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-purple" aria-hidden="true" />
                <h1 className="text-xl font-bold text-white">Relay Showdown</h1>
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                Completed FOR vs AGAINST chains — side by side
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchPage(1)}
              disabled={loading}
              aria-label="Refresh showdowns"
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4 text-surface-400', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Nav pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Link
              href="/relays"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-surface-400/40 text-surface-400 text-xs font-mono hover:border-surface-400 hover:text-surface-200 transition-colors"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Browse Relays
            </Link>
            <Link
              href="/relays/create"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-surface-400/40 text-surface-400 text-xs font-mono hover:border-surface-400 hover:text-surface-200 transition-colors"
            >
              Start a Relay
            </Link>
            <Link
              href="/relays/stats"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-surface-400/40 text-surface-400 text-xs font-mono hover:border-surface-400 hover:text-surface-200 transition-colors"
            >
              Stats
            </Link>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple/40 text-purple text-xs font-mono bg-purple/10">
              <Swords className="h-3.5 w-3.5" />
              Showdown
            </span>
          </div>
        </motion.div>

        {/* Stat strip */}
        {!loading && total > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl bg-surface-100 border border-surface-300/60"
          >
            <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
            <span className="text-xs font-mono text-surface-400">
              <span className="text-white font-semibold">{total}</span> matched showdown{total === 1 ? '' : 's'}
            </span>
            <span className="text-surface-600 mx-1">·</span>
            <Users className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
            <span className="text-xs font-mono text-surface-500">Vote on each chain</span>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <ShowdownSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <p className="text-sm text-against-300 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => fetchPage(1)}
              className="text-xs font-mono text-surface-400 hover:text-white border border-surface-400/40 hover:border-surface-400 rounded-lg px-4 py-2 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : pairs.length === 0 ? (
          <EmptyState
            icon={Swords}
            iconColor="text-surface-400"
            iconBg="bg-surface-300/20"
            iconBorder="border-surface-400/20"
            title="No showdowns yet"
            description="A showdown appears when both a FOR and AGAINST relay chain on the same topic are complete. Start or join a relay to get one going."
            action={{ label: 'Browse open relays', href: '/relays' }}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {pairs.map((pair, i) => (
              <motion.div
                key={`${pair.topic_id}-${pair.for_relay.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3) }}
              >
                <ShowdownCard pair={pair} initialExpand={i === 0} />
              </motion.div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => fetchPage(page + 1, true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    `Load more (${total - pairs.length} remaining)`
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
