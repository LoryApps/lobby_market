'use client'

/**
 * LobbyRail — Desktop right-side live panel (xl+ only)
 *
 * Fixed to the right of the viewport, shows:
 *   1. Live battles — the most contested topics (vote split closest to 50/50)
 *   2. Latest laws — the 3–4 most recently established laws
 *   3. Live & upcoming debates
 *   4. A vote-activity pulse strip
 *
 * Designed to sit in the dead space to the right of the max-w-lg
 * snap-scroll feed cards. Only rendered on xl+ screens (≥1280px).
 * Auto-refreshes every 30 s via polling.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gavel,
  Mic,
  Scale,
  Zap,
  Clock,
  ChevronRight,
  Flame,
  RefreshCw,
} from 'lucide-react'
import { PulseDot } from '@/components/simulation/PulseDot'
import { cn } from '@/lib/utils/cn'
import type { LobbyRailData } from '@/app/api/lobby-rail/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function debateRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'live'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// Tension bar colour: green (high tension, close to 50/50) → muted (low)
function tensionColor(tension: number): string {
  if (tension >= 85) return 'bg-against-500'
  if (tension >= 65) return 'bg-gold'
  return 'bg-for-600'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  href,
  iconColor = 'text-surface-500',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  iconColor?: string
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconColor)} aria-hidden="true" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-500">
          {label}
        </span>
      </div>
      <Link
        href={href}
        className="text-[10px] font-mono text-surface-600 hover:text-surface-500 transition-colors flex items-center gap-0.5"
        aria-label={`View all ${label}`}
      >
        All
        <ChevronRight className="h-2.5 w-2.5" />
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LobbyRail() {
  const [data, setData] = useState<LobbyRailData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch_ = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch('/api/lobby-rail', { cache: 'no-store' })
      if (res.ok) {
        const json: LobbyRailData = await res.json()
        setData(json)
      }
    } catch {
      // silent — just keep previous data
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    const timer = setInterval(() => fetch_(), 30_000)
    return () => clearInterval(timer)
  }, [fetch_])

  // Don't render until we have data
  if (!data) return null

  const hasBattles = data.battles.length > 0
  const hasLaws = data.laws.length > 0
  const hasDebates = data.debates.length > 0

  return (
    <aside
      aria-label="Live lobby rail"
      className={cn(
        // Fixed to the right of the viewport on xl+ screens
        'fixed right-3 z-30',
        'top-[8.5rem] bottom-4', // below topbar + filter bar
        'w-56',
        // Only show on very wide screens — otherwise it overlaps the feed card
        'hidden 2xl:flex flex-col gap-3 overflow-y-auto',
        'scrollbar-hide',
      )}
    >
      {/* ── Pulse strip ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center justify-between',
          'rounded-xl border border-surface-300/50 bg-surface-100/80 backdrop-blur-sm',
          'px-3 py-2.5',
        )}
      >
        <div className="flex items-center gap-1.5">
          <PulseDot color="green" className="h-2 w-2 flex-shrink-0" />
          <span className="text-[10px] font-mono font-semibold text-emerald uppercase tracking-wider">
            Lobby Live
          </span>
        </div>
        <button
          type="button"
          onClick={() => fetch_(true)}
          className={cn(
            'flex items-center justify-center h-5 w-5 rounded',
            'text-surface-600 hover:text-surface-400 transition-colors',
          )}
          aria-label="Refresh lobby rail"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          'grid grid-cols-2 gap-1.5',
        )}
      >
        <div className="rounded-xl border border-surface-300/50 bg-surface-100/80 backdrop-blur-sm px-3 py-2 text-center">
          <p className="text-base font-mono font-bold text-for-400 leading-none">
            {data.hourlyVotes > 0 ? data.hourlyVotes.toLocaleString() : '—'}
          </p>
          <p className="text-[9px] font-mono text-surface-500 mt-0.5 leading-tight">
            votes/hr
          </p>
        </div>
        <div className="rounded-xl border border-surface-300/50 bg-surface-100/80 backdrop-blur-sm px-3 py-2 text-center">
          <p className="text-base font-mono font-bold text-gold leading-none">
            {data.lawsToday}
          </p>
          <p className="text-[9px] font-mono text-surface-500 mt-0.5 leading-tight">
            laws today
          </p>
        </div>
      </div>

      {/* ── Battles ─────────────────────────────────────────────────────── */}
      {hasBattles && (
        <div className="rounded-xl border border-surface-300/50 bg-surface-100/80 backdrop-blur-sm p-3">
          <SectionHeader
            icon={Scale}
            label="Battles"
            href="/split"
            iconColor="text-against-400"
          />
          <ul className="space-y-2" role="list">
            <AnimatePresence initial={false}>
              {data.battles.map((battle) => {
                const forPct = Math.round(battle.blue_pct ?? 50)
                const againstPct = 100 - forPct
                return (
                  <motion.li
                    key={battle.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link
                      href={`/topic/${battle.id}`}
                      className={cn(
                        'block rounded-lg p-2 -mx-1 px-2',
                        'hover:bg-surface-200/60 transition-colors',
                      )}
                    >
                      <p className="text-[11px] font-medium text-surface-700 leading-snug line-clamp-2 mb-1.5">
                        {truncate(battle.statement, 70)}
                      </p>
                      {/* Vote bar */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-for-400 w-7 text-right shrink-0">
                          {forPct}%
                        </span>
                        <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full bg-for-500 rounded-full transition-all"
                            style={{ width: `${forPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-against-400 w-7 shrink-0">
                          {againstPct}%
                        </span>
                      </div>
                      {/* Tension chip */}
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className={cn('h-1.5 w-1.5 rounded-full', tensionColor(battle.tension))} />
                        <span className="text-[9px] font-mono text-surface-600">
                          {battle.tension >= 90
                            ? 'deadlock'
                            : battle.tension >= 75
                            ? 'contested'
                            : 'active'}
                          {' · '}
                          {battle.total_votes.toLocaleString()} votes
                        </span>
                      </div>
                    </Link>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* ── Latest Laws ─────────────────────────────────────────────────── */}
      {hasLaws && (
        <div className="rounded-xl border border-emerald/20 bg-surface-100/80 backdrop-blur-sm p-3">
          <SectionHeader
            icon={Gavel}
            label="Latest Laws"
            href="/law"
            iconColor="text-emerald"
          />
          <ul className="space-y-2" role="list">
            {data.laws.map((law) => (
              <li key={law.id}>
                <Link
                  href={`/law/${law.id}`}
                  className={cn(
                    'block rounded-lg p-2 -mx-1 px-2',
                    'hover:bg-surface-200/60 transition-colors',
                  )}
                >
                  <p className="text-[11px] font-medium text-surface-700 leading-snug line-clamp-2 mb-1">
                    {truncate(law.statement, 75)}
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-surface-600">
                    {law.category && (
                      <>
                        <span className="text-emerald/80">{law.category}</span>
                        <span>·</span>
                      </>
                    )}
                    <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>{relativeTime(law.established_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Debates ─────────────────────────────────────────────────────── */}
      {hasDebates && (
        <div className="rounded-xl border border-purple/20 bg-surface-100/80 backdrop-blur-sm p-3">
          <SectionHeader
            icon={Mic}
            label="Debates"
            href="/debate"
            iconColor="text-purple"
          />
          <ul className="space-y-2" role="list">
            {data.debates.map((debate) => {
              const isLive = debate.status === 'live'
              return (
                <li key={debate.id}>
                  <Link
                    href={`/debate/${debate.id}`}
                    className={cn(
                      'block rounded-lg p-2 -mx-1 px-2',
                      'hover:bg-surface-200/60 transition-colors',
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      {isLive && (
                        <span className="mt-0.5 flex-shrink-0">
                          <PulseDot color="red" className="h-1.5 w-1.5" />
                        </span>
                      )}
                      <p className="text-[11px] font-medium text-surface-700 leading-snug line-clamp-2">
                        {truncate(debate.title ?? 'Untitled debate', 65)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[9px] font-mono">
                      {isLive ? (
                        <span className="text-against-400 font-semibold uppercase tracking-wider">
                          Live now
                        </span>
                      ) : (
                        <span className="text-surface-600">
                          {debateRelativeTime(debate.scheduled_at)}
                        </span>
                      )}
                      {debate.type && (
                        <>
                          <span className="text-surface-700">·</span>
                          <span className="text-surface-600 capitalize">
                            {debate.type}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Quick nav ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-surface-300/50 bg-surface-100/80 backdrop-blur-sm p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Flame className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-500">
            Quick Access
          </span>
        </div>
        <nav aria-label="Quick access links" className="space-y-0.5">
          {[
            { href: '/trending', label: 'Trending' },
            { href: '/split', label: 'Most Contested' },
            { href: '/predictions', label: 'Predictions' },
            { href: '/leaderboard', label: 'Leaderboard' },
            { href: '/stats', label: 'Platform Stats' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between',
                'px-2 py-1.5 rounded-lg text-[11px] font-mono',
                'text-surface-600 hover:text-white hover:bg-surface-200/60',
                'transition-colors',
              )}
            >
              {item.label}
              <ChevronRight className="h-3 w-3 opacity-40" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Zap link: create a topic ─────────────────────────────────────── */}
      <Link
        href="/topic/create"
        className={cn(
          'flex items-center justify-center gap-2',
          'rounded-xl border border-for-600/40 bg-for-600/10',
          'px-3 py-2.5',
          'text-[11px] font-mono font-semibold text-for-400',
          'hover:bg-for-600/20 hover:border-for-600/60 transition-colors',
        )}
      >
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        Propose a Topic
      </Link>
    </aside>
  )
}
