'use client'

/**
 * /heat — Civic Heat Index
 *
 * Ranks every active debate by a composite "heat" score derived from four
 * independent signals:
 *   • Vote Velocity  (40%) — how many new votes in the last 24 h
 *   • Argument Burst (25%) — new arguments added in the last 24 h
 *   • Reply Surge    (15%) — argument threads deepening (replies/24 h)
 *   • Controversy    (20%) — how close the vote is to 50/50
 *
 * Distinct from:
 *   /trending      — feed sorted by feed_score (engagement over all time)
 *   /surge         — topics close to the support threshold
 *   /velocity      — per-category vote flow over time (hourly buckets)
 *   /hotspot       — contested topics + live debates combined view
 *   /momentum      — vote-count velocity per topic (single signal)
 *
 * This is the only page combining all four live-engagement signals into a
 * single temperature for instant discovery of the platform's hottest debates.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ChevronRight,
  Cpu,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HeatTopic, HeatResponse, HeatLevel } from '@/app/api/stats/heat/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CFG: Record<string, { icon: typeof Globe; text: string }> = {
  Politics:    { icon: Landmark,      text: 'text-for-400'    },
  Economics:   { icon: TrendingUp,    text: 'text-gold'       },
  Technology:  { icon: Cpu,           text: 'text-purple'     },
  Science:     { icon: FlaskConical,  text: 'text-emerald'    },
  Ethics:      { icon: Scale,         text: 'text-for-300'    },
  Philosophy:  { icon: Globe,         text: 'text-purple'     },
  Culture:     { icon: Music2,        text: 'text-against-400'},
  Health:      { icon: Heart,         text: 'text-emerald'    },
  Environment: { icon: Leaf,          text: 'text-emerald'    },
  Education:   { icon: GraduationCap, text: 'text-gold'       },
}
const CATEGORIES = Object.keys(CAT_CFG)

function getCatCfg(cat: string | null) {
  return CAT_CFG[cat ?? ''] ?? { icon: Globe, text: 'text-surface-500' }
}

// ─── Heat level config ────────────────────────────────────────────────────────

const HEAT_CFG: Record<HeatLevel, {
  label: string
  emoji: string
  color: string
  bg: string
  border: string
  barColor: string
  glow: string
}> = {
  inferno: {
    label: 'INFERNO',
    emoji: '🔥',
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/50',
    barColor: 'bg-gradient-to-r from-against-700 via-against-500 to-against-400',
    glow: 'shadow-against-900/50',
  },
  blazing: {
    label: 'BLAZING',
    emoji: '🌡️',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    barColor: 'bg-gradient-to-r from-against-700 via-gold to-gold',
    glow: 'shadow-gold/20',
  },
  heating: {
    label: 'HEATING',
    emoji: '⚡',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/35',
    barColor: 'bg-gradient-to-r from-for-700 via-for-500 to-for-300',
    glow: '',
  },
  warm: {
    label: 'WARM',
    emoji: '🌡',
    color: 'text-for-400',
    bg: 'bg-for-500/5',
    border: 'border-for-500/20',
    barColor: 'bg-for-600',
    glow: '',
  },
  cool: {
    label: 'COOL',
    emoji: '❄️',
    color: 'text-surface-500',
    bg: 'bg-surface-200/50',
    border: 'border-surface-400',
    barColor: 'bg-surface-500',
    glow: '',
  },
}

// ─── Status badge variant ─────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeatSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Heat signal pills ────────────────────────────────────────────────────────

function SignalPill({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: typeof Activity
  label: string
  value: number
  active: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
        active
          ? 'bg-for-500/15 border-for-500/30 text-for-300'
          : 'bg-surface-200/60 border-surface-400/40 text-surface-500'
      )}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      <span className="font-semibold">{value}</span>
      <span className="opacity-60">{label}</span>
    </span>
  )
}

// ─── Heat bar ─────────────────────────────────────────────────────────────────

function HeatBar({ heat, level }: { heat: number; level: HeatLevel }) {
  const cfg = HEAT_CFG[level]
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className={cn('font-bold tracking-widest', cfg.color)}>
          {cfg.emoji} {cfg.label}
        </span>
        <span className={cn('font-semibold', cfg.color)}>{heat}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${heat}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', cfg.barColor)}
        />
      </div>
    </div>
  )
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function HeatTopicCard({
  topic,
  rank,
}: {
  topic: HeatTopic
  rank: number
}) {
  const cfg = HEAT_CFG[topic.heat_level]
  const catCfg = getCatCfg(topic.category)
  const CatIcon = catCfg.icon
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.4) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl border p-4 space-y-3 transition-all',
          'bg-surface-100 hover:bg-surface-200',
          cfg.border,
          cfg.glow && `shadow-lg ${cfg.glow}`,
          topic.heat_level === 'inferno' && 'bg-against-950/40',
          topic.heat_level === 'blazing' && 'bg-gold/5',
        )}
      >
        {/* Top row: rank + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold text-surface-500">
            #{rank + 1}
          </span>
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
            {topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
          </Badge>
          {topic.category && (
            <span className={cn('flex items-center gap-1 text-[11px] font-medium', catCfg.text)}>
              <CatIcon className="h-3 w-3" />
              {topic.category}
            </span>
          )}
          <span
            className={cn(
              'ml-auto text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full border',
              cfg.color, cfg.bg, cfg.border
            )}
          >
            {cfg.emoji} {cfg.label}
          </span>
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-surface-100 leading-snug line-clamp-2">
          {topic.statement}
        </p>

        {/* Heat bar */}
        <HeatBar heat={topic.heat} level={topic.heat_level} />

        {/* Vote bar */}
        <div className="space-y-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
            <div
              style={{ width: `${forPct}%` }}
              className="bg-gradient-to-r from-for-700 to-for-500"
            />
            <div
              style={{ width: `${againstPct}%` }}
              className="bg-against-600"
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-500">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-surface-500">{formatVotes(topic.total_votes)} votes</span>
            <span className="text-against-400">{againstPct}% Against</span>
          </div>
        </div>

        {/* Signal pills */}
        <div className="flex flex-wrap gap-1.5">
          <SignalPill icon={ThumbsUp} label="votes/24h" value={topic.votes_24h} active={topic.votes_24h > 0} />
          <SignalPill icon={MessageSquare} label="args/24h" value={topic.args_24h} active={topic.args_24h > 0} />
          <SignalPill icon={Activity} label="replies/24h" value={topic.replies_24h} active={topic.replies_24h > 0} />
          <SignalPill icon={Scale} label="controversy" value={topic.controversy} active={topic.controversy >= 60} />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Infographic legend ───────────────────────────────────────────────────────

