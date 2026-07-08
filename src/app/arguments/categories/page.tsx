'use client'

/**
 * /arguments/categories — Arguments by Category
 *
 * Shows the best FOR and AGAINST arguments organised by civic category.
 * Each category card surfaces the top-voted argument on each side with
 * author info, upvote count, and a link to the parent topic.
 *
 * Distinct from:
 *   /arguments        — ranked list across all categories
 *   /arguments/trending — velocity-ranked recent arguments
 *   /categories       — topics browser (not arguments)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ByCategoryResponse, CategoryData, CategoryArgument } from '@/app/api/arguments/by-category/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string; ring: string }> = {
  Economics:   { color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30',          ring: 'ring-gold/20' },
  Politics:    { color: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30',       ring: 'ring-for-500/20' },
  Technology:  { color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30',        ring: 'ring-purple/20' },
  Science:     { color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30',       ring: 'ring-emerald/20' },
  Ethics:      { color: 'text-against-400',  bg: 'bg-against-500/10',   border: 'border-against-500/30',   ring: 'ring-against-500/20' },
  Philosophy:  { color: 'text-for-300',      bg: 'bg-for-300/10',       border: 'border-for-300/20',       ring: 'ring-for-300/20' },
  Culture:     { color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/20',          ring: 'ring-gold/20' },
  Health:      { color: 'text-against-300',  bg: 'bg-against-400/10',   border: 'border-against-400/30',   ring: 'ring-against-400/20' },
  Environment: { color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30',       ring: 'ring-emerald/20' },
  Education:   { color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30',        ring: 'ring-purple/20' },
}

// ─── Period options ───────────────────────────────────────────────────────────

const PERIODS = [
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all',   label: 'All Time' },
] as const
type PeriodId = typeof PERIODS[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max = 160): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Argument snippet ─────────────────────────────────────────────────────────

function ArgumentSnippet({
  arg,
  side,
}: {
  arg: CategoryArgument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'

  return (
    <Link
      href={`/topic/${arg.topic_id}#arg-${arg.id}`}
      className={cn(
        'block rounded-lg border p-3 transition-colors group',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40 bg-for-500/5'
          : 'border-against-500/20 hover:border-against-500/40 bg-against-500/5',
      )}
    >
      {/* Side label + upvotes */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
          )}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          {arg.upvotes.toLocaleString()}
        </span>
      </div>

      {/* Content */}
      <p className="text-xs text-surface-700 leading-relaxed line-clamp-3 group-hover:text-surface-800 transition-colors">
        {truncate(arg.content)}
      </p>

      {/* Author + topic */}
      <div className="mt-2 flex items-center gap-2">
        <Avatar
          src={arg.author?.avatar_url ?? null}
          fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
          size="xs"
        />
        <span className="text-[10px] font-mono text-surface-500 truncate">
          @{arg.author?.username ?? 'unknown'}
        </span>
        <span className="text-[10px] text-surface-600 truncate ml-auto max-w-[120px]">
          {truncate(arg.topic?.statement ?? '', 60)}
        </span>
      </div>
    </Link>
  )
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({
  data,
  index,
}: {
  data: CategoryData
  index: number
}) {
  const style = CATEGORY_STYLE[data.name] ?? CATEGORY_STYLE['Economics']
  const Icon = CATEGORY_ICON[data.name] ?? TrendingUp
  const hasAny = data.top_for || data.top_against

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-4',
        'bg-surface-100/80 backdrop-blur',
        style.border,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl', style.bg)}>
            <Icon className={cn('h-4.5 w-4.5', style.color)} aria-hidden="true" />
          </div>
          <div>
            <h2 className={cn('text-sm font-mono font-bold', style.color)}>{data.name}</h2>
            <p className="text-[11px] font-mono text-surface-500">
              {data.total_arguments.toLocaleString()} arguments
              {data.law_count > 0 && (
                <> · <span className="text-gold">{data.law_count} laws</span></>
              )}
            </p>
          </div>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            {data.for_count}
          </span>
          <span className="flex items-center gap-1 text-against-400">
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
            {data.against_count}
          </span>
        </div>
      </div>

      {/* Arguments */}
      {hasAny ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.top_for ? (
            <ArgumentSnippet arg={data.top_for} side="for" />
          ) : (
            <div className="rounded-lg border border-for-500/10 p-3 text-center text-[11px] text-surface-600 font-mono">
              No FOR arguments yet
            </div>
          )}
          {data.top_against ? (
            <ArgumentSnippet arg={data.top_against} side="against" />
          ) : (
            <div className="rounded-lg border border-against-500/10 p-3 text-center text-[11px] text-surface-600 font-mono">
              No AGAINST arguments yet
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-[11px] text-surface-600 font-mono">
          No arguments in this period
        </div>
      )}

      {/* Browse link */}
      <Link
        href={`/arguments?category=${encodeURIComponent(data.name)}`}
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-lg py-2 px-3',
          'text-[11px] font-mono font-semibold transition-colors',
          style.bg,
          style.color,
          'hover:opacity-80',
          'border',
          style.border,
        )}
      >
        <MessageSquare className="h-3 w-3" aria-hidden="true" />
        Browse all {data.name} arguments
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function CategorySkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 p-5 space-y-4 bg-surface-100/80">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-2.5 w-36 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-for-500/10 p-3 space-y-2">
          <Skeleton className="h-2.5 w-12 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
        <div className="rounded-lg border border-against-500/10 p-3 space-y-2">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArgumentsByCategoryPage() {
  const [period, setPeriod] = useState<PeriodId>('all')
  const [data, setData] = useState<ByCategoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (p: PeriodId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/arguments/by-category?period=${p}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: ByCategoryResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load arguments. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [fetchData, period])

  const categories = data?.categories ?? []
  const hasData = categories.some((c) => c.total_arguments > 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">
              Arguments by Category
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              Top FOR & AGAINST arguments across every civic category
            </p>
          </div>
          <button
            onClick={() => fetchData(period)}
            disabled={loading}
            aria-label="Refresh"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-colors border',
                period === p.id
                  ? 'bg-for-500 text-white border-for-500 shadow-sm shadow-for-500/20'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700',
              )}
            >
              {p.label}
            </button>
          ))}

          {/* Divider + all-arguments link */}
          <Link
            href="/arguments"
            className="ml-auto flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            All arguments
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {/* Content */}
        {error ? (
          <div className="text-center py-16">
            <p className="text-surface-500 text-sm font-mono mb-3">{error}</p>
            <button
              onClick={() => fetchData(period)}
              className="px-4 py-2 rounded-lg bg-surface-200 text-sm text-white font-mono hover:bg-surface-300 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <CategorySkeleton key={i} />
            ))}
          </div>
        ) : !hasData ? (
          <EmptyState
            icon={MessageSquare}
            title="No arguments yet"
            description="Be the first to argue on a topic and your argument will appear here."
            action={{ label: 'Browse topics', href: '/' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={period}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {categories.map((cat, i) => (
                <CategoryCard key={cat.name} data={cat} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
