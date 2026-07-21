'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart2,
  Calendar,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
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
import type { WeeklyTopicDigest, WeeklyArgument, WeeklyContributor } from '@/app/api/topics/[id]/weekly/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function pctColor(pct: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (pct >= 67) return 'text-gold'
  if (pct >= 55) return 'text-for-400'
  if (pct <= 33) return 'text-against-400'
  if (pct <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function deltaColor(delta: number | null): string {
  if (delta === null) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  if (delta < 0) return 'text-against-400'
  return 'text-surface-500'
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta}pp`
  return `${delta}pp`
}

// ─── Mini consensus chart ─────────────────────────────────────────────────────

interface MiniChartProps {
  ticks: { day: string; price: number }[]
  currentPct: number
  status: string
}

function MiniChart({ ticks, currentPct, status }: MiniChartProps) {
  const data = ticks.length > 0
    ? ticks
    : [{ day: 'now', price: currentPct }]

  const min = Math.max(0, Math.min(...data.map((d) => d.price)) - 5)
  const max = Math.min(100, Math.max(...data.map((d) => d.price)) + 5)
  const range = max - min || 10

  const W = 320
  const H = 80
  const PAD = 8

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.price - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })

  const fillPoints = [
    `${PAD},${H - PAD}`,
    ...points,
    `${W - PAD},${H - PAD}`,
  ].join(' ')

  const strokeColor =
    status === 'law'
      ? '#d4a017'
      : currentPct >= 55
      ? '#3b82f6'
      : currentPct <= 45
      ? '#ef4444'
      : '#6b7280'

  const fillColor =
    status === 'law'
      ? 'rgba(212,160,23,0.12)'
      : currentPct >= 55
      ? 'rgba(59,130,246,0.10)'
      : currentPct <= 45
      ? 'rgba(239,68,68,0.10)'
      : 'rgba(107,114,128,0.08)'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      <polygon points={fillPoints} fill={fillColor} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 50% reference line */}
      {min <= 50 && max >= 50 && (
        <line
          x1={PAD}
          y1={H - PAD - ((50 - min) / range) * (H - PAD * 2)}
          x2={W - PAD}
          y2={H - PAD - ((50 - min) / range) * (H - PAD * 2)}
          stroke="#374151"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
    </svg>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({ arg, topicId }: { arg: WeeklyArgument; topicId: string }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/topic/${topicId}/arguments`}
      className={cn(
        'block rounded-xl border p-3.5 transition-colors',
        isFor
          ? 'bg-for-900/20 border-for-800/40 hover:border-for-700/60'
          : 'bg-against-900/20 border-against-800/40 hover:border-against-700/60'
      )}
    >
      <div className="flex items-start gap-2.5">
        {isFor ? (
          <ThumbsUp className="h-4 w-4 text-for-400 mt-0.5 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-against-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-surface-100 line-clamp-3 leading-relaxed">
            {arg.content}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar
                src={arg.author_avatar_url}
                fallback={arg.author_display_name || arg.author_username}
                size="xs"
              />
              <span className="text-xs text-surface-500 truncate">
                {arg.author_display_name || `@${arg.author_username}`}
              </span>
            </div>
            <span className="text-xs text-surface-600 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {arg.upvotes}
            </span>
            {arg.ai_grade && (
              <span className={cn(
                'text-xs font-mono font-medium',
                arg.ai_grade.startsWith('A') ? 'text-emerald' :
                arg.ai_grade.startsWith('B') ? 'text-for-400' :
                arg.ai_grade.startsWith('C') ? 'text-gold' : 'text-surface-500'
              )}>
                {arg.ai_grade}
              </span>
            )}
            <span className="text-xs text-surface-600 ml-auto flex-shrink-0">
              {relTime(arg.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Contributor row ──────────────────────────────────────────────────────────

function ContributorRow({ contributor, rank }: { contributor: WeeklyContributor; rank: number }) {
  return (
    <Link
      href={`/profile/${contributor.username}`}
      className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-surface-800/50 transition-colors"
    >
      <span className={cn(
        'text-xs font-mono w-5 text-center flex-shrink-0',
        rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-300' : rank === 3 ? 'text-amber-600' : 'text-surface-600'
      )}>
        {rank}
      </span>
      <Avatar
        src={contributor.avatar_url}
        fallback={contributor.display_name || contributor.username}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">
          {contributor.display_name || `@${contributor.username}`}
        </p>
        <p className="text-xs text-surface-500">
          {contributor.argument_count} arg{contributor.argument_count !== 1 ? 's' : ''} · {contributor.upvotes_received} upvote{contributor.upvotes_received !== 1 ? 's' : ''}
        </p>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </Link>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeeklyClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeeklyClient({ topicId, statement, category, status }: WeeklyClientProps) {
  const [digest, setDigest] = useState<WeeklyTopicDigest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/weekly`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json() as WeeklyTopicDigest
      setDigest(data)
    } catch {
      setError('Could not load weekly digest.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    void load()
  }, [load])

  const statusBadge: 'proposed' | 'active' | 'law' | 'failed' =
    status === 'law' ? 'law' : status === 'failed' ? 'failed' : status === 'voting' ? 'active' : status === 'active' ? 'active' : 'proposed'

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="mt-0.5 rounded-lg p-1.5 text-surface-500 hover:text-white hover:bg-surface-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-surface-500 font-mono">
                <Calendar className="h-3.5 w-3.5" />
                Weekly Digest
              </span>
              {category && (
                <span className="text-xs text-surface-600">· {category}</span>
              )}
              <Badge variant={statusBadge} size="sm" />
            </div>
            <h1 className="text-base font-semibold text-white leading-snug line-clamp-2">
              {statement}
            </h1>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <EmptyState
            icon={BarChart2}
            title="Digest unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* ── Content ── */}
        {!loading && digest && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Signals row */}
            {(digest.is_trending || digest.is_near_law || digest.is_deadlocked || digest.is_surging) && (
              <div className="flex flex-wrap gap-2">
                {digest.is_surging && (
                  <span className="flex items-center gap-1.5 text-xs bg-emerald/10 text-emerald border border-emerald/30 rounded-full px-2.5 py-1">
                    <Zap className="h-3 w-3" />
                    Surging
                  </span>
                )}
                {digest.is_trending && (
                  <span className="flex items-center gap-1.5 text-xs bg-for-500/10 text-for-300 border border-for-500/30 rounded-full px-2.5 py-1">
                    <Flame className="h-3 w-3" />
                    Trending
                  </span>
                )}
                {digest.is_near_law && (
                  <span className="flex items-center gap-1.5 text-xs bg-gold/10 text-gold border border-gold/30 rounded-full px-2.5 py-1">
                    <Gavel className="h-3 w-3" />
                    Near Law
                  </span>
                )}
                {digest.is_deadlocked && (
                  <span className="flex items-center gap-1.5 text-xs bg-surface-700/50 text-surface-300 border border-surface-600/50 rounded-full px-2.5 py-1">
                    <Scale className="h-3 w-3" />
                    Deadlocked
                  </span>
                )}
              </div>
            )}

            {/* Consensus card */}
            <div className="rounded-xl border border-surface-700/50 bg-surface-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">
                  Consensus this week
                </span>
                <button
                  onClick={load}
                  className="p-1 rounded text-surface-600 hover:text-surface-300 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-end gap-4 mb-3">
                <div>
                  <span className={cn('text-4xl font-bold tabular-nums', pctColor(digest.current_pct, digest.status))}>
                    {digest.current_pct}%
                  </span>
                  <span className="text-sm text-surface-500 ml-1">FOR</span>
                </div>
                {digest.pct_change_7d !== null && (
                  <div className="flex items-center gap-1 mb-1">
                    {digest.pct_change_7d > 0 ? (
                      <TrendingUp className={cn('h-4 w-4', deltaColor(digest.pct_change_7d))} />
                    ) : digest.pct_change_7d < 0 ? (
                      <TrendingDown className={cn('h-4 w-4', deltaColor(digest.pct_change_7d))} />
                    ) : null}
                    <span className={cn('text-sm font-medium', deltaColor(digest.pct_change_7d))}>
                      {deltaLabel(digest.pct_change_7d)}
                    </span>
                    <span className="text-xs text-surface-600">vs 7d ago</span>
                  </div>
                )}
              </div>

              {/* Mini chart */}
              {digest.price_ticks.length > 1 && (
                <div className="border border-surface-700/40 rounded-lg overflow-hidden bg-surface-950/50 mb-3">
                  <MiniChart
                    ticks={digest.price_ticks}
                    currentPct={digest.current_pct}
                    status={digest.status}
                  />
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-surface-800/50 p-2.5 text-center">
                  <p className="text-lg font-bold text-white tabular-nums">
                    {digest.votes_this_week.toLocaleString()}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">Votes this week</p>
                  {digest.votes_pct_change !== null && (
                    <p className={cn('text-xs mt-0.5', deltaColor(digest.votes_pct_change))}>
                      {digest.votes_pct_change > 0 ? '+' : ''}{digest.votes_pct_change}%
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-for-900/30 border border-for-800/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-for-300 tabular-nums">
                    {digest.blue_votes.toLocaleString()}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">FOR votes</p>
                </div>
                <div className="rounded-lg bg-against-900/30 border border-against-800/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-against-300 tabular-nums">
                    {digest.red_votes.toLocaleString()}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">AGAINST</p>
                </div>
              </div>
            </div>

            {/* Arguments this week */}
            <div className="rounded-xl border border-surface-700/50 bg-surface-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-surface-500" />
                  <span className="text-sm font-medium text-white">Arguments this week</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-surface-500">
                  <span className="text-for-400">{digest.new_for_count} FOR</span>
                  <span className="text-against-400">{digest.new_against_count} AGAINST</span>
                </div>
              </div>

              {digest.top_for_args.length === 0 && digest.top_against_args.length === 0 ? (
                <p className="text-sm text-surface-600 text-center py-4">
                  No new arguments this week yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* FOR args */}
                  {digest.top_for_args.length > 0 && (
                    <div>
                      <p className="text-xs text-for-400 font-medium mb-2 flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        Top FOR arguments
                      </p>
                      <div className="space-y-2">
                        {digest.top_for_args.map((arg) => (
                          <ArgCard key={arg.id} arg={arg} topicId={topicId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AGAINST args */}
                  {digest.top_against_args.length > 0 && (
                    <div className={digest.top_for_args.length > 0 ? 'mt-3' : ''}>
                      <p className="text-xs text-against-400 font-medium mb-2 flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3" />
                        Top AGAINST arguments
                      </p>
                      <div className="space-y-2">
                        {digest.top_against_args.map((arg) => (
                          <ArgCard key={arg.id} arg={arg} topicId={topicId} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Link
                href={`/topic/${topicId}/arguments`}
                className="mt-3 flex items-center justify-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors py-2"
              >
                View all arguments
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Top contributors */}
            {digest.top_contributors.length > 0 && (
              <div className="rounded-xl border border-surface-700/50 bg-surface-900/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-surface-500" />
                  <span className="text-sm font-medium text-white">Top contributors this week</span>
                </div>
                <div className="space-y-1">
                  {digest.top_contributors.map((c, i) => (
                    <ContributorRow key={c.user_id} contributor={c} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="rounded-xl border border-surface-700/30 bg-surface-900/40 p-4">
              <p className="text-xs text-surface-600 mb-3 font-medium uppercase tracking-wider">
                Explore more
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/topic/${topicId}/vote-trend`, label: 'Consensus Trend', icon: TrendingUp },
                  { href: `/topic/${topicId}/arguments`, label: 'All Arguments', icon: MessageSquare },
                  { href: `/topic/${topicId}/momentum`, label: 'Momentum', icon: Zap },
                  { href: `/topic/${topicId}/leaderboard`, label: 'Leaderboard', icon: Award },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-lg border border-surface-700/40 bg-surface-800/30 p-2.5 text-sm text-surface-300 hover:text-white hover:border-surface-600 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-surface-700 pb-4">
              Generated {relTime(digest.generated_at)} · 7-day window
            </p>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
