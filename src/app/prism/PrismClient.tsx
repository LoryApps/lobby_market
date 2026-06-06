'use client'

/**
 * /prism — The Civic Prism
 *
 * Reveals where civic discourse fractures into parallel realities: topics
 * where both sides make vigorous, well-developed cases that share almost
 * no common ground. FOR and AGAINST don't just disagree — they're
 * operating from entirely different value systems.
 *
 * Prism Score = sqrt(blue_args × red_args) × log10(total_votes + 1)
 *   Geometric mean rewards bilateral argument depth.
 *   Vote log-weight ensures engaged topics rise above fringe debates.
 *
 * Distinct from:
 *   /fracture  — vote split closest to 50/50 (metric-based divergence)
 *   /schism    — structural ideological rifts
 *   /vortex    — raw argument intensity per voter
 *   /divergence — trajectories of opinion over time
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PrismTopic, PrismResponse } from '@/app/api/prism/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-amber-400',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
  Justice:     'text-against-300',
  Immigration: 'text-surface-400',
}

const CATEGORY_BG: Record<string, string> = {
  Economics:   'bg-gold/10 border-gold/20',
  Politics:    'bg-for-500/10 border-for-500/20',
  Technology:  'bg-purple/10 border-purple/20',
  Science:     'bg-emerald/10 border-emerald/20',
  Ethics:      'bg-against-500/10 border-against-500/20',
  Philosophy:  'bg-purple/10 border-purple/20',
  Culture:     'bg-amber-500/10 border-amber-500/20',
  Health:      'bg-emerald/10 border-emerald/20',
  Environment: 'bg-emerald/10 border-emerald/20',
  Education:   'bg-for-300/10 border-for-300/20',
  Justice:     'bg-against-300/10 border-against-300/20',
  Immigration: 'bg-surface-400/10 border-surface-400/20',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Environment', 'Education',
]

function catColor(c: string | null): string {
  if (!c) return 'text-surface-400'
  const key = Object.keys(CATEGORY_COLORS).find(k =>
    c.toLowerCase().includes(k.toLowerCase()),
  )
  return key ? CATEGORY_COLORS[key] : 'text-surface-400'
}

function catBg(c: string | null): string {
  if (!c) return 'bg-surface-200 border-surface-300'
  const key = Object.keys(CATEGORY_BG).find(k =>
    c.toLowerCase().includes(k.toLowerCase()),
  )
  return key ? CATEGORY_BG[key] : 'bg-surface-200 border-surface-300'
}

// ─── Status badge helper ──────────────────────────────────────────────────────

type BadgeVariant = 'proposed' | 'active' | 'law' | 'failed'

function statusVariant(status: string): BadgeVariant {
  if (status === 'law') return 'law'
  if (status === 'active' || status === 'voting') return 'active'
  if (status === 'failed') return 'failed'
  return 'proposed'
}

// ─── Balance label ────────────────────────────────────────────────────────────

function balanceLabel(balance: number): { label: string; color: string } {
  if (balance >= 0.85) return { label: 'Mirror-matched', color: 'text-purple' }
  if (balance >= 0.65) return { label: 'Well-balanced', color: 'text-emerald' }
  if (balance >= 0.40) return { label: 'Asymmetric', color: 'text-gold' }
  return { label: 'One-sided', color: 'text-surface-400' }
}

// ─── Vote split mini-bar ──────────────────────────────────────────────────────

function SplitBar({ bluePct }: { bluePct: number }) {
  return (
    <div className="w-full space-y-0.5">
      <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-surface-300 flex">
        <div className="h-full bg-for-500" style={{ width: `${bluePct}%` }} />
        <div className="h-full bg-against-500 flex-1" />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-500">
        <span className="text-for-400">{Math.round(bluePct)}%</span>
        <span className="text-against-400">{Math.round(100 - bluePct)}%</span>
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  side,
}: {
  arg: { content: string; upvotes: number; author_display_name: string | null; author_username: string | null } | null
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  const empty = !arg

  return (
    <div
      className={cn(
        'flex-1 rounded-xl border p-3 space-y-2 min-w-0',
        isFor
          ? 'border-for-500/30 bg-for-500/5'
          : 'border-against-500/30 bg-against-500/5',
      )}
    >
      {/* Side label */}
      <div className="flex items-center gap-1.5">
        {isFor
          ? <ThumbsUp className="h-3.5 w-3.5 text-for-400 shrink-0" />
          : <ThumbsDown className="h-3.5 w-3.5 text-against-400 shrink-0" />
        }
        <span
          className={cn(
            'text-[10px] font-black uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {isFor ? 'For' : 'Against'}
        </span>
        {arg && (
          <span className="ml-auto text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            {arg.upvotes}
          </span>
        )}
      </div>

      {/* Argument text */}
      {empty ? (
        <p className="text-xs text-surface-500 italic">No top argument yet</p>
      ) : (
        <p className="text-xs text-surface-200 leading-relaxed line-clamp-4">
          {arg.content}
        </p>
      )}

      {/* Author */}
      {arg && (arg.author_display_name || arg.author_username) && (
        <p className="text-[10px] text-surface-500 truncate">
          — {arg.author_display_name ?? arg.author_username}
        </p>
      )}
    </div>
  )
}

