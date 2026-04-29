'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Info,
  ListChecks,
  LogIn,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { VoteBar } from '@/components/voting/VoteBar'
import { cn } from '@/lib/utils/cn'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import type {
  AgendaResponse,
  AgendaTopic,
  CoalitionAction,
  SubscribedUpdate,
  UpcomingDebate,
} from '@/app/api/agenda/route'

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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.round(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  return `in ${d}d`
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Zap; color: string; bg: string; border: string }
> = {
  proposed: {
    label: 'Proposed',
    icon: Info,
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  },
  active: {
    label: 'Active',
    icon: Zap,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  voting: {
    label: 'Voting',
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  law: {
    label: 'Law',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  failed: {
    label: 'Failed',
    icon: Info,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/20',
  },
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.proposed
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
        cfg.color,
        cfg.bg,
        cfg.border,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AgendaSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3"
        >
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  iconColor,
}: {
  icon: typeof ListChecks
  title: string
  count: number
  iconColor: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-4 w-4 flex-shrink-0', iconColor)} />
      <h2 className="font-mono text-sm font-bold text-white">{title}</h2>
      {count > 0 && (
        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-surface-300 px-1.5 text-[10px] font-mono font-bold text-surface-600">
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Unvoted topic card ────────────────────────────────────────────────────────

function UnvotedTopicCard({ topic }: { topic: AgendaTopic }) {
  const signal = getTopicSignal(topic)
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-400'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block bg-surface-100 border border-surface-300 rounded-2xl p-4',
        'hover:border-surface-400 hover:bg-surface-200/60 transition-colors',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor)}>
              {topic.category}
            </span>
          )}
          <StatusPill status={topic.status} />
          {signal && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                SIGNAL_PILL_CLASSES[signal.color].pill,
              )}
            >
              {signal.label}
            </span>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2">
        {topic.statement}
      </p>

      <VoteBar bluePct={topic.blue_pct} totalVotes={topic.total_votes} showLabels />

      <div className="flex items-center gap-3 mt-2.5 text-[10px] font-mono text-surface-500">
        <span>{topic.total_votes.toLocaleString()} votes</span>
        {topic.voting_ends_at && (
          <span className="text-against-400">
            ends {timeUntil(topic.voting_ends_at)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-for-400 font-semibold">
          <ThumbsUp className="h-3 w-3" />
          Vote now
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}

// ─── Subscribed update card ────────────────────────────────────────────────────

function SubscribedUpdateCard({ update }: { update: SubscribedUpdate }) {
  const catColor = CATEGORY_COLORS[update.category ?? ''] ?? 'text-surface-400'
  return (
    <Link
      href={`/topic/${update.topic_id}`}
      className={cn(
        'flex items-start gap-3 bg-surface-100 border border-surface-300 rounded-2xl p-4',
        'hover:border-surface-400 hover:bg-surface-200/60 transition-colors',
      )}
    >
      <div className="flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-for-500/10 border border-for-500/20">
        <Bell className="h-4 w-4 text-for-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {update.category && (
            <span className={cn('text-[10px] font-mono font-semibold uppercase', catColor)}>
              {update.category}
            </span>
          )}
          <StatusPill status={update.status} />
        </div>
        <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-1">
          {update.statement}
        </p>
        <p className="text-[10px] font-mono text-surface-500">
          {update.updated_at ? `Updated ${relativeTime(update.updated_at)}` : `Subscribed ${relativeTime(update.subscribed_at)}`}
          {' · '}
          {update.total_votes.toLocaleString()} votes
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Upcoming debate card ──────────────────────────────────────────────────────

function UpcomingDebateCard({ debate }: { debate: UpcomingDebate }) {
  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'flex items-start gap-3 bg-surface-100 border border-surface-300 rounded-2xl p-4',
        'hover:border-for-500/40 hover:bg-surface-200/60 transition-colors',
      )}
    >
      <div className="flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-purple/10 border border-purple/20">
        <Mic className="h-4 w-4 text-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-semibold text-purple uppercase tracking-wider">
            {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
          </span>
          <span className="text-[10px] font-mono text-emerald font-semibold">
            {timeUntil(debate.scheduled_at)}
          </span>
        </div>
        <p className="text-sm font-mono text-white leading-snug line-clamp-1 font-semibold mb-0.5">
          {debate.title}
        </p>
        <p className="text-[11px] font-mono text-surface-500 line-clamp-1">
          {debate.topic_statement}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {debate.rsvp_count} RSVPs
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {new Date(debate.scheduled_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Coalition action card ─────────────────────────────────────────────────────

function CoalitionActionCard({ action }: { action: CoalitionAction }) {
  const catColor = CATEGORY_COLORS[action.category ?? ''] ?? 'text-surface-400'
  const isFor = action.coalition_stance === 'for'
  return (
    <Link
      href={`/topic/${action.topic_id}`}
      className={cn(
        'flex items-start gap-3 bg-surface-100 border rounded-2xl p-4 transition-colors',
        isFor
          ? 'border-for-500/30 hover:border-for-500/50'
          : 'border-against-500/30 hover:border-against-500/50',
        'hover:bg-surface-200/60',
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border',
          isFor
            ? 'bg-for-500/10 border-for-500/20'
            : 'bg-against-500/10 border-against-500/20',
        )}
      >
        <Shield
          className={cn('h-4 w-4', isFor ? 'text-for-400' : 'text-against-400')}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {action.category && (
            <span className={cn('text-[10px] font-mono font-semibold uppercase', catColor)}>
              {action.category}
            </span>
          )}
          <StatusPill status={action.status} />
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-mono font-semibold',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {action.coalition_name} is {isFor ? 'For' : 'Against'}
          </span>
        </div>
        <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-1">
          {action.statement}
        </p>
        <p className="text-[10px] font-mono text-surface-500">
          {action.total_votes.toLocaleString()} votes cast
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Guest CTA ─────────────────────────────────────────────────────────────────

function GuestCTA() {
  return (
    <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-5 text-center">
      <div className="flex justify-center mb-3">
        <div className="h-12 w-12 rounded-full bg-for-500/10 border border-for-500/20 flex items-center justify-center">
          <LogIn className="h-6 w-6 text-for-400" />
        </div>
      </div>
      <h3 className="font-mono font-bold text-white text-sm mb-1">
        Sign in to see your personal agenda
      </h3>
      <p className="text-xs font-mono text-surface-500 mb-4 max-w-xs mx-auto">
        Your agenda tracks unvoted topics, subscribed debates, coalition
        stances, and upcoming events — all personalized to your interests.
      </p>
      <div className="flex justify-center gap-3">
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-semibold transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/login?mode=signup"
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-white text-sm font-mono font-semibold transition-colors"
        >
          Create account
        </Link>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const [data, setData] = useState<AgendaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/agenda')
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as AgendaResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalActions = data
    ? data.unvoted_topics.length +
      data.subscribed_updates.length +
      data.upcoming_debates.length +
      data.coalition_actions.length
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/20">
                <ListChecks className="h-4.5 w-4.5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white leading-none">
                  Civic Agenda
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  {loading
                    ? 'Loading your actions…'
                    : data?.is_authenticated
                    ? totalActions > 0
                      ? `${totalActions} action${totalActions !== 1 ? 's' : ''} waiting`
                      : 'All caught up'
                    : 'Sign in to personalise'}
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh agenda"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Loading ───────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div>
              <Skeleton className="h-4 w-40 rounded mb-3" />
              <AgendaSkeleton />
            </div>
            <div>
              <Skeleton className="h-4 w-32 rounded mb-3" />
              <AgendaSkeleton />
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Info}
            title="Couldn't load your agenda"
            description="Something went wrong fetching your actions."
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {/* ── Content ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {!loading && !error && data && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* ── Guest prompt ─────────────────────────────────── */}
              {!data.is_authenticated && (
                <>
                  <GuestCTA />

                  {/* Teaser: show a few topics anyway */}
                  {data.unvoted_topics.length > 0 && (
                    <div>
                      <SectionHeader
                        icon={Zap}
                        title="Active right now"
                        count={data.unvoted_topics.length}
                        iconColor="text-for-400"
                      />
                      <div className="space-y-3">
                        {data.unvoted_topics.map((t) => (
                          <UnvotedTopicCard key={t.id} topic={t} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Authenticated sections ────────────────────────── */}
              {data.is_authenticated && (
                <>
                  {/* All caught up */}
                  {totalActions === 0 && (
                    <div className="text-center py-12">
                      <div className="flex justify-center mb-4">
                        <div className="h-16 w-16 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald" />
                        </div>
                      </div>
                      <h2 className="font-mono font-bold text-white text-lg mb-2">
                        All caught up!
                      </h2>
                      <p className="text-sm font-mono text-surface-500 mb-6 max-w-xs mx-auto">
                        No unvoted topics in your preferred categories, no
                        upcoming debates, and no coalition actions pending.
                      </p>
                      <div className="flex justify-center gap-3 flex-wrap">
                        <Link
                          href="/"
                          className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-mono transition-colors"
                        >
                          Browse all topics
                        </Link>
                        <Link
                          href="/discover"
                          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-white text-sm font-mono transition-colors"
                        >
                          Discover
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Unvoted topics */}
                  {data.unvoted_topics.length > 0 && (
                    <section>
                      <SectionHeader
                        icon={Zap}
                        title="Topics to vote on"
                        count={data.unvoted_topics.length}
                        iconColor="text-for-400"
                      />
                      <div className="space-y-3">
                        {data.unvoted_topics.map((t) => (
                          <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <UnvotedTopicCard topic={t} />
                          </motion.div>
                        ))}
                      </div>
                      {data.unvoted_topics.length >= 20 && (
                        <Link
                          href="/"
                          className="flex items-center justify-center gap-1 mt-3 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                        >
                          See all topics
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </section>
                  )}

                  {/* Coalition actions */}
                  {data.coalition_actions.length > 0 && (
                    <section>
                      <SectionHeader
                        icon={Shield}
                        title="Coalition stance alerts"
                        count={data.coalition_actions.length}
                        iconColor="text-purple"
                      />
                      <div className="space-y-3">
                        {data.coalition_actions.map((a) => (
                          <motion.div
                            key={`${a.coalition_id}-${a.topic_id}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <CoalitionActionCard action={a} />
                          </motion.div>
                        ))}
                      </div>
                      <Link
                        href="/coalitions"
                        className="flex items-center justify-center gap-1 mt-3 text-xs font-mono text-surface-500 hover:text-purple transition-colors"
                      >
                        View your coalitions
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </section>
                  )}

                  {/* Upcoming debates */}
                  {data.upcoming_debates.length > 0 && (
                    <section>
                      <SectionHeader
                        icon={Mic}
                        title="Debates you're attending"
                        count={data.upcoming_debates.length}
                        iconColor="text-purple"
                      />
                      <div className="space-y-3">
                        {data.upcoming_debates.map((d) => (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <UpcomingDebateCard debate={d} />
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Subscribed updates */}
                  {data.subscribed_updates.length > 0 && (
                    <section>
                      <SectionHeader
                        icon={Bell}
                        title="Subscribed topics"
                        count={data.subscribed_updates.length}
                        iconColor="text-for-400"
                      />
                      <div className="space-y-3">
                        {data.subscribed_updates.map((u) => (
                          <motion.div
                            key={u.topic_id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <SubscribedUpdateCard update={u} />
                          </motion.div>
                        ))}
                      </div>
                      <Link
                        href="/watchlist"
                        className="flex items-center justify-center gap-1 mt-3 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                      >
                        Manage watchlist
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </section>
                  )}

                  {/* Preferences setup CTA if no preferred categories */}
                  {data.preferred_categories.length === 0 && totalActions > 0 && (
                    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-start gap-3">
                      <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-surface-500 leading-relaxed">
                          Set your preferred categories in{' '}
                          <Link
                            href="/settings"
                            className="text-for-400 hover:underline"
                          >
                            Settings
                          </Link>{' '}
                          or retake the{' '}
                          <Link
                            href="/onboarding"
                            className="text-for-400 hover:underline"
                          >
                            onboarding quiz
                          </Link>{' '}
                          to prioritize topics that matter to you.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
