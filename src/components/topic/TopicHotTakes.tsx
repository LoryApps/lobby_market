'use client'

/**
 * TopicHotTakes
 *
 * Shows the most recent vote reasons ("hot takes") for a single topic.
 * Voters can attach a short reason (≤140 chars) when casting their vote;
 * this component surfaces those reasons as social proof below the vote area.
 *
 * Hidden when the topic has zero hot takes.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { HotTake } from '@/app/api/hot-takes/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against'

interface TopicHotTakesProps {
  topicId: string
  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

// ─── Single take card ─────────────────────────────────────────────────────────

function TakeCard({ take }: { take: HotTake }) {
  const isFor = take.side === 'blue'
  const Icon = isFor ? ThumbsUp : ThumbsDown

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border p-3.5 space-y-2.5 transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/35'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/35',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        {take.voter ? (
          <Link
            href={`/profile/${take.voter.username}`}
            className="flex-shrink-0"
          >
            <Avatar
              src={take.voter.avatar_url}
              fallback={take.voter.display_name || take.voter.username}
              size="xs"
            />
          </Link>
        ) : (
          <div className="h-6 w-6 rounded-full bg-surface-300 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {take.voter ? (
            <Link
              href={`/profile/${take.voter.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {take.voter.display_name || take.voter.username}
            </Link>
          ) : (
            <span className="text-xs font-semibold text-surface-500">
              Anonymous
            </span>
          )}
          <span className="text-surface-600 text-[10px]">·</span>
          <span className="text-[11px] text-surface-500 flex-shrink-0">
            {relativeTime(take.created_at)}
          </span>
        </div>

        {/* Stance pill */}
        <div
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold flex-shrink-0',
            isFor
              ? 'bg-for-500/15 text-for-400'
              : 'bg-against-500/15 text-against-400',
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {isFor ? 'FOR' : 'AGAINST'}
        </div>
      </div>

      {/* Reason text */}
      <p className="text-sm font-mono text-surface-200 leading-relaxed pl-0.5">
        &ldquo;{take.reason}&rdquo;
      </p>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicHotTakes({ topicId, className }: TopicHotTakesProps) {
  const [takes, setTakes] = useState<HotTake[]>([])
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [loading, setLoading] = useState(true)
  const [fetched, setFetched] = useState(false)

  const load = useCallback(
    async (side: SideFilter) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          topic_id: topicId,
          limit: '8',
          side: side === 'all' ? 'all' : side,
        })
        const res = await fetch(`/api/hot-takes?${params}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        setTakes((data.takes as HotTake[]) ?? [])
      } catch {
        // best-effort
      } finally {
        setLoading(false)
        setFetched(true)
      }
    },
    [topicId],
  )

  useEffect(() => {
    load(sideFilter)
  }, [load, sideFilter])

  // Don't mount at all until we know there are hot takes
  if (fetched && takes.length === 0 && sideFilter === 'all') return null

  return (
    <div className={cn('mt-6', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-against-400" />
          <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
            Community Hot Takes
          </span>
        </div>
        <Link
          href={`/hot-takes`}
          className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          See all →
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-3">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'for', label: 'FOR' },
            { id: 'against', label: 'AGAINST' },
          ] as { id: SideFilter; label: string }[]
        ).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSideFilter(opt.id)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
              sideFilter === opt.id
                ? opt.id === 'for'
                  ? 'bg-for-500/20 border-for-500/40 text-for-400'
                  : opt.id === 'against'
                    ? 'bg-against-500/20 border-against-500/40 text-against-400'
                    : 'bg-surface-300 border-surface-400 text-white'
                : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-200/40 border border-surface-300/40 animate-pulse"
              />
            ))}
          </motion.div>
        ) : takes.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-8 text-center"
          >
            <p className="text-sm font-mono text-surface-500">
              No hot takes yet for this filter.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={`takes-${sideFilter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {takes.map((take) => (
              <TakeCard key={take.id} take={take} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
