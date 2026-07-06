'use client'

/**
 * /topic/[id]/replay — Debate Replay
 *
 * An interactive scrubber that lets you watch a civic debate unfold
 * from the very first vote to today. Drag the timeline to travel back
 * in time and see how the community's position evolved.
 *
 * Distinct from:
 *   /vote-trend     — static line chart of vote % over time
 *   /timeline       — chronological event list (no interactivity)
 *   /recap          — AI-generated static summary
 *
 * This is fully interactive: scrub left to go back, see which arguments
 * existed at that moment, and spot turning-point markers.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FastForward,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Rewind,
  ThumbsDown,
  ThumbsUp,
  Zap,
  Milestone,
  TrendingUp,
  Flame,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ReplayResponse, ReplayVotePoint, ReplayArgument, ReplayMilestone } from '@/app/api/topics/[id]/replay/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const AUTOPLAY_INTERVAL_MS = 800

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

// ─── Milestone icon ───────────────────────────────────────────────────────────

const MILESTONE_CONFIG: Record<ReplayMilestone['kind'], { icon: typeof Flame; color: string; label: string }> = {
  topic_created:    { icon: Zap,          color: 'text-for-400',     label: 'Created'       },
  first_argument:   { icon: MessageSquare, color: 'text-emerald',    label: 'First Argument' },
  turning_point:    { icon: TrendingUp,   color: 'text-gold',        label: 'Turning Point' },
  debate_started:   { icon: Milestone,    color: 'text-purple',      label: 'Debate'         },
  vote_spike:       { icon: Flame,        color: 'text-against-400', label: 'Vote Surge'     },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoteBar({ forPct, animate: shouldAnimate }: { forPct: number; animate?: boolean }) {
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline text-xs font-mono">
        <span className="text-for-400 font-bold">{Math.round(forPct)}% FOR</span>
        <span className="text-against-400 font-bold">AGAINST {Math.round(againstPct)}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
          initial={{ width: `${forPct}%` }}
          animate={{ width: `${forPct}%` }}
          transition={shouldAnimate ? { duration: 0.3, ease: 'easeOut' } : { duration: 0 }}
        />
      </div>
    </div>
  )
}

function ArgumentCard({ arg, isNew }: { arg: ReplayArgument; isNew?: boolean }) {
  const isFor = arg.side === 'blue'
  return (
    <motion.div
      key={arg.id}
      initial={isNew ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-xl border p-3 text-sm',
        isFor
          ? 'bg-for-600/8 border-for-600/20'
          : 'bg-against-500/8 border-against-500/20'
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Side indicator */}
        <div className={cn(
          'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5',
          isFor ? 'bg-for-600/20' : 'bg-against-500/20'
        )}>
          {isFor
            ? <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
            : <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {/* Author row */}
          <div className="flex items-center gap-1.5 mb-1">
            <Avatar
              src={arg.author_avatar}
              fallback={arg.author_name ?? '?'}
              size="xs"
            />
            <span className="text-[11px] text-surface-500 truncate">
              {arg.author_name ?? 'Anonymous'}
            </span>
            <span className="text-[10px] text-surface-600 flex-shrink-0">
              {relativeTime(arg.created_at)}
            </span>
            {arg.ai_grade && (
              <span className={cn(
                'ml-auto flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                arg.ai_grade === 'S' ? 'bg-gold/20 text-gold' :
                arg.ai_grade === 'A' ? 'bg-for-600/20 text-for-400' :
                arg.ai_grade === 'B' ? 'bg-emerald/10 text-emerald' :
                'bg-surface-300 text-surface-500'
              )}>
                {arg.ai_grade}
              </span>
            )}
          </div>

          {/* Content */}
          <p className="text-surface-700 text-xs leading-relaxed line-clamp-3">
            {arg.content}
          </p>

          {/* Upvotes */}
          <div className="flex items-center gap-1 mt-1.5">
            <ThumbsUp className="h-3 w-3 text-surface-600" />
            <span className="text-[11px] text-surface-600">{arg.upvotes}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ReplayClientProps {
  topicId: string
}

export function ReplayClient({ topicId }: ReplayClientProps) {
  const [data, setData] = useState<ReplayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load replay data
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/replay`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load replay data')
      const json = await res.json() as ReplayResponse
      setData(json)
      setFrameIndex(json.voteTrend.length - 1) // Start at the end (present)
    } catch {
      setError('Could not load the replay. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  // Autoplay
  useEffect(() => {
    if (!playing || !data) return
    playTimer.current = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1
        if (next >= data.voteTrend.length) {
          setPlaying(false)
          return prev
        }
        return next
      })
    }, AUTOPLAY_INTERVAL_MS)
    return () => { if (playTimer.current) clearInterval(playTimer.current) }
  }, [playing, data])

  // Derived state at current frame
  const currentPoint: ReplayVotePoint | null = data?.voteTrend[frameIndex] ?? null
  const currentDate = currentPoint?.date ?? null

  // Arguments visible at the current frame (created on or before the current date)
  const visibleArgs: ReplayArgument[] = data
    ? data.arguments.filter((a) => a.created_at.slice(0, 10) <= (currentDate ?? '9999-12-31'))
    : []

  // Milestones on or before current date
  const passedMilestones: ReplayMilestone[] = data
    ? data.milestones.filter((m) => m.date <= (currentDate ?? '9999-12-31'))
    : []

  // Is the current frame at the most recent date on the milestone list?
  const activeMilestone = data?.milestones.find((m) => m.date === currentDate)

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    setPlaying(false)
    setFrameIndex(Number(e.target.value))
  }

  function togglePlay() {
    if (!data) return
    if (playing) {
      setPlaying(false)
      return
    }
    // If at the end, rewind to start first
    if (frameIndex >= data.voteTrend.length - 1) {
      setFrameIndex(0)
    }
    setPlaying(true)
  }

  function stepBack() {
    setPlaying(false)
    setFrameIndex((f) => Math.max(0, f - 1))
  }

  function stepForward() {
    if (!data) return
    setPlaying(false)
    setFrameIndex((f) => Math.min(data.voteTrend.length - 1, f + 1))
  }

  function goToStart() {
    setPlaying(false)
    setFrameIndex(0)
  }

  function goToEnd() {
    if (!data) return
    setPlaying(false)
    setFrameIndex(data.voteTrend.length - 1)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">

        {/* Back + header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/topic/${topicId}`}
            className="flex-shrink-0 p-2 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">Debate Replay</h1>
            <p className="text-xs text-surface-500">
              Scrub through time to watch the debate unfold
            </p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* No votes state */}
        {!loading && !error && data && data.voteTrend.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-surface-500 text-sm">
              No vote history yet — check back after voting begins.
            </p>
          </div>
        )}

        {/* Main replay UI */}
        {!loading && !error && data && data.voteTrend.length > 0 && (
          <div className="space-y-5">

            {/* Topic statement */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-white font-semibold text-sm leading-snug mb-1">
                {data.topic.statement}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {data.topic.category && (
                  <Badge variant="proposed" size="sm">{data.topic.category}</Badge>
                )}
                <span className="text-[11px] text-surface-500 font-mono">
                  {(data.topic.total_votes ?? 0).toLocaleString()} total votes
                </span>
              </div>
            </div>

            {/* Current snapshot card */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
              {/* Date + vote count */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-0.5">
                    Viewing
                  </p>
                  <p className="text-base font-bold text-white">
                    {currentDate ? formatDate(currentDate) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-0.5">
                    Votes cast
                  </p>
                  <p className="text-base font-bold text-white">
                    {currentPoint ? currentPoint.totalVotes.toLocaleString() : '0'}
                  </p>
                </div>
              </div>

              {/* Vote bar */}
              {currentPoint && (
                <VoteBar forPct={currentPoint.forPct} animate />
              )}

              {/* Active milestone badge */}
              <AnimatePresence mode="wait">
                {activeMilestone && (() => {
                  const cfg = MILESTONE_CONFIG[activeMilestone.kind]
                  const Icon = cfg.icon
                  return (
                    <motion.div
                      key={activeMilestone.date + activeMilestone.kind}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-400/40"
                    >
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.color)} />
                      <span className={cn('text-xs font-semibold font-mono', cfg.color)}>
                        {activeMilestone.label}
                      </span>
                    </motion.div>
                  )
                })()}
              </AnimatePresence>
            </div>

            {/* Timeline scrubber */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-surface-500 font-mono">
                <span>
                  {data.voteTrend[0] ? formatDate(data.voteTrend[0].date) : '—'}
                </span>
                <span className="text-surface-400">
                  Day {frameIndex + 1} of {data.voteTrend.length}
                </span>
                <span>
                  {data.voteTrend[data.voteTrend.length - 1]
                    ? formatDate(data.voteTrend[data.voteTrend.length - 1].date)
                    : '—'}
                </span>
              </div>

              {/* Range input */}
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={data.voteTrend.length - 1}
                  value={frameIndex}
                  onChange={handleScrub}
                  aria-label="Debate timeline scrubber"
                  className={cn(
                    'w-full h-2 rounded-full appearance-none cursor-pointer',
                    'bg-surface-300',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
                    '[&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-for-500',
                    '[&::-webkit-slider-thumb]:shadow-md',
                    '[&::-webkit-slider-thumb]:cursor-pointer',
                    '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
                    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-for-500',
                    '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
                  )}
                />

                {/* Milestone dots on the scrubber track */}
                {data.milestones.map((m) => {
                  const milestoneFrameIdx = data.voteTrend.findIndex((p) => p.date === m.date)
                  if (milestoneFrameIdx < 0) return null
                  const pct = (milestoneFrameIdx / (data.voteTrend.length - 1)) * 100
                  const cfg = MILESTONE_CONFIG[m.kind]
                  return (
                    <div
                      key={`${m.date}-${m.kind}`}
                      title={m.label}
                      style={{ left: `${pct}%` }}
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full',
                        '-translate-x-1/2 pointer-events-none',
                        milestoneFrameIdx <= frameIndex ? cfg.color : 'bg-surface-400',
                        milestoneFrameIdx <= frameIndex ? 'opacity-100' : 'opacity-30'
                      )}
                    />
                  )
                })}
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={goToStart}
                  aria-label="Go to beginning"
                  className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <Rewind className="h-4 w-4" />
                </button>
                <button
                  onClick={stepBack}
                  disabled={frameIndex === 0}
                  aria-label="Previous day"
                  className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={togglePlay}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className={cn(
                    'p-3 rounded-xl font-medium transition-all',
                    playing
                      ? 'bg-against-500/20 border border-against-500/40 text-against-400 hover:bg-against-500/30'
                      : 'bg-for-600 text-white hover:bg-for-700 shadow-sm'
                  )}
                >
                  {playing
                    ? <Pause className="h-4 w-4" />
                    : <Play className="h-4 w-4" />
                  }
                </button>
                <button
                  onClick={stepForward}
                  disabled={frameIndex >= data.voteTrend.length - 1}
                  aria-label="Next day"
                  className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={goToEnd}
                  aria-label="Go to present"
                  className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <FastForward className="h-4 w-4" />
                </button>
              </div>

              {/* Speed hint */}
              {playing && (
                <p className="text-center text-[11px] text-surface-500 font-mono">
                  Advancing 1 day every {AUTOPLAY_INTERVAL_MS / 1000}s
                </p>
              )}
            </div>

            {/* Milestone log — milestones crossed so far */}
            {passedMilestones.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Key Moments
                </h3>
                <div className="space-y-2">
                  {passedMilestones.map((m) => {
                    const cfg = MILESTONE_CONFIG[m.kind]
                    const Icon = cfg.icon
                    return (
                      <div key={`${m.date}-${m.kind}`} className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                          'bg-surface-200 border border-surface-300'
                        )}>
                          <Icon className={cn('h-3 w-3', cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium">{m.label}</p>
                          <p className="text-[11px] text-surface-500 font-mono">{formatDate(m.date)}</p>
                        </div>
                        {m.date === currentDate && (
                          <span className="flex-shrink-0 text-[10px] font-mono font-bold text-gold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold/10 border border-gold/20">
                            NOW
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Arguments at this moment */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  Arguments at this moment
                </h3>
                <span className="text-xs text-surface-500 font-mono">
                  {visibleArgs.length} / {data.arguments.length}
                </span>
              </div>

              {visibleArgs.length === 0 ? (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center">
                  <MessageSquare className="h-8 w-8 text-surface-500 mx-auto mb-2" />
                  <p className="text-sm text-surface-500">No arguments yet at this point in time.</p>
                  <p className="text-xs text-surface-600 mt-1">Scrub forward to see arguments appear.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {visibleArgs.slice(0, 20).map((arg) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        isNew={arg.created_at.slice(0, 10) === currentDate}
                      />
                    ))}
                  </AnimatePresence>
                  {visibleArgs.length > 20 && (
                    <p className="text-center text-xs text-surface-500 font-mono">
                      +{visibleArgs.length - 20} more arguments
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex gap-3 pt-2">
              <Link
                href={`/topic/${topicId}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Topic
              </Link>
              <Link
                href={`/topic/${topicId}/vote-trend`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600/10 border border-for-600/30 text-sm text-for-400 hover:bg-for-600/20 transition-colors"
              >
                <TrendingUp className="h-4 w-4" />
                Vote Trend Chart
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
