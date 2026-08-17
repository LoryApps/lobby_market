'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  TrendingUp,
  Zap,
  Activity,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TrendingMoodData, MoodVelocity, TrendingTopic } from '@/app/api/mood/trending/route'
import type { MoodKind } from '@/app/api/mood/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Window = '24h' | '7d' | '30d'

// ─── Mood colours (mirrors TopicMoodClient) ───────────────────────────────────

const MOOD_COLOR: Record<MoodKind, { color: string; bg: string; border: string }> = {
  hopeful:    { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  inspired:   { color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  proud:      { color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  determined: { color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  frustrated: { color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  worried:    { color: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-600/30' },
  angry:      { color: 'text-against-500', bg: 'bg-against-500/15', border: 'border-against-500/40' },
  relieved:   { color: 'text-for-300',     bg: 'bg-for-600/10',     border: 'border-for-600/20'     },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const WINDOW_LABELS: Record<Window, string> = {
  '24h': 'Last 24h',
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function VelocitySkeleton() {
  return (
    <div className="space-y-2">
      {[0,1,2,3,4,5,6,7].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      ))}
    </div>
  )
}

function TopicSkeleton() {
  return (
    <div className="space-y-2">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="p-3 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-3 w-3/4 mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Velocity card ────────────────────────────────────────────────────────────

function VelocityCard({ item, maxCurrent, window_ }: { item: MoodVelocity; maxCurrent: number; window_: Window }) {
  const c = MOOD_COLOR[item.mood as MoodKind]
  const barW = maxCurrent > 0 ? (item.current / maxCurrent) * 100 : 0
  const isPositive = ['hopeful', 'inspired', 'proud', 'determined'].includes(item.mood)
  const isAnxious  = ['frustrated', 'worried', 'angry'].includes(item.mood)
  const barColor = isPositive ? 'bg-for-500' : isAnxious ? 'bg-against-500' : 'bg-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-center gap-3 p-3 rounded-xl border transition-colors', c.bg, c.border)}
    >
      {/* Emoji */}
      <span className="text-xl leading-none w-8 text-center flex-shrink-0">{item.emoji}</span>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-xs font-mono font-semibold', c.color)}>{item.label}</span>
          <span className="text-[11px] font-mono text-surface-500 tabular-nums">
            {item.current > 0 ? item.current.toLocaleString() : '—'}
            <span className="text-surface-600 ml-1">{WINDOW_LABELS[window_].toLowerCase()}</span>
          </span>
        </div>
        <div className="h-1.5 bg-surface-400 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', barColor)}
            initial={{ width: 0 }}
            animate={{ width: `${barW}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>

      {/* Trend indicator */}
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        {item.trend === 'rising' ? (
          <div className="flex items-center gap-0.5 text-for-400">
            <ArrowUp className="h-3 w-3" />
            <span className="text-[10px] font-mono font-bold">
              {item.pct_change !== null ? `+${item.pct_change}%` : `+${item.delta}`}
            </span>
          </div>
        ) : item.trend === 'falling' ? (
          <div className="flex items-center gap-0.5 text-against-400">
            <ArrowDown className="h-3 w-3" />
            <span className="text-[10px] font-mono font-bold">
              {item.pct_change !== null ? `${item.pct_change}%` : `${item.delta}`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 text-surface-500">
            <Minus className="h-3 w-3" />
            <span className="text-[10px] font-mono">—</span>
          </div>
        )}
        {item.previous > 0 && (
          <span className="text-[9px] font-mono text-surface-600 tabular-nums">
            prev: {item.previous}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Trending topic card ───────────────────────────────────────────────────────

function TrendingTopicCard({ topic, rank }: { topic: TrendingTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct)

  return (
    <Link
      href={`/topic/${topic.id}/mood`}
      className="block p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[11px] font-mono font-bold text-surface-600 mt-0.5 flex-shrink-0 w-5">
          #{rank}
        </span>
        <p className="text-xs font-semibold text-white leading-snug group-hover:text-for-300 transition-colors flex-1 min-w-0">
          {topic.statement}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap pl-7">
        <span className="text-base leading-none">{topic.top_mood_emoji}</span>
        <span className="text-[11px] font-mono text-surface-400">
          {topic.mood_responses} response{topic.mood_responses !== 1 ? 's' : ''}
        </span>
        {topic.category && (
          <Badge variant="proposed" size="sm">{topic.category}</Badge>
        )}
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
          {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
        </Badge>

        <div className="ml-auto flex items-center gap-1.5">
          {topic.positive_pct > 0 && (
            <span className="text-[10px] font-mono text-for-400">
              {topic.positive_pct}% pos
            </span>
          )}
          {topic.anxious_pct > 0 && (
            <span className="text-[10px] font-mono text-against-400">
              {topic.anxious_pct}% anx
            </span>
          )}
          <div className="w-14 h-1 bg-surface-400 rounded-full overflow-hidden">
            <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Platform shift banner ─────────────────────────────────────────────────────

function ShiftBanner({ shift }: { shift: TrendingMoodData['mood_shift'] }) {
  const delta = shift.sentiment_delta
  const improving = delta > 0
  const stable = delta === 0 || shift.total_previous === 0

  return (
    <div className={cn(
      'p-4 rounded-2xl border mb-5',
      stable
        ? 'bg-surface-100 border-surface-300'
        : improving
          ? 'bg-for-500/10 border-for-500/30'
          : 'bg-against-500/10 border-against-500/30'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
          stable ? 'bg-surface-200' : improving ? 'bg-for-500/20' : 'bg-against-500/20'
        )}>
          <Activity className={cn(
            'h-5 w-5',
            stable ? 'text-surface-500' : improving ? 'text-for-400' : 'text-against-400'
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-bold font-mono',
            stable ? 'text-white' : improving ? 'text-for-300' : 'text-against-300'
          )}>
            {stable
              ? 'Mood holding steady'
              : improving
                ? `Mood improving · +${delta}pp positive`
                : `Mood declining · ${delta}pp positive`}
          </p>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            Now: {shift.positive_pct_current}% positive, {shift.anxious_pct_current}% anxious
            {shift.total_previous > 0 && (
              <> · prev: {shift.positive_pct_previous}% positive</>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-black text-white tabular-nums">{shift.total_current.toLocaleString()}</p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">responses</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TrendingMoodClient() {
  const [window_, setWindow] = useState<Window>('24h')
  const [data, setData] = useState<TrendingMoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (w: Window, refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/mood/trending?window=${w}`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(window_) }, [window_, load])

  const handleWindow = (w: Window) => {
    if (w === window_) return
    setWindow(w)
    setData(null)
  }

  const maxCurrent = data
    ? Math.max(...data.mood_velocity.map(v => v.current), 1)
    : 1

  const risingMoods = data?.mood_velocity.filter(v => v.trend === 'rising') ?? []
  const fallingMoods = data?.mood_velocity.filter(v => v.trend === 'falling') ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/mood"
            aria-label="Back to Mood"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-tight">Mood Trends</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Which emotions are rising and falling
            </p>
          </div>
          <button
            onClick={() => load(window_, true)}
            disabled={refreshing || loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Window selector */}
        <div className="flex gap-1.5 mb-5 p-1 rounded-xl bg-surface-200 border border-surface-300">
          {(['24h', '7d', '30d'] as Window[]).map(w => (
            <button
              key={w}
              onClick={() => handleWindow(w)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                window_ === w
                  ? 'bg-surface-50 text-white shadow-sm border border-surface-300'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>

        {/* Platform shift */}
        {!loading && data && (
          <motion.div
            key={window_}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ShiftBanner shift={data.mood_shift} />
          </motion.div>
        )}

        {loading && (
          <div className="p-4 rounded-2xl border border-surface-300 bg-surface-100 mb-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-2 w-64" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        )}

        {/* Quick summary pills */}
        {!loading && data && data.mood_shift.total_current > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {risingMoods.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-for-500/10 border border-for-500/30">
                <ArrowUp className="h-3 w-3 text-for-400" />
                <span className="text-[11px] font-mono text-for-400 font-semibold">
                  {risingMoods.map(m => m.emoji).join(' ')} rising
                </span>
              </div>
            )}
            {fallingMoods.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-against-500/10 border border-against-500/30">
                <ArrowDown className="h-3 w-3 text-against-400" />
                <span className="text-[11px] font-mono text-against-400 font-semibold">
                  {fallingMoods.map(m => m.emoji).join(' ')} falling
                </span>
              </div>
            )}
            {risingMoods.length === 0 && fallingMoods.length === 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300">
                <Minus className="h-3 w-3 text-surface-500" />
                <span className="text-[11px] font-mono text-surface-400 font-semibold">
                  All moods stable
                </span>
              </div>
            )}
          </div>
        )}

        {/* Mood velocity */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Mood Velocity
            </h2>
          </div>

          {loading ? (
            <VelocitySkeleton />
          ) : data && data.mood_shift.total_current > 0 ? (
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {data.mood_velocity.map((item, i) => (
                  <motion.div
                    key={`${item.mood}-${window_}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <VelocityCard item={item} maxCurrent={maxCurrent} window_={window_} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-10">
              <Zap className="h-8 w-8 text-surface-600 mx-auto mb-2" />
              <p className="text-sm font-mono text-surface-400 font-semibold">No mood data yet</p>
              <p className="text-xs font-mono text-surface-600 mt-1">
                Responses will appear here as people share their feelings
              </p>
            </div>
          )}
        </div>

        {/* Trending topics */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Activity className="h-3.5 w-3.5 text-purple" />
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Most Active Topics
            </h2>
            <span className="text-[10px] font-mono text-surface-600">· {WINDOW_LABELS[window_].toLowerCase()}</span>
          </div>

          {loading ? (
            <TopicSkeleton />
          ) : data && data.trending_topics.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {data.trending_topics.map((topic, i) => (
                  <motion.div
                    key={`${topic.id}-${window_}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <TrendingTopicCard topic={topic} rank={i + 1} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-surface-600 mx-auto mb-2" />
              <p className="text-sm font-mono text-surface-400 font-semibold">No topic activity</p>
              <p className="text-xs font-mono text-surface-600 mt-1">
                Topics with mood responses will appear here
              </p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/mood"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Platform mood
          </Link>
          <span className="text-surface-700">·</span>
          <Link
            href="/mood/hopeful"
            className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            Browse by mood →
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
