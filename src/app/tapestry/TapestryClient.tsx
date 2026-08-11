'use client'

/**
 * /tapestry — Civic Tapestry
 *
 * Every established law rendered as a woven thread, grouped into horizontal
 * category "warp stripes". Thread width scales with vote count; colour encodes
 * consensus tier (unanimous → deep blue, slim → gold). Hovering reveals the
 * law statement and a link to the law page.
 *
 * Distinct from:
 *  /mosaic   — all topics (any status) as a tile grid, coloured by FOR/AGAINST lean
 *  /orrery   — solar-system topology
 *  /spectrum — consensus histogram of active debates
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Gavel,
  Info,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { QualityLaw, QualityLawsResponse } from '@/app/api/laws/quality/route'

// ─── Consensus tier styling ───────────────────────────────────────────────────

const TIER_STYLE: Record<
  string,
  { thread: string; glow: string; badge: string; label: string }
> = {
  unanimous: {
    thread: 'bg-for-500 border-for-400',
    glow: 'shadow-for-500/30',
    badge: 'bg-for-500/20 text-for-300 border-for-500/40',
    label: 'Unanimous',
  },
  strong: {
    thread: 'bg-for-600 border-for-500',
    glow: 'shadow-for-600/20',
    badge: 'bg-for-600/20 text-for-400 border-for-500/30',
    label: 'Strong',
  },
  clear: {
    thread: 'bg-for-700 border-for-600',
    glow: 'shadow-for-700/20',
    badge: 'bg-for-700/20 text-for-400 border-for-600/30',
    label: 'Clear',
  },
  slim: {
    thread: 'bg-gold/60 border-gold/80',
    glow: 'shadow-gold/20',
    badge: 'bg-gold/10 text-gold border-gold/30',
    label: 'Slim',
  },
  contested: {
    thread: 'bg-gold/30 border-gold/50',
    glow: 'shadow-gold/10',
    badge: 'bg-gold/5 text-gold/80 border-gold/20',
    label: 'Contested',
  },
}

function getTierStyle(tier: string) {
  return TIER_STYLE[tier] ?? TIER_STYLE.clear
}

// ─── Category metadata ────────────────────────────────────────────────────────

const CAT_META: Record<string, { accent: string; stripe: string }> = {
  Economics:   { accent: 'text-gold',        stripe: 'bg-gold/5 border-gold/20' },
  Politics:    { accent: 'text-for-400',     stripe: 'bg-for-500/5 border-for-500/20' },
  Technology:  { accent: 'text-purple',      stripe: 'bg-purple/5 border-purple/20' },
  Science:     { accent: 'text-emerald',     stripe: 'bg-emerald/5 border-emerald/20' },
  Ethics:      { accent: 'text-against-300', stripe: 'bg-against-500/5 border-against-500/20' },
  Philosophy:  { accent: 'text-purple',      stripe: 'bg-purple/5 border-purple/20' },
  Culture:     { accent: 'text-amber-400',   stripe: 'bg-amber-500/5 border-amber-500/20' },
  Health:      { accent: 'text-rose-400',    stripe: 'bg-rose-500/5 border-rose-500/20' },
  Environment: { accent: 'text-emerald',     stripe: 'bg-emerald/5 border-emerald/20' },
  Education:   { accent: 'text-sky-400',     stripe: 'bg-sky-500/5 border-sky-500/20' },
}

function getCatMeta(cat: string | null) {
  return (cat && CAT_META[cat]) ?? { accent: 'text-surface-500', stripe: 'bg-surface-200/40 border-surface-300/40' }
}

// ─── Thread width ─────────────────────────────────────────────────────────────

function threadWidth(votes: number, maxVotes: number): string {
  if (maxVotes === 0) return 'w-12'
  const ratio = Math.sqrt(votes / maxVotes)
  if (ratio > 0.85) return 'w-48 sm:w-64'
  if (ratio > 0.6) return 'w-32 sm:w-48'
  if (ratio > 0.35) return 'w-20 sm:w-32'
  if (ratio > 0.15) return 'w-14 sm:w-20'
  return 'w-10 sm:w-14'
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  law: QualityLaw
  onClose: () => void
}

function LawTooltip({ law, onClose }: TooltipProps) {
  const tier = getTierStyle(law.consensus_tier)
  const forPct = Math.round(law.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-x-4 bottom-20 md:bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[400px] z-50"
    >
      <div className="rounded-2xl bg-surface-100/96 border border-surface-300 shadow-2xl backdrop-blur-sm p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', tier.badge)}>
              {tier.label} mandate
            </span>
            {law.category && (
              <span className={cn('text-[10px] font-mono', getCatMeta(law.category).accent)}>
                {law.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="font-mono text-sm font-semibold text-white leading-snug mb-3">
          {law.statement}
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-for-400 font-bold">{forPct}% FOR</span>
            <span className="text-surface-500">{law.total_votes.toLocaleString()} votes</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        <Link
          href={`/law/${law.id}`}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-gold/15 border border-gold/30 text-gold text-sm font-mono font-semibold hover:bg-gold/25 transition-colors"
        >
          <Gavel className="h-3.5 w-3.5" />
          View this law
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Thread ───────────────────────────────────────────────────────────────────

interface ThreadProps {
  law: QualityLaw
  maxVotes: number
  onSelect: (law: QualityLaw) => void
  selected: boolean
}

function LawThread({ law, maxVotes, onSelect, selected }: ThreadProps) {
  const tier = getTierStyle(law.consensus_tier)
  const width = threadWidth(law.total_votes, maxVotes)

  return (
    <button
      onClick={() => onSelect(law)}
      title={law.statement}
      aria-label={`${law.statement} — ${law.blue_pct}% FOR, ${law.total_votes} votes`}
      className={cn(
        'h-8 flex-shrink-0 rounded-sm border transition-all duration-150',
        'hover:opacity-90 hover:scale-y-110 hover:z-10 active:scale-95',
        'focus:outline-none focus:ring-1 focus:ring-for-400/60',
        tier.thread,
        width,
        selected && 'ring-2 ring-white/60 scale-y-110',
      )}
    />
  )
}

// ─── Category stripe ──────────────────────────────────────────────────────────

interface StripeProps {
  category: string
  laws: QualityLaw[]
  maxVotes: number
  selectedLawId: string | null
  onSelect: (law: QualityLaw) => void
}

function CategoryStripe({ category, laws, maxVotes, selectedLawId, onSelect }: StripeProps) {
  const meta = getCatMeta(category)

  return (
    <div className={cn('rounded-xl border p-4', meta.stripe)}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('text-xs font-mono font-bold uppercase tracking-widest', meta.accent)}>
          {category}
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          {laws.length} law{laws.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Threads */}
      <div className="flex flex-wrap gap-1">
        {laws.map((law) => (
          <LawThread
            key={law.id}
            law={law}
            maxVotes={maxVotes}
            onSelect={onSelect}
            selected={selectedLawId === law.id}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-[11px] font-mono text-surface-500 font-semibold uppercase tracking-wider mb-3">
        Thread key
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {Object.entries(TIER_STYLE).map(([tier, style]) => (
          <div key={tier} className="flex items-center gap-2">
            <div className={cn('h-4 w-10 rounded-sm border flex-shrink-0', style.thread)} />
            <span className="text-[11px] font-mono text-surface-400">{style.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-surface-500">Width = vote count</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TapestryClient() {
  const [data, setData] = useState<QualityLawsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<QualityLaw | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [showLegend, setShowLegend] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/laws/quality?limit=100&sort=votes', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load laws')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Group laws by category ───────────────────────────────────────────────

  const { grouped, categories, maxVotes } = useMemo(() => {
    const laws = data?.laws ?? []
    const filtered = activeCategory === 'All' ? laws : laws.filter(l => l.category === activeCategory)

    const map = new Map<string, QualityLaw[]>()
    let max = 1

    for (const law of filtered) {
      const cat = law.category ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(law)
      if (law.total_votes > max) max = law.total_votes
    }

    // Sort laws within each category by vote count descending
    for (const [, arr] of map) {
      arr.sort((a, b) => b.total_votes - a.total_votes)
    }

    // Sort categories by law count descending
    const cats = Array.from(map.keys()).sort(
      (a, b) => (map.get(b)?.length ?? 0) - (map.get(a)?.length ?? 0)
    )

    return { grouped: map, categories: cats, maxVotes: max }
  }, [data, activeCategory])

  const allCategories = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    for (const l of data.laws) if (l.category) s.add(l.category)
    return ['All', ...Array.from(s).sort()]
  }, [data])

  const stats = data?.stats

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Link
              href="/laws"
              className="mt-1 text-surface-500 hover:text-white transition-colors"
              aria-label="Back to laws"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-gold" />
                <h1 className="font-mono text-2xl font-bold text-white">Civic Tapestry</h1>
              </div>
              <p className="text-sm font-mono text-surface-500 max-w-xl">
                Every established law as a woven thread — grouped by category, coloured by consensus tier, sized by vote mandate.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowLegend(v => !v)}
              className={cn(
                'p-2 rounded-lg border text-surface-400 hover:text-white transition-colors',
                showLegend ? 'bg-surface-300 border-surface-400 text-white' : 'border-surface-300 hover:border-surface-400',
              )}
              aria-label="Toggle legend"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <AnimatePresence>
          {showLegend && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <Legend />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Laws woven', value: stats.total, color: 'text-gold' },
              { label: 'Unanimous', value: stats.unanimous_count, color: 'text-for-300' },
              { label: 'Strong mandate', value: stats.strong_count, color: 'text-for-400' },
              { label: 'Avg mandate', value: `+${Math.round(stats.avg_mandate)}%`, color: 'text-emerald' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">{label}</p>
                <p className={cn('font-mono text-2xl font-bold', color)}>{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Category filter */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {allCategories.map(cat => {
              const meta = cat === 'All' ? null : getCatMeta(cat)
              const active = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all',
                    active
                      ? cat === 'All'
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : cn('border-current/50 bg-current/10', meta?.accent)
                      : 'bg-surface-200/60 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        )}

        {/* Tapestry */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 12 }).map((_, j) => (
                    <Skeleton key={j} className={cn('h-8 rounded-sm', j % 4 === 0 ? 'w-32' : j % 3 === 0 ? 'w-20' : 'w-14')} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-900/30 border border-against-700/40 p-8 text-center">
            <p className="text-against-400 text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center">
            <Gavel className="h-8 w-8 text-surface-600 mx-auto mb-3" />
            <p className="font-mono text-sm text-surface-500">No laws established yet.</p>
            <Link
              href="/law"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300"
            >
              Browse debates <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map(cat => (
              <CategoryStripe
                key={cat}
                category={cat}
                laws={grouped.get(cat) ?? []}
                maxVotes={maxVotes}
                selectedLawId={selected?.id ?? null}
                onSelect={(law) => setSelected(law)}
              />
            ))}

            <p className="text-[11px] font-mono text-surface-600 text-center pt-2">
              {data?.stats.total ?? 0} laws · click any thread to explore · sorted by vote count within each category
            </p>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Law tooltip */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-surface-900/30 backdrop-blur-[2px] z-40"
              onClick={() => setSelected(null)}
            />
            <LawTooltip law={selected} onClose={() => setSelected(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
