'use client'

/**
 * LivePlatformBanner
 *
 * A slim, auto-refreshing strip below the feed filters showing the live
 * state of the Lobby: active debates, votes in the last hour, laws passed
 * this month, and a link to the latest established law.
 *
 * Refreshes every 90 seconds in the background. Fades in on mount.
 * Collapses gracefully if the API returns empty data (no active topics).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Gavel, Mic, Zap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { PlatformLiveStats } from '@/app/api/platform/live/route'

const REFRESH_INTERVAL_MS = 90_000

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US')
}

interface StatPillProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
  pulse?: boolean
  href?: string
}

function StatPill({ icon: Icon, label, value, color, pulse, href }: StatPillProps) {
  const inner = (
    <span
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium',
        'border border-surface-400/30 bg-surface-200/60 backdrop-blur-sm',
        'transition-colors duration-200',
        href && 'hover:bg-surface-300/60 hover:border-surface-400/60',
        color
      )}
    >
      <span className="relative flex items-center">
        <Icon className="h-2.5 w-2.5 flex-shrink-0" />
        {pulse && value > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        )}
      </span>
      <span className="text-surface-400 mr-0.5">{label}</span>
      <span className="text-white font-semibold">{fmt(value)}</span>
    </span>
  )

  if (href) {
    return <Link href={href} aria-label={`${label}: ${fmt(value)}`}>{inner}</Link>
  }
  return inner
}

export function LivePlatformBanner() {
  const [stats, setStats] = useState<PlatformLiveStats | null>(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/live', { cache: 'no-store' })
      if (!res.ok) return
      const data: PlatformLiveStats = await res.json()
      setStats(data)
      // Show banner as long as there's anything interesting to display
      setVisible(
        data.activeTopics > 0 ||
        data.liveDebates > 0 ||
        data.votesLastHour > 0 ||
        data.lawsThisMonth > 0
      )
    } catch {
      // Best-effort — don't surface errors for a non-critical widget
    }
  }, [])

  useEffect(() => {
    fetchStats()
    timerRef.current = setInterval(fetchStats, REFRESH_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchStats])

  return (
    <AnimatePresence>
      {visible && stats && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5',
              'overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
              'border-b border-surface-300/40'
            )}
            aria-label="Live platform statistics"
          >
            {/* Live indicator dot */}
            <span
              className="flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-against-400 animate-pulse"
              aria-hidden
            />
            <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider flex-shrink-0 mr-0.5">
              Live
            </span>

            <div className="h-3 w-px bg-surface-500/30 flex-shrink-0" aria-hidden />

            {/* Active debates */}
            {stats.activeTopics > 0 && (
              <StatPill
                icon={Activity}
                label="active"
                value={stats.activeTopics}
                color="text-for-400"
                href="/trending"
              />
            )}

            {/* Live debates */}
            {stats.liveDebates > 0 && (
              <StatPill
                icon={Mic}
                label="live debates"
                value={stats.liveDebates}
                color="text-against-400"
                pulse
                href="/debate"
              />
            )}

            {/* Votes last hour */}
            {stats.votesLastHour > 0 && (
              <StatPill
                icon={Zap}
                label="votes/hr"
                value={stats.votesLastHour}
                color="text-purple"
              />
            )}

            {/* Laws this month */}
            {stats.lawsThisMonth > 0 && (
              <StatPill
                icon={Gavel}
                label="laws this month"
                value={stats.lawsThisMonth}
                color="text-gold"
                href="/law"
              />
            )}

            {/* Latest law teaser */}
            {stats.latestLawStatement && (
              <>
                <div className="h-3 w-px bg-surface-500/30 flex-shrink-0 ml-0.5" aria-hidden />
                <Link
                  href="/law"
                  className="flex-shrink-0 text-[10px] font-mono text-surface-500 hover:text-gold transition-colors truncate max-w-[180px]"
                  aria-label="Latest law"
                >
                  <span className="text-gold mr-1">⚖</span>
                  {stats.latestLawStatement.slice(0, 60)}
                  {stats.latestLawStatement.length > 60 ? '…' : ''}
                </Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
