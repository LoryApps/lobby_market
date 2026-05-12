'use client'

/**
 * /arguments/[id]/analytics — Argument Engagement Analytics
 *
 * Shows engagement metrics for a single argument:
 *   - Upvotes, reactions, replies, age
 *   - Reaction type breakdown (insightful / compelling / balanced / needs source)
 *   - Topic rank and same-side rank by upvotes
 *   - Upvote velocity (upvotes per day since posting)
 *   - Composite engagement score
 *
 * Distinct from /arguments/[id]/critique which shows AI quality analysis.
 * This page measures community REACH and RESONANCE.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  ChevronUp,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ArgumentAnalyticsData, ArgumentAnalyticsResponse } from '@/app/api/arguments/[id]/analytics/route'

// ─── Reaction config ──────────────────────────────────────────────────────────

const REACTION_CONFIG = [
  { key: 'insightful',     emoji: '💡', label: 'Insightful',    bar: 'bg-for-400',      text: 'text-for-300' },
  { key: 'compelling',     emoji: '🔥', label: 'Compelling',    bar: 'bg-against-400',  text: 'text-against-300' },
  { key: 'balanced',       emoji: '⚖️', label: 'Balanced',      bar: 'bg-emerald',      text: 'text-emerald' },
  { key: 'needs_evidence', emoji: '🔍', label: 'Needs source',  bar: 'bg-gold',         text: 'text-gold' },
] as const

type ReactionKey = 'insightful' | 'compelling' | 'balanced' | 'needs_evidence'

// ─── Engagement tier ──────────────────────────────────────────────────────────

function engagementTier(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 40) return { label: 'High Impact',    color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' }
  if (score >= 15) return { label: 'Good Traction',  color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' }
  if (score >= 5)  return { label: 'Moderate',        color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' }
  return                  { label: 'Early Stage',    color: 'text-surface-400',  bg: 'bg-surface-700/50',  border: 'border-surface-600/30' }
}

// ─── Rank ordinal ──────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// ─── Animated bar ─────────────────────────────────────────────────────────────

function ReactionBar({
  emoji,
  label,
  count,
  total,
  bar,
  text,
  delay,
}: {
  emoji: string
  label: string
  count: number
  total: number
  bar: string
  text: string
  delay: number
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 flex-shrink-0 text-center" aria-hidden>{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-xs font-mono font-medium', text)}>{label}</span>
          <span className="text-xs font-mono text-surface-500">{count} ({pct}%)</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', bar)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Rank card ────────────────────────────────────────────────────────────────

function RankCard({
  title,
  rank,
  total,
  icon: Icon,
  color,
  bg,
  border,
}: {
  title: string
  rank: number
  total: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}) {
  const pct = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100

  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-2', bg, border)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
        <span className="text-xs font-mono text-surface-400">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-mono font-bold', color)}>{ordinal(rank)}</span>
        <span className="text-xs font-mono text-surface-500">of {total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <p className="text-[11px] font-mono text-surface-500">
        Better than {pct}% of arguments
      </p>
    </div>
  )
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface-800 border border-surface-700">
      <Icon className={cn('h-4 w-4', color)} aria-hidden />
      <span className={cn('text-lg font-mono font-bold', color)}>{value}</span>
      <span className="text-[10px] font-mono text-surface-500 text-center">{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArgumentAnalyticsPage() {
  const params = useParams()
  const argId = params?.id as string | undefined

  const [data, setData] = useState<ArgumentAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!argId) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.fetch(`/api/arguments/${argId}/analytics`)
      const json = (await res.json()) as ArgumentAnalyticsResponse
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed to load analytics')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [argId])

  useEffect(() => { fetch() }, [fetch])

  const isFor = data?.side === 'blue'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'

  const tier = data ? engagementTier(data.engagement_score) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Back link */}
        {argId && (
          <Link
            href={`/arguments/${argId}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to argument
          </Link>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-24 rounded-xl" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-40 rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="text-center py-16">
            <BarChart2 className="h-10 w-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-mono text-surface-400 mb-4">{error}</p>
            <button
              onClick={fetch}
              className="inline-flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              <Loader2 className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Content ── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Argument header */}
            <div className={cn('rounded-xl border p-4 space-y-3', sideBg, sideBorder)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border', sideBg, sideBorder, sideColor)}>
                  {sideLabel}
                </span>
                {data.ai_grade && (
                  <span className="text-[10px] font-mono font-bold text-purple bg-purple/10 border border-purple/30 px-2 py-0.5 rounded-full">
                    Grade {data.ai_grade}
                  </span>
                )}
                {data.topic.category && (
                  <Badge variant="proposed" className="text-[10px]">{data.topic.category}</Badge>
                )}
              </div>
              <p className="text-sm font-mono text-white leading-relaxed">
                {data.content.slice(0, 220)}{data.content.length > 220 ? '…' : ''}
              </p>
              <div className="flex items-center gap-3 pt-1">
                {data.author && (
                  <div className="flex items-center gap-1.5">
                    <Avatar src={data.author.avatar_url} alt={data.author.username} size="xs" />
                    <Link
                      href={`/profile/${data.author.username}`}
                      className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
                    >
                      {data.author.display_name ?? `@${data.author.username}`}
                    </Link>
                  </div>
                )}
                <span className="text-surface-700">·</span>
                <Link
                  href={`/topic/${data.topic.id}`}
                  className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors min-w-0"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[200px]">{data.topic.statement.slice(0, 50)}{data.topic.statement.length > 50 ? '…' : ''}</span>
                </Link>
              </div>
            </div>

            {/* 4-stat row */}
            <div className="grid grid-cols-4 gap-2">
              <StatChip icon={ChevronUp} value={data.upvotes}     label="Upvotes"   color="text-for-400" />
              <StatChip icon={Users}    value={data.reactions.total} label="Reactions" color="text-purple" />
              <StatChip icon={MessageSquare} value={data.reply_count} label="Replies" color="text-emerald" />
              <StatChip icon={Flame}    value={`${data.days_alive}d`} label="Age"    color="text-gold" />
            </div>

            {/* Engagement score */}
            {tier && (
              <div className={cn('rounded-xl border p-4', tier.bg, tier.border)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className={cn('h-4 w-4', tier.color)} aria-hidden />
                    <span className="text-xs font-mono text-surface-400">Engagement Score</span>
                  </div>
                  <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-full border', tier.bg, tier.border, tier.color)}>
                    {tier.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-3xl font-mono font-bold', tier.color)}>{data.engagement_score}</span>
                  <span className="text-xs font-mono text-surface-500">points</span>
                </div>
                <p className="text-[11px] font-mono text-surface-500 mt-1.5">
                  {data.upvotes}×3 upvotes + {data.reactions.total}×2 reactions + {data.reply_count} replies
                </p>
                <div className="mt-3 flex items-center gap-4 pt-3 border-t border-surface-700/50">
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-against-400" aria-hidden />
                    <span className="text-xs font-mono text-surface-400">
                      <span className="text-white font-semibold">{data.upvote_velocity}</span> upvotes/day
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-gold" aria-hidden />
                    <span className="text-xs font-mono text-surface-400">
                      Posted <span className="text-white font-semibold">{data.days_alive}d</span> ago
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Reaction breakdown */}
            {data.reactions.total > 0 ? (
              <div className="rounded-xl border border-surface-700 bg-surface-800/40 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple" aria-hidden />
                  <h2 className="text-sm font-mono font-semibold text-white">Reaction Breakdown</h2>
                  <span className="text-xs font-mono text-surface-500 ml-auto">{data.reactions.total} total</span>
                </div>
                <div className="space-y-3">
                  {REACTION_CONFIG.map((cfg, i) => (
                    <ReactionBar
                      key={cfg.key}
                      emoji={cfg.emoji}
                      label={cfg.label}
                      count={data.reactions[cfg.key as ReactionKey]}
                      total={data.reactions.total}
                      bar={cfg.bar}
                      text={cfg.text}
                      delay={i * 0.1}
                    />
                  ))}
                </div>
                {data.reactions.insightful >= data.reactions.compelling &&
                 data.reactions.insightful >= data.reactions.balanced &&
                 data.reactions.insightful >= data.reactions.needs_evidence &&
                 data.reactions.insightful > 0 && (
                  <p className="text-[11px] font-mono text-for-300 border-t border-surface-700 pt-3">
                    💡 Readers find this argument shifts their thinking most often.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-surface-700 bg-surface-800/20 p-5 text-center">
                <Users className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                <p className="text-xs font-mono text-surface-500">No reactions yet</p>
              </div>
            )}

            {/* Topic rank panels */}
            <div className="grid grid-cols-2 gap-3">
              <RankCard
                title="All arguments on topic"
                rank={data.topic_rank}
                total={data.topic_total}
                icon={Trophy}
                color="text-gold"
                bg="bg-gold/5"
                border="border-gold/20"
              />
              <RankCard
                title={`${sideLabel} side rank`}
                rank={data.side_rank}
                total={data.side_total}
                icon={BarChart2}
                color={isFor ? 'text-for-400' : 'text-against-400'}
                bg={isFor ? 'bg-for-500/5' : 'bg-against-500/5'}
                border={isFor ? 'border-for-500/20' : 'border-against-500/20'}
              />
            </div>

            {/* Related links */}
            <div className="flex flex-col gap-2 pt-2">
              {argId && (
                <Link
                  href={`/arguments/${argId}/critique`}
                  className="flex items-center justify-between rounded-xl border border-purple/20 bg-purple/5 px-4 py-3 hover:bg-purple/10 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple" aria-hidden />
                    <span className="text-sm font-mono text-white">
                      {data.ai_grade ? 'View AI critique breakdown' : 'Generate AI critique'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-purple group-hover:text-white transition-colors">
                    {data.ai_grade ? `Grade ${data.ai_grade}` : 'Ungraded'} →
                  </span>
                </Link>
              )}
              {argId && (
                <Link
                  href={`/arguments/${argId}`}
                  className="flex items-center justify-between rounded-xl border border-surface-700 bg-surface-800/30 px-4 py-3 hover:bg-surface-800 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-surface-400" aria-hidden />
                    <span className="text-sm font-mono text-white">View full argument & replies</span>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-surface-500 rotate-180 group-hover:text-white transition-colors" />
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
