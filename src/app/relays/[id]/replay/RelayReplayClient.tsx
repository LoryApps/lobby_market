'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  GitMerge,
  Play,
  RotateCcw,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { RelayLeg } from '@/app/api/relays/route'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  relayId: string
  side: 'for' | 'against'
  status: 'open' | 'in_progress' | 'complete' | 'voted'
  maxLegs: number
  voteCompelling: number
  voteNotCompelling: number
  relayCreatedAt: string
  relayCompletedAt: string | null
  topicId: string | null
  topicStatement: string | null
  topicCategory: string | null
  legs: RelayLeg[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 1) return 'moments later'
  if (totalMin < 60) return `${totalMin}m later`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h < 24) return m > 0 ? `${h}h ${m}m later` : `${h}h later`
  const d = Math.floor(h / 24)
  if (d === 1) return '1 day later'
  return `${d} days later`
}

function roleBadge(role: string): { label: string; color: string } | null {
  switch (role) {
    case 'elder': return { label: 'Elder', color: 'text-gold' }
    case 'troll_catcher': return { label: 'Troll Catcher', color: 'text-emerald' }
    case 'debator': return { label: 'Debator', color: 'text-for-400' }
    default: return null
  }
}

// ─── Stage: -1 = intro, 0..legs.length-1 = legs, legs.length = end ─────────

