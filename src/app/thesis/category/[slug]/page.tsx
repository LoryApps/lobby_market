'use client'

/**
 * /thesis/category/[slug] — Thesis Category Browse
 *
 * Dedicated page for each of the 10 civic thesis categories:
 *   economics, politics, technology, science, ethics,
 *   philosophy, culture, health, environment, education
 *
 * Distinct from:
 *   /thesis              — global board (all categories)
 *   /thesis/hot          — trending across all categories
 *   /thesis/following    — following-only feed
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleDot,
  Clock,
  Cpu,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Scale,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { Thesis, ThesisListResponse, ThesisCategory } from '@/lib/types/thesis'

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  ThesisCategory,
  {
    label: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
    gradient: string
  }
> = {
  economics: {
    label: 'Economics',
    description: 'Predictions about markets, inequality, trade, growth, and the future of money.',
    icon: TrendingUp,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    gradient: 'from-gold/20 via-gold/5 to-transparent',
  },
  politics: {
    label: 'Politics',
    description: 'Forecasts on elections, policy, governance, parties, and the exercise of power.',
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    gradient: 'from-for-600/20 via-for-600/5 to-transparent',
  },
  technology: {
    label: 'Technology',
    description: 'Theses on AI, software, platforms, automation, and digital transformation.',
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    gradient: 'from-purple/20 via-purple/5 to-transparent',
  },
  science: {
    label: 'Science',
    description: 'Predictions about research breakthroughs, medicine, physics, and discovery.',
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    gradient: 'from-emerald/20 via-emerald/5 to-transparent',
  },
  ethics: {
    label: 'Ethics',
    description: 'Long-form bets on moral progress, social norms, rights, and human values.',
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    gradient: 'from-against-600/20 via-against-600/5 to-transparent',
  },
  philosophy: {
    label: 'Philosophy',
    description: 'Theses on consciousness, meaning, epistemology, and the nature of existence.',
    icon: BookOpen,
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    gradient: 'from-surface-400/20 via-surface-400/5 to-transparent',
  },
  culture: {
    label: 'Culture',
    description: 'Forecasts about art, media, identity, society, and the evolution of culture.',
    icon: Music2,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    gradient: 'from-pink-500/20 via-pink-500/5 to-transparent',
  },
  health: {
    label: 'Health',
    description: 'Predictions on healthcare systems, longevity, pandemics, and wellbeing.',
    icon: Heart,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    gradient: 'from-green-500/20 via-green-500/5 to-transparent',
  },
  environment: {
    label: 'Environment',
    description: 'Theses on climate, energy transition, biodiversity, and planetary boundaries.',
    icon: Leaf,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    gradient: 'from-teal-500/20 via-teal-500/5 to-transparent',
  },
  education: {
    label: 'Education',
    description: 'Predictions on learning, universities, skills, credentials, and knowledge access.',
    icon: GraduationCap,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
  },
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    icon: CircleDot,
    color: 'text-for-400',
    bg: 'bg-for-500/10 border-for-500/30',
  },
  vindicated: {
    label: 'Vindicated',
    icon: Trophy,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/30',
  },
  refuted: {
    label: 'Refuted',
    icon: X,
    color: 'text-against-400',
    bg: 'bg-against-500/10 border-against-500/30',
  },
  expired: {
    label: 'Expired',
    icon: Clock,
    color: 'text-surface-500',
    bg: 'bg-surface-200 border-surface-300',
  },
}

type SortMode = 'newest' | 'popular' | 'expiring' | 'contested'
type StatusFilter = 'active' | 'vindicated' | 'refuted'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  const h = Math.floor(m / 60)
  const days = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Thesis card ──────────────────────────────────────────────────────────────

function ThesisCard({ thesis }: { thesis: Thesis }) {
  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50
  const sc = STATUS_CONFIG[thesis.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active
  const StatusIcon = sc.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        {thesis.author && (
          <Link href={`/profile/${thesis.author.username}`} className="flex-shrink-0 mt-0.5">
            <Avatar
              src={thesis.author.avatar_url}
              fallback={thesis.author.display_name ?? thesis.author.username}
              size="sm"
            />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {thesis.author && (
              <Link href={`/profile/${thesis.author.username}`} className="text-xs font-semibold text-white hover:text-for-400 transition-colors">
                {thesis.author.display_name ?? thesis.author.username}
              </Link>
            )}
            <span className="text-[11px] text-surface-500">{relTime(thesis.created_at)}</span>

            {/* Status badge */}
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', sc.bg, sc.color)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {sc.label}
            </span>
          </div>

          {/* Statement */}
          <Link href={`/thesis/${thesis.id}`} className="block group">
            <p className="text-sm font-medium text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-3 mb-2">
              {thesis.statement}
            </p>
          </Link>

          {/* Resolution date */}
          {thesis.resolution_date && thesis.status === 'active' && (
            <div className="flex items-center gap-1 text-[11px] text-surface-500 mb-2">
              <Clock className="h-3 w-3" />
              {daysLeft(thesis.resolution_date) > 0
                ? `${daysLeft(thesis.resolution_date)}d until resolution`
                : 'Resolution past due'}
            </div>
          )}

          {/* Related topic */}
          {thesis.related_topic_statement && thesis.related_topic_id && (
            <Link
              href={`/topic/${thesis.related_topic_id}`}
              className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-for-400 transition-colors mb-2"
            >
              <Gavel className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{thesis.related_topic_statement}</span>
            </Link>
          )}

          {/* Agree/disagree bar */}
          {total > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-surface-500 mb-0.5">
                <span className="flex items-center gap-0.5 text-for-400">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {agreePct}% agree
                </span>
                <span className="flex items-center gap-0.5 text-against-400">
                  <ThumbsDown className="h-2.5 w-2.5" />
                  {100 - agreePct}% disagree
                </span>
              </div>
              <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-500"
                  style={{ width: `${agreePct}%` }}
                />
              </div>
              <p className="text-[10px] text-surface-500 mt-0.5">{total.toLocaleString()} responses</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <Link
              href={`/thesis/${thesis.id}`}
              className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-for-400 transition-colors"
            >
              <span>View thesis</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
            {thesis.resolved_at && (
              <span className="text-[11px] text-surface-500">
                Resolved {relTime(thesis.resolved_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThesisSkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({
  stats,
}: {
  stats: { total_active: number; total_vindicated: number; total_refuted: number }
}) {
  const total = stats.total_active + stats.total_vindicated + stats.total_refuted
  const vinRate = total > 0 ? Math.round((stats.total_vindicated / total) * 100) : 0

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: 'Total', value: total, color: 'text-white' },
        { label: 'Active', value: stats.total_active, color: 'text-for-400' },
        { label: 'Vindicated', value: stats.total_vindicated, color: 'text-gold' },
        { label: 'Accuracy', value: `${vinRate}%`, color: 'text-emerald' },
      ].map((s) => (
        <div
          key={s.label}
          className="bg-surface-100 border border-surface-300 rounded-xl p-2.5 text-center"
        >
          <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Other categories strip ───────────────────────────────────────────────────

function OtherCategoriesStrip({ current }: { current: ThesisCategory }) {
  const others = THESIS_CATEGORIES.filter((c) => c !== current)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {others.map((cat) => {
        const m = CATEGORY_META[cat]
        const Icon = m.icon
        return (
          <Link
            key={cat}
            href={`/thesis/category/${cat}`}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
              m.bg, m.border, m.color,
              'hover:brightness-125'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThesisCategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const isValid = THESIS_CATEGORIES.includes(slug as ThesisCategory)
  const category = (isValid ? slug : 'politics') as ThesisCategory
  const meta = CATEGORY_META[category]
  const CategoryIcon = meta.icon

  const [theses, setTheses] = useState<Thesis[]>([])
  const [stats, setStats] = useState({ total_active: 0, total_vindicated: 0, total_refuted: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState<SortMode>('popular')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const LIMIT = 20

  const fetchTheses = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        category,
        sort,
        status: statusFilter,
        limit: String(LIMIT),
        offset: String(currentOffset),
      })
      const res = await fetch(`/api/thesis?${params}`)
      if (!res.ok) return
      const data: ThesisListResponse = await res.json()

      setTheses((prev) => (reset ? data.theses : [...prev, ...data.theses]))
      setStats(data.stats)
      setHasMore(data.theses.length === LIMIT)
      setOffset(currentOffset + data.theses.length)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [category, sort, statusFilter, offset])

  const fetchFresh = useCallback(() => {
    setOffset(0)
    fetchTheses(true)
  }, [fetchTheses])

  useEffect(() => {
    setOffset(0)
    fetchTheses(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort, statusFilter])

  if (!isValid) {
    notFound()
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 space-y-4">
        {/* Back + breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <Link href="/thesis" className="hover:text-for-400 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Theses
          </Link>
          <span>/</span>
          <span className={cn('font-medium', meta.color)}>{meta.label}</span>
        </div>

        {/* Category header */}
        <div className={cn('relative overflow-hidden rounded-2xl border p-5', meta.bg, meta.border)}>
          <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', meta.gradient)} />
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl border', meta.bg, meta.border)}>
                  <CategoryIcon className={cn('h-6 w-6', meta.color)} />
                </div>
                <div>
                  <h1 className={cn('text-xl font-bold', meta.color)}>{meta.label} Theses</h1>
                  <p className="text-xs text-surface-400 mt-0.5">Civic predictions & long-term bets</p>
                </div>
              </div>
              <button
                onClick={fetchFresh}
                className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-white"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-surface-300 leading-relaxed">{meta.description}</p>
          </div>
        </div>

        {/* Stats */}
        {!loading && <StatsBar stats={stats} />}

        {/* Browse other categories */}
        <div>
          <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2">Browse categories</p>
          <OtherCategoriesStrip current={category} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort */}
          <div className="flex items-center bg-surface-200 rounded-xl border border-surface-300 p-0.5 gap-0.5">
            {(
              [
                { value: 'popular', label: 'Popular' },
                { value: 'newest', label: 'Newest' },
                { value: 'expiring', label: 'Expiring' },
                { value: 'contested', label: 'Contested' },
              ] as { value: SortMode; label: string }[]
            ).map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  sort === s.value
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center bg-surface-200 rounded-xl border border-surface-300 p-0.5 gap-0.5">
            {(
              [
                { value: 'active', label: 'Active' },
                { value: 'vindicated', label: 'Won' },
                { value: 'refuted', label: 'Lost' },
              ] as { value: StatusFilter; label: string }[]
            ).map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === s.value
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Write CTA */}
        <Link
          href={`/thesis?category=${category}`}
          className={cn(
            'flex items-center justify-between p-3.5 rounded-xl border transition-colors',
            meta.bg, meta.border,
            'hover:brightness-125'
          )}
        >
          <div className="flex items-center gap-2">
            <Plus className={cn('h-4 w-4', meta.color)} />
            <span className="text-sm font-medium text-white">Stake a {meta.label} Thesis</span>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-500" />
        </Link>

        {/* Thesis list */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <ThesisSkeleton key={i} />)
          ) : theses.length === 0 ? (
            <EmptyState
              icon={Scroll}
              title={`No ${meta.label} theses yet`}
              description={`Be the first to stake a civic prediction about ${meta.label.toLowerCase()}.`}
              action={{
                label: `Write a ${meta.label} Thesis`,
                href: `/thesis?category=${category}`,
              }}
            />
          ) : (
            <>
              {theses.map((thesis) => (
                <ThesisCard key={thesis.id} thesis={thesis} />
              ))}

              {hasMore && (
                <button
                  onClick={() => fetchTheses(false)}
                  disabled={loadingMore}
                  className="w-full py-3 text-sm text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Load more
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}

              {!hasMore && theses.length > 0 && (
                <p className="text-center text-xs text-surface-500 py-4">
                  All {meta.label.toLowerCase()} theses loaded &middot;{' '}
                  <Link href="/thesis" className="hover:text-for-400 transition-colors">
                    Browse all categories
                  </Link>
                </p>
              )}
            </>
          )}
        </div>

        {/* Explore more */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">More in Theses</p>
          {[
            { href: '/thesis', label: 'All Theses', icon: Scroll, desc: 'Global thesis board' },
            { href: '/thesis/hot', label: 'Hot Theses', icon: Zap, desc: 'Trending predictions' },
            { href: '/thesis/following', label: 'Following', icon: BookOpen, desc: 'From people you follow' },
            { href: '/leaderboard/theses', label: 'Oracle Board', icon: Trophy, desc: 'Top predictors by accuracy' },
            { href: '/analytics/thesis', label: 'My Accuracy', icon: TrendingUp, desc: 'Your thesis track record' },
          ].map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-200 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-white">{link.label}</p>
                    <p className="text-[11px] text-surface-500">{link.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
