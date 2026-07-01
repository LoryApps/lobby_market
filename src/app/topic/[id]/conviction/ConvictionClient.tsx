'use client'

/**
 * /topic/[id]/conviction — Conviction Atlas
 *
 * Measures how deeply voters believe in their positions:
 *   • Composite conviction score (0–100)
 *   • Side-by-side FOR vs AGAINST conviction meters
 *   • Persuadability window — how open is this debate to mind-changing?
 *   • Top conviction-driving arguments per side
 *   • Upvote concentration distribution
 *   • Reason-writing rate (deliberateness proxy)
 *
 * Distinct from:
 *   /topic/[id]/sentiment  — emotional tone & civility
 *   /topic/[id]/pressure   — social clout-weighted influence
 *   /topic/[id]/consensus  — where the two sides find common ground
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Brain,
  CheckCircle2,
  Gauge,
  Lightbulb,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ConvictionResponse, ConvictionArg } from '@/app/api/topics/[id]/conviction/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConvictionClientProps {
  topicId: string
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  size = 'lg',
}: {
  score: number
  label: string
  size?: 'sm' | 'lg'
}) {
  const dim = size === 'lg' ? 140 : 80
  const r = size === 'lg' ? 52 : 28
  const strokeWidth = size === 'lg' ? 10 : 7
  const circumference = 2 * Math.PI * r
  const filled = (score / 100) * circumference

  const color =
    score >= 75 ? '#3b82f6' :
    score >= 50 ? '#8b5cf6' :
    score >= 25 ? '#f59e0b' :
    '#6b7280'

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: dim, height: dim }}
    >
      <svg
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox={`0 0 ${dim} ${dim}`}
      >
        <circle
          cx={dim / 2} cy={dim / 2} r={r}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-surface-300"
        />
        <circle
          cx={dim / 2} cy={dim / 2} r={r}
          fill="none" strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center">
        {size === 'lg' ? (
          <>
            <span className="text-4xl font-black text-white tabular-nums">{score}</span>
            <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest leading-tight text-center">
              {label}
            </span>
          </>
        ) : (
          <>
            <span className="text-xl font-black text-white tabular-nums">{score}</span>
            <span className="text-[9px] text-surface-500 font-mono uppercase tracking-widest leading-tight text-center">
              {label}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Conviction meter bar ─────────────────────────────────────────────────────

function ConvictionMeter({
  value,
  color,
  label,
}: {
  value: number
  color: 'blue' | 'red'
  label: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-surface-500">{label}</span>
        <span className={color === 'blue' ? 'text-for-400' : 'text-against-400'}>
          {value}/100
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            color === 'blue' ? 'bg-for-500' : 'bg-against-500',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({ arg, side }: { arg: ConvictionArg; side: 'for' | 'against' }) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 space-y-3',
        isFor
          ? 'bg-for-900/20 border-for-500/30'
          : 'bg-against-900/20 border-against-500/30',
      )}
    >
      {/* Weight badge */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[10px] font-mono font-semibold uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'} · Top Conviction Driver
        </span>
        <span className="text-xs font-mono text-surface-500">
          {arg.convictionWeight}% of side upvotes
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-700 font-mono leading-relaxed">
        &ldquo;{arg.content}&rdquo;
      </p>

      {/* Author row */}
      <div className="flex items-center gap-2 pt-1">
        {arg.author && (
          <>
            <Avatar
              username={arg.author.username}
              displayName={arg.author.display_name}
              avatarUrl={arg.author.avatar_url}
              size="xs"
            />
            <Link
              href={`/profile/${arg.author.username}`}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              @{arg.author.username}
            </Link>
          </>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>
    </div>
  )
}

// ─── Persuadability gauge ─────────────────────────────────────────────────────

