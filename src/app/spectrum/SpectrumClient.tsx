'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Filter,
  Gavel,
  Scale,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SpectrumTopic } from './page'

// ─── Category colours (exact hex for SVG/inline use) ─────────────────────────

const CATEGORY_HEX: Record<string, string> = {
  Economics:   '#f59e0b', // gold
  Politics:    '#60a5fa', // for-400
  Technology:  '#8b5cf6', // purple
  Science:     '#10b981', // emerald
  Ethics:      '#f87171', // against-400
  Philosophy:  '#818cf8', // indigo
  Culture:     '#fb923c', // orange
  Health:      '#f472b6', // pink
  Environment: '#4ade80', // green-400
  Education:   '#22d3ee', // cyan
  Other:       '#71717a', // zinc
}

function catColor(cat: string | null): string {
  return CATEGORY_HEX[cat ?? ''] ?? CATEGORY_HEX.Other
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; ring: string; icon: typeof Zap }> = {
  proposed: { label: 'Proposed', ring: '#3f3f46',  icon: Scale     },
  active:   { label: 'Active',   ring: '#3b82f6',  icon: Zap       },
  voting:   { label: 'Voting',   ring: '#8b5cf6',  icon: Scale     },
  law:      { label: 'Law',      ring: '#f59e0b',  icon: Gavel     },
  failed:   { label: 'Failed',   ring: '#ef4444',  icon: TrendingDown },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 72): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STATUS_FILTERS = ['proposed', 'active', 'voting', 'law', 'failed'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlottedTopic extends SpectrumTopic {
  /** normalised 0–1 position on x-axis (0 = 100% against, 1 = 100% for) */
  xPct: number
  /** normalised 0–1 position on y-axis (0 = top = most engaged) */
  yPct: number
  /** dot radius in px */
  r: number
}

// ─── Tooltip component ────────────────────────────────────────────────────────

interface TooltipProps {
  topic: PlottedTopic
  containerW: number
  containerH: number
  dotX: number   // px from container left
  dotY: number   // px from container top
}

function Tooltip({ topic, containerW, containerH, dotX, dotY }: TooltipProps) {
  const forPct = Math.round(topic.blue_pct)
  const against = 100 - forPct
  const sc = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const StatusIcon = sc.icon

  // Flip if near right edge
  const flipX = dotX > containerW * 0.65
  // Flip if near bottom
  const flipY = dotY > containerH * 0.65

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'absolute z-50 w-64 pointer-events-none',
        'bg-surface-100 border border-surface-300 rounded-2xl shadow-xl p-3.5',
      )}
      style={{
        left: flipX ? dotX - 264 : dotX + topic.r + 8,
        top: flipY ? dotY - 200 : dotY - 12,
      }}
    >
      <p className="text-[11px] font-mono text-surface-500 mb-1 flex items-center gap-1.5">
        <StatusIcon className="h-3 w-3 flex-shrink-0" style={{ color: sc.ring }} />
        {sc.label}
        {topic.category && (
          <>
            <span className="text-surface-600">·</span>
            <span style={{ color: catColor(topic.category) }}>{topic.category}</span>
          </>
        )}
      </p>
      <p className="text-xs font-mono text-white leading-snug mb-3">
        {truncate(topic.statement, 80)}
      </p>

      {/* Vote bar */}
      <div className="flex items-center gap-1 text-[10px] font-mono mb-1.5">
        <span className="text-for-400 w-10 text-right shrink-0">{forPct}%</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <span className="text-against-400 w-10 shrink-0">{against}%</span>
      </div>

      <p className="text-[10px] font-mono text-surface-500 text-center">
        {topic.total_votes.toLocaleString()} votes
      </p>

      <p className="mt-2 text-[10px] font-mono text-for-400 text-center">
        Click to open →
      </p>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SpectrumClientProps {
  topics: SpectrumTopic[]
}

