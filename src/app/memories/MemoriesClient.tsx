'use client'

/**
 * /memories — On This Day in Civic History
 *
 * A daily "memory lane" that surfaces two streams:
 *   Personal — your own votes, arguments, and debates from this calendar
 *              date in prior years ("1 year ago today you voted FOR…")
 *   Platform — laws ratified and topics proposed on this date in prior
 *              years ("2 years ago today the Lobby passed…")
 *
 * Falls back gracefully for new users with no personal history.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  MemoriesResponse,
  YearMemory,
  PlatformMilestone,
} from '@/app/api/analytics/memories/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearsAgoLabel(n: number): string {
  if (n === 1) return '1 year ago today'
  return `${n} years ago today`
}

function shortStatus(status: string): 'proposed' | 'active' | 'law' | 'failed' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'active' || status === 'voting') return 'active'
  return 'proposed'
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold border-gold/30 bg-gold/10',
  Politics: 'text-for-400 border-for-500/30 bg-for-500/10',
  Technology: 'text-purple border-purple/30 bg-purple/10',
  Science: 'text-emerald border-emerald/30 bg-emerald/10',
  Ethics: 'text-against-400 border-against-500/30 bg-against-500/10',
  Philosophy: 'text-for-300 border-for-400/30 bg-for-400/10',
  Culture: 'text-gold border-gold/20 bg-gold/5',
  Health: 'text-against-300 border-against-400/30 bg-against-400/10',
  Environment: 'text-emerald border-emerald/20 bg-emerald/5',
  Education: 'text-for-400 border-for-500/20 bg-for-500/5',
}

function categoryClass(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-400 border-surface-400/20 bg-surface-300/10') : 'text-surface-400 border-surface-400/20 bg-surface-300/10'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function YearSection({ memory }: { memory: YearMemory }) {
  const totalActions = memory.votes.length + memory.arguments.length + memory.debates.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Year header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200 border border-surface-300">
          <History className="h-3.5 w-3.5 text-gold" />
          <span className="text-sm font-mono font-semibold text-gold">{memory.year}</span>
        </div>
        <span className="text-sm font-mono text-surface-500">{yearsAgoLabel(memory.years_ago)}</span>
        <div className="ml-auto text-xs font-mono text-surface-500">
          {totalActions} civic action{totalActions !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-3 pl-4 border-l-2 border-surface-300/40">
        {/* Votes */}
        {memory.votes.map((vote, i) => (
          <Link
            key={`v-${i}`}
            href={`/topic/${vote.topic_id}`}
            className="group block p-4 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border',
                    vote.side === 'blue'
                      ? 'text-for-300 bg-for-500/10 border-for-500/30'
                      : 'text-against-300 bg-against-500/10 border-against-500/30'
                  )}>
                    {vote.side === 'blue'
                      ? <><ThumbsUp className="h-3 w-3" /> FOR</>
                      : <><ThumbsDown className="h-3 w-3" /> AGAINST</>}
                  </div>
                  {vote.topic_category && (
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-mono border', categoryClass(vote.topic_category))}>
                      {vote.topic_category}
                    </span>
                  )}
                  <Badge variant={shortStatus(vote.topic_status)} />
                </div>
                <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-100 transition-colors">
                  {vote.topic_statement}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
            </div>
          </Link>
        ))}

        {/* Arguments */}
        {memory.arguments.map((arg) => (
          <Link
            key={arg.id}
            href={`/arguments/${arg.id}`}
            className="group block p-4 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'mt-1 p-1.5 rounded-lg flex-shrink-0',
                arg.side === 'blue' ? 'bg-for-500/10' : 'bg-against-500/10'
              )}>
                <MessageSquare className={cn('h-3.5 w-3.5', arg.side === 'blue' ? 'text-for-400' : 'text-against-400')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={cn(
                    'text-xs font-mono font-bold',
                    arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
                  )}>
                    {arg.side === 'blue' ? 'FOR' : 'AGAINST'} argument
                  </span>
                  <span className="text-xs font-mono text-surface-500">
                    ↑ {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors mb-1.5">
                  &ldquo;{arg.content}&rdquo;
                </p>
                <p className="text-xs font-mono text-surface-500 truncate">
                  on: {arg.topic_statement}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
            </div>
          </Link>
        ))}

        {/* Debates */}
        {memory.debates.map((debate, i) => (
          <Link
            key={`d-${i}`}
            href={`/debate/${debate.id}`}
            className="group block p-4 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple/10">
                  <Scale className="h-3.5 w-3.5 text-purple" />
                </div>
                <div>
                  <p className="text-xs font-mono text-purple mb-0.5">Live debate</p>
                  <p className="text-sm text-white leading-snug line-clamp-1 group-hover:text-for-100 transition-colors">
                    {debate.topic_statement}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-400 flex-shrink-0 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

function MilestoneCard({ milestone, index }: { milestone: PlatformMilestone; index: number }) {
  const isLaw = milestone.type === 'law'
  const href = isLaw && milestone.law_id
    ? `/law/${milestone.law_id}`
    : milestone.topic_id
      ? `/topic/${milestone.topic_id}`
      : '#'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        href={href}
        className="group flex items-start gap-4 p-4 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
      >
        <div className={cn(
          'p-2.5 rounded-xl flex-shrink-0 mt-0.5',
          isLaw ? 'bg-gold/10 border border-gold/20' : 'bg-for-500/10 border border-for-500/20'
        )}>
          {isLaw
            ? <Gavel className="h-4 w-4 text-gold" />
            : <Flame className="h-4 w-4 text-for-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn(
              'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
              isLaw
                ? 'text-gold bg-gold/10 border-gold/30'
                : 'text-for-300 bg-for-500/10 border-for-500/30'
            )}>
              {isLaw ? 'LAW ESTABLISHED' : 'TOPIC PROPOSED'}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {yearsAgoLabel(milestone.years_ago)}
            </span>
            {milestone.category && (
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-mono border', categoryClass(milestone.category))}>
                {milestone.category}
              </span>
            )}
          </div>

          <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-100 transition-colors">
            {milestone.title}
          </p>
          <p className="text-xs font-mono text-surface-500 mt-1">{milestone.description}</p>
        </div>

        <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 rounded-xl bg-surface-200/60 border border-surface-300/50">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'personal' | 'platform'

// ─── Main component ───────────────────────────────────────────────────────────

export function MemoriesClient() {
  const [data, setData] = useState<MemoriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('personal')
  const [personalPage, setPersonalPage] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/memories', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load memories')
      const json: MemoriesResponse = await res.json()
      setData(json)
      // Default to platform tab if no personal history
      if (!json.has_personal_history) setTab('platform')
    } catch {
      setError('Could not load memories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Personal memory pagination (one year at a time)
  const currentMemory = data?.personal[personalPage] ?? null

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <History className="h-5 w-5 text-gold" />
              <h1 className="text-xl font-mono font-bold text-white">Civic Memories</h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              {loading || !data ? 'Loading…' : `On this day in civic history — ${data.today_label}`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh memories"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300 mb-6">
          {([
            { id: 'personal' as Tab, label: 'Your Memories', icon: BookOpen },
            { id: 'platform' as Tab, label: 'Platform History', icon: Sparkles },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-semibold transition-all',
                tab === id
                  ? 'bg-surface-0 text-white shadow-sm border border-surface-300'
                  : 'text-surface-500 hover:text-surface-400'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-against-500/10 border border-against-500/30 text-sm font-mono text-against-300 mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Content */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            {tab === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {!data.has_personal_history ? (
                  <EmptyState
                    icon={<Calendar className="h-10 w-10 text-surface-500" />}
                    title="No memories yet"
                    description={`Come back on ${data.today_label} next year to see what you were debating today. Your civic journey is just beginning.`}
                    action={
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                      >
                        Start voting today
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-8">
                    {/* Year navigator */}
                    {data.personal.length > 1 && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-200/60 border border-surface-300/50">
                        <button
                          onClick={() => setPersonalPage(p => Math.max(0, p - 1))}
                          disabled={personalPage === 0}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Newer
                        </button>

                        <span className="text-sm font-mono text-surface-400">
                          {personalPage + 1} / {data.personal.length}
                        </span>

                        <button
                          onClick={() => setPersonalPage(p => Math.min(data.personal.length - 1, p + 1))}
                          disabled={personalPage === data.personal.length - 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Older
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {currentMemory && <YearSection memory={currentMemory} />}

                    {/* Quick link to activity calendar */}
                    <div className="pt-4 border-t border-surface-300/30">
                      <Link
                        href="/activity-calendar"
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200/60 border border-surface-300/50 text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all"
                      >
                        <Calendar className="h-4 w-4" />
                        View full activity calendar
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'platform' && (
              <motion.div
                key="platform"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {data.platform.length === 0 ? (
                  <EmptyState
                    icon={<Loader2 className="h-10 w-10 text-surface-500 animate-spin" />}
                    title="No platform history yet"
                    description={`The Lobby is still young. Check back later — as the platform grows, ${data.today_label} will accumulate its own civic history.`}
                    action={
                      <Link
                        href="/timeline"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                      >
                        View full timeline
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {/* Laws first */}
                    {data.platform.filter(m => m.type === 'law').length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-mono font-bold text-gold uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Gavel className="h-3.5 w-3.5" />
                          Laws Established
                        </p>
                        <div className="space-y-3">
                          {data.platform
                            .filter(m => m.type === 'law')
                            .map((m, i) => <MilestoneCard key={i} milestone={m} index={i} />)}
                        </div>
                      </div>
                    )}

                    {/* Topics proposed */}
                    {data.platform.filter(m => m.type === 'topic_proposed').length > 0 && (
                      <div>
                        <p className="text-xs font-mono font-bold text-for-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Flame className="h-3.5 w-3.5" />
                          Topics Proposed
                        </p>
                        <div className="space-y-3">
                          {data.platform
                            .filter(m => m.type === 'topic_proposed')
                            .map((m, i) => <MilestoneCard key={i} milestone={m} index={i} />)}
                        </div>
                      </div>
                    )}

                    {/* Quick link to time machine */}
                    <div className="pt-4 border-t border-surface-300/30">
                      <Link
                        href="/time-machine"
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200/60 border border-surface-300/50 text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all"
                      >
                        <History className="h-4 w-4" />
                        Explore any date in the Time Machine
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