export function RelayReplayClient({
  relayId,
  side,
  status,
  maxLegs,
  voteCompelling,
  voteNotCompelling,
  relayCreatedAt,
  relayCompletedAt,
  topicStatement,
  topicCategory,
  legs,
}: Props) {
  const [stage, setStage] = useState(-1)

  const isFor = side === 'for'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideBorder = isFor ? 'border-for-500/40' : 'border-against-500/40'
  const sideBg = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideText = isFor ? 'text-for-400' : 'text-against-400'
  const sideBar = isFor ? 'bg-for-500' : 'bg-against-500'

  const totalVotes = voteCompelling + voteNotCompelling
  const compellingPct = totalVotes > 0 ? Math.round((voteCompelling / totalVotes) * 100) : 0

  const canGoBack = stage > -1
  const canGoForward = stage < legs.length

  const handleNext = useCallback(() => {
    if (canGoForward) setStage((s) => s + 1)
  }, [canGoForward])

  const handleBack = useCallback(() => {
    if (canGoBack) setStage((s) => s - 1)
  }, [canGoBack])

  const handleReset = useCallback(() => setStage(-1), [])

  // Progress: 0..legs.length maps to 0..100%
  const progressPct =
    stage < 0
      ? 0
      : stage >= legs.length
        ? 100
        : Math.round(((stage) / legs.length) * 100)

  const currentLeg = stage >= 0 && stage < legs.length ? legs[stage] : null

  // Timing: gap from previous leg (or relay start for leg 0)
  function legElapsed(legIndex: number): string {
    const current = legs[legIndex]
    if (!current) return ''
    const prevTime =
      legIndex === 0
        ? new Date(relayCreatedAt).getTime()
        : new Date(legs[legIndex - 1].created_at).getTime()
    const currTime = new Date(current.created_at).getTime()
    return formatElapsed(currTime - prevTime)
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28 md:pb-12 flex flex-col gap-6">

        {/* Back to relay */}
        <div className="flex items-center justify-between">
          <Link
            href={`/relays/${relayId}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to relay
          </Link>

          {stage > -1 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </button>
          )}
        </div>

        {/* Progress bar */}
        {stage > -1 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
              <span className="uppercase tracking-widest">
                {stage >= legs.length ? 'Complete' : `Leg ${stage + 1} of ${legs.length}`}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', sideBar)}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>

            {/* Leg dots */}
            <div className="flex gap-1.5 pt-0.5">
              {legs.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-0.5 rounded-full transition-all duration-300',
                    i < stage
                      ? sideBar
                      : i === stage
                        ? cn(sideBar, 'opacity-60')
                        : 'bg-surface-300',
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main content area */}
        <AnimatePresence mode="wait">

          {/* ── Intro screen ── */}
          {stage === -1 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              {/* Header badge */}
              <div className="flex items-center gap-2">
                <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold', sideBorder, sideBg, sideText)}>
                  <GitMerge className="h-3.5 w-3.5" />
                  {sideLabel} RELAY
                </div>
                {topicCategory && (
                  <span className="text-[11px] font-mono text-surface-500 border border-surface-300/40 rounded px-2 py-0.5">
                    {topicCategory}
                  </span>
                )}
              </div>

              {/* Topic statement */}
              {topicStatement && (
                <div className={cn('rounded-2xl border p-5', sideBorder, sideBg)}>
                  <p className="text-white font-mono text-lg font-semibold leading-snug">
                    {topicStatement}
                  </p>
                </div>
              )}

              {/* Meta */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-surface-500">Chain length</span>
                  <span className="text-sm font-mono text-white font-bold">
                    {legs.length} / {maxLegs} legs
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-surface-500">Status</span>
                  <span className={cn('text-xs font-mono font-bold',
                    status === 'complete' || status === 'voted' ? 'text-emerald' : 'text-gold'
                  )}>
                    {status === 'voted' ? 'voted' : status}
                  </span>
                </div>
                {(status === 'complete' || status === 'voted') && totalVotes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-surface-500">Community verdict</span>
                    <span className={cn('text-xs font-mono font-bold', compellingPct >= 50 ? 'text-emerald' : 'text-against-400')}>
                      {compellingPct}% compelling
                    </span>
                  </div>
                )}
                {relayCompletedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-surface-500">Completed</span>
                    <span className="text-xs font-mono text-surface-400">
                      {new Date(relayCompletedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {legs.length === 0 ? (
                <p className="text-center text-sm font-mono text-surface-500 py-8">
                  This relay has no legs yet.
                </p>
              ) : (
                <button
                  onClick={handleNext}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-mono font-bold text-white text-sm transition-all active:scale-95',
                    isFor ? 'bg-for-600 hover:bg-for-500' : 'bg-against-600 hover:bg-against-500',
                  )}
                >
                  <Play className="h-4 w-4 fill-current" />
                  Watch replay ({legs.length} legs)
                </button>
              )}
            </motion.div>
          )}

          {/* ── Leg screen ── */}
          {stage >= 0 && stage < legs.length && currentLeg && (
            <motion.div
              key={`leg-${stage}`}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col gap-4"
            >
              {/* Timing badge */}
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-mono px-2.5 py-1 rounded-lg border', sideBorder, sideBg, sideText)}>
                  Leg {currentLeg.leg_number}
                </span>
                {stage > 0 && (
                  <span className="text-xs font-mono text-surface-500">
                    · {legElapsed(stage)}
                  </span>
                )}
                {stage === 0 && (
                  <span className="text-xs font-mono text-surface-500">
                    · opening argument
                  </span>
                )}
              </div>

              {/* Leg card */}
              <div className={cn('rounded-2xl border p-5 space-y-4', sideBorder, sideBg)}>
                {/* Author */}
                {currentLeg.author && (
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={currentLeg.author.avatar_url}
                      username={currentLeg.author.username}
                      size={36}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/profile/${currentLeg.author.username}`}
                        className="text-sm font-mono font-semibold text-white hover:underline truncate block"
                      >
                        {currentLeg.author.display_name ?? currentLeg.author.username}
                      </Link>
                      {roleBadge(currentLeg.author.role) && (
                        <span className={cn('text-[10px] font-mono', roleBadge(currentLeg.author.role)!.color)}>
                          {roleBadge(currentLeg.author.role)!.label}
                        </span>
                      )}
                    </div>
                    {/* Stars */}
                    {currentLeg.upvote_count > 0 && (
                      <div className="ml-auto flex items-center gap-1 text-gold">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span className="text-xs font-mono font-bold">{currentLeg.upvote_count}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                <p className="text-white font-mono text-base leading-relaxed">
                  {currentLeg.content}
                </p>

                {/* Timestamp */}
                <p className="text-[10px] font-mono text-surface-500">
                  {new Date(currentLeg.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Previous legs (collapsed preview) */}
              {stage > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Chain so far</p>
                  {legs.slice(0, stage).map((prev) => (
                    <div
                      key={prev.id}
                      className="rounded-xl border border-surface-300/40 bg-surface-100/50 p-3"
                    >
                      <p className="text-[11px] font-mono text-surface-400 line-clamp-2">
                        <span className={cn('font-bold mr-1.5', sideText)}>#{prev.leg_number}</span>
                        {prev.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── End screen ── */}
          {stage === legs.length && (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-5"
            >
              {/* Chain complete header */}
              <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-5 text-center space-y-2">
                <div className="text-2xl">⛓️</div>
                <h2 className="font-mono font-bold text-white text-lg">Chain complete</h2>
                <p className="text-sm font-mono text-surface-400">
                  {legs.length} argument{legs.length !== 1 ? 's' : ''} built the{' '}
                  <span className={cn('font-bold', sideText)}>{sideLabel}</span> case
                </p>
              </div>

              {/* Vote summary */}
              {totalVotes > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                    Community verdict
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-emerald flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-emerald">Compelling</span>
                          <span className="text-xs font-mono font-bold text-white">{voteCompelling}</span>
                        </div>
                        <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald transition-all"
                            style={{ width: `${compellingPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-against-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-against-400">Not compelling</span>
                          <span className="text-xs font-mono font-bold text-white">{voteNotCompelling}</span>
                        </div>
                        <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-against-500 transition-all"
                            style={{ width: `${100 - compellingPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top leg */}
              {legs.length > 0 && (
                <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 space-y-2">
                  <p className="text-[10px] font-mono text-gold uppercase tracking-widest">
                    Most starred leg
                  </p>
                  {(() => {
                    const top = [...legs].sort((a, b) => b.upvote_count - a.upvote_count)[0]
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-mono font-bold', sideText)}>#{top.leg_number}</span>
                          {top.upvote_count > 0 && (
                            <div className="flex items-center gap-0.5 text-gold">
                              <Star className="h-3 w-3 fill-current" />
                              <span className="text-xs font-mono">{top.upvote_count}</span>
                            </div>
                          )}
                          {top.author && (
                            <span className="text-xs font-mono text-surface-400">
                              by {top.author.display_name ?? top.author.username}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-mono text-surface-300 line-clamp-3">{top.content}</p>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/relays/${relayId}/transcript`}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-white transition-colors"
                >
                  Full transcript
                </Link>
                <Link
                  href={`/relays/${relayId}/scorecard`}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-white transition-colors"
                >
                  Scorecard
                </Link>
              </div>

              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Watch again
              </button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Navigation buttons */}
        {stage >= 0 && stage < legs.length && (
          <div className="flex gap-3 mt-auto pt-4">
            <button
              onClick={handleBack}
              disabled={!canGoBack || stage === 0}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 rounded-xl border font-mono text-sm transition-all',
                canGoBack && stage > 0
                  ? 'border-surface-300 text-white hover:bg-surface-200'
                  : 'border-surface-300/30 text-surface-600 cursor-not-allowed',
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={handleNext}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-mono text-sm font-bold text-white transition-all active:scale-95',
                isFor ? 'bg-for-600 hover:bg-for-500' : 'bg-against-600 hover:bg-against-500',
              )}
            >
              {stage < legs.length - 1 ? (
                <>Next leg <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>See results <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        )}

        {/* Back nav on intro */}
        {stage === -1 && legs.length > 0 && (
          <div className="flex gap-3 mt-auto pt-2">
            <Link
              href={`/relays/${relayId}`}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-surface-300 font-mono text-sm text-surface-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              View relay
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
