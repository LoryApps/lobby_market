'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Flame,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Zap,
  TrendingUp,
  Eye,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ReactionSummary } from '@/app/api/topics/most-reacted/route'

// ─── Reaction config ──────────────────────────────────────────────────────────

type ReactionFilter = 'all' | 'insightful' | 'controversial' | 'complex' | 'surprising'

interface ReactionTab {
  id: ReactionFilter
  label: string
  emoji: string
  color: string
  bg: string
  border: string
  activeText: string
  activeBg: string
  activeBorder: string
  emptyTitle: string
  emptyDesc: string
}

const REACTION_TABS: ReactionTab[] = [
  {
    id: 'all',
    label: 'All Signals',
    emoji: '✦',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/20',
    activeText: 'text-white',
    activeBg: 'bg-surface-300/30',
    activeBorder: 'border-surface-400',
    emptyTitle: 'No community signals yet',
    emptyDesc: 'Be the first to mark a topic as insightful, controversial, complex, or surprising.',
  },
  {
    id: 'insightful',
    label: 'Insightful',
    emoji: '💡',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    activeText: 'text-gold',
    activeBg: 'bg-gold/15',
    activeBorder: 'border-gold/60',
    emptyTitle: 'No insightful topics yet',
    emptyDesc: 'Mark topics as 💡 Insightful to help others find the most thought-provoking debates.',
  },
  {
    id: 'controversial',
    label: 'Controversial',
    emoji: '🔥',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/20',
    activeText: 'text-against-300',
    activeBg: 'bg-against-500/15',
    activeBorder: 'border-against-500/50',
    emptyTitle: 'No controversial topics flagged',
    emptyDesc: 'Mark heated debates with 🔥 to surface the most contentious issues.',
  },
  {
    id: 'complex',
    label: 'Complex',
    emoji: '⚖️',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    activeText: 'text-purple',
    activeBg: 'bg-purple/15',
    activeBorder: 'border-purple/50',
    emptyTitle: 'No complex topics marked',
    emptyDesc: 'Flag nuanced, multi-faceted debates with ⚖️ to help others engage deeply.',
  },
  {
    id: 'surprising',
    label: 'Surprising',
    emoji: '😮',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    activeText: 'text-for-300',
    activeBg: 'bg-for-500/15',
    activeBorder: 'border-for-500/50',
    emptyTitle: 'Nothing surprising yet',
    emptyDesc: 'Mark 😮 Surprising to spotlight debates with unexpected results.',
  },
]

const REACTION_EMOJI: Record<string, string> = {
  insightful: '💡',
  controversial: '🔥',
  complex: '⚖️',
  surprising: '😮',
}

// ─── Status config ────────────────────────────────────────────────────────────

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

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  law: Gavel,
  voting: Scale,
  active: Zap,
  proposed: Sparkles,
  failed: Scale,
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TopicSignalSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2.5 flex-1 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ─── Reaction pill strip ──────────────────────────────────────────────────────