function PersuadabilityGauge({ value }: { value: number }) {
  const label =
    value >= 70 ? 'Highly Persuadable' :
    value >= 50 ? 'Moderately Open' :
    value >= 30 ? 'Mostly Settled' :
    'Deeply Entrenched'

  const color =
    value >= 70 ? 'text-emerald' :
    value >= 50 ? 'text-gold' :
    value >= 30 ? 'text-against-400' :
    'text-surface-500'

  const bg =
    value >= 70 ? 'bg-emerald/20 border-emerald/30' :
    value >= 50 ? 'bg-gold/20 border-gold/30' :
    value >= 30 ? 'bg-against-500/20 border-against-500/30' :
    'bg-surface-300/20 border-surface-400/30'

  return (
    <div className={cn('rounded-2xl border p-5', bg)}>
      <div className="flex items-start gap-4">
        <Gauge className={cn('h-8 w-8 flex-shrink-0 mt-0.5', color)} />
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-semibold text-white">
              Persuadability Window
            </span>
            <span className={cn('text-xl font-black font-mono', color)}>
              {value}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                value >= 70 ? 'bg-emerald' :
                value >= 50 ? 'bg-gold' :
                value >= 30 ? 'bg-against-500' :
                'bg-surface-500',
              )}
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.4 }}
            />
          </div>
          <p className={cn('text-xs font-mono', color)}>{label}</p>
          <p className="text-xs text-surface-500 font-mono">
            How open this debate is to being moved by a compelling argument.
            Computed from vote closeness and conviction delta.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConvictionClient({ topicId }: ConvictionClientProps) {
  const params = useParams<{ id: string }>()
  const id = topicId ?? params.id

  const [data, setData] = useState<ConvictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/conviction`)
      if (!res.ok) throw new Error('Failed to load conviction data')
      const json: ConvictionResponse = await res.json()
      setData(json)
    } catch {
      setError('Unable to load conviction analysis. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface-100 border border-surface-300 p-8 mb-4">
            <Skeleton className="h-36 w-36 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <Link
            href={`/topic/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to topic
          </Link>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-3">
            <Brain className="h-8 w-8 text-surface-500 mx-auto" />
            <p className="text-surface-500 font-mono text-sm">{error ?? 'No data available'}</p>
            <button
              onClick={() => load()}
              className="mt-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, convictionScore, forConviction, againstConviction, reasonRate,
    persuadability, keySignals, topFor, topAgainst, distribution, stats, insight } = data

  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
  }
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back + Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Brain className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold text-white leading-tight">
                Conviction Atlas
              </h1>
              <p className="text-xs font-mono text-surface-500">
                How deeply do voters believe?
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Topic link ────────────────────────────────────────────────── */}
        <Link
          href={`/topic/${topic.id}`}
          className="block text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6 line-clamp-2"
        >
          &ldquo;{topic.statement}&rdquo;
        </Link>

        {/* ── Hero: Composite Score + sub-metrics ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-4"
        >
          <div className="flex flex-col items-center gap-3 mb-6">
            <ScoreRing score={convictionScore} label="conviction" size="lg" />
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
              </Badge>
              {topic.category && (
                <span className="text-xs font-mono text-surface-500">{topic.category}</span>
              )}
            </div>
            <p className="text-xs text-surface-500 font-mono text-center max-w-xs">
              Composite score measuring argument engagement, voter deliberateness, and conviction depth
            </p>
          </div>

          {/* Sub-metrics row */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-surface-300">
            <div className="text-center space-y-0.5">
              <p className="text-xl font-black text-for-400 tabular-nums">{forPct}%</p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">For</p>
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-xl font-black text-white tabular-nums">
                {topic.total_votes.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Votes</p>
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-xl font-black text-against-400 tabular-nums">{againstPct}%</p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Against</p>
            </div>
          </div>
        </motion.div>

        {/* ── Side conviction cards ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"
        >
          {/* FOR */}
          <div className="rounded-2xl bg-for-900/20 border border-for-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-for-400" />
              <span className="text-sm font-mono font-semibold text-for-300">FOR Conviction</span>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing score={forConviction} label="FOR" size="sm" />
              <div className="flex-1 space-y-1.5">
                <ConvictionMeter value={forConviction} color="blue" label="conviction" />
                <div className="text-xs font-mono text-surface-500 space-y-0.5 pt-1">
                  <div className="flex justify-between">
                    <span>Arguments</span>
                    <span className="text-white">{stats.forArgs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total upvotes</span>
                    <span className="text-white">{stats.totalForUpvotes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg upvotes/arg</span>
                    <span className="text-white">{stats.avgUpvotesPerForArg.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AGAINST */}
          <div className="rounded-2xl bg-against-900/20 border border-against-500/30 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-against-400" />
              <span className="text-sm font-mono font-semibold text-against-300">AGAINST Conviction</span>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing score={againstConviction} label="AGN" size="sm" />
              <div className="flex-1 space-y-1.5">
                <ConvictionMeter value={againstConviction} color="red" label="conviction" />
                <div className="text-xs font-mono text-surface-500 space-y-0.5 pt-1">
                  <div className="flex justify-between">
                    <span>Arguments</span>
                    <span className="text-white">{stats.againstArgs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total upvotes</span>
                    <span className="text-white">{stats.totalAgainstUpvotes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg upvotes/arg</span>
                    <span className="text-white">{stats.avgUpvotesPerAgainstArg.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Persuadability ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-4"
        >
          <PersuadabilityGauge value={persuadability} />
        </motion.div>

        {/* ── Deliberateness stat ───────────────────────────────────────── */}
        {stats.totalVotes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono font-semibold text-white">
                    Voter Deliberateness
                  </span>
                  <span className="text-xl font-black text-emerald tabular-nums">
                    {reasonRate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden mb-2">
                  <motion.div
                    className="h-full rounded-full bg-emerald"
                    initial={{ width: 0 }}
                    animate={{ width: `${reasonRate}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  />
                </div>
                <p className="text-xs text-surface-500 font-mono">
                  {stats.reasonCount.toLocaleString()} of {stats.totalVotes.toLocaleString()} voters wrote a reason for their vote.
                  {reasonRate > 30
                    ? ' High deliberateness — voters are thinking, not reacting.'
                    : reasonRate > 10
                    ? ' Moderate deliberateness.'
                    : ' Most voters chose not to explain their stance.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Key signals ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4"
        >
          <h2 className="text-sm font-mono font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            Key Signals
          </h2>
          <ul className="space-y-2">
            {keySignals.map((signal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-mono text-surface-500">
                <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                {signal}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* ── Top conviction drivers ────────────────────────────────────── */}
        {(topFor || topAgainst) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <h2 className="text-sm font-mono font-semibold text-white mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-purple" />
              Top Conviction Drivers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topFor && <ArgCard arg={topFor} side="for" />}
              {topAgainst && <ArgCard arg={topAgainst} side="against" />}
            </div>
          </motion.div>
        )}

        {/* ── Upvote distribution ───────────────────────────────────────── */}
        {stats.totalArgs > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4"
          >
            <h2 className="text-sm font-mono font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-for-400" />
              Argument Voice Distribution
            </h2>
            <div className="space-y-4">
              {distribution.map((band) => (
                <div key={band.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-surface-500">
                    <div>
                      <span className="text-white font-semibold">{band.label}</span>
                      <span className="ml-2 text-[10px]">{band.description}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* FOR bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-for-500">
                        <span>FOR</span>
                        <span>{band.forCount} args ({band.forPct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-for-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${band.forPct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                    </div>
                    {/* AGAINST bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-against-500">
                        <span>AGAINST</span>
                        <span>{band.againstCount} args ({band.againstPct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-against-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${band.againstPct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Narrative insight ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-purple/5 border border-purple/20 p-5"
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-purple flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-mono font-semibold text-white mb-2">
                Conviction Analysis
              </h2>
              <p className="text-sm text-surface-500 font-mono leading-relaxed">
                {insight}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Nav links ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { label: 'Sentiment', href: `/topic/${topic.id}/sentiment` },
            { label: 'Quality', href: `/topic/${topic.id}/quality` },
            { label: 'Pressure', href: `/topic/${topic.id}/pressure` },
            { label: 'Persuasion Lab', href: `/topic/${topic.id}/persuasion` },
            { label: 'Consensus', href: `/topic/${topic.id}/consensus` },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 rounded-lg px-3 py-1.5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
