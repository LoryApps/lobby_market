'use client'

/**
 * /law/conflicts — Civic Law Conflict Detector
 *
 * Surfaces pairs of established laws that may be in tension with each other:
 *   • Opposition  — one law bans/restricts what the other allows/expands
 *   • Overlap     — both laws address the same subject matter
 *   • Scope       — both reference the same concepts but from different angles
 *
 * Distinct from:
 *   /law/compare   — user-selected side-by-side comparison of two specific laws
 *   /correlations  — cross-topic vote correlation (based on voter behaviour)
 *   /law/graph     — structural wikilinks between laws
 *
 * This page answers: "Which laws in the Codex might contradict each other?"
 * It helps citizens identify areas needing clarification or amendment.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Layers,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Swords,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConflictPair, ConflictsResponse, ConflictType } from '@/app/api/laws/conflicts/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Health:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Conflict type config ─────────────────────────────────────────────────────

const CONFLICT_CONFIG: Record<ConflictType, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  borderClass: string
  bgClass: string
  textClass: string
  badgeClass: string
}> = {
  opposition: {
    label: 'Direct Opposition',
    icon: Swords,
    borderClass: 'border-against-500/40',
    bgClass: 'bg-against-500/5',
    textClass: 'text-against-400',
    badgeClass: 'bg-against-500/15 text-against-300 border-against-500/30',
  },
  overlap: {
    label: 'Substantive Overlap',
    icon: Layers,
    borderClass: 'border-gold/40',
    bgClass: 'bg-gold/5',
    textClass: 'text-gold',
    badgeClass: 'bg-gold/15 text-gold border-gold/30',
  },
  scope: {
    label: 'Scope Tension',
    icon: AlertTriangle,
    borderClass: 'border-purple/40',
    bgClass: 'bg-purple/5',
    textClass: 'text-purple',
    badgeClass: 'bg-purple/15 text-purple border-purple/30',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function pct(v: number | null): string {
  if (v == null) return '50'
  return Math.round(v).toString()
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ConflictSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ─── Law card ────────────────────────────────────────────────────────────────

function LawCard({
  law,
  label,
  labelClass,
}: {
  law: ConflictPair['law_a']
  label: string
  labelClass: string
}) {
  const catColor = CATEGORY_COLORS[law.category ?? ''] ?? {
    text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/20',
  }
  const forPct = pct(law.blue_pct)

  return (
    <div className="flex-1 bg-surface-200/40 rounded-xl p-4 border border-surface-400/30 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', labelClass)}>
          {label}
        </span>
        {law.category && (
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border', catColor.text, catColor.bg, catColor.border)}>
            {law.category}
          </span>
        )}
      </div>

      <p className="text-sm text-white leading-snug line-clamp-3 flex-1">
        {law.statement}
      </p>

      <div className="flex items-center gap-3 mt-auto pt-1">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-16 bg-surface-400/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-for-400">{forPct}%</span>
        </div>
        <span className="text-[11px] font-mono text-surface-500">
          {fmtVotes(law.total_votes)} votes
        </span>
        <Link
          href={`/law/${law.id}`}
          className="ml-auto flex items-center gap-0.5 text-[11px] font-mono text-surface-500 hover:text-for-300 transition-colors flex-shrink-0"
          target="_blank"
          rel="noopener"
        >
          View <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  )
}

// ─── Conflict card ────────────────────────────────────────────────────────────

function ConflictCard({ pair, index }: { pair: ConflictPair; index: number }) {
  const config = CONFLICT_CONFIG[pair.conflict_type]
  const Icon = config.icon
  const similarityPct = Math.round(pair.similarity_score * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4',
        config.borderClass,
        config.bgClass,
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono font-semibold border', config.badgeClass)}>
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          {config.label}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs font-mono text-surface-500">
            Similarity:
          </span>
          <span className={cn('text-xs font-mono font-bold', config.textClass)}>
            {similarityPct}%
          </span>
        </div>
      </div>

      {/* Law pair */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LawCard law={pair.law_a} label="Law A" labelClass="text-for-400" />
        <LawCard law={pair.law_b} label="Law B" labelClass="text-against-400" />
      </div>

      {/* Conflict signal */}
      <div className="flex items-start gap-2 bg-surface-200/50 rounded-xl px-4 py-3 border border-surface-400/20">
        <Info className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', config.textClass)} />
        <p className="text-xs font-mono text-surface-400 leading-relaxed">
          {pair.conflict_signal}
        </p>
      </div>

      {/* Shared words */}
      {pair.shared_words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pair.shared_words.map((word) => (
            <span
              key={word}
              className="inline-flex items-center rounded-md bg-surface-200/60 border border-surface-400/20 px-2 py-0.5 text-[11px] font-mono text-surface-400"
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {/* Compare CTA */}
      <Link
        href={`/law/compare?a=${pair.law_a.id}&b=${pair.law_b.id}`}
        className={cn(
          'flex items-center gap-2 text-xs font-mono font-semibold transition-colors',
          config.textClass,
          'hover:opacity-80'
        )}
      >
        <Scale className="h-3.5 w-3.5" />
        Compare these laws in depth
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({
  pairs,
  totalLaws,
}: {
  pairs: ConflictPair[]
  totalLaws: number
}) {
  const oppositionCount = pairs.filter((p) => p.conflict_type === 'opposition').length
  const overlapCount = pairs.filter((p) => p.conflict_type === 'overlap').length
  const scopeCount = pairs.filter((p) => p.conflict_type === 'scope').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Laws Analyzed', value: totalLaws, color: 'text-for-400', Icon: Gavel },
        { label: 'Conflicts Found', value: pairs.length, color: 'text-against-400', Icon: Swords },
        { label: 'Oppositions', value: oppositionCount, color: 'text-against-400', Icon: Swords },
        { label: 'Overlaps', value: overlapCount + scopeCount, color: 'text-gold', Icon: Layers },
      ].map(({ label, value, color, Icon }) => (
        <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <div className={cn('flex items-center gap-1.5 text-xs font-mono mb-2', color)}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
          <p className="text-2xl font-mono font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LawConflictsClient() {
  const [data, setData] = useState<ConflictsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<ConflictType | 'all'>('all')
  const [infoOpen, setInfoOpen] = useState(false)

  const load = useCallback(async (cat: string | null, showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '40' })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/laws/conflicts?${params}`)
      if (!res.ok) throw new Error('Failed to load conflicts')
      setData(await res.json())
    } catch {
      setError('Failed to load the Law Conflict Detector. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(selectedCategory)
  }, [load, selectedCategory])

  const filteredPairs = data?.pairs.filter(
    (p) => selectedType === 'all' || p.conflict_type === selectedType
  ) ?? []

  const typeCounts = {
    opposition: data?.pairs.filter((p) => p.conflict_type === 'opposition').length ?? 0,
    overlap: data?.pairs.filter((p) => p.conflict_type === 'overlap').length ?? 0,
    scope: data?.pairs.filter((p) => p.conflict_type === 'scope').length ?? 0,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Swords className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Law Conflicts</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Laws in the Codex that may contradict or overlap
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setInfoOpen((o) => !o)}
              aria-label="How this works"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => load(selectedCategory, true)}
              disabled={refreshing || loading}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {infoOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">How conflict detection works</p>
                  <button onClick={() => setInfoOpen(false)} className="text-surface-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.entries(CONFLICT_CONFIG) as [ConflictType, typeof CONFLICT_CONFIG[ConflictType]][]).map(([type, config]) => {
                    const Icon = config.icon
                    return (
                      <div key={type} className={cn('rounded-xl p-3 border', config.borderClass, config.bgClass)}>
                        <div className={cn('flex items-center gap-1.5 text-xs font-mono font-semibold mb-2', config.textClass)}>
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </div>
                        <p className="text-xs text-surface-400">
                          {type === 'opposition'
                            ? 'One law bans or restricts something that the other explicitly allows or expands.'
                            : type === 'overlap'
                            ? 'Both laws address the same subject matter with significant keyword overlap (40%+ match).'
                            : 'Both laws reference the same concepts but from different angles — potential scope clash.'}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-surface-500 font-mono">
                  Detection uses lexical analysis: word overlap (Jaccard similarity) and opposition keyword pairs.
                  This surfaces <em>potential</em> conflicts for community review — not definitive legal analysis.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold border transition-all',
              selectedCategory === null
                ? 'bg-for-500/20 text-for-300 border-for-500/40'
                : 'bg-surface-200 text-surface-500 border-surface-400/40 hover:bg-surface-300 hover:text-white'
            )}
          >
            <Gavel className="h-3 w-3" />
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICON[cat] ?? Gavel
            const colors = CATEGORY_COLORS[cat]
            const isActive = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold border transition-all',
                  isActive
                    ? cn(colors.text, colors.bg, colors.border)
                    : 'bg-surface-200 text-surface-500 border-surface-400/40 hover:bg-surface-300 hover:text-white'
                )}
              >
                <Icon className="h-3 w-3" />
                {cat}
              </button>
            )
          })}
        </div>

        {loading ? (
          <ConflictSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-10 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-surface-500 text-sm font-mono mb-4">{error}</p>
            <button
              onClick={() => load(selectedCategory)}
              className="text-for-400 hover:text-for-300 text-sm font-mono transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !data || data.pairs.length === 0 ? (
          <EmptyState
            icon={Scale}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No conflicts detected"
            description={
              selectedCategory
                ? `No conflicting laws found in the ${selectedCategory} category — the Codex looks clean here.`
                : 'No significant conflicts detected across the Codex. The laws appear internally consistent.'
            }
            actions={[
              { label: 'Browse the Codex', href: '/law', variant: 'primary' },
            ]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedCategory}-${selectedType}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Stats */}
              <StatsStrip pairs={data.pairs} totalLaws={data.total_laws_analyzed} />

              {/* Type filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-surface-500 mr-1">Filter:</span>
                {((['all', 'opposition', 'overlap', 'scope'] as const)).map((type) => {
                  const isActive = selectedType === type
                  const count =
                    type === 'all'
                      ? data.pairs.length
                      : typeCounts[type]
                  const config = type !== 'all' ? CONFLICT_CONFIG[type] : null
                  const Icon = config?.icon ?? Layers
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold border transition-all',
                        isActive && type !== 'all'
                          ? config!.badgeClass
                          : isActive
                          ? 'bg-for-500/20 text-for-300 border-for-500/40'
                          : 'bg-surface-200 text-surface-500 border-surface-400/40 hover:bg-surface-300 hover:text-white'
                      )}
                    >
                      {type !== 'all' && <Icon className="h-3 w-3" />}
                      {type === 'all' ? 'All' : CONFLICT_CONFIG[type].label}
                      <span className="opacity-60">({count})</span>
                    </button>
                  )
                })}
              </div>

              {/* Conflict pairs */}
              {filteredPairs.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-surface-500 text-sm font-mono">No {selectedType} conflicts in this view.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPairs.map((pair, i) => (
                    <ConflictCard key={`${pair.law_a.id}-${pair.law_b.id}`} pair={pair} index={i} />
                  ))}
                </div>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
                <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-mono text-surface-500 leading-relaxed">
                  Conflicts are detected using keyword similarity analysis, not legal reasoning.
                  A detected conflict means these laws share significant subject matter — whether they truly
                  conflict requires human judgement. Use{' '}
                  <Link href="/law/compare" className="text-for-400 hover:text-for-300">
                    Law Compare
                  </Link>{' '}
                  to review any pair in depth.
                </p>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/law"
                  className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-for-300 transition-colors"
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Browse the Codex
                </Link>
                <Link
                  href="/amendments"
                  className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-for-300 transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Propose Amendments
                </Link>
                <Link
                  href="/law/quality"
                  className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-for-300 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Law Quality Index
                </Link>
                <Link
                  href="/correlations"
                  className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-for-300 transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Vote Correlations
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
