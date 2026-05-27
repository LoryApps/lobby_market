'use client'

/**
 * /pendulum — The Civic Opinion Arc
 *
 * A line-chart visualization showing how each debate's FOR% evolved
 * day-by-day from proposal through to resolution (law or failed).
 *
 * Each line represents one topic — blue lines became law, red lines failed.
 * The x-axis is days since the topic was proposed, the y-axis is FOR%.
 * The 50% line is the "consensus threshold" boundary.
 *
 * Distinct from:
 *   /flip          — shows final dramatic reversals, not the journey
 *   /shifts        — shows current vote-split changes, not historical arcs
 *   /convergence   — shows current convergence trajectory, not full history
 *   /drift         — category-level drift, not per-topic arcs
 *   /topic/[id]/timeline — topic-specific milestones, not vote-arc chart
 *
 * This is the only view showing the full vote-trajectory arc for multiple
 * resolved topics simultaneously.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  ChevronDown,
  Cpu,
  FlaskConical,
  Gavel,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ArcsResponse, TopicArc, ArcPoint } from '@/app/api/topics/arcs/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Education', 'Environment',
]

const CATEGORY_ICON: Record<string, typeof Globe> = {
  Politics:    Landmark,
  Economics:   BarChart2,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Sparkles,
  Culture:     Music2,
  Health:      Heart,
  Education:   GraduationCap,
  Environment: Leaf,
}

const CATEGORY_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-purple',
  Culture:     'text-against-400',
  Health:      'text-emerald',
  Education:   'text-gold',
  Environment: 'text-emerald',
}

// ─── Arc chart (pure SVG) ─────────────────────────────────────────────────────

const CHART_W = 520
const CHART_H = 220
const PAD = { top: 16, right: 16, bottom: 32, left: 40 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

function arcToPath(arc: ArcPoint[], daysRange: number): string {
  if (arc.length === 0) return ''

  const baseDay = new Date(arc[0].day).getTime()
  const totalMs = daysRange * 86_400_000

  const pts = arc.map((pt) => {
    const ms = new Date(pt.day).getTime() - baseDay
    const x = PAD.left + (totalMs > 0 ? (ms / totalMs) * PLOT_W : 0)
    const y = PAD.top + PLOT_H - ((pt.pct - 0) / 100) * PLOT_H
    return [x, y] as [number, number]
  })

  if (pts.length === 1) {
    const [x, y] = pts[0]
    return `M ${x} ${y} L ${x + 2} ${y}`
  }

  return pts.reduce((d, [x, y], i) => {
    return i === 0 ? `M ${x} ${y}` : `${d} L ${x} ${y}`
  }, '')
}

function ArcChart({ topics, activeId }: { topics: TopicArc[]; activeId: string | null }) {
  if (topics.length === 0) return null

  // Determine common x-axis range (max days from any topic)
  const daysRange = Math.max(
    1,
    ...topics.map((t) => {
      if (t.arc.length < 2) return 1
      const first = new Date(t.arc[0].day).getTime()
      const last = new Date(t.arc[t.arc.length - 1].day).getTime()
      return Math.ceil((last - first) / 86_400_000)
    })
  )

  const yTicks = [0, 25, 50, 75, 100]
  const xTickCount = Math.min(5, daysRange + 1)
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i / (xTickCount - 1)) * daysRange)
  )

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full"
      aria-label="Topic vote arc chart"
    >
      {/* Grid lines */}
      {yTicks.map((pct) => {
        const y = PAD.top + PLOT_H - (pct / 100) * PLOT_H
        return (
          <g key={pct}>
            <line
              x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y}
              stroke={pct === 50 ? '#4b5563' : '#374151'}
              strokeWidth={pct === 50 ? 1.5 : 0.75}
              strokeDasharray={pct === 50 ? '4 3' : undefined}
            />
            <text
              x={PAD.left - 6} y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
              fontFamily="monospace"
            >
              {pct}%
            </text>
          </g>
        )
      })}

      {/* X axis ticks */}
      {xTicks.map((d) => {
        const x = PAD.left + (d / daysRange) * PLOT_W
        return (
          <g key={d}>
            <line x1={x} y1={PAD.top + PLOT_H} x2={x} y2={PAD.top + PLOT_H + 4} stroke="#374151" strokeWidth={0.75} />
            <text x={x} y={PAD.top + PLOT_H + 14} textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="monospace">
              {d === 0 ? 'day 0' : `d${d}`}
            </text>
          </g>
        )
      })}

      {/* Topic arcs */}
      {topics.map((topic) => {
        if (topic.arc.length === 0) return null
        const isLaw = topic.status === 'law'
        const isActive = activeId === topic.id
        const opacity = activeId ? (isActive ? 1 : 0.15) : 0.75
        const strokeW = isActive ? 2.5 : 1.5

        const path = arcToPath(topic.arc, daysRange)
        const stroke = isLaw ? '#3b82f6' : '#ef4444'

        const last = topic.arc[topic.arc.length - 1]
        const lastMs = last ? new Date(last.day).getTime() - new Date(topic.arc[0].day).getTime() : 0
        const lastX = PAD.left + (daysRange > 0 ? (lastMs / (daysRange * 86_400_000)) * PLOT_W : 0)
        const lastY = PAD.top + PLOT_H - ((last?.pct ?? 50) / 100) * PLOT_H

        return (
          <g key={topic.id} style={{ opacity }}>
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* End dot */}
            <circle cx={lastX} cy={lastY} r={isActive ? 4 : 3} fill={stroke} />
          </g>
        )
      })}

      {/* Axes */}
      <line
        x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H}
        stroke="#4b5563" strokeWidth={1}
      />
      <line
        x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H}
        stroke="#4b5563" strokeWidth={1}
      />
    </svg>
  )
}

