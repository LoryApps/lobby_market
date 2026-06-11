'use client'

/**
 * /values — The Civic Values Engine
 *
 * Uses AI to analyze all democratically-established laws and surface the
 * underlying civic values the community's collective decisions express.
 * Think of it as a "value fingerprint" extracted from democratic outcomes.
 *
 * Distinct from:
 *   /constitution  — the full text of all laws as a document
 *   /laws          — browse laws by category
 *   /bedrock       — laws ranked by durability and consensus strength
 *   /mandate       — topics with 70%+ consensus (current opinions, not laws)
 *
 * This page answers: "What does this community BELIEVE, based on what it has chosen?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Brain,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  Heart,
  Layers,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CivicValue, ValuesResult } from '@/app/api/values/route'

// ─── Spectrum config ──────────────────────────────────────────────────────────

const SPECTRUM_CONFIG: Record<
  CivicValue['spectrum'],
  { label: string; color: string; bg: string; border: string; icon: typeof Globe }
> = {
  individual: {
    label: 'Individual',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Heart,
  },
  collective: {
    label: 'Collective',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Users,
  },
  institutional: {
    label: 'Institutional',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Building2,
  },
  procedural: {
    label: 'Procedural',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Scale,
  },
}

const STRENGTH_CONFIG: Record<
  CivicValue['strength'],
  { label: string; color: string; dots: number }
> = {
  foundational: { label: 'Foundational', color: 'text-gold', dots: 3 },
  strong: { label: 'Strong', color: 'text-for-300', dots: 2 },
  emerging: { label: 'Emerging', color: 'text-surface-500', dots: 1 },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'bg-gold/15 text-gold border-gold/30',
  Politics: 'bg-for-500/15 text-for-300 border-for-500/30',
  Technology: 'bg-purple/15 text-purple border-purple/30',
  Science: 'bg-emerald/15 text-emerald border-emerald/30',
  Ethics: 'bg-against-500/15 text-against-300 border-against-500/30',
  Philosophy: 'bg-surface-400/15 text-surface-300 border-surface-400/30',
  Culture: 'bg-for-600/15 text-for-400 border-for-600/30',
  Health: 'bg-emerald/15 text-emerald border-emerald/30',
  Environment: 'bg-emerald/20 text-emerald border-emerald/40',
  Education: 'bg-gold/15 text-gold border-gold/30',
}

// ─── Value Card ───────────────────────────────────────────────────────────────

function ValueCard({ value, index }: { value: CivicValue; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const spectrum = SPECTRUM_CONFIG[value.spectrum]
  const strength = STRENGTH_CONFIG[value.strength]
  const SpectrumIcon = spectrum.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className={cn(
        'rounded-2xl border bg-surface-100/80 overflow-hidden',
        'transition-all duration-200',
        expanded ? 'border-surface-400/60' : 'border-surface-300/50 hover:border-surface-400/60',
      )}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4 sm:p-5"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {/* Spectrum badge */}
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border',
              spectrum.bg,
              spectrum.border,
            )}
          >
            <SpectrumIcon className={cn('w-5 h-5', spectrum.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                {value.name}
              </h2>
              {/* Strength dots */}
              <span
                className={cn('flex items-center gap-0.5', strength.color)}
                aria-label={`${strength.label} value`}
                title={strength.label}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      i < strength.dots ? 'bg-current' : 'bg-surface-400/40',
                    )}
                  />
                ))}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-surface-500 mt-0.5 leading-snug">
              {value.tagline}
            </p>

            {/* Category pills */}
            <div className="flex flex-wrap gap-1 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  spectrum.bg,
                  spectrum.border,
                  spectrum.color,
                )}
              >
                <SpectrumIcon className="w-2.5 h-2.5" />
                {spectrum.label}
              </span>
              {value.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className={cn(
                    'inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                    CATEGORY_COLORS[cat] ?? 'bg-surface-300/20 text-surface-400 border-surface-400/30',
                  )}
                >
                  {cat}
                </span>
              ))}
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300/30">
                {value.law_count} law{value.law_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <div className="flex-shrink-0 mt-1">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-surface-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-surface-500" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 border-t border-surface-300/30 pt-4 space-y-4">
              {/* Description */}
              <p className="text-sm text-surface-400 leading-relaxed">{value.description}</p>

              {/* Principle */}
              <blockquote className="border-l-2 border-for-500/50 pl-3">
                <p className="text-sm italic text-surface-300 leading-relaxed">
                  {value.principle}
                </p>
              </blockquote>

              {/* Supporting laws */}
              {value.supporting_laws.length > 0 && (
                <div>
                  <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                    Supporting Laws
                  </p>
                  <div className="space-y-2">
                    {value.supporting_laws.map((law) => (
                      <Link
                        key={law.id}
                        href={`/law/${law.id}`}
                        className="flex items-start gap-2.5 group"
                      >
                        <Gavel className="w-3.5 h-3.5 text-gold mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-surface-300 group-hover:text-white transition-colors leading-snug line-clamp-2">
                            {law.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {law.category && (
                              <span className="text-[10px] text-surface-600 font-mono">
                                {law.category}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-for-400">
                              {Math.round(law.blue_pct)}% for
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ValueSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/80 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3 w-56 rounded" />
          <div className="flex gap-1">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Spectrum Filter ──────────────────────────────────────────────────────────

type SpectrumFilter = CivicValue['spectrum'] | 'all'

const FILTER_OPTIONS: { id: SpectrumFilter; label: string; icon: typeof Globe }[] = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'individual', label: 'Individual', icon: Heart },
  { id: 'collective', label: 'Collective', icon: Users },
  { id: 'institutional', label: 'Institutional', icon: Building2 },
  { id: 'procedural', label: 'Procedural', icon: Scale },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function ValuesClient() {
  const [result, setResult] = useState<ValuesResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<SpectrumFilter>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/values', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch error')
      const data: ValuesResult = await res.json()
      if (data.unavailable) {
        setError(true)
      } else {
        setResult(data)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered =
    result?.values.filter((v) => filter === 'all' || v.spectrum === filter) ?? []

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-surface-500 mb-3">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-surface-300">Values</span>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple/15 border border-purple/30 flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Civic Values</h1>
              <p className="text-sm text-surface-500 mt-1 leading-snug">
                The values the community expresses through its established laws — inferred by AI
                from collective democratic outcomes.
              </p>
            </div>
          </div>

          {result && !loading && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-surface-600 font-mono">
                Analyzed {result.total_laws_analyzed} established laws
              </p>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Regenerate value analysis"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                Regenerate
              </button>
            </div>
          )}
        </div>

        {/* Summary card */}
        <AnimatePresence mode="wait">
          {!loading && result?.summary && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-5 p-4 rounded-xl bg-purple/10 border border-purple/25"
            >
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple mt-0.5 flex-shrink-0" />
                <p className="text-sm text-surface-300 leading-relaxed">{result.summary}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spectrum filter */}
        {!loading && !error && (
          <div className="mb-5 flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                  filter === id
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-200/60 text-surface-500 border-surface-300/50 hover:border-surface-400/60 hover:text-surface-300',
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-surface-500 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing {''} laws for patterns&hellip;</span>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <ValueSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="text-center py-16">
            <Zap className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400 font-semibold">Could not generate value analysis</p>
            <p className="text-sm text-surface-600 mt-1">
              The AI service may be temporarily unavailable, or there may not be enough laws yet.
            </p>
            <button
              onClick={() => load()}
              className="mt-4 px-4 py-2 bg-surface-200 hover:bg-surface-300 text-white text-sm rounded-lg font-mono font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Values grid */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((value, i) => (
              <ValueCard key={value.id} value={value} index={i} />
            ))}
          </div>
        )}

        {/* Empty filter state */}
        {!loading && !error && result && filtered.length === 0 && (
          <div className="text-center py-12">
            <Scale className="w-8 h-8 text-surface-600 mx-auto mb-2" />
            <p className="text-surface-500 text-sm">No values found in this spectrum.</p>
            <button
              onClick={() => setFilter('all')}
              className="mt-3 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              Show all values
            </button>
          </div>
        )}

        {/* Context footer */}
        {!loading && !error && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 pt-6 border-t border-surface-300/30"
          >
            <p className="text-xs text-surface-600 text-center mb-4">
              Values are inferred by AI from {result.total_laws_analyzed} democratically-established
              laws. Each value reflects patterns in what the community has chosen to ratify — not
              prescriptive ideals.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/constitution"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                View Constitution
              </Link>
              <Link
                href="/laws"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="w-3.5 h-3.5" />
                Browse Laws
              </Link>
              <Link
                href="/mandate"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <Flame className="w-3.5 h-3.5" />
                The Mandate
              </Link>
              <Link
                href="/bedrock"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                The Bedrock
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Analytics Hub
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
