'use client'

/**
 * /oracle — The Oracle of the Lobby
 *
 * AI-powered passage-likelihood engine. Scores every topic currently in
 * voting by a statistical model (vote split × volume × time pressure) and
 * categorises them as Destined to Pass / Contested / Fated to Fall.
 * Claude generates a one-sentence prophecy for the most interesting picks.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { OracleTopic, OracleResponse } from '@/app/api/oracle/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

function hoursLabel(h: number | null): string {
  if (h === null) return 'No deadline'
  if (h < 1) return 'Closing soon'
  if (h < 24) return `${Math.round(h)}h left`
  const d = Math.floor(h / 24)
  return `${d}d left`
}

function scoreBar(score: number, verdict: OracleTopic['verdict']) {
  const barColor =
    verdict === 'pass'
      ? 'bg-for-500'
      : verdict === 'fail'
        ? 'bg-against-500'
        : 'bg-surface-300'
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-200 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700', barColor)}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function confidencePill(c: OracleTopic['confidence']) {
  if (c === 'high') return <span className="text-xs text-emerald font-medium">High signal</span>
  if (c === 'moderate') return <span className="text-xs text-gold font-medium">Moderate signal</span>
  return <span className="text-xs text-surface-400 font-medium">Low signal</span>
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, rank }: { topic: OracleTopic; rank: number }) {
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="group relative"
    >
      <Link href={`/topic/${topic.id}`}>
        <div className="border border-surface-200 hover:border-surface-300 rounded-xl p-4 bg-surface-100 hover:bg-surface-150 transition-all duration-200 cursor-pointer">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              {topic.category && (
                <span className={cn('text-xs font-medium mb-1 block', catColor)}>
                  {topic.category}
                </span>
              )}
              <p className="text-sm font-medium text-surface-900 leading-snug line-clamp-2">
                {topic.statement}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={cn(
                  'text-lg font-bold tabular-nums',
                  topic.verdict === 'pass'
                    ? 'text-for-400'
                    : topic.verdict === 'fail'
                      ? 'text-against-400'
                      : 'text-surface-400',
                )}
              >
                {topic.passage_score}
                <span className="text-xs font-normal ml-0.5">%</span>
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{confidencePill(topic.confidence)}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">{scoreBar(topic.passage_score, topic.verdict)}</div>

          {/* Vote split + meta */}
          <div className="flex items-center gap-3 text-xs text-surface-500 mb-3">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3 text-for-400" />
              <span className="text-for-400 font-medium">{topic.blue_pct}%</span>
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="w-3 h-3 text-against-400" />
              <span className="text-against-400 font-medium">{100 - topic.blue_pct}%</span>
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Zap className="w-3 h-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
            {topic.hours_remaining !== null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {hoursLabel(topic.hours_remaining)}
              </span>
            )}
          </div>

          {/* Oracle prophecy */}
          {topic.prophecy && (
            <div className="border-t border-surface-200 pt-3 mt-1">
              <p className="text-xs text-surface-400 italic leading-relaxed">
                <Eye className="w-3 h-3 inline mr-1 text-purple opacity-70" />
                {topic.prophecy}
              </p>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconClass,
  topics,
  emptyText,
}: {
  title: string
  icon: typeof Gavel
  iconClass: string
  topics: OracleTopic[]
  emptyText: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={cn('w-4 h-4', iconClass)} />
        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">{title}</h2>
        {topics.length > 0 && (
          <span className="ml-auto text-xs text-surface-400 font-medium">
            {topics.length} topic{topics.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {topics.length === 0 ? (
        <p className="text-xs text-surface-400 italic py-4 text-center">{emptyText}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((t, i) => (
            <TopicCard key={t.id} topic={t} rank={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OracleSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((s) => (
        <div key={s}>
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border border-surface-200 rounded-xl p-4 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OraclePage() {
  const [data, setData] = useState<OracleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/oracle')
      if (!res.ok) throw new Error('Failed to fetch oracle data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totalTopics = data
    ? data.likely_pass.length + data.contested.length + data.likely_fail.length
    : 0

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-purple" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900">The Oracle</h1>
              </div>
              <p className="text-sm text-surface-500 max-w-lg leading-relaxed">
                Statistical passage-likelihood scores for every topic currently in voting. Based on
                vote split, participation volume, and time remaining.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="shrink-0 p-2 rounded-lg border border-surface-200 text-surface-500 hover:text-surface-700 hover:border-surface-300 transition-colors disabled:opacity-40"
              aria-label="Refresh oracle"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Stats strip */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-4 p-3 bg-surface-100 rounded-xl border border-surface-200 text-xs text-surface-500"
            >
              <span className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-purple" />
                <strong className="text-surface-700">{data.stats.total_voting}</strong> topics in voting
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-for-400" />
                Platform leaning{' '}
                <strong className={cn(data.stats.avg_blue_pct >= 50 ? 'text-for-400' : 'text-against-400')}>
                  {data.stats.avg_blue_pct >= 50 ? 'FOR' : 'AGAINST'} ({data.stats.avg_blue_pct}%)
                </strong>
              </span>
              {data.generated_at && (
                <span className="ml-auto flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated just now
                </span>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OracleSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Swords}
                title="Oracle Unavailable"
                description={error}
                actions={[{ label: 'Try Again', onClick: load }]}
              />
            </motion.div>
          ) : totalTopics === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Eye}
                title="The Oracle sees nothing"
                description="No topics are currently in voting. Check back when debates are active."
                actions={[{ label: 'Browse Feed', href: '/' }]}
              />
            </motion.div>
          ) : (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <Section
                title="Destined to Pass"
                icon={CheckCircle2}
                iconClass="text-for-400"
                topics={data!.likely_pass}
                emptyText="No topics are showing a clear majority right now."
              />
              <Section
                title="Too Close to Call"
                icon={Scale}
                iconClass="text-gold"
                topics={data!.contested}
                emptyText="No topics are in the contested zone right now."
              />
              <Section
                title="Fated to Fall"
                icon={XCircle}
                iconClass="text-against-400"
                topics={data!.likely_fail}
                emptyText="No topics are showing a clear opposition majority."
              />

              {/* Methodology note */}
              <div className="border border-surface-200 rounded-xl p-4 bg-surface-50">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-3.5 h-3.5 text-gold" />
                  <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">
                    How the Oracle works
                  </span>
                </div>
                <p className="text-xs text-surface-500 leading-relaxed">
                  Passage scores combine the current vote split, participation volume, and time
                  remaining before the deadline. Topics with fewer votes are pulled toward 50% until
                  sufficient signal accumulates. As the deadline approaches, strong leads become
                  more decisive. Scores above 58% are classified as likely to pass; below 42% as
                  likely to fail.
                  {data?.likely_pass.some((t) => t.prophecy) ||
                  data?.contested.some((t) => t.prophecy) ||
                  data?.likely_fail.some((t) => t.prophecy)
                    ? ' Italicised prophecies are generated by Claude AI.'
                    : ''}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
