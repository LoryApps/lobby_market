'use client'

/**
 * /tags/radar — Tag Engagement Radar
 *
 * A polar/spider chart comparing up to 8 of your followed tags across
 * 6 engagement dimensions:
 *   Scale       — how many debates carry this tag
 *   Governance  — law-passage rate (debates that became law)
 *   Activity    — currently live/voting debates
 *   Engagement  — total vote volume
 *   Freshness   — new debates added this week
 *   Polarisation— average margin of debate (how contested the tag is)
 *
 * Distinct from:
 *   /tags         — global tag cloud by volume
 *   /tags/my-tags — digest of followed-tag activity
 *   /tags/compare — side-by-side stats for two tags
 *   /tags/graph   — co-occurrence network graph
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Circle,
  Gavel,
  Hash,
  Loader2,
  RefreshCw,
  Tag,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TagRadarEntry, TagRadarResponse } from '@/app/api/tags/radar/route'

// ─── Chart constants ──────────────────────────────────────────────────────────

const SIZE = 340
const CENTER = SIZE / 2
const MAX_R = CENTER - 52

const AXES: { key: keyof TagRadarEntry['dimensions']; label: string; icon: string }[] = [
  { key: 'scale',        label: 'Scale',        icon: '⚖' },
  { key: 'governance',   label: 'Governance',   icon: '⚖' },
  { key: 'activity',     label: 'Activity',     icon: '⚡' },
  { key: 'engagement',   label: 'Engagement',   icon: '🗳' },
  { key: 'freshness',    label: 'Freshness',    icon: '✨' },
  { key: 'polarisation', label: 'Polarisation', icon: '⚔' },
]

const N = AXES.length
const ANGLE_STEP = 360 / N

const TAG_COLORS = [
  { stroke: '#3b82f6', fill: '#3b82f620', text: 'text-blue-400' },
  { stroke: '#f59e0b', fill: '#f59e0b20', text: 'text-amber-400' },
  { stroke: '#10b981', fill: '#10b98120', text: 'text-emerald-400' },
  { stroke: '#8b5cf6', fill: '#8b5cf620', text: 'text-violet-400' },
  { stroke: '#ef4444', fill: '#ef444420', text: 'text-red-400' },
  { stroke: '#ec4899', fill: '#ec489920', text: 'text-pink-400' },
  { stroke: '#06b6d4', fill: '#06b6d420', text: 'text-cyan-400' },
  { stroke: '#84cc16', fill: '#84cc1620', text: 'text-lime-400' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
}

function buildPolygon(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

function entryPolygon(entry: TagRadarEntry): string {
  const pts = AXES.map((ax, i) => {
    const r = (entry.dimensions[ax.key] / 100) * MAX_R
    return polarToXY(i * ANGLE_STEP, r)
  })
  return buildPolygon(pts)
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RadarSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 animate-pulse">
      <div className="w-[340px] h-[340px] rounded-full bg-surface-200" />
      <div className="flex flex-wrap gap-2 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-24 rounded-full bg-surface-200" />
        ))}
      </div>
    </div>
  )
}

// ─── Radar SVG ────────────────────────────────────────────────────────────────

interface RadarChartProps {
  entries: TagRadarEntry[]
  selected: Set<string>
  hovered: string | null
  onHover: (tag: string | null) => void
}

function RadarChart({ entries, selected, hovered, onHover }: RadarChartProps) {
  const gridRings = [0.25, 0.5, 0.75, 1.0]
  const axes = AXES.map((ax, i) => {
    const angle = i * ANGLE_STEP
    const { x, y } = polarToXY(angle, MAX_R)
    const labelPos = polarToXY(angle, MAX_R + 22)
    return { ...ax, angle, x, y, labelPos }
  })

  const visibleEntries = entries.filter((e) => selected.has(e.tag))

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-label="Tag engagement radar chart"
        className="overflow-visible"
      >
        <defs>
          {visibleEntries.map((e) => {
            const color = TAG_COLORS[entries.indexOf(e) % TAG_COLORS.length]
            return (
              <radialGradient key={e.tag} id={`fill-${e.tag}`} cx="50%" cy="50%">
                <stop offset="0%" stopColor={color.stroke} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color.stroke} stopOpacity="0.08" />
              </radialGradient>
            )
          })}
        </defs>

        {/* Grid rings */}
        {gridRings.map((pct) => {
          const pts = AXES.map((_, i) => polarToXY(i * ANGLE_STEP, MAX_R * pct))
          return (
            <polygon
              key={pct}
              points={buildPolygon(pts)}
              fill="none"
              stroke={pct === 0.5 ? '#3f3f4a' : '#24242e'}
              strokeWidth={pct === 0.5 ? 1.5 : 0.75}
              strokeDasharray={pct === 0.5 ? '4 3' : undefined}
            />
          )
        })}

        {/* Axis lines */}
        {axes.map((ax) => (
          <line
            key={ax.key}
            x1={CENTER}
            y1={CENTER}
            x2={ax.x}
            y2={ax.y}
            stroke="#2a2a35"
            strokeWidth={0.75}
          />
        ))}

        {/* Data polygons */}
        {visibleEntries.map((e) => {
          const colorIdx = entries.indexOf(e) % TAG_COLORS.length
          const color = TAG_COLORS[colorIdx]
          const poly = entryPolygon(e)
          const isHovered = hovered === e.tag
          return (
            <g key={e.tag}>
              <motion.polygon
                points={poly}
                fill={`url(#fill-${e.tag})`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: isHovered ? 0.6 : 0.35, scale: 1 }}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                onMouseEnter={() => onHover(e.tag)}
                onMouseLeave={() => onHover(null)}
                className="cursor-pointer"
              />
              <motion.polygon
                points={poly}
                fill="none"
                stroke={color.stroke}
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeLinejoin="round"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                onMouseEnter={() => onHover(e.tag)}
                onMouseLeave={() => onHover(null)}
                className="cursor-pointer"
              />
              {/* Vertex dots */}
              {AXES.map((ax, i) => {
                const r = (e.dimensions[ax.key] / 100) * MAX_R
                const { x, y } = polarToXY(i * ANGLE_STEP, r)
                return (
                  <motion.circle
                    key={ax.key}
                    cx={x}
                    cy={y}
                    r={isHovered ? 4.5 : 3}
                    fill={color.stroke}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
                  />
                )
              })}
            </g>
          )
        })}

        {/* Axis labels */}
        {axes.map((ax) => {
          const anchor =
            ax.labelPos.x < CENTER - 8
              ? 'end'
              : ax.labelPos.x > CENTER + 8
                ? 'start'
                : 'middle'
          const dy = ax.labelPos.y < CENTER ? -4 : ax.labelPos.y > CENTER + 8 ? 12 : 4
          return (
            <text
              key={ax.key}
              x={ax.labelPos.x}
              y={ax.labelPos.y + dy}
              textAnchor={anchor}
              fill="#71717a"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="0.03em"
            >
              {ax.label.toUpperCase()}
            </text>
          )
        })}

        {/* Centre dot */}
        <circle cx={CENTER} cy={CENTER} r={3} fill="#3f3f4a" />

        {/* Ring labels */}
        <text
          x={CENTER + 4}
          y={CENTER - MAX_R * 0.5 - 3}
          fill="#52525b"
          fontSize="7"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="start"
        >
          50%
        </text>
        <text
          x={CENTER + 4}
          y={CENTER - MAX_R * 1.0 - 3}
          fill="#52525b"
          fontSize="7"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="start"
        >
          100%
        </text>
      </svg>
    </div>
  )
}

