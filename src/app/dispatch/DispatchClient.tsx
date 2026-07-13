'use client'

/**
 * /dispatch — The Civic Dispatch
 *
 * An official-gazette-style daily bulletin of civic events. Think of it
 * as a formal government communiqué: authoritative, structured, and issued
 * fresh each day. Distinct from:
 *
 *   /daily        — personalised briefing for the signed-in user
 *   /trending     — algorithmic trending feed
 *   /digest       — weekly narrative roundup
 *   /hansard      — parliamentary transcript archive
 *   /briefing     — AI-generated narrative summary
 *
 * The Dispatch is the OFFICIAL platform record of what happened today:
 * new laws passed, debates in the next 24h, near-consensus topics, and
 * live platform statistics.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  DispatchData,
  DispatchLaw,
  DispatchTopic,
  DispatchDebate,
  DispatchArgument,
} from '@/app/api/dispatch/route'

// ─── Category colour map ──────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

function catColor(cat: string | null) {
  return cat
    ? (CAT_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-500/30' })
    : { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-500/30' }
}

// ─── Role colour map ──────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  person:        'text-surface-500',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  elder:         'text-gold',
  lawmaker:      'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function debateTimeLabel(scheduledAt: string, hoursUntil: number | null): string {
  if (hoursUntil === null) return 'Upcoming'
  if (hoursUntil < 1) return 'Starting soon'
  if (hoursUntil < 2) return 'In ~1 hour'
  return `In ${hoursUntil}h`
}

function formatVoteBar(bluePct: number) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return { forPct, againstPct }
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  sublabel,
  count,
  accentClass,
  borderClass,
}: {
  icon: typeof Gavel
  label: string
  sublabel?: string
  count?: number
  accentClass: string
  borderClass: string
}) {
  return (
    <div className={cn('flex items-center gap-3 pb-3 mb-4 border-b', borderClass)}>
      <Icon className={cn('h-4 w-4 flex-shrink-0', accentClass)} />
      <div className="flex-1 min-w-0">
        <h2 className={cn('font-mono text-xs font-bold uppercase tracking-widest', accentClass)}>
          {label}
        </h2>
        {sublabel && (
          <p className="text-[11px] text-surface-500 font-mono mt-0.5">{sublabel}</p>
        )}
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn(
          'flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
          accentClass,
          borderClass,
          'bg-transparent',
        )}>
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: DispatchLaw }) {
  const { forPct } = formatVoteBar(law.blue_pct)
  const c = catColor(law.category)
  return (
    <Link
      href={`/law/${law.id}`}
      className="group block p-3 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 hover:bg-gold/8 transition-all"
    >
      <div className="flex items-start gap-2 mb-2">
        <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
        <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold/90 transition-colors">
          {law.statement}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {law.category && (
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', c.text, c.bg, c.border)}>
            {law.category}
          </span>
        )}
        {law.scope && (
          <span className="text-[10px] font-mono text-surface-500 border border-surface-500/30 px-1.5 py-0.5 rounded">
            {law.scope}
          </span>
        )}
        <span className="text-[10px] font-mono text-for-400 ml-auto">
          {forPct}% FOR · {law.total_votes.toLocaleString()} votes
        </span>
      </div>
    </Link>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, variant }: { topic: DispatchTopic; variant: 'consensus' | 'contested' | 'closing' }) {
  const { forPct, againstPct } = formatVoteBar(topic.blue_pct)
  const c = catColor(topic.category)
  const isFor = forPct >= 50

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-start gap-2.5 py-2.5 border-b border-surface-300/40 last:border-0 hover:bg-surface-200/30 -mx-3 px-3 rounded-lg transition-colors"
    >
      {/* Vote indicator dot */}
      <div className="flex-shrink-0 mt-1">
        {variant === 'closing' ? (
          <Clock className="h-3.5 w-3.5 text-against-400" />
        ) : variant === 'consensus' ? (
          <CheckCircle2 className={cn('h-3.5 w-3.5', isFor ? 'text-for-400' : 'text-against-400')} />
        ) : (
          <Scale className="h-3.5 w-3.5 text-purple" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 mb-1.5 group-hover:text-surface-700 transition-colors">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1 rounded-full bg-surface-400/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className={cn('text-[10px] font-mono font-bold flex-shrink-0', isFor ? 'text-for-400' : 'text-against-400')}>
            {isFor ? `${forPct}% FOR` : `${againstPct}% AGAINST`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {topic.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', c.text, c.bg, c.border)}>
              {topic.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {topic.total_votes.toLocaleString()} votes
          </span>
          {variant === 'closing' && topic.hours_until_close !== undefined && (
            <span className="text-[10px] font-mono text-against-400 font-bold ml-auto">
              {topic.hours_until_close < 1 ? '&lt;1h left' : `${topic.hours_until_close}h left`}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1 group-hover:text-white transition-colors" />
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: DispatchDebate }) {
  const c = catColor(debate.topic_category)
  const formatType = (t: string) => {
    switch (t) {
      case 'quick': return 'Quick — 15 min'
      case 'grand': return 'Grand — 45 min'
      case 'tribunal': return 'Tribunal — 60 min'
      default: return t
    }
  }
  const timeStr = new Date(debate.scheduled_at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }) + ' UTC'

  return (
    <Link
      href={`/debate/${debate.id}`}
      className="group block p-3 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 hover:bg-purple/8 transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <Mic className="h-3.5 w-3.5 text-purple flex-shrink-0" />
        <span className="text-[10px] font-mono text-purple font-bold uppercase tracking-wide">
          {debateTimeLabel(debate.scheduled_at, debate.hours_until_start)}
        </span>
        <span className="text-[10px] font-mono text-surface-500 ml-auto">{timeStr}</span>
      </div>
      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-2 group-hover:text-purple/90 transition-colors">
        {debate.topic_statement}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {debate.topic_category && (
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', c.text, c.bg, c.border)}>
            {debate.topic_category}
          </span>
        )}
        <span className="text-[10px] font-mono text-surface-500">{formatType(debate.debate_type)}</span>
        {debate.participant_count > 0 && (
          <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1 ml-auto">
            <Users className="h-2.5 w-2.5" />
            {debate.participant_count}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: DispatchArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/topic/${arg.topic_id}#arg-${arg.id}`}
      className="group block p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
        )}
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', isFor ? 'text-for-400' : 'text-against-400')}>
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="text-[10px] font-mono text-surface-600 ml-auto">
          ↑ {arg.upvotes}
        </span>
      </div>
      <p className="text-[12px] text-surface-700 leading-relaxed line-clamp-3 mb-2 group-hover:text-white transition-colors">
        &ldquo;{arg.content}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <span className={cn('text-[10px] font-semibold', ROLE_COLOR[arg.author_role] ?? 'text-surface-500')}>
          {arg.author_display_name || arg.author_username}
        </span>
        <span className="text-[10px] text-surface-600 truncate">
          on: {arg.topic_statement.length > 50 ? arg.topic_statement.slice(0, 50) + '…' : arg.topic_statement}
        </span>
      </div>
    </Link>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Vote; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40">
      <Icon className={cn('h-4 w-4', color)} />
      <span className={cn('font-mono text-lg font-bold', color)}>
        {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
      <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DispatchSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-8">
      {/* Header */}
      <div className="text-center border-b border-surface-300 pb-6">
        <Skeleton className="h-8 w-48 mx-auto mb-2" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
      {/* Sections */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DispatchClient() {
  const [data, setData] = useState<DispatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dispatch', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load dispatch')
      const json = await res.json() as DispatchData
      setData(json)
    } catch {
      setError('Could not load the Civic Dispatch. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleCopyLink() {
    navigator.clipboard.writeText('https://lobby.market/dispatch').catch(() => {})
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  const isEmpty =
    data &&
    data.newLaws.length === 0 &&
    data.nearConsensus.length === 0 &&
    data.contested.length === 0 &&
    data.closingSoon.length === 0 &&
    data.upcomingDebates.length === 0 &&
    data.topArguments.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* ── Official Header ─────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          {/* Decorative rule */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-400 to-surface-300" />
            <Scroll className="h-4 w-4 text-surface-400" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-surface-400 to-surface-300" />
          </div>

          <h1 className="font-mono text-3xl font-bold tracking-widest text-white uppercase mb-1">
            Civic Dispatch
          </h1>
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-[0.2em] mb-3">
            Official Bulletin · Lobby Market
          </p>

          {data && (
            <p className="text-[11px] font-mono text-surface-600 mb-4">
              {data.edition}
            </p>
          )}
          {loading && !data && <Skeleton className="h-4 w-72 mx-auto mb-4" />}

          {/* Divider rule */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-surface-300" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-1 w-1 rounded-full bg-surface-400" />
              ))}
            </div>
            <div className="flex-1 h-px bg-surface-300" />
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh dispatch"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="Copy link to dispatch"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald" />
                <span className="text-emerald">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Share
              </>
            )}
          </button>
        </div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-against-500/10 border border-against-500/30 mb-6">
            <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" />
            <p className="text-sm text-against-400">{error}</p>
            <button
              onClick={load}
              className="ml-auto text-xs font-mono text-against-400 hover:text-white transition-colors underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && !data && <DispatchSkeleton />}

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-8"
          >
            <StatTile label="Votes today" value={data.stats.votes_cast_today} icon={Vote} color="text-for-400" />
            <StatTile label="Arguments" value={data.stats.arguments_posted_today} icon={MessageSquare} color="text-purple" />
            <StatTile label="New topics" value={data.stats.new_topics_today} icon={Zap} color="text-emerald" />
            <StatTile label="Debates" value={data.stats.debates_today} icon={Mic} color="text-against-400" />
            <StatTile label="Laws today" value={data.stats.laws_established_today} icon={Gavel} color="text-gold" />
          </motion.div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!loading && data && isEmpty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Scroll className="h-10 w-10 text-surface-400 mx-auto mb-3" />
            <p className="font-mono text-surface-500 text-sm">The Lobby is quiet today.</p>
            <p className="text-xs text-surface-600 mt-1">No major civic events to report.</p>
            <Link
              href="/topics"
              className="inline-flex items-center gap-1.5 mt-4 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Browse active topics
              <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        )}

        {data && !isEmpty && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >

              {/* ── Section 1: New Laws ─────────────────────────────────────── */}
              {data.newLaws.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Gavel}
                    label="Laws Established"
                    sublabel="Community consensus — last 48 hours"
                    count={data.newLaws.length}
                    accentClass="text-gold"
                    borderClass="border-gold/30"
                  />
                  <div className="space-y-2">
                    {data.newLaws.map((law) => (
                      <LawCard key={law.id} law={law} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Section 2: Near Consensus ───────────────────────────────── */}
              {data.nearConsensus.length > 0 && (
                <section>
                  <SectionHeader
                    icon={TrendingUp}
                    label="Approaching Consensus"
                    sublabel="Strong majorities — potential laws in formation"
                    count={data.nearConsensus.length}
                    accentClass="text-for-400"
                    borderClass="border-for-500/30"
                  />
                  <div className="rounded-xl border border-surface-300/50 overflow-hidden">
                    <div className="divide-y divide-surface-300/40 px-3">
                      {data.nearConsensus.map((topic) => (
                        <TopicRow key={topic.id} topic={topic} variant="consensus" />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Section 3: Closing Soon ─────────────────────────────────── */}
              {data.closingSoon.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Clock}
                    label="Vote Closes Soon"
                    sublabel="Final voting windows — cast your ballot now"
                    count={data.closingSoon.length}
                    accentClass="text-against-400"
                    borderClass="border-against-500/30"
                  />
                  <div className="rounded-xl border border-surface-300/50 overflow-hidden">
                    <div className="divide-y divide-surface-300/40 px-3">
                      {data.closingSoon.map((topic) => (
                        <TopicRow key={topic.id} topic={topic} variant="closing" />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Section 4: Contested ────────────────────────────────────── */}
              {data.contested.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Scale}
                    label="Contested Debates"
                    sublabel="Near-deadlock topics — the community is divided"
                    count={data.contested.length}
                    accentClass="text-purple"
                    borderClass="border-purple/30"
                  />
                  <div className="rounded-xl border border-surface-300/50 overflow-hidden">
                    <div className="divide-y divide-surface-300/40 px-3">
                      {data.contested.map((topic) => (
                        <TopicRow key={topic.id} topic={topic} variant="contested" />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Section 5: Upcoming Debates ─────────────────────────────── */}
              {data.upcomingDebates.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Calendar}
                    label="Debates — Next 24 Hours"
                    sublabel="Live debate sessions scheduled today"
                    count={data.upcomingDebates.length}
                    accentClass="text-purple"
                    borderClass="border-purple/30"
                  />
                  <div className="space-y-2">
                    {data.upcomingDebates.map((debate) => (
                      <DebateCard key={debate.id} debate={debate} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Section 6: Top Arguments ─────────────────────────────────── */}
              {data.topArguments.length > 0 && (
                <section>
                  <SectionHeader
                    icon={MessageSquare}
                    label="Notable Arguments"
                    sublabel="Highest-upvoted civic arguments posted today"
                    count={data.topArguments.length}
                    accentClass="text-emerald"
                    borderClass="border-emerald/30"
                  />
                  <div className="space-y-2">
                    {data.topArguments.map((arg) => (
                      <ArgumentCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Footer rule ─────────────────────────────────────────────── */}
              <div className="pt-4 border-t border-surface-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-surface-300 to-transparent" />
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-1 w-1 rounded-full bg-surface-400" />
                    ))}
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-surface-300 to-transparent" />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-mono text-surface-600">
                    Issued at{' '}
                    {data.issued_at
                      ? new Date(data.issued_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                          hour12: false,
                        }) + ' UTC'
                      : '—'}
                  </p>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/trending"
                      className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Trending
                    </Link>
                    <Link
                      href="/topics"
                      className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      All Topics
                    </Link>
                    <Link
                      href="/laws"
                      className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Law Codex
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
