'use client'

/**
 * /afterglow — Civic Afterglow
 *
 * Shows recently-established laws ranked by ongoing engagement heat.
 * Laws don't go cold the moment they're established — the community
 * keeps arguing, reading, and debating them. This page reveals which
 * laws still burn bright and which have faded into civic history.
 *
 * Heat tiers (afterglow score 0–100):
 *   Blazing (70+)  — intense ongoing debate, heavy traffic
 *   Warm   (40–69) — steady engagement, regular discussion
 *   Cooling (15–39) — dwindling interest, still active
 *   Cold   (0–14)  — debate has quieted, law has settled
 *
 * Distinct from:
 *   /laws       — all-time law codex (no recency/activity filter)
 *   /trending   — trending topics (any status, not just laws)
 *   /momentum   — real-time vote velocity (not post-establishment)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Snowflake,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
  Eye,
  Sparkles,
  Wind,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AfterglewLaw, AfterglowResponse } from '@/app/api/afterglow/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type SortMode = 'afterglow' | 'recent' | 'votes' | 'arguments'
type WindowDays = 7 | 30 | 60 | 90

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof Flame }[] = [
  { id: 'afterglow', label: 'Hottest', icon: Flame },
  { id: 'recent',   label: 'Newest Laws', icon: Zap },
  { id: 'votes',    label: 'Most Voted', icon: TrendingUp },
  { id: 'arguments', label: 'Most Argued', icon: MessageSquare },
]

const WINDOW_OPTIONS: { id: WindowDays; label: string }[] = [
  { id: 7,  label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 60, label: '60 days' },
  { id: 90, label: '90 days' },
]

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Heat tier config ─────────────────────────────────────────────────────────

const HEAT_CONFIG: Record<AfterglewLaw['heat_tier'], {
  label: string
  icon: typeof Flame
  iconClass: string
  borderClass: string
  glowClass: string
  bgClass: string
  scoreClass: string
}> = {
  blazing: {
    label: 'Blazing',
    icon: Flame,
    iconClass: 'text-against-400',
    borderClass: 'border-against-500/40',
    glowClass: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    bgClass: 'bg-against-900/20',
    scoreClass: 'text-against-400',
  },
  warm: {
    label: 'Warm',
    icon: Flame,
    iconClass: 'text-gold',
    borderClass: 'border-gold/30',
    glowClass: 'shadow-[0_0_16px_rgba(245,158,11,0.10)]',
    bgClass: 'bg-gold/5',
    scoreClass: 'text-gold',
  },
  cooling: {
    label: 'Cooling',
    icon: Wind,
    iconClass: 'text-for-400',
    borderClass: 'border-for-500/20',
    glowClass: '',
    bgClass: '',
    scoreClass: 'text-for-400',
  },
  cold: {
    label: 'Cold',
    icon: Snowflake,
    iconClass: 'text-surface-500',
    borderClass: 'border-surface-300/50',
    glowClass: '',
    bgClass: '',
    scoreClass: 'text-surface-500',
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
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LawCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

// ─── Heat Score Bar ───────────────────────────────────────────────────────────

function HeatBar({ score, tier }: { score: number; tier: AfterglewLaw['heat_tier'] }) {
  const fillClass = {
    blazing: 'bg-against-500',
    warm:    'bg-gold',
    cooling: 'bg-for-400',
    cold:    'bg-surface-500',
  }[tier]

  return (
    <div className="relative h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', fillClass)}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

function LawCard({ law, index }: { law: AfterglewLaw; index: number }) {
  const heat  = HEAT_CONFIG[law.heat_tier]
  const HeatIcon = heat.icon
  const forPct    = Math.round(law.blue_pct)
  const againstPct = 100 - forPct
  const catColor   = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/law/${law.id}`}
        className={cn(
          'block rounded-2xl border p-4 transition-all duration-200',
          'bg-surface-100 hover:bg-surface-200',
          heat.borderClass,
          heat.glowClass,
          heat.bgClass,
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              {truncate(law.statement, 120)}
            </p>
          </div>

          {/* Heat score badge */}
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg border flex-shrink-0',
            'text-xs font-mono font-bold',
            heat.borderClass,
            heat.scoreClass,
          )}>
            <HeatIcon className={cn('h-3 w-3', heat.iconClass)} aria-hidden="true" />
            {law.afterglow_score}
          </div>
        </div>

        {/* Heat bar */}
        <HeatBar score={law.afterglow_score} tier={law.heat_tier} />

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-surface-500">
          {/* Category */}
          {law.category && (
            <span className={catColor}>{law.category}</span>
          )}

          {/* Heat tier */}
          <span className={cn('flex items-center gap-1', heat.scoreClass)}>
            <HeatIcon className="h-2.5 w-2.5" aria-hidden="true" />
            {heat.label}
          </span>

          {/* Days since law */}
          <span className="flex items-center gap-1 text-surface-600">
            <Gavel className="h-2.5 w-2.5" aria-hidden="true" />
            Law {relativeTime(law.established_at)}
          </span>

          {/* Argument count */}
          {law.argument_count > 0 && (
            <span className="flex items-center gap-1 text-surface-600">
              <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />
              {law.argument_count.toLocaleString()} arg{law.argument_count !== 1 ? 's' : ''}
            </span>
          )}

          {/* Views */}
          {law.view_count > 0 && (
            <span className="flex items-center gap-1 text-surface-600">
              <Eye className="h-2.5 w-2.5" aria-hidden="true" />
              {law.view_count >= 1000
                ? `${(law.view_count / 1000).toFixed(1)}k`
                : law.view_count.toLocaleString()}
            </span>
          )}
        </div>

        {/* Vote split bar */}
        <div className="mt-3 space-y-1">
          <div
            className="relative h-2 rounded-full overflow-hidden bg-against-600/30"
            role="img"
            aria-label={`${forPct}% FOR, ${againstPct}% AGAINST`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400 flex items-center gap-0.5">
              <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
              {forPct}%
            </span>
            <span className="text-surface-600">
              {law.total_votes.toLocaleString()} votes
            </span>
            <span className="text-against-400 flex items-center gap-0.5">
              {againstPct}%
              <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="law" size="sm" />
          </div>
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-600 hover:text-white transition-colors">
            Read law <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AfterglowPage() {
  const [laws, setLaws]         = useState<AfterglewLaw[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [sort, setSort]         = useState<SortMode>('afterglow')
  const [window_, setWindow]    = useState<WindowDays>(60)
  const [category, setCategory] = useState<string | null>(null)
  const [catOpen, setCatOpen]   = useState(false)

  const fetchLaws = useCallback(async (
    s: SortMode,
    w: WindowDays,
    cat: string | null,
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        sort: s,
        window: String(w),
        limit: '40',
      })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/afterglow?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const data: AfterglowResponse = await res.json()
      setLaws(data.laws)
      setTotal(data.total)
    } catch {
      setLaws([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLaws(sort, window_, category)
  }, [fetchLaws, sort, window_, category])

  // Tier counts for the legend
  const tierCounts = {
    blazing: laws.filter((l) => l.heat_tier === 'blazing').length,
    warm:    laws.filter((l) => l.heat_tier === 'warm').length,
    cooling: laws.filter((l) => l.heat_tier === 'cooling').length,
    cold:    laws.filter((l) => l.heat_tier === 'cold').length,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-5 w-5 text-against-400" aria-hidden="true" />
            <h1 className="text-lg font-bold text-white tracking-tight">Civic Afterglow</h1>
          </div>
          <p className="text-sm text-surface-500">
            Laws that still burn. Track which recently-established laws remain hot with
            ongoing debate, heavy traffic, and community engagement.
          </p>
        </div>

        {/* Tier legend */}
        {!loading && laws.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-5 p-3 rounded-xl bg-surface-100 border border-surface-300">
            {(Object.entries(tierCounts) as [AfterglewLaw['heat_tier'], number][]).map(([tier, count]) => {
              if (count === 0) return null
              const config = HEAT_CONFIG[tier]
              const Icon   = config.icon
              return (
                <div key={tier} className="flex items-center gap-1.5 text-xs font-mono">
                  <Icon className={cn('h-3.5 w-3.5', config.iconClass)} aria-hidden="true" />
                  <span className={config.scoreClass}>{config.label}</span>
                  <span className="text-surface-600">({count})</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-6">

          {/* Sort tabs */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1 flex-wrap">
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                aria-pressed={sort === id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors',
                  sort === id
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Window picker */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {WINDOW_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setWindow(id)}
                aria-pressed={window_ === id}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono transition-colors',
                  window_ === id
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setCatOpen((o) => !o)}
              aria-expanded={catOpen}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono',
                'border transition-colors',
                category
                  ? 'bg-for-600/20 border-for-500/40 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
              )}
            >
              {category ?? 'All categories'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', catOpen && 'rotate-180')} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 top-full mt-1 z-20 bg-surface-200 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                >
                  <button
                    onClick={() => { setCategory(null); setCatOpen(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                      !category ? 'text-white bg-surface-300' : 'text-surface-500 hover:text-white',
                    )}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === cat
                          ? 'text-white bg-surface-300'
                          : 'text-surface-500 hover:text-white',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchLaws(sort, window_, category)}
            disabled={loading}
            aria-label="Refresh afterglow data"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-surface-100 border border-surface-300 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {/* Count */}
        {!loading && total > 0 && (
          <p className="text-[11px] font-mono text-surface-600 mb-4">
            {total.toLocaleString()} law{total !== 1 ? 's' : ''} in the last {window_} days
            {category ? ` · ${category}` : ''}
          </p>
        )}

        {/* Law cards */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <LawCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : laws.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Snowflake}
                title="No laws in this window"
                description={`No laws were established in the last ${window_} days${category ? ` in ${category}` : ''}. Try a wider window.`}
                action={{ label: 'View all laws', href: '/laws' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="laws"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {laws.map((law, i) => (
                <LawCard key={law.id} law={law} index={i} />
              ))}

              {/* Bottom links */}
              <div className="pt-4 flex flex-col gap-3 text-center">
                <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-surface-600">
                  <Sparkles className="h-3 w-3 text-gold" aria-hidden="true" />
                  Afterglow scores update every 30 minutes
                </div>
                <div className="flex items-center justify-center gap-4 text-xs font-mono">
                  <Link
                    href="/laws"
                    className="text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Gavel className="h-3 w-3" aria-hidden="true" />
                    Full Law Codex
                  </Link>
                  <Link
                    href="/trending"
                    className="text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    Trending topics
                  </Link>
                  <Link
                    href="/graveyard"
                    className="text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    Graveyard
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
