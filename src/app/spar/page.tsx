'use client'

/**
 * /spar — AI Sparring Arena
 *
 * Landing page for the AI debate practice feature.
 * Shows hot topics to spar on, organised by difficulty and category.
 * Each card links to /spar/[topicId] where the real debate happens.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  ChevronRight,
  Flame,
  RefreshCw,
  Scale,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SparTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type Difficulty = 'easy' | 'moderate' | 'hard' | 'brutal'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/20' },
  Philosophy:  { text: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  Health:      { text: 'text-against-300',  bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/20' },
}

function getCatStyle(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

// ─── Difficulty ────────────────────────────────────────────────────────────────
// Difficulty = how contested the topic is (close to 50/50 = harder to argue)

function getDifficulty(bluePct: number): Difficulty {
  const dist = Math.abs(bluePct - 50)
  if (dist >= 25) return 'easy'    // >75/<25% — overwhelming consensus, easy side obvious
  if (dist >= 15) return 'moderate'
  if (dist >= 7)  return 'hard'
  return 'brutal'                  // very close to 50/50 — brutal argument required
}

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Flame
  description: string
}> = {
  easy: {
    label: 'Accessible',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Zap,
    description: 'Clear majority — good for practice',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
    description: 'Some debate to be had',
  },
  hard: {
    label: 'Hard',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: Flame,
    description: 'Contested — bring strong arguments',
  },
  brutal: {
    label: 'Brutal',
    color: 'text-against-400',
    bg: 'bg-against-600/15',
    border: 'border-against-600/40',
    icon: Swords,
    description: 'Near 50/50 — genuine clash guaranteed',
  },
}

// ─── Local history from localStorage ─────────────────────────────────────────

interface SparHistoryRecord {
  topicId: string
  statement: string
  userSide: 'for' | 'against'
  rounds: number
  ts: number
}

function loadHistory(): SparHistoryRecord[] {
  try {
    const raw = localStorage.getItem('lm_spar_history_v1')
    return raw ? (JSON.parse(raw) as SparHistoryRecord[]) : []
  } catch {
    return []
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100/60 p-5 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <Skeleton className="h-3.5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-10 rounded" />
          <Skeleton className="h-3 w-10 rounded" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  )
}

// ─── Topic spar card ──────────────────────────────────────────────────────────

function SparTopicCard({ topic }: { topic: SparTopic }) {
  const difficulty = getDifficulty(topic.blue_pct)
  const diff = DIFFICULTY_CONFIG[difficulty]
  const DiffIcon = diff.icon
  const catStyle = getCatStyle(topic.category)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl border border-surface-300/40 bg-surface-100/60 p-5 hover:border-surface-400/60 hover:bg-surface-100 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {topic.category && (
            <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-wider', catStyle.text)}>
              {topic.category}
            </span>
          )}
        </div>
        <span className={cn(
          'flex-shrink-0 flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
          diff.bg, diff.color, diff.border,
        )}>
          <DiffIcon className="h-2.5 w-2.5" />
          {diff.label}
        </span>
      </div>

      {/* Statement */}
      <p className="text-sm font-semibold text-white leading-snug mb-3 line-clamp-3">
        {topic.statement}
      </p>

      {/* Vote bar */}
      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/spar/${topic.id}?side=for`}
          className={cn(
            'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
            'bg-for-600/20 border-for-600/40 text-for-300 hover:bg-for-600/40 hover:border-for-500/60',
          )}
        >
          <ThumbsUp className="h-3 w-3" />
          Argue FOR
        </Link>
        <Link
          href={`/spar/${topic.id}?side=against`}
          className={cn(
            'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
            'bg-against-600/20 border-against-600/40 text-against-300 hover:bg-against-600/40 hover:border-against-500/60',
          )}
        >
          <ThumbsDown className="h-3 w-3" />
          Argue AGAINST
        </Link>
      </div>
    </motion.div>
  )
}

// ─── How it works section ─────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      icon: Swords,
      color: 'text-purple',
      bg: 'bg-purple/10',
      border: 'border-purple/30',
      title: 'Pick a topic and side',
      description: 'Choose any civic topic and decide: FOR or AGAINST. Claude takes the opposite.',
    },
    {
      icon: Bot,
      color: 'text-for-400',
      bg: 'bg-for-500/10',
      border: 'border-for-500/30',
      title: 'Debate across 5 rounds',
      description: 'Make your case; Claude fires back with sharp, evidence-driven counter-arguments.',
    },
    {
      icon: Trophy,
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/30',
      title: 'Receive coaching feedback',
      description: 'After 5 rounds, Claude evaluates your performance — clarity, evidence, and persuasion.',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {steps.map((step, i) => {
        const Icon = step.icon
        return (
          <div
            key={i}
            className={cn(
              'rounded-xl border p-4',
              step.bg,
              step.border,
            )}
          >
            <div className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg border mb-3',
              step.bg,
              step.border,
            )}>
              <Icon className={cn('h-4 w-4', step.color)} />
            </div>
            <p className={cn('text-xs font-mono font-bold mb-1', step.color)}>{step.title}</p>
            <p className="text-xs text-surface-500 leading-relaxed">{step.description}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ record }: { record: SparHistoryRecord }) {
  const timeAgo = (() => {
    const diff = Date.now() - record.ts
    const m = Math.floor(diff / 60_000)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (m < 2) return 'just now'
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    return `${d}d ago`
  })()

  return (
    <Link
      href={`/spar/${record.topicId}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/30 hover:bg-surface-200/70 hover:border-surface-300/60 transition-all"
    >
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border text-xs font-mono font-bold',
        record.userSide === 'for'
          ? 'bg-for-500/10 border-for-500/20 text-for-400'
          : 'bg-against-500/10 border-against-500/20 text-against-400',
      )}>
        {record.userSide === 'for' ? 'FOR' : 'AGN'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{record.statement}</p>
        <p className="text-[11px] font-mono text-surface-500">{record.rounds} rounds · {timeAgo}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SparPage() {
  const [topics, setTopics] = useState<SparTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState('All')
  const [history, setHistory] = useState<SparHistoryRecord[]>([])

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const fetchTopics = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      params.set('limit', '24')
      params.set('sort', 'hot')
      if (category !== 'All') params.set('category', category)
      // Get active + voting topics — these have the most debate value
      const res = await fetch(`/api/feed?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const items: SparTopic[] = (data.topics ?? []).map((t: SparTopic) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
      }))
      setTopics(items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { fetchTopics() }, [fetchTopics])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Swords className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Sparring Arena</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Debate practice against Claude — 5 rounds, real topics, honest feedback
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed max-w-2xl">
            Choose a civic topic, pick your side, and go head-to-head with an AI opponent. After 5 rounds, receive coaching feedback on your argument quality.
          </p>
        </div>

        {/* ── How it works ───────────────────────────────────────────────────── */}
        <HowItWorks />

        {/* ── Recent spars (from localStorage) ──────────────────────────────── */}
        {history.length > 0 && (
          <div className="mb-8">
            <h2 className="font-mono text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Recent Sparring Sessions
            </h2>
            <div className="space-y-2">
              {history.slice(0, 5).map((r) => (
                <HistoryRow key={`${r.topicId}-${r.ts}`} record={r} />
              ))}
            </div>
          </div>
        )}

        {/* ── Category tabs ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple" />
            Pick a Topic
          </h2>
          <button
            onClick={fetchTopics}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/40 text-surface-500 hover:text-white transition-colors text-[11px] font-mono disabled:opacity-40"
            aria-label="Refresh topics"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all',
                category === cat
                  ? 'bg-surface-200 border-surface-400 text-white'
                  : 'border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-surface-400',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Difficulty legend ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-6">
          {Object.values(DIFFICULTY_CONFIG).map((d) => {
            const Icon = d.icon
            return (
              <span key={d.label} className={cn('flex items-center gap-1 text-[11px] font-mono', d.color)}>
                <Icon className="h-3 w-3" />
                {d.label}: {d.description}
              </span>
            )
          })}
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <TopicCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <EmptyState
            icon={Swords}
            title="Arena unavailable"
            description="Failed to load topics. Please try again."
            actions={[{ label: 'Retry', onClick: fetchTopics }]}
          />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No topics in this category"
            description="Try a different category to find debates to practice."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {topics.map((topic) => (
                <SparTopicCard key={topic.id} topic={topic} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
