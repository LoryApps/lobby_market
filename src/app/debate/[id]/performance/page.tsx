'use client'

/**
 * /debate/[id]/performance — Debate Performance Breakdown
 *
 * Per-participant performance card for any ended debate.
 * Shows each speaker's argument count, upvotes, sway contribution,
 * and best argument — alongside the overall verdict.
 *
 * Distinct from:
 *   /debate/[id]/recap       — overall debate summary
 *   /debate/[id]/transcript  — full chronological message log
 *
 * This is the ATHLETE STATS SHEET of the debate — who did what,
 * how well, and how they compare.
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
  Clock,
  Crown,
  ExternalLink,
  Flame,
  MessageSquare,
  Minus,
  RefreshCw,
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
import type { DebatePerformanceResponse, ParticipantPerf } from '@/app/api/debates/[id]/performance/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const secs = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
  highlight,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 p-3 rounded-xl border',
        highlight
          ? 'bg-gold/5 border-gold/20'
          : 'bg-surface-200/40 border-surface-300/50'
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn('h-3 w-3', highlight ? 'text-gold' : 'text-surface-500')} />}
        <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">{label}</span>
      </div>
      <span className={cn('text-xl font-bold font-mono tabular-nums', highlight ? 'text-gold' : 'text-white')}>
        {value}
      </span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Participant card ─────────────────────────────────────────────────────────

function ParticipantCard({
  perf,
  isWinner,
}: {
  perf: ParticipantPerf
  isWinner: boolean
}) {
  const isBlue = perf.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4',
        isBlue
          ? 'bg-for-950/60 border-for-800/40'
          : 'bg-against-950/60 border-against-800/40'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar
              username={perf.username}
              displayName={perf.display_name}
              avatarUrl={perf.avatar_url}
              size={44}
            />
            {isWinner && (
              <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-gold border border-surface-100">
                <Crown className="h-3 w-3 text-surface-50" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${perf.username}`}
                className="font-semibold text-white hover:underline text-sm"
              >
                {perf.display_name ?? perf.username}
              </Link>
              {isWinner && (
                <Badge variant="gold" size="sm">Winner</Badge>
              )}
            </div>
            <span className="text-xs font-mono text-surface-500">@{perf.username}</span>
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold',
            isBlue ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300'
          )}
        >
          {isBlue ? (
            <ThumbsUp className="h-3.5 w-3.5" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
          {isBlue ? 'FOR' : 'AGAINST'}
        </div>
      </div>

      {/* Sway bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-surface-500">Audience sway</span>
          <span className={cn('font-bold', isBlue ? 'text-for-300' : 'text-against-300')}>
            {perf.sway_pct}%
          </span>
        </div>
        <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isBlue ? 'bg-for-500' : 'bg-against-500')}
            style={{ width: `${perf.sway_pct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCell
          label="Arguments"
          value={perf.argument_count}
          icon={MessageSquare}
        />
        <StatCell
          label="Messages"
          value={perf.message_count}
          icon={Zap}
        />
        <StatCell
          label="Upvotes earned"
          value={perf.total_upvotes}
          icon={ThumbsUp}
          highlight={perf.total_upvotes > 0}
        />
        <StatCell
          label="Avg per argument"
          value={perf.avg_upvotes}
          sub="upvotes"
        />
      </div>

      {/* Best argument */}
      {perf.best_argument && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Award className={cn('h-3.5 w-3.5', isBlue ? 'text-for-400' : 'text-against-400')} />
            <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
              Best argument
            </span>
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {perf.best_argument.upvotes} upvote{perf.best_argument.upvotes !== 1 ? 's' : ''}
            </span>
          </div>
          <blockquote
            className={cn(
              'text-sm font-mono leading-relaxed p-3 rounded-xl border-l-2 bg-surface-200/40',
              isBlue ? 'border-for-500/60 text-for-100' : 'border-against-500/60 text-against-100'
            )}
          >
            &ldquo;{perf.best_argument.content.length > 220
              ? perf.best_argument.content.slice(0, 220) + '…'
              : perf.best_argument.content}&rdquo;
          </blockquote>
        </div>
      )}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PerfSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebatePerformancePage() {
  const params = useParams()
  const debateId = params.id as string

  const [data, setData] = useState<DebatePerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${debateId}/performance`)
      if (!res.ok) throw new Error('Failed to load performance data')
      const json = await res.json() as DebatePerformanceResponse
      setData(json)
    } catch {
      setError('Could not load performance data.')
    } finally {
      setLoading(false)
    }
  }, [debateId])

  useEffect(() => { load() }, [load])

  const debate = data?.debate
  const blue = data?.blue
  const red = data?.red

  // Determine winner by sway
  const blueWon = (debate?.blue_sway ?? 50) > (debate?.red_sway ?? 50)
  const isTie = debate?.blue_sway === debate?.red_sway

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: debate?.title ?? 'Debate Performance', url }).catch(() => null)
    } else {
      navigator.clipboard.writeText(url).catch(() => null)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/debate/${debateId}/recap`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to recap
          </Link>
          <div className="flex-1" />
          <button
            onClick={load}
            className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white">Performance Breakdown</h1>
          </div>
          {debate && (
            <p className="text-sm font-mono text-surface-500 leading-relaxed">
              {debate.topic_statement
                ? debate.topic_statement.length > 100
                  ? debate.topic_statement.slice(0, 100) + '…'
                  : debate.topic_statement
                : debate.title}
            </p>
          )}
        </div>

        {/* Overall verdict strip */}
        {debate && debate.status === 'ended' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Final verdict</span>
              <div className="flex items-center gap-4 text-xs font-mono">
                {debate.started_at && debate.ended_at && (
                  <span className="flex items-center gap-1 text-surface-600">
                    <Clock className="h-3 w-3" />
                    {formatDuration(debate.started_at, debate.ended_at)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-surface-600">
                  <Users className="h-3 w-3" />
                  {data.viewer_count.toLocaleString()} viewers
                </span>
              </div>
            </div>
            {/* Sway bar */}
            <div className="flex h-5 rounded-full overflow-hidden">
              <div
                className="h-full bg-for-500 flex items-center justify-center transition-all"
                style={{ width: `${debate.blue_sway}%` }}
              >
                {debate.blue_sway >= 20 && (
                  <span className="text-[10px] font-mono font-bold text-white">{debate.blue_sway}%</span>
                )}
              </div>
              <div
                className="h-full bg-against-500 flex items-center justify-center transition-all"
                style={{ width: `${debate.red_sway}%` }}
              >
                {debate.red_sway >= 20 && (
                  <span className="text-[10px] font-mono font-bold text-white">{debate.red_sway}%</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-surface-500">
              <span className="text-for-400">FOR</span>
              {isTie ? (
                <span className="flex items-center gap-1 text-surface-400">
                  <Minus className="h-3 w-3" />
                  Tied
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gold">
                  <Trophy className="h-3 w-3" />
                  {blueWon ? blue?.display_name ?? blue?.username ?? 'FOR side' : red?.display_name ?? red?.username ?? 'AGAINST side'} won
                </span>
              )}
              <span className="text-against-400">AGAINST</span>
            </div>

            {/* Platform stats row */}
            <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-surface-300">
              <div className="text-center">
                <div className="text-sm font-bold font-mono text-white">{data.total_messages}</div>
                <div className="text-[10px] font-mono text-surface-500">messages</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold font-mono text-white">{data.total_arguments}</div>
                <div className="text-[10px] font-mono text-surface-500">arguments</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold font-mono text-white">
                  {((blue?.total_upvotes ?? 0) + (red?.total_upvotes ?? 0))}
                </div>
                <div className="text-[10px] font-mono text-surface-500">total upvotes</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Content */}
        {loading && <PerfSkeleton />}

        {error && !loading && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <BarChart2 className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-sm font-mono text-surface-500">{error}</p>
            <button
              onClick={load}
              className="mt-4 inline-flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <div className="space-y-4">
              {(!blue && !red) && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                  <Users className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                  <p className="text-sm font-mono text-surface-500">No speaker data found for this debate.</p>
                </div>
              )}

              {blue && (
                <ParticipantCard
                  perf={blue}
                  isWinner={!isTie && blueWon}
                />
              )}

              {red && (
                <ParticipantCard
                  perf={red}
                  isWinner={!isTie && !blueWon}
                />
              )}

              {/* Comparative insight */}
              {blue && red && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-4 w-4 text-gold" />
                    <h2 className="text-sm font-semibold text-white">Head-to-head</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        label: 'Arguments',
                        blue: blue.argument_count,
                        red: red.argument_count,
                      },
                      {
                        label: 'Messages',
                        blue: blue.message_count,
                        red: red.message_count,
                      },
                      {
                        label: 'Upvotes',
                        blue: blue.total_upvotes,
                        red: red.total_upvotes,
                      },
                    ].map(({ label, blue: b, red: r }) => {
                      const total = b + r || 1
                      const bluePct = Math.round((b / total) * 100)
                      return (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
                            <span className="text-for-400">{b}</span>
                            <span>{label}</span>
                            <span className="text-against-400">{r}</span>
                          </div>
                          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                            <div
                              className="h-full bg-for-500 transition-all"
                              style={{ width: `${bluePct}%` }}
                            />
                            <div
                              className="h-full bg-against-500 transition-all"
                              style={{ width: `${100 - bluePct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Links */}
              <div className="grid grid-cols-3 gap-3">
                <Link
                  href={`/debate/${debateId}/recap`}
                  className="flex items-center justify-between p-4 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">Recap</p>
                    <p className="text-xs font-mono text-surface-500">Overview</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500" />
                </Link>
                <Link
                  href={`/debate/${debateId}/highlights`}
                  className="flex items-center justify-between p-4 rounded-xl border border-gold/30 bg-gold/5 hover:border-gold/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-gold">Highlights</p>
                    <p className="text-xs font-mono text-surface-500">Best moments</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gold/60" />
                </Link>
                <Link
                  href={`/debate/${debateId}/transcript`}
                  className="flex items-center justify-between p-4 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">Transcript</p>
                    <p className="text-xs font-mono text-surface-500">Full log</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-surface-500" />
                </Link>
              </div>
            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
