'use client'

/**
 * /rewind — Civic Time Machine
 *
 * Pick any past date and see what happened in the Lobby that day:
 * laws established, debates concluded, topics that changed status,
 * and the top arguments of the day.
 *
 * Distinct from:
 *  - /timeline  (endless chronological feed of all events)
 *  - /history   (your own recently-viewed topics)
 *  - /calendar  (upcoming events)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  ThumbsUp,
  Zap,
  FileText,
  History,
  Star,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RewindResponse,
  RewindLaw,
  RewindDebate,
  RewindStatusChange,
  RewindArgument,
} from '@/app/api/rewind/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function yesterdayUTC(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

function catColor(cat: string | null) {
  return cat ? (CATEGORY_COLOR[cat] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number
  label: string
  icon: typeof Gavel
  color: string
}) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1.5">
      <div className={cn('flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider', color)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums text-white">{value}</div>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-mono text-for-400 tabular-nums w-7 text-right">
        {Math.round(pct)}%
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full rounded-full bg-for-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 tabular-nums w-7">
        {Math.round(100 - pct)}%
      </span>
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: RewindLaw }) {
  return (
    <Link
      href={`/topic/${law.topic_id}`}
      className="block rounded-xl border border-gold/30 bg-gold/5 hover:bg-gold/10 hover:border-gold/50 transition-colors p-4 group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-gold/20 border border-gold/30">
          <Gavel className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white leading-snug group-hover:text-gold transition-colors">
            {truncate(law.statement, 90)}
          </p>
          {law.category && (
            <p className={cn('text-[11px] font-mono mt-1', catColor(law.category))}>
              {law.category}
            </p>
          )}
          <VoteBar pct={law.blue_pct} />
          <p className="text-[11px] font-mono text-surface-500 mt-1.5">
            {(law.total_votes ?? 0).toLocaleString()} votes cast
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: RewindDebate }) {
  return (
    <Link
      href={`/debate/${debate.id}`}
      className="block rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200 transition-colors p-4 group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-against-500/10 border border-against-500/30">
          <Mic className="h-3.5 w-3.5 text-against-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white leading-snug group-hover:text-against-300 transition-colors">
            {truncate(debate.title, 80)}
          </p>
          {debate.topic_category && (
            <p className={cn('text-[11px] font-mono mt-1', catColor(debate.topic_category))}>
              {debate.topic_category}
            </p>
          )}
          {debate.topic_statement && (
            <p className="text-[11px] font-mono text-surface-500 mt-1 leading-snug">
              re: {truncate(debate.topic_statement, 60)}
            </p>
          )}
        </div>
        <Badge variant="default" className="flex-shrink-0 text-[10px]">
          {debate.type}
        </Badge>
      </div>
    </Link>
  )
}

// ─── Status change card ───────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; icon: typeof Zap; iconClass: string; borderClass: string; bgClass: string }> = {
  active:  { label: 'Activated',   icon: Zap,      iconClass: 'text-for-400',     borderClass: 'border-for-500/30',     bgClass: 'bg-for-500/5'     },
  voting:  { label: 'In Voting',   icon: Scale,    iconClass: 'text-purple',      borderClass: 'border-purple/30',      bgClass: 'bg-purple/5'      },
  failed:  { label: 'Failed',      icon: FileText, iconClass: 'text-surface-500', borderClass: 'border-surface-300',    bgClass: 'bg-surface-100'   },
}

function StatusChangeCard({ change }: { change: RewindStatusChange }) {
  const meta = STATUS_META[change.status] ?? STATUS_META['active']
  const Icon = meta.icon

  return (
    <Link
      href={`/topic/${change.id}`}
      className={cn(
        'block rounded-xl border p-4 hover:opacity-80 transition-opacity group',
        meta.borderClass, meta.bgClass
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-surface-200/50')}>
          <Icon className={cn('h-3 w-3', meta.iconClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-white leading-snug group-hover:text-surface-800 transition-colors">
            {truncate(change.statement, 80)}
          </p>
          {change.category && (
            <p className={cn('text-[11px] font-mono mt-0.5', catColor(change.category))}>
              {change.category}
            </p>
          )}
        </div>
        <Badge
          variant={change.status === 'active' ? 'active' : change.status === 'voting' ? 'proposed' : 'default'}
          className="flex-shrink-0 text-[10px]"
        >
          {meta.label}
        </Badge>
      </div>
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: RewindArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <Link
      href={`/topic/${arg.topic_id}`}
      className="block rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors p-4 group"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 mt-0.5 w-1 self-stretch rounded-full',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )} />
        <div className="flex-1 min-w-0">
          {arg.topic_statement && (
            <p className="text-[11px] font-mono text-surface-500 mb-1.5 leading-snug">
              re: {truncate(arg.topic_statement, 55)}
            </p>
          )}
          <p className="text-sm font-mono text-surface-800 leading-relaxed line-clamp-3">
            {arg.content}
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            {(arg.author_username || arg.author_display_name) && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={arg.author_avatar_url}
                  fallback={arg.author_display_name || arg.author_username || '?'}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500">
                  {arg.author_display_name || arg.author_username}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500 ml-auto">
              <ThumbsUp className="h-3 w-3" />
              {arg.upvotes}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconClass,
  children,
  empty,
  emptyTitle,
  emptyDesc,
}: {
  title: string
  icon: typeof Gavel
  iconClass: string
  children: React.ReactNode
  empty: boolean
  emptyTitle: string
  emptyDesc: string
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wide">{title}</h2>
      </div>
      {empty ? (
        <EmptyState
          icon={Icon}
          iconColor={iconClass}
          iconBg="bg-surface-200"
          iconBorder="border-surface-300"
          title={emptyTitle}
          description={emptyDesc}
          size="sm"
        />
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </section>
  )
}

// ─── Loading state ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2.5">
          <Skeleton className="h-4 w-32" />
          {[...Array(2)].map((_, j) => (
            <Skeleton key={j} className="h-20 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RewindPage() {
  const [selectedDate, setSelectedDate] = useState<string>(yesterdayUTC)
  const [data, setData] = useState<RewindResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRewind = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rewind?date=${date}`)
      if (!res.ok) throw new Error('Failed to load rewind data')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load data for this date.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRewind(selectedDate)
  }, [selectedDate, fetchRewind])

  const canGoForward = selectedDate < yesterdayUTC()

  function goPrev() {
    setSelectedDate((d) => shiftDate(d, -1))
  }

  function goNext() {
    if (canGoForward) setSelectedDate((d) => shiftDate(d, 1))
  }

  const isQuietDay =
    !loading &&
    data &&
    data.stats.laws_count === 0 &&
    data.stats.debates_count === 0 &&
    data.stats.topics_changed === 0 &&
    data.stats.top_arguments === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
            <History className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-white">Civic Rewind</h1>
            <p className="text-xs font-mono text-surface-500">Travel back to any day in Lobby history</p>
          </div>
        </div>

        {/* Date picker row */}
        <div className="flex items-center gap-3 mb-6 rounded-2xl border border-surface-300 bg-surface-100 p-3">
          <button
            onClick={goPrev}
            aria-label="Previous day"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-surface-600 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <Calendar className="h-4 w-4 text-surface-500" />
            <input
              type="date"
              value={selectedDate}
              max={yesterdayUTC()}
              min="2023-01-01"
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value)
              }}
              className="bg-transparent text-white font-mono text-sm text-center focus:outline-none cursor-pointer"
              aria-label="Select date"
            />
          </div>

          <button
            onClick={goNext}
            disabled={!canGoForward}
            aria-label="Next day"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
              canGoForward
                ? 'bg-surface-200 hover:bg-surface-300 text-surface-600 hover:text-white'
                : 'bg-surface-200/30 text-surface-400 cursor-not-allowed'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Date label */}
        <div className="text-center mb-6">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">
            {selectedDate === yesterdayUTC()
              ? 'Yesterday'
              : formatDate(selectedDate)}
          </p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingState />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={RefreshCw}
                title="Couldn't load this day"
                description={error}
                action={{ label: 'Try again', onClick: () => fetchRewind(selectedDate) }}
              />
            </motion.div>
          ) : isQuietDay ? (
            <motion.div
              key="quiet"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Star}
                iconColor="text-surface-500"
                title="A quiet day in the Lobby"
                description="No laws, debates, or major status changes were recorded on this date."
                action={{ label: 'Try another date', onClick: goPrev }}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  value={data.stats.laws_count}
                  label="Laws"
                  icon={Gavel}
                  color="text-gold"
                />
                <StatCard
                  value={data.stats.debates_count}
                  label="Debates"
                  icon={Mic}
                  color="text-against-400"
                />
                <StatCard
                  value={data.stats.topics_changed}
                  label="Status Changes"
                  icon={Zap}
                  color="text-for-400"
                />
                <StatCard
                  value={data.stats.top_arguments}
                  label="Arguments"
                  icon={MessageSquare}
                  color="text-purple"
                />
              </div>

              {/* Laws */}
              <Section
                title="Laws Established"
                icon={Gavel}
                iconClass="text-gold"
                empty={data.laws.length === 0}
                emptyTitle="No laws established"
                emptyDesc="The community did not pass any laws on this date."
              >
                {data.laws.map((law) => (
                  <LawCard key={law.id} law={law} />
                ))}
              </Section>

              {/* Debates */}
              <Section
                title="Debates Concluded"
                icon={Mic}
                iconClass="text-against-400"
                empty={data.debates.length === 0}
                emptyTitle="No debates concluded"
                emptyDesc="No debates wrapped up on this date."
              >
                {data.debates.map((debate) => (
                  <DebateCard key={debate.id} debate={debate} />
                ))}
              </Section>

              {/* Status changes */}
              {data.status_changes.length > 0 && (
                <Section
                  title="Topics in Motion"
                  icon={Zap}
                  iconClass="text-for-400"
                  empty={false}
                  emptyTitle=""
                  emptyDesc=""
                >
                  {data.status_changes.map((change) => (
                    <StatusChangeCard key={change.id} change={change} />
                  ))}
                </Section>
              )}

              {/* Top arguments */}
              {data.top_arguments.length > 0 && (
                <Section
                  title="Top Arguments of the Day"
                  icon={MessageSquare}
                  iconClass="text-purple"
                  empty={false}
                  emptyTitle=""
                  emptyDesc=""
                >
                  {data.top_arguments.map((arg) => (
                    <ArgumentCard key={arg.id} arg={arg} />
                  ))}
                </Section>
              )}

              {/* Nav footer */}
              <div className="flex items-center justify-between pt-4 border-t border-surface-300">
                <button
                  onClick={goPrev}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous day
                </button>
                <Link
                  href="/timeline"
                  className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  Full timeline →
                </Link>
                {canGoForward && (
                  <button
                    onClick={goNext}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Next day
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
