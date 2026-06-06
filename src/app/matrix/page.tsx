'use client'

/**
 * /matrix — The Civic Matrix
 *
 * A 10×10 category correlation heatmap revealing the ideological fabric of
 * the Lobby. Each cell shows how aligned voters in two policy domains are:
 * do Economics voters also lean FOR on Politics topics? Are Science and
 * Technology voters ideological twins or opposites?
 *
 * Cell colour (Pearson r):
 *   Deep blue  (+1.0) — perfectly aligned: voters lean the same way in both
 *   Deep red   (−1.0) — perfectly opposed: voters take opposite sides
 *   Grey       (0.0)  — independent: no relationship between stances
 *
 * Distinct from:
 *   /correlations  — topic-to-topic pairs (not category-level)
 *   /spectrum      — topics plotted by FOR% and engagement (not cross-category)
 *   /fingerprint   — how unique YOUR votes are vs. consensus
 *   /compass       — your personal ideological axis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  Cpu,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategoryPair, MatrixResponse } from '@/app/api/stats/matrix/route'

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


const CATEGORY_LABEL_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-indigo-400',
  Culture:     'text-orange-400',
  Health:      'text-pink-400',
  Environment: 'text-lime-400',
  Education:   'text-cyan-400',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCorrelation(
  pairs: CategoryPair[],
  a: string,
  b: string
): number | null {
  if (a === b) return 1
  const pair = pairs.find(
    (p) => (p.cat_a === a && p.cat_b === b) || (p.cat_a === b && p.cat_b === a)
  )
  return pair?.correlation ?? null
}

function correlationToColor(r: number | null): string {
  if (r === null) return 'rgba(39,39,42,0.6)'  // surface-300 equivalent
  // Map −1→red, 0→transparent, +1→blue
  if (r >= 0) {
    return `rgba(59,130,246,${0.08 + r * 0.72})`   // blue
  }
  return `rgba(239,68,68,${0.08 + Math.abs(r) * 0.72})`   // red
}

function correlationLabel(r: number): { label: string; color: string } {
  if (r >= 0.7) return { label: 'Strongly aligned', color: 'text-for-300' }
  if (r >= 0.4) return { label: 'Moderately aligned', color: 'text-for-400' }
  if (r >= 0.1) return { label: 'Slightly aligned', color: 'text-surface-400' }
  if (r >= -0.1) return { label: 'Independent', color: 'text-surface-500' }
  if (r >= -0.4) return { label: 'Slightly opposed', color: 'text-against-400' }
  if (r >= -0.7) return { label: 'Moderately opposed', color: 'text-against-400' }
  return { label: 'Strongly opposed', color: 'text-against-300' }
}

function numberK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <Skeleton key={c} className="h-7 w-24 rounded-lg" />
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `80px repeat(10, 56px)` }}>
          {Array.from({ length: 11 * 11 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatrixPage() {
  const [data, setData] = useState<MatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ catA: string; catB: string } | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats/matrix')
      if (!res.ok) throw new Error(await res.text())
      const json: MatrixResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matrix')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Sorted categories (use fixed order for consistent axes)
  const categories = data?.categories ?? CATEGORIES

  // Compute strongest / weakest correlations for the summary
  const sortedPairs = [...(data?.pairs ?? [])].sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  )
  const topAligned = sortedPairs.filter((p) => p.correlation > 0).slice(0, 3)
  const topOpposed = sortedPairs.filter((p) => p.correlation < 0).slice(0, 3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start gap-4">
          <Link
            href="/correlations"
            className="mt-0.5 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:bg-surface-200 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-mono font-bold text-white">The Civic Matrix</h1>
              <button
                onClick={() => setShowGuide((s) => !s)}
                className="h-6 w-6 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 transition-colors"
              >
                <Info className="h-3.5 w-3.5 text-surface-400" />
              </button>
            </div>
            <p className="text-sm font-mono text-surface-400">
              How do voter stances align across policy domains?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ─── Guide ───────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 rounded-2xl bg-surface-100 border border-surface-300 p-4"
            >
              <h3 className="text-xs font-mono font-semibold text-white uppercase tracking-widest mb-3">
                How to read this
              </h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    color: 'bg-for-500/30 border-for-500/40',
                    title: 'Blue cells',
                    desc: 'Voters in these two domains tend to take the same side. Strong blue means near-perfect ideological alignment.',
                  },
                  {
                    color: 'bg-against-500/30 border-against-500/40',
                    title: 'Red cells',
                    desc: 'Voters tend to take opposing sides. If you lean FOR in one, you probably lean AGAINST in the other.',
                  },
                  {
                    color: 'bg-surface-300/50 border-surface-400/30',
                    title: 'Grey cells',
                    desc: 'Too few shared voters to compute, or stances are statistically independent (near-zero correlation).',
                  },
                ].map((item) => (
                  <div key={item.title} className={cn('rounded-xl border p-3', item.color)}>
                    <p className="text-xs font-mono font-semibold text-white mb-1">{item.title}</p>
                    <p className="text-xs text-surface-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-mono text-surface-600 mt-3">
                Metric: Pearson correlation of each voter&apos;s average FOR-fraction in each category pair.
                Requires ≥5 users who voted in both domains.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Loading ─────────────────────────────────────────────────────── */}
        {loading && <MatrixSkeleton />}

        {/* ─── Error ───────────────────────────────────────────────────────── */}
        {error && !loading && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load matrix"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* ─── Matrix ──────────────────────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Category stat strip */}
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => {
                const stat = data.stats.find((s) => s.category === cat)
                if (!stat) return null
                const Icon = CATEGORY_ICON[cat] ?? BarChart2
                const labelColor = CATEGORY_LABEL_COLOR[cat] ?? 'text-surface-400'
                return (
                  <div
                    key={cat}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 border border-surface-300 text-xs font-mono"
                  >
                    <Icon className={cn('h-3 w-3 flex-shrink-0', labelColor)} />
                    <span className={labelColor}>{cat}</span>
                    <span className="text-surface-600">·</span>
                    <span className="text-surface-400">{Math.round(stat.avg_blue_pct)}% FOR</span>
                  </div>
                )
              })}
            </div>

            {/* Heatmap grid */}
            <div className="overflow-x-auto pb-2">
              <div className="relative" style={{ minWidth: 640 }}>
                {/* Column headers */}
                <div
                  className="grid mb-1"
                  style={{ gridTemplateColumns: `96px repeat(${categories.length}, 1fr)` }}
                >
                  <div />
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICON[cat] ?? BarChart2
                    const labelColor = CATEGORY_LABEL_COLOR[cat] ?? 'text-surface-400'
                    return (
                      <div
                        key={cat}
                        className="flex flex-col items-center gap-0.5 pb-1"
                        title={cat}
                      >
                        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', labelColor)} />
                        <span
                          className={cn(
                            'text-[9px] font-mono font-semibold leading-tight text-center',
                            labelColor
                          )}
                          style={{ writingMode: 'horizontal-tb' }}
                        >
                          {cat.slice(0, 4).toUpperCase()}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Rows */}
                {categories.map((rowCat) => {
                  const Icon = CATEGORY_ICON[rowCat] ?? BarChart2
                  const labelColor = CATEGORY_LABEL_COLOR[rowCat] ?? 'text-surface-400'
                  return (
                    <div
                      key={rowCat}
                      className="grid mb-0.5"
                      style={{ gridTemplateColumns: `96px repeat(${categories.length}, 1fr)` }}
                    >
                      {/* Row label */}
                      <div className="flex items-center gap-1.5 pr-2">
                        <Icon className={cn('h-3 w-3 flex-shrink-0', labelColor)} />
                        <span className={cn('text-[10px] font-mono font-semibold truncate', labelColor)}>
                          {rowCat.slice(0, 5)}
                        </span>
                      </div>

                      {/* Cells */}
                      {categories.map((colCat) => {
                        const r = getCorrelation(data.pairs, rowCat, colCat)
                        const isDiag = rowCat === colCat
                        const isSelected =
                          selected?.catA === rowCat && selected?.catB === colCat

                        return (
                          <button
                            key={colCat}
                            onClick={() =>
                              setSelected(
                                isSelected ? null : { catA: rowCat, catB: colCat }
                              )
                            }
                            className={cn(
                              'relative h-10 rounded-sm transition-all duration-150 border',
                              isDiag
                                ? 'cursor-default'
                                : 'cursor-pointer hover:ring-1 hover:ring-white/20',
                              isSelected && !isDiag
                                ? 'ring-1 ring-white/40'
                                : 'ring-0'
                            )}
                            style={{
                              backgroundColor: isDiag
                                ? 'rgba(63,63,70,0.5)'
                                : correlationToColor(r),
                              borderColor:
                                isDiag
                                  ? 'rgba(82,82,91,0.6)'
                                  : r === null
                                  ? 'rgba(63,63,70,0.4)'
                                  : r > 0
                                  ? `rgba(59,130,246,${0.15 + Math.abs(r) * 0.35})`
                                  : `rgba(239,68,68,${0.15 + Math.abs(r) * 0.35})`,
                            }}
                            disabled={isDiag}
                            title={
                              isDiag
                                ? rowCat
                                : r !== null
                                ? `${rowCat} × ${colCat}: ${r >= 0 ? '+' : ''}${r.toFixed(2)}`
                                : `${rowCat} × ${colCat}: no data`
                            }
                          >
                            {isDiag ? (
                              <span className="text-[9px] font-mono text-surface-500 leading-none px-0.5">
                                {rowCat.slice(0, 3).toUpperCase()}
                              </span>
                            ) : r !== null ? (
                              <span
                                className={cn(
                                  'text-[10px] font-mono font-bold',
                                  Math.abs(r) > 0.3
                                    ? r > 0
                                      ? 'text-for-200'
                                      : 'text-against-200'
                                    : 'text-surface-500'
                                )}
                              >
                                {r >= 0 ? '+' : ''}{r.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-surface-700">—</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Legend */}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[10px] font-mono text-surface-600">−1.0</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{
                      background: 'linear-gradient(to right, rgba(239,68,68,0.8), rgba(39,39,42,0.5), rgba(59,130,246,0.8))'
                    }}
                  />
                  <span className="text-[10px] font-mono text-surface-600">+1.0</span>
                  <div className="flex items-center gap-1 ml-2">
                    <div className="h-2.5 w-2.5 rounded-sm bg-surface-300/50 border border-surface-400/30" />
                    <span className="text-[10px] font-mono text-surface-600">No data</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─ Detail panel for selected pair ──────────────────────────── */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  key={`${selected.catA}-${selected.catB}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  {(() => {
                    const r = getCorrelation(data.pairs, selected.catA, selected.catB)
                    const pairData = data.pairs.find(
                      (p) =>
                        (p.cat_a === selected.catA && p.cat_b === selected.catB) ||
                        (p.cat_a === selected.catB && p.cat_b === selected.catA)
                    )
                    const statA = data.stats.find((s) => s.category === selected.catA)
                    const statB = data.stats.find((s) => s.category === selected.catB)
                    const IconA = CATEGORY_ICON[selected.catA] ?? BarChart2
                    const IconB = CATEGORY_ICON[selected.catB] ?? BarChart2
                    const colorA = CATEGORY_LABEL_COLOR[selected.catA] ?? 'text-surface-400'
                    const colorB = CATEGORY_LABEL_COLOR[selected.catB] ?? 'text-surface-400'

                    const isDiag = selected.catA === selected.catB
                    if (isDiag) {
                      const stat = statA
                      return (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <IconA className={cn('h-4 w-4', colorA)} />
                            <span className={cn('font-mono font-semibold', colorA)}>{selected.catA}</span>
                          </div>
                          {stat && (
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: 'Topics', value: stat.topic_count },
                                { label: 'Total votes', value: numberK(stat.total_votes) },
                                { label: 'Laws passed', value: stat.law_count },
                              ].map(({ label, value }) => (
                                <div key={label} className="bg-surface-200 rounded-xl p-3 text-center">
                                  <div className="text-lg font-mono font-bold text-white">{value}</div>
                                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <Link
                            href={`/categories/${selected.catA}`}
                            className="flex items-center gap-1 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                          >
                            Browse {selected.catA} topics <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )
                    }

                    const { label: corrLabel, color: corrColor } = r !== null
                      ? correlationLabel(r)
                      : { label: 'Insufficient data', color: 'text-surface-500' }

                    return (
                      <div className="flex flex-col gap-4">
                        {/* Pair header */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <IconA className={cn('h-4 w-4', colorA)} />
                            <span className={cn('font-mono font-semibold text-sm', colorA)}>
                              {selected.catA}
                            </span>
                          </div>
                          <span className="text-surface-600 font-mono">×</span>
                          <div className="flex items-center gap-1.5">
                            <IconB className={cn('h-4 w-4', colorB)} />
                            <span className={cn('font-mono font-semibold text-sm', colorB)}>
                              {selected.catB}
                            </span>
                          </div>
                          {r !== null && (
                            <span className={cn(
                              'ml-auto text-lg font-mono font-bold',
                              r > 0 ? 'text-for-400' : r < 0 ? 'text-against-400' : 'text-surface-400'
                            )}>
                              {r >= 0 ? '+' : ''}{r.toFixed(3)}
                            </span>
                          )}
                        </div>

                        {/* Verdict */}
                        <div className={cn(
                          'rounded-xl border px-4 py-3',
                          r !== null && r > 0.2
                            ? 'bg-for-500/10 border-for-500/30'
                            : r !== null && r < -0.2
                            ? 'bg-against-500/10 border-against-500/30'
                            : 'bg-surface-200 border-surface-300'
                        )}>
                          <p className={cn('text-sm font-mono font-semibold', corrColor)}>
                            {corrLabel}
                          </p>
                          {r !== null && (
                            <p className="text-xs text-surface-400 mt-1">
                              {r > 0.5
                                ? `Citizens who lean FOR on ${selected.catA} topics strongly tend to lean FOR on ${selected.catB} topics too — these domains attract like-minded voters.`
                                : r > 0.1
                                ? `There's a mild tendency for voters to align across these two domains, but significant independence remains.`
                                : r < -0.5
                                ? `Citizens who lean FOR on ${selected.catA} topics strongly tend to lean AGAINST on ${selected.catB} topics — a classic ideological fault line.`
                                : r < -0.1
                                ? `There's a mild opposing tendency between these domains — voters slightly diverge on average.`
                                : `Voting patterns in these two domains are statistically independent — knowing a voter’s ${selected.catA} stance tells you little about their ${selected.catB} stance.`}
                            </p>
                          )}
                          {r === null && (
                            <p className="text-xs text-surface-400 mt-1">
                              Not enough citizens have voted in both domains to compute a reliable correlation.
                            </p>
                          )}
                        </div>

                        {/* Stats grid */}
                        {(statA || statB) && (
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { stat: statA, cat: selected.catA, color: colorA, Icon: IconA },
                              { stat: statB, cat: selected.catB, color: colorB, Icon: IconB },
                            ].map(({ stat, cat, color, Icon: CatIcon }) => stat ? (
                              <div key={cat} className="bg-surface-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <CatIcon className={cn('h-3.5 w-3.5', color)} />
                                  <span className={cn('text-xs font-mono font-semibold', color)}>{cat}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Topics', value: stat.topic_count },
                                    { label: 'Laws', value: stat.law_count },
                                    { label: 'Avg FOR%', value: `${Math.round(stat.avg_blue_pct)}%` },
                                    { label: 'Law rate', value: `${Math.round(stat.law_rate * 100)}%` },
                                  ].map(({ label, value }) => (
                                    <div key={label}>
                                      <div className="text-sm font-mono font-bold text-white">{value}</div>
                                      <div className="text-[10px] font-mono text-surface-500">{label}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-for-500"
                                    style={{ width: `${stat.avg_blue_pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : null)}
                          </div>
                        )}

                        {pairData && pairData.shared_voters > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                            <Users className="h-3.5 w-3.5" />
                            <span>{pairData.shared_voters.toLocaleString()} shared voters analyzed</span>
                          </div>
                        )}

                        {/* Links */}
                        <div className="flex gap-3 flex-wrap">
                          <Link
                            href={`/categories/${selected.catA}`}
                            className="flex items-center gap-1 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                          >
                            {selected.catA} topics <ChevronRight className="h-3 w-3" />
                          </Link>
                          <Link
                            href={`/categories/${selected.catB}`}
                            className="flex items-center gap-1 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                          >
                            {selected.catB} topics <ChevronRight className="h-3 w-3" />
                          </Link>
                          <Link
                            href="/correlations"
                            className="flex items-center gap-1 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                          >
                            Topic-level correlations <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    )
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─ Summary rows ───────────────────────────────────────────────── */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Most aligned */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-300/50 bg-for-500/5">
                  <h3 className="text-xs font-mono font-semibold text-for-400 uppercase tracking-widest">
                    Most Aligned Pairs
                  </h3>
                </div>
                <div className="divide-y divide-surface-300/50">
                  {topAligned.length === 0 ? (
                    <p className="px-4 py-6 text-xs font-mono text-surface-600 text-center">
                      Not enough data yet
                    </p>
                  ) : topAligned.map((pair) => {
                    const IconA = CATEGORY_ICON[pair.cat_a] ?? BarChart2
                    const IconB = CATEGORY_ICON[pair.cat_b] ?? BarChart2
                    const colorA = CATEGORY_LABEL_COLOR[pair.cat_a] ?? 'text-surface-400'
                    const colorB = CATEGORY_LABEL_COLOR[pair.cat_b] ?? 'text-surface-400'
                    return (
                      <button
                        key={`${pair.cat_a}-${pair.cat_b}`}
                        onClick={() => setSelected({ catA: pair.cat_a, catB: pair.cat_b })}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-200/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-1">
                          <IconA className={cn('h-3.5 w-3.5', colorA)} />
                          <span className={cn('text-xs font-mono', colorA)}>{pair.cat_a}</span>
                        </div>
                        <span className="text-surface-600 text-xs">×</span>
                        <div className="flex items-center gap-1">
                          <IconB className={cn('h-3.5 w-3.5', colorB)} />
                          <span className={cn('text-xs font-mono', colorB)}>{pair.cat_b}</span>
                        </div>
                        <span className="ml-auto text-xs font-mono font-bold text-for-400">
                          +{pair.correlation.toFixed(3)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Most opposed */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-300/50 bg-against-500/5">
                  <h3 className="text-xs font-mono font-semibold text-against-400 uppercase tracking-widest">
                    Most Opposed Pairs
                  </h3>
                </div>
                <div className="divide-y divide-surface-300/50">
                  {topOpposed.length === 0 ? (
                    <p className="px-4 py-6 text-xs font-mono text-surface-600 text-center">
                      Not enough data yet
                    </p>
                  ) : topOpposed.map((pair) => {
                    const IconA = CATEGORY_ICON[pair.cat_a] ?? BarChart2
                    const IconB = CATEGORY_ICON[pair.cat_b] ?? BarChart2
                    const colorA = CATEGORY_LABEL_COLOR[pair.cat_a] ?? 'text-surface-400'
                    const colorB = CATEGORY_LABEL_COLOR[pair.cat_b] ?? 'text-surface-400'
                    return (
                      <button
                        key={`${pair.cat_a}-${pair.cat_b}`}
                        onClick={() => setSelected({ catA: pair.cat_a, catB: pair.cat_b })}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-200/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-1">
                          <IconA className={cn('h-3.5 w-3.5', colorA)} />
                          <span className={cn('text-xs font-mono', colorA)}>{pair.cat_a}</span>
                        </div>
                        <span className="text-surface-600 text-xs">×</span>
                        <div className="flex items-center gap-1">
                          <IconB className={cn('h-3.5 w-3.5', colorB)} />
                          <span className={cn('text-xs font-mono', colorB)}>{pair.cat_b}</span>
                        </div>
                        <span className="ml-auto text-xs font-mono font-bold text-against-400">
                          {pair.correlation.toFixed(3)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ─ Category overview cards ────────────────────────────────── */}
            <div>
              <h3 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                Domain Overview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {CATEGORIES.map((cat) => {
                  const stat = data.stats.find((s) => s.category === cat)
                  const Icon = CATEGORY_ICON[cat] ?? BarChart2
                  const color = CATEGORY_LABEL_COLOR[cat] ?? 'text-surface-400'
                  if (!stat) return null
                  const leanLabel = stat.avg_blue_pct >= 60
                    ? 'FOR-leaning'
                    : stat.avg_blue_pct <= 40
                    ? 'AGAINST-leaning'
                    : 'Contested'
                  const leanColor = stat.avg_blue_pct >= 60
                    ? 'text-for-400'
                    : stat.avg_blue_pct <= 40
                    ? 'text-against-400'
                    : 'text-surface-400'
                  return (
                    <Link
                      key={cat}
                      href={`/categories/${cat}`}
                      className="rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-300 p-3 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn('h-3.5 w-3.5', color)} />
                        <span className={cn('text-xs font-mono font-semibold truncate', color)}>
                          {cat}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-for-500"
                          style={{ width: `${stat.avg_blue_pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-surface-500">{stat.topic_count} topics</span>
                        <span className={cn('text-[10px] font-mono', leanColor)}>{leanLabel}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* ─ Explore links ──────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <h3 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                Explore further
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/correlations', label: 'Topic Correlations', icon: BarChart2 },
                  { href: '/spectrum', label: 'Civic Spectrum', icon: BarChart2 },
                  { href: '/categories', label: 'Browse Categories', icon: Gavel },
                  { href: '/fingerprint', label: 'My Fingerprint', icon: BarChart2 },
                  { href: '/compass', label: 'My Compass', icon: BarChart2 },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
