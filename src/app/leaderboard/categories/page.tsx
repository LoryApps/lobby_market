'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  Cpu,
  ExternalLink,
  FlaskConical,
  Flame,
  GraduationCap,
  Gavel,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategoryLeaderboardResponse, CategoryStats, CategoryVoice } from '@/app/api/leaderboard/categories/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string; bar: string }> = {
  Economics:   { color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30',          bar: 'bg-gold' },
  Politics:    { color: 'text-for-400',        bg: 'bg-for-500/10',       border: 'border-for-500/30',       bar: 'bg-for-500' },
  Technology:  { color: 'text-purple',         bg: 'bg-purple/10',        border: 'border-purple/30',        bar: 'bg-purple' },
  Science:     { color: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30',       bar: 'bg-emerald' },
  Ethics:      { color: 'text-against-400',    bg: 'bg-against-500/10',   border: 'border-against-500/30',   bar: 'bg-against-500' },
  Philosophy:  { color: 'text-for-300',        bg: 'bg-for-500/10',       border: 'border-for-500/20',       bar: 'bg-for-400' },
  Culture:     { color: 'text-gold',           bg: 'bg-gold/10',          border: 'border-gold/20',          bar: 'bg-gold' },
  Health:      { color: 'text-against-300',    bg: 'bg-against-500/10',   border: 'border-against-500/30',   bar: 'bg-against-400' },
  Environment: { color: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30',       bar: 'bg-emerald' },
  Education:   { color: 'text-purple',         bg: 'bg-purple/10',        border: 'border-purple/30',        bar: 'bg-purple' },
}

const DEFAULT_STYLE = { color: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300', bar: 'bg-surface-400' }

function getStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? DEFAULT_STYLE
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('en-US')
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Voice card ───────────────────────────────────────────────────────────────

function VoiceCard({
  voice,
  label,
  metricLabel,
  icon: Icon,
  color,
}: {
  voice: CategoryVoice
  label: string
  metricLabel: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <Link
      href={`/profile/${voice.username}`}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2.5 rounded-xl',
        'bg-surface-200/60 border border-surface-300/60',
        'hover:border-surface-400/80 hover:bg-surface-200/90 transition-all'
      )}
    >
      <Avatar
        src={voice.avatar_url}
        fallback={voice.display_name || voice.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-500 font-mono truncate">{label}</p>
        <p className="text-sm text-white font-semibold font-mono truncate leading-tight">
          {voice.display_name || voice.username}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Icon className={cn('h-3 w-3', color)} />
        <span className={cn('text-xs font-mono font-bold', color)}>
          {fmtNum(voice.metric)}
        </span>
        <span className="text-[10px] text-surface-500 font-mono hidden sm:inline">
          {metricLabel}
        </span>
      </div>
    </Link>
  )
}

// ─── Consensus bar ────────────────────────────────────────────────────────────

function ConsensusBar({ forPct }: { forPct: number }) {
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right tabular-nums">{forPct}%</span>
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums">{againstPct}%</span>
    </div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ stat, index }: { stat: CategoryStats; index: number }) {
  const style = getStyle(stat.category)
  const Icon = CATEGORY_ICON[stat.category] ?? BarChart2

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400/60 transition-colors',
        style.border
      )}
    >
      {/* Header */}
      <div className={cn('px-4 py-3 border-b border-surface-300/60 flex items-center gap-3', style.bg)}>
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', style.bg, style.border)}>
          <Icon className={cn('h-4.5 w-4.5', style.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={cn('font-mono font-bold text-base leading-tight', style.color)}>
            {stat.category}
          </h2>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            {stat.topic_count} topic{stat.topic_count !== 1 ? 's' : ''} · {stat.law_count} law{stat.law_count !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/categories/${stat.category.toLowerCase()}`}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
            'bg-surface-200/60 text-surface-500 hover:text-white hover:bg-surface-300',
            'transition-colors'
          )}
          aria-label={`Browse ${stat.category} topics`}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-white tabular-nums">
              <AnimatedNumber value={stat.total_votes} />
            </p>
            <p className="text-[10px] font-mono text-surface-500">Total Votes</p>
          </div>
          <div className="text-center">
            <p className={cn('text-lg font-bold font-mono tabular-nums', stat.law_count > 0 ? 'text-emerald' : 'text-surface-500')}>
              {stat.law_count}
            </p>
            <p className="text-[10px] font-mono text-surface-500">Laws Passed</p>
          </div>
          <div className="text-center">
            <p className={cn(
              'text-lg font-bold font-mono tabular-nums',
              stat.consensus_for_pct > 60 ? 'text-for-400' :
              stat.consensus_for_pct < 40 ? 'text-against-400' : 'text-surface-400'
            )}>
              {stat.consensus_for_pct}%
            </p>
            <p className="text-[10px] font-mono text-surface-500">Topics FOR</p>
          </div>
        </div>

        {/* Consensus bar */}
        <div>
          <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-wide">Avg Consensus</p>
          <ConsensusBar forPct={stat.avg_blue_pct} />
        </div>

        {/* Top Debater */}
        {stat.top_debater ? (
          <div>
            <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Trophy className="h-3 w-3 text-gold" />
              Top Debater
            </p>
            <VoiceCard
              voice={stat.top_debater}
              label="Most Upvoted Arguments"
              metricLabel="upvotes"
              icon={MessageSquare}
              color="text-gold"
            />
          </div>
        ) : null}

        {/* Top Voter */}
        {stat.top_voter ? (
          <div>
            <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Vote className="h-3 w-3 text-for-400" />
              Most Active Voter
            </p>
            <VoiceCard
              voice={stat.top_voter}
              label="Votes Cast"
              metricLabel="votes"
              icon={Zap}
              color="text-for-400"
            />
          </div>
        ) : null}

        {/* Hottest Topic */}
        {stat.hottest_topic ? (
          <div>
            <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Flame className="h-3 w-3 text-against-400" />
              Hottest Topic
            </p>
            <Link
              href={`/topic/${stat.hottest_topic.id}`}
              className={cn(
                'group block px-3 py-2.5 rounded-xl',
                'bg-surface-200/60 border border-surface-300/60',
                'hover:border-surface-400/80 hover:bg-surface-200/90 transition-all'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono leading-snug line-clamp-2">
                    {stat.hottest_topic.statement}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={STATUS_BADGE[stat.hottest_topic.status] ?? 'proposed'}>
                      {stat.hottest_topic.status.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" />
                      {fmtNum(stat.hottest_topic.total_votes)}
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[10px] font-mono text-for-400 tabular-nums">
                        {Math.round(stat.hottest_topic.blue_pct)}%
                      </span>
                      <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 group-hover:text-white transition-colors" />
              </div>
            </Link>
          </div>
        ) : null}
      </div>
    </motion.article>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CategoryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-300/60 bg-surface-200/30 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-1.5">
              <Skeleton className="h-6 w-12 rounded mx-auto" />
              <Skeleton className="h-2.5 w-16 rounded mx-auto" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-full rounded" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryBar({ categories }: { categories: CategoryStats[] }) {
  if (categories.length === 0) return null

  const totalTopics = categories.reduce((s, c) => s + c.topic_count, 0)
  const totalLaws = categories.reduce((s, c) => s + c.law_count, 0)
  const totalVotes = categories.reduce((s, c) => s + c.total_votes, 0)

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl bg-surface-200/40 border border-surface-300/60">
      {[
        { label: 'Categories', value: categories.length, icon: BarChart2, color: 'text-purple' },
        { label: 'Topics',     value: totalTopics,        icon: Scale,     color: 'text-for-400' },
        { label: 'Laws',       value: totalLaws,          icon: Gavel,     color: 'text-emerald' },
        { label: 'Votes',      value: totalVotes,         icon: Zap,       color: 'text-gold' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
          <span className={cn('text-sm font-mono font-bold', color)}>{fmtNum(value)}</span>
          <span className="text-xs font-mono text-surface-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoryLeaderboardPage() {
  const router = useRouter()
  const [data, setData] = useState<CategoryLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'votes' | 'topics' | 'laws'>('votes')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/categories', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load category rankings')
      const json = await res.json() as CategoryLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load category rankings. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sorted = data?.categories
    ? [...data.categories].sort((a, b) => {
        if (sortBy === 'votes')  return b.total_votes - a.total_votes
        if (sortBy === 'topics') return b.topic_count - a.topic_count
        return b.law_count - a.law_count
      })
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Link
              href="/leaderboard"
              aria-label="Back to leaderboard"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors'
              )}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="h-5 w-5 text-purple" aria-hidden="true" />
                <h1 className="font-mono text-2xl font-bold text-white">
                  Category Power Rankings
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500">
                Top voices, hottest debates, and consensus splits — by topic category
              </p>
            </div>

            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh rankings"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg ml-auto flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors disabled:opacity-50'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-mono text-surface-500">Sort by:</span>
            {(
              [
                { id: 'votes',  label: 'Most Voted',   icon: Zap },
                { id: 'topics', label: 'Most Active',  icon: Scale },
                { id: 'laws',   label: 'Most Laws',    icon: Gavel },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                aria-pressed={sortBy === id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                  'border transition-all',
                  sortBy === id
                    ? 'bg-for-500/15 border-for-500/40 text-for-300'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Summary bar */}
          {!loading && data && <SummaryBar categories={data.categories} />}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <CategoryCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={BarChart2}
                title="Couldn't load rankings"
                description={error}
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </motion.div>
          ) : sorted.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={BarChart2}
                title="No category data yet"
                description="Create and vote on some topics to see category rankings."
                actions={[{ label: 'Browse Topics', onClick: () => router.push('/categories') }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {sorted.map((cat, i) => (
                <CategoryCard key={cat.category} stat={cat} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer nav ──────────────────────────────────────────── */}
        {!loading && sorted.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sorted.length * 0.04 + 0.1 }}
            className="mt-8 flex items-center justify-between gap-4 text-sm font-mono text-surface-500"
          >
            <Link href="/leaderboard" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Overall Leaderboard
            </Link>
            <Link href="/categories" className="flex items-center gap-1.5 hover:text-white transition-colors">
              Browse by Category
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
