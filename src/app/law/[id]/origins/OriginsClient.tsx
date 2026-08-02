'use client'

/**
 * /law/[id]/origins — Law Genesis
 *
 * Traces the founding story of an established law: who proposed it,
 * the journey from proposal to law, pioneer voters, and the arguments
 * that shaped its earliest days.
 *
 * Distinct from:
 *   /law/[id]/timeline   — full event log of all milestones
 *   /law/[id]/highlights — best moments from the debate
 *   /law/[id]/voters     — all voters ranked by clout
 *   /law/[id]/arguments  — current argument browser
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Gavel,
  GitBranch,
  MessageSquare,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
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
import type {
  LawOriginsResponse,
  OriginFoundingArgument,
  OriginPioneerVoter,
  LawJourneyPhase,
} from '@/app/api/laws/[id]/origins/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function hoursAfterStart(start: string, event: string): string {
  const diffMs = new Date(event).getTime() - new Date(start).getTime()
  const h = Math.floor(diffMs / (1000 * 60 * 60))
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / 60000)
  if (h === 0) return `${m}m after proposal`
  if (h < 24) return `${h}h ${m}m after proposal`
  return `Day ${Math.floor(h / 24) + 1}`
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500' },
  debator:       { label: 'Debator',      color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',        color: 'text-gold' },
}

const JOURNEY_PHASE_CONFIG: Record<
  LawJourneyPhase['phase'],
  { label: string; icon: typeof Zap; color: string; bg: string; border: string }
> = {
  proposed:    { label: 'Proposed',        icon: Sparkles,      color: 'text-surface-400',  bg: 'bg-surface-300/20',  border: 'border-surface-400/30' },
  active:      { label: 'Active Debate',   icon: Zap,           color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  voting:      { label: 'Final Vote',      icon: Scale,         color: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/30' },
  established: { label: 'Established Law', icon: Gavel,         color: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/30' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Founding Argument Card ───────────────────────────────────────────────────

function FoundingArgCard({
  arg,
  topicCreatedAt,
}: {
  arg: OriginFoundingArgument
  topicCreatedAt: string
}) {
  const isFor = arg.side === 'for'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20',
      )}
    >
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
            isFor
              ? 'text-for-400 bg-for-500/10 border-for-500/30'
              : 'text-against-400 bg-against-500/10 border-against-500/30',
          )}
        >
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {arg.is_first_for && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border text-emerald bg-emerald/10 border-emerald/30">
            <Crown className="h-3 w-3" /> First FOR
          </span>
        )}
        {arg.is_first_against && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border text-against-300 bg-against-500/10 border-against-500/30">
            <Crown className="h-3 w-3" /> First AGAINST
          </span>
        )}
        <span className="ml-auto text-[11px] text-surface-500 font-mono">
          {hoursAfterStart(topicCreatedAt, arg.created_at)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-4">{arg.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {arg.author_username ? (
            <Link
              href={`/profile/${arg.author_username}`}
              className="flex items-center gap-1.5 group"
            >
              <Avatar
                src={arg.author_avatar_url}
                fallback={arg.author_display_name || arg.author_username}
                size="xs"
              />
              <span className="text-xs text-surface-500 group-hover:text-white transition-colors">
                @{arg.author_username}
              </span>
            </Link>
          ) : (
            <span className="text-xs text-surface-600">Anonymous</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-surface-500 font-mono">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" /> {arg.upvotes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {arg.reply_count}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Pioneer Voter Row ────────────────────────────────────────────────────────

function PioneerVoterRow({ voter }: { voter: OriginPioneerVoter }) {
  const isFor = voter.side === 'for'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-200/40 last:border-0">
      <span className="text-[11px] font-mono text-surface-600 w-5 text-center flex-shrink-0">
        {voter.rank}
      </span>
      {voter.username ? (
        <Link href={`/profile/${voter.username}`} className="flex items-center gap-2.5 flex-1 min-w-0 group">
          <Avatar src={voter.avatar_url} fallback={voter.display_name || voter.username} size="xs" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors truncate">
              {voter.display_name || voter.username}
            </p>
            <p className="text-[10px] text-surface-500 truncate">@{voter.username}</p>
          </div>
        </Link>
      ) : (
        <span className="flex-1 text-xs text-surface-600">Anonymous</span>
      )}
      <span
        className={cn(
          'flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
          isFor
            ? 'text-for-400 bg-for-500/10 border-for-500/30'
            : 'text-against-400 bg-against-500/10 border-against-500/30',
        )}
      >
        {isFor ? 'FOR' : 'AGAINST'}
      </span>
    </div>
  )
}

// ─── Journey Timeline ─────────────────────────────────────────────────────────

function JourneyTimeline({ phases }: { phases: LawJourneyPhase[] }) {
  return (
    <div className="relative">
      {/* Vertical spine */}
      <div className="absolute left-4 top-5 bottom-5 w-px bg-gradient-to-b from-surface-400/40 via-gold/30 to-gold/60" />

      <div className="space-y-6">
        {phases.map((phase, i) => {
          const cfg = JOURNEY_PHASE_CONFIG[phase.phase]
          const Icon = cfg.icon
          const isLast = i === phases.length - 1
          return (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-4"
            >
              {/* Node */}
              <div
                className={cn(
                  'relative z-10 flex-shrink-0 flex items-center justify-center',
                  'h-8 w-8 rounded-full border-2',
                  cfg.bg,
                  cfg.border,
                )}
              >
                <Icon className={cn('h-4 w-4', cfg.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn('text-sm font-semibold', cfg.color)}>{phase.label}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{formatDate(phase.date)}</p>
                  </div>
                  {isLast && (
                    <CheckCircle2 className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                  )}
                </div>
                {phase.duration_days !== null && phase.duration_days > 0 && !isLast && (
                  <p className="text-[11px] text-surface-600 mt-1 flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {phase.duration_days === 1 ? '1 day' : `${phase.duration_days} days`} in this phase
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface OriginsClientProps {
  lawId: string
}

export function OriginsClient({ lawId }: OriginsClientProps) {
  const [data, setData] = useState<LawOriginsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/laws/${lawId}/origins`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(true) } else { setData(d) }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [lawId])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back button */}
        <div className="mb-5">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-4 w-4 text-gold" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">Law Origins</span>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-3/4" />
          ) : data ? (
            <h1 className="text-xl font-bold text-white leading-snug">{data.law.statement}</h1>
          ) : null}
          {data && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {data.law.category && (
                <Badge variant="outline" className="text-[11px]">{data.law.category}</Badge>
              )}
              <span className="text-xs text-surface-500 font-mono flex items-center gap-1">
                <Gavel className="h-3 w-3 text-gold" />
                Established {formatDate(data.law.established_at)}
              </span>
            </div>
          )}
        </div>

        {loading && <PageSkeleton />}
        {error && (
          <EmptyState
            icon={<GitBranch className="h-8 w-8" />}
            title="Origins unavailable"
            description="Could not load the founding history for this law."
          />
        )}

        {data && !loading && (
          <div className="space-y-6">
            {/* Key stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Days to Pass',
                  value: data.law.days_to_pass,
                  icon: Clock,
                  color: 'text-gold',
                  suffix: data.law.days_to_pass === 1 ? ' day' : ' days',
                },
                {
                  label: 'Total Votes',
                  value: (data.law.total_votes ?? 0).toLocaleString(),
                  icon: Users,
                  color: 'text-for-400',
                  suffix: '',
                },
                {
                  label: 'Final FOR %',
                  value: `${Math.round(data.law.blue_pct)}%`,
                  icon: ThumbsUp,
                  color: 'text-emerald',
                  suffix: '',
                },
              ].map(stat => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center"
                  >
                    <Icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
                    <p className={cn('text-lg font-bold font-mono', stat.color)}>
                      {stat.value}{stat.suffix}
                    </p>
                    <p className="text-[11px] text-surface-500 mt-0.5">{stat.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Founder card */}
            {data.founder && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Founding Proposer</h2>
                </div>
                <Link
                  href={`/profile/${data.founder.username}`}
                  className="flex items-center gap-4 group"
                >
                  <Avatar
                    src={data.founder.avatar_url}
                    fallback={data.founder.display_name || data.founder.username || '?'}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white group-hover:text-for-300 transition-colors">
                      {data.founder.display_name || data.founder.username || 'Unknown'}
                    </p>
                    {data.founder.username && (
                      <p className="text-sm text-surface-500">@{data.founder.username}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span
                        className={cn(
                          'text-[11px] font-mono',
                          ROLE_LABELS[data.founder.role]?.color ?? 'text-surface-500',
                        )}
                      >
                        {ROLE_LABELS[data.founder.role]?.label ?? 'Citizen'}
                      </span>
                      <span className="text-[11px] text-surface-500 font-mono">
                        {data.founder.clout.toLocaleString()} clout
                      </span>
                      {data.founder.total_laws_founded > 1 && (
                        <span className="text-[11px] text-gold font-mono flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {data.founder.total_laws_founded} laws founded
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                </Link>
              </div>
            )}

            {/* Journey timeline */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-5">
                <Calendar className="h-4 w-4 text-purple" />
                <h2 className="text-sm font-semibold text-white">Legislative Journey</h2>
              </div>
              <JourneyTimeline phases={data.journey} />
            </div>

            {/* First-week stats */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-for-400" />
                <h2 className="text-sm font-semibold text-white">First Week</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Votes cast', value: data.first_week_stats.votes_in_week.toLocaleString() },
                  { label: 'Arguments made', value: data.first_week_stats.arguments_in_week.toLocaleString() },
                  { label: 'FOR votes', value: data.first_week_stats.for_in_week.toLocaleString() },
                  { label: 'AGAINST votes', value: data.first_week_stats.against_in_week.toLocaleString() },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-surface-200/60 px-3 py-2.5">
                    <p className="text-base font-bold font-mono text-white">{s.value}</p>
                    <p className="text-[11px] text-surface-500">{s.label}</p>
                  </div>
                ))}
              </div>
              {data.first_week_stats.top_early_argument && (
                <div className="rounded-lg border border-surface-300 bg-surface-200/40 p-3 mt-3">
                  <p className="text-[11px] text-surface-500 mb-1 font-mono">Top early argument</p>
                  <p className="text-sm text-surface-700 italic line-clamp-3">
                    &ldquo;{data.first_week_stats.top_early_argument}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Founding arguments */}
            {data.founding_arguments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-semibold text-white">Founding Arguments</h2>
                  <span className="text-xs text-surface-500 font-mono ml-auto">
                    First & highest-rated
                  </span>
                </div>
                <div className="space-y-3">
                  {data.founding_arguments.map(arg => (
                    <FoundingArgCard
                      key={arg.id}
                      arg={arg}
                      topicCreatedAt={data.law.established_at}
                    />
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href={`/law/${lawId}/arguments`}
                    className="text-xs text-for-400 hover:text-for-300 transition-colors font-mono"
                  >
                    View all arguments →
                  </Link>
                </div>
              </div>
            )}

            {/* Pioneer voters */}
            {data.pioneer_voters.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Pioneer Voters</h2>
                  <span className="text-xs text-surface-500 font-mono ml-auto">
                    First {data.pioneer_voters.length} of {data.total_pioneers}
                  </span>
                </div>
                <div>
                  {data.pioneer_voters.map(voter => (
                    <PioneerVoterRow key={voter.user_id} voter={voter} />
                  ))}
                </div>
                {data.total_pioneers > data.pioneer_voters.length && (
                  <div className="mt-3 text-center">
                    <Link
                      href={`/law/${lawId}/voters`}
                      className="text-xs text-for-400 hover:text-for-300 transition-colors font-mono"
                    >
                      View all {data.total_pioneers} voters →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Related links */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Explore Further</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/law/${lawId}/timeline`, label: 'Full Timeline', icon: Calendar },
                  { href: `/law/${lawId}/highlights`, label: 'Key Moments', icon: Trophy },
                  { href: `/law/${lawId}/voters`, label: 'All Voters', icon: Users },
                  { href: `/law/${lawId}/scorecard`, label: 'Scorecard', icon: Award },
                ].map(link => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-lg',
                        'bg-surface-200/60 border border-surface-300/60',
                        'hover:border-surface-400/60 hover:bg-surface-200',
                        'transition-colors group',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-gold transition-colors" />
                      <span className="text-xs font-mono text-surface-600 group-hover:text-white transition-colors">
                        {link.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
