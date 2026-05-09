'use client'

/**
 * DebateCountdownBanner
 *
 * Shows a dismissible banner on the main feed when the logged-in user has
 * RSVPd to a debate starting within 2 hours. Includes a live countdown
 * timer and a direct "Join" link.
 *
 * Dismissed banners are remembered in localStorage for the duration of
 * the debate window so they don't reappear on page refresh.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Clock, Mic, Swords, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { UpcomingRsvpDebate } from '@/app/api/me/upcoming-rsvps/route'

// ─── Countdown hook ──────────────────────────────────────────────

function useCountdown(scheduledAt: string, status: string) {
  const [ms, setMs] = useState(() => {
    if (status === 'live') return 0
    return Math.max(0, new Date(scheduledAt).getTime() - Date.now())
  })

  useEffect(() => {
    if (status === 'live') {
      setMs(0)
      return
    }
    const tick = () =>
      setMs(Math.max(0, new Date(scheduledAt).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [scheduledAt, status])

  return ms
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

// ─── localStorage helpers ──────────────────────────────────────────────

const DISMISSED_KEY = 'lm_dismissed_debate_banners'

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function setDismissed(id: string) {
  try {
    const set = getDismissed()
    set.add(id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // ignore
  }
}

// ─── Debate type config ──────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford Debate',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
  quick: 'Quick Debate',
  grand: 'Grand Debate',
  tribunal: 'Tribunal',
}

const CATEGORY_COLOR: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-for-300',
  Philosophy: 'text-purple',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

// ─── Single debate card ──────────────────────────────────────────────

function DebateCard({
  debate,
  onDismiss,
}: {
  debate: UpcomingRsvpDebate
  onDismiss: (id: string) => void
}) {
  const ms = useCountdown(debate.scheduled_at, debate.status)
  const isLive = debate.status === 'live' || ms === 0
  const urgent = !isLive && ms < 10 * 60 * 1000 // under 10 minutes
  const catColor = CATEGORY_COLOR[debate.topic_category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative flex items-start gap-3 px-3 py-2.5 rounded-xl',
        'border backdrop-blur-sm transition-colors',
        isLive
          ? 'bg-against-600/15 border-against-500/40'
          : urgent
            ? 'bg-gold/10 border-gold/40'
            : 'bg-for-600/10 border-for-500/30'
      )}
    >
      {/* Left: icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg mt-0.5',
          isLive
            ? 'bg-against-600/20 text-against-400'
            : urgent
              ? 'bg-gold/20 text-gold'
              : 'bg-for-600/20 text-for-400'
        )}
      >
        {isLive ? (
          <Mic className="h-4 w-4" />
        ) : (
          <Swords className="h-4 w-4" />
        )}
      </div>

      {/* Centre: info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isLive ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-against-600/30 text-against-300 text-[10px] font-mono font-bold tracking-wider uppercase">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase',
                urgent ? 'bg-gold/20 text-gold' : 'bg-for-500/15 text-for-300'
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              {formatCountdown(ms)}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {TYPE_LABEL[debate.type] ?? debate.type}
          </span>
          {debate.topic_category && (
            <span className={cn('text-[10px] font-mono', catColor)}>
              {debate.topic_category}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs font-mono font-semibold text-white leading-snug line-clamp-1">
          {debate.title}
        </p>
        {debate.topic_statement && (
          <p className="text-[10px] font-mono text-surface-500 leading-snug line-clamp-1 mt-0.5">
            {debate.topic_statement}
          </p>
        )}
      </div>

      {/* Right: action */}
      <div className="flex items-center gap-2 flex-shrink-0 self-center">
        <Link
          href={`/debate/${debate.id}`}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
            isLive
              ? 'bg-against-600 hover:bg-against-500 text-white'
              : urgent
                ? 'bg-gold/90 hover:bg-gold text-surface-900'
                : 'bg-for-600 hover:bg-for-500 text-white'
          )}
        >
          {isLive ? 'Watch' : 'View'}
        </Link>
        <button
          onClick={() => onDismiss(debate.id)}
          aria-label="Dismiss reminder"
          className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-300/30 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main banner ──────────────────────────────────────────────

export function DebateCountdownBanner() {
  const [debates, setDebates] = useState<UpcomingRsvpDebate[]>([])
  const [dismissed, setDismissedState] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Load dismissed set from localStorage on mount
    setDismissedState(getDismissed())

    let mounted = true

    async function fetchUpcoming() {
      try {
        const res = await fetch('/api/me/upcoming-rsvps', { cache: 'no-store' })
        if (!res.ok || !mounted) return
        const { debates: data } = (await res.json()) as { debates: UpcomingRsvpDebate[] }
        if (mounted) {
          setDebates(data)
          setLoaded(true)
        }
      } catch {
        // non-fatal
        if (mounted) setLoaded(true)
      }
    }

    fetchUpcoming()

    // Refresh every 5 minutes to pick up new RSVPs or status changes
    const interval = setInterval(fetchUpcoming, 5 * 60 * 1000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  function handleDismiss(id: string) {
    setDismissed(id)
    setDismissedState((prev) => new Set([...prev, id]))
  }

  const visible = debates.filter((d) => !dismissed.has(d.id))

  if (!loaded || visible.length === 0) return null

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key="debate-countdown-banner"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        <div className="px-3 pt-2 pb-1">
          {/* Header row */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bell className="h-3 w-3 text-surface-500" aria-hidden="true" />
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
              Your upcoming debates
            </span>
            <div className="flex-1 h-px bg-surface-400/20" />
            <span className="text-[10px] font-mono text-surface-600">
              {visible.length}
            </span>
          </div>

          {/* Debate cards */}
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {visible.map((debate) => (
                <DebateCard
                  key={debate.id}
                  debate={debate}
                  onDismiss={handleDismiss}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
