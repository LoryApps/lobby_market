'use client'

/**
 * /scoreboard — Civic Live Scoreboard
 *
 * Real-time snapshot of who's making the biggest civic impact RIGHT NOW.
 * Updates every 30 seconds via polling.
 *
 * Shows:
 *   - Platform pulse (votes/arguments/active users in the last hour)
 *   - Side momentum: is FOR or AGAINST winning the last hour?
 *   - Hottest civic citizens: most active users in the last 60 minutes
 *   - Hottest topics: biggest activity spikes this hour
 *   - Category heat map: which category is ablaze right now
 *
 * Distinct from:
 *   /leaderboard   — all-time reputation rankings
 *   /signals       — topic-level strategic signals (brink of law, etc.)
 *   /momentum      — 24h velocity leaderboard
 *   /hotspot       — live alerts (debates, flash laws, voting endings)
 *   /now           — platform status board
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ScoreboardResponse,
  ScoreboardUser,
  ScoreboardTopic,
  CategoryHeat,
  SideMomentum,
} from '@/app/api/scoreboard/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────


const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  elder:         { label: 'Elder',         color: 'text-gold' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  senator:       { label: 'Senator',       color: 'text-purple' },
  lawmaker:      { label: 'Lawmaker',      color: 'text-gold' },
  person:        { label: 'Citizen',       color: 'text-surface-500' },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  Science:     { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',    bg: 'bg-for-400/10',    border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/20' },
  Health:      { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/20' },
  Environment: { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/20' },
  Education:   { text: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/20' },
}

function getCatColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulseStat({
  icon: Icon,
  iconColor,
  value,
  label,
  sublabel,
}: {
  icon: typeof Zap
  iconColor: string
  value: number
  label: string
  sublabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-200/60 border border-surface-300/60 text-center gap-1">
      <Icon className={cn('h-4 w-4 mb-1', iconColor)} />
      <span className={cn('font-mono text-2xl font-bold', iconColor)}>
        <AnimatedNumber value={value} />
      </span>
      <span className="text-[11px] font-mono text-white font-semibold">{label}</span>
      {sublabel && (
        <span className="text-[10px] font-mono text-surface-500">{sublabel}</span>
      )}
    </div>
  )
}

function SideMomentumBar({ data }: { data: SideMomentum }) {
  const isFor = data.leading === 'for'
  const isAgainst = data.leading === 'against'
  const isTied = data.leading === 'tied'

  return (
    <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300/60">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="h-4 w-4 text-surface-500" />
        <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
          Side Momentum — Last Hour
        </span>
      </div>

      {/* Bar */}
      <div className="flex h-7 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-to-r from-for-700 to-for-500 flex items-center justify-end pr-2"
          initial={{ width: '50%' }}
          animate={{ width: `${data.for_pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {data.for_pct >= 30 && (
            <span className="text-[10px] font-mono font-bold text-white">{data.for_pct}%</span>
          )}
        </motion.div>
        <motion.div
          className="h-full bg-gradient-to-l from-against-700 to-against-500 flex items-center justify-start pl-2"
          initial={{ width: '50%' }}
          animate={{ width: `${data.against_pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {data.against_pct >= 30 && (
            <span className="text-[10px] font-mono font-bold text-white">{data.against_pct}%</span>
          )}
        </motion.div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ThumbsUp className={cn('h-3.5 w-3.5', isFor ? 'text-for-400' : 'text-surface-500')} />
          <span className={cn('text-xs font-mono font-semibold', isFor ? 'text-for-300' : 'text-surface-500')}>
            FOR
          </span>
          <span className="text-[11px] font-mono text-surface-500">
            {data.for_votes_1h.toLocaleString()} votes
          </span>
        </div>
        <div className={cn(
          'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border',
          isTied
            ? 'text-gold border-gold/40 bg-gold/10'
            : isFor
              ? 'text-for-300 border-for-500/40 bg-for-500/10'
              : 'text-against-300 border-against-500/40 bg-against-500/10'
        )}>
          {isTied ? 'DEADLOCK' : isFor ? `FOR +${data.swing}%` : `AGAINST +${data.swing}%`}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[11px] font-mono text-surface-500')}>
            {data.against_votes_1h.toLocaleString()} votes
          </span>
          <span className={cn('text-xs font-mono font-semibold', isAgainst ? 'text-against-300' : 'text-surface-500')}>
            AGAINST
          </span>
          <ThumbsDown className={cn('h-3.5 w-3.5', isAgainst ? 'text-against-400' : 'text-surface-500')} />
        </div>
      </div>
    </div>
  )
}

function HotUserRow({ user, rank }: { user: ScoreboardUser; rank: number }) {
  const roleConf = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.person
  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
    >
      {/* Rank */}
      <span className={cn(
        'flex-shrink-0 w-6 text-center font-mono text-sm font-bold',
        rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-600' : rank === 3 ? 'text-against-500' : 'text-surface-500'
      )}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
      </span>

      <Avatar src={user.avatar_url} fallback={user.display_name || user.username} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
            {user.display_name || user.username}
          </span>
          <span className={cn('text-[10px] font-mono', roleConf.color)}>
            {roleConf.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {user.votes_1h > 0 && (
            <span className="text-[11px] font-mono text-surface-500">
              {user.votes_1h}v
            </span>
          )}
          {user.arguments_1h > 0 && (
            <span className="text-[11px] font-mono text-purple">
              {user.arguments_1h}a
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="font-mono text-sm font-bold text-gold">
          {user.activity_score}
        </div>
        <div className="text-[10px] font-mono text-surface-500">pts</div>
      </div>
    </Link>
  )
}

function HotTopicRow({ topic, rank }: { topic: ScoreboardTopic; rank: number }) {
  const catColor = getCatColor(topic.category ?? '')
  const forPct = Math.round(topic.blue_pct)
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
    >
      <span className="flex-shrink-0 w-5 pt-0.5 text-center font-mono text-xs font-bold text-surface-500">
        {rank}.
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors mb-1.5">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {topic.category && (
            <span className={cn('text-[10px] font-mono', catColor.text)}>{topic.category}</span>
          )}
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="xs">
            {topic.status === 'voting' ? 'Voting' : topic.status}
          </Badge>
          {topic.votes_1h > 0 && (
            <span className="text-[11px] font-mono text-for-400">
              +{topic.votes_1h} votes/hr
            </span>
          )}
          {topic.arguments_1h > 0 && (
            <span className="text-[11px] font-mono text-purple">
              +{topic.arguments_1h} args/hr
            </span>
          )}
        </div>

        {/* Mini vote bar */}
        <div className="mt-2 flex h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-for-500"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-against-500"
            style={{ width: `${100 - forPct}%` }}
          />
        </div>
        <div className="mt-0.5 flex justify-between">
          <span className="text-[10px] font-mono text-for-400">{forPct}% For</span>
          <span className="text-[10px] font-mono text-against-400">{100 - forPct}% Against</span>
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
        <Flame className="h-3.5 w-3.5 text-against-400" />
        <span className="text-[10px] font-mono font-bold text-against-300">{topic.heat_score}</span>
      </div>
    </Link>
  )
}

