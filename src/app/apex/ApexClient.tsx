'use client'

/**
 * /apex — The Civic Apex
 *
 * Per-category record holders for every civic domain on Lobby Market.
 * Each category shows 6 records:
 *   • Consensus Champion  — highest FOR% (min 20 votes)
 *   • Dissent Leader      — lowest FOR% (min 20 votes)
 *   • Most Engaged        — highest total votes
 *   • Most Argued         — most arguments written
 *   • Most Contested      — closest to 50/50 with meaningful vote count
 *   • Fastest Law         — passed into law in the fewest days
 *
 * Platform-level tab shows the absolute records across all categories.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Crown,
  Flame,
  Gavel,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Skull,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ApexResponse, ApexCategory, ApexRecord } from '@/app/api/apex/route'

// ─── Category config ──────────────────────────────────────────────────────────

type TabKey = 'platform' | string

const CATEGORY_BG: Record<string, string> = {
  Economics:   'bg-for-500/10 border-for-500/30',
  Politics:    'bg-purple/10 border-purple/30',
  Technology:  'bg-for-400/10 border-for-400/30',
  Science:     'bg-emerald/10 border-emerald/30',
  Ethics:      'bg-gold/10 border-gold/30',
  Philosophy:  'bg-purple/10 border-purple/30',
  Culture:     'bg-against-400/10 border-against-400/30',
  Health:      'bg-emerald/10 border-emerald/30',
  Environment: 'bg-emerald/10 border-emerald/30',
  Education:   'bg-for-400/10 border-for-400/30',
}

// ─── Record icon map ──────────────────────────────────────────────────────────

const RECORD_ICON: Record<string, typeof Trophy> = {
  'Consensus Champion': ThumbsUp,
  'Dissent Leader':     ThumbsDown,
  'Most Engaged':       Users,
  'Most Argued':        MessageSquare,
  'Most Contested':     Scale,
  'Fastest Law':        Gavel,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ApexSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <Skeleton className="h-6 w-14 rounded" />
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({
  record,
  delay = 0,
}: {
  record: ApexRecord
  delay?: number
}) {
  const Icon = RECORD_ICON[record.label] ?? Trophy

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3 hover:border-surface-400 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 flex-shrink-0">
          <Icon className={cn('h-3.5 w-3.5', record.value_color)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-bold text-white leading-tight">
            {record.label}
          </p>
          <p className="text-xs font-mono text-surface-500 leading-tight truncate">
            {record.sublabel}
          </p>
        </div>
        <span className={cn('text-sm font-mono font-black shrink-0', record.value_color)}>
          {record.value}
        </span>
      </div>

      {record.topic ? (
        <>
          {/* Topic statement */}
          <Link
            href={`/topic/${record.topic.id}`}
            className="block text-sm font-mono text-surface-300 hover:text-white transition-colors leading-snug line-clamp-2"
          >
            {record.topic.statement}
            <ArrowRight
              className="inline-block ml-1 h-3 w-3 text-surface-500 flex-shrink-0 -translate-y-px"
              aria-hidden="true"
            />
          </Link>

          {/* FOR% bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono text-surface-600">
              <span>{record.topic.blue_pct.toFixed(1)}% FOR</span>
              <span>{(100 - record.topic.blue_pct).toFixed(1)}% AGAINST</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  record.topic.blue_pct >= 55
                    ? 'bg-for-500'
                    : record.topic.blue_pct <= 45
                      ? 'bg-against-500'
                      : 'bg-yellow-500'
                )}
                style={{ width: `${record.topic.blue_pct}%` }}
              />
            </div>
          </div>

          {/* Status pill + vote count */}
          <div className="flex items-center gap-2">
            {record.topic.status === 'law' && (
              <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/30">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Law
              </span>
            )}
            {record.topic.status === 'failed' && (
              <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-against-500/10 text-against-400 border border-against-500/30">
                <Skull className="h-3 w-3" aria-hidden="true" />
                Failed
              </span>
            )}
            {(record.topic.status === 'active' || record.topic.status === 'voting') && (
              <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-for-500/10 text-for-400 border border-for-500/30">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {record.topic.status === 'voting' ? 'Voting' : 'Active'}
              </span>
            )}
            <span className="text-xs font-mono text-surface-600 ml-auto">
              {record.topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm font-mono text-surface-600 italic">
          No qualifying topics yet
        </p>
      )}
    </motion.div>
  )
}

// ─── Platform stats strip ─────────────────────────────────────────────────────

