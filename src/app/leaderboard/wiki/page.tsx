'use client'

/**
 * /leaderboard/wiki — Wiki Hall of Fame
 *
 * Ranks the platform's top wiki contributors by edits made and topics improved.
 * Three tabs:
 *   Editors     — top users by edit count and chars added
 *   Topics      — most-edited topics with editor diversity
 *   Recent      — live feed of the latest wiki edits
 *
 * Distinct from /topic/wiki/recent (per-topic history) — this is the
 * platform-wide view celebrating knowledge-builders.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Crown,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  Medal,
  RefreshCw,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  WikiEditor,
  MostEditedTopic,
  RecentWikiEdit,
  WikiLeaderboardResponse,
} from '@/app/api/leaderboard/wiki/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  person:        'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elder',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  person:        'Citizen',
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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Rank medal helpers ───────────────────────────────────────────────────────

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-gold" aria-label="1st place" />
  if (rank === 2) return <Medal className="h-5 w-5 text-surface-300" aria-label="2nd place" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" aria-label="3rd place" />
  return (
    <span className="text-xs font-mono text-surface-500 tabular-nums w-5 text-center">
      {rank}
    </span>
  )
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'editors' | 'topics' | 'recent'

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-xl" />
      ))}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Edit3
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-mono', color)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <AnimatedNumber
        value={value}
        className="text-2xl font-mono font-bold text-white tabular-nums"
        formatter={fmtNum}
      />
    </div>
  )
}

// ─── Editors tab ─────────────────────────────────────────────────────────────

function EditorsTab({ editors }: { editors: WikiEditor[] }) {
  if (editors.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No wiki editors yet"
        description="Be the first to improve a topic's wiki page and claim the top spot."
      />
    )
  }

  return (
    <div className="space-y-2">
      {editors.map((editor, idx) => (
        <motion.div
          key={editor.user_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03, duration: 0.25 }}
        >
          <Link
            href={`/profile/${editor.username}`}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl',
              'bg-surface-100 border border-surface-300',
              'hover:border-surface-400 hover:bg-surface-200/60',
              'transition-all group',
            )}
          >
            {/* Rank */}
            <div className="flex-shrink-0 w-6 flex items-center justify-center">
              <RankDisplay rank={editor.rank} />
            </div>

            {/* Avatar */}
            <Avatar
              src={editor.avatar_url}
              fallback={editor.display_name || editor.username}
              size="sm"
              className="flex-shrink-0"
            />

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
                  {editor.display_name || editor.username}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-mono hidden sm:block',
                    ROLE_COLOR[editor.role] ?? 'text-surface-500'
                  )}
                >
                  {ROLE_LABEL[editor.role] ?? editor.role}
                </span>
              </div>
              <span className="text-xs text-surface-500 font-mono">@{editor.username}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-shrink-0 text-right">
              <div className="hidden sm:block">
                <div className="text-xs text-surface-500 font-mono">topics</div>
                <div className="text-sm font-mono font-bold text-white">
                  {editor.topics_edited}
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="text-xs text-surface-500 font-mono">chars</div>
                <div className="text-sm font-mono font-bold text-emerald">
                  +{fmtNum(editor.chars_added)}
                </div>
              </div>
              <div>
                <div className="text-xs text-surface-500 font-mono">edits</div>
                <div className="text-sm font-mono font-bold text-for-400">
                  {editor.total_edits}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Topics tab ───────────────────────────────────────────────────────────────

