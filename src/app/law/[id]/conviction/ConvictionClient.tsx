'use client'

/**
 * /law/[id]/conviction — Conviction Atlas for Established Laws
 *
 * Reveals how deeply the founding debate's voters believed their positions
 * when this law was being decided:
 *   • Mandate strength — how decisive was the founding consensus?
 *   • FOR vs AGAINST conviction meters from the founding debate
 *   • Top conviction-driving arguments per side
 *   • Upvote concentration — was conviction concentrated or distributed?
 *   • Reason-writing rate (deliberateness proxy)
 *
 * Distinct from:
 *   /law/[id]/velocity  — rate of change during the debate phase
 *   /law/[id]/origins   — chronological history of how the law formed
 *   /law/[id]/mandate   — democratic legitimacy and representativeness
 *   /law/[id]/scorecard — overall law performance grades
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
  Gavel,
  Gauge,
  Lightbulb,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawConvictionResponse, ConvictionArg, ConvictionBand } from '@/app/api/laws/[id]/conviction/route'

interface ConvictionClientProps {
  lawId: string
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  size = 'lg',
  colorOverride,
}: {
  score: number
  label: string
  size?: 'sm' | 'lg'
  colorOverride?: string
}) {
  const dim = size === 'lg' ? 140 : 80
  const r = size === 'lg' ? 52 : 28
  const strokeWidth = size === 'lg' ? 10 : 7
  const circumference = 2 * Math.PI * r
  const filled = (score / 100) * circumference

  const color = colorOverride ?? (
    score >= 75 ? '#3b82f6' :
    score >= 50 ? '#8b5cf6' :
    score >= 25 ? '#f59e0b' :
    '#6b7280'
  )

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

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  topicId,
}: {
  arg: ConvictionArg
  topicId: string | null
}) {
  const isFor = arg.side === 'blue'

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider',
            isFor
              ? 'bg-for-500/20 text-for-300 border border-for-500/30'
              : 'bg-against-500/20 text-against-300 border border-against-500/30',
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="text-xs text-surface-500 font-mono">
          {arg.upvotes.toLocaleString()} upvotes
        </span>
        <span className="text-xs text-surface-600 font-mono ml-auto">
          weight: {arg.convictionWeight.toFixed(2)}
        </span>
      </div>

      <p className="text-sm text-surface-700 leading-relaxed line-clamp-3">
        {arg.content}
      </p>

      {arg.author && (
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300/40">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name || arg.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${arg.author.username}`}
            className="text-xs text-surface-500 hover:text-white transition-colors truncate"
          >
            {arg.author.display_name || arg.author.username}
          </Link>
          <span className="text-[10px] text-surface-600 font-mono ml-auto capitalize">
            {arg.author.role.replace('_', ' ')}
          </span>
        </div>
      )}

      {topicId && (
        <Link
          href={`/topic/${topicId}/arguments`}
          className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors mt-1"
        >
          View all founding arguments →
        </Link>
      )}
    </div>
  )
}

// ─── Distribution row ─────────────────────────────────────────────────────────

function DistributionRow({ band }: { band: ConvictionBand }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-2.5 border-b border-surface-300/30 last:border-0">
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs text-for-300 font-mono tabular-nums">{band.forCount}</span>
        <div
          className="h-1.5 rounded-full bg-for-500/70"
          style={{ width: `${Math.max(4, band.forPct)}%`, maxWidth: '80px' }}
        />
      </div>
      <div className="text-center">
        <span className="text-[10px] text-surface-500 font-mono whitespace-nowrap">
          {band.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className="h-1.5 rounded-full bg-against-500/70"
          style={{ width: `${Math.max(4, band.againstPct)}%`, maxWidth: '80px' }}
        />
        <span className="text-xs text-against-300 font-mono tabular-nums">{band.againstCount}</span>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConvictionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-center justify-center py-4">
          <Skeleton className="h-36 w-36 rounded-full" />
        </div>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <div className="flex justify-center">
              <Skeleton className="h-20 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConvictionClient({ lawId }: ConvictionClientProps) {
  const params = useParams()
  const id = lawId || (params.id as string)

  const [data, setData] = useState<LawConvictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/conviction`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const mandateLabel = (score: number) =>
    score >= 75 ? 'Strong mandate' :
    score >= 55 ? 'Solid mandate' :
    score >= 35 ? 'Moderate mandate' :
    'Narrow mandate'

  const mandateColor = (score: number) =>
    score >= 75 ? 'text-emerald' :
    score >= 55 ? 'text-for-400' :
    score >= 35 ? 'text-gold' :
    'text-against-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/law/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple" />
              Conviction Atlas
            </h1>
            <p className="text-xs text-surface-500">
              How deeply did citizens believe in this law?
            </p>
          </div>
        </div>

        {loading && <ConvictionSkeleton />}

        {error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Scale className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-4 flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors mx-auto"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* Law statement strip */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Gavel className="h-4 w-4 text-emerald" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-emerald uppercase tracking-wider mb-1">
                    Established Law
                  </p>
                  <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                    {data.law.statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-surface-500">
                      {data.law.total_votes.toLocaleString()} founding votes
                    </span>
                    <span className="text-xs text-for-400 font-mono">
                      {Math.round(data.law.blue_pct)}% FOR
                    </span>
                    {data.law.category && (
                      <Badge variant="proposed" className="text-[10px] py-0 px-1.5">
                        {data.law.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mandate strength + conviction score */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <div className="flex flex-col items-center gap-4">
                <ScoreRing
                  score={data.mandateStrength}
                  label="Mandate Strength"
                  colorOverride={
                    data.mandateStrength >= 70 ? '#10b981' :
                    data.mandateStrength >= 50 ? '#3b82f6' :
                    data.mandateStrength >= 30 ? '#f59e0b' :
                    '#6b7280'
                  }
                />
                <div className="text-center">
                  <p className={cn('text-base font-bold', mandateColor(data.mandateStrength))}>
                    {mandateLabel(data.mandateStrength)}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Based on vote margin, argument conviction, and voter deliberateness
                  </p>
                </div>
              </div>

              {/* Conviction insight */}
              <div className="mt-5 pt-4 border-t border-surface-300/50">
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-surface-600 leading-relaxed">
                    {data.insight}
                  </p>
                </div>
              </div>
            </div>

            {/* FOR vs AGAINST conviction */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <p className="text-[10px] font-mono font-bold text-for-400 uppercase tracking-widest">
                  FOR Conviction
                </p>
                <div className="flex justify-center">
                  <ScoreRing
                    score={data.forConviction}
                    label="FOR"
                    size="sm"
                    colorOverride="#3b82f6"
                  />
                </div>
                <p className="text-[11px] text-surface-500 text-center leading-snug">
                  {data.stats.forArgs} arguments · {data.stats.totalForUpvotes.toLocaleString()} upvotes
                </p>
              </div>

              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <p className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-widest">
                  AGAINST Conviction
                </p>
                <div className="flex justify-center">
                  <ScoreRing
                    score={data.againstConviction}
                    label="AGAINST"
                    size="sm"
                    colorOverride="#ef4444"
                  />
                </div>
                <p className="text-[11px] text-surface-500 text-center leading-snug">
                  {data.stats.againstArgs} arguments · {data.stats.totalAgainstUpvotes.toLocaleString()} upvotes
                </p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Gauge,
                  label: 'Conviction Score',
                  value: data.convictionScore,
                  sub: '/100',
                  color: 'text-purple',
                },
                {
                  icon: Award,
                  label: 'Reason Rate',
                  value: `${data.reasonRate}%`,
                  sub: 'wrote reasons',
                  color: 'text-gold',
                },
                {
                  icon: Shield,
                  label: 'Founding Args',
                  value: data.stats.totalArgs.toLocaleString(),
                  sub: `${data.stats.forArgs}F / ${data.stats.againstArgs}A`,
                  color: 'text-emerald',
                },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                  <Icon className={cn('h-4 w-4 mx-auto mb-1.5', color)} />
                  <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mb-0.5">
                    {label}
                  </p>
                  <p className="text-lg font-black text-white tabular-nums leading-none">
                    {value}
                  </p>
                  <p className="text-[10px] text-surface-600 font-mono mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Key signals */}
            {data.keySignals.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-bold text-white">Conviction Signals</h2>
                </div>
                <ul className="space-y-2">
                  {data.keySignals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-surface-600">{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top founding arguments */}
            {(data.topFor || data.topAgainst) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-bold text-white">
                    Top Conviction-Driving Arguments
                  </h2>
                </div>
                {data.topFor && (
                  <ArgCard arg={data.topFor} topicId={data.topic_id} />
                )}
                {data.topAgainst && (
                  <ArgCard arg={data.topAgainst} topicId={data.topic_id} />
                )}
              </div>
            )}

            {/* Upvote concentration distribution */}
            {data.distribution.length > 0 && data.stats.totalArgs > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="text-sm font-bold text-white mb-1">
                  Argument Concentration
                </h2>
                <p className="text-xs text-surface-500 mb-4">
                  How distributed was conviction across the founding arguments?
                </p>
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 pb-2 mb-1 border-b border-surface-300/30">
                  <p className="text-[10px] text-for-400 font-mono font-bold uppercase text-right">FOR</p>
                  <div />
                  <p className="text-[10px] text-against-400 font-mono font-bold uppercase">AGAINST</p>
                </div>
                {data.distribution.map((band) => (
                  <DistributionRow key={band.label} band={band} />
                ))}
              </div>
            )}

            {/* No data fallback */}
            {data.stats.totalArgs === 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
                <Brain className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white mb-1">No founding arguments on record</p>
                <p className="text-xs text-surface-500">
                  This law was established without any debate arguments — conviction analysis requires argument data.
                </p>
                {data.topic_id && (
                  <Link
                    href={`/topic/${data.topic_id}/arguments`}
                    className="inline-flex items-center gap-1.5 mt-4 text-xs text-for-400 hover:text-for-300 transition-colors"
                  >
                    View founding topic →
                  </Link>
                )}
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/law/${id}/mandate`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Shield className="h-3 w-3" /> Mandate
              </Link>
              <Link
                href={`/law/${id}/origins`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Gavel className="h-3 w-3" /> Origins
              </Link>
              <Link
                href={`/law/${id}/scorecard`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Award className="h-3 w-3" /> Scorecard
              </Link>
              {data.topic_id && (
                <Link
                  href={`/topic/${data.topic_id}/conviction`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Brain className="h-3 w-3" /> Topic Conviction
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
