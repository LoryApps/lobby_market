'use client'

/**
 * /topic/[id]/persuasion — The Persuasion Lab
 *
 * Analyses argument effectiveness in this debate:
 *   • Top Persuaders — highest composite persuasion score
 *   • Cross-Aisle Breakers — arguments that drew replies from opposite voters
 *   • Overlooked Gems — silently compelling (high upvotes, no noise)
 *   • Rhetorical Style breakdown — evidence / logical / narrative / emotional
 *
 * Distinct from:
 *   /crossfire     — most CONTESTED arguments (heat, not persuasion)
 *   /depth         — reply depth analysis (volume, not quality)
 *   /quality       — AI grade distribution
 *   /steelman      — AI best-case construction
 *   /swing         — voter segment "flip" analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  Heart,
  Lightbulb,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  PersuasionResponse,
  PersuasionArgument,
} from '@/app/api/topics/[id]/persuasion/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function truncate(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Style config ─────────────────────────────────────────────────────────────

const STYLE_CONFIG = {
  evidence: {
    label: 'Evidence-Based',
    icon: BookOpen,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/25',
    pill: 'bg-emerald/15 text-emerald border-emerald/30',
    desc: 'Cites data, studies, or statistics',
  },
  logical: {
    label: 'Logical',
    icon: Brain,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/25',
    pill: 'bg-purple/15 text-purple border-purple/30',
    desc: 'Structured reasoning and inference',
  },
  narrative: {
    label: 'Narrative',
    icon: Heart,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/25',
    pill: 'bg-gold/15 text-gold border-gold/30',
    desc: 'Personal experience or story',
  },
  emotional: {
    label: 'Emotional',
    icon: Flame,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/25',
    pill: 'bg-against-500/15 text-against-400 border-against-500/30',
    desc: 'Values-driven, urgent appeal',
  },
} as const

type RhetoricalStyle = keyof typeof STYLE_CONFIG

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PersuasionSkeleton() {
  return (
    <div className="space-y-4">
      {/* stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* style bar */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 flex-shrink-0" />
            <Skeleton className="h-4 rounded-full flex-1" style={{ maxWidth: `${50 + i * 10}%` }} />
            <Skeleton className="h-3 w-8 flex-shrink-0" />
          </div>
        ))}
      </div>
      {/* argument cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

interface ArgumentCardProps {
  arg: PersuasionArgument
  rank?: number
  showCrossAisle?: boolean
  showOverlooked?: boolean
}

function ArgumentCard({ arg, rank, showCrossAisle, showOverlooked }: ArgumentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = arg.content.length > 200
  const style = STYLE_CONFIG[arg.rhetorical_style as RhetoricalStyle] ?? STYLE_CONFIG.logical
  const StyleIcon = style.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-4 sm:p-5 space-y-3 transition-colors',
        arg.side === 'blue'
          ? 'border-for-500/20 hover:border-for-500/35'
          : 'border-against-500/20 hover:border-against-500/35'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {rank !== undefined && (
          <span
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono',
              rank === 1 ? 'bg-gold/20 text-gold border border-gold/40' :
              rank === 2 ? 'bg-surface-300 text-surface-700 border border-surface-400' :
              rank === 3 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
              'bg-surface-200 text-surface-600 border border-surface-300'
            )}
          >
            {rank}
          </span>
        )}
        <Avatar
          src={arg.author?.avatar_url ?? null}
          fallback={arg.author?.display_name || arg.author?.username || '?'}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {arg.author ? (
              <Link
                href={`/profile/${arg.author.username}`}
                className="text-[13px] font-semibold text-white hover:text-for-300 transition-colors truncate"
              >
                {arg.author.display_name || arg.author.username}
              </Link>
            ) : (
              <span className="text-[13px] text-surface-500">Anonymous</span>
            )}
            <span className="text-[11px] text-surface-600 font-mono">{reltime(arg.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border',
                arg.side === 'blue'
                  ? 'bg-for-500/15 text-for-400 border-for-500/30'
                  : 'bg-against-500/15 text-against-400 border-against-500/30'
              )}
            >
              {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', style.pill)}>
              <StyleIcon className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
              {style.label}
            </span>
            {arg.has_citation && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-emerald/10 text-emerald border-emerald/25">
                Cited
              </span>
            )}
            {showCrossAisle && arg.cross_aisle_replies > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-gold/10 text-gold border-gold/25">
                {arg.cross_aisle_replies} opp. repl{arg.cross_aisle_replies === 1 ? 'y' : 'ies'}
              </span>
            )}
            {showOverlooked && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-purple/10 text-purple border-purple/25">
                Silent hit
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/topic/${arg.id.split('-')[0]}/arguments`}
          className="flex-shrink-0 text-surface-600 hover:text-surface-400 transition-colors"
          aria-label="View argument"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Content */}
      <div>
        <p className="text-[13px] text-surface-700 leading-relaxed">
          {isLong && !expanded ? truncate(arg.content) : arg.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-[11px] text-surface-600 hover:text-white transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" /> Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" /> Read more</>
            )}
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 pt-1 border-t border-surface-300/50">
        <span className="flex items-center gap-1 text-[12px] text-surface-600">
          <ThumbsUp className="h-3.5 w-3.5" />
          <span className="font-mono font-medium">{arg.upvotes}</span>
          <span className="text-surface-500">upvotes</span>
        </span>
        <span className="flex items-center gap-1 text-[12px] text-surface-600">
          <Users className="h-3.5 w-3.5" />
          <span className="font-mono font-medium">{arg.reply_count}</span>
          <span className="text-surface-500">replies</span>
        </span>
        <span className="flex items-center gap-1 text-[12px] text-surface-600 ml-auto">
          <Zap className="h-3.5 w-3.5 text-gold" />
          <span className="font-mono font-medium text-gold">{arg.persuasion_score}</span>
          <span className="text-surface-500">score</span>
        </span>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

