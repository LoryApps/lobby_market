'use client'

/**
 * /hansard — The Civic Hansard
 *
 * The official daily record of all parliamentary proceedings in the Lobby:
 * laws established, Early Day Motions filed, PMQ sessions, committee
 * reports published, debates concluded, and new topics proposed.
 *
 * Named after Hansard — the verbatim record of UK parliamentary debates.
 * This is the Lobby's living institutional memory.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Crown,
  FileText,
  Filter,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scroll,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HansardDay, HansardEntry, HansardEntryType, HansardResponse } from '@/app/api/hansard/route'

// ─── Entry type config ────────────────────────────────────────────────────────

interface TypeConfig {
  label: string
  icon: typeof Gavel
  color: string
  bg: string
  border: string
  prefix: string
}

const TYPE_CONFIG: Record<HansardEntryType, TypeConfig> = {
  law: {
    label: 'Law',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    prefix: 'CODEX',
  },
  edm: {
    label: 'EDM',
    icon: Scroll,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    prefix: 'MOTION',
  },
  pmq: {
    label: 'PMQs',
    icon: Crown,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    prefix: 'PMQs',
  },
  committee_report: {
    label: 'Report',
    icon: FileText,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    prefix: 'COMMITTEE',
  },
  debate: {
    label: 'Debate',
    icon: Mic,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    prefix: 'DEBATE',
  },
  topic: {
    label: 'Motion',
    icon: MessageSquare,
    color: 'text-surface-400',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/30',
    prefix: 'MOTION',
  },
}

const ALL_TYPES: HansardEntryType[] = ['law', 'edm', 'pmq', 'committee_report', 'debate', 'topic']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function DayStats({ stats }: { stats: HansardDay['stats'] }) {
  const items = [
    { label: 'Laws', count: stats.laws, color: 'text-gold' },
    { label: 'Motions', count: stats.topics + stats.edms, color: 'text-for-400' },
    { label: 'PMQs', count: stats.pmqs, color: 'text-purple' },
    { label: 'Debates', count: stats.debates, color: 'text-against-400' },
    { label: 'Reports', count: stats.reports, color: 'text-emerald' },
  ].filter((i) => i.count > 0)

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs font-mono">
          <span className={cn('font-bold', item.color)}>{item.count}</span>
          <span className="text-surface-500">{item.label}</span>
        </span>
      ))}
    </div>
  )
}

// ─── Recommendation badge ──────────────────────────────────────────────────────

function RecommendationBadge({ rec }: { rec: string }) {
  const styles: Record<string, string> = {
    for: 'bg-for-500/20 text-for-400 border-for-500/30',
    against: 'bg-against-500/20 text-against-400 border-against-500/30',
    neutral: 'bg-surface-300/50 text-surface-400 border-surface-400/30',
    hold: 'bg-gold/20 text-gold border-gold/30',
  }
  const labels: Record<string, string> = { for: 'FOR', against: 'AGAINST', neutral: 'NEUTRAL', hold: 'HOLD' }
  return (
    <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono font-bold border', styles[rec] ?? styles.neutral)}>
      {labels[rec] ?? rec.toUpperCase()}
    </span>
  )
}

// ─── Single entry card ────────────────────────────────────────────────────────

function EntryCard({ entry, index }: { entry: HansardEntry; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TYPE_CONFIG[entry.type]
  const Icon = cfg.icon

  const meta = entry.meta ?? {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="group"
    >
      <div
        className={cn(
          'relative rounded-xl border transition-all duration-200',
          'bg-surface-100/60 backdrop-blur-sm',
          cfg.border,
          'hover:bg-surface-100/80'
        )}
      >
        {/* Left accent stripe */}
        <div className={cn('absolute left-0 top-4 bottom-4 w-0.5 rounded-full ml-3', cfg.bg.replace('10', '60'))} />

        <div className="pl-6 pr-4 py-3.5">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Type icon */}
            <div className={cn('flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg mt-0.5', cfg.bg, 'border', cfg.border)}>
              <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Type + time */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={cn('text-[10px] font-mono font-bold tracking-widest uppercase', cfg.color)}>
                  {cfg.prefix}
                </span>
                {entry.category && (
                  <span className="text-[10px] font-mono text-surface-500 bg-surface-300/50 px-1.5 py-0.5 rounded">
                    {entry.category}
                  </span>
                )}
                <span className="text-[10px] font-mono text-surface-600 ml-auto flex-shrink-0">
                  {formatTime(entry.timestamp)}
                </span>
              </div>

              {/* Title */}
              <Link
                href={entry.href}
                className="block text-sm font-mono font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-2"
              >
                {entry.title}
              </Link>

              {/* Summary */}
              <p className="text-xs text-surface-400 mt-1 leading-relaxed line-clamp-2">
                {entry.summary}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {/* Author */}
                {entry.author && (
                  <Link
                    href={`/profile/${entry.author.username}`}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    <Avatar
                      src={entry.author.avatar_url}
                      fallback={entry.author.display_name || entry.author.username}
                      size="xs"
                    />
                    <span className="text-[11px] font-mono text-surface-500">
                      {entry.author.display_name || entry.author.username}
                    </span>
                  </Link>
                )}

                {/* Law-specific meta */}
                {entry.type === 'law' && (
                  <>
                    <span className="text-[10px] font-mono text-for-400">{meta.forPct}% FOR</span>
                    <span className="text-[10px] font-mono text-surface-600">
                      {typeof meta.totalVotes === 'number' ? meta.totalVotes.toLocaleString() : meta.totalVotes} votes
                    </span>
                  </>
                )}

                {/* EDM meta */}
                {entry.type === 'edm' && (
                  <>
                    {meta.grounds && (
                      <Badge variant="neutral" size="xs">
                        {String(meta.grounds).replace('_', ' ')}
                      </Badge>
                    )}
                    {typeof meta.secondCount === 'number' && (
                      <span className="text-[10px] font-mono text-surface-500">
                        <span className="text-for-400 font-bold">{meta.secondCount}</span> seconds
                      </span>
                    )}
                    {meta.status === 'elevated' && (
                      <Badge variant="for" size="xs">On Order Paper</Badge>
                    )}
                  </>
                )}

                {/* Committee report meta */}
                {entry.type === 'committee_report' && meta.recommendation && (
                  <RecommendationBadge rec={String(meta.recommendation)} />
                )}

                {/* Navigate arrow */}
                <Link
                  href={entry.href}
                  className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-600 hover:text-white transition-colors"
                >
                  Read <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Expand toggle for long content */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-surface-600 hover:text-white hover:bg-surface-300 transition-colors mt-0.5"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-surface-300/40 pl-10">
                  <p className="text-xs text-surface-400 leading-relaxed">{entry.summary}</p>
                  <Link
                    href={entry.href}
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-mono font-semibold text-for-400 hover:text-for-300 transition-colors"
                  >
                    View in record <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Day section ──────────────────────────────────────────────────────────────

