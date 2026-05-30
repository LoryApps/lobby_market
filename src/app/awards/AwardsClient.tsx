'use client'

/**
 * /awards — The Civic Awards Hall
 *
 * Weekly, monthly, and all-time recognition for standout civic contributors.
 * Award categories:
 *   • Best Argument       — highest upvoted argument in period
 *   • Bridge Builder      — most balanced cross-partisan argument upvotes
 *   • Top Voter           — most votes cast in period
 *   • Lawmaker            — most authored topics that became law
 *   • Streak Champion     — longest current voting streak
 *   • Rising Star         — highest reputation efficiency (new voices)
 *   • Top Debater         — most argument upvotes received in period
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AwardsResponse, AwardWinner, ArgumentAward } from '@/app/api/awards/route'

// ─── Period tabs ──────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
]

// ─── Award definitions ────────────────────────────────────────────────────────

interface AwardConfig {
  key: keyof Omit<AwardsResponse, 'period' | 'generated_at'>
  title: string
  subtitle: string
  icon: typeof Trophy
  iconColor: string
  iconBg: string
  iconBorder: string
  tierColor: string
  tier: 'gold' | 'silver' | 'bronze' | 'emerald' | 'purple' | 'blue'
}

const AWARD_CONFIGS: AwardConfig[] = [
  {
    key: 'best_argument',
    title: 'Best Argument',
    subtitle: 'The highest-upvoted civic argument in the period',
    icon: Star,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    tierColor: 'text-gold',
    tier: 'gold',
  },
  {
    key: 'bridge_builder',
    title: 'Bridge Builder',
    subtitle: 'Most cross-partisan upvotes — arguing on both sides',
    icon: Scale,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    tierColor: 'text-purple',
    tier: 'purple',
  },
  {
    key: 'top_debater',
    title: 'Top Debater',
    subtitle: 'Most argument upvotes received',
    icon: MessageSquare,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    tierColor: 'text-for-400',
    tier: 'blue',
  },
  {
    key: 'top_voter',
    title: 'Most Active Voter',
    subtitle: 'Most votes cast in the period',
    icon: CheckCircle2,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
    tierColor: 'text-emerald',
    tier: 'emerald',
  },
  {
    key: 'top_lawmaker',
    title: 'Civic Lawmaker',
    subtitle: 'Most topics proposed that became law',
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    tierColor: 'text-gold',
    tier: 'gold',
  },
  {
    key: 'streak_champion',
    title: 'Streak Champion',
    subtitle: 'Longest consecutive days with a vote',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    iconBorder: 'border-against-500/30',
    tierColor: 'text-against-400',
    tier: 'bronze',
  },
  {
    key: 'rising_star',
    title: 'Rising Star',
    subtitle: 'Highest civic influence among newer voices',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    tierColor: 'text-purple',
    tier: 'silver',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isArgumentAward(
  award: AwardWinner | ArgumentAward | null
): award is ArgumentAward {
  return award !== null && 'argument_id' in award
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + '…'
}

// ─── Award card: winner variant ───────────────────────────────────────────────

function WinnerCard({
  config,
  award,
  delay = 0,
}: {
  config: AwardConfig
  award: AwardWinner | ArgumentAward
  delay?: number
}) {
  const Icon = config.icon

  if (isArgumentAward(award)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay }}
        className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden hover:border-surface-400 transition-colors"
      >
        {/* Award header */}
        <div className={cn('px-5 py-4 border-b border-surface-300', config.iconBg)}>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg border flex-shrink-0',
                config.iconBg,
                config.iconBorder
              )}
            >
              <Icon className={cn('h-4 w-4', config.iconColor)} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={cn('text-xs font-mono font-bold uppercase tracking-wider', config.tierColor)}>
                {config.title}
              </p>
              <p className="text-[11px] font-mono text-surface-500 truncate">{config.subtitle}</p>
            </div>
            <Crown className={cn('h-4 w-4 ml-auto flex-shrink-0', config.iconColor)} aria-hidden="true" />
          </div>
        </div>

        {/* Argument content */}
        <div className="p-5">
          {/* Author */}
          <Link
            href={`/profile/${award.author_username}`}
            className="flex items-center gap-2.5 mb-3 group"
          >
            <Avatar
              src={award.author_avatar_url}
              fallback={award.author_display_name || award.author_username}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors truncate">
                {award.author_display_name || award.author_username}
              </p>
              <p className="text-[11px] font-mono text-surface-500">@{award.author_username}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
              <span className="text-sm font-mono font-bold text-for-400">{award.upvotes.toLocaleString()}</span>
            </div>
          </Link>

          {/* Argument text */}
          <div
            className={cn(
              'rounded-xl border p-3.5 mb-3',
              award.side === 'blue'
                ? 'bg-for-500/5 border-for-500/20'
                : 'bg-against-500/5 border-against-500/20'
            )}
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  'mt-0.5 flex-shrink-0 flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border',
                  award.side === 'blue'
                    ? 'text-for-400 bg-for-500/10 border-for-500/30'
                    : 'text-against-400 bg-against-500/10 border-against-500/30'
                )}
              >
                {award.side === 'blue' ? (
                  <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
                ) : (
                  <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
                )}
                {award.side === 'blue' ? 'FOR' : 'AGAINST'}
              </div>
              <p className="text-sm text-surface-700 leading-relaxed flex-1">
                {truncate(award.content, 200)}
              </p>
            </div>
          </div>

          {/* Topic link */}
          <Link
            href={`/topic/${award.topic_id}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{truncate(award.topic_statement, 80)}</span>
            {award.topic_category && (
              <span className="ml-auto flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-surface-300/60 text-surface-500">
                {award.topic_category}
              </span>
            )}
          </Link>
        </div>
      </motion.div>
    )
  }

  // Regular winner card (non-argument)
  const winner = award as AwardWinner
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden hover:border-surface-400 transition-colors"
    >
      {/* Award header */}
      <div className={cn('px-5 py-4 border-b border-surface-300', config.iconBg)}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg border flex-shrink-0',
              config.iconBg,
              config.iconBorder
            )}
          >
            <Icon className={cn('h-4 w-4', config.iconColor)} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={cn('text-xs font-mono font-bold uppercase tracking-wider', config.tierColor)}>
              {config.title}
            </p>
            <p className="text-[11px] font-mono text-surface-500 truncate">{config.subtitle}</p>
          </div>
          <Crown className={cn('h-4 w-4 ml-auto flex-shrink-0', config.iconColor)} aria-hidden="true" />
        </div>
      </div>

      {/* Winner */}
      <div className="p-5">
        <Link
          href={`/profile/${winner.username}`}
          className="flex items-center gap-3 group mb-3"
        >
          <Avatar
            src={winner.avatar_url}
            fallback={winner.display_name || winner.username}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white group-hover:text-for-300 transition-colors truncate">
              {winner.display_name || winner.username}
            </p>
            <p className="text-xs font-mono text-surface-500 truncate">@{winner.username}</p>
          </div>
          <ArrowRight
            className="h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0"
            aria-hidden="true"
          />
        </Link>

        {/* Metric */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3.5 py-2.5',
            config.iconBg,
            config.iconBorder
          )}
        >
          <Trophy className={cn('h-4 w-4 flex-shrink-0', config.iconColor)} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <span className={cn('text-xl font-mono font-black', config.tierColor)}>
              {winner.metric.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-surface-500 ml-1.5">{winner.metric_label}</span>
          </div>
        </div>

        {winner.detail && (
          <p className="text-[11px] font-mono text-surface-500 mt-2 px-1">{winner.detail}</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Award card: empty variant ────────────────────────────────────────────────

function EmptyAwardCard({ config, delay = 0 }: { config: AwardConfig; delay?: number }) {
  const Icon = config.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 border-dashed overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-surface-300/50">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg border flex-shrink-0 opacity-50',
              config.iconBg,
              config.iconBorder
            )}
          >
            <Icon className={cn('h-4 w-4', config.iconColor)} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-surface-600">
              {config.title}
            </p>
            <p className="text-[11px] font-mono text-surface-600/70">{config.subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-5 flex flex-col items-center justify-center gap-2 py-8">
        <Award className="h-8 w-8 text-surface-600/40" aria-hidden="true" />
        <p className="text-xs font-mono text-surface-600 text-center">
          No data for this period yet
        </p>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AwardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-300 bg-surface-200/50">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-36" />
          </div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AwardsClient() {
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<AwardsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAwards = useCallback(async (p: Period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/awards?period=${p}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load awards')
      const json = (await res.json()) as AwardsResponse
      setData(json)
    } catch {
      setError('Unable to load awards. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAwards(period)
  }, [period, fetchAwards])

  function handlePeriodChange(p: Period) {
    if (p === period) return
    setPeriod(p)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-black text-white">
              Civic Awards Hall
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Recognising standout civic contributors
            </p>
          </div>
          <button
            onClick={() => fetchAwards(period, true)}
            disabled={loading || refreshing}
            aria-label="Refresh awards"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* ── Period selector ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 mb-6 p-1 rounded-xl bg-surface-200/60 border border-surface-300/60 w-fit">
          {PERIODS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handlePeriodChange(id)}
              aria-pressed={period === id}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-mono font-semibold transition-all',
                period === id
                  ? 'bg-for-600 text-white shadow-sm'
                  : 'text-surface-500 hover:text-white hover:bg-surface-300/60'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Error state ────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 mb-6 flex items-center gap-3">
            <Award className="h-5 w-5 text-against-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => fetchAwards(period)}
              className="ml-auto text-xs font-mono text-against-300 hover:text-against-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Award grid ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {AWARD_CONFIGS.map((cfg) => (
                <AwardSkeleton key={cfg.key} />
              ))}
            </motion.div>
          ) : data ? (
            <motion.div
              key={period}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {AWARD_CONFIGS.map((cfg, i) => {
                const award = data[cfg.key]
                if (!award) {
                  return (
                    <EmptyAwardCard
                      key={cfg.key}
                      config={cfg}
                      delay={i * 0.05}
                    />
                  )
                }
                return (
                  <WinnerCard
                    key={cfg.key}
                    config={cfg}
                    award={award}
                    delay={i * 0.05}
                  />
                )
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Footer note ────────────────────────────────────────────────────── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-col items-center gap-3 text-center"
          >
            <p className="text-xs font-mono text-surface-600">
              Awards refresh every 5 minutes · Updated{' '}
              {new Date(data.generated_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/leaderboard"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                Full Leaderboard
              </Link>
              <span className="text-surface-700" aria-hidden="true">·</span>
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                My Analytics
              </Link>
              <span className="text-surface-700" aria-hidden="true">·</span>
              <Link
                href="/arguments"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                All Arguments
              </Link>
            </div>
          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
