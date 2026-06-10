'use client'

/**
 * /debate/[id]/audience — The Audience Chamber
 *
 * What did the crowd think?
 *
 * Distinct from:
 *   /debate/[id]/performance   — per-speaker athlete stats
 *   /debate/[id]/highlights    — best arguments
 *   /debate/[id]/recap         — narrative summary
 *   /debate/[id]/transcript    — full chronological log
 *
 * This page focuses entirely on the AUDIENCE experience:
 *   • How many people showed up (RSVPs vs viewers)
 *   • Community "who argued better?" poll
 *   • How the crowd's sway shifted across the three debate checkpoints
 *   • The final impact on the underlying topic
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  ChevronRight,
  Crown,
  Eye,
  Minus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { DebateWinnerPoll } from '@/components/debate/DebateWinnerPoll'
import { cn } from '@/lib/utils/cn'
import type { AudienceResponse, AudienceSway } from '@/app/api/debates/[id]/audience/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TYPE_LABEL: Record<string, string> = {
  quick: '15m Quick',
  grand: '45m Grand',
  tribunal: '60m Tribunal',
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  label: string
  value: string | number
  icon: typeof Eye
  sub?: string
  accent?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4', accent ?? 'text-surface-500')} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-surface-500">{label}</span>
      </div>
      <div className="font-mono text-3xl font-bold text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="font-mono text-xs text-surface-500 mt-1">{sub}</div>}
    </motion.div>
  )
}

// ─── Sway chart ───────────────────────────────────────────────────────────────

function SwayBar({
  sway,
  index,
}: {
  sway: AudienceSway
  index: number
}) {
  const total = sway.for_votes + sway.against_votes
  const forPct = sway.for_pct
  const againstPct = 100 - forPct
  const hasData = total > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider">
          {sway.label}
        </span>
        <span className="font-mono text-[11px] text-surface-500">
          {total > 0 ? `${total.toLocaleString()} sway votes` : 'no data'}
        </span>
      </div>

      {hasData ? (
        <>
          {/* Bar */}
          <div className="relative h-3 rounded-full bg-surface-300 overflow-hidden mb-2">
            <motion.div
              className="absolute left-0 top-0 h-full bg-for-500 rounded-full"
              initial={{ width: '50%' }}
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 + 0.2 }}
            />
          </div>
          {/* Labels */}
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs text-for-400 font-semibold">
              FOR {forPct}%
            </span>
            <span className="font-mono text-xs text-against-400 font-semibold">
              {againstPct}% AGAINST
            </span>
          </div>
        </>
      ) : (
        <div className="h-3 rounded-full bg-surface-300/50 mb-2" />
      )}
    </motion.div>
  )
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function AudienceSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-16 w-full mb-3" />
        <Skeleton className="h-16 w-full mb-3" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200 p-4">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DebateAudiencePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AudienceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${id}/audience`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load audience data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const debate = data?.debate
  const statusEnded = debate?.status === 'ended'

  // Compute attendance conversion rate
  const viewerCount = debate?.viewer_count ?? 0
  const rsvpCount = data?.rsvp_count ?? 0
  const conversionPct =
    rsvpCount > 0 ? Math.min(Math.round((viewerCount / rsvpCount) * 100), 999) : null

  // Determine winner from poll
  const poll = data?.poll
  let pollWinner: 'blue' | 'red' | 'tie' | null = null
  if (poll && poll.total > 0) {
    if (poll.blue > poll.red && poll.blue > poll.tie) pollWinner = 'blue'
    else if (poll.red > poll.blue && poll.red > poll.tie) pollWinner = 'red'
    else pollWinner = 'tie'
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href={`/debate/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>

          {debate ? (
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-mono text-xs text-surface-500 uppercase tracking-wider">
                    {TYPE_LABEL[debate.type] ?? debate.type}
                  </span>
                  <span className="text-surface-600">·</span>
                  <Badge variant={statusEnded ? 'failed' : 'active'} className="text-[10px]">
                    {statusEnded ? 'Ended' : debate.status}
                  </Badge>
                  {debate.ended_at && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span className="font-mono text-xs text-surface-500">
                        {relativeTime(debate.ended_at)}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-xl font-bold text-white leading-tight">{debate.title}</h1>
                {debate.topic && (
                  <Link
                    href={`/topic/${debate.topic.id}`}
                    className="inline-flex items-center gap-1 mt-1.5 font-mono text-xs text-surface-500 hover:text-for-400 transition-colors"
                  >
                    <ChevronRight className="h-3 w-3" />
                    {debate.topic.statement.slice(0, 80)}
                    {debate.topic.statement.length > 80 ? '…' : ''}
                  </Link>
                )}
              </div>

              {/* Speaker faces */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {debate.blue_speaker && (
                  <div className="flex flex-col items-center gap-1">
                    <Avatar
                      src={debate.blue_speaker.avatar_url}
                      fallback={debate.blue_speaker.display_name || debate.blue_speaker.username}
                      size="sm"
                      className="ring-2 ring-for-600/50"
                    />
                    <span className="font-mono text-[9px] text-for-400 uppercase">FOR</span>
                  </div>
                )}
                {debate.red_speaker && (
                  <div className="flex flex-col items-center gap-1">
                    <Avatar
                      src={debate.red_speaker.avatar_url}
                      fallback={debate.red_speaker.display_name || debate.red_speaker.username}
                      size="sm"
                      className="ring-2 ring-against-600/50"
                    />
                    <span className="font-mono text-[9px] text-against-400 uppercase">AGAINST</span>
                  </div>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-full max-w-sm" />
            </div>
          ) : null}
        </div>

        {/* ── Error ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 p-4 rounded-xl bg-against-900/30 border border-against-700/40 text-against-300 text-sm font-mono flex items-center justify-between gap-3"
            >
              <span>{error}</span>
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <AudienceSkeleton />
        ) : data ? (
          <div className="space-y-6">

            {/* ── Audience stats ────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                label="Viewers"
                value={viewerCount}
                icon={Eye}
                sub="total spectators"
                accent="text-for-400"
              />
              <StatCard
                label="RSVPs"
                value={rsvpCount}
                icon={Calendar}
                sub={conversionPct !== null ? `${conversionPct}% showed up` : 'pre-registered'}
                accent="text-purple"
              />
              <StatCard
                label="Poll votes"
                value={poll?.total ?? 0}
                icon={Vote}
                sub="community verdicts"
                accent="text-gold"
              />
            </div>

            {/* ── Duration strip ────────────────────────────────────── */}
            {debate?.started_at && debate?.ended_at && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 px-5 py-3 rounded-xl bg-surface-100 border border-surface-300"
              >
                <div className="flex items-center gap-2 text-surface-500">
                  <BarChart2 className="h-4 w-4" />
                  <span className="font-mono text-xs uppercase tracking-wider">Duration</span>
                </div>
                <span className="font-mono text-sm font-semibold text-white">
                  {formatDuration(debate.started_at, debate.ended_at)}
                </span>
                <div className="flex-1" />
                {(debate.blue_sway > 0 || debate.red_sway > 0) && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-for-400">
                      +{Math.round(debate.blue_sway)}% FOR sway
                    </span>
                    <span className="font-mono text-xs text-against-400">
                      +{Math.round(debate.red_sway)}% AGAINST sway
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Community verdict ──────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-4 w-4 text-gold" />
                <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wide">
                  Community Verdict
                </h2>
              </div>
              <p className="font-mono text-xs text-surface-500 mb-5">
                Who argued more convincingly — independent of which side you agree with?
              </p>

              {pollWinner && poll && poll.total >= 3 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'mb-4 px-4 py-3 rounded-xl border font-mono text-sm font-bold flex items-center gap-2',
                    pollWinner === 'blue'
                      ? 'bg-for-900/40 border-for-700/40 text-for-300'
                      : pollWinner === 'red'
                      ? 'bg-against-900/40 border-against-700/40 text-against-300'
                      : 'bg-gold/10 border-gold/30 text-gold'
                  )}
                >
                  {pollWinner === 'blue' ? (
                    <ThumbsUp className="h-4 w-4" />
                  ) : pollWinner === 'red' ? (
                    <ThumbsDown className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  {pollWinner === 'blue'
                    ? `FOR side won — by ${poll.blue} to ${poll.red} votes`
                    : pollWinner === 'red'
                    ? `AGAINST side won — by ${poll.red} to ${poll.blue} votes`
                    : `The crowd called it a tie`}
                </motion.div>
              )}

              <DebateWinnerPoll
                debateId={id}
                blueName={
                  debate?.blue_speaker?.display_name || debate?.blue_speaker?.username || null
                }
                redName={
                  debate?.red_speaker?.display_name || debate?.red_speaker?.username || null
                }
              />
            </motion.div>

            {/* ── Audience sway checkpoints ───────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald" />
                <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wide">
                  Audience Sway
                </h2>
              </div>
              <p className="font-mono text-xs text-surface-500 mb-5">
                How the live audience leaned at each checkpoint in the debate.
              </p>

              {data.sway.every((s) => s.for_votes + s.against_votes === 0) ? (
                <div className="text-center py-8 text-surface-500 font-mono text-sm">
                  No sway votes recorded for this debate.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.sway.map((s, i) => (
                    <SwayBar key={s.checkpoint} sway={s} index={i} />
                  ))}
                </div>
              )}
            </motion.div>

            {/* ── Topic impact ────────────────────────────────────────── */}
            {debate?.topic && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Vote className="h-4 w-4 text-purple" />
                  <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wide">
                    Topic Standing
                  </h2>
                </div>
                <p className="font-mono text-xs text-surface-500 mb-4">
                  Current consensus on the underlying proposition.
                </p>

                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-xs text-for-400 font-semibold w-12 text-right">
                    {debate.topic.blue_pct}%
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-surface-300 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                      initial={{ width: '50%' }}
                      animate={{ width: `${debate.topic.blue_pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="font-mono text-xs text-against-400 font-semibold w-12">
                    {100 - debate.topic.blue_pct}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-surface-500">
                    {debate.topic.total_votes.toLocaleString()} total votes ·{' '}
                    {debate.topic.category ?? 'Uncategorized'}
                  </span>
                  <Link
                    href={`/topic/${debate.topic.id}`}
                    className="inline-flex items-center gap-1 font-mono text-xs text-for-400 hover:text-for-300 transition-colors"
                  >
                    View topic <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── Navigation row ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {[
                { href: `/debate/${id}/performance`, label: 'Performance', icon: BarChart2 },
                { href: `/debate/${id}/highlights`, label: 'Highlights', icon: Crown },
                { href: `/debate/${id}/recap`, label: 'Recap', icon: Users },
                { href: `/debate/${id}/transcript`, label: 'Transcript', icon: ChevronRight },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all font-mono text-xs text-surface-400 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>

          </div>
        ) : null}

      </main>

      <BottomNav />
    </div>
  )
}