// ─── Prism divider ────────────────────────────────────────────────────────────
// Vertical divider with a rainbow shimmer — the refraction visual

function PrismDivider() {
  return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center w-4">
      <div
        className="w-0.5 flex-1 rounded-full"
        style={{
          background: 'linear-gradient(to bottom, #3b82f6, #a855f7, #ef4444)',
          boxShadow: '0 0 6px 1px rgba(168,85,247,0.4)',
        }}
      />
    </div>
  )
}

// ─── Topic prism card ─────────────────────────────────────────────────────────

function PrismCard({ topic, index }: { topic: PrismTopic; index: number }) {
  const { label: balLabel, color: balColor } = balanceLabel(topic.arg_balance)
  const isTop3 = topic.rank <= 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
    >
      <div
        className={cn(
          'rounded-2xl border p-4 space-y-4 transition-all duration-200',
          isTop3
            ? 'border-purple/40 bg-purple/5 ring-1 ring-purple/15'
            : 'border-surface-300 bg-surface-100',
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Rank badge */}
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
                isTop3 ? 'bg-purple/20 text-purple' : 'bg-surface-200 text-surface-400',
              )}
            >
              {topic.rank <= 9 ? topic.rank : `#${topic.rank}`}
            </div>
            <Link
              href={`/topic/${topic.id}`}
              className="group flex items-start gap-1 min-w-0"
            >
              <p className="text-sm font-semibold text-surface-100 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                {topic.statement}
              </p>
              <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors shrink-0 mt-0.5" />
            </Link>
          </div>
          <Badge variant={statusVariant(topic.status)} className="text-[10px] capitalize shrink-0">
            {topic.status}
          </Badge>
        </div>

        {/* Category + balance label */}
        <div className="flex items-center gap-2 flex-wrap">
          {topic.category && (
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                catBg(topic.category),
                catColor(topic.category),
              )}
            >
              {topic.category}
            </span>
          )}
          <span className={cn('text-xs font-bold', balColor)}>{balLabel}</span>
          <span className="flex items-center gap-1 text-xs text-surface-500">
            <Users className="h-3 w-3" />
            {topic.total_votes.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-xs text-surface-500">
            <MessageSquare className="h-3 w-3" />
            {topic.blue_arg_count}↑ / {topic.red_arg_count}↓
          </span>
        </div>

        {/* Vote split */}
        <SplitBar bluePct={topic.blue_pct} />

        {/* Dual argument panels */}
        <div className="flex gap-2">
          <ArgCard arg={topic.top_for_arg} side="for" />
          <PrismDivider />
          <ArgCard arg={topic.top_against_arg} side="against" />
        </div>

        {/* Prism score footer */}
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 pt-1 border-t border-surface-300">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {topic.view_count.toLocaleString()} views
          </span>
          <span className="text-purple/80">
            prism {topic.prism_score.toFixed(2)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Category breakdown bar ───────────────────────────────────────────────────

function CategoryBar({
  category,
  count,
  avgPrism,
  maxPrism,
}: {
  category: string
  count: number
  avgPrism: number
  maxPrism: number
}) {
  const pct = maxPrism > 0 ? (avgPrism / maxPrism) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-semibold', catColor(category))}>{category}</span>
        <span className="font-mono text-surface-500">{count} topics</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: 'linear-gradient(to right, #3b82f6, #a855f7, #ef4444)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function PrismClient() {
  const [data, setData] = useState<PrismResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const load = useCallback(async (cat: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '25' })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/prism?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: PrismResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load prism data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(category)
  }, [category, load])

  const stats = data?.stats
  const topics = data?.topics ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-300 bg-surface-100 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              The Civic Prism
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full border border-purple/40 bg-purple/10 text-purple"
                aria-label="Chapter"
              >
                Ch. 250
              </span>
            </h1>
            <p className="text-sm text-surface-400 mt-0.5">
              Where parallel realities collide — both sides arguing with equal force, from entirely different worlds.
            </p>
          </div>
        </div>

        {/* ── Concept card ─────────────────────────────────────────────────── */}
        <div
          className="rounded-xl border border-purple/30 bg-purple/5 p-4 text-sm text-surface-300 leading-relaxed"
          role="note"
        >
          <p>
            A prism splits white light into its spectrum — revealing hidden components. These topics split civil
            society the same way:{' '}
            <span className="text-for-300 font-semibold">FOR</span> and{' '}
            <span className="text-against-300 font-semibold">AGAINST</span> don&apos;t just disagree; they argue
            from different premises, cite different evidence, and appeal to entirely different values. Ranked by
            bilateral argument depth × civic engagement.
          </p>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────────── */}
        {loading && !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Topics Analyzed"
              value={stats.topics_analyzed.toLocaleString()}
              sub="in active debate"
              color="text-for-300"
            />
            <StatCard
              label="Bilateral Debates"
              value={stats.bilateral_topics.toLocaleString()}
              sub="with both sides arguing"
              color="text-purple"
            />
            <StatCard
              label="Avg Balance"
              value={`${Math.round(stats.avg_arg_balance * 100)}%`}
              sub="arg symmetry"
              color="text-emerald"
            />
            <StatCard
              label="Total Arguments"
              value={stats.total_arguments.toLocaleString()}
              sub="across all topics"
              color="text-gold"
            />
          </div>
        ) : null}

        {/* ── Category filter ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          <button
            onClick={() => setShowCategories((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-surface-300 hover:text-white transition-colors"
            aria-expanded={showCategories}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter by category
            {category && (
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-md border', catBg(category), catColor(category))}>
                {category}
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showCategories && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {showCategories && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => { setCategory(null); setShowCategories(false) }}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
                      !category
                        ? 'bg-purple/20 border-purple/40 text-purple'
                        : 'border-surface-300 text-surface-400 hover:text-white hover:border-surface-200',
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategories(false) }}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
                        category === cat
                          ? cn('border-current', catBg(cat), catColor(cat))
                          : 'border-surface-300 text-surface-400 hover:text-white hover:border-surface-200',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Topic list ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-4 text-sm text-against-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => load(category)}
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            title="No bilateral debates found"
            description={
              category
                ? `No topics in ${category} have arguments from both sides yet.`
                : 'No topics currently have robust arguments from both sides.'
            }
            actions={[{ label: 'Clear filter', onClick: () => setCategory(null) }]}
          />
        ) : (
          <div className="space-y-4">
            {topics.map((topic, i) => (
              <PrismCard key={topic.id} topic={topic} index={i} />
            ))}
          </div>
        )}

        {/* ── Category breakdown ────────────────────────────────────────────── */}
        {!loading && stats && stats.category_breakdown.length > 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-200 transition-colors"
              aria-expanded={showBreakdown}
            >
              <span className="text-sm font-bold text-surface-100">Category Breakdown</span>
              <ChevronDown className={cn('h-4 w-4 text-surface-400 transition-transform', showBreakdown && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showBreakdown && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-surface-300 pt-3">
                    {(() => {
                      const maxPrism = Math.max(
                        ...stats.category_breakdown.map((c) => c.avg_prism),
                        1,
                      )
                      return stats.category_breakdown.map((c) => (
                        <CategoryBar
                          key={c.category}
                          category={c.category}
                          count={c.count}
                          avgPrism={c.avg_prism}
                          maxPrism={maxPrism}
                        />
                      ))
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Refresh row ────────────────────────────────────────────────────── */}
        {data && (
          <div className="flex items-center justify-between text-xs text-surface-500 pt-2">
            <span>Updated {new Date(data.updated_at).toLocaleTimeString()}</span>
            <button
              onClick={() => load(category)}
              disabled={loading}
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">{label}</p>
      <p className={cn('text-xl font-black tabular-nums', color)}>{value}</p>
      <p className="text-[10px] text-surface-500">{sub}</p>
    </div>
  )
}
