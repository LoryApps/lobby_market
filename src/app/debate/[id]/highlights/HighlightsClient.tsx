'use client'

/**
 * /debate/[id]/highlights — Debate Highlight Reel
 *
 * The curated "best of" from any debate: top-voted FOR arguments,
 * top-voted AGAINST arguments, audience sway timeline, and an overall
 * moments strip ranked by community upvotes.
 *
 * Distinct from:
 *   /debate/[id]/transcript  — full chronological message log
 *   /debate/[id]/performance — per-participant stats (speaker scorecards)
 *   /debate/[id]/recap       — summary verdict (who won, key stats)
 *
 * This is the HIGHLIGHT REEL — the must-see moments from the debate,
 * curated by community upvotes.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
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
import { cn } from '@/lib/utils/cn'
import type { HighlightsResponse, HighlightMessage, SwayCheckpoint } from '@/app/api/debates/[id]/highlights/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: 'Quick Debate',
  grand: 'Grand Debate',
  tribunal: 'Tribunal',
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

const CHECKPOINT_LABEL: Record<number, string> = {
  1: 'Opening',
  2: 'Midpoint',
  3: 'Closing',
}

// ─── Sway bar component ────────────────────────────────────────────────────────

function SwayBar({ cp }: { cp: SwayCheckpoint }) {
  const total = cp.for_votes + cp.against_votes
  const forPct = total > 0 ? Math.round((cp.for_votes / total) * 100) : 50
  const againstPct = 100 - forPct

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-for-400">{cp.for_votes} FOR</span>
        <span className="text-surface-400">{CHECKPOINT_LABEL[cp.checkpoint]}</span>
        <span className="text-against-400">{cp.against_votes} AGAINST</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className="h-full bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-against-500"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span>{forPct}%</span>
        <span>{total} audience votes</span>
        <span>{againstPct}%</span>
      </div>
    </div>
  )
}

// ─── Argument highlight card ───────────────────────────────────────────────────

function HighlightCard({
  message,
  rank,
  variant = 'neutral',
}: {
  message: HighlightMessage
  rank?: number
  variant?: 'for' | 'against' | 'neutral'
}) {
  const borderColor =
    variant === 'for'
      ? 'border-for-500/30 hover:border-for-500/50'
      : variant === 'against'
      ? 'border-against-500/30 hover:border-against-500/50'
      : 'border-surface-300 hover:border-surface-400'

  const badgeColor =
    variant === 'for'
      ? 'bg-for-500/10 text-for-400'
      : variant === 'against'
      ? 'bg-against-500/10 text-against-400'
      : 'bg-surface-200 text-surface-400'

  const rankColors = ['text-gold', 'text-surface-300', 'text-amber-700']
  const rankColor = rank !== undefined ? rankColors[rank] ?? 'text-surface-400' : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl border bg-surface-100 p-4 space-y-3 transition-colors',
        borderColor
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {rank !== undefined && (
            <span className={cn('font-mono text-sm font-bold flex-shrink-0', rankColor)}>
              #{rank + 1}
            </span>
          )}
          {message.author ? (
            <Link href={`/profile/${message.author.username}`} className="flex items-center gap-2 min-w-0 group">
              <Avatar
                src={message.author.avatar_url}
                fallback={message.author.display_name ?? message.author.username}
                size="xs"
              />
              <span className="text-xs font-semibold text-white group-hover:text-for-400 transition-colors truncate">
                {message.author.display_name ?? `@${message.author.username}`}
              </span>
            </Link>
          ) : (
            <span className="text-xs text-surface-500">Anonymous</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {message.is_argument && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-md', badgeColor)}>
              ARG
            </span>
          )}
          <div className="flex items-center gap-1 text-xs font-mono text-gold">
            <ThumbsUp className="h-3 w-3" />
            <span>{message.upvotes}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-100 leading-relaxed">{message.content}</p>
    </motion.div>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function HighlightsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-10 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function HighlightsClient({ debateId }: { debateId: string }) {
  const params = useParams()
  const id = debateId || (params.id as string)

  const [data, setData] = useState<HighlightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${id}/highlights`)
      if (!res.ok) throw new Error('Failed to load highlights')
      const json = await res.json()
      setData(json as HighlightsResponse)
    } catch {
      setError('Could not load debate highlights.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const debate = data?.debate

  // Determine winner
  const forWon = (debate?.blue_sway ?? 50) > (debate?.red_sway ?? 50)
  const isTie = debate?.blue_sway === debate?.red_sway

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <Link
          href={`/debate/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Highlight Reel
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {debate ? debate.title : 'Loading debate…'}
              </p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={load}
              className="flex-shrink-0 p-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white transition-colors"
              aria-label="Refresh highlights"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading && <HighlightsSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={<Scale className="h-8 w-8 text-surface-500" />}
            title="Could not load highlights"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && data && (
          <AnimatePresence mode="wait">
            <div className="space-y-8">

              {/* ── Debate meta banner ──────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="space-y-1 min-w-0">
                    {debate?.topic && (
                      <Link
                        href={`/topic/${debate.topic.id}`}
                        className="text-xs font-mono text-surface-500 hover:text-white transition-colors line-clamp-2"
                      >
                        {debate.topic.statement}
                      </Link>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {debate?.type && (
                        <Badge variant="proposed" size="sm">
                          {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
                        </Badge>
                      )}
                      {debate?.status === 'ended' && (
                        <Badge variant="law" size="sm">Ended</Badge>
                      )}
                      {debate?.topic?.category && (
                        <Badge variant="proposed" size="sm">{debate.topic.category}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono text-surface-500 flex-shrink-0">
                    <Users className="h-3.5 w-3.5" />
                    <span>{debate?.viewer_count?.toLocaleString() ?? 0} viewers</span>
                  </div>
                </div>

                {/* Speaker strip */}
                {(debate?.blue_speaker || debate?.red_speaker) && (
                  <div className="flex items-center gap-3">
                    {debate.blue_speaker && (
                      <Link
                        href={`/profile/${debate.blue_speaker.username}`}
                        className="flex items-center gap-2 flex-1 p-2.5 rounded-lg bg-for-500/10 border border-for-500/20 hover:border-for-500/40 transition-colors"
                      >
                        <Avatar
                          src={debate.blue_speaker.avatar_url}
                          fallback={debate.blue_speaker.display_name ?? debate.blue_speaker.username}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-for-300 truncate">
                            {debate.blue_speaker.display_name ?? debate.blue_speaker.username}
                          </p>
                          <p className="text-[10px] font-mono text-for-500">FOR</p>
                        </div>
                        {!isTie && forWon && <Trophy className="h-3.5 w-3.5 text-gold ml-auto flex-shrink-0" />}
                      </Link>
                    )}
                    <Scale className="h-4 w-4 text-surface-500 flex-shrink-0" />
                    {debate.red_speaker && (
                      <Link
                        href={`/profile/${debate.red_speaker.username}`}
                        className="flex items-center gap-2 flex-1 p-2.5 rounded-lg bg-against-500/10 border border-against-500/20 hover:border-against-500/40 transition-colors"
                      >
                        <Avatar
                          src={debate.red_speaker.avatar_url}
                          fallback={debate.red_speaker.display_name ?? debate.red_speaker.username}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-against-300 truncate">
                            {debate.red_speaker.display_name ?? debate.red_speaker.username}
                          </p>
                          <p className="text-[10px] font-mono text-against-500">AGAINST</p>
                        </div>
                        {!isTie && !forWon && <Trophy className="h-3.5 w-3.5 text-gold ml-auto flex-shrink-0" />}
                      </Link>
                    )}
                  </div>
                )}
              </motion.div>

              {/* ── Stats strip ─────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  {
                    icon: <MessageSquare className="h-4 w-4 text-for-400" />,
                    label: 'Messages',
                    value: data.stats.total_messages.toLocaleString(),
                  },
                  {
                    icon: <Zap className="h-4 w-4 text-purple" />,
                    label: 'Arguments',
                    value: data.stats.total_arguments.toLocaleString(),
                  },
                  {
                    icon: <ThumbsUp className="h-4 w-4 text-gold" />,
                    label: 'Upvotes',
                    value: data.stats.total_upvotes.toLocaleString(),
                  },
                ].map(({ icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center"
                  >
                    <div className="flex justify-center mb-1">{icon}</div>
                    <p className="font-mono text-lg font-bold text-white">{value}</p>
                    <p className="text-[10px] font-mono text-surface-500">{label}</p>
                  </div>
                ))}
              </motion.div>

              {/* ── Top arguments (FOR vs AGAINST) ──────────────────────── */}
              {(data.top_for.length > 0 || data.top_against.length > 0) && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="h-4 w-4 text-gold" />
                    <h2 className="text-sm font-semibold text-white">Best Arguments</h2>
                    <span className="text-[10px] font-mono text-surface-500 ml-auto">ranked by upvotes</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FOR column */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-for-500" />
                        <span className="text-xs font-mono font-bold text-for-400">FOR</span>
                        <span className="text-[10px] font-mono text-surface-500">
                          {data.stats.for_upvotes} upvotes total
                        </span>
                      </div>
                      {data.top_for.length > 0 ? (
                        data.top_for.map((msg, i) => (
                          <HighlightCard key={msg.id} message={msg} rank={i} variant="for" />
                        ))
                      ) : (
                        <p className="text-xs font-mono text-surface-500 italic py-4">
                          No FOR arguments recorded
                        </p>
                      )}
                    </div>

                    {/* AGAINST column */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-against-500" />
                        <span className="text-xs font-mono font-bold text-against-400">AGAINST</span>
                        <span className="text-[10px] font-mono text-surface-500">
                          {data.stats.against_upvotes} upvotes total
                        </span>
                      </div>
                      {data.top_against.length > 0 ? (
                        data.top_against.map((msg, i) => (
                          <HighlightCard key={msg.id} message={msg} rank={i} variant="against" />
                        ))
                      ) : (
                        <p className="text-xs font-mono text-surface-500 italic py-4">
                          No AGAINST arguments recorded
                        </p>
                      )}
                    </div>
                  </div>
                </motion.section>
              )}

              {/* ── Audience sway timeline ───────────────────────────────── */}
              {data.sway.some((cp) => cp.for_votes + cp.against_votes > 0) && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
                >
                  <div className="flex items-center gap-2 mb-5">
                    <BarChart2 className="h-4 w-4 text-purple" />
                    <h2 className="text-sm font-semibold text-white">Audience Sway</h2>
                    <span className="text-[10px] font-mono text-surface-500 ml-auto">
                      3 checkpoints
                    </span>
                  </div>
                  <div className="space-y-5">
                    {data.sway.map((cp) => (
                      <SwayBar key={cp.checkpoint} cp={cp} />
                    ))}
                  </div>
                  {/* Final verdict */}
                  <div
                    className={cn(
                      'mt-5 pt-5 border-t border-surface-300 text-center',
                    )}
                  >
                    <p className="text-xs font-mono text-surface-500 mb-1">Final audience verdict</p>
                    {isTie ? (
                      <p className="text-sm font-bold text-white">Tied — no clear winner</p>
                    ) : forWon ? (
                      <p className="text-sm font-bold text-for-400">
                        FOR won — {debate?.blue_sway ?? 50}% audience support
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-against-400">
                        AGAINST won — {debate?.red_sway ?? 50}% audience support
                      </p>
                    )}
                  </div>
                </motion.section>
              )}

              {/* ── Top moments (all messages, by upvotes) ──────────────── */}
              {data.top_overall.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-4 w-4 text-against-400" />
                    <h2 className="text-sm font-semibold text-white">Top Moments</h2>
                    <span className="text-[10px] font-mono text-surface-500 ml-auto">
                      highest-upvoted messages
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.top_overall.map((msg, i) => (
                      <HighlightCard
                        key={msg.id}
                        message={msg}
                        rank={i}
                        variant={
                          msg.side === 'blue' ? 'for' : msg.side === 'red' ? 'against' : 'neutral'
                        }
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* ── Empty state ──────────────────────────────────────────── */}
              {data.top_for.length === 0 &&
                data.top_against.length === 0 &&
                data.top_overall.length === 0 && (
                  <EmptyState
                    icon={<MessageSquare className="h-8 w-8 text-surface-500" />}
                    title="No highlights yet"
                    description={
                      data.debate.status === 'scheduled'
                        ? 'This debate hasn\'t started yet. Check back once it goes live.'
                        : 'No upvoted messages found for this debate.'
                    }
                  />
                )}

              {/* ── Navigation links ─────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { label: 'Recap', sub: 'Overview', href: `/debate/${id}/recap` },
                  { label: 'Performance', sub: 'Speaker stats', href: `/debate/${id}/performance` },
                  { label: 'Transcript', sub: 'Full log', href: `/debate/${id}/transcript` },
                ].map(({ label, sub, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors">
                        {label}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">{sub}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  </Link>
                ))}
              </motion.div>

            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
