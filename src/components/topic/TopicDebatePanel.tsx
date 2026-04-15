'use client'

/**
 * TopicDebatePanel
 *
 * Shows upcoming, live, and recently ended debates for a topic.
 * Rendered on the topic detail "Details" tab, below the coalition
 * stances panel.
 *
 * Fetches from /api/topics/[id]/debates (lazy, on mount).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Mic,
  Plus,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicDebate, TopicDebatesResponse } from '@/app/api/topics/[id]/debates/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduled(iso: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Starting now'
  const m = Math.round(diff / 60_000)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  if (d === 1) return 'tomorrow'
  if (d < 7) return `in ${d}d`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatEnded(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just ended'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DebateCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/50">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-12 flex-shrink-0" />
    </div>
  )
}

interface DebateRowProps {
  debate: TopicDebate
}

function DebateRow({ debate }: DebateRowProps) {
  const isLive = debate.status === 'live'
  const isScheduled = debate.status === 'scheduled'
  const isEnded = debate.status === 'ended'

  const forParticipants = debate.participants.filter((p) => p.side === 'for')
  const againstParticipants = debate.participants.filter(
    (p) => p.side === 'against'
  )

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isLive
          ? 'bg-for-500/8 border-for-500/25 hover:bg-for-500/12'
          : isScheduled
          ? 'bg-surface-200/60 border-surface-300/60 hover:bg-surface-200'
          : 'bg-surface-200/40 border-surface-300/40 hover:bg-surface-200/60'
      )}
    >
      {/* Icon / live pulse */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
          isLive
            ? 'bg-for-500/15 border border-for-500/30'
            : isScheduled
            ? 'bg-surface-300/60 border border-surface-400/40'
            : 'bg-surface-300/40 border border-surface-400/30'
        )}
        aria-hidden="true"
      >
        {isLive ? (
          <Zap className="h-4 w-4 text-for-400" />
        ) : isScheduled ? (
          <Calendar className="h-4 w-4 text-surface-500" />
        ) : (
          <Mic className="h-4 w-4 text-surface-600" />
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            isEnded ? 'text-surface-600' : 'text-white'
          )}
        >
          {debate.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Type pill */}
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            {TYPE_LABEL[debate.type] ?? debate.type}
          </span>

          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-for-400 font-semibold">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-for-400 animate-pulse"
                aria-hidden="true"
              />
              LIVE
            </span>
          )}

          {isLive && debate.viewer_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {debate.viewer_count}
            </span>
          )}

          {isScheduled && debate.scheduled_at && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatScheduled(debate.scheduled_at)}
            </span>
          )}

          {isEnded && debate.scheduled_at && (
            <span className="text-[10px] font-mono text-surface-600">
              {formatEnded(debate.scheduled_at)}
            </span>
          )}
        </div>

        {/* Participant avatars — FOR vs AGAINST */}
        {debate.participants.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            {forParticipants.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1.5">
                  {forParticipants.slice(0, 3).map((p) => (
                    <Avatar
                      key={p.id}
                      src={p.avatar_url}
                      fallback={p.display_name || p.username || '?'}
                      size="xs"
                      className="ring-1 ring-for-600"
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-for-400">FOR</span>
              </div>
            )}

            {forParticipants.length > 0 && againstParticipants.length > 0 && (
              <span className="text-[10px] text-surface-600">vs</span>
            )}

            {againstParticipants.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1.5">
                  {againstParticipants.slice(0, 3).map((p) => (
                    <Avatar
                      key={p.id}
                      src={p.avatar_url}
                      fallback={p.display_name || p.username || '?'}
                      size="xs"
                      className="ring-1 ring-against-600"
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-against-400">
                  AGAINST
                </span>
              </div>
            )}

            {/* Sway result for ended debates */}
            {isEnded && (debate.blue_sway !== 50 || debate.red_sway !== 50) && (
              <div className="flex items-center gap-1 ml-auto">
                <Crown className="h-3 w-3 text-gold" aria-hidden="true" />
                <span className="text-[10px] font-mono text-gold">
                  {debate.blue_sway > debate.red_sway
                    ? `FOR ${debate.blue_sway}%`
                    : `AGAINST ${debate.red_sway}%`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        className="h-4 w-4 text-surface-600 group-hover:text-surface-500 flex-shrink-0 transition-colors"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface TopicDebatePanelProps {
  topicId: string
  className?: string
}

type LoadState = 'loading' | 'empty' | 'loaded' | 'error'

export function TopicDebatePanel({
  topicId,
  className,
}: TopicDebatePanelProps) {
  const [debates, setDebates] = useState<TopicDebate[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/topics/${topicId}/debates`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('fetch failed')
        const json: TopicDebatesResponse = await res.json()
        if (cancelled) return
        setDebates(json.debates)
        setLoadState(json.debates.length === 0 ? 'empty' : 'loaded')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [topicId])

  // Don't render at all on error
  if (loadState === 'error') return null

  return (
    <section className={cn('', className)} aria-label="Debates for this topic">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500">
            Debates
          </span>
          {loadState === 'loaded' && (
            <span className="text-[10px] font-mono text-surface-600">
              ({debates.length})
            </span>
          )}
        </div>

        <Link
          href={`/debate/create?topic=${topicId}`}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-600 hover:text-surface-500 transition-colors"
          aria-label="Schedule a debate for this topic"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Schedule
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {loadState === 'loading' && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <DebateCardSkeleton />
          </motion.div>
        )}

        {loadState === 'empty' && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-5 px-4 rounded-xl border border-dashed border-surface-400/40 bg-surface-200/30"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-300/60 border border-surface-400/30">
              <Mic className="h-4 w-4 text-surface-500" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-surface-600">
                No debates scheduled
              </p>
              <p className="text-xs text-surface-600 mt-0.5">
                Be the first to open the floor on this topic.
              </p>
            </div>
            <Link
              href={`/debate/create?topic=${topicId}`}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-medium',
                'bg-surface-300/60 border border-surface-400/40',
                'text-surface-500 hover:text-white hover:bg-surface-300',
                'transition-colors'
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Schedule a Debate
            </Link>
          </motion.div>
        )}

        {loadState === 'loaded' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {debates.map((debate) => (
              <DebateRow key={debate.id} debate={debate} />
            ))}

            {debates.length > 0 && (
              <Link
                href={`/debate?topic=${topicId}`}
                className="flex items-center justify-center gap-1.5 pt-1 text-xs font-mono text-surface-600 hover:text-surface-500 transition-colors"
                aria-label="View all debates"
              >
                View all debates
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
