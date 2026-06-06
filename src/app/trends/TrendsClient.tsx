'use client'

/**
 * /trends — Civic Trends
 *
 * A cross-signal trends dashboard showing what the Lobby is debating
 * across four lenses:
 *   Topics     — debates with highest vote velocity in the window
 *   Categories — civic domains with most recent engagement
 *   Tags       — keywords appearing across trending debates
 *   Voices     — citizens driving the most discourse
 *
 * Distinct from:
 *   /rising      — new topics gaining early traction (not yet high-volume)
 *   /breaking    — live event-driven alerts (vote surges, flips, laws)
 *   /traction    — multi-signal acceleration composite for individual topics
 *   /seismic     — anomaly detection for vote-rate spikes
 *   /hot-takes   — top arguments by upvotes
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Hash,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Vote,
  Globe,
  Trophy,
  Crown,
  Medal,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TrendWindow,
  TrendingTopic,
  TrendingCategory,
  TrendingTag,
  TrendingVoice,
  TrendsResponse,
} from '@/app/api/trends/route'

// ─── Category config ───────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { icon: typeof Globe; color: string; bg: string; border: string }> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Economics:   { icon: TrendingUp,    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { icon: Scale,         color: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30' },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { icon: Music2,        color: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  Health:      { icon: Heart,         color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { icon: GraduationCap, color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
}

function getCatConfig(name: string) {
  return CAT_CONFIG[name] ?? { icon: Globe, color: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }
}

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500' },
  debator:       { label: 'Debater',      color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',        color: 'text-gold' },
  senator:       { label: 'Senator',      color: 'text-purple' },
  lawmaker:      { label: 'Lawmaker',     color: 'text-gold' },
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500',   bg: 'bg-surface-300/60' },
  active:   { label: 'Active',   color: 'text-for-400',       bg: 'bg-for-500/20' },
  voting:   { label: 'Voting',   color: 'text-gold',          bg: 'bg-gold/20' },
  law:      { label: 'Law',      color: 'text-emerald',       bg: 'bg-emerald/20' },
  failed:   { label: 'Failed',   color: 'text-against-400',   bg: 'bg-against-500/20' },
}

// ─── Window labels ─────────────────────────────────────────────────────────────

const WINDOWS: { value: TrendWindow; label: string }[] = [
  { value: '24h', label: 'Today' },
  { value: '7d',  label: 'This Week' },
  { value: '30d', label: 'This Month' },
]

// ─── Rank medal ────────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-400 flex-shrink-0" />
  if (rank === 3) return <Trophy className="h-4 w-4 text-amber-600 flex-shrink-0" />
  return (
    <span className="w-5 text-center text-xs font-mono font-bold text-surface-500 flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── FOR/AGAINST bar ───────────────────────────────────────────────────────────

function VoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right">{forPct}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300/60">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7">{againstPct}%</span>
    </div>
  )
}

// ─── Loading skeletons ─────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-surface-300/40 bg-surface-100/30">
      <Skeleton className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2 w-full mt-2" />
      </div>
      <Skeleton className="w-12 h-4 flex-shrink-0" />
    </div>
  )
}

function CategorySkeleton() {
  return (
    <div className="p-3 rounded-xl border border-surface-300/40 bg-surface-100/30 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-2 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Topic row ─────────────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: TrendingTopic }) {
  const status = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.active

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="flex items-start gap-3 p-3 rounded-xl border border-surface-300/40 bg-surface-100/30 hover:border-surface-400/60 hover:bg-surface-200/40 transition-all group"
      >
        <div className="mt-0.5">
          <RankMedal rank={topic.rank} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <span className={cn('text-[10px] font-mono', getCatConfig(topic.category).color)}>
                {topic.category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', status.bg, status.color)}>
              {status.label}
            </span>
          </div>
          <VoteBar bluePct={topic.blue_pct} />
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1 text-gold">
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs font-mono font-bold">{topic.recent_votes.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-surface-500 mt-0.5">votes</p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({ cat, rank, totalVotes }: { cat: TrendingCategory; rank: number; totalVotes: number }) {
  const cfg = getCatConfig(cat.category)
  const CatIcon = cfg.icon
  const barWidth = totalVotes > 0 ? Math.round((cat.recent_votes / totalVotes) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/categories/${encodeURIComponent(cat.category)}`}
        className={cn(
          'block p-3 rounded-xl border transition-all hover:scale-[1.01]',
          cfg.bg, cfg.border,
          'hover:brightness-110'
        )}
      >
        <div className="flex items-start gap-2 mb-2">
          <div className={cn('p-1.5 rounded-lg', cfg.bg, 'border', cfg.border)}>
            <CatIcon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <RankMedal rank={rank} />
              <p className={cn('text-sm font-semibold', cfg.color)}>{cat.category}</p>
            </div>
            <p className="text-[10px] text-surface-500">
              {cat.recent_topics} active · {cat.total_topics} total
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono font-bold text-white">
              {cat.share_pct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-surface-500">of votes</p>
          </div>
        </div>

        {/* Activity bar */}
        <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden mb-2">
          <motion.div
            className={cn('h-full rounded-full', cfg.bg, 'border-0')}
            style={{ background: cat.category === 'Politics' ? '#3b82f6' : cat.category === 'Economics' ? '#f59e0b' : cat.category === 'Technology' ? '#a855f7' : '#10b981' }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, barWidth * 3)}%` }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />
        </div>

        {cat.top_statement && (
          <p className="text-[11px] text-surface-500 line-clamp-1 italic">
            &ldquo;{cat.top_statement}&rdquo;
          </p>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Tag pill ──────────────────────────────────────────────────────────────────

function TagPill({ tag, rank }: { tag: TrendingTag; rank: number }) {
  const isTop = rank <= 3
  return (
    <Link
      href={`/tags/${encodeURIComponent(tag.tag)}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition-all',
        'hover:scale-105 active:scale-95',
        isTop
          ? 'bg-for-500/15 border-for-500/30 text-for-300 hover:bg-for-500/25'
          : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60 hover:text-surface-400'
      )}
    >
      <Hash className="h-3 w-3 flex-shrink-0" />
      {tag.tag}
      <span className={cn('text-[10px]', isTop ? 'text-for-400/70' : 'text-surface-600')}>
        {tag.recent_topics}
      </span>
    </Link>
  )
}

