'use client'

/**
 * /changemakers — The Civic Persuasion Hub
 *
 * Platform-wide view of all "What Would Change My Mind?" statements.
 * Surfaces the most open-minded community members, the topics attracting the
 * most genuine persuasion attempts, and the highest-quality conditions that
 * would flip positions.
 *
 * Distinct from:
 *   /topic/[id]/changemaker  — topic-level changemakers for a single debate
 *   /topic/[id]/reasons      — why you voted (past-looking)
 *   /topic/[id]/swing        — who already changed their vote
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  ChevronRight,
  Layers,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ChangemakersResponse,
  TopChangemakerEntry,
  ChangemakerTopicEntry,
  OpenMindUser,
} from '@/app/api/changemakers/route'

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

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

function categoryStyle(cat: string | null) {
  return CATEGORY_STYLE[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-gold' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-against-400' },
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

function ChangemakerCardSkeleton() {
  return (
    <div className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-44" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'top' | 'topics' | 'open-minds' | 'recent'

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
  { id: 'top',        label: 'Top Statements', icon: Sparkles },
  { id: 'topics',     label: 'Active Topics',  icon: Layers },
  { id: 'open-minds', label: 'Open Minds',     icon: Brain },
  { id: 'recent',     label: 'Recent',         icon: Zap },
]

// ─── Changemaker card ──────────────────────────────────────────────────────────

function ChangemakerCard({ entry }: { entry: TopChangemakerEntry }) {
  const cs = categoryStyle(entry.topic_category)
  const isFor = entry.current_vote === 'for'
  const roleColor = ROLE_COLOR[entry.role] ?? 'text-surface-500'
  const statusCfg = STATUS_CONFIG[entry.topic_status] ?? STATUS_CONFIG.active

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-4 space-y-3 hover:border-surface-400/60 transition-colors"
    >
      {/* Author + vote side */}
      <div className="flex items-center gap-2.5">
        <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${entry.username}`} className="group">
            <span className={cn('text-xs font-semibold group-hover:text-white transition-colors', roleColor)}>
              {entry.display_name || entry.username}
            </span>
          </Link>
          <p className="text-[10px] text-surface-500 font-mono truncate">
            @{entry.username} · {relativeTime(entry.created_at)}
          </p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
            isFor
              ? 'bg-for-500/10 border-for-500/30 text-for-400'
              : 'bg-against-500/10 border-against-500/30 text-against-400'
          )}
        >
          {isFor ? 'Voted FOR' : 'Voted AGAINST'}
        </span>
      </div>

      {/* Condition */}
      <blockquote className="text-sm text-surface-600 leading-relaxed pl-3 border-l-2 border-surface-400">
        &ldquo;{entry.condition}&rdquo;
      </blockquote>

      {/* Topic link + stats */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/topic/${entry.topic_id}/changemaker`}
          className="flex-1 min-w-0 group"
        >
          <div className="flex items-center gap-1.5">
            {entry.topic_category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cs.text, cs.bg, cs.border)}>
                {entry.topic_category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono', statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-surface-500 group-hover:text-surface-400 truncate mt-0.5 transition-colors">
            {entry.topic_statement}
          </p>
        </Link>
        <div className="flex-shrink-0 flex items-center gap-1 text-[11px] text-surface-500 font-mono">
          <ThumbsUp className="h-3 w-3" />
          {entry.upvotes}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicChangemakerCard({ entry, rank }: { entry: ChangemakerTopicEntry; rank: number }) {
  const cs = categoryStyle(entry.category)
  const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.active
  const forPct = Math.round((entry.for_count / Math.max(entry.changemaker_count, 1)) * 100)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-4 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className={cn(
          'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold',
          rank <= 2 ? 'bg-gold/20 text-gold' : 'bg-surface-300/50 text-surface-500'
        )}>
          {rank + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {entry.category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cs.text, cs.bg, cs.border)}>
                {entry.category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono', statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>

          <Link href={`/topic/${entry.topic_id}/changemaker`} className="group">
            <p className="text-sm font-medium text-surface-600 group-hover:text-white transition-colors leading-snug line-clamp-2">
              {entry.statement}
            </p>
          </Link>

          {/* For/Against breakdown of changemakers */}
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
              <span className="text-for-400">{entry.for_count} FOR open to change</span>
              <span className="text-against-400">{entry.against_count} AGAINST open to change</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-400/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
              <span>{forPct}% FOR</span>
              <span className="flex items-center gap-1">
                <Brain className="h-2.5 w-2.5" />
                {entry.changemaker_count} total
              </span>
              <span>{againstPct}% AGN</span>
            </div>
          </div>

          {/* Top condition snippet */}
          {entry.top_condition && (
            <p className="mt-2 text-[11px] text-surface-500 italic line-clamp-1 pl-2 border-l border-surface-400">
              &ldquo;{entry.top_condition}&rdquo;
            </p>
          )}
        </div>

        <Link
          href={`/topic/${entry.topic_id}/changemaker`}
          className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300/40 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label="View all changemakers for this topic"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Open mind user card ──────────────────────────────────────────────────────

function OpenMindCard({ user, rank }: { user: OpenMindUser; rank: number }) {
  const roleColor = ROLE_COLOR[user.role] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-3 p-3.5 bg-surface-200/60 border border-surface-300/60 rounded-xl hover:border-surface-400/60 transition-colors"
    >
      {/* Rank */}
      <div className={cn(
        'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold',
        rank === 0 ? 'bg-gold/20 text-gold' :
        rank === 1 ? 'bg-surface-400/30 text-surface-400' :
        rank === 2 ? 'bg-against-500/20 text-against-400' :
        'bg-surface-300/30 text-surface-500'
      )}>
        {rank + 1}
      </div>

      <Link href={`/profile/${user.username}`} className="flex-shrink-0">
        <Avatar src={user.avatar_url} fallback={user.display_name || user.username} size="md" />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profile/${user.username}`} className="group">
          <p className={cn('text-sm font-semibold group-hover:text-white transition-colors', roleColor)}>
            {user.display_name || user.username}
          </p>
        </Link>
        <p className="text-[11px] text-surface-500 font-mono">@{user.username}</p>
        {user.categories.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {user.categories.slice(0, 3).map((cat) => {
              const cs = categoryStyle(cat)
              return (
                <span key={cat} className={cn('text-[9px] px-1.5 py-0.5 rounded border font-mono', cs.text, cs.bg, cs.border)}>
                  {cat}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-white font-mono">{user.statement_count}</p>
        <p className="text-[10px] text-surface-500 font-mono">
          {user.statement_count === 1 ? 'statement' : 'statements'}
        </p>
        <p className="text-[10px] text-gold font-mono mt-0.5">
          {user.total_upvotes} upvotes
        </p>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChangemakersClient() {
  const [data, setData] = useState<ChangemakersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('top')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/changemakers', { cache: 'no-store' })
      if (res.ok) {
        setData(await res.json() as ChangemakersResponse)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = data?.stats
  const topStatements = data?.top_statements ?? []
  const mostActiveTopics = data?.most_active_topics ?? []
  const openMinds = data?.open_minds ?? []
  const recent = data?.recent ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
              aria-label="Back to feed"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple" />
                The Persuasion Hub
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                What would change your mind? The platform&apos;s open-minded community speaks.
              </p>
            </div>
          </div>

          {/* Stats row */}
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => <StatCardSkeleton key={i} />)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center">
                <p className="text-xs font-mono text-surface-500 mb-1">Statements</p>
                <p className="text-2xl font-bold font-mono text-white">
                  {stats.total_statements.toLocaleString()}
                </p>
                <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                  platform-wide
                </p>
              </div>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center">
                <p className="text-xs font-mono text-surface-500 mb-1">Topics</p>
                <p className="text-2xl font-bold font-mono text-white">
                  {stats.total_topics_with_changemakers.toLocaleString()}
                </p>
                <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                  with open minds
                </p>
              </div>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center">
                <p className="text-xs font-mono text-surface-500 mb-1">Citizens</p>
                <p className="text-2xl font-bold font-mono text-white">
                  {stats.total_users_participating.toLocaleString()}
                </p>
                <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                  open to persuasion
                </p>
              </div>
            </div>
          ) : null}

          {/* For/Against breakdown */}
          {stats && stats.total_statements > 0 && (
            <div className="mt-3 rounded-xl bg-surface-100 border border-surface-300 p-3">
              <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 mb-1.5">
                <span className="text-for-400">
                  {stats.for_pct}% Voted FOR — open to change
                </span>
                <span className="text-against-400">
                  {stats.against_pct}% Voted AGAINST — open to change
                </span>
              </div>
              <div className="h-2 rounded-full bg-against-700/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
                  style={{ width: `${stats.for_pct}%` }}
                />
              </div>
              <p className="text-[10px] text-surface-500 font-mono mt-1.5 text-center">
                Both sides are willing to be persuaded. Debate matters.
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-colors flex-shrink-0',
                  isActive
                    ? 'bg-purple/20 border border-purple/40 text-purple'
                    : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            )
          })}
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 bg-surface-200 border border-surface-300 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div key="loading" className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <ChangemakerCardSkeleton key={i} />)}
            </div>
          ) : activeTab === 'top' ? (
            <motion.div key="top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {topStatements.length === 0 ? (
                <EmptyState
                  icon={<Brain className="h-8 w-8 text-purple/50" />}
                  title="No changemakers yet"
                  description="Be the first to declare what evidence or argument would change your mind on a topic."
                  action={<Link href="/topics" className="text-for-400 text-sm hover:text-for-300 transition-colors">Browse topics →</Link>}
                />
              ) : (
                topStatements.map((entry) => (
                  <ChangemakerCard key={entry.id} entry={entry} />
                ))
              )}
            </motion.div>
          ) : activeTab === 'topics' ? (
            <motion.div key="topics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {mostActiveTopics.length === 0 ? (
                <EmptyState
                  icon={<Layers className="h-8 w-8 text-purple/50" />}
                  title="No topics yet"
                  description="Topics with changemaker statements will appear here."
                />
              ) : (
                mostActiveTopics.map((entry, i) => (
                  <TopicChangemakerCard key={entry.topic_id} entry={entry} rank={i} />
                ))
              )}
            </motion.div>
          ) : activeTab === 'open-minds' ? (
            <motion.div key="open-minds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Explanation */}
              <div className="rounded-xl bg-purple/5 border border-purple/20 p-4">
                <div className="flex items-start gap-2.5">
                  <Brain className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-surface-500 leading-relaxed">
                    These citizens have publicly declared what it would take to change their minds.
                    Intellectual honesty is a civic virtue. The most open minds move the most debates.
                  </p>
                </div>
              </div>
              {openMinds.length === 0 ? (
                <EmptyState
                  icon={<Brain className="h-8 w-8 text-purple/50" />}
                  title="No open minds yet"
                  description="Users who submit changemaker statements will appear here."
                />
              ) : (
                openMinds.map((user, i) => (
                  <OpenMindCard key={user.user_id} user={user} rank={i} />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="recent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {recent.length === 0 ? (
                <EmptyState
                  icon={<Zap className="h-8 w-8 text-purple/50" />}
                  title="Nothing recent"
                  description="New changemaker statements will appear here as they're added."
                />
              ) : (
                recent.map((entry) => (
                  <ChangemakerCard key={entry.id} entry={entry} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        {!loading && data && stats && stats.total_statements > 0 && (
          <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center">
            <Brain className="h-8 w-8 text-purple mx-auto mb-3" />
            <h3 className="font-mono font-bold text-white mb-1">
              What would change YOUR mind?
            </h3>
            <p className="text-sm text-surface-500 mb-4">
              Browse active debates and declare the specific evidence or argument
              that would flip your position. Good faith persuasion starts here.
            </p>
            <Link
              href="/topics"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple hover:bg-purple/90 text-white font-mono text-sm font-medium transition-colors"
            >
              Browse Topics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
