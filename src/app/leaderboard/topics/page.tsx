'use client'

/**
 * /leaderboard/topics — Topic Rankings
 *
 * Five ranked views of the debate corpus:
 *   Most Voted     — topics with the highest total vote count
 *   Most Viewed    — topics with the most page views
 *   Most Contested — topics closest to a 50/50 split (deadlocked debates)
 *   Trending       — topics with the highest feed_score right now
 *   Fastest Laws   — laws that reached consensus in the fewest days
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Crown,
  Eye,
  Flame,
  Gavel,
  Medal,
  RefreshCw,
  Swords,
  ThumbsUp,
  Trophy,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TopicRanked,
  LawRanked,
  TopicsLeaderboardResponse,
} from '@/app/api/leaderboard/topics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 90): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function contestedScore(bluePct: number): number {
  return 50 - Math.abs(bluePct - 50)
}

// ─── Status & category configs ────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
}

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

function catColor(c: string | null) {
  return CATEGORY_COLOR[c ?? ''] ?? 'text-surface-500'
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = 'byVotes' | 'byViews' | 'controversial' | 'trending' | 'fastestLaws'

interface TabConfig {
  id: TabId
  label: string
  icon: typeof Vote
  iconColor: string
  metricLabel: string
  description: string
}

const TABS: TabConfig[] = [
  {
    id: 'byVotes',
    label: 'Most Voted',
    icon: Vote,
    iconColor: 'text-for-400',
    metricLabel: 'votes',
    description: 'Most democratic participation',
  },
  {
    id: 'byViews',
    label: 'Most Viewed',
    icon: Eye,
    iconColor: 'text-purple',
    metricLabel: 'views',
    description: 'Topics drawing the most attention',
  },
  {
    id: 'controversial',
    label: 'Most Contested',
    icon: Swords,
    iconColor: 'text-against-400',
    metricLabel: 'contested',
    description: 'Closest to a 50/50 deadlock',
  },
  {
    id: 'trending',
    label: 'Trending',
    icon: Flame,
    iconColor: 'text-gold',
    metricLabel: 'score',
    description: 'Highest activity right now',
  },
  {
    id: 'fastestLaws',
    label: 'Fastest Laws',
    icon: Gavel,
    iconColor: 'text-emerald',
    metricLabel: 'days to law',
    description: 'Laws reached in record time',
  },
]

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gold/20 border border-gold/40 flex-shrink-0">
        <Crown className="h-4 w-4 text-gold" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-400/30 border border-surface-500/40 flex-shrink-0">
        <Medal className="h-4 w-4 text-surface-300" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-800/20 border border-amber-700/40 flex-shrink-0">
        <Trophy className="h-4 w-4 text-amber-600" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-200 border border-surface-300 flex-shrink-0">
      <span className="font-mono text-xs font-bold text-surface-500">{rank}</span>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function MiniVoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right">{forPct}%</span>
      <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7">{againstPct}%</span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  rank,
  metric,
  metricLabel,
}: {
  topic: TopicRanked
  rank: number
  metric: React.ReactNode
  metricLabel: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.02 }}
    >
      <Link href={`/topic/${topic.id}`}>
        <div
          className={cn(
            'group flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-150',
            'bg-surface-100 border-surface-300 hover:bg-surface-200 hover:border-surface-400',
            rank <= 3 && 'border-surface-400/60'
          )}
        >
          <RankBadge rank={rank} />

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                {topic.status === 'voting' ? 'Voting' : topic.status === 'law' ? 'LAW' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
              </Badge>
              {topic.category && (
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor(topic.category))}>
                  {topic.category}
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors mb-1.5">
              {truncate(topic.statement)}
            </p>

            {/* Vote bar */}
            <MiniVoteBar bluePct={topic.blue_pct} />
          </div>

          {/* Metric value */}
          <div className="flex-shrink-0 text-right">
            <p className="font-mono text-base font-bold text-white">{metric}</p>
            <p className="text-[10px] font-mono text-surface-500">{metricLabel}</p>
          </div>

          <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 group-hover:text-surface-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({ law, rank }: { law: LawRanked; rank: number }) {
  const daysLabel = law.days_to_law === 0 ? 'same day' : `${law.days_to_law}d`
  const speedClass =
    law.days_to_law === 0
      ? 'text-emerald'
      : law.days_to_law <= 3
      ? 'text-emerald'
      : law.days_to_law <= 7
      ? 'text-gold'
      : 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.02 }}
    >
      <Link href={`/topic/${law.topic_id}`}>
        <div
          className={cn(
            'group flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-150',
            'bg-surface-100 border-surface-300 hover:bg-surface-200 hover:border-surface-400',
            rank <= 3 && 'border-surface-400/60'
          )}
        >
          <RankBadge rank={rank} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="law">LAW</Badge>
              {law.category && (
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor(law.category))}>
                  {law.category}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug group-hover:text-emerald transition-colors mb-1.5">
              {truncate(law.statement)}
            </p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-for-400" />
                {Math.round(law.blue_pct)}% FOR
              </span>
              <span className="flex items-center gap-1">
                <Vote className="h-3 w-3" />
                {fmtNumber(law.total_votes)} votes
              </span>
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className={cn('font-mono text-base font-bold', speedClass)}>{daysLabel}</p>
            <p className="text-[10px] font-mono text-surface-500">to law</p>
          </div>

          <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 group-hover:text-surface-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RankingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3.5">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicsLeaderboardPage() {
  const router = useRouter()
  const [data, setData] = useState<TopicsLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('byVotes')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/topics')
      if (!res.ok) throw new Error('Failed to load rankings')
      const json = (await res.json()) as TopicsLeaderboardResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const currentTab = TABS.find((t) => t.id === activeTab)!

  // ─── Render topic rows for the active tab ──────────────────────────────────
  function renderRows() {
    if (!data) return null

    if (activeTab === 'fastestLaws') {
      if (data.fastestLaws.length === 0) {
        return (
          <EmptyState
            icon={Gavel}
            iconColor="text-emerald/60"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/20"
            title="No laws yet"
            description="Laws will appear here once topics reach consensus."
          />
        )
      }
      return (
        <div className="space-y-2">
          {data.fastestLaws.map((law, i) => (
            <LawRow key={law.id} law={law} rank={i + 1} />
          ))}
        </div>
      )
    }

    const list = data[activeTab] as TopicRanked[]
    if (list.length === 0) {
      return (
        <EmptyState
          icon={BarChart2}
          iconColor="text-surface-500"
          iconBg="bg-surface-200"
          iconBorder="border-surface-300"
          title="No data yet"
          description="Rankings will appear as the Lobby grows."
        />
      )
    }

    return (
      <div className="space-y-2">
        {list.map((topic, i) => {
          const rank = i + 1
          let metric: React.ReactNode
          let metricLabel: string

          if (activeTab === 'byVotes') {
            metric = fmtNumber(topic.total_votes)
            metricLabel = 'votes'
          } else if (activeTab === 'byViews') {
            metric = fmtNumber(topic.view_count)
            metricLabel = 'views'
          } else if (activeTab === 'controversial') {
            const score = contestedScore(topic.blue_pct)
            metric = `${score.toFixed(0)}%`
            metricLabel = 'contested'
          } else {
            // trending
            metric = topic.feed_score.toFixed(1)
            metricLabel = 'score'
          }

          return (
            <TopicRow
              key={topic.id}
              topic={topic}
              rank={rank}
              metric={metric}
              metricLabel={metricLabel}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.push('/leaderboard')}
              aria-label="Back to leaderboard"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-600/15 border border-for-600/30">
                <BarChart2 className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Topic Rankings</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Which debates define the Lobby
                </p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-3 mt-4 pl-12">
            <Link
              href="/leaderboard"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Citizens
            </Link>
            <span className="text-surface-600 text-xs">·</span>
            <span className="text-xs font-mono text-for-300 font-semibold">Topics</span>
            <span className="text-surface-600 text-xs">·</span>
            <Link
              href="/leaderboard/week"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              This Week
            </Link>
            <span className="text-surface-600 text-xs">·</span>
            <Link
              href="/leaderboard/categories"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              By Category
            </Link>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center gap-1 mb-5 overflow-x-auto',
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
          )}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold flex-shrink-0 transition-all duration-150 border',
                  isActive
                    ? 'bg-surface-200 text-white border-surface-400'
                    : 'bg-transparent text-surface-500 border-transparent hover:text-surface-300 hover:bg-surface-200/50'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? tab.iconColor : 'text-surface-600')} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab description ──────────────────────────────────────────────── */}
        <p className="text-xs font-mono text-surface-500 mb-4 px-1">
          {currentTab.description}
        </p>

        {/* ── Refresh button ───────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-mono text-surface-600">
              {(data[activeTab === 'fastestLaws' ? 'fastestLaws' : activeTab] as unknown[]).length} results
            </span>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              aria-label="Refresh rankings"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <RankingSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderRows()}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
