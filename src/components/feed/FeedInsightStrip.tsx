'use client'

/**
 * FeedInsightStrip
 *
 * A compact interstitial card injected into the snap-scroll feed every
 * INSIGHT_INTERVAL topics. Shows live platform-pulse numbers (active topics,
 * laws established, live debates) fetched once from /api/stats/quick and
 * /api/debates?status=live.
 *
 * Design intent: feels like a "breaking news ticker" moment between topic
 * cards, giving the feed a sense of a living, breathing platform.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Activity, ArrowRight, Gavel, Mic, Scale, Vote, Zap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InsightData {
  activeTopics: number
  votingTopics: number
  lawsEstablished: number
  liveDebates: number
  totalVotes: number
}

// ─── Singleton cache — shared across all mounted strips ────────────────────────

let _cached: InsightData | null = null
let _fetchedAt = 0
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

async function fetchInsights(): Promise<InsightData | null> {
  const now = Date.now()
  if (_cached && now - _fetchedAt < CACHE_TTL_MS) return _cached

  try {
    const [statsRes, debatesRes] = await Promise.all([
      fetch('/api/stats/quick', { cache: 'no-store' }),
      fetch('/api/debates?status=live&limit=10', { cache: 'no-store' }),
    ])

    if (!statsRes.ok) return null

    const stats = await statsRes.json()
    const debates = debatesRes.ok ? await debatesRes.json() : []
    const liveDebates = Array.isArray(debates) ? debates.length : 0

    _cached = {
      activeTopics: stats.activeTopics ?? 0,
      votingTopics: stats.votingTopics ?? 0,
      lawsEstablished: stats.lawsEstablished ?? 0,
      liveDebates,
      totalVotes: stats.totalVotes ?? 0,
    }
    _fetchedAt = now
    return _cached
  } catch {
    return null
  }
}

// ─── Pill stat component ──────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  color,
  href,
}: {
  icon: typeof Activity
  value: number
  label: string
  color: string
  href: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
        'border transition-colors group',
        color
      )}
    >
      <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span className="text-xs font-mono font-bold tabular-nums">
        <AnimatedNumber value={value} />
      </span>
      <span className="text-[10px] font-mono text-current opacity-70 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FeedInsightStripProps {
  /** Which "group" index (1-based) this strip sits after, used for staggered animation */
  groupIndex: number
}

export function FeedInsightStrip({ groupIndex }: FeedInsightStripProps) {
  const [data, setData] = useState<InsightData | null>(_cached)

  useEffect(() => {
    let cancelled = false
    fetchInsights().then((d) => {
      if (!cancelled && d) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Don't render if data is missing or all-zero (fresh/empty DB)
  if (!data) return null
  if (data.activeTopics === 0 && data.lawsEstablished === 0) return null

  return (
    <motion.div
      className="feed-card flex items-center justify-center px-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: groupIndex * 0.05, duration: 0.3, ease: 'easeOut' }}
      aria-label="Platform pulse"
    >
      <div
        className={cn(
          'w-full rounded-2xl px-4 py-3',
          'bg-surface-100/80 border border-surface-300/60',
          'backdrop-blur-sm'
        )}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            {/* Animated live dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-for-500" />
            </span>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-500">
              Platform Pulse
            </span>
          </div>
          <Link
            href="/stats"
            className="flex items-center gap-0.5 text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
            aria-label="View full platform stats"
          >
            All stats
            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Live platform statistics">
          <div role="listitem">
            <StatPill
              icon={Zap}
              value={data.activeTopics}
              label="active"
              href="/?status=active"
              color="bg-for-500/10 border-for-500/25 text-for-400 hover:bg-for-500/15 hover:border-for-500/40"
            />
          </div>
          <div role="listitem">
            <StatPill
              icon={Gavel}
              value={data.lawsEstablished}
              label="laws"
              href="/law"
              color="bg-gold/10 border-gold/25 text-gold hover:bg-gold/15 hover:border-gold/40"
            />
          </div>
          {data.votingTopics > 0 && (
            <div role="listitem">
              <StatPill
                icon={Vote}
                value={data.votingTopics}
                label="in senate"
                href="/senate"
                color="bg-purple/10 border-purple/25 text-purple hover:bg-purple/15 hover:border-purple/40"
              />
            </div>
          )}
          {data.liveDebates > 0 && (
            <div role="listitem">
              <StatPill
                icon={Mic}
                value={data.liveDebates}
                label="live debate"
                href="/debate"
                color="bg-against-500/10 border-against-500/25 text-against-400 hover:bg-against-500/15 hover:border-against-500/40"
              />
            </div>
          )}
          <div role="listitem">
            <StatPill
              icon={Scale}
              value={data.totalVotes}
              label="votes cast"
              href="/stats"
              color="bg-surface-300/30 border-surface-400/30 text-surface-500 hover:bg-surface-300/50 hover:border-surface-400/50"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