// ─── Stats table ──────────────────────────────────────────────────────────────

function StatsRow({ entry, colorIdx }: { entry: TagRadarEntry; colorIdx: number }) {
  const color = TAG_COLORS[colorIdx % TAG_COLORS.length]
  return (
    <div className="grid grid-cols-7 items-center gap-1 text-xs font-mono py-2 border-b border-surface-300/40 last:border-0">
      <div className="col-span-2 flex items-center gap-1.5 min-w-0">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color.stroke }}
        />
        <Link
          href={`/tags/${encodeURIComponent(entry.tag)}`}
          className="text-white hover:text-for-300 transition-colors truncate font-semibold"
        >
          #{entry.tag}
        </Link>
      </div>
      <div className="text-center text-surface-500">{entry.raw.topic_count}</div>
      <div className="text-center text-emerald-400">{entry.raw.law_count}</div>
      <div className="text-center text-purple-400">{entry.raw.active_count}</div>
      <div className="text-center text-for-400">{formatNumber(entry.raw.total_votes)}</div>
      <div className="text-center text-gold">{entry.raw.recent_count}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RadarClient() {
  const [data, setData] = useState<TagRadarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/tags/radar', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as TagRadarResponse
      setData(json)

      // Auto-select all (up to 4 by default for readability)
      setSelected(new Set(json.entries.slice(0, 4).map((e) => e.tag)))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function toggleTag(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        if (next.size === 1) return prev // keep at least one
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/tags"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to tags"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-for-400 flex-shrink-0" aria-hidden />
              Tag Radar
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              6-dimension engagement map of your followed tags
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Refresh"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 pt-8"
            >
              <RadarSkeleton />
            </motion.div>
          ) : !data?.is_authenticated ? (
            <EmptyState
              icon={<Tag className="h-10 w-10" />}
              title="Sign in to see your Tag Radar"
              description="Follow some tags first, then come back to visualise your civic interests."
              action={<Link href="/login" className="btn-primary">Sign in</Link>}
            />
          ) : data.total_followed === 0 ? (
            <EmptyState
              icon={<Hash className="h-10 w-10" />}
              title="No followed tags yet"
              description="Follow at least one tag to see your personalised engagement radar."
              action={
                <Link
                  href="/tags"
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
                    'bg-for-500/20 text-for-300 border border-for-500/40 hover:bg-for-500/30 transition-colors',
                  )}
                >
                  <Hash className="h-4 w-4" />
                  Browse tags
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Dimension legend */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AXES.map((ax) => (
                  <div
                    key={ax.key}
                    className="bg-surface-100 border border-surface-300 rounded-xl px-3 py-2"
                  >
                    <div className="font-mono text-xs font-bold text-white">{ax.label}</div>
                    <div className="font-mono text-[10px] text-surface-500 leading-tight mt-0.5">
                      {ax.key === 'scale'        && 'Total debates carrying this tag'}
                      {ax.key === 'governance'   && 'Share that became established law'}
                      {ax.key === 'activity'     && 'Currently active or in voting'}
                      {ax.key === 'engagement'   && 'Total votes cast across all debates'}
                      {ax.key === 'freshness'    && 'New debates added this week'}
                      {ax.key === 'polarisation' && 'Average distance from 50/50 split'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tag selector pills */}
              <div>
                <p className="font-mono text-xs text-surface-500 mb-2">
                  Toggle tags to compare — up to {data.entries.length} available
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.entries.map((entry, idx) => {
                    const color = TAG_COLORS[idx % TAG_COLORS.length]
                    const isOn = selected.has(entry.tag)
                    return (
                      <button
                        key={entry.tag}
                        onClick={() => toggleTag(entry.tag)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-semibold',
                          'border transition-all duration-150',
                          isOn
                            ? 'text-white border-transparent'
                            : 'text-surface-500 bg-surface-100 border-surface-300 hover:border-surface-400',
                        )}
                        style={isOn ? { backgroundColor: color.stroke + '30', borderColor: color.stroke } : {}}
                      >
                        {isOn ? (
                          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: color.stroke }} />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                        <span style={isOn ? { color: color.stroke } : {}}># {entry.tag}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Radar chart */}
              <div className="flex flex-col items-center gap-4">
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 sm:p-6">
                  <RadarChart
                    entries={data.entries}
                    selected={selected}
                    hovered={hovered}
                    onHover={setHovered}
                  />
                </div>

                {/* Hovered tag detail */}
                <AnimatePresence>
                  {hovered && data.entries.find((e) => e.tag === hovered) && (() => {
                    const e = data.entries.find((e) => e.tag === hovered)!
                    const colorIdx = data.entries.indexOf(e) % TAG_COLORS.length
                    const color = TAG_COLORS[colorIdx]
                    return (
                      <motion.div
                        key={hovered}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="w-full bg-surface-100 border border-surface-300 rounded-2xl p-4"
                        style={{ borderColor: color.stroke + '40' }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color.stroke }}
                          />
                          <span className="font-mono text-sm font-bold text-white">
                            #{e.tag}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                          <div>
                            <div className="font-mono text-lg font-bold text-white">
                              {e.raw.topic_count}
                            </div>
                            <div className="font-mono text-[9px] text-surface-500 uppercase mt-0.5">
                              Debates
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-lg font-bold text-emerald-400">
                              {e.raw.law_count}
                            </div>
                            <div className="font-mono text-[9px] text-surface-500 uppercase mt-0.5">
                              Laws
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-lg font-bold text-purple-400">
                              {e.raw.active_count}
                            </div>
                            <div className="font-mono text-[9px] text-surface-500 uppercase mt-0.5">
                              Active
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-lg font-bold text-for-400">
                              {formatNumber(e.raw.total_votes)}
                            </div>
                            <div className="font-mono text-[9px] text-surface-500 uppercase mt-0.5">
                              Votes
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-lg font-bold text-gold">
                              {e.raw.recent_count}
                            </div>
                            <div className="font-mono text-[9px] text-surface-500 uppercase mt-0.5">
                              This Week
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-lg font-bold text-against-400">
                              {e.raw.avg_margin}%
                            </div>
                            <div className="font-mono text-[9px] text-surface-500 uppercase mt-0.5">
                              Avg Margin
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Link
                            href={`/tags/${encodeURIComponent(e.tag)}`}
                            className="font-mono text-xs text-for-400 hover:text-for-300 transition-colors"
                          >
                            View #{e.tag} debates →
                          </Link>
                        </div>
                      </motion.div>
                    )
                  })()}
                </AnimatePresence>
              </div>

              {/* Stats table */}
              <div className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-for-400" />
                  <span className="font-mono text-sm font-bold text-white">Raw Stats</span>
                </div>
                <div className="px-4 py-2">
                  {/* Table header */}
                  <div className="grid grid-cols-7 gap-1 text-[9px] font-mono text-surface-600 uppercase tracking-wider pb-1 border-b border-surface-300/40">
                    <div className="col-span-2">Tag</div>
                    <div className="text-center">Topics</div>
                    <div className="text-center text-emerald-600">Laws</div>
                    <div className="text-center text-purple-600">Active</div>
                    <div className="text-center text-for-600">Votes</div>
                    <div className="text-center text-amber-600">New/Wk</div>
                  </div>
                  {data.entries.map((entry, idx) => (
                    <StatsRow key={entry.tag} entry={entry} colorIdx={idx} />
                  ))}
                </div>
              </div>

              {/* Follow more tags CTA */}
              {data.total_followed < 3 && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-white">
                      Follow more tags
                    </p>
                    <p className="font-mono text-xs text-surface-500 mt-0.5">
                      The radar is more useful when you follow 4+ tags.
                    </p>
                  </div>
                  <Link
                    href="/tags"
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0',
                      'font-mono text-xs font-semibold',
                      'bg-for-500/20 text-for-300 border border-for-500/40 hover:bg-for-500/30 transition-colors',
                    )}
                  >
                    <Hash className="h-3.5 w-3.5" />
                    Browse tags
                  </Link>
                </div>
              )}

              {/* Navigation to related tag views */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/tags/my-tags"
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-xl',
                    'bg-surface-100 border border-surface-300 hover:border-surface-400',
                    'font-mono text-xs text-surface-400 hover:text-white transition-colors',
                  )}
                >
                  <Gavel className="h-4 w-4 text-gold flex-shrink-0" />
                  <div>
                    <div className="font-semibold">My Tags</div>
                    <div className="text-[10px] text-surface-600">Activity digest</div>
                  </div>
                </Link>
                <Link
                  href="/tags/compare"
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-xl',
                    'bg-surface-100 border border-surface-300 hover:border-surface-400',
                    'font-mono text-xs text-surface-400 hover:text-white transition-colors',
                  )}
                >
                  <Zap className="h-4 w-4 text-purple flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Compare Tags</div>
                    <div className="text-[10px] text-surface-600">Side-by-side stats</div>
                  </div>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
