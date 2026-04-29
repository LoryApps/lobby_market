'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicStatsResponse, VelocityBucket } from '@/app/api/topics/[id]/stats/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Vote Velocity Chart (SVG) ────────────────────────────────────────────────

function VelocityChart({ buckets }: { buckets: VelocityBucket[] }) {
  if (buckets.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-surface-500 font-mono">
        Not enough data yet
      </div>
    )
  }

  // Show last 30 days
  const visible = buckets.slice(-30)
  const maxTotal = Math.max(1, ...visible.map((b) => b.forVotes + b.againstVotes))

  const W = 600
  const H = 100
  const barW = Math.floor(W / visible.length) - 1
  const pad = 2

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ minWidth: Math.max(300, visible.length * 14) }}
        aria-label="Daily vote velocity chart"
        role="img"
      >
        {visible.map((b, i) => {
          const total = b.forVotes + b.againstVotes
          if (total === 0) return null
          const barH = Math.max(2, Math.round((total / maxTotal) * (H - pad)))
          const forH = Math.round(barH * (b.forVotes / total))
          const againstH = barH - forH
          const x = i * (barW + 1)
          const y = H - barH - pad

          return (
            <g key={b.date}>
              {/* FOR portion */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={forH}
                fill="#3b82f6"
                opacity={0.85}
                rx={1}
              />
              {/* AGAINST portion */}
              <rect
                x={x}
                y={y + forH}
                width={barW}
                height={againstH}
                fill="#ef4444"
                opacity={0.8}
              />
            </g>
          )
        })}
      </svg>

      {/* X-axis labels: first + last + peak */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[10px] font-mono text-surface-500">
          {formatDay(visible[0].date)}
        </span>
        <span className="text-[10px] font-mono text-surface-500">
          {formatDay(visible[visible.length - 1].date)}
        </span>
      </div>
    </div>
  )
}

// ─── FOR / AGAINST pct bar ────────────────────────────────────────────────────

