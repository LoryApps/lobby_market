'use client'

/**
 * /ambient — Civic Ambient Display
 *
 * A fullscreen, no-chrome screensaver-style visualization of live
 * civic activity. Designed for offices, conference rooms, and public
 * screens. Auto-refreshes every 15–30s. No TopBar or BottomNav.
 *
 * Data sources:
 *   /api/today          — daily platform stats + top topic/argument
 *   /api/arguments/recent — live argument stream
 *   /api/ambient        — 10 most recently established laws for the ticker
 *
 * Distinct from:
 *   /live       — interactive argument stream with filters
 *   /broadcast  — debate-focused live view with vote bar
 *   /today      — stats-heavy daily snapshot with navigation
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ExternalLink,
  Gavel,
  MessageSquare,
  Minimize2,
  Maximize2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TodayResponse } from '@/app/api/today/route'
import type { RecentArgument, RecentArgumentsResponse } from '@/app/api/arguments/recent/route'
import type { AmbientLaw } from '@/app/api/ambient/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATS_REFRESH_MS    = 30_000
const ARGS_REFRESH_MS     = 12_000
const ARGUMENT_CYCLE_MS   = 8_000
const MAX_ARGS            = 60

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; glow: string }> = {
  Economics:   { text: 'text-gold',         glow: 'shadow-gold/20'         },
  Politics:    { text: 'text-for-400',      glow: 'shadow-for-500/20'      },
  Technology:  { text: 'text-purple',       glow: 'shadow-purple/20'       },
  Science:     { text: 'text-emerald',      glow: 'shadow-emerald/20'      },
  Ethics:      { text: 'text-against-400',  glow: 'shadow-against-500/20'  },
  Philosophy:  { text: 'text-purple',       glow: 'shadow-purple/20'       },
  Culture:     { text: 'text-gold',         glow: 'shadow-gold/20'         },
  Health:      { text: 'text-emerald',      glow: 'shadow-emerald/20'      },
  Environment: { text: 'text-emerald',      glow: 'shadow-emerald/20'      },
  Education:   { text: 'text-for-400',      glow: 'shadow-for-500/20'      },
}

function getCatColor(cat: string | null) {
  return (cat && CATEGORY_COLOR[cat]) ?? { text: 'text-surface-500', glow: '' }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-4 rounded-2xl bg-surface-100/60 border border-surface-300/40">
      <Icon className={cn('h-5 w-5', color)} aria-hidden="true" />
      <span className={cn('font-mono text-3xl font-bold tabular-nums', color)}>
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">
        {label}
      </span>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ pct }: { pct: number }) {
  const forPct  = Math.round(pct)
  const agPct   = 100 - forPct
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="font-mono text-xs text-for-400 w-8 text-right tabular-nums">{forPct}%</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-against-400 w-8 tabular-nums">{agPct}%</span>
    </div>
  )
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulseDot({ color = 'bg-emerald' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', color)} />
      <span className={cn('relative inline-flex rounded-full h-2 w-2', color)} />
    </span>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: RecentArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <motion.div
      key={arg.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-5 backdrop-blur-sm',
        isFor
          ? 'bg-for-950/40 border-for-800/40'
          : 'bg-against-950/30 border-against-800/30',
      )}
    >
      {/* Side pill + topic */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider',
            isFor
              ? 'bg-for-500/20 text-for-400 border border-for-500/30'
              : 'bg-against-500/20 text-against-400 border border-against-500/30',
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {arg.topic && (
          <span className="text-[11px] text-surface-500 font-mono truncate">
            {truncate(arg.topic.statement, 60)}
          </span>
        )}
      </div>

      {/* Argument text */}
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-4">
        {arg.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-300/30">
        <div className="flex items-center gap-1.5">
          <ThumbsUp className="h-3 w-3 text-surface-500" />
          <span className="text-xs font-mono text-surface-500">{arg.upvotes}</span>
        </div>
        <div className="flex items-center gap-2">
          {arg.author && (
            <span className="text-[11px] font-mono text-surface-600">
              @{arg.author.username}
            </span>
          )}
          <span className="text-[11px] font-mono text-surface-600">{relTime(arg.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Laws ticker ─────────────────────────────────────────────────────────────

interface LawItem {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
}

function LawTicker({ laws }: { laws: LawItem[] }) {
  if (!laws.length) return null

  // duplicate for seamless loop
  const items = [...laws, ...laws]

  return (
    <div className="overflow-hidden py-2 border-y border-surface-300/20">
      <div className="flex gap-8 animate-exchange-ticker whitespace-nowrap">
        {items.map((law, i) => (
          <span key={`${law.id}-${i}`} className="inline-flex items-center gap-2 shrink-0">
            <Gavel className="h-3 w-3 text-gold shrink-0" />
            <span className="font-mono text-xs text-gold">LAW</span>
            <span className="text-xs text-surface-600">{truncate(law.statement, 70)}</span>
            <span className="font-mono text-[10px] text-for-400">
              {Math.round(law.blue_pct)}% FOR
            </span>
            <span className="text-surface-300/40 mx-1">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AmbientClient() {
  const [stats, setStats]       = useState<TodayResponse | null>(null)
  const [args, setArgs]         = useState<RecentArgument[]>([])
  const [laws, setLaws]         = useState<LawItem[]>([])
  const [argIdx, setArgIdx]     = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [loading, setLoading]   = useState(true)

  const argsRef = useRef<RecentArgument[]>([])
  argsRef.current = args

  // ── Fetch today stats + recent laws ───────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const [todayRes, lawsRes] = await Promise.all([
        fetch('/api/today', { cache: 'no-store' }),
        fetch('/api/ambient', { cache: 'no-store' }),
      ])

      if (todayRes.ok) {
        const data: TodayResponse = await todayRes.json()
        setStats(data)
      }

      if (lawsRes.ok) {
        const data = await lawsRes.json()
        const items = (data.laws ?? []) as LawItem[]
        setLaws(items.slice(0, 8))
      }

      setLastRefresh(new Date())
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch recent arguments ────────────────────────────────────────────────

  const fetchArgs = useCallback(async () => {
    try {
      const res = await fetch('/api/arguments/recent?limit=40', { cache: 'no-store' })
      if (!res.ok) return
      const data: RecentArgumentsResponse = await res.json()
      const fresh = data.arguments ?? []
      setArgs((prev) => {
        const ids = new Set(prev.map((a) => a.id))
        const merged = [...fresh.filter((a) => !ids.has(a.id)), ...prev].slice(0, MAX_ARGS)
        return merged
      })
    } catch {
      // silently ignore
    }
  }, [])

  // ── Auto-cycle through arguments ──────────────────────────────────────────

  useEffect(() => {
    const iv = setInterval(() => {
      setArgIdx((i) => (argsRef.current.length > 0 ? (i + 1) % argsRef.current.length : 0))
    }, ARGUMENT_CYCLE_MS)
    return () => clearInterval(iv)
  }, [])

  // ── Polling ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats()
    fetchArgs()
    const statsIv = setInterval(fetchStats, STATS_REFRESH_MS)
    const argsIv  = setInterval(fetchArgs,  ARGS_REFRESH_MS)
    return () => { clearInterval(statsIv); clearInterval(argsIv) }
  }, [fetchStats, fetchArgs])

  // ── Fullscreen API ────────────────────────────────────────────────────────

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setFullscreen(false)
    }
  }

  useEffect(() => {
    function onFsChange() {
      setFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ─── Keyboard shortcut: F = fullscreen, R = refresh, Esc closes ───────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === 'r' || e.key === 'R') { fetchStats(); fetchArgs() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fetchStats, fetchArgs])

  // ── Compute active topics count from stats ────────────────────────────────

  const currentArg = args[argIdx] ?? null
  const s = stats?.stats

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50 text-white flex flex-col select-none overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-surface-300/30 shrink-0">
        <div className="flex items-center gap-3">
          <PulseDot color="bg-emerald" />
          <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
            Lobby Market · Live Civic Display
          </span>
          {lastRefresh && (
            <span className="font-mono text-[10px] text-surface-600">
              Updated {relTime(lastRefresh.toISOString())}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white border border-surface-300/30 hover:border-surface-400/50 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Open Lobby
          </Link>
          <button
            onClick={() => { fetchStats(); fetchArgs() }}
            aria-label="Refresh data"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white border border-surface-300/30 hover:border-surface-400/50 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white border border-surface-300/30 hover:border-surface-400/50 transition-colors"
          >
            {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </header>

      {/* ── Laws ticker ────────────────────────────────────────────────────── */}
      <LawTicker laws={laws} />

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-0 overflow-hidden">

        {/* ── LEFT: Stats + Top topic ──────────────────────────────────────── */}
        <section className="lg:col-span-1 flex flex-col gap-4 p-6 border-r border-surface-300/20 overflow-y-auto">

          {/* Stat tiles */}
          <div>
            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-3">
              Today&apos;s Activity
            </p>
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[0,1,2,3].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-surface-100/60 animate-pulse" />
                ))}
              </div>
            ) : s ? (
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon={Vote}          label="Votes Cast"   value={s.votes_cast}      color="text-for-400" />
                <StatTile icon={MessageSquare} label="Arguments"    value={s.arguments_made}  color="text-purple" />
                <StatTile icon={Activity}      label="New Topics"   value={s.new_topics}       color="text-gold" />
                <StatTile icon={Gavel}         label="Laws Passed"  value={s.laws_passed}      color="text-emerald" />
              </div>
            ) : (
              <div className="text-xs text-surface-600 font-mono">No stats yet today</div>
            )}
          </div>

          {/* Top topic */}
          {stats?.topTopic && (
            <div className="rounded-2xl bg-surface-100/60 border border-surface-300/40 p-4">
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-for-400" />
                Top Topic Now
              </p>
              <p className="text-sm font-semibold text-white leading-snug mb-3">
                {stats.topTopic.statement}
              </p>
              <VoteBar pct={stats.topTopic.blue_pct} />
              <div className="flex items-center gap-2 mt-2">
                {stats.topTopic.category && (
                  <span className={cn('text-[10px] font-mono', getCatColor(stats.topTopic.category).text)}>
                    {stats.topTopic.category}
                  </span>
                )}
                <span className="text-[10px] font-mono text-surface-600">
                  {stats.topTopic.total_votes.toLocaleString()} votes
                </span>
                <Link
                  href={`/topic/${stats.topTopic.id}`}
                  className="ml-auto text-[10px] font-mono text-surface-500 hover:text-white flex items-center gap-0.5 transition-colors"
                >
                  View <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Voting topics */}
          {stats?.votingNow && stats.votingNow.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Scale className="h-3 w-3 text-purple" />
                Currently Voting
              </p>
              <div className="space-y-2">
                {stats.votingNow.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl bg-surface-100/40 border border-purple/20 p-3"
                  >
                    <p className="text-xs text-surface-700 leading-snug mb-2 line-clamp-2">
                      {t.statement}
                    </p>
                    <VoteBar pct={t.blue_pct} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard hints */}
          <div className="mt-auto pt-4 border-t border-surface-300/20">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'F', label: 'Fullscreen' },
                { key: 'R', label: 'Refresh' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-200 border border-surface-300 text-[10px] font-mono text-surface-500">
                    {key}
                  </kbd>
                  <span className="text-[10px] font-mono text-surface-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CENTER: Live argument feed ────────────────────────────────────── */}
        <section className="lg:col-span-1 flex flex-col p-6 border-r border-surface-300/20 overflow-hidden">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-1.5 shrink-0">
            <PulseDot color="bg-against-500" />
            Live Arguments
          </p>

          {loading && args.length === 0 ? (
            <div className="flex-1 space-y-3">
              {[0,1,2].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-surface-100/60 animate-pulse" />
              ))}
            </div>
          ) : args.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-surface-600">
              No live arguments yet
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden">
              {/* Large featured argument */}
              <AnimatePresence mode="wait">
                {currentArg && (
                  <ArgumentCard key={currentArg.id} arg={currentArg} />
                )}
              </AnimatePresence>

              {/* Mini list below the featured card */}
              <div className="mt-4 space-y-2 overflow-hidden">
                {args
                  .filter((_, i) => i !== argIdx)
                  .slice(0, 4)
                  .map((arg) => (
                    <motion.div
                      key={arg.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-100/30 border border-surface-300/20"
                    >
                      <span
                        className={cn(
                          'shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full',
                          arg.side === 'blue' ? 'bg-for-500' : 'bg-against-500',
                        )}
                      />
                      <p className="text-xs text-surface-600 line-clamp-2 leading-relaxed">
                        {arg.content}
                      </p>
                    </motion.div>
                  ))}
              </div>

              {/* Argument counter */}
              <div className="absolute bottom-0 right-0 text-[10px] font-mono text-surface-600">
                {argIdx + 1} / {args.length}
              </div>
            </div>
          )}
        </section>

        {/* ── RIGHT: Pulse metrics + recent law ────────────────────────────── */}
        <section className="lg:col-span-1 flex flex-col p-6 overflow-y-auto">

          {/* Platform pulse */}
          <div className="mb-6">
            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-gold" />
              Platform Pulse
            </p>
            <div className="space-y-3">
              {[
                {
                  label: 'Total Votes Today',
                  value: s?.votes_cast ?? 0,
                  max: Math.max(s?.votes_cast ?? 1, 500),
                  color: 'bg-for-500',
                },
                {
                  label: 'Arguments Posted',
                  value: s?.arguments_made ?? 0,
                  max: Math.max(s?.arguments_made ?? 1, 100),
                  color: 'bg-purple',
                },
                {
                  label: 'New Topics',
                  value: s?.new_topics ?? 0,
                  max: Math.max(s?.new_topics ?? 1, 50),
                  color: 'bg-gold',
                },
                {
                  label: 'Laws Passed',
                  value: s?.laws_passed ?? 0,
                  max: Math.max(s?.laws_passed ?? 1, 10),
                  color: 'bg-emerald',
                },
              ].map(({ label, value, max, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-surface-600">{label}</span>
                    <span className="text-[11px] font-mono text-surface-500 tabular-nums">
                      {value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-200/60 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', color)}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most recent law */}
          {stats?.recentLaw && (
            <div className="rounded-2xl bg-gold/5 border border-gold/20 p-4 mb-6">
              <p className="text-[10px] font-mono text-gold/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Gavel className="h-3 w-3 text-gold" />
                Latest Law Established
              </p>
              <p className="text-sm font-semibold text-white leading-snug mb-3">
                {stats.recentLaw.statement}
              </p>
              <VoteBar pct={stats.recentLaw.blue_pct} />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono text-surface-500">
                  {stats.recentLaw.total_votes.toLocaleString()} total votes
                </span>
                {stats.recentLaw.category && (
                  <span className={cn('text-[10px] font-mono', getCatColor(stats.recentLaw.category).text)}>
                    {stats.recentLaw.category}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Top argument spotlight */}
          {stats?.topArgument && (
            <div className="rounded-2xl bg-surface-100/40 border border-surface-300/30 p-4">
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3 text-purple" />
                Top Argument Today
              </p>
              {stats.topArgument.author && (
                <p className="text-[11px] font-mono text-surface-500 mb-2">
                  @{stats.topArgument.author.username}
                  {stats.topArgument.topic?.category && (
                    <span className={cn('ml-2', getCatColor(stats.topArgument.topic.category).text)}>
                      {stats.topArgument.topic.category}
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs text-surface-700 leading-relaxed line-clamp-5 italic">
                &ldquo;{stats.topArgument.content}&rdquo;
              </p>
              <div className="flex items-center gap-1.5 mt-2.5">
                <ThumbsUp className="h-3 w-3 text-for-400" />
                <span className="text-[11px] font-mono text-for-400">
                  {stats.topArgument.upvotes} upvotes
                </span>
              </div>
            </div>
          )}

          {/* Footer watermark */}
          <div className="mt-auto pt-4 border-t border-surface-300/20 flex items-center justify-between">
            <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
              lobby.market
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              Ambient Display
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}
