'use client'

/**
 * /topic/[id]/frames — Ideological Debate Frames
 *
 * Shows how 6 ideological lenses (Progressive, Conservative, Libertarian,
 * Centrist, Technocratic, Populist) frame a given debate — what values each
 * prioritizes, how each would argue FOR or AGAINST, and the fundamental value
 * tensions each sees in the question.
 *
 * Distinct from:
 *   /topic/[id]/steelman   — strongest charitable case for each side
 *   /topic/[id]/versus     — raw best FOR vs AGAINST arguments
 *   /topic/[id]/sentiment  — emotional tone of the debate
 *   /topic/[id]/breakdown  — demographic voter breakdown
 *
 * Frames explains WHY reasonable people disagree — they use different
 * underlying value frameworks, not just different facts.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  Check,
  Globe,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FramesResponse, IdeologicalFrame } from '@/app/api/topics/[id]/frames/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FramesClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Frame color config ────────────────────────────────────────────────────────

const FRAME_COLORS: Record<string, {
  bg: string
  border: string
  text: string
  lean: string
  badge: string
  bar: string
  icon: string
}> = {
  progressive: {
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    text: 'text-for-400',
    lean: 'text-for-400',
    badge: 'bg-for-500/20 text-for-400',
    bar: 'bg-for-500',
    icon: '⬆',
  },
  conservative: {
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    text: 'text-gold',
    lean: 'text-gold',
    badge: 'bg-gold/20 text-gold',
    bar: 'bg-gold',
    icon: '⬇',
  },
  libertarian: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    lean: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-400',
    bar: 'bg-yellow-500',
    icon: '◆',
  },
  centrist: {
    bg: 'bg-surface-400/10',
    border: 'border-surface-400/30',
    text: 'text-surface-600',
    lean: 'text-surface-600',
    badge: 'bg-surface-400/20 text-surface-600',
    bar: 'bg-surface-500',
    icon: '●',
  },
  technocratic: {
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    text: 'text-purple',
    lean: 'text-purple',
    badge: 'bg-purple/20 text-purple',
    bar: 'bg-purple',
    icon: '◈',
  },
  populist: {
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    text: 'text-against-400',
    lean: 'text-against-400',
    badge: 'bg-against-500/20 text-against-400',
    bar: 'bg-against-500',
    icon: '★',
  },
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

// ─── Frame Card ────────────────────────────────────────────────────────────────

function FrameCard({ frame, index }: { frame: IdeologicalFrame; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const colors = FRAME_COLORS[frame.id] ?? FRAME_COLORS.centrist

  const forPct = frame.forLean
  const againstPct = 100 - forPct
  const leanLabel =
    frame.naturalSide === 'for'
      ? `Leans FOR`
      : frame.naturalSide === 'against'
      ? `Leans AGAINST`
      : 'Split'

  function copyArg() {
    navigator.clipboard.writeText(
      `[${frame.name} frame] "${frame.catchphrase}"\n\n${frame.keyArgument}\n\nValues tension: ${frame.valueTension}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        colors.bg,
        colors.border
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-lg font-mono', colors.text)}>{colors.icon}</span>
          <div className="min-w-0">
            <h3 className={cn('font-semibold text-sm', colors.text)}>{frame.name}</h3>
            <p className="text-xs text-surface-500 truncate">{frame.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              colors.badge
            )}
          >
            {leanLabel}
          </span>
        </div>
      </div>

      {/* FOR/AGAINST bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-for-400 font-medium">{forPct}% FOR</span>
          <span className="text-against-400 font-medium">{againstPct}% AGAINST</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', colors.bar)}
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Core values */}
      <div className="flex flex-wrap gap-1 mb-3">
        {frame.coreValues.map((v) => (
          <span
            key={v}
            className="text-xs px-1.5 py-0.5 rounded bg-surface-200/50 text-surface-600 border border-surface-300/20"
          >
            {v}
          </span>
        ))}
      </div>

      {/* Catchphrase */}
      <blockquote className={cn('text-sm italic border-l-2 pl-3 mb-3', colors.border, colors.text)}>
        &ldquo;{frame.catchphrase}&rdquo;
      </blockquote>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-xs text-surface-500 hover:text-surface-700 transition-colors"
      >
        <span>{expanded ? 'Hide argument' : 'See full argument'}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              <p className="text-sm text-surface-700 leading-relaxed">{frame.keyArgument}</p>

              <div className="rounded-lg bg-surface-200/30 border border-surface-300/20 px-3 py-2">
                <p className="text-xs text-surface-500 mb-0.5">Value tension</p>
                <p className="text-xs font-medium text-surface-700">{frame.valueTension}</p>
              </div>

              <button
                onClick={copyArg}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors',
                  copied
                    ? 'text-emerald bg-emerald/10'
                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200/40'
                )}
              >
                {copied ? (
                  <><Check className="w-3 h-3" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copy argument</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Frame Spectrum ────────────────────────────────────────────────────────────

function FrameSpectrum({ frames }: { frames: IdeologicalFrame[] }) {
  const sorted = [...frames].sort((a, b) => b.forLean - a.forLean)

  return (
    <div className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-4">
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <Scale className="w-3.5 h-3.5" />
        Ideological Spectrum
      </h3>

      <div className="space-y-2">
        {sorted.map((frame) => {
          const colors = FRAME_COLORS[frame.id] ?? FRAME_COLORS.centrist
          return (
            <div key={frame.id} className="flex items-center gap-3">
              <span className={cn('text-xs font-medium w-24 shrink-0', colors.text)}>
                {frame.name}
              </span>
              <div className="flex-1 h-2 rounded-full bg-surface-300/30 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', colors.bar)}
                  style={{ width: `${frame.forLean}%` }}
                />
              </div>
              <span className={cn('text-xs font-mono w-10 text-right shrink-0', colors.text)}>
                {frame.forLean}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Midpoint line indicator */}
      <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
        <div className="flex-1 h-px bg-surface-300/30" />
        <span>50% = neutral</span>
        <div className="flex-1 h-px bg-surface-300/30" />
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FramesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-surface-300/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-16 rounded" />
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FramesClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: FramesClientProps) {
  const [data, setData] = useState<FramesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/frames`)
      if (!res.ok) throw new Error('Failed to load frames')
      const json: FramesResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Back nav */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to debate
          </Link>
          <ChevronRight className="w-3 h-3 text-surface-400" />
          <span className="text-xs text-surface-600">Debate Frames</span>
        </div>

        {/* Topic header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={STATUS_BADGE[status] ?? 'proposed'}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {category && (
              <span className="text-xs text-surface-500">{category}</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-surface-800 leading-snug mb-3">
            {statement}
          </h1>

          {/* Vote split */}
          <div className="flex items-center gap-3 text-xs mb-2">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
          </div>
          <p className="text-xs text-surface-500">
            {totalVotes.toLocaleString()} votes cast
          </p>
        </div>

        {/* Page intro */}
        <div className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4 text-purple" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-800 mb-1">Ideological Debate Frames</h2>
              <p className="text-xs text-surface-500 leading-relaxed">
                Why do reasonable people disagree? They use different underlying value frameworks.
                These 6 lenses show how each tradition frames this debate — what values are at stake,
                what argument they&apos;d make, and which side they naturally lean toward.
              </p>
            </div>
          </div>
        </div>

        {/* Main content */}
        {loading ? (
          <FramesSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-6 text-center">
            <p className="text-sm text-against-400 mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 mx-auto text-xs text-surface-500 hover:text-surface-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-6">

            {/* Insight callout */}
            <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
                <p className="text-sm text-surface-700 leading-relaxed">{data.insight}</p>
              </div>
            </div>

            {/* Frame divide summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-3">
                <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Most FOR lean
                </p>
                <p className="text-sm font-semibold text-for-400">{data.frameDivide.mostForFrame}</p>
              </div>
              <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-3">
                <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Most AGAINST lean
                </p>
                <p className="text-sm font-semibold text-against-400">{data.frameDivide.mostAgainstFrame}</p>
              </div>
            </div>

            {data.frameDivide.splitFrames.length > 0 && (
              <div className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-3">
                <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                  <Scale className="w-3 h-3" /> Genuinely split
                </p>
                <p className="text-sm text-surface-700">
                  {data.frameDivide.splitFrames.join(', ')} — no strong ideological lean
                </p>
              </div>
            )}

            {/* Frame cards grid */}
            <div>
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                The 6 Frames
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.frames.map((frame, i) => (
                  <FrameCard key={frame.id} frame={frame} index={i} />
                ))}
              </div>
            </div>

            {/* Spectrum chart */}
            <FrameSpectrum frames={data.frames} />

            {/* Consensus range callout */}
            <div className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-4 text-center">
              <p className="text-xs text-surface-500 mb-1">Ideological divide width</p>
              <p className="text-2xl font-bold text-surface-800">
                {data.frameDivide.consensusRange}pp
              </p>
              <p className="text-xs text-surface-500 mt-1">
                {data.frameDivide.consensusRange >= 40
                  ? 'Deep ideological split — value frameworks fundamentally disagree'
                  : data.frameDivide.consensusRange >= 20
                  ? 'Moderate ideological split — some common ground exists across frameworks'
                  : 'Narrow ideological split — most frameworks reach similar conclusions'}
              </p>
            </div>

            {/* Navigation to related pages */}
            <div className="rounded-xl border border-surface-300/20 bg-surface-200/10 p-4">
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5" />
                Explore More
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Steelman', href: `/topic/${topicId}/steelman`, icon: Scale },
                  { label: 'Versus', href: `/topic/${topicId}/versus`, icon: Zap },
                  { label: 'Sentiment', href: `/topic/${topicId}/sentiment`, icon: Users },
                  { label: 'Synthesis', href: `/topic/${topicId}/synthesis`, icon: Globe },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex items-center gap-2 rounded-lg border border-surface-300/20 bg-surface-200/30 px-3 py-2 text-xs text-surface-600 hover:text-surface-800 hover:border-surface-400/30 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-surface-500" />
                    {label}
                    <ArrowRight className="w-3 h-3 ml-auto" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
