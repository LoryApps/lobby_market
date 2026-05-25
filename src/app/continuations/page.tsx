'use client'

/**
 * /continuations — The Civic Continuations Hub
 *
 * A platform-wide discovery page for the "...but/and" continuation system.
 * When a topic reaches consensus or completes its voting phase, the community
 * can propose and vote on what the debate should continue as.
 *
 * Three sections:
 *   Authoring Now  — topics open for continuation proposals (boost to elevate)
 *   Voting Now     — finalist continuations in community vote (one wins)
 *   Recent Winners — continuations that became the next link in a chain
 *
 * Distinct from:
 *   /chains   — topic chain browser (the full chain history)
 *   /topics   — general topic feed
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  RefreshCw,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ContinuationsHubResponse,
  HubContinuation,
  HubTopicGroup,
} from '@/app/api/continuations/hub/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'closed'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-center', color)}>
      <div className="text-xl font-mono font-bold text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mt-0.5">
        {label}
      </div>
    </div>
  )
}

// ─── Continuation Card ────────────────────────────────────────────────────────

interface ContCardProps {
  cont: HubContinuation
  topicStatement: string
  phase: 'authoring' | 'voting'
  onBoost?: (id: string) => void
  boostedIds?: Set<string>
  isVoting?: boolean
  userVote?: string | null
  onVote?: (id: string) => void
}

function ContCard({
  cont,
  topicStatement,
  phase,
  onBoost,
  boostedIds,
  userVote,
  onVote,
}: ContCardProps) {
  const hasBoosted = boostedIds?.has(cont.id) ?? false
  const hasVoted = userVote != null
  const isMyVote = userVote === cont.id
  const isFinalist = cont.status === 'finalist' || cont.status === 'winner'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-3.5 transition-colors',
        isMyVote
          ? 'border-emerald/40 bg-emerald/5'
          : 'border-surface-300 bg-surface-100',
      )}
    >
      {/* Continuation text */}
      <p className="text-sm font-mono leading-relaxed mb-2.5">
        <span className="text-surface-500 text-[11px] uppercase tracking-widest mr-1">
          {topicStatement.length > 60
            ? topicStatement.slice(0, 58) + '…'
            : topicStatement}
        </span>
        <br />
        <span
          className={cn(
            'font-semibold mr-1',
            cont.connector === 'but' ? 'text-against-400' : 'text-for-400',
          )}
        >
          ...{cont.connector}
        </span>
        <span className="text-white">{cont.text}</span>
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-300">
        <div className="flex items-center gap-3">
          {cont.author && (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={cont.author.avatar_url}
                username={cont.author.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500">
                {cont.author.display_name ?? cont.author.username}
              </span>
            </div>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {relTime(cont.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'authoring' && (
            <>
              <span className="text-xs font-mono text-surface-500 tabular-nums">
                {cont.boost_count} boost{cont.boost_count !== 1 ? 's' : ''}
              </span>
              {onBoost && (
                <button
                  onClick={() => onBoost(cont.id)}
                  disabled={hasBoosted}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    hasBoosted
                      ? 'bg-emerald/15 text-emerald cursor-default'
                      : 'bg-gold/15 text-gold hover:bg-gold/25 cursor-pointer',
                  )}
                >
                  <ThumbsUp className="h-3 w-3" />
                  {hasBoosted ? 'Boosted' : 'Boost'}
                </button>
              )}
            </>
          )}

          {phase === 'voting' && isFinalist && (
            <>
              <span className="text-xs font-mono text-surface-500 tabular-nums">
                {cont.vote_count} vote{cont.vote_count !== 1 ? 's' : ''}
              </span>
              {onVote && (
                <button
                  onClick={() => !hasVoted && onVote(cont.id)}
                  disabled={hasVoted}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    isMyVote
                      ? 'bg-emerald/15 text-emerald cursor-default'
                      : hasVoted
                        ? 'bg-surface-200 text-surface-500 cursor-default'
                        : 'bg-for-600/20 text-for-400 hover:bg-for-600/30 cursor-pointer',
                  )}
                >
                  <Vote className="h-3 w-3" />
                  {isMyVote ? 'Voted' : hasVoted ? 'Voted' : 'Vote'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Topic Group Card ─────────────────────────────────────────────────────────

interface TopicGroupCardProps {
  group: HubTopicGroup
  phase: 'authoring' | 'voting'
  boostedIds: Set<string>
  onBoost: (contId: string) => void
  votedTopics: Map<string, string>
  onVote: (topicId: string, contId: string) => void
  isLoggedIn: boolean
}

function TopicGroupCard({
  group,
  phase,
  boostedIds,
  onBoost,
  votedTopics,
  onVote,
  isLoggedIn,
}: TopicGroupCardProps) {
  const [expanded, setExpanded] = useState(true)
  const { topic, continuations } = group
  const deadline =
    phase === 'authoring'
      ? topic.continuation_window_ends_at
      : topic.continuation_vote_ends_at
  const forPct = Math.round(topic.blue_pct ?? 50)
  const userVote = votedTopics.get(topic.id) ?? null

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      {/* Topic header */}
      <div className="flex items-start gap-3 p-4 border-b border-surface-300">
        <div className="flex-1 min-w-0">
          <Link
            href={`/topic/${topic.id}`}
            className="text-sm font-mono text-white hover:text-for-300 transition-colors line-clamp-2 font-semibold"
          >
            {topic.statement}
          </Link>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                {topic.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">·</span>
            <span className="text-[10px] font-mono text-for-400">
              {forPct}% FOR
            </span>
            <span className="text-[10px] font-mono text-surface-600">·</span>
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
            {deadline && (
              <>
                <span className="text-[10px] font-mono text-surface-600">·</span>
                <span
                  className={cn(
                    'text-[10px] font-mono flex items-center gap-0.5',
                    phase === 'voting' ? 'text-gold' : 'text-purple',
                  )}
                >
                  <Clock className="h-2.5 w-2.5" />
                  {timeLeft(deadline)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'text-[10px] font-mono px-2 py-0.5 rounded-full border',
              phase === 'authoring'
                ? 'text-purple border-purple/30 bg-purple/10'
                : 'text-gold border-gold/30 bg-gold/10',
            )}
          >
            {continuations.length} {phase === 'authoring' ? 'proposal' : 'finalist'}
            {continuations.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-surface-500 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Continuations */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 grid gap-2.5">
              {continuations.length === 0 ? (
                <p className="text-xs font-mono text-surface-500 text-center py-3">
                  No proposals yet.{' '}
                  <Link
                    href={`/topic/${topic.id}`}
                    className="text-for-400 hover:underline"
                  >
                    Be the first →
                  </Link>
                </p>
              ) : (
                continuations.map((cont) => (
                  <ContCard
                    key={cont.id}
                    cont={cont}
                    topicStatement={topic.statement}
                    phase={phase}
                    onBoost={isLoggedIn ? onBoost : undefined}
                    boostedIds={boostedIds}
                    userVote={userVote}
                    onVote={isLoggedIn ? (contId) => onVote(topic.id, contId) : undefined}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  description,
  count,
  color,
}: {
  icon: typeof Zap
  title: string
  description: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className={cn(
          'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
          color,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-base font-bold text-white">{title}</h2>
          <span className="text-xs font-mono text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContinuationsPage() {
  const [data, setData] = useState<ContinuationsHubResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [boostedIds, setBoostedIds] = useState<Set<string>>(new Set())
  const [votedTopics, setVotedTopics] = useState<Map<string, string>>(new Map())

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/continuations/hub', { cache: 'no-store' })
      if (res.ok) {
        const body: ContinuationsHubResponse = await res.json()
        setData(body)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: d }) => {
      setIsLoggedIn(!!d.user)
    })
  }, [load])

  const handleBoost = useCallback(async (contId: string) => {
    setBoostedIds((prev) => new Set([...prev, contId]))
    await fetch(`/api/continuations/${contId}/boost`, { method: 'POST' })
  }, [])

  const handleVote = useCallback(async (topicId: string, contId: string) => {
    setVotedTopics((prev) => new Map([...prev, [topicId, contId]]))
    await fetch(`/api/continuations/${contId}/vote`, { method: 'POST' })
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/15 border border-purple/25 flex-shrink-0 mt-0.5">
              <GitBranch className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Continuations Hub
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                What happens next? Shape the chains of civic debate.
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mt-1"
            aria-label="Refresh"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
            />
            Refresh
          </button>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatPill
              label="Open for Proposals"
              value={data.stats.totalAuthoring}
              color="border-purple/20 bg-purple/5"
            />
            <StatPill
              label="In Community Vote"
              value={data.stats.totalVoting}
              color="border-gold/20 bg-gold/5"
            />
            <StatPill
              label="Won This Month"
              value={data.stats.totalWinnersThisMonth}
              color="border-emerald/20 bg-emerald/5"
            />
            <StatPill
              label="Total Proposed"
              value={data.stats.totalContinuationsProposed}
              color="border-surface-300 bg-surface-100"
            />
          </div>
        ) : null}

        {/* ── How it works ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 mb-8">
          <h2 className="text-xs font-mono font-semibold text-surface-600 uppercase tracking-widest mb-3">
            How Continuations Work
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: 'Topic Concludes',
                desc: 'A topic reaches consensus and enters a "continued" window.',
                color: 'text-for-400',
              },
              {
                step: '2',
                title: 'Community Proposes',
                desc: 'Citizens write "...but X" or "...and X" continuations. Top proposals advance via boosts.',
                color: 'text-purple',
              },
              {
                step: '3',
                title: 'Community Votes',
                desc: 'Finalist continuations enter a vote phase. The winner becomes the next topic in the chain.',
                color: 'text-gold',
              },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="flex gap-2.5">
                <span
                  className={cn(
                    'text-xs font-mono font-bold flex-shrink-0 mt-0.5',
                    color,
                  )}
                >
                  {step}.
                </span>
                <div>
                  <p className="text-xs font-mono text-white font-semibold">
                    {title}
                  </p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-10">

            {/* ── Authoring Phase ─────────────────────────────────────── */}
            <section>
              <SectionHeader
                icon={Zap}
                title="Open for Proposals"
                description="Boost the continuations you want to see advance to the vote phase."
                count={data.authoring.length}
                color="bg-purple/15 border border-purple/25 text-purple"
              />
              {data.authoring.length === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title="No active authoring windows"
                  description="No topics are currently open for continuation proposals."
                />
              ) : (
                <div className="grid gap-4">
                  {data.authoring.map((group) => (
                    <TopicGroupCard
                      key={group.topic.id}
                      group={group}
                      phase="authoring"
                      boostedIds={boostedIds}
                      onBoost={handleBoost}
                      votedTopics={votedTopics}
                      onVote={handleVote}
                      isLoggedIn={isLoggedIn}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Voting Phase ─────────────────────────────────────────── */}
            <section>
              <SectionHeader
                icon={Vote}
                title="Community Vote"
                description="Finalist continuations are in a vote. The winning proposal becomes the next debate."
                count={data.voting.length}
                color="bg-gold/15 border border-gold/25 text-gold"
              />
              {data.voting.length === 0 ? (
                <EmptyState
                  icon={Vote}
                  title="No active votes"
                  description="No continuation votes are running right now. Check back soon."
                />
              ) : (
                <div className="grid gap-4">
                  {data.voting.map((group) => (
                    <TopicGroupCard
                      key={group.topic.id}
                      group={group}
                      phase="voting"
                      boostedIds={boostedIds}
                      onBoost={handleBoost}
                      votedTopics={votedTopics}
                      onVote={handleVote}
                      isLoggedIn={isLoggedIn}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Recent Winners ───────────────────────────────────────── */}
            <section>
              <SectionHeader
                icon={Trophy}
                title="Recent Winners"
                description="Continuations that won the community vote and became the next link in their chain."
                count={data.recentWinners.length}
                color="bg-emerald/15 border border-emerald/25 text-emerald"
              />
              {data.recentWinners.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No recent winners"
                  description="No continuations have been decided in the last 30 days."
                />
              ) : (
                <div className="grid gap-3">
                  {data.recentWinners.map((w) => (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-emerald/20 bg-emerald/5 p-3.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <Trophy className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-surface-500 mb-1 truncate">
                            {w.topic.statement.slice(0, 80)}
                            {w.topic.statement.length > 80 ? '…' : ''}
                          </p>
                          <p className="text-sm font-mono">
                            <span
                              className={cn(
                                'font-semibold mr-1',
                                w.connector === 'but'
                                  ? 'text-against-400'
                                  : 'text-for-400',
                              )}
                            >
                              ...{w.connector}
                            </span>
                            <span className="text-white">{w.text}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {w.author && (
                              <div className="flex items-center gap-1">
                                <Avatar
                                  src={w.author.avatar_url}
                                  username={w.author.username}
                                  size="xs"
                                />
                                <span className="text-[10px] font-mono text-surface-500">
                                  {w.author.display_name ?? w.author.username}
                                </span>
                              </div>
                            )}
                            <span className="text-[10px] font-mono text-surface-600">
                              {relTime(w.created_at)}
                            </span>
                            <Link
                              href={`/topic/${w.topic.id}`}
                              className="ml-auto text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-0.5"
                            >
                              View chain
                              <ArrowRight className="h-2.5 w-2.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* ── CTA ─────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-purple/20 bg-purple/5 px-6 py-7 text-center">
              <div className="font-mono text-[10px] text-purple uppercase tracking-widest mb-2">
                Explore chains
              </div>
              <h2 className="font-mono text-lg font-bold text-white mb-2">
                See the full chain history
              </h2>
              <p className="text-sm text-surface-500 font-mono mb-5 max-w-sm mx-auto">
                Browse every topic chain — from the original debate through all
                its continuations to where consensus landed.
              </p>
              <Link
                href="/chains"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple/20 hover:bg-purple/30 border border-purple/30 text-purple text-sm font-mono font-semibold transition-colors"
              >
                Browse all chains
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

          </div>
        ) : (
          <EmptyState
            icon={GitBranch}
            title="Failed to load"
            description="Could not load continuations. Please refresh."
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
