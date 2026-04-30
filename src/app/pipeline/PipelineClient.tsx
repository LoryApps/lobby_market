'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  feed_score: number
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const SORT_OPTIONS = [
  { id: 'feed_score', label: 'Trending' },
  { id: 'total_votes', label: 'Most Voted' },
  { id: 'created_at', label: 'Newest' },
  { id: 'blue_pct_close', label: 'Most Contested' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

const CAT_DOT: Record<string, string> = {
  Economics: 'bg-gold',
  Politics: 'bg-for-500',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-500',
  Philosophy: 'bg-for-400',
  Culture: 'bg-gold',
  Health: 'bg-against-400',
  Environment: 'bg-emerald',
  Education: 'bg-purple',
}

// ─── Column config ────────────────────────────────────────────────────────────

interface ColumnConfig {
  id: string
  label: string
  icon: typeof Scale
  color: string
  bg: string
  border: string
  headerBg: string
  badge: 'proposed' | 'active' | 'law' | 'failed'
  description: string
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'proposed',
    label: 'Proposed',
    icon: Scale,
    color: 'text-surface-400',
    bg: 'bg-surface-200/40',
    border: 'border-surface-400/30',
    headerBg: 'bg-surface-300/30',
    badge: 'proposed',
    description: 'Gathering community support',
  },
  {
    id: 'active',
    label: 'Active',
    icon: Zap,
    color: 'text-for-400',
    bg: 'bg-for-500/5',
    border: 'border-for-500/30',
    headerBg: 'bg-for-500/10',
    badge: 'active',
    description: 'Open for debate & votes',
  },
  {
    id: 'voting',
    label: 'Voting',
    icon: Vote,
    color: 'text-purple',
    bg: 'bg-purple/5',
    border: 'border-purple/30',
    headerBg: 'bg-purple/10',
    badge: 'active',
    description: 'Final vote underway',
  },
  {
    id: 'law',
    label: 'LAW',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/5',
    border: 'border-gold/30',
    headerBg: 'bg-gold/10',
    badge: 'law',
    description: 'Established by consensus',
  },
  {
    id: 'failed',
    label: 'Failed',
    icon: ThumbsDown,
    color: 'text-against-400',
    bg: 'bg-against-500/5',
    border: 'border-against-500/20',
    headerBg: 'bg-against-500/10',
    badge: 'failed',
    description: 'Did not achieve consensus',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  const m = Math.floor(ms / 60_000)
  return `${m}m left`
}

function sortTopics(topics: PipelineTopic[], sortBy: SortOption): PipelineTopic[] {
  const sorted = [...topics]
  switch (sortBy) {
    case 'feed_score':
      return sorted.sort((a, b) => b.feed_score - a.feed_score)
    case 'total_votes':
      return sorted.sort((a, b) => b.total_votes - a.total_votes)
    case 'created_at':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'blue_pct_close':
      return sorted.sort((a, b) => Math.abs((a.blue_pct ?? 50) - 50) - Math.abs((b.blue_pct ?? 50) - 50))
    default:
      return sorted
  }
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: PipelineTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catDot = CAT_DOT[topic.category ?? ''] ?? 'bg-surface-500'
  const remaining = timeLeft(topic.voting_ends_at)
  const supportPct = topic.activation_threshold > 0
    ? Math.round((topic.support_count / topic.activation_threshold) * 100)
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border bg-surface-100 p-3.5',
          'border-surface-300 hover:border-surface-400 hover:bg-surface-200',
          'transition-colors group'
        )}
      >
        {/* Category dot + statement */}
        <div className="flex items-start gap-2 mb-2.5">
          <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', catDot)} />
          <p className="text-[12px] font-mono text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-3">
            {topic.statement}
          </p>
        </div>

        {/* Vote bar (active/voting/law/failed) */}
        {topic.total_votes > 0 && topic.status !== 'proposed' && (
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <span className="text-for-400">{forPct}% For</span>
              <span className="text-against-400">{againstPct}% Against</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-600 rounded-r-full"
                style={{ width: `${againstPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Support bar (proposed) */}
        {topic.status === 'proposed' && supportPct !== null && (
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <span className="text-surface-500">{topic.support_count} / {topic.activation_threshold} support</span>
              <span className="text-surface-600">{Math.min(supportPct, 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className="h-full bg-for-700 rounded-full transition-all"
                style={{ width: `${Math.min(supportPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5">
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-600 truncate max-w-[80px]">
                {topic.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-600">
            {topic.total_votes > 0 && (
              <span>{topic.total_votes.toLocaleString()} votes</span>
            )}
            {remaining && topic.status === 'voting' && (
              <span className="text-purple flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {remaining}
              </span>
            )}
            {!remaining && (
              <span>{relativeTime(topic.created_at)}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

const INITIAL_SHOW = 5

function PipelineColumn({
  col,
  topics,
  totalCount,
}: {
  col: ColumnConfig
  topics: PipelineTopic[]
  totalCount: number
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = col.icon
  const visible = expanded ? topics : topics.slice(0, INITIAL_SHOW)
  const hasMore = topics.length > INITIAL_SHOW

  return (
    <div className={cn('flex flex-col rounded-2xl border min-w-[240px] flex-shrink-0', col.border, col.bg)}>
      {/* Column header */}
      <div className={cn('flex items-center gap-2 px-4 py-3 rounded-t-2xl border-b', col.headerBg, col.border)}>
        <Icon className={cn('h-4 w-4 flex-shrink-0', col.color)} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-mono font-bold', col.color)}>{col.label}</span>
            <span className={cn(
              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full',
              col.headerBg,
              col.color
            )}>
              {totalCount}
            </span>
          </div>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5 truncate">{col.description}</p>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[65vh] min-h-[200px]">
        <AnimatePresence initial={false}>
          {visible.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </AnimatePresence>

        {topics.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className={cn('flex items-center justify-center h-10 w-10 rounded-full mb-2', col.headerBg)}>
              <Icon className={cn('h-5 w-5', col.color)} />
            </div>
            <p className="text-xs font-mono text-surface-500">No topics here yet</p>
          </div>
        )}

        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-2 rounded-xl',
              'text-[11px] font-mono transition-colors',
              col.color, col.headerBg,
              'hover:opacity-80'
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {topics.length - INITIAL_SHOW} more
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ topics }: { topics: PipelineTopic[] }) {
  const byStatus = (s: string) => topics.filter((t) => t.status === s).length
  const totalVotes = topics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)

  const stats = [
    { label: 'Total topics', value: topics.length, icon: TrendingUp, color: 'text-for-400' },
    { label: 'Active debates', value: byStatus('active') + byStatus('voting'), icon: Flame, color: 'text-emerald' },
    { label: 'Laws passed', value: byStatus('law'), icon: Gavel, color: 'text-gold' },
    { label: 'Votes cast', value: totalVotes, icon: ThumbsUp, color: 'text-purple' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
            <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">{label}</span>
          </div>
          <span className="font-mono text-xl font-bold text-white tabular-nums">
            {value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

interface PipelineClientProps {
  initialTopics: PipelineTopic[]
}

export function PipelineClient({ initialTopics }: PipelineClientProps) {
  const [topics, setTopics] = useState<PipelineTopic[]>(initialTopics)
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState<SortOption>('feed_score')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/topics')
      if (res.ok) {
        const data = await res.json()
        setTopics(data.topics ?? [])
      }
    } catch {
      // keep existing data
    } finally {
      setLoading(false)
    }
  }, [])

  // Close sort menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    if (showSortMenu) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showSortMenu])

  const filtered = category === 'All'
    ? topics
    : topics.filter((t) => t.category === category)

  const sortedFiltered = sortTopics(filtered, sortBy)

  const byStatus = (s: string) => sortedFiltered.filter((t) => t.status === s)

  const currentSortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? 'Trending'

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <StatsBar topics={filtered} />

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Category filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 min-w-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-mono font-medium whitespace-nowrap transition-colors flex-shrink-0',
                category === cat
                  ? 'bg-for-600 text-white border border-for-500/50'
                  : 'bg-surface-200 text-surface-500 border border-surface-300 hover:bg-surface-300 hover:text-white'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort + refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Sort dropdown */}
          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setShowSortMenu((o) => !o)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors'
              )}
            >
              <ArrowRight className="h-3 w-3 rotate-90" />
              {currentSortLabel}
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 mt-1 z-20 w-44 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setSortBy(opt.id); setShowSortMenu(false) }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-xs font-mono transition-colors',
                        sortBy === opt.id
                          ? 'bg-for-600/20 text-for-400'
                          : 'text-surface-600 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh pipeline"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors',
              loading && 'opacity-50 cursor-wait'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Pipeline board */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4 w-max min-w-full">
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-[280px] flex-shrink-0">
              <PipelineColumn
                col={col}
                topics={byStatus(col.id)}
                totalCount={byStatus(col.id).length}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-surface-500 border-t border-surface-300 pt-4">
        <span className="font-semibold text-surface-400">Pipeline stages:</span>
        {COLUMNS.map((col) => {
          const Icon = col.icon
          return (
            <span key={col.id} className="flex items-center gap-1.5">
              <Icon className={cn('h-3 w-3', col.color)} aria-hidden />
              <span className={col.color}>{col.label}</span>
              <span className="text-surface-600">— {col.description.toLowerCase()}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
