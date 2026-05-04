'use client'

/**
 * ActiveSeasonBanner
 *
 * A slim, dismissible bar shown beneath the TopBar during an active season.
 * Fetches season data client-side; renders nothing when there is no active season
 * or when the user has dismissed it this session.
 *
 * Intended for high-traffic pages: trending, leaderboard, discover, etc.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { MeSeasonData } from '@/app/api/me/season/route'

const DISMISS_KEY = 'lm_season_banner_dismissed'

function getDismissed(seasonId: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === seasonId
  } catch {
    return false
  }
}

function setDismissed(seasonId: string) {
  try {
    localStorage.setItem(DISMISS_KEY, seasonId)
  } catch {
    // localStorage may be unavailable
  }
}

interface ActiveSeasonBannerProps {
  className?: string
}

export function ActiveSeasonBanner({ className }: ActiveSeasonBannerProps) {
  const [data, setData] = useState<MeSeasonData | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetch('/api/me/season')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: MeSeasonData | null) => {
        if (!json?.season) return
        // Don't show if dismissed for this session/season
        if (getDismissed(json.season.id)) return
        setData(json)
        setVisible(true)
      })
      .catch(() => {})
  }, [])

  function dismiss() {
    if (data?.season) setDismissed(data.season.id)
    setVisible(false)
  }

  if (!data?.season) return null

  const { season, myEntry } = data
  const daysLeft = Math.ceil(data.secondsLeft / 86400)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="season-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className={cn('overflow-hidden', className)}
        >
          <div
            className="relative flex items-center justify-between gap-3 px-4 py-2 text-xs font-mono border-b"
            style={{
              backgroundColor: `${season.theme_color}10`,
              borderColor: `${season.theme_color}30`,
            }}
          >
            {/* Left: icon + text */}
            <Link
              href="/season"
              className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-90 transition-opacity"
              aria-label={`View ${season.name} leaderboard`}
            >
              <Crown
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: season.theme_color }}
                aria-hidden
              />
              <span className="text-white font-semibold truncate">{season.name}</span>
              <span className="text-surface-400 hidden sm:inline truncate">
                — {daysLeft > 0 ? `${daysLeft}d remaining` : 'ends today'}
              </span>
            </Link>

            {/* Centre: user rank / CTA */}
            <Link
              href="/season"
              className="hidden md:flex items-center gap-1.5 flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              {myEntry && myEntry.total_pts > 0 ? (
                <>
                  <Zap className="h-3 w-3 text-gold" aria-hidden />
                  <span className="text-gold font-semibold">
                    Rank #{myEntry.rank} · {myEntry.total_pts.toLocaleString()} pts
                  </span>
                </>
              ) : (
                <span
                  className="font-semibold"
                  style={{ color: season.theme_color }}
                >
                  Start earning Season Points →
                </span>
              )}
            </Link>

            {/* Right: dismiss */}
            <button
              onClick={dismiss}
              aria-label="Dismiss season banner"
              className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
