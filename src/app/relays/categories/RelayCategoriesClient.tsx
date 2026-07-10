'use client'

/**
 * /relays/categories — Relay Chains by Civic Category
 *
 * Organises all civic relay chains by the category of their underlying topic.
 * Each category card shows counts, the strongest FOR relay, the strongest
 * AGAINST relay, and a preview of the opening leg.
 *
 * Distinct from:
 *   /relays          — chronological relay browser (status filter)
 *   /relays/league   — weekly competition ranking
 *   /relays/champions — top contributors by leg upvotes
 *   /arguments/categories — arguments grouped by category (not relays)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GitMerge,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquarePlus,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RelayCategoryData, RelayCategoriesResponse, CategoryRelay } from '@/app/api/relays/categories/route'

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

const CATEGORY_STYLE: Record<string, {
  color: string
  bg: string
  border: string
  ring: string
  forBar: string
  againstBar: string
}> = {
  Economics:   { color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30',          ring: 'ring-gold/20',         forBar: 'bg-gold',         againstBar: 'bg-against-500' },
  Politics:    { color: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30',       ring: 'ring-for-500/20',      forBar: 'bg-for-500',      againstBar: 'bg-against-500' },
  Technology:  { color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30',        ring: 'ring-purple/20',       forBar: 'bg-for-500',      againstBar: 'bg-against-500' },
  Science:     { color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30',       ring: 'ring-emerald/20',      forBar: 'bg-emerald',      againstBar: 'bg-against-500' },
  Ethics:      { color: 'text-against-400',  bg: 'bg-against-500/10',   border: 'border-against-500/30',   ring: 'ring-against-500/20',  forBar: 'bg-for-500',      againstBar: 'bg-against-500' },
  Philosophy:  { color: 'text-for-300',      bg: 'bg-for-300/10',       border: 'border-for-300/20',       ring: 'ring-for-300/20',      forBar: 'bg-for-400',      againstBar: 'bg-against-500' },
  Culture:     { color: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/20',          ring: 'ring-gold/20',         forBar: 'bg-gold',         againstBar: 'bg-against-500' },
  Health:      { color: 'text-against-300',  bg: 'bg-against-400/10',   border: 'border-against-400/30',   ring: 'ring-against-400/20',  forBar: 'bg-for-500',      againstBar: 'bg-against-400' },
  Environment: { color: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30',       ring: 'ring-emerald/20',      forBar: 'bg-emerald',      againstBar: 'bg-against-500' },
  Education:   { color: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30',        ring: 'ring-purple/20',       forBar: 'bg-for-500',      againstBar: 'bg-against-500' },
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
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusConfig(status: CategoryRelay['status']): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    open:        { label: 'Open',        cls: 'text-emerald border-emerald/30 bg-emerald/10' },
    in_progress: { label: 'In Progress', cls: 'text-gold border-gold/30 bg-gold/10' },
    complete:    { label: 'Complete',    cls: 'text-for-400 border-for-500/30 bg-for-500/10' },
    voted:       { label: 'Voted',       cls: 'text-surface-400 border-surface-400/30 bg-surface-300/10' },
  }
  return map[status] ?? map['open']
}

// ─── Relay mini-card ──────────────────────────────────────────────────────────

function RelayMiniCard({ relay, side }: { relay: CategoryRelay; side: 'for' | 'against' }) {
  const isFor = side === 'for'
  const sc = statusConfig(relay.status)

  return (
    <Link href={`/relays/${relay.id}`} className="group block">
      <div className={cn(
        'rounded-xl border p-3 transition-all duration-200',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40 hover:bg-for-500/10'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40 hover:bg-against-500/10',
      )}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex-shrink-0',
              isFor
                ? 'text-for-400 border-for-500/40 bg-for-500/10'
                : 'text-against-400 border-against-500/40 bg-against-500/10',
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono border flex-shrink-0',
              sc.cls,
            )}>
              {sc.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500 flex-shrink-0">
            <Users className="h-2.5 w-2.5" />
            <span>{relay.leg_count}/{relay.max_legs}</span>
          </div>
        </div>

        {/* Topic statement */}
        {relay.topic_statement && (
          <p className="text-[11px] font-mono text-surface-500 line-clamp-1 mb-1.5">
            {relay.topic_statement}
          </p>
        )}

        {/* First leg preview */}
        {relay.first_leg_content && (
          <p className="text-xs text-surface-700 line-clamp-2 leading-relaxed">
            {relay.first_leg_content}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-surface-200/50">
          <div className="flex items-center gap-1.5">
            <Avatar
              src={relay.starter_avatar_url}
              username={relay.starter_username}
              size={14}
            />
            <span className="text-[10px] font-mono text-surface-500 truncate max-w-[100px]">
              {relay.starter_display_name ?? relay.starter_username}
            </span>
            <span className="text-[9px] font-mono text-surface-600">·</span>
            <span className="text-[10px] font-mono text-surface-500">{relativeTime(relay.created_at)}</span>
          </div>
          {(relay.vote_compelling > 0 || relay.vote_not_compelling > 0) && (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="flex items-center gap-0.5 text-emerald">
                <ThumbsUp className="h-2.5 w-2.5" />
                {relay.vote_compelling}
              </span>
              <span className="flex items-center gap-0.5 text-against-400">
                <ThumbsDown className="h-2.5 w-2.5" />
                {relay.vote_not_compelling}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, expanded, onToggle }: {
  cat: RelayCategoryData
  expanded: boolean
  onToggle: () => void
}) {
  const style = CATEGORY_STYLE[cat.name] ?? CATEGORY_STYLE['Politics']
  const Icon = CATEGORY_ICON[cat.name] ?? GitMerge

  if (cat.total === 0) {
    return (
      <div className={cn(
        'rounded-2xl border p-4 opacity-50',
        'border-surface-300 bg-surface-100',
      )}>
        <div className="flex items-center gap-2 mb-3">
          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', style.bg, style.border, 'border')}>
            <Icon className={cn('h-4 w-4', style.color)} />
          </div>
          <div>
            <div className="text-sm font-semibold text-surface-700">{cat.name}</div>
            <div className="text-[10px] font-mono text-surface-500">No relays yet</div>
          </div>
        </div>
        <Link
          href={`/relays/create?category=${encodeURIComponent(cat.name)}`}
          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          <MessageSquarePlus className="h-3 w-3" />
          Start the first relay
        </Link>
      </div>
    )
  }

  const forPct = cat.total > 0
    ? Math.round((cat.for_count / cat.total) * 100)
    : 50

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border transition-all duration-200 overflow-hidden',
        expanded
          ? cn('border-surface-300', style.ring, 'ring-1 bg-surface-100')
          : 'border-surface-300 bg-surface-100 hover:border-surface-400',
      )}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0',
              style.bg, style.border, 'border',
            )}>
              <Icon className={cn('h-4.5 w-4.5', style.color)} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{cat.name}</div>
              <div className="text-[10px] font-mono text-surface-500">
                {cat.total} relay{cat.total !== 1 ? 's' : ''} ·{' '}
                <span className="text-emerald">{cat.open} open</span>
                {cat.complete > 0 && (
                  <> · <span className="text-for-400">{cat.complete} voted</ span></>
                )}
              </div>
            </div>
          </div>

          {/* FOR/AGAINST ratio bar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono">
              <span className="text-for-400">{cat.for_count} FOR</span>
              <span className="text-surface-600">/</span>
              <span className="text-against-400">{cat.against_count} vs</span>
            </div>
            <div className="w-16 h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-surface-500"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-90" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="px-4 pb-4 border-t border-surface-200/50 pt-3 space-y-3">
              {/* Top FOR + AGAINST pair */}
              {(cat.top_for || cat.top_against) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {cat.top_for && (
                    <div>
                      <div className="text-[9px] font-mono text-surface-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Zap className="h-2.5 w-2.5 text-for-400" />
                        Best FOR Chain
                      </div>
                      <RelayMiniCard relay={cat.top_for} side="for" />
                    </div>
                  )}
                  {cat.top_against && (
                    <div>
                      <div className="text-[9px] font-mono text-surface-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Zap className="h-2.5 w-2.5 text-against-400" />
                        Best AGAINST Chain
                      </div>
                      <RelayMiniCard relay={cat.top_against} side="against" />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href={`/relays?category=${encodeURIComponent(cat.name)}`}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-mono transition-colors',
                    style.color, 'hover:opacity-80',
                  )}
                >
                  <GitMerge className="h-3 w-3" />
                  All {cat.name} relays
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href={`/relays/create?category=${encodeURIComponent(cat.name)}`}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  Start a relay
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function RelayCategoriesClient() {
  const [data, setData] = useState<RelayCategoriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'active' | 'empty'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/relays/categories')
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as RelayCategoriesResponse
      setData(json)
      // Auto-expand first non-empty category
      const first = json.categories.find((c) => c.total > 0)
      if (first && !expanded) setExpanded(first.name)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const filteredCategories = data?.categories.filter((c) => {
    if (viewMode === 'active') return c.open > 0
    if (viewMode === 'empty') return c.total === 0
    return true
  }) ?? []

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Page header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitMerge className="h-5 w-5 text-purple" />
                <h1 className="text-lg font-bold text-white">Relay Categories</h1>
              </div>
              <p className="text-sm text-surface-500">
                Collaborative argument chains, organised by civic topic.
              </p>
              {data && (
                <p className="text-[11px] font-mono text-surface-600 mt-0.5">
                  {data.total_relays.toLocaleString()} relay{data.total_relays !== 1 ? 's' : ''} across all categories
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
                aria-label="Refresh"
              >
                {loading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Link
              href="/relays"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <GitMerge className="h-3 w-3" />
              All Relays
            </Link>
            <span className="text-surface-600 text-xs">·</span>
            <Link
              href="/relays/league"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              League
            </Link>
            <span className="text-surface-600 text-xs">·</span>
            <Link
              href="/relays/hall-of-fame"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Hall of Fame
            </Link>
            <span className="text-surface-600 text-xs">·</span>
            <Link
              href="/relays/create"
              className="text-xs font-mono text-purple hover:opacity-80 transition-opacity"
            >
              + Start Relay
            </Link>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 mb-5">
            {(['all', 'active', 'empty'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-mono border transition-all',
                  viewMode === mode
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-700',
                )}
              >
                {mode === 'all' ? 'All Categories' : mode === 'active' ? 'Has Open Relays' : 'Empty'}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading && !data ? (
            <PageSkeleton />
          ) : error ? (
            <EmptyState
              icon={GitMerge}
              title="Failed to load"
              description="Could not load relay categories. Please try again."
              action={{ label: 'Retry', onClick: load }}
            />
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              icon={GitMerge}
              title="No categories match"
              description="Try a different filter."
            />
          ) : (
            <motion.div layout className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredCategories.map((cat) => (
                  <motion.div
                    key={cat.name}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CategoryCard
                      cat={cat}
                      expanded={expanded === cat.name}
                      onToggle={() => setExpanded((prev) => prev === cat.name ? null : cat.name)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
