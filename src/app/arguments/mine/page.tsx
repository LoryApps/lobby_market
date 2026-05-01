'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MineResponse, MineArgument, CategoryStat, WeekBucket } from '@/app/api/arguments/mine/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatWeek(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting',
  law: 'LAW', failed: 'Failed', continued: 'Continued', archived: 'Archived',
}
const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active',
  law: 'law', failed: 'failed', continued: 'proposed', archived: 'proposed',
}

// ─── Weekly Sparkline (SVG) ───────────────────────────────────────────────────

function WeeklyChart({ buckets }: { buckets: WeekBucket[] }) {
  if (buckets.length < 2) return null
  const max = Math.max(...buckets.map((b) => b.count), 1)
  const W = 280
  const H = 48
  const pad = 4
  const colW = (W - pad * 2) / buckets.length
  const barW = Math.max(colW * 0.6, 4)

  return (
    <div className="mt-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} className="overflow-visible">
        {buckets.map((b, i) => {
          const barH = b.count === 0 ? 2 : Math.max(4, ((b.count / max) * H))
          const x = pad + i * colW + (colW - barW) / 2
          const y = H - barH
          const isHigh = b.count === max && b.count > 0
          return (
            <g key={b.week}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                className={cn(
                  'transition-all',
                  isHigh ? 'fill-for-500' : b.count > 0 ? 'fill-for-700/60' : 'fill-surface-300/40'
                )}
              />
              {/* Show week label for first and last */}
              {(i === 0 || i === buckets.length - 1) && (
                <text
                  x={x + barW / 2}
                  y={H + 13}
                  textAnchor="middle"
                  className="fill-surface-500"
                  style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {formatWeek(b.week)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

function CategoryRow({ stat, total }: { stat: CategoryStat; total: number }) {
  const pct = total > 0 ? Math.round((stat.total / total) * 100) : 0
  const forPct = stat.total > 0 ? Math.round((stat.forCount / stat.total) * 100) : 50

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0">
        <span className="text-xs font-mono text-surface-400 truncate block">{stat.category}</span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-surface-300/40 overflow-hidden">
        {/* Split bar: FOR (blue) | AGAINST (red) */}
        <div className="h-full flex">
          <div
            className="h-full rounded-l-full bg-for-600/70 transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full rounded-r-full bg-against-600/70 transition-all"
            style={{ width: `${100 - forPct}%` }}
          />
        </div>
      </div>
      <div className="w-14 shrink-0 text-right">
        <span className="text-xs font-mono text-white font-medium">{stat.total}</span>
        <span className="text-xs font-mono text-surface-500"> ({pct}%)</span>
      </div>
    </div>
  )
}

// ─── Argument Row ─────────────────────────────────────────────────────────────

function ArgRow({ arg }: { arg: MineArgument }) {
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'group flex flex-col gap-1.5 rounded-xl border p-3.5 transition-all',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Topic */}
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant={STATUS_BADGE[arg.topic_status] ?? 'proposed'} className="text-[10px] shrink-0">
          {STATUS_LABEL[arg.topic_status] ?? arg.topic_status}
        </Badge>
        <span className="text-xs font-mono text-surface-400 truncate">
          {arg.topic_statement}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-600 leading-relaxed line-clamp-2">
        {arg.content}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-0.5">
        {/* Side pill */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
            arg.side === 'blue'
              ? 'bg-for-500/15 text-for-400 border border-for-500/30'
              : 'bg-against-500/15 text-against-400 border border-against-500/30',
          )}
        >
          {arg.side === 'blue'
            ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
            : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
          {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
        </span>

        {/* Upvotes */}
        <span className="inline-flex items-center gap-1 text-xs font-mono text-surface-400">
          <TrendingUp className="h-3 w-3" aria-hidden />
          {arg.upvotes.toLocaleString()}
        </span>

        {/* Replies */}
        {arg.reply_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-surface-400">
            <MessageSquare className="h-3 w-3" aria-hidden />
            {arg.reply_count}
          </span>
        )}

        {/* Source */}
        {arg.source_url && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald/70">
            <ExternalLink className="h-3 w-3" aria-hidden />
            sourced
          </span>
        )}

        <span className="ml-auto text-[10px] font-mono text-surface-500">
          {relativeTime(arg.created_at)}
        </span>
      </div>
    </Link>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  )
}

function ArgSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 space-y-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyArgumentsPage() {
  const [data, setData] = useState<MineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'top' | 'recent' | 'all'>('top')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/mine')
      if (res.status === 401) {
        setError('Sign in to view your argument history.')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load your arguments. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Which argument list to show
  const displayArgs: MineArgument[] = data
    ? activeTab === 'top'
      ? data.topUpvoted
      : activeTab === 'recent'
      ? data.recentArgs
      : data.arguments
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/arguments"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors shrink-0"
            aria-label="Back to arguments"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">My Arguments</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Personal argument analytics &amp; history
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        {loading ? (
          <StatsSkeleton />
        ) : data && data.totalArguments > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Written', value: data.totalArguments.toLocaleString(), icon: BarChart2, color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
              { label: 'Total Upvotes', value: data.totalUpvotes.toLocaleString(), icon: TrendingUp, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
              { label: 'Avg Upvotes', value: data.avgUpvotes.toLocaleString(), icon: Award, color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
              { label: 'Cited', value: `${data.sourcedCount}/${data.totalArguments}`, icon: BookOpen, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className={cn('rounded-xl border p-4', bg, border, 'bg-surface-100')}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
                  <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wide">{label}</span>
                </div>
                <p className={cn('text-2xl font-mono font-bold', color)}>{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── FOR vs AGAINST bar ───────────────────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-4"
          >
            <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider mb-3">
              Your Stance Split
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-for-400 font-semibold w-14 text-right shrink-0">
                {data.forCount} FOR
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-surface-300/40">
                <div
                  className="h-full rounded-l-full bg-for-500 transition-all"
                  style={{
                    width: `${data.totalArguments > 0
                      ? Math.round((data.forCount / data.totalArguments) * 100)
                      : 50}%`
                  }}
                />
              </div>
              <span className="text-xs font-mono text-against-400 font-semibold w-20 shrink-0">
                {data.againstCount} AGAINST
              </span>
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-mono text-surface-500">
                {data.totalArguments > 0
                  ? `${Math.round((data.forCount / data.totalArguments) * 100)}% FOR`
                  : '–'}
              </span>
              <span className="text-[10px] font-mono text-surface-500">
                {data.totalArguments > 0
                  ? `${Math.round((data.againstCount / data.totalArguments) * 100)}% AGAINST`
                  : '–'}
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Weekly activity chart ────────────────────────────────────────── */}
        {!loading && data && data.weeklyBuckets.length > 0 && data.totalArguments > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-4"
          >
            <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider mb-1">
              Activity (last 12 weeks)
            </h2>
            <WeeklyChart buckets={data.weeklyBuckets} />
          </motion.div>
        )}

        {/* ── Category breakdown ───────────────────────────────────────────── */}
        {!loading && data && data.categoryStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-4"
          >
            <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider mb-3">
              By Category
            </h2>
            <div className="space-y-2.5">
              {data.categoryStats.map((stat) => (
                <CategoryRow key={stat.category} stat={stat} total={data.totalArguments} />
              ))}
            </div>
            <p className="mt-3 text-[10px] font-mono text-surface-500">
              Bar colour: <span className="text-for-400">blue = FOR</span> / <span className="text-against-400">red = AGAINST</span>
            </p>
          </motion.div>
        )}

        {/* ── Argument list ────────────────────────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-surface-200 p-1 w-fit">
              {([
                { id: 'top', label: 'Top Voted' },
                { id: 'recent', label: 'Recent' },
                { id: 'all', label: `All (${data.totalArguments})` },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                    activeTab === tab.id
                      ? 'bg-surface-50 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-400',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* List */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {displayArgs.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No arguments yet"
                    description="Write your first argument on any active topic."
                    action={{ label: 'Browse Topics', href: '/' }}
                  />
                ) : (
                  displayArgs.map((arg) => <ArgRow key={arg.id} arg={arg} />)
                )}
              </motion.div>
            </AnimatePresence>

            {/* Browse all link (when not already showing all) */}
            {activeTab !== 'all' && data.totalArguments > 5 && (
              <Link
                href="/arguments"
                className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors mt-1"
              >
                Browse all arguments on the platform
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </motion.div>
        )}

        {/* ── Loading skeletons ────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <ArgSkeleton key={i} />)}
          </div>
        )}

        {/* ── Empty state (no arguments at all) ───────────────────────────── */}
        {!loading && !error && data && data.totalArguments === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No arguments yet"
            description="Start making your voice heard. Pick a topic, choose a side, and write your case."
            action={{ label: 'Browse Active Debates', href: '/' }}
          />
        )}

        {/* ── CTA: browse full arguments page ─────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/arguments"
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-mono font-medium',
                'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white border border-surface-300 transition-all',
              )}
            >
              <BarChart2 className="h-4 w-4" aria-hidden />
              Top Arguments on Platform
            </Link>
            <Link
              href="/"
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-mono font-medium',
                'bg-for-500/15 text-for-400 hover:bg-for-500/25 border border-for-500/30 transition-all',
              )}
            >
              <Zap className="h-4 w-4" aria-hidden />
              Argue on Active Topics
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