function TopicsTab({ topics }: { topics: MostEditedTopic[] }) {
  if (topics.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No wiki edits yet"
        description="Edit a topic's wiki page to start building the civic knowledge base."
      />
    )
  }

  return (
    <div className="space-y-2">
      {topics.map((topic, idx) => (
        <motion.div
          key={topic.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03, duration: 0.25 }}
        >
          <Link
            href={`/topic/wiki/${topic.id}`}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl',
              'bg-surface-100 border border-surface-300',
              'hover:border-surface-400 hover:bg-surface-200/60',
              'transition-all group',
            )}
          >
            {/* Rank */}
            <div className="flex-shrink-0 w-6 flex items-center justify-center mt-0.5">
              <RankDisplay rank={topic.rank} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                {topic.category && (
                  <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                    {topic.category}
                  </span>
                )}
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px]">
                  {topic.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm font-medium text-white truncate group-hover:text-for-300 transition-colors leading-snug">
                {topic.statement}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-surface-500 font-mono">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {topic.unique_editors} editor{topic.unique_editors !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime(topic.last_edited_at)}
                </span>
              </div>
            </div>

            {/* Counts */}
            <div className="flex items-center gap-4 flex-shrink-0 text-right">
              <div className="hidden sm:block">
                <div className="text-xs text-surface-500 font-mono">chars</div>
                <div className="text-sm font-mono font-bold text-emerald">
                  +{fmtNum(topic.chars_added)}
                </div>
              </div>
              <div>
                <div className="text-xs text-surface-500 font-mono">edits</div>
                <div className="text-sm font-mono font-bold text-for-400">
                  {topic.total_edits}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Recent edits tab ─────────────────────────────────────────────────────────

function RecentTab({ edits }: { edits: RecentWikiEdit[] }) {
  if (edits.length === 0) {
    return (
      <EmptyState
        icon={Edit3}
        title="No recent edits"
        description="Wiki edits will appear here in real-time."
      />
    )
  }

  return (
    <div className="space-y-2">
      {edits.map((edit, idx) => (
        <motion.div
          key={edit.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.02, duration: 0.2 }}
          className={cn(
            'flex items-start gap-3 p-3 rounded-xl',
            'bg-surface-100 border border-surface-300',
          )}
        >
          {/* Editor avatar */}
          {edit.editor_username ? (
            <Link href={`/profile/${edit.editor_username}`} className="flex-shrink-0">
              <Avatar
                src={edit.editor_avatar_url}
                fallback={edit.editor_display_name || edit.editor_username}
                size="sm"
              />
            </Link>
          ) : (
            <div className="h-8 w-8 rounded-full bg-surface-300 flex-shrink-0" />
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap mb-0.5">
              {edit.editor_username ? (
                <Link
                  href={`/profile/${edit.editor_username}`}
                  className="text-sm font-semibold text-white hover:text-for-300 transition-colors"
                >
                  {edit.editor_display_name || edit.editor_username}
                </Link>
              ) : (
                <span className="text-sm text-surface-500 italic">Deleted user</span>
              )}
              <span className="text-xs text-surface-500">edited</span>
            </div>

            <Link
              href={`/topic/wiki/${edit.topic_id}`}
              className="text-sm text-surface-300 hover:text-white transition-colors line-clamp-2 leading-snug"
            >
              {edit.topic_statement}
            </Link>

            <div className="flex items-center gap-3 mt-1 text-[11px] text-surface-500 font-mono">
              {edit.topic_category && (
                <span className={CATEGORY_COLOR[edit.topic_category] ?? 'text-surface-500'}>
                  {edit.topic_category}
                </span>
              )}
              <span className={cn(
                'font-mono text-xs',
                edit.char_delta > 0 ? 'text-emerald' : edit.char_delta < 0 ? 'text-against-400' : 'text-surface-500'
              )}>
                {edit.char_delta > 0 ? '+' : ''}{edit.char_delta} chars
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(edit.created_at)}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WikiLeaderboardPage() {
  const [data, setData] = useState<WikiLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('editors')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/wiki', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as WikiLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load wiki leaderboard. Try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const TABS: Array<{ id: Tab; label: string; icon: typeof Edit3 }> = [
    { id: 'editors', label: 'Top Editors', icon: Crown },
    { id: 'topics',  label: 'Most Edited', icon: BookOpen },
    { id: 'recent',  label: 'Recent',      icon: Clock },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Link
              href="/leaderboard"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              aria-label="Back to leaderboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30">
                  <Edit3 className="h-4 w-4 text-purple" />
                </div>
                <h1 className="font-mono text-2xl font-bold text-white">Wiki Hall of Fame</h1>
              </div>
              <p className="text-sm text-surface-500 font-mono">
                Citizens building the civic knowledge base — one edit at a time
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {refreshing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>

        {/* Stats bar */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Edit3}    label="Total edits"      value={data.stats.total_edits}         color="text-for-400" />
            <StatCard icon={Users}    label="Contributors"     value={data.stats.total_editors}        color="text-purple" />
            <StatCard icon={FileText} label="Topics improved"  value={data.stats.total_topics_edited}  color="text-emerald" />
            <StatCard icon={Zap}      label="Avg chars/edit"   value={data.stats.avg_chars_per_edit}   color="text-gold" />
          </div>
        )}

        {/* Tab selector */}
        <div
          role="tablist"
          aria-label="Wiki leaderboard views"
          className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-6"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg',
                  'text-xs font-mono font-semibold transition-all',
                  tab === t.id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading && <SkeletonRows />}

        {error && (
          <div className="text-center py-12">
            <p className="text-against-400 text-sm font-mono mb-4">{error}</p>
            <button
              onClick={() => load()}
              className="px-4 py-2 bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'editors' && <EditorsTab editors={data.topEditors} />}
              {tab === 'topics'  && <TopicsTab  topics={data.mostEditedTopics} />}
              {tab === 'recent'  && <RecentTab  edits={data.recentEdits} />}
            </motion.div>
          </AnimatePresence>
        )}

        {/* CTA */}
        {!loading && !error && (
          <div className="mt-8 p-4 rounded-xl bg-purple/10 border border-purple/20 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/20 border border-purple/30 flex-shrink-0">
              <Edit3 className="h-5 w-5 text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Build the civic record</p>
              <p className="text-xs text-surface-500 font-mono mt-0.5">
                Open any topic, tap &ldquo;Wiki&rdquo;, and add context to earn your place on this board.
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-mono text-purple hover:text-purple/80 transition-colors flex-shrink-0"
            >
              Browse topics
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
