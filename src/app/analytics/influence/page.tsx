'use client'

/**
 * /analytics/influence — Civic Influence Score
 *
 * A composite score (0–100) measuring how much civic impact your arguments,
 * follower reach, and legislative instincts have generated on the platform.
 *
 * Score breakdown:
 *   Engagement  (0–40) — total argument upvotes received (log scale)
 *   Quality     (0–25) — avg AI grade + citation rate
 *   Reach       (0–20) — follower count (log scale)
 *   Civic Impact(0–15) — legislative accuracy on resolved topics
 *
 * Distinct from:
 *   /analytics/arguments   — argument portfolio list (not score-based)
 *   /analytics/discourse   — discourse quality over time
 *   /analytics/benchmark   — cohort comparison (join-date peers)
 *   /analytics/snapshot    — identity card summary
 *   /impact                — civic impact of laws + predictions
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Link2,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  InfluenceResponse,
  InfluenceTier,
  TopArgument,
  CategoryEngagement,
  LegislativePick,
} from '@/app/api/analytics/influence/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<InfluenceTier, { border: string; bg: string; text: string; glow: string }> = {
  amplifier:   { border: 'border-gold/50',       bg: 'bg-gold/10',       text: 'text-gold',       glow: 'shadow-gold/20' },
  advocate:    { border: 'border-for-400/50',    bg: 'bg-for-500/10',    text: 'text-for-400',    glow: 'shadow-for-500/20' },
  contributor: { border: 'border-emerald/50',    bg: 'bg-emerald/10',    text: 'text-emerald',    glow: 'shadow-emerald/20' },
  emerging:    { border: 'border-purple/50',     bg: 'bg-purple/10',     text: 'text-purple',     glow: 'shadow-purple/20' },
  newcomer:    { border: 'border-surface-400/50',bg: 'bg-surface-300/10',text: 'text-surface-400',glow: '' },
}

const TIER_ICONS: Record<InfluenceTier, typeof Sparkles> = {
  amplifier:   Zap,
  advocate:    TrendingUp,
  contributor: BarChart2,
  emerging:    Sparkles,
  newcomer:    Users,
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald bg-emerald/10 border-emerald/30',
  B: 'text-for-400 bg-for-500/10 border-for-500/30',
  C: 'text-gold bg-gold/10 border-gold/30',
  D: 'text-against-400 bg-against-500/10 border-against-500/30',
  F: 'text-surface-400 bg-surface-300/10 border-surface-400/30',
}

// ─── Status label ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  law: 'LAW',
  failed: 'FAILED',
  active: 'ACTIVE',
  proposed: 'PROPOSED',
  voting: 'VOTING',
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  max,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  max: number
  color: string
  icon: typeof BarChart2
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 text-surface-400">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className={cn('font-semibold', color)}>
          {value}<span className="text-surface-600 font-normal">/{max}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InfluenceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: TopArgument }) {
  const sideColor = arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
  const sideBg = arg.side === 'blue' ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = arg.side === 'blue' ? 'border-for-500/20' : 'border-against-500/20'

  return (
    <Link
      href={`/topic/${arg.topic_id}`}
      className={cn(
        'block rounded-xl border p-4 transition-colors',
        sideBorder,
        sideBg,
        'hover:opacity-90'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', sideColor)}>
          {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {arg.ai_grade && (
            <span className={cn(
              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
              GRADE_COLORS[arg.ai_grade] ?? 'text-surface-400'
            )}>
              {arg.ai_grade}
            </span>
          )}
          {arg.has_citation && (
            <Link2 className="h-3 w-3 text-surface-500" />
          )}
        </div>
      </div>
      <p className="text-sm text-surface-200 line-clamp-2 mb-3">{arg.content}</p>
      <div className="flex items-center justify-between text-xs font-mono text-surface-500">
        <span className="truncate mr-2 text-surface-400">{arg.topic_statement.slice(0, 50)}{arg.topic_statement.length > 50 ? '…' : ''}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />{arg.upvotes}
          </span>
          {arg.reply_count > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />{arg.reply_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, maxUpvotes }: { cat: CategoryEngagement; maxUpvotes: number }) {
  const pct = maxUpvotes > 0 ? Math.min(100, (cat.total_upvotes / maxUpvotes) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 flex-shrink-0 text-xs font-mono text-surface-400 truncate">
        {cat.category}
      </div>
      <div className="flex-1 relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-for-600 to-for-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-xs font-mono w-28 flex-shrink-0 justify-end">
        <span className="text-surface-400">{cat.argument_count} args</span>
        <span className="text-for-400 font-semibold">{cat.total_upvotes}↑</span>
      </div>
    </div>
  )
}

// ─── Legislative pick row ─────────────────────────────────────────────────────

function LegislativePickRow({ pick }: { pick: LegislativePick }) {
  const isCorrect = pick.outcome === 'correct'
  const isLaw = pick.status === 'law'

  return (
    <Link
      href={`/topic/${pick.topic_id}`}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-200/50 transition-colors group"
    >
      <div className="flex-shrink-0 mt-0.5">
        {isCorrect ? (
          <CheckCircle2 className="h-4 w-4 text-emerald" />
        ) : (
          <XCircle className="h-4 w-4 text-against-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-200 line-clamp-1 group-hover:text-white transition-colors">
          {pick.statement}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-surface-500">
          <span className={cn(isLaw ? 'text-gold' : 'text-surface-500')}>
            {STATUS_LABEL[pick.status] ?? pick.status}
          </span>
          {pick.category && <span>· {pick.category}</span>}
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-mono">
        {pick.user_side === 'blue' ? (
          <ThumbsUp className={cn('h-3 w-3', isCorrect ? 'text-emerald' : 'text-against-400')} />
        ) : (
          <ThumbsDown className={cn('h-3 w-3', isCorrect ? 'text-emerald' : 'text-against-400')} />
        )}
        <span className={isCorrect ? 'text-emerald' : 'text-against-400'}>
          {isCorrect ? 'Correct' : 'Incorrect'}
        </span>
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InfluencePage() {
  const router = useRouter()
  const [data, setData] = useState<InfluenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'arguments' | 'categories' | 'legislative'>('arguments')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/influence')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      if (!json.authenticated) { router.push('/login'); return }
      setData(json as InfluenceResponse)
    } catch {
      setError('Could not load influence data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tier = data?.tier ?? 'newcomer'
  const tierColors = TIER_COLORS[tier]
  const TierIcon = TIER_ICONS[tier]

  const maxCatUpvotes = Math.max(
    1,
    ...(data?.category_breakdown ?? []).map((c) => c.total_upvotes)
  )

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-32 pt-4">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Civic Influence</h1>
            <p className="text-xs font-mono text-surface-500">
              How much impact your arguments, reach, and votes have
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <InfluenceSkeleton />}

        {error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-400 text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="text-for-400 text-xs font-mono hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              {/* ── Hero: score + tier ───────────────────────────────────── */}
              <div className={cn(
                'rounded-2xl border p-6',
                tierColors.border,
                tierColors.bg,
                'shadow-lg',
                tierColors.glow
              )}>
                <div className="flex items-start gap-4 mb-5">
                  <div className={cn(
                    'flex items-center justify-center h-14 w-14 rounded-xl border flex-shrink-0',
                    tierColors.border,
                    tierColors.bg
                  )}>
                    <TierIcon className={cn('h-7 w-7', tierColors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">
                      Influence Score
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className={cn('text-4xl font-mono font-bold', tierColors.text)}>
                        <AnimatedNumber value={data.influence_score} />
                      </span>
                      <span className="text-surface-600 font-mono text-lg">/100</span>
                    </div>
                    <p className={cn('text-sm font-semibold mt-0.5', tierColors.text)}>
                      {data.tier_label}
                    </p>
                  </div>
                  <Avatar
                    username={data.user.username}
                    avatarUrl={data.user.avatar_url}
                    size="sm"
                  />
                </div>
                <p className="text-sm text-surface-300 leading-relaxed mb-5">
                  {data.tier_description}
                </p>

                {/* Score breakdown bars */}
                <div className="space-y-3">
                  <ScoreBar
                    label="Engagement"
                    value={data.score_breakdown.engagement}
                    max={40}
                    color="text-for-400"
                    icon={ThumbsUp}
                  />
                  <ScoreBar
                    label="Quality"
                    value={data.score_breakdown.quality}
                    max={25}
                    color="text-emerald"
                    icon={Award}
                  />
                  <ScoreBar
                    label="Reach"
                    value={data.score_breakdown.reach}
                    max={20}
                    color="text-purple"
                    icon={Users}
                  />
                  <ScoreBar
                    label="Civic Impact"
                    value={data.score_breakdown.civic_impact}
                    max={15}
                    color="text-gold"
                    icon={Gavel}
                  />
                </div>
              </div>

              {/* ── Stat pills ───────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Upvotes Rcvd',
                    value: data.total_upvotes_received,
                    icon: ThumbsUp,
                    color: 'text-for-400',
                  },
                  {
                    label: 'Replies Rcvd',
                    value: data.total_replies_received,
                    icon: MessageSquare,
                    color: 'text-purple',
                  },
                  {
                    label: 'Followers',
                    value: data.user.followers_count,
                    icon: Users,
                    color: 'text-emerald',
                  },
                  {
                    label: 'Clout',
                    value: data.user.clout,
                    icon: Flame,
                    color: 'text-gold',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-surface-100 border border-surface-300 p-4"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                    <div className={cn('text-2xl font-mono font-bold', color)}>
                      <AnimatedNumber value={value} />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Argument quality summary ────────────────────────────── */}
              {data.total_arguments > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <BookOpen className="h-3.5 w-3.5 text-emerald" />
                    Argument Quality
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xl font-mono font-bold text-white">
                        {data.total_arguments}
                      </div>
                      <div className="text-[10px] font-mono text-surface-500 mt-0.5">Total Args</div>
                    </div>
                    <div>
                      <div className="text-xl font-mono font-bold text-emerald">
                        {data.avg_upvotes_per_argument}
                      </div>
                      <div className="text-[10px] font-mono text-surface-500 mt-0.5">Avg Upvotes</div>
                    </div>
                    <div>
                      <div className="text-xl font-mono font-bold text-gold">
                        {data.avg_ai_score !== null ? data.avg_ai_score : '—'}
                      </div>
                      <div className="text-[10px] font-mono text-surface-500 mt-0.5">Avg AI Score</div>
                    </div>
                  </div>
                  {data.citation_rate > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-xs font-mono text-surface-400">
                      <Link2 className="h-3.5 w-3.5 text-for-400" />
                      <span>
                        <span className="text-for-400 font-semibold">
                          {Math.round(data.citation_rate * 100)}%
                        </span>{' '}
                        of your arguments include a citation
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tabs ─────────────────────────────────────────────────── */}
              <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
                {(
                  [
                    { key: 'arguments', label: 'Top Arguments', icon: ThumbsUp },
                    { key: 'categories', label: 'Categories', icon: BarChart2 },
                    { key: 'legislative', label: 'Legislative', icon: Gavel },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-colors',
                      activeTab === key
                        ? 'bg-surface-100 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* ── Tab content ─────────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {activeTab === 'arguments' && (
                  <motion.div
                    key="arguments"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {data.top_arguments.length === 0 ? (
                      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
                        <BookOpen className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                        <p className="text-surface-400 text-sm">No arguments posted yet.</p>
                        <Link
                          href="/"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                        >
                          Browse topics <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : (
                      data.top_arguments.map((arg) => (
                        <ArgumentCard key={arg.id} arg={arg} />
                      ))
                    )}
                    {data.total_arguments > 10 && (
                      <Link
                        href="/arguments/mine"
                        className="flex items-center justify-center gap-2 text-xs font-mono text-surface-400 hover:text-white transition-colors py-3"
                      >
                        View all {data.total_arguments} arguments
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </motion.div>
                )}

                {activeTab === 'categories' && (
                  <motion.div
                    key="categories"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                  >
                    <div className="px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                        Upvotes by category
                      </div>
                      {data.category_breakdown.length === 0 ? (
                        <p className="text-surface-500 text-sm text-center py-6">
                          Post arguments in topics to see category breakdown.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {data.category_breakdown.map((cat) => (
                            <CategoryRow
                              key={cat.category}
                              cat={cat}
                              maxUpvotes={maxCatUpvotes}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'legislative' && (
                  <motion.div
                    key="legislative"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                  >
                    {/* Summary */}
                    <div className="px-5 pt-5 pb-4 border-b border-surface-300">
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        <Gavel className="h-3.5 w-3.5 text-gold" />
                        Legislative Footprint
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-xl font-mono font-bold text-gold">
                            {data.laws_correctly_backed}
                          </div>
                          <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                            Laws Backed
                          </div>
                        </div>
                        <div>
                          <div className="text-xl font-mono font-bold text-emerald">
                            {data.fails_correctly_opposed}
                          </div>
                          <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                            Fails Opposed
                          </div>
                        </div>
                        <div>
                          <div className={cn(
                            'text-xl font-mono font-bold',
                            data.legislative_accuracy !== null
                              ? data.legislative_accuracy >= 60
                                ? 'text-emerald'
                                : data.legislative_accuracy >= 40
                                  ? 'text-gold'
                                  : 'text-against-400'
                              : 'text-surface-500'
                          )}>
                            {data.legislative_accuracy !== null
                              ? `${data.legislative_accuracy}%`
                              : '—'}
                          </div>
                          <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                            Accuracy
                          </div>
                        </div>
                      </div>
                      {data.legislative_picks.length < 3 && (
                        <p className="text-[10px] font-mono text-surface-500 text-center mt-3">
                          Vote on at least 3 topics that resolve to unlock accuracy score.
                        </p>
                      )}
                    </div>

                    {/* Recent picks */}
                    {data.legislative_picks.length === 0 ? (
                      <div className="p-8 text-center">
                        <Shield className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                        <p className="text-surface-400 text-sm">
                          No resolved topic votes yet.
                        </p>
                        <Link
                          href="/"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                        >
                          Browse active topics <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-surface-300">
                        {data.legislative_picks.map((pick) => (
                          <LegislativePickRow key={pick.topic_id} pick={pick} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Analytics hub link ───────────────────────────────────── */}
              <Link
                href="/analytics"
                className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-for-500/30 transition-colors group"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Analytics Hub
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
              </Link>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
