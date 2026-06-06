'use client'

/**
 * /time-machine — Civic Time Machine
 *
 * Interactive day-browser. Pick any date to see what the Lobby looked like:
 * topics born, laws passed, arguments crafted, and debates held on that day.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TimeMachineSnapshot,
  TimeMachineTopic,
  TimeMachineLaw,
  TimeMachineArgument,
  TimeMachineDebate,
} from '@/app/api/time-machine/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  const result = d.toISOString().slice(0, 10)
  const today = todayIso()
  return result > today ? today : result
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

function catColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Vote
  label: string
  value: number
  color: string
}) {
  if (value === 0) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-surface-300 bg-surface-100 px-3.5 py-2.5">
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
      <div>
        <p className="font-mono text-lg font-bold text-white leading-none">
          {value.toLocaleString()}
        </p>
        <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: TimeMachineTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const agPct = 100 - forPct
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group block rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-for-500/40 hover:bg-surface-200/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-mono text-sm text-white leading-snug flex-1">
          {topic.statement}
        </p>
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm" className="flex-shrink-0">
          {STATUS_LABEL[topic.status] ?? topic.status}
        </Badge>
      </div>
      <div className="flex items-center gap-3 mb-2">
        {topic.category && (
          <span className={cn('font-mono text-[10px] uppercase tracking-wider', catColor(topic.category))}>
            {topic.category}
          </span>
        )}
        {topic.creator_username && (
          <span className="font-mono text-[10px] text-surface-500 truncate">
            by @{topic.creator_username}
          </span>
        )}
      </div>
      {topic.total_votes > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[10px] text-surface-500">
            <span className="text-for-400">FOR {forPct}%</span>
            <span className="text-against-400">AGAINST {agPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <p className="font-mono text-[10px] text-surface-500 text-right">
            {topic.total_votes.toLocaleString()} votes
          </p>
        </div>
      )}
    </Link>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: TimeMachineLaw }) {
  const forPct = Math.round(law.blue_pct)
  return (
    <Link
      href={`/law/${law.id}`}
      className="group block rounded-xl border border-gold/30 bg-gold/5 p-4 hover:border-gold/50 hover:bg-gold/10 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/15 border border-gold/30 flex-shrink-0 mt-0.5">
          <Gavel className="h-4 w-4 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug mb-1">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {law.category && (
              <span className={cn('font-mono text-[10px] uppercase tracking-wider', catColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="font-mono text-[10px] text-emerald">
              {forPct}% consensus · {law.total_votes?.toLocaleString() ?? 0} votes
            </span>
            <span className="font-mono text-[10px] text-surface-500">
              {formatTime(law.established_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: TimeMachineArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'group block rounded-xl border p-4 transition-colors',
        isFor
          ? 'border-for-500/30 bg-for-500/5 hover:border-for-500/50 hover:bg-for-500/10'
          : 'border-against-500/30 bg-against-500/5 hover:border-against-500/50 hover:bg-against-500/10'
      )}
    >
      <div className="flex items-start gap-3">
        {arg.author_avatar_url || arg.author_username ? (
          <Avatar
            src={arg.author_avatar_url}
            username={arg.author_username ?? '?'}
            size="sm"
            className="flex-shrink-0 mt-0.5"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-white/90 leading-relaxed line-clamp-3 mb-2">
            {arg.content}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider',
                isFor ? 'text-for-400' : 'text-against-400'
              )}
            >
              {isFor
                ? <ThumbsUp className="h-3 w-3" />
                : <ThumbsDown className="h-3 w-3" />}
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="font-mono text-[10px] text-surface-500 truncate flex-1">
              {arg.topic_statement.slice(0, 50)}
              {arg.topic_statement.length > 50 ? '…' : ''}
            </span>
            {arg.upvotes > 0 && (
              <span className="font-mono text-[10px] text-surface-400 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {arg.upvotes}
              </span>
            )}
          </div>
          {arg.author_username && (
            <p className="font-mono text-[10px] text-surface-500 mt-1">
              by @{arg.author_username} · {formatTime(arg.created_at)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: TimeMachineDebate }) {
  return (
    <Link
      href={`/debate/${debate.id}`}
      className="group flex items-center gap-3 rounded-xl border border-purple/30 bg-purple/5 p-4 hover:border-purple/50 hover:bg-purple/10 transition-colors"
    >
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple/15 border border-purple/30 flex-shrink-0">
        <Mic className="h-4 w-4 text-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-white truncate">{debate.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {debate.debater_for_username && (
            <span className="font-mono text-[10px] text-for-400">
              @{debate.debater_for_username}
            </span>
          )}
          {debate.debater_for_username && debate.debater_against_username && (
            <span className="font-mono text-[10px] text-surface-500">vs</span>
          )}
          {debate.debater_against_username && (
            <span className="font-mono text-[10px] text-against-400">
              @{debate.debater_against_username}
            </span>
          )}
          <span className="font-mono text-[10px] text-surface-500 ml-auto">
            {formatTime(debate.scheduled_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: typeof FileText
  title: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-4 w-4', color)} />
      <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
        {title}
      </h2>
      <span className="font-mono text-[10px] text-surface-500 bg-surface-200 rounded-full px-2 py-0.5">
        {count}
      </span>
    </div>
  )
}

// ─── Date skeleton ────────────────────────────────────────────────────────────

function SnapshotSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TimeMachineClient() {
  const searchParams = useSearchParams()

  const [date, setDate] = useState<string>(() => {
    return searchParams.get('date') ?? todayIso()
  })
  const [snapshot, setSnapshot] = useState<TimeMachineSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const today = todayIso()

  const load = useCallback(async (d: string) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(false)

    try {
      const res = await fetch(`/api/time-machine?date=${d}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as TimeMachineSnapshot
      setSnapshot(data)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  // Load on mount + date changes
  useEffect(() => {
    load(date)
    // Update URL without full navigation
    const url = new URL(window.location.href)
    url.searchParams.set('date', date)
    window.history.replaceState({}, '', url.toString())
  }, [date, load])

  function goToDate(d: string) {
    const clamped = d > today ? today : d
    setDate(clamped)
  }

  const canGoForward = date < today

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors text-surface-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Time Machine</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Revisit any day in Lobby history
              </p>
            </div>
          </div>
          <button
            onClick={() => goToDate(today)}
            disabled={date === today}
            className="font-mono text-xs text-for-400 hover:text-for-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Today
          </button>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-2 mb-6 rounded-2xl border border-surface-300 bg-surface-100 p-2">
          <button
            onClick={() => goToDate(shiftDate(date, -1))}
            className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-surface-200 text-surface-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && goToDate(e.target.value)}
              className={cn(
                'w-full h-10 rounded-xl pl-10 pr-3',
                'bg-surface-200 border border-surface-300',
                'font-mono text-sm text-white',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30',
                '[color-scheme:dark]'
              )}
            />
          </div>

          <button
            onClick={() => goToDate(shiftDate(date, 1))}
            disabled={!canGoForward}
            className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-surface-200 text-surface-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Date label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={date}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="mb-5"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-surface-500" />
              <p className="font-mono text-sm text-surface-400">
                {isoToDisplay(date)}
                {date === today && (
                  <span className="ml-2 text-for-400 font-semibold">· Today</span>
                )}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SnapshotSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={RefreshCw}
                title="Could not load snapshot"
                description="Something went wrong fetching the data for this date."
                actions={[{ label: 'Retry', onClick: () => load(date) }]}
              />
            </motion.div>
          ) : !snapshot?.has_data ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Timer}
                title="Nothing on this day"
                description={
                  date < '2024-01-01'
                    ? 'The Lobby didn\'t exist yet on this date. Try a more recent day.'
                    : 'No civic activity was recorded on this date.'
                }
                actions={[{ label: 'Go to today', onClick: () => goToDate(today) }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Stats strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatPill
                  icon={Vote}
                  label="Votes cast"
                  value={snapshot.stats.votes_cast}
                  color="text-for-400"
                />
                <StatPill
                  icon={MessageSquare}
                  label="Arguments"
                  value={snapshot.stats.arguments_written}
                  color="text-purple"
                />
                <StatPill
                  icon={FileText}
                  label="New topics"
                  value={snapshot.stats.topics_proposed}
                  color="text-for-300"
                />
                <StatPill
                  icon={Gavel}
                  label="Laws passed"
                  value={snapshot.stats.laws_passed}
                  color="text-gold"
                />
                <StatPill
                  icon={Mic}
                  label="Debates"
                  value={snapshot.stats.debates_held}
                  color="text-purple"
                />
                <StatPill
                  icon={Users}
                  label="New citizens"
                  value={snapshot.stats.new_users}
                  color="text-emerald"
                />
              </div>

              {/* Laws */}
              {snapshot.new_laws.length > 0 && (
                <section>
                  <SectionTitle
                    icon={Gavel}
                    title="Laws Established"
                    count={snapshot.new_laws.length}
                    color="text-gold"
                  />
                  <div className="space-y-2">
                    {snapshot.new_laws.map((law) => (
                      <LawCard key={law.id} law={law} />
                    ))}
                  </div>
                </section>
              )}

              {/* New topics */}
              {snapshot.new_topics.length > 0 && (
                <section>
                  <SectionTitle
                    icon={FileText}
                    title="Topics Proposed"
                    count={snapshot.new_topics.length}
                    color="text-for-400"
                  />
                  <div className="space-y-2">
                    {snapshot.new_topics.map((topic) => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                </section>
              )}

              {/* Top arguments */}
              {snapshot.top_arguments.length > 0 && (
                <section>
                  <SectionTitle
                    icon={MessageSquare}
                    title="Arguments Written"
                    count={snapshot.stats.arguments_written}
                    color="text-purple"
                  />
                  <div className="space-y-2">
                    {snapshot.top_arguments.map((arg) => (
                      <ArgumentCard key={arg.id} arg={arg} />
                    ))}
                    {snapshot.stats.arguments_written > snapshot.top_arguments.length && (
                      <p className="font-mono text-xs text-surface-500 text-center pt-1">
                        +{(snapshot.stats.arguments_written - snapshot.top_arguments.length).toLocaleString()} more arguments on this day
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Debates */}
              {snapshot.debates.length > 0 && (
                <section>
                  <SectionTitle
                    icon={Mic}
                    title="Debates Held"
                    count={snapshot.debates.length}
                    color="text-purple"
                  />
                  <div className="space-y-2">
                    {snapshot.debates.map((debate) => (
                      <DebateCard key={debate.id} debate={debate} />
                    ))}
                  </div>
                </section>
              )}

              {/* Navigation hint */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => goToDate(shiftDate(date, -1))}
                  className="flex items-center gap-1.5 font-mono text-xs text-surface-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous day
                </button>
                {canGoForward && (
                  <button
                    onClick={() => goToDate(shiftDate(date, 1))}
                    className="flex items-center gap-1.5 font-mono text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    Next day
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
