'use client'

/**
 * /queue — The Civic Action Queue
 *
 * A personalised, prioritised task board for civic engagement.
 * Answers: "What should I do right now on Lobby Market?"
 *
 * Action types (in priority order):
 *   1. vote_urgent    — topics in final voting phase, user hasn't voted
 *   2. debate_rsvp    — scheduled debates starting within 48h
 *   3. daily_goal     — daily vote quota progress
 *   4. vote_recommended — active topics matching preferences, not yet voted
 *   5. argue          — topics voted on but no argument written
 *   6. predict        — active topics without a prediction
 *   7. complete_profile — missing avatar / bio / display name
 *
 * Distinct from:
 *   /dashboard        — stats overview, not task-oriented
 *   /recommended      — topic list only
 *   /watchlist        — saved topics, not actionable tasks
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Flame,
  Gavel,
  ListChecks,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { QueueAction, QueueResponse, ActionType } from '@/app/api/queue/route'

// ─── Action type config ───────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  ActionType,
  {
    icon: typeof Flame
    iconColor: string
    iconBg: string
    iconBorder: string
    badge: string
    badgeVariant: 'proposed' | 'active' | 'law' | 'failed' | 'neutral'
    cta: string
  }
> = {
  vote_urgent: {
    icon: Gavel,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
    iconBorder: 'border-against-500/30',
    badge: 'Urgent',
    badgeVariant: 'failed',
    cta: 'Vote now',
  },
  vote_recommended: {
    icon: ThumbsUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    badge: 'Vote',
    badgeVariant: 'active',
    cta: 'Cast vote',
  },
  argue: {
    icon: MessageSquare,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    badge: 'Argue',
    badgeVariant: 'neutral',
    cta: 'Write argument',
  },
  debate_rsvp: {
    icon: Mic,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
    badge: 'Debate',
    badgeVariant: 'active',
    cta: 'RSVP',
  },
  predict: {
    icon: Target,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    badge: 'Predict',
    badgeVariant: 'proposed',
    cta: 'Predict',
  },
  complete_profile: {
    icon: User,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-200',
    iconBorder: 'border-surface-300',
    badge: 'Profile',
    badgeVariant: 'neutral',
    cta: 'Complete',
  },
  daily_goal: {
    icon: Flame,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    badge: 'Daily',
    badgeVariant: 'neutral',
    cta: 'Vote now',
  },
  join_coalition: {
    icon: Zap,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    badge: 'Coalition',
    badgeVariant: 'neutral',
    cta: 'Explore',
  },
}

// ─── Category colour ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function catColor(c: string | null | undefined): string {
  return c ? (CAT_COLOR[c] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Vote bar mini ────────────────────────────────────────────────────────────

function VoteBarMini({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className="text-for-400 tabular-nums">{forPct}%</span>
      <div className="flex-1 h-1.5 bg-surface-300/50 rounded-full overflow-hidden min-w-[60px]">
        <div
          className="h-full bg-for-500 rounded-full"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-against-400 tabular-nums">{againstPct}%</span>
    </div>
  )
}

// ─── Daily goal mini-bar ──────────────────────────────────────────────────────

function DailyGoalBar({
  used,
  limit,
}: {
  used: number
  limit: number
}) {
  const pct = Math.min((used / limit) * 100, 100)
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div className="flex-1 h-2 bg-surface-300/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-surface-400 tabular-nums whitespace-nowrap">
        {used} / {limit}
      </span>
    </div>
  )
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({
  action,
  index,
  onDismiss,
}: {
  action: QueueAction
  index: number
  onDismiss: (id: string) => void
}) {
  const cfg = ACTION_CONFIG[action.type]
  const Icon = cfg.icon
  const meta = action.meta

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-5 transition-colors',
        'bg-surface-100 border-surface-300',
        action.type === 'vote_urgent' && 'border-against-500/30 bg-against-500/5',
        action.type === 'daily_goal' && 'border-gold/20 bg-gold/5',
        action.type === 'debate_rsvp' && 'border-emerald/20 bg-emerald/5',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
            cfg.iconBg,
            cfg.iconBorder
          )}
        >
          <Icon className={cn('h-4 w-4', cfg.iconColor)} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-mono font-semibold text-white leading-tight">
              {action.title}
            </p>
            <Badge variant={cfg.badgeVariant} className="text-[10px] py-0 px-1.5">
              {cfg.badge}
            </Badge>
          </div>
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            {action.description}
          </p>

          {/* Topic snippet */}
          {meta?.topic_statement && (
            <div className="mt-2 rounded-lg bg-surface-200/60 border border-surface-300/50 px-3 py-2">
              <p
                className={cn(
                  'text-[10px] font-mono font-semibold uppercase tracking-wider mb-1',
                  catColor(meta.topic_category)
                )}
              >
                {meta.topic_category ?? 'Topic'}
              </p>
              <p className="text-xs font-mono text-surface-300 line-clamp-2 leading-snug">
                {meta.topic_statement}
              </p>
              {meta.blue_pct !== undefined && (
                <div className="mt-1.5">
                  <VoteBarMini bluePct={meta.blue_pct} />
                </div>
              )}
            </div>
          )}

          {/* Debate snippet */}
          {action.type === 'debate_rsvp' && meta?.debate_title && (
            <div className="mt-2 rounded-lg bg-surface-200/60 border border-surface-300/50 px-3 py-2">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald mb-1">
                Debate
              </p>
              <p className="text-xs font-mono text-surface-300 line-clamp-1">{meta.debate_title}</p>
            </div>
          )}

          {/* Daily goal bar */}
          {action.type === 'daily_goal' && meta?.votes_used !== undefined && meta.daily_limit !== undefined && (
            <div className="mt-2">
              <DailyGoalBar used={meta.votes_used} limit={meta.daily_limit} />
            </div>
          )}

          {/* Profile completion */}
          {action.type === 'complete_profile' && meta?.completion_pct !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-300/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-surface-400 rounded-full transition-all"
                  style={{ width: `${meta.completion_pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500 tabular-nums">
                {meta.completion_pct}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-300/50">
        <button
          onClick={() => onDismiss(action.id)}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3" />
          Dismiss
        </button>

        <Link
          href={action.href}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
            action.type === 'vote_urgent'
              ? 'bg-against-600 hover:bg-against-500 text-white'
              : action.type === 'daily_goal' || action.type === 'vote_recommended'
              ? 'bg-for-600 hover:bg-for-500 text-white'
              : action.type === 'debate_rsvp'
              ? 'bg-emerald/20 hover:bg-emerald/30 text-emerald border border-emerald/30'
              : action.type === 'argue'
              ? 'bg-purple/20 hover:bg-purple/30 text-purple border border-purple/30'
              : action.type === 'predict'
              ? 'bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30'
              : 'bg-surface-200 hover:bg-surface-300 text-surface-300 border border-surface-300'
          )}
        >
          {cfg.cta}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function QueueSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QueueClient() {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/queue')
      if (res.ok) {
        const json = (await res.json()) as QueueResponse
        setData(json)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
  }, [])

  const visibleActions = (data?.actions ?? []).filter((a) => !dismissed.has(a.id))
  const completedCount = dismissed.size
  const totalCount = (data?.actions ?? []).length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
            <ListChecks className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Action Queue</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {loading
                ? 'Loading your civic tasks…'
                : data?.total_urgent && data.total_urgent > 0
                ? `${data.total_urgent} urgent action${data.total_urgent !== 1 ? 's' : ''} · vote window closing`
                : visibleActions.length > 0
                ? `${visibleActions.length} task${visibleActions.length !== 1 ? 's' : ''} waiting`
                : 'You\'re all caught up'}
            </p>
          </div>
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Progress bar */}
      {!loading && totalCount > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500 mb-1.5">
            <span>Session progress</span>
            <span className="tabular-nums">{completedCount} / {totalCount} dismissed</span>
          </div>
          <div className="h-1.5 w-full bg-surface-300/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald rounded-full"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Daily vote progress summary */}
      {!loading && data && (
        <div className="flex items-center gap-3 mb-5 rounded-xl bg-surface-100 border border-surface-300/50 px-4 py-3">
          <Flame className={cn('h-4 w-4 flex-shrink-0', data.daily_votes_used >= data.daily_limit ? 'text-emerald' : 'text-gold')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-surface-400">Today&apos;s votes</span>
              <span className={cn(
                'text-xs font-mono font-bold tabular-nums',
                data.daily_votes_used >= data.daily_limit ? 'text-emerald' : 'text-gold'
              )}>
                {data.daily_votes_used} / {data.daily_limit}
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-300/50 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  data.daily_votes_used >= data.daily_limit
                    ? 'bg-emerald'
                    : 'bg-gradient-to-r from-for-700 to-for-400'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((data.daily_votes_used / data.daily_limit) * 100, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
          {data.daily_votes_used >= data.daily_limit && (
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <QueueSkeleton />
      ) : visibleActions.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          iconColor="text-emerald"
          iconBg="bg-emerald/10"
          iconBorder="border-emerald/20"
          title="Queue clear"
          description={
            completedCount > 0
              ? `You've dismissed all ${completedCount} tasks. Come back later for fresh actions.`
              : 'No pending actions right now. You\'re ahead of the civic game.'
          }
          actions={[
            { label: 'Browse topics', href: '/' },
            { label: 'Your analytics', href: '/analytics', variant: 'secondary' },
          ]}
          size="lg"
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {visibleActions.map((action, i) => (
              <ActionCard
                key={action.id}
                action={action}
                index={i}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Footer links */}
      {!loading && (
        <div className="mt-8 pt-5 border-t border-surface-300/50">
          <p className="text-xs font-mono text-surface-600 mb-3 uppercase tracking-wider">
            Explore more
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/swipe', label: 'Swipe & Vote', icon: ThumbsDown },
              { href: '/debate', label: 'Live Debates', icon: Mic },
              { href: '/recommended', label: 'Recommended', icon: Sparkles },
              { href: '/analytics', label: 'My Analytics', icon: Scale },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {label}
                <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-50" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
