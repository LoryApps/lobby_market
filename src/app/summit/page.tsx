'use client'

/**
 * /summit — The Civic Summit
 *
 * A quarterly awards and retrospective for Lobby Market — celebrating the
 * platform's most impactful contributors, landmark laws, and civic moments
 * from the current quarter.
 *
 * Distinct from /records (all-time), /spotlight (weekly), /wrapped (yearly),
 * and /leaderboard (ongoing rankings). The Summit is a seasonal ceremony.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SummitData, SummitAwardee, SummitLaw, SummitTopic } from '@/app/api/summit/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    economy: 'text-gold',
    healthcare: 'text-emerald',
    environment: 'text-emerald',
    education: 'text-for-400',
    'foreign policy': 'text-purple',
    justice: 'text-against-400',
    technology: 'text-for-300',
    housing: 'text-gold',
    immigration: 'text-purple',
    defense: 'text-against-400',
  }
  return map[(cat ?? '').toLowerCase()] ?? 'text-surface-400'
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  accent = 'text-gold',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  accent?: string
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0', 'bg-surface-200 border-surface-300')}>
        <Icon className={cn('h-5 w-5', accent)} />
      </div>
      <div>
        <h2 className={cn('font-mono text-lg font-bold', accent)}>{title}</h2>
        {subtitle && <p className="font-mono text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Award card ───────────────────────────────────────────────────────────────

const AWARD_META: Record<
  'mostVotes' | 'grandOrator' | 'risingClout',
  {
    title: string
    icon: React.ComponentType<{ className?: string }>
    accent: string
    border: string
    bg: string
    medal: string
    description: string
  }
> = {
  mostVotes: {
    title: "The People's Voice",
    icon: Vote,
    accent: 'text-for-400',
    border: 'border-for-500/30',
    bg: 'bg-for-600/5',
    medal: '🗳️',
    description: 'Most votes cast this quarter',
  },
  grandOrator: {
    title: 'The Grand Orator',
    icon: MessageSquare,
    accent: 'text-gold',
    border: 'border-gold/30',
    bg: 'bg-gold/5',
    medal: '🏆',
    description: 'Most argument upvotes earned',
  },
  risingClout: {
    title: 'The Civic Champion',
    icon: Crown,
    accent: 'text-purple',
    border: 'border-purple/30',
    bg: 'bg-purple/5',
    medal: '👑',
    description: 'Highest clout on the platform',
  },
}

function AwardCard({
  type,
  awardee,
  index,
}: {
  type: keyof typeof AWARD_META
  awardee: SummitAwardee | null
  index: number
}) {
  const meta = AWARD_META[type]
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-4',
        meta.bg,
        meta.border
      )}
    >
      {/* Award badge */}
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider', meta.accent)}>
          <Icon className="h-3.5 w-3.5" />
          {meta.title}
        </div>
        <span className="text-xl">{meta.medal}</span>
      </div>

      {awardee ? (
        <>
          {/* Winner */}
          <Link href={`/profile/${awardee.username}`} className="flex items-center gap-3 group">
            <Avatar
              src={awardee.avatar_url}
              fallback={awardee.display_name ?? awardee.username}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-mono font-bold text-white text-sm truncate group-hover:text-for-300 transition-colors">
                {awardee.display_name ?? awardee.username}
              </p>
              <p className="font-mono text-xs text-surface-500 truncate">
                @{awardee.username}
              </p>
            </div>
          </Link>

          {/* Metric */}
          <div className={cn('rounded-xl border px-4 py-3 text-center', meta.border)}>
            <p className={cn('font-mono text-2xl font-bold tabular-nums', meta.accent)}>
              <AnimatedNumber value={awardee.value} />
            </p>
            <p className="font-mono text-xs text-surface-500 mt-0.5">{awardee.label}</p>
          </div>

          {/* Description */}
          <p className="font-mono text-xs text-surface-500">{meta.description}</p>
        </>
      ) : (
        <div className="py-6 text-center">
          <p className="font-mono text-sm text-surface-600">No data yet</p>
          <p className="font-mono text-xs text-surface-600 mt-1">
            The quarter is still young — cast your votes and write arguments to claim this award.
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, index }: { law: SummitLaw; index: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index }}
    >
      <Link
        href={`/law/${law.id}`}
        className="flex items-start gap-4 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-emerald/40 hover:bg-emerald/5 transition-all group"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/30 flex-shrink-0 mt-0.5">
          <Gavel className="h-4 w-4 text-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {law.category && (
              <span className={cn('font-mono text-xs capitalize', categoryColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="font-mono text-xs text-surface-500">
              {law.total_votes.toLocaleString()} votes · {forPct}% for
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-emerald flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Hot contest card ─────────────────────────────────────────────────────────

function HotContestCard({ topic }: { topic: SummitTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <Link href={`/topic/${topic.id}`} className="block group">
      <div className="rounded-2xl bg-surface-100 border border-against-500/20 hover:border-against-500/40 transition-all p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-against-400" />
          <span className="font-mono text-xs font-semibold text-against-400 uppercase tracking-wider">
            Most Contested
          </span>
          {topic.category && (
            <span className={cn('ml-auto font-mono text-xs capitalize', categoryColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>

        <p className="font-mono text-base font-bold text-white leading-snug mb-4 group-hover:text-against-300 transition-colors">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-for-400 font-semibold">{forPct}% For</span>
            <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400 font-semibold">{againstPct}% Against</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
            <div
              className="h-full bg-for-500 transition-all duration-700"
              style={{ width: `${forPct}%` }}
            />
            <div className="h-full flex-1 bg-against-500" />
          </div>
        </div>

        <p className="font-mono text-xs text-surface-500 mt-3">
          {Math.abs(forPct - 50) < 5
            ? 'Near-perfect deadlock — less than 5% separates each side'
            : `Only ${Math.abs(forPct - 50)}% separates the sides`}
        </p>
      </div>
    </Link>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-2 text-center">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300')}>
        <Icon className={cn('h-4 w-4', accent)} />
      </div>
      <p className={cn('font-mono text-2xl font-bold tabular-nums', accent)}>
        <AnimatedNumber value={value} />
      </p>
      <p className="font-mono text-xs text-surface-500">{label}</p>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SummitSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-8 space-y-3">
        <Skeleton className="h-4 w-24 mx-auto" />
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-5 w-48 mx-auto" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-9 w-9 rounded-xl mx-auto" />
            <Skeleton className="h-7 w-16 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>

      {/* Awards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SummitPage() {
  const [data, setData] = useState<SummitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/summit', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load summit data')
      const json: SummitData = await res.json()
      setData(json)
    } catch {
      setError('Could not load the Civic Summit. Try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const quarterColors: Record<number, { accent: string; ring: string; bg: string; border: string }> = {
    1: { accent: 'text-for-400', ring: 'ring-for-500/20', bg: 'bg-for-600/5', border: 'border-for-500/20' },
    2: { accent: 'text-emerald', ring: 'ring-emerald/20', bg: 'bg-emerald/5', border: 'border-emerald/20' },
    3: { accent: 'text-gold', ring: 'ring-gold/20', bg: 'bg-gold/5', border: 'border-gold/20' },
    4: { accent: 'text-purple', ring: 'ring-purple/20', bg: 'bg-purple/5', border: 'border-purple/20' },
  }
  const qc = quarterColors[data?.quarter.q ?? 2]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Summit</h1>
              <p className="font-mono text-sm text-surface-500 mt-0.5">
                {data ? `${data.quarter.label} · Platform Awards` : 'Quarterly platform awards'}
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all text-xs font-mono disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <SummitSkeleton />
        ) : error ? (
          <EmptyState
            icon={Trophy}
            iconColor="text-surface-500"
            title="Summit unavailable"
            description={error}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="summit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >

              {/* ── Hero banner ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={cn(
                  'rounded-3xl border p-8 text-center relative overflow-hidden',
                  qc.bg, qc.border
                )}
              >
                {/* Ambient glow */}
                <div className={cn('absolute inset-0 opacity-10 blur-3xl pointer-events-none', qc.bg)} />

                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-300/60 border border-surface-400/30 text-xs font-mono text-surface-400 mb-2">
                    <Sparkles className="h-3 w-3" />
                    Quarterly Awards Ceremony
                  </div>

                  <h2 className={cn('font-mono text-4xl font-bold tracking-tight', qc.accent)}>
                    {data.quarter.label}
                  </h2>
                  <p className="font-mono text-lg text-white font-medium">
                    The Civic Summit
                  </p>
                  <p className="font-mono text-sm text-surface-400 max-w-sm mx-auto">
                    Celebrating the platform&apos;s top voices, landmark laws, and civic moments this quarter.
                  </p>
                </div>
              </motion.div>

              {/* ── Quarter stats ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <SectionHeading
                  icon={BarChart2}
                  title="Quarter in Numbers"
                  subtitle={`What the Lobby achieved in ${data.quarter.label}`}
                  accent="text-for-400"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatTile icon={Vote} label="Votes cast" value={data.totals.votes} accent="text-for-400" />
                  <StatTile icon={MessageSquare} label="Arguments" value={data.totals.arguments} accent="text-gold" />
                  <StatTile icon={Gavel} label="Laws passed" value={data.totals.laws} accent="text-emerald" />
                  <StatTile icon={TrendingUp} label="New topics" value={data.totals.topics} accent="text-purple" />
                  <StatTile icon={Users} label="New citizens" value={data.totals.newUsers} accent="text-for-300" />
                  <StatTile icon={Zap} label="Debates held" value={data.totals.debates} accent="text-against-400" />
                </div>
              </motion.div>

              {/* ── Awards ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <SectionHeading
                  icon={Trophy}
                  title="Summit Awards"
                  subtitle="Recognizing the most impactful contributors this quarter"
                  accent="text-gold"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <AwardCard type="mostVotes" awardee={data.awards.mostVotes} index={0} />
                  <AwardCard type="grandOrator" awardee={data.awards.grandOrator} index={1} />
                  <AwardCard type="risingClout" awardee={data.awards.risingClout} index={2} />
                </div>
              </motion.div>

              {/* ── Top argument ── */}
              {data.topArgument && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <SectionHeading
                    icon={Star}
                    title="Argument of the Quarter"
                    subtitle="The most-upvoted argument from this quarter"
                    accent="text-gold"
                  />
                  <div className="rounded-2xl bg-surface-100 border border-gold/30 bg-gold/5 p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0 mt-0.5',
                          data.topArgument.side === 'blue'
                            ? 'bg-for-600/10 border-for-500/30'
                            : 'bg-against-600/10 border-against-500/30'
                        )}
                      >
                        <ThumbsUp
                          className={cn(
                            'h-4 w-4',
                            data.topArgument.side === 'blue' ? 'text-for-400' : 'text-against-400'
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-white leading-relaxed line-clamp-4">
                          &ldquo;{data.topArgument.content}&rdquo;
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          {data.topArgument.author && (
                            <Link
                              href={`/profile/${data.topArgument.author.username}`}
                              className="flex items-center gap-2 group"
                            >
                              <Avatar
                                src={data.topArgument.author.avatar_url}
                                fallback={data.topArgument.author.display_name ?? data.topArgument.author.username}
                                size="xs"
                              />
                              <span className="font-mono text-xs text-surface-400 group-hover:text-white transition-colors">
                                {data.topArgument.author.display_name ?? data.topArgument.author.username}
                              </span>
                            </Link>
                          )}
                          <span className="flex items-center gap-1 font-mono text-xs text-gold">
                            <ThumbsUp className="h-3 w-3" />
                            {data.topArgument.upvotes.toLocaleString()} upvotes
                          </span>
                          {data.topArgument.side && (
                            <Badge
                              variant={data.topArgument.side === 'blue' ? 'for' : 'against'}
                              size="sm"
                            >
                              {data.topArgument.side === 'blue' ? 'For' : 'Against'}
                            </Badge>
                          )}
                        </div>

                        {data.topArgument.topic && (
                          <Link
                            href={`/topic/${data.topArgument.topic.id}`}
                            className="flex items-center gap-1.5 mt-2 font-mono text-xs text-surface-500 hover:text-white transition-colors"
                          >
                            <BookOpen className="h-3 w-3" />
                            <span className="line-clamp-1">{data.topArgument.topic.statement}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Landmark laws ── */}
              {data.landmarkLaws.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 }}
                >
                  <SectionHeading
                    icon={Gavel}
                    title="Landmark Laws"
                    subtitle={`Laws that passed during ${data.quarter.label}`}
                    accent="text-emerald"
                  />
                  <div className="space-y-2">
                    {data.landmarkLaws.map((law, i) => (
                      <LawCard key={law.id} law={law} index={i} />
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <Link
                      href="/laws"
                      className="inline-flex items-center gap-1.5 font-mono text-sm text-surface-500 hover:text-emerald transition-colors"
                    >
                      View all laws in the Codex
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ── Hot contest ── */}
              {data.hotContest && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  <SectionHeading
                    icon={Flame}
                    title="The Contested Zone"
                    subtitle="The most fiercely divided topic on the platform right now"
                    accent="text-against-400"
                  />
                  <HotContestCard topic={data.hotContest} />
                </motion.div>
              )}

              {/* ── Footer links ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="pt-2 border-t border-surface-300"
              >
                <p className="font-mono text-xs text-surface-600 mb-4 text-center">
                  Explore more civic intelligence
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { href: '/records', label: 'All-Time Records', icon: Trophy },
                    { href: '/spotlight', label: 'Weekly Spotlight', icon: Star },
                    { href: '/leaderboard', label: 'Leaderboard', icon: Award },
                    { href: '/laws', label: 'Law Codex', icon: Gavel },
                    { href: '/analytics', label: 'My Analytics', icon: BarChart2 },
                    { href: '/wrapped', label: 'Year Wrapped', icon: Sparkles },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all group"
                    >
                      <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" />
                      <span className="font-mono text-xs text-surface-500 group-hover:text-white transition-colors">
                        {label}
                      </span>
                      <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 ml-auto transition-colors" />
                    </Link>
                  ))}
                </div>
              </motion.div>

            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
