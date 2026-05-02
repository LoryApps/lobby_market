'use client'

/**
 * /analytics/sentiment — Civic Sentiment Explorer
 *
 * Analyses the language used across platform arguments to surface the
 * emotional tone of civic discourse: which categories debate with hope
 * vs concern, and how the user's own voice compares to the community.
 *
 * Scoring is lexicon-based (no external API) — fast, deterministic, and
 * transparent about its methodology.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Heart,
  MessageSquare,
  RefreshCw,
  Scale,
  Smile,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  SentimentResponse,
  CategorySentiment,
  SentimentArgument,
} from '@/app/api/analytics/sentiment/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sentimentLabel(score: number): string {
  if (score > 0.35) return 'Optimistic'
  if (score > 0.15) return 'Hopeful'
  if (score > 0.05) return 'Constructive'
  if (score < -0.35) return 'Alarmed'
  if (score < -0.15) return 'Critical'
  if (score < -0.05) return 'Cautious'
  return 'Balanced'
}

function sentimentColor(score: number): string {
  if (score > 0.15) return 'text-emerald'
  if (score < -0.15) return 'text-against-400'
  return 'text-gold'
}

function sentimentBg(score: number): string {
  if (score > 0.15) return 'bg-emerald/10 border-emerald/30'
  if (score < -0.15) return 'bg-against-500/10 border-against-500/30'
  return 'bg-gold/10 border-gold/30'
}

function rankLabel(rank: string): { label: string; color: string; desc: string } {
  switch (rank) {
    case 'optimist':
      return { label: 'The Optimist', color: 'text-emerald', desc: 'Your arguments lean hopeful — you tend to highlight benefits and opportunities.' }
    case 'critic':
      return { label: 'The Critic', color: 'text-against-400', desc: 'Your arguments raise important concerns — you tend to highlight risks and downsides.' }
    case 'realist':
      return { label: 'The Realist', color: 'text-surface-300', desc: 'Your arguments are factual and neutral — you stick to analysis over emotion.' }
    default:
      return { label: 'The Balanced Voice', color: 'text-gold', desc: 'Your arguments blend hope and concern — you see both sides clearly.' }
  }
}

// ─── Sentiment bar ────────────────────────────────────────────────────────────

function SentimentBar({ positive, neutral, negative, total }: {
  positive: number; neutral: number; negative: number; total: number
}) {
  if (total === 0) return null
  const pct = (n: number) => Math.round((n / total) * 100)
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
      <div
        className="bg-emerald transition-all"
        style={{ width: `${pct(positive)}%` }}
        title={`${pct(positive)}% positive`}
      />
      <div
        className="bg-surface-400 transition-all"
        style={{ width: `${pct(neutral)}%` }}
        title={`${pct(neutral)}% neutral`}
      />
      <div
        className="bg-against-500 transition-all"
        style={{ width: `${pct(negative)}%` }}
        title={`${pct(negative)}% critical`}
      />
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, positive }: { arg: SentimentArgument; positive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 bg-surface-100',
        positive
          ? 'border-emerald/20 hover:border-emerald/40'
          : 'border-against-500/20 hover:border-against-500/40',
        'transition-colors'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name || arg.author_username}
          size="xs"
        />
        <Link
          href={`/profile/${arg.author_username}`}
          className="text-xs font-mono font-semibold text-white hover:text-for-300 transition-colors"
        >
          {arg.author_display_name || `@${arg.author_username}`}
        </Link>
        {arg.side && (
          <span className={cn(
            'ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
            arg.side === 'for'
              ? 'bg-for-500/20 text-for-400'
              : 'bg-against-500/20 text-against-400'
          )}>
            {arg.side === 'for' ? 'FOR' : 'AGAINST'}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-surface-700 leading-relaxed mb-3 line-clamp-3">
        {arg.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Link
          href={`/topic/${arg.topic_id}`}
          className="text-[11px] font-mono text-surface-500 hover:text-surface-300 truncate max-w-[70%] transition-colors"
        >
          {arg.topic_statement.slice(0, 60)}{arg.topic_statement.length > 60 ? '…' : ''}
        </Link>
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500 flex-shrink-0">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </div>
      </div>

      {/* Sentiment score pill */}
      <div className="mt-2">
        <span className={cn(
          'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
          sentimentBg(arg.score)
        )}>
          <span className={sentimentColor(arg.score)}>
            {sentimentLabel(arg.score)}
          </span>
          <span className="text-surface-500 ml-1">
            {(arg.score * 100).toFixed(0)}%
          </span>
        </span>
      </div>
    </motion.div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, rank }: { cat: CategorySentiment; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="flex items-center gap-3 py-3 border-b border-surface-300/40 last:border-0"
    >
      {/* Rank */}
      <span className="w-5 text-[11px] font-mono text-surface-500 text-right flex-shrink-0">
        {rank + 1}
      </span>

      {/* Category label */}
      <span className="w-24 text-xs font-mono text-white flex-shrink-0">
        {cat.category}
      </span>

      {/* Bar */}
      <div className="flex-1 min-w-0">
        <SentimentBar
          positive={cat.positive}
          neutral={cat.neutral}
          negative={cat.negative}
          total={cat.total}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] font-mono text-emerald w-8 text-right">
          {Math.round(cat.positiveRate * 100)}%
        </span>
        <span className="text-[11px] font-mono text-against-400 w-8 text-right">
          {Math.round(cat.negativeRate * 100)}%
        </span>
        <span className={cn('text-[11px] font-mono w-20 text-right', sentimentColor(cat.avgScore))}>
          {sentimentLabel(cat.avgScore)}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SentimentPage() {
  const [data, setData] = useState<SentimentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'positive' | 'critical'>('positive')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/sentiment')
      if (res.ok) {
        const json: SentimentResponse = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const user = data?.userSentiment
  const userRank = user ? rankLabel(user.rank) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors mt-1 flex-shrink-0"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Heart className="h-5 w-5 text-against-400" />
              <h1 className="font-mono text-2xl font-bold text-white">Sentiment Explorer</h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              The emotional tone of civic arguments across all categories — last 60 days
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh sentiment data"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && !data ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !data ? (
          <EmptyState
            icon={Heart}
            title="No sentiment data yet"
            description="Sentiment analysis requires at least a few recent arguments. Check back once debates are active."
          />
        ) : (
          <div className="space-y-6">

            {/* ── Platform overview card ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-for-400" />
                <h2 className="font-mono text-sm font-bold text-white">Platform Mood</h2>
                <span className="ml-auto text-[11px] font-mono text-surface-500">
                  {data.platform.total.toLocaleString()} arguments
                </span>
              </div>

              {/* Big sentiment bar */}
              <div className="mb-3">
                <SentimentBar
                  positive={data.platform.positive}
                  neutral={data.platform.neutral}
                  negative={data.platform.negative}
                  total={data.platform.total}
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center">
                  <div className="text-xl font-mono font-bold text-emerald">
                    {Math.round(data.platform.positiveRate * 100)}%
                  </div>
                  <div className="text-[11px] font-mono text-surface-500 mt-0.5">Hopeful</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-mono font-bold text-surface-300">
                    {Math.round((1 - data.platform.positiveRate - data.platform.negativeRate) * 100)}%
                  </div>
                  <div className="text-[11px] font-mono text-surface-500 mt-0.5">Neutral</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-mono font-bold text-against-400">
                    {Math.round(data.platform.negativeRate * 100)}%
                  </div>
                  <div className="text-[11px] font-mono text-surface-500 mt-0.5">Critical</div>
                </div>
              </div>

              {/* Overall tone */}
              <div className={cn(
                'mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border text-sm font-mono font-semibold',
                sentimentBg(data.platform.avgScore)
              )}>
                {data.platform.avgScore > 0.05 ? (
                  <Smile className="h-4 w-4 text-emerald" />
                ) : data.platform.avgScore < -0.05 ? (
                  <TrendingDown className="h-4 w-4 text-against-400" />
                ) : (
                  <Scale className="h-4 w-4 text-gold" />
                )}
                <span className={sentimentColor(data.platform.avgScore)}>
                  Overall: {sentimentLabel(data.platform.avgScore)}
                </span>
              </div>
            </motion.div>

            {/* ── Your sentiment profile ─────────────────────────────────── */}
            {user && userRank && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="font-mono text-sm font-bold text-white">Your Voice Profile</h2>
                  <span className="ml-auto text-[11px] font-mono text-surface-500">
                    {user.total} argument{user.total !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-lg font-mono font-bold mb-1', userRank.color)}>
                      {userRank.label}
                    </div>
                    <p className="text-xs font-mono text-surface-500 leading-relaxed">
                      {userRank.desc}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn('text-2xl font-mono font-bold', sentimentColor(user.avgScore))}>
                      {user.avgScore > 0 ? '+' : ''}{(user.avgScore * 100).toFixed(0)}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500">avg score</div>
                  </div>
                </div>

                {/* Compare to platform */}
                <div className="mt-3 pt-3 border-t border-surface-300/40">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-surface-500">Your hopeful rate</span>
                    <span className="text-emerald font-semibold">
                      {Math.round(user.positiveRate * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                    <span className="text-surface-500">Platform average</span>
                    <span className="text-surface-300 font-semibold">
                      {Math.round(data.platform.positiveRate * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                    <span className="text-surface-500">Your vs. average</span>
                    <span className={cn(
                      'font-semibold',
                      user.positiveRate > data.platform.positiveRate ? 'text-emerald' : 'text-against-400'
                    )}>
                      {user.positiveRate > data.platform.positiveRate ? '+' : ''}
                      {Math.round((user.positiveRate - data.platform.positiveRate) * 100)} pts
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Category breakdown ─────────────────────────────────────── */}
            {data.categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-purple" />
                  <h2 className="font-mono text-sm font-bold text-white">By Category</h2>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mb-3 text-[10px] font-mono text-surface-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald" />
                    Hopeful
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-surface-400" />
                    Neutral
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-against-500" />
                    Critical
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-emerald w-8 text-right">+ve</span>
                    <span className="text-against-400 w-8 text-right">-ve</span>
                    <span className="w-20 text-right">Tone</span>
                  </div>
                </div>

                <div className="divide-y divide-transparent">
                  {data.categories.map((cat, i) => (
                    <CategoryRow key={cat.category} cat={cat} rank={i} />
                  ))}
                </div>

                {/* Most optimistic vs most critical */}
                {data.categories.length >= 2 && (
                  <div className="mt-4 pt-4 border-t border-surface-300/40 grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-[10px] font-mono text-surface-500 mb-1">Most Hopeful</div>
                      <div className="font-mono text-sm font-bold text-emerald">
                        {data.categories[0].category}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-mono text-surface-500 mb-1">Most Critical</div>
                      <div className="font-mono text-sm font-bold text-against-400">
                        {data.categories[data.categories.length - 1].category}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Top arguments by sentiment ─────────────────────────────── */}
            {(data.topPositive.length > 0 || data.topNegative.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
              >
                {/* Tab bar */}
                <div className="flex border-b border-surface-300">
                  <button
                    onClick={() => setTab('positive')}
                    aria-pressed={tab === 'positive'}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-mono font-semibold transition-colors',
                      tab === 'positive'
                        ? 'text-emerald bg-emerald/5 border-b-2 border-emerald'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Most Hopeful
                  </button>
                  <button
                    onClick={() => setTab('critical')}
                    aria-pressed={tab === 'critical'}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-mono font-semibold transition-colors',
                      tab === 'critical'
                        ? 'text-against-400 bg-against-500/5 border-b-2 border-against-500'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Most Critical
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <AnimatePresence mode="wait">
                    {tab === 'positive' ? (
                      <motion.div
                        key="positive"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                      >
                        {data.topPositive.length === 0 ? (
                          <p className="text-sm font-mono text-surface-500 text-center py-4">
                            No strongly positive arguments yet
                          </p>
                        ) : (
                          data.topPositive.map((arg) => (
                            <ArgumentCard key={arg.id} arg={arg} positive />
                          ))
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="critical"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                      >
                        {data.topNegative.length === 0 ? (
                          <p className="text-sm font-mono text-surface-500 text-center py-4">
                            No strongly critical arguments yet
                          </p>
                        ) : (
                          data.topNegative.map((arg) => (
                            <ArgumentCard key={arg.id} arg={arg} positive={false} />
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* ── Methodology note ───────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-surface-300/40 bg-surface-200/40 p-4"
            >
              <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                <span className="text-surface-400 font-semibold">Methodology:</span> Sentiment is
                scored using a civic-tuned lexicon of ~100 positive and ~80 critical civic terms.
                Each argument receives a score from −1 (highly critical) to +1 (highly optimistic),
                normalized by argument length. This is a transparent, deterministic method — no AI
                or external APIs are used.
              </p>
            </motion.div>

            {/* ── CTA links ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-500 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Analytics
              </Link>
              <Link
                href="/analytics/evolution"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-500 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Opinion Evolution
              </Link>
              <Link
                href="/arguments"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-500 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                All Arguments
              </Link>
              <Link
                href="/compass"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-500 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Civic Compass
              </Link>
            </div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
