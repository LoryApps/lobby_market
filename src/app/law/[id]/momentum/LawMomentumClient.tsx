'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  Edit3,
  Gavel,
  GitPullRequest,
  Minus,
  RefreshCw,
  Scale,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawMomentumData, MomentumWeek } from '@/app/api/laws/[id]/momentum/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

// ─── Momentum indicator ───────────────────────────────────────────────────────

const DIR_CONFIG = {
  rising: {
    icon: TrendingUp,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    label: 'Rising',
  },
  falling: {
    icon: TrendingDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    label: 'Falling',
  },
  stable: {
    icon: Minus,
    color: 'text-surface-500',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/40',
    label: 'Stable',
  },
}

// ─── Activity chart (SVG sparkline) ──────────────────────────────────────────

interface TooltipData {
  x: number
  y: number
  week: MomentumWeek
}

function ActivityChart({ weeks }: { weeks: MomentumWeek[] }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [activeMetric, setActiveMetric] = useState<'amendments' | 'wiki_edits' | 'reviews'>('amendments')
  const svgRef = useRef<SVGSVGElement>(null)

  if (weeks.length < 2) return null

  const W = 560
  const H = 160
  const padL = 32
  const padR = 12
  const padT = 12
  const padB = 24
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const values = weeks.map((w) => w[activeMetric])
  const maxVal = Math.max(...values, 1)

  function xOf(i: number): number {
    return padL + (i / (weeks.length - 1)) * innerW
  }
  function yOf(v: number): number {
    return padT + innerH - (v / maxVal) * innerH
  }

  const pathD = weeks
    .map((w, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(w[activeMetric]).toFixed(1)}`)
    .join('')

  const areaD =
    pathD +
    `L${xOf(weeks.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)}` +
    `L${padL.toFixed(1)},${(padT + innerH).toFixed(1)}Z`

  const metricColor = {
    amendments: '#6366f1',
    wiki_edits: '#f59e0b',
    reviews: '#10b981',
  }[activeMetric]

  const metricLabel = {
    amendments: 'Amendments',
    wiki_edits: 'Wiki Edits',
    reviews: 'Reviews',
  }[activeMetric]

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((mouseX - padL) / innerW) * (weeks.length - 1))
    const clamped = Math.max(0, Math.min(weeks.length - 1, idx))
    const w = weeks[clamped]
    setTooltip({
      x: xOf(clamped),
      y: yOf(w[activeMetric]),
      week: w,
    })
  }

  return (
    <div className="space-y-3">
      {/* Metric tabs */}
      <div className="flex items-center gap-1">
        {(
          [
            { id: 'amendments' as const, label: 'Amendments', icon: GitPullRequest, color: 'text-purple' },
            { id: 'wiki_edits' as const, label: 'Wiki', icon: Edit3, color: 'text-gold' },
            { id: 'reviews' as const, label: 'Reviews', icon: Star, color: 'text-emerald' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveMetric(m.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
              activeMetric === m.id
                ? 'bg-surface-300 text-white'
                : 'text-surface-500 hover:text-white hover:bg-surface-200'
            )}
          >
            <m.icon className={cn('h-3 w-3', activeMetric === m.id ? m.color : '')} aria-hidden />
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative w-full overflow-hidden rounded-xl bg-surface-100/60 border border-surface-300/50">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: H }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          aria-label={`${metricLabel} activity chart`}
        >
          <defs>
            <linearGradient id="lmAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metricColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={metricColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + frac * innerH
            const val = Math.round(maxVal * (1 - frac))
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={W - padR} y2={y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={padL - 4} y={y + 4} fill="rgba(255,255,255,0.3)"
                  fontSize="9" textAnchor="end">{val}</text>
              </g>
            )
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#lmAreaGrad)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke={metricColor} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Data dots */}
          {weeks.map((w, i) => (
            <circle
              key={w.week}
              cx={xOf(i)}
              cy={yOf(w[activeMetric])}
              r={w[activeMetric] > 0 ? 3 : 1.5}
              fill={w[activeMetric] > 0 ? metricColor : 'rgba(255,255,255,0.15)'}
            />
          ))}

          {/* Date axis — show first, middle, last */}
          {[0, Math.floor(weeks.length / 2), weeks.length - 1]
            .filter((i, idx, arr) => arr.indexOf(i) === idx)
            .map((i) => (
              <text
                key={i}
                x={xOf(i)}
                y={H - 6}
                fill="rgba(255,255,255,0.3)"
                fontSize="9"
                textAnchor="middle"
              >
                {shortDate(weeks[i].week)}
              </text>
            ))}

          {/* Tooltip */}
          {tooltip && (
            <g>
              <line
                x1={tooltip.x} y1={padT}
                x2={tooltip.x} y2={padT + innerH}
                stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3"
              />
              <circle cx={tooltip.x} cy={tooltip.y} r="4"
                fill={metricColor} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            </g>
          )}
        </svg>

        {/* Tooltip popup */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 right-2 bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-xs pointer-events-none"
            >
              <p className="text-surface-500 font-mono">{shortDate(tooltip.week.week)}</p>
              <p className="text-white font-semibold">
                {tooltip.week[activeMetric]} {metricLabel.toLowerCase()}
              </p>
              {activeMetric === 'reviews' && tooltip.week.avg_stars > 0 && (
                <p className="text-emerald font-mono">
                  {tooltip.week.avg_stars.toFixed(1)} avg stars
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'text-white',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-200/60 border border-surface-300/50">
      <div className="flex items-center gap-2 text-surface-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-mono uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', accent)}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Stars display ────────────────────────────────────────────────────────────

function StarsDisplay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-surface-500 text-sm">No reviews yet</span>
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < Math.round(value) ? 'text-gold fill-gold' : 'text-surface-500'
          )}
          aria-hidden
        />
      ))}
      <span className="text-sm font-mono text-white ml-1">{value.toFixed(1)}</span>
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LawMomentumClient({ lawId }: { lawId: string }) {
  const params = useParams<{ id: string }>()
  const id = lawId || params.id

  const [data, setData] = useState<LawMomentumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/momentum`)
      if (!res.ok) throw new Error('Failed to load momentum data')
      const json: LawMomentumData = await res.json()
      setData(json)
    } catch {
      setError('Could not load momentum data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSkeleton />

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={Activity}
            title="Could not load momentum"
            description={error ?? 'Unknown error'}
            action={{ label: 'Try again', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { law, aggregate, weekly, momentum_score, momentum_label, momentum_dir, top_amendment } = data
  const dirCfg = DIR_CONFIG[momentum_dir]
  const DirIcon = dirCfg.icon

  const hasActivity =
    aggregate.total_amendments > 0 ||
    aggregate.total_wiki_edits > 0 ||
    aggregate.total_reviews > 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Back link */}
        <Link
          href={`/law/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to law
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Gavel className="h-4 w-4 text-gold flex-shrink-0" aria-hidden />
                <Badge variant="law">LAW</Badge>
                {law.category && (
                  <Badge variant="outline" className="text-[10px]">{law.category}</Badge>
                )}
              </div>
              <h1 className="text-base font-semibold text-white leading-snug line-clamp-2">
                {law.statement}
              </h1>
              <p className="text-xs text-surface-500 mt-1">
                Established {longDate(law.established_at)} · {aggregate.days_since_established}d ago
              </p>
            </div>

            {/* Refresh */}
            <button
              onClick={load}
              className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh momentum data"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Momentum gauge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-2xl border p-5 space-y-4',
            dirCfg.bg, dirCfg.border
          )}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DirIcon className={cn('h-5 w-5', dirCfg.color)} aria-hidden />
                <span className={cn('text-sm font-semibold', dirCfg.color)}>
                  {momentum_label}
                </span>
              </div>
              <p className="text-[11px] text-surface-500">Community engagement momentum</p>
            </div>
            <div className="text-right">
              <p className={cn('text-3xl font-bold tabular-nums', dirCfg.color)}>
                {momentum_score}
              </p>
              <p className="text-[10px] text-surface-500 font-mono">/100</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-surface-300/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${momentum_score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn('h-full rounded-full', {
                'bg-emerald': momentum_dir === 'rising',
                'bg-against-500': momentum_dir === 'falling',
                'bg-surface-400': momentum_dir === 'stable',
              })}
            />
          </div>

          <p className="text-xs text-surface-500">
            Based on amendment proposals, wiki contributions, and citizen reviews in the last 28 days.
          </p>
        </motion.div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            icon={GitPullRequest}
            label="Amendments"
            value={aggregate.total_amendments}
            sub={aggregate.ratified_amendments > 0 ? `${aggregate.ratified_amendments} ratified` : 'None ratified'}
            accent="text-purple"
          />
          <StatTile
            icon={Edit3}
            label="Wiki Edits"
            value={aggregate.total_wiki_edits}
            sub="Community contributions"
            accent="text-gold"
          />
          <StatTile
            icon={Star}
            label="Reviews"
            value={aggregate.total_reviews}
            sub={aggregate.avg_stars !== null ? `${aggregate.avg_stars.toFixed(1)} avg stars` : 'No rating yet'}
            accent="text-emerald"
          />
          <StatTile
            icon={Users}
            label="Original Votes"
            value={law.total_votes.toLocaleString()}
            sub={`${Math.round(law.blue_pct)}% FOR when passed`}
            accent="text-for-400"
          />
        </div>

        {/* Avg star rating */}
        {aggregate.total_reviews > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" aria-hidden />
              <span className="text-sm font-semibold text-white">Citizen Rating</span>
            </div>
            <StarsDisplay value={aggregate.avg_stars} />
            <p className="text-xs text-surface-500">
              {aggregate.total_reviews} citizen{aggregate.total_reviews !== 1 ? 's' : ''} reviewed this law
            </p>
          </motion.div>
        )}

        {/* Activity chart */}
        {hasActivity && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-surface-500" aria-hidden />
              <h2 className="text-sm font-semibold text-white">Activity Over Time</h2>
            </div>
            <ActivityChart weeks={weekly} />
          </div>
        )}

        {/* Top amendment */}
        {top_amendment && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-purple" aria-hidden />
              <h2 className="text-sm font-semibold text-white">Latest Amendment Proposal</h2>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-white font-medium line-clamp-2">{top_amendment.title}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-mono',
                  top_amendment.status === 'ratified'
                    ? 'bg-emerald/15 text-emerald border border-emerald/30'
                    : top_amendment.status === 'rejected'
                      ? 'bg-against-500/15 text-against-400 border border-against-500/30'
                      : 'bg-surface-300 text-surface-500 border border-surface-400/40'
                )}>
                  {top_amendment.status}
                </span>
                <span className="text-xs text-surface-500 font-mono">
                  {top_amendment.for_count} for · {top_amendment.against_count} against
                </span>
                <span className="text-xs text-surface-500">{relTime(top_amendment.created_at)}</span>
              </div>
            </div>

            <Link
              href={`/law/${id}/community`}
              className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              View all amendments <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </motion.div>
        )}

        {/* Empty state */}
        {!hasActivity && (
          <EmptyState
            icon={Zap}
            title="No activity yet"
            description="This law hasn't had any amendments proposed, wiki edits, or reviews since it was established."
          >
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
              <Link
                href={`/law/${id}/reviews`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald text-sm font-medium hover:bg-emerald/20 transition-colors"
              >
                <Star className="h-4 w-4" aria-hidden />
                Leave a review
              </Link>
              <Link
                href={`/law/${id}/wiki`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/20 transition-colors"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Edit wiki
              </Link>
            </div>
          </EmptyState>
        )}

        {/* Navigation links */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {[
            { href: `/law/${id}`, label: 'Law Text', icon: Scale },
            { href: `/law/${id}/reviews`, label: 'Reviews', icon: Star },
            { href: `/law/${id}/community`, label: 'Amendments', icon: GitPullRequest },
            { href: `/law/${id}/wiki`, label: 'Wiki', icon: BookOpen },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 text-sm text-surface-500 hover:text-white transition-colors"
            >
              <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
