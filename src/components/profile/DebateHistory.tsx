'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Mic,
  Mic2,
  Users,
  Clock,
  Calendar,
  Zap,
  Scale,
  Gavel,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateHistoryEntry {
  debateId: string
  title: string
  topicStatement: string | null
  topicCategory: string | null
  type: 'quick' | 'grand' | 'tribunal'
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  side: 'blue' | 'red' | null
  isSpeaker: boolean
  scheduledAt: string
  endedAt: string | null
  blueSway: number
  redSway: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  quick: '15m',
  grand: '45m',
  tribunal: '60m',
}

const TYPE_ICON: Record<string, typeof Zap> = {
  quick: Zap,
  grand: Scale,
  tribunal: Gavel,
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getOutcome(
  entry: DebateHistoryEntry
): 'win' | 'loss' | 'draw' | 'ongoing' | 'pending' {
  if (entry.status === 'scheduled') return 'pending'
  if (entry.status === 'cancelled') return 'pending'
  if (entry.status === 'live') return 'ongoing'
  // ended
  if (!entry.isSpeaker || !entry.side) return 'ongoing'
  const diff = entry.blueSway - entry.redSway
  if (Math.abs(diff) < 2) return 'draw'
  if (entry.side === 'blue') return diff > 0 ? 'win' : 'loss'
  return diff < 0 ? 'win' : 'loss'
}

function OutcomePill({ outcome }: { outcome: ReturnType<typeof getOutcome> }) {
  const styles = {
    win: 'bg-for-500/15 text-for-400 border-for-500/30',
    loss: 'bg-against-500/15 text-against-400 border-against-500/30',
    draw: 'bg-surface-300/30 text-surface-500 border-surface-400/30',
    ongoing: 'bg-purple/15 text-purple border-purple/30',
    pending: 'bg-surface-200/50 text-surface-500 border-surface-300/50',
  }
  const labels = {
    win: 'Won',
    loss: 'Lost',
    draw: 'Draw',
    ongoing: 'Live',
    pending: 'Upcoming',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
        styles[outcome]
      )}
    >
      {labels[outcome]}
    </span>
  )
}

function RolePill({
  side,
  isSpeaker,
}: {
  side: 'blue' | 'red' | null
  isSpeaker: boolean
}) {
  if (!isSpeaker) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-200/50 text-surface-500 border border-surface-300/50">
        <Users className="h-2.5 w-2.5" />
        Audience
      </span>
    )
  }
  if (side === 'blue') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-for-500/15 text-for-400 border border-for-500/30">
        <Mic className="h-2.5 w-2.5" />
        For
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-against-500/15 text-against-400 border border-against-500/30">
      <Mic2 className="h-2.5 w-2.5" />
      Against
    </span>
  )
}

// ─── Sway bar ─────────────────────────────────────────────────────────────────

