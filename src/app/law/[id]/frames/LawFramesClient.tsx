'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Gavel,
  Layers,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawFramesResponse, LawIdeologicalFrame } from '@/app/api/laws/[id]/frames/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LawFramesClientProps {
  lawId: string
  statement: string
  category: string | null
  forPct: number
  totalVotes: number
  establishedAt: string
}

// ─── Frame colors ─────────────────────────────────────────────────────────────

const FRAME_COLORS: Record<string, {
  bg: string
  border: string
  text: string
  badge: string
  bar: string
  icon: string
}> = {
  progressive: {
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    text: 'text-for-400',
    badge: 'bg-for-500/20 text-for-400',
    bar: 'bg-for-500',
    icon: '⬆',
  },
  conservative: {
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    text: 'text-gold',
    badge: 'bg-gold/20 text-gold',
    bar: 'bg-gold',
    icon: '⬇',
  },
  libertarian: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-400',
    bar: 'bg-yellow-500',
    icon: '◆',
  },
  centrist: {
    bg: 'bg-surface-400/10',
    border: 'border-surface-400/30',
    text: 'text-surface-600',
    badge: 'bg-surface-400/20 text-surface-600',
    bar: 'bg-surface-500',
    icon: '●',
  },
  technocratic: {
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    text: 'text-purple',
    badge: 'bg-purple/20 text-purple',
    bar: 'bg-purple',
    icon: '◈',
  },
  populist: {
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    text: 'text-against-400',
    badge: 'bg-against-500/20 text-against-400',
    bar: 'bg-against-500',
    icon: '★',
  },
}

