'use client'

/**
 * TrendingTicker
 *
 * A compact auto-scrolling marquee strip beneath the TopBar that surfaces
 * the 12 hottest active/voting topics in real-time.
 *
 * Each chip shows:
 *   • A coloured status dot (active = blue, voting = purple)
 *   • Truncated topic statement (max 60 chars)
 *   • FOR % in green and AGAINST % in red
 *
 * The marquee is implemented with a pure-CSS infinite scroll animation so it
 * works without any JS animation library overhead. The list is duplicated so
 * the loop is seamless. Refreshes every 3 minutes.
 *
 * Only visible on md+ screens (mobile has limited vertical space).
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Zap, Scale } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TickerTopic } from '@/app/api/trending-ticker/route'

// ─── Category accent colors ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-against-400',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

// ─── Single chip ──────────────────────────────────────────────────────────────

function TickerChip({ topic }: { topic: TickerTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'
  const isVoting = topic.status === 'voting'

  // Truncate statement for the ticker
  const label =
    topic.statement.length > 58
      ? topic.statement.slice(0, 57) + '…'
      : topic.statement

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'flex-shrink-0 flex items-center gap-2 px-3 py-1',
        'rounded-full border transition-colors',
        'bg-surface-200/60 border-surface-300/60',
        'hover:bg-surface-200 hover:border-surface-400',
        'group'
      )}
      tabIndex={-1} // ticker chips are decorative; full keyboard access via feed
    >
      {/* Status dot */}
      <span
        className={cn(
          'flex-shrink-0 h-1.5 w-1.5 rounded-full',
          isVoting ? 'bg-purple animate-pulse' : 'bg-for-500'
        )}
        aria-hidden="true"
      />

      {/* Icon */}
      {isVoting ? (
        <Scale className="flex-shrink-0 h-3 w-3 text-purple" aria-hidden="true" />
      ) : (
        <Zap className="flex-shrink-0 h-3 w-3 text-for-400" aria-hidden="true" />
      )}

      {/* Statement */}
      <span className="text-[11px] font-mono text-surface-700 group-hover:text-white whitespace-nowrap transition-colors">
        {label}
      </span>

      {/* Category */}
      {topic.category && (
        <span className={cn('text-[10px] font-mono hidden lg:inline', catColor)}>
          {topic.category}
        </span>
      )}

      {/* Vote split */}
      <span className="flex items-center gap-1 text-[10px] font-mono ml-0.5">
        <span className="text-for-400">{forPct}%</span>
        <span className="text-surface-500">/</span>
        <span className="text-against-400">{againstPct}%</span>
      </span>

      {/* Vote count */}
      {topic.total_votes > 0 && (
        <span className="text-[10px] font-mono text-surface-500 hidden xl:inline">
          {topic.total_votes >= 1000
            ? `${(topic.total_votes / 1000).toFixed(1)}k`
            : topic.total_votes}{' '}
          votes
        </span>
      )}
    </Link>
  )
}

// ─── Divider between chips ─────────────────────────────────────────────────────

function Divider() {
  return (
    <span className="flex-shrink-0 text-surface-500 text-xs font-mono px-1" aria-hidden="true">
      ·
    </span>
  )
}

// ─── Main ticker ───────────────────────────────────────────────────────────────

export function TrendingTicker() {
  const [topics, setTopics] = useState<TickerTopic[]>([])
  const [loaded, setLoaded] = useState(false)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  // Fetch on mount + refresh every 3 minutes
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/trending-ticker')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { topics: TickerTopic[] }
        if (!cancelled && data.topics.length > 0) {
          setTopics(data.topics)
          setLoaded(true)
        }
      } catch {
        // best-effort — ticker is decorative
      }
    }

    load()
    const interval = setInterval(load, 3 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Don't render until we have data
  if (!loaded || topics.length === 0) return null

  // Duplicate list so the marquee loops seamlessly
  const doubled = [...topics, ...topics]

  // Calculate animation duration: ~50px per item, 40 items = 2000px, at 60px/s ≈ 33s
  // Use a fixed reasonable duration scaled by item count
  const durationSeconds = Math.max(20, topics.length * 4.5)

  return (
    <div
      className="hidden md:block h-8 bg-surface-50/80 border-b border-surface-300/60 overflow-hidden"
      aria-label="Trending topics ticker"
      aria-live="off" // decorative — don't announce to screen readers
    >
      <div className="flex items-center h-full gap-2 px-3">
        {/* Label */}
        <div className="flex-shrink-0 flex items-center gap-1.5 pr-2 border-r border-surface-400/40 mr-1">
          <TrendingUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-mono font-bold text-for-400 uppercase tracking-widest whitespace-nowrap">
            Live
          </span>
        </div>

        {/* Scrolling track */}
        <div
          className="flex-1 overflow-hidden relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex items-center gap-1.5 whitespace-nowrap"
            style={{
              animation: `ticker-scroll ${durationSeconds}s linear infinite`,
              animationPlayState: paused ? 'paused' : 'running',
              willChange: 'transform',
            }}
          >
            {doubled.map((topic, i) => (
              <span key={`${topic.id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <Divider />}
                <TickerChip topic={topic} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
