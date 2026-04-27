'use client'

/**
 * /leaderboard/laws — Laws Hall of Fame
 *
 * Five ranked views of all laws that have been established by democratic vote:
 *   Most Democratic  — highest total vote count (most community participation)
 *   Unanimous        — highest % FOR (strongest consensus)
 *   Hard-Won         — narrowest winning margin (passed but barely)
 *   Most Debated     — most arguments written on the topic
 *   Fastest Passed   — shortest time from proposal to law
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawEntry, LawSortBy, LawsLeaderboardResponse } from '@/app/api/leaderboard/laws/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 110): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const w = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  const yr = Math.floor(d / 365)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  if (mo < 12) return `${mo}mo ago`
  return `${yr}y ago`
}

function durationLabel(days: number): string {
  if (days < 1) return '< 1 day'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? '1 week' : `${weeks} weeks`
}

// ─── Category colours ─────────────────────────────────────────────────────────

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

function catColor(c: string | null) {
  return CATEGORY_COLOR[c ?? ''] ?? 'text-surface-500'
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex items-center justify-center h-7 w-7 rounded-md bg-gold/15 border border-gold/30 text-gold font-mono font-bold text-sm flex-shrink-0">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="flex items-center justify-center h-7 w-7 rounded-md bg-surface-300/40 border border-surface-400/30 text-surface-300 font-mono font-bold text-sm flex-shrink-0">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="flex items-center justify-center h-7 w-7 rounded-md bg-amber-700/20 border border-amber-700/30 text-amber-500 font-mono font-bold text-sm flex-shrink-0">
        3
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center h-7 w-7 rounded-md bg-surface-200/40 border border-surface-400/20 text-surface-500 font-mono text-sm flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function MiniVoteBar({ bluePct }: { bluePct: number }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-against-900/40 w-24" aria-hidden="true">
      <div className="bg-for-500 rounded-full" style={{ width: `${bluePct}%` }} />
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

interface TabConfig {
  id: LawSortBy
  label: string
  icon: typeof Vote
  iconColor: string
  description: string
  metricLabel: string
  metricFn: (l: LawEntry) => string
  metricSublabel?: (l: LawEntry) => string
}

const TABS: TabConfig[] = [
  {
    id: 'most_voted',
    label: 'Most Voted',
    icon: Vote,
    iconColor: 'text-for-400',
    description: 'Laws with the highest community participation',
    metricLabel: 'votes',
    metricFn: (l) => fmtNumber(l.total_votes),
    metricSublabel: (l) => `${Math.round(l.blue_pct)}% FOR`,
  },
  {
    id: 'unanimous',
    label: 'Unanimous',
    icon: ThumbsUp,
    iconColor: 'text-emerald',
    description: 'Laws with the broadest consensus support',
    metricLabel: '% FOR',
    metricFn: (l) => `${Math.round(l.blue_pct)}%`,
    metricSublabel: (l) => `${fmtNumber(l.total_votes)} votes`,
  },
  {
    id: 'hard_won',
    label: 'Hard-Won',
    icon: Swords,
    iconColor: 'text-against-400',
    description: 'Laws that passed with the narrowest margin',
    metricLabel: 'margin',
    metricFn: (l) => `${Math.round(l.blue_pct)}% FOR`,
    metricSublabel: (l) => `${fmtNumber(l.total_votes)} votes`,
  },
  {
    id: 'most_debated',
    label: 'Most Debated',
    icon: MessageSquare,
    iconColor: 'text-purple',
    description: 'Laws that sparked the most arguments',
    metricLabel: 'arguments',
    metricFn: (l) => fmtNumber(l.argument_count),
    metricSublabel: (l) => `${Math.round(l.blue_pct)}% FOR`,
  },
  {
    id: 'fastest',
    label: 'Fastest',
    icon: Zap,
    iconColor: 'text-gold',
    description: 'Laws that reached consensus in record time',
    metricLabel: 'days',
    metricFn: (l) => durationLabel(l.days_to_law),
    metricSublabel: (l) => relativeTime(l.established_at),
  },
]

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({
  law,
  tab,
  index,
}: {
  law: LawEntry
  tab: TabConfig
  index: number
}) {
  const metric = tab.metricFn(law)
  const subMetric = tab.metricSublabel?.(law)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <Link
        href={`/topic/${law.topic_id}`}
        className={cn(
          'flex items-start gap-3 rounded-xl border bg-surface-100 p-4',
          'hover:bg-surface-200 hover:border-surface-400 transition-colors group',
          law.rank <= 3
            ? 'border-surface-400/60'
            : 'border-surface-300',
        )}
      >
        {/* Rank */}
        <RankBadge rank={law.rank} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Category + date */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="law" className="text-[10px] py-0">LAW</Badge>
            {law.category && (
              <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', catColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {relativeTime(law.established_at)}
            </span>
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-snug mb-2 group-hover:text-for-300 transition-colors">
            {truncate(law.statement)}
          </p>

          {/* Vote bar + stats */}
          <div className="flex items-center gap-3">
            <MiniVoteBar bluePct={Math.round(law.blue_pct)} />
            <span className="text-[10px] font-mono text-for-400">
              {Math.round(law.blue_pct)}%
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {fmtNumber(law.total_votes)} votes
            </span>
            {law.argument_count > 0 && (
              <span className="text-[10px] font-mono text-surface-500">
                {fmtNumber(law.argument_count)} args
              </span>
            )}
          </div>
        </div>

        {/* Metric */}
        <div className="flex-shrink-0 text-right min-w-[60px]">
          <p className="text-base font-mono font-bold text-white">{metric}</p>
          {subMetric && (
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">{subMetric}</p>
          )}
        </div>

        <ChevronRight
          className="h-4 w-4 text-surface-600 group-hover:text-surface-300 transition-colors flex-shrink-0 mt-1"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-4">
      <Skeleton className="h-7 w-7 rounded-md flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex gap-2 items-center">
          <Skeleton className="h-4 w-10 rounded-full" />
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-3 w-12 rounded ml-auto" />
        </div>
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
        <div className="flex gap-3">
          <Skeleton className="h-1.5 w-24 rounded-full" />
          <Skeleton className="h-3 w-10 rounded" />
          <Skeleton className="h-3 w-14 rounded" />
        </div>
      </div>
      <div className="flex-shrink-0 text-right space-y-1">
        <Skeleton className="h-5 w-14 rounded ml-auto" />
        <Skeleton className="h-3 w-10 rounded ml-auto" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawsLeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LawSortBy>('most_voted')
  const [laws, setLaws] = useState<LawEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (sort: LawSortBy, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/leaderboard/laws?sort=${sort}&limit=50`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: LawsLeaderboardResponse = await res.json()
        setLaws(data.laws)
        setTotal(data.total)
      } catch {
        setError('Could not load the laws leaderboard.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(activeTab)
  }, [activeTab, load])

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/leaderboard"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Gavel className="h-5 w-5 text-gold" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">
              Laws Hall of Fame
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {loading ? 'Loading…' : `${total.toLocaleString()} laws established`}
            </p>
          </div>

          <button
            onClick={() => load(activeTab, true)}
            disabled={loading || refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh rankings"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Stat pills ────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/20">
              <Trophy className="h-3 w-3 text-gold" aria-hidden="true" />
              <span className="text-xs font-mono text-gold font-semibold">
                {total.toLocaleString()} laws
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-for-500/10 border border-for-500/20">
              <Scale className="h-3 w-3 text-for-400" aria-hidden="true" />
              <span className="text-xs font-mono text-for-400 font-semibold">
                established by vote
              </span>
            </div>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div
          className="flex gap-1.5 mb-5 flex-wrap"
          role="tablist"
          aria-label="Sort laws by"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
                  isActive
                    ? 'bg-for-600 text-white'
                    : 'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-surface-200',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-white' : tab.iconColor)} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab description ───────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-mono text-surface-500 mb-4"
          >
            {currentTab.description}
          </motion.p>
        </AnimatePresence>

        {/* ── Content ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Scale className="h-8 w-8 text-surface-500" />
            <p className="text-sm font-mono text-surface-400">{error}</p>
            <button
              onClick={() => load(activeTab)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : laws.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No laws yet"
            description="Laws appear here once topics pass their final vote. Be part of history — vote on active topics."
            actions={[
              { label: 'Browse Topics', href: '/', variant: 'primary' },
              { label: 'The Floor', href: '/floor', variant: 'secondary' },
            ]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {laws.map((law, i) => (
                <LawRow key={law.id} law={law} tab={currentTab} index={i} />
              ))}

              {/* Footer link */}
              {laws.length > 0 && (
                <div className="pt-4 text-center">
                  <Link
                    href="/law"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Browse all laws in the Codex
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
