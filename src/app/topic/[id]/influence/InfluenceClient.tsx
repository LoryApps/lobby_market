'use client'

/**
 * /topic/[id]/influence — The Influence Map
 *
 * Ranks every argument by composite influence score:
 * upvotes × 3 + reply_count × 2 + ai_score × 2 + velocity bonus.
 * Tiers: Titan (top 3), Catalyst (4–10), Ripple (rest).
 *
 * Distinct from:
 *   /persuasion      — rhetorical style analysis, not composite scoring
 *   /quality         — AI grade distribution only
 *   /crossfire       — controversy / heat, not influence
 *   /anatomy         — linguistic breakdown
 *   /steelman        — AI best-case construction
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Radio,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  Trophy,
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
  InfluenceResponse,
  InfluenceArgument,
} from '@/app/api/topics/[id]/influence/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

const TIER_CONFIG = {
  titan: {
    label: 'Titan',
    description: 'Top 3 most influential arguments',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    text: 'text-gold',
    rankBg: 'bg-gold/20 border-gold/40 text-gold',
    icon: Trophy,
  },
  catalyst: {
    label: 'Catalyst',
    description: 'High-impact arguments driving the debate',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    text: 'text-purple',
    rankBg: 'bg-purple/20 border-purple/40 text-purple',
    icon: Zap,
  },
  ripple: {
    label: 'Ripple',
    description: 'Contributing voices with growing reach',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    text: 'text-surface-500',
    rankBg: 'bg-surface-300 border-surface-400 text-surface-500',
    icon: Radio,
  },
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  maxScore,
  expanded,
  onToggle,
}: {
  arg: InfluenceArgument
  maxScore: number
  expanded: boolean
  onToggle: () => void
}) {
  const isFor = arg.side === 'blue'
  const tier = TIER_CONFIG[arg.tier]
  const barPct = maxScore > 0 ? Math.round((arg.influence_score / maxScore) * 100) : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(arg.rank * 0.04, 0.4) }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        arg.tier === 'titan' && 'ring-1 ring-gold/20',
        tier.border,
        tier.bg
      )}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors hover:brightness-110'
        )}
      >
        {/* Rank badge */}
        <div
          className={cn(
            'flex-shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold mt-0.5',
            tier.rankBg
          )}
        >
          {arg.rank}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Side + tier badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-2 py-0.5 rounded border',
                isFor
                  ? 'text-for-400 bg-for-500/10 border-for-500/30'
                  : 'text-against-400 bg-against-500/10 border-against-500/30'
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {arg.tier !== 'ripple' && (
              <span className={cn('text-[10px] font-mono font-semibold', tier.text)}>
                {tier.label}
              </span>
            )}
            {arg.ai_grade && (
              <span className="text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded border border-gold/20">
                Grade {arg.ai_grade}
              </span>
            )}
          </div>

          {/* Content preview */}
          <p className="text-sm text-surface-600 leading-relaxed line-clamp-2">
            {arg.content}
          </p>

          {/* Influence score bar */}
          <div className="space-y-1">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  isFor ? 'bg-for-500' : 'bg-against-500'
                )}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
              <span>
                <span className={cn('font-bold', tier.text)}>
                  {arg.influence_score}
                </span>{' '}
                influence score
              </span>
              <span>{barPct}% of max</span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 text-surface-500 mt-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-surface-300 bg-surface-100 space-y-3">
              {/* Full content */}
              <p className="text-sm text-surface-600 leading-relaxed">{arg.content}</p>

              {/* Author row */}
              {arg.author && (
                <Link
                  href={`/profile/${arg.author.username}`}
                  className="flex items-center gap-2 group"
                >
                  <Avatar
                    src={arg.author.avatar_url}
                    fallback={arg.author.display_name || arg.author.username}
                    size="xs"
                  />
                  <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors">
                    {arg.author.display_name || arg.author.username}
                  </span>
                  <span className="text-[10px] text-surface-600">{reltime(arg.created_at)}</span>
                </Link>
              )}

              {/* Score breakdown */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <ThumbsUp className="h-3 w-3 text-for-400" />
                    <span className="text-sm font-mono font-bold text-white">{arg.upvotes}</span>
                  </div>
                  <div className="text-[9px] font-mono text-surface-500 uppercase tracking-widest">
                    Upvotes
                  </div>
                </div>
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <MessageSquare className="h-3 w-3 text-purple" />
                    <span className="text-sm font-mono font-bold text-white">{arg.reply_count}</span>
                  </div>
                  <div className="text-[9px] font-mono text-surface-500 uppercase tracking-widest">
                    Replies
                  </div>
                </div>
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp className="h-3 w-3 text-emerald" />
                    <span className="text-sm font-mono font-bold text-white">
                      {arg.upvote_velocity.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-surface-500 uppercase tracking-widest">
                    /day
                  </div>
                </div>
              </div>

              <Link
                href={`/arguments/${arg.id}`}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-mono transition-colors',
                  isFor
                    ? 'text-for-400 hover:text-for-300'
                    : 'text-against-400 hover:text-against-300'
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View full argument thread
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-start gap-3"
        >
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-12 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function InfluenceClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<InfluenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [sideFilter, setSideFilter] = useState<'all' | 'for' | 'against'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/influence`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load influence data')
      const json = (await res.json()) as InfluenceResponse
      setData(json)
      // Auto-expand top 2
      if (json.arguments.length > 0) {
        setExpandedIds(new Set(json.arguments.slice(0, 2).map((a) => a.id)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    void load()
  }, [load])

  function toggleArg(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const topic = data?.topic
  const stats = data?.stats
  const allArgs = data?.arguments ?? []
  const visibleArgs =
    sideFilter === 'all'
      ? allArgs
      : allArgs.filter((a) => (sideFilter === 'for' ? a.side === 'blue' : a.side === 'red'))

  const maxScore = allArgs[0]?.influence_score ?? 1
  const forPct = topic ? Math.round(topic.blue_pct) : 50
  const statusLabel = topic ? STATUS_LABEL[topic.status] ?? topic.status : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white font-mono transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Topic header */}
        {topic ? (
          <div className="mb-6 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  topic.status === 'law' ? 'gold' : topic.status === 'active' ? 'for' : 'default'
                }
                className="font-mono text-[10px]"
              >
                {topic.status === 'law' ? (
                  <Gavel className="inline h-2.5 w-2.5 mr-1" />
                ) : topic.status === 'active' ? (
                  <Flame className="inline h-2.5 w-2.5 mr-1" />
                ) : (
                  <Scale className="inline h-2.5 w-2.5 mr-1" />
                )}
                {statusLabel}
              </Badge>
            </div>
            <h1 className="text-lg font-mono font-bold text-white leading-tight">
              {topic.statement}
            </h1>
            <div className="space-y-1.5">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div className="bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
                <div className="bg-against-500 flex-1" />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-surface-500">
                <span className="text-for-400">{forPct}% FOR</span>
                <span className="text-surface-500">
                  {(topic.total_votes ?? 0).toLocaleString()} votes
                </span>
                <span className="text-against-400">{100 - forPct}% AGAINST</span>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="mb-6 space-y-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ) : null}

        {/* Page title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Radio className="h-4 w-4 text-gold" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">Influence Map</h2>
            <p className="text-xs font-mono text-surface-500">
              Arguments ranked by composite impact
            </p>
          </div>
          {stats && (
            <div className="ml-auto text-right">
              <div className="text-xs font-mono font-bold text-white">{stats.total_arguments}</div>
              <div className="text-[10px] font-mono text-surface-500">arguments</div>
            </div>
          )}
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center">
              <div className="text-base font-mono font-bold text-gold">{stats.titan_count}</div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Titan args</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center">
              <div
                className={cn(
                  'text-base font-mono font-bold',
                  stats.dominant_side === 'for'
                    ? 'text-for-400'
                    : stats.dominant_side === 'against'
                    ? 'text-against-400'
                    : 'text-surface-400'
                )}
              >
                {stats.dominant_side === 'balanced'
                  ? 'Balanced'
                  : stats.dominant_side === 'for'
                  ? 'FOR'
                  : 'AGAINST'}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Dominant side</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center">
              <div className="text-base font-mono font-bold text-white">
                {stats.avg_influence_score}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Avg score</div>
            </div>
          </div>
        )}

        {/* FOR vs AGAINST influence bar */}
        {stats && stats.total_arguments > 0 && (
          <div className="mb-5 rounded-2xl border border-surface-300 bg-surface-100 p-4">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
              Influence balance
            </div>
            <div className="space-y-2">
              {/* FOR bar */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono text-for-400 w-14 flex-shrink-0">FOR</span>
                <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all duration-700"
                    style={{
                      width:
                        stats.for_influence_score + stats.against_influence_score > 0
                          ? `${Math.round(
                              (stats.for_influence_score /
                                (stats.for_influence_score + stats.against_influence_score)) *
                                100
                            )}%`
                          : '50%',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-for-400 w-14 text-right flex-shrink-0">
                  {stats.for_influence_score} pts
                </span>
              </div>
              {/* AGAINST bar */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono text-against-400 w-14 flex-shrink-0">
                  AGAINST
                </span>
                <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-against-500 rounded-full transition-all duration-700"
                    style={{
                      width:
                        stats.for_influence_score + stats.against_influence_score > 0
                          ? `${Math.round(
                              (stats.against_influence_score /
                                (stats.for_influence_score + stats.against_influence_score)) *
                                100
                            )}%`
                          : '50%',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-against-400 w-14 text-right flex-shrink-0">
                  {stats.against_influence_score} pts
                </span>
              </div>
            </div>
            {stats.influence_gap > 5 && (
              <p className="text-[10px] font-mono text-surface-500 mt-3">
                {stats.dominant_side === 'for' ? 'FOR' : 'AGAINST'} arguments hold{' '}
                <span
                  className={cn(
                    'font-bold',
                    stats.dominant_side === 'for' ? 'text-for-400' : 'text-against-400'
                  )}
                >
                  {stats.influence_gap}%
                </span>{' '}
                more influence in this debate.
              </p>
            )}
          </div>
        )}

        {/* Side filter */}
        {!loading && allArgs.length > 0 && (
          <div className="flex gap-2 mb-4">
            {(['all', 'for', 'against'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSideFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                  sideFilter === f
                    ? f === 'for'
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : f === 'against'
                      ? 'bg-against-500/20 border-against-500/50 text-against-300'
                      : 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400'
                )}
              >
                {f === 'all' ? 'All' : f === 'for' ? 'FOR' : 'AGAINST'}
                {f !== 'all' && (
                  <span className="ml-1.5 opacity-70">
                    (
                    {f === 'for'
                      ? stats?.for_arguments ?? 0
                      : stats?.against_arguments ?? 0}
                    )
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Argument list */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <BarChart2 className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
            <button
              onClick={() => void load()}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : visibleArgs.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No arguments yet"
            description={
              sideFilter === 'all'
                ? 'As arguments are posted and upvoted, this map will show which ones are driving the debate.'
                : `No ${sideFilter === 'for' ? 'FOR' : 'AGAINST'} arguments with influence data yet.`
            }
          />
        ) : (
          <div className="space-y-3">
            {visibleArgs.map((arg) => (
              <ArgCard
                key={arg.id}
                arg={arg}
                maxScore={maxScore}
                expanded={expandedIds.has(arg.id)}
                onToggle={() => toggleArg(arg.id)}
              />
            ))}
          </div>
        )}

        {/* Explainer */}
        {!loading && allArgs.length > 0 && (
          <div className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-4">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2">
              How influence is scored
            </div>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Each argument&apos;s influence score combines{' '}
              <span className="text-for-400">upvotes × 3</span> (community endorsement),{' '}
              <span className="text-purple">replies × 2</span> (discussion power), an{' '}
              <span className="text-gold">AI quality bonus</span> (up to +20), and a{' '}
              <span className="text-emerald">velocity bonus</span> for recent traction.{' '}
              <span className="text-gold font-semibold">Titans</span> are the top 3 across both
              sides.{' '}
              <span className="text-purple font-semibold">Catalysts</span> (4–10) are driving the
              debate. <span className="text-surface-400 font-semibold">Ripples</span> are growing
              voices.
            </p>
            <div className="mt-3 flex gap-3 flex-wrap">
              <Link
                href={`/topic/${topicId}/persuasion`}
                className="text-xs font-mono text-purple hover:text-purple/80 transition-colors flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                Persuasion Lab
              </Link>
              <Link
                href={`/topic/${topicId}/quality`}
                className="text-xs font-mono text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
              >
                <BarChart2 className="h-3 w-3" />
                Argument Quality
              </Link>
              <Link
                href={`/topic/${topicId}/arguments`}
                className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
              >
                <MessageSquare className="h-3 w-3" />
                All arguments
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
