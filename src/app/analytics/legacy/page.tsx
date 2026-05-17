'use client'

/**
 * /analytics/legacy — Civic Legacy Report
 *
 * A permanent-record summary of a user's most significant civic contributions:
 * laws they authored that passed, their best arguments, debate record, and
 * an overall Legacy Tier that tells the story of their impact on the platform.
 *
 * Distinct from:
 *   /analytics/influence   — composite engagement + quality score
 *   /analytics/snapshot    — current identity card / archetype
 *   /analytics/benchmark   — comparison with join-date cohort
 *   /impact                — per-prediction / per-law vote accuracy
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  Crown,
  ExternalLink,
  Gavel,
  Landmark,
  MessageSquare,
  Mic,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  LegacyResponse,
  LegacyTier,
  LegacyLaw,
  LegacyArgument,
  LegacyMilestone,
} from '@/app/api/analytics/legacy/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_STYLES: Record<
  LegacyTier,
  {
    color: string
    bg: string
    border: string
    glow: string
    icon: typeof Crown
    ringColor: string
  }
> = {
  legend: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    glow: 'shadow-[0_0_24px_rgba(201,168,76,0.35)]',
    icon: Crown,
    ringColor: 'ring-gold/40',
  },
  lawmaker: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.3)]',
    icon: Gavel,
    ringColor: 'ring-purple/40',
  },
  advocate: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-[0_0_16px_rgba(59,130,246,0.25)]',
    icon: Shield,
    ringColor: 'ring-for-500/30',
  },
  citizen: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: '',
    icon: Vote,
    ringColor: 'ring-emerald/30',
  },
  newcomer: {
    color: 'text-surface-400',
    bg: 'bg-surface-200/50',
    border: 'border-surface-400/30',
    glow: '',
    icon: Sparkles,
    ringColor: 'ring-surface-400/30',
  },
}

const MILESTONE_ICONS: Record<LegacyMilestone['type'], typeof Calendar> = {
  joined: Calendar,
  first_vote: Vote,
  first_argument: MessageSquare,
  first_law_authored: Gavel,
  first_debate: Mic,
}

const MILESTONE_COLORS: Record<LegacyMilestone['type'], string> = {
  joined: 'text-surface-400',
  first_vote: 'text-for-400',
  first_argument: 'text-purple',
  first_law_authored: 'text-gold',
  first_debate: 'text-emerald',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function memberSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}y ${months}mo` : `${years}y`
}

function LegacyScoreArc({ score }: { score: number }) {
  const radius = 52
  const circ = 2 * Math.PI * radius
  const filled = circ * (score / 100) * 0.75
  const offset = circ * 0.125

  return (
    <svg
      width="140"
      height="90"
      viewBox="0 0 140 90"
      className="overflow-visible"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="8"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(135 70 70)"
      />
      {/* Fill */}
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="url(#legacyGrad)"
        strokeWidth="8"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(135 70 70)"
        className="transition-all duration-700"
      />
      <defs>
        <linearGradient id="legacyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C9A84C" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: React.ReactNode
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={cn('text-2xl font-mono font-bold', color)}>{value}</p>
      {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function LawCard({ law, index }: { law: LegacyLaw; index: number }) {
  const forPct = Math.round(law.blue_pct)
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Link
        href={`/law/${law.id}`}
        className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-gold/40 hover:bg-gold/5 transition-all group"
      >
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 mt-0.5">
          <Gavel className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-white group-hover:text-gold/90 transition-colors line-clamp-2 leading-snug">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {law.category && (
              <span className="text-[10px] font-mono text-surface-500 bg-surface-300/40 px-1.5 py-0.5 rounded">
                {law.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-for-400">
              {forPct}% FOR · {law.total_votes.toLocaleString()} votes
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {formatDate(law.established_at)}
            </span>
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-gold/60 transition-colors flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

function ArgumentCard({
  arg,
  index,
  rank,
}: {
  arg: LegacyArgument
  index: number
  rank: number
}) {
  const SideIcon = arg.side === 'blue' ? ThumbsUp : ThumbsDown
  const sideColor = arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
  const sideBg = arg.side === 'blue' ? 'bg-for-500/10 border-for-500/20' : 'bg-against-500/10 border-against-500/20'

  const gradeColor: Record<string, string> = {
    A: 'text-emerald',
    B: 'text-for-400',
    C: 'text-gold',
    D: 'text-against-400',
    F: 'text-against-500',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
    >
      <Link
        href={`/arguments/${arg.id}`}
        className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-purple/30 hover:bg-purple/5 transition-all group"
      >
        {/* Rank badge */}
        <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-surface-300/60 text-[11px] font-mono font-bold text-surface-400 mt-0.5">
          #{rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white/90 line-clamp-2 leading-snug">
            {arg.content}
          </p>
          <p className="text-[10px] font-mono text-surface-500 mt-1 truncate">
            {arg.topic_statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn('flex items-center gap-0.5 text-[10px] font-mono font-semibold', sideBg, 'px-1.5 py-0.5 rounded border', sideColor)}>
              <SideIcon className="h-2.5 w-2.5" />
              {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
              <ThumbsUp className="h-2.5 w-2.5" />
              {arg.upvotes}
            </span>
            {arg.reply_count > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
                <MessageSquare className="h-2.5 w-2.5" />
                {arg.reply_count}
              </span>
            )}
            {arg.ai_grade && (
              <span className={cn('text-[10px] font-mono font-bold', gradeColor[arg.ai_grade] ?? 'text-surface-400')}>
                Grade: {arg.ai_grade}
              </span>
            )}
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-purple/60 transition-colors flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

function MilestoneItem({ milestone, index }: { milestone: LegacyMilestone; index: number }) {
  const Icon = MILESTONE_ICONS[milestone.type]
  const color = MILESTONE_COLORS[milestone.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="flex items-start gap-3"
    >
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-full border',
            'bg-surface-200',
            color === 'text-gold'
              ? 'border-gold/40'
              : color === 'text-for-400'
                ? 'border-for-500/30'
                : color === 'text-purple'
                  ? 'border-purple/30'
                  : color === 'text-emerald'
                    ? 'border-emerald/30'
                    : 'border-surface-400/30'
          )}
        >
          <Icon className={cn('h-3 w-3', color)} />
        </div>
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <p className="text-xs font-mono font-semibold text-white">{milestone.label}</p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">{formatDate(milestone.date)}</p>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex gap-4 items-center">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-6 w-36 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-20 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-16 w-full mb-2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LegacyPage() {
  const router = useRouter()
  const [data, setData] = useState<LegacyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/legacy', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as LegacyResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tierStyle = data ? TIER_STYLES[data.tier] : null
  const TierIcon = tierStyle?.icon ?? Sparkles

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </button>
          <div>
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              Civic Legacy
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your permanent footprint on the Lobby
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 bg-surface-200/60 transition-all disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading && !data && (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PageSkeleton />
            </motion.div>
          )}

          {error && !data && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
                <p className="text-sm font-mono text-against-300">{error}</p>
                <button
                  onClick={load}
                  className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                >
                  Try again
                </button>
              </div>
            </motion.div>
          )}

          {data && tierStyle && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >

              {/* ── Tier card ─────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'rounded-2xl border p-6',
                  tierStyle.bg,
                  tierStyle.border,
                  tierStyle.glow
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className={cn('ring-2 rounded-full', tierStyle.ringColor)}>
                      <Avatar
                        src={data.user.avatar_url}
                        fallback={data.user.display_name || data.user.username}
                        size="lg"
                      />
                    </div>
                    <div className={cn(
                      'absolute -bottom-1 -right-1 flex items-center justify-center h-6 w-6 rounded-full border-2 border-surface-50',
                      tierStyle.bg,
                      tierStyle.border
                    )}>
                      <TierIcon className={cn('h-3 w-3', tierStyle.color)} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-white text-base truncate">
                      {data.user.display_name || data.user.username}
                    </p>
                    <p className="text-xs font-mono text-surface-500">@{data.user.username}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn(
                        'text-xs font-mono font-bold px-2 py-0.5 rounded-lg border',
                        tierStyle.bg,
                        tierStyle.border,
                        tierStyle.color
                      )}>
                        {data.tier_label.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-surface-500">
                        {memberSince(data.user.created_at)} in the Lobby
                      </span>
                      {data.user.civic_archetype && (
                        <span className="text-xs font-mono text-surface-500">
                          · {data.user.civic_archetype}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score arc */}
                  <div className="flex-shrink-0 flex flex-col items-center relative">
                    <LegacyScoreArc score={data.legacy_score} />
                    <div className="absolute inset-0 flex items-end justify-center pb-1">
                      <div className="text-center">
                        <p className={cn('text-3xl font-mono font-bold', tierStyle.color)}>
                          {data.legacy_score}
                        </p>
                        <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wider -mt-1">
                          score
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs font-mono text-surface-400 mt-4 border-t border-surface-300/40 pt-3">
                  {data.tier_description}
                </p>
              </motion.div>

              {/* ── Quick stats ───────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total votes"
                  value={<AnimatedNumber value={data.total_votes} />}
                  color="text-for-400"
                />
                <StatCard
                  label="Arguments"
                  value={<AnimatedNumber value={data.total_arguments} />}
                  color="text-purple"
                />
                <StatCard
                  label="Laws authored"
                  value={<AnimatedNumber value={data.laws_authored_count} />}
                  color="text-gold"
                  sub={data.laws_authored_count === 1 ? 'law passed' : 'laws passed'}
                />
                <StatCard
                  label="Upvotes earned"
                  value={<AnimatedNumber value={data.total_upvotes_received} />}
                  color="text-emerald"
                />
              </div>

              {/* ── Laws authored ─────────────────────────────────────────── */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="flex items-center gap-2 text-sm font-mono font-semibold text-white">
                    <Gavel className="h-4 w-4 text-gold" />
                    Laws Authored
                    <span className="ml-1 text-xs font-mono text-surface-500 font-normal">
                      ({data.laws_authored_count})
                    </span>
                  </h2>
                  {data.laws_authored_count > 0 && (
                    <Link
                      href={`/profile/${data.user.username}`}
                      className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      View profile
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {data.laws_authored.length === 0 ? (
                  <EmptyState
                    icon={Gavel}
                    title="No laws authored yet"
                    description="Propose a topic and rally the community — passed topics become permanent law."
                    action={{ label: 'Browse topics', href: '/' }}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.laws_authored.map((law, i) => (
                      <LawCard key={law.id} law={law} index={i} />
                    ))}
                  </div>
                )}
              </motion.section>

              {/* ── Top arguments ─────────────────────────────────────────── */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="flex items-center gap-2 text-sm font-mono font-semibold text-white">
                    <BookOpen className="h-4 w-4 text-purple" />
                    Best Arguments
                    <span className="ml-1 text-xs font-mono text-surface-500 font-normal">
                      by upvotes
                    </span>
                  </h2>
                  <Link
                    href="/analytics/arguments"
                    className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Full portfolio
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {data.top_arguments.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No arguments yet"
                    description="Post your first argument and earn upvotes from the community."
                    action={{ label: 'Explore topics', href: '/' }}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.top_arguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} index={i} rank={i + 1} />
                    ))}
                  </div>
                )}
              </motion.section>

              {/* ── Debate record ─────────────────────────────────────────── */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="flex items-center gap-2 text-sm font-mono font-semibold text-white mb-4">
                  <Swords className="h-4 w-4 text-emerald" />
                  Debate Record
                </h2>

                {data.debate_record.total === 0 ? (
                  <EmptyState
                    icon={Swords}
                    title="No debates yet"
                    description="Join a live debate to test your arguments against real opponents."
                    action={{ label: 'Browse debates', href: '/debate' }}
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                      label="Total debates"
                      value={data.debate_record.total}
                      color="text-white"
                    />
                    <StatCard
                      label="As speaker"
                      value={data.debate_record.as_speaker}
                      color="text-emerald"
                    />
                    <StatCard
                      label="Wins"
                      value={data.debate_record.wins}
                      color="text-for-400"
                    />
                    <StatCard
                      label="Win rate"
                      value={
                        data.debate_record.win_rate !== null
                          ? `${data.debate_record.win_rate}%`
                          : '—'
                      }
                      sub={
                        data.debate_record.win_rate === null
                          ? 'need 3+ ended'
                          : undefined
                      }
                      color="text-gold"
                    />
                  </div>
                )}
              </motion.section>

              {/* ── Milestones timeline ───────────────────────────────────── */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="flex items-center gap-2 text-sm font-mono font-semibold text-white mb-4">
                  <Landmark className="h-4 w-4 text-for-400" />
                  Civic Timeline
                </h2>

                {data.milestones.length === 0 ? (
                  <p className="text-sm font-mono text-surface-500">No milestones yet.</p>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-3.5 top-3.5 bottom-0 w-px bg-surface-300/50" aria-hidden />
                    <div className="space-y-0 pl-1">
                      {data.milestones.map((m, i) => (
                        <MilestoneItem key={`${m.type}-${m.date}`} milestone={m} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>

              {/* ── Navigation links ──────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {[
                  { href: '/analytics/influence', label: 'Influence Score', icon: Zap, color: 'text-gold' },
                  { href: '/analytics/arguments', label: 'Argument Portfolio', icon: BookOpen, color: 'text-purple' },
                  { href: '/analytics/debates', label: 'Debate Analytics', icon: Swords, color: 'text-emerald' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/80 hover:bg-surface-200 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-3.5 w-3.5', color)} />
                      <span className="text-xs font-mono font-medium text-white">{label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  </Link>
                ))}
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
