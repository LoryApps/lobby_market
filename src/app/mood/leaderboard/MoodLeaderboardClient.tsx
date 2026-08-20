'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Heart,
  RefreshCw,
  Smile,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodLeaderboardResponse, MoodLeaderboardTopic } from '@/app/api/mood/leaderboard/route'
import type { MoodKind } from '@/app/api/mood/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

const MOOD_EMOJI: Record<MoodKind, string> = {
  hopeful:    '🌟',
  inspired:   '✨',
  proud:      '💪',
  determined: '🔥',
  frustrated: '😤',
  worried:    '😟',
  angry:      '😠',
  relieved:   '😮‍💨',
}

const MOOD_COLOR: Record<MoodKind, { text: string; bg: string; border: string; bar: string }> = {
  hopeful:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     bar: 'bg-for-400'     },
  inspired:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        bar: 'bg-gold'        },
  proud:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald'     },
  determined: { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      bar: 'bg-purple'      },
  frustrated: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', bar: 'bg-against-400' },
  worried:    { text: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-600/30', bar: 'bg-against-300' },
  angry:      { text: 'text-against-500', bg: 'bg-against-500/15', border: 'border-against-500/40', bar: 'bg-against-500' },
  relieved:   { text: 'text-for-300',     bg: 'bg-for-600/10',     border: 'border-for-600/20',     bar: 'bg-for-300'     },
}

const MOOD_LABEL: Record<MoodKind, string> = {
  hopeful:    'Hopeful',
  inspired:   'Inspired',
  proud:      'Proud',
  determined: 'Determined',
  frustrated: 'Frustrated',
  worried:    'Worried',
  angry:      'Angry',
  relieved:   'Relieved',
}

type SortBy = 'total' | 'dominant' | 'positive' | 'anxious'

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'total',    label: 'Most felt'       },
  { id: 'dominant', label: 'Most intense'    },
  { id: 'positive', label: 'Most hopeful'    },
  { id: 'anxious',  label: 'Most worried'    },
]

// ─── Medal ────────────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-gold font-mono font-bold text-base tabular-nums" aria-label="Rank 1">🥇</span>
  if (rank === 2) return <span className="text-surface-500 font-mono font-bold text-base" aria-label="Rank 2">🥈</span>
  if (rank === 3) return <span className="text-[#cd7f32] font-mono font-bold text-base" aria-label="Rank 3">🥉</span>
  return (
    <span className="inline-flex items-center justify-center w-7 text-[11px] font-mono font-bold text-surface-500 tabular-nums" aria-label={`Rank ${rank}`}>
      #{rank}
    </span>
  )
}

// ─── Mood bar strip ───────────────────────────────────────────────────────────

