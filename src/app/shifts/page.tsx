'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ShiftingTopic, ShiftingResponse } from '@/app/api/topics/shifting/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Scale,
}

// ─── Category filter list ─────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function ShiftsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Vote direction bar ───────────────────────────────────────────────────────

function DirectionBar({
  historicalPct,
  recentPct,
  direction,
}: {
  historicalPct: number
  recentPct: number
  direction: 'for' | 'against'
}) {
  return (
    <div className="space-y-1.5">
      {/* Historical bar */}
      <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-for-600/50 transition-all duration-500"
          style={{ width: `${historicalPct}%` }}
        />
      </div>
      {/* Recent (shifted) bar */}
      <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 h-full transition-all duration-500',
            direction === 'for' ? 'bg-for-500' : 'bg-against-500'
          )}
          style={{ width: `${recentPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span>
          Historical&nbsp;
          <span className={direction === 'for' ? 'text-for-400' : 'text-against-400'}>
            {Math.round(historicalPct)}% For
          </span>
        </span>
        <span>
          Last 24h&nbsp;
          <span className={direction === 'for' ? 'text-for-300' : 'text-against-300'}>
            {recentPct}% For
          </span>
        </span>
      </div>
    </div>
  )
}

// ─── Topic shift card ─────────────────────────────────────────────────────────

function ShiftCard({
  topic,
  direction,
  idx,
}: {
  topic: ShiftingTopic
  direction: 'for' | 'against'
  idx: number
}) {
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const absDelta = Math.abs(topic.delta)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group block rounded-2xl border transition-all duration-200',
          'bg-surface-100 hover:bg-surface-200/80',
          direction === 'for'
            ? 'border-for-600/30 hover:border-for-500/50'
            : 'border-against-600/30 hover:border-against-500/50'
        )}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Delta indicator */}
            <div
              className={cn(
                'flex-shrink-0 flex flex-col items-center justify-center',
                'w-10 h-10 rounded-xl border text-sm font-mono font-bold',
                direction === 'for'
                  ? 'bg-for-500/10 border-for-500/30 text-for-400'
                  : 'bg-against-500/10 border-against-500/30 text-against-400'
              )}
            >
              {direction === 'for' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              <span className="text-[10px] leading-none mt-0.5">
                {absDelta}%
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Meta row */}
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <Badge
                  variant={STATUS_BADGE[topic.status] ?? 'proposed'}
                  className="text-[10px] px-1.5 py-0.5"
                >
                  <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                  {topic.status === 'voting'
                    ? 'Voting'
                    : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                </Badge>
                {topic.category && (
                  <span className={cn('text-[11px] font-mono font-medium', catColor)}>
                    {topic.category}
                  </span>
                )}
                <span className="text-[11px] font-mono text-surface-500">
                  {topic.votes_24h} recent vote{topic.votes_24h !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Statement */}
              <p className="text-sm font-medium text-white leading-snug mb-2 group-hover:text-for-100 transition-colors">
                {truncate(topic.statement, 120)}
              </p>

              {/* Direction bar */}
              <DirectionBar
                historicalPct={topic.blue_pct}
                recentPct={topic.recent_blue_pct}
                direction={direction}
              />
            </div>

            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 flex-shrink-0 mt-1 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  direction,
  count,
}: {
  direction: 'for' | 'against'
  count: number
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-1 mb-3',
        direction === 'for' ? 'text-for-400' : 'text-against-400'
      )}
    >
      {direction === 'for' ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span className="text-sm font-mono font-semibold uppercase tracking-wider">
        {direction === 'for' ? 'Surging For' : 'Surging Against'}
      </span>
      <span className="text-[11px] font-mono text-surface-500 ml-auto">
        {count} topic{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabId = 'all' | 'for' | 'against'

export default function ShiftsPage() {
  const [data, setData] = useState<ShiftingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState('All')
  const [tab, setTab] = useState<TabId>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (cat: string, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(false)

      try {
        const params = new URLSearchParams()
        if (cat !== 'All') params.set('category', cat)
        const res = await fetch(`/api/topics/shifting?${params}`)
        if (!res.ok) throw new Error('fetch failed')
        const json = (await res.json()) as ShiftingResponse
        setData(json)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    load(category)
  }, [category, load])

  const handleRefresh = () => load(category, true)

  const surgingFor = data?.surging_for ?? []
  const surgingAgainst = data?.surging_against ?? []
  const totalShifts = surgingFor.length + surgingAgainst.length

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-purple" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Opinion Shifts
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label="Refresh shifts"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                'border border-surface-400 text-surface-500 bg-surface-200/60',
                'hover:text-surface-300 hover:border-surface-300 transition-all disabled:opacity-50'
              )}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
              />
              Refresh
            </button>
          </div>
          <p className="text-sm text-surface-500 font-mono">
            Topics where recent votes diverge from the overall consensus —
            updated live.
          </p>
          {data && (
            <p className="text-[11px] font-mono text-surface-600 mt-1">
              Comparing last 24h against all-time average · {totalShifts} shift
              {totalShifts !== 1 ? 's' : ''} detected
            </p>
          )}
        </div>

        {/* ── Category filter ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center gap-1.5 mb-4 overflow-x-auto',
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
          )}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-mono font-medium',
                'border transition-all duration-150',
                category === cat
                  ? 'bg-purple/20 text-purple border-purple/40'
                  : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Tab toggle ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-5 bg-surface-200/80 border border-surface-300 rounded-xl p-1 backdrop-blur-sm">
          {(
            [
              { id: 'all', label: 'All Shifts', icon: Sparkles },
              { id: 'for', label: 'Surging For', icon: ThumbsUp },
              { id: 'against', label: 'Surging Against', icon: ThumbsDown },
            ] as { id: TabId; label: string; icon: typeof Sparkles }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg',
                'text-xs font-mono font-semibold transition-all duration-150',
                tab === id
                  ? id === 'for'
                    ? 'bg-for-600 text-white shadow-sm'
                    : id === 'against'
                    ? 'bg-against-600 text-white shadow-sm'
                    : 'bg-purple/80 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">
                {id === 'all' ? 'All' : id === 'for' ? 'For' : 'Against'}
              </span>
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <ShiftsSkeleton />
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            title="Could not load shifts"
            description="Check your connection and try again."
            actions={[{ label: 'Retry', onClick: handleRefresh }]}
          />
        ) : totalShifts === 0 ? (
          <EmptyState
            icon={Flame}
            title="No opinion shifts detected"
            description="All topics are voting in line with their historical consensus right now. Check back soon."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${tab}-${category}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Surging For section */}
              {(tab === 'all' || tab === 'for') && surgingFor.length > 0 && (
                <section>
                  <SectionHeader direction="for" count={surgingFor.length} />
                  <div className="space-y-2">
                    {surgingFor.map((topic, idx) => (
                      <ShiftCard
                        key={topic.id}
                        topic={topic}
                        direction="for"
                        idx={idx}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Surging Against section */}
              {(tab === 'all' || tab === 'against') &&
                surgingAgainst.length > 0 && (
                  <section>
                    <SectionHeader
                      direction="against"
                      count={surgingAgainst.length}
                    />
                    <div className="space-y-2">
                      {surgingAgainst.map((topic, idx) => (
                        <ShiftCard
                          key={topic.id}
                          topic={topic}
                          direction="against"
                          idx={idx}
                        />
                      ))}
                    </div>
                  </section>
                )}

              {/* Empty for active tab */}
              {tab === 'for' && surgingFor.length === 0 && (
                <EmptyState
                  icon={ThumbsUp}
                  title="No topics surging For right now"
                  description="No topics are seeing unusually high blue vote rates in the past 24 hours."
                />
              )}
              {tab === 'against' && surgingAgainst.length === 0 && (
                <EmptyState
                  icon={ThumbsDown}
                  title="No topics surging Against right now"
                  description="No topics are seeing unusually high red vote rates in the past 24 hours."
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── How it works callout ────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <BarChart2 className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-mono font-semibold text-white mb-1">
                How opinion shifts work
              </p>
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                Each topic&apos;s recent vote direction (last 24h) is compared
                to its all-time consensus. A shift is flagged when the gap
                exceeds 8 percentage points — revealing where community opinion
                is actively moving.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <Link
                  href="/momentum"
                  className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  <TrendingUp className="h-3 w-3" />
                  Vote Momentum
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/split"
                  className="flex items-center gap-1 text-[11px] font-mono text-purple hover:text-purple/80 transition-colors"
                >
                  <Scale className="h-3 w-3" />
                  The Split
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