function ReactionStrip({
  reactions,
  total,
  activeFilter,
}: {
  reactions: Record<string, number>
  total: number
  activeFilter: ReactionFilter
}) {
  const entries = (['insightful', 'controversial', 'complex', 'surprising'] as const).filter(
    (r) => reactions[r] > 0,
  )

  if (entries.length === 0) return null

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {entries.map((type) => {
        const isHighlighted = activeFilter === type
        const pct = total > 0 ? Math.round((reactions[type] / total) * 100) : 0
        return (
          <span
            key={type}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border transition-all',
              isHighlighted
                ? type === 'insightful'
                  ? 'bg-gold/20 border-gold/50 text-gold font-semibold'
                  : type === 'controversial'
                    ? 'bg-against-500/20 border-against-500/50 text-against-300 font-semibold'
                    : type === 'complex'
                      ? 'bg-purple/20 border-purple/50 text-purple font-semibold'
                      : 'bg-for-500/20 border-for-500/50 text-for-300 font-semibold'
                : 'bg-surface-200 border-surface-300 text-surface-500',
            )}
          >
            {REACTION_EMOJI[type]}{' '}
            <span>{reactions[type]}</span>
            {isHighlighted && <span className="text-[10px] opacity-70">{pct}%</span>}
          </span>
        )
      })}
      <span className="text-[10px] font-mono text-surface-600 ml-0.5">
        {total} signal{total !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ─── Topic signal card ────────────────────────────────────────────────────────

function TopicSignalCard({
  topic,
  rank,
  activeFilter,
}: {
  topic: ReactionSummary
  rank: number
  activeFilter: ReactionFilter
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const badgeVariant = STATUS_BADGE[topic.status] ?? 'proposed'
  const StatusIcon = STATUS_ICON[topic.status] ?? Sparkles
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'

  const isNearTie = forPct >= 45 && forPct <= 55

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        href={`/topic/${topic.topic_id}`}
        className={cn(
          'group flex items-start gap-4 rounded-2xl border bg-surface-100 p-4 sm:p-5',
          'hover:border-surface-400 hover:bg-surface-100/90',
          'transition-all duration-150',
          activeFilter === 'all'
            ? 'border-surface-300'
            : activeFilter === 'insightful'
              ? 'border-gold/20 hover:border-gold/40'
              : activeFilter === 'controversial'
                ? 'border-against-500/20 hover:border-against-500/40'
                : activeFilter === 'complex'
                  ? 'border-purple/20 hover:border-purple/40'
                  : 'border-for-500/20 hover:border-for-500/40',
        )}
      >
        {/* Rank */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-xs font-mono font-bold mt-0.5',
            rank === 1
              ? 'bg-gold/20 text-gold border border-gold/40'
              : rank === 2
                ? 'bg-surface-300/80 text-surface-600 border border-surface-400'
                : rank === 3
                  ? 'bg-against-500/15 text-against-300 border border-against-500/30'
                  : 'bg-surface-200 text-surface-500 border border-surface-300',
          )}
        >
          {rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-2">
            {topic.category && (
              <span className={cn('text-[11px] font-mono font-medium', catColor)}>
                {topic.category}
              </span>
            )}
            <Badge variant={badgeVariant}>
              <StatusIcon className="h-2.5 w-2.5 mr-1" aria-hidden />
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            {isNearTie && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple/10 border border-purple/30 text-purple">
                Near 50/50
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="font-mono text-sm text-white leading-snug group-hover:text-for-100 transition-colors">
            {topic.statement}
          </p>

          {/* Vote bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-for-400">{forPct}% FOR</span>
              <span className="text-surface-500">{fmtVotes(topic.total_votes)} votes</span>
              <span className="text-against-400">{againstPct}% AGAINST</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-against-600 to-against-400 flex-1 transition-all duration-500"
              />
            </div>
          </div>

          {/* Reaction strip */}
          <ReactionStrip
            reactions={topic.reactions}
            total={topic.total_reactions}
            activeFilter={activeFilter}
          />
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 flex items-center self-center">
          <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReactionsPage() {
  const [activeTab, setActiveTab] = useState<ReactionFilter>('all')
  const [topics, setTopics] = useState<ReactionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchTopics = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const url =
          activeTab === 'all'
            ? '/api/topics/most-reacted?limit=30'
            : `/api/topics/most-reacted?reaction=${activeTab}&limit=30`

        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = (await res.json()) as { topics: ReactionSummary[] }
        setTopics(data.topics ?? [])
        setLastUpdated(new Date())
      } catch {
        setTopics([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeTab],
  )

  useEffect(() => {
    fetchTopics(false)
  }, [fetchTopics])

  const activeTabConfig = REACTION_TABS.find((t) => t.id === activeTab)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Community Signals
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Topics the community has marked as insightful, controversial, complex, or surprising
              </p>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-[11px] font-mono text-surface-600 mt-2 ml-13">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* ── Reaction tabs ────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap mb-5">
          {REACTION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all',
                activeTab === tab.id
                  ? cn(tab.activeText, tab.activeBg, tab.activeBorder)
                  : cn(tab.color, tab.bg, tab.border, 'hover:brightness-110'),
              )}
            >
              <span aria-hidden>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Signal legend ────────────────────────────────────────── */}
        {activeTab === 'all' && !loading && topics.length > 0 && (
          <div className="mb-5 rounded-xl border border-surface-300 bg-surface-100 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['insightful', 'controversial', 'complex', 'surprising'] as const).map((r) => {
              const total = topics.reduce((sum, t) => sum + (t.reactions[r] ?? 0), 0)
              const tab = REACTION_TABS.find((t) => t.id === r)!
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveTab(r)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg transition-all',
                    'bg-surface-200/50 hover:bg-surface-200 border border-surface-300 hover:border-surface-400',
                  )}
                >
                  <span className="text-lg" aria-hidden>
                    {tab.emoji}
                  </span>
                  <span className={cn('text-sm font-mono font-bold', tab.color)}>
                    {total.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono text-surface-500 capitalize">{r}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Refresh button ───────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-surface-500">
            {loading ? '' : `${topics.length} topic${topics.length !== 1 ? 's' : ''}`}
          </p>
          <button
            type="button"
            onClick={() => fetchTopics(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh signals"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            Refresh
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <TopicSignalSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Eye}
            iconColor="text-surface-500"
            iconBg="bg-surface-300/20"
            iconBorder="border-surface-400/20"
            title={activeTabConfig.emptyTitle}
            description={activeTabConfig.emptyDesc}
            actions={[
              { label: 'Browse Topics', href: '/', variant: 'primary' },
            ]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {topics.map((topic, idx) => (
                <TopicSignalCard
                  key={topic.topic_id}
                  topic={topic}
                  rank={idx + 1}
                  activeFilter={activeTab}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Bottom CTA ───────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <div className="mt-8 rounded-xl border border-surface-300 bg-surface-100 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20">
                <Flame className="h-4 w-4 text-for-400" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-mono font-semibold text-white">Explore all debates</p>
                <p className="text-xs font-mono text-surface-500">Vote, argue, and shape consensus</p>
              </div>
            </div>
            <Link
              href="/"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-500/10 border border-for-500/30 text-for-300 hover:bg-for-500/20 text-xs font-mono font-medium transition-colors"
            >
              Feed
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