function SplitBar({ forPct, height = 'h-3' }: { forPct: number; height?: string }) {
  const fp = Math.round(forPct)
  const ap = 100 - fp
  return (
    <div className={cn('flex w-full rounded-full overflow-hidden bg-surface-300', height)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${fp}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-for-500"
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${ap}%` }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="bg-against-500"
      />
    </div>
  )
}

// ─── Role label helpers ───────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  citizen: 'Citizens',
  troll_catcher: 'Troll Catchers',
  elder: 'Elders',
}

const ROLE_COLOR: Record<string, { text: string; bg: string; bar: string }> = {
  citizen: { text: 'text-surface-400', bg: 'bg-surface-300/60', bar: 'bg-surface-500' },
  troll_catcher: { text: 'text-emerald', bg: 'bg-emerald/10', bar: 'bg-emerald' },
  elder: { text: 'text-gold', bg: 'bg-gold/10', bar: 'bg-gold' },
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof BarChart2
  color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      {/* Role breakdown */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="flex justify-between mb-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TopicStatsPage() {
  const params = useParams()
  const topicId = params.id as string

  const [data, setData] = useState<TopicStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/stats`)
      if (!res.ok) throw new Error('Failed to load stats')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const momentum = data
    ? data.votesLast24h >= 10
      ? 'surging'
      : data.votesLast7d >= 50
      ? 'active'
      : 'quiet'
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-for-400 flex-shrink-0" />
              <h1 className="font-mono text-lg font-bold text-white">Topic Stats</h1>
            </div>
            {data && (
              <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                {data.statement}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <StatsSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <EmptyState
                icon={Scale}
                title="Couldn't load stats"
                description={error}
                actions={[{ label: 'Try again', onClick: load }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* ── Status + momentum badge ─────────────────────────────── */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    data.status === 'law'
                      ? 'law'
                      : data.status === 'failed'
                      ? 'failed'
                      : data.status === 'active' || data.status === 'voting'
                      ? 'active'
                      : 'proposed'
                  }
                >
                  {data.status === 'law' ? (
                    <><Gavel className="h-3 w-3 mr-1" />LAW</>
                  ) : data.status === 'voting' ? (
                    <><Scale className="h-3 w-3 mr-1" />Voting</>
                  ) : data.status === 'active' ? (
                    <><Zap className="h-3 w-3 mr-1" />Active</>
                  ) : (
                    data.status
                  )}
                </Badge>
                {data.category && (
                  <Badge variant="proposed" className="text-surface-400 border-surface-400/30 bg-surface-300/20">
                    {data.category}
                  </Badge>
                )}
                {momentum === 'surging' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[11px] font-mono font-semibold text-orange-400">
                    <Flame className="h-3 w-3" />
                    Surging
                  </span>
                )}
                {momentum === 'active' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-for-500/15 border border-for-500/30 text-[11px] font-mono font-semibold text-for-400">
                    <TrendingUp className="h-3 w-3" />
                    Active
                  </span>
                )}
              </div>

              {/* ── Key stats grid ──────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Votes"
                  value={fmtNum(data.totalVotes)}
                  icon={Users}
                  color="text-white"
                />
                <StatCard
                  label="For"
                  value={`${data.forPct}%`}
                  sub={`${fmtNum(Math.round(data.totalVotes * data.forPct / 100))} votes`}
                  icon={ThumbsUp}
                  color="text-for-400"
                />
                <StatCard
                  label="Against"
                  value={`${100 - data.forPct}%`}
                  sub={`${fmtNum(data.totalVotes - Math.round(data.totalVotes * data.forPct / 100))} votes`}
                  icon={ThumbsDown}
                  color="text-against-400"
                />
                {data.lawConfidence != null ? (
                  <StatCard
                    label="Law Odds"
                    value={`${Math.round(data.lawConfidence)}%`}
                    sub={`${data.totalPredictions} predictions`}
                    icon={Target}
                    color="text-purple"
                  />
                ) : (
                  <StatCard
                    label="Last 24h"
                    value={fmtNum(data.votesLast24h)}
                    sub="new votes"
                    icon={Clock}
                    color="text-emerald"
                  />
                )}
              </div>

              {/* ── FOR vs AGAINST summary bar ──────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex justify-between text-xs font-mono font-semibold mb-2">
                  <span className="text-for-400">FOR {data.forPct}%</span>
                  <span className="text-against-400">AGAINST {100 - data.forPct}%</span>
                </div>
                <SplitBar forPct={data.forPct} height="h-4" />
              </div>

              {/* ── Vote velocity chart ─────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-semibold text-white">Vote Velocity</h2>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-for-500 inline-block" />
                      <span className="text-surface-500">FOR</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-against-500 inline-block" />
                      <span className="text-surface-500">AGAINST</span>
                    </span>
                  </div>
                </div>
                <VelocityChart buckets={data.velocity} />

                {/* Velocity sub-stats */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-300">
                  <div className="text-center">
                    <p className="text-lg font-bold font-mono text-white">{fmtNum(data.votesLast24h)}</p>
                    <p className="text-[10px] text-surface-500 font-mono">Last 24h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold font-mono text-white">{fmtNum(data.votesLast7d)}</p>
                    <p className="text-[10px] text-surface-500 font-mono">Last 7 days</p>
                  </div>
                  <div className="text-center">
                    {data.peakDay ? (
                      <>
                        <p className="text-lg font-bold font-mono text-gold">{fmtNum(data.peakDayVotes)}</p>
                        <p className="text-[10px] text-surface-500 font-mono">{formatDay(data.peakDay)}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold font-mono text-white">—</p>
                        <p className="text-[10px] text-surface-500 font-mono">Peak day</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Role breakdown ──────────────────────────────────────── */}
              {data.roleSplit.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-surface-400" />
                    <h2 className="text-sm font-semibold text-white">Vote Breakdown by Role</h2>
                  </div>
                  <div className="space-y-4">
                    {data.roleSplit.map((r) => {
                      const style = ROLE_COLOR[r.role] ?? ROLE_COLOR.citizen
                      return (
                        <div key={r.role}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-xs font-semibold', style.text)}>
                                {ROLE_LABEL[r.role] ?? r.role}
                              </span>
                              <span className="text-[11px] text-surface-500">
                                ({fmtNum(r.total)} votes)
                              </span>
                            </div>
                            <div className="text-xs font-mono">
                              <span className="text-for-400 font-semibold">{r.forPct}%</span>
                              <span className="text-surface-500 mx-1">FOR</span>
                            </div>
                          </div>
                          <SplitBar forPct={r.forPct} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Hot takes ───────────────────────────────────────────── */}
              {data.hotTakes.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <h2 className="text-sm font-semibold text-white">Hot Takes</h2>
                      {data.totalHotTakes > 12 && (
                        <span className="text-[11px] text-surface-500">
                          {data.totalHotTakes.toLocaleString()} total
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/topic/${topicId}#hot-takes`}
                      className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      See all
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {data.hotTakes.map((take) => (
                      <motion.div
                        key={take.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'flex gap-3 p-3 rounded-xl border',
                          take.side === 'blue'
                            ? 'bg-for-500/5 border-for-500/20'
                            : 'bg-against-500/5 border-against-500/20'
                        )}
                      >
                        <Avatar
                          src={take.avatar_url}
                          fallback={take.display_name || take.username}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/profile/${take.username}`}
                              className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate"
                            >
                              {take.display_name || `@${take.username}`}
                            </Link>
                            <span
                              className={cn(
                                'flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                                take.side === 'blue'
                                  ? 'bg-for-600/30 text-for-300'
                                  : 'bg-against-600/30 text-against-300'
                              )}
                            >
                              {take.side === 'blue' ? (
                                <><ThumbsUp className="h-2.5 w-2.5" /> FOR</>
                              ) : (
                                <><ThumbsDown className="h-2.5 w-2.5" /> AGAINST</>
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-surface-300 leading-relaxed">
                            {take.reason}
                          </p>
                          <p className="text-[10px] text-surface-500 mt-1">
                            {relativeTime(take.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Prediction market ───────────────────────────────────── */}
              {data.lawConfidence != null && data.totalPredictions > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple" />
                      <h2 className="text-sm font-semibold text-white">Prediction Market</h2>
                    </div>
                    <Link
                      href={`/predictions`}
                      className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                    >
                      Market <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1.5 text-xs font-mono font-semibold">
                        <span className="text-for-400">Predicting LAW</span>
                        <span className="text-against-400">Predicting FAIL</span>
                      </div>
                      <SplitBar forPct={data.lawConfidence} />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-surface-500">
                      <span>
                        <span className="text-purple font-semibold font-mono">
                          {Math.round(data.lawConfidence)}%
                        </span>{' '}
                        community confidence in passage
                      </span>
                      <span className="ml-auto">
                        {data.totalPredictions.toLocaleString()} predictors
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Links ───────────────────────────────────────────────── */}
              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/topic/${topicId}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  View Debate
                </Link>
                <Link
                  href={`/topic/${topicId}/voters`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-semibold transition-colors"
                >
                  <Users className="h-4 w-4" />
                  Voter List
                </Link>
                <Link
                  href={`/topic/${topicId}/timeline`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-semibold transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  Timeline
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
