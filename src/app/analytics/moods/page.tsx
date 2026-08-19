'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Frown,
  Gavel,
  Heart,
  RefreshCw,
  Smile,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  MoodAnalyticsResponse,
  MoodKind,
  MoodEntry,
  CategoryMoodBreakdown,
  MoodOutcomeCorrelation,
} from '@/app/api/analytics/moods/route'

// ─── Mood config ──────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<
  MoodKind,
  {
    emoji: string
    label: string
    color: string
    bg: string
    border: string
    text: string
    isPositive: boolean
  }
> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful',    color: 'bg-emerald',     bg: 'bg-emerald/10',    border: 'border-emerald/30',    text: 'text-emerald',    isPositive: true  },
  inspired:   { emoji: '✨', label: 'Inspired',   color: 'bg-for-500',     bg: 'bg-for-500/10',    border: 'border-for-500/30',    text: 'text-for-400',    isPositive: true  },
  proud:      { emoji: '🏛️', label: 'Proud',      color: 'bg-purple',      bg: 'bg-purple/10',     border: 'border-purple/30',     text: 'text-purple',     isPositive: true  },
  determined: { emoji: '⚡', label: 'Determined', color: 'bg-gold',        bg: 'bg-gold/10',       border: 'border-gold/30',       text: 'text-gold',       isPositive: true  },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'bg-against-500', bg: 'bg-against-500/10',border: 'border-against-500/30',text: 'text-against-400',isPositive: false },
  worried:    { emoji: '😟', label: 'Worried',    color: 'bg-against-600', bg: 'bg-against-600/10',border: 'border-against-600/30',text: 'text-against-300',isPositive: false },
  angry:      { emoji: '😠', label: 'Angry',      color: 'bg-against-700', bg: 'bg-against-700/10',border: 'border-against-700/20',text: 'text-against-300',isPositive: false },
  relieved:   { emoji: '😮‍💨', label: 'Relieved', color: 'bg-for-300',     bg: 'bg-for-300/10',    border: 'border-for-300/30',    text: 'text-for-300',    isPositive: true  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active',
  law: 'law', failed: 'failed',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <Skeleton className="h-2.5 flex-1 rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Mood bar ────────────────────────────────────────────────────────────────

function MoodBar({ mood, count, pct, index }: { mood: MoodKind; count: number; pct: number; index: number }) {
  const cfg = MOOD_CONFIG[mood]
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3"
    >
      <span className="text-lg w-7 text-center flex-shrink-0" role="img" aria-label={cfg.label}>
        {cfg.emoji}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-surface-300/50 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: index * 0.05 + 0.1, duration: 0.5 }}
            className={cn('h-full rounded-full', cfg.color)}
          />
        </div>
        <span className="text-[10px] font-mono text-surface-500 w-6 text-right">{pct}%</span>
      </div>
      <span className="text-xs font-medium text-surface-400 w-10 text-right font-mono">{count}</span>
    </motion.div>
  )
}

// ─── Mood entry row ────────────────────────────────────────────────────────────

