'use client'

/**
 * /race — The Civic Topic Race
 *
 * A horse-race style visualization showing which debate topics are
 * currently surging fastest toward majority (51%) or law (67%) status.
 * Topics are ranked by their vote velocity (votes/hour) and shown as
 * animated progress bars on a shared track with milestone markers.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ExternalLink,
  Flag,
  Gavel,
  RefreshCw,
  Scale,
  Swords,
  ThumbsUp,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RacerTopic, RaceResponse } from '@/app/api/race/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_REFRESH_MS = 60_000
const MAJORITY_PCT = 51
const LAW_PCT = 67

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
}

function formatEta(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 0.1) return '< 6 min'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)}h`
  const d = Math.round(hours / 24)
  return `${d}d`
}

function velocityLabel(v: number): string {
  if (v >= 100) return 'blazing'
  if (v >= 20) return 'fast'
  if (v >= 5) return 'steady'
  if (v >= 1) return 'slow'
  return 'stalled'
}

function velocityColor(v: number): string {
  if (v >= 100) return 'text-against-300'
  if (v >= 20) return 'text-gold'
  if (v >= 5) return 'text-for-400'
  if (v >= 1) return 'text-surface-400'
  return 'text-surface-600'
}

// ─── Track component ──────────────────────────────────────────────────────────

function RaceTrack({ racer }: { racer: RacerTopic }) {
  const pct = Math.min(100, Math.max(0, racer.blue_pct))
  const isLaw = pct >= LAW_PCT
  const isMajority = pct >= MAJORITY_PCT && !isLaw
  const categoryColor = CATEGORY_COLORS[racer.category ?? ''] ?? 'text-surface-400'

  const barColor = isLaw
    ? 'from-emerald/80 to-emerald'
    : isMajority
    ? 'from-for-600 to-for-400'
    : pct >= 40
    ? 'from-for-700 to-for-500'
    : 'from-against-700 to-against-500'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="group relative rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors"
    >
      {/* Rank badge */}
      <div className="absolute -top-2 -left-2 flex items-center justify-center h-6 w-6 rounded-full bg-surface-200 border border-surface-400 text-xs font-mono font-bold text-surface-400">
        {racer.rank}
      </div>

      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={STATUS_BADGE[racer.status] ?? 'proposed'}>
              {STATUS_LABEL[racer.status] ?? racer.status}
            </Badge>
            {racer.category && (
              <span className={cn('text-[11px] font-mono uppercase tracking-wider', categoryColor)}>
                {racer.category}
              </span>
            )}
            {isLaw && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-emerald font-semibold">
                <Gavel className="h-3 w-3" />
                AT LAW THRESHOLD
              </span>
            )}
            {isMajority && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-for-400 font-semibold">
                <Flag className="h-3 w-3" />
                MAJORITY
              </span>
            )}
          </div>
          <Link
            href={`/topic/${racer.id}`}
            className="block text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-2 pr-2"
          >
            {racer.statement}
          </Link>
        </div>

        {/* Velocity pill */}
        <div className="flex-shrink-0 text-right">
          <div className={cn('text-xs font-mono font-bold', velocityColor(racer.velocity))}>
            {racer.velocity.toFixed(1)}<span className="font-normal text-surface-500">/hr</span>
          </div>
          <div className="text-[10px] font-mono text-surface-500 capitalize">
            {velocityLabel(racer.velocity)}
          </div>
        </div>
      </div>

      {/* Race track */}
      <div className="relative h-8 rounded-lg overflow-hidden bg-surface-200">
        {/* Threshold markers */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-surface-400/60 z-10"
          style={{ left: `${MAJORITY_PCT}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald/50 z-10"
          style={{ left: `${LAW_PCT}%` }}
          aria-hidden="true"
        />

        {/* Progress bar */}
        <motion.div
          className={cn('absolute left-0 top-0 bottom-0 rounded-lg bg-gradient-to-r', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        {/* Percentage labels */}
        <div className="absolute inset-0 flex items-center px-3 z-20">
          <span className={cn(
            'text-xs font-mono font-bold',
            pct > 15 ? 'text-white' : 'text-surface-300'
          )}>
            {pct.toFixed(1)}% FOR
          </span>
          <span className="ml-auto text-xs font-mono text-surface-300">
            {(100 - pct).toFixed(1)}% AGN
          </span>
        </div>
      </div>

      {/* Track milestone labels */}
      <div className="relative mt-1 h-3 text-[10px] font-mono text-surface-600">
        <span className="absolute left-0">0%</span>
        <span className="absolute" style={{ left: `${MAJORITY_PCT}%`, transform: 'translateX(-50%)' }}>
          51%
        </span>
        <span className="absolute" style={{ left: `${LAW_PCT}%`, transform: 'translateX(-50%)' }}>
          67%
        </span>
        <span className="absolute right-0">100%</span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 text-xs font-mono text-surface-500 flex-wrap">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-for-400" />
          {racer.total_votes.toLocaleString()} total
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-gold" />
          {racer.votes_1h} last hour
        </span>
        {racer.momentum !== 0 && (
          <span className={cn(
            'flex items-center gap-0.5',
            racer.momentum > 0 ? 'text-for-400' : 'text-against-400'
          )}>
            <TrendingUp className={cn('h-3 w-3', racer.momentum < 0 && 'rotate-180')} />
            {racer.momentum > 0 ? '+' : ''}{racer.momentum}pp trend
          </span>
        )}
        {racer.gap_to_law !== null && racer.velocity > 0 && (
          <span className="flex items-center gap-1 text-emerald">
            <Timer className="h-3 w-3" />
            ~{formatEta(racer.eta_hours)} to law
          </span>
        )}
        {racer.gap_to_majority !== null && racer.gap_to_law === null && racer.velocity > 0 && (
          <span className="flex items-center gap-1 text-for-400">
            <Timer className="h-3 w-3" />
            ~{formatEta(racer.eta_hours)} to majority
          </span>
        )}
        <Link
          href={`/topic/${racer.id}`}
          className="ml-auto flex items-center gap-0.5 text-surface-500 hover:text-white transition-colors"
        >
          View <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RaceSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>
            <Skeleton className="h-8 w-16 flex-shrink-0" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
          <div className="flex gap-4 mt-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function TrackLegend() {
  return (
    <div className="flex items-center gap-6 text-xs font-mono text-surface-500 flex-wrap">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded-sm bg-for-500" />
        FOR leading
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded-sm bg-against-500" />
        AGAINST leading
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-0.5 bg-surface-400/60" />
        51% majority
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-0.5 bg-emerald/50" />
        67% law threshold
      </span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function RacePage() {
  const [data, setData] = useState<RaceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/race', { cache: 'no-store' })
      if (res.ok) {
        setData(await res.json())
        setLastRefresh(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(), AUTO_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  const racers = data?.racers ?? []
  const totalActive = data?.total_active ?? 0
  const fastestVelocity = data?.fastest_velocity ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <Swords className="h-5 w-5 text-for-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Race
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {totalActive > 0
                    ? `${totalActive} active topics · ${racers.length} racing now`
                    : 'Topics racing toward consensus'}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {lastRefresh && (
                <span className="text-xs font-mono text-surface-500 hidden sm:block">
                  Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="mt-4 text-sm font-mono text-surface-500 leading-relaxed">
            Topics ranked by <span className="text-white">vote velocity</span> (votes per hour).
            Track shows <span className="text-for-400">FOR %</span> position on the consensus
            track — cross <span className="text-surface-300">51%</span> for majority,{' '}
            <span className="text-emerald">67%</span> to become law.
          </p>

          {/* Stats strip */}
          {!loading && data && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="text-xl font-mono font-bold text-white">
                  {racers.length}
                </div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">Racing now</div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="text-xl font-mono font-bold text-gold">
                  {fastestVelocity.toFixed(1)}
                </div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">Peak votes/hr</div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="text-xl font-mono font-bold text-emerald">
                  {racers.filter((r) => r.blue_pct >= LAW_PCT).length}
                </div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">At law threshold</div>
              </div>
            </div>
          )}

          {/* Legend */}
          {!loading && (
            <div className="mt-4">
              <TrackLegend />
            </div>
          )}
        </div>

        {/* ── Race board ────────────────────────────────────────────────── */}
        {loading ? (
          <RaceSkeleton />
        ) : racers.length === 0 ? (
          <EmptyState
            icon={Swords}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="No active races"
            description="Races appear when topics are actively being voted on. Check back when debates are in full swing."
            actions={[
              { label: 'Browse Active Topics', href: '/', icon: ArrowRight },
              { label: 'Momentum Board', href: '/momentum', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="sync">
              {racers.map((racer) => (
                <RaceTrack key={racer.id} racer={racer} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Related links ──────────────────────────────────────────────── */}
        {!loading && racers.length > 0 && (
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono text-surface-600">Explore more:</span>
            {[
              { href: '/momentum', label: 'Momentum', icon: TrendingUp },
              { href: '/surge', label: 'Surge', icon: Zap },
              { href: '/shifts', label: 'Shifts', icon: ArrowRight },
              { href: '/senate', label: 'Senate', icon: Scale },
              { href: '/pipeline', label: 'Pipeline', icon: Gavel },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
