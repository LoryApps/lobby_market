'use client'

/**
 * /topic/[id]/debate-map — Debate Argument Map
 *
 * A 2D beeswarm scatter plot showing ALL top-level arguments for a topic:
 *   X-axis: FOR (left) vs AGAINST (right)
 *   Y-axis: Upvotes (bottom = fewer, top = more)
 *   Bubble size: Content length (proxy for argument depth)
 *   Color: FOR = blue-500, AGAINST = red-500
 *   Crown icon: Top argument on each side
 *
 * Hover/tap shows the argument preview in a side panel.
 *
 * Distinct from:
 *   /faceoff         — head-to-head single-pair comparison
 *   /argument-graph  — network graph of reply chains
 *   /themes          — argument theme clustering
 *   /versus          — side-by-side top argument list
 *   /quotes          — curated highlight quotes
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Crown,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
  Info,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DebateMapArgument, DebateMapResponse } from '@/app/api/topics/[id]/debate-map/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function timeAgo(iso: string): string {
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

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald',
  B: 'text-for-400',
  C: 'text-gold',
  D: 'text-surface-500',
  F: 'text-against-400',
}

// ─── Bubble layout ────────────────────────────────────────────────────────────

interface BubbleData {
  arg: DebateMapArgument
  cx: number   // 0-1, normalised X within its half
  cy: number   // 0-1, normalised Y (0 = bottom, 1 = top)
  r: number    // radius in pixels
  isTopFor: boolean
  isTopAgainst: boolean
}

function layoutBubbles(
  args: DebateMapArgument[],
  topForId: string | null,
  topAgainstId: string | null,
  maxUpvotes: number,
  width: number,
  height: number
): BubbleData[] {
  if (args.length === 0) return []

  const PAD = 32
  const MID_GAP = 20
  const HALF_W = (width - PAD * 2 - MID_GAP) / 2
  const PLOT_H = height - PAD * 2

  const MAX_R = 18
  const MIN_R = 5

  // Separate into FOR (left) and AGAINST (right)
  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  // upvotes => Y pixel (higher upvotes = higher on chart)
  function upvotesToY(upvotes: number): number {
    const norm = maxUpvotes > 0 ? upvotes / maxUpvotes : 0
    return PAD + PLOT_H * (1 - norm)
  }

  // char_count => radius
  function charToRadius(chars: number): number {
    const norm = Math.min(chars / 800, 1)
    return MIN_R + (MAX_R - MIN_R) * norm
  }

  const bubbles: BubbleData[] = []

  function layoutSide(
    sideArgs: DebateMapArgument[],
    xOffset: number,
    halfW: number
  ) {
    // Sort by upvotes descending for stacking order
    const sorted = [...sideArgs].sort((a, b) => b.upvotes - a.upvotes)

    sorted.forEach((arg, idx) => {
      const r = charToRadius(arg.char_count)
      const baseY = upvotesToY(arg.upvotes)

      // Distribute X evenly in the half, with jitter using a deterministic pattern
      const col = idx % 5
      const row = Math.floor(idx / 5)
      const xNorm = (col + 0.5 + (row % 2) * 0.3) / 5.6
      const x = xOffset + PAD + xNorm * (halfW - PAD * 0.5)

      // Jitter Y slightly to separate overlapping points
      const yJitter = (idx % 3 - 1) * 4
      const cy = Math.min(Math.max(baseY + yJitter, PAD + r + 2), height - PAD - r - 2)

      bubbles.push({
        arg,
        cx: x,
        cy,
        r,
        isTopFor: arg.id === topForId,
        isTopAgainst: arg.id === topAgainstId,
      })
    })
  }

  // FOR on left, AGAINST on right
  layoutSide(forArgs, 0, HALF_W)
  layoutSide(againstArgs, HALF_W + MID_GAP + PAD, HALF_W)

  return bubbles
}

// ─── Bubble chart component ───────────────────────────────────────────────────

interface BubbleChartProps {
  bubbles: BubbleData[]
  width: number
  height: number
  selected: string | null
  onSelect: (id: string | null) => void
  midX: number
}

function BubbleChart({ bubbles, width, height, selected, onSelect, midX }: BubbleChartProps) {
  return (
    <svg
      width={width}
      height={height}
      className="select-none touch-none"
      role="img"
      aria-label="Debate argument map"
    >
      {/* Background halves */}
      <rect x={0} y={0} width={midX} height={height} fill="rgba(59,130,246,0.04)" rx={0} />
      <rect x={midX} y={0} width={width - midX} height={height} fill="rgba(239,68,68,0.04)" rx={0} />

      {/* Centre divider */}
      <line
        x1={midX}
        y1={24}
        x2={midX}
        y2={height - 24}
        stroke="#374151"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Y-axis quality label */}
      <text
        x={10}
        y={height / 2}
        fill="#4B5563"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
        transform={`rotate(-90, 10, ${height / 2})`}
        className="font-mono"
      >
        QUALITY (UPVOTES) ↑
      </text>

      {/* Side labels */}
      <text x={midX / 2} y={18} textAnchor="middle" fill="#60a5fa" fontSize={10} fontFamily="monospace" fontWeight="600">
        FOR
      </text>
      <text x={midX + (width - midX) / 2} y={18} textAnchor="middle" fill="#f87171" fontSize={10} fontFamily="monospace" fontWeight="600">
        AGAINST
      </text>

      {/* Bubbles */}
      {bubbles.map((b) => {
        const isSelected = selected === b.arg.id
        const isFaded = selected !== null && !isSelected
        const fill = b.arg.side === 'blue' ? '#3b82f6' : '#ef4444'
        const fillOpacity = isFaded ? 0.15 : isSelected ? 1 : 0.7

        return (
          <g
            key={b.arg.id}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(isSelected ? null : b.arg.id)}
            role="button"
            aria-label={truncate(b.arg.content, 60)}
          >
            <circle
              cx={b.cx}
              cy={b.cy}
              r={b.r + (isSelected ? 3 : 0)}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={isSelected ? '#ffffff' : fill}
              strokeWidth={isSelected ? 2 : 0.5}
              strokeOpacity={isFaded ? 0.2 : 1}
              className="transition-all duration-150"
            />
            {/* Crown for top arguments */}
            {(b.isTopFor || b.isTopAgainst) && !isFaded && (
              <text
                x={b.cx}
                y={b.cy - b.r - 3}
                textAnchor="middle"
                fontSize={10}
                aria-hidden="true"
              >
                👑
              </text>
            )}
            {/* Upvote count on larger bubbles */}
            {b.r >= 11 && b.arg.upvotes > 0 && (
              <text
                x={b.cx}
                y={b.cy + 4}
                textAnchor="middle"
                fill="white"
                fontSize={8}
                fontWeight="700"
                opacity={isFaded ? 0.2 : 1}
                fontFamily="monospace"
              >
                {b.arg.upvotes}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Argument detail panel ────────────────────────────────────────────────────

interface ArgDetailProps {
  arg: DebateMapArgument
  topicId: string
  onClose: () => void
}

function ArgDetail({ arg, topicId, onClose }: ArgDetailProps) {
  const isFOR = arg.side === 'blue'
  const accentText = isFOR ? 'text-for-300' : 'text-against-300'
  const accentBg = isFOR ? 'bg-for-500/10' : 'bg-against-500/10'
  const accentBorder = isFOR ? 'border-for-500/30' : 'border-against-500/30'

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between gap-2 px-4 py-3', accentBg, 'border-b', accentBorder)}>
        <div className="flex items-center gap-2">
          {isFOR
            ? <ThumbsUp className={cn('h-3.5 w-3.5', accentText)} />
            : <ThumbsDown className={cn('h-3.5 w-3.5', accentText)} />
          }
          <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', accentText)}>
            {isFOR ? 'FOR' : 'AGAINST'}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close argument detail"
          className="p-0.5 rounded text-surface-500 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-sm text-surface-100 leading-relaxed">
          {arg.content}
        </p>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-surface-500 font-mono">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes} upvotes
          </span>
          {arg.reply_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
            </span>
          )}
          {arg.ai_grade && (
            <span className={cn('font-bold', GRADE_COLOR[arg.ai_grade])}>
              Grade {arg.ai_grade}
            </span>
          )}
          {arg.ai_score && (
            <span className="text-surface-400">AI {arg.ai_score}/10</span>
          )}
        </div>

        {/* Author */}
        {arg.author && (
          <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name || arg.author.username}
              size="xs"
            />
            <Link
              href={`/profile/${arg.author.username}`}
              className="text-[11px] text-surface-400 hover:text-white transition-colors"
            >
              @{arg.author.username}
            </Link>
            <span className="ml-auto text-[11px] text-surface-600">{timeAgo(arg.created_at)}</span>
          </div>
        )}

        {/* Full argument link */}
        <Link
          href={`/topic/${topicId}/arguments#${arg.id}`}
          className="flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-for-300 transition-colors pt-1"
        >
          <ExternalLink className="h-3 w-3" />
          View full argument thread
          <ChevronRight className="h-3 w-3 ml-auto" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page skeletons ───────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 pb-24 pt-4 px-4 max-w-5xl mx-auto">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-3">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DebateMapClient({ topicId }: { topicId: string }) {
  const params = useParams()
  const id = topicId || (params?.id as string)

  const [data, setData] = useState<DebateMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartSize, setChartSize] = useState({ width: 560, height: 360 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/debate-map`)
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as DebateMapResponse
      setData(json)
    } catch {
      setError('Failed to load debate map')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Responsive chart width
  useEffect(() => {
    function updateSize() {
      const el = containerRef.current
      if (!el) return
      const w = Math.min(el.clientWidth, 700)
      setChartSize({ width: w, height: Math.max(300, Math.min(w * 0.6, 420)) })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const selectedArg = selected && data
    ? data.arguments.find((a) => a.id === selected) ?? null
    : null

  const bubbles = data
    ? layoutBubbles(
        data.arguments,
        data.stats.top_for_id,
        data.stats.top_against_id,
        data.stats.max_upvotes,
        chartSize.width,
        chartSize.height
      )
    : []

  const midX = chartSize.width / 2

  const topicStatus = data?.topic.status ?? 'active'
  const forPct = Math.round(data?.topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pb-24 md:pb-12 pt-4 space-y-5">

        {/* Back nav */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {loading && <PageSkeleton />}

        {error && !loading && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 text-xs text-for-400 hover:text-for-300 inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={
                      topicStatus === 'law' ? 'law'
                      : topicStatus === 'failed' ? 'failed'
                      : topicStatus === 'voting' ? 'active'
                      : 'active'
                    }>
                      {topicStatus === 'active' || topicStatus === 'voting'
                        ? <Zap className="h-2.5 w-2.5" />
                        : topicStatus === 'law'
                        ? <Gavel className="h-2.5 w-2.5" />
                        : <Scale className="h-2.5 w-2.5" />
                      }
                      {STATUS_LABEL[topicStatus] ?? topicStatus}
                    </Badge>
                    {data.topic.category && (
                      <span className="text-xs text-surface-500 font-mono">{data.topic.category}</span>
                    )}
                  </div>

                  <h1 className="font-mono text-lg font-bold text-white leading-snug">
                    Debate Argument Map
                  </h1>
                  <p className="text-sm text-surface-400 leading-snug line-clamp-2">
                    {data.topic.statement}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowInfo((v) => !v)}
                    aria-label="How to read this map"
                    className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={load}
                    aria-label="Refresh"
                    className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Info panel */}
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-surface-300 bg-surface-200/60 p-3 text-[11px] text-surface-400 font-mono space-y-1">
                      <p className="text-white font-semibold text-xs mb-1">How to read this map</p>
                      <p>• <span className="text-for-400">Left half (blue)</span> = FOR arguments · <span className="text-against-400">Right half (red)</span> = AGAINST arguments</p>
                      <p>• <span className="text-white">Height</span> = upvotes — higher bubbles have more community support</p>
                      <p>• <span className="text-white">Size</span> = argument length — larger bubbles are more substantive</p>
                      <p>• <span className="text-white">Crown 👑</span> = top upvoted argument on each side</p>
                      <p>• <span className="text-white">Tap any bubble</span> to read the argument</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Arguments</p>
                <p className="text-2xl font-bold font-mono text-white">{data.stats.total}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{data.stats.for_count} FOR · {data.stats.against_count} AGN</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-for-500/20 border p-3">
                <p className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-1">For Split</p>
                <p className="text-2xl font-bold font-mono text-for-300">{forPct}%</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{data.topic.total_votes.toLocaleString()} votes</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-against-500/20 border p-3">
                <p className="text-[10px] font-mono text-against-400 uppercase tracking-wider mb-1">Against Split</p>
                <p className="text-2xl font-bold font-mono text-against-300">{againstPct}%</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{data.stats.avg_upvotes} avg upvotes</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">AI Graded</p>
                <p className="text-2xl font-bold font-mono text-white">{data.stats.graded_count}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">
                  {data.stats.avg_ai_score !== null
                    ? `avg ${data.stats.avg_ai_score}/10`
                    : 'no scores yet'
                  }
                </p>
              </div>
            </div>

            {/* Map + detail panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Bubble chart */}
              <div className="lg:col-span-2">
                <div
                  ref={containerRef}
                  className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
                >
                  {data.stats.total === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                      <Award className="h-8 w-8 text-surface-600 mb-3" />
                      <p className="text-sm text-surface-500">No arguments yet.</p>
                      <p className="text-xs text-surface-600 mt-1">Be the first to make the case.</p>
                      <Link
                        href={`/topic/${id}`}
                        className="mt-4 px-4 py-2 rounded-lg bg-for-600/80 text-white text-xs font-mono hover:bg-for-500/80 transition-colors"
                      >
                        Write an argument
                      </Link>
                    </div>
                  ) : (
                    <BubbleChart
                      bubbles={bubbles}
                      width={chartSize.width}
                      height={chartSize.height}
                      selected={selected}
                      onSelect={setSelected}
                      midX={midX}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="mt-2 flex items-center justify-center gap-6 text-[10px] font-mono text-surface-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-for-500 opacity-70" />
                    FOR argument
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-against-500 opacity-70" />
                    AGAINST argument
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[11px]">size</span> = depth
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[11px]">height</span> = upvotes
                  </span>
                </div>
              </div>

              {/* Detail panel */}
              <div className="space-y-3">
                <AnimatePresence mode="wait">
                  {selectedArg ? (
                    <ArgDetail
                      key={selectedArg.id}
                      arg={selectedArg}
                      topicId={id}
                      onClose={() => setSelected(null)}
                    />
                  ) : (
                    <motion.div
                      key="hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-surface-300 bg-surface-100 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[120px]"
                    >
                      <Sparkles className="h-5 w-5 text-surface-600" />
                      <p className="text-xs text-surface-500">
                        Tap any bubble to read the argument
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Top arguments quick-list */}
                {data.stats.total > 0 && (
                  <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-surface-300">
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Crown className="h-3 w-3 text-gold" />
                        Top arguments
                      </p>
                    </div>
                    <div className="divide-y divide-surface-300/50">
                      {[
                        ...data.arguments.filter((a) => a.side === 'blue').slice(0, 2),
                        ...data.arguments.filter((a) => a.side === 'red').slice(0, 2),
                      ]
                        .sort((a, b) => b.upvotes - a.upvotes)
                        .slice(0, 4)
                        .map((arg) => (
                          <button
                            key={arg.id}
                            onClick={() => setSelected(arg.id === selected ? null : arg.id)}
                            className={cn(
                              'w-full text-left px-4 py-3 hover:bg-surface-200/60 transition-colors',
                              selected === arg.id && 'bg-surface-200/60'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span className={cn(
                                'flex-shrink-0 w-1 rounded-full mt-1.5 h-8',
                                arg.side === 'blue' ? 'bg-for-500/60' : 'bg-against-500/60'
                              )} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] text-surface-300 leading-relaxed line-clamp-2">
                                  {truncate(arg.content, 80)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-surface-600 flex items-center gap-0.5">
                                    <ThumbsUp className="h-2.5 w-2.5" /> {arg.upvotes}
                                  </span>
                                  {arg.ai_grade && (
                                    <span className={cn('text-[10px] font-bold', GRADE_COLOR[arg.ai_grade])}>
                                      {arg.ai_grade}
                                    </span>
                                  )}
                                  <span className={cn(
                                    'text-[10px] font-mono font-semibold ml-auto',
                                    arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
                                  )}>
                                    {arg.side === 'blue' ? 'FOR' : 'AGN'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-surface-300">
                      <Link
                        href={`/topic/${id}/arguments`}
                        className="text-[11px] text-surface-500 hover:text-for-300 transition-colors flex items-center gap-1"
                      >
                        View all {data.stats.total} arguments
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300/50 overflow-hidden">
                  {[
                    { href: `/topic/${id}/versus`, label: 'Best FOR vs AGAINST' },
                    { href: `/topic/${id}/faceoff`, label: 'Argument Faceoff' },
                    { href: `/topic/${id}/argument-graph`, label: 'Reply Graph' },
                    { href: `/topic/${id}/themes`, label: 'Argument Themes' },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-200/60 transition-colors group"
                    >
                      <span className="text-[11px] text-surface-400 group-hover:text-white transition-colors">{label}</span>
                      <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