function MoodEntryRow({ entry, index }: { entry: MoodEntry; index: number }) {
  const cfg = MOOD_CONFIG[entry.mood]
  const forPct = Math.round(entry.topic_blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        href={`/topic/${entry.topic_id}`}
        className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-200/60 transition-colors group"
      >
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center text-base',
            cfg.bg,
            cfg.border,
            'border'
          )}
          title={cfg.label}
        >
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Badge variant={STATUS_BADGE[entry.topic_status] ?? 'proposed'}>
              {entry.topic_status === 'law' ? 'LAW' : entry.topic_status}
            </Badge>
            {entry.topic_category && (
              <span className="text-[10px] font-mono text-surface-500">{entry.topic_category}</span>
            )}
            <span className="ml-auto text-[10px] font-mono text-surface-600">{relTime(entry.set_at)}</span>
          </div>
          <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {entry.topic_statement}
          </p>
          {entry.topic_total_votes > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
              <span className="text-[10px] font-mono text-against-400">{againstPct}%</span>
            </div>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors mt-1 flex-shrink-0" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({ cat, index }: { cat: CategoryMoodBreakdown; index: number }) {
  const dominantCfg = cat.dominant_mood ? MOOD_CONFIG[cat.dominant_mood] : null
  const positivePct = cat.total > 0 ? Math.round((cat.positive_count / cat.total) * 100) : 0
  const anxiousPct = cat.total > 0 ? Math.round((cat.anxious_count / cat.total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
            {cat.category}
          </p>
          <p className="text-xs text-surface-600 mt-0.5">
            {cat.total} mood{cat.total === 1 ? '' : 's'} set
          </p>
        </div>
        {dominantCfg && (
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border',
              dominantCfg.bg, dominantCfg.border, dominantCfg.text
            )}
          >
            <span>{dominantCfg.emoji}</span>
            {dominantCfg.label}
          </span>
        )}
      </div>

      {/* Positive / Anxious bar */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Smile className="h-3 w-3 text-emerald flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${positivePct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-surface-500 w-8 text-right">{positivePct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Frown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div className="h-full rounded-full bg-against-500" style={{ width: `${anxiousPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-surface-500 w-8 text-right">{anxiousPct}%</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Outcome row ──────────────────────────────────────────────────────────────

function OutcomeRow({ corr, index }: { corr: MoodOutcomeCorrelation; index: number }) {
  const cfg = MOOD_CONFIG[corr.mood]
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-3 py-2.5 border-b border-surface-300/40 last:border-0"
    >
      <span className="text-base w-7 text-center flex-shrink-0" role="img" aria-label={cfg.label}>
        {cfg.emoji}
      </span>
      <span className="text-xs font-medium text-surface-400 w-20 flex-shrink-0">{cfg.label}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-surface-300/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${corr.law_rate}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-gold w-8 text-right">{corr.law_rate}%</span>
      </div>
      <span className="text-[10px] font-mono text-surface-600 w-16 text-right">
        {corr.topics_became_law}/{corr.total_set} law
      </span>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoodAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<MoodAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const loadedRef = useRef(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/analytics/moods')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as MoodAnalyticsResponse
      setData(json)
    } catch {
      // keep current state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      load()
    }
  }, [load])

  const dominantCfg = data?.dominant_mood ? MOOD_CONFIG[data.dominant_mood] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Heart className="h-5 w-5 text-against-400" aria-hidden="true" />
              My Civic Moods
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              The emotional layer of your civic engagement
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : !data || data.total_moods_set === 0 ? (
          <EmptyState
            icon={Heart}
            iconColor="text-against-400/60"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="No mood data yet"
            description="Visit any debate and tap the mood picker to record how a topic makes you feel. Your emotional history will appear here."
            actions={[
              { label: 'Browse debates', href: '/', icon: TrendingUp },
            ]}
            size="lg"
          />
        ) : (
          <div className="space-y-5">

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Total</p>
                <p className="text-3xl font-bold text-white font-mono">{data.total_moods_set}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">moods recorded</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Dominant</p>
                {dominantCfg ? (
                  <>
                    <p className="text-2xl mb-0.5">{dominantCfg.emoji}</p>
                    <p className={cn('text-xs font-mono font-semibold', dominantCfg.text)}>
                      {dominantCfg.label}
                    </p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-surface-500">—</p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Positive</p>
                <p className="text-3xl font-bold text-emerald font-mono">{data.positive_pct}%</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">hopeful · inspired · proud</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Anxious</p>
                <p className="text-3xl font-bold text-against-400 font-mono">{data.anxious_pct}%</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">worried · frustrated</p>
              </motion.div>
            </div>

            {/* Mood breakdown bar chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                Mood Breakdown
              </h2>
              <div className="space-y-3">
                {data.mood_counts
                  .filter((m) => m.count > 0)
                  .map((m, i) => (
                    <MoodBar
                      key={m.mood}
                      mood={m.mood}
                      count={m.count}
                      pct={m.pct}
                      index={i}
                    />
                  ))}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-300/40">
                <div className="flex items-center gap-1.5">
                  <Smile className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
                  <span className="text-xs text-surface-500">
                    <span className="font-mono font-semibold text-emerald">{data.positive_pct}%</span> positive
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Frown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                  <span className="text-xs text-surface-500">
                    <span className="font-mono font-semibold text-against-400">{data.anxious_pct}%</span> anxious
                  </span>
                </div>
                <div className="ml-auto">
                  <Link
                    href="/mood"
                    className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    Platform mood →
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Category breakdown */}
            {data.category_breakdown.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider font-mono mb-3">
                  By Category
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.category_breakdown.map((cat, i) => (
                    <CategoryCard key={cat.category} cat={cat} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Outcome correlation */}
            {data.outcome_correlation.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-gold" aria-hidden="true" />
                  Mood → Law Rate
                </h2>
                <p className="text-xs text-surface-500 mb-4">
                  Of the topics you've expressed each mood about, what % became law?
                </p>
                <div>
                  {data.outcome_correlation
                    .filter((c) => c.total_set >= 1)
                    .slice(0, 8)
                    .map((c, i) => (
                      <OutcomeRow key={c.mood} corr={c} index={i} />
                    ))}
                </div>
              </motion.div>
            )}

            {/* Hopeful and law highlight */}
            {data.hopeful_and_law.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                  <span className="text-base">🌱</span>
                  You Were Hopeful — And They Became Law
                </h2>
                <div className="rounded-2xl bg-surface-100 border border-emerald/20 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {data.hopeful_and_law.map((e, i) => (
                      <MoodEntryRow key={e.topic_id} entry={e} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Worried and law highlight */}
            {data.worried_and_law.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                  <span className="text-base">😟</span>
                  You Were Worried — But They Still Became Law
                </h2>
                <div className="rounded-2xl bg-surface-100 border border-against-500/20 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {data.worried_and_law.map((e, i) => (
                      <MoodEntryRow key={e.topic_id} entry={e} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Recent mood history */}
            {data.recent_moods.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider font-mono mb-3">
                  Recent Moods
                </h2>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {data.recent_moods.map((e, i) => (
                      <div
                        key={e.topic_id}
                        className="border-b border-surface-300/40 last:border-0"
                      >
                        <MoodEntryRow entry={e} index={i} />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Footer — cross-links */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link
                href="/mood"
                className="flex items-center justify-center gap-2 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-xs font-mono font-medium text-surface-400 hover:border-surface-400 hover:text-white transition-colors"
              >
                <Heart className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                Platform Mood
              </Link>
              <Link
                href="/analytics"
                className="flex items-center justify-center gap-2 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-xs font-mono font-medium text-surface-400 hover:border-surface-400 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                Full Analytics
              </Link>
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
