'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Cpu,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ConsensusMapResponse,
  ConsensusPoint,
  CategorySummary,
} from '@/app/api/consensus-map/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BarChart2,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
  Other: Sparkles,
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-surface-600',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
  Other: 'text-surface-500',
}

// ─── Division bar ─────────────────────────────────────────────────────────────

function VoteBar({ forPct, compact = false }: { forPct: number; compact?: boolean }) {
  const against = 100 - forPct
  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'gap-1' : 'gap-2')}>
      <span className={cn('font-mono tabular-nums text-for-400', compact ? 'text-[10px]' : 'text-xs w-7 text-right')}>
        {forPct}%
      </span>
      <div className={cn('flex-1 rounded-full overflow-hidden bg-surface-300', compact ? 'h-1' : 'h-1.5')}>
        <div
          className="h-full bg-for-500 transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className={cn('font-mono tabular-nums text-against-400', compact ? 'text-[10px]' : 'text-xs w-7')}>
        {against}%
      </span>
    </div>
  )
}

// ─── Consensus spectrum bar ───────────────────────────────────────────────────

function SpectrumBar({
  strong_for, lean_for, contested, lean_against, strong_against, total,
}: {
  strong_for: number; lean_for: number; contested: number; lean_against: number; strong_against: number; total: number
}) {
  if (total === 0) return null
  const pcts = [
    { label: 'Strong For', pct: (strong_for / total) * 100, color: 'bg-for-600', text: 'text-for-300' },
    { label: 'Lean For', pct: (lean_for / total) * 100, color: 'bg-for-500/60', text: 'text-for-400' },
    { label: 'Contested', pct: (contested / total) * 100, color: 'bg-surface-400', text: 'text-surface-500' },
    { label: 'Lean Against', pct: (lean_against / total) * 100, color: 'bg-against-500/60', text: 'text-against-400' },
    { label: 'Strong Against', pct: (strong_against / total) * 100, color: 'bg-against-600', text: 'text-against-300' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
        {pcts.map((s) => (
          <motion.div
            key={s.label}
            className={cn('h-full transition-all duration-700', s.color)}
            style={{ width: `${s.pct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ delay: 0.1, duration: 0.6 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {pcts.map((s) => (
          <span key={s.label} className={cn('text-[10px] font-mono flex items-center gap-1', s.text)}>
            <span className={cn('inline-block h-2 w-2 rounded-sm', s.color)} />
            {s.label}: {Math.round(s.pct)}%
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ point, label }: { point: ConsensusPoint; label?: string }) {
  const catColor = CAT_COLOR[point.category ?? 'Other'] ?? 'text-surface-500'
  const catIcon = point.category ? CAT_ICON[point.category] ?? Sparkles : Sparkles
  const CatIcon = catIcon

  return (
    <Link
      href={`/topic/${point.topic_id}`}
      className="block rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 px-4 py-3 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {label && (
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider block mb-1">
              {label}
            </span>
          )}
          <p className="text-sm text-white group-hover:text-for-300 transition-colors line-clamp-2 leading-snug">
            {point.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <CatIcon className={cn('h-3 w-3 flex-shrink-0', catColor)} />
            <span className={cn('text-[10px]', catColor)}>{point.category ?? 'Other'}</span>
            <span className="text-[10px] text-surface-600">·</span>
            <span className="text-[10px] text-surface-500 font-mono">
              {point.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 w-24">
          <VoteBar forPct={point.for_pct} compact />
          <div className="text-center mt-1">
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
              point.division_score >= 70
                ? 'bg-against-500/15 text-against-400'
                : point.division_score <= 20
                ? 'bg-for-500/15 text-for-300'
                : 'bg-surface-300 text-surface-500'
            )}>
              {point.division_score >= 70
                ? 'Contested'
                : point.for_pct >= 70
                ? 'Consensus'
                : point.for_pct <= 30
                ? 'Rejected'
                : 'Lean'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategorySummary }) {
  const catColor = CAT_COLOR[cat.category] ?? 'text-surface-500'
  const CatIcon = CAT_ICON[cat.category] ?? Sparkles
  const divLabel = cat.avg_division >= 60 ? 'Divisive' : cat.avg_division <= 25 ? 'Unified' : 'Mixed'

  return (
    <div className="rounded-xl bg-surface-200 border border-surface-300 px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <CatIcon className={cn('h-3.5 w-3.5 flex-shrink-0', catColor)} />
          <span className={cn('text-sm font-semibold', catColor)}>{cat.category}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-[10px] font-mono text-surface-500 block">{cat.topic_count} topics</span>
          <span className={cn(
            'text-[10px] font-mono',
            cat.avg_division >= 60 ? 'text-against-400' : 'text-emerald'
          )}>
            {divLabel}
          </span>
        </div>
      </div>
      <VoteBar forPct={cat.avg_for_pct} compact />
      <div className="mt-2 space-y-1">
        {cat.most_unified_topic && (
          <p className="text-[10px] text-surface-600 line-clamp-1">
            <ThumbsUp className="h-2.5 w-2.5 text-emerald inline mr-1" />
            {cat.most_unified_topic}
          </p>
        )}
        {cat.most_divided_topic && (
          <p className="text-[10px] text-surface-600 line-clamp-1">
            <Scale className="h-2.5 w-2.5 text-against-400 inline mr-1" />
            {cat.most_divided_topic}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-5 w-full rounded-full mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-36 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ConsensusMapClient() {
  const [data, setData] = useState<ConsensusMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'unified' | 'divided' | 'near_law'>('divided')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/consensus-map')
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError('Failed to load the consensus map. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const cardClass = 'rounded-2xl bg-surface-100 border border-surface-300 p-5'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white font-mono">Consensus Map</h1>
          </div>
          <p className="text-sm text-surface-500">
            Where the Lobby agrees and where it divides — every active debate mapped by consensus strength.
          </p>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 text-sm text-for-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : data && (
          <AnimatePresence mode="wait">
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* Spectrum overview */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cardClass}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-purple" />
                    Consensus Spectrum
                  </h2>
                  <span className="text-xs font-mono text-surface-500">
                    {data.overview.total_topics} topics
                  </span>
                </div>

                <SpectrumBar
                  strong_for={data.overview.strong_for}
                  lean_for={data.overview.lean_for}
                  contested={data.overview.contested}
                  lean_against={data.overview.lean_against}
                  strong_against={data.overview.strong_against}
                  total={data.overview.total_topics}
                />

                {/* Stat pills */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-xl bg-for-500/10 border border-for-500/20 px-3 py-2 text-center">
                    <ThumbsUp className="h-4 w-4 text-for-400 mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-for-300">
                      {data.overview.avg_for_pct}%
                    </p>
                    <p className="text-[10px] text-surface-500">Avg FOR</p>
                  </div>
                  <div className="rounded-xl bg-surface-200 border border-surface-300 px-3 py-2 text-center">
                    <Scale className="h-4 w-4 text-surface-500 mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-white">
                      {data.overview.contested}
                    </p>
                    <p className="text-[10px] text-surface-500">Contested</p>
                  </div>
                  <div className="rounded-xl bg-emerald/10 border border-emerald/20 px-3 py-2 text-center">
                    <Gavel className="h-4 w-4 text-emerald mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-emerald">
                      {data.trending_toward_law.length}
                    </p>
                    <p className="text-[10px] text-surface-500">Near Law</p>
                  </div>
                </div>
              </motion.div>

              {/* Category breakdown */}
              {data.categories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={cardClass}
                >
                  <h2 className="text-sm font-mono font-semibold text-white mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" />
                    By Category
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.categories.map((cat) => (
                      <CategoryCard key={cat.category} cat={cat} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Topic lists */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cardClass}
              >
                {/* Tab bar */}
                <div className="flex gap-2 mb-4 border-b border-surface-300 pb-3">
                  {([
                    { id: 'divided' as const, label: 'Most Divided', icon: Scale },
                    { id: 'unified' as const, label: 'Most Unified', icon: ThumbsUp },
                    { id: 'near_law' as const, label: 'Near Law', icon: Gavel },
                  ]).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
                        tab === id
                          ? 'bg-for-600/20 border border-for-600/40 text-for-300'
                          : 'text-surface-500 hover:text-white'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'divided' && (
                  <div className="space-y-2">
                    {data.divided.map((p, i) => (
                      <motion.div key={p.topic_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                        <TopicRow point={p} />
                      </motion.div>
                    ))}
                    {data.divided.length === 0 && (
                      <p className="text-sm text-surface-500 text-center py-4">No contested topics found.</p>
                    )}
                  </div>
                )}

                {tab === 'unified' && (
                  <div className="space-y-2">
                    {data.unified.map((p, i) => (
                      <motion.div key={p.topic_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                        <TopicRow point={p} />
                      </motion.div>
                    ))}
                    {data.unified.length === 0 && (
                      <p className="text-sm text-surface-500 text-center py-4">No strongly unified topics found yet.</p>
                    )}
                  </div>
                )}

                {tab === 'near_law' && (
                  <div className="space-y-2">
                    {data.trending_toward_law.length === 0 ? (
                      <div className="text-center py-6">
                        <Gavel className="h-8 w-8 text-surface-500 mx-auto mb-2" />
                        <p className="text-sm text-surface-500">No topics currently trending toward law.</p>
                        <p className="text-xs text-surface-600 mt-1">Topics with 70%+ FOR in voting phase appear here.</p>
                      </div>
                    ) : (
                      data.trending_toward_law.map((p, i) => (
                        <motion.div key={p.topic_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                          <TopicRow point={p} label="Trending to Law" />
                        </motion.div>
                      ))
                    )}
                    <p className="text-xs text-surface-600 text-center mt-2 pt-3 border-t border-surface-300">
                      <Link href="/law" className="text-for-400 hover:underline">View established laws</Link>
                      {' · '}
                      <Link href="/flux" className="text-for-400 hover:underline">See opinion shifts</Link>
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Footer links */}
              <div className="flex items-center justify-center gap-6 text-xs text-surface-600">
                <Link href="/topics" className="hover:text-white transition-colors flex items-center gap-1">
                  All Topics <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/civic-twins" className="hover:text-white transition-colors flex items-center gap-1">
                  Your Civic Twins <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/compare" className="hover:text-white transition-colors flex items-center gap-1">
                  Compare Topics <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <button
                onClick={load}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh data
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
