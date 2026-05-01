'use client'

/**
 * /radar — The Civic Radar
 *
 * Live urgency dashboard showing:
 *  - Dead heats: voting topics closest to 50/50 (needs your vote most)
 *  - Active surge: topics gaining momentum toward activation
 *  - Debates soon: live or starting within 6 hours
 *  - Laws today: consensus reached today
 *  - Platform pulse: live counters
 *
 * Polls every 45 seconds for freshness.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Gavel,
  Mic,
  Radio,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
  Target,
  MessageSquare,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RadarResponse,
  RadarDeadHeat,
  RadarActiveTopic,
  RadarDebate,
  RadarLaw,
} from '@/app/api/radar/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 45_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'closing'
  const m = Math.round(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `${m}m left`
  if (h < 24) return `${h}h left`
  return `${d}d left`
}

function timeUntilFuture(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.round(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 60) return `in ${m}m`
  return `in ${h}h`
}

// ─── Closeness ring SVG ───────────────────────────────────────────────────────

function ContestRing({ closeness, size = 44 }: { closeness: number; size?: number }) {
  const radius = (size - 8) / 2
  const circ = 2 * Math.PI * radius
  // closeness 0 = perfectly 50/50 (fully filled ring = most urgent)
  // closeness 50 = one-sided (empty ring)
  const fillPct = Math.max(0, (50 - closeness) / 50)
  const dash = fillPct * circ
  const urgency = closeness < 5 ? 'text-against-400' : closeness < 15 ? 'text-gold' : 'text-for-400'

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="currentColor" strokeWidth={4}
        className="text-surface-300"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className={urgency}
        style={{ stroke: 'currentColor', transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ─── Dead Heat Card ───────────────────────────────────────────────────────────

function DeadHeatCard({ topic }: { topic: RadarDeadHeat }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const spread = Math.abs(forPct - 50)
  const isUltraClose = spread < 3
  const isTight = spread < 10

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 transition-colors hover:border-surface-400/60',
        isUltraClose
          ? 'bg-against-900/20 border-against-500/40'
          : isTight
          ? 'bg-gold/5 border-gold/30'
          : 'bg-surface-100 border-surface-300',
      )}
    >
      <Link href={`/topic/${topic.id}`} className="block">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <ContestRing closeness={topic.closeness} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {topic.statement}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {topic.category && (
                <span className={cn('text-xs font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                  {topic.category}
                </span>
              )}
              <span className="text-xs text-surface-500">
                {topic.total_votes.toLocaleString()} votes
              </span>
              {topic.voting_ends_at && (
                <>
                  <span className="text-surface-600">·</span>
                  <span className={cn('text-xs font-mono font-semibold', isUltraClose ? 'text-against-400' : 'text-surface-500')}>
                    {timeUntil(topic.voting_ends_at)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vote bar */}
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
          <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
            />
          </div>
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
        </div>

        <div className="flex justify-between mt-1">
          <span className="text-xs font-mono text-for-400">FOR {forPct}%</span>
          <span className={cn('text-xs font-mono font-bold', isUltraClose ? 'text-against-300' : 'text-surface-500')}>
            {spread < 1 ? 'EXACT TIE' : `±${spread}%`}
          </span>
          <span className="text-xs font-mono text-against-400">AGAINST {againstPct}%</span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Active surge card ────────────────────────────────────────────────────────

function SurgeCard({ topic }: { topic: RadarActiveTopic }) {
  const pct = topic.activation_threshold > 0
    ? Math.min(100, Math.round((topic.support_count / topic.activation_threshold) * 100))
    : 0

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="block rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 p-3 transition-colors"
    >
      <p className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-2">
        {topic.statement}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-for-700 to-for-400 rounded-full"
          />
        </div>
        <span className="text-xs font-mono text-for-400 flex-shrink-0">{pct}%</span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {topic.category && (
          <span className={cn('text-xs font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
            {topic.category}
          </span>
        )}
        <span className="text-xs text-surface-500">
          {topic.support_count}/{topic.activation_threshold} needed
        </span>
      </div>
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: RadarDebate }) {
  const isLive = debate.status === 'live'

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        isLive
          ? 'bg-against-900/20 border-against-500/40 hover:border-against-400/60'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400/60',
      )}
    >
      <div className={cn(
        'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
        isLive ? 'bg-against-500/20' : 'bg-surface-200',
      )}>
        {isLive ? (
          <Radio className="h-4 w-4 text-against-400 animate-pulse" />
        ) : (
          <Mic className="h-4 w-4 text-surface-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white line-clamp-1">
          {debate.topic_statement}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-xs font-mono font-semibold', isLive ? 'text-against-400' : 'text-surface-500')}>
            {isLive ? 'LIVE NOW' : debate.scheduled_at ? timeUntilFuture(debate.scheduled_at) : 'scheduled'}
          </span>
          <span className="text-surface-600">·</span>
          <span className="text-xs text-surface-500">{debate.duration_minutes}m</span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </Link>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: RadarLaw }) {
  return (
    <Link
      href={`/law/${law.id}`}
      className="flex items-center gap-3 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 p-3 transition-colors"
    >
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 flex-shrink-0">
        <Gavel className="h-4 w-4 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {law.category && (
            <span className={cn('text-xs font-mono', CATEGORY_COLOR[law.category] ?? 'text-surface-500')}>
              {law.category}
            </span>
          )}
          {law.blue_pct !== null && (
            <span className="text-xs text-surface-500">
              {Math.round(law.blue_pct)}% FOR
            </span>
          )}
          <span className="text-surface-600">·</span>
          <span className="text-xs text-surface-500">{relTime(law.established_at)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Activity
  label: string
  value: number
  color: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 px-4 py-3 rounded-xl border', color)}>
      <Icon className="h-4 w-4 mb-0.5" />
      <span className="text-xl font-bold font-mono">{value.toLocaleString()}</span>
      <span className="text-xs font-mono text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconClass,
  count,
  id,
}: {
  icon: typeof Scale
  title: string
  subtitle?: string
  iconClass: string
  count?: number
  id?: string
}) {
  return (
    <div id={id} className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">{title}</h2>
        {count !== undefined && (
          <span className="text-xs font-mono text-surface-500">({count})</span>
        )}
      </div>
      {subtitle && (
        <span className="text-xs text-surface-500">{subtitle}</span>
      )}
    </div>
  )
}

