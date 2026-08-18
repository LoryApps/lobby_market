'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  Medal,
  RefreshCw,
  Scale,
  Target,
  Trophy,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { ResolvedThesisEntry, AccuracyEntry, ResolvedThesesResponse } from '@/app/api/thesis/resolved/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

type TabKey = 'all' | 'vindicated' | 'refuted' | 'expired'

const TABS: { key: TabKey; label: string; icon: typeof Trophy }[] = [
  { key: 'all', label: 'All Resolved', icon: Scale },
  { key: 'vindicated', label: 'Vindicated', icon: CheckCircle2 },
  { key: 'refuted', label: 'Refuted', icon: XCircle },
  { key: 'expired', label: 'Expired', icon: Clock },
]

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Resolved' },
  { value: 'engagement', label: 'Most Engaged' },
  { value: 'oldest', label: 'Oldest First' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mo = Math.floor(d / 30)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  if (mo < 12) return `${mo}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusConfig(status: string) {
  switch (status) {
    case 'vindicated':
      return {
        label: 'Vindicated',
        icon: CheckCircle2,
        color: 'text-emerald',
        bg: 'bg-emerald/10 border-emerald/30',
        bar: 'bg-emerald',
      }
    case 'refuted':
      return {
        label: 'Refuted',
        icon: XCircle,
        color: 'text-against-400',
        bg: 'bg-against-500/10 border-against-500/30',
        bar: 'bg-against-500',
      }
    case 'expired':
    default:
      return {
        label: 'Expired',
        icon: Clock,
        color: 'text-surface-400',
        bg: 'bg-surface-200/50 border-surface-400/20',
        bar: 'bg-surface-400',
      }
  }
}

// ─── Resolved Thesis Card ────────────────────────────────────────────────────

function ResolvedCard({
  entry,
  index,
}: {
  entry: ResolvedThesisEntry
  index: number
}) {
  const cfg = statusConfig(entry.status)
  const StatusIcon = cfg.icon
  const catColor = CAT_COLORS[entry.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const total = entry.agree_count + entry.disagree_count

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        href={`/thesis/${entry.id}`}
        className={cn(
          'block rounded-2xl border bg-surface-100 p-4 transition-colors hover:bg-surface-200/60',
          'border-surface-300',
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border capitalize', catColor)}>
              {entry.category}
            </span>
          </div>
          {entry.resolved_at && (
            <span className="text-xs text-surface-500 shrink-0 mt-0.5">
              {relTime(entry.resolved_at)}
            </span>
          )}
        </div>

        {/* Statement */}
        <p className="text-sm text-surface-100 dark:text-surface-50 font-medium leading-snug mb-3 line-clamp-3">
          {entry.statement}
        </p>

        {/* Rationale excerpt */}
        {entry.rationale && (
          <p className="text-xs text-surface-500 leading-relaxed mb-3 line-clamp-2 italic">
            "{entry.rationale}"
          </p>
        )}

        {/* Agreement bar */}
        {total > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-surface-500 mb-1">
              <span className="text-emerald">{entry.agree_pct}% agreed</span>
              <span className="text-surface-500">{total} votes</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', cfg.bar)}
                style={{ width: `${entry.agree_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          {entry.author ? (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={entry.author.avatar_url}
                username={entry.author.username}
                size={20}
              />
              <span className="text-xs text-surface-400">@{entry.author.username}</span>
            </div>
          ) : (
            <div />
          )}
          {entry.related_topic_statement && (
            <span className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 truncate max-w-[140px]">
              <BookOpen className="h-3 w-3 shrink-0" />
              <span className="truncate">{entry.related_topic_statement}</span>
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Accuracy Leaderboard ─────────────────────────────────────────────────────

function AccuracyLeaderboard({ predictors }: { predictors: AccuracyEntry[] }) {
  if (predictors.length === 0) return null

  const rankIcons = ['🥇', '🥈', '🥉']

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
          <Trophy className="h-4 w-4 text-gold" />
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-50">Top Predictors</p>
          <p className="text-xs text-surface-500">By resolution accuracy</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {predictors.map((p, i) => (
          <Link
            key={p.user_id}
            href={`/profile/${p.username}`}
            className="flex items-center gap-2.5 group"
          >
            <span className="text-base w-5 shrink-0">{rankIcons[i] ?? `${i + 1}`}</span>
            <Avatar src={p.avatar_url} username={p.username} size={28} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-surface-100 group-hover:text-surface-50 truncate">
                {p.display_name ?? `@${p.username}`}
              </p>
              <p className="text-xs text-surface-500">{p.total_resolved} resolved</p>
            </div>
            <div className="text-right shrink-0">
              <p className={cn(
                'text-sm font-bold tabular-nums',
                p.accuracy_pct >= 70 ? 'text-emerald' : p.accuracy_pct >= 50 ? 'text-gold' : 'text-against-400',
              )}>
                {p.accuracy_pct}%
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ResolvedThesesClient() {
  const [data, setData] = useState<ResolvedThesesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [category, setCategory] = useState<string>('')
  const [sort, setSort] = useState<string>('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ sort, limit: '40' })
      if (category) params.set('category', category)
      const statusParam = tab !== 'all' ? tab : ''
      if (statusParam) params.set('status', statusParam)

      const res = await fetch(`/api/thesis/resolved?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const json: ResolvedThesesResponse = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tab, category, sort])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived display list ────────────────────────────────────────────────────

  const displayEntries: ResolvedThesisEntry[] = (() => {
    if (!data) return []
    switch (tab) {
      case 'vindicated': return data.vindicated
      case 'refuted': return data.refuted
      case 'expired': return data.expired
      default: {
        const all = [...data.vindicated, ...data.refuted, ...data.expired]
        if (sort === 'engagement') {
          return all.sort((a, b) => b.total_engagement - a.total_engagement)
        }
        if (sort === 'oldest') {
          return all.sort((a, b) =>
            new Date(a.resolved_at ?? a.created_at).getTime() - new Date(b.resolved_at ?? b.created_at).getTime()
          )
        }
        return all.sort((a, b) =>
          new Date(b.resolved_at ?? b.created_at).getTime() - new Date(a.resolved_at ?? a.created_at).getTime()
        )
      }
    }
  })()

  const totalConcluded = data ? data.total_vindicated + data.total_refuted : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-6">
          <Link
            href="/thesis"
            className="mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 text-surface-400 hover:text-surface-100 hover:border-surface-200 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Hall of Record</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Every resolved civic prediction — vindicated, refuted, or expired.
            </p>
          </div>
        </div>

        {/* ── Platform stats bar ──────────────────────────────────────────── */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
              <p className="text-xs text-surface-500 mb-0.5">Total Resolved</p>
              <p className="text-xl font-bold text-surface-50 tabular-nums">
                {(data.total_vindicated + data.total_refuted + data.total_expired).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-3">
              <p className="text-xs text-surface-500 mb-0.5">Vindicated</p>
              <p className="text-xl font-bold text-emerald tabular-nums">
                {data.total_vindicated.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-against-500/30 bg-against-500/5 px-4 py-3">
              <p className="text-xs text-surface-500 mb-0.5">Refuted</p>
              <p className="text-xl font-bold text-against-400 tabular-nums">
                {data.total_refuted.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
              <p className="text-xs text-surface-500 mb-0.5">Platform Accuracy</p>
              <p className={cn(
                'text-xl font-bold tabular-nums',
                data.platform_accuracy_pct >= 60 ? 'text-emerald' : 'text-gold',
              )}>
                {totalConcluded > 0 ? `${data.platform_accuracy_pct}%` : '—'}
              </p>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: thesis list ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Tab bar */}
            <div className="flex gap-1 mb-4 bg-surface-100 border border-surface-300 rounded-xl p-1 overflow-x-auto">
              {TABS.map((t) => {
                const Icon = t.icon
                const count = data
                  ? t.key === 'all'
                    ? data.total_vindicated + data.total_refuted + data.total_expired
                    : t.key === 'vindicated'
                    ? data.total_vindicated
                    : t.key === 'refuted'
                    ? data.total_refuted
                    : data.total_expired
                  : null
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-1 justify-center',
                      tab === t.key
                        ? 'bg-surface-200 text-surface-50'
                        : 'text-surface-400 hover:text-surface-200',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                    {count !== null && (
                      <span className={cn(
                        'text-xs tabular-nums',
                        tab === t.key ? 'text-surface-300' : 'text-surface-500',
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {/* Category filter */}
              <div className="flex gap-1.5 overflow-x-auto flex-1 pb-0.5">
                <button
                  onClick={() => setCategory('')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
                    !category
                      ? 'bg-for-500/20 text-for-300 border-for-500/40'
                      : 'text-surface-400 border-surface-300 hover:border-surface-200',
                  )}
                >
                  All
                </button>
                {THESIS_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat === category ? '' : cat)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border capitalize transition-colors',
                      cat === category
                        ? cn(CAT_COLORS[cat], 'border-current')
                        : 'text-surface-400 border-surface-300 hover:border-surface-200',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowSortMenu((p) => !p)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-300 bg-surface-100 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => { setSort(o.value); setShowSortMenu(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-xs transition-colors',
                            sort === o.value
                              ? 'text-surface-50 bg-surface-200'
                              : 'text-surface-400 hover:bg-surface-200/60',
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Refresh */}
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center justify-center h-7 w-7 rounded-lg border border-surface-300 text-surface-500 hover:text-surface-200 transition-colors shrink-0"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </button>
            </div>

            {/* List */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : displayEntries.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="No resolved theses yet"
                description={
                  tab === 'vindicated'
                    ? 'No theses have been marked vindicated yet.'
                    : tab === 'refuted'
                    ? 'No theses have been marked refuted yet.'
                    : tab === 'expired'
                    ? 'No theses have expired yet.'
                    : 'No theses have been resolved yet. Check back as authors settle their predictions.'
                }
                action={{ label: 'Browse Active Theses', href: '/thesis' }}
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="wait">
                  {displayEntries.map((entry, i) => (
                    <ResolvedCard key={entry.id} entry={entry} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Right: leaderboard sidebar ───────────────────────────────── */}
          <div className="lg:w-64 xl:w-72 space-y-4 shrink-0">
            {loading ? (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
                <Skeleton className="h-8 w-40" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              data && <AccuracyLeaderboard predictors={data.top_predictors} />
            )}

            {/* CTA to write a thesis */}
            <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-for-400" />
                <p className="text-sm font-semibold text-surface-50">Make a Prediction</p>
              </div>
              <p className="text-xs text-surface-500 mb-3 leading-relaxed">
                Stake your reputation on a civic outcome. Write a thesis and let history be the judge.
              </p>
              <Link
                href="/thesis"
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-semibold transition-colors"
              >
                Write a Thesis
              </Link>
            </div>

            {/* Quick nav */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">More Thesis Views</p>
              <div className="space-y-1">
                {[
                  { href: '/thesis', label: 'Thesis Board' },
                  { href: '/thesis/rising', label: 'Rising Theses' },
                  { href: '/thesis/hot', label: 'Hot Takes' },
                  { href: '/thesis/expiring', label: 'Expiring Soon' },
                  { href: '/thesis/map', label: 'Thesis Map' },
                  { href: '/leaderboard/theses', label: 'Oracle Leaderboard' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-surface-400 hover:bg-surface-200/60 hover:text-surface-200 transition-colors"
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
