'use client'

/**
 * /mood — Civic Mood
 *
 * Shows the emotional temperature of civic discourse across the platform.
 * Users see how debates make the community feel — hopeful, worried,
 * inspired, frustrated — at both the platform level and per-topic.
 *
 * Distinct from /sentiment (NLP-based tone analysis) and /temperature
 * (vote volatility). This is first-person self-reported emotional state.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Frown,
  Globe,
  Heart,
  RefreshCw,
  Shield,
  Smile,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodData, MoodKind } from '@/app/api/mood/route'

// ─── Mood Config ──────────────────────────────────────────────────────────────

interface MoodConfig {
  emoji: string
  label: string
  color: string
  bg: string
  border: string
  ring: string
  type: 'positive' | 'anxious' | 'neutral'
}

const MOOD_CONFIG: Record<MoodKind, MoodConfig> = {
  hopeful: {
    emoji: '🌱',
    label: 'Hopeful',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/40',
    type: 'positive',
  },
  inspired: {
    emoji: '✨',
    label: 'Inspired',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/40',
    type: 'positive',
  },
  proud: {
    emoji: '🏆',
    label: 'Proud',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/40',
    type: 'positive',
  },
  determined: {
    emoji: '💪',
    label: 'Determined',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    ring: 'ring-purple/40',
    type: 'positive',
  },
  frustrated: {
    emoji: '😤',
    label: 'Frustrated',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/40',
    type: 'anxious',
  },
  worried: {
    emoji: '😟',
    label: 'Worried',
    color: 'text-against-300',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    ring: 'ring-against-600/40',
    type: 'anxious',
  },
  angry: {
    emoji: '😡',
    label: 'Angry',
    color: 'text-against-500',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    ring: 'ring-against-500/50',
    type: 'anxious',
  },
  relieved: {
    emoji: '😌',
    label: 'Relieved',
    color: 'text-for-300',
    bg: 'bg-for-600/10',
    border: 'border-for-600/20',
    ring: 'ring-for-600/30',
    type: 'neutral',
  },
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// Hex colors keyed by MoodKind for the progress bar fill
const MOOD_HEX: Record<MoodKind, string> = {
  hopeful:    '#3b82f6',
  inspired:   '#f59e0b',
  proud:      '#10b981',
  determined: '#8b5cf6',
  frustrated: '#f87171',
  worried:    '#fca5a5',
  angry:      '#ef4444',
  relieved:   '#93c5fd',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MoodBar({ mood, count, pct }: { mood: MoodKind; count: number; pct: number }) {
  const cfg = MOOD_CONFIG[mood]
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-7 flex-shrink-0 text-center">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className={cn('text-xs font-mono font-medium', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-[11px] text-surface-500 font-mono">
            {count.toLocaleString()} · {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="h-full rounded-full"
            style={{ background: MOOD_HEX[mood] }}
          />
        </div>
      </div>
    </div>
  )
}

function TopicMoodCard({
  topic,
  label,
  labelColor,
}: {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    top_mood: MoodKind
    top_mood_count: number
    total_mood_responses: number
  }
  label: string
  labelColor: string
}) {
  const cfg = MOOD_CONFIG[topic.top_mood]
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-xl border transition-colors',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-mono leading-snug line-clamp-2">
          {truncate(topic.statement, 100)}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', cfg.color)}>
            {cfg.label}
          </span>
          {topic.category && (
            <span className="text-[10px] text-surface-500 font-mono">{topic.category}</span>
          )}
          <span className="text-[10px] text-surface-500 font-mono">
            {topic.total_mood_responses} responses
          </span>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors mt-1 flex-shrink-0" />
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MoodClient() {
  const [data, setData] = useState<MoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'hopeful' | 'worried' | 'active'>('hopeful')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mood', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const dominant = data?.dominant_mood ? MOOD_CONFIG[data.dominant_mood] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-against-400" />
            <h1 className="font-mono text-xl font-bold text-white tracking-tight">
              Civic Mood
            </h1>
            <div className="ml-auto flex items-center gap-1.5">
              <Link
                href="/mood/atlas"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold text-for-400 hover:bg-for-500/10 transition-colors border border-for-500/20 hover:border-for-500/40"
              >
                <Globe className="h-3 w-3" />
                Atlas
              </Link>
              <Link
                href="/mood/trending"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold text-purple hover:bg-purple/10 transition-colors border border-purple/20 hover:border-purple/40"
              >
                <TrendingUp className="h-3 w-3" />
                Trends
              </Link>
              {!loading && data && (
                <button
                  onClick={fetchData}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-surface-500 font-mono">
            How civic debate makes the community feel — right now.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : !data ? (
          <EmptyState
            icon={Heart}
            title="Couldn't load mood data"
            description="Try refreshing the page."
          />
        ) : (
          <div className="space-y-6">

            {/* Headline stat */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-5',
                dominant ? dominant.bg : 'bg-surface-100',
                dominant ? dominant.border : 'border-surface-300',
              )}
            >
              <div className="flex items-center gap-4">
                <div className="text-5xl">
                  {dominant ? dominant.emoji : '💭'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-0.5">
                    Platform mood right now
                  </p>
                  <p className={cn('text-2xl font-mono font-bold', dominant?.color ?? 'text-white')}>
                    {dominant ? dominant.label : 'Mixed'}
                  </p>
                  <p className="text-sm text-surface-500 font-mono mt-1">
                    {data.total_mood_responses.toLocaleString()} responses ·{' '}
                    <span className="text-for-400">{data.positive_pct}% positive</span>
                    {' / '}
                    <span className="text-against-400">{data.anxious_pct}% concerned</span>
                  </p>
                </div>
              </div>

              {data.total_mood_responses === 0 && (
                <p className="mt-3 text-xs text-surface-500 font-mono border-t border-surface-300 pt-3">
                  No moods submitted yet. Be the first — visit any topic and share how it makes you feel.
                </p>
              )}
            </motion.div>

            {/* Mood breakdown bars */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
            >
              <h2 className="font-mono text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-surface-500" />
                Mood Breakdown
              </h2>
              <div className="space-y-3">
                {data.platform_totals.map((m) => (
                  <MoodBar
                    key={m.mood}
                    mood={m.mood}
                    count={m.count}
                    pct={m.pct}
                  />
                ))}
              </div>
            </motion.section>

            {/* Positive / Concerned split */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="rounded-xl border border-for-500/30 bg-for-500/8 p-4 text-center">
                <Smile className="h-5 w-5 text-for-400 mx-auto mb-1.5" />
                <p className="font-mono text-2xl font-bold text-for-400">
                  {data.positive_pct}%
                </p>
                <p className="text-[11px] text-surface-500 font-mono mt-0.5">
                  Positive
                </p>
                <p className="text-[10px] text-surface-600 font-mono mt-0.5">
                  hopeful · inspired · proud · determined
                </p>
              </div>
              <div className="rounded-xl border border-against-500/30 bg-against-500/8 p-4 text-center">
                <Frown className="h-5 w-5 text-against-400 mx-auto mb-1.5" />
                <p className="font-mono text-2xl font-bold text-against-400">
                  {data.anxious_pct}%
                </p>
                <p className="text-[11px] text-surface-500 font-mono mt-0.5">
                  Concerned
                </p>
                <p className="text-[10px] text-surface-600 font-mono mt-0.5">
                  frustrated · worried · angry
                </p>
              </div>
            </motion.div>

            {/* Topic mood tabs */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
            >
              {/* Tab bar */}
              <div className="flex border-b border-surface-300">
                {(
                  [
                    { key: 'hopeful', label: 'Most Hopeful', icon: Smile },
                    { key: 'worried', label: 'Most Worried', icon: Shield },
                    { key: 'active', label: 'Most Discussed', icon: Sparkles },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'flex-1 py-2.5 text-[11px] font-mono font-medium transition-colors flex items-center justify-center gap-1.5',
                      tab === key
                        ? 'text-white border-b-2 border-for-500 bg-surface-100'
                        : 'text-surface-500 hover:text-white',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-2.5">
                <AnimatePresence mode="wait">
                  {tab === 'hopeful' && (
                    <motion.div
                      key="hopeful"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2.5"
                    >
                      {data.most_hopeful_topics.length === 0 ? (
                        <p className="text-xs text-surface-500 font-mono text-center py-6">
                          No mood data yet — visit topics to add yours.
                        </p>
                      ) : (
                        data.most_hopeful_topics.map((t) => (
                          <TopicMoodCard
                            key={t.id}
                            topic={t}
                            label="Hopeful"
                            labelColor="text-for-400"
                          />
                        ))
                      )}
                    </motion.div>
                  )}

                  {tab === 'worried' && (
                    <motion.div
                      key="worried"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2.5"
                    >
                      {data.most_worried_topics.length === 0 ? (
                        <p className="text-xs text-surface-500 font-mono text-center py-6">
                          No mood data yet — visit topics to add yours.
                        </p>
                      ) : (
                        data.most_worried_topics.map((t) => (
                          <TopicMoodCard
                            key={t.id}
                            topic={t}
                            label="Worried"
                            labelColor="text-against-400"
                          />
                        ))
                      )}
                    </motion.div>
                  )}

                  {tab === 'active' && (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2.5"
                    >
                      {data.most_active_mood_topics.length === 0 ? (
                        <p className="text-xs text-surface-500 font-mono text-center py-6">
                          No mood data yet — visit topics to add yours.
                        </p>
                      ) : (
                        data.most_active_mood_topics.map((t) => (
                          <TopicMoodCard
                            key={t.id}
                            topic={t}
                            label={MOOD_CONFIG[t.top_mood].label}
                            labelColor={MOOD_CONFIG[t.top_mood].color}
                          />
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>

            {/* User stats / CTA */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                'rounded-2xl border p-5',
                data.user_mood_count > 0
                  ? 'border-purple/30 bg-purple/8'
                  : 'border-surface-300 bg-surface-100',
              )}
            >
              {data.user_mood_count > 0 ? (
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-purple flex-shrink-0" />
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">
                      You've shared {data.user_mood_count} mood{data.user_mood_count !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-surface-500 font-mono mt-0.5">
                      Your reactions shape the civic emotional landscape.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Heart className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                  <p className="text-sm font-mono font-semibold text-white mb-1">
                    Share how debates make you feel
                  </p>
                  <p className="text-xs text-surface-500 font-mono mb-3">
                    Visit any topic page and add your mood reaction.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-for-400 hover:text-for-300 transition-colors"
                  >
                    Browse debates <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </motion.div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
