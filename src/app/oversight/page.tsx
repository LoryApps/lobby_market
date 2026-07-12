'use client'

/**
 * /oversight — The Civic Oversight Committee
 *
 * A real-time health dashboard for all established laws — shows which laws
 * are under active scrutiny via pending amendments, reopen petitions, and
 * community reviews. Helps citizens monitor the quality of consensus decisions
 * and take action where laws need revisiting.
 *
 * Distinct from:
 *   /law          — simple law browser
 *   /amendments   — amendment proposals detail view
 *   /law/reviews  — reviews for a specific law
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Gavel,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Star,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { OversightLaw, OversightResponse, OversightStats } from '@/app/api/oversight/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
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

const SORT_OPTIONS = [
  { value: 'scrutiny', label: 'Under Scrutiny' },
  { value: 'newest', label: 'Newest Laws' },
  { value: 'oldest', label: 'Oldest Laws' },
  { value: 'rating', label: 'Lowest Rated' },
]

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  if (mo < 12) return `${mo}mo ago`
  return `${y}y ago`
}

function scrutinyLevel(law: OversightLaw): 'critical' | 'elevated' | 'stable' {
  if (law.reopen_count > 0 || (law.avg_stars !== null && law.avg_stars < 2.5 && law.review_count >= 5)) {
    return 'critical'
  }
  if (law.pending_amendment_count > 0 || (law.avg_stars !== null && law.avg_stars < 3.5 && law.review_count >= 3)) {
    return 'elevated'
  }
  return 'stable'
}

// ─── Scrutiny badge ───────────────────────────────────────────────────────────

function ScrutinyBadge({ level }: { level: 'critical' | 'elevated' | 'stable' }) {
  if (level === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-against-500/15 border border-against-500/40 text-against-300">
        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
        Critical
      </span>
    )
  }
  if (level === 'elevated') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/10 border border-gold/30 text-gold">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Elevated
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald/10 border border-emerald/30 text-emerald">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Stable
    </span>
  )
}

// ─── Law oversight card ───────────────────────────────────────────────────────

function OversightCard({ law }: { law: OversightLaw }) {
  const level = scrutinyLevel(law)
  const catColor = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-400'
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        level === 'critical'
          ? 'bg-against-500/5 border-against-500/30 hover:border-against-500/50'
          : level === 'elevated'
            ? 'bg-gold/5 border-gold/20 hover:border-gold/40'
            : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {law.category && (
              <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', catColor)}>
                {law.category}
              </span>
            )}
            <ScrutinyBadge level={level} />
          </div>
          <Link
            href={`/topic/${law.topic_id}`}
            className="group flex items-start gap-1"
          >
            <p className="text-sm font-mono font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
              {law.statement}
            </p>
          </Link>
        </div>
        <Link
          href={`/law/${law.id}`}
          aria-label="View law detail"
          className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] font-mono text-surface-500">
        {/* Vote split at establishment */}
        <span className="flex items-center gap-1">
          <span className="text-for-400 font-semibold">{forPct}% For</span>
          {law.total_votes !== null && (
            <span className="text-surface-600">· {law.total_votes.toLocaleString()} votes</span>
          )}
        </span>
        <span className="text-surface-600">
          Passed {relativeTime(law.established_at)}
        </span>
      </div>

      {/* Oversight indicators */}
      <div className="grid grid-cols-3 gap-2">
        {/* Pending amendments */}
        <Link
          href={`/amendments`}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-colors',
            law.pending_amendment_count > 0
              ? 'bg-gold/8 border-gold/25 hover:border-gold/45'
              : 'bg-surface-200/50 border-surface-300/50 hover:border-surface-400/50',
          )}
          aria-label={`${law.pending_amendment_count} pending amendments`}
        >
          <Edit3
            className={cn('h-4 w-4 mb-1', law.pending_amendment_count > 0 ? 'text-gold' : 'text-surface-600')}
            aria-hidden="true"
          />
          <span className={cn('text-lg font-mono font-bold leading-none', law.pending_amendment_count > 0 ? 'text-gold' : 'text-surface-500')}>
            {law.pending_amendment_count}
          </span>
          <span className="text-[9px] font-mono text-surface-600 mt-0.5">Amendments</span>
        </Link>

        {/* Reopen petitions */}
        <Link
          href={`/topic/${law.topic_id}`}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-colors',
            law.reopen_count > 0
              ? 'bg-against-500/8 border-against-500/25 hover:border-against-500/45'
              : 'bg-surface-200/50 border-surface-300/50 hover:border-surface-400/50',
          )}
          aria-label={`${law.reopen_count} reopen petitions`}
        >
          <Scale
            className={cn('h-4 w-4 mb-1', law.reopen_count > 0 ? 'text-against-400' : 'text-surface-600')}
            aria-hidden="true"
          />
          <span className={cn('text-lg font-mono font-bold leading-none', law.reopen_count > 0 ? 'text-against-300' : 'text-surface-500')}>
            {law.reopen_count}
          </span>
          <span className="text-[9px] font-mono text-surface-600 mt-0.5">Petitions</span>
        </Link>

        {/* Community rating */}
        <Link
          href={`/law/${law.id}`}
          className="flex flex-col items-center justify-center rounded-xl border bg-surface-200/50 border-surface-300/50 hover:border-surface-400/50 p-2.5 text-center transition-colors"
          aria-label={`Community rating: ${law.avg_stars?.toFixed(1) ?? 'none'}`}
        >
          <Star
            className={cn(
              'h-4 w-4 mb-1',
              law.avg_stars !== null
                ? law.avg_stars >= 4 ? 'text-gold fill-gold/40' : law.avg_stars >= 3 ? 'text-gold' : 'text-against-400'
                : 'text-surface-600',
            )}
            aria-hidden="true"
          />
          <span className={cn(
            'text-lg font-mono font-bold leading-none',
            law.avg_stars !== null
              ? law.avg_stars >= 4 ? 'text-gold' : law.avg_stars >= 3 ? 'text-surface-300' : 'text-against-300'
              : 'text-surface-500',
          )}>
            {law.avg_stars !== null ? law.avg_stars.toFixed(1) : '—'}
          </span>
          <span className="text-[9px] font-mono text-surface-600 mt-0.5">
            {law.review_count > 0 ? `${law.review_count} reviews` : 'No reviews'}
          </span>
        </Link>
      </div>

      {/* Quick-action links */}
      {level !== 'stable' && (
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/amendments`}
            className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            <Edit3 className="h-3 w-3" aria-hidden="true" />
            Propose amendment
          </Link>
          <span className="text-surface-700" aria-hidden="true">·</span>
          <Link
            href={`/law/${law.id}`}
            className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-gold transition-colors"
          >
            <Star className="h-3 w-3" aria-hidden="true" />
            Leave a review
          </Link>
        </div>
      )}
    </motion.article>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: OversightStats }) {
  const items = [
    {
      label: 'Established Laws',
      value: stats.total_laws.toLocaleString(),
      icon: Gavel,
      color: 'text-emerald',
    },
    {
      label: 'Under Amendment',
      value: stats.laws_under_amendment.toLocaleString(),
      icon: Edit3,
      color: stats.laws_under_amendment > 0 ? 'text-gold' : 'text-surface-500',
    },
    {
      label: 'Pending Amendments',
      value: stats.total_pending_amendments.toLocaleString(),
      icon: FileText,
      color: stats.total_pending_amendments > 0 ? 'text-gold' : 'text-surface-500',
    },
    {
      label: 'Under Petition',
      value: stats.laws_under_petition.toLocaleString(),
      icon: Scale,
      color: stats.laws_under_petition > 0 ? 'text-against-400' : 'text-surface-500',
    },
    {
      label: 'Avg Rating',
      value: stats.platform_avg_stars !== null ? `${stats.platform_avg_stars.toFixed(1)}★` : '—',
      icon: Star,
      color: stats.platform_avg_stars !== null
        ? stats.platform_avg_stars >= 4 ? 'text-gold' : stats.platform_avg_stars >= 3 ? 'text-surface-300' : 'text-against-400'
        : 'text-surface-500',
    },
  ]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center rounded-xl bg-surface-100 border border-surface-300 p-3 text-center gap-1"
          >
            <Icon className={cn('h-4 w-4', item.color)} aria-hidden="true" />
            <span className={cn('text-xl font-mono font-bold leading-none', item.color)}>
              {item.value}
            </span>
            <span className="text-[9px] font-mono text-surface-600 leading-tight">
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OversightSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3 animate-pulse">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OversightPage() {
  const [data, setData] = useState<OversightResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('scrutiny')
  const [search, setSearch] = useState('')

  const load = useCallback(async (cat?: string, s?: string) => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ sort: s ?? sort })
      if (cat && cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/oversight?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => {
    load(category, sort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort])

  const filteredLaws = (data?.laws ?? []).filter((l) =>
    !search || l.statement.toLowerCase().includes(search.toLowerCase()),
  )

  const criticalCount = filteredLaws.filter((l) => scrutinyLevel(l) === 'critical').length
  const elevatedCount = filteredLaws.filter((l) => scrutinyLevel(l) === 'elevated').length
  const stableCount = filteredLaws.filter((l) => scrutinyLevel(l) === 'stable').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12" id="main-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple/10 border border-purple/25 flex-shrink-0">
              <Eye className="h-5 w-5 text-purple" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Civic Oversight
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Health monitoring for all established laws — amendments, petitions, and community reviews
              </p>
            </div>
            <button
              onClick={() => load(category, sort)}
              disabled={loading}
              aria-label="Refresh oversight data"
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>

          {/* Status summary line */}
          {!loading && data && (
            <div className="flex items-center gap-3 text-xs font-mono text-surface-500 mb-4">
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 text-against-400">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  {criticalCount} critical
                </span>
              )}
              {elevatedCount > 0 && (
                <span className="flex items-center gap-1 text-gold">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {elevatedCount} elevated
                </span>
              )}
              {stableCount > 0 && (
                <span className="flex items-center gap-1 text-emerald">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {stableCount} stable
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        {!loading && data && <StatsStrip stats={data.stats} />}
        {loading && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {/* ── Search + filters ────────────────────────────────────────── */}
        <div className="space-y-3 mb-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search laws…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search established laws"
              className="w-full bg-surface-100 border border-surface-300 rounded-xl pl-9 pr-8 py-2.5 text-sm font-mono text-white placeholder-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filter by category">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold transition-all border',
                  category === cat
                    ? 'bg-for-500/20 border-for-500/50 text-for-300'
                    : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-surface-200',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-600">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                aria-pressed={sort === opt.value}
                className={cn(
                  'flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all border',
                  sort === opt.value
                    ? 'bg-purple/15 border-purple/40 text-purple'
                    : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-surface-200',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading && <OversightSkeleton />}

        {!loading && error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/8 p-8 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-mono text-against-300 mb-4">
              Couldn&apos;t load oversight data. Check your connection and try again.
            </p>
            <button
              onClick={() => load(category, sort)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredLaws.length === 0 && (
          <EmptyState
            icon={Eye}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title={search ? 'No laws match your search' : 'No laws established yet'}
            description={
              search
                ? `No laws containing "${search}" in this category.`
                : 'Laws appear here once topics reach consensus. Check back as the community votes.'
            }
            actions={
              search
                ? [{ label: 'Clear search', onClick: () => setSearch(''), variant: 'secondary' as const }]
                : [
                    { label: 'Browse topics', href: '/' },
                    { label: 'View the Codex', href: '/law', variant: 'secondary' as const },
                  ]
            }
          />
        )}

        <AnimatePresence initial={false} mode="popLayout">
          {!loading && !error && filteredLaws.length > 0 && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {filteredLaws.map((law) => (
                <OversightCard key={law.id} law={law} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer links ─────────────────────────────────────────── */}
        {!loading && !error && filteredLaws.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-6 text-xs font-mono text-surface-500">
            <Link href="/amendments" className="hover:text-white transition-colors flex items-center gap-1">
              <Edit3 className="h-3 w-3" aria-hidden="true" />
              Amendment Chamber →
            </Link>
            <Link href="/law" className="hover:text-white transition-colors flex items-center gap-1">
              <Gavel className="h-3 w-3" aria-hidden="true" />
              Full Codex →
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
