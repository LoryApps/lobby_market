'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Heart,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodVoteCorrelation, MoodVotesResponse } from '@/app/api/mood/vs-votes/route'
import type { MoodKind } from '@/app/api/mood/route'

// ─── Mood config ──────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<MoodKind, string> = {
  hopeful:    '🌱',
  inspired:   '✨',
  proud:      '🏆',
  determined: '💪',
  frustrated: '😤',
  worried:    '😟',
  angry:      '😠',
  relieved:   '😮‍💨',
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

const MOOD_COLOR: Record<MoodKind, { text: string; bg: string; border: string }> = {
  hopeful:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  inspired:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  proud:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  determined: { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  frustrated: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  worried:    { text: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-600/30' },
  angry:      { text: 'text-against-500', bg: 'bg-against-500/15', border: 'border-against-500/40' },
  relieved:   { text: 'text-for-300',     bg: 'bg-for-600/10',     border: 'border-for-600/20'     },
}

// ─── Correlation card ─────────────────────────────────────────────────────────

function CorrelationCard({
  item,
  platformBluePct,
  index,
}: {
  item: MoodVoteCorrelation
  platformBluePct: number
  index: number
}) {
  const cfg = MOOD_COLOR[item.mood as MoodKind]
  const emoji = MOOD_EMOJI[item.mood as MoodKind]
  const label = MOOD_LABEL[item.mood as MoodKind]

  const deviation = item.blue_pct - platformBluePct
  const hasEnoughData = item.total >= 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        'bg-surface-100/80',
        cfg.border,
      )}
    >
      {/* Mood header */}
      <div className="flex items-center gap-2.5">
        <span className="text-2xl" role="img" aria-label={label}>{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', cfg.text)}>{label}</p>
          <p className="text-[11px] text-surface-500 tabular-nums">
            {hasEnoughData ? `${item.total.toLocaleString()} paired votes` : 'Not enough data yet'}
          </p>
        </div>
        {hasEnoughData && (
          <Badge
            variant="default"
            size="xs"
            className={cn(
              'font-mono font-semibold',
              item.bias === 'for'
                ? 'bg-for-500/15 text-for-400 border-for-500/30'
                : item.bias === 'against'
                ? 'bg-against-500/15 text-against-400 border-against-500/30'
                : 'bg-surface-200/60 text-surface-400 border-surface-500/30',
            )}
          >
            {item.bias === 'for' ? '+FOR' : item.bias === 'against' ? '+AGN' : '≈ EVEN'}
          </Badge>
        )}
      </div>

      {/* Vote split bar */}
      {hasEnoughData ? (
        <>
          <div className="space-y-1">
            <div className="flex rounded-full overflow-hidden h-3 bg-surface-300/40">
              <div
                className="bg-for-500 transition-all duration-700"
                style={{ width: `${item.blue_pct}%` }}
              />
              <div
                className="bg-against-500 transition-all duration-700"
                style={{ width: `${item.red_pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono tabular-nums">
              <span className="text-for-400 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {item.blue_pct.toFixed(1)}% For
              </span>
              <span className="text-against-400 flex items-center gap-1">
                {item.red_pct.toFixed(1)}% Against
                <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
          </div>

          {/* Deviation from platform baseline */}
          <p className={cn(
            'text-[11px] font-mono',
            deviation >= 3 ? 'text-for-400' : deviation <= -3 ? 'text-against-400' : 'text-surface-500',
          )}>
            {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}% vs. platform avg
          </p>
        </>
      ) : (
        <p className="text-[11px] text-surface-600 italic">
          Cast moods + votes on the same topic to see your patterns here.
        </p>
      )}
    </motion.div>
  )
}

// ─── Insight banner ───────────────────────────────────────────────────────────

function InsightBanner({ data }: { data: MoodVotesResponse }) {
  const forMood = data.most_for_mood as MoodKind
  const againstMood = data.most_against_mood as MoodKind
  const forPct = data.correlations.find(c => c.mood === forMood)?.blue_pct ?? 50
  const againstPct = data.correlations.find(c => c.mood === againstMood)?.red_pct ?? 50

  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-bold text-white font-mono">Platform Insights</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-for-500/8 border border-for-500/20 p-3 space-y-1">
          <p className="text-[11px] text-surface-500 uppercase tracking-wider font-mono">Most FOR-leaning mood</p>
          <p className="text-sm font-bold text-for-400 flex items-center gap-2">
            <span>{MOOD_EMOJI[forMood]}</span>
            {MOOD_LABEL[forMood]}
          </p>
          <p className="text-xs text-surface-400">
            Citizens who feel <span className="text-for-400 font-semibold">{MOOD_LABEL[forMood].toLowerCase()}</span> about a topic vote FOR{' '}
            <span className="text-white font-mono">{forPct.toFixed(0)}%</span> of the time.
          </p>
        </div>
        <div className="rounded-xl bg-against-500/8 border border-against-500/20 p-3 space-y-1">
          <p className="text-[11px] text-surface-500 uppercase tracking-wider font-mono">Most AGAINST-leaning mood</p>
          <p className="text-sm font-bold text-against-400 flex items-center gap-2">
            <span>{MOOD_EMOJI[againstMood]}</span>
            {MOOD_LABEL[againstMood]}
          </p>
          <p className="text-xs text-surface-400">
            Citizens who feel <span className="text-against-400 font-semibold">{MOOD_LABEL[againstMood].toLowerCase()}</span> about a topic vote AGAINST{' '}
            <span className="text-white font-mono">{againstPct.toFixed(0)}%</span> of the time.
          </p>
        </div>
      </div>
      <p className="text-[11px] text-surface-500">
        Based on{' '}
        <span className="text-white font-mono">{data.total_matched.toLocaleString()}</span> mood–vote pairs.{' '}
        Platform average: <span className="text-for-400 font-mono">{data.platform_blue_pct.toFixed(1)}% FOR</span> across all active topics.
      </p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MoodVsVotesClient() {
  const [data, setData] = useState<MoodVotesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sortBy, setSortBy] = useState<'for' | 'against' | 'total'>('total')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/mood/vs-votes')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const sorted = data?.correlations.slice().sort((a, b) => {
    if (sortBy === 'for') return b.blue_pct - a.blue_pct
    if (sortBy === 'against') return b.red_pct - a.red_pct
    return b.total - a.total
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/mood"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60 text-surface-400 hover:bg-surface-200 hover:text-white transition-colors"
              aria-label="Back to Civic Mood"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Heart className="h-4 w-4 text-against-400" />
            <h1 className="font-mono text-xl font-bold text-white tracking-tight">
              Mood vs. Votes
            </h1>
            <div className="ml-auto">
              <button
                onClick={fetchData}
                disabled={loading}
                aria-label="Refresh"
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60 text-surface-400 hover:bg-surface-200 hover:text-white transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed">
            How does emotion shape your vote? For each civic mood, see what percentage of citizens
            who felt that way voted <span className="text-for-400">For</span> or{' '}
            <span className="text-against-400">Against</span> the same topic.
          </p>
        </div>

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-5">
          {([
            { id: 'total',   label: 'Most data',   icon: BarChart2 },
            { id: 'for',     label: 'Most FOR',     icon: ThumbsUp  },
            { id: 'against', label: 'Most AGAINST', icon: ThumbsDown },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors',
                sortBy === opt.id
                  ? opt.id === 'for'
                    ? 'bg-for-500/20 text-for-400 border border-for-500/40'
                    : opt.id === 'against'
                    ? 'bg-against-500/20 text-against-400 border border-against-500/40'
                    : 'bg-surface-200 text-white border border-surface-400/40'
                  : 'bg-surface-200/40 text-surface-400 border border-surface-600/30 hover:bg-surface-200/70',
              )}
            >
              <opt.icon className="h-3 w-3" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && <PageSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load correlation data"
            description="Try refreshing to compute mood–vote patterns."
            action={
              <button
                onClick={fetchData}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-surface-200 text-white hover:bg-surface-300 transition-colors"
              >
                Retry
              </button>
            }
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            {/* Insight banner */}
            {data.total_matched >= 20 && <InsightBanner data={data} />}

            {data.total_matched < 20 && (
              <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4 text-center space-y-2">
                <Heart className="h-8 w-8 text-against-400/60 mx-auto" />
                <p className="text-sm font-semibold text-white">Not enough data yet</p>
                <p className="text-xs text-surface-500">
                  Express moods on topics you've already voted on to see how your feelings align with your votes.
                </p>
                <Link
                  href="/mood"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-for-500/20 text-for-400 hover:bg-for-500/30 transition-colors mt-2"
                >
                  Express a mood
                </Link>
              </div>
            )}

            {/* Correlation cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sorted?.map((item, i) => (
                <CorrelationCard
                  key={item.mood}
                  item={item}
                  platformBluePct={data.platform_blue_pct}
                  index={i}
                />
              ))}
            </div>

            {/* Methodology note */}
            <p className="text-[11px] text-surface-600 text-center leading-relaxed pt-2">
              Computed from civic moods and votes cast on the <em>same topic by the same citizen</em>.
              Requires both a mood expression and a vote to count.
              Updated in real time.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
