'use client'

/**
 * /leaderboard/persuasion — Most Persuasive Citizens
 *
 * Ranks the platform's most effective arguers by their persuasion score —
 * a size-normalized metric that measures upvotes relative to debate size,
 * so a brilliant argument in a 50-vote debate ranks alongside one in a
 * 5,000-vote debate.
 *
 * Persuasion Score = upvotes / √(debate_total_votes) × 10, capped at 100
 * Requires at least 3 qualifying arguments to appear on the board.
 *
 * Tiers:
 *   Elite Persuader     (avg ≥70) — consistently outperforms debate size
 *   Strong Persuader    (avg ≥50) — reliably earns above-average upvotes
 *   Effective Contributor (avg ≥30) — arguments land well across debates
 *   Developing Voice    (avg ≥15) — building persuasion track record
 *   Emerging Contributor (avg <15) — early-stage voice
 *
 * Distinct from:
 *   /leaderboard/grades   — AI-graded argument quality (A–F)
 *   /leaderboard/impact   — composite civic impact (laws + clout + reach)
 *   /analytics/persuasion — your personal persuasion deep-dive
 *   /leaderboard/arguments — raw upvote count leaderboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  PersuasionLeaderEntry,
  PersuasionMyStats,
  PersuasionTier,
  PersuasionLeaderboardResponse,
} from '@/app/api/leaderboard/persuasion/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type Period = 'all' | '90d' | '30d'

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: '90d', label: '90 Days' },
  { id: '30d', label: '30 Days' },
]

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<PersuasionTier, {
  label: string
  threshold: string
  color: string
  bg: string
  border: string
  badge: string
}> = {
  elite: {
    label: 'Elite Persuader',
    threshold: 'avg ≥70',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
  },
  strong: {
    label: 'Strong Persuader',
    threshold: 'avg ≥50',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 text-emerald',
  },
  effective: {
    label: 'Effective',
    threshold: 'avg ≥30',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
  },
  developing: {
    label: 'Developing',
    threshold: 'avg ≥15',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
  },
  emerging: {
    label: 'Emerging',
    threshold: 'avg <15',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300 text-surface-500',
  },
}

const TIER_ORDER: PersuasionTier[] = ['elite', 'strong', 'effective', 'developing', 'emerging']

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({ entry, position }: { entry: PersuasionLeaderEntry; position: 1 | 2 | 3 }) {
  const tier = TIER_CONFIG[entry.tier]
  const [expanded, setExpanded] = useState(false)
  const medalColor =
    position === 1 ? 'text-gold border-gold/40 bg-gold/10'
    : position === 2 ? 'text-surface-300 border-surface-500/40 bg-surface-200'
    : 'text-amber-600 border-amber-600/40 bg-amber-600/10'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.08 }}
      className={cn(
        'rounded-2xl border p-4 flex flex-col items-center gap-3 text-center cursor-pointer',
        position === 1 ? 'bg-surface-100 border-gold/30' : 'bg-surface-100 border-surface-300',
        position !== 1 && 'mt-4',
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className={cn('h-7 w-7 rounded-full border-2 flex items-center justify-center text-sm font-mono font-bold', medalColor)}>
        {position}
      </div>
      <Link href={`/profile/${entry.username}`} onClick={(e) => e.stopPropagation()}>
        <Avatar src={entry.avatar_url} username={entry.username} size="lg" />
      </Link>
      <div>
        <Link
          href={`/profile/${entry.username}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm font-semibold text-white hover:text-for-400 transition-colors"
        >
          {entry.display_name ?? `@${entry.username}`}
        </Link>
        <div className={cn('text-[10px] font-mono mt-1 px-2 py-0.5 rounded-full inline-block', tier.badge)}>
          {tier.label}
        </div>
      </div>

      <div className={cn('rounded-xl border px-3 py-2 w-full', tier.bg, tier.border)}>
        <p className={cn('text-lg font-mono font-bold', tier.color)}>{entry.avg_score}</p>
        <p className="text-[10px] font-mono text-surface-500">Avg Score</p>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full text-center">
        <div>
          <p className="text-sm font-mono font-semibold text-white">{entry.total_upvotes.toLocaleString()}</p>
          <p className="text-[10px] font-mono text-surface-500">Upvotes</p>
        </div>
        <div>
          <p className="text-sm font-mono font-semibold text-white">{entry.argument_count}</p>
          <p className="text-[10px] font-mono text-surface-500">Arguments</p>
        </div>
      </div>

      {/* Top argument preview */}
      {entry.top_argument_snippet && (
        <div className="w-full">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Top argument
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-left rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2"
              >
                {entry.top_argument_topic && (
                  <p className="text-[10px] font-mono text-surface-500 mb-1 truncate">
                    on: {entry.top_argument_topic}
                  </p>
                )}
                <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-3">
                  &ldquo;{entry.top_argument_snippet}&hellip;&rdquo;
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PersuasionRow({ entry, isMe }: { entry: PersuasionLeaderEntry; isMe: boolean }) {
  const tier = TIER_CONFIG[entry.tier]
  const [expanded, setExpanded] = useState(false)
  const rankColor =
    entry.rank <= 3 ? (entry.rank === 1 ? 'text-gold' : entry.rank === 2 ? 'text-surface-300' : 'text-amber-600')
    : 'text-surface-600'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border transition-colors',
        isMe
          ? 'bg-for-900/30 border-for-500/30'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Rank */}
        <span className={cn('w-7 text-center text-sm font-mono font-bold flex-shrink-0', rankColor)}>
          {entry.rank}
        </span>

        {/* Avatar + name */}
        <Link
          href={`/profile/${entry.username}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2.5 flex-1 min-w-0"
        >
          <Avatar src={entry.avatar_url} username={entry.username} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-mono font-semibold text-white truncate">
              {entry.display_name ?? entry.username}
              {isMe && <span className="ml-1.5 text-xs text-for-400">(you)</span>}
            </p>
            <p className="text-[11px] font-mono text-surface-500 truncate">@{entry.username}</p>
          </div>
        </Link>

        {/* Tier badge */}
        <span className={cn('hidden sm:inline-flex text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 flex-shrink-0', tier.badge)}>
          {tier.label}
        </span>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0 text-right">
          <div className="hidden md:block text-right">
            <p className="text-xs font-mono text-surface-500">{entry.total_upvotes.toLocaleString()} ↑</p>
            <p className="text-[10px] font-mono text-surface-400">{entry.argument_count} args</p>
          </div>
          <div className="text-right">
            <p className={cn('text-sm font-mono font-bold', tier.color)}>{entry.avg_score}</p>
            <p className="text-[10px] font-mono text-surface-500">score</p>
          </div>
        </div>

        {expanded
          ? <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
        }
      </div>

      {/* Expanded top argument */}
      <AnimatePresence>
        {expanded && entry.top_argument_snippet && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            <div className="rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2.5">
              {entry.top_argument_topic && (
                <p className="text-[10px] font-mono text-surface-500 mb-1">
                  <span className="text-surface-600">Top argument on:</span>{' '}
                  <span className="text-white truncate">{entry.top_argument_topic}</span>
                </p>
              )}
              <p className="text-xs font-mono text-surface-400 leading-relaxed">
                &ldquo;{entry.top_argument_snippet}&hellip;&rdquo;
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats }: { stats: PersuasionMyStats }) {
  const tier = TIER_CONFIG[stats.tier]
  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', tier.bg, tier.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your Persuasion Profile</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-2xl font-mono font-bold', tier.color)}>{stats.avg_score}</span>
            <span className={cn('text-xs font-mono font-semibold rounded-full px-2 py-0.5', tier.badge)}>
              {tier.label}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {stats.rank ? (
            <>
              <p className="text-xs font-mono text-surface-500">Your rank</p>
              <p className="text-xl font-mono font-bold text-white">#{stats.rank}</p>
              {stats.percentile !== null && (
                <p className="text-[10px] font-mono text-surface-500">
                  top {100 - stats.percentile}%
                </p>
              )}
            </>
          ) : (
            <div className="text-right">
              <p className="text-xs font-mono text-surface-500">Keep arguing</p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                Need ≥3 args to rank
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-surface-500">Avg persuasion score</span>
          <span className={tier.color}>{stats.avg_score} / 100</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              stats.avg_score >= 70 ? 'bg-gold'
              : stats.avg_score >= 50 ? 'bg-emerald'
              : stats.avg_score >= 30 ? 'bg-for-500'
              : stats.avg_score >= 15 ? 'bg-purple'
              : 'bg-surface-400'
            )}
            style={{ width: `${stats.avg_score}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Avg Score', value: stats.avg_score, icon: Scale },
          { label: 'Total Upvotes', value: stats.total_upvotes.toLocaleString(), icon: ThumbsUp },
          { label: 'Arguments', value: stats.argument_count, icon: MessageSquare },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-200/50 border border-surface-300 p-3">
            <s.icon className="h-4 w-4 text-surface-500 mb-1" />
            <p className="text-base font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PersuasionLeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PersuasionLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')

  const fetchData = useCallback(async (p: Period = period) => {
    setLoading(true)
    setError(null)
    try {
      const [res, userRes] = await Promise.all([
        fetch(`/api/leaderboard/persuasion?period=${p}`, { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as PersuasionLeaderboardResponse
      setData(json)
      if (userRes.ok) {
        const userData = await userRes.json() as { id?: string }
        if (userData.id) setCurrentUserId(userData.id)
      }
    } catch {
      setError('Could not load the Persuasion Leaderboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData(period) }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const podiumEntries = data?.entries.slice(0, 3) ?? []
  const listEntries = data?.entries.slice(3) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href="/leaderboard"
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-emerald flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">Most Persuasive Citizens</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
              Citizens ranked by how effectively their arguments earn upvotes relative to debate size.
              A great argument in a small debate ranks as high as one in a massive one.
            </p>
          </div>
          <button
            onClick={() => fetchData(period)}
            disabled={loading}
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                period === opt.id
                  ? 'bg-emerald/20 border-emerald/40 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
          {data && (
            <span className="ml-auto text-[11px] font-mono text-surface-600">
              {data.total_arguers.toLocaleString()} citizens ranked
            </span>
          )}
        </div>

        {/* Tier legend */}
        <div className="grid grid-cols-5 gap-1.5">
          {TIER_ORDER.map((tier) => {
            const cfg = TIER_CONFIG[tier]
            return (
              <div key={tier} className={cn('rounded-xl border px-2 py-2 text-center', cfg.bg, cfg.border)}>
                <p className={cn('text-[9px] font-mono font-semibold leading-tight', cfg.color)}>
                  {cfg.label}
                </p>
                <p className="text-[8px] font-mono text-surface-600 mt-0.5">{cfg.threshold}</p>
              </div>
            )
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-60 w-full rounded-2xl" />)}
            </div>
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Could not load the Persuasion Leaderboard"
            description={error}
            actions={[{ label: 'Try again', onClick: () => fetchData(period), variant: 'secondary', icon: RefreshCw }]}
          />
        )}

        {/* My stats */}
        {!loading && data?.my_stats && (
          <MyStatsCard stats={data.my_stats} />
        )}

        {/* Empty */}
        {!loading && data && data.entries.length === 0 && (
          <EmptyState
            icon={Mic}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No persuasion data yet"
            description="The Persuasion Leaderboard requires at least 3 upvoted arguments to calculate a score. Start arguing your case."
          />
        )}

        {/* Podium */}
        {!loading && podiumEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-mono text-sm font-semibold text-white">Top Persuaders</h2>
              {data && (
                <span className="text-xs font-mono text-surface-500 ml-auto">
                  Platform avg: {data.platform_avg}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {podiumEntries.map((entry, i) => (
                <PodiumCard key={entry.user_id} entry={entry} position={(i + 1) as 1 | 2 | 3} />
              ))}
            </div>
          </div>
        )}

        {/* Ranked list */}
        {!loading && listEntries.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {listEntries.map((entry) => (
                <PersuasionRow
                  key={`${entry.user_id}-${period}`}
                  entry={entry}
                  isMe={entry.user_id === currentUserId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* How it works */}
        {!loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald" />
              How persuasion score works
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: BarChart2,
                  color: 'text-emerald',
                  title: 'Size-normalized upvotes',
                  desc: 'Earning 10 upvotes in a 100-vote debate is harder than in a 10,000-vote debate. We normalize by the square root of debate size so skill — not topic popularity — determines your score.',
                },
                {
                  icon: ThumbsUp,
                  color: 'text-for-400',
                  title: 'Average across all arguments',
                  desc: 'Your score is the mean persuasion score across all qualifying arguments, not just your best one. Consistency across debates is what separates great arguers from lucky ones.',
                },
                {
                  icon: Zap,
                  color: 'text-gold',
                  title: 'Minimum 3 arguments',
                  desc: 'You need at least 3 upvoted arguments to appear on the board. One viral argument doesn\'t make you the platform\'s most persuasive voice — sustained quality does.',
                },
                {
                  icon: Scale,
                  color: 'text-purple',
                  title: 'Period filters',
                  desc: 'Switch between all-time, 90-day, and 30-day windows to see who\'s most persuasive right now vs. over the platform\'s full history.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
                    <item.icon className={cn('h-4 w-4', item.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">{item.title}</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs font-mono text-surface-500 pt-1 border-t border-surface-300 leading-relaxed">
              Formula:{' '}
              <code className="text-emerald font-mono text-[10px]">
                score = min(100, round(upvotes / √debate_votes × 10)) · averaged across all arguments
              </code>
            </p>
          </div>
        )}

        {/* Related leaderboards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/leaderboard/grades', label: 'AI Grades', desc: 'Argument quality A–F', icon: BarChart2 },
            { href: '/analytics/persuasion', label: 'My Persuasion Stats', desc: 'Your personal deep-dive', icon: Mic },
            { href: '/leaderboard/arguments', label: 'Raw Upvotes', desc: 'Most upvoted arguers', icon: ThumbsUp },
            { href: '/leaderboard/impact', label: 'Civic Impact', desc: 'Composite impact ranking', icon: Zap },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 flex items-center gap-3 transition-colors group"
            >
              <div className="h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
                <link.icon className="h-4 w-4 text-surface-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-mono font-semibold text-white group-hover:text-for-400 transition-colors">{link.label}</p>
                <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 ml-auto flex-shrink-0" />
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
