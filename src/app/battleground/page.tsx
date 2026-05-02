'use client'

/**
 * /battleground — The Civic Battleground
 *
 * A cinematic, live split-screen view of the most contested topic right now.
 * FOR (blue) vs AGAINST (red) — each side shows its top argument, recent
 * voter activity, and a live momentum bar.
 *
 * Polls /api/battleground every 15 s for fresh data.
 * Users can switch between the top 5 most active topics.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { BattlegroundResponse, BattleVote, BattleArgument } from '@/app/api/battleground/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function BattleSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-6 pb-24 md:pb-12 gap-4">
        {/* Topic header */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
        </div>
        {/* Battle bar */}
        <Skeleton className="h-6 w-full rounded-full" />
        {/* Split panels */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          <Skeleton className="rounded-2xl min-h-[300px]" />
          <Skeleton className="rounded-2xl min-h-[300px]" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  side,
}: {
  arg: BattleArgument | null
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'

  if (!arg) {
    return (
      <div className={cn(
        'rounded-2xl border p-5 flex flex-col items-center justify-center min-h-[120px] gap-2 text-center',
        isFor
          ? 'bg-for-950/30 border-for-500/20'
          : 'bg-against-950/30 border-against-500/20'
      )}>
        <MessageSquare className={cn('h-5 w-5', isFor ? 'text-for-700' : 'text-against-700')} />
        <p className="text-xs font-mono text-surface-600 italic">No argument yet — be the first</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-2xl border p-4 flex flex-col gap-3',
      isFor
        ? 'bg-for-950/30 border-for-500/25'
        : 'bg-against-950/30 border-against-500/25'
    )}>
      <div className="flex items-start gap-2">
        {isFor
          ? <ThumbsUp className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
          : <ThumbsDown className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
        }
        <p className="text-sm font-mono text-surface-200 leading-relaxed">
          &ldquo;{truncate(arg.content, 200)}&rdquo;
        </p>
      </div>

      <div className="flex items-center justify-between mt-auto">
        {arg.author ? (
          <Link
            href={`/profile/${arg.author.username}`}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name ?? arg.author.username}
              size="xs"
            />
            <span className="text-[11px] font-mono text-surface-500 truncate max-w-[80px]">
              {arg.author.display_name ?? `@${arg.author.username}`}
            </span>
          </Link>
        ) : (
          <span />
        )}
        <div className={cn(
          'flex items-center gap-1 text-[11px] font-mono font-semibold',
          isFor ? 'text-for-400' : 'text-against-400'
        )}>
          <Zap className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>
    </div>
  )
}

// ─── Vote stream item ──────────────────────────────────────────────────────────

