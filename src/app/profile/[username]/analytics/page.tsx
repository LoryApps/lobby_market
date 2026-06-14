'use client'

/**
 * /profile/[username]/analytics — Public Civic Analytics
 *
 * A transparent view of a citizen's voting patterns, accuracy, argument
 * quality, and civic engagement — accessible to any visitor.
 *
 * Distinct from:
 *   /analytics                     — personal dashboard with private data (own user only)
 *   /profile/[username]/growth     — historical growth chart and milestones
 *   /profile/[username]/impact     — laws shaped, top arguments, footprint
 *   /profile/[username]/votes      — chronological vote log
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { VoteCalendar } from '@/components/profile/VoteCalendar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ProfileAnalyticsResponse, CategoryStat } from '@/app/api/profile/[username]/analytics/route'

// ─── Category colours (matches platform convention) ───────────────────────────

const CAT_COLOR: Record<string, { bar: string; text: string; bg: string }> = {
  Economics:    { bar: 'bg-gold',         text: 'text-gold',        bg: 'bg-gold/10' },
  Politics:     { bar: 'bg-for-500',      text: 'text-for-400',     bg: 'bg-for-500/10' },
  Technology:   { bar: 'bg-purple',       text: 'text-purple',      bg: 'bg-purple/10' },
  Science:      { bar: 'bg-emerald',      text: 'text-emerald',     bg: 'bg-emerald/10' },
  Ethics:       { bar: 'bg-against-500',  text: 'text-against-400', bg: 'bg-against-500/10' },
  Philosophy:   { bar: 'bg-indigo-400',   text: 'text-indigo-400',  bg: 'bg-indigo-400/10' },
  Culture:      { bar: 'bg-orange-400',   text: 'text-orange-400',  bg: 'bg-orange-400/10' },
  Health:       { bar: 'bg-pink-400',     text: 'text-pink-400',    bg: 'bg-pink-400/10' },
  Environment:  { bar: 'bg-green-400',    text: 'text-green-400',   bg: 'bg-green-400/10' },
  Education:    { bar: 'bg-cyan-400',     text: 'text-cyan-400',    bg: 'bg-cyan-400/10' },
}

function catColor(cat: string) {
  return CAT_COLOR[cat] ?? { bar: 'bg-surface-500', text: 'text-surface-400', bg: 'bg-surface-500/10' }
}

// ─── Accuracy label ────────────────────────────────────────────────────────────

function accuracyLabel(pct: number | null) {
  if (pct === null) return { label: 'Not enough data', color: 'text-surface-500' }
  if (pct >= 75) return { label: 'Prescient', color: 'text-gold' }
  if (pct >= 65) return { label: 'Sharp', color: 'text-emerald' }
  if (pct >= 55) return { label: 'Solid', color: 'text-for-400' }
  if (pct >= 45) return { label: 'Average', color: 'text-surface-400' }
  return { label: 'Contrarian', color: 'text-against-400' }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof Vote
  accent: 'for' | 'against' | 'gold' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentColors: Record<string, string> = {
    for:      'text-for-400 bg-for-500/10 border-for-500/25',
    against:  'text-against-400 bg-against-500/10 border-against-500/25',
    gold:     'text-gold bg-gold/10 border-gold/25',
    emerald:  'text-emerald bg-emerald/10 border-emerald/25',
    purple:   'text-purple bg-purple/10 border-purple/25',
    neutral:  'text-surface-400 bg-surface-300/30 border-surface-300',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className={cn('inline-flex items-center justify-center h-9 w-9 rounded-xl border mb-3', accentColors[accent])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-mono font-bold text-white mb-0.5">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[11px] font-mono text-surface-600 mt-1">{sub}</div>}
    </motion.div>
  )
}

function CategoryBar({ stat, maxVotes, delay }: { stat: CategoryStat; maxVotes: number; delay: number }) {
  const c = catColor(stat.category)
  const widthPct = maxVotes > 0 ? Math.round((stat.votes / maxVotes) * 100) : 0
  const forPct = stat.forPct
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-mono font-medium', c.text)}>{stat.category}</span>
        <span className="text-[11px] font-mono text-surface-500">{stat.votes} votes</span>
      </div>
      {/* Volume bar */}
      <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', c.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1, ease: 'easeOut' }}
        />
      </div>
      {/* For/Against split */}
      <div className="h-1 w-full rounded-full bg-surface-300 overflow-hidden flex">
        <motion.div
          className="h-full bg-gradient-to-r from-for-700 to-for-400"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6, delay: delay + 0.2, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-against-500"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.6, delay: delay + 0.25, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span className="text-for-500">{forPct}% For</span>
        <span className="text-against-500">{againstPct}% Against</span>
      </div>
    </motion.div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-9 w-9 rounded-xl mb-3" />
            <Skeleton className="h-7 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProfileAnalyticsPage() {
  const { username } = useParams<{ username: string }>()
  const router = useRouter()
  const [data, setData] = useState<ProfileAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/analytics`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Failed to load analytics')
      }
      setData(await res.json() as ProfileAnalyticsResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  const p = data?.profile

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + heading */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface-100 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {p ? (
            <Link
              href={`/profile/${p.username}`}
              className="flex items-center gap-2.5 group"
            >
              <Avatar
                src={p.avatar_url}
                username={p.username}
                size="sm"
                className="flex-shrink-0"
              />
              <div>
                <p className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                  {p.display_name ?? p.username}
                </p>
                <p className="text-[11px] font-mono text-surface-500">Civic Analytics</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          )}
        </div>

        {/* Breadcrumb nav */}
        {p && (
          <nav className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 mb-6 flex-wrap">
            <Link href={`/profile/${p.username}`} className="hover:text-white transition-colors">
              {p.display_name ?? p.username}
            </Link>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            <span className="text-surface-400">Analytics</span>
            {data?.isOwnProfile && (
              <>
                <span className="text-surface-600 mx-1">·</span>
                <Link href="/analytics" className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                  Full private view <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            )}
          </nav>
        )}

        {loading && <AnalyticsSkeleton />}

        {error && (
          <EmptyState
            icon={XCircle}
            title="Couldn't load analytics"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {data && !loading && (
          <AnimatePresence>
            <div className="space-y-4">

              {/* ── Stat cards ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total votes"
                  value={data.profile.total_votes}
                  icon={Vote}
                  accent="for"
                />
                <StatCard
                  label="Accuracy"
                  value={data.accuracy !== null ? `${data.accuracy}%` : '—'}
                  sub={data.resolvedVotes > 0 ? `${data.resolvedVotes} resolved` : 'No resolved votes yet'}
                  icon={Target}
                  accent={
                    data.accuracy === null ? 'neutral'
                    : data.accuracy >= 65 ? 'gold'
                    : data.accuracy >= 50 ? 'emerald'
                    : 'against'
                  }
                />
                <StatCard
                  label="Arguments"
                  value={data.argumentsTotal}
                  sub={data.argumentsUpvotes > 0 ? `${data.argumentsUpvotes} upvotes` : undefined}
                  icon={MessageSquare}
                  accent="purple"
                />
                <StatCard
                  label="Clout"
                  value={data.profile.clout}
                  icon={Coins}
                  accent="gold"
                />
              </div>

              {/* ── Leaning + accuracy summary ────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  {/* Overall stance */}
                  <div>
                    <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5" /> Overall stance
                    </p>
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1 text-[11px] font-mono">
                        <span className="text-for-400 font-semibold">{data.leaningPct}% For</span>
                        <span className="text-against-400 font-semibold">{100 - data.leaningPct}% Against</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden flex">
                        <motion.div
                          className="h-full bg-gradient-to-r from-for-700 to-for-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${data.leaningPct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                        />
                        <motion.div
                          className="h-full bg-against-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${100 - data.leaningPct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                    </div>
                    <p className={cn(
                      'text-sm font-mono font-bold',
                      data.leaningPct >= 55 ? 'text-for-400' :
                      data.leaningPct <= 45 ? 'text-against-400' :
                      'text-surface-400'
                    )}>
                      {data.leaningLabel}
                    </p>
                    {data.topCategory && (
                      <p className="text-[11px] font-mono text-surface-500 mt-1">
                        Most active: <span className={catColor(data.topCategory).text}>{data.topCategory}</span>
                      </p>
                    )}
                  </div>

                  {/* Accuracy gauge */}
                  <div>
                    <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Vote accuracy
                    </p>
                    {data.accuracy !== null ? (
                      <>
                        <div className="text-3xl font-mono font-bold text-white mb-1">
                          {data.accuracy}<span className="text-lg text-surface-500">%</span>
                        </div>
                        <p className={cn('text-sm font-mono font-semibold', accuracyLabel(data.accuracy).color)}>
                          {accuracyLabel(data.accuracy).label}
                        </p>
                        <p className="text-[11px] font-mono text-surface-500 mt-1">
                          {data.correctVotes} / {data.resolvedVotes} correct
                        </p>
                      </>
                    ) : (
                      <div className="text-sm font-mono text-surface-500 mt-2">
                        Accuracy unlocks once 5+ topics resolve
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* ── Category breakdown ────────────────────────────────────── */}
              {data.categories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" /> Category breakdown
                  </h2>
                  <div className="space-y-4">
                    {data.categories.slice(0, 8).map((stat, i) => (
                      <CategoryBar
                        key={stat.category}
                        stat={stat}
                        maxVotes={data.categories[0]?.votes ?? 1}
                        delay={0.05 * i}
                      />
                    ))}
                  </div>
                  {data.categories.length > 8 && (
                    <p className="text-[11px] font-mono text-surface-600 mt-3">
                      + {data.categories.length - 8} more categories
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Vote heatmap ─────────────────────────────────────────── */}
              {data.dailyActivity.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 overflow-hidden"
                >
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5" /> Voting activity — last 12 months
                  </h2>
                  <VoteCalendar days={data.dailyActivity} />
                </motion.div>
              )}

              {/* ── Arguments + predictions row ───────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Argument quality */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Arguments
                  </h2>
                  {data.argumentsTotal > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-surface-400">Written</span>
                        <span className="text-sm font-mono font-semibold text-white">{data.argumentsTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-surface-400">Upvotes received</span>
                        <span className={cn('text-sm font-mono font-semibold', data.argumentsUpvotes > 0 ? 'text-emerald' : 'text-surface-500')}>
                          {data.argumentsUpvotes > 0 ? `+${data.argumentsUpvotes.toLocaleString()}` : '0'}
                        </span>
                      </div>
                      {data.argumentsTotal > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono text-surface-400">Avg upvotes</span>
                          <span className="text-sm font-mono font-semibold text-white">
                            {(data.argumentsUpvotes / data.argumentsTotal).toFixed(1)}
                          </span>
                        </div>
                      )}
                      <Link
                        href={`/profile/${p?.username}/arguments`}
                        className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors mt-2"
                      >
                        View arguments <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm font-mono text-surface-500">No arguments written yet</p>
                  )}
                </motion.div>

                {/* Predictions */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Predictions
                  </h2>
                  {data.predictionsTotal > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-surface-400">Total made</span>
                        <span className="text-sm font-mono font-semibold text-white">{data.predictionsTotal}</span>
                      </div>
                      {data.predictionsAccuracy !== null ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono text-surface-400">Accuracy</span>
                            <span className={cn('text-sm font-mono font-semibold', accuracyLabel(data.predictionsAccuracy).color)}>
                              {data.predictionsAccuracy}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono text-surface-400">Rating</span>
                            <span className={cn('text-sm font-mono font-semibold', accuracyLabel(data.predictionsAccuracy).color)}>
                              {accuracyLabel(data.predictionsAccuracy).label}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] font-mono text-surface-500">
                          Need 3+ resolved predictions for accuracy rating
                        </p>
                      )}
                      <Link
                        href={`/profile/${p?.username}/predictions`}
                        className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors mt-2"
                      >
                        View predictions <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm font-mono text-surface-500">No predictions made yet</p>
                  )}
                </motion.div>
              </div>

              {/* ── Platform comparison ───────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Compared to the platform
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Voting volume */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <Vote className="h-3.5 w-3.5" /> Voting volume
                    </div>
                    {(() => {
                      const userVotes = data.profile.total_votes
                      const avg = data.platformAvgVotes
                      const ratio = avg > 0 ? Math.round((userVotes / avg) * 100) : 100
                      const isAbove = userVotes >= avg
                      return (
                        <>
                          <div className={cn('text-lg font-mono font-bold', isAbove ? 'text-emerald' : 'text-surface-400')}>
                            {ratio}% of avg
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                            {isAbove
                              ? <ThumbsUp className="h-3 w-3 text-emerald" />
                              : <ThumbsDown className="h-3 w-3 text-surface-500" />}
                            {isAbove ? 'Above' : 'Below'} platform average ({avg.toLocaleString()} votes)
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Streak */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <Flame className="h-3.5 w-3.5" /> Current streak
                    </div>
                    <div className={cn(
                      'text-lg font-mono font-bold',
                      data.profile.vote_streak >= 30 ? 'text-against-300' :
                      data.profile.vote_streak >= 7 ? 'text-gold' :
                      data.profile.vote_streak >= 1 ? 'text-amber-400' : 'text-surface-500'
                    )}>
                      {data.profile.vote_streak} day{data.profile.vote_streak !== 1 ? 's' : ''}
                    </div>
                    <div className="text-[11px] font-mono text-surface-500">
                      {data.profile.vote_streak >= 30 ? 'Legendary streak' :
                       data.profile.vote_streak >= 7 ? 'Hot streak' :
                       data.profile.vote_streak >= 1 ? 'On a roll' :
                       'No current streak'}
                    </div>
                  </div>

                  {/* Reputation */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <Star className="h-3.5 w-3.5" /> Reputation score
                    </div>
                    <div className="text-lg font-mono font-bold text-white">
                      {data.profile.reputation_score.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-mono text-surface-500">
                      {data.profile.reputation_score >= 1000 ? 'Elite standing' :
                       data.profile.reputation_score >= 500 ? 'Strong standing' :
                       data.profile.reputation_score >= 100 ? 'Building reputation' :
                       'Getting started'}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ── Related pages ─────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> More about this citizen
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { href: `/profile/${p?.username}/growth`, label: 'Growth chart', desc: 'Monthly activity & milestones', icon: TrendingUp },
                    { href: `/profile/${p?.username}/impact`, label: 'Impact score', desc: 'Laws shaped, footprint & influence', icon: Gavel },
                    { href: `/profile/${p?.username}/votes`, label: 'Vote history', desc: 'Every vote, chronologically', icon: Vote },
                    { href: `/profile/${p?.username}/arguments`, label: 'Arguments', desc: 'Their best civic arguments', icon: MessageSquare },
                  ].map(({ href, label, desc, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-surface-300/50 border border-surface-300 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-surface-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-medium text-white">{label}</p>
                        <p className="text-[11px] font-mono text-surface-500 truncate">{desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors ml-auto flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* Refresh */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={load}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh analytics
                </button>
              </div>

            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
