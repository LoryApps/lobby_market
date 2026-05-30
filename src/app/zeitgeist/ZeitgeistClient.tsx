'use client'

/**
 * /zeitgeist — The Civic Zeitgeist
 *
 * A platform-wide mood board: consensus strength, category temperatures,
 * momentum leaders, and the week's civic activity. A single-page answer
 * to "what's the spirit of the Lobby right now?"
 *
 * Distinct from:
 *   /drift     — category FOR% change over time windows
 *   /pulse     — live argument stream
 *   /today     — raw daily stats
 *   /momentum  — vote velocity per topic
 *   /polarization — division metrics
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Cpu,
  DollarSign,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lightbulb,
  MessageSquare,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ZeitgeistResponse,
  ZeitgeistCategoryMood,
  ZeitgeistMomentumTopic,
} from '@/app/api/zeitgeist/route'

// ─── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   DollarSign,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Lightbulb,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-purple',
  Culture:     'text-against-400',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-gold',
}

const CATEGORY_BG: Record<string, string> = {
  Economics:   'bg-gold/10',
  Politics:    'bg-for-500/10',
  Technology:  'bg-purple/10',
  Science:     'bg-emerald/10',
  Ethics:      'bg-for-400/10',
  Philosophy:  'bg-purple/10',
  Culture:     'bg-against-500/10',
  Health:      'bg-emerald/10',
  Environment: 'bg-emerald/10',
  Education:   'bg-gold/10',
}

const MOOD_STYLES: Record<
  string,
  { ring: string; glow: string; badge: string; text: string; bar: string }
> = {
  blue: {
    ring: 'ring-for-500/50',
    glow: 'bg-for-500/8',
    badge: 'bg-for-500/20 text-for-300 border-for-500/40',
    text: 'text-for-300',
    bar: 'bg-for-500',
  },
  red: {
    ring: 'ring-against-500/50',
    glow: 'bg-against-500/8',
    badge: 'bg-against-500/20 text-against-300 border-against-500/40',
    text: 'text-against-300',
    bar: 'bg-against-500',
  },
  purple: {
    ring: 'ring-purple/50',
    glow: 'bg-purple/8',
    badge: 'bg-purple/20 text-purple border-purple/40',
    text: 'text-purple',
    bar: 'bg-purple',
  },
  gold: {
    ring: 'ring-gold/50',
    glow: 'bg-gold/8',
    badge: 'bg-gold/20 text-gold border-gold/40',
    text: 'text-gold',
    bar: 'bg-gold',
  },
  emerald: {
    ring: 'ring-emerald/50',
    glow: 'bg-emerald/8',
    badge: 'bg-emerald/20 text-emerald border-emerald/40',
    text: 'text-emerald',
    bar: 'bg-emerald',
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ConsensusGauge({ index, forPct }: { index: number; forPct: number }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Arc-style gauge */}
      <div className="relative w-40 h-20">
        <svg width="160" height="80" viewBox="0 0 160 80" className="overflow-visible">
          {/* Background arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="#1e2130"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Filled arc — consensus strength */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={index >= 60 ? '#10b981' : index >= 40 ? '#c9a84c' : '#a855f7'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(index / 100) * 220} 220`}
            style={{ transition: 'stroke-dasharray 1s ease-out' }}
          />
          {/* Needle */}
          <line
            x1="80" y1="80"
            x2={80 + 55 * Math.cos(Math.PI - (index / 100) * Math.PI)}
            y2={80 - 55 * Math.sin((index / 100) * Math.PI)}
            stroke="#e2e8f0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="80" cy="80" r="5" fill="#1e2130" stroke="#e2e8f0" strokeWidth="2" />
        </svg>
        {/* Center label */}
        <div className="absolute inset-x-0 -bottom-1 flex flex-col items-center">
          <span className="text-2xl font-mono font-bold text-white">{index}</span>
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">consensus</span>
        </div>
      </div>

      {/* FOR / AGAINST split */}
      <div className="w-full">
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="text-for-400 font-semibold">FOR {forPct}%</span>
          <span className="text-against-400 font-semibold">{100 - forPct}% AGAINST</span>
        </div>
        <div className="h-2 bg-surface-300 rounded-full overflow-hidden flex">
          <div
            className="bg-for-500 h-full rounded-l-full transition-all duration-700"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="bg-against-500 h-full rounded-r-full transition-all duration-700"
            style={{ width: `${100 - forPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function CategoryMoodRow({ mood }: { mood: ZeitgeistCategoryMood }) {
  const Icon = CATEGORY_ICONS[mood.category] ?? Scale
  const iconColor = CATEGORY_COLOR[mood.category] ?? 'text-surface-500'
  const iconBg = CATEGORY_BG[mood.category] ?? 'bg-surface-300/40'

  const TrendIcon = mood.trend === 'rising' ? ArrowUp
    : mood.trend === 'falling' ? ArrowDown
    : Minus

  const trendColor = mood.trend === 'rising' ? 'text-for-400'
    : mood.trend === 'falling' ? 'text-against-400'
    : 'text-surface-500'

  const barColor = mood.blue_pct >= 55 ? 'bg-for-500'
    : mood.blue_pct <= 45 ? 'bg-against-500'
    : 'bg-purple'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/40 transition-colors">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-white truncate">{mood.category}</span>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <TrendIcon className={cn('h-3 w-3', trendColor)} aria-hidden="true" />
            <span className="text-xs font-mono text-white tabular-nums">
              {mood.blue_pct}%
            </span>
          </div>
        </div>
        {/* Bar */}
        <div className="h-1.5 bg-surface-400/50 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${mood.blue_pct}%` }}
          />
        </div>
      </div>

      <span className="text-[11px] font-mono text-surface-500 flex-shrink-0 w-10 text-right tabular-nums">
        {mood.topic_count}t
      </span>
    </div>
  )
}

function MomentumCard({ topic }: { topic: ZeitgeistMomentumTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const badgeVariant: 'active' | 'law' | 'proposed' =
    topic.status === 'law' ? 'law' : topic.status === 'proposed' ? 'proposed' : 'active'
  const statusLabel =
    topic.status === 'voting' ? 'VOTING' : topic.status === 'law' ? 'LAW' : 'ACTIVE'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex flex-col gap-2 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 flex-1">
          {topic.statement}
        </p>
        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0 mt-0.5" aria-hidden="true" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {topic.category && (
            <span className="text-[11px] font-mono text-surface-500">{topic.category}</span>
          )}
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
        </div>
        <span className="text-[11px] font-mono text-surface-500 flex-shrink-0 tabular-nums">
          {fmt(topic.total_votes)} votes
        </span>
      </div>

      {/* Vote bar */}
      <div className="flex items-center gap-2">
        <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 h-1.5 bg-surface-400/50 rounded-full overflow-hidden flex">
          <div className="bg-for-500 h-full rounded-l-full transition-all" style={{ width: `${forPct}%` }} />
          <div className="bg-against-500 h-full rounded-r-full transition-all" style={{ width: `${againstPct}%` }} />
        </div>
        <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-mono text-for-400 tabular-nums w-7 text-right">{forPct}%</span>
      </div>
    </Link>
  )
}

