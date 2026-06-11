'use client'

/**
 * /debate/[id]/replay — Debate Replay Player
 *
 * Cinematic message-by-message replay of a completed debate.
 * Messages appear one at a time on a timeline, with an animated sway
 * gauge that updates after each argument lands.
 *
 * Controls: Play / Pause · Speed (0.5× / 1× / 2× / 5×) · Scrub timeline
 *
 * Distinct from:
 *   /debate/[id]/transcript  — static scrollable text log
 *   /debate/[id]/highlights  — curated top moments
 *   /debate/[id]/analysis    — AI post-match breakdown
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TranscriptResponse, TranscriptMessage } from '@/app/api/debates/[id]/transcript/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedLabel(startIso: string, msgIso: string): string {
  const diffMs = new Date(msgIso).getTime() - new Date(startIso).getTime()
  if (diffMs < 0) return '0:00'
  const totalSecs = Math.floor(diffMs / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Simulated sway: each argument message nudges the sway by a small random amount
// based on its upvotes and side, so the gauge animates meaningfully.
function computeSwaySnapshots(
  messages: TranscriptMessage[],
  initialBlueSway: number,
): number[] {
  const snapshots: number[] = [initialBlueSway]
  let currentPct = initialBlueSway

  for (const msg of messages) {
    if (msg.is_argument && (msg.side === 'blue' || msg.side === 'red')) {
      const impact = 0.3 + (msg.upvotes ?? 0) * 0.15
      const capped = Math.min(impact, 3.5)
      if (msg.side === 'blue') {
        currentPct = Math.min(currentPct + capped, 80)
      } else {
        currentPct = Math.max(currentPct - capped, 20)
      }
    }
    snapshots.push(currentPct)
  }

  return snapshots
}

// ─── Sway Bar ─────────────────────────────────────────────────────────────────

function SwayBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
      <div className="relative h-3 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
          animate={{ width: `${bluePct}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>
    </div>
  )
}

// ─── Message Card ─────────────────────────────────────────────────────────────

function MessageCard({
  msg,
  startIso,
}: {
  msg: TranscriptMessage
  startIso: string
}) {
  const isFor = msg.side === 'blue'
  const isAgainst = msg.side === 'red'

  const elapsed = elapsedLabel(startIso, msg.created_at)

  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn(
        'flex gap-3 px-4 py-3 rounded-2xl border',
        isFor
          ? 'bg-for-900/20 border-for-700/30'
          : isAgainst
            ? 'bg-against-900/20 border-against-700/30'
            : 'bg-surface-200/60 border-surface-300/60',
        msg.is_argument && 'ring-1',
        msg.is_argument && isFor && 'ring-for-500/40',
        msg.is_argument && isAgainst && 'ring-against-500/40',
      )}
    >
      <Avatar
        src={msg.author?.avatar_url ?? null}
        fallback={msg.author?.display_name ?? msg.author?.username ?? '?'}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${msg.author?.username ?? ''}`}
            className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
          >
            {msg.author?.display_name ?? msg.author?.username ?? 'Unknown'}
          </Link>
          {msg.is_argument && (
            <Badge
              variant={isFor ? 'for' : isAgainst ? 'against' : 'neutral'}
              size="sm"
            >
              {isFor ? 'FOR' : isAgainst ? 'AGAINST' : 'ARG'}
            </Badge>
          )}
          <span className="text-[10px] font-mono text-surface-500 ml-auto">
            +{elapsed}
          </span>
        </div>
        <p className="text-sm text-surface-100 leading-relaxed">{msg.content}</p>
        {msg.upvotes > 0 && (
          <p className="text-[10px] font-mono text-surface-500">
            +{msg.upvotes} upvotes
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Speed Selector ───────────────────────────────────────────────────────────

const SPEEDS = [0.5, 1, 2, 5] as const
type Speed = (typeof SPEEDS)[number]

// Base ms delay between messages at 1× speed
const BASE_DELAY_MS = 2200

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  debateId: string
  debateTitle: string
}

export function ReplayClient({ debateId, debateTitle }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TranscriptResponse | null>(null)

  // Replay state
  const [visibleCount, setVisibleCount] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [ended, setEnded] = useState(false)
  const [swaySnapshots, setSwaySnapshots] = useState<number[]>([])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Fetch transcript
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${debateId}/transcript`)
      if (!res.ok) throw new Error('Failed to load')
      const json: TranscriptResponse = await res.json()
      setData(json)

      // Compute sway over transcript (start at 50/50)
      const snapshots = computeSwaySnapshots(json.messages, 50)
      setSwaySnapshots(snapshots)
    } catch {
      setError('Could not load the debate transcript.')
    } finally {
      setLoading(false)
    }
  }, [debateId])

  useEffect(() => { load() }, [load])

  // Auto-scroll to latest message
  useEffect(() => {
    if (visibleCount > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [visibleCount])

  // Advance one message
  const advance = useCallback(() => {
    if (!data) return
    setVisibleCount((c) => {
      if (c >= data.messages.length) {
        setPlaying(false)
        setEnded(true)
        return c
      }
      return c + 1
    })
  }, [data])

  // Playback loop
  useEffect(() => {
    if (!playing || !data) return

    const delay = BASE_DELAY_MS / speed

    timerRef.current = setTimeout(() => {
      advance()
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, speed, visibleCount, data, advance])

  // Controls
  function handlePlayPause() {
    if (ended) {
      // Restart
      setVisibleCount(0)
      setEnded(false)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }

  function handleStepBack() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPlaying(false)
    setEnded(false)
    setVisibleCount((c) => Math.max(0, c - 1))
  }

  function handleStepForward() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!data) return
    const next = visibleCount + 1
    if (next > data.messages.length) {
      setEnded(true)
      return
    }
    setVisibleCount(next)
    if (next === data.messages.length) {
      setPlaying(false)
      setEnded(true)
    }
  }

  function handleRestart() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisibleCount(0)
    setEnded(false)
    setPlaying(false)
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPlaying(false)
    setEnded(false)
    const val = parseInt(e.target.value, 10)
    setVisibleCount(val)
    if (data && val === data.messages.length) setEnded(true)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const messages = data?.messages ?? []
  const totalMessages = messages.length
  const visibleMessages = messages.slice(0, visibleCount)
  const currentSway = swaySnapshots[visibleCount] ?? 50
  const startIso = data?.debate.scheduled_at ?? messages[0]?.created_at ?? new Date().toISOString()
  const progressPct = totalMessages > 0 ? (visibleCount / totalMessages) * 100 : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-6 w-2/3 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-lg" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-12 pb-24">
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load replay"
            description={error ?? 'Something went wrong loading this debate.'}
            action={{ label: 'Retry', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-36 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href={`/debate/${debateId}/recap`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to recap"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-purple" />
              Debate Replay
            </p>
            <h1 className="text-sm font-semibold text-white truncate">
              {debateTitle}
            </h1>
          </div>
          <Link
            href={`/debate/${debateId}/transcript`}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="View full transcript"
            title="Full transcript"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2 text-center">
            <p className="text-lg font-mono font-bold text-white">{totalMessages}</p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Messages</p>
          </div>
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2 text-center">
            <p className="text-lg font-mono font-bold text-for-400">{data.stats.for_count}</p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">FOR</p>
          </div>
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2 text-center">
            <p className="text-lg font-mono font-bold text-against-400">{data.stats.against_count}</p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">AGAINST</p>
          </div>
        </div>

        {/* ── Sway Meter ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Sway Gauge</p>
            <p className="text-[10px] font-mono text-surface-500">
              {visibleCount} / {totalMessages} messages
            </p>
          </div>
          <SwayBar bluePct={currentSway} />
        </div>

        {/* ── Message Stream ── */}
        <div className="space-y-2 min-h-[200px]">
          {visibleCount === 0 && !playing && (
            <div className="flex items-center justify-center py-16 text-surface-500">
              <div className="text-center space-y-2">
                <Play className="h-8 w-8 mx-auto text-surface-400" />
                <p className="text-sm font-mono">Press play to begin the replay</p>
                <p className="text-xs font-mono text-surface-600">
                  {totalMessages} messages · {data.stats.duration_minutes ?? '?'} min
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {visibleMessages.map((msg) => (
              <MessageCard key={msg.id} msg={msg} startIso={startIso} />
            ))}
          </AnimatePresence>

          {ended && visibleCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-200/50 border border-surface-300/40 p-4 text-center space-y-3"
            >
              <p className="text-sm font-mono font-semibold text-white">Debate complete</p>
              <p className="text-xs font-mono text-surface-500">
                Final sway: {Math.round(currentSway)}% FOR / {Math.round(100 - currentSway)}% AGAINST
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link href={`/debate/${debateId}/recap`}>
                  <button className="px-4 py-2 rounded-lg bg-for-600/20 border border-for-600/30 text-for-400 text-xs font-mono hover:bg-for-600/30 transition-colors">
                    View Full Recap
                  </button>
                </Link>
                <Link href={`/debate/${debateId}/analysis`}>
                  <button className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-300 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors">
                    AI Analysis
                  </button>
                </Link>
                <button
                  onClick={handleRestart}
                  className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-300 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
                >
                  Watch Again
                </button>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Sticky Player Controls ── */}
      <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
        <div className="w-full max-w-2xl bg-surface-100/95 backdrop-blur-md border border-surface-300/70 rounded-2xl p-3 shadow-2xl pointer-events-auto space-y-3">

          {/* Progress scrubber */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-surface-500 w-8 text-right tabular-nums">
              {visibleCount}
            </span>
            <input
              type="range"
              min={0}
              max={totalMessages}
              value={visibleCount}
              onChange={handleScrub}
              className="flex-1 h-1.5 rounded-full accent-for-500 cursor-pointer"
              aria-label="Scrub replay position"
            />
            <span className="text-[10px] font-mono text-surface-500 w-8 tabular-nums">
              {totalMessages}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-3">
            {/* Speed selector */}
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition-colors',
                    speed === s
                      ? 'bg-for-600/30 border border-for-600/40 text-for-400'
                      : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white',
                  )}
                  aria-label={`Set speed to ${s}×`}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* Playback buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleStepBack}
                disabled={visibleCount === 0}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Step back one message"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={handlePlayPause}
                className={cn(
                  'flex items-center justify-center h-10 w-10 rounded-xl border transition-colors font-semibold',
                  playing
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : ended
                      ? 'bg-gold/20 border-gold/40 text-gold hover:bg-gold/30'
                      : 'bg-for-600/30 border-for-600/40 text-for-400 hover:bg-for-600/40',
                )}
                aria-label={playing ? 'Pause replay' : ended ? 'Restart replay' : 'Play replay'}
              >
                {playing ? (
                  <Pause className="h-4 w-4" />
                ) : ended ? (
                  <SkipBack className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={handleStepForward}
                disabled={visibleCount >= totalMessages}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Step forward one message"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  if (timerRef.current) clearTimeout(timerRef.current)
                  setVisibleCount(totalMessages)
                  setPlaying(false)
                  setEnded(true)
                }}
                disabled={visibleCount >= totalMessages}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Skip to end"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            {/* Live indicator */}
            <div className="w-20 flex justify-end">
              {playing && (
                <motion.div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-against-600/20 border border-against-600/30"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-against-400" />
                  <span className="text-[10px] font-mono text-against-400 font-semibold">LIVE</span>
                </motion.div>
              )}
              {!playing && progressPct > 0 && !ended && (
                <span className="text-[10px] font-mono text-surface-500">
                  {Math.round(progressPct)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
