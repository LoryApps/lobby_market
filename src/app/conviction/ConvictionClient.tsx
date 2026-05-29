'use client'

/**
 * /conviction — The Civic Conviction Tracker
 *
 * Shows how ideologically consistent you are per debate category.
 * A high conviction score means you reliably vote the same direction within
 * a category. A low score means you're a genuine independent thinker there.
 *
 * Distinct from:
 *   /analytics     — overall voting stats
 *   /fingerprint   — your full ideological profile
 *   /compass       — ideological positioning on a 2-axis map
 *   /resonance     — cross-partisan upvote appeal
 *   /blindspots    — topics you're avoiding
 *
 * Conviction specifically answers: "Where have you made up your mind —
 * and where do you still genuinely weigh each debate on its merits?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  DollarSign,
  Flame,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Shield,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type {
  ConvictionResponse,
  CategoryConviction,
} from '@/app/api/conviction/route'

// ─── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   DollarSign,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CATEGORY_COLOR: Record<string, { text: string; fill: string; border: string; bg: string }> = {
  Economics:   { text: 'text-gold',        fill: 'bg-gold',        border: 'border-gold/40',        bg: 'bg-gold/8'        },
  Politics:    { text: 'text-for-400',     fill: 'bg-for-500',     border: 'border-for-500/40',     bg: 'bg-for-500/8'     },
  Technology:  { text: 'text-purple',      fill: 'bg-purple',      border: 'border-purple/40',      bg: 'bg-purple/8'      },
  Science:     { text: 'text-emerald',     fill: 'bg-emerald',     border: 'border-emerald/40',     bg: 'bg-emerald/8'     },
  Ethics:      { text: 'text-against-400', fill: 'bg-against-500', border: 'border-against-500/40', bg: 'bg-against-500/8' },
  Philosophy:  { text: 'text-for-300',     fill: 'bg-for-400',     border: 'border-for-400/40',     bg: 'bg-for-400/8'     },
  Culture:     { text: 'text-gold',        fill: 'bg-gold',        border: 'border-gold/40',        bg: 'bg-gold/8'        },
  Health:      { text: 'text-emerald',     fill: 'bg-emerald',     border: 'border-emerald/40',     bg: 'bg-emerald/8'     },
  Environment: { text: 'text-emerald',     fill: 'bg-emerald',     border: 'border-emerald/40',     bg: 'bg-emerald/8'     },
  Education:   { text: 'text-purple',      fill: 'bg-purple',      border: 'border-purple/40',      bg: 'bg-purple/8'      },
}

function catStyle(cat: string) {
  return CATEGORY_COLOR[cat] ?? {
    text: 'text-surface-400',
    fill: 'bg-surface-500',
    border: 'border-surface-400/40',
    bg: 'bg-surface-300/10',
  }
}

function CatIcon({ cat, className }: { cat: string; className?: string }) {
  const Icon = CATEGORY_ICON[cat] ?? Globe
  return <Icon className={className} />
}

// ─── Conviction label config ───────────────────────────────────────────────────

const LABEL_CONFIG: Record<string, {
  color: string
  bg: string
  border: string
  icon: typeof Shield
}> = {
  'Steadfast':   { color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: Flame   },
  'Principled':  { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: Target  },
  'Independent': { color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Scale   },
  'Fluid':       { color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      icon: TrendingUp },
  'No data':     { color: 'text-surface-500', bg: 'bg-surface-200',    border: 'border-surface-300',    icon: Vote    },
}

function labelConfig(label: string) {
  return LABEL_CONFIG[label] ?? LABEL_CONFIG['Independent']
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = 'text-white',
  sub,
}: {
  label: string
  value: string | number
  color?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">{label}</span>
      <span className={cn('text-xl font-mono font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// Circular gauge SVG
function ConvictionGauge({ score, color }: { score: number; color: string }) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const arc = (score / 100) * circumference

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
      {/* Track */}
      <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-300/40" />
      {/* Fill */}
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference}`}
        transform="rotate(-90 40 40)"
        className={color}
      />
      {/* Score text */}
      <text x="40" y="44" textAnchor="middle" className={cn('font-mono font-black text-sm fill-current', color)} fontSize="14">
        {score}
      </text>
    </svg>
  )
}

// Category conviction row
function CategoryRow({ cat, index }: { cat: CategoryConviction; index: number }) {
  const cs = catStyle(cat.category)
  const barFill = Math.max(4, cat.convictionScore)
  const barColor = cat.stronghold ? cs.fill : cat.swing ? 'bg-surface-400/60' : cs.fill

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn(
        'rounded-xl border p-3.5 transition-colors',
        cat.stronghold ? cn(cs.bg, cs.border) : 'bg-surface-100 border-surface-300/60',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', cs.bg, cs.border)}>
          <CatIcon cat={cat.category} className={cn('h-4 w-4', cs.text)} />
        </div>

        {/* Category + bars */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className={cn('text-sm font-mono font-semibold', cs.text)}>{cat.category}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {cat.stronghold && (
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-gold bg-gold/15 border border-gold/30 px-1.5 py-0.5 rounded-full">
                  Stronghold
                </span>
              )}
              {cat.swing && (
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-purple bg-purple/15 border border-purple/30 px-1.5 py-0.5 rounded-full">
                  Swing
                </span>
              )}
              <span className={cn('text-xs font-mono font-bold tabular-nums', cs.text)}>
                {cat.convictionScore}
              </span>
            </div>
          </div>

          {/* Conviction bar */}
          <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden mb-1.5">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${barFill}%` }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.03 + 0.1 }}
              style={{ opacity: 0.85 }}
            />
          </div>

          {/* FOR/AGAINST split */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-for-500 flex-shrink-0" />
              <span className="text-[11px] font-mono text-for-400 tabular-nums">{cat.bluePct}% FOR</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsDown className="h-3 w-3 text-against-500 flex-shrink-0" />
              <span className="text-[11px] font-mono text-against-400 tabular-nums">{100 - cat.bluePct}% AGN</span>
            </div>
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {cat.totalVotes} vote{cat.totalVotes !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Monthly sparkline
function MonthlySparkline({ data }: { data: ConvictionResponse['monthlyTrend'] }) {
  if (data.length < 2) return null

  const max = Math.max(...data.map((d) => d.conviction), 1)
  const w = 320
  const h = 48
  const pad = 4

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((d.conviction / max) * (h - pad * 2))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const trending = last.conviction > prev.conviction

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-surface-500" />
          <h3 className="text-sm font-mono font-bold text-white">Monthly Conviction</h3>
        </div>
        <span className={cn('text-xs font-mono font-semibold', trending ? 'text-emerald' : 'text-against-400')}>
          {trending ? '↑' : '↓'} {Math.abs(last.conviction - prev.conviction)}pts
        </span>
      </div>

      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        {/* Grid lines */}
        {[0, 50, 100].map((v) => (
          <line
            key={v}
            x1={pad}
            y1={h - pad - (v / 100) * (h - pad * 2)}
            x2={w - pad}
            y2={h - pad - (v / 100) * (h - pad * 2)}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-surface-300/30"
            strokeDasharray="3,3"
          />
        ))}

        {/* Line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-for-400"
          opacity="0.8"
        />

        {/* Dots */}
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2)
          const y = h - pad - ((d.conviction / max) * (h - pad * 2))
          const isLast = i === data.length - 1
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isLast ? 3.5 : 2}
              fill="currentColor"
              className={isLast ? 'text-for-400' : 'text-for-500/60'}
            />
          )
        })}
      </svg>

      {/* Month labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-surface-600">{fmtMonth(data[0].month)}</span>
        <span className="text-[9px] font-mono text-surface-600">{fmtMonth(data[data.length - 1].month)}</span>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
        </div>
        <div className="flex gap-6">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-24" />)}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ConvictionClient() {
  const router = useRouter()
  const [data, setData] = useState<ConvictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [sortBy, setSortBy] = useState<'votes' | 'conviction'>('votes')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/conviction', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: d }) => {
      if (!d.user) {
        router.replace('/login')
      } else {
        setIsLoggedIn(true)
        load()
      }
    })
  }, [load, router])

  const lc = data ? labelConfig(data.overall.label) : null
  const LabelIcon = lc?.icon ?? Vote

  const sortedCats = data
    ? [...data.categories].sort((a, b) =>
        sortBy === 'conviction'
          ? b.convictionScore - a.convictionScore
          : b.totalVotes - a.totalVotes,
      )
    : []

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-for-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12 flex flex-col gap-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white tracking-tight">
              Civic Conviction
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Where have you made up your mind?
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              'disabled:opacity-40',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && !data && <LoadingSkeleton />}

        {/* ── No votes empty state ─────────────────────────────────────────── */}
        {!loading && data && data.categories.length === 0 && (
          <EmptyState
            icon={Vote}
            title="No conviction data yet"
            description="Vote on at least a few topics across different categories to see your conviction profile."
            actions={[{ label: 'Explore debates', href: '/' }]}
          />
        )}

        {/* ── Main content ──────────────────────────────────────────────────── */}
        {data && data.categories.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-5"
            >

              {/* ── Overall conviction card ──────────────────────────────── */}
              {lc && (
                <div className={cn('rounded-2xl border p-5', lc.bg, lc.border)}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <LabelIcon className={cn('h-4 w-4', lc.color)} />
                        <span className={cn('text-xs font-mono font-bold uppercase tracking-widest', lc.color)}>
                          {data.overall.label}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={cn('font-mono text-5xl font-black tabular-nums', lc.color)}>
                          {data.overall.convictionScore}
                        </span>
                        <span className="text-surface-500 font-mono text-lg">/100</span>
                      </div>
                      <p className="text-xs font-mono text-surface-400 leading-relaxed max-w-sm">
                        {data.overall.description}
                      </p>
                    </div>
                    <ConvictionGauge score={data.overall.convictionScore} color={lc.color} />
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-6 pt-3 border-t border-surface-300/30">
                    <StatPill
                      label="Categories"
                      value={data.overall.totalVotedCategories}
                      sub="voted in"
                      color="text-white"
                    />
                    <StatPill
                      label="Strongholds"
                      value={data.overall.strongholds}
                      sub="≥75 score"
                      color="text-gold"
                    />
                    <StatPill
                      label="Swing zones"
                      value={data.overall.swings}
                      sub="<35 score"
                      color="text-purple"
                    />
                    <StatPill
                      label="Platform avg"
                      value={`${data.overall.platformAvg}`}
                      sub="conv. score"
                      color="text-surface-400"
                    />
                  </div>
                </div>
              )}

              {/* ── Spotlight: Stronghold + Swing ────────────────────────── */}
              {(data.topStronghold || data.topSwing) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.topStronghold && (() => {
                    const cs = catStyle(data.topStronghold.category)
                    return (
                      <div className={cn('rounded-xl border p-3.5', cs.bg, cs.border)}>
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="h-3.5 w-3.5 text-gold" />
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gold">
                            Strongest Conviction
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0', cs.bg, cs.border)}>
                            <CatIcon cat={data.topStronghold.category} className={cn('h-3.5 w-3.5', cs.text)} />
                          </div>
                          <div>
                            <p className={cn('text-sm font-mono font-bold', cs.text)}>
                              {data.topStronghold.category}
                            </p>
                            <p className="text-[11px] font-mono text-surface-500">
                              {data.topStronghold.convictionScore}/100 · {' '}
                              {data.topStronghold.dominantSide === 'blue' ? 'Mostly FOR' :
                               data.topStronghold.dominantSide === 'red' ? 'Mostly AGAINST' : 'Balanced'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {data.topSwing && (() => {
                    const cs = catStyle(data.topSwing.category)
                    return (
                      <div className="rounded-xl border border-purple/30 bg-purple/5 p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <Scale className="h-3.5 w-3.5 text-purple" />
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple">
                            Most Independent
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0', cs.bg, cs.border)}>
                            <CatIcon cat={data.topSwing.category} className={cn('h-3.5 w-3.5', cs.text)} />
                          </div>
                          <div>
                            <p className={cn('text-sm font-mono font-bold', cs.text)}>
                              {data.topSwing.category}
                            </p>
                            <p className="text-[11px] font-mono text-surface-500">
                              {data.topSwing.convictionScore}/100 · Votes both ways
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── Monthly trend sparkline ──────────────────────────────── */}
              {data.monthlyTrend.length >= 2 && (
                <MonthlySparkline data={data.monthlyTrend} />
              )}

              {/* ── Category breakdown ───────────────────────────────────── */}
              <div className="rounded-xl border border-surface-300 bg-surface-100/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-surface-500" />
                    <h2 className="font-mono text-sm font-bold text-white">
                      Conviction by Category
                    </h2>
                    <span className="text-xs font-mono text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full">
                      {sortedCats.length}
                    </span>
                  </div>

                  {/* Sort toggle */}
                  <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
                    {(['votes', 'conviction'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wide transition-colors',
                          sortBy === s
                            ? 'bg-surface-400 text-white'
                            : 'text-surface-500 hover:text-white',
                        )}
                      >
                        {s === 'votes' ? 'By volume' : 'By strength'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-mono text-surface-600 border-b border-surface-300/50">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-6 rounded-full bg-surface-400/60" />
                    <span>Low conviction (swing zone)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-6 rounded-full bg-for-500/80" />
                    <span>High conviction (stronghold)</span>
                  </div>
                </div>

                <div className="p-3 flex flex-col gap-2.5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={sortBy}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col gap-2.5"
                    >
                      {sortedCats.map((cat, i) => (
                        <CategoryRow key={cat.category} cat={cat} index={i} />
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Scale explainer ─────────────────────────────────────── */}
              <div className="rounded-xl border border-surface-300/60 bg-surface-100/30 p-4">
                <h3 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-widest mb-3">
                  How the score works
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { range: '0–34', label: 'Swing zone', color: 'text-purple', desc: 'Genuinely undecided — you weigh every debate independently' },
                    { range: '35–59', label: 'Independent', color: 'text-gold', desc: 'Leans one way but open to evidence on the other side' },
                    { range: '60–74', label: 'Principled', color: 'text-for-400', desc: 'Strong consistent views with room for nuance' },
                    { range: '75–100', label: 'Stronghold', color: 'text-against-400', desc: 'Iron conviction — almost always votes the same direction' },
                  ].map(({ range, label, color, desc }) => (
                    <div key={range} className="flex flex-col gap-1">
                      <span className={cn('text-xs font-mono font-bold', color)}>{range}</span>
                      <span className="text-[11px] font-mono text-white font-semibold">{label}</span>
                      <span className="text-[10px] font-mono text-surface-600 leading-snug">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Related insight links ───────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { href: '/analytics',   label: 'My Analytics',    icon: BarChart2 },
                  { href: '/fingerprint', label: 'Civic Fingerprint', icon: Shield    },
                  { href: '/compass',     label: 'Civic Compass',   icon: Globe     },
                  { href: '/resonance',   label: 'Resonance',       icon: Zap       },
                  { href: '/blindspots',  label: 'Blind Spots',     icon: Scale     },
                  { href: '/cohort',      label: 'My Cohort',       icon: TrendingUp },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg',
                      'bg-surface-200/60 border border-surface-300/60',
                      'hover:border-surface-400/60 hover:bg-surface-200/90 transition-colors',
                      'text-xs font-mono text-surface-400 hover:text-white',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>

              <p className="text-[10px] font-mono text-surface-700 text-center">
                Updated {relTime(data.generated_at)} · Based on your last 2 years of votes
              </p>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