type StatColor = 'for' | 'purple' | 'gold' | 'emerald'

const STAT_COLORS: Record<StatColor, { bg: string; text: string }> = {
  for:     { bg: 'bg-for-500/10',     text: 'text-for-400'  },
  purple:  { bg: 'bg-purple/10',      text: 'text-purple'   },
  gold:    { bg: 'bg-gold/10',        text: 'text-gold'     },
  emerald: { bg: 'bg-emerald/10',     text: 'text-emerald'  },
}

function StatCell({ value, label, icon: Icon, color }: {
  value: number
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: StatColor
}) {
  const { bg, text } = STAT_COLORS[color]
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-surface-200/40 border border-surface-300/40">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', bg)}>
        <Icon className={cn('h-4 w-4', text)} aria-hidden="true" />
      </div>
      <span className="text-xl font-mono font-bold text-white tabular-nums">{fmt(value)}</span>
      <span className="text-[10px] font-mono text-surface-500 text-center uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function ZeitgeistSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex justify-center">
          <Skeleton className="h-32 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ZeitgeistClient() {
  const [data, setData] = useState<ZeitgeistResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const refreshingRef = useRef(false)

  const load = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/zeitgeist', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as ZeitgeistResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      refreshingRef.current = false
    }
  }, [])

  useEffect(() => { load() }, [load])

  const moodStyle = data ? (MOOD_STYLES[data.mood_color] ?? MOOD_STYLES.purple) : MOOD_STYLES.purple

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Sparkles className="h-5 w-5 text-purple" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Zeitgeist</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">The spirit of the Lobby — right now</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh zeitgeist"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 border border-surface-300/60 hover:border-surface-400/60 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ZeitgeistSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Activity}
                title="Unable to load zeitgeist"
                description="Could not read civic data right now. Try refreshing."
                actions={[{ label: 'Try again', onClick: load }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* ── Mood card ─────────────────────────────────────── */}
              <section
                aria-label="Platform mood"
                className={cn(
                  'relative rounded-2xl bg-surface-100 border p-6 overflow-hidden',
                  moodStyle.ring,
                  'ring-1'
                )}
              >
                {/* Ambient glow */}
                <div className={cn('absolute inset-0 pointer-events-none', moodStyle.glow)} />

                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  {/* Gauge */}
                  <div className="flex-shrink-0 w-52">
                    <ConsensusGauge
                      index={data.consensus_index}
                      forPct={data.platform_for_pct}
                    />
                  </div>

                  {/* Mood text */}
                  <div className="flex-1 text-center md:text-left">
                    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider mb-3', moodStyle.badge)}>
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {data.mood_label}
                    </div>
                    <p className="text-sm text-surface-300 leading-relaxed">
                      {data.mood_description}
                    </p>
                    <p className="text-xs font-mono text-surface-500 mt-3">
                      Updated {relativeTime(data.generated_at)}
                    </p>
                  </div>
                </div>
              </section>

              {/* ── Weekly stats ──────────────────────────────────── */}
              <section aria-label="This week's activity">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  This Week
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCell
                    value={data.weekly_stats.votes_cast}
                    label="Votes cast"
                    icon={Vote}
                    color="for"
                  />
                  <StatCell
                    value={data.weekly_stats.arguments_made}
                    label="Arguments"
                    icon={MessageSquare}
                    color="purple"
                  />
                  <StatCell
                    value={data.weekly_stats.laws_passed}
                    label="Laws passed"
                    icon={Gavel}
                    color="gold"
                  />
                  <StatCell
                    value={data.weekly_stats.new_topics}
                    label="New topics"
                    icon={Zap}
                    color="emerald"
                  />
                </div>
              </section>

              {/* ── Category temperatures ─────────────────────────── */}
              <section aria-label="Category mood temperatures">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Category Temperatures
                  </h2>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
                    <span className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3 text-for-400" aria-hidden="true" />
                      FOR-leaning
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowDown className="h-3 w-3 text-against-400" aria-hidden="true" />
                      AGAINST-leaning
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.category_moods
                    .filter((m) => m.topic_count > 0)
                    .sort((a, b) => b.blue_pct - a.blue_pct)
                    .map((mood) => (
                      <CategoryMoodRow
                        key={mood.category}
                        mood={mood}
                      />
                    ))}
                  {data.category_moods.filter((m) => m.topic_count === 0).length > 0 && (
                    <p className="text-xs font-mono text-surface-600 text-center py-2">
                      {data.category_moods.filter((m) => m.topic_count === 0).length} categories have no active topics
                    </p>
                  )}
                </div>
              </section>

              {/* ── Momentum leaders ─────────────────────────────── */}
              {data.momentum_topics.length > 0 && (
                <section aria-label="Momentum leaders">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      Gaining Momentum
                    </h2>
                    <Link
                      href="/trending"
                      className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      See all <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.momentum_topics.map((topic) => (
                      <MomentumCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Related links ─────────────────────────────────── */}
              <section aria-label="Related views">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Dig Deeper
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { href: '/drift', label: 'Opinion Drift', icon: TrendingUp },
                    { href: '/polarization', label: 'Polarisation', icon: BarChart2 },
                    { href: '/flux', label: 'Civic Flux', icon: Activity },
                    { href: '/convergence', label: 'Convergence', icon: Scale },
                    { href: '/pulse', label: 'Live Pulse', icon: Zap },
                    { href: '/heatmap', label: 'Heat Map', icon: Sparkles },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/40 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-surface-500" aria-hidden="true" />
                      <span className="text-xs font-mono text-surface-300 hover:text-white transition-colors">
                        {label}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
