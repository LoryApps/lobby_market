'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Gavel,
  Loader2,
  RefreshCw,
  Smile,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodKind } from '@/app/api/mood/route'
import type { MoodPageData, MoodTopicDetail } from '@/app/api/mood/[mood]/route'

// ─── Mood config ──────────────────────────────────────────────────────────────

interface MoodConfig {
  emoji: string
  label: string
  color: string
  bg: string
  border: string
  barColor: string
  description: string
}

const MOOD_CONFIG: Record<MoodKind, MoodConfig> = {
  hopeful: {
    emoji: '🌱',
    label: 'Hopeful',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    barColor: 'bg-for-500',
    description: 'These debates make the community feel optimistic about the future.',
  },
  inspired: {
    emoji: '✨',
    label: 'Inspired',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    barColor: 'bg-gold',
    description: 'Topics that spark ideas and elevate civic imagination.',
  },
  proud: {
    emoji: '🏆',
    label: 'Proud',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    barColor: 'bg-emerald',
    description: 'Issues where the community celebrates hard-won progress.',
  },
  determined: {
    emoji: '💪',
    label: 'Determined',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    barColor: 'bg-purple',
    description: 'The fights worth having — where conviction drives debate.',
  },
  frustrated: {
    emoji: '😤',
    label: 'Frustrated',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    barColor: 'bg-against-500',
    description: 'Topics that reveal tensions and unmet expectations.',
  },
  worried: {
    emoji: '😟',
    label: 'Worried',
    color: 'text-against-300',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    barColor: 'bg-against-400',
    description: 'Debates that surface real concerns about where things are headed.',
  },
  angry: {
    emoji: '😡',
    label: 'Angry',
    color: 'text-against-500',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    barColor: 'bg-against-600',
    description: 'The debates that ignite the strongest negative reactions.',
  },
  relieved: {
    emoji: '😌',
    label: 'Relieved',
    color: 'text-for-300',
    bg: 'bg-for-600/10',
    border: 'border-for-600/20',
    barColor: 'bg-for-600',
    description: 'Topics where the outcome brings welcome relief.',
  },
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

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
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function MoodTopicCard({
  topic,
  mood,
  index,
}: {
  topic: MoodTopicDetail
  mood: MoodKind
  index: number
}) {
  const cfg = MOOD_CONFIG[mood]
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const badgeVariant = STATUS_BADGE[topic.status] ?? 'proposed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl p-4 border transition-all',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60',
        )}
      >
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-surface-200 flex items-center justify-center">
            <span className="text-[11px] font-mono font-bold text-surface-500">
              {index + 1}
            </span>
          </div>

          {/* Statement */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              {truncate(topic.statement, 100)}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {topic.category && (
                <span className={cn('text-[11px] font-mono', catColor)}>
                  {topic.category}
                </span>
              )}
              <Badge variant={badgeVariant} size="sm" />
            </div>
          </div>
        </div>

        {/* Mood bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-[11px] font-mono', cfg.color)}>
              {cfg.emoji} {cfg.label} — {topic.mood_pct}%
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              {formatNum(topic.mood_count)} / {formatNum(topic.total_responses)} responses
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${topic.mood_pct}%` }}
              transition={{ duration: 0.6, delay: Math.min(index * 0.04, 0.4) + 0.1, ease: 'easeOut' }}
              className={cn('absolute inset-y-0 left-0 rounded-full', cfg.barColor)}
            />
          </div>
        </div>

        {/* Vote bar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-mono text-for-400">
            <ThumbsUp className="h-3 w-3" />
            <span>{forPct}%</span>
          </div>
          <div className="flex-1 relative h-1 rounded-full bg-against-900 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-against-400">
            <span>{againstPct}%</span>
            <ThumbsDown className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-mono text-surface-500 ml-1">
            {formatNum(topic.total_votes)} votes
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-1 w-full rounded-full" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  mood: MoodKind
}

export function MoodTopicsClient({ mood }: Props) {
  const cfg = MOOD_CONFIG[mood]
  const [data, setData] = useState<MoodPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mood/${mood}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: MoodPageData = await res.json()
      setData(json)
    } catch {
      setError('Could not load mood topics.')
    } finally {
      setLoading(false)
    }
  }, [mood])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href="/mood"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Moods
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                'flex items-center justify-center h-12 w-12 rounded-2xl text-2xl',
                cfg.bg,
                cfg.border,
                'border',
              )}
            >
              {cfg.emoji}
            </div>
            <div>
              <h1 className={cn('text-2xl font-bold', cfg.color)}>
                {cfg.label}
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Topics that make people {cfg.label.toLowerCase()}
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-600 leading-relaxed">
            {cfg.description}
          </p>

          {/* Stats row */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-300/50"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                <Smile className="h-3.5 w-3.5" />
                <span>
                  <span className={cn('font-bold', cfg.color)}>{data.topic_count}</span>
                  {' '}topic{data.topic_count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                <Users className="h-3.5 w-3.5" />
                <span>
                  <span className={cn('font-bold', cfg.color)}>{formatNum(data.total_responses)}</span>
                  {' '}responses
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Mood switcher */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mb-6">
          {ALL_MOODS.map((m) => {
            const c = MOOD_CONFIG[m]
            const isActive = m === mood
            return (
              <Link
                key={m}
                href={`/mood/${m}`}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono transition-all border',
                  isActive
                    ? cn(c.bg, c.border, c.color, 'font-semibold')
                    : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:text-surface-700 hover:border-surface-400/40',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider">
            Top {cfg.label.toLowerCase()} topics
          </h2>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={Zap}
            title="Could not load topics"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && !error && data && data.topics.length === 0 && (
          <EmptyState
            icon={Smile}
            title={`No ${cfg.label.toLowerCase()} responses yet`}
            description="Be the first — visit a topic and share how it makes you feel."
            action={{ label: 'Browse topics', href: '/' }}
          />
        )}

        {!loading && !error && data && data.topics.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={mood}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {data.topics.map((topic, i) => (
                <MoodTopicCard
                  key={topic.id}
                  topic={topic}
                  mood={mood}
                  index={i}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* CTA to full mood hub */}
        <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <p className="text-sm font-semibold text-white mb-1">
            Explore the civic mood landscape
          </p>
          <p className="text-xs text-surface-500 mb-3">
            See how debates across every category make the community feel — hopeful, inspired, worried, and more.
          </p>
          <Link
            href="/mood"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Civic Mood Hub
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