function HeatLegend() {
  return (
    <details className="group rounded-xl border border-surface-300 bg-surface-100">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none text-xs text-surface-500 hover:text-white transition-colors">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">How is heat calculated?</span>
        <ChevronRight className="h-3.5 w-3.5 ml-auto transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-surface-300">
        <p className="text-xs text-surface-500 leading-relaxed">
          Each debate gets a composite score from four live signals, all measured over
          the <strong className="text-surface-300">last 24 hours</strong>:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { icon: ThumbsUp,       pct: '40%', label: 'Vote Velocity',   desc: 'New votes cast in 24 h (log-scaled)' },
            { icon: MessageSquare,  pct: '25%', label: 'Argument Burst',  desc: 'New arguments posted in 24 h' },
            { icon: Activity,       pct: '15%', label: 'Reply Surge',     desc: 'New argument replies in 24 h' },
            { icon: Scale,          pct: '20%', label: 'Controversy',     desc: 'How close the vote is to 50/50' },
          ].map(({ icon: Icon, pct, label, desc }) => (
            <div key={label} className="flex items-start gap-2 text-xs">
              <Icon className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
              <span>
                <span className="text-for-300 font-mono font-semibold">{pct}</span>
                {' — '}
                <span className="text-surface-300 font-medium">{label}</span>
                {': '}
                <span className="text-surface-500">{desc}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1 pt-1">
          {Object.entries(HEAT_CFG).map(([level, cfg]) => (
            <div key={level} className={cn('rounded-lg px-2 py-1.5 border text-center', cfg.bg, cfg.border)}>
              <div className="text-base leading-none mb-0.5">{cfg.emoji}</div>
              <div className={cn('text-[10px] font-mono font-bold leading-none', cfg.color)}>{cfg.label}</div>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HeatClient() {
  const [data, setData] = useState<HeatResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/stats/heat?${params}`)
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category])

  // Initial load + reload when filter changes
  useEffect(() => {
    setLoading(true)
    setData(null)
    load()
  }, [load])

  // Refresh every 60 s
  useEffect(() => {
    pollingRef.current = setInterval(() => load(), 60_000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [load])

  const topics = data?.topics ?? []

  // Split into levels for visual grouping
  const inferno  = topics.filter((t) => t.heat_level === 'inferno')
  const blazing  = topics.filter((t) => t.heat_level === 'blazing')
  const heating  = topics.filter((t) => t.heat_level === 'heating')
  const rest     = topics.filter((t) => t.heat_level === 'warm' || t.heat_level === 'cool')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-14">
        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-against-500/15 border border-against-500/30 flex items-center justify-center text-xl">
              🔥
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Civic Heat Index</h1>
              <p className="text-xs text-surface-500 font-mono">
                {data
                  ? `avg heat ${data.avg_heat} · hottest: ${data.hottest_category ?? '—'} · updated ${new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'loading heat data…'}
              </p>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh heat data"
              className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <p className="text-sm text-surface-500 leading-relaxed">
            Live temperature for every debate — combining vote velocity, argument bursts,
            reply surges, and controversy level over the last 24 hours.
          </p>
        </div>

        {/* ── How it works legend ── */}
        <div className="mb-5">
          <HeatLegend />
        </div>

        {/* ── Category filter ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {[null, ...CATEGORIES].map((cat) => (
            <button
              key={cat ?? 'all'}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-all',
                category === cat
                  ? 'bg-for-500/20 text-for-300 border-for-500/50'
                  : 'bg-surface-200 text-surface-500 border-surface-400 hover:border-surface-300 hover:text-surface-300'
              )}
            >
              {cat ?? 'All Categories'}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <HeatSkeleton />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No active debates"
            description={
              category
                ? `No ${category} topics are currently active. Try a different category.`
                : 'There are no active or voting topics right now.'
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Inferno tier */}
            {inferno.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-against-400 tracking-widest uppercase font-mono">
                    🔥 Inferno
                  </span>
                  <span className="text-xs text-surface-500 font-mono">heat ≥ 90</span>
                  <div className="flex-1 h-px bg-against-500/30" />
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {inferno.map((t, i) => (
                      <HeatTopicCard key={t.id} topic={t} rank={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Blazing tier */}
            {blazing.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-gold tracking-widest uppercase font-mono">
                    🌡️ Blazing
                  </span>
                  <span className="text-xs text-surface-500 font-mono">heat 70–89</span>
                  <div className="flex-1 h-px bg-gold/30" />
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {blazing.map((t, i) => (
                      <HeatTopicCard key={t.id} topic={t} rank={inferno.length + i} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Heating tier */}
            {heating.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-for-300 tracking-widest uppercase font-mono">
                    ⚡ Heating
                  </span>
                  <span className="text-xs text-surface-500 font-mono">heat 45–69</span>
                  <div className="flex-1 h-px bg-for-500/30" />
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {heating.map((t, i) => (
                      <HeatTopicCard
                        key={t.id}
                        topic={t}
                        rank={inferno.length + blazing.length + i}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Warm + Cool combined */}
            {rest.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-surface-500 tracking-widest uppercase font-mono">
                    Warm / Cool
                  </span>
                  <span className="text-xs text-surface-500 font-mono">heat &lt; 45</span>
                  <div className="flex-1 h-px bg-surface-400/30" />
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {rest.map((t, i) => (
                      <HeatTopicCard
                        key={t.id}
                        topic={t}
                        rank={inferno.length + blazing.length + heating.length + i}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Footer links ── */}
        {!loading && topics.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3 text-xs text-surface-500">
            <Link href="/velocity" className="flex items-center gap-1 hover:text-for-400 transition-colors">
              <Activity className="h-3 w-3" />
              Vote Velocity
            </Link>
            <Link href="/hotspot" className="flex items-center gap-1 hover:text-for-400 transition-colors">
              <Zap className="h-3 w-3" />
              Hotspot
            </Link>
            <Link href="/surge" className="flex items-center gap-1 hover:text-for-400 transition-colors">
              <TrendingUp className="h-3 w-3" />
              Surge
            </Link>
            <Link href="/convergence" className="flex items-center gap-1 hover:text-for-400 transition-colors">
              <Scale className="h-3 w-3" />
              Convergence
            </Link>
            <Link href="/radar" className="flex items-center gap-1 hover:text-for-400 transition-colors">
              <Loader2 className="h-3 w-3" />
              Radar
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
