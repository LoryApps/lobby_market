'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  Moon,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LighthouseResponse, LighthouseTopic } from '@/app/api/civic/lighthouse/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1_000

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function darknessBadge(days: number): { label: string; color: string } {
  if (days >= 90) return { label: `${days}d dark`, color: 'text-against-400 bg-against-900/30 border-against-500/40' }
  if (days >= 30) return { label: `${days}d dark`, color: 'text-gold bg-gold/10 border-gold/30' }
  return { label: `${days}d dark`, color: 'text-surface-400 bg-surface-200 border-surface-400/30' }
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function LighthouseCard({ topic, index }: { topic: LighthouseTopic; index: number }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const badge = darknessBadge(topic.days_dark)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 transition-colors"
    >
      <Link href={`/topic/${topic.id}`} className="block p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug line-clamp-3">
              {topic.statement}
            </p>
          </div>
          {/* Darkness badge */}
          <span
            className={cn(
              'flex-shrink-0 text-xs font-mono font-bold px-2 py-1 rounded-lg border',
              badge.color,
            )}
          >
            {badge.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mb-3">
          {topic.category && (
            <span className={cn('text-xs font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
          <span className="text-surface-600">·</span>
          <span className="text-xs text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
          <span className="text-surface-600">·</span>
          <span className="text-xs font-mono text-surface-500 capitalize">
            {topic.status}
          </span>
        </div>

        {/* Vote bar */}
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + index * 0.04 }}
              className="h-full bg-gradient-to-r from-for-700 to-for-400 rounded-full"
            />
          </div>
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
        </div>

        <div className="flex justify-between mt-1.5">
          <span className="text-xs font-mono text-for-400">FOR {forPct}%</span>
          <span className="text-xs font-mono text-against-400">AGAINST {againstPct}%</span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Clock
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 px-4 py-3 rounded-xl border', color)}>
      <Icon className="h-4 w-4 mb-0.5" />
      <span className="text-xl font-bold font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="text-xs font-mono text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LighthouseSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LighthouseClient() {
  const [data, setData] = useState<LighthouseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (category: string | null = null, manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const url = category
        ? `/api/civic/lighthouse?category=${encodeURIComponent(category)}`
        : '/api/civic/lighthouse'
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as LighthouseResponse
        setData(json)
        setLastUpdated(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(activeCategory)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => load(activeCategory), POLL_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load, activeCategory])

  function handleCategory(cat: string | null) {
    setActiveCategory(cat)
    setLoading(true)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Moon className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Lighthouse</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Important debates gone dark — shine a light
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs font-mono text-surface-500 hidden sm:block">
                {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => load(activeCategory, true)}
              disabled={refreshing}
              aria-label="Refresh lighthouse"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        {data && !loading && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2 mb-6"
            aria-label="Lighthouse stats"
          >
            <StatPill
              icon={TrendingDown}
              label="Neglected"
              value={data.stats.neglected_count}
              color="bg-against-500/10 border-against-500/30 text-against-400"
            />
            <StatPill
              icon={Clock}
              label="Longest dark"
              value={`${data.stats.longest_dark_days}d`}
              color="bg-gold/10 border-gold/30 text-gold"
            />
            <StatPill
              icon={ThumbsUp}
              label="Total votes"
              value={data.stats.total_neglected_votes}
              color="bg-for-500/10 border-for-500/30 text-for-400"
            />
          </motion.section>
        )}

        {/* ── Category filter ─────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          <button
            onClick={() => handleCategory(null)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
              activeCategory === null
                ? 'bg-for-500/20 border-for-500/50 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white',
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                activeCategory === cat
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <LighthouseSkeleton />
        ) : !data || data.topics.length === 0 ? (
          <EmptyState
            icon={Moon}
            title="No neglected topics found"
            description={
              activeCategory
                ? `No dark ${activeCategory} topics right now. Try another category.`
                : 'All civic topics are currently receiving attention. Check back later.'
            }
            action={{
              label: 'Browse all topics',
              href: '/',
            }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory ?? 'all'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {data.topics.map((topic, i) => (
                <LighthouseCard key={topic.id} topic={topic} index={i} />
              ))}

              <Link
                href="/"
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Browse all topics
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Footer note ──────────────────────────────────────────────── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 mt-6 py-3 px-4 rounded-xl bg-surface-100 border border-surface-300"
          >
            <Moon className="h-4 w-4 text-surface-500 flex-shrink-0" />
            <p className="text-xs font-mono text-surface-500">
              Neglect score = days since activity / (votes + 1). Topics with few votes and long inactivity rank highest. Refreshes every 5 minutes.
            </p>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
