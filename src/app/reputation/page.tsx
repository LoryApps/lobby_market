'use client'

/**
 * /reputation — The Civic Reputation Ladder
 *
 * A dedicated breakdown of the Lobby Market reputation system:
 * how scores are earned (votes, topics, laws), where you stand
 * relative to the community, milestone progression, and a live
 * leaderboard of the platform's highest-reputation citizens.
 *
 * Distinct from:
 *   /karma        — holistic five-dimension credit score
 *   /analytics    — raw vote/argument statistics
 *   /leaderboard  — all-time activity rankings (not rep-focused)
 *   /civic-score  — personal engagement rating (interaction-based)
 *   /report-card  — academic letter grades per dimension
 *
 * This is the only page dedicated to explaining and showcasing
 * the reputation_score formula and its milestones.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Crown,
  FileText,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Star,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ReputationResponse,
  RepBreakdown,
  RepMilestone,
  RepLeader,
  RepActivity,
} from '@/app/api/reputation/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Users }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/30', icon: Users },
  debator:       { label: 'Debator',      color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: MessageSquare },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald',    bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: Shield },
  elder:         { label: 'Elder',         color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         icon: Crown },
}

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.person
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-purple',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-gold',
}

// ─── Section skeleton ─────────────────────────────────────────────────────────

function RepSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Score breakdown panel ────────────────────────────────────────────────────

function BreakdownPanel({ breakdown, percentile, platformAvg }: {
  breakdown: RepBreakdown
  percentile: number | null
  platformAvg: number
}) {
  const total = breakdown.total

  const items = [
    {
      label: 'Votes Cast',
      value: breakdown.total_votes,
      points: breakdown.votes_score,
      multiplier: '× 1 pt',
      icon: Vote,
      color: 'text-for-400',
      bg: 'bg-for-500/10',
      border: 'border-for-500/20',
    },
    {
      label: 'Topics Proposed',
      value: breakdown.topics_authored,
      points: breakdown.topics_score,
      multiplier: '× 5 pts',
      icon: FileText,
      color: 'text-purple',
      bg: 'bg-purple/10',
      border: 'border-purple/20',
    },
    {
      label: 'Laws Authored',
      value: breakdown.laws_authored,
      points: breakdown.laws_score,
      multiplier: '× 50 pts',
      icon: Gavel,
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/20',
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-5">
      {/* Total score */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-1">
            Reputation Score
          </p>
          <div className="flex items-end gap-2">
            <AnimatedNumber
              value={total}
              className="text-4xl font-mono font-bold text-white"
            />
            <span className="text-sm font-mono text-surface-500 mb-1">pts</span>
          </div>
          {percentile !== null && (
            <p className="text-xs font-mono text-emerald mt-1">
              Top {100 - percentile}% of all citizens
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-surface-500 mb-1">Platform avg</p>
          <p className="text-lg font-mono font-bold text-surface-400">
            {formatNumber(platformAvg)}
          </p>
        </div>
      </div>

      {/* Breakdown items */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon
          const pct = total > 0 ? Math.round((item.points / total) * 100) : 0
          return (
            <div
              key={item.label}
              className={cn(
                'rounded-xl border p-4 space-y-2',
                item.bg, item.border
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-3.5 w-3.5', item.color)} />
                <span className={cn('text-xs font-mono font-semibold', item.color)}>
                  {item.label}
                </span>
              </div>
              <div>
                <p className="text-2xl font-mono font-bold text-white">
                  {item.value.toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-surface-500">{item.multiplier}</span>
                  <span className="text-[10px] font-mono text-surface-400">=</span>
                  <span className={cn('text-xs font-mono font-semibold', item.color)}>
                    +{item.points.toLocaleString()} pts
                  </span>
                </div>
                {total > 0 && (
                  <div className="mt-2 h-1 rounded-full bg-surface-300/50 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', item.color.replace('text-', 'bg-'))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Formula note */}
      <div className="border-t border-surface-300 pt-4">
        <p className="text-xs font-mono text-surface-500">
          Formula:{' '}
          <span className="text-white">votes × 1</span>
          {' '}+{' '}
          <span className="text-white">topics × 5</span>
          {' '}+{' '}
          <span className="text-white">laws × 50</span>
          {' '}= reputation score. Recalculated daily.
        </p>
      </div>
    </div>
  )
}

// ─── Milestone list ───────────────────────────────────────────────────────────

function MilestonePanel({ milestones, currentScore }: { milestones: RepMilestone[]; currentScore: number }) {
  const nextMilestone = milestones.find((m) => !m.reached)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
          Milestones
        </h2>
        {nextMilestone && (
          <div className="text-right">
            <p className="text-[10px] font-mono text-surface-500">Next: {nextMilestone.label}</p>
            <p className="text-xs font-mono text-purple">
              {(nextMilestone.threshold - currentScore).toLocaleString()} pts away
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {milestones.map((m, i) => {
          const isNext = !m.reached && (i === 0 || milestones[i - 1].reached)
          const pct = m.reached ? 100 : Math.min(99, Math.round((currentScore / m.threshold) * 100))

          return (
            <div
              key={m.threshold}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border transition-colors',
                m.reached
                  ? 'bg-emerald/5 border-emerald/20'
                  : isNext
                  ? 'bg-purple/5 border-purple/20'
                  : 'bg-surface-200/40 border-surface-300/40'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {m.reached ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald" />
                ) : isNext ? (
                  <Zap className="h-4 w-4 text-purple" />
                ) : (
                  <Circle className="h-4 w-4 text-surface-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    'text-xs font-mono font-semibold',
                    m.reached ? 'text-emerald' : isNext ? 'text-purple' : 'text-surface-500'
                  )}>
                    {m.label}
                    {m.role && (
                      <span className="ml-1.5 text-[10px] text-surface-600 font-normal">
                        → unlocks {m.role}
                      </span>
                    )}
                  </p>
                  <span className={cn(
                    'text-[10px] font-mono flex-shrink-0',
                    m.reached ? 'text-emerald' : 'text-surface-600'
                  )}>
                    {m.threshold.toLocaleString()} pts
                  </span>
                </div>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">{m.description}</p>
                {!m.reached && currentScore > 0 && (
                  <div className="mt-1.5 h-1 rounded-full bg-surface-300/50 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', isNext ? 'bg-purple' : 'bg-surface-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardPanel({ leaders }: { leaders: RepLeader[] }) {
  if (leaders.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No leaders yet"
        description="Be the first to earn reputation on the platform."
        size="sm"
      />
    )
  }

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
          Top Citizens
        </h2>
        <Link
          href="/leaderboard/reputation"
          className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
        >
          Full ranking <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {leaders.map((leader, i) => {
          const roleConf = getRoleConfig(leader.role)
          const RoleIcon = roleConf.icon
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

          return (
            <Link
              key={leader.id}
              href={`/profile/${leader.username}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
            >
              <div className="w-6 text-center flex-shrink-0">
                {medal ? (
                  <span className="text-base">{medal}</span>
                ) : (
                  <span className="text-xs font-mono text-surface-500">#{i + 1}</span>
                )}
              </div>
              <Avatar
                src={leader.avatar_url}
                fallback={leader.display_name || leader.username}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-mono font-semibold text-white truncate group-hover:text-for-300 transition-colors">
                    {leader.display_name || leader.username}
                  </p>
                  <RoleIcon className={cn('h-3 w-3 flex-shrink-0', roleConf.color)} />
                </div>
                <p className="text-[10px] font-mono text-surface-500">
                  {leader.total_votes.toLocaleString()} votes
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-mono font-bold text-white">
                  {leader.reputation_score.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-surface-500">pts</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Recent activity ──────────────────────────────────────────────────────────

function ActivityPanel({ activities }: { activities: RepActivity[] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={Vote}
        title="No activity yet"
        description="Start voting, proposing topics, or creating laws to earn reputation."
        size="sm"
        actions={[{ label: 'Browse Topics', href: '/' }]}
      />
    )
  }

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
      <h2 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
        Recent Reputation Activity
      </h2>
      <div className="space-y-2">
        {activities.slice(0, 15).map((act, i) => {
          const isTopic = act.type === 'topic'
          const isLaw = act.type === 'law'
          const catColor = CATEGORY_COLOR[act.topic_category ?? ''] ?? 'text-surface-500'

          return (
            <Link
              key={`${act.topic_id}-${i}`}
              href={`/topic/${act.topic_id}`}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-surface-200/60 transition-colors group"
            >
              <div className={cn(
                'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border mt-0.5',
                isLaw ? 'bg-gold/10 border-gold/30' : isTopic ? 'bg-purple/10 border-purple/30' : 'bg-for-500/10 border-for-500/30'
              )}>
                {isLaw ? (
                  <Gavel className="h-3.5 w-3.5 text-gold" />
                ) : isTopic ? (
                  <FileText className="h-3.5 w-3.5 text-purple" />
                ) : (
                  <Vote className="h-3.5 w-3.5 text-for-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-white truncate group-hover:text-for-300 transition-colors">
                  {act.topic_statement}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {act.topic_category && (
                    <span className={cn('text-[10px] font-mono', catColor)}>
                      {act.topic_category}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-surface-600">
                    {relativeTime(act.occurred_at)}
                  </span>
                </div>
              </div>
              <div className={cn(
                'flex-shrink-0 text-xs font-mono font-semibold',
                isLaw ? 'text-gold' : isTopic ? 'text-purple' : 'text-for-400'
              )}>
                +{act.points}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── How it works explainer ───────────────────────────────────────────────────

function HowItWorksPanel() {
  const actions = [
    { icon: Vote,    color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20', pts: 1,  label: 'Cast a vote', desc: 'Every vote on any topic earns 1 point' },
    { icon: FileText, color: 'text-purple', bg: 'bg-purple/10',  border: 'border-purple/20',  pts: 5,  label: 'Propose a topic', desc: 'Submit a binary topic for the community to debate' },
    { icon: Gavel,   color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/20',    pts: 50, label: 'Author a law', desc: 'Your proposed topic reaches consensus (≥ 67% FOR)' },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
      <h2 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
        How Reputation Works
      </h2>
      <div className="space-y-3">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <div
              key={a.label}
              className={cn('flex items-center gap-3 p-3 rounded-xl border', a.bg, a.border)}
            >
              <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border', a.bg, a.border)}>
                <Icon className={cn('h-4 w-4', a.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-mono font-semibold', a.color)}>{a.label}</p>
                <p className="text-[10px] font-mono text-surface-500">{a.desc}</p>
              </div>
              <div className={cn('flex-shrink-0 text-sm font-mono font-bold', a.color)}>
                +{a.pts} {a.pts === 1 ? 'pt' : 'pts'}
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-surface-300 pt-4 space-y-2">
        <p className="text-xs font-mono text-surface-500">
          Reputation scores refresh daily and determine your{' '}
          <Link href="/karma" className="text-for-400 hover:text-for-300">role progression</Link>.
          Reaching 500 points unlocks the{' '}
          <span className="text-for-400 font-semibold">Debator</span> role.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-600/30 text-for-400 text-xs font-mono hover:bg-for-600/30 transition-colors">
            <Vote className="h-3 w-3" /> Vote Now
          </Link>
          <Link href="/topic/create" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/10 border border-purple/30 text-purple text-xs font-mono hover:bg-purple/20 transition-colors">
            <FileText className="h-3 w-3" /> Propose Topic
          </Link>
          <Link href="/leaderboard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono hover:text-white hover:border-surface-400 transition-colors">
            <Trophy className="h-3 w-3" /> Leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const [data, setData] = useState<ReputationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/reputation')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Star className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Reputation Ladder
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Earn points · unlock roles · climb the ranks
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh reputation data"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <RepSkeleton />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-4"
            >
              {/* My breakdown (auth required) */}
              {data.is_authenticated ? (
                <>
                  <BreakdownPanel
                    breakdown={data.breakdown}
                    percentile={data.percentile}
                    platformAvg={data.platform_avg}
                  />
                  <MilestonePanel
                    milestones={data.milestones}
                    currentScore={data.breakdown.total}
                  />
                </>
              ) : (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center space-y-3">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple/10 border border-purple/30 mx-auto">
                    <Star className="h-5 w-5 text-purple" />
                  </div>
                  <p className="font-mono text-base font-bold text-white">Track Your Reputation</p>
                  <p className="text-sm font-mono text-surface-500">
                    Sign in to see your score breakdown, milestones, and activity feed.
                  </p>
                  <div className="flex justify-center gap-3 mt-2">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                    >
                      Sign In <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {/* How it works — always visible */}
              <HowItWorksPanel />

              {/* Leaders — always visible */}
              <LeaderboardPanel leaders={data.leaders} />

              {/* Recent activity — auth only */}
              {data.is_authenticated && (
                <ActivityPanel activities={data.recent_activity} />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <EmptyState
            icon={Scale}
            title="Could not load reputation data"
            description="Something went wrong. Please try again."
            actions={[{ label: 'Retry', onClick: () => load(true) }]}
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
