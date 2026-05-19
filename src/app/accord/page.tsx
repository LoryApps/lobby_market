'use client'

/**
 * /accord — The Civic Accord
 *
 * Reveals the rare common ground of Lobby Market — topics where the community
 * has reached near-unanimous agreement (≥80% on one side), transcending the
 * usual partisan divides. These are the issues where civic consensus speaks
 * loudest and political labels dissolve.
 *
 * Distinct from:
 *   /bridge         — individual user's cross-partisan voting moments
 *   /diversity      — individual's echo-chamber score
 *   /laws           — established laws (67% threshold, not 80%)
 *   /consensus      — network graph of current vote distributions
 *   /crossfire      — contested topics (opposite of accord)
 *
 * The Accord answers: "What do we ALL actually agree on?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Gavel,
  Handshake,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AccordTopic, AccordCategory, AccordResponse } from '@/app/api/accord/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STATUS_FILTER_OPTIONS = [
  { id: 'any',    label: 'All topics' },
  { id: 'active', label: 'Active now' },
  { id: 'law',    label: 'Established Laws' },
] as const

const SORT_OPTIONS = [
  { id: 'strength', label: 'Strongest agreement' },
  { id: 'votes',    label: 'Most votes' },
  { id: 'mandate',  label: 'Broadest mandate' },
] as const

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Strength ring ─────────────────────────────────────────────────────────────

function StrengthRing({ strength, side }: { strength: number; side: 'for' | 'against' }) {
  const r = 22
  const circumference = 2 * Math.PI * r
  const filled = (strength / 100) * circumference
  const color = side === 'for' ? '#60a5fa' : '#f87171'
  const pct = side === 'for' ? Math.round(50 + (strength / 100) * 50) : Math.round(50 + (strength / 100) * 50)

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-sm font-mono font-bold leading-none', side === 'for' ? 'text-for-300' : 'text-against-300')}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

// ─── Accord Topic Card ─────────────────────────────────────────────────────────

function AccordCard({ topic, index }: { topic: AccordTopic; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const winningPct = topic.accord_side === 'for' ? Math.round(topic.blue_pct) : Math.round(100 - topic.blue_pct)
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400/60 transition-all duration-200',
        topic.accord_side === 'for'
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40',
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 p-4">
        {/* Ring */}
        <StrengthRing strength={topic.accord_strength} side={topic.accord_side} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {topic.category && (
              <span className={cn('text-[10px] font-mono uppercase tracking-widest font-semibold', catColor)}>
                {topic.category}
              </span>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="xs">
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            <span className={cn(
              'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full font-semibold',
              topic.accord_side === 'for'
                ? 'bg-for-500/15 text-for-300'
                : 'bg-against-500/15 text-against-300',
            )}>
              {topic.accord_side === 'for' ? (
                <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5" />{winningPct}% FOR</span>
              ) : (
                <span className="flex items-center gap-1"><ThumbsDown className="h-2.5 w-2.5" />{winningPct}% AGAINST</span>
              )}
            </span>
          </div>

          <Link href={`/topic/${topic.id}`}>
            <p className="text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors">
              {topic.statement}
            </p>
          </Link>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              <span>{fmtVotes(topic.total_votes)} votes</span>
            </div>
            <div className={cn(
              'flex items-center gap-1 text-[11px] font-mono',
              topic.accord_strength >= 90 ? 'text-gold' : topic.accord_strength >= 70 ? 'text-emerald' : 'text-for-400',
            )}>
              <Sparkles className="h-3 w-3" />
              <span>
                {topic.accord_strength >= 90 ? 'Near-unanimous' : topic.accord_strength >= 70 ? 'Super-majority' : 'Strong majority'}
              </span>
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200/60 text-surface-500 hover:bg-surface-300/60 hover:text-white transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Vote bar */}
      <div className="px-4 pb-3">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-against-900/60">
          <div
            className="bg-for-500 transition-all duration-500"
            style={{ width: `${Math.round(topic.blue_pct)}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] font-mono text-for-400">{Math.round(topic.blue_pct)}% FOR</span>
          <span className="text-[9px] font-mono text-against-400">{100 - Math.round(topic.blue_pct)}% AGAINST</span>
        </div>
      </div>

      {/* Expanded: top argument */}
      <AnimatePresence initial={false}>
        {expanded && topic.top_argument && (
          <motion.div
            key="arg"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'mx-4 mb-4 p-3 rounded-xl border',
              topic.accord_side === 'for'
                ? 'bg-for-900/30 border-for-700/30'
                : 'bg-against-900/30 border-against-700/30',
            )}>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className={cn('h-3 w-3', topic.accord_side === 'for' ? 'text-for-400' : 'text-against-400')} />
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest', topic.accord_side === 'for' ? 'text-for-400' : 'text-against-400')}>
                  Top {topic.accord_side === 'for' ? 'FOR' : 'AGAINST'} Argument
                </span>
                <span className="ml-auto text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
                  <ThumbsUp className="h-2.5 w-2.5" /> {topic.top_argument.upvotes}
                </span>
              </div>
              <p className="text-xs text-surface-300 leading-relaxed">
                {truncate(topic.top_argument.content, 220)}
              </p>
              {topic.top_argument.author_username && (
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-[10px] font-mono text-surface-600">by</span>
                  <Link
                    href={`/profile/${topic.top_argument.author_username}`}
                    className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    @{topic.top_argument.author_username}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {expanded && !topic.top_argument && (
          <motion.div
            key="no-arg"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 flex items-center gap-2 text-xs text-surface-600 font-mono">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>No arguments yet — be the first to make the case.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: links */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2 border-t',
        'border-surface-300/30',
      )}>
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          <span>View debate</span>
        </Link>
        <Link
          href={`/topic/${topic.id}/arguments`}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          <MessageSquare className="h-3 w-3" />
          <span>Arguments</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: AccordCategory }) {
  const catColor = CATEGORY_COLOR[cat.category] ?? 'text-surface-400'
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={cn('text-sm font-mono font-semibold', catColor)}>{cat.category}</span>
        <span className="text-xs font-mono text-white font-bold">{cat.accord_count}</span>
      </div>
      <div className="text-[10px] font-mono text-surface-500 mb-2">
        avg {cat.avg_strength.toFixed(0)}% strength · {fmtVotes(cat.total_votes)} votes
      </div>
      <div className="flex h-1 rounded-full overflow-hidden bg-surface-300/40">
        <div className="bg-for-500" style={{ width: `${cat.for_accords / cat.accord_count * 100}%` }} />
        <div className="bg-against-500" style={{ width: `${cat.against_accords / cat.accord_count * 100}%` }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] font-mono text-for-400">{cat.for_accords} FOR</span>
        <span className="text-[9px] font-mono text-against-400">{cat.against_accords} AGAINST</span>
      </div>
    </div>
  )
}

// ─── Skeletons ─────────────────────────────────────────────────────────────────

function AccordSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AccordPage() {
  const [data, setData] = useState<AccordResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('All')
  const [statusFilter, setStatusFilter] = useState<'any' | 'active' | 'law'>('any')
  const [sortBy, setSortBy] = useState<'strength' | 'votes' | 'mandate'>('strength')
  const [showCats, setShowCats] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        category: category === 'All' ? 'all' : category,
        status: statusFilter,
        sort: sortBy,
      })
      const res = await fetch(`/api/accord?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [category, statusFilter, sortBy])

  useEffect(() => { load() }, [load])

  const stats = data?.stats
  const topics = data?.topics ?? []
  const byCategory = data?.byCategory ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <Handshake className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">The Civic Accord</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Where we all actually agree
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors text-xs font-mono disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:block">Refresh</span>
            </button>
          </div>
          <p className="text-xs font-mono text-surface-500 ml-14 leading-relaxed">
            Topics where ≥80% of the Lobby voted the same way — genuine consensus that transcends political divides.
          </p>
        </motion.div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        {stats && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="grid grid-cols-4 gap-2 mb-5"
          >
            {[
              {
                label: 'Accords',
                value: data?.totalAccords ?? 0,
                icon: Handshake,
                color: 'text-emerald',
                bg: 'bg-emerald/10',
                border: 'border-emerald/20',
              },
              {
                label: 'Avg strength',
                value: `${data?.avgStrength ?? 0}%`,
                icon: Sparkles,
                color: 'text-gold',
                bg: 'bg-gold/10',
                border: 'border-gold/20',
              },
              {
                label: 'FOR accords',
                value: stats.forAccords,
                icon: ThumbsUp,
                color: 'text-for-400',
                bg: 'bg-for-500/10',
                border: 'border-for-500/20',
              },
              {
                label: 'AGAINST',
                value: stats.againstAccords,
                icon: ThumbsDown,
                color: 'text-against-400',
                bg: 'bg-against-500/10',
                border: 'border-against-500/20',
              },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className={cn('rounded-xl border p-3 text-center', bg, border)}>
                <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} aria-hidden="true" />
                <div className={cn('text-base font-mono font-bold', color)}>{value}</div>
                <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Super-majority callout ─────────────────────────────────────────── */}
        {stats && !loading && stats.superMajorityCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mb-5 rounded-2xl border border-gold/20 bg-gold/5 p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-gold" />
              <span className="text-xs font-mono font-semibold text-gold uppercase tracking-widest">
                Super-majority accords
              </span>
            </div>
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              <span className="text-white font-semibold">{stats.superMajorityCount} topics</span> reached ≥85% agreement —
              and <span className="text-white font-semibold">{stats.unanimousCount}</span> reached near-unanimity (≥95%).
              These represent the platform&apos;s clearest shared civic values.
            </p>
          </motion.div>
        )}

        {/* ── Category breakdown (collapsible) ──────────────────────────────── */}
        {!loading && byCategory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-5"
          >
            <button
              onClick={() => setShowCats((s) => !s)}
              className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-2"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Category breakdown</span>
              {showCats ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <AnimatePresence initial={false}>
              {showCats && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {byCategory.slice(0, 9).map((cat) => (
                      <button
                        key={cat.category}
                        onClick={() => setCategory(cat.category)}
                        className="text-left"
                      >
                        <CategoryCard cat={cat} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div className="mb-5 space-y-2">
          {/* Category */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  category === cat
                    ? 'bg-for-600/80 border-for-500/60 text-white'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400 hover:text-white',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status + Sort */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id as typeof statusFilter)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  statusFilter === opt.id
                    ? 'bg-emerald/20 border-emerald/40 text-emerald'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400 hover:text-white',
                )}
              >
                {opt.label}
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id as typeof sortBy)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                    sortBy === opt.id
                      ? 'bg-purple/20 border-purple/40 text-purple'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400 hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {loading ? (
          <AccordSkeleton />
        ) : error ? (
          <div className="text-center py-12 text-sm font-mono text-surface-500">
            <Scale className="h-8 w-8 mx-auto mb-3 text-surface-600" />
            <p className="mb-3">{error}</p>
            <button onClick={load} className="text-for-400 hover:text-for-300 transition-colors">
              Try again
            </button>
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No accords found"
            description="No topics have reached ≥80% agreement yet under these filters. Try changing the category or status filter."
          />
        ) : (
          <div className="space-y-3">
            {topics.map((topic, i) => (
              <AccordCard key={topic.id} topic={topic} index={i} />
            ))}

            {/* Navigation links */}
            <div className="pt-4 border-t border-surface-300/30 flex flex-wrap gap-3 justify-center">
              <Link
                href="/bridge"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
              >
                <Handshake className="h-3.5 w-3.5" />
                <span>Your Bridge moments</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/crossfire"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-against-400 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Most contested topics</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/law"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-emerald transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                <span>Established Laws</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
