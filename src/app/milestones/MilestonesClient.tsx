'use client'

/**
 * /milestones — Civic Milestones
 *
 * A personal "highlight reel" of every key civic first:
 *   - First vote, argument, debate, prediction
 *   - First law vote that became law
 *   - Vote count milestones (100, 500, 1k, 5k)
 *   - Argument upvote records
 *   - Clout & streak milestones
 *
 * Distinct from:
 *   /analytics     (raw stats dashboard)
 *   /activity      (chronological activity log)
 *   /impact        (contribution to laws)
 *   /memories      ("on this day" feature)
 *   /report-card   (letter grade system)
 *   /achievements  (achievement badges list)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  ExternalLink,
  Flag,
  Flame,
  Gavel,
  Lock,
  MessageSquare,
  Mic,
  RefreshCw,
  Scroll,
  Shield,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Milestone, MilestoneType, MilestonesResponse } from '@/app/api/milestones/route'

// ─── Milestone config ─────────────────────────────────────────────────────────

interface MilestoneConfig {
  icon: typeof Flag
  color: string
  bg: string
  border: string
  accentGlow: string
}

const MILESTONE_CONFIG: Record<MilestoneType, MilestoneConfig> = {
  joined:                 { icon: Flag,         color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30',      accentGlow: 'shadow-for-500/10' },
  first_vote:             { icon: Vote,         color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30',      accentGlow: 'shadow-for-500/10' },
  first_argument:         { icon: MessageSquare,color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30',       accentGlow: 'shadow-purple/10'  },
  first_debate:           { icon: Mic,          color: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30',  accentGlow: 'shadow-against-500/10' },
  first_law_vote:         { icon: Gavel,        color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         accentGlow: 'shadow-gold/10'    },
  first_achievement:      { icon: Award,        color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         accentGlow: 'shadow-gold/10'    },
  vote_100:               { icon: Zap,          color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30',      accentGlow: 'shadow-for-500/10' },
  vote_500:               { icon: Zap,          color: 'text-for-300',     bg: 'bg-for-400/10',      border: 'border-for-400/30',      accentGlow: 'shadow-for-400/10' },
  vote_1000:              { icon: Zap,          color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30',      accentGlow: 'shadow-emerald/10' },
  vote_5000:              { icon: Trophy,       color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         accentGlow: 'shadow-gold/10'    },
  argument_10_upvotes:    { icon: ThumbsUp,     color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30',      accentGlow: 'shadow-emerald/10' },
  argument_50_upvotes:    { icon: ThumbsUp,     color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30',       accentGlow: 'shadow-purple/10'  },
  argument_100_upvotes:   { icon: Star,         color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         accentGlow: 'shadow-gold/10'    },
  first_follower:         { icon: Users,        color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30',      accentGlow: 'shadow-for-500/10' },
  streak_7:               { icon: Flame,        color: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30',  accentGlow: 'shadow-against-500/10' },
  streak_30:              { icon: Flame,        color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         accentGlow: 'shadow-gold/10'    },
  clout_100:              { icon: Coins,        color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30',      accentGlow: 'shadow-for-500/10' },
  clout_500:              { icon: Coins,        color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30',       accentGlow: 'shadow-purple/10'  },
  clout_1000:             { icon: Coins,        color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         accentGlow: 'shadow-gold/10'    },
  influencer:             { icon: Shield,       color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30',      accentGlow: 'shadow-emerald/10' },
  first_prediction:       { icon: Target,       color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30',       accentGlow: 'shadow-purple/10'  },
  first_topic_created:    { icon: Scroll,       color: 'text-for-300',     bg: 'bg-for-400/10',      border: 'border-for-400/30',      accentGlow: 'shadow-for-400/10' },
}

function getMilestoneConfig(type: MilestoneType): MilestoneConfig {
  return MILESTONE_CONFIG[type] ?? {
    icon: Sparkles,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300',
    accentGlow: '',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function relativeTime(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function truncate(s: string, max = 80): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: typeof Zap
  color: string
}) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-mono font-bold text-white leading-none">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-100 border border-surface-300">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300"
          >
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  index,
}: {
  milestone: Milestone
  index: number
}) {
  const cfg = getMilestoneConfig(milestone.type)
  const Icon = cfg.icon
  const [expanded, setExpanded] = useState(false)

  const hasContext =
    milestone.context?.topicStatement ||
    milestone.context?.argumentContent ||
    milestone.context?.achievementName

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <div
        className={cn(
          'relative rounded-xl border p-4 transition-all',
          milestone.achieved
            ? cn('bg-surface-100', cfg.border, cfg.accentGlow, 'shadow-lg')
            : 'bg-surface-50 border-surface-300/50 opacity-50',
        )}
      >
        {/* Lock overlay for unachieved */}
        {!milestone.achieved && (
          <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
            <Lock className="h-4 w-4 text-surface-600" aria-hidden="true" />
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl',
              milestone.achieved ? cn(cfg.bg, cfg.color) : 'bg-surface-300/20 text-surface-600',
            )}
            aria-hidden="true"
          >
            {milestone.achieved ? (
              <Icon className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p
                className={cn(
                  'text-sm font-mono font-semibold leading-snug',
                  milestone.achieved ? 'text-white' : 'text-surface-500',
                )}
              >
                {milestone.title}
              </p>
              {milestone.achieved && milestone.date && (
                <span className="text-[10px] font-mono text-surface-500 flex-shrink-0 mt-0.5">
                  {relativeTime(milestone.date)}
                </span>
              )}
            </div>

            <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">
              {milestone.description}
            </p>

            {milestone.achieved && milestone.date && (
              <p className="text-[10px] font-mono text-surface-600 mt-1">
                {formatDate(milestone.date)}
              </p>
            )}

            {/* Expandable context */}
            {milestone.achieved && hasContext && (
              <div className="mt-2">
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-mono transition-colors',
                    cfg.color,
                    'hover:opacity-80',
                  )}
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      Show details
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div
                        className={cn(
                          'mt-2 p-3 rounded-lg border text-xs font-mono',
                          cfg.bg,
                          cfg.border,
                        )}
                      >
                        {milestone.context?.argumentContent && (
                          <p className="text-surface-300 italic leading-relaxed">
                            &ldquo;{truncate(milestone.context.argumentContent)}&rdquo;
                          </p>
                        )}
                        {milestone.context?.topicStatement && (
                          <p className={cn('mt-1', milestone.context?.argumentContent ? 'text-surface-500' : 'text-surface-300')}>
                            {milestone.context?.argumentContent ? '↑ on: ' : ''}
                            {truncate(milestone.context.topicStatement, 90)}
                          </p>
                        )}
                        {milestone.context?.achievementName && (
                          <p className="text-surface-300">
                            Achievement: <span className={cfg.color}>{milestone.context.achievementName}</span>
                          </p>
                        )}
                        {milestone.context?.topicId && (
                          <Link
                            href={`/topic/${milestone.context.topicId}`}
                            className={cn(
                              'inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-wider font-semibold',
                              cfg.color,
                              'hover:opacity-80 transition-opacity',
                            )}
                          >
                            View topic
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Check badge for achieved */}
          {milestone.achieved && (
            <div
              className={cn(
                'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full',
                'bg-emerald/20 border border-emerald/40',
              )}
              aria-label="Achieved"
            >
              <Check className="h-3 w-3 text-emerald" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Next milestone banner ────────────────────────────────────────────────────

function NextMilestoneBanner({ milestone }: { milestone: Milestone }) {
  const cfg = getMilestoneConfig(milestone.type)
  const Icon = cfg.icon
  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex items-center gap-3',
        'bg-surface-100',
        cfg.border,
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl',
          cfg.bg,
          cfg.color,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">
          Next milestone
        </p>
        <p className="text-sm font-mono font-bold text-white">{milestone.title}</p>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{milestone.description}</p>
      </div>
      <ArrowRight className={cn('h-4 w-4 flex-shrink-0', cfg.color)} aria-hidden="true" />
    </div>
  )
}

// ─── Progress summary ─────────────────────────────────────────────────────────

function ProgressBar({ achieved, total }: { achieved: number; total: number }) {
  const pct = total > 0 ? Math.round((achieved / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs font-mono">
        <span className="text-surface-500">{achieved} / {total} milestones</span>
        <span className="text-white font-semibold">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-for-700 via-for-500 to-emerald"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Filter ───────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'achieved' | 'locked'

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'achieved', label: 'Achieved' },
  { id: 'locked', label: 'Locked' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function MilestonesClient() {
  const router = useRouter()
  const [data, setData] = useState<MilestonesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [authed, setAuthed] = useState(true)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/milestones', { cache: 'no-store' })
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Redirect if unauthenticated ─────────────────────────────────────────
  useEffect(() => {
    if (!authed) router.push('/login')
  }, [authed, router])

  const milestones = data?.milestones ?? []
  const stats = data?.stats

  const achievedCount = milestones.filter((m) => m.achieved).length
  const totalCount = milestones.length

  const filtered = milestones.filter((m) => {
    if (filter === 'achieved') return m.achieved
    if (filter === 'locked') return !m.achieved
    return true
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main
        className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-5"
        id="main-content"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.back()}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Milestones
              </h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your personal civic journey — every first and breakthrough
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
            aria-label="Refresh milestones"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <PageSkeleton />
        ) : !data ? (
          <EmptyState
            icon={Trophy}
            title="Could not load milestones"
            description="Please try again in a moment."
            actions={[{ label: 'Retry', onClick: () => load() }]}
          />
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Votes Cast"
                value={stats?.totalVotes ?? 0}
                icon={Vote}
                color="text-for-400"
              />
              <StatCard
                label="Arguments"
                value={stats?.totalArguments ?? 0}
                icon={MessageSquare}
                color="text-purple"
              />
              <StatCard
                label="Clout"
                value={stats?.clout ?? 0}
                icon={Coins}
                color="text-gold"
              />
            </div>

            {/* Progress bar */}
            <ProgressBar achieved={achievedCount} total={totalCount} />

            {/* Next milestone */}
            {data.nextMilestone && (
              <NextMilestoneBanner milestone={data.nextMilestone} />
            )}

            {/* Filter tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'flex-1 text-xs font-mono font-semibold py-1.5 rounded-lg transition-all',
                    filter === f.id
                      ? 'bg-surface-400 text-white shadow'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  {f.id === 'achieved'
                    ? `${f.label} (${achievedCount})`
                    : f.id === 'locked'
                    ? `${f.label} (${totalCount - achievedCount})`
                    : f.label}
                </button>
              ))}
            </div>

            {/* Milestone list */}
            {filtered.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title={filter === 'achieved' ? 'No milestones achieved yet' : 'All milestones achieved!'}
                description={
                  filter === 'achieved'
                    ? 'Start voting and debating to earn your first milestone.'
                    : 'You have unlocked every civic milestone. Impressive.'
                }
              />
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {filtered.map((milestone, idx) => (
                    <MilestoneCard
                      key={milestone.type}
                      milestone={milestone}
                      index={idx}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link
                href="/achievements"
                className={cn(
                  'flex items-center gap-2 p-3.5 rounded-xl border transition-all',
                  'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
                )}
              >
                <Award className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-white">Achievements</p>
                  <p className="text-[10px] font-mono text-surface-500">Earned badges</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-600 ml-auto flex-shrink-0" />
              </Link>
              <Link
                href="/impact"
                className={cn(
                  'flex items-center gap-2 p-3.5 rounded-xl border transition-all',
                  'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
                )}
              >
                <BarChart2 className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-white">Civic Impact</p>
                  <p className="text-[10px] font-mono text-surface-500">Laws & influence</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-600 ml-auto flex-shrink-0" />
              </Link>
            </div>

            {/* Member since */}
            {stats?.memberSince && (
              <p className="text-center text-[11px] font-mono text-surface-600 pb-2">
                Lobby citizen since {formatDate(stats.memberSince)}
              </p>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
