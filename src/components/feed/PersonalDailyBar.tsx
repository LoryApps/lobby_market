'use client'

/**
 * PersonalDailyBar
 *
 * A slim, persistent personal-context strip shown at the top of the feed
 * for logged-in users. Shows your vote streak, today's vote usage, clout
 * balance, and a suggested unvoted topic from your favourite category.
 *
 * Distinct from:
 *   DailyQuorumNudge  — one-time dismissible reminder, no personal stats
 *   LivePlatformBanner — platform-wide stats only
 *   FeedInsightStrip  — interstitial between topic cards
 *   CivicAlertBanner  — urgent event alerts (law passed, debate starting)
 *
 * This is the only persistent personal stats strip in the feed.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Coins, Flame, Vote, Zap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TodayDigest } from '@/app/api/me/today/route'

// ─── Category colour map ──────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Cache — share across re-mounts within the same session ──────────────────

let _cache: TodayDigest | null = null
let _cacheTs = 0
const CACHE_TTL = 3 * 60_000 // 3 minutes

async function fetchDigest(): Promise<TodayDigest | null> {
  const now = Date.now()
  if (_cache && now - _cacheTs < CACHE_TTL) return _cache
  try {
    const res = await fetch('/api/me/today', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as TodayDigest
    _cache = data
    _cacheTs = now
    return data
  } catch {
    return null
  }
}

// ─── Streak flame rendering ───────────────────────────────────────────────────

function StreakPill({ streak }: { streak: number }) {
  if (streak === 0) return null
  const tier =
    streak >= 30 ? 'legendary' :
    streak >= 14 ? 'epic' :
    streak >= 7  ? 'rare' : 'common'

  const colors = {
    legendary: 'text-gold border-gold/40 bg-gold/10',
    epic:      'text-purple border-purple/40 bg-purple/10',
    rare:      'text-for-400 border-for-400/40 bg-for-400/10',
    common:    'text-surface-600 border-surface-400/40 bg-surface-300/30',
  }[tier]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold',
        colors,
      )}
      title={`${streak}-day vote streak`}
    >
      <Flame className="h-3 w-3" aria-hidden="true" />
      {streak}
    </span>
  )
}

// ─── Vote progress dots ───────────────────────────────────────────────────────

function VoteDots({ used, total }: { used: number; total: number }) {
  const cap = Math.min(total, 10)
  const filled = Math.min(used, cap)
  return (
    <span className="inline-flex items-center gap-0.5" title={`${used}/${total} votes today`} aria-label={`${used} of ${total} votes used today`}>
      {Array.from({ length: cap }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < filled ? 'bg-for-500' : 'bg-surface-400',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

// ─── Suggested topic pill ─────────────────────────────────────────────────────

function SuggestedTopicPill({ topic }: { topic: NonNullable<TodayDigest['suggestedTopic']> }) {
  const catColor = CAT_COLOR[topic.category ?? ''] ?? 'text-surface-600'
  const forPct = Math.round(topic.blue_pct)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'flex items-center gap-1.5 min-w-0 group',
        'text-[11px] font-mono text-surface-500 hover:text-white transition-colors',
      )}
      aria-label={`Suggested: ${topic.statement}`}
    >
      <Zap className="h-3 w-3 flex-shrink-0 text-for-400 group-hover:text-for-300 transition-colors" aria-hidden="true" />
      {topic.category && (
        <span className={cn('hidden sm:inline flex-shrink-0 font-semibold', catColor)}>
          {topic.category}
        </span>
      )}
      <span className="truncate max-w-[160px] sm:max-w-[240px] group-hover:text-white/90">
        {topic.statement}
      </span>
      <span className="flex-shrink-0 text-for-400 font-semibold">{forPct}%</span>
      <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PersonalDailyBar() {
  const [digest, setDigest] = useState<TodayDigest | null>(null)
  const [visible, setVisible] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    fetchDigest().then((d) => {
      if (!mountedRef.current) return
      if (d?.authenticated) {
        setDigest(d)
        setVisible(true)
      }
    })
    return () => {
      mountedRef.current = false
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && digest && (
        <motion.div
          key="personal-daily-bar"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2',
              'border-b border-surface-300/60 bg-surface-100/40',
              'text-xs font-mono',
            )}
            aria-label="Your civic status today"
          >
            {/* Streak */}
            {digest.streak > 0 && (
              <StreakPill streak={digest.streak} />
            )}

            {/* Vote progress */}
            <div className="flex items-center gap-1.5 flex-shrink-0" title={`${digest.votesToday}/${digest.dailyLimit} votes today`}>
              <Vote className="h-3 w-3 text-surface-500" aria-hidden="true" />
              <VoteDots used={digest.votesToday} total={digest.dailyLimit} />
            </div>

            {/* Clout */}
            <div
              className="hidden sm:flex items-center gap-1 flex-shrink-0 text-gold"
              title={`${digest.clout.toLocaleString()} Clout`}
            >
              <Coins className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold">{digest.clout >= 1000 ? `${(digest.clout / 1000).toFixed(1)}K` : digest.clout}</span>
            </div>

            {/* Divider */}
            {digest.suggestedTopic && (
              <span className="text-surface-400 select-none flex-shrink-0" aria-hidden="true">·</span>
            )}

            {/* Suggested topic */}
            {digest.suggestedTopic && (
              <div className="flex-1 min-w-0">
                <SuggestedTopicPill topic={digest.suggestedTopic} />
              </div>
            )}

            {/* Ballot shortcut on the right */}
            <Link
              href="/ballot"
              className={cn(
                'ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-1',
                'rounded-lg border border-for-500/30 bg-for-500/10',
                'text-for-400 hover:bg-for-500/20 hover:text-for-300 transition-colors',
                'text-[10px] font-mono font-semibold uppercase tracking-wide',
              )}
              aria-label="Open civic ballot"
            >
              Vote
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