// ─── Skeleton layouts ─────────────────────────────────────────────────────────

function PulseSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {/* Dead heats */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Two column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/radar', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as RadarResponse
        setData(json)
        setLastUpdated(new Date())
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
    timerRef.current = setInterval(() => load(), POLL_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Radio className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Radar</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Where the Lobby needs you right now
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs font-mono text-surface-500 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh radar"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <PulseSkeleton />
        ) : !data ? (
          <EmptyState
            icon={Radio}
            title="Radar offline"
            description="Could not load live data. Please try again."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* ── Platform pulse stats ──────────────────────────────── */}
              <section aria-label="Platform stats">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <StatPill
                    icon={Scale}
                    label="In voting"
                    value={data.stats.voting_topics}
                    color="bg-for-500/10 border-for-500/30 text-for-400"
                  />
                  <StatPill
                    icon={Zap}
                    label="Active topics"
                    value={data.stats.active_topics}
                    color="bg-purple/10 border-purple/30 text-purple"
                  />
                  <StatPill
                    icon={Radio}
                    label="Live debates"
                    value={data.stats.live_debates}
                    color="bg-against-500/10 border-against-500/30 text-against-400"
                  />
                  <StatPill
                    icon={Gavel}
                    label="Laws today"
                    value={data.stats.laws_today}
                    color="bg-gold/10 border-gold/30 text-gold"
                  />
                  <StatPill
                    icon={MessageSquare}
                    label="Args / hr"
                    value={data.stats.arguments_last_hour}
                    color="bg-emerald/10 border-emerald/30 text-emerald"
                  />
                </div>
              </section>

              {/* ── Dead Heats: voting topics closest to 50/50 ──────── */}
              <section aria-labelledby="dead-heats-title">
                <SectionHeader
                  icon={Target}
                  title="Dead Heats"
                  subtitle="Your vote could tip the scale"
                  iconClass="text-against-400"
                  count={data.dead_heats.length}
                  id="dead-heats-title"
                />

                {data.dead_heats.length === 0 ? (
                  <EmptyState
                    icon={Scale}
                    title="No voting topics right now"
                    description="Check back when topics enter the voting phase."
                  />
                ) : (
                  <div className="space-y-3">
                    {data.dead_heats.map((topic) => (
                      <DeadHeatCard key={topic.id} topic={topic} />
                    ))}
                    <Link
                      href="/?status=voting"
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      See all voting topics
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </section>

              {/* ── Two-column: Active surge + Debates ──────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Active surge */}
                <section aria-labelledby="surge-title">
                  <SectionHeader
                    icon={TrendingUp}
                    title="Building Momentum"
                    subtitle="Needs support"
                    iconClass="text-for-400"
                    count={data.active_surge.length}
                    id="surge-title"
                  />

                  {data.active_surge.length === 0 ? (
                    <p className="text-sm text-surface-500">No active topics right now.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.active_surge.slice(0, 4).map((topic) => (
                        <SurgeCard key={topic.id} topic={topic} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Upcoming debates */}
                <section aria-labelledby="debates-title">
                  <SectionHeader
                    icon={Mic}
                    title="Debates"
                    subtitle="Next 6 hours"
                    iconClass="text-against-400"
                    count={data.debates_soon.length}
                    id="debates-title"
                  />

                  {data.debates_soon.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-surface-500">No live or upcoming debates.</p>
                      <Link
                        href="/debate/calendar"
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                      >
                        Browse debate calendar
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.debates_soon.map((debate) => (
                        <DebateCard key={debate.id} debate={debate} />
                      ))}
                      <Link
                        href="/debate/calendar"
                        className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                      >
                        Full debate calendar
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </section>
              </div>

              {/* ── Laws established today ────────────────────────────── */}
              {data.laws_today.length > 0 && (
                <section aria-labelledby="laws-title">
                  <SectionHeader
                    icon={Gavel}
                    title="Passed Today"
                    subtitle="New consensus laws"
                    iconClass="text-gold"
                    count={data.laws_today.length}
                    id="laws-title"
                  />
                  <div className="space-y-2">
                    {data.laws_today.map((law) => (
                      <LawCard key={law.id} law={law} />
                    ))}
                    <Link
                      href="/law"
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Browse all laws
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </section>
              )}

              {/* ── Footer note ───────────────────────────────────────── */}
              <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-surface-100 border border-surface-300">
                <Activity className="h-4 w-4 text-surface-500 flex-shrink-0" />
                <p className="text-xs font-mono text-surface-500">
                  Radar updates every 45 seconds. Dead heats are sorted by closeness to 50/50 —
                  the tightest vote is at the top.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