function MoodBarStrip({ breakdown }: { breakdown: MoodLeaderboardTopic['mood_breakdown'] }) {
  const total = breakdown.reduce((s, m) => s + m.count, 0)
  if (total === 0) return null

  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px" role="img" aria-label="Mood distribution bar">
      {breakdown
        .filter((m) => m.count > 0)
        .map((m) => (
          <div
            key={m.mood}
            className={cn('h-full transition-all duration-700', MOOD_COLOR[m.mood].bar)}
            style={{ width: `${m.pct}%` }}
            title={`${MOOD_LABEL[m.mood]}: ${m.pct}%`}
          />
        ))}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  index,
}: {
  topic: MoodLeaderboardTopic
  index: number
}) {
  const dom = MOOD_COLOR[topic.dominant_mood]
  const top3 = topic.mood_breakdown.slice(0, 3).filter((m) => m.count > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="block rounded-xl border border-surface-300/40 bg-surface-100 hover:border-surface-400/60 hover:bg-surface-200/50 transition-all group p-4"
      >
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Rank */}
          <div className="flex-shrink-0 flex items-center justify-center w-8">
            <RankMedal rank={topic.rank} />
          </div>

          {/* Topic info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {topic.category && (
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                  {topic.category}
                </span>
              )}
              <Badge
                variant={
                  topic.status === 'law' ? 'law'
                  : topic.status === 'failed' ? 'failed'
                  : topic.status === 'voting' ? 'voting'
                  : 'active'
                }
                size="sm"
              />
            </div>
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {topic.statement}
            </p>
          </div>

          <ArrowRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 group-hover:text-for-400 transition-colors" />
        </div>

        {/* Mood bar */}
        <div className="mb-3 ml-11">
          <MoodBarStrip breakdown={topic.mood_breakdown} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 ml-11 flex-wrap">
          {/* Dominant mood chip */}
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
            dom.bg, dom.text, dom.border
          )}>
            {MOOD_EMOJI[topic.dominant_mood]} {MOOD_LABEL[topic.dominant_mood]} {topic.dominant_pct}%
          </span>

          {/* Top 3 moods */}
          {top3.slice(1).map((m) => (
            <span key={m.mood} className="text-[10px] font-mono text-surface-500">
              {MOOD_EMOJI[m.mood]} {m.pct}%
            </span>
          ))}

          {/* Total */}
          <span className="ml-auto text-[11px] font-mono text-surface-500 tabular-nums">
            {topic.total_mood_responses.toLocaleString()} felt
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-4 space-y-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 flex-shrink-0">
          <Skeleton className="h-5 w-7" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="ml-11">
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex items-center gap-2 ml-11">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MoodLeaderboardClient() {
  const [data, setData] = useState<MoodLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moodFilter, setMoodFilter] = useState<MoodKind | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('total')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort: sortBy })
      if (moodFilter) params.set('mood', moodFilter)
      const res = await fetch(`/api/mood/leaderboard?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as MoodLeaderboardResponse
      setData(json)
    } catch {
      setError('Failed to load mood leaderboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [moodFilter, sortBy])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Back */}
        <Link
          href="/mood"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Civic Mood
        </Link>

        {/* Hero */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono">Mood Leaderboard</h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Topics ranked by emotional engagement
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 mb-4 overflow-x-auto" role="tablist">
          {SORT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={sortBy === id}
              onClick={() => setSortBy(id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all whitespace-nowrap',
                sortBy === id
                  ? 'bg-gold/20 text-gold shadow-sm border border-gold/30'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mood filter chips */}
        <div
          className="flex flex-wrap gap-1.5 mb-5"
          role="group"
          aria-label="Filter by mood"
        >
          <button
            onClick={() => setMoodFilter(null)}
            aria-pressed={moodFilter === null}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border transition-all',
              moodFilter === null
                ? 'bg-surface-300/40 text-white border-surface-400'
                : 'bg-transparent text-surface-500 border-surface-500/30 hover:text-surface-300 hover:border-surface-400'
            )}
          >
            All moods
          </button>
          {ALL_MOODS.map((m) => {
            const col = MOOD_COLOR[m]
            const active = moodFilter === m
            return (
              <button
                key={m}
                onClick={() => setMoodFilter(m)}
                aria-pressed={active}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border transition-all',
                  active
                    ? cn(col.bg, col.text, col.border)
                    : 'bg-transparent text-surface-500 border-surface-500/30 hover:text-surface-300 hover:border-surface-400'
                )}
              >
                {MOOD_EMOJI[m]} {MOOD_LABEL[m]}
              </button>
            )
          })}
        </div>

        {/* Meta row */}
        {!loading && data && (
          <div className="flex items-center gap-3 mb-4 text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              {data.total_topics_with_moods.toLocaleString()} topics with moods
            </span>
            {data.filtered_by && (
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                Filtered: {MOOD_LABEL[data.filtered_by]}
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Trophy}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load leaderboard"
            description={error}
            actions={[{ label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw }]}
          />
        )}

        {/* Empty */}
        {!loading && !error && data && data.topics.length === 0 && (
          <EmptyState
            icon={Smile}
            iconColor="text-surface-500"
            iconBg="bg-surface-300/20"
            iconBorder="border-surface-400/20"
            title={
              data.filtered_by
                ? `No topics with "${MOOD_LABEL[data.filtered_by]}" mood yet`
                : 'No mood data yet'
            }
            description="Express how civic topics make you feel by visiting any topic and sharing your mood."
            actions={[
              { label: 'Browse topics', href: '/topics', variant: 'primary', icon: Zap },
              ...(data.filtered_by ? [{ label: 'Clear filter', onClick: () => setMoodFilter(null), variant: 'secondary' as const }] : []),
            ]}
          />
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {!loading && !error && data && data.topics.length > 0 && (
            <motion.div
              key={`${moodFilter}-${sortBy}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-2.5"
            >
              {data.topics.map((topic, i) => (
                <TopicCard key={topic.id} topic={topic} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer links */}
        {!loading && (
          <div className="mt-10 pt-6 border-t border-surface-200">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono">
              <Link href="/mood" className="text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors">
                <Heart className="h-3 w-3" />
                Civic Mood
              </Link>
              <Link href="/mood/trending" className="text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors">
                <Zap className="h-3 w-3" />
                Trending Moods
              </Link>
              <Link href="/mood/atlas" className="text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors">
                <BarChart3 className="h-3 w-3" />
                Mood Atlas
              </Link>
              <Link href="/mood/compare" className="text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors">
                <Trophy className="h-3 w-3" />
                Compare Moods
              </Link>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