export function PersuasionClient({ topicId }: Props) {
  const params = useParams()
  const id = topicId || (params?.id as string)

  const [data, setData] = useState<PersuasionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'top' | 'cross' | 'gems'>('top')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/persuasion`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load persuasion data')
      const json = (await res.json()) as PersuasionResponse
      setData(json)
    } catch {
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const topic = data?.topic
  const stats = data?.stats

  // Tab content
  const tabArgs = activeTab === 'top'
    ? (data?.top_persuaders ?? [])
    : activeTab === 'cross'
    ? (data?.cross_aisle_breakers ?? [])
    : (data?.overlooked_gems ?? [])

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 pt-16">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">

          {/* Back link */}
          <Link
            href={`/topic/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-surface-600 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>

          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-gold flex-shrink-0" />
              <h1 className="text-lg font-bold text-white">The Persuasion Lab</h1>
            </div>
            {topic && (
              <div className="flex items-start gap-2">
                {topic.status && (
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="flex-shrink-0 mt-0.5">
                    {topic.status === 'law' ? <Gavel className="h-3 w-3 mr-1" /> : <Scale className="h-3 w-3 mr-1" />}
                    {topic.status === 'law' ? 'Law' : topic.status === 'voting' ? 'Voting' : topic.status === 'active' ? 'Active' : topic.status}
                  </Badge>
                )}
                <p className="text-[13px] text-surface-600 leading-relaxed line-clamp-2">
                  {topic.statement}
                </p>
              </div>
            )}
            <p className="text-[12px] text-surface-500">
              Which arguments are truly changing minds? Ranked by upvote reach, cross-aisle breakthrough, and rhetorical effectiveness.
            </p>
          </div>

          {loading && <PersuasionSkeleton />}

          {error && (
            <EmptyState
              icon={Scale}
              title="Failed to load"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          )}

          {!loading && !error && data && (
            <>
              {/* Stat row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Arguments',
                    value: stats?.total_arguments ?? 0,
                    icon: BarChart2,
                    color: 'text-white',
                  },
                  {
                    label: 'Cross-aisle',
                    value: stats?.cross_aisle_count ?? 0,
                    icon: Users,
                    color: 'text-gold',
                  },
                  {
                    label: 'Citation rate',
                    value: `${stats?.citation_rate ?? 0}%`,
                    icon: BookOpen,
                    color: 'text-emerald',
                  },
                  {
                    label: 'Avg score',
                    value: stats?.avg_persuasion_score ?? 0,
                    icon: Zap,
                    color: 'text-purple',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                    <div className={cn('text-2xl font-bold font-mono', color)}>
                      {value}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Icon className="h-3 w-3 text-surface-500" />
                      <span className="text-[11px] text-surface-500">{label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* FOR vs AGAINST persuasion comparison */}
              {stats && stats.total_arguments > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                  <h2 className="text-[13px] font-semibold text-surface-600 uppercase tracking-wide">
                    Persuasion by Side
                  </h2>
                  <div className="space-y-3">
                    {/* FOR */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                        <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                        <span className="text-[12px] font-semibold text-for-400">FOR</span>
                        <span className="text-[11px] text-surface-600 font-mono ml-auto">
                          {stats.blue_arguments}
                        </span>
                      </div>
                      <div className="flex-1 h-5 bg-surface-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-for-500/60 rounded-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, (stats.blue_avg_score / Math.max(stats.blue_avg_score, stats.red_avg_score, 1)) * 100)}%`,
                          }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-[12px] font-mono font-semibold text-for-400 w-10 text-right">
                        {stats.blue_avg_score}
                      </span>
                    </div>
                    {/* AGAINST */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                        <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                        <span className="text-[12px] font-semibold text-against-400">AGAINST</span>
                        <span className="text-[11px] text-surface-600 font-mono ml-auto">
                          {stats.red_arguments}
                        </span>
                      </div>
                      <div className="flex-1 h-5 bg-surface-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-against-500/60 rounded-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, (stats.red_avg_score / Math.max(stats.blue_avg_score, stats.red_avg_score, 1)) * 100)}%`,
                          }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                      <span className="text-[12px] font-mono font-semibold text-against-400 w-10 text-right">
                        {stats.red_avg_score}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-500">
                      Average persuasion score per argument. Higher = more upvotes + engagement.
                    </p>
                  </div>
                </div>
              )}

              {/* Rhetorical style breakdown */}
              {data.style_breakdown.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                  <h2 className="text-[13px] font-semibold text-surface-600 uppercase tracking-wide">
                    Rhetoric in this Debate
                  </h2>
                  <div className="space-y-3">
                    {data.style_breakdown.map((s) => {
                      const cfg = STYLE_CONFIG[s.style as RhetoricalStyle]
                      if (!cfg) return null
                      const StyleIcon = cfg.icon
                      const maxScore = Math.max(...data.style_breakdown.map((x) => x.avg_score), 1)
                      return (
                        <div key={s.style} className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
                            <StyleIcon className={cn('h-3.5 w-3.5', cfg.color)} />
                            <span className={cn('text-[12px] font-medium', cfg.color)}>
                              {cfg.label}
                            </span>
                          </div>
                          <div className="flex-1 h-4 bg-surface-200 rounded-full overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', cfg.bg.replace('/10', '/40'))}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round((s.avg_score / maxScore) * 100)}%` }}
                              transition={{ duration: 0.7, ease: 'easeOut' }}
                            />
                          </div>
                          <div className="text-right flex-shrink-0 w-20">
                            <span className="text-[11px] font-mono text-surface-500">
                              {s.count} args · {s.avg_score} avg
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-surface-500">
                    Based on argument language patterns. Bars represent average persuasion score per style.
                  </p>
                </div>
              )}

              {/* Length comparison */}
              {stats && stats.total_arguments > 0 && (
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex gap-6">
                  <div className="flex-1 text-center">
                    <p className="text-[11px] text-surface-500 mb-1">FOR avg length</p>
                    <p className="text-lg font-bold font-mono text-for-400">
                      {stats.blue_avg_length}
                      <span className="text-[11px] text-surface-500 ml-1">words</span>
                    </p>
                  </div>
                  <div className="w-px bg-surface-300" />
                  <div className="flex-1 text-center">
                    <p className="text-[11px] text-surface-500 mb-1">AGAINST avg length</p>
                    <p className="text-lg font-bold font-mono text-against-400">
                      {stats.red_avg_length}
                      <span className="text-[11px] text-surface-500 ml-1">words</span>
                    </p>
                  </div>
                  <div className="w-px bg-surface-300" />
                  <div className="flex-1 text-center">
                    <p className="text-[11px] text-surface-500 mb-1">Top rhetoric</p>
                    <p className="text-[13px] font-semibold text-white capitalize">
                      {STYLE_CONFIG[stats.top_rhetorical_style as RhetoricalStyle]?.label ?? stats.top_rhetorical_style}
                    </p>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-surface-300 gap-0.5">
                {([
                  { id: 'top', label: 'Top Persuaders', icon: Trophy },
                  { id: 'cross', label: 'Cross-Aisle', icon: Users },
                  { id: 'gems', label: 'Overlooked', icon: Sparkles },
                ] as const).map(({ id: tabId, label, icon: Icon }) => (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors -mb-px',
                      activeTab === tabId
                        ? 'border-gold text-gold'
                        : 'border-transparent text-surface-600 hover:text-surface-400'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab description */}
              <div className="text-[12px] text-surface-500">
                {activeTab === 'top' && 'Arguments with the highest composite persuasion score — upvotes, replies, and cross-aisle engagement combined.'}
                {activeTab === 'cross' && 'Arguments that drew replies from voters on the opposing side — a rare signal that an argument genuinely reached across the divide.'}
                {activeTab === 'gems' && 'Highly upvoted arguments that generated no replies — silently compelling cases that moved people without sparking debate.'}
              </div>

              {/* Argument list */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {tabArgs.length === 0 ? (
                    <EmptyState
                      icon={activeTab === 'cross' ? Users : activeTab === 'gems' ? Sparkles : Trophy}
                      title={
                        activeTab === 'cross'
                          ? 'No cross-aisle arguments yet'
                          : activeTab === 'gems'
                          ? 'No overlooked gems yet'
                          : 'No arguments yet'
                      }
                      description={
                        activeTab === 'cross'
                          ? 'No arguments have received replies from voters on the opposite side yet.'
                          : activeTab === 'gems'
                          ? 'All highly-upvoted arguments have also generated replies.'
                          : 'Be the first to make a case in this debate.'
                      }
                    />
                  ) : (
                    tabArgs.map((arg, i) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        rank={activeTab === 'top' ? i + 1 : undefined}
                        showCrossAisle={activeTab === 'cross' || activeTab === 'top'}
                        showOverlooked={activeTab === 'gems'}
                      />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>

              {/* View all arguments link */}
              <div className="text-center pt-2">
                <Link
                  href={`/topic/${id}/arguments`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-surface-600 hover:text-white transition-colors"
                >
                  View all arguments
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Refresh */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-2 text-[12px] text-surface-600 hover:text-white transition-colors"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  Refresh
                </button>
              </div>
            </>
          )}

          {!loading && !error && data && data.stats.total_arguments === 0 && (
            <EmptyState
              icon={Lightbulb}
              title="No arguments yet"
              description="Be the first to make a persuasive case in this debate."
              action={{
                label: 'Add an argument',
                href: `/topic/${id}/argue`,
              }}
            />
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
