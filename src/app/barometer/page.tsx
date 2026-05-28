'use client'

/**
 * /barometer — The Civic Barometer
 *
 * A platform-wide sentiment gauge showing the collective civic mood:
 * where does the community stand overall, and how is it shifting?
 *
 * Distinct from:
 *   /vitals        — discourse quality (argument grades, deliberation depth)
 *   /pulse         — activity levels (votes/hour, active users)
 *   /polarization  — division levels per topic (not overall platform sentiment)
 *   /drift         — category-level FOR% vs baseline over time
 *   /spectrum      — 2D scatter of every topic (not an aggregated dial)
 *   /today         — daily platform stats (not a sentiment reading)
 *
 * The Barometer answers: "Right now, is the Lobby more FOR or AGAINST —
 * and which areas of civic life are driving that?"
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
  Cpu,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BarometerReading, CategoryBar } from '@/app/api/barometer/route'

// ─── Category icons ────────────────────────────────────────────────────────────

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics:    Landmark,
  Economics:   TrendingUp,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Sparkles,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

function catColor(cat: string) {
  return CAT_COLOR[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
}

function catIcon(cat: string) {
  return CAT_ICON[cat] ?? BarChart2
}

// ─── Mood config ───────────────────────────────────────────────────────────────

interface MoodConfig {
  label: string
  color: string
  bgGlow: string
  icon: typeof ThumbsUp
  description: string
}

const MOOD_CONFIG: Record<BarometerReading['mood'], MoodConfig> = {
  strongly_for:     { label: 'Strong FOR Majority', color: 'text-for-300',     bgGlow: 'shadow-for-500/20',     icon: ThumbsUp,   description: 'The Lobby is decisively leaning FOR across active debates.' },
  leaning_for:      { label: 'Leaning FOR',          color: 'text-for-400',     bgGlow: 'shadow-for-500/10',     icon: ThumbsUp,   description: 'A moderate FOR advantage across the platform.' },
  balanced:         { label: 'Divided & Balanced',   color: 'text-surface-300', bgGlow: 'shadow-surface-500/10', icon: Scale,      description: 'The Lobby is almost evenly split. Debate is open.' },
  leaning_against:  { label: 'Leaning AGAINST',      color: 'text-against-400', bgGlow: 'shadow-against-500/10', icon: ThumbsDown, description: 'A moderate AGAINST advantage across the platform.' },
  strongly_against: { label: 'Strong AGAINST Majority', color: 'text-against-300', bgGlow: 'shadow-against-500/20', icon: ThumbsDown, description: 'The Lobby is decisively leaning AGAINST across active debates.' },
}

// ─── Needle dial component ────────────────────────────────────────────────────

function BarometerDial({ pct, mood }: { pct: number; mood: BarometerReading['mood'] }) {
  const needleAngle = ((pct - 50) / 50) * 85  // −85° to +85° from center
  const cfg = MOOD_CONFIG[mood]

  const isFor     = mood === 'strongly_for' || mood === 'leaning_for'
  const isAgainst = mood === 'strongly_against' || mood === 'leaning_against'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Dial arc */}
      <div className="relative w-64 h-32 overflow-hidden">
        <svg viewBox="0 0 256 128" className="w-full h-full" aria-hidden="true">
          {/* Background arc segments */}
          {/* AGAINST zone (left) */}
          <path
            d="M 20 128 A 108 108 0 0 1 128 20"
            fill="none" stroke="currentColor"
            strokeWidth="20" strokeLinecap="round"
            className="text-against-900/60"
          />
          {/* Neutral zone (center) */}
          <path
            d="M 98 21.5 A 108 108 0 0 1 158 21.5"
            fill="none" stroke="currentColor"
            strokeWidth="20" strokeLinecap="round"
            className="text-surface-300/40"
          />
          {/* FOR zone (right) */}
          <path
            d="M 128 20 A 108 108 0 0 1 236 128"
            fill="none" stroke="currentColor"
            strokeWidth="20" strokeLinecap="round"
            className="text-for-900/60"
          />

          {/* Labels */}
          <text x="16" y="118" fontSize="10" className="fill-against-400 font-mono" fontFamily="monospace">AGN</text>
          <text x="113" y="14" fontSize="10" className="fill-surface-500 font-mono" fontFamily="monospace" textAnchor="middle">50/50</text>
          <text x="236" y="118" fontSize="10" className="fill-for-400 font-mono" fontFamily="monospace" textAnchor="end">FOR</text>

          {/* Active arc */}
          <motion.path
            d={pct >= 50
              ? `M 128 20 A 108 108 0 0 1 ${128 + 108 * Math.sin((needleAngle * Math.PI) / 180)} ${128 - 108 * Math.cos((needleAngle * Math.PI) / 180)}`
              : `M ${128 + 108 * Math.sin((needleAngle * Math.PI) / 180)} ${128 - 108 * Math.cos((needleAngle * Math.PI) / 180)} A 108 108 0 0 1 128 20`
            }
            fill="none"
            strokeWidth="20"
            strokeLinecap="round"
            className={isFor ? 'stroke-for-500/60' : isAgainst ? 'stroke-against-500/60' : 'stroke-surface-400/40'}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          {/* Needle */}
          <motion.line
            x1="128" y1="128"
            x2="128" y2="30"
            strokeWidth="3"
            strokeLinecap="round"
            className={cn(
              isFor ? 'stroke-for-400' : isAgainst ? 'stroke-against-400' : 'stroke-surface-300',
            )}
            style={{ transformOrigin: '128px 128px' }}
            initial={{ rotate: 0 }}
            animate={{ rotate: needleAngle }}
            transition={{ duration: 1.2, ease: 'easeOut', type: 'spring', stiffness: 80, damping: 20 }}
          />

          {/* Center pivot */}
          <circle cx="128" cy="128" r="8"
            className={isFor ? 'fill-for-500' : isAgainst ? 'fill-against-500' : 'fill-surface-400'} />
          <circle cx="128" cy="128" r="4" className="fill-surface-50" />
        </svg>
      </div>

      {/* Reading */}
      <div className="text-center">
        <motion.p
          className={cn('font-mono text-5xl font-bold tabular-nums', cfg.color)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {Math.round(pct)}%
        </motion.p>
        <p className="text-xs font-mono text-surface-500 mt-1">FOR across active debates</p>
      </div>
    </div>
  )
}