function DaySection({ day, activeTypes }: { day: HansardDay; activeTypes: Set<HansardEntryType> }) {
  const filtered = day.entries.filter((e) => activeTypes.has(e.type))
  const isToday = day.date === toISODate(new Date())

  return (
    <section className="mb-8">
      {/* Day header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-surface-500" />
          <h2 className="font-mono text-sm font-bold text-white">
            {formatDate(day.date)}
          </h2>
          {isToday && (
            <span className="px-2 py-0.5 rounded-full bg-for-500/20 text-for-400 border border-for-500/30 text-[10px] font-mono font-bold">
              TODAY
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-surface-300/40" />
        <DayStats stats={day.stats} />
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-surface-300/40 bg-surface-100/30 p-6 text-center">
          <p className="text-xs font-mono text-surface-500">No entries matching the current filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, i) => (
            <EntryCard key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function HansardSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((d) => (
        <div key={d}>
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-4 w-48" />
            <div className="flex-1 h-px bg-surface-300/30" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                    <Skeleton className="h-3 w-full max-w-md" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HansardClient() {
  const [data, setData] = useState<HansardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState<string>(toISODate(new Date()))
  const [range, setRange] = useState<1 | 3 | 7>(1)
  const [activeTypes, setActiveTypes] = useState<Set<HansardEntryType>>(new Set(ALL_TYPES))
  const [filterOpen, setFilterOpen] = useState(false)

  const load = useCallback(async (date: string, r: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hansard?date=${date}&range=${r}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as HansardResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Hansard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(currentDate, range)
  }, [currentDate, range, load])

  function toggleType(type: HansardEntryType) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const totalEntries = data?.days.reduce((sum, d) => sum + d.entries.length, 0) ?? 0
  const isToday = currentDate === toISODate(new Date())
  const canGoForward = !isToday

  function goBack() {
    setCurrentDate((d) => offsetDate(d, -1))
  }

  function goForward() {
    if (canGoForward) setCurrentDate((d) => offsetDate(d, 1))
  }

  function goToToday() {
    setCurrentDate(toISODate(new Date()))
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-10">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-4">
            <Link
              href="/parliament"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0 mt-0.5"
              aria-label="Back to Parliament"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60">
                  <BookOpen className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white">The Civic Hansard</h1>
                  <p className="text-xs font-mono text-surface-500">Official Daily Record of Parliamentary Proceedings</p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date navigation */}
            <div className="flex items-center gap-1 bg-surface-200 rounded-xl border border-surface-300/60 p-1">
              <button
                onClick={goBack}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                aria-label="Previous day"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-mono font-semibold text-white min-w-[90px] text-center">
                {formatDateShort(currentDate)}
              </span>
              <button
                onClick={goForward}
                disabled={!canGoForward}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-30"
                aria-label="Next day"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {!isToday && (
              <button
                onClick={goToToday}
                className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300/60 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                Today
              </button>
            )}

            {/* Range selector */}
            <div className="flex items-center gap-1 bg-surface-200 rounded-xl border border-surface-300/60 p-1">
              {([1, 3, 7] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all',
                    range === r
                      ? 'bg-surface-400 text-white'
                      : 'text-surface-500 hover:text-white hover:bg-surface-300'
                  )}
                >
                  {r === 1 ? '1 day' : `${r} days`}
                </button>
              ))}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all',
                filterOpen
                  ? 'bg-gold/20 border-gold/40 text-gold'
                  : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-300'
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {activeTypes.size < ALL_TYPES.length && (
                <span className="ml-0.5 text-[10px] bg-gold/20 text-gold rounded px-1">
                  {activeTypes.size}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={() => load(currentDate, range)}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50 ml-auto"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 flex flex-wrap gap-2">
                  <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider self-center mr-1">
                    Show:
                  </span>
                  {ALL_TYPES.map((type) => {
                    const cfg = TYPE_CONFIG[type]
                    const Icon = cfg.icon
                    const active = activeTypes.has(type)
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all',
                          active
                            ? cn(cfg.bg, cfg.border, cfg.color)
                            : 'bg-surface-300/40 border-surface-400/20 text-surface-600 opacity-50'
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        {loading ? (
          <HansardSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="text-against-400 text-sm font-mono">{error}</p>
            <button
              onClick={() => load(currentDate, range)}
              className="mt-3 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-xs font-mono transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !data || totalEntries === 0 ? (
          <EmptyState
            icon={BookOpen}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/20"
            title="No proceedings recorded"
            description="No parliamentary activity was recorded on this date. The Lobby was quiet."
            actions={[
              { label: 'Go to today', onClick: goToToday },
              { label: 'Browse Parliament', href: '/parliament', variant: 'secondary' },
            ]}
          />
        ) : (
          <div>
            {/* Record header */}
            <div className="flex items-center justify-between mb-6 px-1">
              <p className="text-xs font-mono text-surface-500">
                <span className="text-white font-semibold">{totalEntries}</span> proceedings recorded
              </p>
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 text-surface-600" />
                <span className="text-[10px] font-mono text-surface-600">Official Record</span>
              </div>
            </div>

            {/* Days */}
            {data.days.map((day) => (
              <DaySection key={day.date} day={day} activeTypes={activeTypes} />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 pt-6 border-t border-surface-300/40">
          <p className="text-[10px] font-mono font-semibold text-surface-600 uppercase tracking-wider mb-3">Legend</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_TYPES.map((type) => {
              const cfg = TYPE_CONFIG[type]
              const Icon = cfg.icon
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className={cn('flex items-center justify-center h-5 w-5 rounded flex-shrink-0', cfg.bg)}>
                    <Icon className={cn('h-3 w-3', cfg.color)} />
                  </div>
                  <div>
                    <span className={cn('text-[10px] font-mono font-semibold', cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-surface-600 ml-1">
                      {type === 'law' && '— passed into Codex'}
                      {type === 'edm' && '— notice filed'}
                      {type === 'pmq' && '— session opened'}
                      {type === 'committee_report' && '— report published'}
                      {type === 'debate' && '— debate concluded'}
                      {type === 'topic' && '— motion proposed'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] font-mono text-surface-600 mt-4">
            The Civic Hansard is an official record of parliamentary proceedings. All entries are generated from platform activity in real time.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
