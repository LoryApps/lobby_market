'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Globe,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodAtlasResponse, CategoryMoodEntry } from '@/app/api/mood/atlas/route'
import type { MoodKind } from '@/app/api/mood/route'

// ─── Mood config ──────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<
  MoodKind,
  { emoji: string; label: string; color: string; bg: string; border: string }
> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful',    color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  inspired:   { emoji: '✨', label: 'Inspired',   color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  proud:      { emoji: '🏆', label: 'Proud',      color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  determined: { emoji: '💪', label: 'Determined', color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  worried:    { emoji: '😟', label: 'Worried',    color: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-600/30' },
  angry:      { emoji: '😠', label: 'Angry',      color: 'text-against-500', bg: 'bg-against-500/15', border: 'border-against-500/40' },
  relieved:   { emoji: '😮‍💨', label: 'Relieved', color: 'text-for-300',     bg: 'bg-for-600/10',     border: 'border-for-600/20'     },
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; text: string }> = {
  Economics:   { emoji: '💰', color: 'bg-gold/10 border-gold/30',             text: 'text-gold'         },
  Politics:    { emoji: '🏛️', color: 'bg-for-500/10 border-for-500/30',       text: 'text-for-400'      },
  Technology:  { emoji: '⚡', color: 'bg-purple/10 border-purple/30',         text: 'text-purple'       },
  Science:     { emoji: '🔬', color: 'bg-emerald/10 border-emerald/30',       text: 'text-emerald'      },
  Ethics:      { emoji: '⚖️', color: 'bg-against-500/10 border-against-500/30', text: 'text-against-400' },
  Philosophy:  { emoji: '🦉', color: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400'   },
  Culture:     { emoji: '🎭', color: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400'   },
  Health:      { emoji: '🏥', color: 'bg-pink-500/10 border-pink-500/30',     text: 'text-pink-400'     },
  Environment: { emoji: '🌍', color: 'bg-green-500/10 border-green-500/30',   text: 'text-green-400'    },
  Education:   { emoji: '📚', color: 'bg-cyan-500/10 border-cyan-500/30',     text: 'text-cyan-400'     },
  Other:       { emoji: '📌', color: 'bg-surface-700/30 border-surface-600/30', text: 'text-surface-400' },
}

function getCategoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other
}

// ─── Mood bar ─────────────────────────────────────────────────────────────────

const MOOD_BAR_COLORS: Record<MoodKind, string> = {
  hopeful:    'bg-for-500',
  inspired:   'bg-gold',
  proud:      'bg-emerald',
  determined: 'bg-purple',
  frustrated: 'bg-against-500',
  worried:    'bg-against-600',
  angry:      'bg-against-700',
  relieved:   'bg-for-300',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

interface CategoryCardProps {
  entry: CategoryMoodEntry
  index: number
}

function CategoryCard({ entry, index }: CategoryCardProps) {
  const catCfg = getCategoryConfig(entry.category)
  const domCfg = MOOD_CONFIG[entry.dominant_mood]
  const topMoods = entry.moods.slice(0, 4)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4',
        catCfg.color
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{catCfg.emoji}</span>
          <div>
            <div className={cn('font-semibold text-sm', catCfg.text)}>{entry.category}</div>
            <div className="text-xs text-surface-400 mt-0.5">
              {entry.total.toLocaleString()} mood{entry.total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1',
            domCfg.bg,
            domCfg.border,
            'border text-xs font-medium',
            domCfg.color
          )}
        >
          <span className="text-sm leading-none">{domCfg.emoji}</span>
          <span>{domCfg.label}</span>
        </div>
      </div>

      {/* Positive / anxious split */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-surface-400">
          <span>Positive {entry.positive_pct}%</span>
          <span>Anxious {entry.anxious_pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-surface-700 flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${entry.positive_pct}%` }}
            transition={{ duration: 0.7, delay: index * 0.05 }}
            className="bg-for-500 rounded-l-full"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${entry.anxious_pct}%` }}
            transition={{ duration: 0.7, delay: index * 0.05 + 0.1 }}
            className="bg-against-500 rounded-r-full"
          />
        </div>
      </div>

      {/* Mood distribution */}
      <div className="space-y-1.5">
        {topMoods.map((m) => (
          <div key={m.mood} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-center text-sm leading-none">{MOOD_CONFIG[m.mood].emoji}</span>
            <span className="w-20 text-surface-300 truncate">{MOOD_CONFIG[m.mood].label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.pct}%` }}
                transition={{ duration: 0.6, delay: index * 0.05 + 0.15 }}
                className={cn('h-full rounded-full', MOOD_BAR_COLORS[m.mood])}
              />
            </div>
            <span className="w-8 text-right text-surface-400">{m.pct}%</span>
          </div>
        ))}
      </div>

      {/* Top topics */}
      {entry.top_topics.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <div className="text-xs text-surface-500 uppercase tracking-wide">Top topics</div>
          {entry.top_topics.map((t) => (
            <Link
              key={t.id}
              href={`/topic/${t.id}/mood`}
              className="flex items-start gap-2 group"
            >
              <span className="text-sm leading-snug mt-0.5 shrink-0">
                {MOOD_CONFIG[t.top_mood]?.emoji ?? '•'}
              </span>
              <span className="text-xs text-surface-300 group-hover:text-white transition-colors line-clamp-1">
                {t.statement}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Link to mood filter */}
      <Link
        href={`/mood/${entry.dominant_mood}`}
        className={cn('text-xs flex items-center gap-1 hover:opacity-80 transition-opacity', domCfg.color)}
      >
        <Sparkles className="w-3 h-3" />
        Browse {domCfg.label} topics →
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MoodAtlasClient() {
  const [data, setData] = useState<MoodAtlasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mood/atlas', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load mood atlas')
      const json = await res.json() as MoodAtlasResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-28 space-y-6">

        {/* Back nav */}
        <Link
          href="/mood"
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Civic Mood
        </Link>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-for-400" />
            <h1 className="text-xl font-bold">Mood Atlas</h1>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="ml-auto p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>
          <p className="text-sm text-surface-400">
            The emotional fingerprint of every civic debate category — how the Lobby feels, topic by topic.
          </p>
          {data && (
            <div className="flex items-center gap-2 pt-1">
              <BarChart2 className="w-3.5 h-3.5 text-surface-500" />
              <span className="text-xs text-surface-500">
                {data.total_responses.toLocaleString()} mood responses across {data.categories.length} categories
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PageSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<BarChart2 className="w-8 h-8" />}
                title="Couldn't load mood atlas"
                description={error}
                action={
                  <button
                    onClick={() => load()}
                    className="mt-2 text-sm text-for-400 hover:text-for-300 transition-colors"
                  >
                    Try again
                  </button>
                }
              />
            </motion.div>
          ) : !data || data.categories.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Globe className="w-8 h-8" />}
                title="No mood data yet"
                description="Be the first to express how civic topics make you feel."
                action={
                  <Link href="/mood" className="mt-2 text-sm text-for-400 hover:text-for-300 transition-colors">
                    Explore topics → express a mood
                  </Link>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {data.categories.map((entry, i) => (
                <CategoryCard key={entry.category} entry={entry} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/mood"
            className="text-xs text-surface-400 hover:text-white transition-colors border border-surface-700 rounded-full px-3 py-1.5"
          >
            Platform Mood
          </Link>
          <Link
            href="/mood/trending"
            className="text-xs text-surface-400 hover:text-white transition-colors border border-surface-700 rounded-full px-3 py-1.5"
          >
            Trending Moods
          </Link>
          <Link
            href="/analytics/moods"
            className="text-xs text-surface-400 hover:text-white transition-colors border border-surface-700 rounded-full px-3 py-1.5"
          >
            My Mood Analytics
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
