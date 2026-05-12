'use client'

/**
 * /analytics/debates — Debate Performance Analytics
 *
 * Personal breakdown of all debates the user has participated in:
 *   - Participation stats (speaker vs viewer, side distribution)
 *   - Sway voting activity (strategic influence during live debates)
 *   - Winner poll accuracy (how often the user predicted the right winner)
 *   - Debate archetype: Orator, Strategist, Prognosticator, Observer, Newcomer
 *   - Recent debates list with outcomes
 *   - Topic category + debate type breakdown
 *
 * Distinct from:
 *   /debates            — browse upcoming/live/past debates
 *   /analytics          — overall civic stats hub
 *   /analytics/votes    — topic voting patterns
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flame,
  Gavel,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DebateAnalyticsResponse,
  DebateStat,
  DebateArchetype,
} from '@/app/api/analytics/debates/route'

// ─── Archetype config ──────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<
  DebateArchetype,
  {
    label: string
    description: string
    icon: typeof Trophy
    color: string
    bg: string
    border: string
  }
> = {
  prognosticator: {
    label: 'The Prognosticator',
    description: 'You correctly predict debate outcomes 65%+ of the time. Your read of rhetoric quality is sharper than the crowd.',
    icon: Target,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  orator: {
    label: 'The Orator',
    description: 'You take the stage more than you watch. A proven speaker who engages directly in live debate.',
    icon: Mic,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  strategist: {
    label: 'The Strategist',
    description: 'Heavy sway voter — you actively shape momentum during debates, casting your influence at critical checkpoints.',
    icon: Sparkles,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  observer: {
    label: 'The Observer',
    description: 'You follow debates as a viewer, absorbing arguments and casting winner polls without taking the floor.',
    icon: Users,
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
  },
  newcomer: {
    label: 'The Newcomer',
    description: 'Just getting started in the debate chamber. Participate in at least 3 debates to unlock your archetype.',
    icon: Circle,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const TYPE_LABELS: Record<string, string> = {
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof Trophy
  color: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-0.5">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <div className="text-[11px] text-surface-500 font-mono">{sub}</div>}
    </div>
  )
}

// ─── Debate row ────────────────────────────────────────────────────────────────

function DebateRow({ d }: { d: DebateStat }) {
  const isEnded = d.status === 'ended'
  const userWon = isEnded && d.winner && d.winner === d.side
  const userLost = isEnded && d.winner && d.winner !== d.side && d.winner !== 'tie'
  const tied = isEnded && d.winner === 'tie'

  const sideColor = d.side === 'blue' ? 'text-for-400' : 'text-against-400'
  const sideBg = d.side === 'blue' ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'

  let outcomeIcon = <Circle className="w-4 h-4 text-surface-500" />
  let outcomeColor = 'text-surface-500'
  if (userWon) { outcomeIcon = <Trophy className="w-4 h-4 text-gold" />; outcomeColor = 'text-gold' }
  else if (tied) { outcomeIcon = <Scale className="w-4 h-4 text-surface-400" />; outcomeColor = 'text-surface-400' }
  else if (userLost) { outcomeIcon = <XCircle className="w-4 h-4 text-against-400" />; outcomeColor = 'text-against-400' }

  const totalSway = d.blue_sway + d.red_sway
  const bluePct = totalSway > 0 ? Math.round((d.blue_sway / totalSway) * 100) : 50

  return (
    <Link href={`/debate/${d.debate_id}`}>
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5 hover:border-surface-400/60 transition-colors group">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{outcomeIcon}</div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {d.title}
            </p>

            {d.topic_statement && (
              <p className="text-[11px] text-surface-500 mt-0.5 truncate">
                {d.topic_statement}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border',
                sideBg, sideColor
              )}>
                {d.side === 'blue' ? <ThumbsUp className="w-2.5 h-2.5" /> : <ThumbsDown className="w-2.5 h-2.5" />}
                {d.side === 'blue' ? 'FOR' : 'AGAINST'}
              </span>

              {d.is_speaker && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-purple/10 border border-purple/30 text-purple">
                  <Mic className="w-2.5 h-2.5" />
                  Speaker
                </span>
              )}

              <span className="text-[10px] text-surface-500 font-mono">{TYPE_LABELS[d.type] ?? d.type}</span>
              <span className="text-[10px] text-surface-600">{relDate(d.scheduled_at)}</span>

              {d.poll_vote && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
                  d.poll_correct === true
                    ? 'bg-emerald/10 border-emerald/30 text-emerald'
                    : d.poll_correct === false
                    ? 'bg-against-500/10 border-against-500/30 text-against-400'
                    : 'bg-surface-200 border-surface-400 text-surface-400'
                )}>
                  {d.poll_correct === true ? <CheckCircle2 className="w-2.5 h-2.5" /> : d.poll_correct === false ? <XCircle className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                  {d.poll_correct === true ? 'Predicted ✓' : d.poll_correct === false ? 'Predicted ✗' : 'Picked'}
                </span>
              )}
            </div>

            {isEnded && totalSway > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-for-400 w-8 text-right shrink-0">{bluePct}%</span>
                <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                  <div className="h-full bg-for-500 rounded-full" style={{ width: `${bluePct}%` }} />
                </div>
                <span className="text-[10px] font-mono text-against-400 w-8 shrink-0">{100 - bluePct}%</span>
                <span className={cn('text-[10px] font-mono ml-1', outcomeColor)}>
                  {userWon ? 'Your side won' : tied ? 'Tied' : userLost ? 'Your side lost' : ''}
                </span>
              </div>
            )}
          </div>

          <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DebateAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<DebateAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/debates', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        throw new Error('Failed to load debate analytics')
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const archetype = data ? ARCHETYPE_CONFIG[data.archetype] : null

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/analytics')}
            className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-400/50 text-surface-400 hover:text-white transition-all"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-purple/15 border border-purple/30 flex items-center justify-center shrink-0">
            <Gavel className="w-5 h-5 text-purple" />
          </div>

          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Debate Analytics</h1>
            <p className="text-[12px] text-surface-500">Your performance across all live debates</p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="ml-auto p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-400/50 text-surface-400 hover:text-white transition-all disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && error && (
          <div className="text-center py-16 text-surface-500">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-white mb-1">Could not load data</p>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-400/50 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {data.total_participated === 0 ? (
              <EmptyState
                icon={Gavel}
                title="No debates yet"
                description="Join a debate as a speaker or viewer to unlock your Debate Analytics. Live debates happen daily."
                action={{ label: 'Browse Debates', href: '/debate' }}
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Debates"
                    value={data.total_participated}
                    sub={`${data.week_participated} this week`}
                    icon={Gavel}
                    color="text-purple"
                  />
                  <StatCard
                    label="As Speaker"
                    value={data.as_speaker}
                    sub={`${data.as_viewer} as viewer`}
                    icon={Mic}
                    color="text-for-400"
                  />
                  <StatCard
                    label="Sway Votes"
                    value={data.total_sway_votes}
                    sub="strategic influence"
                    icon={Zap}
                    color="text-gold"
                  />
                  <StatCard
                    label="Poll Accuracy"
                    value={data.poll_accuracy !== null ? `${data.poll_accuracy}%` : '—'}
                    sub={data.total_poll_votes > 0 ? `${data.total_poll_votes} polls cast` : 'Cast winner polls'}
                    icon={Target}
                    color="text-emerald"
                  />
                </div>

                {archetype && (
                  <div className={cn(
                    'rounded-2xl border p-4 flex items-start gap-4',
                    archetype.bg, archetype.border
                  )}>
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border',
                      archetype.bg, archetype.border
                    )}>
                      <archetype.icon className={cn('w-6 h-6', archetype.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-base font-bold', archetype.color)}>
                          {archetype.label}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full border border-surface-400/50">
                          Debate Archetype
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                        {archetype.description}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
                  <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5" />
                    Side Distribution
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-for-400 w-12 text-right shrink-0">
                      FOR {data.total_participated > 0 ? Math.round((data.blue_side / data.total_participated) * 100) : 0}%
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all"
                        style={{ width: `${data.total_participated > 0 ? (data.blue_side / data.total_participated) * 100 : 50}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-against-400 w-16 shrink-0">
                      AGN {data.total_participated > 0 ? Math.round((data.red_side / data.total_participated) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[11px] text-surface-500">{data.blue_side} debates FOR</span>
                    <span className="text-[11px] text-surface-500">{data.red_side} debates AGAINST</span>
                  </div>
                </div>

                {data.type_breakdown.length > 0 && (
                  <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
                    <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <BarChart2 className="w-3.5 h-3.5" />
                      Format Breakdown
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {data.type_breakdown.map(({ type, count }) => {
                        const pct = Math.round((count / data.total_participated) * 100)
                        const colorMap: Record<string, string> = {
                          quick: 'text-for-400 bg-for-500/10 border-for-500/30',
                          grand: 'text-gold bg-gold/10 border-gold/30',
                          tribunal: 'text-purple bg-purple/10 border-purple/30',
                        }
                        return (
                          <div key={type} className={cn(
                            'flex-1 min-w-[100px] rounded-xl border p-3 text-center',
                            colorMap[type] ?? 'text-surface-400 bg-surface-200 border-surface-400'
                          )}>
                            <div className="text-xl font-bold">{count}</div>
                            <div className="text-[11px] font-mono mt-0.5">{TYPE_LABELS[type] ?? type}</div>
                            <div className="text-[10px] opacity-70">{pct}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {data.category_breakdown.length > 0 && (
                  <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
                    <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5" />
                      Top Categories Debated
                    </h2>
                    <div className="space-y-2">
                      {data.category_breakdown.map(({ category, count }) => {
                        const maxCount = data.category_breakdown[0].count
                        const pct = Math.round((count / maxCount) * 100)
                        return (
                          <div key={category} className="flex items-center gap-3">
                            <span className="text-xs text-surface-400 w-24 shrink-0 truncate">{category}</span>
                            <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                              <div className="h-full bg-purple rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-surface-500 w-8 text-right shrink-0">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Recent Debates
                    <span className="text-surface-600 normal-case font-normal">({data.recent_debates.length})</span>
                  </h2>
                  {data.recent_debates.length === 0 ? (
                    <p className="text-sm text-surface-500 py-4 text-center">No debate history yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.recent_debates.map((d) => (
                        <DebateRow key={d.debate_id} d={d} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <Link href="/debate" className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-purple/40 hover:bg-purple/5 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center shrink-0">
                      <Gavel className="w-4 h-4 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-purple transition-colors">Browse Debates</p>
                      <p className="text-[11px] text-surface-500">Find upcoming debates to join</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-purple transition-colors shrink-0" />
                  </Link>

                  <Link href="/analytics" className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-for-500/40 hover:bg-for-500/5 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-for-500/10 border border-for-500/30 flex items-center justify-center shrink-0">
                      <BarChart2 className="w-4 h-4 text-for-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">Analytics Hub</p>
                      <p className="text-[11px] text-surface-500">All your civic stats in one place</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-for-400 transition-colors shrink-0" />
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
