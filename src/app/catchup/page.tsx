'use client'

/**
 * /catchup — "What happened while you were away"
 *
 * Reads `lm_last_visit` from localStorage to determine how long the user
 * was away, then fetches and displays a personalized summary of:
 *   - New laws passed
 *   - Voted topics that changed status
 *   - Hot new arguments on debates you care about
 *   - Upcoming debates in the next 48 hours
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  Gavel,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CatchupData, CatchupLaw, CatchupTopicUpdate, CatchupArgument, CatchupDebate } from '@/app/api/me/catchup/route'

// ─── localStorage key ─────────────────────────────────────────────────────────

const LAST_VISIT_KEY = 'lm_last_visit_v1'

function getLastVisit(): Date {
  try {
    const stored = localStorage.getItem(LAST_VISIT_KEY)
    if (stored) return new Date(stored)
  } catch {
    // SSR / storage unavailable
  }
  return new Date(Date.now() - 24 * 60 * 60 * 1000)
}

function saveLastVisit() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
  } catch {
    // best-effort
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function futureRelTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Starting now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}

function formatAwayTime(hours: number): string {
  if (hours < 1) return 'a few minutes'
  if (hours === 1) return '1 hour'
  if (hours < 24) return `${hours} hours`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day'
  return `${days} days`
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/25' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/25' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/25' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/25' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/25' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/25' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/25' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/25' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/25' },
  Education:   { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/25' },
}

function catStyle(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: 'Quick (15m)',
  grand: 'Grand (45m)',
  tribunal: 'Tribunal (60m)',
}

// ─── Section heading ─────────────────────────────────────────────────────────���

function SectionHeading({
  icon: Icon,
  title,
  count,
  iconClass,
  bgClass,
}: {
  icon: typeof Gavel
  title: string
  count: number
  iconClass: string
  bgClass: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', bgClass)}>
        <Icon className={cn('h-4 w-4', iconClass)} />
      </div>
      <div className="flex items-baseline gap-2">
        <h2 className="font-mono text-base font-semibold text-white">{title}</h2>
        <span className="text-xs font-mono text-surface-500">{count}</span>
      </div>
    </div>
  )
}

// ─── New law card ─────────────────────────────────────────────────────────────

function LawCard({ law, idx }: { law: CatchupLaw; idx: number }) {
  const forPct = Math.round(law.blue_pct)
  const cs = catStyle(law.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Link
        href={`/topic/${law.topic_id}`}
        className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-emerald/20 hover:border-emerald/40 hover:bg-surface-200 transition-colors group"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/25 flex-shrink-0 mt-0.5">
          <Gavel className="h-4 w-4 text-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {law.category && (
              <span className={cn('text-[11px] font-mono', cs.text)}>{law.category}</span>
            )}
            <span className="text-[11px] font-mono text-for-400">{forPct}% FOR</span>
            <span className="text-[11px] font-mono text-surface-500">{law.total_votes.toLocaleString()} votes</span>
            <span className="text-[11px] font-mono text-surface-600">{relativeTime(law.established_at)}</span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-emerald flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Topic update card ────────────────────────────────────────────────────────

function TopicUpdateCard({ update, idx }: { update: CatchupTopicUpdate; idx: number }) {
  const forPct = Math.round(update.blue_pct)
  const isLaw = update.new_status === 'law'
  const isFailed = update.new_status === 'failed'
  const isVoting = update.new_status === 'voting'
  const userVotedFor = update.user_side === 'blue'

  const borderClass = isLaw
    ? 'border-emerald/25 hover:border-emerald/50'
    : isFailed
    ? 'border-against-500/20 hover:border-against-500/40'
    : 'border-surface-300 hover:border-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Link
        href={`/topic/${update.topic_id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl bg-surface-100 border transition-colors group',
          borderClass
        )}
      >
        <div className="flex-shrink-0 mt-0.5">
          {update.user_won ? (
            <CheckCircle2 className="h-5 w-5 text-emerald" />
          ) : isFailed ? (
            <XCircle className="h-5 w-5 text-against-400" />
          ) : isVoting ? (
            <Zap className="h-5 w-5 text-purple" />
          ) : (
            <TrendingUp className="h-5 w-5 text-for-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-surface-200 transition-colors">
            {update.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant={STATUS_BADGE[update.new_status] ?? 'proposed'}>
              {STATUS_LABEL[update.new_status] ?? update.new_status}
            </Badge>
            <span
              className={cn(
                'text-[11px] font-mono',
                userVotedFor ? 'text-for-400' : 'text-against-400'
              )}
            >
              You voted {userVotedFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              {forPct}% · {update.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, idx }: { arg: CatchupArgument; idx: number }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Link
        href={`/topic/${arg.topic_id}`}
        className={cn(
          'block p-4 rounded-xl bg-surface-100 border transition-colors group',
          isFor
            ? 'border-for-500/15 hover:border-for-500/35'
            : 'border-against-500/15 hover:border-against-500/35'
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name ?? arg.author_username}
            size="sm"
            className="flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-surface-400">
                @{arg.author_username}
              </span>
              <span
                className={cn(
                  'text-[10px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                  isFor
                    ? 'text-for-400 bg-for-500/10'
                    : 'text-against-400 bg-against-500/10'
                )}
              >
                {isFor ? 'FOR' : 'AGAINST'}
              </span>
              <span className="text-[11px] font-mono text-surface-600 ml-auto">
                {relativeTime(arg.created_at)}
              </span>
            </div>
            <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-surface-200 transition-colors">
              {arg.content}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                {isFor ? (
                  <ThumbsUp className="h-3 w-3 text-for-400" />
                ) : (
                  <ThumbsDown className="h-3 w-3 text-against-400" />
                )}
                <span>{arg.upvotes}</span>
              </div>
              <p className="text-[11px] font-mono text-surface-600 line-clamp-1">
                on: {arg.topic_statement}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate, idx }: { debate: CatchupDebate; idx: number }) {
  const cs = catStyle(debate.category)
  const isLive = debate.status === 'live'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl bg-surface-100 border transition-colors group',
          isLive
            ? 'border-against-500/30 hover:border-against-500/50'
            : 'border-purple/20 hover:border-purple/40'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 mt-0.5',
            isLive ? 'bg-against-500/10 border border-against-500/25' : 'bg-purple/10 border border-purple/25'
          )}
        >
          {isLive ? (
            <Zap className="h-4 w-4 text-against-400" />
          ) : (
            <Calendar className="h-4 w-4 text-purple" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-surface-200 transition-colors">
            {debate.topic_statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {isLive ? (
              <span className="text-[11px] font-mono text-against-400 font-semibold">LIVE NOW</span>
            ) : (
              <span className="text-[11px] font-mono text-purple">
                <Timer className="h-3 w-3 inline mr-0.5" />
                {futureRelTime(debate.scheduled_at)}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-500">
              {DEBATE_TYPE_LABEL[debate.debate_type] ?? debate.debate_type}
            </span>
            {debate.category && (
              <span className={cn('text-[11px] font-mono', cs.text)}>{debate.category}</span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CatchupSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((section) => (
        <div key={section}>
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CatchupPage() {
  const [data, setData] = useState<CatchupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [since, setSince] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)

    const lastVisit = getLastVisit()
    setSince(lastVisit)

    try {
      const res = await fetch(
        `/api/me/catchup?since=${encodeURIComponent(lastVisit.toISOString())}`
      )
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as CatchupData
      setData(json)
      // Mark this visit
      saveLastVisit()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalItems = data
    ? data.newLaws.length +
      data.topicUpdates.length +
      data.hotArguments.length +
      data.upcomingDebates.length
    : 0

  const awayLabel = since ? formatAwayTime(data?.hoursAway ?? 0) : 'a while'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/25 flex-shrink-0">
                <Award className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Catch Up
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {loading
                    ? 'Loading your briefing…'
                    : data
                    ? totalItems > 0
                      ? `${totalItems} update${totalItems !== 1 ? 's' : ''} while you were away for ${awayLabel}`
                      : `Nothing new in the last ${awayLabel}`
                    : 'What happened while you were away'}
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Refresh catch-up"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Time pill */}
          {since && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300"
            >
              <Timer className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono text-surface-400">
                Since {since.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </motion.div>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {loading ? (
          <CatchupSkeleton />
        ) : error ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load your briefing"
            description="Something went wrong. Try refreshing."
            actions={[{ label: 'Try again', onClick: load }]}
          />
        ) : !data || totalItems === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 space-y-4"
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-100 border border-surface-300 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-semibold text-white mb-1">
                All caught up
              </h2>
              <p className="text-sm font-mono text-surface-500 max-w-xs mx-auto">
                Nothing new since you last visited. Check back later or explore the feed.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              Back to Feed
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              {/* ── New laws ─────────────────────────────────────── */}
              {data.newLaws.length > 0 && (
                <section>
                  <SectionHeading
                    icon={Gavel}
                    title="New Laws Passed"
                    count={data.newLaws.length}
                    iconClass="text-emerald"
                    bgClass="bg-emerald/10 border-emerald/25"
                  />
                  <div className="space-y-2">
                    {data.newLaws.map((law, i) => (
                      <LawCard key={law.id} law={law} idx={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Your topics updated ─────────────────���─────────── */}
              {data.topicUpdates.length > 0 && (
                <section>
                  <SectionHeading
                    icon={Zap}
                    title="Your Topics Updated"
                    count={data.topicUpdates.length}
                    iconClass="text-for-400"
                    bgClass="bg-for-500/10 border-for-500/25"
                  />
                  <div className="space-y-2">
                    {data.topicUpdates.map((update, i) => (
                      <TopicUpdateCard key={update.topic_id} update={update} idx={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Hot new arguments ─────────────────────────────── */}
              {data.hotArguments.length > 0 && (
                <section>
                  <SectionHeading
                    icon={MessageSquare}
                    title={
                      data.isAuthenticated
                        ? 'New Arguments on Your Debates'
                        : 'Trending Arguments'
                    }
                    count={data.hotArguments.length}
                    iconClass="text-purple"
                    bgClass="bg-purple/10 border-purple/25"
                  />
                  <div className="space-y-2">
                    {data.hotArguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} idx={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Upcoming debates ──────────────────────────────── */}
              {data.upcomingDebates.length > 0 && (
                <section>
                  <SectionHeading
                    icon={Calendar}
                    title="Upcoming Debates"
                    count={data.upcomingDebates.length}
                    iconClass="text-against-400"
                    bgClass="bg-against-500/10 border-against-500/25"
                  />
                  <div className="space-y-2">
                    {data.upcomingDebates.map((debate, i) => (
                      <DebateCard key={debate.id} debate={debate} idx={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Not authenticated nudge ───────────────────────── */}
              {!data.isAuthenticated && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-for-600/10 border border-for-500/25 p-5 text-center"
                >
                  <p className="font-mono text-sm text-for-300 mb-3">
                    Sign in for a personalized catch-up based on your votes and debates
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
                  >
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Footer links ─────────────────────────────────────────── */}
        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 pt-6 border-t border-surface-300 flex flex-wrap gap-3 justify-center"
          >
            <Link
              href="/"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Full Feed
            </Link>
            <Link
              href="/trending"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Zap className="h-3.5 w-3.5" />
              Trending
            </Link>
            <Link
              href="/law"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Gavel className="h-3.5 w-3.5" />
              All Laws
            </Link>
            <Link
              href="/debate"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Debates
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
