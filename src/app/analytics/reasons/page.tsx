'use client'

/**
 * /analytics/reasons — Hot Take Voice Analytics
 *
 * Shows how often you explain your votes (hot takes), which categories you
 * reason about most, your favourite words, and your recent hot takes.
 *
 * Distinct from:
 *   /hot-takes      — platform-wide vote-reason feed
 *   /analytics/votes — raw voting stats (streaks, day/time patterns)
 *   /analytics/sentiment — emotional tone of your language
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Flame,
  MessageCircle,
  Quote,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ReasonsData,
  CategoryReasonStat,
  WordFrequency,
  RecentReason,
  MonthlyReasonTrend,
} from '@/app/api/analytics/reasons/route'

// ─── Category colours ─────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-for-400',
  Culture:     'bg-gold',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-purple',
  Other:       'bg-surface-400',
}

const CAT_TEXT: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Other:       'text-surface-400',
}

function catBar(cat: string) {
  return CAT_COLOR[cat] ?? CAT_COLOR.Other
}
function catText(cat: string) {
  return CAT_TEXT[cat] ?? CAT_TEXT.Other
}

// ─── Word size scale ────────────────────────────────────────────────────────────────

function wordSize(count: number, max: number): string {
  const pct = max > 0 ? count / max : 0
  if (pct >= 0.8) return 'text-xl font-bold'
  if (pct >= 0.55) return 'text-base font-semibold'
  if (pct >= 0.3) return 'text-sm font-medium'
  return 'text-xs font-normal'
}

function wordColor(count: number, max: number): string {
  const pct = max > 0 ? count / max : 0
  if (pct >= 0.8) return 'text-gold'
  if (pct >= 0.55) return 'text-for-300'
  if (pct >= 0.3) return 'text-for-400'
  return 'text-surface-500'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Sub-components ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: number | string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      <span className={cn('text-2xl font-mono font-bold', color)}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </span>
      {sub && <span className="text-[10px] font-mono text-surface-500">{sub}</span>}
    </div>
  )
}

function CategoryBar({ stat, max }: { stat: CategoryReasonStat; max: number }) {
  const pct = max > 0 ? Math.round((stat.count / max) * 100) : 0
  const forPct = stat.count > 0 ? Math.round((stat.for_count / stat.count) * 100) : 50

  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono w-24 shrink-0 truncate', catText(stat.category))}>
        {stat.category}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', catBar(stat.category))}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[11px] font-mono text-surface-500 w-6 text-right">{stat.count}</span>
      </div>
      <div className="w-16 shrink-0 flex items-center gap-0.5">
        <div
          className="h-1.5 rounded-l bg-for-500"
          style={{ width: `${forPct}%`, maxWidth: '100%' }}
        />
        <div
          className="h-1.5 rounded-r bg-against-500"
          style={{ width: `${100 - forPct}%`, maxWidth: '100%' }}
        />
      </div>
    </div>
  )
}

function WordCloud({ words }: { words: WordFrequency[] }) {
  if (words.length === 0) return null
  const max = words[0]?.count ?? 1

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {words.map(({ word, count }) => (
        <motion.span
          key={word}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'leading-tight px-2 py-0.5 rounded-lg bg-surface-200 border border-surface-300 cursor-default',
            wordSize(count, max),
            wordColor(count, max)
          )}
          title={`Used ${count} time${count !== 1 ? 's' : ''}`}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

function MonthlyChart({ trend }: { trend: MonthlyReasonTrend[] }) {
  if (trend.length === 0) return null
  const max = Math.max(...trend.map((t) => t.count), 1)

  return (
    <div className="flex items-end gap-1.5 h-24">
      {trend.map((t) => {
        const heightPct = Math.max((t.count / max) * 100, 4)
        return (
          <div key={t.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <motion.div
              className="w-full rounded-t-sm bg-for-500/50 hover:bg-for-500 transition-colors cursor-default"
              style={{ height: `${heightPct}%` }}
              initial={{ scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              title={`${t.label}: ${t.count} reason${t.count !== 1 ? 's' : ''}`}
            />
            <span className="text-[9px] font-mono text-surface-600 truncate w-full text-center">
              {t.label.split(' ')[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RecentReasonCard({ reason }: { reason: RecentReason }) {
  const isFor = reason.side === 'blue'

  return (
    <Link
      href={`/topic/${reason.topic_id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors group',
        isFor
          ? 'bg-for-900/20 border-for-700/30 hover:border-for-600/50'
          : 'bg-against-900/20 border-against-700/30 hover:border-against-600/50'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full mt-0.5',
            isFor ? 'bg-for-500/20' : 'bg-against-500/20'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3 w-3 text-for-400" />
          ) : (
            <ThumbsDown className="h-3 w-3 text-against-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn(
            'text-sm font-mono leading-snug',
            isFor ? 'text-for-200' : 'text-against-200'
          )}>
            &ldquo;{reason.reason}&rdquo;
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-mono text-surface-500 truncate">
              {reason.topic_statement.length > 60
                ? reason.topic_statement.slice(0, 60) + '…'
                : reason.topic_statement}
            </span>
            <ChevronRight className="h-3 w-3 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            {reason.topic_category && (
              <span className={cn('text-[10px] font-mono', catText(reason.topic_category))}>
                {reason.topic_category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(reason.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────────────────

export default function ReasonsAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<ReasonsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/reasons', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load reasons analytics')
      const json: ReasonsData = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-gold" />
            <h1 className="font-mono text-lg font-bold text-white">Hot Take Voice</h1>
            <Badge variant="proposed">Analytics</Badge>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <p className="text-xs font-mono text-surface-500 -mt-2">
          How often you explain your votes — and what you say when you do.
        </p>

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-14 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && data && data.total_reasons === 0 && (
          <EmptyState
            icon={Quote}
            title="No hot takes yet"
            description="Next time you vote, add a short reason — your hot takes build a unique civic voice."
            action={{ label: 'Browse Topics', href: '/' }}
          />
        )}

        {/* Content */}
        {!loading && data && data.total_reasons > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Hot Takes"
                  value={data.total_reasons}
                  sub="votes explained"
                  color="text-gold"
                />
                <StatCard
                  label="Reason Rate"
                  value={`${data.reason_rate}%`}
                  sub="of votes with reason"
                  color={data.reason_rate >= 50 ? 'text-emerald' : data.reason_rate >= 25 ? 'text-for-400' : 'text-gold'}
                />
                <StatCard
                  label="FOR Takes"
                  value={data.for_reasons}
                  sub="supporting"
                  color="text-for-400"
                />
                <StatCard
                  label="AGAINST Takes"
                  value={data.against_reasons}
                  sub="dissenting"
                  color="text-against-400"
                />
              </div>

              {/* Extra stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                    Avg Length
                  </p>
                  <p className="text-xl font-mono font-bold text-white">
                    {data.avg_reason_length}
                    <span className="text-xs text-surface-500 ml-1">chars</span>
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">per hot take</p>
                </div>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                    Top Category
                  </p>
                  <p className={cn(
                    'text-base font-mono font-bold truncate',
                    data.most_active_category ? catText(data.most_active_category) : 'text-surface-500'
                  )}>
                    {data.most_active_category ?? '—'}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">most reasoned</p>
                </div>
              </div>

              {/* FOR vs AGAINST split bar */}
              {data.total_reasons > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Stance Split
                    </p>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-for-400">
                        {Math.round((data.for_reasons / data.total_reasons) * 100)}% FOR
                      </span>
                      <span className="text-against-400">
                        {Math.round((data.against_reasons / data.total_reasons) * 100)}% AGAINST
                      </span>
                    </div>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    <motion.div
                      className="bg-for-500 rounded-l-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.for_reasons / data.total_reasons) * 100}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="bg-against-500 rounded-r-full flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-for-400">
                      <ThumbsUp className="h-3 w-3" />
                      {data.for_reasons} reasons
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-against-400">
                      {data.against_reasons} reasons
                      <ThumbsDown className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              {data.category_breakdown.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      By Category
                    </p>
                  </div>
                  <div className="space-y-3">
                    {data.category_breakdown.map((stat) => (
                      <CategoryBar
                        key={stat.category}
                        stat={stat}
                        max={data.category_breakdown[0].count}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 mt-3">
                    Right mini-bar shows FOR/AGAINST split within each category.
                  </p>
                </div>
              )}

              {/* Monthly trend */}
              {data.monthly_trend.length > 1 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-3.5 w-3.5 text-surface-500" />
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Monthly Activity
                    </p>
                  </div>
                  <MonthlyChart trend={data.monthly_trend} />
                </div>
              )}

              {/* Word cloud */}
              {data.word_frequency.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-3.5 w-3.5 text-gold" />
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Your Civic Vocabulary
                    </p>
                  </div>
                  <WordCloud words={data.word_frequency} />
                  <p className="text-[10px] font-mono text-surface-600 mt-3">
                    Size shows frequency. Stopwords and short words excluded.
                  </p>
                </div>
              )}

              {/* Longest hot take */}
              {data.longest_reason && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Quote className="h-3.5 w-3.5 text-purple" />
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Longest Hot Take
                    </p>
                  </div>
                  <p className="text-sm font-mono text-surface-300 italic leading-relaxed">
                    &ldquo;{data.longest_reason}&rdquo;
                  </p>
                  <p className="text-[10px] font-mono text-surface-600 mt-2">
                    {data.longest_reason.length} characters
                  </p>
                </div>
              )}

              {/* Recent hot takes */}
              {data.recent_reasons.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-3.5 w-3.5 text-surface-500" />
                      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                        Recent Hot Takes
                      </p>
                    </div>
                    <Link
                      href="/hot-takes"
                      className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                    >
                      Platform feed
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.recent_reasons.map((r) => (
                      <RecentReasonCard key={r.id} reason={r} />
                    ))}
                  </div>
                </div>
              )}

              {/* Links to related analytics */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Related Analytics
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { href: '/analytics/votes', label: 'Vote History', icon: Zap, color: 'text-for-400' },
                    { href: '/analytics/sentiment', label: 'Sentiment', icon: Flame, color: 'text-against-400' },
                    { href: '/analytics/arguments', label: 'Arguments', icon: MessageCircle, color: 'text-purple' },
                    { href: '/hot-takes', label: 'Platform Feed', icon: Quote, color: 'text-gold' },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors text-xs font-mono text-surface-400 hover:text-white"
                    >
                      <Icon className={cn('h-3 w-3', color)} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
