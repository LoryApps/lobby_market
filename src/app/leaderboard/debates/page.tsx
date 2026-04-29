'use client'

/**
 * /leaderboard/debates — Debate Hall of Fame
 *
 * Five ranked views of all completed debates on Lobby Market:
 *   Most Watched   — highest total viewer count (crowd favourites)
 *   Most Decisive  — debates where the sway moved furthest from 50/50
 *   Longest        — by duration (most enduring battles)
 *   Most Active    — most messages exchanged (hottest rooms)
 *   Recent         — newest completed debates
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Clock,
  Crown,
  Eye,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DebateEntry, DebatesLeaderboardResponse, DebateSortBy } from '@/app/api/leaderboard/debates/route'

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
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function fmtDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtNumber(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

const TYPE_LABEL: Record<string, string> = {
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

const TYPE_COLOR: Record<string, string> = {
  quick: 'text-for-400',
  grand: 'text-gold',
  tribunal: 'text-purple',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const ROLE_COLOR: Record<string, string> = {
  elder:        'text-gold',
  debator:      'text-for-400',
  troll_catcher:'text-emerald',
  person:       'text-surface-500',
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Trophy className="h-4 w-4 text-surface-400 flex-shrink-0" />
  if (rank === 3) return <Trophy className="h-4 w-4 text-[#cd7f32] flex-shrink-0" />
  return (
    <span className="text-xs font-mono text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── Sway bar ─────────────────────────────────────────────────────────────────

function SwayBar({ blue_sway, red_sway }: { blue_sway: number; red_sway: number }) {
  const total = blue_sway + red_sway || 100
  const bluePct = Math.round((blue_sway / total) * 100)
  const redPct = 100 - bluePct

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right">{bluePct}%</span>
      <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-surface-300">
        <div
          className="bg-for-500 transition-all duration-500"
          style={{ width: `${bluePct}%` }}
        />
        <div
          className="bg-against-500 flex-1 transition-all duration-500"
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7">{redPct}%</span>
    </div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({
  debate,
  index,
}: {
  debate: DebateEntry
  sort?: DebateSortBy
  index: number
}) {
  const catColor = CATEGORY_COLOR[debate.topic?.category ?? ''] ?? 'text-surface-500'
  const typeColor = TYPE_COLOR[debate.type] ?? 'text-surface-500'
  const typeLabel = TYPE_LABEL[debate.type] ?? debate.type
  const roleCls = ROLE_COLOR[debate.creator?.role ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className={cn(
          'group flex items-start gap-3 p-4 rounded-xl border transition-all duration-150',
          'bg-surface-100 border-surface-300',
          'hover:bg-surface-200 hover:border-surface-400',
        )}
      >
        {/* Rank */}
        <div className="pt-0.5 flex-shrink-0 w-5 flex justify-center">
          <RankBadge rank={debate.rank} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-mono font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {debate.title}
            </p>
            <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0 mt-0.5" />
          </div>

          {/* Topic */}
          {debate.topic && (
            <p className={cn('text-xs font-mono truncate', catColor)}>
              {debate.topic.category ? `${debate.topic.category} · ` : ''}
              <span className="text-surface-400">{debate.topic.statement.slice(0, 80)}{debate.topic.statement.length > 80 ? '…' : ''}</span>
            </p>
          )}

          {/* Sway bar */}
          <SwayBar blue_sway={debate.blue_sway} red_sway={debate.red_sway} />

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
            {/* Type badge */}
            <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', typeColor)}>
              {typeLabel}
            </span>

            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400">
              <Eye className="h-3 w-3" />
              {fmtNumber(debate.viewer_count)}
            </span>

            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400">
              <MessageSquare className="h-3 w-3" />
              {fmtNumber(debate.message_count)}
            </span>

            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400">
              <Users className="h-3 w-3" />
              {debate.participant_count}
            </span>

            {debate.duration_minutes > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400">
                <Clock className="h-3 w-3" />
                {fmtDuration(debate.duration_minutes)}
              </span>
            )}

            {debate.ended_at && (
              <span className="text-[10px] font-mono text-surface-500">
                {relativeTime(debate.ended_at)}
              </span>
            )}
          </div>

          {/* Creator */}
          {debate.creator && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Avatar
                src={debate.creator.avatar_url}
                username={debate.creator.username}
                size="xs"
              />
              <span className={cn('text-[10px] font-mono', roleCls)}>
                {debate.creator.display_name ?? `@${debate.creator.username}`}
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function DebateCardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-surface-300 bg-surface-100">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-1.5 w-24 rounded-full" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-12 rounded" />
          <Skeleton className="h-3 w-10 rounded" />
          <Skeleton className="h-3 w-10 rounded" />
        </div>
      </div>
    </div>
  )
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS: {
  id: DebateSortBy
  label: string
  icon: typeof Trophy
  description: string
}[] = [
  {
    id: 'most_watched',
    label: 'Most Watched',
    icon: Eye,
    description: 'Debates that drew the largest crowds',
  },
  {
    id: 'decisive',
    label: 'Most Decisive',
    icon: Swords,
    description: 'Where one side dominated — sway moved furthest from 50/50',
  },
  {
    id: 'longest',
    label: 'Longest',
    icon: Clock,
    description: 'The most enduring battles by total duration',
  },
  {
    id: 'most_active',
    label: 'Most Active',
    icon: Activity,
    description: 'Highest message volume — the hottest rooms',
  },
  {
    id: 'recent',
    label: 'Recent',
    icon: Flame,
    description: 'Latest completed debates',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebatesLeaderboardPage() {
  const [activeSort, setActiveSort] = useState<DebateSortBy>('most_watched')
  const [data, setData] = useState<DebatesLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (sort: DebateSortBy) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboard/debates?sort=${sort}&limit=25`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: DebatesLeaderboardResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load debates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(activeSort)
  }, [activeSort, fetchData])

  const activeTab = TABS.find((t) => t.id === activeSort) ?? TABS[0]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start gap-3">
          <Link
            href="/leaderboard"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-purple" />
              <h1 className="font-mono text-2xl font-bold text-white">Debate Hall of Fame</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {data ? `${data.total} completed debates · ` : ''}
              {activeTab.description}
            </p>
          </div>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Sort debates by"
          className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-none"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeSort
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSort(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap',
                  'transition-all duration-150 flex-shrink-0',
                  isActive
                    ? 'bg-purple/20 text-purple border border-purple/40'
                    : 'bg-surface-200 text-surface-500 border border-surface-300 hover:bg-surface-300 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Refresh ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-surface-500">
            {loading ? 'Loading…' : data ? `${data.debates.length} debates` : ''}
          </p>
          <button
            onClick={() => fetchData(activeSort)}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-against-500/30 bg-against-500/10 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={() => fetchData(activeSort)}
                className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                Try again
              </button>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <DebateCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : !data || data.debates.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Mic}
                title="No completed debates yet"
                description="Debates appear here once they've ended. Check back after the first live debate wraps up."
                action={{ label: 'Browse upcoming debates', href: '/debate' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={activeSort}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {data.debates.map((debate, i) => (
                <DebateCard
                  key={debate.id}
                  debate={debate}
                  index={i}
                />
              ))}

              {/* Footer CTA */}
              <div className="pt-4 flex flex-col items-center gap-3">
                <Link
                  href="/debate"
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono',
                    'bg-purple/10 text-purple border border-purple/30',
                    'hover:bg-purple/20 transition-colors',
                  )}
                >
                  <Zap className="h-4 w-4" />
                  Browse upcoming debates
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-xs font-mono text-surface-500">
                  Updated in real-time as debates conclude
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <BottomNav />
    </div>
  )
}
