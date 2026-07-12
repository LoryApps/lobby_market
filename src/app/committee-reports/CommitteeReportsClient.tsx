'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  Filter,
  Minus,
  RefreshCw,
  Tag,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CommitteeReport } from '@/app/api/committee-reports/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Economy',
  'Technology',
  'Environment',
  'Healthcare',
  'Education',
  'Civil Rights',
  'Defense',
  'Foreign Policy',
  'Justice',
  'Infrastructure',
  'Housing',
]

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'top', label: 'Most Endorsed' },
]

const RECOMMENDATION_META: Record<
  CommitteeReport['recommendation'],
  { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  for: {
    label: 'Recommend For',
    color: 'text-for-500',
    bg: 'bg-for-500/10 border-for-500/20',
    Icon: ThumbsUp,
  },
  against: {
    label: 'Recommend Against',
    color: 'text-against-500',
    bg: 'bg-against-500/10 border-against-500/20',
    Icon: ThumbsDown,
  },
  neutral: {
    label: 'Neutral',
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    Icon: Minus,
  },
  hold: {
    label: 'Hold / More Study',
    color: 'text-gold',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    Icon: CheckCircle2,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-3 pt-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Report card ──────────────────────────────────────────────────────────────

interface ReportCardProps {
  report: CommitteeReport
  onEndorse: (id: string) => void
  endorsing: string | null
}

function ReportCard({ report, onEndorse, endorsing }: ReportCardProps) {
  const rec = RECOMMENDATION_META[report.recommendation]
  const RecIcon = rec.Icon
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200/60 transition-colors overflow-hidden"
    >
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {report.author ? (
            <Link href={`/profile/${report.author.username}`} className="shrink-0">
              <Avatar
                src={report.author.avatar_url}
                username={report.author.username}
                size={32}
              />
            </Link>
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-300 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {report.author ? (
                <Link
                  href={`/profile/${report.author.username}`}
                  className="text-xs font-medium text-white hover:text-for-400 transition-colors"
                >
                  {report.author.display_name ?? report.author.username}
                </Link>
              ) : (
                <span className="text-xs font-medium text-zinc-500">Anonymous</span>
              )}
              <span className="text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-500">
                {relativeTime(report.published_at ?? report.created_at)}
              </span>
              {report.category && (
                <>
                  <span className="text-zinc-600 text-xs">·</span>
                  <span className="text-xs text-purple font-medium">{report.category}</span>
                </>
              )}
            </div>
          </div>

          {/* Recommendation badge */}
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
              rec.bg,
              rec.color
            )}
          >
            <RecIcon className="w-3 h-3" />
            {rec.label}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold text-white leading-snug">{report.title}</h2>

        {/* Summary */}
        <p className="text-xs text-zinc-400 leading-relaxed">{report.summary}</p>

        {/* Linked topic */}
        {report.topic_statement && (
          <Link
            href={`/topic/${report.topic_id}`}
            className="inline-flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
          >
            <BookOpen className="w-3 h-3" />
            <span className="truncate max-w-[240px]">{report.topic_statement}</span>
          </Link>
        )}

        {/* Tags */}
        {report.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {report.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 bg-surface-200 border border-surface-300 rounded px-1.5 py-0.5"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Expanded full content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-1 pb-2 border-t border-surface-300">
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                  {report.content}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            {/* Endorse button */}
            <button
              onClick={() => onEndorse(report.id)}
              disabled={endorsing === report.id}
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium transition-colors',
                report.user_endorsed
                  ? 'text-gold hover:text-yellow-300'
                  : 'text-zinc-500 hover:text-gold'
              )}
            >
              <ArrowUp
                className={cn(
                  'w-3.5 h-3.5 transition-transform',
                  endorsing === report.id && 'animate-pulse',
                  report.user_endorsed && 'fill-current'
                )}
              />
              <span>{report.endorsement_count}</span>
            </button>

            {/* View count */}
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
              <Eye className="w-3 h-3" />
              {report.view_count.toLocaleString()}
            </span>
          </div>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <FileText className="w-3 h-3" />
            {expanded ? 'Collapse' : 'Read Full Report'}
            <ChevronDown
              className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CommitteeReportsClient() {
  const [reports, setReports] = useState<CommitteeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<'recent' | 'top'>('recent')
  const [endorsing, setEndorsing] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const PAGE = 15

  const fetchReports = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true)
        setError(null)
        offsetRef.current = 0
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams({
        sort,
        limit: String(PAGE),
        offset: String(offsetRef.current),
      })
      if (category !== 'All') params.set('category', category)

      try {
        const res = await fetch(`/api/committee-reports?${params}`)
        if (!res.ok) throw new Error('Failed to load reports')
        const json = await res.json()
        const incoming: CommitteeReport[] = json.reports ?? []

        setReports((prev) => (reset ? incoming : [...prev, ...incoming]))
        setHasMore(incoming.length === PAGE)
        offsetRef.current += incoming.length
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [category, sort]
  )

  useEffect(() => {
    fetchReports(true)
  }, [fetchReports])

  const handleEndorse = useCallback(async (id: string) => {
    setEndorsing(id)
    try {
      const res = await fetch(`/api/committee-reports/${id}/endorse`, { method: 'POST' })
      if (!res.ok) return
      const { endorsed } = await res.json()
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                user_endorsed: endorsed,
                endorsement_count: r.endorsement_count + (endorsed ? 1 : -1),
              }
            : r
        )
      )
    } finally {
      setEndorsing(null)
    }
  }, [])

  return (
    <div className="min-h-screen bg-surface-50 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-purple" />
            <h1 className="text-xl font-bold text-white">Committee Reports</h1>
          </div>
          <p className="text-xs text-zinc-500">
            Formal findings and policy recommendations from civic committee chairs.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-5 space-y-3">
          {/* Sort */}
          <div className="flex gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value as 'recent' | 'top')}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                  sort === opt.value
                    ? 'bg-purple/20 border-purple/40 text-purple'
                    : 'bg-surface-100 border-surface-300 text-zinc-400 hover:text-white hover:border-surface-200'
                )}
              >
                {opt.label}
              </button>
            ))}

            <button
              onClick={() => fetchReports(true)}
              className="ml-auto p-1.5 rounded-lg bg-surface-100 border border-surface-300 text-zinc-500 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-1" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap',
                  category === cat
                    ? 'bg-for-500/20 border-for-500/30 text-for-400'
                    : 'bg-surface-100 border-surface-300 text-zinc-400 hover:text-white'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ReportCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <XCircle className="w-8 h-8 text-against-500" />
            <p className="text-sm text-zinc-400">{error}</p>
            <button
              onClick={() => fetchReports(true)}
              className="text-xs text-for-400 hover:text-for-300 underline"
            >
              Try again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description={
              category !== 'All'
                ? `No committee reports in ${category} yet.`
                : 'No committee reports have been published yet.'
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onEndorse={handleEndorse}
                  endorsing={endorsing}
                />
              ))}
            </AnimatePresence>

            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={() => fetchReports(false)}
                  disabled={loadingMore}
                  className="w-full py-2.5 rounded-xl bg-surface-100 border border-surface-300 text-xs text-zinc-400 hover:text-white hover:border-surface-200 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more reports'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
