'use client'

/**
 * /monthly — Monthly Civic Digest
 *
 * A platform-wide, month-in-review dashboard showing laws passed, top
 * contributors, category trends, and month-over-month growth. Distinct
 * from /weekly (7-day snapshot) — this captures the full arc of a month:
 * which categories dominated, who earned the month's civic honours, and
 * what the platform's momentum looks like.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart2,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  MonthlyDigestData,
  MonthlyLaw,
  MonthlyArgument,
  MonthlyAward,
  MonthlyCategoryBreakdown,
  MonthlyTopTopic,
} from '@/app/api/monthly/route'

// ── Category colours ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Other:       'text-surface-500',
}

const CAT_BAR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-400',
  Philosophy:  'bg-for-300',
  Culture:     'bg-gold',
  Health:      'bg-against-400',
  Environment: 'bg-emerald',
  Education:   'bg-purple',
  Other:       'bg-surface-500',
}

function catColor(cat: string | null) {
  return CAT_COLOR[cat ?? ''] ?? 'text-surface-500'
}

function catBar(cat: string | null) {
  return CAT_BAR[cat ?? ''] ?? 'bg-surface-500'
}

// ── Role label ─────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debater',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  lawmaker:      'Lawmaker',
  senator:       'Senator',
}

// ── Award config ───────────────────────────────────────────────────────────────

const AWARD_CONFIG: Record<
  MonthlyAward['kind'],
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  legislator: { icon: Gavel,         color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  orator:     { icon: MessageSquare, color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  voter:      { icon: Vote,          color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

// ── Delta badge ────────────────────────────────────────────────────────────────

function DeltaBadge({
  current,
  previous,
  unit = '',
}: {
  current: number
  previous: number
  unit?: string
}) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const isUp = pct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold',
        isUp ? 'text-emerald' : 'text-against-400',
      )}
    >
      {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(pct)}%{unit ? ` ${unit}` : ''} vs last month
    </span>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function MonthlyLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12 space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Laws */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Law card ───────────────────────────────────────────────────────────────────