// ─── Category bar card ─────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryBar }) {
  const cc = catColor(cat.category)
  const Icon = catIcon(cat.category)
  const forPct = Math.round(cat.avg_blue_pct)
  const againstPct = 100 - forPct

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition-colors hover:border-surface-400',
      'bg-surface-100 border-surface-300',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0', cc.bg, cc.border)}>
            <Icon className={cn('h-4 w-4', cc.text)} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-white truncate">{cat.category}</p>
            <p className="font-mono text-xs text-surface-500">
              {cat.active_topics} active · {cat.total_votes.toLocaleString()} votes
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className={cn(
            'font-mono text-sm font-bold',
            cat.mood === 'for' ? 'text-for-400' : cat.mood === 'against' ? 'text-against-400' : 'text-surface-300',
          )}>
            {forPct}% FOR
          </p>
          {cat.law_rate > 0 && (
            <p className="font-mono text-xs text-gold">{cat.law_rate}% pass rate</p>
          )}
        </div>
      </div>

      {/* Vote bar */}
      <div className="h-2.5 rounded-full bg-surface-300 overflow-hidden">
        <div className="flex h-full">
          <motion.div
            className="h-full bg-for-500 rounded-l-full"
            style={{ width: `${forPct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-against-600"
            style={{ width: `${againstPct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${againstPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-surface-500">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BarometerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col items-center gap-4 py-8">
        <Skeleton className="h-32 w-64 rounded-2xl" />
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BarometerPage() {
  const [data, setData] = useState<BarometerReading | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/barometer', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: BarometerReading = await res.json()
      if (mountedRef.current) setData(json)
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  const mood = data ? MOOD_CONFIG[data.mood] : null
  const MoodIcon = mood?.icon ?? Scale

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Activity className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Barometer</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">Platform-wide sentiment reading</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40 mt-1"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <BarometerSkeleton />
        ) : error ? (
          <EmptyState
            icon={Activity}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Reading unavailable"
            description="Could not compute the barometer reading. Try refreshing."
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="barometer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Main dial card */}
              <div className={cn(
                'rounded-3xl border bg-surface-100 border-surface-300 p-6',
                'flex flex-col items-center gap-5',
              )}>
                <BarometerDial pct={data.overall_blue_pct} mood={data.mood} />

                {/* Mood label */}
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <MoodIcon className={cn('h-4 w-4', mood?.color)} />
                    <p className={cn('font-mono text-base font-bold', mood?.color)}>
                      {data.mood_label}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-surface-500 max-w-xs">
                    {mood?.description}
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 w-full border-t border-surface-300 pt-4">
                  <div className="text-center">
                    <p className="font-mono text-sm font-bold text-white">
                      {data.active_topics.toLocaleString()}
                    </p>
                    <p className="font-mono text-xs text-surface-500">Active topics</p>
                  </div>
                  <div className="text-center border-x border-surface-300">
                    <p className="font-mono text-sm font-bold text-white">
                      {data.total_active_votes.toLocaleString()}
                    </p>
                    <p className="font-mono text-xs text-surface-500">Votes cast</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {data.drift_24h === null ? (
                        <Minus className="h-3.5 w-3.5 text-surface-500" />
                      ) : data.drift_24h > 0 ? (
                        <ArrowUp className="h-3.5 w-3.5 text-for-400" />
                      ) : data.drift_24h < 0 ? (
                        <ArrowDown className="h-3.5 w-3.5 text-against-400" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-surface-500" />
                      )}
                      <p className={cn(
                        'font-mono text-sm font-bold',
                        data.drift_24h === null || data.drift_24h === 0
                          ? 'text-surface-300'
                          : data.drift_24h > 0 ? 'text-for-400' : 'text-against-400',
                      )}>
                        {data.drift_24h === null
                          ? 'N/A'
                          : data.drift_24h === 0
                          ? '±0'
                          : `${data.drift_24h > 0 ? '+' : ''}${data.drift_24h}%`}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-surface-500">24h drift</p>
                  </div>
                </div>
              </div>

              {/* Platform resolution stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Gavel className="h-3.5 w-3.5 text-gold" />
                    <p className="font-mono text-lg font-bold text-white">{data.total_laws.toLocaleString()}</p>
                  </div>
                  <p className="font-mono text-xs text-surface-500">Laws passed</p>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                  <p className="font-mono text-lg font-bold text-against-400 mb-1">{data.total_failed.toLocaleString()}</p>
                  <p className="font-mono text-xs text-surface-500">Topics failed</p>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                  <p className="font-mono text-lg font-bold text-emerald mb-1">{data.law_rate}%</p>
                  <p className="font-mono text-xs text-surface-500">Pass rate</p>
                </div>
              </div>

              {/* Category breakdown */}
              {data.categories.length > 0 && (
                <div>
                  <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-widest mb-3">
                    Category Sentiment
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.categories.map((cat) => (
                      <CategoryCard key={cat.category} cat={cat} />
                    ))}
                  </div>
                </div>
              )}

              {/* Extremes */}
              {(data.most_for_topic || data.most_against_topic || data.most_balanced_topic) && (
                <div>
                  <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-widest mb-3">
                    Notable Positions
                  </h2>
                  <div className="space-y-2">
                    {data.most_for_topic && (
                      <Link
                        href={`/topic/${data.most_for_topic.id}`}
                        className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0 mt-0.5">
                          <ThumbsUp className="h-4 w-4 text-for-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-for-400 mb-0.5">Most FOR</p>
                          <p className="font-mono text-sm text-white truncate">{data.most_for_topic.statement}</p>
                          {data.most_for_topic.category && (
                            <p className="font-mono text-xs text-surface-500 mt-0.5">{data.most_for_topic.category}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-mono text-sm font-bold text-for-400">
                            {Math.round(data.most_for_topic.blue_pct)}%
                          </p>
                          <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-for-400 transition-colors ml-auto mt-1" />
                        </div>
                      </Link>
                    )}

                    {data.most_against_topic && (
                      <Link
                        href={`/topic/${data.most_against_topic.id}`}
                        className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-against-500/40 hover:bg-against-500/5 transition-colors group"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/30 flex-shrink-0 mt-0.5">
                          <ThumbsDown className="h-4 w-4 text-against-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-against-400 mb-0.5">Most AGAINST</p>
                          <p className="font-mono text-sm text-white truncate">{data.most_against_topic.statement}</p>
                          {data.most_against_topic.category && (
                            <p className="font-mono text-xs text-surface-500 mt-0.5">{data.most_against_topic.category}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-mono text-sm font-bold text-against-400">
                            {Math.round(100 - data.most_against_topic.blue_pct)}%
                          </p>
                          <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-against-400 transition-colors ml-auto mt-1" />
                        </div>
                      </Link>
                    )}

                    {data.most_balanced_topic && (
                      <Link
                        href={`/topic/${data.most_balanced_topic.id}`}
                        className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0 mt-0.5">
                          <Scale className="h-4 w-4 text-surface-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-surface-400 mb-0.5">Most Balanced</p>
                          <p className="font-mono text-sm text-white truncate">{data.most_balanced_topic.statement}</p>
                          {data.most_balanced_topic.category && (
                            <p className="font-mono text-xs text-surface-500 mt-0.5">{data.most_balanced_topic.category}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-mono text-sm font-bold text-surface-300">
                            {Math.round(data.most_balanced_topic.blue_pct)}%
                          </p>
                          <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-white transition-colors ml-auto mt-1" />
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Explore more */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { href: '/polarization', label: 'Polarization', icon: Zap, color: 'text-against-400' },
                  { href: '/drift',        label: 'Opinion Drift', icon: ArrowUp, color: 'text-for-400' },
                  { href: '/vitals',       label: 'Discourse Health', icon: Activity, color: 'text-emerald' },
                  { href: '/convergence',  label: 'Convergence', icon: ArrowRight, color: 'text-purple' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                    <span className="font-mono text-xs text-surface-300 group-hover:text-white">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Timestamp */}
              <p className="font-mono text-xs text-surface-600 text-center">
                Reading computed at {new Date(data.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
