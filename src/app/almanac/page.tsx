'use client'

/**
 * /almanac — On This Day in Civic History
 *
 * Shows what happened in the Lobby on today's calendar date across all years:
 * topics proposed, laws established, and the highest-upvoted argument.
 *
 * Users can browse other dates with the date picker.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Scroll,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AlmanacData, AlmanacTopic, AlmanacLaw, AlmanacArgument } from '@/app/api/almanac/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function formatDateLabel(month: number, day: number): string {
  return `${MONTH_NAMES[month]} ${ordinal(day)}`
}

function truncate(s: string, max = 100): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Culture:     { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/30' },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'failed',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AlmanacSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3">
          <div className="flex gap-3 items-center">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: AlmanacTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catStyle = topic.category ? (CATEGORY_COLORS[topic.category] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300/30' }) : { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300/30' }
  const variant = STATUS_BADGE[topic.status] ?? 'proposed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link href={`/topic/${topic.id}`} className="block">
        <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-4 hover:border-surface-400/60 hover:bg-surface-200/80 transition-all duration-200">
          <div className="flex items-start gap-3">
            {/* Year chip */}
            <div className="flex-shrink-0 flex items-center justify-center h-8 w-12 rounded-lg bg-surface-200 border border-surface-300/60 mt-0.5">
              <span className="text-[11px] font-mono font-bold text-surface-500">{topic.year}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant={variant}>
                  {topic.status === 'law' ? 'LAW' : topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                </Badge>
                {topic.category && (
                  <span className={cn('text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border', catStyle.text, catStyle.bg, catStyle.border)}>
                    {topic.category}
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-white leading-snug">
                {topic.statement}
              </p>

              {/* Vote bar */}
              <div className="flex items-center gap-2 mt-2.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden relative">
                  <div
                    className="absolute left-0 top-0 h-full bg-for-500 rounded-full transition-all duration-500"
                    style={{ width: `${forPct}%` }}
                  />
                </div>
                <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                <span className="text-[11px] font-mono text-surface-500 w-20 text-right">
                  {topic.total_votes.toLocaleString()} votes
                </span>
              </div>

              <div className="flex gap-4 mt-1">
                <span className="text-[11px] font-mono text-for-400">{forPct}% FOR</span>
                <span className="text-[11px] font-mono text-against-400">{againstPct}% AGN</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: AlmanacLaw }) {
  const catStyle = law.category ? (CATEGORY_COLORS[law.category] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300/30' }) : { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link href={`/topic/${law.topic_id}`} className="block">
        <div className="rounded-xl border border-emerald/25 bg-emerald/5 p-4 hover:border-emerald/40 hover:bg-emerald/10 transition-all duration-200">
          <div className="flex items-start gap-3">
            {/* Year + gavel */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/15 border border-emerald/30">
                <Gavel className="h-4 w-4 text-emerald" />
              </div>
              <span className="text-[10px] font-mono font-bold text-surface-500">{law.year}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="law">LAW</Badge>
                {law.category && (
                  <span className={cn('text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border', catStyle.text, catStyle.bg, catStyle.border)}>
                    {law.category}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-emerald/90 leading-snug">
                {law.statement}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Argument spotlight ───────────────────────────────────────────────────────

function ArgumentSpotlight({ arg }: { arg: AlmanacArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link href={`/topic/${arg.topic_id}`} className="block">
        <div className={cn(
          'rounded-xl border p-4 hover:opacity-90 transition-all duration-200',
          isFor
            ? 'border-for-500/30 bg-for-500/5 hover:border-for-500/50'
            : 'border-against-500/30 bg-against-500/5 hover:border-against-500/50'
        )}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold',
              isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400'
            )}>
              {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
              {isFor ? 'FOR' : 'AGAINST'}
            </div>
            <span className="text-[11px] font-mono text-surface-500">
              {arg.upvotes.toLocaleString()} upvotes · {arg.year}
            </span>
          </div>

          {/* Argument text */}
          <p className="text-sm text-white/90 leading-relaxed mb-2">
            &ldquo;{truncate(arg.content, 200)}&rdquo;
          </p>

          {/* Topic */}
          <p className="text-[11px] font-mono text-surface-500 truncate">
            On: {truncate(arg.topic_statement, 80)}
          </p>

          {arg.author_username && (
            <p className="text-[11px] font-mono text-surface-500 mt-1">
              — @{arg.author_username}
              {arg.author_display_name ? ` (${arg.author_display_name})` : ''}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Date navigator ───────────────────────────────────────────────────────────

function DateNavigator({
  month,
  day,
  onPrev,
  onNext,
  onToday,
}: {
  month: number
  day: number
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const now = new Date()
  const isToday = month === now.getMonth() + 1 && day === now.getDate()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex-1 text-center">
        <h1 className="text-lg font-mono font-bold text-white">
          {formatDateLabel(month, day)}
        </h1>
        <p className="text-[11px] font-mono text-surface-500">
          On This Day in Civic History
        </p>
      </div>

      <button
        onClick={onNext}
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isToday && (
        <button
          onClick={onToday}
          className="ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-for-500/15 border border-for-500/30 text-for-400 text-[11px] font-mono font-semibold hover:bg-for-500/25 transition-colors"
        >
          <Calendar className="h-3 w-3" />
          Today
        </button>
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  count,
}: {
  icon: typeof Scroll
  iconColor: string
  iconBg: string
  title: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border', iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>
      <h2 className="text-sm font-mono font-bold text-white">{title}</h2>
      <span className="ml-auto text-[11px] font-mono text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full border border-surface-300/60">
        {count}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AlmanacPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const [data, setData] = useState<AlmanacData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (m: number, d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/almanac?date=${m}-${d}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load almanac')
      const json = await res.json() as AlmanacData
      setData(json)
    } catch {
      setError('Failed to load civic history. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(month, day)
  }, [fetchData, month, day])

  function navigate(delta: number) {
    const cur = new Date(now.getFullYear(), month - 1, day)
    cur.setDate(cur.getDate() + delta)
    setMonth(cur.getMonth() + 1)
    setDay(cur.getDate())
  }

  function goToday() {
    setMonth(now.getMonth() + 1)
    setDay(now.getDate())
  }

  const hasAnyData = data && (data.topics.length > 0 || data.laws.length > 0 || data.top_argument !== null)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <Scroll className="h-4 w-4 text-gold" />
              <h1 className="text-base font-mono font-bold text-white">Civic Almanac</h1>
            </div>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">
              On This Day in Civic History
            </p>
          </div>

          <button
            onClick={() => fetchData(month, day)}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white disabled:opacity-50 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Date navigator */}
        <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4 mb-6">
          <DateNavigator
            month={month}
            day={day}
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
            onToday={goToday}
          />

          {/* Stats row */}
          {data && !loading && (
            <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-surface-300/30">
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">{data.laws.length}</p>
                <p className="text-[10px] font-mono text-surface-500">Laws Made</p>
              </div>
              <div className="h-8 w-px bg-surface-300/40" />
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">{data.topics.length}</p>
                <p className="text-[10px] font-mono text-surface-500">Topics Debated</p>
              </div>
              <div className="h-8 w-px bg-surface-300/40" />
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">
                  {data.top_argument ? data.top_argument.upvotes.toLocaleString() : '—'}
                </p>
                <p className="text-[10px] font-mono text-surface-500">Top Arg. Votes</p>
              </div>
            </div>
          )}
        </div>

        {/* Fun fact */}
        {data?.fun_fact && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-gold/25 bg-gold/5 p-3 mb-5 flex items-start gap-2.5"
          >
            <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            <p className="text-[12px] font-mono text-gold/80 leading-relaxed">{data.fun_fact}</p>
          </motion.div>
        )}

        {/* Loading */}
        {loading && <AlmanacSkeleton />}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Scale}
            title="Failed to load"
            description={error}
          />
        )}

        {/* No data */}
        {!loading && !error && !hasAnyData && (
          <EmptyState
            icon={BookOpen}
            title="No civic history yet"
            description={`Nothing happened in the Lobby on ${formatDateLabel(month, day)} — yet. Be the first to shape history on this date.`}
            actions={[{ label: 'Browse Topics', href: '/' }]}
          />
        )}

        {/* Content */}
        {!loading && !error && hasAnyData && (
          <div className="space-y-8">
            {/* Laws */}
            {data!.laws.length > 0 && (
              <section>
                <SectionHeader
                  icon={Gavel}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10 border-emerald/30"
                  title="Laws Established"
                  count={data!.laws.length}
                />
                <div className="space-y-3">
                  {data!.laws.map((law) => (
                    <LawCard key={law.id} law={law} />
                  ))}
                </div>
              </section>
            )}

            {/* Top argument */}
            {data!.top_argument && (
              <section>
                <SectionHeader
                  icon={Flame}
                  iconColor="text-gold"
                  iconBg="bg-gold/10 border-gold/30"
                  title="Most Celebrated Argument"
                  count={1}
                />
                <ArgumentSpotlight arg={data!.top_argument} />
              </section>
            )}

            {/* Topics */}
            {data!.topics.length > 0 && (
              <section>
                <SectionHeader
                  icon={MessageSquare}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10 border-for-500/30"
                  title="Topics Proposed"
                  count={data!.topics.length}
                />
                <div className="space-y-3">
                  {data!.topics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} />
                  ))}
                </div>
              </section>
            )}

            {/* Footer CTA */}
            <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-semibold text-white">Add to this date&apos;s history</p>
                <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                  Propose a topic that becomes part of today&apos;s legacy.
                </p>
              </div>
              <Link
                href="/topic/create"
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-for-500 text-white text-xs font-mono font-bold hover:bg-for-600 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Propose
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