function LawCard({ law, idx }: { law: MonthlyLaw; idx: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const date = new Date(law.established_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/topic/${law.id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border transition-all group',
          'bg-surface-100 border-surface-300 hover:border-for-500/40 hover:bg-surface-200',
        )}
      >
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-for-600/20 flex items-center justify-center mt-0.5">
          <Gavel className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-2 group-hover:text-for-300 transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {law.category && (
              <span className={cn('text-[11px] font-mono', catColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-500">{date}</span>
            {law.total_votes != null && (
              <span className="text-[11px] font-mono text-surface-600">
                {law.total_votes.toLocaleString()} votes
              </span>
            )}
          </div>
          {/* Vote bar */}
          <div className="mt-2 h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-surface-600 mt-0.5">
            {forPct}% FOR · {100 - forPct}% AGAINST
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

// ── Award card ─────────────────────────────────────────────────────────────────

function AwardCard({ award, idx }: { award: MonthlyAward; idx: number }) {
  const cfg = AWARD_CONFIG[award.kind]
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.07 }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-3',
        cfg.bg,
        cfg.border,
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', cfg.bg, cfg.border, 'border')}>
          <Icon className={cn('h-3.5 w-3.5', cfg.color)} aria-hidden="true" />
        </div>
        <p className={cn('text-[11px] font-mono uppercase tracking-widest font-semibold', cfg.color)}>
          {award.label}
        </p>
      </div>

      <Link href={`/profile/${award.user.username}`} className="flex items-center gap-3 group">
        <Avatar
          src={award.user.avatar_url}
          fallback={award.user.display_name ?? award.user.username}
          size="md"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
            {award.user.display_name ?? award.user.username}
          </p>
          <p className="text-[11px] text-surface-500 font-mono">
            {ROLE_LABEL[award.user.role] ?? award.user.role}
          </p>
        </div>
      </Link>

      <div className="pt-1 border-t border-surface-400/20">
        <p className={cn('text-2xl font-mono font-bold', cfg.color)}>
          {award.stat_value.toLocaleString()}
        </p>
        <p className="text-[11px] font-mono text-surface-500">{award.stat_label}</p>
      </div>

      <p className="text-[11px] font-mono text-surface-500 -mt-1">{award.description}</p>
    </motion.div>
  )
}

// ── Argument card ──────────────────────────────────────────────────────────────

function ArgumentCard({ arg, idx }: { arg: MonthlyArgument; idx: number }) {
  const isFor = arg.side === 'blue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="p-4 rounded-xl border bg-surface-100 border-surface-300"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full mt-0.5',
            isFor ? 'bg-for-600/20' : 'bg-against-600/20',
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden="true" />
          ) : (
            <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-200 line-clamp-3">{arg.content}</p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {arg.author && (
              <Link
                href={`/profile/${arg.author.username}`}
                className="flex items-center gap-1.5 group"
              >
                <Avatar
                  src={arg.author.avatar_url}
                  fallback={arg.author.display_name ?? arg.author.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
                  @{arg.author.username}
                </span>
              </Link>
            )}
            <Link
              href={`/topic/${arg.topic_id}`}
              className="text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors truncate max-w-[180px]"
            >
              {arg.topic_statement}
            </Link>
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500 ml-auto">
              <Zap className="h-3 w-3 text-gold" aria-hidden="true" />
              {arg.upvotes} upvotes
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Category bar ───────────────────────────────────────────────────────────────

function CategoryBar({
  breakdown,
  maxVotes,
}: {
  breakdown: MonthlyCategoryBreakdown
  maxVotes: number
}) {
  const pct = maxVotes > 0 ? (breakdown.votes / maxVotes) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <p className={cn('text-xs font-mono w-24 flex-shrink-0 truncate', catColor(breakdown.category))}>
        {breakdown.category}
      </p>
      <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', catBar(breakdown.category))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] font-mono text-surface-500 w-20 text-right flex-shrink-0">
        {breakdown.votes.toLocaleString()} votes
      </p>
      {breakdown.laws > 0 && (
        <span className="text-[10px] font-mono text-gold ml-1 flex-shrink-0">
          {breakdown.laws} law{breakdown.laws !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ── Topic row ──────────────────────────────────────────────────────────────────

function TopicRow({ topic, idx }: { topic: MonthlyTopTopic; idx: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-200 transition-colors group"
      >
        <span className="text-sm font-mono text-surface-600 w-5 text-right flex-shrink-0">
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-200 line-clamp-1 group-hover:text-white transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {topic.category && (
              <span className={cn('text-[10px] font-mono', catColor(topic.category))}>
                {topic.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes total
            </span>
            {topic.month_votes > 0 && (
              <span className="text-[10px] font-mono text-emerald">
                +{topic.month_votes.toLocaleString()} this month
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-mono text-for-400">{forPct}%</span>
          <div className="w-12 h-1.5 rounded-full bg-against-700 overflow-hidden">
            <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MonthlyPage() {
  const [data, setData] = useState<MonthlyDigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/monthly', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const h = data?.highlight

  // Month-over-month deltas
  const votesDelta = h && h.total_votes_last_month > 0
    ? Math.round(((h.total_votes_this_month - h.total_votes_last_month) / h.total_votes_last_month) * 100)
    : null
  const lawsDelta = h && h.new_laws_last_month > 0
    ? Math.round(((h.new_laws_this_month - h.new_laws_last_month) / h.new_laws_last_month) * 100)
    : null

  const maxCatVotes = Math.max(...(data?.category_breakdown.map((c) => c.votes) ?? [0]))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12" id="main-content">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <CalendarDays className="h-6 w-6 text-gold" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Monthly Digest</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {data?.month_name ?? 'Loading…'}
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh monthly data"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <MonthlyLoading />
        ) : !data ? (
          <EmptyState
            icon={CalendarDays}
            title="Digest unavailable"
            description="Could not load the monthly digest. Please try again."
          />
        ) : (
          <div className="space-y-10">

            {/* ── Stat cards ─────────────────────────────────────────────── */}
            <section aria-label="Monthly highlights">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Votes */}
                <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Vote className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-for-400">Votes</p>
                  </div>
                  <AnimatedNumber
                    value={h?.total_votes_this_month ?? 0}
                    className="text-2xl font-mono font-bold text-white"
                  />
                  {votesDelta !== null && (
                    <div className="mt-1 flex items-center gap-1">
                      {votesDelta >= 0 ? (
                        <ArrowUp className="h-3 w-3 text-emerald" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-against-400" />
                      )}
                      <span className={cn('text-[10px] font-mono', votesDelta >= 0 ? 'text-emerald' : 'text-against-400')}>
                        {Math.abs(votesDelta)}% vs last month
                      </span>
                    </div>
                  )}
                </div>

                {/* Laws */}
                <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gold">Laws</p>
                  </div>
                  <AnimatedNumber
                    value={h?.new_laws_this_month ?? 0}
                    className="text-2xl font-mono font-bold text-white"
                  />
                  {lawsDelta !== null && (
                    <div className="mt-1 flex items-center gap-1">
                      {lawsDelta >= 0 ? (
                        <ArrowUp className="h-3 w-3 text-emerald" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-against-400" />
                      )}
                      <span className={cn('text-[10px] font-mono', lawsDelta >= 0 ? 'text-emerald' : 'text-against-400')}>
                        {Math.abs(lawsDelta)}% vs last month
                      </span>
                    </div>
                  )}
                </div>

                {/* Arguments */}
                <div className="rounded-2xl border border-purple/30 bg-purple/5 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-purple">Arguments</p>
                  </div>
                  <AnimatedNumber
                    value={h?.total_arguments_this_month ?? 0}
                    className="text-2xl font-mono font-bold text-white"
                  />
                  <DeltaBadge
                    current={h?.total_arguments_this_month ?? 0}
                    previous={h?.total_arguments_last_month ?? 0}
                  />
                </div>

                {/* Active topics */}
                <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Flame className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-emerald">Active</p>
                  </div>
                  <AnimatedNumber
                    value={h?.active_topics ?? 0}
                    className="text-2xl font-mono font-bold text-white"
                  />
                  <p className="text-[10px] font-mono text-surface-500 mt-1">open topics</p>
                </div>
              </div>
            </section>

            {/* ── Awards ─────────────────────────────────────────────────── */}
            {data.awards.length > 0 && (
              <section aria-label="Monthly awards">
                <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
                  Civic Honours
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {data.awards.map((award, i) => (
                    <AwardCard key={award.kind} award={award} idx={i} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Laws established ────────────────────────────────────────── */}
            <section aria-label="Laws established this month">
              <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Gavel className="h-4 w-4 text-for-400" aria-hidden="true" />
                Laws Established
                <Badge variant="active" className="ml-1">{data.new_laws.length}</Badge>
              </h2>

              {data.new_laws.length === 0 ? (
                <EmptyState
                  icon={Gavel}
                  title="No laws this month yet"
                  description="Topics are still working their way through the pipeline."
                />
              ) : (
                <div className="space-y-2">
                  {data.new_laws.map((law, i) => (
                    <LawCard key={law.id} law={law} idx={i} />
                  ))}
                </div>
              )}

              {data.new_laws.length > 0 && (
                <Link
                  href="/law"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  View full Law Codex <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </section>

            {/* ── Hottest topics ──────────────────────────────────────────── */}
            {data.top_topics.length > 0 && (
              <section aria-label="Most active topics this month">
                <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-purple" aria-hidden="true" />
                  Most Active Topics
                </h2>
                <div className="rounded-2xl border border-surface-300 bg-surface-100 divide-y divide-surface-300 overflow-hidden">
                  {data.top_topics.map((topic, i) => (
                    <TopicRow key={topic.id} topic={topic} idx={i} />
                  ))}
                </div>
                <Link
                  href="/trending"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-purple transition-colors"
                >
                  See all trending topics <ArrowRight className="h-3 w-3" />
                </Link>
              </section>
            )}

            {/* ── Top arguments ───────────────────────────────────────────── */}
            {data.top_arguments.length > 0 && (
              <section aria-label="Top arguments this month">
                <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                  Best Arguments
                </h2>
                <div className="space-y-3">
                  {data.top_arguments.map((arg, i) => (
                    <ArgumentCard key={arg.id} arg={arg} idx={i} />
                  ))}
                </div>
                <Link
                  href="/arguments/trending"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
                >
                  Browse trending arguments <ArrowRight className="h-3 w-3" />
                </Link>
              </section>
            )}

            {/* ── Category breakdown ──────────────────────────────────────── */}
            {data.category_breakdown.length > 0 && (
              <section aria-label="Category breakdown">
                <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald" aria-hidden="true" />
                  Category Activity
                </h2>
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
                  {data.category_breakdown.map((cat) => (
                    <CategoryBar key={cat.category} breakdown={cat} maxVotes={maxCatVotes} />
                  ))}
                </div>
                {h?.most_debated_category && (
                  <p className="mt-3 text-xs font-mono text-surface-500">
                    Dominant category:{' '}
                    <span className={catColor(h.most_debated_category)}>
                      {h.most_debated_category}
                    </span>
                  </p>
                )}
              </section>
            )}

            {/* ── Hottest topic callout ────────────────────────────────────── */}
            {h?.hottest_topic && (
              <section aria-label="Topic of the month">
                <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="h-4 w-4 text-against-400" aria-hidden="true" />
                    <p className="text-[11px] font-mono uppercase tracking-widest text-against-400 font-semibold">
                      Most Voted Topic of the Month
                    </p>
                  </div>
                  <Link href={`/topic/${h.hottest_topic.id}`} className="group">
                    <p className="text-base font-semibold text-white group-hover:text-against-300 transition-colors">
                      {h.hottest_topic.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {h.hottest_topic.category && (
                        <span className={cn('text-xs font-mono', catColor(h.hottest_topic.category))}>
                          {h.hottest_topic.category}
                        </span>
                      )}
                      <span className="text-xs font-mono text-surface-500">
                        {h.hottest_topic.total_votes.toLocaleString()} votes total
                      </span>
                    </div>
                  </Link>
                </div>
              </section>
            )}

            {/* ── Footer links ─────────────────────────────────────────────── */}
            <section className="flex flex-wrap gap-3 pt-4 border-t border-surface-300">
              {[
                { href: '/weekly',     label: 'Weekly Digest',    icon: BookOpen },
                { href: '/law',        label: 'Law Codex',        icon: Gavel },
                { href: '/leaderboard', label: 'Leaderboard',     icon: Trophy },
                { href: '/analytics',  label: 'Analytics',        icon: BarChart2 },
                { href: '/trending',   label: 'Trending Topics',  icon: Flame },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </section>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
