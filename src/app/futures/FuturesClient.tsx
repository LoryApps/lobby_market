'use client'

/**
 * /futures — The Civic Futures Board
 *
 * A forward-looking events calendar for the platform. Answers the question:
 * "What's coming up on Lobby Market?"
 *
 *   • Upcoming scheduled debates (next 30 days)
 *   • Topics currently in their voting phase, with countdown to deadline
 *   • High-momentum active topics approaching the voting threshold
 *   • Laws passed in the last 14 days (for resolved context)
 *
 * Distinct from:
 *   /forecast     — pass-probability model for voting-phase topics
 *   /predictions  — user prediction bets (futures contracts)
 *   /triage       — urgency-ranked topics
 *   /surge        — raw vote-velocity ranking
 *   /calendar     — personal engagement calendar
 *   /agenda       — personal unvoted topic list
 *
 * The Futures Board is a PLATFORM-WIDE planning view:
 * what scheduled events and imminent decisions are coming up?
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  Info,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  FuturesResponse,
  FutureDebate,
  FutureVotingTopic,
  FutureActiveTopic,
  RecentLaw,
} from '@/app/api/futures/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days}d`
}

function hoursLabel(hours: number): string {
  if (hours < 1) return 'Closing now'
  if (hours < 24) return `${hours}h left`
  const days = Math.floor(hours / 24)
  return `${days}d left`
}

function urgencyColor(hours: number | null): string {
  if (hours === null) return 'text-surface-500'
  if (hours < 24) return 'text-against-400'
  if (hours < 72) return 'text-gold'
  return 'text-for-400'
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: 'Quick',
  grand: 'Grand',
  oxford: 'Oxford',
  tribunal: 'Tribunal',
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-emerald',
  Science: 'text-for-300',
  Ethics: 'text-purple',
  Philosophy: 'text-purple',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function catColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FuturesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-200 border border-surface-300 rounded-xl p-4 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: FutureDebate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-200 border border-surface-300 rounded-xl p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-bold text-purple bg-purple/10 border border-purple/20 rounded px-1.5 py-0.5">
              {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
            </span>
            {debate.topic_category && (
              <span className={cn('text-xs font-mono', catColor(debate.topic_category))}>
                {debate.topic_category}
              </span>
            )}
          </div>
          <p className="text-sm font-mono text-white font-medium leading-snug mb-1 line-clamp-2">
            {debate.title}
          </p>
          <p className="text-xs text-surface-500 font-mono line-clamp-1 mb-2">
            on: {debate.topic_statement}
          </p>
          <div className="flex items-center gap-3 text-xs text-surface-500 font-mono">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(debate.scheduled_at)}
            </span>
            {debate.creator_username && (
              <span>by @{debate.creator_username}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={cn(
              'text-xs font-mono font-bold px-2 py-1 rounded-lg border',
              debate.days_until === 0
                ? 'text-gold border-gold/30 bg-gold/10'
                : debate.days_until <= 3
                ? 'text-against-300 border-against-500/30 bg-against-500/10'
                : 'text-for-300 border-for-500/30 bg-for-500/10',
            )}
          >
            {daysLabel(debate.days_until)}
          </span>
          <Link
            href={`/debate/${debate.id}`}
            className="text-xs text-surface-500 hover:text-white font-mono flex items-center gap-1 transition-colors"
          >
            View <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Voting topic card ────────────────────────────────────────────────────────

function VotingTopicCard({ topic }: { topic: FutureVotingTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const hasDeadline = topic.voting_ends_at !== null && topic.days_until !== null
  const hoursLeft = topic.voting_ends_at
    ? Math.max(0, Math.round((new Date(topic.voting_ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-200 border border-surface-300 rounded-xl p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="active" size="sm">Voting</Badge>
            {topic.category && (
              <span className={cn('text-xs font-mono', catColor(topic.category))}>
                {topic.category}
              </span>
            )}
          </div>
          <p className="text-sm font-mono text-white font-medium leading-snug line-clamp-2">
            {topic.statement}
          </p>
        </div>
        {hasDeadline && hoursLeft !== null && (
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={cn('text-xs font-mono font-bold', urgencyColor(hoursLeft))}>
              <Timer className="w-3 h-3 inline mr-1" />
              {hoursLabel(hoursLeft)}
            </span>
            {topic.voting_ends_at && (
              <span className="text-[10px] text-surface-600 font-mono">
                {formatShortDate(topic.voting_ends_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Vote bar */}
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden flex">
          <div
            className="h-full bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-against-500 transition-all"
            style={{ width: `${againstPct}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-surface-500 font-mono">
            {topic.total_votes.toLocaleString()} votes
          </span>
          {topic.law_confidence !== null && (
            <span className={cn(
              'text-[10px] font-mono',
              topic.law_confidence >= 60 ? 'text-for-400' : topic.law_confidence <= 40 ? 'text-against-400' : 'text-gold',
            )}>
              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
              {Math.round(topic.law_confidence)}% predicted to pass
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/topic/${topic.id}`}
          className="text-xs text-for-400 hover:text-for-300 font-mono flex items-center gap-1 transition-colors"
        >
          Vote now <ArrowRight className="w-3 h-3" />
        </Link>
        <Link
          href={`/forecast`}
          className="text-[10px] text-surface-500 hover:text-white font-mono transition-colors"
        >
          See forecast
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Active topic card ────────────────────────────────────────────────────────

function ActiveTopicCard({ topic }: { topic: FutureActiveTopic }) {
  const forPct = Math.round(topic.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-200 border border-surface-300 rounded-xl p-3 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {topic.category && (
              <span className={cn('text-[10px] font-mono', catColor(topic.category))}>
                {topic.category}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-white font-medium leading-snug line-clamp-2 mb-1">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-surface-500 font-mono">
            <span>{topic.total_votes.toLocaleString()} votes</span>
            <span className={forPct >= 50 ? 'text-for-400' : 'text-against-400'}>
              {forPct >= 50 ? `${forPct}% For` : `${100 - forPct}% Against`}
            </span>
          </div>
        </div>
        <Link
          href={`/topic/${topic.id}`}
          className="shrink-0 text-xs text-surface-500 hover:text-white font-mono transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Recent law card ──────────────────────────────────────────────────────────

function RecentLawCard({ law }: { law: RecentLaw }) {
  const forPct = Math.round(law.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-2 border-b border-surface-300 last:border-0"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-gold shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white line-clamp-1">{law.statement}</p>
        <div className="flex items-center gap-2 text-[10px] text-surface-500 font-mono">
          {law.category && <span className={catColor(law.category)}>{law.category}</span>}
          <span>{forPct}% For · {law.total_votes.toLocaleString()} votes</span>
          <span>{formatShortDate(law.updated_at)}</span>
        </div>
      </div>
      <Link href={`/topic/${law.id}`} className="shrink-0 text-surface-500 hover:text-gold transition-colors">
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  color,
  subtitle,
}: {
  icon: typeof Calendar
  title: string
  count: number
  color: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', color)} />
        <div>
          <h2 className={cn('text-sm font-mono font-bold', color)}>{title}</h2>
          {subtitle && <p className="text-[10px] text-surface-500 font-mono">{subtitle}</p>}
        </div>
      </div>
      <span className="text-xs text-surface-500 font-mono">{count}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type ActiveTab = 'debates' | 'voting' | 'active' | 'laws'

export function FuturesClient() {
  const [data, setData] = useState<FuturesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('debates')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/futures', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as FuturesResponse
      setData(json)
    } catch {
      setError('Unable to load futures board')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tabs: { id: ActiveTab; label: string; icon: typeof Calendar; color: string; count?: number }[] = [
    { id: 'debates', label: 'Debates', icon: Mic, color: 'text-purple', count: data?.stats.upcoming_debates },
    { id: 'voting', label: 'Voting', icon: Scale, color: 'text-gold', count: data?.stats.topics_in_voting },
    { id: 'active', label: 'Active', icon: Zap, color: 'text-for-400', count: data?.stats.active_topics },
    { id: 'laws', label: 'New Laws', icon: Gavel, color: 'text-gold', count: data?.stats.recent_laws },
  ]

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />

      {/* Hero */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-5 h-5 text-for-400" />
          <h1 className="text-xl font-mono font-bold text-white">Civic Futures</h1>
        </div>
        <p className="text-sm text-surface-500 font-mono">
          What&apos;s coming up — scheduled debates, vote deadlines, and active topics gaining momentum.
        </p>
      </div>

      {/* Stats strip */}
      {data && !loading && (
        <div className="px-4 max-w-2xl mx-auto mb-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-surface-200 border border-purple/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-mono font-bold text-purple">{data.stats.upcoming_debates}</p>
              <p className="text-[9px] text-surface-500 font-mono">Debates</p>
            </div>
            <div className="bg-surface-200 border border-gold/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-mono font-bold text-gold">{data.stats.topics_in_voting}</p>
              <p className="text-[9px] text-surface-500 font-mono">Voting</p>
            </div>
            <div className="bg-surface-200 border border-for-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-mono font-bold text-for-400">{data.stats.active_topics}</p>
              <p className="text-[9px] text-surface-500 font-mono">Active</p>
            </div>
            <div className="bg-surface-200 border border-gold/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-mono font-bold text-gold">{data.stats.recent_laws}</p>
              <p className="text-[9px] text-surface-500 font-mono">New Laws</p>
            </div>
          </div>

          {data.stats.closest_deadline_hours !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'mt-2 px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-2',
                data.stats.closest_deadline_hours < 24
                  ? 'bg-against-500/10 border-against-500/30 text-against-300'
                  : data.stats.closest_deadline_hours < 72
                  ? 'bg-gold/10 border-gold/30 text-gold'
                  : 'bg-for-500/10 border-for-500/30 text-for-300',
              )}
            >
              <Timer className="w-3.5 h-3.5 shrink-0" />
              Next voting deadline closes in{' '}
              <strong>{hoursLabel(data.stats.closest_deadline_hours)}</strong>
              {' '}— vote now.
            </motion.div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="px-4 max-w-2xl mx-auto mb-4">
        <div className="flex gap-1 bg-surface-200 rounded-xl p-1 border border-surface-300">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-surface-300 text-white shadow-sm'
                  : 'text-surface-500 hover:text-white',
              )}
            >
              <tab.icon className={cn('w-3 h-3', activeTab === tab.id ? tab.color : '')} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'text-[9px] rounded-full px-1 min-w-[14px] text-center',
                  activeTab === tab.id ? 'bg-surface-400 text-white' : 'bg-surface-300 text-surface-500',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-2xl mx-auto">
        {loading ? (
          <FuturesSkeleton />
        ) : error ? (
          <EmptyState
            icon={Info}
            title="Couldn't load futures"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        ) : !data ? null : (
          <AnimatePresence mode="wait">
            {/* Upcoming Debates */}
            {activeTab === 'debates' && (
              <motion.div
                key="debates"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <SectionHeader
                  icon={Mic}
                  title="Upcoming Debates"
                  count={data.debates.length}
                  color="text-purple"
                  subtitle="Scheduled in the next 30 days"
                />
                {data.debates.length === 0 ? (
                  <EmptyState
                    icon={Mic}
                    title="No debates scheduled"
                    description="No debates scheduled in the next 30 days. Be the first to organise one."
                    action={{ label: 'Browse debates', href: '/debate' }}
                  />
                ) : (
                  <div className="space-y-3">
                    {data.debates.map((d) => (
                      <DebateCard key={d.id} debate={d} />
                    ))}
                    <Link
                      href="/debate"
                      className="block text-center text-xs text-surface-500 hover:text-white font-mono py-2 transition-colors"
                    >
                      See all debates →
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            {/* Voting Deadlines */}
            {activeTab === 'voting' && (
              <motion.div
                key="voting"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <SectionHeader
                  icon={Scale}
                  title="In Voting Phase"
                  count={data.voting_topics.length}
                  color="text-gold"
                  subtitle="Your vote could still decide these"
                />
                {data.voting_topics.length === 0 ? (
                  <EmptyState
                    icon={Scale}
                    title="No active votes"
                    description="No topics are currently in their voting phase. Check back soon."
                    action={{ label: 'Browse topics', href: '/topics' }}
                  />
                ) : (
                  <div className="space-y-3">
                    {data.voting_topics.map((t) => (
                      <VotingTopicCard key={t.id} topic={t} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Active topics gaining momentum */}
            {activeTab === 'active' && (
              <motion.div
                key="active"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <SectionHeader
                  icon={Zap}
                  title="Active & Gaining Momentum"
                  count={data.active_topics.length}
                  color="text-for-400"
                  subtitle="Most-voted active topics — approaching voting phase"
                />
                {data.active_topics.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No active topics"
                    description="No active topics found. Propose one to start a debate."
                    action={{ label: 'Propose a topic', href: '/topic/create' }}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.active_topics.map((t) => (
                      <ActiveTopicCard key={t.id} topic={t} />
                    ))}
                    <Link
                      href="/topics"
                      className="block text-center text-xs text-surface-500 hover:text-white font-mono py-2 transition-colors"
                    >
                      See all topics →
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent laws */}
            {activeTab === 'laws' && (
              <motion.div
                key="laws"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                <SectionHeader
                  icon={Gavel}
                  title="Laws Passed — Last 14 Days"
                  count={data.recent_laws.length}
                  color="text-gold"
                  subtitle="Topics that recently achieved consensus"
                />
                {data.recent_laws.length === 0 ? (
                  <EmptyState
                    icon={Gavel}
                    title="No recent laws"
                    description="No laws passed in the last 14 days. Keep voting to build consensus."
                    action={{ label: 'Browse laws', href: '/law' }}
                  />
                ) : (
                  <div className="bg-surface-200 border border-surface-300 rounded-xl px-4 py-2">
                    {data.recent_laws.map((l) => (
                      <RecentLawCard key={l.id} law={l} />
                    ))}
                  </div>
                )}
                <Link
                  href="/law"
                  className="block text-center text-xs text-surface-500 hover:text-white font-mono py-3 transition-colors"
                >
                  Browse full Law Codex →
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Refresh + related links */}
        {!loading && data && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={load}
              className="flex items-center justify-center gap-2 py-2 text-xs text-surface-500 hover:text-white font-mono transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh · updated {new Date(data.generated_at).toLocaleTimeString()}
            </button>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Forecast Engine', href: '/forecast', icon: Sparkles, color: 'text-purple' },
                { label: 'Frontlines', href: '/frontlines', icon: Flame, color: 'text-against-400' },
                { label: 'Surge', href: '/surge', icon: TrendingUp, color: 'text-for-400' },
                { label: 'Triage', href: '/triage', icon: Timer, color: 'text-gold' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all"
                >
                  <link.icon className={cn('w-3 h-3', link.color)} />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