function SwayBar({ blue, red }: { blue: number; red: number }) {
  const total = blue + red
  if (total === 0) return null
  const bluePct = Math.round((blue / total) * 100)
  const redPct = 100 - bluePct
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right flex-shrink-0">
        {bluePct}%
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden flex">
        <div
          className="h-full bg-for-500 rounded-l-full transition-all"
          style={{ width: `${bluePct}%` }}
        />
        <div
          className="h-full bg-against-500 rounded-r-full transition-all"
          style={{ width: `${redPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 flex-shrink-0">
        {redPct}%
      </span>
    </div>
  )
}

// ─── Single debate card ───────────────────────────────────────────────────────

function DebateCard({
  entry,
  index,
}: {
  entry: DebateHistoryEntry
  index: number
}) {
  const TypeIcon = TYPE_ICON[entry.type] ?? Zap
  const outcome = getOutcome(entry)
  const catColor =
    entry.topicCategory ? (CATEGORY_COLOR[entry.topicCategory] ?? 'text-surface-500') : 'text-surface-500'
  const isEnded = entry.status === 'ended'
  const isLive = entry.status === 'live'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link
        href={`/debate/${entry.debateId}`}
        className={cn(
          'block rounded-2xl border bg-surface-100 p-4 transition-colors',
          'hover:border-surface-400',
          isLive
            ? 'border-purple/40 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
            : 'border-surface-300'
        )}
      >
        {/* Top row: type icon + title + outcome */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
              isLive
                ? 'bg-purple/15 border-purple/30'
                : 'bg-surface-200 border-surface-300'
            )}
          >
            <TypeIcon
              className={cn(
                'h-4 w-4',
                isLive ? 'text-purple' : 'text-surface-500'
              )}
              aria-hidden="true"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {TYPE_LABEL[entry.type]} {entry.type}
              </span>
              {entry.topicCategory && (
                <span className={cn('text-[10px] font-mono font-semibold', catColor)}>
                  {entry.topicCategory}
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {entry.title}
            </p>

            {entry.topicStatement && (
              <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1">
                {entry.topicStatement}
              </p>
            )}
          </div>

          {/* Pills */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <OutcomePill outcome={outcome} />
            <RolePill side={entry.side} isSpeaker={entry.isSpeaker} />
          </div>
        </div>

        {/* Sway bar (only for ended debates with speaker) */}
        {isEnded && entry.isSpeaker && (entry.blueSway + entry.redSway > 0) && (
          <SwayBar blue={entry.blueSway} red={entry.redSway} />
        )}

        {/* Footer: date / time */}
        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-surface-300/50">
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-purple">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple animate-pulse" />
              Live now
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatDate(entry.scheduledAt)}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatTime(entry.scheduledAt)}
              </span>
            </>
          )}
          {isEnded && entry.isSpeaker && (
            <span className="ml-auto text-[10px] font-mono text-surface-500">
              Sway: {entry.blueSway}F · {entry.redSway}A
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DebateHistoryProps {
  debates: DebateHistoryEntry[]
  username: string
  isOwner: boolean
  className?: string
}

export function DebateHistory({
  debates,
  username,
  isOwner,
  className,
}: DebateHistoryProps) {
  if (debates.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-surface-300 bg-surface-100 p-10 text-center',
          className
        )}
        role="status"
      >
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-4">
          <Mic className="h-6 w-6 text-surface-500" aria-hidden="true" />
        </div>
        <p className="font-mono text-sm font-semibold text-white mb-1">
          No debates yet
        </p>
        <p className="text-xs text-surface-500 max-w-xs mx-auto">
          {isOwner
            ? 'Join a debate to start building your record. Your wins, losses, and audience appearances will appear here.'
            : `@${username} hasn't participated in any debates yet.`}
        </p>
        {isOwner && (
          <Link
            href="/debate"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple/80 border border-purple/50 text-white text-xs font-mono font-semibold hover:bg-purple transition-colors"
          >
            <Mic className="h-3.5 w-3.5" />
            Browse Debates
          </Link>
        )}
      </div>
    )
  }

  // Split into live + upcoming vs completed
  const live = debates.filter((d) => d.status === 'live')
  const upcoming = debates.filter((d) => d.status === 'scheduled')
  const ended = debates.filter((d) => d.status === 'ended' || d.status === 'cancelled')

  // Stats for speakers
  const speakerDebates = ended.filter((d) => d.isSpeaker)
  const wins = speakerDebates.filter((d) => getOutcome(d) === 'win').length
  const losses = speakerDebates.filter((d) => getOutcome(d) === 'loss').length
  const draws = speakerDebates.filter((d) => getOutcome(d) === 'draw').length

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats strip (only if they've spoken in at least one debate) */}
      {speakerDebates.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Debates', value: speakerDebates.length, accent: '' },
            { label: 'Wins', value: wins, accent: 'text-for-400' },
            { label: 'Losses', value: losses, accent: 'text-against-400' },
            { label: 'Draws', value: draws, accent: 'text-surface-500' },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center"
            >
              <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">
                {label}
              </div>
              <div
                className={cn(
                  'font-mono text-xl font-bold',
                  accent || 'text-white'
                )}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live */}
      {live.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono font-semibold text-purple uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple animate-pulse" />
            Live
          </h3>
          <div className="space-y-2">
            {live.map((d, i) => (
              <DebateCard key={d.debateId} entry={d} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
            Upcoming
          </h3>
          <div className="space-y-2">
            {upcoming.map((d, i) => (
              <DebateCard key={d.debateId} entry={d} index={live.length + i} />
            ))}
          </div>
        </section>
      )}

      {/* Ended */}
      {ended.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
            History
          </h3>
          <div className="space-y-2">
            {ended.map((d, i) => (
              <DebateCard
                key={d.debateId}
                entry={d}
                index={live.length + upcoming.length + i}
              />
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[10px] font-mono text-surface-500">
        {debates.length} debate{debates.length !== 1 ? 's' : ''} shown · most recent first
      </p>
    </div>
  )
}
