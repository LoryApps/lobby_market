'use client'

/**
 * /cascade — The Civic Cascade
 *
 * Measures the RIPPLE EFFECT of laws: how much civic energy (votes + new topics)
 * surged in a law's category in the 7 days following its establishment vs the 7
 * days before.
 *
 * An "Ignition" law triggered a 3× or greater spike in category activity.
 * A "Surge" law triggered a 1.75–3× spike.
 * A "Ripple" law triggered a 1.1–1.75× increase.
 * A "Quiet" law saw little downstream change.
 *
 * Distinct from:
 *   /inheritance — which topics a law genealogically spawned (content-based)
 *   /momentum   — direction of vote-split changes on individual topics
 *   /groundswell — dormant topics waking up independently
 *   /convergence — two topics converging to the same position
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CascadeWave, CascadeResponse } from '@/app/api/cascade/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-for-300',       bg: 'bg-for-300/10',      border: 'border-for-300/20' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
}

const INTENSITY_CONFIG: Record<CascadeWave['intensity'], {
  label: string
  icon: typeof Flame
  color: string
  bg: string
  border: string
  ring: string
  description: string
}> = {
  ignition: {
    label: 'Ignition',
    icon: Zap,
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    ring: 'ring-against-500/20',
    description: '3× surge in category activity',
  },
  surge: {
    label: 'Surge',
    icon: Flame,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/15',
    description: '1.75–3× increase in activity',
  },
  ripple: {
    label: 'Ripple',
    icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/25',
    ring: 'ring-for-500/10',
    description: '1.1–1.75× increase in activity',
  },
  quiet: {
    label: 'Quiet',
    icon: Scale,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    ring: 'ring-transparent',
    description: 'Minimal downstream change',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Wave Card ────────────────────────────────────────────────────────────────

function CascadeBar({
  before,
  after,
  label,
}: {
  before: number
  after: number
  label: string
}) {
  const max = Math.max(before, after, 1)
  const beforePct = Math.round((before / max) * 100)
  const afterPct = Math.round((after / max) * 100)
  const increased = after > before

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-16 text-right text-[11px] font-mono text-surface-400 tabular-nums shrink-0">
          Before: {before.toLocaleString()}
        </span>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-surface-500 rounded-full transition-all duration-700"
            style={{ width: `${beforePct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'w-16 text-right text-[11px] font-mono tabular-nums shrink-0',
            increased ? 'text-emerald' : 'text-against-400'
          )}
        >
          After: {after.toLocaleString()}
        </span>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              increased ? 'bg-emerald' : 'bg-against-400'
            )}
            style={{ width: `${afterPct}%` }}
          />
        </div>
        {increased ? (
          <TrendingUp className="h-3 w-3 text-emerald shrink-0" />
        ) : (
          <TrendingDown className="h-3 w-3 text-against-400 shrink-0" />
        )}
      </div>
    </div>
  )
}

function WaveCard({ wave, index }: { wave: CascadeWave; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const intensity = INTENSITY_CONFIG[wave.intensity]
  const catColors = CATEGORY_COLORS[wave.category] ?? {
    text: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  }
  const IntensityIcon = intensity.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-shadow',
        'ring-1',
        intensity.border,
        intensity.ring
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300">
            <span className="text-xs font-mono font-bold text-surface-400">
              {index + 1}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  intensity.bg,
                  intensity.border,
                  intensity.color
                )}
              >
                <IntensityIcon className="h-3 w-3" />
                {intensity.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border',
                  catColors.bg,
                  catColors.border,
                  catColors.text
                )}
              >
                {wave.category}
              </span>
              <span className="text-[10px] font-mono text-surface-500 ml-auto">
                {relativeTime(wave.established_at)}
              </span>
            </div>

            {/* Law statement */}
            <div className="flex items-start gap-2">
              <Gavel className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-mono text-white leading-snug">
                {truncate(wave.law_statement, 120)}
              </p>
            </div>

            {/* Score row */}
            <div className="flex items-center gap-3 pt-0.5">
              <div className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3 text-surface-500" />
                <span className="text-[11px] font-mono text-surface-400">
                  Cascade:{' '}
                  <span className={cn('font-bold', intensity.color)}>
                    {wave.cascade_score >= 10
                      ? wave.cascade_score.toFixed(1)
                      : wave.cascade_score.toFixed(2)}
                    ×
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-surface-400">
                <Scale className="h-3 w-3 text-surface-500" />
                {wave.law_blue_pct != null ? `${Math.round(wave.law_blue_pct)}% FOR` : '—'}
              </div>
              {wave.topics_after > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-emerald">
                  <Sparkles className="h-3 w-3" />
                  +{wave.topics_after} topic{wave.topics_after !== 1 ? 's' : ''} spawned
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-surface-300/60 text-[11px] font-mono text-surface-500 hover:text-surface-300 hover:bg-surface-200/40 transition-colors"
        aria-expanded={expanded}
      >
        <span>{expanded ? 'Hide details' : 'View cascade metrics'}</span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-4 border-t border-surface-300/40">
              <CascadeBar
                before={wave.votes_before}
                after={wave.votes_after}
                label="Votes in category (7-day window)"
              />
              <CascadeBar
                before={wave.topics_before}
                after={wave.topics_after}
                label="New topics proposed in category"
              />
              <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                {intensity.description}. Cascade score compares combined vote and topic activity
                in the 7 days after this law was established vs. the 7 days before.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/topic/${wave.topic_id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  View debate
                </Link>
                <Link
                  href={`/categories/${encodeURIComponent(wave.category)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <ChevronRight className="h-3 w-3" />
                  {wave.category} category
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function IntensityLegend() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 rounded-2xl bg-surface-100 border border-surface-300">
      {(Object.entries(INTENSITY_CONFIG) as [CascadeWave['intensity'], typeof INTENSITY_CONFIG[keyof typeof INTENSITY_CONFIG]][]).map(([key, cfg]) => {
        const Icon = cfg.icon
        return (
          <div key={key} className="flex items-start gap-2">
            <div
              className={cn(
                'flex items-center justify-center h-6 w-6 rounded-lg border flex-shrink-0',
                cfg.bg,
                cfg.border
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
            </div>
            <div>
              <p className={cn('text-[11px] font-mono font-semibold', cfg.color)}>
                {cfg.label}
              </p>
              <p className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">
                {cfg.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CascadeClient() {
  const [waves, setWaves] = useState<CascadeWave[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('All')
  const [showLegend, setShowLegend] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const fetchData = useCallback(async (cat: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/cascade?${params}`)
      if (!res.ok) throw new Error('fetch_failed')
      const data = (await res.json()) as CascadeResponse
      setWaves(data.waves)
      setGeneratedAt(data.generated_at)
    } catch {
      setWaves([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(category)
  }, [fetchData, category])

  const handleRefresh = useCallback(() => {
    fetchData(category)
  }, [fetchData, category])

  const ignitionCount = waves.filter((w) => w.intensity === 'ignition').length
  const surgeCount = waves.filter((w) => w.intensity === 'surge').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
                <Zap className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  The Civic Cascade
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Laws that ignited a wave of new civic energy
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh cascade data"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Explanation */}
          <p className="text-sm font-mono text-surface-500 leading-relaxed mb-4">
            When a law is established, does it quiet the debate — or light a fire?
            The cascade score measures the spike in same-category votes and new topic
            proposals in the 7 days following each law, compared to the 7 days before.
          </p>

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-3"
          >
            <BarChart2 className="h-3 w-3" />
            {showLegend ? 'Hide' : 'Show'} intensity guide
          </button>
          <AnimatePresence>
            {showLegend && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <IntensityLegend />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats row */}
          {!loading && waves.length > 0 && (
            <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
              {ignitionCount > 0 && (
                <span className="flex items-center gap-1 text-against-400">
                  <Zap className="h-3 w-3" />
                  {ignitionCount} ignition{ignitionCount !== 1 ? 's' : ''}
                </span>
              )}
              {surgeCount > 0 && (
                <span className="flex items-center gap-1 text-gold">
                  <Flame className="h-3 w-3" />
                  {surgeCount} surge{surgeCount !== 1 ? 's' : ''}
                </span>
              )}
              <span>{waves.length} laws analyzed</span>
              {generatedAt && (
                <span className="ml-auto">
                  Updated {relativeTime(generatedAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Category Filter ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors',
                category === cat
                  ? 'bg-for-600 border-for-600 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : waves.length === 0 ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-surface-400"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="No cascade data yet"
            description={
              category !== 'All'
                ? `No laws found in ${category} with measurable downstream effects yet.`
                : 'Laws need time to generate cascades. Check back as more laws are established.'
            }
            actions={
              category !== 'All'
                ? [{ label: 'View all categories', onClick: () => setCategory('All') }]
                : [{ label: 'Browse laws', href: '/laws' }]
            }
          />
        ) : (
          <div className="space-y-3">
            {waves.map((wave, i) => (
              <WaveCard key={wave.law_id} wave={wave} index={i} />
            ))}

            {/* Footer link */}
            <div className="pt-2 flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-mono text-surface-500">
                Showing the {waves.length} most recently established laws
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/laws"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Browse all laws
                </Link>
                <Link
                  href="/inheritance"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Legislative genealogy
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
