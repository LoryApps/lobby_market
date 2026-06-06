'use client'

/**
 * /magnitude — The Civic Magnitude
 *
 * A Richter-scale-style ranking of civic topics by their total democratic
 * impact: vote volume × consensus strength × argument engagement.
 *
 * Magnitude classes (like earthquake magnitude):
 *   M1 — Minor   (score < 25)
 *   M2 — Light   (score 25–44)
 *   M3 — Moderate (score 45–64)
 *   M4 — Strong  (score 65–84)
 *   M5 — Major   (score 85+)
 *
 * A high Magnitude score means: many people voted, strong consensus emerged,
 * and the debate generated rich argument culture.
 *
 * Distinct from:
 *   /vortex      — argument intensity per voter (rhetoric heat)
 *   /flashpoint  — rate-of-change velocity
 *   /seismic     — anomalous vote burst detection
 *   /pressure    — topics near opinion flip
 *   /correlations — cross-topic vote alignment
 *
 * Magnitude asks: "Which topics left the biggest democratic footprint?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Cpu,
  DollarSign,
  ExternalLink,
  FlaskConical,
  Gavel,
  Globe,
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
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MagnitudeTopic, MagnitudeStats, MagnitudeResponse } from '@/app/api/magnitude/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: DollarSign,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20'     },
  Culture:     { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20'     },
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Magnitude class config ───────────────────────────────────────────────────

const CLASS_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
  ring: string
  barColor: string
  description: string
}> = {
  M5: {
    label: 'Major',
    color: 'text-against-300',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    ring: 'ring-against-500/20',
    barColor: '#ef4444',
    description: 'Maximum democratic impact',
  },
  M4: {
    label: 'Strong',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/20',
    barColor: '#c9a84c',
    description: 'Significant civic footprint',
  },
  M3: {
    label: 'Moderate',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    ring: 'ring-purple/20',
    barColor: '#9333ea',
    description: 'Noticeable community engagement',
  },
  M2: {
    label: 'Light',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/20',
    barColor: '#3b82f6',
    description: 'Growing participation',
  },
  M1: {
    label: 'Minor',
    color: 'text-surface-500',
    bg: 'bg-surface-100',
    border: 'border-surface-300',
    ring: 'ring-surface-400/10',
    barColor: '#4b5563',
    description: 'Early stage topic',
  },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MagnitudeSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, rank }: { topic: MagnitudeTopic; rank: number }) {
  const cls = CLASS_CONFIG[topic.magnitude_class] ?? CLASS_CONFIG.M1
  const catStyle = topic.category ? CATEGORY_COLOR[topic.category] : null
  const CatIcon = topic.category ? CATEGORY_ICON[topic.category] : Globe

  const forPct = Math.round(topic.blue_pct)
  const agPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.4) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group block rounded-2xl border p-4 transition-all duration-200',
          'bg-surface-100 border-surface-300 hover:bg-surface-200 hover:border-surface-400',
        )}
      >
        <div className="flex items-start gap-3">
          {/* Rank + class badge */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className={cn(
              'h-10 w-10 rounded-xl border flex flex-col items-center justify-center',
              cls.bg, cls.border,
            )}>
              <span className={cn('text-[10px] font-mono font-bold', cls.color)}>
                {topic.magnitude_class}
              </span>
              <span className="text-[9px] font-mono text-surface-500">#{rank}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                cls.bg, cls.color, cls.border,
              )}>
                <Activity className="h-2.5 w-2.5" />
                {cls.label} · {topic.magnitude_score}
              </span>
              {topic.status === 'law' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/15 text-gold border border-gold/30">
                  <Gavel className="h-2.5 w-2.5" />
                  LAW
                </span>
              )}
              {topic.category && catStyle && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                  catStyle.bg, catStyle.text, catStyle.border,
                )}>
                  {CatIcon && <CatIcon className="h-2.5 w-2.5" />}
                  {topic.category}
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-gold transition-colors">
              {topic.statement}
            </p>

            {/* Magnitude bar */}
            <div className="relative h-1.5 bg-surface-300 rounded-full mb-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${topic.magnitude_score}%` }}
                transition={{ duration: 0.6, delay: rank * 0.03, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: cls.barColor }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                <Scale className="h-3 w-3" />
                {topic.total_votes.toLocaleString()} votes
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-for-400">
                <ThumbsUp className="h-3 w-3" />
                {forPct}%
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-against-400">
                <ThumbsDown className="h-3 w-3" />
                {agPct}%
              </span>
              {topic.arg_count > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-purple">
                  <MessageSquare className="h-3 w-3" />
                  {topic.arg_count} arg{topic.arg_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: MagnitudeStats }) {
  const classes = ['M5', 'M4', 'M3', 'M2', 'M1'] as const
  const total = stats.total_topics

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
          Magnitude Distribution · {total} topics
        </span>
        <span className="text-xs font-mono text-surface-500">
          avg score: <span className="text-white">{stats.avg_score}</span>
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {classes.map((cls) => {
          const count = stats.class_distribution[cls] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct < 0.5) return null
          return (
            <div
              key={cls}
              style={{ width: `${pct}%`, backgroundColor: CLASS_CONFIG[cls].barColor }}
              title={`${cls}: ${count} topics`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {classes.map((cls) => {
          const count = stats.class_distribution[cls] ?? 0
          if (count === 0) return null
          const cfg = CLASS_CONFIG[cls]
          return (
            <div key={cls} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.barColor }} />
              <span className={cn('text-[10px] font-mono', cfg.color)}>
                {cls} · {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MagnitudeClient() {
  const [data, setData] = useState<MagnitudeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCatFilter, setShowCatFilter] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/magnitude?${params}`)
      if (!res.ok) throw new Error('Failed to load magnitude data')
      const json = (await res.json()) as MagnitudeResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const STATUS_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'voting', label: 'Voting' },
    { id: 'law', label: 'Law' },
    { id: 'proposed', label: 'Proposed' },
  ]

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">

          {/* Header */}
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-against-500/15 border border-against-500/30 flex items-center justify-center">
                <Activity className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">Civic Magnitude</h1>
                <p className="text-sm text-surface-500 font-mono">Democratic impact · vote mass × consensus force × argument depth</p>
              </div>
            </div>

            {/* Explainer */}
            <div className="mt-3 p-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-400 leading-relaxed">
              <span className="text-surface-300 font-semibold">How it works: </span>
              Magnitude Score = vote volume (40%) + consensus force (35%) + argument density (25%).
              Topics with high votes, decisive consensus, and rich arguments score highest.
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {STATUS_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                    statusFilter === id
                      ? id === 'law'
                        ? 'bg-gold/20 text-gold border-gold/40'
                        : id === 'voting'
                          ? 'bg-purple/20 text-purple border-purple/40'
                          : id === 'active'
                            ? 'bg-for-500/20 text-for-300 border-for-500/40'
                            : 'bg-surface-300 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}

              <button
                onClick={() => setShowCatFilter((v) => !v)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  showCatFilter || categoryFilter
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white',
                )}
              >
                {categoryFilter ?? 'Category'}
              </button>
            </div>

            <AnimatePresence>
              {showCatFilter && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                      onClick={() => { setCategoryFilter(null); setShowCatFilter(false) }}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                        !categoryFilter
                          ? 'bg-surface-300 text-white border-surface-400'
                          : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white',
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => {
                      const style = CATEGORY_COLOR[cat]
                      const Icon = CATEGORY_ICON[cat]
                      return (
                        <button
                          key={cat}
                          onClick={() => { setCategoryFilter(cat); setShowCatFilter(false) }}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                            categoryFilter === cat
                              ? cn(style.bg, style.text, style.border)
                              : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white',
                          )}
                        >
                          {Icon && <Icon className="h-2.5 w-2.5" />}
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stats distribution bar */}
          {!loading && data && <StatsBar stats={data.stats} />}

          {/* Content */}
          {loading && <MagnitudeSkeleton />}

          {error && (
            <EmptyState
              icon={Activity}
              title="Magnitude unavailable"
              description={error}
              actions={[{ label: 'Try again', onClick: load }]}
            />
          )}

          {!loading && !error && data && data.topics.length === 0 && (
            <EmptyState
              icon={Activity}
              title="No topics match"
              description="Try adjusting your filters to see more topics."
              action={{ label: 'Reset filters', onClick: () => { setCategoryFilter(null); setStatusFilter('all') } }}
            />
          )}

          {!loading && !error && data && data.topics.length > 0 && (
            <div className="space-y-3">
              {data.topics.map((topic, i) => (
                <TopicCard key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </div>
          )}

          {/* Refresh */}
          {!loading && (
            <div className="flex justify-center pt-6">
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors font-mono"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
