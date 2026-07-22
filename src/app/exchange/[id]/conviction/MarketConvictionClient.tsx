'use client'

/**
 * /exchange/[id]/conviction — Market Conviction Analysis
 *
 * Exchange-framed version of the topic conviction atlas.
 * Shows how deeply traders believe in their positions on this civic market:
 *   • Composite conviction score (0–100)
 *   • FOR vs AGAINST conviction breakdown
 *   • Persuadability window — how open is the market to price movement?
 *   • Reason-writing rate (deliberateness proxy)
 *   • Top conviction-driving arguments per side
 *   • Upvote distribution (conviction bands)
 *
 * Uses /api/topics/[id]/conviction — same data, exchange aesthetic.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Brain,
  Flame,
  Gauge,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ConvictionResponse, ConvictionArg } from '@/app/api/topics/[id]/conviction/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MarketConvictionClientProps {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  totalVotes: number
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  sublabel,
  size = 'lg',
  color,
}: {
  score: number
  label: string
  sublabel?: string
  size?: 'sm' | 'lg'
  color?: string
}) {
  const dim = size === 'lg' ? 128 : 72
  const r = size === 'lg' ? 46 : 26
  const sw = size === 'lg' ? 9 : 6
  const circumference = 2 * Math.PI * r
  const filled = (score / 100) * circumference

  const ringColor =
    color ??
    (score >= 75 ? '#3b82f6' : score >= 50 ? '#8b5cf6' : score >= 25 ? '#f59e0b' : '#6b7280')

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}
          />
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none" stroke={ringColor} strokeWidth={sw}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-mono font-bold tabular-nums',
              size === 'lg' ? 'text-2xl' : 'text-base',
            )}
            style={{ color: ringColor }}
          >
            {score}
          </span>
          {size === 'lg' && <span className="text-[10px] text-surface-500 font-mono">/100</span>}
        </div>
      </div>
      <div className="text-center">
        <p className={cn('font-semibold text-white', size === 'lg' ? 'text-sm' : 'text-xs')}>{label}</p>
        {sublabel && <p className="text-[10px] text-surface-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

// ─── Conviction meter bar ─────────────────────────────────────────────────────

function _MeterBar({
  label,
  value,
  max = 100,
  color = 'bg-for-500',
  className,
}: {
  label: string
  value: number
  max?: number
  color?: string
  className?: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500">{label}</span>
        <span className="text-xs font-mono font-semibold text-white">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
}: {
  arg: ConvictionArg
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20',
      )}
    >
      <div className="flex items-center gap-1.5">
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400" />
        )}
        <span className={cn('text-xs font-mono font-bold', isFor ? 'text-for-400' : 'text-against-400')}>
          {isFor ? 'TOP FOR ARGUMENT' : 'TOP AGAINST ARGUMENT'}
        </span>
        <span className="ml-auto text-[10px] text-surface-500 font-mono">
          {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-sm text-surface-700 leading-snug line-clamp-4">{arg.content}</p>

      {arg.author && (
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300/30">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name || arg.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${arg.author.username}`}
            className="text-xs text-surface-500 hover:text-white transition-colors"
          >
            @{arg.author.username}
          </Link>
          {arg.author.role !== 'person' && (
            <Badge size="xs" variant={arg.author.role === 'elder' ? 'gold' : 'default'}>
              {arg.author.role === 'troll_catcher' ? 'TC' : arg.author.role}
            </Badge>
          )}
          <span className="ml-auto text-[10px] text-surface-500 font-mono">
            weight {arg.convictionWeight.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketConvictionClient({
  id,
  statement,
  category,
  status,
  price,
  totalVotes,
}: MarketConvictionClientProps) {
  const [data, setData] = useState<ConvictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/conviction`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      setError('Failed to load conviction data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Label helpers ────────────────────────────────────────────────────────────

  function convictionLabel(score: number): string {
    if (score >= 80) return 'Ironclad'
    if (score >= 65) return 'Strong'
    if (score >= 50) return 'Moderate'
    if (score >= 35) return 'Wavering'
    return 'Weak'
  }

  function persuadabilityLabel(score: number): string {
    if (score >= 70) return 'Highly Persuadable'
    if (score >= 45) return 'Moderately Open'
    if (score >= 25) return 'Somewhat Locked'
    return 'Entrenched'
  }

  // ── Status color ─────────────────────────────────────────────────────────────

  const statusColor =
    status === 'law' ? 'text-gold' :
    status === 'failed' ? 'text-against-400' :
    price >= 67 ? 'text-for-400' :
    price <= 33 ? 'text-against-400' :
    'text-surface-500'

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col items-center gap-3">
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href={`/exchange/${id}`}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-mono text-surface-500">Conviction · Lobby Exchange</span>
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-3">
            <Flame className="h-8 w-8 text-surface-500 mx-auto" />
            <p className="text-sm text-surface-500">{error ?? 'No conviction data available.'}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-white transition-colors mx-auto"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { convictionScore, forConviction, againstConviction, reasonRate, persuadability, keySignals, topFor, topAgainst, distribution, stats, insight } = data

  // ── Persuadability arc color ──────────────────────────────────────────────────
  const persuadeColor =
    persuadability >= 70 ? '#10b981' :
    persuadability >= 45 ? '#f59e0b' :
    persuadability >= 25 ? '#8b5cf6' :
    '#ef4444'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* ── Back nav ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/exchange/${id}`}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
              aria-label="Back to market"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-against-400" />
              <span className="text-sm font-mono text-surface-500">Conviction · Lobby Exchange</span>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {/* ── Market header ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            {category && (
              <Badge size="xs" variant="default">{category}</Badge>
            )}
            <span className={cn('text-xs font-mono font-bold', statusColor)}>
              {price}¢ · {totalVotes.toLocaleString()} votes
            </span>
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{statement}</p>
        </div>

        {/* ── Three score rings ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center">
            <ScoreRing
              score={convictionScore}
              label="Market Conviction"
              sublabel={convictionLabel(convictionScore)}
              size="lg"
            />
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center">
            <ScoreRing
              score={persuadability}
              label="Persuadability"
              sublabel={persuadabilityLabel(persuadability)}
              size="lg"
              color={persuadeColor}
            />
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center">
            <ScoreRing
              score={reasonRate}
              label="Reason Rate"
              sublabel={`${stats.reasonCount} reasons`}
              size="lg"
              color="#8b5cf6"
            />
          </div>
        </div>

        {/* ── Insight banner ───────────────────────────────────────────────────── */}
        {insight && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300"
          >
            <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            <p className="text-sm text-surface-700 leading-relaxed">{insight}</p>
          </motion.div>
        )}

        {/* ── FOR vs AGAINST conviction breakdown ─────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-semibold text-white">Side Conviction</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* FOR */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                <span className="text-xs font-mono text-for-400 font-bold">FOR</span>
                <span className="ml-auto text-xs font-mono font-bold text-white">{forConviction}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-for-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${forConviction}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] text-surface-500">{convictionLabel(forConviction)} conviction</p>
              <div className="text-[11px] text-surface-500 space-y-0.5">
                <p>{stats.forArgs} argument{stats.forArgs !== 1 ? 's' : ''}</p>
                <p>{stats.totalForUpvotes.toLocaleString()} total upvotes</p>
                <p>avg {stats.avgUpvotesPerForArg.toFixed(1)} per arg</p>
              </div>
            </div>

            {/* AGAINST */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                <span className="text-xs font-mono text-against-400 font-bold">AGAINST</span>
                <span className="ml-auto text-xs font-mono font-bold text-white">{againstConviction}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-against-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${againstConviction}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
              <p className="text-[11px] text-surface-500">{convictionLabel(againstConviction)} conviction</p>
              <div className="text-[11px] text-surface-500 space-y-0.5">
                <p>{stats.againstArgs} argument{stats.againstArgs !== 1 ? 's' : ''}</p>
                <p>{stats.totalAgainstUpvotes.toLocaleString()} total upvotes</p>
                <p>avg {stats.avgUpvotesPerAgainstArg.toFixed(1)} per arg</p>
              </div>
            </div>
          </div>

          {/* Conviction delta */}
          <div className="pt-3 border-t border-surface-300/30">
            {(() => {
              const delta = forConviction - againstConviction
              const isForStronger = delta > 0
              const absDelta = Math.abs(delta)
              return (
                <div className="flex items-center gap-2">
                  {isForStronger ? (
                    <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-against-400" />
                  )}
                  <p className="text-xs text-surface-500">
                    {absDelta < 5
                      ? 'Conviction is roughly balanced between sides'
                      : isForStronger
                      ? `FOR believers are ${absDelta} points more convicted than AGAINST`
                      : `AGAINST believers are ${absDelta} points more convicted than FOR`}
                  </p>
                </div>
              )
            })()}
          </div>
        </div>

        {/* ── Key signals ─────────────────────────────────────────────────────── */}
        {keySignals.length > 0 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Key Signals</h2>
            </div>
            <ul className="space-y-2">
              {keySignals.map((sig, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-gold mt-2 flex-shrink-0" />
                  <span className="text-xs text-surface-600">{sig}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Conviction bands / distribution ──────────────────────────────────── */}
        {distribution.length > 0 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-purple" />
              <h2 className="text-sm font-semibold text-white">Vote Weight Distribution</h2>
              <span className="text-xs text-surface-500 ml-auto">by argument band</span>
            </div>

            <div className="space-y-3">
              {distribution.map((band, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{band.label}</span>
                    <span className="text-[10px] text-surface-500">{band.description}</span>
                  </div>
                  <div className="flex gap-1 h-2">
                    {/* FOR portion */}
                    <motion.div
                      className="rounded-l bg-for-500/60"
                      style={{ flexBasis: `${band.forPct}%` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                    />
                    {/* AGAINST portion */}
                    <motion.div
                      className="rounded-r bg-against-500/60"
                      style={{ flexBasis: `${band.againstPct}%` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 + 0.05 }}
                    />
                    {/* Neutral filler */}
                    {100 - band.forPct - band.againstPct > 0 && (
                      <div
                        className="rounded bg-surface-300/20"
                        style={{ flexBasis: `${100 - band.forPct - band.againstPct}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-surface-500">
                    <span>{band.forCount} FOR ({band.forPct}%)</span>
                    <span>{band.againstCount} AGAINST ({band.againstPct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Top conviction arguments ─────────────────────────────────────────── */}
        {(topFor || topAgainst) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-white">Highest-Conviction Arguments</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topFor && <ArgumentCard arg={topFor} side="for" />}
              {topAgainst && <ArgumentCard arg={topAgainst} side="against" />}
            </div>
          </div>
        )}

        {/* ── Stats footer ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Args', value: stats.totalArgs.toLocaleString(), icon: Brain },
              { label: 'Reason Rate', value: `${Math.round(reasonRate)}%`, icon: Zap },
              { label: 'FOR Upvotes', value: stats.totalForUpvotes.toLocaleString(), icon: ThumbsUp },
              { label: 'AGN Upvotes', value: stats.totalAgainstUpvotes.toLocaleString(), icon: ThumbsDown },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center">
                <Icon className="h-4 w-4 text-surface-500 mx-auto mb-1" />
                <p className="text-sm font-mono font-bold text-white">{value}</p>
                <p className="text-[10px] text-surface-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Explore more ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {[
            { href: `/exchange/${id}/signal`, label: 'Signal' },
            { href: `/exchange/${id}/sentiment`, label: 'Sentiment' },
            { href: `/exchange/${id}/depth`, label: 'Depth' },
            { href: `/exchange/${id}/crowd`, label: 'Crowd Intel' },
            { href: `/exchange/${id}/scorecard`, label: 'Scorecard' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
