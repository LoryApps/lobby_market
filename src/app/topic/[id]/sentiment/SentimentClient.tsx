'use client'

/**
 * /topic/[id]/sentiment — Discourse Sentiment & Civility Analysis
 *
 * Shows the emotional tone and civility health of a topic's debate:
 *   • Civility Score (0–100) — overall discourse quality
 *   • Sentiment distribution (constructive / neutral / charged / inflammatory)
 *   • Most constructive FOR and AGAINST argument spotlights
 *   • Most charged arguments (what's heating up the discourse)
 *   • Monthly sentiment trend (is discourse improving or degrading?)
 *   • Side-by-side FOR vs AGAINST tone comparison
 *
 * Distinct from:
 *   /topic/[id]/quality    — argument logic/evidence score (AI-rated)
 *   /topic/[id]/anatomy    — structure & argumentation type breakdown
 *   /topic/[id]/depth      — conversation threading & reply density
 *   /topic/[id]/pressure   — clout-weighted social pressure analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlameKindling,
  Heart,
  Minus,
  RefreshCw,
  Smile,
  Sparkles,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SentimentResponse, SentimentArg, SentimentBand } from '@/app/api/topics/[id]/sentiment/route'

// ─── Civility score ring ──────────────────────────────────────────────────────

function CivilityRing({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color =
    score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : score >= 30 ? '#f97316' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r={radius}
          fill="none" stroke="currentColor" strokeWidth="10"
          className="text-surface-300"
        />
        <circle
          cx="60" cy="60" r={radius}
          fill="none" strokeWidth="10"
          stroke={color}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-black text-white tabular-nums">{score}</span>
        <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest">
          civility
        </span>
      </div>
    </div>
  )
}

// ─── Band bar ──────────────────────────────────────────────────────────────────

const BAND_META: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  constructive: {
    color: 'text-emerald',
    bg: 'bg-emerald/20 border-emerald/30',
    icon: CheckCircle2,
  },
  neutral: {
    color: 'text-surface-500',
    bg: 'bg-surface-300/40 border-surface-400/30',
    icon: Minus,
  },
  charged: {
    color: 'text-gold',
    bg: 'bg-gold/20 border-gold/30',
    icon: Zap,
  },
  inflammatory: {
    color: 'text-against-400',
    bg: 'bg-against-600/20 border-against-600/30',
    icon: FlameKindling,
  },
}

function DistributionBand({ band }: { band: SentimentBand }) {
  const meta = BAND_META[band.key] ?? BAND_META.neutral
  const Icon = meta.icon
  const total = band.forCount + band.againstCount
  if (total === 0) return null

  return (
    <div className={cn('rounded-xl border p-4', meta.bg)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', meta.color)} />
          <span className={cn('text-sm font-semibold', meta.color)}>{band.label}</span>
        </div>
        <span className="text-xs text-surface-500">{total} args</span>
      </div>
      <p className="text-[11px] text-surface-500 mb-3">{band.description}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-for-400 font-mono font-semibold">FOR</span>
            <span className="text-[10px] text-for-400 font-mono">{band.forPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300">
            <motion.div
              className="h-full rounded-full bg-for-500"
              initial={{ width: 0 }}
              animate={{ width: `${band.forPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="text-[10px] text-surface-600 mt-1">{band.forCount} arguments</div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-against-400 font-mono font-semibold">AGAINST</span>
            <span className="text-[10px] text-against-400 font-mono">{band.againstPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300">
            <motion.div
              className="h-full rounded-full bg-against-500"
              initial={{ width: 0 }}
              animate={{ width: `${band.againstPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="text-[10px] text-surface-600 mt-1">{band.againstCount} arguments</div>
        </div>
      </div>
    </div>
  )
}

// ─── Argument spotlight ───────────────────────────────────────────────────────

function ArgSpotlight({
  arg,
  variant,
}: {
  arg: SentimentArg
  variant: 'constructive' | 'charged'
}) {
  const isFor = arg.side === 'blue'
  const isConstructive = variant === 'constructive'
  const labelMeta = BAND_META[arg.label] ?? BAND_META.neutral

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-900/20 border-for-700/30'
          : 'bg-against-900/20 border-against-700/30',
      )}
    >
      <div className="flex items-center justify-between">
        <Badge variant={isFor ? 'active' : 'failed'} className="text-[10px] px-2 py-0.5">
          {isFor ? 'FOR' : 'AGAINST'}
        </Badge>
        <span className={cn('text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', labelMeta.bg, labelMeta.color)}>
          {arg.label}
        </span>
      </div>

      <p className="text-xs text-surface-300 leading-relaxed line-clamp-4">
        {arg.content}
      </p>

      {arg.topSignals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {arg.topSignals.map((s) => (
            <span
              key={s}
              className={cn(
                'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                isConstructive
                  ? 'bg-emerald/10 border-emerald/20 text-emerald/80'
                  : 'bg-against-900/30 border-against-700/30 text-against-400',
              )}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-surface-300/30">
        {arg.author ? (
          <div className="flex items-center gap-1.5">
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name || arg.author.username}
              size="xs"
            />
            <span className="text-[10px] text-surface-500">
              @{arg.author.username}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-surface-600">Anonymous</span>
        )}
        <div className="flex items-center gap-1 text-[10px] text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </div>
      </div>
    </div>
  )
}

// ─── Trend sparkline ─────────────────────────────────────────────────────────

function TrendSparkline({
  trend,
}: {
  trend: { month: string; avgScore: number; count: number }[]
}) {
  if (trend.length < 2) return null

  const minScore = Math.min(...trend.map((t) => t.avgScore))
  const maxScore = Math.max(...trend.map((t) => t.avgScore))
  const range = maxScore - minScore || 1
  const W = 280
  const H = 60
  const points = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * W
    const y = H - ((t.avgScore - minScore) / range) * H
    return `${x},${y}`
  })

  const lastScore = trend[trend.length - 1].avgScore
  const firstScore = trend[0].avgScore
  const improving = lastScore > firstScore
  const color = lastScore >= 20 ? '#10b981' : lastScore >= -10 ? '#f59e0b' : '#ef4444'
  const TrendIcon = improving ? TrendingUp : TrendingDown

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500 font-mono">sentiment over time</span>
        <div className="flex items-center gap-1">
          <TrendIcon className={cn('h-3.5 w-3.5', improving ? 'text-emerald' : 'text-against-400')} />
          <span className={cn('text-xs font-mono', improving ? 'text-emerald' : 'text-against-400')}>
            {improving ? 'improving' : 'declining'}
          </span>
        </div>
      </div>
      <div className="bg-surface-200 rounded-xl p-3 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {trend.map((t, i) => {
            const x = (i / (trend.length - 1)) * W
            const y = H - ((t.avgScore - minScore) / range) * H
            return (
              <circle key={t.month} cx={x} cy={y} r="3" fill={color} />
            )
          })}
        </svg>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-surface-600 font-mono">
            {trend[0].month}
          </span>
          <span className="text-[9px] text-surface-600 font-mono">
            {trend[trend.length - 1].month}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SentimentClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SentimentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/sentiment`)
      if (!res.ok) throw new Error('Failed to load sentiment data')
      setData(await res.json())
    } catch {
      setError('Could not load sentiment analysis.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const civilityLabel =
    !data ? ''
    : data.civilityScore >= 70 ? 'Healthy'
    : data.civilityScore >= 50 ? 'Moderate'
    : data.civilityScore >= 30 ? 'Heated'
    : 'Toxic'

  const civilityColor =
    !data ? 'text-surface-500'
    : data.civilityScore >= 70 ? 'text-emerald'
    : data.civilityScore >= 50 ? 'text-gold'
    : data.civilityScore >= 30 ? 'text-orange-400'
    : 'text-against-400'

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-6 space-y-6">
        {/* Back */}
        <div className="flex items-center gap-3">
          <Link
            href={`/topic/${id}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to topic
          </Link>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-4 w-4 text-purple" />
            <span className="text-xs text-surface-500 font-mono uppercase tracking-widest">
              Discourse Analysis
            </span>
          </div>
          <h1 className="text-xl font-bold text-white leading-snug">
            {loading
              ? 'Sentiment Analysis'
              : data?.topic.statement.slice(0, 80) + (data && data.topic.statement.length > 80 ? '…' : '')}
          </h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-36 rounded-full mx-auto" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl bg-against-900/20 border border-against-700/30 p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
            <p className="text-sm text-against-300">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 mx-auto text-xs text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Civility score */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-4">
                <CivilityRing score={data.civilityScore} />
                <div className="text-center">
                  <div className={cn('text-lg font-bold', civilityColor)}>{civilityLabel} Discourse</div>
                  <p className="text-xs text-surface-500 mt-1 max-w-xs">
                    {data.insight}
                  </p>
                </div>

                {/* Side comparison */}
                <div className="w-full grid grid-cols-2 gap-3 pt-2 border-t border-surface-300">
                  <div className="text-center">
                    <div className="text-[10px] text-for-400 font-mono font-semibold mb-1">FOR</div>
                    <div className="text-lg font-black text-white tabular-nums">
                      {Math.round((data.stats.avgForScore + 100) / 2)}
                    </div>
                    <div className="text-[9px] text-surface-600">avg tone score</div>
                    <div className="text-[10px] text-surface-500 mt-1">
                      {data.stats.forArgs} arguments
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-against-400 font-mono font-semibold mb-1">AGAINST</div>
                    <div className="text-lg font-black text-white tabular-nums">
                      {Math.round((data.stats.avgAgainstScore + 100) / 2)}
                    </div>
                    <div className="text-[9px] text-surface-600">avg tone score</div>
                    <div className="text-[10px] text-surface-500 mt-1">
                      {data.stats.againstArgs} arguments
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'Constructive',
                    value: `${data.stats.constructivePct}%`,
                    icon: CheckCircle2,
                    color: 'text-emerald',
                    bg: 'bg-emerald/10 border-emerald/20',
                  },
                  {
                    label: 'Charged',
                    value: `${data.stats.chargedPct}%`,
                    icon: Zap,
                    color: 'text-gold',
                    bg: 'bg-gold/10 border-gold/20',
                  },
                  {
                    label: 'Inflammatory',
                    value: `${data.stats.inflammatoryPct}%`,
                    icon: FlameKindling,
                    color: 'text-against-400',
                    bg: 'bg-against-800/20 border-against-700/30',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={cn('rounded-xl border p-3 text-center', stat.bg)}
                  >
                    <stat.icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
                    <div className={cn('text-lg font-black', stat.color)}>{stat.value}</div>
                    <div className="text-[9px] text-surface-600">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Distribution */}
              <div>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Smile className="h-4 w-4 text-purple" />
                  Tone Distribution
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.distribution.map((band) => (
                    <DistributionBand key={band.key} band={band} />
                  ))}
                </div>
              </div>

              {/* Trend */}
              {data.trend.length > 1 && (
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    Sentiment Trend
                  </h2>
                  <TrendSparkline trend={data.trend} />
                </div>
              )}

              {/* Most constructive */}
              {(data.mostConstructive.for || data.mostConstructive.against) && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald" />
                    Most Constructive Arguments
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {data.mostConstructive.for && (
                      <ArgSpotlight arg={data.mostConstructive.for} variant="constructive" />
                    )}
                    {data.mostConstructive.against && (
                      <ArgSpotlight arg={data.mostConstructive.against} variant="constructive" />
                    )}
                  </div>
                </div>
              )}

              {/* Most charged */}
              {(data.mostCharged.for || data.mostCharged.against) && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <FlameKindling className="h-4 w-4 text-against-400" />
                    Most Heated Arguments
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {data.mostCharged.for && (
                      <ArgSpotlight arg={data.mostCharged.for} variant="charged" />
                    )}
                    {data.mostCharged.against && (
                      <ArgSpotlight arg={data.mostCharged.against} variant="charged" />
                    )}
                  </div>
                </div>
              )}

              {/* Footer nav */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-xs text-surface-500 mb-3 font-mono">Related analysis</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: `/topic/${id}/quality`, label: 'Argument Quality' },
                    { href: `/topic/${id}/depth`, label: 'Conversation Depth' },
                    { href: `/topic/${id}/anatomy`, label: 'Argument Anatomy' },
                    { href: `/topic/${id}/themes`, label: 'Key Themes' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-[11px] text-surface-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-200 border border-transparent hover:border-surface-400"
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
