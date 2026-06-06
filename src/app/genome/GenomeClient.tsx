'use client'

/**
 * /genome — The Civic Genome
 *
 * Every vote you cast is a nucleotide in your civic DNA. The Genome maps the
 * full sequence — which issue categories form your dominant strands, how your
 * positions have evolved month by month, and what genome type your pattern
 * most resembles.
 *
 * Distinct from:
 *   /fingerprint    — measures how UNIQUE you are vs. consensus
 *   /archetype      — assigns a civic personality type via a quiz
 *   /calibration    — measures predictive accuracy of your votes
 *   /twins          — finds users with similar genomes
 *   /compass        — places you on a political axis
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Dna,
  Layers,
  RefreshCw,
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
import type { GenomeData, GenomeStrand, MonthlySequence } from '@/app/api/genome/route'

// ─── Category color map ───────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; text: string; bar: string; dot: string }> = {
  Politics:    { bg: 'bg-for-500/10',    text: 'text-for-300',     bar: 'bg-for-500',      dot: '#3b82f6' },
  Economics:   { bg: 'bg-gold/10',       text: 'text-gold',        bar: 'bg-gold',         dot: '#f59e0b' },
  Technology:  { bg: 'bg-emerald/10',    text: 'text-emerald',     bar: 'bg-emerald',      dot: '#10b981' },
  Ethics:      { bg: 'bg-purple/10',     text: 'text-purple',      bar: 'bg-purple',       dot: '#8b5cf6' },
  Science:     { bg: 'bg-sky-500/10',    text: 'text-sky-400',     bar: 'bg-sky-500',      dot: '#0ea5e9' },
  Culture:     { bg: 'bg-pink-500/10',   text: 'text-pink-400',    bar: 'bg-pink-500',     dot: '#ec4899' },
  Philosophy:  { bg: 'bg-indigo-500/10', text: 'text-indigo-400',  bar: 'bg-indigo-500',   dot: '#6366f1' },
  Health:      { bg: 'bg-teal-500/10',   text: 'text-teal-400',    bar: 'bg-teal-500',     dot: '#14b8a6' },
  Environment: { bg: 'bg-lime-500/10',   text: 'text-lime-400',    bar: 'bg-lime-500',     dot: '#84cc16' },
  Education:   { bg: 'bg-orange-500/10', text: 'text-orange-400',  bar: 'bg-orange-500',   dot: '#f97316' },
  Other:       { bg: 'bg-surface-300/10',text: 'text-surface-500', bar: 'bg-surface-400',  dot: '#6b7280' },
}

const DEFAULT_COLOR = { bg: 'bg-surface-300/10', text: 'text-surface-500', bar: 'bg-surface-400', dot: '#6b7280' }

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? DEFAULT_COLOR
}

// ─── Genome type badge colors ─────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Helical:     'border-gold/50 text-gold bg-gold/10',
  Crystalline: 'border-for-400/50 text-for-300 bg-for-500/10',
  Amorphous:   'border-purple/50 text-purple bg-purple/10',
  Mutant:      'border-against-400/50 text-against-300 bg-against-500/10',
  Stable:      'border-emerald/50 text-emerald bg-emerald/10',
  Polymorphic: 'border-sky-400/50 text-sky-400 bg-sky-500/10',
  Nascent:     'border-surface-400/50 text-surface-500 bg-surface-300/10',
  Standard:    'border-surface-400/50 text-surface-500 bg-surface-200/10',
}

// ─── DNA Sequence Visualizer ──────────────────────────────────────────────────

const BASE_COLORS: Record<string, string> = {
  A: 'text-for-400',
  C: 'text-gold',
  G: 'text-emerald',
  T: 'text-against-400',
}

function DnaSequence({ sequence }: { sequence: string }) {
  return (
    <div className="font-mono text-xs tracking-widest flex flex-wrap gap-px">
      {sequence.split('').map((base, i) => (
        <span
          key={i}
          className={cn('font-bold', BASE_COLORS[base] ?? 'text-surface-500')}
        >
          {base}
        </span>
      ))}
    </div>
  )
}

// ─── Monthly Spark Chart ──────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlySequence[] }) {
  if (months.length === 0) return null

  const MAX_VISIBLE = 12
  const visible = months.slice(-MAX_VISIBLE)
  const maxTotal = Math.max(...visible.map((m) => m.for_count + m.against_count), 1)

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-16">
        {visible.map((m, i) => {
          const total = m.for_count + m.against_count
          const heightPct = (total / maxTotal) * 100
          const forH = (m.for_count / Math.max(total, 1)) * heightPct
          const againstH = (m.against_count / Math.max(total, 1)) * heightPct

          return (
            <div
              key={m.month}
              className="relative flex-1 flex flex-col justify-end group"
              title={`${m.month}: ${m.for_count} FOR / ${m.against_count} AGAINST`}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${againstH}%` }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="w-full bg-against-500/60 rounded-t-sm"
                style={{ minHeight: total > 0 ? 2 : 0 }}
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${forH}%` }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="w-full bg-for-500/70"
                style={{ minHeight: total > 0 ? 2 : 0 }}
              />
              {/* Hover label */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 bg-surface-100 border border-surface-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-surface-600 whitespace-nowrap">
                {m.month.slice(5)} · {m.for_pct}% FOR
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-600">
        <span>{visible[0]?.month.slice(0, 7)}</span>
        <span>{visible[visible.length - 1]?.month.slice(0, 7)}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-surface-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-for-500/70 inline-block" />
          FOR
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-against-500/60 inline-block" />
          AGAINST
        </span>
      </div>
    </div>
  )
}