export function SpectrumClient({ topics }: SpectrumClientProps) {
  const router = useRouter()

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 })

  // Measure container after mount so dots can be positioned correctly
  const containerCb = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: width, h: height })
    })
    obs.observe(node)
    setContainerSize({ w: node.offsetWidth, h: node.offsetHeight })
  }, [])

  // ── Compute plot positions ────────────────────────────────────────────────

  const plotted = useMemo<PlottedTopic[]>(() => {
    if (!topics.length) return []

    const maxVotes = Math.max(...topics.map((t) => t.total_votes))
    const logMax = Math.log(maxVotes + 1)

    return topics.map((t) => {
      const xPct = t.blue_pct / 100

      // High votes → top (low yPct)
      const logVotes = Math.log(t.total_votes + 1)
      const yPct = 1 - logVotes / logMax

      // Radius: 5–22 px proportional to votes
      const voteFraction = logVotes / logMax
      const r = 5 + voteFraction * 17

      return { ...t, xPct, yPct, r }
    })
  }, [topics])

  // ── Filtered topics ───────────────────────────────────────────────────────

  const filtered = useMemo(
    () =>
      plotted.filter((t) => {
        if (catFilter && t.category !== catFilter) return false
        if (statusFilter && t.status !== statusFilter) return false
        return true
      }),
    [plotted, catFilter, statusFilter],
  )

  // ── Hovered topic object ──────────────────────────────────────────────────

  const hoveredTopic = useMemo(
    () => filtered.find((t) => t.id === hoveredId) ?? null,
    [filtered, hoveredId],
  )

  // ── Chart padding (px) ────────────────────────────────────────────────────

  const PAD_L = 48
  const PAD_R = 16
  const PAD_T = 16
  const PAD_B = 40

  function toScreenX(xPct: number) {
    return PAD_L + xPct * (containerSize.w - PAD_L - PAD_R)
  }
  function toScreenY(yPct: number) {
    return PAD_T + yPct * (containerSize.h - PAD_T - PAD_B)
  }

  const deadlockX = toScreenX(0.5)

  // ── Category filter availability ──────────────────────────────────────────

  const availableCategories = useMemo(() => {
    const cats = new Set(plotted.map((t) => t.category ?? 'Other'))
    return CATEGORIES.filter((c) => cats.has(c))
  }, [plotted])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />

        {/* Category filter */}
        {availableCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(catFilter === cat ? null : cat)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
              catFilter === cat
                ? 'text-white border-transparent'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
            )}
            style={
              catFilter === cat
                ? { backgroundColor: catColor(cat) + '33', borderColor: catColor(cat) + '80', color: catColor(cat) }
                : undefined
            }
          >
            {cat}
          </button>
        ))}

        {/* Spacer */}
        <span className="text-surface-600 text-xs">|</span>

        {/* Status filter */}
        {STATUS_FILTERS.map((s) => {
          const cfg = STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                statusFilter === s
                  ? 'text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              )}
              style={
                statusFilter === s
                  ? { backgroundColor: cfg.ring + '33', borderColor: cfg.ring + '80', color: cfg.ring }
                  : undefined
              }
            >
              {cfg.label}
            </button>
          )
        })}

        {(catFilter || statusFilter) && (
          <button
            onClick={() => { setCatFilter(null); setStatusFilter(null) }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-surface-300 border border-surface-400 text-surface-400 hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}

        <span className="ml-auto text-[11px] font-mono text-surface-500">
          {filtered.length} topics
        </span>
      </div>

      {/* ── Chart canvas ─────────────────────────────────────────────── */}
      <div
        ref={containerCb}
        className="relative w-full bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden select-none"
        style={{ height: 'clamp(360px, 55vh, 600px)' }}
      >
        {/* Zone backgrounds */}
        <div
          className="absolute top-0 bottom-0 bg-against-500/[0.04]"
          style={{ left: 0, width: `${PAD_L + (deadlockX - PAD_L) * 0.45}px` }}
        />
        <div
          className="absolute top-0 bottom-0 bg-for-500/[0.04]"
          style={{ right: 0, left: `${deadlockX + (containerSize.w - PAD_L - PAD_R) * 0.05}px` }}
        />

        {/* Y-axis grid lines + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = toScreenY(frac)
          const label =
            frac === 0 ? 'Most debated' :
            frac === 0.5 ? 'Moderate' :
            frac === 1 ? 'Least debated' : ''
          return (
            <g key={frac}>
              <div
                className="absolute left-0 right-0 border-t border-surface-300/40"
                style={{ top: y }}
              />
              {label && (
                <div
                  className="absolute text-[9px] font-mono text-surface-600 -translate-y-1/2 whitespace-nowrap"
                  style={{ top: y, left: 6, width: 40 }}
                >
                  {label}
                </div>
              )}
            </g>
          )
        })}

        {/* Deadlock vertical line */}
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-surface-400/60"
          style={{ left: deadlockX }}
        />
        <div
          className="absolute text-[9px] font-mono text-surface-500 whitespace-nowrap"
          style={{ top: PAD_T + 4, left: deadlockX + 4 }}
        >
          DEADLOCK
        </div>

        {/* X-axis labels */}
        <div
          className="absolute text-[10px] font-mono text-against-400 font-semibold"
          style={{ bottom: 10, left: PAD_L + 4 }}
        >
          ← AGAINST
        </div>
        <div
          className="absolute text-[10px] font-mono text-for-400 font-semibold"
          style={{ bottom: 10, right: PAD_R + 4 }}
        >
          FOR →
        </div>
        <div
          className="absolute text-[9px] font-mono text-surface-600"
          style={{ bottom: 10, left: '50%', transform: 'translateX(-50%)' }}
        >
          consensus direction
        </div>

        {/* Y-axis label */}
        <div
          className="absolute text-[9px] font-mono text-surface-600 whitespace-nowrap"
          style={{
            left: 6,
            top: '50%',
            transform: 'translateY(-50%) rotate(-90deg)',
            transformOrigin: 'center center',
          }}
        >
          engagement
        </div>

        {/* Topic dots */}
        {filtered.map((topic) => {
          const cx = toScreenX(topic.xPct)
          const cy = toScreenY(topic.yPct)
          const isHovered = hoveredId === topic.id
          const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed

          return (
            <motion.div
              key={topic.id}
              className="absolute rounded-full cursor-pointer"
              style={{
                left: cx - topic.r,
                top: cy - topic.r,
                width: topic.r * 2,
                height: topic.r * 2,
                backgroundColor: catColor(topic.category) + (isHovered ? 'ff' : 'cc'),
                boxShadow: isHovered
                  ? `0 0 0 2px ${cfg.ring}, 0 0 12px ${catColor(topic.category)}66`
                  : `0 0 0 1.5px ${cfg.ring}88`,
                zIndex: isHovered ? 30 : 10,
              }}
              animate={{
                scale: isHovered ? 1.4 : 1,
              }}
              transition={{ duration: 0.15 }}
              onMouseEnter={() => {
                setHoveredId(topic.id)
                setHoveredPos({ x: cx, y: cy })
              }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => router.push(`/topic/${topic.id}`)}
              role="button"
              aria-label={`${topic.statement} — ${Math.round(topic.blue_pct)}% For`}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`/topic/${topic.id}`)}
            />
          )
        })}

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredTopic && (
            <Tooltip
              key={hoveredTopic.id}
              topic={hoveredTopic}
              containerW={containerSize.w}
              containerH={containerSize.h}
              dotX={hoveredPos.x}
              dotY={hoveredPos.y}
            />
          )}
        </AnimatePresence>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-surface-500 text-sm font-mono">No topics match the current filter</p>
            <button
              onClick={() => { setCatFilter(null); setStatusFilter(null) }}
              className="text-for-400 text-xs font-mono hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-start">

        {/* Category legend */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mb-2">Categories</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: catColor(cat) }}
                />
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Status legend */}
        <div className="flex-shrink-0">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mb-2">Status ring</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {STATUS_FILTERS.map((s) => {
              const cfg = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 bg-transparent"
                    style={{ borderColor: cfg.ring }}
                  />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Size legend */}
        <div className="flex-shrink-0">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mb-2">Dot size</p>
          <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
            <span className="inline-block w-2 h-2 rounded-full bg-surface-500 opacity-60" />
            <span>few votes</span>
            <span className="inline-block w-5 h-5 rounded-full bg-surface-500 opacity-60" />
            <span>many votes</span>
          </div>
        </div>
      </div>

      {/* ── Reading guide ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'Top center',
            desc: 'Most debated + contested — the fiercest active disputes',
            color: 'text-gold',
            bg: 'bg-gold/5',
            border: 'border-gold/20',
          },
          {
            label: 'Top right',
            desc: 'High engagement + strong FOR consensus — likely to become law',
            color: 'text-for-400',
            bg: 'bg-for-500/5',
            border: 'border-for-500/20',
          },
          {
            label: 'Top left',
            desc: 'High engagement + strong AGAINST consensus — likely to fail',
            color: 'text-against-400',
            bg: 'bg-against-500/5',
            border: 'border-against-500/20',
          },
        ].map((item) => (
          <div
            key={item.label}
            className={cn(
              'rounded-xl border px-4 py-3',
              item.bg,
              item.border,
            )}
          >
            <p className={cn('text-[11px] font-mono font-semibold mb-1', item.color)}>
              {item.label}
            </p>
            <p className="text-[11px] font-mono text-surface-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
