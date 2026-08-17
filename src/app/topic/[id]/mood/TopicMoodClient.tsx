'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Heart,
  RefreshCw,
  Smile,
  Sparkles,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicMoodData } from '@/app/api/topics/[id]/mood/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type MoodKind =
  | 'hopeful' | 'inspired' | 'proud' | 'determined'
  | 'frustrated' | 'worried' | 'angry' | 'relieved'

interface TopicSummary {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Mood config ──────────────────────────────────────────────────────────────

interface MoodCfg {
  emoji: string
  label: string
  color: string
  bg: string
  border: string
  type: 'positive' | 'anxious' | 'neutral'
}

const MOOD_CFG: Record<MoodKind, MoodCfg> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful',    color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30',     type: 'positive' },
  inspired:   { emoji: '✨', label: 'Inspired',   color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',        type: 'positive' },
  proud:      { emoji: '🏆', label: 'Proud',      color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30',     type: 'positive' },
  determined: { emoji: '💪', label: 'Determined', color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30',      type: 'positive' },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30', type: 'anxious'  },
  worried:    { emoji: '😟', label: 'Worried',    color: 'text-against-300', bg: 'bg-against-600/10',  border: 'border-against-600/30', type: 'anxious'  },
  angry:      { emoji: '😡', label: 'Angry',      color: 'text-against-500', bg: 'bg-against-500/15',  border: 'border-against-500/40', type: 'anxious'  },
  relieved:   { emoji: '😌', label: 'Relieved',   color: 'text-for-300',     bg: 'bg-for-600/10',      border: 'border-for-600/20',     type: 'neutral'  },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function MoodSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topic: TopicSummary
}

export function TopicMoodClient({ topicId, topic }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TopicMoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<MoodKind | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch_ = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/mood`, { cache: 'no-store' })
      if (res.status === 401) { router.replace('/login'); return }
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId, router])

  useEffect(() => { fetch_() }, [fetch_])

  const handleMood = useCallback(async (mood: MoodKind) => {
    if (submitting) return
    const isSame = data?.user_mood === mood
    setSubmitting(mood)
    try {
      if (isSame) {
        await fetch(`/api/topics/${topicId}/mood`, { method: 'DELETE' })
      } else {
        await fetch(`/api/topics/${topicId}/mood`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mood }),
        })
      }
      await fetch_()
    } finally {
      setSubmitting(null)
    }
  }, [topicId, data?.user_mood, submitting, fetch_])

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const dominantMood = data && data.total > 0
    ? (data.moods.sort((a, b) => b.count - a.count)[0]?.mood as MoodKind | undefined)
    : undefined

  const positivePct = data && data.total > 0
    ? Math.round(
        ((['hopeful', 'inspired', 'proud', 'determined'] as MoodKind[])
          .reduce((s, m) => s + (data.moods.find(x => x.mood === m)?.count ?? 0), 0) /
          data.total) * 100
      )
    : null

  const sortedMoods = data
    ? [...data.moods].sort((a, b) => b.count - a.count)
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Heart className="h-5 w-5 text-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-tight">Community Mood</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              How this debate makes people feel
            </p>
          </div>
          <button
            onClick={() => fetch_(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Topic card */}
        <Link
          href={`/topic/${topicId}`}
          className="block mb-5 p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
        >
          <div className="flex items-start gap-2 mb-3">
            <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors">
              {topic.statement}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <Badge variant="proposed" size="sm">{topic.category}</Badge>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
              {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
            </Badge>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] font-mono text-for-400 tabular-nums">{forPct}%</span>
              <div className="w-20 h-1.5 bg-surface-400 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-against-400 tabular-nums">{againstPct}%</span>
            </div>
          </div>
        </Link>

        {/* Summary stats */}
        {!loading && data && data.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2 mb-5"
          >
            <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
              <Users className="h-4 w-4 text-surface-500 mx-auto mb-1" />
              <p className="text-base font-black text-white tabular-nums">{data.total.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Responses</p>
            </div>
            {dominantMood && (
              <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
                <p className="text-2xl leading-none mb-1">{MOOD_CFG[dominantMood].emoji}</p>
                <p className={cn('text-sm font-bold tabular-nums', MOOD_CFG[dominantMood].color)}>
                  {MOOD_CFG[dominantMood].label}
                </p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Top Mood</p>
              </div>
            )}
            {positivePct !== null && (
              <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
                <Smile className="h-4 w-4 text-for-400 mx-auto mb-1" />
                <p className="text-base font-black text-for-400 tabular-nums">{positivePct}%</p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Positive</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Mood breakdown */}
        <div className="mb-5">
          <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 px-1">
            Mood Distribution
          </h2>
          {loading ? (
            <MoodSkeleton />
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {(data && data.total > 0 ? sortedMoods : (Object.keys(MOOD_CFG) as MoodKind[]).map(m => ({ mood: m, count: 0, pct: 0 }))).map((item, i) => {
                  const mood = item.mood as MoodKind
                  const cfg = MOOD_CFG[mood]
                  const isSelected = data?.user_mood === mood
                  const isSubmitting = submitting === mood
                  const pct = item.pct

                  return (
                    <motion.button
                      key={mood}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleMood(mood)}
                      disabled={!!submitting}
                      aria-label={`${isSelected ? 'Remove' : 'Select'} mood: ${cfg.label}`}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
                        isSelected
                          ? cn(cfg.bg, cfg.border, 'ring-1', cfg.border.replace('border-', 'ring-'))
                          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
                        isSubmitting && 'opacity-60',
                      )}
                    >
                      {/* Emoji */}
                      <span className="text-xl leading-none flex-shrink-0 w-8 text-center">
                        {cfg.emoji}
                      </span>

                      {/* Label + bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            'text-xs font-mono font-semibold',
                            isSelected ? cfg.color : 'text-surface-300'
                          )}>
                            {cfg.label}
                          </span>
                          <span className="text-[11px] font-mono text-surface-500 tabular-nums">
                            {item.count > 0 ? `${item.count.toLocaleString()} · ${pct}%` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-400 rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              'h-full rounded-full',
                              cfg.type === 'positive' ? 'bg-for-500' :
                              cfg.type === 'anxious' ? 'bg-against-500' :
                              'bg-surface-500'
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.04 }}
                          />
                        </div>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <span className={cn('text-[10px] font-mono font-bold flex-shrink-0 px-1.5 py-0.5 rounded-md', cfg.bg, cfg.color)}>
                          YOU
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* No responses state */}
        {!loading && data && data.total === 0 && (
          <div className="text-center py-10">
            <Sparkles className="h-10 w-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-mono text-surface-400 font-semibold">No mood responses yet</p>
            <p className="text-xs font-mono text-surface-600 mt-1">Be the first to share how this topic makes you feel</p>
          </div>
        )}

        {/* User prompt */}
        {!loading && (
          <p className="text-center text-xs font-mono text-surface-600 mt-4">
            {data?.user_mood
              ? `You selected ${MOOD_CFG[data.user_mood as MoodKind]?.label ?? data.user_mood} · tap to change or deselect`
              : 'Tap a mood above to share how this topic makes you feel'}
          </p>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to topic
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
