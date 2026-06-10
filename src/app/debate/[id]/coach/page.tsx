'use client'

/**
 * /debate/[id]/coach — Pre-Debate AI Coaching Brief
 *
 * Gives a registered debate participant a personalised preparation dossier
 * for their upcoming debate:
 *   - Their assigned side (FOR / AGAINST)
 *   - Their opponent's civic profile and debate record
 *   - The strongest arguments from their side
 *   - The arguments they need to counter
 *   - AI-generated opening hook, core points, and closing line
 *   - Tactical strategy tip for the debate format
 *
 * Distinct from:
 *   /prep           — generic topic preparation (no debate context)
 *   /coach          — argument drafting and critique (no debate context)
 *   /debate/[id]    — the live arena
 *   /debate/[id]/performance — post-debate breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CoachResponse, CoachArgument, OpponentProfile } from '@/app/api/debate/[id]/coach/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  quick: 'Quick · 15 min',
  grand: 'Grand · 45 min',
  tribunal: 'Tribunal · 60 min',
  oxford: 'Oxford-Style',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  senator: 'Senator',
  lawmaker: 'Lawmaker',
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const m = Math.round(diff / 60_000)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (diff < 0) return 'started'
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  return `in ${d}d`
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Side config ──────────────────────────────────────────────────────────────

function getSideConfig(side: 'blue' | 'red') {
  return side === 'blue'
    ? {
        label: 'FOR',
        icon: ThumbsUp,
        bg: 'bg-for-500/10',
        border: 'border-for-500/30',
        text: 'text-for-300',
        pill: 'bg-for-500/15 border-for-500/40 text-for-300',
        ring: 'ring-for-500/30',
        dot: 'bg-for-500',
        glow: 'shadow-for-500/10',
      }
    : {
        label: 'AGAINST',
        icon: ThumbsDown,
        bg: 'bg-against-500/10',
        border: 'border-against-500/30',
        text: 'text-against-300',
        pill: 'bg-against-500/15 border-against-500/40 text-against-300',
        ring: 'ring-against-500/30',
        dot: 'bg-against-500',
        glow: 'shadow-against-500/10',
      }
}

// ─── Opponent card ────────────────────────────────────────────────────────────

function OpponentCard({
  opponent,
  opponentSide,
}: {
  opponent: OpponentProfile
  opponentSide: 'blue' | 'red'
}) {
  const opp = getSideConfig(opponentSide)
  return (
    <Link
      href={`/profile/${opponent.username}`}
      className={cn(
        'group block rounded-2xl border bg-surface-100 p-5 transition-all',
        opp.border,
        'hover:border-opacity-60',
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn('ring-2 rounded-full flex-shrink-0', opp.ring)}>
          <Avatar
            src={opponent.avatar_url}
            fallback={opponent.display_name || opponent.username}
            size="lg"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-white text-sm truncate">
              {opponent.display_name || opponent.username}
            </span>
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', opp.pill)}>
              {opp.label}
            </span>
          </div>
          <span className="text-xs font-mono text-surface-500">
            @{opponent.username} · {ROLE_LABEL[opponent.role] ?? 'Citizen'}
          </span>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-base font-mono font-bold text-white">
                {opponent.clout.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500">Clout</div>
            </div>
            <div className="text-center">
              <div className="text-base font-mono font-bold text-white">
                {opponent.total_votes.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500">Votes</div>
            </div>
            <div className="text-center">
              <div className={cn(
                'text-base font-mono font-bold',
                opponent.total_debates > 5 ? 'text-against-400' : 'text-white',
              )}>
                {opponent.total_debates}
              </div>
              <div className="text-[10px] font-mono text-surface-500">Debates</div>
            </div>
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Argument row ─────────────────────────────────────────────────────────────

function ArgRow({
  arg,
  side,
  index,
}: {
  arg: CoachArgument
  side: 'blue' | 'red'
  index: number
}) {
  const cfg = getSideConfig(side)
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-colors',
        'bg-surface-100/60',
        cfg.border,
      )}
    >
      <span className={cn(
        'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-mono font-bold mt-0.5',
        cfg.bg, cfg.text,
      )}>
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-surface-300 leading-relaxed line-clamp-3">
          {arg.content}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {arg.author && (
            <Link
              href={`/profile/${arg.author.username}`}
              className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name || arg.author.username}
                size="xs"
              />
              {arg.author.display_name || arg.author.username}
            </Link>
          )}
          <span className="text-[10px] font-mono text-surface-600 ml-auto">
            {arg.upvotes} {arg.upvotes === 1 ? 'upvote' : 'upvotes'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CoachSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {/* Brief */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full rounded-xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
      {/* Opponent */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebateCoachPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<CoachResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debate/${params.id}/coach`, { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load coaching brief')
      const json = (await res.json()) as CoachResponse
      setData(json)
    } catch {
      setError('Could not load your coaching brief. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => { load() }, [load])

  const mySide = data?.user_side ?? 'blue'
  const myCfg = getSideConfig(mySide)
  const opponentSide: 'blue' | 'red' = mySide === 'blue' ? 'red' : 'blue'
  const oppCfg = getSideConfig(opponentSide)
  const MySideIcon = myCfg.icon

  const forPct = data?.debate.topic.blue_pct ?? 50
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <Link
          href={`/debate/${params.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <div className={cn(
            'flex items-center justify-center h-11 w-11 rounded-xl flex-shrink-0 border',
            'bg-purple/10 border-purple/30',
          )}>
            <Bot className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">Debate Coach</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your personalised pre-debate briefing
            </p>
          </div>
        </div>

        {loading ? (
          <CoachSkeleton />
        ) : error ? (
          <EmptyState
            icon={Bot}
            title="Brief unavailable"
            description={error}
            actions={[{ label: 'Retry', onClick: load }]}
          />
        ) : data ? (
          <div className="space-y-4">

            {/* ── Debate meta ─────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
            >
              {/* Status + type row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                  data.debate.status === 'live'
                    ? 'text-emerald bg-emerald/10 border-emerald/30'
                    : data.debate.status === 'scheduled'
                    ? 'text-gold bg-gold/10 border-gold/30'
                    : 'text-surface-500 bg-surface-200 border-surface-300',
                )}>
                  {data.debate.status === 'live' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                  )}
                  {data.debate.status === 'scheduled' ? (
                    <>
                      <Clock className="h-3 w-3" />
                      {relativeTime(data.debate.scheduled_at)}
                    </>
                  ) : data.debate.status.toUpperCase()}
                </span>
                <Badge variant="proposed">
                  {TYPE_LABEL[data.debate.type] ?? data.debate.type}
                </Badge>
                {data.debate.topic.category && (
                  <Badge variant="proposed">{data.debate.topic.category}</Badge>
                )}
              </div>

              {/* Title */}
              <h2 className="font-mono text-base font-bold text-white leading-snug">
                {data.debate.title}
              </h2>

              {/* Topic statement */}
              <Link
                href={`/topic/${data.debate.topic.id}`}
                className="flex items-start gap-2 group"
              >
                <Scale className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-surface-200 transition-colors line-clamp-2 leading-relaxed">
                  {data.debate.topic.statement}
                </span>
                <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" />
              </Link>

              {/* Scheduled time */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                <Calendar className="h-3.5 w-3.5" />
                {absoluteTime(data.debate.scheduled_at)}
              </div>

              {/* Vote split */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-for-400 font-bold">{forPct}% FOR</span>
                  <span className="text-surface-600">
                    {data.debate.topic.total_votes.toLocaleString()} platform votes
                  </span>
                  <span className="text-against-400 font-bold">{againstPct}% AGAINST</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-surface-300">
                  <div
                    className="h-full rounded-l-full bg-for-500 transition-all duration-500"
                    style={{ width: `${forPct > 2 ? forPct : 2}%` }}
                  />
                  <div
                    className="h-full rounded-r-full bg-against-500 ml-auto transition-all duration-500"
                    style={{ width: `${againstPct > 2 ? againstPct : 2}%` }}
                  />
                </div>
              </div>

              {/* Your side banner */}
              <div className={cn(
                'flex items-center gap-3 rounded-xl border p-3',
                myCfg.bg, myCfg.border,
              )}>
                <MySideIcon className={cn('h-5 w-5 flex-shrink-0', myCfg.text)} />
                <div>
                  <p className={cn('text-sm font-mono font-bold', myCfg.text)}>
                    You are arguing {myCfg.label}
                  </p>
                  <p className="text-[11px] font-mono text-surface-400 mt-0.5">
                    {data.consensus_note}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── AI Brief ────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl border border-purple/20 bg-purple/5 p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple" />
                <span className="font-mono text-sm font-bold text-white">AI Coaching Brief</span>
                {data.brief?.unavailable && (
                  <span className="text-[10px] font-mono text-surface-500 ml-auto">
                    AI unavailable · platform data only
                  </span>
                )}
              </div>

              {data.brief && !data.brief.unavailable ? (
                <div className="space-y-4">
                  {/* Opening hook */}
                  {data.brief.opening_hook && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-purple mb-2">
                        Opening Hook
                      </p>
                      <blockquote className={cn(
                        'rounded-xl border p-3 text-sm font-mono font-semibold leading-relaxed',
                        myCfg.bg, myCfg.border, myCfg.text,
                      )}>
                        &ldquo;{data.brief.opening_hook}&rdquo;
                      </blockquote>
                    </div>
                  )}

                  {/* Core points */}
                  {data.brief.core_points.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-purple mb-2">
                        Core Points
                      </p>
                      <div className="space-y-2">
                        {data.brief.core_points.map((pt, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2.5 rounded-lg bg-surface-200/60 border border-surface-300/60 p-3"
                          >
                            <CheckCircle2 className={cn('h-4 w-4 flex-shrink-0 mt-0.5', myCfg.text)} />
                            <p className="text-xs font-mono text-surface-300 leading-relaxed">{pt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Anticipate counters */}
                  {data.brief.anticipate.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-against-400 mb-2">
                        Anticipate &amp; Counter
                      </p>
                      <div className="space-y-2">
                        {data.brief.anticipate.map((pt, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2.5 rounded-lg bg-against-500/5 border border-against-500/20 p-3"
                          >
                            <Shield className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-mono text-surface-300 leading-relaxed">{pt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Closing line */}
                  {data.brief.closing_line && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-purple mb-2">
                        Closing Line
                      </p>
                      <blockquote className="rounded-xl border border-surface-400/30 bg-surface-200/60 p-3 text-sm font-mono text-surface-200 italic leading-relaxed">
                        &ldquo;{data.brief.closing_line}&rdquo;
                      </blockquote>
                    </div>
                  )}

                  {/* Strategy tip */}
                  {data.brief.strategy_tip && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-gold/20 bg-gold/5 p-3">
                      <Target className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-mono text-surface-300 leading-relaxed">
                        <span className="text-gold font-bold">Tactic: </span>
                        {data.brief.strategy_tip}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs font-mono text-surface-500 leading-relaxed">
                  AI coaching is based on live platform arguments and debate history. Check back once you have an opponent assigned.
                </p>
              )}
            </motion.div>

            {/* ── Opponent profile ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              <h3 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Your Opponent
              </h3>
              {data.opponent ? (
                <OpponentCard opponent={data.opponent} opponentSide={opponentSide} />
              ) : (
                <div className={cn(
                  'rounded-2xl border p-5 text-center',
                  oppCfg.border, 'bg-surface-100',
                )}>
                  <div className={cn(
                    'flex items-center justify-center h-10 w-10 rounded-full border mx-auto mb-3',
                    oppCfg.bg, oppCfg.border,
                  )}>
                    <Mic className={cn('h-5 w-5', oppCfg.text)} />
                  </div>
                  <p className="font-mono text-sm font-semibold text-white mb-1">
                    No opponent yet
                  </p>
                  <p className="text-xs font-mono text-surface-500">
                    The {oppCfg.label} speaker hasn&apos;t joined yet.
                    Your brief will update automatically.
                  </p>
                </div>
              )}
            </motion.div>

            {/* ── Your strongest arguments ──────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className={cn(
                'font-mono text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2',
                myCfg.text,
              )}>
                <MySideIcon className="h-3.5 w-3.5" />
                Top {myCfg.label} Arguments — Use These
              </h3>
              {data.your_arguments.length > 0 ? (
                <div className="space-y-2">
                  {data.your_arguments.map((a, i) => (
                    <ArgRow key={a.id} arg={a} side={mySide} index={i} />
                  ))}
                </div>
              ) : (
                <div className={cn(
                  'rounded-xl border p-4 text-center text-xs font-mono text-surface-500',
                  myCfg.border, 'bg-surface-100',
                )}>
                  No {myCfg.label} arguments posted yet on this topic.{' '}
                  <Link href={`/topic/${data.debate.topic.id}/argue`} className={cn('underline', myCfg.text)}>
                    Add the first one
                  </Link>
                </div>
              )}
            </motion.div>

            {/* ── Arguments to counter ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
            >
              <h3 className={cn(
                'font-mono text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2',
                oppCfg.text,
              )}>
                <Shield className="h-3.5 w-3.5" />
                Top {oppCfg.label} Arguments — Prepare Counters
              </h3>
              {data.their_arguments.length > 0 ? (
                <div className="space-y-2">
                  {data.their_arguments.map((a, i) => (
                    <ArgRow key={a.id} arg={a} side={opponentSide} index={i} />
                  ))}
                </div>
              ) : (
                <div className={cn(
                  'rounded-xl border p-4 text-center text-xs font-mono text-surface-500',
                  oppCfg.border, 'bg-surface-100',
                )}>
                  No {oppCfg.label} arguments on this topic yet. Good news for you.
                </div>
              )}
            </motion.div>

            {/* ── Quick links ──────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-4"
            >
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-3">
                Deeper Prep
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    href: `/topic/${data.debate.topic.id}/arguments`,
                    icon: ThumbsUp,
                    label: 'All Arguments',
                  },
                  {
                    href: `/topic/${data.debate.topic.id}/stats`,
                    icon: BarChart2,
                    label: 'Topic Stats',
                  },
                  {
                    href: `/prep?topic=${data.debate.topic.id}&side=${mySide}`,
                    icon: Sparkles,
                    label: 'Full Prep Dossier',
                  },
                  {
                    href: `/debate/${params.id}`,
                    icon: Mic,
                    label: 'Go to Debate',
                    highlight: true,
                  },
                ].map(({ href, icon: Icon, label, highlight }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-mono transition-all',
                      highlight
                        ? cn(myCfg.bg, myCfg.border, myCfg.text, 'hover:opacity-80 font-semibold')
                        : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {label}
                    {highlight && <ArrowRight className="h-3 w-3 ml-auto" />}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* ── Refresh ──────────────────────────────────────────────── */}
            <div className="flex justify-center pt-2">
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh brief
              </button>
            </div>

          </div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