// ─── Strand Bar ───────────────────────────────────────────────────────────────

function StrandBar({ strand, maxVotes }: { strand: GenomeStrand; maxVotes: number }) {
  const c = catColor(strand.category)
  const barWidthPct = Math.round((strand.vote_count / Math.max(maxVotes, 1)) * 100)
  const forBarPct = strand.for_pct
  const againstBarPct = 100 - strand.for_pct
  const devDir = strand.deviation > 0 ? 'more FOR' : 'more AGAINST'
  const devAbs = Math.abs(strand.deviation)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className={cn('font-medium', c.text)}>{strand.category}</span>
          {devAbs >= 15 && (
            <span
              className={cn(
                'text-[9px] font-mono px-1 py-0.5 rounded border',
                strand.deviation > 0
                  ? 'border-for-500/40 text-for-400 bg-for-500/10'
                  : 'border-against-500/40 text-against-400 bg-against-500/10',
              )}
            >
              {devAbs}% {devDir}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-surface-600">
          <span>{strand.vote_count} votes</span>
          <span className="text-surface-500">{strand.consistency}% consistent</span>
        </div>
      </div>

      {/* Split bar: FOR (blue) | AGAINST (red) */}
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-200">
        <div className="absolute inset-0 flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${forBarPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-for-500/70"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${againstBarPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-against-500/60"
          />
        </div>
        {/* Midline marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-surface-400/50" />
      </div>

      {/* Vote volume indicator */}
      <div className="h-0.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidthPct}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={cn('h-full', c.bar, 'opacity-60')}
        />
      </div>
    </motion.div>
  )
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  value,
  label,
  color,
  size = 80,
}: {
  value: number
  label: string
  color: string
  size?: number
}) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e2e" strokeWidth={6} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="text-center -mt-1">
        <div className="text-lg font-bold text-white font-mono">{value}</div>
        <div className="text-[10px] text-surface-600 font-mono uppercase tracking-widest">{label}</div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function GenomeClient() {
  const router = useRouter()
  const [data, setData] = useState<GenomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/genome')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load genome data')
      const json: GenomeData = await res.json()
      setData(json)
    } catch {
      setError('Could not load your civic genome. Try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    load()
  }, [load])

  const maxVotes = data
    ? Math.max(...data.strands.map((s) => s.vote_count), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-surface-600 text-xs font-mono">
            <Link href="/fingerprint" className="hover:text-surface-500 transition-colors">
              Fingerprint
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">Genome</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Dna className="h-5 w-5 text-for-400" />
                Civic Genome
              </h1>
              <p className="text-sm text-surface-600 mt-0.5">
                The full sequence of your civic DNA — strands, evolution, and type.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg bg-surface-200/50 hover:bg-surface-200 border border-surface-300 text-surface-600 hover:text-white transition-all disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Activity}
            title="Genome unavailable"
            description={error}
            actions={[{ label: 'Retry', onClick: load }]}
          />
        )}

        <AnimatePresence mode="wait">
          {!loading && !error && data && (
            <motion.div
              key="genome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* ── Genome type header ─────────────────────────────────────── */}
              <div className="bg-surface-100 border border-surface-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-mono px-2 py-0.5 rounded border',
                          TYPE_COLORS[data.genome_type] ?? TYPE_COLORS.Standard,
                        )}
                      >
                        {data.genome_type} Genome
                      </span>
                    </div>
                    <p className="text-sm text-surface-600 leading-relaxed">
                      {data.genome_description}
                    </p>
                  </div>
                </div>

                {/* DNA sequence */}
                <div className="bg-surface-200/50 rounded-lg p-3 border border-surface-300">
                  <div className="text-[10px] font-mono text-surface-600 mb-1.5 uppercase tracking-widest">
                    Sequence
                  </div>
                  <DnaSequence sequence={data.dna_sequence} />
                </div>

                {/* Score rings */}
                <div className="flex items-center justify-around pt-2">
                  <ScoreRing value={data.genome_score} label="Genome" color="#3b82f6" />
                  <ScoreRing value={data.breadth} label="Breadth" color="#10b981" size={70} />
                  <ScoreRing value={data.depth} label="Depth" color="#f59e0b" size={70} />
                  <ScoreRing value={data.consistency_score} label="Consist." color="#8b5cf6" size={70} />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-surface-600 border-t border-surface-200 pt-3">
                  <span>{data.total_votes} votes sequenced</span>
                  <span>{data.active_categories} active strands</span>
                </div>
              </div>

              {/* ── Empty state ───────────────────────────────────────────── */}
              {data.total_votes < 5 && (
                <EmptyState
                  icon={Dna}
                  title="Not enough data"
                  description="Vote on at least 5 topics to generate your civic genome sequence."
                  actions={[{ label: 'Browse topics', href: '/' }]}
                />
              )}

              {data.total_votes >= 5 && (
                <>
                  {/* ── Dominant / Recessive strands ─────────────────────── */}
                  {(data.dominant_strand || data.recessive_strand) && (
                    <div className="grid grid-cols-2 gap-3">
                      {data.dominant_strand && (
                        <div className="bg-surface-100 border border-surface-200 rounded-xl p-4 space-y-1.5">
                          <div className="text-[10px] font-mono text-surface-600 uppercase tracking-widest flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-emerald" />
                            Dominant Strand
                          </div>
                          <div className={cn('text-sm font-semibold', catColor(data.dominant_strand.category).text)}>
                            {data.dominant_strand.category}
                          </div>
                          <div className="text-xs text-surface-600 font-mono">
                            {data.dominant_strand.vote_count} votes · {data.dominant_strand.consistency}% consistent
                          </div>
                          <div className="text-xs text-surface-600">
                            {data.dominant_strand.for_pct}% FOR
                          </div>
                        </div>
                      )}
                      {data.recessive_strand && (
                        <div className="bg-surface-100 border border-surface-200 rounded-xl p-4 space-y-1.5">
                          <div className="text-[10px] font-mono text-surface-600 uppercase tracking-widest flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-against-400" />
                            Recessive Strand
                          </div>
                          <div className={cn('text-sm font-semibold', catColor(data.recessive_strand.category).text)}>
                            {data.recessive_strand.category}
                          </div>
                          <div className="text-xs text-surface-600 font-mono">
                            {data.recessive_strand.vote_count} votes · {data.recessive_strand.consistency}% consistent
                          </div>
                          <div className="text-xs text-surface-600">
                            Most conflicted strand
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Strand breakdown ─────────────────────────────────── */}
                  <div className="bg-surface-100 border border-surface-200 rounded-xl p-5 space-y-5">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-surface-500" />
                      <h2 className="text-sm font-semibold text-white">Strand Breakdown</h2>
                      <span className="ml-auto text-[10px] font-mono text-surface-600">
                        {data.strands.length} strands
                      </span>
                    </div>

                    <div className="space-y-4">
                      {data.strands.map((strand) => (
                        <StrandBar key={strand.category} strand={strand} maxVotes={maxVotes} />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-surface-600 border-t border-surface-200 pt-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-for-500/70 inline-block" />
                        FOR
                      </span>
                      <span>bar width = vote volume</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-against-500/60 inline-block" />
                        AGAINST
                      </span>
                    </div>
                  </div>

                  {/* ── Monthly evolution ────────────────────────────────── */}
                  {data.monthly_sequence.length >= 2 && (
                    <div className="bg-surface-100 border border-surface-200 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-surface-500" />
                        <h2 className="text-sm font-semibold text-white">Genome Evolution</h2>
                        <span className="ml-auto text-[10px] font-mono text-surface-600">
                          {data.monthly_sequence.length} months
                        </span>
                      </div>
                      <MonthlyChart months={data.monthly_sequence} />
                    </div>
                  )}

                  {/* ── Related tools ─────────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        href: '/fingerprint',
                        label: 'Fingerprint',
                        description: 'How unique vs. consensus',
                        icon: Sparkles,
                        color: 'text-gold',
                      },
                      {
                        href: '/twins',
                        label: 'Civic Twins',
                        description: 'Users with matching genomes',
                        icon: Zap,
                        color: 'text-for-400',
                      },
                      {
                        href: '/archetype',
                        label: 'Archetype',
                        description: 'Your civic personality type',
                        icon: BarChart2,
                        color: 'text-purple',
                      },
                      {
                        href: '/calibration',
                        label: 'Calibration',
                        description: 'Predictive accuracy score',
                        icon: Activity,
                        color: 'text-emerald',
                      },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="bg-surface-100 border border-surface-200 rounded-xl p-4 hover:border-surface-400 hover:bg-surface-200/50 transition-all group"
                      >
                        <item.icon className={cn('h-4 w-4 mb-2', item.color)} />
                        <div className="text-xs font-semibold text-white">{item.label}</div>
                        <div className="text-[11px] text-surface-600 mt-0.5">{item.description}</div>
                        <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-surface-500 mt-1.5 transition-colors" />
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {/* ── Refresh ───────────────────────────────────────────────── */}
              <div className="flex justify-center pt-1">
                <button
                  onClick={load}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono text-surface-500 hover:text-white bg-surface-200/50 hover:bg-surface-200 border border-surface-300 transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh sequence
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