const STANCE_PILL: Record<LawIdeologicalFrame['stance'], { label: string; cls: string; icon: React.ReactNode }> = {
  accepts: {
    label: 'Accepts',
    cls: 'bg-emerald/20 text-emerald border border-emerald/30',
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  contests: {
    label: 'Contests',
    cls: 'bg-against-500/20 text-against-400 border border-against-500/30',
    icon: <ShieldX className="h-3 w-3" />,
  },
  ambivalent: {
    label: 'Ambivalent',
    cls: 'bg-surface-300/40 text-surface-600 border border-surface-400/30',
    icon: <Scale className="h-3 w-3" />,
  },
}

// ─── Frame Card ────────────────────────────────────────────────────────────────

function FrameCard({ frame, index }: { frame: LawIdeologicalFrame; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const colors = FRAME_COLORS[frame.id] ?? FRAME_COLORS.centrist
  const stance = STANCE_PILL[frame.stance]
  const alignmentPct = frame.alignmentScore
  const misalignmentPct = 100 - alignmentPct

  function copyVerdict() {
    navigator.clipboard.writeText(
      `[${frame.name} frame on "${frame.id}" law]\n\nVerdict: ${frame.verdict}\n\nInterpretation: ${frame.interpretation}\n\nConcern: ${frame.concern}`
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
          <span className={cn('text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full', stance.cls)}>
            {stance.icon}
            {stance.label}
          </span>
        </div>
      </div>

      {/* Alignment bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-emerald font-medium">{alignmentPct}% alignment</span>
          <span className="text-surface-500">{misalignmentPct}% misalignment</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', colors.bar)}
            style={{ width: `${alignmentPct}%` }}
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

      {/* Verdict */}
      <blockquote className={cn('text-sm italic border-l-2 pl-3 mb-3 leading-relaxed', colors.border, colors.text)}>
        &ldquo;{frame.verdict}&rdquo;
      </blockquote>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-xs text-surface-500 hover:text-surface-700 transition-colors"
      >
        <span>{expanded ? 'Hide analysis' : 'See full analysis'}</span>
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
              {/* Interpretation */}
              <div>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Interpretation</p>
                <p className="text-sm text-surface-700 leading-relaxed">{frame.interpretation}</p>
              </div>

              {/* Concern */}
              <div className="rounded-lg bg-against-500/5 border border-against-500/15 px-3 py-2">
                <p className="text-xs text-surface-500 mb-0.5 font-medium">Core concern</p>
                <p className="text-xs font-medium text-against-300">{frame.concern}</p>
              </div>

              {/* Implementation */}
              <div className="rounded-lg bg-for-500/5 border border-for-500/15 px-3 py-2">
                <p className="text-xs text-surface-500 mb-0.5 font-medium">Preferred implementation</p>
                <p className="text-xs font-medium text-for-300">{frame.implementation}</p>
              </div>

              <button
                onClick={copyVerdict}
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
                  <><Copy className="w-3 h-3" /> Copy analysis</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Alignment Spectrum ────────────────────────────────────────────────────────

function AlignmentSpectrum({ frames }: { frames: LawIdeologicalFrame[] }) {
  const sorted = [...frames].sort((a, b) => b.alignmentScore - a.alignmentScore)

  return (
    <div className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-4">
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <Compass className="w-3.5 h-3.5" />
        Ideological Alignment Spectrum
      </h3>

      <div className="space-y-2">
        {sorted.map((frame) => {
          const colors = FRAME_COLORS[frame.id] ?? FRAME_COLORS.centrist
          const stance = STANCE_PILL[frame.stance]
          return (
            <div key={frame.id} className="flex items-center gap-3">
              <span className={cn('text-xs font-medium w-24 shrink-0', colors.text)}>
                {frame.name}
              </span>
              <div className="flex-1 h-2 rounded-full bg-surface-300/20 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', colors.bar)}
                  style={{ width: `${frame.alignmentScore}%` }}
                />
              </div>
              <span className={cn('text-[10px] font-semibold w-16 text-right shrink-0', colors.text)}>
                {frame.alignmentScore}%
              </span>
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full w-20 text-center shrink-0',
                stance.cls
              )}>
                {stance.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Axis label */}
      <div className="flex justify-between mt-3 text-[10px] font-mono text-surface-500">
        <span>← CONTESTS</span>
        <span>ACCEPTS →</span>
      </div>
    </div>
  )
}

// ─── Landscape Summary ─────────────────────────────────────────────────────────

function LandscapeSummary({ data }: { data: LawFramesResponse }) {
  const { landscape } = data

  const sentimentConfig = {
    'broad-support': {
      label: 'Broad ideological support',
      icon: <TrendingUp className="h-4 w-4 text-emerald" />,
      cls: 'border-emerald/30 bg-emerald/5',
      text: 'text-emerald',
    },
    'contested': {
      label: 'Ideologically contested',
      icon: <Scale className="h-4 w-4 text-gold" />,
      cls: 'border-gold/30 bg-gold/5',
      text: 'text-gold',
    },
    'polarized': {
      label: 'Sharply polarized',
      icon: <TrendingDown className="h-4 w-4 text-against-400" />,
      cls: 'border-against-500/30 bg-against-500/5',
      text: 'text-against-400',
    },
  }

  const cfg = sentimentConfig[landscape.dominantSentiment]

  return (
    <div className={cn('rounded-xl border p-4', cfg.cls)}>
      <div className="flex items-center gap-2 mb-2">
        {cfg.icon}
        <span className={cn('text-sm font-semibold', cfg.text)}>{cfg.label}</span>
      </div>
      <p className="text-sm text-surface-700 leading-relaxed mb-3">{data.insight}</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        {landscape.acceptingFrames.length > 0 && (
          <div className="rounded-lg bg-emerald/10 border border-emerald/20 p-2">
            <p className="text-xs font-bold text-emerald">{landscape.acceptingFrames.length}</p>
            <p className="text-[10px] text-surface-500 mt-0.5">Accepting</p>
          </div>
        )}
        {landscape.ambivalentFrames.length > 0 && (
          <div className="rounded-lg bg-surface-300/20 border border-surface-400/20 p-2">
            <p className="text-xs font-bold text-surface-600">{landscape.ambivalentFrames.length}</p>
            <p className="text-[10px] text-surface-500 mt-0.5">Ambivalent</p>
          </div>
        )}
        {landscape.contestingFrames.length > 0 && (
          <div className="rounded-lg bg-against-500/10 border border-against-500/20 p-2">
            <p className="text-xs font-bold text-against-400">{landscape.contestingFrames.length}</p>
            <p className="text-[10px] text-surface-500 mt-0.5">Contesting</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex gap-1">
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-5 w-14 rounded" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LawFramesClient({
  lawId,
  statement,
  category,
  forPct,
  totalVotes,
  establishedAt,
}: LawFramesClientProps) {
  const [data, setData] = useState<LawFramesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'accepts' | 'contests' | 'ambivalent'>('all')

  const fetch_ = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/frames`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LawFramesResponse = await res.json()
      setData(json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to load ideological frames. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch_(ctrl.signal)
    return () => ctrl.abort()
  }, [fetch_])

  const visibleFrames = data?.frames.filter((f) =>
    activeTab === 'all' ? true : f.stance === activeTab
  ) ?? []

  const establishedDate = new Date(establishedAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Gavel className="h-4 w-4 text-gold flex-shrink-0" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              Ideological Frames
            </span>
          </div>
        </div>

        {/* Law header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <Badge variant="law" size="sm">
              <Gavel className="h-3 w-3 mr-1" />
              Established Law
            </Badge>
            {category && (
              <span className="text-xs font-mono text-surface-500 shrink-0">{category}</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-white leading-snug mb-3">{statement}</h1>

          <div className="flex items-center gap-4 text-xs text-surface-500">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{totalVotes.toLocaleString()} votes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            </div>
            <div>
              Established {establishedDate}
            </div>
          </div>

          {/* Vote bar */}
          <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-against-900">
            <div
              className="h-full bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>

          {/* Sub-nav links */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Link
              href={`/law/${lawId}`}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Law
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href={`/law/${lawId}/dossier`}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              Dossier
              <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href={`/law/${lawId}/impact`}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              Impact
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-surface-200/20 border border-surface-300/20">
          <Layers className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
          <p className="text-sm text-surface-600 leading-relaxed">
            How do different ideological lenses view this established law? Each frame reveals what values
            underpin acceptance or resistance — not just <em>whether</em> the consensus was right,
            but <em>why</em> different worldviews accept, contest, or remain ambivalent about its passage.
          </p>
        </div>

        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <div className="text-center py-12 space-y-3">
            <p className="text-surface-500">{error}</p>
            <button
              onClick={() => fetch_()}
              className="flex items-center gap-2 mx-auto text-sm text-for-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-5">
            {/* Landscape summary */}
            <LandscapeSummary data={data} />

            {/* Stance filter tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {(
                [
                  { id: 'all', label: 'All Frames' },
                  { id: 'accepts', label: `Accepts (${data.landscape.acceptingFrames.length})` },
                  { id: 'ambivalent', label: `Ambivalent (${data.landscape.ambivalentFrames.length})` },
                  { id: 'contests', label: `Contests (${data.landscape.contestingFrames.length})` },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                    activeTab === id
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  {label}
                </button>
              ))}

              {/* Refresh */}
              <button
                onClick={() => fetch_()}
                className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-200 transition-all"
                aria-label="Refresh frames"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Frame cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="grid gap-3 md:grid-cols-2"
              >
                {visibleFrames.map((frame, i) => (
                  <FrameCard key={frame.id} frame={frame} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Alignment spectrum */}
            <AlignmentSpectrum frames={data.frames} />

            {/* Insight callout */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/30 border border-surface-300/20">
              <Sparkles className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-1">Ideological landscape</p>
                <p className="text-sm text-surface-600 leading-relaxed">{data.insight}</p>
              </div>
            </div>

            {/* Cross-links */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/law/${lawId}/dossier`}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Dossier</p>
                  <p className="text-xs text-surface-500 mt-0.5">Full analysis report</p>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
              </Link>
              <Link
                href={`/law/${lawId}/community`}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Community</p>
                  <p className="text-xs text-surface-500 mt-0.5">Who shaped this law</p>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