// ─── Voice card ────────────────────────────────────────────────────────────────

function VoiceCard({ voice, rank }: { voice: TrendingVoice; rank: number }) {
  const role = ROLE_LABELS[voice.role] ?? ROLE_LABELS.person

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/profile/${voice.username}`}
        className="flex items-center gap-3 p-3 rounded-xl border border-surface-300/40 bg-surface-100/30 hover:border-surface-400/60 hover:bg-surface-200/40 transition-all group"
      >
        <div className="flex-shrink-0">
          <RankMedal rank={rank} />
        </div>
        <Avatar
          src={voice.avatar_url}
          fallback={voice.display_name || voice.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
            {voice.display_name || voice.username}
          </p>
          <p className={cn('text-[10px] font-mono', role.color)}>
            @{voice.username} · {role.label}
          </p>
        </div>
        <div className="flex-shrink-0 space-y-0.5 text-right">
          <div className="flex items-center gap-1 justify-end text-purple">
            <MessageSquare className="h-3 w-3" />
            <span className="text-xs font-mono font-bold">{voice.recent_arguments}</span>
          </div>
          <div className="flex items-center gap-1 justify-end text-for-400">
            <Vote className="h-3 w-3" />
            <span className="text-xs font-mono font-bold">{voice.recent_votes_cast}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type Tab = 'topics' | 'categories' | 'tags' | 'voices'

const TABS: { value: Tab; label: string; icon: typeof TrendingUp }[] = [
  { value: 'topics',     label: 'Topics',     icon: TrendingUp },
  { value: 'categories', label: 'Categories', icon: BarChart2 },
  { value: 'tags',       label: 'Tags',       icon: Hash },
  { value: 'voices',     label: 'Voices',     icon: Users },
]

export function TrendsClient() {
  const [window, setWindow] = useState<TrendWindow>('24h')
  const [tab, setTab] = useState<Tab>('topics')
  const [data, setData] = useState<TrendsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async (w: TrendWindow) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/trends?window=${w}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(window) }, [window, load])

  function handleWindow(w: TrendWindow) {
    if (w === window) return
    setWindow(w)
  }

  const windowLabel = WINDOWS.find((x) => x.value === window)?.label ?? 'Today'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-for-400" />
                <h1 className="text-lg font-bold text-white">Civic Trends</h1>
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                What the Lobby is debating {windowLabel.toLowerCase()}
              </p>
            </div>
            <button
              onClick={() => load(window)}
              disabled={loading}
              className="p-2 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400/60 transition-all disabled:opacity-50"
              aria-label="Refresh trends"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Platform pulse */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-for-500/10 border border-for-500/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
              <p className="text-xs text-for-300">
                <span className="font-mono font-bold text-for-200">
                  {data.total_recent_votes.toLocaleString()}
                </span>{' '}
                votes cast {windowLabel.toLowerCase()} across{' '}
                <span className="font-mono font-bold text-for-200">
                  {data.categories.length}
                </span>{' '}
                categories
              </p>
            </motion.div>
          )}

          {/* Window selector */}
          <div className="flex items-center gap-1 p-1 bg-surface-200/60 rounded-xl border border-surface-300/40">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => handleWindow(w.value)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  window === w.value
                    ? 'bg-for-600 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-1 border-b border-surface-300/40">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-all',
                    tab === t.value
                      ? 'border-for-500 text-for-300'
                      : 'border-transparent text-surface-500 hover:text-surface-400'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {tab === 'categories' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)}
                  </div>
                ) : (
                  Array.from({ length: 8 }).map((_, i) => <TopicSkeleton key={i} />)
                )}
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon={TrendingUp}
                  title="Couldn't load trends"
                  description="Something went wrong. Try refreshing."
                  actions={[{ label: 'Try again', onClick: () => load(window) }]}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`${tab}-${window}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {/* ── Topics tab ─────────────────────────────────────────── */}
                {tab === 'topics' && (
                  <div className="space-y-2">
                    {data?.topics.length ? (
                      <>
                        {data.topics.map((topic) => (
                          <TopicRow key={topic.id} topic={topic} />
                        ))}
                        <div className="pt-2 text-center">
                          <Link
                            href="/topics"
                            className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                          >
                            Browse all topics <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={TrendingUp}
                        title="No trending topics yet"
                        description={`No debate activity in the last ${windowLabel.toLowerCase()}.`}
                      />
                    )}
                  </div>
                )}

                {/* ── Categories tab ─────────────────────────────────────── */}
                {tab === 'categories' && (
                  <div className="space-y-3">
                    {data?.categories.length ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {data.categories.map((cat, i) => (
                            <CategoryCard
                              key={cat.category}
                              cat={cat}
                              rank={i + 1}
                              totalVotes={data.total_recent_votes}
                            />
                          ))}
                        </div>
                        <div className="pt-1 text-center">
                          <Link
                            href="/categories"
                            className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                          >
                            All categories <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={BarChart2}
                        title="No category activity yet"
                        description="Category trends will appear as debates gain votes."
                      />
                    )}
                  </div>
                )}

                {/* ── Tags tab ───────────────────────────────────────────── */}
                {tab === 'tags' && (
                  <div className="space-y-4">
                    {data?.tags.length ? (
                      <>
                        {/* Top 3 spotlight */}
                        {data.tags.slice(0, 3).length > 0 && (
                          <div>
                            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                              Top Tags
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {data.tags.slice(0, 3).map((tag) => {
                                return (
                                  <Link
                                    key={tag.tag}
                                    href={`/tags/${encodeURIComponent(tag.tag)}`}
                                    className="flex flex-col items-center gap-1 p-3 rounded-xl border border-for-500/25 bg-for-500/10 hover:bg-for-500/20 transition-all text-center"
                                  >
                                    <div className="flex items-center gap-1">
                                      <RankMedal rank={tag.rank} />
                                    </div>
                                    <Hash className="h-4 w-4 text-for-400" />
                                    <p className="text-xs font-mono font-bold text-for-300 truncate w-full text-center">
                                      {tag.tag}
                                    </p>
                                    <p className="text-[10px] text-surface-500">
                                      {tag.recent_topics} topics
                                    </p>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* All tags */}
                        <div>
                          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                            All Trending Tags
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.tags.map((tag) => (
                              <TagPill key={tag.tag} tag={tag} rank={tag.rank} />
                            ))}
                          </div>
                        </div>

                        <div className="pt-1 text-center">
                          <Link
                            href="/tags"
                            className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                          >
                            All tags <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={Hash}
                        title="No trending tags yet"
                        description="Tags will trend as topics with matching keywords gain votes."
                      />
                    )}
                  </div>
                )}

                {/* ── Voices tab ─────────────────────────────────────────── */}
                {tab === 'voices' && (
                  <div className="space-y-2">
                    {data?.voices.length ? (
                      <>
                        <p className="text-[11px] font-mono text-surface-500">
                          Citizens driving the most discourse {windowLabel.toLowerCase()}
                        </p>
                        {data.voices.map((voice, i) => (
                          <VoiceCard key={voice.id} voice={voice} rank={i + 1} />
                        ))}
                        <div className="pt-2 text-center">
                          <Link
                            href="/leaderboard"
                            className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                          >
                            Full leaderboard <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="No active voices yet"
                        description="Citizens who post arguments will appear here as the Lobby activates."
                      />
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
