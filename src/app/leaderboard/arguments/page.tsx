'use client'

/**
 * /leaderboard/arguments — Argument Hall of Fame
 *
 * Five ranked views of the best arguments in the Lobby:
 *   All-Time Greats  — highest upvote count ever
 *   This Week        — most upvoted arguments posted in the last 7 days
 *   FOR Camp         — best arguments arguing FOR a topic (blue side)
 *   AGAINST Camp     — best arguments arguing AGAINST a topic (red side)
 *   Rising           — trending arguments from the last 48 hours
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Medal,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Calendar,
  Crown,
  ChevronRight,
  Link2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentRanked,
  ArgumentsLeaderboardResponse,
} from '@/app/api/leaderboard/arguments/route'

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

function fmtUpvotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
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

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  person: 'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  person: 'Citizen',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-400 flex-shrink-0" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600 flex-shrink-0" />
  return (
    <span className="text-xs font-mono font-bold text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── Argument row ─────────────────────────────────────────────────────────────

function ArgumentRow({ arg }: { arg: ArgumentRanked }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative rounded-xl border bg-surface-100 p-4',
        'hover:border-surface-400/60 transition-colors',
        isFor ? 'border-for-500/20' : 'border-against-500/20',
      )}
    >
      {/* Top row: rank + side badge + topic */}
      <div className="flex items-start gap-3">
        {/* Rank + avatar column */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
          <RankMedal rank={arg.rank} />
          <Avatar
            src={arg.author?.avatar_url ?? null}
            fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
            size="sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: side pill + category + topic */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {/* FOR / AGAINST pill */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold',
                isFor
                  ? 'bg-for-500/15 text-for-300 border border-for-500/30'
                  : 'bg-against-500/15 text-against-300 border border-against-500/30',
              )}
            >
              {isFor ? (
                <ThumbsUp className="h-2.5 w-2.5" />
              ) : (
                <ThumbsDown className="h-2.5 w-2.5" />
              )}
              {isFor ? 'FOR' : 'AGAINST'}
            </span>

            {/* Topic category */}
            {arg.topic?.category && (
              <span
                className={cn(
                  'text-[11px] font-mono',
                  CATEGORY_COLOR[arg.topic.category] ?? 'text-surface-500',
                )}
              >
                {arg.topic.category}
              </span>
            )}

            {/* Topic status */}
            {arg.topic?.status && STATUS_BADGE[arg.topic.status] && (
              <Badge variant={STATUS_BADGE[arg.topic.status]} className="text-[10px] py-0">
                {arg.topic.status === 'voting' ? 'Voting' : arg.topic.status === 'law' ? 'LAW' : arg.topic.status === 'failed' ? 'Failed' : arg.topic.status === 'active' ? 'Active' : 'Proposed'}
              </Badge>
            )}
          </div>

          {/* Argument content */}
          <p className="text-sm text-surface-700 leading-relaxed mb-2">
            {arg.content}
          </p>

          {/* Source link */}
          {arg.source_url && (
            <a
              href={arg.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Link2 className="h-3 w-3" />
              Source
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}

          {/* Topic link + author + time */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-surface-500">
            {/* Topic */}
            {arg.topic && (
              <Link
                href={`/topic/${arg.topic.id}`}
                className="flex items-center gap-1 hover:text-surface-300 transition-colors truncate max-w-[200px]"
              >
                <MessageSquare className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{arg.topic.statement.slice(0, 60)}{arg.topic.statement.length > 60 ? '…' : ''}</span>
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
              </Link>
            )}

            {/* Author */}
            {arg.author && (
              <Link
                href={`/profile/${arg.author.username}`}
                className={cn(
                  'flex items-center gap-1 hover:text-surface-300 transition-colors',
                  ROLE_COLOR[arg.author.role] ?? 'text-surface-500',
                )}
              >
                {ROLE_LABEL[arg.author.role] ?? 'Citizen'}
                {' · '}
                <span className="text-surface-500">@{arg.author.username}</span>
              </Link>
            )}

            {/* Time */}
            <span>{relativeTime(arg.created_at)}</span>
          </div>
        </div>

        {/* Upvote count */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 min-w-[52px]">
          <div
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-mono font-bold',
              isFor
                ? 'bg-for-500/10 text-for-300'
                : 'bg-against-500/10 text-against-300',
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            {fmtUpvotes(arg.upvotes)}
          </div>
          <span className="text-[10px] font-mono text-surface-500">upvotes</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'allTime' | 'thisWeek' | 'forCamp' | 'againstCamp' | 'rising'

const TABS: {
  id: Tab
  label: string
  icon: typeof Trophy
  color: string
  activeClass: string
}[] = [
  {
    id: 'allTime',
    label: 'All Time',
    icon: Trophy,
    color: 'text-gold',
    activeClass: 'bg-gold/15 border-gold/40 text-gold',
  },
  {
    id: 'thisWeek',
    label: 'This Week',
    icon: Calendar,
    color: 'text-for-400',
    activeClass: 'bg-for-500/15 border-for-500/40 text-for-300',
  },
  {
    id: 'forCamp',
    label: 'FOR Camp',
    icon: ThumbsUp,
    color: 'text-for-400',
    activeClass: 'bg-for-500/15 border-for-500/40 text-for-300',
  },
  {
    id: 'againstCamp',
    label: 'AGAINST Camp',
    icon: ThumbsDown,
    color: 'text-against-400',
    activeClass: 'bg-against-500/15 border-against-500/40 text-against-300',
  },
  {
    id: 'rising',
    label: 'Rising',
    icon: TrendingUp,
    color: 'text-emerald',
    activeClass: 'bg-emerald/15 border-emerald/40 text-emerald',
  },
]

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  allTime: 'The highest-upvoted arguments ever posted in the Lobby.',
  thisWeek: 'Arguments posted in the last 7 days, ranked by upvotes.',
  forCamp: 'The strongest FOR arguments across all topics.',
  againstCamp: 'The strongest AGAINST arguments across all topics.',
  rising: 'Arguments gaining momentum in the last 48 hours.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArgumentsLeaderboardPage() {
  const router = useRouter()
  const [data, setData] = useState<ArgumentsLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('allTime')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/leaderboard/arguments', { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as ArgumentsLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load argument rankings. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeArgs: ArgumentRanked[] = data ? data[activeTab] : []
  const activeTabConfig = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <MessageSquare className="h-5 w-5 text-gold" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white">
              Argument Hall of Fame
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              The most compelling arguments ever made in the Lobby
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh rankings"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────���─── */}
        <div
          className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-hide"
          role="tablist"
          aria-label="Argument ranking views"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                  'border transition-all whitespace-nowrap flex-shrink-0',
                  isActive
                    ? tab.activeClass
                    : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300 bg-surface-200/50',
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab description ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-mono text-surface-500 mb-4"
          >
            {TAB_DESCRIPTIONS[activeTab]}
          </motion.p>
        </AnimatePresence>

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded" />
                    </div>
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-4/5 rounded" />
                    <Skeleton className="h-3 w-3/5 rounded" />
                  </div>
                  <Skeleton className="h-9 w-14 rounded-lg flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {activeArgs.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No arguments yet"
                  description={
                    activeTab === 'rising'
                      ? 'No arguments with upvotes in the last 48 hours.'
                      : activeTab === 'thisWeek'
                      ? 'No upvoted arguments this week — be the first!'
                      : 'Arguments will appear here once they receive upvotes.'
                  }
                  actions={[
                    {
                      label: 'Browse topics',
                      href: '/',
                      variant: 'primary',
                    },
                  ]}
                />
              ) : (
                <div className="space-y-3">
                  {/* Summary strip */}
                  <div className="flex items-center justify-between rounded-lg bg-surface-200/50 border border-surface-300 px-4 py-2.5 mb-4">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = activeTabConfig.icon
                        return <Icon className={cn('h-4 w-4', activeTabConfig.color)} />
                      })()}
                      <span className="text-xs font-mono font-semibold text-white">
                        {activeArgs.length} argument{activeArgs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-surface-500">
                      Top by upvotes
                    </span>
                  </div>

                  {/* Argument rows */}
                  {activeArgs.map((arg) => (
                    <ArgumentRow key={arg.id} arg={arg} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Bottom nav link ────────────────────────────────────────────── */}
        {!loading && !error && data && (
          <div className="mt-8">
            <Link
              href="/leaderboard"
              className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3.5 hover:bg-surface-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-300 flex-shrink-0">
                  <Trophy className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white">
                    Full Leaderboard
                  </p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Top voters, lawmakers, predictors &amp; more
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