function CategoryHeatRow({ cat, maxHeat }: { cat: CategoryHeat; maxHeat: number }) {
  const barPct = maxHeat > 0 ? Math.max(4, Math.round((cat.heat_score / maxHeat) * 100)) : 4
  const catColor = getCatColor(cat.category)

  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono font-semibold w-24 flex-shrink-0', catColor.text)}>
        {cat.category}
      </span>
      <div className="flex-1 h-3 bg-surface-300/40 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', catColor.bg.replace('/10', '/60'))}
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[11px] font-mono text-surface-500 w-16 text-right flex-shrink-0">
        {cat.votes_1h}v {cat.arguments_1h}a
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ScoreboardClient() {
  const [data, setData] = useState<ScoreboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/scoreboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as ScoreboardResponse
      setData(json)
      setError(false)
      setLastUpdated(new Date())
      setCountdown(POLL_INTERVAL_MS / 1000)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, POLL_INTERVAL_MS)

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchData])

  const maxCatHeat = data?.category_heat[0]?.heat_score ?? 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl bg-against-500/10 border border-against-500/30">
              <Trophy className="h-6 w-6 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Scoreboard</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Real-time civic impact — last 60 minutes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
                <Timer className="h-3 w-3" />
                <span>Refresh in {countdown}s</span>
              </div>
            )}
            <button
              onClick={() => { fetchData(); setCountdown(POLL_INTERVAL_MS / 1000) }}
              disabled={loading}
              aria-label="Refresh scoreboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton className="h-24 rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-96 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          </div>
        )}

        {error && !data && (
          <EmptyState
            icon={Activity}
            title="Scoreboard unavailable"
            description="Could not load live scoreboard data. Try refreshing."
          />
        )}

        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="scoreboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Platform Pulse */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-for-400" />
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                    Platform Pulse
                  </h2>
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                    LIVE
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <PulseStat icon={Zap} iconColor="text-for-400" value={data.platform_pulse.votes_1h} label="Votes" sublabel="last hour" />
                  <PulseStat icon={MessageSquare} iconColor="text-purple" value={data.platform_pulse.arguments_1h} label="Arguments" sublabel="last hour" />
                  <PulseStat icon={Users} iconColor="text-emerald" value={data.platform_pulse.active_users_1h} label="Active Citizens" sublabel="last hour" />
                  <PulseStat icon={Gavel} iconColor="text-gold" value={data.platform_pulse.laws_24h} label="Laws Passed" sublabel="last 24h" />
                  <PulseStat icon={BarChart2} iconColor="text-against-400" value={data.platform_pulse.votes_24h} label="Votes Cast" sublabel="last 24h" />
                </div>
              </section>

              {/* Side Momentum */}
              <SideMomentumBar data={data.side_momentum} />

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hot Citizens */}
                <section className="rounded-2xl bg-surface-200/40 border border-surface-300/60 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300/60">
                    <Trophy className="h-4 w-4 text-gold" />
                    <h2 className="text-sm font-mono font-semibold text-white">Hot Citizens</h2>
                    <span className="ml-auto text-[11px] font-mono text-surface-500">last hour</span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {data.hot_users.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="No activity yet"
                        description="No citizens have been active in the last hour."
                        className="py-8"
                      />
                    ) : (
                      data.hot_users.map((user, idx) => (
                        <HotUserRow key={user.id} user={user} rank={idx + 1} />
                      ))
                    )}
                  </div>
                  <div className="px-4 pb-3">
                    <Link
                      href="/leaderboard"
                      className="flex items-center gap-1 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                    >
                      All-time leaderboard <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </section>

                {/* Hot Topics */}
                <section className="rounded-2xl bg-surface-200/40 border border-surface-300/60 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300/60">
                    <Flame className="h-4 w-4 text-against-400" />
                    <h2 className="text-sm font-mono font-semibold text-white">Hot Topics</h2>
                    <span className="ml-auto text-[11px] font-mono text-surface-500">last hour</span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {data.hot_topics.length === 0 ? (
                      <EmptyState
                        icon={Scale}
                        title="Quiet right now"
                        description="No topics with significant activity in the last hour."
                        className="py-8"
                      />
                    ) : (
                      data.hot_topics.map((topic, idx) => (
                        <HotTopicRow key={topic.id} topic={topic} rank={idx + 1} />
                      ))
                    )}
                  </div>
                  <div className="px-4 pb-3">
                    <Link
                      href="/momentum"
                      className="flex items-center gap-1 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                    >
                      24h momentum board <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </section>
              </div>

              {/* Category Heat */}
              {data.category_heat.length > 0 && (
                <section className="rounded-2xl bg-surface-200/40 border border-surface-300/60 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-4 w-4 text-purple" />
                    <h2 className="text-sm font-mono font-semibold text-white">Category Heat</h2>
                    <span className="ml-auto text-[11px] font-mono text-surface-500">last hour</span>
                  </div>
                  <div className="space-y-3">
                    {data.category_heat.map((cat) => (
                      <CategoryHeatRow key={cat.category} cat={cat} maxHeat={maxCatHeat} />
                    ))}
                  </div>
                  <Link
                    href="/categories"
                    className="mt-4 flex items-center gap-1 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                  >
                    Browse all categories <ArrowRight className="h-3 w-3" />
                  </Link>
                </section>
              )}

              {/* Tip */}
              <p className="text-center text-[11px] font-mono text-surface-500">
                Activity score: votes × 1 + arguments × 3 &nbsp;·&nbsp; Refreshes every 30 seconds
              </p>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