// ─── Topic list item ──────────────────────────────────────────────────────────

function TopicRow({
  topic,
  isActive,
  onHover,
}: {
  topic: TopicArc
  isActive: boolean
  onHover: (id: string | null) => void
}) {
  const isLaw = topic.status === 'law'
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-400'
  const finalPct = Math.round(topic.final_blue_pct)

  // Compute arc "drama" — max swing from starting point
  let swingDesc = '—'
  if (topic.arc.length >= 2) {
    const start = topic.arc[0].pct
    const end = topic.arc[topic.arc.length - 1].pct
    const swing = Math.abs(end - start)
    if (swing >= 20) swingDesc = `${Math.round(swing)}pt swing`
    else swingDesc = 'steady arc'
  }

  return (
    <Link
      href={`/topic/${topic.id}`}
      onMouseEnter={() => onHover(topic.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer',
        isActive
          ? isLaw ? 'border-for-500/50 bg-for-500/10' : 'border-against-500/50 bg-against-500/10'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400'
      )}
    >
      {/* Status icon */}
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg mt-0.5',
        isLaw ? 'bg-for-500/15 border border-for-500/30' : 'bg-against-500/15 border border-against-500/30'
      )}>
        {isLaw
          ? <Gavel className="h-3.5 w-3.5 text-for-400" />
          : <Scale className="h-3.5 w-3.5 text-against-400" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white leading-snug line-clamp-2">{topic.statement}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn('text-[10px] font-mono font-semibold', catColor)}>
            {topic.category ?? 'Civic'}
          </span>
          <span className="text-[10px] font-mono text-surface-500">·</span>
          <span className="text-[10px] font-mono text-surface-500">{swingDesc}</span>
          <span className="text-[10px] font-mono text-surface-500">·</span>
          <span className={cn('text-[10px] font-mono font-semibold', isLaw ? 'text-for-300' : 'text-against-300')}>
            {finalPct}% FOR
          </span>
        </div>
      </div>

      {/* Vote bar */}
      <div className="flex-shrink-0 w-14 text-right">
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn('h-full rounded-full', isLaw ? 'bg-for-500' : 'bg-against-500')}
            style={{ width: `${finalPct}%` }}
          />
        </div>
        <p className="text-[9px] font-mono text-surface-500 mt-0.5">
          {topic.total_votes.toLocaleString()} votes
        </p>
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PendulumSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[220px] rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PendulumPage() {
  const [data, setData] = useState<ArcsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('All')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showCatMenu, setShowCatMenu] = useState(false)
  const catMenuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (cat: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = cat !== 'All' ? `?category=${encodeURIComponent(cat)}` : ''
      const res = await fetch(`/api/topics/arcs${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as ArcsResponse
      setData(json)
    } catch {
      setError('Could not load topic arcs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(category) }, [load, category])

  // Close category menu when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) {
        setShowCatMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const topics = data?.topics ?? []
  const lawCount = topics.filter((t) => t.status === 'law').length
  const failCount = topics.filter((t) => t.status === 'failed').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Activity className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Opinion Arc</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">How debates evolved over time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Category filter */}
            <div className="relative" ref={catMenuRef}>
              <button
                onClick={() => setShowCatMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-300 bg-surface-100 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                {category}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showCatMenu && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showCatMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden min-w-[140px]"
                  >
                    {CATEGORIES.map((cat) => {
                      const Icon = CATEGORY_ICON[cat]
                      return (
                        <button
                          key={cat}
                          onClick={() => { setCategory(cat); setShowCatMenu(false) }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 text-xs font-mono transition-colors text-left',
                            category === cat
                              ? 'text-white bg-surface-200'
                              : 'text-surface-400 hover:text-white hover:bg-surface-200/60'
                          )}
                        >
                          {Icon && <Icon className={cn('h-3.5 w-3.5', CATEGORY_COLOR[cat] ?? 'text-surface-500')} />}
                          {cat}
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => load(category)}
              disabled={loading}
              className="p-2 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs font-mono text-surface-500">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-6 rounded-full bg-for-500" />
            <span>Became Law</span>
            {!loading && <span className="text-for-400 font-semibold">({lawCount})</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-6 rounded-full bg-against-500" />
            <span>Failed</span>
            {!loading && <span className="text-against-400 font-semibold">({failCount})</span>}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="h-px w-5 border-t-2 border-dashed border-surface-500" />
            <span>50% line</span>
          </div>
        </div>

        {/* Main content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PendulumSkeleton />
            </motion.div>
          ) : error ? (
            <EmptyState
              icon={Activity}
              title="Couldn't load arcs"
              description={error}
              actions={[{ label: 'Retry', onClick: () => load(category) }]}
            />
          ) : topics.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No resolved topics yet"
              description="Once debates reach law or fail, their vote arcs will appear here."
              actions={[{ label: 'Browse topics', href: '/topics' }]}
            />
          ) : (
            <motion.div
              key={`data-${category}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Chart */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-mono text-surface-500">
                    Hover a topic below to highlight its arc
                  </p>
                </div>
                <ArcChart topics={topics} activeId={activeId} />
              </div>

              {/* Topic list */}
              <div>
                <h2 className="font-mono text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  {topics.length} resolved debate{topics.length !== 1 ? 's' : ''}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {topics.map((topic) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      isActive={activeId === topic.id}
                      onHover={setActiveId}
                    />
                  ))}
                </div>
              </div>

              {/* How it works */}
              <details className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden group">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none hover:bg-surface-200/40 transition-colors">
                  <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">How to read the arc chart</span>
                  <span className="text-surface-500 text-xs font-mono group-open:hidden">Show</span>
                  <span className="text-surface-500 text-xs font-mono hidden group-open:block">Hide</span>
                </summary>
                <div className="px-4 pb-4 space-y-2 text-xs font-mono text-surface-500 leading-relaxed">
                  <p><span className="text-for-400">Blue lines</span> are topics that became law. <span className="text-against-400">Red lines</span> failed to reach consensus.</p>
                  <p>The x-axis shows days elapsed from the topic&apos;s first vote. The y-axis is the running FOR% based on all votes cast up to that day.</p>
                  <p>The dashed 50% line is the boundary between FOR and AGAINST territory. Topics that crossed it multiple times were the most contested.</p>
                  <p>Hover any topic card to highlight its arc. A steep early rise that held = strong from the start. A gradual climb = built consensus over time. A line that fell below 50% = opinion turned against it.</p>
                </div>
              </details>

              {/* Related pages */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { href: '/flip', label: 'Vote Reversals', icon: Activity, color: 'text-against-400' },
                  { href: '/shifts', label: 'Current Shifts', icon: BarChart2, color: 'text-for-400' },
                  { href: '/convergence', label: 'Convergence', icon: ThumbsUp, color: 'text-emerald' },
                  { href: '/drift', label: 'Category Drift', icon: ThumbsDown, color: 'text-purple' },
                  { href: '/law', label: 'Law Codex', icon: Gavel, color: 'text-gold' },
                  { href: '/topics', label: 'All Topics', icon: Globe, color: 'text-for-300' },
                ].map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-2 rounded-lg border border-surface-300 bg-surface-100 px-3 py-2.5 hover:border-surface-400 hover:bg-surface-200/60 transition-colors group"
                    >
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', link.color)} />
                      <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors truncate">{link.label}</span>
                      <ArrowRight className="h-3 w-3 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