function VoteItem({ vote, isNew }: { vote: BattleVote; isNew?: boolean }) {
  const isFor = vote.side === 'blue'

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: -12, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'flex items-start gap-2 py-2 px-3 rounded-xl border text-xs font-mono',
        isFor
          ? 'bg-for-950/40 border-for-500/20 text-for-300'
          : 'bg-against-950/40 border-against-500/20 text-against-300'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isFor
          ? <ThumbsUp className="h-3 w-3 text-for-400" />
          : <ThumbsDown className="h-3 w-3 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {vote.voter_username && (
            <span className="font-semibold text-surface-300 truncate">
              @{vote.voter_display_name ?? vote.voter_username}
            </span>
          )}
          <span className="text-surface-600">voted {isFor ? 'FOR' : 'AGAINST'}</span>
          <span className="text-surface-700 ml-auto">{relativeTime(vote.voted_at)}</span>
        </div>
        {vote.reason && (
          <p className="mt-0.5 text-surface-400 leading-snug italic">
            &ldquo;{truncate(vote.reason, 100)}&rdquo;
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Alternate topic pill ─────────────────────────────────────────────────────

function AltTopicPill({
  topic,
  selected,
  onClick,
}: {
  topic: BattlegroundResponse['alternates'][0]
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all',
        'text-xs font-mono max-w-[220px]',
        selected
          ? 'bg-for-600/20 border-for-500/50 text-for-300'
          : 'bg-surface-200/60 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-surface-200'
      )}
    >
      <Flame className={cn('h-3 w-3 flex-shrink-0', topic.recent_velocity > 5 ? 'text-against-400' : 'text-surface-600')} />
      <span className="truncate">{truncate(topic.statement, 45)}</span>
      {topic.recent_velocity > 0 && (
        <span className="flex-shrink-0 text-surface-600">+{topic.recent_velocity}/h</span>
      )}
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BattlegroundPage() {
  const [data, setData] = useState<BattlegroundResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [prevVoteIds, setPrevVoteIds] = useState<Set<string>>(new Set())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (opts?: { topicId?: string; refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true)
    try {
      const params = new URLSearchParams()
      const tid = opts?.topicId ?? selectedTopicId
      if (tid) params.set('topic_id', tid)
      const res = await fetch(`/api/battleground?${params}`, { cache: 'no-store' })
      if (!res.ok) return
      const json: BattlegroundResponse = await res.json()
      setData(json)
      if (json.topic && !selectedTopicId) {
        setSelectedTopicId(json.topic.id)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedTopicId])

  // Initial load + polling
  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(), 15_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId])

  // Track new votes for animation
  useEffect(() => {
    if (!data?.topic?.recent_votes) return
    const ids = new Set(
      data.topic.recent_votes.map((v) => `${v.voter_username}-${v.voted_at}`)
    )
    setPrevVoteIds(ids)
  }, [data?.topic?.id]) // only reset on topic change

  const handleTopicSwitch = useCallback((topicId: string) => {
    setSelectedTopicId(topicId)
    setLoading(true)
    load({ topicId })
  }, [load])

  if (loading) return <BattleSkeleton />

  const topic = data?.topic ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Swords className="h-5 w-5 text-against-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Battleground</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Live civic battle — FOR vs AGAINST
              </p>
            </div>
          </div>

          <button
            onClick={() => load({ refresh: true })}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh battleground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {!topic ? (
          <EmptyState
            icon={Swords}
            title="No active battles"
            description="The Battleground activates when topics are actively debated. Check back soon."
            actions={[{ label: 'Browse topics', href: '/' }]}
          />
        ) : (
          <>
            {/* ── Topic picker ─────────────────────────────────────── */}
            {(data?.alternates ?? []).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-surface-600 mr-1">
                  Active battles
                </span>
                <AltTopicPill
                  topic={{
                    id: topic.id,
                    statement: topic.statement,
                    category: topic.category,
                    status: topic.status,
                    blue_pct: topic.blue_pct,
                    total_votes: topic.total_votes,
                    recent_velocity: topic.recent_velocity,
                  }}
                  selected
                  onClick={() => {}}
                />
                {(data?.alternates ?? []).map((alt) => (
                  <AltTopicPill
                    key={alt.id}
                    topic={alt}
                    selected={false}
                    onClick={() => handleTopicSwitch(alt.id)}
                  />
                ))}
              </div>
            )}

            {/* ── Topic statement ──────────────────────────────────── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                {/* Status + category row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={topic.status === 'voting' ? 'active' : 'proposed'}>
                    {topic.status === 'voting' ? (
                      <><Scale className="h-3 w-3 mr-1" />Final Vote</>
                    ) : (
                      <><Zap className="h-3 w-3 mr-1" />Active</>
                    )}
                  </Badge>
                  {topic.category && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-300/60 text-surface-500 border border-surface-300">
                      {topic.category}
                    </span>
                  )}
                  {topic.recent_velocity > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-against-400">
                      <Flame className="h-3 w-3" />
                      +{topic.recent_velocity} this hour
                    </span>
                  )}
                  <Link
                    href={`/topic/${topic.id}`}
                    className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Full topic
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {/* Statement */}
                <h2 className="font-mono text-xl md:text-2xl font-bold text-white leading-snug">
                  {topic.statement}
                </h2>

                {/* ── War bar ─────────────────────────────────────── */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-mono font-bold">
                    <span className="text-for-400">
                      FOR {Math.round(topic.blue_pct)}%
                    </span>
                    <span className="text-surface-600 text-xs font-normal">
                      <AnimatedNumber value={topic.total_votes} /> total votes
                    </span>
                    <span className="text-against-400">
                      {Math.round(100 - topic.blue_pct)}% AGAINST
                    </span>
                  </div>

                  {/* Battle progress bar */}
                  <div className="relative h-5 rounded-full overflow-hidden bg-surface-300 flex">
                    <motion.div
                      className="h-full bg-gradient-to-r from-for-700 to-for-500"
                      initial={{ width: '50%' }}
                      animate={{ width: `${topic.blue_pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="h-full bg-gradient-to-l from-against-700 to-against-500"
                      initial={{ width: '50%' }}
                      animate={{ width: `${100 - topic.blue_pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                    {/* Center line */}
                    <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/20 -translate-x-px" />
                  </div>

                  {/* Momentum label */}
                  <div className="flex justify-center">
                    {Math.abs(topic.blue_pct - 50) < 3 ? (
                      <span className="text-[11px] font-mono text-surface-500 flex items-center gap-1">
                        <Scale className="h-3 w-3" /> Dead heat — too close to call
                      </span>
                    ) : topic.blue_pct > 50 ? (
                      <span className="text-[11px] font-mono text-for-400 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> FOR is winning by {Math.round(Math.abs(topic.blue_pct - 50) * 2)}%
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-against-400 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> AGAINST is winning by {Math.round(Math.abs(topic.blue_pct - 50) * 2)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Split panels ─────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">

                  {/* FOR panel */}
                  <div className={cn(
                    'rounded-2xl border p-5 space-y-4',
                    'bg-for-950/20 border-for-500/30'
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/20 border border-for-500/30">
                        <ThumbsUp className="h-4 w-4 text-for-400" />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-bold text-for-300">FOR</p>
                        <p className="text-[11px] font-mono text-for-700">
                          {Math.round(topic.blue_pct * topic.total_votes / 100).toLocaleString()} votes
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-surface-600 font-mono">Top argument</p>
                      <ArgCard arg={topic.for_arg} side="for" />
                    </div>

                    <Link
                      href={`/topic/${topic.id}`}
                      className="inline-flex items-center gap-1 text-xs font-mono text-for-500 hover:text-for-300 transition-colors"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Argue FOR
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* AGAINST panel */}
                  <div className={cn(
                    'rounded-2xl border p-5 space-y-4',
                    'bg-against-950/20 border-against-500/30'
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/20 border border-against-500/30">
                        <ThumbsDown className="h-4 w-4 text-against-400" />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-bold text-against-300">AGAINST</p>
                        <p className="text-[11px] font-mono text-against-700">
                          {Math.round((100 - topic.blue_pct) * topic.total_votes / 100).toLocaleString()} votes
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-surface-600 font-mono">Top argument</p>
                      <ArgCard arg={topic.against_arg} side="against" />
                    </div>

                    <Link
                      href={`/topic/${topic.id}`}
                      className="inline-flex items-center gap-1 text-xs font-mono text-against-500 hover:text-against-300 transition-colors"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Argue AGAINST
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* ── Recent vote stream ──────────────────────────── */}
                {topic.recent_votes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-surface-600" />
                      <p className="text-[10px] uppercase tracking-widest text-surface-600 font-mono">Recent voices</p>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                      <AnimatePresence initial={false}>
                        {topic.recent_votes.map((vote, i) => {
                          const voteKey = `${vote.voter_username}-${vote.voted_at}`
                          const isNew = !prevVoteIds.has(voteKey)
                          return (
                            <VoteItem
                              key={voteKey}
                              vote={vote}
                              isNew={isNew && i === 0}
                            />
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* ── CTA row ──────────────────────────────────────── */}
                <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-surface-300">
                  <Link
                    href={`/topic/${topic.id}`}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold',
                      'bg-for-600 hover:bg-for-500 text-white transition-colors border border-for-500/50'
                    )}
                  >
                    <Scale className="h-4 w-4" />
                    Cast your vote
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/topic/${topic.id}`}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-mono',
                      'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors'
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Debate
                  </Link>
                  <Link
                    href="/topic/create"
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors ml-auto"
                  >
                    <Gavel className="h-3.5 w-3.5" />
                    Propose new topic
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
