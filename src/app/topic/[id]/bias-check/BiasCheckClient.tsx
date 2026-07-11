'use client'

/**
 * /topic/[id]/bias-check — Debate Balance Checker
 *
 * Analyses whether a topic's debate is balanced across four dimensions:
 *   • Argument Volume  — equal number of FOR / AGAINST arguments?
 *   • Community Engagement — upvotes distributed evenly?
 *   • Argument Depth   — both sides writing equally detailed arguments?
 *   • Source Citation  — both sides citing evidence equally?
 *
 * Plus a statement framing scan for emotionally loaded language.
 *
 * No AI required — pure data-driven analysis from argument statistics.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Info,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BiasCheckResponse, BalanceDimension, SideStat, LoadedWord } from '@/app/api/topics/[id]/bias-check/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
}

// ─── Balance ring ─────────────────────────────────────────────────────────────

function BalanceRing({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color =
    score >= 75
      ? '#10b981'
      : score >= 55
      ? '#f59e0b'
      : score >= 35
      ? '#f97316'
      : '#ef4444'

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
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-black text-white tabular-nums">{score}</span>
        <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest">
          balance
        </span>
      </div>
    </div>
  )
}

// ─── Verdict pill ─────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  balanced: {
    label: 'Well Balanced',
    icon: CheckCircle2,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Both sides of this debate are roughly equally represented and engaged.',
  },
  leaning_for: {
    label: 'Leans FOR',
    icon: ThumbsUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'The FOR side has a stronger presence in this debate.',
  },
  leaning_against: {
    label: 'Leans AGAINST',
    icon: ThumbsDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'The AGAINST side has a stronger presence in this debate.',
  },
  one_sided: {
    label: 'One-Sided',
    icon: AlertTriangle,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'This debate is significantly dominated by one side.',
  },
}

// ─── Dimension bar ────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: BalanceDimension }) {
  const forVal = dim.forScore
  const againstVal = dim.againstScore
  const total = forVal + againstVal
  const forPct = total === 0 ? 50 : (forVal / total) * 100
  const againstPct = 100 - forPct

  const balanced = Math.abs(forPct - 50) <= 15

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-semibold text-surface-600 uppercase tracking-wider">
          {dim.label}
        </span>
        <span
          className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
            balanced
              ? 'bg-emerald/10 text-emerald border border-emerald/30'
              : 'bg-gold/10 text-gold border border-gold/30'
          )}
        >
          {balanced ? 'Balanced' : 'Skewed'}
        </span>
      </div>

      {/* FOR / AGAINST bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300 flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-for-600 to-for-500 rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          className="h-full bg-gradient-to-r from-against-500 to-against-600 rounded-r-full"
        />
        {/* Centre marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-100/60 -translate-x-px" />
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400">
          FOR {dim.key === 'volume' ? `${dim.forScore}` : dim.key === 'depth' ? `${dim.forScore}ch` : `${dim.forScore}${dim.key === 'evidence' ? '%' : ''}`}
        </span>
        <span className="text-surface-500 text-[10px] text-center max-w-[140px] leading-tight">
          {dim.note}
        </span>
        <span className="text-against-400">
          {dim.key === 'volume' ? `${dim.againstScore}` : dim.key === 'depth' ? `${dim.againstScore}ch` : `${dim.againstScore}${dim.key === 'evidence' ? '%' : ''}`} AGAINST
        </span>
      </div>
    </div>
  )
}

// ─── Side summary card ────────────────────────────────────────────────────────

function SideCard({
  side,
  stats,
}: {
  side: 'for' | 'against'
  stats: SideStat
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-xl p-4 border space-y-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-2">
        {isFor ? (
          <ThumbsUp className="h-4 w-4 text-for-400" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-against-400" />
        )}
        <span
          className={cn(
            'text-xs font-mono font-bold uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'For' : 'Against'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Arguments', value: stats.count.toString() },
          { label: 'Avg upvotes', value: stats.avgUpvotes.toFixed(1) },
          { label: 'Avg length', value: `${stats.avgLength}ch` },
          { label: 'With sources', value: `${stats.sourcedPct}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-surface-200/50 px-3 py-2">
            <p className="text-[10px] text-surface-500 font-mono">{label}</p>
            <p className="text-sm font-black text-white tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {stats.topArgument && (
        <div className="rounded-lg bg-surface-200/40 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            {stats.topArgument.authorAvatar && (
              <Avatar
                src={stats.topArgument.authorAvatar}
                fallback={stats.topArgument.authorUsername ?? '?'}
                size="xs"
              />
            )}
            <span className="text-[11px] text-surface-500 font-mono">
              Top argument · {stats.topArgument.upvotes} upvotes
            </span>
          </div>
          <p className="text-xs text-surface-600 line-clamp-3 leading-relaxed">
            {stats.topArgument.content}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Statement framing section ────────────────────────────────────────────────

function StatementFraming({
  statement,
  loadedWords,
  biasScore,
}: {
  statement: string
  loadedWords: LoadedWord[]
  biasScore: number
}) {
  const severity =
    biasScore === 0 ? 'neutral' : biasScore < 30 ? 'mild' : biasScore < 60 ? 'moderate' : 'heavy'

  const severityConfig = {
    neutral: {
      label: 'Neutral framing',
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/30',
      icon: CheckCircle2,
    },
    mild: {
      label: 'Mildly loaded',
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/30',
      icon: Info,
    },
    moderate: {
      label: 'Moderately loaded',
      color: 'text-against-400',
      bg: 'bg-against-500/10',
      border: 'border-against-500/30',
      icon: AlertTriangle,
    },
    heavy: {
      label: 'Heavily loaded',
      color: 'text-against-400',
      bg: 'bg-against-500/10',
      border: 'border-against-500/30',
      icon: AlertTriangle,
    },
  }

  const cfg = severityConfig[severity]
  const Icon = cfg.icon

  return (
    <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-surface-500" />
          <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
            Statement Framing
          </span>
        </div>
        <span
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border',
            cfg.bg,
            cfg.border,
            cfg.color
          )}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {cfg.label}
        </span>
      </div>

      <p className="text-sm text-surface-600 leading-relaxed">
        &ldquo;{statement}&rdquo;
      </p>

      {loadedWords.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-surface-500 font-mono">
            Potentially loaded words detected ({loadedWords.length}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {loadedWords.map((lw, i) => (
              <span
                key={i}
                title={lw.context}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-mono font-semibold border',
                  lw.weight === 3
                    ? 'bg-against-500/15 border-against-500/40 text-against-400'
                    : lw.weight === 2
                    ? 'bg-gold/15 border-gold/40 text-gold'
                    : 'bg-surface-300 border-surface-400 text-surface-600'
                )}
              >
                {lw.word}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-surface-500">
            Red = heavy · Yellow = moderate · Grey = mild. Hover for context.
          </p>
        </div>
      ) : (
        <p className="text-xs text-emerald">
          No emotionally loaded or politically charged language detected in the statement.
        </p>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BiasCheckSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BiasCheckClient({ topicId, topicStatement }: Props) {
  const params = useParams<{ id: string }>()
  const id = topicId || params.id

  const [data, setData] = useState<BiasCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/bias-check`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Unable to load bias check data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const verdict = data ? VERDICT_CONFIG[data.verdict] : null
  const VerdictIcon = verdict?.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/topic/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">Debate Balance Check</h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5 line-clamp-1">
              {topicStatement}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BiasCheckSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-against-500/10 border border-against-500/30 p-6 text-center space-y-3"
            >
              <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
              <p className="text-sm text-against-400">{error}</p>
              <button
                onClick={load}
                className="text-xs font-mono text-surface-500 hover:text-white underline transition-colors"
              >
                Try again
              </button>
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Balance score + verdict */}
              <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-5">
                <div className="flex items-center gap-6">
                  <BalanceRing score={data.balanceScore} />

                  <div className="flex-1 space-y-3">
                    {verdict && VerdictIcon && (
                      <div
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono font-bold border',
                          verdict.bg,
                          verdict.border,
                          verdict.color
                        )}
                      >
                        <VerdictIcon className="h-4 w-4" aria-hidden="true" />
                        {verdict.label}
                      </div>
                    )}
                    <p className="text-sm text-surface-600 leading-relaxed">
                      {verdict?.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {data.totalArguments} arguments
                      </span>
                      <span className="flex items-center gap-1">
                        <Scale className="h-3.5 w-3.5" />
                        {Math.round(data.topic.blue_pct)}% FOR
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side-by-side stats */}
              <div className="grid grid-cols-2 gap-3">
                <SideCard side="for" stats={data.forStats} />
                <SideCard side="against" stats={data.againstStats} />
              </div>

              {/* Dimensions */}
              <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-surface-500" />
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                    Balance Dimensions
                  </h2>
                </div>
                {data.dimensions.map((dim) => (
                  <DimensionBar key={dim.key} dim={dim} />
                ))}
              </div>

              {/* Statement framing */}
              <StatementFraming
                statement={data.topic.statement}
                loadedWords={data.loadedWords}
                biasScore={data.statementBiasScore}
              />

              {/* Interpretation note */}
              <div className="rounded-xl bg-surface-200/30 border border-surface-300/40 p-4 flex gap-3">
                <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-surface-500 font-mono font-semibold">How this works</p>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Balance is measured across argument volume, community upvote engagement, argument depth (character count), and source citation rates. Statement framing checks for emotionally charged or politically loaded vocabulary in the topic&rsquo;s wording. This is a data-driven analysis — it does not assess factual accuracy.
                  </p>
                </div>
              </div>

              {/* Navigation links */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: `/topic/${id}/sentiment`, label: 'Discourse Sentiment', icon: Shield },
                  { href: `/topic/${id}/arguments`, label: 'All Arguments', icon: MessageSquare },
                  { href: `/topic/${id}/evidence`, label: 'Evidence', icon: BookOpen },
                  { href: `/topic/${id}/quality`, label: 'Argument Quality', icon: Zap },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface-200/40 border border-surface-300/60 px-4 py-3 hover:border-surface-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                      <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors truncate">
                        {label}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