function PlatformStats({
  total_topics,
  total_laws,
  total_failed,
  total_votes,
  law_rate,
}: {
  total_topics: number
  total_laws: number
  total_failed: number
  total_votes: number
  law_rate: number
}) {
  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : n.toLocaleString()

  const stats = [
    { label: 'Topics', value: fmt(total_topics), color: 'text-white' },
    { label: 'Laws', value: fmt(total_laws), color: 'text-gold' },
    { label: 'Failed', value: fmt(total_failed), color: 'text-against-400' },
    { label: 'Votes cast', value: fmt(total_votes), color: 'text-for-300' },
    { label: 'Law rate', value: `${law_rate.toFixed(0)}%`, color: 'text-emerald' },
  ]

  return (
    <div className="grid grid-cols-5 gap-2 mb-6 p-3 rounded-xl bg-surface-100 border border-surface-300">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="text-center">
          <p className={cn('text-base font-mono font-black', color)}>{value}</p>
          <p className="text-xs font-mono text-surface-600 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Category stats strip ─────────────────────────────────────────────────────

function CategoryStats({ cat }: { cat: ApexCategory }) {
  return (
    <div className="flex items-center gap-4 mb-6 p-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-500">
      <span>
        <span className="text-white font-bold">{cat.total_topics}</span> topics
      </span>
      <span>
        <span className="text-gold font-bold">{cat.law_count}</span> laws
      </span>
      <span>
        <span className="text-emerald font-bold">
          {cat.total_topics > 0 ? ((cat.law_count / cat.total_topics) * 100).toFixed(0) : 0}%
        </span>{' '}
        law rate
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApexClient() {
  const [data, setData] = useState<ApexResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('platform')

  const fetchApex = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/apex', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ApexResponse
      setData(json)
    } catch {
      setError('Unable to load apex records. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchApex() }, [fetchApex])

  // Build tab list: Platform + all categories present in data
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'platform', label: 'Platform' },
    ...(data?.categories.map((c) => ({ key: c.category, label: c.category })) ?? []),
  ]

  // Get current records
  const currentRecords =
    activeTab === 'platform'
      ? data?.platform.records
      : data?.categories.find((c) => c.category === activeTab)?.records

  const currentCategory = activeTab !== 'platform'
    ? data?.categories.find((c) => c.category === activeTab)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold flex-shrink-0" aria-hidden="true" />
              <h1 className="font-mono text-2xl font-black text-white">
                The Civic Apex
              </h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              All-time record holders across every civic category
            </p>
          </div>
          <button
            onClick={() => fetchApex(true)}
            disabled={loading || refreshing}
            aria-label="Refresh records"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* ── Category tabs ───────────────────────────────────────────────────── */}
        {!loading && data && (
          <div
            className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-hide"
            role="tablist"
            aria-label="Category selector"
          >
            {tabs.map(({ key, label }) => {
              const isActive = activeTab === key
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all flex-shrink-0',
                    isActive
                      ? 'bg-surface-200 text-white border border-surface-400'
                      : 'text-surface-500 hover:text-white hover:bg-surface-200/60 border border-transparent'
                  )}
                >
                  {key === 'platform' && (
                    <Globe className="inline-block h-3 w-3 mr-1 -translate-y-px" aria-hidden="true" />
                  )}
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 mb-6 flex items-center gap-3">
            <Crown className="h-5 w-5 text-against-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => fetchApex()}
              className="ml-auto text-xs font-mono text-against-300 hover:text-against-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ApexSkeleton />
            </motion.div>
          ) : data ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Platform stats OR category stats */}
              {activeTab === 'platform' ? (
                <PlatformStats
                  total_topics={data.platform.total_topics}
                  total_laws={data.platform.total_laws}
                  total_failed={data.platform.total_failed}
                  total_votes={data.platform.total_votes}
                  law_rate={data.platform.law_rate}
                />
              ) : currentCategory ? (
                <div className={cn('rounded-xl border p-3 mb-6', CATEGORY_BG[activeTab] ?? 'bg-surface-100 border-surface-300')}>
                  <CategoryStats cat={currentCategory} />
                </div>
              ) : null}

              {/* Record grid */}
              {currentRecords && currentRecords.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentRecords.map((record, i) => (
                    <RecordCard
                      key={record.label}
                      record={record}
                      delay={i * 0.05}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Trophy className="h-10 w-10 text-surface-500 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm font-mono text-surface-500">No records yet for this category</p>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-col items-center gap-3 text-center"
          >
            <p className="text-xs font-mono text-surface-600">
              Records refresh every 10 minutes · Updated{' '}
              {new Date(data.generated_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link
                href="/watershed"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Watershed
              </Link>
              <span className="text-surface-700" aria-hidden="true">·</span>
              <Link
                href="/awards"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Awards Hall
              </Link>
              <span className="text-surface-700" aria-hidden="true">·</span>
              <Link
                href="/records"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                Platform Records
              </Link>
              <span className="text-surface-700" aria-hidden="true">·</span>
              <Link
                href="/leaderboard"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Leaderboard
              </Link>
            </div>
          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
