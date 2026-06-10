'use client'

/**
 * /debate/[id]/clash — The Clash Card
 *
 * A visual, shareable head-to-head summary of a completed debate.
 * Designed for social sharing — shows the core outcome at a glance:
 * who argued FOR vs AGAINST, the community verdict, the best argument
 * from each side, and the sway split.
 *
 * Distinct from:
 *   /debate/[id]/verdict     — comprehensive verdict with all stats
 *   /debate/[id]/analysis    — AI rhetorical breakdown
 *   /debate/[id]/performance — per-speaker athlete stats
 *   /debate/[id]/highlights  — all top messages
 *
 * Clash is the shareable "match card" — clean, visual, one screen.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Share2,
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
import { cn } from '@/lib/utils/cn'
import type { ClashResponse, ClashSpeaker, ClashArgument } from '@/app/api/debates/[id]/clash/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ClashSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-5 w-48 rounded-lg" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  )
}

// ─── Speaker Card ─────────────────────────────────────────────────────────────

function SpeakerCard({
  speaker,
  side,
  isWinner,
  bestArgument,
}: {
  speaker: ClashSpeaker | null
  side: 'for' | 'against'
  isWinner: boolean
  bestArgument: ClashArgument | null
}) {
  const isFor = side === 'for'
  const label = isFor ? 'FOR' : 'AGAINST'

  if (!speaker) {
    return (
      <div
        className={cn(
          'relative rounded-2xl border p-4 flex flex-col gap-3 bg-surface-200/40',
          isFor ? 'border-for-500/20' : 'border-against-500/20'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className={cn(
              'text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded',
              isFor
                ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                : 'bg-against-500/15 text-against-400 border border-against-500/30'
            )}
          >
            {label}
          </div>
        </div>
        <p className="text-xs text-surface-500 font-mono">No speaker recorded</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: isFor ? 0.1 : 0.2 }}
      className={cn(
        'relative rounded-2xl border p-4 flex flex-col gap-3 overflow-hidden',
        isFor
          ? 'border-for-500/30 bg-for-950/30'
          : 'border-against-500/30 bg-against-950/30',
        isWinner && 'ring-1',
        isFor && isWinner && 'ring-for-500/40',
        !isFor && isWinner && 'ring-against-500/40'
      )}
    >
      {/* Winner crown */}
      {isWinner && (
        <div className="absolute -top-px -right-px">
          <div
            className={cn(
              'flex items-center gap-1 rounded-bl-xl rounded-tr-xl px-2 py-1',
              isFor ? 'bg-for-600/80' : 'bg-against-600/80'
            )}
          >
            <Crown className="h-2.5 w-2.5 text-gold" />
            <span className="text-[9px] font-mono font-bold text-gold uppercase tracking-widest">
              Winner
            </span>
          </div>
        </div>
      )}

      {/* Side label */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border',
            isFor
              ? 'bg-for-500/15 text-for-400 border-for-500/30'
              : 'bg-against-500/15 text-against-400 border-against-500/30'
          )}
        >
          {label}
        </div>
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-500" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-500" />
        )}
      </div>

      {/* Speaker identity */}
      <div className="flex items-center gap-2.5">
        <Avatar
          src={speaker.avatar_url}
          username={speaker.username}
          size="sm"
          className={cn(
            'ring-2',
            isFor ? 'ring-for-500/30' : 'ring-against-500/30'
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {speaker.display_name ?? speaker.username}
          </p>
          <Link
            href={`/profile/${speaker.username}`}
            className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors font-mono"
          >
            @{speaker.username}
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {speaker.argument_count} arg{speaker.argument_count !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {speaker.total_upvotes} up
        </span>
      </div>

      {/* Best argument */}
      {bestArgument && (
        <div
          className={cn(
            'rounded-xl border p-3 bg-surface-100/40',
            isFor ? 'border-for-500/20' : 'border-against-500/20'
          )}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-1.5">
            Best argument
          </p>
          <p className="text-xs text-surface-300 leading-relaxed line-clamp-4">
            {bestArgument.content}
          </p>
          {bestArgument.upvotes > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <ThumbsUp
                className={cn('h-2.5 w-2.5', isFor ? 'text-for-400' : 'text-against-400')}
              />
              <span
                className={cn(
                  'text-[10px] font-mono font-semibold',
                  isFor ? 'text-for-400' : 'text-against-400'
                )}
              >
                {bestArgument.upvotes}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClashPage() {
  const params = useParams<{ id: string }>()
  const debateId = params.id

  const [data, setData] = useState<ClashResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${debateId}/clash`, { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 404 ? 'Debate not found' : 'Failed to load clash data')
      const json: ClashResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [debateId])

  useEffect(() => {
    void load()
  }, [load])

  function handleShare() {
    const url = window.location.href
    if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      navigator
        .share({ title: data?.debate.title ?? 'Debate Clash', url })
        .catch(() => null)
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => null)
    }
  }

  const debate = data?.debate
  const winner = data?.winner
  const poll = data?.poll

  const swayTotal = (debate?.blue_sway ?? 0) + (debate?.red_sway ?? 0)
  const forSwayPct = swayTotal > 0 ? Math.round(((debate?.blue_sway ?? 0) / swayTotal) * 100) : 50
  const againstSwayPct = 100 - forSwayPct

  const duration = formatDuration(debate?.started_at ?? null, debate?.ended_at ?? null)

  // Nav tabs for explore section
  const exploreTabs = [
    { href: `/debate/${debateId}/verdict`, label: 'Official Verdict', Icon: Gavel },
    { href: `/debate/${debateId}/analysis`, label: 'AI Analysis', Icon: Zap },
    { href: `/debate/${debateId}/performance`, label: 'Speaker Performance', Icon: Mic },
    { href: `/debate/${debateId}/highlights`, label: 'Highlights', Icon: Trophy },
    { href: `/debate/${debateId}/transcript`, label: 'Full Transcript', Icon: MessageSquare },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-20 pb-28 space-y-5">
        {/* Back link */}
        <Link
          href={`/debate/${debateId}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {loading && <ClashSkeleton />}

        {error && !loading && (
          <div className="rounded-2xl border border-against-500/30 bg-against-950/20 p-6 text-center space-y-3">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">
                  Clash Report
                </Badge>
                <Badge
                  variant={
                    debate?.status === 'ended'
                      ? 'default'
                      : debate?.status === 'live'
                      ? 'active'
                      : 'proposed'
                  }
                  size="sm"
                >
                  {debate?.status === 'ended'
                    ? 'Ended'
                    : debate?.status === 'live'
                    ? 'Live'
                    : 'Scheduled'}
                </Badge>
              </div>
              <h1 className="text-xl font-bold font-mono text-white leading-snug">
                {debate?.title ?? 'Untitled Debate'}
              </h1>
              {debate?.topic && (
                <Link
                  href={`/topic/${debate.topic.id}`}
                  className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors group"
                >
                  <ExternalLink className="h-3 w-3 group-hover:text-for-400 transition-colors" />
                  <span className="line-clamp-1">{debate.topic.statement}</span>
                </Link>
              )}
            </motion.div>

            {/* Winner banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className={cn(
                'relative rounded-2xl border p-5 text-center overflow-hidden',
                winner === 'for'
                  ? 'border-for-500/40 bg-for-950/50'
                  : winner === 'against'
                  ? 'border-against-500/40 bg-against-950/50'
                  : 'border-surface-400/40 bg-surface-200/40'
              )}
            >
              {/* Ambient glow */}
              <div
                className={cn(
                  'absolute inset-0 opacity-[0.07] blur-3xl pointer-events-none',
                  winner === 'for'
                    ? 'bg-for-500'
                    : winner === 'against'
                    ? 'bg-against-500'
                    : 'bg-surface-400'
                )}
              />

              <div className="relative z-10">
                <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-3">
                  Community Verdict
                </p>

                {winner === null ? (
                  <p className="text-sm font-mono text-surface-500">
                    {debate?.status === 'ended' ? 'No votes cast yet' : 'Debate in progress'}
                  </p>
                ) : winner === 'tie' ? (
                  <div className="flex flex-col items-center gap-2">
                    <Scale className="h-10 w-10 text-surface-400" />
                    <p className="text-2xl font-black font-mono text-white">Tie</p>
                    <p className="text-xs font-mono text-surface-500">
                      The community couldn&apos;t separate the sides
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        'h-14 w-14 rounded-full flex items-center justify-center mx-auto',
                        winner === 'for'
                          ? 'bg-for-500/20 border border-for-500/40'
                          : 'bg-against-500/20 border border-against-500/40'
                      )}
                    >
                      {winner === 'for' ? (
                        <ThumbsUp className="h-7 w-7 text-for-400" />
                      ) : (
                        <ThumbsDown className="h-7 w-7 text-against-400" />
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-3xl font-black font-mono',
                        winner === 'for' ? 'text-for-400' : 'text-against-400'
                      )}
                    >
                      {winner === 'for' ? 'FOR' : 'AGAINST'}
                    </p>
                    <p className="text-xs font-mono text-surface-500">
                      {winner === 'for'
                        ? 'The FOR side carried this debate'
                        : 'The AGAINST side made the stronger case'}
                    </p>
                  </div>
                )}

                {/* Poll bar */}
                {poll && poll.total > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-for-400 tabular-nums w-8 text-right">
                        {poll.for_pct}%
                      </span>
                      <div className="flex-1 h-2 bg-surface-300/40 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-for-500 rounded-l-full transition-all"
                          style={{ width: `${poll.for_pct}%` }}
                        />
                        {poll.tie_pct > 0 && (
                          <div
                            className="h-full bg-surface-400"
                            style={{ width: `${poll.tie_pct}%` }}
                          />
                        )}
                        <div className="h-full bg-against-500 rounded-r-full flex-1" />
                      </div>
                      <span className="text-[10px] font-mono text-against-400 tabular-nums w-8">
                        {poll.against_pct}%
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-surface-600 text-center">
                      {poll.total} audience vote{poll.total !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Sway breakdown */}
            {swayTotal > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4 space-y-2.5"
              >
                <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
                  Audience Sway
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-for-400 tabular-nums w-10 text-right">
                    {forSwayPct}%
                  </span>
                  <div className="flex-1 h-3 bg-surface-300/40 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-for-500 rounded-l-full transition-all"
                      style={{ width: `${forSwayPct}%` }}
                    />
                    <div className="h-full bg-against-500 flex-1 rounded-r-full" />
                  </div>
                  <span className="text-xs font-mono text-against-400 tabular-nums w-10">
                    {againstSwayPct}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-surface-600">
                  <span>Moved FOR</span>
                  <span>Moved AGAINST</span>
                </div>
              </motion.div>
            )}

            {/* Speaker cards */}
            <div className="grid grid-cols-2 gap-3">
              <SpeakerCard
                speaker={data.for_side}
                side="for"
                isWinner={winner === 'for'}
                bestArgument={data.top_for}
              />
              <SpeakerCard
                speaker={data.against_side}
                side="against"
                isWinner={winner === 'against'}
                bestArgument={data.top_against}
              />
            </div>

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                {
                  icon: Users,
                  label: 'Viewers',
                  value: (debate?.viewer_count ?? 0).toLocaleString(),
                },
                { icon: Clock, label: 'Duration', value: duration },
                {
                  icon: MessageSquare,
                  label: 'Arguments',
                  value: String(data.stats.total_arguments),
                },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-3 text-center"
                >
                  <Icon className="h-3.5 w-3.5 text-surface-500 mx-auto mb-1.5" />
                  <p className="text-base font-bold font-mono text-white">{value}</p>
                  <p className="text-[10px] font-mono text-surface-600">{label}</p>
                </div>
              ))}
            </motion.div>

            {/* Share button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300/70 transition-colors text-sm font-mono font-semibold text-white"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.span
                      key="copied"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2 text-emerald"
                    >
                      <Check className="h-4 w-4" />
                      Link copied
                    </motion.span>
                  ) : (
                    <motion.span
                      key="share"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share this clash
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>

            {/* Explore more */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-surface-300/40 bg-surface-200/30 overflow-hidden"
            >
              <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 px-4 pt-4 pb-2">
                Explore this debate
              </p>
              <div className="divide-y divide-surface-300/30">
                {exploreTabs.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-300/30 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-surface-500" />
                    <span className="text-sm font-mono text-surface-400 hover:text-white transition-colors flex-1">
                      {label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-surface-600" />
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Topic link */}
            {debate?.topic && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <Link
                  href={`/topic/${debate.topic.id}`}
                  className="flex items-center justify-between rounded-xl border border-surface-300/40 bg-surface-200/30 px-4 py-3 hover:bg-surface-300/30 transition-colors group"
                >
                  <div className="min-w-0 mr-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-0.5">
                      Topic
                    </p>
                    <p className="text-sm font-mono text-white line-clamp-1">
                      {debate.topic.statement}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono text-for-400">
                        {Math.round(debate.topic.blue_pct ?? 50)}%
                      </p>
                      <p className="text-[10px] font-mono text-surface-600">FOR</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                  </div>
                </Link>
              </motion.div>
            )}

            {/* Meta info */}
            <p className="text-[10px] font-mono text-surface-700 text-center">
              {debate?.status === 'ended' && debate.ended_at
                ? `Concluded ${formatDate(debate.ended_at)}`
                : debate?.status === 'live'
                ? 'Live now'
                : ''}
            </p>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
